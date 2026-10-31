---
phase: 06-command-run-contract
verified: "2026-10-09T23:26:45Z"
status: passed
score: "15/15 must-haves verified"
covered_files: [".planning/phases/01-presentation-model/notify-corpus/baseline.jsonl",".planning/phases/01-presentation-model/notify-corpus/meta.json",".planning/phases/06-command-run-contract/06-01-PLAN.md",".planning/phases/06-command-run-contract/06-01-SUMMARY.md",".planning/phases/06-command-run-contract/06-02-PLAN.md",".planning/phases/06-command-run-contract/06-02-SUMMARY.md",".planning/phases/06-command-run-contract/06-03-PLAN.md",".planning/phases/06-command-run-contract/06-03-SUMMARY.md",".planning/phases/06-command-run-contract/06-04-PLAN.md",".planning/phases/06-command-run-contract/06-04-SUMMARY.md",".planning/phases/06-command-run-contract/06-VALIDATION.md","docs/output-catalog.md","extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts","extensions/pi-claude-marketplace/bridges/hooks/settle.ts","extensions/pi-claude-marketplace/domain/github-auth.ts","extensions/pi-claude-marketplace/edge/command-run.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts","extensions/pi-claude-marketplace/edge/handlers/tools.ts","extensions/pi-claude-marketplace/edge/register.ts","extensions/pi-claude-marketplace/edge/router.ts","extensions/pi-claude-marketplace/index.ts","extensions/pi-claude-marketplace/orchestrators/auth-host.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts","extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts","extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts","extensions/pi-claude-marketplace/platform/pi-api.ts","extensions/pi-claude-marketplace/shared/errors.ts","extensions/pi-claude-marketplace/shared/notification-command-error.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-json.ts","extensions/pi-claude-marketplace/shared/notification-present.ts","extensions/pi-claude-marketplace/shared/notification-run.ts","extensions/pi-claude-marketplace/shared/notification-wire.ts","package-lock.json","package.json","schema/claude-plugin.schema.json","scripts/notify-corpus.mjs","scripts/test-coverage-direct.mjs","scripts/wire-schema.mjs","tests/architecture/catalog-uat/catalog-contract.test.ts","tests/architecture/catalog-uat/catalog-wire.test.ts","tests/architecture/no-credential-leak.test.ts","tests/architecture/wire-schema.test.ts","tests/bridges/hooks/async-rewake/registry.test.ts","tests/bridges/hooks/event-router.test.ts","tests/bridges/hooks/settle.test.ts","tests/edge/command-run.test.ts","tests/edge/handlers/marketplace/add.test.ts","tests/edge/handlers/marketplace/autoupdate.test.ts","tests/edge/handlers/marketplace/info.test.ts","tests/edge/handlers/marketplace/list.test.ts","tests/edge/handlers/marketplace/remove.test.ts","tests/edge/handlers/marketplace/shared.test.ts","tests/edge/handlers/marketplace/update.test.ts","tests/edge/handlers/plugin/bootstrap.test.ts","tests/edge/handlers/plugin/browse.test.ts","tests/edge/handlers/plugin/enable-disable.test.ts","tests/edge/handlers/plugin/fetch.test.ts","tests/edge/handlers/plugin/help.test.ts","tests/edge/handlers/plugin/import.test.ts","tests/edge/handlers/plugin/info.test.ts","tests/edge/handlers/plugin/install.test.ts","tests/edge/handlers/plugin/list.test.ts","tests/edge/handlers/plugin/pending.test.ts","tests/edge/handlers/plugin/prune.test.ts","tests/edge/handlers/plugin/reinstall.test.ts","tests/edge/handlers/plugin/shared.test.ts","tests/edge/handlers/plugin/uninstall.test.ts","tests/edge/handlers/plugin/update.test.ts","tests/edge/handlers/shared.test.ts","tests/edge/handlers/tools.test.ts","tests/edge/json-capture.ts","tests/edge/register.test.ts","tests/edge/router.test.ts","tests/index.test.ts","tests/orchestrators/auth-host.test.ts","tests/orchestrators/import/execute.test.ts","tests/orchestrators/marketplace/update.test.ts","tests/orchestrators/plugin/dependency-tag-probe.test.ts","tests/orchestrators/plugin/enable-disable.test.ts","tests/orchestrators/plugin/install-clone-probe.test.ts","tests/orchestrators/plugin/install-flow.test.ts","tests/orchestrators/plugin/list-flow.test.ts","tests/orchestrators/plugin/reinstall-flow.test.ts","tests/orchestrators/plugin/shared.test.ts","tests/orchestrators/plugin/update-flow.test.ts","tests/orchestrators/reconcile/apply.test.ts","tests/shared/notification-command-error.test.ts","tests/shared/notification-dispatch.test.ts","tests/shared/notification-json.test.ts","tests/shared/notification-present.test.ts","tests/shared/notification-run-seeds.ts","tests/shared/notification-run.test.ts","tests/shared/notification-wire.test.ts"]
covered_digest: "v3:sha256:0b83fb8fd5502777f6045f02f9be6b8e272bee6afffdc1b22fca8ac4ccf715a3"
behavior_unverified: 0
overrides_applied: 0
prohibitions_flagged: 0
prohibition_dispositions:
  - statement: "MUST NOT turn invocation correlation into persistent user or cross-command tracking or telemetry."
    source: 06-01-PLAN.md
    descriptor: absent
    status: verified
    classification: "VERIFIED (human judgment)"
    flagged: false
    evidence: "Per-run injected allocation, command-local state, strict origin projection, and no production identity consumer outside correlation/schema/delivery."
    resolution: "User accepted item 1 through option 1: Accept both and continue; recorded in 06-UAT.md."
  - statement: "MUST NOT present an internal error or delivery failure as proof that completed changes were rolled back."
    source: 06-02-PLAN.md
    descriptor: absent
    status: verified
    classification: "VERIFIED (human judgment)"
    flagged: false
    evidence: "Neutral error summary, retained reload knowledge, no business retry in transport recovery, and tests preserving completed changes."
    resolution: "User accepted item 2 through option 1: Accept both and continue; recorded in 06-UAT.md."
