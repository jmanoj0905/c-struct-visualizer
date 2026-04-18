import { useState } from "react";
import { Boxes, Code, FileCode, Box, ArrowLeft } from "lucide-react";
import { useCanvasStore } from "../store/canvasStore";
import type { WorkspaceMode, WorkspaceLanguage } from "../types";

interface ModeSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModeSelectionDialog = ({ isOpen, onClose }: ModeSelectionDialogProps) => {
  const { addWorkspace } = useCanvasStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedLanguage, setSelectedLanguage] = useState<WorkspaceLanguage>("c");

  if (!isOpen) return null;

  const handleLanguageSelect = (lang: WorkspaceLanguage) => {
    setSelectedLanguage(lang);
    setStep(2);
  };

  const handleModeSelect = (mode: WorkspaceMode) => {
    addWorkspace(mode, selectedLanguage);
    setStep(1);
    onClose();
  };

  const handleClose = () => {
    setStep(1);
    onClose();
  };

  const langLabel = selectedLanguage === "cpp" ? "C++" : "C";
  const entityLabel = selectedLanguage === "cpp" ? "classes" : "structs";

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center"
      onClick={handleClose}
    >
      <div
        className="flex flex-col items-center gap-4 p-6 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {step === 1 && (
          <>
            <h2 className="font-heading text-sm text-white/80 uppercase tracking-wider">Choose Language</h2>
            <div className="flex gap-6">
              {/* C Card */}
              <button
                onClick={() => handleLanguageSelect("c")}
                className="bg-white border-2 border-black rounded-base shadow-shadow p-6 cursor-pointer hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all w-64 text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 border-2 border-black rounded-base bg-amber-100">
                    <FileCode size={24} />
                  </div>
                  <h3 className="font-heading text-lg">C</h3>
                </div>
                <p className="text-sm text-gray-600 font-base">
                  structs, malloc/free
                </p>
              </button>

              {/* C++ Card */}
              <button
                onClick={() => handleLanguageSelect("cpp")}
                className="bg-white border-2 border-black rounded-base shadow-shadow p-6 cursor-pointer hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all w-64 text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 border-2 border-black rounded-base bg-purple-100">
                    <Box size={24} />
                  </div>
                  <h3 className="font-heading text-lg">C++</h3>
                </div>
                <p className="text-sm text-gray-600 font-base">
                  classes, new/delete, inheritance
                </p>
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(1)}
                className="p-1.5 rounded-base hover:bg-white/20 transition-colors text-white/80"
                title="Back"
              >
                <ArrowLeft size={18} />
              </button>
              <h2 className="font-heading text-sm text-white/80 uppercase tracking-wider">Choose Mode — {langLabel}</h2>
            </div>
            <div className="flex gap-6">
              {/* Free Mode Card */}
              <button
                onClick={() => handleModeSelect("free")}
                className="bg-white border-2 border-black rounded-base shadow-shadow p-6 cursor-pointer hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all w-64 text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 border-2 border-black rounded-base bg-amber-100">
                    <Boxes size={24} />
                  </div>
                  <h3 className="font-heading text-lg">Free Mode</h3>
                </div>
                <p className="text-sm text-gray-600 font-base">
                  Manually create {entityLabel} and pointers on a canvas
                </p>
              </button>

              {/* Code Visualizer Card */}
              <button
                onClick={() => handleModeSelect("visualizer")}
                className="bg-white border-2 border-black rounded-base shadow-shadow p-6 cursor-pointer hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all w-64 text-left"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 border-2 border-black rounded-base bg-emerald-100">
                    <Code size={24} />
                  </div>
                  <h3 className="font-heading text-lg">Code Visualizer</h3>
                </div>
                <p className="text-sm text-gray-600 font-base">
                  Write {langLabel} code and step through execution
                </p>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModeSelectionDialog;
