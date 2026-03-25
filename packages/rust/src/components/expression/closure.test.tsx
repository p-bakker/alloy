import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { ClosureExpression } from "./closure.js";

describe("ClosureExpression", () => {
  it("renders a simple closure with no params", () => {
    expect(
      <TestCrate>
        <ClosureExpression>
          42
        </ClosureExpression>
      </TestCrate>,
    ).toRenderTo(`
      || 42
    `);
  });

  it("renders a closure with untyped params", () => {
    expect(
      <TestCrate>
        <ClosureExpression params={[{ name: "x" }, { name: "y" }]}>
          x + y
        </ClosureExpression>
      </TestCrate>,
    ).toRenderTo(`
      |x, y| x + y
    `);
  });

  it("renders a closure with typed params and return type", () => {
    expect(
      <TestCrate>
        <ClosureExpression
          params={[{ name: "x", type: "i32" }]}
          returns="i32"
        >
          x + 1
        </ClosureExpression>
      </TestCrate>,
    ).toRenderTo(`
      |x: i32| -> i32 { x + 1 }
    `);
  });

  it("renders a move closure", () => {
    expect(
      <TestCrate>
        <ClosureExpression move params={[{ name: "x" }]}>
          x
        </ClosureExpression>
      </TestCrate>,
    ).toRenderTo(`
      move |x| x
    `);
  });

  it("renders an async move closure", () => {
    expect(
      <TestCrate>
        <ClosureExpression async move params={[{ name: "x" }]}>
          x
        </ClosureExpression>
      </TestCrate>,
    ).toRenderTo(`
      async move |x| x
    `);
  });
});