human_verification: []
---

# Phase 6: Command-Run Contract Verification Report

**Phase Goal:** A JSON consumer can tell where each payload came from and which command run produced it. Every command run yields a complete set of payloads before the command settles, and at least one payload even when its handler throws.

**Verified:** 2026-10-09T23:26:45Z
**Status:** passed
**Re-verification:** No — initial verification; no prior Phase 6 VERIFICATION.md existed.
**Checkout:** features/json, HEAD 4aedaabfdb482614e655f80528def70d089bc171.

The implementation meets the positive contract under the explicitly declared host limits below. All four roadmap success criteria and all 29 PLAN truth declarations are covered by 15 merged truths. The user explicitly accepted both prohibition judgments in 06-UAT.md. The positive score remains distinct from these two human-approved judgments. There are no implementation blockers and no present-but-behavior-unverified truths.

## Verification Scope and Method

Read AGENTS.md, all four PLANs and SUMMARYs, CONTEXT, RESEARCH, VALIDATION, SECURITY, REVIEW, REVIEW-FIX, REVIEW-DISPOSITION, REQUIREMENTS, and prior Phase 1–5 verification reports. Applied local-verification, TypeScript unit-testing review, Google-style source review, and comment rules. Consulted CodeGraph before source discovery, then checked current source, callers, tests, schema, saved execution output, and git history directly.

SUMMARY claims were not used as proof. In particular, transport recovery, error disclosure, constructor failures, delayed completion, and retained callbacks were traced through production code. Independent expected payloads and planted invalid controls were inspected. The report is the only authorized repository change.

## Goal Achievement

### Observable Truths

