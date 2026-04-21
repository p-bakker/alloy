import type { Children } from "@alloy-js/core";

import { ensureLabelTick } from "./label.js";
import { RustBlock } from "./primitives/rust-block.js";

export interface ForExpressionProps {
  pattern: Children;
  iterator: Children;
  label?: string;
  children?: Children;
}

export function ForExpression(props: ForExpressionProps) {
  return (
    <>
      {props.label ? (
        <>
          {ensureLabelTick(props.label)}
          {": "}
        </>
      ) : null}
      {"for "}
      {props.pattern}
      {" in "}
      {props.iterator}
      <RustBlock>{props.children}</RustBlock>
    </>
  );
}
