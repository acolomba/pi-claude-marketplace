---
phase: 01-harness-and-version-raise
verified: 2026-11-01T07:20:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".github/workflows/ci.yml"
  - ".planning/phases/01-harness-and-version-raise/01-01-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-01-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-02-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-02-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-03-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-03-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-04-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-04-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-05-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-05-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-06-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-06-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-07-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-07-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-08-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-08-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-09-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-09-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-10-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-10-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-11-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-11-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-12-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-12-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-13-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-13-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-14-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-14-SUMMARY.md"
  - ".planning/phases/01-harness-and-version-raise/01-15-PLAN.md"
  - ".planning/phases/01-harness-and-version-raise/01-15-SUMMARY.md"
  - "extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts"
  - "extensions/pi-claude-marketplace/domain/shell-words.ts"
  - "features/lib/hook-recorder.ts"
  - "features/lib/mcp-stub-server.ts"
  - "features/lib/pi-process.ts"
  - "features/lib/pi-registry-probe/extension.ts"
  - "features/lib/scripted-model/extension.ts"
  - "features/lib/scripted-model/script.ts"
  - "features/support/world.ts"
  - "package.json"
covered_digest: "v4:sha256:48559d15971680112b8e844c416f013fba81c771def5343b2ad81b50372b5687"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Dispatch ci.yml on GitHub (or push the branch) and read the wall time of the `behavioral tests, lifecycle` and `behavioral tests, components` jobs"
    expected: "Each job finishes in well under 10 minutes, so the 15-minute timeout holds the run with at least 1.5x margin"
    why_human: "The branch is not on origin. The shard times in ci.yml are local runs (lifecycle 94 s and 102 s, components 35 s twice) doubled by estimate for a hosted runner. CI-01 asks for timeouts that hold the measured run. The local measurement is real, the hosted-runner figure is an assumption that only a CI run can settle."
  - test: "Accept or reject the HAR-06 observation change recorded in 01-07-SUMMARY (coverage D2, human_judgment: true)"
    expected: "A decision on whether the trusted and untrusted scenarios may observe a project-scope agent run (`agentScope: project` refused for want of trust) instead of the agent list"
    why_human: "The plan's truth named the agent list. pi-subagents 0.84 lists project agents whatever the trust, so the list cannot show the difference. The verifier judges the replacement a faithful pair (see Truth 4), but the executor flagged it as a judgment call and the project's parity rule says the user decides."
---

# Phase 1: Harness and Version Raise Verification Report

**Phase Goal:** A component phase can write its scenarios by adding only its own files: Pi and its three companions run at their latest releases with the declared floors raised, a scenario can start a profile Pi with a scripted model and the stand-ins that observe each kind, every kind has a seed scenario, and the decisions that span more than one component phase are recorded.
**Verified:** 2026-11-01T07:20:00Z
**Status:** passed (both human-verification items resolved 2026-11-01, see "Human Verification Resolution")
**Re-verification:** No, initial verification

The tree is branch `claude/quirky-planck-hhm592` at `5dbc77a`. Every claim below comes from reading the code and running targeted tests in this session. The long suites were not re-run (`npm run check`, full cucumber, e2e). The orchestrator measured them, see "Gate results reused".

## Human Verification Resolution

Both items in `human_verification` were resolved by the orchestrator on 2026-11-01, under the user's standing instruction for this autonomous run ("make decisions as you see fit ... do not interrupt unless there's a truly unresolvable conflict"). Each is logged in `.planning/DUBIOUS-CHOICES.md` (DC-22) for the user's later review.

