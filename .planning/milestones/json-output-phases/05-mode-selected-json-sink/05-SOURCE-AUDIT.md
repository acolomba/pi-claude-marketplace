# Phase 5 source audit

All four source families are covered. No goal, in-phase requirement, research constraint, or locked decision is omitted. Task IDs use plan.task notation.

| Source item | Required outcome | Executable coverage |
|---|---|---|
| GOAL | Exclusive machine transport everywhere; unchanged text | 05-01 through 05-07 |
| SC1 | Cascades/info/pending/usage/help/diagnostics/device/load/hooks; exact text | Structured 05-01.1; usage 05-02.1; diagnostic 05-03.1; auth 05-04.1; load 05-05.1; hooks 05-06; catalog 05-07 |
| SC2 | One live switch; plain-string typed failure before writes; lifecycle logs | 05-01.1; 05-02.2; 05-04.2; 05-05/06 |
| SC3 | Only dispatch calls appendEntry; transient violations fail lint | 05-01.2; final repeat 05-07.2 |
| SC4 | Contain pre-bind/stale pi/ctx failures in named lifecycle paths | 05-05.1/2; 05-06.1/2 |
| SC5 | Explicit required fake mode; schema capture survives catches | 05-01.1; 05-03.2; 05-07.1 |
| SC6 | Diagnostic/rewake empty no-op; Stop-cap try/catch | 05-03.2; 05-06.1/2 |
| MODE-01 | Live exact-mode selection | 05-01.1; 05-02.2; 05-04.2 |
| MODE-02 | Unsupported plain string before mutation; lifecycle containment | 05-01.1; 05-05/06 |
| JOUT-01 | Every output goes through exclusive entry sink | 05-01 through 05-06; complete proof 05-07.1 |
| JOUT-05 | Load/session/hook output failure containment | 05-05/06 |
| TENB-01 | Retaining schema capture and whole expected objects | 05-01.1; 05-03.2; 05-04.2; 05-07.1 |
| TENB-02 | Explicit mode across every context constructor | 05-01.1; migrations 05-02 through 05-06; audit 05-07.2 |
| D-05-01 | Unsupported load prevents fresh mutation but still discovers | 05-05.1/2 |
| D-05-02 | Contain failures; continue independent cleanup/work; retain cap | 05-05/06 |
| D-05-03 | Existing opt-in debug logger only | 05-05/06 |
| D-05-04 | Single exhaustive live switch plus typed root validator | 05-01.1; 05-02.1 |
| D-05-05 | Required sink on original real run; nested reuse | 05-01.1; 05-02 through 05-06 |
| D-05-06 | Every surface and lint ownership; empty rules | 05-01.2; 05-02 through 05-07.1 |
| D-05-07 | Test-only retaining schema validator; owner tests | 05-01.1; 05-03.2; 05-04.2; 05-07.1 |
| D-05-08 | 3149 present/zero extras; catalog unchanged from 26cb0056 | Every plan verification; final 05-07.2 |

## Research constraints and inherited decisions

| Constraint | Owner tasks |
|---|---|
| Current source and installed Pi declarations override stale maps; no new dependency/schema | All read_first inventories; 05-07.2; COVERAGE.md |
| Required readonly plain-string mode; narrow only after membership | 05-01.1 |
| Original host receiver and ctx getters; no spreading or caching | 05-01.1; 05-04.2; 05-05/06 |
| Real one-snapshot root run; no nested runs, optional sink, or extra inventory probes | 05-01.1; all carrier migrations; 05-05/06 |
| New production symbols have immediate readers; all waves green | Every atomic signature migration and full-wave verification |
| All router/flag/scope/parser/handler usage branches | 05-02.1 |
| Import/install/reinstall/update/reconcile diagnostics | 05-03.1/2 |
| All clone/dependency/fetch/info/update/marketplace auth carriers; stored-only autoupdate stays promptless | 05-04.1/2 |
| Root guard separate from live emit selection | 05-01.1; 05-05/06 |
| Factory mkdir moves to guarded session_start; prior-child/orphan cleanup independent | 05-05.2 |
| Unknown loading still discovers; supported delivery failure permits independent PATH work | 05-05.1 |
| Protect stale mode/isIdle getters as well as appendEntry | 05-05/06 |
| Cap state remains recorded; generations protect reload | 05-06.1/2 |
| Empty lines/summary no-op; whitespace/nonempty arrays preserved; text arity exact | 05-03.2; 05-06.1; existing text owner cases |
| Ledger survives catches; original JSON safety plus schema; independent expected objects | 05-01.1; 05-03.2; 05-04.2; 05-07.1 |
| Every fake has explicit mode; no missing-member cast | 05-01.1; 05-07.2 |
| Lint ownership preserves NFR-5; only transient planted evidence | 05-01.2; 05-07.2 |
| Phase 1/3/4 presentation, redaction, schema, catalog and tool-return contracts | Every migration; LLM tools regression 05-01.1; catalog 05-07 |
| Combined-tree full gate, 100% direct owner coverage, current hook policy | Every plan verification and execution policy |

