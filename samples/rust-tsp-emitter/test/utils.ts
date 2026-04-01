import { compile, NodeHost, type Program } from "@typespec/compiler";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  extractProgram,
  type RichTypesOption,
  type TspProgram,
} from "../src/tsp-reader.js";

let tmpCounter = 0;

/**
 * Compile a TypeSpec string and extract the program.
 */
export async function compileTsp(
  tspSource: string,
  richTypes: RichTypesOption = true,
): Promise<TspProgram> {
  const program = await compileTspToProgram(tspSource);
  return extractProgram(program, richTypes);
}

/**
 * Compile a TypeSpec string to a raw Program (for lower-level tests).
 */
export async function compileTspToProgram(
  tspSource: string,
): Promise<Program> {
  const dir = join(tmpdir(), `rust-tsp-emitter-test-${Date.now()}-${tmpCounter++}`);
  mkdirSync(dir, { recursive: true });

  const mainFile = join(dir, "main.tsp");
  writeFileSync(mainFile, tspSource);

  try {
    const program = await compile(NodeHost, mainFile, { noEmit: true });

    const errors = program.diagnostics.filter((d) => d.severity === "error");
    if (errors.length > 0) {
      throw new Error(
        `TypeSpec compilation failed:\n${errors.map((d) => d.message).join("\n")}`,
      );
    }

    return program;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