Source paths abbreviated below are relative to `extensions/pi-claude-marketplace/`; test paths are repository-relative. T1–T4 preserve the roadmap success-criterion wording.

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| T1 | Every payload carries the required fields `severity`, `needsReload`, and `origin`. Command payloads name a machine command id, so `enable` can be told apart from `install` even though both render `(installed)`. Reload-time payloads carry `origin: load`, and hook payloads carry `origin: hook`. | VERIFIED | `shared/notification-wire.ts:264` defines strict command/load/hook origin arms and required structured/raw envelopes; `notification-json.ts:223` projects only allowed metadata. `index.ts:88`, hook settle, and async-rewake registry open explicit roots. Schema, converter, registered enable/delegation, lifecycle, and complete catalog captures cover all 19 wire kinds. |
| T2 | All command-origin payloads of one run share one `invocationId` from an injectable generator. Payloads of two runs carry different ids, and tests pin the ids deterministically. | VERIFIED | `edge/register.ts:103` supplies injectable primary/recovery allocators; `edge/command-run.ts:25` creates run-local state and allocates once. `notification-run.ts:77` retains the explicit origin. Registered sequential and interleaved exact captures use independent expected IDs; fresh overlap test passed. No global current-command slot. |
| T3 | Every command emits all of its payloads before its handler's promise settles. A test that awaits the handler sees the complete set, and nothing is emitted after it. | VERIFIED | `command-run.ts:74` awaits execution, performs final delivery synchronously, and sets settled in finally; `notification-dispatch.ts:492` rejects late emissions before touching live mode or sink. Registered deferred throw, independent overlapping roots, and real auth polling spot-checks passed with actual named subtests. Delegated and cascade owner tests assert settlement ordering and retained-callback silence. |
| T4 | In `json` and `rpc`, an unexpected throw from any command handler becomes a typed `internal-error` payload with a redacted cause chain, so every command yields at least one payload. In `tui` and `print`, the behavior does not change. | VERIFIED | Every registered route passes through `runCommand`; escaped throws use `notifyCommandError`, resolver, converter, and strict command-only internal-error schema. Text rethrows the original exception; registration preflight remains synchronous. Direct/registered JSON/RPC cases cover no output, partial output, nullish throws, setup faults, and text identity. Fresh delayed-throw and silent-command checks passed. D-08 and host limits below bound successful delivery. |
| T5 | Canonical identity follows the selected route, including aliases, invalid parent routes, both marketplace-help spellings, bare browse, and delegated enable/install work. | VERIFIED | `register.ts:149` selects once and executes that selection; `router.ts:180` assigns canonical IDs while preserving arguments. Router table tests and registered exact captures cover help/aliases/invalid inputs; enable owner and registered delegation retain `plugin enable`. |
| T6 | Resolved presentation and explicit metadata preserve snapshot-only tools, live mode selection, text notification arity, synchronous preflight, and lifecycle containment. | VERIFIED | `notification-run.ts:68` separates snapshot creation from command state; both tool callbacks use real loaders, snapshot presentation, and marketplace projection without allocating command IDs. Dispatch reads live mode for each allowed emission. Owner tests cover mode changes and unsupported preflight; lifecycle catches remain. Strict corpus has no missing or extra tuples. |
| T7 | Equal/adjacent payloads remain separate ordered entries; arrays retain model order; earlier output remains before a later error. | VERIFIED | Converter uses ordered map/projection; sole sink appends each emission directly, without aggregation or deduplication. Registered equal-outcome/partial-error tests and catalog raw/structured fixtures assert whole ordered arrays. No-output finalization does not replace prior entries. |
| T8 | Bare and invalid commands still allocate identity, while interleaved commands and independent load/hook roots cannot exchange identity or outcome state. | VERIFIED | Explicit root union and `commandStateFor` exclude noncommand roots from accounting. Registered bare/invalid tests and reverse-completion overlap tests cover distinct IDs and independent lifecycle entries. Fresh `keeps overlapping import runs and independent roots ordered in json` passed. |
| T9 | Construction failures preserve correlated machine error delivery, including primary allocation failure and an escaping openRun failure after allocation. | VERIFIED | `command-run.ts:28` handles primary allocation failure using the trusted recovery allocator; `:44` catches openRun failure with the already allocated identity; setup finalization always closes state. Fresh injected construction-failure check passed. Production inventory probes catch getAllTools errors and degrade; the test honestly injects escaping openRun, not a production exception that cannot escape. |
| T10 | Unexpected causes become bounded plain strings with credential/path redaction, fixed nullish/hostile fallbacks, and no live Error or stack. | VERIFIED | `notification-command-error.ts:16` uses the existing bounded/cycle-aware serializer and machine-only path treatment. Nullish and hostile cases return fixed nonempty causes. Resolver matrix, converter, and disclosure architecture tests compare independent complete expected values and reject planted untouched/partially masked paths. Approved conservative ambiguous-cause policy is implemented. |
| T11 | Empty typed outcomes count; diagnostics/prompts do not; silent or non-outcome-only machine completion produces an internal error. | VERIFIED | `notification-dispatch.ts:57` exhaustively classifies 12 outcome and 7 non-outcome kinds. Empty cascade/pending/prune and usage/help are outcomes independent of severity or row count. Empty diagnostics emit nothing. `command-run.ts:82` checks hasOutcome; fresh silent-command check passed and classifier/non-outcome tests cover remaining cases. |
| T12 | Reload knowledge is monotonic across partial outcomes, failed append attempts, later false values, and escaped throws. | VERIFIED | Dispatch ORs needsReload before append; command-error delivery uses state.needsReload. Fresh `retains reload knowledge after a later false outcome and an escaped throw` passed; direct recovery tests also assert failed-attempt reload retention. |
| T13 | Each failed ordinary append gets one direct recovery attempt; successful recovery reopens delivery, failed recovery closes it; neither recurses nor retries business work. | VERIFIED | `notification-dispatch.ts:164` sets recovering before the direct recovery append, reopens on success, closes on failure, and contains debug-logger throws. Fresh separate-fault, failed-recovery, and registered RPC reopen checks passed. Broad-catch list-flow tests prove sink failure does not trigger business recovery; command owner tests preserve completed changes. |
| T14 | Real auth, delegated operation, and cascade promises join the outer command; finalization follows them, and retained callbacks add nothing after settlement. | VERIFIED | `auth-host.ts:169` awaits device flow; `github-auth.ts:402` emits code callback then returns polling; browse returns/awaits delegated handlers with the outer run; marketplace update and enable-disable owners await children. Fresh actual auth-poll, registered delayed throw, and overlap tests passed. Owner tests assert complete payload/settlement logs and late-callback silence. |
| T15 | The frozen text corpus remains exactly 3149 entries with zero extras, and the output catalog is unchanged from 26cb0056. | VERIFIED | Independently read and asserted the strict saved corpus log: 3149 baseline entries, zero extras, 10089 passes, zero failures, one inherited skip. Git comparison of catalog and corpus baseline to 26cb0056 is empty; same-input full-gate reuse also covers text owners. No baseline recapture or weakening. |

