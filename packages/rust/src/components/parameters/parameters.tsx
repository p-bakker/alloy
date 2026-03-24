import {
  Children,
  createSymbolSlot,
  Declaration,
  For,
  Indent,
  Namekey,
  Refkey,
} from "@alloy-js/core";
import { createParameterSymbol } from "../../symbols/factories.js";
import { Name } from "../Name.jsx";

export interface FunctionParameterProps {
  name: string | Namekey;
  type: Children;
  mutable?: boolean;
  refkey?: Refkey;
}

export function FunctionParameter(props: FunctionParameterProps) {
  const TypeSlot = createSymbolSlot();

  const memberSymbol = createParameterSymbol(props.name, {
    refkeys: props.refkey,
    type: TypeSlot.firstSymbol,
  });

  return (
    <Declaration symbol={memberSymbol}>
      {props.mutable ? "mut " : ""}<Name />: <TypeSlot>{props.type}</TypeSlot>
    </Declaration>
  );
}

export interface FunctionParametersProps {
  parameters: FunctionParameterProps[] | undefined;
  selfParam?: "&self" | "&mut self" | "self" | "mut self";
}

export function FunctionParameters(props: FunctionParametersProps) {
  const params = props.parameters ?? [];
  const hasSelf = !!props.selfParam;
  const hasParams = params.length > 0;

  return (
    <group>
      {"("}
      <Indent softline>
        {hasSelf ?
          <>
            {props.selfParam}
            {hasParams ? <>{","}<ifBreak flatContents=" "><sbr /></ifBreak></> : null}
          </>
        : null}
        {hasParams && (
          <For
            each={params}
            joiner={
              <>
                {","}
                <ifBreak flatContents=" ">
                  <sbr />
                </ifBreak>
              </>
            }
            ender={<ifBreak>,</ifBreak>}
          >
            {(param) => <FunctionParameter {...param} />}
          </For>
        )}
      </Indent>
      <sbr />
      {")"}
    </group>
  );
}
