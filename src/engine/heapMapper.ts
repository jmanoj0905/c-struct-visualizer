import type { HeapObject, HeapState, VariableSnapshot, StackFrame, StackPointerMetadata } from "../types/visualizer";
import type { CStruct, CField, StructInstance, PointerInstance, PointerConnection } from "../types";
import { getStructColor, getPointerColor } from "../utils/colors";

/**
 * Extracts stack pointer metadata for arrows connecting stack variables to heap objects.
 * Filters for non-null pointers that point to valid heap objects.
 */
function extractStackPointers(
  callStack: StackFrame[],
  heapObjects: HeapObject[],
): StackPointerMetadata[] {
  const stackPointers: StackPointerMetadata[] = [];
  const activeHeapAddresses = new Set(
    heapObjects.filter((h) => !h.freed).map((h) => h.address)
  );

  // Collect all pointer variable names for consistent coloring
  const allPointerNames: string[] = [];
  callStack.forEach((frame) => {
    frame.variables.forEach((variable) => {
      if (variable.isPointer && variable.pointsTo !== undefined) {
        allPointerNames.push(variable.name);
      }
    });
  });

  // Extract stack pointers from each frame
  callStack.forEach((frame, frameIndex) => {
    frame.variables.forEach((variable) => {
      // Only process pointer variables that point to valid heap objects
      if (
        variable.isPointer &&
        variable.pointsTo !== undefined &&
        activeHeapAddresses.has(variable.pointsTo)
      ) {
        stackPointers.push({
          variableName: variable.name,
          frameIndex: callStack.length - 1 - frameIndex, // Reverse: 0 = active frame
          frameName: frame.functionName,
          targetAddress: variable.pointsTo,
          color: getPointerColor(variable.name, allPointerNames),
        });
      }
    });
  });

  return stackPointers;
}

/**
 * Maps heap objects and stack variables into the ReactFlow types
 * used by the existing StructNode/PointerNode components.
 */
export function mapHeapToReactFlow(
  heapObjects: HeapObject[],
  _stackVariables: VariableSnapshot[],
  callStack: StackFrame[] = [],
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
      const baseFieldSet = new Set(obj.baseClassFields || []);
      const fields: CField[] = Object.entries(obj.fields).map(([fieldName, fieldInfo]) => {
        const field: CField = {
          name: fieldName,
          type: fieldInfo.type.replace(/\*+$/, "").trim(),
          isPointer: fieldInfo.isPointer,
          isArray: false,
          pointerLevel: fieldInfo.pointerLevel || 0,
        };
        // Mark inherited fields
        if (baseFieldSet.has(fieldName)) {
          field.accessLevel = "protected"; // visual hint for inherited
        }
        return field;
      });

      const structDef: CStruct = {
        name: obj.typeName,
        fields,
        color: getStructColor(obj.typeName, allStructNames),
      };

      // Attach C++ class metadata
      if (obj.className) {
        structDef.isClass = true;
      }
      if (obj.hasVtable) {
        // Add synthetic __vptr field at the top
        fields.unshift({
          name: "__vptr",
          type: obj.className || obj.typeName,
          isPointer: false,
          isArray: false,
        });
      }

      structDefinitions.push(structDef);
    }

    // Build StructInstance
    const fieldValues: Record<string, unknown> = {};
    for (const [fieldName, fieldInfo] of Object.entries(obj.fields)) {
      if (!fieldInfo.isPointer) {
        fieldValues[fieldName] = fieldInfo.value;
      }
    }

    const displayName = obj.className
      ? `${obj.className}@${obj.address.toString(16)}`
      : `${obj.typeName}@${obj.address.toString(16)}`;

    structInstances.push({
      id: instanceId,
      structName: obj.typeName,
      instanceName: displayName,
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

  // Stack pointer metadata (used by StackHeapArrows SVG overlay)
  const stackPointers = extractStackPointers(callStack, heapObjects);

  return {
    objects: heapObjects,
    structDefinitions,
    structInstances,
    pointerInstances,
    connections,
    stackPointers,
  };
}
