---
phase: 02-plugin-enable-and-disable
reviewed: 2026-10-23T09:04:05Z
depth: deep
files_reviewed: 9
files_reviewed_list:
  - CHANGELOG.md
  - docs/plugin-enablement.md
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - features/plugin/disable.feature
  - features/plugin/enable.feature
  - test/orchestrators/plugin/enable-disable.messaging.test.ts
  - test/orchestrators/plugin/enable-disable.test.ts
findings:
  critical: 0
  warning: 5
  info: 5
  total: 10
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-10-23T09:04:05Z
**Depth:** deep
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Scope: `git diff 0fc0172c..HEAD`, excluding `.planning/`. Also read: `docs/output-catalog.md`, `docs/dependency-resolution.md`, `transaction/with-state-guard.ts`, `domain/dependencies.ts::renderDependentKeys`, the cucumber step modules the scenarios use, and the Claude Code 2.1.309 binary (the 2.1.308 path cited in 02-CONTEXT.md is gone).

**Transaction and lock behavior is correct.** `resolveEnableCascade` throws inside the `withLockedStateTransaction` closure. Before that point the closure has only run `loadTargetLayers` and the two `refuse*` checks, which read and do not write. `readRecordDeclarations` is read-only. `tx.save()` is never reached, and `withExistingScopeLock` releases the lock on the throw. The outer catch classifies `EnableRefusedError` into the failed row. No ledger phase has run, so nothing needs a rollback. For a mixed closure (one member disabled, one missing), the refusal comes before `buildEnableCascadeMemberPhases`, so the disabled member is not re-materialized.

**The `record` field is now required, and every consumer is consistent.** `buildEnableCascadeMemberPhases` and `enableCascadeSkipRow` were the only places that read it as optional. `classifyEnableCascadeMember` has one caller.

**Test runs:** `npm run check:features` passes. `npx cucumber-js features/plugin/enable.feature features/plugin/disable.feature`: 17/17 scenarios pass. `node --test` on the two enable-disable unit files: 207/207 pass. I did not run `npm run check`, as instructed.

**docs/dependency-resolution.md is consistent.** It never described the enable cascade's absent-member arm, so nothing there went stale. 02-CONTEXT.md said that file had to change; it did not need to.

**Main concerns:**
1. The refusal now also fires for a root that is already enabled. Upstream checks `already_in_goal_state` first, so it never reaches this case.
2. `docs/output-catalog.md` still documents the removed warning-skip arm.
3. A comment rationale in `enableCascadeLookup` is stale.
4. No test covers a missing member reached transitively, a mixed closure, or an idempotent root.

## Warnings

