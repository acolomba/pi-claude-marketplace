# Feature Research

**Domain:** Methodical brownfield unit-test refactor for an existing TypeScript extension
**Milestone:** v1.19 Unit Test Refactor
**Researched:** 2026-08-28
**Confidence:** HIGH for repository scope and inventory. MEDIUM for external tool behavior.

## Scope Summary

This milestone changes test ownership and production testability. It does not add a product feature. Public behavior and stored data must stay compatible.

The repository has 204 production TypeScript modules at HEAD. All 204 source-test pairs remain open for a new compliance review.

The direct pair audit gives these triage signals:

| Audit result | Pairs | Meaning |
| --- | ---: | --- |
| Direct coverage passes | 59 | The focused coverage command passes. The pair has no completion credit. |
| Direct coverage is incomplete | 83 | A mirrored test exists, but direct function, line, or branch coverage is incomplete. |
| Mirrored test is missing | 60 | The required `tests/<path>.test.ts` file does not exist. |
| Focused test fails | 2 | The pair needs diagnosis before coverage work. |

The corresponding-test gate reports 107 structural violations at HEAD:

- 60 missing mirrored tests.
- 4 mirrored tests that do not import their source module.
- 43 extra tests in corresponding-test directories without a matching source path.

The test tree has 241 `.test.ts` files. Only 19 files contain a `// arrange` marker. Only two files import `strong-mock`.

These counts show the size of the review. They do not prove that a file violates every related rule.

## Feature Landscape

### Table Stakes (Users Expect These)

These features define a completed v1.19 milestone. A partial subset is not a valid milestone release.

| Feature | Why Expected | Complexity | Concrete Acceptance Signal |
| --- | --- | --- | --- |
| **Complete pair inventory** | The milestone goal applies to every production TypeScript module. | MEDIUM | Each of the 204 HEAD modules has a reviewed disposition. Every production module in the final tree has one test owner. |
| **One mirrored test per source module** | A clear owner prevents aggregate suites from hiding gaps. | HIGH | Each source has one `tests/<mirrored-path>.test.ts`. The test imports its source directly. |
| **Type-only and barrel ownership** | The guidelines have no small-module exemptions. | MEDIUM | Type-only tests prove compile-time shapes. Barrel tests prove each runtime re-export has the source binding. |
| **Public-behavior cases** | Tests must fail when the named public behavior changes. | HIGH | Cases call exports only. Expected values are independent. Whole values and typed errors are asserted. |
| **Complete direct coverage** | Aggregate coverage can hide ownership gaps. | HIGH | Each focused pair reaches 100% functions, lines, and branches. No coverage ignore directive exists. |
| **Independent case state** | Shared state makes focused and reordered runs unreliable. | HIGH | Each case owns mutable doubles, temporary paths, timers, environment changes, and cleanup. |
| **Role-correct test doubles** | Interaction checks must prove promises without coupling tests to incidental calls. | HIGH | Cases use fakes, stubs, spies, or strict mocks by role. Each strict mock uses exact parameters and explicit verification. |
| **Production design for testability** | Some modules cannot meet the rules through their current exports. | HIGH | A resistant module gets one coherent extraction, one explicit dependency, one narrow port, or factory-owned state. |
| **No test-only production surface** | A test back door weakens the public API and hides poor boundaries. | MEDIUM | Tests do not require private constants, reset hooks, state readers, global mutators, or exports used only by tests. |
| **Boolean resolver safety discriminant** | Project NFR-7 requires safe narrowing before a consumer reads `pluginRoot`. | HIGH | Both materializable arms have `installable: true`. The unavailable arm has `installable: false` and no `pluginRoot`. |
| **Three-way resolver meaning retained** | Full and partial materialization remain distinct product states. | MEDIUM | The existing `state` field keeps `installable`, `partially-available`, and `unavailable` meanings. |
| **Product contract preservation** | This is a brownfield refactor of a shipped extension. | HIGH | Public commands, output grammar, errors, persistence, atomic writes, network rules, containment, scopes, and retry behavior remain unchanged. |
| **Named correction preservation** | The handoff records product defects found during the abandoned refactor. | HIGH | Each named correction has a public-behavior case. A retained commit alone gives no credit. |
| **Adapter parity** | Production adapters and their test doubles must implement the same contract. | HIGH | Git, credential, and device-flow implementations pass shared contracts with fresh state and a proven negative control. |
| **Fail-closed structural enforcement** | Missing or ambiguous ownership must stop the quality gate. | MEDIUM | Pair mapping, direct coverage, and related structural gates reject planted violations, then pass on the clean fixture. |
| **One pair per plan and commit** | Small atomic changes limit behavior drift and make review evidence precise. | HIGH | Each executable plan and implementation commit owns exactly one production source-test pair. |
| **Project-wide closure gate** | A focused pass can still break another module or integration. | HIGH | Focused tests and coverage pass first. Then `npm run check` passes on the completed tree. |

