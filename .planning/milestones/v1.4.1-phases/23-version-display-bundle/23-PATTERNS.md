# Phase 23: Version Display Bundle - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 6 modified (2 source, 3 test, 1 contract-doc) + 1 unchanged reference
**Analogs found:** 6 / 6 (every change has a same-file or in-repo precedent; no greenfield, no RESEARCH.md fallback)

> **Path corrections (verified live this pass):**
> - **Tests live at the repo-root `tests/` tree** (`/home/acolomba/pi-claude-marketplace/tests/...`), NOT under `extensions/pi-claude-marketplace/tests/...` as CONTEXT.md's `<canonical_refs>` writes. Source + catalog paths in CONTEXT.md are correct.
> - `resolvePluginVersion` is at `shared.ts:166-176` (CONTEXT.md correct). The `entry.version` gate is `shared.ts:171` (correct).
> - `renderVersion` is `notify.ts:752-758`; `composeVersionArrow` is `notify.ts:798-800`; the `updated`-arm call site is `notify.ts:906` (all CONTEXT.md correct).
> - `computeHashVersion` is `version.ts:30-34` (CONTEXT.md said `:29-34`; the `export async function` line is `:30`).
> - `ResolvedPluginInstallableSchema` is `resolver.ts:50-59`; `readManifest` is `resolver.ts:317-345` (both CONTEXT.md correct).
> - Both new helpers `looksLikeHashVersion` / `formatHashVersionForDisplay` confirmed **net-new** (zero matches across `extensions/`, `tests/`, `docs/`).

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` | source / orchestrator helper | transform (entry+installable → version string); adds file-I/O read of plugin.json | **Same file** -- the existing `entry.version` gate (`:171`) is the validation shape; **`domain/resolver.ts::readManifest` (`:317-345`)** is the read+parse+fall-through precedent | exact (self + in-repo read pattern) |
| `extensions/pi-claude-marketplace/shared/notify.ts` | source / render chokepoint | transform (version string → display token), pure | **Same file** -- `renderVersion` (`:752`) and `composeVersionArrow` (`:798`) are the two sole version chokepoints (D-16-04); the new helpers plug into both | exact (self) |
| `tests/orchestrators/plugin/install.test.ts` | test / state-version assertion | request-response (installPlugin → assert `state.version`) | **Same file** -- PI-7 (a)/(b) tests (`:523-600`) are the exact tier-assertion template | exact (self) |
| `tests/shared/notify-v2.test.ts` | test / byte-equality fixtures | transform (NotificationMessage → byte string) | **Same file** -- the `updated`-arrow byte test (`:267`) and every `v<version>` row assertion are the byte template | exact (self) |
| `tests/architecture/catalog-uat.test.ts` | test / catalog byte-equality runner | transform (catalog fenced block ↔ `notify()` output) | **Same file** -- the FIXTURES map (`:200+`) + the `update`-arrow fixtures (`:782-872`) are the per-state byte template | exact (self) |
| `docs/output-catalog.md` | contract-doc / byte-equality oracle | the fenced `text` block under each `<!-- catalog-state: -->` is the oracle | **Same file** -- version-token rule (`:40`), update-arrow asymmetry note (`:494`); Phase 22's catalog edits are the lockstep precedent | exact (self) |
| `extensions/pi-claude-marketplace/domain/version.ts` | source / reference only | UNCHANGED | n/a -- defines `hash-<12hex>` shape (`:33`) that the regex must match | reference |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | source / reference only | NOT modified (D-23-02 adds no `manifest` field) | n/a -- `readManifest` (`:317-345`) is the read-pattern reference | reference |

---

## Pattern Assignments

### `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` (source / orchestrator helper) -- SNM-34

Three sub-edits to `resolvePluginVersion`: (1) add a **plugin.json tier ahead of** the existing `entry.version` tier (D-23-01 reorder), (2) re-read `<pluginRoot>/.claude-plugin/plugin.json` directly (D-23-02), (3) reuse the existing gate `typeof v === "string" && v.length > 0` (D-23-03, no SemVer).

**The function to rewrite -- current 2-tier body** (`shared.ts:166-176`):
```typescript
/** PI-7 / PUP-3 version precedence: marketplace entry version, then content hash. */
export async function resolvePluginVersion(
  entry: PluginEntry,
  installable: ResolvedPluginInstallable,
): Promise<string> {
  if (typeof entry.version === "string" && entry.version.length > 0) {
    return entry.version;
  }

  return computeHashVersion(installable.pluginRoot);
}
```

**D-23-01 / D-23-02 / D-23-03 transform -- target 3-tier order:**
1. **plugin.json `version`** -- read `<installable.pluginRoot>/.claude-plugin/plugin.json`, `JSON.parse`, pick `.version`; accept iff `typeof v === "string" && v.length > 0` (the gate copied verbatim from `:171`).
2. **marketplace `entry.version`** -- the existing `:171` gate, now the **second** tier (it moves below plugin.json).
3. **PI-7 hash** -- `computeHashVersion(installable.pluginRoot)` unchanged, last-resort.

**Failure handling (D-23-02):** read/parse failure (ENOENT, malformed JSON, missing `.version`, non-string `.version`) MUST **fall through to the next tier -- never throw**. Wrap the read+parse in `try/catch` and treat any failure as "tier absent."

**ANALOG for the read+parse+fall-through shape -- `domain/resolver.ts::readManifest`** (`resolver.ts:317-345`):
```typescript
async function readManifest(
  ctx: ResolveContext,
  pluginRoot: string,
): Promise<{ ok: true; manifest: Record<string, unknown> | null } | { ok: false; reason: string }> {
  const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
  // ...
  try {
    const raw = await readFileTextOf(ctx)(manifestPath);
    const parsed: unknown = JSON.parse(raw);
    // ... validate ...
    return { ok: true, manifest: parsed };
  } catch (err) {
    return { ok: false, reason: `malformed plugin.json: ...` };
  }
}
```
**Copy the path-join (`path.join(pluginRoot, ".claude-plugin", "plugin.json")`) and the `JSON.parse`-in-`try/catch` shape.** DO NOT thread this through the resolver or add a `manifest` field to `ResolvedPluginInstallable` (D-23-02) -- `resolvePluginVersion` re-reads independently. `path` is already imported (`shared.ts:16`). The function needs `readFile` from `node:fs/promises` (NEW import in this file -- `version.ts:21` shows the project's `import { readFile } from "node:fs/promises";` convention).

**DO NOT TOUCH -- `ResolvedPluginInstallableSchema`** (`resolver.ts:50-59`):
```typescript
const ResolvedPluginInstallableSchema = Type.Object({
  installable: Type.Literal(true),
  name: Type.String(),
  pluginRoot: Type.String(), // ONLY on installable variant (NFR-7)
  // ... NO `manifest` field is added (D-23-02) ...
});
```
The NFR-7 discriminated union stays untouched. `installable.pluginRoot` is the only field `resolvePluginVersion` reads off the installable (already does today).

**Docblock update:** the current docblock `/** PI-7 / PUP-3 version precedence: marketplace entry version, then content hash. */` (`:166`) documents the **old 2-tier order** and MUST be rewritten to the 3-tier order (plugin.json → entry.version → hash), citing PI-7 / SNM-34 / D-23-01 and the upstream rule "If also set in the marketplace entry, `plugin.json` wins."

---

### `extensions/pi-claude-marketplace/shared/notify.ts` (source / render chokepoint) -- SNM-35

Add two net-new helpers, then route the version token(s) of `renderVersion` AND `composeVersionArrow` through `formatHashVersionForDisplay` (D-23-04, D-23-05). Renderer-only; persistence is unchanged.

**The shape to match -- `computeHashVersion` output** (`domain/version.ts:30-34`, UNCHANGED reference):
```typescript
export async function computeHashVersion(pluginRoot: string): Promise<string> {
  const hash = createHash("sha256");
  await walkAndHash(hash, pluginRoot, "");
  return "hash-" + hash.digest("hex").slice(0, HASH_TRUNC);  // HASH_TRUNC = 12
}
```
So the persisted form is exactly `hash-` + 12 lowercase-hex chars → the regex `looksLikeHashVersion` matches is anchored `^hash-[0-9a-f]{12}$` (D-23-04).

**NEW helper 1 -- `looksLikeHashVersion(v)` (D-23-04):** anchored-exact predicate. Suggested shape (mirror the `renderVersion` doc-comment + single-expression style at `:746-758`):
```typescript
const HASH_VERSION_RE = /^hash-[0-9a-f]{12}$/;
function looksLikeHashVersion(v: string): boolean {
  return HASH_VERSION_RE.test(v);
}
```

**NEW helper 2 -- `formatHashVersionForDisplay(v)` (D-23-04):** strip `hash-` and keep the first 7 hex (git `--short=7`); pass non-hash strings through unchanged:
```typescript
function formatHashVersionForDisplay(v: string): string {
  if (!looksLikeHashVersion(v)) {
    return v;
  }
  return `#${v.slice("hash-".length, "hash-".length + 7)}`;  // "hash-2ea95f85703d" -> "#2ea95f8"
}
```
Note it returns `#<7hex>` WITHOUT the `v` -- the `v` is prepended downstream by `renderVersion` / `composeVersionArrow`, producing the final byte form `v#<7hex>` (canonical example: persisted `hash-2ea95f85703d` → rendered `v#2ea95f8`).

