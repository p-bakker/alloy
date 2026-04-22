import type { AlloyNode, ElementNode } from "@alloy-js/core";
import type { Children } from "@alloy-js/core";
import { ELEMENT_NODE,
  isComponentCreator,
  memo,
  useScope,
} from "@alloy-js/core";

import { useRustFormatOptions } from "../../context/format-options.js";
import { RustModuleScope } from "../../scopes/rust-module-scope.js";
import { AssociatedType } from "../associated-type.js";
import { ConstDeclaration } from "../const-declaration.js";
import { FunctionDeclaration } from "../function-declaration.js";
import { ImplBlock } from "../impl-block.js";
import { MethodChainCall } from "../method-chain-expression.js";
import { StaticDeclaration } from "../static-declaration.js";
import { TypeAlias } from "../type-alias.js";
import { UseStatement } from "../use-statement.js";
import {
  hasLeadingBreak,
  hasTrailingBreak,
  isDocCommentOrAttribute,
} from "./break-detection.js";

export interface ItemListProps {
  children?: Children | Children[];
  /**
   * The gap-policy context:
   *
   * - `"topLevel"` — between items in a source file. Each *run* of
   *   sibling children separated by an authored `<hbr/>` / `<br/>` /
   *   `<sbr/>` is treated as one logical item; a single authored gap
   *   marker between two runs is promoted to a blank line **unless**
   *   both items are the same "packable" kind (`const`, `static`,
   *   `type`), in which case the caller's single marker passes through
   *   verbatim so stdlib-style packed runs of same-kind items stay
   *   packed. Runs that are not separated by an authored marker flow
   *   through adjacent (the caller did not signal a seam). This
   *   preserves inline text fragments like `type Alias = {refkey};`
   *   which JSX splits into multiple sibling children without
   *   intending them as separate items.
   * - `"associated"` — between items inside an `impl` or `trait` body.
   *   Each real-content sibling is a distinct item; a preceding run of
   *   decorations (doc comments, outer attributes) attaches to the
   *   following item rather than forming its own seam. Blank line
   *   between function-like items and between groups of associated
   *   consts / types; no blank line between adjacent associated
   *   consts / types.
   *
   * Note: for `"associated"` mode, decorations on the right item always
   * force a blank line regardless of the classification of the left
   * item.
   */
  mode: "topLevel" | "associated";
  /**
   * `"topLevel"` only: when true, an idiomatic blank line is emitted
   * before the first item whenever the enclosing `RustModuleScope` has
   * at least one import. This keeps the `use` block visually separated
   * from the first real item without the caller needing to author the
   * seam. Has no effect when the item list is empty (no items, no
   * leading blank) or when there are no imports.
   */
  leadingBlankIfImports?: boolean;
}


function isElementNode(child: unknown): child is ElementNode {
  return (
    typeof child === "object" &&
    child !== null &&
    (child as AlloyNode).nodeType === ELEMENT_NODE
  );
}

/** Intrinsic-element names considered authored gap markers. */
const GAP_MARKER_NAMES: ReadonlySet<string> = new Set(["hbr", "br", "sbr"]);

/** Returns true for a standalone `<hbr/>` / `<br/>` / `<sbr/>` sibling. */
function isGapMarker(child: unknown): boolean {
  return isElementNode(child) && GAP_MARKER_NAMES.has(child.localName);
}

/**
 * Components whose sole purpose is to register side-effects on a
 * parent (e.g. a module-scope import) and which render to no text.
 * They must not be treated as content when deciding where to insert
 * blank lines — a run consisting only of such components would
 * otherwise appear as an empty item next to a visible one.
 */
function isInvisibleComponent(child: unknown): boolean {
  return (
    isComponentCreator(child, UseStatement) ||
    isComponentCreator(child, MethodChainCall)
  );
}

