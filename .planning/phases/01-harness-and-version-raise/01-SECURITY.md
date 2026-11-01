---
phase: "01"
slug: "harness-and-version-raise"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

The register comes from the `<threat_model>` blocks of the 15 plans (`01-01-PLAN.md` to `01-15-PLAN.md`), written at plan time. Each mitigation was checked against the merged tree at ASVS level 1 (the code or test the plan names exists and does what the plan promised). Block threshold: `high`.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry -> repository | Pi 1.4.0, pi-ai, pi-tui enter the lockfile; the three companions enter the gitignored peer cache; Pi 1.4.0 enters the e2e fixture lock | package tarballs (code execution risk) |
| bridge-written entry -> pi-mcp-adapter -> MCP server | literal text the bridge writes crosses the adapter's three interpolation passes | environment variable values, credentials |
| plugin MCP config -> mcp-adapter.json -> adapter | a delegated `${NAME:-default}` is expanded with the user's environment at connect time | environment variable values, credentials |
| developer shell -> profile Pi | the scenario child environment must not inherit credentials or temp paths | developer environment |
| scenario -> child processes | profile Pi, companion runners, stand-ins must stop with the scenario | process lifetime |
| plugin manifest / marketplace entry -> resolver | untrusted declared paths decide which folders are staged | file paths (containment) |
| user-typed arguments -> skill or command body | argument text becomes model input and later `!` command text | user input |
| installed plugin file -> local shell | `!` patterns in a user-invoked skill or command body run on the user's machine | shell commands |
| user prompt -> Pi input handler chain | every prompt passes the new command-invocation handler | user input |
| workflow matrix values -> CI shell | shard paths flow from the matrix into a `run:` step | CI script text |
| decision records -> parallel sessions | component sessions act on recorded decisions without re-asking | planning records |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Information disclosure | `bridges/mcp/adapter-escape.ts` | high | mitigate | `TRIGGER` (line 30) is `/\$env:\|\{env:\|\$(?=\{\w+(?:\}\|:-))/g`, so `$` before `{NAME:-` is escaped; `test/integration/adapter-expansion-conformance.test.ts` runs the nesting alphabet over both the expanded and the literal path (`PROPERTY_PATHS = [mismatchFor, literalMismatchFor]`) against the installed pi-mcp-adapter 7.0.0 | closed |
| T-01-02 | Tampering | `scripts/install-test-peers.mjs` | medium | mitigate | `--ignore-scripts` (l.129), `--before=${cutoff}` (l.136), `holdsFloors` and `assertRegistryIntegrity` (l.140-144) run on a temp dir before `swapIntoCache` renames it into place | closed |
| T-01-03 | Tampering | adapter conformance drift guard | medium | mitigate | `INTERPOLATION_PASSES` (conformance test l.732-736) names the 7.x `${NAME:-default}` pass first; `passesInOrder` fails on a reordered or changed adapter | closed |
| T-01-04 | Tampering | `test/e2e/pi-peer-floor/package-lock.json` | medium | mitigate | 121 integrity hashes, every `resolved` URL on registry.npmjs.org; `ci.yml` l.210 and `e2e-nightly.yml` l.36 run `npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts` | closed |
| T-01-05 | Repudiation | README / CHANGELOG version statements | low | accept | see Accepted Risks Log | closed |
| T-01-06 | Repudiation | `.planning/PROJECT.md` D-CF1 rows | medium | mitigate | autonomously settled D-CF1 rows cite their DUBIOUS-CHOICES entry (plan 01-02 Task 3) | closed |
| T-01-07 | Tampering | cucumber rules ownership table | low | accept | see Accepted Risks Log | closed |
| T-01-08 | Tampering | `index.ts` input handler order | medium | mitigate | `registerCommandInvocation(pi)` (l.269) follows `registerSkillAliases(pi)` (l.266), after the hooks `input` dispatch; `test/index.test.ts` pins the order through strict-mock `pi.on("input", ...)` expectations (l.381-486) | closed |
| T-01-09 | Spoofing | `descriptionFallback` output | low | accept | see Accepted Risks Log | closed |
| T-01-10 | Repudiation | `.fallowrc.json` `ignoreExports` | low | accept | see Accepted Risks Log | closed |
| T-01-11 | Information disclosure | `test/e2e/_rpc.ts` `rpcChildEnvironment` | high | mitigate | the environment is built from scratch (l.215-238), only the typed `profileEnvironment.TMPDIR` is added; `test/architecture/hermetic-git-environment.test.ts` sets an inherited `TMPDIR: "/shell/tmp"` and `deepStrictEqual`s the whole result | closed |
| T-01-12 | Tampering | companion temporary files | medium | mitigate | `features/support/world.ts` `usePiWithProfile` sets `TMPDIR` to `{home}/tmp`; `Before()` in `features/support/pi-process.ts` (l.118-135) empties every sandbox directory | closed |
| T-01-13 | Denial of service | profile Pi and stand-in processes | medium | mitigate | the profile release runs `pi.stop()` (stdin close, grace, `killProcessGroup` of the detached group), then `assertStandInsStopped(harness)` (`features/lib/turn-records.ts` l.78) asserts every recorded pid is dead | closed |
| T-01-14 | Repudiation | scripted model | medium | mitigate | `features/lib/scripted-model/extension.ts` l.94-97 throws on a call past the script (no fallback reply); the `After` hook asserts `unusedScriptSteps` is empty | closed |
| T-01-15 | Denial of service | Pi auto retry | low | mitigate | `usePiWithProfile` sends `set_auto_retry` with `enabled: false` (`world.ts` l.583) | closed |
| T-01-16 | Elevation of privilege | `domain/component-paths.ts` declared paths | high | mitigate | every declared path passes `addValidatedComponentPath` -> `resolveContainedComponentPath` (absolute and escaping paths refused, NFR-10); the D-CF1-06 rule (`conventionalFolderApplies`) only decides whether the conventional `<kind>/` folder is added | closed |
| T-01-17 | Repudiation | silent loss of a folder's components | medium | mitigate | `shadowedFolders` feeds the discovery warning; `features/plugin/staging-warnings.feature` covers install (l.52) and update (l.74) | closed |
| T-01-18 | Tampering | argument values | high | mitigate | `guardBangs` (`domain/argument-substitution.ts` l.133-138) splits `` `! `` / `` !` `` and backslashes a word-initial `!`; this also breaks ```` ```! ```` fence openers; cases at `test/domain/argument-substitution.test.ts` l.325, l.341 | closed |
| T-01-19 | Tampering | re-substitution | medium | mitigate | `wrapValue` (l.107-113) wraps every inserted value and protects its `$`; case "never substitutes a value again in a later pass" (l.303) | closed |
| T-01-20 | Denial of service | oversized input | medium | mitigate | `MAX_CHARACTERS = 4_000_000` throws `InvocationTooLargeError` (l.144-146, cases l.476/l.497); `domain/shell-words.ts` `MAX_PARSED_LENGTH = 10_000` takes the whitespace split (cases l.173/l.184) | closed |
| T-01-21 | Elevation of privilege | `platform/prompt-shell.ts` running plugin commands | high | accept | see Accepted Risks Log (D-CF1-02, DC-04) | closed |
| T-01-22 | Tampering | arguments inside `!` commands | high | mitigate | argument values pass `guardBangs` in the argument core (T-01-18), so they cannot open a new `!` pattern; `expandContextInjections` scans once and never rescans command output, so output cannot trigger a second command. Edge composition (substitution, then injection) lands with Phases 2 and 3 (see Carry-forward) | closed |
| T-01-23 | Denial of service | a runaway command | medium | mitigate | `platform/prompt-shell.ts`: `DEFAULT_TIMEOUT_MS = 120_000`, detached spawn, `signalGroup` -> `process.kill(-pid, ...)` SIGTERM then SIGKILL after the grace; the run never rejects | closed |
| T-01-24 | Information disclosure | failure output on stdout | medium | mitigate | `domain/context-injection.ts` throws `ContextInjectionError` and writes nothing; fallow `no-stdio` bans direct writes. The edge notify through `shared/notification-dispatch.ts` lands with Phases 2 and 3 (see Carry-forward) | closed |
| T-01-25 | Tampering | widening the D-21 whitelist | medium | mitigate | `rule-packs/architecture.json` `child-process-chokepoint` exclude list, `test/architecture/gate-targets.ts` `SHELL_OUT_EXEMPT_TARGETS`, and the five-site message all name `platform/prompt-shell.ts` together; `test/architecture/no-shell-out.test.ts` rejects dynamic `import()` and `require` | closed |
| T-01-26 | Information disclosure | delegated defaults holding adapter marker text | high | mitigate | `holdsAdapterMarker` / `leavesDefaultToAdapter` (`domain/claude-mcp-variables.ts` l.154-171) keep install-time resolution for a default holding `$env:` or `{env:`; conformance test "outputs Claude's value for every short marker-default value" (l.406) | closed |
| T-01-27 | Information disclosure | deny-listed credentials | high | mitigate | `segmentFor` runs `isDenied` before the delegation branch; a remote base-URL name never delegates; conformance test "no deny-listed credential reaches pi-mcp-adapter's url or headers output" (l.625) | closed |
| T-01-28 | Denial of service | OAuth servers refused at connect | medium | mitigate | `bridges/mcp/adapter-entry.ts` `installTimeHeaderValue` / `isCleanHeaderValue` read a `${NAME:-default}` reference as the install-time rule does before `withOAuthDecision` keeps or drops `auth` (D-08-04) | closed |
| T-01-29 | Information disclosure | `features/lib/pi-registry-probe/extension.ts` | low | accept | see Accepted Risks Log | closed |
| T-01-30 | Repudiation | a sampled listing | medium | mitigate | `features/step_definitions/session.steps.ts` l.152-168 `deepStrictEqual`s the whole prompt-template command set | closed |
| T-01-31 | Information disclosure | `features/lib/hook-recorder.ts` | low | mitigate | records only names with `CLAUDE_` prefix or `CLAUDECODE` (l.43) from the allowlist environment of T-01-11 | closed |
| T-01-32 | Denial of service | hook processes | low | accept | see Accepted Risks Log | closed |
| T-01-33 | Denial of service | orphaned MCP stub | medium | mitigate | `features/lib/mcp-stub-server.ts` writes its pid file `wx` and removes it then exits on stdin close (l.162-182); the profile release asserts remaining pids are dead (T-01-13) | closed |
| T-01-34 | Information disclosure | stub log | low | accept | see Accepted Risks Log | closed |
| T-01-35 | Tampering | `<agent dir>/mcp-adapter.json` approval | low | mitigate | `writeProjectServersAllowedConfig` (`features/lib/mcp-configuration.ts` l.68-71) writes with `flag: "wx"` under the sandbox agent dir; the step registers `rm` on release | closed |
| T-01-36 | Spoofing | an untrusted scenario that is really trusted | medium | mitigate | both scenarios of `features/agent/project-trust.feature` start with "the project holds a pi settings file" (`companion.steps.ts` l.59-65); the trap run without it is recorded in `01-07-SUMMARY.md` | closed |
| T-01-37 | Denial of service | a child agent left running | low | mitigate | scenarios pass `"async":false` (foreground only); the child runs in the profile Pi, whose group the release stops | closed |
| T-01-38 | Denial of service | background workflow run | low | mitigate | `features/step_definitions/workflow/runs.steps.ts` l.95-104 waits for a progress entry with a `TERMINAL_STATUSES` status; the release stops the profile Pi's group | closed |
| T-01-39 | Tampering | the fixture workflow script | low | accept | see Accepted Risks Log | closed |
| T-01-40 | Tampering | `.github/workflows/ci.yml` template injection | medium | mitigate | `behavioral` job passes `${{ matrix.paths }}` only through `env: SHARD_PATHS` (l.172-174); zizmor runs in pre-commit and the Lint workflow | closed |
| T-01-41 | Denial of service | CI timeouts | low | mitigate | `behavioral` job `timeout-minutes: 15` (the floor), above 1.5x the estimated 3.4 min shard run; the comment (l.130-138) records that the figure is a local estimate to re-measure | closed |
| T-01-42 | Tampering | peer installs in CI | medium | mitigate | `test:cucumber` = `node scripts/install-test-peers.mjs && cucumber-js` (T-01-02 controls); `npm ci --ignore-scripts` (l.165), enforced by `lint:workflows` | closed |
| T-01-SC | Tampering | npm installs (plans 01-01, 01-15: high, mitigate; all other plans: low, accept, no install) | high | mitigate | `01-01-SUMMARY.md` "Package legitimacy" records `npm view <spec> repository.url scripts.postinstall dist.integrity` for all six specs (no postinstall, expected repositories); `01-15-SUMMARY.md` records the same for Pi 1.4.0 and `--ignore-scripts` installs | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Carry-forward to Phases 2 and 3

The `!` injection and argument modules (`domain/argument-substitution.ts`, `domain/context-injection.ts`, `platform/prompt-shell.ts`) are not yet called from any edge handler; `.fallowrc.json` `ignoreExports` holds them (T-01-10). When the skill and command invocation handlers wire them, the phase that does it must show: substitution runs before `expandContextInjections`; a `ContextInjectionError` or `InvocationTooLargeError` is reported through `shared/notification-dispatch.ts` and nothing reaches the model; only user-invoked skills and commands reach the runner (D-CF1-03). These complete T-01-22 and T-01-24 end to end.

### Summary Threat Flags

| Flag | Source | Disposition |
|------|--------|-------------|
| file-access: `{home}/tmp/jiti` symlinks to `<run root>/jiti-cache`, which outlives each scenario's sandbox reset | `01-03-SUMMARY.md` | informational: test-only, holds compiled repository and peer sources only, removed by `AfterAll` with the run root; no new threat |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-05 | Text-only; a wrong floor is caught by the peer-floor tests, and the docs name only what the manifest declares | plan 01-15 threat model | 2026-11-01 |
| AR-01-02 | T-01-07 | A wrong owner surfaces as a merge conflict at the parent merge gate; plan 01-09 reconciled the rules with the harness | plan 01-02 threat model | 2026-11-01 |
| AR-01-03 | T-01-09 | The fallback description comes from the installed plugin's own file, the same trust as its frontmatter description; cut at 100 characters | plan 01-10 threat model | 2026-11-01 |
| AR-01-04 | T-01-10 | `ignoreExports` hides unused exports in six files until Phases 2 and 3 wire them; the parent removes the entries after those merges | plan 01-10 threat model | 2026-11-01 |
| AR-01-05 | T-01-21 | D-CF1-02: Pi has no permission modes, so `!` commands run as in upstream `bypassPermissions`; they come from a plugin the user installed (same trust as its hooks) and run only on user invocation (D-CF1-03); recorded as DUBIOUS-CHOICES DC-04 for user review | plan 01-13 threat model (D-CF1-02) | 2026-11-01 |
| AR-01-06 | T-01-29 | Test-only extension outside `extensions/`, loaded only in a sandboxed profile Pi; never shipped | plan 01-04 threat model | 2026-11-01 |
| AR-01-07 | T-01-32 | The recorder exits when stdin ends; the hooks bridge timeout bounds it | plan 01-05 threat model | 2026-11-01 |
| AR-01-08 | T-01-34 | The stub logs only JSON-RPC messages inside the sandbox harness directory; no environment | plan 01-06 threat model | 2026-11-01 |
| AR-01-09 | T-01-39 | Fixed deterministic fixture script written into the sandbox; no agent call, no network | plan 01-08 threat model | 2026-11-01 |
| AR-01-10 | T-01-SC (plans 01-02 to 01-14) | These plans install no package; peer cache and fixtures come from the verified installs of plans 01-01 and 01-15 | plan threat models | 2026-11-01 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 43 | 43 | 0 | gsd-secure-phase (ASVS L1, inline verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01
