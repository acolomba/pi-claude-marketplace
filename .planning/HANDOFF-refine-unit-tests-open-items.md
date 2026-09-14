# Handoff — refine-unit-tests open items

**Written:** 2026-09-12 · **Branch:** `features/refine-unit-tests` · **HEAD:** `cd0911d7`

Milestone phase work is complete (9/9, phase 9 verified `passed` 10/10). `origin/main` is
merged and adapted; the branch is 0 behind and merges clean. **No PR is open** — that was
deliberate.

Resume state: `npm run check` exit 0 (6109 unit, 32 integration) ·
`npm run test:coverage:direct:all` exit 0 over 233 pairs ·
`node scripts/revalidation.mjs scope-impact --check` → `Scope impact valid: 40 records.`

Two things were left for an operator decision. This file is the record of both.

---

## 1. The 19 open window entries

`/gsd-ship` blocks while any window reads `open`. The milestone closed them **deliberately
un-closed** (`D-09-13`): closing an entry on narrative rather than terminal evidence is the
defect class this milestone spent nine phases retiring, and `D-22` bars creating work for a
backlog item with no terminal evidence inside the unit-test-quality boundary.

Phase 9 closed exactly three (19, 21, 22 — the unreachable arms `08-02` deleted) and repaired
the ledger's table/JSON desync so the write verbs work again. Everything below predates this
milestone.

**Distribution:** `{86: 1, 88: 2, 115: 6, 116: 5, 117: 5}` = 19. Phase **115** is the largest
group at 6.

**Useful commands.** `windows status` reads fine; the write verbs are `append`, `waive`,
`fixed` (there is no `list`). The ledger's fenced JSON is the sole source of truth — never
hand-edit the rendered table, and remember the frontmatter counts must agree with the entries
or `parseLedger` refuses.

### Phase 86 — 1 entry

| id | kind | file | substance |
|---|---|---|---|
| 1 | unrun-verify | `bridges/skills/stage.ts` | SKILL-01 backstop: after `/reload`, a degraded skill's `/skill:<name>` resolves and the model never auto-invokes it (disable-model-invocation). Needs a live Pi session; not exercisable in unit tests. |

### Phase 88 — 2 entries

| id | kind | file | substance |
|---|---|---|---|
| 2 | stub | `bridges/hooks/settle.ts` | `stop_hook_active` hardcoded `false` in the synthetic Stop event; loop-protection flag + 8-block cap were to land with STOP-07. |
| 3 | stub | `bridges/hooks/payloads/stop-failure.ts` | Thin StopFailure translator; the `errorMessage` classifier was to land with SFAIL-03. |

### Phase 115 — 6 entries

| id | kind | file | substance |
|---|---|---|---|
| 7 | deviation | `tests/orchestrators/reconcile/backfill.test.ts` | The two `runScopeIsolated` cases own no temporary tree; that entrypoint touches no filesystem, HOME or agent dir, so the per-case tree requirement is satisfied vacuously. |
| 8 | deviation | `tests/orchestrators/reconcile/pending.test.ts` | Two force-preview guards in `pending.ts` are behaviorally redundant with the per-install catch in `resolvePendingForceInstalls` — removing either leaves the owner suite green. Reachable, so not dead code, but no public behavior discriminates them. |
| 9 | deviation | `orchestrators/reconcile/apply.ts` | **The big one.** Three per-entry catch clauses removed under the unreachable-code rule; RECON-03 per-entry isolation now rests on an internal contract with no compile-time enforcement. WR-02 widened the recorded blast radius: an escape aborts the rest of the bucket, skips backfill and the routing rebuild for that scope, skips the sibling scope entirely, and discards every accumulated outcome. No test can prove the loops safe — the three orchestrators are static imports with no injection seam. **Operator accepted the exposure 2026-09-02**; the entry stays `open` on purpose as the durable record of residual risk, not as a pending action. Resolution recorded in `115-VERIFICATION.md` human_verification item 2. |
| 10 | deviation | `orchestrators/reconcile/apply.ts` | `applyPlan`'s documented remove-before-add ordering is not discriminated by any input — swapping the two leaves the suite green, because the planner makes the buckets disjoint by name. The add-before-install and project-before-user orderings ARE discriminated and pinned. |
| 13 | deviation | `orchestrators/marketplace/add.ts` | WR-01: the `D-115-10` mode-discriminated overloads on `addMarketplace`, `removeMarketplace`, `uninstallPlugin`, `setPluginEnabled` are unchecked assertions, not compile-time proofs. TypeScript accepts a narrower overload return against a wider implementation with no diagnostic. Confirmed by making `addMarketplace`'s orchestrated success arm return `undefined` — typechecks clean at exit 0. Three runtime guards in `reconcile/apply.ts` were deleted on the strength of that narrowing. |
| 14 | deviation | `orchestrators/import/execute.ts` | WR-04: `buildImportNotificationMarketplaces` iterates the header map and looks rows up in a sibling map, so a row whose `(scope, marketplace)` key carries no header vanishes behind the `?? []` fallback. Making `MarketplaceBlock.status` required prevents a statusless header, not a headerless row. What rules it out is an invariant spanning four functions. |

