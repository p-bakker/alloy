import type { SymbolCreator } from "@alloy-js/core";
import { createCrate, type CrateRef, type ExternalCrate } from "@alloy-js/rust";

// ── Cargo.toml dependency specs ─────────────────────────────────────────────
// Single source of truth for all crate versions and features.

export interface CargoDep {
  version: string;
  features?: string[];
}

export const DEFAULT_CARGO_DEPS: Record<string, CargoDep> = {
  serde: { version: "1.0", features: ["derive"] },
  serde_json: { version: "1.0" },
  validator: { version: "0.19", features: ["derive"] },
  chrono: { version: "0.4", features: ["serde"] },
  url: { version: "2", features: ["serde"] },
  regex: { version: "1" },
  rust_decimal: { version: "1", features: ["serde-str"] },
};

export function formatCargoDep(name: string, dep: CargoDep): string {
  if (dep.features && dep.features.length > 0) {
    const feats = dep.features.map((f) => `"${f}"`).join(", ");
    return `${name} = { version = "${dep.version}", features = [${feats}] }`;
  }
  return `${name} = "${dep.version}"`;
}

// ── std crate ────────────────────────────────────────────────────────────────

const stdDescriptor = {
  name: "std",
  builtin: true,
  modules: {
    fmt: {
      Display: { kind: "trait" },
      Formatter: { kind: "struct" },
      Result: { kind: "type-alias", name: "Result" },
    },
    error: {
      Error: { kind: "trait" },
    },
  },
} as const;

type StdCrate = CrateRef<typeof stdDescriptor> & SymbolCreator & ExternalCrate;
export const stdCrate: StdCrate = createCrate(stdDescriptor);

// ── serde crate ──────────────────────────────────────────────────────────────

const serdeDescriptor = {
  name: "serde",
  version: "1.0",
  modules: {
    "": {
      Serialize: { kind: "trait" },
      Deserialize: { kind: "trait" },
    },
  },
} as const;

type SerdeCrate = CrateRef<typeof serdeDescriptor> & SymbolCreator & ExternalCrate;
export const serdeCrate: SerdeCrate = createCrate(serdeDescriptor);

// ── validator crate ──────────────────────────────────────────────────────────

const validatorDescriptor = {
  name: "validator",
  version: "0.19",
  modules: {
    "": {
      Validate: { kind: "trait" },
    },
  },
} as const;

type ValidatorCrate = CrateRef<typeof validatorDescriptor> &
  SymbolCreator &
  ExternalCrate;
export const validatorCrate: ValidatorCrate = createCrate(validatorDescriptor);
