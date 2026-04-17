import { execFileSync } from "child_process";

/**
 * Formats Rust source code using rustfmt.
 *
 * @param source - Rust source code string (must be valid top-level items)
 * @returns The rustfmt-formatted output
 * @throws If rustfmt is not installed or the source is not valid Rust
 */
export function rustfmt(source: string): string {
  try {
    const result = execFileSync(
      "rustfmt",
      ["--emit", "stdout", "--edition", "2024"],
      {
        input: source,
        encoding: "utf-8",
        timeout: 5000,
      },
    );
    return result;
  } catch (e: any) {
    if (e.stderr) {
      throw new Error(`rustfmt failed:\n${e.stderr}\n\nInput was:\n${source}`);
    }
    throw e;
  }
}

/**
 * Checks whether a Rust source string is already rustfmt-conformant.
 * Returns { pass: true } if the source is unchanged by rustfmt,
 * or { pass: false, formatted } with the rustfmt output if it differs.
 */
export function checkRustfmt(
  source: string,
): { pass: true } | { pass: false; formatted: string } {
  const formatted = rustfmt(source);
  if (formatted === source) {
    return { pass: true };
  }
  return { pass: false, formatted };
}
