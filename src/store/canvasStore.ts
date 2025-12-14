import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CStruct, StructInstance, PointerConnection } from "../types";
import { canConnectPointer, resolveTypeName } from "../parser/structParser";

interface HistoryState {
  structDefinitions: CStruct[];
  instances: StructInstance[];
  connections: PointerConnection[];
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
}

let instanceCounter = 0;

const MAX_HISTORY_SIZE = 50;

export const useCanvasStore = create<CanvasState>()(
  persist<CanvasState>(
    (set, get) => ({
      structDefinitions: [],
      history: [],
      historyIndex: -1,

      saveHistory: () => {
        const state = get();
        const newHistoryState: HistoryState = {
          structDefinitions: JSON.parse(
            JSON.stringify(state.structDefinitions),
          ),
          instances: JSON.parse(JSON.stringify(state.instances)),
          connections: JSON.parse(JSON.stringify(state.connections)),
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

          return {
            structDefinitions: updatedStructDefinitions,
            instances: updatedInstances,
            connections: validConnections,
          };
        });
      },

      deleteStructDefinition: (structName) => {
        get().saveHistory();
        set((state) => ({
          structDefinitions: state.structDefinitions.filter(
            (s) => s.name !== structName,
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
          const newInstance: StructInstance = {
            id: `instance-${Date.now()}-${Math.random()}`,
            structName: struct.name,
            instanceName,
            position,
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
        get().saveHistory();
        set((state) => ({
          instances: state.instances.filter((inst) => inst.id !== id),
          connections: state.connections.filter(
            (conn) =>
              conn.sourceInstanceId !== id && conn.targetInstanceId !== id,
          ),
        }));
      },

      removeInstances: (ids: string[]) => {
        get().saveHistory();
        set((state) => ({
          instances: state.instances.filter((inst) => !ids.includes(inst.id)),
          connections: state.connections.filter(
            (conn) =>
              !ids.includes(conn.sourceInstanceId) &&
              !ids.includes(conn.targetInstanceId),
          ),
        }));
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

      selectedInstanceId: null,

      setSelectedInstance: (id) => set({ selectedInstanceId: id }),

      clearAll: () =>
        set((state) => ({
          instances: [],
          connections: [],
          selectedInstanceId: null,
          // Keep struct definitions, only clear workspace
          structDefinitions: state.structDefinitions,
        })),

      exportWorkspace: () => {
        const state = useCanvasStore.getState();
        return JSON.stringify(
          {
            structDefinitions: state.structDefinitions,
            instances: state.instances,
            connections: state.connections,
            version: "1.0",
          },
          null,
          2,
        );
      },

      importWorkspace: (data: string) => {
        try {
          const parsed = JSON.parse(data);
          set({
            structDefinitions: parsed.structDefinitions || [],
            instances: parsed.instances || [],
            connections: parsed.connections || [],
            selectedInstanceId: null,
          });
        } catch (error) {
          console.error("Failed to import workspace:", error);
          alert("Failed to import workspace. Invalid file format.");
        }
      },
    }),
    {
      name: "c-struct-visualizer-storage-v2",
    },
  ),
);
