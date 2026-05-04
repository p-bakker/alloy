import type { NamePolicy } from "@alloy-js/core";
import { createNamePolicy, useNamePolicy } from "@alloy-js/core";
import { constantCase, pascalCase, snakeCase } from "change-case";

export type RustElements =
  | "function"
  | "method"
  | "struct"
  | "enum"
  | "enum-variant"
  | "trait"
  | "type-alias"
  | "type-parameter"
  | "field"
  | "variable"
  | "parameter"
  | "constant"
  | "module";

const RESERVED_WORDS = new Set([
  "as",
  "async",
  "await",
  "break",
  "const",
  "continue",
  "crate",
  "dyn",
  "else",
  "enum",
  "extern",
  "false",
  "fn",
  "for",
  "if",
  "impl",
  "in",
  "let",
  "loop",
  "match",
  "mod",
  "move",
  "mut",
  "pub",
  "ref",
  "return",
  "self",
  "Self",
  "static",
  "struct",
  "super",
  "trait",
  "true",
  "type",
  "unsafe",
  "use",
  "where",
  "while",
  "yield",
]);

function ensureNonReservedName(name: string): string {
  if (RESERVED_WORDS.has(name)) {
    return `r#${name}`;
  }

  return name;
}

export function createRustNamePolicy(): NamePolicy<RustElements> {
  return createNamePolicy((name, element) => {
    // `_` is Rust's anonymous-binding name — legal as a let pattern,
    // a `const _: T = …;` / `static _: T = …;` declaration that runs
    // compile-time assertions, a function parameter you don't read,
    // etc. Pass it through unchanged: no case transform (which would
    // strip the underscore to an empty string), no reserved-word
    // escaping (`_` isn't reserved, and `r#_` isn't valid Rust).
    if (name === "_") return name;

    let transformedName: string;

    switch (element) {
      case "struct":
      case "enum":
      case "enum-variant":
      case "trait":
      case "type-alias":
      case "type-parameter":
        transformedName = pascalCase(name);
        break;
      case "constant":
        transformedName = constantCase(name);
        break;
      default:
        transformedName = snakeCase(name);
        break;
    }

    return ensureNonReservedName(transformedName);
  });
}

export function useRustNamePolicy(): NamePolicy<RustElements> {
  return useNamePolicy();
}
