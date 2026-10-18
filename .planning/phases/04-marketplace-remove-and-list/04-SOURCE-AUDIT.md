# Phase 4 Source Coverage Audit

Date: 2026-10-18
Result: all phase goals, requirements, research constraints, and locked decisions are covered by the four-plan set. No source item is silently deferred. Remote stand-ins and network-observation requirements assigned to later phases remain outside this phase.

## Plan and dependency map

| Plan | Wave | Needs | Creates or expands | Files owned | Checkpoint |
|---|---|---|---|---|---|
| 04-01 | 1 | Existing real-Pi Cucumber infrastructure and approved discussion | D-MF-05, clean removal, rm, precedence, and missing-target witnesses | .planning/PROJECT.md; features/marketplace/remove.feature | None |
| 04-03 | 1 | Existing public command, publication, config, and time-token steps | Complete list/ls inventory, filters, and effective autoupdate witnesses | features/marketplace/list.feature | None |
| 04-04 | 1 | Existing hermetic fixture and schema-validating machine notification boundary | Mixed partial and failure-only integration witnesses | tests/integration/marketplace-layer-remove.test.ts | None |
| 04-02 | 2 | 04-01's decision record and removal-feature changes | Full cascade, clean persistence, and all-blocker refusal witnesses | features/marketplace/remove.feature | None |

Within 04-01, task 1 must complete before tasks 2 and 3. Within each other plan, tasks expand the same owned file sequentially. 04-02 depends on 04-01 because both edit remove.feature. Wave 1 has no file overlap. Existing scenario-owned and integration-owned temporary roots prevent shared fixture or process-state coupling. Each task's needs and observable result are stated in its read_first, action, and acceptance_criteria fields.

Tracer mode is explicitly disabled by the orchestration context. The shipped command/notification/config/session architecture is already exercised by earlier phases; these plans extend its observed contract without building new layers.

## GOAL coverage

| ID | Source item | Plan/task coverage | Status |
|---|---|---|---|
| GOAL-04 | `marketplace remove`/`rm` and `marketplace list`/`ls` have scenarios for every scope and cascade behavior, with the multi-kind remove behavior written as an Outline. | 04-01 tasks 1–3; 04-02 tasks 1–3; 04-03 tasks 1–2; 04-04 tasks 1–2 | COVERED |
| GOAL-04-CLEAN | Clean removal removes the selected marketplace and its installed plugins, with exact output and reload behavior. | 04-01 task 2; 04-02 task 1 | COVERED |
| GOAL-04-PERSIST | Removed plugins, skills, and marketplace remain absent in a new session after clean removal. | 04-02 task 2 | COVERED |
| GOAL-04-SCOPE | Explicit misses and unscoped selection preserve the other scope and report the correct selected/missed scope. | 04-01 tasks 1 and 3 | COVERED |
| GOAL-04-LIST | List and ls report the complete scoped inventory, with project first, insertion order, and details. | 04-03 tasks 1 and 2 | COVERED |

## REQ coverage

| Requirement | Acceptance source | Plan/task coverage | Status |
|---|---|---|---|
| RM-01 | No-plugin removal drops the marketplace without reload; source-kind Outline. | 04-01 task 2 | COVERED |
| RM-02 | Every installed plugin is removed, one uninstalled row each, with reload. | 04-02 task 1; 04-04 tasks 1–2 cover the locked partial-result constraints | COVERED |
| RM-03 | A new session offers no removed skills and plugin list excludes removed plugins. | 04-02 task 2, separate skills and plugin-list scenarios | COVERED |
| RM-04 | The cleanly removed marketplace stays absent in a new session. | 04-02 task 2; existing local-layer persistence scenario retained | COVERED |
| RM-05 | Explicit requested-scope absence reports the appropriate standalone not-added reason. | 04-01 task 3, both absent-everywhere and elsewhere-present directions | COVERED |
| RM-06 | Bare absence reports not-added without scope. | 04-01 task 3 | COVERED |
| RM-07 | rm behaves as remove. | 04-01 tasks 2–3, clean and repeated rm; 04-02 task 1, installed-plugin rm | COVERED |
| RM-08 | Unscoped duplicate-name removal selects only project. | 04-01 tasks 1 and 3 | COVERED |
| LS-01 | No added marketplace means an empty list. | 04-03 task 1 retains the complete empty seed | COVERED |
| LS-02 | Complete project-first inventory includes autoupdate and last-updated. | 04-03 task 1, six-row and singleton override witnesses | COVERED |
| LS-03 | Explicit scope filters the complete inventory. | 04-03 task 2, each populated and each empty selected scope | COVERED |
| LS-04 | ls behaves as list. | 04-03 task 2, populated and empty inventories | COVERED |

## RESEARCH coverage

