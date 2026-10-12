---
phase: 03-typed-raw-surfaces
plan: "03"
subsystem: notifications
tags: [notification-dispatch, text-strategy, raw-surfaces, device-flow, auth-09, notify-corpus, typescript]

requires:
  - phase: 03-typed-raw-surfaces
    provides: "03-01/03-02: RawSurface, resolveRawSurface, formatRawSurface, the private deliver sink, emitRawSurface, the D-15 arity table"
provides:
  - "DeviceFlowPrompt {verificationUri, userCode} and DeviceFlowPromptSurface (kind device-flow-prompt), with RawSurface widened (RAWS-03, D-10, D-12)"
  - "The device-flow-prompt arm of formatRawSurface: `Open <uri> and enter: <code>` at explicit info (D-09, D-15)"
  - "notifyDeviceFlowPrompt(ctx, prompt), which copies the two fields by name; makeRawNotifyFn is deleted"
  - "InitiateDeviceFlowOpts.onDeviceCode: (prompt: DeviceFlowPrompt) => void; the NotifyFn type is deleted"
  - "The AUTH-09 gate retargeted: scanDeviceCodeCalls and scanPromptBindings with positive counts and exact-form allow-lists (D-11)"
  - "03-CORPUS-CHANGES.json (D-17) and the spliced notify-corpus baseline and meta.json (3134 entries)"
affects: [03-04, 04-wire-schema, 05-mode-sink, 06-origin, 07-docs]

estimate:
  tokens: 110000
  tasks: 2
actuals:
  tokens: 21338
  tasks: 2
  commits: 2
plan_head_before: 1d9f6a7ceb1230315b9ea8886df4951a2954dbf0
plan_head_after: 7f4ad29bdeee06e8698f0f445e4f59a01127a5a9

tech-stack:
  added: []
  patterns:
    - "A domain callback carries values typed by a shared interface; the orchestrator binds it to a dispatch helper, and the text strategy composes the sentence"
    - "A dispatch helper copies each kind field by name and never spreads its argument, so only declared fields reach the kind (AUTH-09)"
    - "A lexical gate pairs a positive call count with an exact-form allow-list count and requires the two to be equal (D-11, D-07-03)"

key-files:
  created:
    - .planning/phases/03-typed-raw-surfaces/03-CORPUS-CHANGES.json
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-grammar.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/domain/github-auth.ts
    - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
    - tests/shared/notification-types.test.ts
    - tests/shared/notification-grammar.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/domain/github-auth.test.ts
    - tests/domain/device-flow-contract.ts
    - tests/integration/auth-e2e.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/architecture/no-credential-leak.test.ts
    - scripts/check-unused-type-members.contracts.json
    - .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl
    - .planning/phases/01-presentation-model/notify-corpus/meta.json

key-decisions:
  - "The Task 2 commit uses the plan's prescribed title `test(notify): ledger the approved corpus changes`, so its scope is `notify` and not `03-03`"
  - "The two allow-list regexes are named module constants (ALLOWED_DEVICE_CODE_CALL, ALLOWED_PROMPT_BINDING) with D-11 JSDoc, so 03-04's planted controls can reuse the scan functions unchanged"
  - "The splice ran as a one-off script in the session scratchpad that imports parseCorpus and serializeCorpus; the tool's baseline and capture verbs were never run"

patterns-established:
  - "onDeviceCode: (prompt) => { notifyDeviceFlowPrompt(ctx, prompt); } is the only allowed binding form in a provider file"

requirements-completed: []

coverage:
  - id: D1
    description: "The domain passes { verificationUri, userCode } to onDeviceCode once, before polling; it composes no text and imports no ctx"
    requirement: RAWS-03
    verification:
      - kind: unit
        ref: "tests/domain/github-auth.test.ts#passes the documented AUTH-03 values before any token is acquired"
        status: pass
      - kind: unit
        ref: "tests/domain/device-flow-contract.ts (prompts observation; run by github-auth.test.ts and device-flow-fake.test.ts)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- domain/github-auth.ts (78/78 branches, 10/10 functions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "auth-host binds onDeviceCode to notifyDeviceFlowPrompt; the helper copies the two fields into the device-flow-prompt kind and the text strategy composes the prompt at info with two arguments"
    requirement: RAWS-03
    verification:
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#notifyDeviceFlowPrompt emits the verification URI and user code at info severity"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface renders device-flow-prompt with its explicit severity"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface renders empty device-flow values verbatim"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-grammar.test.ts#formatRawSurface passes a device-flow URI with a query string through verbatim"
        status: pass
      - kind: integration
        ref: "tests/integration/auth-e2e.test.ts (four device-flow cases, unchanged recorded-message assertions)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/auth-host.test.ts (unchanged device-flow assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The AUTH-09 gate requires at least one onDeviceCode call and one prompt binding, each in its exact allowed form; the removed-callback patterns are deleted"
    requirement: RAWS-03
    verification:
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09: domain/github-auth.ts never interpolates a token in an Error message and passes only the prompt values to onDeviceCode"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#PROV-05: every provider file is scanned for token interpolation in an Error message, and every device-code prompt binding has the exact form"
        status: pass
    human_judgment: false
  - id: D4
    description: "The D-17 exception is ledgered as five exact records in its own commit, and the corpus check passes with 3134 entries and zero extras; the catalog is unchanged"
    requirement: TEXT-01
    verification:
      - kind: other
        ref: "Task 2 ledger command (Approved corpus changes: 2 removals, 3 additions; unchanged occurrences: 3131; total: 3134)"
        status: pass
      - kind: other
        ref: "Task 2 corpus wrapper over node scripts/notify-corpus.mjs check (Corpus: 3134 present, 0 extra)"
        status: pass
      - kind: other
        ref: "git diff --exit-code 4e6c568a -- docs/output-catalog.md"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat/catalog-contract.test.ts"
        status: pass
    human_judgment: false

