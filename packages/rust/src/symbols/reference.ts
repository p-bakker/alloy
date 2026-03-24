import { memo, OutputSymbol, Refkey, resolve } from "@alloy-js/core";
import { RustScope } from "../scopes/rust.js";
import { RustCrateScope } from "../scopes/crate.js";
import {
  RustSourceFileScope,
  useSourceFileScope,
} from "../scopes/source-file.js";
import { RustSymbol } from "./rust.js";
import { CrateSymbol } from "./crate.js";
import { NamedTypeSymbol } from "./named-type.js";
import { FunctionSymbol } from "./function.js";

function closestCrateScope(
  scopes: RustScope[],
  decl: RustSymbol,
  memberPath: RustSymbol[],
): {
  crateSymbol: CrateSymbol | undefined;
  members: RustSymbol[];
} {
  const allMembers = [decl, ...memberPath];
  for (let i = allMembers.length - 1; i >= 0; i--) {
    const member = allMembers[i];
    if (member instanceof CrateSymbol) {
      return { crateSymbol: member, members: allMembers.slice(i + 1) };
    }
  }
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i];
    if (scope instanceof RustCrateScope) {
      return {
        crateSymbol: scope.ownerSymbol,
        members: allMembers,
      };
    }
  }
  return {
    crateSymbol: undefined,
    members: allMembers,
  };
}

/**
 * Check if a symbol is a top-level declaration that can be imported via `use`.
 * Fields, parameters, enum variants, and other member-level symbols are not
 * importable — they are accessed via their parent type.
 */
function isImportableDeclaration(symbol: RustSymbol): boolean {
  if (symbol instanceof FunctionSymbol) {
    return true;
  }
  if (symbol instanceof NamedTypeSymbol) {
    const kind = symbol.typeKind;
    return kind === "struct" || kind === "enum" || kind === "trait" || kind === "type";
  }
  // Constants and statics use RustSymbol directly but are created via
  // createConstantSymbol — check if they have visibility set (fields/params don't
  // typically have visibility). However, the safest check is to exclude known
  // non-importable cases: base RustSymbol instances are typically parameters or
  // local variables which should never trigger a use import.
  return false;
}

/**
 * Derive the module name from a source file scope's name.
 * e.g., "src/models.rs" -> "models", "src/foo/bar.rs" -> "foo::bar"
 */
function modulePathFromSourceFileScope(scope: RustSourceFileScope): string {
  // scope.name is typically like "src/models.rs"
  let path = scope.name;
  // Strip leading "src/" if present
  if (path.startsWith("src/")) {
    path = path.slice(4);
  }
  // Strip .rs extension
  if (path.endsWith(".rs")) {
    path = path.slice(0, -3);
  }
  // Convert path separators to ::
  return path.replace(/\//g, "::");
}

export function ref(
  refkey: Refkey,
): () => [string, OutputSymbol | undefined] {
  const refSfScope = useSourceFileScope()!;
  const resolveResult = resolve<RustScope, RustSymbol>(refkey as Refkey);

  return memo(() => {
    if (resolveResult.value === undefined) {
      return ["<Unresolved Symbol>", undefined];
    }

    const result = resolveResult.value;
    const { pathDown, memberPath, commonScope } = result;
    const { lexicalDeclaration } = result;

    const parts = [];

    let localSymbol: RustSymbol | undefined;

    const { crateSymbol, members: pathFromCrate } = closestCrateScope(
      pathDown,
      lexicalDeclaration,
      memberPath,
    );
    if (crateSymbol) {
      // External crate reference
      for (const pathMember of pathFromCrate) {
        if (
          pathMember instanceof RustSymbol &&
          (pathMember.visibility === "private")
        ) {
          throw new Error(
            `Can't reference private symbol ${pathMember.name} from another module.`,
          );
        }
      }
      localSymbol = refSfScope.addUse(crateSymbol);
    } else if (
      commonScope instanceof RustCrateScope &&
      pathDown.length > 0
    ) {
      // Intra-crate cross-module reference: the common scope is the crate,
      // and pathDown contains the source file scope(s) leading to the declaration.
      // Only generate `use` for top-level importable items (structs, enums,
      // traits, functions), not for fields, parameters, or other member-level
      // symbols which are accessed via their parent type.
      if (isImportableDeclaration(lexicalDeclaration)) {
        const targetSfScope = pathDown.find(
          (s) => s instanceof RustSourceFileScope,
        ) as RustSourceFileScope | undefined;

        if (targetSfScope && targetSfScope !== refSfScope) {
          const modulePath = modulePathFromSourceFileScope(targetSfScope);
          const usePath = `crate::${modulePath}::${lexicalDeclaration.name}`;
          refSfScope.addExtraUse(usePath);
        }
      }
    }

    if (localSymbol) {
      parts.push(localSymbol.name);
    }
    for (const member of pathFromCrate) {
      parts.push(member.name);
    }

    return [parts.join("::"), result.symbol];
  });
}
