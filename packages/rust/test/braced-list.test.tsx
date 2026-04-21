import "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import { BracedList } from "../src/components/primitives/braced-list.js";
import { toSourceText } from "./utils.js";

describe("BracedList forceBreakIf", () => {
  it("forces the list to break when the predicate returns true for any item", () => {
    const source = toSourceText(
      <BracedList
        forceBreakIf={(s) => typeof s === "string" && s.includes("{")}
      >
        {["a", "b::{inner}"]}
      </BracedList>,
    );

    expect(source).toBe(["{", "    a,", "    b::{inner},", "}"].join("\n"));
  });

  it("stays flat when the predicate returns false for every item", () => {
    const source = toSourceText(
      <BracedList
        forceBreakIf={(s) => typeof s === "string" && s.includes("{")}
      >
        {["a", "b"]}
      </BracedList>,
    );

    expect(source).toBe("{a, b}");
  });

  it("stays flat when no predicate is supplied (regression for the default)", () => {
    const source = toSourceText(<BracedList>{["a", "b::{inner}"]}</BracedList>);

    expect(source).toBe("{a, b::{inner}}");
  });
});
