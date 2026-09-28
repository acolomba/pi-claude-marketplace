# Phase 112: Install and removal lifecycle - Pattern Map

**Mapped:** 2026-09-05
**Files analyzed:** 15 modified + 1 created (production), 12 modified + 1 created (test)
**Analogs found:** 15 / 16

> **This phase ports nothing.** The spike branch
> (`git show features/workflows-spike:extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`)
> is reference for *intent only* — `install.ts` and `reinstall.ts` were rewritten on main after the
> spike was cut. Every excerpt below is read from **HEAD of `features/workflow`**, and every analog
> named here is git-tracked source under `extensions/` or `tests/`. Nothing in this file points at
> a generated or gitignored mirror.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/persistence/state-io.ts` | model / schema | CRUD | its own `hooks` member (`:63-70`, `:116-122`, `:167-174`) | exact (self, prior axis) |
| `extensions/pi-claude-marketplace/persistence/migrate.ts` | migration | transform | `migrate.ts:137` three-field default-fill loop | exact (self) |
| `extensions/pi-claude-marketplace/shared/errors.ts` (`Phase3Failure.phase`) | model | — | the same union at `:359-363` | exact (self) |
| `extensions/pi-claude-marketplace/orchestrators/types.ts` (`UpdatePhaseBridge`) | model | — | `types.ts:145` | exact (self) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` (`PHASE3_FAILURE_PHASES`) | model | — | `update.ts:1443` | exact (self) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (`workflowsPhase`) | orchestrator / ledger phase | transactional file-I/O | **`mcpPhase`, `install.ts:1115-1147`** | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (`InstallCtx` fields) | orchestrator state | — | `install.ts:343-362` + literal at `:908-911` | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (`statePhase` resources) | orchestrator | CRUD | `install.ts:1206` region | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (6th cascade slot) | orchestrator primitive | file-I/O removal | the agents slot, `shared.ts:328-350` | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (`WorkflowsUnstageFailureError`) | typed error | — | **`AgentsUnstageFailureError`, `shared.ts:57-65`** | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` (`applyPartialCascadeFold`) | utility | transform | its own `hooks` axis, `shared.ts:1221` | exact (self) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (hand-rolled fold) | orchestrator | transform | `remove.ts:325-335` | exact (self) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | orchestrator | file-I/O replace | the skills/commands slots in `prepareAllHandles` + `replaceAll` + `resourcesFromHandles` | role-match (see caveat) |
| **`extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts` (NEW)** | sweeper / utility | batch file-I/O | **`orchestrators/plugin/clone-gc.ts`** | partial — structure yes, liveness NO |
| `extensions/pi-claude-marketplace/persistence/locations.ts` (`workflowsStagingRoot`) | path chokepoint | — | `pluginCloneDir` (`:331-342`), **NOT** `sourcesStagingDir` | role-match |
| `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` | — | — | **unchanged** — the sixth phase is data, not a runner change | n/a |
| `tests/orchestrators/plugin/install.test.ts` (undo cases) | test | — | **`install.test.ts:3335`** — the only disk-state undo assertion in the repo | exact |
| `tests/orchestrators/plugin/workflows-staging-gc.test.ts` (NEW) | test | — | `tests/orchestrators/plugin/clone-gc.test.ts` | role-match |
| six per-file test seeders | test fixture | — | `writePluginComponents` (`install.test.ts:338-346`) | role-match, **not uniform** |

---

## Pattern Assignments

### 1. `install.ts` — the sixth ledger phase

**Analog: `mcpPhase`, not `hooksPhase`.** Pick `mcpPhase` (`install.ts:1115-1147`). Reason:
`hooksPhase` is the odd one out — it has no bridge staging handle at all (D-63-02, `writeHookConfig`
*is* the atomic write), so its undo sentinel is a plain `boolean` and it teaches nothing about the
prepare/commit/unstage triplet the workflows bridge exposes. `mcpPhase` is the newest phase that
carries a real `Prepared*Staging` handle, sets its context sentinel *before* the commit, harvests
names *after* it, and pushes bridge warnings onto `bridgeWarnings` — all four are exactly the
shapes `workflowsPhase` needs.

**Phase shape** (`install.ts:1115-1147`):

```ts
  const mcpPhase: Phase<InstallCtx> = {
    name: "mcp",
    do: async (c) => {
      const prep = await prepareStageMcpServers({ /* ... */ });
      c.mcpPrep = prep;
      const result = await commitPreparedMcp(prep);
      c.stagedMcpServerNames = result.recorded.map((r) => r.generatedName);
      // MCP staging soft warnings ... ride the same bridgeWarnings channel
      // as the other bridges' leak strings instead of being dropped.
      c.bridgeWarnings.push(...result.warnings);
    },
    undo: async (c) => {
      if (c.mcpPrep === undefined) {
        return;
      }

      await unstageMcpServers({
        locations: c.locations,
        marketplaceName: c.marketplace,
        pluginName: c.plugin,
      });
    },
  };
