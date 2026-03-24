import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { IfExpression, IfLetExpression } from "./if-expression.js";

describe("IfExpression", () => {
  it("renders a simple if expression", () => {
    expect(
      <TestCrate>
        <IfExpression condition="x > 0">
          {"\"positive\""}
        </IfExpression>
      </TestCrate>,
    ).toRenderTo(`
      if x > 0 {
        "positive"
      }
    `);
  });

  it("renders an if-else expression", () => {
    expect(
      <TestCrate>
        <IfExpression condition="x > 0" else={"\"non-positive\""}>
          {"\"positive\""}
        </IfExpression>
      </TestCrate>,
    ).toRenderTo(`
      if x > 0 {
        "positive"
      } else {
        "non-positive"
      }
    `);
  });
});

describe("IfLetExpression", () => {
  it("renders an if let expression", () => {
    expect(
      <TestCrate>
        <IfLetExpression pattern="Some(val)" expr="opt">
          val
        </IfLetExpression>
      </TestCrate>,
    ).toRenderTo(`
      if let Some(val) = opt {
        val
      }
    `);
  });

  it("renders an if let with else", () => {
    expect(
      <TestCrate>
        <IfLetExpression pattern="Some(val)" expr="opt" else={"0"}>
          val
        </IfLetExpression>
      </TestCrate>,
    ).toRenderTo(`
      if let Some(val) = opt {
        val
      } else {
        0
      }
    `);
  });
});
