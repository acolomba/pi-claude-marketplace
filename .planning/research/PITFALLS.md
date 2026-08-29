# Pitfalls Research: v1.19 Unit Test Refactor

**Domain:** Refactoring a mature strict-TypeScript test suite into one mirrored,
guideline-compliant test per production module without changing product behavior
**Researched:** 2026-08-28
**Confidence:** HIGH — findings come from the repository at HEAD, the authoritative
testing guidelines, the preserved handoff contracts, the live structural gates, and
the complete 204-row pair audit

## Summary

This milestone is not a test-file relocation exercise. It is a 204-pair proof of
ownership, direct coverage, isolation, and preserved public behavior. The audit is a
triage snapshot only: 59 pairs passed its focused coverage probe, 83 lacked complete
direct coverage, 60 lacked a mirrored test, and two focused tests failed. All 204 pairs
remain open until a new one-pair plan proves the complete guideline.

The main danger is false completion. Current HEAD already contains useful source and
test refactors, a corresponding-test gate, a direct-coverage runner, and passing
negative controls. None supplies completion credit by itself. The corresponding-test
gate currently reports 107 violations: 60 missing tests, four mirrored tests that do
not import their source, and 43 tests whose names do not map to a production module.
`npm run check` does not currently invoke either the corresponding-test gate or the
direct-coverage gate.

The second danger is behavioral drift disguised as test cleanup. The handoff preserves
20 product/test behavior contracts, eight public surfaces, ten persistence artifacts,
three adapter contracts, and eight named product corrections. Old test expectations
can also be stale: the focused `plugin/update.ts` test currently expects a former
`{no longer installable}` path but reaches the supported git-source network path and
gets `{network unreachable}`. Neither the current output nor the old assertion is
authority by itself. Each pair must resolve such conflicts against the preserved
public contract before changing code or expected bytes.

The third danger is violating the milestone's atomic work boundary. Every executable
plan and implementation commit owns exactly one source-test pair. Shared-helper
rewrites, production module splits, broad formatting passes, and mechanical replay of
the abandoned module graph can silently turn one plan into a multi-pair refactor.

## Critical Pitfalls

### Pitfall 1: Treating audit `PASS` or a retained commit as completion proof

**What goes wrong:**
A roadmap marks the 59 audit `PASS` rows, or modules touched by retained commits, as
done. Those rows proved only that one focused run happened to reach 100% LCOV at the
audit point. They did not prove case structure, exported-surface testing, hermeticity,
meaningful assertions, strong interaction mocks, or one-pair commit ownership.

**Why it happens:**
Coverage percentages and green retained commits look objective. They are cheaper to
count than the full guideline.

**How to avoid:**
- Initialize all 204 pairs as open.
- Close one pair only from its new executable plan and its one-pair implementation
  commit.
- Require focused test, direct function/line/branch coverage, guideline review, and
  the project quality gate as evidence.
- Keep audit classifications as ordering data only.

**Warning signs:**
- A requirement or roadmap begins with fewer than 204 open pairs.
- A row closes with only `PASS`, an old summary, or a commit hash as evidence.
- A completion note reports aggregate coverage instead of the paired LCOV record.

**Phase to address:**
Phase 108's first one-pair plan initializes the open-pair ledger. Every later pair plan
enforces the same closure rule.

---

### Pitfall 2: Mistaking file-name correspondence for test ownership

**What goes wrong:**
A mirrored file exists but does not import and exercise its source, or an architecture,
integration, or legacy split suite owns behavior that belongs in the mirrored test.
Type-only modules and barrels are skipped as “not executable.”

**Why it happens:**
The current suite grew around features and regressions, not one-module ownership. HEAD
has 60 missing mirrored tests, four wrong-import mirrored tests, and 43 unexpected test
paths under the structural gate.

**How to avoid:**
- Map `extensions/pi-claude-marketplace/<path>.ts` directly to
  `tests/<path>.test.ts`.
