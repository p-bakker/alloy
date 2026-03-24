import { createSymbol, Namekey, NamePolicyGetter } from "@alloy-js/core";
import { join } from "pathe";
import { RustElements, useRustNamePolicy } from "../name-policy.js";
import { useRustScope, useNamedTypeScope } from "../scopes/contexts.js";
import { RustFunctionScope } from "../scopes/function.js";
import { RustLexicalScope } from "../scopes/lexical.js";
import { RustImplScope } from "../scopes/impl.js";
import { useModule } from "../scopes/module.js";
import { RustNamedTypeScope } from "../scopes/named-type.js";
import { useEnclosingCrateScope } from "../scopes/crate.js";
import { FunctionSymbol } from "./function.js";
import { RustSymbol, RustSymbolOptions, RustVisibility } from "./rust.js";
import {
  NamedTypeSymbol,
  NamedTypeSymbolOptions,
  NamedTypeTypeKind,
} from "./named-type.js";
import { CrateSymbol } from "./crate.js";

/**
 * Create a symbol for a parameter in the current func scope.
 */
export function createParameterSymbol(
  originalName: string | Namekey,
  options: RustSymbolOptions = {},
) {
  const scope = useRustScope();
  if (!(scope instanceof RustFunctionScope)) {
    throw new Error(`Can't create parameter symbol outside of a func scope.`);
  }
  const binder = options.binder ?? scope.binder;
  return createSymbol(RustSymbol, originalName, scope.parameters, {
    ...withNamePolicy(options, "parameter"),
    binder,
  });
}

export interface CreateTypeParameterSymbolOptions extends RustSymbolOptions {
  scope?: RustFunctionScope | RustNamedTypeScope;
}
export function createTypeParameterSymbol(
  originalName: string | Namekey,
  options: CreateTypeParameterSymbolOptions = {},
) {
  const scope = options.scope ?? useRustScope();
  if (
    !(scope instanceof RustFunctionScope) &&
    !(scope instanceof RustNamedTypeScope)
  ) {
    throw new Error(
      "Can't create a type parameter symbol outside of a func or named type scope.",
    );
  }

  const binder = options.binder ?? scope.binder;
  return createSymbol(RustSymbol, originalName, scope.typeParameters, {
    ...withNamePolicy(options, "type-parameter"),
    binder,
  });
}

export function createStructFieldSymbol(
  originalName: string | Namekey,
  options: NamedTypeSymbolOptions = {},
) {
  const scope = useNamedTypeScope();

  if (
    scope.ownerSymbol.typeKind !== "struct" &&
    scope.ownerSymbol.typeKind !== "struct-field" &&
    scope.ownerSymbol.typeKind !== "enum-variant"
  ) {
    throw new Error(
      `Can't define a field outside of a struct, kind ${scope.ownerSymbol.typeKind}.`,
    );
  }

  const binder = options.binder ?? scope.ownerSymbol.binder;
  return createSymbol(
    NamedTypeSymbol,
    originalName,
    scope.members,
    "struct-field",
    {
      ...withNamePolicy(options, "struct-field"),
      binder,
    },
  );
}

export function createEnumVariantSymbol(
  originalName: string | Namekey,
  options: NamedTypeSymbolOptions = {},
  typeKindOverride?: NamedTypeTypeKind,
) {
  const scope = useNamedTypeScope();

  if (scope.ownerSymbol.typeKind !== "enum") {
    throw new Error(
      `Can't define an enum variant outside of an enum, kind ${scope.ownerSymbol.typeKind}.`,
    );
  }

  const binder = options.binder ?? scope.ownerSymbol.binder;
  return createSymbol(
    NamedTypeSymbol,
    originalName,
    scope.members,
    typeKindOverride ?? "enum-variant",
    {
      ...withNamePolicy(options, "enum-variant"),
      binder,
    },
  );
}

