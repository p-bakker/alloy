import { Block, Children, For } from "@alloy-js/core";
import { StatementList } from "../StatementList.js";

export interface ClosureParam {
  name: string;
  type?: Children;
}

export interface ClosureExpressionProps {
  params?: ClosureParam[];
  returns?: Children;
  move?: boolean;
  async?: boolean;
  children: Children;
}

export function ClosureExpression(props: ClosureExpressionProps) {
  const paramsContent = props.params ?
    <For each={props.params} joiner={<>, </>}>
      {(param) => param.type ? <>{param.name}: {param.type}</> : param.name}
    </For>
    : null;

  return <>
    {props.async ? "async " : null}
    {props.move ? "move " : null}
    |{paramsContent}|
    {props.returns ? <> -&gt; {props.returns}</> : null}
    {props.returns ? <> <Block inline><StatementList>{props.children}</StatementList></Block></> : <> {props.children}</>}
  </>;
}
