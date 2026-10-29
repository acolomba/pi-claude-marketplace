---
phase: 09-plugin-package-dependencies
reviewed: 2026-10-29T01:15:37Z
depth: standard
reviewed_commit: 64b397f9154bbd4f342ea89b0b6103a597b9cd6f
source_commit: 250acaadf15622a66ee80b5e3443ad96be908016
review_scope_complete: true
re_review: true
files_reviewed: 49
files_reviewed_list:
  - eslint.config.js
  - extensions/pi-claude-marketplace/domain/package-lockfile.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/platform/package-manager.ts
  - extensions/pi-claude-marketplace/shared/path-safety.ts
  - extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts
  - extensions/pi-claude-marketplace/shared/redact-credentials.ts
  - features/lib/npm-registry.ts
  - features/lib/published-marketplace.ts
  - features/plugin/package-dependencies.feature
  - features/step_definitions/npm-registry.steps.ts
  - features/step_definitions/plugin/packages.steps.ts
  - features/support/npm-registry.ts
  - features/support/world.ts
  - rule-packs/architecture.json
  - test/architecture/gate-targets.ts
  - test/architecture/no-shell-out.test.ts
  - test/domain/package-lockfile.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/install-flow.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/materialize-latest.test.ts
  - test/orchestrators/plugin/package-install.test.ts
  - test/orchestrators/plugin/uninstall.test.ts
  - test/orchestrators/plugin/update-flow.test.ts
  - test/orchestrators/reconcile/apply-outcomes.test.ts
  - test/orchestrators/reconcile/apply.test.ts
  - test/orchestrators/reconcile/notify.test.ts
  - test/platform/package-manager.test.ts
  - test/shared/redact-absolute-paths.test.ts
  - test/shared/redact-credentials.test.ts
findings:
  critical: 5
  warning: 2
  info: 0
  total: 7
status: issues_found
gate:
  command: npm run check
  exit_code: 0
  source_commit: 250acaadf15622a66ee80b5e3443ad96be908016
  node: v26.12.1
  reused: true
  scenarios: 1125
  steps: 11467
  coverage_records: 309
---

# Phase 9: Code Review Report

**Depth:** standard, with cross-module traces of the package lifecycle.
**Status:** issues_found — 5 BLOCKER and 2 WARNING findings.
**Reviewed tree:** `64b397f9`; executable inputs match `250acaad`.

## Narrative Findings (AI reviewer)

This is a fresh review of the current implementation, not a check that the old fixes landed. Its scope is the union of the original 21 review files, all eight stale-verification moved files, and the current callers, sanitizer, redactors, and tests listed above. Findings below describe current behavior. Historical finding IDs appear only in the disposition table and do not contribute to the new counts.

### Critical Issues

### CR-01: BLOCKER — Closing the timed-out parent cancels the process-tree kill

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/platform/package-manager.ts:205-224`
**Related:** `startKillTimers`, lines 168-182.

**Issue:** After the timeout sends SIGTERM, any direct-child `close` settles the promise and calls `stopTimers()`. That cancels the pending process-group SIGKILL even when descendants remain. A descendant that ignores SIGTERM and has closed or redirected its standard streams does not keep the parent's captured pipes open, so the parent closes while that descendant continues running. The package step then removes its work directory under a live process. This violates D-PL9-19's whole-process-tree timeout guarantee; the earlier fix only covers descendants that keep the captured pipes open.

**Evidence:** A narrow real-process reproduction used the production runner with a 500 ms timeout and 150 ms kill grace. A shell parent started a same-group descendant with redirected streams and SIGTERM ignored. The result was `timedOut: true`, but the descendant was still alive 400 ms after the runner returned, beyond both grace periods. The reproduction explicitly killed the survivor. No repository inputs changed.

**Fix:** Separate promise settlement from timeout cleanup. Once a timeout has begun, keep the group-kill escalation alive even if the direct child closes, or complete the group kill before settling. Preserve the final bounded deadline and clear resources after escalation. Add a real-process or controlled process-boundary case where the parent closes on SIGTERM while a descendant ignores it without holding stdout/stderr. The production fix belongs in `platform/package-manager.ts` and its paired test.

### CR-02: BLOCKER — Updating a disabled plugin preserves the previous revision's packages

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/plugin/package-install.ts:329-331`
**Related:** `package-install.ts:597-605`, `update-preflight.ts:797-818,833-838,1208-1236`, `materialize-latest.ts:104-105`, `enable-disable.ts:429-441`.

