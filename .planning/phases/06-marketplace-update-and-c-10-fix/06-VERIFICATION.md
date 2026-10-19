---
phase: 06-marketplace-update-and-c-10-fix
verified: 2026-10-19T08:30:00Z
status: passed
score: 5/5 roadmap success criteria verified (13/13 requirement IDs accounted for)
covered_files:
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-01-PLAN.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-01-SUMMARY.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-02-PLAN.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-02-SUMMARY.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-03-PLAN.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-03-SUMMARY.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-04-PLAN.md
  - .planning/phases/06-marketplace-update-and-c-10-fix/06-04-SUMMARY.md
  - extensions/pi-claude-marketplace/domain/manifest.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/file-source-update.feature
  - features/marketplace/info.feature
  - features/marketplace/update.feature
  - features/step_definitions/command.steps.ts
  - features/step_definitions/marketplace/update.steps.ts
  - tests/orchestrators/marketplace/update.test.ts
covered_digest: "v3:sha256:ed9b14e41f95a83575d00b5fd670c8a2c1d042f9579f235fc1c67053b36fb686"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
advisory_findings:
  - "CR-01 (06-REVIEW.md): the owner test 'autoupdate ignores a newly declared plugin' in tests/orchestrators/marketplace/update.test.ts is weaker than its title. UPD-06 is still pinned by the Cucumber scenario 'Autoupdate does not install newly offered plugins'. Fix it before merge."
  - "WR-02 / WR-03 / WR-01 (06-REVIEW.md): edge cases for legacy or hand-corrupted state records. They do not affect newly added marketplaces."
  - "WR-09 (06-REVIEW.md): the rows step drops mcp-config-notices results silently."
  - "REQUIREMENTS.md still shows FIX-01 as '[ ]' / Pending, and ROADMAP.md still shows Phase 6 as '[ ]'. The orchestrator should flip both at phase close."
---

# Phase 6: Marketplace Update and C-10 Fix Verification Report

**Phase Goal:** `marketplace update` has scenarios for single and bare updates, with and without autoupdate, and for path-source failures, and `update` re-reads a manifest the user added from outside `.claude-plugin/` (C-10).
**Verified:** 2026-10-19
**Status:** passed
**Re-verification:** No, initial verification.

## Verdict

The goal is achieved in the code. The C-10 production fix exists and was driven test-first. The scenarios exist, run in the green gate, and assert whole results. No must-have is FAILED. The code review's one BLOCKER and its 14 warnings are test-strength or legacy-record edge cases. None of them turns a requirement into an unachieved one. They are listed below.

I did not re-run `npm run check` or Cucumber, as instructed. The gate evidence is that `npm run check` exited 0 at 97341ee4, and only `.planning/**/*.md` has changed since then. I checked the production and feature code directly. I also ran the five owner test files read-only with `node --test`: 321 tests, 321 pass, 0 fail (tests/orchestrators/marketplace/{update,info,add}.test.ts, tests/domain/manifest.test.ts, tests/persistence/state-io.test.ts).

## Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | An unchanged manifest is skipped as `up-to-date`. A changed manifest reports `updated` with no plugin rows while autoupdate is off. Rows exist for dir, `@url` and `@github`, and the local rows pass. | VERIFIED | `features/marketplace/update.feature` has the outlines "An unchanged marketplace is up to date" (l.239) and "A changed marketplace refreshes without plugin rows" (l.270). Each has `dir` and `file` examples, plus `@url` and `@github` example blocks. `cucumber.json` excludes `not @url and not @github` for this milestone. The production change detector is `refreshRecord` in `update.ts`, which does `isDeepStrictEqual(JSON.parse(preKey), JSON.parse(document.comparisonJson))`. Cosmetic rewrites and unknown-field and array-order changes are pinned by scenarios l.305-406. |
| 2 | With autoupdate off, installed plugins keep their version. With autoupdate on, the update moves them to the offered version, and a new session offers it. An unchanged marketplace is `up-to-date`. A newly offered plugin is not installed. A dropped plugin is skipped as `not in manifest` with warning severity. | VERIFIED | Outlines at l.408 (off keeps versions), l.475 (new session offers the version), l.543 (repeat does not reinstall), l.596 (unchanged autoupdate), l.644 (new plugin stays `available`, so UPD-06), l.698 (dropped plugin: `skipped`, `not in manifest`, severity `warning`, still `installed`; UPD-13), l.752 (ordered continuation after a failure). The cascade runs outside the marketplace lock. `snapshotAfterRefresh` saves inside `withLockedStateTransaction`, then `cascadeAutoupdates` runs. |
| 3 | A bare `update` refreshes every marketplace of both scopes, one result per marketplace, project first. It reports no marketplaces when none is added. Updating a name the scope lacks fails as `marketplace not added`, with and without `--scope`. | VERIFIED | The first scenario of `update.feature` pins project-before-user order, insertion order and the adjacent `mcp-config-notices` payloads. A repeat scenario, a continue-after-failure scenario, an only-populated-scope outline, and two empty-bare-update scenarios follow. Misses: the outline "An update reports the marketplace missing from the requested scope" (4 rows), the no-scope miss, and the Unicode name. The scoped-miss reasons are `marketplace not added` and `marketplace not added to <scope> scope`, which pins the code as the milestone rule says. |
| 4 | A path marketplace whose manifest became invalid fails with an `invalid manifest` row. One whose directory vanished fails as `source missing`. | VERIFIED | Outline "An invalid refreshed manifest leaves installed plugins unchanged" (l.812) covers dir and file kinds, both scopes, and both malformed JSON and schema errors. It asserts the `invalid manifest` reason, the full cause chain, retained config and installed skills. "A repaired marketplace can be updated again" pins recovery. "A missing marketplace directory leaves its registration intact" pins `source missing` (UPD-14). The JSON error text is identical on Node 22.22.2 and 26.11.1. I ran both. |
| 5 | A marketplace added from a `marketplace.json` outside `.claude-plugin/` updates by re-reading that file, and `info` shows its path. The scenario failed on the code before the fix. | VERIFIED | `features/marketplace/file-source-update.feature` scenario 1 uses the `catalog/marketplace.json` fixture. The saved red run `06-01-RED.json` has exit code 1, and the failing actual is `failed ... source missing ... open '{home}/marketplaces/tools/.claude-plugin/marketplace.json'`, where `updated` was expected. This is the C-10 symptom, recorded before the fix commits (`a8a57548`, `7d1846d2`). The fix: for `source.kind === "path"`, `refreshRecord` loads `record.manifestPath`, and no longer rebuilds `<root>/.claude-plugin/marketplace.json`. `info.ts` now projects the resolved original file for path sources. Further scenarios pin: repeat is `up-to-date` after a new session, and a missing original does not fall back to a conventional decoy. |

**Score:** 5/5 roadmap criteria verified. `behavior_unverified: 0`, because every behavior-dependent truth has a passing Cucumber scenario or owner test in the green gate.

## Plan must-haves