duration: 1h 13m
completed: 2026-10-03
status: complete
---

# Phase 3 Plan 03: Typed Device-Flow Prompt and Corpus Ledger Summary

**The Device Flow prompt is now the `device-flow-prompt` raw kind. `initiateDeviceFlow` hands `{ verificationUri, userCode }` to a typed `onDeviceCode` callback, `auth-host.ts` binds it to `notifyDeviceFlowPrompt`, and the text strategy composes `Open <uri> and enter: <code>` at info. `makeRawNotifyFn` and `NotifyFn` are gone, the AUTH-09 gate counts and allow-lists the new call forms in the same commit, and the D-17 corpus exception is ledgered and spliced in its own commit.**

## Performance

- **Duration:** about 1h 13m. Most of it was the two full-scope pre-commit runs, about 30 and 25 minutes.
- **Started:** about 2026-10-02T23:40Z. The start time was not captured; the previous plan's last commit is at 23:37Z.
- **Completed:** 2026-10-03T00:53:10Z
- **Tasks:** 2
- **Files modified:** 20 (17 in Task 1, 3 in Task 2)

## Accomplishments

- `DeviceFlowPrompt` is declared once in `shared/notification-types.ts`. `DeviceFlowPromptSurface` extends it with `kind: "device-flow-prompt"`, and `RawSurface` includes it outside every fixed-origin group (D-10, D-12, D-14). The domain imports the type with `import type`, so no second interface exists for the type-member gate to report.
- `formatRawSurface` has a `device-flow-prompt` arm that returns the template at explicit `"info"`, with two arguments (D-09, D-15).
- `notifyDeviceFlowPrompt(ctx, prompt)` makes one `emitRawSurface` call. It copies `prompt.verificationUri` and `prompt.userCode` by name and never spreads `prompt`. `makeRawNotifyFn` and the `Severity` type import it alone used are deleted. The module's only notify calls are the two spellings inside `deliver`.
- `InitiateDeviceFlowOpts.onDeviceCode` replaces `notifyFn`. The call is `opts.onDeviceCode({ verificationUri: deviceCode.verification_uri, userCode: deviceCode.user_code })`. The header bullets D-32-04 and D-32-06, the AUTH-09 discipline paragraph, and the `describeDeviceCodeErrorBody` comment now describe the callback and the gate's allow-list.
- `auth-host.ts` binds `onDeviceCode: (prompt) => { notifyDeviceFlowPrompt(ctx, prompt); }`. The comment-only edits in `marketplace/add.ts`, `marketplace/update.ts`, and `platform/git-auth-callbacks.ts` keep each file's line count.
- The AUTH-09 gate (D-11):
  - The `new Error(`/`notifyFn(` call-site constant is deleted, and both bounded regexes keep only the `new Error(` arm.
  - `scanDeviceCodeCalls(root)` requires at least one `onDeviceCode(` call and requires every call to match the exact allowed form.
  - `scanPromptBindings(root)` requires at least one `notifyDeviceFlowPrompt(` call across the provider files and requires every call to sit in the exact binding. It returns the visited list, which the PROV-05 case deep-compares with `PROVIDER_FILES`.
- D-17: the ledger holds two removals (baseline lines 2967 and 2968) and three additions. All five belong to `tests/shared/notification-dispatch.test.ts`. The baseline now holds 3134 entries: 1658 one-argument and 1476 two-argument calls.

## Task Commits

1. **Task 1: The device-flow prompt crosses the domain as values; the raw callback is deleted and AUTH-09 follows the new call.** `2b24f19c` (feat)
2. **Task 2: Ledger and splice the approved corpus changes in their own commit.** `7f4ad29b` (test)

