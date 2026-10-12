---
phase: 07-mode-refusals-real-pi-verification-and-docs
verified: 2026-10-10T04:41:45Z
status: passed
score: 31/35 must-haves verified
verified_truths: 31
total_truths: 35
behavior_unverified: 0
overrides_applied: 0
verified_commit: bfd0d2dbb2eaac37c51084c7d08eb665aaa1cc07
branch: features/json
node: v26.11.1
scope_status: degraded
scope_source: phase-range
scope_reason: no-task-commit-rows
diff_base: 1ab78d72c55a634e874932befac9d17b440ec83b
covered_files: [".github/workflows/ci.yml",".github/workflows/e2e-nightly.yml",".planning/phases/01-presentation-model/notify-corpus/baseline.jsonl",".planning/phases/01-presentation-model/notify-corpus/meta.json",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-01-PLAN.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-01-SUMMARY.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-02-PLAN.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-02-SUMMARY.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-03-PLAN.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-03-SUMMARY.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-04-PLAN.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-04-SUMMARY.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-05-PLAN.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-05-SUMMARY.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-06-PLAN.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-06-SUMMARY.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CONTEXT.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-ADDITIONS.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-CAPTURE-EVIDENCE.json",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-CAPTURE.jsonl",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-CORPUS-FINAL.json",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-DISCUSSION-LOG.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-RETIREMENT.json",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-REVIEW-DISPOSITION.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-REVIEW-FIXES.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-REVIEW.md",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs",".planning/phases/07-mode-refusals-real-pi-verification-and-docs/deferred-items.md",".pre-commit-config.yaml","AGENTS.md","README.md","docs/json-output.md","docs/output-catalog.md","extensions/pi-claude-marketplace/edge/command-run.ts","extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts","extensions/pi-claude-marketplace/edge/register.ts","extensions/pi-claude-marketplace/edge/router.ts","extensions/pi-claude-marketplace/index.ts","extensions/pi-claude-marketplace/orchestrators/auth-host.ts","extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts","extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts","extensions/pi-claude-marketplace/platform/git.ts","extensions/pi-claude-marketplace/shared/errors.ts","extensions/pi-claude-marketplace/shared/notification-dispatch.ts","extensions/pi-claude-marketplace/shared/notification-grammar.ts","extensions/pi-claude-marketplace/shared/notification-resolve.ts","extensions/pi-claude-marketplace/shared/notification-run.ts","extensions/pi-claude-marketplace/shared/notification-wire.ts","package-lock.json","package.json","schema/claude-plugin.schema.json","skills/local-verification/SKILL.md","tests/architecture/catalog-uat/catalog-contract.test.ts","tests/architecture/json-output-docs.test.ts","tests/architecture/wire-schema.test.ts","tests/e2e/fixtures/startup-entries.ts.txt","tests/e2e/json-output-runtime.ts","tests/e2e/pi-json-output.test.ts","tests/e2e/pi-peer-floor/package-lock.json","tests/e2e/pi-peer-floor/package.json","tests/edge/command-run.test.ts","tests/edge/handlers/plugin/browse.test.ts","tests/edge/json-capture.ts","tests/edge/register.test.ts","tests/integration/auth-e2e.test.ts","tests/orchestrators/auth-host.test.ts","tests/orchestrators/marketplace/add.test.ts","tests/orchestrators/plugin/fetch.test.ts","tests/pi-runtime.ts","tests/platform/git-auth-callbacks.test.ts","tests/platform/git.test.ts","tests/shared/errors.test.ts","tests/shared/notification-dispatch.test.ts","tests/shared/notification-grammar.test.ts"]
covered_digest: "v3:sha256:5df852691663a518a07feaf67fdeb513674fa7f5e4c26492e3baa594f7be7e7c"
decision_coverage:
  honored: 14
  total: 14
  not_honored: []
prohibition_reviews:
  - plan: "03"
    statement: "Per-command correlation must not become cross-session tracking, telemetry, or collection of operator credentials by test fixtures."
    verification: judgment
    status: unverified
    flagged: true
    assessment: "NON-AUTHORITATIVE: inspected evidence supports the constraint; explicit human resolution remains pending."
  - plan: "04"
    statement: "Consumer guidance must not present silence, prompt-only output, or diagnostics as a successful command outcome."
    verification: judgment
    status: unverified
    flagged: true
    assessment: "NON-AUTHORITATIVE: inspected evidence supports the constraint; explicit human resolution remains pending."
  - plan: "06"
    statement: "Corpus closeout must not conceal regressions by rewriting existing samples, suppressing capture, or claiming runtime evidence that was not executed."
    verification: judgment
    status: unverified
    flagged: true
    assessment: "NON-AUTHORITATIVE: inspected evidence supports the constraint; explicit human resolution remains pending."
human_verification:
  - id: H1
    test: "Review the correlation lifetime and runtime fixture environment in notification-run.ts, edge/command-run.ts and tests/e2e/json-output-runtime.ts: decide the 07-03 privacy prohibition."
    expected: "Invocation IDs identify one command and its nested work only; no cross-session identity, telemetry, or operator-credential collection is introduced."
    why_human: "Descriptor-less judgment prohibition. Allowlists, fresh directories and runtime tests support it, but no human resolution is recorded."
  - id: H2
    test: "Read the guide's opening, preparation, severity, exit-status and partial-result sections as a consumer; decide the 07-04 success-guidance prohibition."
    expected: "Silence, prompts and diagnostics alone never imply success; missing outcomes fail explicitly, warnings remain visible, errors fail, and earlier results survive."
    why_human: "Executable snippets pass the negative cases. The broader meaning of all consumer guidance is a descriptor-less judgment requiring explicit human resolution."
  - id: H3
    test: "Review bf2e84ab -> a9673e10 -> 0a11761d plus the post-WR-01 evidence at 0dffe6c1 in 07-CORPUS-CAPTURE-EVIDENCE.json, 07-CORPUS-FINAL.json and 07-RETIREMENT.json; decide the 07-06 honesty prohibition."
    expected: "Exactly 3149 originals plus one D14 refusal; no suppressed selection, rewritten old samples or claimed unexecuted cases. Retain the one optional-peer skip and distinguish retained pre-retirement evidence from this verifier's fresh checks."
    why_human: "Hashes, negative controls, history and fresh retirement probe agree, but provenance interpretation and the descriptor-less concealment prohibition have no recorded human disposition."
  - id: H4
    test: "Compare docs/json-output.md Schema reference and Closed-set tokens against schema/claude-plugin.schema.json and notification-wire.ts, especially conditional fields, field types/meanings and additive compatibility."
    expected: "All nineteen kinds are understandable; each field's type and meaning is accurate; optional field/kind/member additions keep version and removals/renames/type/meaning changes bump it."
    why_human: "Inventory tests prove paths and requiredness and reject omissions; they require nonempty type/meaning cells but do not prove their semantic correctness or readability."
  - id: H5
    test: "Review the guide's Limitations and partial-failure wording against the eight fresh real-Pi cases and command-run recovery behavior."
    expected: "Clear distinction among print silence, plugin severity versus process status, startup memory versus streaming, RPC get_entries/rendering, initial slash-only persistence versus --no-session, and one recovery attempt with no operation retry or rollback guarantee."
    why_human: "Runtime and failure-path tests pass. Completeness and interpretation of the bounded prose remain an explicit phase judgment."
  - id: H6
    test: "Review git diff 64bcfa027530b55319446ea781facab229df92cd HEAD -- AGENTS.md .planning/BACKLOG.md docs/output-catalog.md; resolve the deferred human-check and JDOC-03/unclassified assumption."
    expected: "Only IL-2 changes in AGENTS; MRO-01 corrects both false claims; catalog edits stay within resolver-marker ownership and dispatch text-strategy device-flow ownership. Confirm any missing JDOC-03 concern or state that the bounded contract is sufficient."
    why_human: "The planned human-check explicitly asks for content inspection. Fences/locks already pass mechanically; an unclassified concern cannot be declared tested without identifying it."
  - id: H7
    test: "Resolve MODE-04/unclassified: review the tested live-mode/credential/memo/Git/cleanup matrix and name any additional intended edge behavior, or explicitly conclude that D02's bounded contract covers it."
    expected: "A concrete missing case is specified, or the unclassified assumption is explicitly disposed of. Existing exact typed refusal, zero device HTTP and cleanup results remain valid."
    why_human: "The edge probe supplied no behavioral category. No executable assertion or user approval can be inferred for an unnamed concern."
