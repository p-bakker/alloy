import {
  Children,
  Declaration,
  Namekey,
  Refkey,
  Show,
} from "@alloy-js/core";
import { createTypeSymbol } from "../../symbols/factories.js";
import { RustVisibility } from "../../symbols/rust.js";
import { renderVisibility } from "../visibility/visibility.js";
import { DocComment } from "../doc/comment.js";
import { Name } from "../Name.js";
import {
  TypeParameterProps,
  TypeParameters,
} from "../parameters/typeparameters.jsx";

export interface TypeAliasProps {
  name: string | Namekey;
  refkey?: Refkey;
  visibility?: RustVisibility;
  typeParameters?: TypeParameterProps[];
  doc?: Children;
  children: Children;
}

/**
 * A Rust type alias declaration.
 * @example
 * ```tsx
 * <TypeAlias name="Result" visibility="pub">MyResult&lt;T, MyError&gt;</TypeAlias>
 * ```
 * Produces:
 * ```rust
 * pub type Result = MyResult<T, MyError>;
 * ```
 */
export function TypeAlias(props: TypeAliasProps) {
  const symbol = createTypeSymbol(props.name, "type", {
    refkeys: props.refkey,
    visibility: props.visibility,
  });

  return (
    <>
      <Show when={Boolean(props.doc)}>
        <DocComment children={props.doc} />
        <hbr />
      </Show>
      <Declaration symbol={symbol}>
        {renderVisibility(props.visibility)}type <Name />
        <TypeParameters parameters={props.typeParameters} />
        {" "}= {props.children};
      </Declaration>
    </>
  );
}
