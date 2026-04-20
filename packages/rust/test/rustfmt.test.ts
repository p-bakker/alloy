import { describe, expect, it } from "vitest";

import {
  checkRustfmt,
  checkRustfmtAllEditions,
  SUPPORTED_EDITIONS,
  type Edition,
} from "./rustfmt.js";

// A trivially rustfmt-conformant snippet: empty `main` with the canonical
// trailing newline. This text is chosen to be stable across every edition
// rustfmt has ever shipped — no edition-specific syntax, no idioms that
// rustfmt rewrites.
const CONFORMANT_SOURCE = "fn main() {}\n";

// Deliberately mis-formatted: missing spaces around the block and
// assignment. Every edition's rustfmt rewrites this.
const NON_CONFORMANT_SOURCE = "fn main(){let x=1;}\n";

describe("rustfmt test helper", () => {
  describe("SUPPORTED_EDITIONS", () => {
    it("covers every Rust edition currently shipped by stable rustfmt", () => {
      expect(SUPPORTED_EDITIONS).toEqual(["2015", "2018", "2021", "2024"]);
    });
  });

  describe("checkRustfmtAllEditions", () => {
    it("passes rustfmt-conformant source across every supported edition", () => {
      // Happy path: iterates the full default edition matrix and asserts
      // zero diff on each. If this throws, the helper is broken or one
      // edition's rustfmt disagrees with the others.
      expect(() => checkRustfmtAllEditions(CONFORMANT_SOURCE)).not.toThrow();
    });

    it("throws on a deliberate mismatch, naming the offending edition", () => {
      expect(() => checkRustfmtAllEditions(NON_CONFORMANT_SOURCE)).toThrow(
        /not rustfmt-conformant for edition/,
      );
    });

    it("accepts a subset of editions and only checks those", () => {
      const subset: readonly Edition[] = ["2021", "2024"];
      expect(() =>
        checkRustfmtAllEditions(CONFORMANT_SOURCE, { editions: subset }),
      ).not.toThrow();
      expect(() =>
        checkRustfmtAllEditions(NON_CONFORMANT_SOURCE, { editions: subset }),
      ).toThrow(/edition 2021/);
    });
  });

  describe("checkRustfmt (single edition)", () => {
    it("returns pass=true for conformant source at the default edition", () => {
      expect(checkRustfmt(CONFORMANT_SOURCE)).toEqual({ pass: true });
    });

    it("returns the formatted output when the source differs", () => {
      const result = checkRustfmt(NON_CONFORMANT_SOURCE, { edition: "2024" });
      expect(result.pass).toBe(false);
      if (!result.pass) {
        expect(result.formatted).not.toBe(NON_CONFORMANT_SOURCE);
      }
    });
  });
});
