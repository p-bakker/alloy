import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { MacroRules } from "./macro-rules.js";
import { MacroCall } from "./macro-call.js";

describe("MacroRules", () => {
  it("declares an empty macro_rules!", () => {
    expect(
      <TestCrate>
        <MacroRules name="my_macro" />
      </TestCrate>,
    ).toRenderTo(`
      macro_rules! my_macro {}
    `);
  });

  it("declares a macro_rules! with body", () => {
    expect(
      <TestCrate>
        <MacroRules name="my_vec">
          {"() => {Vec::new()};"}
        </MacroRules>
      </TestCrate>,
    ).toRenderTo(`
      macro_rules! my_vec {
          () => {Vec::new()};
      }
    `);
  });

  it("declares a pub macro with #[macro_export]", () => {
    expect(
      <TestCrate>
        <MacroRules name="my_macro" visibility="pub" />
      </TestCrate>,
    ).toRenderTo(`
      #[macro_export]
      macro_rules! my_macro {}
    `);
  });

  it("omits #[macro_export] for private macros", () => {
    expect(
      <TestCrate>
        <MacroRules name="helper" visibility="private" />
      </TestCrate>,
    ).toRenderTo(`
      macro_rules! helper {}
    `);
  });
});

describe("MacroCall", () => {
  it("renders a macro call with default parentheses", () => {
    expect(
      <TestCrate>
        <MacroCall name="println">"Hello, world!"</MacroCall>
      </TestCrate>,
    ).toRenderTo(`
      println!("Hello, world!")
    `);
  });

  it("renders a macro call with square brackets", () => {
    expect(
      <TestCrate>
        <MacroCall name="vec" delimiter="[">1, 2, 3</MacroCall>
      </TestCrate>,
    ).toRenderTo(`
      vec![1, 2, 3]
    `);
  });

  it("renders a macro call with curly braces", () => {
    expect(
      <TestCrate>
        <MacroCall name="lazy_static" delimiter="{">
          static ref FOO: u32 = 42;
        </MacroCall>
      </TestCrate>,
    ).toRenderTo(`
      lazy_static!{static ref FOO: u32 = 42;}
    `);
  });

  it("renders an empty macro call", () => {
    expect(
      <TestCrate>
        <MacroCall name="todo" />
      </TestCrate>,
    ).toRenderTo(`
      todo!()
    `);
  });
});
