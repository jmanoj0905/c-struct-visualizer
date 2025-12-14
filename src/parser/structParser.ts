import type { CStruct, CField } from "../types";

/**
 * Simple C struct parser for beginners
 * Parses basic struct definitions like:
 *
 * struct Person {
 *   int age;
 *   char* name;
 *   float salary;
 * };
 */

export function parseStruct(structCode: string): CStruct | null {
  try {
    // Remove comments
    const cleaned = structCode
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");

    // Check for typedef struct pattern: typedef struct StructName { ... } TypedefName;
    const typedefMatch = cleaned.match(
      /typedef\s+struct\s+(\w+)\s*\{([\s\S]*)\}\s*(\w+)\s*;/,
    );

    let structName: string;
    let typedef: string | undefined;
    let body: string;

    if (typedefMatch) {
      // Has typedef
      structName = typedefMatch[1];
      body = typedefMatch[2];
      typedef = typedefMatch[3];
    } else {
      // Regular struct without typedef
      const structMatch = cleaned.match(/struct\s+(\w+)\s*\{/);
      if (!structMatch) {
        throw new Error(
          "Invalid struct syntax. Expected: struct StructName { ... } or typedef struct StructName { ... } TypedefName;",
        );
      }

      structName = structMatch[1];

      // Extract fields between braces
      const bodyMatch = cleaned.match(/\{([\s\S]*)\}/);
      if (!bodyMatch) {
        throw new Error("Could not find struct body");
      }
      body = bodyMatch[1];
    }

    const fieldLines = body
      .split(";")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const fields: CField[] = [];

    for (const line of fieldLines) {
      const field = parseField(line);
      if (field) {
        fields.push(field);
      }
    }

    return { name: structName, typedef, fields };
  } catch (error) {
    console.error("Parse error:", error);
    return null;
  }
}

function parseField(fieldLine: string): CField | null {
  // Handle: int age, char* name, int** ptr, int arr[10], float* ptr, int* p[10] (array of pointers)
  // Also handle: struct Node* next, struct Node** ptr
  // Also handle function pointers: void (*callback)(int)
  const trimmed = fieldLine.trim();

  // Check for function pointer: returnType (*name)(params)
  const funcPtrMatch = trimmed.match(
    /^(\w+)\s*\(\s*\*\s*(\w+)\s*\)\s*\(([^)]*)\)$/,
  );
  if (funcPtrMatch) {
    return {
      name: funcPtrMatch[2],
      type: `${funcPtrMatch[1]}(${funcPtrMatch[3]})`, // e.g., "void(int, char*)"
      isPointer: true,
      isArray: false,
      isFunctionPointer: true,
    };
  }

  // Check for "struct TypeName* name" or "struct TypeName** name" (array of struct pointers)
  const structArrayPtrMatch = trimmed.match(
    /^struct\s+(\w+)\s*(\*+)\s*(\w+)\s*\[\s*(\d+)\s*\]$/,
  );
  if (structArrayPtrMatch) {
    const pointerLevel = structArrayPtrMatch[2].length; // Count asterisks
    return {
      name: structArrayPtrMatch[3],
      type: structArrayPtrMatch[1], // Just the struct name, not "struct Name"
      isPointer: pointerLevel > 0,
      isArray: true,
      arraySize: parseInt(structArrayPtrMatch[4], 10),
      pointerLevel,
    };
  }

  // Check for array of pointers: type** name[size] or type* name[size]
  const arrayPtrMatch = trimmed.match(
    /^(\w+)\s*(\*+)\s*(\w+)\s*\[\s*(\d+)\s*\]$/,
  );
  if (arrayPtrMatch) {
    const pointerLevel = arrayPtrMatch[2].length; // Count asterisks
    return {
      name: arrayPtrMatch[3],
      type: arrayPtrMatch[1],
      isPointer: pointerLevel > 0,
      isArray: true,
      arraySize: parseInt(arrayPtrMatch[4], 10),
      pointerLevel,
    };
  }

  // Check for regular array: type name[size] or struct TypeName name[size]
  const structArrayMatch = trimmed.match(
    /^struct\s+(\w+)\s+(\w+)\s*\[\s*(\d+)\s*\]$/,
  );
  if (structArrayMatch) {
    return {
      name: structArrayMatch[2],
      type: structArrayMatch[1],
      isPointer: false,
      isArray: true,
      arraySize: parseInt(structArrayMatch[3], 10),
    };
  }

  const arrayMatch = trimmed.match(/^(\w+)\s+(\w+)\s*\[\s*(\d+)\s*\]$/);
  if (arrayMatch) {
    return {
      name: arrayMatch[2],
      type: arrayMatch[1],
      isPointer: false,
      isArray: true,
      arraySize: parseInt(arrayMatch[3], 10),
    };
  }

  // Check for "struct TypeName* name" or "struct TypeName** name"
  const structPtrMatch = trimmed.match(/^struct\s+(\w+)\s*(\*+)\s*(\w+)$/);
  if (structPtrMatch) {
    const pointerLevel = structPtrMatch[2].length; // Count asterisks
    return {
      name: structPtrMatch[3],
      type: structPtrMatch[1], // Just the struct name, not "struct Name"
      isPointer: pointerLevel > 0,
      isArray: false,
      pointerLevel,
    };
  }

  // Check for multi-level pointers or regular field: type*** name, type** name, type* name, or type name
  const regularMatch = trimmed.match(/^(\w+)\s*(\**)\s*(\w+)$/);
  if (regularMatch) {
    const pointerLevel = regularMatch[2].length; // Count asterisks
    return {
      name: regularMatch[3],
      type: regularMatch[1],
      isPointer: pointerLevel > 0,
      isArray: false,
      pointerLevel,
    };
  }

  return null;
}

