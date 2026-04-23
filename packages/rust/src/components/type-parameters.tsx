import type { Children } from "@alloy-js/core";
import { For } from "@alloy-js/core";

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
  children?: Children;
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
    <>
      {"<"}
      <For each={orderedParams} joiner={", "}>
        {(param) => (
          <>
            {param.lifetime ?? param.name}
            {param.constraints ? (
              <>
                {": "}
                {renderConstraints(param.constraints)}
              </>
            ) : null}
          </>
        )}
      </For>
      {">"}
    </>
  );
}

export function WhereClause(props: WhereClauseProps) {
  if (!props.children) {
    return <></>;
  }

  return (
    <>
      {"where "}
      {props.children}
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