**Issue:** An unconstrained path plugin in a cloned marketplace uses the same root across revisions. Installing v1 creates v1's `node_modules`; disabling it retains that directory. Updating while disabled refreshes the record to v2 at the same root and returns a finished preflight outcome, before the update package hook. Enabling then calls the install ledger, whose package phase always uses `force: false`. Because `node_modules` exists, it skips v2's lockfile and enables v2 code with v1 packages. A later update sees the recorded v2 revision as current, and same-revision reinstall also skips the old packages.

This differs from the accepted D-PL9-06 unchanged-copy skip: the clone and recorded revision changed, and the user already ran the plugin update that the decision names as the repair.

**Evidence:** The resolver's unpinned path arm reads in place (`domain/plugin-resolver.ts:508-522`). The disabled refresh retains that path and clears an absent SHA; no SHA change means no clone cleanup. An independent narrow checkout reproduction with the installed isomorphic-git changed the manifest from `1.0.0` to `2.0.0` while ignored `node_modules` remained at `1.0.0`. Its temporary repository was removed.

**Fix:** Preserve the need to refresh packages across a disabled revision change. Invalidate step-owned old modules on that transition, or record package revision/lockfile identity and consume the mismatch during enable. Unchanged enables must remain offline. Cover install v1 → disable → update to v2 in the same contained root → enable, asserting both package version and registry requests.

### CR-03: BLOCKER — Uninstall can delete packages from a concurrent successful install

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:1104-1115`
**Related:** `package-install.ts:660-681` and the install ledger's presence-based skip.

**Issue:** `removeUnusedPackages` reads state and removes the marked directory outside the scope lock. A valid interleaving is:

1. Uninstall commits removal of the last record.
2. Its cleanup reads state and finds the plugin root unused.
3. Another process installs from that root under the scope lock. It sees the old `node_modules`, skips the package step, and saves its new record.
4. The first cleanup renames and deletes that directory using its stale state result.

The second command reports a successful installed plugin whose packages have just been removed. The state-lock protocol does not serialize this cleanup, so fail-fast locking elsewhere does not prevent the race. D-PL9-22 explicitly preserves packages while another installation uses the folder. The neighboring clone GC now acquires a fresh scope lock; the comment claiming equivalent unlocked behavior is stale.

**Fix:** Acquire a fresh scope lock after the uninstall transaction, then read current references and remove packages inside that same critical section. A held lock can retain the current best-effort cleanup behavior. Add a deterministic interleaving test proving cleanup cannot remove packages that a newly saved installation uses.

### CR-04: BLOCKER — Apply drops package warnings when it combines a move and an enable

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:1869-1882`
**Related:** `apply.ts:1052-1062,1835-1840,2424-2429`; `reconcile/notify.ts:524-536`.

**Issue:** A dependency-held record with its own revision move can be updated while disabled and enabled in the same apply cascade. The enable result correctly carries `stagingWarnings` and `mcpConfigNotices`. For the nonwaiting, revision-changed arm, `landedStepRows` discards those results and returns only `enabledMoveOutcome(move)`, which has neither field. Final emission only reads the retained outcomes. If this enable's package installation fails or is refused, the plugin is enabled without a package warning. An MCP config notice produced by that enable is lost too.

The path is reachable through the deferred enables built by `convergence.ts` and paired with moves in `cascadeSteps`. APPLY1-D1's single net transition row does not require discarding diagnostics. The current package-warning tests cover plain converge and backfill moves, not this combined move-and-enable arm.

**Fix:** Transfer the enable's staging warnings and MCP notices to the consolidated move outcome while preserving the one-row transition policy. Add a composed apply scenario for a deferred revision move whose enable produces a package warning, and a test asserting retained MCP notices and exactly one transition row.

