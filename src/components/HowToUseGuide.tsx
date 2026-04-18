import { useState } from "react";
import { X, ChevronLeft, ChevronRight, Boxes, Code, Lightbulb } from "lucide-react";
import { UI_COLORS } from "../utils/colors";

interface HowToUseGuideProps {
  onClose: () => void;
}

interface Page {
  title: string;
  icon: React.ReactNode;
  items: string[];
}

const FREE_MODE_PAGES: Page[] = [
  {
    title: "C — Free Mode Basics",
    icon: <Code size={18} />,
    items: [
      "Click \"+ New Struct\" in the sidebar to define C structs with fields and pointer types",
      "Drag struct instances from the sidebar onto the canvas, or double-click to add",
      "Connect pointers by dragging from right handles (source) to left handles (target)",
      "Drag a pointer to empty space to quick-create a new connected struct",
      "Click the sparkle icon to auto-layout your diagram",
      "Export your work as PNG, SVG, or PDF from the menu",
    ],
  },
  {
    title: "C++ — Classes & Inheritance",
    icon: <Code size={18} />,
    items: [
      "Toggle C++ mode in a tab to unlock class features",
      "Define classes with access specifiers: public, private, protected",
      "Add methods, constructors, and destructors to your classes",
      "Use virtual methods and mark inheritance relationships",
      "Use new/delete semantics in visualizer mode for dynamic allocation",
      "Pointer members work the same way — drag to connect",
    ],
  },
  {
    title: "General Tips",
    icon: <Lightbulb size={18} />,
    items: [
      "Use tabs at the top to manage multiple workspaces",
      "Right-click a tab to rename, duplicate, or close it",
      "Drag tabs to reorder them",
      "Ctrl+Z / Ctrl+Shift+Z for undo/redo",
      "Ctrl+K opens the command palette for quick actions",
      "Each workspace can be Free Mode or Visualizer independently",
      "Your work is auto-saved to the browser",
    ],
  },
];

const VISUALIZER_PAGES: Page[] = [
  {
    title: "C — Code Visualizer",
    icon: <Code size={18} />,
    items: [
      "Write or paste C code in the editor on the left",
      "Click the green play button to run and generate a trace",
      "Use step controls (or left/right arrow keys) to step through execution",
      "Watch the heap canvas update as structs are allocated with malloc",
      "The stack panel shows local variables and their values at each step",
    ],
  },
  {
    title: "C++ — Extended Features",
    icon: <Code size={18} />,
    items: [
      "Toggle C++ mode on a visualizer tab for class support",
      "Classes, templates, and STL containers are supported",
      "new/delete calls are tracked on the heap canvas",
      "For full C++ support, connect a Docker compilation server",
      "Constructor and destructor calls appear in the execution timeline",
      "Virtual dispatch is visualized when stepping through code",
    ],
  },
  {
    title: "Visualizer Tips",
    icon: <Lightbulb size={18} />,
    items: [
      "Click gutter line numbers to set the current step to that line",
      "The execution timeline shows all steps — click any to jump",
      "Use left/right arrow keys to step backward/forward",
      "Toggle Auto Fit to keep the heap canvas zoomed to fit",
      "Toggle Auto Reorder to snap nodes back to computed layout",
      "Right-click the heap canvas to re-center the view",
      "Select a node to highlight its connections",
    ],
  },
];

