---
phase: 115-composition-orchestrators
plan: 08
subsystem: testing
tags: [node-test, strong-mock, reconcile, pending, no-mutation, direct-coverage]

requires:
  - phase: 115-composition-orchestrators
    plan: "04"
    provides: "tests/orchestrators/plugin/scope-tree-inventory.ts, consumed read-only as the path-inventory half of the no-mutation proof"
  - phase: 115-composition-orchestrators
    plan: "07"
    provides: "The rebuilt orchestrators/reconcile/notify.ts whose settled pending row shape this owner's expected messages are authored against"
  - phase: 115-composition-orchestrators
    plan: "06"
    provides: "The planted-violation discipline, including the two-plants-stayed-green pattern this plan hit again"
provides:
  - "A contract-compliant sole owner for orchestrators/reconcile/pending.ts at 100 percent direct branch, function, and line coverage"
  - "A no-mutation ledger for a read-only orchestrator: the shared scope tree inventory over both scope roots plus explicit byte equality on state.json and claude-plugins.json, with no fifth snapshot helper added"
  - "A canonical-state seeding idiom that keeps the sanctioned IL-3 legacy-migration warning off standard error without silencing the console"
affects: [115-05, 116, 117]

actuals:
  tokens: 5613
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Size a strong-mock notification boundary to the promised emission count so IL-2 single-notify is proved at the call site rather than by a trailing call-count assertion"
    - "Seed a state.json in the canonical shape so the migrator reports no mutation, which removes the fire-and-forget background save that both emits the sanctioned warning and races a no-mutation assertion"
    - "Provoke a non-syntax state-load failure with an unsupported schemaVersion rather than a permission or lock condition, which is deterministic on every platform and needs no privileged setup"

key-files:
  created: []
  modified:
    - tests/orchestrators/reconcile/pending.test.ts

key-decisions:
  - "Arranged the legacy-migration warning away rather than capturing it: every seeded state.json carries `enabled`, `resources.hooks`, and both marketplace paths, so `migrateLegacyMarketplaceRecords` reports no mutation and `persistMigratedState` never runs. Capturing the warning would have pinned a message the case does not promise and would have kept the fire-and-forget write racing the no-mutation assertions."
  - "Chose an unsupported `schemaVersion` over an unreadable file or a held lock to reach the classifier's fall-through arm. `loadState` wraps a read failure in a plain `Error` that carries no errno code, so a permission error classifies as `unreadable` anyway; `pendingReconcile` takes no lock at all, so the lock route does not exist. The schemaVersion throw is the same arm with no privilege or timing dependency."
  - "Strengthened the scope fan-out cases instead of preserving them as written. All three previously asserted the same empty advisory against the same empty inputs, so narrowing the fan-out to a single scope left them green. Each now seeds distinct work in both scopes."
  - "Made the CFG-03 rows record a plugin the surviving config arm does not declare, so removing the abort renders will-uninstall rows. Without a recorded plugin the abort plant stays green, which is the trap the phase has hit four times."

patterns-established:
  - "A guard that is redundant with a downstream catch cannot be discriminated through the public surface; report it rather than inventing a case, and state what the case does claim"
  - "Prove a read-only orchestrator's no-mutation promise by planting a real write into its read pass, not by trusting the absence of a write call"

requirements-completed: [MOD-08]

coverage:
  - id: D1
    description: "orchestrators/reconcile/pending.ts reaches 100 percent direct functions, lines, and branches with its owner run alone and no coverage exception"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Repeated pending invocations stay byte-identical in output and mutate nothing under either scope root"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "tests/orchestrators/reconcile/pending.test.ts#DIFF-01 / NFR-5: a repeated invocation emits the same notification and leaves both scope roots byte-identical"
        status: pass
      - kind: unit
        ref: "planted violation: a mkdir inside the read pass turns both no-mutation cases red; reverted"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every double is a strict, typed, case-owned mock with an explicit verification, and no cast through unknown survives"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "rg 'as unknown as' tests/orchestrators/reconcile/pending.test.ts (0 hits, was 20); rg 'import test, \\{ mock \\} from \"node:test\"' (0 hits)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The suite emits no uncontrolled warning on standard error and never silences the console"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "node --test tests/orchestrators/reconcile/pending.test.ts 2>&1 | grep -c 'Legacy marketplace migration' -> 0"
        status: pass
    human_judgment: false
  - id: D5
    description: "No production file changed"
    requirement: MOD-08
    verification:
      - kind: unit
        ref: "git diff --quiet -- extensions/ ; git diff --quiet -- tests/orchestrators/plugin/scope-tree-inventory.ts"
        status: pass
    human_judgment: false

