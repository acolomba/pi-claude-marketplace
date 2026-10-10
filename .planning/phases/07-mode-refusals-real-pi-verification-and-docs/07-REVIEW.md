---
phase: 07-mode-refusals-real-pi-verification-and-docs
reviewed: 2026-10-10T04:15:56Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/e2e-nightly.yml
  - .pre-commit-config.yaml
  - AGENTS.md
  - README.md
  - docs/json-output.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - tests/architecture/json-output-docs.test.ts
  - tests/e2e/fixtures/startup-entries.ts.txt
  - tests/e2e/json-output-runtime.ts
  - tests/e2e/pi-json-output.test.ts
  - tests/e2e/pi-peer-floor/package.json
  - tests/edge/handlers/plugin/browse.test.ts
  - tests/edge/register.test.ts
  - tests/integration/auth-e2e.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/platform/git-auth-callbacks.test.ts
  - tests/platform/git.test.ts
  - tests/shared/errors.test.ts
  - tests/shared/notification-grammar.test.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
scope_status: degraded
scope_source: phase-range
scope_reason: no-task-commit-rows
diff_base: 1ab78d72c55a634e874932befac9d17b440ec83b
reviewed_commit: 53c100a92acf7921ef19632033c3aa0ee91f7dd1
---

# Phase 07: Code Review Report

Standard-depth adversarial review on `features/json` found one verification
coverage warning and no confirmed scoped blockers. The warning concerns future
guide-only changes: both automated check selectors omit the newly executable
documentation.

## Structural Findings (fallow)

The supplied normalized substrate reports:

| Category | Whole-repository count | In the phase source scope |
| --- | ---: | ---: |
| Unused exports | 0 | 0 |
| Unused files | 0 | 0 |
| Duplicate groups | 16 | 0 |
| Circular dependencies | 0 | 0 |
| Total | 16 | 0 |

All 16 duplicate groups are outside this review's file scope. Every instance
path in the raw clone groups was compared with the supplied scope; none
intersects it. These are retained as **WARNING — outside scope** structural
context, not additional Phase 07 findings. No unrelated refactor is requested.

The normalized duplicate locations are summarized below. Paths beginning with
`orchestrators/`, `edge/`, or `bridges/` are relative to
`extensions/pi-claude-marketplace/`; `tests/` paths are repository-relative.

| Group | First location | Other location |
| --- | --- | --- |
| 1 | `orchestrators/plugin/install-cascade.ts:980` | Same file |
| 2 | `orchestrators/plugin/shared.ts:293` | Same file |
| 3 | `orchestrators/plugin/install-cascade.ts:961` | Same file |
| 4 | `orchestrators/marketplace/update.messaging.ts:187` | Same file |
| 5 | `orchestrators/plugin/shared.ts:311` | Same file |
| 6 | `orchestrators/plugin/install-flow.ts:1638` | Same file |
| 7 | `edge/handlers/plugin/install.ts:52` | `edge/handlers/plugin/update.ts` |
| 8 | `edge/handlers/plugin/bootstrap.ts:37` | `edge/handlers/plugin/import.ts` |
| 9 | `tests/architecture/catalog-uat/fixtures/plugin-list.ts:121` | Same file |
| 10 | `orchestrators/plugin/reinstall.messaging.ts:317` | `orchestrators/reconcile/apply-outcomes.ts` |
| 11 | `tests/integration/concurrent-install-child.ts:34` | `tests/integration/load-reconcile-race-child.ts` |
| 12 | `orchestrators/plugin/info.ts:2077` | Same file |
| 13 | `orchestrators/plugin/install-flow.ts:800` | `orchestrators/plugin/uninstall.ts` |
| 14 | `edge/handlers/marketplace/autoupdate.ts:30` | `edge/handlers/plugin/enable-disable.ts` |
| 15 | `bridges/hooks/routing-state.ts:153` | `bridges/hooks/runtime.ts` |
| 16 | `bridges/hooks/async-rewake/registry.ts:360` | `bridges/hooks/dispatch-exec.ts` |

The raw audit uses base `000be227d8bb606ba9c7958eb263e527d0d5b77c`
and spans 480 changed files. Its whole-repository failure verdict and attribution
are not a Phase 07 gate result. This review retains the supplied phase base
`1ab78d72c55a634e874932befac9d17b440ec83b` for phase attribution.

## Narrative Findings (AI reviewer)

### Warnings

### WR-01: Executable guide changes bypass both build-input selectors

**Classification:** WARNING

