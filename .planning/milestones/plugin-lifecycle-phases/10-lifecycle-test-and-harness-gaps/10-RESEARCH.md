# Phase 10: Lifecycle Test and Harness Gaps - Research

**Researched:** 2026-10-27
**Domain:** plugin lifecycle behavior, Cucumber process harnesses, and cross-phase integration residue
**Confidence:** HIGH for repository behavior and work ownership; MEDIUM for the proposed PTY dependency until CI proves its native build on every supported Node line

## Summary

Phase 10 is not one feature. It is the integration sweep after nine parallel implementation phases. The work falls into four ordered groups: shared Cucumber harnesses; three install-cascade failure routes plus apply rollback detail; the cross-phase behavior fixes; and the remaining scenario/unit gaps. The plans must keep those groups visible rather than hiding them in one test-only sweep. [VERIFIED: `.planning/ROADMAP.md:267-282`; `.planning/REQUIREMENTS.md:53-56,109-111`]

The critical production-code dependency is `install-flow.ts`. CAS-08 changes its failure carriers before Phase 11 splits the module. The Phase 10 branch therefore must land and be merged into the Phase 11 branch before CLN-02 begins. [VERIFIED: `.planning/ROADMAP.md:273,287`; `tmp/plugin-lifecycle-wave2-handoff.md`, What is left §3]

The background-autoupdate acceptance tests require Pi's TUI mode on a real pseudoterminal. The existing driver always supplies the literal argument pair `"--mode", "rpc"` and `"--offline"`; RPC intentionally does not arm the pass. [VERIFIED: `test/e2e/_rpc.ts:214-223`, verbatim values quoted] The selected test-only harness launches a checked-in Python standard-library bridge that opens a PTY with `pty.openpty`, relays bytes with `select`, `os.read`, and `os.write`, and execs the existing Pi runtime with explicit `--mode tui`. TypeScript owns the same hermetic sandbox, abort signal, and process-group hard stop as `_rpc.ts`. This host has Python 3.15.1 and `import pty` succeeds; all repository CI/e2e jobs use `ubuntu-latest` on Node 24, whose runner image includes Python. A fail-early availability check and CI smoke test prove `isatty` and TUI readiness before background scenarios run.

**Primary recommendation:** plan the phase as seven dependency-ordered slices: foundation/harness integrity; PTY and completion drivers; CAS-08; MIM-05 plus marketplace re-add residue; XPH warning/error residue; LCTEST behavior cases; then the full-tree gate and handoff.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| TST-01 | Close every LCTEST-01 scenario/unit gap or record a unit-only harness reason | Backlog inventory and a final coverage-ledger task |
| TST-02 | Fix or explicitly decline every LCHARN-01 harness item | Foundation plan owns clone/data listings, token strictness, rules, fixtures, waits, and network-guard disposition |
| TST-03 | Stop fixtures from recording marketplaces without manifests | Shared record-plus-manifest seeder, used by install and reinstall tests |
| CAS-08 | Give every resolved-but-not-installed closure member a row on three failure routes | A common failure carrier populated by root-ledger, plan-step, and mid-walk paths, with one scenario per route |
| MIM-05 | Show rollback-partial phase detail for apply MISS-01 installs | Thread the existing `rollbackPartials` outcome through the missing-dependency row and scenario |
| XPH-01 | Close the Wave 1 cross-phase handoffs | Dedicated integration plans for warnings, import/reconcile parity, completions/reinstall/git revision, TUI autoupdate, and process-tree kill |
| XPH-02 | Close the babysit-review residue | A production-fix plan with a scenario for every user-visible change |
</phase_requirements>

## User Constraints

- Match Claude Code unless a recorded decision ID or Pi capability gap licenses a divergence.
- Fail closed on corrupt or unreadable data.
- The user delegated remaining judgment calls; list any uncertainty rather than silently inventing a third policy.
- Use hermetic homes and local stand-ins; never touch the operator's real `~/.pi` or public network.
- Phase 10 finishes its `install-flow.ts` edits before Phase 11 splits that file.

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Cucumber PTY and completion drivers | Test process harness | Pi edge API | Drive the public command/runtime surface and capture only user-observable results |
| Closure failure rows | Plugin orchestrator | Notification model | The orchestrator knows which members resolved; messaging only renders the carried rows |
| Apply rollback detail | Reconcile orchestrator | Notification model | Apply owns MISS-01 and already carries the install failure outcome |
| Marketplace source re-add | Reconcile planner/executor | Config persistence | Source changes are desired-state transitions, not renderer decisions |
| Warning and error parity | Shared lifecycle outcomes | Command renderers | Facts must survive the carrier before any surface can present them consistently |
| Harness hardening | `features/` libraries/support | Scenario world | Shared stand-ins enforce hermeticity and discriminating assertions |

