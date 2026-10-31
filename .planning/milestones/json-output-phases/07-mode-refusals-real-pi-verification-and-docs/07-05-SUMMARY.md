---
phase: 07-mode-refusals-real-pi-verification-and-docs
plan: "05"
subsystem: documentation
tags: [json, schema, jq, pi, rpc, catalog]
requires:
  - phase: 06-command-run-contract
    provides: Invocation isolation and bounded append recovery
  - phase: 07-mode-refusals-real-pi-verification-and-docs
    provides: Merged refusal behavior, current/floor runtime evidence, and executable guide
provides:
  - Complete reference for nineteen payload kinds and their nested fields
  - Schema-derived documentation inventory with missing-field negative controls
  - Verified runtime and delivery limitations
  - Corrected IL-2, closed MRO-01, and bounded catalog ownership corrections
affects: [07-06, json-output-documentation]
actuals:
  tokens: 16577
  tasks: 3
  commits: 3
commits: 3
plan_head_before: fe111b43ad54220145a3370cd7985bdf0b5efc81
plan_head_after: 7285a2b44ad52aa212820644322b3b3da50bfaec
tech-stack:
  added: []
  patterns:
    - Expand shared documentation tables before comparing recursive schema paths
    - Validate displayed partial-result payloads against the committed schema
key-files:
  created: []
  modified:
    - docs/json-output.md
    - tests/architecture/json-output-docs.test.ts
    - AGENTS.md
    - .planning/BACKLOG.md
    - docs/output-catalog.md
key-decisions:
  - Reuse common field and object sections through explicit reference markers.
  - Preserve all catalog fences while correcting only the two approved ownership topics.
requirements-completed: [JDOC-01, JDOC-02, JDOC-03]
coverage:
  - id: D1
    description: Every current schema kind and recursive field has documented requiredness, type, and meaning.
    requirement: JDOC-01
    verification:
      - kind: other
        ref: tests/architecture/json-output-docs.test.ts#the reference covers every schema kind and recursive field with its requiredness
        status: pass
      - kind: other
        ref: tests/architecture/wire-schema.test.ts
        status: pass
    human_judgment: true
    rationale: Tests prove kind/path/requiredness coverage and nonempty descriptions; field meanings and compatibility prose require content review.
  - id: D2
    description: Runtime and delivery limitations describe actual startup, persistence, process, transport, and recovery behavior.
    requirement: JDOC-02
    verification:
      - kind: e2e
        ref: node --test tests/architecture/json-output-docs.test.ts tests/e2e/pi-json-output.test.ts
        status: pass
    human_judgment: true
    rationale: Both real runtimes prove lifecycle claims; prose completeness and delivery wording also require review against the command-run evidence.
  - id: D3
    description: IL-2 selects one transport, MRO-01 corrects both wrong claims, and catalog ownership prose is bounded.
    requirement: JDOC-03
    verification:
      - kind: other
        ref: git diff --check 64bcfa027530b55319446ea781facab229df92cd -- AGENTS.md .planning/BACKLOG.md docs/output-catalog.md
        status: pass
    human_judgment: true
    rationale: The plan's JDOC-03 unclassified assumption remains flagged for the parent reviewer; bounded source-and-diff inspection does not invent an automated classifier.
  - id: D4
    description: Every catalog fence and both catalog fixture locks remain unchanged.
    verification:
      - kind: other
        ref: tests/architecture/catalog-uat/catalog-contract.test.ts
        status: pass
      - kind: other
        ref: Python byte comparison against git show 26cb0056:docs/output-catalog.md
        status: pass
    human_judgment: false
duration: 20min
completed: 2026-10-10
status: complete
---

# Phase 7 Plan 5: JSON Schema Reference and Limitations Summary

**The guide documents all nineteen payload kinds, verified Pi delivery limits, and exclusive mode-selected transport while preserving every catalog fence.**

## Performance

- Started: 2026-10-10T03:09:48Z.
- Final verification completed: 2026-10-10T03:29:40Z.
- Tasks: 3 of 3.
- Task files modified: 5, plus this summary.
- Runtime: Node v26.11.1.
- Actual token scale: 66,308 realized task-diff characters / 4 = 16,577.
- Commit count: three measured from the persisted plan ledger through `7285a2b4`, excluding this subsequent summary commit.

