# Phase 106: Workflow detection and partial install - Pattern map

**Mapped:** 2026-08-29
**Files analyzed:** 15 existing files
**Analogs found:** 15 / 15

Phase 106 extends the existing unsupported-component pipeline. It creates no
production file and adds no workflow bridge, loader, ledger phase, resource
field, or discovery result.

## File classification

| New or modified file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/domain/components/plugin.ts` | model | transform | Its opaque unsupported fields | exact |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | service | file-I/O | Its unsupported tuple, convention table, collector, and state decision | exact |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | utility | transform | Its `hooks` and `lspServers` kind mappings | exact |
| `extensions/pi-claude-marketplace/shared/notify.ts` | config | request-response | Its append-only `REASONS` tuple | exact |
| `extensions/pi-claude-marketplace/shared/notify-reasons.ts` | config | transform | Its unsupported reason group and completeness proof | exact |
| `tests/domain/manifest.test.ts` | test | transform | Its opaque unsupported-field admission cases | exact |
| `tests/domain/resolver-strict.test.ts` | test | file-I/O | Its fixed-convention, multi-kind, and structural-precedence cases | exact |
| `tests/domain/resolver-loose.test.ts` | test | file-I/O | Its loose-mode partial cases | exact |
| `tests/shared/probe-classifiers.test.ts` | test | transform | Its special-kind, order, and deduplication cases | exact |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | test | transform | Its typed-kind parity matrix and multi-kind case | exact |
| `tests/orchestrators/plugin/install.test.ts` | test | file-I/O | Its seeded partial-install, strict rejection, persistence, and disk assertions | exact |
| `tests/orchestrators/discover.test.ts` | test | file-I/O | Its exact `skillPaths` and `promptPaths` result assertions | exact |
| `tests/architecture/notify-closed-set-locks.test.ts` | test | transform | Its deliberate tuple-length bump | exact |
| `tests/architecture/catalog-uat.test.ts` | test | request-response | Its byte-level partial inventory and rejection fixtures | exact |
| `docs/output-catalog.md` | config | request-response | Its partial inventory, rejection, and success examples | exact |

## Pattern assignments

### `domain/components/plugin.ts` (model, transform)

**Analog:** `extensions/pi-claude-marketplace/domain/components/plugin.ts`

The shared opaque field object is the correct insertion point. Both declaration
schemas already spread this object.

**Opaque field pattern** (lines 34-44):

```typescript
const UNSUPPORTED_COMPONENT_FIELDS = {
  hooks: Type.Optional(Type.Unknown()),
  lspServers: Type.Optional(Type.Unknown()),
  monitors: Type.Optional(Type.Unknown()),
  themes: Type.Optional(Type.Unknown()),
  outputStyles: Type.Optional(Type.Unknown()),
  channels: Type.Optional(Type.Unknown()),
  userConfig: Type.Optional(Type.Unknown()),
  bin: Type.Optional(Type.Unknown()),
  settings: Type.Optional(Type.Unknown()),
};
```

**Shared schema pattern** (lines 61-81 and 93-102):

```typescript
export const PLUGIN_ENTRY_SCHEMA = Type.Object({
  name: Type.String(),
  source: Type.Unknown(),
  ...PLUGIN_METADATA_FIELDS,
  ...SUPPORTED_COMPONENT_PATH_FIELDS,
  ...UNSUPPORTED_COMPONENT_FIELDS,
  mcpServers: Type.Optional(McpServersField),
  dependencies: Type.Optional(Type.Unknown()),
});

const PLUGIN_MANIFEST_SCHEMA = Type.Object({
  name: Type.Optional(Type.String()),
  ...PLUGIN_METADATA_FIELDS,
  ...SUPPORTED_COMPONENT_PATH_FIELDS,
  ...UNSUPPORTED_COMPONENT_FIELDS,
  mcpServers: Type.Optional(McpServersField),
  dependencies: Type.Optional(Type.Unknown()),
});
```

Add `workflows: Type.Optional(Type.Unknown())` at the tail of
`UNSUPPORTED_COMPONENT_FIELDS`. Do not interpret its value.

---

### `domain/resolver.ts` (service, file-I/O)

**Analog:** `extensions/pi-claude-marketplace/domain/resolver.ts`

Use the existing tuple and fixed convention table. Append both new entries so
all current positions stay stable.

**Closed kind and convention pattern** (lines 375-397):

```typescript
export const UNSUPPORTED_COMPONENT_KINDS = [
  "lspServers",
  "monitors",
  "themes",
  "outputStyles",
  "channels",
  "userConfig",
  "settings",
] as const;

