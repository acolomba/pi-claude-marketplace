---
phase: 260912-vyi
plan: 01
subsystem: testing
tags: [eslint, sonarcloud, sonarjs, max-params, code-quality, reconcile, hooks]

# Dependency graph
requires: []
provides:
  - "`@typescript-eslint/max-params` at 7 over `extensions/pi-claude-marketplace/**/*.ts` — typescript:S107 is now a lint-time failure instead of a pull-request-only finding."
  - "Four module-private functions refactored below the parameter limit: `classifyDeclaredPlugin`, `tryHydrateOnePlugin`, `maybeBackfillPlugin` (all now 4 params) and `executeInstallLedger`'s hoisted transaction default."
  - "A `sonar-project.properties` status paragraph recording that the committed S3863 exclusion is measurably inert, with the scanner-log evidence and the SonarCloud UI route."
affects: [sonarcloud-quality-gate, eslint-config, reconcile, hooks-bridge]

actuals:
  tokens: 3524
  tasks: 6
  commits: 6
plan_head_before: 40bca18b93f980cf36b9e30ed4ebd515c9d4d648

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Split a long parameter list by LIFETIME, not by topic: loop-invariant context becomes one object built once outside the loop (`DeclaredPluginInputs`)."
    - "Collaborators positional, target/options object last — the shape `readAndCachePluginHooksWith` already used in the same file."
    - "Name the inline object type the caller already builds, then pass it whole instead of re-spreading its fields (`BackfillTarget`)."

key-files:
  created: []
  modified:
    - eslint.config.js
    - sonar-project.properties
    - scripts/test-coverage-direct.pin.json
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
    - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts

key-decisions:
  - "D1 — the S3863 exclusion stays committed and the 17 files' imports stay untouched; only the comment changes, to record that the exclusion is not in effect."
  - "D2 — `@typescript-eslint/max-params` lands at 7 in its own flat-config block, AFTER all three refactors, so `npm run check` is green at every commit boundary."
  - "D3 — `executeInstallLedger`'s `{ runPhases }` default is hoisted to a frozen module constant; the direct-coverage pin is re-measured in the same commit."
  - "The three new interfaces are module-private, keeping `unowned-exports-census.test.ts` unmoved."

patterns-established:
  - "Rule-then-fix ordering: when adding a lint rule that a tree already violates, land the fixes first and the rule last, so no intermediate commit is red."
  - "Prove a new lint rule is WIRED, not just that lint is green — `eslint --print-config` on one in-scope and one out-of-scope file distinguishes 'code is clean' from 'rule never applied'."

requirements-completed: [D1, D2, D3]

coverage:
  - id: D1
    description: "`sonar-project.properties` keeps its three `sonar.issue.ignore.multicriteria` lines and gains a status paragraph stating the exclusion is committed but not in effect, citing CI run 34733874521 and naming the SonarCloud UI route."
    requirement: "D1"
    verification:
      - kind: other
        ref: "grep -c '^sonar\\.issue\\.ignore\\.multicriteria' sonar-project.properties -> 3"
        status: pass
      - kind: other
        ref: "grep -F 'Administration > General Settings > Analysis Scope' sonar-project.properties -> exit 0"
        status: pass
      - kind: other
        ref: "grep -F 'sonar.issue.ignore.multicriteria.e1.ruleKey=typescript:S3863' sonar-project.properties -> exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "typescript:S107 is falsifiable locally: the rule is committed at max 7 scoped to the extension tree, and all three offenders are refactored to 4 parameters each."
    requirement: "D2"
    verification:
      - kind: other
        ref: "npx eslint extensions --rule '{\"@typescript-eslint/max-params\":[\"error\",{\"max\":7}]}' -> exit 0, no output"
        status: pass
      - kind: other
        ref: "npm run lint -> exit 0 (same claim through the COMMITTED config)"
        status: pass
      - kind: other
        ref: "npx eslint --print-config on an extensions file -> [2, {max: 7}]; on a tests file -> absent"
        status: pass
      - kind: unit
        ref: "node --test tests/orchestrators/reconcile/plan.test.ts tests/architecture/reconcile-planner-purity.test.ts tests/bridges/hooks/event-router.test.ts tests/architecture/hooks-lifecycle.test.ts tests/orchestrators/reconcile/backfill.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "`executeInstallLedger`'s transaction default names a frozen module-level constant, and the direct-coverage pin carries the re-measured reading with a resynced line citation."
    requirement: "D3"
    verification:
      - kind: other
        ref: "node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts -> exit 0, '1 pinned shortfall(s) matched ... exactly'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The four fixes actually clear the findings on PR #181 (S107 x3, S7737 x1 -> 0), which has no local equivalent and can only be read after CI re-analyses a push."
    verification: []
    human_judgment: true
    rationale: "S107 and S7737 counts on the pull request are only observable after the operator pushes and SonarCloud re-analyses. The local max-params probe is a proxy for S107 and there is no local proxy at all for S7737. The operator is holding PR #181 open deliberately, and this executor neither pushed nor merged."

