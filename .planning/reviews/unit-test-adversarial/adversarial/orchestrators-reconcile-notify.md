# Orchestrators — reconcile notify, backfill, pending, types — adversarial re-review

**Scope:** the four files the first pass declared clean
(`tests/orchestrators/reconcile/reconcile.messaging.test.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/{pending,types,reconcile.messaging}.ts`),
attacked with the mutation catalogue; plus a full re-read of the other six files in
the area (`notify.test.ts`, `backfill.test.ts`, `pending.test.ts`,
`types.test.ts`, `reconcile/notify.ts`, `reconcile/backfill.ts`) to grade the
nine first-pass findings and hunt what a partitioned pass could not see. I also
read the collaborators the area's contracts depend on: `shared/notify.ts`'s row
primitives (lines 2033–2694), `domain/manifest.ts`, `domain/components/plugin.ts`,
`domain/resolver.ts`'s union shape, `reconcile/apply.ts`'s outcome-building loops,
`orchestrators/plugin/shared.ts::emitMarketplaceNotAdded`, and
`tests/edge/notification-boundary.ts`.
**First-pass file:** `unit-test-findings/orchestrators-reconcile-notify.md`
**Clean files attacked:** 4
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 11 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 0 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 1 |

The area's headline result: **the first pass's only two BLOCKERs are its two
weakest findings.** One is factually refuted by a case sitting 65 lines below the
table the finding cites; the other is half-refuted (one of its two branches
cannot be reached through the public surface at all, so the instruction it gives
is unexecutable). Meanwhile all four "clean" verdicts fail under attack.

## New findings — from the clean lists

### `tests/orchestrators/reconcile/reconcile.messaging.test.ts`

- **[BLOCKER] `will enable` and `will disable` rows can silently lose their `[scope]` bracket** — `lines 156–184`
  Deleting `renderScopeBracket(p.scope, mpScope)` from `renderWillEnable`
  (`reconcile.messaging.ts:105`) or from `renderWillDisable`
  (`reconcile.messaging.ts:109`) leaves the whole unit suite green. Both cases
  build a message with **no `scope` field at all**
  (`{ name: "alpha", status: "will enable" }`), so the bracket token renders `""`
  either way and `joinTokens` drops the empty slot. The two sibling arms are
  covered — `will install` at `line 117` (`"● alpha [project] (will partially
  install)"`) and `will uninstall` at `line 137` (`"○ alpha [user] (will
  uninstall)"`) — so this is drift inside one file, not a whole-file gap. I
  confirmed no other suite closes it: `grep -rn "(will enable)" tests` returns
  exactly two sites, this one and `tests/shared/notify.test.ts:4267`, and that
  one also renders scope-less rows (`"● mp [user]\n  ● to-enable (will enable)\n
  ◍ to-disable (will disable)"`). The cross-scope bracket is a binding contract
  (`docs/messaging-style-guide.md:73`, quoted in `shared/notify.ts:2130–2137`).
  Fix: in the two cases at lines 156 and 171, add `scope: "project"` to the
  message and change the expectations to `"● alpha [project] (will enable)"` and
  `"◍ alpha [project] (will disable)"`, matching the shape the `will uninstall`
  case at line 137 already uses.

- **[WARNING] Two case titles claim soft-dependency-marker independence the cases do not demonstrate** — `lines 235, 333`
  `"applied installed composes reasons and independent missing soft-dependency
  markers"` sets `dependencies: ["agents", "mcp"]` **and** both probe flags false,
  so swapping the two `p.dependencies.includes(...)` arguments inside
  `installedLikeRow` produces the identical string. Same for the
  `partially-installed` case at line 333. Nothing in these cases separates the
  agents axis from the mcp axis, which is what "independent" asserts. Fix: change
  the case at line 235 to `dependencies: ["agents"]` with
  `noSoftDependenciesLoaded()` and expect `{orphan rewake, requires
  pi-subagents}`, and add one sibling case with `dependencies: ["mcp"]` expecting
  `{requires pi-mcp}` only. (The composer itself is owned by `shared/notify.ts`;
  the point here is that these two cases do not, contrary to their titles,
  back-stop it.)

