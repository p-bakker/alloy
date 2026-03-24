import { Children, For } from "@alloy-js/core";

export interface TuplePatternProps {
  children: Children[];
}

export function TuplePattern(props: TuplePatternProps) {
  return <>(<For each={props.children} joiner={<>, </>}>{(c) => c}</For>)</>;
}

export interface StructPatternField {
  name: string;
  rename?: string;
}

export interface StructPatternProps {
  type: Children;
  fields: StructPatternField[];
  rest?: boolean;
}

export function StructPattern(props: StructPatternProps) {
  const fieldParts = props.fields.map((f) =>
    f.rename ? `${f.name}: ${f.rename}` : f.name
  );
  if (props.rest) {
    fieldParts.push("..");
  }
  return <>{props.type} {"{ "}{fieldParts.join(", ")}{" }"}</>;
}

export interface SlicePatternProps {
  children: Children[];
}

export function SlicePattern(props: SlicePatternProps) {
  return <>[<For each={props.children} joiner={<>, </>}>{(c) => c}</For>]</>;
}

export interface RefPatternProps {
  mutable?: boolean;
  children: Children;
}

export function RefPattern(props: RefPatternProps) {
  return <>&amp;{props.mutable ? "mut " : null}{props.children}</>;
}
