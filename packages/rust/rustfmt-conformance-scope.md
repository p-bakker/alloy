# Rustfmt Conformance — Scope

Purpose: define what the Alloy Rust emitter will and will not do to match
rustfmt's default output. This document is the scoping contract — what we
commit to support in v1. The architecture plan follows once this is approved.

## Terms

- **Emitter** — this package (`@alloy-js/rust`). Renders an Alloy component
  tree into Rust source.
- **Component author** — the person using Alloy to define what Rust to
  generate. They construct the tree and decide semantic choices between
  equivalent forms.
- **Consumer** — the downstream project receiving generated Rust. Typically
  runs `cargo fmt` over our output as part of their build.

"We" / "our" in this document refers to the emitter unless otherwise stated.

## Sources the emitter resolves against

The rules the emitter follows come from three sources, combined:

1. **Stable rustfmt options** — exposed in our config, with rustfmt's
   defaults (see §Scope — stable options).
2. **Unstable rustfmt options** — not exposed in our config, but their
   defaults still shape our output because stable rustfmt enforces them
   (see §Unstable options whose default behaviour we still produce).
3. **Rust grammar and Style Guide rules** — some are not tied to any
   option and are fixed (see §Output rules); some are advisory and not
   enforced by rustfmt at all (see §Style Guide rules rustfmt does not
   enforce).

A final category — **component-author semantic choices** — is explicitly
not the emitter's concern and is called out where relevant.

## Goal

Generated Rust source passes `rustfmt --check` with zero diff against **stable
rustfmt at default configuration**, on editions 2021 and 2024.

## Strict conformance, defined

The test oracle is:

```
rustfmt --check --edition <2021|2024> --config-path <empty.toml> \
        --config newline_style=Unix
```

- Empty `--config-path` neutralises any ambient `rustfmt.toml` on the dev
  machine or CI.
- `newline_style=Unix` pinned because the default `Auto` resolves per-platform
  and would cause Linux/Windows CI to disagree.
- Zero diff means: byte-exact. Not "rustfmt is happy" — rustfmt does not error
  on overlong lines by default, so `--check` passing is necessary but not
  sufficient for width compliance. We also enforce `max_width = 100`
  ourselves.

## Edition handling

- `edition` is stable; it controls parsing and, by inference, formatting.
- `style_edition` controls formatting rules. When unset, `style_edition`
  defaults to the value of `edition`. It is unstable *as an explicitly
  settable knob* — on stable rustfmt you cannot override it, you always
  get the value inferred from `edition`.
- On current stable rustfmt, editions 2015 / 2018 / 2021 / 2024 produce
  identical formatting. The 2024-style-edition-specific rules (version-sort
  and Unicode-aware sort of imports) are not observable on stable today —
  either because those rules themselves remain gated behind unstable
  features, or because `style_edition = 2024` inference doesn't activate
  them on stable. Either way: no visible formatting difference between
  edition values on stable rustfmt.
- Consequence for us: supporting edition 2021 and edition 2024 means
  producing the same output for both, and testing that output against
  `rustfmt --check` under both editions.
- **Architectural discipline (no code yet):** style-edition-sensitive
  decisions (today limited to `use`-list sort order) go behind named
  helpers so a future style_edition split can be added at one site when
  `style_edition` stabilises and the 2024 rules actually diverge
  observably.

## Scope — stable options

Stable rustfmt exposes **26 options** (verified against `Configurations.md`
`Stable: Yes` markers, April 2026; plus `fn_args_layout` as a legacy alias
for `fn_params_layout`). Policy:

- Every stable option is exposed in our config and defaults to its rustfmt
  default.
- Non-default values are supported in v1 **if** they share the default's
  emission algorithm — i.e. the difference is a flag, a threshold number, a
  string, a sort order, or a localised policy choice.
- Non-default values are **deferred** only when they require a fundamentally
  different layout algorithm.

Each option is tagged:

- **Full** — all stable values supported in v1.
- **Subset** — some non-default values supported in v1; others deferred.
- **Default-only** — only the default is supported in v1; non-default values
  need a different algorithm and are deferred.

### Meta / global parameters