/**
 * Is `child` a leading decoration — a doc comment or outer attribute
 * that belongs to the item that follows it, not an item in its own
 * right? Recognised both as component references (`DocComment`,
 * `InnerDocComment`, `Attribute`, `InnerAttribute`) and as raw strings
 * beginning with `///`, `//!`, `#[`, or `#![`.
 *
 * Note: `isDocCommentOrAttribute` is already used to detect decoration
 * on the right of a seam; here we use the same predicate to classify
 * a child as a decoration at walk time.
 */
function isDecoration(child: Children): boolean {
  return isDocCommentOrAttribute(child);
}

/**
 * Flatten one level of arrays / fragments, drop whitespace-only strings,
 * drop `undefined` / `null` / `false`. Mirrors `rust-block.tsx`'s
 * `normalizeChildren` pattern.
 */
function normalizeChildren(children: Children | undefined): Children[] {
  if (children === undefined || children === null) {
    return [];
  }

  const normalized: Children[] = [];
  const queue: Children[] = Array.isArray(children)
    ? [...children]
    : [children];

  while (queue.length > 0) {
    const child = queue.shift();
    if (child === undefined || child === null || child === false) {
      continue;
    }

    if (Array.isArray(child)) {
      queue.unshift(...child);
      continue;
    }

    if (typeof child === "string" && child.trim().length === 0) {
      continue;
    }

    normalized.push(child);
  }

  return normalized;
}

type AssociatedKind = "fn" | "assoc";

/**
 * Classify a child for associated-item gap policy.
 *
 * Recognised components:
 * - `FunctionDeclaration`, `ImplBlock` → `"fn"` (fn-like, always takes a
 *   blank line between siblings).
 * - `AssociatedType` → `"assoc"` (packs with no blank line between
 *   adjacent `"assoc"` items).
 *
 * There is no distinct `AssociatedConst` component in the current
 * codebase — associated consts go through `ConstDeclaration` once a
 * future revision teaches that component about impl/trait scope. When
 * that arrives, add the component reference here so const/type groups
 * pack together.
 *
 * Strings, intrinsics, and any unrecognised user component fall through
 * to `"fn"` — the conservative choice, since emitting an extra blank line
 * around an unknown item is less wrong than collapsing what the user
 * probably meant to separate.
 */
function classifyAssociatedItem(child: Children): AssociatedKind {
  if (isComponentCreator(child, FunctionDeclaration)) return "fn";
  if (isComponentCreator(child, ImplBlock)) return "fn";
  if (isComponentCreator(child, AssociatedType)) return "assoc";
  return "fn";
}

type TopLevelKind = "packable" | "fn-like";

/**
 * Classify a top-level child for source-file gap policy.
 *
 * "packable" items are stdlib-style value declarations that idiomatic
 * Rust packs adjacent-same-kind with no blank line between:
 * `ConstDeclaration`, `StaticDeclaration`, `TypeAlias`. See e.g.
 * `std::f64`'s run of `pub const` entries or `std::io` type aliases.
 *
 * Everything else — `FunctionDeclaration`, `ImplBlock`,
 * `TraitDeclaration`, `StructDeclaration`, `EnumDeclaration`, and any
 * unknown user component — is "fn-like" and gets an idiomatic blank
 * line at seams. Unknown components default to "fn-like" because an
 * extra blank line around an unrecognised top-level item is far less
 * wrong than collapsing what was probably meant to be separated.
 */
function classifyTopLevelItem(child: Children): TopLevelKind {
  if (isComponentCreator(child, ConstDeclaration)) return "packable";
  if (isComponentCreator(child, StaticDeclaration)) return "packable";
  if (isComponentCreator(child, TypeAlias)) return "packable";
  return "fn-like";
}

/**
 * True when `a` and `b` are creators for the SAME packable component
 * kind (both `ConstDeclaration`, both `StaticDeclaration`, both
 * `TypeAlias`). Used by `renderTopLevel` to decide when a pair of
 * packable items should skip auto-blank promotion — stdlib packs
 * adjacent same-kind items but not, say, a `const` next to a `type`.
 */