### Phase 116 — 5 entries

Entries 15–18 are all the same shape: **one branch short of complete direct coverage**, pinned
by identity under the amended `D-116-01a` (commit `ed0e490f`), each closing "only by a
production rewrite". Note these are distinct from the two rows in
`scripts/test-coverage-direct.pin.json` — see the "compiler-forced unreachable branches"
discussion if revisiting.

| id | kind | file | why the arm is unreachable |
|---|---|---|---|
| 15 | unmet-truth | `edge/handlers/marketplace/update.ts` | Usage-string collapse arm. **Not** compiler-forced: `parseCommandArgs` passes the usage string only for a required positional and this schema's sole positional is optional. Dead here, live for sibling handlers that declare a required one. |
| 16 | unmet-truth | `edge/completions/data.ts` | RHS of the nullish fallback on the last-token read. **Compiler-forced**: `Array.prototype.at()` is typed `T \| undefined`. Proved by construction, by brute force over all 65,536 BMP code points in five shapes, and by a plant that stayed green. |
| 17 | unmet-truth | `edge/completions/provider.ts` | Empty-object arm of the `optionalDescription` conditional. Not compiler-forced; **structural**: both producers of the entry list supply a description, but the declared element type keeps the field optional. |
| 18 | unmet-truth | `edge/handlers/plugin/import.ts` | String-conversion arm of the catch-block error formatter. **Compiler-forced**: the only throw reaching it constructs an `Error`, but a catch binding is `unknown` under `useUnknownInCatchVariables`, and narrowing needs a type assertion, which is barred throughout `extensions/`. |
| 20 | deviation | `edge/register.ts` | **A real doc-vs-code contradiction, cheap to fix.** Comments at `:18-20` and `:104-106` both claim the cwd is read once at command registration. It is not — `process.cwd()` is evaluated *inside* the `getArgumentCompletions` arrow (`:107-108`), so it is read on every completion invocation and nothing is closed over. Measured by the 116-28 owner. |

### Phase 117 — 5 entries

These are **stale-reference bookkeeping**, mostly cheap. Several could not be fixed when found
because the plan held no production licence.

| id | kind | file | substance |
|---|---|---|---|
| 23 | deviation | `orchestrators/plugin/install.messaging.ts` | Doc comment on `isHooksResolverNote` cites `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`; 117-04 moved that suite to `tests/architecture/`. |
| 24 | stub | `docs/output-catalog.md` | Names the deleted `tests/shared/device-flow-prompt.test.ts` as the AUTH-03 byte-form lock; the lock now lives in `tests/domain/github-auth.test.ts`. |
| 25 | deviation | `.planning/codebase/TESTING.md` | Describes `tests/helpers/` as live and names four modules by pre-move paths; the directory and both glob alternatives are gone as of 117-07. |
| 26 | deviation | `bridges/hooks/event-router.ts` | Comment justifying the SessionStart gate on `ensureSharedDataDir` names `tests/edge/index-handler.test.ts` as the WR-05 pin; 117-08 deleted that suite. **The invariant itself survives** — `tests/index.test.ts` asserts neither scope root is created by a clean reconcile. |
| 29 | deviation | `.planning/codebase/CONVENTIONS.md` | Line 151 claims barrels exist per bridge kind "plus the aggregate `bridges/index.ts`". There is no `bridges/index.ts`; the five per-kind barrels do exist. |

### Suggested triage if you want the ship gate cleared

Three tiers, cheapest first:

1. **Stale references (23, 24, 25, 26, 29) and the cwd comment (20)** — six entries that are
   documentation-vs-reality corrections. Entry 20 is the only one touching a real behavioral
   claim, and the fix is to correct the comment (the behavior is fine, arguably better).
2. **Vacuous/redundant records (7, 8, 10)** — three entries that record "no input discriminates
   this". They are true and closing them means deciding they need no further action.
3. **The substantive four (1, 2, 3, 9, 13, 14, 15–18)** — genuinely open risk or deliberately
   retained records. Entry 9 in particular is an accepted exposure the operator already signed
   off; it should probably be `waive`d with that reason rather than `fixed`.

---

## 2. `IN-02` — the `HooksHydrationReader` naming question

