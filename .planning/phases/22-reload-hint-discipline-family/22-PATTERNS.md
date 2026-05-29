# Phase 22: Reload-hint Discipline Family - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 5 modified (2 source, 2 test, 1 contract-doc)
**Analogs found:** 5 / 5 (every change has a same-file or precedent analog; no greenfield)

> All paths below are absolute-from-repo-root. Note the CONTEXT.md line numbers
> for the two `tests/*` files were off-by-prefix: the tests live at the **repo
> root** `tests/` tree (`/home/acolomba/pi-claude-marketplace/tests/...`), NOT
> under `extensions/pi-claude-marketplace/tests/...`. Source + catalog paths in
> CONTEXT.md are correct. Live line numbers verified in this pass are recorded
> per excerpt below.

## File Classification

| Modified File | Role | Data flow into the reload-hint decision | Closest Analog | Match Quality |
|---------------|------|------------------------------------------|----------------|---------------|
| `extensions/pi-claude-marketplace/shared/notify.ts` | source / chokepoint | `shouldEmitReloadHint(message)` is the sole reload-decision site; reads `mp.status` + `mp.plugins[].status` | **Same file** -- the existing inner plugin-row loop (`:1123-1132`) IS the collapsed rule; the G-21-01 fix in Plan 21-04 is the structural precedent | exact (self) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` | source / orchestrator | clean path feeds `{status:"removed", plugins:[]}`; must instead feed N `PluginUninstalledMessage` rows | **Same file** -- the partial path (`:295-324`, mapping at `:305-311`) already builds the identical `PluginUninstalledMessage` shape over `successfullyUnstaged` | exact (self) |
| `tests/shared/notify-v2.test.ts` | test / byte+predicate fixtures | drives `notify()` against hand-built messages, asserts trailer presence/absence | **Same file** -- the G-21-01 16a/16b tests (`:715-786`) are the exact positive/negative reload-trailer test template for D-22-04 | exact (self) |
| `tests/architecture/catalog-uat.test.ts` | test / catalog byte-equality runner | supplies `{pi, message}` fixtures; the *trailer expectation* is read from the catalog fenced blocks, not the fixture | **Same file** -- existing `clean`/`partial` remove + `enable-fresh`/`disable-fresh` fixtures (`:1155-1183`, `:1239-1251`) | exact (self) |
| `docs/output-catalog.md` | contract-doc / user-contract gate | the fenced `text` block under each `<!-- catalog-state: -->` IS the byte-equality oracle the runner compares against | **Same file** -- Plan 21-04's catalog edits (trailer-line removal + rule-bullet amendment) are the precedent | exact (self) |

---

## Pattern Assignments

### `extensions/pi-claude-marketplace/shared/notify.ts` (source / chokepoint)

The single chokepoint. Three sub-edits: collapse `shouldEmitReloadHint` (D-22-01),
update its docblock (Discretion), and confirm `RELOAD_HINT_TRAILER` / type unions
are untouched (no new field per D-22-02).

**Current `shouldEmitReloadHint` -- the marketplace-status arm to DELETE + the inner loop to KEEP** (`shared/notify.ts:1111-1136`):
```typescript
function shouldEmitReloadHint(message: NotificationMessage): boolean {
  for (const mp of message.marketplaces) {
    if (
      mp.status === "added" ||
      mp.status === "removed" ||
      mp.status === "updated" ||
      mp.status === "autoupdate enabled" ||
      mp.status === "autoupdate disabled"
    ) {
      return true;
    }

    for (const p of mp.plugins) {
      if (
        p.status === "installed" ||
        p.status === "updated" ||
        p.status === "reinstalled" ||
        p.status === "uninstalled"
      ) {
        return true;
      }
    }
  }

  return false;
}
```
**D-22-01 transform:** delete the outer `if (mp.status === ...)` block (lines
1113-1121); keep the inner `for (const p of mp.plugins)` loop verbatim. The
function becomes "iff any plugin row carries `installed | updated | reinstalled
| uninstalled`." The `for (const mp ...)` wrapper stays (it iterates to reach
each `mp.plugins`). Note: the inner-loop `p.status === "updated"` is the PLUGIN
token (4 state-change tokens), NOT the marketplace `(updated)` arm being removed.

**Current docblock (rewrite per Discretion; today it documents the autoupdate arm being deleted)** (`shared/notify.ts:1101-1110`):
```typescript
/**
 * Reload-hint trigger per SNM-15 / D-16-12. Refined wording: any state-changing
 * marketplace status (added/removed/updated -- not failed) or any of the four
 * state-changing plugin statuses.
 *
 * Phase 17.1 amendment per D-17.1-02 / D-18-05: fresh-flip autoupdate
 * enabled/disabled trigger the reload hint; mp-level "skipped" (idempotent
 * no-op) does NOT trigger -- no state was changed, so no /reload is needed.
 * "failed" continues to suppress (the operation rolled back; no state landed).
 */