function sameComponentKind(
  a: Children | undefined,
  b: Children | undefined,
): boolean {
  if (a === undefined || b === undefined) return false;
  if (
    isComponentCreator(a, ConstDeclaration) &&
    isComponentCreator(b, ConstDeclaration)
  ) {
    return true;
  }
  if (
    isComponentCreator(a, StaticDeclaration) &&
    isComponentCreator(b, StaticDeclaration)
  ) {
    return true;
  }
  if (isComponentCreator(a, TypeAlias) && isComponentCreator(b, TypeAlias)) {
    return true;
  }
  return false;
}

/**
 * An item carries its own leading decorations (doc comments, outer
 * attributes) together with the real content it decorates. Invisible
 * registration-only components ride along in `content` so they still
 * render for side-effects without being treated as a gap-deciding
 * sibling.
 */
interface Item {
  decorations: Children[];
  content: Children[]; // real content + invisible passengers
}

/**
 * Emit items with rustfmt-aligned gaps between siblings.
 *
 * Behaviour depends on `mode`:
 *
 * - `"topLevel"` (source-file children): scans siblings for authored
 *   gap markers (`<hbr/>` / `<br/>` / `<sbr/>`). Each contiguous span
 *   of sibling children between authored markers is one logical item;
 *   a run of decorations followed by real content collapses into a
 *   single item's decoration+content. When `autoBlankLines` is `true`
 *   (the default), a run of exactly one authored marker between two
 *   items is promoted to a blank line (double hbr); runs of
 *   two-or-more authored markers pass through untouched. When
 *   `autoBlankLines` is `false`, all authored markers pass through
 *   untouched. This accommodates JSX children like `type Alias =
 *   {refkey};` which expand to multiple sibling children but are a
 *   single logical item — no authored seam, no auto-blank.
 *
 * - `"associated"` (impl / trait body): each real-content sibling is a
 *   distinct item; a decoration preceding it attaches to that item
 *   rather than forming its own seam. When `autoBlankLines` is
 *   `true`, inserts a blank line at idiomatic seams based on whether
 *   either side is function-like or the right item carries a leading
 *   decoration. A manual break already authored between two items —
 *   a standalone `<hbr/>`, `<br/>`, `<sbr/>` sibling, a trailing `\n`
 *   on the left, or a leading `\n` on the right — suppresses the
 *   auto-insertion. When `autoBlankLines` is `false`, emits a single
 *   `<hbr/>` between adjacent siblings.
 */
export function ItemList(props: ItemListProps) {
  const opts = useRustFormatOptions();
  const autoBlank = opts.emitter?.autoBlankLines !== false;
  const normalized = normalizeChildren(props.children);

  if (normalized.length === 0) {
    return <></>;
  }

  if (props.mode === "topLevel") {
    const scope = useScope();
    const moduleScope = scope instanceof RustModuleScope ? scope : undefined;
    // The seam between a use-block and the first item must be decided
    // reactively: `scope.imports.size` is populated by `<UseStatement>`
    // / `<Reference>` children whose render-time effects happen during
    // the same pass that evaluates this seam. Reading the Map size
    // eagerly here would miss those late additions, so we defer it to
    // a `memo` that the renderer re-evaluates once all registrations
    // have settled.
    const useSeam =
      props.leadingBlankIfImports === true && moduleScope !== undefined
        ? memo(() =>
            moduleScope.imports.size > 0 ? (
              <>
                <hbr />
                <hbr />
              </>
            ) : undefined,
          )
        : undefined;
    return renderTopLevel(normalized, autoBlank, useSeam);
  }
  return renderAssociated(normalized, autoBlank);
}

/**
 * Group `normalized` into top-level items, returning the items along
 * with the count of authored gap markers between each adjacent pair
 * and any leading / trailing orphan markers / invisibles.
 *
 * Item boundaries:
 * - A gap marker always closes the current item.
 * - A decoration that appears after the current item already has real
 *   content also closes the current item (the decoration belongs to a
 *   new item).
 * - Otherwise children accumulate into the current item: decorations
 *   into `decorations`, real content into `content`, invisibles into
 *   `content` as passengers.
 */
