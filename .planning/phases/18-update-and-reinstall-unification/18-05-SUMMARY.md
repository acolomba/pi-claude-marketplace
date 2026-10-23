---
phase: 18-update-and-reinstall-unification
plan: 05
subsystem: orchestrators/plugin (reinstall tests), orchestrators/reconcile (backfill tests)
tags: [reinstall, backfill, unit-tests, rei-04, d-18-17]
requires:
  - phase: 18-update-and-reinstall-unification
    provides: "reinstall on the shared runner (18-02) and the deleted replace machinery (18-04)"
provides:
  - "The non-git reinstall unit pins that 18-02 deleted, rewritten to the shared-runner semantics"
  - "A D-18-17 pin: a recorded plugin the manifest no longer declares fails every other reinstall in its scope as unreadable"
  - "The D-18-18 pin on the existing clean-record degrade case"
  - "A D-18-12 pin: a backfill promotion records the version the marketplace offers now"
affects: [18-06 retry proofs, 18-07 git-source pins and the enable-disable D-68-02 sweep]
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: 386bcda9
plan_head_after: self # the task 2 commit, which also adds this file; a file cannot name its own hash
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - test/orchestrators/plugin/reinstall-flow.test.ts
    - test/orchestrators/reconcile/backfill.test.ts
key-decisions:
  - "PRL-13 / PRL-15 now remove the bad plugin's directory instead of dropping it from the manifest, because a dropped record fails every sibling as unreadable (D-18-17); the dropped-record fixture became the new D-18-17 case"
requirements-completed: [REI-04, UPR-01]
duration: 25min
completed: 2026-10-23
status: complete
---

# Phase 18 Plan 05: Reinstall unit pins on the shared runner Summary

**Fifteen reinstall-flow cases are back or new, each asserting the
shared-runner behavior in full: REI-04's version on the outcome, record, and
row with D-18-09's carry-forward, the not-in-manifest and no-longer-installable
skips, the PI-6 agent refusal as phase-3 `rollback partial`, the D-18-17
fail-closed walk, and the warning split. Backfill gained a D-18-12 version
pin.**

## Re-added cases (original line in `9f126315:test/orchestrators/plugin/reinstall-flow.test.ts`)

| Original line | New title |
| ------------- | --------- |
| 10385 | PRL-08 / PRL-11 / REI-04: a reinstall records the version its source now declares, keeps installedAt and provenance, removes plugin data, and renders the exact row |
| 1146 | PRL-10: a plugin missing from the cached manifest is skipped and leaves state, resources, and data unchanged |
| 2160 | GAP-03: reinstallPlugin render=none returns a not-in-manifest skip without notifying |
| 5411 | PRL-10: a source that stopped being installable skips the reinstall with the typed reason |
| 941 | PDEF-01: reinstall preview detects an agent conflict from a later resolved directory |
| 790 | AGENT-01 / D-18-10: a reinstall refuses a file no index row names at its new agent target and keeps the legacy and foreign bytes |
| 1786 | PRL-13: a bulk reinstall continues past a plugin it can no longer resolve |
| 2048 | PRL-15: batch soft dependency markers ride only the reinstalled row |
| 2128 | GAP-02: a bulk reinstall of a plugin the manifest no longer declares renders a not-in-manifest skip |
| 1004 | PDEF-01: reinstall stages every agent directory |
| 6217 | NREG-01: a hygiene-only reinstall carries neither notes nor discoveryWarnings |
| 6255 | D-141-03: a reinstall carries its discovery warning on notes and drops the agents hygiene warning |
| 10325 | PRL-03: a bulk cascade forwards the state-transaction seam to every per-plugin reinstall |

New cases:

- reinstall-flow.test.ts: "D-18-17: a recorded plugin the manifest no longer
  declares fails every other reinstall in its scope as unreadable".
- backfill.test.ts: "BFILL-01 / D-18-12: a promotion records the version the
  marketplace offers now".

Retitled (D-18-18): the existing "BFILL-01 / D-68-02 partial" case (original
line 3895) is now "BFILL-01 / D-18-06 / D-18-18: a reinstall of a clean record
whose source now resolves partially records it as partial", with a
precondition assertion that the record is `installable: true` with an empty
`unsupported` list before the reinstall. "BFILL-01 / D-68-02 full" is now
"BFILL-01 / D-18-06 full".

## Pinned values (read back and checked against each bullet)

- PRL-08: outcome and record at 9.9.9, `installedAt` and `provenance` equal
  the pre-call record's, data directory gone, exactly one notification
  `● mp [project]\n  ● hello v9.9.9 (reinstalled)\n\n/reload to pick up changes`.
- PRL-10 missing entry: `{ skipped, notes: ["not in manifest"], reasons:
  ["not in manifest"] }`; the standalone row is a `warning`:
  `A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello (skipped) {not in manifest}`.
