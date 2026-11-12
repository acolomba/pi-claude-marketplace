---
phase: "1"
slug: "companion-floors-and-mcp-defaults"
# status lifecycle: draft (seeded by plan-phase) -> validated (set by validate-phase section 6)
status: validated
nyquist_compliant: false
wave_0_complete: true
created: "2026-11-11"
---

# Phase 1 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `01-RESEARCH.md`, section "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` with `node:assert/strict` and `strong-mock`; `@cucumber/cucumber` for `features/` |
| **Config file** | `cucumber.json` (profiles `adapter`, `builtin`); `package.json` scripts |
| **Quick run command** | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test <test-path>`, or `npm run test:coverage:direct -- <source-path>` for one pair |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick: under 30 seconds; full: about 20 minutes |

---

## Sampling Rate

- **After every task commit:** the owner test of each changed source, and `npm run test:coverage:direct -- <path>` for its pair. The commit hook runs `npm run check:commit`.
- **After every plan wave:** `npm run check` on the combined tree.
- **Before `/gsd-verify-work`:** `npm run check` green, plus the two one-off slow runs of D-PG1-14 recorded.
- **Max feedback latency:** a 30-second target for each focused command. Record elapsed times; no new-peer timing has been measured during planning.
- **Slow completion-gate exception (01-01-03):** the initial measurement of the full suite and final `npm run check` take about 20 minutes and are outside the focused-feedback target. The final check still requires exit 0 within the configured 2,400-second timeout, and every wave still requires the combined-tree check. Task 01-01-03 runs the three existing single-scenario commands individually for focused feedback and records any run over 30 seconds; neither those checks nor a passing hook replaces the full gate.

---

## Per-Task Verification Map

**Approved scope/budget exceptions (2026-11-11):** the user explicitly authorized,
"Allow size/budget exceptions for 01-01 and 01-06; retain all checks". Plan 01-01 keeps
20 files and its 110000-token estimate; plan 01-06 keeps 20 files and its 115000-token
estimate. Both estimates remain low-confidence, with calibration factor 1 and zero
samples. These two exceptions resolve the file-count and smart-zone findings without
splitting either plan or changing any global threshold. All mandatory commit hooks,
behavioral red/green proof, direct coverage, and combined-tree wave, phase, merge, and
handoff `npm run check` gates remain required. The first product commit of 01-06 includes
the architecture byte expectation. This approval is not evidence that any check passed.

A task ID is `<phase>-<plan>-<task>`: `01-03-02` is Task 2 of `01-03-PLAN.md`. The rows are the requirement-level map from the research with the tasks that own each row, and one row for each other task the plans added. A row with two plans names its waves in the same order.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PG-AGENT-02 | T-01-01 | the suite version satisfies the declared range, and only pi-subagents names one | architecture | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/peer-floor.test.ts` | yes, assertions change | passed (automated scope) |
| 01-01-01, 01-01-03 | 01 | 1 | PG-AGENT-02 | T-01-02 | no run reads or writes the real `~/.pi` | integration | `npm run test:integration` | yes, readers change | passed (automated scope) |
| 01-01-03 | 01 | 1 | PG-AGENT-02 | T-01-03 | the pinned texts are the measured ones | cucumber | `npx cucumber-js --profile adapter --name 'A foreground run of an agent granted a plugin MCP tool'` and `--profile builtin` | yes, rows change after measurement | passed (automated scope) |
| 01-01-02 | 01 | 1 | PG-AGENT-07b | T-01-04 | N/A | unit | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts` | yes, cases change | passed (automated scope) |
| 01-01-03 | 01 | 1 | PG-AGENT-07b | -- | N/A | cucumber | `npx cucumber-js --profile adapter --name "With --map-model Claude Code's model names are listed as the models they select"` | yes, row and projection change | passed (automated scope) |
| 01-01-01 | 01 | 1 | PG-MCP-02 | -- | N/A | architecture | `test/architecture/peer-floor.test.ts`, `test/bridges/mcp/adapter-entry.test.ts` | yes, assertions change | passed (automated scope) |
| 01-03-02 | 03 | 2 | PG-MCP-02 | T-01-08 | the project's rule equals the installed adapter's | integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/adapter-tool-name-conformance.test.ts` | yes | passed (automated scope) |
| 01-03-01 | 03 | 2 | PG-MCP-02 | T-01-07 | a long name is cut as pi-mcp-adapter 7.0.1 cuts it | unit | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-implementation.ts` | yes, new cases | passed (automated scope) |
| 01-03-01 | 03 | 2 | PG-MCP-02 | -- | N/A | cucumber | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/listing.feature` | yes | passed (automated scope) |
| 01-07-01, 01-07-02, 01-07-03 | 07 | 3 | PG-MCP-02 | T-01-18, T-01-19, T-01-20 | a hook that names the full name runs; no hook runs for another server; no hook gets a name the tool does not have | unit and cucumber | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`; `npm run test:cucumber:profile -- --profile adapter features/hook/mcp-tool-names.feature` | yes | passed (automated scope) |
| 01-08-01, 01-08-02 | 08 | 4 | PG-MCP-02 | T-01-22, T-01-23 | a rebuilt name is accepted only when it fits; a cut name is never taken for a proxy call | unit and cucumber | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`; `npm run test:cucumber:profile -- --profile adapter features/hook/mcp-tool-names.feature features/hook/tool-use.feature` | yes | passed (automated scope) |
| 01-05-01 | 05 | 3 | PG-MCP-02 | T-01-11 | the staged exclusion uses the registered name; real-child enforcement remains manual | unit and cucumber | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts`; `npx cucumber-js --profile adapter --name "excludes it under the name pi-mcp-adapter gives it" features/mcp-server/agent-grants.feature` | yes | passed (automated scope) |
| 01-05-02 | 05 | 3 | PG-MCP-02 | T-01-13 | the pi-subagents long-name grant gap is measured or read, and recorded as such | integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/integration/agents-*-grant-conformance.test.ts"` | yes, adapter twin measured the upstream gap | passed (automated scope) |
| 01-04-01, 01-06-01 | 04, 06 | 2, 3 | PG-MCP-01 | T-01-10, T-01-14, T-01-15 | the default never replaces a value the user wrote | unit | direct coverage of `mcp-server-features.ts` and `mcp-builtin-translation.ts` (01-04-01), `adapter-entry.ts` and `marker.ts` (01-06-01) | yes, new cases | passed (automated scope) |
| 01-04-01, 01-04-02 | 04 | 2 | PG-MCP-01 | -- | N/A | cucumber | `npm run test:cucumber:profile -- --profile builtin features/mcp-server/builtin-values.feature features/mcp-server/configuration.feature` | files yes, one new scenario and changed rows | passed (automated scope) |
| 01-06-01 | 06 | 3 | PG-MCP-01 | T-01-16 | ordinary load adds no new write; the existing legacy move restages | cucumber | `npx cucumber-js --profile adapter --name "written to mcp-adapter.json with the idle window of Claude Code" features/mcp-server/configuration.feature` | file yes, new scenario | passed (automated scope) |
| 01-06-01 | 06 | 3 | PG-MCP-01 | T-01-16 | the first product commit includes the architecture test\'s exact-byte expectation and passes the mandatory hook | architecture | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/architecture/integration-materialization-gate.test.ts` | yes, expectation moves from task 2 to task 1 | passed (automated scope) |
| 01-06-02, 01-06-03 | 06 | 3 | PG-MCP-01 | T-01-17 | N/A | unit, integration, cucumber | `npm test`; `npm run test:integration`; `npm run test:cucumber:profile -- --profile adapter features/mcp-server/legacy-move.feature features/plugin/subagent-child.feature` | yes, expectations change | passed (automated scope) |
| 01-09-01, 01-09-02 | 09 | 4 | PG-MCP-01 | T-01-27 | a user-written timeout survives an update | cucumber | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/lifecycle.feature` | yes | passed (automated scope) |
| 01-09-03 | 09 | 4 | PG-MCP-01 | T-01-25, T-01-26 | no temporary harness edit is committed | one-off run, recorded | a temporary scenario once per profile; then `test -z "$(git status --porcelain -- features extensions test scripts)"` | not committed (D-PG1-14) | passed (automated scope) |
| 01-02-01, 01-02-02 | 02 | 2 | PG-AGENT-02, PG-MCP-02 | T-01-05, T-01-06 | every pin is the version the suites run | records | `bash -n scripts/pi.sh`; `node --check test/live-uat/mcp-adapter-canary.mjs`; the integration test whose comment changes | yes | passed (automated scope) |
| 01-05-02 | 05 | 3 | PG-AGENT-02 | -- | the built-in grant test says it proves the suite version, per D-PG1-02 | comment and integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test "test/integration/agents-*-grant-conformance.test.ts"` | yes, header correction moved from 01-02; existing verifier already runs it | passed (automated scope) |
| 01-10-01, 01-10-02, 01-10-03 | 10 | 5 | PG-AGENT-02, PG-MCP-01, PG-MCP-02 | T-01-28 | no page states more than a run or the source shows | documents | `pre-commit run --files docs/mcp-compatibility.md docs/hooks-compatibility.md`, and the greps of the plan | yes | passed (automated scope) |
| 01-11-02 | 11 | 5 | PG-AGENT-02 | -- | the provenance-invisibility test names the suite version, per D-PG1-02 | comment and integration | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/integration/provenance-invisibility.test.ts` | yes, header correction and verifier moved from 01-02 | passed (automated scope) |
| 01-11-01, 01-11-02, 01-11-03 | 11 | 5 | PG-AGENT-02, PG-AGENT-07b, PG-MCP-02, PG-MCP-01 | T-01-29, T-01-30 | no record states more than was decided or measured | records | the D-PG1 row loop of 01-11-01; `pre-commit run --files` on each record | yes | passed (automated scope) |

---

## Wave 0 Requirements

Each item names the task that creates it. No plan runs before plan 01-01, so these are created by the tasks that first need them, not in a separate wave.

- [x] The shared suite-version source for pi-subagents, read by `scripts/install-test-peers.mjs`, `test/integration/optional-peer.ts`, and `features/lib/companions.ts` (D-PG1-02). Task 01-01-01: `test/integration/optional-peer-suite-versions.json`.
- [x] An adapter naming conformance test under `test/integration/` (D-PG1-09); extend `PiMcpAdapterTypes` in `test/integration/pi-mcp-adapter-peer.ts`. Task 01-03-02.
- [x] An adapter grant conformance test under `test/integration/` that measures the pi-subagents long-name gap. Task 01-05-02, which records the gap from source instead when the pi-subagents function cannot be driven with fixtures.
- [x] `features/lib/upstream/subagents.ts`: the model marker, the bare model ID, and the new refusal text, after the first run on the new peers. Task 01-01-03.
- [x] One `Given` step for a user-written `requestTimeoutMs` on an entry. Task 01-09-01; task 01-09-02 adds a second step for an entry that an earlier release wrote.
- [x] A plugin stub server whose tool name can be set, for a cut inside the tool segment. Not planned as a separate item: the scenarios reuse the existing long-name fixtures, whose cut falls inside the server segment, and the cut inside the tool segment is covered by the unit rows of 01-03-01 and the conformance test of 01-03-02. Task 01-07-01 adds the settable tool name only if pi-mcp-adapter cannot resolve the fixture's cut name.

---

## Checks Beyond the Permanent Suite

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| VERIFIED: A real background child calls a granted plugin MCP tool | PG-AGENT-02 | The permanent harness uses a stand-in; a separate local API provider can drive the real detached child | Automated 2026-11-12 on pi-subagents 0.88.0 and pi-mcp-adapter 7.0.1: PID 3263124 called the short echo tool and received echo:pg1-live-short. Actual child provider schemas, transcript and MCP request log agree; see 01-UAT.md and the debug record. |
| BLOCKED: A real background child is not offered a disallowed plugin tool with a name over 64 characters | PG-MCP-02 | Companion behavior prevents a valid positive control, independently of human involvement | Real unrestricted and restricted children without explicit MCP selectors both receive MCP_DIRECT_TOOLS=__none__. Neither receives direct MCP tools, even after connect. The unrestricted long control and permitted short control fail, so exclusion is unverified. See 01-UAT.md. |
| VERIFIED: A call silent for more than 60 seconds succeeds under each implementation | PG-MCP-01 | Slow, and kept out of the suite by D-PG1-14 | Completed 2026-11-12: both temporary profiles passed with 65-second calls and declared 5-second controls. Evidence is recorded in `01-09-SUMMARY.md` under `## Slow call (D-PG1-14)` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Focused-feedback timings recorded against the 30-second target; required slow completion gates recorded under the explicit exception
- [ ] `nyquist_compliant: true` set in frontmatter