function groupTopLevel(normalized: Children[]): {
  items: Item[];
  markerCounts: number[]; // length = items.length - 1
  leadingMarkers: Children[];
  trailingMarkers: Children[];
  trailingInvisible: Children[];
} {
  const items: Item[] = [];
  const markerCounts: number[] = [];
  const leadingMarkers: Children[] = [];

  let current: Item = { decorations: [], content: [] };
  let hasContent = false;
  let pendingMarkers: Children[] = [];
  let pendingInvisible: Children[] = [];
  let seenAnyItem = false;

  function currentHasAnything(): boolean {
    return hasContent || current.decorations.length > 0;
  }

  function flushCurrent(): void {
    if (!currentHasAnything()) return;
    items.push(current);
    current = { decorations: [], content: [] };
    hasContent = false;
    seenAnyItem = true;
  }

  function applyPendingSeam(): void {
    // Called immediately before adding the first child of a new item
    // when a previous item exists. Records the authored-marker count
    // between the previous item and this one.
    if (items.length > 0 && markerCounts.length < items.length) {
      markerCounts.push(pendingMarkers.length);
      pendingMarkers = [];
    }
    // Invisibles accumulated between items attach to the new item so
    // they render as part of this item's content.
    if (pendingInvisible.length > 0) {
      for (const inv of pendingInvisible) current.content.push(inv);
      pendingInvisible = [];
    }
  }

  for (const child of normalized) {
    if (isGapMarker(child)) {
      if (currentHasAnything()) {
        flushCurrent();
      }
      if (!seenAnyItem) {
        leadingMarkers.push(child);
      } else {
        pendingMarkers.push(child);
      }
      continue;
    }

    if (isInvisibleComponent(child)) {
      if (hasContent || current.decorations.length > 0) {
        current.content.push(child);
      } else {
        pendingInvisible.push(child);
      }
      continue;
    }

    if (isDecoration(child)) {
      if (hasContent) {
        // Decoration after real content with no gap marker — starts a
        // new item.
        flushCurrent();
      }
      if (!currentHasAnything()) {
        applyPendingSeam();
      }
      current.decorations.push(child);
      continue;
    }

    // Real content child.
    if (!currentHasAnything()) {
      applyPendingSeam();
    }
    current.content.push(child);
    hasContent = true;
  }

  if (currentHasAnything()) {
    items.push(current);
  }

  return {
    items,
    markerCounts,
    leadingMarkers,
    trailingMarkers: pendingMarkers,
    trailingInvisible: pendingInvisible,
  };
}

/**
 * Group `normalized` into associated-body items. Each real-content
 * sibling is its own item; a run of decorations before it attaches to
 * that item as its leading decoration list. An authored gap marker
 * also closes any decoration-only item (so `<DocComment/><hbr/><Fn/>`
 * yields a decoration-only item followed by a separate `<Fn/>` item).
 */
