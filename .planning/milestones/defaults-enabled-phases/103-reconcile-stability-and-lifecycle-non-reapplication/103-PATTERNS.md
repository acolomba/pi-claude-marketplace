# Phase 103: Reconcile stability and lifecycle non-reapplication - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 0 new files expected; this is a characterization/regression-pinning
phase (per `103-CONTEXT.md` domain framing) whose deliverables are test additions and
at most one architecture gate. Every item below maps a TEST or GATE shape, not a
production-module shape.
**Analogs found:** 7 / 7 mapped items have a concrete in-repo analog. One item (5)
resolves to "no seam exists to copy because the mechanism already handles it
automatically" — documented explicitly below so the planner does not invent an
invalidation step that isn't needed.

## File Classification

| Expected New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/orchestrators/reconcile/plan.test.ts` (new cases) | test (unit, planner-level) | pure transform (config+state -> plan buckets) | in-file: `emptyReconcilePlan` deep-equal idiom, e.g. `:261-268`, `:477-496` | exact |
| `tests/orchestrators/reconcile/apply.test.ts` (new cases) | test (integration, batch/cascade) | batch (config+state -> disk+notify) | in-file: DFEN-04 second-pass block `:1978-1999`; T1 two-pass block `:1523-1538` | exact |
| `tests/architecture/*.test.ts` (new file OR extend `no-orchestrator-network.test.ts`) | test (architectural grep gate) | enumeration/pattern-match over source text | `tests/architecture/no-orchestrator-network.test.ts` (whole file) via `tests/helpers/source-scan.ts::assertNoForbiddenSurface` | exact |
| `tests/orchestrators/plugin/update.test.ts` (new case, D-103-10 forward direction) | test (unit) | transactional request-response | `update.test.ts:3142-3200` (`D-UPD: update on a disabled plugin...`) | exact |
| `tests/orchestrators/plugin/reinstall.test.ts` (new case, D-103-10 forward direction) | test (unit) | transactional request-response | `reinstall.test.ts:283-311` (`PRL-06` absent-record case) + `reinstallDefault` helper `:265-266` | role-match |
| `tests/orchestrators/plugin/enable-disable.test.ts` (new case, D-103-11 converse) | test (unit) | transactional request-response | `enable-disable.test.ts:331-352` (`ENBL-01` disable-writes-config case) | exact |

## Pattern Assignments

### 1. Planner-level assertion that a plugin is absent from every action bucket (D-103-06)

**Analog:** `tests/orchestrators/reconcile/plan.test.ts` — two idioms coexist, and
the phase's own decision (D-103-06: assert absence from ALL seven buckets, not just
`acc.enable`) picks the stronger one.

**Idiom A — whole-plan deep-equal against the canonical empty plan** (strongest;
proves absence from every bucket in one assertion), e.g. `plan.test.ts:261-268`:

```ts
test("Plugin cell (declared+enabled-false, not recorded): NO action (steady disabled)", () => {
  ...
  const plan = planReconcile(...);
  assert.deepEqual(plan, emptyReconcilePlan("project"));
});
```

Also the two-pass form at `plan.test.ts:477-496` (`ENBL-08`):

```ts
test("ENBL-08: two identical planReconcile passes over a disabled PARTIAL both return the empty plan (fixed point)", () => {
  ...
  const pass1 = planReconcile(...);
  const pass2 = planReconcile(...);
  assert.deepEqual(pass1, emptyReconcilePlan("project"));
  assert.deepEqual(pass2, emptyReconcilePlan("project"));
});
```

**Idiom B — per-bucket `.length` assertions** when the plan is NOT expected to be
globally empty (other plugins/marketplaces may legitimately have actions), e.g.
`plan.test.ts:251-258`:

```ts
assert.equal(plan.pluginsToDisable.length, 1);
assert.deepEqual(plan.pluginsToDisable[0], { ... });
assert.equal(plan.pluginsToInstall.length, 0);
assert.equal(plan.pluginsToUninstall.length, 0);
```

**What to copy:** Idiom A (`emptyReconcilePlan("project")` deep-equal) is the exact
shape for D-103-06 whenever the fixture's only plugin is the disabled one under
test — it structurally proves absence from `pluginsToInstall`, `pluginsToUninstall`,
`pluginsToEnable`, `pluginsToDisable`, `marketplacesToAdd`, `marketplacesToRemove`,
and `sourceMismatches` in one call, which is exactly the "all seven buckets" bar
D-103-06 sets. **What must differ:** the CONTEXT's own hazard is `acc.enable.push`
at `plan.ts:338` (the `isRecordedButDisabled` arm) firing wrongly — the new test's
fixture must be shaped to reach `classifyDeclaredPlugin`'s steady-state comment arm
at `plan.ts:339-343` (declared-disabled, recorded-disabled, not the
`isRecordedButDisabled` marker), which is a DIFFERENT cell of the classification
matrix than any existing `plan.test.ts` case tests today (the closest existing case,
`:261-268`, is declared-disabled + NOT recorded, not declared-disabled + recorded-
disabled). If the fixture instead reuses Idiom B, it must enumerate all seven bucket
lengths (not just `pluginsToEnable`), per D-103-06's explicit rejection of asserting
only the named hazard bucket.

---

### 2. Repeated-pass idempotence test (D-103-05: three passes)

**Analog:** `tests/orchestrators/reconcile/apply.test.ts:1978-1999` — Phase 102's
own second-pass block, itself the newest and most directly on-topic multi-pass
fixture (it is the DFEN-04 install-disabled case, the direct ancestor of this
phase's DFEN-06 proof):

```ts
// Fixed point AT THIS SEAM: a second pass writes neither the config nor
// the record.
const baseAfterFirst = await readFile(basePath, "utf8");
await applyReconcile({ ctx: makeCtx() as unknown as ExtensionContext, pi: STUB_PI, cwd, scope: "project" });
assert.equal(await readFile(basePath, "utf8"), baseAfterFirst, "the second pass must not rewrite the config entry");
assert.deepEqual(
  (await loadState(extensionRoot)).marketplaces.mp!.plugins.foo,
  rec,
  "the second pass must not rewrite the state record",
);
```

**Older, more general two-pass shape** (silent-cascade form, not byte-comparison):
`apply.test.ts:1523-1538` (T1) and `plan.test.ts:462-474` (`ENBL-02 (e)`, planner-
level purity — `assert.deepEqual(plan1, plan2)` across two `planReconcile` calls on
identical inputs). The `plan.test.ts` ENBL-08 case at `:477-496` is the closest
EXISTING multi-pass fixture with the "both equal the empty plan" shape this phase
needs at the planner tier.

**What to copy:** the notify-call-count-zero assertion pattern
(`ctxB.ui.notify.mock.calls.length === 0`, seen at `apply.test.ts:1533-1537` and
`:1667-1671`) for passes 2 and 3, PLUS the byte-comparison + state deep-equal pair
from the DFEN-04 block for whichever seam (config file / state record) this phase's
fixture touches. **What must differ:** D-103-05 requires THREE passes, not two —
every existing apply.test.ts fixture (T1, T3, DFEN-04, DFEN-04-local) stops at pass
2. The third pass is new; reuse the same silent/byte-identical assertion shape
against a THIRD `applyReconcile` call, most likely chained after the existing
second-pass block rather than introduced as a wholly separate test, per D-103-05's
own framing ("two passes prove only that the first pass was not special").

---

### 3. Fixture for a plugin declared only in `claude-plugins.local.json`

**Analog — canonical, most recent:** `apply.test.ts:2002-2050`
(`DFEN-04 / D-102-04: a locally-declared bare entry stamps claude-plugins.local.json...`),
built via the shared `seedDefaultDisabledInstallScope` helper (`apply.test.ts:1839-1901`)
called with `local: { "foo@mp": {} }` and `base: {}` (`:2004-2009`):

```ts
const { basePath, localPath, extensionRoot } = await seedDefaultDisabledInstallScope({
  cwd, home, base: {}, local: { "foo@mp": {} },
});
const baseBefore = await readFile(basePath, "utf8");
...
assert.deepEqual(local.plugins["foo@mp"], { enabled: false });
assert.equal(await readFile(basePath, "utf8"), baseBefore, "a locally-declared stamp must NOT rewrite the base config");
```

**Older sibling (WR-09 isolation case):** `apply.test.ts:458` (test title) —
declares a plugin ONLY in `claude-plugins.local.json` for a disable, asserts NEITHER
physical config file is rewritten (`:541-552`). This is the older, disable-axis
inversion the newer DFEN-04-local case explicitly credits (`apply.test.ts:1397`
comment: "Inversion of the WR-09 disable-axis fixture at apply.test.ts:443").

**What to copy:** the `seedDefaultDisabledInstallScope({ base: {}, local: {...} })`
call shape — it is already parameterized for exactly this (local-only declaration
against a `defaultEnabled: false` marketplace entry), so D-103-07's local-declared
DFEN-06 case can likely reuse the helper directly rather than hand-rolling a new
one. **What must differ:** the DFEN-04-local case asserts the STAMP landed
correctly; D-103-07 needs the FOLLOW-ON reconcile pass(es) to prove the merged view
converges (no re-plan), which neither existing local-file fixture currently chains
— both stop after one `applyReconcile` call. Add the second/third-pass block from
item 2 on top of this fixture shape.

---

### 4. Architecture grep gate over named source files

**Analog — the CONTEXT's own named model (D-103-08):**
`tests/architecture/no-orchestrator-network.test.ts` (whole file, 95 lines), built
on the shared `assertNoForbiddenSurface` helper in `tests/helpers/source-scan.ts`.
Structure: a `FORBIDDEN_TARGETS: ReadonlyArray<string>` file-path list, a
`FORBIDDEN_PATTERNS: ReadonlyArray<{ name; pattern: RegExp }>` list, and ONE `test()`
calling `assertNoForbiddenSurface(FORBIDDEN_TARGETS, FORBIDDEN_PATTERNS, (offenders) => ...)`.
The doc comment documents each target's rationale AND lists "Exempt files (do NOT
add)" with reasons — this is the shape to copy for D-103-09's two named files plus
the explicit "must not forbid `resolveStrict`" carve-out.

**Other candidate gates checked (worse fit for THIS phase, but confirm the
`assertNoForbiddenSurface` shape is the house standard, not a one-off):**
- `tests/architecture/import-boundaries.test.ts` — directed-edge cycle grep
  (different mechanic: graph edges, not flat token forbid-list); not a better fit.
- `tests/architecture/compat-01-no-expansion.test.ts` — hand-written enumeration
  equality (closed-set membership), a different shape (no source-grep at all);
  not a better fit for a "these two files must not reference this token" gate.

**What to copy:** the `FORBIDDEN_TARGETS` / `FORBIDDEN_PATTERNS` / single-`test()`-
with-`assertNoForbiddenSurface` triad, verbatim structure. Also copy the doc-comment
discipline: name the requirement IDs, explain the skip-path (ENOENT) rationale, and
explain the `stripComments` rationale (source headers legally mention the forbidden
token in prose — exactly the case here, since `install.ts`'s doc comments legitimately
discuss `defaultEnabled`).

**What must differ (per D-103-09):**
- Targets: `orchestrators/plugin/update.ts` and `orchestrators/plugin/reinstall.ts`
  ONLY — not `install.ts` (which legitimately reads the field per D-103-01) and not
  `enable-disable.ts`.
- Forbidden tokens: `defaultEnabled` and `applyDefaultEnabled` — NOT a broader
  "enablement read" pattern (rejected explicitly as harder to express as regex and
  prone to false positives).
- The gate must NOT forbid the `resolveStrict` call itself (both files legitimately
  call it; it RETURNS the field on the resolved object without either file reading
  it off).
- Likely lands as a NEW test file (e.g.
  `tests/architecture/no-lifecycle-default-enabled-read.test.ts`) rather than an
  extension of `no-orchestrator-network.test.ts`, since the requirement family
  (DFEN-07, not NFR-5) and the exempt-file rationale differ — but Claude's
  Discretion in `103-CONTEXT.md` leaves this open; either shape is structurally
  identical to the analog.

---

### 5. Rewriting a path-marketplace's `marketplace.json` between two orchestrator calls, plus cache invalidation

**No copy-pattern needed — the mechanism is automatic, not a seam to invoke.**

`domain/manifest-cache.ts:66-` (`createManifestCache`) keys its per-path memoization
on `(mtimeMs, size)` of the manifest file (see the doc comment at
`manifest-cache.ts:55`: "A cached load outcome tagged with the (mtimeMs, size) it
was keyed under"). `domain/manifest.ts:82-95` wraps
`loadMarketplaceManifestUncached` in this cache as a process-lifetime singleton.
Consequently, rewriting `marketplace.json` on disk between two orchestrator calls in
the SAME test process is picked up automatically on the next read — no
`dropMarketplaceCache`-style call is needed for MANIFEST content. (That function
exists for a DIFFERENT cache — the tab-completion `shared/completion-cache.ts`,
unrelated to manifest reads.)

**Existing test precedent confirming this is exercised, not just theorized:**
`tests/orchestrators/plugin/update.test.ts` rewrites `manifestPath` mid-test via
plain `writeFile` calls with no accompanying cache-drop call (e.g. `:960`,
`writeFile(seeded.manifestPath, "{ this is not json")`, immediately followed by an
`updatePlugins` call that observes the new content). D-103-10's "rewrite the
marketplace entry to `defaultEnabled: true`, then `update`" scenario should copy
this exact idiom: a bare `writeFile(manifestPath, JSON.stringify({ ... }))` between
two orchestrator calls, no cache-invalidation call.

**What must differ:** none of `update.test.ts`'s existing rewrite-between-calls
cases target the `defaultEnabled` field specifically — the new D-103-10 test writes
a `seedRealPathMarketplace`-shaped manifest (see item 3's helper family; the same
`entryDefaultEnabled` knob from `apply.test.ts:1363` applies) at `defaultEnabled:
false`, installs, then rewrites the SAME `manifestPath` to `defaultEnabled: true`
before calling `update`/`reinstall`, asserting the record's `enabled` does not move.

---

### 6. Asserting a config file's bytes are unchanged vs. asserting a config entry deep-equals an expected object

**Analog for byte-unchanged:** `apply.test.ts:1982-1993` (DFEN-04 second-pass block)
and `:2029-2033` (DFEN-04-local block) — capture `readFile(path, "utf8")` before,
repeat after, `assert.equal`:

```ts
const baseAfterFirst = await readFile(basePath, "utf8");
await applyReconcile({ ... });
assert.equal(await readFile(basePath, "utf8"), baseAfterFirst, "the second pass must not rewrite the config entry");
```

**Analog for entry deep-equal:** `apply.test.ts:1941-1948` (DFEN-04 first block) —
parse JSON, deep-equal the WHOLE entry (not just the key) so an accidental extra
field fails the assertion:

```ts
const base = JSON.parse(await readFile(basePath, "utf8")) as { plugins: Record<string, unknown> };
assert.deepEqual(
  base.plugins["foo@mp"],
  { enabled: false },
  "DFEN-04: the declaring base entry must gain enabled:false and nothing else",
);
```

**What to copy:** both idioms verbatim — byte-unchanged for the file that must NOT
move (proving no accidental write-back on the fixed-point pass, or proving the
sibling physical file is untouched per WR-09), whole-entry deep-equal for the file
that DOES change (proving the write is exactly the expected patch, not a superset).
**What must differ:** D-103-11 (enable writes `enabled: true` into the declaring
config) needs the deep-equal form pointed at `enabled: true` rather than `false` —
no existing test asserts an `enable`-driven config write with the whole-entry
deep-equal idiom; the closest is `enable-disable.test.ts:339-351` (`ENBL-01`), which
asserts only `plugins["foo@mp"]?.enabled === false` (a field-read, not a whole-entry
deep-equal). Upgrading to whole-entry deep-equal for D-103-11 would be a strict
improvement in line with the DFEN-04 idiom, though the existing field-read form is
also an acceptable, established pattern if a stricter check isn't warranted.

---

### 7. Driving `enable` / `update` / `reinstall` in a test

**`enable` (`setPluginEnabled`)** — analog `enable-disable.test.ts:339-347` (`ENBL-01`):

```ts
await setPluginEnabled({
  ctx, pi: makePi(), cwd,
  marketplace: "mp", plugin: "foo",
  enable: false,   // true for enable
  scope: "user",
  // local: true    // optional, for --local
});
```

**`update` (`updatePlugins`)** — analog `update.test.ts:3162-3168` (`D-UPD`):

```ts
await updatePlugins({
  ctx, pi, scope: "project", cwd,
  target: { kind: "plugin", plugin: "hello", marketplace: "mp" },
});
```

**`reinstall` (`reinstallPlugin`)** — analog `reinstall.test.ts:265-266`
(the file's own `reinstallDefault` helper):

```ts
async function reinstallDefault(cwd: string, ctx: ExtensionContext, pi: ExtensionAPI) {
  return reinstallPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });
}
```

**What to copy:** all three options shapes directly — each verb's minimal call
signature is already exercised against a disabled-record fixture at least once
(`update.test.ts:3142-3200` for update-on-disabled; `reinstall.test.ts` lacks a
disabled-record case today, see below). **What must differ:** D-103-10 needs BOTH
verbs driven twice in the SAME test (install disabled -> rewrite manifest -> update
OR reinstall -> assert record unchanged), which no existing test does for either
verb; and D-103-10's converse ("a user who ran `enable` ... stays enabled across
reload, update and reinstall") needs `setPluginEnabled({ enable: true, ... })`
chained into `updatePlugins`/`reinstallPlugin` calls, which also has no existing
combined fixture. `reinstall.test.ts` has no test today that seeds a DISABLED
record before calling `reinstallPlugin` — `update.test.ts:3142` is the only verb
with an existing disabled-record short-circuit case; the reinstall equivalent must
be built by analogy to it (seed a `makeDisabledPluginRecord`-shaped state entry,
mirroring `update.test.ts:3158`, then call `reinstallPlugin`) rather than copied
from an existing reinstall fixture.

## Shared Patterns

### Decision/requirement-ID comment discipline, no planning-artifact references
**Source:** `.claude/rules/typescript-comments.md` + every quoted comment above.
**Apply to:** every new test title and inline comment. Cite `DFEN-06`, `DFEN-07`,
`D-103-01`..`D-103-11`, `WR-09`, `ENBL-02`, `RECON-05`, `NFR-2`, `NFR-3`, `NFR-5`.
Never `Phase 103`, `Plan NN`, `Wave N`, or a bare `Pitfall N`/`Pattern N`.

### `withHermeticHome` / `makeCtx` test harness
**Source:** used uniformly across `apply.test.ts`, `plan.test.ts`,
`update.test.ts`, `enable-disable.test.ts`, `reinstall.test.ts`.
**Apply to:** every new test in this phase — no new harness is needed.

### `notifications.length` / `ctx.ui.notify.mock.calls.length` as the silence proof
**Source:** `apply.test.ts:1533-1537`, `:1667-1671`; `update.test.ts` `notifications`
array pattern throughout.
**Apply to:** every multi-pass fixture in this phase (item 2) — a silent cascade is
asserted by call-count zero, not by inspecting message content.

## No Analog Found

None of the seven mapped items lack a usable in-repo analog. Item 5 resolves to "no
seam to copy" (the cache is content-addressed and self-invalidates), which is
itself the answer the planner needs — it should NOT budget a task for cache
invalidation on the manifest-rewrite scenario.

## Metadata

**Analog search scope:** `tests/orchestrators/reconcile/{plan,apply}.test.ts`,
`tests/architecture/*.test.ts`, `tests/orchestrators/plugin/{update,enable-disable,
reinstall}.test.ts`, `extensions/pi-claude-marketplace/domain/manifest{,-cache}.ts`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`
**Files opened this session:** `103-CONTEXT.md` (full), `102-PATTERNS.md` (full,
sibling reference), `tests/orchestrators/reconcile/plan.test.ts` (grep + targeted),
`tests/orchestrators/reconcile/apply.test.ts` (grep + `:1340-2050` read),
`tests/architecture/no-orchestrator-network.test.ts` (full),
`tests/orchestrators/plugin/update.test.ts` (grep + `:3142-3280` read),
`tests/orchestrators/plugin/enable-disable.test.ts` (grep + `:331-405` read),
`tests/orchestrators/plugin/reinstall.test.ts` (grep + `:240-270` read),
`extensions/pi-claude-marketplace/domain/manifest.ts`,
`extensions/pi-claude-marketplace/domain/manifest-cache.ts` (grep)
**Pattern extraction date:** 2026-08-15
