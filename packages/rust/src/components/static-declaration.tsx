import type { Children, Namekey, Refkey } from "@alloy-js/core";
import { Declaration as CoreDeclaration, For } from "@alloy-js/core";

import { createStaticSymbol } from "../symbols/factories.js";
import { AttributeList } from "./attribute.js";
import {
  type RustVisibilityProps,
  toRustVisibility,
  VisibilityPrefix,
} from "./visibility.js";

export interface StaticDeclarationProps extends RustVisibilityProps {
  name: string | Namekey;
  refkey?: Refkey;
  mutable?: boolean;
  attributes?: Children[];
  type: Children;
  children?: Children;
}

export function StaticDeclaration(props: StaticDeclarationProps) {
  const staticSymbol = createStaticSymbol(props.name, {
    refkeys: props.refkey ? [props.refkey] : [],
  });

  staticSymbol.visibility = toRustVisibility(props.pub);

  const mutabilityPrefix = props.mutable ? "mut " : "";

  return (
    <>
      <AttributeList attributes={props.attributes} />
      <CoreDeclaration symbol={staticSymbol}>
        <VisibilityPrefix pub={props.pub} />
        {"static "}
        {mutabilityPrefix}
        {staticSymbol.name}
        {": "}
        {props.type}
        {" = "}
        {props.children}
        {";"}
      </CoreDeclaration>
    </>
  );
}
