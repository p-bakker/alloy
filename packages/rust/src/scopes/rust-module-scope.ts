import {
  type Children,
  type OutputScopeOptions,
  type OutputSpace,
  shallowReactive,
} from "@alloy-js/core";
import {
  type RustOutputSymbol,
  type RustVisibility,
} from "../symbols/rust-output-symbol.js";
import { type RustVisibilityProps } from "../components/visibility.js";
import { RustCrateScope } from "./rust-crate-scope.js";
import { RustScopeBase } from "./rust-scope.js";

export interface RustModuleDeclaration extends RustVisibilityProps {
  name: string;
  attributes?: Children[];
}

/**
 * A grouping of imported symbols that share both a path and a visibility —
 * each group becomes one `use` line.
 */
export interface RustImportGroup {
  path: string;
  visibility: RustVisibility;
  names: Set<string>;
}

function importGroupKey(path: string, visibility: RustVisibility): string {
  return `${visibility ?? ""}\u0000${path}`;
}

export class RustModuleScope extends RustScopeBase {
  public static readonly declarationSpaces = ["types", "values"];

  #imports = shallowReactive<Map<string, RustImportGroup>>(new Map());
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

  /**
   * The imports registered in this module, grouped by `(path, visibility)` —
   * one entry per unique combo, each rendered as a single `use` line.
   */
  get imports() {
    return this.#imports;
  }

  addUse(
    path: string,
    symbol: RustOutputSymbol | string,
    visibility: RustVisibility = undefined,
  ) {
    const name = typeof symbol === "string" ? symbol : symbol.name;
    const key = importGroupKey(path, visibility);
    let group = this.#imports.get(key);
    if (!group) {
      group = {
        path,
        visibility,
        names: shallowReactive(new Set<string>()),
      };
      this.#imports.set(key, group);
    }
    group.names.add(name);
  }

  removeUse(
    path: string,
    symbol: RustOutputSymbol | string,
    visibility: RustVisibility = undefined,
  ) {
    const name = typeof symbol === "string" ? symbol : symbol.name;
    const key = importGroupKey(path, visibility);
    const group = this.#imports.get(key);
    if (!group) return;
    group.names.delete(name);
    if (group.names.size === 0) {
      this.#imports.delete(key);
    }
  }

  getImport(
    path: string,
    visibility: RustVisibility = undefined,
  ): RustImportGroup | undefined {
    return this.#imports.get(importGroupKey(path, visibility));
  }

  /**
   * Check if a symbol name is already imported from a different path
   * (across any visibility).
   */
  hasConflictingImport(name: string, path: string): boolean {
    for (const group of this.#imports.values()) {
      if (group.path === path) continue;
      if (group.names.has(name)) return true;
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
