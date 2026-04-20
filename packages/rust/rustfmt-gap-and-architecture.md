# Rust Emitter — Gap Analysis & Architecture Sketch

Companion to `rustfmt-conformance-scope.md`. That document defined **what**
the v1 emitter must produce. This document defines the **distance from
here to there**: what the current emitter does, what Alloy core already
offers, where the gaps are, and how the architecture should be shaped to
close them. It is deliberately *high-level*; detailed implementation
planning is the next step.

## TL;DR

- Alloy core already has a Prettier-backed Doc pipeline with fit-or-break
  intrinsics (`<group>`, `<softline>`, `<hardline>`, `<line>`,
  `<ifBreak>`, `<fill>`, `<indent>`). This is the foundation the
  TypeScript and C# emitters use. **We do not need to build a
  pretty-printer; we need to use the one we have.**
- The current Rust emitter does not use it. Components emit flat templates
  with a few count-based branches (`args.length > 1`); there is no
  fit-or-break anywhere, no shared list primitive, no config surface
  beyond `tabWidth` / `printWidth`.
- The only novel primitive Rust genuinely needs on top of what core
  offers is a **heuristic-bounded group** — a group that breaks when its
  flat width exceeds a per-construct threshold smaller than `max_width`
  (rustfmt's `fn_call_width`, `struct_lit_width`, `chain_width`, …).
  Plain Prettier `<group>` only knows one width: `printWidth`.
- The v1 architecture is therefore: **(1) adopt core's Doc pipeline
  across every Rust component; (2) introduce one new primitive for
  heuristic-bounded breaking; (3) add a typed `RustFormatOptions` that
  exposes all 26 stable rustfmt options; (4) reserve named plug-in points
  for deferred work (style-edition, `Compressed` params layout, visual
  indent, import merging, …) without shipping code for them today.**

---

## 1. What core already offers (the foundation we build on)

Core's render pipeline (`packages/core/src/render.ts`) is:

```
Component tree → Rendered text tree (strings + PrintHooks, built reactively)
              → Prettier Doc  (via print-hook handlers)
              → Final text    (via prettier.printDocToString at render.ts:1124)
```

Width-aware layout happens in the last stage, inside Prettier. Components
annotate **where** breaks are permitted; Prettier decides whether they
fire. That decision is driven by Prettier's single `printWidth`.

Primitives available today:

| Primitive | Kind | Purpose |
|---|---|---|
| `<Block>` (core) | structural | Conditional multi-line block: opener, indented body, closer. Already internally wraps in `<group>` and uses `<Indent softline>`. |
| `<Indent>` (core) | structural | Increases indent; supports `softline` / `hardline` / `trailingBreak` modes. |
| `<List>` / `<StatementList>` / `<For>` (core) | structural | Joiners — comma, semicolon, line, hardline, optional trailing punctuation. |
| `<Wrap>` (core) | meta | Conditionally wraps children in a given component. |
| `<group>` (intrinsic) | **width-aware** | Flat-if-fits, break-otherwise. Uses Prettier's `group()`. |
| `<softline>` / `<sbr>` (intrinsic) | **width-aware** | Nothing if group fits, newline if it breaks. |
| `<line>` / `<br>` (intrinsic) | **width-aware** | Space if fits, newline if breaks. |
| `<hardline>` / `<hbr>` (intrinsic) | hard | Always a newline. |
| `<ifBreak>` (intrinsic) | **width-aware** | Emit A if group breaks, B if it fits. Ideal for trailing-comma-iff-broken. |
| `<fill>` (intrinsic) | **width-aware** | Greedy line-filling. |

The TypeScript emitter's parameter lists
(`packages/typescript/src/components/FunctionBase.tsx:73–98`) and C#'s
(`packages/csharp/src/components/parameters/parameters.tsx:104–124`)
both demonstrate the canonical pattern:

```
<group>(
  <Indent softline trailingBreak>
    <For joiner={<> , <softline /></>}>…</For><ifBreak>,</ifBreak>
  </Indent>
)</group>
```

Flat when it fits; broken across lines with trailing comma when it
doesn't. **This pattern is what almost every Rust construct wants.**

---

## 2. What the current Rust emitter does (and doesn't)

### 2.1 Layout is binary or count-based, never width-based

Across `packages/rust/src/components/` (35-ish files), the breaking
decision is one of:

- **Always flat** — e.g. `parameters.tsx`, `type-parameters.tsx`,
  `attribute.tsx`, `use-statement.tsx` nested lists, `trait-declaration`
  supertraits.
- **Always multi-line** — e.g. `struct-expression.tsx` (always indents
  if any fields), `for-expression.tsx`, `while-expression.tsx`,
  `if-expression.tsx` (always multi-line body), `match-expression.tsx`.
- **Count-branched** — e.g. `function-call-expression.tsx` and
  `method-chain-expression.tsx` indent if `args.length > 1`.

Nothing references `printWidth`, no component uses `<group>` /
`<softline>` / `<ifBreak>` from core, and no component knows the current
column. This is the single largest gap: **every place the scope doc
specifies "try single-line first, else go vertical" (§§4, 9, 12, 13, 17)
is currently coded as a fixed choice.**

### 2.2 Trailing commas and separators are hard-coded

Field and arm emitters append `","` as a literal string regardless of
whether the enclosing list is broken. Examples:

- `match-expression.tsx:64,74` — appends `,` after inline *and* block
  arms. Violates §10: block arms must have no trailing comma.
- Struct field emission appends `,` unconditionally — wrong when the
  struct literal is emitted single-line (§9: `Foo { x, y: 0 }` has no
  final comma).

The `<ifBreak>` intrinsic exists to solve exactly this; it's not used.

### 2.3 No shared list / block primitives for Rust

Each component re-implements the separator-and-wrap logic with a mix of
`<For joiner=…>` and literal punctuation. There is no Rust-level
`ParamList`, `ArgList`, `FieldList`, `BracedList`. Consequently any rule
that applies across list-shaped constructs (trailing-comma-iff-broken,
leading-pipe-in-match-patterns, `self`/`super`/glob pinning inside
`use`-brace-lists) lives in N places or nowhere.

### 2.4 Config surface is two fields

`RustFormatOptions` (`packages/rust/src/context/format-options.ts`)
currently exposes only the two inherited from `CommonFormatOptions`
(`tabWidth`, `printWidth`). None of the 26 stable rustfmt options are
plumbed. There is no `fn_call_width`, no `match_arm_leading_pipes`, no
`merge_derives`, no `reorder_imports` flag.

### 2.5 Normalisation transforms are absent

The scope doc lists five stable transforms that must run before or
during emission: `force_explicit_abi`, `merge_derives`,
`remove_nested_parens`, `use_field_init_shorthand`, `use_try_shorthand`.
The current emitter does none of these — `use-statement.tsx` does sort
and bucket by origin, which is more than rustfmt-at-default does, but
none of the normalisations above are implemented.

### 2.6 Sort rules

`use-statement.tsx` sorts symbols and does three-bucket grouping
(std / external / crate) — the bucket grouping is beyond the scope
(`group_imports = Preserve` at default) and can stay as an opt-in
feature, but the **within-group sort does not match rustfmt's algorithm**
(§6 / Sort stability): `self`/`super` are not pinned first in brace
lists, glob `*` is not pinned last, and there is no edition-aware
comparator seam.

### 2.7 Name policy is already RFC-430-aligned

`packages/rust/src/name-policy.ts` enforces UpperCamelCase / snake_case
/ SCREAMING_SNAKE_CASE by symbol kind and escapes reserved words with
`r#`. This is consistent with the scope doc's Naming section; **no
changes needed**.

### 2.8 Raw-string emission in doc comments

`doc-comment.tsx` currently stringifies its children and splits by
`\n`. This is acceptable because the scope doc explicitly does *not*
reformat comment bodies (§8; unstable `wrap_comments`, `normalize_comments`
both default to `false`). It does mean any future opt-in wrapping needs
the comment to reach the doc component as structured content, not as a
pre-joined string.

### 2.9 Over-formatting — what the emitter does that it shouldn't

The preceding subsections catalogue what's **missing**. This one
catalogues the mirror-image gap: formatting decisions the current
emitter has already baked in at the wrong layer, or that go beyond
rustfmt-at-default, or that actively violate the scope doc. The
rewrite needs to **strip** these just as much as it needs to **add**
width-aware layout.

**(a) Scope violations — would fail `rustfmt --check`**

| File:line | What it emits | Violates |
|---|---|---|
| `match-expression.tsx:74` | Trailing `,` after `{…}` block arms | §10 — block arms must not have a trailing comma |
| `struct-declaration.tsx:164` | `struct Foo {}` when fields are absent | §3 / §9 — empty struct must emit `struct Foo;` (unit form) |
| `function-declaration.tsx:130–136` | `fn f() {\n}` via unconditional `<Indent>` even when body is empty | §3 — empty body must stay single-line (`fn f() {}`) |
| `impl-block.tsx:148,170,172` | Same pattern as fn: unconditional Indent around body regardless of emptiness | §3 — `impl T {}` single-line |
| `trait-declaration.tsx:86–88` | Same — unconditional body indent | §3 — `trait T {}` single-line |
| `struct-expression.tsx:33,40,47` | Unconditional multi-line field layout with `<hbr />` joiners | §9 — struct literals ≤ `struct_lit_width = 18` must stay single-line: `Foo { x, y: 0 }` |

Note on vertical whitespace: `source-file.tsx:137–138` hardcodes a
blank line between item kinds via double `<hbr />`. This is **not** a
rustfmt scope violation — rustfmt at default preserves vertical
whitespace rather than enforcing any cap (the
`blank_lines_upper_bound = 1` rule is behind the unstable channel).
It is, however, an emitter-policy decision hardcoded in a single
component; see §2.10 for why that belongs elsewhere.

These are the findings that need fixing to even reach `--check` clean,
independent of the width-heuristic work.

**(b) Beyond rustfmt-at-default — preserve, document as customization candidates**

These are behaviours the current emitter produces that rustfmt-default
doesn't *specify* (it preserves whatever it's given). They're
idiomatic, they don't conflict with the scope doc, and they're being
used by existing consumers. Keep them on as the emitter's default;
document each one as a candidate for a future `emitter.*` config
knob, to be added when someone actually asks.

