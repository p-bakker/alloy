import type { Children, Refkey } from "@alloy-js/core";

import { Reference } from "./reference.js";

export type VariantShape = "unit" | "tuple" | "struct";

export interface VariantProps {
  variantRefkey: Refkey;
  shape: VariantShape;
  children?: Children;
}

export function Variant(props: VariantProps) {
  const ref = <Reference refkey={props.variantRefkey} />;
  switch (props.shape) {
    case "unit":
      return ref;
    case "struct":
      return (
        <>
          {ref} {"{ "}
          {props.children}
          {" }"}
        </>
      );
    case "tuple":
    default:
      return (
        <>
          {ref}({props.children})
        </>
      );
  }
}

export type VariantComponent = (props: { children?: Children }) => Children;

export function createVariantComponent(
  variantRefkey: Refkey,
  shape: VariantShape,
): VariantComponent {
  return (props) => (
    <Variant
      variantRefkey={variantRefkey}
      shape={shape}
      children={props.children}
    />
  );
}
