import { Children, For } from "@alloy-js/core";

export interface RustChainProps {
  /** The first segment of the chain — the receiver / base. */
  head: Children;
  /**
   * Remaining segments, each rendered as `.<segment>` in source order.
   * Pass each tail segment as its rendered content (method name +
   * turbofish + arg list, or a bare field identifier). The primitive
   * prepends the `.` and inserts the per-segment softline break
   * itself, so callers must not duplicate either.
   *
   * Segments that terminate in `?` (try) or `.await` must embed that
   * suffix inside the segment itself, so the suffix rides on the same
   * indented line as the call it belongs to.
   */
  tail?: Children[];
}

/**
 * Method-chain layout.
 *
 * Flat form: `head.tail0.tail1…` with no breaks. Broken form: `head`
 * on the base line, each `.tailN` on its own block-indented line with
 * the dot at the start of the new line. The surrounding `<group>`
 * makes the flat-or-broken choice against the ambient print width.
 */
export function RustChain(props: RustChainProps) {
  const tail = props.tail ?? [];
  if (tail.length === 0) {
    return <>{props.head}</>;
  }

  return (
    <group>
      {props.head}
      <indent>
        <For each={tail} joiner="">
          {(segment) => (
            <>
              <softline />
              {"."}
              {segment}
            </>
          )}
        </For>
      </indent>
    </group>
  );
}
