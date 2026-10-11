---
phase: 07-mode-refusals-real-pi-verification-and-docs
plan: "06"
subsystem: testing
tags: [corpus, preservation, refusal, catalog, pi, retirement]
requires:
  - phase: 07-mode-refusals-real-pi-verification-and-docs
    provides: All five merged behavior, runtime, and documentation plans
provides:
  - Exact independently audited ledger for one print-browse refusal
  - Append-only 3150-record baseline preserving all 3149 original records
  - Durable full-suite strict zero-extra report with concrete input hashes
  - Deletion-last retirement of exactly three temporary corpus tools
affects: [json-output-verification, milestone-closeout]
actuals:
  tokens: 749810
  tasks: 3
  commits: 3
commits: 3
plan_head_before: b079351028f13aae0ab44f981907d1f71da14f13
plan_head_after: 0a11761d2e87bcb461fccdb660c2d203db39f161
tech-stack:
  added: []
  patterns: [Independent phase-local multiset and concrete-input evidence audit]
key-files:
  created:
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-ADDITIONS.md
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-CAPTURE.jsonl
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-CAPTURE-EVIDENCE.json
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-FINAL.json
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-RETIREMENT.json
  modified:
    - .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl
    - .planning/phases/01-presentation-model/notify-corpus/meta.json
    - .planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md
  deleted:
    - scripts/notify-corpus.mjs
    - scripts/notify-corpus.hook.mjs
    - scripts/notify-corpus.negative.mjs
key-decisions:
  - Accept only the exact single browse-print tuple independently predicted by its owner test.
  - Preserve complete decoded reports in tracked ASCII-escaped JSON companions because log files are ignored.
  - Retain the existing optional-peer integration skip as an explicit coverage limitation.
requirements-completed: [MODE-03, MODE-04, JDOC-03]
coverage:
  - id: D1
    description: Every original per-file tuple and multiplicity survives, with exactly one independently authorized addition.
    requirement: MODE-03
    verification:
      - kind: other
        ref: node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --self-test
        status: pass
      - kind: other
        ref: node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --ledger
        status: pass
    human_judgment: false
  - id: D2
    description: The amended baseline preserves original serialized lines and has a fresh complete strict zero-extra comparison.
    verification:
      - kind: integration
        ref: 07-CORPUS-FINAL.json
        status: pass
      - kind: other
        ref: node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --final
        status: pass
    human_judgment: false
  - id: D3
    description: Only the three approved tools were deleted after strict proof, with no surviving references and a passing full gate.
    verification:
      - kind: other
        ref: node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --retired
        status: pass
      - kind: other
        ref: 07-RETIREMENT.json#npm run check
        status: pass
    human_judgment: false
  - id: D4
    description: Closeout must not conceal regressions or claim runtime proof that was not executed.
    verification: []
    human_judgment: true
    rationale: "flagged-unverified: descriptor-less prohibition remains a parent judgment; no automated descriptor is invented."
duration: 21min
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 6: Exact Corpus Amendment and Tool Retirement Summary

**All 3,149 original records survive byte-for-byte, one print-browse refusal is appended, the fresh strict comparison reports zero extras, and the three temporary tools are retired after proof.**

## Performance

- Started: 2026-10-10T03:39:16Z.
- Final task verification: 2026-10-10T03:59:57Z.
- Tasks: 3 of 3; 12 task files changed, including three intentional deletions.
- Node: v26.11.1.
- Actuals: ceiling of 2,999,239 realized diff characters / 4 = 749,810.
  Full retained captures and test reports dominate this evidence-size metric;
  it is not a harness-token measurement.
- Commit count: three measured from the persisted plan ledger through
  `0a11761d`, excluding this subsequent summary commit.

## Accomplishments

- Captured the unchanged complete `test` and `test:integration` glob selection
  with `TEST_CONCURRENCY=4`. The independent ledger admits exactly one tuple
  from `tests/edge/handlers/plugin/browse.test.ts`, count one, error severity,
  two arguments, with its exact test name and production refusal path.
  Device-flow cases add no notification tuples. All other 76 emitting files
  retain their complete original multisets.
