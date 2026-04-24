import { describe, it, expect } from "vitest";
import { parseStruct } from "../structParser";

describe("structParser", () => {
  it("parses a simple struct with primitive fields", () => {
    const s = parseStruct(`
      struct Person {
        int age;
        float salary;
      };
    `);
    expect(s).not.toBeNull();
    expect(s!.name).toBe("Person");
    expect(s!.fields.map(f => f.name)).toEqual(["age", "salary"]);
  });

  it("parses a typedef struct and records the typedef name", () => {
    const s = parseStruct(`
      typedef struct Node {
        int val;
        struct Node* next;
      } Node_t;
    `);
    expect(s).not.toBeNull();
    expect(s!.name).toBe("Node");
    expect(s!.typedef).toBe("Node_t");
  });

  it("parses a self-referential linked-list node", () => {
    const s = parseStruct(`
      struct Node {
        int val;
        struct Node* next;
      };
    `);
    expect(s).not.toBeNull();
    const next = s!.fields.find(f => f.name === "next");
    expect(next).toBeDefined();
    expect(next!.type).toContain("Node");
  });

  it("parses a class with a base class", () => {
    const s = parseStruct(`
      class Dog : public Animal {
       public:
        int legs;
      };
    `);
    expect(s).not.toBeNull();
    expect(s!.name).toBe("Dog");
  });

  it("returns null for unparseable input", () => {
    expect(parseStruct("this is not a struct")).toBeNull();
  });
});
