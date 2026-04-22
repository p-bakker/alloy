/**
 * Break-detection helpers used by the Rust emitter's auto-blank-line
 * logic to decide whether a seam between two sibling children already
 * carries a leading or trailing hardline — so auto-insertion doesn't
 * double up on a manual break the caller has authored.
 *
 * **Shallow by design.** These helpers inspect a `Children` value only
 * at its outer edge plus one level of array / Fragment flattening.
 * They do NOT recurse into user components: a component whose rendered
 * output ends in a hardline will NOT be detected. That tradeoff is
 * deliberate. Auto-blank-line insertion falls back to authored markers
 * (manual `<hbr/>` siblings) for cases the shallow check can't see
 * through, and the `autoBlankLines` format option provides an explicit
 * opt-out when a user's opaque wrapper causes doubled blank lines.
 *
 * All helpers are pure, side-effect-free, and callable outside a
 * component (no hooks, no context access).
 */

import type { Children } from "@alloy-js/core";
import { ELEMENT_NODE, isComponentCreator } from "@alloy-js/core";
import type { AlloyNode, ElementNode } from "@alloy-js/core";

import { Attribute, InnerAttribute } from "../attribute.js";
import { DocComment, InnerDocComment } from "../doc-comment.js";


function isElementNode(child: unknown): child is ElementNode {
  return (
    typeof child === "object" &&
    child !== null &&
    (child as AlloyNode).nodeType === ELEMENT_NODE
  );
}

/** Intrinsic element `name` values that represent a break. */
const BREAK_INTRINSIC_NAMES: ReadonlySet<string> = new Set([
  "hbr",
  "br",
  "sbr",
  "hardline",
  "softline",
  "line",
]);

/**
 * Is `child` an intrinsic element whose `name` is one of the break
 * intrinsics (`hbr`, `br`, `sbr`, `hardline`, `softline`, `line`)?
 */
function isBreakIntrinsic(child: unknown): boolean {
  return isElementNode(child) && BREAK_INTRINSIC_NAMES.has(child.localName);
}

/** Is `child` considered empty for edge-detection purposes? */
function isEmpty(child: Children): boolean {
  if (child === undefined || child === null || child === false) {
    return true;
  }
  if (typeof child === "string" && child.length === 0) {
    return true;
  }
  return false;
}

/**
 * Find the first non-empty child of an array (left-to-right) or the
 * last non-empty child (right-to-left). Returns `undefined` when the
 * array is empty or contains only empties.
 */
function edgeChild(
  arr: readonly Children[],
  side: "leading" | "trailing",
): Children | undefined {
  if (side === "leading") {
    for (const c of arr) {
      if (!isEmpty(c)) {
        return c;
      }
    }
    return undefined;
  }
  for (let i = arr.length - 1; i >= 0; i--) {
    const c = arr[i];
    if (!isEmpty(c)) {
      return c;
    }
  }
  return undefined;
}

/**
 * Inspect an edge (leading or trailing) of `child` with one level of
 * array flattening. Returns the non-empty item sitting at that edge,
 * or `undefined` if there is no such item, or `"deep"` if the edge
 * nests more than one array level (which the shallow check refuses
 * to inspect further).
 */
function resolveEdge(
  child: Children,
  side: "leading" | "trailing",
): Children | undefined | "deep" {
  if (isEmpty(child)) {
    return undefined;
  }
  if (!Array.isArray(child)) {
    return child;
  }
  const inner = edgeChild(child, side);
  if (inner === undefined) {
    return undefined;
  }
  if (Array.isArray(inner)) {
    // Deeper nesting — explicit non-recursion. The shallow check
    // refuses to peek further.
    return "deep";
  }
  return inner;
}

/**
 * Shallow check: does `child` end with a break at its outer edge?
 * Returns true when the rightmost non-empty content is one of the
 * hardline/softline intrinsics (`<hbr/>`, `<br/>`, `<sbr/>`,
 * `<hardline/>`, `<softline/>`, `<line/>`) or a string that ends in
 * `\n`. Flattens an outermost array / Fragment one level; does not
 * recurse into user components (opaque by design).
 */
export function hasTrailingBreak(child: Children): boolean {
  const edge = resolveEdge(child, "trailing");
  if (edge === undefined || edge === "deep") {
    return false;
  }
  if (typeof edge === "string") {
    return edge.endsWith("\n");
  }
  return isBreakIntrinsic(edge);
}

/**
 * Mirror of `hasTrailingBreak` for the leading edge — does the first
 * non-empty item of `child` begin with a break?
 */
export function hasLeadingBreak(child: Children): boolean {
  const edge = resolveEdge(child, "leading");
  if (edge === undefined || edge === "deep") {
    return false;
  }
  if (typeof edge === "string") {
    return edge.startsWith("\n");
  }
  return isBreakIntrinsic(edge);
}

/**
 * True when `child`'s leading edge is a doc comment or outer
 * attribute. Shallow: pattern-matches on the `DocComment` /
 * `InnerDocComment` / `Attribute` / `InnerAttribute` component
 * references and on plain strings beginning with `///`, `//!`, `#[`,
 * or `#![`.
 */
export function isDocCommentOrAttribute(child: Children): boolean {
  const edge = resolveEdge(child, "leading");
  if (edge === undefined || edge === "deep") {
    return false;
  }
  if (typeof edge === "string") {
    return (
      edge.startsWith("///") ||
      edge.startsWith("//!") ||
      edge.startsWith("#[") ||
      edge.startsWith("#![")
    );
  }
  if (isComponentCreator(edge, DocComment)) return true;
  if (isComponentCreator(edge, InnerDocComment)) return true;
  if (isComponentCreator(edge, Attribute)) return true;
  if (isComponentCreator(edge, InnerAttribute)) return true;
  return false;
}
