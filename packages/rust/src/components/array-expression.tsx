import type { Children } from "@alloy-js/core";

import { ArgList } from "./primitives/arg-list.js";

export interface ArrayExpressionProps {
  /** Array elements. Each child becomes one list entry. */
  children?: Children;
}

/**
 * Rust array literal: `[a, b, c]`. Fit-or-break layout governed by
 * rustfmt's `array_width` heuristic (default 60 cols). A flat array
 * wider than `array_width` breaks to one element per line with a
 * trailing comma; an array narrower than `array_width` locks flat so
 * the surrounding printer cannot split it.
 *
 * `shortArrayElementWidthThreshold` (default 10 cols) is reserved for a
 * future packing pass that allows multiple short elements per line when
 * the array must break. This component does not implement packing;
 * broken arrays emit one element per line.
 */
export function ArrayExpression(props: ArrayExpressionProps) {
  const items =
    props.children === undefined
      ? []
      : Array.isArray(props.children)
        ? props.children
        : [props.children];

  const filtered = items.filter(
    (child) => !(typeof child === "string" && child.trim().length === 0),
  );

  return (
    <ArgList open="[" close="]" heuristic="arrayWidth">
      {filtered}
    </ArgList>
  );
}
