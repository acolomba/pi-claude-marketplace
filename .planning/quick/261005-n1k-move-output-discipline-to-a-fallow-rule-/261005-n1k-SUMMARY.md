---
phase: 261005-n1k
plan: 01
subsystem: lint-gates
tags: [fallow, eslint, rule-pack, nfr-5, il-2, il-4]
status: complete
requires: []
provides:
  - rule-packs/architecture.json (eleven fallow call and import bans over the extension)
  - npm run fallow fails on any rule-pack WARN line
  - ESLint BLOCK F default-deny over orchestrators/ and domain/ with NETWORK_SEAMS
affects: [eslint.config.js, .fallowrc.json, package.json, .pre-commit-config.yaml, .github/workflows/ci.yml]
tech-stack:
  added: []
  patterns:
    - fallow rule pack for per-file call and import chokepoints
    - default-deny ESLint block with a named, reasoned ignores list
key-files:
  created:
    - rule-packs/architecture.json
  modified:
    - .fallowrc.json
    - package.json
    - .pre-commit-config.yaml
    - .github/workflows/ci.yml
    - eslint.config.js
    - skills/local-verification/SKILL.md
    - .planning/codebase/{ARCHITECTURE,CONVENTIONS,INTEGRATIONS,STACK,STRUCTURE}.md
    - 25 extension source files and 20 test files (comments only)
decisions:
  - The rule-pack empty-match WARN does not fail any fallow command, so the fallow npm script greps `fallow rule-pack test` output for `WARN.*rule pack` and exits 1 on a match.
  - "@earendil-works/pi-tui is not carried into the pack: BLOCK E never covered it and three edge/ files import it."
  - NETWORK_SEAMS is the 17-file list ESLint derives from BLOCK F's own rules with no ignores; it equals the planning list exactly.
metrics:
  duration: ~50 min
  completed: 2026-10-05
  tasks: 3
  files: 56
estimate:
  tokens: 175000
actuals:
  tokens: 28873
  tasks: 3
  commits: 3
plan_head_before: 04fa3741f9223b8b5b12479e04e7b9985ae23e3f
plan_head_after: d872f6de4317722b7e74e561d4e9675d609503ca
---

# Quick Task 261005-n1k: Move output discipline to a fallow rule pack Summary

A fallow rule pack (`rule-packs/architecture.json`, eleven rules) now owns the extension's stdio, console, notify, Pi peer, isomorphic-git, proper-lockfile, write-file-atomic, network-module, and `fetch` bans. `npm run fallow` fails when a rule matches no file. ESLint drops the duplicated rules, and BLOCK F (NFR-5) is default-deny over `orchestrators/` and `domain/` with 17 named seams.

## Commits

| # | SHA | Title | Hook (`npm run check:commit`) |
| --- | --- | --- | --- |
| 1 | dcce1e27 | build(fallow): add a rule pack for output and import chokepoints | Passed (package.json staged, all pairs) |
| 2 | cbddc367 | refactor(lint): leave output and import bans to the fallow pack | Passed (full lint with new config) |
| 3 | d872f6de | refactor(lint): make the NFR-5 git-surface gate default-deny | Passed |

All three task `<verify>` blocks print `task N ok` on the final tree.

## Evidence (last line of each log)

| File | Last line |
| --- | --- |
| tmp/n1k/rplist-1.log | RPLIST_EXIT=0 |
| tmp/n1k/rptest-1.exit | RPTEST_EXIT=0 (11 rules, 0 findings each, no rule-pack WARN) |
| tmp/n1k/deadcode-1.exit | DEADCODE_EXIT=0 (no policy violations, no `rule-packs-not-configured` diagnostic) |
| tmp/n1k/fallow-clean-1.log | FALLOW_CLEAN_EXIT=0 |
| tmp/n1k/plant-console-1.log | PLANT_CONSOLE_EXIT=1 |
| tmp/n1k/plant-fetch-1.log | PLANT_FETCH_EXIT=1 |
| tmp/n1k/plant-warn-1.log | PLANT_WARN_EXIT=1 |
| tmp/n1k/precommit-1.log / -2 / -3 | PRECOMMIT_EXIT=0 |
| tmp/n1k/commit-1.log / -2 / -3 | COMMIT_EXIT=0 |
| tmp/n1k/derive-seams-3.log | DERIVE_EXIT=0 (118 files, 17 seams) |
| tmp/n1k/plant-nfr5-3.log | PLANT_NFR5_EXIT=1 |
| tmp/n1k/audit-3.exit | AUDIT_EXIT=0 |
| tmp/n1k/check-final.log | exit=0 |

