import type { Children } from "@alloy-js/core";

import { ensureLabelTick } from "./label.js";
import { RustBlock } from "./primitives/rust-block.js";

export interface WhileExpressionProps {
  condition: Children;
  label?: string;
  children?: Children;
}

export function WhileExpression(props: WhileExpressionProps) {
  return (
    <>
      {props.label ? (
        <>
          {ensureLabelTick(props.label)}
          {": "}
        </>
      ) : null}
      {"while "}
      {props.condition}
      <RustBlock>{props.children}</RustBlock>
    </>
  );
}
