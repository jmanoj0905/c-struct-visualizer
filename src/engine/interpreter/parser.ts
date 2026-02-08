// Recursive descent parser: Token[] → AST

import type { Token } from "./lexer";
import type {
  ASTNode, ExprNode, CType, ProgramNode, FunctionDefNode, StructDefNode,
  VarDeclNode, BlockNode, ReturnStmtNode, ExprStmtNode, IfStmtNode,
  WhileStmtNode, ForStmtNode, DoWhileStmtNode, BreakStmtNode, ContinueStmtNode,
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
      // Match: struct Name {
      if (this.tokens[i].value === "struct" && this.tokens[i + 1]?.type === "Identifier" && this.tokens[i + 2]?.value === "{") {
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
      if (this.is("Punct", "{")) {
        this.pos = saved;
        return this.parseStructDef();
      }
      this.pos = saved;
      // It's a variable decl or function def starting with struct type
    }

    // Typedef'd struct name as return type (e.g., Node* createNode())
    if (this.is("Identifier") && this.isKnownType(this.cur().value)) {
      return this.parseDeclOrFuncDef();
    }

    // Function def or global variable
    return this.parseDeclOrFuncDef();
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

  private parseStructDef(): StructDefNode {
    const { line, column } = this.cur();
    this.expect("Keyword", "struct");
    // Name is optional for anonymous structs (typedef struct { ... } alias;)
    const name = this.is("Identifier") ? this.advance().value : `__anon_struct_${line}_${column}`;
    this.expect("Punct", "{");
    const fields: { name: string; fieldType: CType }[] = [];
    while (!this.is("Punct", "}") && !this.is("EOF")) {
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

  private parseDeclOrFuncDef(): ASTNode {
    const { line, column } = this.cur();
    // Skip const/static
    while (this.is("Keyword", "const") || this.is("Keyword", "static")) this.advance();
    const type = this.parseType();
    const name = this.expect("Identifier").value;

    // Function definition
    if (this.is("Punct", "(")) {
      return this.parseFunctionDef(type, name, line, column);
    }

    // Variable declaration (possibly with array)
    if (this.match("Punct", "[")) {
      if (this.is("Number")) {
        type.arraySize = parseInt(this.advance().value);
      }
      this.expect("Punct", "]");
    }
    let init: ExprNode | undefined;
    if (this.match("Punct", "=")) {
      // Array initializer
      if (this.is("Punct", "{")) {
        init = this.parseArrayInitializer(line, column);
      } else {
        init = this.parseExpr();
      }
    }
    this.expect("Punct", ";");
    return { kind: "VarDecl", name, varType: type, init, line, column } as VarDeclNode;
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
    let base = "";
    // Skip const/unsigned/signed
    while (this.is("Keyword", "const") || this.is("Keyword", "unsigned") || this.is("Keyword", "signed")) {
      this.advance();
    }
    if (this.is("Keyword", "struct")) {
      this.advance();
      isStruct = true;
      base = this.expect("Identifier").value;
    } else if (this.is("Keyword") && ["int", "float", "double", "char", "void", "long", "short"].includes(this.cur().value)) {
      base = this.advance().value;
      // Handle "long long", "long int", etc.
      if (base === "long" && this.is("Keyword") && (this.cur().value === "long" || this.cur().value === "int")) {
        this.advance();
      }
    } else if (this.is("Identifier")) {
      // Could be a typedef name - treat as base type
      base = this.resolveTypeName(this.advance().value);
      isStruct = true; // Assume typedef'd struct
    } else {
      base = "int"; // Default
    }
    let pointerLevel = 0;
    while (this.is("Punct", "*")) { this.advance(); pointerLevel++; }
    return { base, pointerLevel, isStruct: isStruct && pointerLevel === 0 ? true : isStruct };
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
    if (this.is("Keyword", "return")) return this.parseReturn();
    if (this.is("Keyword", "break")) { this.advance(); this.expect("Punct", ";"); return { kind: "BreakStmt", line, column } as BreakStmtNode; }
    if (this.is("Keyword", "continue")) { this.advance(); this.expect("Punct", ";"); return { kind: "ContinueStmt", line, column } as ContinueStmtNode; }

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
    if (tok.type === "Keyword" && ["int", "float", "double", "char", "void", "long", "short", "unsigned", "signed"].includes(tok.value)) return true;
    if (tok.type === "Keyword" && tok.value === "struct") return true;
    // Typedef'd struct name used as type (e.g., Node* head)
    if (tok.type === "Identifier" && this.isKnownType(tok.value)) {
      // Make sure the next token after the name (and optional *) is an identifier (the var name)
      let off2 = offset + 1;
      while (this.peek(off2).value === "*") off2++;
      if (this.peek(off2).type === "Identifier") return true;
    }
    return false;
  }

  private parseLocalDecl(): ASTNode {
    const { line, column } = this.cur();
    while (this.is("Keyword", "const") || this.is("Keyword", "static")) this.advance();
    const type = this.parseType();
    const name = this.expect("Identifier").value;

    // Array
    if (this.match("Punct", "[")) {
      if (this.is("Number")) {
        type.arraySize = parseInt(this.advance().value);
      }
      this.expect("Punct", "]");
    }

    let init: ExprNode | undefined;
    if (this.match("Punct", "=")) {
      if (this.is("Punct", "{")) {
        init = this.parseArrayInitializer(line, column);
      } else {
        init = this.parseExpr();
      }
    }
    this.expect("Punct", ";");
    return { kind: "VarDecl", name, varType: type, init, line, column } as VarDeclNode;
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

    if (tok.type === "Keyword" && ["int", "float", "double", "char", "void", "long", "short", "unsigned", "signed", "struct", "const"].includes(tok.value)) {
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
        expr = { kind: "ArrowExpr", object: expr, field, line, column };
      } else if (this.is("Punct", ".")) {
        this.advance();
        const field = this.expect("Identifier").value;
        expr = { kind: "MemberExpr", object: expr, field, line, column };
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

    // NULL
    if (this.is("Keyword", "NULL")) {
      this.advance();
      return { kind: "NullLit", line, column };
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
      const name = this.advance().value;
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
