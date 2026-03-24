import { OutputScope, createScope, useScope } from "@alloy-js/core";
import type { CrateSymbol } from "../symbols/crate.js";
import { RustModuleScope } from "./module.js";
import { RustNamedTypeScope } from "./named-type.js";

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
