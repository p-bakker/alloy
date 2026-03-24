import { Children } from "@alloy-js/core";

export interface CfgProps {
  feature?: string;
  test?: boolean;
  targetOs?: string;
  not?: Children;
  any?: Children[];
  all?: Children[];
  children?: Children;
}

/**
 * Renders a `#[cfg(...)]` conditional compilation attribute.
 */
export function Cfg(props: CfgProps) {
  const expr = renderCfgExpression(props);
  return <>#[cfg({expr})]{"\n"}</>;
}

/**
 * Renders a `#[cfg_attr(condition, attribute)]` attribute.
 */
export interface CfgAttrProps {
  condition: Children;
  attribute: Children;
}

export function CfgAttr(props: CfgAttrProps) {
  return <>#[cfg_attr({props.condition}, {props.attribute})]{"\n"}</>;
}

function renderCfgExpression(props: CfgProps): Children {
  if (props.children) {
    return props.children;
  }

  if (props.feature) {
    return `feature = "${props.feature}"`;
  }

  if (props.test) {
    return "test";
  }

  if (props.targetOs) {
    return `target_os = "${props.targetOs}"`;
  }

  if (props.not) {
    return <>not({props.not})</>;
  }

  if (props.any && props.any.length > 0) {
    return <>any({renderList(props.any)})</>;
  }

  if (props.all && props.all.length > 0) {
    return <>all({renderList(props.all)})</>;
  }

  return "";
}

function renderList(items: Children[]): Children {
  return items.map((item, i) => (
    <>{item}{i < items.length - 1 ? ", " : ""}</>
  ));
}
