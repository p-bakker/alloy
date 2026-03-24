import { Block, Children } from "@alloy-js/core";
import { RustVisibility } from "../../symbols/rust.js";
import { renderVisibility } from "../visibility/visibility.js";

export interface ModDeclarationProps {
  name: string;
  visibility?: RustVisibility;
  path?: string;
}

export function ModDeclaration(props: ModDeclarationProps) {
  const vis = renderVisibility(props.visibility);
  const pathAttr = props.path ? <>{"#[path = "}{`"${props.path}"`}{"]"}<hbr /></> : undefined;

  return (
    <>
      {pathAttr}{vis}mod {props.name};
    </>
  );
}

export interface ModBlockProps {
  name: string;
  visibility?: RustVisibility;
  children?: Children;
}

export function ModBlock(props: ModBlockProps) {
  const vis = renderVisibility(props.visibility);

  return (
    <>
      {vis}mod {props.name} {props.children ? <Block>{props.children}</Block> : <>{"{"}<hbr />{"}"}</>}
    </>
  );
}
