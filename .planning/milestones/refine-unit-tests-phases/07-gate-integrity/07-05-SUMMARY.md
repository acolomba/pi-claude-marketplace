---
phase: 07-gate-integrity
plan: 05
subsystem: testing
tags: [architecture-gates, target-registry, temp-root-control, node-test, d-07-01, d-07-03, ggat-01]

requires:
  - phase: 07-gate-integrity
    provides: "tests/architecture/gate-targets.ts — the 22-group literal target registry"
  - phase: 07-gate-integrity
    provides: "tests/architecture/temp-root-control.ts and assertNoForbiddenSurface's opts.root / ScanReport"
provides:
  - "seven architecture gates whose production targets come from gate-targets.ts, with six of the seven holding zero repo-relative production path literals"
  - "the measured fact that the temp-root offender mechanic generalizes to a second independent caller unchanged — no helper needed a new parameter, no control needed a special case"
  - "the two info-surface paths compat-01-no-expansion.test.ts still spells, and the registry scalars 07-16 should add so it can stop"
affects: [07-15, 07-16, gate-integrity, architecture-gates]

actuals:
  tokens: 47000
  tasks: 2
  commits: 2
  plan_head_before: 2deca737

tech-stack:
  added: []
  patterns:
    - "Offender text derived at plant time from the real target's own first `const` binding, so the planted violation cannot drift from the file it stands for even if the group is reordered"
    - "Control target named as `GROUP[0]` rather than as a second path literal, which keeps the mutated path inside the registry without adding a registry constant"
    - "A directory walk answers the visitation question once in a shared collector rather than once per clause, so two clauses share one non-emptiness assertion"

key-files:
  created: []
  modified:
    - tests/architecture/no-lifecycle-default-enabled-read.test.ts
    - tests/architecture/compat-01-no-expansion.test.ts
    - tests/architecture/manifest-read-seam.test.ts
    - tests/architecture/scope-order-drift.test.ts
    - tests/architecture/no-hooks-strict-additional-properties.test.ts
    - tests/architecture/no-split-01-cast-reads.test.ts
    - tests/architecture/reconcile-planner-purity.test.ts

key-decisions:
  - "The temp-root mechanic needed no change to serve a second caller. withTempRoot / materializeTargets / plantOffender / plantBenignNearMiss and assertNoForbiddenSurface's opts.root were all used exactly as 07-01 shipped them; both negative controls reproduced on the new caller."
  - "The offender line is derived from the target at plant time rather than hand-authored. The receiver identifier is read out of the real file, so the planted violation stays anchored to the module even if LIFECYCLE_ENABLED_READ_TARGETS is reordered."
  - "compat-01-no-expansion.test.ts keeps its two info-surface literals. Removing them needs two named registry scalars that do not exist, and no plan owns gate-targets.ts this wave. The literals are now typed as (typeof NETWORK_FREE_TARGETS)[number], so removing either surface from the registry stops the build."
  - "scope-order-drift.test.ts now walks the extension root rather than `extensions/`. The two roots enumerate the same files today (`extensions/` holds exactly one entry), and the non-emptiness assertion is what would catch a mis-rooted walk."
  - "The empty-group negative control was NOT performed. Emptying a live registry group means editing gate-targets.ts, which four concurrent siblings read; the risk of breaking their runs outweighs re-proving a control 07-02 already observed against the same clause shape."

patterns-established:
  - "Pattern: a gate proves a second consumer of a shared mechanic by copying the mechanic's call shape verbatim — any friction is then a fact about the mechanic, not about the gate"
  - "Pattern: a residual path literal that cannot move to the registry yet is typed as a member of the group it belongs to, so the hand-copy is compiler-checked until the registry constant lands"

requirements-completed: [GGAT-01]

