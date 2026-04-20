import type { Children } from "@alloy-js/core";
import { For, Indent } from "@alloy-js/core";

export interface BracedListProps {
  /** The list items — one per entry between the braces. */
  children?: Children | Children[];
  /** Emit a trailing comma when the list breaks. Default `true`. */
  trailingComma?: boolean;
}

/**
 * Comma-separated brace-delimited list with fit-or-break layout.
 *
 * Flat: `{item1, item2, …}` with tight delimiters (no inner
 * padding). Broken: each item on its own block-indented line
 * with the closing brace on its own line at the outer indent. When
 * broken, a trailing comma is emitted iff `trailingComma` is true
 * (default).
 *
 * Used for brace-delimited lists such as `use a::{…}` import bodies,
 * struct-literal bodies, and (future) generic bracket substitutes.
 * Callers whose brace form forbids a trailing comma should pass
 * `trailingComma={false}`.
 *
 * Empty lists render as a flat `{}` with no potential break.
 */
export function BracedList(props: BracedListProps) {
  const items = Array.isArray(props.children)
    ? props.children
    : props.children !== undefined
      ? [props.children]
      : [];
  const trailingComma = props.trailingComma ?? true;

  if (items.length === 0) {
    return <>{"{}"}</>;
  }

  return (
    <group>
      {"{"}
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
      {"}"}
    </group>
  );
}
