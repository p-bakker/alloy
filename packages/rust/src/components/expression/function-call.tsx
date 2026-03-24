import { Children, For } from "@alloy-js/core";

export interface FunctionCallProps {
  name?: Children;
  receiver?: Children;
  args?: Children[];
  turbofish?: Children;
  children?: Children;
  await?: boolean;
  /** Append `?` (try operator) after this call */
  try?: boolean;
}

export function FunctionCall(props: FunctionCallProps) {
  const argsContent = props.args ?
    <For each={props.args} joiner={<>, </>}>{(arg) => arg}</For>
    : props.children;

  return <>
    {props.receiver ? <>{props.receiver}.</> : null}
    {props.name}
    {props.turbofish ? <>::&lt;{props.turbofish}&gt;</> : null}
    ({argsContent})
    {props.await ? ".await" : null}
    {props.try ? "?" : null}
  </>;
}
