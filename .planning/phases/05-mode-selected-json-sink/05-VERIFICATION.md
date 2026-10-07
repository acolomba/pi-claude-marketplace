---
phase: 05-mode-selected-json-sink
verified: 2026-10-07T16:39:53Z
status: passed
score: 6/6 must-haves verified
covered_files: [".planning/phases/05-mode-selected-json-sink/05-01-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-01-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-02-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-02-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-03-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-03-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-04-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-04-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-05-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-05-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-06-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-06-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-07-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-07-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-UAT.md","eslint.config.js","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/settle.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts","extensions/pi-claude-marketplace/edge/handlers/shared.ts","extensions/pi-claude-marketplace/edge/register.ts","extensions/pi-claude-marketplace/edge/router.ts","extensions/pi-claude-marketplace/index.ts","extensions/pi-claude-marketplace/orchestrators/auth-host.ts","extensions/pi-claude-marketplace/orchestrators/import/execute.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts","extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts","extensions/pi-claude-marketplace/platform/pi-api.ts","extensions/pi-claude-marketplace/shared/errors.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-run.ts","tests/architecture/catalog-uat/catalog-wire.test.ts","tests/architecture/catalog-uat/mock-pi.ts","tests/architecture/config-state-consistency.test.ts","tests/architecture/cross-op-convergence.test.ts","tests/architecture/hooks-cap-notify.test.ts","tests/architecture/hooks-lifecycle.test.ts","tests/architecture/manifest-read-agreement.test.ts","tests/architecture/no-credential-leak.test.ts","tests/architecture/notify-grammar-invariant.test.ts","tests/architecture/notify-producer-wire-coverage.test.ts","tests/architecture/notify-will-reload-agreement.test.ts","tests/architecture/presentation-sink.test.ts","tests/architecture/workflows-marker-coverage.test.ts","tests/bridges/hooks/async-rewake/registry.test.ts","tests/bridges/hooks/event-router.test.ts","tests/bridges/hooks/if-field/index.test.ts","tests/bridges/hooks/settle.test.ts","tests/e2e/_helpers.ts","tests/edge/handlers/marketplace/add.test.ts","tests/edge/handlers/marketplace/autoupdate.test.ts","tests/edge/handlers/marketplace/info.test.ts","tests/edge/handlers/marketplace/list.test.ts","tests/edge/handlers/marketplace/remove.test.ts","tests/edge/handlers/marketplace/shared.test.ts","tests/edge/handlers/marketplace/update.test.ts","tests/edge/handlers/plugin/bootstrap.test.ts","tests/edge/handlers/plugin/browse.test.ts","tests/edge/handlers/plugin/enable-disable.test.ts","tests/edge/handlers/plugin/fetch.test.ts","tests/edge/handlers/plugin/help.test.ts","tests/edge/handlers/plugin/import.test.ts","tests/edge/handlers/plugin/info.test.ts","tests/edge/handlers/plugin/install.test.ts","tests/edge/handlers/plugin/list.test.ts","tests/edge/handlers/plugin/pending.test.ts","tests/edge/handlers/plugin/prune.test.ts","tests/edge/handlers/plugin/reinstall.test.ts","tests/edge/handlers/plugin/shared.test.ts","tests/edge/handlers/plugin/uninstall.test.ts","tests/edge/handlers/plugin/update.test.ts","tests/edge/handlers/shared.test.ts","tests/edge/json-capture.ts","tests/edge/notification-boundary.ts","tests/edge/register.test.ts","tests/edge/router.test.ts","tests/index.test.ts","tests/integration/auth-e2e.test.ts","tests/integration/fold-adoption.test.ts","tests/integration/hooks-additionalcontext-end-to-end.test.ts","tests/integration/hooks-cross-scope-reconcile.test.ts","tests/integration/hooks-dispatch-end-to-end.test.ts","tests/integration/hooks-spawn-end-to-end.test.ts","tests/integration/ipc-child.ts","tests/integration/marketplace-add-seed-mirrors.test.ts","tests/integration/path-source-tag-install.test.ts","tests/integration/transaction-lifecycle-cascade.test.ts","tests/integration/workflow-kind-inversion.test.ts","tests/orchestrators/auth-host.test.ts","tests/orchestrators/import/execute.test.ts","tests/orchestrators/marketplace/add.test.ts","tests/orchestrators/marketplace/autoupdate.test.ts","tests/orchestrators/marketplace/info.test.ts","tests/orchestrators/marketplace/list.test.ts","tests/orchestrators/marketplace/remove.test.ts","tests/orchestrators/marketplace/shared.test.ts","tests/orchestrators/marketplace/update.test.ts","tests/orchestrators/plugin/dependency-tag-probe.test.ts","tests/orchestrators/plugin/enable-disable.test.ts","tests/orchestrators/plugin/fetch.test.ts","tests/orchestrators/plugin/info.test.ts","tests/orchestrators/plugin/install-cascade.messaging.test.ts","tests/orchestrators/plugin/install-cascade.test.ts","tests/orchestrators/plugin/install-clone-probe.test.ts","tests/orchestrators/plugin/install-flow.test.ts","tests/orchestrators/plugin/install-outcome.test.ts","tests/orchestrators/plugin/list-flow.test.ts","tests/orchestrators/plugin/operations.test.ts","tests/orchestrators/plugin/reinstall-clone-probe.test.ts","tests/orchestrators/plugin/reinstall-flow.test.ts","tests/orchestrators/plugin/reinstall.messaging.test.ts","tests/orchestrators/plugin/shared.test.ts","tests/orchestrators/plugin/uninstall.test.ts","tests/orchestrators/plugin/update-constraint-gate.test.ts","tests/orchestrators/plugin/update-flow.test.ts","tests/orchestrators/plugin/update-preflight.test.ts","tests/orchestrators/reconcile/apply.test.ts","tests/platform/pi-api.test.ts","tests/shared/errors.test.ts","tests/shared/notification-dispatch.test.ts","tests/shared/notification-run-seeds.ts","tests/shared/notification-run.test.ts","tests/shared/notification-summary.test.ts","tests/shared/notify-context.test.ts"]
covered_digest: "v3:sha256:76089d45a9f3720fcca795b2d237354d07b5824f3543330cd3c8697ab9e78688"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 5/6
  gaps_closed:
    - "A-05-01 / MODE-02: unknown modes must be rejected before fresh hook bookkeeping or Stop-cap state changes."
  gaps_remaining: []
  regressions: []
