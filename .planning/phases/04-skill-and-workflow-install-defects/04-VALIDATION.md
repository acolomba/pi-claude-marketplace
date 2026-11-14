---
phase: "04"
slug: "skill-and-workflow-install-defects"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-14"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node test runner (`node:test`, `node:assert/strict`, `strong-mock`) and Cucumber 13.3.0 |
| **Config file** | package.json, cucumber.json, and the existing direct coverage tooling; nothing is installed |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/component-paths.test.ts` (the owner test of the file a task changes) |
| **Pair coverage command** | `npm run test:coverage:direct -- <source file>` (100% line, branch, and function coverage for each changed source) |
| **Scenario command** | `npm run test:cucumber:profile -- --profile adapter <feature files>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | Owner tests under 30 seconds; one feature file about one minute; the full suite roughly 10 to 15 minutes on this checkout, with a 2400-second timeout |

No scenario of this phase is an MCP scenario, so each new feature is untagged and runs under the adapter profile only. A `--profile builtin` run of one of these files selects no scenario and proves nothing, so no task uses it; the full gate runs both profiles over the whole suite.

---

## Sampling Rate

- **While editing:** the owner tests and the direct pair coverage of the changed sources, and the task's own feature file.
- **After every task commit:** the normal repository hooks, which run `npm run check:commit`. Do not repeat their checks right before the commit.
- **After every plan wave:** `npm run check` on the combined tree, with a 2400-second timeout.
- **Before `/gsd-verify-work`:** the full suite must be green: static checks, Fallow, unit, integration, both Cucumber profiles, and 100% direct coverage. A skipped required scenario or a timed-out wait is not a pass.
- **Max feedback latency:** 30 seconds for owner tests; about 60 seconds for one feature file.
- **Failing first:** each scenario is seen red before its change and green after it. A task that adds no production code neutralizes the production lines in the working tree only, records the red run, and restores them. A commit is always green, because the hook rejects a failing commit.

---

## Per-Task Verification Map

Every task has explicit automated commands, each followed by its failing direction, in its PLAN. The representative command below does not replace the other owner commands, the pair coverage, or the feature run listed there. A new test, fixture, or step file is created in the same task as its first consumer; no test-only scaffold is scheduled.

| Task ID | Plan | Wave | Requirements | Threat Ref | Contract | Test Type | Representative Automated Command | File Exists | Status |
|---------|------|------|--------------|------------|----------|-----------|----------------------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PG-CORE-01 | T-04-01 | Install only the listed skills of a root-source entry, with every selection arm of D-PG4-01 | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/component-paths.test.ts` | Owner test exists, extend; the feature, the fixture writer, and the step are created here | ⬜ pending |
| 04-01-02 | 01 | 1 | PG-CORE-01 | T-04-02 | Remove the folder, record, offer, and alias of a dropped skill on update and reinstall; pin the hash route | behavior/owner | `npm run test:cucumber:profile -- --profile adapter features/skill/root-source-entries.feature` | Feature from 04-01-01; the record-skills Then is created here | ⬜ pending |
| 04-02-01 | 02 | 2 | PG-CORE-01 | T-04-03 | List a listed skill folder as one skill in `info` | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/info.test.ts` | Exists, extend | ⬜ pending |
| 04-02-02 | 02 | 2 | PG-CORE-01 | T-04-03 | Mirror the rule in the lenient listing and read no escaping path | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/info.test.ts` | Exists, extend | ⬜ pending |
| 04-03-01 | 03 | 2 | PG-SKILL-04 | T-04-04, T-04-05 | Rewrite a sibling link in `SKILL.md`; the pure rule with every arm of D-PG4-04 to D-PG4-06 | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/skill-sibling-paths.test.ts test/bridges/skills/stage.test.ts` | The new module, its owner test, and the feature are created here | ⬜ pending |
| 04-03-02 | 03 | 2 | PG-SKILL-04 | T-04-04 | Rewrite in supporting Markdown at depth; leave an unlisted sibling as written | owner/behavior | `npm run test:cucumber:profile -- --profile adapter features/skill/sibling-links.feature` | Feature from 04-03-01 | ⬜ pending |
| 04-04-01 | 04 | 1 | PG-WF-01 | T-04-06, T-04-07 | Keep a bare workflow name bare, keep a slash where the source wrote one, and correct the page | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/skill-tokens.test.ts test/bridges/skills/stage.test.ts test/bridges/commands/staged-command.test.ts test/bridges/agents/convert.test.ts test/bridges/agents/skill-preload.test.ts` | Exists, two cases change; the feature is created here | ⬜ pending |
| 04-04-02 | 04 | 1 | PG-WF-01 | T-04-06 | The scripted model starts the workflow by the copied name and the run completes | behavior | `npm run test:cucumber:profile -- --profile adapter features/workflow/references.feature features/workflow/run.feature features/workflow/listing.feature` | The projection and the When are created here | ⬜ pending |
| 04-05-01 | 05 | 1 | PG-SEC-01 | T-04-08, T-04-09, T-04-10 | Literal agent types on the verdict, and the join on a real plugin tree | owner | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/workflow-script.test.ts test/orchestrators/plugin/discover-names.test.ts test/architecture/workflows-single-parse.test.ts` | Exist, extend | ⬜ pending |
| 04-05-02 | 05 | 1 | PG-SEC-01 | T-04-09, T-04-11 | The note at install, once, with or without pi-subagents | owner/behavior | `npm run test:cucumber:profile -- --profile adapter features/workflow/agent-restrictions.feature` | The feature is created here | ⬜ pending |
| 04-05-03 | 05 | 1 | PG-SEC-01 | T-04-11 | The note at update, once, through the shared runner | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/update-swap.test.ts` | Exists, extend | ⬜ pending |
| 04-06-01 | 06 | 3 | PG-SEC-01 | T-04-12, T-04-13 | The note in `info`, with a contained agent read | owner/behavior | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/orchestrators/plugin/info.test.ts test/orchestrators/plugin/discover-names.test.ts` | Exist, extend | ⬜ pending |
| 04-06-02 | 06 | 3 | PG-SEC-01, PG-CORE-01 | T-04-14 | The compatibility row, the root-source clause, the engine request draft, and the CHANGELOG | docs | `SKIP=npm-check${SKIP:+,$SKIP} pre-commit run --files docs/workflows-compatibility.md CHANGELOG.md .planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md` | The draft is created here | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

