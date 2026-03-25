import { OutputSymbolOptions, createSymbol } from "@alloy-js/core";
import { join } from "pathe";
import { NamedTypeSymbol } from "./named-type.js";

export interface CrateCargoMetadata {
  version: string;
  features?: string[];
  defaultFeatures?: boolean;
  optional?: boolean;
}

export interface CrateSymbolOptions extends OutputSymbolOptions {
  path?: string;
  builtin?: boolean;
  cargoMetadata?: CrateCargoMetadata;
}

/**
 * A symbol for a crate or module in Rust.
 */
export class CrateSymbol extends NamedTypeSymbol {
  public readonly symbolKind = "crate";
  constructor(
    name: string,
    parentCrate?: CrateSymbol,
    options?: CrateSymbolOptions,
  ) {
    const space = parentCrate?.members;
    super(name, space, "crate", options);
    this.#path = options?.path ?? name;
    if (parentCrate) {
      this.#fullyQualifiedName = join(
        parentCrate.fullyQualifiedName,
        this.#path,
      );
    } else {
      this.#fullyQualifiedName = this.#path;
    }
    this.#builtin = options?.builtin || parentCrate?.builtin || false;
    this.#cargoMetadata = options?.cargoMetadata;
  }

  #path: string;
  #fullyQualifiedName: string;
  get fullyQualifiedName(): string {
    return this.#fullyQualifiedName;
  }

  #builtin: boolean;
  get builtin() {
    return this.#builtin;
  }

  #cargoMetadata?: CrateCargoMetadata;
  get cargoMetadata(): CrateCargoMetadata | undefined {
    return this.#cargoMetadata;
  }

  copy() {
    const options = this.getRustCopyOptions();
    const copy = createSymbol(CrateSymbol, this.name, undefined, {
      ...options,
      path: this.#path,
    });
    this.initializeRustCopy(copy);
    return copy;
  }
}