| Option | Default | v1 support | Notes |
|---|---|---|---|
| `max_width` | `100` | **Full** | Any `usize`. Drives the scaled width heuristics. |
| `tab_spaces` | `4` | **Full** | Any `usize`. Indent unit parameter. |
| `hard_tabs` | `false` | **Full** | `true` emits a tab per indent level; alignment still uses spaces. Single branch at indent emission. |
| `newline_style` | `Auto` | **Full** | String choice at end-of-line. Tests pin `Unix`. |
| `edition` | `2015` | **Full** | Parses-as; we commit to 2021 and 2024. Output is edition-independent under stable rustfmt. |

### Layout-decision drivers

> **How the width heuristics relate to `max_width`.** The eight
> heuristics — `fn_call_width`, `attr_fn_like_width`, `struct_lit_width`,
> `struct_variant_width`, `array_width`, `chain_width`,
> `single_line_if_else_max_width`, `single_line_let_else_max_width` — are
> set as **percentages of `max_width`** via `use_small_heuristics`. The
> default values shown below (60, 70, 18, 35, 60, 60, 50, 50) are the
> resolved values at the default `max_width = 100`. When `max_width`
> differs, each heuristic resolves to `round(max_width × percentage)` at
> 60 %, 70 %, 18 %, 35 %, 60 %, 60 %, 50 %, 50 % respectively.
>
> Resolution rules:
>
> - `use_small_heuristics = "Default"` (default): heuristic resolves
>   via percentage.
> - `use_small_heuristics = "Off"`: heuristics are disabled entirely.
> - `use_small_heuristics = "Max"`: every heuristic equals `max_width`.
> - Explicitly setting an individual heuristic overrides the computed
>   value for that one option — regardless of `use_small_heuristics`.
>
> `short_array_element_width_threshold` is an independent integer (not a
> percentage) and is not scaled.

