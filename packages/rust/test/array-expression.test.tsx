import type { Children } from "@alloy-js/core";
import { code } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import { ArrayExpression } from "../src/components/array-expression.js";
import { FunctionDeclaration } from "../src/components/function-declaration.js";
import { LetBinding } from "../src/components/let-binding.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

function inFn(children: Children) {
  return <FunctionDeclaration name="demo">{children}</FunctionDeclaration>;
}

describe("ArrayExpression", () => {
  it("renders an empty array as `[]`", () => {
    expect(<ArrayExpression />).toRenderTo(`[]`);
  });

  it("renders a short literal flat", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="v">
          <ArrayExpression>
            {code`1`}
            {code`2`}
            {code`3`}
          </ArrayExpression>
        </LetBinding>,
      ),
    );

    expect(source).toBe(d`
      fn demo() {
          let v = [1, 2, 3];
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks one element per line when flat form exceeds array_width", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="v">
          <ArrayExpression>
            {code`element_one_with_a_quite_long_identifier_name`}
            {code`element_two_with_a_quite_long_identifier_name`}
            {code`element_three_with_a_quite_long_identifier_name`}
          </ArrayExpression>
        </LetBinding>,
      ),
    );

    expect(source).toBe(d`
      fn demo() {
          let v = [
              element_one_with_a_quite_long_identifier_name,
              element_two_with_a_quite_long_identifier_name,
              element_three_with_a_quite_long_identifier_name,
          ];
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("short array locks flat and forces break after `=`", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="very_long_variable_identifier_that_forces_the_line_to_overflow_the_print_widthXX">
          <ArrayExpression>
            {code`1`}
            {code`2`}
            {code`3`}
          </ArrayExpression>
        </LetBinding>,
      ),
    );

    expect(source).toBe(d`
      fn demo() {
          let very_long_variable_identifier_that_forces_the_line_to_overflow_the_print_widthXX =
              [1, 2, 3];
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});
