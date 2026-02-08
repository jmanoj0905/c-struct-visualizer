import { Terminal } from "lucide-react";
import { useVisualizerStore } from "../../store/visualizerStore";
import { UI_COLORS } from "../../utils/colors";

const ConsoleOutput = () => {
  const { consoleOutput, stdinInput, setStdinInput, trace, currentStepIndex, code } =
    useVisualizerStore();

  // Detect if the current step is on a scanf line
  const currentStep = trace?.[currentStepIndex] ?? null;
  const currentLineText = currentStep
    ? code.split("\n")[currentStep.line - 1] ?? ""
    : "";
  const stdinNeeded = !!currentStep && /\bscanf\s*\(/.test(currentLineText);

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

      {/* Content — stdin and stdout stacked vertically, each exactly 50% */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* stdout */}
        <div className="h-1/2 p-2 overflow-auto border-b-2 border-black">
          <label className="font-heading text-[10px] text-gray-500 mb-1 block">stdout</label>
          <pre className="font-mono text-xs whitespace-pre-wrap text-gray-800">
            {consoleOutput || (trace ? "(no output)" : "Run code to see output")}
          </pre>
        </div>

        {/* stdin */}
        <div className="h-1/2 p-2 flex flex-col min-h-0">
          <label className="font-heading text-[10px] text-gray-500 mb-1 flex-shrink-0">
            stdin
            {stdinNeeded && (
              <span className="text-red-600 ml-1 animate-pulse">— scanf needs input</span>
            )}
          </label>
          <textarea
            value={stdinInput}
            onChange={(e) => setStdinInput(e.target.value)}
            placeholder="Enter input for scanf..."
            className={`flex-1 min-h-0 font-mono text-sm border-2 rounded-base p-2 resize-none focus:outline-none ${
              stdinNeeded
                ? "border-red-500 ring-2 ring-red-300 bg-red-50"
                : "border-black"
            }`}
          />
        </div>
      </div>
    </div>
  );
};

export default ConsoleOutput;
