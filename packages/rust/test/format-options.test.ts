import { describe, expect, it } from "vitest";

import {
  DEFAULT_RUST_FORMAT_OPTIONS,
  toCommonFormatOptions,
} from "../src/context/format-options.js";

describe("toCommonFormatOptions", () => {
  it("renames maxWidth to printWidth and tabSpaces to tabWidth", () => {
    expect(toCommonFormatOptions({ maxWidth: 120, tabSpaces: 2 })).toEqual({
      printWidth: 120,
      tabWidth: 2,
    });
  });

  it("strips every rust-only field from the core-facing object", () => {
    const result = toCommonFormatOptions({
      maxWidth: 100,
      tabSpaces: 4,
      useSmallHeuristics: "Off",
      fnCallWidth: 50,
      attrFnLikeWidth: 80,
      structLitWidth: 25,
      structVariantWidth: 40,
      arrayWidth: 55,
      chainWidth: 65,
      singleLineIfElseMaxWidth: 45,
      singleLineLetElseMaxWidth: 55,
      shortArrayElementWidthThreshold: 12,
      fnParamsLayout: "Vertical",
      emitter: { autoBlankLines: false },
    });

    expect(result).toEqual({ printWidth: 100, tabWidth: 4 });
  });

  it("strips the emitter sub-object from the core-facing object", () => {
    const result = toCommonFormatOptions({
      maxWidth: 100,
      tabSpaces: 4,
      emitter: { autoBlankLines: false },
    });

    expect(result).toEqual({ printWidth: 100, tabWidth: 4 });
    expect("emitter" in result).toBe(false);
    expect("autoBlankLines" in result).toBe(false);
  });

  it("defaults include shortArrayElementWidthThreshold = 10", () => {
    expect(DEFAULT_RUST_FORMAT_OPTIONS.shortArrayElementWidthThreshold).toBe(
      10,
    );
  });

  it("defaults fnParamsLayout to 'Tall'", () => {
    expect(DEFAULT_RUST_FORMAT_OPTIONS.fnParamsLayout).toBe("Tall");
  });

  it("defaults emitter.autoBlankLines to true", () => {
    expect(DEFAULT_RUST_FORMAT_OPTIONS.emitter?.autoBlankLines).toBe(true);
  });
});