| ID | Feature or constraint | Plan/task coverage | Status |
|---|---|---|---|
| R01 | Existing stack and infrastructure suffice; no dependency installation. | All plans' discovery/verification sections and T-04-SC | COVERED |
| R02 | Reuse fixed feature layout, kind-neutral publication, complete command/config/session observations; do not add a helper for available capabilities. | 04-01 tasks 2–3; 04-02 tasks 1–3; 04-03 tasks 1–2 | COVERED |
| R03 | One source-kind removal Outline includes active dir/file rows and tagged, excluded url/github rows. | 04-01 task 2; T-04-02 | COVERED |
| R04 | Current project-first removal differs from upstream; record the approved divergence before pinning. | 04-01 task 1; D-MF-05 | COVERED |
| R05 | Missing marketplace results are standalone; preserve actual scope presence and reason rather than inventing cascade rows. | 04-01 task 3 and the live-evidence correction below | COVERED |
| R06 | Use multiple nonalphabetical, non-integer fixture names to discriminate insertion order. | 04-02 tasks 1 and 3; 04-03 tasks 1–2; 04-04 tasks 1–2 | COVERED |
| R07 | Complete list details use the existing scenario-time token and effective autoupdate values. | 04-03 task 1, including local override | COVERED |
| R08 | Existing layer, dependent-plugin, and same-name cross-scope refusal/retention scenarios remain. | 04-01 task 2; 04-02 tasks 1 and 3 | COVERED |
| R09 | Clean persistence needs separate skills, plugin-list, and marketplace-list observations after session restart. | 04-02 task 2 | COVERED |
| R10 | Partial removal continues per plugin, persists successful immediate state, retains failed state and marketplace, and leaves desired declarations untouched. | 04-04 tasks 1–2; 04-02 task 2 limits persistence claims to clean removal | COVERED |
| R11 | Partial-result ordering and reload require machine-envelope proof without adding child schema fields. | 04-04 tasks 1–2 using the existing schema-validating JSON notification boundary | COVERED |
| R12 | Preflight blockers report every blocker before any cascade work and need no reload. | 04-02 task 3 | COVERED |
| R13 | Failure injection stays at the existing integration seam; no production failpoint, new capture helper, or test-only production export. | 04-04 tasks 1–2 | COVERED |
| R14 | Fixtures stay hermetic, with unchanged owned clones/configs and failed artifacts checked at the integration boundary. | 04-04 tasks 1–2; T-04-08 and T-04-10 | COVERED |
| R15 | Focused commands and check:features provide task feedback; npm run check is the combined-tree wave and phase gate. | Every plan verification section and 04-VALIDATION.md | COVERED |
| R16 | Sandbox Pi startup failure is an environment failure, not scenario success. | Every behavioral plan verification section | COVERED |
| R17 | Stale broad codebase maps are not authoritative over live source/PATTERNS. | Live source context in task read_first; serializer correction below | COVERED |
| R18 | Placement assumption A1 uses an existing integration module; fixture assumption A2 uses ordinary nonnumeric names. | 04-04 owns only the existing integration test; ordering tasks name concrete ordinary witnesses | COVERED |

### Live-evidence correction

The discussion's internal message contains `presentInOtherScope: true` for an explicit miss when the other scope holds the name. It is not a wire field. The live `shared/notification-json.ts` marketplace-not-added branch serializes schemaVersion, kind, envelope, name, optional scope, and reasons only. `shared/notification-resolve.ts` resolveNotAddedReason returns the scope-specific reason for that internal flag. Plan 04-01 task 3 therefore asserts `marketplace not added to project scope` or `marketplace not added to user scope` for elsewhere-present misses and never adds a `presentInOtherScope` JSON column. This refines ambiguous research/pattern wording without changing a locked decision or production behavior.

### Research exclusions

Remote stand-ins and RM-09/LS-05 network-observation behavior belong to later phases. The remote Examples are authored and statically checked here but remain excluded. No external service, dashboard, package install, schema expansion, README update, or production redesign is in this phase's source scope.

## CONTEXT coverage

| Decision | Locked behavior | Plan/task coverage | Status |
|---|---|---|---|
| D-01 | Unscoped duplicates select project only, with no warning or user unchanged row. | 04-01 tasks 1 and 3 | COVERED |
| D-02 | Sole-user match remains the unscoped fallback. | 04-01 tasks 1 and 3 | COVERED |
| D-03 | Scope precedes layer; selected project-local-only refuses instead of falling through to user base. | 04-01 tasks 1 and 3 | COVERED |
| D-04 | Per-plugin continuation preserves partial immediate success and failed records, marketplace, and desired declarations. | 04-04 tasks 1–2; 04-02 task 2's clean-only persistence boundary | COVERED |
| D-05 | Preflight failure reports every blocker without mutations, successful rows, or reload. | 04-02 task 3 | COVERED |
| D-06 | Successful uninstalls imply reload; failures do not; aggregate reload iff any success, without new row fields. | 04-04 tasks 1–2 | COVERED |
| D-07 | Listing groups project before user and preserves insertion order within each scope. | 04-03 tasks 1–2 | COVERED |
| D-08 | Cascade successes retain execution order, failures retain discovery order, and success group precedes failure group. | 04-02 tasks 1 and 3; 04-04 tasks 1–2 | COVERED |

## Sizing and verification handoff

The calibration query returned factor 1, sample count 0, and confidence low. Raw and calibrated estimates match: 24,000 tokens for 04-01, 22,000 for 04-02, 18,000 for 04-03, and 22,000 for 04-04. Each plan has two or three tasks, owns no more than two files, and stays within one concern. No task modifies more than five files.

Every task has read_first, exact files and named observations, acceptance_criteria, an automated command followed immediately by fails_when, and done. All 12 requirement IDs occur in plan frontmatter. Threat IDs T-04-01 through T-04-10 are unique; T-04-SC is the reserved repeated supply-chain ID. Each execution summary must include Threat Flags. The planner does not commit or claim runtime execution; the parent workflow validates and commits planning documents.

The separate 04-PROBE-NOTES.md ledger preserves all 28 deterministic probe items: 20 explicit planned criteria and eight flagged assumptions, including both unclassified items. All 120 prohibition-recall candidates passed through the precision filter; no bespoke prohibition was retained. These open probe assumptions remain visible for review and are not missing source requirements.
