import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { useVisualizerStore } from "../../store/visualizerStore";
import { UI_COLORS } from "../../utils/colors";

const ExecutionToolbar = () => {
  const { trace, currentStepIndex, goFirst, goPrev, goNext, goLast } =
    useVisualizerStore();

  const totalSteps = trace?.length ?? 0;
  const hasTrace = totalSteps > 0;
  const atFirst = currentStepIndex <= 0;
  const atLast = currentStepIndex >= totalSteps - 1;

  if (!hasTrace) return null;

  const btnClass = (disabled: boolean) =>
    `p-1.5 border-2 border-black rounded-base transition-all ${
      disabled
        ? "opacity-40 cursor-not-allowed bg-gray-100"
        : "cursor-pointer hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none shadow-shadow"
    }`;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white border-2 border-black rounded-base shadow-shadow px-3 py-2">
      <button
        onClick={goFirst}
        disabled={atFirst}
        className={btnClass(atFirst)}
        style={{ backgroundColor: atFirst ? undefined : UI_COLORS.cyan }}
        title="First step"
      >
        <ChevronsLeft size={16} />
      </button>
      <button
        onClick={goPrev}
        disabled={atFirst}
        className={btnClass(atFirst)}
        style={{ backgroundColor: atFirst ? undefined : UI_COLORS.blue }}
        title="Previous step"
      >
        <ChevronLeft size={16} />
      </button>

      <span className="font-heading text-xs px-2 whitespace-nowrap">
        Step {currentStepIndex + 1} / {totalSteps}
      </span>

      <button
        onClick={goNext}
        disabled={atLast}
        className={btnClass(atLast)}
        style={{ backgroundColor: atLast ? undefined : UI_COLORS.blue }}
        title="Next step"
      >
        <ChevronRight size={16} />
      </button>
      <button
        onClick={goLast}
        disabled={atLast}
        className={btnClass(atLast)}
        style={{ backgroundColor: atLast ? undefined : UI_COLORS.cyan }}
        title="Last step"
      >
        <ChevronsRight size={16} />
      </button>
    </div>
  );
};

export default ExecutionToolbar;
