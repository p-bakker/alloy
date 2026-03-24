import {
  Block,
  Children,
  Declaration,
  List,
  Namekey,
  Refkey,
  Scope,
  Show,
} from "@alloy-js/core";
import { createNamedTypeScope } from "../../scopes/factories.js";
import { useCrateEdition } from "../../scopes/contexts.js";
import { createTypeSymbol } from "../../symbols/factories.js";
import { RustVisibility } from "../../symbols/rust.js";
import { renderVisibility } from "../visibility/visibility.js";
import { DocComment } from "../doc/comment.js";
import { Name } from "../Name.js";
import {
  TypeParameterProps,
  TypeParameters,
} from "../parameters/typeparameters.jsx";

export interface TraitDeclarationProps {
  name: string | Namekey;
  refkey?: Refkey;
  visibility?: RustVisibility;
  supertraits?: Children[];
  typeParameters?: TypeParameterProps[];
  lifetimes?: string[];
  doc?: Children;
  asyncTrait?: boolean;
  children?: Children;
}

/**
 * A Rust trait declaration.
 *
 * When `asyncTrait` is true:
 * - On editions before 2024: adds `#[async_trait]` attribute and
 *   `use async_trait::async_trait;` import.
 * - On edition 2024: adds `#[allow(async_fn_in_trait)]` to suppress the
 *   warn-by-default lint (the lint is still active as of Rust 1.93+).
 */
export function TraitDeclaration(props: TraitDeclarationProps) {
  const symbol = createTypeSymbol(props.name, "trait", {
    refkeys: props.refkey,
    visibility: props.visibility,
  });

  const typeScope = createNamedTypeScope(symbol);
  const edition = useCrateEdition();
  const needsAsyncTraitAttr = props.asyncTrait && edition !== "2024";
  const needsAsyncLintAllow = props.asyncTrait && edition === "2024";

  return (
    <>
      <Show when={needsAsyncTraitAttr}>
        use async_trait::async_trait;{"\n"}{"\n"}
      </Show>
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      <Show when={needsAsyncTraitAttr}>
        #[async_trait]{"\n"}
      </Show>
      <Show when={needsAsyncLintAllow}>
        #[allow(async_fn_in_trait)]{"\n"}
      </Show>
      <Declaration symbol={symbol}>
        {renderVisibility(props.visibility)}trait <Name />
        <TypeParameters parameters={props.typeParameters} lifetimes={props.lifetimes} />
        {props.supertraits && props.supertraits.length > 0 ?
          <>: {props.supertraits.join(" + ")}</>
        : null}
        <Scope value={typeScope}>
          {" "}
          {props.children ?
            <Block><List doubleHardline>{props.children}</List></Block>
          : "{}"}
        </Scope>
      </Declaration>
    </>
  );
}

export interface TraitMethodProps {
  name: string;
  selfParam?: "&self" | "&mut self" | "self" | "mut self";
  parameters?: string;
  returns?: Children;
  async?: boolean;
  doc?: Children;
  children?: Children;
}

/**
 * A method signature within a trait declaration.
 */
export function TraitMethod(props: TraitMethodProps) {
  const params = props.selfParam ?
    (props.parameters ? `${props.selfParam}, ${props.parameters}` : props.selfParam)
  : (props.parameters ?? "");

  const asyncPrefix = props.async ? "async " : "";

  return (
    <>
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      {asyncPrefix}fn {props.name}({params})
      {props.returns ? <> -&gt; {props.returns}</> : null}
      {props.children ?
        <>
          {" "}
          <Block>{props.children}</Block>
        </>
      : ";"}
    </>
  );
}