```
New docblock must state the single rule (plugin-row-driven only; no marketplace-status
arm), cite SNM-33 + D-22-01, and note it supersedes the reload-trigger half of
D-17.1-02 (D-22-03). Mirror the G-21-01 docblock convention of explaining *why*
the predicate is now unambiguous.

**Trailer literal -- UNCHANGED** (`shared/notify.ts:1071`):
```typescript
/** Reload-hint trailer literal (D-16-04 / D-16-12; canonicalised here in Phase 21). */
const RELOAD_HINT_TRAILER = "/reload to pick up changes";
```

**`MarketplaceNotificationMessage` -- UNCHANGED (D-22-02 adds NO field)** (`shared/notify.ts:565-572`):
```typescript
export interface MarketplaceNotificationMessage {
  readonly name: string;
  readonly scope: Scope;
  readonly status?: MarketplaceStatus;
  readonly details?: MarketplaceDetails;
  readonly reasons?: readonly Reason[];
  readonly plugins: readonly PluginNotificationMessage[];
}
```

**`PluginUninstalledMessage` -- UNCHANGED; remove.ts clean path constructs this** (`shared/notify.ts:397-402`):
```typescript
export interface PluginUninstalledMessage {
  readonly status: "uninstalled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
}
```

**Plugin/marketplace status unions -- UNCHANGED** (`shared/notify.ts:232-244`, `:257-265`):
`PLUGIN_STATUSES` (11 entries, the 4 transition tokens lead the tuple) and
`MARKETPLACE_STATUSES` (7 entries) both stay intact. D-22-03 explicitly preserves
the 7-entry `MARKETPLACE_STATUSES` and the `skipped→warning` route; only the
reload-*trigger* arms in `shouldEmitReloadHint` are dropped, not the status tokens
themselves. `computeSeverity` (`:1074-1099`) is unaffected -- it still keys on
`mp.status === "failed" | "skipped"`.

**`computeSeverity` -- DO NOT TOUCH** (`shared/notify.ts:1074-1099`): severity and
reload-hint are independent ladders. The `mp.status === "skipped"` warning route
(autoupdate idempotent) and `mp.status === "failed"` error route both remain.
Editing the wrong function here is the most likely regression.

---

### `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (source / orchestrator)

D-22-02: the clean path must carry one `PluginUninstalledMessage` per
`successfullyUnstaged` plugin. The partial path (same file) already does the
identical mapping -- this is a copy-the-analog edit.

**The `successfullyUnstaged` accumulator (already populated in the guard loop)** (`remove.ts:201`, `:225-237`):
```typescript
const successfullyUnstaged: string[] = []; // plugins whose cascade returned ok:true
// ...
for (const [pluginName, plugin] of Object.entries(record.plugins)) {
  const outcome = await cascade(pluginName, opts.name, locations, plugin);
  if (outcome.ok) {
    successfullyUnstaged.push(pluginName);
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- record.plugins is a dynamic-key Record<string, ...>.
    delete record.plugins[pluginName];
  } else {
    const cause = outcome.cause ?? new Error(`unknown cascade failure for ${pluginName}`);
    failedPlugins.push({ name: pluginName, cause });
  }
}
```

