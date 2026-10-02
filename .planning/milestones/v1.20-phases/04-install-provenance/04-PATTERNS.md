# Phase 4: Install provenance - Pattern Map

**Mapped:** 2026-09-15
**Files analyzed:** 9 production + 6 gate/doc surfaces (census taken as given from `04-RESEARCH.md`)
**Analogs found:** 15 / 15 — every change has an in-tree precedent; **no new production module**

> **Scope note.** `04-RESEARCH.md` already enumerated the modified-file list by compiler probe and
> its file:line references are exact. This document does **not** repeat that census. It pastes the
> copyable shape of the closest analog for each change, so the planner and executor do not
> re-derive it.
>
> **Spelling rule that governs every excerpt below (D-04-08):** source comments and test titles
> anchor on `D-04-NN`. Never write bare `PROV-NN` in source — it already means *git auth provider*
> in this codebase (48 citations).

---

## File Classification

| File to modify | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/persistence/state-io.ts` | model / schema | persisted-record validation | the `enabled` field's own footprint in the same file | **exact (self)** |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` | migration | load-time transform | `ensurePluginEnabled` (same file, line 161) | **exact (self)** |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` | orchestrator (statePhase) | record construction | `installedAt: existing?.installedAt ?? nowIso` (line 984, same object literal) | **exact (self)** |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts` | orchestrator | record carry-forward | `installedAt: input.oldRecord.installedAt` (line 143, same literal) | **exact (self)** |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` | orchestrator (composition root) | option threading + config write-back | `pinVersion` threading at `:1181-1191`; `writeOrchestratedDeclarations` at `:421` | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` | orchestrator helper | config write | `writeAdoptingConfigEntries` (parameter removal) | exact |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts` | domain-ish pure planner | diff/fold | `buildUninstallBucket`'s own two `continue` guards | **exact (self)** |
| `extensions/pi-claude-marketplace/shared/notification-types.ts` | config (closed set) | vocabulary | `"dependency disabled"` (appended in Phase 3, REASONS 52 → 53) | **exact** |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | config (closed set proof) | vocabulary | same token's `CommandPrivateReason` arm | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` | messaging builder | row construction | `classifyEntityShapeError`'s `already-installed` arm (line 368) | exact |
| `docs/output-catalog.md` | doc (pinned contract) | catalog row | `dependency-cascade-disabled-skip` section (line ~811) | exact |
| `tests/architecture/catalog-uat/fixtures/plugin-install.ts` | test fixture | catalog fixture | same state's fixture (line 462) | exact |
| `tests/architecture/catalog-uat/catalog-contract.test.ts` | gate | count pin | `EXPECTED_STATE_COUNT` + `EXPECTED_UTF8_BYTES` | exact |
| `tests/architecture/notify-closed-set-locks.test.ts` | gate | length pin | `REASONS.length === 53` | exact |
| `tests/architecture/compat-01-no-expansion.test.ts` + `tests/shared/notification-types.test.ts` | gate | enumeration pin | the two `REASONS` enumeration lists | exact |

**The one thing RESEARCH left open, answered:** D-04-07's new outcome row does **NOT** force a new
`*.messaging.ts` module. The promotion row belongs in the existing
`orchestrators/plugin/install.messaging.ts`, which already owns the `already-installed` arm it
replaces and already has its 1:1 pair at `tests/orchestrators/plugin/install.messaging.test.ts`.
**Assumption A4 in RESEARCH.md resolves benign: `check-corresponding-tests.mjs` imposes no new
obligation and no new 100%-run-alone coverage target is incurred.** Create no new production module
anywhere in this phase.

---

## Pattern Assignments

### 1. `persistence/state-io.ts` — the `enabled` field is the template; `resolvedSha` is the trap

`enabled` is the project's one required-at-a-schemaVersion field. **Provenance follows it in all
four places `enabled` appears; it must NOT follow `resolvedSha`/`hookEntries`.** The contrast is the
point: those two are `Type.Optional`, spread conditionally, carry an explicit "NO schemaVersion
bump" comment, and get no migrate fill — precisely because absence is allowed to mean "this record
predates the key." For provenance, absence must mean nothing at all, so it is required + bumped +
filled.

**a. Schema header doc comment** (`state-io.ts:60-80`) — the ENBL-02 paragraph is the shape to copy:

```ts
/**
 * ST-3: per-plugin install record (D-09 nesting under marketplaces.<mp>.plugins).
 * …
 * ENBL-02: `enabled: boolean` is REQUIRED (schemaVersion 2+). The migration
 * fills `enabled: true` for all existing records via `ensurePluginEnabled`
 * before validation runs, so v1.0..v1.13 state.json files load cleanly.
 * `enabled: false` is the sole disable marker; `true` means active.
 *
 * COMPAT-01: exported so the no-expansion gate reads the record's key set off
 * this single source of truth rather than a hand-maintained field list that
 * would drift. …
 */
```

