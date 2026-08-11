# Phase 100: Disabled-plugin information retention - Pattern Map

**Mapped:** 2026-08-11
**Files analyzed:** 12 production edit sites + 8 test/doc edit sites (0 new production files)
**Analogs found:** 20 / 20

> **Read `100-RESEARCH.md` first.** It already quotes verbatim: the `resolvedSha` schema
> declaration (`state-io.ts:62-68`), the `removePluginRecord` exclusion call at
> `reinstall.ts:1221-1225`, the `StateOnlyHookRead` discriminant (`info.ts:535-538`), the
> unguarded hydrate loop (`event-router.ts:589-616`), the current `toDisabledRecord` body
> and the `PluginDisabledMessage` interface + its render arm. **This document does not
> repeat those.** It adds the five things RESEARCH is thin on:
>
> 1. Edit-site analogs — for each modification, the closest prior change of the same shape.
> 2. Test setup/fixture idioms for the six Wave 0 gaps.
> 3. One complete catalog-state + byte-fixture pair, end to end.
> 4. The FSTAT-07 `Extract` widening as a **diff-shaped** analog (every site that moved).
> 5. The closest prior "message interface gains an optional field, renderer threads it".

---

## File Classification

This phase creates **no new production files**. Every production deliverable is an edit to
an existing file, so the useful classification axis is *edit shape*, not *role*.

| File (modified) | Layer | Edit Shape | Closest Prior Edit of the Same Shape | Match |
|---|---|---|---|---|
| `persistence/state-io.ts` (schema) | persistence | additive optional typebox key | `resolvedSha` (D-77-02) at `:62-68` | exact |
| `persistence/state-io.ts` (`toDisabledRecord`) | persistence | producer signature made generic | none in tree — **no analog** | none |
| `orchestrators/plugin/install.ts:863` | orchestrator | wrap guard arg in `removePluginRecord` | `update.ts:1852-1860`, `reinstall.ts:1221-1225` | exact ×2 |
| `orchestrators/plugin/shared.ts` (hoist) | orchestrator | de-duplicate two identical privates into the shared tier | `assertNoCrossPluginConflicts` already lives there | role-match |
| `orchestrators/plugin/{install,update,reinstall}.ts` (write sites) | orchestrator | new record field written beside `resources.hooks` | `update.ts:1733` / `reinstall.ts:1724` conditional | exact |
| `orchestrators/plugin/reinstall.ts:2009-2034` (`clonePluginRecord`) | orchestrator | field-enumerating clone gains the new optional key | `resolvedSha` conditional spread at `:2013-2015` | exact |
| `bridges/hooks/event-router.ts:594` | bridge | `continue` guard on `isRecordedButDisabled` | `plugin-path.ts:24,:40` (predicate-read sites) | role-match |
| `orchestrators/plugin/info.ts` (fallback ladder) | orchestrator | branch above an existing disk read, returning the same discriminant | `readStateOnlyHookEntries`' own three arms (`info.ts:540-600`) | exact |
| `orchestrators/plugin/info.ts:2073` (partition) | orchestrator | stop diverting an arm; delete 4 downstream branches | none — **no analog** (a collapse, not an addition) | none |
| `orchestrators/plugin/info.ts` (`InfoBlock` carrier) | orchestrator | producer-reported discriminator field | `InfoBlock.stateOnly` (`info.ts:776-791`) | exact |
| `shared/notify.ts:1337` (`Extract` widening) | shared | per-surface status-subset widening + glyph arm | FSTAT-07 `partially-installed`; RSTA-01 `remote` | exact ×2 |
| `shared/notify.ts:775-781` (`reasons?`) | shared | message interface gains an optional field, renderer threads it | WR-12 on `PluginUpdatedMessage` (`cb90762a`) | exact |
| `tests/architecture/compat-01-no-expansion.test.ts:342` | test | key-set lock amended by one insertion | `resolvedSha`'s own entry in the same list | exact |
| `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` | doc+test | new catalog state + byte fixture, same commit | `state-only-installed-with-hooks` pair | exact |

---

## Pattern Assignments

### A. `persistence/state-io.ts` — the new optional key

**Schema:** RESEARCH quotes `resolvedSha` verbatim. Do not re-read it. Two things RESEARCH
does not show:

