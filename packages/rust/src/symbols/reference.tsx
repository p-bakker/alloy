import type { Children, Refkey } from "@alloy-js/core";
import { memo, resolve, unresolvedRefkey } from "@alloy-js/core";

import {
  PRELUDE_TYPES,
  PRELUDE_TYPES_2015,
  PRELUDE_TYPES_2018,
  PRELUDE_TYPES_2021,
  PRELUDE_TYPES_2024,
} from "../builtins/prelude.js";
import { useCrateContext } from "../context/crate-context.js";
import { isBuiltinCrate } from "../create-crate.js";
import { useRustScope } from "../scopes/contexts.js";
import { RustCrateScope } from "../scopes/rust-crate-scope.js";
import { RustModuleScope } from "../scopes/rust-module-scope.js";
import type { RustScopeBase } from "../scopes/rust-scope.js";
import type { RustOutputSymbol } from "./rust-output-symbol.js";
import { type RustVisibility } from "./rust-output-symbol.js";

const PRELUDE_BY_EDITION: Record<string, Set<string>> = {
  "2015": PRELUDE_TYPES_2015,
  "2018": PRELUDE_TYPES_2018,
  "2021": PRELUDE_TYPES_2021,
  "2024": PRELUDE_TYPES_2024,
};

export function ref(
  refkey: Refkey,
): () => [Children, RustOutputSymbol | undefined] {
  const currentScope = useRustScope();
  const currentModuleScope = currentScope.enclosingModule;
  if (!(currentModuleScope instanceof RustModuleScope)) {
    throw new Error(
      `Expected an enclosing Rust module scope, but got ${currentScope.constructor.name}.`,
    );
  }
  const resolveResult = resolve<RustScopeBase, RustOutputSymbol>(
    refkey as Refkey,
  );

  // Pick the prelude set for the current crate's edition
  const crateContext = useCrateContext();
  const prelude = crateContext
    ? (PRELUDE_BY_EDITION[crateContext.edition] ?? PRELUDE_TYPES)
    : PRELUDE_TYPES;

  return memo(() => {
    if (resolveResult.value === undefined) {
      return [unresolvedRefkey(refkey), undefined];
    }

    const result = resolveResult.value;
    const { symbol, lexicalDeclaration, commonScope, memberPath } = result;
    const declarationName = lexicalDeclaration.name;

    const sourceCrate = currentModuleScope.enclosingCrate;
    const declarationScope = lexicalDeclaration.scope as
      | RustScopeBase
      | undefined;
    const targetModule = declarationScope?.enclosingModule;
    const targetCrate = declarationScope?.enclosingCrate;

    const isPreludeSymbol =
      prelude.has(declarationName) &&
      targetCrate instanceof RustCrateScope &&
      isBuiltinCrate(targetCrate);

    const isCrossModule =
      targetModule instanceof RustModuleScope &&
      targetCrate instanceof RustCrateScope &&
      sourceCrate instanceof RustCrateScope &&
      targetModule !== currentModuleScope;

    let useFullyQualified = false;

    if (
      isPreludeSymbol &&
      currentModuleScope.hasLocalDeclaration(declarationName)
    ) {
      useFullyQualified = true;
    } else if (!isPreludeSymbol && isCrossModule) {
      const isSameCrate = targetCrate === sourceCrate;

      if (
        isSameCrate &&
        !isVisibleFrom(lexicalDeclaration.visibility, result.fullReferencePath)
      ) {
        throw new Error(
          `Cannot reference private symbol '${declarationName}' from module '${currentModuleScope.name}'.`,
        );
      }

      const usePath = buildUsePath(
        isSameCrate ? "crate" : targetCrate.name,
        result.pathDown,
      );

      if (currentModuleScope.hasConflictingImport(declarationName, usePath)) {
        useFullyQualified = true;
      } else {
        currentModuleScope.addUse(usePath, lexicalDeclaration);
      }

      if (!isSameCrate && !isBuiltinCrate(targetCrate)) {
        sourceCrate.addDependency(targetCrate.name, targetCrate.version ?? "*");
      }
    }

    if (useFullyQualified && targetCrate instanceof RustCrateScope) {
      const qualifiedPath = buildUsePath(targetCrate.name, result.pathDown);
      return [
        <>
          {qualifiedPath}::{declarationName}
        </>,
        symbol,
      ];
    }

    return [
      buildReferenceChildren(commonScope, lexicalDeclaration, memberPath),
      symbol,
    ];
  });
}

function buildReferenceChildren(
  commonScope: RustScopeBase | undefined,
  lexicalDeclaration: RustOutputSymbol,
  memberPath: RustOutputSymbol[],
): Children {
  const parts: Children[] = [];

  if (commonScope && commonScope.isMemberScope) {
    // Referencing a member of a type we are inside
    if (lexicalDeclaration.isInstanceMemberSymbol) {
      // Instance member: self.member
      parts.push("self.", lexicalDeclaration.name);
    } else {
      // Associated item: Type::member
      parts.push(commonScope.ownerSymbol!.name, "::", lexicalDeclaration.name);
    }
  } else {
    parts.push(lexicalDeclaration.name);
  }

  for (const member of memberPath) {
    if (member.isInstanceMemberSymbol) {
      parts.push(".", member.name);
    } else {
      parts.push("::", member.name);
    }
  }

  return <>{parts}</>;
}

function isVisibleFrom(
  visibility: RustVisibility,
  referencePath: RustScopeBase[],
): boolean {
  if (visibility === undefined) {
    return false;
  }

  if (typeof visibility === "string" && visibility.startsWith("pub(in ")) {
    const allowedPath = visibility.slice("pub(in ".length, -")".length);
    const refPath = buildUsePath("crate", referencePath);
    return refPath === allowedPath || refPath.startsWith(allowedPath + "::");
  }

  return true;
}

export function buildUsePath(
  prefix: string,
  pathDown: RustScopeBase[],
): string {
  const moduleSegments: string[] = [];

  for (const scope of pathDown) {
    if (scope instanceof RustModuleScope) {
      moduleSegments.push(...moduleNameSegments(scope.name));
    }
  }

  return [prefix, ...moduleSegments].join("::");
}

export function moduleNameSegments(moduleName: string): string[] {
  const normalized = moduleName
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .map((segment) =>
      segment.endsWith(".rs") ? segment.slice(0, -3) : segment,
    )
    .filter(
      (segment) => segment !== "mod" && segment !== "lib" && segment !== "main",
    );

  return normalized;
}
