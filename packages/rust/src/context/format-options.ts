import type { CommonFormatOptions } from "@alloy-js/core";
import { createFormatOptionsContextFor } from "@alloy-js/core";

/**
 * Rust-specific, rustfmt-aligned format options.
 *
 * Extends core's `CommonFormatOptions` with `printWidth` and
 * `tabWidth` removed and re-exposed under their rustfmt-aligned names
 * (`maxWidth` and `tabSpaces`). Every other field on
 * `CommonFormatOptions` / `PrintTreeOptions` flows through unchanged,
 * so future core additions reach Rust users without a mapping slice.
 */
export interface RustFormatOptions extends Omit<
  CommonFormatOptions,
  "printWidth" | "tabWidth"
> {
  /** rustfmt `max_width` (core `printWidth`). Defaults to 100. */
  maxWidth?: number;
  /** rustfmt `tab_spaces` (core `tabWidth`). Defaults to 4. */
  tabSpaces?: number;

  /**
   * Resolution strategy for the eight width heuristics.
   * - `"Default"`: each heuristic resolves to a per-construct percentage of `maxWidth`.
   * - `"Off"`:     heuristics disabled; each resolves to `maxWidth`.
   * - `"Max"`:     each heuristic resolves to `maxWidth`.
   *
   * Explicit per-heuristic overrides below win regardless of this setting.
   */
  useSmallHeuristics?: "Default" | "Off" | "Max";

  /** Override for rustfmt `fn_call_width`. Defaults to 60% of `maxWidth` when unset. */
  fnCallWidth?: number;
  /** Override for rustfmt `attr_fn_like_width`. Defaults to 70% of `maxWidth` when unset. */
  attrFnLikeWidth?: number;
  /** Override for rustfmt `struct_lit_width`. Defaults to 18% of `maxWidth` when unset. */
  structLitWidth?: number;
  /** Override for rustfmt `struct_variant_width`. Defaults to 35% of `maxWidth` when unset. */
  structVariantWidth?: number;
  /** Override for rustfmt `array_width`. Defaults to 60% of `maxWidth` when unset. */
  arrayWidth?: number;
  /** Override for rustfmt `chain_width`. Defaults to 60% of `maxWidth` when unset. */
  chainWidth?: number;
  /** Override for rustfmt `single_line_if_else_max_width`. Defaults to 50% of `maxWidth` when unset. */
  singleLineIfElseMaxWidth?: number;
  /** Override for rustfmt `single_line_let_else_max_width`. Defaults to 50% of `maxWidth` when unset. */
  singleLineLetElseMaxWidth?: number;

  /**
   * rustfmt `short_array_element_width_threshold`. Array element width
   * below which packing is allowed. Fixed integer (not a percentage of
   * `maxWidth`). Defaults to 10.
   */
  shortArrayElementWidthThreshold?: number;

  /**
   * rustfmt `fn_params_layout`. `"Tall"` — default fit-or-break: short
   * signatures stay flat, long ones break one-per-line. `"Vertical"` —
   * always break, even when the flat form fits. rustfmt's
   * `"Compressed"` (fill-style horizontal packing) is deferred.
   */
  fnParamsLayout?: "Tall" | "Vertical";

  /**
   * Emitter-policy options that influence rendering but don't
   * correspond to a rustfmt configuration key. Grouped under their own
   * sub-object so "emitter.<name>" reads clearly in documentation and
   * so future emitter knobs (`emitter.groupImportsByOrigin`, …) slot in
   * beside `autoBlankLines` without cluttering the top level.
   */
  emitter?: RustEmitterOptions;
}

/**
 * Emitter-policy sub-object on `RustFormatOptions`. These fields
 * influence how the Rust emitter lays out output at seams rustfmt
 * doesn't have an opinion about, and live apart from the rustfmt-
 * aligned fields so the two groups never get confused.
 */
export interface RustEmitterOptions {
  /**
   * When true (default), the Rust emitter auto-inserts a single blank
   * line at the idiomatic places: between top-level items in a source
   * file (where the two adjacent items are not both the same
   * "packable" kind — `const`, `static`, `type`), and between methods
   * or between associated-item groups in `impl` and `trait` bodies. A
   * manual break already authored by the caller suppresses the
   * auto-insertion at that seam.
   *
   * Detection is shallow — opaque user components whose output ends in
   * a hardline are not inspected. If a user wraps items in such
   * components and gets doubled blank lines as a result, they can set
   * this flag to false to fall back to the legacy single-hardline
   * joining.
   */
  autoBlankLines?: boolean;
}

/** Defaults applied by the Rust format-options provider. */
export const DEFAULT_RUST_FORMAT_OPTIONS: RustFormatOptions = {
  maxWidth: 100,
  tabSpaces: 4,
  useSmallHeuristics: "Default",
  shortArrayElementWidthThreshold: 10,
  fnParamsLayout: "Tall",
  emitter: { autoBlankLines: true },
};

/**
 * Adapter: convert a Rust-shape options object into the core
 * `CommonFormatOptions` shape, renaming the two fields rustfmt has its
 * own name for and spreading everything else through.
 */
export function toCommonFormatOptions(
  opts: RustFormatOptions,
): CommonFormatOptions {
  const {
    maxWidth,
    tabSpaces,
    // Rust-only fields that have no core equivalent — stripped so they
    // don't leak into the core-facing options object.
    useSmallHeuristics: _useSmallHeuristics,
    fnCallWidth: _fnCallWidth,
    attrFnLikeWidth: _attrFnLikeWidth,
    structLitWidth: _structLitWidth,
    structVariantWidth: _structVariantWidth,
    arrayWidth: _arrayWidth,
    chainWidth: _chainWidth,
    singleLineIfElseMaxWidth: _singleLineIfElseMaxWidth,
    singleLineLetElseMaxWidth: _singleLineLetElseMaxWidth,
    shortArrayElementWidthThreshold: _shortArrayElementWidthThreshold,
    fnParamsLayout: _fnParamsLayout,
    emitter: _emitter,
    ...rest
  } = opts;
  const result: CommonFormatOptions = { ...rest };
  if (maxWidth !== undefined) {
    result.printWidth = maxWidth;
  }
  if (tabSpaces !== undefined) {
    result.tabWidth = tabSpaces;
  }
  return result;
}

export const {
  Provider: RustFormatOptions,
  useFormatOptions: useRustFormatOptions,
} = createFormatOptionsContextFor<RustFormatOptions>(
  "rust",
  DEFAULT_RUST_FORMAT_OPTIONS,
);