function groupAssociated(normalized: Children[]): {
  items: Item[];
  markerCounts: number[];
  leadingMarkers: Children[];
  trailingMarkers: Children[];
  trailingInvisible: Children[];
} {
  const items: Item[] = [];
  const markerCounts: number[] = [];
  const leadingMarkers: Children[] = [];

  let currentDecorations: Children[] = [];
  let pendingMarkers: Children[] = [];
  let pendingInvisible: Children[] = [];
  let seenAnyItem = false;

  function pushItem(item: Item): void {
    if (items.length > 0) {
      markerCounts.push(pendingMarkers.length);
      pendingMarkers = [];
    } else if (pendingMarkers.length > 0) {
      // Orphan markers before the first item — preserve as leading.
      for (const m of pendingMarkers) leadingMarkers.push(m);
      pendingMarkers = [];
    }
    if (pendingInvisible.length > 0) {
      item.content.unshift(...pendingInvisible);
      pendingInvisible = [];
    }
    items.push(item);
    seenAnyItem = true;
  }

  for (const child of normalized) {
    if (isGapMarker(child)) {
      // If we have accumulated decorations without following content,
      // a gap marker flushes them as a decoration-only item so the
      // caller's explicit seam is honoured.
      if (currentDecorations.length > 0) {
        pushItem({ decorations: currentDecorations, content: [] });
        currentDecorations = [];
      }
      if (!seenAnyItem) {
        leadingMarkers.push(child);
      } else {
        pendingMarkers.push(child);
      }
      continue;
    }

    if (isInvisibleComponent(child)) {
      pendingInvisible.push(child);
      continue;
    }

    if (isDecoration(child)) {
      currentDecorations.push(child);
      continue;
    }

    // Real content child — finalize an item with any accumulated
    // decorations.
    pushItem({ decorations: currentDecorations, content: [child] });
    currentDecorations = [];
  }

  // Trailing decoration-only item (decorations at end of body with no
  // following content): flush it. Rustfmt tolerates a trailing doc
  // comment before a closing `}` with no blank between.
  if (currentDecorations.length > 0) {
    pushItem({ decorations: currentDecorations, content: [] });
    currentDecorations = [];
  }

  return {
    items,
    markerCounts,
    leadingMarkers,
    trailingMarkers: pendingMarkers,
    trailingInvisible: pendingInvisible,
  };
}

/**
 * Concatenate an item's decorations and content into a flat list so it
 * can be spliced into the output stream.
 */
function emitItem(item: Item, out: Children[]): void {
  for (const d of item.decorations) out.push(d);
  for (const c of item.content) out.push(c);
}

/** First real-content child of an item, used for classification. */
function itemHead(item: Item): Children | undefined {
  if (item.content.length > 0) return item.content[0];
  if (item.decorations.length > 0) return item.decorations[0];
  return undefined;
}

/** Last real-content child of an item, used for edge-break detection. */
function itemTail(item: Item): Children | undefined {
  if (item.content.length > 0) return item.content[item.content.length - 1];
  if (item.decorations.length > 0)
    return item.decorations[item.decorations.length - 1];
  return undefined;
}

function renderTopLevel(
  normalized: Children[],
  autoBlank: boolean,
  useSeam: Children | undefined,
): Children {
  const {
    items,
    markerCounts,
    leadingMarkers,
    trailingMarkers,
    trailingInvisible,
  } = groupTopLevel(normalized);

  if (items.length === 0) {
    return <>{[...leadingMarkers, ...trailingInvisible, ...trailingMarkers]}</>;
  }

  const out: Children[] = [];
  // Idiomatic blank between the source-file's `use` block and the
  // first real top-level item. `useSeam` is a `memo(...)` produced by
  // `ItemList` that resolves to `<><hbr/><hbr/></>` when the enclosing
  // module scope has imports at render time, or `undefined` otherwise.
  // The two `<hbr/>`s combine with the trailing newline the
  // `UseStatements` block leaves behind to form the blank line.
  if (useSeam !== undefined) {
    out.push(useSeam);
  }
  for (const m of leadingMarkers) out.push(m);

  for (let i = 0; i < items.length; i++) {
    if (i > 0) {
      const count = markerCounts[i - 1] ?? 0;
      const left = items[i - 1];
      const right = items[i];
      const leftTail = itemTail(left);
      const rightHead = itemHead(right);
      const edgeAlreadyBreaks =
        (leftTail !== undefined && hasTrailingBreak(leftTail)) ||
        (rightHead !== undefined && hasLeadingBreak(rightHead));

      // Classify on the real item head, ignoring any decoration
      // prelude — the semantic identity of the item is carried by its
      // real-content head, not the doc comment in front of it.
      const leftClassifier =
        left.content.length > 0 ? left.content[0] : itemHead(left);
      const rightClassifier =
        right.content.length > 0 ? right.content[0] : itemHead(right);
      const leftKind =
        leftClassifier !== undefined
          ? classifyTopLevelItem(leftClassifier)
          : "fn-like";
      const rightKind =
        rightClassifier !== undefined
          ? classifyTopLevelItem(rightClassifier)
          : "fn-like";
      const samePackable =
        leftKind === "packable" &&
        rightKind === "packable" &&
        // Only treat the pair as "same kind" when the classifier
        // recognises both sides as literally the same component —
        // otherwise e.g. a `const` adjacent to a `type` would pack,
        // which isn't what stdlib does.
        sameComponentKind(leftClassifier, rightClassifier);

      if (count >= 2) {
        for (let j = 0; j < count; j++) out.push(<hbr />);
      } else if (count === 1) {
        out.push(<hbr />);
        if (autoBlank && !samePackable && !edgeAlreadyBreaks) {
          out.push(<hbr />);
        }
      } else {
        // Two items with no authored marker between them — the grouper
        // only produces this when a decoration follows content without
        // a gap (e.g. `<Fn/><DocComment/><Fn/>`). Auto-blank fires when
        // the right item carries a decoration and the edges don't
        // already deliver the newlines.
        if (
          autoBlank &&
          right.decorations.length > 0 &&
          !samePackable &&
          !edgeAlreadyBreaks
        ) {
          out.push(<hbr />);
          out.push(<hbr />);
        }
        // else: concat (single-run spread case like `type A = {rk};`).
      }
    }
    emitItem(items[i], out);
  }

  for (const inv of trailingInvisible) out.push(inv);
  for (const m of trailingMarkers) out.push(m);
  return <>{out}</>;
}

