import {
  Children,
  Declaration,
  Name,
  Namekey,
  Refkey,
  Show,
} from "@alloy-js/core";
import { createConstantSymbol, createVariableSymbol } from "../../symbols/factories.js";
import { RustVisibility } from "../../symbols/rust.js";
import { renderVisibility } from "../visibility/visibility.js";
import { DocComment } from "../doc/comment.js";
import { RenderAttributes } from "../attribute/attribute.js";

export interface ConstDeclarationProps {
  /** Defaults to `_` (discard) when omitted. Mutually exclusive with `pattern`. */
  name?: string | Namekey;
  /** A destructuring pattern (e.g., `<TuplePattern>`). Mutually exclusive with `name`. */
  pattern?: Children;
  /** Defaults to `()` when omitted. */
  type?: Children;
  refkey?: Refkey;
  visibility?: RustVisibility;
  /** Outer attributes rendered before the const declaration. */
  attributes?: string | string[];
  doc?: Children;
  children: Children;
}

/**
 * A Rust const declaration.
 */
export function ConstDeclaration(props: ConstDeclarationProps) {
  if (props.pattern) {
    return (
      <>
        <RenderAttributes attributes={props.attributes} />
        <Show when={Boolean(props.doc)}>
          <DocComment children={props.doc} />
          <hbr />
        </Show>
        {renderVisibility(props.visibility)}const {props.pattern}
        {props.type ? <>: {props.type}</> : null} = {props.children};
      </>
    );
  }

  const symbol = createConstantSymbol(props.name ?? "_", {
    refkeys: props.refkey,
    visibility: props.visibility,
  });

  return (
    <>
      <RenderAttributes attributes={props.attributes} />
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      <Declaration symbol={symbol}>
        {renderVisibility(props.visibility)}const <Name />: {props.type ?? "()"} = {props.children};
      </Declaration>
    </>
  );
}

export interface StaticDeclarationProps {
  name: string | Namekey;
  type: Children;
  refkey?: Refkey;
  visibility?: RustVisibility;
  mutable?: boolean;
  /** Outer attributes rendered before the static declaration. */
  attributes?: string | string[];
  doc?: Children;
  children: Children;
}

/**
 * A Rust static declaration.
 */
export function StaticDeclaration(props: StaticDeclarationProps) {
  const symbol = createConstantSymbol(props.name, {
    refkeys: props.refkey,
    visibility: props.visibility,
  });

  return (
    <>
      <RenderAttributes attributes={props.attributes} />
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      <Declaration symbol={symbol}>
        {renderVisibility(props.visibility)}static {props.mutable ? "mut " : ""}<Name />: {props.type} = {props.children};
      </Declaration>
    </>
  );
}

export interface LetDeclarationProps {
  /** Defaults to `_` (discard) when omitted. Mutually exclusive with `pattern`. */
  name?: string | Namekey;
  /** A destructuring pattern (e.g., `<TuplePattern>`). Mutually exclusive with `name`. */
  pattern?: Children;
  type?: Children;
  refkey?: Refkey;
  mutable?: boolean;
  children?: Children;
}

/**
 * A Rust let declaration (local variable binding).
 */
export function LetDeclaration(props: LetDeclarationProps) {
  if (props.pattern) {
    return <>
      let {props.mutable ? "mut " : ""}{props.pattern}
      {props.type ? <>: {props.type}</> : null}
      {props.children ? <> = {props.children}</> : null};
    </>;
  }

  const symbol = createVariableSymbol(props.name ?? "_", {
    refkeys: props.refkey,
  });

  return (
    <Declaration symbol={symbol}>
      let {props.mutable ? "mut " : ""}<Name />
      {props.type ? <>: {props.type}</> : null}
      {props.children ? <> = {props.children}</> : null};
    </Declaration>
  );
}
