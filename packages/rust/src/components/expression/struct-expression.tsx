import { Block, Children } from "@alloy-js/core";

export interface StructExpressionProps {
  type: Children;
  children?: Children;
}

export function StructExpression(props: StructExpressionProps) {
  return <>{props.type} <Block>{props.children}</Block></>;
}

export interface StructFieldExpressionProps {
  name: Children;
  children?: Children;
}

export function StructFieldExpression(props: StructFieldExpressionProps) {
  if (props.children) {
    return <>{props.name}: {props.children},</>;
  }
  return <>{props.name},</>;
}
