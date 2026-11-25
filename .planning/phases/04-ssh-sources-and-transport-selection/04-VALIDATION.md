---
phase: "4"
slug: "ssh-sources-and-transport-selection"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-25"
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` (unit, architecture, integration); `@cucumber/cucumber` (profiles `adapter`, `builtin`) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `PATH="/opt/pi-claude-marketplace/bin:$PATH" node --import "$PWD/scripts/isolated-pi-home.mjs" --test <test-path>`; one scenario: `node scripts/cucumber.mjs --profile adapter <feature> --name '<title>'` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~30 seconds per owner test file; one feature file under both profiles 1 to 10 minutes; full ~40 minutes |

---

## Sampling Rate

- **After every task commit:** the pre-commit hook (`npm run check:commit`) plus the owner tests of the touched source-test pairs, and the whole unit and integration suites before the plan's SUMMARY (the commit hook runs only staged pairs)
- **After every plan wave:** `npm run check` on the combined tree (the GSD post-merge gate)
- **Before `/gsd-verify-work`:** full suite must be green
- **Max feedback latency:** 120 seconds for owner unit runs

---

## Per-Task Verification Map

One row per task of plans 04-01 to 04-15 (40 tasks, waves 1 to 9). The Requirement column is the plan's `requirements` list; the Threat Ref column is the plan's range of `T-04-NN` threats (each plan also keeps `T-04-SC`); the command column names the test and feature files of the task's `<automated>` commands, whose full text, with its `fails_when` line, is in the plan. File Exists is measured on the tree the plans were written against: `❌ W0` means the task creates a file it runs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | SG-SSH-01 | T-04-01..05 | An scp address parses as a url source, the add clones it over SSH through the stand-in, and the launches table pins git's transport launch. | cucumber, unit | `test/domain/git-url.test.ts test/domain/source.test.ts test/orchestrators/auth-host.test.ts features/marketplace/ssh-source.feature` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-01-02 | 01 | 1 | SG-SSH-01 | T-04-01..05 | Every git address form follows upstream's validator, F-2 is closed at parse, and a plugin url source over SSH installs through the stand-in. | cucumber, unit | `test/domain/git-url.test.ts test/domain/source.test.ts features/plugin/ssh-source.feature features/plugin/git-source.feature` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-01-03 | 01 | 1 | SG-SSH-01 | T-04-01..05 | The command line refuses the URL-scheme SSH forms with upstream's text, config, apply, and import accept them, F-5 is closed, and every suite passes. | cucumber, integration, unit | `test/orchestrators/marketplace/add.test.ts test/edge/handlers/marketplace/add.test.ts test/orchestrators/import/marketplaces.test.ts features/marketplace/uns...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-02-01 | 02 | 1 | SG-SSH-02, SG-SSH-04, SG-SSH-05 | T-04-06..08 | The clone note round-trips through types, resolve, JSON, the committed schema, and the terminal grammar. | unit | `test/shared/notification-types.test.ts test/shared/notification-resolve.test.ts test/shared/notification-wire.test.ts test/shared/notification-json.test.ts t...` (full command in the plan) | ✅ | ⬜ pending |
| 4-02-02 | 02 | 1 | SG-SSH-02, SG-SSH-04, SG-SSH-05 | T-04-06..08 | The ssh-auth kind carries a detail that the retry rules can read. | unit | `test/platform/git-failure-kind.test.ts test/platform/git-process.test.ts test/shared/git-failure-classifiers.test.ts` (full command in the plan) | ✅ | ⬜ pending |
| 4-02-03 | 02 | 1 | SG-SSH-02, SG-SSH-04, SG-SSH-05 | T-04-06..08 | The both-failed error exists with upstream's two message forms and classifies by its last attempt. | integration, unit | `test/shared/errors.test.ts test/shared/git-failure-classifiers.test.ts` (full command in the plan) | ✅ | ⬜ pending |
| 4-03-01 | 03 | 2 | SG-SSH-06, SG-SSH-01 | T-04-09..12 | Every GitHub spelling folds to one repository, and under the base override every spelling reaches the base. | cucumber, unit | `test/shared/github-base-url.test.ts features/plugin/ssh-source.feature` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-03-02 | 03 | 2 | SG-SSH-06, SG-SSH-01 | T-04-09..12 | Every identity comparison folds GitHub spellings and no cache key changes. | unit | `test/domain/clone-key.test.ts test/domain/source.test.ts test/domain/name.test.ts test/orchestrators/plugin/clone-cache.test.ts test/orchestrators/auth-host....` (full command in the plan) | ✅ | ⬜ pending |
| 4-03-03 | 03 | 2 | SG-SSH-06, SG-SSH-01 | T-04-09..12 | A user sees one source per GitHub repository whatever its spelling or transport. | cucumber, integration, unit | `features/marketplace/add.feature features/marketplace/reserved-name.feature features/plugin/ssh-source.feature` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-04-01 | 04 | 2 | SG-SSH-02, SG-SSH-03 | T-04-13..19 | The probe launches from the one spawn site, the plan orders the attempts, and a GitHub add clones over SSH when the probe says configured. | cucumber, unit | `test/platform/git-process.test.ts test/platform/git.test.ts test/orchestrators/marketplace/shared.test.ts test/domain/github-transport.test.ts test/orchestra...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-04-02 | 04 | 2 | SG-SSH-02, SG-SSH-03 | T-04-13..19 | The forced transports skip the probe, CLAUDE_CODE_REMOTE is inert, and an unconfigured ssh goes HTTPS first. | cucumber, unit | `test/shared/upstream-flag.test.ts test/orchestrators/marketplace/clone-swap.test.ts test/orchestrators/github-transport.test.ts test/domain/github-transport....` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-04-03 | 04 | 2 | SG-SSH-02, SG-SSH-03 | T-04-13..19 | The marketplace add follows upstream's probe, order, fallback, and both-failed rule, and no Device Flow scenario reaches a real host. | cucumber, integration, unit | `test/orchestrators/github-transport.test.ts test/orchestrators/marketplace/add.test.ts test/integration/auth-e2e.test.ts` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-05-01 | 05 | 3 | SG-SSH-04, SG-SSH-06, SG-SSH-01, SG-SSH-03 | T-04-20..24 | A GitHub plugin install runs upstream's first skip checks and the probe once, and clones over SSH only when they keep it there. | cucumber, unit | `test/platform/git.test.ts test/orchestrators/marketplace/shared.test.ts test/domain/github-plugin-transport.test.ts test/orchestrators/github-transport.test....` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-05-02 | 05 | 3 | SG-SSH-04, SG-SSH-06, SG-SSH-01, SG-SSH-03 | T-04-20..24 | The plugin path follows every Qmt check, goes HTTPS first only when they all pass, retries over SSH, and reports both failures. | cucumber, unit | `test/platform/git-process.test.ts test/platform/git.test.ts test/orchestrators/marketplace/shared.test.ts test/domain/github-plugin-transport.test.ts test/or...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-05-03 | 05 | 3 | SG-SSH-04, SG-SSH-06, SG-SSH-01, SG-SSH-03 | T-04-20..24 | One install command probes once across its cascade, and every suite passes. | cucumber, integration, unit | `test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/install-flow-cascade-context.test.ts` (full command in the plan) | ✅ | ⬜ pending |
| 4-06-01 | 06 | 4 | SG-SSH-04, SG-SSH-03 | T-04-28..30 | A constrained GitHub dependency reads its tags over SSH by default. | cucumber, unit | `test/domain/github-transport.test.ts test/orchestrators/plugin/dependency-tag-probe.test.ts features/plugin/github-transport.feature` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-06-02 | 06 | 4 | SG-SSH-04, SG-SSH-03 | T-04-28..30 | Both tag reads use SSH by default and HTTPS when forced, and the TAGS-02 consequence is pinned. | cucumber, integration, unit | `test/orchestrators/plugin/marketplace-tag-probe.test.ts test/orchestrators/plugin/dependency-tag-probe.test.ts` (full command in the plan) | ✅ | ⬜ pending |
| 4-07-01 | 07 | 3 | SG-SSH-02 | T-04-25..27 | A GitHub marketplace add's notification names the transport it used. | cucumber, unit | `test/orchestrators/marketplace/add.test.ts features/marketplace/github-transport.feature` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-07-02 | 07 | 3 | SG-SSH-02 | T-04-25..27 | Every GitHub marketplace add that clones shows its transport, its retries, and its failures. | cucumber, unit | `test/domain/github-transport.test.ts test/orchestrators/marketplace/add.test.ts test/shared/catalog-uat.test.ts features/marketplace/ssh-source.feature featu...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-07-03 | 07 | 3 | SG-SSH-02 | T-04-25..27 | Every scenario that adds a GitHub marketplace states its transport note, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modules && P...` (full command in the plan) | — | ⬜ pending |
| 4-08-01 | 08 | 4 | SG-SSH-02, SG-SSH-04, SG-SSH-06, SG-SSH-03 | T-04-31..33 | Every refresh takes its URLs from the declared source in the marketplace path's order. | cucumber, unit | `test/orchestrators/marketplace/clone-swap.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/plugin/update-flow.test.ts test/orchestrat...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-08-02 | 08 | 4 | SG-SSH-02, SG-SSH-04, SG-SSH-06, SG-SSH-03 | T-04-31..33 | Refreshes follow the marketplace path's order with its fallback, and PREFER_HTTPS forces HTTPS. | cucumber, unit | `test/orchestrators/marketplace/clone-swap.test.ts test/orchestrators/marketplace/update.test.ts features/marketplace/github-refresh.feature` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-08-03 | 08 | 4 | SG-SSH-02, SG-SSH-04, SG-SSH-06, SG-SSH-03 | T-04-31..33 | Every refresh path uses an attempt list and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modules && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:integration &&...` (full command in the plan) | — | ⬜ pending |
| 4-09-01 | 09 | 4 | SG-SSH-05 | T-04-34..36 | The Windows plugin path goes SSH first, retries over HTTPS only after a publickey or host-key failure with the checks passing, and then retries SSH. | unit | `test/platform/git-process.test.ts test/platform/git.test.ts test/orchestrators/marketplace/shared.test.ts test/domain/github-plugin-transport.test.ts test/or...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-09-02 | 09 | 4 | SG-SSH-05 | T-04-34..36 | Each Windows rule has a row, and the manual Windows check is on the ledger. | integration, unit | `test/domain/github-plugin-transport.test.ts test/platform/git-process.test.ts` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-10-01 | 10 | 5 | SG-SSH-04 | T-04-37..39 | A GitHub plugin update probes once and follows the install's order with its fallback. | cucumber, unit | `test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/update-preflight.test.ts test/orchestrators/plugin/clone-cache.test.ts features/plugi...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-10-02 | 10 | 5 | SG-SSH-04 | T-04-37..39 | Every update-family command and both fetch verbs probe once per command and follow the install's order. | cucumber, unit | `test/orchestrators/plugin/update-cascade.test.ts test/orchestrators/plugin/dependency-move.test.ts test/orchestrators/plugin/materialize-latest.test.ts test/...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-10-03 | 10 | 5 | SG-SSH-04 | T-04-37..39 | Every clone path takes a transport, enable's arm is pinned and flagged, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modules && P...` (full command in the plan) | — | ⬜ pending |
| 4-11-01 | 11 | 5 | SG-SSH-02 | T-04-40..41 | A GitHub marketplace refresh that re-clones names its transport. | cucumber, unit | `test/orchestrators/marketplace/update.test.ts test/orchestrators/marketplace/background-pass.test.ts features/marketplace/github-refresh.feature` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-11-02 | 11 | 5 | SG-SSH-02 | T-04-40..41 | Every refresh scenario that re-clones states its note, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modules && P...` (full command in the plan) | — | ⬜ pending |
| 4-12-01 | 12 | 6 | SG-SSH-04 | T-04-42..44 | A GitHub plugin install names each clone's transport on the row that cloned. | cucumber, unit | `test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/install-flow-results.test.ts test/orchestrators/plugin/install.messaging.test.ts tes...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-12-02 | 12 | 6 | SG-SSH-04 | T-04-42..44 | Every install scenario that clones a GitHub plugin states its note, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modules && P...` (full command in the plan) | — | ⬜ pending |
| 4-13-01 | 13 | 7 | SG-SSH-04, SG-SSH-02 | T-04-45..47 | A GitHub plugin update names its clones' transports, including the PUP-2 sync. | cucumber, unit | `test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/update-row.test.ts test/orchestrators/plugin/update.messaging.test.ts features/plugin...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-13-02 | 13 | 7 | SG-SSH-04, SG-SSH-02 | T-04-45..47 | Every update-family and fetch verb names its clones' transports. | cucumber, unit | `test/orchestrators/plugin/reinstall-flow.test.ts test/orchestrators/plugin/reinstall.messaging.test.ts test/orchestrators/plugin/fetch.test.ts test/orchestra...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-13-03 | 13 | 7 | SG-SSH-04, SG-SSH-02 | T-04-45..47 | Every update-family and fetch scenario that clones a GitHub repository states its note, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modules && P...` (full command in the plan) | — | ⬜ pending |
| 4-14-01 | 14 | 8 | SG-SSH-04, SG-SSH-02 | T-04-48..50 | An apply run probes once for its plugins and names each clone's transport. | cucumber, unit | `test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts test/orchestrators/reconcile/notify.test.ts features/plugin/gi...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-14-02 | 14 | 8 | SG-SSH-04, SG-SSH-02 | T-04-48..50 | Apply and import each probe once per run across all their plugin clones. | cucumber, unit | `test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/import/execute.test.ts test/orchestrators/reconcile/apply.test.ts features/plugin/github-...` (full command in the plan) | ❌ W0 (task creates it) | ⬜ pending |
| 4-14-03 | 14 | 8 | SG-SSH-04, SG-SSH-02 | T-04-48..50 | Every apply and import scenario that clones a GitHub repository states its note, and the full check passes. | full check | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check` (full command in the plan) | — | ⬜ pending |
| 4-15-01 | 15 | 9 | SG-SSH-01, SG-SSH-02, SG-SSH-03, SG-SSH-04, SG-SSH-05, SG-SSH-06 | T-04-51 | NFR-5 names the probe and the retry in both files. | doc gate | `grep -c "D-SG-18 and D-SG-20" AGENTS.md .planning/PROJECT.md && grep -c "ssh -T" AGENTS.md` (full command in the plan) | — | ⬜ pending |
| 4-15-02 | 15 | 9 | SG-SSH-01, SG-SSH-02, SG-SSH-03, SG-SSH-04, SG-SSH-05, SG-SSH-06 | T-04-51 | The records, maps, and docs describe the shipped transport behavior, and the full check passes. | doc gate, full check | `test "$(grep -c 'Pending (Phase 4)' .planning/PROJECT.md)" = "0" && grep -c "CLAUDE_CODE_PLUGIN_PREFER_HTTPS" docs/env-vars.md .planning/codebase/STACK.md &&...` (full command in the plan) | — | ⬜ pending |

### Requirement and decision → check map (from 04-RESEARCH.md "Validation Architecture")

| Req / Decision | Behavior | Test Type | Owner check |
|--------|----------|-----------|-------------|
| SG-SSH-01 / D-SG-17 | upstream's `iTs` rules: each accepted form and each refusal message; `git://` refused; host-less `file:` only; `http://` git sources accepted; hosted `.json` stays https-only | unit | `test/domain/git-url.test.ts` (new), `test/domain/source.test.ts` |
| SG-SSH-01 | the scp add arm; `ssh://`, `git+ssh://`, `ssh+git://` refused on the add command line with upstream's text, accepted from config, import, and the D-MF-04 add; the git-subdir `url` gate (F-2: `ext::`, `file://host`) | unit | `test/orchestrators/marketplace/add.test.ts`, `test/orchestrators/import/marketplaces.test.ts` |
| SG-SSH-01 | `marketplace add git@127.0.0.1:acme/tools.git` clones over SSH and a plugin installs from it; a config `ssh://` marketplace reaches `apply`; a plugin `url` source over SSH installs; `git://` refused | cucumber | new marketplace SSH feature, `features/plugin/git-source.feature`, `features/marketplace/unsupported-source.feature` |
| SG-SSH-02 | probe arms → marketplace order and notes (`authenticated`, `denied`, `host-key`, `hold` after 3000 ms), retry note, both-failed outcome | cucumber (no-override Pi) | new marketplace GitHub transport feature |
| SG-SSH-02 | probe argv, timeout, cwd, kept user env, ssh lookup in absolute PATH entries only, classification | unit + stub | `test/platform/git-process.test.ts`, `test/platform/git.test.ts` |
| SG-SSH-02 | refresh URL list: the freshness check and the re-clone try each URL | unit | `test/orchestrators/marketplace/clone-swap.test.ts`, `update.test.ts` |
| SG-SSH-03 / D-SG-24 | `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`: no probe launch, HTTPS clone; `CLAUDE_CODE_REMOTE=1` changes nothing | cucumber + unit | GitHub transport features, the reader's test |
| SG-SSH-04 / D-SG-18 | each skip check → SSH only; all pass + `not-configured` → HTTPS then SSH; the dependency member inherits (one probe per command) | unit + cucumber | `test/domain/github-plugin-transport.test.ts` (new), `features/plugin/github-transport.feature` (new) |
| D-SG-19 | update, reinstall, and a dependency move follow the install rules; `fetch` and `info --fetch` carry a context (OQ-7) | unit + cucumber | `test/orchestrators/plugin/update-preflight.test.ts`, feature rows |
| D-SG-20 | a constrained dependency's tag read lists the SSH URL by default; HTTPS under the variable or the base; TAGS-02 fallback on failure | unit + cucumber | `test/orchestrators/plugin/{dependency,marketplace}-tag-probe.test.ts` |
| D-SG-21 | per-URL SSH-form `insteadOf` pairs; `fetchCommit` from an scp origin gets the pair; the order under the base is the `PREFER_HTTPS` order (OQ-2) | unit + real git | `test/shared/github-base-url.test.ts`, `test/platform/git.test.ts` |
| D-SG-22 | the transport note on every GitHub clone that runs (OQ-3), the JSON wire field, the grammar | unit + architecture + cucumber | `test/shared/notification-*.test.ts`, the wire schema test, rebaselined features |
| SG-SSH-05 | Windows: SSH first, no probe; publickey or host-key failure with checks → HTTPS then SSH; other failures thrown | unit (`platform: "win32"`) + manual | `test/domain/github-plugin-transport.test.ts`, `test/platform/git-process.test.ts`, WINDOWS ledger |
| SG-SSH-06 / D-SG-23 | the `Ort` fold table; `originMatchesSource` with scp origins; the reserved-name fold; `deriveMarketplaceUrl` and `hostFromCloneUrl` on scp; `canonicalCloneUrl` unchanged | unit | `test/domain/clone-key.test.ts`, `test/domain/name.test.ts`, `test/orchestrators/plugin/clone-cache.test.ts`, `test/orchestrators/auth-host.test.ts` |
| SG-SSH-06 | a leftover SSH clone is recognized, not refused as `{stale clone}`; `Acme/Tools` after `acme/tools` is one source; a reinstall after an SSH install reuses `plugin-clones/<key>/` | cucumber | `features/marketplace/add.feature`, `features/plugin/reinstall.feature` |
| Network | no test reaches github.com:22 or any real host | architecture / integration | `test/integration/auth-e2e.test.ts` with the ssh stand-in, `hermetic-git-environment.test.ts` |
| Hermetic | `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` reaches only a scenario's own Pi; F-5: a Pi without the base override must have the proxy | architecture | `test/architecture/hermetic-git-environment.test.ts` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each new test file, step, and fixture is created by the task that first needs it (TDD: the case is written and run red before the code), so no separate Wave 0 plan exists. The list below is what those tasks create.

