import type { Children } from "@alloy-js/core";
import { code } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import { FunctionDeclaration } from "../src/components/function-declaration.js";
import { LetBinding } from "../src/components/let-binding.js";
import {
  FieldInit,
  StructExpression,
} from "../src/components/struct-expression.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

function inFn(children: Children) {
  return <FunctionDeclaration name="demo">{children}</FunctionDeclaration>;
}

describe("StructExpression", () => {
  it("renders a short literal flat", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="v">
          <StructExpression type="Foo">
            <FieldInit name="x">{code`1`}</FieldInit>
            <FieldInit name="y">{code`2`}</FieldInit>
          </StructExpression>
        </LetBinding>,
      ),
    );

    expect(source).toBe(d`
      fn demo() {
          let v = Foo { x: 1, y: 2 };
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps a long literal across lines", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="v">
          <StructExpression type="SomewhatLongStructName">
            <FieldInit name="first_field_name">{code`first_value`}</FieldInit>
            <FieldInit name="second_field_name">{code`second_value`}</FieldInit>
            <FieldInit name="third_field_name">{code`third_value`}</FieldInit>
          </StructExpression>
        </LetBinding>,
      ),
    );

    expect(source).toBe(d`
      fn demo() {
          let v = SomewhatLongStructName {
              first_field_name: first_value,
              second_field_name: second_value,
              third_field_name: third_value,
          };
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("emits spread without trailing comma when wrapped", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="v">
          <StructExpression type="SomewhatLongStructName" spread={code`base`}>
            <FieldInit name="first_field_name">{code`first_value`}</FieldInit>
            <FieldInit name="second_field_name">{code`second_value`}</FieldInit>
          </StructExpression>
        </LetBinding>,
      ),
    );

    expect(source).toBe(d`
      fn demo() {
          let v = SomewhatLongStructName {
              first_field_name: first_value,
              second_field_name: second_value,
              ..base
          };
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("emits spread inline for short literals", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="v">
          <StructExpression type="Foo" spread={code`base`}>
            <FieldInit name="x">{code`1`}</FieldInit>
          </StructExpression>
        </LetBinding>,
      ),
    );

    expect(source).toBe(d`
      fn demo() {
          let v = Foo { x: 1, ..base };
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("renders shorthand field initialization", () => {
    expect(
      <StructExpression type="Entry">
        <FieldInit name="value" />
      </StructExpression>,
    ).toRenderTo(`Entry { value }`);
  });

  it("renders an empty literal as `Type {}`", () => {
    expect(<StructExpression type="Unit" />).toRenderTo(`Unit {}`);
  });

  it("breaks when flat body exceeds struct_lit_width even if line fits", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="v">
          <StructExpression type="Self" spread={code`self`}>
            <FieldInit name="max_capacity">{code`capacity`}</FieldInit>
          </StructExpression>
        </LetBinding>,
      ),
    );

    expect(source).toBe(d`
      fn demo() {
          let v = Self {
              max_capacity: capacity,
              ..self
          };
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("struct literal under 18 cols locks flat and forces break after `=`", () => {
    const source = toSourceText(
      inFn(
        <LetBinding name="very_long_variable_identifier_that_forces_the_line_to_overflow_the_print_width">
          <StructExpression type="Foo">
            <FieldInit name="x">{code`1`}</FieldInit>
          </StructExpression>
        </LetBinding>,
      ),
    );

    expect(source).toBe(d`
      fn demo() {
          let very_long_variable_identifier_that_forces_the_line_to_overflow_the_print_width =
              Foo { x: 1 };
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});