export function createCrateSymbol(name: string, path?: string) {
  const scope = useEnclosingCrateScope();
  const crateSymbol = scope?.ownerSymbol;
  if (!crateSymbol) {
    const mod = useModule();
    const modName = mod.name;
    const builtin = mod.builtin;
    const cratePath = path ? join(modName, path) : modName;
    return createSymbol(CrateSymbol, name, undefined, {
      path: cratePath,
      builtin,
      binder: mod.binder,
    });
  }
  if (crateSymbol.members.symbolNames.has(name)) {
    return crateSymbol.members.symbolNames.get(name)! as CrateSymbol;
  }
  return createSymbol(CrateSymbol, name, crateSymbol, {
    path,
    binder: crateSymbol.binder,
  });
}

export function createFunctionSymbol(
  originalName: string | Namekey,
  options: RustSymbolOptions = {},
) {
  const scope = useRustScope();
  if (scope instanceof RustLexicalScope) {
    const binder = options.binder ?? scope.binder;
    return createSymbol(FunctionSymbol, originalName, scope.types, {
      ...withNamePolicy(options, "function"),
      binder,
    });
  }
  const binder = options.binder ?? scope.binder;
  return createSymbol(FunctionSymbol, originalName, undefined, {
    ...withNamePolicy(options, "function"),
    binder,
  });
}

export function createVariableSymbol(
  originalName: string | Namekey,
  options: RustSymbolOptions = {},
) {
  const scope = useRustScope();
  if (!(scope instanceof RustLexicalScope)) {
    throw new Error(
      `Can't create variable symbol outside of a lexical scope, got a ${scope.constructor.name}.`,
    );
  }
  const binder = options.binder ?? scope.binder;
  return createSymbol(RustSymbol, originalName, scope.values, {
    ...withNamePolicy(options, "variable"),
    binder,
  });
}

export function createTypeSymbol(
  originalName: string | Namekey,
  kind: NamedTypeTypeKind,
  options: NamedTypeSymbolOptions = {},
) {
  const scope = useRustScope();
  if (scope instanceof RustLexicalScope) {
    const binder = options.binder ?? scope.binder;
    return createSymbol(NamedTypeSymbol, originalName, scope.types, kind, {
      ...withNamePolicy(options, "type"),
      binder,
    });
  }
  throw new Error(
    `Can't create type symbol outside of a lexical scope, got a ${scope.constructor.name}.`,
  );
}

export function createConstantSymbol(
  originalName: string | Namekey,
  options: RustSymbolOptions = {},
) {
  const scope = useRustScope();
  if (!(scope instanceof RustLexicalScope)) {
    throw new Error(
      `Can't create constant symbol outside of a lexical scope, got a ${scope.constructor.name}.`,
    );
  }
  const binder = options.binder ?? scope.binder;
  return createSymbol(RustSymbol, originalName, scope.values, {
    ...withNamePolicy(options, "constant"),
    binder,
  });
}

let anonymousTypeID = 0;

export function createAnonymousTypeSymbol(
  kind: NamedTypeTypeKind,
  options: NamedTypeSymbolOptions = {},
) {
  const name =
    "anonymous_" + anonymousTypeID++ + "_this_should_not_appear_in_output";
  const scope = useRustScope();
  const metadata = { ...options.metadata, anonymous: true };
  if (scope instanceof RustLexicalScope) {
    const binder = options.binder ?? scope.binder;
    return createSymbol(NamedTypeSymbol, name, scope.types, kind, {
      ...options,
      metadata,
      binder,
    });
  } else if (scope instanceof RustNamedTypeScope) {
    const binder = options.binder ?? scope.binder;
    return createSymbol(
      NamedTypeSymbol,
      name,
      scope.ownerSymbol.members,
      kind,
      {
        ...options,
        metadata,
        binder,
      },
    );
  }
  throw new Error(
    `Can't create anonymous type symbol outside of a lexical or NamedType scope, got a ${scope.constructor.name}.`,
  );
}

function withNamePolicy<T extends { namePolicy?: NamePolicyGetter }>(
  options: T,
  elementType: RustElements,
): RustSymbolOptions {
  return {
    ...options,
    namePolicy: options.namePolicy ?? useRustNamePolicy().for(elementType),
  };
}
