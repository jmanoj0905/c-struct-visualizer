import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CStruct, StructInstance, PointerConnection, PointerVariable, PointerInstance, WorkspaceTab, WorkspaceMode, WorkspaceLanguage } from "../types";
import { canConnectPointer, resolveTypeName } from "../parser/structParser";

export interface HistoryState {
  structDefinitions: CStruct[];
  instances: StructInstance[];
  connections: PointerConnection[];
  pointerDefinitions?: PointerVariable[];
  pointerInstances?: PointerInstance[];
}

interface CanvasState {
  // Struct definitions
  structDefinitions: CStruct[];
  addStructDefinition: (struct: CStruct) => void;
  updateStructDefinition: (oldName: string, newStruct: CStruct) => void;
  deleteStructDefinition: (structName: string) => void;

  // Instances on canvas
  instances: StructInstance[];
  addInstance: (
    struct: CStruct,
    position: { x: number; y: number },
    customName?: string,
  ) => void;
  updateInstancePosition: (
    id: string,
    position: { x: number; y: number },
  ) => void;
  updateInstanceName: (id: string, name: string) => void;
  updateFieldValue: (
    instanceId: string,
    fieldName: string,
    value: unknown,
  ) => void;
  removeInstance: (id: string) => void;
  removeInstances: (ids: string[]) => void;

  // Pointer connections
  connections: PointerConnection[];
  addConnection: (connection: Omit<PointerConnection, "id">) => void;
  removeConnection: (id: string) => void;

  // Standalone pointer definitions & instances
  pointerDefinitions: PointerVariable[];
  pointerInstances: PointerInstance[];
  addPointerDefinition: (pointer: PointerVariable) => void;
  updatePointerDefinition: (id: string, updates: Partial<Pick<PointerVariable, "name" | "type" | "pointerLevel" | "rawDeclaration">>) => void;
  removePointerDefinition: (id: string) => void;
  addPointerInstance: (instance: PointerInstance) => void;
  updatePointerInstancePosition: (id: string, position: { x: number; y: number }) => void;
  updatePointerInstanceTarget: (id: string, targetInstanceId: string | null, targetFieldName?: string | null) => void;
  removePointerInstance: (id: string) => void;
  removePointerInstances: (ids: string[]) => void;

  // UI state
  selectedInstanceId: string | null;
  setSelectedInstance: (id: string | null) => void;

  // History (undo/redo)
  history: HistoryState[];
  historyIndex: number;
  undo: () => void;
  redo: () => void;
  saveHistory: () => void;

  // Persistence
  clearAll: () => void;
  exportWorkspace: () => string;
  importWorkspace: (data: string) => void;

  // Workspace tabs
  workspaceTabs: WorkspaceTab[];
  activeWorkspaceId: string;
  addWorkspace: (mode?: WorkspaceMode, language?: WorkspaceLanguage) => void;
  removeWorkspace: (id: string) => void;
  renameWorkspace: (id: string, name: string) => void;
  switchWorkspace: (id: string) => void;
  duplicateWorkspace: (id: string) => void;
  reorderWorkspaces: (fromIndex: number, toIndex: number) => void;
  closeOtherWorkspaces: (id: string) => void;
  closeRightWorkspaces: (id: string) => void;
}

let instanceCounter = 0;

const MAX_HISTORY_SIZE = 50;

// --- localStorage helpers for workspace snapshots ---
const WS_KEY = "c-struct-workspace-";

interface WorkspaceSnapshot {
  structDefinitions: CStruct[];
  instances: StructInstance[];
  connections: PointerConnection[];
  pointerDefinitions: PointerVariable[];
  pointerInstances: PointerInstance[];
  history: HistoryState[];
  historyIndex: number;
}

