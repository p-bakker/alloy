# Rustfmt Conformance — Implementation Plan

Companion to `rustfmt-conformance-scope.md` (the target) and
`rustfmt-gap-and-architecture.md` (the gap). This document slices the
architecture into PR-sized units of work.

## Ground rules

- **Each slice ships independently.** One PR, tests green on `main`, no
  long-running branches, no half-done merges.
- **Self-contained.** A slice adds only the `RustFormatOptions` fields
  and Layer 2 primitives it actually wires. No scaffold-for-later.
- **Ordering preference: low-hanging fruit first, cross-package last.**
  Hard deps are flagged; otherwise prefer `rust-only` slices before any
  `cross-package` (rust + core) change. Local bug fixes → construct
  rewrites → core-primitive landings → heuristic retrofits.
- **Preserve current behaviour that doesn't conflict.** Keep as the
  emitter's default, but re-implement through the right Layer 2 / Layer
  5 primitive — never hardcode into every component. Document each
  preserved behaviour as a future `emitter.*` customization candidate;
  ship no option until demand materialises.
- **Fix what conflicts.** Match block-arm trailing comma, `struct Foo;`
  unit form, empty item bodies on one line, etc.
- **Tests per slice.** Extend the per-construct `*.test.tsx` file(s)
  with fixtures asserted against `rustfmt --check` across every
  edition the helper knows about (2015, 2018, 2021, 2024, and any
  future edition added to the list). No umbrella conformance scaffold.