const UNSUPPORTED_COMPONENT_CONVENTIONS = {
  lspServers: [{ relativePath: ".lsp.json", kind: "file" }],
  monitors: [{ relativePath: path.join("monitors", "monitors.json"), kind: "file" }],
  themes: [{ relativePath: "themes", kind: "dir" }],
  outputStyles: [{ relativePath: "output-styles", kind: "dir" }],
  settings: [{ relativePath: "settings.json", kind: "file" }],
};
```

Add `workflows` after `settings`. Map it to
`[{ relativePath: "workflows", kind: "dir" }]`.

**Presence and fixed-path collection pattern** (lines 511-567):

```typescript
function declaresUnsupportedKind(
  kind: UnsupportedKind,
  entry: Record<string, unknown>,
  manifest: Record<string, unknown> | null,
): boolean {
  if (entry[kind] !== undefined || manifest?.[kind] !== undefined) {
    return true;
  }

  if (kind === "themes" || kind === "monitors") {
    return (
      nestedExperimentalValue(entry, kind) !== undefined ||
      nestedExperimentalValue(manifest, kind) !== undefined
    );
  }

  return false;
}

async function hasUnsupportedConvention(
  ctx: ResolveContext,
  pluginRoot: string,
  kind: UnsupportedKind,
): Promise<boolean> {
  for (const convention of UNSUPPORTED_COMPONENT_CONVENTIONS[kind] ?? []) {
    if (
      (await statKindOf(ctx)(path.join(pluginRoot, convention.relativePath))) === convention.kind
    ) {
      return true;
    }
  }
  return false;
}

for (const kind of UNSUPPORTED_COMPONENT_KINDS) {
  if (declaresUnsupportedKind(kind, entry, manifest)) {
    found.push(kind);
    continue;
  }
  if (await hasUnsupportedConvention(ctx, pluginRoot, kind)) {
    found.push(kind);
  }
}
```

Keep `workflows` out of the `experimental` exception. The normal top-level
presence rule covers entry and manifest declarations. The `continue` makes a
declaration plus directory produce one kind.

**Structural precedence pattern** (lines 1625-1640):

```typescript
function decideResolution(
  name: string,
  pluginRoot: string,
  partial: PartialResolution,
  structuralDirty: boolean,
  defaultEnabled: boolean,
): ResolvedPlugin {
  if (structuralDirty) {
    return unavailable(name, partial.notes);
  }
  if (partial.unsupported.length > 0) {
    return partiallyAvailable(name, pluginRoot, partial, defaultEnabled);
  }
  return installable(name, pluginRoot, partial, defaultEnabled);
}
```

Do not change this decision. `workflows` is a soft unsupported signal, not a
structural defect.

---

### `shared/probe-classifiers.ts` (utility, transform)

**Analog:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`

Extend the special-kind mapping once. Every typed-kind consumer already calls
this helper.

**Closed reason type and first-wins mapping** (lines 74-75 and 183-216):

```typescript
export type UnsupportedReason =
  "unsupported hooks" | "lsp" | "unsupported source" | "unsupported component";

export function narrowUnsupportedKinds(
  unsupported: readonly string[],
): readonly UnsupportedReason[] {
  const out: UnsupportedReason[] = [];
  const seen = new Set<string>();
  for (const kind of unsupported) {
    const reason = kindToReason(kind);
    if (!seen.has(reason)) {
      out.push(reason);
      seen.add(reason);
    }
  }
  return out;
}

function kindToReason(kind: string): UnsupportedReason {
  if (kind === "lspServers") return "lsp";
  if (kind === "hooks") return "unsupported hooks";
  return "unsupported component";
}
```

