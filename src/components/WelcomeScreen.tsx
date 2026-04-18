import { useState } from "react";
import { Boxes, Code, HelpCircle, X, ArrowRight } from "lucide-react";
import { useCanvasStore } from "../store/canvasStore";
import type { WorkspaceMode } from "../types";

interface WelcomeScreenProps {
  onDismiss: () => void;
}

const TIPS = [
  {
    title: "Free Mode",
    items: [
      "Click \"+ New Struct\" in the sidebar to define C structs",
      "Drag struct instances from the sidebar onto the canvas",
      "Connect pointers by dragging from the right handle (source) to the left handle (target)",
      "Right-click for context menus on nodes and connections",
      "Use Ctrl+Z / Ctrl+Shift+Z for undo/redo",
      "Click the magic wand icon to auto-layout your diagram",
      "Export your diagram as PNG, SVG, or PDF from the hamburger menu",
    ],
  },
  {
    title: "Code Visualizer",
    items: [
      "Write or paste C code in the editor on the left",
      "Click the green play button to run and generate a trace",
      "Use the step controls (or arrow keys) to step through execution",
      "Watch the heap canvas update as structs are allocated",
      "The stack panel shows local variables and their values",
      "Click the red stop button to return to editing",
    ],
  },
  {
    title: "General Tips",
    items: [
      "Use tabs at the top to manage multiple workspaces",
      "Right-click a tab to rename, duplicate, or close it",
      "Drag tabs to reorder them",
      "Each workspace can be Free Mode or Visualizer independently",
      "Your work is auto-saved to the browser",
    ],
  },
];

const WelcomeScreen = ({ onDismiss }: WelcomeScreenProps) => {
  const { addWorkspace } = useCanvasStore();
  const [showGuide, setShowGuide] = useState(false);

  const handleSelect = (mode: WorkspaceMode) => {
    addWorkspace(mode);
    onDismiss();
  };

  if (showGuide) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div
          className="bg-white border-2 border-black rounded-base shadow-shadow max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col animate-scaleIn"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-blue-50">
            <div className="flex items-center gap-3">
              <HelpCircle size={22} />
              <h2 className="font-heading text-lg">How to Use</h2>
            </div>
            <button
              onClick={() => setShowGuide(false)}
              className="p-1 hover:bg-black/10 rounded-base transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {TIPS.map((section) => (
              <div key={section.title}>
                <h3 className="font-heading text-sm uppercase tracking-wider text-gray-500 mb-2">
                  {section.title}
                </h3>
                <ul className="space-y-1.5">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm font-base">
                      <ArrowRight size={14} className="flex-shrink-0 mt-0.5 text-gray-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t-2 border-black flex justify-end">
            <button
              onClick={() => setShowGuide(false)}
              className="px-4 py-2 border-2 border-black rounded-base font-heading text-sm shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all bg-white cursor-pointer"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div
        className="flex flex-col items-center gap-8 p-8 animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <div className="text-center">
          <h1 className="font-heading text-3xl tracking-wider uppercase text-white mb-2">
            C Struct Visualizer
          </h1>
          <p className="text-sm text-gray-300 font-base">
            Choose a mode to get started
          </p>
        </div>

        {/* Mode cards */}
        <div className="flex gap-6">
          {/* Free Mode */}
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

          {/* Code Visualizer */}
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
              Write C code and step through execution
            </p>
          </button>

          {/* How to Use */}
          <button
            onClick={() => setShowGuide(true)}
            className="bg-white border-2 border-black rounded-base shadow-shadow p-6 cursor-pointer hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all w-64 text-left"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 border-2 border-black rounded-base bg-blue-100">
                <HelpCircle size={24} />
              </div>
              <h3 className="font-heading text-lg">How to Use</h3>
            </div>
            <p className="text-sm text-gray-600 font-base">
              Learn the basics of using the visualizer
            </p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
