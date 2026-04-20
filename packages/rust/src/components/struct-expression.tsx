import type { Children } from "@alloy-js/core";

import { BracedList } from "./primitives/braced-list.js";

export interface StructExpressionProps {
  type: Children;
  spread?: Children;
  children?: Children;
}

export interface FieldInitProps {
  name: string;
  children?: Children;
}

export function StructExpression(props: StructExpressionProps) {
  const fields = props.children
    ? (Array.isArray(props.children)
        ? props.children
        : [props.children]
      ).filter(
        (child) => !(typeof child === "string" && child.trim().length === 0),
      )
    : [];

  const entries: Children[] = [...fields];
  if (props.spread) {
    entries.push(
      <>
        {".."}
        {props.spread}
      </>,
    );
  }

  return (
    <>
      {props.type}{" "}
      <BracedList pad trailingComma={!props.spread} heuristic="structLitWidth">
        {entries}
      </BracedList>
    </>
  );
}

export function FieldInit(props: FieldInitProps) {
  return (
    <>
      {props.name}
      {typeof props.children === "undefined" ? null : ": "}
      {props.children}
    </>
  );
}
