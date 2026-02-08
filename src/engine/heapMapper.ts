import type { HeapObject, HeapState, VariableSnapshot } from "../types/visualizer";
import type { CStruct, CField, StructInstance, PointerInstance, PointerConnection } from "../types";
import { getStructColor, getPointerColor } from "../utils/colors";

/**
 * Maps heap objects and stack variables into the ReactFlow types
 * used by the existing StructNode/PointerNode components.
 */
export function mapHeapToReactFlow(
  heapObjects: HeapObject[],
  stackVariables: VariableSnapshot[],
): HeapState {
  const structDefinitions: CStruct[] = [];
  const structInstances: StructInstance[] = [];
  const pointerInstances: PointerInstance[] = [];
  const connections: PointerConnection[] = [];
  const seenStructNames = new Set<string>();

  // Collect all struct type names for deterministic coloring
  const allStructNames = heapObjects
    .filter((h) => h.isStruct && !h.freed)
    .map((h) => h.typeName);

  // 1. Convert each non-freed HeapObject with isStruct → StructInstance
  const activeHeapObjects = heapObjects.filter((h) => !h.freed);

  for (const obj of activeHeapObjects) {
    if (!obj.isStruct) continue;

    const instanceId = `heap-${obj.address}`;

    // Build CStruct definition if not seen before
    if (!seenStructNames.has(obj.typeName)) {
      seenStructNames.add(obj.typeName);
      const fields: CField[] = Object.entries(obj.fields).map(([fieldName, fieldInfo]) => ({
        name: fieldName,
        type: fieldInfo.type.replace(/\*+$/, "").trim(),
        isPointer: fieldInfo.isPointer,
        isArray: false,
        pointerLevel: fieldInfo.pointerLevel || 0,
      }));

      structDefinitions.push({
        name: obj.typeName,
        fields,
        color: getStructColor(obj.typeName, allStructNames),
      });
    }

    // Build StructInstance
    const fieldValues: Record<string, unknown> = {};
    for (const [fieldName, fieldInfo] of Object.entries(obj.fields)) {
      if (!fieldInfo.isPointer) {
        fieldValues[fieldName] = fieldInfo.value;
      }
    }

    structInstances.push({
      id: instanceId,
      structName: obj.typeName,
      instanceName: `${obj.typeName}@${obj.address.toString(16)}`,
      position: { x: 0, y: 0 }, // Will be set by layout
      fieldValues,
    });

    // Build pointer connections from struct fields
    for (const [fieldName, fieldInfo] of Object.entries(obj.fields)) {
      if (fieldInfo.isPointer && fieldInfo.pointsTo !== undefined) {
        const targetObj = activeHeapObjects.find(
          (h) => h.address === fieldInfo.pointsTo,
        );
        if (targetObj && targetObj.isStruct) {
          connections.push({
            id: `conn-${instanceId}-${fieldName}`,
            sourceInstanceId: instanceId,
            sourceFieldName: fieldName,
            targetInstanceId: `heap-${targetObj.address}`,
          });
        }
      }
    }
  }

  // 2. Convert stack pointer variables → PointerInstance
  const pointerVars = stackVariables.filter((v) => v.isPointer);
  const allPointerNames = pointerVars.map((v) => v.name);

  for (const ptrVar of pointerVars) {
    const pointerId = `ptr-${ptrVar.name}`;

    // Find target heap object
    let targetInstanceId: string | null = null;
    if (ptrVar.pointsTo !== undefined) {
      const targetObj = activeHeapObjects.find(
        (h) => h.address === ptrVar.pointsTo,
      );
      if (targetObj) {
        targetInstanceId = `heap-${targetObj.address}`;
      }
    }

    pointerInstances.push({
      id: pointerId,
      pointerVariableId: pointerId,
      name: ptrVar.name,
      type: ptrVar.type.replace(/\*+$/, "").trim(),
      pointerLevel: ptrVar.pointerLevel,
      position: { x: 0, y: 0 }, // Will be set by layout
      targetInstanceId,
      targetFieldName: null,
      color: getPointerColor(ptrVar.name, allPointerNames),
    });
  }

  return {
    objects: heapObjects,
    structDefinitions,
    structInstances,
    pointerInstances,
    connections,
  };
}