- Make that test import its paired source directly.
- Give type-only modules compile-time positive and `@ts-expect-error` negative cases.
- Give barrels binding-identity assertions for runtime exports and compiler checks for
  type exports.
- Move lasting public-behavior assertions into the owner before retiring a legacy
  split suite. Do not merely delete duplicates.

**Warning signs:**
- A mirrored test imports only a barrel, helper, or neighboring production module.
- A missing pair is excused by an integration or architecture test.
- A type-only module receives a meaningless runtime constant to create coverage.

**Phase to address:**
Start in Phase 108 and repeat in every pair plan. Barrels and type-only modules still
receive normal one-pair plans.

---

### Pitfall 3: Optimizing for 100% LCOV instead of discriminating behavior

**What goes wrong:**
Cases execute every line but still pass when the public result, exact bytes,
collaborator arguments, or prohibited calls change. Coverage becomes the design goal
instead of the final completeness check.

**Why it happens:**
LCOV is mechanical, while assertion quality requires judgment. Current HEAD also shows
that coverage success is not guideline success: 156 test modules have no
`// arrange` marker, and 16 import the process-wide Node mock tracker.

**How to avoid:**
- Write cases from exported public promises first, then use direct coverage to find
  missing paths.
- Assert whole values, typed error fields, exact output bytes, and resulting public
  state.
- Use `strong-mock` with exact parameters and explicit verification when an
  interaction is the promise.
- Use public behavior rather than exporting private constants or matching private
  regular expressions.
- Remove dead code; never add coverage ignores or blanket exclusions.

**Warning signs:**
- Assertions check only existence, length, one property, or a call count on a stub.
- Expected values come from the production formatter or the subject's output.
- A new export appears in the same commit only so the test can reach a branch.
- Coverage reaches 100% before the test titles identify the exported behavior.

**Phase to address:**
Every one-pair plan. Phase 108 should establish the review checklist on the first
domain/platform pairs.

---

### Pitfall 4: Rewriting the contract to match the current implementation or stale test

**What goes wrong:**
A failing legacy assertion is updated to whatever HEAD emits, or production behavior is
changed to satisfy an obsolete test. Stable notification bytes, error types, resolver
narrowing, persistence formats, network boundaries, and lifecycle corrections drift.

**Why it happens:**
This branch contains both retained product corrections and historical expectations.
The two focused failures demonstrate different triage classes:

- `marketplace/add.ts` uses a Unix-domain-socket fixture that fails with `EPERM` in the
  current environment.
- `plugin/update.ts` has three assertions built on the pre-git-source assumption that
  a GitHub-flavored source is structurally unavailable.

**How to avoid:**
- Classify each mismatch as product defect, stale test, or uncontrolled environment
  before editing.
- Use `BEHAVIOR-CONTRACTS.yaml`, `PUBLIC-SURFACE.yaml`,
  `PERSISTENCE-CONTRACTS.yaml`, and named project decisions as authority.
- Preserve the eight named corrections: update skill preloads, update staging
  warnings, hook exhaustiveness/diagnostics, reconcile failure isolation and complete
  arm application, and the production-reachable device-flow HTTP port.
- Compare exact bytes where bytes are the contract. Keep error classification typed.
- Run the wider relevant suite after the focused pair.

**Warning signs:**
- An expected string changes with no cited public-contract decision.
- A test is deleted because another suite “probably covers it.”
- A refactor changes state schema, path placement, notification grammar, or network
  access while claiming to be test-only.

**Phase to address:**
The one-pair plan that owns the affected production module. High-risk orchestrator,
notification, resolver, and persistence pairs need explicit contract inventories in
their plan evidence.

---

### Pitfall 5: Keeping hidden process and machine state in “unit” cases

**What goes wrong:**
Focused tests fail by machine, order, or concurrency. They read developer credentials,
touch a live network, share a temporary directory, mutate `HOME` or cwd without
case-owned restoration, use real timers, or depend on unsupported local socket
behavior.

