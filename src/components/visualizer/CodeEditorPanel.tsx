import { useCallback, useEffect, useMemo, useRef } from "react";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { EditorView, Decoration, type DecorationSet } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import { Play, Loader2, Keyboard, Square, X } from "lucide-react";
import { useVisualizerStore } from "../../store/visualizerStore";
import { detectLanguage } from "../../engine/traceRunner";
import { UI_COLORS } from "../../utils/colors";

// State effect to update highlighted lines
const setHighlightedLines = StateEffect.define<{
  current: number;
  next: number;
  selected: number[];
}>();

// Line highlight decorations
const currentLineDeco = Decoration.line({ class: "cm-current-line-highlight" });
const nextLineDeco = Decoration.line({ class: "cm-next-line-highlight" });
const selectedLineDeco = Decoration.line({ class: "cm-selected-line-highlight" });

const lineHighlightField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decoSet, tr) {
    for (const e of tr.effects) {
      if (e.is(setHighlightedLines)) {
        const { current, next, selected } = e.value;
        const decorations: { from: number; to: number; value: Decoration }[] = [];

        for (const lineNum of selected) {
          if (lineNum > 0 && lineNum <= tr.state.doc.lines) {
            const line = tr.state.doc.line(lineNum);
            decorations.push({ from: line.from, to: line.from, value: selectedLineDeco });
          }
        }
        if (current > 0) {
          const line = tr.state.doc.line(Math.min(current, tr.state.doc.lines));
          decorations.push({ from: line.from, to: line.from, value: currentLineDeco });
        }
        if (next > 0 && next !== current) {
          const lineNum = Math.min(next, tr.state.doc.lines);
          const line = tr.state.doc.line(lineNum);
          decorations.push({ from: line.from, to: line.from, value: nextLineDeco });
        }

        return Decoration.set(decorations.sort((a, b) => a.from - b.from));
      }
    }
    return decoSet;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// Theme for line highlights
const highlightTheme = EditorView.baseTheme({
  ".cm-current-line-highlight": {
    backgroundColor: "#bbf7d0 !important",  // green-200
  },
  ".cm-next-line-highlight": {
    backgroundColor: "#fef08a !important",  // yellow-200
  },
  ".cm-selected-line-highlight": {
    backgroundColor: "#bfdbfe !important",  // blue-200
  },
  ".cm-gutters": {
    cursor: "pointer",
  },
});

const CodeEditorPanel = () => {
  const { code, setCode, trace, currentStepIndex, isTracing, runTrace, stopExecution, traceError, selectedLines, toggleSelectedLine, clearSelectedLines } =
    useVisualizerStore();
  const detectedLang = useMemo(() => detectLanguage(code), [code]);
  const cmRef = useRef<ReactCodeMirrorRef>(null);

  const currentStep = trace?.[currentStepIndex] ?? null;
  const nextStep = trace?.[currentStepIndex + 1] ?? null;

  // Handle clicks on the line number gutter — toggle line in/out of selection
  const handleEditorWrapperClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trace) return;
      const target = e.target as HTMLElement;
      if (!target.closest(".cm-lineNumbers")) return;
      const gutterEl = target.closest(".cm-gutterElement") as HTMLElement | null;
      if (!gutterEl) return;
      const lineNum = parseInt(gutterEl.textContent ?? "", 10);
      if (isNaN(lineNum)) return;
      toggleSelectedLine(lineNum);
    },
    [trace, toggleSelectedLine],
  );

  const extensions = useMemo(
    () => [cpp(), lineHighlightField, highlightTheme, EditorView.lineWrapping],
    [],
  );

  // Update highlighted lines via effect when step/selection changes
  const currentLine = currentStep?.line ?? 0;
  const nextLine = nextStep?.line ?? 0;

  useEffect(() => {
    const view = cmRef.current?.view;
    if (!view) return;
    view.dispatch({
      effects: setHighlightedLines.of({
        current: trace ? currentLine : 0,
        next: trace ? nextLine : 0,
        selected: trace ? selectedLines : [],
      }),
    });
  }, [trace, currentLine, nextLine, selectedLines]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b-2 border-black"
        style={{ backgroundColor: UI_COLORS.yellow }}
      >
        <div className="flex items-center gap-2">
          <Keyboard size={14} />
          <span className="font-heading text-xs">Code Editor</span>
          <span className="text-[9px] font-heading border border-black/40 px-1.5 py-0.5 rounded bg-white/30">
            {detectedLang === "cpp" ? "C++" : "C"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Stop button — visible when trace is loaded or running */}
          {(trace || isTracing) && (
            <button
              onClick={stopExecution}
              className="flex items-center justify-center w-7 h-7 border-2 border-black rounded-base shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none cursor-pointer transition-all"
              style={{ backgroundColor: "#EF4444" }}
              title="Stop and edit code"
            >
              <Square size={12} fill="white" stroke="white" />
            </button>
          )}

          {/* Run button */}
          <button
            onClick={runTrace}
            disabled={isTracing}
            className={`flex items-center justify-center w-7 h-7 border-2 border-black rounded-base font-heading text-xs transition-all ${
              isTracing
                ? "opacity-50 cursor-not-allowed bg-gray-100"
                : "shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none cursor-pointer"
            }`}
            style={{ backgroundColor: isTracing ? undefined : UI_COLORS.green }}
            title="Run code"
          >
            {isTracing ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
          </button>

        </div>
      </div>

      {/* Error display */}
      {traceError && (
        <div className="px-3 py-2 bg-red-50 border-b-2 border-black text-xs text-red-700 font-mono">
          {traceError}
        </div>
      )}

      {/* CodeMirror editor */}
      <div className="flex-1 overflow-auto" onClick={handleEditorWrapperClick}>
        <CodeMirror
          ref={cmRef}
          value={code}
          onChange={setCode}
          extensions={extensions}
          readOnly={isTracing}
          editable={!isTracing}
          height="100%"
          className="h-full text-sm"
          basicSetup={{
            lineNumbers: true,
            foldGutter: false,
            highlightActiveLine: !trace,
            bracketMatching: true,
            autocompletion: false,
          }}
        />
      </div>

      {/* Traced lines indicator */}
      {trace && selectedLines.length > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 border-t-2 border-black bg-blue-50 text-[10px] font-heading">
          <span className="text-blue-700">
            Tracing line{selectedLines.length > 1 ? "s" : ""}{" "}
            {[...selectedLines].sort((a, b) => a - b).join(", ")}
          </span>
          <button
            onClick={clearSelectedLines}
            className="ml-auto flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-blue-200/50 text-blue-600 transition-colors"
            title="Clear traced lines"
          >
            <X size={10} />
            <span>Clear</span>
          </button>
        </div>
      )}

    </div>
  );
};

export default CodeEditorPanel;
