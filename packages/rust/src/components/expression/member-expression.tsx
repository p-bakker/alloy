import {
  Children,
  computed,
  createAccessExpression,
  For,
  OutputSymbol,
  Refkeyable,
} from "@alloy-js/core";

export interface MemberExpressionPropertyProps {
  /** The identifier for this part (member name, variable, "self", etc.) */
  id?: Children;
  /** A refkey to resolve to a symbol name */
  refkey?: Refkeyable;
  /** A symbol whose name becomes the identifier */
  symbol?: OutputSymbol;
  /** Append `?` (try operator) after this part */
  try?: boolean;
  /** Arbitrary children content for the identifier */
  children?: Children;
}

export interface MemberExpressionMethodProps extends MemberExpressionPropertyProps {
  /** Arguments to the method call. Use `args` (bare) for no-arg calls, or `args={[a, b]}` with arguments. */
  args?: Children[] | true;
  /** Turbofish type parameter: renders `::<Type>` before the call parens */
  turbofish?: Children;
  /** Append `.await` after this method call */
  await?: boolean;
}

// Internal union used by createAccessExpression
type MemberExpressionPartProps = MemberExpressionPropertyProps & MemberExpressionMethodProps;

interface PartDescriptor {
  id: Children;
  args?: Children[] | true;
  turbofish?: Children;
  await?: boolean;
  try?: boolean;
  [key: string]: unknown;
}

const { Expression, Part, registerOuterComponent } = createAccessExpression<
  MemberExpressionPartProps,
  PartDescriptor
>({
  createDescriptor(partProps, sym, first) {
    let id: Children;
    if (partProps.children !== undefined) {
      id = partProps.children;
    } else if (first && partProps.refkey) {
      id = partProps.refkey;
    } else if (partProps.id !== undefined) {
      id = partProps.id;
    } else if (sym) {
      id = sym.name;
    } else {
      id = "<unresolved symbol>";
    }

    return {
      id,
      args: partProps.args,
      turbofish: partProps.turbofish,
      await: partProps.await,
      try: partProps.try,
    };
  },

  getBase(part) {
    return part.id;
  },

  formatPart(part, _prevPart, _inCallChain) {
    if (part.args !== undefined) {
      // Method call: .name::<T>(args) or .name(args)
      const args = computed(() => part.args === true ? [] : (part.args ?? []));
      return <>
        .{part.id}
        {part.turbofish ? <>::&lt;{part.turbofish}&gt;</> : null}
        (<For each={args} joiner={<>, </>}>{(arg) => arg}</For>)
        {part.await ? ".await" : null}
        {part.try ? "?" : null}
      </>;
    }
    // Member access: .name
    return <>
      .{part.id}
      {part.await ? ".await" : null}
      {part.try ? "?" : null}
    </>;
  },

  isCallPart(part) {
    return part.args !== undefined;
  },
});

/**
 * A Rust member expression / method chain.
 *
 * Uses `.Property` for field/property access and `.Method` for method calls.
 * Method calls always render `()` — use `args` only when there are arguments.
 *
 * @example
 * ```tsx
 * // self.name.chars().collect()
 * <MemberExpression>
 *   <MemberExpression.Property id="self" />
 *   <MemberExpression.Property id="name" />
 *   <MemberExpression.Method id="chars" />
 *   <MemberExpression.Method id="collect" />
 * </MemberExpression>
 *
 * // input.trim().parse::<i32>().map_err(|e| e.to_string())
 * <MemberExpression>
 *   <MemberExpression.Property id="input" />
 *   <MemberExpression.Method id="trim" />
 *   <MemberExpression.Method id="parse" turbofish="i32" />
 *   <MemberExpression.Method id="map_err" args={[...]} />
 * </MemberExpression>
 * ```
 */
export function MemberExpression(props: { children: Children }): Children {
  return Expression(props);
}

// Both Property and Method are Part at runtime (so createAccessExpression
// recognizes them via isComponentCreator). TypeScript types restrict which
// props are available on each.
MemberExpression.Property = Part as unknown as (props: MemberExpressionPropertyProps) => void;
MemberExpression.Method = Part as unknown as (props: MemberExpressionMethodProps) => void;
registerOuterComponent(MemberExpression);
