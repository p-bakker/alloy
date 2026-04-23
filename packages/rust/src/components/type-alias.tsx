import type { Children, Namekey, Refkey } from "@alloy-js/core";
import {
  Declaration as CoreDeclaration,
  For,
  type Refkeyable,
  toRefkey,
} from "@alloy-js/core";

import { createTypeAliasSymbol } from "../symbols/factories.js";
import { AttributeList } from "./attribute.js";
import type { TypeParameterProp } from "./type-parameters.js";
import { TypeParameters } from "./type-parameters.js";
import {
  type RustVisibilityProps,
  toRustVisibility,
  VisibilityPrefix,
} from "./visibility.js";

export interface TypeAliasProps extends RustVisibilityProps {
  name: string | Namekey;
  refkey?: Refkeyable;
  attributes?: Children[];
  typeParameters?: TypeParameterProp[];
  children?: Children;
}

export function TypeAlias(props: TypeAliasProps) {
  const typeAliasSymbol = createTypeAliasSymbol(props.name, {
    refkeys: props.refkey ? [toRefkey(props.refkey)] : [],
  });

  typeAliasSymbol.visibility = toRustVisibility(props.pub);

  return (
    <>
      <AttributeList attributes={props.attributes} />
      <CoreDeclaration symbol={typeAliasSymbol}>
        <VisibilityPrefix pub={props.pub} />
        {"type "}
        {typeAliasSymbol.name}
        <TypeParameters params={props.typeParameters} />
        {" = "}
        {props.children}
        {";"}
      </CoreDeclaration>
    </>
  );
}
