---
phase: 113-update-enable-disable-reconcile
plan: 03
subsystem: api
tags: [enable-disable, install-ledger, reconcile, workflows, projection, typescript]

requires:
  - phase: 111-workflows-bridge
    provides: "`prepareStageWorkflows` / `commitPreparedWorkflows` with the `onPlaced` placed-name contract, the displace-and-restore commit path, and the whole-set ownership pre-check"
  - phase: 112-install-and-removal-lifecycle
    provides: "`InstallCtx.stagedWorkflowNames` as a required ledger-context member, the sixth `cascadeUnstagePlugin` unstage slot the disable branch already reaches, and `record.resources.workflows` as a required persisted array"
  - phase: 113-01
    provides: "the required `tense` discriminant on the discovery call (both paths here state `install` inside the bridge, so nothing changed at this seam)"
provides:
  - "`InstallLedgerSummary.stagedWorkflowNames` — a REQUIRED `readonly string[]` on the install ledger's outward projection, populated by its sole producer"
  - "the enable branch's read of that member, carried on the module-private outcome sentinel's fresh arm"
  - "cases pinning the empty, shrunken, renamed, foreign-occupied and repeat-run inventories against real envelopes on disk"
  - "a double-reconcile idempotence case with a negative control that was demonstrated to fire in BOTH directions"
  - "`rewriteWorkflowScripts` / `seedWorkflowRoundTrip` / `recordedWorkflowNames` — the enable/disable round-trip fixture plan 04 computes its retired set from"
affects: [113-04, 113-05]

actuals:
  tokens: 8356
  tasks: 3
  commits: 2

tech-stack:
  added: []
  patterns:
    - "an mtime baseline BACKDATED with `utimes` before the act, so 'no write happened' and 'a write happened' are distinguishable without depending on two operations landing in different milliseconds — paired with a negative control run under the same backdating"
    - "a projection member that carries NAMES beside two siblings that carry only lengths, with the doc comment stating which question each answers"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - tests/orchestrators/plugin/install.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/reconcile/plan.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts
    - tests/integration/workflow-kind-inversion.test.ts

key-decisions:
  - "The enable branch's reader is `stagedWorkflowNames?: readonly string[]` on the MODULE-PRIVATE `SetEnabledOutcome` fresh arm — not on the exported `EnableDisablePluginOutcome`, which the load-time reconcile caller consumes. Keeping it off that union is what structurally prevents the reload path from ever stamping a workflow-retirement fact."
  - "That member is OPTIONAL, not required. Three producers reach the `fresh` arm and only one of them materializes: `runDisableBranch` and `resolveIdempotentOutcome` stage nothing at all. An empty array there would be indistinguishable from 'materialized and placed nothing', which is the opposite claim, and plan 04's set difference would then read every recorded name as retired on a config-write-back."
  - "The projection member itself is REQUIRED, per the plan and for the same reason `InstallCtx`'s is: a producer that could omit the axis could report a materialization as having placed nothing."
  - "The order the projection reports is the discovery pass's sorted FILE-NAME order, and the fixtures that pin it deliberately make the file-name order and the generated-name order disagree. A fixture whose two orders agree cannot tell a faithful producer from one that re-sorts."
  - "The mtime baseline is backdated before every idempotence act. The observation is still a real modification time read back off a real file — what the backdating removes is the same-millisecond ambiguity, and the negative control runs under the identical backdating, so it proves the harness can still see a write."
  - "The criterion-3 negative control needs MORE than the forced-open version gate: a strictly grown supported set AND `compatibility.installable === false`. Forcing only the version gate produces a scan that finds nothing to promote and stamps silently."

patterns-established:
  - "A projection member read for membership rather than emptiness states so at its declaration, beside the siblings that are read for emptiness, because the standing comment forbidding those siblings' NAMES from reaching a rendered row would otherwise read as covering it too."
  - "An idempotence claim is asserted against a BACKDATED baseline and paired with a negative control run under that same baseline. The pairing is the whole point: a backdated baseline that no write can move would make every idempotence case vacuously green."

requirements-completed: [WLIF-05]