# Metrics
duration: 55min
completed: 2026-09-13
status: complete
---

# Quick Task 260912-vyi: Address S3863 and S107 Summary

**S107 stopped being a pull-request-only finding: three over-long parameter lists were collapsed to four parameters each and `@typescript-eslint/max-params` was committed at 7 behind them, while the inert S3863 exclusion was documented rather than silently trusted.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 6 of 6
- **Commits:** 6 (measured `git rev-list --count 40bca18b..HEAD`)

## Commits

| Task | SHA | Title |
|---|---|---|
| 1 (tracer) | `0ff046ae` | `refactor(install): hoist the ledger transaction default to module scope` |
| 2 | `70ffc76e` | `refactor(reconcile): group the planner's loop-invariant inputs` |
| 3 | `2aa61ff8` | `refactor(hooks): give the hydrate helper a target object` |
| 4 | `cc450096` | `refactor(reconcile): name the backfill target the caller already builds` |
| 5 | `e155277b` | `chore(lint): enable @typescript-eslint/max-params at 7 for extensions` |
| 6 | `76f43311` | `docs(sonar): record that the S3863 exclusion is not in effect` |

All six are on `features/refine-unit-tests`, each prefixed `SKIP=trufflehog`, each preceded by a
`pre-commit run --files` whose only failure was the trufflehog hook (it cannot read a linked
worktree's `.git` index — the documented reason the SKIP exists). `npm run check` exited 0 at every
one of the six boundaries, at the 5971 unit / 32 integration baseline.

## Accomplishments

### Parameter counts, before and after

| Function | File | Before | After |
|---|---|---|---|
| `classifyDeclaredPlugin` | `orchestrators/reconcile/plan.ts` | 8 | **4** |
| `tryHydrateOnePlugin` | `bridges/hooks/event-router.ts` | 10 | **4** |
| `maybeBackfillPlugin` | `orchestrators/reconcile/backfill.ts` | 8 | **4** |

Each split follows a different rationale, deliberately, because the three call sites differ:

- **`classifyDeclaredPlugin`** splits by lifetime. Five of its eight arguments were loop-invariant
  and recomputed identically on every pass; they now live in a module-private
  `DeclaredPluginInputs` built once in `diffPlugins`, before the `for` loop.
- **`tryHydrateOnePlugin`** copies the house pattern already forty lines above it in the same file
  (`readAndCachePluginHooksWith(reader, routingState, opts)`): three collaborators positional, the
  seven target fields in one `HydrateOnePluginTarget` last.
- **`maybeBackfillPlugin`** needed no invention. `backfillOnePluginIsolated` already declared the
  exact object as an inline type, destructured it, and re-spread the five fields across the call.
  Naming that type `BackfillTarget` and passing the object whole removed the re-spread.

All three interfaces are module-private. `grep -rn 'export interface HydrateOnePluginTarget|export
interface DeclaredPluginInputs|export interface BackfillTarget' extensions` exits 1 with no match,
which is what keeps `tests/architecture/unowned-exports-census.test.ts` unmoved.

### The rule that makes it stick

`eslint.config.js` gained a dedicated flat-config block between the Sonar-way block and the
`tests/**/*.ts` block:

```js
files: ["extensions/pi-claude-marketplace/**/*.ts"],
rules: {
  "@typescript-eslint/max-params": ["error", { max: 7 }],
},
```

It is deliberately NOT folded into the Sonar-way block, whose contract is "spread
`sonarjs.configs.recommended.rules`, then re-assert the one rule the spread would downgrade" — a
hand-added non-`sonarjs` rule inside it would misrepresent what the spread contains. The "217 rules
at error / 62 off" figure in that block's comment counts the `sonarjs` spread and is untouched.

### S7737 and its coverage pin

`executeInstallLedger`'s fifth parameter default changed from the inline literal `{ runPhases }` to
a frozen module-level constant placed immediately above the function's doc comment. Placement was
chosen for churn: it leaves the pin's first cited branch (`PLUGIN_ENTRY_VALIDATOR.Check`, line 422)
unmoved and shifts only the second.

Direct-coverage reading for `install-outcome.ts`, verbatim:

- **Before:** `branches 109/111, lines 1034/1040`
- **After:** `branches 109/111, lines 1043/1049`

`scripts/test-coverage-direct.pin.json` carries the new reading, and the second `reasons` citation
was resynced from `818-820 (branch 818)` to `827-829 (branch 827)` — verified against
`grep -n 'const parsed = parseHooksConfig(raw, ifCtx, compileIfPredicate)'`, which reports 826, with
the `if (!parsed.ok)` guard on 827.

### S3863 documented, not fixed

Per D1, the three `sonar.issue.ignore.multicriteria` property lines and the 17 files' imports are
untouched. The comment above them gained a `STATUS:` paragraph recording that the exclusion is
committed but not in effect, that S3863's 34 findings are the expected reading rather than a
regression, that the scanner reads the file and echoes its other two exclusion families back but
drops `sonar.issue.ignore.*` with no log line at all, and that the remaining route is
`Administration > General Settings > Analysis Scope` in the SonarCloud UI.

The comment also states the trap explicitly: getting NO log line is a different failure from a wrong
pattern, so rewriting `resourceKey` to `**/*.ts` is not what the evidence points at.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Dropped the now-unused `mp` binding in `backfillOnePluginIsolated`**

- **Found during:** Task 4
- **Issue:** The plan stated that `backfillOnePluginIsolated`'s existing
  `const { scope, marketplace, mp, plugin, record } = target;` destructure "stays", on the reasoning
  that the three guards below it read `record`, `marketplace` and `plugin`. That is true, but `mp`
  was read by nothing except the eight-argument `maybeBackfillPlugin` call the task removes. Once
  `target` is passed whole, `mp` is dead. Three rules fired at once:
  `@typescript-eslint/no-unused-vars`, `sonarjs/no-unused-vars` and `sonarjs/no-dead-store`, all at
  `error`, so `npm run lint` — and therefore `npm run check` — would have been red at that commit
  boundary.
- **Fix:** Removed `mp` from that one destructure. `maybeBackfillPlugin` still destructures all five
  fields, so nothing downstream changed. The plan's own instruction that the wrapper's "parameter
  COUNT does not change (it is already 5)" is unaffected — this is a local binding, not a parameter.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`
- **Commit:** `cc450096` (same commit as the task; caught before the commit, not after)

No other deviations. The plan's ground-truth section was accurate on every other point it
pre-measured: the four functions each had exactly one caller, no fourth max-params offender existed,
no test pins `tryHydrateOnePlugin`, and the direct-coverage pin did move exactly as predicted.

## Verification

All seven steps of the plan's `<verification>` block, run UNPIPED (output redirected to files where
long, with the command itself setting the exit status read):

