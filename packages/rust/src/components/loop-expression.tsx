import type { Children } from "@alloy-js/core";

import { ensureLabelTick } from "./label.js";
import { RustBlock } from "./primitives/rust-block.js";

export interface LoopExpressionProps {
  label?: string;
  children?: Children;
}

export function LoopExpression(props: LoopExpressionProps) {
  return (
    <>
      {props.label ? (
        <>
          {ensureLabelTick(props.label)}
          {": "}
        </>
      ) : null}
      {"loop"}
      <RustBlock>{props.children}</RustBlock>
    </>
  );
}