assumption_dispositions:
  - id: A-05-01
    status: verified
    reason: "All 11 registered callbacks were traced; the remaining bookkeeping roots now validate live mode after generation checks and before state mutation."
  - id: A-05-02
    status: verified_for_enumerated_output_paths
    reason: "Generation checks and narrow catches still cover the named load, session-start, rewake, and Stop output paths."
human_resolution:
  source: ".planning/phases/05-mode-selected-json-sink/05-UAT.md"
  response: "approve"
  status: complete
  prohibitions:
    - id: P-05-01
      disposition: accepted_by_human
      uat_test: 1
    - id: P-05-02
      disposition: accepted_by_human
      uat_test: 2
---

# Phase 5: Mode-Selected JSON Sink Verification Report

**Phase goal:** In json/rpc, every /claude:plugin output reaches consumers as a claude-plugin session entry through pi.appendEntry; one exhaustive live-mode switch selects it, while tui/print retain text.

**Verdict:** **Passed.** All six roadmap success criteria and all six in-phase requirements have implementation and behavioral evidence. The prior MODE-02 blocker is closed. The user explicitly approved both remaining intent judgments, P-05-01 and P-05-02, in the completed `05-UAT.md` session. That approval resolves the human checkpoint; it is recorded separately from the automated code and test evidence.

## Re-verification of A-05-01 / MODE-02

The previous report found three registered hook callbacks that changed state without reading the mode, plus Stop settle consuming its assistant cache before validation. Commit `191f75e83dfa3fc26a43edaee315ce72da831ac2` addresses those exact paths:

| Root | First fresh state change | Current guard |
| --- | --- | --- |
| `before_agent_start` | Drain pending context | `event-router.ts:987-990` registers through `bindWithMode`. |
| `agent_end` | Replace assistant cache | `event-router.ts:994-997` registers through `bindWithMode`. |
| Second `input` subscription | Reset Stop-active state, count, and cap latch | `event-router.ts:1007-1010` registers through `bindWithMode`. |
| `agent_settled` | Consume assistant cache | `settle.ts:133-149` checks live mode before `takeLastAssistant`. |

The first six hook dispatch registrations also use `bindWithMode`; `session_start` retains its explicit guard before hydration, routing rebuild, and shared-directory creation. This covers all 11 real `pi.on` registrations, counting the two `input` subscriptions separately. `bindRegistrationCallback` checks the captured generation before the wrapper accesses `ctx`, and the wrapper catches only mode validation; callback execution stays outside the catch. Factory registration resets, prior-child shutdown, orphan reaping, and terminal child/PID cleanup remain independent.

I reran the original exported `inputResetHandlerFor` helper-only reproduction. It still resets cap state without reading a supplied context because that helper takes no context. The production search found **one** caller, the now-guarded second `input` registration. The decisive production-path reproduction is the registered callback test: after seven reentries, a live mode change to an unsupported string leaves the eighth transition at `{reenter:false, notifyCap:true}`. That named test passed on current HEAD. Named tests also passed for a throwing mode getter preserving pending context, unsupported `agent_end` preserving cache, throwing `agent_settled` preserving cache, and all 11 stale registrations returning before argument access. These are state assertions; removing the guards would fail them. The fixer's 54-case RED run, 205-case GREEN owner run, and both pairs at 100% direct coverage provide further evidence, but the conclusion rests on the current source and independent named runs.

Moving `openNotificationRun(pi)` outside the old Stop-branch catch creates no uncovered pre-bind throw: `pi-api.ts:161-209` catches all three tool-inventory access failures, and `notification-run.ts:37-38` stores the host without reading `appendEntry`. Sink access remains in the Stop-cap notification catch. No failed truth or regression remains from the previous report.

## Roadmap truths

| # | Success criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | All structured/raw output uses exclusive machine transport; text stays pinned | VERIFIED | `notification-dispatch.ts:388-405` selects transport; catalog-wire exercises 260 tuples and eight raw kinds per machine mode with retaining capture. Current strict corpus reports 3149 present/0 extras; catalog/schema diffs are empty. |
| 2 | Live exhaustive switch and typed unknown-mode rejection precede mutations; lifecycle errors stay contained | VERIFIED | `requireNotificationMode`, command/load guards, all 11 hook registrations, and early settle guard. The registered Stop-cap and cache/pending-context transition tests passed. |
| 3 | Dispatcher exclusively calls appendEntry; planted calls fail lint | VERIFIED | Production search finds one `appendEntry` call at `notification-dispatch.ts:403`; ESLint ownership selectors and recorded in-memory planted controls cover direct/computed/optional forms. Current full lint passed. |
| 4 | Pre-bind/stale output failures do not escape named lifecycle paths | VERIFIED | Load/session-start, async terminal, and Stop output have narrow catches; named owner tests cover state and generation transitions. The new guard preserves independent recovery. |
| 5 | Context fakes require explicit mode; capture retains and validates every payload | VERIFIED | `NotificationContext.mode` is required; audited ExtensionContext casts supply mode. `json-capture.ts:23-49` retains append/UI failures until `assertValid`, called after catalog emissions. |
| 6 | Empty diagnostic/rewake no-ops and contained Stop-cap output | VERIFIED | Exact empty checks remain in dispatcher; `settle.ts` records cap before guarded warning delivery. Owner tests exercise empty/whitespace and cap failure states. |

**Score:** 6/6 truths verified, with zero present-but-behavior-unverified truths and zero overrides. No later phase absorbs a Phase 05 gap; Phase 6 command error wrapping and Phase 7 browse/auth mode policy and real-Pi e2e remain their separately recorded scope.

## Artifacts, wiring, and requirements

