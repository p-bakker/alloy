/** @jsxRuntime automatic */
/** @jsxImportSource @alloy-js/core */
/**
 * Generic crate descriptor generator for alloy-js/rust.
 *
 * Takes any rustdoc JSON and generates a per-module directory of TypeScript
 * files with crate descriptors compatible with `createCrate()`. Extracts
 * inherent methods as members with `associated` flag for :: vs . distinction.
 *
 * Output is emitted via `@alloy-js/core` + `@alloy-js/typescript` (dogfooding),
 * so formatting is handled by Alloy's Prettier-backed printer rather than
 * manual string concatenation.
 *
 * Usage:
 *   npx tsx scripts/generate-crate-descriptor.tsx <rustdoc.json> [options]
 *
 * Options:
 *   --builtin              Mark as builtin (no Cargo.toml dependency)
 *   --prelude              Generate prelude.ts with edition-aware PRELUDE_TYPES
 *   --prelude-source PATH  Core rustdoc JSON for resolving edition prelude globs
 *   --merge-from PATH      Merge another crate's symbols (repeatable)
 *   --out PATH             Output directory (default: src/builtins/<crate>/)
 *   --skip MOD1,MOD2       Comma-separated modules to skip
 *   --extract-features     Extract per-symbol feature gates from cfg attributes
 *   --import-base PKG      Use package imports instead of relative (e.g. "@alloy-js/rust")
 *
 * Examples:
 *   # Standard library crates
 *   npx tsx scripts/generate-crate-descriptor.tsx core.json --builtin
 *   npx tsx scripts/generate-crate-descriptor.tsx alloc.json --builtin
 *   npx tsx scripts/generate-crate-descriptor.tsx std.json --builtin \
 *     --prelude --prelude-source core.json \
 *     --merge-from core.json --merge-from alloc.json
 *
 *   # Third-party crates with features
 *   # (use --cfg docsrs in RUSTDOCFLAGS for best feature extraction)
 *   npx tsx scripts/generate-crate-descriptor.tsx target/doc/serde.json \
 *     --extract-features --import-base "@alloy-js/rust"
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import {
  code,
  For,
  Output,
  renderAsync,
  Show,
  SourceDirectory,
  writeOutput,
} from "@alloy-js/core";
import { hbr } from "@alloy-js/core/stc";
import {
  ArrayExpression,
  ObjectExpression,
  ObjectProperty,
  ObjectSpreadProperty,
  SourceFile,
  VarDeclaration,
} from "@alloy-js/typescript";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  jsonPath: string;
  builtin: boolean;
  prelude: boolean;
  preludeSource: string | null; // path to core.json for resolving edition prelude globs
  mergeFrom: string[]; // paths to other rustdoc JSONs to merge into this crate
  outPath: string | null;
  skipModules: Set<string>;
  extractFeatures: boolean;
  importBase: string | null; // package name for imports (e.g. "@alloy-js/rust")
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help") {
    console.error(
      "Usage: npx tsx generate-crate-descriptor.tsx <rustdoc.json> [--builtin] [--prelude] [--prelude-source <path>] [--merge-from <path>] [--out <dir>] [--skip <mods>] [--extract-features] [--import-base <pkg>]",
    );
    process.exit(args[0] === "--help" ? 0 : 1);
  }

  const result: CliArgs = {
    jsonPath: "",
    builtin: false,
    prelude: false,
    preludeSource: null,
    mergeFrom: [],
    outPath: null,
    skipModules: new Set(),
    extractFeatures: false,
    importBase: null,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--builtin") {
      result.builtin = true;
    } else if (arg === "--prelude") {
      result.prelude = true;
    } else if (arg === "--merge-from" && i + 1 < args.length) {
      result.mergeFrom.push(args[++i]);
    } else if (arg === "--prelude-source" && i + 1 < args.length) {
      result.preludeSource = args[++i];
    } else if (arg === "--out" && i + 1 < args.length) {
      result.outPath = args[++i];
    } else if (arg === "--skip" && i + 1 < args.length) {
      for (const mod of args[++i].split(",")) {
        result.skipModules.add(mod.trim());
      }
    } else if (arg === "--extract-features") {
      result.extractFeatures = true;
    } else if (arg === "--import-base" && i + 1 < args.length) {
      result.importBase = args[++i];
    } else if (!arg.startsWith("--")) {
      result.jsonPath = arg;
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
    i++;
  }

  if (!result.jsonPath) {
    console.error("Error: rustdoc JSON path is required");
    process.exit(1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Default skip list for standard library crates
// ---------------------------------------------------------------------------

const DEFAULT_STD_SKIP = new Set([
  "os",
  "simd",
  "arch",
  "autodiff",
  "bstr",
  "prelude",
  "f16",
  "f128",
  "intrinsics",
  "field",
  "hint",
  "unsafe_binder",
  "from",
  "async_iter",
  "primitive",
  "index", // nightly (core::ops::index re-export), collides with index.ts
]);

// ---------------------------------------------------------------------------
// Accepted item kinds for the crate descriptor
// ---------------------------------------------------------------------------

const ACCEPTED_KINDS = new Set([
  "struct",
  "enum",
  "trait",
  "function",
  "type_alias",
  "constant",
  "macro",
]);

// ---------------------------------------------------------------------------
// Rustdoc JSON types
// ---------------------------------------------------------------------------

interface RustdocJson {
  format_version: number;
  root: string;
  crate_version: string | null;
  index: Record<string, RustdocItem>;
  paths: Record<string, { crate_id: number; path: string[]; kind: string }>;
  external_crates: Record<string, { name: string }>;
}

interface RustdocItem {
  id: number;
  crate_id: number;
  name: string | null;
  visibility: string;
  docs: string | null;
  attrs: Array<string | { other: string }>;
  inner: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Stability extraction
// ---------------------------------------------------------------------------

const STABILITY_RE =
  /Stable\s*\{\s*since:\s*Version\(RustcVersion\s*\{\s*major:\s*(\d+),\s*minor:\s*(\d+),\s*patch:\s*(\d+)\s*\}\)/;

function extractStability(item: RustdocItem): string | undefined {
  if (!item.attrs) return undefined;
  for (const attr of item.attrs) {
    const text = typeof attr === "string" ? attr : (attr.other ?? "");
    const match = STABILITY_RE.exec(text);
    if (match) {
      return `${match[1]}.${match[2]}.${match[3]}`;
    }
    // Check for unstable
    if (text.includes("Unstable")) {
      return "unstable";
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Feature extraction
// ---------------------------------------------------------------------------

// Matches feature gates in multiple formats found in rustdoc JSON attrs:
//   cfg(feature = "X")                                      — classic format
//   CfgTrace([... name: "feature", value: Some("X") ...])   — rustdoc JSON format v57+
//   doc(cfg(feature = "X"))                                  — docs.rs annotations (with --cfg docsrs)
const FEATURE_CLASSIC_RE = /feature\s*=\s*"([^"]+)"/g;
const FEATURE_CFGTRACE_RE = /name:\s*"feature",\s*value:\s*Some\("([^"]+)"\)/g;

function extractFeatures(item: RustdocItem): string[] | undefined {
  if (!item.attrs) return undefined;
  const features = new Set<string>();
  for (const attr of item.attrs) {
    const text = typeof attr === "string" ? attr : (attr.other ?? "");
    for (const match of text.matchAll(FEATURE_CLASSIC_RE)) {
      features.add(match[1]);
    }
    for (const match of text.matchAll(FEATURE_CFGTRACE_RE)) {
      features.add(match[1]);
    }
  }
  return features.size > 0 ? [...features] : undefined;
}

// ---------------------------------------------------------------------------
// Kind mapping
// ---------------------------------------------------------------------------

/** Maps rustdoc item kinds to RustSymbolKind values. */
function mapKind(rustdocKind: string): string {
  switch (rustdocKind) {
    case "struct":
      return "struct";
    case "enum":
      return "enum";
    case "trait":
      return "trait";
    case "function":
      return "function";
    case "type_alias":
      return "type-alias";
    case "constant":
      return "const";
    case "macro":
      return "symbol";
    default:
      return "struct";
  }
}

