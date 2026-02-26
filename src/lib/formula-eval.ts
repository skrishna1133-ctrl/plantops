/**
 * Safe math expression evaluator — no eval().
 * Supports: +, -, *, /, (, ), numeric literals, and identifier references.
 *
 * Usage:
 *   evaluateFormula("bulk_density_gcc * 62.428", { bulk_density_gcc: 0.5 })
 *   // => 31.214
 */

export function evaluateFormula(
  formula: string,
  vars: Record<string, number>
): number {
  const tokens = tokenize(formula);
  const parser = new Parser(tokens, vars);
  return parser.parseExpr();
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

type Token =
  | { type: "number"; value: number }
  | { type: "ident"; name: string }
  | { type: "op"; char: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenize(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < formula.length) {
    const ch = formula[i];

    if (ch === " " || ch === "\t") { i++; continue; }

    if (ch >= "0" && ch <= "9" || ch === ".") {
      let num = "";
      while (i < formula.length && (formula[i] >= "0" && formula[i] <= "9" || formula[i] === ".")) {
        num += formula[i++];
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    if ((ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_") {
      let name = "";
      while (i < formula.length && (
        (formula[i] >= "a" && formula[i] <= "z") ||
        (formula[i] >= "A" && formula[i] <= "Z") ||
        (formula[i] >= "0" && formula[i] <= "9") ||
        formula[i] === "_"
      )) {
        name += formula[i++];
      }
      tokens.push({ type: "ident", name });
      continue;
    }

    if (ch === "+") { tokens.push({ type: "op", char: "+" }); i++; continue; }
    if (ch === "-") { tokens.push({ type: "op", char: "-" }); i++; continue; }
    if (ch === "*") { tokens.push({ type: "op", char: "*" }); i++; continue; }
    if (ch === "/") { tokens.push({ type: "op", char: "/" }); i++; continue; }
    if (ch === "(") { tokens.push({ type: "lparen" }); i++; continue; }
    if (ch === ")") { tokens.push({ type: "rparen" }); i++; continue; }

    throw new Error(`Unexpected character in formula: '${ch}'`);
  }

  return tokens;
}

// ─── Parser (recursive descent) ───────────────────────────────────────────────

class Parser {
  private pos = 0;
  constructor(private tokens: Token[], private vars: Record<string, number>) {}

  private peek(): Token | undefined { return this.tokens[this.pos]; }
  private consume(): Token { return this.tokens[this.pos++]; }

  // expr = term (('+' | '-') term)*
  parseExpr(): number {
    let left = this.parseTerm();
    while (this.peek()?.type === "op" && (this.peek() as { char: string }).char === "+" || this.peek()?.type === "op" && (this.peek() as { char: string }).char === "-") {
      const op = (this.consume() as { char: string }).char;
      const right = this.parseTerm();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  // term = factor (('*' | '/') factor)*
  private parseTerm(): number {
    let left = this.parseFactor();
    while (this.peek()?.type === "op" && ((this.peek() as { char: string }).char === "*" || (this.peek() as { char: string }).char === "/")) {
      const op = (this.consume() as { char: string }).char;
      const right = this.parseFactor();
      if (op === "/" && right === 0) throw new Error("Division by zero in formula");
      left = op === "*" ? left * right : left / right;
    }
    return left;
  }

  // factor = '(' expr ')' | NUMBER | IDENT
  private parseFactor(): number {
    const tok = this.peek();
    if (!tok) throw new Error("Unexpected end of formula");

    if (tok.type === "lparen") {
      this.consume();
      const val = this.parseExpr();
      if (this.peek()?.type !== "rparen") throw new Error("Missing closing parenthesis");
      this.consume();
      return val;
    }

    if (tok.type === "number") {
      this.consume();
      return tok.value;
    }

    if (tok.type === "ident") {
      this.consume();
      if (!(tok.name in this.vars)) {
        throw new Error(`Unknown parameter in formula: '${tok.name}'`);
      }
      return this.vars[tok.name];
    }

    // Handle unary minus
    if (tok.type === "op" && tok.char === "-") {
      this.consume();
      return -this.parseFactor();
    }

    throw new Error(`Unexpected token in formula: ${JSON.stringify(tok)}`);
  }
}