## Project Constraints (from AGENTS.md)

- Start and remain inside the GSD plan/execute workflow.
- Read a file before editing it and trace callers before changing a function.
- Use CodeGraph before grep/find for code relationships because `.codegraph/` exists.
- Every user-visible `/claude:plugin` behavior change needs a Cucumber scenario that fails without it.
- Keep disk writes atomic and within the declared NFR-10 roots.
- Keep output on the mode-selected notification/JSON strategy; no stdout/stderr writes in command code.
- Use the repository TypeScript, Cucumber, unit-test, local-verification, and committing skills.
- Commit with the hooks, never `--no-verify`; run `npm run check` for the phase gate.
- Every plan SUMMARY must contain `## Threat Flags`.

## Standard Stack

### Existing stack

| Component | Version/source | Purpose | Rule |
|---|---|---|---|
| Node.js | repository runtime `^22.22.2 || ^24.15.0 || >=26.0.0` | source and tests | Keep new harness APIs valid across all supported lines |
| `@cucumber/cucumber` | repository dev dependency | public-surface scenarios | One behavior per scenario; full tables, no sample assertions |
| `node:test` / `node:assert/strict` | Node built-ins | paired unit tests | Preserve direct 100% coverage for every changed source pair |
| existing RPC driver | `test/e2e/_rpc.ts` | hermetic Pi child setup and JSONL result capture | Extract reusable sandbox/environment/process pieces; do not copy security checks |
| Python `pty` + Node `child_process` | Python/Node standard libraries | real PTY bridge and TypeScript lifecycle owner | Checked-in test-only bridge with no dependency install or production hook |

## Package Legitimacy Audit

No package is added. A checked-in Python standard-library PTY bridge avoids native-addon install scripts and keeps the harness test-only.

## Architecture Patterns

### 1. Shared child sandbox, mode-specific transport

Factor only the sandbox resolution, allowlisted environment, Pi runtime path, hard-stop, and process release logic out of `_rpc.ts`. Keep protocol parsing in RPC and terminal interaction in a new TypeScript TUI driver backed by the checked-in Python PTY bridge. The TUI driver should:

1. create a PTY with the same hermetic `HOME`, cwd, extension entry, Git configuration, and offline flags;
2. wait for a stable prompt/ready marker with a bounded deadline;
3. write a plain message or `/claude:plugin` command;
4. collect notification text and state-file evidence until a quiet window;
5. send the shutdown action and enforce the same process-group hard stop;
6. strip ANSI only in the harness projection, never in production output.

Do not make the TUI driver a second general command runner. Its initial public API should cover only the Phase 10 session-start/autoupdate cases.

### 2. Carry failure facts, render once

CAS-08 must extend the failure carrier at the point each closure member is known. The three routes are recorded explicitly in the requirement: root ledger failure, UPD-DEP-D1 plan-step failure, and a catalog lookup throwing mid-walk. [VERIFIED: `.planning/REQUIREMENTS.md:53`]

Use one representation containing the failed subject and the ordered resolved members that did not install. Populate it in all three paths, then let `install-cascade.messaging.ts` render the member rows. Do not reconstruct members from strings or re-walk the catalog in the catch path. The planning catch currently returns `{ err, cascadeFailure: { mcpConfigNotices: [] } }`, while constraint failure also records only `subject`; this is the exact information-loss seam. [VERIFIED: `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:3563-3693`]

### 3. Reuse existing rollback-partial detail

Phase 6 already established the outcome and presentation for partial install rollback. MIM-05 is wiring, not a new grammar. The MISS-01 missing-dependency arm must carry the same `rollbackPartials` and cause data into `PerEntryOutcome`, and apply must emit the phase children using the existing helper. Preserve D-PL6-15 ordering and D-PL6-16 path-token strictness. [VERIFIED: `.planning/phases/06-import-marketplace-planning/06-06-SUMMARY.md:93-206`]

### 4. One seeder owns record plus manifest

Create a test helper that writes a loadable marketplace manifest first and then returns/inserts the matching record. Replace both phantom fixtures named by TEST-PHANTOMMP-01. Do not weaken the production fail-closed read. [VERIFIED: `.planning/BACKLOG.md:3648-3668`]

### 5. Scenarios discriminate the carrier

