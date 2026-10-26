---
phase: 21-marketplace-add-no-op-and-token-parity
verified: 2026-10-23
status: passed
score: 4/4 success criteria
requirements: [MPA-01, MPA-02, MPA-03]
---

# Phase 21 Verification

## Success criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `marketplace add` and `bootstrap` of a marketplace already added with the same source report `(skipped) {already added}` at info and change nothing (MPA-01) | PASSED | `redeclareRecordedSource` returns `alreadyAdded` before any clone or write (`orchestrators/marketplace/add.ts`); `features/marketplace/add.feature` "Adding again a marketplace from the source it was added from changes nothing" (dir/file/url/github; git host receives no request; config unchanged) and the `--local` variant; `features/plugin/bootstrap.feature` re-run scenario (two info rows: `already added`, `already autoupdate`; no git request); unit tests assert byte-identical state and config. A different source still fails `duplicate name` (add.feature outline, `add.test.ts` D-03 case, `bootstrap.test.ts` fork case). |
| 2 | A malformed, missing, or unreadable manifest reads the same token on `marketplace add`/`update` as on `list`/`info` and the stale-declarer row (MPA-02) | PASSED | `classifyAddError` and `reasonsFromCascadeError` use `narrowProbeError`; a refused manifest read is `ManifestReadDeniedError` -> `permission denied`. `features/marketplace/update.feature` invalid-refresh outline: update row and stale-declarer rows share `<reason>` (`unparseable` / `invalid manifest`); `add.feature` malformed/schema outline and new permission-denied outline; `failed-add.feature` url malformed -> `unparseable`. Missing manifest already read `source missing` on both paths. |
| 3 | `marketplace help --bogus` reports `Unknown flag: "--bogus".` (MPA-03) | PASSED | `edge/router.ts` `marketplace help` arm; `features/marketplace/help.feature` outline (`--bogus`, `extra --bogus`, `extra`); `test/edge/router.test.ts`, `test/edge/register.test.ts`. |
| 4 | `npm run check` stays green | PASSED | Full `npm run check` exit 0 on the committed tree (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features, unpaired, integration, 718 cucumber scenarios, direct coverage all pairs); pre-commit `check:commit` passed on commit d90d8469. |

## Code review

21-REVIEW.md: 1 blocker, 6 warnings, 2 info. 21-REVIEW-FIX.md: 7 fixed, 2
skipped (WR-06 extra tests, IN-02 notes), both listed below.

## For the user

- Bootstrap behavior change: a marketplace from a different source that declares the name `claude-plugins-official` now makes `bootstrap` fail `(failed) {duplicate name}` and skip the autoupdate step; before, bootstrap silently turned on autoupdate for that other source (21-CONTEXT D-05).
- `unparseable` now has two meanings in the orchestrated add outcome (malformed manifest, and the catch-all for an unexpected error); reconcile and import show both as `unparseable`, and no reconcile/import test pins the malformed-manifest case (review WR-05/WR-06).
- Skipped review test gaps (WR-06): no test proves the skip path leaves the completion cache alone, none pins the new tokens on the project-scope install path (`install-outcome.ts` reuses `classifyAddError`), none covers update's raw-error cascade arm.
- The no-op returns `status: "added"` internally; safe only while orchestrated adds never reach the redeclare path (IN-02). It also reports `already added` without checking the recorded clone still exists (same as the old `duplicate name`).
- An EISDIR or other non-errno manifest read failure on `marketplace add` is still an unclassified raw throw, while `list`/`info` call it `unreadable` (21-CONTEXT D-08, kept deliberately).
- `docs/json-output.md`'s Reason list does not include `already added` (introduced by Phase 19); not edited here to avoid a conflict with parallel phases.
- `features/lib/published-marketplace.ts` gained `makeManifestUnreadable`; parallel phases editing that file may need a trivial merge.
- `scripts/init.sh` left untracked `.agents/skills/fallow-setup/` and `.claude/skills/fallow-setup/`; not committed.
