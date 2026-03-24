import { execSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  Children,
  ContentOutputFile,
  Output,
  OutputDirectory,
  OutputFile,
  PrintTreeOptions,
  render,
} from "@alloy-js/core";
import { dedent } from "@alloy-js/core/testing";
import { expect } from "vitest";
import * as rust from "../src/index.js";

const hasRustfmt = (() => {
  try {
    execSync("rustfmt --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
})();

export { hasRustfmt };

export async function assertRustfmtIdempotent(
  source: string,
  options?: { edition?: "2015" | "2018" | "2021" | "2024" },
): Promise<void> {
  const edition = options?.edition ?? "2021";
  const dir = mkdtempSync(join(tmpdir(), "rustfmt-"));
  const tmpFile = join(dir, "test.rs");
  writeFileSync(tmpFile, source);
  try {
    execSync(`rustfmt --edition ${edition} --check ${tmpFile}`, {
      encoding: "utf-8",
      stdio: "pipe",
    });
  } catch (e) {
    execSync(`rustfmt --edition ${edition} ${tmpFile}`);
    const formatted = readFileSync(tmpFile, "utf-8");
    throw new Error(
      `Generated Rust does not match rustfmt output.\n\n--- Generated ---\n${source}\n--- rustfmt ---\n${formatted}\n`,
    );
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {}
  }
}

export function toSourceText(c: Children, options?: PrintTreeOptions): string {
  const res = render(
    <Output>
      <rust.SourceFile path="test.rs">{c}</rust.SourceFile>
    </Output>,
    options,
  );

  return findFile(res, "test.rs").contents;
}

export function findFile(
  res: OutputDirectory,
  path: string,
): ContentOutputFile {
  const result = findFileWorker(res, path);

  if (!result) {
    throw new Error("Expected to find file " + path);
  }
  return result as ContentOutputFile;

  function findFileWorker(
    res: OutputDirectory,
    path: string,
  ): OutputFile | null {
    for (const item of res.contents) {
      if (item.kind === "file") {
        if (item.path === path) {
          return item;
        }
        continue;
      } else {
        const found = findFileWorker(item, path);
        if (found) {
          return found;
        }
      }
    }
    return null;
  }
}

export function assertFileContents(
  res: OutputDirectory,
  expectedFiles: Record<string, string>,
) {
  for (const [path, contents] of Object.entries(expectedFiles)) {
    const file = findFile(res, path);
    expect(file.contents.trim()).toBe(dedent(contents).trim());
  }
}

/**
 * Asserts that rendered output does not contain anonymous type symbol names,
 * which should never leak into generated Rust code.
 */
export function assertNoAnonymousLeaks(output: string): void {
  const anonymousPattern = /anonymous_\d+_this_should_not_appear_in_output/;
  const match = anonymousPattern.exec(output);
  if (match) {
    throw new Error(
      `Anonymous type symbol name leaked into output: "${match[0]}". ` +
        `This indicates a bug where an anonymous symbol's internal name was rendered instead of being suppressed.`,
    );
  }
}

export function TestCrate(props: { children: Children }): Children {
  return (
    <Output>
      <rust.CrateDirectory name="test-crate">
        <rust.SourceDirectory path=".">
          <rust.SourceFile path="test.rs">{props.children}</rust.SourceFile>
        </rust.SourceDirectory>
      </rust.CrateDirectory>
    </Output>
  );
}