| # | Command | Result |
|---|---|---|
| 1 | `npx eslint extensions --rule '{"@typescript-eslint/max-params":["error",{"max":7}]}'` | **exit 0**, no output |
| 2 | `npm run lint` | **exit 0** |
| 3 | `npm run check` | **exit 0** — 5971 unit / 32 integration, 0 fail |
| 4 | `node scripts/test-coverage-direct.mjs .../install-outcome.ts` | **exit 0** — "1 pinned shortfall(s) matched ... exactly" |
| 5 | `git status` | clean of task files (only the operator's six pre-existing local-only entries) |
| 6 | `grep -rn 'fallow-ignore' extensions tests scripts \| wc -l` | **11**, unchanged; `.fallowrc.json` `thresholdOverrides` count **0** |
| 7 | `grep -rn 'export interface \{HydrateOnePluginTarget,DeclaredPluginInputs,BackfillTarget\}' extensions` | **exit 1**, no match |

Steps 1 and 2 together are the load-bearing pair: 1 proves the code is clean independent of the
config, 2 proves the claim through the committed config. Because a green `npm run lint` could also
mean the new block never applied, the wiring was falsified separately with `eslint --print-config`:
`[2, {"max": 7}]` on `extensions/.../backfill.ts`, and absent on `tests/index.test.ts`. The scope is
exactly as intended.

Step 4 matters because `npm run check` does NOT run the direct-coverage pin — it runs the negative
control (`test:coverage:direct:negative`) instead, while the pin comparison lives in the
`npm-coverage-direct` pre-commit hook. A green check is therefore not evidence the pin holds; the
single-path command is, and it was run after the final commit.

## Known Stubs

None. No stub, skipped test, or unrun `<verify>` was introduced, so nothing was appended to
`.planning/WINDOWS.md`. The single deviation above is closed, not open.

## Threat Flags

None. The plan's threat register named two `mitigate` items on `tryHydrateOnePlugin`, both held:

- **T-vyi-01** — `assertPathInside(hooksDir, hooksJsonPath, "hooks.json hydrate path")` (NFR-10) is
  still the first statement after the destructure, and both its inputs keep their names and `string`
  types.
- **T-vyi-02** — `HydrateOnePluginTarget.resolvedSource` is typed `string`, not
  `AbsolutePluginRoot`, so `asAbsolutePluginRoot` keeps validating it inside the function. Typing it
  as the brand would have pushed validation to the caller and let a corrupted `state.json` record
  reach `CLAUDE_PLUGIN_ROOT`. The interface carries a doc comment saying so.

No task installed a package, so no package-legitimacy gate applied.

## Not Done, By Instruction

- **Nothing was pushed and PR #181 was not merged.** The operator is holding it open. The real proof
  for S107 and S7737 is the post-push finding count, anonymously queryable at:
  `curl -s "https://sonarcloud.io/api/issues/search?componentKeys=acolomba_pi-claude-marketplace&pullRequest=181&rules=typescript:S107,typescript:S7737"`
  Expect `"total": 0` once CI re-analyses. `typescript:S3863` stays at 34 by decision D1 — that is
  the expected reading, not a regression.
- Docs artifacts (this SUMMARY, `STATE.md`) were not committed; the orchestrator owns that commit.
- `ROADMAP.md` was not touched — quick tasks are separate from planned phases.

## Self-Check: PASSED

- All 7 modified files exist on disk and are tracked.
- All 6 commit SHAs resolve in `git log`: `0ff046ae`, `70ffc76e`, `2aa61ff8`, `cc450096`,
  `e155277b`, `76f43311`.
- `git rev-list --count 40bca18b..HEAD` = **6**, matching the six tasks one-for-one.