1. **CI shard wall time (CI-01): measured, holds.** The orchestrator dispatched `ci.yml` on this branch (run 41283935457, head `5dbc77a`, all 8 jobs green). On the hosted `ubuntu-latest` runner the `behavioral tests, lifecycle` job took 3 min 21 s (cucumber step 2 min 11 s) and `behavioral tests, components` took 1 min 34 s (cucumber step 52 s). The 15-minute timeouts hold each run with more than 4.5x margin. The `ci.yml` comment and the D-CF1-16 row now carry the measured figures (commit `a724bd4`).
2. **HAR-06 observation change: accepted.** The trust pair observes a project-scope agent run (`agentScope: "project"` refused without trust) instead of the agent list, because pi-subagents 0.84 lists project agents whatever the trust. The change tests the requirement's intent (a trusted and an untrusted project differ only in the trust entry, and only the trusted one runs its agent), and it diverges from no upstream behavior: it is a choice of what the test observes. The pi-subagents listing behavior and Claude Code's own handling of agents in an untrusted project are carried to the agents phase.

## Goal Achievement

### Observable Truths

| # | Truth (ROADMAP success criterion) | Status | Evidence |
| --- | --- | --- | --- |
| 1 | `package.json` declares the raised floors and the new optional peer, with no companion in the lockfile, the peer installer installs all three at their floors, the floor tests prove them, and the docs name the versions (VER-01, 02, 03, 06) | VERIFIED | `package.json`: peer `pi-coding-agent >=1.4.0`, dev `^1.4.0`, `pi-tui` dev `^1.4.0`, `pi-ai` dev exactly `1.4.0`, `pi-mcp-adapter >=7.0.0 <8`, `pi-subagents >=0.84.0`, `@quintinshaw/pi-dynamic-workflows >=3.15.0 <4`, all three `optional: true`. `grep` of `package-lock.json` finds no `node_modules/` entry for any companion; the lock root mirrors the peer ranges. `scripts/install-test-peers.mjs` lists all three peer names and reads each floor with `minVersion`; the cache holds `pi-mcp-adapter 7.0.0`, `pi-subagents 0.84.0`, `pi-dynamic-workflows 3.15.0`. Installed Pi, pi-tui, and pi-ai are all 1.4.0. `test/e2e/pi-peer-floor/package.json` pins 1.4.0 and `pi-json-output.test.ts` asserts 1.4.0. `node --test` on `peer-floor`, `adapter-escape`, `adapter-entry`, `adapter-expansion-conformance`, `claude-mcp-variables`, and `pi-api`: 320 pass, 0 fail. README, `README.es.md`, `AGENTS.md`, `STACK.md`, and `docs/{mcp,workflows}-compatibility.md` name 1.4.0, 0.84.0, 7.0.0, and 3.15.0. |
| 2 | Under pi-mcp-adapter 7.x a literal the bridge writes, including `${NAME:-default}`, reaches the server unexpanded, the conformance property is re-proved on 7.x, and the `:-` and new-key decision carries an ID (VER-04, VER-05) | VERIFIED | `bridges/mcp/adapter-escape.ts` has a `TRIGGER` regex that also matches `$` before `{NAME:-`, and `escapeTrigger` inserts the split token. `test/integration/adapter-expansion-conformance.test.ts` runs rows through the real adapter 7.0.0 functions (`interpolateEnvVars`) and includes a nested `:-` generator "literal `${NAME:-default}` text which pi-mcp-adapter 7.x expands (VER-04)", the unset, empty, and set precondition for the delegation, and marker-default and adversarial property tests. The suite passes. PROJECT.md carries D-CF1-13 (`:-` delegation, hybrid with install-time resolution for marker defaults, deny-listed names, base-URL names) and D-CF1-14 (`appendStructuredContent` and `roots` join `CARRIED_FIELDS`). |
| 3 | A seed scenario starts a profile Pi with the real extension, scripted model, probe, and the three companions; the model-turn `When` waits for the settled turn and keeps every record; the scripted model fails on overrun or unused steps; probe, recorder, and stub report; the shared Pi keeps no model and no companions; every existing scenario passes (HAR-01..04) | VERIFIED | `world.ts` `usePiWithProfile` starts a separate `PiProcess` loading `SCRIPTED_MODEL_EXTENSION`, `REGISTRY_PROBE_EXTENSION`, then the named companions from their `pi.extensions` entries; `support/pi-process.ts` `BeforeAll` starts the shared Pi with no extra extensions, so it keeps no model. `scripted-model/extension.ts` logs `overflow: true` past the script and has no fallback reply; the `After` hook fails a passing scenario on `unusedScriptSteps` and on an uncompared turn. `session.steps.ts` waits for `agent_settled` and asserts `aborted === false`; no `setTimeout` sleeps in the turn path. `hook-recorder.ts`, `mcp-stub-server.ts`, and `pi-registry-probe/*` exist and are exercised. I ran `npx cucumber-js features/{skill,slash-command,agent,hook,mcp-server,workflow}`: 11 scenarios, 137 steps, all pass. The orchestrator's 1169/1169 covers the pre-existing scenarios. |
| 4 | Profile Pis keep `TMPDIR` and companion writes in the sandbox and reset to an asserted clean baseline; a trusted and an untrusted scenario both pass; each of the six directories has a seed using its kind's writer and step module; `check:features` is green; the cucumber skill describes the profile Pi, scripted model, stand-ins, and ownership table (HAR-05..08) | VERIFIED | `usePiWithProfile` sets `TMPDIR` to `{home}/tmp` inside the sandbox, links only the jiti compile cache to the run root, and registers a release that stops the Pi and then asserts every stand-in pid is dead (`assertStandInsStopped`). The shared `Before` hook empties every sandbox directory and asserts no skills, payloads, marketplaces, or git host state. `After` asserts no unused script steps. `features/agent/project-trust.feature`: the trusted scenario runs `demo:reviewer` as a project-scope agent; the untrusted scenario (`in an untrusted project`, no `trust.json` entry) gets pi-subagents' own "requires project trust" refusal. Both pass, and both hold the same settings file, so only trust differs. The step `pi-mcp-adapter allows project mcp servers for the user` is a separate `Given` and is used by `mcp-server/invocation.feature`. Directories `features/{skill,slash-command,agent,hook,mcp-server,workflow}/` each hold a seed; each kind has `lib/<kind>-files.ts` and `step_definitions/<kind>/*.steps.ts`. `npm run check:features` exits 0 (no unused or ambiguous step). `.agents/skills/cucumber/rules/layout.md` carries the ownership table and frozen-file list; `world-and-stand-ins.md` has the sections "Profile Pis and the scripted model", "The scripted model", and "Stand-ins of the profile Pi". See human item 2 for the HAR-06 observation change. |
| 5 | Pre-fan-out decisions and the four 2026-10-31 decisions carry IDs, the PROJECT.md bullet that contradicts D-07 is corrected, the CI behavioral job installs the companions and runs lifecycle and component path shards whose timeouts hold the measured run with margin, and `npm run check` passes (DEC-01, DEC-02, CI-01) | VERIFIED (timing assumption routed to human) | PROJECT.md holds D-CF1-01..17. Mapping: D-CF1-01 (FG-01..04 argument rules, append, forms, skill args), -02 (FG-05 injection), -03, -04 (FG-06 description fallback), -05 (FG-10 dropped fields), -06 (FG-14 custom directories), -07 (project trust), -08 (directory names), -09..12 (`user-invocable: false`, `new` as `clear`, `compact`, `fork`). The Out of Scope bullet now reads "Supplemental component paths ... a declared path replaces the conventional folder ... (D-CF1-06)", replacing the line that contradicted D-07. `ci.yml` `behavioral` is a two-entry matrix (`lifecycle`: `features/marketplace features/plugin`; `components`: the six kind directories), `fail-fast: false`, runs `npm run test:cucumber -- $SHARD_PATHS` (which first runs `install-test-peers.mjs`), with the paths passed through `env:`. `test/architecture/behavioral-shard-coverage.test.ts` fails when a feature file is in zero or two shards; it passes. Timeouts are 15 minutes against local runs of about 100 s and 35 s. `npm run check` exit 0 is from the orchestrator (see below). |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `package.json`, `package-lock.json` | raised floors, new optional peer, no companion packages in the lock | VERIFIED | Read and grepped. |
| `scripts/install-test-peers.mjs` | installs all three companions at their floors | VERIFIED | Three peer names, `minVersion` floors, cache holds exact floors. |
| `bridges/mcp/adapter-escape.ts`, `adapter-entry.ts`, `domain/claude-mcp-variables.ts` | literals stay literal under 7.x; `:-` hybrid; new keys carried | VERIFIED | Trigger regex covers `${NAME:-`; conformance and unit tests pass. |
| `features/support/world.ts`, `features/lib/pi-process.ts`, `lib/turn-records.ts`, `lib/companions.ts` | profile Pi, settled-turn wait, release and baseline assertions | VERIFIED | Substantive (819, 339, 87, 132 lines), wired through steps. |
| `features/lib/scripted-model/{extension,script}.ts` | scripted model, call log, overflow marker | VERIFIED | Registered by every profile Pi. |
| `features/lib/pi-registry-probe/*`, `hook-recorder.ts`, `mcp-stub-server.ts` | stand-ins observing each kind | VERIFIED | Each used by a passing seed. |
| Six kind directories, writers, and step modules | one seed per kind | VERIFIED | 7 seed feature files, 11 scenarios pass. |
| `.agents/skills/cucumber/rules/{layout,world-and-stand-ins}.md` | profile Pi, stand-ins, ownership table | VERIFIED | Sections present, `check:features` green. |
| `.github/workflows/ci.yml` | two behavioral shards with companions installed | VERIFIED | See Truth 5. |
| `domain/{argument-substitution,shell-words,context-injection,description-fallback,invocation-frontmatter}.ts`, `platform/prompt-shell.ts`, `edge/command-invocation.ts` | D-CF1-01/02/04/05 cores | VERIFIED as built; not wired by design | 329 unit and architecture tests pass. `registerCommandInvocation` is a pass-through seed; the cores are held in `.fallowrc.json` `entry`/`ignoreExports` lists until Phases 2 and 3 wire them (D-CF1-01 text says so). |
| `domain/component-paths.ts` and the install, update, and info arms (D-CF1-06) | declared `commands`/`agents`/`workflows` path replaces the folder, with a shadow warning | VERIFIED | `features/plugin/component-directories.feature` and `staging-warnings.feature`: 24 scenarios pass. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `index.ts` | `edge/command-invocation.ts` | `registerCommandInvocation(pi)` | WIRED | Registered after the skill-alias rewrite; pass-through by design. |
| profile `Given` steps | `world.usePiWithProfile` | `model.steps.ts`, `companion.steps.ts` | WIRED | Used by all six kinds' seeds. |
| `usePiWithProfile` | scripted model, probe, companions | `--extension` entries, `resolveCompanion` | WIRED | Companions resolved from the verified peer cache. |
| `After` hook | script ledger | `unusedScriptSteps`, `lastTurnUncompared` | WIRED | Fails a passing scenario on leftovers. |
| `ci.yml` shards | `install-test-peers.mjs` | `npm run test:cucumber` | WIRED | Script runs the installer before `cucumber-js`. |
| `check:static` | `check:features` | `run-parallel.mjs` list | WIRED | In `check:static`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| scripted model | script rows, call log | `model.steps.ts` writes the script file; extension reads it and appends JSONL | Yes: scenarios assert whole call lists as literals | FLOWING |
| hook recorder | `hook-runs.jsonl` | real hook processes spawned by Pi | Yes: `tool-use.feature` compares event, stdin, args, `CLAUDE_*` | FLOWING |
| MCP stub | request log | real adapter connection | Yes: `initialize`, `tools/list`, `tools/call` lines compared | FLOWING |
| registry probe | snapshot | Pi `getCommands`/`getAllTools` | Yes: `listing.feature` | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Six seed kinds pass on real Pi 1.4.0 and the three companions | `npx cucumber-js features/skill features/slash-command features/agent features/hook features/mcp-server features/workflow` | 11 scenarios, 137 steps passed | PASS |
| Component-directory and staging-warning scenarios (D-CF1-06) | `npx cucumber-js features/plugin/component-directories.feature features/plugin/staging-warnings.feature` | 24 scenarios passed | PASS |
| Floor, adapter-escape, adapter-entry, 7.x conformance, mcp-variables, pi-api | `node --test` on six files | 320 pass, 0 fail | PASS |
| Cores, shard coverage, no-shell-out, hermetic env | `node --test` on eleven files | 329 pass, 0 fail | PASS |
| Step-definition hygiene | `npm run check:features` | exit 0 | PASS |