- **[WARNING] `PENDING_STATUSES` is exported only so this test can read it** — `reconcile.messaging.ts:68`, read at `line 89`
  `grep -rn PENDING_STATUSES extensions tests` returns three sites: the export,
  the internal `type PendingStatus = (typeof PENDING_STATUSES)[number]` on the
  next line, and this test. No production module outside `reconcile.messaging.ts`
  reads it, and no closed-set gate does either (unlike `PLUGIN_STATUSES` /
  `MARKETPLACE_STATUSES` in `shared/notify.ts`, which have real consumers). The
  guidelines call a production export added for a test a finding. Fix: drop the
  `export` keyword and delete the `pendingStatuses` half of the case at line 89 —
  the same case already asserts `Object.keys(PENDING_CONTEXT.render)` against the
  same expected list, which is the assertion that actually pins the render map's
  totality.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts`

- **[WARNING] `renderUninstalled` re-inlines a helper that `shared/notify.ts` exports specifically to stop that** — `lines 182–190`
  The arm hand-writes the six-token body of `renderUninstalledRow`
  (`shared/notify.ts:2352–2365`) token for token, including the always-empty
  `composeReasons(undefined, false, false, probe)` slot. That helper's own doc
  comment (`shared/notify.ts:2345–2351`) says it is "exported so the per-command
  render maps in `orchestrators/*.messaging.ts` CALL the central presentation
  vocabulary (D-11) instead of re-inlining byte-identical arm bodies", and both
  siblings that emit an `(uninstalled)` row already do:
  `orchestrators/plugin/uninstall.messaging.ts:41` and
  `orchestrators/marketplace/remove.messaging.ts:52`, each written as
  `uninstalled: (p, probe, mpScope) => renderUninstalledRow(p, probe, mpScope)`.
  This copy is the only one left, so a change to the central row (a version-slot
  move, a reasons thread) reaches every surface except reconcile's, and only
  reconcile's own byte test would notice — after the drift has shipped. Fix:
  replace lines 182–190 with
  `const renderUninstalled: RenderFn<PluginUninstalledMessage> = (p, probe, mpScope) => renderUninstalledRow(p, probe, mpScope);`
  and add `renderUninstalledRow` to the existing `shared/notify.ts` import block.
  (The four pending-tense arms have no such option: `renderPendingRow`
  (`shared/notify.ts:2514`) is file-private, so those bodies are duplicated with
  no shared seam and no gate proving the two copies agree — worth exporting it
  the same way, but that is a `shared/notify.ts` change.)

### `extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts`

- **[WARNING] The scope half of the `recordedMarketplaces` key is never exercised** — `pending.ts:196–200, 238`
  The key is `` `${scope} ${mpName}` `` and the comment states the reason
  ("Keyed by `(scope, marketplace)` to disambiguate the same marketplace name
  across scopes"). Dropping `scope` from both the `set` and the `get` leaves every
  case in `pending.test.ts` green: all five FSTAT-06 rows
  (`pending.test.ts:512–570`) stage a single project scope, and the two-scope
  cases (`lines 174, 364`) record no marketplace at all. Fix: add one case that
  records `mp-github` **in the user scope** with a degrading clone (`.lsp.json`
  present) while the **project** scope declares `cr@mp-github` without recording
  it; expect `"● mp-github [project]\n  ● cr (will install)"`. With a scope-blind
  key the user scope's record would be found and the row would wrongly read
  `(will partially install)`.

- **[WARNING] `let state;` carries no annotation across the try/catch** — `pending.ts:176`
  An evolving-`let` whose type a reader cannot see at the declaration, in a file
  where every other binding is either `const` or annotated. Fix: write
  `let state: ExtensionState;` (`ExtensionState` is already imported at line 59).

### `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts`

- **[WARNING] Three comments narrate code that no longer exists** — `lines 105–107, 133–137, 240–243`
  `.claude/rules/typescript-comments.md` forbids narration of a replaced shape
  ("drop `the former X`, `X used to …`", "restate the rationale as a
  present-tense fact"). Live instances: "an earlier two-axis marker intersected
  both and excluded exactly the disabled-partial record (ENBL-04 violation)";
  "the prior fused shape was overloading sentinel strings … and punning
  `marketplace` as a raw config-key carrier"; "Both moved from apply.ts when the
  backfill pass became its own module". `backfill.ts:8–12` carries a fourth ("It
  lived inside apply.ts and its two entry points were reached through `__test_`
  re-exports"). Each keeps its decision ID and its rationale when rewritten in the
  present tense — e.g. "Each cause carries only the fields its diagnostic renders,
  so no sentinel string is ever punned onto a data field"; "FLOW-09: two files in
  this folder name these, so they live here rather than in either of them."

### `tests/orchestrators/reconcile/notify.test.ts` (not clean-listed, but the gap was missed)

- **[BLOCKER] `resolvePendingForceInstalls` is never given more than one candidate** — `lines 1895–1987`
  All five cases build `plans = [reconcilePlan("project", { pluginsToInstall: [install] })]`
  from one module-level `install` const. Replacing the outer
  `for (const plan of plans)` with `const plan = plans[0]`, or the inner
  `for (const install of plan.pluginsToInstall)` with a first-element read
  (`notify.ts:293–294`), leaves all five green — and the function's stated promise
  (`notify.ts:274–276`) is to "resolve **every** planned install candidate". A
  reconcile that installs several plugins is the normal case, so this is the
  mutation most likely to ship. `pending.test.ts` does not close it either: each
  of its five FSTAT-06 rows stages exactly one planned install. Fix: add one case
  with two plans (`project` and `user`) each carrying two installs, where only the
  **second** install of the **second** plan degrades, and assert
  `new Set(["user\u0000mp\u0000second"])` — that single case kills both loop
  mutations at once.

- **[WARNING] The resolve step has no injection seam, so three cases build real plugin trees and one depends on another module's error behavior** — `lines 1903–1974`
  `resolvePendingForceInstalls` takes an injected `locate` port but calls
  `resolveStrict` by static import (`notify.ts:302`), so proving "candidate
  resolves partially-available" requires materializing a real `.lsp.json` tree,
  and proving the catch block requires a filesystem trick: the case at line 1954
  points `marketplaceRoot` at a regular file and relies on `resolveStrict`
  throwing `ENOTDIR`. If `domain/resolver.ts` ever classifies that as an
  `unavailable` verdict instead of a throw, the case keeps passing — through the
  `state !== "partially-available"` path — while the catch block it names goes
  untested. Fix: give the function a second injected port
  (`resolve: (entry, opts) => Promise<ResolvedPlugin>`), wired at the one
  composition site in `pending.ts:252`; then the four verdict/throw cases become
  plain stubs and only `pending.test.ts` needs a real tree.

- **[WARNING] The `Object.freeze` immutability contract is never asserted** — `notify.ts:136, 430, 972`
  Removing all three `Object.freeze(...)` calls leaves every case in
  `notify.test.ts` green — `deepStrictEqual` does not observe frozen-ness. The
  file is otherwise rigorous about immutability (its type surface is
  `readonly` throughout, and `types.test.ts:324–343` even proves the plan buckets
  are readonly at the type level with an `IsMutableArray` mapped check). Fix: in
  the empty-outcome case (`notify.test.ts:435`) and the empty-plan case
  (`line 1345`), add `assert.ok(Object.isFrozen(cascade.marketplaces))` and the
  same for one block's `plugins` array.

- **[WARNING] Two of the three sentinels `reasonAsContent` maps have no producer anywhere** — `notify.ts:929–930`
  `grep -rn "not added to" extensions` shows `"marketplace not added to user
  scope"` / `"…project scope"` are produced only inside `shared/notify.ts:3618–3619`,
  as a rendered token on the standalone `marketplace-not-added` message — never
  as a `PerEntryOutcome.reason`. So those two disjuncts are unreachable through
  the apply pass, and deleting them survives the suite. This is a production
  decision, not a test gap: either narrow the check to the one producible sentinel
  and let `Reason`'s type surface carry the rest, or (cheaper) extend the covering
  case at `notify.test.ts:484` into a three-row data-driven loop, since all three
  literals reach the same arm.

### `tests/orchestrators/reconcile/backfill.test.ts` (not clean-listed, gaps missed)

- **[WARNING] A second byte-equivalent duplicate of an already-extracted shared helper** — `lines 79–94` (`createSilentBoundary`)
  `tests/edge/notification-boundary.ts` already provides exactly this: its own
  header (`lines 18–23`) documents the zero-count case — "A count of 0 states no
  expectation at all rather than `times(0)` … Leaving the member unstated makes
  the mock serve its pending-call proxy instead, so the first unwanted emission,
  probe, or `cwd` read fails where it happens" — which is verbatim the silence
  proof `createSilentBoundary` re-implements. `grep -rn "createNotificationBoundary(0, 0)" tests`
  shows the shared form is the established convention, and `backfill.test.ts` is
  the **only** file in the repo carrying a hand-rolled equivalent
  (`grep -rln createSilentBoundary tests` → one file). This is the same WR-08
  class as the hermetic-scope duplicate the first pass found, but a *different*
  helper it missed. Fix: delete lines 79–94 and use
  `const { ctx, pi, verifyBoundary } = createNotificationBoundary(0, 0);` — the
  shared factory returns `ExtensionCommandContext`, which extends
  `ExtensionContext`, so every call site compiles unchanged.

- **[WARNING] Seven cases fake `Date` where the production code should take a clock** — `lines 743, 825, 916, 1015, 1186, 1406, 1743`
  `t.mock.timers.enable({ apis: ["Date"], now: … })` is used purely so the
  `updatedAt` field of the re-materialized record is predictable. The guidelines
  allow `t.mock.timers` only "when scheduling itself is the behavior" and name
  faking `Date` where a clock would do as a finding. The root cause is production:
  `orchestrators/plugin/reinstall.ts:1409` reads `new Date().toISOString()` inline
  (`grep -rn "new Date()" extensions` → **15 sites** across install, update,
  enable-disable, reinstall, marketplace add/update, completion-cache, hooks
  registry). Fix belongs with the hidden-clock work, not here; record it against
  those modules and leave the fake in place until the seam exists — see
  Meta-findings.

### Cross-file (production, area-wide)

- **[WARNING] Three exports in this folder have no consumer outside their own module** — `notify.ts:259`, `pending.ts:64`, `reconcile.messaging.ts:68`
  `PendingInstallCandidateLocator` (`notify.ts:259`) is referenced only by
  `resolvePendingForceInstalls`'s own signature two lines of code later —
  and `pending.ts:235–237`, its one real consumer, spells the type out inline
  (`(install: PlannedPluginInstall) => Promise<PendingInstallCandidate | undefined>`)
  instead of importing the alias, so the seam type and the seam have already
  drifted apart in form. `PendingReconcileOptions` (`pending.ts:64`) is likewise
  internal-only. `PENDING_STATUSES` is the test-only case reported above. Fix:
  annotate `pending.ts`'s `locateCandidate` with the exported alias (which makes
  that export legitimate), and drop `export` from the other two.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `reconcile.messaging.ts` | `PENDING_STATUSES` | `reconcile.messaging.test.ts:89` | owned — but test-only export |
| `reconcile.messaging.ts` | `PendingMsg` | `:22–31`, `:64–67` (`satisfies` + `@ts-expect-error`) | owned |
| `reconcile.messaging.ts` | `PENDING_CONTEXT` | `:71, 101, 117, 137, 156, 171, 186` | owned (5/5 render arms) |
| `reconcile.messaging.ts` | `ReconcileAppliedMsg` | `:33–62`, `:68–69` | owned |
| `reconcile.messaging.ts` | `RECONCILE_APPLIED_CONTEXT` | `:71, 207, 235, 262, 284, 307, 333` | owned (5/5 render arms) |
| `types.ts` | 10 `Planned*` interfaces + `PlannedSourceMismatch` | `types.test.ts:42–343` | owned (positive + negative) |
| `types.ts` | `ReconcilePlan` | `types.test.ts:105`, `:269` | owned |
| `types.ts` | `plannedSourceMismatchSubject` | `types.test.ts:346, 363` | owned (both arms; 2 of 4 causes, same arm) |
| `types.ts` | `emptyReconcilePlan` | `types.test.ts:380, 410, 430` | owned |
| `types.ts` | `ApplyReconcileOptions` | `types.test.ts:116–127, 279–294` | owned |
| `types.ts` | `ScopeReadResult` | `types.test.ts:133–153, 295–322` | owned |
| `pending.ts` | `pendingReconcile` | `pending.test.ts` (14 cases) | owned |
| `pending.ts` | `PendingReconcileOptions` | — | no external consumer |
| `reconcile/notify.ts` | `buildReconcileAppliedCascade` | `notify.test.ts:421–1342` | owned (all 16 outcome kinds) |
| `reconcile/notify.ts` | `buildReconcilePendingNotification` | `notify.test.ts:1345–1788` | owned |
| `reconcile/notify.ts` | `isReconcilePlanListEmpty` | `notify.test.ts:1791–1893` | owned (all 6 buckets + both remove arms) |
| `reconcile/notify.ts` | `resolvePendingForceInstalls` | `notify.test.ts:1903–1986` | owned — single-candidate only (BLOCKER above) |
| `reconcile/notify.ts` | `PendingInstallCandidate` | `notify.test.ts:12` | owned (type) |
| `reconcile/notify.ts` | `PendingInstallCandidateLocator` | — | NO CASE, and no consumer either |
| `backfill.ts` | `applyBackfillForScopeIsolated` | `backfill.test.ts:316–696` | owned |
| `backfill.ts` | `runScopeIsolated` | `backfill.test.ts:701–737` | owned (both arms) |
| `backfill.ts` | `scanForceInstalledBackfills` | `backfill.test.ts:739–1861` | owned — test-only export (first-pass finding) |

## Branch census

**(a) Reachable and untested**

- `reconcile.messaging.ts:105, 109` — the scope-bracket token on `will enable` /
  `will disable`. Not a control-flow branch (the helper is always called), but the
  token is never non-empty in any case. New BLOCKER above.
- `backfill.ts:332`, the `resolved.state === "unavailable"` disjunct. Reachable:
  a recorded plugin whose root lost its `.claude-plugin/plugin.json` resolves
  `unavailable`. Untested: every fixture in `writePluginTree`
  (`backfill.test.ts:139–191`) writes a valid `plugin.json`. Note the disjunct
  cannot be *deleted* to test the mutation — `ResolvedPluginUnavailable`
  (`domain/resolver.ts:448–452`) carries no `supported` field, so removing it
  makes `resolved.supported` at line 343 a compile error. The surviving mutation
  is behavioral instead: returning `true` (a failure that holds the version gate
  open forever) rather than `false` (benign skip) passes the whole suite.
- `pending.ts:196–200/238` — the scope half of the `recordedMarketplaces` key.
- `reconcile/notify.ts:136, 430, 972` — `Object.freeze` (no assertion observes it).
- `reconcile/notify.ts:293–294` — the two accumulation loops beyond one iteration.

**(b) Unreachable by real input**

- `backfill.ts:440`, `!PLUGIN_ENTRY_VALIDATOR.Check(entry)`. `loadMarketplaceManifest`
  validates the whole manifest against `MARKETPLACE_SCHEMA`, whose `plugins` field
  is `Type.Array(PLUGIN_ENTRY_SCHEMA)` (`domain/manifest.ts:28`, checked at
  `:70`), and throws when it fails. Every entry reaching line 440 has therefore
  already passed the identical schema. This is the sanctioned defence-in-depth
  re-check ARCHITECTURE.md describes, not a coverage gap — and it is why the
  first pass's instruction to write "a manifest entry present-but-schema-invalid"
  case cannot be carried out: such a manifest fails at load and takes the
  `unparseable` path already covered at `backfill.test.ts:1689`.
- `reconcile/notify.ts:929–930` — the two scope-qualified sentinels; no producer
  stamps them into an outcome (verified by grep across `extensions/`).
- `reconcile.messaging.ts:95` with an explicit `partial: false`. The only producer
  (`reconcile/notify.ts:395`) spreads `partial: true` conditionally and never
  writes `false`; the `undefined` arm is covered at `reconcile.messaging.test.ts:101`.
- `reconcile/notify.ts:513, 563, 613` — `outcome.orphanRewake === true` against an
  explicit `false`. `apply.ts` and `backfill.ts` both spread the field only when
  `true`.

**(c) Compiler-forced, not removable**

- `reconcile/notify.ts:149` — the `block.status === undefined` early return. Its
  own comment (`:143–148`) records that TypeScript does not credit a
  `case undefined:` toward exhaustiveness, so the early return is what makes the
  three-token switch below provably total. Covered anyway (list-arm blocks in
  `notify.test.ts:1384` etc.).
- The `unavailable` guard at `backfill.ts:332` in its *deletion* form (see (a)).

## Grading of first-pass findings

### `tests/orchestrators/reconcile/notify.test.ts`

- **REFUTED** — *"`reasonAsContent`'s defensive sentinel-mapping branch is never exercised" (BLOCKER)* —
  `notify.test.ts:484–512`, `test("renders the structural marketplace-absent
  marker as the not-found content reason")`, feeds
  `{ kind: "mp-remove-failed", scope: "user", marketplace: "absent-mp", reason:
  "marketplace not added" }` and asserts `reasons: ["not found"]`. It sits inside
  the same `buildReconcileAppliedCascade` describe block, 65 lines below the
  `appliedOutcomeRows()` table the finding cites, so the finding's own stated
  evidence ("or any other case in the `buildReconcileAppliedCascade` describe
  block") is what disproves it. What *is* true is narrower and is logged above as
  a WARNING: the two scope-qualified sentinels at `notify.ts:929–930` have no
  producer at all.
  Second correction: the production comment the finding relies on
  (`notify.ts:919–924`, "unreachable in normal operation … the planner-driven
  apply pass only drives an orchestrator when the marketplace IS recorded") is
  itself unreliable. `orchestrators/plugin/shared.ts:1245–1269`
  (`emitMarketplaceNotAdded`) returns `reason: "marketplace not added"` in
  **orchestrated** mode — the mode reconcile uses — and both
  `uninstall.ts:558` and `enable-disable.ts:590` route through it;
  `apply.ts:362` and `apply.ts:602` forward `result.reason` verbatim into
  `plugin-uninstall-failed` / `plugin-enable-failed` / `plugin-disable-failed`.
  The read pass releases the scope lock before the per-entry orchestrators take
  their own (`backfill.ts:38–41`, "with NO outer lock (CR-01)"), so a concurrent
  marketplace removal between read and apply reaches this branch. Reword the
  comment to state the routing fact rather than an unenforced invariant.

- **DUPLICATE-OF** — *"`subject` variable name" (WARNING)* — the finding says so
  itself; owned by the `types.test.ts` block in the same file. No separate action.

### `tests/orchestrators/reconcile/backfill.test.ts`

- **CONFIRMED (with one sub-claim refuted)** — *"Two offline-resolve branches in `backfill.ts` have no case driving them" (BLOCKER)* —
  Sub-claim 1 (`backfill.ts:332`, the `"unavailable"` arm) holds: every fixture
  writes a valid `.claude-plugin/plugin.json` (`backfill.test.ts:145–149`), so
  only the `resolved === undefined` arm is driven (`test("SF-02: skips a recorded
  plugin the cached manifest no longer declares")`, line 1649). The suggested case
  is executable — delete the plugin root's `plugin.json` after
  `writeMarketplaceSource` — and the discriminating assertions are the ones the
  finding names (`outcomes` stays `[]`, `anyFailure` is `false`).
  Sub-claim 2 (`backfill.ts:440`, `!PLUGIN_ENTRY_VALIDATOR.Check(entry)`) is
  **refuted**: see the branch census. `loadMarketplaceManifest` validates
  `plugins: Type.Array(PLUGIN_ENTRY_SCHEMA)` and throws first, so the proposed
  fixture lands on the already-covered `unparseable` path and never reaches the
  `Check`. Drop that half of the finding; the branch is defence-in-depth, and the
  decision (keep and document, or delete) is a production one.

- **CONFIRMED** — *"Byte-for-byte duplicated hermetic-scope helper" (WARNING)* —
  `backfill.test.ts:96–127` vs `pending.test.ts:42–70`; the two bodies differ only
  in tmp-dir prefix and return shape, and the WR-08 precedent it cites
  (`tests/edge/notification-boundary.ts:3–9`) is exactly on point. Note it is not
  the only duplicate in this file — `createSilentBoundary` (lines 79–94) is a
  second one, logged as a new WARNING above, and both should be fixed in one pass.

### `tests/orchestrators/reconcile/pending.test.ts`

- **CONFIRMED** — *"Duplicated hermetic-scope helper" (WARNING)* — the other half
  of the pair; fix once.

### `tests/orchestrators/reconcile/types.test.ts`

- **CONFIRMED** — *"`subject` as a variable name" (WARNING)* — `types.test.ts:357, 372`.
  The rename to `mismatchSubject` is mechanical and matches the naming rule.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`

- **CONFIRMED** — *"Single-letter loop/parameter naming" (WARNING)* — `notify.ts:225`
  and the six loop bindings at `:370, 374, 381, 399, 407, 415`; the sibling
  `applySourceMismatch` (`:189`) names the same class of value `mismatch`, so the
  fix is propagation, not invention.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts`

- **CONFIRMED** — *"Inline `import()` type instead of a top-level `import type`" (WARNING)* —
  `backfill.ts:437`; line 16 already imports `resolveStrict` from
  `../../domain/resolver.ts`, so there is no ordering reason for the inline form.

- **CONFIRMED (with a correction to the proposed fix)** — *"`scanForceInstalledBackfills` is exported with no production consumer outside its own module" (WARNING)* —
  The finding's diagnosis is right (only caller is `applyBackfillForScope` at
  `:93`). Its second remedy is not executable as written: "seeding a scope whose
  stamp is already current-but-forced" is impossible, because an equal stamp is
  precisely what closes the gate (`backfill.ts:76–81`) and returns before the
  scan. The export exists to separate the *scan* from the *stamp write*, which is
  a real seam — every `scanForceInstalledBackfills` case asserts state.json still
  carries `STALE_STAMP` afterwards (e.g. `backfill.test.ts:791, 873, 1454`). So
  the two live options are: document the seam in the file header beside the
  FLOW-09 rationale, or extract the stamp write into its own exported step so
  `applyBackfillForScopeIsolated` composes two named exports and the tests drive
  each through its own entry point.

## Still clean after attack

- `tests/orchestrators/reconcile/notify.test.ts` — outside the two findings above,
  this file survives every mutation I tried. Caught: changing any single field of
  any projected row (all 22 cases compare the **whole** `ReconcileAppliedCascadeMessage`
  against a hand-written literal, never field by field); dropping the `scope`
  component from `ensureMarketplaceBlock`'s key (`notify.ts:102` — the two
  same-name-different-scope cases at `:1323` and `:1660` would fold into one
  block); reordering the two sort keys (`:1303, 1323, 1625, 1660`); swapping
  `forceInstallKey`'s marketplace and plugin arguments or changing its `\u0000`
  delimiter (both `:1709` and `:1920` pin the exact key bytes); flipping any one
  of the six buckets in `isReconcilePlanListEmpty` (one sibling case per bucket,
  `:1829–1875`, plus the two `marketplacesToRemove` arms and the
  `marketplacesToAdd` exclusion); swapping the `installed` / `partially-installed`
  arm selection on `plugin-enabled` or `plugin-backfilled`; moving the severity
  raise between the malformed and the dropped-kind axis (`:801` vs `:907` vs
  `:1027` vs `:1147` split those deliberately); and reordering the reason tokens
  (`:1017` pins `["orphan rewake", "malformed skill", "malformed command", "lsp"]`).
  The `AppliedOutcomeRows` mapped type (`:52–57`) is a real gate: a new
  `PerEntryOutcome` kind fails to compile until a row is added.
- `tests/orchestrators/reconcile/pending.test.ts` — caught: dropping the CFG-03
  abort (`:294`), mixing up base and local invalid arms (two rows), returning the
  raw path instead of the basename (T-53-02-02, pinned in the expected string),
  swapping the two `narrowStateLoadFailReason` arms (`:329–340`), planning against
  the raw merged view in the MIG-01 pre-migration window (`:390, 411, 435`),
  emitting a second notification anywhere (`createNotificationBoundary(1, 2)`
  fails at the emission site, not afterwards), writing anything at all on the
  read-only surface (`retryTree` compares the whole scope tree, and the config and
  state bytes are compared verbatim), and sorting invalid blocks after the plan
  blocks instead of by name (`:364`).
- `tests/orchestrators/reconcile/backfill.test.ts` — caught: any of the three
  benign-skip filters (`installable` / `isRecordedButDisabled` / already-touched)
  being dropped or inverted; the `supportedSetGrew` superset check weakened to a
  length comparison (`:1137`, the "longer but not a superset" case); the per-plugin
  try/catch removed (`:1740` proves a healthy sibling under another marketplace
  still promotes); `anyFailure` not propagating (every case asserts it explicitly
  *and* asserts the stamp did not move); the stamp written on a failure path
  (`:590`); a state.json created for a state-file-absent scope with nothing to
  promote (`:500`); and `runScopeIsolated` failing to redact absolute paths
  (`:717`). The `createOfflineGitOps` fake with an empty `allowedRemoteUrls`
  is a genuine NFR-5 proof — it refuses rather than fails open, which is the
  pattern META-FINDINGS names as worth propagating.
- `tests/orchestrators/reconcile/types.test.ts` — caught: `plannedSourceMismatchSubject`
  returning `marketplace` for the malformed-plugin-key cause; `emptyReconcilePlan`
  returning a shared bucket array between two calls (the 14-element `Set` identity
  check at `:460–478` is a real aliasing proof, not decoration); and any bucket
  losing its `readonly` (the `IsMutableArray` mapped-type negatives at `:324–343`).
  The module-scope `mock<ExtensionContext>` / `mock<ExtensionApi>` / `mock<GitOps>`
  values (`:32–40`) are never invoked, stubbed, or verified — they exist only as
  compile-time-checked placeholder values, which is a defensible way to satisfy
  `ApplyReconcileOptions` without a cast, and I agree with the first pass that
  this is not a finding. It *is* evidence for META-FINDINGS §1 (see below).

## Not covered

- I did not run `npm run check`, `npm test`, or `npm run test:coverage:direct` —
  the sweep rules forbid it. Every branch and mutation verdict above is from
  reading the source and cross-checking with read-only `grep` and throwaway
  `node -e`. The reachability arguments I could settle by grep (producers of a
  sentinel, callers of a helper, schema validation order) I settled that way and
  said so; the one I could not fully settle by reading is the concurrency window
  behind the `reasonAsContent` comment — I established the routing but not an
  observed occurrence.
- `apply.ts`, `apply-outcomes.ts`, and `plan.ts` (and their tests) belong to
  `orchestrators-reconcile-apply.md`. I read `apply.ts`'s four outcome-building
  loops and `apply-outcomes.ts`'s `reason: Reason` declarations only far enough to
  settle the `reasonAsContent` reachability question.
- `tests/edge/notification-boundary.ts`, `tests/platform/git-ops-fake.ts`, and
  `tests/orchestrators/plugin/scope-tree-inventory.ts` are other reviewers' files;
  I read the first in full to prove the `createSilentBoundary` duplication and
  only checked that this area uses the other two correctly.

## Meta-findings impact

### New cross-cutting evidence

**1. Hidden clock: 15 inline `new Date()` reads in production, and the test suites
are already paying for it.** `grep -rn "new Date()" extensions` returns 15 sites,
all in orchestrators and shared state writers:
`plugin/install.ts:1180,1389,1437`, `plugin/update.ts:1713,1983`,
`plugin/enable-disable.ts:365,400`, `plugin/reinstall.ts:1409`,
`marketplace/add.ts:700,863`, `marketplace/update.ts:472`,
`shared/completion-cache.ts:343,358`,
`bridges/hooks/async-rewake/registry.ts:319`. Three suites already fake `Date`
to work around it — `tests/orchestrators/reconcile/backfill.test.ts` (7 sites),
`tests/orchestrators/marketplace/update.test.ts`,
`tests/orchestrators/plugin/bootstrap.test.ts` — which the guidelines call a
finding ("faking `Date` when a clock would do"). META-FINDINGS lists no
hidden-clock item at all; this belongs next to the module-global-state item under
"Ranked by leverage", because it is the same shape (a hidden dependency forcing a
test-side workaround) and one injected `Clock`/`nowIso` parameter per writer
dissolves it. **Areas to check:** every suite that asserts an `updatedAt`,
`installedAt`, `lastUpdatedAt`, `lastRefreshedAt`, or `spawnedAt` field — plugin
install/update/enable-disable/reinstall, marketplace add/update, shared
completion-cache, hooks async-rewake.

**2. "Test-only or module-only export" is a wider class than the four reset hooks
already catalogued.** META-FINDINGS §2 names four reset functions. This area alone
adds four more of the same family without the reset shape: `PENDING_STATUSES`
(`reconcile.messaging.ts:68`, read only by its paired test),
`scanForceInstalledBackfills` (`backfill.ts:207`, the first pass's own finding),
`PendingInstallCandidateLocator` (`reconcile/notify.ts:259`, no consumer at all),
and `PendingReconcileOptions` (`pending.ts:64`, internal only). Fallow's
dead-code pass cannot see these — each *is* referenced, just never from outside
its module — so the only way to find them is per-module export census. **Worth a
repo-wide census** as its own line item; recommend spot-checking the other
`*.messaging.ts` modules and the `orchestrators/*/shared.ts` files first.

**3. D-11 "call, never duplicate" has at least one live escapee, and the pattern
generalises.** `shared/notify.ts` exports six row composers whose stated purpose
is that command render maps call them instead of re-inlining
(`shared/notify.ts:2345–2351`). `orchestrators/reconcile/reconcile.messaging.ts:182–190`
re-inlines `renderUninstalledRow` while both siblings that emit the same row call
it. Nothing gates this: fallow's `dupes` threshold does not fire on an 8-line
token list, and each surface's own byte test passes because both copies currently
agree. **Areas to check:** every `*.messaging.ts` render map against the exported
composer for the same status — `install`, `update`, `reinstall`, `list`, `fetch`,
`import/execute`, `marketplace/{remove,update}` — asking for each arm whether an
exported composer exists and is called.

**4. Retired-code narration survived the comment sweep in at least five files.**
`.claude/rules/typescript-comments.md` bans narrating a shape that no longer
exists. Live instances: `orchestrators/reconcile/types.ts` (×3, lines 105–107,
133–137, 240–243), `orchestrators/reconcile/backfill.ts:8–12`,
`domain/resolver.ts:1527`, `shared/notify.ts:2220`,
`bridges/hooks/dispatch.ts` ("that used to be answered with a mutable module cell
behind `_setExecutorFor…`"). A line-oriented grep undercounts these because the
phrasing wraps across comment lines — I found the `types.ts` instances only after
flattening comment continuations. Low severity, but if a cleanup is planned it
needs the flattened-text search, not `grep`.

### Corrections to META-FINDINGS.md

- **"The dominant shape: sibling drift" bullet — "`backfill.test.ts` /
  `pending.test.ts` — a byte-for-byte duplicated helper, mirroring a duplication
  the codebase already fixed once elsewhere."** Correct, but **understated by
  exactly one helper**: `backfill.test.ts:79–94` also hand-rolls
  `createSilentBoundary`, which `createNotificationBoundary(0, 0)`
  (`tests/edge/notification-boundary.ts:90`, whose header at lines 18–23
  documents the zero case explicitly) already provides, and `backfill.test.ts` is
  the only file in the repo doing so. Amend the bullet to name two duplicated
  helpers, not one.
- **The area's BLOCKER count is overstated by one.** `_AUDIT.md`'s tally counts
  two BLOCKERs for `orchestrators-reconcile-notify.md`; one is refuted outright
  (the `reasonAsContent` branch is covered at `notify.test.ts:484`) and the other
  is half-refuted (its second branch is unreachable through the public surface).
  Net after this pass: 2 BLOCKERs for the area, but they are different ones.
- **"Decisions the fixing pass cannot make" §1 (unreachable branches) should gain
  a member.** `backfill.ts:440`'s `!PLUGIN_ENTRY_VALIDATOR.Check(entry)` is a
  defence-in-depth re-check that `domain/manifest.ts:28,70` makes unreachable, and
  `reconcile/notify.ts:929–930`'s two scope-qualified sentinels have no producer.
  Neither needs prototype surgery to reach — they need a decision on whether
  defence-in-depth re-validation is exempt from the 100%-branch rule. That
  decision governs more than these two sites, because ARCHITECTURE.md endorses the
  pattern ("re-validated defensively at consumption sites even after an earlier
  validation pass") while the testing guidelines forbid uncovered branches.

### Confirmations

- **§1 "Narrow the over-wide context parameters" — confirmed from a third angle.**
  `types.test.ts:32–40` must fabricate `mock<ExtensionContext>()`,
  `mock<ExtensionApi>()`, and `mock<GitOps>()` at module scope with no
  expectations and no `verify()`, purely to have *values* that satisfy
  `ApplyReconcileOptions`'s `ctx` / `pi` / `gitOps` fields in a `satisfies` check.
  `backfill.test.ts:84–85` does the same. Neither module reads more than
  `ctx.ui.notify` / `pi.getAllTools()` through the call chain. This is the same
  root cause as the 178 `as never` casts, expressed as strong-mocks-as-type-evidence
  rather than casts — worth noting in the ticket, because narrowing the parameters
  deletes these placeholders too.
- **The "loose `assert.equal` / `assert.deepEqual`" finding class is spurious —
  independently re-confirmed.** Every test file in the repo imports
  `assert from "node:assert/strict"` (`grep -rln 'from "node:assert"' tests`
  returns nothing), under which `assert.deepEqual === assert.deepStrictEqual` and
  `assert.equal === assert.strictEqual` (verified:
  `node -e 'const a=require("node:assert/strict"); console.log(a.deepEqual===a.deepStrictEqual)'`
  → `true`). `adversarial/orchestrators-plugin-list-uninstall-b.md` and
  `adversarial/orchestrators-plugin-reinstall-a.md` reached this first; I confirm
  it and add two still-standing instances the consolidation should strike:
  `architecture-notify-gates.md:9` ("`notify-stamp-coverage.test.ts` uses loose
  `assert.deepEqual`" — that file imports `node:assert/strict` at line 11) and
  `architecture-boundary-gates.md:11` ("nearly every file in this set uses
  non-strict `assert.equal`/`assert.deepEqual`").
- **"Gates that do not gate" §, and `adversarial/architecture-notify-gates.md`'s
  camelCase-force-vocabulary BLOCKER — confirmed against this area's source.**
  That finding names six sites; five are in my area and I verified each:
  `resolvePendingForceInstalls` (`reconcile/notify.ts:288`), `forceInstallKey`
  (`:269`), the `forceInstallKeys` parameter (`:359`, `pending.ts:252`),
  `scanForceInstalledBackfills` and `hasForceInstalledPlugin` (`backfill.ts:207,
  167`), and `renderForceInstalled` (`reconcile.messaging.ts:201`) — which is
  typed `RenderFn<PluginPartiallyInstalledMessage>` and registered under the
  `"partially-installed"` key, so the identifier and the token it renders
  disagree in one 3-line span. The guard's regexes all require a separator
  (`/force[- ]install/i`, `partial-vocabulary-guard.test.ts:224–230`), so none of
  these can match. Ownership stays with `architecture-notify-gates.md`; I am not
  double-counting it, only confirming the sites are real and live.
- **`tests/edge/notification-boundary.ts` as a reference implementation —
  confirmed.** `pending.test.ts` uses it exactly as intended (exact
  `emissions`/`toolProbes` counts per case, so a second emission throws where it
  is made). It belongs in the "Patterns to propagate" table alongside the
  strict-interaction-mocking row.
