---
phase: 03-install-dependencies-partial-and-user-scope
verified: 2026-10-23T08:58:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/03-install-dependencies-partial-and-user-scope/03-01-PLAN.md
  - .planning/phases/03-install-dependencies-partial-and-user-scope/03-01-SUMMARY.md
  - features/plugin/install-dependencies.feature
  - features/plugin/install.feature
  - features/plugin/partial-install.feature
covered_digest: "v3:sha256:51aa733cf2499fb72d79d98c95f4132dfd67fb3458bc0749ec6ca5f41372a5ab"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "info names the exact unsupported kind (output style) that a --partial install left out"
    addressed_in: "not scheduled (product enhancement, new wire field)"
    evidence: "03-CONTEXT D-09 and <deferred>; the closed reason vocabulary collapses outputStyles to `unsupported component` (kindToReason, D-90-05)"
  - truth: "a git-source dependency whose tag list holds no satisfying version fails {no matching version}"
    addressed_in: "Phase 4 (Git-Source Plugins)"
    evidence: "03-CONTEXT D-05; docs/dependency-resolution.md line 108: only a git-backed dependency fails {no matching version}"
---

# Phase 3: Install Dependencies, Partial, and User Scope Verification Report

**Phase Goal:** Install scenarios cover a plugin's dependency closure, a closure that cannot be resolved, a partially available plugin with and without `--partial`, and installs into the user scope.
**Verified:** 2026-10-23T08:58:00Z
**Status:** passed
**Re-verification:** No (initial verification)

