import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import { FunctionDeclaration } from "../src/components/function-declaration.js";
import {
  TypeParameters,
  WhereClause,
} from "../src/components/type-parameters.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

describe("TypeParameters", () => {
  it("renders a single type parameter", () => {
    expect(<TypeParameters params={[{ name: "T" }]} />).toRenderTo(d`<T>`);
  });

  it("renders multiple type parameters", () => {
    expect(
      <TypeParameters params={[{ name: "T" }, { name: "U" }]} />,
    ).toRenderTo(d`<T, U>`);
  });

  it("renders a single constrained parameter", () => {
    expect(
      <TypeParameters params={[{ name: "T", constraints: "Display" }]} />,
    ).toRenderTo(d`<T: Display>`);
  });

  it("renders mixed constrained and unconstrained parameters", () => {
    expect(
      <TypeParameters
        params={[{ name: "T" }, { name: "U", constraints: "Display + Clone" }]}
      />,
    ).toRenderTo(d`<T, U: Display + Clone>`);
  });

  it("renders a single lifetime parameter", () => {
    expect(<TypeParameters params={[{ lifetime: "'a" }]} />).toRenderTo(
      d`<'a>`,
    );
  });

  it("renders lifetimes before type parameters", () => {
    expect(
      <TypeParameters
        params={[
          { name: "T" },
          { lifetime: "'a" },
          { name: "U", constraints: "'a + Display" },
          { lifetime: "'b" },
        ]}
      />,
    ).toRenderTo(d`<'a, 'b, T, U: 'a + Display>`);
  });

  it("renders lifetime bounds", () => {
    expect(
      <TypeParameters
        params={[{ lifetime: "'a" }, { lifetime: "'b", constraints: "'a" }]}
      />,
    ).toRenderTo(d`<'a, 'b: 'a>`);
  });

  it("renders type parameter lifetime bounds", () => {
    expect(
      <TypeParameters
        params={[{ lifetime: "'a" }, { name: "T", constraints: "'a + Clone" }]}
      />,
    ).toRenderTo(d`<'a, T: 'a + Clone>`);
  });

  it("renders nothing for empty params", () => {
    expect(
      <>
        fn value
        <TypeParameters params={[]} />
      </>,
    ).toRenderTo(d`fn value`);
  });

  it("renders nothing for undefined params", () => {
    expect(
      <>
        fn value
        <TypeParameters />
      </>,
    ).toRenderTo(d`fn value`);
  });

  it("breaks a long generic list vertically with a trailing comma", () => {
    const source = toSourceText(
      <FunctionDeclaration
        name="long_generics"
        typeParameters={[
          { name: "TypeParameterAAAAAA" },
          { name: "TypeParameterBBBBBB" },
          { name: "TypeParameterCCCCCC" },
          { name: "TypeParameterDDDDDD" },
          { name: "TypeParameterEEEEEEEE" },
        ]}
      >
        {"todo!()"}
      </FunctionDeclaration>,
    );

    expect(source).toEqual(d`
      fn long_generics<
          TypeParameterAAAAAA,
          TypeParameterBBBBBB,
          TypeParameterCCCCCC,
          TypeParameterDDDDDD,
          TypeParameterEEEEEEEE,
      >() {
          todo!()
      }
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});

describe("WhereClause", () => {
  it("renders a single bound on its own indented line", () => {
    expect(
      <>
        {"impl<T> Thing"}
        <WhereClause>T: Display + Clone</WhereClause>
      </>,
    ).toRenderTo(d`
      impl<T> Thing
      where
        T: Display + Clone,
    `);
  });

  it("renders each bound in an array on its own indented line", () => {
    expect(
      <>
        {"impl<T> Thing"}
        <WhereClause>{["T: Display + Clone", "U: Debug"]}</WhereClause>
      </>,
    ).toRenderTo(d`
      impl<T> Thing
      where
        T: Display + Clone,
        U: Debug,
    `);
  });

  it("omits the trailing comma on the last bound when trailingComma is false", () => {
    expect(
      <>
        {"impl<T> Thing"}
        <WhereClause trailingComma={false}>
          {["T: Clone", "U: Debug"]}
        </WhereClause>
      </>,
    ).toRenderTo(d`
      impl<T> Thing
      where
        T: Clone,
        U: Debug
    `);
  });

  it("renders nothing when children are missing", () => {
    expect(
      <>
        {"impl<T> Thing"}
        <WhereClause />
      </>,
    ).toRenderTo(d`impl<T> Thing`);
  });
});
