import type { Children, Refkey } from "@alloy-js/core";

import { Reference } from "./reference.js";

export interface TypeRefProps {
  typeRefkey: Refkey;
  children?: Children;
}

/**
 * Renders a reference to a named type with optional generic type arguments:
 * `<TypeRef refkey={X} />` → `X`, `<TypeRef refkey={X}>T, U</TypeRef>` → `X<T, U>`.
 */
export function TypeRef(props: TypeRefProps) {
  const ref = <Reference refkey={props.typeRefkey} />;
  if (props.children === undefined) {
    return ref;
  }
  return (
    <>
      {ref}
      {"<"}
      {props.children}
      {">"}
    </>
  );
}

export type TypeComponent = (props: { children?: Children }) => Children;

export function createTypeComponent(typeRefkey: Refkey): TypeComponent {
  return (props) => (
    <TypeRef typeRefkey={typeRefkey} children={props.children} />
  );
}
