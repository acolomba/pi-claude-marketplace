# Phase 97: Disabled-state classification repair - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 17 (1 new definition site, 8 modified source, 8 modified/extended test files)
**Analogs found:** 17 / 17 (this is a consolidation phase — every edit has an in-repo template)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `persistence/state-io.ts` (+`isRecordedButDisabled`) | model/persistence predicate | transform (pure) | `state-io.ts::toDisabledRecord` (same file, same invariant, write side) | exact |
| `orchestrators/reconcile/plan.ts` (delete def, import) | service/planner | transform (pure diff) | `plan.ts:49` existing `persistence/config-io.ts` import | exact |
| `orchestrators/plugin/update.ts` (delete twin; `refreshDisabledRecord` derive) | orchestrator | CRUD (record write) | `reinstall.ts:1670-1677` compatibility derivation | exact |
| `orchestrators/plugin/enable-disable.ts` (delete twin; `partial` gate) | orchestrator | request-response + ledger | `reinstall.ts:1436-1441` partial-capable resolve precedent | exact |
| `orchestrators/plugin/plugin-state-classifier.ts` (inline conj → import) | utility (pure classifier) | transform | `list.ts:422` consumer-of-canonical-export pattern | exact |
| `orchestrators/reconcile/apply.ts` (`!record.enabled` backfill guard + stale seam comment) | orchestrator | event-driven (load-time) | `apply.ts:1031-1035` existing `installable` early-return filter | exact |
| `orchestrators/plugin/list.ts`, `info.ts` | orchestrator (row builders) | request-response | no change beyond import path + comment | exact |
| `orchestrators/reconcile/{types,notify}.ts`, `shared/notify.ts`, `docs/output-catalog.md` | comment/doc prose | n/a | existing corrected-comment style | exact |
| `tests/orchestrators/reconcile/plan.test.ts` (truth-table cell + drift gate replacement) | test (unit + source gate) | transform | `tests/architecture/reconcile-planner-purity.test.ts` (source-grep gate) | exact |
| `tests/orchestrators/plugin/info-manifest-absent.test.ts` (widen 2 tests) | test (byte-exact integration) | request-response | its own `:919-941` disabled carve-out test | exact |
| `tests/orchestrators/plugin/list.test.ts` (new disabled-partial row test) | test (byte-exact) | request-response | `list.test.ts:747` partially-installed row assertion | exact |
| `tests/orchestrators/plugin/enable-disable.test.ts` (3 new tests) | test (byte-exact) | request-response | `enable-disable.test.ts:605-631` byte-lock idempotency test | exact |
| `tests/orchestrators/plugin/update.test.ts` (2 new tests) | test | CRUD | `update.test.ts:3319` `partial: true` invocation idiom | exact |
| `tests/orchestrators/reconcile/backfill.test.ts` (new `enabled`-guard test) | test (seam) | event-driven | `backfill.test.ts:615-627` `__test_scanForceInstalledBackfills` seam call | exact |
| `tests/orchestrators/plugin/plugin-state-classifier.test.ts`, `tests/orchestrators/edge-deps.test.ts` | test (extend + comment fix) | transform | their own existing canonical-disabled cases | exact |

## Pattern Assignments

### `persistence/state-io.ts` — the single predicate (new export)

**Analog:** `persistence/state-io.ts::toDisabledRecord` — same file already owns the disabled shape (write side); the predicate is the read side of the same invariant.

**Doc-comment + export pattern to copy** (state-io.ts:111-127, verbatim):

```typescript
/**
 * Build the disabled form of a plugin record: preserve version /
 * resolvedSource / compatibility / installedAt, reset every resources array
 * to empty, set `enabled: false`, and stamp `updatedAt`. The empty-tuple
 * return type makes "disabled but populated" unrepresentable at the call site.
 */
export function toDisabledRecord(
  record: PluginInstallRecord,
  updatedAt: string,
): DisabledPluginRecord {
```

**Structural-parameter pattern** (the house form, `enable-disable.ts:179-184` — the twin being deleted):

```typescript
function isCurrentlyDisabled(installed: {
  compatibility: { installable: boolean };
  enabled: boolean;
}): boolean {
  return installed.compatibility.installable && !installed.enabled;
}
```

Collapse to `{ readonly enabled: boolean }` — every existing caller's argument satisfies it structurally, no cast.

**Import-legality proof for consumers:** `plan.ts:49` already does
`import { isDeclaredEnabled } from "../../persistence/config-io.ts";` — orchestrators are
unrestricted upward consumers of `persistence/` under `eslint.config.js:237-269`.

---

### `orchestrators/plugin/update.ts` — `refreshDisabledRecord` derive-don't-hardcode

**Analog:** `orchestrators/plugin/reinstall.ts:1670-1677`

```typescript
    compatibility: {
      installable: installable.state === "installable",
      notes: [...installable.notes],
      supported: [...installable.supported],
      unsupported: [...installable.unsupported],
    },
```