## Accomplishments

- Kept runnable examples first. Added common envelope and origin fields, all nineteen kind bodies, shared nested objects, conditional source/component/hook branches, causes, rollback phases, retained workflows, tallies, and native closed-set tokens.
- Stated additive versus breaking version rules, conservative handling of unfamiliar values, and maximum command-origin severity. The reference distinguishes the strict current producer schema from a consumer's compatibility policy.
- The architecture test derives kinds and recursive paths/requiredness from the committed schema, resolves local references and unions, and expands linked documentation tables. Transient missing-kind, missing-field, and incorrect-requiredness fixtures must fail. A separate assertion validates the displayed JSONL payload examples.
- Added a later Limitations section covering print silence, command severity versus Pi process status, startup stream absence, RPC retrieval/rendering, slash-only persistence timing, and independent `--no-session` behavior. It states one direct recovery per ordinary append failure, no business-operation retry, no rollback promise, and possible missing outcomes after sustained sink failure. Correlation remains per invocation and separate from telemetry.
- Updated only AGENTS.md's IL-2 line, closed the existing MRO-01 item with both false claims corrected, and corrected only resolver marker ownership and dispatch text-strategy device-flow ownership in the catalog.

## Task Commits

1. **Connect the guide reference to the complete schema inventory:** `42744112` — `docs: document the complete JSON payload schema`.
2. **Document verified runtime and delivery limitations:** `4091cb7e` — `docs: explain verified JSON runtime and delivery limits`.
3. **Correct output policy, close MRO-01, and amend sanctioned catalog prose:** `7285a2b4` — `docs: correct mode output policy and renderer ownership`.

All three commits passed Fallow audit against HEAD and explicit-file fixers before normal foreground commit hooks. The build-input hooks for tasks 1 and 3 passed `npm run check:commit`. Task 2 was documentation outside that hook's build-input selection and passed the applicable hooks. No hooks were bypassed and no history was rewritten.

## Verification Evidence

Every command ran from the pinned executor worktree, with Node v26.11.1. Final executable inputs are committed at `7285a2b44ad52aa212820644322b3b3da50bfaec`.

| Command or check | Exit and result | Revision |
| --- | --- | --- |
| `node --test tests/architecture/json-output-docs.test.ts tests/architecture/wire-schema.test.ts` | 0; 126 passed, zero skipped; tracer rerun before task 2 | `42744112` |
| `node --test tests/architecture/json-output-docs.test.ts tests/e2e/pi-json-output.test.ts` | 0; 125 passed, zero skipped, including all eight real-runtime cases | Task 2 tree, committed unchanged as `4091cb7e` |
| `git diff --check 64bcfa027530b55319446ea781facab229df92cd -- AGENTS.md .planning/BACKLOG.md docs/output-catalog.md` | 0; no whitespace errors | Task 3 tree, committed unchanged as `7285a2b4` |
| `node --test tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/wire-schema.test.ts` | 0; 13 passed, zero skipped; 260 states and 39,143 bytes | Task 3 tree, committed unchanged as `7285a2b4` |
| `node --test tests/architecture/json-output-docs.test.ts tests/architecture/wire-schema.test.ts tests/e2e/pi-json-output.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts` | 0; 138 passed, zero failed/cancelled/skipped/todo; 15.74 seconds | Clean `7285a2b4` |
| `node_modules/.bin/fallow audit --base HEAD` before each task commit | 0; no issues in changed files | Each task tree |
| `git diff --check fe111b43..HEAD` | 0 | `7285a2b4` |
| Protected tracking, schema, root manifests, corpus baseline, and corpus scripts compared with `fe111b43` | Empty diff | `7285a2b4` |

Final test log: `/tmp/p07-05-final-tests.log`. Tracer/runtime/catalog logs: `/tmp/p07-05-tracer-tests.log`, `/tmp/p07-05-task2-tests.log`, and `/tmp/p07-05-task3-tests.log`. Commit and audit logs use `/tmp/p07-05-task{1,2,3}-{commit,audit}.log`.