function renderAssociated(
  normalized: Children[],
  autoBlank: boolean,
): Children {
  const {
    items,
    markerCounts,
    leadingMarkers,
    trailingMarkers,
    trailingInvisible,
  } = groupAssociated(normalized);

  if (items.length === 0) {
    return <>{[...leadingMarkers, ...trailingInvisible, ...trailingMarkers]}</>;
  }

  const out: Children[] = [];
  for (const m of leadingMarkers) out.push(m);

  for (let i = 0; i < items.length; i++) {
    if (i === 0) {
      emitItem(items[i], out);
      continue;
    }

    const left = items[i - 1];
    const right = items[i];
    const authoredCount = markerCounts[i - 1] ?? 0;
    const leftTail = itemTail(left);
    const rightHead = itemHead(right);
    const edgeAlreadyBreaks =
      (leftTail !== undefined && hasTrailingBreak(leftTail)) ||
      (rightHead !== undefined && hasLeadingBreak(rightHead));

    if (authoredCount > 0) {
      // Caller authored an explicit seam — honour it verbatim. Authored
      // gap markers between items are treated as the user's final word
      // on spacing, exactly as the top-level mode handles doubled-up
      // markers.
      for (let j = 0; j < authoredCount; j++) out.push(<hbr />);
      emitItem(right, out);
      continue;
    }

    let blank: boolean;
    if (!autoBlank) {
      blank = false;
    } else if (right.decorations.length > 0) {
      blank = true;
    } else {
      const leftClassifier = itemHead(left);
      const rightClassifier = itemHead(right);
      const leftKind =
        leftClassifier !== undefined
          ? classifyAssociatedItem(leftClassifier)
          : "fn";
      const rightKind =
        rightClassifier !== undefined
          ? classifyAssociatedItem(rightClassifier)
          : "fn";
      blank = !(leftKind === "assoc" && rightKind === "assoc");
    }

    if (edgeAlreadyBreaks) {
      // Edge break counts as one of the newlines — emit one extra hbr
      // when a blank is called for so the combined total is two
      // newlines (= blank), otherwise omit the seam altogether.
      if (blank) {
        out.push(<hbr />);
      }
    } else {
      out.push(<hbr />);
      if (blank) {
        out.push(<hbr />);
      }
    }
    emitItem(right, out);
  }

  for (const inv of trailingInvisible) out.push(inv);
  for (const m of trailingMarkers) out.push(m);

  return <>{out}</>;
}
