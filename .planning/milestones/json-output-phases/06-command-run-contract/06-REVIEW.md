---
phase: 06-command-run-contract
reviewed: 2026-10-09T22:37:58Z
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
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 6: Code Review Report

**Reviewed:** 2026-10-09T22:37:58Z
**Depth:** standard
**Files Reviewed:** 65
**Status:** clean
**Source HEAD:** `045f53cd5060082c5df6371853338f6765cd1c2d`
**Re-review:** iteration 4, after the third and final automatic fix

## Summary

No current findings. CR-01 is independently resolved for the reviewed
contract and reproduced cases. The missing Windows root form now reaches
the existing conservative path handling. All eight exact payload cases
from the previous finding pass with independently expected safe causes.
No new regression was established.

The complete persisted 65-file scope from
`/tmp/json-output-review-files.json` is retained above. This iteration
reuses the authorized assessment of the 60 unchanged files and inspects
the entire five-file diff from `6680ff1b`: the machine error resolver,
resolver tests, command boundary tests, converter tests, and architecture
tests. The production change is one prefix-recognition line.

Scope resolution remains `phase-range(no-task-commit-rows)`, with base
`2efeb8bc2f71b5dba650bbeae228bed3a20953ff`. The prior comparison established
the same extensions/tests/schema baseline as execution base
`e7802fef27f79cf4f3de8369787542e345f8fdab`.

Context includes AGENTS.md, the configured TypeScript comments, style,
unit-testing review and local-verification skills, all four phase
PLAN/SUMMARY pairs, CONTEXT, prior review records, and the updated
`06-REVIEW-FIX.md`. The parent preserved the preceding report as
`06-REVIEW.iter4.md`. CodeGraph preceded current source inspection;
the existing caller trace through command execution, notification dispatch,
resolution, conversion, and lifecycle roots remains applicable.

## Structural Findings (fallow)

The supplied `/tmp/json-output-review-fallow.json` prepass uses Fallow
3.30.0, schema 11, pre-fix head `9c0bf37a`, merge-base
`000be227d8bb606ba9c7958eb263e527d0d5b77c`, and 430 changed files.

| Normalized category | Repository observation | Phase disposition |
| --- | --- | --- |
| Dead code | 0 issues | No finding. |
| Complexity | 557 findings; maximum cyclomatic complexity 20 | Pre-existing repository observations; no independently established phase defect. |
| Duplication | 17 groups | Scoped group `dup:c77b3abb6f87acd9-r11`, registry.ts:360-371 and dispatch-exec.ts:410-422, is inherited and outside the changed registry line. |

These observations do not establish phase attribution and contribute no
review findings. The current parent full-gate log separately shows Fallow
passing. The fixer also reports a clean five-file audit against `6680ff1b`.

## Narrative Findings (AI reviewer)

None. Counts: 0 critical, 0 warning, 0 informational.

### CR-01 disposition: independently resolved

At `extensions/pi-claude-marketplace/shared/notification-command-error.ts:48`,
the matcher now recognizes either slash or backslash. A single-backslash
Windows current-drive-rooted path therefore enters `redactPathTail`,
rather than reaching the unchanged-message return. Drive-letter, UNC,
extended UNC, extended drive, and slash roots continue to use the same
handling.

The conservative policy at lines 60-85 is unchanged: ambiguous quote
boundaries, controls, angle brackets, or arbitrary suffixes suppress the
affected cause; otherwise the local tail is replaced with `[path]`.
The fix introduces no new delimiter heuristic. A successful ordinary
redaction preserves only the explicitly allowed display suffix.

The new tests independently specify complete presentations and payloads.
Both disclosure helpers compare each cause chain with an independently
supplied expected chain. Expectations are literal fixture outcomes, not
values derived from the production resolver. Existing marker checks remain
supplemental. Independent controls with a fresh `FreshCanary` name
confirm both helpers reject untouched paths and partially redacted tails
without adding that name to their marker lists.

## Independent Verification

Read-only, in-memory probes at the current HEAD passed:

- **Eight exact previous failures:** All four single-backslash paths from
  the preceding review, in JSON and RPC, now match complete expected
  payloads and pass schema validation. Ordinary paths are masked;
  embedded apostrophes and line feeds yield
  `Command failure details omitted.`.
