/**
 * Comparators for Rust `use` / `mod` entries that mirror rustfmt's
 * stable ordering, including the edition-sensitive version-sort used
 * for `use` brace lists and top-level `use` paths starting with the
 * 2024 style edition.
 *
 * Rustfmt's sort — for both `use a::{x, y, z};` inner lists and the
 * top-level `use a;` / `use b;` / `use c;` bucket — pins three special
 * tokens in fixed positions:
 *
 *   - `self`  → first
 *   - `super` → second
 *   - `*`     → last (glob)
 *
 * Everything else falls in the middle and is compared by a body
 * comparator that depends on the active Rust edition:
 *
 *   - pre-2024 (2015, 2018, 2021): ASCII-lexicographic (byte-wise).
 *   - 2024+: version-sort — split each string into alternating
 *     digit-runs and non-digit-runs, compare segment-by-segment,
 *     digit-runs numerically and non-digit-runs ASCII-lexicographically.
 *
 * `mod x;` declarations, by contrast, are ASCII-lex on every edition
 * (probed against rustfmt 1.8.0), so they get their own fixed
 * comparator with no edition argument.
 */

/**
 * Rustfmt-aligned comparator for `use` entries: pins `self` first,
 * `super` second, glob `*` last, everything else in the middle ordered
 * by ASCII-lex (pre-2024 style editions) or version-sort
 * (edition 2024+).
 *
 * `edition` is the ambient crate edition as a numeric string
 * (`"2015"` | `"2018"` | `"2021"` | `"2024"`). Any non-`"2024"` value
 * — including `undefined` — resolves to pre-2024 behaviour. Future
 * style editions that share the 2024 version-sort convention must be
 * added to {@link VERSION_SORT_EDITIONS}.
 *
 * Applied both to symbol names inside a `use path::{…}` brace list
 * and to full paths in a top-level blank-line-delimited group.
 */
export function compareImportEntry(
  edition: string | undefined,
): (a: string, b: string) => number {
  const body = useVersionSort(edition) ? versionSort : asciiLexCompare;
  return (a, b) => {
    const rankA = pinRank(a);
    const rankB = pinRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return body(a, b);
  };
}

/**
 * Rustfmt-aligned comparator for `mod x;` declarations.
 *
 * ASCII-lexicographic on every supported edition (probed against
 * rustfmt 1.8.0 — no edition sensitivity observed for module sort).
 */
export function compareModuleEntry(a: string, b: string): number {
  return asciiLexCompare(a, b);
}

// Editions (as numeric strings) whose `use` sort uses the
// version-sort body comparator. Add future editions here as they
// stabilise; anything not in the set falls back to ASCII-lex.
const VERSION_SORT_EDITIONS = new Set<string>(["2024"]);

function useVersionSort(edition: string | undefined): boolean {
  return edition !== undefined && VERSION_SORT_EDITIONS.has(edition);
}

function pinRank(entry: string): number {
  if (entry === "self") return 0;
  if (entry === "super") return 1;
  if (entry === "*") return 3;
  return 2;
}

/**
 * Byte-wise lexicographic compare of two strings, matching rustfmt's
 * ASCII-derived ordering. Uses JS's default string comparison (UTF-16
 * code-unit order), which coincides with byte order for the ASCII
 * subset rustfmt actually sees in identifiers and paths.
 *
 * Explicitly NOT `localeCompare` — that is Unicode-aware and reorders
 * e.g. case differently from rustfmt.
 */
function asciiLexCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Version-sort: split each string into alternating digit-runs and
 * non-digit-runs, compare segment-by-segment. Digit-runs compare
 * numerically (`foo2` < `foo10`), non-digit-runs ASCII-lex. If one
 * string is a prefix of the other, the shorter wins.
 */
function versionSort(a: string, b: string): number {
  const segA = tokenize(a);
  const segB = tokenize(b);
  const len = Math.min(segA.length, segB.length);
  for (let i = 0; i < len; i++) {
    const sa = segA[i];
    const sb = segB[i];
    const aIsDigits = isDigits(sa);
    const bIsDigits = isDigits(sb);
    if (aIsDigits && bIsDigits) {
      const cmp = compareDigitRuns(sa, sb);
      if (cmp !== 0) return cmp;
    } else if (!aIsDigits && !bIsDigits) {
      const cmp = asciiLexCompare(sa, sb);
      if (cmp !== 0) return cmp;
    } else {
      // Digit run vs non-digit run at the same position: fall back to
      // ASCII-lex of the raw segments. Digits (`0`..`9`, 0x30–0x39)
      // sort before uppercase letters (0x41+) but after most symbols,
      // and byte-wise compare is what rustfmt does in this case.
      const cmp = asciiLexCompare(sa, sb);
      if (cmp !== 0) return cmp;
    }
  }
  return segA.length - segB.length;
}

function tokenize(s: string): string[] {
  const out: string[] = [];
  if (s.length === 0) return out;
  let start = 0;
  let inDigits = isDigitChar(s.charCodeAt(0));
  for (let i = 1; i < s.length; i++) {
    const digitHere = isDigitChar(s.charCodeAt(i));
    if (digitHere !== inDigits) {
      out.push(s.slice(start, i));
      start = i;
      inDigits = digitHere;
    }
  }
  out.push(s.slice(start));
  return out;
}

function isDigitChar(code: number): boolean {
  return code >= 0x30 && code <= 0x39;
}

function isDigits(segment: string): boolean {
  if (segment.length === 0) return false;
  for (let i = 0; i < segment.length; i++) {
    if (!isDigitChar(segment.charCodeAt(i))) return false;
  }
  return true;
}

/**
 * Numeric compare of two digit-only segments without overflowing on
 * arbitrarily long runs: strip leading zeros, then compare by length
 * (longer = larger), then byte-wise for same-length runs. When the
 * numeric values tie, the run with MORE leading zeros (longer raw
 * string) sorts first — matches rustfmt's empirical behaviour on
 * `foo01` vs `foo1`.
 */
function compareDigitRuns(a: string, b: string): number {
  const stripA = stripLeadingZeros(a);
  const stripB = stripLeadingZeros(b);
  if (stripA.length !== stripB.length) return stripA.length - stripB.length;
  const cmp = asciiLexCompare(stripA, stripB);
  if (cmp !== 0) return cmp;
  return b.length - a.length;
}

function stripLeadingZeros(s: string): string {
  let i = 0;
  while (i < s.length - 1 && s.charCodeAt(i) === 0x30) i++;
  return s.slice(i);
}
