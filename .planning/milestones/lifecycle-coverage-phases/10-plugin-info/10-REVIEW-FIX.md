---
phase: 10-plugin-info
review: 10-REVIEW.md
status: all_fixed_or_dispositioned
fixed: [CR-01, WR-01, WR-03, IN-01, IN-03]
dispositioned: [WR-02, IN-02, IN-04]
---

# Phase 10: Code Review Fix Report

| ID | Disposition | Change |
| --- | --- | --- |
| CR-01 | Fixed | The installed-plugin scenario republishes the marketplace offering `2.0.0` after the install and still expects `1.0.0`, so showing the offered version fails it. |
| WR-01 | Fixed (product bug) | `buildGitNotInstalledRow` and `buildInstalledGitRow` hand the resolver the tree the first probe returned (`() => Promise.resolve(presence)`), so `info --fetch` fetches once. The `--fetch` scenario now expects one GET and one POST. The unit test that relied on a second materialization now makes the fetched tree's manifest unreadable to reach the same catch arm. |
| WR-02 | Kept, by decision | Showing `version ?? sha` keeps a declared version, which pins a plugin upstream (plugins-reference `version`). Switching to sha-always broke 12 existing info unit contracts that show the declared entry version on warm git rows; that is a display-policy change for the user, not a parity fix. The comment now states the precedence exactly. Listed under "For the orchestrator" in the verification. |
| WR-03 | Fixed | Retitled: "Info on a partially available plugin reports an unsupported component and the skills an install would keep". |
| IN-01 | Fixed | The unreadable-warm-tree catch arm uses `warmVersion`. |
| IN-02 | Deferred | `list` shows only the entry version for a fetched git plugin; Phase 9's surface. |
| IN-03 | Fixed | New scenario: `info --fetch` on an installed plugin shows `{ghp revision 1}` after the repository moves, with one fetch. |
| IN-04 | Not changed | The pinned clone arm runs the same one-line expression; existing pinned `--fetch` tests cover the arm. |

Checks after the fixes: `node --test test/orchestrators/plugin/info.test.ts` 220/220; `npx cucumber-js features/plugin/info.feature` 10 scenarios, 91 steps passed.
