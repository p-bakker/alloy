import { Block, Children } from "@alloy-js/core";
import { StatementList } from "../StatementList.js";

export interface IfExpressionProps {
  condition: Children;
  children: Children;
  else?: Children;
}

export function IfExpression(props: IfExpressionProps) {
  return <>
    if {props.condition} <Block inline><StatementList>{props.children}</StatementList></Block>
    {props.else ? <> else <Block inline><StatementList>{props.else}</StatementList></Block></> : null}
  </>;
}

export interface IfLetExpressionProps {
  pattern: Children;
  expr: Children;
  children: Children;
  else?: Children;
}

export function IfLetExpression(props: IfLetExpressionProps) {
  return <>
    if let {props.pattern} = {props.expr} <Block inline><StatementList>{props.children}</StatementList></Block>
    {props.else ? <> else <Block inline><StatementList>{props.else}</StatementList></Block></> : null}
  </>;
}
