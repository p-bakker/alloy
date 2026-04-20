import type { Children } from "@alloy-js/core";
import { Output, code } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  CrateDirectory,
  FunctionDeclaration,
  LetBinding,
  SourceFile,
} from "../src/components/index.js";
import * as Stc from "../src/components/stc/index.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { toSourceText } from "./utils.js";

function inFile(children: Children) {
  return (
    <Output>
      <CrateDirectory name="my_crate">
        <SourceFile path="lib.rs">{children}</SourceFile>
      </CrateDirectory>
    </Output>
  );
}

describe("LetBinding", () => {
  it("renders a simple let binding", () => {
    expect(
      inFile(<LetBinding name="before">{code`self.data.len()`}</LetBinding>),
    ).toRenderTo(d`
      let before = self.data.len();
    `);
  });

  it("renders mutable bindings", () => {
    expect(
      inFile(
        <LetBinding name="entry" mutable>{code`Entry::default()`}</LetBinding>,
      ),
    ).toRenderTo(d`
      let mut entry = Entry::default();
    `);
  });

  it("renders type annotations", () => {
    expect(
      inFile(
        <LetBinding
          name="entry"
          type="Entry<V>"
        >{code`Entry::default()`}</LetBinding>,
      ),
    ).toRenderTo(d`
      let entry: Entry<V> = Entry::default();
    `);
  });

  it("renders let binding without initializer", () => {
    expect(inFile(<LetBinding name="slot" />)).toRenderTo(d`
      let slot;
    `);
  });

  it("renders destructuring patterns", () => {
    expect(inFile(<LetBinding name="(key, value)">{code`pair`}</LetBinding>))
      .toRenderTo(d`
      let (key, value) = pair;
    `);
  });

  it("stc wrapper renders the same output", () => {
    expect(
      inFile(
        Stc.LetBinding({ name: "count", mutable: true }).children([
          "items.len()",
        ]),
      ),
    ).toRenderTo(d`
      let mut count = items.len();
    `);
  });

  it("composes with sibling statements separated by hbr", () => {
    const source = toSourceText(
      <FunctionDeclaration name="demo" returnType="i32">
        <LetBinding name="a">{code`1`}</LetBinding>
        <hbr />
        <LetBinding name="b">{code`a + 1`}</LetBinding>
        <hbr />
        {code`a + b`}
      </FunctionDeclaration>,
    );

    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});
