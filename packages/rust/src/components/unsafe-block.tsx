import type { Children } from "@alloy-js/core";

import { RustBlock } from "./primitives/rust-block.js";

export interface UnsafeBlockProps {
  children?: Children;
}

export function UnsafeBlock(props: UnsafeBlockProps) {
  return (
    <>
      {"unsafe"}
      <RustBlock>{props.children}</RustBlock>
    </>
  );
}
