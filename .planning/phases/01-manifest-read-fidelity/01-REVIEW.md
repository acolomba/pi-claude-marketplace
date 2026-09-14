---
phase: 01-manifest-read-fidelity
reviewed: 2026-09-14T15:28:35Z
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
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
fix_report: 01-REVIEW-FIX.md
source_revision: 93cc7366
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-14T15:28:35Z
**Depth:** standard
**Files in review scope:** 29
**Status:** issues_found

## Summary

Reviewed the explicit Phase 1 file scope after the main-branch merge, with particular attention to manifest selection, dependency rejection and rendering, normalized component paths, and bridge overlap suppression. This is a review of the Phase 1 behavior and its current call paths, not a whole-main audit. The subsequent documentation-only commit `902ea53f` does not change the reviewed source.

Two blockers remain: the info reader does not implement the agreed non-file fallback policy, and the agreement gate still cannot detect an independent fallback regression in that reader. Both were demonstrated through current public entry points without modifying production or test source.

## Narrative Findings (AI reviewer)

### CR-03: Info reads non-file manifest candidates instead of advancing to the bare manifest

**Classification:** BLOCKER

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:536-547`

**Related files:** `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/domain/manifest-path.ts:20-22`; `/home/acolomba/src/pi-claude-marketplace-manifest/tests/architecture/manifest-read-agreement.test.ts:141-206`

**Issue:** D-01-37 makes every non-regular manifest candidate an absence. The resolver and version reader check file kind before opening a candidate. Info immediately calls `reader.readTextFile` and recognizes only ENOENT, ENOTDIR and EISDIR as absence. Other non-file candidates can therefore be treated as unreadable manifest contents instead of permitting fallback.

**Executed reproduction:** In a temporary project-scope marketplace, the entry declares `stale-dep@mp` and version `1.0.0`; the bare manifest declares `fresh-dep@mp` and version `9.9.9`. The wrapped `plugin.json` is a symlink to `/dev/null`, whose stat is not a regular file. The current public entry points produce:

```text
resolveStrict:       installable
resolvePluginVersion: 9.9.9
getPluginInfo:
● mp [project] <no autoupdate>
  ○ alpha v1.0.0 (available)
    dependencies: stale-dep@mp
```

The resolver and version reader selected the bare manifest, while info discarded its authoritative dependency declaration and displayed the stale entry. The entry-sourced version in the info row is intentional; the stale dependency list is the defect.

**Fix:** Add an explicit file-kind capability to `PluginInfoReader` and stat each manifest candidate before reading its contents. Non-files, ENOENT and ENOTDIR must advance; other stat failures must stop this reader's candidate walk under its existing failure contract. Retain the independent readers required by D-01-06. Add a real filesystem agreement case for a non-regular candidate, using a portable fixture where practical, and assert that all three readers select the bare manifest. Also retain the directory and non-directory-wrapper cases.

### CR-04: The unusable-manifest agreement cases cannot detect wrong fallback in info

**Classification:** BLOCKER

**File:** `/home/acolomba/src/pi-claude-marketplace-manifest/tests/architecture/manifest-read-agreement.test.ts:156-181`

**Related files:** `/home/acolomba/src/pi-claude-marketplace-manifest/tests/orchestrators/plugin/info.test.ts:7540-7554`; `/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1177-1201`

**Issue:** The malformed-JSON and ELOOP cases assert an unavailable info notification with no dependencies. That row is determined by the later resolver read. Even if info's earlier dependency reader illegally selects the valid bare manifest, the later resolver still rejects the wrapped manifest and suppresses the dependency result. The assertion therefore does not discriminate the third reader's behavior, despite its title claiming all three readers stop correctly. The direct info test repeats the same blind spot and incorrectly claims any reader's fallback would put the bare list on the row.

**Executed negative control:** Used `createGetPluginInfo` with its existing public `PluginInfoReader` capability. Against a real malformed wrapped manifest and a valid bare sibling, the reader redirected only the first wrapped read (the dependency read) to the bare sibling. All later reads used their real paths, so the resolver still saw the malformed wrapper. Both the normal reader and this deliberately wrong dependency selection produced exactly:

```text
● mp [project] <no autoupdate>
  ⊘ alpha v1.0.0 (unavailable) {unsupported source}
```

The probe confirmed that the redirected read happened and that the complete notification arrays were identical. Thus the current gate accepts the specific independent-reader regression it claims to reject. This is the surviving third-reader portion of historical WR-05, not a claim that the resolver's new errno tests are vacuous.

**Fix:** Make wrong selection observably different. For example, retain a valid marketplace entry but give the forbidden bare sibling an invalid dependency declaration: a wrong fallback then reaches `invalidManifestBlock`, which produces a different reason and unresolved-components marker before the resolver can mask it. Keep real malformed/ELOOP trees, assert complete notifications, and execute a negative control that changes only the dependency reader. Alternatively, exercise the existing reader capability to assert that the forbidden candidate is never read while independently asserting the full public result. Fix both the architecture gate and the direct info regression case.

## Historical findings and current disposition

`01-REVIEW-FIX.md` preserves the earlier review's two critical and five warning findings and their implementation commits. Its historical test results remain historical evidence; they do not establish this merged revision's correctness.

- Historical CR-01 is closed for the authorized lexical overlap: commands now check `seenByFile` before generated-name collision handling. The complete discovered-command assertion preserves one command per source plus undeclared siblings.
- Historical CR-02 is closed for ENOTDIR, EACCES and ELOOP in the resolver. The stat probe sits inside the malformed-manifest catch. CR-03 identifies the separate non-file disagreement left in info.
- Historical WR-01 follows D-01-35: an invalid declaration rejects whole; invalid own dependencies stop resolution; named marketplace entries become unsupported stubs while healthy siblings survive.
- Historical WR-02, WR-03 and WR-04 are reflected in shared token validation, the approved field bounds, and Set-based skill-directory membership. Compound ranges remain admitted as required.
- Historical WR-05 is only partially closed. The new real-filesystem cases discriminate the resolver and version reader, but CR-04 demonstrates their remaining blind spot for info.
- Historical Info-only observations remain outside the authorized fix pass. They are not counted as newly confirmed blocking findings here.

## Validation evidence

Executed in this review:

- `node --test tests/architecture/manifest-read-agreement.test.ts tests/architecture/declared-component-path-overlap.test.ts tests/domain/dependencies.test.ts tests/domain/manifest.test.ts tests/domain/manifest-path.test.ts tests/domain/component-paths.test.ts tests/bridges/skills/discover.test.ts tests/bridges/commands/discover.test.ts` — exit 0; this runtime reported eight passing file jobs. Log: `/tmp/phase1-review-tests.log`.
- `node --test --test-isolation=none tests/architecture/manifest-read-agreement.test.ts tests/architecture/declared-component-path-overlap.test.ts` — 11 tests passed, zero failed, cancelled or skipped. Log: `/tmp/phase1-review-tests-direct.log`.
- `node --test --test-isolation=none --test-name-pattern='uses the content hash when neither' tests/orchestrators/plugin/shared.test.ts` — four tests passed, including the three nested manifest-location cases. Log: `/tmp/phase1-shared-nested.log`.
- Public-entrypoint non-file probe and independent dependency-reader negative control — confirmed CR-03 and CR-04 as detailed above. Temporary project trees were removed.

The separate validation lane owns the full check and direct-coverage reruns; this report does not claim those commands were executed here. No source files were modified and no commit was created.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