- Committed the ledger before amending the baseline. The audit rejects seven
  negative controls: missing/replaced samples, wrong arity/severity, an
  unrelated addition, repeated extras, and an inflated ledger count.
- Appended one serialized line without changing the original byte prefix or
  record order. Metadata now reads 3,150 entries, 77 files, 1,667 one-argument
  records, and 1,483 two-argument records. Original Node/capture-time provenance
  remains unchanged; new runtime provenance is retained in the evidence.
- Retained every complete catalog fence against `26cb0056`: 264 exact blocks.
  The entire owner test is unchanged against the immutable anchor, including
  260 states and 39,143 UTF-8 output bytes. That owner ran in the full capture.
- Rechecked strict proof on the committed amendment immediately before
  deleting exactly the three tools together. The independent retirement mode
  reads 848 remaining tracked files outside planning, finds no retired-tool
  references, and proves that all behavior inputs differ only by those removals.
  Three tracked directory symlinks are identified as directories, not searched
  as regular files. No reference cleanup or product/test edit was needed.

## Task Commits

1. Capture and exact additions ledger — `bf2e84ab`:
   `test: ledger the exact print refusal corpus addition`.
2. Append-only amendment and fresh strict proof — `a9673e10`:
   `test: append the ledgered refusal and retain strict corpus proof`.
3. Delete tools last and verify final tree — `0a11761d`:
   `chore: retire verified notification corpus tools`.

All tasks passed Fallow audit against HEAD and explicit-file fixers before
normal foreground commit hooks. No hook was bypassed and no history was
rewritten. The deletion-only build hook skipped as documented, so the required
full `npm run check` ran separately before task 3's commit.

## Verification Evidence

All commands ran in the pinned isolated worktree on Node v26.11.1.

| Check | Exit and result | Head / evidence |
| --- | --- | --- |
| Full unchanged `capture --out .../07-CORPUS-CAPTURE.jsonl`, concurrency 4 | 0; 3,150 records; 10,228 tests accounted for | `b0793510`; `07-CORPUS-CAPTURE-EVIDENCE.json` |
| `--self-test` and `--ledger` | 0; exact original-plus-one multiset, seven rejected negative controls, frozen catalog | Before task 1 commit and committed tracer recheck |
| `node --test tests/e2e/pi-json-output.test.ts` | 0; 8 passed, zero skipped, installed 0.87.1 and exact floor 0.86.1 | `bf2e84ab`; runtime report inside `07-CORPUS-FINAL.json` |
| `TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check` | 0; `3150 baseline entries present, 0 extra.` | `bf2e84ab` plus the retained one-line amendment; committed as `a9673e10` |
| `--final` | 0; original byte prefix, exact ledger, metadata, completed tests, fresh fingerprints, frozen fences/locks | Before task 2 commit and again on `a9673e10` immediately before deletion |
| `--retired` | 0; three paths absent, 848 files read, no references or changed behavior inputs | Before full gate, before task 3 commit, and on `0a11761d` |
| `npm run check`, bounded by `timeout 2400` | 0; static checks, unpaired tests, integration suite, and 266 direct coverage records | `a9673e10` plus exactly the three tool deletions; `07-RETIREMENT.json` |
| Shared tracking comparison and `git diff --check` | 0; no shared changes or whitespace errors | `0a11761d` against `b0793510` |

Immutable original corpus anchor:
`64bcfa027530b55319446ea781facab229df92cd`.
Original SHA-256:
`fa5b6d6c76a089ba0362fa80291487e63d225b3a0ce416689624c342f2725ea3`.
Candidate SHA-256:
`9108545d1c83532894985ed7a1dc8e500cb097d6a333ae42ff9aedcf91aec611`.
Strict decoded report SHA-256:
`c4f111f29bd10b95c7bece0fd5300e62cec26cce4b3d9091dae276ace61a5642`.

