---
phase: 04-variable-expansion-at-claude-code-parity
plan: 08
subsystem: testing
tags: [mcp, conformance, ci, security, optional-peer]
status: complete

requires:
  - phase: 04-03
    provides: "The deny-list rows of tests/bridges/mcp/expansion-cases.ts and substituteAndInject with Claude's deny arm"
  - phase: 04-06
    provides: "package.json peerDependencies pi-mcp-adapter >=5.1.0 <6, the range the adapter helper checks"
provides:
  - "tests/integration/optional-peer.ts: OptionalPeer, readOptionalPeer, readDeclaredPeerRange, readPeerFloor, importPeerModule"
  - "tests/integration/pi-mcp-adapter-peer.ts: findPiMcpAdapterPackage (PI_MCP_ADAPTER_ROOT only, range-checked), loadPiMcpAdapterModule, readPiMcpAdapterDist, PiMcpAdapterUtils, PiMcpAdapterAuthFlow"
  - "tests/integration/adapter-expansion-conformance.test.ts: 39 case rows, url refusal, 462,790-value property, AVAR-05 security property, dist drift guard, ~/ premise"
  - "CI integration job installs pi-mcp-adapter@5.1.0 into $RUNNER_TEMP and sets PI_MCP_ADAPTER_ROOT"
affects: [04-09]

actuals:
  tokens: 8091
  tasks: 3
  commits: 1
plan_head_before: 1ae93f715a67698f99bf3996509ebd766bd341cf
plan_head_after: f9bf9a0a3e2c45af4c8063da437b331732dbcf0d

tech-stack:
  added: []
  patterns:
    - "An optional peer is found only through an operator-named root variable; a set root that is missing, another package, or out of the declared range throws, so CI cannot pass by skipping"
    - "Conformance against a peer runs its real compiled functions, plus a dist text drift guard on the call sites the extension relies on"

key-files:
  created:
    - tests/integration/optional-peer.ts
    - tests/integration/pi-mcp-adapter-peer.ts
    - tests/integration/adapter-expansion-conformance.test.ts
  modified:
    - tests/integration/pi-subagents-peer.ts
    - .github/workflows/ci.yml

key-decisions:
  - "The CI install line carries `# zizmor: ignore[adhoc-packages]`: PIFL-03 keeps the optional peer out of every lockfile, so zizmor's lockfile rule cannot be met; the exact pin and --ignore-scripts are the mitigation"
  - "The bounded-exhaustive property asserts exactly 462,790 checked values (the deterministic count of both alphabets), which is stronger than the plan's at-least-462,000"
  - "pi-subagents-peer.ts keeps every export; PiSubagentsPeer is now a type alias of OptionalPeer and an absent PI_SUBAGENTS_ROOT package.json reports `<root> holds no package.json`"

patterns-established:
  - "tests/integration/optional-peer.ts is the shared identity, range and loader helper for every optional-peer integration test"

requirements-completed: [AVAR-03, AVAR-05]

coverage:
  - id: D1
    description: "Every shared expansion case row comes out of pi-mcp-adapter 5.1.0's real call chain for its field as Claude Code's value"
    requirement: AVAR-03
    verification:
      - kind: integration
        ref: "tests/integration/adapter-expansion-conformance.test.ts#AVAR-03: <row title> comes out of pi-mcp-adapter as Claude Code's value (39 cases)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A url split token is refused without PI_CLAUDE_MARKETPLACE_EMPTY and resolves with it set to empty"
    requirement: AVAR-03
    verification:
      - kind: integration
        ref: "tests/integration/adapter-expansion-conformance.test.ts#AVAR-03: a url split token needs PI_CLAUDE_MARKETPLACE_EMPTY set"
        status: pass
    human_judgment: false
  - id: D3
    description: "462,790 short adversarial values through the real interpolateEnvVars give Claude's value with zero mismatches"
    requirement: AVAR-03
    verification:
      - kind: integration
        ref: "tests/integration/adapter-expansion-conformance.test.ts#AVAR-03: pi-mcp-adapter outputs Claude's value for every short adversarial value"
        status: pass
    human_judgment: false
  - id: D4
    description: "No deny-listed credential sentinel reaches pi-mcp-adapter's url or headers output, set or unset at install (90 runs)"
    requirement: AVAR-05
    verification:
      - kind: integration
        ref: "tests/integration/adapter-expansion-conformance.test.ts#AVAR-05: no deny-listed credential reaches pi-mcp-adapter's url or headers output"
        status: pass
    human_judgment: false
  - id: D5
    description: "A drift guard pins the four server-manager call sites, the three interpolation passes in order, the !! branch and the two OAuth interpolations"
    requirement: AVAR-03
    verification:
      - kind: integration
        ref: "tests/integration/adapter-expansion-conformance.test.ts#AVAR-03: pi-mcp-adapter's call sites and interpolation passes are the ones the escape relies on"
        status: pass
    human_judgment: false
  - id: D6
    description: "CI's integration job installs exactly pi-mcp-adapter@5.1.0 with --ignore-scripts and runs the conformance test with zero skips"
    requirement: AVAR-03
    verification:
      - kind: other
        ref: "npm run lint:workflows; pre-commit zizmor, yamllint and yamlfmt on .github/workflows/ci.yml"
        status: pass
    human_judgment: true
    rationale: "The zero-skip CI run happens only when a pull request runs the integration job; the local zero-skip run reproduces it with the same pinned install, but the CI log itself is not observable until then"

