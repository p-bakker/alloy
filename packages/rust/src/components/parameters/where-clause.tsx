import { Children, For, Indent } from "@alloy-js/core";

export interface WhereClauseConstraint {
  type: Children;
  bounds: Children;
}

export interface WhereClauseProps {
  constraints: WhereClauseConstraint[];
}

/**
 * A Rust where clause for complex generic bounds.
 * @example
 * ```tsx
 * <WhereClause constraints={[
 *   { type: "T", bounds: "Display + Debug" },
 *   { type: "U", bounds: "Clone" },
 * ]} />
 * ```
 * Produces:
 * ```rust
 * where
 *     T: Display + Debug,
 *     U: Clone,
 * ```
 */
export function WhereClause(props: WhereClauseProps) {
  if (!props.constraints || props.constraints.length === 0) {
    return null;
  }

  return (
    <>
      <hbr />
      where
      <Indent hardline>
        <For
          each={props.constraints}
          joiner={<>,<hbr /></>}
          ender={<>,</>}
        >
          {(constraint) => (
            <>
              {constraint.type}: {constraint.bounds}
            </>
          )}
        </For>
      </Indent>
    </>
  );
}
