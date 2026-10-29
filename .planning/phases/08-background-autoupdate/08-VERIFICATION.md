---
phase: 08-background-autoupdate
verified: 2026-10-29T13:42:50Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - .planning/phases/08-background-autoupdate/08-01-PLAN.md
  - .planning/phases/08-background-autoupdate/08-01-SUMMARY.md
  - .planning/phases/08-background-autoupdate/08-02-PLAN.md
  - .planning/phases/08-background-autoupdate/08-02-SUMMARY.md
  - .planning/phases/08-background-autoupdate/08-03-PLAN.md
  - .planning/phases/08-background-autoupdate/08-03-SUMMARY.md
  - .planning/phases/08-background-autoupdate/08-04-PLAN.md
  - .planning/phases/08-background-autoupdate/08-04-SUMMARY.md
  - AGENTS.md
  - docs/env-vars.md
  - docs/json-output.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/official-marketplaces.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-pass.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/background-update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/persistence/config-merge.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-run.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - features/lib/https-git-host/server.ts
  - features/lib/pi-commands.ts
  - features/lib/pi-tui-pty.py
  - features/lib/pi-tui.ts
  - features/lib/result-rows.ts
  - features/marketplace/background-update.feature
  - features/step_definitions/git-host.steps.ts
  - features/step_definitions/marketplace/background-update.steps.ts
  - features/step_definitions/session.steps.ts
  - features/support/pi-process.ts
  - features/support/world.ts
  - schema/claude-plugin.schema.json
  - test/architecture/background-update-notice.test.ts
  - test/architecture/catalog-uat/catalog-wire.test.ts
  - test/architecture/hermetic-git-environment.test.ts
  - test/architecture/no-credential-leak.test.ts
  - test/architecture/pi-tui-notices.test.ts
  - test/architecture/wire-schema.test.ts
  - test/domain/official-marketplaces.test.ts
  - test/e2e/_rpc.ts
  - test/edge/handlers/marketplace-seed.ts
  - test/edge/register.test.ts
  - test/index.test.ts
  - test/orchestrators/marketplace/background-gate.test.ts
  - test/orchestrators/marketplace/background-pass.test.ts
  - test/orchestrators/marketplace/background-update.test.ts
  - test/orchestrators/marketplace/update.test.ts
  - test/platform/hermetic-environment.ts
  - test/shared/notification-dispatch.test.ts
  - test/shared/notification-grammar.test.ts
  - test/shared/notification-json.test.ts
  - test/shared/notification-resolve.test.ts
  - test/shared/notification-wire.test.ts
covered_digest: "v4:sha256:ba04c850818c9e6c41b1cf6bacfc7969316b548ab14fe7106b6dc9c11eb05e2f"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 8: Background Autoupdate Verification Report

**Phase goal:** A marketplace with autoupdate on is refreshed and its plugins updated in the background after a session starts, as Claude Code does, with one passive notice.
**Verified:** 2026-10-29T13:42:50Z
**Status:** passed
**Re-verification:** Yes; the earlier report predates the current TUI, default, notice, and cancellation decisions.

## Goal Achievement

### Observable Truths