```

**How the sentinel is recorded so `undo` can remove what `do` wrote** — `skillsPhase`
(`install.ts:934-937`) states the rule verbatim in a comment:

```ts
      c.skillsPrep = prep;
      // Set before commit so undo can remove any dirs that were placed if
      // commit fails mid-loop (partial rename success leaves K orphans).
      c.stagedSkillNames = prep.result.recorded.map((r) => r.generatedName);
```

**Two ways `undo` differs from the bridge's own `unstage`:**

1. The bridge's `unstage*` is *unconditional by recorded name*; the phase's `undo` first gates on
   the context sentinel (`if (c.mcpPrep === undefined) return;`), because
   `transaction/phase-ledger.ts:26-34` contracts that `undo` runs even for a phase whose `do` threw
   part-way.
2. All five siblings **discard** the unstage result — `await unstagePluginSkills({...})` with no
   assignment (`install.ts:959, 1000, 1057, 1141`). Workflows must NOT copy that: see §5.

**Context fields to add** — mirror the existing block, `install.ts:343-362`:

```ts
  skillsPrep?: PreparedSkillsStaging;
  commandsPrep?: PreparedCommandsStaging;
  agentsPrep?: PreparedAgentsStaging;
  mcpPrep?: PreparedMcpStaging;
  hooksFileWritten: boolean;
  stagedSkillNames: readonly string[];
  /* ... */
  stagedMcpServerNames: readonly string[];
```

initialized in the context literal at `install.ts:908-911`:

```ts
    stagedSkillNames: [],
    stagedCommandNames: [],
    stagedAgentNames: [],
    stagedMcpServerNames: [],
```

**The literal array** (`install.ts:1239-1252`) — the workflows slot goes between `mcpPhase` and
`statePhase`; `statePhase` stays last because it is what writes `resources.workflows`. The adjacent
comments (`// D-01 5-phase ledger` at `:20`, `"5-phase ledger"` at `:317` and `:780`, the
`[skills, commands, agents, hooks, mcp, state]` sequence line at `:1242`) all become false and are
part of the change.

**`statePhase` record composition** (`install.ts:1206` region) — the new axis goes here:

```ts
        resources: {
          skills: [...c.stagedSkillNames],
          prompts: [...c.stagedCommandNames],
          agents: [...c.stagedAgentNames],
          mcpServers: [...c.stagedMcpServerNames],
```

---

### 2. The four removal paths — they compose DIFFERENTLY

Three of the four are **inherited for free** from one primitive. Only `reinstall` is bespoke.

#### 2a. The primitive: `cascadeUnstagePlugin` (`orchestrators/marketplace/shared.ts:301-388`)

The sixth bridge slot goes after `unstageMcpServers` and before the success `Object.freeze`, so no
existing ordering shifts a byte:

```ts
  const dropped = {
    skills: [] as string[],
    commands: [] as string[],
    agents: [] as string[],
    hooks: [] as string[],
    mcpServers: [] as string[],
  };

  try {
    const skillsResult = await unstagePluginSkills({
      locations,
      previousSkillNames: installedPlugin.resources.skills,
    });
    dropped.skills = [...skillsResult.removedNames];
    /* ... commands, agents ... */

    if (agentsResult.failed.length > 0) {
      // CR-06: preserve the structured `failed[]` array on the thrown error so
      // downstream consumers ... can read per-agent reasons WITHOUT having to
      // re-parse the textual message.
      const reasons = agentsResult.failed.map((f) => `${f.generatedName}: ${f.reason}`).join("; ");
      const err = new AgentsUnstageFailureError(
        `Failed to remove ${agentsResult.failed.length} agent(s): ${reasons}`,
        agentsResult.failed,
      );
      throw err;
    }

    const hooksResult = await removeHookConfig({ locations, pluginName: plugin });
    dropped.hooks = [hooksResult.removed];

    const mcpResult = await unstageMcpServers({ locations, marketplaceName: marketplace, pluginName: plugin });
    dropped.mcpServers = [...mcpResult.removedNames];

    return Object.freeze({ ok: true, dropped: Object.freeze({ /* 5 frozen copies */ }) });
  } catch (err) {
    return Object.freeze({
      ok: false,
      dropped: Object.freeze({ /* the SAME 5 frozen copies -- partial progress is reported */ }),
      cause: err instanceof Error ? err : new Error(String(err)),
    });
  }
```

