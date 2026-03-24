import { createNamePolicy, NamePolicy, useNamePolicy } from "@alloy-js/core";
import { constantCase, pascalCase, snakeCase } from "change-case";

export type RustElements =
  | "type"
  | "trait"
  | "enum-variant"
  | "function"
  | "method"
  | "variable"
  | "parameter"
  | "struct-field"
  | "constant"
  | "static"
  | "module"
  | "type-parameter"
  | "lifetime";

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
  // reserved for future use
  "abstract",
  "become",
  "box",
  "do",
  "final",
  "macro",
  "override",
  "priv",
  "try",
  "typeof",
  "unsized",
  "virtual",
]);

function transformName(name: string, element: RustElements): string {
  // `_` is a wildcard/discard pattern — never transform it
  if (name === "_") return name;

  switch (element) {
    case "type":
    case "trait":
    case "enum-variant":
    case "type-parameter":
      return pascalCase(name);
    case "function":
    case "method":
    case "variable":
    case "parameter":
    case "struct-field":
    case "module":
    case "lifetime":
      return snakeCase(name);
    case "constant":
    case "static":
      return constantCase(name);
    default:
      return name;
  }
}

function ensureNonReservedName(name: string): string {
  if (RESERVED_WORDS.has(name)) {
    return `${name}_`;
  }
  return name;
}

export function createRustNamePolicy(): NamePolicy<RustElements> {
  return createNamePolicy((name, element) => {
    const transformed = transformName(name, element);
    return ensureNonReservedName(transformed);
  });
}

export function useRustNamePolicy(): NamePolicy<RustElements> {
  return useNamePolicy();
}
