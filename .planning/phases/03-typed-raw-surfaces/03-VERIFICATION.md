---
phase: 03-typed-raw-surfaces
verified: 2026-10-03T08:00:00Z
status: passed
score: 11/11 must-haves verified
covered_files:
  - ".planning/phases/03-typed-raw-surfaces/03-01-PLAN.md"
  - ".planning/phases/03-typed-raw-surfaces/03-01-SUMMARY.md"
  - ".planning/phases/03-typed-raw-surfaces/03-02-PLAN.md"
  - ".planning/phases/03-typed-raw-surfaces/03-02-SUMMARY.md"
  - ".planning/phases/03-typed-raw-surfaces/03-03-PLAN.md"
  - ".planning/phases/03-typed-raw-surfaces/03-03-SUMMARY.md"
  - ".planning/phases/03-typed-raw-surfaces/03-04-PLAN.md"
  - ".planning/phases/03-typed-raw-surfaces/03-04-SUMMARY.md"
  - "extensions/pi-claude-marketplace/bridges/hooks/runtime.ts"
  - "extensions/pi-claude-marketplace/bridges/hooks/settle.ts"
  - "extensions/pi-claude-marketplace/domain/github-auth.ts"
  - "extensions/pi-claude-marketplace/index.ts"
  - "extensions/pi-claude-marketplace/orchestrators/auth-host.ts"
  - "extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
  - "extensions/pi-claude-marketplace/shared/notification-grammar.ts"
  - "extensions/pi-claude-marketplace/shared/notification-resolve.ts"
  - "extensions/pi-claude-marketplace/shared/notification-types.ts"
  - "tests/architecture/no-credential-leak.test.ts"
  - "tests/architecture/presentation-sink.test.ts"
covered_digest: "v2:sha256:d93e9942f776dfb39349777cf490c363cec654e1312b2755a1cde3e018a5db43"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 3: Typed Raw Surfaces Verification Report

