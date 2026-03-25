import { Block, Children } from "@alloy-js/core";

export interface IfExpressionProps {
  condition: Children;
  children: Children;
  else?: Children;
}

export function IfExpression(props: IfExpressionProps) {
  return <>
    if {props.condition} <Block inline>{props.children}</Block>
    {props.else ? <> else <Block inline>{props.else}</Block></> : null}
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
    if let {props.pattern} = {props.expr} <Block inline>{props.children}</Block>
    {props.else ? <> else <Block inline>{props.else}</Block></> : null}
  </>;
}
