import { describe, expect, it } from "vitest";
import { Output, render } from "@alloy-js/core";
import { TestCrate, findFile } from "../../../test/utils.js";
import { CrateDirectory } from "../../components/CrateDirectory.js";
import { SourceDirectory } from "../../components/SourceDirectory.js";
import { SourceFile } from "../../components/SourceFile.js";
import { TraitDeclaration, TraitMethod } from "./declaration.js";

describe("TraitDeclaration", () => {
  it("declares a simple trait", () => {
    expect(
      <TestCrate>
        <TraitDeclaration name="Greet" />
      </TestCrate>,
    ).toRenderTo(`
      trait Greet {}
    `);
  });

  it("declares a trait with methods", () => {
    expect(
      <TestCrate>
        <TraitDeclaration name="Animal">
          <TraitMethod name="name" selfParam="&self" returns="&str" />
          <TraitMethod name="sound" selfParam="&self" returns="String" />
        </TraitDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      trait Animal {
          fn name(&self) -> &str;

          fn sound(&self) -> String;
      }
    `);
  });

  it("declares a pub trait", () => {
    expect(
      <TestCrate>
        <TraitDeclaration name="MyTrait" visibility="pub" />
      </TestCrate>,
    ).toRenderTo(`
      pub trait MyTrait {}
    `);
  });

  it("declares a trait with doc comment", () => {
    expect(
      <TestCrate>
        <TraitDeclaration name="Drawable" doc="Something that can be drawn." />
      </TestCrate>,
    ).toRenderTo(`
      /// Something that can be drawn.
      trait Drawable {}
    `);
  });

  it("declares a trait with a default method body", () => {
    expect(
      <TestCrate>
        <TraitDeclaration name="Greeter">
          <TraitMethod name="greet" selfParam="&self" returns="String">
            String::from("hello")
          </TraitMethod>
        </TraitDeclaration>
      </TestCrate>,
    ).toRenderTo(`
      trait Greeter {
          fn greet(&self) -> String {
              String::from("hello")
          }
      }
    `);
  });

  it("declares an async trait with #[allow(async_fn_in_trait)] on edition 2024", () => {
    const res = render(
      <Output>
        <CrateDirectory name="test-crate" edition="2024">
          <SourceDirectory path=".">
            <SourceFile path="test.rs">
              <TraitDeclaration name="Fetcher" asyncTrait>
                <TraitMethod name="fetch" selfParam="&self" returns="String" async />
              </TraitDeclaration>
            </SourceFile>
          </SourceDirectory>
        </CrateDirectory>
      </Output>,
    );
    const contents = findFile(res, "test.rs").contents;
    expect(contents).toContain("#[allow(async_fn_in_trait)]");
    expect(contents).not.toContain("#[async_trait]");
    expect(contents).toContain("async fn fetch");
  });

  it("declares an async trait with #[async_trait] on edition 2021", () => {
    const res = render(
      <Output>
        <CrateDirectory name="test-crate" edition="2021">
          <SourceDirectory path=".">
            <SourceFile path="test.rs">
              <TraitDeclaration name="Fetcher" asyncTrait>
                <TraitMethod name="fetch" selfParam="&self" returns="String" async />
              </TraitDeclaration>
            </SourceFile>
          </SourceDirectory>
        </CrateDirectory>
      </Output>,
    );
    const contents = findFile(res, "test.rs").contents;
    expect(contents).toContain("#[async_trait]");
    expect(contents).toContain("use async_trait::async_trait;");
    expect(contents).toContain("async fn fetch");
  });
});
