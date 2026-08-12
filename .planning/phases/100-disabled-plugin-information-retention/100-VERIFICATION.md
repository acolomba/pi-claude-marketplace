---
phase: 100-disabled-plugin-information-retention
verified: 2026-08-12T01:05:00Z
status: passed
score: 13/13 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 12/13
  gaps_closed:

    - "INV-04 is retired everywhere that asserted the no-reason clause, not just in one artifact."
  gaps_remaining: []
  regressions: []
human_verification:

  - test: "Install a plugin, disable it, remove its entry from the marketplace manifest, `/reload`, then run `/claude:plugin info <plugin>@<marketplace>`."
    expected: "The row reports `(disabled) {not in manifest}` with the retained description and component inventory (including hooks sourced from the record), and the plugin's hooks do not fire after `/reload`."
    why_human: "Spans the Pi extension host lifecycle, which no automated suite exercises. Explicitly scoped manual-only in `100-VALIDATION.md`, still pending per `100-05-SUMMARY.md`'s carriers (R7: status pending)."

  - test: "Run two concurrent `info` / `info --fetch` invocations against one scope."
    expected: "No interleaved partial read; each run reads one already-loaded state snapshot, because `list`/`info` acquire no lock and perform no write."
    why_human: "Marked `verification: backstop` in two PLAN.md frontmatter blocks (100-02, 100-04) -- no automated concurrency test was produced. LLM-judge assessment: structurally sound by inspection (no lock acquisition, no `saveState` call anywhere on the `list`/`info` path), but this is inference, not a test. Non-authoritative; human confirmation recommended."

  - test: "Confirm a disabled plugin's retained inventory is never presented as though its components are live."
    expected: "The disabled status token holds its position at the head of every rerouted row; description/component lines never displace or soften it."
    why_human: "Marked `verification: judgment` in 100-04-PLAN.md's prohibitions block. LLM-judge assessment: PASS by direct inspection -- every disabled-row byte fixture read during this verification keeps the `(disabled)` token in its existing position, with component/description lines rendered below it in the same slots an installed row uses. Non-authoritative; human confirmation recommended per the escalation protocol for judgment-tier prohibitions."
---

# Phase 100: Disabled-plugin information retention Verification Report

**Phase Goal:** Disabling a plugin deregisters its resources from Pi without discarding the
record's description of them, so `info` on a disabled plugin reports what the plugin contains
even when the marketplace manifest no longer declares it. (Operator decision 2026-08-11: a
disabled plugin's artifacts must be removed/deregistered, but its own descriptor stays; `info`
must not lose information and must still say the plugin is disabled.)

**Verified:** 2026-08-12T01:05:00Z
**Status:** human_needed (all 13 automated truths verified; 3 human-verification items remain open -- one pending manual UAT, two backstop-tier and judgment-tier items the plan authors themselves marked non-automatable)
**Re-verification:** Yes -- after gap closure (commit `27ae267`)

## Re-verification note

The initial pass (2026-08-12T00:35:36Z) found one gap: `.planning/REQUIREMENTS.md` line 55
(the ENBL-06 entry) still asserted the retired INV-04 "no reason brace" clause after ENBL-16
reversed it. Commit `27ae267` closed that gap and, while doing so, corrected two sibling lines
this verifier had not flagged: INV-04's own supersession note and ENBL-16's own opening sentence,
both of which said "no other reason may join that row" -- too absolute once WR-01 widened
`info.ts::DISABLED_ROW_REASONS` from one token to six. All three edits were re-verified against
the current code (not re-trusted from the commit message):

- **`info.ts::DISABLED_ROW_REASONS`** (`info.ts:946-952`) holds exactly six tokens: `not in
  manifest`, `source missing`, `unreadable`, `permission denied`, `network unreachable`,
  `authentication required`. Confirmed by direct read, matching the commit's claim exactly.

- **`list.ts::disabledReasonsField`** (`list.ts:348-350`) takes a single boolean (`notInManifest`,
  itself derived only from `ManifestLookup.kind === "absent"`, a manifest-read result) and returns
  either `{ reasons: ["not in manifest"] }` or `{}`. It reads no `compatibility.unsupported`, opens
  no file, and calls no probe. The claim "list builds its row from the record alone and runs no
  probe, so manifest absence is the only reason it can ever have" is TRUE -- confirmed by reading
  the full function body, not inferred from the docstring above it.

