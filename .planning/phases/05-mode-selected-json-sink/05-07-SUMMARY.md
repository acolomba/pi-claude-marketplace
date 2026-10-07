---
phase: 05-mode-selected-json-sink
plan: "07"
subsystem: testing
tags: [json, rpc, catalog, transport, validation]
requires:
  - phase: 05-mode-selected-json-sink
    provides: Completed transport and lifecycle owners from plans 05-01 through 05-06
provides:
  - Actual JSON/RPC transport coverage for all 260 catalog tuples and eight raw kinds
  - Passing full-tree, strict corpus, catalog, schema, and transient lint evidence
  - Explicit outstanding TENB-02 fixture correction for the owning executor
affects: [phase-verification, explicit-context-modes]
actuals:
  tokens: 25564
  tasks: 1
  commits: 2
plan_head_before: b9852e84db55c3f89452c751cbda5a9bfad04cc2
plan_head_after: acff6d6c9d4078231eb48958c379dbd9360a04f1
tech-stack:
  added: []
  patterns: [Existing retaining JSON capture with reused catalog snapshots]
key-files:
  created:
    - .planning/phases/05-mode-selected-json-sink/05-07-red.json
    - .planning/phases/05-mode-selected-json-sink/05-07-SUMMARY.md
  modified:
    - tests/architecture/catalog-uat/catalog-wire.test.ts
    - .planning/phases/05-mode-selected-json-sink/05-VALIDATION.md
key-decisions:
  - Do not certify TENB-02 or SC5 while nine context fixtures omit mode behind casts.
  - Preserve assigned file ownership and return the missing-mode correction to the parent.
patterns-established: []
requirements-completed: ["MODE-01", "MODE-02", "JOUT-01", "JOUT-05", "TENB-01", "TENB-02"]
coverage:
  - id: D1
    description: All catalog tuples and raw kinds reach exclusive machine transport
    requirement: JOUT-01
    verification:
      - kind: unit
        ref: tests/architecture/catalog-uat/catalog-wire.test.ts
        status: pass
      - kind: other
        ref: npm run check at ee1c4362
        status: pass
    human_judgment: false
  - id: D2
    description: Current-tree gates and unchanged text baseline are recorded
    verification:
      - kind: other
        ref: npm run check at ee1c4362
        status: pass
      - kind: other
        ref: node scripts/notify-corpus.mjs check plus strict saved-log assertions
        status: pass
      - kind: other
        ref: git diff --exit-code 26cb0056 -- docs/output-catalog.md
        status: pass
    human_judgment: false
  - id: D3
    description: Every context fixture explicitly supplies its required mode
    requirement: TENB-02
    verification:
      - kind: other
        ref: Context construction audit of tests/bridges/hooks/if-field/index.test.ts
        status: fail
    human_judgment: true
    rationale: Nine casts still hide absent modes; the owning executor must correct them before verification.
duration: 16min
completed: 2026-10-07
status: halted
---

# Phase 05 Plan 07: Catalog Transport and Final Evidence Summary

**All 260 catalog states and eight raw kinds have JSON/RPC transport proof;
the final audit exposes nine context fixtures that still omit mode.**

## Performance

- Started: 2026-10-07T14:03:59Z.
- Evidence completed: 2026-10-07T14:19:49Z.
- Tasks: 1/2 accepted; Task 2's checks and evidence record are complete, but
  its all-requirements acceptance criterion is blocked.
- Files: one test, one RED record, validation, and this summary.
- Runtime: Node `v26.10.0`.
- Actuals: 102254 diff characters / 4, rounded up; two commits measured from
  the persisted plan ledger before this summary commit.

The requirements-completed array copies the plan's required IDs verbatim
under the summary protocol. It does not certify TENB-02: status is halted,
coverage D3 fails, and no shared requirement or state record was updated.

## Accomplishments

- Added 18 cases within the existing catalog-wire concern: a 260-tuple
  ordered bijection per machine mode and one case per raw kind per mode.
  Four emit-driven fixtures use their real public seams; all others use
  notify with the existing catalog label convention.
