import { type OutputScopeOptions } from "@alloy-js/core";
import { NamedTypeSymbol } from "../symbols/named-type.js";
import { RustScope } from "./rust.js";
import { RustModuleScope } from "./module.js";
import { RustLexicalScope } from "./lexical.js";

/**
 * This scope contains NamedTypeSymbols for types that are declared in
 * containers like crates. This scope is a member scope whose
 * member symbol is a NamedTypeSymbol.
 */
export class RustNamedTypeScope extends RustScope {
  public static readonly declarationSpaces = [];

  constructor(
    ownerSymbol: NamedTypeSymbol,
    parentScope:
      | RustNamedTypeScope
      | RustLexicalScope
      | RustModuleScope
      | undefined,
    options: OutputScopeOptions = {},
  ) {
    super(`${ownerSymbol.name} scope`, parentScope, {
      ownerSymbol,
      ...options,
    });
  }

  get ownerSymbol(): NamedTypeSymbol {
    return super.ownerSymbol as NamedTypeSymbol;
  }

  get enclosingCrate() {
    return this.ownerSymbol.enclosingCrate;
  }

  get members() {
    return this.ownerSymbol.members;
  }

  get typeParameters() {
    return this.ownerSymbol.members;
  }
}