// ---------------------------------------------------------------------------
// Core generation logic
// ---------------------------------------------------------------------------

interface MemberEntry {
  name: string;
  kind: string;
  associated?: boolean;
  /** For kind: "variant" — the shape of the enum variant. */
  shape?: "unit" | "tuple" | "struct";
  since?: string;
  features?: string[];
}

interface SymbolEntry {
  name: string;
  kind: string;
  since?: string;
  features?: string[];
  members?: MemberEntry[];
  /** Rustdoc item ID, used for extracting members after walk */
  itemId?: string;
}

interface GeneratorState {
  data: RustdocJson;
  modules: Map<string, SymbolEntry[]>;
  skipModules: Set<string>;
  extractFeaturesFlag: boolean;
}

function createGeneratorState(
  data: RustdocJson,
  skipModules: Set<string>,
  extractFeaturesFlag: boolean = false,
): GeneratorState {
  return { data, modules: new Map(), skipModules, extractFeaturesFlag };
}

function addSymbol(
  state: GeneratorState,
  modulePath: string,
  name: string,
  kind: string,
  since?: string,
  itemId?: string,
  features?: string[],
) {
  let syms = state.modules.get(modulePath);
  if (!syms) {
    syms = [];
    state.modules.set(modulePath, syms);
  }
  if (!syms.some((s) => s.name === name)) {
    syms.push({ name, kind, since, itemId, features });
  }
}

function isSkipped(state: GeneratorState, path: string): boolean {
  if (!path) return false;
  const topLevel = path.split("::")[0];
  return state.skipModules.has(topLevel);
}

function getItemKind(item: RustdocItem): string | null {
  if (!item.inner) return null;
  const keys = Object.keys(item.inner);
  return keys.length > 0 ? keys[0] : null;
}

