import type { Children, Namekey, Refkey } from "@alloy-js/core";
import {
  code,
  Declaration as CoreDeclaration,
  createScope,
  For,
  Indent,
  type Refkeyable,
  Scope,
  toRefkey,
} from "@alloy-js/core";

import { RustTraitScope, useRustScope } from "../scopes/index.js";
import { createTraitSymbol } from "../symbols/factories.js";
import { AttributeList } from "./attribute.js";
import { DocComment } from "./doc-comment.js";
import type { TypeParameterProp } from "./type-parameters.js";
import { TypeParameters, WhereClause } from "./type-parameters.js";
import {
  type RustVisibilityProps,
  toRustVisibility,
  VisibilityPrefix,
} from "./visibility.js";

export interface TraitDeclarationProps extends RustVisibilityProps {
  name: string | Namekey;
  refkey?: Refkeyable;
  typeParameters?: TypeParameterProp[];
  supertraits?: Children[];
  whereClause?: Children;
  attributes?: Children[];
  doc?: Children;
  children?: Children;
}

export function TraitDeclaration(props: TraitDeclarationProps) {
  const parentScope = useRustScope();
  const traitSymbol = createTraitSymbol(props.name, {
    refkeys: props.refkey ? [toRefkey(props.refkey)] : [],
  });
  const traitScope = createScope(RustTraitScope, traitSymbol, parentScope, {
    binder: parentScope.binder,
  });

  traitSymbol.visibility = toRustVisibility(props.pub);

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
      {props.doc ? (
        <>
          <DocComment>{props.doc}</DocComment>
        </>
      ) : null}
      <AttributeList attributes={props.attributes} />
      <CoreDeclaration symbol={traitSymbol}>
        <VisibilityPrefix pub={props.pub} />
        {code`trait `}
        {traitSymbol.name}
        <TypeParameters params={props.typeParameters} />
        {props.supertraits && props.supertraits.length > 0 ? (
          <>
            {code`: `}
            <For each={props.supertraits} joiner={code` + `}>
              {(supertrait) => supertrait}
            </For>
          </>
        ) : null}
        <WhereClause>{props.whereClause}</WhereClause>
        {hasBody ? (
          <>
            {code` {`}
            <Scope value={traitScope}>
              <Indent>{bodyChildren}</Indent>
            </Scope>
            <hbr />
            {code`}`}
          </>
        ) : (
          code` {}`
        )}
      </CoreDeclaration>
    </>
  );
}
