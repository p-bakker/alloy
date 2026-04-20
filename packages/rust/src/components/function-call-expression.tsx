import type { Children } from "@alloy-js/core";
import { For } from "@alloy-js/core";

import { ArgList } from "./primitives/arg-list.js";

export interface FunctionCallExpressionProps {
  target: Children;
  args?: Children[];
  typeArgs?: Children[];
}

export function FunctionCallExpression(props: FunctionCallExpressionProps) {
  return (
    <group>
      {props.target}
      {props.typeArgs && props.typeArgs.length > 0 ? (
        <group>
          {"::<"}
          <For
            each={props.typeArgs}
            joiner={
              <>
                , <softline />
              </>
            }
          >
            {(typeArg) => typeArg}
          </For>
          {">"}
        </group>
      ) : null}
      <ArgList>{props.args ?? []}</ArgList>
    </group>
  );
}