**Score:** 15/15 merged positive truths verified; 4/4 roadmap criteria; 0 present-but-behavior-unverified; **2 human-approved prohibitions; 0 unresolved flags**. No verification override was used. No coincidental-reliance advisory was found: explicit state, awaits, guards, defaults, and caller-provided test inputs establish the relevant preconditions.

### Complete PLAN Truth Coverage

Each ordinal refers to the truth's position in its PLAN frontmatter. This preserves all plan-specific detail without inflating the score with repeated roadmap wording.

| PLAN | Truth ordinal and concern | Merged evidence | Status |
| --- | --- | --- | --- |
| 06-01 | 1 canonical routes/delegation | T5 | VERIFIED |
| 06-01 | 2 required strict raw/structured metadata | T1 | VERIFIED |
| 06-01 | 3 injectable allocation/nested/overlapping identity | T2, T8 | VERIFIED |
| 06-01 | 4 explicit facts/text/live mode/lifecycle | T6, T15 | VERIFIED |
| 06-01 | 5 equal adjacent entries/root attribution | T7 | VERIFIED |
| 06-01 | 6 bare browse/empty arrays/rejected missing or null origin | T1, T5, T11; wire-schema and converter negative controls | VERIFIED |
| 06-01 | 7 payload and array ordering | T7 | VERIFIED |
| 06-01 | 8 distinct adjacent runs/shared within-run ID | T2, T8 | VERIFIED |
| 06-01 | 9 bare/invalid identity; no load/hook correlation | T8 | VERIFIED |
| 06-01 | 10 interleaving without global identity | T8, T14 | VERIFIED |
| 06-02 | 1 correlated error after earlier output | T4, T7, T12 | VERIFIED |
| 06-02 | 2 plain/redacted causes, unchanged text and preflight | T4, T6, T10 | VERIFIED |
| 06-02 | 3 correlated construction failure | T9; explicit injected openRun limitation | VERIFIED |
| 06-02 | 4 null/undefined cause fallback | T10 | VERIFIED |
| 06-02 | 5 preserve equal earlier outcomes | T7 | VERIFIED |
| 06-02 | 6 error delivered after partial output before settlement | T3, T14 | VERIFIED |
| 06-03 | 1 empty outcome versus missing result | T11 | VERIFIED |
| 06-03 | 2 semantic outcome classification | T11 | VERIFIED |
| 06-03 | 3 monotonic reload | T12 | VERIFIED |
| 06-03 | 4 one recovery per fault/reopen/close/no retry or rollback | T13; semantic prohibition still flagged separately | VERIFIED |
| 06-03 | 5 finalization/late emission guard | T3, T14 | VERIFIED |
| 06-03 | 6 adjacent/interleaved per-run settlement | T8, T14 | VERIFIED |
| 06-03 | 7 empty outcomes versus no output/diagnostics/prompts | T11 | VERIFIED |
| 06-03 | 8 ordered duplicates/awaited work/retained callbacks | T7, T14 | VERIFIED |
| 06-04 | 1 complete D-01 through D-10 captures in JSON/RPC | T1–T15; registered and direct owners | VERIFIED |
| 06-04 | 2 auth/delegation/cascade/error timing | T14 | VERIFIED |
| 06-04 | 3 independent concurrent roots | T8 | VERIFIED |
| 06-04 | 4 exact corpus/catalog preservation | T15 | VERIFIED |
| 06-04 | 5 empty/partial failure timing with D-08 exception | T4, T13, T14 | VERIFIED |

The decision-coverage query reported 10/10 trackable CONTEXT decisions honored. That advisory query corroborates, but does not replace, the source and behavior evidence above.

### Required Artifacts

The artifact query returned 5/5, 5/5, 4/4, and 4/4 declaration checks. These are 18 occurrences of 14 unique artifacts. Presence-query success alone was not accepted: production wiring and substantive tests were checked separately.