For each new behavior scenario, include the entire result block/row set and the relevant persisted file or request log. A scenario that only looks for one member row could pass if an extra incorrect row appears. CAS-08 needs three separately titled scenarios, not an outline that hides which production route was used.

## Concrete Plan Decomposition

### Plan 10-01 — Harness integrity and phantom marketplace fixtures

Own only test/harness files. Fix the LCHARN items that do not require a new Pi transport:

- `git-clones.ts` also sees `sources-staging/` and non-git `sources/` contents;
- installation data-directory listing sees directories and symlinks, not only files;
- unknown run tokens throw;
- correct the conflict between the `serves … again` rule and Given-before-When;
- project git revision tokens into installation records and unpinned clone rows;
- rewrite the install-retry seed to one action;
- move the repeated list filter fixture into `list-filters.feature` with a Given-only Background;
- replace fixed 50 ms browse waits with an event promise;
- decide the network guard explicitly. Recommendation: decline the preload in this phase because it cannot govern `git credential` child processes and would claim stronger hermeticity than it provides; preserve the existing local-stand-in/offline gates and record the limitation.
- add the record-plus-manifest seeder and replace both phantom fixtures.

Verification: focused harness/unit checks, `npm run check:features`, affected pair coverage.

### Plan 10-02 — Python stdlib PTY and completion harnesses

Add the Python stdlib PTY bridge, bounded TypeScript TUI driver, world lifecycle support, and narrow steps for session messages/results. Prove:

- background autoupdate runs in TUI;
- duplicate updated plugin names notify once in first-seen order while the payload retains install rows;
- foreground/reload shutdown waits no longer than the recorded cap and aborts the in-flight step;
- RPC stays negative;
- `market` registers the same completions as `marketplace`;
- completion after a git-version mismatch uses list's version rule.

This plan also amends the Cucumber rule text that currently says the session driver exists only for the RPC negative. [VERIFIED: `.agents/skills/cucumber/rules/world-and-stand-ins.md:27-31`]

### Plan 10-03 — CAS-08 closure failure rows

Change `install-flow.ts`, `install-cascade.ts`, `install-cascade.messaging.ts`, and the smallest required update-cascade carrier. Add three scenarios titled by route:

- root ledger failure lists every resolved member that did not install;
- dependency plan-step failure lists every resolved member that did not install;
- mid-walk catalog lookup failure lists earlier resolved members that did not install.

Use failure injection through existing local fixtures/stand-ins, not test-only production options. This plan must finish before Phase 11's install-flow split.

### Plan 10-04 — Apply rollback detail and marketplace source convergence

Wire MIM-05 for MISS-01. Then close the Phase 6 re-add residue in the same reconcile-owned slice:

- `apply` and load re-add a declared marketplace whose source changed, through the marketplace-add path, matching D-PL6-19;
- official fallback source compares as up to date;
- an import re-add updates the local layer when that layer owns the stale source, so it cannot outlive the repair;
- import's own marketplace failure row names the marketplace once, not `<mp>@<mp>`;
- replace the retired D-76-04 citation.

Scenarios must prove the layer file and subsequent `pending`/`apply` state, not only the row.

### Plan 10-05 — Cross-phase warning and error carriers

Close XPH-01/XPH-02 behavior residue with one ownership map and focused commits:

- add-time MISS-01 post-commit hygiene warnings use the tagged channel;
- update/apply dependency moves preserve staging warnings and MCP notices;
- forced reinstall preserves or reports a foreign agents-index row whose generated name it stages;
- failed install root cause redacts absolute paths like member causes;
- commit-time occupied-agent refusal uses a typed error and file-name-only cause; marketplace cascade shows no misleading reason;
- fetch and update classify unrecognized network failures identically;
- install-cascade member rows carry their package note;
- post-clone invalid manifest does not suggest retrying;
- yarn/pnpm-only plugins follow the already-recorded Claude Code rule.

Every changed user-visible arm gets a scenario. Keep purely internal parity checks as unit tests only when no public fixture can reach the arm, and record that reason.

### Plan 10-06 — Remaining lifecycle behavior gaps

Add the LCTEST scenarios/unit cases from `.planning/BACKLOG.md:4257-4290`:

- joined ranges on update causes;
- post-swap update failure and reinstall hint;
- already-enabled root plus missing dependency;
- partially-upgradable list row;
- prune retains the declaration;
- failed apply also uninstalls and disables in the same edit;
- bare fetch continues after one failure;
- `rm` and `ls` alias usage errors;
- invalid-JSON URL add leaves no record and retries cleanly;
- nothing-to-change apply writes no bytes;
- import re-enable rollback partial;
- completion-cache assertion for standalone marketplace add;
- project-scope token and update raw-error unit cases.

