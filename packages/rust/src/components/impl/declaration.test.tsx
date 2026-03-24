import { describe, expect, it } from "vitest";
import { TestCrate } from "../../../test/utils.js";
import { ImplBlock } from "./declaration.js";
import { FunctionDeclaration } from "../function/function.js";

describe("ImplBlock", () => {
  it("declares an empty impl block", () => {
    expect(
      <TestCrate>
        <ImplBlock type="Person" />
      </TestCrate>,
    ).toRenderTo(`
      impl Person {}
    `);
  });

  it("declares an impl block with a method", () => {
    expect(
      <TestCrate>
        <ImplBlock type="Person">
          <FunctionDeclaration
            name="new"
            parameters={[{ name: "name", type: "String" }]}
            returns="Self"
            visibility="pub"
          >
            Self {"{"} name {"}"}
          </FunctionDeclaration>
        </ImplBlock>
      </TestCrate>,
    ).toRenderTo(`
      impl Person {
        pub fn new(name: String) -> Self {
          Self { name }
        }
      }
    `);
  });

  it("declares a trait impl block", () => {
    expect(
      <TestCrate>
        <ImplBlock type="Person" trait="Display" />
      </TestCrate>,
    ).toRenderTo(`
      impl Display for Person {}
    `);
  });
});