coverage:
  - id: D1
    description: "Seven architecture gates take their production targets from gate-targets.ts, with six of seven at zero literals and the seventh at two typed residuals"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "comment-stripped scan for /[\"'`](\\./)?extensions\\/pi-claude-marketplace/ per file → 0,2,0,0,0,0,0 (from 4,3,2,2,1,1,1)"
        status: pass
      - kind: command
        ref: "grep -c 'import.meta.dirname' tests/architecture/scope-order-drift.test.ts → 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The lifecycle gate deep-compares the paths it opened against its registry group and asserts the group is non-empty"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/no-lifecycle-default-enabled-read.test.ts#DFEN-07 (D-103-08, D-103-09): the lifecycle verbs never name the declared-enablement field"
        status: pass
    human_judgment: false
  - id: D3
    description: "The full D-07-04 control set runs against the second independent caller of the temp-root mechanic"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/no-lifecycle-default-enabled-read.test.ts#DFEN-07: the gate fires on a declared-enablement read planted in a copy of a real target"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-lifecycle-default-enabled-read.test.ts#DFEN-07: unmutated copies of the same real targets pass and report every path opened"
        status: pass
      - kind: unit
        ref: "tests/architecture/no-lifecycle-default-enabled-read.test.ts#DFEN-07: a forbidden token inside a line comment passes, so the gate still strips comments"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each control was observed doing its job: removing the planted line and removing the injected root both make the offender case fail"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "planted line deleted → AssertionError: Missing expected rejection; { root } deleted → same failure; file restored byte-identical and 4 pass 0 fail"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each of the seven files carries a non-emptiness assertion on its declared list or directory walk, naming D-07-03"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "grep -c 'D-07-03' over the seven files → 3,1,1,2,1,2,1"
        status: pass
    human_judgment: false
  - id: D6
    description: "The whole architecture suite is green and its case count is accounted for exactly"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "node --test 'tests/architecture/*.test.ts' → 383 pass 0 fail (07-04 recorded 380; +3 = the three controls added to the lifecycle gate)"
        status: pass
      - kind: other
        ref: "npm run typecheck; npx eslint tests/architecture --max-warnings=0; npx fallow health/dupes/dead-code --fail-on-issues; npx prettier --check 'tests/architecture/*.ts' — all exit 0"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-09-10
status: complete
---

# Phase 7 Plan 05: Registry Re-point and Second-Caller Control Set Summary

**The temp-root offender mechanic was handed to a second gate it was not designed around and needed no change at all — same four helpers, same `opts.root`, same three controls, both negative checks reproducing — while seven gates moved their production targets into the registry and six of them now hold zero path literals.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-10T16:26:00Z
- **Completed:** 2026-09-10T17:11:00Z
- **Tasks:** 2 of 2
- **Files modified:** 7 (0 created, 7 modified)

## Task Commits

1. **Task 1: Registry targets, visitation proof, and both controls for the lifecycle gate** — `5b8d8f32` (test)
2. **Task 2: Re-point the four remaining single-literal gates** — `cae90fe9` (test)

`commits: 2` counts this plan's own commits. `git rev-list --count 2deca737..HEAD` reports 6
because four sibling executors committed into the same working tree during this run; the count
is not a measure of this plan.

## Per-File Literal Counts

Method: strip block and line comments, then count string literals matching
`["'` + backtick + `](\./)?extensions/pi-claude-marketplace`. Import specifiers begin `"../../`
and are excluded by construction.

| File | Before | After | What replaced the literals |
|------|--------|-------|----------------------------|
| `no-lifecycle-default-enabled-read.test.ts` | 4 | **0** | `LIFECYCLE_ENABLED_READ_TARGETS` |
| `compat-01-no-expansion.test.ts` | 3 | **2** | `COMPAT_NO_EXPANSION_TARGETS`; two residuals, see deviation 1 |
| `manifest-read-seam.test.ts` | 2 | **0** | `EXTENSION_ROOT_REL` (walk root and offender label) |
| `scope-order-drift.test.ts` | 2 | **0** | `SCOPE_ORDER_CANONICAL_TARGETS` (both failure messages) |
| `no-hooks-strict-additional-properties.test.ts` | 1 | **0** | `HOOKS_SCHEMA_TARGETS` |
| `no-split-01-cast-reads.test.ts` | 1 | **0** | `ORCHESTRATORS_REL` |
| `reconcile-planner-purity.test.ts` | 1 | **0** | `RECONCILE_PURITY_TARGETS` |

