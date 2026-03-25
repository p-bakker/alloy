import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { FunctionDeclaration } from "./function.js";

describe("FunctionDeclaration", () => {
  it("declares a simple function with no params", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="do_nothing" />
      </TestCrate>,
    ).toRenderTo(`
      fn do_nothing() {}
    `);
  });

  it("declares a function with params and return type", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration
          name="add"
          parameters={[
            { name: "a", type: "i32" },
            { name: "b", type: "i32" },
          ]}
          returns="i32"
        >
          a + b
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn add(a: i32, b: i32) -> i32 {
          a + b
      }
    `);
  });

  it("declares an async function", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="fetch_data" async />
      </TestCrate>,
    ).toRenderTo(`
      async fn fetch_data() {}
    `);
  });

  it("declares a function with self param", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="get_name" selfParam="&self" returns="String" />
      </TestCrate>,
    ).toRenderTo(`
      fn get_name(&self) -> String {}
    `);
  });

  it("declares a function with type parameters", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration
          name="identity"
          typeParameters={[{ name: "T" }]}
          parameters={[{ name: "value", type: "T" }]}
          returns="T"
        >
          value
        </FunctionDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      fn identity<T>(value: T) -> T {
          value
      }
    `);
  });

  it("declares a pub function", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="public_fn" visibility="pub" />
      </TestCrate>,
    ).toRenderTo(`
      pub fn public_fn() {}
    `);
  });

  it("declares a function with doc comment", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="greet" doc="Say hello." />
      </TestCrate>,
    ).toRenderTo(`
      /// Say hello.
      fn greet() {}
    `);
  });

  it("declares an unsafe function", () => {
    expect(
      <TestCrate>
        <FunctionDeclaration name="dangerous_op" unsafe />
      </TestCrate>,
    ).toRenderTo(`
      unsafe fn dangerous_op() {}
    `);
  });
});
