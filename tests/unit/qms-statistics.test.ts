/**
 * Unit tests for src/lib/qms-statistics.ts
 * Tests all statistical aggregation functions used in multi-reading QMS inspections.
 */
import { describe, it, expect } from "vitest";
import { computeStatistic } from "@/lib/qms-statistics";

const readings = [2, 4, 4, 4, 5, 5, 7, 9]; // classic stats example

describe("computeStatistic", () => {
  it("returns null for empty readings", () => {
    expect(computeStatistic([], "average")).toBeNull();
  });

  it("average", () => {
    expect(computeStatistic([1, 2, 3, 4, 5], "average")).toBe(3);
    expect(computeStatistic(readings, "average")).toBe(5);
  });

  it("median — odd count", () => {
    expect(computeStatistic([1, 3, 5], "median")).toBe(3);
    expect(computeStatistic([3, 1, 5], "median")).toBe(3); // sorts internally
  });

  it("median — even count", () => {
    expect(computeStatistic([1, 2, 3, 4], "median")).toBe(2.5);
    expect(computeStatistic(readings, "median")).toBe(4.5);
  });

  it("sum", () => {
    expect(computeStatistic([1, 2, 3], "sum")).toBe(6);
  });

  it("range (max - min)", () => {
    expect(computeStatistic([1, 5, 3], "range")).toBe(4);
    expect(computeStatistic(readings, "range")).toBe(7);
  });

  it("mode", () => {
    expect(computeStatistic([1, 2, 2, 3], "mode")).toBe(2);
    // 4 appears three times
    expect(computeStatistic(readings, "mode")).toBe(4);
  });

  it("min", () => {
    expect(computeStatistic([3, 1, 4, 1, 5], "min")).toBe(1);
  });

  it("max", () => {
    expect(computeStatistic([3, 1, 4, 1, 5], "max")).toBe(5);
  });

  it("std_dev — population standard deviation", () => {
    // readings [2,4,4,4,5,5,7,9]: mean=5, variance=4, σ=2
    expect(computeStatistic(readings, "std_dev")).toBeCloseTo(2.0);
  });

  it("std_dev — single value is 0", () => {
    expect(computeStatistic([5], "std_dev")).toBe(0);
  });

  it("cv_pct — coefficient of variation", () => {
    // std_dev=2, mean=5 → CV = 40%
    expect(computeStatistic(readings, "cv_pct")).toBeCloseTo(40.0);
  });

  it("cv_pct — returns null when mean is zero", () => {
    expect(computeStatistic([0, 0, 0], "cv_pct")).toBeNull();
  });

  it("none — returns null (record only)", () => {
    expect(computeStatistic([1, 2, 3], "none")).toBeNull();
  });

  it("unknown statistic falls back to average", () => {
    expect(computeStatistic([1, 2, 3], "unknown_stat")).toBe(2);
  });

  it("single reading returns itself for all aggregations", () => {
    expect(computeStatistic([7], "average")).toBe(7);
    expect(computeStatistic([7], "median")).toBe(7);
    expect(computeStatistic([7], "sum")).toBe(7);
    expect(computeStatistic([7], "range")).toBe(0);
    expect(computeStatistic([7], "min")).toBe(7);
    expect(computeStatistic([7], "max")).toBe(7);
  });
});
