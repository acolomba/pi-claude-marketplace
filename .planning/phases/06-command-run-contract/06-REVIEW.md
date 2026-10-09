---
phase: 06-command-run-contract
reviewed: 2026-10-09T21:32:00Z
depth: standard
files_reviewed: 65
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/edge/command-run.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/shared/notification-command-error.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-present.ts
  - extensions/pi-claude-marketplace/shared/notification-run.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - schema/claude-plugin.schema.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-wire.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/architecture/wire-schema.test.ts
  - tests/bridges/hooks/async-rewake/registry.test.ts
  - tests/bridges/hooks/settle.test.ts
  - tests/edge/command-run.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/shared.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/browse.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/edge/handlers/plugin/help.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/pending.test.ts
  - tests/edge/handlers/plugin/prune.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/shared.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/edge/register.test.ts
  - tests/edge/router.test.ts
  - tests/index.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/dependency-tag-probe.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/install-clone-probe.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/list-flow.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/shared/notification-command-error.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-json.test.ts
  - tests/shared/notification-run-seeds.ts
  - tests/shared/notification-run.test.ts
  - tests/shared/notification-wire.test.ts
findings:
  critical: 1
  warning: 0
  info: 0
  total: 1
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-09T21:32:00Z
**Depth:** standard
**Files Reviewed:** 65
**Status:** issues_found

## Summary

One BLOCKER: the new internal-error path discloses absolute local paths with
spaces or non-ASCII directory names. The leak was reproduced through the
production command boundary in both JSON and RPC. Schema validation accepts
the resulting payloads.

The explicit 65-file workflow list is the scope, including the shipped JSON
schema and every listed test. Review covered phase changes, their current
source context, notification callers, and test assertions. CodeGraph preceded
source inspection. The supplied scope resolution is degraded to
`phase-range(no-task-commit-rows)`; it is not an empty or clean verdict.
The configured base is `2efeb8bc2f71b5dba650bbeae228bed3a20953ff`.
The execution base is `e7802fef27f79cf4f3de8369787542e345f8fdab`; their
extensions/tests/schema trees have no difference. No archived phase 06 was
included.

The review read AGENTS.md, the configured TypeScript review/comment/test
skills, local-verification, the active CONTEXT, all four PLAN/SUMMARY pairs,
VALIDATION, and SECURITY. The security record's closure of T-06-04 and T-06-14
needs reassessment in light of CR-01.

## Structural Findings (fallow)

Source: `/tmp/json-output-review-fallow.json`, Fallow 3.30.0, schema 11.
The prepass completed with a findings exit status of 1. Its stderr reports
cache reuse and generated-cache entrypoint advisories, not execution failure.

| Normalized prepass category | Repository result | Scope relevance and disposition |
| --- | --- | --- |
| Dead code, unused exports, unresolved imports, cycles | 0 issues | No structural defect to promote. |
| Complexity | 557 findings; maximum cyclomatic complexity 20 | 176 observations are in the 65-file list. They include unchanged functions and test fixtures. Changed selectors and the exhaustive outcome switch were inspected in context; a threshold alone does not establish a phase defect. |
| Duplication | 17 groups | One group touches the scope: `dup:c77b3abb6f87acd9-r11`, registry.ts:360-371 and dispatch-exec.ts:410-422. It is inherited; this phase changes registry.ts:442, outside the duplicate. No phase finding. |

The prepass compares against repository merge-base
`000be227d8bb606ba9c7958eb263e527d0d5b77c`, covering 430 changed files,
rather than the active phase execution base. Its introduced/inherited labels
therefore do not establish phase attribution. Its complexity coverage is
`estimated` with tier `none`; that is not evidence that the directly paired
functions lack tests. For example, `wireScope` and `wireVersion` are marked
introduced against that older base but are unchanged in this phase.
These observations remain separate from the one proven narrative defect and
are not added to the phase finding counts.

## Narrative Findings (AI reviewer)

### CR-01: BLOCKER — Internal errors disclose paths with spaces or Unicode

