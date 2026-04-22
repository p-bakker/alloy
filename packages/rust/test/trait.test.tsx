import { Output, refkey } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  Attribute,
  CrateDirectory,
  SourceFile,
  TraitDeclaration,
} from "../src/components/index.js";
import {
  RustTraitScope,
  useRustModuleScope,
  useRustScope,
} from "../src/scopes/index.js";
import { NamedTypeSymbol } from "../src/symbols/named-type-symbol.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

function TraitKindProbe(props: { name: string }) {
  const scope = useRustModuleScope();
  for (const symbol of scope.types) {
    if (symbol instanceof NamedTypeSymbol && symbol.name === props.name) {
      return symbol.typeKind;
    }
  }

  return "missing";
}

function TraitScopeProbe() {
  const scope = useRustScope();
  return scope instanceof RustTraitScope ? "trait-scope" : "other-scope";
}

function TraitVisibilityProbe(props: { name: string }) {
  const scope = useRustModuleScope();
  for (const symbol of scope.types) {
    if (symbol instanceof NamedTypeSymbol && symbol.name === props.name) {
      return symbol.visibility ?? "none";
    }
  }

  return "missing";
}

describe("TraitDeclaration", () => {
  it("keeps an empty trait body on one line", () => {
    const source = toSourceText(<TraitDeclaration name="T" />);

    expect(source).toEqual(d`trait T {}`);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("renders basic trait", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="Displayable" />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`trait Displayable {}`);
  });

  it("renders pub trait", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="Displayable" pub={true} />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`pub trait Displayable {}`);
  });

  it("renders pub(crate) and pub(super) trait visibility", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="CrateVisible" pub="crate" />
            <hbr />
            <TraitDeclaration name="ParentVisible" pub="super" />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      pub(crate) trait CrateVisible {}

      pub(super) trait ParentVisible {}
    `);
  });

  it("renders supertraits", () => {
    const source = toSourceText(
      <TraitDeclaration name="Printable" supertraits={["Display", "Debug"]} />,
    );
    expect(source.trimEnd()).toBe("trait Printable: Display + Debug {}");
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps a long supertrait list one bound per line before +", () => {
    const source = toSourceText(
      <TraitDeclaration
        pub
        name="LongTraitName"
        supertraits={[
          "ExtremelyLongSuperTraitOne",
          "ExtremelyLongSuperTraitTwo",
          "ExtremelyLongSuperTraitThree",
          "ExtremelyLongSuperTraitFour",
          "ExtremelyLongSuperTraitFive",
        ]}
      />,
    );
    expect(source.trimEnd()).toBe(
      [
        "pub trait LongTraitName:",
        "    ExtremelyLongSuperTraitOne",
        "    + ExtremelyLongSuperTraitTwo",
        "    + ExtremelyLongSuperTraitThree",
        "    + ExtremelyLongSuperTraitFour",
        "    + ExtremelyLongSuperTraitFive",
        "{",
        "}",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("renders type parameters and where clause", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration
              name="Sink"
              typeParameters={[
                { name: "T" },
                { name: "E", constraints: "Display" },
              ]}
              whereClause="T: Clone"
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      trait Sink<T, E: Display>
      where
          T: Clone,
      {
      }
    `);
  });

  it("moves body opening brace to its own line when where clause is present", () => {
    const source = toSourceText(
      <TraitDeclaration
        name="Sink"
        typeParameters={[{ name: "T" }]}
        whereClause="T: Clone"
      >
        {"fn run(&self);"}
      </TraitDeclaration>,
    );

    expect(source).toEqual(d`
      trait Sink<T>
      where
          T: Clone,
      {
          fn run(&self);
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps body opening brace on its own line when both supertraits and where clause are present", () => {
    const source = toSourceText(
      <TraitDeclaration
        name="Sink"
        typeParameters={[{ name: "T" }]}
        supertraits={["Display"]}
        whereClause="T: Clone"
      >
        {"fn run(&self);"}
      </TraitDeclaration>,
    );

    expect(source).toEqual(d`
      trait Sink<T>: Display
      where
          T: Clone,
      {
          fn run(&self);
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("renders trait with method signature and default implementation", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="Runner">
              {"fn run(&self);"}
              <hbr />
              {"fn run_default(&self) {"}
              <hbr />
              {"true"}
              <hbr />
              {"}"}
            </TraitDeclaration>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      trait Runner {
          fn run(&self);
          fn run_default(&self) {
          true
          }
      }
    `);
  });

  it("renders doc comments", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="Runner" doc="Trait docs." />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      /// Trait docs.
      trait Runner {}
    `);
  });

  it("creates trait scope for children", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="Runner">
              <TraitScopeProbe />
            </TraitDeclaration>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      trait Runner {
          trait-scope
      }
    `);
  });

  it("creates a trait symbol and resolves it by refkey", () => {
    const traitRef = refkey("serialize-trait");

    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="Serialize" refkey={traitRef} />
            <hbr />
            type Alias = {traitRef};
            <hbr />
            <TraitKindProbe name="Serialize" />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      trait Serialize {}

      type Alias = Serialize;

      trait
    `);
  });

  it("applies pub visibility on trait symbols", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration name="Serialize" pub={true} />
            <hbr />
            <TraitVisibilityProbe name="Serialize" />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      pub trait Serialize {}

      pub
    `);
  });

  it("renders attributes before trait declaration", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration
              name="MyTrait"
              pub
              attributes={[<Attribute name="deprecated" />]}
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      #[deprecated]
      pub trait MyTrait {}
    `);
  });

  it("renders attributes with doc comment", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <TraitDeclaration
              name="Handler"
              doc="Handles events."
              attributes={[<Attribute name="async_trait" />]}
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      /// Handles events.
      #[async_trait]
      trait Handler {}
    `);
  });
});
