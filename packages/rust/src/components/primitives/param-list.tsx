import type { Children } from "@alloy-js/core";

import { useRustFormatOptions } from "../../context/format-options.js";
import { ArgList } from "./arg-list.js";

export interface ParamListProps {
  /**
   * The parameter entries — one per function parameter. When a method
   * receiver is present (`&self`, `&mut self`, `self`, …), it is the
   * first entry; regular parameters follow.
   */
  children?: Children | Children[];
}

/**
 * Paren-delimited parameter list for function signatures with
 * fit-or-break layout.
 *
 * Flat: `(p1, p2, …)`. Broken: each parameter on its own indented line
 * with a trailing comma and the closing paren on its own line at the
 * outer indent. The primitive owns the surrounding `(` / `)` so callers
 * must not glue them on by hand.
 *
 * Callers are responsible for formatting each entry (including any
 * receiver) before handing it over. `ParamList` does not distinguish
 * the receiver from the rest of the list because the layout is
 * identical.
 *
 * Reads `fnParamsLayout` from the Rust format-options context: `"Tall"`
 * (default) preserves the fit-or-break layout; `"Vertical"` forces the
 * broken form even when the flat form would fit.
 */
export function ParamList(props: ParamListProps) {
  const { fnParamsLayout } = useRustFormatOptions();
  const forceBreak = fnParamsLayout === "Vertical";
  return <ArgList forceBreak={forceBreak}>{props.children}</ArgList>;
}
