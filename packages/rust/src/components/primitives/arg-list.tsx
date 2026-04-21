import type { Children } from "@alloy-js/core";
import { For, Indent } from "@alloy-js/core";

import { useResolvedHeuristics } from "../../context/resolved-heuristics.js";
export type ArgListHeuristic = "fnCallWidth" | "attrFnLikeWidth";

export interface ArgListProps {
  /** The list items — one per argument. */
  children?: Children | Children[];
  /** Opening delimiter. Default `"("`. */
  open?: string;
  /** Closing delimiter. Default `")"`. */
  close?: string;
  /** Emit a trailing comma when the list breaks. Default `true`. */
  trailingComma?: boolean;
  /**
   * Name of the rustfmt width heuristic that governs this list. When set,
   * the resolved heuristic is passed as `max` to the inner `<group>` so
   * that lists whose flat form fits within the heuristic stay flat, and
   * lists that exceed it break even if the ambient line has room.
   *
   * Pass `"fnCallWidth"` for function-call arg lists and `"attrFnLikeWidth"`
   * for attribute / macro-call arg lists. Leave unset for primitives that
   * are governed only by the overall print width (tuples, derives, etc).
   */
  heuristic?: ArgListHeuristic;
}

/**
 * Comma-separated list with fit-or-break layout.
 *
 * Flat: `open item1, item2, … close`. Broken: each item on its own
 * indented line with the closing delimiter on its own line at the
 * outer indent. When broken, a trailing comma is emitted iff
 * `trailingComma` is true (default).
 *
 * The `open`/`close` delimiters are parameterised so callers can
 * reuse this primitive for argument lists (`(…)`), array literals
 * (`[…]`), generic brackets (`<…>`), and closure parameter lists
 * (`|…|`). Callers whose list form disallows a trailing comma (tuple
 * n≠1, function types, generic brackets) set `trailingComma={false}`.
 */
export function ArgList(props: ArgListProps) {
  const items = Array.isArray(props.children)
    ? props.children
    : props.children !== undefined
      ? [props.children]
      : [];
  const open = props.open ?? "(";
  const close = props.close ?? ")";
  const trailingComma = props.trailingComma ?? true;
  const heuristics = useResolvedHeuristics();
  const max =
    props.heuristic !== undefined ? heuristics[props.heuristic] : undefined;

  if (items.length === 0) {
    return (
      <>
        {open}
        {close}
      </>
    );
  }

  return (
    <group max={max}>
      {open}
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
      {close}
    </group>
  );
}
