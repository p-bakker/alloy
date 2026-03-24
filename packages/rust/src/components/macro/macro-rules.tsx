import { Block, Children } from "@alloy-js/core";
import { RustVisibility } from "../../symbols/rust.js";
import { Attribute } from "../attribute/attribute.jsx";

export interface MacroRulesProps {
  name: string;
  visibility?: RustVisibility;
  children?: Children;
}

/**
 * A Rust macro_rules! declaration.
 *
 * When visibility is "pub", emits a `#[macro_export]` attribute before the macro.
 *
 * @example
 * ```rust
 * #[macro_export]
 * macro_rules! my_vec {
 *     ( $( $x:expr ),* ) => {
 *         {
 *             let mut temp_vec = Vec::new();
 *             $( temp_vec.push($x); )*
 *             temp_vec
 *         }
 *     };
 * }
 * ```
 */
export function MacroRules(props: MacroRulesProps) {
  const exportAttr =
    props.visibility === "pub" ?
<Attribute>macro_export</Attribute>
    : null;

  return (
    <>
      {exportAttr}
      macro_rules! {props.name} {!props.children ?
        "{}"
      : <Block>{props.children}</Block>}
    </>
  );
}
