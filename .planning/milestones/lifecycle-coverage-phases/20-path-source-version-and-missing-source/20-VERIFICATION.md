---
phase: 20-path-source-version-and-missing-source
status: passed
requirements: [VER-02, SRC-01]
verified: 2026-10-23
---

# Phase 20 Verification: Path-Source Version and Missing Source

## Success criteria

| # | Criterion | Status | Evidence |
| - | --------- | ------ | -------- |
| 1 | A path-source plugin whose plugin.json declares a version different from its entry shows plugin.json's version in `list`, `info`, and after `install` (VER-02) | VERIFIED | `list.feature` "The list shows the version a path-source plugin's plugin.json declares over its entry's" (2.0.0 over entry 1.0.0); `info.feature` "Info on a path-source plugin shows the version its plugin.json declares over its entry's"; `install.feature` "Installing a path-source plugin records the version its plugin.json declares over its entry's" (row and installation record 1.0.0 over entry 0.9.0). Unit: `list-candidate-row.test.ts` VER-02 cases (available, partially-available, unavailable keeps entry); `info.test.ts` VER-02 cases (available, partially-available). Mutation: reverting the four source files fails the list and info version scenarios; reverting only the partially-available `version: treeVersion` in `info.ts` fails the new unit test. |
| 2 | A path-source plugin whose directory is missing reads `{source missing}` in `info`, `install`, and `list` (SRC-01) | VERIFIED | Scenarios in all three features read `source missing` (install renders `(unavailable) {source missing}`). `cross-surface-reason-parity.test.ts` pins install and read-only equality, including a path that contains `lspServers` (review CR-01). Mutation: with the sources reverted, all three missing-source scenarios fail with `unsupported source`. |
| 3 | `npm run check` stays green | VERIFIED | `npm run check` exit 0 on the final tree: static checks (typecheck, ESLint, fallow, Prettier, pairing), unpaired and integration tests, 719/719 cucumber scenarios, and 100% direct coverage (`coverage/direct.lcov`, 280 records). |

## Phase 10 deferred item

"`list` shows only the entry version for a fetched git plugin whose entry
declares none" was already fixed by VER-01 (Phase 16 D-10). The new
`list.feature` scenario "The list shows the plugin.json version of a fetched
git-source plugin whose entry declares none" pins it (it also passes on the
pre-phase code, as expected).

## Existing tests updated for the intended change

- `test/architecture/manifest-read-agreement.test.ts`: `info` now shows the
  bare manifest's `9.9.9`, the version `resolvePluginVersion` already
  returned, instead of the entry's `1.0.0`.
- `test/edge/handlers/plugin/list.test.ts`: path candidate rows now carry
  their plugin.json version per scope.
- `test/edge/handlers/tools.test.ts`, `test/orchestrators/plugin/list-flow.test.ts`,
  `list-candidate-row.test.ts`: a missing directory reads `source missing`.

## Code review

`20-REVIEW.md`: 1 critical, 2 warnings, 4 info. `20-REVIEW-FIX.md`: CR-01,
WR-02, IN-01, IN-03, IN-04 fixed; WR-01 kept by decision; IN-02 no change.

## For the user

- Decision: a path plugin that resolves `unavailable` with its directory present (for example a malformed `hooks.json`) shows the entry version, while a warm git tree in the same state shows plugin.json's (review WR-01, CONTEXT D-02); say if you want path rows to read plugin.json there too.
- Divergence: read-only rows of a path plugin that declares no version anywhere show no version, while install records `hash-<12hex>` (D-04); computing the hash on every `list` row walks the plugin tree.
- Follow-up bug: `list`'s installed-row `upgradable` check (`list-installed-row.ts`) compares the marketplace entry version with the record, not plugin.json's, so a path plugin whose plugin.json and entry disagree can show `upgradable` while `update` reports it unchanged (and the reverse); left for the update work (phases 18/25-26).
- Out of scope: `reinstall` reports a missing path directory as `source mismatch` and `update` as `no longer installable`; SRC-01 names only list, info, install.
- Process: planning, execution, and verification ran inline in the phase session (one small plan), with the code review done by a separate reviewer agent.
- Worktree setup: `node_modules` was empty at start; `scripts/init.sh` was rerun.