**ANALOG -- the partial path's `PluginUninstalledMessage` mapping (copy this shape into the clean path)** (`remove.ts:305-311`):
```typescript
plugins: [
  ...successfullyUnstaged.map(
    (name): PluginUninstalledMessage => ({
      status: "uninstalled",
      name,
    }),
  ),
  // ...failedPlugins.map(...)  <- partial path only
],
```
Note the mapping emits `status` + `name` only (no `version` -- `successfullyUnstaged`
is a `string[]` of names). The clean-path rows will therefore render
`○ <name> (uninstalled)` with no `v<version>` token. If the planner wants version
parity with the catalog `partial` fixture (which shows `helper v1.0.0`), that would
require threading versions into the accumulator -- out of scope unless a fixture
demands it; the simplest D-22-02-compliant change reuses the name-only shape.

**The clean path to REWRITE** (`remove.ts:327-340`):
```typescript
  // CMC-31 CLEAN: mp.status="removed"; empty plugins[]. Reload-hint
  // fires from `mp.status === "removed"` per D-16-12, regardless of
  // whether any plugin resources were actually removed (deliberate
  // V2 contract change vs V1 per RESEARCH Risks #7).
  notify(opts.ctx, opts.pi, {
    marketplaces: [
      {
        name: opts.name,
        scope: resolved.scope,
        status: "removed",
        plugins: [],
      },
    ],
  });
}
```
**D-22-02 transform:** replace `plugins: []` with the `successfullyUnstaged.map(...)`
spread (copied from `:305-311`). `mp.status` stays `"removed"` (the header byte
form `● local-mp [user] (removed)` is unchanged; the icon/header rule is untouched).
Empty remove → `successfullyUnstaged` is `[]` → `plugins: []` → header-only → no
trailer (G-MIL-02). Non-empty remove → N `(uninstalled)` rows → trailer fires via
the collapsed D-22-01 rule.

