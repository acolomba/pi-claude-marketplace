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
//   - Location is `extensions/pi-claude-marketplace/shared/grammar/`,
//     a sibling to `shared/markers.ts` and `shared/notify.ts`. Per
//     D-11 `shared/grammar/` sits BELOW `presentation/` and
//     `persistence/`, so it is importable from anywhere without
//     violating layer rules.
//   - One file per closed set (this file owns reasons; status
//     tokens live in `./status-tokens.ts`).
//   - Shape: `as const` array + derived literal union. The runtime
//     array is required because the drift test iterates it; the
//     derived literal union types renderer callsites (e.g.
//     `function renderRow(..., reason: Reason)`).
//
// The current closed set was extended from the original 23 entries to
// cover the autoupdate-enable/disable idempotent-flip rows
// (`"already enabled"` / `"already disabled"`) and the failure-class
// closed Reasons that the catalog UAT requires across uninstall /
// marketplace-remove partial / reinstall / update / marketplace-update
// rows (`"permission denied"` / `"source missing"` /
// `"network unreachable"`). Without these the renderer cannot emit the
// catalog's compact-line shape because the `Reason` literal union
// rejects any string outside the closed set. The
// `tests/architecture/grammar-frontmatter.test.ts` drift gate keeps
// this file byte-equal to the frontmatter `reasons:` block.
//
// Brace convention: entries are stored WITHOUT surrounding `{}` braces.
// The `{<reason>}` brace form is composed by the renderer at emission
// time. Storing bare strings keeps this module a pure data surface and
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
