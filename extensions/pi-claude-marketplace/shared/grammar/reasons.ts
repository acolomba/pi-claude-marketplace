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
// Count reconciliation: the binding frontmatter has 23 entries. Earlier
// drafts of REQUIREMENTS.md CMC-11, ROADMAP.md Phase 12 scope, and 12-CONTEXT
// stated "24 reasons"; Plan 12-01 Task 3 reconciles those docs to 23 in the
// same commit chain as this constants module. Phase 12 research §2.1
// confirmed the frontmatter is the binding count.
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
] as const;

export type Reason = (typeof REASONS)[number];
