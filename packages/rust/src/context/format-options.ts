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
}

/** Defaults applied by the Rust format-options provider. */
export const DEFAULT_RUST_FORMAT_OPTIONS: RustFormatOptions = {
  maxWidth: 100,
  tabSpaces: 4,
};

/**
 * Adapter: convert a Rust-shape options object into the core
 * `CommonFormatOptions` shape, renaming the two fields rustfmt has its
 * own name for and spreading everything else through.
 */
export function toCommonFormatOptions(
  opts: RustFormatOptions,
): CommonFormatOptions {
  const { maxWidth, tabSpaces, ...rest } = opts;
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