**Why it happens:**
The existing suite predates the new isolation rules. A repository scan found 74 test
modules with `process.chdir()` or direct environment assignment. Large helper graphs
also make ownership and cleanup hard to see.

**How to avoid:**
- Give every filesystem case its own `mkdtemp` directory and register cleanup before
  acting.
- Inject clocks, process launchers, HTTP ports, Git operations, and credential
  operations through narrow production contracts.
- Restore unavoidable environment/global changes with the current `TestContext` and
  do not run such cases concurrently.
- Use temporary repositories or loopback-only boundaries owned by the case. Never
  fall back to developer state or the public network.
- Drive scheduling with `t.mock.timers`, not sleeps or retries.

**Warning signs:**
- A focused file fails while the same case passes in a larger run.
- A test writes to the repository, home directory, or a fixed `/tmp` path.
- Cleanup is registered after the action that can throw.
- A failure is `EPERM`, credential-dependent, DNS-dependent, or timer-flaky.

**Phase to address:**
Every filesystem, process, network, credential, or timing pair, beginning with the
domain/platform pairs in Phase 108.

---

### Pitfall 6: Widening the production API for test access

**What goes wrong:**
Private constants, regular expressions, maps, reset hooks, and state readers become
exports. Tests couple to implementation and static analysis treats the accidental API
as intentional.

**Why it happens:**
Direct coverage makes private branches uncomfortable. The abandoned attempt also
identified candidate exports, which can be mistaken for required public surface.

**How to avoid:**
- Test private rules through the export that consumes them.
- Make real side-effecting dependencies explicit through a function parameter,
  factory dependency object, or narrow port.
- Follow the locked v1.19 decisions: keep version internals, hook tool-name internals,
  hook event metadata, and the fetch-backed device-flow adapter private; remove
  production-dead exports; construct credential operations from the narrow process
  boundary.
- Treat the dirty checkpoint as unverified evidence. Do not apply it.
- Add no test reset or test mode.

**Warning signs:**
- An export has no production caller.
- A test uses bracket access, `as any`, or a reset hook.
- A Fallow suppression says only that a test imports the symbol.

**Phase to address:**
The one-pair plan for the owning module. The relevant domain/platform decisions should
be exercised early in Phase 108.

---

### Pitfall 7: Moving shared fakes and contracts in one cross-pair sweep

**What goes wrong:**
A generic `tests/helpers` cleanup changes many corresponding tests and adapters in one
commit. Contract behavior is lost, or a fake passes tests while diverging from the real
adapter.

**Why it happens:**
The handoff preserves GitOps, CredentialOps, and DeviceFlowHttp behavior but explicitly
reconsiders the generic helper layout, global participation inventory, separate fake
tests, and child-process probes. Thirty-three current tests import a generic helper
path.

**How to avoid:**
- Preserve each adapter contract's missing-value, aliasing, overwrite, ordering,
  deletion, and validation behavior.
- Keep the contract near its concern and give every case a fresh adapter instance.
- Prove each shared contract against the real adapter and fake, then run a deliberately
  broken fake as a negative control.
- Move or replace support only inside the one pair that owns the current change. Avoid
  a repository-wide helper migration commit.
- After any shared support change, run the all-pairs direct-coverage check as impact
  detection, not as completion credit for untouched pairs.

**Warning signs:**
- One plan lists several production modules because they share a fake.
- The fake reuses mutable return objects.
- A contract case reads developer Git credentials or a live identity provider.
- A generic helper computes the expected result for the subject.

**Phase to address:**
The corresponding Git, credential, and device-flow pair plans, starting in Phase 108;
downstream pairs consume only the contract already established.

---

### Pitfall 8: Replaying the abandoned module graph or patch

**What goes wrong:**
Old symbol moves, test moves, retired Phase 106/107 artifacts, or
`DIRTY-CHECKPOINT.patch` become the new design. Historical migration comments and
workstream-specific tests return with them.

**Why it happens:**
The preservation kit is detailed: 674 production and 172 test symbol-move candidates
make it look executable. Thirty-one production move candidates and six test move
candidates are explicitly low confidence.

