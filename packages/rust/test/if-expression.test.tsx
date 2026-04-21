import type { Children } from "@alloy-js/core";
import { Output, code, render } from "@alloy-js/core";
import "@alloy-js/core/testing";
import { d } from "@alloy-js/core/testing";
import { describe, expect, it } from "vitest";

import {
  CrateDirectory,
  ElseClause,
  ElseIfClause,
  FunctionDeclaration,
  IfExpression,
  SourceFile,
} from "../src/components/index.js";
import * as Stc from "../src/components/stc/index.js";
import { checkRustfmt, checkRustfmtAllEditions } from "./rustfmt.js";
import { findFile } from "./utils.js";

function inFile(children: Children) {
  return (
    <Output>
      <CrateDirectory name="my_crate">
        <SourceFile path="lib.rs">{children}</SourceFile>
      </CrateDirectory>
    </Output>
  );
}

function inFn(
  children: Children,
  parameters: readonly { name: string; type: string }[] = [
    { name: "cond", type: "bool" },
  ],
) {
  return (
    <FunctionDeclaration name="demo" parameters={parameters} returnType="i32">
      {children}
    </FunctionDeclaration>
  );
}

/**
 * Render a fixture inside a `CrateDirectory` pinned to the given edition
 * and return the rendered source of `src/test.rs`.
 *
 * Mirrors `toSourceText` but threads `edition` through so tests can
 * exercise the edition-sensitive inline if-else form: on `edition="2024"`
 * the emitter is allowed to keep a short `if cond { a } else { b }`
 * flat, while every earlier edition forces the multi-line shape.
 */
function renderWithEdition(children: Children, edition: string): string {
  const res = render(
    <Output>
      <CrateDirectory name="test_crate" edition={edition}>
        <SourceFile path="test.rs">{children}</SourceFile>
      </CrateDirectory>
    </Output>,
    { insertFinalNewLine: false },
  );
  return findFile(res, "src/test.rs").contents;
}

