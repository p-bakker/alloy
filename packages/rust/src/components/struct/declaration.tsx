import {
  Block,
  Children,
  Declaration,
  DeclarationContext,
  memo,
  Namekey,
  Refkey,
  Scope,
  Show,
  useContext,
} from "@alloy-js/core";
import { useRustScope, useNamedTypeScope } from "../../scopes/contexts.js";
import { createNamedTypeScope } from "../../scopes/factories.js";
import { RustNamedTypeScope } from "../../scopes/named-type.js";
import {
  createAnonymousTypeSymbol,
  createStructFieldSymbol,
} from "../../symbols/factories.js";
import { NamedTypeSymbol } from "../../symbols/named-type.js";
import { RustVisibility } from "../../symbols/rust.js";
import { renderVisibility } from "../visibility/visibility.js";
import { DocComment } from "../doc/comment.js";
import { RenderAttributes } from "../attribute/attribute.js";
import { Name } from "../Name.js";
import { createTypeSymbol } from "../../symbols/factories.js";
import {
  TypeParameterProps,
  TypeParameters,
} from "../parameters/typeparameters.jsx";

export interface StructDeclarationProps {
  name: string | Namekey;
  refkey?: Refkey;
  visibility?: RustVisibility;
  typeParameters?: TypeParameterProps[];
  lifetimes?: string[];
  /** Outer attributes rendered before the struct (e.g. `"derive(Debug, Clone)"`). */
  attributes?: string | string[];
  doc?: Children;
  children?: Children;
}

/**
 * A Rust struct declaration.
 * @example
 * ```tsx
 * <StructDeclaration name="Person" visibility="pub">
 *   <StructField name="name" type="String" visibility="pub" />
 *   <StructField name="age" type="i64" visibility="pub" />
 * </StructDeclaration>
 * ```
 * Produces:
 * ```rust
 * pub struct Person {
 *     pub name: String,
 *     pub age: i64,
 * }
 * ```
 */
export function StructDeclaration(props: StructDeclarationProps) {
  const symbol = createTypeSymbol(props.name, "struct", {
    refkeys: props.refkey,
    visibility: props.visibility,
  });

  const typeScope = createNamedTypeScope(symbol);

  const content = memo(() => {
    if (props.children) {
      return (
        <>
          {" "}
          <Block>{props.children}</Block>
        </>
      );
    } else {
      return " {}";
    }
  });

  return (
    <>
      <RenderAttributes attributes={props.attributes} />
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      <Declaration symbol={symbol}>
        {renderVisibility(props.visibility)}struct <Name />
        <TypeParameters parameters={props.typeParameters} lifetimes={props.lifetimes} />
        <Scope value={typeScope}>{content}</Scope>
      </Declaration>
    </>
  );
}

export interface StructFieldProps {
  name: string | Namekey;
  type: Children;
  refkey?: Refkey;
  visibility?: RustVisibility;
  /** Outer attributes rendered before the field (e.g. `'serde(rename = "camelCase")'`). */
  attributes?: string | string[];
  doc?: Children;
}

/**
 * A field within a Rust struct.
 */
export function StructField(props: StructFieldProps) {
  const symbol = createStructFieldSymbol(props.name, {
    refkeys: props.refkey,
    visibility: props.visibility,
  });

  return (
    <Declaration symbol={symbol}>
      <RenderAttributes attributes={props.attributes} />
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      {renderVisibility(props.visibility)}<Name />: {props.type},
    </Declaration>
  );
}