**How to avoid:**
- Use the handoff only as discovery evidence.
- Use `TRANSFORMATIONS.yaml` only to find declarations or prior intent.
- Reconsider module and test ownership from HEAD and current callers.
- Do not run the preservation-kit checker; it validates the original oracle head.
- Do not apply the dirty patch or restore dropped exemption, ownership-registry,
  sharded-LCOV, adapter-scanner, Fallow-coordinate, or preservation-kit mechanisms.
- Keep case titles and comments about lasting behavior. Remove plan, phase, migration,
  and workstream narration when rewriting a pair.

**Warning signs:**
- A plan cites an old phase summary as its design authority.
- A path is recreated only because it appears in a transformation record.
- New code comments describe the refactor history rather than a current constraint.

**Phase to address:**
Every phase from 108 onward. The rule belongs in each one-pair plan template, not in a
separate executable migration plan.

---

### Pitfall 9: A production module split silently violates the one-pair boundary

**What goes wrong:**
Extracting a coherent concern creates a new production-test pair while also changing
the original caller pair. A supposedly atomic plan now owns two pairs, or lands unused
production code that Fallow rejects.

**Why it happens:**
Several current modules are very large: `shared/notify.ts` is 4,135 lines,
`plugin/update.ts` 3,240, `plugin/install.ts` 2,442, and `domain/resolver.ts` 1,744.
The guidelines recommend coherent extraction when tests become complicated, but the
milestone also mandates one pair per plan and commit.

**How to avoid:**
- Trace production callers before deciding whether the existing module can become
  testable through a pair-local dependency refactor.
- Do not create an unused extracted module, a test-only facade, or a cross-pair move.
- If a legal one-pair landing cannot keep every intermediate gate green, stop that pair
  and record a roadmap decision before implementation. Do not smuggle the split into a
  “test cleanup” commit.
- Keep the chosen responsibility in one source owner and one mirrored test owner.

**Warning signs:**
- A plan's files list contains two production `.ts` modules and two mirrored tests.
- A new module has no production caller at commit time.
- A formatting or import rewrite changes neighboring pairs.

**Phase to address:**
At planning time for the affected pair in Phase 108 or later. No separate non-pair
executable plan is proposed.

---

### Pitfall 10: Structural gates exist but are outside the completion path

**What goes wrong:**
`npm run check` passes while mirrored ownership or direct pair coverage regresses. Or a
full-tree gate is wired too early, stays red for the entire migration, and becomes
normal background noise.

**Why it happens:**
HEAD has `test:corresponding`, `test:coverage:direct`, and passing negative-control
scripts, but `check` currently runs neither. The full correspondence gate currently
fails with 107 violations, so naive immediate wiring would also break incremental
delivery.

**How to avoid:**
- Keep focused pair checks mandatory in every pair plan.
- Keep structural checks fail-closed for missing, ambiguous, wrong-import, missing-LCOV,
  and incorrectly-classified type-only inputs.
- Prove every changed gate with a planted negative control and a clean-tree control.
- Maintain an explicit 204-pair open ledger during migration; do not weaken the gate
  with baseline counts or exemptions.
- Make full-tree enforcement part of the final pair's completion path once the tree is
  clean, while preserving the project-wide `npm run check` contract.

**Warning signs:**
- CI is green after deleting a mirrored test.
- A gate says “no changed pairs” after a source or test move.
- A baseline count or allowlist makes a missing pair pass.
- A permanently failing gate is documented as “expected.”