| File:line | Behaviour | Rustfmt default | Customization axis |
|---|---|---|---|
| `use-statement.tsx:96–138` | Three-bucket grouping (std / external / crate) separated by blank lines | `group_imports = Preserve` (no origin grouping); rustfmt preserves our blank lines | `emitter.groupImportsByOrigin` — candidate values mirroring rustfmt's unstable `group_imports`: `"off"`, `"std-external-crate"`, `"one"` |
| `source-file.tsx:137–138` | Blank line between item kinds (mod decls → items) | `blank_lines_upper_bound = 1` is unstable; at default rustfmt preserves whatever we emit | `emitter.blankLinesBetweenItemKinds` — on/off |

Note that "preserve as default" does **not** mean the current
implementation stays unchanged. The three-bucket grouping and the
inter-kind blank line both live in components that are otherwise
being rewritten to go through Layer 2 primitives. The behaviour
survives; the implementation is hoisted into the right layer (the
import-ordering pass for grouping, a shared item-run primitive for
the blank line).

| File:line | Behaviour | Why it stays | Customization candidate? |
|---|---|---|---|
| `struct-declaration.tsx:111` derive-list preserves input order (no sort) | Matches scope §7 (derives must not be sorted) | — this is correct, not over-reach. Noted so the rewrite doesn't accidentally introduce sorting. | No. |

