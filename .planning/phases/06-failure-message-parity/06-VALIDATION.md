---
phase: "6"
slug: "failure-message-parity"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-28"
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `06-RESEARCH.md` § Validation Architecture.

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

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SG-ERR-01 | Remedy per kind, host label, seconds rounding, `1 second`, `<host>` literal, network sub-check on own lines | unit | `node --test test/shared/git-failure-remedy.test.ts` | ❌ Wave 0 |
| SG-ERR-01 | Compaction and bound | unit | `node --test test/shared/child-output.test.ts` | ❌ Wave 0 (move from package-install tests) |
| SG-ERR-01 | Serializer expands a git link; `truncated` unchanged | unit | `node --test test/shared/errors.test.ts` | ✅ (extend) |
| SG-ERR-01 | `redactCauseChain` keeps `GitCommandError` | unit | `node --test test/shared/redact-absolute-paths.test.ts` | ✅ (extend) |
| SG-ERR-01 | Timeout remedy on `marketplace add` (hold arm, `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS=1000`) | cucumber | `features/marketplace/failed-add.feature` | ✅ (extend) |
| SG-ERR-01 | HTTPS auth remedy, GitHub and other host (401 credential arm; 403 status arm) on add, update, plugin install | cucumber | `features/marketplace/credentials.feature`, `features/plugin/credentials.feature`, `features/marketplace/git-source.feature` | ✅ (rewrite pins) |
| SG-ERR-01 | SSH auth remedy (`denied` arm) | cucumber | `features/marketplace/github-transport.feature`, `features/plugin/github-transport.feature` | ✅ |
| SG-ERR-01 | Host key unknown (`host-key` arm) | cucumber | new scenarios in the ssh feature files | ✅ arm exists |
| SG-ERR-01 | Host key changed | cucumber | needs a new ssh stand-in arm | ❌ Wave 0 |
| SG-ERR-01 | Network remedy (`ssh: Could not resolve hostname` from an unregistered ssh host) | cucumber | ssh feature files | ✅ stand-in behavior exists |
| SG-ERR-01 | Stderr-only class (404 `repository … not found` -> `{source missing}` with `git printed:` and no remedy) | cucumber | `features/marketplace/failed-add.feature` or git-source | ✅ arm exists |
| SG-ERR-01 | Same reason and remedy in `apply`, `import`, and the background pass (debug log) | cucumber | `features/plugin/apply*.feature`, `features/plugin/import*.feature`, `features/marketplace/background-update.feature` | ✅ (extend) |
| SG-ERR-01 | An `enable` whose re-clone fails reads the reason `install` reads, directly and in `apply` (CONTEXT follow-up: enable re-clone reason) | unit + cucumber | `node --test test/orchestrators/plugin/enable-disable.messaging.test.ts`, `features/plugin/git-source.feature` | ✅ (extend) |
| SG-ERR-01 | No-stderr remedy | unit (cucumber needs a silent fake git) | `test/shared/git-failure-remedy.test.ts`, `test/platform/git-process.test.ts` | ❌ / ✅ |
| SG-ERR-02 | Widened patterns, `#ref` kept, query values redacted, `Basic`, `%40`, token table rows | unit | `node --test test/shared/redact-credentials.test.ts` | ✅ (extend) |
| SG-ERR-02 | URL spellings replaced before credentials | unit | `node --test test/shared/redact-credentials.test.ts`, `test/platform/git-process.test.ts` | ✅ (extend) |
| SG-ERR-02 | Central debug redaction | unit | `node --test test/shared/debug-log.test.ts` | ✅ (extend) |
| SG-ERR-02 | Credential in URL userinfo and a query token, absent from the notice, the JSON-mode output, and the print-mode debug log | cucumber | new scenario (url source `https://user:secret@{git host}/acme/tools.git?private_token=glpat-…` against a 404 arm; JSON mode step; print mode with `PI_CLAUDE_MARKETPLACE_DEBUG=1`) | ❌ Wave 0 (a debug-log assertion step) |
| SG-ERR-02 | git output never reaches stdout/stderr directly | cucumber | `pi's print mode exits with code 0 and prints nothing` after a failing clone (debug off) | ✅ step exists |

*Status per task is recorded in each plan's SUMMARY.md.*

---

## Wave 0 Requirements

- [ ] `test/shared/git-failure-remedy.test.ts` (new pair).
- [ ] `test/shared/child-output.test.ts` (new pair; move the compaction cases from `test/orchestrators/plugin/package-install.test.ts`).
- [ ] ssh stand-in arm for a changed host key in `features/lib/ssh-git-host/launch.ts` (the OpenSSH `@@@ WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@` banner, an `Offending … key in <path>/known_hosts:N` line, then `Host key verification failed.`, exit 255) plus its step in `features/step_definitions/ssh-host.steps.ts` and its `test/architecture/` harness test.
- [ ] A step that asserts the print-mode stderr (the debug log) holds no given secret, or compares it whole after token projection.
- [ ] Decide the no-stderr scenario: unit only, or a stand-in "git that exits 1 and prints nothing" (A5).

---

## Manual-Only Verifications

None. Every class has an automated check: the no-stderr class is unit-only unless a silent fake git lands (Wave 0 decision), and no test may reach a real remote host or run a real ssh.

---

## Validation Sign-Off


- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
