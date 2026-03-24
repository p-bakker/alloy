import {
  Namekey,
  OutputDeclarationSpace,
  OutputMemberSpace,
  OutputSpace,
  OutputSymbol,
  OutputSymbolOptions,
  createSymbol,
} from "@alloy-js/core";
import { RustScope } from "../scopes/rust.js";
import { CrateSymbol } from "./crate.js";

export type RustVisibility = "pub" | "pub(crate)" | "pub(super)" | "private" | { pubIn: string };

export interface RustSymbolOptions extends OutputSymbolOptions {
  visibility?: RustVisibility;
}

export type RustSymbolKinds =
  | "symbol"
  | "named-type"
  | "function"
  | "field"
  | "crate";

/**
 * Base type for all symbols in Rust.
 */
export class RustSymbol extends OutputSymbol {
  #visibility: RustVisibility;

  constructor(
    name: string | Namekey,
    spaces: OutputSpace[] | OutputSpace | undefined,
    options: RustSymbolOptions = {},
  ) {
    super(name, spaces, options);
    this.#visibility = options.visibility ?? "private";
  }

  get visibility(): RustVisibility {
    return this.#visibility;
  }

  set visibility(value: RustVisibility) {
    this.#visibility = value;
  }

  get enclosingCrate(): CrateSymbol | undefined {
    if (this.spaces.length === 0) {
      return undefined;
    }

    const firstSpace = this.spaces[0];

    if (firstSpace instanceof OutputMemberSpace) {
      if (firstSpace.symbol.constructor.name === "CrateSymbol") {
        return firstSpace.symbol as CrateSymbol;
      }

      return (firstSpace.symbol as RustSymbol).enclosingCrate;
    } else if (firstSpace instanceof OutputDeclarationSpace) {
      return (firstSpace.scope as RustScope).enclosingCrate;
    }
    throw new Error("No place to get crate symbol from");
  }

  protected getRustCopyOptions(): RustSymbolOptions {
    return {
      ...this.getCopyOptions(),
      visibility: this.#visibility,
    };
  }

  protected initializeRustCopy(copy: RustSymbol) {
    this.initializeCopy(copy);
  }

  copy(): OutputSymbol {
    const options = this.getRustCopyOptions();
    const binder = this.binder;
    const copy = createSymbol(RustSymbol, this.name, undefined, {
      ...options,
      binder,
    });
    this.initializeRustCopy(copy);
    return copy;
  }
}
