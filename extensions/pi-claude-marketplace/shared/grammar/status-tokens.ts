// shared/grammar/status-tokens.ts
//
// CMC-08 closed status-token set. The 14 entries below are byte-equal to the
// `status_tokens:` block in the binding frontmatter at
// `docs/messaging-style-guide.md` (lines 3-17). The drift test at
// `tests/architecture/grammar-frontmatter.test.ts` asserts set-equality on
// every CI run, so the frontmatter is the binding contract -- this file is
// downstream of it and must follow.
//
// Locking decisions:
//   - D-CMC-01: location is `extensions/pi-claude-marketplace/shared/grammar/`,
//     a new sibling to `shared/markers.ts` and `shared/notify.ts`. Per D-11
//     `shared/grammar/` sits BELOW `presentation/` and `persistence/`, so it
//     is importable from anywhere without violating layer rules.
//   - D-CMC-02: one file per closed set (this file owns status tokens;
//     reasons live in `./reasons.ts`).
//   - D-CMC-03: the shape is an `as const` array + derived literal union.
//     The runtime array is required because Phase 14's drift test iterates
//     it; the derived literal union types Phase 13 callsites
//     (e.g. `function renderRow(status: StatusToken)`).
//   - D-CMC-05: `(no marketplaces)` and `(no plugins)` are FLAT members of
//     this single array -- no `BARE_STATUS_TOKENS` sub-union, no branded
//     `BareStatusToken` type. The bare-token render shape (no icon, no
//     scope brackets) is a Phase 13 renderer concern that branches at
//     emission time.
//   - D-CMC-08: this file is INTENTIONALLY a sibling of `shared/markers.ts`,
//     not a replacement. `markers.ts` still owns the legacy ES-5 prefixes
//     (including `RELOAD_HINT_PREFIX`) until Phase 13's atomic three-file
//     edit; Phase 12 does not touch markers.ts.
//
// CMC-08 reconciliation note: there is NO 15th user-visible token for the
// reinstall cascade. Phase 12 research (§3.1) confirmed that the cascade-kind
// discriminant at `orchestrators/types.ts:12` (`ReinstallPluginPartition`) is
// an internal partition kind never rendered as a parenthesised status token.
// The 14-token closed set below is the complete status surface.

export const STATUS_TOKENS = [
  "installed",
  "updated",
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
