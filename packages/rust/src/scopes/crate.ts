import { OutputScope, createScope, useScope } from "@alloy-js/core";
import type { CrateSymbol } from "../symbols/crate.js";
import { RustModuleScope } from "./module.js";
import { RustNamedTypeScope } from "./named-type.js";
import { RustSourceFileScope } from "./source-file.js";

export class RustCrateScope extends RustNamedTypeScope {
  constructor(
    crateSymbol: CrateSymbol,
    parentScope?: RustCrateScope | RustModuleScope,
  ) {
    super(crateSymbol, parentScope, { binder: crateSymbol.binder });
  }

  get ownerSymbol() {
    return super.ownerSymbol as CrateSymbol;
  }
}

export function createRustCrateScope(crateSymbol: CrateSymbol) {
  const parentScope = useScope();
  if (
    parentScope &&
    !(
      parentScope instanceof RustCrateScope ||
      parentScope instanceof RustModuleScope
    )
  ) {
    throw new Error(
      "Crates can only be created within a crate or module scope",
    );
  }

  const scope = createScope(RustCrateScope, crateSymbol, parentScope);

  return scope;
}

export function useEnclosingCrateScope(): RustCrateScope | undefined {
  const currentScope = useScope();
  if (!(currentScope instanceof RustCrateScope)) {
    return undefined;
  }

  return currentScope;
}

export function useCrate() {
  let scope: OutputScope | undefined = useScope();
  while (scope) {
    if (scope instanceof RustCrateScope) {
      return scope;
    }
    scope = scope.parent;
  }

  throw new Error("A crate is not in scope");
}

/**
 * Collect all external crate names referenced across source files in a crate scope.
 * Walks `uses` (CrateSymbol keys) and `extraUses` (paths like `serde::{Serialize}`)
 * to build a deduplicated set of external crate names.
 */
export function collectExternalCrates(crateScope: RustCrateScope): Set<string> {
  const crates = new Set<string>();

  function walk(scope: OutputScope) {
    if (scope instanceof RustSourceFileScope) {
      // uses: Map<CrateSymbol, RustSymbol> — keys are external crate symbols
      for (const crateSymbol of scope.uses.keys()) {
        if (!crateSymbol.builtin) {
          crates.add(crateSymbol.name);
        }
      }

      // extraUses: Map<string, { path: string }> — paths like "serde::{Serialize, Deserialize}"
      for (const record of scope.extraUses.values()) {
        const path = record.path;
        // Skip intra-crate references
        if (path.startsWith("crate::")) continue;
        // Extract the first segment (crate name) before "::"
        const sep = path.indexOf("::");
        if (sep > 0) {
          crates.add(path.slice(0, sep));
        }
      }
    }

    for (const child of scope.children) {
      walk(child);
    }
  }

  walk(crateScope);
  return crates;
}
