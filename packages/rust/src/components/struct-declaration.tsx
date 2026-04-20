import {
  Children,
  Declaration as CoreDeclaration,
  createScope,
  For,
  Indent,
  Namekey,
  Refkey,
  Scope,
} from "@alloy-js/core";
import { RustImplScope, useRustScope } from "../scopes/index.js";
import { resolveSymbolName } from "../symbols/resolve-name.js";
import {
  createFieldSymbol,
  createStructSymbol,
  createTypeParameterSymbol,
} from "../symbols/factories.js";
import { DocComment } from "./doc-comment.js";
import {
  TypeParameterProp,
  TypeParameters,
  WhereClause,
} from "./type-parameters.js";
import {
  type RustVisibilityProps,
  toRustVisibility,
  VisibilityPrefix,
} from "./visibility.js";

export interface StructDeclarationProps extends RustVisibilityProps {
  name: string | Namekey;
  refkey?: Refkey;
  derives?: (string | Refkey)[] | Refkey;
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
    refkeys: props.refkey ? [props.refkey] : [],
  });
  const structScope = createScope(RustImplScope, structSymbol, parentScope, {
    binder: parentScope.binder,
  });

  structSymbol.visibility = toRustVisibility(props.pub);
  const members =
    props.children ?
      (Array.isArray(props.children) ?
        props.children
      : [props.children]
      ).filter(
        (child) => !(typeof child === "string" && child.trim().length === 0),
      )
    : [];
  const tupleTypes = props.types ?? [];

  const derives =
    props.derives ?
      Array.isArray(props.derives) ?
        props.derives
      : [props.derives]
    : [];

  return (
    <>
      {props.doc ?
        <>
          <DocComment>{props.doc}</DocComment>
        </>
      : null}
      {props.attributes && props.attributes.length > 0 ?
        <For each={props.attributes} joiner={""}>
          {(attr) => attr}
        </For>
      : null}
      {derives && derives.length > 0 ?
        <>
          {"#[derive("}
          <For each={derives} joiner={", "}>
            {resolveSymbolName}
          </For>
          {")]"}
          <hbr />
        </>
      : null}
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
        {props.whereClause && !props.tuple ?
          <>
            {" "}
            <WhereClause>{props.whereClause}</WhereClause>
          </>
        : null}
        {props.unit ?
          ";"
        : props.tuple ?
          <>
            {"("}
            <For each={tupleTypes} joiner={", "}>
              {(type) => type}
            </For>
            {")"}
            {props.whereClause ?
              <>
                {" "}
                <WhereClause>{props.whereClause}</WhereClause>
              </>
            : null}
            {";"}
          </>
        : members.length > 0 ?
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
        : " {}"}
      </CoreDeclaration>
    </>
  );
}

export function Field(props: FieldProps) {
  const fieldSymbol = createFieldSymbol(props.name, {
    refkeys: props.refkey ? [props.refkey] : [],
  });
  fieldSymbol.visibility = toRustVisibility(props.pub);

  return (
    <CoreDeclaration symbol={fieldSymbol}>
      {props.doc ?
        <>
          <DocComment>{props.doc}</DocComment>
        </>
      : null}
      {props.attributes && props.attributes.length > 0 ?
        <For each={props.attributes} joiner={""}>
          {(attr) => attr}
        </For>
      : null}
      <VisibilityPrefix pub={props.pub} />
      {fieldSymbol.name}
      {": "}
      {props.type}
      {","}
    </CoreDeclaration>
  );
}
