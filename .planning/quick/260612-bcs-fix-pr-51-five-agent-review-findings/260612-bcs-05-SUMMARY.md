---
quick_task: 260612-bcs-fix-pr-51-five-agent-review-findings
sub_plan: 05
type: execute
wave: 5
status: complete
commit: 59ceb0e
branch: features/v1.12-config-files
findings_closed: [Y3, S6 (4th loop), S7, S8, S9, S10]
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/persistence/config-io.ts
  - extensions/pi-claude-marketplace/persistence/config-write-back.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
byte_contract: byte-neutral
catalog_uat: green-no-edits
---

# Quick Task 260612-bcs sub-plan 05: setPluginEnabled overloads + type narrowing

One atomic commit (59ceb0e) on `features/v1.12-config-files` that lands the
type cuts depending on Plan 02's enable-disable structural changes. Strictly
byte-neutral: catalog-uat byte gate stays green with NO edits to
docs/output-catalog.md.

## Findings closed

### Y3 (CLOSED) -- setPluginEnabled mode-blind `| undefined` return

`extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`

Added an overload pair around the implementation signature, mirroring the
`AddMarketplaceNotifications` discriminant pattern:

```ts
export function setPluginEnabled(
  opts: EnableDisablePluginOptions & { notifications: { mode: "orchestrated" } },
): Promise<EnableDisablePluginOutcome>;
export function setPluginEnabled(
  opts: EnableDisablePluginOptions,
): Promise<EnableDisablePluginOutcome | undefined>;
export async function setPluginEnabled(
  opts: EnableDisablePluginOptions,
): Promise<EnableDisablePluginOutcome | undefined> { ... }
```

Orchestrated callers (applyReconcile via applyPluginToggles) now see a return
type with no `| undefined` arm; standalone callers (edge handlers) keep the
existing shape because the standalone branch fires its own `notify()` and the
caller has nothing to consume.

### S6 fourth loop (CLOSED in the same edit)

`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`

The dead `if (result === undefined) continue;` guard in `applyPluginToggles`
is removed -- the Y3 overload narrows away the `| undefined` arm so the
silent-vanish branch is a compile error. The fix-by-type-system path was the
plan's chosen alternative to the import/execute.ts:613 fail-loud wording the
other three loops adopted in sub-plan 03. The S6 source-shape test counts
`>= 3` occurrences of the fail-loud wording in apply.ts; current count is
five (three loop bodies + two comment cross-references), so the test stays
green.

### S7 (CLOSED) -- isDeclaredEnabled helper

`extensions/pi-claude-marketplace/persistence/config-io.ts` exports a
one-line predicate:

```ts
export function isDeclaredEnabled(entry: PluginConfigEntry): boolean {
  return entry.enabled !== false;
}
```

`extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` consumes
it at the previously open-coded site (the only `enabled === false` repeat in
the `extensions/` tree). A grep for `\.enabled\s*(!==|===)\s*false` across
`extensions/` now returns ONLY the helper's own definition + comment -- zero
external call sites.

### S8 (CLOSED) -- MarketplaceBlock.status narrowed

`extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts`

Introduced a module-internal alias:

```ts
type ReconcileBlockStatus = Extract<
  MarketplaceStatus,
  "will add" | "will remove" | "added" | "removed" | "failed"
>;
```

and changed `MarketplaceBlock.status` from `MarketplaceStatus` to the alias
(`status?: ReconcileBlockStatus`). The 5 statuses are exactly what the
preview + applied projections actually assign; the `"updated"` /
`"autoupdate enabled"` / `"autoupdate disabled"` / `"skipped"` members of
`MarketplaceStatus` belong to other surfaces. The defensive runtime throw at
`blockToMarketplaceMessage`

```ts
throw new Error(`unexpected reconcile marketplace status: ${block.status}`);
```

is deleted -- the narrowed type makes the unreachable arms a compile error
caught at edit time.

### S9 (CLOSED) -- cascadeSeverity closed-set param

`extensions/pi-claude-marketplace/shared/notify.ts`

Tightened the structural-subset param `cascadeSeverity` consumes:

```ts
function cascadeSeverity(message: {
  readonly marketplaces: readonly {
    readonly status?: MarketplaceStatus | undefined;
    ...
    readonly plugins: readonly {
      readonly status: PluginStatus;
      ...
    }[];
  }[];
}): ComputedSeverity
```

(was `string` for both `status` fields). Both call sites
(`computeSeverity` cascade arm + `reconcileAppliedSeverity`) pass
`NotificationMessage` cascade variants / `ReconcileAppliedCascadeMessage`,
which already carry the closed unions -- the tightening only catches a
future call site that would supply a `string` and silently break the
first-match ladder.

