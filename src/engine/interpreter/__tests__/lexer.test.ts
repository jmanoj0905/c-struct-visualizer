import { describe, it, expect } from "vitest";
import { tokenize } from "../lexer";

describe("lexer", () => {
  it("lexes C keywords", () => {
    const src = "int main() { return 0; }";
    const tokens = tokenize(src);
    const values = tokens.map(t => t.value);
    expect(values).toContain("int");
    expect(values).toContain("return");
  });

  it("lexes C++ keywords (class, virtual, nullptr, new, delete)", () => {
    const src = "class Foo { virtual void f(); }; int* p = nullptr; new Foo(); delete p;";
    const values = tokenize(src).map(t => t.value);
    for (const kw of ["class", "virtual", "nullptr", "new", "delete"]) {
      expect(values).toContain(kw);
    }
  });

  it("lexes switch/case/default/enum keywords", () => {
    const values = tokenize("switch case default enum").map(t => t.value);
    expect(values).toContain("switch");
    expect(values).toContain("case");
    expect(values).toContain("default");
    expect(values).toContain("enum");
  });

  it("lexes string and char literals with escapes", () => {
    const tokens = tokenize(`"hi\\n" '\\t'`);
    const strTok = tokens.find(t => t.type === "String");
    const charTok = tokens.find(t => t.type === "Char");
    expect(strTok?.value).toBe("hi\n");
    expect(charTok?.value).toBe("\t");
  });

  it("lexes common operators and punctuation", () => {
    const values = tokenize("a += b; c->d; e.f; *p; &x; a[i];").map(t => t.value);
    for (const op of ["+=", "->", ".", "*", "&", "[", "]"]) {
      expect(values).toContain(op);
    }
  });
});
