"""
GDB Python script for execution tracing.
Run via: gdb --batch --quiet -x gdb-trace.py ./program

Environment variables:
  TRACE_OUTPUT   - path to write trace JSON (default: trace.json)
  TRACE_STDIN    - path to stdin file (default: stdin.txt)
  TRACE_STDOUT   - path to stdout capture file (default: stdout.txt)
  TRACE_MAX_STEPS - max steps before killing (default: 10000)
  TRACE_SOURCE   - path to source file to trace (default: program.c)
"""

import gdb
import json
import os
import sys

# ── Config ──────────────────────────────────────────────────────────────────

OUTPUT_FILE = os.environ.get("TRACE_OUTPUT", "trace.json")
STDIN_FILE = os.environ.get("TRACE_STDIN", "stdin.txt")
STDOUT_FILE = os.environ.get("TRACE_STDOUT", "stdout.txt")
MAX_STEPS = int(os.environ.get("TRACE_MAX_STEPS", "10000"))
SOURCE_FILE = os.environ.get("TRACE_SOURCE", "program.c")

# ── Architecture detection ──────────────────────────────────────────────────


def get_arch():
    """Detect architecture for register-based arg reading."""
    try:
        arch = gdb.execute("show architecture", to_string=True)
        if "aarch64" in arch or "arm" in arch:
            return "aarch64"
    except Exception:
        pass
    return "x86_64"


ARCH = get_arch()


def get_first_arg():
    """Read first function argument from the appropriate register."""
    try:
        if ARCH == "aarch64":
            return int(gdb.parse_and_eval("$x0"))
        else:
            return int(gdb.parse_and_eval("$rdi"))
    except Exception:
        return 0


def get_return_value():
    """Read return value from the appropriate register."""
    try:
        if ARCH == "aarch64":
            return int(gdb.parse_and_eval("$x0"))
        else:
            return int(gdb.parse_and_eval("$rax"))
    except Exception:
        return 0


# ── Heap tracking ───────────────────────────────────────────────────────────

# { address: { size, freed, typeName, isStruct, className } }
heap_allocations = {}


class MallocFinishBreakpoint(gdb.FinishBreakpoint):
    def __init__(self, size):
        super().__init__(gdb.newest_frame(), internal=True)
        self.alloc_size = size
        self.silent = True

    def stop(self):
        addr = get_return_value()
        if addr and addr != 0:
            heap_allocations[addr] = {
                "size": self.alloc_size,
                "freed": False,
                "typeName": "unknown",
                "isStruct": False,
                "className": None,
            }
        return False  # don't stop

    def out_of_scope(self):
        pass


class MallocBreakpoint(gdb.Breakpoint):
    def __init__(self, func_name):
        super().__init__(func_name, internal=True)
        self.silent = True

    def stop(self):
        try:
            size = get_first_arg()
            MallocFinishBreakpoint(size)
        except Exception:
            pass
        return False


class FreeBreakpoint(gdb.Breakpoint):
    def __init__(self, func_name):
        super().__init__(func_name, internal=True)
        self.silent = True

    def stop(self):
        try:
            addr = get_first_arg()
            if addr in heap_allocations:
                heap_allocations[addr]["freed"] = True
        except Exception:
            pass
        return False


# ── Source line resolution ──────────────────────────────────────────────────


def get_source_lines():
    """Read the source file and return as a list (0-indexed)."""
    try:
        src = os.path.basename(SOURCE_FILE)
        # Try to find the full path
        for candidate in [SOURCE_FILE, os.path.join(os.getcwd(), src)]:
            if os.path.exists(candidate):
                with open(candidate) as f:
                    return f.readlines()
    except Exception:
        pass
    return []


source_lines = get_source_lines()


def get_line_text(line_num):
    """Get the text of a source line (1-based)."""
    if 0 < line_num <= len(source_lines):
        return source_lines[line_num - 1].strip()
    return ""


# ── Variable formatting ────────────────────────────────────────────────────


