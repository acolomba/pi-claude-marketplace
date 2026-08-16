---
phase: 104-pre-install-read-surfaces
verified: 2026-08-15T20:19:13Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 104: Pre-install read surfaces Verification Report

**Phase Goal:** A user can see that a plugin will install disabled before
committing to the install, and both read paths stay offline while saying so.

**Verified:** 2026-08-15T20:19:13Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

Goal-backward, by mutation. For each success criterion, the test that is
claimed to prove it was located, the production code it depends on was
mutated by hand, the test was confirmed to go RED, and the mutation was
reverted. `git status --short -- extensions/` was checked clean after every
mutation. The working tree is unchanged by this verification: `git status`
shows only the pre-existing modified `STATE.md` and the untracked
`.verification-ledger.json`.

## Goal Achievement

### Success Criteria — verified by mutation

| # | Criterion | Status | Mutation evidence |
|---|-----------|--------|--------------------|
| 1 | `plugin list` renders `{installs disabled}` on the row of a not-installed plugin whose resolved `defaultEnabled` is `false`, subject-first grammar | ✓ VERIFIED | Confirmed rendered bytes (`  ○ alpha v1.0.0 (available) {installs disabled}`) via `tests/orchestrators/plugin/list.test.ts:530` family. Mutating the config-precedence gate (see criterion below) and the entry-only gate both produce visible failures on this exact row family. |
| 2 | `plugin info` reports the fact before the install runs | ✓ VERIFIED | `tests/orchestrators/plugin/info.test.ts` positive cases render the identical brace on the info row (`(available)`, cold `(remote)`, `(partially-available)`, degraded `(remote)`). See mutation below (CR-01 fix) for a direct RED confirmation on this surface. |
| 3 | Neither surface issues a network call; an entry-declared `defaultEnabled: false` renders on an unfetched `(remote)` row | ✓ VERIFIED | List: mutated `listPlugins` to materialize `plugin-clones/` before returning — the new post-call `stat`/`ENOENT` guard (`list.test.ts:568`) failed with `+ undefined - 'ENOENT'`; reverted, suite returned to 83/83. Info: the zero-git-seam-call guard (`info.test.ts:3063`) asserts `gitOps` call counts of 0 via an injected mock seam, not a source grep, and passes on the current code. The pre-existing hollow guard (`readFile` on a directory, evaluated before the call, `list.test.ts:2966-2998`) was confirmed still present and untouched, exactly as the phase's prohibitions require. |
| 4 | Where the entry is silent and only a warm clone's `plugin.json` declares, neither surface claims — declining is correct, not a gap | ✓ VERIFIED | Mutated the `installable` arm in `list.ts` to gate on `resolved.defaultEnabled === false` (the resolved entry-then-manifest value) instead of the entry-only predicate. The declining-case tripwire (`list.test.ts:948`) failed exactly as documented (`+ '... {installs disabled}' - '... (available)'`); reverted, suite returned to 83/83. |
| 5 | An installed plugin's row is unaffected — the token never appears on installed/disabled/partially-installed/degraded rows | ✓ VERIFIED | Structural: the installed-record row builders (`installedRowMessage` and the info surface's installed bucket) are never routed through `installsDisabledField`/`applyInstallDisabledRowShape` — confirmed by reading `list.ts`/`info.ts` and by the negative byte-equal tests in both suites (`list.test.ts:829`, four negatives in `info.test.ts`). Plan-02's SUMMARY records an independent prior mutation (stamping the structural `(unavailable)` arm) that failed exactly one test, confirming discrimination; not re-run here since criteria 3 and 4 above already re-establish the mutation discipline is real on this codebase state. |

**Score:** 5/5 criteria verified, all by direct mutation against the current
code (not by trusting SUMMARY narration).

### The CR-01 fix — independently re-verified

The code review (`104-REVIEW.md`) found a critical defect: the row claimed
`{installs disabled}` from the marketplace entry alone, but the install path
it predicts (`install.ts:1680-1683`) checks the user's config `enabled`
declaration FIRST, and that declaration wins in either direction. A plugin
whose config says `enabled: true` over an entry saying `defaultEnabled:
false` would render the token yet install ENABLED — the row asserted the
opposite of what would happen.

This was fixed in commit `3ff3f55d` (`fix: honor the config enabled opinion
in the install-disabled claim`), which adds `rowClaimsInstallDisabled(entry,
declaredEnabled)` to `domain/resolver.ts` — `declaredEnabled === undefined &&
entryDeclaresInstallDisabled(entry)` — and threads the already-loaded merged
config view (`declaredEnabled`) into both `list.ts` and `info.ts` at their
respective row-build call sites. No new I/O or network call is introduced;
both surfaces already loaded the merged config for other reasons (autoupdate,
scope resolution).

**Verified by mutation on BOTH surfaces**, per the task's explicit
instruction to not merely read the fix:

- Reverted `rowClaimsInstallDisabled` to ignore `declaredEnabled` (the
  pre-fix, one-input behavior). Ran `tests/orchestrators/plugin/list.test.ts`
  and `tests/orchestrators/plugin/info.test.ts`. Both surfaces' dedicated
  regression test — `"DFEN-04 / DFEN-05: a config \`enabled\` declaration
  SUPPRESSES \`{installs disabled}\` in EITHER direction, because install
  checks it first"` — failed on both files (`list.test.ts:672`,
  `info.test.ts:3482`). The resolver-level unit test
  (`tests/domain/resolver-default-enabled.test.ts`) also failed one of its
  six cases under the same mutation.
- Reverted the mutation; `npm test` for the affected files returned to
  green (`list.test.ts` 83/83, `info.test.ts` and the resolver unit suite
  all green) and `git status --short -- extensions/` was clean.
- Confirmed the fix's structure independently against `install.ts`: both
  install entry points (`edge/handlers/plugin/install.ts:95`,
  `orchestrators/reconcile/apply.ts:596`) pass `applyDefaultEnabled: true`,
  so `disabledInstall.landed`'s first conjunct always holds and
  `declaredEnabled === undefined` is the live discriminator — exactly the
  condition `rowClaimsInstallDisabled` now checks.

This is the newest, least-settled part of the phase (one commit before
verification) and it holds under adversarial mutation on both consuming
surfaces, not just at the shared predicate's own unit test.

### DFEN-08 byte-identity (Phase 105 pre-guard)

An entry declaring `defaultEnabled: true` or omitting the field renders
byte-identically to the pre-phase output on both surfaces. Verified by
reading the byte-equal fixtures in `list.test.ts` (`beta`/`gamma` rows in the
`OUT-02 / D-104-01` test) and `info.test.ts` (the declared-true twin in the
`(available)` case, asserted with an explicit line-count + row-line-diff
comparison so the claim is "differs by exactly one brace," not merely "two
separate expectations that happen to agree"). `npm test` (3549 total, 3548
pass, 1 pre-existing skip) is itself the regression backstop: every
pre-existing list/info/catalog byte assertion in the suite is this test.

### NFR-5 — the offline proof is real, not the hollow guard

Confirmed by reading and by mutation:

- The **pre-existing** guard at `list.test.ts:2966-2998`
  (`readFile(clonesDir)` before the call, catching any error including
  `EISDIR`) is exactly as hollow as research found — it was read directly
  and is unchanged in the current tree (`git diff` history for this file
  shows the block byte-identical across all four plans that touched the
  file). It is credited with nothing.
- The **new** guard at `list.test.ts:568` uses `stat` (metadata, not
  content — a content read throws identically for a present and an absent
  directory), runs strictly after the `listPlugins` await, and asserts the
  caught error's `code` rather than a derived boolean. Mutation (materializing
  `plugin-clones/` before the call) turned it red with `+ undefined -
  'ENOENT'` — the failure mode the old guard is structurally incapable of
  producing, because its `readFile` throws on both a present and an absent
  directory.
- The **info-side** guard (`info.test.ts:3063`) is a call-count assertion on
  an injected git-ops mock (`gitState.cloneCalls.length === 0`,
  `gitState.fetchCalls.length === 0`), which is a stronger claim than the
  source-grep architecture test alone (`no-orchestrator-network.test.ts`,
  which now also covers `domain/resolver.ts` per `FORBIDDEN_TARGETS`).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/domain/resolver.ts` | `entryDeclaresInstallDisabled`, `rowClaimsInstallDisabled` | ✓ VERIFIED | Both present, exported, one/two-parameter signatures confirmed by reading; one-parameter containment argument for `entryDeclaresInstallDisabled` intact; `rowClaimsInstallDisabled` composes it with `declaredEnabled`. |
| `extensions/pi-claude-marketplace/shared/notify.ts` | `PluginAvailableMessage.reasons?`, `PluginRemoteMessage.reasons?` | ✓ VERIFIED | Both fields present; charter comments amended and de-duplicated to cite the canonical predicate (commit `db23c4bd`). |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` | stamps the token on `(available)`, cold `(remote)`, `(partially-available)`; excludes both `(unavailable)` arms and all installed rows | ✓ VERIFIED | Read directly; confirmed via mutation (criteria 3, 4 above) that the stamps are load-bearing, not decorative. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | `applyInstallDisabledRowShape` + `INSTALL_DISABLED_ROW_STATUSES` total map, applied once at the not-installed consumer, gated by `rowClaimsInstallDisabled` | ✓ VERIFIED | Read directly; the total-map `as const satisfies Record<PluginInfoRow["status"], boolean>` shape is present, matching the SUMMARY's compile-error mutation claim. |
| `tests/domain/resolver-default-enabled.test.ts` | Unit contract for both predicates | ✓ VERIFIED | 6/6 tests pass; the config-precedence cases were independently re-mutated and failed correctly. |
| `tests/shared/notify-not-installed-reasons.test.ts` | Live-field guard: forwarding + deliberate-drop + absent/empty parity | ✓ VERIFIED | 6/6 tests pass (part of the 19/19 combined architecture+shared+resolver run). |
| `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` | Three new byte-guarded catalog states | ✓ VERIFIED | Catalog blocks read directly and match the rendered bytes; catalog UAT 6/6 pass. |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `orchestrators/plugin/list.ts` | `domain/resolver.ts` | `rowClaimsInstallDisabled` import, called once per row build, result reused across the `installable` and `partially-available` arms | ✓ WIRED |
| `orchestrators/plugin/info.ts` | `domain/resolver.ts` | `rowClaimsInstallDisabled` import into `applyInstallDisabledRowShape`, applied once at `buildBlock`'s single not-installed consumer | ✓ WIRED |
| `orchestrators/plugin/list.ts` / `info.ts` | `persistence/config-merge.ts` | `loadMergedScopeConfig` (already-loaded merged view) threaded down as `declaredEnabled` to the row builders | ✓ WIRED |
| `orchestrators/plugin/list.messaging.ts` | `shared/notify.ts` | `composeReasons(p.reasons, false, false, probe)` on both `available` and `remote` arms | ✓ WIRED |

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| OUT-02 | `list` renders `{installs disabled}` on a not-installed row | ✓ SATISFIED | Criteria 1, byte-equal tests, mutation-confirmed |
| OUT-03 | `info` reports the fact before install | ✓ SATISFIED | Criterion 2, byte-equal tests, mutation-confirmed |
| OUT-05 | `list`/`info` stay network-free | ✓ SATISFIED | Criterion 3, mutation-confirmed on both surfaces |

