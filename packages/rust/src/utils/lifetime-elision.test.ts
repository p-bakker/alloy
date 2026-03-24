import { describe, expect, it } from "vitest";
import {
  canElideLifetimes,
  elideLifetimeAnnotations,
  LifetimeElisionInput,
} from "./lifetime-elision.js";

describe("canElideLifetimes", () => {
  // --- Rule 1: Single input reference → output lifetime can be elided ---

  it("returns true for a single input reference with a reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 1,
      hasSelfRef: false,
      hasReferenceReturn: true,
    };
    expect(canElideLifetimes(input)).toBe(true);
  });

  // --- Rule 2: Multiple input references → cannot elide ---

  it("returns false for multiple input references with a reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 2,
      hasSelfRef: false,
      hasReferenceReturn: true,
    };
    expect(canElideLifetimes(input)).toBe(false);
  });

  it("returns false for three input references with a reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 3,
      hasSelfRef: false,
      hasReferenceReturn: true,
    };
    expect(canElideLifetimes(input)).toBe(false);
  });

  // --- Rule 3: &self / &mut self → output lifetime can be elided ---

  it("returns true when &self is present with a reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 0,
      hasSelfRef: true,
      hasReferenceReturn: true,
    };
    expect(canElideLifetimes(input)).toBe(true);
  });

  it("returns true when &self is present alongside other reference params", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 2,
      hasSelfRef: true,
      hasReferenceReturn: true,
    };
    expect(canElideLifetimes(input)).toBe(true);
  });

  // --- Edge case: No references at all ---

  it("returns true when there are no reference params and no reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 0,
      hasSelfRef: false,
      hasReferenceReturn: false,
    };
    expect(canElideLifetimes(input)).toBe(true);
  });

  // --- Edge case: No return type (no reference return) ---

  it("returns true when there are multiple reference params but no reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 3,
      hasSelfRef: false,
      hasReferenceReturn: false,
    };
    expect(canElideLifetimes(input)).toBe(true);
  });

  it("returns true for a single reference param with no reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 1,
      hasSelfRef: false,
      hasReferenceReturn: false,
    };
    expect(canElideLifetimes(input)).toBe(true);
  });

  // --- Edge case: Zero reference params but has reference return (no self) ---

  it("returns false for zero reference params, no self, but has reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 0,
      hasSelfRef: false,
      hasReferenceReturn: true,
    };
    expect(canElideLifetimes(input)).toBe(false);
  });
});

describe("elideLifetimeAnnotations", () => {
  it("returns undefined when no lifetimes are provided", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 2,
      hasSelfRef: false,
      hasReferenceReturn: true,
    };
    expect(elideLifetimeAnnotations(undefined, input)).toBeUndefined();
  });

  it("returns undefined when lifetimes array is empty", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 2,
      hasSelfRef: false,
      hasReferenceReturn: true,
    };
    expect(elideLifetimeAnnotations([], input)).toBeUndefined();
  });

  it("returns undefined (elides) when single input reference with reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 1,
      hasSelfRef: false,
      hasReferenceReturn: true,
    };
    expect(elideLifetimeAnnotations(["'a"], input)).toBeUndefined();
  });

  it("returns undefined (elides) when &self is present with reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 1,
      hasSelfRef: true,
      hasReferenceReturn: true,
    };
    expect(elideLifetimeAnnotations(["'a"], input)).toBeUndefined();
  });

  it("returns undefined (elides) when no reference return", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 3,
      hasSelfRef: false,
      hasReferenceReturn: false,
    };
    expect(elideLifetimeAnnotations(["'a", "'b", "'c"], input)).toBeUndefined();
  });

  it("preserves explicit lifetimes when elision is not possible", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 2,
      hasSelfRef: false,
      hasReferenceReturn: true,
    };
    const lifetimes = ["'a", "'b"];
    expect(elideLifetimeAnnotations(lifetimes, input)).toEqual(["'a", "'b"]);
  });

  it("preserves multiple output lifetimes when elision is not possible", () => {
    const input: LifetimeElisionInput = {
      referenceParamCount: 3,
      hasSelfRef: false,
      hasReferenceReturn: true,
    };
    const lifetimes = ["'a", "'b", "'c"];
    expect(elideLifetimeAnnotations(lifetimes, input)).toEqual([
      "'a",
      "'b",
      "'c",
    ]);
  });
});