Totals: **14 → 2**. `scope-order-drift.test.ts` also stopped deriving its own repository root
(`grep -c "import.meta.dirname"` → 0) and now imports `REPO_ROOT` from `./source-scan.ts`;
`manifest-read-seam.test.ts`, `no-hooks-strict-additional-properties.test.ts`,
`no-split-01-cast-reads.test.ts`, and `reconcile-planner-purity.test.ts` dropped their private
`fileURLToPath` derivations for the same import, so the directory has one root constant instead
of six copies.

`scope-order-drift.test.ts` also carried two allowlist entries in the leading-slash form
(`"/extensions/pi-claude-marketplace/shared/types.ts"`). That form does not match the census
regex, so it was never in the before-count, but it was still a hand-copied production path; the
allowlist is now built by mapping the registry group.

## What the Second Caller Measured About the Mechanic

This plan's sharper question was whether the temp-root mechanic was an accident of its first
caller. **It was not.** Every helper was used at the shape `07-01` shipped:

- `withTempRoot(prefix, body)` — one root per case, no shared fixture. No change needed.
- `materializeTargets(root, LIFECYCLE_ENABLED_READ_TARGETS)` — took a second group verbatim.
- `plantOffender(root, target, line)` — took a line this gate composed, not a line the helper
  knew about. The offender text is gate-owned by design, which is exactly what made a second
  forbidden vocabulary (`defaultEnabled` / `applyDefaultEnabled` rather than `gitOps`) a
  non-event.
- `plantBenignNearMiss(root, target, token)` — same.
- `assertNoForbiddenSurface(targets, patterns, describe, { root })` — the injected root and the
  `ScanReport` both behaved as the NFR-5 gate's do.

**One piece of friction, and it is about the registry rather than the mechanic.** The controls
need to name ONE target to mutate. `07-01` solved that by adding `NETWORK_FREE_CONTROL_TARGET`
to the registry, typed `(typeof NETWORK_FREE_TARGETS)[number]`. No plan owns `gate-targets.ts`
this wave, so this gate names its control as `LIFECYCLE_ENABLED_READ_TARGETS[0]` instead. That
works — the group is `as const`, so index `0` is literal-typed and carries no `undefined` — but
it reads worse than a named constant, and it made a second problem visible that the named form
hides: an index-derived control target can silently move to a different file if the group is
reordered, at which point a hand-authored offender line would name an identifier that file does
not contain. The fix is in this gate rather than in the registry: `offenderLineFor` reads the
real target and builds the offending line around the first `const` binding it actually declares,
asserting loudly if it finds none. Deriving the offender at plant time is strictly better than
`07-01`'s hand-authored `"const gitOps = DEFAULT_GIT_OPS;"` and is worth copying, but a named
`LIFECYCLE_ENABLED_READ_CONTROL_TARGET` in the registry is still the right home for the *path*.
Recorded below for `07-16`.

Nothing else resisted. The mechanic generalizes.

## Negative Controls Observed

Both were performed against the committed gate and reverted; the file was verified
byte-identical to its pre-control state afterwards (`diff` clean), and the four cases re-run
green.

1. **Planted line removed.** Deleting the
   `await plantOffender(root, CONTROL_TARGET, await offenderLineFor(CONTROL_TARGET));` call and
   running that case alone produced
   `AssertionError [ERR_ASSERTION]: Missing expected rejection.` with
   `expected: /a re-materializing lifecycle verb names the declared-enablement field/`.
2. **`{ root }` removed.** Deleting the injected root from the rejecting call produced the same
   `Missing expected rejection` failure — the scan fell back to the real tree, which carries no
   planted surface. This is `07-01`'s second control reproduced on a different caller, which is
   the specific evidence that `opts.root` governs every read for more than the gate it was built
   for.