---

# Phase 07: Mode Refusals, Real-Pi Verification, and Docs Verification Report

**Phase Goal:** A command that cannot work in the current mode refuses clearly instead of degrading. A real headless Pi run proves the JSON contract end to end, and the schema and its limitations are documented.

**Verified:** 2026-10-10T04:41:45Z
**Status:** human_needed
**Re-verification:** No — initial phase verification. No prior 07-VERIFICATION.md existed; the four wave reports have no phase gap contract.
**Verified tree:** clean `bfd0d2dbb2eaac37c51084c7d08eb665aaa1cc07` on `features/json`.

The implementation and all machine acceptance checks passed. Final approval remains pending for three descriptor-less prohibitions, schema semantics, limitation wording, bounded policy edits, and the two unclassified assumptions. These are **WARNING / UNCERTAIN**, not missing code. There are **zero BLOCKER findings** and **zero present-but-behavior-unverified runtime truths**.

**unverified-prohibition — human review recommended:** all three judgment-tier prohibitions remain flagged. No user approval, enforcement descriptor, or risk acceptance is inferred from passing tests or SUMMARY claims.

## Verification Scope and Method

The canonical evaluation scope remains **degraded / phase-range / no-task-commit-rows**, based at `1ab78d72c55a634e874932befac9d17b440ec83b`. The supplied scope record and actual range were checked through current HEAD; the parent authentication mode-count corrections in `tests/orchestrators/marketplace/add.test.ts` and `tests/orchestrators/plugin/fetch.test.ts` are included. WR-01's selector correction at `0dffe6c1` is included. No task-commit attribution was invented.

Read all six plans and summaries, context, discussion log, coverage, research, validation, security, original review/disposition/fixes, four wave reports, requirements, roadmap, AGENTS and applicable verification/test-review rules. CodeGraph was used first for source and call-path discovery; direct reads covered omitted ranges, documentation and configuration. SUMMARY files supplied scope and claims to challenge, not proof.

All six roadmap criteria were loaded from the owner CLI. All 35 PLAN truths were evaluated. Six restatements were merged into roadmap rows, leaving **35 scored truths: six roadmap contracts and 29 additional plan assertions**. The table below preserves the roadmap wording. The deduplication table preserves a disposition for every merged PLAN truth. Four broad roadmap contracts remain UNCERTAIN only where explicit prose/provenance judgments are pending; their machine subchecks passed.

D14 is an explicit user-authorized refinement of criterion 6: preserve the original 3,149 records and admit only exact ledgered refusal additions. The old fixed-3149-only interpretation is superseded. D03 includes existing usage help in both JSON and RPC; print remains refusal-and-remedy only. Neither is an invented verification override.

## Goal Achievement

### Observable Truths

