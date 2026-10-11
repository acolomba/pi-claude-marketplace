---
phase: 04-wire-schema-and-json-strategy
plan: "04"
subsystem: notifications
tags: [credential-redaction, presentation, json-strategy, auth-09, pmod-04]

requires:
  - phase: 04-wire-schema-and-json-strategy
    provides: presentNotification, the info-kind presentations, toWirePayload over presentations and resolved raw surfaces
provides:
  - redactCredentials, the one credential redactor (a leaf with no internal imports)
  - cause chains serialized with every link redacted (serializeCauseChain, so causeChainTrailer too)
  - redacted manual-recovery leaks and raw-surface strings (resolveFailure, resolveRawSurface)
  - redacted url-source marketplace-info urls, advisories, and plugin-info notes in the presentation step
  - AUTH-09 planted-credential cases over the presentation, the JSON payload, and the text inputs
affects: [04-05, json-output]

actuals:
  tokens: 10800
  tasks: 2
  commits: 2
plan_head_before: 954722432a6d5ec564f12e3e10a0f5d67f92024a
plan_head_after: ec517b2ac20efaa8e5f03cc7e1cf7834c299210b

tech-stack:
  added: []
  patterns:
    - "Redaction runs in the model (resolve and present), never in a producer, so both strategies read the same redacted string"
    - "A presentation copies a message only when a field it redacts is present; otherwise it carries the message by identity"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/redact-credentials.ts
    - tests/shared/redact-credentials.test.ts
  modified:
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/notification-resolve.ts
    - extensions/pi-claude-marketplace/shared/notification-present.ts
    - tests/shared/errors.test.ts
    - tests/shared/notification-resolve.test.ts
    - tests/shared/notification-present.test.ts
    - tests/architecture/no-credential-leak.test.ts

key-decisions:
  - "PMOD-04: plugin-info-cascade blocks get the same notes redaction as a single plugin-info, because each block is a PluginInfoMessage the text and JSON strategies render the same way"
  - "PMOD-04: the D-08 redaction ledger is empty: corpus 3134 present, 0 extra, and no catalog diff from 4e6c568a"

patterns-established:
  - "AUTH-09 JSON-path probe: plant one credential per site, read the presentation, JSON.stringify(toWirePayload(...)), and the text strategy's input, and require *** in payload and text"

requirements-completed: [PMOD-04]

coverage:
  - id: D1
    description: "redactCredentials replaces URL userinfo and x-access-token, Bearer, and GitHub token secrets, and leaves the scp subject, short bodies, plain URLs, and empty strings unchanged"
    requirement: PMOD-04
    verification:
      - kind: unit
        ref: "tests/shared/redact-credentials.test.ts (28 cases, including the adjacency, empty, encoding, and ordering edges)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every model site that can carry a thrown message is redacted before either strategy reads it"
    requirement: PMOD-04
    verification:
      - kind: unit
        ref: "tests/shared/errors.test.ts#PMOD-04 / D-07 redacts the credentials of every serialized link"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-resolve.test.ts#PMOD-04 / D-07 cases (leaks and four raw kinds)"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-present.test.ts#PMOD-04 / D-07 cases (url, advisories, notes)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AUTH-09 covers the JSON path: neither strategy shows a planted credential at any of 13 sites, and a control proves the assertion fires"
    requirement: PMOD-04
    verification:
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / PMOD-04 cases (13 sites plus the control)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No text byte changed: corpus 3134 present, 0 extra; catalog diff empty"
    requirement: PMOD-04
    verification:
      - kind: other
        ref: "node scripts/notify-corpus.mjs check (wrapper) and git diff --exit-code 4e6c568a -- docs/output-catalog.md"
        status: pass
    human_judgment: false

duration: 84min
completed: 2026-10-03
status: complete
---

# Phase 4 Plan 04: Credential Redaction at Every Serialization Site Summary

**One leaf, `redactCredentials`, now runs at every model site that can carry a thrown message. Those sites are the cause-chain serializer, manual-recovery leaks, four raw kinds, url-source marketplace urls, advisories, and plugin-info notes. So the text strategy and the JSON payload both read `***` where a credential was. The corpus and the catalog did not move.**

## Performance

- **Duration:** about 84 min
- **Started:** 2026-10-03T17:54:38Z
- **Completed:** 2026-10-03T19:18:22Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- `redactCredentials(text)` applies four patterns in order: userinfo becomes `scheme://***@`, then `x-access-token:***`, `Bearer ***` (either case), and `***` for a `ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_`/`github_pat_` token with a body of 16 or more characters. It has no imports.
- `serializeCauseChain` maps every link through `redactCredentials(linkMessage(link))`. This covers failed rows, remedy causes, rollback entries, the prune warning, and every `causeChainTrailer` caller.
- `resolveFailure` redacts each leak. `resolveRawSurface` is a `switch` with no default arm. It redacts the reconcile-aborted cause, the plugin-path-skipped reason, the usage-error message (the usage text stays), and the diagnostic header and lines. It returns usage-info, device-flow-prompt, async-rewake-summary, and stop-override-cap by identity.
- `presentNotification` redacts the url of a url-source marketplace-info, single and in each cascade block. It also redacts cascade and pending-empty advisories, and plugin-info notes, single and in each cascade block. A github or path source, and a row without notes, stays the same object.
- The AUTH-09 gate has 13 planted-credential cases and a control. Each case reads the presentation, the JSON payload, and the text the text strategy builds. With redaction switched off, exactly the 13 site cases fail.

