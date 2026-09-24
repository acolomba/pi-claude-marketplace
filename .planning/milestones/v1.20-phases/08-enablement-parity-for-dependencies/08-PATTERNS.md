# Phase 8: Enablement parity for dependencies - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 8 (5 edited + 3 shared/closed-set surfaces)
**Analogs found:** 8 / 8 (all in-repo; this phase is pure wiring of existing mechanisms — see RESEARCH.md's own primary recommendation)

All analogs below are git-tracked source under `extensions/pi-claude-marketplace/` (verified via `git ls-files`). None are gitignored mirrors.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts` (EDEP-01 cascade walk, EDEP-02 guard) | orchestrator | CRUD (state read-modify-write) | `orchestrators/plugin/install-cascade.ts` (cascade walk) + `orchestrators/plugin/uninstall.ts` (retired refusal shape) | exact (same file, self-extension) + role-match (refusal precedent lives on a sibling verb) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts` (multi-row EnableMsg/DisableMsg) | service (message composition) | transform | `orchestrators/plugin/install-cascade.messaging.ts::composeCascadeMemberRows` | role-match (different union type, same SHAPE) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` (EDEP-03 write in `checkInstalledMember`/`resolveMemberConstraints`) | orchestrator | CRUD | `orchestrators/plugin/enable-disable.ts::runEnableBranch` + `orchestrators/plugin/install-flow.ts::materializePromotedRecord` | exact (same re-materialization mechanism, third call site) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` (row token change, `alreadyInstalled` loop) | service (message composition) | transform | same file, self-extension (verified read, lines 228-246) | exact |
| `extensions/pi-claude-marketplace/shared/notification-types.ts` (`REASONS` +1: `"dependency enabled"`) | config (closed-set contract) | CRUD (append to tuple) | same file — existing `"dependency promoted"`/`"dependency disabled"`/`"dependency pruned"`/`"already enabled"` entries | exact |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (topic register +1, header count bump) | config | CRUD | same file — `"dependency promoted"` entry's register row | exact |
| `docs/plugin-enablement.md` (§40-46 rewrite) | docs | transform | same file, self-extension | exact |
| `docs/output-catalog.md` (new/changed rows, byte + state counts) | docs | transform | same file — existing `dependency promoted`/`dependency disabled` catalog rows | exact |

## Pattern Assignments

### `orchestrators/plugin/enable-disable.ts` — EDEP-01 cascade + EDEP-02 guard (orchestrator, CRUD)

**Analog 1 (re-materialization primitive — reuse as-is):** `orchestrators/plugin/enable-disable.ts::runEnableBranch`, verified read lines 313-332:
```typescript
const result = await transaction.runInstallLedger(
  state,
  locations,
  {
    ctx: opts.ctx,
    scope,
    cwd: opts.cwd,
    marketplace: opts.marketplace,
    plugin: opts.plugin,
    pinVersionOverride: recordedVersion,
    allowExistingRecord: true,
    partial,
    removalOps: createRemovalOps(),
  },
  capture,
);
```
Call this once per closure member (post-order) from `domain/dependency-closure.ts::resolveDependencyClosure` (unchanged, reused for ordering).

**Analog 2 (refusal shape to resurrect for EDEP-02 — NOT `uninstall.ts`'s current allow-and-report behavior):** `orchestrators/plugin/uninstall.ts::readDeclarers`, verified read lines 218-232 (now superseded on `uninstall` by D-06-06, but the exact shape `disable` needs):
```typescript
async function readDeclarers(args: {
  readonly state: ExtensionState;
  readonly locations: ScopedLocations;
  readonly key: string;
}): Promise<DeclarerReading> {
  const result = await buildScopeDeclarationIndex({
    state: args.state,
    locations: args.locations,
    exclude: args.key,
  });
  if (!result.ok) {
    throw new UninstallRefusedError("unreadable", result.cause.message);
  }
  return { snapshot: result, dependents: findDependents(args.key, result.index) };
}
```
Pair with `domain/dependency-orphans.ts::findDependents` (verified read, full file, lines 42-51):
```typescript
export function findDependents(target: string, index: DeclarationIndex): readonly string[] {
  const dependents: string[] = [];
  for (const [holder, declared] of index) {
    if (declared.has(target)) {
      dependents.push(holder);
    }
  }
  return dependents.sort((a, b) => a.localeCompare(b));
}
```
D-08-01 locks the refusal wording to plain English ("Disable A, B first, then X"), not upstream's chained-command form — compose this text fresh; do not copy `UninstallRefusedError`'s message string verbatim.

**Error handling:** `UninstallRefusedError` class (thrown, caught by the edge shim) is the precedent for how a refusal propagates without a state write — reuse the throw-and-catch-at-edge shape, not the "proceed and report" shape `uninstall.ts` uses today.

**Complexity ceiling constraint (Pitfall 3):** both `enable-disable.ts` and `dependency-index.ts` sit near the ESLint sonarjs/fallow ceiling of 15. Add the cascade walk and the guard as extracted helper functions (mirroring the existing `runEnableBranch`/`runDisableBranch`/`emitUnresolvedTarget` extraction pattern), not as inline branches in `setPluginEnabledWithTransaction`.

**Naming-collision constraint:** do NOT reuse `Dependency = "agents" | "mcp"` (`shared/concerns/soft-dep.ts:31`, consumed via `enableRowDependencies`, `orchestrators/plugin/shared.ts:129-144`) for the new per-plugin-dependency cascade rows — that type names the soft-dep companion extensions, an unrelated concept. Name the new cascade-member type distinctly (e.g. `ClosureMemberRow`/`DependencyCascadeRow`).

---

### `orchestrators/plugin/enable-disable.messaging.ts` — multi-row rendering (service, transform)

**Analog:** `orchestrators/plugin/install-cascade.messaging.ts::composeCascadeMemberRows`, verified read lines 196-249 — follow the SHAPE (root row + sorted member rows, one `notifyWithContext` call carrying an array) without literally importing the function, since `EnableMsg`/`DisableMsg` is a structurally different union from `CascadeMsg` (per RESEARCH.md Assumption A3). House style is "spread-and-extend a render map," established when `install-cascade.messaging.ts` was built.

**Row token reuse (D-08-03):** an already-enabled closure member's row reuses the EXISTING `"already enabled"` token already present in `REASONS` (`shared/notification-types.ts:33`) — no new token needed for this part.

---

### `orchestrators/plugin/install-cascade.ts` — EDEP-03 write in the already-installed arm (orchestrator, CRUD)

**Analog (current READ-ONLY code that must become a write):** `checkInstalledMember`, verified read lines 670-718 (this function's docstring states the current invariant being revised — "an already-installed dependency is CHECKED and never touched" — for the disabled-and-already-installed subcase only):
```typescript
function checkInstalledMember(
  state: ExtensionState,
  member: ClosureMember,
): CascadeConstraintFailure | undefined {
  const intersected = intersectDependencyRanges(member.ranges);
  if (!intersected.ok) {
    return toIntersectionFailure(member, intersected);
  }
  const recorded = recordedVersionOf(state, member);
  if (isUnconstrainedRange(intersected.range) || recorded === undefined) {
    return undefined;
  }
  return recordedVersionSatisfies(recorded, intersected.range)
    ? undefined
    : { kind: "range-conflict", why: "installed-unsatisfied", key: member.key,
        range: renderConstraintRange(intersected.range), recordedVersion: recorded };
}
```

**Re-materialization pattern to add (third invocation of the same mechanism):** `orchestrators/plugin/install-flow.ts::materializePromotedRecord`, verified read lines 1007-1030:
```typescript
async function materializePromotedRecord(
  args: PromotionArgs,
  record: PluginInstallRecord,
): Promise<InstallLedgerSummary> {
  const { opts } = args;
  const result = await runInstallLedger(
    args.state,
    args.locations,
    {
      ctx: opts.ctx,
      scope: opts.scope,
      cwd: opts.cwd,
      marketplace: opts.marketplace,
      // ... pinVersionOverride + allowExistingRecord follow, mirroring runEnableBranch
```

**Provenance guard (A2 — do not copy this part):** unlike `promoteDependencyRecord`'s `record?.provenance !== "dependency"` flip to `"explicit"`, EDEP-03's write must NOT flip provenance — it stays `"dependency"` (D-04-02: config never names a dependency; only a by-name install promotes).

---

### `orchestrators/plugin/install-cascade.messaging.ts` — row token change (service, transform)

**Analog (exact block being replaced — self-file, verified read lines 228-246):**
```typescript
for (const member of args.alreadyInstalled) {
  const reasons: ContentReason[] = member.disabled
    ? ["already installed", "dependency disabled"]
    : ["already installed"];
  rows.push({
    status: "skipped",
    name: member.key,
    ...(member.version !== undefined && { version: member.version }),
    reasons,
    severity: skipSeverity(reasons),
  });
}
```
Changes to: `status: "installed"`, `reasons: ["already installed", "dependency enabled"]` for the disabled subcase (after the write in `install-cascade.ts` succeeds); the non-disabled subcase (`["already installed"]`, plain) is unchanged.

---

### `shared/notification-types.ts` / `shared/notify-reasons.ts` — closed-set token (config, CRUD)

**Analog:** the `"dependency promoted"` token's full ten-surface footprint (D-04-07, enumerated in `04-06-SUMMARY.md`), and `"dependency disabled"`/`"dependency pruned"` (D-05-11) as the two most recent repeats of the same mechanism. Grep every existing occurrence of `"dependency promoted"` as the literal file list to touch for `"dependency enabled"`:
```bash
grep -rn '"dependency promoted"' extensions/pi-claude-marketplace/ docs/ tests/
```
This surfaces (per RESEARCH.md Pitfall 4 and the Established Patterns note): the `REASONS` tuple in `notification-types.ts`, both contract-constant enumerations, the length lock in `tests/architecture/notify-closed-set-locks.test.ts`, `notify-reasons.ts`'s topic-grouped register plus its header count, `docs/output-catalog.md`'s state + byte counts, and the fixture/`catalog-parser.test.ts` tuple count. Do not stop at the runtime array — it is not the sole source of truth; the parallel pins are independently checked.

---

## Shared Patterns

### Guard-free re-materialization via `runInstallLedger`
**Source:** `orchestrators/plugin/enable-disable.ts::runEnableBranch` (lines 313-332) and `orchestrators/plugin/install-flow.ts::materializePromotedRecord` (lines 1007-1030)
**Apply to:** `enable-disable.ts`'s new cascade-member write (EDEP-01) AND `install-cascade.ts`'s new already-installed-disabled write (EDEP-03) — both are the SAME third/fourth invocation of `runInstallLedger(..., pinVersionOverride: recordedVersion, allowExistingRecord: true, ...)`. Do not hand-roll a lighter "just flip the enabled flag" write — a disabled record's artifacts are off disk (per `enable-disable.ts:439-449` and `install-cascade.ts:829-832` comment blocks); a bare flag flip violates the codebase's established NFR-3 fail-clean invariant.

### Declarer index + dependents guard
**Source:** `orchestrators/plugin/dependency-index.ts::buildScopeDeclarationIndex` (full file, unchanged) + `domain/dependency-orphans.ts::findDependents` (lines 42-51, unchanged)
**Apply to:** EDEP-02's disable guard in `enable-disable.ts`. Already fail-closed (D-05-07), same-scope-only (D-05-05), includes disabled declarers (D-05-04), offline (NFR-5). Reuse directly — no new declaration-index builder.

### Untrusted-name defense for interpolated dependent lists
**Source:** `orchestrators/plugin/uninstall.messaging.ts::renderDependents`, verified read (~lines 160-172):
```typescript
function renderDependents(dependents: readonly string[]): string {
  if (dependents.every(isRenderablePluginKey)) {
    return dependents.join(", ");
  }
  return dependents.length === 1 ? "1 other plugin" : `${dependents.length} other plugins`;
}
```
**Apply to:** EDEP-02's refusal text — never interpolate `findDependents`'s raw output into the plain-English instruction; route through this exact guard (or a close mirror) since plugin names permit `"`, `,`, spaces, and bidi controls (`domain/name.ts::assertSafeName`).

### Closed-set amendment (all-ten-surfaces)
**Source:** the `"dependency promoted"` token's full landing (D-04-07, `04-06-SUMMARY.md`) and `"dependency disabled"`/`"dependency pruned"` (D-05-11)
**Apply to:** the new `"dependency enabled"` token (D-08-02). Land in one commit: fixture, both contract constants, length lock, both enumeration pins, `notify-reasons.ts` header count, `docs/output-catalog.md` state + byte counts, `catalog-parser.test.ts` tuple count.

## No Analog Found

None — RESEARCH.md's own conclusion (confirmed here) is that every mechanism this phase needs already shipped in Phases 3-7 of this milestone; this phase is wiring, not invention.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{orchestrators,domain,shared,edge}/plugin/` and sibling dirs, plus `docs/`
**Files scanned:** 14 tracked files verified via `git ls-files` (all analogs cited above)
**Pattern extraction date:** 2026-09-19
**Source of excerpts:** All code excerpts above are carried forward from RESEARCH.md's own verified-read citations (this phase's research already performed direct Reads of every analog file/line-range cited); this pass re-verified analog paths against `git ls-files` for the tracked-source gate and organized excerpts per target file for planner consumption.