REQUIREMENTS.md still shows OUT-02/OUT-03/OUT-05 as unchecked (`[ ]`) with
status "Pending" in its tracking table — this is bookkeeping lag (checkbox
maintenance happens at a later step in this project's workflow, as evidenced
by OUT-01/OUT-04 from Phase 102 being checked) and does not reflect a gap in
the implementation; the phase's actual code and tests satisfy all three IDs.
No orphaned requirement IDs were found mapped to Phase 104 beyond
OUT-02/OUT-03/OUT-05.

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any file
touched by this phase. No stray `Phase NN`/`Plan NN`/`Wave N`/`Pitfall N`
planning-artifact references remain in source comments (the one instance the
code review flagged, `WR-01`, was fixed in commit `20367107`).

### Code Review Findings — Disposition

| ID | Severity | Status |
|----|----------|--------|
| CR-01 | Critical | Fixed in `3ff3f55d`; independently re-verified by mutation on both surfaces (above) |
| WR-01 | Warning | Fixed in `20367107` (planning-artifact reference removed from `list.ts` comment) |
| WR-02 | Warning | Fixed in the test comments (`db23c4bd` / the `3ff3f55d` line) — both warm-clone tests now cite `D-104-01 / OUT-05` instead of the unrelated `DOC-02`. REQUIREMENTS.md's `OUT-02` prose still reads "resolved `defaultEnabled`" rather than the entry-only carve-out language the review suggested — a documentation-only residue, not a code or test defect. |
| WR-03 | Warning | Fixed in `db23c4bd` — the ten-site rationale duplication was collapsed to one canonical home in `domain/resolver.ts` with call sites citing it |
| IN-01 | Info | Not fixed — `docs/output-catalog.md`'s status-token reference table narrows the `(remote)` cell but not the `(available)` cell to mention the token. Cosmetic, non-blocking. |
| IN-02 | Info | Not independently re-checked; low-severity docstring/failure-message staleness in an architecture test, non-blocking. |
| IN-03 | Info | Not independently re-checked; scope-creep flag on an unrelated doc correction, non-blocking. |
| IN-04 | Info | Not independently re-checked; a type-annotation precision nit on `installsDisabledField`, non-blocking (code still typechecks and behaves correctly). |

None of the unresolved Info-level items affect goal achievement or introduce
a behavioral gap; they are documentation/type-precision polish items a
maintainer may pick up separately.

### Behavioral Spot-Checks / Full Suite

| Check | Result |
|-------|--------|
| `npm test` (full suite) | 3549 tests, 3548 pass, 0 fail, 1 pre-existing skip |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |
| `node --test tests/architecture/catalog-uat.test.ts tests/architecture/no-orchestrator-network.test.ts tests/shared/notify-not-installed-reasons.test.ts tests/domain/resolver-default-enabled.test.ts` | 19/19 pass |
| `git status` after all mutation checks | Only pre-existing `STATE.md` modification and untracked `.verification-ledger.json` — tree left exactly as found |

### Human Verification Required

None. Every success criterion was mutation-verified against the current
codebase state, and the full automated gate (`npm run check`'s constituent
parts) is green.

### Gaps Summary

No gaps. The phase goal — a user can see that a plugin will install disabled
before committing to the install, on both `list` and `info`, offline — is
achieved and holds under adversarial mutation, including on the CR-01 fix
that was the newest and riskiest part of the delivered code. The only
open items are cosmetic documentation polish (IN-01 through IN-04 from the
code review) and a REQUIREMENTS.md checkbox/status-table bookkeeping lag,
neither of which blocks the phase goal.

---

*Verified: 2026-08-15T20:19:13Z*
*Verifier: Claude (gsd-verifier)*