### Guideline Compliance for Each Pair

Each pair must meet all relevant rules. Direct coverage is only one rule.

| Area | Required Behavior |
| --- | --- |
| Pair mapping | Mirror the production path under `tests/`. Use one primary test module. |
| Case layout | Use independent `test()` cases with lowercase Arrange, Act, and Assert markers. |
| Grouping | Use top-level `describe()` blocks only for exported entrypoints. Do not nest them. |
| Naming | Name cases by public behavior. Do not put plan, phase, or ticket labels in titles. |
| Assertions | Assert the public result and state before interactions. Compare complete values. |
| Errors | Assert stable error classes and fields. Do not depend on unrelated message fragments. |
| Expected values | Build expected values without production formatters, serializers, snapshots, or harness calculations. |
| Isolation | Use a fresh stateful fake and a fresh temporary directory for each case. |
| Time and globals | Use injected clocks or case timers. Restore environment and global changes with the test context. |
| External boundaries | Use fakes, case-owned local resources, or loopback-only resources. Do not use live services or credentials. |
| Strict interactions | Use `strong-mock` with `exactParams: true`. State all promised calls and call `verify()` in the case. |
| Support layout | Keep fakes, seeds, contracts, and fixtures beside their concern. Do not create a generic helper root. |
| Coverage | Run the mirrored test alone. Require 100% direct functions, lines, and branches for its source. |

### Preserved Product Corrections

The replacement tests must prove these corrections through public behavior:

1. Plugin update keeps agent skill preloads.
2. Plugin update carries bridge staging warnings.
3. Hook exhaustiveness markers survive refactoring.
4. Hook supportability debug details survive refactoring.
5. One reconcile entry failure does not stop other entries.
6. Marketplace reconcile applies every required arm.
7. Plugin and toggle reconcile apply every required arm.
8. Device-flow HTTP remains an explicit production-reachable port.

### Differentiators (Competitive Advantage)

These practices make the refactor safer than a normal coverage campaign.

