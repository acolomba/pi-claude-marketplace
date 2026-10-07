---
phase: 05-mode-selected-json-sink
verified: 2026-10-07T15:40:28Z
status: gaps_found
score: 5/6 must-haves verified
covered_files: [".planning/phases/05-mode-selected-json-sink/05-01-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-01-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-02-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-02-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-03-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-03-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-04-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-04-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-05-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-05-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-06-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-06-SUMMARY.md",".planning/phases/05-mode-selected-json-sink/05-07-PLAN.md",".planning/phases/05-mode-selected-json-sink/05-07-SUMMARY.md","eslint.config.js","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/event-router.ts","extensions/pi-claude-marketplace/bridges/hooks/settle.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts","extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/prune.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts","extensions/pi-claude-marketplace/edge/handlers/shared.ts","extensions/pi-claude-marketplace/edge/register.ts","extensions/pi-claude-marketplace/edge/router.ts","extensions/pi-claude-marketplace/index.ts","extensions/pi-claude-marketplace/orchestrators/auth-host.ts","extensions/pi-claude-marketplace/orchestrators/import/execute.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts","extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts","extensions/pi-claude-marketplace/orchestrators/plugin/info.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts","extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts","extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts","extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts","extensions/pi-claude-marketplace/platform/pi-api.ts","extensions/pi-claude-marketplace/shared/errors.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-run.ts","tests/architecture/catalog-uat/catalog-wire.test.ts","tests/architecture/catalog-uat/mock-pi.ts","tests/architecture/config-state-consistency.test.ts","tests/architecture/cross-op-convergence.test.ts","tests/architecture/hooks-cap-notify.test.ts","tests/architecture/hooks-lifecycle.test.ts","tests/architecture/manifest-read-agreement.test.ts","tests/architecture/no-credential-leak.test.ts","tests/architecture/notify-grammar-invariant.test.ts","tests/architecture/notify-producer-wire-coverage.test.ts","tests/architecture/notify-will-reload-agreement.test.ts","tests/architecture/presentation-sink.test.ts","tests/architecture/workflows-marker-coverage.test.ts","tests/bridges/hooks/async-rewake/registry.test.ts","tests/bridges/hooks/event-router.test.ts","tests/bridges/hooks/if-field/index.test.ts","tests/bridges/hooks/settle.test.ts","tests/e2e/_helpers.ts","tests/edge/handlers/marketplace/add.test.ts","tests/edge/handlers/marketplace/autoupdate.test.ts","tests/edge/handlers/marketplace/info.test.ts","tests/edge/handlers/marketplace/list.test.ts","tests/edge/handlers/marketplace/remove.test.ts","tests/edge/handlers/marketplace/shared.test.ts","tests/edge/handlers/marketplace/update.test.ts","tests/edge/handlers/plugin/bootstrap.test.ts","tests/edge/handlers/plugin/browse.test.ts","tests/edge/handlers/plugin/enable-disable.test.ts","tests/edge/handlers/plugin/fetch.test.ts","tests/edge/handlers/plugin/help.test.ts","tests/edge/handlers/plugin/import.test.ts","tests/edge/handlers/plugin/info.test.ts","tests/edge/handlers/plugin/install.test.ts","tests/edge/handlers/plugin/list.test.ts","tests/edge/handlers/plugin/pending.test.ts","tests/edge/handlers/plugin/prune.test.ts","tests/edge/handlers/plugin/reinstall.test.ts","tests/edge/handlers/plugin/shared.test.ts","tests/edge/handlers/plugin/uninstall.test.ts","tests/edge/handlers/plugin/update.test.ts","tests/edge/handlers/shared.test.ts","tests/edge/json-capture.ts","tests/edge/notification-boundary.ts","tests/edge/register.test.ts","tests/edge/router.test.ts","tests/index.test.ts","tests/integration/auth-e2e.test.ts","tests/integration/fold-adoption.test.ts","tests/integration/hooks-additionalcontext-end-to-end.test.ts","tests/integration/hooks-cross-scope-reconcile.test.ts","tests/integration/hooks-dispatch-end-to-end.test.ts","tests/integration/hooks-spawn-end-to-end.test.ts","tests/integration/ipc-child.ts","tests/integration/marketplace-add-seed-mirrors.test.ts","tests/integration/path-source-tag-install.test.ts","tests/integration/transaction-lifecycle-cascade.test.ts","tests/integration/workflow-kind-inversion.test.ts","tests/orchestrators/auth-host.test.ts","tests/orchestrators/import/execute.test.ts","tests/orchestrators/marketplace/add.test.ts","tests/orchestrators/marketplace/autoupdate.test.ts","tests/orchestrators/marketplace/info.test.ts","tests/orchestrators/marketplace/list.test.ts","tests/orchestrators/marketplace/remove.test.ts","tests/orchestrators/marketplace/shared.test.ts","tests/orchestrators/marketplace/update.test.ts","tests/orchestrators/plugin/dependency-tag-probe.test.ts","tests/orchestrators/plugin/enable-disable.test.ts","tests/orchestrators/plugin/fetch.test.ts","tests/orchestrators/plugin/info.test.ts","tests/orchestrators/plugin/install-cascade.messaging.test.ts","tests/orchestrators/plugin/install-cascade.test.ts","tests/orchestrators/plugin/install-clone-probe.test.ts","tests/orchestrators/plugin/install-flow.test.ts","tests/orchestrators/plugin/install-outcome.test.ts","tests/orchestrators/plugin/list-flow.test.ts","tests/orchestrators/plugin/operations.test.ts","tests/orchestrators/plugin/reinstall-clone-probe.test.ts","tests/orchestrators/plugin/reinstall-flow.test.ts","tests/orchestrators/plugin/reinstall.messaging.test.ts","tests/orchestrators/plugin/shared.test.ts","tests/orchestrators/plugin/uninstall.test.ts","tests/orchestrators/plugin/update-constraint-gate.test.ts","tests/orchestrators/plugin/update-flow.test.ts","tests/orchestrators/plugin/update-preflight.test.ts","tests/orchestrators/reconcile/apply.test.ts","tests/platform/pi-api.test.ts","tests/shared/errors.test.ts","tests/shared/notification-dispatch.test.ts","tests/shared/notification-run-seeds.ts","tests/shared/notification-run.test.ts","tests/shared/notification-summary.test.ts","tests/shared/notify-context.test.ts"]
covered_digest: "v3:sha256:d2b7ff8b21d00ca6bb61c4135b295c7758655e92e926e70ab83567af547ff719"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "Unknown modes are rejected before any fresh state change at every lifecycle and hook callback root."
    status: failed
    reason: "Three registered hook callbacks have no live mode guard; a fourth clears state before its guard. An unsupported input resets the Stop-cap latch without reading ctx.mode."
    artifacts:
      - path: "extensions/pi-claude-marketplace/bridges/hooks/event-router.ts"
        issue: "before_agent_start, agent_end, and the second input subscription use bind without mode validation."
      - path: "extensions/pi-claude-marketplace/bridges/hooks/settle.ts"
        issue: "inputResetHandlerFor calls recordUserInput without context; settleHandlerFor takes and clears last assistant before validating mode."
    missing:
      - "Guard each fresh state-changing callback against the live mode before mutation, while preserving generation checks and independent cleanup."
      - "Add registered-callback tests that prove unsupported and throwing modes leave pending context, assistant cache, and Stop-cap state unchanged."