T-04-06, the elevation of privilege of a workflow that does not keep an agent's tool restriction, is transferred to the workflow engine. Its disclosure is delivered by tasks 04-05-02, 04-05-03, 04-06-01, and 04-06-02. T-04-SC is in every plan: no package is installed.

---

## Full Gates

Normal commit hooks are mandatory. Each combined-tree gate runs the complete command with a 2400-second timeout. A commit hook or a focused subset cannot satisfy it. A gate may reuse a passing result only for identical build inputs under the local-verification skill; otherwise it reruns.

| Gate | Command | Timeout | Required evidence | Status |
|---|---|---|---|---|
| Wave 1 combined tree | `npm run check` | 2400 seconds | Plans 04-01, 04-04, and 04-05 merged; the exact commit, Node version, exit status, and scenario counts | passed |
| Wave 2 combined tree | `npm run check` | 2400 seconds | Plans 04-02 and 04-03 merged; the same evidence | passed |
| Wave 3 combined tree | `npm run check` | 2400 seconds | Plan 04-06 merged; the same evidence | passed |
| Phase gate | `npm run check` | 2400 seconds | The final tree after the Parent lines; reuse only when the build inputs are identical | ⬜ pending |
| Merge gate | `npm run check` | 2400 seconds | The merged tree, or a documented identical-input reuse | ⬜ pending |
| Final PR or release handoff | `npm run check` | 2400 seconds | The final build inputs, or a documented identical-input reuse | ⬜ pending |

---

## Wave 1 Execution Evidence

Plans 04-01, 04-04 and 04-05 are merged on the main tree, run one after another. Seven task commits and three summaries; every commit hook ran `check:commit` and passed. No hook was bypassed.