**Phase to address:**
Phase 108 validates the focused fail-closed path in its first pair plan. The final
one-pair plan closes full-tree enforcement after all 204 pairs have evidence.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| Credit the 59 audit passes | Shrinks roadmap | Leaves guideline violations and weak tests certified | Never |
| Keep behavior in legacy split suites | Avoids moving assertions | Mirrored owner remains incomplete and direct coverage can drift | Only until the owning pair plan transfers it |
| Export a private helper | Easy branch access | Accidental public API and brittle tests | Never |
| Add coverage/Fallow ignores | Makes a gate green | Hides dead code or uncovered behavior | Only for a real runtime API static analysis cannot observe, with a narrow documented reason |
| Use generic helpers for expected values | Less repeated setup | Subject and oracle can share the same bug | Never |
| Apply the dirty checkpoint or old patch mechanism | Fast apparent progress | Replays unverified code and obsolete layout | Never |
| Bulk-format neighboring tests | Cleaner tree | Breaks one-pair review and commit ownership | Never in a pair commit |
| Keep historical phase commentary | Preserves archaeology | Obscures current public behavior and becomes stale | Never in rewritten unit cases |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| Node test runner | Import process-wide `mock` or share globals | Use the current case's `t.mock`; restore globals with `t.after()` |
| Node coverage | Accept aggregate coverage or a missing LCOV record | Select one pair and require one complete source record; recognize genuine type-only modules explicitly |
| `strong-mock` | Use broad matchers or omit verification | Use exact parameters, complete expectations, and explicit `verify()` |
| Filesystem | Share fixtures or write into repo/home | One private temporary directory per case with registered cleanup |
| Git/credentials/HTTP | Reach developer state or live services | Temporary repos, command-scoped credential config, replaced fetch, and narrow injected ports |
| Fallow | Add exports/ignores to placate analysis | Remove dead code or document the one genuine runtime-only API narrowly |
| Persistence | Assert decoded fragments only | Preserve schemas, migrations, containment, and exact stored bytes through public operations |
| Notifications | Update snapshots to current output | Resolve against closed grammar and public contract, then assert exact bytes and severity |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Run all 204 coverage subprocesses after every edit | Slow feedback encourages skipped checks | Focused pair during work; all-pairs after shared support and at final gate | Immediately at this repository size |
| Keep giant source/test modules | 4K–7K-line files, opaque file-level failures, costly review | Pair-local simplification; split only when a legal one-pair landing exists | Already present |
| Use real timers or network retry | Slow, flaky pair tests | Inject clocks/transports; fake timers; local boundaries | A single adverse environment |
| Rebuild expected state through production helpers | Fast test writing | False positives and coupled failures | First shared bug |
| Change shared support casually | Many pairs rerun or drift | Treat it as impact-bearing and run all-pairs detection | Any widely imported helper |

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Tests read the developer credential helper | Credential exposure or mutation | Command-scoped temp Git config and a case-owned credential store |
| Tests use live plugin/marketplace URLs | Data exfiltration, nondeterminism, NFR-5 drift | Fake transport or temporary local repository |
| Filesystem cases write outside a temp root | User or repository damage | Case-private `mkdtemp`, containment assertions, cleanup |
| Expected output contains absolute temp/home paths | Leaks paths and weakens redaction contract | Assert stable redacted bytes |
| A test bypasses `pluginRoot` narrowing | Containment assumptions become untypeable only after damage | Preserve `installable: true | false`; unavailable arm has no `pluginRoot` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Test cleanup changes notification grammar | Scripts and users see unexplained byte drift | Preserve closed vocabulary, severity, indentation, and reload hints |
| A failing path is reclassified casually | Users get the wrong remedy | Assert typed cause and authoritative reason token |
| Public behavior disappears with a legacy suite | Regression ships despite “better tests” | Transfer the assertion into the mirrored owner before deletion |
| Commit mixes several pairs | Reviewers cannot tell which behavior belongs where | Exactly one named source-test pair per plan and commit |

## “Looks Done But Isn't” Checklist