Both the `ok: true` and the `ok: false` return re-freeze all axes — the new axis must be added to
**both**, and `UnstageOutcome.dropped` (`shared.ts:270-284`, whose doc comment says "all FIVE
bridges" and "all five bridges" and is now false) gains `readonly workflows: readonly string[];`.

#### 2b. `uninstall` — inherits (`orchestrators/plugin/uninstall.ts:522`, invoked `:634`)

```ts
  const cascade = opts.cascade ?? cascadeUnstagePlugin;
  /* ... */
      const localOutcome = await cascade(plugin, marketplace, locations, installed);
```

Injected-seam shape (`opts.cascade ?? default`) — the tests substitute here. No edit needed for the
removal itself; only the **fold** (§2f) and the tests change.

#### 2c. `disable` — inherits (`orchestrators/plugin/enable-disable.ts:357-374`)

```ts
  const cascade = await cascadeUnstagePlugin(opts.plugin, opts.marketplace, locations, installed);
  if (isFailedUnstageOutcome(cascade)) {
    // I3: cascade.dropped lists artifacts already unstaged before the throw.
    applyPartialCascadeFold(installed, cascade.dropped);
    installed.updatedAt = new Date().toISOString();
    /* ... */
  }
```

Note the disable success path **retains** the record's `resources` (`enable-disable.ts:386-395`:
"what the record retains is its DESCRIPTION of the installation, not the artifacts"). So
`resources.workflows` survives a disable — the VALIDATION table's "disable removes envelopes and
**retains** `resources.workflows`" is this comment, not a new rule. The `ENBL-13 / D-100-04 /
COMPONENT_KINDS 5-tuple` comment at `:386-387` becomes stale.

#### 2d. `marketplace remove --cascade` — inherits (`remove.ts:665`, loop at `:305`)

```ts
    const outcome = await cascade(pluginName, marketplace, locations, plugin);
    if (outcome.ok) { successfullyUnstaged.push(pluginName); delete record.plugins[pluginName]; continue; }
```

#### 2e. install's own materialize-then-disable — inherits (`install.ts:1384`)

```ts
  const cascade = await cascadeUnstagePlugin(plugin, marketplace, locations, target.installed);
  if (isFailedUnstageOutcome(cascade)) {
    return foldFailedDisableCascade({ ...args, installed: target.installed, cascade });
  }
```

Its DFEN-04 header (`install.ts:1341-1348`) claims byte-identity with `install` + `disable` "by
construction rather than by careful re-implementation" — that claim holds automatically **only**
because the primitive is the sole composer. Do not add a per-verb workflows unstage call anywhere.

#### 2f. What is NOT inherited: the two partial-cascade folds (compile-silent)

`applyPartialCascadeFold` (`orchestrators/plugin/shared.ts:1188-1222`) — a five-axis structural
literal, so a six-axis argument satisfies it with no error:

```ts
export function applyPartialCascadeFold(
  installed: { resources: { skills: string[]; prompts: string[]; agents: string[]; mcpServers: string[]; hooks: string[] } },
  dropped: { readonly skills: readonly string[]; /* ...4 more... */ },
): void {
  installed.resources.skills = installed.resources.skills.filter((n) => !dropped.skills.includes(n));
  installed.resources.prompts = installed.resources.prompts.filter((n) => !dropped.commands.includes(n));
  /* ... */
  installed.resources.hooks = installed.resources.hooks.filter((n) => !dropped.hooks.includes(n));
}
```

The hand-rolled duplicate (`orchestrators/marketplace/remove.ts:322-336`) is **four**-axis and
already omits `hooks` — a pre-existing divergence to leave alone:

```ts
    if (!(cause instanceof AgentsUnstageFailureError)) {
      const dropped = outcome.dropped;
      plugin.resources.skills = plugin.resources.skills.filter((n) => !dropped.skills.includes(n));
      plugin.resources.prompts = plugin.resources.prompts.filter((n) => !dropped.commands.includes(n));
      plugin.resources.agents = plugin.resources.agents.filter((n) => !dropped.agents.includes(n));
      plugin.resources.mcpServers = plugin.resources.mcpServers.filter((n) => !dropped.mcpServers.includes(n));
    }
```

Both need an explicit `workflows` line and an explicit test; the compiler will not ask.

#### 2g. `reinstall` — no ledger, no cascade, a hand-rolled trio

`prepareAllHandles` (`reinstall.ts:1190-1250`) is where `previousWorkflowNames` lands, mirroring:

```ts
    handles.skills = await prepareStageSkills({ /* ... */ previousSkillNames: input.oldRecord.resources.skills, cwd: input.cwd });
    handles.commands = await prepareStageCommands({ /* ... */ previousCommandNames: input.oldRecord.resources.prompts, cwd: input.cwd });
```

with the catch-all recovery wrapper:

```ts
  } catch (err) {
    throw errorWithManualRecovery(err, await abortPartialHandles(handles));
  }