coverage:
  - id: D1
    description: "the workflow envelope names a materialization placed ride on the install ledger's outward projection as a required member carrying names"
    requirement: "WLIF-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#runInstallLedger projects a complete empty-plugin summary and preserves a caller pin"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WLIF-01: a re-stage over a kept record displaces the plugin's own envelope"
        status: pass
      - kind: other
        ref: "grep -c 'stagedWorkflowNames' orchestrators/plugin/install.ts prints 8 (>= 3 required)"
        status: pass
    human_judgment: false
  - id: D2
    description: "the enable branch reads that member where the pre-enable record is in scope"
    requirement: "WLIF-05"
    verification:
      - kind: other
        ref: "grep -c 'stagedWorkflowNames' orchestrators/plugin/enable-disable.ts prints 2 (>= 1 required)"
        status: pass
      - kind: unit
        ref: "node scripts/test-coverage-direct.mjs …/enable-disable.ts → branches 140/140, functions 24/24, lines 1373/1373"
        status: pass
    human_judgment: false
  - id: D3
    description: "enable re-materializes; the shrunken, renamed and empty inventories each produce the right set"
    requirement: "WLIF-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-05: an enable over a shrunken source re-places only the surviving workflow"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-05: an enable over a renamed workflow re-places only the new name"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-05: a plugin declaring no workflows enables and disables placing none"
        status: pass
    human_judgment: false
  - id: D4
    description: "disable removes every envelope its record names and keeps naming them"
    requirement: "WLIF-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-05: a disable takes every recorded envelope off disk"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts (pre-existing) — the cascade's `dropped.workflows` axis itself"
        status: pass
    human_judgment: false
  - id: D5
    description: "the reported order is the discovery pass's sorted file-name order and is stable across two runs"
    requirement: "WLIF-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WLIF-05: the projection reports the placed names in discovery order, stably"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-05: two enables over an unchanged tree report the same names in file order"
        status: pass
    human_judgment: false
  - id: D6
    description: "a target path held by a file the record does not name is refused, and that file survives byte-unchanged"
    requirement: "WLIF-05"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install.test.ts#WLIF-05: a refused re-stage places nothing and leaves the foreign envelope intact"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts#WLIF-05: an enable refuses a target held by a file the record does not name"
        status: pass
    human_judgment: false
  - id: D7
    description: "a load-time reconcile rewrites no workflow envelope, on the first load or any later one"
    verification:
      - kind: integration
        ref: "tests/integration/workflow-kind-inversion.test.ts#RECON-05: two consecutive reconciles leave a workflow envelope untouched"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/plan.test.ts#RECON-05: a declared, enabled, workflow-bearing record lands in no bucket"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/reconcile/backfill.test.ts#RECON-05: places no workflow envelope for a record whose supported set did not grow"
        status: pass
    human_judgment: false
  - id: D8
    description: "the idempotence case is non-vacuous — the harness was shown to observe a write, and the case was shown to go red"
    verification:
      - kind: integration
        ref: "tests/integration/workflow-kind-inversion.test.ts#RECON-05 negative control: a forced-open gate over a grown set DOES rewrite it"
        status: pass
      - kind: other
        ref: "two temporary reverts, both observed red, both recorded verbatim below"
        status: pass
    human_judgment: false

duration: 50min
completed: 2026-09-05
status: complete
---

# Phase 113 Plan 03: The staged workflow names on the projection Summary

**A verb outside the install ledger can now learn which workflow envelopes a materialization actually placed, and the claim that a reload rewrites none of them stopped being a reading of the control flow and became a case that was watched fail in both directions.**

## Performance

- **Duration:** ~50 min
- **Started:** 2026-09-06T01:35:00Z (approx.)
- **Completed:** 2026-09-06T02:05:00Z
- **Tasks:** 3 of 3
- **Files modified:** 7

## Task Commits

1. **Task 1: the staged workflow names on the ledger's outward projection** — `dde0e281` (feat)
2. **Task 2: the load-time no-re-materialization guard, with a negative control** — `d1aae1c2` (test)
3. **Task 3: wave gate — the whole suite over both halves** — no commit; every gate was already green at `d1aae1c2` and nothing needed fixing.