metrics:
  duration: "~55 minutes"
  completed: 2026-09-02

status: complete
---

# Phase 115 Plan 08: Pending Advisory Owner Summary

`tests/orchestrators/reconcile/pending.test.ts` is now the sole contract-compliant
owner of `orchestrators/reconcile/pending.ts` at 100 percent direct coverage, with
every double a case-owned strict mock and no production change.

## Measured numbers

| Measure | Before | After |
| --- | --- | --- |
| Direct coverage verdict | `Incomplete direct coverage for extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts: branches 32/34, lines 264/268` | `Direct coverage passed: extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts (branches 34/34, functions 7/7, lines 268/268)` |
| Runtime cases | 16 | 18 |
| Case bodies (marked with `// arrange`) | 0 | 12 |
| `// arrange` / `// act` / `// assert` markers | 0 / 0 / 0 | 12 / 12 / 12 |
| Doubles cast through `unknown` | 20 | 0 |
| Process-wide runner mock tracker imports | 1 | 0 |
| `t.after()` registrations | 0 | 1 per case (12 bodies) |
| File length | 769 lines | 643 lines |

The verdict lines above are verbatim from `npm run test:coverage:direct --
extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`, taken before
any edit and after the final commit.

The two branch-closing rows carry 18 runtime cases from 12 marked bodies: three row
tables emit 2, 2, and 5 sibling cases from one body each, and every row runs all
three phases.

## Task 1 — normalize the owner and eliminate its casts

**Commit:** `8fd94d32`

- The module-scope `STUB_PI` handle and all twenty `as unknown as` doubles are gone.
  Each case builds `mock<ExtensionContext>`, `mock<ExtensionAPI>`, and a notification
  UI mock with `exactParams: true`, sized to the exact emission count the case
  promises, and calls `verify()` on all three after the result assertions. IL-2 is
  now proved at the call site: a second `ctx.ui.notify` throws where it is made
  instead of being counted afterwards. `pi.getAllTools()` is promised at twice the
  emission count because `notify` takes one soft-dependency probe per invocation and
  that probe reads the tool list twice.
- The `import test, { mock } from "node:test"` runner-tracker import is gone.
- The `finally`-only `withHermeticHome` wrapper became `createHermeticScopes(t, label)`,
  which mints one `cwd` root and one `HOME` root per case and registers removal
  together with the `HOME` and `PI_CODING_AGENT_DIR` restore in a single `t.after()`
  before the act phase. The `delete process.env.PI_CODING_AGENT_DIR` line is kept:
  `getAgentDir()` reads that variable before `homedir()`, so an environment that sets
  it would defeat the hermetic `HOME`.
- Every substring and existence probe became one `assert.deepStrictEqual` against a
  complete notification array. Expected message bytes are authored from
  `docs/output-catalog.md`, not derived from production. All eighteen matched on the
  first run, which is itself evidence the catalog and the renderer agree.
- The no-mutation proof composes the shared `retryTree` path inventory over **both**
  scope roots with explicit `readFile` byte equality on `state.json` and
  `claude-plugins.json`. No fifth `snapshotTree` copy was added, and
  `tests/orchestrators/plugin/scope-tree-inventory.ts` is imported read-only and is
  unchanged.
- Placeholder names are gone. Values are named for their production role
  (`notifications`, `declaredConfig`, `recordedState`, `expectedNotification`).

## Task 2 — close the two uncovered branches

**Commit:** `b7433662`

