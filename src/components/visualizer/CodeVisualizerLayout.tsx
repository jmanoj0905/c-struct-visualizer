import { useEffect } from "react";
import CodeEditorPanel from "./CodeEditorPanel";
import ConsoleOutput from "./ConsoleOutput";
import StackFramePanel from "./StackFramePanel";
import HeapCanvas from "./HeapCanvas";
import { useVisualizerStore } from "../../store/visualizerStore";
import { useCanvasStore } from "../../store/canvasStore";
import AlertContainer from "../AlertContainer";

const CodeVisualizerLayout = () => {
  const { activeWorkspaceId } = useCanvasStore();
  const { loadSnapshot, saveSnapshot } = useVisualizerStore();

  // Load/save visualizer state on workspace switch
  useEffect(() => {
    loadSnapshot(activeWorkspaceId);

    return () => {
      saveSnapshot(activeWorkspaceId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspaceId]);

  // Keyboard shortcuts for stepping
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const store = useVisualizerStore.getState();
      if (!store.trace) return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        store.goPrev();
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        store.goNext();
      } else if (e.key === "Home") {
        e.preventDefault();
        store.goFirst();
      } else if (e.key === "End") {
        e.preventDefault();
        store.goLast();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="w-screen h-[calc(100vh-1.75rem)] mt-7 flex">
      <AlertContainer />

      {/* Left panel: Code Editor (1/3 width) */}
      <div className="w-1/3 border-r-2 border-black flex flex-col">
        <CodeEditorPanel />
      </div>

      {/* Right panel: Console+Stack + Heap (2/3 width) */}
      <div className="w-2/3 flex flex-col">
        {/* Top row: Console (stdin/stdout stacked) | Stack side by side */}
        <div className="h-[25%] border-b-2 border-black flex">
          <div className="w-1/2 border-r-2 border-black">
            <ConsoleOutput />
          </div>
          <div className="w-1/2">
            <StackFramePanel />
          </div>
        </div>

        {/* Heap Canvas */}
        <div className="flex-1">
          <HeapCanvas />
        </div>
      </div>
    </div>
  );
};

export default CodeVisualizerLayout;
