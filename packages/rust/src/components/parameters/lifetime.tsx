import { Children } from "@alloy-js/core";

export interface LifetimeProps {
  name: string;
}

/**
 * A Rust lifetime parameter.
 * Renders 'a, 'b, 'static, etc.
 */
export function Lifetime(props: LifetimeProps) {
  return <>'{props.name}</>;
}
