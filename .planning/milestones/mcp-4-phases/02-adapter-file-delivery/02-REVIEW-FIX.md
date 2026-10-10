---
phase: 02-adapter-file-delivery
fixed_at: 2026-10-04T12:00:00Z
review_path: .planning/phases/02-adapter-file-delivery/02-REVIEW.md
iteration: 2
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report (gap closure)

**Fixed at:** 2026-10-04T12:00:00Z
**Source review:** .planning/phases/02-adapter-file-delivery/02-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 1 (IN-04, promoted to a fix by the operator under D-02-23)
- Fixed: 1
- Skipped: 0

Iteration 1 fixed WR-01 in commit 4a206e4a. It added `restoredOverride` and applied D-02-22: a written-back override takes the live entry's carried fields. Iteration 2 narrows that rule under D-02-23.

## Fixed Issues

### IN-04: A plugin's own carried fields are written into the user's override at unstage and stay there after the plugin is gone

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`, `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts` (comments), `extensions/pi-claude-marketplace/bridges/mcp/marker.ts` (comment), `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts` (comment), `docs/prd/pi-claude-marketplace-prd.md` (MC-5), `docs/output-catalog.md` (mcp-override-kept prose), `tests/bridges/mcp/adapter-entry.test.ts`, `tests/integration/mcp-override-lifecycle.test.ts`
**Commit:** 6cb09db2
**Status:** fixed: requires human verification (a semantic change to the write-back rule, D-02-23)

**Applied fix (D-02-23):**

- `restoredOverride(kept, live)` now returns only the kept override's own fields. It no longer appends the carried fields that only the live entry holds. Each kept field outside the carried set comes back verbatim, in kept key order. Each kept carried field takes the live entry's value in its kept position, or is left out when the live entry lacks it. The D-02-22 behavior stays: a user `/mcp-adapter enable` while the plugin is installed removes `disabled`, so it is left out on write-back.
- The code change is one line: `return { ...restored, ...liveCarried };` became `return restored;`. `survivingEntry` and every caller are unchanged.
- Credentials and other non-carried fields still come only from the kept override. The result can hold only keys the kept override holds, so it stays a partial override (AFILE-05).
- Comments in `adapter-entry.ts`, `adapter-doc.ts` (module header, `survivingEntry`, `withPluginServers`), `marker.ts` and `unstage.ts`, the PRD MC-5 row, and the `mcp-override-kept` catalog prose now state the narrowed rule. They cite AFILE-05/AFILE-06 only. The `withPluginServers` paragraph was rewrapped to 100 columns while editing it, which also clears IN-06's 112-column line.

**Reproduction:** the reviewer's probe `/tmp/afile-probe2/probe2.ts` (stub `{ "disabled": true }`, plugin server `{ command: "node", lifecycle: "eager", debug: true }`, stage then unstage). On HEAD before the fix it wrote back `srv: { disabled: true, lifecycle: "eager", debug: true }`. After the fix it writes back `srv: { disabled: true }`.

**Tests changed:**

- `tests/bridges/mcp/adapter-entry.test.ts`, `describe("restoredOverride")`:
  - Replaced "carried fields only the live entry holds follow the kept fields in set order" with "a carried field the plugin's live entry declares and the kept override lacks is not added". The kept value is `{ disabled: true }` and the live entry holds `lifecycle: "eager"`, `debug: true`, `disabled: true`. The expected result is `{"disabled":true}`.
  - Reworked the AFILE-05 case so it still checks something: the kept override now holds `env` plus every carried key, and the live entry is a full `ServerEntry`. The expected result is the kept `env` followed by each carried key with its live value, in kept order. No non-carried live field appears.
  - The two D-02-22 cases (live `disabled: false` replaces kept `true`; a carried field the live entry lacks is left out) are unchanged and pass.
- `tests/integration/mcp-override-lifecycle.test.ts`: new case "uninstall writes back no carried field the plugin's entry declares and the user's override lacks". It runs the real install and uninstall operations with a plugin server that declares `lifecycle: "eager"` and `debug: true`, and a stub `{ "disabled": true }`. It asserts that those three fields are active after install, and that the bytes after uninstall equal the original stub bytes. `seedMcpPlugin` gained an optional `server` parameter. Its default is the existing `{ command: "node", args: ["v1.js"] }`, so the other three cases are unchanged. The existing D-02-22 integration case ("a /mcp-adapter enable made while the plugin is installed survives plugin disable, enable and uninstall") passes unchanged.

**Negative control:** I temporarily restored HEAD's `adapter-entry.ts` and ran both test files. The two new cases failed (2 fail / 25 pass). With the fix restored, all 27 passed. `git diff` confirmed that the restored file matched the fix.

## Verification

All gates ran in the **main checkout** (`/home/acolomba/src/pi-claude-marketplace-mcp-4`, branch `features/mcp-4`, `workflow.use_worktrees=false` path; no worktree). Node v26.10.0.

- `node --test tests/bridges/mcp/*.test.ts tests/integration/mcp-override-lifecycle.test.ts`: before the test update, only the two `restoredOverride` cases that asserted the appended fields failed. After the update, all passed.
- `npx prettier --check` on the six changed `.ts` files: clean. `npx fallow health`: exit 0.
- `SKIP=trufflehog pre-commit run --files <8 committed files>` (`tmp/d0223-precommit.log`). In the first run, mdformat re-padded the edited MC-5 table row in the PRD, and every other hook passed, `npm changed checks` included. The second run gave **PRECOMMIT_EXIT=0**.
- `npx fallow audit --format json --quiet --explain --gate-marker agent`: verdict **warn** (dead code 0, complexity 0, 14 clone groups, the known pre-existing set). Not `fail`.
- No `!` or `as` was added under `extensions/` (the only added code line is `return restored;`). No type member moved, and `scripts/check-unused-type-members.contracts.json` has no pins in the changed modules.
- focused task verification passed; full phase/PR verification pending

Commit title: 52 characters.

---

_Fixed: 2026-10-04T12:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
