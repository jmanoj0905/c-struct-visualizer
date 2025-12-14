import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from './canvasStore';
import type { CStruct, StructInstance } from '../types';

const getPersistedState = () => {
  const persistedStateJSON = localStorage.getItem('c-struct-visualizer-storage-v2');
  if (!persistedStateJSON) return null;
  const persistedState = JSON.parse(persistedStateJSON);
  return persistedState.state;
};

describe('canvasStore persistence', () => {
  // Before each test, we clear local storage and reset the zustand store
  // to a known initial state. This is important for test isolation.
  beforeEach(() => {
    useCanvasStore.persist.clearStorage();
    // Manually setting the state to its default values.
    useCanvasStore.setState({
      structDefinitions: [],
      instances: [],
      connections: [],
      selectedInstanceId: null,
      history: [],
      historyIndex: -1,
    });
  });

  it('should persist state when deleting nodes', () => {
    const { addStructDefinition, addInstance, removeInstances } = useCanvasStore.getState();
    const structDef: CStruct = { name: 'Node', fields: [] };
    
    // Add a struct and two instances
    addStructDefinition(structDef);
    addInstance(structDef, { x: 0, y: 0 });
    addInstance(structDef, { x: 100, y: 100 });

    let state = useCanvasStore.getState();
    expect(state.instances.length).toBe(2);
    const idToDelete = state.instances[0].id;

    // Delete one instance
    removeInstances([idToDelete]);

    // Check in-memory state
    state = useCanvasStore.getState();
    expect(state.instances.length).toBe(1);

    // Check persisted state from localStorage
    const persistedState = getPersistedState();
    expect(persistedState).not.toBeNull();
    expect(persistedState.instances.length).toBe(1);
    expect(persistedState.instances.find((i: StructInstance) => i.id === idToDelete)).toBeUndefined();
  });

  it('should persist state when clearing the workspace', () => {
    const { addStructDefinition, addInstance, clearAll } = useCanvasStore.getState();
    const structDef: CStruct = { name: 'Node', fields: [] };
    addStructDefinition(structDef);
    addInstance(structDef, { x: 0, y: 0 });

    let state = useCanvasStore.getState();
    expect(state.instances.length).toBe(1);
    expect(state.structDefinitions.length).toBe(1);

    // Clear the workspace
    clearAll();

    // Check in-memory state
    state = useCanvasStore.getState();
    expect(state.instances.length).toBe(0);
    expect(state.structDefinitions.length).toBe(1); // Struct definitions should remain

    // Check persisted state from localStorage
    const persistedState = getPersistedState();
    expect(persistedState).not.toBeNull();
    expect(persistedState.instances.length).toBe(0);
    expect(persistedState.structDefinitions.length).toBe(1);
  });
});