**File:** `/home/acolomba/src/pi-claude-marketplace-json/.github/workflows/ci.yml:14-32`

**Related files:**

- `/home/acolomba/src/pi-claude-marketplace-json/.pre-commit-config.yaml:112`
- `/home/acolomba/src/pi-claude-marketplace-json/tests/architecture/json-output-docs.test.ts:34-38`
- `/home/acolomba/src/pi-claude-marketplace-json/tests/architecture/json-output-docs.test.ts:707-711`

**Issue:** The new architecture tests read and execute fenced examples from
`docs/json-output.md` and check its schema reference. That makes the guide a
build input under the project's verification policy. However, CI's shared
`build_inputs` list still names only `docs/output-catalog.md` among the
documentation files. The `npm-check` hook's file regex has the same omission.
A commit or pull request that changes only the JSON guide therefore runs
neither `npm run check:commit` nor the CI workflow. A broken jq example or
stale schema table can merge without the very checks added to catch it.
Markdown formatting checks do not execute these examples.

**Evidence:** `runExample` reads the guide at line 34, and
`readReferenceInputs` reads it at line 708. CI's only documentation path is
line 20, and the pull-request trigger reuses that list at line 36.
Evaluating the actual hook regex against `docs/json-output.md` returns
false. The current phase's checks ran because its changes include other
matched source and test paths; that does not cover the guide-only case.

**Fix:** Add `"docs/json-output.md"` beside the catalog in the shared CI
path list and change the hook's documentation alternative to
`docs/(output-catalog|json-output)\.md`. Keep the two selectors synchronized,
as required by `skills/local-verification/SKILL.md`. Verify that a file set
containing only the guide selects both checks and that the architecture
documentation test still passes.

## Scope, Evidence, and Limits

The exact `files` array from `/tmp/json-output-review07-scope.json` supplied
31 existing paths. The lockfile
`tests/e2e/pi-peer-floor/package-lock.json` was read for fixture provenance
but excluded from the 30-file source-review list under the lockfile filter.
No scoped path was ignored by Git; no `.codexignore` was present.

Scope resolution is **degraded**, with source `phase-range` and reason
`no-task-commit-rows`. The supplied SUMMARY union and canonical fallback
were retained, including the parent authentication-test mode-count repair.
No replacement range was invented. The three absent paths
`scripts/notify-corpus.hook.mjs`, `scripts/notify-corpus.mjs`, and
`scripts/notify-corpus.negative.mjs` are intentional retirements, not missing
implementation findings.

Review context included AGENTS.md, the configured TypeScript style,
comments, and testing-review skills, the local-verification policy, all six
plans and summaries, phase context, wave-four verification, security,
validation, and deferred-item records. CodeGraph was used first for code
location and call paths. Review traced browse refusal routing, lazy
authentication after credential/memo reuse, exact typed refusal propagation
through Git, command error handling, real-runtime subprocess isolation,
and guide examples against the schema and dispatch behavior.

Fresh review checks:

- The focused documentation, real-Pi runtime, and real-Git authentication
  integration tests completed with exit 0 on Node v26.11.1:
  `node --test --test-isolation=none --test-reporter=spec tests/architecture/json-output-docs.test.ts tests/e2e/pi-json-output.test.ts tests/integration/auth-e2e.test.ts`.
  All eight real-Pi cases ran against installed Pi 0.87.1 and independent
  Pi 0.86.1 with no skips. Initial sandbox subprocess failures were resolved
  by rerunning with subprocess permission; they are not code findings.
- All 264 catalog fenced blocks were compared with commit `26cb0056`;
  every fenced byte is unchanged.
- The current tree has no non-planning tracked difference from verified
  commit `773004759eb6d400ab48136696d81a6f44f7e5f6`. The parent-provided
  `npm run check` exit-0 evidence on Node v26.11.1 covers all 266 direct
  source/test pairs. This review did not rerun the full gate.
- Supplied strict corpus and merged retirement evidence retains all 3,149
  original samples plus the single approved print-browse refusal: 3,150
  present, zero extras. The retired capture tools were not recreated.

The existing root brace-expansion advisory remains open under
DEP-07-03-01. The optional pi-subagents resolver integration skip remains
a coverage limitation under TEST-07-06-01; the retained full corpus run
records 10,228 tests, 10,227 passes, and one skip. Neither is waived or
attributed to a new production behavior in this phase.

Descriptor-less prohibitions, unclassified assumptions, and manual phase
judgments retain their pending/flagged-unverified disposition. This code
review does not approve them or change validation/tracking records.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
