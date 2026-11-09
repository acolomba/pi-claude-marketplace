---
milestone: behavioral-gaps
audited: 2026-11-08
status: tech_debt
scores:
  requirements: 34/34
  phases: 16/16
  integration: 11/11
  flows: 16/16
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: milestone
    items:
      - "Adapter-profile order-dependent flakes: status: resolved by d04a5106 (shared Pi replaced after it decides project trust); session .planning/debug/resolved/adapter-profile-parallel-flakes.md"
      - "Full `npm run check` not re-run on the committed head; the debugger's exit-0 run was on 02d1ae7d plus the identical three-file diff"
      - "SUMMARY frontmatter lacks requirements_completed for phases 4, 6 (plans 01-02) and 10; VERIFICATION.md covers TFAIL-01, SEND-01, TOOL-01..03 with evidence"
      - "roadmap.analyze reports phases 1, 4, 6 as disk_status executed (init counts 13/16 complete) although ROADMAP and VERIFICATION mark them complete and passed"
  - phase: 01-foundation
    items:
      - "Stray write to the real ~/.pi/agent/pi-claude-marketplace/cache/plugins/valid-marketplace.json on every npm run check; writer unknown (P1-DC-53, P1-DC-68)"
      - "layout.md:214 seed title drift for the Phase 12 cancel scenario (Low)"
  - phase: 06-sessionend-hooks
    items:
      - "Deferred: CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS and a bounded SessionEnd wait (D-BG-605, SESSIONENDENV-01); SessionEnd failure notice unpinned (HOOKERRNOTE-01)"
  - phase: 13-prune
    items:
      - "Known divergence: a pruned disabled dependency keeps its enabled: false declaration (PRUNECFG-01, D-BG-1309)"
  - phase: backlog
    items:
      - "25 open BACKLOG entries added by this milestone (LOCKFLIPSUBJECT-01, STATEREAD-01, STATEVER-01, BROWSESCOPE-01, DFLOWGAPS-01, DFLOWREASON-01, CLOSEDLIST-01, HOOKPRECOMPACT-01, SESSIONENDENV-01, RPCENDNOTICE-01, PRUNECFG-01, PLUGALIAS-01, PRUNEISLAND-01, REDACTPOINTER-01, AUTOAPPLYDEFAULTOFF-01, ASYNCPRINT-01, ASYNCSUMJSON-01, ASYNCMISSING-01, ASYNCPIDS-01, ASYNCMIDTURN-01, ASYNCSANITIZE-01, ASYNCRUNTIME-01, ASYNCNEWSESSION-01, AMIGTRUST-01, WORKERHOMEDIR-01); HKTO-01 closed by Phase 6"
nyquist:
  compliant_phases: [1, 5, 6, 7, 13, 15]
  partial_phases: []
  not_validated_phases: [2, 3, 4, 8, 9, 10, 11, 12, 16]
  missing_phases: [14]
  overall: partial
---

# behavioral-gaps Milestone Audit

**Status:** tech_debt. All 34 requirements are satisfied, all 16 phases passed verification, and the cross-phase integration check found no critical gap. The remaining items are deferred work, metadata drift, and Nyquist coverage TODOs.

## Requirements (3-source cross-reference)

| REQ-IDs | Phase | VERIFICATION | SUMMARY frontmatter | REQUIREMENTS.md | Final |
| --- | --- | --- | --- | --- | --- |
| FND-01, FND-02 | 1 | passed | listed | [x] | satisfied |
| ASYNC-01..05 | 2 | passed | listed | [x] | satisfied |
| STOPF-01 | 3 | passed | listed | [x] | satisfied |
| TFAIL-01 | 4 | passed | missing | [x] | satisfied (VERIFICATION line 70 evidence; frontmatter gap) |
| PCOMP-01 | 5 | passed | listed | [x] | satisfied |
| SEND-01 | 6 | passed | listed (06-03) | [x] | satisfied |
| STMIG-01, STMIG-02 | 7 | passed | listed | [x] | satisfied |
| CFGMIG-01, CFGMIG-02 | 8 | passed | listed | [x] | satisfied |
| AMIG-01, AMIG-02 | 9 | passed | listed | [x] | satisfied |
| TOOL-01..03 | 10 | passed | missing | [x] | satisfied (VERIFICATION truths 1-4 evidence; frontmatter gap) |
| DFLOW-01..04 | 11 | passed | listed | [x] | satisfied |
| BROWSE-01, BROWSE-02 | 12 | passed | listed | [x] | satisfied |
| PRUNE-01, PRUNE-02 | 13 | passed | listed | [x] | satisfied |
| BOOT-01, BOOT-02 | 14 | passed | listed | [x] | satisfied |
| MLOCK-01, MLOCK-02 | 15 | passed | listed | [x] | satisfied |
| CHILD-01, CHILD-02 | 16 | passed | listed | [x] | satisfied |

TFAIL-01 and TOOL-01..03 read as "partial" under the matrix because their SUMMARYs omit `requirements_completed`. Each VERIFICATION.md states the requirement with per-criterion evidence and red proofs, so the audit counts them satisfied and records the frontmatter gap as debt. No orphaned requirement.

## Integration (gsd-integration-checker)

| Check | Result |
| --- | --- |
| Frozen-file contract | Only `features/lib/pi-process.ts`, `features/support/pi-process.ts`, `features/support/isolated-pi-home.ts` changed after Phase 1, in the sanctioned flake fixes `bda26b08` and `d04a5106` |
| Product fixes compose | `tsc --noEmit` clean; hook events, router, dispatch-exec, and payloads consistent for PostToolUseFailure, PostCompact, SessionEnd, StopFailure, async rewake |
| Scenarios present | Every REQ's feature file exists; cucumber `--dry-run` resolves adapter 1779 scenarios and builtin 153 with no undefined or ambiguous step |
| Harness registration | `cucumber.json` globs pick up every new step module; the CI behavioral legs cover every feature directory |

## Tests

- Adapter profile 1779/1779 twice, builtin 153/153, `npm run check` exit 0 — the debugger's runs on `02d1ae7d` plus the three-file fix diff now committed as `d04a5106`.
- CI timing check against the 15-minute behavioral job timeouts (D-CF1-16) is still owed (handoff close step 3).

## Nyquist coverage

| Phase | VALIDATION.md | Status | Action |
| --- | --- | --- | --- |
| 1, 5, 6, 7, 13, 15 | exists | COMPLIANT | — |
| 2, 3, 4, 8, 9, 10, 11, 12, 16 | exists, `status: draft` | NOT-VALIDATED | `/gsd-validate-phase N` |
| 14 | missing | MISSING | `/gsd-validate-phase 14` |

NOT-VALIDATED is a coverage TODO, not a compliance failure (#2117).

## Tech debt

See frontmatter `tech_debt`. Highest-value items: the unknown writer to the real `~/.pi` (P1-DC-53), the 25 milestone BACKLOG entries, and a fresh `npm run check` on the committed head.