```

`replaceAll` (`reinstall.ts:1259-1310`) is the caveat that makes reinstall only a *role-match*: its
rollback ledger is the `replacements[]` array, and `commitPreparedWorkflows` has no
`replacePrepared*` twin to push onto it. The precedent for a step that is deliberately absent from
`replacements[]` is the hooks slot, whose comment spells out the exact consequence:

```ts
    // LIFE-01 / D-63-01: 5th cascade slot between agents and mcp. The hooks
    // bridge has no staging dir per D-63-02; writeHookConfig IS the atomic
    // write. NOT pushed onto `replacements[]` -- the hooks file STAYS IN
    // PLACE on a later-step failure (recovery is via the reinstall hint,
    // not in-process rollback, mirroring update.ts D-03 semantics).
    hookEntries = await commitHooks(hooks);
    const mcp = await replacePreparedMcp(handles.mcp);
    replacements.push({ phase: "mcp", handle: mcp });
  } catch (err) {
    const leaks = [...(await rollbackReplacements(replacements)), ...(await abortHandles(handles))];
    throw errorWithManualRecovery(err, leaks);
  }

  return { replacements: Object.freeze(replacements), hookEntries };
```

`hookEntries` is the model for the third return member (placed workflow names) RESEARCH says the
catch must consume. `resourcesFromHandles` (`reinstall.ts:1412-1434`) is where the record axis
lands, and its `hooks` member is the model for "the placed names, not the prepared names":

```ts
    mcpServers: handles.mcp.result.recorded.map((r) => r.generatedName),
    hooks: plugin !== undefined && installable?.hooksConfigPath !== undefined ? [plugin] : [],
```

---

### 3. The GC sweeper — `clone-gc.ts` transfers structurally, NOT in liveness

**Analog:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts` (110 lines, whole
file read).

**Signature and actual return contract** (`clone-gc.ts:56-59, 75, 109`):

```ts
/**
 * PURL-05 / PURL-06 / D-78-01: delete every unreferenced `plugin-clones/<key>/`
 * directory, returning per-dir rm-failure leak strings (callers ignore them --
 * hygienic cleanup never becomes the primary path, D-19-01).
 */
export async function garbageCollectPluginClones(locations: ScopedLocations): Promise<string[]> {
```

The final statement is `return leaks;`. **It returns the directories it FAILED to remove, not the
ones it removed.** The CONTEXT's original wording ("the names it removed") is wrong and RESEARCH
corrected it; mirror the real contract.

**Body — enumeration, ENOENT policy, chokepoint-before-`rm`, per-entry swallow:**

```ts
  let entries: string[];
  try {
    entries = await readdir(locations.pluginClonesDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // NFR-3: a missing cache dir is a no-op; nothing to sweep.
      return [];
    }

    throw err;
  }

  const leaks: string[] = [];
  for (const key of entries) {
    if (liveKeys.has(key)) {
      continue;
    }

    // SC-7 / NFR-10: every delete target routes through the chokepoint
    // (assertSafeName + assertPathInside) BEFORE the rm.
    const dir = await locations.pluginCloneDir(key);
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      // D-19-01: a per-dir rm leak never throws out of GC; the next pass
      // retries (NFR-3).
      leaks.push(`${key}: ${errorMessage(err)}`);
    }
  }

  return leaks;
```

**Liveness test — this is what does NOT transfer** (`clone-gc.ts:38-54`):

```ts
function deriveLiveCloneKeys(state: ExtensionState, pluginClonesDir: string): Set<string> {
  const liveKeys = new Set<string>();
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const record of Object.values(marketplace.plugins)) {
      if (record.resolvedSha === undefined) {
        continue;
      }

      const seg = path.relative(pluginClonesDir, record.resolvedSource).split(path.sep)[0];
      if (seg !== undefined && seg !== "" && !seg.startsWith("..")) {
        liveKeys.add(seg);
      }
    }
  }

  return liveKeys;
}
```

**Transfer verdict, stated plainly:**

| Property | Transfers? | Note |
|---|---|---|
| `(locations) => Promise<string[]>` of **leak strings** | Yes | mirror exactly |
| fs-only imports (no git surface, NFR-5-safe) | Yes | the workflows sweeper needs no `loadState` **at all** |
| `readdir` ENOENT → `return []`, other errno rethrows | Yes | verbatim |
| chokepoint resolved BEFORE the `rm` | Yes | but anchor differently — see below |
| per-entry `try`/`catch`, never throws | Yes | verbatim |
| call site: post-state-commit, inside a swallowing `try`/`catch` | Yes | see call sites below |
| `deriveLive*` from persisted records | **NO** | a staging root is `randomUUID()` (`bridges/workflows/stage.ts:155`) and is never persisted; `PreparedWorkflowsStaged.stagingRoot` (`bridges/workflows/types.ts:117-118`) lives only for one ledger run |

