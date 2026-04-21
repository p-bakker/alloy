import type { Children } from "@alloy-js/core";
import { For, Indent } from "@alloy-js/core";

import { useResolvedHeuristics } from "../../context/resolved-heuristics.js";

export type BracedListHeuristic = "structLitWidth" | "structVariantWidth";

export interface BracedListProps {
  /** The list items — one per entry between the braces. */
  children?: Children | Children[];
  /** Emit a trailing comma when the list breaks. Default `true`. */
  trailingComma?: boolean;
  /**
   * Pad the flat form with a single space inside each brace —
   * `{ a, b }` rather than `{a, b}`. Empty lists never pad; they
   * always render as `{}`. Default `false`.
   */
  pad?: boolean;
  /**
   * Name of the rustfmt width heuristic that governs this list. When
   * set, the resolved heuristic is passed as `max` to the inner
   * `<group>` so that lists whose flat form fits within the heuristic
   * stay flat, and lists that exceed it break even if the ambient
   * line has room.
   *
   * Pass `"structLitWidth"` for struct literals and
   * `"structVariantWidth"` for enum struct variants. Leave unset for
   * primitives governed only by the overall print width (`use a::{…}`
   * bodies).
   */
  heuristic?: BracedListHeuristic;
  /**
   * When provided, the predicate is invoked for each item. If any item
   * returns true, the list is forced to break regardless of whether its
   * flat form fits the heuristic or the ambient print width.
   *
   * Intended for rules that require multi-line layout for structural
   * reasons (e.g. a nested brace list inside a `use` statement: rustfmt
   * forces the enclosing list to break even when it would fit).
   */
  forceBreakIf?: (child: Children) => boolean;
}

/**
 * Comma-separated brace-delimited list with fit-or-break layout.
 *
 * Flat: `{item1, item2, …}` (or `{ item1, item2, … }` when `pad` is
 * set). Broken: each item on its own block-indented line with the
 * closing brace on its own line at the outer indent. When broken, a
 * trailing comma is emitted iff `trailingComma` is true (default).
 *
 * Used for brace-delimited lists such as `use a::{…}` import bodies,
 * struct-literal bodies, and (future) generic bracket substitutes.
 * Callers whose brace form forbids a trailing comma should pass
 * `trailingComma={false}`. Callers whose flat form wants inner
 * padding (struct literals) should pass `pad={true}`.
 *
 * Empty lists render as a flat `{}` with no potential break.
 */
export function BracedList(props: BracedListProps) {
  const items = Array.isArray(props.children)
    ? props.children
    : props.children !== undefined
      ? [props.children]
      : [];
  const trailingComma = props.trailingComma ?? true;
  const pad = props.pad ?? false;
  const heuristics = useResolvedHeuristics();
  const max =
    props.heuristic !== undefined ? heuristics[props.heuristic] : undefined;
  const forceBreak =
    props.forceBreakIf !== undefined && items.some(props.forceBreakIf);

  if (items.length === 0) {
    return <>{"{}"}</>;
  }

  const opener = pad ? (
    <>
      {"{"}
      <ifBreak flatContents=" ">{null}</ifBreak>
    </>
  ) : (
    "{"
  );
  const closer = pad ? (
    <>
      <ifBreak flatContents=" ">{null}</ifBreak>
      {"}"}
    </>
  ) : (
    "}"
  );

  return (
    <group max={max}>
      {forceBreak ? <breakParent /> : null}
      {opener}
      <Indent softline trailingBreak>
        <For
          each={items}
          joiner={
            <>
              , <softline />
            </>
          }
        >
          {(item) => item}
        </For>
        {trailingComma ? <ifBreak>,</ifBreak> : null}
      </Indent>
      {closer}
    </group>
  );
}