**Classification:** BLOCKER
**Severity:** Critical — information disclosure
**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-command-error.ts:36-39`
**Related files:**
`/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:18-23`;
`/home/acolomba/src/pi-claude-marketplace-json/tests/shared/notification-command-error.test.ts:6-27`;
`/home/acolomba/src/pi-claude-marketplace-json/tests/shared/notification-json.test.ts:42-48`;
`/home/acolomba/src/pi-claude-marketplace-json/tests/architecture/no-credential-leak.test.ts:1049-1053`.

**Issue:** The new resolver special-cases file URLs and UNC paths, then relies
on the existing text redactor for POSIX and drive-letter paths. That redactor
uses ASCII `\w` character classes, excludes spaces, and requires a matching
internal separator. Valid absolute paths can therefore pass through unchanged.
An ordinary filesystem exception naming a directory with spaces, or a
non-ASCII directory, reaches the command's machine error with its full local
path. This violates the new surface's no-local-path disclosure contract
(D-10, T-06-04, T-06-14).

The behavior was reproduced with Node v26.11.0 by invoking `runCommand`
with the production `openNotificationRun`, a recording entry sink, and a
handler throwing `new Error('ENOENT: open "' + path + '"')`. All six
combinations below fulfilled and appended a schema-valid internal-error
containing the complete original path:

| Input path | JSON causeChain[0] | RPC result |
| --- | --- | --- |
| `/Private Data/client/secret.json` | `ENOENT: open "/Private Data/client/secret.json"` | Same unchanged path |
| `/用户/秘密/config.json` | `ENOENT: open "/用户/秘密/config.json"` | Same unchanged path |
| `C:\Private Data\client\secret.json` | `ENOENT: open "C:\Private Data\client\secret.json"` | Same unchanged path |

A separate resolver probe also retains
`failed at:/private/work/config.json`, because the shared redactor excludes
matches immediately after a colon.

The existing resolver examples use ASCII paths without spaces. The new
converter disclosure predicate repeats the restrictive character classes,
and the architecture predicate also misses non-ASCII path roots. Thus the
passing disclosure controls do not cover these inputs. This is one defect
with a related regression-test gap, not separate findings for each test.

**Fix:** Add a command-error-specific path sanitizer that recognizes complete
quoted filesystem paths, spaces and Unicode in POSIX/Windows components,
and colon-prefixed diagnostic paths. Replace the complete sensitive span
with `[path]` or a safe basename. Preserve the existing file-URL/UNC masking,
credential redaction, cause-depth limit, and hostile-accessor fallback.
Keep the change local to this machine-only surface so the shared text
redactor and frozen text corpus do not change incidentally.

Add independent expected-output cases for the three paths above and
colon-prefixed diagnostics in the resolver pair, plus JSON/RPC command-boundary
regressions. Assert the entire expected safe payload and the absence of each
original path; do not rely solely on a copy of the production matching regex.
Include planted unredacted versions that the disclosure checks must reject.

## Evidence and Boundaries

The inspected source head was
`9c0bf37a2861dc5ce5a7c3607813793eca914e8c`. The executable diff from the
parent's clean verified commit
`f8e2a3889501d13634e1ff2d0ccd368df6f5d274` was empty, and there were no
untracked executable inputs. The parent supplied `npm run check`, exit 0,
Node v26.11.0, 266 direct-coverage pairs. Its strict corpus evidence is 3149
baseline entries and zero extras; the catalog baseline remains `26cb0056`.
No broad checks, corpus regeneration, dependency installation, implementation
edit, test edit, or commit was performed for this review. Narrow in-memory
probes established CR-01; they did not modify source or tests.

D-08 was assessed as one direct recovery attempt per ordinary append fault:
success reopens delivery, failed recovery closes delivery, and neither retries
nor rolls back business work. Host-mode invalidation and failure of the trusted
recovery allocator remain explicit contract boundaries, not additional findings.

Both descriptor-less prohibitions remain **flagged-unverified** for the final
verifier: correlation must not become persistent tracking/telemetry, and
internal errors or delivery failures must not imply rollback of completed
changes. This review does not mark either verified.

---

_Reviewed: 2026-10-09T21:32:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
