import { Children } from "@alloy-js/core";

export interface AssignmentStatementProps {
  target: Children;
  /** Defaults to `=`. Use `+=`, `-=`, `*=`, etc. for compound assignment. */
  op?: string;
  children: Children;
}

/**
 * A Rust assignment statement (e.g., `x = 1;`, `count += 1;`).
 */
export function AssignmentStatement(props: AssignmentStatementProps) {
  return <>{props.target} {props.op ?? "="} {props.children};</>;
}
