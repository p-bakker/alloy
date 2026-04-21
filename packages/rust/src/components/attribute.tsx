import type { Children, Refkey } from "@alloy-js/core";
import { For } from "@alloy-js/core";

import { ArgList } from "./primitives/arg-list.js";

export interface AttributeProps {
  name: string | Refkey;
  args?: Children | Children[];
}

export interface InnerAttributeProps {
  name: string | Refkey;
  args?: Children | Children[];
}

export function Attribute(props: AttributeProps) {
  return <AttributeBase marker="#[" name={props.name} args={props.args} />;
}

export function InnerAttribute(props: InnerAttributeProps) {
  return <AttributeBase marker="#![" name={props.name} args={props.args} />;
}

interface AttributeBaseProps {
  marker: "#[" | "#![";
  name: string | Refkey;
  args?: Children | Children[];
}

/**
 * Renders a list of attribute entries. A bare string is wrapped as
 * `#[<name>]`; anything else renders as-is.
 */
export function AttributeList(props: { attributes?: Children[] }) {
  const items = props.attributes;
  if (!items || items.length === 0) return null;
  return (
    <>
      <For each={items} joiner={""}>
        {(attr) =>
          typeof attr === "string" ? <Attribute name={attr} /> : attr
        }
      </For>
    </>
  );
}

function AttributeBase(props: AttributeBaseProps) {
  return (
    <>
      {props.marker}
      {props.name}
      {props.args !== undefined ? (
        <ArgList trailingComma={false} heuristic="attrFnLikeWidth">
          {props.args}
        </ArgList>
      ) : null}
      {"]"}
      <hbr />
    </>
  );
}