| Feature | Value Proposition | Complexity | Notes |
| --- | --- | --- | --- |
| **All-open accounting** | Existing green tests cannot hide a guideline defect. | LOW | The 59 passing audit rows are ordering signals only. All 204 pairs need new review evidence. |
| **Contract-first replacement** | The team can change module boundaries without losing product behavior. | HIGH | Public, persistence, adapter, and oracle contracts outrank historical call graphs. |
| **Production improvements through public seams** | Tests improve dependency design instead of adding test access. | HIGH | Use coherent modules, explicit dependencies, narrow ports, and instance-owned state. |
| **Negative-control enforcement** | A green structural gate proves that it can reject the defect it claims to detect. | MEDIUM | Plant one small violation, observe failure, remove it, and observe success. |
| **Explicit legacy-test disposition** | Useful assertions survive while obsolete test ownership disappears. | HIGH | Move behavior into its pair, move true cross-module behavior to a designated suite, or remove proven duplication. |
| **Pair-atomic delivery** | Reviewers can connect every production change to one owner test and one coverage result. | MEDIUM | One plan and one commit own one pair. Shared support changes trigger the full direct-coverage run. |
| **Environment-aware failure triage** | The team does not change product code for a sandbox limitation. | LOW | Re-run the Unix-socket case with the required permission before changing behavior. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
| --- | --- | --- | --- |
| **Completion credit from a retained commit** | The code already passed once. | A retained commit does not prove current guideline compliance. | Review the pair at HEAD and record fresh focused evidence. |
| **Completion credit from direct coverage alone** | The number is objective and easy to collect. | Coverage does not prove assertion quality, isolation, public ownership, or correct doubles. | Apply the complete pair checklist after coverage passes. |
| **Several pairs in one plan or commit** | Bulk edits look faster. | Failures become hard to attribute and rollback. Review evidence becomes ambiguous. | Keep one source-test pair per executable plan and commit. |
| **Replay of retired Phase 106 or 107 plans** | The archived work appears to contain a ready sequence. | Those artifacts describe abandoned milestone state. They give no completion credit. | Start future work at Phase 108 from the new roadmap. |
| **Automatic application of `DIRTY-CHECKPOINT.patch`** | The patch contains plausible cleanup. | It is unverified evidence against another tree. | Re-evaluate each candidate against HEAD and public callers. |
| **Historical module reconstruction** | The handoff lists many former moves. | Old partitions can restore obsolete responsibilities and comments. | Use `TRANSFORMATIONS.yaml` only as a search index. Decide boundaries from current responsibilities. |
| **Migration-history comments** | They explain how an old layout evolved. | They preserve an abandoned design inside the new source. | Document the current invariant and public reason only. |
| **Old exemption and ownership systems** | They appear to solve the inventory problem. | The handoff explicitly drops them. They also preserve old exceptions. | Use small fail-closed gates without baseline counts or exemptions. |
| **Old sharded LCOV protocol** | It handled a large test tree. | The handoff drops its runner, reconcile protocol, and coverage matrix. | Run a focused pair and inspect exactly one source LCOV record. |
| **Generic `tests/helpers/` expansion** | Shared helpers reduce repeated setup. | Generic ownership hides the concern and can share mutable state. | Put support beside the tests of its production concern. |
| **Test-only exports or private assertions** | They make difficult branches easy to reach. | They test implementation details and widen the production API. | Change the production boundary or assert through the public export. |
| **Module replacement or process-wide mocks** | They avoid changing production dependencies. | They hide dependencies and leak state between cases. | Inject a narrow production port and use case-owned doubles. |
| **Snapshots or implementation-built expectations** | They reduce assertion code. | They can approve the same defect on both sides of the assertion. | Build exact expected values independently. |
| **Coverage ignore directives** | They make a hard branch pass quickly. | They hide dead or unowned behavior. | Remove dead code or cover the branch through public behavior. |
| **Live network, credentials, or shared fixtures** | They appear more realistic. | They make tests slow, unsafe, and environment-dependent. | Use a fake, a temporary local boundary, or a case-owned loopback service. |
| **Incidental product changes** | A refactor exposes nearby feature ideas. | New behavior makes preservation results ambiguous. | Record the idea outside v1.19 and keep the pair behavior stable. |
| **Blind expectation updates for current failures** | Changing expected text makes the test green. | The difference can expose a real product regression. | Decide the public contract first, then change code or the case. |

## Feature Dependencies

```text
[HEAD inventory and stable contract set]
    ├──requires──> [Resolver discriminant decision]
    ├──requires──> [Fail-closed pair and coverage gates]
    └──enables──> [Pair-by-pair implementation from Phase 108]
                       ├──for each pair──> [Trace exported behavior and callers]
                       ├──then───────────> [Refactor one production boundary if required]
                       ├──then───────────> [Write or repair the mirrored test]
                       ├──then───────────> [Focused test and 100% direct coverage]
                       └──then───────────> [Pair review against the full guideline]

[Narrow adapter ports]
    └──enable──> [Shared real-and-fake contracts]
                     └──require──> [Independent negative controls]

[All current and new pairs complete]
    └──requires──> [Named correction and oracle coverage]
    └──requires──> [Zero corresponding-test violations]
    └──requires──> [npm run check passes]
```

