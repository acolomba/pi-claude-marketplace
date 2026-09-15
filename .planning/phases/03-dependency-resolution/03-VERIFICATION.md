---
phase: 03-dependency-resolution
verified: 2026-09-15T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .planning/PROJECT.md
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/codebase/ARCHITECTURE.md
  - .planning/phases/03-dependency-resolution/03-01-PLAN.md
  - .planning/phases/03-dependency-resolution/03-01-SUMMARY.md
  - .planning/phases/03-dependency-resolution/03-02-PLAN.md
  - .planning/phases/03-dependency-resolution/03-02-SUMMARY.md
  - .planning/phases/03-dependency-resolution/03-03-PLAN.md
  - .planning/phases/03-dependency-resolution/03-03-SUMMARY.md
  - .planning/phases/03-dependency-resolution/03-04-PLAN.md
  - .planning/phases/03-dependency-resolution/03-04-SUMMARY.md
  - .planning/phases/03-dependency-resolution/03-05-PLAN.md
  - .planning/phases/03-dependency-resolution/03-05-SUMMARY.md
  - .planning/phases/03-dependency-resolution/03-06-PLAN.md
  - .planning/phases/03-dependency-resolution/03-06-SUMMARY.md
  - .planning/phases/03-dependency-resolution/03-07-PLAN.md
  - .planning/phases/03-dependency-resolution/03-07-SUMMARY.md
  - .planning/phases/03-dependency-resolution/03-REVIEW-FIX.md
  - .planning/phases/03-dependency-resolution/03-REVIEW.md
  - CLAUDE.md
  - README.es.md
  - README.md
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/domain/dependency-closure.ts
  - extensions/pi-claude-marketplace/domain/dependency-range.ts
  - extensions/pi-claude-marketplace/domain/manifest-path.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - package-lock.json
  - package.json
  - scripts/test-coverage-direct.pin.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/manifest-read-agreement.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/domain/dependency-closure.test.ts
  - tests/domain/dependency-range.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/orchestrators/plugin/dependency-declaration-read.test.ts
  - tests/orchestrators/plugin/dependency-tag-probe.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install-outcome.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/platform/git.test.ts
  - tests/shared/notification-types.test.ts
covered_digest: "v1:sha256:095827eeb7700b55fcbf961be33b5928bb5eb5bdd1513f95bb7cd360de2da072"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Install a plugin that declares dependencies against a real Claude marketplace over the network, and read the rendered cascade block in a live Pi session."
    expected: "One legible row per cascade member beside the requesting plugin's row; wrapping is readable; row ordering makes sense against a closure longer than two members; a failure's remedy sentence (e.g. `Run marketplace add <source> to add it.`) is a sentence an operator would actually act on."
    why_human: "Every case in 03-06's messaging test drives a seeded fixture or a composed row through a fake host. No fixture settles subjective legibility, wrapping, or whether prose reads as actionable -- that is a judgment call requiring a human reading real terminal output (03-06 SUMMARY D10, human_judgment: true)."
  - test: "Resolve a version-constrained dependency against a real git host: list a real repository's tags (including at least one annotated tag), and drive a private-repository credential challenge through the tag probe."
    expected: "`listRemoteTags` (platform/git.ts) correctly reads the real wire protocol's tag advertisement and peels an annotated tag to its commit; a private source's credential challenge is answered by the existing host credential bundle with no separate prompt."
    why_human: "Every dependency-tag-probe.test.ts and git.test.ts case in this phase drives a faulted/fake transport double, never a live `isomorphic-git` wire exchange. The real `listServerRefs({ prefix, peelTags })` behavior against a real remote, and a real credential challenge, are unobserved (03-04 SUMMARY D8, human_judgment: true; 03-05 SUMMARY D12, human_judgment: true)."
---

# Phase 3: Dependency resolution Verification Report

**Phase Goal:** Installing a plugin installs what it declares it needs. This supersedes the PI-13 / PR-5 no-auto-resolution decision rather than working around it. The cascade maps onto the machinery that already exists -- `orchestrators/import/` cascade-installs an entire config with per-entry outcomes, and `orchestrators/plugin/bootstrap.ts` is an existing composer -- instead of a second cascade being introduced beside them.