The zero-hit records were re-measured after Task 1 and matched the plan's prediction
exactly: `pending.ts:104` (the classifier's delegation to `narrowProbeError`) and
`pending.ts:161` (the invalid-local-configuration push).

- **`pending.ts:104`** — a `state.json` declaring `schemaVersion: 99` makes `loadState`
  throw an `Error` with no `cause`, so `narrowStateLoadFailReason` falls through to the
  shared probe ladder and the block reports `{unreadable}`. This is now a two-row table
  paired with the existing unparseable row, and each row fails when the other arm is
  planted.
- **`pending.ts:161`** — a malformed `claude-plugins.local.json` beside a valid base
  file reports its own basename. Paired with the existing base-file row in a two-row
  table; both rows also record a plugin the surviving base arm does not declare, so
  removing the CFG-03 abort renders `will uninstall` rows.

Both are provoked by shaping inputs on disk. No parameter, seam, cast, or coverage
exception was added.

### Why not the plan's suggested provokers

The plan proposed an unreadable state file or a pre-held advisory lock. Neither is the
right instrument:

- `loadState` wraps a read failure in `new Error(..., { cause: err })`. The **wrapper**
  reaches `narrowProbeError`, and the wrapper carries no `code`, so an `EACCES` file
  classifies as `unreadable`, not `permission denied`. A chmod fixture would add a
  root-user dependency for no additional discrimination.
- `pendingReconcile` acquires no lock at all. It never calls
  `withLockedStateTransaction`, so a held lock cannot surface a typed lock-held error
  through this surface.

The unsupported-schemaVersion route reaches the same arm, is deterministic on every
platform, and needs no privileged setup.

## Planted violations

Sixteen plants, each applied to production, run, and reverted with the original bytes.
`git diff -- extensions/` is empty after the pass.

| Plant | Case it targets | Result |
| --- | --- | --- |
| Drop the CFG-03 abort `continue` | both invalid-config rows | RED |
| Drop the invalid-**local**-config push | invalid local config row | RED |
| Drop the `SyntaxError` arm of the state-load classifier | unparseable state row | RED |
| Replace the probe-ladder fall-through with `"unparseable"` | unsupported schemaVersion row | RED |
| Narrow the omitted-scope fan-out to `["user"]` | fan-out, idempotency, mixed-order | RED |
| Drop the `compareByNameThenScope` re-sort | mixed-order | RED |
| Always plan against the raw merged view | all three MIG-01 cases | RED |
| Drop the scope from the recorded-marketplace key | partial-install row | RED |
| Drop the invalid-block conjunct from the empty-advisory guard | both config rows, both state rows | RED |
| `mkdir` a directory inside the read pass | both no-mutation cases | RED |
| Emit the absolute path instead of the basename | both config rows, mixed-order | RED |
| Downgrade the invalid-config block severity to `warning` | both config rows, mixed-order | RED |
| Emit the absolute state path on the failed state block | both state rows | RED |
| Remove the per-install force-preview catch | corrupt-manifest row | RED |
| Drop the `record === undefined` guard | declared-but-not-recorded row | **GREEN** |
| Drop the `manifestEntry === undefined` guard | manifest-omits-plugin row | **GREEN** |

### The two green plants, reported not papered over

Both are the same finding, and it is the 115-06 pattern again: **a guard made redundant
by a downstream catch**.

`resolvePendingForceInstalls` (`reconcile/notify.ts:293-315`) wraps the locator call and
the resolve in a `try`/`catch` that sits **inside** the per-install loop. Removing either
early return in `locateCandidate` therefore turns a missing record or a missing manifest
entry into a `TypeError` that the very next `catch` swallows, and the row degrades to the
same plain `(will install)` the guard would have produced. Because the catch is per
install and not per batch, one throwing candidate cannot suppress the force preview for a
sibling candidate either — so there is no multi-install arrangement that discriminates
them. I confirmed this by reading the loop rather than assuming it.

I did **not** add a case, because no observable behavior distinguishes the two
implementations through the exported surface. What the two cases do claim is stated in
their titles and is true and discriminating: an install under a marketplace that is not
recorded, and an install whose recorded manifest omits it, both render the plain token.
The claim is already correctly narrow. What the guards buy is that the common
unresolvable path costs no thrown exception, and the two cases are what keep those two
returns reachable, so they are not dead code. Recorded as ledger entry 8.

## Deviations from Plan

### 1. [Rule 2 - Missing discrimination] The three scope-routing cases proved nothing about scope routing

- **Found during:** Task 1
- **Issue:** The suite carried three cases for scope fan-out — a bare invocation, an
  explicit `--scope user`, and a near-duplicate bare invocation — and all three asserted
  the same empty advisory against the same empty inputs. Narrowing
  `["project", "user"]` to `["user"]` leaves all three green.
- **Fix:** Each case now seeds distinct pending work in both scopes. The bare case
  asserts both blocks with a shared marketplace name so the project-before-user secondary
  sort is the discriminator; the two explicit-scope cases assert that only their own
  scope's work appears while the other scope's seeded work does not.
- **Verification:** The fan-out plant now turns three cases red.
- **Committed in:** `8fd94d32`

### 2. [Rule 2 - Missing discrimination] The CFG-03 abort case could not fail

- **Found during:** Task 1
- **Issue:** The original invalid-config case wrote a malformed `claude-plugins.json` into
  a scope with **no** `state.json`. Removing the abort would plan against an empty desired
  state over an empty recorded state, which is still an empty plan, so the case's own
  "must never render a mass-uninstall list" assertion could not fail.
- **Fix:** Both rows now seed a `state.json` recording a marketplace and a plugin that the
  surviving config arm does not declare.
- **Verification:** Dropping the `continue` now turns both rows red with `will uninstall`
  rows in the diff.
- **Committed in:** `8fd94d32`

### 3. [Rule 3 - Blocking] The pre-migration fixtures were the source of the stderr noise

- **Found during:** Task 1
- **Issue:** The plan framed the legacy-migration warning as a choice between arranging it
  away and capturing it. The cause is narrower than that: `writePopulatedProjectState`
  omitted `resources.hooks` and `enabled`, so `migrateLegacyMarketplaceRecords` reported
  `mutated: true` and `loadState` fired a fire-and-forget `persistMigratedState`, which
  then lost its race against the `finally` that removed the temporary root. The warning was
  a symptom of a fixture that also raced the no-mutation assertions.
- **Fix:** Every seeded `state.json` is written in the canonical shape, so the migrator
  reports no mutation and no background write is scheduled. No console replacement was
  needed and the console is never silenced.
- **Verification:** `node --test` on the owner emits zero `Legacy marketplace migration`
  lines. Production is unchanged; the IL-3 site is untouched.
- **Committed in:** `8fd94d32`

---

**Total deviations:** 3 auto-fixed (2 Rule 2, 1 Rule 3)
**Impact on plan:** No scope reduction. All sixteen prior behaviors are still proved, two
are proved for the first time in a way that can fail, and two new behaviors are added.

## Known Stubs

None. No stub, skipped test, `only`, `todo`, or coverage pragma exists in the file; the
prohibited-pattern scan returns no hits.

## Threat Flags

None. The plan's four threats are all mitigated and each is proved by a plant: T-115-08-A
(per-case `mkdtemp` roots with `t.after()` restore), T-115-08-B (the `mkdir`-in-read-pass
plant turns both no-mutation cases red), T-115-08-C (the absolute-path plant turns the
config and state rows red), T-115-08-D (no migration warning reaches standard error and
production is unchanged).

## Issues Encountered

**`npm run check` still short-circuits at `format:check`.** Eight untracked operator files
(`.mcp.json` and seven `.planning/research/.cache/*.json`) fail Prettier, which stops the
chain before its test steps. This is pre-existing and explicitly out of scope. `npm test`
(4793 pass, 0 fail) and `npm run test:integration` (30 pass, 0 fail) were run separately
and both are green; `typecheck`, `lint`, and `fallow` all pass inside the chain.

**`pre-commit run --files` reports the same two known environmental failures.** The
trufflehog hook is git-mode and cannot read a linked worktree's index; the scan was
cleared through the CLAUDE.md filesystem route before each commit
(`verified_secrets: 0, unverified_secrets: 0`). The `npm-format-check` hook fails on the
same eight untracked files. Both commits used `SKIP=trufflehog` and nothing else.

**`tests/orchestrators/plugin/scope-tree-inventory.ts` fit without modification.** Its
`.state-lock` exclusion and its module-load-bound `readdir` are both harmless here, and
its header comment already names the reconcile owners after P115-06 widened it. It is
imported read-only and `git diff` on it is empty.

## Broken-windows ledger

One entry appended (id 8, `deviation`, phase 115) recording the two behaviorally redundant
force-preview guards. `.planning/WINDOWS.md` is left **uncommitted** — the orchestrator
commits planning artifacts.

## User Setup Required

None.

## Next Phase Readiness

`reconcile/pending.ts` is closed. Two things are worth carrying into P115-05
(`reconcile/apply.ts`), the last outstanding reconcile owner:

1. **The canonical-state seeding idiom transfers directly.** Any apply case that seeds a
   legacy-shaped `state.json` will schedule a fire-and-forget migration write that both
   emits the IL-3 warning and races the case's own state assertions. Seed
   `enabled`, `resources.hooks`, and both marketplace paths.
2. **A guard sitting upstream of a catch cannot be discriminated.** `apply.ts` composes
   orchestrators that catch per entry, exactly like `resolvePendingForceInstalls`. Expect
   plants on caller-side guards to stay green there too, and check whether the catch is
   per entry or per batch before concluding a case is missing — the answer decides whether
   a discriminating arrangement exists at all.

## Self-Check: PASSED

- `tests/orchestrators/reconcile/pending.test.ts` — FOUND (643 lines)
- Commit `8fd94d32` — FOUND (`test(115-08): rebuild the pending advisory owner`)
- Commit `b7433662` — FOUND (`test(115-08): close the last two pending branches`)
- `git diff -- extensions/` — empty
- `git diff -- tests/orchestrators/plugin/scope-tree-inventory.ts` — empty
