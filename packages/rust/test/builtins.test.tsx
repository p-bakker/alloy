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

  it("renders enum variants as JSX components", () => {
    const { Ok, Err } = std.result.Result;
    const { Some, None } = std.option.Option;

    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            let a = <Ok>42</Ok>;{"\n"}
            let b = <Err>"boom"</Err>;{"\n"}
            let c = <Some>"v"</Some>;{"\n"}
            let d = <None />;
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const contents = findFile(output, "src/lib").contents.trim();
    expect(contents).toContain("let a = Ok(42);");
    expect(contents).toContain('let b = Err("boom");');
    expect(contents).toContain('let c = Some("v");');
    expect(contents).toContain("let d = None;");
  });

  it("fully qualifies a prelude variant when its bare name is locally shadowed", () => {
    const { Ok } = std.result.Result;

    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            <TypeAlias name="Ok" pub>
              u32
            </TypeAlias>
            {"\n"}let v = <Ok>1</Ok>;
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const contents = findFile(output, "src/lib").contents.trim();
    expect(contents).toContain("let v = Result::Ok(1);");
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

  it("fully qualifies builtin symbols whose name collides with a prelude name", () => {
    // std::fmt::Result is not the prelude Result, but bears the same name.
    // Importing it would silently shadow the prelude for any bare `Result`
    // reference (including opaque string literals in the same file), so we
    // fully-qualify it instead.
    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">type Fmt = {std.fmt.Result};</SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib").contents.trim();
    expect(content).toContain("type Fmt = std::fmt::Result;");
    expect(content).not.toContain("use std::fmt::Result");
  });

  it("co-existence: prelude Result stays bare, std::fmt::Result is fully qualified", () => {
    // Real-world scenario (Display::fmt impl): both prelude Result (for a
    // type alias) and std::fmt::Result (for the fmt signature) are referenced
    // in the same module. The prelude Result must render as bare `Result`,
    // and std::fmt::Result must NOT be imported (else it would shadow the
    // prelude for the bare reference).
    const output = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib">
            type Fmt = {std.fmt.Result};{"\n"}
            type MyResult = {std.result.Result};
          </SourceFile>
        </CrateDirectory>
      </Output>,
    );

    const content = findFile(output, "src/lib").contents.trim();
    expect(content).toContain("type Fmt = std::fmt::Result;");
    expect(content).toContain("type MyResult = Result;");
    expect(content).not.toContain("use std::fmt::Result");
    expect(content).not.toContain("use std::result::Result");
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
    // Types are module-qualified to disambiguate from same-named symbols
    // (e.g. `result::Result` vs `fmt::Result`). Enum variants like `Some`,
    // `Ok` are bare names since they live inside enum types, not modules.
    for (const type of ["option::Option", "result::Result"]) {
      expect(PRELUDE_TYPES.has(type)).toBe(true);
    }
    for (const variant of ["Some", "None", "Ok", "Err"]) {
      expect(PRELUDE_TYPES.has(variant)).toBe(true);
    }
    // Common structs
    for (const type of ["vec::Vec", "string::String", "boxed::Box"]) {
      expect(PRELUDE_TYPES.has(type)).toBe(true);
    }
    // Core traits
    for (const type of [
      "clone::Clone",
      "marker::Copy",
      "default::Default",
      "ops::Drop",
      "cmp::Eq",
      "cmp::PartialEq",
      "cmp::Ord",
      "cmp::PartialOrd",
      "iter::Iterator",
      "iter::IntoIterator",
      "convert::From",
      "convert::Into",
      "convert::AsRef",
      "convert::AsMut",
      "marker::Send",
      "marker::Sync",
      "marker::Sized",
      "marker::Unpin",
      "borrow::ToOwned",
      "string::ToString",
      "ops::Fn",
      "ops::FnMut",
      "ops::FnOnce",
    ]) {
      expect(PRELUDE_TYPES.has(type)).toBe(true);
    }
    // Primitives (no module path)
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

  it("disambiguates prelude Result from fmt::Result", () => {
    expect(PRELUDE_TYPES.has("result::Result")).toBe(true);
    expect(PRELUDE_TYPES.has("fmt::Result")).toBe(false);
  });

  it("has edition-specific prelude sets", () => {
    // 2021 adds TryFrom, TryInto, FromIterator
    expect(PRELUDE_TYPES_2021.has("convert::TryFrom")).toBe(true);
    expect(PRELUDE_TYPES_2021.has("convert::TryInto")).toBe(true);
    expect(PRELUDE_TYPES_2021.has("iter::FromIterator")).toBe(true);

    // 2024 adds Future, IntoFuture
    expect(PRELUDE_TYPES_2024.has("future::Future")).toBe(true);
    expect(PRELUDE_TYPES_2024.has("future::IntoFuture")).toBe(true);

    // 2024 is a superset of 2021
    for (const type of PRELUDE_TYPES_2021) {
      expect(PRELUDE_TYPES_2024.has(type)).toBe(true);
    }
  });
});