**(c) Misplaced — layout locked in at the component**

These are not wrong today — they happen to produce output that matches
rustfmt-default in the *common* case — but they hard-code the flat-vs-
broken choice in the component, which makes width-aware layout
impossible without a rewrite of each site. The rewrite consolidates
them behind Layer 2 primitives:

- **Control-flow bodies always multi-line**: `block-expression.tsx:46–57`,
  `if-expression.tsx:62–67`, `for-expression.tsx:48–53`,
  `while-expression.tsx:47–52`, `loop-expression.tsx:46–51`,
  `closure-expression.tsx:58–63` all use `<Indent>` + `<For joiner={<hbr/>}>`
  unconditionally. Short bodies that should fit single-line
  (§§14, 15, 17, plus `single_line_if_else_max_width = 50`) never can.
- **Trailing commas as literal `","`**: in addition to the match-arm
  scope violation above, `struct-expression.tsx:40–47` (struct-literal
  fields), `enum-declaration.tsx:185,196` (tuple/struct variants),
  and `struct-declaration.tsx:156–161` (record-struct fields) all
  append literal `,` per element. These belong at the list level as
  `<ifBreak>,</ifBreak>`, which costs nothing when flat.
- **Hardcoded `joiner={", "}` on lists that can overflow**:
  `parameters.tsx:37`, `type-parameters.tsx:46`,
  `closure-expression.tsx:81` (closure params),
  `enum-declaration.tsx:182` (tuple-variant types),
  `struct-declaration.tsx:139` (tuple-struct types),
  `function-call-expression.tsx:16` (type args),
  `method-chain-expression.tsx:99` (type args),
  `trait-declaration.tsx:71` (supertraits — `code\` + \``).
  All lock flat layout. Under the rewrite these become `<ArgList>` /
  `<ParamList>` / `<TypeArgList>` from Layer 2.