| ID | Truth | Status | Evidence |
| --- | --- | --- | --- |
| SC1 | Outside `tui`, `browse` emits an error-severity payload that names `/claude:plugin list` and no longer falls back to `list`; in `tui`, `browse` does not change. In `print` mode, an operation that needs device-flow authentication fails fast with a typed error that points at `--mode json` or `tui`, and it does not poll until the code expires. | VERIFIED | E1/E2/E7: direct and registered refusal tests, exact text, lazy auth, real Git and cleanup; all passed. |
| SC2 | A real-Pi e2e test runs `pi -p --mode json --no-session --offline "/claude:plugin list"` and asserts a schema-valid `claude-plugin` entry on stdout. It pins `entry_appended` at the peer floor, and it pins that startup-emitted entries are not streamed. | VERIFIED | E3: freshly executed eight cases, 0 skips, installed 0.87.1 and independent 0.86.1; real stdout, schema, startup controls. |
| SC3 | A schema reference documents every kind and field, with a `jq` example. It states the compatibility policy: additive changes (a new optional field, kind, or closed-set member) keep `schemaVersion`, and removals, renames, and type or meaning changes bump it. It also states the verdict rule: the maximum severity over command-origin entries. | UNCERTAIN (WARNING) | E4/E7: nineteen kinds and recursive paths/requiredness, jq semantics and omissions tested; field meanings/types and compatibility prose need H4. WARNING — UNCERTAIN for final semantic acceptance. |
| SC4 | The documented limitations cover these points. Print mode is silent, so scripts use `--mode json`. Pi exits 0 regardless. Startup entries are not streamed in `json` or `rpc`, and RPC clients can use `get_entries`. RPC front-ends must render `claude-plugin` entries, the device-flow prompt at minimum. A slash-command-only run writes no session file. | UNCERTAIN (WARNING) | E3/E4/E6: runtime and executable statements pass; complete limitations/delivery wording needs H5. WARNING — UNCERTAIN for final prose acceptance. “Exits 0 regardless” applies to plugin severity, not every CLI failure. |
| SC5 | The IL-2 output-channel line in AGENTS.md matches PROJECT.md (D8). Backlog MRO-01 is closed, and its two wrong claims are corrected. | UNCERTAIN (WARNING) | E8: exact IL-2 and MRO-01 edits exist and agree with dispatcher; explicit bounded-content/JDOC-03 judgment H6 remains. WARNING — UNCERTAIN. |
| SC6 | Milestone close-out for the Phase 1 corpus tool. After the final corpus re-diff comes back empty, the three `scripts/notify-corpus*.mjs` files are deleted (Phase 1 D-01), and no file outside `.planning/` names them. The `docs/output-catalog.md` prose that says `composeReasons` appends the soft-dep markers is amended to name the resolve step, and the device-flow prose (around lines 4088-4090) that says the domain emits the prompt is amended to name the dispatch module's text strategy (Phase 3 CONTEXT). This is the milestone's one sanctioned catalog edit: prose only, no fenced block changes, and `EXPECTED_STATE_COUNT` / `EXPECTED_UTF8_BYTES` do not move. | UNCERTAIN (WARNING) | E5/E8: original-plus-one preservation, zero-extra report, fences, locks and retirement pass; historical honesty and bounded attribution review H3/H6 remain. WARNING — UNCERTAIN. D14 supersedes strict-3149-only interpretation. |
| 01.1 | JSON and RPC browse calls produce an error-severity usage-error outcome naming the actual mode and /claude:plugin list, with existing browse usage help. | VERIFIED | E1: browse.ts:131–143; register.test.ts:1367–1416 compares complete json/rpc payloads, including usage and one outcome. |
| 01.2 | Print browse emits only the selected refusal and remedy through the existing text sink; tui browse retains its picker and argument validation. | VERIFIED | E1: print owner test at browse.test.ts:179 checks exact notify arguments; grammar owner checks empty and nonempty usage; existing TUI branch is unchanged and its owner passes. |
| 01.3 | MODE-03 adjacency: repeated browse invocations remain separate command runs, each with its own invocationId. | VERIFIED | E1: registered refusal loop awaits two calls and expects browse-run-1 and browse-run-2; named JSON case passed independently. |
| 01.4 | MODE-03 empty: empty and whitespace-only registered arguments select plugin browse and return the same refusal as explicit browse. | VERIFIED | E1: same registered loop covers explicit browse, empty input, and whitespace in both machine modes; router selects plugin browse. |
| 01.5 | MODE-03 encoding: the three non-tui mode names and refusal messages compare exactly; padded or case-changed unknown modes remain rejected by the existing admission check. | VERIFIED | E1: exact three refusal strings; register.test.ts:1641 rejects empty, uppercase, padded, confusable, and unknown modes before routing/probing. |
| 01.6 | MODE-03 ordering: invalid browse arguments retain their existing usage-error before mode refusal; one valid browse refusal is a command outcome without a following synthetic missing-outcome error. | VERIFIED | E1: browse.test.ts:489 machine invalid-argument cases; argument validation precedes mode access; registered valid refusals assert exactly one complete outcome. |
| 02.1 | A print operation with a registered-provider credential miss raises DeviceFlowUnavailableError with the approved remedy before a device-code request or poll. | VERIFIED | E2: auth-host.ts:185–196 checks live print after memo reuse; strict empty device-HTTP mocks assert no request/poll, with the exact typed remedy. |
| 02.2 | Stored credentials, memoized auth results, and public or offline operations continue to work in print. | VERIFIED | E2: auth-host.test.ts:166–223 covers stored credentials and memo success/failure; git.test.ts:850 proves public clone does not consult auth. |
| 02.3 | JSON, RPC, and tui retain device flow; unrelated callback errors retain cancellation and host isolation. | VERIFIED | E2: existing json/rpc/tui device-flow owners, callback cancellation and HTTPS/host-isolation cases passed in the fresh full check. |
| 02.4 | The real Git adapter and marketplace operation preserve the typed refusal or its cause, expose its remedy, and clean their staging directory before rejection. | VERIFIED | E2: real isomorphic-git clone/fetch owners and auth-e2e.test.ts:173–289 assert typed error identity/cause, unchanged prior state, staging removal, and cleanup-failure cause retention; named cleanup case passed. |
| 03.2 | The exact 0.86.1 package, selected by its own manifest and bin.pi, passes the same tests as the installed runtime; absence or version mismatch fails. | VERIFIED | E3: resolvePeerFloor at pi-json-output.test.ts:23 requires fixture-local name/version and real CLI containment; both actual CLI version probes and all eight cases passed. |
| 03.3 | TENB-03 adjacency: startup custom entries and later command entries remain distinguishable by their markers and origins. | VERIFIED | E3: assertStartupProof at pi-json-output.test.ts:99 checks distinct runtime-startup/runtime-proof markers and command order on both runtimes. |
| 03.4 | TENB-03 empty: an empty inventory still emits a valid cascade outcome, while zero matching stdout entries fails. | VERIFIED | E3: assertListOutcome at pi-json-output.test.ts:68 rejects zero outcomes and compares a schema-valid empty cascade; both real list cases passed. |
| 03.5 | TENB-03 ordering: both startup-hook markers exist in session memory before the later command event, and only the later event is streamed in json/rpc. | VERIFIED | E3: startup fixture appends at both hooks; later proof reads session memory; JSON/RPC assertions require both markers and zero streamed startup entries. |
| 03.6 | RPC get_entries retrieves the startup markers; a separate persistence-enabled slash-only run creates no session file before an assistant message exists. | VERIFIED | E3: RPC get_entries returns both markers; separate persistence-enabled slash-only cases omit --no-session and assert an empty session directory. |
| 04.1 | The guide starts with a runnable real-Pi command and extracted result, and README contains only a short link to the guide. | VERIFIED | E4: docs/json-output.md:3 begins with actual headless command/closed stdin, jq extraction and [] result; README diff adds only the guide link. |
| 04.2 | JDOC-01 boundary: the exit-policy example succeeds for info and warning outcomes, displays warnings, and fails for error outcomes. | VERIFIED | E4: actual exit-status fence executed for info/warning/error; tests at json-output-docs.test.ts:169 assert complete stdout, stderr and exit status. |
| 04.3 | JDOC-01 adjacency: equal commandId values with different invocationId values remain separate consumer selections. | VERIFIED | E4: extraction, preparation and invocation-selector tests use equal command IDs with different invocation IDs and assert isolated results. |
| 04.4 | JDOC-01 empty: empty input, unrelated events, prompt-only output, and diagnostic-only output fail with No command outcome received; an empty cascade succeeds. | VERIFIED | E4: no-outcome matrix at json-output-docs.test.ts:267 rejects empty/unrelated/non-outcome-only inputs with the exact diagnostic; empty cascade succeeds. |
| 04.5 | JDOC-01 ordering: earlier results remain visible with a later error, maximum severity covers all selected command entries, and reload is OR-reduced across them. | VERIFIED | E4: both severity orders, reload OR matrix and partial-error case at json-output-docs.test.ts:336; selected earlier payloads remain in stdout. |
| 04.6 | JDOC-01 precision: severity uses the exact info/warning/error ordering and needsReload remains a boolean; unknown additive kinds do not establish an outcome. | VERIFIED | E4: conservative invalid-envelope/unknown-kind matrix plus exact info/warning/error ranking and boolean reload assertions. |
| 05.2 | JDOC-02 boundary: the guide distinguishes disabled persistence from normal slash-only initial persistence and startup binding from later event subscription. | VERIFIED | E3/E4: Limitations distinguishes subscription timing from session memory and --no-session from initial persistence; both runtime targets prove the distinctions. |
| 05.3 | JDOC-02 empty: print silence and a missing outcome are documented as insufficient evidence of success, even when Pi exits zero. | VERIFIED | E4: guide explicitly rejects silence and zero-exit inference; missing-outcome and non-outcome-only snippet cases pass. |
| 05.4 | JDOC-02 encoding: runtime entry.data and native camelCase tokens are documented independently of rendered text; the frozen catalog fenced examples retain exact bytes. | VERIFIED | E4/E5: wrapper and camelCase reference inspected; retired audit compares all 264 complete fences and the unchanged catalog owner. |
| 05.6 | JDOC-02 concurrency: invocation IDs separate overlapping commands; delivery recovery makes one direct attempt per append failure without operation retry or a rollback guarantee. | VERIFIED | E4/E6: invocation-isolation examples and command-run recovery tests; named no-retry/no-rollback invariant passed. Broader wording remains H5. |
| 06.1 | All 3149 pre-phase samples survive exactly as a per-file multiset, including normalized message, severity, argument count, and multiplicity. | VERIFIED | E5: --retired independently compares exact per-file tuple multisets and original serialized prefix against 64bcfa027530b55319446ea781facab229df92cd. |
| 06.2 | Every baseline addition is a new browse/device-flow refusal sample named in an exact ledger before amendment; amended total equals 3149 plus the ledger count. | VERIFIED | E5: exact count-one print tuple is hardcoded in audit and owner assertion; bf2e84ab ledger commit precedes a9673e10 amendment; total 3149 + 1. |
| 06.3 | The final fresh full-suite comparison contains the entire amended baseline with zero missing samples and zero extras. | VERIFIED | E5: retained post-WR-01 complete capture and strict report, exit 0, 3150 present/0 extras; current concrete-input comparison passed. This verifier revalidated retained evidence, not the deleted capture command. |
| 06.6 | The final combined tree passes npm run check after deletion, with exact runtime and verification evidence retained. | VERIFIED | E7: fresh timeout 2400 npm run check on clean bfd0d2db, Node v26.11.1, exit 0; all 266 direct coverage pairs. |