**Chokepoint 1 -- `renderVersion` to amend (the SOLE single-version chokepoint, called by 9 row arms)** (`notify.ts:752-758`):
```typescript
function renderVersion(version: string | undefined): string {
  if (version === undefined || version === "") {
    return "";
  }

  return `v${version}`;
}
```
**D-23-05 transform:** route `version` through `formatHashVersionForDisplay` before the `v` prefix, e.g. `return \`v${formatHashVersionForDisplay(version)}\`;`. A non-hash version (`"1.0.0"`) passes through unchanged → still `v1.0.0`. A hash (`hash-2ea95f85703d`) → `v#2ea95f8`. This single edit covers all 9 arms that call `renderVersion` (`installed/reinstalled/uninstalled/available/unavailable/upgradable/present/skipped/failed/manual recovery` -- `:892,920,934,944,954,963,977,991,1000,1009`).

**Chokepoint 2 -- `composeVersionArrow` to amend (the `updated`-arm helper, asymmetric prefix)** (`notify.ts:798-800`):
```typescript
function composeVersionArrow(from: string, to: string): string {
  return `${from} → v${to}`;
}
```
**D-23-05 transform:** route BOTH `from` and `to` through `formatHashVersionForDisplay`, preserving the asymmetric `v` (bare `from`, `v`-prefixed `to` per the catalog rule `:494`): `return \`${formatHashVersionForDisplay(from)} → v${formatHashVersionForDisplay(to)}\`;`. A hash on both sides renders `#<7hex-from> → v#<7hex-to>` (e.g. `#2ea95f8 → v#1c3d9a0`). Sole caller is the `updated` arm (`:906`).

