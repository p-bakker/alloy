import type { Children } from "@alloy-js/core";

import { RustBlock } from "./primitives/rust-block.js";

export interface BlockExpressionProps {
  children?: Children;
}

export function BlockExpression(props: BlockExpressionProps) {
  return <RustBlock leadingSpace={false}>{props.children}</RustBlock>;
}
