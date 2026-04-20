import type { Children, Namekey, Refkey } from "@alloy-js/core";
import {
  Declaration as CoreDeclaration,
  createScope,
  For,
  Indent,
  type Refkeyable,
  Scope,
  toRefkey,
} from "@alloy-js/core";

import { RustImplScope, useRustScope } from "../scopes/index.js";
import {
  createFieldSymbol,
  createStructSymbol,
  createTypeParameterSymbol,
} from "../symbols/factories.js";
import { resolveSymbolName } from "../symbols/resolve-name.js";
import { AttributeList } from "./attribute.js";
import { DocComment } from "./doc-comment.js";
import type { TypeParameterProp } from "./type-parameters.js";
import { TypeParameters, WhereClause } from "./type-parameters.js";
import {
  type RustVisibilityProps,
  toRustVisibility,
  VisibilityPrefix,
} from "./visibility.js";

export interface StructDeclarationProps extends RustVisibilityProps {
  name: string | Namekey;
  refkey?: Refkeyable;
  derives?: (string | Refkeyable)[] | Refkeyable;
  attributes?: Children[];
  doc?: string;
  typeParameters?: TypeParameterProp[];
  whereClause?: Children;
  tuple?: boolean;
  types?: Children[];
  unit?: boolean;
  children?: Children;
}

export interface FieldProps extends RustVisibilityProps {
  name: string | Namekey;
  type: Children;
  refkey?: Refkey;
  attributes?: Children[];
  doc?: string;
}

function DeclareNamedTypeTypeParameters(props: {
  typeParameters?: TypeParameterProp[];
}) {
  const params = props.typeParameters ?? [];
  for (const param of params) {
    if (param.name) {
      createTypeParameterSymbol(param.name);
    }
  }

  return <></>;
}

export function StructDeclaration(props: StructDeclarationProps) {
  const parentScope = useRustScope();
  const structSymbol = createStructSymbol(props.name, {
    refkeys: props.refkey ? [toRefkey(props.refkey)] : [],
  });
  const structScope = createScope(RustImplScope, structSymbol, parentScope, {
    binder: parentScope.binder,
  });

  structSymbol.visibility = toRustVisibility(props.pub);
  const members = props.children
    ? (Array.isArray(props.children)
        ? props.children
        : [props.children]
      ).filter(
        (child) => !(typeof child === "string" && child.trim().length === 0),
      )
    : [];
  const tupleTypes = props.types ?? [];

  const derives = props.derives
    ? Array.isArray(props.derives)
      ? props.derives
      : [props.derives]
    : [];

  return (
    <>
      {props.doc ? (
        <>
          <DocComment>{props.doc}</DocComment>
        </>
      ) : null}
      <AttributeList attributes={props.attributes} />
      {derives && derives.length > 0 ? (
        <>
          {"#[derive("}
          <For each={derives} joiner={", "}>
            {resolveSymbolName}
          </For>
          {")]"}
          <hbr />
        </>
      ) : null}
      <CoreDeclaration symbol={structSymbol}>
        <Scope value={structScope}>
          <DeclareNamedTypeTypeParameters
            typeParameters={props.typeParameters}
          />
        </Scope>
        <VisibilityPrefix pub={props.pub} />
        {"struct "}
        {structSymbol.name}
        <TypeParameters params={props.typeParameters} />
        {!props.tuple ? (
          <WhereClause trailingComma={!props.unit}>
            {props.whereClause}
          </WhereClause>
        ) : null}
        {props.unit ? (
          ";"
        ) : props.tuple ? (
          <>
            {"("}
            <For each={tupleTypes} joiner={", "}>
              {(type) => type}
            </For>
            {")"}
            <WhereClause trailingComma={false}>{props.whereClause}</WhereClause>
            {";"}
          </>
        ) : members.length > 0 ? (
          <>
            {" {"}
            <Scope value={structScope}>
              <Indent>
                <For each={members} joiner={<hbr />}>
                  {(child) => child}
                </For>
              </Indent>
            </Scope>
            <hbr />
            {"}"}
          </>
        ) : (
          " {}"
        )}
      </CoreDeclaration>
    </>
  );
}

export function Field(props: FieldProps) {
  const fieldSymbol = createFieldSymbol(props.name, {
    refkeys: props.refkey ? [toRefkey(props.refkey)] : [],
  });
  fieldSymbol.visibility = toRustVisibility(props.pub);

  return (
    <CoreDeclaration symbol={fieldSymbol}>
      {props.doc ? (
        <>
          <DocComment>{props.doc}</DocComment>
        </>
      ) : null}
      <AttributeList attributes={props.attributes} />
      <VisibilityPrefix pub={props.pub} />
      {fieldSymbol.name}
      {": "}
      {props.type}
      {","}
    </CoreDeclaration>
  );
}
