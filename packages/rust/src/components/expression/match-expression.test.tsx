import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { MatchExpression, MatchArm } from "./match-expression.js";

describe("MatchExpression", () => {
  it("renders a simple match expression", () => {
    expect(
      <TestCrate>
        <MatchExpression expr="x">
          <MatchArm pattern="1">
            {"\"one\""}
          </MatchArm>
          <MatchArm pattern="_">
            {"\"other\""}
          </MatchArm>
        </MatchExpression>
      </TestCrate>,
    ).toRenderTo(`
      match x {
          1 => "one",
          _ => "other",
      }
    `);
  });

  it("renders a match with guard clause", () => {
    expect(
      <TestCrate>
        <MatchExpression expr="x">
          <MatchArm pattern="n" guard="n > 0">
            {"\"positive\""}
          </MatchArm>
          <MatchArm pattern="_">
            {"\"non-positive\""}
          </MatchArm>
        </MatchExpression>
      </TestCrate>,
    ).toRenderTo(`
      match x {
          n if n > 0 => "positive",
          _ => "non-positive",
      }
    `);
  });

  it("renders a match on enum variants", () => {
    expect(
      <TestCrate>
        <MatchExpression expr="opt">
          <MatchArm pattern="Some(val)">
            val
          </MatchArm>
          <MatchArm pattern="None">
            0
          </MatchArm>
        </MatchExpression>
      </TestCrate>,
    ).toRenderTo(`
      match opt {
          Some(val) => val,
          None => 0,
      }
    `);
  });
});
