import { create } from "zustand";
import type { ExecutionStep, VariableSnapshot, StackFrame, HeapState } from "../types/visualizer";
import { computeTrace } from "../engine/traceRunner";
import { mapHeapToReactFlow } from "../engine/heapMapper";

const VIS_KEY = "c-struct-vis-ws-";

const C_SAMPLE_CODE = `#include <stdio.h>
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

const CPP_SAMPLE_CODE = `#include <stdio.h>

class Node {
public:
    int data;
    Node* next;

    Node(int d) : data(d), next(nullptr) {}
};

int main() {
    Node* head = new Node(10);
    head->next = new Node(20);
    head->next->next = new Node(30);

    Node* curr = head;
    while (curr != nullptr) {
        printf("%d ", curr->data);
        curr = curr->next;
    }
    printf("\\n");

    // Cleanup
    while (head != nullptr) {
        Node* temp = head;
        head = head->next;
        delete temp;
    }
    return 0;
}
`;

export const SAMPLE_CODES = {
  c: C_SAMPLE_CODE,
  cpp: CPP_SAMPLE_CODE,
} as const;

const SAMPLE_CODE = C_SAMPLE_CODE;

interface VisualizerState {
  code: string;
  trace: ExecutionStep[] | null;
  traceError: string | null;
  currentStepIndex: number;
  isTracing: boolean;
  selectedLines: number[];

  // Derived from trace[currentStepIndex]
  consoleOutput: string;
  variables: VariableSnapshot[];
  callStack: StackFrame[];
  heapState: HeapState | null;

  // Actions
  setCode: (code: string) => void;
  toggleSelectedLine: (line: number) => void;
  clearSelectedLines: () => void;
  loadSample: (lang: "c" | "cpp") => void;
  runTrace: () => void;
  stopExecution: () => void;
  goToStep: (index: number) => void;
  goFirst: () => void;
  goPrev: () => void;
  goNext: () => void;
  goLast: () => void;

  // Hover state for stack→heap arrows
  hoveredPointerId: string | null;
  setHoveredPointerId: (id: string | null) => void;

  // Selected frame for highlighting pointers from specific function
  selectedFrameIndex: number | null;
  setSelectedFrame: (index: number | null) => void;
  clearSelectedFrame: () => void;

  // Persistence
  saveSnapshot: (workspaceId: string) => void;
  loadSnapshot: (workspaceId: string, language?: "c" | "cpp") => void;
  clearState: (language?: "c" | "cpp") => void;
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

  const heapState = mapHeapToReactFlow(step.heapObjects, step.stackVariables, step.callStack);

  return {
    consoleOutput: step.consoleOutput,
    variables: step.stackVariables,
    callStack: step.callStack,
    heapState,
  };
}

export const useVisualizerStore = create<VisualizerState>()((set, get) => ({
  code: SAMPLE_CODE,
  trace: null,
  traceError: null,
  currentStepIndex: 0,
  isTracing: false,
  selectedLines: [],

  consoleOutput: "",
  variables: [],
  callStack: [],
  heapState: null,
  hoveredPointerId: null,
  selectedFrameIndex: null,

  setCode: (code: string) => set({ code }),
  setHoveredPointerId: (id: string | null) => set({ hoveredPointerId: id }),
  setSelectedFrame: (index: number | null) => set({ selectedFrameIndex: index }),
  clearSelectedFrame: () => set({ selectedFrameIndex: null }),
  toggleSelectedLine: (line: number) =>
    set((s) => ({
      selectedLines: s.selectedLines.includes(line)
        ? s.selectedLines.filter((l) => l !== line)
        : [...s.selectedLines, line],
    })),
  clearSelectedLines: () => set({ selectedLines: [] }),
  loadSample: (lang: "c" | "cpp") => set({
    code: SAMPLE_CODES[lang],
    trace: null,
    traceError: null,
    currentStepIndex: 0,
    ...deriveFromStep(null),
  }),

  runTrace: () => {
    const { code } = get();
    set({ isTracing: true, traceError: null });

    computeTrace(code, "").then((result) => {
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
      selectedLines: [],
      ...deriveFromStep(null),
    });
  },

  goToStep: (index: number) => {
    const { trace } = get();
    if (!trace || trace.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, trace.length - 1));
    set({
      currentStepIndex: clampedIndex,
      selectedFrameIndex: null,
      ...deriveFromStep(trace[clampedIndex]),
    });
  },

  goFirst: () => {
    const { trace, selectedLines } = get();
    if (!trace || trace.length === 0) return;
    if (selectedLines.length > 0) {
      const idx = trace.findIndex((s) => selectedLines.includes(s.line));
      if (idx !== -1) {
        set({ currentStepIndex: idx, selectedFrameIndex: null, ...deriveFromStep(trace[idx]) });
        return;
      }
    }
    set({ currentStepIndex: 0, selectedFrameIndex: null, ...deriveFromStep(trace[0]) });
  },

  goPrev: () => {
    const { trace, currentStepIndex, selectedLines } = get();
    if (!trace || currentStepIndex <= 0) return;
    if (selectedLines.length > 0) {
      for (let i = currentStepIndex - 1; i >= 0; i--) {
        if (selectedLines.includes(trace[i].line)) {
          set({ currentStepIndex: i, selectedFrameIndex: null, ...deriveFromStep(trace[i]) });
          return;
        }
      }
    }
    const newIndex = currentStepIndex - 1;
    set({ currentStepIndex: newIndex, selectedFrameIndex: null, ...deriveFromStep(trace[newIndex]) });
  },

  goNext: () => {
    const { trace, currentStepIndex, selectedLines } = get();
    if (!trace || currentStepIndex >= trace.length - 1) return;
    if (selectedLines.length > 0) {
      for (let i = currentStepIndex + 1; i < trace.length; i++) {
        if (selectedLines.includes(trace[i].line)) {
          set({ currentStepIndex: i, selectedFrameIndex: null, ...deriveFromStep(trace[i]) });
          return;
        }
      }
    }
    const newIndex = currentStepIndex + 1;
    set({ currentStepIndex: newIndex, selectedFrameIndex: null, ...deriveFromStep(trace[newIndex]) });
  },

  goLast: () => {
    const { trace, selectedLines } = get();
    if (!trace || trace.length === 0) return;
    if (selectedLines.length > 0) {
      for (let i = trace.length - 1; i >= 0; i--) {
        if (selectedLines.includes(trace[i].line)) {
          set({ currentStepIndex: i, selectedFrameIndex: null, ...deriveFromStep(trace[i]) });
          return;
        }
      }
    }
    const lastIndex = trace.length - 1;
    set({ currentStepIndex: lastIndex, selectedFrameIndex: null, ...deriveFromStep(trace[lastIndex]) });
  },

  saveSnapshot: (workspaceId: string) => {
    const { code, currentStepIndex } = get();
    try {
      localStorage.setItem(
        VIS_KEY + workspaceId,
        JSON.stringify({ code, currentStepIndex }),
      );
    } catch {
      console.warn("Failed to save visualizer snapshot");
    }
  },

  loadSnapshot: (workspaceId: string, language?: "c" | "cpp") => {
    const defaultCode = SAMPLE_CODES[language || "c"];
    try {
      const raw = localStorage.getItem(VIS_KEY + workspaceId);
      if (!raw) {
        set({
          code: defaultCode,
          trace: null,
          traceError: null,
          currentStepIndex: 0,
          ...deriveFromStep(null),
        });
        return;
      }
      const data = JSON.parse(raw);
      set({
        code: data.code || defaultCode,
        trace: null,
        traceError: null,
        currentStepIndex: 0,
        ...deriveFromStep(null),
      });
    } catch {
      set({
        code: defaultCode,
        trace: null,
        traceError: null,
        currentStepIndex: 0,
        ...deriveFromStep(null),
      });
    }
  },

  clearState: (language?: "c" | "cpp") => {
    set({
      code: SAMPLE_CODES[language || "c"],
      trace: null,
      traceError: null,
      currentStepIndex: 0,
      isTracing: false,
      ...deriveFromStep(null),
    });
  },
}));
