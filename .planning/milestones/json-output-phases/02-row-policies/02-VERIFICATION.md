---
phase: 02-row-policies
verified: 2026-10-02T14:05:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/02-row-policies/02-01-PLAN.md
  - .planning/phases/02-row-policies/02-01-SUMMARY.md
  - .planning/phases/02-row-policies/02-02-PLAN.md
  - .planning/phases/02-row-policies/02-02-SUMMARY.md
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
covered_digest: "v2:sha256:1026769472350a7347487eb435a67820c4b5e359b16e626946622fcdf7b56e11"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 2: Row Policies Verification Report

**Phase Goal:** Per-verb rendering differences are model data: a total row-policy map per command replaces the string-returning render callbacks in the orchestrators' `*.messaging.ts` files. Every known divergence renders byte for byte as before.
**Verified:** 2026-10-02T14:05:00Z, at HEAD `571b6883` on `features/json` (clean tree apart from the untracked `.planning/milestone.lock`)
**Status:** passed
**Re-verification:** No. This is the first verification.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Every `CommandContext` carries a total row-policy map keyed by status. The map holds data and keeps its `satisfies` anchor. The render callbacks, the central `renderPluginRow` switch and the `dispatchRow` fallback are deleted. | ✓ VERIFIED | `shared/notify-context.ts:19-22`: `CommandContext<Status>` = `{ Messaging, rowPolicies: Readonly<Record<Status, RowPolicy>> }`. `RowPolicy` (`notification-resolve.ts:292`) is `{ markers: boolean; contentReasons: boolean }`, with no function member. 19 context declarations in 15 messaging files all end `as const satisfies CommandContext<...>`. The 19th, `CASCADE_CONTEXT`, arrived with main's #198 and uses the same shape. No other `CommandContext` declaration exists: the only non-`satisfies` use is a parameter type in `plugin/shared.ts:1473`. `CENTRAL_ROW_POLICY` `satisfies Record<PluginNotificationMessage["status"], RowPolicy>`. The deleted definitions were `notification-grammar.ts:860 renderPluginRow`, `notify-context.ts:354 dispatchRow` and `notify-context.ts:73 render: {...RenderFn}` at the phase base `1c363b91`. At HEAD, `rg "renderPluginRow\|dispatchRow\|RenderFn"` finds only the unrelated local helper in `edge/handlers/tools.ts:194`, which was already there at the base. Text comes from one private `PLUGIN_ROW_LAYOUT` table (`notification-grammar.ts:388`, `satisfies` over all 19 statuses). The D-04 missing-policy fallback survives as data: `resolveRows` sets `missingPolicy: true`, and `formatPluginRow` renders the frozen `no render arm for` bytes. |
| 2 | Each known divergence has an owner test asserting both the policy value and the rendered text. | ✓ VERIFIED | **list `partially-installed` without markers:** `list.messaging.test.ts:14` resolves through `LIST_CONTEXT.rowPolicies` with `dependencies: [agents, mcp, workflows]` and asserts the resolved row (no markers) and the line `◉ alpha v1.0.0 (partially-installed) {lsp}`. The policy value is in `:378`. **list `available`/`remote` with content reasons:** the policy value is in `:378` (`contentReasons: true`, against `false` in `CENTRAL_ROW_POLICY`). The text is in `:91` and `:298`. The real list flow renders `{installs disabled}` end to end in `list-flow.test.ts:644,685,758,833`. **reconcile-applied `uninstalled` without reasons:** `reconcile.messaging.test.ts:17` resolves `reasons: ["lsp"]` through `RECONCILE_APPLIED_CONTEXT` to `reasons: []` and the line `○ alpha v1.0.0 (uninstalled)`. The policy is in `:393`. **two `disabled` forms:** the bare toggle is in `enable-disable.messaging.test.ts:42` (`◍ alpha [project] v1.2.3 (disabled)`), with `DISABLE_CONTEXT` policy at `:567`. The disabled install is in `install.messaging.test.ts:148` (`◍ helper v4.0.0 (disabled) {installs disabled, malformed skill}`), with `INSTALL_CONTEXT` policy at `:1003`. **pending rows ignore the probe:** `notification-resolve.test.ts:1365` resolves through `PENDING_CONTEXT` under `allLoaded()` and `noneLoaded()` and asserts identical rows and identical complete text. The policy is in `reconcile.messaging.test.ts:379`. `soft-dep-marker-policy.test.ts` also restates every context's marker table and scans for unregistered contexts. All of these passed in the focused run below. |
| 3 | All 69 direct render-arm test calls in 12 files are migrated to policy plus formatter assertions, with no surviving adapter. | ✓ VERIFIED | At `1c363b91`, `git grep -c "CONTEXT\.render\b\|\.render\[\|\.render\."` finds 84 reference lines in exactly 12 messaging test files (7+4+5+5+10+7+4+7+11+3+7+14). That matches the SUMMARY's 69 calls plus 15 key enumerations. At HEAD the same patterns find 0 matches in `tests/` and `extensions/`, and `\brender\b` finds 0 matches in any `*.messaging.test.ts`. No adapter, legacy-render or compat symbol exists in `notify-context.ts`, `notification-resolve.ts` or `notification-grammar.ts`. |
| 4 | The `pending` retained-workflow advisory travels as `{name, envelopeCount?}`, and the text strategy composes the sentence and indent. The output is byte-identical. | ✓ VERIFIED | `notification-types.ts:796` declares `RetainedWorkflowStaging { readonly name: string; readonly envelopeCount?: number }`. Both carriers declare it: `CascadeNotificationMessage.retainedWorkflows` (`:818`) and the pending-empty message (`:949`). `pending.ts:152-156` scans once and returns `{}` or `{ retainedWorkflows }`. `:245` makes that one call outside the scope loop and passes the result to both arms (`:261` `notify(... "reconcile-pending-empty", ...retained)` and `:306` `notifyWithContext(..., retained)`). `pending.ts` no longer imports `composeRetainedWorkflowsAdvisories`; at the base it did (`:42`, `:154`). Text is composed only in `notification-dispatch.ts:foldAdvisories` (`:355-365`) through `notification-summary.ts:419`, which adds the four-space indent and the count noun. The catalog fixtures (`catalog-uat/fixtures/plugin-pending.ts`) now pass facts; their expected text comes from the unchanged catalog, and `catalog-contract.test.ts` passes. The single-scan invariant is exercised by the `readdir` spy in `pending.test.ts:683-700`. Edge cases (0/1/3/absent counts, Unicode, order) are in `notification-summary.test.ts:623-670`. |
| 5 | The catalog diff is empty, and the wire corpus changes only the 29 approved occurrences, with an exact ledger. | ✓ VERIFIED (see the notes) | **Catalog:** `git diff e40d3dda -- docs/output-catalog.md` is not empty at HEAD. All of that diff comes from main's #198. The branch tip just before the merge (`455123e9^1` = `08d60070`, after both phase-2 plans) is byte-identical to `e40d3dda`. HEAD is byte-identical to main's `8b6ac3bc`, and `8b6ac3bc^` is byte-identical to `e40d3dda`. Phase 2 therefore changed no catalog byte. **Corpus:** the ledger check, re-run with `e514ea67` as the post-merge reference (scratchpad `ledger-check-verify.mjs`), printed `Approved substitutions: 29; unchanged occurrences: 2632; total: 2661`, then `Post-merge baseline: 3133 entries; one replacement at line 2284` and `All 29 after-records present; no before-record remains; meta.json unchanged` (exit 0). An extra audit (scratchpad `rebaseline-audit.mjs`) compared the original blob plus the ledger with the HEAD baseline. The only pre-merge occurrences missing from the re-baseline are 25 entries in six files. All of them reflect main's changes: usage text gained `prune` and the new uninstall flag, and info gained dependency lines. None reflects a row-policy change. The single failing area of `notify-corpus.mjs check` is covered under Warnings below. |

