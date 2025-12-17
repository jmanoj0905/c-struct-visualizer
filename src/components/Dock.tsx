import {
  Hand,
  MousePointer,
  Undo,
  Redo,
  Maximize2,
  Wand2,
  Trash2,
} from "lucide-react";
import { UI_COLORS } from "../utils/colors";

interface DockProps {
  isSelecting: boolean;
  onToggleSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onFitView: () => void;
  onAutoLayout: () => void;
  onClearWorkspace: () => void;
  undoDisabled: boolean;
  redoDisabled: boolean;
}

const Dock = ({
  isSelecting,
  onToggleSelection,
  onUndo,
  onRedo,
  onFitView,
  onAutoLayout,
  onClearWorkspace,
  undoDisabled,
  redoDisabled,
}: DockProps) => {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-2 bg-white border-2 border-black rounded-base px-3 py-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {/* Selection Mode Toggle */}
        <button
          onClick={onToggleSelection}
          className="p-2 border-2 border-black rounded-base hover:translate-x-1 hover:translate-y-1 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
          style={{
            backgroundColor: isSelecting ? UI_COLORS.indigo : UI_COLORS.yellow,
          }}
          title={
            isSelecting
              ? "Switch to Pan Mode (Shift)"
              : "Switch to Selection Mode (Shift)"
          }
        >
          {isSelecting ? (
            <MousePointer size={18} strokeWidth={2.5} />
          ) : (
            <Hand size={18} strokeWidth={2.5} />
          )}
        </button>

        {/* Undo */}
        <button
          onClick={onUndo}
          disabled={undoDisabled}
          className="p-2 border-2 border-black rounded-base hover:translate-x-1 hover:translate-y-1 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          style={{ backgroundColor: UI_COLORS.green }}
          title="Undo (Ctrl/Cmd+Z)"
        >
          <Undo size={18} strokeWidth={2.5} />
        </button>

        {/* Redo */}
        <button
          onClick={onRedo}
          disabled={redoDisabled}
          className="p-2 border-2 border-black rounded-base hover:translate-x-1 hover:translate-y-1 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          style={{ backgroundColor: UI_COLORS.orange }}
          title="Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+U)"
        >
          <Redo size={18} strokeWidth={2.5} />
        </button>

        {/* Fit to Window */}
        <button
          onClick={onFitView}
          className="p-2 border-2 border-black rounded-base hover:translate-x-1 hover:translate-y-1 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
          style={{ backgroundColor: UI_COLORS.cyan }}
          title="Fit to window"
        >
          <Maximize2 size={18} strokeWidth={2.5} />
        </button>

        {/* Auto Layout */}
        <button
          onClick={onAutoLayout}
          className="p-2 border-2 border-black rounded-base hover:translate-x-1 hover:translate-y-1 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
          style={{ backgroundColor: UI_COLORS.indigo }}
          title="Auto arrange layout"
        >
          <Wand2 size={18} strokeWidth={2.5} />
        </button>

        {/* Separator */}
        <div className="w-px h-8 bg-black mx-1" />

        {/* Clear Workspace */}
        <button
          onClick={onClearWorkspace}
          className="p-2 border-2 border-black rounded-base hover:translate-x-1 hover:translate-y-1 transition-transform shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none"
          style={{ backgroundColor: UI_COLORS.red }}
          title="Clear workspace"
        >
          <Trash2 size={18} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

export default Dock;
