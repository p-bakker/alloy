import type { Children } from "@alloy-js/core";
import { For, Indent } from "@alloy-js/core";

export interface FieldListProps {
  /** The list items — one per field between the braces. */
  children?: Children | Children[];
}

/**
 * Always-broken brace-delimited list for record-struct fields.
 *
 * Each entry renders on its own block-indented line with the closing
 * brace on its own line at the outer indent. A trailing comma is
 * emitted after the final field via `<ifBreak>`, so the comma is a
 * function of the forced break rather than a literal appended by the
 * field emitter.
 *
 * Record-struct declarations have no flat form — rustfmt always
 * breaks them one field per line — so this primitive forces the
 * group to break via `shouldBreak`, making the softline joiners and
 * the `<ifBreak>` trailing comma fire unconditionally.
 *
 * Empty lists render as a flat `{}` with no potential break.
 */
export function FieldList(props: FieldListProps) {
  const items = Array.isArray(props.children)
    ? props.children
    : props.children !== undefined
      ? [props.children]
      : [];

  if (items.length === 0) {
    return <>{"{}"}</>;
  }

  return (
    <group shouldBreak>
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
        <ifBreak>,</ifBreak>
      </Indent>
      {"}"}
    </group>
  );
}
