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

describe("interpreter — switch/case", () => {
  it("matches a case and breaks", () => {
    const steps = run(`
      int main() {
        int x = 2;
        switch (x) {
          case 1: printf("one"); break;
          case 2: printf("two"); break;
          case 3: printf("three"); break;
        }
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("two");
  });

  it("falls through when no break", () => {
    const steps = run(`
      int main() {
        int x = 1;
        switch (x) {
          case 1: printf("a");
          case 2: printf("b"); break;
          case 3: printf("c");
        }
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("ab");
  });

  it("hits default when no case matches", () => {
    const steps = run(`
      int main() {
        int x = 99;
        switch (x) {
          case 1: printf("one"); break;
          default: printf("other"); break;
        }
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("other");
  });

  it("matches char case", () => {
    const steps = run(`
      int main() {
        int c = 65;
        switch (c) {
          case 65: printf("A"); break;
          default: printf("?"); break;
        }
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("A");
  });

  it("does nothing when no match and no default", () => {
    const steps = run(`
      int main() {
        int x = 5;
        switch (x) {
          case 1: printf("one"); break;
          case 2: printf("two"); break;
        }
        printf("done");
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("done");
  });
});

describe("interpreter — malloc/free edge cases", () => {
  it("free(NULL) is a no-op", () => {
    const steps = run(`
      int main() {
        int* p = NULL;
        free(p);
        printf("ok");
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("ok");
  });

  it("malloc then free then malloc again works", () => {
    const steps = run(`
      struct Node { int val; struct Node* next; };
      int main() {
        struct Node* a = (struct Node*) malloc(sizeof(struct Node));
        a->val = 1;
        free(a);
        struct Node* b = (struct Node*) malloc(sizeof(struct Node));
        b->val = 2;
        printf("%d", b->val);
        free(b);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("2");
  });

  it("calloc allocates multiple ints", () => {
    const steps = run(`
      int main() {
        int* arr = (int*) calloc(3, sizeof(int));
        arr[0] = 10;
        arr[1] = 20;
        arr[2] = 30;
        printf("%d", arr[1]);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("20");
  });
});

describe("interpreter — nested structs", () => {
  it("accesses nested struct field via arrow on malloc'd outer", () => {
    const steps = run(`
      struct Inner { int x; };
      struct Outer { struct Inner* inner; int y; };
      int main() {
        struct Inner* i = (struct Inner*) malloc(sizeof(struct Inner));
        i->x = 42;
        struct Outer* o = (struct Outer*) malloc(sizeof(struct Outer));
        o->inner = i;
        o->y = 7;
        printf("%d %d", o->inner->x, o->y);
        free(i);
        free(o);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("42 7");
  });
});

describe("interpreter — multiple variable declarations", () => {
  it("declares multiple ints in one statement", () => {
    const steps = run(`
      int main() {
        int a = 1, b = 2, c = 3;
        printf("%d %d %d", a, b, c);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("1 2 3");
  });

  it("declares multiple pointers in one statement", () => {
    const steps = run(`
      int main() {
        int x = 10, y = 20;
        int* p = &x, *q = &y;
        printf("%d", *p + *q);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("30");
  });

  it("declares multiple ints without initializers", () => {
    const steps = run(`
      int main() {
        int i, j;
        i = 5;
        j = 7;
        printf("%d", i + j);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("12");
  });
});

describe("interpreter — enum", () => {
  it("defines and uses enum constants", () => {
    const steps = run(`
      enum Color { RED, GREEN, BLUE };
      int main() {
        int c = GREEN;
        printf("%d", c);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("1");
  });

  it("enum constants start at 0 by default", () => {
    const steps = run(`
      enum Dir { NORTH, SOUTH, EAST, WEST };
      int main() {
        printf("%d %d %d %d", NORTH, SOUTH, EAST, WEST);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("0 1 2 3");
  });

  it("enum supports custom start values", () => {
    const steps = run(`
      enum Status { OK = 0, WARN = 100, ERR = 200 };
      int main() {
        printf("%d %d %d", OK, WARN, ERR);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("0 100 200");
  });

  it("enum works in switch/case", () => {
    const steps = run(`
      enum State { IDLE, RUNNING, STOPPED };
      int main() {
        int s = RUNNING;
        switch (s) {
          case IDLE:    printf("idle"); break;
          case RUNNING: printf("running"); break;
          case STOPPED: printf("stopped"); break;
        }
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("running");
  });

  it("inline enum inside function body", () => {
    const steps = run(`
      int main() {
        enum Fruit { APPLE, BANANA, CHERRY };
        int f = CHERRY;
        printf("%d", f);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("2");
  });
});

describe("interpreter — string builtins", () => {
  it("strlen returns string length", () => {
    const steps = run(`
      int main() {
        char* s = "hello";
        printf("%d", strlen(s));
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("5");
  });

  it("strcmp returns 0 for equal strings", () => {
    const steps = run(`
      int main() {
        char* a = "hello";
        char* b = "hello";
        printf("%d", strcmp(a, b));
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("0");
  });

  it("strcmp returns non-zero for different strings", () => {
    const steps = run(`
      int main() {
        char* a = "abc";
        char* b = "abd";
        int r = strcmp(a, b);
        printf("%d", r < 0 ? -1 : r > 0 ? 1 : 0);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("-1");
  });

  it("puts prints string with newline", () => {
    const steps = run(`
      int main() {
        puts("hi");
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("hi\n");
  });

  it("putchar prints a character", () => {
    const steps = run(`
      int main() {
        putchar(65);
        putchar(66);
        putchar(67);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("ABC");
  });
});

describe("interpreter — pointer arithmetic", () => {
  it("malloc'd int array supports pointer indexing", () => {
    const steps = run(`
      int main() {
        int* p = (int*) malloc(3 * sizeof(int));
        p[0] = 100;
        p[1] = 200;
        p[2] = 300;
        printf("%d", p[2]);
        free(p);
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("300");
  });

  it("pointer + offset accesses correct element", () => {
    const steps = run(`
      int main() {
        int arr[4] = {10, 20, 30, 40};
        int* p = arr;
        printf("%d", *(p + 2));
        return 0;
      }
    `);
    expect(finalOutput(steps)).toBe("30");
  });
});
