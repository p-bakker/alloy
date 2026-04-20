import {
  useRustFormatOptions,
  type RustFormatOptions,
} from "./format-options.js";

/**
 * The eight rustfmt width heuristics, expressed as concrete column
 * counts. Components read these to decide whether a construct fits on
 * one line under the current format options.
 */
export interface ResolvedHeuristics {
  /** Effective `fn_call_width`. */
  fnCallWidth: number;
  /** Effective `attr_fn_like_width`. */
  attrFnLikeWidth: number;
  /** Effective `struct_lit_width`. */
  structLitWidth: number;
  /** Effective `struct_variant_width`. */
  structVariantWidth: number;
  /** Effective `array_width`. */
  arrayWidth: number;
  /** Effective `chain_width`. */
  chainWidth: number;
  /** Effective `single_line_if_else_max_width`. */
  singleLineIfElseMaxWidth: number;
  /** Effective `single_line_let_else_max_width`. */
  singleLineLetElseMaxWidth: number;
}

/**
 * Per-heuristic percentages of `maxWidth` that rustfmt applies under
 * `useSmallHeuristics = "Default"`. Mirrors the defaults rustfmt ships.
 */
const PERCENTAGES: Record<keyof ResolvedHeuristics, number> = {
  fnCallWidth: 0.6,
  attrFnLikeWidth: 0.7,
  structLitWidth: 0.18,
  structVariantWidth: 0.35,
  arrayWidth: 0.6,
  chainWidth: 0.6,
  singleLineIfElseMaxWidth: 0.5,
  singleLineLetElseMaxWidth: 0.5,
};

/**
 * Pure resolver: compute the eight heuristics from an explicit
 * `RustFormatOptions` object. Prefer {@link useResolvedHeuristics} when
 * inside a component tree; this function exists for unit tests and
 * callers that already hold an options object.
 *
 * Resolution rules:
 * - An explicit per-heuristic override wins for that one field.
 * - Otherwise, `useSmallHeuristics` drives the computation:
 *   - `"Default"` (or unset) → `round(maxWidth × percentage)` per heuristic.
 *   - `"Off"` → `maxWidth` for every heuristic. Semantically the
 *     heuristic does not narrow the bound; numerically it resolves to
 *     `maxWidth`.
 *   - `"Max"` → `maxWidth` for every heuristic.
 * - `maxWidth` itself defaults to `100` when unset, matching rustfmt.
 */
export function resolveHeuristics(opts: RustFormatOptions): ResolvedHeuristics {
  const maxWidth = opts.maxWidth ?? 100;
  const strategy = opts.useSmallHeuristics ?? "Default";

  const result: Partial<ResolvedHeuristics> = {};
  for (const key of Object.keys(PERCENTAGES) as Array<
    keyof ResolvedHeuristics
  >) {
    const override = opts[key];
    if (override !== undefined) {
      result[key] = override;
      continue;
    }
    result[key] =
      strategy === "Default"
        ? Math.round(maxWidth * PERCENTAGES[key])
        : maxWidth;
  }
  return result as ResolvedHeuristics;
}

/**
 * Context hook: resolve the eight width heuristics against the
 * ambient Rust format options. See {@link resolveHeuristics} for the
 * resolution rules.
 */
export function useResolvedHeuristics(): ResolvedHeuristics {
  const opts = useRustFormatOptions();
  return resolveHeuristics(opts);
}