## Task Commits

1. **Task 1: One redactor at every serialization site**: `fa77fd21` (feat). TASK_BASE `954722432a6d5ec564f12e3e10a0f5d67f92024a`.
2. **Task 2: AUTH-09 proves neither strategy can show a planted credential**: `ec517b2a` (test). TASK_BASE `fa77fd21c8ec32a5ff2d6007ca03568e65d7af97`.

## D-08 Result

**Empty ledger.** The corpus wrapper reported `Corpus: 3134 present, 0 extra` after Task 1 and again on Task 2's tree. `git diff --exit-code 4e6c568a -- docs/output-catalog.md` is empty, and `catalog-contract.test.ts` passes 4/4. No `04-CORPUS-CHANGES.json` was written, and no baseline was patched.

## Thrown-message Inventory

`git grep -n -e "errorMessage(" -e "\.message\b" -- extensions/pi-claude-marketplace/{orchestrators,edge,bridges}` lists 182 lines. Every thrown-message string that reaches a notification goes through a redacting site:

- **Error constructions and outcome `cause` strings.** Examples are `marketplace/add.ts`, `remove.ts`, `plugin/shared.ts`, `uninstall.ts`, `enable-disable.ts`, `import/execute.ts:448`, `update-row.ts:216-223`, and `dependency-index.ts:169`. The string is wrapped in `new Error(...)` before it rides a row's `cause` or `rollbackPartial[].cause`. That makes it a link that `serializeCauseChain` redacts.
- **Leak lists.** `clone-gc.ts:105`, `workflows-staging-gc.ts`, and `ManualRecoveryError` leaks reach `resolveFailure`, which redacts them.
- **Post-commit warnings, discovery warnings, and import diagnostics.** These come from `install-flow.ts:748/762`, `reinstall-replace.ts`, `bridges/*/stage.ts` rollback lines, `bridges/commands/discover.ts`, `import/settings.ts`, and `import/execute.ts:1352/1441`. They reach the `diagnostic` raw surface, whose header and lines `resolveRawSurface` redacts.
- **Plugin PATH.** The skip reason from `plugin-path.ts:103` reaches the `plugin-path-skipped` raw surface. `resolveRawSurface` redacts it.
- **Edge argument-parse errors.** These come from `edge/handlers/plugin/*.ts` and `edge/args-schema.ts`. They reach the `usage-error` message, which `resolveRawSurface` redacts.
- **Workflow file warnings.** `bridges/workflows/discover.ts` reaches plugin-info `notes`, which the presentation redacts.
- **Outcome `notes` on update and reinstall outcomes.** `update.messaging.ts` and `reinstall.messaging.ts` narrow them to closed-set reasons, so the text is never shown verbatim. `update-row.ts` joins them into a `new Error` cause, which is redacted as a link.
- **Not a notification.** The `hookDebugLog` calls write to the debug channel.
- **Outside the model.** `edge/handlers/tools.ts:463` returns `Failed to load plugin list: ${errorMessage(err)}` as LLM tool text. That text never goes through a presentation. It is recorded in `deferred-items.md` and not changed, because the plan redacts only at resolve and presentation, never in a producer.

The notification types allow no other free-text sink. `name`, `version`, and `description` hold manifest data, and no producer assigns a thrown message to them (grep found no such assignment).

## Verification

- Task 1: typecheck clean. The redact-credentials (28), errors, notification-resolve, notification-present, notification-json, notification-dispatch, notification-grammar, and redact-absolute-paths suites pass (683 tests). Direct coverage is 100% for redact-credentials (2/2 branches), errors (147/147), notification-resolve (105/105), and notification-present (35/35). `lint:type-members` exits 0 with no re-pin, `npm run fallow` exits 0, the corpus wrapper prints `Corpus: 3134 present, 0 extra`, and the catalog diff is empty.
- Task 1 RED: the new cases were run before the implementation. All 20 positive redact-credentials cases failed against an identity stub, and the 8 negatives passed. All 13 new site cases in the errors, resolve, and present suites failed with `AssertionError`.
- Task 2: `no-credential-leak.test.ts` and `gate-targets.test.ts` pass (47 tests; 14 new AUTH-09 / PMOD-04 cases). ESLint is clean, and `npx fallow dupes --fail-on-issues` exits 0. The corpus wrapper prints `Corpus: 3134 present, 0 extra`. All 10 pre-existing test titles survive, and the diff adds lines only. Neither `"extensions/pi-claude-marketplace/` nor an assembled production path appears in the file.
- Mutation check for Task 2: with `redactCredentials` changed to return its input, 13 cases failed and 19 passed. The file was then restored.
- `fallow audit` verdict: `warn` for both tasks (not `fail`).
- Task 1: focused task verification passed; full phase/PR verification pending.
- Task 2: focused task verification passed; full phase/PR verification pending.

