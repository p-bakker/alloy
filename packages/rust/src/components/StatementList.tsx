import {
  Children,
  childrenArray,
  isComponentCreator,
  memo,
} from "@alloy-js/core";
import { LetDeclaration, ConstDeclaration, StaticDeclaration } from "./var/declaration.js";
import { AssignmentStatement } from "./expression/assignment.js";
import { FunctionDeclaration } from "./function/function.js";
import { StructDeclaration } from "./struct/declaration.js";
import { EnumDeclaration } from "./enum/declaration.js";
import { TraitDeclaration, TraitMethod } from "./trait/declaration.js";
import { ImplBlock } from "./impl/declaration.js";
import { ModBlock, ModDeclaration } from "./module/mod-declaration.js";
import { TestModule } from "./module/test-module.js";
import { MacroRules } from "./macro/macro-rules.js";
import { ForLoop, WhileLoop, WhileLetLoop, Loop } from "./expression/loops.js";
import { IfExpression, IfLetExpression } from "./expression/if-expression.js";
import { MatchExpression } from "./expression/match-expression.js";
import { TypeAlias } from "./type/declaration.js";

export interface StatementListProps {
  children: Children;
}

/**
 * The set of Rust component types that are statements or declarations —
 * items that always need a newline after them in a statement list.
 */
const statementComponents = new Set([
  // Variable/constant declarations (include their own `;`)
  LetDeclaration,
  ConstDeclaration,
  StaticDeclaration,
  AssignmentStatement,
  // Type declarations (end with `}` or `;`)
  FunctionDeclaration,
  StructDeclaration,
  EnumDeclaration,
  TraitDeclaration,
  TraitMethod,
  ImplBlock,
  ModBlock,
  ModDeclaration,
  TestModule,
  MacroRules,
  TypeAlias,
  // Control flow (end with `}`)
  ForLoop,
  WhileLoop,
  WhileLetLoop,
  Loop,
  IfExpression,
  IfLetExpression,
  MatchExpression,
]);

/**
 * Check whether a child is a statement/declaration component that needs
 * a newline after it.
 */
function isStatementComponent(child: Children): boolean {
  return isComponentCreator(child) && statementComponents.has((child as any).component);
}

/**
 * Check whether a merged item (possibly `[component, ";"]`) contains
 * a statement component or a semicolon-terminated expression.
 */
function isStatement(child: Children): boolean {
  if (isStatementComponent(child)) return true;
  // A merged [component, ";"] array — the semicolon turns the expression
  // into a statement.
  if (Array.isArray(child) && child.length === 2 && child[1] === ";") {
    return true;
  }
  // A text string ending with `;` is a complete statement
  // (e.g., raw `use` declarations or inline Rust code).
  if (typeof child === "string" && child.trimEnd().endsWith(";")) {
    return true;
  }
  return false;
}

/**
 * A Rust statement list that auto-separates statement children with newlines.
 *
 * Only inserts hardlines after children that are statement/declaration
 * components (like `LetDeclaration`, `FunctionDeclaration`, etc.) or
 * expression components followed by `;`. Text children and expression
 * components concatenate inline, preserving patterns like JSX brace
 * escaping and `code` template literals with refkeys.
 *
 * @example
 * ```tsx
 * <FunctionDeclaration name="example">
 *   <LetDeclaration name="x">42</LetDeclaration>
 *   <MacroCall name="println">"x = {}", x</MacroCall>;
 *   <MacroCall name="format">"result: {}", x</MacroCall>
 * </FunctionDeclaration>
 * ```
 * Produces:
 * ```rust
 * fn example() {
 *     let x = 42;
 *     println!("x = {}", x);
 *     format!("result: {}", x)
 * }
 * ```
 */
export function StatementList(props: StatementListProps) {
  const output = memo(() => {
    const items = childrenArray(() => props.children, {
      preserveFragments: true,
    });

    // First pass: merge trailing `;` onto preceding component children.
    const merged: Children[] = [];
    for (let i = 0; i < items.length; i++) {
      const child = items[i];

      if (typeof child === "string" && merged.length > 0) {
        const trimmed = child.trimStart();
        if (trimmed.startsWith(";")) {
          const prev = merged[merged.length - 1];
          // Only merge `;` if the preceding child is a component.
          if (typeof prev !== "string") {
            merged[merged.length - 1] = [prev, ";"];
            const rest = trimmed.slice(1).trim();
            if (rest.length > 0) {
              merged.push(rest);
            }
            continue;
          }
        }
      }

      merged.push(child);
    }

    // Second pass: insert <hbr /> at statement boundaries.
    const result: Children[] = [];
    for (let i = 0; i < merged.length; i++) {
      if (i > 0) {
        const prev = merged[i - 1];
        const curr = merged[i];
        // Insert hardline after a statement.
        // Insert hardline before a statement component.
        // Insert hardline before a merged [expr, ";"] only if the
        // preceding item looks like a complete statement (not an
        // incomplete inline expression like "let val = ").
        const prevIsStatement = isStatement(prev);
        const currIsStatement = isStatementComponent(curr)
          || (isStatement(curr) && prevIsStatement);
        if (prevIsStatement || currIsStatement) {
          result.push(<hbr />);
        }
      }
      result.push(merged[i]);
    }
    return result;
  });

  return <>{output}</>;
}