- Combined gate: exit 0 at `2b69558d06106203caa63e1290f2d3c7e1ff1c3e`, Node v26.13.1. Adapter profile 1905 of 1905 scenarios, builtin profile 184 of 184, 361 direct coverage records.
- 04-01 added a temporary `.fallowrc.json` `ignoreExports` entry for `isMarketplaceRootSource` (WINDOWS #116); plan 04-02 removes it when `info.ts` imports the predicate.
- 04-05 writes the folder's base name into the restriction note, because a quoted absolute path followed by more quoted text is redacted to the end of the line (fail-closed by design in `shared/redact-absolute-paths.ts`).

## Wave 2 Execution Evidence

Plans 04-02 and 04-03 are merged on the main tree, run one after another. Four task commits and two summaries; every commit hook ran `check:commit` and passed.

- Combined gate: exit 0 at `2bc276c32fa8b4713a6a6b03a50f92d84922ed53`, Node v26.13.1. Adapter profile 1910 of 1910 scenarios, builtin profile 184 of 184, 362 direct coverage records.
- 04-02 removed the temporary `ignoreExports` entry from `.fallowrc.json` and closed WINDOWS #116.
- 04-03 keeps the one unclassified PG-SKILL-04 edge flagged for the verifier.

## Wave 3 Execution Evidence

Plan 04-06 is merged on the main tree. Two task commits and one summary; the commit hook ran `check:commit` and passed.

- Combined gate: exit 0 at `852b033f`, Node v26.13.1. Adapter profile 1911 of 1911 scenarios, builtin profile 184 of 184, 362 direct coverage records.
- The Parent lines for PROJECT.md (D-CF1-06 exception, Out of Scope bullet) and six BACKLOG entries landed afterwards in `c40ef6dc`, which changes only `.planning/`.

## Wave 0 Requirements

There is no standalone Wave 0 and no test-only scaffold commit. Each task that creates a test, fixture, or step file also creates its first consumer and verifies it. No framework is installed.

- [ ] 04-01-01 creates `writePublishedMarketplaceFiles` in `features/lib/published-marketplace.ts`, the marketplace-root file step in `features/step_definitions/marketplace/publishing.steps.ts`, and `features/skill/root-source-entries.feature`, which uses both.
- [ ] 04-01-02 creates the record-skills Then in `features/step_definitions/plugin/installation.steps.ts` with the update and reinstall scenarios that use it.
- [ ] 04-03-01 creates `extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts` with its paired owner test `test/domain/skill-sibling-paths.test.ts`, its consumer in the skills bridge, and `features/skill/sibling-links.feature`.
- [ ] 04-04-01 creates `features/workflow/references.feature` from existing steps.
- [ ] 04-04-02 creates `features/lib/upstream/workflows.ts`, registers it in `features/lib/upstream/index.ts`, and creates the model-started-run When in `features/step_definitions/workflow/runs.steps.ts`, with the scenario that uses both.
- [ ] 04-05-02 creates `features/workflow/agent-restrictions.feature` from existing steps.
- [ ] 04-06-02 creates `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md`.
- [ ] Every other source in the phase is an existing owner with an existing paired test, which the task extends. No unconsumed export is planned: the join of 04-05-01 stays module-private until 04-06-01 gives it a second consumer.

---

## Probe and Scope Evidence

- **Spec-less fallback.** No phase SPEC exists, so both SPEC sections are absent and the default-on fallback ran. The edge probe proposed 11 rows: ten are resolved with an explicit criterion and lifted into the `must_haves.truths` of plans 04-01, 04-04, and 04-05; the one unclassified PG-SKILL-04 row stays unresolved and is a flagged assumption in plan 04-03. No row was dismissed, and none is a backstop. The record is `04-COVERAGE.md`.
- **Prohibitions.** The two-stage recall kept one values item, authored descriptor-less in `must_haves.prohibitions` of plan 04-04: the bridge must not manufacture the user's opt-in to a workflow run. Canon items (path traversal, pattern denial of service, line forgery, path disclosure) are referred to the six threat models and `/gsd-secure-phase`. No wired-check descriptor was fabricated and nothing was auto-dismissed.
- **Research assumptions.** A1 and A2 are flagged in plan 04-01, A3 in plan 04-04, and A4 in plan 04-05. The six open questions of `04-RESEARCH.md` are marked RESOLVED there with the task that settles each.
- **Assumption-delta scan:** `detected: false` for the Phase 4 roadmap section; the checkpoint did not fire.
- **Schema push gate:** no ORM schema file is in scope; not applicable.
- **API coverage:** the detector returned `detected: false` for the Phase 4 roadmap section. The phase integrates no external API; `04-COVERAGE.md` carries the reasoned declaration.
- **Scope.** Six plans, 13 tasks, three waves. No plan has a checkpoint, a new package, an account, or UI work. Every production path is an existing tracked owner except the one new domain module. The decision coverage gate reports 16 of 16 decisions cited.

---

## Manual-Only Verifications

None planned. All phase behaviors have automated verification through owner tests and scenarios that run in a hermetic home against local stand-ins.

Filing the request to pi-dynamic-workflows is the maintainer's step (D-PG4-15). It is not a verification of this phase: the phase proves only that the draft exists in the agreed shape.

---

## Validation Sign-Off

- [ ] All 13 tasks have concrete automated verification with a stated failing direction (47 commands, 47 statements)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Every new path has a consuming creation task before any later reference
- [ ] No watch-mode flags
- [ ] Feedback latency under 30 seconds for owner tests and about 60 seconds for one feature file
- [ ] Each scenario was seen red before its change and green after it
- [ ] All three wave gates and the phase gate pass with `npm run check`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
