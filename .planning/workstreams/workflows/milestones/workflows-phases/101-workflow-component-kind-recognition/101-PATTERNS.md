# Phase 101: Workflow component-kind recognition - Pattern Map

**Mapped:** 2026-08-14
**Files analyzed:** 5 production + 12 test/doc files modified, 0 created
**Analogs found:** 17 / 17 (every site has an in-file sibling analog)

> **Branch note for the orchestrator.** The `.planning/workstreams/workflows/`
> phase artifacts live on branch `features/workflows-spike`; the working
> checkout is on `main`, where the phase directory did not exist. This file was
> created under `main`'s working tree. `git diff main features/workflows-spike --
> extensions tests docs` is EMPTY, so every source excerpt below is accurate for
> both branches, but PATTERNS.md must be moved onto `features/workflows-spike`
> (or a worktree of it) before the planner runs.

## Nature of this phase

This is a **widening, not a creation**. No file is created. Every edit adds a
`workflows` member alongside an existing `skills` / `commands` / `agents`
member. The closest analog is therefore almost always **the adjacent line in
the same file**, and the only judgement call is *which* sibling.

The single genuinely new line of behavior in the whole phase is the `.js`
suffix arm in `nameFromEntry` (see Section 3). Everything else is a tuple
member and the compile errors it forces.

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/domain/resolver.ts` | domain (pure resolution) | transform | the `agents` member on every edited line | exact (same file) |
| `extensions/pi-claude-marketplace/shared/notify.ts` | shared (renderer) | transform | the `skills` member of `COMPONENT_KINDS` | exact (same file) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | orchestrator (read-only surface) | file-I/O + transform | the `commands` arm of `nameFromEntry` / `discoverComponentNames` | exact (same file) |
| `tests/domain/resolver-strict.test.ts` | test | transform | `resolver-strict.test.ts:1066-1078` (PR-4 convention case) | exact |
| `tests/domain/resolver-loose.test.ts` | test | transform | `resolver-loose.test.ts:103-117` (MM-6 negative) | exact |
| `tests/architecture/hooks-foundation.test.ts` | test (closed-set pin) | assertion | itself, edited in place | exact |
| 8 `tests/bridges/**` + `tests/orchestrators/**` files (16 literals) | test fixture builders | n/a | the `agents: []` line one row above | exact |
| `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` | doc + gate | byte-equality | the `installed-single-scope` matched pair | exact |

**No file has "no analog."** The No Analog Found section is empty by construction.

## Pattern Assignments

### 1. `domain/resolver.ts` — the two tuples

**Analog for `SUPPORTED_COMPONENT_KINDS` (line 325):** any existing member.
**Analog for `SUPPORTED_COMPONENT_PATH_KINDS` (line 336):** **`agents`**, NOT
`hooks`. This is the one place the wrong sibling is easy to pick.

`hooks` sits in the PUBLIC tuple only. Its discovery is a convention **FILE**
(`<pluginRoot>/hooks/hooks.json`, parsed by `parseHooksConfig`), not a
convention **DIRECTORY**, and it carries no path-bearing manifest field. Copying
`hooks` would leave `workflows` out of the path-validation loop and the
convention probe would never run. Copy `agents`: path-bearing manifest field
(`string | array`) + convention directory whose name equals the kind name —
exactly the `workflows` shape.

Current code, verbatim (`extensions/pi-claude-marketplace/domain/resolver.ts:317-337`):