function walkModule(
  state: GeneratorState,
  moduleItem: RustdocItem,
  modulePath: string,
) {
  if (isSkipped(state, modulePath)) return;

  const inner = moduleItem.inner?.module as { items: string[] } | undefined;
  if (!inner) return;

  for (const childId of inner.items || []) {
    const child = state.data.index[childId];
    if (!child || child.visibility !== "public") continue;

    const kind = getItemKind(child);
    if (!kind || !child.name) {
      if (kind === "use") handleUseItem(state, child, modulePath);
      continue;
    }

    if (kind === "module") {
      const childPath = modulePath
        ? `${modulePath}::${child.name}`
        : child.name;
      walkModule(state, child, childPath);
    } else if (kind === "use") {
      handleUseItem(state, child, modulePath);
    } else if (ACCEPTED_KINDS.has(kind)) {
      const since = extractStability(child);
      const feat = state.extractFeaturesFlag
        ? extractFeatures(child)
        : undefined;
      addSymbol(
        state,
        modulePath,
        child.name,
        mapKind(kind),
        since,
        String(childId),
        feat,
      );
    }
  }
}

function handleUseItem(
  state: GeneratorState,
  item: RustdocItem,
  modulePath: string,
) {
  const useInner = item.inner?.use as
    | { source: string; name: string | null; id: string; is_glob: boolean }
    | undefined;
  if (!useInner || useInner.is_glob) return;

  const name = useInner.name || item.name;
  if (!name) return;

  let kind: string | null = null;
  const target = state.data.index[useInner.id];
  if (target) kind = getItemKind(target);

  if (!kind) {
    const pathInfo = state.data.paths[useInner.id];
    if (
      pathInfo &&
      (pathInfo.kind === "module" || ACCEPTED_KINDS.has(pathInfo.kind))
    ) {
      kind = pathInfo.kind;
    }
  }

  if (kind && (kind === "module" || ACCEPTED_KINDS.has(kind))) {
    if (kind === "module") {
      const childPath = modulePath ? `${modulePath}::${name}` : name;
      if (target) {
        walkModule(state, target, childPath);
      } else {
        walkExternalModule(state, useInner.id, childPath);
      }
    } else {
      const since = target ? extractStability(target) : undefined;
      const feat =
        state.extractFeaturesFlag && target
          ? extractFeatures(target)
          : undefined;
      addSymbol(
        state,
        modulePath,
        name,
        mapKind(kind),
        since,
        String(useInner.id),
        feat,
      );
    }
  }
}

