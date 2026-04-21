import type { Children } from "@alloy-js/core";
import { For, Indent } from "@alloy-js/core";

import { ArgList } from "./primitives/arg-list.js";

export interface TypeParameterProp {
  name?: string;
  lifetime?: string;
  /**
   * Trait bounds for this parameter. A single `Children` value renders
   * as-is; an array is auto-joined with ` + `.
   */
  constraints?: Children | Children[];
}

export interface TypeParametersProps {
  params?: TypeParameterProp[];
}

export interface WhereClauseProps {
  /**
   * The bounds of the where clause. A single `Children` value is treated as
   * one bound; an array is treated as one bound per element. Each bound is
   * rendered on its own block-indented line. When empty / undefined, the
   * component renders nothing — including no leading break — so callers
   * can drop it in unconditionally alongside the item's signature.
   */
  children?: Children | Children[];

  /**
   * Whether to emit a trailing comma after the last bound. Defaults to
   * `true`, which is correct whenever a body (`{ … }`) follows the where
   * clause. Set to `false` for forward-declaration items that terminate
   * with `;` (e.g. trait method signatures, tuple-struct declarations).
   */
  trailingComma?: boolean;
}

export function TypeParameters(props: TypeParametersProps) {
  if (!props.params || props.params.length === 0) {
    return <></>;
  }

  const lifetimes: TypeParameterProp[] = [];
  const typeParameters: TypeParameterProp[] = [];

  for (const param of props.params) {
    if (param.lifetime) {
      lifetimes.push(param);
      continue;
    }

    if (param.name) {
      typeParameters.push(param);
      continue;
    }

    throw new Error(
      "TypeParameters entries must include either `lifetime` or `name`.",
    );
  }

  const orderedParams = [...lifetimes, ...typeParameters];

  return (
    <ArgList open="<" close=">">
      {orderedParams.map((param) => (
        <>
          {param.lifetime ?? param.name}
          {param.constraints ? (
            <>
              {": "}
              {renderConstraints(param.constraints)}
            </>
          ) : null}
        </>
      ))}
    </ArgList>
  );
}

/**
 * Returns `true` when the given `whereClause` children would emit at least one
 * bound. Used by item callers (`fn`, `impl`, `trait`) to decide whether the
 * body `{` must move to its own line — rustfmt requires the opening brace on
 * its own line whenever a where clause is present.
 */
export function hasWhereClauseBounds(
  children: Children | Children[] | undefined,
): boolean {
  return normaliseBounds(children).length > 0;
}

export function WhereClause(props: WhereClauseProps) {
  const bounds = normaliseBounds(props.children);
  if (bounds.length === 0) {
    return <></>;
  }

  const trailingComma = props.trailingComma ?? true;
  const lastIndex = bounds.length - 1;

  return (
    <>
      <hbr />
      {"where"}
      <Indent hardline>
        <For each={bounds} joiner={<hbr />}>
          {(bound, index) => (
            <>
              {bound}
              {index === lastIndex && !trailingComma ? "" : ","}
            </>
          )}
        </For>
      </Indent>
    </>
  );
}

export function renderConstraints(
  constraints: Children | Children[],
): Children {
  if (!Array.isArray(constraints)) return constraints;
  const bounds = constraints.filter(
    (b) => b !== null && b !== undefined && b !== false,
  );
  if (bounds.length === 0) return null;
  return (
    <For each={bounds} joiner={" + "}>
      {(bound) => bound}
    </For>
  );
}

function normaliseBounds(
  children: Children | Children[] | undefined,
): Children[] {
  if (children === undefined || children === null || children === false) {
    return [];
  }
  if (Array.isArray(children)) {
    return children.filter((bound) => bound !== null && bound !== undefined);
  }
  return [children];
}