| Artifact | Expected role | Status | Substantive/wiring evidence |
| --- | --- | --- | --- |
| `shared/notification-run.ts` | Explicit root, snapshot, per-command state | VERIFIED | Production register, lifecycle roots, tools, boundary and dispatcher consume the appropriate capabilities. |
| `edge/router.ts` | Single canonical route selection | VERIFIED | Registration passes selected route to real dispatch; aliases/help/invalid routes tested. |
| `shared/notification-wire.ts` | Strict origin and internal-error union | VERIFIED | Converter's return contract, JSON capture validation, schema generator and drift tests consume all 19 members. |
| `schema/claude-plugin.schema.json` | Generated/shipped strict schema | VERIFIED | Source equality, exact kind inventory, required metadata and package inclusion tested in wire-schema owner. |
| `tests/edge/register.test.ts` | Actual registered command traces | VERIFIED | Direct pair in full gate; fresh named delayed, overlap and recovery tests execute registered callbacks. |
| `shared/notification-command-error.ts` | Bounded safe cause presentation | VERIFIED | Dispatcher resolves before converting; independent disclosure assertions and planted controls. |
| `tests/shared/notification-command-error.test.ts` | Direct cause/redaction behavior | VERIFIED | Real resolver, root/quote matrix, nullish/hostile/cycle/credential cases in paired coverage. |
| `edge/command-run.ts` | Awaited execution/failure/finalization boundary | VERIFIED | Production registration calls it for all routes; shared dispatcher handles its errors. |
| `tests/edge/command-run.test.ts` | Boundary and completed-change preservation | VERIFIED | Direct pair; fresh named reload, construction-failure and silent-command tests passed. |
| `shared/notification-dispatch.ts` | Outcome/reload accounting and bounded transport recovery | VERIFIED | All notifications converge here; sole append site retains original sink receiver. |
| `tests/orchestrators/plugin/list-flow.test.ts` | Broad business-catch sink-failure witness | VERIFIED | Real list owner and dispatch exercised; transport fault contained before business catch. |
| `tests/orchestrators/auth-host.test.ts` | Deferred device-flow ordering | VERIFIED | Real auth owner, deferred request/poll and controlled timers; fresh named RPC test passed. |
| `tests/architecture/catalog-uat/catalog-wire.test.ts` | Complete fixture/schema/dispatch inventory | VERIFIED | 260 structured tuples plus 8 raw samples, complete root metadata, real machine dispatch, planted invalid controls. |
| `.planning/phases/06-command-run-contract/06-VALIDATION.md` | Task/threat/source/edge evidence | VERIFIED | Validated/Nyquist metadata and execution ledger present; runtime claims separately checked against code, logs and tests. This document is evidence bookkeeping, not runtime wiring. |

### Key Link Verification

All 12 declared links are wired. The generic key-link query returned 0/3, 0/3, 0/3, and 1/3 (exit 1): it generally did not recognize root-relative target paths in relative imports. Those negative heuristic results were inspected and resolved by reading actual imports, calls, argument flow, and behavior; they were not treated as successful automated checks.

| Plan | From → To | Actual connection | Status |
| --- | --- | --- | --- |
| 01 | register → router | selectCommandRoute once, selected route reused for identity and routeClaudePlugin | WIRED |
| 01 | dispatch → JSON converter | toWirePayload receives resolved presentation plus explicit run.origin before append | WIRED |
| 01 | tools → presentation | Actual loaders → snapshot → presentCascade; shared marketplace wire projection supplies existing tool details | WIRED |
| 02 | register → command-run | runCommand wraps selected route, execution callback, injected allocators and openNotificationRun | WIRED |
| 02 | dispatch → command-error resolver | notifyCommandError and append recovery call resolveCommandError before formatting | WIRED |
| 02 | JSON converter → wire union | Type-only wire contract and exact internal-error projection; runtime validation stays at test/schema boundary | WIRED |
| 03 | dispatch → run state | Explicit commandStateFor; reads settled/delivery, writes hasOutcome and monotonic needsReload | WIRED |
| 03 | command-run → dispatch | Missing-result and escaped-throw paths both use notifyCommandError | WIRED |
| 03 | list-flow → dispatch | Real notifyWithContext path enters contained appendCommand before the owner's broad catch can receive a transport exception | WIRED |
| 04 | auth-host → github-auth | Awaited initiateDeviceFlow; synchronous code callback before returned polling promise | WIRED |
| 04 | browse → router/delegated route | Router invokes browse; browse awaits/returns delegated handler work with the outer run | WIRED |
| 04 | catalog-wire test → dispatch | Complete catalog/raw fixtures reach actual JSON/RPC delivery and strict captured-payload validation | WIRED |

### Data-Flow Trace (Level 4)

| Output | Real source | Flow | Status |
| --- | --- | --- | --- |
| commandId/invocationId | Selected executable route and injected per-command allocator (randomUUID defaults) | register → runCommand → explicit origin → dispatcher → wire envelope → original Pi sink | FLOWING |
| severity/needsReload | Resolved presentation and command-local accumulated reload knowledge | real handler/orchestrator result → dispatcher accounting → plain converter → payload | FLOWING |
| outcome/error sequence | Actual awaited handler result or caught thrown value | executeCommand → finalization/error resolver → synchronous bounded append attempts → settled guard | FLOWING |
| causeChain | Actual caught cause, existing bounded serializer, approved machine redactor | resolveCommandError → toWirePayload → internal-error entry | FLOWING |
| marketplace/plugin arrays | Existing real loaders and operation results | presentation resolution → ordered projections → command entries or existing tool details | FLOWING |
| load/hook origin | Explicit lifecycle/hook root creation | lifecycle/settle/rewake producer → same notification pipeline, no command accounting | FLOWING |

