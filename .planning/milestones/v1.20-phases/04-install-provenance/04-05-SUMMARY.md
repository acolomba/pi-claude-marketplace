---
phase: 04-install-provenance
plan: 05
subsystem: orchestrators
tags: [config-write-back, provenance, dependency-cascade, reconcile, node-test, docs]

# Dependency graph
requires:
  - phase: 04-install-provenance
    provides: plan 04-01's `provenance` field on every install record and plan 04-04's `buildUninstallBucket` exemption for `provenance: "dependency"` (D-04-04 steps 1 and 2)
provides:
  - "A cascade install writes ONLY the requesting plugin's key into `claude-plugins.json` / `.local.json`, on the standalone arm and the orchestrated arm alike (D-04-02)"
  - "`writeAdoptingConfigEntries` without its dependency-patches property and spread; `writeOrchestratedDeclarations` reduced to the DFEN-04 single-entry disabled stamp, with `writeBatchedConfigEntries` no longer imported by `install-flow.ts`"
  - "The CR-01 reload-survival case now proves a dependency survives two `applyReconcile` passes with NO config declaration -- observed red with the D-04-05 exemption reverted (`RED_EVIDENCE_OK`)"
  - "A D-03-05 scope assertion of its own: the dependency's record lives in the requesting plugin's scope, as a dependency, and in no other scope"
  - "`docs/dependency-resolution.md` and `README.md` state the current facts in Plain English"
  - "`npm run check` exit 0 on `4eddbd76`: 6376/6376 unit, 32/32 integration; `pre-commit run --all-files` exit 0, 31 hooks passed"
affects: [04-06, 05-prune]

# Actuals (#2632) -- chars/4 over the realized diff, never a harness token count
actuals:
  tokens: 6809
  tasks: 3
  commits: 2
plan_head_before: 59c547596dee199ce0b8e31c6f2097188d94795e

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Retire a parameter with its call site: delete the property on the inline object-literal parameter type, the spread that consumed it, and the doc paragraphs about it in one edit, because no gate in this repo reports an unused optional property"
    - "Rewrite a `Parameters<typeof X>[0]` type expression when X's last value use dies, so the import is dropped rather than kept type-referenced by a dead expression"
    - "Ordering-contract proof by planted violation: revert the exemption the removal depends on, observe the reload-survival case red on its first reconcile assertion, restore byte for byte"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/shared.test.ts
    - docs/dependency-resolution.md
    - README.md

key-decisions:
  - "Tasks 1 and 2 landed in ONE commit (`295b5690`): the `npm-typecheck` hook rejects `shared.ts` without the three `shared.test.ts` deletions, and `npm-coverage-direct` runs the `install-flow` pair on any `install-flow.ts` change and fails on the un-inverted config-bytes cases, so no split leaves every hook green (see Deviations)"
  - "`writeOrchestratedDeclarations` keeps the `landedDisabled` conditional inside itself (six properties, a single conditional single-entry write) rather than hoisting the condition to its caller: the plan's acceptance criterion says the body is a conditional write, and `installPluginWithTransaction`'s lock closure gains no branch"
  - "The `current` type expression points at `Parameters<typeof writePluginConfigEntry>[0]`, not the named `ScopeConfig`: it needs no new import in `install-flow.ts` and names the writer the function actually calls"
  - "The reload-survival case's declaration assertion became a whole-value `deepEqual` on `declared.config.plugins` (`{ \"hello@mp\": { enabled: true } }`) rather than a `=== undefined` check on the dependency key: a standalone negative assertion passes for any value, and the whole value is the promise (both the absence and the untouched user entry)"
  - "04-04's negative control (`still sweeps an undeclared direct install beside a declared dependency`) is unchanged: its declared-dependency config is a hand-built input to a pure planner and stays a legal input (a user can hand-declare any key), and its source carries no prose claiming it describes what install writes"

patterns-established:
  - "D-04-08 anchoring: every amended title cites `D-04-02`, `D-04-04`, `D-03-05` or `DFEN-04`, or keeps `RESV-01` / `CR-01` where the promise is unchanged; the surviving comments cite `D-04-02` and `D-04-05`; `grep -o 'PROV-[0-9]*'` reads 3 (pre-existing git-auth citations) in `install-flow.ts` and 0 in `shared.ts`"

