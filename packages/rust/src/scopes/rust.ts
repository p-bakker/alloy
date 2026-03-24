import { OutputScope, OutputScopeOptions } from "@alloy-js/core";
import { CrateSymbol } from "../symbols/crate.js";

export class RustScope extends OutputScope {
  constructor(
    name: string,
    parent: RustScope | undefined,
    options?: OutputScopeOptions,
  ) {
    super(name, parent, options);
    this.#crateSymbol = parent?.enclosingCrate;
  }

  #crateSymbol: CrateSymbol | undefined;
  get enclosingCrate() {
    return this.#crateSymbol;
  }
}
