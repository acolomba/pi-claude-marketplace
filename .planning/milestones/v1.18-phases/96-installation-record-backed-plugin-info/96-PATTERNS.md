# Phase 96: Installation-record-backed plugin info - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 7 (0 created in production, 1 created in tests)
**Analogs found:** 7 / 7

All paths are relative to the worktree
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info`.

**Headline finding (confirms RESEARCH § "Don't Hand-Roll"):** every analog for the
production change is a *sibling arm inside the same file*. `info.ts` is a
self-analog. Do not go shopping in other orchestrators for row-builder shapes.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (MODIFY: arm-(b) split + `buildStateOnlyInstalledRow` + `composeStateOnlyComponents` + `readStateOnlyHookEntries`) | orchestrator | read-only / request-response | same file: `buildBlock` (671-779), `buildNonPathInstalledRow` (958-976), `readHookSummaryEntries` (458-478), `discoverComponentNames` (313-331) | exact (self-analog) |
| `.../orchestrators/plugin/info.ts` — hooks disk read | orchestrator (I/O) | file-I/O | `bridges/hooks/event-router.ts:594-641` (the identical state-slug read + containment) | exact |
| `.../orchestrators/plugin/info.messaging.ts` (MODIFY, only if D-96-04 lands as a cascade row) | messaging / render map | event-driven render | same file: the `disabled` arm (44-66) | exact (self-analog) |
| `docs/output-catalog.md` (MODIFY: new info states + close the line-412 note) | docs (binding contract) | documentation | `docs/output-catalog.md:403-423` (`manifest-absent-inventory`, `manifest-absent-partially-installed-inventory`) | exact |
| `tests/architecture/catalog-uat.test.ts` (MODIFY: fixtures) | test (architecture gate) | data-fixture | same file: `"/claude:plugin info <plugin>@<marketplace>"` map at 2738-2803 | exact |
| `tests/orchestrators/plugin/info-manifest-absent.test.ts` (**NEW**) | test (orchestrator integration) | request-response | `tests/orchestrators/plugin/list-manifest-absent.test.ts:1-135` | exact |
| `tests/orchestrators/plugin/info.test.ts` (MODIFY: BOUND-01 regression w/ installed record) | test | request-response | same file: `WR-03` test at 1093-1129 (+ `UXG-08` at 718-744 for the byte form) | exact (self-analog) |
| `tests/orchestrators/plugin/list-manifest-absent.test.ts` (MODIFY: D-96-02 fold pins) | test | request-response | same file, BOUND-03 fold fixtures | exact (self-analog) |

---

## Pattern Assignments

### `orchestrators/plugin/info.ts` — the arm-(b) split (orchestrator, read-only)

**Analog:** itself, `buildBlock` lines 671-779.

**Exact insertion point** (lines 717-737, verbatim today). The `installed`
binding at 737 hoists ABOVE line 720; the `entry === undefined` body gains an
inner branch whose *else* arm is byte-identical to what is there now:

```typescript
  // (b) Plugin name not in manifest -> `(failed) {not in manifest}`.
  // Same `componentsResolved: true` + empty components rationale as
  // (a) above.
  const entry = manifest.plugins.find((p) => p.name === pluginName);
  if (entry === undefined) {
    return {
      kind: "plugin-info",
      marketplaceName: marketplace,
      marketplaceScope: scope,
      marketplaceDetails,
      plugin: {
        status: "failed",
        name: pluginName,
        reasons: ["not in manifest"],
        componentsResolved: true,
        components: {},
      },
    };
  }

  const installed = mpRecord.plugins[pluginName];
```

**Arm (a) must stay first — copy nothing, move nothing** (lines 698-715). Its
comment already documents the `componentsResolved: true` + empty-components
rationale that BOUND-01 depends on:

```typescript
  let manifest: MarketplaceManifest;
  try {
    manifest = await loadMarketplaceManifest(mpRecord.manifestPath);
  } catch (err) {
    return {
      kind: "plugin-info",
      /* … */
      plugin: {
        status: "failed",
        name: pluginName,
        reasons: [narrowProbeError(err)],
        componentsResolved: true,
        components: {},
      },
    };
  }
