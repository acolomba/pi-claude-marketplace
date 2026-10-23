---
phase: 19-import-on-the-reconcile-path
status: passed
verified: 2026-10-23
requirements: [IMP-05, IMP-06, IMP-07]
---

# Phase 19: Import on the Reconcile Path - Verification

## Success criteria

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `import` installs, enables, and adds marketplaces through the reconcile desired-state path; an installed plugin is not reinstalled (IMP-05) | passed | `executeScopedPlan` runs a locked, write-free read pass that calls reconcile's `planReconcile` with reconcile's `buildScopeSatisfactionVerdict`, then drives the orchestrated add, install, and enable operations. Scenarios: "Importing a plugin of a marketplace the scope already holds installs the plugin under the skipped marketplace", "Importing a plugin the scope holds disabled enables it instead of reinstalling it". Unit: enable arms, production enable, promotion cases. |
| 2 | A second `import` reports each plugin `skipped {already installed}` and each marketplace as a skipped no-op, at `info` (IMP-06) | passed | Scenario "Importing the same claude code settings a second time skips the marketplace and the plugin it already holds": header `(skipped) {already added}`, plugin `skipped {already installed}`, severity `info`, no reload. Catalog state `repeat-import-skips`. |
| 3 | `import` under a held state lock fails with `lock held` and its cause chain, and changes nothing (IMP-07) | passed | Scenario "Importing while another process holds the state lock of the scope fails as lock held and changes nothing": `lock held` row with the two-link chain, no state.json, no checkout, no config. Unit: read-pass lock (real proper-lockfile lock) and mid-import lock races for add, install, and enable. Catalog state `lock-held`. |
| 4 | `npm run check` stays green | passed | Full `npm run check` in this worktree, exit 0: typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features, test:unpaired, test:integration, 705/705 cucumber scenarios, direct coverage of every pair (execute.ts 100%). |

## Code review

19-REVIEW.md: 1 critical, 4 warnings, 4 info. 19-REVIEW-FIX.md: CR-01 and all
warnings fixed; IN-03 partly fixed (a self-compared cause chain kept, with its
message asserted separately).

## For the user

- Product change to confirm: import now ENABLES a plugin the scope holds disabled when the Claude Code settings enable it (IMP-05 says "enables"); before, it reported `skipped {already installed}` and left it disabled.
- Vocabulary change: new shared reason `already added` (Claude Code's "already added; nothing changed" wording), appended to the closed reason set, wire schema regenerated; catalog pins bumped to 293 states, which may conflict with phases 16/17 if they add catalog states (renumber on merge).
- Deferred: a settings marketplace the scope records only under another name with the same source still fails as `duplicate name` (pre-phase behavior); following the claim needs a config-key design so the next reload keeps the plugin.
- Parity gap, out of scope: `marketplace add` of an already-added source fails `duplicate name`, while Claude Code says "already added; nothing changed".
- Inconsistency, out of scope: `bootstrap` still reports an existing marketplace as `(updated)`; import now uses `(skipped) {already added}`.
- Tech debt: import's enable row is always `(installed)`; reconcile renders a re-enabled partial record as `(partially-installed)` with its dropped kinds, which import's row set lacks.
- Not covered at import level: the dependency-held skip (WR-01 fix) relies on reconcile's verdict and planner tests; no import-specific test seeds a held dependency.