**Score:** 31/35 truths verified; four UNCERTAIN documentation/provenance contracts await explicit human decisions. Runtime behavior-unverified: 0. Overrides: 0.

### Deduplicated PLAN Truths

These are evaluated subclaims, not dropped scope or additional score entries.

| PLAN truth | Covered by | Disposition and evidence |
| --- | --- | --- |
| 07-03 truth 1: production extension, exact JSON list command, stdin closed, nonempty schema-valid stdout | SC2 | VERIFIED — E3 executes it on both actual CLIs. |
| 07-05 truth 1: nineteen kinds, common/nested fields, requiredness, compatibility, IL-2/MRO-01 | SC3 / SC5 | UNCERTAIN (WARNING) — inventory, executable semantics and edits pass; H4/H6 retain semantic/content review. |
| 07-05 truth 5: severity/process separation and additive/breaking rules | SC3 / SC4 | UNCERTAIN (WARNING) — exact prose exists and executable verdicts pass; H4/H5 retain final wording review. |
| 07-05 truth 7: only the two catalog attribution topics and unchanged locks | SC6 | UNCERTAIN (WARNING) — fences/locks pass; H6 is the deliberately deferred bounded-prose checkpoint. |
| 07-06 truth 4: complete fences match 26cb0056 and 260/39143 locks | SC6 | VERIFIED mechanical subclaim — E5 compares all 264 fences and the entire unchanged owner test. |
| 07-06 truth 5: scripts deleted after strict pass; no non-planning tracked references | SC6 | VERIFIED current-tree/history subclaim — E5, ledger/amendment/deletion commit sequence and exact historical tool hashes; broader evidence-honesty judgment remains H3. |

### Evidence Index

| ID | Actual source and independent evidence |
| --- | --- |
| E1 | `extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts:129`, `edge/register.ts:113`, `edge/router.ts:183`, `shared/notification-dispatch.ts:251` and `:492`, `shared/notification-grammar.ts:1139`; corresponding owner tests plus registered schema-validating capture. |
| E2 | `extensions/pi-claude-marketplace/shared/errors.ts:4`, `orchestrators/auth-host.ts:170`, `platform/git-auth-callbacks.ts:167`, `platform/git.ts`, `orchestrators/marketplace/add.ts:536` and cleanup before `:657`; callback/Git/auth owners and real-boundary integration tests. |
| E3 | `tests/e2e/pi-json-output.test.ts:23`, `:68`, `:99`, `:115`; `tests/e2e/json-output-runtime.ts:37` and `:145`; `tests/e2e/fixtures/startup-entries.ts.txt`; fresh eight-case execution below. |
| E4 | `docs/json-output.md` actual Bash fences and reference tables; `tests/architecture/json-output-docs.test.ts:19`, `:28`, `:83`–`:571`, `:604`–`:784`; committed schema and schema-drift owner. |
| E5 | `07-corpus-audit.mjs:28`, `:36`, `:50`, `:69`, `:87`, `:123`, `:148`, `:170`; fresh self-test/retired execution; exact ledger, immutable original blob, full capture and final JSON evidence. |
| E6 | `tests/edge/command-run.test.ts:560` proves no operation retry/rollback; dispatcher recovery cases and overlapping invocation cases run in the fresh full gate. |
| E7 | Fresh clean-head `timeout 2400 npm run check`, exit 0 on Node v26.11.1; static checks, unpaired tests, integration and 266 direct source/test coverage records. |
| E8 | Actual scoped diff from `64bcfa027530b55319446ea781facab229df92cd`: AGENTS IL-2, BACKLOG MRO-01, README link and catalog prose; dispatcher implementation agrees with exclusive mode-selected transport. |

Paths abbreviated in E1/E2 after the first file remain relative to `extensions/pi-claude-marketplace/`. E5 filenames are relative to this phase directory.

### Required Artifacts

All 21 PLAN artifact declarations passed `query verify.artifacts` (per-plan counts 3/3, 3/3, 4/4, 3/3, 5/5, 3/3). Existence results were then checked for substance and actual use:

| Artifact | Exists / substantive / wired | Details |
| --- | --- | --- |
| `edge/handlers/plugin/browse.ts` | VERIFIED / VERIFIED / VERIFIED | Registered command uses the handler; refusal returns before marketplace/picker access. |
| `tests/edge/register.test.ts` | VERIFIED / VERIFIED / VERIFIED | Production router/dispatcher exercised; complete outcomes and two invocation IDs asserted. Full gate selects its source pair. |
| `tests/shared/notification-grammar.test.ts` | VERIFIED / VERIFIED / VERIFIED | Exact empty/nonempty usage tuples; grammar source pair selected. |
| `shared/errors.ts` | VERIFIED / VERIFIED / VERIFIED | Fixed no-argument DeviceFlowUnavailableError constructor; imported by lazy guard and narrow callback catch. |
| `orchestrators/auth-host.ts` | VERIFIED / VERIFIED / VERIFIED | Marketplace/plugin auth composition consumes the lazy bundle; fill and memo paths precede the guard. |
| `tests/integration/auth-e2e.test.ts` | VERIFIED / VERIFIED / VERIFIED | Real Git library, production add and real temporary staging/state; only boundary transports/credentials are substituted. Selected by integration script. |
| `tests/e2e/pi-json-output.test.ts` | VERIFIED / VERIFIED / VERIFIED | Eight actual runtime cases; selected by pinned and nightly e2e globs. |
| `tests/e2e/json-output-runtime.ts` | VERIFIED / VERIFIED / VERIFIED | Imported and used by all eight cases; fresh fixture, allowlisted environment, EOF/RPC sequencing, bounded streams and cleanup. |
| `tests/e2e/pi-peer-floor/package-lock.json` | VERIFIED / VERIFIED / VERIFIED | Private manifest pins 0.86.1; fixture-local CLI containment and actual version asserted; CI provisions lock with scripts disabled. |
| `.github/workflows/ci.yml` | VERIFIED / VERIFIED / VERIFIED | Floor provisioning precedes e2e selection. Guide-only selector independently checked after WR-01. Hosted CI itself was not run here. |
| `docs/json-output.md` (07-04 and 07-05) | VERIFIED / VERIFIED / VERIFIED | Actual fences execute; recursive kind/path/requiredness inventory checked; H4/H5 retain semantic review. |
| `tests/architecture/json-output-docs.test.ts` (07-04 and 07-05) | VERIFIED / VERIFIED / VERIFIED | Unpaired test glob executes it; reads actual guide/schema, compares independent expected values, includes planted omissions. |
| `README.md` | VERIFIED / VERIFIED / VERIFIED | One short link to the existing guide, with no new quick-start example. |
| `AGENTS.md` | VERIFIED / VERIFIED / VERIFIED | IL-2 names notify for tui/print and appendEntry for json/rpc; direct-write ban and IL-3 exception retained. H6 pending. |
| `.planning/BACKLOG.md` | VERIFIED / VERIFIED / VERIFIED | MRO-01 closed in place; false human-string and dual/print-output proposals explicitly corrected; links resolve. H6 pending. |
| `docs/output-catalog.md` | VERIFIED / VERIFIED / VERIFIED | Catalog owner and immutable fence audit consume it; locks unchanged. H6 pending for bounded prose approval. |
| `07-CORPUS-ADDITIONS.md` | VERIFIED / VERIFIED / VERIFIED | Auditor parses the exact count-one tuple and provenance; original ledger exists in bf2e84ab before amendment. |
| `07-corpus-audit.mjs` | VERIFIED / VERIFIED / VERIFIED | Independently executed; no import from retired tools; exact multisets, metadata, reports, concrete bytes, negative controls and retirement checks. |
| `07-CORPUS-FINAL.log` | VERIFIED locally / VERIFIED / VERIFIED | Ignored live log exists and equals decoded durable `07-CORPUS-FINAL.json`. JSON companion is tracked and consumed by the auditor. No force-add; durable evidence survives loss of the live log. |

Production path prefixes follow E1/E2. Artifact verification is separate from the pending human semantic judgments.

### Key Link Verification

| From | To | Via | Status / evidence |
| --- | --- | --- | --- |
| Browse handler | Notification dispatcher | notifyUsageError with current run | WIRED — E1 actual call and registered full payload assertions. |
| Registered tests | JSON capture | entry sink and assertValid | WIRED — production registration/router/dispatcher execute, UI getter rejects wrong transport. |
| auth-host | git-auth-callbacks | onAuthRequired after fill miss | WIRED — fill precedes lazy callback; memo precedes mode guard; E2 tests exercise both. |
| Auth callback | Marketplace add | Real Git clone rejection, cleanup and preserved cause | WIRED — actual adapter calls and integration outcomes; no mocked clone result. |
| Pi runtime tests | Production index.ts | Explicit absolute --extension argument | WIRED — helper:163–165; observed actual CLI output on both versions. |
| CI | Peer-floor lock | npm --prefix tests/e2e/pi-peer-floor ci --ignore-scripts | WIRED — pinned and nightly jobs provision before e2e. |
| Docs test | Guide | Labeled-fence extraction and Bash/jq execution | WIRED — runExample reads the guide, then executes that exact code. |
| Guide | Dispatcher outcome classifier | Same twelve known outcome kinds | WIRED — compared with isCommandOutcome; non-outcome/unknown-only cases fail. |
| Docs inventory test | Committed schema | Recursive references/unions/paths/requiredness | WIRED — positive inventory and missing-kind/field/requiredness controls. |
| AGENTS IL-2 | PROJECT D8 / dispatcher | Exclusive mode-selected sinks | WIRED — policy text agrees with actual exhaustive dispatch; H6 retains prose judgment. |
| Corpus auditor | Immutable and amended baselines | git show, exact tuples and serialized prefix | WIRED — fresh --retired execution. CLI pattern check was unevaluated because YAML `pattern: 3149` is numeric; direct source and executable audit resolve the link. |
| Final report | Retired recorder | Historical strict execution and exact tool hashes | WIRED as retained evidence — report/inputs read from durable JSON; three recorded tool hashes equal a9673e10 blobs. Current absence is required, not an orphan. |

Owner CLI found 11/12 patterns; the remaining numeric-pattern parser limitation is explicitly resolved above. No link is accepted solely from a grep match.

### Data-Flow Trace (Level 4)

| Artifact / value | Source → transformation → observable output | Status |
| --- | --- | --- |
| Browse refusal mode/message | Live ctx.mode → handler message/usage → resolveRawSurface → toWirePayload or formatRawSurface → selected sink | FLOWING; fixed remedy is intentional contract text, not stub data. |
| Typed print auth refusal | Real Git challenge → credential fill miss → lazy memo miss → live print check → typed error → real Git/add cleanup outcome | FLOWING; device HTTP remains untouched and state/staging assertions observe the result. |
| List JSON | Production extension in fresh real Pi → actual empty scope inventory → cascade → Pi entry_appended stdout → schema validation | FLOWING; empty inventory is a real input condition, not a mocked stdout response. |
| Startup/RPC data | Actual session_start/resources_discover callbacks → session entries → later probe/get_entries → parsed stdout assertions | FLOWING; positive memory controls prevent a vacuous stream-absence pass. |
| Consumer verdict/reload | JSONL input file + selected invocation ID → actual guide jq → complete visible payloads, maximum severity, exit status and boolean OR | FLOWING; synthetic cases are independent test inputs, not claimed real runtime captures. |
| Schema reference | Committed TypeBox-derived schema → recursive inventory versus authored guide tables | FLOWING for field coverage; semantics remain H4. |
| Corpus preservation | Immutable original Git blob + exact ledger + retained fresh capture/report → independently checked multiset, bytes and current input hashes | FLOWING; seven negative controls reject permissive amendments. Historical honesty remains H3. |