```typescript
/**
 * HOOK-01: the PUBLIC closed set of supported component kinds. Downstream
 * consumers (surface renderers, OBS/SURF tests) read this tuple as the
 * authoritative supported-kind list. `hooks` is admitted here even though
 * the path-validation loop iterates a narrower subset
 * (`SUPPORTED_COMPONENT_PATH_KINDS`) -- the hooks-config discovery path
 * is a convention file, not a component-path field.
 */
export const SUPPORTED_COMPONENT_KINDS = ["skills", "commands", "agents", "hooks"] as const;
export type SupportedKind = (typeof SUPPORTED_COMPONENT_KINDS)[number];

/**
 * HOOK-01: the PRIVATE subset of supported kinds that carry per-entry
 * component-path semantics (entry/manifest declares a relative dir; the
 * resolver validates each path and adds it to `componentPaths.<kind>`).
 * `hooks` is deliberately excluded -- its discovery path is the
 * convention file `<pluginRoot>/hooks/hooks.json`, parsed by
 * `parseHooksConfig`, NOT a path-bearing field.
 */
const SUPPORTED_COMPONENT_PATH_KINDS = ["skills", "commands", "agents"] as const;
type SupportedPathKind = (typeof SUPPORTED_COMPONENT_PATH_KINDS)[number];
```

Both get `"workflows"` **appended last** (CONTEXT locks the order). The doc
comments must be amended so they still describe the split correctly with a
second path-bearing-and-conventional kind present. Per
`.claude/rules/typescript-comments.md`, keep the `HOOK-01` anchor and add the
`WFLW-01` anchor; no phase/plan references.

### 2. `domain/resolver.ts` — the schema and its two mirrors

Three literals that must stay in lockstep. In all three the analog is the
`agents` line directly above the insertion point.

`ComponentPathsSchema` (lines 57-66, verbatim):

```typescript
// D-07 (COMP-01): array-per-kind shape. The resolver UNIONs declared
// (entry > manifest order) + implicit-by-convention paths with first-wins
// dedup; the array semantics let `componentPaths.skills` carry both the
// declared `custom/skills` and the conventional `skills` simultaneously.
// This is additive rather than PR-4 short-circuit semantics.
const ComponentPathsSchema = Type.Object({
  skills: Type.Array(Type.String()),
  commands: Type.Array(Type.String()),
  agents: Type.Array(Type.String()),
});
```

`PartialResolution.componentPaths` (line 382, verbatim):

```typescript
  componentPaths: { skills: string[]; commands: string[]; agents: string[] };
```

`emptyResolution()` (line 410, verbatim):

```typescript
    componentPaths: { skills: [], commands: [], agents: [] },
```

Required, not optional (`Type.Array(Type.String())` + `workflows: []`) — CONTEXT
locks this so no consumer needs `?? []`.

### 3. `domain/resolver.ts` — the collector needs NO body change

This is the load-bearing "already implemented" claim, so the plan should quote it
rather than re-derive it. `collectStrictComponentKind`
(`extensions/pi-claude-marketplace/domain/resolver.ts:882-908`, verbatim):

```typescript
async function collectStrictComponentKind(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
  partial: PartialResolution,
  pluginRoot: string,
  ctx: ResolveContext,
  kind: SupportedPathKind,
): Promise<boolean> {
  let dirty = false;
  const seenPaths = new Set<string>();
  const fromEntry = readPathOrArray((entry as Record<string, unknown>)[kind]);
  const fromManifest = readPathOrArray(manifest?.[kind]);

  for (const raw of [...fromEntry, ...fromManifest]) {
    dirty = (await addValidatedComponentPath(partial, kind, seenPaths, raw, pluginRoot)) || dirty;
  }

  if ((await statKindOf(ctx)(path.join(pluginRoot, kind))) === "dir") {
    addComponentPath(partial, kind, seenPaths, kind);
  }

  if (partial.componentPaths[kind].length > 0) {
    partial.supported.push(kind);
  }

  return dirty;
}
```

Note `path.join(pluginRoot, kind)` — the convention directory name IS the kind
name. That is precisely why `workflows` needs no probe of its own. Likewise
`validateComponentPath` (804), `addComponentPath` (850),
`addValidatedComponentPath` (864), `readPathOrArray` (778),
`collectLooseComponentKind` (1251) and `materializableFields` (431) are all
`SupportedPathKind`-typed or index through `partial.componentPaths[kind]` — no
body change anywhere.

### 4. `shared/notify.ts` — the length-exact tuple

**Analog:** the `skills` slot. Two coupled edits; the type is derived from the
interface so they cannot drift, and the tuple length is the enforcement.

