import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import {
  ConstDeclaration,
  StaticDeclaration,
} from "./declaration.js";

describe("ConstDeclaration", () => {
  it("declares a const", () => {
    expect(
      <TestCrate>
        <ConstDeclaration name="MAX_SIZE" type="u32">
          100
        </ConstDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      const MAX_SIZE: u32 = 100;
    `);
  });

  it("declares a pub const", () => {
    expect(
      <TestCrate>
        <ConstDeclaration name="PI_VALUE" type="f64" visibility="pub">
          3.14
        </ConstDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      pub const PI_VALUE: f64 = 3.14;
    `);
  });

  it("declares a const with doc comment", () => {
    expect(
      <TestCrate>
        <ConstDeclaration name="MAX_RETRIES" type="u32" doc="Maximum retry count.">
          3
        </ConstDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      /// Maximum retry count.
      const MAX_RETRIES: u32 = 3;
    `);
  });
});

describe("StaticDeclaration", () => {
  it("declares an immutable static", () => {
    expect(
      <TestCrate>
        <StaticDeclaration name="APP_NAME" type="&str">
          "MyApp"
        </StaticDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      static APP_NAME: &str = "MyApp";
    `);
  });

  it("declares a mutable static", () => {
    expect(
      <TestCrate>
        <StaticDeclaration name="COUNTER" type="u32" mutable>
          0
        </StaticDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      static mut COUNTER: u32 = 0;
    `);
  });

  it("declares a pub static", () => {
    expect(
      <TestCrate>
        <StaticDeclaration name="GLOBAL_CONFIG" type="&str" visibility="pub">
          "default"
        </StaticDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      pub static GLOBAL_CONFIG: &str = "default";
    `);
  });
});
