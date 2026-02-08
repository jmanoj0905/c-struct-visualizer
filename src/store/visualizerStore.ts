import { create } from "zustand";
import type { ExecutionStep, VariableSnapshot, StackFrame, HeapState } from "../types/visualizer";
import { computeTrace } from "../engine/traceRunner";
import { mapHeapToReactFlow } from "../engine/heapMapper";

const VIS_KEY = "c-struct-vis-ws-";

const SAMPLE_CODE = `#include <stdio.h>
#include <stdlib.h>

struct Node {
    int data;
    struct Node* next;
};

int main() {
    struct Node* head = (struct Node*)malloc(sizeof(struct Node));
    head->data = 10;
    head->next = (struct Node*)malloc(sizeof(struct Node));
    head->next->data = 20;
    head->next->next = NULL;

    struct Node* curr = head;
    while (curr != NULL) {
        printf("%d ", curr->data);
        curr = curr->next;
    }
    printf("\\n");
    return 0;
}
`;

interface VisualizerState {
  code: string;
  stdinInput: string;
  trace: ExecutionStep[] | null;
  traceError: string | null;
  currentStepIndex: number;
  isTracing: boolean;
  selectedLine: number | null;

  // Derived from trace[currentStepIndex]
  consoleOutput: string;
  variables: VariableSnapshot[];
  callStack: StackFrame[];
  heapState: HeapState | null;

  // Actions
  setCode: (code: string) => void;
  setStdinInput: (input: string) => void;
  setSelectedLine: (line: number | null) => void;
  runTrace: () => void;
  stopExecution: () => void;
  goToStep: (index: number) => void;
  goFirst: () => void;
  goPrev: () => void;
  goNext: () => void;
  goLast: () => void;

  // Persistence
  saveSnapshot: (workspaceId: string) => void;
  loadSnapshot: (workspaceId: string) => void;
  clearState: () => void;
}

function deriveFromStep(step: ExecutionStep | null) {
  if (!step) {
    return {
      consoleOutput: "",
      variables: [],
      callStack: [],
      heapState: null,
    };
  }

  const heapState = mapHeapToReactFlow(step.heapObjects, step.stackVariables);

  return {
    consoleOutput: step.consoleOutput,
    variables: step.stackVariables,
    callStack: step.callStack,
    heapState,
  };
}

