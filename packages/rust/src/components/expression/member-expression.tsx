import {
  Children,
  computed,
  createAccessExpression,
  For,
  OutputSymbol,
  Refkeyable,
} from "@alloy-js/core";

export interface MemberExpressionPartProps {
  /** The identifier for this part (member name, variable, "self", etc.) */
  id?: Children;
  /** A refkey to resolve to a symbol name */
  refkey?: Refkeyable;
  /** A symbol whose name becomes the identifier */
  symbol?: OutputSymbol;
  /** Arguments -- presence makes this a function/method call. Use `[]` for no-arg calls. */
  args?: Children[];
  /** Turbofish type parameter: renders `::<Type>` before the call parens */
  turbofish?: Children;
  /** Append `.await` after this part */
  await?: boolean;
  /** Append `?` (try operator) after this part */
  try?: boolean;
  /** Arbitrary children content for the identifier */
  children?: Children;
}

interface PartDescriptor {
  id: Children;
  args?: Children[];
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
      const args = computed(() => part.args ?? []);
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
 * Composes member access and method calls in a flat, readable syntax
 * without deeply nested JSX. Built on the core `createAccessExpression` factory.
 *
 * @example
 * ```tsx
 * // self.name.chars().collect()
 * <MemberExpression>
 *   <MemberExpression.Part id="self" />
 *   <MemberExpression.Part id="name" />
 *   <MemberExpression.Part id="chars" args={[]} />
 *   <MemberExpression.Part id="collect" args={[]} />
 * </MemberExpression>
 *
 * // input.trim().parse::<i32>().map_err(|e| e.to_string())
 * <MemberExpression>
 *   <MemberExpression.Part id="input" />
 *   <MemberExpression.Part id="trim" args={[]} />
 *   <MemberExpression.Part id="parse" args={[]} turbofish="i32" />
 *   <MemberExpression.Part id="map_err" args={[...]} />
 * </MemberExpression>
 * ```
 */
export function MemberExpression(props: { children: Children }): Children {
  return Expression(props);
}

MemberExpression.Part = Part;
registerOuterComponent(MemberExpression);
