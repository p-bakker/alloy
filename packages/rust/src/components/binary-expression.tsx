import type { Children } from "@alloy-js/core";

/**
 * The set of Rust operators rustfmt treats as assignment-family, i.e.
 * operators that follow the break-after rule when a binary expression
 * has to wrap across lines. Everything outside this set (including
 * comparison `==`, `!=`, `<=`, `>=`) follows the break-before rule.
 *
 * Plain `=` is not included because this component is intentionally
 * expression-level only. `let … = …` bindings own their own break
 * behaviour (see `LetBinding`); this component covers compound
 * assignments that can legitimately appear as an expression.
 */
const ASSIGNMENT_OPERATORS = new Set([
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "<<=",
  ">>=",
]);

function isAssignmentOperator(op: string): boolean {
  return ASSIGNMENT_OPERATORS.has(op);
}

export interface BinaryExpressionProps {
  /** Left-hand operand. */
  left: Children;
  /**
   * The operator as a bare string — e.g. `"+"`, `"&&"`, `"=="`, `"as"`.
   * The component does not model operator precedence; callers that nest
   * `BinaryExpression`s are responsible for parenthesising operands
   * where associativity or precedence demands it.
   *
   * Range operators (`..`, `..=`) are intentionally not supported: per
   * rustfmt they render without surrounding spaces and do not share the
   * break-before/break-after treatment of arithmetic/logical operators.
   * Unary operators (`!`, `-`, `&`) are not in scope either — they
   * belong to a separate component or plain string construction.
   */
  operator: string;
  /** Right-hand operand. */
  right: Children;
}

/**
 * A binary expression whose flat form is `left op right` and whose
 * broken form wraps to mirror rustfmt's `binop_separator = Front`
 * default: arithmetic, comparison, logical, bitwise, and `as` cast
 * operators move to the start of the continuation line. Compound
 * assignment operators (`+=`, `-=`, …) instead stay at the end of
 * their line, with the right-hand operand on the next line — the
 * break-after shape rustfmt applies to assignment-family operators.
 *
 * Rustfmt produces the same break side on every supported edition
 * (2015/2018/2021/2024), so this component is edition-agnostic.
 */
export function BinaryExpression(props: BinaryExpressionProps) {
  if (isAssignmentOperator(props.operator)) {
    // Break-AFTER rendering: `left op\n    right`.
    return (
      <group>
        {props.left} {props.operator}
        <indent>
          <line />
          {props.right}
        </indent>
      </group>
    );
  }

  // Break-BEFORE rendering (the default). Flat form emits a single
  // space in place of each `<line />`; broken form emits a newline
  // plus one level of indent, placing the operator at the start of
  // the continuation line.
  return (
    <group>
      {props.left}
      <indent>
        <line />
        {props.operator} {props.right}
      </indent>
    </group>
  );
}
