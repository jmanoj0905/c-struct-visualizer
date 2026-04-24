import { useState } from "react";
import { Layers, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { useVisualizerStore } from "../../store/visualizerStore";
import { UI_COLORS } from "../../utils/colors";
import type { VariableSnapshot } from "../../types/visualizer";

interface FrameSectionProps {
  name: string;
  variables: VariableSnapshot[];
  isActive: boolean;
  defaultOpen: boolean;
}

function FrameSection({ name, variables, isActive, defaultOpen }: FrameSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 text-[10px] font-heading text-left hover:bg-gray-50 transition-colors"
        style={{ backgroundColor: isActive ? `${UI_COLORS.purple}22` : undefined }}
      >
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className={isActive ? "font-semibold" : "text-gray-500"}>{name}</span>
        {isActive && (
          <span className="ml-auto text-[9px] text-gray-400 font-base">active</span>
        )}
      </button>

      {open && (
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left font-heading py-0.5 px-2 text-[10px]">Name</th>
              <th className="text-left font-heading py-0.5 px-2 text-[10px]">Type</th>
              <th className="text-left font-heading py-0.5 px-2 text-[10px]">Value</th>
            </tr>
          </thead>
          <tbody>
            {variables.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-1 px-2 text-[10px] text-gray-400 font-base italic">
                  no variables
                </td>
              </tr>
            ) : (
              variables.map((v, i) => (
                <tr key={`${v.name}-${i}`} className="border-b border-gray-50">
                  <td className="py-0.5 px-2 font-mono font-heading">{v.name}</td>
                  <td className="py-0.5 px-2 font-mono text-gray-500">{v.type}</td>
                  <td className="py-0.5 px-2 font-mono">
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
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

const StackFramePanel = () => {
  const { callStack, trace } = useVisualizerStore();

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

      {/* Frame sections */}
      <div className="flex-1 overflow-auto">
        {!trace ? (
          <div className="text-xs text-gray-400 font-base p-2">
            Run code to see variables
          </div>
        ) : callStack.length === 0 ? (
          <div className="text-xs text-gray-400 font-base p-2">
            No variables in scope
          </div>
        ) : callStack.length === 1 ? (
          // Single frame — flat table, no collapsible header
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left font-heading py-1 px-1.5">Name</th>
                <th className="text-left font-heading py-1 px-1.5">Type</th>
                <th className="text-left font-heading py-1 px-1.5">Value</th>
              </tr>
            </thead>
            <tbody>
              {callStack[0].variables.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-1 px-1.5 text-xs text-gray-400 font-base">
                    No variables in scope
                  </td>
                </tr>
              ) : (
                callStack[0].variables.map((v, i) => (
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
                ))
              )}
            </tbody>
          </table>
        ) : (
          // Multiple frames — grouped sections, active frame on top
          <div>
            {[...callStack].reverse().map((frame, reversedIdx) => {
              const isActive = reversedIdx === 0;
              return (
                <FrameSection
                  key={`${frame.functionName}-${reversedIdx}`}
                  name={frame.functionName}
                  variables={frame.variables}
                  isActive={isActive}
                  defaultOpen={isActive}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default StackFramePanel;
