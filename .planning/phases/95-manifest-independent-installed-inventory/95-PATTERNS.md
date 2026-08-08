# Phase 95: Manifest-independent installed inventory - Pattern Map

**Mapped:** 2026-08-08
**Files analyzed:** 5 (1 new, 4 modified)
**Analogs found:** 5 / 5

All paths below are relative to the worktree root
`/home/acolomba/pi-claude-marketplace/.worktrees/manifest-independent-plugin-info`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/orchestrators/plugin/list-manifest-absent.test.ts` (**new**) | test | request-response (orchestrator-driven, byte-exact) | `tests/orchestrators/plugin/list.test.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (modified) | orchestrator (read-only row builder) | transform | sibling return arms **inside the same function** (`upgradable` / `partially-upgradable` arms, `list.ts:452-483`) | exact (self-analog) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` (modified) | render map (command-local) | transform | the `unavailable` / `partially-available` arms in the same map (`list.messaging.ts:117-139`) | exact (self-analog) |
| `extensions/pi-claude-marketplace/edge/handlers/tools.ts` (modified) | edge projection | transform | the existing `unavailable`/`partially-available`/`upgradable` conjunct in `pluginReasons` itself (`tools.ts:370-382`) | exact (self-analog) |
| `tests/edge/handlers/tools.test.ts` (modified) | test | request-response (tool execute) | the `force-installed` case at `tools.test.ts:555-625` + the details-assertion at `:698-713` | exact |

**Note on "self-analog":** this phase is a behavior edit inside four existing
files, not a greenfield add. The correct pattern source for each edit is the
sibling arm in the same construct, because the house rule that governs these
files (D-10 render-map totality, D-15-01 reasons typing, the
`exactOptionalPropertyTypes` spread idiom) is expressed there and nowhere else.

---

## Pattern Assignments

### `tests/orchestrators/plugin/list-manifest-absent.test.ts` (test, byte-exact orchestrator)

**Analog:** `tests/orchestrators/plugin/list.test.ts`

This is the only genuinely new file. Copy four things out of the analog: the
file header block, the import group, the three fixture helpers, and the
assertion idiom. None of the three helpers is exported — they must be copied,
not imported.

**File-header pattern** (`list.test.ts:1-26`) — a `//`-comment block naming the
subject, the requirement IDs covered, and the output-format notes. The new file
should carry the same shape, scoped to its own subject. Per
`.claude/rules/typescript-comments.md` the header and every `test("…")` title
may cite `INV-01`, `INV-02`, `BOUND-03`, `D-95-04`, `NFR-5`, but must NOT cite
`Phase 95`, `Wave N`, `Pitfall N`, or `v1.18`.

**Imports pattern** (`list.test.ts:27-52`) — node builtins, blank line,
third-party, blank line, project modules with explicit `.ts` extensions
alphabetized case-insensitively, blank line, `import type` group last:

```typescript
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { listPlugins } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/list.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
```

**Notification-capture harness** (`list.test.ts:54-77`) — copy verbatim. Note
`getAllTools: () => []`, which is what makes both soft-dep companions read
unloaded (so the `requires pi-subagents` marker fires as soon as a record
declares `resources.agents`):

```typescript
interface NotifyRecord {
  message: string;
  severity?: string;
}

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

**Hermetic-env pattern** (`list.test.ts:83-104`) — copy verbatim, including the
retrying `rm`. The retry is load-bearing (documented ENOTEMPTY race):

```typescript
async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "plug-list-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "plug-list-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ home, cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }
    await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}
```

**Seeding pattern** (`list.test.ts:154-277`, `seedMarketplace`) — copy, then
extend. The resources branch that must gain an `agents` / `mcp` option is
`list.test.ts:201-207`:

```typescript
    if (info.disabled === true) {
      resources = { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] };
    } else if (info.hooksOnly === true) {
      resources = { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [name] };
    } else {
      resources = { skills: [`${name}-skill`], prompts: [], agents: [], mcpServers: [], hooks: [] };
    }
```

The `compatibility` derivation that produces the INV-02 partial fixture is
immediately below (`list.test.ts:213-219`) — `unsupported: ["lspServers"]`
yields `installable: false` and the `{lsp}` brace:

```typescript
    const unsupported = info.unsupported ?? [];
    const compatibility = {
      installable: unsupported.length === 0,
      notes: [],
      supported: [],
      unsupported: [...unsupported],
    };