## Accomplishments

- `InstallLedgerSummary` carries `stagedWorkflowNames` as a required `readonly string[]`, projected from the context member the workflows commit already fills through `onPlaced`. Its declaration says what separates it from the two staged-name lists beside it, which are read only for their emptiness and whose names are under a standing "never reach a rendered row" comment — that comment does not cover this one, and the code now says so.
- The enable branch reads it where the pre-enable record is already in scope as a parameter, onto the module-private outcome sentinel. Nothing renders it.
- Every edge of the set is pinned against real envelopes on disk: empty, shrunken, renamed, foreign-occupied, and two runs over an unchanged tree.
- The load-time no-re-materialization claim has a case, and the case was demonstrated to go red when re-materialization is reintroduced.
- `disable` was verified, not re-implemented: it already reaches the sixth unstage through `cascadeUnstagePlugin`, whose `dropped.workflows` axis is pinned in `tests/orchestrators/marketplace/shared.test.ts`. The new case adds that the disable VERB removes the whole recorded set, which the axis test does not claim.

## Answers the plan asked for

### 1. The shrunken-source and renamed-workflow fixture shapes

Plan 04 computes its retired set from exactly these, so the shape is stated exactly. All three helpers live in `tests/orchestrators/plugin/enable-disable.test.ts` and are used from inside `withHermeticHome` (the workflow home derivation reads `process.env.HOME`; a `locationsFor` call outside the closure points `workflowsSavedDir` at the developer's real home).

```ts
/** Replaces the plugin's WHOLE workflow script set in the marketplace clone. */
async function rewriteWorkflowScripts(
  mpRoot: string,
  pluginName: string,
  scripts: readonly { sourceName: string; metaName?: string }[],
): Promise<void>;

/** Seeds the disabled record + the initial script set; `[]` leaves no workflows directory. */
async function seedWorkflowRoundTrip(
  home: string,
  cwd: string,
  scripts: readonly { sourceName: string; metaName?: string }[],
): Promise<{
  args: { pi: ExtensionAPI; cwd: string; marketplace: string; plugin: string; scope: "user" };
  statePath: string;
  mpRoot: string;
  savedDir: string;
}>;

/** The persisted workflow inventory for the fixture's one plugin. */
async function recordedWorkflowNames(statePath: string): Promise<readonly string[] | undefined>;
```

Five facts a consumer must inherit:

1. **The plugin is `foo-plugin` in marketplace `claude-plugins-official`, USER scope, version `1.2.3`,** seeded through the file's existing `seedRealDisabledMarketplace`. The generated-name form is `foo-plugin:<metaName>` and the envelope lands at `<workflowsSavedDir>/foo-plugin:<metaName>.json`.
2. **Every case is a full round trip — enable, disable, mutate the source, enable again.** The set difference that matters only exists once a real disable has left a populated inventory behind; a hand-seeded disabled record (which is what `seedRealDisabledMarketplace` produces on its own) carries empty `resources` arrays and cannot reach it.
3. **The shrunken shape** is `[{ sourceName: "greet" }, { sourceName: "wave" }]` → enable → disable → `rewriteWorkflowScripts(…, [{ sourceName: "greet" }])` → enable. Recorded inventory `["foo-plugin:greet", "foo-plugin:wave"]`, newly staged `["foo-plugin:greet"]`, retired `["foo-plugin:wave"]`. The `wave` envelope is gone from disk.
4. **The renamed shape** is `[{ sourceName: "greet" }]` → enable → disable → `rewriteWorkflowScripts(…, [{ sourceName: "hail" }])` → enable. Recorded `["foo-plugin:greet"]`, newly staged `["foo-plugin:hail"]`, retired `["foo-plugin:greet"]`. A rename retires exactly as a deletion does. **The rename must move the `meta` export as well as the file**: the generated name follows the export, so renaming only the file leaves the name unchanged and the case would prove nothing.
5. **`metaName` is separate from `sourceName` on purpose.** The ordering cases set them in opposition (`{ sourceName: "a-second", metaName: "zulu" }`, `{ sourceName: "z-first", metaName: "alpha" }`) so the file-name order and the generated-name order disagree, and the reported array is `["foo-plugin:zulu", "foo-plugin:alpha"]`. A fixture whose two orders agree cannot distinguish the producer that preserves discovery order from one that re-sorts.

The projection-level equivalents live in `tests/orchestrators/plugin/install.test.ts` and reuse that file's existing `seedPathMarketplaceWithPlugin({ workflows: […] })` + `writeWorkflowScripts` helpers, unchanged.

### 2. Did the negative control need anything beyond forcing the version gate?

**Yes — two more things, and neither is optional.**

Forcing the version gate open alone produces a scan that finds nothing to promote and stamps silently, so the envelope's mtime does not move and the "control" would be indistinguishable from the idempotence case. Reaching a re-materialization needs, in addition:

- **`compatibility.installable === false` on the record.** `hasForceInstalledPlugin` gates the whole scan on at least one such record, and the per-record filter reaches only records the resolver could not fully install.
- **A supported set the resolver now strictly grows.** `supportedSetGrew` refuses on `resolved.length <= recorded.length` and on any recorded kind missing from the resolved set, so the seeded record has to claim LESS than the source actually offers.

The control therefore rewrites the state file after the install to `lastReconciledExtensionVersion: "0.0.0"` plus `compatibility: { installable: false, supported: ["skills"], unsupported: ["workflows"] }`, over the same workflow-bearing plugin.

Both directions were then demonstrated, each by a temporary one-block revert that was reverted immediately after:

**(a) The idempotence case can go red.** The negative control's forcing (stale stamp + shrunken supported set) was inserted into the idempotence case before its first reconcile. Verbatim:

```
✖ RECON-05: two consecutive reconciles leave a workflow envelope untouched
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
    actual: 1788659562387.1355,
    expected: 1577836800000,
```

`1577836800000` is the backdated baseline; the actual is the re-materialization's wall-clock write. **This is the measurement the plan required:** the guard fires when re-materialization is reintroduced.

**(b) The control's write is caused by the gate it names.** `persisted.lastReconciledExtensionVersion = "0.0.0"` was changed to `EXTENSION_VERSION`, closing the gate:

```
✖ RECON-05 negative control: a forced-open gate over a grown set DOES rewrite it
  AssertionError [ERR_ASSERTION]: Expected "actual" to be strictly unequal to:
    actual: 1577836800000,
    expected: 1577836800000,
```

So the control is not observing an incidental write; it is observing the backfill running.

### 3. The whole-tree gate result at the wave boundary

Run over the whole tree at `d1aae1c2`, not over the staged diff:

| Member | Result |
|---|---|
| `typecheck` | exit 0, `0` lines matching `): error TS` |
| `lint` (`eslint extensions tests scripts eslint.config.js`) | exit 0 |
| `fallow` (dead-code / health / dupes) | exit 0, no threshold override added, no suppression marker added |
| `format:check` | "All matched files use Prettier code style!" |
| `test:corresponding` | exit 0 |
| `test:corresponding:negative` | exit 0 |
| `test:coverage:direct:negative` | exit 0 |
| `test` | **5484 pass / 0 fail**, 312 suites |
| `test:integration` | **34 pass / 0 fail** |
| `test-coverage-direct` on `enable-disable.ts` | branches 140/140, functions 24/24, lines 1373/1373 |

Nothing was reported, so Task 3 produced no commit. No production file was modified by Task 2, as its acceptance requires.

## The reader, and its one-plan gap

**Read this before executing plan 04.** `stagedWorkflowNames` on the enable sentinel currently has a producer and no consumer. That is deliberate and is what the plan sequenced, but it is exactly the shape this milestone has refused before, so it is called out rather than buried:

```ts
type SetEnabledOutcome =
  | { kind: "idempotent" }
  | ({
      kind: "fresh";
      version?: string;
      stagedWorkflowNames?: readonly string[];   // <- producer here, consumer in plan 04
    } & EnableDegradationSignals)
  | …
```

Plan 04's enable gate is `installed.resources.workflows \ summary.stagedWorkflowNames`, and both operands are already in scope inside `runEnableBranch`. Plan 04 may therefore either read this member or compute the difference from `summary` directly — but it must not leave the member with no reader. If plan 04 computes from `summary` directly, **delete this member in the same commit**; a field carried on a sentinel that nobody reads is worse than one that was never added.

The member is optional rather than required for a reason that matters to plan 04's correctness: three producers reach the `fresh` arm and only `runEnableBranch` materializes anything. `runDisableBranch` and `resolveIdempotentOutcome` (the config-write-back arm) stage nothing at all, so an empty array on those arms would read as "materialized and placed nothing" and a naive record-minus-staged difference would report every recorded name as retired on a plain config write-back. Absent means "no materialization ran here", which is the truthful claim.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` — `InstallLedgerSummary.stagedWorkflowNames` (required, documented) and its line in `toInstallLedgerSummary`
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` — the optional member on the module-private sentinel's fresh arm and the enable branch's read
- `tests/orchestrators/plugin/install.test.ts` — the whole-summary `deepStrictEqual` extended to pin the empty array; the re-stage case's stale "the summary carries no workflows member" comment replaced by a projection assertion; two new cases (discovery-order stability, foreign-target refusal)
- `tests/orchestrators/plugin/enable-disable.test.ts` — three fixture helpers and six round-trip cases
- `tests/orchestrators/reconcile/plan.test.ts` — a `workflows` option on the record helper, and a bucket case over a declared/enabled/workflow-bearing record
- `tests/orchestrators/reconcile/backfill.test.ts` — a `workflow` option on the plugin-tree helper, a `savedWorkflowEntries` reader, and a no-growth case that asserts the engine's saved directory stayed empty
- `tests/integration/workflow-kind-inversion.test.ts` — the double-reconcile idempotence case and its negative control

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] The foreign-target case's first expectation was wrong about the plugin's own envelope**

- **Found during:** Task 1.
- **Issue:** The case asserted that a refused re-stage leaves ONLY the planted foreign file in the saved directory. It fails: `displacePreviousTargets` moves every recorded name aside one statement BEFORE `assertTargetsUnoccupied` runs, and the refusal's rollback restores them, so the plugin's own `hello:greet.json` is back at its target.
- **Fix:** Assert both files. This is the stronger claim and the one that matters — a refusal that left `hello:greet` in the staging tree would have unregistered a command the user never asked to lose.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Committed in:** `dde0e281`

**2. [Rule 2 — Missing critical functionality] The re-stage case carried a claim this plan makes false**

- **Found during:** Task 1.
- **Issue:** `WLIF-01: a re-stage over a kept record displaces the plugin's own envelope` documented itself with "`InstallLedgerSummary` deliberately carries no workflows member, so the proof … is the state snapshot". After this plan that sentence is false, and it is the first thing a reader of that case meets.
- **Fix:** Replaced with an assertion on `result.summary.stagedWorkflowNames` alongside the existing state-snapshot assertion, and a comment saying why both are asserted — they answer different questions, and the projection is the only one a caller outside the ledger can see.
- **Files modified:** `tests/orchestrators/plugin/install.test.ts`
- **Committed in:** `dde0e281`

### Departures from the plan's literal instruction

**3. The idempotence baseline is backdated with `utimes` before the act**

The plan says "use real modification times read back from disk. Do not fake a clock". The times ARE real and are read back off the real files with `stat`; what is set beforehand is the BASELINE, to `2020-01-01T00:00:00.000Z`. Without it, "unchanged" means "the reconcile did not happen to write in a different millisecond than the install did", which is a flaky assertion rather than a weaker one. The backdating is what makes both the positive and the negative claim unambiguous, and the negative control runs under the identical backdating — its red run above is the proof that a backdated baseline is still movable by a real write.

**4. `git status --porcelain` is not empty at the wave boundary**

Task 3's `<fails_when>` reads "the output is non-empty — a formatter hook rewrote a file after the last commit and the rewrite was not landed". The stated hazard does not hold: no file this plan touched is dirty, and `git status` was checked after each of the two commits. What remains dirty is the operator's own concurrent working set, present at session start and untouched here — `.claude/settings.json`, `.codex/config.toml`, `.planning/workstreams/workflows/state.json`, plus untracked `.claude/CLAUDE.md`, `.codegraph/`, `.mcp.json`, `AGENTS.md`, `.planning/workstreams/workflows/{config,.verification-ledger}.json`. Staging them would violate the project's explicit "never `git add -A`" rule.

**5. The backfill's generic no-growth case already existed**

Task 2 asks for "a backfill case asserting a record whose supported set did not grow is skipped". `D-68-03: skips a partially-installed plugin whose supported set did not grow` already pins that rule, with a sibling covering the longer-but-not-a-superset shape. Re-stating it for workflows would have been a near-clone under a `dupes` gate with a threshold of 3. The new case instead carries the workflows axis AND one assertion no sibling makes: that the host engine's saved directory — which lives under the hermetic HOME, outside the scope root the sibling cases' tree inventory covers — is still empty afterwards.

---

**Total deviations:** 2 auto-fixed (1 × Rule 1, 1 × Rule 2) + 3 documented departures
**Impact on plan:** No scope creep. No production behaviour changed beyond the one projection member and its reader.

## Issues Encountered

- **TruffleHog fails structurally in this checkout.** `.git` is a file (linked worktree), so the hook's git-mode scan cannot read `.git/index`. Confirmed clean by filesystem-mode scan over the exact paths committed — `verified_secrets: 0`, `unverified_secrets: 0` for both commits — then committed with `SKIP=trufflehog` only, per CLAUDE.md. No other hook was skipped and `--no-verify` was never used.
- **No pre-commit hook is installed in this checkout**, so `pre-commit run --files` was run by hand before each commit and fixed to clean. `git status` after each commit shows no hook-written file.
- **Nothing about the enable/disable projection required a complexity extraction.** Both edits are one line each and `npm run fallow` exits 0 with `.fallowrc.json` still carrying zero `health.thresholdOverrides`.

## `actuals.tokens` basis

`8356` is `chars/4` over the **realized diff** (`git diff HEAD~2 HEAD` additions: 33,425 characters), which is the basis the executor instruction names. For calibration, the same files measured whole are 855,132 characters (≈213,783 on the same scale). The plan's `estimate.tokens: 85000` carried `confidence: low` and did not state which of the two bases it used; a calibrator comparing against it should first settle that, because the two differ by more than an order of magnitude and the sibling plans in this phase did not use the same one.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready. Four things plan 04 inherits:

- **`summary.stagedWorkflowNames` is on the projection, required, carrying names.** The enable gate is `installed.resources.workflows \ summary.stagedWorkflowNames`, and both operands are in scope inside `runEnableBranch`.
- **The sentinel member has no consumer yet.** Wire it or delete it in plan 04's own commit — see "The reader, and its one-plan gap" above, including why it is optional.
- **`seedWorkflowRoundTrip` + `rewriteWorkflowScripts` are the enable/disable retirement vehicles.** The shrunken shape retires `foo-plugin:wave`; the renamed shape retires `foo-plugin:greet`. Both are already green and need no new fixture.
- **The disable side needs no new plumbing.** `cascadeUnstagePlugin`'s `dropped.workflows` is what plan 04's disable gate reads, and both disable arms already have it.

No blockers.

---
*Phase: 113-update-enable-disable-reconcile*
*Completed: 2026-09-05*

## Self-Check: PASSED

- Files verified on disk: `orchestrators/plugin/install.ts`, `orchestrators/plugin/enable-disable.ts`, `tests/orchestrators/plugin/install.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `tests/orchestrators/reconcile/plan.test.ts`, `tests/orchestrators/reconcile/backfill.test.ts`, `tests/integration/workflow-kind-inversion.test.ts`
- Commits verified in `git log`: `dde0e281`, `d1aae1c2`
- `.planning/workstreams/workflows/STATE.md` and `ROADMAP.md`: untouched, per the orchestrator's ownership of those files.