Fixed nullish/hostile-cause fallbacks are intentional error facts, not mock data. Empty optional projections in the converter omit inapplicable scope/version fields; real loaders populate collections. No hollow props, static replacement datasets, orphaned production artifact, or ignored loader result was found.

## Behavioral Evidence

### Fresh Named Spot-Checks

Each command used this exact prefix:

`timeout 10s node --test --test-isolation=none --test-reporter=tap`

Append `--test-name-pattern='<pattern>' <file>` from the table. Each process returned exit 0, with the actual named subtest, one test passed, zero failed and zero skipped. These checks were finished before report creation; no suite/server remains running.

| Pattern | File | Result |
| --- | --- | --- |
| `^awaits delayed throw output before registered settlement in json$` | `tests/edge/register.test.ts` | PASS; 2.96 s process |
| `^registered sink recovery reopens delivery in rpc$` | `tests/edge/register.test.ts` | PASS; 2.96 s |
| `^bounds command append recovery for failed recovery$` | `tests/shared/notification-dispatch.test.ts` | PASS; 2.37 s |
| `^keeps overlapping import runs and independent roots ordered in json$` | `tests/edge/register.test.ts` | PASS; 3.05 s |
| `bounds command append recovery for separate faults` | `tests/shared/notification-dispatch.test.ts` | PASS; 2.32 s |
| `^retains reload knowledge after a later false outcome and an escaped throw$` | `tests/edge/command-run.test.ts` | PASS; 2.28 s |
| `^reports inventory failure with the allocated identity in json$` | `tests/edge/command-run.test.ts` | PASS; 2.29 s; injected escaping openRun |
| `joins the delayed prompt and token poll before auth settlement in rpc` | `tests/orchestrators/auth-host.test.ts` | PASS; 3.35 s; real owner carrier |
| `^reports a silent command before settlement in json$` | `tests/edge/command-run.test.ts` | PASS; 2.32 s |

Initial attempts without `--test-isolation=none` printed only a file-level subtest. Their exit-zero results were **not** accepted as named behavioral evidence. The explicit named TAP results above replace them.

These tests use hermetic test-owned state and deferred work; no application server, network service, or project business data was mutated. Broader edge-case behavior is additionally supported by the unchanged-input full owner/direct-coverage run described next.

### Reused Full Phase Gate and Corpus

Reused the same-session clean-source gate exactly as permitted by `skills/local-verification/SKILL.md`:

- Command: `npm run check`; parent-captured exit **0**.
- Verified source commit: `045f53cd5060082c5df6371853338f6765cd1c2d`.
- Runtime: Node `v26.11.0`, also confirmed in this checkout.
- Log: `/tmp/json-output-cr01-iter3-check.log`.
- Configured timeout: 2400 seconds; not reached.
- Independently confirmed `git diff --exit-code 045f53cd -- . ':(exclude,glob).planning/**/*.md'` is empty and no untracked executable inputs existed before this report. Only planning Markdown changed. No dependency, configuration, runtime or installed-tool change invalidates reuse.

The saved log shows the configured static, unpaired, integration and all-direct-pair sequence completed. Static typecheck, lint, workflow lint, Fallow, formatting and source/test pairing passed. The final merged LCOV contains **266 records**. Independently inspected all records: line, function and branch totals equal their hit totals; no coverage shortfall. No duplicate full suite was run by this verifier.

Strict corpus evidence: `/tmp/cr01-iter3-corpus.log` records **10090 tests, 10089 passed, zero failed, one inherited skip**, followed by **3149 baseline entries present, zero extra**. Its exact final marker and counters were independently checked. The catalog and frozen baseline are unchanged from `26cb0056`. The generic text serializer/redactor is unchanged from the pre-phase source. This is reused execution evidence with unchanged inputs, not a SUMMARY assertion.

### Prior-Phase Regression Coverage

Reviewed Phase 1–5 reports and the 130-path supplied inventory `/tmp/json-output-regression-files.json`. Corrected its historical accounting rather than claiming 130 currently executable owners:

- **126 paths exist:** 96 paired owner tests, 20 architecture tests, and 10 integration tests. The configured full command covers all of them; all 96 paired source records occur in the 266-record LCOV.
- Three stale architecture filenames — `gate-targets.test.ts`, `source-scan.test.ts`, and `unused-type-member-gate.test.ts` — were deleted before this phase by upstream commit `d7213bc2`. This phase did not delete those tests. The first two support modules still have current consumers; no claim is made that the retired unused-type test still runs.
- The fourth stale name, `tests/scripts/generate-wire-schema.test.ts`, was already corrected in Phase 4's verification to the actual `tests/architecture/wire-schema.test.ts`, whose generator equality/kind/metadata controls were inspected.

This is an inventory correction, not a Phase 6 regression or an untested executable path. The original 130-name list alone would not be valid execution proof.

