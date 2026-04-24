import { describe, it, expect } from "vitest";
import { tokenize } from "../lexer";
import { Parser } from "../parser";
import { Interpreter } from "../interpreter";
import type { ExecutionStep } from "../../../types/visualizer";

function run(code: string, stdin = ""): ExecutionStep[] {
  const tokens = tokenize(code);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  return new Interpreter().interpret(ast, code, stdin);
}

function finalOutput(steps: ExecutionStep[]): string {
  return steps[steps.length - 1]?.consoleOutput ?? "";
}

describe("interpreter — C basics", () => {
  it("runs hello-world printf", () => {
    const steps = run(`int main() { printf("hi"); return 0; }`);
    expect(finalOutput(steps)).toBe("hi");
  });

  it("does integer arithmetic and printf %d", () => {
    const steps = run(`int main() { int a = 3; int b = 4; printf("%d", a + b); return 0; }`);
    expect(finalOutput(steps)).toBe("7");
  });

  it("executes a while loop", () => {
    const steps = run(`
      int main() {
        int i = 0; int sum = 0;
        while (i < 5) { sum = sum + i; i = i + 1; }
        printf("%d", sum);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("10");
  });

  it("executes a for loop with compound assignment (regression: Phase 3b)", () => {
    const steps = run(`
      int main() {
        int sum = 0;
        for (int i = 1; i <= 4; i = i + 1) { sum += i; }
        printf("%d", sum);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("10");
  });
});

describe("interpreter — arrays (regression: Phase 3a)", () => {
  it("reads and writes int[5] slots", () => {
    const steps = run(`
      int main() {
        int arr[5];
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = arr[0] + arr[1];
        printf("%d", arr[2]);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("30");
  });

  it("initializes from brace list and reads back", () => {
    const steps = run(`
      int main() {
        int arr[4] = {7, 8, 9, 10};
        printf("%d", arr[3]);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("10");
  });

  it("supports arr[i] += v (compound on array element)", () => {
    const steps = run(`
      int main() {
        int arr[3] = {1, 2, 3};
        arr[1] += 40;
        printf("%d", arr[1]);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("42");
  });

  it("exposes array elements in heap snapshot as [i] fields", () => {
    const steps = run(`
      int main() {
        int arr[3] = {11, 22, 33};
        return 0;
      }
    `);
    const lastHeap = steps[steps.length - 1].heapObjects;
    const arrBlock = lastHeap.find(h => Object.keys(h.fields).includes("[0]"));
    expect(arrBlock).toBeDefined();
    expect(arrBlock!.fields["[0]"].value).toBe("11");
    expect(arrBlock!.fields["[2]"].value).toBe("33");
  });
});

describe("interpreter — pointers + malloc/free", () => {
  it("mallocs a struct, assigns a field, and reads it back", () => {
    const steps = run(`
      struct Node { int val; struct Node* next; };
      int main() {
        struct Node* n = (struct Node*) malloc(sizeof(struct Node));
        n->val = 42;
        n->next = NULL;
        printf("%d", n->val);
        free(n);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("42");
  });
});

describe("interpreter — C++ basics", () => {
  it("dispatches virtual method through base pointer", () => {
    const steps = run(`
      class Animal {
       public:
        virtual void speak() { cout << "generic"; }
      };
      class Dog : public Animal {
       public:
        void speak() { cout << "woof"; }
      };
      int main() {
        Animal* a = new Dog();
        a->speak();
        delete a;
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("woof");
  });

  it("runs constructor + destructor via new/delete", () => {
    const steps = run(`
      class Box {
       public:
        Box() { cout << "ctor,"; }
        ~Box() { cout << "dtor"; }
      };
      int main() {
        Box* b = new Box();
        delete b;
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("ctor,dtor");
  });
});

describe("interpreter — known gaps", () => {
  it.skip("switch/case is not yet implemented (parser gap)", () => {
    // When this test is un-skipped, remove the inline NOTE in lexer.ts.
    run(`int main() { int x = 1; switch (x) { case 1: break; } return 0; }`);
  });
});