### S10 (CLOSED) -- config-write-back.ts:67 cast comment

`extensions/pi-claude-marketplace/persistence/config-write-back.ts`

The `as MarketplaceConfigEntry` cast in `writeMarketplaceConfigEntry` now
carries a block comment documenting that the runtime safety net for the
"missing required `source` field" case is `saveConfig`'s
`CONFIG_VALIDATOR.Check(config)` gate in `persistence/config-io.ts`. No
code change -- comment-only.

## Tests added

`tests/orchestrators/plugin/enable-disable.test.ts`

- **Y3 (orchestrated overload narrows return)**: assigns the orchestrated
  result to a non-undefined-typed binding. Pre-Y3 this was a TS2322 error;
  post-Y3 it compiles cleanly. Asserts the disable outcome's status as a
  runtime check too.
- **Y3 (standalone overload still returns | undefined)**: `@ts-expect-error`
  on the assignment to a non-undefined-typed binding so a regression that
  widens the standalone arm to non-undefined is caught at typecheck.

`tests/orchestrators/reconcile/apply.test.ts`

- **S7 (isDeclaredEnabled truth table)**: unit pin for the three relevant
  entry shapes (`{enabled: true}`, `{enabled: false}`, `{}`).
- **Y3 (end-to-end through applyReconcile)**: stages a recorded-but-disabled
  plugin (empty resources + installable: true) declared enabled in config,
  with a missing marketplace clone on disk so the enable branch's ledger
  read throws ENOENT. The cascade renders a `(failed)` plugin row instead
  of vanishing under the pre-Y3 silent-continue.
- **S8 (source-shape pin)**: asserts `ReconcileBlockStatus` lists exactly
  the 5 assigned statuses; the `MarketplaceBlock.status` field uses the
  narrowed alias; the defensive runtime throw text is gone.
- **S9 (source-shape pin)**: asserts the `cascadeSeverity` declaration
  carries `status?: MarketplaceStatus` + `status: PluginStatus` and does
  NOT contain a `status: string` form.
- **S10 (source-shape pin)**: asserts the cast comment chain references
  `saveConfig` near the `as MarketplaceConfigEntry` cast site.

## Verification (recorded outputs)

- `npm run check` -- GREEN (1844 tests + 10 integration tests pass;
  typecheck + lint + format all clean).
- `pre-commit run --files <changed>` -- GREEN (all hooks pass; main
  worktree, no SKIP=trufflehog needed).
- `grep -RnE '\.enabled\s*!==\s*false' src/` equivalent
  (`extensions/pi-claude-marketplace/`) -- only `isDeclaredEnabled`'s own
  definition + comment remain; zero external call sites.
- catalog-uat byte gate -- GREEN with NO docs/output-catalog.md edits in
  this commit (`git diff HEAD~1 -- docs/` empty).
- Commit hash: 59ceb0e on `features/v1.12-config-files`.

## Out-of-scope (deferred)

- T1-T6 (Plan 06): the broader test gaps including a successful enable
  end-to-end through applyReconcile (the Y3 test here pins the failure-path
  row materialisation; the success-path enable test belongs to Plan 06).
- Comments/docs sweep (Plan 07): D1-D11 rewrites.
- The cast site in `writeBatchedConfigEntries` (line ~186 -- a sibling of
  the S10 site) is NOT annotated; the plan scoped S10 to `:58` only.

## Deviations from plan

- Test placement: the plan's `files` list named only
  `tests/orchestrators/plugin/enable-disable.test.ts` and
  `tests/orchestrators/reconcile/apply.test.ts`. The S7 unit pin lives in
  `apply.test.ts` (reconcile-side semantics) rather than
  `tests/persistence/config-io.test.ts` to stay inside the listed scope.
- S8/S9 `@ts-expect-error` tests: the plan asked for `@ts-expect-error`
  assertions, but `MarketplaceBlock` and `cascadeSeverity` are module-private
  so an external `@ts-expect-error` is not reachable. Substituted
  source-shape pins (the same pattern S6/S4/Y7 already use in apply.test.ts).
  Functionally equivalent regression protection.
- Y3 narrative drift in the existing S6 source-shape test: its comment
  predicts "the count moves from 3 to 4" once Y3 lands. The chosen fix is
  type-based (dead-code drop rather than fail-loud row), so the count stays
  at 5 (3 loop bodies + 2 cross-references) -- still `>= 3`, test still
  green, but the comment narrative is mildly stale. Left as-is; comment
  evolution belongs to Plan 06/07.
