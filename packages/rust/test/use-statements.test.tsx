import type { Children } from "@alloy-js/core";
import { Output, Scope, code, createSymbol, render } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import { CrateDirectory } from "../src/components/crate-directory.js";
import { SourceFile } from "../src/components/source-file.js";
import {
  UseStatement,
  UseStatements,
} from "../src/components/use-statement.js";
import { RustCrateScope } from "../src/scopes/rust-crate-scope.js";
import { RustModuleScope } from "../src/scopes/rust-module-scope.js";
import { RustOutputSymbol } from "../src/symbols/rust-output-symbol.js";
import { checkRustfmt, checkRustfmtAllEditions } from "./rustfmt.js";
import { findFile, toSourceText } from "./utils.js";

function renderWithEdition(children: Children, edition: string): string {
  const res = render(
    <Output>
      <CrateDirectory name="test_crate" edition={edition}>
        <SourceFile path="test.rs">{children}</SourceFile>
      </CrateDirectory>
    </Output>,
    { insertFinalNewLine: false },
  );
  return findFile(res, "src/test.rs").contents;
}

describe("UseStatement", () => {
  it("registers a single import and renders via UseStatements", () => {
    const crateScope = new RustCrateScope("my_crate");
    const moduleScope = new RustModuleScope("lib.rs", crateScope);
    expect(
      <Output>
        <Scope value={moduleScope}>
          <UseStatement path="std::fmt" symbol="Display" />
          <UseStatements />
        </Scope>
      </Output>,
    ).toRenderTo(d`use std::fmt::Display;`);
  });

  it("merges multiple UseStatements with the same path into one line", () => {
    const crateScope = new RustCrateScope("my_crate");
    const moduleScope = new RustModuleScope("lib.rs", crateScope);
    expect(
      <Output>
        <Scope value={moduleScope}>
          <UseStatement path="crate::models" symbol="Person" />
          <UseStatement path="crate::models" symbol="Status" />
          <UseStatement path="crate::models" symbol="Borrowed" />
          <UseStatements />
        </Scope>
      </Output>,
    ).toRenderTo(d`use crate::models::{Borrowed, Person, Status};`);
  });

  it("keeps pub use separate from plain use for the same path", () => {
    const crateScope = new RustCrateScope("my_crate");
    const moduleScope = new RustModuleScope("lib.rs", crateScope);
    expect(
      <Output>
        <Scope value={moduleScope}>
          <UseStatement path="crate::models" symbol="Internal" />
          <UseStatement pub path="crate::models" symbol="Person" />
          <UseStatement pub path="crate::models" symbol="Status" />
          <UseStatements />
        </Scope>
      </Output>,
    ).toRenderTo(d`
      use crate::models::Internal;
      pub use crate::models::{Person, Status};
    `);
  });

  it("groups hand-authored pub uses across multiple paths", () => {
    const crateScope = new RustCrateScope("my_crate");
    const moduleScope = new RustModuleScope("lib.rs", crateScope);
    expect(
      <Output>
        <Scope value={moduleScope}>
          <UseStatement pub path="crate::models" symbol="Person" />
          <UseStatement pub path="crate::models" symbol="Status" />
          <UseStatement pub path="crate::models" symbol="Borrowed" />
          <UseStatement pub path="crate::models" symbol="Container" />
          <UseStatement pub path="crate::traits" symbol="Greetable" />
          <UseStatement pub path="crate::traits" symbol="AsyncFetchable" />
          <UseStatement pub path="crate::utils" symbol="AppResult" />
          <UseStatements />
        </Scope>
      </Output>,
    ).toRenderTo(d`
      pub use crate::models::{Borrowed, Container, Person, Status};
      pub use crate::traits::{AsyncFetchable, Greetable};
      pub use crate::utils::AppResult;
    `);
  });
});