**A1 — the preservation test template** (`tests/persistence/state-io.test.ts:472-487`).
This is the exact test the new key needs, one-for-one. Note it builds a *full*
`PluginInstallRecord` literal (no factory) and asserts two things only:

```ts
test("D-77-02 toDisabledRecord preserves resolvedSha through the disable transform", () => {
  const fullSha = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
  const record: PluginInstallRecord = {
    version: "sha-a1b2c3d4e5f6",
    resolvedSource: "https://github.com/o/r",
    resolvedSha: fullSha,
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: { skills: ["s"], prompts: [], agents: [], mcpServers: [], hooks: [] },
    enabled: true,
    installedAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
  const disabled = toDisabledRecord(record, "2025-02-02T00:00:00.000Z");
  assert.equal(disabled.resolvedSha, fullSha);
  assert.equal(disabled.enabled, false);
});
```

Copy the whole shape; swap `resolvedSha` for the new key and `assert.equal` for
`assert.deepEqual`.

**A2 — `toDisabledRecord`'s generic form has NO analog in this tree.** No other exported
function in `persistence/` or `orchestrators/` is generic in a sub-shape of its input. The
executor is writing a first instance; the acceptance signal is the rewritten
`@ts-expect-error` test at `tests/persistence/state-io.test.ts:691-714`, not a copied
pattern. Keep the `EnabledPluginRecord` half of that test unchanged (`:703-713`).

---

### B. `install.ts:863` — the conflict-guard exclusion

RESEARCH quotes the `reinstall.ts` call form. What it does not show is that the **two
copies to be hoisted are byte-identical apart from one local name and one comment** — which
is why `sonarjs/no-identical-functions` fires on a third:

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:3037-3056
function removePluginRecord(
  state: ExtensionState, marketplace: string, plugin: string,
): ExtensionState {
  const cloned: ExtensionState = {
    schemaVersion: state.schemaVersion,
    marketplaces: { ...state.marketplaces },
  };
  const mp = cloned.marketplaces[marketplace];
  if (mp === undefined) { return cloned; }

  const newPlugins = { ...mp.plugins };          // reinstall.ts:2054 names this `plugins`
  // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- newPlugins is a Record<string,...>.
  delete newPlugins[plugin];
  cloned.marketplaces[marketplace] = { ...mp, plugins: newPlugins };
  return cloned;
}
```

**Hoist target:** `orchestrators/plugin/shared.ts` — the file that already exports
`assertNoCrossPluginConflicts` (`:695-712`) and `collectOwners` (`:623-649`). Export it
with an explicit return type (`explicit-module-boundary-types` is an error) and keep the
`no-dynamic-delete` disable comment; reword it to name the shared-helper context rather
than either local variable name.

---

### C. `reinstall.ts::clonePluginRecord` — the field-enumerating clone

RESEARCH flags this as a pitfall but does not show that the correct idiom is already one
line away, in the same function. `clonePluginRecord` (`reinstall.ts:2009-2034`) handles its
*other* optional key by conditional spread:

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:2009-2015
function clonePluginRecord(record: PluginRecord): PluginRecord {
  return {
    version: record.version,
    resolvedSource: record.resolvedSource,
    // PURL-07 / D-78-02: preserve the recorded resolvedSha across the snapshot so
    // reinstall's recorded-sha probe (and the carry-forward rewrite) see the pin.
    ...(record.resolvedSha !== undefined && { resolvedSha: record.resolvedSha }),
```

Copy that spread form exactly (it is what `exactOptionalPropertyTypes` requires), plus a
deep copy of the entries array in the style of the `hooks: [...record.resources.hooks]`
line at `:2028`.

---

### D. `bridges/hooks/event-router.ts` — the hydrate guard

**Import to add** (the file currently has none from `persistence/state-io.ts`):
`isRecordedButDisabled`. Place it in the internal-import group, alphabetized.

**Guard spelling — mandatory.** The whole-tree drift gate
(`tests/orchestrators/reconcile/plan.test.ts:793-800`) rejects all six twin spellings by
regex. The only accepted form is the predicate call:

```ts
if (isRecordedButDisabled(pluginRecord)) {
  continue;
}
```

**Analog for the read site:** `orchestrators/plugin-path.ts:24,:40` — the other bridge-tier
consumer that reads disabled-ness through the predicate rather than the boolean.

---