describe("IfExpression", () => {
  it("renders a simple if expression", () => {
    expect(
      inFile(
        <IfExpression condition="self.data.len() >= self.max_capacity">
          {code`return Err(StoreError::StorageFull);`}
        </IfExpression>,
      ),
    ).toRenderTo(d`
      if self.data.len() >= self.max_capacity {
          return Err(StoreError::StorageFull);
      }
    `);
  });

  it("renders chained else-if and else clauses from children", () => {
    expect(
      inFile(
        <IfExpression condition="entry.status == EntryStatus::Expired">
          {code`Err(StoreError::NotFound)`}
          <ElseIfClause condition="entry.is_stale()">{code`Err(StoreError::NotFound)`}</ElseIfClause>
          <ElseClause>{code`Ok(&entry.value)`}</ElseClause>
        </IfExpression>,
      ),
    ).toRenderTo(d`
      if entry.status == EntryStatus::Expired {
          Err(StoreError::NotFound)
      } else if entry.is_stale() {
          Err(StoreError::NotFound)
      } else {
          Ok(&entry.value)
      }
    `);
  });

  it("supports if-let and nested if expressions", () => {
    expect(
      inFile(
        <IfExpression condition="let Some(ttl) = entry.ttl">
          <IfExpression condition="entry.created_at.elapsed() > ttl">
            {code`return Err(StoreError::NotFound);`}
          </IfExpression>
        </IfExpression>,
      ),
    ).toRenderTo(d`
      if let Some(ttl) = entry.ttl {
          if entry.created_at.elapsed() > ttl {
              return Err(StoreError::NotFound);
          }
      }
    `);
  });

  it("stc wrappers render the same output", () => {
    expect(
      inFile(
        Stc.IfExpression({ condition: "value > 10" }).children([
          "value",
          Stc.ElseIfClause({ condition: "value > 0" }).children(["0"]),
          Stc.ElseClause().children(["-1"]),
        ]),
      ),
    ).toRenderTo(d`
      if value > 10 {
          value
      } else if value > 0 {
          0
      } else {
          -1
      }
    `);
  });

  it("keeps a short if-else on one line within single_line_if_else_max_width", () => {
    const source = renderWithEdition(
      inFn(
        <IfExpression condition="cond">
          {code`1`}
          <ElseClause>{code`2`}</ElseClause>
        </IfExpression>,
      ),
      "2024",
    );

    expect(source).toBe(d`
      fn demo(cond: bool) -> i32 {
          if cond { 1 } else { 2 }
      }
    `);
    // The output is an edition-2024 Rust source: under edition 2021
    // rustfmt rewrites the inline form to multi-line, so it only
    // round-trips cleanly on 2024.
    expect(() =>
      checkRustfmtAllEditions(source, { editions: ["2024"] }),
    ).not.toThrow();
  });

  it("breaks an if-else whose flat form exceeds single_line_if_else_max_width", () => {
    const source = renderWithEdition(
      inFn(
        <IfExpression condition="some_flag_value">
          {code`compute_first()`}
          <ElseClause>{code`compute_second()`}</ElseClause>
        </IfExpression>,
        [{ name: "some_flag_value", type: "bool" }],
      ),
      "2024",
    );

    expect(source).toBe(d`
      fn demo(some_flag_value: bool) -> i32 {
          if some_flag_value {
              compute_first()
          } else {
              compute_second()
          }
      }
    `);
    // Multi-line form round-trips under every supported edition.
    expect(() => checkRustfmtAllEditions(source)).not.toThrow();
  });

  it("emits the multi-line form under pre-2024 editions even when the flat form would fit", () => {
    const source = renderWithEdition(
      inFn(
        <IfExpression condition="cond">
          {code`1`}
          <ElseClause>{code`2`}</ElseClause>
        </IfExpression>,
      ),
      "2021",
    );

    expect(source).toBe(d`
      fn demo(cond: bool) -> i32 {
          if cond {
              1
          } else {
              2
          }
      }
    `);
    // The multi-line form is what every pre-2024 style edition expects;
    // rustfmt 2024 would rewrite it to the flat form, which is the
    // whole point of the edition gate, so this source is checked
    // against the three pre-2024 editions only.
    expect(() =>
      checkRustfmtAllEditions(source, {
        editions: ["2015", "2018", "2021"],
      }),
    ).not.toThrow();
  });

  it("emits the inline form under edition 2024 when the flat form fits", () => {
    const source = renderWithEdition(
      inFn(
        <IfExpression condition="cond">
          {code`1`}
          <ElseClause>{code`2`}</ElseClause>
        </IfExpression>,
      ),
      "2024",
    );

    expect(source).toBe(d`
      fn demo(cond: bool) -> i32 {
          if cond { 1 } else { 2 }
      }
    `);
    // Feed rustfmt directly at edition 2024 to prove the flat form is
    // what rustfmt itself produces on that style edition. Going via
    // `checkRustfmtAllEditions` without an edition filter would fail on
    // 2021 because rustfmt there wants the multi-line form.
    const normalised = source.endsWith("\n") ? source : `${source}\n`;
    expect(checkRustfmt(normalised, { edition: "2024" })).toEqual({
      pass: true,
    });
  });

  it("keeps a short if without else multi-line (no else disqualifies inline form)", () => {
    expect(inFile(<IfExpression condition="cond">{code`1`}</IfExpression>))
      .toRenderTo(d`
      if cond {
          1
      }
    `);
  });

  it("keeps a short if / else-if / else chain multi-line", () => {
    expect(
      inFile(
        <IfExpression condition="cond">
          {code`1`}
          <ElseIfClause condition="other">{code`2`}</ElseIfClause>
          <ElseClause>{code`3`}</ElseClause>
        </IfExpression>,
      ),
    ).toRenderTo(d`
      if cond {
          1
      } else if other {
          2
      } else {
          3
      }
    `);
  });

  it("keeps a multi-statement body multi-line even when each statement is short", () => {
    expect(
      inFile(
        <IfExpression condition="cond">
          {code`s1;`}
          {code`s2`}
          <ElseClause>{code`0`}</ElseClause>
        </IfExpression>,
      ),
    ).toRenderTo(d`
      if cond {
          s1;
          s2
      } else {
          0
      }
    `);
  });
});
