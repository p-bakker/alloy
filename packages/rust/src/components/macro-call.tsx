import type { Children } from "@alloy-js/core";
import { For, Indent, Wrap, isComponentCreator } from "@alloy-js/core";

import { useCrateContext } from "../context/crate-context.js";
import { useRustFormatOptions } from "../context/format-options.js";
import { useResolvedHeuristics } from "../context/resolved-heuristics.js";
import { ArgList } from "./primitives/arg-list.js";

export interface MacroCallProps {
  name: string;
  args?: Children[];
  bracket?: "paren" | "bracket" | "brace";
}

/**
 * Rustfmt's hardcoded `SPECIAL_CASE_MACROS` table from
 * `src/overflow.rs`. The tuple is `(macro-name-without-bang,
 * num_args_before)` — when the call is paren-form and
 * `args.length > num_args_before`, rustfmt renders the wrapped form
 * with the args at indices `[0, num_args_before)` one-per-line,
 * the arg at `num_args_before` (the format string) on its own line,
 * and the args at `(num_args_before, end)` bundled onto a single
 * shared line.
 *
 * `trace!` is only included under edition 2024 or later; see the
 * edition check in `specialCaseArgsBefore`.
 */
const SPECIAL_CASE_MACROS_BASE: ReadonlyMap<string, number> = new Map([
  // format! like macros
  ["eprint", 0],
  ["eprintln", 0],
  ["format", 0],
  ["format_args", 0],
  ["print", 0],
  ["println", 0],
  ["panic", 0],
  ["unreachable", 0],
  ["debug", 0],
  ["error", 0],
  ["info", 0],
  ["warn", 0],
  // write! like macros
  ["assert", 1],
  ["debug_assert", 1],
  ["write", 1],
  ["writeln", 1],
  // assert_eq! like macros
  ["assert_eq", 2],
  ["assert_ne", 2],
  ["debug_assert_eq", 2],
  ["debug_assert_ne", 2],
]);

function specialCaseArgsBefore(
  name: string,
  edition: number,
): number | undefined {
  if (edition >= 2024 && name === "trace") {
    return 0;
  }
  return SPECIAL_CASE_MACROS_BASE.get(name);
}

export function MacroCall(props: MacroCallProps) {
  const bracket = props.bracket ?? "paren";
  const args = props.args ?? [];
  const { fnCallWidth } = useResolvedHeuristics();
  const { maxWidth = 100 } = useRustFormatOptions();
  const edition = Number(useCrateContext()?.edition ?? 0);

  // Rustfmt delimiter conventions:
  //   `name!(…)` — no trailing comma on wrap.
  //   `name![…]` — trailing comma on wrap (vec!-style lists).
  //   `name! {…}` — body is passed through verbatim by default
  //                 (`format_macro_bodies`), so we keep it flat here
  //                 and match rustfmt's space-before-brace prefix.
  //
  // For `name!(args)` / `name![args]`, rustfmt formats the delimited
  // list as a function-call: it compares the **arg-list content** (no
  // name, no delimiters, no indent) against `fn_call_width` (default
  // 60) to decide flat vs broken, subject to the usual `max_width`
  // cap. So we delegate the measurement to the delimited list itself
  // — the `name!` prefix is outside the measured group.
  switch (bracket) {
    case "paren":
    case "bracket": {
      const open = bracket === "paren" ? "(" : "[";
      const close = bracket === "paren" ? ")" : "]";
      const trailingComma = bracket === "bracket";

      if (args.length === 0) {
        return (
          <>
            {props.name}
            {"!"}
            {open}
            {close}
          </>
        );
      }

      // Rustfmt's `SPECIAL_CASE_MACROS` layout: for paren-form calls
      // on a hardcoded set of macros (format!, println!, assert_eq!,
      // write!, …), once the call wraps, the args after the format
      // string are bundled onto a single shared line rather than
      // each taking their own line. Only applies when there is at
      // least one arg past the format-string position — i.e.
      // `args.length > num_args_before`. Deliberately ordered BEFORE
      // the nested-macro hoist so `assert!(matches!(…))` with two
      // args (`num_args_before=1`, `args.length=2`) routes here,
      // while `assert!(matches!(…))` with one arg falls through to
      // the hoist (`1 > 1` is false).
      if (bracket === "paren") {
        const argsBefore = specialCaseArgsBefore(props.name, edition);
        if (argsBefore !== undefined && args.length > argsBefore) {
          return renderSpecialCaseMacroCall(
            props.name,
            args,
            argsBefore,
            fnCallWidth,
            maxWidth,
          );
        }
      }

      // Single-macro-arg hoist: when the sole arg is another
      // `MacroCall`, rustfmt hoists the inner macro's opener onto the
      // outer's opener line once the group breaks, so we render e.g.
      //
      //   assert!(matches!(
      //       pat1,
      //       pat2
      //   ));
      //
      // rather than breaking both outer and inner. This matches
      // rustfmt's preferred shape for `outer!(inner!(args))`.
      if (
        bracket === "paren" &&
        args.length === 1 &&
        isComponentCreator(args[0], MacroCall)
      ) {
        const innerProps = (args[0] as any).props as MacroCallProps;
        const innerBracket = innerProps.bracket ?? "paren";
        // Only hoist when the inner is also a paren-form macro call
        // with args; hoisting a bracket!/brace! form doesn't match
        // rustfmt's behavior and would be visually confusing.
        if (innerBracket === "paren" && (innerProps.args?.length ?? 0) > 0) {
          return renderNestedMacroCall(props.name, innerProps, fnCallWidth);
        }
      }

      // The measured group content is only the comma-joined args
      // (plus the softline / indent primitives the renderer needs),
      // so the flat width compared against `fn_call_width` is the
      // arg-list content — matching rustfmt's rule for `name!(args)`.
      // The delimiters ride outside the group.
      return (
        <>
          {props.name}
          {"!"}
          {open}
          <group max={fnCallWidth}>
            <Indent softline trailingBreak>
              <For
                each={args}
                joiner={
                  <>
                    , <softline />
                  </>
                }
              >
                {(item) => item}
              </For>
              {trailingComma ? <ifBreak>,</ifBreak> : null}
            </Indent>
          </group>
          {close}
        </>
      );
    }
    case "brace":
      return (
        <>
          {props.name}
          {"! "}
          {"{"}
          {args.map((arg, i) => (
            <>
              {i > 0 ? ", " : null}
              {arg}
            </>
          ))}
          {"}"}
        </>
      );
  }
}

