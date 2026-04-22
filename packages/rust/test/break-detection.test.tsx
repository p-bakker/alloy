import { describe, expect, it } from "vitest";

import {
  Attribute,
  DocComment,
  FunctionDeclaration,
  InnerAttribute,
  InnerDocComment,
} from "../src/components/index.js";
import {
  hasLeadingBreak,
  hasTrailingBreak,
  isDocCommentOrAttribute,
} from "../src/components/primitives/break-detection.js";

describe("hasTrailingBreak", () => {
  it("detects a trailing hardline intrinsic", () => {
    expect(hasTrailingBreak(<hbr />)).toBe(true);
  });

  it("detects a trailing soft line break intrinsic", () => {
    expect(hasTrailingBreak(<sbr />)).toBe(true);
  });

  it("detects a trailing regular-line-break intrinsic", () => {
    expect(hasTrailingBreak(<br />)).toBe(true);
  });

  it("detects a trailing <hardline /> intrinsic", () => {
    expect(hasTrailingBreak(<hardline />)).toBe(true);
  });

  it("detects a trailing <softline /> intrinsic", () => {
    expect(hasTrailingBreak(<softline />)).toBe(true);
  });

  it("detects a trailing <line /> intrinsic", () => {
    expect(hasTrailingBreak(<line />)).toBe(true);
  });

  it("detects a string ending in \\n", () => {
    expect(hasTrailingBreak("hello\n")).toBe(true);
  });

  it("returns false for a string without a trailing newline", () => {
    expect(hasTrailingBreak("hello")).toBe(false);
  });

  it("picks the last non-empty member of an array", () => {
    expect(hasTrailingBreak(["a", <hbr />, "", undefined])).toBe(true);
  });

  it("returns false when the last non-empty array member is not a break", () => {
    expect(hasTrailingBreak([<hbr />, "tail"])).toBe(false);
  });

  it("does not recurse into deeper array nesting", () => {
    expect(hasTrailingBreak(["head", ["inner", <hbr />]])).toBe(false);
  });

  it("treats user components as opaque", () => {
    expect(hasTrailingBreak(<FunctionDeclaration name="f" />)).toBe(false);
  });

  it("returns false for empty / undefined / null / false", () => {
    expect(hasTrailingBreak(undefined)).toBe(false);
    expect(hasTrailingBreak(null)).toBe(false);
    expect(hasTrailingBreak(false)).toBe(false);
    expect(hasTrailingBreak("")).toBe(false);
    expect(hasTrailingBreak([])).toBe(false);
    expect(hasTrailingBreak([undefined, null, false, ""])).toBe(false);
  });
});

describe("hasLeadingBreak", () => {
  it("detects a leading hardline intrinsic", () => {
    expect(hasLeadingBreak(<hbr />)).toBe(true);
  });

  it("detects a string starting with \\n", () => {
    expect(hasLeadingBreak("\nhello")).toBe(true);
  });

  it("returns false for a string without a leading newline", () => {
    expect(hasLeadingBreak("hello")).toBe(false);
  });

  it("picks the first non-empty member of an array", () => {
    expect(hasLeadingBreak(["", undefined, <hbr />, "tail"])).toBe(true);
  });

  it("returns false when the first non-empty array member is not a break", () => {
    expect(hasLeadingBreak(["head", <hbr />])).toBe(false);
  });

  it("does not recurse into deeper array nesting", () => {
    expect(hasLeadingBreak([[<hbr />, "inner"], "tail"])).toBe(false);
  });

  it("treats user components as opaque", () => {
    expect(hasLeadingBreak(<FunctionDeclaration name="f" />)).toBe(false);
  });

  it("returns false for empty / undefined / null / false", () => {
    expect(hasLeadingBreak(undefined)).toBe(false);
    expect(hasLeadingBreak(null)).toBe(false);
    expect(hasLeadingBreak(false)).toBe(false);
    expect(hasLeadingBreak("")).toBe(false);
    expect(hasLeadingBreak([])).toBe(false);
    expect(hasLeadingBreak([undefined, null, false, ""])).toBe(false);
  });
});

describe("isDocCommentOrAttribute", () => {
  it("returns true for a DocComment component", () => {
    expect(isDocCommentOrAttribute(<DocComment>hi</DocComment>)).toBe(true);
  });

  it("returns true for an InnerDocComment component", () => {
    expect(isDocCommentOrAttribute(<InnerDocComment>hi</InnerDocComment>)).toBe(
      true,
    );
  });

  it("returns true for an Attribute component", () => {
    expect(isDocCommentOrAttribute(<Attribute name="derive" />)).toBe(true);
  });

  it("returns true for an InnerAttribute component", () => {
    expect(isDocCommentOrAttribute(<InnerAttribute name="allow" />)).toBe(true);
  });

  it("returns true for a string starting with '///'", () => {
    expect(isDocCommentOrAttribute("/// hello")).toBe(true);
  });

  it("returns true for a string starting with '//!'", () => {
    expect(isDocCommentOrAttribute("//! crate docs")).toBe(true);
  });

  it("returns true for a string starting with '#['", () => {
    expect(isDocCommentOrAttribute("#[derive(Debug)]")).toBe(true);
  });

  it("returns true for a string starting with '#!['", () => {
    expect(isDocCommentOrAttribute("#![allow(dead_code)]")).toBe(true);
  });

  it("returns false for an ordinary string", () => {
    expect(isDocCommentOrAttribute("fn foo()")).toBe(false);
  });

  it("returns false for an unrelated user component", () => {
    expect(isDocCommentOrAttribute(<FunctionDeclaration name="f" />)).toBe(
      false,
    );
  });

  it("looks at the first non-empty array member", () => {
    expect(
      isDocCommentOrAttribute(["", undefined, <DocComment>hi</DocComment>]),
    ).toBe(true);
    expect(
      isDocCommentOrAttribute([<FunctionDeclaration name="f" />, "tail"]),
    ).toBe(false);
  });

  it("does not recurse into deeper array nesting", () => {
    expect(
      isDocCommentOrAttribute([[<DocComment>hi</DocComment>], "tail"]),
    ).toBe(false);
  });

  it("returns false for empty / undefined / null / false", () => {
    expect(isDocCommentOrAttribute(undefined)).toBe(false);
    expect(isDocCommentOrAttribute(null)).toBe(false);
    expect(isDocCommentOrAttribute(false)).toBe(false);
    expect(isDocCommentOrAttribute("")).toBe(false);
    expect(isDocCommentOrAttribute([])).toBe(false);
  });
});
