import { Output, Scope, code, createSymbol } from "@alloy-js/core";
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