The pre-deletion evidence hashes 860 concrete tracked/runtime inputs, including
Node's executable, installed lock metadata, and both Pi CLI manifests/bundles.
Untracked nonignored files outside planning are included. The audit compares
actual current bytes against this inventory; a list of changed paths is not
used as a substitute. Its retirement comparison permits only the three named
removals. All tools remain recoverable from Git history.

The planned live report remains at `07-CORPUS-FINAL.log` locally. Its complete
contents, actual exit status, input inventory, and fresh runtime report are
committed in `07-CORPUS-FINAL.json`, so strict proof survives worktree removal.
The auditor uses the durable companion and also compares the live log when it
exists. Capture selection, source tests, and recorder emissions were unchanged.

## Decisions Made

The only accepted addition is the browse owner's independently expected tuple.
No substring-based auth allowance, unrestricted baseline rewrite, or permissive
corpus exit was accepted as proof. Both real runtimes were executed afresh,
after confirming product/test inputs match the previously verified `7285a2b4`.

## Deviations from Plan

**[Rule 3 - Blocking] Retain ignored logs in allowed companion artifacts.**
The repository ignores `*.log`; no ignored file was force-added. Added
`07-CORPUS-CAPTURE-EVIDENCE.json`, `07-CORPUS-FINAL.json`, and
`07-RETIREMENT.json` to preserve exact reports/status/input identity durably.
JSON escapes non-ASCII characters because a captured test title contains a
bidirectional control rejected by the hook. Decoding preserves every report
byte and its SHA-256. Commits: `bf2e84ab`, `a9673e10`, `0a11761d`.

The installed root floor fixture was linked into the ignored local fixture
directory; no package acquisition or root downgrade occurred. The complete
capture was repeated after this setup before recording canonical evidence.

## Issues Encountered

- Initial sandbox Git/LFS metadata access required authorized escalation.
  Subprocess tests, audits, and commits then ran with the needed access.
  No automatic approval rejection occurred.
- The fingerprint handles tracked directory symlinks by hashing their link
  targets. Real files and runtime binaries are hashed from their bytes.
- The first evidence fixer pass rejected a literal bidi control in the test
  report; lossless ASCII JSON encoding resolved it before any commit.
- Fallow's task 3 audit reported a skipped generated TypeScript cache entry
  point, exited 0, and reported no issues in changed files. The full Fallow
  gate also passed. No code finding was suppressed.

## Known Stubs and Coverage Limits

No implementation stubs, newly skipped tests, or unrun plan checks remain.
The complete corpus runs each report 10,227 passed, zero failed/cancelled/todo,
and one pre-existing optional `pi-subagents` resolver integration skip out of
10,228 tests. The exact title/reason is retained and enforced by the audit;
this does not claim that the skipped behavior executed. `TEST-07-06-01` in
`deferred-items.md` records the gap and a proposed WINDOWS row for the parent.
The user's shared-tracking restriction takes precedence over writing that
register here. The eight fresh real-Pi tests all passed with zero skips.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
The exact immutable multiset and ledger address T-07-17; recorded completion,
actual status, zero-extra marker, and concrete hashes address T-07-18;
pre-deletion reassertion and final-tree checks address T-07-19. No dependency
was installed for T-07-SC. The descriptor-less concealment/runtime-proof
prohibition remains **flagged-unverified** for parent review, not automatically
approved. The previously recorded dependency advisory remains deferred.

## User Setup Required

None for this completed execution.

## Next Phase Readiness

All three tasks are complete. The parent can merge the isolated commits,
run its combined-tree gate, and review the explicit judgment and optional-peer
coverage limitation. STATE.md, state.json, ROADMAP.md, config.json,
REQUIREMENTS.md, and WINDOWS.md are unchanged. No version or PR work occurred.

## Self-Check: PASSED

All six created task artifacts and this summary exist. All three task commits
are ancestors of HEAD. The committed-tree negative controls and retirement
audit pass, the full post-deletion check exited zero, the exact three planned
deletions are confirmed, and shared tracking files remain unchanged.
