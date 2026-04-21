import { describe, expect, it } from "vitest";

import {
  compareImportEntry,
  compareModuleEntry,
} from "../src/style/sort-comparator.js";

function sortWith(
  entries: readonly string[],
  compare: (a: string, b: string) => number,
): string[] {
  return [...entries].sort(compare);
}

describe("compareImportEntry — pinning", () => {
  const compare = compareImportEntry("2024");

  it("pins self first, super second, glob last, rest in the middle", () => {
    expect(sortWith(["*", "b", "self", "a", "super"], compare)).toEqual([
      "self",
      "super",
      "a",
      "b",
      "*",
    ]);
  });

  it("applies the same pinning under pre-2024 editions", () => {
    const preCompare = compareImportEntry("2021");
    expect(sortWith(["*", "b", "self", "a", "super"], preCompare)).toEqual([
      "self",
      "super",
      "a",
      "b",
      "*",
    ]);
  });

  it("keeps tokens named similarly to pins but not equal in the middle bucket", () => {
    // `selfx` is not the `self` keyword, so it ranks with the rest.
    expect(sortWith(["selfx", "a", "self"], compare)).toEqual([
      "self",
      "a",
      "selfx",
    ]);
  });
});

describe("compareImportEntry — ASCII-lex under pre-2024 editions", () => {
  it("sorts foo10 before foo2 (byte-wise)", () => {
    const compare = compareImportEntry("2021");
    expect(sortWith(["foo2", "foo10", "foo1"], compare)).toEqual([
      "foo1",
      "foo10",
      "foo2",
    ]);
  });

  it("treats undefined edition as pre-2024 (conservative default)", () => {
    const compare = compareImportEntry(undefined);
    expect(sortWith(["foo2", "foo10", "foo1"], compare)).toEqual([
      "foo1",
      "foo10",
      "foo2",
    ]);
  });

  it("treats unknown edition values as pre-2024", () => {
    const compare = compareImportEntry("1999");
    expect(sortWith(["foo2", "foo10"], compare)).toEqual(["foo10", "foo2"]);
  });

  it.each(["2015", "2018", "2021"] as const)(
    "is ASCII-lex for edition %s",
    (edition) => {
      const compare = compareImportEntry(edition);
      expect(sortWith(["foo2", "foo10", "foo1"], compare)).toEqual([
        "foo1",
        "foo10",
        "foo2",
      ]);
    },
  );
});

describe("compareImportEntry — version-sort under edition 2024", () => {
  const compare = compareImportEntry("2024");

  it("sorts foo2 before foo10 numerically", () => {
    expect(sortWith(["foo2", "foo10", "foo1"], compare)).toEqual([
      "foo1",
      "foo2",
      "foo10",
    ]);
  });

  it("handles a bare digit run", () => {
    expect(sortWith(["10", "2", "1"], compare)).toEqual(["1", "2", "10"]);
  });

  it("uses the shorter segment as a tie-breaker when one is a prefix", () => {
    expect(sortWith(["foo10bar", "foo10"], compare)).toEqual([
      "foo10",
      "foo10bar",
    ]);
  });

  it("treats alphabetic runs ASCII-lex", () => {
    expect(sortWith(["b", "a"], compare)).toEqual(["a", "b"]);
  });

  it("compares digit runs with leading zeros as tie-breakers", () => {
    // 01 and 1 are numerically equal, so the shorter run wins.
    expect(sortWith(["foo1", "foo01"], compare)).toEqual(["foo01", "foo1"]);
  });

  it("handles mixed-length digit runs without overflow", () => {
    const big = "foo" + "9".repeat(40);
    const small = "foo" + "1" + "0".repeat(39);
    // `1` followed by 39 zeros < 40 nines, numerically.
    expect(sortWith([big, small], compare)).toEqual([small, big]);
  });

  it("handles empty strings gracefully", () => {
    expect(sortWith(["a", ""], compare)).toEqual(["", "a"]);
  });

  it("handles single characters", () => {
    expect(sortWith(["b", "a", "c"], compare)).toEqual(["a", "b", "c"]);
  });
});

describe("compareModuleEntry", () => {
  it("is ASCII-lex (foo10 before foo2)", () => {
    expect(sortWith(["foo2", "foo10", "foo1"], compareModuleEntry)).toEqual([
      "foo1",
      "foo10",
      "foo2",
    ]);
  });

  it("does not pin self / super / glob (mod declarations never use those names)", () => {
    // `self` still sorts by ASCII-lex here because pinning is a use-list
    // concern; mod names can't be `self` / `super` / `*` in practice.
    expect(sortWith(["self", "a", "z"], compareModuleEntry)).toEqual([
      "a",
      "self",
      "z",
    ]);
  });
});