## Verification Evidence

Both tasks: `focused task verification passed; full phase/PR verification pending` for the phase gate. Each task's pre-commit run had full scope, as described below.

- **Task 1 verify:**
  - Typecheck exit 0.
  - `node --test` on the nine listed files: 572 pass, 0 fail.
  - Direct coverage is 100% function, line, and branch for all five pairs: github-auth 78/78 branches, auth-host 20/20, dispatch 50/50, grammar 178/178, types 26/26.
  - `! git grep -n -w -e makeRawNotifyFn -e NotifyFn -e notifyFn -- extensions tests` prints nothing.
  - `lint:type-members` exit 0 after the re-pin, with the 3 recorded exceptions.
  - ESLint exit 0 on the 16 changed `.ts` files after one padding-line fix in `auth-e2e.test.ts`.
- **Task 1 acceptance:**
  - The binding grep prints `auth-host.ts:194`, and the option grep prints `github-auth.ts:125`.
  - The `...prompt` grep over the dispatch module prints nothing.
  - Both scan functions exist, and both real-tree cases pass.
  - `git diff --exit-code 4e6c568a -- docs/output-catalog.md extensions/pi-claude-marketplace/edge extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts` exits 0.
- **Allow-list sanity check:** an ad-hoc run of the two regexes gave 1 call and 1 allowed form on the real `github-auth.ts`, and 1 call and 0 allowed forms with an extra `token` member planted. It gave 1 helper call and 1 binding on the real `auth-host.ts`, and 1 helper call and 0 bindings with `{ ...prompt }` planted. The committed planted controls belong to 03-04.
- **Pre-splice corpus diff (Task 1 tree, `node scripts/notify-corpus.mjs check`, exit 1):** every line below names only `tests/shared/notification-dispatch.test.ts`.
  - `extra in tests/shared/notification-dispatch.test.ts: "reconcile aborted: boom" (argc 2, severity error) x1`
  - `extra in tests/shared/notification-dispatch.test.ts: "plugin PATH not refreshed for project scope (install state unreadable): schema unsupported" (argc 2, severity warning) x1`
  - `extra in tests/shared/notification-dispatch.test.ts: "Open https://github.com/login/device and enter: ABCD-1234" (argc 2, severity info) x1`
  - `missing in tests/shared/notification-dispatch.test.ts: "failed" (argc 2, severity error) x1`
  - `missing in tests/shared/notification-dispatch.test.ts: "plain" (argc 1, severity null) x1`
- **Task 2 precondition:** the HEAD blobs were `225a5161a97bc3952a41cfae067592fe2c8bc6ca` (baseline) and `e1b8e05aa197fe8ba167bc699a79d28163d8fc95` (meta).
- **Ledger command output:** `Approved corpus changes: 2 removals, 3 additions; unchanged occurrences: 3131; total: 3134`. It ran on the Task 2 tree and again on the final tree.
- **Ledger negative controls (run, then restored and checked with `cmp`):**
  - Dropping one `tests/index.test.ts` entry from the baseline fails the multiset assertion, exit 1.
  - Changing a removal's `line` from 2967 to 2966 fails the removal-triple assertion, exit 1.
  - A first attempt at the baseline control matched no line, because no `tests/domain/` entries exist. It then removed only the trailing newline and failed on the serialization round-trip. That attempt was replaced with the `tests/index.test.ts` control above.
- **Corpus wrapper output:** `Corpus: 3134 present, 0 extra`. It ran on the Task 2 tree and again on the final tree.
- **Prettier:** `--check` passes on the ledger and `meta.json`.
- **Catalog:** `git diff --exit-code 4e6c568a -- docs/output-catalog.md` exits 0. `tests/architecture/catalog-uat/catalog-contract.test.ts` passes 4 of 4.
- **Full check:** reused under the `skills/local-verification` rule, not re-run.
  - For both tasks, `npm run check:changed -- --list` reported `"scope": "full"` with the commands `npm run check` and `npm run test:coverage:direct:all`.
  - The Task 1 pre-commit ran them on exactly the tree committed as `2b24f19c` and logged `PRECOMMIT_EXIT=0`.
  - The Task 2 pre-commit ran them on exactly the tree committed as `7f4ad29b` and logged `PRECOMMIT_EXIT=0`. That is the final code tree.
  - Both runs used Node v26.10.0. Saved diffs show the hooks rewrote nothing, and the working tree was clean after each commit.
  - Logs are in the session scratchpad as `pc-0303-t1.log` and `pc-0303-t2.log`.
