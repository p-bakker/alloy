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
 * A rustfmt configuration override, keyed by rustfmt config key
 * (snake_case). Each entry becomes a `--config key=value` flag.
 */
export type RustfmtConfig = Record<string, string | number | boolean>;

/**
 * Options accepted by {@link rustfmt} and {@link checkRustfmt}.
 */
export interface RustfmtRunOptions {
  /** Rust edition to pass to rustfmt via `--edition`. Defaults to `"2024"`. */
  edition?: Edition;
  /** rustfmt config overrides passed via `--config`. */
  config?: RustfmtConfig;
}

function formatConfigOverrides(config: RustfmtConfig | undefined): string[] {
  if (!config) return [];
  const args: string[] = [];
  for (const [key, value] of Object.entries(config)) {
    args.push("--config", `${key}=${value}`);
  }
  return args;
}

function describeConfig(config: RustfmtConfig | undefined): string {
  if (!config) return "";
  const entries = Object.entries(config)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  return entries.length > 0 ? ` with config { ${entries} }` : "";
}

/**
 * Formats Rust source code using rustfmt.
 *
 * @param source - Rust source code string (must be valid top-level items)
 * @param options - Optional rustfmt invocation options (e.g. edition).
 * @returns The rustfmt-formatted output
 * @throws If rustfmt is not installed or the source is not valid Rust
 */
export function rustfmt(
  source: string,
  options: RustfmtRunOptions = {},
): string {
  const edition: Edition = options.edition ?? "2024";
  const configArgs = formatConfigOverrides(options.config);
  try {
    const result = execFileSync(
      "rustfmt",
      ["--emit", "stdout", "--edition", edition, ...configArgs],
      {
        input: source,
        encoding: "utf-8",
        timeout: 5000,
      },
    );
    return result;
  } catch (e: any) {
    if (e.stderr) {
      throw new Error(
        `rustfmt failed (edition ${edition}${describeConfig(options.config)}):\n${e.stderr}\n\nInput was:\n${source}`,
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
 * Options accepted by {@link checkRustfmtAllEditions}.
 */
export interface CheckRustfmtAllEditionsOptions {
  /** Subset of editions to check. Defaults to {@link SUPPORTED_EDITIONS}. */
  editions?: readonly Edition[];
  /**
   * rustfmt config overrides applied to every edition in the matrix.
   * Keys are rustfmt config names (snake_case); each entry is passed
   * through as `--config key=value`.
   */
  config?: RustfmtConfig;
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
 * @param options - Optional edition subset and/or rustfmt config
 *   overrides. When omitted, checks every supported edition with
 *   rustfmt's defaults.
 * @throws If any edition produces a diff. The error message includes
 *   the offending edition, the active config overrides (if any), the
 *   expected rustfmt output, and the received source so the failure is
 *   self-contained.
 */
export function checkRustfmtAllEditions(
  source: string,
  options: CheckRustfmtAllEditionsOptions = {},
): void {
  const editions = options.editions ?? SUPPORTED_EDITIONS;
  const config = options.config;
  // Rustfmt insists every source file end with `\n`. The real emitter
  // pipeline (`insertFinalNewLine` defaults to `true` in core) always
  // satisfies this, but `toSourceText` flips that default off so its
  // snapshot assertions stay newline-free. Normalise here so conformance
  // tests check content equivalence, not trailing-whitespace defaults.
  const normalised = source.endsWith("\n") ? source : `${source}\n`;
  for (const edition of editions) {
    const result = checkRustfmt(normalised, { edition, config });
    if (!result.pass) {
      throw new Error(
        `Source is not rustfmt-conformant for edition ${edition}${describeConfig(config)}.\n\n` +
          `Expected (rustfmt output):\n${result.formatted}\n\n` +
          `Received:\n${normalised}`,
      );
    }
  }
}
