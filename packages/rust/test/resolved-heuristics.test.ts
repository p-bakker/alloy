import { describe, expect, it } from "vitest";
import { resolveHeuristics } from "../src/context/resolved-heuristics.js";

describe("resolveHeuristics", () => {
  it("resolves the documented defaults for maxWidth=100", () => {
    expect(resolveHeuristics({ maxWidth: 100 })).toEqual({
      fnCallWidth: 60,
      attrFnLikeWidth: 70,
      structLitWidth: 18,
      structVariantWidth: 35,
      arrayWidth: 60,
      chainWidth: 60,
      singleLineIfElseMaxWidth: 50,
      singleLineLetElseMaxWidth: 50,
    });
  });

  it("scales proportionally with maxWidth", () => {
    const r = resolveHeuristics({ maxWidth: 200 });
    // 60% of 200
    expect(r.fnCallWidth).toBe(120);
    expect(r.arrayWidth).toBe(120);
    expect(r.chainWidth).toBe(120);
    // 70% of 200
    expect(r.attrFnLikeWidth).toBe(140);
    // 18% of 200
    expect(r.structLitWidth).toBe(36);
    // 35% of 200
    expect(r.structVariantWidth).toBe(70);
    // 50% of 200
    expect(r.singleLineIfElseMaxWidth).toBe(100);
    expect(r.singleLineLetElseMaxWidth).toBe(100);
  });

  it("rounds fractional percentages using Math.round (half away from zero)", () => {
    // 18% of 80 = 14.4 → 14
    expect(resolveHeuristics({ maxWidth: 80 }).structLitWidth).toBe(14);
    // 50% of 75 = 37.5 → 38
    expect(resolveHeuristics({ maxWidth: 75 }).singleLineIfElseMaxWidth).toBe(
      38,
    );
    // 35% of 73 = 25.55 → 26
    expect(resolveHeuristics({ maxWidth: 73 }).structVariantWidth).toBe(26);
  });

  it("returns maxWidth for every heuristic under useSmallHeuristics=Off", () => {
    const r = resolveHeuristics({
      maxWidth: 100,
      useSmallHeuristics: "Off",
    });
    expect(r).toEqual({
      fnCallWidth: 100,
      attrFnLikeWidth: 100,
      structLitWidth: 100,
      structVariantWidth: 100,
      arrayWidth: 100,
      chainWidth: 100,
      singleLineIfElseMaxWidth: 100,
      singleLineLetElseMaxWidth: 100,
    });
  });

  it("returns maxWidth for every heuristic under useSmallHeuristics=Max", () => {
    const r = resolveHeuristics({
      maxWidth: 120,
      useSmallHeuristics: "Max",
    });
    expect(r.fnCallWidth).toBe(120);
    expect(r.attrFnLikeWidth).toBe(120);
    expect(r.structLitWidth).toBe(120);
    expect(r.structVariantWidth).toBe(120);
    expect(r.arrayWidth).toBe(120);
    expect(r.chainWidth).toBe(120);
    expect(r.singleLineIfElseMaxWidth).toBe(120);
    expect(r.singleLineLetElseMaxWidth).toBe(120);
  });

  it("honours explicit per-heuristic overrides under Default", () => {
    const r = resolveHeuristics({
      maxWidth: 100,
      fnCallWidth: 42,
      chainWidth: 17,
    });
    // Overrides win.
    expect(r.fnCallWidth).toBe(42);
    expect(r.chainWidth).toBe(17);
    // Others still compute from the default percentages.
    expect(r.attrFnLikeWidth).toBe(70);
    expect(r.structLitWidth).toBe(18);
  });

  it("honours explicit per-heuristic overrides under Off", () => {
    const r = resolveHeuristics({
      maxWidth: 100,
      useSmallHeuristics: "Off",
      fnCallWidth: 42,
    });
    // Override wins despite Off.
    expect(r.fnCallWidth).toBe(42);
    // Other heuristics still resolve to maxWidth.
    expect(r.chainWidth).toBe(100);
    expect(r.structLitWidth).toBe(100);
  });

  it("honours explicit per-heuristic overrides under Max", () => {
    const r = resolveHeuristics({
      maxWidth: 100,
      useSmallHeuristics: "Max",
      structLitWidth: 25,
    });
    expect(r.structLitWidth).toBe(25);
    expect(r.fnCallWidth).toBe(100);
  });

  it("allows an override of 0 to take effect (zero is not 'unset')", () => {
    const r = resolveHeuristics({
      maxWidth: 100,
      fnCallWidth: 0,
    });
    expect(r.fnCallWidth).toBe(0);
    // Other fields unaffected.
    expect(r.chainWidth).toBe(60);
  });

  it("defaults maxWidth to 100 when unset", () => {
    const r = resolveHeuristics({});
    expect(r.fnCallWidth).toBe(60);
    expect(r.attrFnLikeWidth).toBe(70);
    expect(r.structLitWidth).toBe(18);
  });

  it("treats an unset useSmallHeuristics as Default", () => {
    const r = resolveHeuristics({ maxWidth: 100 });
    const rDefault = resolveHeuristics({
      maxWidth: 100,
      useSmallHeuristics: "Default",
    });
    expect(r).toEqual(rDefault);
  });
});
