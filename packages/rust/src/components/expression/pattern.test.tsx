import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import {
  TuplePattern,
  StructPattern,
  SlicePattern,
  RefPattern,
} from "./pattern.js";

describe("TuplePattern", () => {
  it("renders a tuple pattern", () => {
    expect(
      <TestCrate>
        <TuplePattern>{["x", "y"]}</TuplePattern>
      </TestCrate>,
    ).toRenderTo(`
      (x, y)
    `);
  });

  it("renders a single-element tuple pattern", () => {
    expect(
      <TestCrate>
        <TuplePattern>{["x"]}</TuplePattern>
      </TestCrate>,
    ).toRenderTo(`
      (x)
    `);
  });
});

describe("StructPattern", () => {
  it("renders a struct destructuring pattern", () => {
    expect(
      <TestCrate>
        <StructPattern
          type="Point"
          fields={[{ name: "x" }, { name: "y" }]}
        />
      </TestCrate>,
    ).toRenderTo(`
      Point { x, y }
    `);
  });

  it("renders a struct pattern with rename", () => {
    expect(
      <TestCrate>
        <StructPattern
          type="Point"
          fields={[{ name: "x", rename: "a" }, { name: "y", rename: "b" }]}
        />
      </TestCrate>,
    ).toRenderTo(`
      Point { x: a, y: b }
    `);
  });

  it("renders a struct pattern with rest", () => {
    expect(
      <TestCrate>
        <StructPattern
          type="Point"
          fields={[{ name: "x" }]}
          rest
        />
      </TestCrate>,
    ).toRenderTo(`
      Point { x, .. }
    `);
  });
});

describe("SlicePattern", () => {
  it("renders a slice pattern", () => {
    expect(
      <TestCrate>
        <SlicePattern>{["first", "second"]}</SlicePattern>
      </TestCrate>,
    ).toRenderTo(`
      [first, second]
    `);
  });
});

describe("RefPattern", () => {
  it("renders a ref pattern", () => {
    expect(
      <TestCrate>
        <RefPattern>x</RefPattern>
      </TestCrate>,
    ).toRenderTo(`
      &x
    `);
  });

  it("renders a mutable ref pattern", () => {
    expect(
      <TestCrate>
        <RefPattern mutable>x</RefPattern>
      </TestCrate>,
    ).toRenderTo(`
      &mut x
    `);
  });
});
