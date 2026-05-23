// shared/grammar/reasons.ts
//
// CMC-11 closed reasons set. The 23 entries below are byte-equal to the
// `reasons:` block in the binding frontmatter at
// `docs/messaging-style-guide.md` (lines 18-41). The drift test at
// `tests/architecture/grammar-frontmatter.test.ts` asserts set-equality on
// every CI run, so the frontmatter is the binding contract -- this file is
// downstream of it and must follow.
//
// Locking decisions:
//   - D-CMC-01: location is `extensions/pi-claude-marketplace/shared/grammar/`,
//     a new sibling to `shared/markers.ts` and `shared/notify.ts`. Per D-11
//     `shared/grammar/` sits BELOW `presentation/` and `persistence/`, so it
//     is importable from anywhere without violating layer rules.
//   - D-CMC-02: one file per closed set (this file owns reasons; status
//     tokens live in `./status-tokens.ts`).
//   - D-CMC-03: the shape is an `as const` array + derived literal union.
//     The runtime array is required because Phase 14's drift test iterates
//     it; the derived literal union types Phase 13 callsites
//     (e.g. `function renderRow(..., reason: Reason)`).
//
// Count reconciliation: Phase 12 originally locked the closed set at 23
// entries (the frontmatter at messaging-style-guide.md is the binding
// source). Phase 13 sub-wave 2c (Plan 13-02c-01) added `"already enabled"`
// and `"already disabled"` per the CMC-33 / catalog binding at
// docs/output-catalog.md -- the `marketplace autoupdate enable|disable`
// idempotent-flip result row uses these reasons as the `{<reason>}`
// block. Phase 13 Wave 3 plan 13-03-01 (catalog UAT) added
// `"permission denied"`, `"source missing"`, and `"network unreachable"`
// per the same precedent: the catalog at the uninstall failure,
// marketplace-remove partial child, reinstall failure, and update /
// marketplace-update network-failure rows uses these reasons as the
// `{<reason>}` block, and the catalog UAT runner asserts byte equality
// against the rendered output. Without them the renderer cannot emit
// the catalog's compact-line shape (the `Reason` literal union rejects
// any string outside the closed set). The style-guide frontmatter and
// §4 reasons table are updated in the same commit to keep the
// grammar-frontmatter drift test green.
//
// Brace convention: entries are stored WITHOUT surrounding `{}` braces. The
// `{<reason>}` brace form is composed by the renderer at emission time
// (Phase 13). Storing bare strings keeps this module a pure data surface and
// keeps the drift test's set-equality assertion against the frontmatter
// (which also lists bare strings) symmetric.

export const REASONS = [
  "up-to-date",
  "not found",
  "already installed",
  "not installed",
  "not in manifest",
  "invalid manifest",
  "no longer installable",
  "unsupported source",
  "hooks",
  "lspServers",
  "requires pi-subagents",
  "requires pi-mcp",
  "rollback partial",
  "unreadable",
  "unparseable",
  "unreadable manifest",
  "source mismatch",
  "plugins remain",
  "concurrently uninstalled",
  "concurrently updated",
  "stale clone",
  "duplicate name",
  "lock held",
  "already enabled",
  "already disabled",
  "permission denied",
  "source missing",
  "network unreachable",
] as const;

export type Reason = (typeof REASONS)[number];
