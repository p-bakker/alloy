import { Children } from "@alloy-js/core";

export interface MemberAccessProps {
  receiver: Children;
  member: Children;
}

export function MemberAccess(props: MemberAccessProps) {
  return <>{props.receiver}.{props.member}</>;
}
