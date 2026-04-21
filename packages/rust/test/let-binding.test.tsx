import type { Children } from "@alloy-js/core";
import { Output, code } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  BlockExpression,
  CrateDirectory,
  ElseClause,
  FieldInit,
  FunctionCallExpression,
  FunctionDeclaration,
  IfExpression,
  LetBinding,
  MatchArm,
  MatchExpression,
  SourceFile,
  StructExpression,
} from "../src/components/index.js";
import * as Stc from "../src/components/stc/index.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

function inFile(children: Children) {
  return (
    <Output>
      <CrateDirectory name="my_crate">
        <SourceFile path="lib.rs">{children}</SourceFile>
      </CrateDirectory>
    </Output>
  );
}

describe("LetBinding", () => {
  it("renders a simple let binding", () => {
    expect(
      inFile(<LetBinding name="before">{code`self.data.len()`}</LetBinding>),
    ).toRenderTo(d`
      let before = self.data.len();
    `);
  });

  it("renders mutable bindings", () => {
    expect(
      inFile(
        <LetBinding name="entry" mutable>{code`Entry::default()`}</LetBinding>,
      ),
    ).toRenderTo(d`
      let mut entry = Entry::default();
    `);
  });

  it("renders type annotations", () => {
    expect(
      inFile(
        <LetBinding
          name="entry"
          type="Entry<V>"
        >{code`Entry::default()`}</LetBinding>,
      ),
    ).toRenderTo(d`
      let entry: Entry<V> = Entry::default();
    `);
  });

  it("renders let binding without initializer", () => {
    expect(inFile(<LetBinding name="slot" />)).toRenderTo(d`
      let slot;
    `);
  });

  it("renders destructuring patterns", () => {
    expect(inFile(<LetBinding name="(key, value)">{code`pair`}</LetBinding>))
      .toRenderTo(d`
      let (key, value) = pair;
    `);
  });

  it("stc wrapper renders the same output", () => {
    expect(
      inFile(
        Stc.LetBinding({ name: "count", mutable: true }).children([
          "items.len()",
        ]),
      ),
    ).toRenderTo(d`
      let mut count = items.len();
    `);
  });

  it("composes with sibling statements separated by hbr", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo" returnType="i32">
        <LetBinding name="a">{code`1`}</LetBinding>
        <hbr />
        <LetBinding name="b">{code`a + 1`}</LetBinding>
        <hbr />
        {code`a + b`}
      </FunctionDeclaration>,
    );

    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});

describe("LetBinding rustfmt conformance", () => {
  it("keeps a block-expression RHS opener on the let line", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo">
        <LetBinding name="x">
          <BlockExpression>
            <LetBinding name="a">{code`compute()`}</LetBinding>
            <hbr />
            {code`a + 1`}
          </BlockExpression>
        </LetBinding>
      </FunctionDeclaration>,
    );
    expect(source).toContain("let x = {");
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps a struct-literal RHS head on the let line when it wraps", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo">
        <LetBinding name="v">
          <StructExpression type="SomewhatLongStructName">
            <FieldInit name="first_field_name">{code`first_value`}</FieldInit>
            <FieldInit name="second_field_name">{code`second_value`}</FieldInit>
            <FieldInit name="third_field_name">{code`third_value`}</FieldInit>
          </StructExpression>
        </LetBinding>
      </FunctionDeclaration>,
    );
    expect(source).toContain("let v = SomewhatLongStructName {");
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps an if-expression RHS head on the let line", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo">
        <LetBinding name="x">
          <IfExpression condition={code`some_condition`}>
            {code`do_thing()`}
            <ElseClause>{code`do_other_thing()`}</ElseClause>
          </IfExpression>
        </LetBinding>
      </FunctionDeclaration>,
    );
    expect(source).toContain("let x = if some_condition {");
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps a match-expression RHS head on the let line", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo">
        <LetBinding name="x">
          <MatchExpression expression={code`value`}>
            <MatchArm pattern="Some(v)">{code`v`}</MatchArm>
            <MatchArm pattern="None">{code`0`}</MatchArm>
          </MatchExpression>
        </LetBinding>
      </FunctionDeclaration>,
    );
    expect(source).toContain("let x = match value {");
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks after = when the rhs is an atomic scalar that overflows", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo">
        <LetBinding name="my_very_long_variable_name_here">
          {code`some::very::long::path::to::AN_EXTREMELY_LONG_UNBREAKABLE_CONST_NAME`}
        </LetBinding>
      </FunctionDeclaration>,
    );
    const expected = [
      "    let my_very_long_variable_name_here =",
      "        some::very::long::path::to::AN_EXTREMELY_LONG_UNBREAKABLE_CONST_NAME;",
    ].join("\n");
    expect(source).toContain(expected);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("scenario 1: everything fits on a single line", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo">
        <LetBinding name="x">
          <FunctionCallExpression target="some_fn" args={["first", "second"]} />
        </LetBinding>
      </FunctionDeclaration>,
    );
    expect(source).toContain("    let x = some_fn(first, second);");
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("scenario 2: let flat, args broken when rhs overflows its own line too", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo">
        <LetBinding name="my_name">
          <FunctionCallExpression
            target="some_function_that_takes_many_args"
            args={[
              "argument_one_very_long",
              "argument_two_very_long",
              "argument_three_extra_long",
            ]}
          />
        </LetBinding>
      </FunctionDeclaration>,
    );
    const expected = [
      "    let my_name = some_function_that_takes_many_args(",
      "        argument_one_very_long,",
      "        argument_two_very_long,",
      "        argument_three_extra_long,",
      "    );",
    ].join("\n");
    expect(source).toContain(expected);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("scenario 3: break after = when whole line overflows but rhs fits alone", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo">
        <LetBinding name="my_extremely_long_variable_name">
          <FunctionCallExpression
            target="some_function_that_takes_args"
            args={["argument_one_long", "argument_two_long"]}
          />
        </LetBinding>
      </FunctionDeclaration>,
    );
    const expected = [
      "    let my_extremely_long_variable_name =",
      "        some_function_that_takes_args(argument_one_long, argument_two_long);",
    ].join("\n");
    expect(source).toContain(expected);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("scenario 4: break after = and break args when neither half fits", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo">
        <LetBinding name="absurdly_long_variable_name_that_definitely_cannot_fit_even_close_to_anything_else">
          <FunctionCallExpression
            target="some_function_that_takes_many_args"
            args={[
              "argument_one_very_long",
              "argument_two_very_long",
              "argument_three_extra_long",
            ]}
          />
        </LetBinding>
      </FunctionDeclaration>,
    );
    const expected = [
      "    let absurdly_long_variable_name_that_definitely_cannot_fit_even_close_to_anything_else =",
      "        some_function_that_takes_many_args(",
      "            argument_one_very_long,",
      "            argument_two_very_long,",
      "            argument_three_extra_long,",
      "        );",
    ].join("\n");
    expect(source).toContain(expected);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});
