import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { BinaryExpression } from "./binary-expression.js";

describe("BinaryExpression", () => {
  it("renders a comparison", () => {
    expect(
      <TestCrate>
        <BinaryExpression left="self.age" op=">=" right="18" />
      </TestCrate>,
    ).toRenderTo(`
      self.age >= 18
    `);
  });

  it("renders an arithmetic expression", () => {
    expect(
      <TestCrate>
        <BinaryExpression left="x" op="+" right="y" />
      </TestCrate>,
    ).toRenderTo(`
      x + y
    `);
  });

  it("renders a logical expression", () => {
    expect(
      <TestCrate>
        <BinaryExpression left="a" op="&&" right="b" />
      </TestCrate>,
    ).toRenderTo(`
      a && b
    `);
  });
});
