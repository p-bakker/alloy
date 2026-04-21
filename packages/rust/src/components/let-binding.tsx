import type { Children } from "@alloy-js/core";

import { useResolvedHeuristics } from "../context/resolved-heuristics.js";
import { RustBlock } from "./primitives/rust-block.js";

export interface LetBindingProps {
  name: string;
  mutable?: boolean;
  type?: Children;
  children?: Children;
  /**
   * Optional `else { … }` body turning this into a `let … else` binding.
   *
   * When present, the construct renders as `let <pat> = <rhs> else { <body> };`
   * on a single line when the flat form fits `singleLineLetElseMaxWidth`
   * and the ambient column budget; otherwise the `else` body breaks and
   * the closing `};` sits on its own line at outer indent.
   *
   * Callers should pass a single expression as the else body;
   * multi-statement and comment-carrying bodies are out of scope for
   * this component today.
   */
  elseBody?: Children;
}

export function LetBinding(props: LetBindingProps) {
  const mut = props.mutable ? "mut " : "";
  const typed =
    props.type !== undefined ? (
      <>
        {": "}
        {props.type}
      </>
    ) : null;

  if (props.children === undefined) {
    return (
      <>
        {"let "}
        {mut}
        {props.name}
        {typed}
        {";"}
      </>
    );
  }

  if (props.elseBody !== undefined) {
    const { singleLineLetElseMaxWidth } = useResolvedHeuristics();

    // Whole `let <pat> = <rhs> else { <body> };` form. A single
    // heuristic-bounded group decides flat vs. broken; the `RustBlock
    // inline` primitive handles the `{ body }` / `{\n    body\n}`
    // alternation for the else body. Stable rustfmt applies this
    // heuristic uniformly across all supported editions — unlike the
    // sibling `single_line_if_else_max_width` rule, so no edition gate.
    return (
      <group max={singleLineLetElseMaxWidth}>
        {"let "}
        {mut}
        {props.name}
        {typed}
        {" = "}
        {props.children}
        {" else"}
        <RustBlock inline>{props.elseBody}</RustBlock>
        {";"}
      </group>
    );
  }

  const gid = Symbol("let-assignment");

  return (
    <group>
      {"let "}
      {mut}
      {props.name}
      {typed}
      {" ="}
      <group id={gid}>
        <indent>
          <line />
        </indent>
      </group>
      <lineSuffixBoundary />
      <indentIfBreak groupId={gid}>{props.children}</indentIfBreak>
      {";"}
    </group>
  );
}