### Probe Execution

SKIPPED. The phase declares no `probe-*.sh` scripts.

### Gate results reused (not re-run here)

The orchestrator reports `npm run check` exit 0 and `npm run test:cucumber` 1169/1169 on the tree before the last two tokenizer commits. Plan 01-09 ran `test:e2e` (33 tests, pass after one flaky ADET-01 rerun) and cucumber twice in random order. A fresh `npm run check` on HEAD is the orchestrator's to reconcile. I ran the unit tests of the last two commits (`shell-words`, `prompt-shell`) and they pass.

### Requirements Coverage

Every ID in the phase list is claimed by a plan's `requirements:` frontmatter and appears in REQUIREMENTS.md under Phase 1. No orphans: REQUIREMENTS.md maps exactly these 17 IDs to Phase 1.

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| VER-01 | 01-01, 01-15 | Pi floors and dev ranges, pi-ai exact | SATISFIED | `package.json`, lock root, `peer-floor.test.ts`, installed 1.4.0 |
| VER-02 | 01-01 | Optional peer ranges; workflows peer new; none in lock | SATISFIED | `package.json`, lock grep |
| VER-03 | 01-01, 01-15 | Installer and floor tests at new floors | SATISFIED | installer reads floors; cache at floors; e2e fixture 1.4.0 |
| VER-04 | 01-01, 01-14 | Literals stay literal on 7.x, property re-proved | SATISFIED | `adapter-escape.ts` trigger, conformance suite passes |
| VER-05 | 01-01, 01-06, 01-14 | `:-` and new-key decision with an ID | SATISFIED | D-CF1-13, D-CF1-14 |
| VER-06 | 01-15 | Docs name the new versions | SATISFIED | README, README.es, AGENTS.md, STACK.md, compat docs. Info 1 below |
| HAR-01 | 01-03, 01-04 | Per-scenario profile Pi, shared Pi unchanged | SATISFIED | `usePiWithProfile`; `BeforeAll` shared Pi |
| HAR-02 | 01-03 | Scripted model, call log, overflow, unused steps | SATISFIED | `extension.ts`, `After` hook |
| HAR-03 | 01-03 | Settled-turn `When`, no sleeps | SATISFIED | `session.steps.ts` waits for `agent_settled`, not aborted |
| HAR-04 | 01-04, 01-05, 01-06 | Probe, recorder, stub | SATISFIED | three libs, three seeds pass |
| HAR-05 | 01-03 | Hermetic profile Pi, clean baseline | SATISFIED | TMPDIR in sandbox, pid assertion, `Before` baseline. Warning 1 below |
| HAR-06 | 01-06, 01-07 | Trust and project MCP approval, untrusted pair | SATISFIED (judgment flagged) | D-CF1-07, separate approval `Given`, trust pair passes |
| HAR-07 | 01-03..08 | Six directories, writers, steps, seeds, `check:features` | SATISFIED | listing above |
| HAR-08 | 01-02, 01-09 | Cucumber skill rules | SATISFIED | layout.md, world-and-stand-ins.md |
| DEC-01 | 01-02, 01-10..13 | Pre-fan-out decisions with IDs | SATISFIED | D-CF1-01..08 |
| DEC-02 | 01-02, 01-09 | 2026-10-31 decisions with IDs; contradicting bullet fixed | SATISFIED | D-CF1-09..12; Out of Scope bullet rewritten |
| CI-01 | 01-03, 01-09 | Companions installed, two shards, margin | SATISFIED, timing estimated | `ci.yml`; human item 1 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (changed files under `extensions/`, `features/`, `test/`, `scripts/`, `.github/`) | n/a | `TBD`, `FIXME`, `XXX` | none | grep finds none. The only `PLACEHOLDER` hit is a named constant in `test/live-uat/mcp-adapter-canary.mjs`. |
| `features/lib/pi-process.ts` | 204, 245 | `setTimeout` | Info | A request timeout and the stop grace period, not a sleep in the turn path. |

