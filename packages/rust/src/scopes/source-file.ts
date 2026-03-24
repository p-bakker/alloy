import {
  OutputScope,
  OutputScopeOptions,
  createSymbol,
  shallowReactive,
  useScope,
} from "@alloy-js/core";
import { RustSymbol, RustVisibility } from "../symbols/rust.js";
import { CrateSymbol } from "../symbols/crate.js";
import { RustLexicalScope } from "./lexical.js";
import { RustCrateScope } from "./crate.js";

export type UseRecords = Map<CrateSymbol, RustSymbol>;

export interface ExtraUseRecord {
  path: string;  // e.g., "crate::models::Person" or "serde::{Serialize, Deserialize}"
}

export type ExtraUseRecords = Map<string, ExtraUseRecord>;

export interface ModuleRecord {
  name: string;
  visibility?: RustVisibility;
}

export type ModuleRecords = Map<string, ModuleRecord>;

export class RustSourceFileScope extends RustLexicalScope {
  #uses = shallowReactive<UseRecords>(new Map());
  #extraUses = shallowReactive<ExtraUseRecords>(new Map());
  #modules = shallowReactive<ModuleRecords>(new Map());

  constructor(
    name: string,
    parent?: RustCrateScope,
    options?: OutputScopeOptions,
  ) {
    super(name, parent, options);
  }

  get uses() {
    return this.#uses;
  }

  get extraUses() {
    return this.#extraUses;
  }

  get modules() {
    return this.#modules;
  }

  addModule(name: string, visibility?: RustVisibility) {
    if (this.#modules.has(name)) {
      return;
    }
    this.#modules.set(name, { name, visibility });
  }

  get parent() {
    return super.parent! as RustCrateScope;
  }

  set parent(v: RustCrateScope) {
    super.parent = v;
  }

  addUse(import_: CrateSymbol) {
    if (this.#uses.has(import_)) {
      return this.#uses.get(import_)!;
    }

    const localSymbol = createSymbol(RustSymbol, import_.name, this.values, {
      aliasTarget: import_,
      binder: this.binder,
    });

    this.#uses.set(import_, localSymbol);

    return localSymbol;
  }

  addExtraUse(path: string) {
    if (this.#extraUses.has(path)) {
      return;
    }
    this.#extraUses.set(path, { path });
  }

  get enclosingCrate(): CrateSymbol | undefined {
    return this.parent?.ownerSymbol;
  }
}

export function useSourceFileScope() {
  let scope: OutputScope | undefined = useScope();
  while (scope) {
    if (scope instanceof RustSourceFileScope) {
      return scope;
    }
    scope = scope.parent;
  }

  return undefined;
}
