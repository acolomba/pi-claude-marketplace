// shared/grammar/markers.ts
//
// CMC-38 closed marker set. The 2 entries below are byte-equal to the
// `markers:` block in the binding frontmatter at
// `docs/messaging-style-guide.md` (lines 48-50). The drift test at
// `tests/architecture/grammar-frontmatter.test.ts` asserts set-equality on
// every CI run, so the frontmatter is the binding contract -- this file is
// downstream of it and must follow.
//
// Locking decisions:
//   - Location is `extensions/pi-claude-marketplace/shared/grammar/`,
//     sibling of `status-tokens.ts` and `reasons.ts`. Per D-11
//     `shared/grammar/` sits BELOW `presentation/` and `persistence/`,
//     so it is importable from anywhere without violating layer rules.
//   - One file per closed set (this file owns markers; status tokens
//     live in `./status-tokens.ts`, reasons in `./reasons.ts`, pattern
//     classes in `./pattern-classes.ts`).
//   - Shape: `as const` array + derived literal union. The runtime
//     array is required by the drift test that iterates it; the
//     derived literal union types callsites that consume the marker
//     (e.g. `MarketplaceRow.marker: Marker`).
//   - The 4-key frontmatter set (status_tokens, reasons, markers,
//     pattern_classes) requires literal-union types for every entry.
//     `MARKERS` is the marker closed set; the test in
//     `tests/architecture/grammar-frontmatter.test.ts` asserts
//     set-equality against the frontmatter on every CI run.
//
// Brace / chevron convention: entries are stored WITHOUT surrounding
// `<>` chevrons. The `<marker>` chevron form is composed by the renderer
// at emission time (per MSG-GR-5). Storing bare strings keeps this
// module a pure data surface and keeps the drift test's set-equality
// assertion against the frontmatter (which also lists bare strings)
// symmetric.

export const MARKERS = ["autoupdate", "no autoupdate"] as const;

export type Marker = (typeof MARKERS)[number];