function walkExternalModule(
  state: GeneratorState,
  modulePathId: string,
  targetModulePath: string,
) {
  if (isSkipped(state, targetModulePath)) return;

  const modulePath = state.data.paths[modulePathId];
  if (!modulePath) return;

  const modSuffix = modulePath.path.slice(1).join("::");
  if (!modSuffix) return;

  // Scan all crate prefixes — the re-exporting crate exposes everything
  const prefixes = new Set<string>();
  prefixes.add(modulePath.path.join("::"));
  for (const [, crate] of Object.entries(state.data.external_crates)) {
    prefixes.add(`${crate.name}::${modSuffix}`);
  }
  // Also check the crate's own name
  const root = state.data.index[state.data.root];
  if (root?.name) prefixes.add(`${root.name}::${modSuffix}`);

  for (const [, pathInfo] of Object.entries(state.data.paths)) {
    if (pathInfo.kind === "module" || pathInfo.kind === "primitive") continue;
    if (!ACCEPTED_KINDS.has(pathInfo.kind)) continue;

    const fullPath = pathInfo.path.join("::");
    for (const prefix of prefixes) {
      if (!fullPath.startsWith(prefix + "::")) continue;
      const remainder = fullPath.substring(prefix.length + 2);
      if (remainder.includes("::")) continue;
      addSymbol(state, targetModulePath, remainder, mapKind(pathInfo.kind));
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Prelude extraction
// ---------------------------------------------------------------------------

interface PreludeSet {
  edition: string;
  types: Set<string>;
}

const PRELUDE_USE_SUPPRESS_KINDS = new Set([
  "struct",
  "enum",
  "trait",
  "variant",
  "type_alias",
]);

const PRIMITIVES = [
  "bool",
  "char",
  "f32",
  "f64",
  "i8",
  "i16",
  "i32",
  "i64",
  "i128",
  "isize",
  "u8",
  "u16",
  "u32",
  "u64",
  "u128",
  "usize",
  "str",
];

function findChildModule(
  data: RustdocJson,
  parentItem: RustdocItem,
  name: string,
): RustdocItem | null {
  const items =
    (parentItem.inner?.module as { items: string[] } | undefined)?.items || [];
  for (const id of items) {
    const item = data.index[id];
    if (item && item.name === name) return item;
  }
  return null;
}

function extractPreludeTypes(
  data: RustdocJson,
  moduleItem: RustdocItem,
  nameToModules: Map<string, Set<string>>,
): Set<string> {
  const types = new Set<string>();
  const items =
    (moduleItem.inner?.module as { items: string[] } | undefined)?.items || [];

  for (const childId of items) {
    const child = data.index[childId];
    if (!child || child.visibility !== "public") continue;
    if (getItemKind(child) !== "use") continue;

    const useInner = child.inner?.use as
      | { name: string | null; id: string; is_glob: boolean }
      | undefined;
    if (!useInner || useInner.is_glob) continue;

    const name = useInner.name || child.name;
    if (!name) continue;

    let targetKind: string | null = null;
    const target = data.index[useInner.id];
    if (target) targetKind = getItemKind(target);
    const pathInfo = data.paths[useInner.id];
    if (!targetKind && pathInfo) targetKind = pathInfo.kind;

    if (!targetKind || !PRELUDE_USE_SUPPRESS_KINDS.has(targetKind)) continue;

    // Emit `<module>::<name>` using the module path our own walker placed
    // this symbol at. This matches the path `buildModulePath` produces in
    // reference.tsx when resolving a refkey, and disambiguates same-named
    // symbols in different modules (e.g. `result::Result` vs `fmt::Result`).
    //
    // When a name exists in multiple modules (e.g. `Result` in both `result`
    // and `thread`), prefer the one matching the rustdoc canonical path so
    // we pick the truly-in-prelude variant.
    const candidates = nameToModules.get(name);
    let modulePath: string | undefined;
    if (candidates && candidates.size > 0) {
      if (candidates.size === 1) {
        modulePath = [...candidates][0];
      } else if (pathInfo?.path) {
        // Rustdoc canonical path like ["core", "result", "Result"]. The
        // immediate parent module is the second-to-last segment.
        const canonicalModule = pathInfo.path.slice(1, -1).join("::");
        modulePath = candidates.has(canonicalModule)
          ? canonicalModule
          : [...candidates][0];
      } else {
        modulePath = [...candidates][0];
      }
    }
    types.add(modulePath ? `${modulePath}::${name}` : name);
  }

  return types;
}

function extractPrelude(
  data: RustdocJson,
  preludeModule: RustdocItem,
  coreData: RustdocJson | null,
  nameToModules: Map<string, Set<string>>,
): PreludeSet[] {
  const results: PreludeSet[] = [];

  // Extract v1 (base) prelude
  const v1Module = findChildModule(data, preludeModule, "v1");
  if (v1Module) {
    const types = extractPreludeTypes(data, v1Module, nameToModules);
    if (types.size > 0) results.push({ edition: "v1", types });
  }

  // For edition-specific preludes, the items are glob re-exports
  // of core::prelude::rust_XXXX. We need core's rustdoc to resolve them.
  const corePreludeModule = coreData
    ? findChildModule(coreData, coreData.index[coreData.root], "prelude")
    : null;

  for (const editionName of [
    "rust_2015",
    "rust_2018",
    "rust_2021",
    "rust_2024",
  ]) {
    const edition = editionName.replace("rust_", "");

    // Start with v1 types as base
    const v1Types = results.find((r) => r.edition === "v1")?.types;
    const types = new Set<string>(v1Types);

    // Add edition-specific types from core's prelude if available
    if (corePreludeModule) {
      const coreEditionModule = findChildModule(
        coreData!,
        corePreludeModule,
        editionName,
      );
      if (coreEditionModule) {
        const editionTypes = extractPreludeTypes(
          coreData!,
          coreEditionModule,
          nameToModules,
        );
        for (const t of editionTypes) types.add(t);
      }
    }

    // Also check non-glob use items in std's edition module
    const stdEditionModule = findChildModule(data, preludeModule, editionName);
    if (stdEditionModule) {
      const stdTypes = extractPreludeTypes(
        data,
        stdEditionModule,
        nameToModules,
      );
      for (const t of stdTypes) types.add(t);
    }

    results.push({ edition, types });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

const JS_RESERVED = new Set([
  "abstract",
  "arguments",
  "await",
  "boolean",
  "break",
  "byte",
  "case",
  "catch",
  "char",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "double",
  "else",
  "enum",
  "eval",
  "export",
  "extends",
  "false",
  "final",
  "finally",
  "float",
  "for",
  "function",
  "goto",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "int",
  "interface",
  "let",
  "long",
  "native",
  "new",
  "null",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "short",
  "static",
  "super",
  "switch",
  "synchronized",
  "this",
  "throw",
  "throws",
  "transient",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "volatile",
  "while",
  "with",
  "yield",
]);

function sanitizeIdentifier(name: string): string {
  const cleaned = name.replace(/-/g, "_");
  if (JS_RESERVED.has(cleaned)) return `${cleaned}_`;
  return cleaned;
}

function pascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

function moduleVarName(modulePath: string): string {
  return modulePath === ""
    ? "mod_root"
    : "mod_" + sanitizeIdentifier(modulePath.replace(/::/g, "_"));
}

// ---------------------------------------------------------------------------
// Convert an extracted SymbolEntry / MemberEntry to a plain JS object so
// Alloy's ObjectExpression can render it. Ordering of keys here determines
// ordering in the output; keep `kind` first to match existing files, and
// `features` immediately after (matches the layout the old generator emitted
// and what create-crate's consumers expect visually).
// ---------------------------------------------------------------------------

function symbolToJsValue(sym: SymbolEntry): Record<string, unknown> {
  const value: Record<string, unknown> = { kind: sym.kind };
  if (sym.features && sym.features.length > 0) value.features = sym.features;
  if (sym.since) value.metadata = { since: sym.since };
  if (sym.members && sym.members.length > 0) {
    const members: Record<string, unknown> = {};
    for (const m of sym.members) members[m.name] = memberToJsValue(m);
    value.members = members;
  }
  return value;
}

function memberToJsValue(m: MemberEntry): Record<string, unknown> {
  const value: Record<string, unknown> = { kind: m.kind };
  if (m.associated) value.associated = true;
  if (m.shape) value.shape = m.shape;
  if (m.features && m.features.length > 0) value.features = m.features;
  if (m.since) value.metadata = { since: m.since };
  return value;
}

function symbolsToJsValue(symbols: SymbolEntry[]): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  for (const sym of symbols) value[sym.name] = symbolToJsValue(sym);
  return value;
}

// ---------------------------------------------------------------------------
// Alloy components for emitted files
// ---------------------------------------------------------------------------

interface ModuleFileProps {
  fileName: string;
  entries: [string, SymbolEntry[]][];
  formatVersion: number;
  importBase: string | null;
}

function ModuleFile(props: ModuleFileProps) {
  const importPath = props.importBase ?? "../../create-crate.js";
  return (
    <SourceFile
      path={props.fileName}
      header={code`
        // Generated by scripts/generate-crate-descriptor.tsx
        // Source: rustdoc JSON format version ${props.formatVersion}
      `}
    >
      {code`import type { SymbolDescriptor } from "${importPath}";`}
      {hbr()}
      {hbr()}
      <For each={props.entries} doubleHardline>
        {([modulePath, symbols]) => (
          <VarDeclaration export const name={moduleVarName(modulePath)}>
            <ObjectExpression jsValue={symbolsToJsValue(symbols)} />
            {" as const satisfies Record<string, SymbolDescriptor>;"}
          </VarDeclaration>
        )}
      </For>
    </SourceFile>
  );
}

interface IndexFileProps {
  crateName: string;
  crateVersion: string | null;
  builtin: boolean;
  formatVersion: number;
  moduleFiles: { fileName: string; modulePaths: string[] }[];
  allModulePaths: string[];
  hasRootModule: boolean;
  importBase: string | null;
}

function IndexFile(props: IndexFileProps) {
  const descriptorName = `${sanitizeIdentifier(props.crateName)}Descriptor`;
  const typeName = `${pascalCase(props.crateName)}Crate`;
  const crateExport = sanitizeIdentifier(props.crateName);
  const crateImportPath = props.importBase ?? "../../create-crate.js";

  const descriptorObj: Record<string, unknown> = { name: props.crateName };
  if (props.crateVersion && props.crateVersion !== "0.0.0") {
    descriptorObj.version = props.crateVersion;
  }
  if (props.builtin) {
    descriptorObj.builtin = true;
  }

  // Submodule paths are everything except the root (""); the root symbols are
  // spread into `items` via `...mod_root` rather than keyed under "".
  const subModulePaths = props.allModulePaths.filter((p) => p !== "");

  return (
    <SourceFile
      path="index.ts"
      header={code`
        // Generated by scripts/generate-crate-descriptor.tsx
        // Source: rustdoc JSON format version ${props.formatVersion}
      `}
    >
      {code`import { type SymbolCreator } from "@alloy-js/core";`}
      {hbr()}
      {code`
        import {
          type CrateDescriptor,
          type CrateRef,
          createCrate,
          type ExternalCrate,
        } from "${crateImportPath}";
      `}
      {hbr()}
      <For each={props.moduleFiles}>
        {({ fileName, modulePaths }) => {
          const vars = modulePaths.map(moduleVarName).join(", ");
          const jsName = fileName.replace(/\.ts$/, ".js");
          return code`import { ${vars} } from "./${jsName}";`;
        }}
      </For>
      {hbr()}
      {hbr()}
      <VarDeclaration const name={descriptorName}>
        <ObjectExpression jsValue={descriptorObj}>
          <ObjectProperty
            name="items"
            value={
              <ObjectExpression>
                {props.hasRootModule && [
                  <ObjectSpreadProperty value={moduleVarName("")} />,
                  ",",
                  subModulePaths.length > 0 && hbr(),
                ]}
                <For each={subModulePaths} comma line enderPunctuation>
                  {(modulePath) => (
                    <ObjectProperty
                      name={modulePath}
                      value={moduleVarName(modulePath)}
                    />
                  )}
                </For>
              </ObjectExpression>
            }
          />
        </ObjectExpression>
        {" as const satisfies CrateDescriptor;"}
      </VarDeclaration>
      {hbr()}
      {hbr()}
      {code`/** The \`${props.crateName}\` crate descriptor. */`}
      {hbr()}
      {code`
        export type ${typeName} = CrateRef<typeof ${descriptorName}> &
          SymbolCreator &
          ExternalCrate;
      `}
      {hbr()}
      {code`export const ${crateExport}: ${typeName} = createCrate(${descriptorName});`}
    </SourceFile>
  );
}

interface PreludeFileProps {
  formatVersion: number;
  preludeSets: PreludeSet[];
}

// Docblock explaining the `<module>::<name>` key format. Emitted at the top
// of prelude.ts so readers know why prelude entries aren't bare names.
const PRELUDE_KEY_FORMAT_DOC = `Key format
----------
Non-primitives are stored as \`<module>::<name>\` without a crate prefix
(e.g. \`result::Result\`, \`iter::Iterator\`). Primitives are bare names
(\`bool\`, \`i32\`, ...).

The \`<module>::<name>\` form disambiguates same-named symbols in
different modules — e.g. \`result::Result\` is in the prelude,
\`fmt::Result\` is not.

The crate prefix is intentionally omitted so one entry covers the
\`std\` / \`core\` / \`alloc\` variants of the same canonical symbol.
This is safe because every prelude item is a pure re-export: the
std/core/alloc prelude entries all resolve to the same canonical
symbol (and \`addSymbol\` in the generator deduplicates on merge,
so std wins if there's ever a divergence). Types that genuinely
diverge across crates (e.g. \`std::sync::Mutex\` is additive over
\`core::sync\`, or \`panic!\` which is a macro) are not in this set.`;

function PreludeFile(props: PreludeFileProps) {
  // Build combined set from all editions, plus primitives.
  const allTypes = new Set<string>(PRIMITIVES);
  for (const ps of props.preludeSets) {
    for (const t of ps.types) allTypes.add(t);
  }
  const allSorted = [...allTypes].sort();

  const editionSets = props.preludeSets.filter((ps) => ps.edition !== "v1");

  return (
    <SourceFile
      path="prelude.ts"
      header={code`
        // Generated by scripts/generate-crate-descriptor.tsx
        // Source: rustdoc JSON format version ${props.formatVersion}
      `}
    >
      {code`/**\n${PRELUDE_KEY_FORMAT_DOC.split("\n")
        .map((l) => (l.length > 0 ? ` * ${l}` : ` *`))
        .join("\n")}\n */`}
      {hbr()}
      {hbr()}
      <VarDeclaration
        export
        const
        name="PRELUDE_TYPES"
        doc="Types, traits, enum variants, and primitives that are automatically in scope via the Rust prelude. References to these do not need `use` statements. This is the union of all edition preludes (2015–2024) plus primitive types."
      >
        {"new Set<string>("}
        <ArrayExpression jsValue={allSorted} />
        {");"}
      </VarDeclaration>
      {hbr()}
      {hbr()}
      <For each={editionSets} doubleHardline>
        {(ps) => {
          const withPrims = [...new Set([...ps.types, ...PRIMITIVES])].sort();
          return (
            <VarDeclaration
              export
              const
              name={`PRELUDE_TYPES_${ps.edition}`}
              doc={`Prelude types for the ${ps.edition} edition.`}
            >
              {"new Set<string>("}
              <ArrayExpression jsValue={withPrims} />
              {");"}
            </VarDeclaration>
          );
        }}
      </For>
    </SourceFile>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const cli = parseArgs();

const data: RustdocJson = JSON.parse(
  readFileSync(resolve(cli.jsonPath), "utf-8"),
);

// Extract crate name from the root module
const root = data.index[data.root];
if (!root) {
  console.error("Could not find root module in index");
  process.exit(1);
}

const crateName = root.name ?? "unknown";
const crateVersion = data.crate_version;

console.log(`Crate: ${crateName} ${crateVersion ?? "(no version)"}`);
console.log(`Rustdoc JSON format version: ${data.format_version}`);
console.log(`Index items: ${Object.keys(data.index).length}`);
console.log(`Builtin: ${cli.builtin}`);

// Merge skip modules: CLI-provided + defaults for std-family crates
const skipModules = new Set(cli.skipModules);
if (["std", "core", "alloc"].includes(crateName)) {
  for (const m of DEFAULT_STD_SKIP) skipModules.add(m);
}

// Walk the module tree
const state = createGeneratorState(data, skipModules, cli.extractFeatures);
walkModule(state, root, "");

// For std-like crates, also walk the prelude to pick up re-exports
const preludeModule = findChildModule(data, root, "prelude");
if (preludeModule && crateName === "std") {
  // Walk v1 prelude to pick up types for the crate descriptor
  const v1Module = findChildModule(data, preludeModule, "v1");
  if (v1Module) {
    const v1Items =
      (v1Module.inner?.module as { items: string[] } | undefined)?.items || [];

    for (const childId of v1Items) {
      const child = data.index[childId];
      if (!child || child.visibility !== "public") continue;
      if (getItemKind(child) !== "use") continue;

      const useInner = child.inner?.use as
        | { source: string; name: string | null; id: string; is_glob: boolean }
        | undefined;
      if (!useInner || useInner.is_glob) continue;

      const name = useInner.name || child.name;
      if (!name) continue;

      let targetKind: string | null = null;
      const target = data.index[useInner.id];
      if (target) targetKind = getItemKind(target);
      if (!targetKind) {
        const pathInfo = data.paths[useInner.id];
        if (pathInfo) targetKind = pathInfo.kind;
      }
      if (!targetKind || !ACCEPTED_KINDS.has(targetKind)) continue;

      // Map to canonical module using paths table
      const pathInfo = data.paths[String(useInner.id)];
      if (!pathInfo) continue;

      // For prelude items, determine the std module they belong to
      // by checking what module they're re-exported from
      const sourcePath = pathInfo.path;
      const typeName = sourcePath[sourcePath.length - 1];

      // Find which module in our descriptor already has this type
      let placed = false;
      for (const [, syms] of state.modules) {
        if (syms.some((s) => s.name === typeName)) {
          placed = true;
          break;
        }
      }

      // If not already placed, add to root module
      if (!placed) {
        const since = target ? extractStability(target) : undefined;
        addSymbol(state, "", name, mapKind(targetKind), since);
      }
    }

    console.log("Prelude v1 items processed");
  }
}

// ---------------------------------------------------------------------------
// Extract inherent methods from impl blocks
// ---------------------------------------------------------------------------

const MEMBER_KINDS = new Set(["struct", "enum", "trait"]);

function extractMembers(genState: GeneratorState) {
  let totalMembers = 0;

  for (const [, symbols] of genState.modules) {
    for (const sym of symbols) {
      if (!sym.itemId || !MEMBER_KINDS.has(sym.kind)) continue;

      const item = genState.data.index[sym.itemId];
      if (!item) continue;

      const inner = item.inner?.[
        sym.kind === "type-alias" ? "type_alias" : sym.kind
      ] as { impls?: string[]; variants?: string[] } | undefined;
      if (!inner) continue;

      const members: MemberEntry[] = [];

      if (sym.kind === "enum" && inner.variants) {
        for (const variantId of inner.variants) {
          const variant = genState.data.index[variantId];
          if (!variant?.name) continue;
          const variantInner = variant.inner?.variant as
            | { kind?: unknown }
            | undefined;
          const rawKind = variantInner?.kind;
          let shape: "unit" | "tuple" | "struct";
          if (rawKind === "plain") {
            shape = "unit";
          } else if (
            typeof rawKind === "object" &&
            rawKind !== null &&
            "tuple" in rawKind
          ) {
            shape = "tuple";
          } else if (
            typeof rawKind === "object" &&
            rawKind !== null &&
            "struct" in rawKind
          ) {
            shape = "struct";
          } else {
            continue;
          }
          members.push({
            name: variant.name,
            kind: "variant",
            shape,
            since: extractStability(variant),
            features: genState.extractFeaturesFlag
              ? extractFeatures(variant)
              : undefined,
          });
        }
      }

      if (!inner.impls) {
        if (members.length > 0) {
          members.sort((a, b) => a.name.localeCompare(b.name));
          sym.members = members;
          totalMembers += members.length;
        }
        continue;
      }

      for (const implId of inner.impls) {
        const impl = genState.data.index[implId];
        if (!impl?.inner?.impl) continue;
        const implInner = impl.inner.impl as {
          trait?: unknown;
          items?: string[];
        };

        // Only inherent impls (no trait impls)
        if (implInner.trait) continue;

        for (const methodId of implInner.items || []) {
          const method = genState.data.index[methodId];
          if (!method || method.visibility !== "public" || !method.name)
            continue;

          const methodKind = getItemKind(method);
          if (methodKind !== "function") continue;

          const sig = (
            method.inner?.function as { sig?: { inputs?: [string, unknown][] } }
          )?.sig;
          const hasSelfReceiver = sig?.inputs?.some(
            ([name]) => name === "self",
          );

          if (!members.some((m) => m.name === method.name)) {
            members.push({
              name: method.name!,
              kind: "function",
              associated: hasSelfReceiver ? undefined : true,
              since: extractStability(method),
              features: genState.extractFeaturesFlag
                ? extractFeatures(method)
                : undefined,
            });
          }
        }
      }

      if (members.length > 0) {
        members.sort((a, b) => a.name.localeCompare(b.name));
        sym.members = members;
        totalMembers += members.length;
      }
    }
  }

  console.log(`Extracted ${totalMembers} inherent methods`);
}

// ---------------------------------------------------------------------------
// Merge modules from other crates (--merge-from)
// ---------------------------------------------------------------------------
// Used for crates that re-export from dependencies (e.g., std re-exports
// core and alloc). We walk each source crate's rustdoc and merge its
// modules into our state, so the output includes the full re-exported API.

for (const mergePath of cli.mergeFrom) {
  const mergeData: RustdocJson = JSON.parse(
    readFileSync(resolve(mergePath), "utf-8"),
  );
  const mergeRoot = mergeData.index[mergeData.root];
  if (!mergeRoot) continue;

  const mergeName = mergeRoot.name ?? "unknown";
  const mergeState = createGeneratorState(
    mergeData,
    skipModules,
    cli.extractFeatures,
  );
  walkModule(mergeState, mergeRoot, "");

  // Extract members in the merge state BEFORE merging (uses merge data's index)
  extractMembers(mergeState);

  // Merge into main state: for each module in the source crate,
  // add its symbols (with members) to the corresponding module in our state
  let mergedCount = 0;
  for (const [modulePath, symbols] of mergeState.modules) {
    for (const sym of symbols) {
      // Add the symbol — if it already exists, skip (deduplication in addSymbol)
      addSymbol(
        state,
        modulePath,
        sym.name,
        sym.kind,
        sym.since,
        sym.itemId,
        sym.features,
      );
      // If the merged symbol has members and the main state's copy doesn't, transfer them
      if (sym.members) {
        const mainSyms = state.modules.get(modulePath);
        if (mainSyms) {
          const mainSym = mainSyms.find((s) => s.name === sym.name);
          if (mainSym && !mainSym.members) {
            mainSym.members = sym.members;
          }
        }
      }
      mergedCount++;
    }
  }

  console.log(`Merged ${mergedCount} symbols from ${mergeName}`);
}

extractMembers(state);

// Sort and print summary
const sortedModules = [...state.modules.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
);
let totalSymbols = 0;
for (const [, syms] of sortedModules) {
  syms.sort((a, b) => a.name.localeCompare(b.name));
  totalSymbols += syms.length;
}
console.log(`\nModules: ${sortedModules.length}, Symbols: ${totalSymbols}`);

for (const [mod, syms] of sortedModules) {
  const names = syms.map((s) => s.name);
  const display =
    names.length > 8
      ? `${names.slice(0, 8).join(", ")}, ... +${names.length - 8}`
      : names.join(", ");
  console.log(`  ${mod || "(root)"} [${syms.length}]: ${display}`);
}

// ---------------------------------------------------------------------------
// Compose the output tree and render it
// ---------------------------------------------------------------------------

const scriptDir = dirname(new URL(import.meta.url).pathname);
const defaultOutDir = join(scriptDir, "..", "src", "builtins", crateName);
const outDir = cli.outPath ? resolve(cli.outPath) : defaultOutDir;

// The crate directory lives beneath outDir's parent, and prelude.ts (when
// requested) sits alongside it. We anchor the Output at that parent so
// SourceDirectory + sibling SourceFile produce the right layout.
const outputRoot = dirname(outDir);
const crateDirName = basename(outDir);

// Group modules by top-level namespace so each file holds one top-level's
// submodules (matches the existing layout and keeps generated files small).
const topLevelModules = new Map<string, [string, SymbolEntry[]][]>();
for (const [modulePath, symbols] of sortedModules) {
  const topLevel = modulePath === "" ? "root" : modulePath.split("::")[0];
  if (!topLevelModules.has(topLevel)) {
    topLevelModules.set(topLevel, []);
  }
  topLevelModules.get(topLevel)!.push([modulePath, symbols]);
}

const topLevelEntries = [...topLevelModules.entries()].sort(([a], [b]) =>
  a.localeCompare(b),
);

const moduleFiles = topLevelEntries.map(([topLevel, entries]) => ({
  fileName: `${topLevel}.ts`,
  modulePaths: entries.map(([modulePath]) => modulePath),
}));

const allModulePaths = sortedModules.map(([modulePath]) => modulePath);
const hasRootModule = allModulePaths.includes("");

let preludeSets: PreludeSet[] | null = null;
if (cli.prelude && preludeModule) {
  const coreData: RustdocJson | null = cli.preludeSource
    ? JSON.parse(readFileSync(resolve(cli.preludeSource), "utf-8"))
    : null;
  // Build a name -> set of module paths map from the walker's output. This
  // tells us where our generated builtins place each symbol (e.g. `Iterator`
  // in `iter`, not `iter::traits::iterator`) so prelude entries match the
  // paths reference.tsx builds at resolution time. A name can appear in
  // multiple modules (e.g. `Result` in both `result` and `thread`); the
  // prelude extractor picks the right one by matching against the rustdoc
  // canonical path.
  const nameToModules = new Map<string, Set<string>>();
  for (const [modulePath, syms] of state.modules) {
    if (!modulePath) continue;
    for (const sym of syms) {
      let set = nameToModules.get(sym.name);
      if (!set) {
        set = new Set();
        nameToModules.set(sym.name, set);
      }
      set.add(modulePath);
    }
  }
  preludeSets = extractPrelude(data, preludeModule, coreData, nameToModules);
  for (const ps of preludeSets) {
    console.log(`  Prelude ${ps.edition}: ${ps.types.size} types`);
  }
}

await writeOutput(
  await renderAsync(
    <Output basePath={outputRoot}>
      <SourceDirectory path={crateDirName}>
        <For each={topLevelEntries}>
          {([topLevel, entries]) => (
            <ModuleFile
              fileName={`${topLevel}.ts`}
              entries={entries}
              formatVersion={data.format_version}
              importBase={cli.importBase}
            />
          )}
        </For>
        <IndexFile
          crateName={crateName}
          crateVersion={crateVersion}
          builtin={cli.builtin}
          formatVersion={data.format_version}
          moduleFiles={moduleFiles}
          allModulePaths={allModulePaths}
          hasRootModule={hasRootModule}
          importBase={cli.importBase}
        />
      </SourceDirectory>
      <Show when={preludeSets !== null}>
        <PreludeFile
          formatVersion={data.format_version}
          preludeSets={preludeSets!}
        />
      </Show>
    </Output>,
  ),
);

console.log(
  `\nWrote ${outDir}/ (${topLevelModules.size} module files + index.ts)${
    preludeSets ? ` and ${join(outputRoot, "prelude.ts")}` : ""
  }`,
);

const formatTargets = [outDir];
if (preludeSets) {
  formatTargets.push(join(outputRoot, "prelude.ts"));
}

console.log(`\nFormatting ${formatTargets.length} target(s) with prettier...`);
const prettierResult = spawnSync(
  "npx",
  ["prettier", "--write", "--log-level=warn", ...formatTargets],
  { stdio: "inherit" },
);
if (prettierResult.status !== 0) {
  console.error("Prettier exited with status", prettierResult.status);
  process.exit(prettierResult.status ?? 1);
}