**Therefore the mtime age bound is the ENTIRE liveness mechanism here, not a refinement.**
`workflowsStagingDir` is scope-independent (`persistence/locations.ts:248`), so the per-scope
`proper-lockfile` guard does not serialize access to it either.

**There is no analog for the age constant.** Grepping `extensions/` for `mtime|Date.now()|STALE|
maxAge|ageMs` finds only the manifest cache keyed on `(mtimeMs, size)` and RECON-05 write-back
notes. **No age/TTL constant exists anywhere in `extensions/`** — the threshold is a new number
with no in-repo precedent to copy, and RESEARCH flags it as the one value worth putting in front of
the operator (A1: 24h suggested). The nearest *instinct* precedent is prose only, `update.ts:1425`:
"a future GC sweeper can use `sRecord.updatedAt` (already in the schema) for staleness."

**Chokepoint anchor — copy `pluginCloneDir`, NOT `sourcesStagingDir`** (`locations.ts:331-350`):

```ts
    async pluginCloneDir(key: string): Promise<string> {
      assertSafeName(key, `pluginCloneDir clone key "${key}"`);
      const candidate = path.join(pluginClonesDir, key);
      await assertPathInside(pluginClonesDir, candidate, `pluginCloneDir(${key})`);
      return candidate;
    },

    async sourcesStagingDir(uuid: string): Promise<string> {
      const sourcesStagingRoot = path.join(extensionRoot, "sources-staging");
      const candidate = path.join(sourcesStagingRoot, uuid);
      await assertPathInside(sourcesStagingRoot, candidate, `sourcesStagingDir(${uuid})`);
      return candidate;
    },
```

`sourcesStagingDir` anchors **at** its own staging root, so that segment is never `lstat`'d — the
WR-12 escape Phase 111 already rejected. Anchor on `locations.workflowsHomeDir`, one level above
`workflowsStagingDir`. `assertSafeName` is unnecessary on the entry name (`readdir` never yields a
separator; the names are UUIDs), matching `sourcesStagingDir`'s omission.

**Every call site of the analog** (all four discard the return value):

```
orchestrators/plugin/uninstall.ts:56   import { garbageCollectPluginClones } from "./clone-gc.ts";
orchestrators/plugin/uninstall.ts:435  await garbageCollectPluginClones(locations);
orchestrators/marketplace/remove.ts:66 import { garbageCollectPluginClones } from "../plugin/clone-gc.ts";
orchestrators/marketplace/remove.ts:625 await garbageCollectPluginClones(locations);
orchestrators/plugin/update.ts:141     import { garbageCollectPluginClones } from "./clone-gc.ts";
orchestrators/plugin/update.ts:1752    await garbageCollectPluginClones(args.locations);
orchestrators/plugin/update.ts:2362    await garbageCollectPluginClones(args.locations);
```

**Call-site shape to copy** — `runPostUninstallCleanup` (`uninstall.ts:409-438`):

```ts
  try {
    await garbageCollectPluginClones(locations);
  } catch {
    // D-19-01: hygienic cleanup never becomes the primary user-facing path.
  }
```

Note the same function's NFR-10 discipline immediately above it, which the sweeper's own chokepoint
call must respect:

```ts
  // NFR-10: resolve OUTSIDE the try. `pluginDataDir` is not a path join -- it
  // runs assertSafeName on both segments and assertPathInside on the result,
  // and a containment failure must propagate rather than be mistaken for an
  // rm leak. D-19-01 sanctions swallowing the cleanup, not the assertion
  // guarding it.
  const dataDir = await locations.pluginDataDir(marketplace, plugin);
```

**Because a staging orphan is created by install (not removal), `clone-gc`'s removal-verb call
sites do not fully transfer.** The install-side twin is `collectPostCommitWarnings`
(`install.ts:1535-1599`), whose existing hygiene blocks are the shape:

```ts
  // AS-6 / D-08: eager per-plugin data dir mkdir.
  try {
    await mkdir(installCtx.pluginDataDir, { recursive: true });
  } catch (mkdirErr) {
    push(
      `Plugin "${plugin}" installed; data dir creation deferred at ${installCtx.pluginDataDir}: ${errorMessage(mkdirErr)}`,
    );
  }
```

---

### 4. Undo-path tests that assert on DISK STATE

**The finding, stated plainly: exactly three such tests exist, and they are the only ones in the
repository that plant a mid-ledger failure and then assert an EARLIER phase's artifact is gone from
disk.** They are all in `tests/orchestrators/plugin/install.test.ts`, at `:3335`, `:3393`, `:3449`,
under a section header that says exactly what they are for:

```ts
// ───────────────────────────────────────────────────────────────────────────
// Rollback undo body tests: verify each bridge's undo path removes its
// staged artifacts when a later phase fails.
// ───────────────────────────────────────────────────────────────────────────
```

**Template — `install.test.ts:3335` (copy this structure verbatim):**

