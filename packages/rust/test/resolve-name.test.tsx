import { Output, refkey, render } from "@alloy-js/core";
import { describe, expect, it } from "vitest";

import { std } from "../src/builtins/index.js";
import { CrateDirectory } from "../src/components/crate-directory.js";
import { Declaration } from "../src/components/declaration.js";
import { SourceFile } from "../src/components/source-file.js";
import { resolveSymbolName } from "../src/symbols/resolve-name.js";
import { findFile } from "./utils.js";

describe("resolveSymbolName", () => {
  it("returns a plain string unchanged", () => {
    expect(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">{resolveSymbolName("Hello")}</SourceFile>
        </CrateDirectory>
      </Output>,
    ).toRenderTo("Hello");
  });

  it("resolves a refkey to the declaration's bare name", () => {
    const userKey = refkey("user");

    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            <Declaration name="User" refkey={userKey} nameKind="struct" pub>
              pub struct User;
            </Declaration>
            <hbr />
            {resolveSymbolName(userKey)}
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib.rs").contents;
    expect(content).toContain("User");
    expect(content.trim().split(/\r?\n/).pop()).toBe("User");
  });

  it("does not emit a use-statement for a builtin-crate refkey", () => {
    // A regular Reference to std::fmt::Debug would (under certain conditions)
    // produce `use std::fmt::Debug`. resolveSymbolName must not.
    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            type T = {resolveSymbolName(std.fmt.Debug)};
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib.rs").contents;
    expect(content).toContain("type T = Debug;");
    expect(content).not.toContain("use std::fmt::Debug");
    expect(content).not.toContain("use std::fmt");
  });

  it("does not track a Cargo dependency for a cross-module refkey", () => {
    // Using the Reference system on a cross-module symbol would add a
    // `use` import and (for external crates) a Cargo dependency.
    // resolveSymbolName must not.
    const serializeKey = refkey("serde-serialize");

    const output = render(
      <Output>
        <CrateDirectory
          name="consumer"
          version="0.1.0"
          edition="2021"
          includeCargoToml
        >
          <SourceFile path="types">
            <Declaration
              name="Serialize"
              refkey={serializeKey}
              nameKind="trait"
              pub
            >
              pub trait Serialize {}
            </Declaration>
          </SourceFile>
          <SourceFile path="lib.rs">
            type Bound = {resolveSymbolName(serializeKey)};
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const lib = findFile(output, "src/lib.rs").contents;
    expect(lib).toContain("type Bound = Serialize;");
    expect(lib).not.toContain("use crate::types::Serialize");

    const cargoToml = findFile(output, "Cargo.toml").contents;
    expect(cargoToml).not.toContain("[dependencies]");
  });

  it("falls back to an unresolved-refkey marker when resolution fails", () => {
    const unknown = refkey("never-declared");

    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            type T = {resolveSymbolName(unknown)};
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib.rs").contents;
    expect(content).toContain("Unresolved");
  });
});