Replaces the hard-coded `installable: true` at `update.ts:1385-1390`. Keep the edit inside
`refreshDisabledRecord` (small function) — `update.ts:1549` already carries a
`sonarjs/cognitive-complexity` suppression on `runThreePhaseUpdate`.

---

### `orchestrators/plugin/enable-disable.ts` — partial-capable enable

**Analog (call site to edit):** `enable-disable.ts:212-225`; **analog (precedent):** `reinstall.ts:1436-1441`

```typescript
// reinstall.ts:1436-1441 — the partial-capable gate rationale to mirror
// BFILL-01 / D-68-02: reinstall is partial-capable. It resolves through the
// `requirePartialInstallable` gate (admitting both `installable` and the
// partially-available arm) so backfill can re-materialize a
// still-partial plugin in place without throwing `{not-installable}`. The
// `unavailable` arm is still rejected (NFR-7).
```

Add `partial: !installed.compatibility.installable` to the `runInstallLedger` options object
(`InstallLedgerOptions.partial` exists at `install.ts:457-458`). Put the derivation inside
`runEnableBranch`, **not** in `setPluginEnabled` or its `withLockedStateTransaction` closure —
both carry `sonarjs/cognitive-complexity` suppressions (`enable-disable.ts:386`, `:459`).

---

### `orchestrators/reconcile/apply.ts` — BFILL-01 `enabled` guard

**Analog:** the adjacent early-return filter in the same function (`apply.ts:1031-1035`):

```typescript
  const { scope, marketplace, mp, plugin, record } = target;
  // D-68-03: scan ONLY partially-installed plugins.
  if (record.compatibility.installable) {
    return false;
  }
```

Copy the shape exactly: `if (!record.enabled) { return false; }` with an ENBL-08 citation.
Also correct the stale seam comment at `apply.ts:1057-1063` (it claims the planner's enable
bucket requires `installable === true` — false after the collapse).

---

### `orchestrators/plugin/plugin-state-classifier.ts` — inline conjunction → import

**Analog:** `list.ts:422` — the consume-the-canonical-export pattern (import at `list.ts:73`):

```typescript
  if (isRecordedButDisabled(record)) {
    return {
      // D-03/D-06: a disabled INVENTORY row (list surface) is steady state,
      // not a realized transition -> info, never reloads.
      status: "disabled",
      name: pluginName,
      version: record.version,
      ...scopeField,
      ...descriptionField,
      severity: "info",
      needsReload: false,
    };
  }
```

Note the `exactOptionalPropertyTypes` conditional-spread idiom (`list.ts:410-414`) for any
new optional-field row construction:

```typescript
  const scopeField: { readonly scope?: Scope } =
    pluginScope === marketplaceScope ? {} : { scope: pluginScope };
```

---

### `tests/orchestrators/reconcile/plan.test.ts` — replacement drift gate

**Analog:** `tests/architecture/reconcile-planner-purity.test.ts:1-60` — the house source-grep
architecture-gate shape. Copy its four load-bearing pieces:

```typescript
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "gitOps reference", pattern: /\bgitOps\b/ },
  // ...
];

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

test("DIFF-01: planReconcile is pure (no fs/network/notify/save/lock imports)", async () => {
  const offenders: string[] = [];
  const src = await readFile(path.join(REPO_ROOT, TARGET), "utf8");
  const stripped = stripComments(src);
  for (const { name, pattern } of FORBIDDEN_PATTERNS) {
    if (pattern.test(stripped)) {
      offenders.push(`${TARGET} matches forbidden ${name}: ${String(pattern)}`);
    }
```

Adapt to a **multi-TARGET** array over the four former definition files, forbidding
`/compatibility\.installable\s*&&\s*!\w+\.enabled/`, plus a positive assertion that each file
imports the single predicate. `stripComments` is load-bearing: the surviving JSDoc will
legally mention the removed conjunction.

**Truth-table fixture to keep, cell to flip** (`plan.test.ts:676-693`, `recordWith(installable, enabled)`
factory is reusable unchanged). Flip the `(installable:false, enabled:false)` case at
`plan.test.ts:723-728` from `expected: false` to `true`; rewrite the header prose at
`plan.test.ts:636-639` and the JSDoc at `plan.ts:266-270`.

---

### `tests/orchestrators/plugin/enable-disable.test.ts` — three new behavior tests

**Analog (byte-lock idempotency):** `enable-disable.test.ts:605-631`

```typescript
test("ENBL-04 byte-lock: disable-already-disabled renders `⊘ foo (skipped) {already disabled}` (no version, info severity)", async () => {
  // ...
      ["● mp [user]", "  ⊘ foo (skipped) {already disabled}"].join("\n"),
```