- **fallow audit (Task 1):** verdict `warn` with no `fail`. Dead code 0, complexity 0. The 6 clone groups attributed as introduced are the branch-base attributions recorded in 03-01 and 03-02, in scripts and edge handlers this plan did not touch.

## Contract Re-pins (line only, columns unchanged)

| Entry | Field(s) | Old | New |
| --- | --- | --- | --- |
| `dispatchInfoMessage.message` | id `:43`, filter `:12` | `notification-dispatch.ts:234` | `:249` |

The `notification-grammar.ts:914` and `notification-types.ts:647` pins did not move, because the type and grammar additions land after them.

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts`: `DeviceFlowPrompt`, `DeviceFlowPromptSurface`, and the widened `RawSurface`.
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts`: the `device-flow-prompt` arm.
- `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`: `notifyDeviceFlowPrompt`, with `makeRawNotifyFn` and the `Severity` import removed.
- `extensions/pi-claude-marketplace/domain/github-auth.ts`: `onDeviceCode` replaces `notifyFn`, the `NotifyFn` type is deleted, and the comments are rewritten.
- `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`: the per-host binding and the updated module header.
- `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/update.ts`, `platform/git-auth-callbacks.ts`: comment-only edits. Line counts are unchanged.
- `tests/shared/notification-dispatch.test.ts`: the raw-callback case is replaced by the `notifyDeviceFlowPrompt` case.
- `tests/shared/notification-grammar.test.ts`: the D-15 `device-flow-prompt` row (catalog example values) and the empty and query-string edge rows.
- `tests/shared/notification-types.test.ts`: a positive check for the kind, plus negatives for a token member and for a composed sentence as a `DeviceFlowPrompt`.
- `tests/domain/github-auth.test.ts`: 23 `onDeviceCode` mocks with exact values (20 with expectations, 3 with none), and the retitled AUTH-03 and provider cases.
- `tests/domain/device-flow-contract.ts`: the `prompts` observation.
- `tests/integration/auth-e2e.test.ts`: a typed `NotificationContext` capture that forwards through `notifyDeviceFlowPrompt`. Every recorded-message assertion and the AUTH-09 inline guard are unchanged.
- `tests/orchestrators/marketplace/add.test.ts`: one assertion message and one comment now say "Device Flow prompt".
- `tests/architecture/no-credential-leak.test.ts`: the retargeted AUTH-09 gate.
- `scripts/check-unused-type-members.contracts.json`: the re-pin above.
- `.planning/phases/03-typed-raw-surfaces/03-CORPUS-CHANGES.json`, `notify-corpus/baseline.jsonl`, and `notify-corpus/meta.json`: the D-17 ledger and splice.

## Decisions Made

- The Task 2 commit title is the plan's prescribed `test(notify): ledger the approved corpus changes`. Its scope is `notify`, not `03-03`.
- The allow-list regexes are named constants with D-11 JSDoc, and the scan functions take `root`. 03-04's planted controls can call them on a temporary root without changes.

## Deviations from Plan

None - plan executed exactly as written.

**Total deviations:** 0.

## TDD Gate Compliance

`workflow.tdd_mode` is `false`, so the RED/GREEN commit gate is advisory. Task 1 is one `feat(03-03)` commit that contains its owner tests, as in 03-01 and 03-02. The project's full-scope pre-commit run would not let a commit with failing tests through. RED was observed before committing: the new grammar and domain owner tests ran against the HEAD versions of `notification-grammar.ts` and `github-auth.ts`, with exit 1 and 39 failing cases. These were the three new `device-flow-prompt` grammar rows and every `initiateDeviceFlow` and contract case that expects the values call. The two files were then restored, and the restore was confirmed by an identical diff stat. Task 2 is a data commit with no tests of its own.

## Issues Encountered

- ESLint `@stylistic/padding-line-between-statements` flagged the new capture helper in `auth-e2e.test.ts`. A blank line before the `return` fixed it before the commit.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- No raw surface hands the sink a pre-composed string any more. The dispatch module's only notify calls are the two `deliver` spellings, which is ready for the D-16 sink gate in 03-04.
- 03-04 adds the AUTH-09 planted controls for `scanDeviceCodeCalls` and `scanPromptBindings`. RAWS-03 and TEXT-01 stay pending until 03-04 completes, because `requirements.ready-ids` reports 0 of 2 ready.
- `docs/output-catalog.md` near line 4088 still says the domain emits the prompt. Phase 7 criterion 6 carries that prose fix, and the catalog diff stays empty here.

## Self-Check: PASSED

- Files: `03-03-SUMMARY.md`, `03-CORPUS-CHANGES.json`, and every modified source file exist.
- Commits: `2b24f19c` and `7f4ad29b` are in `git log --all`.
- Measured commits: `git rev-list --count 1d9f6a7c..7f4ad29b` = 2.