const HowToUseGuide = ({ onClose }: HowToUseGuideProps) => {
  const [leftPage, setLeftPage] = useState(0);
  const [rightPage, setRightPage] = useState(0);
  const [leftFlipDir, setLeftFlipDir] = useState<"next" | "prev" | null>(null);
  const [rightFlipDir, setRightFlipDir] = useState<"next" | "prev" | null>(null);

  const goLeftPage = (dir: "next" | "prev") => {
    const next = dir === "next" ? leftPage + 1 : leftPage - 1;
    if (next < 0 || next >= FREE_MODE_PAGES.length) return;
    setLeftFlipDir(dir);
    setTimeout(() => {
      setLeftPage(next);
      setLeftFlipDir(null);
    }, 250);
  };

  const goRightPage = (dir: "next" | "prev") => {
    const next = dir === "next" ? rightPage + 1 : rightPage - 1;
    if (next < 0 || next >= VISUALIZER_PAGES.length) return;
    setRightFlipDir(dir);
    setTimeout(() => {
      setRightPage(next);
      setRightFlipDir(null);
    }, 250);
  };

  const renderPageContent = (page: Page) => (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        {page.icon}
        <h3 className="font-heading text-sm uppercase tracking-wider">
          {page.title}
        </h3>
      </div>
      <ul className="space-y-2.5">
        {page.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm font-base">
            <span className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-heading mt-0.5">
              {i + 1}
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const renderPageDots = (current: number, total: number) => (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full border border-black transition-all ${
            i === current ? "bg-black scale-125" : "bg-white"
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center modal-backdrop">
      <div
        className="relative flex w-[95vw] max-w-5xl h-[80vh] max-h-[600px] animate-scaleIn"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-10 p-1.5 bg-white border-2 border-black rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5 transition-all"
        >
          <X size={18} strokeWidth={3} />
        </button>

        {/* Left Book — Free Mode (amber) */}
        <div
          className="flex-1 border-2 border-black rounded-l-base flex flex-col overflow-hidden"
          style={{ backgroundColor: "#FFF8E1" }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 border-b-2 border-black flex items-center gap-2"
            style={{ backgroundColor: UI_COLORS.orange }}
          >
            <Boxes size={20} strokeWidth={2.5} />
            <span className="font-heading text-sm tracking-tight">FREE MODE</span>
          </div>

          {/* Page content with flip animation */}
          <div className="flex-1 overflow-y-auto p-5" style={{ perspective: "1000px" }}>
            <div
              className={`page-content ${
                leftFlipDir === "next"
                  ? "page-flip-out-left"
                  : leftFlipDir === "prev"
                  ? "page-flip-out-right"
                  : "page-flip-in"
              }`}
              style={{
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
              }}
            >
              {renderPageContent(FREE_MODE_PAGES[leftPage])}
            </div>
          </div>

          {/* Footer with navigation */}
          <div className="px-5 py-3 border-t-2 border-black flex items-center justify-between">
            <button
              onClick={() => goLeftPage("prev")}
              disabled={leftPage === 0}
              className={`p-1 rounded-base border-2 border-black transition-all ${
                leftPage === 0
                  ? "opacity-30 cursor-not-allowed bg-gray-100"
                  : "bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              }`}
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>

            <div className="flex flex-col items-center gap-1">
              {renderPageDots(leftPage, FREE_MODE_PAGES.length)}
              <span className="text-[10px] font-heading text-gray-500">
                {leftPage + 1} / {FREE_MODE_PAGES.length}
              </span>
            </div>

            <button
              onClick={() => goLeftPage("next")}
              disabled={leftPage === FREE_MODE_PAGES.length - 1}
              className={`p-1 rounded-base border-2 border-black transition-all ${
                leftPage === FREE_MODE_PAGES.length - 1
                  ? "opacity-30 cursor-not-allowed bg-gray-100"
                  : "bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              }`}
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Book Spine */}
        <div className="w-3 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 border-y-2 border-black flex-shrink-0" />

        {/* Right Book — Visualizer Mode (emerald) */}
        <div
          className="flex-1 border-2 border-black rounded-r-base flex flex-col overflow-hidden"
          style={{ backgroundColor: "#E8F5E9" }}
        >
          {/* Header */}
          <div
            className="px-5 py-3 border-b-2 border-black flex items-center gap-2"
            style={{ backgroundColor: UI_COLORS.green }}
          >
            <Code size={20} strokeWidth={2.5} />
            <span className="font-heading text-sm tracking-tight">VISUALIZER MODE</span>
          </div>

          {/* Page content with flip animation */}
          <div className="flex-1 overflow-y-auto p-5" style={{ perspective: "1000px" }}>
            <div
              className={`page-content ${
                rightFlipDir === "next"
                  ? "page-flip-out-left"
                  : rightFlipDir === "prev"
                  ? "page-flip-out-right"
                  : "page-flip-in"
              }`}
              style={{
                transformStyle: "preserve-3d",
                backfaceVisibility: "hidden",
              }}
            >
              {renderPageContent(VISUALIZER_PAGES[rightPage])}
            </div>
          </div>

          {/* Footer with navigation */}
          <div className="px-5 py-3 border-t-2 border-black flex items-center justify-between">
            <button
              onClick={() => goRightPage("prev")}
              disabled={rightPage === 0}
              className={`p-1 rounded-base border-2 border-black transition-all ${
                rightPage === 0
                  ? "opacity-30 cursor-not-allowed bg-gray-100"
                  : "bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              }`}
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>

            <div className="flex flex-col items-center gap-1">
              {renderPageDots(rightPage, VISUALIZER_PAGES.length)}
              <span className="text-[10px] font-heading text-gray-500">
                {rightPage + 1} / {VISUALIZER_PAGES.length}
              </span>
            </div>

            <button
              onClick={() => goRightPage("next")}
              disabled={rightPage === VISUALIZER_PAGES.length - 1}
              className={`p-1 rounded-base border-2 border-black transition-all ${
                rightPage === VISUALIZER_PAGES.length - 1
                  ? "opacity-30 cursor-not-allowed bg-gray-100"
                  : "bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
              }`}
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HowToUseGuide;
