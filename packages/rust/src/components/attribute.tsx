import type { Children, Refkey } from "@alloy-js/core";

import { Reference } from "./reference.js";

export interface AttributeProps {
  name: string | Refkey;
  args?: Children;
}

export interface InnerAttributeProps {
  name: string | Refkey;
  args?: Children;
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
  args?: Children;
}

function AttributeBase(props: AttributeBaseProps) {
  return (
    <>
      {props.marker}
      {typeof props.name === "string" ? (
        props.name
      ) : (
        <Reference refkey={props.name} />
      )}
      {props.args !== undefined ? (
        <>
          {"("}
          {props.args}
          {")"}
        </>
      ) : null}
      {"]"}
    </>
  );
}