```

Manifest-absence is seeded by passing a manifest whose `plugins` array omits
the installed name (e.g. `manifest: { name: "mp1", plugins: [] }`) — **not** by
omitting `manifest`, which would instead produce a load error.

**Direct-`saveState` pattern for the BOUND-03 fold fixture**
(`list.test.ts:1234-1271`) — `seedMarketplace` allocates an independent
`marketplaceRoot`, so the clone case must write project state by hand with the
user record's root:

```typescript
    const sharedMpRoot = path.join(userRoot, "marketplaces", "mp1");
    const sharedManifestPath = path.join(sharedMpRoot, ".claude-plugin", "marketplace.json");
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 2,
      marketplaces: {
        mp1: {
          name: "mp1",
          scope: "project",
          source: pathSource("./mp1-src"),
          addedFromCwd: cwd,
          manifestPath: sharedManifestPath,
          // CLONE: same marketplaceRoot as the user-scope record.
          marketplaceRoot: sharedMpRoot,
          plugins: {
            alpha: {
              version: "1.0.0",
              resolvedSource: "./placeholder",
              compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
              resources: { skills: ["alpha-skill"], prompts: [], agents: [], mcpServers: [], hooks: [] },
              enabled: true,
              installedAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          },
        },
      },
    } as unknown as Parameters<typeof saveState>[1]);
```

For the **BOUND-03 negative** (manifest never loaded), keep `marketplaceRoot`
identical but point `manifestPath` at a nonexistent file — the fold still
triggers (`isCloneOfUserMarketplace` keys on `marketplaceRoot` only,
`list.ts:834`) while the project-side manifest read fails.

**Assertion pattern (D-95-09 byte-exact)** — the analog at
`list.test.ts:1488-1495` is the model the phase must follow. Full-message
equality on a joined line array, plus the single-notification contract:

```typescript
    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    assert.equal(
      notifications[0]!.message,
      ["● mp1 [user]", "  ◉ remote v1.0.0 (partially-installed) {lsp}"].join("\n"),
    );
```

Do **not** copy the regex/`assert.match` idiom used by the fold test at
`list.test.ts:1280-1293` for the new cases — D-95-09 requires byte-exact
equality. (That regex test stays as-is; it is not this phase's to rewrite.)

---

### `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (orchestrator, transform)

**Analog:** the sibling return arms of `installedRowMessage` itself.

**Conditional-field idiom** — under `exactOptionalPropertyTypes`, an optional
field is added by spreading a conditionally-empty object, never by
`field: cond ? x : undefined`. The two existing instances at `list.ts:355-359`
are the pattern a conditional `reasons` must copy:

```typescript
  const scopeField: { readonly scope?: Scope } =
    pluginScope === marketplaceScope ? {} : { scope: pluginScope };

  const descriptionField: { readonly description?: string } =
    manifestEntry?.description === undefined ? {} : { description: manifestEntry.description };
```

**Reasons-stamping arm** (`list.ts:441-450`) — the INV-02 change point. The
prepend must be built in array order (`composeReasons` joins in order, and
soft-dep markers append after), so `["not in manifest", ...narrowUnsupportedKinds(...)]`:

```typescript
  if (status === "partially-installed" || status === "partially-installed-upgradable") {
    return {
      status: "partially-installed",
      name: pluginName,
      reasons: narrowUnsupportedKinds(record.compatibility.unsupported),
      version: record.version,
      ...scopeField,
      ...descriptionField,
    };
  }
```

**Installed arm** (`list.ts:485-499`) — the INV-01 change point A. Note the
comment that D-95-03 requires rewriting (drop `RLD-04 / D-08` and the
"orphan-rewake" phrasing; state the durable-vs-transient rule directly). The
`needsReload: false` half of the comment is a **separate** fact and stays:

```typescript
  return {
    // RLD-04 / D-08: the list-surface inventory row is `installed` with
    // `needsReload: false` -- the stamped flag IS the old `present`
    // reload-suppression (the OR-reduce reload-hint stays suppressed for
    // steady-state inventory). `reasons` is OMITTED so the orphan-rewake brace
    // never leaks onto an inventory row.
    status: "installed",
    name: pluginName,
    dependencies: dependenciesFromDeclares(declaresAgents, declaresMcp),
    version: record.version,
    ...scopeField,
    ...descriptionField,
    severity: "info",
    needsReload: false,
  };
```

The same comment-rewrite applies to the function's doc block at
`list.ts:320-325`, which repeats the claim.

**Empty-array sentinel precedent** (`list.ts:469-482`) — when a required
`reasons` field has nothing to say, the house form is `reasons: []` with a
comment explaining that `composeReasons` renders `""` for it. Reuse this
reasoning rather than inventing a suppression branch.

**Signature-threading pattern (D-95-04)** — the bundle type already exists at
`list.ts:789-792` and its producer at `:794-803`:

```typescript
interface ScopedManifest {
  readonly manifest: MarketplaceManifest | undefined;
  readonly loadError: string | undefined;
}

async function loadMarketplaceManifestSoftly(
  mpRecord: ExtensionState["marketplaces"][string],
): Promise<ScopedManifest> {
  try {
    const manifest = await loadManifestSoftly(mpRecord.manifestPath);
    return { manifest, loadError: undefined };
  } catch (err) {
    return { manifest: undefined, loadError: errorMessage(err) };
  }
}
```

The parameter to replace is `enumerateMarketplacePlugins`' fifth positional
(`list.ts:729`, `manifest: MarketplaceManifest | undefined`); its three internal
consumers are `list.ts:738` (`manifest?.plugins.find`), `:756`
(`if (manifest === undefined) return rows;`), and `:760`
(`for (const manifestEntry of manifest.plugins)`). Both call sites are
`list.ts:877-884` (primary, always loaded) and `list.ts:987-993` (fold). The
defect line is `list.ts:977`:

```typescript
      const { manifest } = await loadMarketplaceManifestSoftly(projectMp);
```

which must become the whole-bundle destructure the primary path already uses at
`list.ts:853`:

```typescript
  const { manifest, loadError } = await loadMarketplaceManifestSoftly(mpRecord);
```

**Do not import** `platform/git.ts` or add a `gitOps` field while reshaping the
signature — `tests/architecture/no-orchestrator-network.test.ts` is a source-grep
gate over this file (NFR-5).

---

### `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` (render map, transform)

**Analog:** the reason-forwarding arms in the same `LIST_RENDER` map.

**Current suppressed arm** (`list.messaging.ts:96-106`) — INV-01 change point
B. The sixth argument to `installedLikeRow` is the reasons slot:

```typescript
const LIST_RENDER: { [K in ListStatus]: RenderFn<Extract<ListMsg, { status: K }>> } = {
  installed: (p, probe, mpScope) =>
    installedLikeRow(
      ICON_INSTALLED,
      p,
      mpScope,
      renderVersion(p.version),
      "(installed)",
      undefined,
      probe,
    ),
```

**Pattern to copy — a sibling arm that forwards `p.reasons`**
(`list.messaging.ts:117-126`):

```typescript
  unavailable: (p, probe, mpScope) =>
    joinTokens([
      ICON_UNINSTALLABLE,
      p.name,
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(unavailable)",
      composeReasons(p.reasons, false, false, probe),
    ]),
```

The `installed` arm keeps `installedLikeRow` (it is the only helper that threads
real `p.dependencies` soft-dep flags); only the `undefined` becomes `p.reasons`.

**Map doc-comment** (`list.messaging.ts:85-95`) — carries the same now-false
`RLD-04 / D-08` suppression rationale and must be rewritten alongside the arm
(D-95-03). Keep the second paragraph about the `available` / `unavailable`
`[<scope>]` carve-out; only the reasons sentence is falsified.

**Arms that need no change:** `partially-installed` (`:144-145`) already routes
through `pluginRow`, which forwards `p.reasons`; `disabled` (`:150-158`)
hardcodes `composeReasons(undefined, …)`, which is what makes INV-04
structurally guaranteed. Do not touch either.

---

### `extensions/pi-claude-marketplace/edge/handlers/tools.ts` (edge projection, transform)

**Analog:** `pluginReasons` itself (`tools.ts:370-382`) — the INV-05 change
point. The existing conjunct is the pattern; `partially-installed` joins it
directly (its `reasons` is required), while `installed` needs its own arm
because `PluginInstalledMessage.reasons?` is optional:

```typescript
function pluginReasons(p: PluginNotificationMessage): readonly string[] | undefined {
  if (
    p.status === "unavailable" ||
    p.status === "partially-available" ||
    p.status === "upgradable"
  ) {
    // USTAT-01: the `partially-available` row carries the same per-kind reason braces as
    // the `unavailable` row, so surface them on the tool details too.
    return p.reasons.length > 0 ? p.reasons : undefined;
  }

  return undefined;
}
```

**Exhaustive-switch precedent for status families** (`tools.ts:322-363`,
`pluginScopeOrFallback`) — this file's convention for enumerating list-surface
statuses is a `switch` with every arm listed and a comment naming the
requirement ID per family. If the reasons projection grows past two conjuncts,
mirror that shape rather than extending an `||` chain indefinitely.

The doc comment above `pluginReasons` (`tools.ts:365-369`) states that
`installed` omits reasons and goes stale under this change — rewrite it with the
edit.

---

### `tests/edge/handlers/tools.test.ts` (test, tool execute)

**Analog:** the existing manifest-absent partial fixture at `tools.test.ts:555-625`.

This fixture is already exactly the INV-05 `partially-installed` case:
`plugins: []` in the manifest (`:562`) plus `unsupported: ["themes"]` (`:586`).
Under the change its row gains `reasons: ["not in manifest", "unsupported component"]`.
Its assertions never read `reasons`, so it will not red-fail — but the comment
at `:553-554` becomes false and must be corrected:

```typescript
// version through. `pluginReasons` OMITS the force-installed row's reasons on
// the tool surface (only unavailable / unsupported / upgradable carry reasons).
```

**Details-assertion pattern to copy** (`tools.test.ts:698-713`):

```typescript
    const { pi, registered } = makeMockPi();
    registerListPluginsTool(pi);
    const tool = registered.get("pi_claude_marketplace_plugin_list")!;
    const ctx = makeCtx(cwd);
    const out = await tool.execute("call-1", { installed: true }, undefined, undefined, ctx);

    assert.match(out.content[0]!.text, /\[installed\] pupgrade/);
    const details = out.details as {
      plugins: { name: string; status: string; reasons?: unknown }[];
    };
    assert.equal(details.plugins.length, 1);
    assert.equal(details.plugins[0]!.name, "pupgrade");
    assert.equal(details.plugins[0]!.status, "installed");
    assert.equal(details.plugins[0]!.reasons, undefined);
```

Assert on `out.details.plugins[i].reasons`, not on the row builder — that is
what the phase's success criterion requires.

---

## Shared Patterns

### Reason composition (never hand-roll the brace)

**Source:** `shared/notify.ts:1990-2004` (`composeReasons`)
**Apply to:** every row that gains a reason in this phase

`composeReasons` returns `""` for an empty array (so no empty `{}` can render)
and pushes soft-dep markers **after** the caller's typed reasons. Consequences
the planner must encode:

- Order is array order → `["not in manifest", ...unsupportedKinds]` produces
  `{not in manifest, lsp}`; the reverse order fails a byte-exact test.
- Soft-dep markers land last → `{not in manifest, requires pi-subagents}`.
- Never build a `{…}` string in the orchestrator.

### Reason-token derivation

**Source:** `shared/probe-classifiers.ts:183-217` (`narrowUnsupportedKinds`)
**Apply to:** the `partially-installed` arm in `list.ts`

Already imported in `list.ts`. De-dupes and applies the `lspServers → lsp` /
`hooks → unsupported hooks` carve-outs; everything else → `unsupported component`.
No local switch.

### Closed-set membership (COMPAT-01)

**Source:** `shared/notify-reasons.ts:125` — `"not in manifest"` is already a
member; `ContentReason = Exclude<Reason, "not added">` (`notify.ts:189`).
**Apply to:** all four production edits

No token is added, so `tests/architecture/notify-closed-set-locks.test.ts` needs
no count bump. Any change that would require one is out of scope.

### Disabled-state predicate

**Source:** `isRecordedButDisabled`, imported at `list.ts:73` from
`../reconcile/plan.ts`, used at `list.ts:367`
**Apply to:** the INV-04 characterization fixture

Seed the canonical shape (empty `resources` + `compatibility.installable: true`
+ `enabled: false`) so the row routes through the `disabled` arm. Do not write a
local `enabled === false` check anywhere — a later phase replaces this
predicate's definition and a local copy would escape the repair.

### Comment policy on every rewritten comment

**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** `list.ts:320-325`, `list.ts:486-490`, `list.messaging.ts:85-95`,
`tools.ts:365-369`, `tools.test.ts:553-554`, and every `test("…")` title in the
new file

Keep requirement/decision IDs (`INV-01`, `BOUND-03`, `D-95-04`, `NFR-5`,
`FSTAT-02`). Drop `Phase NN`, `Wave N`, bare `Pitfall N`, and `vX.Y milestone`.
Per D-95-03 also drop `RLD-04 / D-08` from the comments being rewritten — they
resolve to nothing — and do not sweep the other occurrences
(`list.ts:29/100/994/1095`, `tools.ts:161/327/392`).

### Test file naming (subject split)

**Source:** existing splits `git-source-probe` / `git-source-probe-upgrade`,
`clone-gc` / `clone-gc-errors` under `tests/orchestrators/plugin/`
**Apply to:** `list-manifest-absent.test.ts`

`<subject>-<qualifier>.test.ts` beside the parent file, kebab-case, own header
block naming its own scope.

## No Analog Found

None. Every file in this phase either already exists or has an exact in-repo
template.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/`,
`extensions/pi-claude-marketplace/edge/handlers/`,
`extensions/pi-claude-marketplace/shared/`, `tests/orchestrators/plugin/`,
`tests/edge/handlers/`
**Files read this session:** 6 (`list.ts`, `list.messaging.ts`, `tools.ts`,
`list.test.ts`, `tools.test.ts`, `.claude/rules/typescript-comments.md`)
**Pattern extraction date:** 2026-08-08