- Because that claim holds, the new REQUIREMENTS.md wording ("not a rendered-byte divergence...
  for every input the list surface can express, the two rows are identical") is also factually
  accurate, not merely plausible.

A repo-wide sweep for the retired "never carries a reason" / "no other reason" phrasing found
nothing else asserting it as CURRENT behavior in any production, test, or requirements artifact.
Two categories of near-miss were checked and ruled not-in-scope:

- `docs/output-catalog.md:338`, `tests/orchestrators/plugin/list-manifest-absent.test.ts:14`, and
  `tests/architecture/catalog-uat.test.ts:703` all reference the "no other reason" property, but
  each is scoped to the `list` surface specifically (where the property is still literally true,
  per the `disabledReasonsField` read above) or explicitly frames it as INV-04's retired clause
  being superseded, not as current unscoped fact.

- `.planning/milestones/**` and other historical phase artifacts (`95-REVIEW-FIX*.md`,
  `97-RESEARCH.md`, `100-RESEARCH.md`, `100-03-PLAN.md`) contain the old phrasing in a
  point-in-time-narrative context (documenting what was true when written, or quoting the
  now-superseded requirement to explain why it changed). These are historical records, not
  standing claims about current behavior, and are out of scope for a correctness sweep.

**One additional item was checked per the coordinator's specific request and found to be a
different class of staleness, correctly left alone:** the WR-05 fix report already flagged
`tests/orchestrators/plugin/list-manifest-absent.test.ts:178` ("ENBL-04: empty resources +
installable:true IS the disabled marker") as stale residue. That comment asserts the retired
ENBL-04/pre-ENBL-05 definition of what MARKS a record disabled (empty resources), not the INV-04
REASON clause this gap was about -- a different invariant entirely, and one ENBL-18 makes visibly
false (a disabled record can now have populated resources) rather than something ENBL-16 touches.
Confirmed harmless in practice: only two tests in that file seed `disabled: true`
(`list-manifest-absent.test.ts:452,480`, the two ENBL-16 reason-brace tests already verified in
the previous pass), and neither depends on a populated inventory, so the stale comment does not
threaten any pinned assertion. This is pre-existing technical debt the phase's own review process
already named and deliberately deferred (100-REVIEW-FIX.md), not a new or hidden defect. It is
noted here for the record but does not reopen the gap.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ENBL-10: install record carries a new top-level optional `hookEntries` key, additive, no `schemaVersion` bump, legacy record loads unchanged | ✓ VERIFIED | `persistence/state-io.ts:94-114`; COMPAT-01 key-set clause amended by one insertion; `tests/persistence/migrate.test.ts` no-fill clause green; `state-io.test.ts` 30/30 pass |
| 2 | ENBL-11: persisted payload is the supported subset only (event + optional matcher), no handler payload | ✓ VERIFIED | `PERSISTED_HOOK_ENTRY_SCHEMA` declares exactly `event`/`matcher`; `install.test.ts` 100/100 pass including the extended WR-03 hooks assertion |
| 3 | ENBL-12: `info` reads the record when present, falls back to the materialized-file read when absent, treats present-empty as a completed zero-entry read | ✓ VERIFIED | `info.ts:1120-1130` record-wins branch above `readStateOnlyHookEntries`; `info-manifest-absent.test.ts` 40/40 pass |
| 4 | ENBL-13: disable still unstages all five artifact kinds; only the record's description is retained | ✓ VERIFIED | `enable-disable.ts:363-379`; `enable-disable.test.ts` 40/40 pass including the hooks-only real-file-deletion test |
| 5 | ENBL-14: a disabled plugin's hooks are not hydrated on reload even when its `hooks.json` exists on disk | ✓ VERIFIED | `bridges/hooks/event-router.ts:600-609` guard; `event-router.test.ts` 25/25 pass, including the real-`hooks.json` suppression test and its `enabled:true` control |
| 6 | ENBL-15: a disabled list row renders byte-identically whether the retained inventory is populated or empty | ✓ VERIFIED | `list.ts` soft-dep derivations moved below the disabled early return; `list.test.ts` 75/75 pass including the ENBL-15 populated-vs-empty byte-pin |
| 7 | ENBL-16: a disabled row may carry `{not in manifest}` (list) plus the five failure-class reasons (info), and no reason describing suspended runtime behavior, on both surfaces; supersedes INV-04 | ✓ VERIFIED | `list.ts::disabledReasonsField`, `info.ts::applyDisabledRowShape`/`DISABLED_ROW_REASONS`; `list-manifest-absent.test.ts` 17/17, `info-manifest-absent.test.ts` 40/40 pass |
| 8 | ENBL-17: `info` on a disabled record routes through the shared block builder, reporting description and components, still `(disabled)`; fetch-skip note survives; zero network | ✓ VERIFIED | `info.ts` reroute; old `partitionDisabledScopes`/`buildDisabledInventoryBlock`/`DisabledScope` deleted (typecheck-enforced); `info.test.ts` 67/67, `info-manifest-absent.test.ts` 40/40, `catalog-uat.test.ts` 6/6 pass |
| 9 | ENBL-18: disable preserves all five `resources.*` arrays exactly; the producer type makes a change a compile error | ✓ VERIFIED | `state-io.ts::toDisabledRecord<R>` generic passthrough; `enable-disable.test.ts#ENBL-02 / ENBL-18` deep-equals the seeded populated inventory after disable |
| 10 | ENBL-19: enabling a disabled plugin owning a skill/command/agent succeeds; a genuine cross-plugin conflict is still rejected | ✓ VERIFIED | `install.ts:878-881` wraps the conflict-guard state in `removePluginRecord`; `shared.ts::removePluginRecord` single export; `shared.test.ts` 31/31, `enable-disable.test.ts` round-trip test pass |
| 11 | Operator ruling: disabled row hides unsupported-kind tokens but keeps the five failure-class reasons | ✓ VERIFIED | `DISABLED_ROW_REASONS` set in `info.ts:946-952`; pinned at `info-manifest-absent.test.ts:1131` (`{not in manifest}` with `lsp` suppressed) and `:1233` (`{not in manifest, source missing}` surviving) |
| 12 | All six code-review findings (CR-01, WR-01..WR-05) are fixed in the code, not just claimed in 100-REVIEW-FIX.md | ✓ VERIFIED | Commits `a0d4e816`,`fc2232e8`,`1e7005c9`,`66ec1f38`,`057f7f52`,`d14393d9` present in `git log`; each fix's code read directly and matches the fix report |
| 13 | INV-04 is retired everywhere that asserted the no-reason clause, not just in one artifact | ✓ VERIFIED | Commit `27ae267` rewrote all three stale entries (INV-04, ENBL-06, ENBL-16) in `.planning/REQUIREMENTS.md`. Both underlying factual claims (`DISABLED_ROW_REASONS`'s 6-token set; `disabledReasonsField`'s record-only, no-probe derivation) independently re-verified against the current code. Repo-wide sweep found no other artifact still asserting the retired clause as current behavior. |

**Score:** 13/13 truths verified (0 gaps; 0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `persistence/state-io.ts` | `hookEntries` key + generic `toDisabledRecord<R>` | ✓ VERIFIED | Both present, wired, tested |
| `bridges/hooks/event-router.ts` | `isRecordedButDisabled` hydrate guard | ✓ VERIFIED | Present, wired, mutation-checked test |
| `orchestrators/plugin/shared.ts` | single exported `removePluginRecord` + `NameOwner`-carrying `collectOwners` | ✓ VERIFIED | Present; two private copies deleted |
| `orchestrators/plugin/install.ts` | `removePluginRecord` wraps the conflict-guard state | ✓ VERIFIED | Present, wired |
| `orchestrators/plugin/list.ts` / `list.messaging.ts` | `disabledReasonsField`, threaded `p.reasons` in the surface's own render arm | ✓ VERIFIED | Present |
| `orchestrators/plugin/info.ts` / `info.messaging.ts` | `applyDisabledRowShape`, `skipReasonFor`, `DISABLED_ROW_REASONS`, single-list `emitFetchSkip`; unreachable disabled arm deleted | ✓ VERIFIED | All present; deletions typecheck-enforced |
| `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` | `disabled-inventory-not-in-manifest` and `state-only-disabled-with-components` catalog states with paired fixtures | ✓ VERIFIED | Both states present in both files; `catalog-uat.test.ts` 6/6 pass |
| `.planning/REQUIREMENTS.md` | ENBL-10..19 rows, INV-04 superseded, no sibling entry asserts the retired clause | ✓ VERIFIED | ENBL-10..19 rows and traceability table present and correct; INV-04, ENBL-06 and ENBL-16 all now state the reversed clause accurately (commit `27ae267`) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `event-router.ts` | `state-io.ts` | `isRecordedButDisabled` import + call | ✓ WIRED | Confirmed by grep and by a real-`hooks.json` test that would fail if the guard were absent |
| `install.ts` | `shared.ts` | `removePluginRecord(state, marketplace, plugin)` | ✓ WIRED | Confirmed by grep and by the enable/disable/enable round-trip test |
| `install.ts` / `update.ts` / `reinstall.ts` | `state-io.ts` | write `hookEntries` at all three ledger write sites | ✓ WIRED | Confirmed by grep counts and by `install.test.ts` deep-equal assertion |
| `info.ts` | `domain/components/hooks.ts` | `hookSummaryEntriesFromPersisted` | ✓ WIRED | Confirmed import and call site above `readStateOnlyHookEntries` |
| `list.ts` | `shared/notify.ts` | `PluginDisabledMessage.reasons` threaded through `list.messaging.ts`'s own disabled arm | ✓ WIRED | Confirmed -- the exact messaging-dispatch trap flagged in the verification brief, caught by the executor in Plan 03's own deviation log and independently re-confirmed here |
| `docs/output-catalog.md` | `tests/architecture/catalog-uat.test.ts` | shared `catalog-state:` identifier | ✓ WIRED | Both new states present under matching identifiers in both files; `catalog-uat.test.ts` passes |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full project test suite (minus 2 known env failures) | `npm run check` | 16/18 integration tests pass; the 2 failures are the documented `provenance-invisibility` / `skill-path-resolution` pi-subagents global-peer issue, reproduced identically on unmodified `main` | ✓ PASS |
| Touched unit/integration suites | `node --test` per file (state-io, event-router, shared, plan, enable-disable, install, update, reinstall, list, list-manifest-absent, info, info-manifest-absent, migrate) | All green, 0 failures across ~700+ tests in these files | ✓ PASS |
| Architecture gates | `node --test 'tests/architecture/**/*.test.ts'` | 352/353 pass, 1 pre-existing skip, 0 fail | ✓ PASS |
| Catalog byte contract | `node --test tests/architecture/catalog-uat.test.ts` | 6/6 pass | ✓ PASS |
| Re-verification regression check (after commit `27ae267`) | `node --test tests/orchestrators/plugin/list-manifest-absent.test.ts tests/orchestrators/plugin/info-manifest-absent.test.ts` | 57/57 pass | ✓ PASS |
| Debt-marker scan on all phase-touched production files | `grep -E "TBD\|FIXME\|XXX\|TODO"` | 0 matches | ✓ PASS |
| Git working tree clean, all commits present | `git status`, `git log` | Clean; all commits resolve including gap-closure commit `27ae267` | ✓ PASS |

### False-Green Risk Checks (per verification brief)

Both named failure modes from the verification brief were specifically probed:

1. **Fixtures hard-coding `resources: {}` on the disabled branch.** Checked the three seeders
   directly: `list.test.ts::seedMarketplace` and `info-manifest-absent.test.ts::seedPathMarketplace`
   both confirmed to build `resources` from `override ?? defaults`, independent of the disabled
   flag. `enable-disable.test.ts`'s primary ENBL-18 test exercises the REAL disable path against a
   seeded populated-and-enabled record rather than reading a pre-built disabled fixture. Three other
   seeders (`seedRealDisabledMarketplace`, the private seeder in `list-manifest-absent.test.ts`,
   `seedPathMarketplace` in `info.test.ts`) still hard-code empty resources on their disabled branch
   but are confirmed not used by any pinned retention/reason test.

2. **The `*.messaging.ts` dispatch trap.** Confirmed all four disabled-row-owning surfaces
   (`list.messaging.ts`, `info.messaging.ts`, `enable-disable.messaging.ts`,
   `reconcile/reconcile.messaging.ts`) thread `p.reasons` or had their now-unreachable arm deleted.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ENBL-10 | 100-02 | hookEntries key, additive, no schema bump | ✓ SATISFIED | See truth #1 |
| ENBL-11 | 100-02 | supported-subset payload | ✓ SATISFIED | See truth #2 |
| ENBL-12 | 100-02 | record-wins read ladder | ✓ SATISFIED | See truth #3 |
| ENBL-13 | 100-01 | disable still unstages all 5 kinds | ✓ SATISFIED | See truth #4 |
| ENBL-14 | 100-01 | hydrate suppression for disabled | ✓ SATISFIED | See truth #5 |
| ENBL-15 | 100-03 | byte-identical disabled list row | ✓ SATISFIED | See truth #6 |
| ENBL-16 | 100-03 / 100-04 / 100-05 | `{not in manifest}` on both surfaces, supersedes INV-04 | ✓ SATISFIED | See truths #7, #13 |
| ENBL-17 | 100-04 / 100-05 | info reroute through shared block builder | ✓ SATISFIED | See truth #8 |
| ENBL-18 | 100-01 | disable preserves inventory, compile-error producer | ✓ SATISFIED | See truth #9 |
| ENBL-19 | 100-01 | enable self-conflict exclusion | ✓ SATISFIED | See truth #10 |

All 10 phase requirement IDs are declared in `.planning/REQUIREMENTS.md`'s requirement list and
traceability table, mapped to Phase 100, marked Complete. No orphaned requirements found. The
phase-init discrepancy noted by the orchestrator (init reported ENBL-10..16, ROADMAP additionally
assigns ENBL-17/18/19) is resolved: all ten IDs are present, implemented and tested.

### Anti-Patterns Found

No `TBD`/`FIXME`/`XXX`/`TODO` markers in any phase-touched production file. No stub patterns, no
hardcoded-empty stubs feeding rendered output.

### Gaps Summary

None remaining. The single gap from the initial pass (a stale `REQUIREMENTS.md` line asserting the
retired INV-04 no-reason clause) is closed by commit `27ae267`, along with two sibling lines the
same commit found and fixed. Both edits were independently re-verified against the current code
rather than trusted from the commit message.

### Human Verification Required

1. **Manual end-to-end UAT** (recorded by the phase itself as manual-only, still pending)
   **Test:** Install a plugin, disable it, remove its entry from the marketplace manifest,
   `/reload`, then run `/claude:plugin info <plugin>@<marketplace>`.
   **Expected:** The row reports `(disabled) {not in manifest}` with the retained description and
   component inventory (including hooks sourced from the record), and the plugin's hooks do not
   fire after `/reload`.
   **Why human:** Spans the Pi extension host lifecycle, which no automated suite exercises
   (explicitly scoped manual-only in `100-VALIDATION.md` and repeated in `100-05-SUMMARY.md`'s
   carriers, status `pending`).

2. **Concurrent-access backstop truths** (`verification: backstop`, two PLAN.md frontmatter entries)
   **Test:** Run two concurrent `info` / `info --fetch` invocations against one scope.
   **Expected:** No interleaved partial read; each run reads one already-loaded state snapshot,
   because `list`/`info` acquire no lock and perform no write.
   **Why human:** Architectural-by-design claims rather than claims proven by a concurrency test;
   the plan authors marked them `verification: backstop` themselves, meaning no automated evidence
   was produced. LLM-judge assessment: structurally sound (network-free, lock-free, no `saveState`
   call anywhere on this path), but this is inference, not a test.

3. **Judgment-tier prohibition** (100-04-PLAN.md, `verification: judgment`, `status: resolved`)
   **Test:** Confirm a disabled plugin's retained inventory is never presented as though its
   components are live.
   **Expected:** The disabled status token holds its position at the head of every rerouted row;
   description/component lines never displace or soften it.
   **Why human:** Marked judgment-tier by the plan itself. LLM-judge assessment: PASS by direct
   inspection -- every disabled-row byte fixture read during this verification keeps the
   `(disabled)` token in its existing position. Non-authoritative; human confirmation recommended
   per the escalation protocol for judgment-tier prohibitions.

---

_Verified: 2026-08-12T01:05:00Z_
_Verifier: Claude (gsd-verifier)_
