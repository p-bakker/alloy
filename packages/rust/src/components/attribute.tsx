import { Children, Refkey } from "@alloy-js/core";

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
      {props.name}
      {props.args !== undefined ?
        <>
          {"("}
          {props.args}
          {")"}
        </>
      : null}
      {"]"}
    </>
  );
}