### Behavioral Spot-Checks and Full Gate

All fresh checks ran on the requested HEAD with Node v26.11.1. Subprocess permission was granted; no automatic approval rejection occurred. No packages were installed.

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Required clean combined-tree gate | `timeout 2400 npm run check` | Exit 0; typecheck, lint, workflow install checks, Fallow, Prettier, pairing, unpaired tests, integration and all 266 direct pairs | PASS |
| Current/floor real runtime | `timeout 180 node --test --test-isolation=none --test-reporter=spec tests/e2e/pi-json-output.test.ts` | Exit 0; 8 pass, 0 fail/cancel/skip/todo; 18.99 seconds | PASS |
| Real staging cleanup after typed refusal | `timeout 10 node --test --test-isolation=none --test-reporter=spec --test-name-pattern='^print marketplace add rejects with its remedy after removing the real staged clone$' tests/integration/auth-e2e.test.ts` | One named test passed; 0 skips; 4.83-second process | PASS |
| Separate repeated browse runs | `timeout 10 node --test --test-isolation=none --test-reporter=spec --test-name-pattern='^registered "browse" refuses each browse invocation in json without state or UI access$' tests/edge/register.test.ts` | One named test passed; 0 skips; 6.13-second process | PASS |
| No operation retry/rollback on output failure | `timeout 10 node --test --test-isolation=none --test-reporter=spec --test-name-pattern='does not retry or roll back committed work when its notification fails' tests/edge/command-run.test.ts` | One named test passed; 0 skips; 2.90-second process | PASS |
| WR-01 guide-only selection | Parse actual CI YAML and npm-check regex; assert docs/json-output.md matches push, pull_request and hook | All three assertions passed | PASS |
| Scoped whitespace | `git diff --check 64bcfa027530b55319446ea781facab229df92cd -- AGENTS.md .planning/BACKLOG.md docs/output-catalog.md` | Exit 0 | PASS |

The full workspace gate ran **once**. It covers the 124 existing test files referenced by six prior phase reports; the inventory was checked against actual files and configured selectors. No prior `npm run check` result was reused based only on paths. Full check began with clean tracked and untracked state, and the tree remained clean after tests.

Full-check log: `/tmp/json-output-verify07-clean-head-check.log`. Its complete substantive output:

```text
> pi-claude-marketplace@0.19.2 check
> npm run --silent check:static && npm run --silent test:unpaired && npm run --silent test:integration && npm run --silent test:coverage:direct:all

passed typecheck (9.7 s)
passed lint (3.8 s)
passed lint:workflows (0.4 s)
passed fallow (4.5 s)
passed format:check (6.0 s)
passed test:corresponding (3.3 s)
Merged LCOV: coverage/direct.lcov (266 records)
```

The command returned exit 0, not timeout. Quiet test output does not imply that the inherited optional-peer skip executed. Its retained evidence and limitation remain below.

### Real-Pi Results

Fresh log: `/tmp/json-output-verify07-real-pi.log`.

| Runtime | Real list stdout | JSON startup | RPC startup/get_entries | Persistence enabled |
| --- | --- | --- | --- | --- |
| Installed 0.87.1 | One schema-valid command cascade, plugin list, empty marketplaces, exit 0 | Both markers in memory, neither streamed; later proof streamed | Both markers retrieved; correlated replies complete, exit 0 | Slash-only run creates zero session files without --no-session |
| Independent floor 0.86.1 | One schema-valid command cascade, plugin list, empty marketplaces, exit 0 | Both markers in memory, neither streamed; later proof streamed | Both markers retrieved; correlated replies complete, exit 0 | Slash-only run creates zero session files without --no-session |

Each runtime executes its manifest-selected CLI and verifies its actual --version. JSON stdin is closed. The production extension path is explicit. Child environments contain only PATH and fixture-specific HOME/Pi settings. Streams and deadlines are bounded; temporary directories are removed. No server, external service, live authentication, or operator fixture was used. Hosted Actions and unrelated upstream e2e suites are not claimed as executed.

### Probe Execution and Corpus Provenance

No conventional `scripts/**/tests/probe-*.sh` files were found. The applicable phase-local runnable probes were executed in this verifier's process:

| Probe | Command | Result | Status |
| --- | --- | --- | --- |
| Amendment negative controls | `node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --self-test` | Exit 0; positive amendment and seven negative controls | PASS |
| Final-tree preservation/retirement | `node .planning/phases/07-mode-refusals-real-pi-verification-and-docs/07-corpus-audit.mjs --retired` | Exit 0; exactly three tools retired; 848 remaining tracked files read; behavior inputs unchanged | PASS |
| Original tool identity | Compare each final-evidence tool hash with `git show a9673e10:<tool>` | All three hashes identical | PASS |

The retired-mode audit rechecks the ledger, immutable original prefix/multiset, amended metadata, complete captured report, report hashes, current concrete tracked/runtime inputs, all 264 catalog fences against `26cb0056`, and unchanged 260-state/39,143-byte owner locks. It permits exactly the three approved tool removals.

The original ledger commit `bf2e84ab` precedes amendment `a9673e10`, which precedes deletion `0a11761d`. Post-WR-01 retained capture and strict evidence identify `0dffe6c1deeb9609360f8c4614fa7b9a2f43e5c1`. Historical tool bytes match; current input comparison succeeds after their removal. The final report ends with:

```text
ℹ tests 10228
ℹ suites 347
ℹ pass 10227
ℹ fail 0
ℹ cancelled 0
ℹ skipped 1
ℹ todo 0
Notify corpus check passed: 3150 baseline entries present, 0 extra.
```

These are retained **pre-retirement corpus results**, independently revalidated now. This verifier did not restore the tools or rerun --final/--ledger modes, which require them. The local ignored log and durable JSON companion decode identically. The complete capture and report companions are intentional, documented preservation artifacts.

### Requirements Coverage