**Phase Goal:** Every raw-string output surface is a typed model kind that the text strategy formats. Text output becomes a pure formatter of the model, with its bytes unchanged, before any JSON exists.
**Verified:** 2026-10-03
**Status:** passed
**Re-verification:** No, initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC-1 | Usage errors and help are `usage-error` / `usage-info` kinds, diagnostics are `diagnostic {header, lines[]}`, all through one presentation path, with text and argument count unchanged | VERIFIED | `RawSurface` union in `shared/notification-types.ts` holds `UsageErrorSurface`, `UsageInfoSurface`, `DiagnosticSurface`. `notifyUsageError`, `notifyUsageInfo`, and `notifyDiagnostic` in `notification-dispatch.ts` each build a kind and call `emitRawSurface`, which runs `resolveRawSurface`, then `formatRawSurface`, then `deliver`. `formatRawSurface` owns the SNM-13 `\n\n` join and the empty-lines no-op. The 45 `notifyUsageError` call sites are unchanged, and `help.ts` calls `notifyUsageInfo`. Corpus check: 3134 present, 0 extra (argc is part of the key). |
| SC-2 | The domain passes `{verificationUri, userCode}` to a structured callback, the text strategy composes the prompt, and AUTH-09 is retargeted at the new callback | VERIFIED | `domain/github-auth.ts` calls `opts.onDeviceCode({verificationUri, userCode})`. `auth-host.ts` binds it to `notifyDeviceFlowPrompt`. `formatRawSurface` composes `Open <uri> and enter: <code>` at explicit `info`. `makeRawNotifyFn` and `NotifyFn` have zero hits in `extensions/` and `tests/`. `no-credential-leak.test.ts` was retargeted (positive count plus an exact-form allow-list). Mutation check: adding a `token:` field to the `onDeviceCode` call made that gate fail (3 failures), and the tree was then restored. |
| SC-3 | The two load-time warnings in `index.ts` are `reconcile-aborted` and `plugin-path-skipped` kinds | VERIFIED | `index.ts` calls `notifyReconcileAborted(ctx, err)` and `notifyPluginPathSkipped(ctx, skip.scope, skip.reason)`, both inside the original NFR-2 try/catch wrappers. `resolveRawSurface` serializes the live cause once through `errorMessage` (D-13). |
| SC-4 | Hook rewake summaries and the Stop-hook cap are hook kinds distinct from command kinds, rewake text is data, and the byte pins hold | VERIFIED | `HookSurface = AsyncRewakeSummarySurface \| StopOverrideCapSurface`, separate from `LoadSurface`, each with its own `emit*Surface` entry. The rewake summary passes through verbatim, and an empty summary is a no-op. `settle.ts` passes `STOP_OVERRIDE_CAP`, exported from `runtime.ts`, which removes the duplicated literal 8 from the dispatch module (D-07). `hooks-cap-notify.test.ts` passes, and the 160-test spot run over async-rewake, `tests/index.test.ts`, auth-host, and github-auth passes. |
| SC-5 | No output surface hands the text sink a pre-composed string. The catalog diff and the full corpus diff against the Phase 1 baseline are empty | VERIFIED | The only `ctx.ui.notify` call sites in `extensions/` are the two inside `deliver` (`notification-dispatch.ts:87,89`). Every `deliver` call passes `formatEnvelopeArguments(...)` or `formatRawSurface(...)`. The other `ui.*` calls are `addAutocompleteProvider`, not output. `git diff --exit-code 4e6c568a -- docs/output-catalog.md` exits 0. `node scripts/notify-corpus.mjs check` exits 0 with "3134 baseline entries present, 0 extra". |
| TEXT-01 | Text output is a pure formatter of the model with unchanged bytes | VERIFIED | Same evidence as SC-5. `formatRawSurface` and `formatEnvelopeArguments` are the sole owners of both the text and the argument count (D-15). The catalog contract test (state count and UTF-8 bytes) passes. |
| D-01..D-04 | Raw kinds are separate unions, not merged into `NotificationMessage`. One internal path. Thin public helpers. No `run` or `pi` threaded into raw call sites | VERIFIED | `RawSurface` is a standalone union. The helper names are kept. No raw helper takes a `run`. |
| D-05..D-08 | Diagnostic, usage, cap `{pluginId, cap}`, and rewake `{summary}` shapes | VERIFIED | Shapes match in `notification-types.ts`. |
| D-09..D-12 | `onDeviceCode` callback, kind carries only `verificationUri` and `userCode`, kind name `device-flow-prompt`, AUTH-09 gate retargeted with a planted-violation control | VERIFIED | `notifyDeviceFlowPrompt` copies the two fields by name. The planted controls in `no-credential-leak.test.ts` pass, and the real-file mutation above makes the gate fail. |
| D-13..D-16 | Cause serialized in resolve. Hook and load groups separate. Arity is a text-strategy rule keyed on kind. A source-scan sink gate with a planted control | VERIFIED | `resolveRawSurface` and `formatRawSurface` match. `presentation-sink.test.ts` has 13 passing tests. Mutation check: replacing the `notifyUsageInfo` body with a direct `ctx.ui.notify(\`Usage: ...\`)` made the sink gate fail with 6 failures, and the tree was then restored. The post-review fixes (95237f7c, 16f507cd, 13729cd8) closed three gate bypasses: indirect `onDeviceCode` forms, dispatch-composed sentences (prune-empty and similar, now rendered in the grammar), and `.call`, destructured, and aliased sink calls. |
| D-17 | The corpus exception is exactly 2 removals and 3 additions, ledgered | VERIFIED | The ledger command from 03-03-PLAN printed `Approved corpus changes: 2 removals, 3 additions; unchanged occurrences: 3131; total: 3134`. `03-CORPUS-CHANGES.json` holds the two removals (baseline lines 2967 and 2968, owned by the deleted raw-callback test) and the three additions (`reconcile aborted: boom`, the PATH-skipped warning, and the device-flow prompt). All five are owned by `tests/shared/notification-dispatch.test.ts`. |

**Score:** 11/11 truths verified (5 roadmap success criteria, TEXT-01, and the D-group rows above). 0 behavior-unverified.

### Required Artifacts and Key Links

| Artifact or link | Status | Details |
| ---------------- | ------ | ------- |
| `shared/notification-types.ts` raw kinds | VERIFIED | Substantive. Consumed by dispatch, resolve, grammar, and the domain (`DeviceFlowPrompt`). |
| `shared/notification-grammar.ts` `formatRawSurface` and `formatEnvelopeArguments` | VERIFIED | Wired from `deliver` callers. The D-15 arity table is tested. |
| `shared/notification-resolve.ts` `resolveRawSurface` | VERIFIED | Called by `emitRawSurface`. |
| `shared/notification-dispatch.ts` `deliver` and helpers | VERIFIED | Sole `ctx.ui.notify` site. |
| `index.ts` -> load helpers, `auth-host.ts` -> device-flow helper, `settle.ts` -> cap helper with `STOP_OVERRIDE_CAP`, `registry.ts` -> rewake helper | WIRED | Confirmed in the diff and by grep. |
| `03-CORPUS-CHANGES.json` | VERIFIED | Matches the baseline splice (3134 entries). |
| `tests/architecture/presentation-sink.test.ts` and `no-credential-leak.test.ts` | VERIFIED | Both fire on real-file mutations. |

