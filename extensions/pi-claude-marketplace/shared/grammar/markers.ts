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
//   - D-CMC-01 (Phase 12 precedent): location is
//     `extensions/pi-claude-marketplace/shared/grammar/`, sibling of
//     `status-tokens.ts` and `reasons.ts`. Per D-11 `shared/grammar/` sits
//     BELOW `presentation/` and `persistence/`, so it is importable from
//     anywhere without violating layer rules.
//   - D-CMC-02 (Phase 12 precedent): one file per closed set (this file
//     owns markers; status tokens live in `./status-tokens.ts`, reasons in
//     `./reasons.ts`, pattern classes in `./pattern-classes.ts`).
//   - D-CMC-03 (Phase 12 precedent): the shape is an `as const` array +
//     derived literal union. The runtime array is required because Phase
//     14's drift test iterates it; the derived literal union types
//     callsites that consume the marker (e.g. `MarketplaceRow.marker:
//     Marker`).
//   - D-CMC-08 (Phase 12 precedent): one-closed-set-per-file under
//     `shared/grammar/` -- Claude's Discretion #3 in CONTEXT.md selects
//     this layout (new file rather than appending to an existing one).
//   - D-14-10b (DERIVED -- Plan 14-03 Task 3): the 4-key frontmatter set
//     (status_tokens, reasons, markers, pattern_classes) requires
//     literal-union types for every entry. `MARKERS` is the marker
//     closed set; the test in `tests/architecture/grammar-frontmatter.test.ts`
//     (extended in Plan 14-03 Task 4) asserts set-equality against the
//     frontmatter on every CI run.
//
// Brace / chevron convention: entries are stored WITHOUT surrounding
// `<>` chevrons. The `<marker>` chevron form is composed by the renderer
// at emission time (per MSG-GR-5). Storing bare strings keeps this
// module a pure data surface and keeps the drift test's set-equality
// assertion against the frontmatter (which also lists bare strings)
// symmetric.

export const MARKERS = ["autoupdate", "no autoupdate"] as const;

export type Marker = (typeof MARKERS)[number];
