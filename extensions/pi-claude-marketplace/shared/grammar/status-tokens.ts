// shared/grammar/status-tokens.ts
//
// CMC-08 closed status-token set. The 15 entries below are byte-equal to the
// `status_tokens:` block in the binding frontmatter at
// `docs/messaging-style-guide.md` (lines 3-18). The drift test at
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
//   - One file per closed set (this file owns status tokens;
//     reasons live in `./reasons.ts`).
//   - Shape: `as const` array + derived literal union. The runtime
//     array is required because the drift test iterates it; the
//     derived literal union types renderer callsites
//     (e.g. `function renderRow(status: StatusToken)`).
//   - `(no marketplaces)` and `(no plugins)` are FLAT members of this
//     single array -- no `BARE_STATUS_TOKENS` sub-union, no branded
//     `BareStatusToken` type. The bare-token render shape (no icon,
//     no scope brackets) is a renderer concern that branches at
//     emission time.
//   - `(reinstalled)` is a member of the closed set because the
//     catalog emits it on reinstall cascade rows
//     (`docs/output-catalog.md:147`). The
//     `tests/architecture/grammar-frontmatter.test.ts` byte-equality
//     assertion keeps this file in sync with the binding frontmatter
//     `status_tokens:` block.

export const STATUS_TOKENS = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "added",
  "removed",
  "available",
  "unavailable",
  "upgradable",
  "skipped",
  "failed",
  "rollback failed",
  "manual recovery",
  "no marketplaces",
  "no plugins",
] as const;

export type StatusToken = (typeof STATUS_TOKENS)[number];
