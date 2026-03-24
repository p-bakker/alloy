import { Block, Children, List } from "@alloy-js/core";

export interface MatchExpressionProps {
  expr: Children;
  children: Children;
}

export function MatchExpression(props: MatchExpressionProps) {
  return <>match {props.expr} <Block><List hardline>{props.children}</List></Block></>;
}

export interface MatchArmProps {
  pattern: Children;
  guard?: Children;
  children: Children;
}

export function MatchArm(props: MatchArmProps) {
  return <>
    {props.pattern}
    {props.guard ? <> if {props.guard}</> : null}
    {" => "}
    {props.children},
  </>;
}