**The comment block (lines 327-330) and the file-header prose (lines 8-13) must be
amended** -- both currently document the "reload fires regardless / deliberate V2
contract change vs V1" behavior that D-22-02 *reverses*. The file header at
`remove.ts:8-13`:
```typescript
//   - CLEAN success: one `MarketplaceNotificationMessage{ status:"removed",
//     plugins: [] }`. The `/reload to pick up changes` trailer is computed
//     by `notify()` per D-16-12 (mp.status "removed" is state-changing) and
//     fires whether or not plugins were removed. Severity = info (no 2nd
//     arg). The V1 contract distinction "no reload-hint when no plugin
//     resources changed" is deliberately retired in V2 per D-16-12.
```
must be rewritten to: clean success carries N `PluginUninstalledMessage` rows;
trailer fires iff ≥1 plugin was unstaged (D-22-02); empty remove is header-only.

**Imports already present -- no new import needed** (`remove.ts:73`):
```typescript
import type { PluginFailedMessage, PluginUninstalledMessage, Reason } from "../../shared/notify.ts";
```
`PluginUninstalledMessage` is already imported (used by the partial path). The
**Discretion** item (fold the two identical mappings into a shared helper) is
optional; the minimal edit just reuses the type that is already in scope.

---

### `tests/shared/notify-v2.test.ts` (test / byte + predicate fixtures)

D-22-04: ship 3 negative regressions + 2 positive "still-fires" guards. The
**G-21-01 16a/16b pair is the exact template** -- same `makeCtx()` / `notify()` /
`body.includes("/reload to pick up changes")` assertion shape.

**ANALOG -- the G-21-01 negative + positive trailer test pair (copy this structure)** (`tests/shared/notify-v2.test.ts:715-786`):
```typescript
test("UAT G-21-01: list-shaped message with status: 'present' plugin row emits NO /reload trailer (SNM-15 inventory-vs-transition discriminator)", () => {
  const ctx = makeCtx();
  const pi = piWithBothLoaded();
  const msg: NotificationMessage = {
    marketplaces: [
      { name: "official", scope: "user",
        plugins: [{ status: "present", name: "alpha", version: "1.0.0", dependencies: [] }] },
    ],
  };
  notify(ctx as never, pi as never, msg);
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  const body = ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
  assert.ok(
    !body.includes("/reload to pick up changes"),
    `expected body to NOT include reload-hint trailer, got: ${body}`,
  );
});

test("UAT G-21-01: cascade-shaped message with status: 'installed' plugin row continues to emit the /reload trailer (transition token preserved)", () => {
  // ... same shape, status: "installed" ...
  assert.ok(
    body.includes("/reload to pick up changes"),
    `expected body to include reload-hint trailer, got: ${body}`,
  );
});
```

**The 3 D-22-04 NEGATIVE tests to add (mirror the 16a structure):**
- empty `marketplace add` → `{status:"added", plugins:[]}` → assert `!body.includes("/reload to pick up changes")` (G-MIL-01).
- empty `marketplace remove` → `{status:"removed", plugins:[]}` → assert no trailer (G-MIL-02).
- no-op `marketplace update` cascade → `{status:"updated", plugins:[<all skipped>]}` (or `plugins:[]`) → assert no trailer (G-MIL-06).

**The 2 D-22-04 POSITIVE guards to add (mirror the 16b structure):**
- remove that uninstalled ≥1 plugin → `{status:"removed", plugins:[{status:"uninstalled", name:"x"}]}` → assert trailer present (SC#4).
- update with ≥1 changed plugin → `{status:"updated", plugins:[{status:"updated", from:..., to:..., dependencies:[]}]}` → assert trailer present (SC#4).

**EXISTING tests that WILL BREAK and must be updated (their assertions encode the
deleted marketplace-status arm):**

`tests/shared/notify-v2.test.ts:488-499` -- "removed marketplace header alone":
```typescript
test("notify renders removed marketplace header alone (empty plugins + reload-hint)", () => {
  // ...
  marketplaces: [{ name: "demo", scope: "user", status: "removed", plugins: [] }],
  // ...
  assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    `● demo [user] (removed)\n\n/reload to pick up changes`,  // <- trailer must be DROPPED (empty remove)
  ]);
});
```
Expected becomes `` `● demo [user] (removed)` `` (no blank line, no trailer).

`tests/shared/notify-v2.test.ts:501-512` -- "updated marketplace header alone":
expected `` `● demo [user] (updated)\n\n/reload to pick up changes` `` →
`` `● demo [user] (updated)` `` (empty `plugins:[]` update no longer triggers).

`tests/shared/notify-v2.test.ts:538-551` and `:553-564` -- "autoupdate enabled" /
"autoupdate disabled marketplace header alone": both currently assert
`` ...\n\n/reload to pick up changes `` and must drop the trailer (D-22-03).

`tests/shared/notify-v2.test.ts:475-486` -- "added marketplace header alone":
currently `` `● demo [user] (added)\n\n/reload to pick up changes` `` → drop trailer
(D-22-05 confirms `add` always `plugins:[]`, so empty-add never triggers).

`tests/shared/notify-v2.test.ts:695-705` -- "header-only block on empty plugins under
added marketplace": same `(added)` + trailer assertion → drop trailer.

> Note `tests/shared/notify-v2.test.ts:514-527` ("failed marketplace header alone")
> already asserts NO trailer + `"error"` severity -- it stays GREEN unchanged (failed
> was never in the trigger set; severity ladder is untouched).

---

### `tests/architecture/catalog-uat.test.ts` (test / catalog byte-equality runner)

The runner (`:1328-1399`) reads each `<!-- catalog-state: -->` fenced block from
`docs/output-catalog.md` as the *expected* string and drives the matching
`FIXTURES[section][state]` `{pi, message}` through `notify()`, asserting byte
equality. **The trailer expectation lives in the catalog, not the fixture** -- so
for the remove/autoupdate/update-no-op states, the *fixture messages stay as-is*
and only the catalog fenced blocks change (except the clean-remove fixture, which
changes if the catalog shows uninstalled rows).

**Clean / partial remove fixtures (clean-remove fixture changes IFF the catalog `clean` block grows `(uninstalled)` rows)** (`tests/architecture/catalog-uat.test.ts:1154-1184`):
```typescript
"/claude:plugin marketplace remove <name>": {
  clean: {
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [{ name: "local-mp", scope: "user", status: "removed", plugins: [] }],
    },
  },
  partial: {
    pi: piWithBothLoaded(),
    expectedSeverity: "error",
    message: {
      marketplaces: [{ name: "local-mp", scope: "user", status: "failed",
        plugins: [
          { status: "uninstalled", name: "helper", version: "1.0.0" },
          { status: "failed", name: "tool", reasons: ["permission denied"], cause: new Error("EACCES: permission denied") },
        ] }],
    },
  },
},
```
The `partial` fixture stays unchanged (it already has an `uninstalled` row → trailer
still fires under D-22-01; its catalog block keeps the trailer). The `clean` catalog
`text` block (docs `:757-761`) currently shows the trailer; per D-22-02 the catalog
author must decide whether the canonical `clean` example becomes the *empty* remove
(header-only, no rows, no trailer) or a *non-empty* remove (header + `(uninstalled)`
rows + trailer). Whichever the catalog shows, the `clean` fixture's `message.plugins`
must match byte-for-byte. The CONTEXT.md narrative (D-22-06) says "clean-remove byte
form now header + N `(uninstalled)` rows; empty-remove stays header-only" -- so the
canonical `clean` fixture likely gains `plugins:[{status:"uninstalled", name:...}]`
rows and keeps its trailer, and a new `empty` (or similar) state may be added for the
header-only no-trailer case.

**Autoupdate fresh-flip fixtures (UNCHANGED messages; only their catalog blocks lose the trailer)** (`tests/architecture/catalog-uat.test.ts:1239-1251`):
```typescript
"/claude:plugin marketplace autoupdate <enable|disable> <name>": {
  "enable-fresh": {
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [{ name: "foo", scope: "user", status: "autoupdate enabled", plugins: [] }],
    },
  },
  "disable-fresh": {
    pi: piWithBothLoaded(),
    message: {
      marketplaces: [{ name: "foo", scope: "user", status: "autoupdate disabled", plugins: [] }],
    },
  },
  // "enable-idempotent" / "disable-idempotent" -> status: "skipped" -> already no trailer; UNCHANGED.
},
```

**Also affected (NOT named in CONTEXT.md but mechanically broken by D-22-01):** the
`marketplace update` `autoupdate-off-manifest-refresh` fixture (`:1190-1195`,
`{status:"updated", plugins:[]}`) currently renders WITH a trailer via the catalog
block at docs `:792-796`. Under D-22-01 an empty `plugins:[]` update emits no
trailer, so that catalog block must also lose its trailer or the byte-equality
runner fails. Flag this for the planner -- it is the `update.ts:657-661`
manifest-refresh arm (`{status:"updated", plugins:[]}`).

---

### `docs/output-catalog.md` (contract-doc / user-contract gate)

The byte-equality oracle. **ANALOG: Plan 21-04's catalog edits** -- (a) amend the
Reload-hint rule bullets, (b) strip the now-misfiring `/reload to pick up changes`
trailer line + its preceding blank line from the affected fenced blocks.

**The reload-hint rule to amend (D-22-06)** (`docs/output-catalog.md:62-71`):
```markdown
### Reload-hint trailer

