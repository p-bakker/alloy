import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { StructDeclaration, StructField } from "./declaration.js";

describe("StructDeclaration", () => {
  it("declares an empty struct", () => {
    expect(
      <TestCrate>
        <StructDeclaration name="Empty" />
      </TestCrate>,
    ).toRenderTo(`
      struct Empty {}
    `);
  });

  it("declares a struct with a single field", () => {
    expect(
      <TestCrate>
        <StructDeclaration name="Wrapper">
          <StructField name="value" type="i32" />
        </StructDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      struct Wrapper {
          value: i32,
      }
    `);
  });

  it("declares a struct with multiple fields", () => {
    expect(
      <TestCrate>
        <StructDeclaration name="Person">
          <StructField name="name" type="String" />
          <hbr />
          <StructField name="age" type="u32" />
        </StructDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      struct Person {
          name: String,
          age: u32,
      }
    `);
  });

  it("declares a struct with pub fields", () => {
    expect(
      <TestCrate>
        <StructDeclaration name="Person">
          <StructField name="name" type="String" visibility="pub" />
          <hbr />
          <StructField name="age" type="u32" visibility="pub" />
        </StructDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      struct Person {
          pub name: String,
          pub age: u32,
      }
    `);
  });

  it("declares a pub struct", () => {
    expect(
      <TestCrate>
        <StructDeclaration name="Person" visibility="pub" />
      </TestCrate>,
    ).toRenderTo(`
      pub struct Person {}
    `);
  });

  it("declares a struct with doc comment", () => {
    expect(
      <TestCrate>
        <StructDeclaration name="Person" doc="A person record." />
      </TestCrate>,
    ).toRenderTo(`
      /// A person record.
      struct Person {}
    `);
  });
});