- **126 additional complete boundary payloads:** Nine root forms across
  six components in both transports (108), four real POSIX ENOENT cases
  in both transports (8), and five URL/suffix/prefix diagnostics in both
  transports (10). Roots include current-drive, drive-letter with either
  separator, UNC, extended UNC, extended drive, Windows device namespace,
  slash, and double-slash roots. Components include spaces, Unicode,
  apostrophes, line feeds, and angle brackets.
- **168 additional full resolver presentations:** Three root forms,
  fourteen component variants, and four quoting choices. These include
  the newly recognized root, device and extended UNC forms, quotes,
  backticks, C0/C1 controls, and Unicode line/paragraph separators.
  Nested cause order, reload facts, and truncation facts matched
  independent expected presentations.
- **Six fresh planted negative controls:** Both actual disclosure helpers
  were extracted with the TypeScript parser and executed unchanged in
  memory. Each accepted a safe expected chain and rejected an untouched
  private path, a partially masked private suffix, and an unexpected
  private cause string.
- **Reused prior matrix:** The preceding 1,680-case assessment remains
  applicable to unchanged conservative tail handling. It covered seven
  recognized roots, fifteen components, four quoting choices, and four
  suffix forms, including second paths and HTTP-like text within local
  paths. The previous 30 complete-payload checks of original diagnostics
  and real ENOENT delimiter cases remain part of the review evidence.
  The eight exact regressions and fresh probes above independently cover
  the changed prefix behavior.

HTTP credential masking and URL preservation passed fresh probes, as did
a local backslash path after a remote URL, the colon-prefixed slash path,
the permitted quoted display suffix, and fallback for an arbitrary suffix.

Windows diagnostics were synthetic inputs to the actual production command
boundary on Linux. `path.win32.isAbsolute()` confirmed the tested root
forms; native Windows filesystem execution was not performed. Real POSIX
ENOENT probes used failed reads of missing paths without filesystem writes.
These checks establish the reviewed behavior, not a proof for every possible
arbitrary error string.

## Supplied Verification and Gate Status

- `/tmp/cr01-iter3-focused.log` records 1,198 passes, zero failures,
  zero skips.
- `/tmp/cr01-iter3-corpus.log` records 10,089 passes, zero failures,
  one inherited skip, and exactly 3,149 baseline entries with zero extras.
  The text corpus was not recaptured.
- The fix report records a passing normal commit hook. Its test additions
  comprise 432 full resolver presentations, 80 boundary payloads,
  56 architecture payloads, and 120 planted negative checks; the actual
  five-file diff was inspected for independent expectations.
- **Fresh full gate passed:** The parent reports `npm run check` exit 0
  at `045f53cd5060082c5df6371853338f6765cd1c2d`, Node `v26.11.0`.
  Inspection of `/tmp/json-output-cr01-iter3-check.log` confirms all six
  static checks pass and the final
  `Merged LCOV: coverage/direct.lcov (266 records)`.
  Exit status is parent-captured evidence. No executable inputs changed;
  the result is reused under local-verification.

No broad checks were duplicated. Both the independent review and current
combined-tree gate pass; remaining verification limits are recorded below.

## Contract and Security Limits

The unchanged-file assessment preserves the text exception and timing
contract, synchronous trusted-mode preflight limits, bounded cause
serialization, and pure field-projecting converter. The repair remains
machine-only; the shared text redactor is unchanged. Unsupported or
inaccessible live mode and failure of the trusted recovery allocator remain
host-contract limits. The fixed corpus evidence supports text preservation.

D-08 remains locked: one direct recovery per failed ordinary append;
successful recovery reopens delivery and permits later output; failed
recovery closes delivery. Recovery is nonrecursive and never retries
business work. The accepted failed-sink delivery limit remains explicit.

The fix report still says **requires human verification**. Independent
code-review closure of CR-01 does not claim that a human performed that
verification or close the parent's security/validation records. T-06-04
and T-06-14 now have positive independent redaction evidence; final security
and goal verification remain parent-owned.

Both descriptor-less prohibitions remain **flagged-unverified** for the
final verifier: no persistent user/cross-command tracking or telemetry, and
no implication that an internal error or delivery fault rolls back completed
changes. Neither is marked as an automated pass.

Only `06-REVIEW.md` was modified. No executable inputs, tests, other
planning files, or parent backups were changed. No commit was made.

---

_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
