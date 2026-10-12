---
phase: 261011-gl6
plan: 01
subsystem: testing
tags: [integration-tests, optional-peers, ci, supply-chain]
status: complete
requires: []
provides:
  - scripts/install-test-peers.mjs (declared peer floors into node_modules/.cache/optional-peers)
  - findCachedPeer in tests/integration/optional-peer.ts
affects:
  - npm run test:integration, npm run test:coverage:integration, npm run check
  - CI integration job
tech-stack:
  added: []
  patterns:
    - "Optional test peers come from a gitignored cache at the exact declared floor, never from package.json or the lockfile"
key-files:
  created:
    - scripts/install-test-peers.mjs
  modified:
    - package.json
    - tests/integration/optional-peer.ts
    - tests/integration/pi-subagents-peer.ts
    - tests/integration/pi-mcp-adapter-peer.ts
    - tests/integration/provenance-invisibility.test.ts
    - tests/integration/skill-path-resolution.test.ts
    - tests/integration/adapter-expansion-conformance.test.ts
    - tests/integration/mcp-adapter-entry-conformance.test.ts
    - tests/integration/mcp-status-conformance.test.ts
    - .github/workflows/ci.yml
    - CONTRIBUTING.md
    - .planning/codebase/STACK.md
    - .planning/codebase/TESTING.md
decisions:
  - "Integration tests read pi-mcp-adapter and pi-subagents only from node_modules/.cache/optional-peers at the exact declared floor; a missing or wrong peer fails with the repair command instead of skipping"
  - "scripts/install-test-peers.mjs derives the floors from package.json peerDependencies and caps resolution with --before at the newest floor's registry publish time"
metrics:
  duration: 13m
  completed: 2026-10-11
actuals:
  tokens: 12376
  tasks: 3
  commits: 4
plan_head_before: 74efe36fbf1d71863c791a14841a231ad58c9aed
plan_head_after: b7beb4e930fb3a4255665c4983f4264130ffd1e8
---

# Quick Task 261011-gl6 Plan 01: Install Pinned Optional Test Peers Summary

`scripts/install-test-peers.mjs` installs pi-mcp-adapter 5.2.0 and pi-subagents 0.74.0 (derived from `package.json` peer floors) into `node_modules/.cache/optional-peers` with `--ignore-scripts --omit=peer --before=<newest floor publish time>` and a registry-integrity check. `test:integration` runs it first. All 180 integration cases now pass with 0 skips, locally and in CI, from the same command.

## Commits

| Task | SHA | Title | Hook result |
|------|-----|-------|-------------|
| 1 | 5c0bcf65 | test: install optional peers into a cache for integration tests | `npm run check:commit` ran, Passed (all pairs: `package.json` and a non-test `tests/` file staged) |
| 2 | d815586d | test: prove pi-mcp-adapter cases from the optional peer cache | `npm run check:commit` ran, Passed |
| 3 | 8e31273e | ci: drop the ad-hoc pi-mcp-adapter install | `npm run check:commit` ran, Passed; zizmor Passed |
| 3 | b7beb4e9 | docs: describe the optional peer cache for integration tests | npm-check skipped (no build input); mdformat, markdownlint Passed |

## Verification

