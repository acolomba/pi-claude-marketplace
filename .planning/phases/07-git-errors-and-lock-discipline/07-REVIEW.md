---
phase: 07-git-errors-and-lock-discipline
reviewed: 2026-10-29T13:29:35Z
reviewed_commit: 9bf40a1b691f79866733df7b3acd39d45a00d72e
depth: standard
files_reviewed: 42
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-plan.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-settle.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - features/lib/published-marketplace.ts
  - features/step_definitions/marketplace/update.steps.ts
  - test/orchestrators/plugin/clone-cache.test.ts
  - test/orchestrators/plugin/clone-gc.test.ts
  - test/orchestrators/plugin/dependency-bindings.test.ts
  - test/orchestrators/plugin/dependency-move.test.ts
  - test/orchestrators/plugin/dependency-plan.test.ts
  - test/orchestrators/plugin/dependency-settle.test.ts
  - test/orchestrators/plugin/install-clone-probe.test.ts
  - test/orchestrators/plugin/install-flow-cascade-context.test.ts
  - test/orchestrators/plugin/install-flow-dependency-ledger.test.ts
  - test/orchestrators/plugin/install-flow-planning.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/update-preflight.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
---

# Phase 7: Code Review Report

**Reviewed:** 2026-10-29T13:29:35Z
**Reviewed commit:** `9bf40a1b691f79866733df7b3acd39d45a00d72e`
**Depth:** standard
**Files Reviewed:** 42
**Status:** clean

## Summary

The complete retained 42-file Phase 7 implementation and its ownership-focused
test scope were reviewed on the final integrated Phase 1-10 tree. The review
traced the shared git classifier, scope-lock boundaries, state rechecks, clone
promotion and cleanup ownership, dependency-plan terminal sweeps, offline tag
fallback, monotonic update stamps, fetch/list row parity, and
error-redaction/output boundaries. It also checked later Phase 8-10 changes in
the Phase 7 owners, including dependency warning propagation, locked package
cleanup, apply recovery detail, and the shared cause-chain redactor.

The exact-candidate ownership model is the controlling design. It formally
supersedes Plan 07-02's broad clone-directory listing: restoring the broad
listing would let one operation delete an unrelated clone warmed concurrently.
Current cleanup targets only keys the operation can prove it owns, then
rechecks live state while holding the scope lock.

All reviewed files meet the required quality standard. No reproducible current
issue was found.

## Narrative Findings (AI reviewer)

No Critical, Warning, or Info findings.

## Prior Finding Closure

- **Classifier consolidation and output safety — closed.** Git transport,
  HTTP, missing-ref, pin, and unknown-host failures pass through the shared
  classifier. Unknown git failures use the deliberate network fallback, while
  filesystem errno values remain available to caller-specific local ladders.
  Fetch captures list-candidate read failures separately as unavailable rows.
  Raw causes stay on the internal cause chain and are redacted at the output
  boundary.
- **Lock discipline and TOCTOU — closed.** Unpinned fetch and info operations
  perform materialization and their dependent row read under the same scope
  lock. Marketplace refresh during plugin update, state transitions, cleanup,
  and later package-removal work use the required lock boundary without a
  nested acquisition. Lost-lock paths do not present a successful mutation.
- **Clone cleanup ownership — closed.** A materializer reports a key only
  after its atomic promotion returns `renamed`; warm hits and exact-key race
  losers never become owned. The recorded old key is eligible only as a
  superseded key. Terminal sweeps take a fresh scope lock, reload live state,
  route targets through `pluginCloneDir`, and cannot replace the operation's
  primary result.
- **Concurrent-cache safety — closed.** The deterministic controls preserve
  unrelated warm clones, warm exact-key hits, exact-key race winners, landed
  clones, and clones that another record references. Refused, backtracked, and
  failed plans remove only fresh keys created by that attempt.
- **Tag and network policy — closed.** Tag constraint resolution copies the
  chosen commit into the scope cache, reuses a warm sha-pinned copy offline,
  and reaches tag-list network seams only when the constraint requires it.
  Fetch and list derive rows through the same candidate rule.
- **Monotonic update state — closed.** Both update intent and completion write
  a replacement stamp through `nextUpdateStamp`; ordinary same-millisecond
  races therefore cannot retain the observed prior value.
- **Test-oracle defects — closed.** The ownership tests exercise production
  materializers and the production locked collector. Their negative controls
  prove that restoring broad enumeration or inserting an unowned prepared key
  deletes the protected clone and fails the test.
- **Integrated dependency diagnostics — closed.** The final-head settlement
  carrier retains each moved or freshly installed dependency's identity,
  ordering, and warnings through successful and refused update paths. A fresh
  install-cascade member deliberately carries its discovery half under
  D-PL10-16; moved dependencies retain both halves under D-PL10-12. The code
  does not collapse those two distinct contracts.

## Superseding Decision

The reviewed exact-candidate ownership repair supersedes the older Plan 07-02
broad-listing literal. The broad listing is historical plan text, not a current
acceptance requirement. GLK-01 through GLK-08 and the roadmap requirements are
satisfied by the current exact-key protocol; this review does not request or
permit reintroducing broad enumeration.

## Accepted and Deferred Scope

The recorded Phase 7 accepted and deferred items remain unchanged and are not
current findings: the broader cross-process preflight/finalize window, the
separately owned unlocked `previewInstall` paths, unlocked marketplace-source
deletes, mirror tag-fetch behavior, apply's historical dropped cause, raw
update-path causes, and the Phase 3 notification comment. None was changed by
the integrated-tree deltas reviewed here.

## Review Evidence

- Phase 7 Nyquist validation is **COMPLIANT** for GLK-01 through GLK-08.
- The exact reusable integrated full gate is green: 1145 Cucumber scenarios,
  11777 steps, and 309 LCOV records.
- Focused validation covers 16 Phase 7 owner modules; the Phase 7 integration
  slice is green at 99 scenarios / 1164 steps.
- Direct coverage remains 100% for every source/test pair in the combined
  gate.
- The later integrated deltas preserve the ownership callback, exact-candidate
  collector, lock boundary, and redaction boundary rather than bypassing them.

---

_Reviewed: 2026-10-29T13:29:35Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