### CR-05: BLOCKER — A moved dependency's package warning is emitted twice

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts:245-255`
**Related:** `dependency-move.ts:276,339-344`; `dependency-settle.ts:145-158,231`; `materialize-latest.ts:176-183,248-257`; `update-flow.ts:565-575`.

**Issue:** `withPackageNote` still places a package warning on the moved dependency's row cause. The same outcome now also carries that note as a discovery staging warning, and `runDependencyMove` forwards it. The dependency settle accumulates those warnings; `materializeLatestVersion` merges them into the requesting plugin's outcome; the direct update emits them in that plugin's diagnostic. Consequently, updating plugin A when it moves dependency B and B's package step fails shows B's warning on B's row and again beneath A's diagnostic header. Marketplace update cascades use the same merged outcome. D-PL1-26 requires one placement for a package note.

**Evidence:** The complete call chain carries the same string through both branches. The tests prove the branches independently: `dependency-move.test.ts:459-488` checks the row cause, `dependency-settle.test.ts:383-406` checks forwarded warnings, and `materialize-latest.test.ts:637-668` checks merging them into the parent outcome. No current composed update case asserts the complete notification set for a moved dependency's package note.

**Fix:** Give a dependency's package warning one owner and one output placement. Prefer carrying the dependency identity with its diagnostic and removing the legacy row-cause copy when that diagnostic is rendered. Preserve visibility on install/apply paths that currently depend on the row. Add a scenario that updates A, moves B, fails B's package install, and asserts exactly one warning attributed to B.

### Warnings

### WR-01: WARNING — The package-manager import exception permits every matching basename

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/eslint.config.js:530-533`

**Issue:** The restricted-path target `**/!(package-install).ts` exempts every file named `package-install.ts`, regardless of directory. `PACKAGE_INSTALL_SEAM` appears only in the error message. A future `edge/package-install.ts` or unrelated orchestrator with that basename can import the process runner directly and bypass the required sanitizer/containment seam without violating this gate. The child-process whitelist does not catch this because that file imports the sanctioned runner rather than `node:child_process` itself. This is the prior IN-03, still present; skipping an Info item in the old fix pass did not make the gate enforce its stated contract.

**Fix:** Express an exception for the exact `orchestrators/plugin/package-install.ts` path. Add a focused negative control for an equally named file in another directory.

### WR-02: WARNING — Separate decoding of output chunks corrupts UTF-8 diagnostics

**File:** `/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-c-369/extensions/pi-claude-marketplace/platform/package-manager.ts:153-154`

**Issue:** Each Buffer is converted to UTF-8 independently. Streams may split a multibyte character anywhere, so a valid package-manager message can become replacement characters before it reaches warning normalization or path redaction. This is the prior IN-04 and remains a current robustness defect.

**Evidence:** A narrow injected runner emitted the bytes of `café` in two chunks, split between `0xc3` and `0xa9`. Captured stderr was `caf��`. This did not depend on output limits or invalid input.

**Fix:** Use a StringDecoder per stream, or request UTF-8 decoding on the streams, while keeping bounded capture. Flush decoder state at completion. Avoid cutting a surrogate pair when limiting the final note. Add a chunk-boundary case with valid multibyte output.

## Scope and verification

The original 21 files and the resolver's eight moved files are all included. The two additional moved source files not in the old list are `dependency-move.ts` and `reconcile/apply.ts`. Current extracted consumers were traced through the lifecycle and notification boundaries; the sanitizer and shared redactors were read directly. CodeGraph was used first for orientation, followed by current direct source reads. No structural pre-pass payload was supplied.

The file list records the review's file universe, not a claim that every unrelated historical test in each large suite was re-audited. Standard review covered the Phase 9 behavior, current changed seams, their setup and assertions, and the associated callers. The test-only helper fully read the install-flow, materialize-latest, package-install, dependency-move, package-manager, sanitizer and redactor tests. It reviewed these relevant sections of the larger existing suites:

| Test file | Inspected lines |
| --- | --- |
| install-outcome.test.ts | 1-310, 1198-1218, 3150-3304 |
| update-flow.test.ts | 1-430, 595-710, 8345-8470, 8570-8675, 11420-11560, 11900-11990 |
| uninstall.test.ts | 1-230, 5760-5910, 6491-6515, 7821-8014 |
| reconcile/apply.test.ts | 1-665, 8641-8735, 10270-10415 |
| reconcile/apply-outcomes.test.ts | 1-80, 1290-1440 |
| reconcile/notify.test.ts | 1-180, 1979-1995, 2110-2205, 2410-2478 |
| dependency-settle.test.ts | 1-430 |

