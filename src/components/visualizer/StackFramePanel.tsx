import { Layers, ArrowRight } from "lucide-react";
import { useVisualizerStore } from "../../store/visualizerStore";
import { UI_COLORS } from "../../utils/colors";

const StackFramePanel = () => {
  const { callStack, variables, trace } = useVisualizerStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b-2 border-black flex-shrink-0"
        style={{ backgroundColor: UI_COLORS.purple }}
      >
        <Layers size={14} />
        <span className="font-heading text-xs">Stack</span>
        {callStack.length > 0 && (
          <span className="text-[10px] font-mono ml-auto">
            {callStack.map((f) => f.functionName).join(" > ")}
          </span>
        )}
      </div>

      {/* Variables table */}
      <div className="flex-1 overflow-auto p-2">
        {!trace ? (
          <div className="text-xs text-gray-400 font-base p-2">
            Run code to see variables
          </div>
        ) : variables.length === 0 ? (
          <div className="text-xs text-gray-400 font-base p-2">
            No variables in scope
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left font-heading py-1 px-1.5">Name</th>
                <th className="text-left font-heading py-1 px-1.5">Type</th>
                <th className="text-left font-heading py-1 px-1.5">Value</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v, i) => (
                <tr key={`${v.name}-${i}`} className="border-b border-gray-100">
                  <td className="py-1 px-1.5 font-mono font-heading">{v.name}</td>
                  <td className="py-1 px-1.5 font-mono text-gray-600">{v.type}</td>
                  <td className="py-1 px-1.5 font-mono">
                    {v.isPointer ? (
                      <span className="flex items-center gap-1">
                        <ArrowRight size={10} className="text-blue-500" />
                        {v.value}
                      </span>
                    ) : (
                      v.value
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StackFramePanel;