`notify()` appends `/reload to pick up changes` (with one blank line above the trailer) iff at least one of the following is true (D-16-12):

- A plugin status is in `{installed, updated, reinstalled, uninstalled}`.
- A marketplace status is in `{added, removed, updated}` (state-changing; NOT `failed`).

A `failed` marketplace does NOT trigger the trailer (rolled-back state has nothing to reload). A failed-only cascade (no successful or state-changing rows) also suppresses the trailer.
```
**D-22-06 transform:** delete the second bullet entirely (the marketplace-status
trigger). The rule becomes the single plugin-row bullet. Cite SNM-33 / D-22-01 and
note the principle: "marketplace records are not Pi-visible resources; only plugin
rows are." The `present` clarification paragraph (`:71`) stays.

**Line-15 header-alone note to amend (D-22-06)** (`docs/output-catalog.md:15`): the
sentence "a marketplace-only command (`marketplace add`, `marketplace remove`,
`marketplace autoupdate`, `bootstrap`, ...) renders the header alone with
`plugins: []`" must be narrowed: only the **empty** `marketplace remove` is
header-alone; a non-empty remove renders header + `(uninstalled)` rows.

**Fenced `text` blocks that must lose their trailer line + preceding blank line**
(byte-equality oracle for the runner):

| Catalog state | Lines | Current trailer | After D-22 |
|---------------|-------|-----------------|-----------|
| `marketplace add` → `path-source` | `:715-719` | has `/reload...` | drop (empty add never triggers, D-22-05) |
| `marketplace add` → `github-source` | `:727-731` | has `/reload...` | drop |
| `marketplace remove` → `clean` | `:757-761` | has `/reload...` | per D-22-06: becomes header + N `(uninstalled)` rows + trailer (non-empty canonical) OR header-only no-trailer (empty); author's call |
| `marketplace update` → `autoupdate-off-manifest-refresh` | `:792-796` | has `/reload...` | drop (empty `plugins:[]` update, G-MIL-06 class) |
| `marketplace autoupdate` → `enable-fresh` | `:835-839` | has `/reload...` | drop (D-22-03) |
| `marketplace autoupdate` → `disable-fresh` | `:847-851` | has `/reload...` | drop (D-22-03) |

**Current `clean` remove block (the deliberate-V2-contract block being reversed)** (`docs/output-catalog.md:757-763`):
```text
● local-mp [user] (removed)