```ts
test("Rollback-skills-undo: skills committed then commands phase fails -> skill target removed", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-undo-skills-"));
    try {
      const locations = locationsFor("project", cwd);   // INSIDE withHermeticHome
      await seedPathMarketplaceWithPlugin({ /* ... */ skills: [{ sourceName: "tool" }], commands: [{ sourceName: "deploy" }] });

      // Pre-create a FILE at commandsStagingDir so that mkdir inside it
      // fails with ENOTDIR ... This is a non-PathContainmentError, so the
      // phase ledger triggers rollback of skills (the only phase that ran).
      await mkdir(path.dirname(locations.commandsStagingDir), { recursive: true });
      await writeFile(locations.commandsStagingDir, "not-a-dir");

      const { ctx, pi, notifications } = makeCtx();
      await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });

      // Install must fail.
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, "error");

      // Skills undo: the committed skill dir must have been removed.
      const skillTarget = path.join(locations.skillsTargetDir, "hello-tool");
      const { stat } = await import("node:fs/promises");
      let exists = true;
      try {
        await stat(skillTarget);
      } catch {
        exists = false;
      }

      assert.equal(exists, false, "skills undo must remove the committed skill dir");

      // No state record persisted.
      const after = await loadState(locations.extensionRoot);
      assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
```

Three details this template carries that are load-bearing here:

- **`locationsFor(...)` is called INSIDE `withHermeticHome`** (`install.test.ts:306-321` sets
  `process.env.HOME`, which is what `os.homedir()` in `platform/workflow-home.ts:31` reads). Call it
  outside and `workflowsSavedDir` points at the developer's real `~/.pi/workflows/`.
- The sabotage is a **planted filesystem condition**, never a mock — no `__test_*` seam exists.
- The assertion is on `stat` of a concrete path, plus a state-record absence check.

**What has NO analog:** the workflows phase is the LAST bridge slot, so "a later phase fails" must
be driven from `statePhase`, not another bridge. The two existing vehicles for that are
`install.test.ts:7385` (seed a colliding record → `ConcurrentInstallError`) and `:7445` (delete the
marketplace from the snapshot mid-flight) — but **neither of those two asserts on disk state**;
they assert the rejection and the record. Combining the `:3335` disk assertion with the `:7385`
sabotage vehicle is a shape that does not exist yet and must be composed.

**Also with no analog: a leftover-staging-root assertion.** No existing test asserts that a bridge's
staging directory is empty after a failure. Phase 111's review found two data-loss Criticals in
exactly this territory that 100% line/branch/function coverage did not catch — coverage proves the
branch ran, not what it left behind.

**PI-14 model for the containment direction:** `install.test.ts:2826`,
`"PI-14: PathContainmentError from a bridge prepare propagates verbatim with NO '(rollback partial:' marker"`
— mirror it for the *undo* direction. The ledger-side identity assertions already exist at
`tests/transaction/phase-ledger.test.ts:437` and `:465` (`assert.strictEqual(thrown, containmentError)`),
and `PRODUCTION_PHASE_NAMES` at `tests/transaction/phase-ledger.test.ts:12` must be widened (it is
a test-local constant, not a gate — nothing fails if it is missed, which is why it will be).

---

### 5. Typed per-name removal failure

**Closest analog: `AgentsUnstageFailureError`** (`orchestrators/marketplace/shared.ts:50-65`) — the
only existing typed error carrying a per-item failure array, and it sits in the exact module where
its workflows twin belongs (the D-11 gate at `tests/architecture/import-boundaries.test.ts:211-266`
allows plugin ledgers to reach `orchestrators/marketplace/shared.ts` only):

```ts
/**
 * CR-06: AG-5 foreign-content failure carries the structured per-agent
 * `failed[]` from the agents bridge so downstream consumers (partial-success
 * removal, diagnostics, tests) can read individual failure reasons WITHOUT
 * re-parsing the textual message. The message formatting is preserved for the
 * user-visible surface.
 */
export class AgentsUnstageFailureError extends Error {
  readonly failedAgents: readonly UnstageAgentFailure[];
  constructor(message: string, failedAgents: readonly UnstageAgentFailure[]) {
    super(message);
    this.name = "AgentsUnstageFailureError";
    this.failedAgents = failedAgents;
  }
}
```

Note it takes a **pre-formatted message** as its first argument (the caller builds the `; `-joined
reasons at `shared.ts:344-349`), unlike the two Phase 110 errors which format internally.

The per-name payload type already exists: `UnstageWorkflowFailure`
(`bridges/workflows/types.ts:163-172`), `{ name, reason }`, whose doc already argues the
structured-data case ("the leftover is EXECUTABLE code").

**Owner-test assertion shape — the house form Phase 110 established** (`tests/shared/errors.test.ts`).
Both existing examples do: two `instanceof` checks, one `deepStrictEqual` over a projection,
`cause: undefined` asserted rather than omitted. **They differ on copy discipline, and the
difference is deliberate — pick consciously:**

