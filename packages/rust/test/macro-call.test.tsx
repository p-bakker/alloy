import type { Children } from "@alloy-js/core";
import { Output } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  CrateDirectory,
  FunctionDeclaration,
  MacroCall,
  SourceFile,
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

  it("wraps multiple arguments across lines", () => {
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
          var1,
          var2,
          var3,
          Context::new(session_id, metadata, now, source, trace_id, actor)
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
        {"let v = "}
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
        {";"}
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

  it("keeps a brace macro call flat with the rustfmt space prefix", () => {
    const source = toSourceText(
      <FunctionDeclaration name="main">
        {"let v = "}
        <MacroCall name="cfg" args={["test"]} bracket="brace" />
        {";"}
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