Scope of the change: commit `3d8571d5` touches only the three feature files (+327/-3). No step module and no product file changed (CONTEXT D-15). `46e719f8` is docs only.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence | Would a plausible wrong implementation pass? |
| --- | --- | --- | --- | --- |
| 1 | Installing a plugin with dependencies installs the whole closure in dependency order, reports a row per member, and a new session offers every member's skills (INS-01) | VERIFIED | `install-dependencies.feature:29` (app -> lib -> base: three `installed` rows, record holds all three, config declares only `app@tools`) and `:56` (new session offers all three skills). Order: not observable (D-03); the unit tests `RESV-01 a root declaring one dependency closes over both, dependency first` (`test/domain/dependency-closure.test.ts:73`) and `RESV-01 a cascade records the dependency and the requesting plugin, dependency first` (`test/orchestrators/plugin/install-cascade.test.ts:357`) pass when run by name. | No. Dropping the transitive `base`, staging rows without skills, or declaring the dependencies in config each fails a whole-table compare: the row, record, config, and session steps compare every row with `deepStrictEqual`. A wrong install order would pass the scenarios, but the two unit tests above catch it. |
| 2 | A closure with a missing dependency, or a version constraint no offered version satisfies, fails with its reason and installs nothing: `list` shows no member installed, and a new session offers none of their skills (INS-02) | VERIFIED | Missing transitive dependency: `:72` (rows `app {dependency failed}`, `base {not in manifest}` with cause; no record, no staged skill, no config), `:92` (list: `app`, `lib` available), `:114` (session: no skills). Non-overlapping constraints: `:125` (`lib {version conflict}`, cause names both ranges), `:174` (list: all three available), `:198` (no skills). Installed dependency outside the constraint: `:146` (`{already installed, version conflict}`, record, staged skills, and config hold only `lib`), `:210` (session offers only `lib-skill`). | No. If the resolved member `lib` were committed before the failure and not rolled back, `the project scope has no installed plugins` would fail (record and staged dirs), and so would list (`installed` instead of `available`) and the session. If one range won silently, the result would be `installed` rows. The `, which failed` setup step asserts that every result is an error. |
| 3 | A plugin with skills and an unsupported component fails without `--partial`; with `--partial` it installs only the skills, and `info` names the component left out (INS-03) | VERIFIED | `partial-install.feature:7` (seed: `partially-available {unsupported component}`, hint `partial-install`, nothing installed), `:25` (`partially-installed`, record, config, staged = `demo-skill` only), `:50` (session offers `demo-skill`), `:63` (whole `info` envelope: `partially-installed`, reasons `unsupported component`, skills `demo-skill`). | No for install and refusal. For "names the component": `info` gives the closed reason `unsupported component`, not "output style". D-09 is a sound reading. `kindToReason` in `shared/probe-classifiers.ts:199-209` collapses every kind outside lsp/hooks/mcp to that reason by design (D-90-05). Claude Code has no partial install, so no parity rule applies. Naming the exact kind is a new wire field and is deferred. |
| 4 | Installing with no `--scope` and with `--scope user` records the plugin in the user scope only (`list --scope project` shows no installation of it), and a new session in another project offers its skills (INS-04) | VERIFIED | `install.feature:194` (no `--scope`) and `:213` (`--scope user`): the row reads scope `user`, the user record holds `demo`, the project scope has no record and no staged skill, the user `claude-plugins.json` declares `demo`, and the project one declares none. `:232` and `:242`: `list --scope project` lists no marketplaces. `:252` (no `--scope`) and the seed `:31` (`--scope user`): a session in a fresh `mkdtemp` cwd (`world.ts:312`) offers `demo-skill`. | No. A default scope of project fails the row, record, and config checks. A user record with a project declaration fails the config check (review CR-01, fixed). A double install fails `project scope has no installed plugins`. D-11 is a sound reading: an empty project list contains no installation. But the scenarios pass only because list folds the plugin installed in the other scope out (`list-flow.ts` orphan fold), so they depend on a list rule that the list phase owns. |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green | VERIFIED | Re-run here: `npx cucumber-js` on the three files: 32 scenarios, 325 steps passed, exit 0. `npm run check:features`: exit 0. `npm run check` at `3d8571d5`: every static gate passed (typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features), plus test:unpaired, test:integration, and test:cucumber (481 scenarios, 4580 steps). `test:coverage:direct:all` failed once, on `test/edge/handlers/plugin/browse.test.ts:373`, at load average ~82. See the anti-patterns note. That test passed 3 of 3 runs by name, and its direct-coverage pair (`node scripts/test-coverage-direct.mjs test/edge/handlers/plugin/browse.test.ts`) exited 0. The executor's `npm run check` at the same commit exited 0. | n/a |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | `info` names the exact unsupported kind | Not scheduled (product enhancement) | CONTEXT D-09; closed reason vocabulary (D-90-05) |
| 2 | `{no matching version}` for a git-source dependency | Phase 4 (Git-Source Plugins) | CONTEXT D-05; `docs/dependency-resolution.md:108` |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/install-dependencies.feature` | INS-01 closure and INS-02 refusals | VERIFIED | 11 scenarios (1 seed + 10 new); all pass |
| `features/plugin/partial-install.feature` | INS-03 `--partial` | VERIFIED | 4 scenarios (1 seed + 3 new); description updated (WR-05) |
| `features/plugin/install.feature` | INS-04 user scope | VERIFIED | 17 scenarios, 5 new at lines 194-258 |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `features/plugin/*.feature` | `command.steps.ts`, `session.steps.ts`, `config.steps.ts`, `plugin/installation.steps.ts`, `*/publishing.steps.ts` | Phase 1 step text | WIRED | Every step resolves (no undefined or pending steps in the run). The row, field, record, staged-skill, and session steps compare whole tables, so an extra or missing row fails. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| result rows | JSON payloads | real extension in a headless Pi (`runCommandPayloads`) | yes | FLOWING |
| record / staged skills | `state.json`, `resources/skills` | sandboxed scope root on disk | yes | FLOWING |
| session skills | `/skill:` commands | a new Pi process (`startSession`, `startSessionInAnotherProject`) | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Phase scenarios | `npx cucumber-js features/plugin/install-dependencies.feature features/plugin/partial-install.feature features/plugin/install.feature` | 32 scenarios / 325 steps passed | PASS |
| Feature-file rules | `npm run check:features` | exit 0 | PASS |
| Dependency order (D-03) | `node --test --test-name-pattern="dependency first" test/domain/dependency-closure.test.ts test/orchestrators/plugin/install-cascade.test.ts` | 2 pass, 0 fail | PASS |
| Full gate | `npm run check` | all gates green except one unrelated timing flake in `browse.test.ts` (see below) | PASS (flake noted) |

### Probe Execution

Step 7c: SKIPPED (the phase declares no probes).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| INS-01 | 03-01 | Closure installs in dependency order and reports each member | SATISFIED | SC-1 row; order through unit tests (D-03) |
| INS-02 | 03-01 | Unresolvable closure installs nothing | SATISFIED | SC-2 row; "unsatisfiable constraint" = `{version conflict}` (D-05) |
| INS-03 | 03-01 | `--partial` behavior and `info` names what was left out | SATISFIED | SC-3 row; named through the closed reason (D-09) |
| INS-04 | 03-01 | User scope only, offered in any project | SATISFIED | SC-4 row |

No orphaned requirements: REQUIREMENTS.md maps only INS-01..INS-04 to Phase 3. Their checkboxes still read Pending; the orchestrator updates them.

### Decision Soundness

- **D-03 (order not observable):** Sound. The cascade sorts rows by name (`compareByNameThenScope`), and the record is keyed by id, so no outside observation shows the order. The two named unit tests cover the post-order.
- **D-05 (unsatisfiable constraint = `{version conflict}`):** Sound. `docs/dependency-resolution.md:108-110` (TAGS-02) states that a path-source dependency with no satisfying tag installs the current copy and succeeds. So the only path-source refusals for a constraint are a non-overlap and an installed copy out of range. Both are covered.
- **D-09 (`info` names the component by closed reason):** Sound as a coverage reading of a documented product rule (`kindToReason`, D-90-05). The literal SC-3/INS-03 wording ("names the component") claims more than the product gives. Amend the wording or keep the deferred enhancement.
- **D-11 (empty `list --scope project`):** Sound for "shows no installation of it", but it couples two INS-04 scenarios to list's other-scope fold (see For the orchestrator).
- **D-13 / D-14 (Phase 1 bug candidates):** Confirmed by design. `rowId` (`shared/notification-json.ts:421-435`) names a cascade member by its `<plugin>@<marketplace>` key (RESV-06/WIRE-04). `wireScope` (`:567-583`) gives scope only to install-state statuses.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| (none in phase files) | - | No TBD/FIXME/XXX/TODO in the three feature files | - | - |
| `test/edge/handlers/plugin/browse.test.ts` | 420 | Fixed `setTimeout(50)` waits for the plugin loader before the next keypress | Info | Pre-existing timing flake, outside this phase's diff. It failed once under load average ~82 during `test:coverage:direct:all` and passed 3 of 3 by name and in its direct-coverage pair. It is worth a backlog entry. |

### Human Verification Required

None.

### Gaps Summary

No gaps. Each success criterion has scenarios that compare whole results and that the plausible wrong implementations would fail. The two parts that the scenarios cannot prove literally are dependency order and naming the exact left-out kind. Both are covered by recorded decisions: unit tests cover the order (D-03), and a closed reason by design covers the kind (D-09).

## For the orchestrator

- **No product bugs fixed.** The phase changed only the three feature files.
- **Phase 1 bug candidates closed as by-design:** the dependency row `name` is the qualified key `lib@tools` (CONTEXT D-13; RESV-06/WIRE-04, `rowId`). The `partially-available` refusal row has no scope or version (CONTEXT D-14; `wireScope` and pre-ledger refusals).
- **Deferred items:**
  - Naming the exact unsupported kind (`outputStyles`) in `info`: a new wire field and a product enhancement, not scheduled (D-09).
  - `{no matching version}` for git-source dependencies goes to the git-source phase (Phase 4) (D-05).
  - The list other-scope fold: `install.feature:232` and `:242` (`list --scope project` lists no marketplaces after a user-scope install) pass only because list folds a plugin installed in the other scope out of the project `fixtures` block. The list phase should revisit both scenarios if it changes that rule (D-11, review WR-04).
  - Review Info IN-02: a failed closure has no row for the member that resolved (`lib` in the missing-dependency case, `mid` in the conflict case). IN-03: the two `{version conflict}` causes print the range differently (raw `"^1.0.0 ^2.0.0"` against normalized `">=2.0.0 <3.0.0-0"`, from `install-cascade.messaging.ts`). Both are messaging observations, left as the scenarios pin them.
- **ROADMAP wording:** SC-1/INS-01 say "in dependency order", and no scenario can observe that (D-03). The order is proven only by the unit tests `RESV-01 ... dependency first` in `test/domain/dependency-closure.test.ts` and `test/orchestrators/plugin/install-cascade.test.ts`. Consider amending the wording to cite them. SC-3/INS-03 "names the component" is met only through the closed reason `unsupported component` (D-09).
- **Unrelated flake:** `test/edge/handlers/plugin/browse.test.ts:373` (fixed 50 ms wait) failed once in this verifier's `npm run check` under heavy machine load. It passes alone. Consider a backlog entry.

---

_Verified: 2026-10-23T08:58:00Z_
_Verifier: Claude (gsd-verifier)_