Add `"workflows"` to `UnsupportedReason`. Add the dedicated branch before the
generic return. Do not add `workflows` to `MANIFEST_FIELD_REASONS` in
`install.messaging.ts`. The typed unsupported list already reaches
`narrowUnsupportedKinds` first.

---

### `shared/notify.ts` (config, request-response)

**Analog:** `extensions/pi-claude-marketplace/shared/notify.ts`

The tuple is append-only. Existing order is a byte contract.

**Append-only reason vocabulary** (lines 84-95 and 199-202):

```typescript
export const REASONS = [
  "up-to-date",
  // existing members keep their positions
  "installs disabled",
] as const;

export type Reason = (typeof REASONS)[number];
```

Append `"workflows"` after `"installs disabled"`. Update the nearby count from
39 to 40. Do not change glyph or status tuples.

---

### `shared/notify-reasons.ts` (config, transform)

**Analog:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts`

Put the new reason in the unsupported topic group. The existing type proof
then makes an incomplete edit fail compilation.

**Unsupported group and coverage pattern** (lines 97-105 and 226-257):

```typescript
type UnsupportedReason =
  | "unsupported hooks"
  | "lsp"
  | "requires pi-subagents"
  | "requires pi-mcp"
  | "unsupported source"
  | "unsupported component"
  | "no longer installable";

type SharedTopicReason = IdempotentReason | UnsupportedReason | FailureReason | DeclaredStateReason;

type _UncoveredReason = Exclude<Reason, SharedTopicReason | CommandPrivateReason>;
type _ExtraReason = Exclude<SharedTopicReason | CommandPrivateReason, Reason>;
export type _ReasonsCoverageProof = [_AssertNever<_UncoveredReason>, _AssertNever<_ExtraReason>];
```

Add `| "workflows"` beside the other unsupported component reasons. Update the
count history from 39 to 40.

---

### `tests/domain/manifest.test.ts` (test, transform)

**Analog:** `tests/domain/manifest.test.ts`

**Marketplace-entry admission** (lines 194-205):

```typescript
test("MM-2 PLUGIN_ENTRY accepts opaque unsupported components", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({
      name: "p",
      source: "./local",
      hooks: { someHook: { command: "x" } },
      themes: ["dark"],
      settings: { foo: "bar" },
    }),
    true,
  );
});
```

**Standalone manifest admission** (lines 386-398):

```typescript
test("PLUGIN_MANIFEST accepts full shape", () => {
  assert.equal(
    PLUGIN_MANIFEST_VALIDATOR.Check({
      name: "p",
      version: "1.0.0",
      description: "x",
      mcpServers: { srv: {} },
      hooks: { a: 1 },
      dependencies: { other: "1.0" },
    }),
    true,
  );
});
```

Add explicit `workflows` cases for both validators. Use at least one non-path
value, such as an object or number, to prove opacity.

---

### `tests/domain/resolver-strict.test.ts` (test, file-I/O)

**Analog:** `tests/domain/resolver-strict.test.ts`

**Fixed convention table test** (lines 629-660):

```typescript
const cases = [
  { kind: "lspServers", relativePath: ".lsp.json", stat: { contents: "{}" } },
  { kind: "themes", relativePath: "themes", stat: "dir" },
  { kind: "outputStyles", relativePath: "output-styles", stat: "dir" },
  { kind: "settings", relativePath: "settings.json", stat: { contents: "{}" } },
] as const;

