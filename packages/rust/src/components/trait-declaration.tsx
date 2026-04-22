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
import { ItemList } from "./primitives/item-list.js";
import type { TypeParameterProp } from "./type-parameters.js";
import {
  hasWhereClauseBounds,
  TypeParameters,
  WhereClause,
} from "./type-parameters.js";
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
  const hasSupertraits = !!(props.supertraits && props.supertraits.length > 0);
  const whereClausePresent = hasWhereClauseBounds(props.whereClause);
  const supertraitGroupId = Symbol("trait-supertraits");

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
        {hasSupertraits ? (
          <group id={supertraitGroupId}>
            {":"}
            <Indent line>
              <For
                each={props.supertraits!}
                joiner={
                  <>
                    <br />+{" "}
                  </>
                }
              >
                {(supertrait) => supertrait}
              </For>
            </Indent>
            {whereClausePresent ? null : (
              <>
                <br />
                {"{"}
              </>
            )}
          </group>
        ) : null}
        <WhereClause>{props.whereClause}</WhereClause>
        {whereClausePresent ? (
          <>
            <hbr />
            {"{"}
          </>
        ) : !hasSupertraits ? (
          hasBody ? (
            code` {`
          ) : (
            code` {}`
          )
        ) : null}
        {hasBody ? (
          <>
            <Scope value={traitScope}>
              <Indent>
                <ItemList mode="associated">{bodyChildren}</ItemList>
              </Indent>
            </Scope>
            <hbr />
            {code`}`}
          </>
        ) : whereClausePresent ? (
          <>
            <hbr />
            {"}"}
          </>
        ) : hasSupertraits ? (
          <ifBreak groupId={supertraitGroupId} flatContents="}">
            <hbr />
            {"}"}
          </ifBreak>
        ) : null}
      </CoreDeclaration>
    </>
  );
}