```

**Block-wrap pattern** (line 764) — the state-only arm returns through the same
helper the installed arm uses, not a hand-built envelope:

```typescript
    return wrapBlock(marketplace, scope, marketplaceDetails, row);
```

**Complexity discipline pattern** (`partitionDisabledScopes`, lines 1764-1797) —
the house answer to the `sonarjs/cognitive-complexity: 15` ceiling is a named
module-level extraction with a doc comment that says so:

```typescript
/**
 * D-54-01 / ENBL-04: split the found (scope, record) tuples into the
 * disabled-inventory blocks (recorded-but-disabled marker present) and the
 * info-surface tuples that proceed through `buildBlock`. Extracted from
 * `getPluginInfo` to keep its cognitive complexity within the lint budget.
 */
```

Apply the same shape: `buildBlock` gains only
`if (installed !== undefined) { return wrapBlock(…, await buildStateOnlyInstalledRow(…)); }`.

---

### `orchestrators/plugin/info.ts` — the status/reasons derivation (INFO-09 / INFO-10)

**Analog:** `buildNonPathInstalledRow`, lines 958-976 — copy the derivation and
the conditional-spread idiom verbatim, change only `componentsResolved` and the
reason prefix:

```typescript
function buildNonPathInstalledRow(
  pluginName: string,
  version: string | undefined,
  description: string | undefined,
  installedRecord: MarketplaceRecord["plugins"][string],
): PluginInfoRow {
  const status =
    installedRecord.compatibility.unsupported.length > 0 ? "partially-installed" : "installed";
  return {
    status,
    name: pluginName,
    ...(version !== undefined && { version }),
    ...(description !== undefined && { description }),
    ...(status === "partially-installed" && {
      reasons: narrowUnsupportedKinds(installedRecord.compatibility.unsupported),
    }),
    componentsResolved: false,
  };
}
```

Two deltas the state-only arm makes, both required:

1. `componentsResolved: true` (the components ARE known — `false` would emit the
   external-source `components: not resolved` marker).
2. `reasons` is unconditional and absence-first:
   `["not in manifest", ...narrowUnsupportedKinds(record.compatibility.unsupported)]`
   — the ordering rule is already implemented in `list.ts:321-327`
   (`partiallyInstalledReasons`).

`sonarjs/no-identical-functions` is `error`: if the status ternary alone trips
it, extract the shared `status` computation rather than duplicating.

**`exactOptionalPropertyTypes` rule:** add optional fields ONLY by conditional
spread (`...(cond && { field })`), never `field: cond ? x : undefined`. Every
row builder in the file already obeys this.

---

### `orchestrators/plugin/info.ts` — component reconstruction (INFO-11)

**Sort comparator analog** (`discoverComponentNames`, line 330) — reuse the
exact comparator so the state-only and manifest-backed surfaces sort identically:

```typescript
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
```

**Hooks parse + project analog** (`readHookSummaryEntries`, lines 458-478) —
copy the `ifCtx` / `noopCompileIf` / `skipIfMap` idiom exactly; the only change
is the path source and dropping `projectDroppedHookEntries` (the materialized
file is already the filtered subset, so `dropped` is empty):

```typescript
  const raw = await readFile(path.join(pluginRoot, hooksConfigPath), "utf8");
  // MATCH-03 / A1 projectRoot fallback: mirrors the resolver's
  // `readStandaloneHooks` call site. The info surface only consumes the
  // installable-verdict + parsed value; the `if`-field side-Map is
  // discarded via `skipIfMap: true`, and the no-op `compileIf` is never
  // invoked.
  const ifCtx = { homedir: homedir(), cwd: process.cwd(), projectRoot: process.cwd() };
  const noopCompileIf = (): null => null;
  const parsed = parseHooksConfig(raw, ifCtx, noopCompileIf, { skipIfMap: true });
  if (!parsed.ok) {
    return undefined;
  }

  const supported = projectHookSummaryEntries(parsed.value);
