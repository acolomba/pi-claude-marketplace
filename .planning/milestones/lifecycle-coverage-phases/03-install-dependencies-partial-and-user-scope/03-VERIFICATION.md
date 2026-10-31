---
phase: 03-install-dependencies-partial-and-user-scope
verified: 2026-10-23T14:30:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/03-install-dependencies-partial-and-user-scope/03-01-PLAN.md
  - .planning/phases/03-install-dependencies-partial-and-user-scope/03-01-SUMMARY.md
  - features/plugin/install-dependencies.feature
  - features/plugin/install.feature
  - features/plugin/partial-install.feature
covered_digest: "v3:sha256:a5efa10a8ac5fd27e5086e34b6748de5651a654c7768af22485d068ae5b037ea"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
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
**Verified:** 2026-10-23T14:30:00Z
**Status:** passed
**Re-verification:** Yes, on the combined milestone tree (all 15 phases merged). The earlier report went stale because later merges changed covered files.

What changed since the earlier report (`3d8571d5`): `git diff 3d8571d5 HEAD` over the three phase feature files shows only `features/plugin/install.feature` changed (+22/-10), by commit `50739025`. It rewrote the two scenarios at lines 232 and 248. Phase 9 (commits `c7eac1fc`, `29e51370`) made `list --scope` show each scope's own records, so `list --scope project` now offers a plugin installed in the user scope as `available` instead of listing no marketplaces. `install-dependencies.feature` and `partial-install.feature` are byte-identical to the earlier verified state. Later product commits touching install (`4a9d5fa0` lock-held row, `c20afb40` local git read out of refusal reasons, `791a60dd` unpinned clone once) do not change any phase 3 assertion; the scenarios still pass.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence | Would a plausible wrong implementation pass? |
| --- | --- | --- | --- | --- |
| 1 | Installing a plugin with dependencies installs the whole closure in dependency order, reports a row per member, and a new session offers every member's skills (INS-01) | VERIFIED | `install-dependencies.feature:29` (app -> lib -> base: three `installed` rows, the record holds all three, config declares only `app@tools`) and `:56` (new session offers all three skills). Order is not observable in a scenario (D-03); the unit tests `RESV-01 a root declaring one dependency closes over both, dependency first` and `RESV-01 a cascade records the dependency and the requesting plugin, dependency first` pass when run by name here (2 pass, 0 fail). | No. Dropping the transitive `base`, staging rows without skills, or declaring the dependencies in config fails a whole-table compare. A wrong install order would pass the scenarios, but the two unit tests catch it. |
| 2 | A closure with a missing dependency, or a version constraint no offered version satisfies, fails with its reason and installs nothing: `list` shows no member installed, and a new session offers none of their skills (INS-02) | VERIFIED | Missing transitive dependency: `:72` (`app {dependency failed}`, `base {not in manifest}`; no record, no staged skill, no config), `:92` (list: members `available`), `:114` (session: no skills). Non-overlapping constraints: `:125` (`lib {version conflict}`), `:174` (list), `:198` (session). Installed dependency outside the constraint: `:146` (`{already installed, version conflict}`; only `lib` stays), `:210` (session offers only `lib-skill`). All pass in this run. | No. A member committed and not rolled back fails `the project scope has no installed plugins`, the list (`installed` instead of `available`), and the session check. If one range won silently, rows would read `installed`. |
| 3 | A plugin with skills and an unsupported component fails without `--partial`; with `--partial` it installs only the skills, and `info` names the component left out (INS-03) | VERIFIED | `partial-install.feature:7` (refusal: `partially-available {unsupported component}`, hint `partial-install`, nothing installed), `:25` (`partially-installed`; record, config, staged = `demo-skill` only), `:50` (session offers `demo-skill`), `:63` (whole `info` envelope: `partially-installed`, reason `unsupported component`, skill `demo-skill`). All pass. | No for install and refusal. "Names the component" is met through the closed reason `unsupported component` (D-09, `kindToReason`, D-90-05), not the kind `outputStyles`. Claude Code has no partial install, so no parity rule applies; naming the exact kind is a deferred wire-field enhancement. |
| 4 | Installing with no `--scope` and with `--scope user` records the plugin in the user scope only (`list --scope project` shows no installation of it), and a new session in another project offers its skills (INS-04) | VERIFIED | `install.feature:194` (no `--scope`) and `:213` (`--scope user`): row scope `user`, user record holds `demo`, `the project scope has no installed plugins`, user `claude-plugins.json` declares `demo`, project one declares none. `:232` and `:248` now assert `list --scope project` returns `demo@fixtures` as `available`, tally success count 1, with no `installed` row. That is a stronger form of "shows no installation of it" than the earlier empty-list form, and it now matches Phase 9's per-scope list rule. Sessions in another project: `:264` (no `--scope`) and the seed `:31` (`--scope user`). All pass. | No. A default scope of project fails the row, record, and config checks. If the user install leaked into the project record, the list row would read `installed`, not `available`. A user record with a project declaration fails the config check. |
| 5 | The phase's scenarios pass in `npm run test:cucumber`, and `npm run check:features` and `npm run check` stay green | VERIFIED | Run here: `npx cucumber-js --parallel 2` on the three files: 32 scenarios, 325 steps passed. `npm run check:features`: exit 0. The orchestrator ran `npm run check` on this exact tree: green (static, unpaired, integration, 702/702 cucumber scenarios, direct coverage). I did not re-run it. | n/a |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Deferred Items