/**
 * Validate if a type exists (primitive or user-defined)
 */
export function isValidType(type: string, customStructs: CStruct[]): boolean {
  const primitives = [
    "int",
    "char",
    "float",
    "double",
    "long",
    "short",
    "void",
    "bool",
  ];

  if (primitives.includes(type)) {
    return true;
  }

  // Check both struct name and typedef name
  return customStructs.some((s) => s.name === type || s.typedef === type);
}

/**
 * Validate struct code and return detailed errors
 */
export interface ValidationError {
  line: number;
  message: string;
  type: "error" | "warning";
}

export function validateStructCode(
  code: string,
  existingStructs: CStruct[],
  isEditing: boolean,
  editingStructName?: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = code.split("\n");

  // Check for typedef struct pattern
  const typedefMatch = code.match(
    /typedef\s+struct\s+(\w+)\s*\{([\s\S]*)\}\s*(\w+)\s*;/,
  );
  const regularMatch = code.match(/struct\s+(\w+)\s*\{([\s\S]*)\}\s*;/);

  if (!typedefMatch && !regularMatch) {
    errors.push({
      line: 1,
      message:
        "Invalid struct syntax. Use 'struct Name { ... };' or 'typedef struct Name { ... } TypedefName;'",
      type: "error",
    });
    return errors;
  }

  let structName: string;
  let typedef: string | undefined;
  let bodyStartLine = 0;

  if (typedefMatch) {
    structName = typedefMatch[1];
    typedef = typedefMatch[3];

    // Find which line the struct body starts
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("{")) {
        bodyStartLine = i + 1;
        break;
      }
    }

    // Check if typedef name already exists
    if (!isEditing || editingStructName !== structName) {
      const typedefExists = existingStructs.some((s) => s.typedef === typedef);
      if (typedefExists) {
        errors.push({
          line: lines.length,
          message: `Typedef name '${typedef}' already exists!`,
          type: "error",
        });
      }
    }
  } else if (regularMatch) {
    structName = regularMatch[1];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("{")) {
        bodyStartLine = i + 1;
        break;
      }
    }
  } else {
    return errors;
  }

  // Check if struct name already exists
  if (!isEditing || editingStructName !== structName) {
    const nameExists = existingStructs.some((s) => s.name === structName);
    if (nameExists) {
      errors.push({
        line: 1,
        message: `Struct name '${structName}' already exists!`,
        type: "error",
      });
    }
  }

  // Parse and validate each field
  const bodyMatch = code.match(/\{([\s\S]*)\}/);
  if (bodyMatch) {
    const body = bodyMatch[1];
    const fieldLines = body
      .split(";")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let currentLine = bodyStartLine;
    for (const fieldLine of fieldLines) {
      // Count lines in this field
      const fieldLineCount = fieldLine.split("\n").length;

      // Try to parse the field
      const field = parseField(fieldLine);
      if (!field) {
        errors.push({
          line: currentLine,
          message: `Invalid field syntax: ${fieldLine.substring(0, 30)}...`,
          type: "error",
        });
      } else {
        // Check if field type is valid
        // IMPORTANT: Inside struct definition, you CANNOT use ANY typedef name!
        // But you CAN use 'struct Name*' for any existing struct
        if (typedef && field.type === typedef) {
          errors.push({
            line: currentLine,
            message: `Cannot use typedef name '${typedef}' inside the struct. Use 'struct ${structName}*' instead.`,
            type: "error",
          });
        }

        // Check if using a typedef name of another struct (also not allowed)
        const otherTypedef = existingStructs.find(
          (s) => s.typedef === field.type,
        );
        if (otherTypedef && field.type !== structName) {
          errors.push({
            line: currentLine,
            message: `Cannot use typedef name '${field.type}' in struct fields. Use 'struct ${otherTypedef.name}*' instead.`,
            type: "error",
          });
        }

        // For pointers, the type can be any existing struct name (used with 'struct' keyword)
        // For non-pointers, check if the type is valid
        if (
          !field.isPointer &&
          !isValidType(field.type, existingStructs) &&
          field.type !== structName
        ) {
          errors.push({
            line: currentLine,
            message: `Unknown type '${field.type}'.`,
            type: "error",
          });
        }
      }

      currentLine += fieldLineCount;
    }
  }

  return errors;
}

