import { OutputScopeOptions, createScope } from "@alloy-js/core";
import { NamedTypeSymbol } from "../symbols/named-type.js";
import { useRustScope } from "./contexts.js";
import { RustFunctionScope } from "./function.js";
import { RustImplScope } from "./impl.js";
import { RustNamedTypeScope } from "./named-type.js";
import { RustSourceFileScope } from "./source-file.js";

export function createNamedTypeScope(
  ownerSymbol: NamedTypeSymbol,
  options: OutputScopeOptions = {},
) {
  const currentScope = useRustScope();
  if (
    !(currentScope instanceof RustNamedTypeScope) &&
    !(currentScope instanceof RustSourceFileScope) &&
    !(currentScope instanceof RustImplScope)
  ) {
    throw new Error(
      "Can't create Rust type declaration scope inside of " +
        currentScope.constructor.name,
    );
  }

  return createScope(RustNamedTypeScope, ownerSymbol, currentScope, options);
}

export function createFunctionScope(options: OutputScopeOptions = {}) {
  const parentScope = useRustScope();
  return createScope(
    RustFunctionScope,
    "function scope",
    parentScope,
    options,
  );
}

export function createImplScope(options: OutputScopeOptions = {}) {
  const parentScope = useRustScope();
  return createScope(RustImplScope, "impl scope", parentScope, options);
}