- **No regressions + end-to-end snapshot.** Before opening the PR:
  1. Run the full workspace test suite — zero failures in
     `packages/rust/` and its dependents.
  2. Regenerate the `samples/rust-example` output (build TypeScript
     first, then `pnpm -F rust-example generate`) and diff
     `samples/rust-example/output/src/*.rs` against `HEAD`. Either
     the diff is empty (behaviour preserved), or it reflects exactly
     the change the slice intends — in which case the updated `.rs`
     files ship as part of the slice's PR so the tracked snapshot
     stays current.
  3. Run `rustfmt --check --edition 2024 --config newline_style=Unix`
     against the regenerated `.rs` files and record the failure count.
     The sample is **not** conformant today (baseline: see §Baseline
     below). Each slice must not _introduce_ new failures, and is
     expected to _reduce_ the count by the violations it scopes.
     (The sample's `vitest` tests already cover behavioural expectations;
     don't duplicate those in the plan.)

**Baseline — sample conformance failures as of this plan.**

Run `rustfmt --check --edition 2024 --config newline_style=Unix
src/lib.rs` in `samples/rust-example/output/` to reproduce. Each
failure is mapped to the slice that clears it.

| File        | Violation                                                                                                                                                     | Slice   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `config.rs` | 4× `#[must_use]pub fn …` (attribute glued to item)                                                                                                            | **1.5** |
| `store.rs`  | 4× `return Err(…)` + stray-break-before-`;` and adjacent-statement-run bugs (`}let entry = …`, `};self.data.insert(…)`, `let before = …;self.data.retain(…)`) | **1.6** |
| `store.rs`  | 2× `#[inline]pub fn …`                                                                                                                                        | **1.5** |
| `store.rs`  | `},\n None =>` — block match arm with trailing comma                                                                                                          | **1.1** |
| `store.rs`  | `.remove(key).map(…).ok_or(StoreError::NotFound)` — 82-col method chain. Fits `max_width=100` but exceeds `chain_width=60`, so rustfmt wraps it regardless.  | **6.4** |
| `traits.rs` | `fn … where Self: Sized;` inline                                                                                                                              | **7.1** |
| `error.rs`  | — clean                                                                                                                                                       | —       |

**Sample-conformance milestone.** Landing P0 + 1.1 + 1.5 + 1.6 + 7.1 +
3.0 + 4.2 + 4.9 + 3.1 + 5.1 + 6.4 (in any dep-respecting order) turns
the sample's `rustfmt --check` count to zero. That is an explicit
early milestone — see the Recommended starting order. The chain
violation needs 6.4 (not 4.9) to clear because it's `chain_width`-
gated at 60, not `max_width`-gated at 100; 4.2 / 4.9 / 3.1 / 5.1 are
all prerequisites on that path.

Until it lands, step (3) above reduces to "diff against baseline,
don't regress." Once the baseline is clean, it flips to "must stay
clean" for every subsequent slice.

---

## Pre-req slice

### P0. Extend `rustfmt.ts` to check every supported edition

- **Name** — Parameterise `rustfmt.ts` over editions.
- **Category** — scope-violation fix (test-infrastructure).
- **Blast radius** — rust-only.
- **Scope** — in: (a) add `checkRustfmt(source, { edition })` taking a
  single edition string; (b) export a `SUPPORTED_EDITIONS` constant as
  the single source of truth — initial value
  `["2015", "2018", "2021", "2024"] as const` — with a type that
  mirrors the `RustFormatOptions.edition` type exactly (keep them in
  sync at compile time: derive one from the other rather than
  duplicating); (c) add a `checkRustfmtAllEditions(source,
editions?: readonly Edition[])` convenience that iterates
  `editions ?? SUPPORTED_EDITIONS` and asserts zero diff on each.
  Adding a new edition is a one-line change to `SUPPORTED_EDITIONS`
  plus a bump to the config union. Out: no changes to `rustfmt(source)`
  callers that already use it for formatting (they keep their existing
  edition).
- **Why** — scope doc §Edition handling commits us to byte-identical
  output across editions; on stable rustfmt today that's all four
  (2015/2018/2021/2024). The helper must accept future editions without
  a rewrite. Every subsequent slice uses this helper for its fixtures.
- **Changes** — `packages/rust/test/rustfmt.ts:12` (parameterise
  `--edition`); export `SUPPORTED_EDITIONS` and `Edition` type; add
  `checkRustfmtAllEditions`.
- **Config** — none (but the `Edition` type here must stay in sync with
  `RustFormatOptions.edition` once slice 3.4 lands — wire it through a
  shared type at that point).
- **Primitives** — none.
- **Tests** — self-test in a new `packages/rust/test/rustfmt.test.ts`:
  happy path across every edition in `SUPPORTED_EDITIONS`; a deliberate
  mismatch; a subset-editions call.
- **Depends on** — none.
- **Metric moved** — conformance-checking surface exists and is
  extensible; every later slice can assert `rustfmt --check` across
  all supported editions with one call.

---

## 1. Scope-violation fixes (rust-only, output changes)

Ordered by isolation (smallest blast radius first). Each is a pure bug
fix: `rustfmt --check` would reject the current output; the fix is a
local conditional. Each slice adds a targeted fixture asserted against
`checkRustfmtAllEditions`. Expect slices in this category to move the
tracked `samples/rust-example/output/src/*.rs` snapshots — ship the
updated `.rs` files as part of the same PR (see ground rules).

### 1.1 Drop trailing comma after block match arms

- **Name** — Drop trailing comma on block-bodied match arms.
- **Category** — scope-violation fix.
- **Blast radius** — rust-only.
- **Scope** — in: block-arm path at `match-expression.tsx:74`. Out: no
  change to non-block arms (still comma-terminated per §10); no
  width-awareness on arm RHS yet.
- **Why** — scope §4/§10, gap §2.9(a) row 1.
- **Changes** — `packages/rust/src/components/match-expression.tsx:74`
  emit `"}"` (not `"},"`) for the block-arm branch.
- **Config** — none.
- **Primitives** — none.
- **Tests** — `packages/rust/test/match-expression.test.tsx`: add a
  multi-statement block arm and assert `checkRustfmtAllEditions`.
- **Depends on** — P0.
- **Metric moved** — §10 block-arm rule conformant.

### 1.2 Emit `struct Foo;` for empty record struct

- **Name** — Collapse empty record struct to unit form.
- **Category** — scope-violation fix.
- **Blast radius** — rust-only.
- **Scope** — in: the `members.length === 0` branch in
  `struct-declaration.tsx`. Out: tuple-struct path (already
  `struct Foo();` when `tuple && types.length === 0` — unchanged), the
  explicit `props.unit` path (still `;`).
- **Why** — scope §3/§9, gap §2.9(a) row 2, Style Guide (items.html,
  Structs) — empty record/tuple struct → unit form.
- **Changes** — `packages/rust/src/components/struct-declaration.tsx:164`
  emit `";"` when `members.length === 0 && !props.tuple && !props.unit`.
- **Config** — none.
- **Primitives** — none.
- **Tests** — `packages/rust/test/struct.test.tsx`: update the existing
  "renders basic struct" fixture expectation (`struct Foo;`) and assert
  `checkRustfmtAllEditions`; add `pub struct Foo;` case.
- **Depends on** — P0.
- **Metric moved** — §9 empty-struct rule conformant.

### 1.3 Keep empty `fn`/`impl`/`trait` bodies on one line

- **Name** — Empty-item bodies on one line.
- **Category** — scope-violation fix.
- **Blast radius** — rust-only.
- **Scope** — in: the "has children" branch in
  `function-declaration.tsx`, `impl-block.tsx`, `trait-declaration.tsx`.
  When `children` normalises to empty (empty array, whitespace-only
  string, null), emit ` {}` instead of `" {"` + indented body + `hbr` +
  `"}"`. Out: non-empty bodies (unchanged); `where`-clause brace
  movement (separate slice).
- **Why** — scope §3 (`empty_item_single_line = true`), gap §2.9(a)
  rows 3–5.
- **Changes** —
  `packages/rust/src/components/function-declaration.tsx:127–136`,
  `packages/rust/src/components/impl-block.tsx:166–175`,
  `packages/rust/src/components/trait-declaration.tsx:82–91`. Normalise
  `props.children` (Array→filter→empty) before the ternary; empty
  goes to the existing ` {}` / `;` leg.
- **Config** — none.
- **Primitives** — none.
- **Tests** — `packages/rust/test/function.test.tsx`,
  `packages/rust/test/impl.test.tsx`, `packages/rust/test/trait.test.tsx`:
  one fixture each — `fn f() {}`, `impl T {}`, `trait T {}` — asserted
  against `checkRustfmtAllEditions`.
- **Depends on** — P0.
- **Metric moved** — §3 empty-item rule conformant across the three
  item kinds.

### 1.4 Emit single-line empty struct literal

- **Name** — `Foo {}` for empty struct literal.
- **Category** — scope-violation fix.
- **Blast radius** — rust-only.
- **Scope** — in: `struct-expression.tsx` when `fields.length === 0`
  and no `spread`. Emit `{" {}"}`. Out: single-line non-empty case
  (covered by slice 4.x struct-literal conversion); `..base` cases.
- **Why** — scope §9, §2.9(a) row 6 (empty-struct-literal behaviour
  note). At present the `fields.length > 0 || props.spread` gate
  correctly skips the indented body, but emits `"{" + "}"` with a
  space-less form that's actually OK for `rustfmt --check`. Audit: add
  test, only change code if diff.
- **Changes** — verify `packages/rust/src/components/struct-expression.tsx:25–50`
  against `checkRustfmtAllEditions` for `Foo {}`; adjust if diff.
- **Config** — none.
- **Primitives** — none.
- **Tests** — `packages/rust/test/struct-expression.test.tsx`: empty
  literal fixture.
- **Depends on** — P0.
- **Metric moved** — §9 empty-literal case audited and conformant.

### 1.5 `Attribute` self-terminates with `<hbr />`

- **Name** — Move the trailing break into `AttributeBase`.
- **Category** — scope-violation fix.
- **Blast radius** — rust-only.
- **Scope** — in: append `<hbr />` to `AttributeBase`'s output so
  every `<Attribute />` / `<InnerAttribute />` ends with a hard
  break. Drop the now-redundant `<For line>` joiner and trailing
  `<hbr />` from every item emitter's attribute-run branch
  (function, impl, trait, struct, enum, const, static, type-alias,
  mod). Out: attribute arg-list layout (slice 4.13);
  `inline_attribute_width` (unstable, not exposed).
- **Why** — scope §7 ("one attribute per line, same indent as the
  item") + `inline_attribute_width = 0` default. The current emitter
  only honours §7 when attributes flow through an item's
  `attributes` prop; `<Attribute />` used as a sibling of an item
  silently produces non-conformant output because `AttributeBase`
  has no trailing break. Making it self-terminating removes the
  footgun, makes both call shapes produce the same output, and
  clears the `#[must_use]pub fn` baseline violations in
  `samples/rust-example/output/src/config.rs` / `store.rs`.
- **Changes** — `packages/rust/src/components/attribute.tsx`
  (`AttributeBase` appends `<hbr />`); every item emitter listed in
  Scope drops the `<For line>` joiner and the trailing `<hbr />`
  from its attribute-run branch. `Field` and `EnumVariant` carry
  the same attribute-run pattern; audit them too.
- **Config** — none.
- **Primitives** — none.
- **Tests** — extend `packages/rust/test/attributes.test.tsx`:
  (a) stand-alone `<Attribute />` sibling of a fn — asserts
  `checkRustfmtAllEditions`;
  (b) multi-attribute via `attributes` prop — confirms no blank-line
  regression between successive attributes (i.e. no double `<hbr />`
  after the joiner-drop). Regenerate
  `samples/rust-example/output/src/config.rs` / `store.rs` — the
  `#[must_use]pub fn` / `#[inline]pub fn` diffs clear.
- **Depends on** — P0.
- **Metric moved** — §7 attribute-break rule conformant through
  both call shapes; six baseline violations cleared (four
  `#[must_use]` in `config.rs`, two `#[inline]` in `store.rs`).

### 1.5b Idiomatic sample: pass attributes via the `attributes` prop

- **Name** — Rewrite rust-example sample to thread attributes
  through each item's `attributes` prop.
- **Category** — idiomatic-sample cleanup.
- **Blast radius** — sample-only.
- **Scope** — in: update `samples/rust-example/src/components/`
  (`config-file.tsx`, `store-module.tsx`) to pass every
  `<Attribute name="must_use" />` / `<Attribute name="inline" />`
  through the sibling item's `attributes={[…]}` prop rather than
  as a JSX sibling. Sample output unchanged (both call shapes
  produce the same Rust post-slice 1.5).
- **Why** — both call shapes are conformant post-1.5, but the
  `attributes` prop is the more idiomatic form for structured
  attribute metadata: it keeps the attribute associated with its
  item in the component tree, and it's discoverable from the item
  component's prop surface. Sibling form is valid but reads as
  "loose" attribute declaration.
- **Changes** — `samples/rust-example/src/components/config-file.tsx`,
  `samples/rust-example/src/components/store-module.tsx`. No
  package source touched.
- **Config** — none.
- **Primitives** — none.
- **Tests** — sample regenerates byte-identical.
- **Depends on** — 1.5.
- **Metric moved** — sample uses the idiomatic form.

### 1.6 Statements own their terminator and line break

- **Name** — Fix stray-break before `;` and missing break between
  statements.
- **Category** — scope-violation fix.
- **Blast radius** — rust-only.
- **Scope** — in: two related bugs visible in
  `samples/rust-example/output/src/store.rs`:
  (a) `return Err(…)` followed by `\n    ;` — a `<hbr />` is emitted
  _inside_ the statement, before the terminator. Likely in
  `return-expression.tsx` or the caller that composes
  return-expression + `;`.
  (b) `};self.data.insert(…)` — two adjacent statements with no break.
  Likely the let-binding + subsequent-statement composition missing
  an `<hbr />` or routing through an ad-hoc joiner instead of a
  shared statement-run primitive. Out: block-level statement-run
  primitive (a preserved-behaviour rework; can land here or be
  deferred to a follow-up slice).
- **Why** — scope §5 (no space/break before `;`), §15 (each
  statement on its own line). Discovered via sample-snapshot check.
- **Changes** — `packages/rust/src/components/return-expression.tsx`
  audit (the `return <expr>` composition mustn't leak a break);
  `packages/rust/src/components/let-binding.tsx` or the call site
  that places statements.
- **Config** — none.
- **Primitives** — none new (may want `<StatementRun>` as a Layer 2
  extraction — defer if not trivially needed).
- **Tests** — extend `packages/rust/test/return-expression.test.tsx`
  and/or `packages/rust/test/let-binding.test.tsx` with a
  multi-statement block fixture; re-generate and commit the corrected
  `samples/rust-example/output/src/store.rs`.
- **Depends on** — P0.
- **Metric moved** — §§5/15 statement-layout rules conformant;
  `store.rs` baseline violation cleared.

---

t## 2. Preserved-behaviour rework (rust-only, output unchanged)

Gap §2.9(b). Behaviour stays on as the emitter's default; implementation
moves out of the one component that currently owns it. Each slice
documents the `emitter.*` customization candidate; none ship a field.
The `samples/rust-example/output/src/*.rs` snapshots should not move —
if they do, it's a sign the rework changed behaviour and the slice
needs to be re-scoped before merging.

### 2.1 Hoist three-bucket `use` grouping into an import-ordering pass

- **Name** — Move `std`/external/`crate` bucketing out of
  `UseStatements` into a pass.
- **Category** — preserved-behaviour rework.
- **Blast radius** — rust-only.
- **Scope** — in: extract the bucketing logic at
  `use-statement.tsx:96–122` into a pure function
  (`computeImportGroups(entries, opts)`) in a new
  `packages/rust/src/import-ordering.ts`. `UseStatements` becomes a
  pass that calls it. Out: within-group sort algorithm change (slice
  7.x); brace-list layout (slice 4.x); `imports_granularity` merging
  (not in scope).
- **Why** — gap §2.9(b), §2.10. Keep today's default, but make the
  policy swappable at one site so a future `emitter.groupImportsByOrigin`
  can flip it.
- **Changes** — new `packages/rust/src/import-ordering.ts`;
  `packages/rust/src/components/use-statement.tsx:93–144` reduced to
  render-only.
- **Config** — none shipped. **Document** the candidate:
  `emitter.groupImportsByOrigin: "off" | "std-external-crate" | "one"`
  — default `"std-external-crate"`, mirroring rustfmt's unstable
  `group_imports`.
- **Primitives** — none (no user-facing layout change).
- **Tests** — `packages/rust/test/use-statements.test.tsx` +
  `packages/rust/test/imports.test.tsx`: existing snapshots continue
  to pass unchanged.
- **Depends on** — none.
- **Metric moved** — bucketing policy lives in one replaceable place.

### 2.2 Hoist inter-kind blank line into a shared `ItemRun` primitive

- **Name** — Centralise blank-line-between-item-kinds policy.
- **Category** — preserved-behaviour rework.
- **Blast radius** — rust-only.
- **Scope** — in: the hardcoded double-`<hbr />` at
  `source-file.tsx:132–138`; introduce `<ItemRun>` (Layer 2) that
  consumes a list of `{ kind, node }` groups and emits one blank line
  between distinct kinds (mod decls → use-run → items). Out: blank
  lines _inside_ bodies; `blank_lines_upper_bound` enforcement (not
  a scope requirement).
- **Why** — gap §2.9(b), §2.10.
- **Changes** —
  new `packages/rust/src/components/item-run.tsx`;
  `packages/rust/src/components/source-file.tsx:128–143` routes through
  `<ItemRun>`.
- **Config** — none shipped. **Document** candidate:
  `emitter.blankLinesBetweenItemKinds: boolean` — default `true`.
- **Primitives** — Layer 2: `<ItemRun>`.
- **Tests** — `packages/rust/test/source-file-crate-directory.test.tsx`
  - `packages/rust/test/module-structure.test.tsx`: existing snapshots
    continue to pass.
- **Depends on** — none.
- **Metric moved** — inter-kind blank line policy lives in one place.

---

## 3. Option wirings (rust-only, no layout work)

Each slice adds one `RustFormatOptions` field, wires it through
`useResolvedHeuristics` or directly to a single emission site, and
validates with a `--config` override on `rustfmt --check`. All three of
the foundational config shape slices (3.0, 3.1) precede the rest so
later slices can pick up the resolved-options context.

### 3.0 Land the rustfmt-aligned `RustFormatOptions` shape

- **Name** — Rename `printWidth`/`tabWidth` → `maxWidth`/`tabSpaces`
  at the Rust boundary (Omit-based extension).
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: reshape `context/format-options.ts:6` to
  `extends Omit<CommonFormatOptions, "printWidth" | "tabWidth">` and
  add the rustfmt-aligned replacements `maxWidth`, `tabSpaces` with
  their defaults; add `toCommonFormatOptions(opts)` adapter that
  renames the two fields back and spreads the rest; `SourceFile`
  consumes the Rust-vocab names and passes the adapter's output to
  `CoreSourceFile` via spread. Wire only `maxWidth` + `tabSpaces` to
  start — every other rustfmt-aligned field ships in its own slice
  below. Out: any field not named in this slice is deferred.
  - **Why `Omit` vs replace**: the `Omit` shape keeps the
    `extends CommonFormatOptions` chain intact, so any future core
    addition (to `CommonFormatOptions` / `PrintTreeOptions`) flows
    through to Rust users automatically without a mapping slice.
    Only fields rustfmt renames need explicit handling. See gap
    §Layer 1 for the full rationale.
- **Why** — architecture §5 Layer 1; every option-wiring slice needs
  this boundary to land in.
- **Changes** —
  `packages/rust/src/context/format-options.ts` (new shape + adapter);
  `packages/rust/src/components/source-file.tsx:98–102` consume
  `maxWidth`/`tabSpaces`; `packages/rust/src/index.ts` re-exports.
- **Config** — `maxWidth: number = 100`, `tabSpaces: number = 4`.
- **Primitives** — none.
- **Tests** — `packages/rust/test/source-file-crate-directory.test.tsx`:
  add a `maxWidth={80}` snapshot and a `tabSpaces={2}` snapshot,
  both asserted against `checkRustfmtAllEditions` with
  `--config max_width=80` / `--config tab_spaces=2`.
- **Depends on** — none.
- **Metric moved** — rustfmt-aligned config surface exists; downstream
  option slices have a place to land.

### 3.1 `useResolvedHeuristics()` provider

- **Name** — Resolved-heuristics context.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: add `useSmallHeuristics: "Default" | "Off" | "Max"`
  (default `"Default"`) and a `useResolvedHeuristics()` helper that
  returns the eight heuristics as concrete numbers
  (`fnCallWidth`, `attrFnLikeWidth`, `structLitWidth`,
  `structVariantWidth`, `arrayWidth`, `chainWidth`,
  `singleLineIfElseMaxWidth`, `singleLineLetElseMaxWidth`) resolved
  per scope doc §Layout-decision drivers. Accept per-heuristic overrides
  (optional fields) even though no component reads them yet. Out: the
  actual usage by constructs (ships in category 6 slices).
- **Why** — architecture §5 Layer 1; every heuristic-tightening slice
  consumes this.
- **Changes** — `packages/rust/src/context/format-options.ts` (add the
  8 optional override fields + `useSmallHeuristics`); new
  `packages/rust/src/context/resolved-heuristics.ts`.
- **Config** — `useSmallHeuristics`, plus the 8 heuristic override
  fields (all `number | undefined`).
- **Primitives** — none.
- **Tests** — unit test
  `packages/rust/test/resolved-heuristics.test.ts` over the
  resolution table.
- **Depends on** — 3.0.
- **Metric moved** — heuristics are a value components can read
  (not yet read by any).

### 3.2 `hardTabs` flag

- **Name** — `hardTabs` at the indent-emission site.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: emit `\t` per indent level when `hardTabs = true`;
  alignment still spaces. Adds `hardTabs` to `RustFormatOptions` and
  extends the `Omit<…>` from slice 3.0 to also drop `useTabs` (the
  core-vocab field `hardTabs` replaces); `toCommonFormatOptions`
  renames `hardTabs → useTabs` when deriving the core shape. Out:
  visual indent (separate reservation).
- **Why** — scope doc, stable options table.
- **Changes** — `packages/rust/src/context/format-options.ts`
  (Omit-list += `"useTabs"`, new field + adapter rename); wherever
  `Indent` is materialised in the Rust pipeline (`RustBlock` once it
  lands; for now, the `SourceFile` adapter passes it through to core's
  format-options so `Indent` respects it).
- **Config** — `hardTabs: boolean = false`.
- **Primitives** — none.
- **Tests** — `packages/rust/test/source-file-crate-directory.test.tsx`:
  `hardTabs={true}` fixture, assert `--config hard_tabs=true`.
- **Depends on** — 3.0.
- **Metric moved** — one more stable option honoured.

### 3.3 `newlineStyle` flag

- **Name** — `newlineStyle` at end-of-line emission.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: `Auto` | `Unix` | `Windows` | `Native`. Out: tests pin
  `Unix` as per the scope doc's CI rule.
- **Why** — scope doc, stable options table.
- **Changes** — `context/format-options.ts`; newline emission (post-
  render transform in `SourceFile`).
- **Config** — `newlineStyle` (default `"Auto"`).
- **Primitives** — none.
- **Tests** — `packages/rust/test/source-file-crate-directory.test.tsx`:
  `newlineStyle="Windows"` round-tripped via `--config newline_style=Windows`.
- **Depends on** — 3.0.
- **Metric moved** — one more stable option honoured.

### 3.4 `edition` flag (passthrough)

- **Name** — `edition` config field.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: accept `"2015" | "2018" | "2021" | "2024"`. On stable
  rustfmt no output differs between editions (scope §Edition handling),
  so this is a pure passthrough today. Out: style-edition branching
  (slice 7.x).
- **Why** — scope doc, stable options table.
- **Changes** — `context/format-options.ts`.
- **Config** — `edition` (default `"2015"`, matching rustfmt).
- **Primitives** — none.
- **Tests** — `packages/rust/test/source-file-crate-directory.test.tsx`:
  assert output unchanged across all four `edition` values.
- **Depends on** — 3.0.
- **Metric moved** — one more stable option honoured.

### 3.5 `shortArrayElementWidthThreshold`

- **Name** — Array-element short threshold field.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: add the field. No array component exists today; when
  array-literal emission lands (slice 4.x) it consumes this field. Until
  then, this is a Layer 1 stub. Out: the actual packing algorithm.
- **Why** — scope doc, stable options table.
- **Changes** — `context/format-options.ts`.
- **Config** — `shortArrayElementWidthThreshold: number = 10`.
- **Primitives** — none.
- **Tests** — unit test on `context/format-options.ts` round-trip.
- **Depends on** — 3.0.
- **Metric moved** — Layer 1 stub in place for the array slice.

### 3.6 `matchArmLeadingPipes`

- **Name** — Leading `|` on match-arm alternatives.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: `"Never" | "Always"`. Default `"Never"` (rustfmt's
  default). Wired into `MatchArm` alternatives emission. Out:
  `"Preserve"` (unsupported in a generator — document).
- **Why** — scope doc, stable options table; also corner case §7.
- **Changes** — `match-expression.tsx:47–79`; add branch to prefix `|`
  on alternatives when `"Always"`.
- **Config** — `matchArmLeadingPipes: "Never" | "Always" = "Never"`.
- **Primitives** — none.
- **Tests** — `packages/rust/test/match-expression.test.tsx`:
  alternatives fixture for each value, assert
  `--config match_arm_leading_pipes=Always/Never`.
- **Depends on** — 3.0.
- **Metric moved** — §10 leading-pipe configurable.

### 3.7 `matchBlockTrailingComma`

- **Name** — Optional trailing comma on block match arms.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: opt-in to trailing comma on block arms. Default
  `false` — i.e. the fix from slice 1.1.
- **Why** — scope doc, stable options table.
- **Changes** — `match-expression.tsx:74` conditional on
  `matchBlockTrailingComma`.
- **Config** — `matchBlockTrailingComma: boolean = false`.
- **Primitives** — none.
- **Tests** — `packages/rust/test/match-expression.test.tsx`: fixtures
  with flag on/off.
- **Depends on** — 1.1, 3.0.
- **Metric moved** — one more stable option honoured.

### 3.8 `forceExplicitAbi`

- **Name** — Normalise `extern fn` → `extern "C" fn`.
- **Category** — option wiring (+ normalisation transform).
- **Blast radius** — rust-only.
- **Scope** — in: transform applied at the extern-block / fn-type
  emission site. Out: anything that doesn't touch `extern`.
- **Why** — scope doc, stable options table. Gap §2.5.
- **Changes** — new `packages/rust/src/normalisations/abi.ts`; consumed
  by fn/extern emitters (awaiting construct: today there's no dedicated
  extern block — pass exists at fn-type scope).
- **Config** — `forceExplicitAbi: boolean = true`.
- **Primitives** — none.
- **Tests** — new fixture in `packages/rust/test/function.test.tsx` for
  extern fns.
- **Depends on** — 3.0.
- **Metric moved** — one normalisation transform landed.

### 3.9 `mergeDerives`

- **Name** — Merge adjacent `#[derive(…)]` attributes.
- **Category** — option wiring (+ normalisation transform).
- **Blast radius** — rust-only.
- **Scope** — in: when the emitter produces adjacent `#[derive(…)]`
  attributes on the same item, merge into one list. Default `true`.
- **Why** — scope doc; gap §2.5.
- **Changes** — new `packages/rust/src/normalisations/merge-derives.ts`
  invoked at attribute-run emission in
  `struct-declaration.tsx:100–117`, `enum-declaration.tsx:92–109`,
  and equivalents.
- **Config** — `mergeDerives: boolean = true`.
- **Primitives** — none.
- **Tests** — `packages/rust/test/attributes.test.tsx` / `struct.test.tsx`:
  two derives + one explicit attribute, assert merged output.
- **Depends on** — 3.0.
- **Metric moved** — §7/§2.5 merge-derives landed.

### 3.10 `removeNestedParens`

- **Name** — Collapse nested parens in expressions.
- **Category** — option wiring (+ normalisation transform).
- **Blast radius** — rust-only.
- **Scope** — in: pure AST-rewrite on any expression emitter. Out:
  semantic changes — never touch operator-precedence-required parens.
- **Why** — scope doc, stable options table; gap §2.5.
- **Changes** — new
  `packages/rust/src/normalisations/remove-nested-parens.ts`; invoked
  where expressions are emitted.
- **Config** — `removeNestedParens: boolean = true`.
- **Primitives** — none.
- **Tests** — unit test on the transform; fixture in
  `packages/rust/test/edge-cases.test.tsx`.
- **Depends on** — 3.0.
- **Metric moved** — one normalisation transform landed.

### 3.11 `useFieldInitShorthand`

- **Name** — Shorthand field init in struct literals.
- **Category** — option wiring (+ normalisation transform).
- **Blast radius** — rust-only.
- **Scope** — in: at `struct-expression.tsx:55–63` (`FieldInit`), when
  value is an identifier equal to the field name, emit the shorthand
  form `{ x }`.
- **Why** — scope doc; gap §2.5.
- **Changes** — `FieldInit` reads flag and branches.
- **Config** — `useFieldInitShorthand: boolean = false` (rustfmt default).
- **Primitives** — none.
- **Tests** — `packages/rust/test/struct-expression.test.tsx`.
- **Depends on** — 3.0.
- **Metric moved** — one normalisation transform landed.

### 3.12 `useTryShorthand`

- **Name** — `try!` → `?` shorthand.
- **Category** — option wiring (+ normalisation transform).
- **Blast radius** — rust-only.
- **Scope** — in: flag-wired stub. Out: emitter is unlikely to produce
  `try!(x)` — this is a passthrough today.
- **Why** — scope doc, stable options table.
- **Changes** — `context/format-options.ts`; stub transform file.
- **Config** — `useTryShorthand: boolean = false`.
- **Primitives** — none.
- **Tests** — unit test on the flag round-trip.
- **Depends on** — 3.0.
- **Metric moved** — Layer 1 coverage complete for normalisation set.

### 3.13 `reorderImports`

- **Name** — Sort within import groups.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: wire a flag that disables the existing within-group
  sort at `use-statement.tsx:116–118`. Default `true`. Out: the
  pinning-fix for `self`/`super`/`*` (corner-case slice 7.x).
- **Why** — scope doc, stable options table.
- **Changes** — `use-statement.tsx` consumes flag.
- **Config** — `reorderImports: boolean = true`.
- **Primitives** — none.
- **Tests** — `packages/rust/test/use-statements.test.tsx`:
  `reorderImports=false` fixture.
- **Depends on** — 3.0.
- **Metric moved** — one more stable option honoured.

### 3.14 `reorderModules`

- **Name** — Sort `mod x;` declarations.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: sort `mod x;` declarations at
  `mod-declarations.tsx:23,54`. Default `true`.
- **Why** — scope doc, stable options table.
- **Changes** — `packages/rust/src/components/mod-declarations.tsx`.
- **Config** — `reorderModules: boolean = true`.
- **Primitives** — none.
- **Tests** — `packages/rust/test/mod-declarations.test.tsx`:
  fixture with/without sort.
- **Depends on** — 3.0.
- **Metric moved** — one more stable option honoured.

### 3.15 `disableAllFormatting`

- **Name** — Bypass all formatting when flag is `true`.
- **Category** — option wiring.
- **Blast radius** — rust-only.
- **Scope** — in: short-circuit at the `SourceFile` root — pass children
  through unmodified. Out: rarely useful for a code generator, but
  scope doc tags this as Full.
- **Why** — scope doc, stable options table.
- **Changes** — `packages/rust/src/components/source-file.tsx` top-level
  guard.
- **Config** — `disableAllFormatting: boolean = false`.
- **Primitives** — none.
- **Tests** — `packages/rust/test/source-file-crate-directory.test.tsx`.
- **Depends on** — 3.0.
- **Metric moved** — Layer 1 coverage complete for the 26 stable
  options (modulo `fnParamsLayout` which is a construct conversion).

---

## 4. Construct conversions (rust-only, replace hardcoded joiners + `<hbr/>` with width-aware primitives)

Each slice rewrites one construct from `{"("}` + `<For joiner={", "}>` +
`{")"}` to `<group>`/`<softline>`/`<ifBreak>` at `printWidth = maxWidth`.
This buys Prettier's fit-or-break at max_width without any new core
intrinsic. Heuristic-bounded breaking (narrower thresholds like
`fn_call_width`) lands in category 6 after the core primitive.

Each slice introduces or reuses its Layer 2 wrapper and ships fixtures
that exercise both flat and broken forms at `maxWidth = 100`.

### 4.1 `<BracedList>` + `UseStatement` brace list

- **Name** — `<BracedList>` primitive + `use a::{…}` conversion.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: Layer 2 wrapper `<BracedList>` (group + softline
  interior + ifBreak-comma + block-indent). Convert `UseStatement`
  brace-list body (`use-statement.tsx:39–46`) to it. Out: nested
  brace-lists forcing multi-line (corner-case slice 7.x).
- **Why** — scope §6, gap §2.9(c).
- **Changes** — new `packages/rust/src/components/primitives/braced-list.tsx`;
  `use-statement.tsx:39–46` uses it.
- **Config** — none yet. (`printWidth = maxWidth` for this slice;
  heuristic override comes with `<group max>`.)
- **Primitives** — Layer 2: `<BracedList>`.
- **Tests** — `packages/rust/test/use-statements.test.tsx`: long
  import list wraps; short stays flat; both pass
  `checkRustfmtAllEditions`.
- **Depends on** — 3.0.
- **Metric moved** — First construct has true fit-or-break. Template
  established for the rest of category 4.

### 4.2 `<ArgList>` + function-call args

- **Name** — `<ArgList>` primitive + `FunctionCallExpression` conversion.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: Layer 2 `<ArgList>` (group + softline + ifBreak-comma
  - trailing-break indent). Replace the `Wrap when={args.length > 1}`
    pattern at `function-call-expression.tsx:23–31` with `<ArgList>`.
    Also convert the type-args list `function-call-expression.tsx:13–21`
    to a flat `<group>` (no trailing comma — generic bracket lists
    follow §5/§16). Out: `fn_call_width` narrower threshold (slice 6.x).
- **Why** — scope §4/§12, gap §2.9(c).
- **Changes** — new `primitives/arg-list.tsx`;
  `function-call-expression.tsx:9–35` rewritten.
- **Config** — none yet.
- **Primitives** — Layer 2: `<ArgList>`.
- **Tests** — `packages/rust/test/function-call-expression.test.tsx`:
  flat call, long call that wraps at 100, single-arg (no trailing
  comma), zero-arg.
- **Depends on** — 3.0, 4.1 (pattern reuse).
- **Metric moved** — function calls have true fit-or-break at
  `max_width`.

### 4.3 `<ParamList>` + function signature params

- **Name** — `<ParamList>` primitive + `Parameters` conversion.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: Layer 2 `<ParamList>` — like `<ArgList>` but with
  the receiver (`&self` etc.) prepended as the first entry. Convert
  `parameters.tsx:30–43` and the `function-declaration.tsx:106–114`
  assembly. Out: full-vertical layout on overflow (scope §12) ships
  here as a natural consequence of `<softline>` + `<ifBreak>,</ifBreak>`
  at `max_width`. No `fn_call_width` narrower threshold yet.
- **Why** — scope §12 (a scope-doc blocker per gap §3).
- **Changes** — new `primitives/param-list.tsx`;
  `packages/rust/src/components/parameters.tsx` rewritten;
  `function-declaration.tsx:106–114` call site updated.
- **Config** — none yet.
- **Primitives** — Layer 2: `<ParamList>`.
- **Tests** — `packages/rust/test/function.test.tsx`: long signature
  wraps vertically, short stays inline, method receiver + extra params,
  signature just under/over 100 cols.
- **Depends on** — 3.0, 4.2 (ArgList precedent).
- **Metric moved** — §12 Blocker resolved. Function signatures honour
  `max_width`.

### 4.4 `<FieldList>` + struct-declaration record fields

- **Name** — `<FieldList>` primitive + record-struct field conversion.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: Layer 2 `<FieldList>` (group + softline + hardline
  elements + ifBreak-comma — always broken per §9 for struct decls).
  Convert `struct-declaration.tsx:151–163` and `Field` at
  `struct-declaration.tsx:170–198` (strip the literal `","` at line
  195). Out: struct literal (slice 4.5) uses the same primitive but
  at a narrower threshold.
- **Why** — scope §9; gap §2.9(c).
- **Changes** — new `primitives/field-list.tsx`;
  `struct-declaration.tsx:151–163,195` rewritten.
- **Config** — none yet.
- **Primitives** — Layer 2: `<FieldList>`.
- **Tests** — `packages/rust/test/struct.test.tsx`: multi-field struct
  fixture asserts trailing comma via `<ifBreak>`.
- **Depends on** — 3.0, 4.1 (pattern).
- **Metric moved** — struct-decl fields use Layer 2 primitive.

### 4.5 Struct-literal body via `<BracedList>`

- **Name** — `StructExpression` on `<BracedList>`.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: rewrite `struct-expression.tsx:14–53` to `<BracedList>`;
  the `..base` spread becomes a final entry that opts out of
  `<ifBreak>,</ifBreak>` (scope §4). Strip literal `","` at
  `struct-expression.tsx:62`. Out: `struct_lit_width = 18` narrower
  threshold (slice 6.x).
- **Why** — scope §9 single-line-iff-short; gap §2.9(a/c).
- **Changes** — `packages/rust/src/components/struct-expression.tsx`
  rewritten; `<BracedList>` extended if needed for spread entry.
- **Config** — none yet.
- **Primitives** — Layer 2: `<BracedList>` (extended).
- **Tests** — `packages/rust/test/struct-expression.test.tsx`: short
  `Foo { x, y: 0 }` stays one line at `max_width=100`; long wraps;
  `..base` correctly non-comma-terminated.
- **Depends on** — 4.1.
- **Metric moved** — struct literals observe `max_width`.

### 4.6 Tuple-struct types via `<ArgList>`

- **Name** — Tuple-struct types list on `<ArgList>`.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: `struct-declaration.tsx:137–142` uses `<ArgList>`.
  Out: tuple structs are trailing-comma-free (§4 exception) — the
  primitive needs a `trailingComma={false}` opt-out; add it.
- **Why** — scope §9 tuple struct, §4 exceptions.
- **Changes** — `struct-declaration.tsx:137–142`; `<ArgList>` extended.
- **Config** — none yet.
- **Primitives** — Layer 2: `<ArgList>` (extended with
  `trailingComma` prop).
- **Tests** — `packages/rust/test/struct.test.tsx`: long tuple struct.
- **Depends on** — 4.2.
- **Metric moved** — tuple struct honours §4 exception + `max_width`.

### 4.7 Enum variants via primitives

- **Name** — `EnumDeclaration` + `EnumVariant` on primitives.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: enum body uses `<FieldList>` (always broken per §9).
  Tuple variants use `<ArgList>` (with trailing comma per §9). Struct
  variants use `<BracedList>` (with `struct_variant_width` placeholder
  = `maxWidth` for now). Strip literal `","` at
  `enum-declaration.tsx:185,196`. Out: `struct_variant_width = 35`
  narrower threshold (slice 6.x).
- **Why** — scope §9; gap §2.9(c).
- **Changes** — `packages/rust/src/components/enum-declaration.tsx`
  rewritten.
- **Config** — none yet.
- **Primitives** — Layer 2: `<FieldList>`, `<ArgList>`, `<BracedList>`.
- **Tests** — `packages/rust/test/enum.test.tsx`: unit, tuple, struct
  variants on one enum; long tuple wraps; struct variant stays single
  line when short.
- **Depends on** — 4.1, 4.2, 4.4.
- **Metric moved** — enum variants honour §9 (except variant-width
  heuristic).

### 4.8 Type-parameter list via `<ArgList>`

- **Name** — `TypeParameters` on `<ArgList>`.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: `type-parameters.tsx:44–61` uses `<ArgList>` with
  `trailingComma={false}` — generic brackets never get a trailing
  comma (§4/§5/§16). Out: heuristic threshold (no per-construct
  heuristic for type-param lists; `max_width` is the only bound).
- **Why** — scope §5/§16; gap §2.9(c).
- **Changes** — `packages/rust/src/components/type-parameters.tsx`
  rewritten.
- **Config** — none yet.
- **Primitives** — Layer 2: `<ArgList>`.
- **Tests** — `packages/rust/test/type-parameters.test.tsx`: long
  generic list wraps.
- **Depends on** — 4.2.
- **Metric moved** — generics honour `max_width`.

### 4.9 `<RustChain>` + method chain

- **Name** — `<RustChain>` primitive + `MethodChainExpression`
  conversion.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: Layer 2 `<RustChain>` (group + one `<line>` per
  non-first segment, `?` attached). Replace `args.length > 1` branch
  at `method-chain-expression.tsx:106–114` with `<ArgList>`; wrap the
  chain in `<RustChain>`. Out: `chain_width = 60` narrower threshold
  (slice 6.x).
- **Why** — scope §13, gap §2.9(c).
- **Changes** — new `primitives/rust-chain.tsx`;
  `packages/rust/src/components/method-chain-expression.tsx:85–143`
  rewritten.
- **Config** — none yet.
- **Primitives** — Layer 2: `<RustChain>`.
- **Tests** — `packages/rust/test/method-chain-expression.test.tsx`:
  short chain stays one line, long chain breaks per §13 (first segment
  on base line, `.method()` per block-indented line).
- **Depends on** — 4.2.
- **Metric moved** — method chains honour `max_width`.

### 4.10 `<RustBlock>` + control-flow bodies

- **Name** — `<RustBlock>` primitive + if/for/while/loop/block
  conversion.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: Layer 2 `<RustBlock>` (core `<Block>` + empty-item
  single-line). Rewrite `block-expression.tsx:46–57`,
  `if-expression.tsx:62–67`, `for-expression.tsx:48–53`,
  `while-expression.tsx:47–52`, `loop-expression.tsx:46–51`,
  `unsafe-block.tsx:44–49`. Out: `single_line_if_else_max_width` and
  `single_line_let_else_max_width` (slice 6.x); `brace_style` /
  `where`-clause brace movement (corner-case slice 7.x).
- **Why** — scope §3/§15, gap §2.9(c).
- **Changes** — new `primitives/rust-block.tsx`; six components
  rewritten.
- **Config** — none yet.
- **Primitives** — Layer 2: `<RustBlock>`.
- **Tests** — extend `block-expression.test.tsx`, `if-expression.test.tsx`,
  `for-expression.test.tsx`, `while-loop-expression.test.tsx`,
  `unsafe-block.test.tsx`.
- **Depends on** — 1.3 (empty-item fix absorbed into `<RustBlock>`).
- **Metric moved** — control-flow bodies route through a single Layer 2
  primitive.

### 4.11 Closure params via `<ArgList>`

- **Name** — `ClosureExpression` params on `<ArgList>`.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: `closure-expression.tsx:81` param list uses
  `<ArgList>` with `|…|` delimiters (extend the primitive to accept
  custom delimiters, or build a light `<PipeList>` variant). Body goes
  through `<RustBlock>` (slice 4.10). Out: body single-expression
  form stays as-is — §14 covered by existing branch.
- **Why** — scope §14, gap §2.9(c).
- **Changes** — `packages/rust/src/components/closure-expression.tsx`
  rewritten.
- **Config** — none yet.
- **Primitives** — Layer 2: `<ArgList>` (delimiter-parameterised) or
  `<PipeList>`.
- **Tests** — `packages/rust/test/closure-expression.test.tsx`.
- **Depends on** — 4.2, 4.10.
- **Metric moved** — closures honour `max_width` on param lists.

### 4.12 Trait supertraits via `<group>`+`<line>`

- **Name** — `TraitDeclaration` supertraits list.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: `trait-declaration.tsx:68–75` uses `<group>` with
  ` + <softline>` joiner so long bound lists break after `+` per §5
  ("break before the operator" applies — `+` is a type-op). Out: this
  is `type_punctuation_density = Wide` already; no threshold beyond
  `max_width`.
- **Why** — scope §5/§16, gap §2.9(c).
- **Changes** — `packages/rust/src/components/trait-declaration.tsx:68–75`
  rewritten.
- **Config** — none.
- **Primitives** — none new.
- **Tests** — `packages/rust/test/trait.test.tsx`.
- **Depends on** — none.
- **Metric moved** — long supertrait lists wrap before `+`.

### 4.13 Attribute arg lists via `<ArgList>`

- **Name** — Attribute and macro-call argument lists on `<ArgList>`.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: `attribute.tsx` arg list, `macro-call.tsx` arg list.
  Out: `attr_fn_like_width = 70` narrower threshold (slice 6.x).
- **Why** — scope §7, gap §2.9(c), and `format_macro_bodies = true`
  (scope "Rustfmt … won't fix these") — macro-invocation arg lists
  must be rustfmt-conformant.
- **Changes** — `packages/rust/src/components/attribute.tsx`,
  `packages/rust/src/components/macro-call.tsx`.
- **Config** — none yet.
- **Primitives** — Layer 2: `<ArgList>`.
- **Tests** — `packages/rust/test/attributes.test.tsx`,
  `packages/rust/test/macro-call.test.tsx`.
- **Depends on** — 4.2.
- **Metric moved** — attributes and macro invocations honour
  `max_width`.

### 4.14 Derive list via `<ArgList>`

- **Name** — `#[derive(…)]` list on `<ArgList>`.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: the `#[derive(` lists at
  `struct-declaration.tsx:108–117` and `enum-declaration.tsx:100–109`
  route through `<ArgList>`. Preserve input order — no sort (§7).
  Out: `merge_derives` (slice 3.9) stays orthogonal.
- **Why** — scope §7.
- **Changes** — those two files.
- **Config** — none yet.
- **Primitives** — Layer 2: `<ArgList>`.
- **Tests** — `packages/rust/test/struct.test.tsx`,
  `packages/rust/test/enum.test.tsx`.
- **Depends on** — 4.2.
- **Metric moved** — long derive lists honour `max_width`.

### 4.15 `let` binding with break-after-`=`

- **Name** — `LetBinding` honours `max_width`.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: `let-binding.tsx` wraps RHS in a `<group>` and uses
  `<indent><softline>` to break after `=` on overflow; similarly for
  `: type` when forced. Out: `single_line_let_else_max_width` (slice
  6.x).
- **Why** — scope §17.
- **Changes** — `packages/rust/src/components/let-binding.tsx`.
- **Config** — none yet.
- **Primitives** — none new.
- **Tests** — `packages/rust/test/let-binding.test.tsx`.
- **Depends on** — none.
- **Metric moved** — `let` RHS honours `max_width`.

### 4.16 Match-arm RHS via `<ifBreak>` and bounded group

- **Name** — Match-arm layout via primitives.
- **Category** — construct conversion.
- **Blast radius** — rust-only.
- **Scope** — in: replace the `renderInline = statements.length === 1`
  branch in `match-expression.tsx:47–79` with a `<group>` whose
  `<ifBreak>,</ifBreak>` gives block arms no trailing comma
  automatically (supersedes slice 1.1 once landed). Inline-vs-block
  wrap still depends on statement count + comments per §10. Out:
  `match_arm_blocks = true` is already the scope-doc default.
- **Why** — scope §10, gap §2.9(c).
- **Changes** — `packages/rust/src/components/match-expression.tsx`
  rewritten.
- **Config** — none yet.
- **Primitives** — none new.
- **Tests** — `packages/rust/test/match-expression.test.tsx`: inline
  arm short, inline arm that overflows → block, block arm with no
  trailing comma.
- **Depends on** — 1.1.
- **Metric moved** — match arms honour `max_width` + §10 trailing
  comma rule via `<ifBreak>` instead of literal.

---

## 5. Core primitive — the heuristic-bounded group

### 5.1 Extend `<group>` with an optional `max` prop

- **Name** — Add `max?: number` to core's `<group>` intrinsic.
- **Category** — core primitive.
- **Blast radius** — **cross-package (rust + core)**.
- **Scope** — in: extend the existing `<group>` intrinsic with an
  optional `max` prop. When `max` is unset, behaviour is unchanged;
  when set, the handler measures the flat form's width during Doc
  construction and forces a break if it exceeds the threshold
  (implementation per gap doc §4 option (1)). Out: any Rust-package
  wiring — shipped in heuristic slices 6.x.
- **Why** — gap §4. Plain `<group>` only knows one width
  (`printWidth`); rustfmt's fit-or-break needs a per-construct narrower
  threshold (`fn_call_width`, `chain_width`, …). Folding `max` onto
  `<group>` keeps the API surface to one intrinsic — callers who
  don't need measurement pay nothing.
- **Changes** — `packages/core/src/runtime/intrinsic.ts` (add
  `max?: number` to `group`'s props); `packages/core/src/render.ts`
  (group handler measures and sets `shouldBreak` when `max` is set);
  `packages/core/test/rendering/formatting.test.tsx` (new tests for
  the `max` behaviour).
- **Config** — none (intrinsic takes an optional `max: number` prop).
- **Primitives** — `<group max>`.
- **Tests** — core-package unit tests: width threshold less than
  `printWidth` forces break; width threshold = `printWidth` matches
  plain `<group>`; nested `<group max>`s compose; hard line inside
  the subtree always forces a break.
- **Depends on** — none (but core-package review cycle).
- **Metric moved** — primitive exists; heuristic-tightening slices can
  now land.

---

## 6. Heuristic tightening (depends on 5.1)

Each slice retrofits `<group max={heuristic}>` onto one
construct by switching its Layer 2 wrapper from `<group>` to
`<group max>`. Prefers the wrapper-level swap rather than per-site
change so future constructs pick it up automatically.

### 6.1 `fn_call_width` on function-call args and attribute/macro arg lists

- **Name** — `<ArgList>` reads `fnCallWidth` / `attrFnLikeWidth`.
- **Category** — heuristic tightening.
- **Blast radius** — rust-only.
- **Scope** — in: `<ArgList>` gains a `heuristic` prop (e.g.
  `"fnCallWidth"` | `"attrFnLikeWidth"`) consumed from
  `useResolvedHeuristics`; call sites in function-call, attribute, and
  macro-call pass it. Out: per-site overrides.
- **Why** — scope §1 / §12; gap §4.
- **Changes** — `primitives/arg-list.tsx`; three call sites.
- **Config** — `fnCallWidth`, `attrFnLikeWidth` (already fields from
  3.1).
- **Primitives** — `<group max>`.
- **Tests** — `packages/rust/test/function-call-expression.test.tsx`:
  a call that fits in 100 but exceeds 60 now breaks; same for
  attribute arg lists against `attr_fn_like_width=70`.
- **Depends on** — 3.1, 4.2, 4.13, 5.1.
- **Metric moved** — function calls and attribute arg lists honour
  `fn_call_width` / `attr_fn_like_width`.

### 6.2 `struct_lit_width` on struct literals

- **Name** — `<BracedList>` in struct-literal position reads
  `structLitWidth`.
- **Category** — heuristic tightening.
- **Blast radius** — rust-only.
- **Scope** — in: `StructExpression` passes `heuristic="structLitWidth"`.
- **Why** — scope §9; gap §4.
- **Changes** — `struct-expression.tsx`.
- **Config** — `structLitWidth` (from 3.1).
- **Primitives** — `<group max>`.
- **Tests** — `packages/rust/test/struct-expression.test.tsx`:
  fixture at ~20 cols flat breaks (exceeds `struct_lit_width=18`).
- **Depends on** — 3.1, 4.5, 5.1.
- **Metric moved** — struct literals honour `struct_lit_width`.

### 6.3 `struct_variant_width` on enum struct variants

- **Name** — `<BracedList>` in enum-variant position reads
  `structVariantWidth`.
- **Category** — heuristic tightening.
- **Blast radius** — rust-only.
- **Scope** — in: `EnumVariant` struct-variant branch passes
  `heuristic="structVariantWidth"`.
- **Why** — scope §9; gap §4.
- **Changes** — `enum-declaration.tsx`.
- **Config** — `structVariantWidth` (from 3.1).
- **Primitives** — `<group max>`.
- **Tests** — `packages/rust/test/enum.test.tsx`.
- **Depends on** — 3.1, 4.7, 5.1.
- **Metric moved** — enum struct variants honour
  `struct_variant_width`.

### 6.4 `chain_width` on method chains

- **Name** — `<RustChain>` reads `chainWidth`.
- **Category** — heuristic tightening.
- **Blast radius** — rust-only.
- **Scope** — in: `<RustChain>` wraps with `<group max={chainWidth}>`.
- **Why** — scope §13; gap §4.
- **Changes** — `primitives/rust-chain.tsx`.
- **Config** — `chainWidth` (from 3.1).
- **Primitives** — `<group max>`.
- **Tests** — `packages/rust/test/method-chain-expression.test.tsx`:
  chain that fits at 100 but exceeds 60.
- **Depends on** — 3.1, 4.9, 5.1.
- **Metric moved** — method chains honour `chain_width`.

### 6.5 `array_width` on array literals

- **Name** — Array-literal component + `<ArgList>` with
  `arrayWidth`.
- **Category** — heuristic tightening (also construct conversion —
  array literal doesn't exist yet).
- **Blast radius** — rust-only.
- **Scope** — in: new `array-expression.tsx` using `<ArgList>` with
  `heuristic="arrayWidth"` + `shortArrayElementWidthThreshold` for
  the packing decision. Out: full `fill`/packing algorithm via
  `<fill>` — stretch goal.
- **Why** — scope §16, gap §4.
- **Changes** — new `packages/rust/src/components/array-expression.tsx`;
  export from index.
- **Config** — `arrayWidth`, `shortArrayElementWidthThreshold` (from
  3.1 / 3.5).
- **Primitives** — `<group max>` via `<ArgList>`.
- **Tests** — new `packages/rust/test/array-expression.test.tsx`.
- **Depends on** — 3.1, 3.5, 4.2, 5.1.
- **Metric moved** — array literals honour `array_width`.

### 6.6 `single_line_if_else_max_width` on `if`/`else`

- **Name** — `IfExpression` honours `singleLineIfElseMaxWidth`.
- **Category** — heuristic tightening.
- **Blast radius** — rust-only.
- **Scope** — in: short `if cond { a } else { b }` stays single-line
  when flat width ≤ `singleLineIfElseMaxWidth`. `<RustBlock>` learns
  about a single-expression-body mode wrapped in
  `<group max={singleLineIfElseMaxWidth}>`. Out: `else if`
  chains — scope §ℹ "Out of scope" preserves author's choice.
- **Why** — scope §1 / §15, gap §4.
- **Changes** — `packages/rust/src/components/if-expression.tsx`;
  `primitives/rust-block.tsx`.
- **Config** — `singleLineIfElseMaxWidth` (from 3.1).
- **Primitives** — `<group max>`.
- **Tests** — `packages/rust/test/if-expression.test.tsx`.
- **Depends on** — 3.1, 4.10, 5.1.
- **Metric moved** — short if-else stays one line.

### 6.7 `single_line_let_else_max_width` on `let-else`

- **Name** — `LetBinding` honours `singleLineLetElseMaxWidth`.
- **Category** — heuristic tightening.
- **Blast radius** — rust-only.
- **Scope** — in: short `let x = … else { … };` stays single-line per
  §17. `<group max={singleLineLetElseMaxWidth}>`. Out: same
  construct without `else` already covered by slice 4.15.
- **Why** — scope §17, gap §4.
- **Changes** — `packages/rust/src/components/let-binding.tsx`.
- **Config** — `singleLineLetElseMaxWidth` (from 3.1).
- **Primitives** — `<group max>`.
- **Tests** — `packages/rust/test/let-binding.test.tsx`.
- **Depends on** — 3.1, 4.15, 5.1.
- **Metric moved** — short let-else stays one line.

---

## 7. Corner cases

Each is small, localised, and independent.

### 7.1 `where`-clause always-broken

- **Name** — `<WhereClause>` always breaks.
- **Category** — corner case.
- **Blast radius** — rust-only.
- **Scope** — in: rewrite `type-parameters.tsx:64–75` so where-clauses
  always render one bound per block-indented line, trailing comma,
  `where` on its own line at outer indent. Out: brace-movement (slice
  7.5).
- **Why** — scope §11; gap §§2.9 / 3 §11 row.
- **Changes** — `packages/rust/src/components/type-parameters.tsx:64–75`
  (or hoist `WhereClause` to a new file).
- **Config** — none.
- **Primitives** — none new.
- **Tests** — `packages/rust/test/function.test.tsx`,
  `packages/rust/test/impl.test.tsx`, `packages/rust/test/struct.test.tsx`
  with where-clauses.
- **Depends on** — none.
- **Metric moved** — §11 rule landed.

### 7.2 `let-else` single-line threshold (body)

- **Name** — `let-else` `else` body single-line constraint.
- **Category** — corner case.
- **Blast radius** — rust-only.
- **Scope** — in: enforce §17 "single-line `else` body, no comments;
  else body breaks" — piggybacks on slice 6.7.
- **Why** — scope §17.
- **Changes** — `let-binding.tsx`.
- **Config** — none beyond 6.7.
- **Primitives** — none new.
- **Tests** — `packages/rust/test/let-binding.test.tsx`.
- **Depends on** — 6.7.
- **Metric moved** — §17 multi-statement-else path landed.

### 7.3 Match-pattern sort `self`/`super`/`*` pinning in `use` brace lists

- **Name** — Import brace-list sort with `self`/`super`/`*` pinning.
- **Category** — corner case.
- **Blast radius** — rust-only.
- **Scope** — in: replace `use-statement.tsx:35–37` sort with
  `compareBraceListEntry` (pin `self` first, then `super`, then rest
  ASCII-lex, then `*` last). Centralise the comparator behind the
  Layer 6 seam `useSortComparator()` reserved for style-edition
  divergence.
- **Why** — scope §Sort stability, gap §2.6.
- **Changes** — new `packages/rust/src/style/sort-comparator.ts` (the
  Layer 6 seam); `use-statement.tsx:35–37` uses it.
- **Config** — none.
- **Primitives** — none new.
- **Tests** — `packages/rust/test/use-statements.test.tsx`:
  `{self, super, x, *}` fixture.
- **Depends on** — 2.1.
- **Metric moved** — import sort matches rustfmt. Style-edition seam
  reserved.

### 7.4 `binop_separator = Front` — break-before-binary-op

- **Name** — Multi-line binary expressions break before operator.
- **Category** — corner case.
- **Blast radius** — rust-only.
- **Scope** — in: introduce a `BinaryExpression` primitive (if one
  doesn't already exist — there is none today; gap §3 §5 row marks
  this as "never triggers because no binary-op component builds a
  Doc"). Binary op at break-position goes at the start of the next
  line. Exception: `=`, `+=`, etc. break _after_. `as` casts break
  before. Out: operator precedence / paren management (separate).
- **Why** — scope §5; gap §3 §5 row.
- **Changes** — new `packages/rust/src/components/binary-expression.tsx`;
  export from index.
- **Config** — none.
- **Primitives** — `<group>` + `<line>`.
- **Tests** — new `packages/rust/test/binary-expression.test.tsx`.
- **Depends on** — none.
- **Metric moved** — §5 break-before-binop rule landed.

### 7.5 Multi-line-`where` brace movement

- **Name** — Body `{` moves to its own line when `where` is multi-line.
- **Category** — corner case.
- **Blast radius** — rust-only.
- **Scope** — in: `<RustBlock>` checks whether an enclosing
  where-clause broke; if so, the `{` moves to its own line at outer
  indent. Use a break-observer or a context supplied by `<WhereClause>`.
- **Why** — scope §3/§11.
- **Changes** — `primitives/rust-block.tsx`; `WhereClause` signals
  broken state via context.
- **Config** — none.
- **Primitives** — Layer 2 extension to `<RustBlock>`.
- **Tests** — `packages/rust/test/function.test.tsx` /
  `impl.test.tsx`: long where clause fixture.
- **Depends on** — 4.10, 7.1.
- **Metric moved** — §3 where-brace rule landed.

### 7.6 Nested-list forces multi-line in `use` brace list

- **Name** — Nested brace list forces enclosing multi-line.
- **Category** — corner case.
- **Blast radius** — rust-only.
- **Scope** — in: `<BracedList>` honours a `forceBreakIf` predicate;
  if any entry contains another `<BracedList>`, force break (§6).
- **Why** — scope §6.
- **Changes** — `primitives/braced-list.tsx`; `use-statement.tsx`
  uses the predicate.
- **Config** — none.
- **Primitives** — Layer 2 extension.
- **Tests** — `packages/rust/test/use-statements.test.tsx`.
- **Depends on** — 4.1.
- **Metric moved** — §6 nested-list rule landed.

### 7.7 `fn_params_layout = "Vertical"` support

- **Name** — Always-break params under `fnParamsLayout = "Vertical"`.
- **Category** — option wiring (but non-trivial — deferred behind
  4.3).
- **Blast radius** — rust-only.
- **Scope** — in: `<ParamList>` respects `fnParamsLayout`: `"Tall"`
  = default fit-or-break; `"Vertical"` = always-break. Out:
  `"Compressed"` — deferred per scope doc.
- **Why** — scope doc, stable options table; gap §2.4.
- **Changes** — `primitives/param-list.tsx` + `context/format-options.ts`.
- **Config** — `fnParamsLayout: "Tall" | "Vertical" = "Tall"`.
- **Primitives** — none new (use `shouldBreak` on `<group max>` or
  `<group>`).
- **Tests** — `packages/rust/test/function.test.tsx`.
- **Depends on** — 4.3.
- **Metric moved** — last stable option wired (modulo
  `"Compressed"` deferred).

---

## 8. Emitter policy (`emitter.*`) — demand-driven

No slices ship an `emitter.*` field at v1. The shortlist of
customization candidates tracked for later:

- `emitter.groupImportsByOrigin: "off" | "std-external-crate" | "one"`
  (candidate shape from slice 2.1).
- `emitter.blankLinesBetweenItemKinds: boolean` (candidate shape from
  slice 2.2).

Add the first `emitter.*` field only when a real consumer asks; build
the nested provider then, not before.

---

## Recommended starting order

Aim: hit the **sample-conformance milestone** as fast as possible (a
clean `rustfmt --check` on `samples/rust-example/output/`), then
establish the primitive-based pattern and expand. The milestone gives
a crisp public signal that the emitter no longer produces obviously
broken Rust, and doubles as a sanity check that our per-construct
fixtures are catching the same failures a real downstream would.

**Milestone sprint — get the sample clean.** Ship these slices in the
order listed; sample becomes fully conformant at the end.

1. **P0 — parameterise `rustfmt.ts` over editions.** Unblocks every
   subsequent fixture; smallest surface.
2. **1.1 — drop trailing comma after block match arms.** One-line fix;
   clears a sample violation (`store.rs` block arm) and the most
   frequently-hit `--check` failure elsewhere.
3. **1.5 — `Attribute` self-terminates with `<hbr />`.** Clears the
   6 `#[must_use]pub fn` / `#[inline]pub fn` sample violations by
   making `<Attribute />` valid at sibling position too.
4. **1.5b — idiomatic sample.** Move the `<Attribute />` siblings
   inside each item's `attributes` prop. Sample output unchanged;
   cosmetic cleanup riding on top of 1.5.
5. **1.6 — statements own their terminator and line break.** Clears
   the remaining `store.rs` statement-run bugs. Most complex of the
   early fixes; lands here so 6.4's chain work doesn't pile on top.
6. **7.1 — `<WhereClause>` always breaks.** No dependencies, clears
   the `traits.rs` violation. Lifting it from "corner case" to here
   is an explicit milestone-driven ordering choice.
7. **3.0 — land rustfmt-aligned `RustFormatOptions`.** Prereq for
   slice 4.2 and everything in category 3.
8. **4.2 — `<ArgList>` + function-call args.** Highest-value Layer 2
   pattern (reused by 4.3, 4.6, 4.8, 4.11, 4.13, 4.14). Also prereq
   for 4.9.
9. **4.9 — `<RustChain>` + method-chain conversion.** Prereq for
   6.4. Does not on its own clear the sample's chain violation — the
   chain is `chain_width`-gated, so it stays flat until 6.4 wires the
   heuristic.
10. **3.1 — `useResolvedHeuristics()` provider.** Prerequisite for
    all of category 6, including 6.4.
11. **5.1 — extend `<group>` with an optional `max` prop.** The only
    cross-package slice on the critical path. Needed by every
    category-6 slice.
12. **6.4 — `<RustChain>` reads `chainWidth`.** Wraps the chain with
    `<group max={chainWidth}>`. Sample's 82-col chain now breaks. **Sample is
    `rustfmt --check` clean** — milestone reached.

**After the milestone.** Continue with breadth-first Layer 2 rollout
and fill in the remaining heuristic retrofits.

- **1.2 — emit `struct Foo;` for empty record struct.** One-line
  fix, just not exercised by the sample.
- **1.3 — keep empty item bodies on one line.** Pure fix across
  three components; completes scope §3 / §2.9(a).
- **4.1 — `<BracedList>` primitive + `use a::{…}` conversion.**
  First non-arg Layer 2 primitive; template for the rest of
  category 4.
- **4.3 — `<ParamList>` + function signatures.** Closes gap §3's
  §12 Blocker ("signature never re-lays-out on overflow").

Category 4 then spreads laterally (4.4 → 4.16) over one or two
constructs per PR; category 6 retrofits heuristic widths in the same
order as their Layer 2 primitives; remaining corner cases (7.2,
7.3–7.7) land opportunistically as their constructs are touched.
