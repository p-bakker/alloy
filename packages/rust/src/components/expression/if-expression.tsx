import { Children, Indent } from "@alloy-js/core";
import { StatementList } from "../StatementList.js";

export interface IfExpressionProps {
  condition: Children;
  children: Children;
  else?: Children;
}

function InlineBlock(props: { children: Children }) {
  return <>
    {"{"}
    <Indent line trailingBreak>
      <StatementList>{props.children}</StatementList>
    </Indent>
    {"}"}
  </>;
}

export function IfExpression(props: IfExpressionProps) {
  return <group>
    if {props.condition} <InlineBlock>{props.children}</InlineBlock>
    {props.else ? <> else <InlineBlock>{props.else}</InlineBlock></> : null}
  </group>;
}

export interface IfLetExpressionProps {
  pattern: Children;
  expr: Children;
  children: Children;
  else?: Children;
}

export function IfLetExpression(props: IfLetExpressionProps) {
  return <group>
    if let {props.pattern} = {props.expr} <InlineBlock>{props.children}</InlineBlock>
    {props.else ? <> else <InlineBlock>{props.else}</InlineBlock></> : null}
  </group>;
}
