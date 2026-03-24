import {
  Children,
  For,
  Indent,
  MemberDeclaration,
  MemberName,
  Namekey,
  Refkey,
} from "@alloy-js/core";
import { createTypeParameterSymbol } from "../../symbols/factories.js";

export interface TypeParameterProps {
  name: string | Namekey;
  constraint?: Children;
  refkey?: Refkey;
}

export function TypeParameter(props: TypeParameterProps) {
  const symbol = createTypeParameterSymbol(props.name, {
    refkeys: props.refkey,
  });
  return (
    <MemberDeclaration symbol={symbol}>
      <MemberName />
      {props.constraint ? <>: {props.constraint}</> : null}
    </MemberDeclaration>
  );
}

export interface TypeParametersProps {
  parameters?: TypeParameterProps[];
  lifetimes?: string[];
}

export function TypeParameters(props: TypeParametersProps) {
  const hasLifetimes = props.lifetimes && props.lifetimes.length > 0;
  const hasParams = props.parameters && props.parameters.length > 0;

  if (!hasLifetimes && !hasParams) {
    return null;
  }

  const joiner = (
    <>
      {","}
      <ifBreak flatContents=" ">
        <sbr />
      </ifBreak>
    </>
  );

  return (
    <group>
      {"<"}
      <Indent softline>
        {hasLifetimes && (
          <For
            each={props.lifetimes!}
            joiner={joiner}
            ender={hasParams ? joiner : <ifBreak>,</ifBreak>}
          >
            {(lt) => <>'{lt}</>}
          </For>
        )}
        {hasParams && (
          <For
            each={props.parameters!}
            joiner={joiner}
            ender={<ifBreak>,</ifBreak>}
          >
            {(param) => <TypeParameter {...param} />}
          </For>
        )}
      </Indent>
      <sbr />
      {">"}
    </group>
  );
}