| # | Roadmap truth | Status | Current evidence |
| --- | --- | --- | --- |
| 1 | After a session starts, an opted-in marketplace refreshes and updates installed plugins after the decided delay, without a command. | VERIFIED | `index.ts` registers `input` and `session_shutdown`; `background-update.ts:95-112` arms once on first TUI input and schedules an unref'd timer using the injected random delay. `background-pass.ts:166-173,355-369` selects recorded marketplaces in project-then-user order and invokes the real `updateMarketplace` path. The real PTY scenario in `background-update.feature:11` sends a message and confirms the installed version moved from 1.0.0 to 1.10.0. The RPC negative scenario at `:124` confirms RPC does not arm. |
| 2 | A concurrent foreground command is neither refused nor corrupted by this process's background run. | VERIFIED | `edge/register.ts` wraps command execution in `runForeground`; `index.ts` supplies the same runtime gate to commands and the background pass. `background-gate.ts` gives commands priority without serializing commands: at 30 seconds it aborts the active signal, then still waits for `endStep`. `background-pass.ts` yields plugin updates and dependency settlement through fresh gate steps and rechecks stop/abort after the asynchronous config read. The named tests `D-PL8-23: at the cap...`, `a runtime stopped during the plugin config read...`, and `a plugin step aborted during the config read...` all pass. The last two prove CR-01's `f61d5848` fix: no plugin update or dependency settlement starts after the race, later targets skip, and no notice is emitted. The real PTY streamed-git scenario proves the command remains blocked before the cap, abort reaches `/info/refs`, dependency settlement does not run, and the command resumes only after settlement. |
| 3 | Defaults and opt-outs match the recorded Claude Code mapping. | VERIFIED | `official-marketplaces.ts:39-44` applies an explicit value first, then the official-name default, excluding two documented default-off names. `config-merge.ts` gives an explicit local field precedence over base; `background-pass.ts:156-163` refuses background work when either config layer is invalid. `background-update.ts:49-78` implements the opt-outs, FORCE precedence, and validated delay knob. Owner tests cover official/default-off names, explicit values, invalid config, env values, timers, and TUI-only scheduling. `docs/env-vars.md` records the Pi mapping and unsupported upstream settings. |
| 4 | One passive notice names updated plugins and `/reload`; an unchanged run is silent. | VERIFIED | `background-pass.ts:374-417` collects real `updated` outcomes across both scopes and emits once after the pass, including updates completed before an early error; stopped runtimes emit nothing. `notification-dispatch.ts:268-276` suppresses an empty list. `notification-grammar.ts:1322` deduplicates text by bare plugin name in first-seen order under D-PL8-21. The wire retains one row per updated installation, with load origin, info severity, and `needsReload: true`; `notification-resolve.ts:974` redacts all string fields. Same-name and distinct-name real TUI scenarios at `background-update.feature:30,60` prove visible text and both installed results. `background-pass.test.ts:1409` asserts exactly one notification entry; `:1462,1486` covers unchanged and stopped silence. |

**Score:** 4/4 roadmap truths verified; 0 behavior-unverified.

### Current Contract and Historical Plan Text

The four PLANs contain 19 authored truth statements. Accepted decisions supersede these older literal clauses:

| Historical clause | Current authority and verified behavior |
| --- | --- |
| 08-01 and 08-04 expected RPC to schedule and show a positive notice. | The current D-PL8-02 contract and D-PL8-20 evidence boundary require TUI-only scheduling. Real PTY scenarios prove the positive path; the RPC scenario proves no background update. |
| 08-01 and 08-02 described default-off except explicit config. | Reversed D-PL8-07 applies official-name default-on at read time, while explicit local/base values win and invalid config fails closed. |
| 08-03 deduplicated notice text by `<plugin>@<marketplace>`. | D-PL8-21 requires bare plugin-name deduplication. The wire still retains each updated installation. |
| 08-01's initial known limit allowed an unbounded stalled-step wait. | D-PL8-23 through D-PL8-25 start abort at 30 seconds, propagate it through git, stop later background steps, and retain the gate until settlement. |

The remaining plan checks hold: once-per-runtime delay and env policy; silent load-origin update reuse; project-first scope order; foreground priority; shutdown and quit behavior; hermetic child environment; notice schema, docs, redaction, and transport. The canonical decision-coverage query reports **18/18 trackable decisions honored** with no missing decision. No PLAN prohibition, backstop truth, probe, or deferred human-check block is declared.

### Required Artifacts, Key Links, and Data Flow

The canonical PLAN checks pass **19/19 declared artifacts** and **8/8 declared key links** across 08-01 through 08-04.

| Artifact and key link | Status | Proof |
| --- | --- | --- |
| `index.ts` → scheduler and command gate | VERIFIED | Registers both Pi listeners, creates one gate/pass/scheduler per runtime, and passes `runForeground` into `registerClaudePluginCommand`. |
| Scheduler → pass → marketplace update | VERIFIED | First TUI input schedules `pass`; `background-pass.ts` invokes injected `updateMarketplace` with the real plugin runner, missing-dependency installer, silent context, and load-origin run. `index.ts` supplies production implementations. |
| Gate → plugin and dependency steps → git abort | VERIFIED | `beginStep` supplies a fresh signal; plugin and dependency wrappers run eligible work in `runWithGitAbortSignal`; the enclosing marketplace operation retains the step through cascade settlement. |
| Merged config and state → selected marketplaces | VERIFIED | `loadState` enumerates recorded marketplaces; `loadMergedScopeConfig` supplies explicit values; `effectiveMarketplaceAutoupdate` supplies the official default; invalid layers suppress selection. |
| Updated outcomes → one notice → text or JSON wire | VERIFIED | `updated.push` uses real outcome name, scope, marketplace and versions; one `notifyBackgroundUpdate` call follows the pass. Resolve redacts, grammar formats bare-name text, and JSON/wire carry each installation with a closed schema. |
| Real TUI harness and hermetic environment | VERIFIED | `pi-tui.ts` drives a sandboxed PTY; the host fixture holds a streaming git response for cancellation proof. RPC child env is allowlisted; the TUI driver uses that construction. |

