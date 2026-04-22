import type { Children } from "@alloy-js/core";
import { Output, render } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  AssociatedType,
  Attribute,
  ConstDeclaration,
  CrateDirectory,
  DocComment,
  EnumDeclaration,
  EnumVariant,
  Field,
  FunctionDeclaration,
  ImplBlock,
  SourceFile,
  StructDeclaration,
  TraitDeclaration,
  TypeAlias,
} from "../src/components/index.js";
import { RustFormatOptions } from "../src/context/format-options.js";
import { checkRustfmtAllEditions } from "./rustfmt.js";
import { findFile, toSourceText } from "./utils.js";

/**
 * Integration coverage for the auto-blank-line wire-in at the top level
 * of a `SourceFile`. These tests pin the observable behaviour: adjacent
 * top-level items separated by an authored `<hbr/>` get a blank line
 * between them, an authored doubled break is preserved, and the
 * `autoBlankLines: false` override returns to the legacy single-hardline
 * joining.
 */

describe("SourceFile auto-blank-lines (topLevel)", () => {
  it("inserts a blank line between two adjacent top-level function declarations", () => {
    const source = toSourceText(
      <>
        <FunctionDeclaration name="first" receiver="none" />
        <hbr />
        <FunctionDeclaration name="second" receiver="none" />
      </>,
    );
    expect(source).toBe(["fn first() {}", "", "fn second() {}"].join("\n"));
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("inserts a blank line between every adjacent pair in a mixed run", () => {
    const source = toSourceText(
      <>
        <StructDeclaration name="Item" />
        <hbr />
        <ImplBlock type="Item" />
        <hbr />
        <FunctionDeclaration name="make" receiver="none" />
      </>,
    );
    expect(source).toBe(
      ["struct Item;", "", "impl Item {}", "", "fn make() {}"].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("leaves a caller-authored doubled <hbr/> untouched (no third break)", () => {
    const source = toSourceText(
      <>
        <FunctionDeclaration name="first" receiver="none" />
        <hbr />
        <hbr />
        <FunctionDeclaration name="second" receiver="none" />
      </>,
    );
    // Two authored hardlines render as a blank line (2 newlines). The
    // auto-promotion only kicks in for a single authored break, so we
    // should NOT see a third newline here.
    expect(source).toBe(["fn first() {}", "", "fn second() {}"].join("\n"));
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("falls back to single-hardline joining when autoBlankLines is disabled", () => {
    const source = toSourceText(
      <RustFormatOptions value={{ emitter: { autoBlankLines: false } }}>
        <FunctionDeclaration name="first" receiver="none" />
        <hbr />
        <FunctionDeclaration name="second" receiver="none" />
      </RustFormatOptions>,
    );
    expect(source).toBe(["fn first() {}", "fn second() {}"].join("\n"));
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});

describe("SourceFile auto-blank-lines (topLevel, no authored markers)", () => {
  it("inserts blanks between four adjacent real items with no authored markers", () => {
    // Mirrors the rust-example-timovv models.rs fixture: JSX
    // comments between siblings (filtered by normalizeChildren) and
    // no `<hbr/>` markers. Default-on auto-insertion must still emit
    // blanks between each pair.
    // JSX comments (`{/* ... */}`) between siblings would be filtered
    // by `normalizeChildren`; we emulate the same shape by passing
    // `undefined`/`null`/`false` entries so the fixture tests the
    // same code path the real timovv sample exercises.
    const source = toSourceText(
      <>
        <StructDeclaration
          name="Person"
          attributes={[<Attribute name="derive" args="Debug, Clone" />]}
        />
        {undefined}
        <StructDeclaration
          name="Borrowed"
          attributes={[<Attribute name="derive" args="Debug" />]}
        />
        {null}
        <StructDeclaration
          name="Container"
          attributes={[<Attribute name="derive" args="Debug, Clone" />]}
        />
        {false}
        <EnumDeclaration
          name="Status"
          attributes={[<Attribute name="derive" args="Debug" />]}
        >
          <EnumVariant name="Active" />
          <EnumVariant name="Inactive" />
        </EnumDeclaration>
      </>,
    );
    expect(source).toBe(
      [
        "#[derive(Debug, Clone)]",
        "struct Person;",
        "",
        "#[derive(Debug)]",
        "struct Borrowed;",
        "",
        "#[derive(Debug, Clone)]",
        "struct Container;",
        "",
        "#[derive(Debug)]",
        "enum Status {",
        "    Active,",
        "    Inactive,",
        "}",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});

describe("SourceFile auto-blank-lines (topLevel, packable classification)", () => {
  // Classification policy: a top-level item is "packable"
  // (ConstDeclaration, StaticDeclaration, TypeAlias) or "fn-like"
  // (everything else). A single authored <hbr/> between two same-kind
  // packable items is NOT promoted to a blank line — stdlib packs
  // adjacent same-kind items. Between any other combination a single
  // authored <hbr/> IS promoted.

  it("packs two adjacent const declarations with a single authored hbr", () => {
    const source = toSourceText(
      <>
        <ConstDeclaration name="A" type="u32">
          1
        </ConstDeclaration>
        <hbr />
        <ConstDeclaration name="B" type="u32">
          2
        </ConstDeclaration>
      </>,
    );
    expect(source).toBe(["const A: u32 = 1;", "const B: u32 = 2;"].join("\n"));
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("packs two adjacent type aliases with a single authored hbr", () => {
    const source = toSourceText(
      <>
        <TypeAlias name="A">u32</TypeAlias>
        <hbr />
        <TypeAlias name="B">u64</TypeAlias>
      </>,
    );
    expect(source).toBe(["type A = u32;", "type B = u64;"].join("\n"));
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("blanks between a const and a function (different kinds)", () => {
    const source = toSourceText(
      <>
        <ConstDeclaration name="A" type="u32">
          1
        </ConstDeclaration>
        <hbr />
        <FunctionDeclaration name="f" receiver="none" />
      </>,
    );
    expect(source).toBe(["const A: u32 = 1;", "", "fn f() {}"].join("\n"));
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("blanks between two function declarations (both fn-like)", () => {
    // Regression: two fn-like items always take a blank line between
    // them — unchanged from the pre-classification behaviour.
    const source = toSourceText(
      <>
        <FunctionDeclaration name="a" receiver="none" />
        <hbr />
        <FunctionDeclaration name="b" receiver="none" />
      </>,
    );
    expect(source).toBe(["fn a() {}", "", "fn b() {}"].join("\n"));
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("const + const + struct: packs the const pair, blanks before the struct", () => {
    // Doc attaches to the first const; adjacent consts pack; blank
    // fires at the const/struct seam because the kinds differ.
    const source = toSourceText(
      <>
        <DocComment>file-overview doc</DocComment>
        <ConstDeclaration name="A" type="u32">
          1
        </ConstDeclaration>
        <hbr />
        <ConstDeclaration name="B" type="u32">
          2
        </ConstDeclaration>
        <hbr />
        <ConstDeclaration name="C" type="u32">
          3
        </ConstDeclaration>
        <hbr />
        <StructDeclaration name="S" />
      </>,
    );
    expect(source).toBe(
      [
        "/// file-overview doc",
        "const A: u32 = 1;",
        "const B: u32 = 2;",
        "const C: u32 = 3;",
        "",
        "struct S;",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("does not pack a const next to a type alias (different packable kinds)", () => {
    // Same-kind packing only fires for two components of literally the
    // same creator — a const adjacent to a type is NOT packed.
    const source = toSourceText(
      <>
        <ConstDeclaration name="A" type="u32">
          1
        </ConstDeclaration>
        <hbr />
        <TypeAlias name="B">u32</TypeAlias>
      </>,
    );
    expect(source).toBe(["const A: u32 = 1;", "", "type B = u32;"].join("\n"));
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});

describe("SourceFile auto-blank-lines (use-block to first-item seam)", () => {
  it("inserts a blank line between the use block and the first top-level item", () => {
    const res = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">
            {`use std::fmt;`}
            <hbr />
            <FunctionDeclaration name="foo" receiver="none" />
          </SourceFile>
        </CrateDirectory>
      </Output>,
      { insertFinalNewLine: false },
    );
    const contents = findFile(res, "src/lib.rs").contents.trim();
    expect(contents).toBe(["use std::fmt;", "", "fn foo() {}"].join("\n"));
    expect(() => checkRustfmtAllEditions(contents)).not.toThrow();
  });

  it("emits no extra blank when the source file has imports but no top-level items", () => {
    // Regression: the use-block blank fires off the ItemList's item
    // count. An imports-only source file produces just the use lines
    // with no trailing blank.
    const res = render(
      <Output>
        <CrateDirectory name="my_crate">
          <SourceFile path="lib.rs">{`use std::fmt;`}</SourceFile>
        </CrateDirectory>
      </Output>,
      { insertFinalNewLine: false },
    );
    const contents = findFile(res, "src/lib.rs").contents.trim();
    expect(contents).toBe("use std::fmt;");
  });
});

describe("ImplBlock / TraitDeclaration auto-blank-lines (associated)", () => {
  it("inserts a blank line between two adjacent impl methods", () => {
    const source = toSourceText(
      <ImplBlock type="Foo">
        <FunctionDeclaration name="a" receiver="none" />
        <FunctionDeclaration name="b" receiver="none" />
      </ImplBlock>,
    );
    expect(source).toBe(
      ["impl Foo {", "    fn a() {}", "", "    fn b() {}", "}"].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("packs adjacent AssociatedType items but blanks before a fn-like item", () => {
    const source = toSourceText(
      <ImplBlock type="Foo">
        <AssociatedType name="Foo">u32</AssociatedType>
        <AssociatedType name="Bar">u64</AssociatedType>
        <FunctionDeclaration name="run" receiver="none" />
      </ImplBlock>,
    );
    expect(source).toBe(
      [
        "impl Foo {",
        "    type Foo = u32;",
        "    type Bar = u64;",
        "",
        "    fn run() {}",
        "}",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("inserts a blank line between two adjacent trait methods", () => {
    const source = toSourceText(
      <TraitDeclaration name="Foo">
        <FunctionDeclaration name="a" receiver="none" />
        <FunctionDeclaration name="b" receiver="none" />
      </TraitDeclaration>,
    );
    expect(source).toBe(
      ["trait Foo {", "    fn a();", "", "    fn b();", "}"].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("blank-lines before a doc-commented method regardless of classification", () => {
    const source = toSourceText(
      <ImplBlock type="Foo">
        <AssociatedType name="Out">u32</AssociatedType>
        <FunctionDeclaration name="run" receiver="none" doc="Does the thing." />
      </ImplBlock>,
    );
    expect(source).toBe(
      [
        "impl Foo {",
        "    type Out = u32;",
        "",
        "    /// Does the thing.",
        "    fn run() {}",
        "}",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("groups DocComment+FunctionDeclaration siblings into one decorated item", () => {
    // Regression: siblings `<DocComment/><FunctionDeclaration/>` used
    // to be treated as two distinct items, producing two blank lines
    // between the doc comment and the fn it decorated (the auto-blank
    // between 'fn'-classified items plus the doc comment's own
    // trailing newline). Now they form one decorated item and the
    // decoration's own newline is the only separator.
    const source = toSourceText(
      <ImplBlock type="Config">
        <DocComment>Creates a new Config with sensible defaults.</DocComment>
        <FunctionDeclaration name="new" receiver="none" />

        <DocComment>Sets the maximum number of entries.</DocComment>
        <FunctionDeclaration
          name="with_max_capacity"
          receiver="self"
          attributes={[<Attribute name="must_use" />]}
        />
      </ImplBlock>,
    );
    expect(source).toBe(
      [
        "impl Config {",
        "    /// Creates a new Config with sensible defaults.",
        "    fn new() {}",
        "",
        "    /// Sets the maximum number of entries.",
        "    #[must_use]",
        "    fn with_max_capacity(self) {}",
        "}",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("collapses to single hbr between impl methods when autoBlankLines is disabled", () => {
    const source = toSourceText(
      <RustFormatOptions value={{ emitter: { autoBlankLines: false } }}>
        <ImplBlock type="Foo">
          <FunctionDeclaration name="a" receiver="none" />
          <FunctionDeclaration name="b" receiver="none" />
        </ImplBlock>
      </RustFormatOptions>,
    );
    expect(source).toBe(
      ["impl Foo {", "    fn a() {}", "    fn b() {}", "}"].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});

describe("FieldList packed-decoration rendering (fields and variants)", () => {
  // The Rust emitter deliberately does NOT insert a blank line before a
  // doc-commented or attributed field / variant — stdlib enums like
  // `std::cmp::Ordering` and `std::io::ErrorKind` keep adjacent
  // doc-commented variants packed. Packed rendering is therefore the
  // idiomatic default and the `autoBlankLines` flag has no influence
  // inside a `FieldList`.

  it("keeps a doc-commented non-first struct field packed against the previous field", () => {
    const source = toSourceText(
      <StructDeclaration name="Foo">
        <Field name="a" type="i32" />
        <Field name="b" type="i32" doc="Second field has a doc." />
        <Field name="c" type="i32" />
      </StructDeclaration>,
    );
    expect(source).toBe(
      [
        "struct Foo {",
        "    a: i32,",
        "    /// Second field has a doc.",
        "    b: i32,",
        "    c: i32,",
        "}",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps an attributed non-first struct field packed against the previous field", () => {
    const source = toSourceText(
      <StructDeclaration name="Foo">
        <Field name="a" type="i32" />
        <Field name="b" type="i32" />
        <Field
          name="c"
          type="i32"
          attributes={[<Attribute name="deprecated" />]}
        />
      </StructDeclaration>,
    );
    expect(source).toBe(
      [
        "struct Foo {",
        "    a: i32,",
        "    b: i32,",
        "    #[deprecated]",
        "    c: i32,",
        "}",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps a doc-commented non-first enum variant packed (stdlib-idiomatic)", () => {
    const source = toSourceText(
      <EnumDeclaration name="Color">
        <EnumVariant name="Red" />
        <EnumVariant name="Green" doc="Green channel." />
        <EnumVariant name="Blue" />
        <EnumVariant name="Alpha" />
      </EnumDeclaration>,
    );
    expect(source).toBe(
      [
        "enum Color {",
        "    Red,",
        "    /// Green channel.",
        "    Green,",
        "    Blue,",
        "    Alpha,",
        "}",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("keeps a doc-commented struct-kind enum variant packed", () => {
    const source = toSourceText(
      <EnumDeclaration name="Shape">
        <EnumVariant name="Point" />
        <EnumVariant name="Square" doc="An axis-aligned square." kind="struct">
          {"side: u32"}
        </EnumVariant>
      </EnumDeclaration>,
    );
    expect(source).toBe(
      [
        "enum Shape {",
        "    Point,",
        "    /// An axis-aligned square.",
        "    Square { side: u32 },",
        "}",
      ].join("\n"),
    );
  });

  it("leaves a plain field list untouched when no field carries docs/attrs", () => {
    const source = toSourceText(
      <StructDeclaration name="Foo">
        <Field name="a" type="i32" />
        <Field name="b" type="i32" />
        <Field name="c" type="i32" />
      </StructDeclaration>,
    );
    expect(source).toBe(
      ["struct Foo {", "    a: i32,", "    b: i32,", "    c: i32,", "}"].join(
        "\n",
      ),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("packed rendering is unaffected by the emitter.autoBlankLines flag", () => {
    const source = toSourceText(
      <RustFormatOptions value={{ emitter: { autoBlankLines: false } }}>
        <StructDeclaration name="Foo">
          <Field name="a" type="i32" />
          <Field name="b" type="i32" doc="Second field has a doc." />
          <Field name="c" type="i32" />
        </StructDeclaration>
      </RustFormatOptions>,
    );
    expect(source).toBe(
      [
        "struct Foo {",
        "    a: i32,",
        "    /// Second field has a doc.",
        "    b: i32,",
        "    c: i32,",
        "}",
      ].join("\n"),
    );
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });
});

/**
 * Doc-comment / attribute "glue" regression coverage.
 *
 * The invariant under test: a doc comment and/or outer attribute that
 * decorates an item flows together with the item it decorates, with no
 * blank line anywhere inside the decoration prelude. Only seams between
 * separate items ever get blanks — the `autoBlankLines` flag toggles
 * between-item blanks, never within-item decoration blanks.
 *
 * Each scenario is asserted twice: once with `autoBlankLines: true` (the
 * default) and once with `autoBlankLines: false`. Both must produce the
 * same glued prelude.
 */
describe("doc / attribute decoration glue", () => {
  /**
   * Render `tree` twice — once under the default auto-blank-lines
   * context and once with the flag explicitly disabled — and assert both
   * renderings produce `expected`. Used for decoration-glue invariants
   * which must hold regardless of the flag.
   */
  function expectGluedUnderBothFlags(tree: Children, expected: string): void {
    const withAuto = toSourceText(<>{tree}</>);
    expect(withAuto).toBe(expected);

    const withoutAuto = toSourceText(
      <RustFormatOptions value={{ emitter: { autoBlankLines: false } }}>
        {tree}
      </RustFormatOptions>,
    );
    expect(withoutAuto).toBe(expected);
  }

  describe("fn at top level", () => {
    it("glues doc + attribute via props", () => {
      const expected = ["/// Doc for foo", "#[inline]", "fn foo() {}"].join(
        "\n",
      );
      expectGluedUnderBothFlags(
        <FunctionDeclaration
          name="foo"
          receiver="none"
          doc="Doc for foo"
          attributes={[<Attribute name="inline" />]}
        />,
        expected,
      );
      expect(() => checkRustfmtAllEditions(expected)).not.toThrow();
    });

    it("glues sibling DocComment + Attribute + FunctionDeclaration", () => {
      const expected = ["/// Doc for foo", "#[inline]", "fn foo() {}"].join(
        "\n",
      );
      expectGluedUnderBothFlags(
        <>
          <DocComment>Doc for foo</DocComment>
          <Attribute name="inline" />
          <FunctionDeclaration name="foo" receiver="none" />
        </>,
        expected,
      );
      expect(() => checkRustfmtAllEditions(expected)).not.toThrow();
    });
  });

  describe("struct at top level", () => {
    it("glues doc + derive via props", () => {
      const expected = [
        "/// Doc for S",
        "#[derive(Debug, Clone)]",
        "struct S;",
      ].join("\n");
      expectGluedUnderBothFlags(
        <StructDeclaration
          name="S"
          doc="Doc for S"
          attributes={[<Attribute name="derive" args="Debug, Clone" />]}
        />,
        expected,
      );
      expect(() => checkRustfmtAllEditions(expected)).not.toThrow();
    });

    it("glues sibling DocComment + Attribute + StructDeclaration", () => {
      const expected = [
        "/// Doc for S",
        "#[derive(Debug, Clone)]",
        "struct S;",
      ].join("\n");
      expectGluedUnderBothFlags(
        <>
          <DocComment>Doc for S</DocComment>
          <Attribute name="derive" args="Debug, Clone" />
          <StructDeclaration name="S" />
        </>,
        expected,
      );
      expect(() => checkRustfmtAllEditions(expected)).not.toThrow();
    });
  });

  describe("impl method decorations", () => {
    it("glues doc + attribute on a single method via props", () => {
      const expected = [
        "impl Foo {",
        "    /// Doc for run",
        "    #[inline]",
        "    fn run(&self) {}",
        "}",
      ].join("\n");
      expectGluedUnderBothFlags(
        <ImplBlock type="Foo">
          <FunctionDeclaration
            name="run"
            doc="Doc for run"
            attributes={[<Attribute name="inline" />]}
          />
        </ImplBlock>,
        expected,
      );
      expect(() => checkRustfmtAllEditions(expected)).not.toThrow();
    });

    it("glues sibling DocComment + Attribute + FunctionDeclaration on a method", () => {
      const expected = [
        "impl Foo {",
        "    /// Doc for run",
        "    #[inline]",
        "    fn run(&self) {}",
        "}",
      ].join("\n");
      expectGluedUnderBothFlags(
        <ImplBlock type="Foo">
          <DocComment>Doc for run</DocComment>
          <Attribute name="inline" />
          <FunctionDeclaration name="run" />
        </ImplBlock>,
        expected,
      );
      expect(() => checkRustfmtAllEditions(expected)).not.toThrow();
    });

    it("blanks between doc-decorated methods, glues inside each prelude (props)", () => {
      const source = toSourceText(
        <ImplBlock type="Foo">
          <FunctionDeclaration
            name="a"
            receiver="none"
            doc="Doc for a"
            attributes={[<Attribute name="inline" />]}
          />
          <FunctionDeclaration
            name="b"
            receiver="none"
            doc="Doc for b"
            attributes={[<Attribute name="must_use" />]}
          />
        </ImplBlock>,
      );
      expect(source).toBe(
        [
          "impl Foo {",
          "    /// Doc for a",
          "    #[inline]",
          "    fn a() {}",
          "",
          "    /// Doc for b",
          "    #[must_use]",
          "    fn b() {}",
          "}",
        ].join("\n"),
      );
      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });

    it("blanks between doc-decorated methods, glues inside each prelude (siblings)", () => {
      const source = toSourceText(
        <ImplBlock type="Foo">
          <DocComment>Doc for a</DocComment>
          <Attribute name="inline" />
          <FunctionDeclaration name="a" receiver="none" />
          <DocComment>Doc for b</DocComment>
          <Attribute name="must_use" />
          <FunctionDeclaration name="b" receiver="none" />
        </ImplBlock>,
      );
      expect(source).toBe(
        [
          "impl Foo {",
          "    /// Doc for a",
          "    #[inline]",
          "    fn a() {}",
          "",
          "    /// Doc for b",
          "    #[must_use]",
          "    fn b() {}",
          "}",
        ].join("\n"),
      );
      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });

    it("keeps prelude glued under autoBlankLines: false (single method, siblings)", () => {
      // Disabling the flag only removes blanks BETWEEN items — it must
      // never split a decoration prelude.
      const expected = [
        "impl Foo {",
        "    /// Doc for run",
        "    #[inline]",
        "    fn run(&self) {}",
        "}",
      ].join("\n");
      const source = toSourceText(
        <RustFormatOptions value={{ emitter: { autoBlankLines: false } }}>
          <ImplBlock type="Foo">
            <DocComment>Doc for run</DocComment>
            <Attribute name="inline" />
            <FunctionDeclaration name="run" />
          </ImplBlock>
        </RustFormatOptions>,
      );
      expect(source).toBe(expected);
      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });

    it("keeps prelude glued under autoBlankLines: false across multiple methods (siblings)", () => {
      const source = toSourceText(
        <RustFormatOptions value={{ emitter: { autoBlankLines: false } }}>
          <ImplBlock type="Foo">
            <DocComment>Doc for a</DocComment>
            <Attribute name="inline" />
            <FunctionDeclaration name="a" receiver="none" />
            <DocComment>Doc for b</DocComment>
            <Attribute name="must_use" />
            <FunctionDeclaration name="b" receiver="none" />
          </ImplBlock>
        </RustFormatOptions>,
      );
      expect(source).toBe(
        [
          "impl Foo {",
          "    /// Doc for a",
          "    #[inline]",
          "    fn a() {}",
          "    /// Doc for b",
          "    #[must_use]",
          "    fn b() {}",
          "}",
        ].join("\n"),
      );
      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });
  });

  describe("trait method decorations", () => {
    it("glues doc + attribute on a trait method via props", () => {
      const expected = [
        "trait Foo {",
        "    /// Doc for run",
        "    #[inline]",
        "    fn run(&self);",
        "}",
      ].join("\n");
      expectGluedUnderBothFlags(
        <TraitDeclaration name="Foo">
          <FunctionDeclaration
            name="run"
            doc="Doc for run"
            attributes={[<Attribute name="inline" />]}
          />
        </TraitDeclaration>,
        expected,
      );
      expect(() => checkRustfmtAllEditions(expected)).not.toThrow();
    });

    it("glues sibling DocComment + Attribute + FunctionDeclaration on a trait method", () => {
      const expected = [
        "trait Foo {",
        "    /// Doc for run",
        "    #[inline]",
        "    fn run(&self);",
        "}",
      ].join("\n");
      expectGluedUnderBothFlags(
        <TraitDeclaration name="Foo">
          <DocComment>Doc for run</DocComment>
          <Attribute name="inline" />
          <FunctionDeclaration name="run" />
        </TraitDeclaration>,
        expected,
      );
      expect(() => checkRustfmtAllEditions(expected)).not.toThrow();
    });
  });

  describe("enum + variant decorations", () => {
    it("glues enum-level doc + derive and packs doc-commented variants (stdlib-idiomatic)", () => {
      const source = toSourceText(
        <EnumDeclaration
          name="Color"
          doc="Doc for Color"
          attributes={[<Attribute name="derive" args="Debug, Clone" />]}
        >
          <EnumVariant name="Red" doc="The red channel." />
          <EnumVariant name="Green" doc="The green channel." />
        </EnumDeclaration>,
      );
      expect(source).toBe(
        [
          "/// Doc for Color",
          "#[derive(Debug, Clone)]",
          "enum Color {",
          "    /// The red channel.",
          "    Red,",
          "    /// The green channel.",
          "    Green,",
          "}",
        ].join("\n"),
      );
      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });

    it("keeps enum + variant preludes glued under autoBlankLines: false", () => {
      // Between-variant blank disappears, but the doc stays glued to the
      // variant it decorates and the enum's own prelude stays glued too.
      const source = toSourceText(
        <RustFormatOptions value={{ emitter: { autoBlankLines: false } }}>
          <EnumDeclaration
            name="Color"
            doc="Doc for Color"
            attributes={[<Attribute name="derive" args="Debug, Clone" />]}
          >
            <EnumVariant name="Red" doc="The red channel." />
            <EnumVariant name="Green" doc="The green channel." />
          </EnumDeclaration>
        </RustFormatOptions>,
      );
      expect(source).toBe(
        [
          "/// Doc for Color",
          "#[derive(Debug, Clone)]",
          "enum Color {",
          "    /// The red channel.",
          "    Red,",
          "    /// The green channel.",
          "    Green,",
          "}",
        ].join("\n"),
      );
      expect(() => checkRustfmtAllEditions(source)).not.toThrow();
    });
  });
});