for (const c of cases) {
  const localRoot = ROOT(`./local-${c.kind}`);
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, c.relativePath)]: c.stat,
  });
  const r = await resolveStrict(basicEntry({ source: `./local-${c.kind}` }), ctx);
  assert.equal(r.state, "partially-available");
  if (r.state === "partially-available") {
    assert.ok(r.unsupported.includes(c.kind));
  }
}
```

Add a `workflows` directory case. Add named synthetic roots for
`claude-security` and `code-modernization`. Do not fetch those plugins.

**Structural precedence case** (lines 1350-1365):

```typescript
test("RSTATE-02: structural defect + unsupported kind -> unavailable (structural precedence)", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(
    basicEntry({ source: "./local", mcpServers: [1, 2, 3], themes: { dark: {} } }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  assert.ok(r.notes.some((n) => n.includes("malformed mcpServers")));
  assert.ok(r.notes.includes("contains themes"));
});
```

Copy this shape for a malformed plugin that also declares workflows. Assert
that the result has no materializable root arm.

Cover entry declaration, manifest declaration, directory-only detection, and
declaration-plus-directory deduplication. Assert exact ordered arrays.

---

### `tests/domain/resolver-loose.test.ts` (test, file-I/O)

**Analog:** `tests/domain/resolver-loose.test.ts`

**Loose partial arm** (lines 204-214 and 292-298):

```typescript
const r = await resolveLoose(basicEntry({ source: "./local", themes: "./themes" }), ctx);
assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);
requirePartialInstallable(r);

const declared = await resolveLoose(
  basicEntry({ source: "./local", themes: ["dark"] }),
  mockCtx(MP, { [ROOT("./local")]: "dir" }),
);
assert.equal(declared.state, "partially-available");
assert.ok(declared.notes.some((n) => n === "contains themes"));
```

Mirror the strict workflow matrix where loose mode has a distinct route. Pin
entry, manifest, and fixed-directory signals to the same exact result.

---

### `tests/shared/probe-classifiers.test.ts` (test, transform)

**Analog:** `tests/shared/probe-classifiers.test.ts`

**Special kind, mixed order, and deduplication** (lines 165-188):

```typescript
assert.deepEqual([...narrowUnsupportedKinds(["hooks"])], ["unsupported hooks"]);
assert.deepEqual(
  [...narrowUnsupportedKinds(["hooks", "lspServers"])],
  ["unsupported hooks", "lsp"],
);
assert.deepEqual([...narrowUnsupportedKinds(["hooks", "hooks"])], ["unsupported hooks"]);
assert.deepEqual(
  [...narrowUnsupportedKinds(["lspServers", "monitors"])],
  ["lsp", "unsupported component"],
);
```

Add single, duplicate, and mixed workflow cases. Required exact outputs include
`["workflows"]`, `["lsp", "workflows"]`, and
`["unsupported component", "workflows"]`.

---

### `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` (test, transform)

**Analog:** `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`

**Per-kind parity matrix** (lines 112-147):

```typescript
const PER_KIND_PARITY_CASES = [
  { kind: "lspServers", note: "contains lspServers", expected: "lsp" },
  { kind: "monitors", note: "contains monitors", expected: "unsupported component" },
  { kind: "themes", note: "contains themes", expected: "unsupported component" },
] as const;

for (const { kind, note, expected } of PER_KIND_PARITY_CASES) {
  const listInfoOut = narrowUnsupportedKinds([kind]);
  const installOut = narrowResolverReasons([note], [kind], true);
  assert.deepEqual(listInfoOut, [expected]);
  assert.deepEqual(installOut, [expected]);
  assert.deepEqual(listInfoOut, installOut);
}
```

Add the workflow row. The typed list is the policy source. Do not add a local
workflow mapper.

**Multi-kind parity** (lines 158-185):

```typescript
const listInfoOut = narrowUnsupportedKinds(["lspServers", "themes"]);
const installOut = narrowResolverReasons(
  ["contains lspServers", "contains themes"],
  ["lspServers", "themes"],
  true,
);
assert.deepEqual(listInfoOut, ["lsp", "unsupported component"]);
assert.deepEqual(installOut, ["lsp", "unsupported component"]);
```

Add workflow combinations that assert canonical order and byte parity.

---

### `tests/orchestrators/plugin/install.test.ts` (test, file-I/O)

**Analog:** `tests/orchestrators/plugin/install.test.ts`

Extend the seeded component helper with a workflow sentinel. Follow the hooks
fixture pattern, but write only test input. Production must never read it.

**Fixture writer pattern** (lines 134-186):

```typescript
async function writePluginComponents(pluginRoot: string, opts: FixtureOptions): Promise<void> {
  for (const skill of opts.skills ?? []) {
    const skillDir = path.join(pluginRoot, "skills", skill.sourceName);
    await mkdir(skillDir, { recursive: true });
    await writeFile(path.join(skillDir, "SKILL.md"), skill.body ?? "Body.\n");
  }

  if (opts.hooksJson !== undefined) {
    const hooksDir = path.join(pluginRoot, "hooks");
    await mkdir(hooksDir, { recursive: true });
    await writeFile(path.join(hooksDir, "hooks.json"), JSON.stringify(opts.hooksJson));
  }
}
```

Add a fixture-only option that creates `<pluginRoot>/workflows/<sentinel>`. Do
not add this option to a production type.

**Partial install and persistence pattern** (lines 5409-5460):

```typescript
await seedPathMarketplaceWithPlugin({
  cwd,
  marketplaceRoot: path.join(cwd, "mp-src"),
  marketplaceName: "mp",
  pluginName: "p1",
  skills: [{ sourceName: "tool" }],
  experimental: { themes: "./themes", monitors: "./monitors.json" },
});