function saveSnapshot(id: string, state: CanvasState) {
  try {
    localStorage.setItem(
      WS_KEY + id,
      JSON.stringify({
        structDefinitions: state.structDefinitions,
        instances: state.instances,
        connections: state.connections,
        pointerDefinitions: state.pointerDefinitions,
        pointerInstances: state.pointerInstances,
        history: state.history,
        historyIndex: state.historyIndex,
      }),
    );
  } catch {
    console.warn("localStorage quota exceeded when saving workspace snapshot");
  }
}

function loadSnapshot(id: string): WorkspaceSnapshot | null {
  try {
    const raw = localStorage.getItem(WS_KEY + id);
    if (!raw) return null;
    return JSON.parse(raw) as WorkspaceSnapshot;
  } catch {
    return null;
  }
}

function deleteSnapshot(id: string) {
  localStorage.removeItem(WS_KEY + id);
}

function emptySnapshot(): Omit<WorkspaceSnapshot, "history" | "historyIndex"> & { history: HistoryState[]; historyIndex: number } {
  return {
    structDefinitions: [],
    instances: [],
    connections: [],
    pointerDefinitions: [],
    pointerInstances: [],
    history: [],
    historyIndex: -1,
  };
}

export const useCanvasStore = create<CanvasState>()(
  persist<CanvasState>(
    (set, get) => ({
      structDefinitions: [],
      history: [],
      historyIndex: -1,

      // Workspace tabs - defaults
      workspaceTabs: [{ id: "ws-default", name: "C Workspace 1", createdAt: Date.now(), mode: "free" as WorkspaceMode, language: "c" as WorkspaceLanguage }],
      activeWorkspaceId: "ws-default",

      saveHistory: () => {
        const state = get();
        const newHistoryState: HistoryState = {
          structDefinitions: JSON.parse(
            JSON.stringify(state.structDefinitions),
          ),
          instances: JSON.parse(JSON.stringify(state.instances)),
          connections: JSON.parse(JSON.stringify(state.connections)),
          pointerDefinitions: JSON.parse(
            JSON.stringify(state.pointerDefinitions),
          ),
          pointerInstances: JSON.parse(
            JSON.stringify(state.pointerInstances),
          ),
        };

        // Remove any redo history after current index
        const newHistory = state.history.slice(0, state.historyIndex + 1);
        newHistory.push(newHistoryState);

        // Limit history size
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift();
          set({
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });
        } else {
          set({
            history: newHistory,
            historyIndex: newHistory.length - 1,
          });
        }
      },

      undo: () => {
        const state = get();
        if (state.historyIndex > 0) {
          const newIndex = state.historyIndex - 1;
          const historyState = state.history[newIndex];
          set({
            structDefinitions: JSON.parse(
              JSON.stringify(historyState.structDefinitions),
            ),
            instances: JSON.parse(JSON.stringify(historyState.instances)),
            connections: JSON.parse(JSON.stringify(historyState.connections)),
            pointerDefinitions: JSON.parse(
              JSON.stringify(historyState.pointerDefinitions || []),
            ),
            pointerInstances: JSON.parse(
              JSON.stringify(historyState.pointerInstances || []),
            ),
            historyIndex: newIndex,
          });
        }
      },

      redo: () => {
        const state = get();
        if (state.historyIndex < state.history.length - 1) {
          const newIndex = state.historyIndex + 1;
          const historyState = state.history[newIndex];
          set({
            structDefinitions: JSON.parse(
              JSON.stringify(historyState.structDefinitions),
            ),
            instances: JSON.parse(JSON.stringify(historyState.instances)),
            connections: JSON.parse(JSON.stringify(historyState.connections)),
            pointerDefinitions: JSON.parse(
              JSON.stringify(historyState.pointerDefinitions || []),
            ),
            pointerInstances: JSON.parse(
              JSON.stringify(historyState.pointerInstances || []),
            ),
            historyIndex: newIndex,
          });
        }
      },

      addStructDefinition: (struct) => {
        get().saveHistory();
        set((state) => ({
          structDefinitions: [...state.structDefinitions, struct],
        }));
      },

      updateStructDefinition: (oldName, newStruct) => {
        get().saveHistory();
        set((state) => {
          const updatedStructDefinitions = state.structDefinitions.map((s) =>
            s.name === oldName ? newStruct : s,
          );

          // Update all instances of this struct
          const updatedInstances = state.instances.map((inst) =>
            inst.structName === oldName
              ? { ...inst, structName: newStruct.name }
              : inst,
          );

          // Validate and remove invalid connections
          // A connection is invalid if:
          // 1. The source field no longer exists in the updated struct
          // 2. The source field is no longer a pointer
          // 3. The pointer type no longer matches the target struct
          const validConnections = state.connections.filter((conn) => {
            const sourceInstance = updatedInstances.find(
              (i) => i.id === conn.sourceInstanceId,
            );
            const targetInstance = updatedInstances.find(
              (i) => i.id === conn.targetInstanceId,
            );

            if (!sourceInstance || !targetInstance) return false;

            // Find the struct definition for the source instance
            const sourceStruct = updatedStructDefinitions.find(
              (s) => s.name === sourceInstance.structName,
            );

            if (!sourceStruct) return false;

            // Extract base field name (handle array notation like "next[0]")
            const baseFieldName = conn.sourceFieldName.split("[")[0];

            // Check if the field still exists in the updated struct
            const sourceField = sourceStruct.fields.find(
              (f) => f.name === baseFieldName,
            );

            // Connection is invalid if field doesn't exist or is no longer a pointer
            if (!sourceField || !sourceField.isPointer) return false;

            // Check if the pointer type still matches the target struct
            const resolvedPointerType = resolveTypeName(
              sourceField.type,
              updatedStructDefinitions,
            );
            const resolvedTargetType = resolveTypeName(
              targetInstance.structName,
              updatedStructDefinitions,
            );

            return canConnectPointer(resolvedPointerType, resolvedTargetType);
          });

          // Also invalidate field-targeted connections where the field was removed
          const validConnectionsWithFields = validConnections.map((conn) => {
            if (!conn.targetFieldName) return conn;
            const targetInstance = updatedInstances.find(
              (i) => i.id === conn.targetInstanceId,
            );
            if (!targetInstance) return conn;
            const targetStruct = updatedStructDefinitions.find(
              (s) => s.name === targetInstance.structName,
            );
            if (!targetStruct) return conn;
            const fieldExists = targetStruct.fields.some(
              (f) => f.name === conn.targetFieldName,
            );
            if (!fieldExists) return { ...conn, targetFieldName: null };
            return conn;
          });

          // Null out targetFieldName on pointer instances whose targeted field was removed
          const updatedPointerInstances = state.pointerInstances.map((pi) => {
            if (!pi.targetFieldName || !pi.targetInstanceId) return pi;
            const targetInstance = updatedInstances.find(
              (i) => i.id === pi.targetInstanceId,
            );
            if (!targetInstance) return pi;
            const targetStruct = updatedStructDefinitions.find(
              (s) => s.name === targetInstance.structName,
            );
            if (!targetStruct) return pi;
            const fieldExists = targetStruct.fields.some(
              (f) => f.name === pi.targetFieldName,
            );
            if (!fieldExists) return { ...pi, targetFieldName: null };
            return pi;
          });

          return {
            structDefinitions: updatedStructDefinitions,
            instances: updatedInstances,
            connections: validConnectionsWithFields,
            pointerInstances: updatedPointerInstances,
          };
        });
      },

      deleteStructDefinition: (structName) => {
        get().saveHistory();
        set((state) => ({
          structDefinitions: state.structDefinitions
            .filter((s) => s.name !== structName)
            // Clear baseClass reference from derived classes that inherit from the deleted class
            .map((s) =>
              s.baseClass === structName ? { ...s, baseClass: undefined } : s,
            ),
          // Remove all instances of this struct
          instances: state.instances.filter(
            (inst) => inst.structName !== structName,
          ),
          // Remove all connections involving instances of this struct
          connections: state.connections.filter((conn) => {
            const sourceInstance = state.instances.find(
              (i) => i.id === conn.sourceInstanceId,
            );
            const targetInstance = state.instances.find(
              (i) => i.id === conn.targetInstanceId,
            );
            return (
              sourceInstance?.structName !== structName &&
              targetInstance?.structName !== structName
            );
          }),
        }));
      },

      instances: [], // Always start with clean canvas

      addInstance: (struct, position, customName) => {
        get().saveHistory();
        set((state) => {
          const instanceName =
            customName || `${struct.name}_${++instanceCounter}`;
          
          // Calculate position 75px away from existing data structure if needed
          let finalPosition = { ...position };
          const existingInstances = state.instances;
          
          if (existingInstances.length > 0) {
            // Find the rightmost instance
            let maxX = -Infinity;
            let rightmostY = 0;
            
            existingInstances.forEach((inst) => {
              if (inst.position.x > maxX) {
                maxX = inst.position.x;
                rightmostY = inst.position.y;
              }
            });
            
            // If the requested position would overlap or is the default center position,
            // place it 75px to the right of the rightmost instance
            const DEFAULT_CENTER_X = 400;
            const NODE_WIDTH = 350;
            const MIN_DISTANCE = 75;
            
            // Check if position is the default center or would cause overlap
            const isDefaultPosition = Math.abs(position.x - DEFAULT_CENTER_X) < 10;
            const wouldOverlap = existingInstances.some((inst) => {
              const dx = Math.abs(position.x - inst.position.x);
              const dy = Math.abs(position.y - inst.position.y);
              return dx < NODE_WIDTH && dy < 100;
            });
            
            if (isDefaultPosition || wouldOverlap) {
              finalPosition = {
                x: maxX + NODE_WIDTH + MIN_DISTANCE,
                y: rightmostY,
              };
            }
          }
          
          const newInstance: StructInstance = {
            id: `instance-${Date.now()}-${Math.random()}`,
            structName: struct.name,
            instanceName,
            position: finalPosition,
            fieldValues: {},
          };
          return { instances: [...state.instances, newInstance] };
        });
      },

      updateInstancePosition: (id, position) => {
        // Don't save history during drag - will be saved on drag stop
        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === id ? { ...inst, position } : inst,
          ),
        }));
      },

      updateInstanceName: (id, name) => {
        get().saveHistory();
        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === id ? { ...inst, instanceName: name } : inst,
          ),
        }));
      },

      updateFieldValue: (instanceId, fieldName, value) => {
        get().saveHistory();
        set((state) => ({
          instances: state.instances.map((inst) =>
            inst.id === instanceId
              ? {
                  ...inst,
                  fieldValues: { ...inst.fieldValues, [fieldName]: value },
                }
              : inst,
          ),
        }));
      },

      removeInstance: (id) => {
        set((state) => {
          const newHistoryState: HistoryState = {
            structDefinitions: JSON.parse(
              JSON.stringify(state.structDefinitions),
            ),
            instances: JSON.parse(JSON.stringify(state.instances)),
            connections: JSON.parse(JSON.stringify(state.connections)),
            pointerDefinitions: JSON.parse(
              JSON.stringify(state.pointerDefinitions),
            ),
            pointerInstances: JSON.parse(
              JSON.stringify(state.pointerInstances),
            ),
          };
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push(newHistoryState);
          if (newHistory.length > MAX_HISTORY_SIZE) {
            newHistory.shift();
          }

          return {
            instances: state.instances.filter((inst) => inst.id !== id),
            connections: state.connections.filter(
              (conn) =>
                conn.sourceInstanceId !== id && conn.targetInstanceId !== id,
            ),
            // Null out pointer instances pointing to the deleted struct instance
            pointerInstances: state.pointerInstances.map((pi) =>
              pi.targetInstanceId === id
                ? { ...pi, targetInstanceId: null, targetFieldName: null }
                : pi,
            ),
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
        });
      },

      removeInstances: (ids: string[]) => {
        set((state) => {
          const newHistoryState: HistoryState = {
            structDefinitions: JSON.parse(
              JSON.stringify(state.structDefinitions),
            ),
            instances: JSON.parse(JSON.stringify(state.instances)),
            connections: JSON.parse(JSON.stringify(state.connections)),
            pointerDefinitions: JSON.parse(
              JSON.stringify(state.pointerDefinitions),
            ),
            pointerInstances: JSON.parse(
              JSON.stringify(state.pointerInstances),
            ),
          };
          const newHistory = state.history.slice(0, state.historyIndex + 1);
          newHistory.push(newHistoryState);
          if (newHistory.length > MAX_HISTORY_SIZE) {
            newHistory.shift();
          }

          return {
            instances: state.instances.filter((inst) => !ids.includes(inst.id)),
            connections: state.connections.filter(
              (conn) =>
                !ids.includes(conn.sourceInstanceId) &&
                !ids.includes(conn.targetInstanceId),
            ),
            // Null out pointer instances pointing to deleted struct instances
            pointerInstances: state.pointerInstances.map((pi) =>
              pi.targetInstanceId && ids.includes(pi.targetInstanceId)
                ? { ...pi, targetInstanceId: null, targetFieldName: null }
                : pi,
            ),
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
        });
      },

      connections: [],

      addConnection: (connection) => {
        get().saveHistory();
        set((state) => ({
          connections: [
            ...state.connections,
            { ...connection, id: `conn-${Date.now()}-${Math.random()}` },
          ],
        }));
      },

      removeConnection: (id) => {
        get().saveHistory();
        set((state) => ({
          connections: state.connections.filter((conn) => conn.id !== id),
        }));
      },

      pointerDefinitions: [],
      pointerInstances: [],

      addPointerDefinition: (pointer) => {
        get().saveHistory();
        set((state) => ({
          pointerDefinitions: [...state.pointerDefinitions, pointer],
        }));
      },

      updatePointerDefinition: (id, updates) => {
        get().saveHistory();
        set((state) => ({
          pointerDefinitions: state.pointerDefinitions.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
          // Also update existing instances that came from this definition
          pointerInstances: state.pointerInstances.map((pi) =>
            pi.pointerVariableId === id
              ? {
                  ...pi,
                  ...(updates.name !== undefined ? { name: updates.name } : {}),
                  ...(updates.type !== undefined ? { type: updates.type } : {}),
                  ...(updates.pointerLevel !== undefined
                    ? { pointerLevel: updates.pointerLevel }
                    : {}),
                }
              : pi,
          ),
        }));
      },

      removePointerDefinition: (id) => {
        get().saveHistory();
        set((state) => ({
          pointerDefinitions: state.pointerDefinitions.filter((p) => p.id !== id),
          // Also remove all instances of this pointer definition
          pointerInstances: state.pointerInstances.filter(
            (pi) => pi.pointerVariableId !== id,
          ),
        }));
      },

      addPointerInstance: (instance) => {
        get().saveHistory();
        set((state) => ({
          pointerInstances: [...state.pointerInstances, instance],
        }));
      },

      updatePointerInstancePosition: (id, position) => {
        set((state) => ({
          pointerInstances: state.pointerInstances.map((pi) =>
            pi.id === id ? { ...pi, position } : pi,
          ),
        }));
      },

      updatePointerInstanceTarget: (id, targetInstanceId, targetFieldName?) => {
        get().saveHistory();
        set((state) => ({
          pointerInstances: state.pointerInstances.map((pi) =>
            pi.id === id
              ? {
                  ...pi,
                  targetInstanceId,
                  targetFieldName: targetInstanceId === null ? null : (targetFieldName ?? null),
                }
              : pi,
          ),
        }));
      },

      removePointerInstance: (id) => {
        get().saveHistory();
        set((state) => ({
          pointerInstances: state.pointerInstances
            .filter((pi) => pi.id !== id)
            .map((pi) =>
              pi.targetInstanceId === id
                ? { ...pi, targetInstanceId: null, targetFieldName: null }
                : pi,
            ),
        }));
      },

      removePointerInstances: (ids) => {
        get().saveHistory();
        set((state) => ({
          pointerInstances: state.pointerInstances
            .filter((pi) => !ids.includes(pi.id))
            .map((pi) =>
              pi.targetInstanceId && ids.includes(pi.targetInstanceId)
                ? { ...pi, targetInstanceId: null, targetFieldName: null }
                : pi,
            ),
        }));
      },

      selectedInstanceId: null,

      setSelectedInstance: (id) => set({ selectedInstanceId: id }),

      clearAll: () =>
        set((state) => ({
          instances: [],
          connections: [],
          pointerInstances: [],
          selectedInstanceId: null,
          // Keep struct definitions and pointer definitions, only clear workspace
          structDefinitions: state.structDefinitions,
          pointerDefinitions: state.pointerDefinitions,
        })),

      exportWorkspace: () => {
        const state = useCanvasStore.getState();
        return JSON.stringify(
          {
            structDefinitions: state.structDefinitions,
            instances: state.instances,
            connections: state.connections,
            pointerDefinitions: state.pointerDefinitions,
            pointerInstances: state.pointerInstances,
            version: "1.2",
          },
          null,
          2,
        );
      },

      importWorkspace: (data: string) => {
        try {
          const parsed = JSON.parse(data);

          // Migrate old pointer instances: default missing targetFieldName to null
          const migratedPointerInstances = (parsed.pointerInstances || []).map(
            (pi: Record<string, unknown>) => ({
              ...pi,
              targetFieldName: pi.targetFieldName ?? null,
            }),
          );

          set({
            structDefinitions: parsed.structDefinitions || [],
            instances: parsed.instances || [],
            connections: parsed.connections || [],
            pointerDefinitions: parsed.pointerDefinitions || [],
            pointerInstances: migratedPointerInstances,
            selectedInstanceId: null,
          });
        } catch (error) {
          console.error("Failed to import workspace:", error);
          alert("Failed to import workspace. Invalid file format.");
        }
      },

      // --- Workspace tab actions ---

      switchWorkspace: (targetId: string) => {
        const state = get();
        if (targetId === state.activeWorkspaceId) return;

        // Save current workspace snapshot
        saveSnapshot(state.activeWorkspaceId, state);

        // Load target workspace snapshot
        const snapshot = loadSnapshot(targetId);
        const data = snapshot || emptySnapshot();

        set({
          structDefinitions: data.structDefinitions,
          instances: data.instances,
          connections: data.connections,
          pointerDefinitions: data.pointerDefinitions,
          pointerInstances: data.pointerInstances,
          history: data.history,
          historyIndex: data.historyIndex,
          activeWorkspaceId: targetId,
          selectedInstanceId: null,
        });
      },

      addWorkspace: (mode?: WorkspaceMode, language?: WorkspaceLanguage) => {
        const state = get();
        const wsMode = mode || "free";
        const wsLang = language || "c";

        // Save current workspace snapshot
        saveSnapshot(state.activeWorkspaceId, state);

        const newId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const langPrefix = wsLang === "cpp" ? "C++" : "C";
        const modeLabel = wsMode === "visualizer" ? "Visualizer" : "Workspace";
        const sameKindCount = state.workspaceTabs.filter(t => t.mode === wsMode && t.language === wsLang).length + 1;
        const defaultName = `${langPrefix} ${modeLabel} ${sameKindCount}`;
        const newTab: WorkspaceTab = {
          id: newId,
          name: defaultName,
          createdAt: Date.now(),
          mode: wsMode,
          language: wsLang,
        };
        const empty = emptySnapshot();

        set({
          workspaceTabs: [...state.workspaceTabs, newTab],
          activeWorkspaceId: newId,
          structDefinitions: empty.structDefinitions,
          instances: empty.instances,
          connections: empty.connections,
          pointerDefinitions: empty.pointerDefinitions,
          pointerInstances: empty.pointerInstances,
          history: empty.history,
          historyIndex: empty.historyIndex,
          selectedInstanceId: null,
        });
      },

      removeWorkspace: (id: string) => {
        const state = get();
        // Guard: cannot close the last tab
        if (state.workspaceTabs.length <= 1) return;

        const tabIndex = state.workspaceTabs.findIndex((t) => t.id === id);
        if (tabIndex === -1) return;

        // Delete snapshot from localStorage
        deleteSnapshot(id);
        // Also clean up visualizer state if it was a visualizer workspace
        localStorage.removeItem("c-struct-vis-ws-" + id);

        const remainingTabs = state.workspaceTabs.filter((t) => t.id !== id);

        if (id === state.activeWorkspaceId) {
          // Switch to nearest remaining tab
          const newActiveIndex = Math.min(tabIndex, remainingTabs.length - 1);
          const newActiveId = remainingTabs[newActiveIndex].id;

          const snapshot = loadSnapshot(newActiveId);
          const data = snapshot || emptySnapshot();

          set({
            workspaceTabs: remainingTabs,
            activeWorkspaceId: newActiveId,
            structDefinitions: data.structDefinitions,
            instances: data.instances,
            connections: data.connections,
            pointerDefinitions: data.pointerDefinitions,
            pointerInstances: data.pointerInstances,
            history: data.history,
            historyIndex: data.historyIndex,
            selectedInstanceId: null,
          });
        } else {
          set({ workspaceTabs: remainingTabs });
        }
      },

      renameWorkspace: (id: string, name: string) => {
        set((state) => ({
          workspaceTabs: state.workspaceTabs.map((t) =>
            t.id === id ? { ...t, name } : t,
          ),
        }));
      },

      duplicateWorkspace: (id: string) => {
        const state = get();
        const sourceTab = state.workspaceTabs.find((t) => t.id === id);
        if (!sourceTab) return;

        // Save current workspace so snapshot is fresh
        saveSnapshot(state.activeWorkspaceId, state);

        // Get the source data
        let sourceData: WorkspaceSnapshot;
        if (id === state.activeWorkspaceId) {
          sourceData = {
            structDefinitions: JSON.parse(JSON.stringify(state.structDefinitions)),
            instances: JSON.parse(JSON.stringify(state.instances)),
            connections: JSON.parse(JSON.stringify(state.connections)),
            pointerDefinitions: JSON.parse(JSON.stringify(state.pointerDefinitions)),
            pointerInstances: JSON.parse(JSON.stringify(state.pointerInstances)),
            history: JSON.parse(JSON.stringify(state.history)),
            historyIndex: state.historyIndex,
          };
        } else {
          const snapshot = loadSnapshot(id);
          sourceData = snapshot
            ? JSON.parse(JSON.stringify(snapshot))
            : { ...emptySnapshot() };
        }

        const newId = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const newTab: WorkspaceTab = {
          id: newId,
          name: `${sourceTab.name} (copy)`,
          createdAt: Date.now(),
          mode: sourceTab.mode || "free",
          language: sourceTab.language || "c",
        };

        // Save clone to localStorage
        try {
          localStorage.setItem(WS_KEY + newId, JSON.stringify(sourceData));
        } catch {
          console.warn("localStorage quota exceeded when duplicating workspace");
        }

        // Insert new tab after source tab
        const sourceIndex = state.workspaceTabs.findIndex((t) => t.id === id);
        const newTabs = [...state.workspaceTabs];
        newTabs.splice(sourceIndex + 1, 0, newTab);

        // Switch to the duplicated workspace
        set({
          workspaceTabs: newTabs,
          activeWorkspaceId: newId,
          structDefinitions: sourceData.structDefinitions,
          instances: sourceData.instances,
          connections: sourceData.connections,
          pointerDefinitions: sourceData.pointerDefinitions,
          pointerInstances: sourceData.pointerInstances,
          history: sourceData.history,
          historyIndex: sourceData.historyIndex,
          selectedInstanceId: null,
        });
      },
      reorderWorkspaces: (fromIndex: number, toIndex: number) => {
        const state = get();
        const workspaceTabs = [...state.workspaceTabs];
        const [moved] = workspaceTabs.splice(fromIndex, 1);
        workspaceTabs.splice(toIndex, 0, moved);
        set({ workspaceTabs });
      },

      closeOtherWorkspaces: (id: string) => {
        const state = get();
        const keepTab = state.workspaceTabs.find((t) => t.id === id);
        if (!keepTab) return;

        // Save current workspace snapshot
        saveSnapshot(state.activeWorkspaceId, state);

        // Delete snapshots for all other tabs
        for (const tab of state.workspaceTabs) {
          if (tab.id !== id) deleteSnapshot(tab.id);
        }

        // If kept tab isn't active, load its snapshot and switch
        if (id !== state.activeWorkspaceId) {
          const snapshot = loadSnapshot(id);
          const data = snapshot || emptySnapshot();
          set({
            workspaceTabs: [keepTab],
            activeWorkspaceId: id,
            structDefinitions: data.structDefinitions,
            instances: data.instances,
            connections: data.connections,
            pointerDefinitions: data.pointerDefinitions,
            pointerInstances: data.pointerInstances,
            history: data.history,
            historyIndex: data.historyIndex,
            selectedInstanceId: null,
          });
        } else {
          set({ workspaceTabs: [keepTab] });
        }
      },

      closeRightWorkspaces: (id: string) => {
        const state = get();
        const tabIndex = state.workspaceTabs.findIndex((t) => t.id === id);
        if (tabIndex === -1) return;

        const remainingTabs = state.workspaceTabs.slice(0, tabIndex + 1);
        const removedTabs = state.workspaceTabs.slice(tabIndex + 1);

        // Save current workspace snapshot
        saveSnapshot(state.activeWorkspaceId, state);

        // Delete snapshots for removed tabs
        for (const tab of removedTabs) {
          deleteSnapshot(tab.id);
        }

        // If active tab is being closed, switch to the kept tab
        const activeIsRemoved = removedTabs.some((t) => t.id === state.activeWorkspaceId);
        if (activeIsRemoved) {
          const snapshot = loadSnapshot(id);
          const data = snapshot || emptySnapshot();
          set({
            workspaceTabs: remainingTabs,
            activeWorkspaceId: id,
            structDefinitions: data.structDefinitions,
            instances: data.instances,
            connections: data.connections,
            pointerDefinitions: data.pointerDefinitions,
            pointerInstances: data.pointerInstances,
            history: data.history,
            historyIndex: data.historyIndex,
            selectedInstanceId: null,
          });
        } else {
          set({ workspaceTabs: remainingTabs });
        }
      },
    }),
    {
      name: "c-struct-visualizer-storage-v2",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state && (!state.workspaceTabs || state.workspaceTabs.length === 0)) {
          const id = `ws-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          state.workspaceTabs = [{ id, name: "C Workspace 1", createdAt: Date.now(), mode: "free", language: "c" }];
          state.activeWorkspaceId = id;
        }
        // Migrate: add mode and language fields to existing tabs that don't have them
        if (state && state.workspaceTabs) {
          state.workspaceTabs = state.workspaceTabs.map(t => ({
            ...t,
            mode: t.mode || "free",
            language: t.language || "c",
          }));
        }
      },
    },
  ),
);
