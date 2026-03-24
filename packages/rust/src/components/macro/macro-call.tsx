import { Children } from "@alloy-js/core";

export interface MacroCallProps {
  name: string;
  delimiter?: "(" | "[" | "{";
  children?: Children;
}

/**
 * A Rust macro invocation.
 *
 * Renders `name!(children)`, `name![children]`, or `name!{children}`
 * depending on the delimiter prop.
 *
 * @example
 * ```rust
 * println!("Hello, {}!", name)
 * vec![1, 2, 3]
 * lazy_static! { static ref FOO: u32 = 42; }
 * ```
 */
export function MacroCall(props: MacroCallProps) {
  const delimiter = props.delimiter ?? "(";
  const close =
    delimiter === "(" ? ")"
    : delimiter === "[" ? "]"
    : "}";

  return (
    <>
      {props.name}!{delimiter}
      {props.children}
      {close}
    </>
  );
}
