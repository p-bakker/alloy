import { Children } from "@alloy-js/core";

export interface BinaryExpressionProps {
  left: Children;
  op: string;
  right: Children;
}

/**
 * A Rust binary expression (e.g., `a >= b`, `x + y`, `a && b`).
 */
export function BinaryExpression(props: BinaryExpressionProps) {
  return <>{props.left} {props.op} {props.right}</>;
}