**Discretion (D-23-04 / CONTEXT `## Claude's Discretion`):** placement of the two helpers within `notify.ts`, and whether to invoke `formatHashVersionForDisplay` inline inside each chokepoint vs. a shared sub-helper both call. The minimal edit is inline in both. Place near `renderVersion` (`:746`) to keep the version-token helpers co-located.

**DO NOT TOUCH:** the renderer's token order, `joinTokens` (`:742`), `renderScopeBracket` (`:783`), `composeReasons` (`:823`), and the `renderPluginRow` switch arms themselves (`:881-1019`) -- they call the two chokepoints and need no per-arm change.

---

### `tests/orchestrators/plugin/install.test.ts` (test / state-version assertion) -- SNM-34

**CRITICAL -- existing fixture conflict the planner MUST resolve:** `seedPathMarketplaceWithPlugin` **unconditionally writes `plugin.json` with `version: "0.0.1"`** (`install.test.ts:156-159`):
```typescript
await writeFile(
  path.join(pluginRoot, ".claude-plugin", "plugin.json"),
  JSON.stringify({ name: pluginName, version: "0.0.1" }),
);
```
Today this is inert because `resolvePluginVersion` never reads plugin.json. **After D-23-01 it becomes tier-1 and WILL break the existing PI-7 (b) test** (`:561-600`), which asserts `state.version` matches `/^hash-[0-9a-f]{12}$/` when `entry.version` is absent -- but the seeded plugin.json `0.0.1` now wins, so the recorded version becomes `0.0.1`, not a hash. **The planner must add a fixture knob** (e.g. an optional `pluginJsonVersion?: string | null` to the helper; `null`/omit → write `plugin.json` WITHOUT a `version` field) so PI-7 (b) can exercise the genuine hash-fallback path.

**ANALOG -- the PI-7 (a) tier-assertion template (copy this for the new plugin.json tier test)** (`install.test.ts:523-559`):
```typescript
test("PI-7 (a): entry.version present -> recorded state.version matches entry.version verbatim", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-pi7a-"));
    try {
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        pluginName: "hello",
        pluginVersion: "1.2.3",   // <- sets entry.version on the marketplace manifest
        skills: [{ sourceName: "tool" }],
      });
      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });
      const errs = notifications.filter((n) => n.severity === "error");
      assert.equal(errs.length, 0, `unexpected errors: ${JSON.stringify(errs)}`);
      const after = await loadState(locations.extensionRoot);
      const record = after.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record !== undefined);
      assert.equal(record.version, "1.2.3");
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
```

