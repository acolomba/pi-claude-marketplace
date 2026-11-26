---
phase: "4"
slug: "ssh-sources-and-transport-selection"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
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

One row per task of plans 04-01 to 04-18 (47 tasks, waves 1 to 11; revised 2026-11-25 after the plan check: the marketplace transport plan split into 04-04 and 04-05, the update-family transport plan into 04-11 and 04-12, and the update-family notes plan into 04-15 and 04-16, with the later plans renumbered). The Requirement column is the plan's `requirements` list; the Threat Ref column is the plan's set of `T-04-NN` threats (each plan also keeps `T-04-SC`); the command column names the test and feature files of the task's `<automated>` commands, whose full text, with its `fails_when` line, is in the plan. File Exists is measured on the tree the plans were written against: `❌ W0` means the task creates a file it runs.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | SG-SSH-01 | T-04-01..05 | An scp address parses as a url source, the add clones it over SSH through the stand-in, and the launches table pins git's transport launch. | cucumber, unit | `test/domain/git-url.test.ts test/domain/source.test.ts test/orchestrators/auth-host.test.ts features/marketplace/ssh-source.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-01-02 | 01 | 1 | SG-SSH-01 | T-04-01..05 | Every git address form follows upstream's validator, F-2 is closed at parse, and a plugin url source over SSH installs through the stand-in. | cucumber, unit | `test/domain/git-url.test.ts test/domain/source.test.ts features/plugin/ssh-source.feature features/plugin/git-source.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-01-03 | 01 | 1 | SG-SSH-01 | T-04-01..05 | The command line refuses the URL-scheme SSH forms with upstream's text, config, apply, and import accept them, F-5 is closed, and every suite passes. | cucumber, integration, unit | `test/orchestrators/marketplace/add.test.ts test/edge/handlers/marketplace/add.test.ts test/orchestrators/import/marketplaces.test.ts features/marketpl...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-02-01 | 02 | 1 | SG-SSH-02, SG-SSH-04, SG-SSH-05 | T-04-06..08 | The clone note round-trips through types, resolve, JSON, the committed schema, and the terminal grammar. | unit | `test/shared/notification-types.test.ts test/shared/notification-resolve.test.ts test/shared/notification-wire.test.ts test/shared/notification-json.te...` (full command in the plan) | ✅ | ✅ green |
| 4-02-02 | 02 | 1 | SG-SSH-02, SG-SSH-04, SG-SSH-05 | T-04-06..08 | The ssh-auth kind carries a detail that the retry rules can read. | unit | `test/platform/git-failure-kind.test.ts test/platform/git-process.test.ts test/shared/git-failure-classifiers.test.ts` (full command in the plan) | ✅ | ✅ green |
| 4-02-03 | 02 | 1 | SG-SSH-02, SG-SSH-04, SG-SSH-05 | T-04-06..08 | The both-failed error exists with upstream's two message forms and classifies by its last attempt. | integration, unit | `test/shared/errors.test.ts test/shared/git-failure-classifiers.test.ts` (full command in the plan) | ✅ | ✅ green |
| 4-03-01 | 03 | 2 | SG-SSH-06, SG-SSH-01 | T-04-09..12 | Every GitHub spelling folds to one repository, and under the base override every spelling reaches the base. | cucumber, unit | `test/shared/github-base-url.test.ts features/plugin/ssh-source.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-03-02 | 03 | 2 | SG-SSH-06, SG-SSH-01 | T-04-09..12 | Every identity comparison folds GitHub spellings and no cache key changes. | unit | `test/domain/clone-key.test.ts test/domain/source.test.ts test/domain/name.test.ts test/orchestrators/plugin/clone-cache.test.ts test/orchestrators/aut...` (full command in the plan) | ✅ | ✅ green |
| 4-03-03 | 03 | 2 | SG-SSH-06, SG-SSH-01 | T-04-09..12 | A user sees one source per GitHub repository whatever its spelling or transport. | cucumber, integration, unit | `features/marketplace/add.feature features/marketplace/reserved-name.feature features/plugin/ssh-source.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-04-01 | 04 | 2 | SG-SSH-02, SG-SSH-03 | T-04-13..15, T-04-17..18 | The probe launches from the one spawn site, the plan orders the first attempt, a GitHub add clones over SSH when the probe says configured, and no test process can run the machine's ssh. | cucumber, unit | `test/platform/git-process.test.ts test/platform/git.test.ts test/orchestrators/marketplace/shared.test.ts test/domain/github-transport.test.ts test/or...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-04-02 | 04 | 2 | SG-SSH-02, SG-SSH-03 | T-04-13..15, T-04-17..18 | The forced transports skip the probe, CLAUDE_CODE_REMOTE is not read, an unconfigured ssh goes HTTPS first, and every existing scenario keeps its table. | cucumber, integration, unit | `test/shared/upstream-flag.test.ts test/orchestrators/marketplace/clone-swap.test.ts test/orchestrators/github-transport.test.ts test/domain/github-tra...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-05-01 | 05 | 3 | SG-SSH-02, SG-SSH-03 | T-04-16, T-04-19, T-04-52..53 | A GitHub marketplace add whose first transport fails clears its staging directory and succeeds over the other one. | cucumber, unit | `test/domain/github-transport.test.ts test/orchestrators/github-transport.test.ts test/orchestrators/marketplace/add.test.ts test/architecture/ssh-git-...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-05-02 | 05 | 3 | SG-SSH-02, SG-SSH-03 | T-04-16, T-04-19, T-04-52..53 | The marketplace add follows upstream's fallback and both-failed rule, the stand-in refuses what a real ssh refuses, and no Device Flow scenario or integration test reaches a real host. | cucumber, integration, unit | `test/orchestrators/github-transport.test.ts test/orchestrators/marketplace/add.test.ts test/architecture/ssh-git-host.test.ts test/integration/auth-e2...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-05-03 | 05 | 3 | SG-SSH-02, SG-SSH-03 | T-04-16, T-04-19, T-04-52..53 | PREFER_HTTPS and CLAUDE_CODE_REMOTE are pinned by scenarios on a scenario's own Pi, the shell cannot leak either, and every suite passes. | cucumber, integration, unit | `test/architecture/hermetic-git-environment.test.ts` (full command in the plan) | ✅ | ✅ green |
| 4-06-01 | 06 | 4 | SG-SSH-04, SG-SSH-06, SG-SSH-01, SG-SSH-03 | T-04-20..24 | A GitHub plugin install runs upstream's first skip checks and the probe once, and clones over SSH only when they keep it there. | cucumber, unit | `test/platform/git.test.ts test/orchestrators/marketplace/shared.test.ts test/domain/github-plugin-transport.test.ts test/orchestrators/github-transpor...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-06-02 | 06 | 4 | SG-SSH-04, SG-SSH-06, SG-SSH-01, SG-SSH-03 | T-04-20..24 | The plugin path follows every Qmt check, goes HTTPS first only when they all pass, retries over SSH, and reports both failures. | cucumber, unit | `test/platform/git-process.test.ts test/platform/git.test.ts test/orchestrators/marketplace/shared.test.ts test/domain/github-plugin-transport.test.ts ...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-06-03 | 06 | 4 | SG-SSH-04, SG-SSH-06, SG-SSH-01, SG-SSH-03 | T-04-20..24 | One install command probes once across its cascade, and every suite passes. | cucumber, integration, unit | `test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/install-flow-cascade-context.test.ts` (full command in the plan) | ✅ | ✅ green |
| 4-07-01 | 07 | 5 | SG-SSH-04, SG-SSH-03 | T-04-28..30, T-04-54 | A constrained GitHub dependency reads its tags over SSH by default. | cucumber, unit | `test/domain/github-transport.test.ts test/orchestrators/plugin/dependency-tag-probe.test.ts features/plugin/github-transport.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-07-02 | 07 | 5 | SG-SSH-04, SG-SSH-03 | T-04-28..30, T-04-54 | Both tag reads use SSH by default and HTTPS when forced, a github-source dependency retries a failed SSH listing once over HTTPS, and the TAGS-02 consequence for a path-source dependency is pinned. | cucumber, integration, unit | `test/orchestrators/plugin/marketplace-tag-probe.test.ts test/orchestrators/plugin/dependency-tag-probe.test.ts features/plugin/github-transport.featur...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-08-01 | 08 | 4 | SG-SSH-02 | T-04-25..27 | A GitHub marketplace add's notification names the transport it used. | cucumber, unit | `test/orchestrators/marketplace/add.test.ts features/marketplace/github-transport.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-08-02 | 08 | 4 | SG-SSH-02 | T-04-25..27 | Every GitHub marketplace add that clones shows its transport, its retries, and its failures. | cucumber, unit | `test/domain/github-transport.test.ts test/orchestrators/marketplace/add.test.ts test/shared/catalog-uat.test.ts features/marketplace/ssh-source.featur...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-08-03 | 08 | 4 | SG-SSH-02 | T-04-25..27 | Every scenario that adds a GitHub marketplace states its transport note, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modul...` (full command in the plan) | — | ✅ green |
| 4-09-01 | 09 | 5 | SG-SSH-02, SG-SSH-04, SG-SSH-06, SG-SSH-03 | T-04-31..33 | Every refresh takes its URLs from the declared source in the marketplace path's order. | cucumber, unit | `test/orchestrators/marketplace/clone-swap.test.ts test/orchestrators/marketplace/update.test.ts test/orchestrators/plugin/update-flow.test.ts test/orc...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-09-02 | 09 | 5 | SG-SSH-02, SG-SSH-04, SG-SSH-06, SG-SSH-03 | T-04-31..33 | Refreshes follow the marketplace path's order with its fallback, and PREFER_HTTPS forces HTTPS. | cucumber, unit | `test/orchestrators/marketplace/clone-swap.test.ts test/orchestrators/marketplace/update.test.ts features/marketplace/github-refresh.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-09-03 | 09 | 5 | SG-SSH-02, SG-SSH-04, SG-SSH-06, SG-SSH-03 | T-04-31..33 | Every refresh path uses an attempt list and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modules && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:integra...` (full command in the plan) | — | ✅ green |
| 4-10-01 | 10 | 5 | SG-SSH-05 | T-04-34..36 | The Windows plugin path goes SSH first, retries over HTTPS only after a publickey or host-key failure with the checks passing, and then retries SSH. | unit | `test/platform/git-process.test.ts test/platform/git.test.ts test/orchestrators/marketplace/shared.test.ts test/domain/github-plugin-transport.test.ts ...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-10-02 | 10 | 5 | SG-SSH-05 | T-04-34..36 | Each Windows rule has a row, and the manual Windows check is on the ledger. | integration, unit | `test/domain/github-plugin-transport.test.ts test/platform/git-process.test.ts` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-11-01 | 11 | 6 | SG-SSH-04 | T-04-37..39 | A GitHub plugin update probes once and follows the install's order with its fallback. | cucumber, unit | `test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/update-preflight.test.ts test/orchestrators/plugin/clone-cache.test.ts feature...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-11-02 | 11 | 6 | SG-SSH-04 | T-04-37..39 | Every command that reaches clone-cache through the update preflight probes once per command and follows the install's order. | cucumber, integration, unit | `test/orchestrators/plugin/update-cascade.test.ts test/orchestrators/plugin/dependency-move.test.ts test/orchestrators/plugin/materialize-latest.test.t...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-12-01 | 12 | 7 | SG-SSH-04 | T-04-55..57 | Both fetch verbs probe once per command and follow the install's order. | cucumber, unit | `test/orchestrators/plugin/fetch.test.ts test/orchestrators/plugin/info.test.ts features/plugin/github-transport-update.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-12-02 | 12 | 7 | SG-SSH-04 | T-04-55..57 | Enable creates one context per command and its cascade shares it, a no-key user re-enables over HTTPS, and no clone path is SSH only for want of a context. | cucumber, unit | `test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/plugin/install-clone-probe.test.ts test/domain/github-plugin-transport.test.ts fea...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-12-03 | 12 | 7 | SG-SSH-04 | T-04-55..57 | Every clone path takes a transport, and every suite passes. | cucumber, integration, unit | `test/orchestrators/plugin/clone-cache.test.ts test/orchestrators/plugin/install-clone-probe.test.ts` (full command in the plan) | ✅ | ✅ green |
| 4-13-01 | 13 | 6 | SG-SSH-02 | T-04-40..41 | A GitHub marketplace refresh that re-clones names its transport. | cucumber, unit | `test/orchestrators/marketplace/update.test.ts test/orchestrators/marketplace/background-pass.test.ts features/marketplace/github-refresh.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-13-02 | 13 | 6 | SG-SSH-02 | T-04-40..41 | Every refresh scenario that re-clones states its note, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modul...` (full command in the plan) | — | ✅ green |
| 4-14-01 | 14 | 7 | SG-SSH-04 | T-04-42..44 | A GitHub plugin install names each clone's transport on the row that cloned. | cucumber, unit | `test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/install-flow-results.test.ts test/orchestrators/plugin/install.messaging.test...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-14-02 | 14 | 7 | SG-SSH-04 | T-04-42..44 | Every install scenario that clones a GitHub plugin states its note, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modul...` (full command in the plan) | — | ✅ green |
| 4-15-01 | 15 | 8 | SG-SSH-04, SG-SSH-02 | T-04-45, T-04-47 | A GitHub plugin update names its clones' transports, including the PUP-2 sync and its dependency moves. | cucumber, unit | `test/orchestrators/plugin/update-flow.test.ts test/orchestrators/plugin/update-row.test.ts test/orchestrators/plugin/update.messaging.test.ts features...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-15-02 | 15 | 8 | SG-SSH-04, SG-SSH-02 | T-04-45, T-04-47 | A reinstall names its clones' transports. | cucumber, unit | `test/orchestrators/plugin/reinstall-flow.test.ts test/orchestrators/plugin/reinstall.messaging.test.ts features/plugin/github-transport-update.feature` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-15-03 | 15 | 8 | SG-SSH-04, SG-SSH-02 | T-04-45, T-04-47 | Every update and reinstall scenario that clones a GitHub repository states its note, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modul...` (full command in the plan) | — | ✅ green |
| 4-16-01 | 16 | 9 | SG-SSH-04, SG-SSH-02 | T-04-46, T-04-58..59 | Both fetch verbs name their clones' transports. | cucumber, unit | `test/orchestrators/plugin/fetch.test.ts test/orchestrators/plugin/fetch.messaging.test.ts test/orchestrators/plugin/info.test.ts test/orchestrators/pl...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-16-02 | 16 | 9 | SG-SSH-04, SG-SSH-02 | T-04-46, T-04-58..59 | An enable that re-clones names its clones' transports. | cucumber, unit | `test/orchestrators/plugin/enable-disable.test.ts test/orchestrators/plugin/enable-disable.messaging.test.ts features/plugin/github-transport-update.fe...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-16-03 | 16 | 9 | SG-SSH-04, SG-SSH-02 | T-04-46, T-04-58..59 | Every fetch, info --fetch, and enable scenario that clones a GitHub repository states its note, and every suite passes. | cucumber, integration, unit | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check:features && PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent test:modul...` (full command in the plan) | — | ✅ green |
| 4-17-01 | 17 | 10 | SG-SSH-04, SG-SSH-02 | T-04-48..50 | An apply run probes once for its plugins and names each clone's transport. | cucumber, unit | `test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts test/orchestrators/reconcile/notify.test.ts features/pl...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-17-02 | 17 | 10 | SG-SSH-04, SG-SSH-02 | T-04-48..50 | Apply and import each probe once per run across all their plugin clones. | cucumber, unit | `test/orchestrators/import/execute.test.ts test/orchestrators/reconcile/apply.test.ts test/orchestrators/reconcile/apply-outcomes.test.ts features/plug...` (full command in the plan) | ❌ W0 (task creates it) | ✅ green |
| 4-17-03 | 17 | 10 | SG-SSH-04, SG-SSH-02 | T-04-48..50 | Every apply and import scenario that clones a GitHub repository states its note, and the full check passes. | full check | `PATH="/opt/pi-claude-marketplace/bin:$PATH" npm run --silent check` (full command in the plan) | — | ✅ green |
| 4-18-01 | 18 | 11 | SG-SSH-01, SG-SSH-02, SG-SSH-03, SG-SSH-04, SG-SSH-05, SG-SSH-06 | T-04-51 | NFR-5 names the probe and the retry in both files. | doc gate | `grep -c "D-SG-18 and D-SG-20" AGENTS.md .planning/PROJECT.md && grep -c "ssh -T" AGENTS.md && grep -c "tag listing is retried once over HTTPS" AGENTS....` (full command in the plan) | — | ✅ green |
| 4-18-02 | 18 | 11 | SG-SSH-01, SG-SSH-02, SG-SSH-03, SG-SSH-04, SG-SSH-05, SG-SSH-06 | T-04-51 | The records, maps, and docs describe the shipped transport behavior, and the full check passes. | doc gate, full check | `test "$(grep -c 'Pending (Phase 4)' .planning/PROJECT.md)" = "0" && grep -c "CLAUDE_CODE_PLUGIN_PREFER_HTTPS" docs/env-vars.md .planning/codebase/STAC...` (full command in the plan) | — | ✅ green |

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
| D-SG-19 | update, reinstall, and a dependency move follow the install rules; `fetch` and `info --fetch` carry a context (OQ-7); `enable` (extended 2026-11-25) creates a context at its command root, its cascade shares it, and a no-key user re-enables over HTTPS; no SSH-only no-context arm remains | unit + cucumber | `test/orchestrators/plugin/update-preflight.test.ts`, `test/orchestrators/plugin/enable-disable.test.ts`, `test/domain/github-plugin-transport.test.ts`, `features/plugin/github-transport-update.feature` |
| D-SG-20 | a constrained dependency's tag read lists the SSH URL by default; HTTPS under the variable or the base, with no SSH attempt; a `github`-source dependency's failed SSH listing is retried once over HTTPS (amended 2026-11-25): rows for SSH fails then HTTPS succeeds, both fail, and forced; TAGS-02 fallback for a path-source dependency | unit + cucumber | `test/orchestrators/plugin/{dependency,marketplace}-tag-probe.test.ts`, `features/plugin/github-transport.feature` |
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

