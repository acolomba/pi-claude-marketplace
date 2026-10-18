---
phase: 05-marketplace-info
reviewed: 2026-10-18T17:15:43Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - features/lib/path-marketplace.ts
  - features/lib/published-marketplace.ts
  - features/marketplace/info.feature
  - features/step_definitions/marketplace/info.steps.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/fixtures/marketplace-info.ts
  - tests/orchestrators/marketplace/info.test.ts
findings:
  critical: 0
  warning: 1
  info: 0
  total: 1
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-10-18T17:15:43Z
**Depth:** standard
**Files reviewed:** 10
**Status:** issues_found

## Structural Findings (fallow)

The supplied `FALLOW-normalized.json` reports zero unused exports, zero unused files, six duplicate blocks, and zero cycles. Its normalized items are preserved below. All six are outside the explicit review file list; they are **WARNING — context only**, not Phase 5 fix targets, and are excluded from the frontmatter's actionable finding counts.

| File | Line | Normalized finding | Related file |
| --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` | 106 | Duplicate block (3 instances) | `extensions/pi-claude-marketplace/persistence/migrate.ts` |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` | 168 | Duplicate block (2 instances) | `extensions/pi-claude-marketplace/persistence/migrate.ts` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts` | 319 | Duplicate block (2 instances) | `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | 2191 | Duplicate block (2 instances) | `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` | 1125 | Duplicate block (2 instances) | `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts` |
| `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` | 284 | Duplicate block (2 instances) | `tests/architecture/catalog-uat/fixtures/plugin-uninstall.ts` |

**Disposition:** Preserve these supplied cross-module facts. Any consolidation belongs to a separately scoped review that checks whether the repeated blocks have the same behavior; no source changes are proposed here for these context-only items.

The additional changed-file orientation command, `fallow review --base c842e3a067f6ab28c43c827a3bf88306d0bc5270 --brief --gate all --format json --quiet`, exited 0 with verdict `pass` and no changed-file dead-code, complexity, or duplication findings. This narrower result does not contradict the supplied repository-wide duplicates. The default attribution mode first exited 2 because it could not create its temporary base worktree; `--gate all` completed without that operation.

## Narrative Findings (AI reviewer)

### Summary

One warning affects the new behavioral assertion helper: it cannot represent the valid absence of a remote source's optional ref. No production correctness or security defect was confirmed in the scope-ordering change. Mixed success/failure outcomes retain project-first order, healthy scopes survive manifest failures, and the unit assertions compare complete notification sequences and filesystem contents.

### Warnings

#### WR-01: The info assertion requires a ref for every URL and GitHub source

**Classification:** WARNING
**File:** `/home/acolomba/src/pi-claude-marketplace-cucumber-behavioral-tests/features/step_definitions/marketplace/info.steps.ts:84-86`
**Related lines:** `27-30`, `78-81`

**Issue:** `SOURCE_FIELDS_BY_KIND` includes `source ref` for both remote source kinds. `expectedInfoFields` then requires every applicable field to be nonempty. An unpinned URL or GitHub marketplace legitimately has no `source.ref`: the production projection includes it only when defined, and the existing `url-single-scope-minimal` and `github-single-scope-minimal` catalog fixtures explicitly cover that shape. A table with an empty `source ref` cell throws `the url source requires "source ref"` or `the github source requires "source ref"`; omitting that row also throws. Consequently, this step cannot assert a correct unpinned source result. Current tagged examples all use `#stable`, so they conceal the limitation.

**Evidence:** Executing the current `expectedInfoFields` declarations in memory with complete source-field tables rejected blank refs for both kinds and accepted `stable` for both. No source files were changed for the reproduction.

**Fix:** Distinguish required identity fields from optional applicable fields. Require `source url` for URL sources and `source owner`/`source repo` for GitHub sources. Permit a blank `source ref` cell for either kind and remove that expected key so the full-map comparison verifies that the actual payload omits it. Keep rejecting nonempty fields that belong to another source kind. Add tagged unpinned URL/GitHub examples, or focused assertions for the table parser, to cover both absent and present refs without activating remote stand-ins prematurely.

### Verification evidence

Reused this session's executor evidence supplied by the orchestrator, under the local-verification skill. Verified that `git diff a3ab38fb9ee2d25f0f9de3fa2b0a026ffc3e14a2 -- . ':(exclude,glob).planning/**'` is empty and the only untracked files before this report were the two planning Fallow artifacts. Runtime remains Node `v26.11.1`; reviewed HEAD is `ca85164ce56d9ab69be5dc14617ea92486c0eaf1`.

- `npm run check`: passed at `a3ab38fb9ee2d25f0f9de3fa2b0a026ffc3e14a2`, including 146 Cucumber scenarios / 1,537 steps and 280 direct-coverage records.
- `npm run test:cucumber -- features/marketplace/info.feature`: passed, 10 scenarios / 76 steps.
- `npm run check:features`: passed.
- `node --test tests/orchestrators/marketplace/info.test.ts`: passed, 22 tests.
- `node --test tests/architecture/catalog-uat/catalog-contract.test.ts`: passed, 4 tests / 288 exact catalog states.

The review traced scope collection, manifest error classification, the cross-scope flag, and field-table projection through their consumers. The output-catalog review focused on the marketplace-info contract and the changed documentation; the reused catalog test covers all documented fenced states. Remote Cucumber rows remain intentionally excluded pending their stand-ins, so the passing local scenarios do not establish remote behavioral coverage.

No source files were modified. This report was not committed.

---

_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
