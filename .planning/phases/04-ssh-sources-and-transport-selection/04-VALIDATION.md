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

The planner fills one row per task. Each row maps to a requirement or decision below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 4-NN-NN | NN | N | SG-SSH-0N | T-04-NN / — | (from the plan) | unit / cucumber | (from the plan) | ✅ / ❌ W0 | ⬜ pending |

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
| SG-SSH-04 / D-SG-18 | each skip check → SSH only; all pass + `not-configured` → HTTPS then SSH; the dependency member inherits (one probe per command) | unit + cucumber | `test/domain/github-transport.test.ts` (new), new plugin GitHub transport feature |
| D-SG-19 | update, reinstall, and a dependency move follow the install rules; `fetch` and `info --fetch` carry a context (OQ-7) | unit + cucumber | `test/orchestrators/plugin/update-preflight.test.ts`, feature rows |
| D-SG-20 | a constrained dependency's tag read lists the SSH URL by default; HTTPS under the variable or the base; TAGS-02 fallback on failure | unit + cucumber | `test/orchestrators/plugin/{dependency,marketplace}-tag-probe.test.ts` |
| D-SG-21 | per-URL SSH-form `insteadOf` pairs; `fetchCommit` from an scp origin gets the pair; the order under the base is the `PREFER_HTTPS` order (OQ-2) | unit + real git | `test/shared/github-base-url.test.ts`, `test/platform/git.test.ts` |
| D-SG-22 | the transport note on every GitHub clone that runs (OQ-3), the JSON wire field, the grammar | unit + architecture + cucumber | `test/shared/notification-*.test.ts`, the wire schema test, rebaselined features |
| SG-SSH-05 | Windows: SSH first, no probe; publickey or host-key failure with checks → HTTPS then SSH; other failures thrown | unit (`platform: "win32"`) + manual | `test/domain/github-transport.test.ts`, `test/platform/git-process.test.ts`, WINDOWS ledger |
| SG-SSH-06 / D-SG-23 | the `Ort` fold table; `originMatchesSource` with scp origins; the reserved-name fold; `deriveMarketplaceUrl` and `hostFromCloneUrl` on scp; `canonicalCloneUrl` unchanged | unit | `test/domain/clone-key.test.ts`, `test/domain/name.test.ts`, `test/orchestrators/plugin/clone-cache.test.ts`, `test/orchestrators/auth-host.test.ts` |
| SG-SSH-06 | a leftover SSH clone is recognized, not refused as `{stale clone}`; `Acme/Tools` after `acme/tools` is one source; a reinstall after an SSH install reuses `plugin-clones/<key>/` | cucumber | `features/marketplace/add.feature`, `features/plugin/reinstall.feature` |
| Network | no test reaches github.com:22 or any real host | architecture / integration | `test/integration/auth-e2e.test.ts` with the ssh stand-in, `hermetic-git-environment.test.ts` |
| Hermetic | `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` reaches only a scenario's own Pi; F-5: a Pi without the base override must have the proxy | architecture | `test/architecture/hermetic-git-environment.test.ts` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each new test file, step, and fixture is created by the task that first needs it (TDD: the case is written and run red before the code), so no separate Wave 0 plan exists. The list below is what those tasks create.

- [ ] `test/domain/git-url.test.ts`: the `iTs` table
- [ ] `test/domain/github-transport.test.ts`: the plan table (both paths × three probe results × each skip check × win32)
- [ ] a runner test for the retry (retry only on a clone-step failure, target cleared, both-failed)
- [ ] cucumber steps: register an ssh host arm, `Then the ssh stand-in receives these launches:`, a no-override profile with variables
- [ ] new feature files for SSH marketplace sources and the GitHub transport (names per `.agents/skills/cucumber/rules/layout.md`)
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