`CrossPluginConflictError` **does not copy** (`shared/errors.ts:278-286`: `this.conflicts = conflicts;`),
and its test asserts reference identity (`tests/shared/errors.test.ts:671-703`):

```ts
    assert.ok(error instanceof CrossPluginConflictError);
    assert.ok(error instanceof Error);
    assert.deepStrictEqual(
      { name: error.name, message: error.message, conflicts: error.conflicts, cause: error.cause },
      {
        name: "CrossPluginConflictError",
        message: 'Cross-plugin name conflict:\n  - skill "alpha" already owned by plugin "first"\n  - ...',
        conflicts: [ /* ... */ ],
        cause: undefined,
      },
    );
    assert.strictEqual(error.conflicts, conflicts);
```

`WorkflowNameCollisionError` **freezes a copy** (`shared/errors.ts:672`:
`this.collisions = Object.freeze([...collisions]);`), and its test proves it
(`tests/shared/errors.test.ts:1609-1628`):

```ts
  test("freezes a defensive copy a later push into the caller's array cannot reach", () => {
    const error = new WorkflowNameCollisionError(collisions);
    collisions.push({ generatedName: "acme:late", fileNames: ["late.ts"] });

    assert.deepStrictEqual(error.collisions, [ /* the two originals only */ ]);
    assert.strictEqual(Object.isFrozen(error.collisions), true);
    assert.notStrictEqual(error.collisions, collisions);
  });
```

`AgentsUnstageFailureError` follows the `CrossPluginConflictError` (no-copy) side. Since the new
error's array comes from a bridge result that is already `readonly` and not retained by the caller,
either is defensible — but the test must assert whichever was chosen, not stay silent.

Also note `describe(...)` grouping and the `// arrange / // act / // assert` comment markers used
throughout `tests/shared/errors.test.ts`.

---

### 6. The six seeding helpers — located, and NOT uniform

`tests/helpers/` was deleted by PR #167, so each test file owns its own seeder. All six need a
`workflows?: { sourceName: string; body?: string }[]` arm. **They share no signature, no options
convention and no return type — do not plan them as one uniform edit.**

| # | File | Helper | Shape |
|---|------|--------|-------|
| 1 | `tests/orchestrators/plugin/install.test.ts` | `writePluginComponents:338` / `seedPathMarketplaceWithPlugin:527` | two-layer; `writePluginComponents` owns the component options bag; the outer seeder passes through. **Mutable (non-`readonly`) option fields.** |
| 2 | `tests/orchestrators/plugin/uninstall.test.ts` | `seedFullPlugin:159` / `seedGitPlugin:2207` | **positional** args `(locations, marketplace, plugin, cwd)`; writes artifacts at TARGET paths (not plugin sources) and returns a struct of the paths it wrote |
| 3 | `tests/orchestrators/plugin/reinstall.test.ts` | `seedMarketplace:117` / `seedInstalledGitSourcePlugin:2891` / `seedDisabledInstall:4155` | `readonly` options bag with a separate `ResourceSet` interface (`:113`) and defaulting (`opts.resources ?? { skill, command }`) |
| 4 | `tests/orchestrators/plugin/enable-disable.test.ts` | `seedRealDisabledMarketplace:241` | `(home, opts)`; opts are behavior *knobs* (`unsupportedKind`, `staleInstallableGate`, `malformedSkill`), not component lists |
| 5 | `tests/orchestrators/marketplace/shared.test.ts` | `seedFullCascade:306` | positional `(locations, marketplace, plugin)`; **no options at all** — a fixed one-of-each cascade; returns `{ record, agentName }` |
| 6 | `tests/orchestrators/marketplace/remove.test.ts` | `seedMarketplace:139` | thinnest — writes state only via `saveState`, no artifact writes; artifacts come from a separate `pluginRecord` builder |

**Representative (#1, `install.test.ts:338-346`)** — the arm goes here:

```ts
async function writePluginComponents(
  pluginRoot: string,
  opts: {
    skills?: { sourceName: string; frontmatterName?: string; body?: string }[];
    commands?: { sourceName: string; body?: string }[];
    agents?: { sourceName: string; frontmatterName?: string; tools?: string; body?: string }[];
    mcpServers?: Record<string, unknown>;
    hooksJson?: object;
  },
): Promise<void> {
  for (const skill of opts.skills ?? []) {
    const skillDir = path.join(pluginRoot, "skills", skill.sourceName);
    await mkdir(skillDir, { recursive: true });
    const name = skill.frontmatterName ?? skill.sourceName;
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: ${name}\n---\n\n${skill.body ?? "Body.\n"}`,
    );
  }
  /* ... one loop per kind ... */
}
```

**Fixture-body trap (Phase 111 fell into it).** Only the `"named"` and `"stem-fallback"` verdicts
in `domain/workflow-script.ts:35-83` produce a `generatedName` and therefore stage anything. A
default-export body classifies `skipped`/`no-meta` and writes **zero** envelopes, so the test passes
for the wrong reason. The canonical working body, verbatim from
`tests/integration/workflow-kind-inversion.test.ts:230-234`:

```ts
      assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
        name: "hello:greet",
        description: "greets",
        script: 'export const meta = { name: "greet", description: "greets" };\n',
      });
