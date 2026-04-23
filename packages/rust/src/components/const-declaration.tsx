import type { Children, Namekey, Refkey } from "@alloy-js/core";
import { Declaration as CoreDeclaration, For } from "@alloy-js/core";

import { createConstSymbol } from "../symbols/factories.js";
import { AttributeList } from "./attribute.js";
import {
  type RustVisibilityProps,
  toRustVisibility,
  VisibilityPrefix,
} from "./visibility.js";

export interface ConstDeclarationProps extends RustVisibilityProps {
  name: string | Namekey;
  refkey?: Refkey;
  attributes?: Children[];
  type: Children;
  children?: Children;
}

export function ConstDeclaration(props: ConstDeclarationProps) {
  const constSymbol = createConstSymbol(props.name, {
    refkeys: props.refkey ? [props.refkey] : [],
  });

  constSymbol.visibility = toRustVisibility(props.pub);

  return (
    <>
      <AttributeList attributes={props.attributes} />
      <CoreDeclaration symbol={constSymbol}>
        <VisibilityPrefix pub={props.pub} />
        {"const "}
        {constSymbol.name}
        {": "}
        {props.type}
        {" = "}
        {props.children}
        {";"}
      </CoreDeclaration>
    </>
  );
}