### E. `shared/notify.ts:1337` — the `Extract` widening, diff-shaped

This has been done **twice**. The FSTAT-07 pass (`c695bdab`) is the one CONTEXT cites;
here is the actual diff, showing that the widening is a **two-hunk unit** — the type and
the glyph arm always move together:

```diff
@@ notify.ts — hunk 1: PluginInfoRowBase
 interface PluginInfoRowBase {
-  readonly status: Extract<PluginStatus, "installed" | "available" | "unavailable" | "failed">;
+  // FSTAT-07 / D-66-04: `force-installed` widens the info row status set so an
+  // installed plugin re-resolving `unsupported` reports `(force-installed)` on
+  // the info surface. `force-upgradable` is deliberately omitted -- it is a
+  // list-inventory-only concept (an installed plugin's info is force-installed
+  // or installed, never force-upgradable).
+  readonly status: Extract<
+    PluginStatus,
+    "installed" | "available" | "unavailable" | "unsupported" | "failed" | "force-installed"
+  >;
```

```diff
@@ notify.ts — hunk 2: pluginInfoStatusGlyph (SAME COMMIT)
 function pluginInfoStatusGlyph(status: PluginInfoRow["status"]): string {
   switch (status) {
     case "installed":
       return ICON_INSTALLED;
+    case "force-installed":
+      // FSTAT-02 / FSTAT-07 / D-66-03: info row for an installed plugin
+      // re-resolving `unsupported` -- the dedicated `◉` glyph.
+      return ICON_FORCE_INSTALLED;
     case "available":
       return ICON_AVAILABLE;
```

**Sites that move with the widening — the full checklist, derived from that commit and the
later RSTA-01 `remote` widening (`051914b3`):**

1. `PluginInfoRowBase.status`'s `Extract` list (`notify.ts:1337`) — add `"disabled"`.
2. The rationale comment directly above it (`notify.ts:1332-1336`) — extend, do not replace.
   The existing text explains why `partially-upgradable` is omitted; the new sentence must
   say why `disabled` is now included and remains a *per-surface subset widening*, not a new
   token.
3. `pluginInfoStatusGlyph` (`notify.ts:3243-3269`) — add `case "disabled": return ICON_DISABLED;`
   before the `default: assertNever(status)`. Both prior widenings placed the new arm
   adjacent to its nearest sibling and gave it a one-line ID-citing comment.
4. **Not needed** (both prior widenings did touch these; this one does not, and RESEARCH
   confirms it): `PLUGIN_STATUSES` (`notify.ts:472-509`) and the COMPAT-01 / SNM-02 locks.
   `disabled` is already member 15 of 19. Do not add a glyph constant — `ICON_DISABLED`
   (`notify.ts:1592`) is reused verbatim, so the `no eighth glyph export` clause
   (`compat-01-no-expansion.test.ts:301`) stays green.

**Note on the FSTAT-07 comment text:** the quoted `force-installed` / `unsupported`
vocabulary was later renamed to `partially-installed` / `partially-available` by
`719605b7`. The **current** text at `notify.ts:1332-1336` uses the renamed vocabulary —
RESEARCH quotes it correctly. Use the current file as the text baseline, this diff as the
shape baseline.

---

### F. `PluginDisabledMessage` gains `reasons?` — the closest prior example

**Analog: `cb90762a` (`feat(99): name a degraded skill on the plugin update row`, WR-12).**
This is the nearest match in both shape and recency: a `Plugin*Message` interface that
documented itself as reason-free gains an optional `reasons` field, and the renderer arm
swaps a hard-coded `undefined` for `p.reasons`. Both halves, verbatim:

```diff
@@ notify.ts — the interface + its JSDoc
 /**
  * `(updated)` -- update cascade row. Carries REQUIRED `from` / `to`
  * so the renderer can compose the `v1.0 → v1.2` arrow form;
- * `dependencies` REQUIRED; no `reasons`.
+ * `dependencies` REQUIRED.
+ *
+ * WR-12: `reasons` is OPTIONAL here, exactly as on `PluginInstalledMessage` and
+ * `PluginReinstalledMessage` and for the same reason. An update drives the same
+ * bridges as an install, so a component whose source frontmatter no longer
+ * parses degrades identically, and the row that reports the transition has to be
+ * able to name it (WARN-01 / D-86-03). Absent `reasons` renders the legacy
+ * brace-less row byte-for-byte: `composeReasons` returns `""` for an undefined
+ * list and `joinTokens` collapses the empty slot.
  */
 export interface PluginUpdatedMessage extends TransitionMessageBase {
   ...
   readonly scope?: Scope;
+  readonly reasons?: readonly ContentReason[];
 }
```

