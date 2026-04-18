import { useState, useEffect, useCallback, useRef, type RefObject } from "react";
import { useVisualizerStore } from "../../store/visualizerStore";

interface ArrowLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  isActive: boolean;
  varName: string;
  isBehindStack: boolean;
  frameIdx: number;
}

const INACTIVE_OPACITY = 0.4;
const INACTIVE_COLOR = "#9CA3AF"; // gray-400
const TRANSITION_DURATION = "0.2s";

/**
 * SVG overlay that draws bezier curves from stack pointer dots to heap nodes.
 * Uses getBoundingClientRect() — no coordinate conversion, no anchor nodes.
 */
const StackHeapArrows = ({
  containerRef,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
}) => {
  const heapState = useVisualizerStore((s) => s.heapState);
  const callStack = useVisualizerStore((s) => s.callStack);
  const hoveredPointerId = useVisualizerStore((s) => s.hoveredPointerId);
  const selectedFrameIndex = useVisualizerStore((s) => s.selectedFrameIndex);
  const currentStepIndex = useVisualizerStore((s) => s.currentStepIndex);
  const [lines, setLines] = useState<ArrowLine[]>([]);
  const [stackRightEdge, setStackRightEdge] = useState(250);
  const stackRightEdgeRef = useRef(250);
  const prevStepIndexRef = useRef(currentStepIndex);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const newLines: ArrowLine[] = [];

    // Get stack panel right edge boundary - find first child div (stack panel)
    const stackPanel = container.firstElementChild as HTMLElement | null;
    const stackEdge = stackPanel
      ? stackPanel.getBoundingClientRect().right - rect.left
      : 250;
    stackRightEdgeRef.current = stackEdge;
    setStackRightEdge(stackEdge);

    container.querySelectorAll("[data-pointer-dot]").forEach((dot) => {
      const addr = dot.getAttribute("data-target-address");
      if (!addr) return;

      // Find heap node in ReactFlow DOM
      const heapNode = container.querySelector(
        `.react-flow__node[data-id="heap-${addr}"]`
      );
      if (!heapNode) return;

      const dotRect = dot.getBoundingClientRect();
      const heapRect = heapNode.getBoundingClientRect();

      const varName = dot.getAttribute("data-var-name") || "ptr";
      const color = dot.getAttribute("data-color") || "#888";
      const isActive = dot.getAttribute("data-is-active") === "true";
      const frameIdxStr = dot.getAttribute("data-frame-index");
      const frameIdx = frameIdxStr ? parseInt(frameIdxStr, 10) : -1;

      const x2 = heapRect.left - rect.left;
      // Arrow is behind stack if heap node goes past stack panel edge
      const isBehindStack = x2 < stackRightEdgeRef.current + 20; // +20px buffer

      newLines.push({
        key: `${addr}-${varName}-${dotRect.top.toFixed(0)}`,
        x1: dotRect.right - rect.left,
        y1: dotRect.top + dotRect.height / 2 - rect.top,
        x2,
        y2: heapRect.top + heapRect.height / 2 - rect.top,
        color,
        isActive,
        varName,
        isBehindStack,
        frameIdx,
      });
    });

    setLines(newLines);
  }, [containerRef]);

  // Clear arrows immediately when step changes to prevent stale arrows
  useEffect(() => {
    if (currentStepIndex !== prevStepIndexRef.current) {
      // Clear lines when step changes - defer to avoid setState in effect
      queueMicrotask(() => {
        setLines([]);
        prevStepIndexRef.current = currentStepIndex;
      });
    }
  }, [currentStepIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number | null = null;

    const schedule = () => {
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
          measure();
        });
      }
    };

    // Initial measurement (delayed to let ReactFlow render)
    const initialTimer = setTimeout(schedule, 80);

    // Watch ReactFlow viewport for pan/zoom
    const viewport = container.querySelector(".react-flow__viewport");
    const mo = new MutationObserver(schedule);
    if (viewport) {
      mo.observe(viewport, { attributes: true, attributeFilter: ["style", "transform"] });
    }
    // Watch for child changes (nodes appearing/disappearing)
    mo.observe(container, { childList: true, subtree: true });

    // Scroll in stack panel
    const scrollEl = container.querySelector(".overflow-auto");
    if (scrollEl) {
      scrollEl.addEventListener("scroll", schedule, { passive: true });
    }

    window.addEventListener("resize", schedule);

    // Force measurement after a short delay to ensure DOM is updated
    const forceMeasureTimer = setTimeout(() => {
      measure();
    }, 150);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(forceMeasureTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
      mo.disconnect();
      if (scrollEl) scrollEl.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef, heapState, callStack, hoveredPointerId, selectedFrameIndex, currentStepIndex, measure]);

  if (lines.length === 0) return null;

  // Collect hidden arrow Y positions for "..." indicators
  const hiddenArrowYs = lines
    .filter((line) => line.isBehindStack)
    .map((line) => line.y1);

  // Get current stack right edge for rendering - use state value
  const currentStackRightEdge = stackRightEdge;

  return (
    <svg
      className="pointer-events-none"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 50,
        overflow: "visible",
      }}
    >
      <defs>
        {lines.map((line) => {
          const isFromSelectedFrame = selectedFrameIndex === null || line.frameIdx === selectedFrameIndex;
          const isFrameSelected = selectedFrameIndex !== null;
          
          // Determine marker styling
          let arrowOpacity: number;
          
          if (isFrameSelected) {
            // A specific frame is selected
            if (isFromSelectedFrame) {
              // This arrow is from the selected frame - show marker
              arrowOpacity = line.isActive ? 1 : 0.9;
            } else {
              // This arrow is from a different frame - hide marker
              arrowOpacity = 0;
            }
          } else {
            // No frame selected - normal behavior
            arrowOpacity = line.isBehindStack
              ? INACTIVE_OPACITY
              : (line.isActive ? 1 : INACTIVE_OPACITY);
          }
          
          const arrowColor = line.isBehindStack ? INACTIVE_COLOR : line.color;

          return (
            <marker
              key={`marker-${line.key}`}
              id={`arrowhead-${line.key}`}
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon
                points="0 0, 8 3, 0 6"
                fill={arrowColor}
                opacity={arrowOpacity}
                style={{
                  transition: `opacity ${TRANSITION_DURATION} ease, fill ${TRANSITION_DURATION} ease`,
                }}
              />
            </marker>
          );
        })}
      </defs>

      {/* "..." indicators for hidden arrows */}
      {hiddenArrowYs.map((y, idx) => (
        <text
          key={`ellipsis-${idx}`}
          x={currentStackRightEdge - 15}
          y={y + 3}
          fill={INACTIVE_COLOR}
          fontSize="10"
          fontFamily="monospace"
          opacity={selectedFrameIndex !== null ? 0.1 : INACTIVE_OPACITY}
          style={{
            transition: `opacity ${TRANSITION_DURATION} ease`,
          }}
        >
          ...
        </text>
      ))}

      {lines.map((line) => {
        const dx = line.x2 - line.x1;
        const cpOffset = Math.max(Math.abs(dx) * 0.4, 40);
        const cp1x = line.x1 + cpOffset;
        const cp1y = line.y1;
        const cp2x = line.x2 - cpOffset;
        const cp2y = line.y2;

        const isHovered = hoveredPointerId === `heap-${line.key.split("-")[0]}`;
        
        // Check if this line should be highlighted or dimmed
        const isFromSelectedFrame = selectedFrameIndex === null || line.frameIdx === selectedFrameIndex;
        const isFrameSelected = selectedFrameIndex !== null;
        
        // Determine styling based on selection state
        let baseStrokeWidth: number;
        let opacity: number;
        let strokeDasharray: string | undefined;
        
        if (isFrameSelected) {
          // A specific frame is selected
          if (isFromSelectedFrame) {
            // This arrow is from the selected frame - HIGHLIGHT IT
            baseStrokeWidth = line.isActive ? 4 : 3;
            opacity = isHovered ? 1 : 0.95;
            strokeDasharray = line.isActive ? undefined : "5,5";
          } else {
            // This arrow is from a different frame - DIM IT
            baseStrokeWidth = 0.5;
            opacity = 0.08; // Almost invisible
            strokeDasharray = "2,6";
          }
        } else {
          // No frame selected - normal behavior
          baseStrokeWidth = line.isActive ? 2.5 : 1.5;
          opacity = line.isBehindStack
            ? INACTIVE_OPACITY
            : (isHovered ? 1 : (line.isActive ? 1 : INACTIVE_OPACITY));
          strokeDasharray = line.isActive ? undefined : "5,5";
        }
        
        const strokeWidth = isHovered ? baseStrokeWidth + 0.5 : baseStrokeWidth;
        
        // Color: if frame is selected and this is from selected frame, use bright color
        // Otherwise use normal color logic
        const strokeColor = line.isBehindStack 
          ? INACTIVE_COLOR 
          : (isFrameSelected && isFromSelectedFrame ? line.color : line.color);

        return (
          <path
            key={line.key}
            d={`M ${line.x1},${line.y1} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${line.x2},${line.y2}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            strokeDasharray={strokeDasharray}
            markerEnd={isFrameSelected && !isFromSelectedFrame ? undefined : `url(#arrowhead-${line.key})`}
            style={{
              filter: isHovered && isFromSelectedFrame
                ? "drop-shadow(0 0 6px rgba(0,0,0,0.5))"
                : (isFrameSelected && isFromSelectedFrame ? "drop-shadow(0 0 3px rgba(0,0,0,0.3))" : undefined),
              transition: `opacity ${TRANSITION_DURATION} ease, stroke ${TRANSITION_DURATION} ease, stroke-width ${TRANSITION_DURATION} ease, filter ${TRANSITION_DURATION} ease`,
            }}
          />
        );
      })}
    </svg>
  );
};

export default StackHeapArrows;