### Test Quality and Disclosure Review

Direct source pairs exist for both new production modules. Assertions compare complete independently expected payloads and state, not just snapshots, substring presence, or values generated by the production resolver itself. Deferred registered tests log emissions and settlement together, prove pending work prevents settlement, and invoke retained callbacks afterward. Recovery cases assert attempted payload order, reopen/closed state, reload retention and business-call counts.

JSON capture records attempted entries before schema validation and retains malformed-attempt failures even if recovery later succeeds. Planted controls reject missing metadata, invalid internal-error roots, empty conversion, malformed attempted payloads, untouched sensitive paths and partially masked path tails. Disclosure checks walk complete payloads and compare independent cause chains.

CR-01 closure was checked against the final prefix recognition and conservative ambiguous-cause implementation, not just the CLEAN review. Tests cover synthetic Windows root forms and actual POSIX filesystem errors. **Native Windows filesystem execution was not performed.** No native-Windows claim is made.

### Probe Execution

No phase-declared `probe-*.sh` path or conventional `scripts/*/tests/probe-*.sh` exists for this phase. Step 7c has no shell probe to execute. Inventory “probes” are the production tool-availability functions and direct owner tests, not an omitted shell probe. The declared runnable checks and strict corpus evidence are accounted for above; no SUMMARY PASS marker substitutes for a missing probe.

## Requirements Coverage

| Requirement | Source plans | Contract | Status | Evidence |
| --- | --- | --- | --- | --- |
| WIRE-02 | 06-01, 06-02, 06-04 | Required severity, reload and command/load/hook origin | SATISFIED | T1, T5–T8; strict structured/raw schemas, every catalog fixture, real command/lifecycle roots and complete captures. |
| WIRE-07 | 06-01, 06-02, 06-03, 06-04 | Shared per-run ID from injectable generator | SATISFIED | T2, T8–T9; canonical selected route, allocator injection, bare/invalid/sequential/interleaved/delegated tests. |
| JOUT-03 | 06-03, 06-04 | Complete payload sequence before handler settles | SATISFIED | T3, T11–T14; awaited production carriers, finalization and late guard; actual named delayed/overlap/auth/recovery checks. |
| JOUT-04 | 06-02, 06-03, 06-04 | Machine internal-error/redacted causes with unchanged text | SATISFIED | T4, T7, T9–T13; setup/handler/silent boundaries, partial output, plain redacted causes, corpus preservation; declared host limits apply. |

All four requirement IDs mapped to Phase 6 are claimed by its plans and have implementation evidence. No orphaned requirement was found. REQUIREMENTS still marks them Pending because the parent owns bookkeeping and the interactive prohibition checkpoint remains open; this verifier did not edit it.

## Prohibition Dispositions

**unverified-prohibition — human review recommended: 2 items.**

Both PLAN items have `status: unresolved` and **no verification descriptor**. This verifier has not invented a test descriptor, claimed wired negative enforcement, or promoted them silently to pass. Source evidence is supportive and the following judgments are explicitly non-authoritative. Interactive mode requires the human decisions below.

| Prohibition | Concrete supportive evidence | Disposition |
| --- | --- | --- |
| Correlation MUST NOT become persistent user/cross-command tracking or telemetry. | Allocation is per boundary call; identity stays in run-local origin and emitted command entries. Production consumers are correlation/schema/projection/delivery code, with no added user identity, telemetry sink, network transmission or persistent tracking index. Load/hook entries have no IDs. Pi session-entry retention is distinct from a guarantee of memory-only IDs and must be understood by the reviewer. | UNCERTAIN (WARNING); unverified, flagged; explicit human judgment required. |
| Errors/delivery faults MUST NOT imply rollback of completed changes. | Summary is exactly `Command failed unexpectedly.`; reload truth accumulates and survives errors. Transport recovery never reruns or undoes business operations. Tests preserve completed filesystem changes and assert no business retry. Neither the wire error shape nor boundary asserts a rollback result. The wording's implication remains a human judgment. | UNCERTAIN (WARNING); unverified, flagged; explicit human judgment required. |

The user's selection of option 1, **“Accept and continue verification,”** resolves the code-fixer's redaction checkpoint: recognized local paths become `[path]`, ambiguous affected causes become `Command failure details omitted.`, and text stays unchanged. It is not an override of a failed truth and does not resolve either prohibition above. No repeat redaction approval is requested.

## Contract Limits and Deferred Scope

D-08 is implemented as locked: **one recovery attempt per failed ordinary append**. A successful recovery reopens delivery so later outcomes/reload updates can arrive. A failed recovery closes delivery; there is no recursive recovery, business retry or rollback. When both sink attempts fail, an observable payload cannot be guaranteed; attempts still finish before settlement. This is the explicit contract exception, not an implementation gap.

