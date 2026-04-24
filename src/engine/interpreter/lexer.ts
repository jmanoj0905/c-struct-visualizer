// Lexer: source code → Token[]

export type TokenType =
  | "Number" | "String" | "Char" | "Identifier" | "Keyword"
  | "Punct" | "EOF";

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

const KEYWORDS = new Set([
  "int", "float", "double", "char", "void", "long", "short", "unsigned", "signed",
  "struct", "typedef", "if", "else", "while", "for", "do", "return",
  "break", "continue", "sizeof", "NULL", "switch", "case", "default",
  // NOTE: switch/case/default/enum are lexed but not yet parsed or executed.
  "const", "static", "enum",
  // C++ keywords
  "class", "public", "private", "protected", "virtual", "override", "final",
  "nullptr", "new", "delete", "this", "bool", "true", "false", "using", "namespace",
  "cout", "cin", "endl", "string", "vector",
]);

const MULTI_CHAR_PUNCTS = ["->", "++", "--", "<=", ">=", "==", "!=", "&&", "||", "+=", "-=", "*=", "/=", "%=", "<<", ">>"];
const SINGLE_PUNCTS = new Set("(){}[];,.:+-*/%&|^~!<>=?#");

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  function peek(offset = 0) { return source[i + offset]; }
  function advance() {
    const ch = source[i++];
    if (ch === "\n") { line++; col = 1; } else { col++; }
    return ch;
  }
  function at(offset = 0) { return i + offset < source.length ? source[i + offset] : ""; }

  while (i < source.length) {
    // Whitespace
    if (/\s/.test(peek())) { advance(); continue; }

    // Single-line comment
    if (at() === "/" && at(1) === "/") {
      while (i < source.length && peek() !== "\n") advance();
      continue;
    }

    // Multi-line comment
    if (at() === "/" && at(1) === "*") {
      advance(); advance();
      while (i < source.length && !(at() === "*" && at(1) === "/")) advance();
      if (i < source.length) { advance(); advance(); }
      continue;
    }

    // Preprocessor directives: skip entire line
    if (at() === "#") {
      while (i < source.length && peek() !== "\n") advance();
      continue;
    }

    const startLine = line;
    const startCol = col;

    // String literal
    if (at() === '"') {
      advance();
      let val = "";
      while (i < source.length && at() !== '"') {
        if (at() === "\\") {
          advance();
          const esc = advance();
          switch (esc) {
            case "n": val += "\n"; break;
            case "t": val += "\t"; break;
            case "\\": val += "\\"; break;
            case '"': val += '"'; break;
            case "0": val += "\0"; break;
            default: val += esc;
          }
        } else {
          val += advance();
        }
      }
      if (i < source.length) advance(); // closing "
      tokens.push({ type: "String", value: val, line: startLine, column: startCol });
      continue;
    }

    // Char literal
    if (at() === "'") {
      advance();
      let val = "";
      if (at() === "\\") {
        advance();
        const esc = advance();
        switch (esc) {
          case "n": val = "\n"; break;
          case "t": val = "\t"; break;
          case "\\": val = "\\"; break;
          case "'": val = "'"; break;
          case "0": val = "\0"; break;
          default: val = esc;
        }
      } else {
        val = advance();
      }
      if (i < source.length) advance(); // closing '
      tokens.push({ type: "Char", value: val, line: startLine, column: startCol });
      continue;
    }

    // Number
    if (/[0-9]/.test(at()) || (at() === "." && /[0-9]/.test(at(1)))) {
      let num = "";
      if (at() === "0" && (at(1) === "x" || at(1) === "X")) {
        num += advance(); num += advance();
        while (i < source.length && /[0-9a-fA-F]/.test(at())) num += advance();
      } else {
        while (i < source.length && /[0-9]/.test(at())) num += advance();
        if (at() === "." && /[0-9]/.test(at(1))) {
          num += advance();
          while (i < source.length && /[0-9]/.test(at())) num += advance();
        }
      }
      // Skip suffixes like f, l, u, etc.
      while (i < source.length && /[fFlLuU]/.test(at())) advance();
      tokens.push({ type: "Number", value: num, line: startLine, column: startCol });
      continue;
    }

    // Identifier / Keyword
    if (/[a-zA-Z_]/.test(at())) {
      let id = "";
      while (i < source.length && /[a-zA-Z0-9_]/.test(at())) id += advance();
      const type = KEYWORDS.has(id) ? "Keyword" : "Identifier";
      tokens.push({ type, value: id, line: startLine, column: startCol });
      continue;
    }

    // Multi-char punctuation
    const matchedMulti = MULTI_CHAR_PUNCTS.find(p => source.substring(i, i + p.length) === p);
    if (matchedMulti) {
      for (let j = 0; j < matchedMulti.length; j++) advance();
      tokens.push({ type: "Punct", value: matchedMulti, line: startLine, column: startCol });
      continue;
    }

    // Single-char punctuation
    if (SINGLE_PUNCTS.has(at())) {
      const ch = advance();
      tokens.push({ type: "Punct", value: ch, line: startLine, column: startCol });
      continue;
    }

    // Unknown character - skip
    advance();
  }

  tokens.push({ type: "EOF", value: "", line, column: col });
  return tokens;
}
