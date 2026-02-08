import { Boxes, Code } from "lucide-react";
import { useCanvasStore } from "../store/canvasStore";
import type { WorkspaceMode } from "../types";

interface ModeSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModeSelectionDialog = ({ isOpen, onClose }: ModeSelectionDialogProps) => {
  const { addWorkspace } = useCanvasStore();

  if (!isOpen) return null;

  const handleSelect = (mode: WorkspaceMode) => {
    addWorkspace(mode);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="flex gap-6 p-6 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Free Mode Card */}
        <button
          onClick={() => handleSelect("free")}
          className="bg-white border-2 border-black rounded-base shadow-shadow p-6 cursor-pointer hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all w-64 text-left"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 border-2 border-black rounded-base bg-amber-100">
              <Boxes size={24} />
            </div>
            <h3 className="font-heading text-lg">Free Mode</h3>
          </div>
          <p className="text-sm text-gray-600 font-base">
            Manually create structs and pointers on a canvas
          </p>
        </button>

        {/* Code Visualizer Card */}
        <button
          onClick={() => handleSelect("visualizer")}
          className="bg-white border-2 border-black rounded-base shadow-shadow p-6 cursor-pointer hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all w-64 text-left"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 border-2 border-black rounded-base bg-emerald-100">
              <Code size={24} />
            </div>
            <h3 className="font-heading text-lg">Code Visualizer</h3>
          </div>
          <p className="text-sm text-gray-600 font-base">
            Paste C code and step through execution
          </p>
        </button>
      </div>
    </div>
  );
};

export default ModeSelectionDialog;