/reload to pick up changes
```
> "Marketplace status `removed` triggers the reload-hint per D-16-12."

**The `partial` remove block STAYS (keeps trailer; has an `(uninstalled)` row)** (`docs/output-catalog.md:769-776`):
```text
⊘ local-mp [user] (failed)
  ○ helper v1.0.0 (uninstalled)
  ⊘ tool (failed) {permission denied}
    cause: EACCES: permission denied

/reload to pick up changes
```

**Prose blocks whose rationale must be rewritten (they justify the deleted arm):**
docs `:763` ("status `removed` triggers"), `:798` (manifest-refresh "fires because
`mp.status === "updated"`"), `:841` / `:853` (autoupdate fresh "reload-hint emitted
per D-16-12 state-change trigger ladder"), and the `:885` summary paragraph
("reload-hint ladder runs fresh-flip → emit"). The `(removed)` glyph/status-token
reference at `:130` is descriptive of the header form and does NOT change (the
header still renders `● M [S] (removed)`); only the trailer behavior changes.

**Catalog UAT count guard:** the runner asserts `examples.length >= 30`
(`:1332-1335`). Removing trailer *lines* does not remove `<!-- catalog-state: -->`
*annotations*, so the example count is unaffected. If a new `empty`-remove state is
added it raises the count (still ≥30).

---

## Shared Patterns

### Pattern A -- Discriminator-keyed reload gate (G-21-01 precedent, the phase's north star)
**Source:** `.planning/phases/21-final-teardown-green-gate/21-04-SUMMARY.md` (Plan 21-04, gap G-21-01)
**Apply to:** the `shouldEmitReloadHint` collapse and every test/catalog edit.

The G-21-01 fix established the invariant Phase 22 extends: **every status
discriminator either ALWAYS triggers the reload-hint or NEVER does -- no token
straddles inventory vs transition.** G-21-01 achieved this by *splitting* a
straddling token (`installed` → added list-only `present`, byte-identical renderer
arm, excluded from the trigger set). Phase 22 achieves it by *removing* the
marketplace-status arm entirely so the trigger set is exactly the 4 plugin
transition tokens. The renderer (header + row byte forms) is **unchanged** in both
fixes -- only the contents-derived trigger predicate moves. Verbatim from the 21-04
summary:

> "a status token straddling two surfaces (inventory + transition) is split into
> two tokens with byte-identical renderer arms; the new token is excluded from the
> contents-derived trigger predicate (shouldEmitReloadHint) so the predicate becomes
> unambiguous"

> "Renderer arm byte-equality preservation: ... only the misfiring trailer line is
> removed."

The Phase 22 analog: header byte forms (`(removed)`, `(added)`, `(autoupdate
enabled)`, `(updated)`) are preserved verbatim; only the trailer line is removed
from the no-plugin-row cases.

### Pattern B -- Content-driven reload decision, never caller-supplied (D-16-12 / SNM-15)
**Source:** `shared/notify.ts:1111` (`shouldEmitReloadHint(message)` reads only `message` contents)
**Apply to:** the remove.ts D-22-02 edit specifically.

D-22-02 was chosen *content-driven* (clean path emits real `PluginUninstalledMessage`
rows) over a hidden count/flag field precisely to preserve this invariant. Do NOT
add a `reloadHint?: boolean` or a count field to `MarketplaceNotificationMessage`
-- the reload decision must stay computable from the rendered contents alone.

### Pattern C -- Catalog + fixture + test lockstep in one commit (byte-equality gate)
**Source:** `docs/output-catalog.md:3` ("Every fenced output block ... is byte-equal to what `notify()` emits") + Plan 21-04's single atomic commit across notify.ts + catalog + 3 test files
**Apply to:** all five files together.

Any rendered-output change (clean-remove rows; autoupdate-fresh/empty-update/empty-add
trailer removal) MUST update `docs/output-catalog.md` AND the `tests/architecture/catalog-uat.test.ts`
fixtures AND the `tests/shared/notify-v2.test.ts` byte assertions in the same change.
The catalog-uat runner compares the catalog fenced blocks directly, so a catalog edit
without the matching source/fixture change (or vice versa) fails `npm run check`.

### Pattern D -- Severity ladder is independent of the reload ladder (do-no-harm)
**Source:** `shared/notify.ts:1074-1099` (`computeSeverity`)
**Apply to:** the notify.ts edit (negative guard).

`computeSeverity` and `shouldEmitReloadHint` are separate functions over the same
message. D-22-03 explicitly keeps the `skipped→warning` severity route and the
7-entry `MARKETPLACE_STATUSES`. The Phase 22 edit touches `shouldEmitReloadHint`
ONLY. The `mp.status === "skipped"` (autoupdate idempotent) warning route and the
`mp.status === "failed"` error route stay live and untested-by-this-phase.

---

## No Analog Found

None. Every change is a same-file self-analog (the partial-remove path for the
clean-remove change; the inner plugin loop for the collapsed rule; the G-21-01
16a/16b pair for the new tests; Plan 21-04's catalog edits for the doc change).
No greenfield file, no missing-pattern fallback to RESEARCH.md (which does not
exist for this phase).

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/shared/`,
`extensions/pi-claude-marketplace/orchestrators/marketplace/`, `tests/shared/`,
`tests/architecture/`, `docs/`, `.planning/phases/21-final-teardown-green-gate/`.
**Files scanned:** 8 (notify.ts, remove.ts, add.ts, update.ts, notify-v2.test.ts,
catalog-uat.test.ts, output-catalog.md, 21-04-SUMMARY.md).
**Pattern extraction date:** 2026-05-28