### Dependency Notes

- **Lock the resolver shape before its pair.** The current source still uses only the three-way `state` discriminant.
- **Keep the three-way meaning.** Add the boolean safety field. Do not collapse partial availability into full availability.
- **Keep `pluginRoot` off the unavailable arm.** This requirement applies to runtime schemas and TypeScript narrowing.
- **Establish gates before broad pair work.** The gate must reject missing, ambiguous, and uncovered pairs.
- **Trace callers before a production change.** A production split can add a new pair and change the closure inventory.
- **Preserve assertions during test moves.** Remove an assertion only when the public contract changed or another independent case owns it.
- **Run the full direct gate after shared support changes.** One support change can affect several pairs even when one plan owns it.
- **Run the project gate after focused evidence.** A pair is not complete while typecheck, lint, Fallow, formatting, unit, or integration tests fail.

## Pair Completion Contract

A pair receives completion credit only when all signals pass:

1. The plan and commit own exactly one production source-test pair.
2. The mirrored test imports the source module directly.
3. The test uses only exported production behavior.
4. Every applicable guideline rule passes review.
5. `node --test <test-path>` passes.
6. `npm run test:coverage:direct -- <source-or-test-path>` reports 100% functions, lines, and branches.
7. Relevant public contracts and oracle scenarios pass.
8. The pair introduces no coverage exception or test-only export.
9. The work does not resurrect a dropped handoff mechanism.
10. `npm run check` passes before the implementation commit is accepted.

For type-only modules, the compile-time contract replaces runtime coverage. The direct gate must identify this case explicitly.

## Current Failure Triage

The two focused failures need different treatment:

| Pair | Observed Failure | Required Planning Treatment |
| --- | --- | --- |
| `orchestrators/marketplace/add.ts` | One Unix-domain-socket case gets `EPERM` in the current sandbox. | Re-run with listener permission. Do not change product behavior before that run. |
| `orchestrators/plugin/update.ts` | Three cases expect `{no longer installable}` but receive `{network unreachable}`. | Decide the stable reason contract from public behavior and product rules. Do not update expectations blindly. |

These failures do not reduce the 204-pair scope. They only affect ordering and diagnosis.

## MVP Definition

### Launch With (v1.19)

- [ ] A fresh compliance decision for every current and newly added production TypeScript module.
- [ ] One mirrored owner test for every source, including type-only modules and barrels.
- [ ] Complete direct function, line, and branch coverage for each executable pair.
- [ ] Full guideline compliance for cases, doubles, data, assertions, cleanup, and support layout.
- [ ] The boolean `installable` discriminant with the unavailable `pluginRoot` exclusion.
- [ ] Public, persistence, adapter, and named correction contracts preserved.
- [ ] Zero missing, wrong-import, or unexpected corresponding-test violations.
- [ ] Fail-closed gates with negative controls.
- [ ] One pair per executable plan and implementation commit.
- [ ] A green `npm run check` result.

The roadmap starts at Phase 108. Retired Phase 106 and 107 artifacts remain historical evidence only.

### Add After Validation (v1.x)

- [ ] Faster direct-coverage execution only after measurements show a problem.
- [ ] More static style enforcement only after the pair review exposes repeated misses.
- [ ] Additional shared contracts only when two real implementations promise the same behavior.

These additions must not weaken the focused pair result or add a baseline exemption.

### Future Consideration (v2+)