Interface (`extensions/pi-claude-marketplace/shared/notify.ts:1390-1400`, verbatim):

```typescript
interface PluginInfoComponentsResolved {
  readonly componentsResolved: true;
  readonly components: {
    readonly agents?: readonly string[];
    readonly commands?: readonly string[];
    readonly hooks?: readonly HookSummaryEntry[];
    readonly mcp?: readonly string[];
    readonly skills?: readonly string[];
  };
  readonly dependencies?: readonly string[];
}
```

Copy the **`skills`** member shape (`readonly workflows?: readonly string[];`),
NOT `hooks` (`readonly HookSummaryEntry[]` — the only multi-line kind).

Tuple and renderer (`shared/notify.ts:3300-3348`, verbatim):

```typescript
// Derive the tuple's element type from the interface so the two
// declarations cannot drift. The tuple is sized exactly (5 entries):
// adding a 6th key to `PluginInfoComponentsResolved.components` without
// extending this tuple breaks the typecheck here -- TS rejects the
// literal because `ComponentKind` would no longer cover every keyof
// the interface. Without the explicit tuple length, the renderer
// would silently omit the new kind from output.
type ComponentKind = keyof PluginInfoComponentsResolved["components"];
const COMPONENT_KINDS: readonly [
  ComponentKind,
  ComponentKind,
  ComponentKind,
  ComponentKind,
  ComponentKind,
] = ["agents", "commands", "hooks", "mcp", "skills"];

function appendResolvedComponentLines(
  lines: string[],
  components: PluginInfoComponentsResolved["components"],
  dependencies: readonly string[] | undefined,
): void {
  for (const kind of COMPONENT_KINDS) {
    if (kind === "hooks") {
      appendHooksBlock(lines, components.hooks);
      continue;
    }

    const names = components[kind];
    if (names !== undefined && names.length > 0) {
      lines.push(`    ${kind}: ${names.join(", ")}`);
    }
  }

  if (dependencies !== undefined && dependencies.length > 0) {
    lines.push(`    dependencies: ${dependencies.join(", ")}`);
  }
}
```

Add a sixth `ComponentKind` slot and `"workflows"` last:
`["agents", "commands", "hooks", "mcp", "skills", "workflows"]` — which is both
alphabetical and appended-last. `appendResolvedComponentLines` needs **no body
change**: `workflows` takes the default single-line comma-join arm, the same one
`skills` takes. Update the "(5 entries) … adding a 6th key" comment to 6 / 7th,
and the two doc comments that state the render order as
`agents, commands, mcp, skills` (already stale — they omit `hooks`).

### 5. `orchestrators/plugin/info.ts` — `nameFromEntry` (the phase's one real branch)

**Analog for the new arm:** the **`commands`** arm — `workflows/` is a flat
directory of files whose display name is the file stem, identical to `commands/`
and `agents/`. It is NOT the `skills` arm (directories).

Verbatim in full (`orchestrators/plugin/info.ts:272-284`) — **the extension
assumption lives on line 283, in the unguarded `.md` tail**:

```typescript
/** Extract the displayable name from a single directory entry per `kind`,
 *  or `undefined` if the entry does not qualify. */
function nameFromEntry(
  entry: { name: string; isDirectory(): boolean; isFile(): boolean },
  kind: "skills" | "commands" | "agents",
): string | undefined {
  if (kind === "skills") {
    return entry.isDirectory() ? entry.name : undefined;
  }

  // commands + agents: `.md` files; strip the suffix for display.   <-- the assumption
  return entry.isFile() && entry.name.endsWith(".md") ? entry.name.slice(0, -3) : undefined;
}
```

**Highest-value pitfall of the phase.** The `.md` test is on an *unguarded
fallthrough `return`*, not an exhaustive switch with `assertNever`. Adding
`"workflows"` to the `kind` union **without touching the body compiles cleanly**
and every `.js` script fails `endsWith(".md")`, so `discoverComponentNames`
returns `[]`, so the `components.workflows` spread is skipped, so the
`workflows:` line silently never renders. The resolver tests would still pass.

