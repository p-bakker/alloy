import type { Refkey } from "@alloy-js/core";
import { isRefkey, memo, resolve, type Children } from "@alloy-js/core";

/**
 * Resolve a refkey to its declaration's bare symbol name as reactive
 * `Children`. Accepts a literal string (returned as-is) or a refkey.
 *
 * Unlike `<Reference>` / the `ref()` resolver, this intentionally does NOT:
 * - emit a `use` statement for the symbol's module
 * - fall back to a fully-qualified path on conflict
 * - track a cross-crate dependency or features
 *
 * Use this where you need only the symbol's name in the emitted output —
 * e.g. derive lists, attribute names, macro names, or cfg feature names.
 *
 * For non-rendering symbol-table lookups (synchronous, returns `string`),
 * see `resolveSymbolNameFromRefkey` in `impl-block.tsx`.
 */
export function resolveSymbolName(ref: string | Refkey): Children {
  if (!isRefkey(ref)) return ref;
  const result = resolve(ref);
  return memo(() => result.value?.lexicalDeclaration.name ?? ref);
}