`tmp/n1k/rplist-1.log`:

```text
loaded config: <worktree>/.fallowrc.json
architecture (rule-packs/architecture.json): 11 s
  Call and import bans for extensions/pi-claude-marketplace/. A rule applies by file glob, so its exemption can name one file where a boundary zone could only name a directory.
  - no-stdio [error] banned-call: process.stdout.*, process.stderr.*
  - no-console [error] banned-call: console.*
  - migrate-console-warn-only [error] banned-call: console.assert ... console.trace (23 methods, all but warn)
  - debug-log-console-error-only [error] banned-call: console.assert ... console.warn (23 methods, all but error)
  - notify-chokepoint [error] banned-call: *.ui.notify
  - pi-peer-chokepoint [error] banned-import: @earendil-works/pi-coding-agent
  - isomorphic-git-chokepoint [error] banned-import: isomorphic-git
  - proper-lockfile-chokepoint [error] banned-import: proper-lockfile
  - write-file-atomic-chokepoint [error] banned-import: write-file-atomic
  - no-network-modules [error] banned-import: node:http, node:https, http, https, node:net, net, node:tls, tls, node:dgram, dgram, undici
  - fetch-chokepoint [error] banned-call: fetch, globalThis.fetch
RPLIST_EXIT=0
```

(Each rule's message line is omitted here; the messages match Target text A.) The console method list was derived on Node v26.10.0: 24 functions, from `assert` to `warn`.

## Derived seam list

`tmp/n1k/seams-derived-3.txt` (17 files, identical to the 17 paths of fact 6, no difference):

```text
extensions/pi-claude-marketplace/domain/auth-registry.ts
extensions/pi-claude-marketplace/domain/github-auth.ts
extensions/pi-claude-marketplace/orchestrators/auth-host.ts
extensions/pi-claude-marketplace/orchestrators/import/execute.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
```

The Task 3 verify proved through the ESLint API that the exempt files equal both this list and the files BLOCK F's own rules flag, and that `edge/router.ts` gets no `no-restricted-imports`. Each seam's reason was checked against the file's own header. `update-preflight.ts` carries no PUP-2 token itself; its reason keeps PUP-2, the ID the old exemption comment in `eslint.config.js` used for it.

## Plant results

- Console plant (`orchestrators/plugin/info.ts`): `info.ts:2973 console.log banned by architecture/no-console`, exit 1.
- Fetch plant (`orchestrators/plugin/list-flow.ts`): `list-flow.ts:814 fetch banned by architecture/fetch-chokepoint`, exit 1.
- Warning plant (`debug-log-console-error-only` pointed at `shared/n1k-missing.ts`): `WARN rule pack 'architecture': rule 'debug-log-console-error-only' has files globs that matched no analyzed file; the rule currently enforces nothing`, exit 1. The pack was restored and `cmp` matched.
- NFR-5 plant, gated orchestrator (`info.ts`, `import "../../platform/git.ts";`): `'../../platform/git.ts' import is restricted from being used by a pattern. NFR-5: network-free modules must not import a platform/git module, type-only imports included. Reach git through orchestrators/plugin/clone-cache.ts by entrypoint name  no-restricted-imports`.
- NFR-5 plant, gated domain file (`domain/plugin-resolver.ts`, `export const n1kPlant = "gitOps";`): `NFR-5: network-free modules must not spell gitOps, DEFAULT_GIT_OPS, or refreshGitHubClone in a string  no-restricted-syntax`.

No plant was committed.

## Warning gate

fallow 3.27.0 writes the empty-match `WARN rule pack ...` line to stderr and still exits 0, in `fallow dead-code --fail-on-issues` and in `fallow rule-pack test`, and the JSON has no field for it. So the `fallow` script starts with:

```sh
if fallow rule-pack test --quiet 2>&1 | grep 'WARN.*rule pack'; then exit 1; fi;
```

`fallow rule-pack test` analyzes the same file set as the production-mode dead-code run, costs under a second, and prints the WARN line when it fails. Grepping the dead-code run's own stderr would need a temp file to keep its exit code, because `/bin/sh` has no `pipefail`. The pattern is case-sensitive and names a rule pack, so unrelated fallow WARN lines (worktree entry points, graph cache) and the rule id `migrate-console-warn-only` on stdout do not trip it. The WARN line carries ANSI color codes; `.*` spans them.

## Final check

- Command: `npm run check > tmp/n1k/check-final.log 2>&1; echo "exit=$?" >> tmp/n1k/check-final.log` (own command, not piped), `CI` unset.
- Result: `exit=0` on commit `d872f6de4317722b7e74e561d4e9675d609503ca`, Node `v26.10.0`, in the executor worktree.
- `npx fallow audit --base origin/main --format json --quiet`: verdict `pass`, exit 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The Task 3 NFR-5 plant restored info.ts from a byte copy, not with `git checkout`**
- **Found during:** Task 3 step 6
- **Issue:** Step 4 edits `info.ts` comments before step 6 plants into it. Restoring with `git checkout -- info.ts` would have discarded the uncommitted E2 edits.
- **Fix:** `tmp/n1k/plant-3.sh` copies `info.ts` and `plugin-resolver.ts` to `tmp/n1k/*.bak`, plants, runs ESLint, copies back, and checks both with `cmp`. `plugin-resolver.ts` also showed a clean `git diff`.
- **Files modified:** none beyond the plan.
- **Commit:** d872f6de

### Execution-environment notes

- The worktree sandbox refuses compound shell lines that run git (`cd ... &&`, pipes into bash). Every multi-command step ran as a `tmp/n1k/*.sh` script through `bash tmp/n1k/<name>.sh`, as the plan's execution rules already require.
- The three `<verify>` blocks were extracted verbatim from the plan into `tmp/n1k/verify-{1,2,3}.sh` and run with bash.
- The `PLAN_HEAD_BEFORE` ledger file was not written to the git dir. The base is `tmp/n1k/start-1.sha` = `04fa3741`, and `git rev-list --count 04fa3741..HEAD` = 3.
- STATE.md, ROADMAP.md, and the docs commit are left to the orchestrator, per the task constraints.

## Flags for the operator

- Gaps that stay open by design: a dynamic `import()` of a banned module, an aliased `fetch` (`const f = fetch; f()`), and `http2`/`node:http2` (not on the list).
- The warning check reads fallow's message text. Re-prove it after each fallow upgrade: point one companion rule at a missing file and confirm that `npm run fallow` fails (CONVENTIONS records this).
- The tests and scripts ESLint blocks keep `no-restricted-syntax: "off"` lines that no longer override anything.
- The dated `docs/adr/` and `docs/competitive-analysis/` files and CHANGELOG.md still describe the ESLint gates. STACK.md's "~400 lines" for `eslint.config.js` was already stale.
- `shared/README.md` still says that shared/ imports from no other extension folder, while it imports platform types (an older inconsistency).
- The `fallow-audit` CI job loads the pack from the next push on.
- REVIEW.md is left to the orchestrator.
- A merge does not run the hook: after the worktree merges, the main checkout needs `npm run check`, or reuse of this result under the local-verification rule (same inputs, commit `d872f6de`, Node v26.10.0).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: rule-packs/architecture.json
- FOUND: dcce1e27, cbddc367, d872f6de (all ancestors of HEAD)
- `task 1 ok`, `task 2 ok`, `task 3 ok` on the final tree