- PRL-10 not installable: reasons `["no longer installable"]`, the note is the
  resolver's `unsupported source kind` text, one `warning` row
  `{no longer installable}`, and a clone-cache seam whose four members record
  their calls saw none.
- AGENT-01 / D-18-10: notes `[<aggregate>, "agents: Cannot replace agent
  target with non-previous content at <newTarget>"]`, reasons `["rollback
  partial"]`, `cause` a `PluginUpdatePhase3Error`, `rollbackPartial` one agents
  child; foreign, legacy, and agents-index bytes unchanged; the record equals
  the pre-call record apart from the intent-mark `compatibility` and
  `updatedAt`.
- D-18-17: `bad` skipped `{not in manifest}`; `good` failed `{unreadable}`
  with a `DependencyDeclarationsUnreadableError` cause (`declarer: "bad@mp"`),
  the cascade at `error` with the cause line `cannot read the dependencies of
  bad@mp: not declared by its marketplace`; state.json, good's agent file, and
  `mcp-adapter.json` byte-identical.
- PRL-13 / PRL-15: `["bad:skipped", "good:reinstalled"]`, the cascade at
  `warning` with `Plugin reinstall: 1 warning, 1 success`; good's row carries
  `{requires pi-subagents, requires pi-mcp-adapter}` and bad's carries none.
- PRL-03: four saves for two plugins (intent mark plus finalize each).
- BFILL-01 / D-18-12: the promotion outcome and the record at 1.1.0, with
  `installedAt` unchanged.

## Verification

- Task 1: `npm run test:coverage:direct -- .../reinstall-flow.ts` exit 0;
  the whole file 125/125. Commit hook passed.
- Task 2: direct coverage for `reinstall-flow.ts` and `backfill.ts` exit 0;
  `npx fallow dupes --quiet --fail-on-issues` exit 0; `npx tsc --noEmit`
  clean.
- Acceptance greps: `D-68-02` in reinstall-flow.test.ts 0; the D-18-17 title
  1; `D-18-18` 1; `BFILL-01 / D-18-12` in backfill.test.ts 1;
  `PRL-08 / PRL-11 / REI-04` 1; the AGENT-01 / D-18-10 title 1; the GAP-11 /
  RINST-01 title 1.
- Plan gate: `npm run check` exit 0 on the final tree (Node v26.12.1), run
  with exactly the files the task 2 commit stages: static checks, unpaired
  tests, integration, 718/718 cucumber scenarios, direct coverage for all
  pairs (279 records merged).

## Deviations from Plan

1. **[Rule 1 - stale comments and titles] More stale text than the plan
   listed.** Beyond the LIFE-01 banner, the BFILL-01 banner and titles, and
   the WLIF-06 comment, these named deleted reinstall machinery: the GAP-04
   title and comment (`errorWithManualRecovery`, `replaceAll`,
   `rollbackReplacements`), the GAP-06 title and comment (`prepareAllHandles`,
   `errorWithManualRecovery`), the WR-03 banner and its post-condition comment
   ("the per-plugin lock"), the SUB-02 banner (`prepareAllHandles`), and the
   two WR-03 fixture comments ("per-plugin lock", "reinstall ledger"). Each now
   describes the shared swap; every assertion is unchanged. GAP-04's new
   comment was checked: the failed note is the bare save error.
2. **PRL-10 not-installable seam.** The four clone-cache members record their
   calls and reject, and the case asserts the call list is empty. A member
   that threw an assertion error could be caught by the preflight and
   classified, so the recorded list is the observation that cannot be
   swallowed.
3. **AGENT-01 / D-18-10 record assertion** compares the record with its
   `updatedAt` stamp removed on both sides, because the intent-mark write
   restamps it.

## Needs the user's attention

- **Phase-3 recovery hint text.** The `rollback partial` aggregate reads
  `Plugin "hello" failed during physical replace. plugin-uninstall +
  plugin-install for "hello".` D-18-10 says the hint for a reinstall is to run
  `reinstall` again; the hint is the PUP-6 marker
  (`RECOVERY_PLUGIN_REINSTALL_PREFIX`) that the shared swap appends for both
  verbs. The AGENT-01 case pins today's text. It was left as is, because the
  marker is a drift-guarded user contract outside this plan's files.
- The PURL-07 banner above the git-source section of reinstall-flow.test.ts
  still says reinstall pins from the recorded sha; Plan 07 owns that section.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: test/orchestrators/plugin/reinstall-flow.test.ts (contains "PRL-08 / PRL-11 / REI-04")
- FOUND: test/orchestrators/reconcile/backfill.test.ts (contains "BFILL-01 / D-18-12")
- FOUND: 655fd223 (task 1); task 2 is the commit that adds this file
