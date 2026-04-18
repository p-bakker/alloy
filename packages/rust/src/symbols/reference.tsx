import type { Children, Refkey } from "@alloy-js/core";
import {
  memo,
  onCleanup,
  resolve,
  unresolvedRefkey,
  untrack,
} from "@alloy-js/core";

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

const SIMPLE_NAMES_CACHE = new WeakMap<Set<string>, Set<string>>();

/**
 * Extract bare prelude names from a path-qualified prelude set. For entries
 * like `"result::Result"` this returns `"Result"`; primitive entries like
 * `"bool"` are already bare and pass through unchanged.
 */
function preludeSimpleNamesFor(prelude: Set<string>): Set<string> {
  let cached = SIMPLE_NAMES_CACHE.get(prelude);
  if (!cached) {
    cached = new Set();
    for (const entry of prelude) {
      const idx = entry.lastIndexOf("::");
      cached.add(idx === -1 ? entry : entry.slice(idx + 2));
    }
    SIMPLE_NAMES_CACHE.set(prelude, cached);
  }
  return cached;
}

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

    // Prelude lookup key is `<module>::<name>` without crate prefix
    // (e.g. `result::Result`) — see prelude.ts for the key-format rationale.
    // The `isBuiltinCrate` guard ensures we don't accidentally match a
    // third-party crate whose module structure happens to coincide.
    const isPreludeSymbol =
      targetCrate instanceof RustCrateScope &&
      isBuiltinCrate(targetCrate) &&
      prelude.has(buildModulePath(result.pathDown, declarationName));

    const isCrossModule =
      targetModule instanceof RustModuleScope &&
      targetCrate instanceof RustCrateScope &&
      sourceCrate instanceof RustCrateScope &&
      targetModule !== currentModuleScope;

    // Refkeys that end in an instance member (e.g. a method with a `self`
    // receiver, or a field) are accessed via the receiver value at the call
    // site — the parent type does not appear literally in the emitted
    // expression, so importing it would be dead code. We still track the
    // crate dependency + features below, and we also skip the fully-qualified
    // fallback for the same reason.
    const lastMember = memberPath[memberPath.length - 1];
    const isInstanceMemberAccess = lastMember?.isInstanceMemberSymbol === true;

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

      // Break the cycle: the memo MUST track hasLocalDeclaration (reactive —
      // we want to re-run when a local shadow appears later in render order),
      // but must NOT track imports mutations (untrack hasConflictingImport
      // and addUse/removeUse), otherwise each addUse → imports change →
      // re-run → cleanup → removeUse → imports change → re-run loop.
      const shadowedByLocal =
        currentModuleScope.hasLocalDeclaration(declarationName);
      // Builtin-crate symbols whose name collides with a prelude name but
      // aren't the prelude entry (e.g. `std::fmt::Result` vs prelude
      // `std::result::Result`) must NOT be imported — doing so would shadow
      // the prelude for any reference that renders the bare name, producing
      // subtly wrong code. Fully qualify these instead. User-defined types
      // that share names with the prelude (intentional shadowing in user
      // code) still import normally, since they aren't builtin-crate refs.
      const wouldShadowPrelude =
        isBuiltinCrate(targetCrate) &&
        preludeSimpleNamesFor(prelude).has(declarationName);
      if (isInstanceMemberAccess) {
        // Skip use-statement entirely; the parent type name never appears in
        // the rendered call expression.
      } else if (
        shadowedByLocal ||
        wouldShadowPrelude ||
        untrack(() =>
          currentModuleScope.hasConflictingImport(declarationName, usePath),
        )
      ) {
        useFullyQualified = true;
      } else {
        untrack(() => currentModuleScope.addUse(usePath, lexicalDeclaration));
        onCleanup(() => {
          untrack(() =>
            currentModuleScope.removeUse(usePath, lexicalDeclaration),
          );
        });
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

/**
 * Build a module-qualified path `<module>::<name>` without crate prefix,
 * used to check against the prelude set (which stores entries in this form
 * to disambiguate e.g. `result::Result` from `fmt::Result`).
 */
function buildModulePath(pathDown: RustScopeBase[], name: string): string {
  const moduleSegments: string[] = [];
  for (const scope of pathDown) {
    if (scope instanceof RustModuleScope) {
      moduleSegments.push(...moduleNameSegments(scope.name));
    }
  }
  // Bare name for primitives / root-level items (no module segments).
  return moduleSegments.length === 0
    ? name
    : [...moduleSegments, name].join("::");
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