Synchronous `requireNotificationMode` preflight is unchanged. An unsupported or inaccessible live mode and a broken trusted recovery allocator are explicit host-contract limits, not successful-delivery guarantees. Production tool inventory functions catch getAllTools failures and degrade; constructor-failure tests use an honestly injected escaping openRun seam. Those limits do not conceal an unimplemented production failure path.

The full milestone roadmap was checked before closing the finding list. Phase 7 owns its mode-refusal/device-flow restrictions, real-Pi integration checks, public contract documentation and IL-2 wording. No Phase 6 failed truth was moved there. There are no deferred Phase 6 gaps. This report makes no visual, native-Windows, or external-service execution claim.

## Anti-Patterns and Review Gates

| Area | Finding | Classification | Effect |
| --- | --- | --- | --- |
| 65 changed source/schema/test files | No unreferenced TBD/FIXME/XXX debt markers, TODO/HACK/PLACEHOLDER implementation stubs, or newly disabled test markers found in the scan. | None | No blocker. |
| Converter optional-field projections | Empty objects omit inapplicable scope/version fields; not empty user-visible data sources. Test fixture defaults have real test-owned producers. | INFO | No stub or disconnected flow. |
| Generic key-link query | Relative imports caused negative path heuristics; actual links verified by source/call/behavior trace. | INFO | No unwired link. |
| Supplied regression inventory | Four historical names are not current executable test paths; corrected above using history and prior verification. | INFO | No new phase regression. |
| Two descriptorless prohibitions | Positive evidence does not constitute interactive acceptance. | WARNING | Keeps overall status human_needed. |

The independent final review covers 65 files and reports CLEAN. Security reassessment records ASVS level 1, 15/15 threats closed, no accepted risk. CR-01 has three fix commits (`e7a8182f`, `6680ff1b`, `045f53cd`) and the final validation is compliant. These reports corroborate the direct evidence, not replace it. No new security blocker or unresolved debt marker was found.

## Human Verification Completed

### 1. Accept the scope of invocation correlation

**Test:** Review per-command allocation in register/command-run, strict origin projection, and storage of the emitted entries by Pi. Confirm the IDs are only for grouping payloads from one run.

**Expected:** Each run gets a fresh ID; no persistent user identifier, cross-command tracking relationship or telemetry is introduced. Load/hook roots contain no command ID. The fact that an emitted entry can be retained in a session is understood and accepted within that meaning.

**Why human:** This descriptorless negative requirement concerns intended use and persistence semantics. Deterministic tests and source search support it but cannot supply the missing human disposition.

### 2. Accept failure output as failure reporting without a rollback claim

**Test:** Review a partial-success command followed by an internal error, and an ordinary append failure followed by recovery. Read `Command failed unexpectedly.`, its redacted causes and needsReload alongside the already completed change.

**Expected:** The payload conveys command/output failure without claiming that completed work was undone. Successful changes remain; previously known needsReload stays true. Recovery does not retry or roll back business work.

**Why human:** Tests exercise retained state, completed changes and recovery behavior, but this prohibition is about the presentation's implication to a consumer. It still needs explicit acceptance. The accepted redaction policy does not answer it.

## Gaps Summary and Handoff

No positive must-have failed, no required artifact is missing/stubbed, and no key link is unwired. There is no implementation gap to send to gap planning. All behavior-dependent positive truths have runtime evidence; the behavior-unverified count is zero.

Overall status is **passed** after the user selected option 1, "Accept both and continue." Both UAT rows pass, and both prohibition judgments are resolved by that explicit acceptance. No source change or additional full-suite run is required by the findings.

The fingerprint was recomputed by this verifier with `node .codex/gsd-core/bin/gsd-tools.cjs query verification.fingerprint .planning/phases/06-command-run-contract <covered-files...>`. Its returned sorted `covered_files` and `covered_digest` were copied into frontmatter. Inputs cover the changed implementation/tests/schema, traced supporting owners, immutable corpus/catalog and relevant validation/build evidence; the owner automatically includes this phase's four PLAN/SUMMARY pairs. Volatile root STATE, ROADMAP and REQUIREMENTS were not added merely because they were read. The report itself is excluded by the owner.

Only this report is written. No commit, implementation edit, requirement/state transition, or other planning change was made. The parent owns acceptance, commit and transition.

---

_Verified: 2026-10-09T23:26:45Z_
_Verifier: gsd-verifier_

## Human acceptance and canonical completion

The user selected option 1, "Accept both and continue," for the two exact
judgments above. Item 1 accepts fresh per-command IDs retained in Pi session
entries without user tracking, cross-command tracking, or telemetry. Item 2
accepts failure wording as reporting failure without claiming rollback.
Completed changes and known reload state remain intact.

The earlier uncertainty descriptions document the pre-acceptance assessment.
Both are now human-approved. No negative test descriptor was invented and
no failing automated check was overridden. The UAT-only completion predicate
passed with two passing rows and no blockers before canonicalization.
The covered implementation and fingerprint inputs are unchanged.