- [x] `test/domain/git-url.test.ts`: the `iTs` table
- [x] `test/domain/github-transport.test.ts` (04-04, then 04-05's `after` rows): the marketplace plan table; `test/domain/github-plugin-transport.test.ts` (04-06, 04-10, 04-12): the plugin plan table (three probe results × each skip check × win32)
- [x] a runner test for the retry (retry only on a clone-step failure, target cleared, both-failed; 04-05)
- [x] the refusing `ssh` that `scripts/isolated-pi-home.mjs` puts first on every test process's PATH, with its architecture case (04-04, in the probe's commit)
- [x] cucumber steps: register an ssh host arm (04-01, 04-04, 04-05), `Then the ssh stand-in receives these launches:` (04-01), a no-override profile without a sign-in (04-04) and with variables (04-05, 04-06)
- [x] new feature files: `features/marketplace/ssh-source.feature`, `features/plugin/ssh-source.feature` (04-01), `features/marketplace/github-transport.feature` (04-04), `features/plugin/github-transport.feature` (04-06), `features/marketplace/github-refresh.feature` (04-09), `features/plugin/github-transport-update.feature` (04-11), `features/plugin/github-transport-apply.feature` (04-17)
- [x] the F-5 harness fix (require `httpsProxy` without the base override)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real `ssh -T git@github.com` probe and a real SSH clone | SG-SSH-02, SG-SSH-04 | No test may reach the network, and the sandbox has no ssh binary; the ssh stand-in serves the same protocol | Not run in this phase; covered by the stand-in scenarios |
| The Windows SSH-to-HTTPS retry, including the `ssh -G` check through `GIT_SSH_COMMAND` | SG-SSH-05 | CI and the sandbox run Linux only | The `[system-git]` WINDOWS ledger entry, checked at the pull request |
| Transport note on the D-SG-22 paths still without one: disabled install, dependency-move planning failure, D-MF-04 add of another marketplace, skipped/partial/manual-recovery update rows, autoupdate cascade rows, bulk update with everything current, failed enable cascade member, post-ledger enable failure, fetch remote row, failed dependency rollback row, bootstrap add failure | SG-SSH-02, SG-SSH-04 (D-SG-22) | Deferred known open gap, recorded in `.planning/WINDOWS.md`; a gap plan will add the note and its scenarios | None yet; no test written by design |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s for owner unit runs
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-11-26 (Nyquist audit: every SG-SSH-01..06 behavior has an automated check; the D-SG-22 open gaps below are deferred, not unverified)

## Validation Audit 2026-11-26

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

Audit 2026-11-26: re-ran the 26 owner unit and architecture files of the check map (2731 tests, 0 failures) and the seven phase feature files under the adapter profile (50 scenarios, 0 failures). Every check-map row maps to an existing passing check, including the `hold` probe timing, the absolute-PATH ssh lookup, `CLAUDE_CODE_REMOTE`, the win32 rows, and the SSH clone filling the HTTPS clone's key. `nyquist_compliant: true` because the only uncovered behaviors are the deferred D-SG-22 note paths listed under Manual-Only Verifications, which the brief excludes.
