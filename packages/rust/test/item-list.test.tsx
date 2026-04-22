import "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  AssociatedType,
  Attribute,
  ConstDeclaration,
  DocComment,
  FunctionDeclaration,
  ImplBlock,
  StructDeclaration,
} from "../src/components/index.js";
import { ItemList } from "../src/components/primitives/item-list.js";
import { RustFormatOptions } from "../src/context/format-options.js";
import { toSourceText } from "./utils.js";

/**
 * `ItemList` is a pure gap-insertion primitive. The top-level tests
 * construct fully synthetic string children so behaviour can be
 * inspected structurally without any interference from real-component
 * rendering. The associated-mode tests need the real component
 * references because `classifyAssociatedItem` matches on component
 * identity, so they wrap the list in an `ImplBlock` to get the scope
 * each associated component requires. The assertion in those cases
 * targets the full `impl` body — the indented lines produced inside
 * `{ ... }` are what exercise the `ItemList` gap decisions.
 */

describe("ItemList — topLevel mode, autoBlankLines on", () => {
  it("promotes a single authored <hbr/> between two items to a blank line", () => {
    const src = toSourceText(
      <ItemList mode="topLevel">{["item1;", <hbr />, "item2;"]}</ItemList>,
    );
    expect(src).toBe("item1;\n\nitem2;");
  });

  it("promotes every single-hbr seam in a three-run list", () => {
    const src = toSourceText(
      <ItemList mode="topLevel">
        {["a;", <hbr />, "b;", <hbr />, "c;"]}
      </ItemList>,
    );
    expect(src).toBe("a;\n\nb;\n\nc;");
  });

  it("preserves two-or-more authored breaks untouched (no extra blank)", () => {
    const src = toSourceText(
      <ItemList mode="topLevel">{["a;", <hbr />, <hbr />, "b;"]}</ItemList>,
    );
    expect(src).toBe("a;\n\nb;");
  });

  it("does not split un-separated siblings into items", () => {
    // No authored <hbr/> between the two strings — they're a single
    // logical run and render adjacent. Mirrors JSX children like
    // `type Alias = {refkey};` that expand to multiple siblings but
    // represent one statement.
    const src = toSourceText(
      <ItemList mode="topLevel">{["a;", "b;"]}</ItemList>,
    );
    expect(src).toBe("a;b;");
  });

  it("suppresses the promotion blank when the right run begins with a newline", () => {
    const src = toSourceText(
      <ItemList mode="topLevel">{["a;", <hbr />, "\nb;"]}</ItemList>,
    );
    expect(src).toBe("a;\n\nb;");
  });

  it("suppresses the promotion blank when the left run ends with a newline", () => {
    const src = toSourceText(
      <ItemList mode="topLevel">{["a;\n", <hbr />, "b;"]}</ItemList>,
    );
    expect(src).toBe("a;\n\nb;");
  });

  it("emits no separators for a single item", () => {
    const src = toSourceText(<ItemList mode="topLevel">{["only;"]}</ItemList>);
    expect(src).toBe("only;");
  });

  it("emits nothing for empty children", () => {
    const src = toSourceText(<ItemList mode="topLevel">{[]}</ItemList>);
    expect(src).toBe("");
  });

  it("inserts a blank between two StructDeclarations with no authored marker", () => {
    // The runs-based policy required an authored `<hbr/>` between
    // siblings to insert a blank. Under default-on auto-insertion the
    // blank fires without any authored marker.
    const src = toSourceText(
      <ItemList mode="topLevel">
        <StructDeclaration name="A" />
        <StructDeclaration name="B" />
      </ItemList>,
    );
    expect(src).toBe(["struct A;", "", "struct B;"].join("\n"));
  });

  it("keeps exactly one blank between two StructDeclarations with one authored <hbr/>", () => {
    // Authored markers suppress auto-insertion (don't double it).
    const src = toSourceText(
      <ItemList mode="topLevel">
        <StructDeclaration name="A" />
        <hbr />
        <StructDeclaration name="B" />
      </ItemList>,
    );
    expect(src).toBe(["struct A;", "", "struct B;"].join("\n"));
  });

  it("treats a raw string between two structs as its own glue item", () => {
    // Glue arriving between real items is an item in its own right —
    // a blank line fires on both sides rather than the glue attaching
    // silently as prelude of the next real item. Mirrors the
    // raw-text-macro-before-const shape in rust-example-timovv.
    const src = toSourceText(
      <ItemList mode="topLevel">
        <StructDeclaration name="A" />
        {"// a note\n"}
        <StructDeclaration name="B" />
      </ItemList>,
    );
    expect(src).toBe(
      ["struct A;", "", "// a note", "", "struct B;"].join("\n"),
    );
  });

  it("treats a decoration+glue run before a real item as its own glue item", () => {
    // `#[macro_export]` looks like a decoration (raw `#[` string) but
    // is followed by raw-string glue that doesn't terminate in a real
    // item boundary before the next real sibling. The whole run must
    // form a single item so the blank fires between it and the
    // following ConstDeclaration.
    const src = toSourceText(
      <ItemList mode="topLevel">
        {"#[macro_export]"}
        {"\nmacro_rules! m { () => {}; }"}
        <ConstDeclaration name="K" type="u32">
          1
        </ConstDeclaration>
      </ItemList>,
    );
    expect(src).toBe(
      [
        "#[macro_export]",
        "macro_rules! m { () => {}; }",
        "",
        "const K: u32 = 1;",
      ].join("\n"),
    );
  });

  it("still attaches a pure-decoration run as prelude of the next real item", () => {
    // A run consisting entirely of recognised decorations (doc
    // comment + outer attribute) attaches as prelude to the following
    // real item rather than splitting off into its own glue item.
    const src = toSourceText(
      <ItemList mode="topLevel">
        <StructDeclaration name="A" />
        <DocComment>docs</DocComment>
        <Attribute name="inline" />
        <StructDeclaration name="B" />
      </ItemList>,
    );
    expect(src).toBe(
      ["struct A;", "", "/// docs", "#[inline]", "struct B;"].join("\n"),
    );
  });

  it("filters falsy JSX entries and blanks between real items", () => {
    const src = toSourceText(
      <ItemList mode="topLevel">
        {[
          <StructDeclaration name="A" />,
          undefined,
          null,
          false,
          <StructDeclaration name="B" />,
        ]}
      </ItemList>,
    );
    expect(src).toBe(["struct A;", "", "struct B;"].join("\n"));
  });

  it("does not blank between adjacent same-kind packable ConstDeclarations", () => {
    // Packable-same-kind: two adjacent `const`s pack with a single
    // newline, not a blank line, matching stdlib.
    const src = toSourceText(
      <ItemList mode="topLevel">
        <ConstDeclaration name="A" type="u32">
          1
        </ConstDeclaration>
        <ConstDeclaration name="B" type="u32">
          2
        </ConstDeclaration>
      </ItemList>,
    );
    expect(src).toBe(["const A: u32 = 1;", "const B: u32 = 2;"].join("\n"));
  });
});

