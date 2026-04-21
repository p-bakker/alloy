import type { Children } from "@alloy-js/core";
import { isComponentCreator } from "@alloy-js/core";

import { RustBlock } from "./primitives/rust-block.js";

export interface IfExpressionProps {
  condition: Children;
  children?: Children;
}

export interface ElseIfClauseProps {
  condition: Children;
  children?: Children;
}

export interface ElseClauseProps {
  children?: Children;
}

function normalizeChildren(children: Children | undefined) {
  if (!children) {
    return [];
  }

  const normalized: Children[] = [];
  const queue = Array.isArray(children) ? [...children] : [children];

  while (queue.length > 0) {
    const child = queue.shift();
    if (typeof child === "undefined") {
      continue;
    }

    if (Array.isArray(child)) {
      queue.unshift(...child);
      continue;
    }

    if (typeof child === "string" && child.trim().length === 0) {
      continue;
    }

    normalized.push(child);
  }

  return normalized;
}

function isClause(child: Children) {
  if (!isComponentCreator(child)) {
    return false;
  }

  return child.component === ElseIfClause || child.component === ElseClause;
}

export function IfExpression(props: IfExpressionProps) {
  const children = normalizeChildren(props.children);
  const bodyChildren = children.filter((child) => !isClause(child));
  const clauses = children.filter((child) => isClause(child));

  return (
    <>
      {"if "}
      {props.condition}
      <RustBlock>{bodyChildren}</RustBlock>
      {clauses}
    </>
  );
}

export function ElseIfClause(props: ElseIfClauseProps) {
  return (
    <>
      {" else if "}
      {props.condition}
      <RustBlock>{props.children}</RustBlock>
    </>
  );
}

export function ElseClause(props: ElseClauseProps) {
  return (
    <>
      {" else"}
      <RustBlock>{props.children}</RustBlock>
    </>
  );
}
