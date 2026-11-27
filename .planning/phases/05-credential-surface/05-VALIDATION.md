---
phase: "5"
slug: "credential-surface"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-27"
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `05-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + `node:assert/strict` + `strong-mock` (unit, architecture, integration); `@cucumber/cucumber` (behavioral, `adapter` and `builtin` profiles) |
| **Config file** | `package.json` scripts; `cucumber.json`; `.fallowrc.json`; `rule-packs/architecture.json`; `eslint.config.js` |
| **Quick run command** | `env -u GIT_CONFIG_COUNT $(env \| sed -n 's/^\(GIT_CONFIG_\(KEY\|VALUE\)_[0-9]*\)=.*/-u \1/p') node --import "$PWD/scripts/isolated-pi-home.mjs" --test <test-path>` |
| **One feature** | `PATH="$PWD/node_modules/.bin:/opt/pi-claude-marketplace/bin:$PATH" node scripts/cucumber.mjs --profile adapter <feature-path>` (repeat with `--profile builtin`) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick run ~10 s; one feature ~30-120 s; full suite ~20 min |

---

## Sampling Rate

- **After every task commit:** the owner test of each touched source (quick run) plus `npm run test:coverage:direct -- <source>`; the hook runs `npm run check:commit`. A harness or feature task also runs the touched features under the `adapter` profile.
- **After every plan:** `npm run check:static`, plus `features/marketplace` and `features/plugin` under both profiles.
- **Per wave merge and phase gate:** `npm run check` on the combined tree. Only the known `fd` baseline fails (5 scenarios in `features/hook/tool-use.feature`: :296 :355 :443 :1696 :1834).
- **Max feedback latency:** 120 s for a task-level check.

---

## Per-Requirement Verification Map

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| SG-AUTH-01 | helper credential: private add and install succeed, no prompt | cucumber | credentials feature(s) the plans create, adapter profile | ❌ W0 |
| SG-AUTH-01 | only `GITHUB_TOKEN`/`GH_TOKEN`: auth failure; token in no result, no git-host request path or header, no ssh argv | cucumber | same, with git-host header capture | ❌ W0 |
| SG-AUTH-01 | ssh key or agent: no prompt | cucumber (existing) | `features/marketplace/github-transport.feature features/plugin/github-transport.feature` | ✅ |
| SG-AUTH-01 | no extension source reads token variables | architecture | `test/architecture/` env-token test (if planned) | ❌ W0 |
| SG-AUTH-02 | interactive add with no credential: no device code, no `/login/` request | cucumber (fails on HEAD) | credentials feature | ❌ W0 |
| SG-AUTH-02 | print mode: no Device Flow refusal | cucumber (fails on HEAD) | credentials feature / `features/marketplace/github-transport.feature` | ✅ rewrite |
| SG-AUTH-02 | autoapply load and background autoupdate never wait | cucumber (pins) | credentials feature | partly ✅ |
| SG-AUTH-02 | no Device Flow code remains | fallow + architecture | `npm run fallow`; `test/architecture/wire-schema.test.ts`, `test/architecture/json-output-docs.test.ts` | ✅ edit |
| SG-AUTH-03 | Device-Flow-shaped helper entry works for add, install, update, background update | cucumber | credentials feature | ✅ rewrite |
| SG-AUTH-03 | entry still stored after an auth failure the extension saw (404 path) | cucumber | credentials feature | ❌ W0 |
| SG-AUTH-03 | the extension cannot run `git credential` | type + unit | `npm run typecheck`; `test/platform/git-process.test.ts` | ✅ edit |
| GAUTH-04 kept | refused helper credential: `StoredCredentialRejectedError`; none: plain `https-auth` | unit | `test/platform/git.test.ts` | ✅ edit |
| no leak | positional leak gate after the shrink | architecture | `test/architecture/no-credential-leak.test.ts` | ✅ edit |

*Status per task is recorded in each plan's SUMMARY.md.*

---

## Wave 0 Requirements

- [ ] git host request header recording and a "no request the git host received carries {string}" step (`features/lib/https-git-host/server.ts`, `features/step_definitions/git-host.steps.ts`), landed with its first scenario.
- [ ] profile-Pi token variables (`GITHUB_TOKEN`, `GH_TOKEN`).
- [ ] `listenOnLoopback` moved out of `features/lib/github-device-flow/server.ts` before that directory's sign-in stand-in is deleted.
- [ ] architecture test for token-variable reads (optional, recommended).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A real gh helper (`gh auth setup-git`) or Git Credential Manager answers a private github.com clone | SG-AUTH-01 | No test may reach a real remote host | On a machine with `gh auth login` + `gh auth setup-git`, add a private marketplace and install from it; expect no prompt from Pi |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
