import { code, memo } from "@alloy-js/core";

import { useRustModuleScope } from "../scopes/contexts.js";
import { type RustVisibility } from "../symbols/rust-output-symbol.js";
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
  const sortedSymbols = [...props.symbols].sort((left, right) =>
    left.localeCompare(right),
  );

  const body =
    sortedSymbols.length === 1 ? (
      sortedSymbols[0]
    ) : (
      <>
        {code`{`}
        {sortedSymbols.join(", ")}
        {code`}`}
      </>
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
 */
function compareEntries(
  left: UseStatementLineProps,
  right: UseStatementLineProps,
): number {
  const byPath = left.path.localeCompare(right.path);
  if (byPath !== 0) return byPath;
  return (left.visibility ?? "").localeCompare(right.visibility ?? "");
}

export function UseStatements() {
  const moduleScope = useRustModuleScope();
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
