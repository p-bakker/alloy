import type { Children } from "@alloy-js/core";
import { For, Indent, Wrap } from "@alloy-js/core";

import { ArgList } from "./primitives/arg-list.js";

export interface MacroCallProps {
  name: string;
  args?: Children[];
  bracket?: "paren" | "bracket" | "brace";
}

export function MacroCall(props: MacroCallProps) {
  const bracket = props.bracket ?? "paren";
  const args = props.args ?? [];

  // Rustfmt delimiter conventions:
  //   `name!(…)` — no trailing comma on wrap.
  //   `name![…]` — trailing comma on wrap (vec!-style lists).
  //   `name! {…}` — body is passed through verbatim by default
  //                 (`format_macro_bodies`), so we keep it flat here
  //                 and match rustfmt's space-before-brace prefix.
  switch (bracket) {
    case "paren":
      return (
        <>
          {props.name}
          {"!"}
          <ArgList trailingComma={false} heuristic="attrFnLikeWidth">
            {args}
          </ArgList>
        </>
      );
    case "bracket":
      return (
        <>
          {props.name}
          {"!"}
          <ArgList open="[" close="]" heuristic="attrFnLikeWidth">
            {args}
          </ArgList>
        </>
      );
    case "brace":
      return (
        <>
          {props.name}
          {"! "}
          {"{"}
          {args.map((arg, i) => (
            <>
              {i > 0 ? ", " : null}
              {arg}
            </>
          ))}
          {"}"}
        </>
      );
  }
}
