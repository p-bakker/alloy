import type { Children } from "@alloy-js/core";
import { For, Indent } from "@alloy-js/core";

export interface RustBlockProps {
  /**
   * The block body. Each non-empty child is treated as a statement and is
   * separated from its siblings with a hardline (`hbr`).
   */
  children?: Children;
  /**
   * Emit a leading space before the opening brace. Default `true`. Produces
   * the idiomatic `fn f() {` / `if cond {` / `for x in y {` form. Set to
   * `false` for callers like `BlockExpression` whose outer context supplies
   * (or omits) the space itself.
   */
  leadingSpace?: boolean;
}

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
    if (child === undefined || child === null) {
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

/**
 * Braced block body for Rust control-flow constructs (`if`, `for`, `while`,
 * `loop`, `unsafe`, bare block expressions, etc).
 *
 * When the normalised children are empty, emits `{}` on the same line (no
 * interior break). Otherwise emits:
 *
 * ```text
 *  {
 *     child1
 *     child2
 * }
 * ```
 *
 * Statements are hardline-separated; the closing brace sits on its own line
 * at the outer indent.
 */
export function RustBlock(props: RustBlockProps) {
  const items = normalizeChildren(props.children);
  const leadingSpace = props.leadingSpace ?? true;

  if (items.length === 0) {
    return <>{leadingSpace ? " {}" : "{}"}</>;
  }

  return (
    <>
      {leadingSpace ? " {" : "{"}
      <Indent>
        <For each={items} joiner={<hbr />}>
          {(item) => item}
        </For>
      </Indent>
      <hbr />
      {"}"}
    </>
  );
}