assumption_dispositions:
  - id: A-05-01
    status: failed
    reason: "Independent root inventory found the unguarded input reset and other state-changing callbacks."
  - id: A-05-02
    status: verified_for_enumerated_output_paths
    reason: "Generation checks and narrow catches cover the named load, session-start, rewake, and Stop output paths."
unverified_prohibitions:
  - id: P-05-01
    status: flagged
    tier: judgment
    note: "Non-authoritative code review is favorable; human product-intent review remains required."
  - id: P-05-02
    status: flagged
    tier: judgment
    note: "Non-authoritative code review is favorable; human transparency review remains required."
---

# Phase 5: Mode-Selected JSON Sink Verification Report

**Phase goal:** In json/rpc, every /claude:plugin output reaches consumers as a claude-plugin session entry through pi.appendEntry; one exhaustive live-mode switch selects it, while tui/print retain text.

**Verdict:** BLOCKER. The machine transport and failure containment are implemented, but MODE-02 and roadmap success criterion 2 are false at several hook callback roots. The phase must not advance as passed. P-05-01 and P-05-02 remain separately flagged for human judgment.

## Goal achievement

| # | Roadmap success criterion | Status | Code and behavioral evidence |
| --- | --- | --- | --- |
| 1 | All structured/raw surfaces use exclusive machine transport; text stays pinned | VERIFIED | `notification-dispatch.ts:388-405` selects transport; catalog-wire exercises 260 tuples and eight raw kinds in each machine mode with retaining capture; current strict corpus says 3149 present/0 extras, and catalog/schema diffs are empty. |
| 2 | Live exhaustive selection, unknown-mode rejection before state changes, contained lifecycle errors | **FAILED (BLOCKER)** | The command and six fresh hook dispatch guards work, but `event-router.ts:986-1016` registers unguarded state-changing callbacks and `settle.ts:67-77,142-152` mutates before validation. Direct reproduction below. |
| 3 | Dispatcher exclusively calls appendEntry and planted calls fail lint | VERIFIED | Production search finds one call at `notification-dispatch.ts:403`; `eslint.config.js:108-119,345-378` composes direct/computed/optional member selectors. The recorded in-memory planted controls cover six append forms and retained NFR-5; current full lint passed. |
| 4 | Pre-bind/stale sink errors do not escape four named lifecycle paths | VERIFIED | `index.ts:88-175`, `event-router.ts:891-924`, `registry.ts:397-475`, and `settle.ts:398-407` contain named output failures. The owner suites run below exercise these transitions. This does not excuse the separate pre-guard state mutation in criterion 2. |
| 5 | Explicit fake modes and retaining schema capture | VERIFIED | `NotificationContext.mode` is required at `pi-api.ts:142-145`; audited ExtensionContext cast sites carry explicit mode. `json-capture.ts:23-49` retains every append/UI failure until assertValid, and catalog-wire calls assertValid after emissions. |
| 6 | Empty diagnostic/rewake no-ops and contained Stop-cap notify | VERIFIED | `notification-dispatch.ts` suppresses the exact empty inputs; `settle.ts:398-407` records the cap before its narrow output catch. Owner tests and catalog cases exercise nonempty/empty distinctions and cap failure state. |

