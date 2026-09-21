---
phase: 04-strict-command-arguments
reviewed: 2026-09-14T15:14:41Z
depth: standard
diff_base: 08fe8e65
files_reviewed: 31
files_reviewed_list:
  - README.md
  - docs/prd/pi-claude-marketplace-prd.md
  - extensions/pi-claude-marketplace/edge/args-schema.ts
  - extensions/pi-claude-marketplace/edge/args.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/shared.ts
  - tests/architecture/flag-catalog-drift.test.ts
  - tests/edge/args-schema.test.ts
  - tests/edge/args.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/flag-catalog.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/shared.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/shared.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/edge/register.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
original_findings: {critical: 1, warning: 0, info: 0, total: 1}
status: clean
---

# Phase 4: Code Review Report

**Reviewed:** 2026-09-14T15:14:41Z
**Depth:** standard, including registered-handler and completion call-chain checks
**Files Reviewed:** 31
**Status:** clean; original finding retained below with its resolved disposition

## Summary

Reviewed shared lexical and schema parsing, all changed handlers, marketplace merged-read behavior, flag catalog/completions, router inventory guards, public rejection tests, and documentation. Strict validation still loses explicit empty arguments, which can broaden a requested operation into a bulk mutation. No additional concrete defect was established in the marketplace local-flag or catalog changes.

## Narrative Findings (AI reviewer)

### CR-01: BLOCKER — Empty quoted operands bypass arity checks and can trigger bulk operations

**File:** `/home/acolomba/src/pi-claude-marketplace-test-backlog/extensions/pi-claude-marketplace/edge/args.ts:78-95`
**Related files:** `/home/acolomba/src/pi-claude-marketplace-test-backlog/extensions/pi-claude-marketplace/edge/handlers/shared.ts:85-91`, `/home/acolomba/src/pi-claude-marketplace-test-backlog/extensions/pi-claude-marketplace/edge/args-schema.ts:79-104`, `/home/acolomba/src/pi-claude-marketplace-test-backlog/extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts:49-73`
**Classification:** BLOCKER
**Issue:** Token emission depends on decoded text having positive length. Explicit empty quoted operands (`""` and `''`) therefore vanish. The shared flag scanner reconstructs its residual input from those incomplete tokens, so downstream arity and scope validation cannot recover the missing arguments. Optional schemas also treat a supplied whitespace-only operand as absent. This violates complete argument validation and can select a bulk operation instead of rejecting an invalid target.

**Reproduction:** An independent unsandboxed public-API probe produced all of the following:

- `parseCommandArgs('official ""', oneNameSchema, onError)` returned `{ name: "official" }` without a surplus-argument diagnostic.
- `parseArgs('--scope "" project')` returned `{ positional: [], scope: "project" }`, taking the next operand as the missing scope value.
- `extractLocalFlag('"" --local', ...)` returned `{ local: true, residualArgs: "" }`.
- Calling the public reinstall handler with `'""'` invoked its reinstall collaborator with `target: { kind: "all" }` and emitted no error.

**Fix:** Track whether a token has started separately from its decoded string length. Opening a quote must start a token; preserve an empty token and its original span on whitespace/end-of-input. Keep the scope-value token intact and let scope validation reject the empty value. Distinguish an omitted optional operand from an explicitly supplied blank operand and reject the latter before selecting bulk behavior. Add parser, scanner, and registered-handler controls for empty single/double quotes, empty scope values, surplus empty arguments, and benign truly omitted optional operands.

**Disposition:** Repaired and independently re-probed on 2026-09-14. Token emission now checks source-span width, retaining explicit empty quoted arguments without adding a separate grammar. The schema rejects supplied empty/whitespace-only optional operands. Independent assertions passed for both quote forms, surplus empty arguments, invalid empty scope values, scanner preservation, and rejection of `reinstall ""` before its collaborator runs; genuinely omitted optional operands remain accepted. The parent reports 215 focused cases passing in `/tmp/test-backlog-empty-quotes.log`, with further public empty-scope and marketplace optional-blank controls added. The original BLOCKER remains recorded for audit history; no unresolved narrative finding remains after this focused re-review. Full post-repair gates passed; see the final verification record below.

## Validation Evidence and Limits

Independent review used CodeGraph before source exploration and applied the TypeScript style and unit-testing review skills. The reviewed rejection matrix covers 19 canonical verbs and three aliases. Its complete notification and strict-boundary assertions remain useful but originally used a nonempty surplus token; they did not expose CR-01. Marketplace tests exercise shared-only, local-only, and overlapping declarations with complete output expectations and unchanged configuration bytes, including the real plugin cascade. Catalog pins and completion reconciliation were examined separately from handler acceptance tests.

The parent reported the pre-repair integrated suite passing 6160/6160 tests with 227 production records at 63369/63369 lines, 1851/1851 functions, and 9144/9144 branches (`/tmp/test-backlog-phase34-unit-green.log`, `coverage/unit.lcov`). Typecheck passed (`/tmp/test-backlog-phase34-typecheck.log`). The full lint pass initially reported 16 auto-fixable style errors; the parent applied the targeted fixes successfully. These results predate review repairs and do not resolve CR-01. The full post-repair quality gate and phase verification remain pending.

The review excluded unrelated local settings, CONTRIBUTING.md, and root planning changes. No structural pre-pass or external-review evidence was supplied. No commits or source edits were made by this reviewer.

## Final verification

The original blocker was repaired and independently reproduced successfully. Current unresolved findings: zero. Commit `a8ef0dac`; goal verification 7/7.

Final verification passed on 2026-09-14: 6,267/6,267 unit tests, 32/32 integration tests, and clean pre-commit checks including lint, typecheck, formatting, Fallow and changed direct pairs. All 227 production LCOV records retain exact coverage: 63,374/63,374 lines, 1,851/1,851 functions and 9,145/9,145 branches. Workflow, correspondence and direct-coverage negative controls also pass. The two unrelated direct shortfall pins remain unchanged.

Evidence: `/tmp/test-backlog-phase34-unit-final.log`, `/tmp/test-backlog-phase34-integration.log`, `/tmp/test-backlog-phase34-precommit-final.log`, and the phase VERIFICATION.md report. Earlier checkpoints above remain historical measurements.