| # | Item | Addressed In | Evidence |
| --- | --- | --- | --- |
| 1 | `info` names the exact unsupported kind | Not scheduled (product enhancement) | CONTEXT D-09; closed reason vocabulary (D-90-05) |
| 2 | `{no matching version}` for a git-source dependency | Phase 4 (Git-Source Plugins) | CONTEXT D-05; `docs/dependency-resolution.md:108` |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `features/plugin/install-dependencies.feature` | INS-01 closure and INS-02 refusals | VERIFIED | 11 scenarios (1 seed + 10 new); all pass; unchanged since the earlier verification |
| `features/plugin/partial-install.feature` | INS-03 `--partial` | VERIFIED | 4 scenarios; all pass; unchanged |
| `features/plugin/install.feature` | INS-04 user scope | VERIFIED | 17 scenarios; the two list scenarios at `:232` and `:248` updated to the per-scope list rule; all pass |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `features/plugin/*.feature` | `command.steps.ts`, `session.steps.ts`, `config.steps.ts`, `plugin/installation.steps.ts`, `*/publishing.steps.ts` | Phase 1 step text | WIRED | No undefined or pending steps in the run (32/32 passed, 325/325 steps). The list scenarios now also use `the result lists these plugins:` with tally fields, which exist and resolve. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| result rows | JSON payloads | real extension in a headless Pi | yes | FLOWING |
| record / staged skills | `state.json`, `resources/skills` | sandboxed scope root on disk | yes | FLOWING |
| session skills | `/skill:` commands | a new Pi process (`startSession`, `startSessionInAnotherProject`) | yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase scenarios | `npx cucumber-js --parallel 2 features/plugin/install-dependencies.feature features/plugin/partial-install.feature features/plugin/install.feature` | 32 scenarios / 325 steps passed | PASS |
| Feature-file rules | `npm run check:features` | exit 0 | PASS |
| Dependency order (D-03) | `node --test --test-name-pattern="dependency first" test/domain/dependency-closure.test.ts test/orchestrators/plugin/install-cascade.test.ts` | 2 pass, 0 fail | PASS |
| Full gate | `npm run check` | green on this tree, run by the orchestrator (not re-run) | PASS |

### Probe Execution