duration: 14min
completed: 2026-10-07
---

# Phase 4 Plan 08: pi-mcp-adapter conformance proof Summary

**Every shared MCP expansion case, 462,790 short adversarial values and a deny-listed-credential property now run through pi-mcp-adapter 5.1.0's real `dist/` functions, with a drift guard on the adapter code the escape relies on; the CI `integration` job installs the pinned adapter into `$RUNNER_TEMP` and runs them with zero skips.**

## Performance

- **Duration:** about 14 min for Tasks 2 and 3 (Task 1, the checkpoint, ran in an earlier executor)
- **Started:** 2026-10-07T19:30:53Z
- **Completed:** 2026-10-07T19:45Z
- **Tasks:** 3 (Task 1 checkpoint, Tasks 2 and 3 in one commit, as the plan directs)
- **Files modified:** 5 (3 created, 2 modified)

## Package-legitimacy checkpoint (Task 1)

The human operator answered **"Approved"** on 2026-10-07 to "Approve pi-mcp-adapter@5.1.0 for the scratch install that plan 04-08's conformance test needs?". `test ! -e /var/tmp/mcp4-p4-08/adapter` held until the approval: this executor confirmed the prefix was absent before it ran the first install.

The approval was based on this read-only output (command `npm view pi-mcp-adapter@5.1.0 name version dist.integrity scripts repository.url maintainers time.5.1.0 dist.tarball --json`, exit 0; `time.5.1.0` printed nothing because npm reads the dotted key as a nested path; the research audit dates the publish 2026-10-06):

- name `pi-mcp-adapter`, version `5.1.0`
- dist.integrity `sha512-2oIaOK5YG+rwgnQMyLwcvok+1PAqpUGtFZBG9c5fn0TZyutXkAHBXUiIZB0FukFbuGHgOEgGG5QvbZSYfMYnSw==`
- scripts: `test`, `prepack` (`npm run build:public`), `typecheck`, `test:oauth`, `test:watch`, `test:vitest`, `build:public`, `test:coverage`, `test:conformance`, `test:oauth-provider`, `test:public-exports`; no `preinstall`, `install` or `postinstall`
- repository.url `git+https://github.com/nicobailon/pi-mcp-adapter.git`
- maintainers `["nicopreme <nico.bailon@gmail.com>"]`
- dist.tarball `https://registry.npmjs.org/pi-mcp-adapter/-/pi-mcp-adapter-5.1.0.tgz`

Plan checks: the integrity starts `sha512-2oIaOK5Y` and ends `MYnSw==`; no install-time scripts; the repository is nicobailon/pi-mcp-adapter; `package.json` `peerDependencies["pi-mcp-adapter"]` is `>=5.1.0 <6`.

Scratch install after approval: `npm install --prefix /var/tmp/mcp4-p4-08/adapter pi-mcp-adapter@5.1.0 --ignore-scripts --omit=peer --no-audit --no-fund` (exit 0, 43 packages); `node -p "require('/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter/package.json').version"` printed `5.1.0`.

## Accomplishments

- `tests/integration/optional-peer.ts`: the generic identity check, declared range, floor and file-URL loader, parameterized by package name (PIFL-02, PIFL-03).
- `tests/integration/pi-subagents-peer.ts`: same exports and the `npm root -g` fallback, now built on the shared helper; its two consumers are unchanged.
- `tests/integration/pi-mcp-adapter-peer.ts`: `PI_MCP_ADAPTER_ROOT` is the only lookup; a set root that is missing, another package, or outside `>=5.1.0 <6` throws.
- `tests/integration/adapter-expansion-conformance.test.ts` (44 cases): 39 case-table rows through `resolveConfigPath`, `expandHomePath(interpolateEnvVars())`, `resolveCommandSecret` (single leading `!` refused before the call), `resolveServerUrl` and `extractOAuthConfig`; the url refusal; the bounded-exhaustive property; the AVAR-05 property over 8 credentials, 6 forms and both install states (90 runs, url and headers); the dist drift guard; the `~/` home-expansion premise.
- `.github/workflows/ci.yml`: step `Install the pinned pi-mcp-adapter peer` and `PI_MCP_ADAPTER_ROOT: ${{ runner.temp }}/pi-mcp-adapter/node_modules/pi-mcp-adapter` on `Run the integration tests`.