**Verified:** 2026-09-15
**Status:** human_needed
**Re-verification:** No -- initial verification

## Context: a code review found 16 issues, all 13 blocker+warning findings were fixed

Before this verification ran, `03-REVIEW.md` (standard depth, 39 files) found 5
critical and 8 warning issues in the phase's own shipped code -- including CR-01,
which falsified the load-bearing RESV-01 reload clause on the orchestrated
install path (the path `resources_discover`/reconcile actually drives). All 13
critical+warning findings were fixed across 13 commits (`03-REVIEW-FIX.md`),
each with a red-then-green test. This verification does NOT take that report at
its word -- every fix claim below was independently re-derived from the current
source and re-run.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RESV-01: installing a plugin that declares dependencies leaves those dependencies installed, with a per-entry outcome the user can read, and they survive a `/reload` -- **on both the standalone AND orchestrated install paths** | VERIFIED | `install-flow.ts:1318-1363`: the orchestrated arm calls `writeOrchestratedDeclarations` with `installed.members` filtered to non-root keys (CR-01 fix, commit `52e2ac90`). Test `RESV-01 / WR-09: an orchestrated install declares its cascade dependencies, so the next reload keeps them` (tests/orchestrators/plugin/install-flow.test.ts:3486) drives the ACTUAL failure path this criterion calls out -- `applyReconcile` (not a bare `installPlugin` call), asserts `planReconcile(...).pluginsToUninstall` is empty after the first pass, then runs a **second** `applyReconcile` pass and asserts the dependency survives. Independently re-run: PASS. This is the specific regression the phase brief flagged (`buildUninstallBucket` sweeps undeclared records) and it is closed. |
| 2 | RESV-02: a dependency naming a marketplace resolves there; one naming none resolves in the declaring plugin's marketplace | VERIFIED | `domain/dependency-closure.ts` resolves per-edge marketplace with token-allowlist re-checking (`tests/domain/dependency-closure.test.ts`, 23 cases, independently re-run: PASS). CR-02's cross-scope bug (a project-scope install off a user-scope marketplace failed a same-marketplace dependency) is fixed via `collectInstallReachableMarketplaces` (commit `e155339d`, follow-up `52f6d29c`); test `CMP-3 / D-03-08: a project install off a user-scope marketplace resolves a same-marketplace dependency` independently re-run: PASS. |
| 3 | RESV-03: a dependency whose version constraint no available plugin satisfies fails the install naming the constraint, under a written grammar | VERIFIED | `docs/dependency-resolution.md` (130 lines) states accepted forms, combination rules, both size caps, and the failure table. `domain/dependency-range.ts` (intersection algebra) + `dependency-tag-probe.ts` (live tag resolution) + `install-cascade.ts` (`resolveMemberConstraints`) implement it; `tests/domain/dependency-range.test.ts` and `tests/orchestrators/plugin/install-cascade.test.ts` constraint cases independently re-run: PASS. CR-04 (a tag-pinned dependency was recorded under a `sha-<12hex>` version, making the cascade non-idempotent against its own just-satisfied constraint) is fixed -- `pinnedVersion` now rides to `pinVersionOverride` (commit `d623647f`); test `RESV-03/RESV-05: a tag-pinned dependency records the tag's own version, and a later constraint reads it back` independently re-run: PASS, and confirms a second dependent with the same range installs `(skipped) {already installed}` rather than failing. CR-05 (a declared `sha` pin was silently dropped, contradicting the project's own no-silent-constraint-loss principle) is fixed -- `sha` is refused as `unusable-declaration` (D-03-36, commit `5609f09c`); both red-then-green tests independently re-run: PASS. WR-04 (doc/code failure-table drift) is closed by a purpose-built gate (`tests/architecture/dependency-doc-agreement.test.ts`) that drives the real composer and diffs against the doc table; independently re-run: PASS (3/3), including its own planted-violation self-check. |
| 4 | RESV-04 / RESV-05: a dependency cycle terminates and reports; an already-installed dependency is left alone rather than reinstalled | VERIFIED | Two-structure walk (`path` stack for cycles, `visited` memo for dedup) in `domain/dependency-closure.ts`; `tests/domain/dependency-closure.test.ts` cycle/diamond cases independently re-run: PASS. `checkInstalledMember` in `install-cascade.ts` checks-not-touches an already-installed dependency; WR-01 (a *disabled* already-installed dependency read as a silent, info-severity "fine") is fixed -- new `dependency disabled` reason token joins `already installed` and raises the row to `warning` via `skipSeverity` (commit `c9695872`); tests independently re-run: PASS. |
| 5 | RESV-06 / NFR-3: a dependency that cannot be installed names which one and why, leaves no half-materialized plugin behind, and re-running produces the same result | VERIFIED | `install-cascade.messaging.ts` composes per-member rows and a failure block naming the failed dependency and a closed-set reason (`tests/orchestrators/plugin/install-cascade.messaging.test.ts`, 22 whole-notification-byte-equality cases, independently re-run: PASS). CR-03 (the outer ledger's `undo` swallowed a real `cascadeUnstagePlugin` failure and reported a clean rollback while artifacts stayed on disk owned by no record) is fixed -- `undo` now reads the outcome, folds what actually dropped, and throws to surface a `RollbackPartial` (commit `9c5ec287`); both red-then-green tests independently re-run: PASS, using a double that returns `{ok:false,...}` rather than the review's own critique-target `Promise.reject` double that the real primitive cannot produce. |

**Score:** 5/5 must-haves verified (5 roadmap Success Criteria; each corresponds 1:1 to a RESV requirement group, all 6 RESV-01..06 IDs traced above)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/dependency-closure.ts` | pure closure walk | VERIFIED | exists, substantive, wired from `install-flow.ts`'s `lookupCascadeDependencies` and `install-cascade.ts` |
| `extensions/pi-claude-marketplace/domain/dependency-range.ts` | version-range algebra | VERIFIED | exists, substantive, wired from `install-cascade.ts::resolveMemberConstraints` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` | outer per-closure-member ledger | VERIFIED | exists, substantive, wired from `install-flow.ts` as the sole cascade driver |
| `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts` | live tag resolution | VERIFIED | exists, substantive, wired via injected `tagProbe` field (absent from `NETWORK_FREE_TARGETS`, callers present) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts` | plugin-manifest-first read | VERIFIED | exists, substantive, wired from `install-flow.ts`'s cascade lookup |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` | per-member row/failure rendering | VERIFIED | exists, substantive, wired from `install-flow.ts` success/failure paths |
| `docs/dependency-resolution.md` | written version-constraint grammar | VERIFIED | exists, 130+ lines, linked from README.md/README.es.md, verified to agree with code by the WR-04 gate |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `install-flow.ts` (both standalone AND orchestrated arms) | `writeAdoptingConfigEntries` / `writeOrchestratedDeclarations` | cascade member keys declared in the requesting plugin's own config file | WIRED | Confirmed on both arms; CR-01 closed the orchestrated-arm gap. Test evidence above. |
| `orchestrators/reconcile/plan.ts::buildUninstallBucket` | declared config keys | reads `declaredPluginKeys` -- unaffected, correctly reads what the fixed write-back now produces | WIRED | `03-01-SUMMARY.md` confirms this file was read, not edited; the phase's fix works by declaring the right keys upstream, not by changing the sweep logic. Independently spot-read: `orchestrators/reconcile/plan.ts:501-506` unchanged this phase. |
| `install-cascade.ts` constraint step | `dependency-tag-probe.ts` | injected `tagProbe` field, `resolveMemberConstraints` sits between closure walk and ledger-phase construction | WIRED | grep-confirmed field name avoids the NFR-5 gate's bare-identifier match; architecture tests (`no-orchestrator-network`, `import-boundaries`) independently re-run: PASS |
| `install-cascade.ts` member undo | `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin` | outcome read, folded, converted to a throw on failure (CR-03) | WIRED | independently re-run tests confirm a `RollbackPartial` now surfaces and the record is not deleted on a failed unstage |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `install-cascade.messaging.ts::composeCascadeMemberRows` | member row `dependencies`/`companionSeverity` | `CascadeMemberOutcome.declaresAgents`/`declaresMcp` off the real ledger summary (WR-02 fix data) | Yes | FLOWING |
| `install-flow.ts` orchestrated write | dependency keys | `installed.members` (real cascade result), filtered to non-root | Yes | FLOWING |
| `install-cascade.ts::resolveMemberConstraints` | pinned version | `probeDependencyTags`'s real `probed.version`, not a re-derived/static value | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Orchestrated-mode reload survival (the phase brief's flagged load-bearing check) | `node --test --test-name-pattern="RESV-01 / WR-09" tests/orchestrators/plugin/install-flow.test.ts` | 1 pass | PASS |
| All 13 CR/WR fix regression tests | targeted `--test-name-pattern` runs across install-flow/install-cascade/dependency-closure test files | 9 pass (remaining 4 covered by the same files' broader suite run below) | PASS |
| Full RESV-0x test surface (closure, range, cascade, messaging, tag probe, declaration read, git) | `node --test tests/domain/dependency-closure.test.ts tests/domain/dependency-range.test.ts tests/orchestrators/plugin/install-cascade.test.ts tests/orchestrators/plugin/install-cascade.messaging.test.ts tests/orchestrators/plugin/dependency-tag-probe.test.ts tests/orchestrators/plugin/dependency-declaration-read.test.ts tests/platform/git.test.ts` | 202/202 pass | PASS |
| Full `orchestrators/plugin`, `domain`, `orchestrators/reconcile`, `orchestrators/import` suites (regression) | `node --test tests/orchestrators/plugin/*.test.ts tests/domain/*.test.ts tests/orchestrators/reconcile/*.test.ts tests/orchestrators/import/*.test.ts` | 2556/2556 pass | PASS |
| Full architecture gate suite (NFR-5, credential-leak, import boundaries, unowned-export census, closed-set locks, doc agreement) | `node --test tests/architecture/*.test.ts` | 297/297 pass | PASS |
| Catalog UAT + shared notification tests | `node --test tests/architecture/catalog-uat/*.test.ts tests/shared/*.test.ts` | 741/741 pass | PASS |
| `npm run typecheck` | `tsc --noEmit` | exit 0 | PASS |
| `fallow dead-code` | `npx fallow dead-code --fail-on-issues` | 0 issues | PASS |
| `fallow health` | `npx fallow health --fail-on-issues` | 0 above threshold, maintainability 91.8 | PASS |
| `fallow dupes` | `npx fallow dupes --fail-on-issues` | exit 0, 1,035 lines (1.2%) duplicated -- pre-existing, confirmed unchanged by this phase | PASS (known, documented) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|-------------|--------|----------|
| RESV-01 | 03-01, 03-06, 03-07 | Installing also installs declared dependencies | SATISFIED | Truth 1 above; REQUIREMENTS.md marks Complete |
| RESV-02 | 03-01, 03-07 | Dependency resolves from named or declaring plugin's marketplace | SATISFIED | Truth 2 above; REQUIREMENTS.md marks Complete |
| RESV-03 | 03-02, 03-03, 03-04, 03-05, 03-06 | Unsatisfiable constraint fails, naming it, under written grammar | SATISFIED | Truth 3 above; REQUIREMENTS.md marks Complete |
| RESV-04 | 03-01, 03-06 | Dependency cycle terminates instead of installing forever | SATISFIED | Truth 4 above; REQUIREMENTS.md marks Complete |
| RESV-05 | 03-01, 03-05 | Already-installed dependency is not reinstalled | SATISFIED | Truth 4 above; REQUIREMENTS.md marks Complete |
| RESV-06 | 03-01, 03-06 | User learns which dependency failed and why | SATISFIED | Truth 5 above; REQUIREMENTS.md marks Complete |

No orphaned requirements: `.planning/REQUIREMENTS.md`'s Phase 3 row set (RESV-01..06) is exactly the union of every plan's `requirements:` frontmatter field.

### Anti-Patterns Found

None (blocker or warning) in the phase's changed source files. Scanned all 13 production `.ts` files touched by this phase for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` -- zero matches. One cosmetic, non-functional item found and downgraded to informational:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/architecture/notify-closed-set-locks.test.ts` | 29 | Test title says "closed 52-entry reason set" but the assertion (line 64) correctly checks `REASONS.length === 53` (WR-01's later bump) | Info | Cosmetic only -- the assertion itself is correct and independently re-verified (`REASONS.length` === 53 confirmed by direct import). No functional risk; a future reader skimming only the title would be misled by one number. |

### Deferred Items

None. All 5 roadmap Success Criteria map to work completed in this phase; no later phase in the current milestone/roadmap section was found to cover any residual concern from this phase.

## Known Open Items (carried from the task brief, assessed)

1. **UAT item, human_judgment: true, across three plan summaries (03-04 D8, 03-05 D12, 03-06 D10).** No part of the cascade -- neither the rendered output nor the live network tag resolution -- has been exercised against a real Pi session / real git host. This is a genuine gap no fixture can close (wrapping, row-ordering legibility, and live wire-protocol behavior are runtime-only concerns). **Routed to `human_verification` above; this is the reason overall status is `human_needed` rather than `passed`.**
2. **WR-05 asked to "close or re-scope PDEP-01".** The stale in-document citation was removed from `docs/plugin-enablement.md` (confirmed: file now states the shipped mechanism correctly). `PDEP-01` still lives in `.planning/BACKLOG.md:1314` and is referenced once in `.planning/REQUIREMENTS.md:32` (a closure note, not an open requirement). These are planning-artifact housekeeping, not a code gap. **Acceptable to leave as-is** -- non-blocking, does not affect goal achievement.
3. **`fallow dupes` prints 1,035 duplicated lines, exit 0.** Independently re-run: confirmed exit 0, confirmed the count is unrelated to phase-03 files (all listed clone groups are in `scripts/*.mjs` and `tests/live-uat/*`). **Acceptable, pre-existing, non-blocking.**
4. **03-04 SUMMARY's `commits: 3` vs `git rev-list` reading 4.** Independently confirmed the extra commit is the plan's own `docs(03-04): complete the live tag resolution plan` metadata commit (self-referential, cannot record its own hash per every summary's stated convention). **Cosmetic, non-blocking.**

## Human Verification Required

### 1. Read the cascade block in a live Pi session

**Test:** Install a plugin that declares dependencies against a real Claude marketplace, over the network, in an actual Pi session.
**Expected:** The per-member rows are legible, wrap sensibly, order sensibly against a closure of more than two members, and a failure's remedy sentence (e.g. `Run marketplace add <source> to add it.`) reads as something an operator would act on.
**Why human:** No fixture in `install-cascade.messaging.test.ts` (22 cases, all whole-notification-byte-equality against composed/seeded input) can judge subjective legibility or real terminal wrapping.

### 2. Live tag resolution against a real git host

**Test:** Resolve a version-constrained dependency whose source repository is real: list its tags (ideally including an annotated tag), and separately drive a private-repository credential challenge through the tag probe.
**Expected:** `listRemoteTags` correctly reads the real `isomorphic-git` wire advertisement (`listServerRefs({ prefix: "refs/tags/", peelTags: true })`) and peels an annotated tag to its commit id, not the tag object; a private source's credential challenge is answered by the existing host credential bundle with no separate prompt.
**Why human:** Every `dependency-tag-probe.test.ts` and the tag-listing cases in `git.test.ts` drive a fake/faulted transport double. Nothing in this phase has exercised the real wire protocol or a real credential challenge.

## Gaps Summary

No FAILED truths. All 6 RESV requirements are satisfied in code, with every finding from the phase's own code review (5 critical, 8 warning, all in the `critical_warning` fix scope) independently re-verified as fixed against the current source -- not merely re-read from `03-REVIEW-FIX.md`'s claims. The load-bearing reload-clause check the task brief specifically flagged (CR-01, the orchestrated-path config write-back) is fixed and covered by a test that drives the real failure path (`applyReconcile`, not a bare `installPlugin` call) through two full reconcile passes.

The phase does not reach `passed` status only because it carries un-closeable live-network/live-UI verification items that no unit fixture can settle -- these are the same items the phase's own plan summaries flagged as `human_judgment: true` and never claimed to close. Nothing here is a defect; it is unexercised surface that needs a human with a real Pi session and a real git remote.

---

_Verified: 2026-09-15_
_Verifier: Claude (gsd-verifier)_
