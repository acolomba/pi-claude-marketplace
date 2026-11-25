---
phase: 03-marketplace-layers-and-cross-scope-install
verified: 2026-11-21T23:55:00Z
status: passed
score: 3/3 must-haves verified
covered_files:
  - ".planning/phases/03-marketplace-layers-and-cross-scope-install/03-01-PLAN.md"
  - ".planning/phases/03-marketplace-layers-and-cross-scope-install/03-01-SUMMARY.md"
  - ".planning/phases/03-marketplace-layers-and-cross-scope-install/03-02-PLAN.md"
  - ".planning/phases/03-marketplace-layers-and-cross-scope-install/03-02-SUMMARY.md"
  - ".planning/phases/03-marketplace-layers-and-cross-scope-install/03-03-PLAN.md"
  - ".planning/phases/03-marketplace-layers-and-cross-scope-install/03-03-SUMMARY.md"
  - ".planning/phases/03-marketplace-layers-and-cross-scope-install/03-04-PLAN.md"
  - ".planning/phases/03-marketplace-layers-and-cross-scope-install/03-04-SUMMARY.md"
  - "extensions/pi-claude-marketplace/domain/clone-key.ts"
  - "extensions/pi-claude-marketplace/domain/source.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts"
  - "features/lib/git-plugin.ts"
  - "features/marketplace/autoupdate.feature"
  - "features/marketplace/remove.feature"
  - "features/marketplace/url-source.feature"
  - "features/plugin/cross-scope-install.feature"
  - "features/step_definitions/config.steps.ts"
  - "features/step_definitions/marketplace/checkout.steps.ts"
  - "features/step_definitions/marketplace/publishing.steps.ts"
  - "features/step_definitions/plugin/installation.steps.ts"
  - "features/support/world.ts"
  - "test/domain/source.test.ts"
  - "test/integration/marketplace-layer-remove.test.ts"
  - "test/orchestrators/plugin/clone-cache.test.ts"
covered_digest: "v4:sha256:82ba8d711ce7ee6ef7e4fcc617eeb6cb782b4f9472411e03e22773afd740ac74"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 3: Marketplace Layers and Cross-Scope Install Verification Report

