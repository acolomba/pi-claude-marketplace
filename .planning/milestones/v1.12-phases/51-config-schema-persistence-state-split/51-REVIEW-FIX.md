---
phase: 51-config-schema-persistence-state-split
fixed_at: 2026-06-10T11:30:00Z
review_path: .planning/phases/51-config-schema-persistence-state-split/51-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 51: Code Review Fix Report

**Fixed at:** 2026-06-10T11:30:00Z
**Source review:** .planning/phases/51-config-schema-persistence-state-split/51-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (fix_scope: critical_warning -- WR-01..WR-05; IN-01..IN-06 out of scope)
- Fixed: 5
- Skipped: 0

Verification: `npm run check` GREEN end-to-end after all fixes (typecheck +
eslint + prettier + 1559 unit tests + 7 integration tests, 0 failures).
`pre-commit run --files <changed>` clean before every commit
(`SKIP=trufflehog` per worktree policy; trufflehog cannot read the worktree
`.git` file).

## Fixed Issues

### WR-01: Path-source update failure renders the lying `{network unreachable}` reason

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
**Commit:** 9acd744
**Applied fix:** Mirrored the one-level `cause` unwrap (already present for
`InvalidMarketplaceManifestError`) for errno-bearing FS errors in
`reasonsFromCascadeError`. The wrapper `MarketplaceUpdateError` carries no
errno, so ENOENT/ENOTDIR/EACCES/EPERM from a network-free path-source
refresh now map to the closed-set `source missing` / `permission denied`
reasons instead of falling through to `network unreachable` (NFR-5,
ATTR-10/D-48-B). The review's nested-ternary suggestion was adapted to an
if/else chain to satisfy `sonarjs/no-nested-conditional` and
`@typescript-eslint/no-unnecessary-type-assertion`.

### WR-02: D-13 gate on bare file existence makes the autoupdate flag silently evaporate

**Files modified:** `.planning/phases/51-config-schema-persistence-state-split/51-02-SUMMARY.md`
**Commit:** 72027a5
**Applied fix:** Applied the review's alternative fix (option b). Option (a)
-- gating the scrub on a positive Phase-52 capture marker -- would break the
locked D-13 ordering-rail tests (the GATE OPEN test materializes an empty
`{}` config, which carries no capture marker), and the SPLIT-01 cast sites
are an approved interim state rewired in Phases 54-56. Instead, the
hand-authoring hazard (user-created `claude-plugins.json` makes
`marketplace autoupdate on` silently non-durable until the rewire lands) is
now documented in the 51-02-SUMMARY Threat Flags section together with an
explicit Phase 54-56 verification item (MUST): no production site may still
read/write `record.autoupdate` on state when the config write-path lands.

### WR-03: `migrateLegacyMarketplaceRecords` violates its documented purity contract

**Files modified:** `extensions/pi-claude-marketplace/persistence/migrate.ts`, `extensions/pi-claude-marketplace/persistence/state-io.ts`, `tests/persistence/migrate.test.ts`
**Commit:** 2113864
**Applied fix:** Hoisted the `existsSync(configJsonPath)` gate probe out of
the migrator into `loadState` (the load seam where the path is derived) and
changed the migrator's third parameter to `scrubAutoupdate: boolean`. The
"Pure function -- does NOT touch disk" docstring is now accurate, the
`existsSync` import is gone from migrate.ts, and the gate decision is
visible at the load seam. The probe is taken once before the fully
synchronous migrate call, so the gate still cannot race the in-memory
transform. Migrate unit tests now pass `GATE_CLOSED`/`GATE_OPEN` booleans
directly -- which also removes the fixed-name tmpdir sentinels flagged by
IN-01 as a side effect. Only production caller is `loadState`; the
`persistence/index.ts` re-export is unchanged.

### WR-04: `loadState`'s configJsonPath derivation is untested

**Files modified:** `tests/persistence/state-io.test.ts`
**Commit:** 60b1551
**Applied fix:** Added two tests: (1) a loadState-level gate-OPEN test that
materializes `<scopeRoot>/claude-plugins.json` as a sibling of the tmp
`extensionRoot`, loads the `state-with-autoupdate.json` fixture through
`loadState`, and asserts the flag is scrubbed from the in-memory record AND
from the persisted state.json (polling for the fire-and-forget ST-4
persist); (2) a drift guard pinning
`path.join(path.dirname(loc.extensionRoot), "claude-plugins.json") ===
loc.configJsonPath` against `locationsFor`, so a wrong join in either
construction can no longer keep every test green while the D-13 scrub never
fires in production.

### WR-05: Hermetic-HOME test harnesses do not neutralize `PI_CODING_AGENT_DIR`

**Files modified:** `tests/orchestrators/marketplace/autoupdate.test.ts`, `tests/orchestrators/marketplace/info.test.ts`, `tests/orchestrators/marketplace/list.test.ts`, `tests/orchestrators/plugin/bootstrap.test.ts`, `tests/edge/handlers/plugin/bootstrap.test.ts`
**Commit:** 82ceab4
**Applied fix:** Each of the five `withHermeticHome` helpers now saves and
deletes `PI_CODING_AGENT_DIR` before the callback (so `getAgentDir()` falls
back to the hermetic HOME) and restores it in the `finally` block. Verified
by running all five files with `PI_CODING_AGENT_DIR` pointed at a sentinel
path: 47/47 tests pass and the sentinel dir is never created. The review's
optional suggestion to extract a shared helper into `tests/helpers/` was
not taken (no new files; minimal scoped change) -- flagging it as a
candidate refactor for a later phase.

## Skipped Issues

None.

---

_Fixed: 2026-06-10T11:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
