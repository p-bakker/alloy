/**
 * Ensures a loop label has the required `'` tick prefix.
 * Accepts both `"retry"` and `"'retry"` and always returns `"'retry"`.
 */
export function ensureLabelTick(label: string): string {
  return label.startsWith("'") ? label : `'${label}`;
}