### Full-check evidence

Task 2's pre-commit run (`SKIP=trufflehog pre-commit run --files tests/architecture/no-credential-leak.test.ts`, log `precommit-t2b.log`, `PRECOMMIT_EXIT=0`, Node v26.10.0) used the full scope. `check:changed --list` reported `scope: full`, which runs `npm run check` and `test:coverage:direct:all`, because an architecture gate file is a shared input. The run covered the exact tree committed as `ec517b2a`, and no other change was present. Under the local-verification reuse rule it counts as that tree's `npm run check`, so the plan verification step reuses it. An earlier attempt at the same run was stopped by the 30-minute background time limit before it finished. It was rerun with a longer limit, and only the completed run is counted.

## Decisions Made

- The planner's choices were applied as written: a 16-character minimum body, kept `Bearer ` and `x-access-token:` prefixes, the scp subject left alone, `Bearer` matched in either case, and the usage-error message redacted while its usage text is not.
- Plugin-info-cascade notes are redacted like single plugin-info notes (see deviation 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Plugin-info-cascade notes are redacted too**
- **Found during:** Task 1
- **Issue:** The plan named plugin-info notes and the marketplace-info cascade, but not the plugin-info cascade. Each cascade block is a `PluginInfoMessage`, and both strategies render its notes, so a note there would leak.
- **Fix:** The plugin-info-cascade arm maps its blocks through the same `redactPluginInfo` the single arm uses. A notes-free block stays the same object. An owner test covers it. The AUTH-09 gate plants a note only in a single plugin-info, which goes through the same function.
- **Commit:** fa77fd21

**2. [Rule 3 - Blocking] Regex character classes rewritten for `sonarjs` lint**
- **Found during:** Task 1 (ESLint: `duplicates-in-character-class` and `concise-regex`)
- **Fix:** The Bearer body is `[\w.~+/=-]+` (the planned `[A-Za-z0-9._~+/=-]` repeats letters under the `i` flag). The `github_pat_` body is `\w{16,}`. Both match the same strings as the planned patterns.
- **Commit:** fa77fd21

**3. [Rule 3 - Blocking] AUTH-09 row text uses `composeReconcileAppliedBody`**
- **Found during:** Task 2
- **Issue:** The plan named `composeMarketplaceBlock`, which 04-02 made private to the grammar module.
- **Fix:** Rows, leaks, rollback entries, and remedy causes are read through `composeReconcileAppliedBody(presentation.marketplaces)`. This is the exported composer that renders the same block, the precedent 04-02 set for its tests. Advisories are joined after it.
- **Commit:** ec517b2a

**4. The encoding-edge test uses `--` instead of an em dash**
- **Found during:** Task 1 (pre-commit `fix-unicode-dashes` rewrote the test file)
- **Fix:** The hook's change was kept. The case still carries non-ASCII text around the credential (`échec`, `hôte`, `✗`).
- **Commit:** fa77fd21

**5. Two existing owner cases were adjusted, as the plan allowed**
- `resolveRawSurface`: "returns a plugin-path-skipped surface as the same object" became "keeps a plugin-path-skipped surface without a credential equal", because the kind is now rebuilt field by field.
- `presentNotification`: "carries both info fan-outs by identity with info envelopes" became "carries both info fan-outs with info envelopes", because a cascade now carries a copy whose blocks are redacted. Its assertion is unchanged. Two new cases pin identity where it still holds: a path-source marketplace-info, and a pending-empty message without advisories.

**Total deviations:** 5 (1 missing critical, 2 blocking, 2 test adjustments). **Impact:** each one keeps the plan's intent. The only scope addition is the cascade notes, which closes a leak path the plan's own rule (D-07) covers.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Issues Encountered

- The first Task 2 pre-commit attempt hit the 30-minute background time limit during `npm changed checks`. The machine was also running a pre-commit in another checkout. The rerun with a longer limit passed.
- `contracts.json` needed no change: `lint:type-members` passed with no pin moved.

## Requirements

PMOD-04 is declared by no later plan of this phase, and it now holds in both strategies, so it is marked complete.

## Next Phase Readiness

04-05 walks every catalog fixture and raw kind through the JSON strategy (WIRE-08, WIRE-01). The payloads it walks are already redacted, and redaction changed no fixture bytes.

## Self-Check: PASSED
