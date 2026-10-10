---
milestone: json-output
milestone_name: Mode-Keyed Presentation Strategies
audited: 2026-10-10
re_audit_of: 70b4c7e3
status: tech_debt
scores:
  requirements: 36/36
  phases: 8/8
  integration: 15/15 seams wired
  flows: 8/8 end-to-end flows traced
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 04-wire-schema-and-json-strategy
    items:
      - "deferred-items.md (still `open`, no BACKLOG carrier): the LLM plugin tool returns `Failed to load plugin list: ${errorMessage(err)}` as tool content when the payload load throws, so `redactCredentials` never sees it. The thrown value today is a `state.json` read error naming a file, not a credential. Out of PMOD-04 scope by design. The prior audit asked for a carry-or-close decision; phase 08 did not take one."
  - phase: 01-presentation-model
    items:
      - "Nyquist PARTIAL by accepted decision (08 D-11): `01-VALIDATION.md` keeps `nyquist_compliant: false` with its checkbox unticked, because a full unit run took 404 s against a 180 s feedback target. Every mapped test row is green."
  - phase: cross-cutting
    items:
      - "VERIFICATION digests for phases 01-07 read `stale` (08 D-12): later phases edited the shared notification modules after each digest. No file under extensions/, docs/ or schema/ changed since 70b4c7e3, and `npm run check` is green at 76abf211."
      - "DEPADV-01 (carried in BACKLOG.md): the nested `@earendil-works/pi-coding-agent/node_modules/brace-expansion@5.0.9` stays pinned by Pi's shrinkwrap. The root entry is at 5.0.12; `npm audit` reports only the nested node."
      - "DEF-08-04-01 (upstream tooling, out of scope): `gsd-tools windows status --pick` fails when stdout is a pipe because the JSON exceeds the pipe buffer. `/gsd-ship` reads `--raw` with jq and is unaffected."
  - phase: integration
    items:
      - "MODE-03 print-mode browse refusal passes `usage: \"\"` to `usage-error`; intentional and pinned by `tests/shared/notification-grammar.test.ts:1612-1623`. A future renderer change could trip it."
nyquist:
  compliant_phases: ["02", "03", "04", "05", "06", "07", "08"]
  partial_phases: ["01"]
  not_validated_phases: []
  missing_phases: []
  overall: partial
---

# Milestone Audit: json-output — Mode-Keyed Presentation Strategies

**Audited:** 2026-10-10 (re-audit after Phase 08)
**Branch:** `features/json` at `09ae5ea2`
**Prior audit:** `70b4c7e3`, status `tech_debt`
**Status:** `tech_debt`. All 36 requirements are satisfied, every seam is
wired, and the WINDOWS.md ledger reads zero open. One deferred item from
phase 04 still has no disposition; the rest is accepted or carried.

## What changed since the prior audit

Phase 08 closed the prior audit's action list:

| Prior action | Outcome |
| --- | --- |
| 1. Close ledger entry 85 | `fixed` (`update.test.ts`: 66 pass, 0 fail) |
| 2. Dispose entries 88 and 89 | 88 `waived` (accepted design), 89 `fixed` (resolver order) |
| 3. Dispose the 23 inherited entries | 32-34 and 41-58 `waived` (#236, #202); 84 `waived` to WOUT-01 |
| 4. Decide the two deferred items | 07 brace-expansion: root fixed, residual carried as DEPADV-01. **04 tool error text: undecided, still `open`.** |
| 5. Reconcile 01 and 03 VALIDATION | 03 now `true`; 01 stays `false` by decision D-11 |

Ledger: `open 0 / waived 50 / fixed 39 / total 89`.

Code outside `.planning/` changed in three files only: `package-lock.json`
(root `brace-expansion` 5.0.9 to 5.0.12) and the two pi-subagents resolver
tests. Nothing under `extensions/`, `docs/` or `schema/` changed.

## Requirements Coverage (3-source cross-reference)

Unchanged from the prior audit. `REQUIREMENTS.md` ticks all 36 IDs; every ID
appears in a `passed` VERIFICATION.md table and in SUMMARY
`requirements-completed` frontmatter. Phase 08 maps no requirement IDs by
design (ROADMAP: "traceability lives in WINDOWS.md and BACKLOG.md").

| Requirement | Phase | Status |
| --- | --- | --- |
| PMOD-01, PMOD-03 | 1 | satisfied |
| PMOD-02, PMOD-05 | 2 | satisfied |
| TEXT-01, RAWS-01 .. RAWS-05 | 3 | satisfied |
| PMOD-04, WIRE-01, 03, 04, 05, 06, 08, 09, JOUT-02, LLMT-01 | 4 | satisfied |
| JOUT-01, JOUT-05, MODE-01, MODE-02, TENB-01, TENB-02 | 5 | satisfied |
| WIRE-02, WIRE-07, JOUT-03, JOUT-04 | 6 | satisfied |
| MODE-03, MODE-04, TENB-03, JDOC-01 .. JDOC-03 | 7 | satisfied |

**36/36 satisfied. No orphans.**

## Phase Verification

| Phase | Plans | Verification | Score |
| --- | --- | --- | --- |
| 01 presentation-model | 16/16 | passed, digest `stale` | 5/5 |
| 02 row-policies | 2/2 | passed, digest `stale` | 5/5 |
| 03 typed-raw-surfaces | 4/4 | passed, digest `stale` | 11/11 |
| 04 wire-schema-and-json-strategy | 6/6 | passed, digest `stale` | 5/5 |
| 05 mode-selected-json-sink | 7/7 | passed, digest `stale` | 6/6 |
| 06 command-run-contract | 4/4 | passed, digest `stale` | 15/15 |
| 07 mode-refusals-real-pi-verification-and-docs | 6/6 | passed, digest `stale` (D-12) | 31/35 automated, 7/7 human |
| 08 address-tech-debt-ledger-dispositions-and-advisory | 4/4 | passed (2026-10-10) | 5/5 |

No phase reports `gaps_found`; none lacks a VERIFICATION.md.

## Cross-Phase Integration

Checker: `gsd-integration-checker` (sonnet), read-only, `npm run typecheck`
clean, at `09ae5ea2`.

| Seam | Status | Evidence |
| --- | --- | --- |
| 13 seams from the prior audit | wired | `extensions/`, `docs/`, `schema/` byte-identical since `70b4c7e3`; spot-checked `notification-dispatch.ts:154,161` (`toWirePayload`, `appendEntry("claude-plugin", ...)`) and `register.ts:152` → `command-run.ts:14` |
| `async-rewake-summary` hook producer → sink | wired | `bridges/hooks/async-rewake/registry.ts:442-443` opens a `hook` run, then `emitHookSurface` (`notification-dispatch.ts:356`) → `emitPresentation` → `appendEntry` in json/rpc, `ctx.ui.notify` in tui/print. Tested in json and rpc by `tests/bridges/hooks/async-rewake/registry.test.ts:50-91` |
| `stop-override-cap` hook producer → sink | wired | `bridges/hooks/settle.ts:156,393` → `notification-dispatch.ts:385` → same path. Tested by `tests/bridges/hooks/settle.test.ts:148-152` (json, rpc, append refusal, stale sink, stale mode) |

The two hook seams close the prior audit's open integration item, which had
rested on phase 03's verification alone.

### End-to-end flows

| Flow | Status |
| --- | --- |
| 6 flows from the prior audit (install in json, throw in rpc, usage error in print, browse in json, device flow in print, reconcile aborted in json) | complete, unchanged tree |
| Async-rewake exit → json/rpc entry or tui/print notify | complete, test-proven |
| Stop-hook override cap → json/rpc entry or tui/print notify | complete, test-proven |

### Phase 08 test integration

| File | Peer installed | `PI_SUBAGENTS_ROOT=/nonexistent` |
| --- | --- | --- |
| `tests/integration/provenance-invisibility.test.ts` | 1 pass, 0 skipped | 0 pass, 1 skipped |
| `tests/integration/skill-path-resolution.test.ts` (SC-2 / AGSK-06) | 1 pass, 0 skipped | 0 pass, 1 skipped |

## Nyquist Coverage

| Phase | `status` | `nyquist_compliant` | Grade |
| --- | --- | --- | --- |
| 01 | validated | false | PARTIAL (accepted, D-11: 404 s run vs 180 s target) |
| 02 - 08 | validated | true | COMPLIANT |

## Quality Gate

`npm run check` exit 0 at `76abf211` (phase 08 regression gate), which
already contains the two review-fix test commits. Commits after it touch
`.planning/` only; `npm run typecheck` is clean at `09ae5ea2`.

## Verdict

`tech_debt`, no blockers. Before `/gsd-complete-milestone`:

1. Decide the phase 04 deferred item (LLM tool error text outside redaction):
   carry it to BACKLOG.md with an ID, or close it as accepted and mark it so
   in `04-.../deferred-items.md`. It is the only item from the prior action
   list without a disposition.

Everything else is accepted by a recorded decision (D-11, D-12) or carried
(DEPADV-01, WOUT-01).
