import {
  Children,
  childrenArray,
  computed,
  For,
  isComponentCreator,
} from "@alloy-js/core";
import { ArgList } from "./primitives/arg-list.js";
import { RustChain } from "./primitives/rust-chain.js";

export interface MethodChainExpressionProps {
  receiver: Children;
  children: Children;
}

export interface MethodChainCallProps {
  name: string;
  args?: Children[];
  typeArgs?: Children[];
  await?: boolean;
  try?: boolean;
}

export function MethodChainCall(_props: MethodChainCallProps): Children {
  // No-op — props are consumed by the parent MethodChainExpression.
  return null;
}

function renderSegment(call: MethodChainCallProps): Children {
  const typeArgs = call.typeArgs ?? [];
  const args = call.args ?? [];
  return (
    <>
      {call.name}
      {typeArgs.length > 0 ?
        <group>
          {"::<"}
          <For each={typeArgs} joiner={<>, <softline /></>}>
            {(typeArg) => typeArg}
          </For>
          {">"}
        </group>
      : null}
      <ArgList>{args}</ArgList>
      {call.await ? ".await" : ""}
      {call.try ? "?" : ""}
    </>
  );
}

export function MethodChainExpression(
  props: MethodChainExpressionProps,
): Children {
  return computed(() => {
    const tail: Children[] = [];
    for (const child of childrenArray(() => props.children)) {
      if (isComponentCreator(child, MethodChainCall)) {
        const callProps = child.props as MethodChainCallProps;
        if (!callProps.name) {
          throw new Error(
            "MethodChainExpression.Call requires a method name for each chain step.",
          );
        }
        tail.push(renderSegment(callProps));
      }
    }
    return <RustChain head={props.receiver} tail={tail} />;
  });
}

MethodChainExpression.Call = MethodChainCall;
