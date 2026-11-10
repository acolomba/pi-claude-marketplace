---
phase: "1"
slug: "foundation"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-08"
---

# Phase 1 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Harness to the user's machine | Stand-ins, fixture writers, and launched Pi processes run inside each scenario's temporary home | Sandbox paths, fake tokens, process signals |
| Pi to the network | The in-process redirect sends `github.com` traffic to loopback stand-ins and refuses every other host | Device Flow forms, git smart-HTTP requests |
| Local repository to the remote | Phase branches and records stay local (D-BG-16) | Branch refs, planning records |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-1-01 | Tampering | layout.md Behavioral gaps section | medium | mitigate | The section copies the ROADMAP ownership table row for row and reserves every new feature file and verb module by exact path; the final plan of this phase reconciles it against the files Phase 1 left. | closed |
| T-1-02 | Elevation of privilege | ROADMAP push wording | medium | mitigate | D-BG-16 wording: local branches, commits only to a session's own branch, no push unless the user asks; the old child push command line is removed and its absence is checked. | closed |
| T-1-03 | Information disclosure | `rpcChildEnvironment` | high | mitigate | Variables are copied from typed run and profile fields only; the hermetic test sets the shell's `PI_SUBAGENT_CHILD` and GitHub base override and asserts neither reaches the child environment. | closed |
| T-1-04 | Denial of service | `PiProcess.crash`, `restartPi("after-crash")` | medium | mitigate | `crash()` kills only Pi's own process; the first profile Pi's release keeps `assertStandInsStopped`, so a hook process that outlives the scenario fails it, and hook scripts bound their waits (async-hook plan). | closed |
| T-1-05 | Information disclosure | `PiProfile.withoutGitHubBaseOverride` | high | mitigate | `usePiWithProfile` refuses the option with no extra extension, and the later terminal session loads the same extensions, so no Pi of the scenario runs without the redirect. | closed |
| T-1-06 | Tampering | `leaveStaleStateLock` and its step | low | mitigate | Paths come from `ScenarioWorld.scopeRoot`, which throws on an unknown scope and lies in the run's sandbox; the release removes only that lock directory. | closed |
| T-1-07 | Tampering | `streamSimple` wrapper in `scripted-model/extension.ts` | medium | mitigate | The context-tokens value rides on the message of its own call and is removed before Pi sees it; no module state holds it; calls without it pass through unchanged, proven by the existing scripted features passing. | closed |
| T-1-08 | Repudiation | `upstream/pi.ts` validation projector | low | mitigate | The projector anchors on the tool name, keeps only our parameter paths, and throws on unreadable text, so a Pi rewording fails loudly instead of passing. | closed |
| T-1-09 | Tampering | `earlier-version-state.ts`, `mcp-configuration.ts` writers | medium | mitigate | Every writer takes its root from `ScenarioWorld.scopeRoot`, which lies in the run's sandbox and throws on an unknown scope; no writer calls `getAgentDir` or `locationsFor`. | closed |
| T-1-10 | Repudiation | earlier-release allow-lists | low | mitigate | Each allow-list comes from the schema of the named tag (`git show`), the doc comment names the release and the commit, and the SUMMARY lists the line ranges read. | closed |
| T-1-11 | Denial of service | waiting hook scripts in `hook-files.ts` | medium | mitigate | The release wait gives up after 60 seconds; every lifecycle hook writes a pid file, the profile Pi's release runs `assertStandInsStopped` over it, and Task 3 checks that no seed's hook script remains after the run. | closed |
| T-1-12 | Information disclosure | lifecycle mode of `hook-recorder.ts` | low | mitigate | A lifecycle line holds only the hook name, the pid, the phase, and the exit code; the run line keeps its existing rule of only `CLAUDE_*` variables (T-01-31). | closed |
| T-1-13 | Information disclosure | `github-device-flow/extension.ts` | high | mitigate | Every non-loopback host other than github.com is refused with an error that names it; every decision is logged; the seeds state the log whole with no refused row; the unit cases pin the refusals; the world refuses a launch without the GitHub base override that loads no extension, and the terminal session inherits the extension; `PI_OFFLINE=1` and `--offline` stay set. | closed |
| T-1-14 | Spoofing | fixed access token and the credential store | medium | mitigate | The token is a fixed fake that only the run's git host accepts; `GIT_CONFIG_GLOBAL` points at the sandbox HOME, so `git credential approve` writes only `{home}/.git-credentials`. | closed |
| T-1-15 | Tampering | patched `https.request`, `http.request`, `fetch` | medium | mitigate | Loopback requests pass through unchanged, so the git host, the hosted catalogs, and the MCP stand-ins keep working, proven by the regression features. | closed |
| T-1-16 | Information disclosure | reuse of the git host's private key | low | accept | A one-day self-signed P-256 key made per run in the run's temporary root, for `127.0.0.1` only; removed with the run. | closed |
| T-1-17 | Information disclosure | `runJsonModeCommand` | medium | mitigate | The environment comes from `rpcChildEnvironment` (allowlist plus the run's git keys and `TMPDIR`), the sandbox from `resolveRpcSandbox`, and stdin is closed, so no shell variable or input reaches Pi. | closed |
| T-1-18 | Denial of service | json Pi, terminal Pi | medium | mitigate | The json driver kills its process group past a named deadline; the terminal Pi registers its stop as a release when it starts (`startTuiSession`). | closed |
| T-1-19 | Tampering | `terminalScreen` | low | mitigate | Unit cases pin each control sequence the renderer writes, and the seeds' red proofs show a broken model fails them. | closed |
| T-1-20 | Elevation of privilege | branch creation and the brief's git rules | medium | mitigate | Branches are created with plain local `git branch` commands, nothing is pushed (the remote listing is checked empty), and the brief says commit only to the own branch and push nothing unless the user asks (D-BG-16). | closed |
| T-1-21 | Tampering | frozen-file record and brief | medium | mitigate | The record is checked against `git diff --name-only cf48b0df..HEAD`, and the SUMMARY maps every roadmap Milestone rule to the brief section that carries it, so a child cannot read permission to edit a frozen file into the brief. | closed |
| T-1-SC | Tampering | npm/pip/cargo installs | high | accept | This plan installs no package; there is nothing for the package-legitimacy gate to check. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Evidence: each plan SUMMARY's `## Threat Flags` names the mitigation in code; the high-severity ones were spot-checked: T-1-03 (`test/e2e/_rpc.ts` copies `PI_SUBAGENT_CHILD` only from the profile environment), T-1-05 (`features/support/world.ts` refuses `withoutGitHubBaseOverride` without an extra extension), T-1-13 (`features/lib/github-device-flow/routing.ts` refuses every other host, and github.com when its config is missing).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-1-01 | T-1-16 | The Device Flow stand-in reuses the git host's per-run, one-day, self-signed P-256 key in the run's temporary root; it protects nothing beyond the scenario | plan disposition (autonomous run) | 2026-11-08 |
| AR-1-02 | T-1-SC | Phase 1 installs no package, so there is nothing for the package-legitimacy gate to check | plan disposition (autonomous run) | 2026-11-08 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-08 | 22 | 22 | 0 | orchestrator (L1 grep depth, register authored at plan time) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-08