| Plan truth | Status | Evidence |
|------------|--------|----------|
| The baseline survives state reload. Add initializes it. Only a validated, saved refresh advances it. | VERIFIED | `state-io.ts` has the optional `lastSuccessfulManifest`. `add.ts` sets it in both `addGitClonedInGuard` and `addPathInGuard`. `refreshRecord` writes it only after a successful read and compare, and a throw returns before `tx.save()`. Owner tests in `state-io.test.ts`, `add.test.ts` and `update.test.ts` pass. |
| One cached read yields the resolver view and the comparison snapshot. | VERIFIED | `loadMarketplaceManifestDocument` in `domain/manifest.ts` returns `{ manifest, comparisonJson }` from the single loader. `loadMarketplaceManifest` delegates to it. `manifest.test.ts` passes. |
| Concurrency backstops (FIX-01, UPD-03, UPD-04, UPD-07, UPD-08). | VERIFIED, with a stated limit | Lock path read directly: refresh state is loaded and saved inside `withLockedStateTransaction` in `snapshotAfterRefresh`, and the plugin cascade runs after it releases. A concurrent removal inside the lock window is handled by the `record === undefined` branch, which owner tests at `update.test.ts` l.4739 and l.5375 inject deterministically. The per-marketplace sequential structure is unchanged. No multi-process race test exists, and none is claimed. |
| Idempotency (repeat updates). | VERIFIED | Scenarios "A repeated external manifest update is up to date" (after a new session), "Repeating a bare update...", "Repeating an empty bare update...", "Repeating an autoupdate does not reinstall a plugin". |
| An ordinary marketplace failure does not stop later marketplaces or scopes (D-12). | VERIFIED | Scenario "A bare update continues after a marketplace fails". |

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `domain/manifest.ts` exports `loadMarketplaceManifestDocument` | VERIFIED | Present, substantive, imported by `add.ts` and `update.ts`. |
| `persistence/state-io.ts` has `lastSuccessfulManifest` | VERIFIED | Schema field present. Written by `add.ts` and `update.ts`. |
| `features/marketplace/file-source-update.feature` | VERIFIED | 4 scenarios, 110 lines. |
| `features/marketplace/update.feature` | VERIFIED | 888 lines. About 20 scenarios and outlines. |
| `tests/orchestrators/marketplace/update.test.ts` | VERIFIED | Passes. See CR-01 below for one weak case. |
| `features/lib/mcp-configuration.ts` and `mcp-configuration.steps.ts` | VERIFIED | Used by the bare-update notice scenarios. |
| `features/step_definitions/command.steps.ts` rows step | VERIFIED, with WR-09 | Accepts only `mcp-config-notices` as a rowless payload. |

## Key Links

| From | To | Status |
|------|----|--------|
| `add.ts` `newMarketplaceName` | `loadMarketplaceManifestDocument` | WIRED |
| `update.ts` `refreshRecord` | `lastSuccessfulManifest` saved by `tx.save()` | WIRED |
| `update.ts` `refreshOneMarketplace` | `notifyMcpConfigNotices` directly after the cascade notify | WIRED |
| `update.feature` | `update.steps.ts` `rewritePublishedManifest` / `removePublishedSource` | WIRED |
| `update.feature` | `session.steps.ts` "the session offers these skills" | WIRED (used at the autoupdate scenarios) |

## Requirements Coverage

Plan frontmatter IDs: 06-01 FIX-01; 06-02 UPD-01, UPD-02, UPD-10, UPD-14; 06-03 UPD-03, UPD-04, UPD-05, UPD-06, UPD-13; 06-04 UPD-07, UPD-08, UPD-09. That is 13 IDs, equal to the 13 in the ROADMAP phase line. No orphans. UPD-11 (Phase 9) and UPD-12 (Phase 10) map to later phases.

| Requirement | Plan | Status | Evidence |
|-------------|------|--------|----------|
| UPD-01 | 06-02 | SATISFIED | Unchanged outline (dir, file; url and gh tagged for later phases). |
| UPD-02 | 06-02 | SATISFIED | Changed outline, no plugin rows. |
| UPD-03 | 06-03 | SATISFIED | "Autoupdate off preserves installed versions" (l.408). |
| UPD-04 | 06-03 | SATISFIED | "Autoupdate exposes the offered version in a new session" (l.475). |
| UPD-05 | 06-03 | SATISFIED | "An unchanged autoupdate is up to date" (l.596). |
| UPD-06 | 06-03 | SATISFIED | "Autoupdate does not install newly offered plugins" (l.644). `new@tools` stays `available`. CR-01 does not change this. |
| UPD-07 | 06-04 | SATISFIED | First bare-update scenario, with order and adjacent notices. |
| UPD-08 | 06-04 | SATISFIED | "A bare update with no marketplaces reports an empty result". |
| UPD-09 | 06-04 | SATISFIED | Missing-name outline, no-scope miss, Unicode name. |
| UPD-10 | 06-02 | SATISFIED | Invalid-manifest outline plus repair scenario. |
| UPD-13 | 06-03 | SATISFIED | "Autoupdate keeps a plugin removed from the catalog" (warning severity). |
| UPD-14 | 06-02 | SATISFIED | "A missing marketplace directory leaves its registration intact". |
| FIX-01 | 06-01 | SATISFIED in code | Fix, red-first evidence and info path all present. `REQUIREMENTS.md` still shows `[ ]` / Pending (see below). |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Five owner test files | `node --test tests/orchestrators/marketplace/{update,info,add}.test.ts tests/domain/manifest.test.ts tests/persistence/state-io.test.ts` | 321 pass, 0 fail | PASS |
| JSON error wording matches across Node 22 and 26 | `node -e 'JSON.parse(...)'` on both | identical message | PASS |
| Full `npm run check` with 199 Cucumber scenarios | Not re-run. Gate evidence given by the caller. | Exit 0 at 97341ee4. No non-planning change since. | ACCEPTED |

