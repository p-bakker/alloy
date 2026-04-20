import { Output, refkey } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  Attribute,
  CrateDirectory,
  Declaration,
  FunctionDeclaration,
  InnerAttribute,
  SourceFile,
  StructDeclaration,
} from "../src/components/index.js";
import * as Stc from "../src/components/stc/index.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

describe("Attribute", () => {
  it("renders simple attribute", () => {
    expect(<Attribute name="test" />).toRenderTo("#[test]\n\n");
  });

  it("renders attribute with args", () => {
    expect(<Attribute name="cfg" args="test" />).toRenderTo("#[cfg(test)]\n\n");
  });

  it("renders refkey attribute names", () => {
    const attributeName = refkey("custom-attribute");
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <Declaration
              name="my_custom_attribute"
              refkey={attributeName}
              nameKind="function"
            >
              fn my_custom_attribute() {`{}`}
            </Declaration>
            <hbr />
            <Attribute name={attributeName} />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo("fn my_custom_attribute() {}\n#[my_custom_attribute]\n\n");
  });
});

describe("DeriveAttribute (via derives prop)", () => {
  it("renders before declarations", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <StructDeclaration
              name="Foo"
              attributes={[<Attribute name="repr" args="C" />]}
              derives={["Debug", "Clone"]}
            />
          </SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`
      #[repr(C)]
      #[derive(Debug, Clone)]
      struct Foo {}
    `);
  });
});

describe("InnerAttribute", () => {
  it("renders simple inner attribute", () => {
    expect(<InnerAttribute name="allow" />).toRenderTo("#![allow]\n\n");
  });

  it("renders inner attribute with args", () => {
    expect(<InnerAttribute name="cfg" args="test" />).toRenderTo(
      "#![cfg(test)]\n\n",
    );
  });

  it("renders stc inner attribute wrapper", () => {
    expect(
      Stc.InnerAttribute({ name: "cfg", args: 'feature = "cli"' }),
    ).toRenderTo('#![cfg(feature = "cli")]\n\n');
  });
});

describe("rustfmt conformance", () => {
  it("breaks between outer attribute and fn across all editions", () => {
    const source = toSourceText(
      <FunctionDeclaration
        name="with_capacity"
        pub
        receiver="self"
        parameters={[{ name: "capacity", type: "usize" }]}
        returnType="Self"
        attributes={[<Attribute name="must_use" />]}
      >
        {"self"}
      </FunctionDeclaration>,
    );

    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks between multiple outer attributes and fn across all editions", () => {
    const source = toSourceText(
      <FunctionDeclaration
        name="handler"
        pub
        attributes={[
          <Attribute name="inline" />,
          <Attribute name="allow" args="dead_code" />,
        ]}
      />,
    );

    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("breaks between a stand-alone sibling Attribute and fn across all editions", () => {
    const source = toSourceText(
      <>
        <Attribute name="must_use" />
        <FunctionDeclaration name="handler" pub />
      </>,
    );

    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("does not insert blank lines between multiple attributes on the same item", () => {
    const source = toSourceText(
      <FunctionDeclaration
        name="handler"
        pub
        attributes={[
          <Attribute name="inline" />,
          <Attribute name="allow" args="dead_code" />,
        ]}
      />,
    );

    expect(source).toEqual(d`
      #[inline]
      #[allow(dead_code)]
      pub fn handler() {}
    `);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});