await installPlugin({
  ctx,
  pi,
  scope: "project",
  cwd,
  marketplace: "mp",
  plugin: "p1",
  partial: true,
});

const record = after.marketplaces["mp"]?.plugins["p1"];
assert.deepEqual([...record.resources.skills], ["p1-tool"]);
assert.ok(record.compatibility.unsupported.includes("themes"));
```

Use a fresh environment for the workflow partial install. Assert all of these
facts:

- The supported skill exists.
- `compatibility.unsupported` equals `["workflows"]`.
- Resource keys remain `skills`, `prompts`, `agents`, `mcpServers`, and `hooks`.
- The workflow sentinel exists only below the source plugin root.
- No staged target below the scope root contains the sentinel.
- The row is `(partially-installed) {workflows}` and includes the reload trailer.

**Normal rejection pattern** (lines 5719-5750):

```typescript
await installPlugin({
  ctx,
  pi,
  scope: "project",
  cwd,
  marketplace: "mp",
  plugin: "p1",
});

assert.ok(notifications.length >= 1);
const after = await loadState(locations.extensionRoot);
assert.equal(after.marketplaces["mp"]?.plugins["p1"], undefined);
```

Run rejection in a separate fresh environment. Assert the exact
`(partially-available) {workflows}` row, the existing `--partial` hint, no state
record, and no materialized supported or workflow artifact.

---

### `tests/orchestrators/discover.test.ts` (test, file-I/O)

**Analog:** `tests/orchestrators/discover.test.ts`

**Closed discovery result** (lines 58-86):

```typescript
const result = await aggregateDiscoveredResources(user, project);
assert.deepEqual(result, { skillPaths: [], promptPaths: [] } satisfies DiscoveredResources);

assert.deepEqual(result.skillPaths, [userSkillA, userSkillB, projectSkill]);
assert.deepEqual(result.promptPaths, [userPrompt, projectPrompt]);
```

Add a decoy `workflows/` directory under a test root and retain the exact result
shape. Do not add `workflowPaths` to `DiscoveredResources`.

---

### `tests/architecture/notify-closed-set-locks.test.ts` (test, transform)

**Analog:** `tests/architecture/notify-closed-set-locks.test.ts`

**Deliberate count bump** (lines 29-40):

```typescript
test("OUT-08: REASONS is the closed 39-entry reason set", () => {
  assert.equal(REASONS.length, 39);
});
```

Change the title and assertion to 40. Add one count-history comment for
`workflows`. Keep every other closed-set count unchanged.

---

### `tests/architecture/catalog-uat.test.ts` (test, request-response)

**Analog:** `tests/architecture/catalog-uat.test.ts`

**Partial inventory fixture** (lines 908-927):

```typescript
"partially-installed-inventory": {
  pi: piWithBothLoaded(),
  message: {
    marketplaces: [{
      name: "official",
      scope: "user",
      details: { autoupdate: true },
      plugins: [{
        status: "partially-installed",
        name: "degraded-plugin",
        version: "1.0.0",
        reasons: ["lsp"],
      }],
    }],
  },
},
```

**Rejected partial fixture** (lines 1240-1264):

```typescript
"failure-unsupported-features": {
  pi: piWithBothLoaded(),
  expectedSeverity: "error",
  message: {
    marketplaces: [{
      name: "official",
      scope: "user",
      plugins: [{
        status: "partially-available",
        name: "helper",
        reasons: ["unsupported hooks", "lsp"],
        partialHint: true,
        severity: "error",
      }],
    }],
  },
},
```

Add workflow fixtures for the UI contract's inventory, rejection, and partial
success bytes. Each fixture key must match a `catalog-state` marker in the
catalog.

---

### `docs/output-catalog.md` (config, request-response)

**Analog:** `docs/output-catalog.md`

**Reason vocabulary contract** (lines 61-65):

```markdown
### Reasons rendering

