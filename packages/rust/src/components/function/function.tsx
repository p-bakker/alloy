import {
  Block,
  Children,
  Declaration,
  For,
  Indent,
  Name,
  Namekey,
  Refkey,
  Scope,
  Show,
} from "@alloy-js/core";
import { useRustScope } from "../../scopes/contexts.js";
import { createFunctionScope } from "../../scopes/factories.js";
import { StatementList } from "../StatementList.js";
import { RustSourceFileScope } from "../../scopes/source-file.js";
import { createFunctionSymbol } from "../../symbols/factories.js";
import { RustVisibility } from "../../symbols/rust.js";
import { renderVisibility } from "../visibility/visibility.js";
import { DocComment } from "../doc/comment.jsx";
import {
  FunctionParameterProps,
  FunctionParameters,
} from "../parameters/parameters.jsx";
import {
  TypeParameterProps,
  TypeParameters,
} from "../parameters/typeparameters.jsx";
import { elideLifetimeAnnotations } from "../../utils/lifetime-elision.js";
import { RenderAttributes } from "../attribute/attribute.js";

export interface FunctionProps {
  name: string | Namekey;
  parameters?: FunctionParameterProps[];
  returns?: Children;
  selfParam?: "&self" | "&mut self" | "self" | "mut self";
  refkey?: Refkey;
  doc?: Children;
  /**
   * Outer attributes to render before the function signature.
   *
   * Each string is wrapped in `#[...]` automatically.
   *
   * @example
   * ```tsx
   * <FunctionDeclaration attributes="test" ... />
   * <FunctionDeclaration attributes={["test", "should_panic"]} ... />
   * <FunctionDeclaration attributes="tokio::main" ... />
   * <FunctionDeclaration attributes='cfg(feature = "async")' ... />
   * ```
   */
  attributes?: string | string[];
  visibility?: RustVisibility;
  async?: boolean;
  unsafe?: boolean;
  typeParameters?: TypeParameterProps[];
  lifetimes?: string[];
  /**
   * When true (the default), applies Rust's lifetime elision rules to omit
   * explicit lifetime annotations when the compiler can infer them.
   */
  elideLifetimes?: boolean;
  children?: Children;
}

/**
 * Checks whether a Children value looks like a Rust reference type (starts with "&").
 */
function looksLikeReference(value: Children): boolean {
  if (typeof value === "string") {
    return value.trimStart().startsWith("&");
  }
  return false;
}

/**
 * A Rust function declaration.
 */
export function FunctionDeclaration(props: FunctionProps) {
  const functionSymbol = createFunctionSymbol(props.name, {
    refkeys: props.refkey,
    visibility: props.visibility,
  });

  const functionScope = createFunctionScope();

  const shouldElide = props.elideLifetimes !== false;

  const resolvedLifetimes = shouldElide
    ? elideLifetimeAnnotations(props.lifetimes, {
        referenceParamCount: (props.parameters ?? []).filter((p) =>
          looksLikeReference(p.type),
        ).length,
        hasSelfRef:
          props.selfParam === "&self" || props.selfParam === "&mut self",
        hasReferenceReturn: looksLikeReference(props.returns),
      })
    : props.lifetimes;

  return (
    <Declaration symbol={functionSymbol}>
      <Scope value={functionScope}>
        <RenderAttributes attributes={props.attributes} />
        <Show when={Boolean(props.doc)}>
          <DocComment children={props.doc} />
          <hbr />
        </Show>
        {renderVisibility(props.visibility)}
        {props.async ? "async " : ""}
        {props.unsafe ? "unsafe " : ""}
        fn{" "}
        <Name />
        <TypeParameters parameters={props.typeParameters} lifetimes={resolvedLifetimes} />
        <FunctionParameters
          parameters={props.parameters}
          selfParam={props.selfParam}
        />
        {props.returns ?
          <> -&gt; {props.returns}</>
        : null}
        {" "}
        {!props.children ?
          "{}"
        : <Block><StatementList>{props.children}</StatementList></Block>}
      </Scope>
    </Declaration>
  );
}