> **CLOSED 2026-09-12 by `63de8980`.** Renamed to `HooksHydrationDeps`; `HooksFileReader` and
> the `extends` relation are unchanged. `npm run check` exit 0, 6109 unit / 32 integration —
> the baseline held exactly, as a type-only rename requires.
>
> **The blast radius below is wrong and is kept as written for the record.** "Roughly 171 call
> sites across 31 test files" counts `readHooksJson` MEMBER usages; a type rename does not reach
> them. Measured: **23 type-level references across 5 files.** Of the five constraints listed
> below, only #4 (`index.test.ts`'s `satisfies`) actually constrained the change — #1 and #3 do
> not fire on a type rename, #2 was verified to still match, and #5 only fires on a module move.
> The lesson is the one this milestone kept relearning: a recorded obstacle is a claim, and
> claims get measured before they get believed.
>
> `IN-01`, `IN-03` and `IN-04` below remain open by choice. `IN-03` is the one with real risk.

**Source:** `.planning/phases/09-final-quality-and-backlog-closure/09-REVIEW.md:274`
**File:** `extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:442-456`
**Severity:** Info. Not a defect — a readability trade against a recorded decision.

### What the reviewer said

The *segregation* is right and the *naming* is not.

Keeping `createHooksRouting` off `loadState` is correct, and the stated reason holds: routing
provably never loads state, and merging would have forced a stub at every one of the ~139 call
sites for a member none of them exercise. That matches the `RemovalOps` precedent at
`shared/fs-utils.ts:58-66`.

What reads poorly is that **`HooksHydrationReader` is not a kind of file reader**. It is a
two-member dependency bundle — one filesystem read plus one persistence-layer load. The
`extends` relation asserts an is-a that is only true structurally, and the two names differ by
an unhelpful middle word (`File` vs `Hydration`) rather than by what they carry. A reader has
to open both declarations to learn which is the wide one.

### The proposed shape

Keep `HooksFileReader`; rename the wide one to state the payload rather than the consumer:

```ts
export interface HooksHydrationDeps extends HooksFileReader {
  readonly loadState: (extensionRoot: string) => Promise<ExtensionState>;
}
```

### Why it was not done in phase 9

A fix pass should not make a scope decision. The rename touches the published bridge surface
(`bridges/hooks/index.ts` exports both interfaces) and roughly 171 call sites across 31 test
files. That is an operator call, not something to fold into a review-fix commit.

### What a rename would have to satisfy

These are measured, not guessed — they are the same gates the phase-9 port had to clear:

1. **`tests/index.test.ts:787-793`** asserts the exact construction source strings via
   `deepStrictEqual`:
   `"createHooksRouting(hooksRuntime, { readHooksJson })"` and
   `"createHooksHydration(hooksRuntime, { loadState, readHooksJson })"`. A rename of the
   *type* does not move these, but any change to the construction shape does.
2. **`tests/architecture/hooks-lifecycle.test.ts:281`** matches
   `hydrateProjectScopeForCwdWith`'s parameter list with a regex containing `[^{]*`. **The
   parameter must keep a named interface type** — an inline object literal breaks it.
3. **`tests/architecture/unowned-exports-census.test.ts:170`** compares the census for exact
   equality — it fails on an addition, a removal *and* a swap. A renamed or newly-unowned
   export shifts it.
4. **`tests/bridges/hooks/index.test.ts:22-24`** carries
   `void ({ loadState: … } satisfies HooksHydrationReader)` — a `satisfies` assertion that
   names the type directly.
5. **`scripts/check-corresponding-tests.mjs:30-36`** pairs by pure path transform, so moving
   the interface into a new module would demand a paired test file for it.

### Related Info findings, not actioned

Recorded in the same review, same rationale (Info, not defects):

- **`IN-01`** — `HooksFileReader` is declared under the "Factory-time hydrate" banner, not near
  its first consumer.
- **`IN-03`** — NFR-10 containment now depends on an injected collaborator honoring a
  prose-only contract. *Worth a look if you revisit the port*: the containment guard still runs
  before the read (verified, `:613` before `:641`), but nothing type-enforces that a supplied
  `readHooksJson` respects it.
- **`IN-04`** — trailing generation guards at the end of two async voids are no-ops.

---

## Resuming

```
/gsd-progress
```

or, to act on the items above directly:

- windows: read `.planning/WINDOWS.md`, edit the **fenced JSON** only, then use
  `node .claude/gsd-core/bin/gsd-tools.cjs windows fixed|waive <id>`
- `IN-02`: read `09-REVIEW.md:274` and the five constraints listed above before touching
  `event-router.ts:442-456`

Not yet done, in order: open the PR · milestone audit · complete · cleanup.

Known snag for the lifecycle: `gsd-tools query phase.complete` refuses in this checkout
(it sees `.planning/workstreams/` and demands `--ws`, but this milestone's ROADMAP/STATE are
the **root** files and no workstream is named `refine-unit-tests`). Hand-edit and verify, as
`STATE.md` already prescribes for the state verbs here.