### WR-01: An already-enabled root with a missing dependency now fails at error severity, unlike upstream

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:2440-2467` (also `resolveEnableCascadeStep` at 1399-1416, `resolveEnableCascade` at 812-817)
**Issue:** `resolveEnableCascadeStep` runs before the ENBL-05 idempotency check at line 2467. This order exists for D-08-03, so that a disabled dependency still turns on when the root is already enabled. Because the order comes first, the new missing-member throw also fires when the root itself is already enabled.

This state is easy to reach. Install `app` with its dependency `lib`, then `uninstall lib@tools`. That goes through (D-06-06) and leaves `app` enabled until the next reload. Then `enable app@tools` now returns `A plugin operation has failed.` / `⊘ app (failed) {dependency unsatisfied}` at error severity. Before this change it returned `{already enabled}` at info, plus the warning row for the dependency.

Upstream does not do this. In the 2.1.309 binary, the enable function returns `already_in_goal_state` (`Plugin "<id>" is already enabled`) before it computes `{closure, missing}` and returns `dependency_missing`:

```
if(n===ke)return{success:!1,alreadyInGoalState:!0,failureCode:"already_in_goal_state",...};
...
if(n){...{closure:ce,missing:ge}=qfn(c,[...J,...D]);if(ge.length>0){...failureCode:"dependency_missing"...}
```

D-02 cites only the `dependency_missing` arm. No recorded decision covers a refusal over an already-enabled root, so under the project's upstream-parity constraint this is an unlicensed divergence. The row also says `(failed)` for a plugin that is in fact enabled and loaded. No test covers this path.
**Fix:** Choose one and record it in 02-CONTEXT.md:
- (a) Parity: on an idempotent root, return the `{already enabled}` skip and still apply D-08-03's re-enable of disabled members. Raise the missing-member refusal only on the fresh path. For example, have `resolveEnableCascade` return `missing` instead of throwing, then throw only when the root is not idempotent (its record is disabled):
  ```ts
  // resolveEnableCascade returns { members, missing }
  if (cascade.missing.length > 0 && isRecordedButDisabled(installed)) {
    throw new EnableRefusedError("dependency unsatisfied",
      composeEnableMissingDependencyCause(rootKey, cascade.missing));
  }
  ```
- (b) Keep the current behavior: record it as a decision with an ID, and add an orchestrator test that pins the error row for an already-enabled root.

### WR-02: docs/output-catalog.md still documents the removed `{not installed}` warning arm and has no state for the new refusal

**File:** `docs/output-catalog.md:4119`
**Issue:** The `enable-cascade` prose still says: "a member the scope records nothing for renders `(skipped) {not installed}` at `warning` (the enable was carried out but fell short) and does not refuse the root's own enable; the next reload holds the root down as `dependencyDisabled` until the missing dependency is installed (LOAD-01 owns reporting it)." The code no longer does this.

The new user-visible shape (`⊘ <root> (failed) {dependency unsatisfied}` / `cause: Install … first, then ….`, error severity, no reload hint) has no catalog entry. The disable-side twin has one: `disable-refused-dependents`, line 4330. The catalog is the documented source of truth for every row shape. The prose sits outside a fenced `catalog-state` block, so no gate catches the drift.
**Fix:** Replace the stale clause with one sentence about the refusal. Add a sibling section such as `### Refused -- a declared dependency is not installed (EDEP-01)` with a `<!-- catalog-state: enable-refused-dependency-missing -->` block:
```text
A plugin operation has failed.

● official [user]
  ⊘ helper (failed) {dependency unsatisfied}
    cause: Install formatter@tools first, then helper@official.
```
State in it that nothing is written (state.json mtime unchanged, configs untouched), the severity is error, and there is no reload hint.

### WR-03: The `enableCascadeLookup` docstring explains its design with the behavior this phase removed

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:614-620`
**Issue:** The comment justifies answering `"found", []` for an unrecorded member like this: "'absent' would reach the walk's `not-found` arm and refuse an enable over a MISSING dependency that LOAD-01's load-time check already owns reporting." After this phase the enable does refuse over a missing dependency, so the stated reason is false. The design is still right, for a different reason. Answering `found` keeps the walk from failing with its `not-found` reason and cause (the `{not in manifest}`-style closure failure). That lets `resolveEnableCascade` collect every missing member and raise one `dependency unsatisfied` refusal with the upstream-shaped cause. `assertUnusableDeclarationIsOnlyRemainingArm` (674-706) also depends on this invariant. The task brief named this kind of leftover ("LOAD-01's load-time check owns").
**Fix:** Restate the rationale in the present tense:
```ts
 * reaches. A record the scope never installed (or whose marketplace the
 * scope never added) answers "found, declares nothing" -- NOT `{ kind:
 * "absent" }`: "absent" would end the walk on its `not-found` arm, while
 * `resolveEnableCascade` classifies every unrecorded member itself and
 * refuses once, with all of them named (upstream's `dependency_missing`).
```

### WR-04: No test covers a missing member reached transitively, a mixed closure, or several missing members

**File:** `test/orchestrators/plugin/enable-disable.test.ts:6449-6488`
**Issue:** The only orchestrator test seeds a direct dependency of the root that is not installed. Several plausible wrong implementations would still pass every unit and cucumber test:
- checking only the root's direct declarations, so `a → b (disabled) → c (missing)` re-enables `a` and `b`;
- running the member phases for `re-enabled` members before the missing check, which leaves `b` materialized after the refusal;
- dropping or duplicating a key in the cause when there are two missing members.

The idempotent-root path (WR-01) has no test either. The brief asks specifically about rollback and "nothing written". Only the direct case proves that.
**Fix:** Add `seedEdepGraph` cases:
1. `a` (disabled) → `b` (disabled) → `formatter@tools` (absent). Assert the exact failed row and cause `Install formatter@tools first, then a@official.`, that the state.json mtime is unchanged, and that `b`'s skill directory does not exist.
2. `a` declares `b` (disabled, recorded) and `x@tools` (absent). Assert the same, and that `b` stays `enabled: false`.
3. Two absent members. Assert the exact cause text in closure post-order.
4. `a` already enabled with an absent member. Assert whatever WR-01 decides.

### WR-05: The "deliberate divergences" section of plugin-enablement.md does not record the new standalone-vs-reload asymmetry for a missing dependency

**File:** `docs/plugin-enablement.md:50-52`
**Issue:** The section calls itself "the single citable home" for each divergence. It says a reload installs a MISSING dependency (MISS-01) and that only the standalone command turns on a DISABLED one. After this phase a new asymmetry exists. A config-declared enable (`A: {}` plus `/reload`) still installs a missing dependency through MISS-01 and loads `A`. A standalone `enable A` refuses with `{dependency unsatisfied}` and changes nothing. A user who learned one path will be surprised by the other, and the section's heading ("diverge on a disabled dependency") no longer covers every case.
**Fix:** Add a paragraph, or widen the heading to "on a disabled or missing dependency". Say that standalone `enable` refuses a missing closure member, as upstream does (`dependency_missing`). Say that a config-driven enable leaves the missing dependency to the reload's MISS-01 install. Cite D-02.

## Info

### IN-01: The cause text leaves out the verb for the second step

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:115-126`
**Issue:** `Install lib@tools first, then app@tools.` reads as "then install app@tools", but `app` is already installed and the next step is to enable it. The function's own docstring says "install the missing dependencies first, then enable the target". The disable twin works because one verb covers both steps. Here it does not. D-03 fixed this form, so this is wording feedback, not a defect. Also, the missing keys are listed in closure post-order. The disable twin names its dependents sorted. Both orders are deterministic.
**Fix:** If D-03 can be amended, use `Install ${keys} first, then enable ${target}.`, and update the docs, the feature file, and both tests.

### IN-02: Other comments still describe the old classification arms

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:2562-2565`, `:1096-1097`; `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:73-74`
**Issue:**
- The catch-site comment lists the `EnableRefusedError` kinds as "cycle, unreadable declarer, enabled dependents, or a local-only marketplace". It leaves out the new missing-dependency refusal, and it already left out `invalid manifest`, `unsupported source` and the layer refusals.
- The `buildEnableCascadeMemberPhases` docstring still says "the skip rows for every other disposition". Only `already-enabled` remains.
- The `composeEnableCascadeRows` docstring mentions a root "whose every member fails classification, `members: []`". Classification can no longer fail without refusing.

**Fix:** Name the refusal kinds generically ("any `EnableRefusedError`"), and drop or reword the two dead references.

### IN-03: `buildEnableCascadeMemberPhase` takes `record` twice

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:936-937`, `:1121-1129`
**Issue:** The separate `record` parameter existed only so the caller could pass `member.record` after narrowing it from optional. `record` is now required on `EnableCascadeMember`, so the caller passes `member, member.record`. The function reads the same value through two names.
**Fix:** Drop the `record` parameter and read `member.record` inside the function.

### IN-04: The unit refusal test checks only state.json for "writes nothing"

**File:** `test/orchestrators/plugin/enable-disable.test.ts:6449-6488`
**Issue:** The title claims "writes nothing", but the test checks only the state.json mtime. `seedEdepGraph` already returns `baseConfigPath`. A regression that wrote the enabled flag to the config before the cascade resolved would pass this test. The cucumber scenario does check the config, so the gap is narrow.
**Fix:** Also assert that the bytes or the mtime of `baseConfigPath` are unchanged.

### IN-05: The dependency-enable scenario does not state the configs it changes

**File:** `features/plugin/enable.feature:169-196`
**Issue:** "Enabling a plugin enables its disabled dependency too" runs `disable lib@tools`, which writes `lib@tools: false` to the project base config. The enable must overwrite that entry to `true` (CR-01/CR-06), and set `app@tools` to `true`. The scenario compares neither config. A wrong implementation is still caught indirectly: a stale `false` makes the session reconcile disable `lib`, which fails the skills table and leaves report rows uncompared. But a reader cannot see that the config overwrite is part of the behavior. The ENA-04 scenarios (D-06) state both configs.
**Fix:** Add:
```gherkin
    Then the "claude-plugins.json" file of the project scope declares these plugins:
      | id        | enabled |
      | app@tools | true    |
      | lib@tools | true    |
```
(Adjust to the exact entries the product writes.)

---

_Reviewed: 2026-10-23T09:04:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
