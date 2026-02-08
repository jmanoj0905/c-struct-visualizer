import { useCallback, useMemo, useRef } from "react";
import { useVisualizerStore } from "../../store/visualizerStore";
import { UI_COLORS } from "../../utils/colors";

const MAX_INDIVIDUAL_SEGMENTS = 200;

const ExecutionTimeline = () => {
  const { trace, currentStepIndex, goToStep, selectedLine } = useVisualizerStore();
  const barRef = useRef<HTMLDivElement>(null);

  // For large traces, fall back to click-position math on a gradient bar
  const usesSegments = (trace?.length ?? 0) <= MAX_INDIVIDUAL_SEGMENTS;

  const handleBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!trace || trace.length === 0 || !barRef.current) return;
      const rect = barRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const index = Math.floor((x / rect.width) * trace.length);
      goToStep(Math.max(0, Math.min(index, trace.length - 1)));
    },
    [trace, goToStep],
  );

  // Build gradient background for large traces
  const gradientBg = useMemo(() => {
    if (!trace || usesSegments) return "";
    const totalSteps = trace.length;
    const stops: string[] = [];
    for (let i = 0; i < totalSteps; i++) {
      const pctStart = (i / totalSteps) * 100;
      const pctEnd = ((i + 1) / totalSteps) * 100;
      const isCurrent = i === currentStepIndex;
      const isHighlighted = selectedLine != null && trace[i].line === selectedLine;
      let color: string;
      if (isCurrent) color = "#4CAF50";
      else if (isHighlighted) color = UI_COLORS.blue;
      else color = "#e5e7eb"; // gray-200
      stops.push(`${color} ${pctStart}%`, `${color} ${pctEnd}%`);
    }
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [trace, currentStepIndex, selectedLine, usesSegments]);

  if (!trace || trace.length === 0) return null;

  const totalSteps = trace.length;

  // Segment-based rendering for reasonable trace sizes
  if (usesSegments) {
    return (
      <div className="border-t-2 border-black px-2 py-1.5" style={{ backgroundColor: "#fafafa" }}>
        <div
          className="flex w-full rounded-sm overflow-hidden"
          style={{ height: 16, border: "1px solid #000" }}
        >
          {trace.map((step, i) => {
            const isCurrent = i === currentStepIndex;
            const isHighlighted = selectedLine != null && step.line === selectedLine;
            let bg: string;
            if (isCurrent) bg = "#4CAF50";
            else if (isHighlighted) bg = UI_COLORS.blue;
            else bg = "#e5e7eb";
            return (
              <div
                key={i}
                onClick={() => goToStep(i)}
                className="cursor-pointer transition-colors duration-75"
                style={{
                  flex: 1,
                  backgroundColor: bg,
                  height: isCurrent ? 16 : 12,
                  alignSelf: "center",
                }}
                title={`Step ${i + 1} — line ${step.line}`}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Gradient fallback for large traces
  const currentPct = (currentStepIndex / totalSteps) * 100;
  const currentWidth = Math.max(100 / totalSteps, 1.5);

  return (
    <div className="border-t-2 border-black px-2 py-1.5" style={{ backgroundColor: "#fafafa" }}>
      <div
        ref={barRef}
        onClick={handleBarClick}
        className="relative w-full rounded-sm cursor-pointer"
        style={{
          height: 14,
          background: gradientBg,
          border: "1px solid #000",
        }}
        title={`Step ${currentStepIndex + 1} / ${totalSteps} — Click to jump`}
      >
        <div
          className="absolute top-0 rounded-sm"
          style={{
            left: `${currentPct}%`,
            width: `${currentWidth}%`,
            height: "100%",
            backgroundColor: "#4CAF50",
            border: "1px solid #2E7D32",
            transition: "left 0.1s ease-out",
          }}
        />
      </div>
    </div>
  );
};

export default ExecutionTimeline;
