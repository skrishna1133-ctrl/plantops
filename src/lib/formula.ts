// Safe formula evaluator for calculated quality fields
// Supports: +, -, *, /, (), numeric constants
// References: {fieldId} for row fields, {header.fieldId} for header fields
// NO eval() - uses recursive descent parser

export interface FormulaContext {
  headerValues: Record<string, number>;
  rowValues: Record<string, number>;
}

export function extractFieldDependencies(formula: string): { rowFields: string[]; headerFields: string[] } {
  const rowFields: string[] = [];
  const headerFields: string[] = [];
  const regex = /\{(header\.)?([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let match;
  while ((match = regex.exec(formula)) !== null) {
    if (match[1]) {
      headerFields.push(match[2]);
    } else {
      rowFields.push(match[2]);
    }
  }
  return { rowFields, headerFields };
}

export function validateFormula(
  formula: string,
  availableRowFieldIds: string[],
  availableHeaderFieldIds: string[]
): { valid: boolean; error?: string } {
  const deps = extractFieldDependencies(formula);

  for (const id of deps.rowFields) {
    if (!availableRowFieldIds.includes(id)) {
      return { valid: false, error: `Unknown row field: {${id}}` };
    }
  }
  for (const id of deps.headerFields) {
    if (!availableHeaderFieldIds.includes(id)) {
      return { valid: false, error: `Unknown header field: {header.${id}}` };
    }
  }

  // Try to parse with dummy values to check syntax
  const dummyContext: FormulaContext = {
    headerValues: Object.fromEntries(availableHeaderFieldIds.map((id) => [id, 1])),
    rowValues: Object.fromEntries(availableRowFieldIds.map((id) => [id, 1])),
  };

  const result = evaluateFormula(formula, dummyContext);
  if (result === null) {
    return { valid: false, error: "Invalid formula syntax" };
  }
  return { valid: true };
}

export function evaluateFormula(formula: string, context: FormulaContext): number | null {
  try {
    // Replace field references with values
    const resolved = formula.replace(
      /\{(header\.)?([a-zA-Z_][a-zA-Z0-9_]*)\}/g,
      (_, isHeader, fieldId) => {
        const val = isHeader ? context.headerValues[fieldId] : context.rowValues[fieldId];
        if (val === undefined || val === null || isNaN(val)) return "NaN";
        return String(val);
      }
    );

    if (resolved.includes("NaN")) return null;

    const result = parseExpression(resolved);
    if (result === null || !isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

// ─── Recursive Descent Parser ───

function parseExpression(expr: string): number | null {
  const tokens = tokenize(expr);
  if (!tokens) return null;
  const parser = new Parser(tokens);
  const result = parser.parseExpr();
  if (parser.pos < parser.tokens.length) return null; // leftover tokens
  return result;
}

type Token =
  | { type: "number"; value: number }
  | { type: "op"; value: string }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenize(expr: string): Token[] | null {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    if (s[i] === " ") {
      i++;
      continue;
    }

    if (s[i] === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }

    if (s[i] === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }

    if ("+-*/".includes(s[i])) {
      // Handle unary minus: at start, after '(' or after operator
      if (
        s[i] === "-" &&
        (tokens.length === 0 ||
          tokens[tokens.length - 1].type === "lparen" ||
          tokens[tokens.length - 1].type === "op")
      ) {
        // Parse as negative number
        i++;
        const start = i;
        while (i < s.length && (isDigit(s[i]) || s[i] === ".")) i++;
        if (i === start) return null;
        tokens.push({ type: "number", value: -parseFloat(s.slice(start, i)) });
        continue;
      }
      tokens.push({ type: "op", value: s[i] });
      i++;
      continue;
    }

    if (isDigit(s[i]) || s[i] === ".") {
      const start = i;
      while (i < s.length && (isDigit(s[i]) || s[i] === ".")) i++;
      tokens.push({ type: "number", value: parseFloat(s.slice(start, i)) });
      continue;
    }

    return null; // invalid character
  }

  return tokens;
}

function isDigit(c: string): boolean {
  return c >= "0" && c <= "9";
}

class Parser {
  tokens: Token[];
  pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  peek(): Token | null {
    return this.pos < this.tokens.length ? this.tokens[this.pos] : null;
  }

  consume(): Token {
    return this.tokens[this.pos++];
  }

  // expr = term (('+' | '-') term)*
  parseExpr(): number | null {
    let left = this.parseTerm();
    if (left === null) return null;

    while (this.peek()?.type === "op" && (this.peek() as { value: string }).value in { "+": 1, "-": 1 }) {
      const op = (this.consume() as { value: string }).value;
      const right = this.parseTerm();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }

    return left;
  }

  // term = factor (('*' | '/') factor)*
  parseTerm(): number | null {
    let left = this.parseFactor();
    if (left === null) return null;

    while (this.peek()?.type === "op" && (this.peek() as { value: string }).value in { "*": 1, "/": 1 }) {
      const op = (this.consume() as { value: string }).value;
      const right = this.parseFactor();
      if (right === null) return null;
      left = op === "*" ? left * right : left / right;
    }

    return left;
  }

  // factor = number | '(' expr ')'
  parseFactor(): number | null {
    const token = this.peek();
    if (!token) return null;

    if (token.type === "number") {
      this.consume();
      return token.value;
    }

    if (token.type === "lparen") {
      this.consume();
      const result = this.parseExpr();
      if (result === null) return null;
      if (this.peek()?.type !== "rparen") return null;
      this.consume();
      return result;
    }

    return null;
  }
}