**The new SNM-34 tier test to add** (mirror PI-7 (a) structure): fixture where **marketplace `entry.version` is OMITTED** (no `pluginVersion`) **but plugin.json declares a version** (e.g. `1.2.3`) → assert `record.version === "1.2.3"` (the plugin.json tier fires, NOT the hash). The fixture must make the marketplace entry version-less while keeping (or setting) plugin.json's `version` -- exercising D-23-01's reorder. CONTEXT `<canonical_refs>` describes this exactly: "marketplace omits `version`, plugin.json declares one → resolved/rendered as that version, not a hash."

**Helper-knob note:** `seedPathMarketplaceWithPlugin` already has `pluginVersion?` for the MARKETPLACE-ENTRY version (`:123-124`, `:205-207`) -- that is a different field from the plugin.json version. The new test needs to control the **plugin.json `version`** independently (the hard-coded `0.0.1` at `:158`). Adding the knob serves both the new test and the PI-7 (b) repair above.

**Also verify PI-7 (a) still passes:** with both plugin.json `0.0.1` (seeded) AND `entry.version: "1.2.3"` present, D-23-01 makes **plugin.json win** → PI-7 (a) would now record `0.0.1`, failing its `assert.equal(record.version, "1.2.3")`. The planner must either (a) set the new knob to suppress plugin.json's version in the PI-7 (a) fixture, or (b) align the seeded plugin.json version with the entry version. Per upstream "plugin.json wins," PI-7 (a)'s name ("entry.version present → matches entry.version") is now semantically about tier-2; the cleanest repair is to make PI-7 (a)'s plugin.json version-less so entry.version is the surviving tier.

---

### `tests/shared/notify-v2.test.ts` (test / byte-equality fixtures) -- SNM-35 (D-23-06)

Add `v#<7hex>` byte fixtures. The catalog has **zero hash-version examples today** -- all version bytes are SemVer (`v1.0.0`, `0.5.0 → v1.0.0`).

**ANALOG -- the `updated`-arrow byte assertion (copy this for the hash-arrow test)** (`notify-v2.test.ts:246-268`):
```typescript
const msg: NotificationMessage = {
  marketplaces: [
    { name: "demo", scope: "user", status: "added",
      plugins: [
        { status: "updated", name: "commit-commands", from: "1.0.0", to: "1.1.0", dependencies: ["mcp"] },
      ] },
  ],
};
notify(ctx as never, pi as never, msg);
assert.equal(ctx.ui.notify.mock.calls.length, 1);
assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
  `● demo [user] (added)\n  ● commit-commands 1.0.0 → v1.1.0 (updated) {requires pi-mcp}\n\n/reload to pick up changes`,
]);
```

**The new hash-version byte tests to add (mirror this shape):**
- **Single-version arm (`installed`/`present`):** `version: "hash-2ea95f85703d"` → assert row renders `... v#2ea95f8 ...` (NOT `vhash-2ea95f85703d`). This exercises the `renderVersion` chokepoint.
- **Update-arrow with hash on both sides:** `{status:"updated", from:"hash-2ea95f85703d", to:"hash-1c3d9a0...", ...}` → assert `... #2ea95f8 → v#1c3d9a0 ...` (bare `from`, `v`-prefixed `to`). Exercises `composeVersionArrow`.
- **Pass-through guard:** a SemVer (`version: "1.0.0"`) still renders `v1.0.0` (regression that non-hash strings are untouched).

Use a 12-hex hash whose first 7 chars are stable/known (canonical `hash-2ea95f85703d` → `#2ea95f8`). Existing `v1.0.0` assertions stay GREEN (pass-through).

---

### `tests/architecture/catalog-uat.test.ts` (test / catalog byte-equality runner) -- SNM-35 (D-23-06)

The runner reads each `<!-- catalog-state: STATE -->` fenced block from `docs/output-catalog.md` as the EXPECTED string and drives the matching `FIXTURES[section][state]` `{pi, message}` through `notify()`, asserting byte equality (`catalog-uat.test.ts:80-95` parser, `:200+` FIXTURES map). **Adding a hash-version state requires a NEW catalog fenced block AND a matching FIXTURES entry, in lockstep.**