| Requirement | Source plans | Contract | Status | Evidence |
| --- | --- | --- | --- | --- |
| MODE-03 | 07-01, 07-06 | Non-tui browse refuses with error and list remedy | SATISFIED | E1; exact machine/text messages, implicit/repeated routing, no list/state/picker work; D03 help correction retained. |
| MODE-04 | 07-02, 07-06 | Lazy typed print auth refusal before polling | SATISFIED; H7 assumption remains | E2; stored/memo/public paths, exact typed cause, zero device HTTP, real Git and staging cleanup. |
| TENB-03 | 07-03 | Real headless JSON output at peer floor; startup gap | SATISFIED | Eight freshly executed cases, zero skips, both exact runtime identities and positive startup controls. |
| JDOC-01 | 07-04, 07-05 | All kinds/fields, compatibility, maximum severity and jq | NEEDS HUMAN (WARNING) | Executable/inventory checks pass; semantic/reference judgment H4 and broad guidance prohibition H2 remain. |
| JDOC-02 | 07-03, 07-04, 07-05 | Print/process/startup/RPC/persistence limitations | NEEDS HUMAN (WARNING) | Runtime claims and consumer behavior pass; completeness/delivery wording H5 and privacy judgment H1 remain. |
| JDOC-03 | 07-05, 07-06 | IL-2 corrected; MRO-01 closed and claims corrected | NEEDS HUMAN (WARNING) | Actual bounded edits present and consistent; planned checkpoint/unclassified assumption H6 remains. |

All six IDs assigned to Phase 7 in REQUIREMENTS.md appear in PLAN frontmatter. **Orphaned requirements: 0.** Requirement checkboxes and shared progress files were not changed.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts.

Owner result: **14/14 honored; not_honored: []**. This warning-only heuristic is corroborated below; it is not human acceptance of prohibitions or prose.

| Decision | Actual implementation/evidence | Disposition |
| --- | --- | --- |
| D01 | Exact actual-mode browse refusal, no list fallback, unchanged TUI branch | VERIFIED |
| D02 | Fixed typed remedy; fill/memo before live print guard; real Git cleanup | VERIFIED; unnamed MODE-04 assumption remains H7 |
| D03 | JSON/RPC usage help; print empty usage produces only refusal/remedy | VERIFIED; corrected user choice honored |
| D04 | Dedicated guide plus short README link | VERIFIED |
| D05 | Runnable command/result first; Limitations later | VERIFIED |
| D06 | Common fields once, nineteen kind tables, compatibility and maximum severity | Mechanical coverage VERIFIED; semantic review H4 pending |
| D07 | Separate actual jq tasks for rows/severity/exit/reload | VERIFIED |
| D08 | Warnings displayed with success; errors fail; Pi status separate | VERIFIED |
| D09 | Exact missing-outcome failure; prompts/diagnostics insufficient | Executable behavior VERIFIED; broad prohibition H2 pending |
| D10 | Earlier result plus final error, visible retained payloads and reload true | VERIFIED |
| D11 | Real stdin-closed runs, schema/stdout, exact floor, startup controls, isolated env | Runtime VERIFIED; privacy prohibition H1 pending |
| D12 | Full Limitations plus one append recovery/no retry/no rollback/sustained failure | Behavioral support VERIFIED; wording/privacy H5/H1 pending |
| D13 | IL-2/MRO-01/catalog topics, exact fences/locks, tools retired after retained strict proof | Mechanical evidence VERIFIED; content/provenance H6/H3 pending |
| D14 | Original 3149 preserved byte-for-byte; exactly one independently specified refusal appended; 3150/zero extras | VERIFIED; no superseded fixed-count rule applied |

### Test Quality Audit

| Test area | Linked requirement | Execution / skips | Oracle and strongest assertion | Verdict |
| --- | --- | --- | --- | --- |
| Browse, registration, grammar owners | MODE-03 | Fresh full direct pairs plus one named registered case; no disabled new acceptance cases | Independently stated complete payloads/text; strict forbidden-access boundaries; two invocations | PASS |
| Errors, callback, auth-host, Git owners and auth-e2e | MODE-04 | Fresh full pairs/integration plus named real cleanup case | Exact type/object/cause, zero HTTP, state bytes and staging contents; actual Git library | PASS |
| pi-json-output suite | TENB-03 / JDOC-02 | Fresh 8/8, zero skips | Real CLI stdout, schema and full cascade, marker positive controls, request IDs and session-file absence | PASS |
| json-output-docs suite | JDOC-01 / JDOC-02 | Fresh unpaired gate | Executes actual guide fences; independent expected full values/status; malicious-looking IDs passed as data; negative no-outcome matrix | PASS for executable behavior |
| Reference inventory | JDOC-01 | Fresh unpaired gate | Schema-derived inventory versus authored tables; planted missing fields/kind and wrong requiredness fail | PASS for inventory; H4 semantics not proved |
| Catalog/corpus | JDOC-03 / preservation | Catalog owner in fresh gate; fresh audit probes, retained full capture | Immutable pre-phase oracle, exact independently predicted addition; seven negative controls | PASS mechanically; H3 honesty judgment pending |

No committed only/skip/todo markers, unreferenced TBD/FIXME/XXX debt, or placeholder implementations were found in the reviewed implementation/test scope. No new requirement has only a skipped test.

The corpus's legacy expected values originate at the immutable earlier revision, not a recapture of the changed implementation. The one added tuple is independently stated in the owner test and hardcoded audit; changing the ledger count or unrelated content fails. This proves preservation relative to the accepted prior contract, not universal correctness of every historic message.

**Disconfirmation:** (1) field-path coverage cannot prove semantic field descriptions, so SC3/H4 remains open; (2) absence-only startup assertions would be vacuous, but actual tests also require memory/get_entries markers and later streamed output; (3) swallowed auth rejection or cleanup failure would hide the remedy, but actual clone/fetch and cleanup-failure cases assert identity/cause and state. Sustained output failure is tested/documented, not converted into a success guarantee. No unsupported BLOCKER was manufactured.

**Coincidental reliance:** none identified for VERIFIED truths. Credential/memo fixtures supply inputs the real caller supplies; production explicitly establishes sequencing. Real-runtime isolation is constructed by the harness and asserted, rather than an undeclared developer environment precondition.

### Anti-Patterns, Review Disposition, and Existing Limits

| Item | Classification | Disposition |
| --- | --- | --- |
| WR-01 guide omitted from check selectors | Resolved | Both actual selectors now include guide; fresh selector probe and full gate passed. Original review retained; disposition open=0. |
| Three descriptor-less judgment prohibitions | WARNING / UNCERTAIN | H1–H3; flagged-unverified, no fabricated enforcement descriptor or human approval. |
| Schema semantics and limitation prose | WARNING / UNCERTAIN | H4–H5; inventories/runtime tests do not approve wording. |
| Bounded policy checkpoint and JDOC-03/unclassified | WARNING / UNCERTAIN | H6; planned human-check harvested and retained. |
| MODE-04/unclassified | WARNING / UNCERTAIN | H7; no supplied category to turn into a test. |
| TEST-07-06-01 / WINDOWS 89 | Existing coverage limitation | Optional pi-subagents resolver case did not execute. Retained corpus is 10227 pass plus 1 skip. All eight new real-Pi cases did execute. |
| DEP-07-03-01 | Existing dependency WARNING | brace-expansion advisory remains open. Fixed isolated/bounded fixture inputs are documented controls; no clean npm-audit claim and no risk acceptance. |
| Broader Fallow 16 duplicate groups | Outside-phase structural context | Retained original scope assessment; no scoped duplicates. Fresh full Fallow gate passed. No unrelated remediation requested. |
| Fallow review orientation | Advisory context only | Fresh phase-range review exited 0; public-consumer prompts reviewed against actual small diffs. Captured FALLOW.json strings are report content, not added source suppressions. |