The prior initial verification inspected every artifact and connection against code: `verify.artifacts` found **24/24** substantive artifacts; manual import and call-flow tracing found all **21** declared key links wired. The generic key-link query's 20 literal full-path false negatives came from relative TypeScript imports, so its negative output was not treated as proof of broken wiring. On re-verification the failed hook roots received full source, caller, and behavioral review; previously passing artifacts and links received existence/basic regression checks. The two changed source/test pairs are present, active and wired. No rendered value ends in a static or mock production sink: command/load/hook roots open a run over the real `pi`, nested producers reuse it, and the dispatcher converts a resolved presentation before `appendEntry("claude-plugin", payload)`.

| Requirement | Status | Evidence |
| --- | --- | --- |
| MODE-01 | SATISFIED | Exact membership and one live exhaustive switch. |
| MODE-02 | SATISFIED after gap closure | Eleven registered hook callbacks and Stop settle now guard live mode before fresh state changes; named state tests pass. |
| JOUT-01 | SATISFIED | Sole append owner, exclusive catalog/raw capture in json/rpc, lint controls. |
| JOUT-05 | SATISFIED | Named load/session/rewake/Stop pre-bind and stale output failures are contained. |
| TENB-01 | SATISFIED | Retaining schema capture and final assertions. |
| TENB-02 | SATISFIED | Required mode and explicit test fakes, including the nine corrected predicate fixtures. |

All six phase IDs are in PLAN frontmatter and REQUIREMENTS.md; none is orphaned. The CONTEXT decision query reported 8/8 honored. Every plan-specific truth passed after closing 05-07's broad unsupported-mode owner-proof claim. P-05-01 and P-05-02 were separate must-NOT judgments; their human-approved dispositions are recorded in `05-UAT.md`, not counted as automated plan-truth passes.

## Behavioral and quality evidence

| Check | Current result |
| --- | --- |
| Named registered seven-entry Stop-cap reproduction | PASS: unsupported input cannot reset the cap. |
| Named pending-context, agent-end/settled cache, and all-registration stale-generation tests | PASS: five additional state checks exercise the formerly missing paths. |
| Parent `npm run check` at clean `191f75e83dfa3fc26a43edaee315ce72da831ac2`, Node v26.10.0 | Exit 0: static checks, tests, and all 264 direct-coverage pairs. Exact non-planning-Markdown diff to current HEAD is empty and no untracked executable input exists, so this result is reusable under `skills/local-verification/SKILL.md`. |
| Parent strict corpus check at the same build inputs | Exit 0: 3149 baseline entries present, zero extras, no missing/extra lines. |
| Catalog and schema against `26cb0056` | `git diff --exit-code` returned 0. |

The changed owner suites have 148 event-router and 57 settle tests; the fixer's GREEN run passed all 205 and the mandatory commit hook measured 100% line/function/branch direct coverage for both pairs. The current named tests make whole-state assertions and are not disabled. No unreferenced `TBD`/`FIXME`/`XXX` marker or new stub appeared in the four changed files. No `probe-*.sh` is declared; `05-PROBES.md` remains a planning probe record, not an executable probe.

## Human intent judgments resolved

The completed [05-UAT.md](05-UAT.md) records the user's verbatim response, “approve,” after both checks were presented for explicit approval. Both tests have `result: pass`; the session records two passed, zero pending, and zero issues. These are human dispositions, not claims that a test suite proved product intent.

| Prohibition | Human-approved disposition | Supporting code evidence |
| --- | --- | --- |
| P-05-01 — reports remain session data | Approved in UAT test 1. The report itself adds no model instruction or turn; separate hook completion behavior retains its contract. | The sole report sink is `appendEntry("claude-plugin", payload)` in the live mode switch; hook completion paths are separate. |
| P-05-02 — Stop-cap warning remains clear | Approved in UAT test 2. The warning identifies the plugin, eight-block cap, ended turn despite the active block, and warning severity. | Text names those facts; the JSON payload carries `pluginId`, `cap: 8`, and `severity: "warning"`. |

No enforcement descriptor was invented from the approval. The historical probe documents remain planning evidence; this report uses the explicit UAT decision to close the two human review items. Phase 7's real-Pi e2e remains outside this phase.
---

_Verified: 2026-10-07T16:39:53Z_
_Verifier: gsd-verifier_