Add a `D-04-03` paragraph in the same register: required at schemaVersion 3, filled by
`ensurePluginProvenance` before validation, `"explicit"` is the truthful default.

**b. Field declaration** (`state-io.ts:123-125`) — the required-field neighbourhood, with the
optional ones visible above it for contrast:

```ts
  resolvedSha: Type.Optional(Type.String()),          // :90   — OPPOSITE precedent
  hookEntries: Type.Optional(Type.Array(PERSISTED_HOOK_ENTRY_SCHEMA)), // :109 — OPPOSITE precedent
  compatibility: Type.Object({ … }),
  resources: Type.Object({ … }),
  enabled: Type.Boolean(),        // <- the precedent to copy: bare, required, no Optional
  installedAt: Type.String(),
  updatedAt: Type.String(),
```

The inline two-literal union shape is already in this file (`MARKETPLACE_RECORD_SCHEMA.scope`,
`state-io.ts:264`), which settles the "named constant vs. inline" discretion clause:

```ts
  scope: Type.Union([Type.Literal("user"), Type.Literal("project")]),
```

**c. `clonePluginRecord`'s ENUMERATED copy** (`state-io.ts:147-179`) — note the two conditional
spreads (optional keys) versus the three bare assignments (required keys). Provenance is a bare
assignment beside `enabled`:

```ts
export function clonePluginRecord(record: PluginInstallRecord): PluginInstallRecord {
  return {
    version: record.version,
    resolvedSource: record.resolvedSource,
    ...(record.resolvedSha !== undefined && { resolvedSha: record.resolvedSha }),
    ...(record.hookEntries !== undefined && {
      hookEntries: record.hookEntries.map((entry) => ({ ...entry })),
    }),
    compatibility: { … },
    resources: { … },
    enabled: record.enabled,          // <- copy this line's shape
    installedAt: record.installedAt,
    updatedAt: record.updatedAt,
  };
}
```

The doc comment above it (`:131-146`) warns that an omission here is silent. **For a REQUIRED key
that warning does not apply** — RESEARCH measured TS2741 firing at `:149`. Add the field
deliberately; do not budget a bespoke guard test for a hazard the compiler covers.

**d. `toDisabledRecord`** (`state-io.ts:215-224`) needs **no change** — it spreads:

```ts
  return { ...record, enabled: false, updatedAt };
```

**e. `STATE_SCHEMA` doc comment + union** (`state-io.ts:281-288`) — the comment states the versions'
meanings and must gain a v3 sentence in the same voice:

```ts
/**
 * ST-1: state.json shape. schemaVersion 1 is the pre-ENBL-02 shape (no
 * `enabled` field on plugin records); schemaVersion 2 is the ENBL-02 shape
 * (`enabled: boolean` required). The union lets loadState accept both during
 * the migration cycle; `persistMigratedState` always writes schemaVersion 2.
 */
export const STATE_SCHEMA = Type.Object({
  schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2)]),
```

---

### 2. `persistence/migrate.ts` — `ensurePluginEnabled` is the exact template (D-04-03)

**Analog:** `extensions/pi-claude-marketplace/persistence/migrate.ts:147-184`. Copy the whole shape:
the three-part non-object guard, the `mutated` flag, the `Object.values` walk, the per-record
re-guard, and above all the **only-fill-absence comment**.

```ts
/**
 * ENBL-02: fill `enabled: true` on every plugin record that lacks the field.
 * Mirrors `ensurePluginResources` -- same iteration pattern, same
 * mutated-flag discipline.
 *
 * `enabled: true` is the additive default for any record predating the
 * field. This intentionally over-fills the one legacy shape it cannot
 * distinguish: … That mislabel self-heals on the next reconcile, which reads
 * the still-`enabled: false` config entry and emits one redundant disable.
 * The fill MUST run before STATE_VALIDATOR.Check so the newly-required
 * ENBL-02 field is present.
 */
function ensurePluginEnabled(mp: Record<string, unknown>): boolean {
  const plugins = mp.plugins;
  if (typeof plugins !== "object" || plugins === null || Array.isArray(plugins)) {
    return false;
  }

  let mutated = false;
  for (const plRaw of Object.values(plugins as Record<string, unknown>)) {
    if (typeof plRaw !== "object" || plRaw === null || Array.isArray(plRaw)) {
      continue;
    }

    const pl = plRaw as Record<string, unknown>;
    // Only an ABSENT field is filled. A present-but-non-boolean value
    // (e.g. null) is intentionally left untouched for STATE_VALIDATOR.Check
    // to reject with an actionable error rather than being silently coerced.
    if (pl.enabled === undefined) {
      pl.enabled = true;
      mutated = true;
    }
  }

  return mutated;
}
```

