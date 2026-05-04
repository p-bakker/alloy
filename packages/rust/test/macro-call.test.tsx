import type { Children } from "@alloy-js/core";
import { Output, render } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  CrateDirectory,
  FunctionDeclaration,
  LetBinding,
  MacroCall,
  SourceFile,
} from "../src/components/index.js";
import * as Stc from "../src/components/stc/index.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { findFile, toSourceText } from "./utils.js";

function inFile(children: Children) {
  return (
    <Output>
      <CrateDirectory name="my_crate">
        <SourceFile path="lib.rs">{children}</SourceFile>
      </CrateDirectory>
    </Output>
  );
}

/**
 * Render a fixture inside a `CrateDirectory` pinned to the given edition.
 * Mirrors `toSourceText` but threads `edition` through so tests can
 * exercise the edition-sensitive `trace!` special-case entry.
 */
function renderWithEdition(children: Children, edition: string): string {
  const res = render(
    <Output>
      <CrateDirectory name="test_crate" edition={edition}>
        <SourceFile path="test.rs">{children}</SourceFile>
      </CrateDirectory>
    </Output>,
    { insertFinalNewLine: false },
  );
  return findFile(res, "src/test.rs").contents;
}

describe("MacroCall", () => {
  it("renders macro call with paren brackets by default", () => {
    expect(
      inFile(
        <MacroCall name="format" args={['"store::{}"', "self.data.len()"]} />,
      ),
    ).toRenderTo(d`format!("store::{}", self.data.len())`);
  });

  it("renders macro call with bracket delimiters", () => {
    expect(
      inFile(<MacroCall name="vec" args={["1", "2", "3"]} bracket="bracket" />),
    ).toRenderTo(d`vec![1, 2, 3]`);
  });

  it("renders macro call with brace delimiters", () => {
    expect(
      inFile(<MacroCall name="cfg" args={["test"]} bracket="brace" />),
    ).toRenderTo(d`cfg! {test}`);
  });

  it("renders macro call with no arguments", () => {
    expect(inFile(<MacroCall name="todo" />)).toRenderTo(d`todo!()`);
  });

  it("wraps multiple arguments across lines with format-string args bundled", () => {
    // `println!` is in rustfmt's `SPECIAL_CASE_MACROS` with
    // `num_args_before=0`, so once the call wraps, the format string
    // goes on its own line and every remaining arg bundles onto a
    // shared line. Rustfmt additionally falls back to one-per-line
    // when any after-arg is a complex expression (e.g. a function
    // call) even if the bundle would fit; we currently don't
    // introspect arg shape and bundle whenever the line fits
    // `max_width`. See the follow-up note in `macro-call.tsx`.
    expect(
      inFile(
        <MacroCall
          name="println"
          args={[
            '"Long message: {:?}"',
            "var1",
            "var2",
            "var3",
            "Context::new(session_id, metadata, now, source, trace_id, actor)",
          ]}
        />,
      ),
    ).toRenderTo(d`
      println!(
          "Long message: {:?}",
          var1, var2, var3, Context::new(session_id, metadata, now, source, trace_id, actor)
      )
    `);
  });

  it("stc wrapper renders correctly", () => {
    expect(
      inFile(Stc.MacroCall({ name: "println", args: ['"hello"', "name"] })),
    ).toRenderTo(d`println!("hello", name)`);
  });
});

