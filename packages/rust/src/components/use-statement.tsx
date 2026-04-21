import { code, memo } from "@alloy-js/core";

import { useCrateContext } from "../context/crate-context.js";
import { useRustModuleScope } from "../scopes/contexts.js";
import { compareImportEntry } from "../style/sort-comparator.js";
import { type RustVisibility } from "../symbols/rust-output-symbol.js";
import { BracedList } from "./primitives/braced-list.js";
import {
  type RustVisibilityProps,
  toRustVisibility,
  VisibilityPrefix,
} from "./visibility.js";

export interface UseStatementProps extends RustVisibilityProps {
  path: string;
  symbol: string;
}

interface UseStatementLineProps {
  path: string;
  visibility: RustVisibility;
  symbols: string[];
}

interface UseStatementGroupProps {
  entries: UseStatementLineProps[];
}

// Registers the import into the enclosing module scope; `<UseStatements />`
// groups and renders all entries with the same (path, visibility).
export function UseStatement(props: UseStatementProps) {
  const moduleScope = useRustModuleScope();
  const visibility = toRustVisibility(props.pub);
  moduleScope.addUse(props.path, props.symbol, visibility);
  return null;
}

function UseStatementLine(props: UseStatementLineProps) {
  const ctx = useCrateContext();
  const compare = compareImportEntry(ctx?.edition);
  const sortedSymbols = [...props.symbols].sort(compare);

  // Rustfmt forces a `use a::{…}` brace list onto multiple lines whenever
  // any entry is itself a nested brace list (e.g. `io::{self, Read}`),
  // regardless of whether the flat form would fit. We don't have an
  // AST-level representation of nested use trees today: callers encode a
  // nested entry by embedding a `{` in the symbol string. Detect that
  // textually here. If/when a structural nested-use model lands, swap
  // this heuristic for a type-safe check.
  const body =
    sortedSymbols.length === 1 ? (
      sortedSymbols[0]
    ) : (
      <BracedList
        forceBreakIf={(s) => typeof s === "string" && s.includes("{")}
      >
        {sortedSymbols}
      </BracedList>
    );

  return (
    <>
      <VisibilityPrefix pub={props.visibility} />
      {code`use `}
      {props.path}
      {code`::`}
      {body}
      {code`;`}
    </>
  );
}

function UseStatementGroup(props: UseStatementGroupProps) {
  return (
    <>
      {props.entries.map((entry, index) => (
        <>
          <UseStatementLine
            path={entry.path}
            visibility={entry.visibility}
            symbols={entry.symbols}
          />
          {index < props.entries.length - 1 ? <hbr /> : null}
        </>
      ))}
    </>
  );
}

/**
 * Order for entries within a bucket: by path ascending, then private-first
 * (undefined visibility) before `pub` variants. Keeps `pub use` re-exports
 * after the plain imports for the same path — the idiomatic layout.
 *
 * The path comparison routes through the edition-aware rustfmt comparator
 * so digit-laden paths sort correctly under the 2024 style edition
 * (version-sort) while pre-2024 editions stay ASCII-lex.
 */
function makeCompareEntries(
  edition: string | undefined,
): (left: UseStatementLineProps, right: UseStatementLineProps) => number {
  const comparePath = compareImportEntry(edition);
  return (left, right) => {
    const byPath = comparePath(left.path, right.path);
    if (byPath !== 0) return byPath;
    const leftVis = left.visibility ?? "";
    const rightVis = right.visibility ?? "";
    if (leftVis < rightVis) return -1;
    if (leftVis > rightVis) return 1;
    return 0;
  };
}

export function UseStatements() {
  const moduleScope = useRustModuleScope();
  const ctx = useCrateContext();
  const compareEntries = makeCompareEntries(ctx?.edition);
  return memo(() => {
    const stdEntries: UseStatementLineProps[] = [];
    const externalEntries: UseStatementLineProps[] = [];
    const crateEntries: UseStatementLineProps[] = [];

    for (const group of moduleScope.imports.values()) {
      const entry: UseStatementLineProps = {
        path: group.path,
        visibility: group.visibility,
        symbols: [...group.names],
      };

      if (group.path === "std" || group.path.startsWith("std::")) {
        stdEntries.push(entry);
      } else if (group.path === "crate" || group.path.startsWith("crate::")) {
        crateEntries.push(entry);
      } else {
        externalEntries.push(entry);
      }
    }

    stdEntries.sort(compareEntries);
    externalEntries.sort(compareEntries);
    crateEntries.sort(compareEntries);

    const groups = [stdEntries, externalEntries, crateEntries].filter(
      (group) => group.length > 0,
    );

    if (groups.length === 0) {
      return <></>;
    }

    return (
      <>
        {groups.map((group, index) => (
          <>
            <UseStatementGroup entries={group} />
            {index < groups.length - 1 ? (
              <>
                <hbr />
                <hbr />
              </>
            ) : null}
          </>
        ))}
      </>
    );
  });
}