Prescribed shape (suffix as a variable — one statement, no
`sonarjs/no-identical-functions` exposure, correct for a longer suffix):

```typescript
  // commands + agents: `.md`; workflows: `.js`. Strip the suffix for display.
  const suffix = kind === "workflows" ? ".js" : ".md";
  return entry.isFile() && entry.name.endsWith(suffix)
    ? entry.name.slice(0, -suffix.length)
    : undefined;
```

Note the `-3` → `-suffix.length` change; a literal `-3` is coincidentally
correct for `.js` too, but hard-coding it re-creates the same trap.

`discoverComponentNames` (`info.ts:311-329`) is otherwise unchanged — only its
`kind` union widens. It already returns a sorted, deduped `readonly string[]`
via `localeCompare(…, { sensitivity: "base" })`; do not add a local `Set`/`sort`:

```typescript
async function discoverComponentNames(
  pluginRoot: string,
  componentDirs: readonly string[],
  kind: "skills" | "commands" | "agents",
): Promise<readonly string[]> {
  const names = new Set<string>();
  for (const rel of componentDirs) {
    const abs = path.isAbsolute(rel) ? rel : path.join(pluginRoot, rel);
    const entries = await readEntriesOrEmpty(abs);
    for (const entry of entries) {
      const name = nameFromEntry(entry, kind);
      if (name !== undefined) {
        names.add(name);
      }
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
```

The doc block at `info.ts:253-271` lists the per-kind name rule for skills /
commands / agents; it gains a `workflows: file entries -> basename minus .js
suffix` bullet.

### 6. `orchestrators/plugin/info.ts` — `composeResolvedComponents`

**Analog:** the `commands` triple — one param-type member, one
`discoverComponentNames` call, one conditional spread. Verbatim
(`info.ts:669-721`, elided in the middle):

```typescript
async function composeResolvedComponents(
  pluginRoot: string,
  resolved: {
    readonly componentPaths: {
      readonly skills: readonly string[];
      readonly commands: readonly string[];
      readonly agents: readonly string[];
    };
    readonly mcpServers: Record<string, unknown>;
    readonly hooksConfigPath?: string;
  },
): Promise<{
  readonly agents?: readonly string[];
  readonly commands?: readonly string[];
  readonly hooks?: readonly HookSummaryEntry[];
  readonly mcp?: readonly string[];
  readonly skills?: readonly string[];
}> {
  const agents = await discoverComponentNames(pluginRoot, resolved.componentPaths.agents, "agents");
  const commands = await discoverComponentNames(
    pluginRoot,
    resolved.componentPaths.commands,
    "commands",
  );
  const skills = await discoverComponentNames(pluginRoot, resolved.componentPaths.skills, "skills");
  // ... mcp + hooks ...
  return {
    ...(agents.length > 0 && { agents }),
    ...(commands.length > 0 && { commands }),
    ...(hooks !== undefined && hooks.length > 0 && { hooks }),
    ...(mcp.length > 0 && { mcp }),
    ...(skills.length > 0 && { skills }),
  };
}
```

Four mechanical additions, copying `commands` each time:
`readonly workflows: readonly string[];` (param, **required** — matches the
resolver), `readonly workflows?: readonly string[];` (return, optional — matches
the notify interface), one `discoverComponentNames(..., "workflows")` call, and
`...(workflows.length > 0 && { workflows })` last in the spread.

`buildNotInstallablePathRowFields` (1172) and `buildAvailableRow` (2046) type
their `resolved` param as `Parameters<typeof composeResolvedComponents>[1]` and
widen for free. The SURF-01 doc comment at 664-667 names the enforced ordering
and needs the sixth kind.

### 7. `orchestrators/plugin/info.ts` — the two `unavailable`-arm literals (compile-forced)

`deriveLenientComponentPaths` (`info.ts:1223-1242`, verbatim):