- [ ] **Pair accounting:** All 204 started open; only new one-pair evidence closes a row.
- [ ] **Correspondence:** The mirrored test exists and directly imports its source.
- [ ] **Types and barrels:** Type-only and re-export-only modules have meaningful compiler/binding tests.
- [ ] **Behavior:** Cases discriminate exported promises with independent expected values.
- [ ] **Coverage:** Focused LCOV is 100% functions, lines, and branches for the paired source.
- [ ] **Isolation:** Every case owns mutable state, temporary files, globals, timers, and transports.
- [ ] **Interactions:** Promised calls use strict exact mocks and explicit verification.
- [ ] **API discipline:** No production export or reset hook exists only for tests.
- [ ] **Contract replay:** Relevant behavior, public-surface, persistence, adapter, and named-correction evidence is retained.
- [ ] **Mechanism cleanup:** No abandoned patch, exemption registry, sharded runner, ownership registry, or preservation checker returned.
- [ ] **Commit boundary:** The implementation commit owns exactly one source-test pair.
- [ ] **Gates:** Focused test, direct coverage, negative controls when applicable, and `npm run check` pass.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| Audit pass was credited | LOW | Reopen the row and run the complete one-pair proof |
| Behavior changed to satisfy a stale test | HIGH | Restore the authoritative contract, add a discriminating regression case, rerun dependent suites |
| Test widened production API | MEDIUM | Internalize/remove the export and inject the real dependency through a narrow production port |
| Shared helper sweep mixed pairs | HIGH | Stop; separate the changes into one-pair commits without rewriting history, then rerun impacted pairs |
| Non-hermetic focused failure | MEDIUM | Replace machine state with a case-owned temp/local/injected boundary |
| Gate false-pass | HIGH | Plant the missed violation, repair the gate, prove red then green, re-audit affected rows |
| Old mechanism was resurrected | MEDIUM | Remove it and replace only its requirement through the current guideline |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| 1 False completion credit | Phase 108 and every later phase | Ledger begins with 204 open; closure cites new pair evidence |
| 2 Ownership/mapping ambiguity | Every one-pair plan | Mirrored path, direct source import, no alternate owner |
| 3 Coverage theater | Every one-pair plan | Guideline review plus mutation-sensitive public assertions and direct LCOV |
| 4 Contract drift | Owning pair plan | Relevant replay contracts and wider regression suite pass |
| 5 Hidden external state | Owning filesystem/process/network pair, starting Phase 108 | Isolated/reordered focused runs pass offline |
| 6 Test-only exports | Owning domain/platform pair, starting Phase 108 | Production caller trace; no test-only public symbol |
| 7 Shared adapter support | Git, credential, and device-flow pair plans | Real + fake contract and broken-fake negative control |
| 8 Abandoned design replay | Every phase from 108 | Plan cites HEAD/current callers; dropped mechanisms absent |
| 9 Multi-pair extraction | Planning of the affected pair | One production source and one mirrored test own the commit |
| 10 Gate integration gap | First Phase-108 pair and final pair | Focused fail-closed controls early; full-tree gate clean at close |

## Sources

- **Current project authority (HIGH):** `.planning/PROJECT.md`, including the v1.19
  204-pair scope, D-UTR-01..06, and product constraints.
- **Testing authority (HIGH):**
  `docs/guidelines/typescript-unit-testing-guidelines.md` and
  `.claude/rules/typescript-unit-testing.md`.
- **Preserved handoff (HIGH as evidence, not completion):** `START-HERE.md`,
  `DECISIONS.md`, `REPLAY-PLAN.yaml`, `COMPLETENESS-REPORT.md`, behavior/public/
  persistence/adapter contract files, and their explicit replay/reconsider/drop
  dispositions.
- **Repository at HEAD (HIGH):** `package.json`, `tsconfig.json`,
  `.fallowrc.json`, `eslint.config.js`, current production/tests, corresponding-test
  and direct-coverage scripts, and their negative controls.
- **Pair audit (HIGH for triage only):**
  `/tmp/pi-cm-pair-audit.CJWiph/results.tsv` and per-pair logs: 204 rows = 59
  `PASS`, 83 `COVERAGE_FAIL`, 60 `MISSING`, 2 `TEST_FAIL`.

---
*Pitfalls research for: v1.19 Unit Test Refactor*
*Researched: 2026-08-28*