describe("ItemList — associated mode, autoBlankLines on", () => {
  it("puts a blank line between two function declarations", () => {
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <FunctionDeclaration name="a" receiver="none" />
          <FunctionDeclaration name="b" receiver="none" />
        </ItemList>
      </ImplBlock>,
    );
    expect(src).toBe(
      ["impl Foo {", "    fn a() {}", "", "    fn b() {}", "}"].join("\n"),
    );
  });

  it("packs two associated types with a single hbr, no blank", () => {
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <AssociatedType name="A" />
          <AssociatedType name="B" />
        </ItemList>
      </ImplBlock>,
    );
    expect(src).toBe(
      ["impl Foo {", "    type A;", "    type B;", "}"].join("\n"),
    );
  });

  it("packs three associated types with single hbrs, no blanks", () => {
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <AssociatedType name="A" />
          <AssociatedType name="B" />
          <AssociatedType name="C" />
        </ItemList>
      </ImplBlock>,
    );
    expect(src).toBe(
      ["impl Foo {", "    type A;", "    type B;", "    type C;", "}"].join(
        "\n",
      ),
    );
  });

  it("inserts a blank line when a fn-like item follows an associated type", () => {
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <AssociatedType name="T" />
          <FunctionDeclaration name="f" receiver="none" />
        </ItemList>
      </ImplBlock>,
    );
    expect(src).toBe(
      ["impl Foo {", "    type T;", "", "    fn f() {}", "}"].join("\n"),
    );
  });

  it("mixed type/type/fn/fn: pack assoc group, blank around fns", () => {
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <AssociatedType name="A" />
          <AssociatedType name="B" />
          <FunctionDeclaration name="f" receiver="none" />
          <FunctionDeclaration name="g" receiver="none" />
        </ItemList>
      </ImplBlock>,
    );
    expect(src).toBe(
      [
        "impl Foo {",
        "    type A;",
        "    type B;",
        "",
        "    fn f() {}",
        "",
        "    fn g() {}",
        "}",
      ].join("\n"),
    );
  });

  it("inserts a blank line when the right child starts with a DocComment", () => {
    // Between adjacent assoc-types the default gap is a single hbr
    // (no blank). A DocComment on the right forces the blank regardless
    // of classification.
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <AssociatedType name="A" />
          <DocComment>docs</DocComment>
        </ItemList>
      </ImplBlock>,
    );
    // The trailing blank before `}` comes from `DocComment`'s own
    // trailing hbr; `ItemList` only owns the seam between adjacent
    // siblings.
    expect(src).toBe(
      ["impl Foo {", "    type A;", "", "    /// docs", "", "}"].join("\n"),
    );
  });

  it("attaches a DocComment sibling as a decoration on the following fn", () => {
    // Regression: a DocComment followed by a FunctionDeclaration with
    // no authored gap marker is a single decorated item. Emitting them
    // as separate items produced two blank lines (the auto-blank
    // between two 'fn' items plus the DocComment's own trailing
    // newline); the fix groups them so only the DocComment's own
    // trailing newline separates `///` from `fn`.
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <DocComment>Creates a Foo.</DocComment>
          <FunctionDeclaration name="new" receiver="none" />
        </ItemList>
      </ImplBlock>,
    );
    expect(src).toBe(
      ["impl Foo {", "    /// Creates a Foo.", "    fn new() {}", "}"].join(
        "\n",
      ),
    );
  });

  it("groups decorated fns and auto-blanks between items", () => {
    // The canonical offending shape from `samples/rust-example`: a
    // sequence of doc-commented methods. Each DocComment+fn is one
    // logical item; adjacent items get a blank line between them
    // (not between the DocComment and its own fn).
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <DocComment>Creates a Foo.</DocComment>
          <FunctionDeclaration name="new" receiver="none" />
          <DocComment>Sets the capacity.</DocComment>
          <FunctionDeclaration name="set_capacity" receiver="self" />
        </ItemList>
      </ImplBlock>,
    );
    expect(src).toBe(
      [
        "impl Foo {",
        "    /// Creates a Foo.",
        "    fn new() {}",
        "",
        "    /// Sets the capacity.",
        "    fn set_capacity(self) {}",
        "}",
      ].join("\n"),
    );
  });

  it("accumulates multiple decorations (doc + attribute) onto one item", () => {
    // DocComment + Attribute + fn should render as a single decorated
    // item with the decorations flowing directly into the fn line.
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <DocComment>Mutates.</DocComment>
          <Attribute name="must_use" />
          <FunctionDeclaration name="mutate" receiver="self" />
        </ItemList>
      </ImplBlock>,
    );
    expect(src).toBe(
      [
        "impl Foo {",
        "    /// Mutates.",
        "    #[must_use]",
        "    fn mutate(self) {}",
        "}",
      ].join("\n"),
    );
  });

  it("honours an authored <hbr/> between decorated items verbatim", () => {
    // When the caller authors an explicit `<hbr/>` between two
    // decorated items, ItemList emits exactly that marker and skips
    // auto-blank insertion — the caller's seam is the final word on
    // spacing.
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <DocComment>First.</DocComment>
          <FunctionDeclaration name="a" receiver="none" />
          <hbr />
          <DocComment>Second.</DocComment>
          <FunctionDeclaration name="b" receiver="none" />
        </ItemList>
      </ImplBlock>,
    );
    // One authored hbr between `}` of `a` and `/// Second.` → a single
    // newline → no blank line.
    expect(src).toBe(
      [
        "impl Foo {",
        "    /// First.",
        "    fn a() {}",
        "    /// Second.",
        "    fn b() {}",
        "}",
      ].join("\n"),
    );
  });

  it("emits a decoration-only trailing item without an extra blank", () => {
    // A DocComment at the end of a body with no following content is a
    // trailing decoration-only item. The gap before it still follows
    // the right-item-has-decorations rule (blank forced); after it,
    // the ImplBlock's closing `}` comes next without additional
    // separator.
    const src = toSourceText(
      <ImplBlock type="Foo">
        <ItemList mode="associated">
          <FunctionDeclaration name="a" receiver="none" />
          <DocComment>trailing</DocComment>
        </ItemList>
      </ImplBlock>,
    );
    expect(src).toBe(
      ["impl Foo {", "    fn a() {}", "", "    /// trailing", "", "}"].join(
        "\n",
      ),
    );
  });
});

describe("ItemList — autoBlankLines=false fall-through", () => {
  it("topLevel mode leaves a single authored <hbr/> un-promoted", () => {
    const src = toSourceText(
      <RustFormatOptions value={{ emitter: { autoBlankLines: false } }}>
        <ItemList mode="topLevel">{["a;", <hbr />, "b;"]}</ItemList>
      </RustFormatOptions>,
    );
    expect(src).toBe("a;\nb;");
  });

  it("associated mode emits only a single hbr between fn-like items", () => {
    const src = toSourceText(
      <RustFormatOptions value={{ emitter: { autoBlankLines: false } }}>
        <ImplBlock type="Foo">
          <ItemList mode="associated">
            <FunctionDeclaration name="a" receiver="none" />
            <FunctionDeclaration name="b" receiver="none" />
          </ItemList>
        </ImplBlock>
      </RustFormatOptions>,
    );
    expect(src).toBe(
      ["impl Foo {", "    fn a() {}", "    fn b() {}", "}"].join("\n"),
    );
  });
});
