import {
  Block,
  Children,
  List,
  Namekey,
  Refkey,
  Scope,
} from "@alloy-js/core";
import { createImplScope } from "../../scopes/factories.js";
import {
  TypeParameterProps,
  TypeParameters,
} from "../parameters/typeparameters.jsx";
import { RenderAttributes } from "../attribute/attribute.js";

export interface ImplBlockProps {
  type: Children;
  trait?: Children;
  typeParameters?: TypeParameterProps[];
  lifetimes?: string[];
  /** Outer attributes rendered before the impl block. */
  attributes?: string | string[];
  children?: Children;
}

/**
 * A Rust impl block.
 * @example
 * ```tsx
 * <ImplBlock type={personRef}>
 *   <FunctionDeclaration name="new" ... />
 * </ImplBlock>
 * ```
 * Produces:
 * ```rust
 * impl Person {
 *     pub fn new(...) -> Person { ... }
 * }
 * ```
 */
export function ImplBlock(props: ImplBlockProps) {
  const implScope = createImplScope();

  return (
    <Scope value={implScope}>
      <RenderAttributes attributes={props.attributes} />
      impl
      <TypeParameters parameters={props.typeParameters} lifetimes={props.lifetimes} />
      {props.trait ?
        <> {props.trait} for</>
      : null}
      {" "}{props.type}
      {" "}
      {props.children ?
        <Block><List doubleHardline>{props.children}</List></Block>
      : "{}"}
    </Scope>
  );
}