```typescript
function deriveLenientComponentPaths(entry: MarketplaceManifest["plugins"][number]): {
  skills: string[];
  commands: string[];
  agents: string[];
} {
  const out = {
    skills: ["skills"],
    commands: ["commands"],
    agents: ["agents"],
  };
  for (const kind of ["skills", "commands", "agents"] as const) {
    for (const d of asDeclaredList((entry as Record<string, unknown>)[kind])) {
      if (typeof d === "string" && !out[kind].includes(d)) {
        out[kind].push(d);
      }
    }
  }

  return out;
}
```

Three coupled edits, all copying `agents`: the return type, the `out` literal
(`workflows: ["workflows"]`), and the `as const` loop tuple. And the warm-git
sibling (`info.ts:1862-1868`, verbatim):

```typescript
  const forComponents =
    resolved.state === "partially-available"
      ? resolved
      : {
          componentPaths: { skills: ["skills"], commands: ["commands"], agents: ["agents"] },
          mcpServers: {},
        };
```

→ add `workflows: ["workflows"]`.

## Test Patterns

### 8. Canonical resolver test — the convention-directory template (copy this 9+ times)

Resolver tests use an **in-memory `ResolveContext`**, not memfs and not a
tmpdir. The fixture helper is `mockCtx`, declared identically at the top of both
`tests/domain/resolver-strict.test.ts` (32-61) and
`tests/domain/resolver-loose.test.ts` (27-56), alongside
`const MP = "/abs/marketplace"` and `const ROOT = (rel) => path.resolve(MP, rel)`.

Helper call shape (`resolver-strict.test.ts:25-64`, verbatim):

```typescript
/**
 * Build an in-memory ResolveContext. `files` maps absolute paths to either:
 *   - "dir"           -> directory exists
 *   - "file"          -> file exists, but readFileText is not stubbed (will throw)
 *   - { contents: s } -> file exists with given contents
 * Anything not in the map -> null (does not exist).
 */
function mockCtx(
  marketplaceRoot: string,
  files: Record<string, "dir" | "file" | { contents: string }>,
): ResolveContext { /* statKind + readFileText closures over `files` */ }

const MP = "/abs/marketplace";
const ROOT = (rel: string): string => path.resolve(MP, rel);
```

Entries are built by `basicEntry` (`resolver-strict.test.ts:81-83`, verbatim):

```typescript
function basicEntry(over: LooseEntry = {}): PluginEntry {
  return { name: "p1", source: "./local", ...over };
}
```

**THE canonical example** — the shortest existing test that builds a plugin with
an implicit convention directory on disk and resolves it
(`tests/domain/resolver-strict.test.ts:1066-1078`, verbatim, one full assertion
block):

```typescript
test("PR-4 implicit-by-convention populates componentPaths.skills when neither entry nor manifest declares it", async () => {
  const ctx = mockCtx(MP, {
    [ROOT("./local")]: "dir",
    [path.join(ROOT("./local"), "skills")]: "dir",
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.deepEqual(r.componentPaths.skills, ["skills"]);
    assert.ok(r.supported.includes("skills"));
  }
});
```

This is the template for the **primary** WFLW-01 case — swap `"skills"` for
`"workflows"` in all three places. Three things the executor must preserve:

- The `if (r.state === "installable")` narrowing guard is **mandatory** before
  reading `componentPaths` — NFR-7's discriminated union makes it a typecheck
  error otherwise.
- `assert.equal(r.state, ...)` carries the `notes` in its message so a failure is
  self-diagnosing.
- No disk, no tmpdir, no memfs. The path keys are absolute and synthetic.

Two secondary templates:

- **Union with a declared path** (`resolver-strict.test.ts:1082-1095`): entry
  declares `skills: "custom"` AND `skills/` exists on disk → asserts
  `["custom", "skills"]` (declared first, convention appended). Copy for the
  WFLW dedup/union case.
- **Loose-mode negative** (`resolver-loose.test.ts:103-117`, verbatim):

```typescript
test("MM-6 entry + manifest both absent + <pluginRoot>/skills exists -> installable WITHOUT skills (no implicit-by-convention in loose)", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "skills")]: "dir",
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    // D-07 array shape: empty array (no implicit-by-convention in loose mode).
    assert.deepEqual(r.componentPaths.skills, [], "no implicit-by-convention in loose mode");
    assert.ok(!r.supported.includes("skills"));
  }
});
```

