import type { Children } from "@alloy-js/core";
import { Declaration as CoreDeclaration } from "@alloy-js/core";

import type { ParameterDescriptor } from "../parameter-descriptor.js";
import { createParameterSymbol } from "../symbols/factories.js";
import { ParamList } from "./primitives/param-list.js";

export interface ParametersProps {
  parameters?: readonly ParameterDescriptor[];
  /**
   * Optional method receiver rendered as the first entry (e.g. `&self`,
   * `&mut self`, `self`). When present, it is emitted verbatim ahead of
   * any named parameters.
   */
  receiver?: Children;
}

function Parameter(props: { parameter: ParameterDescriptor }) {
  const parameterSymbol = createParameterSymbol(props.parameter.name);
  const typePrefix = props.parameter.refType
    ? `${props.parameter.refType} `
    : "";

  return (
    <CoreDeclaration symbol={parameterSymbol}>
      {props.parameter.mutable ? "mut " : ""}
      {parameterSymbol.name}
      {props.parameter.type !== undefined ? (
        <>
          {": "}
          {typePrefix}
          {props.parameter.type}
        </>
      ) : null}
    </CoreDeclaration>
  );
}

export function Parameters(props: ParametersProps) {
  const entries: Children[] = [];
  if (props.receiver !== undefined && props.receiver !== null) {
    entries.push(props.receiver);
  }
  if (props.parameters) {
    for (const parameter of props.parameters) {
      entries.push(<Parameter parameter={parameter} />);
    }
  }

  return <ParamList>{entries}</ParamList>;
}