**Audit outcome (2026-11-12):** automated task coverage passed; the real-child
granted call also passed in a separate automated run. The long exclusion check is
blocked by installed companion behavior. `nyquist_compliant` stays false until that check and the
focused timing sign-off are resolved. No additional test implementation gap was
found: all 28 tasks have automated verification, all eleven summaries record passing
task checks, and the conformance tests and four lifecycle scenarios exist.

| Requirement | Coverage status | Evidence and remaining boundary |
|-------------|-----------------|---------------------------------|
| PG-AGENT-02 | COVERED | Peer-floor architecture checks, installed-companion conformance, foreground scenarios, and documentation checks passed. A real detached child's explicit short grant passed in the recorded automated run. |
| PG-AGENT-07b | COVERED | Agent conversion direct coverage and mapped-model behavioral scenarios passed. |
| PG-MCP-02 | PARTIAL | Naming conformance, hook recovery, proxy-shaped calls, and staged exclusion checks passed. Real detached-child exclusion is blocked because the installed companions suppress direct tools in both controls without explicit MCP selectors. |
| PG-MCP-01 | COVERED | Both implementations' defaults, user precedence, marker lifecycle, and recorded slow/control calls passed. |

Automated evidence: `01-01-SUMMARY.md` through `01-11-SUMMARY.md`; combined
`npm run check` passed at every completed wave through wave 4, including 1,811
adapter scenarios, 155 built-in scenarios, and 354 direct-coverage pairs on
`fed3e0b549b200bc85aa116cd7008db84eacce7a` with Node v26.13.0. The final merged
wave passed `npm run check` on `c2317aee173ea34a2f9096f1cbb714a964b2468d`
with the same counts and Node version (`/tmp/gsd-parity-wave5-check.log`).
The two live checks were initially designated manual-only. The user requested
automation before interruption; the separate real-child runs now supply one pass
and one companion blocker. Stand-in-child scenarios supply neither result.
No acceptance or waiver is inferred.

After the review fix `1e762749`, the final combined-tree `npm run check` passed
with exit 0 on Node v26.13.0: 1,812 adapter scenarios, 155 built-in scenarios,
and 354 direct-coverage pairs (`/tmp/gsd-parity-phase1-final-check.log`). The
clean reference is `ec14242df04a53d91fd8bfdcbe4c3f31977719f0`. Its difference
from the tested source commit contains only planning Markdown; no untracked
build input was present. The independent re-review is clean, and the security
follow-up confirms all 41 threats closed. The separate automation above supplies
the newer live-child evidence.

## Validation Audit 2026-11-12

| Metric | Count |
|---|---|
| Gaps found | 2 |
| Resolved | 1 |
| Escalated | 1 |
