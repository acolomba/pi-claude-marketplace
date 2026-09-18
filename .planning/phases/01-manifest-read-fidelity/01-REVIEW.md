---
phase: 01-manifest-read-fidelity
reviewed: 2026-09-14T15:53:20Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/commands/discover.ts
  - extensions/pi-claude-marketplace/bridges/skills/discover.ts
  - extensions/pi-claude-marketplace/domain/component-paths.ts
  - extensions/pi-claude-marketplace/domain/components/plugin.ts
  - extensions/pi-claude-marketplace/domain/dependencies.ts
  - extensions/pi-claude-marketplace/domain/manifest-path.ts
  - extensions/pi-claude-marketplace/domain/manifest.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/declared-component-path-overlap.test.ts
  - tests/architecture/manifest-read-agreement.test.ts
  - tests/architecture/partial-vocabulary-guard.test.ts
  - tests/bridges/commands/discover.test.ts
  - tests/bridges/skills/discover.test.ts
  - tests/domain/component-paths.test.ts
  - tests/domain/dependencies.test.ts
  - tests/domain/manifest-path.test.ts
  - tests/domain/manifest.test.ts
  - tests/domain/plugin-resolver.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
fix_report: 01-REVIEW-FIX.md
source_revision: b64f0b98
iteration: 2
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-14T15:53:20Z
**Depth:** standard
**Files in original review scope:** 29
**Status:** clean

## Summary

The focused re-review closes CR-03 and CR-04. No remaining blocker or warning was found in the fixes or their Phase 1 regression paths. The original 29-file scope is preserved above; this pass reviewed the changes addressing the two confirmed findings rather than repeating a whole-main audit.

The preceding findings and reproduction evidence remain in `01-REVIEW.iter2.md`. Implementation, hook, coverage and full-check evidence are recorded in `01-REVIEW-FIX.md`; its historical section retains the earlier CR-01/CR-02 and WR-01 through WR-05 context.

## Narrative Findings (AI reviewer)

No open findings.

### Closure of prior CR-03

Commit `4053f227` adds the file-kind check before info reads a manifest candidate. `info.ts:534-547` advances on a non-file, ENOENT or ENOTDIR and returns unusable for other failures. Its Node adapter at `info.ts:2820-2827` uses `stat(...).isFile()`, matching the resolver and version reader's treatment of followed targets. The optional reader capability preserves existing callers.

The real device-candidate fixture now asserts the bare manifest's dependency list alongside the resolver's installable state and bare version. Directory candidates and non-directory wrappers also fall through; EACCES, ELOOP and non-errno stat failures stop the dependency walk. These are assertions of public outcomes, not checks of source tokens.

### Closure of prior CR-04

Commit `b64f0b98` changes the forbidden bare sibling to contain an invalid dependency declaration. An incorrect info fallback reaches the invalid-manifest result before the later resolver can suppress the selected dependencies. The architecture cases and the direct malformed/non-object cases assert complete notifications.

Independently checked `/tmp/phase1-cr04-negative.log` against the current source and test changes. All four selected cases fail for the intended reason: info changes from unsupported-source output to invalid-manifest output with unresolved components. The architecture failures retain resolver state `unavailable` and version `1.0.0`, so the negative control distinguishes the third reader independently. The current production file matches committed `4053f227`; the temporary mutation is absent.

## Validation

Executed during this re-review:

```sh
node --test --test-isolation=none --test-name-pattern='all three readers|unparseable first candidate|non-object own manifest|manifest stat failure|a device instead' tests/architecture/manifest-read-agreement.test.ts tests/orchestrators/plugin/info.test.ts
```

Result: **12 passed**, zero failed, cancelled or skipped. Log: `/tmp/phase1-rereview-closure.log`.

Reviewed the completed fix lane's evidence rather than rerunning its broad checks:

- Full `npm run check`: 6,124 unit tests and 32 integration tests passed.
- Restored focused suite: 177 passed, zero failed or skipped.
- Standalone info coverage: 396/396 branches, 79/79 functions and 2831/2831 lines.
- Negative control: four targeted tests failed while the other readers' results remained unchanged.
- Prerequisite `b84d7061` updates the command-discovery coverage measurement after deduplication removed code. Its existing deficit remains one branch and two lines; no additional allowance was introduced.

This re-review changes only REVIEW.md and creates no commit. The clean code-review result does not replace the separate phase verification gates.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