def format_variable(symbol, frame):
    """Format a variable into a VariableSnapshot dict."""
    name = symbol.name
    try:
        val = frame.read_var(symbol)
        typ = val.type.strip_typedefs()
        type_str = str(symbol.type)
    except Exception:
        return {
            "name": name,
            "type": str(symbol.type),
            "value": "<unavailable>",
            "isPointer": False,
            "pointerLevel": 0,
        }

    is_pointer = typ.code == gdb.TYPE_CODE_PTR
    pointer_level = 0
    t = typ
    while t.code == gdb.TYPE_CODE_PTR:
        pointer_level += 1
        t = t.target()

    result = {
        "name": name,
        "type": type_str,
        "isPointer": is_pointer,
        "pointerLevel": pointer_level,
    }

    try:
        val_str = str(val)

        if "<optimized out>" in val_str:
            result["value"] = "<optimized out>"
            return result

        if is_pointer:
            try:
                addr = int(val)
                if addr == 0:
                    result["value"] = "NULL"
                else:
                    result["value"] = hex(addr)
                    result["pointsTo"] = addr
                    # Update heap type info
                    update_heap_type_from_pointer(typ, addr)
            except (gdb.error, ValueError):
                result["value"] = val_str
        elif typ.code == gdb.TYPE_CODE_INT:
            # Check if it's a char type
            if typ.sizeof == 1 and "char" in type_str:
                try:
                    c = int(val) & 0xFF
                    if 32 <= c < 127:
                        result["value"] = "'{}'".format(chr(c))
                    else:
                        result["value"] = str(c)
                except (gdb.error, ValueError):
                    result["value"] = val_str
            else:
                result["value"] = val_str
        elif typ.code == gdb.TYPE_CODE_FLT:
            result["value"] = val_str
        elif typ.code == gdb.TYPE_CODE_ARRAY:
            result["value"] = val_str
        elif typ.code in (gdb.TYPE_CODE_STRUCT, gdb.TYPE_CODE_UNION):
            result["value"] = val_str
        else:
            result["value"] = val_str
    except gdb.error:
        result["value"] = "<error reading value>"

    return result


def update_heap_type_from_pointer(ptr_type, addr):
    """If a typed pointer points to a heap allocation, update type info."""
    if addr not in heap_allocations:
        return
    alloc = heap_allocations[addr]
    if alloc["freed"]:
        return

    try:
        target = ptr_type.target().strip_typedefs()
        target_name = str(target)
        if target.code in (gdb.TYPE_CODE_STRUCT, gdb.TYPE_CODE_UNION):
            alloc["typeName"] = target_name
            alloc["isStruct"] = True
            # Check for class (has vtable or methods)
            if target_name.startswith("class "):
                alloc["className"] = target_name.replace("class ", "")
            elif target_name.startswith("struct "):
                pass
            else:
                alloc["className"] = target_name
        elif target_name != "void" and alloc["typeName"] == "unknown":
            alloc["typeName"] = target_name
    except Exception:
        pass


# ── Heap snapshot ───────────────────────────────────────────────────────────


def snapshot_heap():
    """Build HeapObject[] from tracked allocations."""
    objects = []
    for addr, info in heap_allocations.items():
        obj = {
            "address": addr,
            "typeName": info["typeName"],
            "isStruct": info["isStruct"],
            "fields": {},
            "freed": info["freed"],
        }
        if info["className"]:
            obj["className"] = info["className"]

        # Try to read fields if it's a struct type and not freed
        if info["isStruct"] and not info["freed"]:
            try:
                type_name = info["typeName"]
                # Remove leading struct/class keyword for casting
                cast_type = type_name
                ptr_expr = "(({} *){})".format(cast_type, addr)
                val = gdb.parse_and_eval(ptr_expr)
                deref = val.dereference()
                obj["fields"] = read_struct_fields(deref)
            except Exception:
                pass

        objects.append(obj)
    return objects