- Reused every fixture's existing single run snapshot. Only the test run's
  sink is replaced with the existing capture. Every original entry validates
  at append time; explicit assertValid calls run after emission callbacks.
  Unexpected UI access is retained and rejected.
- Preserved converter-only assertions, whole-object unsafe-value controls,
  credential protections, the 260-state / 39143-byte catalog pins, and all
  3149 text corpus entries with zero extras.
- Recorded all six success criteria and their owner/threat evidence,
  including the concrete SC5 failure rather than treating green tests as
  proof of complete context construction.

## Task Commits

1. **07.1: Catalog and raw transport evidence** — `ee1c4362a0fbda084b6066c9f27a6ad3707ad0fc`
   (`test: prove catalog and raw machine transport coverage`). Accepted.
2. **07.2: Final evidence and outstanding owner correction** —
   `acff6d6c9d4078231eb48958c379dbd9360a04f1`
   (`docs: record transport validation and remaining fixture gap`). Evidence
   committed; acceptance remains blocked on TENB-02 / SC5.

Plan metadata is committed separately as `docs: record catalog transport handoff`.
No task commit deletes tracked files.

## Verification

Verified clean combined prerequisite tree:
`ee1c4362a0fbda084b6066c9f27a6ad3707ad0fc`, Node `v26.10.0`.

| Command / check | Observed result |
| --- | --- |
| `node --test tests/architecture/catalog-uat/catalog-wire.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/notify-producer-wire-coverage.test.ts tests/architecture/no-credential-leak.test.ts` | Exit 0; 70 tests, zero failures/skips |
| `node_modules/.bin/fallow guard tests/architecture/catalog-uat/catalog-wire.test.ts` | Exit 0; test zone unrestricted |
| `node_modules/.bin/fallow audit --base HEAD` before task commits | Exit 0; no changed-file issues; existing skipped tsbuildinfo entry-point diagnostic |
| Required `SKIP=npm-check pre-commit run --files ...` | Passed after Prettier formatting; rerun before each commit |
| Task 1 `git commit` hook | First attempt failed import order; corrected attempt passed `npm run check:commit` |
| Task 2 documentation commit hooks | Passed; npm build hook correctly skipped planning-only input |
| `npm run check > /tmp/p05-07-full-check.log 2>&1` | Exit 0; static, architecture, integration and 264 direct-coverage pairs |
| `node scripts/notify-corpus.mjs check > /tmp/p05-07-corpus.log 2>&1` | Exit 0; 3149 present, zero extras; 8929 passed, zero failed, one existing optional resolver skip |
| Strict assertions on `/tmp/p05-07-corpus.log` | Exit 0; no missing/extra lines and exact 3149/0 success line present |
| `git diff --exit-code 26cb0056 -- docs/output-catalog.md` | Exit 0; no diff |
| `git diff --exit-code -- schema/claude-plugin.schema.json` | Exit 0; no diff |
| Exact in-memory `ESLint.lintText` command from 05-01.2 | Exit 0; six JOUT-01 call-form controls and retained NFR-5 control |
| Clean lintText controls for both planted-file paths and dispatcher | Exit 0; no messages; whole-tree lint also passed in full gate |
| `git diff --exit-code ee1c4362 -- . ':(exclude,glob).planning/**/*.md'` | Exit 0; only planning Markdown changed after the full gate |
| Production, mock-pi, STATE.md and ROADMAP.md comparison to start | Exit 0; unchanged |

Strict corpus validation used a regular log as explicitly required. It checked
both subprocess success and the exact count/missing/extra predicates. Logs
under `/tmp` are session-local; RED report and validation findings are retained
in planning artifacts. No new dependency, generated schema, production probe,
lint-control file, skipped test, TODO, or unfinished production stub exists.

## TDD Gate Compliance

Task 1 is test-only: the completed prerequisite dispatcher already has the
transport behavior. Before wiring the new harness, its tuple-bijection
assertions ran against the existing converter-only path and failed with an
empty captured list instead of 260 tuple keys, in both machine modes. The
other 14 existing cases passed. This proves the harness coverage gap; it is
not evidence of a production transport defect.

