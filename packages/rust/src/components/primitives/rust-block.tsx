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
  /**
   * When `true`, the block renders as a fit-or-break shape inside whatever
   * `<group>` the caller wraps around it: the flat form is `{ body }` with
   * single spaces inside the braces, and the broken form is the usual
   * `{\n    body\n}`. Any hardline inside `children` still forces the
   * broken form via `breakParent` propagation. Default `false` — always
   * multi-line, preserving the legacy behaviour for function bodies,
   * `for`/`while`/`loop`, match arms, and other callers.
   *
   * The caller is expected to wrap the returned tree in an outer
   * `<group max={…}>` to bound the fit decision by a heuristic; without
   * such a group the ambient print width governs the break.
   *
   * Empty bodies render as flat `{}` regardless of `inline`.
   */
  inline?: boolean;
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
 * interior break). Otherwise, the default (`inline` unset / `false`) emits:
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
 *
 * When `inline` is `true`, the block instead renders as a fit-or-break pair
 * — flat `{ body }`, broken `{\n    body\n}` — suitable for callers that
 * want to keep short single-expression bodies on one line under a heuristic
 * group (`IfExpression`'s flat-if-else form).
 */
export function RustBlock(props: RustBlockProps) {
  const items = normalizeChildren(props.children);
  const leadingSpace = props.leadingSpace ?? true;
  const inline = props.inline ?? false;

  if (items.length === 0) {
    return <>{leadingSpace ? " {}" : "{}"}</>;
  }

  if (inline) {
    return (
      <>
        {leadingSpace ? " {" : "{"}
        <ifBreak flatContents=" ">{null}</ifBreak>
        <Indent softline trailingBreak>
          <For each={items} joiner={<hbr />}>
            {(item) => item}
          </For>
        </Indent>
        <ifBreak flatContents=" ">{null}</ifBreak>
        {"}"}
      </>
    );
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