def read_struct_fields(val):
    """Read fields from a struct/class GDB value."""
    fields = {}
    try:
        for field in val.type.fields():
            if field.artificial:
                continue
            fname = field.name
            if not fname:
                continue
            try:
                fval = val[fname]
                ftype = fval.type.strip_typedefs()
                ftype_str = str(field.type)
                is_ptr = ftype.code == gdb.TYPE_CODE_PTR
                ptr_level = 0
                t = ftype
                while t.code == gdb.TYPE_CODE_PTR:
                    ptr_level += 1
                    t = t.target()

                field_info = {
                    "value": format_field_value(fval, ftype),
                    "type": ftype_str,
                    "isPointer": is_ptr,
                    "pointerLevel": ptr_level,
                }
                if is_ptr:
                    try:
                        ptr_addr = int(fval)
                        if ptr_addr != 0:
                            field_info["pointsTo"] = ptr_addr
                    except (gdb.error, ValueError):
                        pass
                fields[fname] = field_info
            except gdb.error:
                fields[fname] = {
                    "value": "<error>",
                    "type": str(field.type),
                    "isPointer": False,
                    "pointerLevel": 0,
                }
    except Exception:
        pass
    return fields


def format_field_value(val, typ):
    """Format a struct field value to string."""
    try:
        if typ.code == gdb.TYPE_CODE_PTR:
            addr = int(val)
            return "NULL" if addr == 0 else hex(addr)
        elif typ.code == gdb.TYPE_CODE_INT and typ.sizeof == 1 and "char" in str(typ):
            c = int(val) & 0xFF
            if 32 <= c < 127:
                return "'{}'".format(chr(c))
            return str(c)
        else:
            return str(val)
    except (gdb.error, ValueError):
        return str(val)


# ── Stack frame walking ────────────────────────────────────────────────────


def collect_frames():
    """Walk the frame chain and collect StackFrame[] and flat stackVariables."""
    frames = []
    all_vars = []
    frame = gdb.selected_frame()

    while frame is not None:
        try:
            sal = frame.find_sal()
            func = frame.function()
            func_name = str(func) if func else "<unknown>"

            # Skip non-user frames
            if not sal.symtab or SOURCE_FILE not in sal.symtab.fullname():
                frame = frame.older()
                continue

            line = sal.line
            variables = []
            try:
                block = frame.block()
                while block is not None:
                    if block.is_global:
                        break
                    for sym in block:
                        if sym.is_argument or sym.is_variable:
                            var = format_variable(sym, frame)
                            variables.append(var)
                    block = block.superblock
            except Exception:
                pass

            frames.append(
                {
                    "functionName": func_name,
                    "line": line,
                    "variables": variables,
                }
            )

            # Innermost frame variables are the "stackVariables"
            if not all_vars:
                all_vars = variables

        except Exception:
            pass

        frame = frame.older()

    return frames, all_vars


# ── Stdout capture ─────────────────────────────────────────────────────────


def read_stdout():
    """Read cumulative stdout from the capture file."""
    try:
        if os.path.exists(STDOUT_FILE):
            with open(STDOUT_FILE, "r") as f:
                return f.read()
    except Exception:
        pass
    return ""


# ── Main tracing logic ─────────────────────────────────────────────────────

steps = []
step_count = 0
error_msg = None
stopped_with_signal = False


def is_user_source(sal):
    """Check if a SAL refers to our source file."""
    if not sal or not sal.symtab:
        return False
    return SOURCE_FILE in sal.symtab.fullname()


def record_step():
    """Record one ExecutionStep."""
    global step_count

    if step_count >= MAX_STEPS:
        return False

    try:
        frame = gdb.selected_frame()
        sal = frame.find_sal()

        if not is_user_source(sal):
            return True

        line = sal.line
        statement = get_line_text(line)
        console_output = read_stdout()
        call_stack, stack_vars = collect_frames()
        heap_objs = snapshot_heap()

        steps.append(
            {
                "index": step_count,
                "line": line,
                "column": 0,
                "statement": statement,
                "consoleOutput": console_output,
                "callStack": call_stack,
                "heapObjects": heap_objs,
                "stackVariables": stack_vars,
            }
        )

        step_count += 1

        if step_count >= MAX_STEPS:
            return False

    except Exception as e:
        pass

    return True