requirements-completed: [PROV-01, PROV-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "A cascade install writes only the requesting plugin's key to the config on the standalone arm (complete config bytes, hand-written from the contract)"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-03-05 / D-04-02: a cascade dependency lands in the parent's scope and stays out of the parent's config file"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-01 / D-01-32: a dependency declared only in the plugin's own manifest installs"
        status: pass
    human_judgment: false
  - id: D2
    description: "A cascade install writes only the requesting plugin's key on the orchestrated arm, including when the root lands disabled (the DFEN-04 stamp alone)"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-01 / D-04-04: an orchestrated install records its cascade dependency undeclared, and the next reload keeps it"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#DFEN-04 / D-04-02: an orchestrated cascade whose root lands disabled declares the disabled root and not the dependency"
        status: pass
    human_judgment: false
  - id: D3
    description: "A cascade-installed dependency survives two `applyReconcile` passes with no declaration (CR-01), and that survival rests on the D-04-05 exemption -- observed red with the exemption reverted"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#RESV-01 / D-04-04: an orchestrated install records its cascade dependency undeclared, and the next reload keeps it"
        status: pass
      - kind: other
        ref: "planted revert of `plan.ts`'s `record.provenance === \"dependency\"` continue: node --test --test-reporter=tap --test-name-pattern 'RESV-01 / D-04-04' -> exit 1, 1 test, 0 pass, 1 fail on `pluginsToUninstall` (`+ [{ marketplace: 'mp', plugin: 'some-other-plugin', scope: 'project' }]` / `- []`); gsd-tools check tdd-red-evidence -> RED_EVIDENCE_OK; restored, sha256 identical, 1/1"
        status: pass
    human_judgment: false
  - id: D4
    description: "A cascade dependency still lands in the requesting plugin's scope (D-03-05), asserted on its own: project record present with `provenance: \"dependency\"`, user scope records nothing"
    requirement: PROV-01
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#D-03-05 / D-04-02: a cascade dependency lands in the parent's scope and stays out of the parent's config file"
        status: pass
    human_judgment: false
  - id: D5
    description: "Both retired parameters are gone from their signatures, no import is orphaned, and the whole gate chain is green"
    requirement: PROV-01
    verification:
      - kind: other
        ref: "npm run check -> exit 0 (typecheck, lint, lint:workflows x2, fallow dead-code `No issues found` / health `0 above threshold` / dupes, format:check, test:corresponding x2, test:coverage:direct:negative, test 6376/6376, test:integration 32/32); grep dependencyPluginPatches|dependencyKeys|writeBatchedConfigEntries over install-flow.ts -> 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "The three prose statements of the retired behavior are rewritten; the markdown hooks are clean"
    requirement: PROV-02
    verification:
      - kind: other
        ref: "grep -c 'same file the asking plugin' docs/dependency-resolution.md -> 0; grep -c 'the same configuration file' README.md -> 0; SKIP=trufflehog pre-commit run --files docs/dependency-resolution.md README.md -> exit 0, nothing rewritten; node --test tests/architecture/dependency-doc-agreement.test.ts -> 3/3"
        status: pass
    human_judgment: true
    rationale: "The literal-absence greps and hooks are automated, but whether the replacement paragraph reads as plain English and states the facts a reader needs is a judgment; the four sentences are quoted below for review"

# Metrics
duration: 25min
completed: 2026-09-16
status: complete
---

# Phase 4 Plan 05: Retire the cascade config write Summary

**Both config-write arms and their parameters are gone, so the desired-state config names only the plugins the user asked for by name; the CR-01 reload-survival case proves a dependency survives two `applyReconcile` passes with no declaration, and that proof was observed red with the wave-4 exemption reverted.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-16T13:44:33Z
- **Completed:** 2026-09-16T14:09:47Z
- **Tasks:** 3
- **Files modified:** 6

## Precondition, asserted before Task 1

`grep -n 'provenance === "dependency"' plan.ts` -> line 506; `node --test --test-name-pattern D-04-05 tests/orchestrators/reconcile/plan.test.ts` -> 2/2 on `59c54759`. Step 2 was present and green before step 3 started.

## Accomplishments

- **`install-flow.ts`:** the standalone arm's `dependencyPluginPatches` property and its comment block are deleted; the orchestrated arm passes neither `rootKey` nor `dependencyKeys`. `writeOrchestratedDeclarations` is the single conditional single-entry write (`if (args.landedDisabled) await writePluginConfigEntry(...)`), its parameter type has six properties (`current`, `targetConfigPath`, `scopeRoot`, `plugin`, `marketplace`, `landedDisabled`), and `current` is typed `Parameters<typeof writePluginConfigEntry>[0]`, so `writeBatchedConfigEntries` is no longer imported by the file at all. The doc comment states the present-tense rule: the cascade's dependencies are declared nowhere, each record carries `provenance: "dependency"`, and D-04-05's exemption is what keeps it across a reload. One `D-04-02` sentence joins the DFEN-04 comment on the standalone arm.
- **`shared.ts`:** `writeAdoptingConfigEntries` has exactly eight properties; the spread is gone; the two doc paragraphs (the parameter's and the D-03-06 one) are replaced by one sentence stating that the requesting plugin's key is the only plugin key the write declares. The call in `install-flow.ts` passes the same eight properties `enable-disable.ts`'s `writeConfigEntries` call passes.
- **`install-flow.test.ts`:** four cases amended, none deleted -- see the table below.
- **`shared.test.ts`:** three cases deleted with their parameter -- see below.
- **Docs:** the second paragraph of "Where a dependency lands", the further-reading cross-reference, and the README install sentence rewritten.

### The four amended `install-flow.test.ts` cases

| Was | Now | What changed |
|---|---|---|
| `RESV-01 / WR-09: an orchestrated install declares its cascade dependencies, so the next reload keeps them` | `RESV-01 / D-04-04: an orchestrated install records its cascade dependency undeclared, and the next reload keeps it` | Declaration assertion INVERTED to a whole-value `deepEqual(declared.config.plugins, { "hello@mp": { enabled: true } })`. The reload half -- `assert.deepEqual(planned.pluginsToUninstall, [])`, the second `reconcilePass()` (which drives `applyReconcile`), and the surviving-dependency `deepEqual` with its `"the dependency survives the reload that follows the install"` message -- is byte-identical. Only the two prose comments beside it were reworded (the old ones asserted the declaration keeps the dependency, which is now false). |
| `RESV-01 / DFEN-04: an orchestrated cascade whose root lands disabled declares the dependency and the disabled root in one write` (04-03's carry-forward) | `DFEN-04 / D-04-02: an orchestrated cascade whose root lands disabled declares the disabled root and not the dependency` | `declared.config.plugins` expectation is `{ "hello@mp": { enabled: false } }`; outcome and record assertions unchanged. |
| `RESV-01 / D-03-06: a cascade dependency is declared in the parent's own file` | `D-03-05 / D-04-02: a cascade dependency lands in the parent's scope and stays out of the parent's config file` | Config bytes hand-written from the contract: `"plugins": {\n    "hello@mp": {}\n  }`. A NEW `deepStrictEqual` for the scope half: `{ projectScope: "project", projectPlugins: ["hello", "some-other-plugin"], dependencyProvenance: "dependency", userPlugins: [] }` read from both scopes' `state.json`. The `configLocalJsonPath` ENOENT assertion stays. |
| `RESV-01 / D-01-32: a dependency declared only in the plugin's own manifest installs` | same title | Config bytes name `hello@mp` only; the both-records assertion stays. |

### The three deleted `shared.test.ts` cases, with reasons

1. **`RESV-01 declares every cascade dependency in the requesting plugin's own file`** -- a direct unit test of the `dependencyPluginPatches` parameter's happy path (two keys in, two keys written). The parameter no longer exists, so the case cannot compile; the behavior it proved is retired by D-04-02.
2. **`RESV-01 omitting the dependency patches writes the same bytes as an empty record`** -- proved that `dependencyPluginPatches: {}` and an absent property write identical bytes. With no property there is one shape, and the existing `writes only the plugin key when the marketplace is already declared` case pins the single-key bytes.
3. **`RESV-01 a key in both records resolves in the requesting plugin's favour`** -- pinned the precedence rule between `pluginPatch` and a same-key entry in `dependencyPluginPatches`. **That rule disappears with its parameter and is owned nowhere else, deliberately:** after this plan there is exactly one plugin key per write, so no two patches can name the same key and there is nothing to give precedence to. `writeOrchestratedDeclarations`'s twin of the rule (the `[args.rootKey]: { enabled: false }` spread LAST over the dependency keys) is deleted in the same commit.

`shared.test.ts` still has `makeState` in use (13 call sites) and the `writeAdoptingConfigEntries` describe keeps its remaining cases.

## The planted red -- proof that step 2 is load-bearing

With `install-flow.ts` already retired (the tree at `295b5690`'s content), `buildUninstallBucket`'s D-04-05 guard was removed from `plan.ts` (the four lines `if (record.provenance === "dependency") { continue; }` and their blank line; `grep -c` -> 0) and the reload-survival case run alone:

```text
$ node --test --test-reporter=tap --test-name-pattern "RESV-01 / D-04-04" tests/orchestrators/plugin/install-flow.test.ts
not ok 1 - RESV-01 / D-04-04: an orchestrated install records its cascade dependency undeclared, and the next reload keeps it
  ---
  location: '.../tests/orchestrators/plugin/install-flow.test.ts:3489:1'
  failureType: 'testCodeFailure'
  error: |-
    Expected values to be strictly deep-equal:
    + actual - expected

    + [
    +   {
    +     marketplace: 'mp',
    +     plugin: 'some-other-plugin',
    +     scope: 'project'
    +   }
    + ]
    - []
  code: 'ERR_ASSERTION'
  operator: 'deepStrictEqual'
  stack: |-
    file:///.../tests/orchestrators/plugin/install-flow.test.ts:3572:14
# tests 1
# pass 0
# fail 1
```

Exit 1. The failure is at line 3572, the reload half's first assertion (`assert.deepEqual(planned.pluginsToUninstall, [])`): with the config write gone and the exemption absent, `planReconcile` over the real merged config and the real `state.json` plans `some-other-plugin@mp` for uninstall -- CR-01 reopened, exactly as D-04-04 says. The case stops at its first failing assertion, so the second `applyReconcile` pass is not reached in the red run; the assertion that went red is the empty-uninstall-bucket one that feeds it.

`gsd_run check tdd-red-evidence` on the raw TAP (this case is top-level, not nested under a `describe`, so the checker's column-0 anchor sees it): **`RED_EVIDENCE_OK` (`target_test_failed`)**, `failing_tests: ["RESV-01 / D-04-04: ..."]`.

**Restored** from a byte copy taken before the plant: sha256 `ae6dce18...038b0` before and after; `git diff --quiet -- plan.ts` -> 0; `grep -c 'record.provenance === "dependency"'` -> 1; the case 1/1; the four-suite focused run 302/302.

## TDD Gate Compliance (Task 2, `tdd="true"`)

- **RED:** the planted run above, `RED_EVIDENCE_OK`. The four inverted/rewritten cases were also observed red against the pre-removal tree in the ordinary sense: before Task 1's edits, the config-bytes expectations named two keys and the current tree writes one, which is the red `npm-coverage-direct` would have reported on any split commit (see Deviations).
- **GREEN:** `git log --grep '^feat(04-05):'` -> `295b5690`. No `test(04-05):` commit exists on its own -- the RED test edits ride the same commit, for the hook reason below. No REFACTOR commit.

## Measured gate

| Check | Result |
|---|---|
| `npm run check` on `4eddbd76` | **exit 0** |
| `npm test` | 6376 tests, 6376 pass, 0 fail (6379 at the end of 04-04, minus the 3 deleted cases) |
| `npm run test:integration` | 32 pass, 0 fail |
| `npm run fallow` | dead-code `No issues found`; health `0 above threshold` (13307 functions); dupes exit 0 |
| `node --test` over `install-flow`, `shared`, `reconcile/plan`, `reconcile/apply` | 302 tests, 302 pass, 0 fail |
| `node --test tests/architecture/dependency-doc-agreement.test.ts` | 3/3 |
| `SKIP=trufflehog pre-commit run --files <changed>` before each commit | every hook passed (37 on the code commit, incl. `npm direct coverage (changed pairs)`; 17 on the docs commit incl. mdformat and markdownlint), nothing rewritten |
| `SKIP=trufflehog pre-commit run --all-files` after the last commit | exit 0, 31 hooks passed |
| Acceptance greps | `PROV-[0-9]*` in `install-flow.ts` -> 3, in `shared.ts` -> 0; `same file the asking plugin` -> 0; `the same configuration file` -> 0 |

## Task Commits

1. **Task 1: Remove both config-write arms and the parameters that carried them** + **Task 2: Invert the declaration assertions, keep the reload assertions verbatim, and prove step 2 is load-bearing** -- `295b5690` (feat), 4 files, +89/-214 (see Deviations for why one commit)
2. **Task 3: Rewrite the three prose statements of the retired behavior** -- `4eddbd76` (docs), 2 files, +3/-3

**Plan metadata:** the `docs(04-05)` commit that adds this file.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` -- import slimmed to `writePluginConfigEntry`; `writeOrchestratedDeclarations` doc comment and body rewritten; both arms in the lock closure slimmed
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` -- `writeAdoptingConfigEntries` doc, parameter type and body
- `tests/orchestrators/plugin/install-flow.test.ts` -- four cases amended (table above)
- `tests/orchestrators/plugin/shared.test.ts` -- three cases deleted (list above)
- `docs/dependency-resolution.md` -- "Where a dependency lands" second paragraph; further-reading cross-reference
- `README.md` -- the install-section dependency sentence

### The replacement prose (for the D6 judgment)

`docs/dependency-resolution.md`, second paragraph of "Where a dependency lands" (the first paragraph, D-03-05, is unchanged):

> The configuration file names only the plugins you asked for by name. This extension does not write a dependency into `claude-plugins.json` or `claude-plugins.local.json`. Instead, its install record says that it arrived through another plugin. A reload keeps the dependency because its record says so, not because the configuration names it.

Further reading: "... the files that name the plugins you asked for." README: "A plugin can declare the other plugins it needs. The install adds them too, into the same scope."

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### CLAUDE.md-driven adjustment

**1. [Rule 2 - CLAUDE.md precedence] Tasks 1 and 2 landed in one commit**
- **Found during:** Task 1's verification, before its commit
- **Issue:** after Task 1's production edits alone, `npm run typecheck` reports three `TS2353` diagnostics in `tests/orchestrators/plugin/shared.test.ts` (the cases that pass `dependencyPluginPatches`), so the `npm-typecheck` hook rejects a Task 1-only commit; and `npm-coverage-direct` runs the `install-flow` pair on any `install-flow.ts` change and fails on the un-inverted config-bytes cases. CLAUDE.md requires every hook green before a commit and forbids committing through a failure. Splitting by pair does not help either: `shared.ts` + `shared.test.ts` alone leaves `install-flow.ts`'s call site passing a property that no longer exists (typecheck red), and `install-flow.ts` + its test alone leaves `shared.ts` still accepting it while the batched-writer import is gone (fine) but the test file's `shared.test.ts` cases still red under typecheck.
- **Fix:** one `feat(04-05)` commit (`295b5690`) carrying both production files and both test files, with every hook green (typecheck, lint, fallow, prettier, direct coverage for the changed pairs). The planted-red proof is a recorded run, not a commit, as in 04-03 and 04-04.
- **Files modified:** all four code/test files
- **Verification:** `git show --stat 295b5690` -> 4 files; `git log --grep '^feat(04-05):'` -> 1 commit

**2. [Planner miscount, no code change] `writeOrchestratedDeclarations` has six properties, not five**
- **Found during:** Task 1's acceptance criteria
- **Issue:** the criterion reads "exactly five properties". The function had eight; the plan removes two (`rootKey`, `dependencyKeys`); 8 - 2 = 6, and each of the six (`current`, `targetConfigPath`, `scopeRoot`, `plugin`, `marketplace`, `landedDisabled`) is consumed by the single `writePluginConfigEntry` call or its guard. Reaching five would mean hoisting the `landedDisabled` guard to the caller, which contradicts the same criterion's "single conditional single-entry write" and would add a branch to the lock closure.
- **Fix:** none -- recorded here.

**3. [Comment truth, within the verbatim rule] Two prose comments beside the kept reload assertions were reworded**
- The plan keeps "the empty-uninstall-bucket assertion, the second reconcile pass, and the surviving-dependency assertion" verbatim, and they are. The comment above the first of them said "Without the declaration the planner tears the dependency down", which is now false; it reads "nothing is planned for removal (CR-01). A planner that read the config alone would tear the dependency down while its parent stays installed and broken." The assertion lines are byte-identical.

---

**Total deviations:** 1 CLAUDE.md-driven commit-shape adjustment, 1 planner miscount recorded, 1 comment reword. **Impact:** no production or test content differs from the plan's intent; only which commit the test edits landed in.

## Issues Encountered

- This checkout is a linked worktree (`.git` is a file) on the developer's `features/manifest` branch, dispatched in sequential mode; plans 04-01..04 committed here the same way. STATE.md and ROADMAP.md were not touched, as instructed. The developer's uncommitted edits (`.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json`) and untracked files were never staged.
- No git pre-commit hook is installed; `pre-commit run --files` was run by hand before each commit and `--all-files` after the last one.

## Accepted residue: dev-tree config entries (Pitfall H, stated rather than hidden)

A development tree that ran a cascade install between plan 04-01 and this plan carries config entries for its dependencies in `claude-plugins.json` / `.local.json` AND records with `provenance: "dependency"` -- a config that violates the D-04-02 invariant on that machine. Nothing in scope removes those declarations. **They are inert:** reconcile reads declared + recorded + enabled as steady state, so a declared dependency is simply never examined by the exemption and nothing is planned for it. No cleanup is in scope. Carry into Phase 5's UAT: if `--prune` declines to prune such a plugin on the operator's own tree, the cause is a leftover declaration (or the 04-01 `"explicit"` back-fill of a record written before the field existed), not a prune defect; the remedy is to remove the stale entry or uninstall and reinstall the plugin.

## Threat register notes

- **T-04-03 (mitigated):** the planted revert of the exemption observed red on the reload assertion (quoted above), restored byte for byte before the commit; the wave ordering held (precondition asserted green before Task 1).
- **T-04-11 (mitigated):** both parameters removed from their signatures; `writeBatchedConfigEntries` no longer imported by `install-flow.ts` (the type expression was rewritten, not just the value use deleted); `fallow dead-code` -> `No issues found`.
- **T-04-12 (mitigated):** the two literal-absence greps read 0; the rewrite shipped in the same plan as the removal.
- **T-04-SC:** accepted per the plan; nothing to record.

## Next Phase Readiness

- After this plan, `buildUninstallBucket`'s D-04-05 exemption is the ONLY thing standing between a cascade-installed dependency and an uninstall on the next `resources_discover`; the reload-survival case is the regression test that guards it, and it is proven falsifiable.
- Plan 04-06 (D-04-07, the promotion row) can proceed on a green tree at `4eddbd76`. Its config write of the newly-explicit key follows `writePluginConfigEntry` as used in `writeOrchestratedDeclarations`, which after this plan is the only thing that function does.
- The `RESV-01 / D-04-04` case at `install-flow.test.ts:3489` is the D-04-04 / CR-01 row in 04-VALIDATION's map: unit, drives `applyReconcile`, observed failing against "step 3 without step 2".

---
*Phase: 04-install-provenance*
*Completed: 2026-09-16*

## Self-Check: PASSED

- `[ -f ]` on all 6 modified files: FOUND
- Commits `295b5690`, `4eddbd76` present in `git log`: FOUND
- `commits: 2` measured from `plan_head_before` `59c54759..HEAD`