Step 7c: SKIPPED (the phase declares no probes).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| INS-01 | 03-01 | Closure installs in dependency order and reports each member | SATISFIED | SC-1 row; order through unit tests (D-03) |
| INS-02 | 03-01 | Unresolvable closure installs nothing | SATISFIED | SC-2 row; "unsatisfiable constraint" = `{version conflict}` (D-05) |
| INS-03 | 03-01 | `--partial` behavior and `info` names what was left out | SATISFIED | SC-3 row; named through the closed reason (D-09) |
| INS-04 | 03-01 | User scope only, offered in any project | SATISFIED | SC-4 row |

No orphaned requirements: REQUIREMENTS.md maps only INS-01..INS-04 to Phase 3, and their checkboxes now read complete (`[x]`, "Complete").

### Decision Soundness

- **D-03 (order not observable):** Still sound. Rows sort by name and the record is keyed by id. The two named unit tests cover the post-order and pass.
- **D-05 (unsatisfiable constraint = `{version conflict}`):** Still sound. A path-source dependency with no satisfying tag installs the current copy (TAGS-02); the only path-source refusals are a non-overlap and an installed copy out of range, and both are covered.
- **D-09 (`info` names the component by closed reason):** Still sound as a coverage reading of a documented product rule. The literal SC-3/INS-03 wording claims slightly more than the product gives.
- **D-11 (`list --scope project` after a user install):** Resolved. The earlier report flagged a coupling to the list orphan fold. Phase 9 changed the rule (each scope lists its own records) and the two scenarios were updated with it. They now state the rule positively (`available`, not `installed`) instead of relying on an empty list.
- **D-13 / D-14:** Unchanged, by design (`rowId` qualified key for cascade members; `wireScope` gives scope only to install-state statuses).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | - | No TBD/FIXME/XXX/TODO in the three feature files | - | - |

### Human Verification Required

None.

### Gaps Summary

No gaps. Each success criterion has scenarios that compare whole results and that plausible wrong implementations would fail, and all pass on the combined milestone tree. Two parts the scenarios cannot prove literally (install order, naming the exact left-out kind) stay covered by recorded decisions D-03 and D-09.

## For the orchestrator

- **No product bugs fixed.** The phase changed only feature files.
- **Phase 1 bug candidates closed as by-design:** the dependency row `name` is the qualified key `lib@tools` (D-13; RESV-06/WIRE-04, `rowId`). The `partially-available` refusal row has no scope or version (D-14; `wireScope` and pre-ledger refusals).
- **Resolved since the earlier report:**
  - The list other-scope fold item is closed. `install.feature:232` and `:248` were updated by `50739025` to expect `demo@fixtures` as `available` in `list --scope project`, matching Phase 9's per-scope list. The earlier recommendation that the list phase revisit them has been carried out.
  - REQUIREMENTS.md INS-01..INS-04 checkboxes are now ticked.
- **Still open (deferred, no carrier needed beyond what exists):**
  - Naming the exact unsupported kind (`outputStyles`) in `info`: a new wire field and product enhancement, not scheduled (D-09).
  - `{no matching version}` for git-source dependencies belongs to Phase 4 (D-05). Phase 4 is still unchecked in the ROADMAP, so the carrier is its success criteria; confirm they mention a dependency tag list with no satisfying version.
  - Review Info IN-02: a failed closure has no row for the member that resolved (`lib` in the missing-dependency case, `mid` in the conflict case). IN-03: the two `{version conflict}` causes print the range differently (raw `"^1.0.0 ^2.0.0"` against normalized `">=2.0.0 <3.0.0-0"`, from `install-cascade.messaging.ts`). Both are messaging observations, left as the scenarios pin them.
- **ROADMAP wording:** SC-1/INS-01 say "in dependency order", and no scenario can observe that (D-03); the order is proven only by the unit tests `RESV-01 ... dependency first`. SC-3/INS-03 "names the component" is met through the closed reason `unsupported component` (D-09). Consider amending the wording.
- **Unrelated flake (not re-observed):** the earlier report recorded `test/edge/handlers/plugin/browse.test.ts:373` (fixed 50 ms wait) failing once under load average ~82. The orchestrator's `npm run check` on this tree was green, so it did not recur. A backlog entry is still reasonable.

---

_Verified: 2026-10-23T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
