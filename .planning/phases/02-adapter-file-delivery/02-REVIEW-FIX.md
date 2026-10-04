---
phase: 02-adapter-file-delivery
fixed_at: 2026-10-04T10:04:51Z
review_path: .planning/phases/02-adapter-file-delivery/02-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report (gap closure)

**Fixed at:** 2026-10-04T10:04:51Z
**Source review:** .planning/phases/02-adapter-file-delivery/02-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 1 (WR-01; IN-01..IN-03 are out of scope)
- Fixed: 1
- Skipped: 0

## Fixed Issues

### WR-01: A kept override overrides the user's later choice: uninstall and plugin disable/enable bring back a stale `disabled: true`

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`, `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts`, `extensions/pi-claude-marketplace/bridges/mcp/marker.ts` (comment), `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts` (comment), `docs/prd/pi-claude-marketplace-prd.md` (MC-5), `docs/output-catalog.md` (mcp-override-kept prose), `tests/bridges/mcp/adapter-entry.test.ts`, `tests/bridges/mcp/adapter-doc.test.ts`, `tests/bridges/mcp/unstage.test.ts`, `tests/integration/mcp-override-lifecycle.test.ts`
**Commit:** 4a206e4a
**Status:** fixed: requires human verification (a semantic change to the write-back rule, D-02-22)

**Applied fix (D-02-22, review option a):**

- New export `restoredOverride(kept, live)` in `adapter-entry.ts`. It reuses the one carried-field list (`CARRIED_FIELDS` / `CARRIED_FIELD_SET`, through the existing private `carriedFields`). Each kept field outside the carried set comes back verbatim, in kept key order, through `safeSet`. Each kept carried field takes the live entry's value in its kept position. A carried field that only the live entry holds is appended in carried-set order.
- `survivingEntry` in `adapter-doc.ts` now returns `restoredOverride(kept, entry)` for an owned, non-restaged entry whose `restorableOverride` is defined. The single write-back table still decides every unstage: uninstall, plugin disable, prune, marketplace remove, reconcile and cascade undo, plus a stage that drops the server. `restoredOverrideNames` and the restage carry path are unchanged.
- Credentials and other non-carried fields come only from the kept override and never from the live entry. The overlay changes only carried fields, so the result is still an override (AFILE-05). `restorableOverride` already rejects a kept full definition before the overlay runs.

**Absent carried field: left out of the written-back override.** This matches the stage path: `carriedFields(previous)` copies only the carried fields the replaced entry holds as own properties, so a restage leaves out a field the live entry lacks. It is also required for the real adapter flow. pi-mcp-adapter 5.0.0's `writeProjectServerDisabledOverride(..., false)` (`dist/config.js:1555-1576`, checked in `/tmp/pmaverify/package`) removes `disabled` from the entry. It writes `disabled: false` only when a lower config source disables the server. If an absent field kept its kept value instead, the usual `/mcp-adapter enable` would still bring back `disabled: true`, and WR-01 would not be fixed. One consequence: a kept override of only `{ "disabled": true }` comes back as `{}` after the user enables the server. The fix writes `{}` and does not delete the entry. `{}` is a valid inert override, and an original `{}` stub already round-trips the same way. The adapter's own writer deletes an emptied entry, so deleting it here would also be defensible. That is a possible follow-up, not part of this fix.

**Residual consequence (flagged for the operator):** the live entry's carried fields are not always user choices. A plugin's own entry can set a carried field, for example `lifecycle` today, or the `requestTimeoutMs` that ANAME-07 will translate in Phase 3. D-02-22 overlays all of the live entry's carried fields, so such a plugin-set value is written back into the user's override on unstage. This is the same user-versus-plugin ambiguity as the Phase 3 hand-off note in 02-CONTEXT.md "Deferred Ideas". It is the documented decision, so the fix follows it.

**Reproduction (before the fix, against the real modules):**

- `node tmp/review-gap/repro1.ts`: after uninstall, `srv` was `{"disabled": true, "env": {...}}`. After the fix it is `{"disabled": false, "env": {...}}`.
- `node tmp/review-gap/repro2.ts`: "active disabled after plugin disable+enable: true". After the fix it prints `false`.

**Tests added or changed:**

- `tests/bridges/mcp/adapter-entry.test.ts`, new `describe("restoredOverride")`, 4 cases. They cover: a live `disabled: false` that replaces a kept `true` in its kept position, an absent carried field that is left out, carried fields that only the live entry holds and are appended in set order, and no non-carried field of a full live `ServerEntry` that reaches the override. Each case compares the whole value through `JSON.stringify`, so key order is part of the assertion.
- `tests/bridges/mcp/adapter-doc.test.ts`, new `withPluginServers` case: "a written-back override takes each carried field from the live entry and keeps every other field". It covers both the `disabled: false` path and the absent `disabled` path.
- `tests/integration/mcp-override-lifecycle.test.ts`, new case: "a /mcp-adapter enable made while the plugin is installed survives plugin disable, enable and uninstall". The case runs the real install. It then removes `disabled` the way the adapter 5.0.0 writer does. Then it runs the real `createEnableOperation` disable and enable, and the real uninstall. It asserts the exact bytes after disable and after uninstall, and the whole re-enabled entry with no `disabled`.
- Fixture update in 5 existing cases (3 in adapter-doc, 2 in unstage; one unstage fixture string occurs in both). Their synthetic live entries kept `{disabled|debug|lifecycle}` in the marker but did not hold the field as an active field. A real absorb always makes it active, so these fixtures now carry it. The asserted outputs are unchanged.

**Negative control:** I temporarily changed `survivingEntry` back to returning the kept override verbatim. The new adapter-doc case and the new integration case failed (2 fail / 90 pass across adapter-doc, unstage and the integration file). With the fix restored, they passed. The `restoredOverride` unit cases cannot run without the export.

## Verification

All gates ran in the **main checkout** (`/home/acolomba/src/pi-claude-marketplace-mcp-4`, branch `features/mcp-4`, `workflow.use_worktrees=false` path; no worktree). Node v26.10.0.

- `npm run typecheck`: exit 0. ESLint over the 8 changed `.ts` files: exit 0.
- Owner and related suites (`tests/bridges/mcp/*`, integration lifecycle, enable-disable, uninstall, prune, prune-rollback, install-flow, marketplace shared): green after the fixture update.
- `npm run test:coverage:direct`: adapter-entry.ts 31/31 branches, 8/8 functions, 184/184 lines. adapter-doc.ts 90/90, 20/20, 386/386.
- `npx fallow health`: exit 0.
- `SKIP=trufflehog pre-commit run --files <10 committed files>` (`tmp/gapfix-precommit.log`): **PRECOMMIT_EXIT=0** on the first complete run. `npm changed checks` passed, and the hooks rewrote no file. An earlier attempt was stopped by the agent's 10-minute background limit while `npm changed checks` was still running. It was not a hook failure.
- `npx fallow audit --format json --quiet --explain --gate-marker agent`: verdict **warn** (dead code 0, complexity 0, 14 clone groups, the known pre-existing set). Not `fail`.
- No `!` or `as` was added under `extensions/`. No type member moved, and `scripts/check-unused-type-members.contracts.json` has no pins in the changed modules.
- focused task verification passed; full phase/PR verification pending

**Commit-title note:** the committed title is 74 characters, above the 72-character limit in AGENTS.md. No commit-msg hook is installed, so gitlint did not run. History is never rewritten, so the commit stays as it is. The squash-merge title at PR time replaces it.

---

_Fixed: 2026-10-04T10:04:51Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
