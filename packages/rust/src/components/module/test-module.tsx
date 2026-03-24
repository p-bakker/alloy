import { Block, Children } from "@alloy-js/core";

export interface TestModuleProps {
  children: Children;
}

/**
 * A Rust test module: `#[cfg(test)] mod tests { use super::*; ... }`.
 */
export function TestModule(props: TestModuleProps) {
  return (
    <>
      #[cfg(test)]
      <hbr />
      mod tests <Block>
        {props.children}
      </Block>
    </>
  );
}
