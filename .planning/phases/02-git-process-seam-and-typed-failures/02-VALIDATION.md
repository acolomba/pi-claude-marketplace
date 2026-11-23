---
phase: "2"
slug: "git-process-seam-and-typed-failures"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-23"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict`; `@cucumber/cucumber` (profiles `adapter`, `builtin`) |
| **Config file** | `package.json` scripts; `cucumber.json` |
| **Quick run command** | `PATH="/opt/pi-claude-marketplace/bin:$PATH" node --import "$PWD/scripts/isolated-pi-home.mjs" --test test/platform/git-process.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick ~30 seconds; full ~15 minutes |

---

## Sampling Rate

- **After every task commit:** owner tests and `npm run test:coverage:direct -- <source>` per touched pair; the hook runs `npm run check:commit`
- **After every plan wave:** `npm run check`
- **Before `/gsd-verify-work`:** full suite green, then the manual macOS/Windows checkpoint
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Requirement-level map from `02-RESEARCH.md` "Validation Architecture", filled with the task IDs of `02-01-PLAN.md` to `02-08-PLAN.md`. "Unit run" means `PATH="/opt/pi-claude-marketplace/bin:$PATH" node --import "$PWD/scripts/isolated-pi-home.mjs" --test <files>`; every unit task also runs `npm run test:coverage:direct -- <source>` for each touched pair. "Profile run" means `npm run test:cucumber:profile -- --profile adapter <features>`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | SG-PRC-01 | T-02-01, T-02-04 | the launcher moves unchanged: process-group kill, no shell, absolute Windows lookup | unit (fake and real processes) | unit run of `test/platform/process-run.test.ts test/platform/package-manager.test.ts test/orchestrators/plugin/package-install.test.ts` | ❌ W0 (`process-run.test.ts`) | ⬜ pending |
| 02-01-02 | 01 | 1 | SG-PRC-01, SG-PRC-02 | T-02-02, T-02-03 | stdin written then closed, bounded head and tail capture, hidden console | unit | same unit run | ✅ after 02-01-01 | ⬜ pending |
| 02-02-01 | 02 | 1 | SG-PRC-06 | T-02-08 | `git missing` joins the closed reason set and the published schema | architecture + unit | unit run of `test/architecture/notify-closed-set-locks.test.ts test/architecture/compat-01-no-expansion.test.ts test/architecture/wire-schema.test.ts test/architecture/json-output-docs.test.ts test/shared/notification-types.test.ts test/shared/notify-reasons.test.ts test/shared/notification-wire.test.ts` | ✅ | ⬜ pending |
| 02-02-02 | 02 | 1 | SG-PRC-05 | T-02-05, T-02-06, T-02-07 | `GitCommandError` keeps redacted stderr out of its message; every kind maps to a reason | unit | unit run of `test/shared/errors.test.ts test/shared/git-failure-classifiers.test.ts` | ✅ | ⬜ pending |
| 02-02-03 | 02 | 1 | SG-PRC-06 | T-02-07 | a git-missing add or install row keeps the requirement text | unit | unit run of `test/orchestrators/marketplace/add.test.ts test/orchestrators/plugin/install.messaging.test.ts test/architecture/catalog-uat/catalog-contract.test.ts` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 2 | SG-PRC-01, SG-PRC-02, SG-PRC-03, SG-PRC-06 | T-02-09 to T-02-14 | absolute lookup, hardened environment and argv, neutral credential directory, askpass never runs | unit (fake spawn + real git) | unit run of `test/platform/git-process.test.ts test/platform/git-credential.test.ts test/orchestrators/auth-host.test.ts test/platform/credential-ops-fake.test.ts` | ❌ W0 (`git-process.test.ts`) | ⬜ pending |
| 02-03-02 | 03 | 2 | SG-PRC-01 | T-02-15, T-02-16 | the chokepoint and the BLOCK C zone name the git process module | architecture | unit run of `test/architecture/no-shell-out.test.ts test/architecture/no-credential-leak.test.ts test/platform/git-process.test.ts test/platform/git-credential.test.ts`; `npm run fallow`; `npm run lint` | ✅ | ⬜ pending |
| 02-04-01 | 04 | 3 | SG-PRC-05 | T-02-17, T-02-18, T-02-21 | the stderr corpus maps to kinds in order; no credential in a message or debug line | unit + architecture | unit run of `test/platform/git-failure-kind.test.ts test/platform/git-process.test.ts test/architecture/no-credential-leak.test.ts` | ❌ W0 (`git-failure-kind.test.ts`) | ⬜ pending |
| 02-04-02 | 04 | 3 | SG-PRC-06 | T-02-19, T-02-20 | the macOS shim is git missing before any spawn; a git that stopped working is dropped | unit (injected host) | unit run of `test/platform/git-process.test.ts` | ✅ after 02-03-01 | ⬜ pending |
| 02-05-01 | 05 | 3 | SG-PRC-06 | T-02-22 | without git, a git-source add fails as `{git missing}` and sends no request | unit + cucumber | unit run of `test/platform/git.test.ts test/orchestrators/plugin/marketplace-tag-probe.test.ts`; profile run of `features/marketplace/without-git.feature features/marketplace/git-source.feature features/marketplace/url-source.feature` | ❌ W0 (the feature, `usePiWithoutGit`) | ⬜ pending |
| 02-05-02 | 05 | 3 | SG-PRC-06 | T-02-23 | dir, file, and hosted marketplaces and local plugins work without git; git-source plugins fail as `{git missing}` | cucumber | profile run of `features/marketplace/without-git.feature features/plugin/without-git.feature` | ❌ W0 (`features/plugin/without-git.feature`) | ⬜ pending |
| 02-05-03 | 05 | 3 | SG-PRC-02, SG-PRC-03 | T-02-24, T-02-25 | a credential lookup runs neither the user's askpass program nor the project's own helper | cucumber | profile run of `features/marketplace/git-source.feature` | ✅ | ⬜ pending |
| 02-06-01 | 06 | 4 | SG-PRC-01, SG-PRC-04 | T-02-26, T-02-27, T-02-31 | operands follow `--end-of-options`; the local lane refuses every transport under the user's `always` config | unit (fake spawn + real git) | unit run of `test/platform/git-process.test.ts` | ✅ | ⬜ pending |
| 02-06-02 | 06 | 4 | SG-PRC-03 | T-02-28, T-02-29 | a user `GIT_ALLOW_PROTOCOL` cannot re-allow `ext`; ext, fd, git, ftp, ftps refused; no hook, fsmonitor, or template runs | unit (real git) | unit run of `test/platform/git-process.test.ts` | ✅ | ⬜ pending |
| 02-06-03 | 06 | 4 | SG-PRC-03 | T-02-30 | pointer variables, a nested clone directory, a symlinked cwd, and project rewrites cannot redirect git | unit (real git) | unit run of `test/platform/git-process.test.ts` | ✅ | ⬜ pending |
| 02-07-01 | 07 | 5 | SG-PRC-02 | T-02-32, T-02-35, T-02-36, T-02-37 | the user's ssh with BatchMode and StrictHostKeyChecking from the neutral directory; a repository's `core.sshCommand` never runs | unit (real git on the ssh stand-in) | unit run of `test/platform/git-process.test.ts` | ✅ | ⬜ pending |
| 02-07-02 | 07 | 5 | SG-PRC-02 | T-02-33, T-02-34 | no password, passphrase, or host-key prompt; a timeout leaves no live process | unit (real git on the https and ssh stand-ins) | unit run of `test/platform/git-process.test.ts` | ❌ W0 (`test/platform/process-group.ts`) | ⬜ pending |
| 02-08-01 | 08 | 6 | SG-PRC-01 | T-02-38 | the codebase map matches the rule pack and `NETWORK_SEAMS` | doc check | the task's `node -e` comparison of the docs with `rule-packs/architecture.json` | ✅ | ⬜ pending |
| 02-08-02 | 08 | 6 | SG-PRC-02, SG-PRC-06 | T-02-40, T-02-41 | macOS and Windows lookup, messages, no dialogs, no console, no leftover process | manual (blocking checkpoint) | — (see Manual-Only Verifications) | — | ⬜ pending |
| 02-08-03 | 08 | 6 | SG-PRC-06 | T-02-39 | every D-SG outcome recorded; a deferred check is an open windows entry | doc check | the task's `grep` check of `.planning/PROJECT.md` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/platform/process-run.test.ts` (02-01-01), `test/platform/git-process.test.ts` (02-03-01), `test/platform/git-failure-kind.test.ts` (02-04-01)
- [ ] a zombie-ignoring process-group listing helper, `test/platform/process-group.ts` (02-07-02)
- [ ] `usePiWithoutGit()` in the cucumber world and its step (02-05-01), `features/marketplace/without-git.feature` (02-05-01, 02-05-02), `features/plugin/without-git.feature` (02-05-02), `features/lib/user-git-programs.ts` (02-05-03)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| macOS xcrun-shim detection and message; Windows absolute-PATH lookup, console, and process-tree kill; no credential dialog | SG-PRC-02, SG-PRC-06 | CI and this sandbox run Linux only | `02-08-PLAN.md` task 02-08-02, steps 1-10 (a blocking checkpoint; "deferred to PR" records an open `unrun-verify` windows entry) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
