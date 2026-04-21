import type { Children } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  BinaryExpression,
  FunctionDeclaration,
  LetBinding,
} from "../src/components/index.js";
import * as Stc from "../src/components/stc/index.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

function inFn(children: Children) {
  return <FunctionDeclaration name="demo">{children}</FunctionDeclaration>;
}

describe("BinaryExpression", () => {
  it("renders a short arithmetic expression inline", () => {
    expect(<BinaryExpression left="a" operator="+" right="b" />).toRenderTo(
      d`a + b`,
    );
  });

  it("breaks a long arithmetic expression before the operator", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="result">
          <BinaryExpression
            left="some_really_long_left_hand_variable_name_that_stretches_out"
            operator="+"
            right="some_really_long_right_hand_variable_name_that_stretches"
          />
        </LetBinding>,
      ),
    );
    // Break-before: the `+` anchors the start of the continuation
    // line, indented one level from the outer statement.
    const expected = [
      "    let result = some_really_long_left_hand_variable_name_that_stretches_out",
      "        + some_really_long_right_hand_variable_name_that_stretches;",
    ].join("\n");
    expect(source).toContain(expected);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks a long logical && expression before the operator", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="ok" type="bool">
          <BinaryExpression
            left="some_predicate_with_a_long_name(first_argument, second_argument)"
            operator="&&"
            right="another_predicate_with_a_long_name(third_argument, fourth_argument)"
          />
        </LetBinding>,
      ),
    );
    const expected = [
      "    let ok: bool = some_predicate_with_a_long_name(first_argument, second_argument)",
      "        && another_predicate_with_a_long_name(third_argument, fourth_argument);",
    ].join("\n");
    expect(source).toContain(expected);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks a long comparison == expression before the operator", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="eq" type="bool">
          <BinaryExpression
            left="compute_the_left_hand_side_value(argument_a, argument_b)"
            operator="=="
            right="compute_the_right_hand_side_value(argument_c, argument_d)"
          />
        </LetBinding>,
      ),
    );
    const expected = [
      "    let eq: bool = compute_the_left_hand_side_value(argument_a, argument_b)",
      "        == compute_the_right_hand_side_value(argument_c, argument_d);",
    ].join("\n");
    expect(source).toContain(expected);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks an `as` cast before the operator", () => {
    // When the surrounding `let` also wraps, the `as` continuation
    // indents one additional level relative to the post-`=` line,
    // matching rustfmt's output for long `as` casts inside a broken
    // `let` binding.
    const source = toSourceText(
      inFn(
        <LetBinding name="result" type="ReallyLongTypeNameForTesting">
          <BinaryExpression
            left="some_really_long_variable_expression_name_that_fills_up_the_line"
            operator="as"
            right="ReallyLongTypeNameForTesting"
          />
        </LetBinding>,
      ),
    );
    const expected = [
      "    let result: ReallyLongTypeNameForTesting =",
      "        some_really_long_variable_expression_name_that_fills_up_the_line",
      "            as ReallyLongTypeNameForTesting;",
    ].join("\n");
    expect(source).toContain(expected);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks after compound assignment operators", () => {
    // `+=` follows the break-after rule: the operator stays at the
    // end of the current line and the right-hand operand moves to
    // the next indented line. Use an atomic RHS so rustfmt cannot
    // prefer breaking into the call-arg list instead.
    const source = toSourceText(
      <FunctionDeclaration
        name="demo"
        parameters={[{ name: "accumulator", type: "&mut SomeLongType" }]}
      >
        <BinaryExpression
          left="*accumulator"
          operator="+="
          right="some::very::long::path::to::UNBREAKABLE_CONSTANT_NAME_HERE_FOR_LONGER_OVERFLOW_XYZ"
        />
        {";"}
      </FunctionDeclaration>,
    );
    const expected = [
      "    *accumulator +=",
      "        some::very::long::path::to::UNBREAKABLE_CONSTANT_NAME_HERE_FOR_LONGER_OVERFLOW_XYZ;",
    ].join("\n");
    expect(source).toContain(expected);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("treats nested binary expressions independently", () => {
    // Chained binops share no group with their sibling
    // sub-expressions: each `BinaryExpression` decides flat-vs-broken
    // in isolation. Callers that want rustfmt's all-or-none chain
    // break behaviour need to compose accordingly — this primitive
    // deliberately stays leaf-ish.
    expect(
      <BinaryExpression
        left="a"
        operator="+"
        right={<BinaryExpression left="b" operator="+" right="c" />}
      />,
    ).toRenderTo(d`a + b + c`);
  });

  it("stc wrapper matches JSX output", () => {
    expect(
      Stc.BinaryExpression({ left: "a", operator: "+", right: "b" }),
    ).toRenderTo(d`a + b`);
  });
});