describe("UseStatements", () => {
  it("reads imports from RustModuleScope", () => {
    const crateScope = new RustCrateScope("my_crate");
    const moduleScope = new RustModuleScope("lib.rs", crateScope);
    const display = createSymbol(
      RustOutputSymbol,
      "Display",
      moduleScope.values,
    );
    moduleScope.addUse("std::fmt", display);

    expect(
      <Output>
        <Scope value={moduleScope}>
          <UseStatements />
        </Scope>
      </Output>,
    ).toRenderTo(d`use std::fmt::Display;`);
  });

  it("renders grouped statements for multiple symbols from same path", () => {
    const crateScope = new RustCrateScope("my_crate");
    const moduleScope = new RustModuleScope("lib.rs", crateScope);
    const display = createSymbol(
      RustOutputSymbol,
      "Display",
      moduleScope.values,
    );
    const debug = createSymbol(RustOutputSymbol, "Debug", moduleScope.values);
    moduleScope.addUse("std::fmt", display);
    moduleScope.addUse("std::fmt", debug);

    expect(
      <Output>
        <Scope value={moduleScope}>
          <UseStatements />
        </Scope>
      </Output>,
    ).toRenderTo(d`
      use std::fmt::{Debug, Display};
    `);
  });

  it("sorts groups as std, external, crate with blank lines and integrates in SourceFile", () => {
    const crateScope = new RustCrateScope("my_crate");
    const moduleScope = new RustModuleScope("lib.rs", crateScope);
    moduleScope.addUse(
      "crate::types",
      createSymbol(RustOutputSymbol, "Response", moduleScope.values),
    );
    moduleScope.addUse(
      "std::fmt",
      createSymbol(RustOutputSymbol, "Debug", moduleScope.values),
    );
    moduleScope.addUse(
      "serde::de",
      createSymbol(RustOutputSymbol, "DeserializeOwned", moduleScope.values),
    );
    moduleScope.addUse(
      "crate::models",
      createSymbol(RustOutputSymbol, "User", moduleScope.values),
    );
    moduleScope.addUse(
      "std::collections",
      createSymbol(RustOutputSymbol, "HashMap", moduleScope.values),
    );
    moduleScope.addUse(
      "tokio::runtime",
      createSymbol(RustOutputSymbol, "Runtime", moduleScope.values),
    );

    expect(
      <Output>
        <Scope value={moduleScope}>
          <UseStatements />
        </Scope>
      </Output>,
    ).toRenderTo(d`
      use std::collections::HashMap;
      use std::fmt::Debug;

      use serde::de::DeserializeOwned;
      use tokio::runtime::Runtime;

      use crate::models::User;
      use crate::types::Response;
    `);
  });

  it("does not add blank lines for missing groups", () => {
    const crateScope = new RustCrateScope("my_crate");
    const moduleScope = new RustModuleScope("lib.rs", crateScope);
    moduleScope.addUse(
      "crate::types",
      createSymbol(RustOutputSymbol, "OnlyType", moduleScope.values),
    );

    expect(
      <Output>
        <Scope value={moduleScope}>
          <UseStatements />
        </Scope>
      </Output>,
    ).toRenderTo(d`
      use crate::types::OnlyType;
    `);
  });

  it("integrates into SourceFile output position", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">{code`fn main() {}`}</SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo(d`fn main() {}`);
  });
});