```diff
@@ notify.ts — the renderer arm
+    // `updated` -- WR-12 threads the optional `reasons` brace exactly as the
+    // `installed` and `reinstalled` arms do, so an update that degraded a
+    // component names the kind instead of rendering a bare success row over it.
+    // Soft-dep markers append into the SAME brace per MSG-GR-4.
     case "updated":
       return joinTokens([
         ...
         composeReasons(
-          undefined,
+          p.reasons,
           p.dependencies.includes("agents"),
           p.dependencies.includes("mcp"),
```

**Four things to copy from this analog, in order:**

1. **The JSDoc rewrite is part of the diff, not a follow-up.** WR-12 deleted the
   `no \`reasons\`` clause and replaced it with a paragraph naming (a) the requirement, (b)
   the sibling interfaces that already carry the field, (c) **the byte-compatibility
   argument** — absent field ⇒ `composeReasons` returns `""` ⇒ `joinTokens` collapses the
   slot ⇒ legacy rows render byte-for-byte. Phase 100's `PluginDisabledMessage` JSDoc
   (`notify.ts:752-775`) must get the same treatment; the paragraph asserting the absent
   field makes INV-04 *structural* is the sentence being retired, and its replacement must
   say what now keeps ENBL-15 structural instead (answer: the `false, false` soft-dep
   arguments stay hard-coded in the render arm).
2. **Field placement:** last in the interface, after the other optionals.
3. **`readonly reasons?: readonly ContentReason[]`** — the exact spelling used at six other
   sites (`notify.ts:688, 712, 732, 1134, 1158, 1352`).
