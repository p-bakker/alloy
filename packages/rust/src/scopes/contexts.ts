import { createContext, useContext, useScope } from "@alloy-js/core";
import { RustFunctionScope } from "./function.js";
import { RustScope } from "./rust.js";
import { RustLexicalScope } from "./lexical.js";
import { RustNamedTypeScope } from "./named-type.js";
import { RustImplScope } from "./impl.js";

export type RustEdition = "2015" | "2018" | "2021" | "2024";

export const CrateEditionContext = createContext<RustEdition>("2021", "CrateEdition");

export function useCrateEdition(): RustEdition {
  return useContext(CrateEditionContext) ?? "2021";
}

export function useRustScope() {
  const scope = useScope();
  if (!(scope instanceof RustScope)) {
    throw new Error("Expected a Rust scope, got a different kind of scope.");
  }

  return scope;
}

export function useNamedTypeScope() {
  const scope = useRustScope();
  if (!(scope instanceof RustNamedTypeScope)) {
    throw new Error(
      "Expected a named type scope, got a " + scope.constructor.name,
    );
  }

  return scope;
}

export function useFuncScope() {
  const scope = useRustScope();
  if (!(scope instanceof RustFunctionScope)) {
    throw new Error(
      `Expected a function scope, but got ${scope.constructor.name}.`,
    );
  }
  return scope;
}

export function useLexicalScope() {
  const scope = useRustScope();
  if (!(scope instanceof RustLexicalScope)) {
    throw new Error(
      `Expected a lexical scope, but got ${scope.constructor.name}.`,
    );
  }
  return scope;
}

export function useImplScope() {
  const scope = useRustScope();
  if (!(scope instanceof RustImplScope)) {
    throw new Error(
      `Expected an impl scope, but got ${scope.constructor.name}.`,
    );
  }
  return scope;
}