## Task Commits

1. **Task 1: Confirm pi-mcp-adapter 5.1.0 is the legitimate package** - no commit (checkpoint, approved)
2. **Task 2: Every shared expansion case runs through the pinned adapter** - `f9bf9a0a`
3. **Task 3: url refusal, property, security property, drift guard, runs, commit** - `f9bf9a0a` (test)

Tracer gate (Task 2): `workflow.auto_advance` is false, `workflow.human_verify_mode` is `end-of-phase`, the tracer has no `gate` attribute and its `<verify>` is automated-only, so the verify was re-run (exit 0, 39 pass, 0 skipped) and execution expanded with no checkpoint.

## Verification

Node v26.10.0. All commands from the repo root. Commit `f9bf9a0a`.

| Command | Exit | Notes |
|---|---|---|
| Task 2: `npm run typecheck && npm run lint:workflows && PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter node --test --test-reporter=tap tests/integration/adapter-expansion-conformance.test.ts > tmp/p4-08-tracer.tap; grep -qx '# fail 0' ... && grep -qx '# skipped 0' ... && ! grep -qx '# pass 0' ...` | 0 | tracer: 39 tests, 39 pass, 0 fail, 0 skipped |
| Task 3 verify 1 (zero-skip run, on `f9bf9a0a`): `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter node --test --test-reporter=tap tests/integration/adapter-expansion-conformance.test.ts > tmp/p4-08-conformance.tap` then the three greps | 0 | `# tests 44`, `# pass 44`, `# fail 0`, `# skipped 0`; adapter 5.1.0 |
| Task 3 verify 2: `! PI_MCP_ADAPTER_ROOT=/nonexistent node --test tests/integration/adapter-expansion-conformance.test.ts > /dev/null 2>&1` | 0 | the negative run itself exits **1**: 44 fail with `/nonexistent holds no package.json` |
| Task 3 verify 3: `TMPDIR=/var/tmp/mcp4-p4-08 npm run test:integration && test "$(tail -n 1 tmp/p4-08-precommit.log)" = PRECOMMIT_EXIT=0 && git log -1 --format=%s` | 0 | printed `test(mcp): prove the variable escape against pi-mcp-adapter in CI` |
| `PI_MCP_ADAPTER_ROOT=... TMPDIR=/var/tmp/mcp4-p4-08 CI=1 npm run test:integration` | 0 | 120 tests, 118 pass, 0 fail, 2 skipped (the two pi-subagents tests: the global pi-subagents is 0.47.1, below the 0.74.0 floor) |
| `node --test tests/integration/adapter-expansion-conformance.test.ts` (variable unset) | 0 | 44 skipped |
| `PI_MCP_ADAPTER_ROOT=<repo root> node --test ...conformance.test.ts` (another package) | 1 | fails, as designed |
| `PI_MCP_ADAPTER_ROOT=<scratch dir with pi-mcp-adapter 4.9.0 package.json> node --test ...conformance.test.ts` | 1 | `... holds pi-mcp-adapter 4.9.0, outside the declared peer range >=5.1.0 <6` |
| `TMPDIR=/var/tmp/mcp4-p4-08 node --test tests/integration/provenance-invisibility.test.ts tests/integration/skill-path-resolution.test.ts` | 0 | 2 skipped (global 0.47.1 below floor), same as before the refactor |
| Same two files with `PI_SUBAGENTS_ROOT=~/.cache/pi-cm-phase3-research/rt/node_modules/pi-subagents` (an existing 0.74.0 install; nothing new installed) | 0 | 2 pass, 0 skipped: the refactored loader imports pi-subagents' modules |
| `PI_SUBAGENTS_ROOT=/nonexistent node --test tests/integration/provenance-invisibility.test.ts` | 1 | a bad override still fails |
| `BASE=$(cat tmp/p4-08-base) && npx fallow audit --base "$BASE"` | 0 | `No issues in 5 changed files` |
| `npm run lint:workflows` | 0 | no missing `--ignore-scripts` |

- A scratch negative control (not committed) wrote the property's segments without the escape and counted 4,687 mismatches over the second alphabet, so the property's oracle discriminates.
- `tmp/p4-08-precommit.log` ends with `PRECOMMIT_EXIT=0`. The first run failed zizmor `adhoc-packages` (see Deviations); the second run was clean with no fixer rewrites.
- Commit `f9bf9a0a` hook: `npm run check:commit....Passed` (direct coverage for all pairs, because the commit stages test support under `tests/`), `zizmor....Passed`, `gitlint....Passed`.

