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
  createEnumSymbol,
  createTypeParameterSymbol,
  createVariantSymbol,
} from "../symbols/factories.js";
import { resolveSymbolName } from "../symbols/resolve-name.js";
import { AttributeList } from "./attribute.js";
import { DocComment } from "./doc-comment.js";
import { ArgList } from "./primitives/arg-list.js";
import { BracedList } from "./primitives/braced-list.js";
import { FieldList } from "./primitives/field-list.js";
import type { TypeParameterProp } from "./type-parameters.js";
import { TypeParameters } from "./type-parameters.js";
import {
  type RustVisibilityProps,
  toRustVisibility,
  VisibilityPrefix,
} from "./visibility.js";

export interface EnumDeclarationProps extends RustVisibilityProps {
  name: string | Namekey;
  refkey?: Refkeyable;
  derives?: (string | Refkeyable)[] | Refkeyable;
  attributes?: Children[];
  doc?: string;
  typeParameters?: TypeParameterProp[];
  children?: Children;
}

export interface EnumVariantProps {
  name: string | Namekey;
  refkey?: Refkeyable;
  attributes?: Children[];
  doc?: string;
  kind?: "unit" | "tuple" | "struct";
  fields?: Children[];
  children?: Children;
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

export function EnumDeclaration(props: EnumDeclarationProps) {
  const parentScope = useRustScope();
  const enumSymbol = createEnumSymbol(props.name, {
    refkeys: props.refkey ? [toRefkey(props.refkey)] : [],
  });
  const enumScope = createScope(RustImplScope, enumSymbol, parentScope, {
    binder: parentScope.binder,
  });
  enumSymbol.visibility = toRustVisibility(props.pub);
  const variants = props.children
    ? (Array.isArray(props.children)
        ? props.children
        : [props.children]
      ).filter(
        (child) => !(typeof child === "string" && child.trim().length === 0),
      )
    : [];

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
          {"#[derive"}
          <ArgList>{derives.map(resolveSymbolName)}</ArgList>
          {"]"}
          <hbr />
        </>
      ) : null}
      <CoreDeclaration symbol={enumSymbol}>
        <Scope value={enumScope}>
          <DeclareNamedTypeTypeParameters
            typeParameters={props.typeParameters}
          />
        </Scope>
        <VisibilityPrefix pub={props.pub} />
        {"enum "}
        {enumSymbol.name}
        <TypeParameters params={props.typeParameters} />{" "}
        {variants.length > 0 ? (
          <Scope value={enumScope}>
            <FieldList>{variants}</FieldList>
          </Scope>
        ) : (
          "{}"
        )}
      </CoreDeclaration>
    </>
  );
}

export function EnumVariant(props: EnumVariantProps) {
  const variantSymbol = createVariantSymbol(props.name, {
    refkeys: props.refkey ? [toRefkey(props.refkey)] : [],
  });

  const tupleFields = (props.fields ?? []).filter(
    (field) => !(typeof field === "string" && field.trim().length === 0),
  );
  const members = props.children
    ? (Array.isArray(props.children)
        ? props.children
        : [props.children]
      ).filter(
        (child) => !(typeof child === "string" && child.trim().length === 0),
      )
    : [];
  const variantKind =
    props.kind ??
    (tupleFields.length > 0 ? "tuple" : members.length > 0 ? "struct" : "unit");
  const tupleValues = tupleFields.length > 0 ? tupleFields : members;

  return (
    <CoreDeclaration symbol={variantSymbol}>
      {props.doc ? (
        <>
          <DocComment>{props.doc}</DocComment>
        </>
      ) : null}
      <AttributeList attributes={props.attributes} />
      {variantSymbol.name}
      {variantKind === "tuple" && tupleValues.length > 0 ? (
        <ArgList>{tupleValues}</ArgList>
      ) : variantKind === "struct" ? (
        <>
          {" "}
          <BracedList pad heuristic="structVariantWidth">
            {members}
          </BracedList>
        </>
      ) : null}
    </CoreDeclaration>
  );
}