Keep the three recorded harness-limit items unit-only unless Plan 10-02 makes them reachable: load autoapply stored-credential behavior, migration-before-base-file, and tagged dependency closure. Preserve the existing unit-only decision for install root `rootCommit` unless a new git-root dependency fixture is independently justified.

### Plan 10-07 — Package process tree scenario, coverage ledger, and phase gate

Add only the harness seam needed to shorten the package-manager deadline in a scenario without adding a production environment variable. Prefer an injected test-world package runner bound at extension construction if the real Pi process can load it; if that is impossible without production test hooks, keep the real process-tree unit case and record the scenario as a harness limit rather than weakening production. The requirement asks for a scenario, so this is the phase's one explicit uncertainty.

Produce a TST-01/TST-02 ledger mapping every backlog bullet to scenario, unit test plus harness reason, fixed harness, or explicit decline. Run `npm run check` unpiped and record command, exit, commit, Node version, and scope.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| TUI child transport | shelling out to `script` or adding a dependency | checked-in Python stdlib `pty.openpty` bridge launched by Node | Real PTY semantics on Ubuntu CI with no dependency install or production seam |
| ANSI cleanup | ad-hoc regex spread across steps | one TUI-driver projection helper | Avoid changing production byte form or inconsistent prompt matching |
| Partial rollback rows | a second row grammar | Phase 6 outcome/render helpers | Existing contract and corpus already pin the wording |
| Marketplace source re-add | direct clone/config mutation in reconcile | marketplace add/update orchestration | Keeps locking, credentials, atomic writes, and hosted sources aligned |
| Network guard claim | a partial Node socket preload presented as total isolation | existing offline/local stand-ins unless all child-process routes are covered | Git credential and git subprocesses bypass a Node-only hook |

## Common Pitfalls

### PTY readiness by sleep

**What goes wrong:** the suite flakes under load or sends input before Pi owns the terminal.

**Avoidance:** wait for a deterministic prompt/ready sequence and enforce an overall deadline. Fixed waits are already a named LCHARN defect.

### ANSI-stripped fragments as assertions

**What goes wrong:** a plausible wrong notification still matches one substring.

**Avoidance:** use state/request evidence for behavior and compare a complete normalized notification record where text is the contract.

### Re-walking after a cascade failure

**What goes wrong:** the catch path sees a different catalog or throws again, losing the original resolved-member order.

**Avoidance:** carry members from the original walk/plan.

### New test-only production options

**What goes wrong:** a seam such as a timeout environment variable becomes public behavior solely for one scenario.

**Avoidance:** inject at existing construction/port boundaries or record a unit-only harness limit. Phase 11 separately removes `restoreDeferredPin`, so Phase 10 must not create its replacement pattern.

### Planning all features in one wave

**What goes wrong:** shared `features/support/world.ts`, `features/lib/pi-commands.ts`, and result projection edits collide, and a later plan unknowingly relies on uncommitted steps.

**Avoidance:** land shared harnesses first; scenarios follow in later waves.

### Treating a passing scenario as a full row assertion

**What goes wrong:** unasserted result rows/notices remain invisible.

**Avoidance:** preserve the world's uncompared-results/rows/notices markers and add the new background/TUI kinds to those checks.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | all tests | yes | v26.12.1 | supported Node 22/24 CI matrix |
| npm | dependency install and gates | yes | repository toolchain | none |
| Python `pty` | TUI bridge | yes | Python 3.15.1 on host; Ubuntu runner standard library | fail early with `python3 -c 'import pty'` |
| `node:child_process` | TUI lifecycle owner | yes | Node v26.12.1 built-in | supported across the repository Node matrix |
| local git/HTTPS stand-in | git/plugin scenarios | existing repository fixtures | repository-owned | none |

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Unit | `node --test <test-path>` |
| Direct coverage | `npm run test:coverage:direct -- <source-or-test>` |
| One scenario | `npx cucumber-js --name '<exact title>'` |
| Feature gate | `npm run check:features` |
| Full behavioral suite | `npm run test:cucumber` |
| Phase gate | `npm run check` |

### Requirement-to-test map