The existing full gate is reused under the local-verification skill: `npm run check` exited 0 on Node v26.12.1 at exact executable inputs `250acaad`, with static checks green, 1125/1125 scenarios, 11467/11467 steps, and 309 coverage records. The parent observed that run directly through exec; no standalone log was saved. It completed before the 2026-10-29T00:41:06Z security audit. The review confirmed an empty `git diff 250acaad -- . ':(exclude,glob).planning/**/*.md'` and no untracked executable inputs before writing this report. No full-suite rerun was performed.

Additional evidence consists of the bounded process-tree reproduction, split-UTF-8 capture reproduction, and the helper's ignored-node_modules checkout reproduction described above. A direct assertion also confirmed that the final `250acaad` redactor preserves the errno text and reduces both apostrophe-containing rename paths to their basenames. Other findings are direct source/call-chain proofs, not claimed end-to-end executions.

## Prior findings and recorded decisions

| Prior item | Current assessment |
| --- | --- |
| CR-01: reinstall revision force | The direct enabled reinstall fix remains: `revisionMoved` compares commit and version. CR-02 above is a different disabled-update/enable bypass. |
| CR-02: apply/dependency warning loss | Ordinary converge/backfill and dependency row propagation remain wired. Current combination defects are CR-04 and CR-05 above. Marketplace/autoupdate package notes now use the shared staging diagnostic (D-PL1-26), so the old deferred cascade gap is obsolete. |
| WR-01: wait forever for close | The final deadline now bounds settlement. D-PL9-19 process-group escalation has the separate surviving-descendant bug in CR-01. |
| WR-02: unusable redacted folder note | Fixed: the outside-root note identifies the marketplace and command without an absolute path. |
| WR-03: uninstall leaves all modules | Sequential marked-module cleanup works, preserves unmarked trees and other recorded users, and reaches prune/apply uninstall. CR-03 is its unsynchronized concurrent-use check. |
| WR-04: multiline/control output | Fixed for subprocess stdout/stderr: control/ANSI removal, prefix cleanup and one-line joining precede the note cap. UTF-8 chunk decoding remains WR-02 above. |
| WR-05: hard-wired package ports | Fixed: contained-root ledger rollback and policy-force cases can inject the package runner. |
| IN-01: failed restore discards parked modules | Still follows the recorded D-PL9-04 upstream swap/finally policy. A restore failure can lose the parked copy; this remains a known recovery limitation, not a newly discovered divergence. |
| IN-02: unreadable root warns before finding package.json | Still reports the actual read refusal. No additional behavioral defect established beyond the recorded warning policy. |
| IN-03 / IN-04 | Still current defects, classified as WR-01 / WR-02 above rather than silently treated as fixed. |
| IN-05: “declared component” header | Still the chosen D-PL9-14 / D-PL1-26 shared diagnostic vocabulary; no independent style finding. |
| IN-06: outer cascade rollback leaves package cache | The inner phase undo removes only its newly created tree; successful earlier members can leave a contained cache after outer rollback. This remains a recorded lifecycle follow-up, not proof that an installed plugin is currently broken. |
| IN-07: injected timeout differs from displayed constant | Production bindings still use the displayed 60 seconds; a different injected test runner is not a production defect. |
| IN-08: revision dropping all dependencies retains modules | The no-list/no-lockfile skip remains D-PL9-02/06 behavior. No separate active runtime failure was established from unused retained packages. |

D-PL9-08 is no longer a sanitizer deferral: registry-only rewritten inputs, integrity checks, supported lockfile checks, and npm's disabled-git argument are present. File symlinks fail the regular-file checks; source roots pass the existing containment guard before a package run. The documented lstat/read race, failed-restore policy, external-manager behavior and inherited user environment were considered as residual boundaries. They do not erase the concrete current findings above. This report makes no new upstream parity claim and does not treat the old SECURITY.md's stale “sanitizer not ported” statement as source truth.

Only this review artifact was changed. No source or test file was edited, no acceptance decision was rewritten, and no commit was made.

---

_Reviewed: 2026-10-29T01:15:37Z_
_Reviewer: gsd-code-reviewer_
_Depth: standard_