| Option | Default | v1 support | Notes |
|---|---|---|---|
| `use_small_heuristics` | `Default` | **Full** | Resolution strategy for the eight heuristics; see note above. |
| `fn_call_width` | `60` (60 % of `max_width`) | **Full** | Any `usize ≤ max_width`. Call-layout threshold. |
| `attr_fn_like_width` | `70` (70 %) | **Full** | Attribute arg-list threshold. |
| `struct_lit_width` | `18` (18 %) | **Full** | Struct-literal threshold. |
| `struct_variant_width` | `35` (35 %) | **Full** | Enum struct-variant threshold. |
| `array_width` | `60` (60 %) | **Full** | Array-literal threshold. |
| `chain_width` | `60` (60 %) | **Full** | Method-chain threshold. |
| `single_line_if_else_max_width` | `50` (50 %) | **Full** | Single-line `if … else …` threshold. |
| `single_line_let_else_max_width` | `50` (50 %) | **Full** | Single-line `let … else { … };` threshold. |
| `short_array_element_width_threshold` | `10` | **Full** | Fixed integer (not a percentage). Element width under which array packing is allowed. |
| `fn_params_layout` (alias: `fn_args_layout`) | `Tall` | **Subset** | `Vertical` supported (same algorithm, always break). `Compressed` deferred (horizontal-packing algorithm distinct from the pretty-printer's group logic). |
| `match_arm_leading_pipes` | `Never` | **Subset** | `Always` supported. `Preserve` is meaningless for a code generator (no input source to preserve from); documented as unsupported rather than deferred. |
| `match_block_trailing_comma` | `false` | **Full** | One flag at block-arm emission. |

### Normalisation transforms

| Option | Default | v1 support | Notes |
|---|---|---|---|
| `force_explicit_abi` | `true` | **Full** | Flag on the extern normalisation step. |
| `merge_derives` | `true` | **Full** | Flag controlling whether adjacent derives are merged. |
| `remove_nested_parens` | `true` | **Full** | Flag on paren-simplification step. |
| `use_field_init_shorthand` | `false` | **Full** | Flag at struct-literal field emission. |
| `use_try_shorthand` | `false` | **Full** | Flag. Unlikely to be exercised — we don't emit `try!()`. |

### Ordering

| Option | Default | v1 support | Notes |
|---|---|---|---|
| `reorder_imports` | `true` | **Full** | Flag controlling the within-group sort step. |
| `reorder_modules` | `true` | **Full** | Flag controlling the `mod x;` sort step. |

### Bypass

| Option | Default | v1 support | Notes |
|---|---|---|---|
| `disable_all_formatting` | `false` | **Full** | Flag; `true` skips formatting. Questionable value for a code generator, but cheap to support. |

### Deferred non-default values (summary)

One: `fn_params_layout = "Compressed"`. All other stable options accept any
stable value in v1.

## Unstable options whose default behavior we still produce

The following options are **unstable** in rustfmt — we do not expose them in
our config, but the formatting behavior they describe at their defaults is
what stable rustfmt produces, so we must emit accordingly. Listed here
explicitly because earlier drafts misclassified them as stable.

### Active unstable defaults (shape visible output)

| Option | Default | What the default commits us to produce |
|---|---|---|
| `indent_style` | `Block` | Break-and-indent-by-one (no visual alignment). |
| `brace_style` | `SameLineWhere` | `{` on declaration line, exception for multi-line `where`. |
| `control_brace_style` | `AlwaysSameLine` | `{` on same line as `if`/`while`/`for`/`match`. |
| `trailing_comma` | `Vertical` | Trailing comma iff list is broken across lines. |
| `empty_item_single_line` | `true` | Empty-bodied `fn`/`impl`/`trait` stay single-line. |
| `binop_separator` | `Front` | Break before binary operators (except assignment). |
| `match_arm_blocks` | `true` | Wrap arm body in `{}` when it must line-break after `=>`. |
| `match_arm_indent` | `true` | Match arms indented one level from `match`. |
| `type_punctuation_density` | `Wide` | One space around `+` in `T + Send + Sync`. |
| `spaces_around_ranges` | `false` | No spaces around `..`, `..=`. |
| `space_before_colon` / `space_after_colon` | `false` / `true` | `x: T`, no space before `:`. |
| `inline_attribute_width` | `0` | Attribute always on its own line. |
| `blank_lines_upper_bound` | `1` | ≤ 1 blank line between items. |
| `blank_lines_lower_bound` | `0` | No forced blank lines. |
| `trailing_semicolon` | `true` | Keep `;` on `return;`/`break;`/`continue;`. |
| `struct_lit_single_line` | `true` | Short struct literal stays single-line (within `struct_lit_width`). |
| `combine_control_expr` | `true` | A control-flow expression used as a sole call or macro argument stays on the call's line instead of being pushed onto its own block-indented line — e.g. `foo!(if x { … })`, not `foo!(\n    if x { … }\n)`. Gotcha for macro-invocation emission. |
| `imports_indent` | `Block` | `use a::{…}` brace-list body block-indented. |
| `imports_layout` | `Mixed` | Brace-list entries packed horizontally, wrapping when width is exceeded. |
| `format_macro_bodies` | `true` | Rustfmt *will* reformat macro bodies it can parse as Rust — our emitted macro bodies must already conform. |
| `format_generated_files` | `true` | Rustfmt formats files regardless of `@generated` marker; we cannot opt out via marker. |

### No-op unstable defaults (rustfmt performs no transformation)

The remaining unstable options have defaults that amount to "don't transform."
Because rustfmt does not rewrite or reorder anything at these defaults, we
satisfy them automatically by simply not performing those transformations in
our own emission:

- **Don't rewrite comment / doc / string contents**: `wrap_comments`,
  `normalize_comments`, `format_strings`, `format_code_in_doc_comments`,
  `normalize_doc_attributes` (all `false`).
- **Don't align fields / discriminants**: `struct_field_align_threshold`,
  `enum_discrim_align_threshold` (both `0`).
- **Don't merge / regroup imports**: `imports_granularity`, `group_imports`
  (both `Preserve`).
- **Don't transform expressions**: `overflow_delimited_expr`,
  `condense_wildcard_suffixes`, `reorder_impl_items` (all `false` / empty).
- **Don't normalise literal form**: `hex_literal_case`,
  `float_literal_trailing_zero` (both `Preserve`).
- **Don't collapse to single line**: `fn_single_line`, `where_single_line`
  (both `false`).
- **Don't force structural changes**: `force_multiline_blocks` (`false`),
  `format_macro_matchers` (`false`), `skip_macro_invocations` (empty).
- **Error / diagnostics / I/O**: `error_on_line_overflow`,
  `error_on_unformatted`, `hide_parse_errors`, `show_parse_errors`, `color`,
  `ignore`, `skip_children`, `comment_width`,
  `doc_comment_code_block_width`, `generated_marker_line_search_limit`,
  `unstable_features`, `version`, `required_version` — none affect emitted
  source at their defaults.

Any unstable option not named here falls into one of the two groups above;
the user-visible ones most likely to cause confusion are also restated under
"Explicitly out of scope" below.

## Output rules (the cookbook)

The operational reference — concrete rules the emitter produces, as the
resolution of the three sources named above: stable option defaults,
unstable option defaults, and grammar / Style Guide rules without a
corresponding option. Whether any individual rule is configurable in v1 is
determined by the option tables earlier in this document; this section
describes *what* we emit, not *why*. Grouped by construct.

### 1. Line width and the fit-or-break algorithm

- Target `max_width` (default `100`). Lines within doc/string/comment
  contents may exceed (rustfmt never wraps them).
- The heuristic values are **percentages of `max_width`**, not absolutes —
  see the note at the top of §Layout-decision drivers for the scaling and
  resolution rules.
- **Fit-or-break algorithm.** Every construct with a flat/broken choice
  (calls, struct literals, arrays, chains, fn signatures, `let` RHS,
  single-line `if`/`let-else`, etc.) uses the same decision:

  ```
  emit flat  iff  flat_width ≤ min(applicable_heuristic, max_width − current_column)
  otherwise  break
  ```

  Both checks must pass:
  - the construct must fit inside its *applicable heuristic*
    (`fn_call_width` for calls, `struct_lit_width` for struct literals,
    `chain_width` for method chains, `array_width` for arrays, etc.),
    **and**
  - the construct must fit in the *remaining column budget* on the
    current line (i.e. `max_width` minus the column where the construct
    starts).

  This is the shared mechanism behind every "try single-line first, else
  go vertical" rule in §§4, 9, 12, 13, 17. Rules in those sections cite
  only the applicable heuristic for brevity; the `max_width` half of the
  check always applies as well.

### 2. Indentation

- Indentation is expressed in integer indent levels. Emission uses
  `tab_spaces` spaces per level, or one `\t` per level when `hard_tabs = true`.
  Alignment (columns inside a line, not indent) always uses spaces, even under
  `hard_tabs`.
- Block indent: break after opener, body at `outer + 1` level, closer at
  `outer` level. Visual indent is deferred (see table).

### 3. Brace placement

- Items (`fn`, `impl`, `trait`, `mod`, `struct`, `enum`, `union`): `{` on the
  declaration line.
- Exception: if a `where` clause is multi-line, the body `{` moves to its own
  line at outer indent.
- Control flow (`if`, `while`, `for`, `loop`, `match`, `async`, `unsafe`): `{`
  on same line.
- Empty body: single line (`fn f() {}`, `impl T {}`).

### 4. Trailing commas

- Emit iff list is broken across lines.
- Exceptions baked into the rules:
  - Tuples: never, except the 1-tuple `(x,)`.
  - Function types: never.
  - Block-bodied match arms: no trailing comma.
  - Non-block match arms: comma after every arm.
  - `..base` in struct literal: never.

### 5. Spacing

Fixed rules — no options:

- `:` in annotations, fields, bounds: no space before, one after.
- `::` path separator: no spaces.
- `,`: no space before, one after.
- `=>`, `->`, `=` (in bindings/assignments/consts): one space on each side.
- Binary operators: one space on each side.
- Unary prefix (`!`, `-`, `&`, `&mut`, `*`): no space between op and operand.
- `&'a T`, `&'a mut T`: one space between lifetime and `mut`/type.
- Generic brackets `<T>`: no inner spaces, no space before `<`.
- Trait bounds `T + Send + Sync`: one space around `+`.
- Ranges `a..b`, `a..=b`, `..x`: no spaces.
- Multi-line binary ops: break **before** the operator. `as`-casts follow
  the same rule (break before `as`) — noted explicitly because readers
  sometimes assume they behave like assignments. Exception: assignment ops
  (`=`, `+=`, etc.) break **after**.
- `;`, `?`: no space before.
- Array repeat `[T; N]`: space after `;`.
- Attribute `#[foo = bar]`: one space around `=`.

### 6. Imports

- Within a group (blank-line-delimited run of `use` items), sort
  alphabetically. The exact sort algorithm (ASCII-lexicographic under
  stable, with `self` / `super` pinned first and glob `*` pinned last)
  is specified in §Sort stability under Style Guide rules.
- Inside `use a::{…}` brace lists: `self` first, `super` next, glob `*`
  last, rest sorted between per the same algorithm.
- If any entry in a `use a::{…}` list is itself a nested list, the entire
  enclosing list goes multi-line, one entry per line, trailing comma.
- rustfmt **does not** merge (`use a::b; use a::c;` stays two statements)
  and **does not** split by crate origin — these are our responsibility
  if we want the output.

### 7. Attributes and derives

- One attribute per line, same indent as the item.
- `#[derive(...)]` lists merged across adjacent derives; list order preserved
  exactly as written (not sorted).
- Inner attributes `#![…]` indent at the inside of the item.

### 8. Doc comments

- `///` for outer docs, `//!` for inner.
- One space after the sigil.
- **Bodies not reformatted.** Long doc lines stay long. If we want wrapping,
  we wrap before emission.

### 9. Structs and enums

- Unit struct: `struct Foo;`.
- Record struct multi-line: `{` on decl line, each field block-indented on its
  own line, trailing comma, `}` on its own line at outer indent.
- Tuple struct: single-line preferred, no trailing comma.
- Enum: each variant on its own line, trailing comma. Struct variants may be
  single-line iff short (≤ `struct_variant_width = 35`).
- Short record struct literal (body ≤ `struct_lit_width = 18`): single-line
  with spaces inside braces — `Foo { x, y: 0 }`.
- No alignment of `:` across struct fields (`struct_field_align_threshold = 0`).
- No alignment of `=` across enum discriminants (`enum_discrim_align_threshold
  = 0`).

### 10. Match arms

- `match { … }` always multi-line.
- Arm body inline on same line as `=>` unless: multi-statement, has line
  comments, or doesn't fit — then use `{ … }` block.
- Non-block arm ends with `,` always.
- Block arm ends without `,`.
- Pattern alternatives with `|` break before `|`, no extra indent.
- With `if` guard that doesn't fit, block-body the arm.

### 11. Where clauses

- `where_single_line = false` (unstable default): `where` clauses are
  always broken onto their own line(s) — never kept inline with the
  signature. All the rules below follow from that.
- On its own line at outer indent after the signature.
- Each bound on its own block-indented line, trailing comma.
- If body follows (`where … {`), `{` moves to its own line at outer
  indent when the where clause is multi-line.
- If item terminates with `;` (trait item forward-decl), no trailing
  comma on the last bound.

### 12. Function signatures

- Try single-line first.
- If overflow, go fully vertical: break after `(`, one param per line
  block-indented, trailing comma, `)` on its own line, `-> R {` attached.
- Generics `<T, U>` wrap independently when they don't fit.
- Return type attached to `)` when it fits; otherwise break before `->`,
  block-indent `-> R`.

### 13. Chains

- Single line if the flat chain fits in `chain_width = 60`.
- Otherwise: first segment on base line, every subsequent `.method()` / `.field`
  on its own block-indented line with the `.` at the start of the new line.
- `?` stays attached to its receiver.

### 14. Closures

- `|…|` no inner spaces; one space between `move` and `|` when present.
- Omit `{}` for a single-expression body with no return type annotation.
- Add `{}` when there's a return type, multiple statements, comments, or a
  multi-line control-flow body.

### 15. Blocks, blank lines, statements

- At most one blank line between items.
- Blocks go multi-line unless: expression position, no statements, no
  comments, and fits flat — then `{ expr }` with inner spaces.
- No space before `;`.

### 16. Types

- `&T`, `&mut T`, `*const T`, `*mut T`: no space after sigil.
- `&'a T`: one space between lifetime and what follows.
- Function types: `unsafe extern "C" fn(A, B) -> R` — single spaces around
  keywords, no trailing commas in `(…)`.
- Arrays: `[T; N]`, space after `;`.

### 17. `let` / `let-else`

- Single line when possible.
- Overflow: break after `=`, block-indent RHS.
- If type forces a break: break after `:`, block-indent both type and RHS.
- `let-else` single-line iff short, single-line `else` body, no comments; else
  `else {` stays on the `=` line, body breaks, `};` on its own line at outer
  indent.

## Rustfmt at default won't fix these — we decide

Rustfmt leaves these alone at its defaults. They split into two categories
by where the decision lives.

### Emitter features (could be implemented, emitter produces the output)

Things rustfmt will not add automatically. If we want the generated code
to have them, the emitter produces them at emit time. Whether each is on
the v1 roadmap is separate from whether rustfmt would do it:

- Import merging (`use a::b; use a::c;` → `use a::{b, c};`).
- Import crate-origin grouping (`std` / external / `crate` blocks).
- Canonical derive ordering (if the emitter chooses to enforce a sort).
- Empty-line placement between items (bounded by rustfmt's 1-line cap).
- **Macro invocation bodies**: `format_macro_bodies = true` (unstable
  default) means rustfmt *will* reformat any macro body it can parse as
  Rust (`println!(…)`, `vec![…]`, arg lists in user macros). The emitter
  must produce rustfmt-conformant content inside macro invocations —
  macro argument lists flow through the same expression/list emitter as
  ordinary code, not through ad-hoc string concatenation.

### Component-author-controlled content (emitter renders as given)

Content supplied by the component author. The emitter does not rewrite
these; if the author emits non-conformant content, neither we nor rustfmt
will fix it:

- Doc comment body text and wrapping.
- Hex literal case (within-literal consistency is the author's concern;
  see Style Guide section).
- Float literal form (trailing zeros, exponent form, etc.).
- Non-doc comment body text.

### Note on `// @generated`

`format_generated_files = true` is rustfmt's stable default — a `// @generated`
marker does **not** opt our output out of `cargo fmt`. This is intentional on
our side: the whole point of strict conformance is that running rustfmt on
generated output is a no-op. Do not reach for the `@generated` marker as an
escape hatch for non-conforming output; fix the emitter instead.

If a *specific* macro body genuinely cannot be emitted in a rustfmt-conformant
form (e.g. a DSL whose body does not parse as Rust but happens to match the
Rust parser by accident), the correct future escape hatch is
`skip_macro_invocations` (unstable, default empty), which lists macros whose
invocations rustfmt must leave alone. We don't rely on it today because it's
unstable, but that is the right tool — not `@generated`.

## Style Guide rules rustfmt does not enforce

These are prescriptions from the Rust Style Guide (and RFC 430 for naming)
that `rustfmt --check` will not flag if violated — but a code generator
should follow them to produce idiomatic Rust. Sources cited parenthetically.

### Doc comments

- Always emit `///` for outer docs; use `//!` for module/crate inner docs.
  Never emit `/** … */` or `/*! … */` — rustfmt preserves whichever form you
  use (index.html, Comments).
- First sentence of a doc comment is a summary ending with a period. Rustfmt
  cannot grammar-check. The content is usually user-supplied via Alloy; we
  ensure we don't strip or rewrap it.
- No comments inside function signatures, and no comments on lines that
  contain a block brace (items.html Function definitions, expressions.html
  Blocks).
- Doc comments are placed **before** attributes on an item. This is a
  Style Guide convention, not a rustfmt-enforced rule — rustfmt preserves
  whichever order you emit. We follow the convention unconditionally.

### Item ordering within a module

Rustfmt sorts imports within a blank-line-delimited group but never reorders
across item *kinds*. The emitter produces this order per module:

1. `extern crate` declarations at file top, sorted, as a single group.
2. `use` declarations, sorted within each group we emit.
3. `mod x;` declarations.
4. All other items.

`#[macro_use] extern crate …` / `#[macro_use] mod …` start a new import
group boundary — never fold them into an adjacent sorted group (items.html).

### Construct choices

Rustfmt never rewrites these; we pick the right form at emit time:

- Empty record or tuple struct: emit `struct Foo;` (unit form), never
  `struct Foo {}` or `struct Foo()` (items.html, Structs).
- Closure braces: omit `{}` when body is a single expression with no return
  type annotation, no statements, no comments, and no multi-line control
  flow (expressions.html, Closures).
- Qualify enum literals with the enum name (`Ordering::Less`) unless the
  variant is in the prelude (expressions.html, Enum literals).
- Array-literal / collection-initialiser macros use `[]` (`vec![…]`);
  statement-position macros use `()` or `[]` and end with `;`
  (expressions.html / statements.html).
- Never wrap an `if` / `while` condition in unnecessary parens. Rustfmt
  will not strip them (expressions.html).
- Parenthesise compound range bounds: `..(x + 1)`, not `..x + 1`
  (expressions.html, Ranges).
- Don't break between a unary operator and its operand.

### Literals

- Hex case must be consistent within a single literal: `0xFF` or `0xff`,
  never `0xFf`. `hex_literal_case` (unstable) enforces project-wide; at
  default rustfmt only the within-literal consistency is mandated by the
  Style Guide (expressions.html, Hexadecimal literals).
- The Style Guide is silent on numeric underscore grouping, string-literal
  quoting style, and raw-string use. We pick defaults at emit time.

### Naming (RFC 430, not the Style Guide)

Naming conventions are governed by RFC 430, surfaced as the `non_snake_case`
/ `non_camel_case_types` / `non_upper_case_globals` lints. The Style Guide
mentions only "single-letter generic parameter names." We follow RFC 430
unconditionally — if Alloy user input violates it, that's a user-input
concern, not ours to force:

- `UpperCamelCase` — types, traits, enum variants, type parameters.
- `snake_case` — functions, methods, variables, modules, crates.
- `SCREAMING_SNAKE_CASE` — consts, statics.

### Sort stability

Anything we pre-sort that rustfmt may also sort (imports, `mod`
declarations) must match rustfmt's exact algorithm, otherwise rustfmt will
reorder our output and `--check` fails.

Under stable rustfmt today — including when the input is edition 2024 —
this is ASCII-lexicographic with `self`/`super` pinned first in brace
lists and glob `*` pinned last. The Unicode-aware version-sort specified
for `style_edition = "2024"` is **not** active on stable, because
`style_edition` is unstable (see Edition handling above). A future
stabilisation of `style_edition` would shift the sort algorithm for
edition 2024 input; the style-edition-sensitive helper reserved in the
architecture is the plug-in point for that change.

### Out of scope: authoring-level semantic choices

Some Style Guide (and Clippy) conventions depend on knowing *intent* that
only the component author has. The emitter renders the tree it's given and
does not rewrite between semantically-equivalent forms. These are the
author's responsibility, not the emitter's:

- **`Self` vs the enclosing type name inside `impl`** (Clippy `use_self`):
  whether to write `Self::new()` / `Self { … }` or `Foo::new()` /
  `Foo { … }` inside `impl Foo { … }`.
- **Inline bound vs `where` clause** (items.html, Generics): the Style Guide
  prefers an inline bound `fn f<T: Bound>(…)` for a "short" constraint and a
  `where` clause otherwise, but "short" is defined only narratively and the
  choice is semantically equivalent. The emitter renders whichever form the
  author built and does not auto-convert between them.
- **Dereferencing vs reference-taking in comparisons** (Style Guide,
  Binary operations): `*t == u` vs `t == &u`.
- **Where to use `?` vs explicit `match` on `Result` / `Option`**.
- **Implicit tail-expression return vs explicit `return`**.
- **`else if` chaining vs nested `else { if … }`**.

The emitter will preserve the author's choice; it will not normalise.

## Explicitly out of scope (v1)

- `fn_params_layout = "Compressed"` — deferred, needs different algorithm.
- All unstable options — not exposed in our config. Their *default behavior*
  is still enforced because stable rustfmt enforces it. Notable unstable
  options users often assume are configurable defaults and are **not**:
  `indent_style`, `brace_style`, `control_brace_style`, `trailing_comma`,
  `empty_item_single_line`, `imports_granularity`, `group_imports`,
  `wrap_comments`, `format_code_in_doc_comments`, `normalize_comments`,
  `format_strings`, `struct_field_align_threshold`,
  `enum_discrim_align_threshold`, `fn_single_line`, `where_single_line`,
  `hex_literal_case`, `float_literal_trailing_zero`,
  `overflow_delimited_expr`, `condense_wildcard_suffixes`,
  `reorder_impl_items`.
- Style-edition 2024-specific rules (version-sort imports, Unicode-aware sort)
  — because `style_edition` is unstable. Current stable rustfmt formats
  edition 2024 files under 2021-style rules.
- Comment / string / doc-body reformatting of any kind.

## Architectural reservations (not implemented, but not foreclosed)

For each of the following future directions, the v1 architecture should leave
a clean plug-in point — but ship no code for it yet:

- Style-edition branching (helpers around style-sensitive decisions).
- Visual indent (`indent_style = "Visual"` — unstable today; may never
  stabilise, but the align-to-column primitive is cheap to design for).
- `fn_params_layout = "Compressed"` (horizontal packing).
- Brace-placement variants (Allman / Stroustrup — unstable).
- Import merging and crate-origin grouping (unstable).
- Struct field / enum discriminant alignment (unstable).
- Comment wrapping (unstable).

How those plug-in points should look is the subject of the architecture plan
(next document).