**Score:** 5/5 truths verified (0 present but behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `shared/notify-context.ts` | `CommandContext.rowPolicies` and context emitters | ✓ VERIFIED | All four wrappers pass `context.rowPolicies` into `emit*Cascade` |
| `shared/notification-resolve.ts` | `RowPolicy`, `RowPolicyMap`, `CENTRAL_ROW_POLICY`, `missingPolicy` | ✓ VERIFIED | Own-property lookup via `Object.hasOwn`. A missing policy floors writable rows to `error`, and frozen rows are tolerated. |
| `shared/notification-grammar.ts` | Callback-free `PLUGIN_ROW_LAYOUT` and `composePluginLines` | ✓ VERIFIED | Total `satisfies` table. `composePluginLines` refuses unresolved rows (WR-01/WR-02). |
| `shared/notification-types.ts` | `RetainedWorkflowStaging` on both pending carriers | ✓ VERIFIED | Readonly, with `envelopeCount` optional |
| `shared/notification-summary.ts` | Sentence composition | ✓ VERIFIED | `composeRetainedWorkflowsAdvisories` |
| `orchestrators/reconcile/pending.ts` | One scan forwarded as facts | ✓ VERIFIED | Lines 152-156 and 245-314 |
| `02-CORPUS-CHANGES.json` | 29 before/after records | ✓ VERIFIED | The ledger script validates each record against blob `25f4e3c0` |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| `notify-context.ts` | `notification-resolve.ts` | `context.rowPolicies` → `emitContextCascade` → `resolveRows` | ✓ WIRED |
| `notification-resolve.ts` | `notification-grammar.ts` | `ResolvedRow` (`missingPolicy`, `reasons`) → `formatPluginRow` | ✓ WIRED |
| `pending.ts` | `notification-types.ts` | `retainedWorkflows` facts on both message arms | ✓ WIRED |
| `notify-context.ts` | `notification-dispatch.ts` | the optional `retainedWorkflows` argument goes into the cascade carrier (`:58-85`) | ✓ WIRED |
| `notification-dispatch.ts` | `notification-summary.ts` | `foldAdvisories` → `composeRetainedWorkflowsAdvisories` | ✓ WIRED |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Divergence, pending, policy-table and catalog owners | `node --test` on list/reconcile/enable-disable/install messaging, notification-resolve/grammar/summary, notify-context, pending, soft-dep-marker-policy, catalog-contract, list-flow | 507 tests in 13 suites, 0 failures, 0 skips, exit 0 (scratchpad `verify-owners.log`) | ✓ PASS |
| Immutable ledger plus post-merge baseline | `node ledger-check-verify.mjs` (reference `e514ea67`) | 29 / 2,632 / 2,661; one replacement at line 2284 | ✓ PASS |
| Prune entries after suffix normalization | Normalize `prune-backup-[A-Za-z0-9]{6}` in the 37 captured prune entries (scratchpad `prune.jsonl`) and in the baseline | Raw comparison differs, normalized comparison is equal | ✓ PASS |
| Full gate | `npm run check` at `571b6883`, reused from the caller | `CHECK_EXIT=0` (scratchpad `fullcheck.log`) | ✓ PASS (reused) |

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
| --- | --- | --- | --- |
| PMOD-02 | 02-01, 02-02 | ✓ SATISFIED | Truths 1, 2, 3 and 5 |
| PMOD-05 | 02-02 | ✓ SATISFIED | Truth 4 |

No orphaned requirements. REQUIREMENTS.md maps only PMOD-02 and PMOD-05 to Phase 2.

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
| --- | --- | --- | --- |
| The 65 extension, test and script files changed by phase-2 first-parent commits | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK` | none found | n/a |
| Repository | `fallow-ignore` count | unchanged (16 at the base, 16 at HEAD) | No new suppression |
| Render path (dispatch, grammar, summary, notify-context) | `softDepStatus(` calls | none | No probe in rendering (D-06) |

### Warnings (non-blocking, not phase-2 gaps)

1. **The corpus tool cannot exit clean after the main merge. This is a defect in the corpus tool, not a phase-2 gap.** `node scripts/notify-corpus.mjs check` exits 1 on 8 missing/extra pairs, all in `tests/orchestrators/plugin/prune.test.ts`. `prune-rollback.ts:297` creates `mkdtemp(".../prune-backup-")`, and the resulting random suffix appears in the failure cause text. `normalizeMessage` (`scripts/notify-corpus.mjs:73-81`) normalizes tmp roots, UUIDs and atomic suffixes, but not this suffix. The `e514ea67` re-baseline therefore captured 8 random names verbatim (`2Fnk86`, `AiBJBV`, `iv3VF2`×2, `TeVO0N`, `uTLtQM`, `Vg6xZO`, `vN8eWF`, `Zr925m`; the `ABC123` entries are a fixed fake). After normalization, all 37 prune entries match. The nondeterminism came with main's prune tests (#198). Phase 2 changed no prune producer or prune test. Until someone adds a normalization rule for `prune-backup-XXXXXX` and re-baselines those 8 entries, the milestone invariant "the corpus re-diffs empty" cannot be checked by exit code in Phases 3-7. This should be fixed separately, before the Phase 3 corpus gate.
2. **The catalog reference moved.** `e40d3dda` is no longer the right reference for the catalog diff. After the main merge, the unchanged-catalog reference is main's `8b6ac3bc`, and HEAD matches it byte for byte. Later phases should compare against `8b6ac3bc`, or against the latest merged main, not `e40d3dda`.
3. **Context count is now 19.** The SUMMARY counts 18 contexts. HEAD has 19 because main's `CASCADE_CONTEXT` (`install-cascade.messaging.ts:93-99`) arrived later. It follows the same data-only, `satisfies`-anchored shape, and `soft-dep-marker-policy.test.ts` registers it.

### Human Verification Required

None.

### Gaps Summary

None. All five ROADMAP success criteria hold in the code at HEAD. The only open item is the corpus-tool normalization defect above. It came from main's #198 tests, phase-2 code did not cause it, and it does not change any phase-2 output.

---

_Verified: 2026-10-02T14:05:00Z_
_Verifier: Claude (gsd-verifier)_