```

with `const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");`
(same file, `:228`). Note the test composes the envelope path with `path.join`, **not** with the
async `locations.workflowArtifactPath(name)` — a forgotten `await` there yields a leaf literally
named `[object Promise]` instead of throwing. Every new workflows test needs a positive precondition
asserting the envelope exists *before* the sabotage.

---

## Shared Patterns

### Import order (`import-x/order`)

**Source:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts:19-26`
**Apply to:** every new and modified `.ts` file.

```ts
import { readdir, rm } from "node:fs/promises";
import path from "node:path";

import { loadState } from "../../persistence/state-io.ts";
import { errorMessage } from "../../shared/errors.ts";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
```

Builtin → (external) → (internal) → parent → sibling → index → object → **type last**; blank line
between groups; alphabetized case-insensitively within a group; `.ts` extensions explicit. A
multi-specifier type group is alphabetized inside the braces —
`bridges/workflows/unstage.ts:26-30`:

```ts
import type {
  UnstageWorkflowFailure,
  UnstageWorkflowsInput,
  UnstageWorkflowsResult,
} from "./types.ts";
```

### Blank line after block-like statements (`@stylistic/padding-line-between-statements`)

**Source:** `clone-gc.ts:80-99` (three instances in twenty lines)
**Apply to:** every new block.

```ts
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
                                  // <- blank line after the if-block
    throw err;
  }

  const leaks: string[] = [];
  for (const key of entries) {
    if (liveKeys.has(key)) {
      continue;
    }
                                  // <- blank line after the if-block
    const dir = await locations.pluginCloneDir(key);
```

Same rule in the phase undos (`install.ts:1136-1141`):

```ts
    undo: async (c) => {
      if (c.mcpPrep === undefined) {
        return;
      }

      await unstageMcpServers({ /* ... */ });
    },
```

### Typed error convention

**Source:** `extensions/pi-claude-marketplace/shared/errors.ts`, `orchestrators/marketplace/shared.ts:57-65`
**Apply to:** `WorkflowsUnstageFailureError`.

`extends Error`; `this.name = "<ClassName>"` set in the constructor; `readonly` structured fields
carrying the data (never encoded only in the message); discriminated by `instanceof`, never by
message substring; doc comment citing the requirement/decision ID.

### Hygiene-cleanup swallow (D-19-01)

**Source:** `uninstall.ts:409-438`
**Apply to:** every sweeper call site.

Resolve the containment chokepoint **outside** the `try` so a `PathContainmentError` propagates;
swallow only the `rm`.

---

## No Analog Found

| File / element | Role | Data Flow | Reason |
|---|---|---|---|
| the staging age/TTL constant | config | — | **No age or TTL constant exists anywhere in `extensions/`.** The only `mtime` uses are the manifest cache's `(mtimeMs, size)` key and RECON-05 write-back notes. New number, no precedent; `update.ts:1425` is prose-level instinct only. |
| a liveness test for a `randomUUID()` staging root | utility | — | `clone-gc`'s `deriveLiveCloneKeys` reads persisted `resolvedSha`/`resolvedSource`; nothing persists a staging UUID and nothing can. The age bound replaces the mechanism entirely. |
| a test asserting a bridge staging root is empty after a failure | test | — | None exists for any of the five bridges. |
| a disk-state assertion driven from a `statePhase` failure | test | — | `:7385`/`:7445` use that vehicle but assert only rejection + record; `:3335` asserts disk but uses a bridge-phase vehicle. The combination must be composed. |
| a `replacePreparedWorkflows` reinstall primitive | bridge | — | Deliberately absent — `prepareStageWorkflows` + `commitPreparedWorkflows` *is* the replace shape (`bridges/workflows/stage.ts:359-372, 206-236`). The `ReplacementEntry` union stays four-armed; the hooks slot is the precedent for a step outside `replacements[]`. |

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{orchestrators,bridges,persistence,transaction,shared}/`,
`tests/{orchestrators,shared,transaction,integration,bridges}/`
**Files read this session:** 16 production, 8 test
**Pattern extraction date:** 2026-09-05
**Reviewing skills:** `.agents/skills/typescript-unit-testing-review/SKILL.md`,
`.agents/skills/typescript-google-style-review/SKILL.md`