- [ ] Product features discovered during the refactor.
- [ ] New adapters or component types.
- [ ] Test tooling that changes the approved runner, assertion, or mock stack.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
| --- | --- | --- | --- |
| Contract and inventory lock | HIGH | MEDIUM | P1 |
| Boolean resolver discriminant | HIGH | MEDIUM | P1 |
| Mirrored test ownership | HIGH | HIGH | P1 |
| Full guideline compliance | HIGH | HIGH | P1 |
| Complete direct coverage | HIGH | HIGH | P1 |
| Public-only production testability | HIGH | HIGH | P1 |
| Named correction preservation | HIGH | HIGH | P1 |
| Adapter parity and negative controls | HIGH | MEDIUM | P1 |
| Fail-closed structural gates | HIGH | MEDIUM | P1 |
| Pair-atomic plans and commits | HIGH | MEDIUM | P1 |
| Full project quality gate | HIGH | MEDIUM | P1 |
| Gate performance optimization | LOW | MEDIUM | P2 |
| Extra static style rules | LOW | MEDIUM | P2 |
| New product behavior | OUT OF SCOPE | HIGH | P3 |

**Priority key:**

- P1: Required for v1.19 completion.
- P2: Add only after measured need.
- P3: Keep outside v1.19.

## Approach Comparison

| Characteristic | Aggregate Test Cleanup | Retained-Pass Campaign | v1.19 Pair Method |
| --- | --- | --- | --- |
| Ownership unit | Test suite or concern | Existing green file | One source-test pair |
| Coverage evidence | Aggregate percentage | Prior focused result | Fresh direct result for one source |
| Existing passes | Usually accepted | Treated as completed | Triage signal only |
| Production design | Usually unchanged or broadly rewritten | Usually unchanged | One permitted boundary improvement when necessary |
| Contract safety | Regression suite inference | Historical commit inference | Explicit public, persistence, adapter, and oracle contracts |
| Structural enforcement | Often count-based | Often baseline-based | Fail-closed mapping and coverage with negative controls |
| Review size | Large mixed batches | Mixed historical batches | One pair per plan and commit |
| Legacy tests | Left in place | Assumed valid | Moved, reclassified, or removed after behavior preservation |

## Research Gaps for Planning

- The three update reason mismatches need a product-contract decision before that pair starts.
- The Unix-socket case needs a permitted environment run before the team classifies it as a code defect.
- Each of the 43 unexpected tests needs a disposition. Some can contain unique public behavior.
- Each retained direct pass still needs a full guideline review. The audit measured coverage, not case quality.
- A coherent production split changes the pair count. Closure must use the final source inventory, not the initial count alone.

## Sources

### Repository Evidence (HIGH confidence)

- `.planning/PROJECT.md` — current v1.19 goal, constraints, active requirements, and Phase 108 boundary.
- `docs/guidelines/typescript-unit-testing-guidelines.md` — complete unit-test contract.
- `.claude/rules/typescript-unit-testing.md` — enforced short-form test rules.
- `.planning/inputs/unit-test-refactor-handoff/` — imported decisions, contracts, oracles, and replay evidence.
- `/tmp/pi-cm-pair-audit.CJWiph/results.tsv` — 204-pair HEAD audit with 59 pass, 83 coverage-fail, 60 missing, and 2 test-fail rows.
- `scripts/check-corresponding-tests.mjs` — current fail-closed ownership gate. It reports 107 violations at HEAD.
- `scripts/test-coverage-direct.mjs` — focused direct-coverage behavior and explicit type-only handling.
- `package.json` — Node test runner, `strong-mock` 9.2.2, Fallow, direct coverage, and full quality commands.
- Repository HEAD `96adc467cda9429947e72e224a473f65bb82f234` — inspected production and test inventory.

### External Tool Evidence (MEDIUM confidence)

- [Node.js 20 test runner documentation](https://nodejs.org/docs/latest-v20.x/api/test.html) — explicit file execution, per-file child processes, case-context restoration, and LCOV coverage output.
- [`strong-mock` documentation](https://github.com/NiGhTTraX/strong-mock) — exact-parameter behavior, once-by-default expectations, and explicit verification.

---
*Feature research for: v1.19 Unit Test Refactor*
*Researched: 2026-08-28*
