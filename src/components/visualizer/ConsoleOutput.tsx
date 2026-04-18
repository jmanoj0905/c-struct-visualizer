import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import { useVisualizerStore } from "../../store/visualizerStore";
import { UI_COLORS } from "../../utils/colors";

const ConsoleOutput = () => {
  const { consoleOutput, trace } = useVisualizerStore();
  const stdoutRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (stdoutRef.current) {
      stdoutRef.current.scrollTop = stdoutRef.current.scrollHeight;
    }
  }, [consoleOutput]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b-2 border-black flex-shrink-0"
        style={{ backgroundColor: UI_COLORS.green }}
      >
        <Terminal size={14} />
        <span className="font-heading text-xs">Console</span>
      </div>

      {/* Content - stdout only */}
      <div className="flex-1 overflow-hidden min-h-0 p-2">
        <pre ref={stdoutRef} className="font-mono text-xs whitespace-pre-wrap text-gray-800 h-full overflow-auto">
          {consoleOutput || (trace ? "(no output)" : "Run code to see output")}
        </pre>
      </div>
    </div>
  );
};

export default ConsoleOutput;