- **`match-expression.tsx:35–39`**: `<For joiner={<hbr/>}>` is
  defensible (§10 says match is always multi-line), but the right
  expression is `<group shouldBreak>` so downstream passes can reason
  about it. Low-priority cleanup.
- **Hardcoded `<hbr />` separators between items/attrs/statements**:
  seen in `block-expression.tsx:49–57`, `unsafe-block.tsx:44–49`,
  `doc-comment.tsx:9–29`, and many item components
  (`const-declaration.tsx:37`, `static-declaration.tsx:40`,
  `type-alias.tsx:38`, `function-declaration.tsx:94,131`,
  `mod-declarations.tsx:23,54`). For item-level separators these are
  functionally correct under rustfmt-default (items are always on
  their own lines) but should route through a shared `<ItemRun>` /
  `<StatementList>` primitive so blank-line policy (§15
  `blank_lines_upper_bound = 1`) lives in one place.

**(d) Summary — keep, fix, or rework**

**Fix** (scope violations — output changes):

1. Match block-arm trailing comma (§10).
2. Unit-struct form `struct Foo;` (§9).
3. Empty fn / impl / trait bodies on one line (§3).
4. Empty struct literal behaviour.

**Keep** (non-conflicting current behaviour — output unchanged, but
documented as future customization candidates per (b)):

1. Three-bucket origin grouping on `use` statements.
2. Blank line between item kinds in `source-file.tsx`.

These stay on as the emitter's default. Each gets a note on what its
`emitter.*` knob would look like when someone asks. **Rework** in (e)
below covers how the current implementation gets hoisted into the
right layer without changing the observable output.

**Rework** (implementation moves, output unchanged or improves):

1. Every literal `","` appended per list-element moves to
   `<ifBreak>` at the list level.
2. Every unconditional `<Indent>` around a possibly-empty body
   becomes conditional via `<RustBlock>` (Layer 2).
3. Every hardcoded `joiner={", "}` / `joiner={<hbr/>}` on a list
   that can overflow is replaced by a Layer 2 wrapper
   (`<ArgList>` / `<ParamList>` / `<FieldList>` / `<BracedList>`).
4. Kept behaviours from (b) get re-implemented through the same
   Layer 2 / Layer 5 primitives as everything else — the three-bucket
   grouping lives in the import-ordering pass, the inter-kind blank
   line lives in a shared item-run primitive.

Guiding principle for future slices: **keep current behaviour if it
doesn't conflict with rustfmt or the Style Guide; document the
customization axis**. Don't preserve incumbent behaviour by
hardcoding it into every component, and don't reserve a config knob
before there's a real ask — but don't delete working features either.

### 2.10 Emitter-policy decisions — the other axis inside `RustFormatOptions`

Some formatting decisions fall into a gap the scope doc does not
address directly: they are not rustfmt-configurable (stable rustfmt
has no opinion), and they are not Rust-Style-Guide-mandated either,
but no reasonable emitter can avoid picking a default. Vertical
whitespace between items is the canonical example — rustfmt-at-default
preserves whatever the input has, which in a code-generation setting
means "whatever the emitter emits". Something has to decide.

Other decisions in this same gap, to the extent they come up:

- Blank lines between adjacent items (fn/fn, item/impl, use-run/items,
  mod-run/items). Both the `blank_lines_*` rustfmt options are
  unstable.
- Blank lines *inside* bodies (between fields of a struct, between
  variants of an enum, between items of an impl).
- Whether to merge adjacent `use` statements (`use a::b; use a::c;`
  → `use a::{b, c};`). `imports_granularity` is unstable.

These are **emitter policy**, not rustfmt conformance. From a user's
perspective they are still "how do I configure the Rust emitter" — so
they live **in the same `RustFormatOptions` shape** as the
rustfmt-aligned options, but under a nested `emitter` key that keeps
them namespaced away from the rustfmt-aligned options. This gives us:

- One config surface for the user — no two-provider ceremony.
- Collision-proofing against future rustfmt upstream. If rustfmt ever
  stabilises, say, `blank_lines_upper_bound`, we add it at the top
  level with its rustfmt name; the emitter-policy field that
  previously expressed the same intent stays under `emitter.` and
  the seam is explicit.
- A visible signal in the type itself that `emitter.*` fields have a
  different contract (emitter picks the default; no rustfmt oracle)
  from the top-level rustfmt-aligned fields (rustfmt default; oracle
  is `rustfmt --check`).

Sketch (to be read alongside the Layer 1 shape in §5):

```ts
interface RustFormatOptions {
  // Rustfmt-aligned — top-level, rustfmt names (camelCased).
  maxWidth: number;
  tabSpaces: number;
  // … the 26 stable options

  // Emitter policy — nested, Alloy's own vocabulary.
  emitter?: {
    // defaults picked to produce idiomatic hand-written-looking Rust
    // blankLinesBetweenItems, etc. — actual set grown demand-driven
  };
}
```

The nested sub-object is optional and every field inside has a
defined default; users only touch it when they want to deviate.

**What migrates from today's behaviour.** The rule is
**keep-if-non-conflicting, document-for-later-customization**. Current
behaviours that don't conflict with rustfmt or the Style Guide stay
on as the emitter's default — not as hardcoded component logic, but
re-implemented through the appropriate Layer 2 / Layer 5 primitive so
a future customization slice can swap the default without touching
every component.

Concrete cases (from §2.9(b)):

- **Three-bucket origin grouping on `use`** — stays on. Moves from
  `use-statement.tsx` into the import-ordering pass (Layer 5).
  Documented customization candidate: `emitter.groupImportsByOrigin`
  with values mirroring rustfmt's unstable `group_imports` (`"off"` /
  `"std-external-crate"` / `"one"`). Not shipped as a live option
  until someone asks.
- **Blank line between item kinds in `source-file.tsx`** — stays on.
  Moves into a shared item-run primitive. Documented customization
  candidate: `emitter.blankLinesBetweenItemKinds`. Not shipped until
  someone asks.

For anything not listed in §2.9(b), no option is reserved. Options
are introduced demand-driven; the documented-but-unshipped list above
is the shortlist of the first `emitter.*` fields to add when demand
materialises.

**The contract distinction matters for testing.** Top-level fields
are validated against `rustfmt --check`: set `maxWidth = 80`, run
`rustfmt --check --config max_width=80`, expect zero diff. Fields
under `emitter.` are validated against our own snapshots, with the
side constraint that output must still pass `rustfmt --check` at
default settings regardless of the emitter-policy value. The top-level
vs. nested split is what makes "which oracle applies here?" readable
from the type alone.

---

## 3. Gaps mapped to scope sections

