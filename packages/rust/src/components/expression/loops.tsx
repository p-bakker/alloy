import { Block, Children } from "@alloy-js/core";
import { StatementList } from "../StatementList.js";

export interface ForLoopProps {
  pattern: Children;
  iter: Children;
  children: Children;
}

export function ForLoop(props: ForLoopProps) {
  return <>for {props.pattern} in {props.iter} <Block><StatementList>{props.children}</StatementList></Block></>;
}

export interface WhileLoopProps {
  condition: Children;
  children: Children;
}

export function WhileLoop(props: WhileLoopProps) {
  return <>while {props.condition} <Block><StatementList>{props.children}</StatementList></Block></>;
}

export interface WhileLetLoopProps {
  pattern: Children;
  expr: Children;
  children: Children;
}

export function WhileLetLoop(props: WhileLetLoopProps) {
  return <>while let {props.pattern} = {props.expr} <Block><StatementList>{props.children}</StatementList></Block></>;
}

export interface LoopProps {
  children: Children;
  label?: string;
}

export function Loop(props: LoopProps) {
  return <>
    {props.label ? `'${props.label}: ` : null}
    loop <Block><StatementList>{props.children}</StatementList></Block>
  </>;
}