### Data-Flow Trace

The device-code values flow from `deviceCode.verification_uri` and `deviceCode.user_code` through `onDeviceCode`, `notifyDeviceFlowPrompt`, `formatRawSurface`, and `deliver` to `ctx.ui.notify`. The Stop cap flows from `STOP_OVERRIDE_CAP` through `settle.ts` into the text. All flows are real, with no static fallbacks.

### Behavioral Spot-Checks and Probes

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Catalog bytes unchanged | `git diff --exit-code 4e6c568a -- docs/output-catalog.md` | exit 0 | PASS |
| Wire corpus re-diff | `node scripts/notify-corpus.mjs check` | 3134 present, 0 extra, exit 0 | PASS |
| D-17 ledger | ledger command from 03-03-PLAN | `2 removals, 3 additions; ... total: 3134` | PASS |
| Named gate and owner tests | `node --test` over the six files named in the request | 389 pass, 0 fail | PASS |
| Hooks, index, auth-host, and github-auth suites | `node --test tests/bridges/hooks/async-rewake/ tests/index.test.ts tests/orchestrators/auth-host.test.ts tests/domain/github-auth.test.ts` | 160 pass, 0 fail | PASS |
| Typecheck | `npm run typecheck` | clean | PASS |
| Unused-type-member gate | `node scripts/check-unused-type-members.mjs` | passed (3 recorded exceptions, all pre-existing) | PASS |
| Production dead-code | `npx fallow dead-code --fail-on-issues` | no issues | PASS |
| Mutation: pre-composed sink call | temporary edit to `notifyUsageInfo` | sink gate failed, tree restored | PASS |
| Mutation: extra field on the device-code call | temporary edit to `github-auth.ts` | AUTH-09 gate failed, tree restored | PASS |

The full `npm run check` plus all-pair direct coverage was not re-run. The caller supplied pre-commit evidence for commit 13729cd8, the current code tree. Only `.planning/` commits come after it.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| RAWS-01 | 03-01 | SATISFIED | `usage-error` and `usage-info` kinds; `help.ts` and 45 usage-error sites go through the helpers. |
| RAWS-02 | 03-02 | SATISFIED | `diagnostic {header, lines[]}` kind. |
| RAWS-03 | 03-03, 03-04 | SATISFIED | `device-flow-prompt` kind and `onDeviceCode` callback. |
| RAWS-04 | 03-01 | SATISFIED | `reconcile-aborted` and `plugin-path-skipped` kinds. |
| RAWS-05 | 03-02 | SATISFIED | `HookSurface` kinds. `origin: hook` is derivable from the type; Phase 6 emits it. |
| TEXT-01 | 03-01..03-04 | SATISFIED | Catalog diff empty, corpus empty up to the approved D-17 ledger. |

All six IDs appear in plan frontmatter and are marked Complete in REQUIREMENTS.md. There are no orphaned requirements.

### Anti-Patterns

The scan of the 26 changed files found no TBD, FIXME, or XXX markers.

### Advisory Notes (not blocking)

- The review disposition leaves four Info items open (IN-01 to IN-04). They are outside the critical_warning fix scope, and none affects a must-have. IN-01 and IN-04 are gate-precision hardening. IN-02 notes that the Stop cap is passed separately from the comparison that trips it. Today both read the same `STOP_OVERRIDE_CAP`. IN-03 notes that the AUTH-09 gate trusts the `deviceCode` name.
- `docs/output-catalog.md` lines near 4088-4090 still say the domain emits the device-flow prompt. This is deliberate. The catalog diff must stay empty, and ROADMAP Phase 7 criterion 6 carries the prose fix, so it is a carried item, not a gap.

### Human Verification Required

None.

### Gaps Summary

No gaps. The phase goal holds in the code. Every raw-string surface now reaches `ctx.ui.notify` only through the single `deliver` sink, fed by `formatRawSurface` or `formatEnvelopeArguments`. The text and argument counts are unchanged. The corpus differs from the Phase 1 baseline only by the five user-approved D-17 entries.

---

_Verified: 2026-10-03_
_Verifier: Claude (gsd-verifier)_