Copy verbatim with `workflows` for the "no implicit-by-convention in loose"
WFLW case.

### 9. Closed-set pin — updated in place

`tests/architecture/hooks-foundation.test.ts:199-205`, verbatim:

```typescript
test("HOOK-01: SUPPORTED_COMPONENT_KINDS is the closed 4-tuple [skills,commands,agents,hooks]", () => {
  assert.deepEqual(
    [...SUPPORTED_COMPONENT_KINDS],
    ["skills", "commands", "agents", "hooks"],
    "SUPPORTED_COMPONENT_KINDS is a public closed-set contract -- shape and order are locked",
  );
});
```

Edit in place to the 5-tuple; drop "4-tuple" from the title; **keep the
locked-shape-and-order rationale string unchanged**. CONTEXT forbids a second
parallel pin.

### 10. The 16 compile-forced `componentPaths` literals — one representative

Do not enumerate; RESEARCH.md §D already lists all 16 by file and line. Here is
one representative with its type annotation
(`tests/bridges/skills/discover.test.ts:18-38`, verbatim):

```typescript
  pluginRoot: string,
  skillsDirAbs: string | undefined,
): ResolvedPluginInstallable {
  // D-07: componentPaths.skills is `readonly string[]`. Tests pass the
  // absolute fixture dir directly (verbatim element); the bridge accepts
  // both absolute and relative-to-pluginRoot elements.
  return {
    state: "installable",
    name: "acme",
    pluginRoot,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: {
      skills: skillsDirAbs === undefined ? [] : [skillsDirAbs],
      commands: [],
      agents: [],
    },
    mcpServers: {},
  };
}
```

**Mechanical rule for all 16:** each literal sits inside a function whose return
type or variable annotation is `ResolvedPluginInstallable` / `ResolvedPlugin`, so
each is a hard `tsc --noEmit` error the moment `componentPaths.workflows` becomes
required. The fix is always the identical single line `workflows: [],` appended
after `agents: [],`. Never a spread, never a partial — RESEARCH confirms the
grep for `componentPaths: {` is exhaustive and there are no spread or
`Object.assign` constructions anywhere in the tree. Let `npm run typecheck` drive
the list rather than working from the table.

### 11. Catalog gate — the bidirectional matched pair

The gate walks `docs/output-catalog.md` for `<!-- catalog-state: STATE -->`
annotations, pairs each with a programmatic `FIXTURES` entry, and asserts byte
equality — **and** runs an inverse walk that fails on any fixture with no
annotation. Because the fixtures are hand-written `NotificationMessage` literals
rather than derived from the renderer, **no existing catalog example changes**
when a sixth kind is added; the new `workflows:` example is a deliberate
addition and **both halves must land in the same change**.

Doc half (`docs/output-catalog.md:1564-1573`, verbatim):

````markdown
<!-- catalog-state: installed-single-scope -->

```text
● claude-plugins-official [user] <autoupdate>
  ● commit-commands v1.2.0 (installed)
    Helpful git commit commands for everyday use.
    agents: review-bot
    commands: c1, c2
    skills: commit-summary
```
````

Test half (`tests/architecture/catalog-uat.test.ts:2932-2953`, verbatim):

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

Structure of the addition: a new `### Success -- …` H3 with prose, its
`<!-- catalog-state: <new-state> -->` annotation and fenced `text` block showing
the `workflows:` line **last** among the component lines (alphabetical
`COMPONENT_KINDS` order), plus a `FIXTURES["/claude:plugin info <plugin>@<marketplace>"]["<new-state>"]`
entry whose `components` gains `workflows: [...]`. Omit `expectedSeverity` —
every `info` success state is `info` severity (no second `notify` arg).

Also fix the section preamble at `docs/output-catalog.md:1556`, which states the
order as `agents`, `commands`, `mcp`, `skills` and is **already stale** (it omits
`hooks`).