`ensurePluginProvenance` is this function with `pl.enabled` → `pl.provenance` and `true` →
`"explicit"`. The over-fill caveat has a real analogue worth writing down in the same voice: the
fill mislabels dev-tree records Phase 3 wrote as dependencies — but unlike ENBL-02's, **this one
does not self-heal**; say so, and cite `D-04-03`.

**Call site** (`migrate.ts:246-251`) — one line, immediately after `ensurePluginEnabled`, inside the
per-marketplace loop of `migrateLegacyMarketplaceRecords`:

```ts
    mutated = ensureMarketplacePaths(mpName, mp, extensionRoot) || mutated;
    mutated = ensurePluginResources(mp) || mutated;
    mutated = ensurePluginEnabled(mp) || mutated;
    // <- ensurePluginProvenance(mp) goes HERE
    if (scrubAutoupdate) {
      mutated = ensureNoLegacyAutoupdate(mp) || mutated;
    }
```

**Where it runs relative to `STATE_VALIDATOR.Check`:** the whole of
`migrateLegacyMarketplaceRecords` runs *before* the check — the ordering lives at the `loadState`
seam, not inside `migrate.ts`:

```ts
// persistence/state-io.ts:434-438, 464
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
    parsed, extensionRoot, scrubAutoupdate,
  );
  …
  if (!STATE_VALIDATOR.Check(normalized)) {
```

So placement within the loop is free; placement within `loadState` is already correct and needs no
change.

**Module header** (`migrate.ts:1-30`) — this block enumerates every fill and a new one belongs in
it. The ENBL-02 paragraph to sit beside:

```ts
// Per ST-4: missing manifestPath / marketplaceRoot are filled with
// the default derivation. Per ST-5: missing resources.agents /
// resources.mcpServers / resources.hooks are normalized to []
// (the hooks arm lands per HOOK-02 / D-57-01; …). Per ENBL-02:
// missing `enabled` is filled with `true`. This is a deliberate over-fill:
// …
```

Also amend the `migrateLegacyMarketplaceRecords` doc comment's per-behavior bullet list
(`migrate.ts:186-208`), which already carries one bullet per fill:

```ts
 *   - per-plugin: fill `enabled: true` when the field is absent (ENBL-02
 *     additive default; same discipline as the hooks arm above)
```