The supplied security register records 20 planned threats closed and zero open. This verification checked their concrete refusal, credential-boundary, cleanup, isolation, consumer, schema and corpus controls. That supports the register; it does not waive the dependency advisory or substitute for the three human prohibitions.

The full milestone roadmap has no later phase after 7. No failed contract was moved into an invented future phase. Existing deferred dependency/optional-peer records are disclosed limitations, not a new waiver or phase-completion decision.

### Human Verification Required

Each item requests an explicit human disposition. All machine work is complete; no product change is requested unless review identifies a concrete defect.

#### H1. Privacy and correlation prohibition

**Test:** Review the correlation lifetime and runtime fixture environment in notification-run.ts, edge/command-run.ts and tests/e2e/json-output-runtime.ts: decide the 07-03 privacy prohibition.

**Expected:** Invocation IDs identify one command and its nested work only; no cross-session identity, telemetry, or operator-credential collection is introduced.

**Why human:** Descriptor-less judgment prohibition. Allowlists, fresh directories and runtime tests support it, but no human resolution is recorded.

#### H2. Consumer success-guidance prohibition

**Test:** Read the guide's opening, preparation, severity, exit-status and partial-result sections as a consumer; decide the 07-04 success-guidance prohibition.

**Expected:** Silence, prompts and diagnostics alone never imply success; missing outcomes fail explicitly, warnings remain visible, errors fail, and earlier results survive.

**Why human:** Executable snippets pass the negative cases. The broader meaning of all consumer guidance is a descriptor-less judgment requiring explicit human resolution.

#### H3. Corpus and runtime evidence honesty

**Test:** Review bf2e84ab -> a9673e10 -> 0a11761d plus the post-WR-01 evidence at 0dffe6c1 in 07-CORPUS-CAPTURE-EVIDENCE.json, 07-CORPUS-FINAL.json and 07-RETIREMENT.json; decide the 07-06 honesty prohibition.

**Expected:** Exactly 3149 originals plus one D14 refusal; no suppressed selection, rewritten old samples or claimed unexecuted cases. Retain the one optional-peer skip and distinguish retained pre-retirement evidence from this verifier's fresh checks.

**Why human:** Hashes, negative controls, history and fresh retirement probe agree, but provenance interpretation and the descriptor-less concealment prohibition have no recorded human disposition.

#### H4. Schema meanings and compatibility

**Test:** Compare docs/json-output.md Schema reference and Closed-set tokens against schema/claude-plugin.schema.json and notification-wire.ts, especially conditional fields, field types/meanings and additive compatibility.

**Expected:** All nineteen kinds are understandable; each field's type and meaning is accurate; optional field/kind/member additions keep version and removals/renames/type/meaning changes bump it.

**Why human:** Inventory tests prove paths and requiredness and reject omissions; they require nonempty type/meaning cells but do not prove their semantic correctness or readability.

#### H5. Limitations and delivery wording

**Test:** Review the guide's Limitations and partial-failure wording against the eight fresh real-Pi cases and command-run recovery behavior.

**Expected:** Clear distinction among print silence, plugin severity versus process status, startup memory versus streaming, RPC get_entries/rendering, initial slash-only persistence versus --no-session, and one recovery attempt with no operation retry or rollback guarantee.

**Why human:** Runtime and failure-path tests pass. Completeness and interpretation of the bounded prose remain an explicit phase judgment.

#### H6. Bounded policy/catalog changes and JDOC-03

**Test:** Review git diff 64bcfa027530b55319446ea781facab229df92cd HEAD -- AGENTS.md .planning/BACKLOG.md docs/output-catalog.md; resolve the deferred human-check and JDOC-03/unclassified assumption.

**Expected:** Only IL-2 changes in AGENTS; MRO-01 corrects both false claims; catalog edits stay within resolver-marker ownership and dispatch text-strategy device-flow ownership. Confirm any missing JDOC-03 concern or state that the bounded contract is sufficient.

**Why human:** The planned human-check explicitly asks for content inspection. Fences/locks already pass mechanically; an unclassified concern cannot be declared tested without identifying it.

#### H7. Unclassified MODE-04 concern

**Test:** Resolve MODE-04/unclassified: review the tested live-mode/credential/memo/Git/cleanup matrix and name any additional intended edge behavior, or explicitly conclude that D02's bounded contract covers it.

**Expected:** A concrete missing case is specified, or the unclassified assumption is explicitly disposed of. Existing exact typed refusal, zero device HTTP and cleanup results remain valid.

**Why human:** The edge probe supplied no behavioral category. No executable assertion or user approval can be inferred for an unnamed concern.

### Gaps Summary

No implementation gap or blocking machine-check failure was found. The status is **human_needed**, because the seven explicit review items remain unresolved. None is silently accepted. Four broad roadmap truth rows remain UNCERTAIN until their associated content/provenance reviews are resolved; all runtime behavioral assertions have passing execution evidence.

No shared tracking, source, tests, baseline or dependency files were modified by this verification. Phase completion was not set. No commit was made.

### Fingerprint and Status Self-Check

The frontmatter `covered_files` and `covered_digest` are the exact values returned by:

```text
node .codex/gsd-core/bin/gsd-tools.cjs query verification.fingerprint .planning/phases/07-mode-refusals-real-pi-verification-and-docs <explicit root-relative covered paths>
```

The CLI automatically includes the six PLAN/SUMMARY pairs and excludes this report. Covered evidence includes the actual changed implementation/configuration/tests, supporting source/schema files, audit program, corpus bytes and durable evidence companions. The three intentionally deleted script paths cannot be fingerprint inputs (the owner rejects missing paths); their absence and historical identity are proven by the covered retirement auditor and retained tool hashes. No manual hash or commit SHA was substituted for the canonical digest.

After writing, `query verification.status .planning/phases/07-mode-refusals-real-pi-verification-and-docs --pick status` returned `human_needed` with exit code 0. Re-running the exact fingerprint command returned identical covered files and digest. `git status --short` showed only this new report; no tracked file changed.

---

_Verified: 2026-10-10T04:41:45Z_
_Verifier: gsd-verifier_