No stubs found. The pass-through `registerCommandInvocation` and the unwired cores are documented seeds with fallow entries, not hidden stubs.

### Human Verification Required

#### 1. CI shard wall time on a hosted runner

**Test:** Push the branch or dispatch `ci.yml`, then read the wall time of both `behavioral` shards.
**Expected:** Each finishes within about 10 minutes, so the 15-minute timeout keeps 1.5x margin.
**Why human:** The branch is not on origin. The figures in `ci.yml` are local runs doubled by estimate. The comment in `ci.yml` says ESTIMATED, which is honest.

#### 2. HAR-06 observation change

**Test:** Read `features/agent/project-trust.feature` and decide whether a refused project-scope agent run is an acceptable stand-in for the agent list the plan named.
**Expected:** Accept. pi-subagents 0.84 lists project agents regardless of trust, so a run is the only observable that differs between trusted and untrusted.
**Why human:** The executor marked it `human_judgment: true`. The verifier finds the pair faithful (same settings file in both, only the trust entry differs, the refusal text is pi-subagents' own), but the decision belongs to the user.

### Gaps Summary

No blocking gaps. All five roadmap criteria and all 17 requirement IDs have code evidence, and the targeted tests I ran pass. Status is `human_needed` only because of the two items above.

Non-blocking findings:

- **Warning 1 (HAR-05 wording):** REQUIREMENTS.md says "the reset asserts a clean baseline (no queued model steps, no live stub process, no leftover runs or recorder output)". The checks are split. Queued steps and live stand-in pids are asserted at scenario end (`After` and the release). Leftover recorder output is cleared by the next `Before` emptying the sandbox home, not asserted. A leftover workflow run has no explicit assertion; the per-scenario Pi and sandbox wipe make it moot. The behavior holds, and I judge it met, but no single hook asserts the whole list.
- **Info 1:** `docs/json-output.md` lines 70 and 953 still say the real-runtime e2e tests passed "on Pi 1.0.0, both the installed runtime and the exact-floor fixture". The fixture is now 1.4.0. These are dated measurement statements, outside VER-06's named files, and not wrong history. Refresh them when the next e2e run is recorded.
- **Info 2:** `.github/workflows/ci.yml` line 188 reads `uses: $/.github/workflows/sonarcloud.yml`. It is identical in the phase base commit (`002cb84`), so this phase did not introduce it. It looks like a mangled `./`. Check it independent of this phase.
- **Info 3:** An empty directory `/root/.pi/agent/pi-claude-marketplace` dates from 02:10, before my runs. My runs wrote nothing under `/root/.pi`. I cannot attribute the earlier one. It is empty, so no data reached the real home, but an earlier run did create a path there.

---

_Verified: 2026-11-01T07:20:00Z_
_Verifier: Claude (gsd-verifier)_