```

`homedir`, `readFile`, `path`, `parseHooksConfig`, `assertPathInside`,
`narrowProbeError`, `narrowUnsupportedKinds`, `locationsFor` / `ScopedLocations`
are ALL already imported at `info.ts:29-68`. The only new import needed is
`hookConfigPathFor` from `../../bridges/hooks/stage.ts` — add it to the relative
import group, alphabetized, `newlines-between: "always"`.

**Read-site containment analog** (`bridges/hooks/event-router.ts:594-641) — copy
the loop shape *and* the rationale comment; this is the identical input
(`resources.hooks` slugs) under the identical threat:

```typescript
      const hookSlugs = pluginRecord.resources.hooks;
      if (hookSlugs.length === 0) {
        continue;
      }

      // D-57-03: `resources.hooks` carries the per-plugin hooks-container-dir
      // generatedName; the on-disk file is `<hooksDir>/<generatedName>/hooks.json`.
      // Zero or one entry today; iterate defensively for forward-compat.
      for (const slug of hookSlugs) {
        const hooksJsonPath = path.join(loc.hooksDir, slug, "hooks.json");
```

```typescript
  // Defense-in-depth (NFR-10): state.json is normally written only by this
  // extension, but the slug component (`pluginRecord.resources.hooks[i]`) is
  // state-supplied data. A corrupted state record (third-party tampering or
  // future schema mismatch) carrying a traversal slug like `"../../etc"` must
  // not let `readFile` escape `loc.hooksDir`. Mirror the WRITE-site guard at
  // this READ site.
  try {
    await assertPathInside(hooksDir, hooksJsonPath, "hooks.json hydrate path");
```

Two deltas: compose the path with `hookConfigPathFor(locations, slug)` instead
of the inline `path.join` (it is the exported sanctioned composer), and collapse
the failure to a `ContentReason` marker instead of `hookDebugLog` + `return`
(D-96-03 — the info surface must SHOW the degradation, not log it).

---

### `orchestrators/plugin/info.messaging.ts` (messaging, event-driven) — only if D-96-04 renders as a cascade row

**Analog:** the file's own `disabled` arm (44-66).

```typescript
export const PLUGIN_INFO_STATUSES = ["disabled"] as const;
export type PluginInfoStatus = (typeof PLUGIN_INFO_STATUSES)[number];

const PLUGIN_INFO_RENDER: {
  [K in PluginInfoStatus]: RenderFn<Extract<PluginInfoCascadeMsg, { status: K }>>;
} = {
  disabled: (p, probe, mpScope) =>
    joinTokens([
      ICON_DISABLED,
      p.name,
      renderScopeBracket(p.scope, mpScope),
      renderVersion(p.version),
      "(disabled)",
      composeReasons(undefined, false, false, probe),
    ]),
};

export const PLUGIN_INFO_CONTEXT = {
  Messaging: { label: "Plugin info" },
  render: PLUGIN_INFO_RENDER,
} as const satisfies CommandContext<PluginInfoStatus, PluginInfoCascadeMsg>;
```

A `skipped` arm is a copy of this arm with `ICON_UNINSTALLABLE` and
`"(skipped)"`. Widening `PLUGIN_INFO_STATUSES` forces the render map total by
the `as const satisfies` pin — that is the intended compile-time gate, not a
nuisance.

**Second-notify precedent** (`info.ts:1926-1934`) — if the skip note becomes a
second notification, cite the same justification the disabled path already
carries (a deliberate, commented IL-2 break):