### 12. Stale-comment sweep (grep-and-fix)

- `orchestrators/plugin/info.ts:665` — `["agents", "commands", "hooks", "mcp", "skills"]` ordering
- `tests/orchestrators/plugin/info.test.ts:1682` — "the 5-tuple `COMPONENT_KINDS`"
- `tests/shared/notify-v2.test.ts:4243` — "`mcp, skills` order (COMPONENT_KINDS tuple)"
- `extensions/pi-claude-marketplace/shared/concerns/hooks.ts:6` — mentions `COMPONENT_KINDS`

**Leave alone:** `orchestrators/plugin/enable-disable.ts:365` ("COMPONENT_KINDS
5-tuple") refers to the five artifact **bridges**, not the info renderer tuple.
It grows when a bridge is added, not here.

## Shared Patterns

### Closed-set widening (applies to §1, §4, §9)

**Source:** `shared/notify.ts:3300-3314` + `domain/resolver.ts:317-337`
**Apply to:** every tuple edit in this phase

The tuple's element type is derived from the interface
(`type ComponentKind = keyof PluginInfoComponentsResolved["components"]`) and its
length is written out explicitly. Widening is a two-step: grow the interface, then
grow the tuple. Doing only the first is a deliberate typecheck failure — that is
the mechanism, not an obstacle. Never widen a tuple by removing the length
annotation.

### Discriminated-union narrowing before reading `componentPaths` (applies to §8)

**Source:** `tests/domain/resolver-strict.test.ts:1074`
**Apply to:** every new resolver test

```typescript
  if (r.state === "installable") {
    assert.deepEqual(r.componentPaths.skills, ["skills"]);
  }
```

NFR-7: `ResolvedPlugin` is discriminated so a non-installable arm cannot have
`pluginRoot` / `componentPaths` read. The guard is a typecheck requirement, not
a style choice.

### Comment traceability (applies to every edited comment)

**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** all comment and test-title edits

Keep and add requirement/decision IDs (`HOOK-01`, `D-07`, `COMP-01`, `SURF-01`,
`WFLW-01`, `NFR-7`). Never write `Phase 101`, `Plan NN`, `Wave N`, or bare
`Pitfall N`.

### ESLint style on new lines (applies to §5, §6)

**Source:** `.planning/codebase/CONVENTIONS.md`
`@stylistic/padding-line-between-statements` requires a blank line after every
block-like statement; `curly: ["error", "all"]`;
`@typescript-eslint/explicit-module-boundary-types` on exports. The new
`nameFromEntry` arm and the `composeResolvedComponents` addition both sit in code
where these already apply.

### Markdown formatting (applies to §11)

**Source:** CLAUDE.md pre-commit policy
`docs/output-catalog.md` is formatted by **mdformat** via pre-commit, not
prettier (`format:check` covers only `js,json,ts`). Running `prettier --write` on
the catalog is always wrong. Run
`pre-commit run --files docs/output-catalog.md` before committing.

## No Analog Found

None. Every edit site has an in-file sibling analog.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| — | — | — | — |

## Files touched again in later phases (one line each)

- `orchestrators/plugin/info.ts` — Phase 102 swaps the `workflows:` name source from file stem to the acorn-extracted `meta.name`.
- `domain/resolver.ts` — Phase 105 may add the `workflow_control` soft-dependency degradation reason.
- `orchestrators/reconcile/apply.ts`, `orchestrators/plugin/update.ts` — **not edited** in this phase; their behavior shifts as a consequence of the widened supported set (RESEARCH Pitfalls 2 and 3) and needs a confirming test, not a code change.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,shared,orchestrators}/`, `tests/{domain,bridges,architecture,orchestrators,shared}/`, `docs/`
**Files scanned:** 9 read directly; edit-site inventory taken from 101-RESEARCH.md §"Change Map (exhaustive edit sites)"
**Source branch verified:** working tree `main`; `git diff main features/workflows-spike -- extensions tests docs` is empty
**Pattern extraction date:** 2026-08-14