**Phase Goal:** Cucumber scenarios prove the marketplace layer rules (D-09, CFG-03, LAYER-02, a re-declaration with no git request, and the named remove of an undeclared marketplace) and a project install that adds a user marketplace to the project (WR-07, MA-12, MA-13, D-MF-04).
**Verified:** 2026-11-21T23:55:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A named `marketplace autoupdate` flip of a marketplace the scope records and no layer declares fails as not added; an unnamed flip gives it no row while a declared marketplace flips (D-09); a named non-local flip while the local config is unreadable changes no file (CFG-03). Scenarios pass, fail under a deliberate break, and the replaced cases are gone. | VERIFIED | `features/marketplace/autoupdate.feature:699`, `:718`, `:743` exist and assert the row/kind plus whole-scope `files of the project scope are unchanged` (`scope-state.steps.ts:20-39` reads every entry under the scope root, including directories and symlinks). Adapter run of the four feature files: 135/135 scenarios, 1577/1577 steps. Break logs A1 (`verdict.kind === "undeclared"` disabled) and A3 (`other-unreadable` disabled) each fail 1 of 46 scenarios; A4, A5a, A5b guard the pre-existing LAYER-02 and D-07 scenarios. `test/integration/marketplace-layer-autoupdate.test.ts` is deleted; `git grep` for the name outside `.planning` exits 1. |
| 2 | Declaring a url marketplace again (local layer, or after the scope records it with no layer declaring it) makes no second clone and no git request, and so does installing a url plugin from the same repository after the add. A named remove fully removes a recorded url marketplace that no layer declares. A remove refused because the other layer's config cannot be read changes nothing (LAYER-02). Scenarios pass, fail under a deliberate break, and replaced cases are gone from the three integration files. | VERIFIED | `url-source.feature`: LAYER-01 `--local` re-add and D-09 re-add, each with `the git host receives no request`, one clone, and bytes unchanged; D-SEED-01 outlines for pinned install and for `list` over four spellings (`tools`, `tools.git`, `tools/`, `tools.git/`). `remove.feature`: D-09 named remove (records, checkout, data), base-layer remove, local-layer keep, LAYER-02 (`marketplace in local layer only`, whole-scope unchanged), LAYER-02/CFG-03 unreadable local config, LAYER-03 kept dependency with clone and data, and `pending` empty afterward. Break logs D1 (`action.kind === "reuse"` disabled) and D2 (marketplace name altered) each fail 2 of 13 url-source scenarios; R1 (undeclared plan) fails 2 of 60; R5 fails 4 of 60; R8 (`StateLockHeldError` branch) fails 2 of 32. `marketplace-layer-redeclare.test.ts` deleted; `marketplace-layer-remove.test.ts` trimmed from 381 changed lines to its three EACCES fault-injection cases (lines 211, 369, 473; header says why they stay). `marketplace-add-seed-mirrors.test.ts` is unchanged by design: ROADMAP Notes keep its six cases internal for Phase 8, and the scenarios add only its user-visible half (see Info 2). |
| 3 | A project install from a marketplace only the user scope records fails before the project clones when the plugin is not in the manifest (WR-07), replaces the extension's own leftover clone (MA-12), refuses a foreign tree and keeps it (MA-13), and reads dependencies from the fresh project clone, not the stale user clone (D-MF-04). Scenarios pass, fail under a deliberate break, and the replaced cases are gone. | VERIFIED | `features/plugin/cross-scope-install.feature:71` (MA-12, leftover replaced, exactly one clone request pair), `:99` (WR-05/WR-07, `the git host receives no request`, no project record, no checkout, no config file, user scope unchanged), `:121` (MA-13, `stale clone` failure, checkout holds exactly `notes.txt` with text `the user's notes`, no staged checkout, no record, no config), `:146` (D-MF-04, user clone stale because the marketplace is republished with `app -> lib` after the user add; `lib@tools` installs in the project), `:170` (dependency's user url marketplace added to project, clone in each scope, one git request pair). Break logs C1 (WR-07 pre-check disabled), C2 and C3 (MA-12/MA-13 leftover handling), C4 (user-first lookup, D-MF-04), C6 (project add skipped; 9 of 10 fail), C8 (7 of 62 fail) each fail their scenarios. The review fix 717dbda tightened MA-13 to compare file text; its red proof (`fix-03b/red.log`) fails on `checkout.steps.ts:179` only, and `green.log` is 10/10. `project-install-adds-user-marketplace.test.ts` is deleted; no file outside `.planning` names it. |

**Score:** 3/3 truths verified, 0 present but behavior-unverified.

The first two truths and the third are behavior-dependent (state transitions, "changes no file", "makes no request"). Each has a passing behavioral scenario that I re-ran, so none rests on symbol presence.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `features/marketplace/autoupdate.feature` | D-09 named and unnamed, CFG-03 | VERIFIED | 3 new scenarios, 760 lines |
| `features/marketplace/remove.feature` | D-09, LAYER-02, LAYER-03 remove cases | VERIFIED | 8 new scenarios |
| `features/marketplace/url-source.feature` | no-request re-declaration, own-repository | VERIFIED | 2 scenarios + 2 outlines (4 rows each) |
| `features/plugin/cross-scope-install.feature` | WR-07, MA-12, MA-13, D-MF-04, dependency marketplace | VERIFIED | 10 scenarios (outline expands) |
| `features/step_definitions/marketplace/checkout.steps.ts`, `publishing.steps.ts`, `plugin/installation.steps.ts`, `config.steps.ts`, `features/lib/git-plugin.ts`, `features/support/world.ts` | new steps | VERIFIED | all used by the scenarios above; run green |
| Deleted: `marketplace-layer-autoupdate`, `marketplace-layer-redeclare`, `project-install-adds-user-marketplace` integration tests | Cases replaced | VERIFIED | files absent; no dangling references |
| Trimmed: `test/integration/marketplace-layer-remove.test.ts` | Only 3 EACCES cases | VERIFIED | 3 `test(` blocks |
| D-SEED-01 fix: `domain/source.ts` (`urlPathIdentity`), `orchestrators/plugin/clone-cache.ts` (`repositoryIdentity`, plugin-url key), `domain/clone-key.ts` (comment) | Product fix a scenario exposed | VERIFIED | `node --test test/domain/source.test.ts test/orchestrators/plugin/clone-cache.test.ts`: 289 pass, 0 fail |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| Scenarios | product behavior | break logs | WIRED | each break edits one product line, the named scenarios fail on an assertion, restore leaves `git status -- extensions/` clean |
| `seedSameRepoPluginMirrors` | install materializer / probe key | plugin's own `canonicalCloneUrl` | WIRED | `clone-cache.ts` `seedOnePluginMirror` keys by `canonicalCloneUrl(source)`; `.git` and trailing-slash scenarios cover it |
| `urlPathIdentity` | `stripUrlDecorations` | shared helper | WIRED | one definition in `source.ts`, composed in the same order as before (review iteration 2) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase feature files, adapter profile | `npm run test:cucumber:profile -- --profile adapter --parallel 2` over `cross-scope-install`, `url-source`, `autoupdate`, `remove` feature files | 135 scenarios passed, 1577 steps passed | PASS |
| Seeding unit tests | `node --test test/domain/source.test.ts test/orchestrators/plugin/clone-cache.test.ts` | 289 pass, 0 fail | PASS |
| Dangling references | `git grep -l -E "marketplace-layer-(autoupdate\|redeclare)\|project-install-adds-user-marketplace" -- . ':(exclude).planning'` | exit 1, no output | PASS |

The builtin profile selects only `@mcp` and `@builtin-only` scenarios (`cucumber.json`), so these untagged scenarios do not run under it. The orchestrator's builtin 206/206 gate is the matching evidence for "both profiles".

### Probe Execution

Step 7c: SKIPPED. The phase declares no probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ITMIG-05 | 03-01, 03-02, 03-03 | Marketplace layer cases (D-09 named and unnamed, CFG-03, re-declaration and same-repo install with no git request, named remove of undeclared, LAYER-02, base-layer url remove, refused remove changes nothing, LAYER-03 dependency kept) | SATISFIED | Truths 1 and 2; scenarios listed above. The refused-remove-with-installed-plugin and blocker cases were already covered, per ROADMAP Notes. |
| ITMIG-06 | 03-04 | Project install adding a user marketplace: WR-07, MA-12, MA-13, D-MF-04, dependency's user git marketplace with a clone in each scope | SATISFIED | Truth 3; `cross-scope-install.feature:71-207` |

No orphaned IDs: REQUIREMENTS.md maps only ITMIG-05 and ITMIG-06 to Phase 3, and the plans claim both.

### Data-Flow Trace (Level 4)

Not applicable. The artifacts are scenarios and step definitions, and the one product change is a pure comparison and key derivation.

### Anti-Patterns Found

None. No `TBD`, `FIXME`, `XXX`, `TODO`, or `HACK` on any line the phase added in `features/`, `test/`, or `extensions/`. No leaked `NEVER_SET` break edit remains, and `git status --porcelain` is clean.

### Human Verification Required

None.

### Gaps Summary

No gaps. Findings below are informational and do not block.

**Info 1 -- ROADMAP cross-cutting constraint, accepted deviation.** The phase constraint says `git diff <plan base> HEAD -- extensions/` must print nothing. It prints three files (`domain/source.ts`, `domain/clone-key.ts` comment, `orchestrators/plugin/clone-cache.ts`). This is the D-SEED-01 mirror-seeding fix for same-repo `git-subdir` urls ending in `.git` or `/`. REQUIREMENTS rule 4 allows a small product fix a new scenario exposes, and the orchestrator recorded it as intended with unit tests and url-source scenarios. Plan 03-03 also forbade editing `domain/source.ts`; commit a0bda9e (review fix) added `urlPathIdentity` there. The review (iteration 2) traced it and found parsed identities, `pluginCloneKey`, and `pluginMirrorKey` unchanged. Needs the CHANGELOG parent line from STATE.md applied at the merge.

**Info 2 -- `marketplace-add-seed-mirrors` keeps all six cases.** SC 2 lists it among files that lose replaced cases. It loses none: ROADMAP Notes keep its six cases (mirror directory, no-call, different repository, unseeded pin, mirror remote, GC) for Phase 8, and 03-03-SUMMARY maps case :155 as "kept, internal". The SC wording is looser than the Notes. I treat the Notes as controlling.

**Info 3 -- bookkeeping.** `03-02-SUMMARY.md` records `requirements: ["ITMIG-05"]` where the other summaries use `requirements-completed`. REQUIREMENTS.md still shows ITMIG-05 and ITMIG-06 as Pending; the orchestrator updates them at phase completion. The `fallow audit` `weakened-tests` warning on the deleted and trimmed integration files was accepted by the user and is not a gap.

**Info 4 -- evidence limits.** The break proofs come from the executors' logs. I did not repeat them because the tree is under a running gate and I may not edit source. I checked each log's diff against the failing scenario count, and `fix-03b/red.log` shows the MA-13 text check failing on the exact assertion. The gate on 82bc75c (adds only the MA-13 content check) was still running; `fix-03b/green.log` (10/10) and my adapter run on the current tree cover it.

---

_Verified: 2026-11-21T23:55:00Z_
_Verifier: Claude (gsd-verifier)_