**Score:** 5/6 roadmap truths verified; zero behavior-dependent truths were promoted on symbol presence alone. No accepted override exists. Phase 6's command error wrapping and Phase 7's browse/auth policy and real-Pi e2e do not cover this MODE-02 gap, so nothing is deferred.

### A-05-01: fresh mutation roots

The fixed `bindDispatch` checks live `ctx.mode` after the generation check and before the six fresh hook dispatch callbacks. The command root, load preparation, session-start hydration, async terminal output, and Stop work also have explicit guards. The inventory is still incomplete: `before_agent_start` drains pending context, `agent_end` caches assistant state, and a second `input` subscription resets Stop-cap state through plain `bind`, without a mode check. `settleHandlerFor` clears the cached assistant via `takeLastAssistant()` before validating mode. These are state changes, not read-only discovery or terminal-child cleanup. D-05-02 explicitly disallows continuing mutations in an unsupported mode.

A read-only reproduction on the current HEAD called the exported input-reset callback after seven Stop reentries with a getter that throws if `ctx.mode` is read. It returned without error, made **zero mode reads**, and the next `recordStopReentry()` returned `{"reenter":true,"notifyCap":false}`. Without the reset, the eighth transition reaches the cap. The same callback is registered as the second input handler in `event-router.ts:1009-1017`. This falsifies MODE-02 even though the existing 108 event-router owner tests pass.

### A-05-02: stale output paths

The output-bearing callback review found generation checks ahead of stale hook work, terminal child removal and PID persistence ahead of rewake output, independent load warning catches, guarded session-start mutation, and a cap transition ahead of the Stop warning catch. Stale output errors are contained in the enumerated lifecycle paths. This is an independent code judgment supported by targeted owner suites; the edge probe's original unclassified row remains in its historical JSON record. It does not resolve A-05-01.

## Plan truth, artifact, and link checks

All seven PLAN/SUMMARY pairs were read as claims and traced back to current source. `verify.artifacts` returned **24/24 existing/substantive**. Manual import, argument-flow, and callback checks found the 21 declared key links wired. The generic `verify.key-links` query reported 20 false negatives because it searched literal full root-relative target paths while TypeScript imports use relative paths; one link passed its heuristic. The manual trace used the actual imports and call expressions, including router→usage helpers, diagnostic producers→parent run, auth-host→device prompt, load→discovery/warnings, rewake/settle→hook helpers, and catalog harness→capture.

| Plan | Truth disposition | Supporting evidence |
| --- | --- | --- |
| 05-01 | 7/7 VERIFIED; P-05-01 flagged separately | `requireNotificationMode`, original-host run, live dispatcher, capture ledger, root list and lint controls. |
| 05-02 | 4/4 VERIFIED | Root and nested parsers pass the original run; mixed/duplicate emission and unchanged text cases. |
| 05-03 | 4/4 VERIFIED | Import, plugin discovery, and reconcile diagnostics pass the parent run; empty/duplicate/redaction cases. |
| 05-04 | 5/5 VERIFIED | Auth callback passes only URI/code through original run, with live mode; stored-only branch has no prompt capability. |
| 05-05 | 6/6 VERIFIED at its specifically named load/session surfaces | Protected load and session-start mutation, independent discovery/PATH recovery, opt-in debug logging. |
| 05-06 | 6/6 VERIFIED at its specifically named rewake/Stop surfaces; P-05-02 flagged separately | Terminal cleanup, generation defense, cap persistence and narrow output catch. |
| 05-07 | 5/6 VERIFIED; the broad owner-proof claim is FAILED | Catalog and raw transport, exact pins, retained capture, and combined-tree check are proven. Its statement that owner tests prove ordinary unsupported-mode rejection before writes is contradicted by the unguarded input reset. Its flagged-probe truth is preserved here. |