export const useVisualizerStore = create<VisualizerState>()((set, get) => ({
  code: SAMPLE_CODE,
  stdinInput: "",
  trace: null,
  traceError: null,
  currentStepIndex: 0,
  isTracing: false,
  selectedLine: null,

  consoleOutput: "",
  variables: [],
  callStack: [],
  heapState: null,

  setCode: (code: string) => set({ code }),
  setStdinInput: (input: string) => set({ stdinInput: input }),
  setSelectedLine: (line: number | null) => set({ selectedLine: line }),

  runTrace: () => {
    const { code, stdinInput } = get();
    set({ isTracing: true, traceError: null });

    computeTrace(code, stdinInput).then((result) => {
      if (result.error && result.steps.length === 0) {
        set({
          trace: null,
          traceError: result.error,
          currentStepIndex: 0,
          isTracing: false,
          ...deriveFromStep(null),
        });
        return;
      }

      const firstStep = result.steps.length > 0 ? result.steps[0] : null;
      set({
        trace: result.steps,
        traceError: result.error,
        currentStepIndex: 0,
        isTracing: false,
        ...deriveFromStep(firstStep),
      });
    }).catch((err) => {
      set({
        trace: null,
        traceError: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        currentStepIndex: 0,
        isTracing: false,
        ...deriveFromStep(null),
      });
    });
  },

  stopExecution: () => {
    set({
      trace: null,
      traceError: null,
      currentStepIndex: 0,
      isTracing: false,
      selectedLine: null,
      ...deriveFromStep(null),
    });
  },

  goToStep: (index: number) => {
    const { trace } = get();
    if (!trace || trace.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, trace.length - 1));
    set({
      currentStepIndex: clampedIndex,
      ...deriveFromStep(trace[clampedIndex]),
    });
  },

  goFirst: () => {
    const { trace, selectedLine } = get();
    if (!trace || trace.length === 0) return;
    if (selectedLine != null) {
      const idx = trace.findIndex((s) => s.line === selectedLine);
      if (idx !== -1) {
        set({ currentStepIndex: idx, ...deriveFromStep(trace[idx]) });
        return;
      }
    }
    set({ currentStepIndex: 0, ...deriveFromStep(trace[0]) });
  },

  goPrev: () => {
    const { trace, currentStepIndex, selectedLine } = get();
    if (!trace || currentStepIndex <= 0) return;
    if (selectedLine != null) {
      // Find the previous step that matches the selected line
      for (let i = currentStepIndex - 1; i >= 0; i--) {
        if (trace[i].line === selectedLine) {
          set({ currentStepIndex: i, ...deriveFromStep(trace[i]) });
          return;
        }
      }
      // No previous highlighted step — fall through to normal prev
    }
    const newIndex = currentStepIndex - 1;
    set({ currentStepIndex: newIndex, ...deriveFromStep(trace[newIndex]) });
  },

  goNext: () => {
    const { trace, currentStepIndex, selectedLine } = get();
    if (!trace || currentStepIndex >= trace.length - 1) return;
    if (selectedLine != null) {
      // Find the next step that matches the selected line
      for (let i = currentStepIndex + 1; i < trace.length; i++) {
        if (trace[i].line === selectedLine) {
          set({ currentStepIndex: i, ...deriveFromStep(trace[i]) });
          return;
        }
      }
      // No next highlighted step — fall through to normal next
    }
    const newIndex = currentStepIndex + 1;
    set({ currentStepIndex: newIndex, ...deriveFromStep(trace[newIndex]) });
  },

  goLast: () => {
    const { trace, selectedLine } = get();
    if (!trace || trace.length === 0) return;
    if (selectedLine != null) {
      for (let i = trace.length - 1; i >= 0; i--) {
        if (trace[i].line === selectedLine) {
          set({ currentStepIndex: i, ...deriveFromStep(trace[i]) });
          return;
        }
      }
    }
    const lastIndex = trace.length - 1;
    set({ currentStepIndex: lastIndex, ...deriveFromStep(trace[lastIndex]) });
  },

  saveSnapshot: (workspaceId: string) => {
    const { code, stdinInput, currentStepIndex } = get();
    try {
      localStorage.setItem(
        VIS_KEY + workspaceId,
        JSON.stringify({ code, stdinInput, currentStepIndex }),
      );
    } catch {
      console.warn("Failed to save visualizer snapshot");
    }
  },

  loadSnapshot: (workspaceId: string) => {
    try {
      const raw = localStorage.getItem(VIS_KEY + workspaceId);
      if (!raw) {
        set({
          code: SAMPLE_CODE,
          stdinInput: "",
          trace: null,
          traceError: null,
          currentStepIndex: 0,
          ...deriveFromStep(null),
        });
        return;
      }
      const data = JSON.parse(raw);
      set({
        code: data.code || SAMPLE_CODE,
        stdinInput: data.stdinInput || "",
        trace: null,
        traceError: null,
        currentStepIndex: 0,
        ...deriveFromStep(null),
      });
    } catch {
      set({
        code: SAMPLE_CODE,
        stdinInput: "",
        trace: null,
        traceError: null,
        currentStepIndex: 0,
        ...deriveFromStep(null),
      });
    }
  },

  clearState: () => {
    set({
      code: SAMPLE_CODE,
      stdinInput: "",
      trace: null,
      traceError: null,
      currentStepIndex: 0,
      isTracing: false,
      ...deriveFromStep(null),
    });
  },
}));