```typescript
  // D-54-01 / ENBL-04: surface the disabled-inventory scopes through the
  // list-arm cascade. Mixed disabled+info renders break IL-2's single-notify
  // rule the same way the GRAM-04 failure separation below does -- the two
  // surfaces have incompatible message kinds, and hiding one behind the
  // other would silently drop a scope's state.
  if (disabledBlocks.length > 0) {
    const rows: Plural<MarketplaceRows<PluginInfoCascadeMsg>> = disabledBlocks;
    notifyWithContext(opts.ctx, opts.pi, PLUGIN_INFO_CONTEXT, rows);
  }
```

---

### `docs/output-catalog.md` (docs, byte-gated contract)

**Analog:** `docs/output-catalog.md:403-423` — the two Phase 95 manifest-absent
list states. Copy the entry skeleton exactly: `###` heading with the requirement
IDs in parentheses, blank line, the `<!-- catalog-state: … -->` annotation,
blank line, a fenced ```text block, blank line, one prose paragraph that ends
with the severity and the reload-hint statement.

```markdown
### Manifest-absent inventory row (INV-01)

<!-- catalog-state: manifest-absent-inventory -->

```text
● official [user] <autoupdate>
  ● orphan-plugin v1.0.0 (installed) {not in manifest}
```

An installed record whose marketplace manifest LOADED successfully but does not
declare it carries the `not in manifest` reason (INV-01). […] Severity `info`;
no reload-hint (inventory row).
```

Two placement facts:

- New **info** states go under `## /claude:plugin info <plugin>@<marketplace>`
  at **line 1441**, beside the existing `installed-single-scope` (1451) …
  `missing-plugin-not-in-manifest` (1555) blocks — NOT beside the list states at
  403-423.
- The D-96-02 close is a prose edit at **line 412**: delete the sentence
  "Which manifest a folded row SHOULD describe at all is still open (BOUND-01 /
  BOUND-02)." and replace it with the settled rule. Prose edits are safe; the
  fenced block above it must not move a byte.
- D-96-01's divergence note (installed generated names vs the manifest-backed
  arm's source names) lands in the new info entry's prose paragraph.
- The `simple-english` project skill applies to all new catalog prose.

---

### `tests/architecture/catalog-uat.test.ts` (test, data-fixture)

**Analog:** the same file's info fixture map, 2738-2803. Every fixture is a
*pure `NotificationMessage` literal* — never synthesized from a domain helper
(the SNM-31 scope gate):

```typescript
  "/claude:plugin info <plugin>@<marketplace>": {
    "installed-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "claude-plugins-official",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: true },
        plugin: {
          status: "installed",
          name: "commit-commands",
          version: "1.2.0",
          description: "Helpful git commit commands for everyday use.",
          componentsResolved: true,
          components: {
            agents: ["review-bot"],
            commands: ["c1", "c2"],
            skills: ["commit-summary"],
          },
        },
      } satisfies NotificationMessage,
    },
```

The block-comment header at 2716-2737 enumerates every state and its severity
routing — extend that list in the same style when adding fixtures. `info`
severity omits `expectedSeverity`; anything else states it. The gate is
bidirectional: a catalog state with no fixture and a fixture with no catalog
state both fail.

---

### `tests/orchestrators/plugin/info-manifest-absent.test.ts` (**NEW** test suite)

**Analog:** `tests/orchestrators/plugin/list-manifest-absent.test.ts:1-135`.
Copy the whole preamble shape. House convention: helpers are **file-private —
copy, do not import**.

**File header pattern** (1-25) — path comment, why the suite is split out,
an explicit requirement-coverage list, the assertion-style contract, and the
fixture note:

```typescript
// tests/orchestrators/plugin/list-manifest-absent.test.ts
//
// Byte-exact characterization of `listPlugins` rows whose installed record is
// ABSENT from a marketplace manifest that loaded successfully. […]
//
// Requirement coverage:
//   - INV-01 an enabled, fully supported manifest-absent record
//   […]
// Assertions are whole-message equality against a `[...].join("\n")` literal
// (D-95-09), never a partial regex match: token, glyph, spacing and ordering
// drift is exactly the regression class INV-02 and INV-03 exist to catch.
//
// Fixture note: manifest ABSENCE is seeded by a manifest whose `plugins` array
// omits the installed name. Omitting the manifest file instead produces a
// manifest LOAD ERROR and a `(failed)` marketplace header (BOUND-01) -- a
// different state entirely.
```

**`makeCtx` pattern** (53-71) — the notification recorder:

```typescript
function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const pi = {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
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

**`withHermeticHome` pattern** (77-98) — including the retry-rm comment, which
is load-bearing (a probe can race the teardown):

```typescript
async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "plug-list-abs-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "plug-list-abs-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ home, cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    // Retry rmdir: a recursive rm can race a lingering async write (a probe
    // or clone-cache op) and hit ENOTEMPTY on rmdir; retry until it settles.
    await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
```

Rename the tmp prefixes to `plug-info-abs-*`. The seeding helper for the new
suite is `seedPathMarketplace` (the shape `info.test.ts` uses), not
`seedMarketplace` — see the option-object doc-comment style at
`list-manifest-absent.test.ts:100-135` for how to document each seeded field.

**Byte-exact assertion pattern** (from `info.test.ts:734-742` — the info surface
form, with the summary line and blank line the list suite does not have):

```typescript
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.equal(
      notifications[0]!.message,
      [
        "A plugin operation has failed.",
        "",
        "● mp [user] <no autoupdate>",
        "  ⊘ ghost (failed) {not in manifest}",
      ].join("\n"),
    );
```

For the new `(installed)` states, severity is `info` — assert its absence or its
value explicitly, and expect NO summary line (`buildSummaryLine` returns `""`
for a non-failed `plugin-info`).

**INFO-12 zero-call pattern** (`info.test.ts:2799-2806` + `2915-2950`) — copy
`fetchSeamWith` file-private, then the seam-injected zero-call body with
`fetch: true`:

```typescript
function fetchSeamWith(gitOps: GitOps): InfoCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
  };
}
```

```typescript
    // The seam is provided but `fetch` is omitted: the hook must NOT run.
    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx, pi, marketplace: "mp", plugin: "gplug", scope: "user", cwd,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(gitState.cloneCalls.length, 0, "bare info must not clone (network-free)");
    assert.equal(gitState.fetchCalls.length, 0, "bare info must not fetch (network-free)");