**Analog (fixture):** `enable-disable.test.ts:155` `seedRealDisabledMarketplace(home, { marketplaceName, pluginName, version })`
— a real on-disk marketplace clone + a disabled state record. Extend this **local** factory with
an `unsupported: readonly string[]` axis (compute `installable: unsupported.length === 0`);
do not import across test trees (house convention: copy, don't import).

**Analog (orchestrated-mode assertion):** `enable-disable.test.ts:823-847`
(`assert.equal(outcome.reason, "already disabled")`).

**Manifest-absent enable boundary:** pin the existing resolve-failure semantics as a
unit-level byte assertion — brace-suppressed `(failed)` + 4-space cause trailer standalone;
`{ status: "failed", reason: "unreadable" }` orchestrated. No new catalog state.

---

### `tests/orchestrators/plugin/list.test.ts` + `info-manifest-absent.test.ts` — fixture axis already exists

**Analog:** both files' local `seedMarketplace` factory already carries both axes
(`list.test.ts:129-141`, `info-manifest-absent.test.ts:198-225`):

```typescript
  installed?: Record<
    string,
    {
      version: string;
      disabled?: boolean;
      hooksOnly?: boolean;
      unsupported?: readonly string[];
    }
  >;
```

with `installable: unsupported.length === 0` and `enabled: info.disabled !== true`. So
`installed: { alpha: { version: "1.0.0", disabled: true, unsupported: ["lspServers"] } }`
produces the exact reachable CR-01 shape with **no factory change**.

**Byte-assertion idiom** (`info-manifest-absent.test.ts:919-941`):

```typescript
      ["● mp [user]", "  ◍ alpha v1.0.0 (disabled)"].join("\n"),
```

Note: the disabled block header is `● mp [user]` with **no** `<no autoupdate>` marker, unlike
manifest-backed rows in the same file. Copy the disabled variant.

`list.test.ts` row-match idiom (`list.test.ts:771`):
`assert.match(out, /◉ hookplug v1\.0\.0 \(partially-installed\) \{unsupported hooks\}/, out);`

---

### `tests/orchestrators/reconcile/backfill.test.ts` — the BFILL `enabled`-guard test

**Analog:** `backfill.test.ts:615-627`

```typescript
    await __test_scanForceInstalledBackfills(
      { ctx: ctx as unknown as ExtensionContext, pi: STUB_PI, cwd, scope: "project" },
      "project",
      state,
      outcomes,
    );

    assert.equal(outcomes.length, 1);
```

Seed a **manifest-present** disabled partial whose supported set grew (a manifest-absent
fixture skips at `apply.ts:1092-1102` and proves nothing) and assert zero outcomes plus
`record.enabled === false` after the scan.

---

### `tests/orchestrators/reconcile/plan.test.ts` — ENBL-08 two-pass steady state

**Analog:** `tests/orchestrators/reconcile/plan-convergence.test.ts:19-33`

```typescript
const second = planReconcile(merged, state, "user");
assert.deepEqual(second, emptyReconcilePlan("user"));
```

`planReconcile` is pure, so seeding the state already in the disabled-partial shape and
asserting **both** passes are empty proves the fixed point without an apply step.

## Shared Patterns

### Predicate consumption (single definition, five consumers)
**Source:** `orchestrators/plugin/list.ts:73` + `:422`
**Apply to:** `plan.ts`, `list.ts`, `info.ts`, `update.ts`, `enable-disable.ts`, `plugin-state-classifier.ts`
```typescript
import { isRecordedButDisabled } from "../reconcile/plan.ts";  // → "../../persistence/state-io.ts"
// ...
  if (isRecordedButDisabled(record)) {
```

### Comment policy on every touched line
**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** every source and test comment this phase edits
Cite `ENBL-NN` / `D-NN` / `INV-NN` / `NFR-N` / `CR-NN`. Never `Phase NN`, `Plan NN`, `Wave N`,
`Pitfall N`, `milestone vX.Y`. Existing correct examples: the D-54-01/ENBL-04 block at
`list.ts:416-421` (which itself needs its `installable: true` clause removed).

### `exactOptionalPropertyTypes` conditional spread
**Source:** `list.ts:410-414`, `info.ts:2122`
**Apply to:** any new message-object construction
```typescript
  const descriptionField: { readonly description?: string } =
    manifestEntry?.description === undefined ? {} : { description: manifestEntry.description };
```

### Byte-exact cascade assertion
**Source:** `enable-disable.test.ts:631`, `info-manifest-absent.test.ts:940`
**Apply to:** every ENBL-06/07 rendering test
```typescript
      ["● mp [user]", "  ◍ alpha v1.0.0 (disabled)"].join("\n"),
```

### Local seed factory, extended not imported
**Source:** `list.test.ts:154 seedMarketplace`, `update.test.ts:158 seedPathMarketplace`,
`enable-disable.test.ts:155 seedRealDisabledMarketplace`
**Apply to:** every new test. Six distinct copies exist across the suite by design; extend the
target file's own factory with the missing axis.

## No Analog Found

None. Every file this phase touches already exists, and every second-order edit has an in-repo
template (see the research §"Don't Hand-Roll" table). The one genuinely new artifact — the
replacement drift gate — maps onto `tests/architecture/reconcile-planner-purity.test.ts`.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{persistence,orchestrators,shared}/`,
`tests/{architecture,orchestrators}/`
**Files scanned:** 12 read directly this session; 30+ cited from RESEARCH.md's verbatim inventory
**Pattern extraction date:** 2026-08-09
