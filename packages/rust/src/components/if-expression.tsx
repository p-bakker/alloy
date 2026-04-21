import type { Children, ComponentCreator } from "@alloy-js/core";
import { isComponentCreator } from "@alloy-js/core";

import { useCrateContext } from "../context/crate-context.js";
import { useResolvedHeuristics } from "../context/resolved-heuristics.js";
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

function isElseClause(child: Children) {
  if (!isComponentCreator(child)) {
    return false;
  }
  return child.component === ElseClause;
}

function isElseIfClause(child: Children) {
  if (!isComponentCreator(child)) {
    return false;
  }
  return child.component === ElseIfClause;
}

export function IfExpression(props: IfExpressionProps) {
  const { singleLineIfElseMaxWidth } = useResolvedHeuristics();
  const edition = Number(useCrateContext()?.edition ?? 0);
  const children = normalizeChildren(props.children);
  const bodyChildren = children.filter((child) => !isClause(child));
  const clauses = children.filter((child) => isClause(child));

  const elseIfs = clauses.filter(isElseIfClause);
  const elseClauses = clauses.filter(isElseClause);

  // Eligibility for the single-line `if cond { a } else { b }` form:
  // edition 2024 or later, exactly one `ElseClause`, zero
  // `ElseIfClause`s, and each side carries a single-expression body.
  // Anything else falls back to the multi-line rendering — including
  // every pre-2024 edition, where rustfmt unconditionally breaks the
  // construct across lines. The numeric compare defends against a
  // missing `CrateContext` (falls through to multi-line) and against
  // any future edition year.
  if (
    edition >= 2024 &&
    elseIfs.length === 0 &&
    elseClauses.length === 1 &&
    bodyChildren.length === 1
  ) {
    const elseClause = elseClauses[0] as ComponentCreator<ElseClauseProps>;
    const elseBodyChildren = normalizeChildren(elseClause.props.children);

    if (elseBodyChildren.length === 1) {
      return (
        <group max={singleLineIfElseMaxWidth}>
          {"if "}
          {props.condition}
          <RustBlock inline>{bodyChildren}</RustBlock>
          {" else"}
          <RustBlock inline>{elseBodyChildren}</RustBlock>
        </group>
      );
    }
  }

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
