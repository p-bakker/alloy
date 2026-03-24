import { useSourceFileScope } from "../../scopes/source-file.js";

/**
 * Well-known derive macro traits that require a `use` import.
 * Maps trait name → crate use path.
 *
 * Standard library derives (Debug, Clone, Copy, Default, PartialEq, Eq,
 * PartialOrd, Ord, Hash) are in the prelude and don't need imports.
 */
const DERIVE_IMPORTS: Record<string, string> = {
  // serde
  Serialize: "serde::Serialize",
  Deserialize: "serde::Deserialize",
};

/** Traits from the same crate that should be grouped in a single `use` statement. */
function groupByCrate(
  traits: string[],
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const trait_ of traits) {
    const importPath = DERIVE_IMPORTS[trait_];
    if (!importPath) continue;
    const lastSep = importPath.lastIndexOf("::");
    const cratePath = importPath.slice(0, lastSep);
    const traitName = importPath.slice(lastSep + 2);
    if (!groups.has(cratePath)) {
      groups.set(cratePath, []);
    }
    groups.get(cratePath)!.push(traitName);
  }
  return groups;
}

export interface DeriveProps {
  traits: string[];
}

/**
 * A Rust #[derive(...)] attribute.
 *
 * Automatically adds `use` imports for well-known derive macros from external
 * crates (e.g., `use serde::{Serialize, Deserialize};`). Standard library
 * derives do not require imports.
 */
export function Derive(props: DeriveProps) {
  const sfScope = useSourceFileScope();

  if (sfScope) {
    const groups = groupByCrate(props.traits);
    for (const [cratePath, traits] of groups) {
      if (traits.length === 1) {
        sfScope.addExtraUse(`${cratePath}::${traits[0]}`);
      } else {
        sfScope.addExtraUse(`${cratePath}::{${traits.join(", ")}}`);
      }
    }
  }

  return <>#[derive({props.traits.join(", ")})]{"\n"}</>;
}
