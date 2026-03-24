/**
 * Utilities for Rust lifetime elision.
 *
 * Implements the three lifetime elision rules from the Rust reference:
 *
 * 1. Each elided lifetime in input position becomes a distinct lifetime parameter.
 * 2. If there is exactly one input lifetime position (elided or not), that
 *    lifetime is assigned to all elided output lifetime positions.
 * 3. If there are multiple input lifetime positions, but one of them is `&self`
 *    or `&mut self`, the lifetime of `self` is assigned to all elided output
 *    lifetime positions.
 */

export interface LifetimeElisionInput {
  /** Number of input parameters that are references (excluding self). */
  referenceParamCount: number;
  /** Whether the function has a `&self` or `&mut self` receiver. */
  hasSelfRef: boolean;
  /** Whether the return type contains a reference. */
  hasReferenceReturn: boolean;
}

/**
 * Determines whether Rust's lifetime elision rules allow all lifetimes to be
 * omitted from the function signature.
 *
 * Returns `true` when the compiler can infer all lifetimes, meaning explicit
 * annotations are unnecessary.
 */
export function canElideLifetimes(input: LifetimeElisionInput): boolean {
  const { referenceParamCount, hasSelfRef, hasReferenceReturn } = input;

  // No reference return — nothing to elide on the output side.
  // Input lifetimes are always individually elided by rule 1.
  if (!hasReferenceReturn) {
    return true;
  }

  // Rule 3: &self / &mut self present — output lifetime binds to self's lifetime.
  if (hasSelfRef) {
    return true;
  }

  // Rule 2: Exactly one input reference — its lifetime is used for output.
  if (referenceParamCount === 1) {
    return true;
  }

  // Multiple input references with no &self and a reference return:
  // the compiler cannot determine which input lifetime to use for the output.
  return false;
}

/**
 * Given function signature information, returns the lifetimes array that should
 * actually be rendered. When elision is possible, returns `undefined` so no
 * lifetime annotations are emitted. When elision is not possible, returns the
 * provided explicit lifetimes unchanged.
 *
 * @param lifetimes - The explicit lifetime annotations on the function.
 * @param input - Information about reference parameters and returns.
 * @returns The lifetimes to render, or `undefined` if they can be elided.
 */
export function elideLifetimeAnnotations(
  lifetimes: string[] | undefined,
  input: LifetimeElisionInput,
): string[] | undefined {
  // No explicit lifetimes provided — nothing to strip.
  if (!lifetimes || lifetimes.length === 0) {
    return undefined;
  }

  // If elision rules apply, suppress all lifetime annotations.
  if (canElideLifetimes(input)) {
    return undefined;
  }

  // Elision not possible — keep explicit lifetimes.
  return lifetimes;
}