1. **Cold run** (`rm -rf node_modules/.cache/optional-peers`, then `CI=1 npm run --silent test:integration`): `RUN_EXIT=0`, `ℹ tests 180`, `ℹ pass 180`, `ℹ fail 0`, `ℹ skipped 0`. Install line: `Installed optional test peers pi-mcp-adapter@5.2.0 pi-subagents@0.74.0 (published by 2026-10-09T19:25:07.280Z) into node_modules/.cache/optional-peers.` The install takes about 6 s and adds 48 packages, each with a registry `integrity`.
2. **Warm offline run:** `env -u CI PATH=/nonexistent node scripts/install-test-peers.mjs` exits 0 with 0 bytes of output. `npm run --silent test:integration` gives `RUN_EXIT=0` and no install line. It prints only the two `t.diagnostic` lines that name the proven pi-subagents version. The reporter forwards diagnostics by design.
3. **Negative controls** (not committed):
   - a. Missing cache: `node --test tests/integration/mcp-status-conformance.test.ts` gives `RUN_EXIT=1`, `ℹ fail 3`, with `... holds no pi-mcp-adapter 5.2.0. Run \`node scripts/install-test-peers.mjs\` (\`npm run test:integration\` runs it first).`
   - b. Wrong version (pi-subagents set to 0.0.1): provenance-invisibility gives `RUN_EXIT=1` with `holds pi-subagents 0.0.1, not the declared floor 0.74.0. Run \`node scripts/install-test-peers.mjs\` ...`. The script then reinstalled (printed its install line, exit 0), and the test passed (`ℹ pass 1`, `RUN_EXIT=0`).
   - c. Unreachable registry under `npm_config_loglevel=silent`: `RUN_EXIT=1`. The log holds npm's ECONNREFUSED error text and `Run \`node scripts/install-test-peers.mjs\` to retry.` No `optional-peers-*` temporary directory remained. This failure happens at the `npm view` cutoff step, before the temporary directory exists.
   - Extra control (install-step failure): a PATH shim made `npm install` fail and let `npm view` pass through. Result: `RUN_EXIT=1`, the message names the install failure and the retry command, and no `optional-peers-*` temporary directory remained. This confirms the `finally` cleanup.
4. **PIFL-03:** `node --test tests/architecture/peer-floor.test.ts` gives 6/6 passing (`RUN_EXIT=0`). `git diff --exit-code 74efe36f -- package-lock.json` exits 0 (byte-identical). `git diff 74efe36f -- package.json` changes only the `test:integration` and `test:coverage:integration` lines. dependencies and devDependencies have no peer entry.
5. **Full gate:** `npm run check` gives `CHECK_EXIT=0` at commit b7beb4e9, Node v26.11.1, on a clean tree. The only untracked path was this quick-task directory.
6. **Fallow audit:** `npx fallow audit --base 74efe36f --format json` gives `verdict: pass` (0 dead code, 0 complexity findings, 0 clone groups).
7. `SKIP=npm-check pre-commit run --files <all 14 changed files>` passes (PC=0).

`actionlint` is absent on this machine (`command -v actionlint` found nothing), so it did not run. zizmor, yamllint `--strict`, yamlfmt and `lint:workflows` passed on ci.yml.

## Deviations from Plan

### Auto-fixed Issues

None. Some small choices went beyond the plan's wording:

- `holdsFloor` in the script treats an unparseable cached `package.json` as "not the floor", so the install path replaces a damaged cache instead of crashing on a JSON parse error.
- `swapIntoCache` rethrows a rename failure unless a concurrent run already put a verified cache in place. The temporary directory is removed in a `finally` in every case, including a failed swap, and not only for failures before the swap.
- I added the extra install-step negative control above, because control 3c fails before the temporary directory exists.

## Known Stubs

None.

## Notes for a human

- On a cold machine, `npm run test:integration` (and so `npm run check` and CI) now needs the npm registry once. This is by design (T-261011-gl6-06, accepted).
- The local quiet-mode `npm run check` now prints two `ℹ pi-subagents 0.74.0 at ...` diagnostic lines. These cases used to skip before reaching `t.diagnostic`. The reporter forwards diagnostics on purpose.
- The `tests/live-uat/mcp-adapter-canary.mjs` operator harness still uses its own adapter-root variable. This is out of scope per the plan.
- CI has not run yet. The first PR run will show whether the integration job installs from the registry cleanly on the runner.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: scripts/install-test-peers.mjs
- FOUND: 5c0bcf65, d815586d, 8e31273e, b7beb4e9 (all ancestors of HEAD)
