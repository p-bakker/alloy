import type { Children, Namekey, Refkey } from "@alloy-js/core";
import { Declaration as CoreDeclaration } from "@alloy-js/core";

import { createAssociatedTypeSymbol } from "../symbols/factories.js";
import { renderConstraints } from "./type-parameters.js";

export interface AssociatedTypeProps {
  name: string | Namekey;
  refkey?: Refkey;
  constraints?: Children | Children[];
  children?: Children;
}

export function AssociatedType(props: AssociatedTypeProps) {
  const associatedTypeSymbol = createAssociatedTypeSymbol(props.name, {
    refkeys: props.refkey ? [props.refkey] : [],
  });

  return (
    <CoreDeclaration symbol={associatedTypeSymbol}>
      {"type "}
      {associatedTypeSymbol.name}
      {props.children ? (
        <>
          {" = "}
          {props.children}
        </>
      ) : props.constraints ? (
        <>
          {": "}
          {renderConstraints(props.constraints)}
        </>
      ) : null}
      {";"}
    </CoreDeclaration>
  );
}
