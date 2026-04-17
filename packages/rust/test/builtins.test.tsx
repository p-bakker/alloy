import { isRefkeyable, Output, render, type Children } from "@alloy-js/core";
import { describe, expect, it } from "vitest";

import { core, std } from "../src/builtins/index.js";
import {
  PRELUDE_TYPES,
  PRELUDE_TYPES_2021,
  PRELUDE_TYPES_2024,
} from "../src/builtins/prelude.js";
import { CrateDirectory } from "../src/components/crate-directory.js";
import { SourceFile } from "../src/components/source-file.js";
import { TypeAlias } from "../src/components/type-alias.js";
import { useCrateContext } from "../src/context/crate-context.js";
import type { RustCrateScope } from "../src/scopes/index.js";
import { findFile } from "./utils.js";

interface ScopeCaptureProps {
  onCapture: (crateScope: RustCrateScope) => void;
  children?: Children;
}

function ScopeCapture(props: ScopeCaptureProps) {
  const crateScope = useCrateContext()!.scope;
  props.onCapture(crateScope);
  return <>{props.children}</>;
}

describe("std builtins", () => {
  it("provides refkeys for described symbols", () => {
    // Types in their canonical modules (may be Refkey or RefkeyableObject if they have members)
    expect(isRefkeyable(std.option.Option)).toBe(true);
    expect(isRefkeyable(std.result.Result)).toBe(true);
    expect(isRefkeyable(std.vec.Vec)).toBe(true);
    expect(isRefkeyable(std.string.String)).toBe(true);
    expect(isRefkeyable(std.boxed.Box)).toBe(true);

    // Nested module symbols
    expect(isRefkeyable(std.rc.Rc)).toBe(true);
    expect(isRefkeyable(std.sync.Arc)).toBe(true);
    expect(isRefkeyable(std.collections.HashMap)).toBe(true);
    expect(isRefkeyable(std.collections.BTreeMap)).toBe(true);
    expect(isRefkeyable(std.fmt.Display)).toBe(true);
    expect(isRefkeyable(std.fmt.Debug)).toBe(true);
    expect(isRefkeyable(std.io.Read)).toBe(true);
    expect(isRefkeyable(std.io.Write)).toBe(true);
    expect(isRefkeyable(std.clone.Clone)).toBe(true);
    expect(isRefkeyable(std.default.Default)).toBe(true);
    expect(isRefkeyable(std.convert.From)).toBe(true);
    expect(isRefkeyable(std.convert.Into)).toBe(true);
  });

  it("references non-prelude std types with use statements and no Cargo.toml dependency", () => {
    let consumerCrateScope: RustCrateScope | undefined;

    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            <ScopeCapture
              onCapture={(capturedCrateScope) => {
                consumerCrateScope = capturedCrateScope;
              }}
            >
              type Map = {std.collections.HashMap};
            </ScopeCapture>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "src/lib").contents.trim()).toBe(
      ["use std::collections::HashMap;", "type Map = HashMap;"].join("\n"),
    );

    // std should NOT appear in Cargo.toml dependencies
    expect(consumerCrateScope).toBeDefined();
    expect(consumerCrateScope!.dependencies.has("std")).toBe(false);
  });

  it("references fmt::Display with correct use statement", () => {
    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">type Fmt = {std.fmt.Display};</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "src/lib").contents.trim()).toBe(
      ["use std::fmt::Display;", "type Fmt = Display;"].join("\n"),
    );
  });

  it("auto-registers std via CrateDirectory without externals", () => {
    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            type Map = {std.collections.HashMap};
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "src/lib").contents.trim()).toBe(
      ["use std::collections::HashMap;", "type Map = HashMap;"].join("\n"),
    );
  });

  it("is idempotent when std is also passed via externals", () => {
    const output = render(
      <Output externals={[std]}>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            type Map = {std.collections.HashMap};
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "src/lib").contents.trim()).toBe(
      ["use std::collections::HashMap;", "type Map = HashMap;"].join("\n"),
    );
  });

  it("noStd skips std registration but core types still resolve", () => {
    const output = render(
      <Output>
        <CrateDirectory name="my_crate" noStd>
          <SourceFile path="lib">type A = {core.clone.Clone};</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib").contents.trim();
    expect(content).toContain("type A = Clone;");
  });

  it("references prelude types as short names without use imports", () => {
    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            type A = {std.clone.Clone};{"\n"}
            type B = {std.cmp.Eq};{"\n"}
            type C = {std.marker.Send};{"\n"}
            type D = {std.marker.Sync};
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib").contents.trim();
    expect(content).not.toContain("use std::");
    expect(content).not.toContain("std::clone");
    expect(content).not.toContain("std::cmp");
    expect(content).not.toContain("std::marker");
    expect(content).toContain("type A = Clone;");
    expect(content).toContain("type B = Eq;");
    expect(content).toContain("type C = Send;");
    expect(content).toContain("type D = Sync;");
  });

  it("references prelude and non-prelude std types together", () => {
    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            type A = {std.clone.Clone};{"\n"}
            type B = {std.collections.HashMap};
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib").contents.trim();
    expect(content).toContain("use std::collections::HashMap;");
    expect(content).not.toContain("use std::clone");
    expect(content).toContain("type A = Clone;");
    expect(content).toContain("type B = HashMap;");
  });

  it("fully qualifies prelude types when shadowed by a local declaration", () => {
    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            <TypeAlias name="Result" pub typeParameters={[{ name: "T" }]}>
              {std.result.Result}
              {"<T, String>"}
            </TypeAlias>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib").contents.trim();
    expect(content).toContain("std::result::Result<T, String>");
    expect(content).not.toMatch(/^use /m);
  });

  it("fully qualifies std::fmt::Result when shadowed by a local Result alias", () => {
    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            type Fmt = {std.fmt.Result};{"\n"}
            <TypeAlias name="Result" pub typeParameters={[{ name: "T" }]}>
              {std.result.Result}
              {"<T, String>"}
            </TypeAlias>
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib").contents.trim();
    expect(content).toContain("type Fmt = std::fmt::Result;");
    expect(content).toContain("= std::result::Result<T, String>");
    expect(content).not.toContain("use std::result");
    expect(content).not.toContain("use std::fmt");
  });
});