**Complexity — the binding constraint.** RESEARCH measured `migrateLegacyMarketplaceRecords` at
fallow 18 cyclomatic / **15** cognitive after the change against a ceiling of 20/**15**, and
fallow's ceiling is inclusive. **Zero headroom.** ESLint reads the same function at 7 and will stay
silent. The extraction above (a named `ensurePluginProvenance` helper + one `|| mutated` line) is
exactly what keeps it at 15 — inlining the loop pushes it over. **This is not a style preference.**
Run `npm run fallow` alongside `npm run lint` on any task touching this file.

---

### 3. A closed-set `REASONS` member, end-to-end (D-04-07)

**Analog:** `"dependency disabled"` — appended in Phase 3 (RESV-05), REASONS 52 → 53. It is the
most recent precedent and it touched **nine** surfaces. Every one of them is required; a token that
lands in fewer fails a gate.

**Apply to:** D-04-07's new promotion outcome row.

**3a. `extensions/pi-claude-marketplace/shared/notification-types.ts:94-102`** — append at the TAIL
of `REASONS` (order is catalog-stable), with a comment saying what the token names and why an
existing token could not carry it:

```ts
  // RESV-05: the dependency the cascade left alone is RECORDED but disabled, so
  // it materialized nothing on disk. `already installed` alone is true and
  // misleading together -- it reads as the benign idempotent skip, and the
  // requesting plugin installs against a dependency whose artifacts are not
  // there. This token is what raises that row off info and names the one thing
  // the user can act on. …
  "dependency disabled",
] as const;
```

**3b. `extensions/pi-claude-marketplace/shared/notify-reasons.ts`** — TWO edits.

The header prose ledger (`:18-36`) records every count move and must gain a sentence:

```ts
 * … DATA-01 / WR-06 added `data kept`, uninstall's data-disposition marker
 * (44 to 45). RESV-02..06 added the seven dependency-cascade reasons … (45 to 52).
 * RESV-05 added `dependency disabled`, which lifts a skipped-but-inert
 * dependency off the benign-skip default (52 to 53).
```

The token needs a **home in the partition** or `_ReasonsCoverageProof` becomes a TS2344 compile
error. For a verb-owned token that is the `CommandPrivateReason` union (`:265-279`):

```ts
  // RESV-05: the skipped dependency is recorded but disabled, so it
  // materialized nothing. It joins `already installed` in the same brace and
  // is what lifts that row off the benign-skip default.
  | "dependency disabled"
```

**Decide deliberately whether the new token is idempotent.** `IDEMPOTENT_REASONS` (`:53-61`) is the
runtime `Set` `skipSeverity` tests against. A promotion **mutates state**, so the row is not a
`skipped` row at all and the token should stay OUT of that set — which is exactly the tri-state
argument D-04-07 used to reject reusing `already installed`.

**3c. The emitting module — `orchestrators/plugin/install.messaging.ts`.** No new module. The arm
being superseded is `classifyEntityShapeError`'s, at `:368-376`:

```ts
  switch (err.shape.kind) {
    case "already-installed":
      return {
        kind: "entity-error",
        name: ctx.plugin,
        marketplace: ctx.marketplace,
        scope: ctx.scope,
        status: "failed",
        reasons: ["already installed"] as const,
      };
```

For the row-construction shape of a token riding a normal (non-error) row, the closest analog is
`install-cascade.messaging.ts:220-230` — note it computes severity from the reason set rather than
asserting one:

```ts
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
```

**Critical placement constraint (from RESEARCH, restated because it decides the design):** today's
`already-installed` throw is on the **non-mutating** arm of `install-flow.ts`, and that file saves
only on its mutating arm (`WR-04: the SOLE mutating arm saves explicitly`, visible at
`install-flow.ts:1365`). A promotion written at the throw site is silently discarded. The promotion
must land on the mutating arm.

**3d. `docs/output-catalog.md`** — the row + its `catalog-state` anchor + a prose paragraph
explaining why this token and not another. Copy this section verbatim as the template
(`docs/output-catalog.md:807-821`):

```markdown
### Dependency cascade -- the skipped dependency is disabled (RESV-05)

<!-- catalog-state: dependency-cascade-disabled-skip -->

```text
A plugin operation needs attention.

● official [user]
  ● helper v1.0.0 (installed)
  ⊘ linter@tools v3.0.0 (skipped) {already installed, dependency disabled}

/reload to pick up changes
```

The same skip, against a record that is DISABLED. … `{already installed}` alone is in the
idempotent closed set and would report that as fine; `{dependency disabled}` names it, and
`skipSeverity` reads the pair and computes `warning`, which raises the block. …
```

Markdown is formatted by **`mdformat` via pre-commit**, not prettier (`format:check` covers only
js/json/ts). Never run `prettier --write` on it.

**3e. `tests/architecture/catalog-uat/fixtures/plugin-install.ts`** — one fixture keyed by the exact
`catalog-state` name, satisfying `CatalogFixture` (`tests/architecture/catalog-uat/fixture-types.ts`):

```ts
    "dependency-cascade-disabled-skip": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              { status: "installed", name: "helper", version: "1.0.0",
                dependencies: [], severity: "info", needsReload: true },
              { status: "skipped", name: "linter@tools", version: "3.0.0",
                reasons: ["already installed", "dependency disabled"],
                severity: "warning" },
            ],
          },
        ],
      },
    },
```

**3f. `tests/architecture/catalog-uat/catalog-contract.test.ts:37-48`** — bump **two** constants,
with a comment recording the move. `EXPECTED_UTF8_BYTES` is easy to miss and will fail the run:

```ts
const EXPECTED_MODULE_COUNT = 20;
const EXPECTED_SECTION_COUNT = 20;
// WR-06 / DATA-01: +1 state for uninstall's `success-keep-data` row … (191 -> 192).
// RESV-01..06: +12 states for the dependency cascade … (192 -> 204).
// RESV-05: +1 state for the cascade skip whose record is DISABLED -- the
// `{already installed, dependency disabled}` brace and the warning it raises
// (204 -> 205).
const EXPECTED_STATE_COUNT = 205;
const EXPECTED_UTF8_BYTES = 27_293;   // <- also moves; recompute from the file
```

**3g. `tests/architecture/notify-closed-set-locks.test.ts:29-66`** — the length tripwire. The
comment ledger above the assertion is part of the contract; append one entry:

```ts
test("OUT-08: REASONS is the closed 53-entry reason set", () => {
  …
  // RESV-05: +1 for `dependency disabled` -- the marker that lifts a skipped
  // dependency off the benign-skip default when its record is disabled and it
  // therefore materialized nothing for the requesting plugin to install
  // against (52 -> 53).
  assert.equal(REASONS.length, 53);
});
```

The file header states exactly why this test exists and is worth reading before editing it:

```ts
 * These exact-length assertions are the deliberate-bump tripwire … appending a
 * closed-set member forces a conscious update here, which is the prompt to also
 * add its catalog fixture / output-catalog.md row / renderer arm.
 * Bump the expected count in the SAME change that grows the set.
```

**3h. TWO enumeration pins, not one.** Both list the full 53 tokens in order and both must gain the
new member at the tail:

- `tests/architecture/compat-01-no-expansion.test.ts:~214` — the commented, gate-flavoured list.
  Its failure message is itself a contract line: *"COMPAT-01: no reason token may be added,
  removed, or renamed. The order is catalog-stable: a new token appends at the tail and arrives
  with its catalog row, renderer arm, and fixture in the same change."*
- `tests/shared/notification-types.test.ts:19-72` — `EXPECTED_REASONS`, a bare uncommented list.
  Easy to miss because it is not under `tests/architecture/`.

**Checklist for the planner — nine surfaces, one commit:** `notification-types.ts`,
`notify-reasons.ts` (header prose + partition union), the emitting messaging module,
`docs/output-catalog.md`, the catalog fixture, `catalog-contract.test.ts` (two constants),
`notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`,
`tests/shared/notification-types.test.ts`.

---

### 4. `orchestrators/reconcile/plan.ts` — the exemption (D-04-05)

**Analog:** `buildUninstallBucket`'s own two `continue` guards. The exemption is a third one, in the
inner loop, in the same style.

```ts
// extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:484-510
function buildUninstallBucket(
  state: ExtensionState,
  scope: Scope,
  marketplaceDiff: MarketplaceDiff,
  declaredPluginKeys: ReadonlySet<string>,
): PlannedPluginUninstall[] {
  const uninstall: PlannedPluginUninstall[] = [];
  const retainedMarketplaces = new Set(marketplaceDiff.recordedByDeclared.values());
  for (const [mpName, mpRecord] of Object.entries(state.marketplaces)) {
    if (marketplaceDiff.conflictedRecorded.has(mpName)) {
      continue;
    }

    if (!retainedMarketplaces.has(mpName)) {
      continue;
    }

    for (const pluginName of Object.keys(mpRecord.plugins)) {
      const key = `${pluginName}@${mpName}`;
      if (!declaredPluginKeys.has(key)) {
        uninstall.push({ scope, plugin: pluginName, marketplace: mpName });
      }
    }
  }

  return uninstall;
}
```

`mpRecord` is bound by the OUTER loop; the INNER loop iterates `Object.keys`, so the record is
**reachable but not bound**. Change `Object.keys(mpRecord.plugins)` to
`Object.entries(mpRecord.plugins)` — matching the outer loop's own style — and read
`record.provenance` off the bound value. No new state is threaded in, and
`tests/architecture/reconcile-planner-purity.test.ts` stays green because reading a field off a
record the function already holds imports nothing.

**Measured budget:** fallow `6/10 → 7/11`, ESLint sonarjs `10 → 11`, ceilings `20/15`. Four points
of headroom. **Use the inline condition, not a named helper** — a helper adds a function the
100%-run-alone branch-coverage rule (C12) must reach for no benefit.

---

### 5. The two config-write arms (D-04-02, step 3 only)

**5a. The standalone arm** (`install-flow.ts:1319-1350`). Both the `dependencyPluginPatches`
property and its entire comment block go; `pluginPatch` and everything above it stays:

```ts
      if (opts.notifications?.mode !== "orchestrated") {
        await writeAdoptingConfigEntries({
          current, sibling, state, marketplace, plugin,
          targetConfigPath,
          scopeRoot: locations.scopeRoot,
          // DFEN-04: the plugin key alone unless the install actually landed
          // disabled, in which case the declaration carries it through.
          // …
          pluginPatch: { ...(disabledInstall.landed && { enabled: false }) },
          // RESV-01's reload clause: declare every member the cascade newly   <-- DELETE
          // installed, in the SAME batched patch … D-03-05 / D-03-06 …        <-- DELETE
          dependencyPluginPatches: Object.fromEntries(                          // <-- DELETE
            installed.members.map((member) => [member.key, {}]),                // <-- DELETE
          ),                                                                    // <-- DELETE
        });
```

**C8 applies:** the removed comments cite "RESV-01's reload clause" as their justification. The
justification moves to provenance. Do **not** replace them with a narration of what was removed
(`the former dependency declaration…`) — that is explicitly forbidden by
`.claude/rules/typescript-comments.md`.

**5b. The orchestrated arm** (`install-flow.ts:1351-1362`) — `dependencyKeys` goes:

```ts
      } else {
        await writeOrchestratedDeclarations({
          current, targetConfigPath, scopeRoot: locations.scopeRoot,
          plugin, marketplace, rootKey,
          dependencyKeys: installed.members          // <-- DELETE
            .map((member) => member.key)             // <-- DELETE
            .filter((key) => key !== rootKey),       // <-- DELETE
          landedDisabled: disabledInstall.landed,
        });
      }
```

**5c. `writeOrchestratedDeclarations` (`install-flow.ts:421-453`) does NOT become dead — it loses
one argument and half its body.** Here it is today:

```ts
async function writeOrchestratedDeclarations(args: {
  readonly current: Parameters<typeof writeBatchedConfigEntries>[0];   // <-- Pitfall F lives here
  readonly targetConfigPath: string;
  readonly scopeRoot: string;
  readonly plugin: string;
  readonly marketplace: string;
  readonly rootKey: string;              // <-- becomes unused
  readonly dependencyKeys: readonly string[];   // <-- removed
  readonly landedDisabled: boolean;
}): Promise<void> {
  if (args.dependencyKeys.length === 0) {
    if (args.landedDisabled) {
      await writePluginConfigEntry(
        args.current, args.targetConfigPath, args.scopeRoot,
        args.plugin, args.marketplace, { enabled: false },
      );
    }

    return;
  }

  await writeBatchedConfigEntries(args.current, args.targetConfigPath, args.scopeRoot, {
    plugins: {
      ...Object.fromEntries(args.dependencyKeys.map((key) => [key, {}])),
      ...(args.landedDisabled && { [args.rootKey]: { enabled: false } }),
    },
  });
}
```

What survives is the early-return body alone — *"if the install landed disabled, write the single
`enabled: false` entry."* Concretely: drop `dependencyKeys` and `rootKey` from the parameter type,
drop the `if (args.dependencyKeys.length === 0)` wrapper and the trailing
`writeBatchedConfigEntries` call, keep the `writePluginConfigEntry` call.

**Pitfall F, made concrete:** `Parameters<typeof writeBatchedConfigEntries>[0]` on line 422 keeps
the import type-referenced after its only *value* use is deleted, so neither ESLint
`no-unused-vars` nor fallow `dead-code` will report it. **Rewrite that type expression in the same
task** — to `Parameters<typeof writePluginConfigEntry>[0]` or to the named `ScopeConfig`
(`shared.ts` already uses `ScopeConfig` directly, see 5d).

Its doc comment (`install-flow.ts:405-420`) ends with the rationale that disappears with the arm:

```ts
 * The stamp ALONE goes through `writePluginConfigEntry`, SPLIT-02 / D-102-09's
 * sole sanctioned single-entry writer. It is not interchangeable with the
 * batched one here: the batched writer always emits a `marketplaces` key, so
 * routing the stamp through it would add `"marketplaces": {}` to a file that
 * declares none. The batched writer earns its place only when several keys must
 * land in ONE atomic save, which is the cascade case.   <-- last sentence goes
```

**5d. `writeAdoptingConfigEntries` (`shared.ts:805-833`) — remove the PARAMETER, not just the
call-site argument** (Pitfall G: an unused optional property on an inline object-literal parameter
type is reported by nothing):

```ts
export async function writeAdoptingConfigEntries(opts: {
  readonly current: ScopeConfig;
  readonly sibling: ScopeConfig | undefined;
  readonly state: ExtensionState;
  readonly marketplace: string;
  readonly plugin: string;
  readonly targetConfigPath: string;
  readonly scopeRoot: string;
  readonly pluginPatch: Partial<PluginConfigEntry>;
  readonly dependencyPluginPatches?: Record<string, Partial<PluginConfigEntry>>;  // <-- DELETE
}): Promise<void> {
  const adoptedSource = synthesizeAdoptedMarketplaceSource({ … });

  await writeBatchedConfigEntries(opts.current, opts.targetConfigPath, opts.scopeRoot, {
    ...(adoptedSource !== undefined && {
      marketplaces: { [opts.marketplace]: { source: adoptedSource } },
    }),
    plugins: {
      ...opts.dependencyPluginPatches,          // <-- DELETE
      [`${opts.plugin}@${opts.marketplace}`]: opts.pluginPatch,
    },
  });
}
```

Three doc paragraphs above it (`shared.ts:790-804`) lose their subject and go with the code — the
`dependencyPluginPatches` paragraph and the whole D-03-06 paragraph:

```ts
 * `dependencyPluginPatches` carries the keys a dependency cascade newly
 * installed alongside the requesting plugin (RESV-01's reload clause: …).
 * It is spread UNDER the requesting plugin's own entry, so a key appearing in
 * both resolves in the requesting plugin's favour.
 *
 * D-03-06 is satisfied by construction and needs no per-member logic here: …
```

`enable-disable.ts:100,216,224` already call this function **without** the parameter, so the
post-removal signature is the shape those three call sites already use.

---

### 6. The two record constructors (PROV-01 write sites)

**`install-outcome.ts:936-986`** — the object literal. `installedAt` on line 984 is the exact
`existing?.X ?? …` idiom to mirror, and its comment explains why the idiom is correct on the
re-materialization path:

```ts
        // ENBL-02: always set enabled: true on install and re-materialization.
        // The disable branch sets it to false; the enable branch re-runs
        // statePhase (via runInstallLedger), which resets it to true here.
        enabled: true,
        // D-54-01 / ENBL-02: on re-materialization (allowExistingRecord),
        // PRESERVE the original installedAt -- the record was never
        // uninstalled, only disabled. Fresh installs stamp now.
        installedAt: existing?.installedAt ?? nowIso,
        updatedAt: nowIso,
```

Write `provenance: existing?.provenance ?? <from options>`. This is what makes the enable path
(`enable-disable.ts:314-331`, which hand-builds its options object and never calls
`buildInstallLedgerOptions`) preserve provenance **without the enable branch knowing the field
exists**, and it lets the new `InstallLedgerOptions` member stay optional.

**`reinstall-record.ts:128-145`** — carry-forward. `installedAt` on line 143 is the one-line shape:

```ts
    ...(input.hookEntries !== undefined && { hookEntries: [...input.hookEntries] }),
    enabled: true,
    installedAt: input.oldRecord.installedAt,      // <- provenance: input.oldRecord.provenance
    updatedAt: new Date().toISOString(),
```

**Decision site** (`install-flow.ts:1181-1191`) — `member.key === rootKey` is already the
discriminant in scope; the threading is one property added to the `buildInstallLedgerOptions` call:

```ts
        ledgerOptionsFor: (member) => {
          const pinVersion =
            member.pinnedVersion ?? (member.key === rootKey ? opts.pinVersionOverride : undefined);
          return buildInstallLedgerOptions(opts, {
            scope, cwd,
            marketplace: member.marketplace,
            plugin: member.name,
            ...(member.pinnedOid !== undefined && { sourcePin: member.pinnedOid }),
            ...(pinVersion !== undefined && { pinVersion }),
          });
        },
```

**Sites that need NO change** (all are in-place mutation or spread, per the RESEARCH census):
`toDisabledRecord` (spread), `enable-disable.ts:418`, `install-disable-cascade.ts:93`,
`update-swap.ts:665-691`, `update-preflight.ts:439-462`, `install-cascade.ts:~705`.

---

### 7. Test patterns — plant the violation, and always pair the negative control

The house rule (`CONVENTIONS.md`): *"A gate wants a test that plants the violation, not one that
reads the config."* This phase needs it twice.

**7a. The falsifiability mechanic — `tests/architecture/source-scan.ts`.** The canonical in-repo
example of a gate that inspects real artifacts rather than asserting a rule object exists. Two
details from its header are worth copying into any new scanning clause:

```ts
 * Every read goes through the `node:fs/promises` API rather than a subprocess
 * line tool (D-98-10). A `grep`-style subprocess treats a file it classifies as
 * binary as unprintable and reports nothing, which would green a gate on a file
 * it never actually inspected …
 *
 * This file registers no case of its own.   // <- importing a *.test.ts under node:test
                                             //    double-registers its cases (D-98-09)
```

**7b. The exemption's positive + negative pair — `tests/orchestrators/reconcile/plan.test.ts`.**
The suite's established shape is arrange / act / assert with a **whole-result**
`assert.deepStrictEqual` against an independently-built expectation — which is what makes an
over-broad exemption visible, because an extra retained record shows up as a missing
`pluginsToUninstall` entry in a structure that also pins four other buckets:

```ts
  test("returns every nonempty bucket in deterministic input order", () => {
    // arrange
    const merged = mergedConfig({ … }, { … });
    const state = stateWith({
      keep: marketplaceRecord("keep", githubSource("acme/keep"), {
        enable: pluginRecord(false),
        "uninstall-zeta": pluginRecord(true),
        "uninstall-alpha": pluginRecord(true),
      }),
      …
    });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, {
      scope: "project",
      …
      pluginsToUninstall: [
        { scope: "project", plugin: "uninstall-zeta", marketplace: "keep" },
        { scope: "project", plugin: "uninstall-alpha", marketplace: "keep" },
      ],
      …
    });
  });
```

Build BOTH cases in one state: an undeclared `provenance: "dependency"` record that is absent from
`pluginsToUninstall`, and an undeclared `provenance: "explicit"` record that is still present.
**A test that only proves the dependency is kept passes against an exemption that keeps
everything.**

**7c. The fixture builder is the fixture-sweep lever.** `pluginRecord` at
`tests/orchestrators/reconcile/plan.test.ts:61-90` is the per-file shared builder. RESEARCH measured
276 failures in `update-flow.test.ts` collapsing from **2** compiler diagnostics — because that file
has a builder like this one. The mechanical half of step 1 is "find each file's builder and add the
field there," not "fix 861 assertions."

```ts
function pluginRecord(
  enabled: boolean,
  options: { readonly installable?: boolean; readonly skills?: readonly string[];
             readonly unsupported?: readonly string[] } = {},
): PluginRecord {
  …
  return {
    version: "1.0.0",
    resolvedSource: "/plugins/plugin-a",
    compatibility: { … },
    resources: { … },
    // enabled / installedAt / updatedAt follow -- provenance joins them here
  };
}
```

Give it a `provenance` option defaulting to `"explicit"` so the two D-04-05 cases can differ without
touching every call site.

**7d. PROV-02's proof (Pitfall D).** Snapshot with `clonePluginRecord` before the second install and
`assert.deepStrictEqual` the **whole** post-record against the snapshot. A `provenance === "explicit"`
assertion alone would pass against a cascade that rewrote every other field. To plant the violation,
temporarily relax the `!isRoot &&` guard at `domain/dependency-closure.ts:269` and observe the red.

---

## Shared Patterns

### Comment anchoring (applies to every file this phase touches)

**Source:** `.claude/rules/typescript-comments.md` + `.planning/codebase/CONVENTIONS.md`
**Apply to:** every comment and test title written in this phase.

- Anchor on `D-04-01` … `D-04-08`. **Never bare `PROV-NN`** (D-04-08) — it means *git auth
  provider*, 48 citations, and `install-flow.ts:252` already cites `PROV-03` for the auth notify
  seam.
- Cite existing anchors freely when the surrounding code already does: `ENBL-02`, `RESV-01`,
  `RESV-05`, `D-03-05`, `COMPAT-01`, `CR-01`, `WR-04`.
- **Forbidden:** narrating removed code. `the former dependency declaration…`, `X used to…`,
  `byte-identical to what came before`. Where the removed shape carried the rationale, restate the
  rationale as a present-tense fact about the current code.
- **Forbidden:** `Phase N`, `Plan N`, `Wave N`, `Pitfall N`, `milestone vX.Y`.

### The dual complexity ceiling

**Source:** `.fallowrc.json` (`health.maxCognitive: 15`, `maxCyclomatic: 20`, `maxUnitSize: 60`,
`maxCrap: 0`) and `eslint.config.js:77` (`sonarjs/cognitive-complexity: 15`).
**Apply to:** `migrate.ts` (**zero headroom after this phase**) and `plan.ts` (four points).
The two tools compute different scores. A green `npm run lint` is not evidence about
`npm run fallow`. Run both on any `migrate.ts` task.

### Doc formatting

**Source:** `.pre-commit-config.yaml`
**Apply to:** `docs/output-catalog.md`, `docs/dependency-resolution.md`, `README.md`.
Markdown goes through `mdformat`, not prettier. `npm run format:check` covers only js/json/ts, so
these files are only checked by `pre-commit run --all-files` — which is not installed as a git hook
in this checkout and must be run by hand before every commit.

---

## No Analog Found

None. Every change in this phase has a named in-tree precedent.

The closest thing to a gap is **D-04-07's promotion behavior itself** — no promotion path exists
today, so the *control flow* (mutating-arm placement, config write of the newly-explicit key) has no
direct analog. Its two halves each do, though: the row construction follows
`install.messaging.ts:368`, and the config write of a single explicit key follows
`writePluginConfigEntry` as used inside `writeOrchestratedDeclarations`
(`install-flow.ts:427-435`) — which, per §5c, is the *only* thing that function still does after
step 3.

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{persistence,orchestrators,shared,domain}/`,
`tests/{architecture,orchestrators,persistence,shared}/`, `docs/`
**Files read this pass:** 16 (all git-tracked; no gitignored mirror paths emitted)
**Pattern extraction date:** 2026-09-15
