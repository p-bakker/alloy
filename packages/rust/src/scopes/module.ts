import { OutputScope, createScope, useScope } from "@alloy-js/core";
import { RustScope } from "./rust.js";

export class RustModuleScope extends RustScope {
  constructor(name: string, builtin = false) {
    super(name, undefined);
    this.#builtin = builtin;
  }

  #builtin: boolean;
  get builtin() {
    return this.#builtin;
  }
}

export function createRustModuleScope(name: string) {
  const parentScope = useScope();
  if (parentScope) {
    throw new Error("Modules can only be created at the top level");
  }
  const scope = createScope(RustModuleScope, name);
  return scope;
}

export function useModule() {
  let scope: OutputScope | undefined = useScope();
  while (scope) {
    if (scope instanceof RustModuleScope) {
      return scope;
    }
    scope = scope.parent;
  }

  throw new Error("A module is not in scope");
}
