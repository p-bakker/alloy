import { Children } from "@alloy-js/core";

export interface AttributeProps {
  children: Children;
}

/**
 * A Rust outer attribute (#[...]).
 *
 * This component supports all attribute forms including proc macro attributes:
 *
 * @example Standard attributes
 * ```tsx
 * <Attribute>allow(dead_code)</Attribute>         // #[allow(dead_code)]
 * <Attribute>cfg(target_os = "linux")</Attribute>  // #[cfg(target_os = "linux")]
 * ```
 *
 * @example Proc macro derive helper attributes
 * ```tsx
 * <Attribute>serde(rename_all = "camelCase")</Attribute>  // #[serde(rename_all = "camelCase")]
 * <Attribute>sqlx(rename = "user_id")</Attribute>          // #[sqlx(rename = "user_id")]
 * ```
 *
 * @example Attribute proc macros
 * ```tsx
 * <Attribute>tokio::main</Attribute>        // #[tokio::main]
 * <Attribute>get("/api/users")</Attribute>   // #[get("/api/users")]
 * <Attribute>test</Attribute>               // #[test]
 * ```
 */
export function Attribute(props: AttributeProps) {
  return <>#[{props.children}]{"\n"}</>;
}

export interface InnerAttributeProps {
  children: Children;
}

/**
 * A Rust inner attribute (#![...]).
 */
export function InnerAttribute(props: InnerAttributeProps) {
  return <>#![{props.children}]{"\n"}</>;
}