def write_output():
    """Write the trace JSON to the output file."""
    result = {
        "steps": steps,
        "error": error_msg,
    }
    try:
        with open(OUTPUT_FILE, "w") as f:
            json.dump(result, f)
    except Exception as e:
        sys.stderr.write("Failed to write trace output: {}\n".format(e))


def on_stop(event):
    """Handle stop events (signals like SIGSEGV)."""
    global stopped_with_signal, error_msg

    if isinstance(event, gdb.SignalEvent):
        stopped_with_signal = True
        error_msg = "Program received signal {} ({})".format(
            event.stop_signal,
            {
                "SIGSEGV": "Segmentation fault",
                "SIGABRT": "Aborted",
                "SIGFPE": "Floating point exception",
                "SIGBUS": "Bus error",
            }.get(event.stop_signal, event.stop_signal),
        )
        # Record the crashing step
        try:
            record_step()
        except Exception:
            pass


# ── Setup and run ───────────────────────────────────────────────────────────

# Register signal handler
gdb.events.stop.connect(on_stop)

# Set breakpoint at main first (before any run)
gdb.execute("set pagination off")
gdb.execute("set print pretty off")
gdb.execute("set print elements 200")
gdb.execute("set confirm off")
gdb.execute("set breakpoint pending on")
gdb.execute("break main")

# Set up heap tracking breakpoints (pending — resolved when libs load)
for func in [
    "malloc",
    "calloc",
    "operator new(unsigned long)",
    "operator new(unsigned int)",
    "_Znwm",
    "_Znam",
]:
    try:
        MallocBreakpoint(func)
    except Exception:
        pass

for func in [
    "free",
    "operator delete(void*)",
    "operator delete(void*, unsigned long)",
    "_ZdlPv",
    "_ZdlPvm",
]:
    try:
        FreeBreakpoint(func)
    except Exception:
        pass

# Start the program with I/O redirection
# Use GDB's tty command and manual file descriptor manipulation
try:
    # Enable shell startup to support redirection operators
    gdb.execute("set startup-with-shell on")

    # Build run command with proper redirection
    # GDB passes these to the shell when startup-with-shell is enabled
    if os.path.exists(STDIN_FILE):
        run_cmd = "run < '{}' > '{}' 2>&1".format(STDIN_FILE, STDOUT_FILE)
    else:
        run_cmd = "run > '{}' 2>&1".format(STDOUT_FILE)

    gdb.execute(run_cmd)
except Exception:
    pass

if not stopped_with_signal:
    # Record initial state at main
    record_step()

    # Step through the program
    while not stopped_with_signal:
        try:
            gdb.execute("step", to_string=True)

            # Flush stdout after each step so output appears immediately
            try:
                gdb.execute("call fflush(stdout)")
            except Exception:
                pass

            # Check if the program has exited
            try:
                frame = gdb.selected_frame()
            except gdb.error:
                # Program exited - record final output only
                final_output = read_stdout()
                if steps:
                    steps[-1]["consoleOutput"] = final_output
                break

            sal = frame.find_sal()

            # If we stepped into non-user code (library / libc), finish back
            if not is_user_source(sal):
                recovered = False
                for _ in range(50):
                    try:
                        gdb.execute("finish", to_string=True)
                        try:
                            frame = gdb.selected_frame()
                        except gdb.error:
                            # Program exited - record final output
                            final_output = read_stdout()
                            if steps:
                                steps[-1]["consoleOutput"] = final_output
                            break
                        sal = frame.find_sal()
                        if is_user_source(sal):
                            recovered = True
                            break
                    except gdb.error:
                        break
                if not recovered:
                    # Record final output before breaking
                    final_output = read_stdout()
                    if steps:
                        steps[-1]["consoleOutput"] = final_output
                    break  # left user code for good (main returned)

            if not record_step():
                error_msg = "Execution exceeded maximum step limit ({})".format(
                    MAX_STEPS
                )
                break

        except gdb.error as e:
            err_str = str(e)
            if "not being run" in err_str or "no stack" in err_str.lower():
                # Record final output
                final_output = read_stdout()
                if steps:
                    steps[-1]["consoleOutput"] = final_output
                break
            break

# Write the final output
write_output()