/**
 * Check if pointer connection is type-safe
 * Takes typedef into account - need the struct definitions to resolve typedef
 */
export function canConnectPointer(
  pointerType: string,
  targetStructName: string,
): boolean {
  // void* can point to anything
  if (pointerType === "void") {
    return true;
  }

  // Type must match exactly (struct name)
  return pointerType === targetStructName;
}

/**
 * Resolve a type name to struct name (handles typedef)
 */
export function resolveTypeName(typeName: string, structs: CStruct[]): string {
  // Check if typeName is a typedef, if so return the struct name
  const structWithTypedef = structs.find((s) => s.typedef === typeName);
  if (structWithTypedef) {
    return structWithTypedef.name;
  }
  // Otherwise return as-is (it's already a struct name or primitive)
  return typeName;
}

/**
 * Get size in bytes for a C primitive type (typical on 64-bit systems)
 */
export function getTypeSize(type: string, structs: CStruct[]): number {
  // Remove any array notation or pointer for base type
  const baseType = type
    .replace(/\[.*\]/, "")
    .replace(/\*+$/, "")
    .trim();

  // Pointers are 8 bytes on 64-bit systems
  if (type.includes("*")) {
    return 8;
  }

  // Primitive type sizes (typical on 64-bit systems)
  const primitiveSizes: Record<string, number> = {
    char: 1,
    "signed char": 1,
    "unsigned char": 1,
    short: 2,
    "short int": 2,
    "signed short": 2,
    "unsigned short": 2,
    int: 4,
    "signed int": 4,
    unsigned: 4,
    "unsigned int": 4,
    long: 8,
    "long int": 8,
    "signed long": 8,
    "unsigned long": 8,
    "long long": 8,
    "long long int": 8,
    float: 4,
    double: 8,
    "long double": 16,
    void: 0,
  };

  if (primitiveSizes[baseType] !== undefined) {
    return primitiveSizes[baseType];
  }

  // Check if it's a struct type
  const struct = structs.find(
    (s) => s.name === baseType || s.typedef === baseType,
  );
  if (struct) {
    return calculateStructSize(struct, structs);
  }

  return 0; // Unknown type
}

/**
 * Calculate total size of a struct in bytes (with padding for alignment)
 */
export function calculateStructSize(
  struct: CStruct,
  structs: CStruct[],
): number {
  let totalSize = 0;
  let maxAlignment = 1;

  for (const field of struct.fields) {
    const fieldSize = getTypeSize(field.type, structs);
    const alignment = Math.min(fieldSize, 8); // Max alignment is typically 8 bytes

    // Track maximum alignment requirement
    maxAlignment = Math.max(maxAlignment, alignment);

    // Add padding before this field if needed
    if (totalSize % alignment !== 0) {
      totalSize += alignment - (totalSize % alignment);
    }

    // Add field size (considering arrays)
    if (field.arraySize && field.arraySize > 0) {
      totalSize += fieldSize * field.arraySize;
    } else {
      totalSize += fieldSize;
    }
  }

  // Add padding at the end to align the struct to its maximum alignment
  if (totalSize % maxAlignment !== 0) {
    totalSize += maxAlignment - (totalSize % maxAlignment);
  }

  return totalSize;
}