describe("core builtins", () => {
  it("provides refkeys for core symbols", () => {
    expect(isRefkeyable(core.option.Option)).toBe(true);
    expect(isRefkeyable(core.result.Result)).toBe(true);
    expect(isRefkeyable(core.fmt.Display)).toBe(true);
    expect(isRefkeyable(core.clone.Clone)).toBe(true);
    expect(isRefkeyable(core.marker.Send)).toBe(true);
  });

  it("generates core:: use paths", () => {
    const output = render(
      <Output>
        <CrateDirectory name="my_crate" noStd>
          <SourceFile path="lib">type Fmt = {core.fmt.Display};</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    expect(findFile(output, "src/lib").contents.trim()).toBe(
      ["use core::fmt::Display;", "type Fmt = Display;"].join("\n"),
    );
  });
});

describe("PRELUDE_TYPES", () => {
  it("contains core prelude types, traits, and primitives", () => {
    // Core types and variants
    for (const type of ["Option", "Some", "None", "Result", "Ok", "Err"]) {
      expect(PRELUDE_TYPES.has(type)).toBe(true);
    }
    // Common structs
    for (const type of ["Vec", "String", "Box"]) {
      expect(PRELUDE_TYPES.has(type)).toBe(true);
    }
    // Core traits
    for (const type of [
      "Clone",
      "Copy",
      "Default",
      "Drop",
      "Eq",
      "PartialEq",
      "Ord",
      "PartialOrd",
      "Iterator",
      "IntoIterator",
      "From",
      "Into",
      "AsRef",
      "AsMut",
      "Send",
      "Sync",
      "Sized",
      "Unpin",
      "ToOwned",
      "ToString",
      "Fn",
      "FnMut",
      "FnOnce",
    ]) {
      expect(PRELUDE_TYPES.has(type)).toBe(true);
    }
    // Primitives
    for (const type of [
      "bool",
      "char",
      "f32",
      "f64",
      "i8",
      "i16",
      "i32",
      "i64",
      "i128",
      "isize",
      "u8",
      "u16",
      "u32",
      "u64",
      "u128",
      "usize",
      "str",
    ]) {
      expect(PRELUDE_TYPES.has(type)).toBe(true);
    }
  });

  it("has edition-specific prelude sets", () => {
    // 2021 adds TryFrom, TryInto, FromIterator
    expect(PRELUDE_TYPES_2021.has("TryFrom")).toBe(true);
    expect(PRELUDE_TYPES_2021.has("TryInto")).toBe(true);
    expect(PRELUDE_TYPES_2021.has("FromIterator")).toBe(true);

    // 2024 adds Future, IntoFuture
    expect(PRELUDE_TYPES_2024.has("Future")).toBe(true);
    expect(PRELUDE_TYPES_2024.has("IntoFuture")).toBe(true);

    // 2024 is a superset of 2021
    for (const type of PRELUDE_TYPES_2021) {
      expect(PRELUDE_TYPES_2024.has(type)).toBe(true);
    }
  });
});
