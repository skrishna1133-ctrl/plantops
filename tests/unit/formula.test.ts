/**
 * Unit tests for src/lib/formula-eval.ts
 * Tests the safe expression evaluator used for calculated QMS parameters.
 */
import { describe, it, expect } from "vitest";
import { evaluateFormula } from "@/lib/formula-eval";

describe("evaluateFormula", () => {
  it("evaluates a simple multiplication with a variable", () => {
    expect(evaluateFormula("x * 2", { x: 5 })).toBe(10);
  });

  it("converts bulk density g/cc → lbs/ft³", () => {
    const result = evaluateFormula("bulk_density * 62.428", { bulk_density: 0.5 });
    expect(result).toBeCloseTo(31.214);
  });

  it("evaluates addition", () => {
    expect(evaluateFormula("a + b", { a: 3, b: 4 })).toBe(7);
  });

  it("evaluates subtraction", () => {
    expect(evaluateFormula("a - b", { a: 10, b: 3 })).toBe(7);
  });

  it("evaluates division", () => {
    expect(evaluateFormula("a / b", { a: 15, b: 3 })).toBe(5);
  });

  it("respects operator precedence (* before +)", () => {
    expect(evaluateFormula("2 + 3 * 4", {})).toBe(14);
  });

  it("respects parentheses", () => {
    expect(evaluateFormula("(2 + 3) * 4", {})).toBe(20);
  });

  it("handles numeric literals only", () => {
    expect(evaluateFormula("100 / 4 + 5", {})).toBe(30);
  });

  it("handles unary minus", () => {
    expect(evaluateFormula("-x + 10", { x: 3 })).toBe(7);
  });

  it("evaluates multi-variable expression", () => {
    // yield% = (output / input) * 100
    const result = evaluateFormula("(output / input) * 100", { output: 900, input: 1000 });
    expect(result).toBe(90);
  });

  it("throws on unknown variable", () => {
    expect(() => evaluateFormula("x + y", { x: 1 })).toThrow(/Unknown parameter/);
  });

  it("throws on division by zero", () => {
    expect(() => evaluateFormula("x / 0", { x: 5 })).toThrow(/Division by zero/);
  });

  it("throws on unexpected character", () => {
    expect(() => evaluateFormula("x ^ 2", { x: 3 })).toThrow(/Unexpected character/);
  });

  it("throws on unbalanced parentheses", () => {
    expect(() => evaluateFormula("(1 + 2", {})).toThrow();
  });

  it("handles nested parentheses", () => {
    expect(evaluateFormula("((2 + 3) * (4 - 1))", {})).toBe(15);
  });
});