Data flow reaches the real Pi host through the run's required `entrySink`: command, load, rewake and Stop roots construct a run from `pi`; nested helpers reuse it; the dispatcher converts the resolved presentation and calls `appendEntry("claude-plugin", payload)`. The capture helper is test-only. No production source ends at a static payload/mock sink.

## Requirements coverage

| ID | Verdict | Evidence |
| --- | --- | --- |
| MODE-01 | SATISFIED | Exact-mode membership, live exhaustive switch, text/machine cases. |
| MODE-02 | **BLOCKED** | Unsupported input-reset and other state callbacks mutate without validation; direct reproduction above. |
| JOUT-01 | SATISFIED | One append owner; exclusive catalog/raw capture in both machine modes; lint controls. |
| JOUT-05 | SATISFIED for the named output paths | Stale/pre-bind append failures contained in resources_discover, session_start, rewake and Stop settle. |
| TENB-01 | SATISFIED | Retaining schema capture and explicit final assertions. |
| TENB-02 | SATISFIED | Required context mode and audited explicit fake modes, including the nine corrected predicate fixtures. |

All six phase IDs appear in PLAN frontmatter and REQUIREMENTS.md; no phase-mapped requirement is orphaned. The decision-coverage query reported 8/8 honored, but its heuristic does not establish MODE-02 behavior.

## Behavioral checks and test quality

| Check | Result |
| --- | --- |
| Current `node --test --test-isolation=none` owner suites for event-router, register, settle, and async-rewake registry | 108, 192, 43, and 48 tests passed respectively, no failures/skips. |
| Parent `npm run check` at `cd569d2aeb02f2691a636e325fc3c7976c4952c1`, Node v26.10.0 | Exit 0; typecheck, lint, Fallow, format/pairing, tests, and all 264 direct-coverage pairs. Exact non-planning-Markdown diff from that commit to HEAD is empty; working tree had no untracked executable input. |
| Parent strict corpus check at that commit | Exit 0; 3149 baseline entries present, zero extras and no missing/extra lines. |
| Current independent Stop-cap reset reproduction | **FAIL** for MODE-02: unsupported context never read and cap latch reset. |
| Catalog/schema baseline | `git diff --exit-code 26cb0056 HEAD -- docs/output-catalog.md schema/claude-plugin.schema.json` exited 0. |

Requirement-linked owner tests are active and assert values/state, not mere existence. No `test.skip`, `test.todo`, `test.only`, or unreferenced `TBD`/`FIXME`/`XXX` appeared in the inspected phase files. There are no declared `probe-*.sh` paths; `05-PROBES.md` is a planning probe record, not an executable probe. The current full check remains valid under the project's unchanged-input rule; it does not prove the missing behavior.

## Prohibitions requiring human judgment

**P-05-01 — report delivery must not become a model instruction or trigger a turn.** The non-authoritative code review finds that `notification-dispatch.ts` only calls `appendEntry` for reports. `sendMessage` and `before_agent_start` live in independent hook completion/context paths. The descriptorless, unresolved prohibition cannot be certified by the full test run. Human review should inspect a live machine-mode command output alongside hook completion and confirm that the report alone adds neither an instruction nor a new turn.

**P-05-02 — Stop-cap warning must retain its meaning and severity.** The non-authoritative review finds `RAW_SURFACE_SEVERITY["stop-override-cap"] === "warning"`; text names the plugin, eight-block cap and ended turn; JSON keeps `kind`, `pluginId`, `cap` and warning severity. The user-approved D-05-03 opt-in logging risk covers delivery failure visibility, not a change in warning wording. Human review should judge the visible text and session entry after a cap event. Both prohibitions remain flagged-unverified; no descriptor or approval was invented.

## Gaps summary

The mode check must cover the remaining state-changing hook callbacks before Phase 05 can pass. Add registered-callback tests that start with meaningful pending/Stop state, invoke each callback under unsupported and throwing live modes, and assert no fresh state mutation. Preserve independent cleanup and existing hook completion injection. After that fix, rerun the applicable owner tests and the combined-tree gate, then reverify this report. The two judgment-tier prohibitions still require an explicit end-of-phase human disposition.

---

_Verified: 2026-10-07T15:40:28Z_
_Verifier: gsd-verifier_