describe("use-statement brace list rustfmt conformance", () => {
  it("keeps a short brace list flat", () => {
    const source = toSourceText(
      <>
        <UseStatement path="std::collections" symbol="HashMap" />
        <UseStatement path="std::collections" symbol="HashSet" />
      </>,
    );

    expect(source.trimEnd()).toBe(`use std::collections::{HashMap, HashSet};`);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("wraps a long brace list onto multiple lines", () => {
    const source = toSourceText(
      <>
        <UseStatement
          path="foo"
          symbol="AnExtremelyLongIdentifierNumberOneWithLotsOfWords"
        />
        <UseStatement
          path="foo"
          symbol="AnExtremelyLongIdentifierNumberTwoWithLotsOfWords"
        />
        <UseStatement
          path="foo"
          symbol="AnExtremelyLongIdentifierNumberThreeWithLotsOfWords"
        />
      </>,
    );

    expect(source.trimEnd()).toBe(
      [
        "use foo::{",
        "    AnExtremelyLongIdentifierNumberOneWithLotsOfWords,",
        "    AnExtremelyLongIdentifierNumberThreeWithLotsOfWords,",
        "    AnExtremelyLongIdentifierNumberTwoWithLotsOfWords,",
        "};",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});

describe("use-statement sort rustfmt conformance", () => {
  it("pins self first, super second, glob last in a brace list across all editions", () => {
    const source = toSourceText(
      <>
        <UseStatement path="std::module" symbol="self" />
        <UseStatement path="std::module" symbol="*" />
        <UseStatement path="std::module" symbol="b" />
        <UseStatement path="std::module" symbol="a" />
        <UseStatement path="std::module" symbol="super" />
      </>,
    );

    expect(source.trimEnd()).toBe(`use std::module::{self, super, a, b, *};`);
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("sorts digit-laden brace-list symbols ASCII-lex under edition 2021", () => {
    const source = renderWithEdition(
      <>
        <UseStatement path="std::m" symbol="foo10" />
        <UseStatement path="std::m" symbol="foo2" />
        <UseStatement path="std::m" symbol="foo1" />
      </>,
      "2021",
    );

    expect(source).toContain("use std::m::{foo1, foo10, foo2};");
    const normalised = source.endsWith("\n") ? source : `${source}\n`;
    expect(checkRustfmt(normalised, { edition: "2021" })).toEqual({
      pass: true,
    });
  });

  it("sorts digit-laden brace-list symbols version-sort under edition 2024", () => {
    const source = renderWithEdition(
      <>
        <UseStatement path="std::m" symbol="foo10" />
        <UseStatement path="std::m" symbol="foo2" />
        <UseStatement path="std::m" symbol="foo1" />
      </>,
      "2024",
    );

    expect(source).toContain("use std::m::{foo1, foo2, foo10};");
    const normalised = source.endsWith("\n") ? source : `${source}\n`;
    expect(checkRustfmt(normalised, { edition: "2024" })).toEqual({
      pass: true,
    });
  });

  it("sorts digit-laden top-level paths ASCII-lex under edition 2021", () => {
    const source = renderWithEdition(
      <>
        <UseStatement path="std::mod10" symbol="foo" />
        <UseStatement path="std::mod2" symbol="foo" />
        <UseStatement path="std::mod1" symbol="foo" />
      </>,
      "2021",
    );

    expect(source.trimEnd()).toBe(
      d`
        use std::mod1::foo;
        use std::mod10::foo;
        use std::mod2::foo;
      `,
    );
    const normalised = source.endsWith("\n") ? source : `${source}\n`;
    expect(checkRustfmt(normalised, { edition: "2021" })).toEqual({
      pass: true,
    });
  });

  it("sorts digit-laden top-level paths version-sort under edition 2024", () => {
    const source = renderWithEdition(
      <>
        <UseStatement path="std::mod10" symbol="foo" />
        <UseStatement path="std::mod2" symbol="foo" />
        <UseStatement path="std::mod1" symbol="foo" />
      </>,
      "2024",
    );

    expect(source.trimEnd()).toBe(
      d`
        use std::mod1::foo;
        use std::mod2::foo;
        use std::mod10::foo;
      `,
    );
    const normalised = source.endsWith("\n") ? source : `${source}\n`;
    expect(checkRustfmt(normalised, { edition: "2024" })).toEqual({
      pass: true,
    });
  });

  it("produces identical output across editions for plain alphabetic symbols and paths", () => {
    const subtree = (
      <>
        <UseStatement path="std::fmt" symbol="Debug" />
        <UseStatement path="std::fmt" symbol="Display" />
        <UseStatement path="std::collections" symbol="HashMap" />
      </>
    );

    const e2021 = renderWithEdition(subtree, "2021");
    const e2024 = renderWithEdition(subtree, "2024");
    expect(e2021).toBe(e2024);
    expect(() => checkRustfmtAllEditions(e2024)).not.toThrow();
  });
});