4. **The renderer arm keeps its comment in sync.** The `disabled` arm's comment at
   `notify.ts:2408-2414` currently states `NO reasons -- the variant carries none;
   composeReasons receives undefined + both soft-dep flags false`. Half of that sentence
   survives (the soft-dep half, which is ENBL-15's structural guarantee) and half is
   reversed. Rewrite it as one statement rather than deleting it.

---

### G. `InfoBlock` fetch-skip carrier

Copy the discriminator pattern the file already argues for at `info.ts:776-791`:

```ts
interface InfoBlock {
  readonly block: PluginInfoMessage;
  /** The block came from `buildStateOnlyInstalledRow` (there is nothing to fetch). */
  readonly stateOnly: boolean;
}
```

Its doc comment ("reported by the producer rather than re-derived from the rendered row… A
discriminator costs one field and cannot drift") is the rationale to extend, not restate,
when the field becomes a `skipReason?: ContentReason`.

---

## Shared Patterns

### The catalog-state + byte-fixture pair — one complete example, end to end

This is the pattern most likely to half-land. The ENBL-17 deliverable is a **new
info-surface** state, so the correct template is `state-only-installed-with-hooks`, not the
list-surface `disabled-inventory` state. All three parts ship in **one commit**.

**Part 1 — prose paragraph** (`docs/output-catalog.md:1592`, immediately above the marker).
Written in Simplified-English house style: short sentences, states what triggers the state,
what each line comes from, what is deliberately absent, and closes with the severity /
reload-hint sentence.

```markdown
### Success -- hooks listed from the materialized configuration (INFO-11)

The installation record keeps only the name of the hooks container, not the hook entries.
Thus the hook entries come from the materialized configuration that the extension wrote at
install time, and not from the plugin's source declaration. [...] Severity `info`; no
reload-hint (read-only surface).
```

**Part 2 — the annotated fenced block** (same file, directly after the prose). The comment
marker and the fence must be adjacent; the parser
(`catalog-uat.test.ts::loadCatalogExamples`) pairs a marker with **the next fence in the
same H2 section**.

~~~~markdown
<!-- catalog-state: state-only-installed-with-hooks -->

```text
● mp [user] <no autoupdate>
  ● alpha v1.0.0 (installed) {not in manifest}
    hooks:
      Stop
      PreToolUse(Bash)
    skills: alpha-skill
```
~~~~

**Part 3 — the fixture** (`tests/architecture/catalog-uat.test.ts`, keyed by the same state
name inside the `/claude:plugin info` section's map). Pure `NotificationMessage` data —
**never** synthesized from a domain helper (SNM-31 scope gate at the file header):

```ts
    "state-only-installed-with-hooks": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "installed",
          name: "alpha",
          version: "1.0.0",
          reasons: ["not in manifest"],
          componentsResolved: true,
          components: {
            hooks: [{ event: "Stop" }, { event: "PreToolUse", matcher: "Bash" }],
            skills: ["alpha-skill"],
          },
        },
      } satisfies NotificationMessage,
    },
```

Every fixture in the file carries `pi: piWithBothLoaded()`, a leading `// <ID>:` comment,
and `satisfies NotificationMessage` on the info-surface arm. Warning-severity states add
`expectedSeverity: "warning"` (see `disabled-fetch-skipped` at `catalog-uat.test.ts:3059`).

**For the new disabled-info state**, the fixture is this one with `status: "disabled"`, a
`description`, and `reasons: ["not in manifest"]`. The prose must also **replace** the
existing info-surface disabled paragraph at `docs/output-catalog.md:1688`, whose last
sentence currently reads *"Byte form: see the list section's `disabled-inventory` state"* —
that cross-reference is what the reroute retires.

### Test-harness idiom — orchestrator suites (`info`, `list`, `enable-disable`)

Every orchestrator suite that byte-compares notify output uses the **same three helpers**.
Reuse the ones already in the target file; do not re-invent.

**Notify capture** (`tests/orchestrators/plugin/info-manifest-absent.test.ts:62-83`):

```ts
interface NotifyRecord { message: string; severity?: string; }

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
}
```

**Hermetic tmpdir, NOT `memfs`** (`:88-110`). Orchestrator suites use real tmpdirs with
`HOME` redirected and a retrying `rm` (a recursive `rm` races lingering async writes and
hits `ENOTEMPTY`). `memfs` is for `tests/persistence/` and `tests/platform/` only.

**Byte assertion** — whole-message equality against a `join("\n")` literal, never a partial
regex. From `tests/orchestrators/plugin/list.test.ts:1069` (the ENBL-06 / INV-04 test this
phase must amend):

```ts
    assert.equal(
      out,
      [
        "● mp1 [user]",
        "  ◍ alpha v1.0.0 (disabled)",
        "  ◉ beta v1.0.0 (partially-installed) {lsp}",
      ].join("\n"),
    );
```

Its header comment states the rule: *"The byte form IS the contract: one join proves both
status tokens, the brace asymmetry, and the row order together."* Row-scoped negative
assertions follow the positive one so a regression names itself.

### The state fixture builder — and the one line every Wave 0 test must change

`seedPathMarketplace` (`info-manifest-absent.test.ts:113-260`; near-identical
`seedMarketplace` in `list.test.ts`) is the shared seeder. Its `disabled: true` branch
**hard-codes the retired invariant**:

```ts
      resources:
        info.disabled === true
          ? { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] }
          : {
              skills: [...(override?.skills ?? [`${name}-skill`])],
              ...
            },
      enabled: info.disabled !== true,
```

and its JSDoc (`:117-124`) narrates emptiness as the marker. **Under ENBL-18 this branch is
what blocks every Wave 0 test**: it makes a disabled+populated fixture unexpressible. The
minimal correct edit is to drop the ternary so `disabled` controls only `enabled`, and let
the existing `resources` override supply the inventory — that is exactly the axis the
`resources?: { skills?; prompts?; agents?; mcpServers?; hooks? }` override
(`info-manifest-absent.test.ts:145-158`) was built for. Rewrite the JSDoc paragraph in the
same edit; it is the same retired-invariant narration as `state-io.ts:90-120`.

---

## Wave 0 Gaps — analog per gap

| Gap (from `100-VALIDATION.md`) | Extend this file | Closest existing test to copy | Setup idiom |
|---|---|---|---|
| ENBL-14: disabled record with populated `resources.hooks` is not hydrated | `tests/bridges/hooks/event-router.test.ts` (**exists** — RESEARCH assumption A6 is wrong) | `"WR-01: hydrateProjectScopeForCwd clears phantom project-arm cache entries…"` (`:673-694`) | `beforeEach(_resetForTest)`; seed via `addPluginConfigToCache(scope, mp, plugin, asAbsolutePluginRoot(...), config, new Map())`; assert on `_parsedConfigCacheForTest().size` and `[...cache.values()][0]?.scope`. **The three WR-01 tests all call `hydrateProjectScopeForCwd("/nonexistent/...")`, relying on `loadState` returning `DEFAULT_STATE` on ENOENT — so no test in this file yet writes a real `state.json`.** ENBL-14 is the first that must: borrow `saveState` + `locationsFor` + the hermetic-tmpdir helper from `info-manifest-absent.test.ts:88-110` and `:230-250`. |
| ENBL-15: disabled + populated agents/mcpServers renders the bare row | `tests/orchestrators/plugin/list.test.ts` | `"ENBL-06 / INV-04: a disabled PARTIAL renders bare (disabled) beside…"` (`:1069`) | Same `seedMarketplace` + `makeCtx` + `join("\n")` byte assertion; add `resources: { agents: [...], mcpServers: [...] }` to the disabled record. Note this same test is separately **amended** by ENBL-16. |
| ENBL-12/16/17: the three `info` gaps | `tests/orchestrators/plugin/info-manifest-absent.test.ts` | any test in the file; its header (`:1-31`) states the fixture rule — manifest *absence* is seeded by a manifest that **parses with the name omitted**, not by omitting the manifest file (which is a different state, `(failed) {source missing}`) | `withHermeticHome` + `seedPathMarketplace` + `makeCtx`; whole-message equality. The zero-network `--fetch` counters (`:951+`) use `makeMockGitOps` / `makeMockCredentialOps` from `tests/helpers/` and the `InfoCloneCacheSeam` injection — extend those counters to the rerouted disabled arm rather than writing a new NFR-5 proof. |
| ENBL-17: new disabled-info catalog state + fixture | `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` | `state-only-installed-with-hooks` — the complete 3-part pair above | Same commit for all three parts. Markdown is formatted by **mdformat**, not prettier. |
| ENBL-19: a genuine cross-plugin conflict is still rejected | `tests/orchestrators/plugin/shared.test.ts` | `:100-137` (the pure-helper conflict tests) | Pure unit — no tmpdir, no notify. Local `makePluginRecord(over: { resources?; enabled? })` factory (`:36-55`) builds a schema-complete record; call `assertNoCrossPluginConflicts("user", names, state)` inside a try, then `assert.ok(captured instanceof CrossPluginConflictError)`. Add an `enabled: false` + populated-resources case; the factory already accepts `enabled`. |
| ENBL-10: legacy record without the new key loads unchanged | `tests/persistence/migrate.test.ts` | `"ST-4 migrate fills missing manifestPath + marketplaceRoot (v0 fixture)"` (`:38+`) | JSON fixtures under `tests/persistence/fixtures/legacy/`, read with `readFile` + `JSON.parse`, passed to the pure `migrateLegacyMarketplaceRecords(state, GATE_CLOSED)`. The new clause is a **negative**: assert the migrated record does **not** have the new key (`Object.hasOwn` is false), proving no fill. Reuse an existing `v*` fixture; do not add one. |

---

## No Analog Found

| Edit | Why no analog |
|---|---|
| `toDisabledRecord` generic in its resources shape | No other function in the tree is generic in a sub-shape of its input. First instance; verified by the rewritten `@ts-expect-error` test, not by a copied pattern. |
| `partitionDisabledScopes` stops diverting + 4 downstream branch deletions (`info.ts:2271-2360`) | A collapse, not an addition. RESEARCH's disposition table (§ The buildBlock Reroute) is the specification; there is no prior collapse of this shape to copy. Watch `sonarjs/cognitive-complexity: 15` on `getPluginInfo` — the partition was extracted to stay under budget (`info.ts:2065-2066`), so re-inlining logic there is the risk. |

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{persistence,orchestrators,bridges,shared}/`,
`tests/{architecture,persistence,orchestrators,bridges}/`, `docs/output-catalog.md`,
plus `git log -S` over `shared/notify.ts` for the two prior `Extract` widenings and the
prior optional-`reasons` addition.
**Files read this session:** 14 source/test/doc files + 2 commit diffs (`c695bdab`, `cb90762a`)
**Pattern extraction date:** 2026-08-11