The offender receiver derived at plant time is `synced`, a real `const` binding in
`orchestrators/plugin/update-flow.ts`, giving the offending line
`const declaredEnablement = synced.defaultEnabled;`.

**Not performed: the emptied-group control.** The plan's behaviour list includes "an emptied
registry group makes the gate fail on its non-emptiness assertion". Emptying a live group means
editing `tests/architecture/gate-targets.ts`, which four sibling executors were reading
concurrently in this shared working tree; a transient empty group would have failed their runs.
`07-02` observed exactly this control against `NETWORK_FREE_TARGETS` and the same clause wording,
so the evidence exists and re-taking it was not worth the blast radius. The assertion itself is
present and named in all seven files.

## Case Count

`node --test "tests/architecture/*.test.ts"` → **383 passing, 0 failing.**

`07-04` recorded 380 passing at its plan end. The delta is **+3**, and all three are this plan's
new controls on `no-lifecycle-default-enabled-read.test.ts` (1 case before, 4 after). No other
file's case count changed — every other edit in this plan adds an assertion inside an existing
case or moves a constant. Nothing was dropped.

(`07-02` recorded 390 under the wider `tests/architecture/**/*.test.ts` glob, which also reaches
`catalog-uat/`. The 383 above uses the glob this plan's `<verify>` names.)

## Exported-Symbol Delta

**Zero.** This plan adds no `export` and removes none, in any file. Every constant and helper it
introduces is module-private:

| File | Added (module-private) |
|------|------------------------|
| `no-lifecycle-default-enabled-read.test.ts` | `CONTROL_TARGET:90`, `FIRST_CONST_BINDING:93`, `describeLifecycleViolation:95`, `offenderLineFor:108` |
| `compat-01-no-expansion.test.ts` | `OUTPUT_CATALOG_REL:111` |
| `no-hooks-strict-additional-properties.test.ts` | `HOOKS_SCHEMA_REL:30` |
| `scope-order-drift.test.ts` | `SCOPES_OWNER_REL:44`, `COMPARATOR_OWNER_REL:51` |
| `no-split-01-cast-reads.test.ts` | `collectOrchestratorFiles:93` |

Removed: the local `REPO_ROOT` constant in `manifest-read-seam.test.ts`,
`no-hooks-strict-additional-properties.test.ts`, `no-split-01-cast-reads.test.ts`,
`reconcile-planner-purity.test.ts`, and the two inline `repoRoot` derivations in
`scope-order-drift.test.ts` — all replaced by the `REPO_ROOT` import from `./source-scan.ts`.
None was exported. `07-15`'s unowned-export census is unaffected by this plan.

## What `07-16` Should Reconcile in the Registry

Two named scalars are missing, and both would let a gate this plan touched drop its last literals:

- **`PLUGIN_INFO_REL` and `MARKETPLACE_INFO_REL`**, typed `(typeof NETWORK_FREE_TARGETS)[number]`,
  for `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` and
  `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`. These are the two
  literals `compat-01-no-expansion.test.ts` still spells (deviation 1).
- **`LIFECYCLE_ENABLED_READ_CONTROL_TARGET`**, typed
  `(typeof LIFECYCLE_ENABLED_READ_TARGETS)[number]`, replacing this gate's
  `LIFECYCLE_ENABLED_READ_TARGETS[0]` index derivation, matching the `NETWORK_FREE_CONTROL_TARGET`
  form `07-01` established.

Neither was added here: the wave dispatch states that no plan owns `gate-targets.ts`, and the
plan's own prohibitions forbid adding a group.

Also for `07-16`'s census baseline: `compat-01-no-expansion.test.ts:111` still spells the TEST
path `tests/architecture/gate-targets.ts` for its delegation clause, which reads the registry
module as data. `D-07-07` scopes the registry to production paths, so this is in scope for the
meta-gate's exemption list rather than for a registry entry.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] `compat-01-no-expansion.test.ts` keeps two production path literals**

- **Found during:** Task 1
- **Issue:** The COMPAT-01 delegation clause names
  `orchestrators/plugin/info.ts` and `orchestrators/marketplace/info.ts` and proves both are
  still in the NFR-5 gate's target list by reading `gate-targets.ts` from disk and looking for
  the quoted literals. Importing those paths from `NETWORK_FREE_TARGETS` to remove the literals
  would make the clause a tautology — it would scrape a file for strings it had just read out of
  that same file — which the file's own header explicitly forbids ("Any expected member list
  DERIVED from the constant under test... makes the assertion a tautology that can never fail").
  The non-tautological move is a named registry scalar, and no plan owns `gate-targets.ts` this
  wave.
- **Fix:** The two literals stay, but are now typed
  `ReadonlyArray<(typeof NETWORK_FREE_TARGETS)[number]>`. That union is the group's own entries,
  so removing either surface from the registry stops this file compiling — a build-time proof
  strictly stronger than the runtime scrape, which is kept unchanged as the second layer. The
  needed registry scalars are recorded above for `07-16`.
- **Files modified:** `tests/architecture/compat-01-no-expansion.test.ts`
- **Verification:** `npm run typecheck` exits 0; the clause's mechanism, pattern, and failure
  message are unchanged; 15 cases pass in that file.
- **Committed in:** `5b8d8f32`

**2. [Rule 1 - Stale premise] `manifest-read-seam.test.ts` had no `REPO_ROOT` import to keep**

- **Found during:** Task 1
- **Issue:** The plan's action text says `compat-01-no-expansion.test.ts` and
  `manifest-read-seam.test.ts` "keep their `REPO_ROOT` import from `./source-scan.ts`". Only
  `compat-01` had one; `manifest-read-seam.test.ts` derived its own root through
  `fileURLToPath(import.meta.url)`.
- **Fix:** Switched it to the shared import, which is what the plan's stated principle ("one root
  constant serves the whole directory") asks for. The same private derivation was found in
  `no-hooks-strict-additional-properties.test.ts`, `no-split-01-cast-reads.test.ts`, and
  `reconcile-planner-purity.test.ts` and switched for the same reason, since all four had it only
  to build a path onto a target that now comes from the registry.
- **Files modified:** four of this plan's seven declared files
- **Verification:** `npm run typecheck` exits 0; every affected gate passes unchanged.
- **Committed in:** `5b8d8f32`, `cae90fe9`

**3. [Rule 3 - Blocker] `scope-order-drift.test.ts` walk root narrowed from `extensions/` to the extension root**

- **Found during:** Task 2
- **Issue:** The gate walked `path.join(repoRoot, "extensions")`. `"extensions"` is not a
  registry member and adding one would have meant editing `gate-targets.ts`.
- **Fix:** The walk is rooted at `EXTENSION_ROOT_REL`. Measured: `ls extensions/` returns exactly
  `pi-claude-marketplace`, so the two roots enumerate an identical file set today, and this is
  the root every other tree-walking gate in the directory already uses
  (`manifest-read-seam`, the vocabulary guard, the shell-out gate). The narrowing is the one
  semantic change this plan makes, so it is paired with the new non-emptiness assertion, which is
  what would catch a walk that stopped enumerating.
- **Files modified:** `tests/architecture/scope-order-drift.test.ts`
- **Verification:** both cases pass; the header comment was updated to describe the extension-root
  walk rather than an `extensions/**` walk, so the file does not claim a reach it no longer has.
- **Committed in:** `cae90fe9`

**4. [Rule 3 - Blocker] `no-split-01-cast-reads.test.ts` walk collected once instead of streamed twice**

- **Found during:** Task 2
- **Issue:** Two cases each streamed `walkTsFiles(ORCHESTRATORS_ROOT)` through
  `for await`. Adding a per-case non-emptiness assertion would have written the same
  count-then-assert shape twice in one file and a third time in `scope-order-drift.test.ts`,
  which is exactly the `duplicates.threshold: 3` clone the shared-helper convention exists to
  avoid.
- **Fix:** A module-private `collectOrchestratorFiles()` drains the generator once, asserts
  non-emptiness in one place naming `D-07-03`, and returns the list; both cases iterate it. The
  generator itself is untouched, and no pattern or message changed.
- **Files modified:** `tests/architecture/no-split-01-cast-reads.test.ts`
- **Verification:** `npx fallow dupes --fail-on-issues` exits 0 and reports 879 duplicated lines
  across 38 files — the same figure `07-02` recorded, so this plan introduced no clone group.
- **Committed in:** `cae90fe9`

---

**Total deviations:** 4 auto-fixed (3 × Rule 3 - blocking issue, 1 × Rule 1 - stale premise).
**Impact on plan:** One acceptance criterion is not met as written — `compat-01-no-expansion.test.ts`
holds 2 literals rather than 0 — and the reason is a registry constant this wave cannot add;
the residual is compiler-checked in the meantime and the exact fix is specified for `07-16`.
Deviations 2 and 4 make the slice tighter than the plan's wording. Deviation 3 is the only
semantic change in the plan and is documented at the file, in the header, and here.

## Issues Encountered

**Sibling churn on the shared tree, repeatedly.** Five executors ran concurrently in this one
checkout. `SKIP=trufflehog pre-commit run --files <my files>` failed four separate times on
whole-repo hooks naming files this plan does not own —
`tests/orchestrators/plugin/reinstall-flow.test.ts` (a parse error mid-write, then a
`padding-line-between-statements` error, then a removed `ReinstallPluginDeps` import) and
`tests/architecture/scope-fences-63.test.ts` (`TS6192: All imports in import declaration are
unused`). Every one cleared on its own within a few minutes. Both commits were taken in a window
where `npm run typecheck`, `npm run lint`, `npm run format:check`, and all three Fallow sub-gates
exited 0 standalone, and each of this plan's files passes `eslint --max-warnings=0` and
`prettier --check` individually. No sibling file was edited.

**A green `pre-commit` run and a green standalone run can disagree here.** On the last Task 1
attempt `npm typecheck` reported `Failed` inside `pre-commit` while `npx tsc --noEmit` exited 0
seconds later, because a sibling wrote a file between the two. On a shared tree the standalone
run is the trustworthy signal for a hook that ignores `--files`; the hook result is only
meaningful when it names a file you own.

**`WINDOWS.md` still cannot be appended to.** `07-01` and `07-02` both recorded that
`gsd-tools windows append` refuses on a table-versus-fenced-JSON desync (rows 30 and 9). Unchanged
and not caused here. This plan produced no stub, no skipped test, and no unrun `<verify>`; the one
partially-met acceptance criterion (compat-01's 2 literals) is deviation 1 above and is carried
into the `07-16` reconciliation list rather than left implicit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The temp-root mechanic is proved twice, on gates with different vocabularies, different
  target groups, and different failure messages.** A third consumer can copy either gate without
  reading `temp-root-control.ts`.
- **Derive the offender, do not write it.** `offenderLineFor` in the lifecycle gate is the form
  worth copying: read the real target, build the offending line around an identifier it actually
  declares, and assert if the derivation fails. It costs ten lines and removes the whole class of
  offender-drift.
- **`07-16` has three concrete registry additions and one exemption to record**, listed above. Two
  of them are the only thing standing between `compat-01-no-expansion.test.ts` and zero literals.
- **`07-15`'s export census is untouched by this plan** — zero exports added, zero removed.

---
*Phase: 07-gate-integrity*
*Completed: 2026-09-10*

## Self-Check: PASSED

- All seven declared files present on disk and modified.
- `5b8d8f32`, `cae90fe9` — both reachable in `git log --oneline --all`.
- `node --test "tests/architecture/*.test.ts"` → 383 pass, 0 fail.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `eslint.config.js`, and
  `tests/architecture/gate-targets.ts` — untouched by this plan (`git diff --name-only` over both
  commits lists only the seven declared files).