No output in the goal flow ends in a static fixture or hardcoded empty value. The notice comes from completed update outcomes, and the end-to-end feature checks persisted installed versions.

### Behavioral Checks

| Check | Result |
| --- | --- |
| Exact reusable `npm run check` at executable HEAD `be0de0c3` | Exit 0: **1,145 Cucumber scenarios, 11,777 steps, and 309 merged LCOV records**. `git diff --quiet be0de0c3 -- . ':(exclude,glob).planning/**/*.md'` is still clean at report HEAD `165720c5`. The final Nyquist audit also passed all five audited direct-coverage pairs. |
| Focused verifier spot-check | Fresh named-test selections passed in `background-gate.test.ts`, `background-pass.test.ts`, and `notification-grammar.test.ts`: 30-second abort-then-settle, official/default-off selection, stop and abort during config read, unchanged-run silence, and D-PL8-21 notice composition. |
| Real Pi feature | `background-update.feature` has six current scenarios: TUI update, same-name deduplication, distinct-name aggregation, held-git foreground cancellation, RPC negative control, and PTY readiness. The final recorded run passed six scenarios and 88 steps. |
| Review and security | `08-REVIEW.md` is a complete **53-file CLEAN 0/0/0** final-head review at `5fe4aae9`. `08-SECURITY.md` is **SECURED 21/21** at `165720c5`, with all 15 mitigations verified, all six accepted dispositions recorded, and `threats_open: 0`. |
| Test-quality and anti-pattern audit | Requirement-linked tests assert independent expected state, exact notice text/cardinality, a recorded split-notice mutant failure, and persisted install outcomes; none is disabled. No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, or `PLACEHOLDER` appears in the Phase 8 changed production/test scope. No Phase 08 probe is declared. |

The TUI screen parser observes distinct visible notice texts, not identical event counts. The distinct-name scenario and its recorded split-notice mutant failure prove aggregate visible output; the owner assertion proves exact notification-entry cardinality.

### Requirements Coverage

| Requirement | Source plans | Status | Evidence |
| --- | --- | --- | --- |
| AUP-01 | 08-01, 08-02, 08-04 | SATISFIED | Roadmap truths 1 and 2: TUI scheduling, real refresh/update, foreground gate, dependency wrapper, 30-second abort-then-settle behavior, and real PTY regression. |
| AUP-02 | 08-01, 08-02, 08-04 | SATISFIED | Roadmap truth 3: official-name default, explicit config precedence, invalid-config fail-closed, env policy, delay bounds, and documented Pi mappings. |
| AUP-03 | 08-03, 08-04 | SATISFIED | Roadmap truth 4: one aggregate passive notice, bare-name text dedupe, per-install wire rows, redaction, no-op/stopped silence, and real TUI scenarios. |

All **3/3 Phase 08 requirements** appear in PLAN frontmatter, `REQUIREMENTS.md`, and the roadmap. None is orphaned.

### Advisory

None. `docs/env-vars.md` and the WR-01 contract comment now state the D-PL8-23–25 boundary accurately: cancellation begins after 30 seconds, the command or session continues waiting until the step settles, earlier completed changes remain, the background pass stops for this runtime, and quit does not wait.

### Human Verification Required

None. Runtime state, ordering, cancellation, output, and security behavior have automated owner and real-PTY evidence.

### Gaps Summary

None. The four current roadmap outcomes and AUP-01 through AUP-03 are achieved on the integrated tree.

---

_Verified: 2026-10-29T13:42:50Z_
_Verifier: Codex (gsd-verifier)_
