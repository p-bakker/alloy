import type { Children, Namekey, Refkey } from "@alloy-js/core";
import {
  Declaration as CoreDeclaration,
  For,
  Indent,
  Scope,
  createScope,
} from "@alloy-js/core";

import type { ParameterDescriptor } from "../parameter-descriptor.js";
import {
  RustFunctionScope,
  RustImplScope,
  RustTraitScope,
  useRustScope,
} from "../scopes/index.js";
import {
  createFunctionSymbol,
  createMethodSymbol,
} from "../symbols/factories.js";
import { AttributeList } from "./attribute.js";
import { DocComment } from "./doc-comment.js";
import { Parameters } from "./parameters.js";
import type { TypeParameterProp } from "./type-parameters.js";
import { TypeParameters, WhereClause } from "./type-parameters.js";
import {
  type RustVisibilityProps,
  toRustVisibility,
  VisibilityPrefix,
} from "./visibility.js";

export interface FunctionDeclarationProps extends RustVisibilityProps {
  name: string | Namekey;
  refkey?: Refkey;
  async?: boolean;
  unsafe?: boolean;
  const?: boolean;
  parameters?: readonly ParameterDescriptor[];
  returnType?: Children;
  typeParameters?: TypeParameterProp[];
  whereClause?: Children;
  receiver?: "&self" | "&mut self" | "self" | "none";
  attributes?: Children[];
  doc?: string;
  children?: Children;
}

export function FunctionDeclaration(props: FunctionDeclarationProps) {
  const parentScope = useRustScope();
  const isMethod =
    parentScope instanceof RustImplScope ||
    parentScope instanceof RustTraitScope;
  const effectiveReceiver = isMethod ? (props.receiver ?? "&self") : "none";
  const functionSymbol = isMethod
    ? createMethodSymbol(props.name, {
        refkeys: props.refkey ? [props.refkey] : [],
      })
    : createFunctionSymbol(props.name, {
        refkeys: props.refkey ? [props.refkey] : [],
      });
  const functionScope = createScope(
    RustFunctionScope,
    functionSymbol.name,
    parentScope,
    {
      ownerSymbol: functionSymbol,
      binder: parentScope.binder,
    },
  );

  functionSymbol.visibility = toRustVisibility(props.pub);
  functionSymbol.isAsync = props.async ?? false;
  functionSymbol.isUnsafe = props.unsafe ?? false;
  functionSymbol.isConst = props.const ?? false;
  functionSymbol.receiverType =
    effectiveReceiver === "none" ? undefined : effectiveReceiver;

  const bodyChildren = props.children
    ? (Array.isArray(props.children)
        ? props.children
        : [props.children]
      ).filter(
        (child) => !(typeof child === "string" && child.trim().length === 0),
      )
    : [];
  const hasBody = bodyChildren.length > 0;
  const isForwardDecl = !hasBody && parentScope instanceof RustTraitScope;
  const body = hasBody ? (
    <>
      {" {"}
      <Indent>{bodyChildren}</Indent>
      <hbr />
      {"}"}
    </>
  ) : isForwardDecl ? (
    ";"
  ) : (
    " {}"
  );

  return (
    <>
      {props.doc ? (
        <>
          <DocComment>{props.doc}</DocComment>
        </>
      ) : null}
      <AttributeList attributes={props.attributes} />
      <CoreDeclaration symbol={functionSymbol}>
        <VisibilityPrefix pub={props.pub} />
        {props.const ? "const " : ""}
        {props.async ? "async " : ""}
        {props.unsafe ? "unsafe " : ""}
        {"fn "}
        {functionSymbol.name}
        <Scope value={functionScope}>
          <TypeParameters params={props.typeParameters} />
          <Parameters
            parameters={props.parameters}
            receiver={
              effectiveReceiver !== "none" ? effectiveReceiver : undefined
            }
          />
          {props.returnType ? (
            <>
              {" -> "}
              {props.returnType}
            </>
          ) : null}
          <WhereClause trailingComma={!isForwardDecl}>
            {props.whereClause}
          </WhereClause>
          {body}
        </Scope>
      </CoreDeclaration>
    </>
  );
}
