import { Children, Refkey } from "@alloy-js/core";
import { RustVisibility } from "../../symbols/rust.js";
import { renderVisibility } from "../visibility/visibility.js";

export interface PubUseProps {
  path: Children;
  items?: string[];
  visibility?: RustVisibility;
  refkey?: Refkey;
}

/**
 * A Rust `pub use` re-export statement.
 *
 * Renders `pub use path::item;`, `pub use path::*;`,
 * or `pub use path::{item1, item2};` depending on the items prop.
 */
export function PubUse(props: PubUseProps) {
  const vis = renderVisibility(props.visibility ?? "pub");

  if (!props.items || props.items.length === 0) {
    return <>{vis}use {props.path};</>;
  }

  if (props.items.length === 1 && props.items[0] === "*") {
    return <>{vis}use {props.path}::*;</>;
  }

  if (props.items.length === 1) {
    return <>{vis}use {props.path}::{props.items[0]};</>;
  }

  const itemList = props.items.join(", ");
  return <>{vis}use {props.path}::{"{" + itemList + "}"};</>;
}