Focused task verification passed; full phase/PR verification pending.

## Files Created/Modified

- `tests/integration/optional-peer.ts` - shared optional-peer identity, range, floor and loader helpers
- `tests/integration/pi-mcp-adapter-peer.ts` - env-var-only adapter lookup with the range check, dist loader and dist reader, adapter function types
- `tests/integration/adapter-expansion-conformance.test.ts` - the AVAR-03 and AVAR-05 conformance proof
- `tests/integration/pi-subagents-peer.ts` - rebuilt on optional-peer.ts with unchanged exports
- `.github/workflows/ci.yml` - pinned scratch install of the adapter and `PI_MCP_ADAPTER_ROOT` on the integration test step

## Decisions Made

- The case-table titles keep the row's own requirement prefix after the plan's `AVAR-03:` prefix, as the plan's title template gives (`AVAR-03: AVAR-01: command ... comes out of pi-mcp-adapter as Claude Code's value`).
- The AVAR-05 property collects every leak and asserts `{ runs: 90, leaks: [] }` in one case, so one failure does not hide the others and an empty run list cannot pass.
- The drift guard reads `resolveCommandSecret`, `interpolateEnvVars` and `extractOAuthConfig` from their own function text (from `export function <name>(` to the next export), so a matching string elsewhere in the file cannot satisfy it.
- `adapterOutput` lists every `ExpansionField` member and has no `default`, as the project's `switch-exhaustiveness-check` configuration requires.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] zizmor `adhoc-packages` failed on the pinned install step**
- **Found during:** Task 3 (pre-commit)
- **Issue:** zizmor 1.30.1 reports any `npm install <pkg>` outside a lockfile (low severity, high confidence). The plan's step is exactly that, by design: PIFL-03 keeps the optional peer out of `package.json` dependencies and every lockfile.
- **Fix:** a trailing `# zizmor: ignore[adhoc-packages]` on the `run:` line, and a comment above the step saying why the install has no lockfile. The step keeps the exact pin and `--ignore-scripts`. It is the repository's first zizmor suppression. Committing a separate lockfile for the peer and using `npm ci --prefix` would pin the transitive dependencies too; that is a larger change, so it is left for the operator.
- **Files modified:** `.github/workflows/ci.yml`
- **Verification:** pre-commit zizmor Passed; `npm run lint:workflows` exit 0
- **Committed in:** `f9bf9a0a`

**2. [Rule 2 - Stronger check] Exact checked-value count**
- **Found during:** Task 3
- **Issue:** the plan asks for at least 462,000 checked values. The count is deterministic (231,395 sequences, two variants each).
- **Fix:** the property asserts exactly `462_790`, which still contains "462" and also catches an enumerator that over-counts.
- **Files modified:** `tests/integration/adapter-expansion-conformance.test.ts`
- **Committed in:** `f9bf9a0a`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 stronger check)
**Impact on plan:** No scope change. The zizmor suppression should be reviewed by the operator.

## Issues Encountered

- The developer machine's global pi-subagents (0.47.1) and the pi-runtime cache copy (0.71.0) are below the 0.74.0 floor, so the two pi-subagents tests skip by default. The research cache's 0.74.0 install proved the refactored helper through `PI_SUBAGENTS_ROOT`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. The CI scratch install is T-04-SC, the `!` guard is T-04-22, the drift guard and properties are T-04-23, the env-var-only lookup and negative run are T-04-24, and `withProcessEnv` is T-04-25.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 04-09 can cite this conformance test as the proof for MENVX-01 (a leading `!` becomes `!!`).
- AVAR-03 stays pending until 04-09, which also declares it.
- A floor change in `package.json` must move the `ci.yml` pin too; the range check fails CI if they disagree.

## Self-Check: PASSED

- FOUND: tests/integration/optional-peer.ts, tests/integration/pi-mcp-adapter-peer.ts, tests/integration/adapter-expansion-conformance.test.ts, tests/integration/pi-subagents-peer.ts, .github/workflows/ci.yml
- FOUND: commit f9bf9a0a on HEAD's history; no file deletions; no untracked files
- Acceptance greps: `findPiMcpAdapterPackage` export present and no `npm root -g` in pi-mcp-adapter-peer.ts; one `pi-mcp-adapter@5.1.0 --ignore-scripts` line and one `PI_MCP_ADAPTER_ROOT: ${{ runner.temp }}` line in ci.yml; the `EXPANSION_CASES` loop; three property titles; the `462` count

---
*Phase: 04-variable-expansion-at-claude-code-parity*
*Completed: 2026-10-07*