describe("rustfmt conformance", () => {
  it("keeps a short paren macro call flat across all editions", () => {
    const source = toSourceText(
      <FunctionDeclaration name="main">
        <MacroCall name="println" args={['"hi"']} />
        {";"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn main() {
          println!("hi");
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps a long paren macro call without a trailing comma", () => {
    const source = toSourceText(
      <FunctionDeclaration name="main">
        <MacroCall
          name="println"
          args={[
            '"some_very_long_format_string {} {} {} {}"',
            "a_very_long_argument_one",
            "a_very_long_argument_two",
            "a_very_long_argument_three",
            "a_very_long_argument_four",
          ]}
        />
        {";"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn main() {
          println!(
              "some_very_long_format_string {} {} {} {}",
              a_very_long_argument_one,
              a_very_long_argument_two,
              a_very_long_argument_three,
              a_very_long_argument_four
          );
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps a long bracket macro call with a trailing comma", () => {
    const source = toSourceText(
      <FunctionDeclaration name="main">
        <LetBinding name="v">
          <MacroCall
            name="vec"
            bracket="bracket"
            args={[
              "some_long_element_name_one",
              "some_long_element_name_two",
              "some_long_element_name_three",
              "some_long_element_name_four",
              "some_long_element_name_five",
            ]}
          />
        </LetBinding>
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn main() {
          let v = vec![
              some_long_element_name_one,
              some_long_element_name_two,
              some_long_element_name_three,
              some_long_element_name_four,
              some_long_element_name_five,
          ];
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps a paren macro call whose flat form exceeds attr_fn_like_width when the name prefix is counted", () => {
    // Flat form is `format!("…", self.name_prefix_xxx, self.age_prefix_xx)`.
    // The arg list alone measures under the 70-col attr_fn_like_width
    // heuristic, but once the `format!` name (7 chars) and the parens
    // are counted the full flat form exceeds 70 cols, so rustfmt wraps.
    // Because `format!` is in rustfmt's `SPECIAL_CASE_MACROS` with
    // `num_args_before=0`, the wrapped form puts the format string
    // on its own line and bundles the remaining args onto one shared
    // line.
    const source = toSourceText(
      <FunctionDeclaration name="greet">
        <MacroCall
          name="format"
          args={[
            '"Hello, my name is {} and I am {} years old."',
            "self.name_prefix_xxx",
            "self.age_prefix_xx",
          ]}
        />
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn greet() {
          format!(
              "Hello, my name is {} and I am {} years old.",
              self.name_prefix_xxx, self.age_prefix_xx
          )
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps a brace macro call flat with the rustfmt space prefix", () => {
    const source = toSourceText(
      <FunctionDeclaration name="main">
        <LetBinding name="v">
          <MacroCall name="cfg" args={["test"]} bracket="brace" />
        </LetBinding>
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn main() {
          let v = cfg! {test};
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});

describe("MacroCall SPECIAL_CASE_MACROS layout", () => {
  it("keeps a short format!-like call flat", () => {
    // Flat form fits well within `fn_call_width` (60), so the
    // special-case layout isn't triggered — the call stays on one
    // line with all args comma-joined.
    const source = toSourceText(
      <FunctionDeclaration name="main">
        <MacroCall name="format" args={['"fmt {}"', "x", "y"]} />
        {";"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn main() {
          format!("fmt {}", x, y);
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps format! with the format string on its own line and remaining args bundled", () => {
    // The flat form exceeds `fn_call_width` (60) so the call
    // wraps; `format!` has `num_args_before=0`, so the format
    // string goes on its own line and `self.name, self.age`
    // share the next line.
    const source = toSourceText(
      <FunctionDeclaration name="greet">
        <MacroCall
          name="format"
          args={[
            '"Hello, my name is {} and I am {} years old."',
            "self.name",
            "self.age",
          ]}
        />
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn greet() {
          format!(
              "Hello, my name is {} and I am {} years old.",
              self.name, self.age
          )
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps assert_eq! with only the two expected args one-per-line", () => {
    // `assert_eq!` has `num_args_before=2`. With exactly two args
    // `args.length > num_args_before` is `2 > 2` (false), so the
    // special-case path is skipped and the call uses the generic
    // one-per-line wrap.
    const source = toSourceText(
      <FunctionDeclaration name="main">
        <MacroCall
          name="assert_eq"
          args={[
            "some_long_left_expression_here",
            "some_long_right_expression_here",
          ]}
        />
        {";"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn main() {
          assert_eq!(
              some_long_left_expression_here,
              some_long_right_expression_here
          );
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps assert_eq! with a format message by bundling trailing args", () => {
    // `assert_eq!` has `num_args_before=2`, so `left`, `right`, and
    // the format string each get their own line, and the format
    // args bundle on a shared line.
    const source = toSourceText(
      <FunctionDeclaration name="main">
        <MacroCall
          name="assert_eq"
          args={[
            "left_value_expression",
            "right_value_expression",
            '"lhs={} rhs={} ctx={}"',
            "lhs_var",
            "rhs_var",
          ]}
        />
        {";"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn main() {
          assert_eq!(
              left_value_expression, right_value_expression,
              "lhs={} rhs={} ctx={}",
              lhs_var, rhs_var
          );
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps write! where the format string has no trailing args", () => {
    // `write!` has `num_args_before=1`, and with two args
    // (`f` and `"fmt …"`) the after-bundle is empty — the wrapped
    // form is just `f,` then the format string on its own line
    // with no trailing bundled line.
    const source = toSourceText(
      <FunctionDeclaration name="write_it">
        <MacroCall
          name="write"
          args={[
            "some_long_formatter_name",
            '"a somewhat long format string that forces wrap {}"',
          ]}
        />
        {";"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn write_it() {
          write!(
              some_long_formatter_name,
              "a somewhat long format string that forces wrap {}"
          );
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("applies the special-case layout to trace! under edition 2024", () => {
    // `trace!` is only in the special-case table under edition
    // 2024+. The fixture uses args that force the paren-form call
    // to wrap; under 2024 the format string gets its own line.
    const source = renderWithEdition(
      <FunctionDeclaration name="work">
        <MacroCall
          name="trace"
          args={[
            '"trace message: prefix {} and suffix {} here"',
            "some_long_arg_one",
            "some_long_arg_two",
          ]}
        />
        {";"}
      </FunctionDeclaration>,
      "2024",
    );

    expect(source).toEqual(d`
      fn work() {
          trace!(
              "trace message: prefix {} and suffix {} here",
              some_long_arg_one, some_long_arg_two
          );
      }
    `);
  });

  it("falls back to the generic wrap for trace! under edition 2021", () => {
    // `trace!` is not in the special-case table under pre-2024
    // editions, so the call uses the generic one-per-line wrap.
    const source = renderWithEdition(
      <FunctionDeclaration name="work">
        <MacroCall
          name="trace"
          args={[
            '"trace message: prefix {} and suffix {} here"',
            "some_long_arg_one",
            "some_long_arg_two",
          ]}
        />
        {";"}
      </FunctionDeclaration>,
      "2021",
    );

    expect(source).toEqual(d`
      fn work() {
          trace!(
              "trace message: prefix {} and suffix {} here",
              some_long_arg_one,
              some_long_arg_two
          );
      }
    `);
  });

  it("still hoists a nested macro under assert! with a single arg", () => {
    // `assert!` has `num_args_before=1`. With a single arg,
    // `args.length > num_args_before` is `1 > 1` (false), so the
    // special-case path is skipped and the nested-macro hoist
    // (for `outer!(inner!(…))`) applies as before.
    const source = toSourceText(
      <FunctionDeclaration name="main">
        <MacroCall
          name="assert"
          args={[
            <MacroCall
              name="matches"
              args={[
                "some_value_expression",
                "SomeEnum::LongVariantNameWithDetails(_)",
              ]}
            />,
          ]}
        />
        {";"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn main() {
          assert!(matches!(
              some_value_expression,
              SomeEnum::LongVariantNameWithDetails(_)
          ));
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});