`node --test --test-reporter=tap tests/architecture/catalog-uat/catalog-wire.test.ts`
exited 1 with those two named assertion failures. The complete unchanged TAP
report and semantic assessment are in `05-07-red.json`.
`node .codex/gsd-core/bin/gsd-tools.cjs check tdd-red-evidence
.planning/phases/05-mode-selected-json-sink/05-07-red.json --raw` returned
`RED_EVIDENCE_OK` before the harness was connected. An initial sandbox-only
file-level runner failure was rejected as INVALID_RED and was not used.

GREEN connects the capture to the existing public dispatch helpers; no
production mutation or artificial production regression was introduced.
Green tests and retained RED evidence were committed together under the
explicit repository override because failing commits cannot pass hooks.
There is no separate RED or refactor commit.

## Decisions Made

Keep the fixture modes gap visible and preserve the assigned edit scope.
`mock-pi.ts` needs no change: existing strict inventory expectations and the
test-only sink replacement already provide the required capture behavior.

## Deviations from Plan

**1. Owner-scope blocker: missing context modes.** Task 07.2's audit found
nine remaining omissions in the file assigned to 05-01,
`tests/bridges/hooks/if-field/index.test.ts`. The cwd-only Pick at line 126
is cast at line 143; eight further cwd-only literals are cast at lines 521,
555, 614, 637, 682, 709, 788, and 821. Type assertions conceal the missing
required field, so the full gate passes without establishing TENB-02.

No out-of-scope fixture edit was made. The exact proposed correction is to
add `mode: "print"` to all nine fixtures and include mode in the Pick's
required keys. An ownership-expansion question was submitted; no approval
had arrived when this handoff was recorded. Task 2 cannot be accepted until
the parent applies or authorizes this correction and verifies it.

**Execution adjustments:** Use regular-log corpus validation as instructed;
run required Git and Node verification through approved escalation after
the sandbox blocked shared Git LFS metadata and isolated test subprocesses.
No sandbox safeguards or hooks were disabled. Conventional titles omit
phase scopes under the project override.

## Issues Encountered

- Git status initially failed when Git LFS attempted a shared temporary file.
  Required Git commands succeeded under automatic escalation with cwd pinned
  to this isolated worktree.
- The first RED runner failure was not valid evidence; the escalated run
  executed the intended assertions and received RED_EVIDENCE_OK.
- The first commit hook caught one type-import ordering error. It was fixed
  and a new ordinary commit attempt passed; no amend or bypass was used.

## Remaining Limitations

- TENB-02 / SC5 is a concrete fixture-contract gap, separate from runtime
  behavior and separate from the unresolved planning assumptions below.
- A-05-01 and A-05-02 remain flagged unclassified assumptions requiring the
  independent mutation-root and stale-callback reviews.
- P-05-01 and P-05-02 remain descriptorless and unverified until downstream
  assessment. Passing tests do not certify either prohibition.
- The parent owns post-merge verification, STATE.md, ROADMAP.md, and the
  final phase verdict. No shared status or requirement record was changed.
- Phase 6/7 responsibilities, including real-Pi e2e and the accepted startup
  streaming limitation, remain outside this plan. The existing optional
  resolver skip is unchanged.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-05-19 has complete catalog/raw capture evidence. T-05-20 is enforced by
recording the observed gap and leaving validation/sign-off false. T-05-SC
remains satisfied: no installation or dependency modification occurred.

## User Setup Required

None. The remaining action is an owner fixture correction, not external setup.

## Next Phase Readiness

Return to the parent for the nine explicit context modes. Re-run the owning
checks and combined gate after that correction, then update this halted
record and validation before independent phase verification.

## Self-Check: FAILED

Artifact and commit checks pass: the test, RED record, validation and summary
exist; both task hashes are ancestors of HEAD; the persisted ledger measures
two task commits. Executed gates and unchanged-input checks pass. Overall
plan completion fails only because Task 07.2 requires TENB-02 / SC5 to be
complete and the nine owner fixture omissions remain. The plan is not
reported complete.
