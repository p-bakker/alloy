import type { Children, Refkey } from "@alloy-js/core";
import {
  For,
  Indent,
  type Refkeyable,
  Scope,
  code,
  createScope,
  createSymbol,
  isRefkey,
  isRefkeyable,
  toRefkey,
  unresolvedRefkey,
} from "@alloy-js/core";

import {
  RustImplScope,
  RustModuleScope,
  useRustScope,
} from "../scopes/index.js";
import { NamedTypeSymbol } from "../symbols/named-type-symbol.js";
import { RustOutputSymbol } from "../symbols/rust-output-symbol.js";
import { AttributeList } from "./attribute.js";
import type { TypeParameterProp } from "./type-parameters.js";
import { TypeParameters, WhereClause } from "./type-parameters.js";

export type TypeParameterProps = TypeParameterProp;

export interface ImplBlockProps {
  type: Refkeyable | Children;
  trait?: Refkeyable | Children;
  typeParameters?: TypeParameterProps[];
  whereClause?: Children;
  attributes?: Children[];
  children?: Children;
}

function resolveTypeSymbolFromRefkey(
  refkey: Refkey,
  scope: ReturnType<typeof useRustScope>,
): NamedTypeSymbol | undefined {
  const result = scope.binder?.resolveDeclarationByKey(scope, refkey).value;
  return result?.symbol instanceof NamedTypeSymbol ? result.symbol : undefined;
}

function resolveSymbolNameFromRefkey(
  refkey: Refkey,
  scope: ReturnType<typeof useRustScope>,
): string {
  const result = scope.binder?.resolveDeclarationByKey(scope, refkey).value;
  const symbol = result?.symbol as RustOutputSymbol | undefined;
  return symbol?.name ?? unresolvedRefkey(refkey);
}

function findTypeSymbolFromInline(
  value: Children,
  scope: ReturnType<typeof useRustScope>,
): NamedTypeSymbol | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const moduleScope = scope.enclosingModule;
  if (!(moduleScope instanceof RustModuleScope)) {
    return undefined;
  }

  for (const symbol of moduleScope.types) {
    if (symbol instanceof NamedTypeSymbol && symbol.name === value) {
      return symbol;
    }
  }

  return undefined;
}

function inferredTypeParametersForImpl(
  symbol: NamedTypeSymbol | undefined,
): TypeParameterProp[] {
  if (!symbol) {
    return [];
  }

  const params: TypeParameterProp[] = [];
  for (const typeParameter of symbol.typeParameters) {
    if (typeParameter instanceof RustOutputSymbol) {
      params.push({ name: typeParameter.name });
    }
  }

  return params;
}

function renderTypeWithInferredTypeParameters(
  renderedType: Children,
  inferredTypeParameters: TypeParameterProp[],
): Children {
  if (typeof renderedType !== "string" || inferredTypeParameters.length === 0) {
    return renderedType;
  }

  const names = inferredTypeParameters
    .map((param) => param.name)
    .filter((name) => Boolean(name));
  if (names.length === 0) {
    return renderedType;
  }

  return code`${renderedType}<${names.join(", ")}>`;
}

export function ImplBlock(props: ImplBlockProps) {
  const parentScope = useRustScope();

  const typeRefkey = isRefkey(props.type)
    ? props.type
    : isRefkeyable(props.type)
      ? toRefkey(props.type)
      : undefined;
  const renderedType = typeRefkey
    ? resolveSymbolNameFromRefkey(typeRefkey, parentScope)
    : (props.type as Children);
  const targetTypeSymbol = typeRefkey
    ? resolveTypeSymbolFromRefkey(typeRefkey, parentScope)
    : findTypeSymbolFromInline(props.type as Children, parentScope);

  const implTargetSymbol =
    targetTypeSymbol ??
    createSymbol(NamedTypeSymbol, "__impl_target__", undefined, "struct", {
      binder: parentScope.binder,
      symbolKind: "struct",
    });

  const implScope = createScope(RustImplScope, implTargetSymbol, parentScope, {
    binder: parentScope.binder,
  });
  const inferredTypeParameters =
    inferredTypeParametersForImpl(targetTypeSymbol);
  const implTypeParameters = props.typeParameters ?? inferredTypeParameters;
  const renderedTypeWithTypeParameters = renderTypeWithInferredTypeParameters(
    renderedType,
    inferredTypeParameters,
  );

  const bodyChildren = props.children
    ? (Array.isArray(props.children)
        ? props.children
        : [props.children]
      ).filter(
        (child) => !(typeof child === "string" && child.trim().length === 0),
      )
    : [];
  const hasBody = bodyChildren.length > 0;

  return (
    <>
      <AttributeList attributes={props.attributes} />
      {code`impl`}
      <TypeParameters params={implTypeParameters} />{" "}
      {props.trait ? (
        <>
          {props.trait}
          {code` for `}
        </>
      ) : null}
      {renderedTypeWithTypeParameters}
      <WhereClause>{props.whereClause}</WhereClause>
      {hasBody ? (
        <>
          {code` {`}
          <Scope value={implScope}>
            <Indent>{bodyChildren}</Indent>
          </Scope>
          <hbr />
          {code`}`}
        </>
      ) : (
        code` {}`
      )}
    </>
  );
}