## Anti-Patterns

No `TBD`, `FIXME`, `XXX` or `TODO` markers are in the files this phase changed. No stub or hollow-prop pattern was found. The scenarios compare whole results, not substrings.

## Code review findings weighed against the goal

The review is advisory. All 19 findings are still `open` in `06-REVIEW-DISPOSITION.md`.

| Finding | Effect on goal | Judgment |
|---------|----------------|----------|
| CR-01 (BLOCKER, test strength) | The unit test 'autoupdate ignores a newly declared plugin' passes under two wrong implementations. | Does not fail UPD-06. The Cucumber scenario at `update.feature` l.644 asserts the whole row list, a follow-up `list` showing `new@tools` as `available`, and the new session's skills. The review rule still calls it a BLOCKER for the unit test, so fix it. The fix is in the review. |
| WR-01 (corrupt baseline) | A hand-corrupted `lastSuccessfulManifest` bricks one marketplace with a false `{network unreachable}`. | Not reachable through normal use. A fail-closed gap for corrupt data. Does not affect FIX-01 or UPD-10. |
| WR-02 (legacy path records) | Records written by the old code are not repaired. A relative `manifestPath`, or one the C-10 bug repointed to a decoy, still reads the wrong file, while `info` shows the original. | Real but out of the stated goal, which is a manifest the user adds. A user with an old affected record would not see FIX-01. Worth a follow-up decision. |
| WR-03 (legacy git record, invalid on-disk manifest) | Cannot recover. | Pre-existing, narrowed by this phase. Git rows are tagged for later phases. |
| WR-09 (rows step skips notices) | A spurious notice passes the rows step unless the scenario also uses `the command reports these results:`. | The scenarios that produce notices do use it. The two `file-source-update.feature` scenarios that rely on the rows step alone cannot produce a notice. A hardening item. |
| WR-04, 05, 06, 07, 08, 10-14, IN-01 to IN-04 | Test style, table alignment, a loose guard (`ownedTarget` accepts the root's parent), and comments. | Do not change any requirement outcome. |

## Human Verification Required

None. Every behavior-dependent truth has a passing scenario or owner test, and no visual or external-service check applies. Cucumber needs an unsandboxed headless Pi, and its result is taken from the caller's gate evidence.

## Gaps Summary

No blocking gaps. Three follow-ups the orchestrator should know about:

1. `REQUIREMENTS.md` shows FIX-01 as `[ ]` and "Pending", and `ROADMAP.md` shows Phase 6 as `[ ]`, although the work is done. Flip both at phase close.
2. Triage the 19 open review findings. CR-01 should be fixed first because it is a rule BLOCKER on a test file.
3. Decide whether WR-02 (legacy path records that still read a stale or decoy manifest) needs a repair step. That would protect existing users, not the new-add path this phase proves.

Two SUMMARY references use stale names: `features/marketplace/info.feature#A conventional manifest keeps its file identity` is now the `file` row of the `Info shows the source identity and description` outline, and `keeps durable update state until a repaired retry succeeds` is a template-literal test name at `tests/orchestrators/marketplace/update.test.ts:1833`. The new scenario 'A conventional manifest keeps its file identity' also exists in `file-source-update.feature`. The claims they back are present.

---

_Verified: 2026-10-19_
_Verifier: Claude (gsd-verifier)_