**ANALOG -- an `update`-arrow fixture (copy this for a hash-version state)** (`catalog-uat.test.ts:782-785`):
```typescript
{
  status: "updated",
  // ...
  from: "0.5.0",
  to: "1.0.0",
}
```
**The new hash-version fixture(s) to add:** a `{pi, message}` payload whose plugin row(s) carry `version: "hash-<12hex>"` (single-version state) and/or `from`/`to` hashes (arrow state). The fixture's section+state key MUST match a new `<!-- catalog-state: -->` block added to `docs/output-catalog.md` in the same commit; the catalog block's rendered bytes (`v#<7hex>`) are the oracle.

**Count guard:** the runner asserts `examples.length >= 30` (parser at `:80-95`; the assertion lives later in the file -- search `examples.length`). Adding hash-version states RAISES the count (still ≥30); removing none. CONTEXT `<canonical_refs>` notes the catalog has zero hash examples today, so this is a pure addition.

**`piWithBothLoaded()` / `makeCtx()` factories** are the existing fixture-builders (used throughout the FIXTURES map) -- reuse them; no new factory needed.

---

### `docs/output-catalog.md` (contract-doc / byte-equality oracle) -- SNM-35 (D-23-06)

Two prose-rule amendments + at least one new fenced hash-version state.

**Version-token rule to amend (D-23-06)** (`output-catalog.md:40`):
```markdown
- `<version-token>` -- `v<version>` on most variants when `version` is set; `<from> → v<to>` on the `updated` variant (required from-/to-fields per D-15-04).
```
**Transform:** add the hash-display rule -- a persisted PI-7 `hash-<12hex>` renders as git-style `v#<7hex>` (first 7 hex of the 12-hex truncation); the `hash-` prefix is stripped at render time; persistence stays `hash-<12hex>` (PI-7 intact). Cite SNM-35 / D-23-04 / D-23-05.

**Update-arrow asymmetry note to amend (D-23-06)** (`output-catalog.md:494`):
```markdown
The `updated` variant emits `<from> → v<to>` (note the asymmetric `v` prefix -- `from` is rendered bare; only `to` is `v`-prefixed per `composeVersionArrow`). ...
```
**Transform:** add that when a side is a hash-version it renders `#<7hex>` (bare `from`) / `v#<7hex>` (prefixed `to`), e.g. `#2ea95f8 → v#1c3d9a0`.

**ANALOG -- a representative fenced `update`-arrow block** lives at `output-catalog.md:483-492`. It is a `<!-- catalog-state: single-mp-mixed -->` annotation immediately followed by a fenced ` ```text ` block whose body is:

    ● official [user]
      ● alpha 0.5.0 → v1.0.0 (updated)
      ⊘ beta (skipped) {up-to-date}
      ⊘ delta (failed) {network unreachable}

    /reload to pick up changes

(Indented above for display; in the catalog it is a real fenced `text` block.) Copy that annotation-then-fence shape for the new hash-version state.

**The new hash-version catalog state(s) to add (D-23-06, Discretion on exact states):** at least one `<!-- catalog-state: ... -->` block under an existing per-command H2 section (e.g. `install`/`list`/`update`) showing a row with `v#<7hex>` and, ideally, an arrow state showing `#<7hex-from> → v#<7hex-to>`. Each new block needs a matching `catalog-uat.test.ts` FIXTURES entry (same section+state key). The per-command H2 section header MUST match the parser regex `^## (\`(\/claude:plugin [^\`]+)\`|Manual recovery anchors)\s*$` (`:88`) and the state annotation `^<!-- catalog-state: ([a-z0-9-]+) -->\s*$` (`:89`).

---

## Shared Patterns

### Pattern A -- Two-and-only-two version-render chokepoints (D-16-04)
**Source:** `notify.ts:752` (`renderVersion`) + `notify.ts:798` (`composeVersionArrow`)
**Apply to:** the entire SNM-35 renderer change.
`renderVersion` and `composeVersionArrow` are the SOLE sites that turn a version string into a display token. The hash transform plugs into exactly these two -- never into individual `renderPluginRow` arms. This is why one `formatHashVersionForDisplay` edit in each chokepoint covers all 9 single-version arms + the arrow arm. Do NOT scatter the transform across call sites.