```

INFO-12's version is this body with `fetch: true`, a manifest-absent installed
record, plus `credState.fillCalls.length === 0`.

---

### `tests/orchestrators/plugin/info.test.ts` — the BOUND-01 regression (write FIRST)

**Analog:** the `WR-03` test in the same file, 1093-1129. It is the missing-
manifest fixture already; the ONLY delta is seeding a plugin record where it
currently writes `plugins: {}` (line 1115):

```typescript
test("WR-03: marketplace.json missing on disk surfaces `{source missing}` failure row", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const locations = locationsFor("user", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });

    const mpRoot = path.join(userRoot, "marketplaces", "mp");
    const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
    // Intentionally do NOT write the manifest file -- the state record
    // points at a path that does not exist.
    await mkdir(path.dirname(manifestPath), { recursive: true });

    await saveState(locations.extensionRoot, {
      schemaVersion: 2,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: pathSource("./mp-src"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: mpRoot,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "x", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    const msg = notifications[0]!.message;
    assert.match(msg, /\(failed\) \{source missing\}/);
  });
});
```

Add a sibling test (do not edit this one) that seeds a populated
`plugins: { x: {…} }` record and asserts the SAME `(failed) {source missing}`
bytes plus the absence of any component line. Use whole-message `join("\n")`
equality rather than the `assert.match` this older test uses — the newer house
style (D-95-09) is byte-exact.

**Do not modify the GRAM-04 test** (754-804). Its `ghost` name is in neither
state nor manifest, so it keeps exercising the failed path after the split —
verified by reading the fixture: both `seedPathMarketplace` calls declare only
`real`, and neither seeds an installed record for `ghost`.

---

## Shared Patterns

### Reason stamping (orchestrator stamps, notify renders)

**Source:** `shared/probe-classifiers.ts` via `info.ts:64-68`
**Apply to:** every reason on the new row.

```typescript
import {
  narrowProbeError,
  narrowResolverNotes,
  narrowUnsupportedKinds,
} from "../../shared/probe-classifiers.ts";
```

`narrowUnsupportedKinds` is the sole producer of kind tokens; `narrowProbeError`
is the sole classifier for a read throw. No local kind→token switch, no
hardcoded `"unreadable"`. There is no allowlist in the render path (D-95-01..03),
so a reason the orchestrator stamps renders as-is.

### Containment on state-supplied path components (NFR-10)

**Source:** `shared/path-safety.ts::assertPathInside`, read-site precedent at
`bridges/hooks/event-router.ts:628-641`
**Apply to:** the single new disk read (`<hooksDir>/<slug>/hooks.json`).

Guard at the READ site, inside a `try`, before `readFile`. Excerpt quoted above.

### Optional-field construction under `exactOptionalPropertyTypes`

**Source:** `info.ts:966-975`
**Apply to:** every row and component-map field.

```typescript
    ...(version !== undefined && { version }),
    ...(status === "partially-installed" && { reasons: … }),
```

Never `field: cond ? x : undefined`. For an annotation on an indexed access,
wrap in `NonNullable<…>`.

### Comment / test-title anchors

**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** every new comment and `test(…)` title.

Cite `INFO-09`…`INFO-12`, `BOUND-01/02`, `D-96-01`…`D-96-04`, `NFR-5`, `NFR-10`,
`D-57-03`, `HOOK-02`. Forbidden: `Phase NN`, `Plan NN`, `Wave N`, bare
`Pitfall N` / `Pattern N`, `milestone vX.Y`.

### Source-scanning gates must use `readFile`, never `grep`

**Source:** `tests/architecture/no-orchestrator-network.test.ts:100`
**Apply to:** any new architectural gate over `info.ts`.

`info.ts:416` contains a literal NUL byte, so `grep` classifies the file binary
and silently skips it (COMPAT-01).

---

## No Analog Found

None. Every file has a close in-repo match.

Two design points are *open choices*, not missing analogs — the planner picks
from precedents that already exist:

| Open point | Candidate precedents |
|------------|----------------------|
| D-96-03 hooks degradation marker | Existing tokens `source missing` / `permission denied` / `unreadable` / `unparseable` via the `narrowProbeError` ladder (`info.ts:710`) — free. A NEW token is a four-place amendment (`REASONS` in `notify.ts`, a topic group in `notify-reasons.ts`, the `REASONS.length === 38` assertion, the catalog reference table) plus a DOC-08 ripple. |
| D-96-04 skip-note shape | `⊘ hello v1.0.0 (skipped) {not in manifest}` (`tests/orchestrators/plugin/update.test.ts:437`); the cascade-row mechanism is `info.messaging.ts`'s `disabled` arm; the second-notify justification is `info.ts:1926-1934`. `PluginInfoRow.status` does NOT admit `skipped`, so the standalone row cannot carry it. |

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/`,
`extensions/pi-claude-marketplace/bridges/hooks/`,
`extensions/pi-claude-marketplace/shared/`, `tests/orchestrators/plugin/`,
`tests/architecture/`, `docs/`
**Files read for excerpts:** 8 (`info.ts` in 5 non-overlapping ranges,
`info.messaging.ts`, `event-router.ts`, `list-manifest-absent.test.ts`,
`info.test.ts` in 3 ranges, `catalog-uat.test.ts`, `output-catalog.md`)
**Pattern extraction date:** 2026-08-08