Reasons render inside a single `{}` block, comma-space separated.
The closed-set membership is defined by the 38-member
`extensions/pi-claude-marketplace/shared/notify.ts::REASONS` tuple.
```

Correct the stale count to 40. Name `{workflows}` as a dedicated reason, not a
generic unsupported component.

**Partial inventory byte pattern** (lines 418-427):

```text
● official [user] <autoupdate>
  ◉ degraded-plugin v1.0.0 (partially-installed) {lsp}
```

Add the three byte examples from `106-UI-SPEC.md`: pre-install inventory,
normal rejection with the existing hint, and successful partial install with
the reload trailer. Keep glyphs, statuses, indentation, summaries, and trailer
text unchanged.

## Shared patterns

### One classification seam

**Source:** `shared/probe-classifiers.ts:183-216`

**Apply to:** All reason-bearing surfaces.

`narrowUnsupportedKinds` preserves first-seen order and removes duplicate
reasons. Current callers include list, info, fetch, install, update, enable,
reconcile, and backfill. Do not add a workflow branch to those consumers.

`install.messaging.ts:594-630` narrows typed kinds before it reads free-form
notes:

```typescript
const out: ContentReason[] = [...narrowUnsupportedKinds(unsupportedKinds)];
for (const reason of reasons) {
  out.push(...classifyResolverReason(reason, partialable));
}
return [...new Set(out)];
```

### Structural errors win

**Source:** `domain/resolver.ts:1619-1640`

**Apply to:** Strict resolver tests, loose resolver tests, and install rejection
tests.

The structural arm returns before the unsupported arm. A malformed plugin with
workflows stays `unavailable`. `--partial` cannot admit it.

### No new error class or validation path

Workflow values are opaque. Directory detection uses one literal fixed path.
Do not parse the value, inspect directory contents, or follow declared paths.

### No materialization or execution path

These production boundaries must remain unchanged:

| Guard file | Existing boundary |
|---|---|
| `orchestrators/plugin/install.ts:915-1235` | The ledger stages supported components only. The state projection writes five fixed resource arrays. |
| `persistence/state-io.ts:81-126` | `compatibility.unsupported` accepts strings. `resources` has only skills, prompts, agents, MCP servers, and hooks. |
| `orchestrators/discover.ts:10-52` | Discovery returns only `skillPaths` and `promptPaths`. |
| `index.ts:129-136` | The host event returns only those two arrays. |

Do not modify these production files for Phase 106. Tests must prove that the
existing generic path persists `workflows` only in compatibility metadata.

### Test isolation and cleanup

**Source:** `tests/orchestrators/plugin/install.test.ts:102-116`

Use `withHermeticHome`, `mkdtemp`, and `finally` cleanup for each normal or
partial install. A rejected run must not contaminate the partial run.

## Forbidden new files

No in-scope file lacks an analog. The following paths are intentionally absent
and must remain absent:

| Forbidden path or field | Reason |
|---|---|
| `bridges/workflows/*` | Workflow materialization is out of scope. |
| `orchestrators/workflows/*` | Workflow execution is out of scope. |
| `resources.workflows` | Compatibility metadata already records unsupported kinds. |
| `workflowPaths` on resource discovery | Pi must not discover workflow files. |
| A workflow payload schema | Declarations stay opaque. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/`, `tests/`, and
`docs/output-catalog.md`

**Files and planning artifacts scanned:** 26

**Pattern extraction date:** 2026-08-29
