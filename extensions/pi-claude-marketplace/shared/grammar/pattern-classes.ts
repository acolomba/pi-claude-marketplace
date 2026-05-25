// shared/grammar/pattern-classes.ts
//
// CMC-38 closed pattern-class set. The 12 entries below are byte-equal to
// the `pattern_classes:` block in the binding frontmatter at
// `docs/messaging-style-guide.md` (lines 51-63). The drift test at
// `tests/architecture/grammar-frontmatter.test.ts` asserts set-equality on
// every CI run, so the frontmatter is the binding contract -- this file is
// downstream of it and must follow.
//
// Locking decisions:
//   - Location is `extensions/pi-claude-marketplace/shared/grammar/`,
//     sibling of `status-tokens.ts` and `reasons.ts`. Per D-11
//     `shared/grammar/` sits BELOW `presentation/` and `persistence/`,
//     so it is importable from anywhere without violating layer rules.
//   - One file per closed set (this file owns pattern classes; status
//     tokens live in `./status-tokens.ts`, reasons in `./reasons.ts`,
//     markers in `./markers.ts`).
//   - Shape: `as const` array + derived literal union. The runtime
//     array is required because the drift test iterates it; the
//     derived literal union is available to any future consumer that
//     needs to discriminate on a pattern-class identifier.
//   - `PATTERN_CLASSES` is one of the 4 closed-set frontmatter keys
//     (status_tokens, reasons, markers, pattern_classes) byte-equal to
//     the binding frontmatter; the test in
//     `tests/architecture/grammar-frontmatter.test.ts` asserts
//     set-equality against the frontmatter on every CI run.
//
// Semantic note: pattern classes label the SHAPES of compact-line
// emissions (success / failure / cascade-row / etc.) for documentation
// and rule-attribution purposes. They are NOT emitted in the rendered
// output -- the renderer dispatches on the `RowSpec` discriminated
// union's `kind` and `outcomeClass` fields. The set exists so MSG-* rule
// docstrings, the style-guide body, and the catalog can all reference
// the same canonical labels.

export const PATTERN_CLASSES = [
  "success",
  "failure",
  "cascade-row",
  "cascade-summary",
  "list-rendering",
  "reload-hint",
  "soft-dep",
  "manual-recovery",
  "rollback-partial",
  "usage",
  "empty",
  "legacy-migrate",
] as const;

export type PatternClass = (typeof PATTERN_CLASSES)[number];
