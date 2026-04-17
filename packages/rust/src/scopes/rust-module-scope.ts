import {
  type Children,
  type OutputScopeOptions,
  type OutputSpace,
  shallowReactive,
} from "@alloy-js/core";

import { type RustVisibilityProps } from "../components/visibility.js";
import { type RustOutputSymbol } from "../symbols/rust-output-symbol.js";
import type { RustCrateScope } from "./rust-crate-scope.js";
import { RustScopeBase } from "./rust-scope.js";

export interface RustModuleDeclaration extends RustVisibilityProps {
  name: string;
  attributes?: Children[];
}

export class RustModuleScope extends RustScopeBase {
  public static readonly declarationSpaces = ["types", "values"];

  #imports = shallowReactive<Map<string, Set<RustOutputSymbol>>>(new Map());
  #childModules = shallowReactive<Map<string, RustModuleDeclaration>>(
    new Map(),
  );

  constructor(
    name: string,
    parent: RustCrateScope | RustModuleScope | undefined,
    options?: OutputScopeOptions,
  ) {
    super(name, parent, options);
  }

  get parent() {
    return super.parent as RustCrateScope | RustModuleScope | undefined;
  }

  set parent(value: RustCrateScope | RustModuleScope | undefined) {
    super.parent = value;
  }

  override get enclosingModule() {
    return this;
  }

  get imports() {
    return this.#imports;
  }

  addUse(path: string, symbol: RustOutputSymbol) {
    let symbolsForPath = this.#imports.get(path);
    if (!symbolsForPath) {
      symbolsForPath = shallowReactive(new Set<RustOutputSymbol>());
      this.#imports.set(path, symbolsForPath);
    }

    symbolsForPath.add(symbol);
  }

  /**
   * Check if a symbol name is already imported from a different path.
   */
  hasConflictingImport(name: string, path: string): boolean {
    for (const [importPath, symbols] of this.#imports) {
      if (importPath === path) continue;
      for (const sym of symbols) {
        if (sym.name === name) return true;
      }
    }
    return false;
  }

  get childModules() {
    return this.#childModules;
  }

  addChildModule(declaration: RustModuleDeclaration) {
    const existing = this.#childModules.get(declaration.name);
    if (existing) {
      return existing;
    }

    this.#childModules.set(declaration.name, declaration);
    return declaration;
  }

  /**
   * Check if a name is declared locally in this module (types or values space).
   */
  hasLocalDeclaration(name: string): boolean {
    for (const space of [this.spaceFor("types"), this.spaceFor("values")]) {
      if (space?.symbolNames.has(name)) {
        return true;
      }
    }
    return false;
  }

  get types(): OutputSpace {
    return this.spaceFor("types")!;
  }

  get values(): OutputSpace {
    return this.spaceFor("values")!;
  }
}