### Pattern B -- Persistence/display separation (PI-7 intact, no migration)
**Source:** `domain/version.ts:33` (persisted `hash-<12hex>`) vs. the SNM-35 renderer-only `v#<7hex>` transform
**Apply to:** notify.ts (transform), version.ts (leave alone), state-IO (untouched).
`state.json` keeps `hash-<12hex>`; the `v#<7hex>` form exists only at render time. `formatHashVersionForDisplay` sits between the persisted string and the token -- callers keep passing the full version. The full 12-hex collision envelope is retained internally for compare semantics (PRD PL-5 plain string equality). `tests/domain/version.test.ts` pins the persisted `hash-<12hex>` snapshot and stays UNCHANGED.

### Pattern C -- Reuse the existing string gate, no SemVer (D-23-03)
**Source:** `shared.ts:171` (`typeof entry.version === "string" && entry.version.length > 0`)
**Apply to:** the SNM-34 plugin.json tier.
The plugin.json `version` is validated by the IDENTICAL non-empty-string gate. No SemVer regex, no `looksLikeSemver`. Grounded in `domain/components/plugin.ts:19` (`version: Type.Optional(Type.String())` -- opaque string) and PRD PL-5 (string-compare upgradable). A malformed/empty/non-string value falls through to the next tier.

### Pattern D -- Read-parse-fall-through, never widen the discriminated union (D-23-02 / NFR-7)
**Source:** `domain/resolver.ts:317-345` (`readManifest`'s `path.join(pluginRoot, ".claude-plugin", "plugin.json")` + `JSON.parse`-in-`try/catch`)
**Apply to:** the SNM-34 `resolvePluginVersion` re-read.
Re-read the manifest in-place rather than threading a `manifest` field onto `ResolvedPluginInstallable` (`resolver.ts:50-59` stays untouched). Any read/parse failure returns "tier absent" (fall through), never throws. The extra read is trivial against the full-tree `computeHashVersion` walk it short-circuits.

### Pattern E -- Catalog + fixture + test lockstep in one commit (byte-equality gate)
**Source:** `docs/output-catalog.md` byte oracle + Phase 22 PATTERNS.md Pattern C precedent (`.planning/phases/22-reload-hint-discipline-family/22-PATTERNS.md:487`)
**Apply to:** all of D-23-06 (`output-catalog.md` + `catalog-uat.test.ts` + `notify-v2.test.ts`) together.
Any rendered-output change (here: the `v#<7hex>` form and the new hash-version catalog states) MUST update `docs/output-catalog.md` AND the `catalog-uat.test.ts` FIXTURES AND the `notify-v2.test.ts` byte assertions in the same change. The catalog-uat runner compares catalog fenced blocks directly against `notify()`, so a catalog edit without the matching fixture (or vice versa) fails `npm run check`. This is the Phase 22 D-22-06 pattern repeated.

---

## Cross-cutting sequencing (D-23-07)

Per the v1.4.1 `shared/notify.ts` convergence constraint (ROADMAP `:83-91`), SNM-34 (resolver) and SNM-35 (renderer) ship as **separate serialized plans, not parallel waves**. Their files are largely disjoint:
- **SNM-34:** `orchestrators/plugin/shared.ts` + `tests/orchestrators/plugin/install.test.ts` (+ the fixture-helper knob repair).
- **SNM-35:** `shared/notify.ts` + `docs/output-catalog.md` + `tests/shared/notify-v2.test.ts` + `tests/architecture/catalog-uat.test.ts`.

The only shared touchpoint is conceptual (both touch "version"); no file is edited by both plans. Planner owns final decomposition.

---

## No Analog Found

None. Every change is a same-file self-analog or has a direct in-repo precedent:
- SNM-34 resolver reorder: same-file `entry.version` gate (`shared.ts:171`) + the `readManifest` read pattern (`resolver.ts:317-345`).
- SNM-35 helpers: net-new code, but their shape is pinned by `computeHashVersion`'s output (`version.ts:33`) and they plug into existing same-file chokepoints (`renderVersion`, `composeVersionArrow`).
- All tests + catalog: same-file templates + Phase 22's lockstep precedent.
No greenfield file; no RESEARCH.md fallback (none exists -- CONTEXT.md is the saturated source).

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/`, `extensions/pi-claude-marketplace/shared/`, `extensions/pi-claude-marketplace/domain/`, `tests/orchestrators/plugin/`, `tests/shared/`, `tests/architecture/`, `tests/domain/`, `docs/`, `.planning/phases/22-reload-hint-discipline-family/`.
**Files scanned:** 10 (shared.ts, version.ts, resolver.ts, notify.ts, components/plugin.ts, install.test.ts, notify-v2.test.ts, catalog-uat.test.ts, output-catalog.md, 22-PATTERNS.md).
**Pattern extraction date:** 2026-05-29