| Requirement | Primary proof | Fast command |
|---|---|---|
| TST-01 | scenario/unit ledger plus named new cases | targeted Cucumber files and owner tests |
| TST-02 | harness owner tests and `check:features` | `npm run check:features` plus affected unit tests |
| TST-03 | install/reinstall owner tests | `node --test test/orchestrators/plugin/install-flow.test.ts test/orchestrators/plugin/reinstall-flow.test.ts` |
| CAS-08 | three named install-dependency scenarios plus pair coverage | `npx cucumber-js features/plugin/install-dependencies.feature` |
| MIM-05 | apply partial-rollback scenario plus apply pair | `npx cucumber-js features/plugin/apply.feature` and direct coverage |
| XPH-01 | TUI, completion, reinstall, reconcile, import scenarios | targeted feature files per plan |
| XPH-02 | user-visible scenarios and focused unit parity cases | targeted feature files and direct coverage |

### Sampling

- Per task: exact named cases or one source/test pair.
- Per wave: every feature and pair touched by that wave; `check:features` after shared step changes.
- Phase: `npm run check` on the clean combined branch. A hook pass is not the phase verdict.

### Wave 0 gaps

- `features/lib/pi-tui.ts` (name may change after layout check): PTY driver.
- PTY lifecycle fields/hooks on `ScenarioWorld`.
- completion capture step/API.
- shared marketplace-record seeder for unit fixtures.
- failure-route fixtures capable of selecting all three CAS-08 paths.

## Security Domain

| Threat | STRIDE | Mitigation in plan |
|---|---|---|
| PTY child touches operator state | Tampering / Information disclosure | Reuse resolved temp sandbox and allowlisted environment from `_rpc.ts`; refuse repository/real-home paths |
| PTY child or stand-in leaks | Denial of service | world release hook, process-group kill, bounded deadlines, idempotent release |
| ANSI/control data spoofs assertions | Spoofing | normalize only in harness projection; assert state/request evidence too |
| Failure causes expose absolute paths | Information disclosure | existing redaction helper at every root/member/rollback path |
| Source-change repair overwrites wrong scope/layer | Tampering | route through locked marketplace add/reconcile code and assert exact config layer |
| PTY bridge substitution | Tampering | checked-in Python source, fixed argument protocol, Python availability check, and CI smoke |

## Assumptions Log

| # | Claim | Risk if wrong |
|---|---|---|
| A1 | The Python bridge supplies a real PTY and explicit `--mode tui` reaches the production TUI path | The Plan 10-02 availability/isatty/readiness smoke fails before dependent scenarios |
| A2 | The package timeout cannot be shortened through the public surface | Keep the discriminating real-child unit proof and record the harness limit; do not add a production test hook |
| A3 | The existing feature fixtures can deterministically reach all three CAS-08 routes without adding product hooks | Add test-side published-catalog fixtures, never a production injection used only by Cucumber |

## Resolved Decisions

1. **Package process-tree scenario seam — resolved.** Keep the existing discriminating real-child unit test and record a harness limit: a Cucumber scenario cannot shorten the production package timeout without a test-only production seam, which this milestone forbids.
2. **Network guard — resolved.** Decline the Node socket preload because it cannot cover git and credential subprocesses; retain the offline flags, loopback stand-ins, and architecture network chokepoint rules without claiming total interception.
3. **TUI transport — resolved.** Launch the existing Pi runtime through a checked-in Python standard-library PTY bridge with explicit `--mode tui`. Fail early on missing `python3`/`pty`, then prove the child sees `isatty` and reaches TUI readiness; no package or production hook enters the Node matrix.

## Plan Size Disposition

Several plans name more files than the preferred planning budget. They remain intact because each task owns one vertical behavior and its complete scenario/source/test wiring; splitting those files across plans would separate a behavior from its discriminating proof. Executors commit and run focused checks at every task boundary, limiting the working set while preserving vertical ownership.

## Sources

### Primary

- Repository roadmap, requirements, backlog, Phase 1-9 summaries/reviews/verifications, and Wave 2 handoff (read 2026-10-27).
- CodeGraph source/call-path reads for `install-flow.ts`, `install-cascade.ts`, `apply.ts`, `apply-outcomes.ts`, `_rpc.ts`, background update, reinstall targets, agents index, and package lockfile handling.

## Metadata

- **Architecture confidence:** HIGH — based on current source and recorded phase handoffs.
- **Test inventory confidence:** HIGH — backlog entries and existing feature/unit files are explicit.
- **PTY dependency confidence:** MEDIUM — official package and current metadata verified; supported-runtime CI not yet run.
- **Research valid until:** implementation completes or any Wave 1 branch changes.
