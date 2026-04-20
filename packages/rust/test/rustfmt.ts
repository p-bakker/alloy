import { execFileSync } from "child_process";

/**
 * The Rust editions supported by stable rustfmt. Single source of truth
 * for the set of editions that {@link checkRustfmt} and
 * {@link checkRustfmtAllEditions} can target. When a future edition
 * (e.g. "2027") stabilises, append it here and bump the
 * `RustFormatOptions.edition` union in sync to keep the two aligned.
 */
export const SUPPORTED_EDITIONS = ["2015", "2018", "2021", "2024"] as const;

/**
 * A Rust edition string accepted by rustfmt's `--edition` flag.
 * Derived from {@link SUPPORTED_EDITIONS} so it cannot drift.
 */
export type Edition = (typeof SUPPORTED_EDITIONS)[number];

/**
 * Options accepted by {@link rustfmt} and {@link checkRustfmt}.
 */
export interface RustfmtRunOptions {
  /** Rust edition to pass to rustfmt via `--edition`. Defaults to `"2024"`. */
  edition?: Edition;
}

/**
 * Formats Rust source code using rustfmt.
 *
 * @param source - Rust source code string (must be valid top-level items)
 * @param options - Optional rustfmt invocation options (e.g. edition).
 * @returns The rustfmt-formatted output
 * @throws If rustfmt is not installed or the source is not valid Rust
 */
export function rustfmt(source: string, options: RustfmtRunOptions = {}): string {
  const edition: Edition = options.edition ?? "2024";
  try {
    const result = execFileSync("rustfmt", ["--emit", "stdout", "--edition", edition], {
      input: source,
      encoding: "utf-8",
      timeout: 5000,
    });
    return result;
  } catch (e: any) {
    if (e.stderr) {
      throw new Error(
        `rustfmt failed (edition ${edition}):\n${e.stderr}\n\nInput was:\n${source}`,
      );
    }
    throw e;
  }
}

/**
 * Checks whether a Rust source string is already rustfmt-conformant for a
 * single edition.
 *
 * Returns { pass: true } if the source is unchanged by rustfmt,
 * or { pass: false, formatted } with the rustfmt output if it differs.
 */
export function checkRustfmt(
  source: string,
  options: RustfmtRunOptions = {},
): { pass: true } | { pass: false; formatted: string } {
  const formatted = rustfmt(source, options);
  if (formatted === source) {
    return { pass: true };
  }
  return { pass: false, formatted };
}

/**
 * Asserts that a Rust source string is rustfmt-conformant across every
 * supplied edition (defaulting to {@link SUPPORTED_EDITIONS}).
 *
 * Stable rustfmt produces byte-identical output for every supported
 * edition today, so conformance fixtures assert against the full matrix
 * with a single call. A missing trailing newline is normalised first,
 * since rustfmt insists on one but `toSourceText` (the usual fixture
 * source) defaults it off for snapshot convenience.
 *
 * @param source - Rust source code to check.
 * @param editions - Optional subset of editions to check. Defaults to
 *   {@link SUPPORTED_EDITIONS}.
 * @throws If any edition produces a diff. The error message includes the
 *   offending edition, the expected rustfmt output, and the received
 *   source so the failure is self-contained.
 */
export function checkRustfmtAllEditions(
  source: string,
  editions: readonly Edition[] = SUPPORTED_EDITIONS,
): void {
  // Rustfmt insists every source file end with `\n`. The real emitter
  // pipeline (`insertFinalNewLine` defaults to `true` in core) always
  // satisfies this, but `toSourceText` flips that default off so its
  // snapshot assertions stay newline-free. Normalise here so conformance
  // tests check content equivalence, not trailing-whitespace defaults.
  const normalised = source.endsWith("\n") ? source : `${source}\n`;
  for (const edition of editions) {
    const result = checkRustfmt(normalised, { edition });
    if (!result.pass) {
      throw new Error(
        `Source is not rustfmt-conformant for edition ${edition}.\n\n` +
          `Expected (rustfmt output):\n${result.formatted}\n\n` +
          `Received:\n${normalised}`,
      );
    }
  }
}