/**
 * Render `outer!(inner!(args))` in rustfmt's preferred shape.
 *
 * Flat: `outer!(inner!(a, b))`. Broken: outer's `(` and inner's
 * `name!(` share the opener line; inner args are block-indented one
 * level relative to the outer, and the two closing parens sit on the
 * trailing line as `))`.
 *
 * Break decision is gated by the inner arg list against `fn_call_width`
 * — the same rule the inner would apply on its own. The outer never
 * contributes independent width pressure because its only non-args
 * content is the fixed-width `outer!` prefix and two parens.
 */
function renderNestedMacroCall(
  outerName: string,
  inner: MacroCallProps,
  fnCallWidth: number,
): Children {
  const innerArgs = inner.args ?? [];
  // The outer parens surround a single argument: `inner!(innerArgs)`.
  // Rustfmt compares that argument's width against `fn_call_width`.
  // The measured group content is just the inner args, so we shrink
  // `max` by the length of the inner macro's `name!(` opener and the
  // closing `)` (the fixed-width framing rustfmt counts but we don't
  // keep inside the measured group).
  //
  // When broken, the outer `)` follows the group directly so the two
  // closing parens render adjacent (`));`).
  const frame = inner.name.length + 3; // name + "!(" + ")"
  const max = Math.max(0, fnCallWidth - frame);
  return (
    <>
      {outerName}
      {"!("}
      {inner.name}
      {"!("}
      <group max={max}>
        <Indent softline trailingBreak>
          <For
            each={innerArgs}
            joiner={
              <>
                , <softline />
              </>
            }
          >
            {(item) => item}
          </For>
        </Indent>
      </group>
      {"))"}
    </>
  );
}

/**
 * Render a rustfmt `SPECIAL_CASE_MACROS` paren-form call with the
 * bundled-after-format-string layout.
 *
 * Flat: `name!(a, b, c, d)` (all args comma-joined, matches rustfmt
 * when the flat call fits `fn_call_width`).
 *
 * Broken: args at `[0, argsBefore)` each on their own indented line,
 * the arg at `argsBefore` (the format string) on its own line, and
 * args at `(argsBefore, end)` bundled onto a single indented line
 * joined by `", "` (plain commas — these never break further, so the
 * joiner is literal, not a softline).
 *
 * Caller guarantees `args.length > argsBefore` and `bracket === "paren"`.
 */
function renderSpecialCaseMacroCall(
  name: string,
  args: Children[],
  argsBefore: number,
  fnCallWidth: number,
  maxWidth: number,
): Children {
  // Args split into three slots that each render as a "bundle" on
  // their own line when the outer group breaks:
  //   before    — args[0 .. argsBefore)         — bundled one-liner
  //   formatArg — args[argsBefore]              — on its own line
  //   after     — args[argsBefore + 1 .. end)   — bundled one-liner
  //
  // Matches rustfmt: for `assert_eq!(left, right, "fmt", a, b)`
  // (`num_args_before=2`) the wrapped form is
  //
  //     assert_eq!(
  //         left, right,
  //         "fmt",
  //         a, b
  //     );
  //
  // Flat form (outer group fits): all args comma-joined on one line.
  // Broken form: three segments separated by `,` + softline. Inside
  // each bundle a nested `<group max={maxWidth}>` allows fallback to
  // one-per-line when the bundle itself would blow past the print
  // width — which is rustfmt's own fallback behaviour. Known
  // limitation: rustfmt also falls back when the bundle contains a
  // "complex" expression (function call, etc.) even if it would fit
  // width-wise. We don't introspect arg shape today.
  const before = args.slice(0, argsBefore);
  const formatArg = args[argsBefore];
  const after = args.slice(argsBefore + 1);

  const renderBundle = (items: Children[]): Children => (
    <group max={maxWidth}>
      <For
        each={items}
        joiner={
          <>
            , <softline />
          </>
        }
      >
        {(item) => item}
      </For>
    </group>
  );

  // Segments are the parts of the arg list that each get their own
  // indented line when the outer group breaks. Flat form is
  // unaffected: all softlines collapse to empty, bundle-internal
  // joiners render as `, `, and segment joiners render as `, ` too.
  const segments: Children[] = [];
  if (before.length > 0) {
    segments.push(renderBundle(before));
  }
  segments.push(formatArg);
  if (after.length > 0) {
    segments.push(renderBundle(after));
  }

  return (
    <>
      {name}
      {"!("}
      <group max={fnCallWidth}>
        <Indent softline trailingBreak>
          <For
            each={segments}
            joiner={
              <>
                , <softline />
              </>
            }
          >
            {(item) => item}
          </For>
        </Indent>
      </group>
      {")"}
    </>
  );
}
