import {
  Block,
  Children,
  Declaration,
  Namekey,
  Refkey,
  Scope,
  Show,
  memo,
} from "@alloy-js/core";
import { createNamedTypeScope } from "../../scopes/factories.js";
import { createTypeSymbol, createEnumVariantSymbol } from "../../symbols/factories.js";
import { RustVisibility } from "../../symbols/rust.js";
import { renderVisibility } from "../visibility/visibility.js";
import { DocComment } from "../doc/comment.js";
import { Name } from "../Name.js";
import {
  TypeParameterProps,
  TypeParameters,
} from "../parameters/typeparameters.jsx";

export interface EnumDeclarationProps {
  name: string | Namekey;
  refkey?: Refkey;
  visibility?: RustVisibility;
  typeParameters?: TypeParameterProps[];
  lifetimes?: string[];
  doc?: Children;
  children?: Children;
}

/**
 * A Rust enum declaration.
 */
export function EnumDeclaration(props: EnumDeclarationProps) {
  const symbol = createTypeSymbol(props.name, "enum", {
    refkeys: props.refkey,
    visibility: props.visibility,
  });

  const typeScope = createNamedTypeScope(symbol);

  const content = memo(() => {
    if (props.children) {
      return (
        <>
          {" "}
          <Block>{props.children}</Block>
        </>
      );
    } else {
      return " {}";
    }
  });

  return (
    <>
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      <Declaration symbol={symbol}>
        {renderVisibility(props.visibility)}enum <Name />
        <TypeParameters parameters={props.typeParameters} lifetimes={props.lifetimes} />
        <Scope value={typeScope}>{content}</Scope>
      </Declaration>
    </>
  );
}

export interface EnumVariantProps {
  name: string | Namekey;
  refkey?: Refkey;
  doc?: Children;
}

/**
 * A simple enum variant (no associated data).
 */
export function EnumVariant(props: EnumVariantProps) {
  const symbol = createEnumVariantSymbol(props.name, {
    refkeys: props.refkey,
  });

  return (
    <Declaration symbol={symbol}>
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      <Name />,
    </Declaration>
  );
}

export interface TupleVariantProps {
  name: string | Namekey;
  types: Children[];
  refkey?: Refkey;
  doc?: Children;
}

/**
 * An enum variant with tuple-style associated data.
 */
export function TupleVariant(props: TupleVariantProps) {
  const symbol = createEnumVariantSymbol(props.name, {
    refkeys: props.refkey,
  });

  return (
    <Declaration symbol={symbol}>
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      <Name />({props.types.join(", ")}),
    </Declaration>
  );
}

export interface StructVariantProps {
  name: string | Namekey;
  refkey?: Refkey;
  doc?: Children;
  children?: Children;
}

/**
 * An enum variant with struct-style associated data.
 * Children should be StructField components.
 */
export function StructVariant(props: StructVariantProps) {
  const symbol = createEnumVariantSymbol(props.name, {
    refkeys: props.refkey,
  }, "struct");
  const variantScope = createNamedTypeScope(symbol);

  return (
    <Declaration symbol={symbol}>
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      <Name />
      {" "}
      <Scope value={variantScope}>
        <Block>{props.children}</Block>
      </Scope>,
    </Declaration>
  );
}