No new production module is introduced. New symbols have immediate readers: UnsupportedModeError and requireNotificationMode at roots/dispatch; NotificationEntrySink at NotificationRun.entrySink; private selector at existing emitters. New tests/edge/json-capture.ts is consumed by register/dispatch owners. Existing task-owned source/test paths are grounded in git ls-files; the new capture and this phase's new planning records are explicit new-path exceptions. Installed Pi declarations are read authority only.

## Dependency graph and sizing

| Plan / wave | Needs | Produces / new user capability |
|---|---|---|
| 05-01 / 1 | Phase 4 converter/schema, existing list path | Real registered-list tracer, required contracts/capture, enforced sink |
| 05-02 / 2 | 05-01 selector/run | All help and parser rejections reach machine output |
| 05-03 / 3 | 05-02 resolved-raw selector | All diagnostic producers reach machine output |
| 05-04 / 4 | 05-03 dispatcher | Auth callbacks use the original run's machine sink |
| 05-05 / 5 | 05-04 complete command carriers | Load warnings and guarded load/session mutation |
| 05-06 / 6 | 05-05 lifecycle ownership | Rewake/Stop output with independent cleanup/cap containment |
| 05-07 / 7 | Completed 05-06 transport | Full catalog transport evidence and combined-tree verdict |

Each plan has two tasks. Shared dispatch ownership and tests require sequential waves. There is no file-disjoint same-wave split. Mandatory atomic required-contract migrations exceed the generic five-file heuristic in 05-01.1, 05-02.1, 05-03.1, and 05-04.1; splitting their callers into separate committed waves would require an optional compatibility contract or a broken gate. Their exact consumer/test inventories remain one concern, and no scope is omitted. Estimates are 22k–58k tokens per plan, factor 1, low confidence from zero calibration samples. No one-way decision or external setup blocks execution.

## Shared execution policy

Use existing owner tests for feedback while editing and require 100% direct line/function/branch coverage of every changed production pair. New test support is tested through its consuming owners; do not add a support meta-suite. Keep existing behavioral assertions and notification multiplicities. Add transport cases in json/rpc; reuse existing text emissions to prove tui/print, including exact argument counts. Do not normalize, recapture, or extend the 3149-entry baseline.

Read a file before editing and trace current callers with CodeGraph, then targeted rg; installed Pi declarations are read-only API authority, never edit targets. Follow Fallow guard/symbol-impact rules for the exact changes. Use durable requirement IDs in TypeScript comments and test names. Before each commit, run SKIP=npm-check pre-commit run --files on the changed files, restage fixer changes, and repeat until clean. Run the conventional commit in the foreground with the longest native runtime wait; its hook owns staged-input checks. Do not duplicate lint/typecheck/tests immediately before that commit. Never amend, rebase, skip hooks, or commit to main.

After the combined wave, run npm run check in the combined checkout. Use the native running-session wait if needed; no outputFile field or custom success cache. Record command, exit status, Node version, and exact verified commit/tree. Reuse a passing gate only for unchanged inputs in this session under local-verification. No package install, schema regeneration, wire-field addition, command internal-error handling, mode refusal, real-Pi e2e, or public-doc edit belongs to this plan.

## Scope exclusions and unresolved probes

Phase 6 owns command unexpected/internal-error output, invocation identity, and emitted origin. Phase 7 owns mode refusals, real Pi CLI e2e, and public docs including the accepted startup gap. No timer workaround, new wire field, production validator, schema regeneration, or telemetry is planned. Prior copied-tree/persisted gate controls are retired. These are explicit boundaries, not omitted phase requirements.

05-PROBES.md retains all 13 edges, two flagged unclassified assumptions, two descriptorless unverified prohibitions, and capability outcomes. Every execution summary requires Threat Flags.

## Planning verification

On Node 26.10.0, all seven frontmatter and structure checks pass (two tasks each, no structure warnings). The decision gate covers 8/8 decisions; API coverage passes with 26 members; edge/prohibition schema validation passes and both prohibition dispositions are flagged-unverified. All 49 automated commands have observable fails_when clauses and the failure-direction gate passes without warnings. The command-path gate reports not_applicable for these command forms, so tracked file grounding and source existence were checked separately with git ls-files and filesystem reads. Twenty numbered threat IDs are unique; T-05-SC alone repeats by design. git diff --check passes, and production/test/config files are unchanged. Runtime checks remain pending execution.