The exact-floor fixture was absent from this worktree. The already-authorized command `npm --prefix tests/e2e/pi-peer-floor ci --ignore-scripts --fetch-retries=0 --fetch-timeout=15000` exited 0. It provisioned the existing lock without changing manifests or locks. Tests resolved the fixture-local CLI and executed Pi 0.86.1; installed-runtime cases executed Pi 0.87.1. Both versions passed list output, JSON startup controls, RPC startup retrieval, and persistence-enabled slash-only cases. No runtime leg was skipped or substituted with the parent runtime.

The parent owns `npm run check` on the combined tree and the final corpus gate. These task checks do not substitute for those gates.

## Bounded Diff Review

- IL-2 preserves the direct stdout/stderr ban and the single sanctioned legacy `console.warn` exception while selecting `notify` for tui/print and `appendEntry` for json/rpc.
- MRO-01 is closed in place. It explicitly corrects the human-string claim and the proposed dual/print-stdout transport, links the dedicated guide, and cites executed current/floor evidence.
- Catalog changes affect ten prose paragraphs, all within the two approved topics. Marker attribution is corrected at every false occurrence, including disabled-row suppression and the command snapshot. Device-flow wording distinguishes callback values from text rendering and names the actual byte-test owners.
- All 264 fenced blocks match `26cb0056` byte for byte, including the four fences outside the 260-state fixture inventory. Both fixture constants remain untouched.

The final fence comparison used the following assertion against bytes read from the committed baseline and the current file:

```python
before = subprocess.check_output(["git", "show", "26cb0056:docs/output-catalog.md"])
after = Path("docs/output-catalog.md").read_bytes()
fences = rb"(?m)^```[^\n]*\n[\s\S]*?^```[^\n]*(?:\n|$)"
assert re.findall(fences, before) == re.findall(fences, after)
```

It passed before and after the task commit. No corpus baseline amendment or script retirement occurred.

## Decisions Made

Common fields and reusable object tables have stable reference markers. The test expands those sections before comparing complete recursive inventories, avoiding another hand-maintained nineteen-kind list. Presence is required, optional, or conditional within the containing object; the prose identifies each conditional branch.

## Deviations from Plan

**[Rule 1 - Bug] Correct the partial-failure JSONL example while grounding the reference in the schema.** The existing example put `causeChain` and `truncated` at the root and omitted required `summary`. Task 1 moved the chain into `cause`, added `summary`, and added schema validation of the displayed payloads. Files: `docs/json-output.md` and its architecture test. Verification: the guide/schema suite and commit hook passed. Commit: `42744112`. This stays within the planned files and changes no production schema or behavior.

## Issues Encountered

- Git LFS status access needed permission to use shared Git metadata. Fallow, Git commits, and Node child-process checks used authorized escalation. No automatic approval rejection occurred.
- The first task commit attempt found TypeScript narrowing and style errors. The second found the optional-chain lint rule conflicting with that narrowing form. Defaulted captures resolved both checks, and the normal third attempt passed. Failed attempts made no commits.
- Exact-floor provisioning repeated the known transitive advisory already documented by `07-PEER-FLOOR-AUDIT.md`. This plan changed no dependency artifact and did not run an automatic dependency fix.
- Writing skills were read from the original skill directory because the worktree lacked those two skill symlinks. No writes or Git operations targeted the parent checkout.

## Known Stubs

None. No new TODOs, placeholder implementations, skipped tests, or unrun task verification commands remain. Empty inventories in examples are valid contract values.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. Schema-derived inventory and planted omissions address T-07-14. Executed runtime evidence and bounded delivery wording address T-07-15. Exact fence comparison and unchanged fixture locks address T-07-16. Existing locked fixture provisioning changes no package selection or product dependency for T-07-SC.

## User Setup Required

None.

## Next Phase Readiness

Ready for the parent's combined-wave gate and 07-06 corpus closeout. The JDOC-03 unclassified assumption and prose judgments remain visible for parent review. STATE.md, state.json, ROADMAP.md, config.json, REQUIREMENTS.md, and other shared progress records remain untouched.

## Self-Check: PASSED

All five task deliverables exist. All three task commits are ancestors of HEAD, and none deletes a tracked file. Final plan tests pass on the clean task head. The catalog fences and protected-file comparisons pass. This summary is created in the pinned worktree for its separate metadata commit.
