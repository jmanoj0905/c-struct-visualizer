// Recursive descent parser: Token[] → AST

import type { Token } from "./lexer";
import type {
  ASTNode, ExprNode, CType, ProgramNode, FunctionDefNode, StructDefNode,
  VarDeclNode, BlockNode, ReturnStmtNode, ExprStmtNode, IfStmtNode,
  WhileStmtNode, ForStmtNode, DoWhileStmtNode, BreakStmtNode, ContinueStmtNode,
  SwitchStmtNode, SwitchCaseNode,
  ClassDefNode, ClassSection, FieldDeclNode, MethodDefNode,
} from "./ast";

export class ParseError extends Error {
  line: number;
  column: number;
  constructor(message: string, line: number, column: number) {
    super(`Parse error at ${line}:${column}: ${message}`);
    this.line = line;
    this.column = column;
  }
}

export class Parser {
  private pos = 0;
  private tokens: Token[];
  private knownStructs = new Set<string>();
  private typedefMap = new Map<string, string>(); // alias → original struct name

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    // Pre-scan for struct definitions to know type names
    this.prescanStructNames();
  }

  private prescanStructNames() {
    for (let i = 0; i < this.tokens.length; i++) {
      // Match: struct Name { or struct Name :
      if (this.tokens[i].value === "struct" && this.tokens[i + 1]?.type === "Identifier" &&
          (this.tokens[i + 2]?.value === "{" || this.tokens[i + 2]?.value === ":")) {
        this.knownStructs.add(this.tokens[i + 1].value);
      }
      // Match: class Name { or class Name :
      if (this.tokens[i].value === "class" && this.tokens[i + 1]?.type === "Identifier" &&
          (this.tokens[i + 2]?.value === "{" || this.tokens[i + 2]?.value === ":")) {
        this.knownStructs.add(this.tokens[i + 1].value);
      }
      // Match: typedef struct Name { ... } Alias ;
      // and:   typedef struct { ... } Alias ;
      if (this.tokens[i].value === "typedef" && this.tokens[i + 1]?.value === "struct") {
        let j = i + 2;
        let structName: string | undefined;
        // Optional struct name
        if (this.tokens[j]?.type === "Identifier" && this.tokens[j + 1]?.value === "{") {
          structName = this.tokens[j].value;
          this.knownStructs.add(structName);
          j++; // skip name
        }
        // Find matching }
        if (this.tokens[j]?.value === "{") {
          let braceDepth = 1;
          j++;
          while (j < this.tokens.length && braceDepth > 0) {
            if (this.tokens[j].value === "{") braceDepth++;
            else if (this.tokens[j].value === "}") braceDepth--;
            j++;
          }
          // j is now past }, next token should be the alias identifier
          if (this.tokens[j]?.type === "Identifier") {
            const alias = this.tokens[j].value;
            this.knownStructs.add(alias);
            if (structName) {
              this.typedefMap.set(alias, structName);
            }
          }
        }
      }
    }
  }

  resolveTypeName(name: string): string {
    return this.typedefMap.get(name) ?? name;
  }

  private isKnownType(name: string): boolean {
    return this.knownStructs.has(name);
  }

  private cur(): Token { return this.tokens[this.pos] || this.tokens[this.tokens.length - 1]; }
  private peek(offset = 0): Token { return this.tokens[this.pos + offset] || this.tokens[this.tokens.length - 1]; }
  private advance(): Token { return this.tokens[this.pos++]; }

  private expect(type: string, value?: string): Token {
    const t = this.cur();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new ParseError(`Expected ${value || type}, got '${t.value}'`, t.line, t.column);
    }
    return this.advance();
  }

  private match(type: string, value?: string): boolean {
    const t = this.cur();
    if (t.type === type && (value === undefined || t.value === value)) {
      this.advance();
      return true;
    }
    return false;
  }

  private is(type: string, value?: string): boolean {
    const t = this.cur();
    return t.type === type && (value === undefined || t.value === value);
  }

  parse(): ProgramNode {
    const body: ASTNode[] = [];
    while (!this.is("EOF")) {
      // Skip stray semicolons
      if (this.match("Punct", ";")) continue;
      body.push(this.parseTopLevel());
    }
    return { kind: "Program", body, line: 1, column: 1 };
  }

  private parseTopLevel(): ASTNode {
    // enum definition at top level
    if (this.is("Keyword", "enum")) {
      const saved = this.pos;
      this.advance(); // enum
      if (this.is("Identifier")) this.advance();
      if (this.is("Punct", "{")) {
        this.pos = saved;
        return this.parseEnum();
      }
      this.pos = saved;
      // Otherwise fall through to parseDeclOrFuncDef (variable of enum type)
    }

    // using namespace <name>;  — skip silently
    if (this.is("Keyword", "using")) {
      const { line, column } = this.cur();
      this.advance(); // using
      if (this.is("Keyword", "namespace")) {
        this.advance(); // namespace
        if (this.cur().type === "Identifier" || this.cur().type === "Keyword") this.advance(); // name (e.g. std)
        if (this.is("Punct", ";")) this.advance();
      }
      return { kind: "Block", body: [], line, column } as ASTNode;
    }
    // typedef
    if (this.is("Keyword", "typedef")) {
      return this.parseTypedef();
    }
    // struct definition
    if (this.is("Keyword", "struct") && this.peek(1).type === "Identifier") {
      // Could be: struct Foo { ... }; or struct Foo* var; or struct Foo func(...)
      const saved = this.pos;
      this.advance(); // struct
      this.advance(); // name
      if (this.is("Punct", "{") || this.is("Punct", ":")) {
        this.pos = saved;
        return this.parseStructDef();
      }
      this.pos = saved;
      // It's a variable decl or function def starting with struct type
    }

    // class definition
    if (this.is("Keyword", "class") && this.peek(1).type === "Identifier") {
      return this.parseClassDef();
    }

    // Out-of-class method definition: ClassName::methodName(...)
    if (this.is("Identifier") && this.isKnownType(this.cur().value)) {
      // Check for :: scope resolution (out-of-class method def)
      // Pattern: Type ClassName::MethodName(...) or ClassName::ClassName(...)
      const saved = this.pos;
      // Try to detect ClassName::method pattern
      // Could be: ReturnType ClassName::Method(...) or ClassName::ClassName(...)
      if (this.looksLikeOutOfClassMethod()) {
        this.pos = saved;
        return this.parseOutOfClassMethod();
      }
      this.pos = saved;
      return this.parseDeclOrFuncDef();
    }

    // Check for: ReturnType ClassName::Method (where ReturnType is a keyword like int, void, etc.)
    if (this.looksLikeDeclStart()) {
      const saved = this.pos;
      // Skip return type
      while (this.is("Keyword", "const") || this.is("Keyword", "static") || this.is("Keyword", "virtual")) this.advance();
      this.parseType();
      if (this.is("Identifier") && this.isKnownType(this.cur().value)) {
        if (this.peek(1).value === ":" && this.peek(2).value === ":") {
          this.pos = saved;
          return this.parseOutOfClassMethod();
        }
      }
      this.pos = saved;
    }

    // Function def or global variable
    return this.parseDeclOrFuncDef();
  }

  private looksLikeDeclStart(): boolean {
    const tok = this.cur();
    if (tok.type === "Keyword" && ["int", "float", "double", "char", "void", "long", "short", "unsigned", "signed", "bool", "const", "static", "virtual"].includes(tok.value)) return true;
    return false;
  }

  private looksLikeOutOfClassMethod(): boolean {
    // Check pattern: ClassName::something or skip type then ClassName::something
    const saved = this.pos;
    // ClassName::ClassName(...) - constructor
    // ClassName::~ClassName(...) - destructor
    const name = this.cur().value;
    if (this.isKnownType(name)) {
      this.advance();
      if (this.is("Punct", ":") && this.peek(1).value === ":") {
        this.pos = saved;
        return true;
      }
    }
    this.pos = saved;
    return false;
  }

  private parseTypedef(): ASTNode {
    this.advance(); // typedef
    if (this.is("Keyword", "struct")) {
      const structDef = this.parseStructDef();
      // After struct def, there might be a typedef name
      if (this.is("Identifier")) {
        const alias = this.advance().value; // typedef alias
        this.knownStructs.add(alias);
        this.typedefMap.set(alias, structDef.name);
      }
      this.match("Punct", ";");
      return structDef;
    }
    // Simple typedef: typedef int MyInt; - skip
    while (!this.is("Punct", ";") && !this.is("EOF")) this.advance();
    this.match("Punct", ";");
    return { kind: "Block", body: [], line: this.cur().line, column: this.cur().column };
  }

  private parseStructDef(): StructDefNode | ClassDefNode {
    const { line, column } = this.cur();
    this.expect("Keyword", "struct");
    // Name is optional for anonymous structs (typedef struct { ... } alias;)
    const name = this.is("Identifier") ? this.advance().value : `__anon_struct_${line}_${column}`;
    // Optional inheritance: struct Foo : public Bar
    let baseClass: string | undefined;
    if (this.match("Punct", ":")) {
      if (this.is("Keyword", "public") || this.is("Keyword", "private") || this.is("Keyword", "protected")) {
        this.advance();
      }
      if (this.is("Identifier")) baseClass = this.advance().value;
    }
    this.expect("Punct", "{");

    // Peek ahead to check if body contains constructors, destructors, or methods
    // If so, parse as ClassDefNode (struct = class with default public)
    if (this.structBodyHasMethods(name)) {
      return this.parseStructAsClass(name, baseClass, line, column);
    }

    const fields: { name: string; fieldType: CType }[] = [];
    while (!this.is("Punct", "}") && !this.is("EOF")) {
      // Skip access specifiers in structs
      if ((this.is("Keyword", "public") || this.is("Keyword", "private") || this.is("Keyword", "protected"))
          && this.peek(1).value === ":") {
        this.advance(); this.advance();
        continue;
      }
      const fieldType = this.parseType();
      const fieldName = this.expect("Identifier").value;
      // Check for array
      if (this.match("Punct", "[")) {
        const sizeToken = this.expect("Number");
        fieldType.arraySize = parseInt(sizeToken.value);
        this.expect("Punct", "]");
      }
      fields.push({ name: fieldName, fieldType });
      this.expect("Punct", ";");
    }
    this.expect("Punct", "}");
    this.match("Punct", ";");
    return { kind: "StructDef", name, fields, line, column };
  }

  /**
   * Check if the struct body contains constructors, destructors, or methods.
   * This is a lookahead scan that doesn't consume tokens.
   */
  private structBodyHasMethods(structName: string): boolean {
    const saved = this.pos;
    let braceDepth = 1;
    while (braceDepth > 0 && !this.is("EOF")) {
      const tok = this.cur();
      if (tok.value === "{") braceDepth++;
      else if (tok.value === "}") {
        braceDepth--;
        if (braceDepth === 0) break;
      }
      // Constructor: StructName(
      if (braceDepth === 1 && tok.type === "Identifier" && tok.value === structName && this.peek(1).value === "(") {
        this.pos = saved;
        return true;
      }
      // Destructor: ~StructName(
      if (braceDepth === 1 && tok.value === "~") {
        this.pos = saved;
        return true;
      }
      // Method: type name( where name is followed by (
      // Detect by finding identifier followed by ( that's not a field declaration
      if (braceDepth === 1 && tok.type === "Identifier" && tok.value !== structName) {
        // Look for pattern: ... name( which indicates a method
        if (this.peek(1).value === "(") {
          // Could be a method if previous token(s) form a type
          this.pos = saved;
          return true;
        }
      }
      this.advance();
    }
    this.pos = saved;
    return false;
  }

  /**
   * Parse a struct body as a ClassDefNode (struct = class with default public access).
   * Called after '{' has been consumed.
   */
  private parseStructAsClass(name: string, baseClass: string | undefined, line: number, column: number): ClassDefNode {
    const sections: ClassSection[] = [];
    let currentAccess: "public" | "private" | "protected" = "public"; // struct default is public
    let currentMembers: (FieldDeclNode | MethodDefNode)[] = [];

    while (!this.is("Punct", "}") && !this.is("EOF")) {
      // Check for access specifier
      if ((this.is("Keyword", "public") || this.is("Keyword", "private") || this.is("Keyword", "protected"))
          && this.peek(1).value === ":") {
        if (currentMembers.length > 0) {
          sections.push({ access: currentAccess, members: currentMembers });
          currentMembers = [];
        }
        currentAccess = this.advance().value as "public" | "private" | "protected";
        this.advance(); // skip :
        continue;
      }

      if (this.match("Punct", ";")) continue;

      const member = this.parseClassMember(name);
      if (member) {
        currentMembers.push(member);
      }
    }

    if (currentMembers.length > 0) {
      sections.push({ access: currentAccess, members: currentMembers });
    }

    this.expect("Punct", "}");
    this.match("Punct", ";");

    return { kind: "ClassDef", name, baseClass, sections, line, column };
  }

  private parseClassDef(): ClassDefNode {
    const { line, column } = this.cur();
    this.expect("Keyword", "class");
    const name = this.expect("Identifier").value;

    // Optional inheritance: class Foo : public Bar
    let baseClass: string | undefined;
    if (this.match("Punct", ":")) {
      // Parse access specifier (public/private/protected)
      if (this.is("Keyword", "public") || this.is("Keyword", "private") || this.is("Keyword", "protected")) {
        this.advance();
      }
      baseClass = this.expect("Identifier").value;
    }

    this.expect("Punct", "{");

    const sections: ClassSection[] = [];
    let currentAccess: "public" | "private" | "protected" = "private"; // class default
    let currentMembers: (FieldDeclNode | MethodDefNode)[] = [];

    while (!this.is("Punct", "}") && !this.is("EOF")) {
      // Check for access specifier: public:, private:, protected:
      if ((this.is("Keyword", "public") || this.is("Keyword", "private") || this.is("Keyword", "protected"))
          && this.peek(1).value === ":") {
        // Save current section if it has members
        if (currentMembers.length > 0) {
          sections.push({ access: currentAccess, members: currentMembers });
          currentMembers = [];
        }
        currentAccess = this.advance().value as "public" | "private" | "protected";
        this.advance(); // skip :
        continue;
      }

      // Skip stray semicolons
      if (this.match("Punct", ";")) continue;

      // Parse member: could be field or method
      const member = this.parseClassMember(name);
      if (member) {
        currentMembers.push(member);
      }
    }

    // Save last section
    if (currentMembers.length > 0) {
      sections.push({ access: currentAccess, members: currentMembers });
    }

    this.expect("Punct", "}");
    this.match("Punct", ";");

    return { kind: "ClassDef", name, baseClass, sections, line, column };
  }

  private parseClassMember(className: string): FieldDeclNode | MethodDefNode | null {
    const { line, column } = this.cur();
    let isVirtual = false;
    // Collect qualifiers
    while (this.is("Keyword", "virtual") || this.is("Keyword", "static")) {
      if (this.cur().value === "virtual") isVirtual = true;
      this.advance();
    }

    // Destructor: ~ClassName()
    if (this.is("Punct", "~")) {
      this.advance();
      const destructorName = this.expect("Identifier").value;
      this.expect("Punct", "(");
      this.expect("Punct", ")");

      let body: BlockNode | null = null;
      const isPureVirtual = this.match("Punct", "=") && this.match("Number"); // = 0
      if (this.is("Punct", "{")) {
        body = this.parseBlock();
      } else {
        this.match("Punct", ";");
      }

      return {
        kind: "MethodDef",
        className,
        name: `~${destructorName}`,
        returnType: { base: "void", pointerLevel: 0, isStruct: false },
        params: [],
        body,
        isVirtual,
        isConst: false,
        isConstructor: false,
        isDestructor: true,
        isPureVirtual,
        line,
        column,
      };
    }

    // Constructor: ClassName(params) [: initList] { body }
    if (this.is("Identifier") && this.cur().value === className && this.peek(1).value === "(") {
      this.advance(); // class name
      this.expect("Punct", "(");
      const params = this.parseParamList();
      this.expect("Punct", ")");

      // Initializer list: : field1(val1), field2(val2)
      let initializerList: { field: string; value: ExprNode }[] | undefined;
      if (this.match("Punct", ":")) {
        initializerList = this.parseInitializerList();
      }

      let body: BlockNode | null = null;
      if (this.is("Punct", "{")) {
        body = this.parseBlock();
      } else {
        this.match("Punct", ";");
      }

      return {
        kind: "MethodDef",
        className,
        name: className,
        returnType: { base: "void", pointerLevel: 0, isStruct: false },
        params,
        body,
        isVirtual: false,
        isConst: false,
        isConstructor: true,
        isDestructor: false,
        isPureVirtual: false,
        initializerList,
        line,
        column,
      };
    }

    // Field or method: type name ...
    const memberType = this.parseType();
    const memberName = this.expect("Identifier").value;

    // Method: type name(params)
    if (this.is("Punct", "(")) {
      this.advance();
      const params = this.parseParamList();
      this.expect("Punct", ")");

      const isConst = this.match("Keyword", "const");
      // Check for override/final
      this.match("Keyword", "override");
      this.match("Keyword", "final");

      let isPureVirtual = false;
      if (this.is("Punct", "=") && this.peek(1).value === "0") {
        this.advance(); this.advance(); // = 0
        isPureVirtual = true;
      }

      let body: BlockNode | null = null;
      if (this.is("Punct", "{")) {
        body = this.parseBlock();
      } else {
        this.match("Punct", ";");
      }

      return {
        kind: "MethodDef",
        className,
        name: memberName,
        returnType: memberType,
        params,
        body,
        isVirtual: isVirtual || isPureVirtual,
        isConst,
        isConstructor: false,
        isDestructor: false,
        isPureVirtual,
        line,
        column,
      };
    }

    // Field: type name [arraySize];
    if (this.match("Punct", "[")) {
      if (this.is("Number")) {
        memberType.arraySize = parseInt(this.advance().value);
      }
      this.expect("Punct", "]");
    }
    this.expect("Punct", ";");
    return { kind: "FieldDecl", name: memberName, fieldType: memberType, line, column };
  }

  private parseParamList(): { name: string; paramType: CType }[] {
    const params: { name: string; paramType: CType }[] = [];
    while (!this.is("Punct", ")") && !this.is("EOF")) {
      if (params.length > 0) this.expect("Punct", ",");
      if (this.is("Keyword", "void") && this.peek(1).value === ")") {
        this.advance();
        continue;
      }
      const pType = this.parseType();
      const pName = this.is("Identifier") ? this.advance().value : `_p${params.length}`;
      // Array parameter: int arr[]
      if (this.match("Punct", "[")) {
        pType.pointerLevel++;
        this.match("Punct", "]");
      }
      params.push({ name: pName, paramType: pType });
    }
    return params;
  }

  private parseInitializerList(): { field: string; value: ExprNode }[] {
    const inits: { field: string; value: ExprNode }[] = [];
    do {
      const field = this.expect("Identifier").value;
      this.expect("Punct", "(");
      const value = this.parseExpr();
      this.expect("Punct", ")");
      inits.push({ field, value });
    } while (this.match("Punct", ",") && !this.is("Punct", "{") && !this.is("EOF"));
    return inits;
  }

  private parseOutOfClassMethod(): ASTNode {
    const { line, column } = this.cur();
    let isVirtual = false;

    // Collect qualifiers
    while (this.is("Keyword", "virtual") || this.is("Keyword", "static")) {
      if (this.cur().value === "virtual") isVirtual = true;
      this.advance();
    }

    // Could be: ReturnType ClassName::method or ClassName::ClassName (constructor) or ClassName::~ClassName (destructor)
    let returnType: CType | null = null;
    let className: string;

    // Check if first identifier is a class name followed by ::
    if (this.is("Identifier") && this.isKnownType(this.cur().value) && this.peek(1).value === ":" && this.peek(2).value === ":") {
      // No explicit return type — constructor or destructor
      className = this.advance().value;
      this.advance(); this.advance(); // skip ::
    } else {
      // Has return type
      returnType = this.parseType();
      className = this.expect("Identifier").value;
      this.expect("Punct", ":"); // first :
      this.expect("Punct", ":"); // second :
    }

    // Destructor: ~ClassName
    if (this.is("Punct", "~")) {
      this.advance();
      const destructorName = this.expect("Identifier").value;
      this.expect("Punct", "(");
      this.expect("Punct", ")");

      let body: BlockNode | null = null;
      if (this.is("Punct", "{")) {
        body = this.parseBlock();
      } else {
        this.match("Punct", ";");
      }

      return {
        kind: "MethodDef",
        className,
        name: `~${destructorName}`,
        returnType: { base: "void", pointerLevel: 0, isStruct: false },
        params: [],
        body,
        isVirtual,
        isConst: false,
        isConstructor: false,
        isDestructor: true,
        isPureVirtual: false,
        line,
        column,
      };
    }

    const methodName = this.expect("Identifier").value;
    this.expect("Punct", "(");
    const params = this.parseParamList();
    this.expect("Punct", ")");

    const isConst = this.match("Keyword", "const");

    // Constructor check
    const isConstructor = methodName === className && returnType === null;

    // Initializer list (for constructors)
    let initializerList: { field: string; value: ExprNode }[] | undefined;
    if (isConstructor && this.is("Punct", ":") && !this.isPeek("::")) {
      this.advance(); // skip :
      initializerList = this.parseInitializerList();
    }

    let body: BlockNode | null = null;
    if (this.is("Punct", "{")) {
      body = this.parseBlock();
    } else {
      this.match("Punct", ";");
    }

    return {
      kind: "MethodDef",
      className,
      name: methodName,
      returnType: returnType || { base: "void", pointerLevel: 0, isStruct: false },
      params,
      body,
      isVirtual,
      isConst,
      isConstructor,
      isDestructor: false,
      isPureVirtual: false,
      initializerList,
      line,
      column,
    };
  }

  private parseDeclOrFuncDef(): ASTNode {
    const { line, column } = this.cur();
    // Skip const/static
    while (this.is("Keyword", "const") || this.is("Keyword", "static")) this.advance();
    const baseType = this.parseType();
    const name = this.expect("Identifier").value;

    // Function definition
    if (this.is("Punct", "(")) {
      return this.parseFunctionDef(baseType, name, line, column);
    }

    // First declarator (name already consumed above)
    const firstType = { ...baseType };
    if (this.match("Punct", "[")) {
      if (this.is("Number")) firstType.arraySize = parseInt(this.advance().value);
      this.expect("Punct", "]");
    }
    let firstInit: ExprNode | undefined;
    if (this.match("Punct", "=")) {
      firstInit = this.is("Punct", "{") ? this.parseArrayInitializer(line, column) : this.parseExpr();
    }
    const decls: VarDeclNode[] = [{ kind: "VarDecl", name, varType: firstType, init: firstInit, line, column }];

    // Additional declarators separated by comma
    while (this.match("Punct", ",")) {
      const t = { ...baseType };
      while (this.is("Punct", "*")) { t.pointerLevel++; this.advance(); }
      decls.push(this.parseSingleDeclarator(t, line, column));
    }

    this.expect("Punct", ";");
    if (decls.length === 1) return decls[0];
    return { kind: "Block", body: decls, line, column };
  }

  private parseArrayInitializer(line: number, column: number): ExprNode {
    // Parse { val1, val2, ... } as a special CallExpr with callee "__array_init"
    this.expect("Punct", "{");
    const elements: ExprNode[] = [];
    while (!this.is("Punct", "}") && !this.is("EOF")) {
      elements.push(this.parseAssignExpr());
      if (!this.match("Punct", ",")) break;
    }
    this.expect("Punct", "}");
    return { kind: "CallExpr", callee: "__array_init", args: elements, line, column };
  }

  private parseFunctionDef(returnType: CType, name: string, line: number, column: number): FunctionDefNode {
    this.expect("Punct", "(");
    const params: { name: string; type: CType }[] = [];
    while (!this.is("Punct", ")") && !this.is("EOF")) {
      if (params.length > 0) this.expect("Punct", ",");
      // Handle void parameter
      if (this.is("Keyword", "void") && this.peek(1).type !== "Punct") {
        this.advance();
        continue;
      }
      const pType = this.parseType();
      const pName = this.is("Identifier") ? this.advance().value : `_p${params.length}`;
      // Array parameter: int arr[]
      if (this.match("Punct", "[")) {
        pType.pointerLevel++;
        this.match("Punct", "]");
      }
      params.push({ name: pName, type: pType });
    }
    this.expect("Punct", ")");

    // Forward declaration
    if (this.match("Punct", ";")) {
      return { kind: "FunctionDef", name, returnType, params, body: { kind: "Block", body: [], line, column }, line, column };
    }

    const body = this.parseBlock();
    return { kind: "FunctionDef", name, returnType, params, body, line, column };
  }

  private parseType(): CType {
    let isStruct = false;
    let isConst = false;
    let base = "";
    // Skip const/unsigned/signed
    while (this.is("Keyword", "const") || this.is("Keyword", "unsigned") || this.is("Keyword", "signed")) {
      if (this.cur().value === "const") isConst = true;
      this.advance();
    }
    if (this.is("Keyword", "enum")) {
      this.advance(); // enum
      if (this.is("Identifier")) this.advance(); // optional name
      // Inline anonymous body — skip it
      if (this.is("Punct", "{")) {
        let depth = 1;
        this.advance(); // {
        while (depth > 0 && !this.is("EOF")) {
          if (this.cur().value === "{") depth++;
          else if (this.cur().value === "}") depth--;
          this.advance();
        }
      }
      base = "int"; // enum treated as int at runtime
    } else if (this.is("Keyword", "struct")) {
      this.advance();
      isStruct = true;
      base = this.expect("Identifier").value;
    } else if (this.is("Keyword") && ["int", "float", "double", "char", "void", "long", "short", "bool"].includes(this.cur().value)) {
      base = this.advance().value;
      // Handle "long long", "long int", etc.
      if (base === "long" && this.is("Keyword") && (this.cur().value === "long" || this.cur().value === "int")) {
        this.advance();
      }
    } else if (this.is("Identifier")) {
      // Could be a typedef name or class name - treat as base type
      base = this.resolveTypeName(this.advance().value);
      isStruct = true; // Assume typedef'd struct or class
    } else {
      base = "int"; // Default
    }
    let pointerLevel = 0;
    while (this.is("Punct", "*")) { this.advance(); pointerLevel++; }
    // Check for reference type: &
    let isReference = false;
    if (this.is("Punct", "&")) {
      this.advance();
      isReference = true;
    }
    const type: CType = { base, pointerLevel, isStruct: isStruct && pointerLevel === 0 ? true : isStruct };
    if (isReference) type.isReference = true;
    if (isConst) type.isConst = true;
    return type;
  }

  private parseBlock(): BlockNode {
    const { line, column } = this.cur();
    this.expect("Punct", "{");
    const body: ASTNode[] = [];
    while (!this.is("Punct", "}") && !this.is("EOF")) {
      if (this.match("Punct", ";")) continue;
      body.push(this.parseStatement());
    }
    this.expect("Punct", "}");
    return { kind: "Block", body, line, column };
  }

  private parseStatement(): ASTNode {
    const { line, column } = this.cur();

    if (this.is("Punct", "{")) return this.parseBlock();
    if (this.is("Keyword", "if")) return this.parseIf();
    if (this.is("Keyword", "while")) return this.parseWhile();
    if (this.is("Keyword", "for")) return this.parseFor();
    if (this.is("Keyword", "do")) return this.parseDoWhile();
    if (this.is("Keyword", "switch")) return this.parseSwitch();
    if (this.is("Keyword", "return")) return this.parseReturn();
    if (this.is("Keyword", "break")) { this.advance(); this.expect("Punct", ";"); return { kind: "BreakStmt", line, column } as BreakStmtNode; }
    if (this.is("Keyword", "continue")) { this.advance(); this.expect("Punct", ";"); return { kind: "ContinueStmt", line, column } as ContinueStmtNode; }

    // Inline enum definition inside a function body
    if (this.is("Keyword", "enum")) {
      const saved = this.pos;
      this.advance(); // enum
      if (this.is("Identifier")) this.advance();
      if (this.is("Punct", "{")) {
        this.pos = saved;
        return this.parseEnum();
      }
      this.pos = saved;
    }

    // Local variable declaration? Check if it starts with a type
    if (this.looksLikeDecl()) {
      return this.parseLocalDecl();
    }

    // Expression statement
    const expr = this.parseExpr();
    this.expect("Punct", ";");
    return { kind: "ExprStmt", expr, line, column } as ExprStmtNode;
  }

  private looksLikeDecl(): boolean {
    // Skip const/static
    let offset = 0;
    while (this.peek(offset).type === "Keyword" && (this.peek(offset).value === "const" || this.peek(offset).value === "static")) offset++;

    const tok = this.peek(offset);
    if (tok.type === "Keyword" && ["int", "float", "double", "char", "void", "long", "short", "unsigned", "signed", "bool"].includes(tok.value)) return true;
    if (tok.type === "Keyword" && (tok.value === "struct" || tok.value === "class" || tok.value === "enum")) return true;
    // Typedef'd struct name used as type (e.g., Node* head)
    if (tok.type === "Identifier" && this.isKnownType(tok.value)) {
      // Make sure the next token after the name (and optional *) is an identifier (the var name)
      let off2 = offset + 1;
      while (this.peek(off2).value === "*") off2++;
      if (this.peek(off2).type === "Identifier") return true;
    }
    return false;
  }

  private parseSingleDeclarator(baseType: CType, line: number, column: number): VarDeclNode {
    const type = { ...baseType };
    const name = this.expect("Identifier").value;
    if (this.match("Punct", "[")) {
      if (this.is("Number")) type.arraySize = parseInt(this.advance().value);
      this.expect("Punct", "]");
    }
    let init: ExprNode | undefined;
    if (this.match("Punct", "=")) {
      init = this.is("Punct", "{") ? this.parseArrayInitializer(line, column) : this.parseExpr();
    }
    return { kind: "VarDecl", name, varType: type, init, line, column };
  }

  private parseLocalDecl(): ASTNode {
    const { line, column } = this.cur();
    while (this.is("Keyword", "const") || this.is("Keyword", "static")) this.advance();

    // Inline enum definition: enum Color { RED, GREEN } — emit constants as VarDecls
    if (this.is("Keyword", "enum")) {
      const saved = this.pos;
      this.advance(); // enum
      if (this.is("Identifier")) this.advance();
      if (this.is("Punct", "{")) {
        this.pos = saved;
        return this.parseEnum();
      }
      this.pos = saved;
    }

    const baseType = this.parseType();
    const decls: VarDeclNode[] = [this.parseSingleDeclarator(baseType, line, column)];

    while (this.match("Punct", ",")) {
      const t = { ...baseType };
      while (this.is("Punct", "*")) { t.pointerLevel++; this.advance(); }
      decls.push(this.parseSingleDeclarator(t, line, column));
    }

    this.expect("Punct", ";");
    if (decls.length === 1) return decls[0];
    return { kind: "Block", body: decls, line, column };
  }

  private parseEnum(): ASTNode {
    const { line, column } = this.cur();
    this.advance(); // enum
    if (this.is("Identifier")) this.advance(); // optional name

    // Forward declaration: enum Foo; — skip
    if (!this.is("Punct", "{")) {
      this.match("Punct", ";");
      return { kind: "Block", body: [], line, column };
    }

    this.expect("Punct", "{");
    const decls: VarDeclNode[] = [];
    let nextValue = 0;

    while (!this.is("Punct", "}") && !this.is("EOF")) {
      if (this.match("Punct", ",")) continue;
      if (!this.is("Identifier")) { this.advance(); continue; }
      const constName = this.advance().value;
      let value = nextValue;
      if (this.match("Punct", "=")) {
        const valExpr = this.parseAssignExpr();
        if (valExpr.kind === "NumberLit") value = valExpr.value;
      }
      nextValue = value + 1;
      decls.push({
        kind: "VarDecl",
        name: constName,
        varType: { base: "int", pointerLevel: 0, isStruct: false },
        init: { kind: "NumberLit", value, isFloat: false, line, column },
        line,
        column,
      });
    }

    this.expect("Punct", "}");
    this.match("Punct", ";");

    if (decls.length === 0) return { kind: "Block", body: [], line, column };
    if (decls.length === 1) return decls[0];
    return { kind: "Block", body: decls, line, column };
  }

  private parseIf(): IfStmtNode {
    const { line, column } = this.cur();
    this.advance(); // if
    this.expect("Punct", "(");
    const condition = this.parseExpr();
    this.expect("Punct", ")");
    const then = this.parseStatement();
    let else_: ASTNode | undefined;
    if (this.match("Keyword", "else")) {
      else_ = this.parseStatement();
    }
    return { kind: "IfStmt", condition, then, else_, line, column };
  }

  private parseWhile(): WhileStmtNode {
    const { line, column } = this.cur();
    this.advance(); // while
    this.expect("Punct", "(");
    const condition = this.parseExpr();
    this.expect("Punct", ")");
    const body = this.parseStatement();
    return { kind: "WhileStmt", condition, body, line, column };
  }

  private parseFor(): ForStmtNode {
    const { line, column } = this.cur();
    this.advance(); // for
    this.expect("Punct", "(");

    let init: ASTNode | undefined;
    if (!this.is("Punct", ";")) {
      if (this.looksLikeDecl()) {
        init = this.parseLocalDecl(); // includes ;
      } else {
        const expr = this.parseExpr();
        this.expect("Punct", ";");
        init = { kind: "ExprStmt", expr, line: expr.line, column: expr.column } as ExprStmtNode;
      }
    } else {
      this.advance(); // ;
    }

    let condition: ExprNode | undefined;
    if (!this.is("Punct", ";")) condition = this.parseExpr();
    this.expect("Punct", ";");

    let update: ExprNode | undefined;
    if (!this.is("Punct", ")")) update = this.parseExpr();
    this.expect("Punct", ")");

    const body = this.parseStatement();
    return { kind: "ForStmt", init, condition, update, body, line, column };
  }

  private parseDoWhile(): DoWhileStmtNode {
    const { line, column } = this.cur();
    this.advance(); // do
    const body = this.parseStatement();
    this.expect("Keyword", "while");
    this.expect("Punct", "(");
    const condition = this.parseExpr();
    this.expect("Punct", ")");
    this.expect("Punct", ";");
    return { kind: "DoWhileStmt", body, condition, line, column };
  }

  private parseSwitch(): SwitchStmtNode {
    const { line, column } = this.cur();
    this.advance(); // switch
    this.expect("Punct", "(");
    const discriminant = this.parseExpr();
    this.expect("Punct", ")");
    this.expect("Punct", "{");

    const cases: SwitchCaseNode[] = [];

    while (!this.is("Punct", "}") && !this.is("EOF")) {
      if (this.is("Keyword", "case")) {
        this.advance(); // case
        const test = this.parseExpr();
        this.expect("Punct", ":");
        const body: ASTNode[] = [];
        while (!this.is("Keyword", "case") && !this.is("Keyword", "default") && !this.is("Punct", "}") && !this.is("EOF")) {
          if (this.match("Punct", ";")) continue;
          body.push(this.parseStatement());
        }
        cases.push({ test, body });
      } else if (this.is("Keyword", "default")) {
        this.advance(); // default
        this.expect("Punct", ":");
        const body: ASTNode[] = [];
        while (!this.is("Keyword", "case") && !this.is("Keyword", "default") && !this.is("Punct", "}") && !this.is("EOF")) {
          if (this.match("Punct", ";")) continue;
          body.push(this.parseStatement());
        }
        cases.push({ test: null, body });
      } else {
        this.advance(); // skip unexpected token
      }
    }

    this.expect("Punct", "}");
    return { kind: "SwitchStmt", discriminant, cases, line, column };
  }

  private parseReturn(): ReturnStmtNode {
    const { line, column } = this.cur();
    this.advance(); // return
    let value: ExprNode | undefined;
    if (!this.is("Punct", ";")) value = this.parseExpr();
    this.expect("Punct", ";");
    return { kind: "ReturnStmt", value, line, column };
  }

  // --- Expression parsing with precedence ---

  private parseExpr(): ExprNode {
    return this.parseCommaExpr();
  }

  private parseCommaExpr(): ExprNode {
    // For simplicity, comma expressions are not supported (except in for-loops and function args)
    return this.parseAssignExpr();
  }

  parseAssignExpr(): ExprNode {
    const left = this.parseTernary();

    if (this.is("Punct", "=")) {
      const { line, column } = this.advance();
      const value = this.parseAssignExpr();
      return { kind: "AssignExpr", target: left, value, line, column };
    }

    const compoundOps = ["+=", "-=", "*=", "/=", "%="];
    for (const op of compoundOps) {
      if (this.is("Punct", op)) {
        const { line, column } = this.advance();
        const value = this.parseAssignExpr();
        return { kind: "CompoundAssignExpr", op, target: left, value, line, column };
      }
    }

    return left;
  }

  private parseTernary(): ExprNode {
    const cond = this.parseLogicalOr();
    if (this.match("Punct", "?")) {
      const then = this.parseAssignExpr();
      this.expect("Punct", ":");
      const else_ = this.parseAssignExpr();
      return { kind: "TernaryExpr", condition: cond, then, else_, line: cond.line, column: cond.column };
    }
    return cond;
  }

  private parseLogicalOr(): ExprNode {
    let left = this.parseLogicalAnd();
    while (this.is("Punct", "||")) {
      const { line, column } = this.advance();
      const right = this.parseLogicalAnd();
      left = { kind: "BinaryExpr", op: "||", left, right, line, column };
    }
    return left;
  }

  private parseLogicalAnd(): ExprNode {
    let left = this.parseBitwiseOr();
    while (this.is("Punct", "&&")) {
      const { line, column } = this.advance();
      const right = this.parseBitwiseOr();
      left = { kind: "BinaryExpr", op: "&&", left, right, line, column };
    }
    return left;
  }

  private parseBitwiseOr(): ExprNode {
    let left = this.parseBitwiseXor();
    while (this.is("Punct", "|") && !this.isPeek("||")) {
      const { line, column } = this.advance();
      left = { kind: "BinaryExpr", op: "|", left, right: this.parseBitwiseXor(), line, column };
    }
    return left;
  }

  private parseBitwiseXor(): ExprNode {
    let left = this.parseBitwiseAnd();
    while (this.is("Punct", "^")) {
      const { line, column } = this.advance();
      left = { kind: "BinaryExpr", op: "^", left, right: this.parseBitwiseAnd(), line, column };
    }
    return left;
  }

  private parseBitwiseAnd(): ExprNode {
    let left = this.parseEquality();
    while (this.is("Punct", "&") && !this.isPeek("&&")) {
      const { line, column } = this.advance();
      left = { kind: "BinaryExpr", op: "&", left, right: this.parseEquality(), line, column };
    }
    return left;
  }

  private isPeek(val: string): boolean {
    // Check if current + next char form the given multi-char token
    return this.cur().value === val;
  }

  private parseEquality(): ExprNode {
    let left = this.parseRelational();
    while (this.is("Punct", "==") || this.is("Punct", "!=")) {
      const { value: op, line, column } = this.advance();
      left = { kind: "BinaryExpr", op, left, right: this.parseRelational(), line, column };
    }
    return left;
  }

  private parseRelational(): ExprNode {
    let left = this.parseShift();
    while (this.is("Punct", "<") || this.is("Punct", ">") || this.is("Punct", "<=") || this.is("Punct", ">=")) {
      const { value: op, line, column } = this.advance();
      left = { kind: "BinaryExpr", op, left, right: this.parseShift(), line, column };
    }
    return left;
  }

  private parseShift(): ExprNode {
    let left = this.parseAdditive();
    while (this.is("Punct", "<<") || this.is("Punct", ">>")) {
      const { value: op, line, column } = this.advance();
      left = { kind: "BinaryExpr", op, left, right: this.parseAdditive(), line, column };
    }
    return left;
  }

  private parseAdditive(): ExprNode {
    let left = this.parseMultiplicative();
    while (this.is("Punct", "+") || this.is("Punct", "-")) {
      // Make sure it's not ++ or --
      if (this.cur().value === "++" || this.cur().value === "--") break;
      const { value: op, line, column } = this.advance();
      left = { kind: "BinaryExpr", op, left, right: this.parseMultiplicative(), line, column };
    }
    return left;
  }

  private parseMultiplicative(): ExprNode {
    let left = this.parseUnary();
    while (this.is("Punct", "*") || this.is("Punct", "/") || this.is("Punct", "%")) {
      const { value: op, line, column } = this.advance();
      left = { kind: "BinaryExpr", op, left, right: this.parseUnary(), line, column };
    }
    return left;
  }

  private parseUnary(): ExprNode {
    const { line, column } = this.cur();

    // Pre-increment/decrement
    if (this.is("Punct", "++")) { this.advance(); return { kind: "PreIncDec", op: "++", operand: this.parseUnary(), line, column }; }
    if (this.is("Punct", "--")) { this.advance(); return { kind: "PreIncDec", op: "--", operand: this.parseUnary(), line, column }; }

    // Dereference
    if (this.is("Punct", "*")) {
      this.advance();
      return { kind: "DerefExpr", operand: this.parseUnary(), line, column };
    }

    // Address-of
    if (this.is("Punct", "&")) {
      this.advance();
      return { kind: "AddrOfExpr", operand: this.parseUnary(), line, column };
    }

    // Negation
    if (this.is("Punct", "-")) {
      this.advance();
      return { kind: "UnaryExpr", op: "-", operand: this.parseUnary(), line, column };
    }
    if (this.is("Punct", "!")) {
      this.advance();
      return { kind: "UnaryExpr", op: "!", operand: this.parseUnary(), line, column };
    }
    if (this.is("Punct", "~")) {
      this.advance();
      return { kind: "UnaryExpr", op: "~", operand: this.parseUnary(), line, column };
    }

    // sizeof
    if (this.is("Keyword", "sizeof")) {
      this.advance();
      this.expect("Punct", "(");
      const t = this.parseType();
      this.expect("Punct", ")");
      return { kind: "SizeofExpr", targetType: t, line, column };
    }

    // Cast: (type)expr — need to distinguish from parenthesized expression
    if (this.is("Punct", "(") && this.looksLikeCast()) {
      this.advance(); // (
      const t = this.parseType();
      this.expect("Punct", ")");
      const operand = this.parseUnary();
      return { kind: "CastExpr", targetType: t, operand, line, column };
    }

    return this.parsePostfix();
  }

  private looksLikeCast(): boolean {
    // Save position and try to parse a type after (
    const saved = this.pos;
    this.advance(); // skip (
    const tok = this.cur();
    this.pos = saved;

    if (tok.type === "Keyword" && ["int", "float", "double", "char", "void", "long", "short", "unsigned", "signed", "struct", "const", "bool"].includes(tok.value)) {
      return true;
    }
    if (tok.type === "Identifier" && this.isKnownType(tok.value)) return true;
    return false;
  }

  private parsePostfix(): ExprNode {
    let expr = this.parsePrimary();

    while (true) {
      const { line, column } = this.cur();
      if (this.is("Punct", "->")) {
        this.advance();
        const field = this.expect("Identifier").value;
        // Method call: ptr->method(args)
        if (this.is("Punct", "(")) {
          this.advance();
          const args: ExprNode[] = [];
          while (!this.is("Punct", ")") && !this.is("EOF")) {
            if (args.length > 0) this.expect("Punct", ",");
            args.push(this.parseAssignExpr());
          }
          this.expect("Punct", ")");
          // Encode as CallExpr with object as first arg, callee as __method_arrow_<name>
          expr = { kind: "CallExpr", callee: `__method_arrow_${field}`, args: [expr, ...args], line, column };
        } else {
          expr = { kind: "ArrowExpr", object: expr, field, line, column };
        }
      } else if (this.is("Punct", ".")) {
        this.advance();
        const field = this.expect("Identifier").value;
        // Method call: obj.method(args)
        if (this.is("Punct", "(")) {
          this.advance();
          const args: ExprNode[] = [];
          while (!this.is("Punct", ")") && !this.is("EOF")) {
            if (args.length > 0) this.expect("Punct", ",");
            args.push(this.parseAssignExpr());
          }
          this.expect("Punct", ")");
          expr = { kind: "CallExpr", callee: `__method_dot_${field}`, args: [expr, ...args], line, column };
        } else {
          expr = { kind: "MemberExpr", object: expr, field, line, column };
        }
      } else if (this.is("Punct", "[")) {
        this.advance();
        const index = this.parseExpr();
        this.expect("Punct", "]");
        expr = { kind: "ArrayAccess", object: expr, index, line, column };
      } else if (this.is("Punct", "++")) {
        this.advance();
        expr = { kind: "PostIncDec", op: "++", operand: expr, line, column };
      } else if (this.is("Punct", "--")) {
        this.advance();
        expr = { kind: "PostIncDec", op: "--", operand: expr, line, column };
      } else {
        break;
      }
    }

    return expr;
  }

  private parsePrimary(): ExprNode {
    const { line, column } = this.cur();

    // Number
    if (this.is("Number")) {
      const val = this.advance().value;
      const isFloat = val.includes(".");
      return { kind: "NumberLit", value: Number(val), isFloat, line, column };
    }

    // String
    if (this.is("String")) {
      return { kind: "StringLit", value: this.advance().value, line, column };
    }

    // Char
    if (this.is("Char")) {
      return { kind: "CharLit", value: this.advance().value, line, column };
    }

    // NULL / nullptr
    if (this.is("Keyword", "NULL") || this.is("Keyword", "nullptr")) {
      this.advance();
      return { kind: "NullLit", line, column };
    }

    // Boolean literals
    if (this.is("Keyword", "true")) {
      this.advance();
      return { kind: "NumberLit", value: 1, isFloat: false, line, column };
    }
    if (this.is("Keyword", "false")) {
      this.advance();
      return { kind: "NumberLit", value: 0, isFloat: false, line, column };
    }

    // this pointer
    if (this.is("Keyword", "this")) {
      this.advance();
      return { kind: "Identifier", name: "this", line, column };
    }

    // new expression: new ClassName(args)
    if (this.is("Keyword", "new")) {
      this.advance();
      const typeName = this.expect("Identifier").value;
      const args: ExprNode[] = [];
      if (this.match("Punct", "(")) {
        while (!this.is("Punct", ")") && !this.is("EOF")) {
          if (args.length > 0) this.expect("Punct", ",");
          args.push(this.parseAssignExpr());
        }
        this.expect("Punct", ")");
      }
      return { kind: "CallExpr", callee: `__new_${typeName}`, args, line, column };
    }

    // delete expression: delete ptr
    if (this.is("Keyword", "delete")) {
      this.advance();
      const operand = this.parseUnary();
      return { kind: "CallExpr", callee: "__delete", args: [operand], line, column };
    }

    // Parenthesized expression
    if (this.is("Punct", "(")) {
      this.advance();
      const expr = this.parseExpr();
      this.expect("Punct", ")");
      return expr;
    }

    // Identifier or function call
    if (this.is("Identifier") || this.is("Keyword")) {
      let name = this.advance().value;
      // Handle std::cout, std::cin, std::endl — strip the namespace prefix
      if (name === "std" && this.is("Punct", ":") && this.peek(1).value === ":") {
        this.advance(); // first :
        this.advance(); // second :
        name = this.advance().value;
        return { kind: "Identifier", name, line, column };
      }
      if (this.is("Punct", "(")) {
        this.advance();
        const args: ExprNode[] = [];
        while (!this.is("Punct", ")") && !this.is("EOF")) {
          if (args.length > 0) this.expect("Punct", ",");
          args.push(this.parseAssignExpr());
        }
        this.expect("Punct", ")");
        return { kind: "CallExpr", callee: name, args, line, column };
      }
      return { kind: "Identifier", name, line, column };
    }

    throw new ParseError(`Unexpected token '${this.cur().value}'`, line, column);
  }
}