- [ ] `test/domain/git-url.test.ts`: the `iTs` table
- [ ] `test/domain/github-transport.test.ts` (04-04): the marketplace plan table; `test/domain/github-plugin-transport.test.ts` (04-05, 04-09): the plugin plan table (three probe results × each skip check × win32)
- [ ] a runner test for the retry (retry only on a clone-step failure, target cleared, both-failed)
- [ ] cucumber steps: register an ssh host arm, `Then the ssh stand-in receives these launches:`, a no-override profile with variables
- [ ] new feature files: `features/marketplace/ssh-source.feature`, `features/plugin/ssh-source.feature` (04-01), `features/marketplace/github-transport.feature` (04-04), `features/plugin/github-transport.feature` (04-05), `features/marketplace/github-refresh.feature` (04-08), `features/plugin/github-transport-update.feature` (04-10), `features/plugin/github-transport-apply.feature` (04-14)
- [ ] the F-5 harness fix (require `httpsProxy` without the base override)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real `ssh -T git@github.com` probe and a real SSH clone | SG-SSH-02, SG-SSH-04 | No test may reach the network, and the sandbox has no ssh binary; the ssh stand-in serves the same protocol | Not run in this phase; covered by the stand-in scenarios |
| The Windows SSH-to-HTTPS retry, including the `ssh -G` check through `GIT_SSH_COMMAND` | SG-SSH-05 | CI and the sandbox run Linux only | The `[system-git]` WINDOWS ledger entry, checked at the pull request |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s for owner unit runs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
