import { code, memberRefkey, Output, refkey, render } from "@alloy-js/core";
import { describe, expect, it } from "vitest";
import { findFile, TestCrate } from "../../test/utils.js";
import { FunctionDeclaration } from "./function/function.js";
import { LetDeclaration } from "./var/declaration.js";
import { MacroCall } from "./macro/macro-call.js";
import { ForLoop } from "./expression/loops.js";
import { AssignmentStatement } from "./expression/assignment.js";
import { IfExpression } from "./expression/if-expression.js";
import { CrateDirectory } from "./CrateDirectory.js";
import { SourceDirectory } from "./SourceDirectory.js";
import { SourceFile } from "./SourceFile.js";
import { StructDeclaration, StructField } from "./struct/declaration.js";

describe("StatementList", () => {
  it("auto-separates statement component children with newlines", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="example">
          <LetDeclaration name="x">42</LetDeclaration>
          <LetDeclaration name="y">10</LetDeclaration>
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn example() {
          let x = 42;
          let y = 10;
      }
    `);
  });

  it("merges trailing semicolon onto preceding expression component", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="example">
          <MacroCall name="println">{"\"hello\""}</MacroCall>;
          <MacroCall name="println">{"\"world\""}</MacroCall>;
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn example() {
          println!("hello");
          println!("world");
      }
    `);
  });

  it("preserves last expression without semicolon as return value", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="example" returns="String">
          <LetDeclaration name="x">42</LetDeclaration>
          <MacroCall name="format">{"\"value: {}\", x"}</MacroCall>
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn example() -> String {
          let x = 42;
          format!("value: {}", x)
      }
    `);
  });

  it("concatenates inline text fragments without inserting hardlines", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="example">
          println!("{"{"}{"}"}", item)
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn example() {
          println!("{}", item)
      }
    `);
  });

  it("does not split code template literals with refkeys", () => {
    const personKey = refkey("PersonStatementList");
    const nameFieldKey = refkey("PersonStatementList", "nameField");

    const res = render(
      <Output>
        <CrateDirectory name="test-crate">
          <SourceDirectory path=".">
            <SourceFile path="lib.rs">
              <StructDeclaration name="Person" refkey={personKey} visibility="pub">
                <StructField name="name" type="String" refkey={nameFieldKey} visibility="pub" />
              </StructDeclaration>
              <FunctionDeclaration
                name="get_name"
                visibility="pub"
                returns="String"
              >
                {code`let val = ${memberRefkey(personKey, nameFieldKey)};`}
              </FunctionDeclaration>
            </SourceFile>
          </SourceDirectory>
        </CrateDirectory>
      </Output>,
    );

    const contents = findFile(res, "lib.rs").contents;
    expect(contents).toContain("let val = Person::name;");
  });

  it("mixes statement components, expression+semicolon, and text correctly", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="example">
          <LetDeclaration name="x">42</LetDeclaration>
          <MacroCall name="println">{"\"x = {}\", x"}</MacroCall>;
          x + 1
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn example() {
          let x = 42;
          println!("x = {}", x);
          x + 1
      }
    `);
  });

  it("inserts hardline after control flow blocks", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="example">
          <ForLoop pattern="i" iter="0..10">
            <MacroCall name="println">{"\"i\""}</MacroCall>;
          </ForLoop>
          <LetDeclaration name="x">42</LetDeclaration>
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn example() {
          for i in 0..10 {
              println!("i");
          }
          let x = 42;
      }
    `);
  });

  it("inserts hardline after if expression", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="example">
          <IfExpression condition="x > 0">
            <MacroCall name="println">{"\"positive\""}</MacroCall>;
          </IfExpression>
          <LetDeclaration name="y">0</LetDeclaration>
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn example() {
          if x > 0 {
              println!("positive");
          }
          let y = 0;
      }
    `);
  });

  it("inserts hardline after raw text ending with semicolon", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="example">
          {"use crate::models::Status;"}
          <MacroCall name="assert">{"matches!(Status::Active, Status::Active)"}</MacroCall>;
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn example() {
          use crate::models::Status;
          assert!(matches!(Status::Active, Status::Active));
      }
    `);
  });

  it("inserts hardline after assignment statement", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="example">
          <AssignmentStatement target="x" op="+=">1</AssignmentStatement>
          <MacroCall name="println">{"\"done\""}</MacroCall>;
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn example() {
          x += 1;
          println!("done");
      }
    `);
  });
});