| Scope § | Gap | Severity |
|---|---|---|
| §1 Line width / fit-or-break | **No fit-or-break anywhere.** The shared algorithm the scope doc pins every construct to is absent. | Blocker |
| §2 Indentation | `tab_spaces` / `hard_tabs` not honoured; indent is Prettier's fixed 2 (or core default). | Medium |
| §3 Brace placement | Mostly correct by accident (everything is always-multi-line). Empty-item single-line rule (`fn f() {}`) not implemented. | Low |
| §4 Trailing commas | Hard-coded; should be `<ifBreak>,</ifBreak>`. Exceptions (block match arms, function types, tuple non-1) not modelled. | High |
| §5 Spacing | Mostly correct, but `binop_separator = Front` (break-before-binary-op) never triggers because no binary-op component builds a Doc. | Medium |
| §6 Imports | Sort algorithm doesn't pin `self`/`super`/`*`; no edition-aware comparator seam. Extra bucket-grouping is out-of-scope-but-tolerable. | High |
| §7 Attributes | Attribute arg lists never wrap; `merge_derives` transform missing. | Medium |
| §8 Doc comments | OK for scope (we don't reformat). | — |
| §9 Structs/enums | No single-line threshold (`struct_lit_width = 18`, `struct_variant_width = 35`). Always multi-line or always flat. | High |
| §10 Match arms | Trailing comma after block arms (wrong); no `match_arm_leading_pipes` support; no fit-or-break on arm RHS. | High |
| §11 Where clauses | No where-clause breaking; always inline. | High |
| §12 Function signatures | Signature never re-lays-out on overflow; params never vertical. | Blocker |
| §13 Chains | Break decision is `args.length > 1`, not `chain_width`. | High |
| §14 Closures | Branch on statement count only, no width consideration. | Medium |
| §15 Blocks / blank lines | `blank_lines_upper_bound = 1` not enforced. | Low |
| §16 Types | Mostly correct; no trait-bound wrapping. | Low |
| §17 `let` / `let-else` | No single-line-let-else threshold; no break-after-`=` on overflow. | Medium |

Blockers: §1, §12. Everything else is additive once fit-or-break is in
place.

---

## 4. The one genuinely new primitive: heuristic-bounded group

Prettier's `<group>` breaks when its flat form would exceed
`printWidth − currentColumn`. Rustfmt's fit-or-break decision (scope §1)
is stricter:

```
flat iff flat_width ≤ min(applicable_heuristic, max_width − current_column)
```

where `applicable_heuristic` is one of the eight scaled heuristics
(`fn_call_width = 60`, `struct_lit_width = 18`, `chain_width = 60`,
`array_width = 60`, `single_line_if_else_max_width = 50`, …). These are
**narrower than `max_width`** and different per construct.

Plain `<group>` cannot express this. We need a primitive that forces
breaking when the flat form exceeds the heuristic, even if it would
otherwise fit in the remaining column budget.

The public Prettier API does not expose per-group width. Implementation
options, in rough order of preference:

1. **Force-break on over-threshold at render time.** During Doc
   construction for the bounded group, measure the flat form's width
   (render the flat subtree to a string via
   `prettier.printDocToString(…, { printWidth: Infinity })` or similar),
   and if it exceeds the heuristic, emit the group with its softlines
   rewritten to hardlines (equivalent to forcing a break). Prettier then
   handles the remaining-column check itself. Implementable as a new
   optional `max` prop on core's existing `<group>` intrinsic: when
   `max` is set, the handler measures the flat subtree and forces a
   break if it exceeds the threshold.
2. **`conditionalGroup` with a measured alternative.** Prettier's
   `conditionalGroup([flat, broken])` picks the first option that fits.
   We can construct `flat` as a flat-by-design variant and control
   fitting by manipulating an invisible indent that consumes column
   budget equal to `max_width − heuristic`. Clever but fragile.
3. **Double-pass emission.** Render once with `printWidth = heuristic`,
   locally, to decide flat-vs-break; then commit that decision into the
   outer Doc. Costly and awkward in a reactive model.

Option (1) is the cleanest: a single new intrinsic, local to the
bounded-group site, with predictable cost. Prototyping this primitive
is likely the **first** piece of work in the actual implementation plan
— the rest of the architecture depends on having it.

**This primitive belongs in core**, not in the Rust package: any language
with width-scaled formatting (Swift, Kotlin, future languages) will want
it. Scope of the landing is a design conversation with the core package.

---

## 5. Proposed architecture

Six layers. Each has a clear responsibility and a named plug-in point for
deferred scope.

### Layer 1 — Config (`RustFormatOptions`)

**Surface is rustfmt-aligned. Internals map onto core's
`CommonFormatOptions`.** The public API names every option by its
rustfmt name (camelCased for TypeScript: `max_width` → `maxWidth`,
`tab_spaces` → `tabSpaces`) and defaults to rustfmt's defaults. Core,
however, reads `CommonFormatOptions` (`printWidth`, `tabWidth`, and
the `PrintTreeOptions` it extends — `insertFinalNewLine`, `useTabs`)
in its layout primitives — most importantly the Prettier pipeline in
`render.ts`.

The Rust config extends `CommonFormatOptions` via `Omit<…, keys we
rename>` — it keeps the extension chain, so any core-added field
propagates automatically, but hides the fields rustfmt has its own
name for and redefines them under the rustfmt name. A
`toCommonFormatOptions(opts)` adapter reverses the rename for core
consumers.

Two consequences:

1. Component authors of Rust trees see rustfmt's vocabulary
   (`maxWidth`, `tabSpaces`, `hardTabs`, `fnCallWidth`, …) in place of
   the core-named fields. They don't encounter `printWidth` /
   `tabWidth` in the Rust package.
2. Core primitives and intrinsics (`<group>`, `<Indent>`,
   `prettier.printDocToString`) continue to read `CommonFormatOptions`
   unchanged. `toCommonFormatOptions` renames `maxWidth` → `printWidth`
   and `tabSpaces` → `tabWidth`, and spreads everything else through —
   so fields like `insertFinalNewLine` and any future core addition
   flow to core with zero extra plumbing.

Shape sketch (not a detailed plan):

```ts
// Public, rustfmt-aligned. Extends CommonFormatOptions minus the
// fields rustfmt has its own name for — those get re-declared below.
// Any future field added to CommonFormatOptions / PrintTreeOptions
// without a rustfmt-vocab replacement flows through automatically.
interface RustFormatOptions
  extends Omit<CommonFormatOptions, "printWidth" | "tabWidth" | "useTabs"> {
  maxWidth: number;            // replaces printWidth
  tabSpaces: number;           // replaces tabWidth
  hardTabs: boolean;           // replaces useTabs (rustfmt hard_tabs)
  newlineStyle: "Auto" | "Unix" | "Windows" | "Native";
  edition: "2015" | "2018" | "2021" | "2024";

  useSmallHeuristics: "Default" | "Off" | "Max";
  fnCallWidth?: number;                    // explicit override; else computed
  attrFnLikeWidth?: number;
  structLitWidth?: number;
  structVariantWidth?: number;
  arrayWidth?: number;
  chainWidth?: number;
  singleLineIfElseMaxWidth?: number;
  singleLineLetElseMaxWidth?: number;

  shortArrayElementWidthThreshold: number; // 10, not a %
  fnParamsLayout: "Tall" | "Vertical";     // "Compressed" deferred
  matchArmLeadingPipes: "Never" | "Always";
  matchBlockTrailingComma: boolean;

  forceExplicitAbi: boolean;
  mergeDerives: boolean;
  removeNestedParens: boolean;
  useFieldInitShorthand: boolean;
  useTryShorthand: boolean;

  reorderImports: boolean;
  reorderModules: boolean;
  disableAllFormatting: boolean;
}

// Adapter, invoked by the Rust SourceFile / root provider. The spread
// of `...rest` is what lets core-added fields flow through without a
// Rust-side mapping slice each time.
function toCommonFormatOptions(opts: RustFormatOptions): CommonFormatOptions {
  const { maxWidth, tabSpaces, hardTabs, ...rest } = opts;
  return {
    ...rest,
    printWidth: maxWidth,
    tabWidth: tabSpaces,
    useTabs: hardTabs,
  };
}
```

Providers:

- `useRustFormatOptions()` — the rustfmt-aligned context, consumed by
  every Rust component.
- `useResolvedHeuristics()` — sibling helper that returns the eight
  heuristics as concrete numbers after applying `useSmallHeuristics`
  and any explicit overrides. Components consume *resolved* numbers,
  not the raw policy.
- The Rust root (source-file / crate-directory) installs both the
  rustfmt-aligned provider and the derived `CommonFormatOptions`
  provider so core primitives keep working.

Rustfmt options that have no `CommonFormatOptions` counterpart
(`newlineStyle`, every heuristic, every normalisation flag, the
ordering flags) are consumed directly by Layer 2 / Layer 3 / Layer 4 /
Layer 5 as appropriate — they never need to round-trip through
`CommonFormatOptions`. Only the three rename cases
(`maxWidth`/`tabSpaces`/`hardTabs` → `printWidth`/`tabWidth`/`useTabs`)
are mapped in the adapter; everything else flows through unchanged, in
both directions.

**Emitter-policy decisions live under `emitter.*`** inside the same
shape — not a separate options type. See §2.10 for the rationale. The
nested namespace both prevents collisions with any future rustfmt
upstream and makes the contract difference (rustfmt-oracle vs
emitter-snapshot-oracle) visible in the type. Fields under `emitter.`
are added demand-driven rather than reserved upfront to preserve
today's behaviour.

### Layer 2 — Width-aware layout primitives (core, plus Rust wrappers)

Core additions (one):
- `<group max={n}>` — heuristic-bounded group (§4).

Rust-package wrappers (thin):
- `<ParamList>` / `<ArgList>` / `<FieldList>` / `<BracedList>` — each is
  a `<group max>` over a `<For joiner={<>, <softline/></>}>` with
  `<ifBreak>,</ifBreak>`. Parameterised by the heuristic to use
  (`fnCallWidth`, `attrFnLikeWidth`, `arrayWidth`, `structLitWidth`,
  `structVariantWidth`). Trailing-comma rules plug in here (block match
  arms opt out).
- `<RustBlock>` — wraps core's `<Block>` with Rust-specific behaviour:
  empty-item single-line (`fn f() {}`), `where`-clause brace movement.
- `<RustChain>` — method chain using `group max={chainWidth}` with
  one `<line>` per segment.

These wrappers are the *only* place rustfmt's list / block rules live.
Component authors use them, they don't re-implement joiners.

### Layer 3 — Construct components (`packages/rust/src/components/`)

Every existing component is rewritten to compose over Layer 2. The
current ad-hoc templates go away. Concretely:

- `function-declaration.tsx` → `ParamList` for parameters, `<RustBlock>`
  for body, `<Where>` (new) for where-clauses.
- `match-expression.tsx` → `<For joiner={<hbr/>}>` for arms (always
  multi-line per §10), but each arm uses `<group max>` for its RHS
  and `<ifBreak>,</ifBreak>` for the trailing comma so block arms drop
  it automatically (§10).
- `struct-expression.tsx` → `<BracedList heuristic="structLitWidth">`.
- `use-statement.tsx` → brace-list body uses `<BracedList>` with
  `<ifBreak>,</ifBreak>`; sort comparator comes from Layer 6.
- `function-call-expression.tsx` → `<ArgList>` (bounded by
  `fnCallWidth`).

### Layer 4 — Normalisation transforms

Five transforms (§ Normalisation in scope doc). Implemented as pure
helpers invoked by the relevant component *before* it renders children:

- `normaliseAbi(extern, opts)` in the extern-block emitter.
- `mergeDerives(attrs, opts)` in the attribute-run emitter.
- `removeNestedParens(expr, opts)` in expression emission.
- `applyFieldInitShorthand(field, opts)` in struct-literal emission.
- `applyTryShorthand(expr, opts)` — unlikely to fire but wired for
  completeness.

Each reads its own flag from `RustFormatOptions`.

### Layer 5 — Ordering passes

Imports and `mod`s are sorted in-place by the emitter when
`reorderImports` / `reorderModules` is on. Implemented as a
comparator-based sort invoked inside `UseStatements` /
`ModDeclarations`. Bucket-grouping by crate origin (`std` / external /
`crate`) is preserved as an emitter feature — it sits *above* the
rustfmt-prescribed within-group sort, not instead of it (§6).

### Layer 6 — Style-edition abstraction

One named helper:

```ts
function useSortComparator(): (a: string, b: string) => number;
```

Today this always returns the ASCII-lex-with-pinning comparator used by
stable rustfmt for editions 2015 / 2018 / 2021 / 2024. Reserved as the
single plug-in point for a future `style_edition = "2024"` Unicode-aware
version-sort, should that stabilise.

---

## 6. Plug-in points for deferred scope

One-liners tying each reserved direction to the layer that owns it:

| Deferred | Plug-in point |
|---|---|
| `fn_params_layout = "Compressed"` | New `ParamsLayoutStrategy` enum read by `<ParamList>` (Layer 2). Today: `Tall \| Vertical`. Add `Compressed` branch later. |
| Visual indent (`indent_style = "Visual"`) | `<Indent>` gains a `visual` mode; `<group max>`'s measurement respects it. Scope doc calls it unstable; keep the enum, don't expose the option. |
| Brace-placement variants (Allman / Stroustrup) | `<RustBlock>` reads a `braceStyle` option; Layer 1 reserves the enum, Layer 3 defaults to `SameLineWhere`. |
| Import merging / crate-origin grouping | Sit above the sort pass in Layer 5 as an opt-in transform. Do not couple to rustfmt-scope. |
| Field / discriminant alignment | Layer 3 field emitters accept an optional alignment pass; disabled by default. |
| Comment wrapping | Doc comment component keeps children structured (Layer 3); a future wrapping pass slots in there. |
| Macro body formatting | Scope doc calls out `format_macro_bodies = true`. Macro-invocation argument lists route through `<ArgList>` (Layer 2) just like normal calls, so they're already covered. |

---

## 7. Out-of-scope here (called out so they're not forgotten)

- The actual shape of `<group max>`'s implementation inside core's
  render.ts — needs a prototype.
- Per-option conformance tests (one test per option × each supported
  value) vs a consolidated snapshot-based approach.
- Compatibility story if a downstream consumer is pinned to an older
  Prettier version than core's.
