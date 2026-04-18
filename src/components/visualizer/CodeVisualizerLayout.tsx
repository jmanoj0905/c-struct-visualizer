import { useEffect, useRef } from "react";
import CodeEditorPanel from "./CodeEditorPanel";
import ConsoleOutput from "./ConsoleOutput";
import StackFramePanel from "./StackFramePanel";
import HeapCanvas from "./HeapCanvas";
import StackHeapArrows from "./StackHeapArrows";
import ExecutionToolbar from "./ExecutionToolbar";
import ExecutionTimeline from "./ExecutionTimeline";
import { useVisualizerStore } from "../../store/visualizerStore";
import { useCanvasStore } from "../../store/canvasStore";
import AlertContainer from "../AlertContainer";

const CodeVisualizerLayout = () => {
  const { activeWorkspaceId, workspaceTabs } = useCanvasStore();
  const { loadSnapshot, saveSnapshot, trace } = useVisualizerStore();
  const activeTab = workspaceTabs.find(t => t.id === activeWorkspaceId);
  const language = activeTab?.language || "c";

  const heapAreaRef = useRef<HTMLDivElement>(null);

  // Load/save visualizer state on workspace switch
  useEffect(() => {
    loadSnapshot(activeWorkspaceId, language);
    return () => { saveSnapshot(activeWorkspaceId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  // Keyboard shortcuts for stepping
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) return;

      const store = useVisualizerStore.getState();
      if (!store.trace) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault(); store.goPrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault(); store.goNext();
      } else if (e.key === "Home") {
        e.preventDefault(); store.goFirst();
      } else if (e.key === "End") {
        e.preventDefault(); store.goLast();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /*
   * Layout:
   * ┌──────────────────┬──────────────┬─────────────────────┐
   * │  Code Editor     │  Stack       │  Heap               │
   * │                  │  (auto-fit)  │  (flex)             │
   * ├──────────────────┤              │                     │
   * │  Console         │              │                     │
   * └──────────────────┴──────────────┴─────────────────────┘
   *               [<< < Step X/N > >>]  ← floating
   *               [======timeline=====]
   */

  return (
    <div className="w-screen h-[calc(100vh-1.75rem)] mt-7 flex">
      <AlertContainer />

      {/* ─── Left column: Editor + Console ─── */}
      <div className="h-full flex flex-col border-r-2 border-black" style={{ width: "30%" }}>
        {/* Code Editor */}
        <div className="flex-1 min-h-0 flex flex-col">
          <CodeEditorPanel />
        </div>

        {/* Console — always visible */}
        <div className="h-[35%] flex-shrink-0 border-t-2 border-black">
          <ConsoleOutput />
        </div>
      </div>

      {/* ─── Right side: Stack (auto-fit) + Heap (flex) ─── */}
      <div className="flex-1 flex h-full min-w-0 relative" ref={heapAreaRef}>
        {/* Stack — auto-width to fit content, min 250px, max 400px */}
        <div
          className="min-w-[250px] max-w-[400px] w-fit flex-shrink-0 border-r-2 border-black overflow-y-auto overflow-x-hidden"
        >
          <StackFramePanel />
        </div>

        {/* Heap — takes remaining space */}
        <div className="flex-1 min-w-0">
          <HeapCanvas workspaceId={activeWorkspaceId} />
        </div>

        {/* SVG overlay for stack-to-heap arrows */}
        <StackHeapArrows containerRef={heapAreaRef} />
      </div>

      {/* ─── Floating step controls ─── */}
      <ExecutionToolbar />

      {/* ─── Floating Timeline — positioned right under step controls ─── */}
      {trace && (
        <div className="fixed bottom-[70px] left-1/2 -translate-x-1/2 z-40 w-[min(600px,80vw)]">
          <div className="bg-white border-2 border-black rounded-base shadow-shadow overflow-hidden">
            <ExecutionTimeline />
          </div>
        </div>
      )}
    </div>
  );
};

export default CodeVisualizerLayout;
