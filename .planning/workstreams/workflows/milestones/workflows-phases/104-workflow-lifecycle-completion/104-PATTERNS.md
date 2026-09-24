# Phase 104: Workflow lifecycle completion - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 16 production + 8 test/doc surfaces
**Analogs found:** 16 / 16 (14 are in-file sibling-kind analogs)

> **Read this first.** Almost nothing in this phase is a new module. The analog for
> nearly every change is **a sibling component kind three lines above in the same file** —
> how `mcp` (or `hooks`, or `skills`) is already handled. Copy the sibling's shape, place
> the new arm where install's ledger places workflows (**after `mcp`**), and let the
> compiler find the omissions. Line anchors below are against `features/workflows-spike`
> HEAD as of 2026-08-15; re-anchor if Phase 103 commits are amended.

## File Classification

| File to modify | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `orchestrators/marketplace/shared.ts` | orchestrator helper (removal primitive) | batch / file-I/O | **in-file:** the `mcp` slot at `:391-396` + the `hooks` slot at `:385-389` | exact (sibling kind) |
| `orchestrators/plugin/shared.ts` (`applyPartialCascadeFold`) | orchestrator helper | transform | **in-file:** the `hooks` filter line at `:889` | exact |
| `orchestrators/plugin/update.ts` (4 sites + tuple) | orchestrator (hand-rolled 3-phase swap) | batch | **in-file:** the `mcp` arm at each of the 4 sites; the `skills` arm for the leak two-branch | exact |
| `orchestrators/plugin/reinstall.ts` (5 sites) | orchestrator (handle set + replace ledger) | batch | **in-file:** the `mcp` handle for prepare/abort/warnings; the **`hooks` commit** at `:1607-1630` for the commit-in-place choice | exact |
| `orchestrators/plugin/enable-disable.ts` | orchestrator | request-response | **in-file:** nothing to add (inherits cascade + `runInstallLedger`); only stale comment at `:365-367` and the WLIF-06 stamp | doc + stamp only |
| `orchestrators/plugin/install.ts` (workflows phase prepare) | orchestrator ledger | batch | **in-file:** the state phase's snapshot read at `:1214-1215`; `previousSkillNames` at update `:1200` | exact |
| `orchestrators/plugin/uninstall.ts` | orchestrator | request-response | **in-file:** stale comments at `:434-435`, `:450-454`; WLIF-06 stamp | doc + stamp only |
| `bridges/workflows/stage.ts` (WR-06 refusal) | bridge (commit rename loop) | file-I/O | `bridges/commands/stage.ts:405-424` (3-arm), **collapsed to 1 arm** because `displacePreviousTargets` runs first | partial (simpler by construction) |
| `orchestrators/marketplace/shared.ts` (`WorkflowsUnstageFailureError`) | typed error class | — | **in-file:** `AgentsUnstageFailureError` at `:50-64` | exact |
| `shared/errors.ts` (`Phase3Failure["phase"]`) | type | — | in-file: the existing 5-member union | exact |
| `shared/notify.ts` (`REASONS` tail + `PluginUninstalledMessage.reasons` + 2 render arms) | renderer | transform | `"malformed command"` (CLASS-01 / D-86-01) — the last token added; `PluginDisabledMessage.reasons` (ENBL-16) for widening a reasons-less variant | exact |
| `shared/notify-reasons.ts` | closed-set topic groups | transform | in-file: `CommandPrivateReason` union at `:203-214`, closest member `"orphan rewake"` | exact |
| `docs/output-catalog.md` | doc under byte gate | — | `reinstall-degraded-component` block at `:715-730` (a **warning**-severity state) | exact |
| `tests/architecture/{compat-01-no-expansion,notify-closed-set-locks,catalog-uat}.test.ts` | gate tests | — | the `"malformed command"` append + the `38` count comment ladder | exact |
| `tests/helpers/workflow-home.ts` (NEW) | test helper | — | `tests/helpers/git-mock.ts` header + `install-workflows.test.ts:54-79` `withHermeticHome` | role-match |
| `tests/live-uat/workflow-storage-canary.mjs` | live UAT driver | — | in-file: `proveScope` call sites + `fail`/`pass` at `:78-94`; `main`'s `try`/`finally` at `:497-584` | exact |

---

## Pattern Assignments

### `orchestrators/marketplace/shared.ts` — the sixth cascade slot

**Analog:** the `hooks` and `mcp` slots in the same function.

**Sibling call + accumulator** (`:385-396`, verbatim):

```ts
    // LIFE-01 / D-63-01: 5th cascade slot between the agents foreign-content
    // guard and mcp. removeHookConfig is idempotent (NFR-3) -- a plugin that
    // never staged hooks returns `{ removed: pluginName }` cleanly.
    const hooksResult = await removeHookConfig({ locations, pluginName: plugin });
    dropped.hooks = [hooksResult.removed];

    const mcpResult = await unstageMcpServers({
      locations,
      marketplaceName: marketplace,
      pluginName: plugin,
    });
    dropped.mcpServers = [...mcpResult.removedNames];
```

Note the two supply styles already present: `skills`/`commands` read the **recorded
inventory** off `installedPlugin.resources.*` (`:349-359`), while `agents`/`mcp` re-derive
from `marketplaceName`/`pluginName`. Workflows takes the **recorded-inventory** style —
`installedPlugin.resources.workflows` is the only thing that names envelopes outside every
scope root.

**The frozen return literal — duplicated twice, both must gain the axis**
(`:398-419`, both arms carry the identical 5-key literal):

```ts
    return Object.freeze({
      ok: true,
      dropped: Object.freeze({
        skills: Object.freeze([...dropped.skills]),
        commands: Object.freeze([...dropped.commands]),
        agents: Object.freeze([...dropped.agents]),
        hooks: Object.freeze([...dropped.hooks]),
        mcpServers: Object.freeze([...dropped.mcpServers]),
      }),
    });
  } catch (err) {
    return Object.freeze({ ok: false, dropped: Object.freeze({ /* same 5 keys */ }), cause: … });
  }
```

Also: the mutable accumulator literal at `:340-346`, and the `UnstageOutcome.dropped`
interface at `:310-316`.

**The structured-failure precedent** (`:50-64`, verbatim — copy the class shape exactly):

```ts
/**
 * CR-06: AG-5 foreign-content failure carries the structured per-agent
 * `failed[]` from the agents bridge so downstream consumers … can read
 * individual failure reasons WITHOUT re-parsing the textual message.
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

And its **raise site** (`:368-383`) — the shape to mirror if the bridge returns `failed[]`:

```ts
    if (agentsResult.failed.length > 0) {
      const reasons = agentsResult.failed.map((f) => `${f.generatedName}: ${f.reason}`).join("; ");
      const err = new AgentsUnstageFailureError(
        `Failed to remove ${agentsResult.failed.length} agent(s): ${reasons}`,
        agentsResult.failed,
      );
      throw err;
    }
```

**Stale-count doc comments in this file:** `:295` ("through the 4 bridges"), `:303`
("all FIVE bridges"), `:306` ("across all five bridges"), `:322-323` ("PU-1 order
(skills → commands → agents → MCP)" — already omits hooks).

---

### `orchestrators/plugin/shared.ts` — `applyPartialCascadeFold`

**Analog:** the `hooks` axis, added by D-63-04 for exactly this reason.

**Both parameter literals + the body line** (`:855-890`, verbatim tail):

```ts
export function applyPartialCascadeFold(
  installed: {
    resources: { skills: string[]; prompts: string[]; agents: string[]; mcpServers: string[]; hooks: string[] };
  },
  dropped: {
    readonly skills: readonly string[]; readonly commands: readonly string[];
    readonly agents: readonly string[]; readonly hooks: readonly string[];
    readonly mcpServers: readonly string[];
  },
): void {
  …
  // D-63-04: the cascade primitive (cascadeUnstagePlugin) surfaces
  // dropped.hooks alongside the other four axes; the partial-cascade fold
  // must subtract them so a disable / uninstall partial-cascade failure
  // does not leave a stale hooks entry in the in-memory record.
  installed.resources.hooks = installed.resources.hooks.filter((n) => !dropped.hooks.includes(n));
}
```

The workflows line is name-identical on both sides (`resources.workflows` ↔
`dropped.workflows`), so it copies the `hooks` line verbatim with the noun swapped.

---

### `orchestrators/plugin/install.ts` — WR-01 previous-names at the ledger

**Analog A — how a sibling supplies previous names:** `update.ts:1200`
`previousSkillNames: record.resources.skills`.

**Analog B — how this file reads the pre-existing record off the snapshot**
(`install.ts:1214-1215`, in the state phase):

```ts
    const mpInner = c.stateSnapshot.marketplaces[c.marketplace];
    const existing = mpInner?.plugins[c.plugin];
```

The workflows phase's current call (`:1161-1165`) gains the same read plus a **conditional
spread** — `exactOptionalPropertyTypes` makes `previousWorkflowNames: undefined` a compile
error:

```ts
      const previous =
        c.stateSnapshot.marketplaces[c.marketplace]?.plugins[c.plugin]?.resources.workflows;
      const prep = await prepareStageWorkflows({
        …,
        ...(previous !== undefined && { previousWorkflowNames: previous }),
      });
```

Do **not** repoint `c.stagedWorkflowNames` (the undo payload, assigned pre-commit at
`:1170-1172`) at `previous`.

---

### `orchestrators/plugin/update.ts` — four insertion sites (no `runPhases` array exists)

**Site 1 — prepare.** Analog: the `mcp` assignment in the same `try`
(`:1230-1239`), immediately after which the workflows handle is appended. The
previous-name source is already destructured at `:1188` (`const { installable, record } =
preflight;`) and used at `:1200` / `:1211`. `PrepHandles` (`:722-727`, verbatim) gains a
sixth member:

```ts
interface PrepHandles {
  skills: PreparedSkillsStaging;
  commands: PreparedCommandsStaging;
  agents: PreparedAgentsStaging;
  mcp: PreparedMcpStaging;
}
```

**Site 2 — both abort helpers, reverse order.** Verbatim (`:1247-1274`):

```ts
async function abortPartialHandles(handles: Partial<PrepHandles>): Promise<(string | undefined)[]> {
  const leaks: (string | undefined)[] = [];
  if (handles.mcp !== undefined) {
    abortPreparedMcp(handles.mcp);
  }

  if (handles.agents !== undefined) {
    leaks.push(await abortPreparedAgents(handles.agents));
  }
  …
}

async function abortHandles(handles: PrepHandles): Promise<(string | undefined)[]> {
  abortPreparedMcp(handles.mcp);
  const leaks = [await abortPreparedAgents(handles.agents)];
  await abortPreparedCommands(handles.commands);
  await abortPreparedSkills(handles.skills);
  return leaks;
}
```

Workflows unwinds **first** in both (reverse of prepare order), and — because
`abortPreparedWorkflows` returns `string | undefined` — uses the **agents** arm's
`leaks.push(await …)` shape, not the mcp arm's bare call.

**Site 3 — phase-3a commit.** The workflows commit returns `Promise<string | undefined>`
(a cleanup leak), so copy the **skills** arm's two-branch shape verbatim (`:1926-1937`):

```ts
  try {
    const leak = await commitPreparedSkills(handles.skills);
    if (leak !== undefined) {
      phase3aFailures.push({
        phase: "skills",
        msg: `skills staging cleanup leak: ${leak}`,
        cause: new Error(leak),
      });
    }
  } catch (err) {
    phase3aFailures.push({ phase: "skills", msg: errorMessage(err), cause: err });
  }
```

Place the workflows arm **after** the `mcp` arm at `:2007-2011`. Also update the block
comment at `:1918-1922` ("The four commits run in skills -> commands -> agents -> mcp
order").

**Site 4 — the closed phase union (the symmetry guard).** Two places, both compile-gated:

- `shared/errors.ts:323-327` — `readonly phase: "skills" | "commands" | "agents" | "hooks" | "mcp";`
- `update.ts:1301-1302`, verbatim:

  ```ts
  // D-63-01: hooks slot lands between agents and mcp -- mirrors install.ts
  // runPhases literal-array order.
  const PHASE3_FAILURE_PHASES = ["skills", "commands", "agents", "hooks", "mcp"] as const;
  type Phase3Phase = (typeof PHASE3_FAILURE_PHASES)[number];
  ```

  The comment at `:1289-1290` says *"A future fifth bridge surfaces here as a TS error"* —
  reword to sixth.

**Site 5 — the inventory reassignment (CR-03).** Analog: the `mcp` guard, verbatim
(`:1736-1738`):

```ts
    if (!failedPhases.has("mcp")) {
      sRecord.resources.mcpServers = handles.mcp.result.recorded.map((r) => r.generatedName);
    }
```

**Shape asymmetry to respect:** the workflows handle exposes `result.stagedNames` (already
generated names), not `result.recorded[].generatedName`:

```ts
    if (!failedPhases.has("workflows")) {
      sRecord.resources.workflows = [...handles.workflows.result.stagedNames];
    }
```

Place after the `hooks` block (`:1749-1761`). The enclosing closure already carries
`// eslint-disable-next-line sonarjs/cognitive-complexity` at `:1699` with the rationale
that the per-bridge flatness is deliberate — a sixth guard arm needs no restructuring.

---

### `orchestrators/plugin/reinstall.ts` — prepare → commit → record

**Analog for prepare:** the `mcp` handle in `prepareAllHandles` (`:1564-1573`), with the
previous-name source taken from the same `input.oldRecord` the sibling arms read
(`:1537` `previousSkillNames: input.oldRecord.resources.skills`, `:1548`
`previousCommandNames: input.oldRecord.resources.prompts`).

**Analog for the commit-in-place choice:** the **hooks** slot inside `replaceAll`
(`:1607-1630`) — this is the in-file precedent with a written rationale for NOT pushing
onto `replacements[]`, verbatim head:

```ts
    // LIFE-01 / D-63-01: 5th cascade slot between agents and mcp. The hooks
    // bridge has no staging dir per D-63-02; writeHookConfig IS the atomic
    // write. NOT pushed onto `replacements[]` -- the hooks file STAYS IN
    // PLACE on a later-step failure (recovery is via the reinstall hint,
    // not in-process rollback, mirroring update.ts D-03 semantics).
```

If the recommended option (A) is taken, write the workflows slot with the **same explicit
comment shape**, placed **last** (after the mcp replace at `:1631-1632`) so only the state
save can follow it. `ReplacementEntry` (`:253-257`) then stays a four-arm union and the two
exhaustive switches (`:1883-1894`, `:1913-1924`) are untouched.

**Analog for warnings:** `collectStagingWarnings` (`:1832-1839`, verbatim):

```ts
function collectStagingWarnings(handles: PreparedHandles): readonly string[] {
  return Object.freeze([
    ...handles.skills.result.warnings,
    ...handles.commands.result.warnings,
    ...handles.agents.result.warnings,
    ...handles.mcp.result.warnings,
  ]);
}
```

**Analog for abort:** `abortPartialHandles` (`:1841-1860`) — reverse order, `pushLeak`
helper (this file's variant of update's `leaks.push`).

**The record composer — parameter DROP, not a branch.** Verbatim today (`:1739-1770`),
the doc comment becomes actively false and goes with the parameter:

```ts
/**
 * WLIF-01: `previousWorkflows` is carried forward VERBATIM rather than derived
 * from the handles, because this path re-materializes five kinds and leaves
 * workflow envelopes untouched. …
 */
function resourcesFromHandles(
  handles: PreparedHandles,
  previousWorkflows: readonly string[],
  plugin?: string,
  installable?: MaterializablePlugin,
): PluginRecord["resources"] {
  return {
    skills: handles.skills.result.recorded.map((r) => r.generatedName),
    …
    workflows: [...previousWorkflows],
  };
}
```

Both call sites are compile errors once the parameter is dropped: `:1728`
(`updateStateRecord`, 4 args) and `:1779` (`successOutcome`, 2 args). `clonePluginRecord`
(`:2053-2089`) keeps its `workflows: [...record.resources.workflows]` — it snapshots the
OLD record and stays correct.

---

### `orchestrators/plugin/enable-disable.ts` — inherits both directions

**Disable** (`:336`) already calls the cascade and (`:343`) already calls the fold — no new
call. The stale comment to correct is verbatim at `:364-367`:

```ts
  // SET enabled: false; BUMP updatedAt; PRESERVE everything else.
  // ENBL-13 / D-100-04 / COMPONENT_KINDS 5-tuple: artifact removal stays
  // symmetric across all five kinds -- the cascade above physically unstages
  // hooks via removeHookConfig alongside skills, commands, agents and mcp.
```

**Enable** (`:250-265`) calls the guard-FREE `runInstallLedger` with
`allowExistingRecord: true` — the previous names arrive via the install-ledger snapshot
read above; nothing changes here. Never call `installPlugin` (lock is `retries: 0`, not
re-entrant).

Mirror-file stale counts: `persistence/state-io.ts:149`, `reinstall.ts:1740-1745`,
`uninstall.ts:434-435`, `tests/orchestrators/plugin/enable-disable.test.ts:501-502`,
`tests/live-uat/README.md:32`. `install.ts:246` ("intersecting all five") is a false
positive — leave it.

---

### `bridges/workflows/stage.ts` — the WR-06 refusal

**Analog:** the commands bridge's three-arm policy (`bridges/commands/stage.ts:405-424`),
verbatim:

```ts
    const ownedNames = new Set<string>(prepared._previousNames);
    await mkdir(prepared.locations.promptsTargetDir, { recursive: true });
    for (const pair of prepared._renamePairs) {
      const targetName = path.basename(pair.to, ".md");
      if (ownedNames.has(targetName)) {
        await removeOrphanIfPresent(pair.to, "file");
      } else if (await pathExists(pair.to)) {
        throw new Error(`Cannot replace command target with non-previous content at ${pair.to}`);
      }

      await rename(pair.from, pair.to);
      renamed.push(pair);
    }
```

Same shape in `bridges/skills/stage.ts:463-472` (`"tree"`) and
`bridges/agents/stage.ts:487-496`; all three are pinned by `/non-previous content/` tests.

**The workflows analog collapses to one arm** because `displacePreviousTargets` already ran
(`bridges/workflows/stage.ts:300-311`) — anything left at a target path is foreign by
construction. `pathExists` joins the existing `shared/fs-utils.ts` import at
`stage.ts:53` (currently only `cleanupStaging`). The message follows the sibling wording:
`Cannot replace workflow target with non-previous content at ${pair.to}`. A throw here
already routes into the existing rollback block, so the refusal is transactional for free.

---

### `shared/notify.ts` + `shared/notify-reasons.ts` + gates + catalog — adding a reason token

**Analog: `"malformed command"` (CLASS-01 / D-86-01), the last token added.** Its addition
touched exactly these artifacts — copy the set:

| Artifact | Anchor | What the analog did |
|---|---|---|
| `shared/notify.ts` `REASONS` tail | `:174` | appended the literal **at the tail** with a multi-line doc comment above it citing the requirement/decision IDs and the classification rationale |
| `shared/notify.ts` tuple doc | `:79-88` | the "37-entry" sentence (already stale — set is 38) and the command-private list at `:87-88` |
| `shared/notify-reasons.ts` topic group | `:129-130` (in `FAILURE_REASONS`) | gave the literal a home with its own comment; header counts at `:8`, `:13-20` |
| `tests/architecture/compat-01-no-expansion.test.ts` | `:167` | appended to the expected array tail (order-pinned) |
| `tests/architecture/notify-closed-set-locks.test.ts` | `:29`, `:37` | bumped `assert.equal(REASONS.length, 38)` **and** the test title, adding a `// <ID>: +1 for …` line to the running comment ladder |
| `docs/output-catalog.md` | `:715-730` | new `<!-- catalog-state: … -->` block + prose paragraph |
| `tests/architecture/catalog-uat.test.ts` FIXTURES | e.g. `:1380` `reasons: ["malformed skill"]` | one entry per `(section, state)` tuple |

**Home for the new token:** `CommandPrivateReason` (`notify-reasons.ts:203-214`, verbatim)
— closest member is `"orphan rewake"`, an `(installed)`-row advisory owned by one command:

```ts
type CommandPrivateReason =
  | "not found"
  | "not installed"
  | "plugins remain"
  | "stale clone"
  | "duplicate name"
  | "not added"
  | "orphan rewake";
```

An unhomed literal is a TS2344 at `_ReasonsCoverageProof` (`:216-228`) — the compile proof.

**Widening a reasons-LESS variant: the `PluginDisabledMessage` precedent.**
`PluginUninstalledMessage` (`notify.ts:735-745`) declares no `reasons`; the pattern for
adding one optional field is `PluginDisabledMessage` (ENBL-16 / D-100-07) and
`PluginUpdatedMessage` (WR-12), whose doc comments all state the byte-neutrality contract
verbatim:

> *"Absent `reasons` renders the legacy brace-less row byte-for-byte: `composeReasons`
> returns `""` for an undefined list and `joinTokens` collapses the empty slot."*

**Both render arms hard-code `undefined` and must pass `p.reasons`.** Central switch
(`notify.ts:2309-2317`) and uninstall's own render map
(`uninstall.messaging.ts:52-62`) are byte-identical:

```ts
  uninstalled: (p, probe, mpScope) =>
    joinTokens([
      ICON_AVAILABLE,
      p.name,
      renderScopeBracket(p.scope, mpScope),
      renderVersion(p.version),
      "(uninstalled)",
      composeReasons(undefined, false, false, probe),
    ]),
```

Copy the `reinstalled` arm's threading (`notify.ts:2295-2308`) for the replacement — but
keep both soft-dep booleans hard-coded `false` (MSG-SD-3 forbids the marker on uninstall
rows), which is exactly what the `disabled` arm does for ENBL-15.

Also correct the module doc's "9 reasons-less / 10 reasons-bearing" split
(`notify.ts:2094-2103`) — its `updated` and `disabled` entries are already stale.

**`warning` severity vs `success` — the byte hazard.** A `warning` row makes `notify()`
prepend a summary line, so the new catalog entry is a **new state**, never an edit of the
existing `success` block at `docs/output-catalog.md:615-622`. Compare:

`success` (`docs/output-catalog.md:617-622`):

```text
● official [user]
  ○ helper v1.0.0 (uninstalled)

/reload to pick up changes
```

`warning` — the analog is `reinstall-degraded-component` (`docs/output-catalog.md:715-727`):

```text
A plugin operation needs attention.

● official [user]
  ● alpha v1.0.0 (reinstalled) {malformed skill}

Plugin reinstall: 1 warning

/reload to pick up changes
```

Its fixture carries `expectedSeverity: "warning"` — see the shape at
`tests/architecture/catalog-uat.test.ts:944-947`:

```ts
    "success-with-soft-dep": {
      pi: piWithNothingLoaded(),
      expectedSeverity: "warning",
      message: { marketplaces: [ … ] },
    },
```

State names must match `/^[a-z0-9-]+$/` and pair with the **next fenced block** under the
enclosing per-command H2 (`catalog-uat.test.ts:77-154`).

---

### `tests/helpers/workflow-home.ts` (NEW) — the extracted test helper

**Analog for the file's role/conventions:** `tests/helpers/git-mock.ts:1-25` — a block
header explaining what the double is, why it exists, and the strategy; **type-only** imports
of production types (`tests/helpers/credential-mock.ts` header states the reason);
`kebab-case.ts` filename; named exports only; explicit return types.

**Analog for the body:** `tests/orchestrators/plugin/install-workflows.test.ts:54-79`,
verbatim — lift it unchanged (it already has the save/restore + `finally` discipline):

```ts
async function withHermeticHome<T>(
  fn: (ctx: { home: string; workflowHome: string }) => Promise<T>,
): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "install-wf-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;

  const workflowHome = path.join(hermeticHome, ".pi", "workflows");
  setWorkflowHomeDirForTesting(workflowHome);

  try {
    return await fn({ home: hermeticHome, workflowHome });
  } finally {
    setWorkflowHomeDirForTesting(undefined);

    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}
```

Extraction is not optional: four copies trip `sonarjs/no-identical-functions`, an ESLint
**error** here. Parameterize the mkdtemp prefix rather than hard-coding `install-wf-home-`.

**Also in the fixture layer:** `tests/orchestrators/plugin/update.test.ts`'s
`seedPathMarketplace` carries a boolean `hasWorkflows?` writing one fixed file
(`:194-195`, `:248-253`); the triad needs the array shape that
`install-workflows.test.ts:87-92` already has:
`workflows?: { fileName: string; source: string }[]`. And `makePluginRecord`
(`update.test.ts:120-127`) has a bare `workflows: []` where its four siblings read
`resources.<kind> ?? [...]` — make it `workflows: resources.workflows ?? []`.

---

### `tests/live-uat/workflow-storage-canary.mjs` — the WR-10 assertion window

**Analog:** the file's own `main`/`fail`/`pass`/`teardown` structure.

**`fail` / `pass` / `UatExit`** (`:66-94`, verbatim):

```js
class UatExit extends Error {}

function pass(msg) {
  console.log(`[workflow-storage] PASS: ${msg}`);
}

/** Print + throw on a failed assertion. A real defect, not a precondition miss. */
function fail(id, reason, detail) {
  console.error(`\n[workflow-storage] FAIL ${id}: ${reason}`);
  if (detail) {
    console.error(`\n${detail}`);
  }

  throw new UatExit(`${id}: ${reason}`);
}
```

**Section shape to copy** — the existing `X` assertion block at the tail of `main`'s `try`
(`:565-581`): a `console.log("\n[workflow-storage] === … ===")` banner, one or more
`fail(id, reason, detail)` guards, a closing `pass(...)`. The new **Removal** section goes
after `X` and **before** the `finally` at `:582-584`:

```js
  } finally {
    await teardown(ext, [marketplaceRoot, workDir, otherDir, home]);
  }
```

`teardown` (`:472-485`) already runs the uninstalls with `ext.quiet` and then `rm -rf`s the
sandbox HOME — which is why an assertion inside it can only ever pass, and why a `fail()`
throw from that `finally` would **replace** any in-flight primary error. Assert in the
`try`; leave `teardown` untouched (its uninstalls become idempotent no-ops).

Both scopes: list the user half from `otherDir` and the project half from `workDir`,
matching how `proveScope` is called at `:530-563` (`readCwd: otherDir` for user,
`readCwd: workDir` for project). `makeStorage`, `engine`, `otherDir`, `workDir` are all in
scope there.

---

## Shared Patterns

### Placement rule: always after `mcp`

**Source:** `orchestrators/plugin/install.ts:1297-1300` — *"workflows is APPENDED after mcp
rather than inserted, so the five proven materialize orderings ahead of it stay
byte-unchanged. The sequence is [skills, commands, agents, hooks, mcp, workflows,
state]."*
**Apply to:** cascade slot, update prepare/commit/finalize, reinstall prepare/replace,
`dropped` key declaration order. Abort/unwind paths take the **reverse** (workflows first).

### Typed error classes

**Source:** `orchestrators/marketplace/shared.ts:57-64` (see excerpt above).
**Apply to:** `WorkflowsUnstageFailureError`. `extends Error`; `this.name = "<ClassName>"`
in the constructor; readonly typed public fields (never structured data in the message
string only); doc comment citing `WLIF-03`. Callers narrow on `instanceof`, never on
message substring (`uninstall.ts:459` narrows on `AgentsUnstageFailureError`).

### `exactOptionalPropertyTypes` conditional spread

**Source:** `reinstall.ts:1732` — `...(hookEntries !== undefined && { hookEntries: [...hookEntries] })`.
**Apply to:** every optional field assigned from a possibly-`undefined` value
(`previousWorkflowNames`, `reasons`). A plain `field: maybeUndefined` is a compile error.

### Comment policy

**Source:** `.claude/rules/typescript-comments.md`.
**Apply to:** every comment and test title written this phase. Cite `WLIF-0N`, `WR-0N`,
`CR-0N`, `D-NN`, `NFR-N`. Never `Phase NN`, `Plan NN`, `Wave N`, bare `Pitfall N`. The
existing in-file comments quoted above are the tone model: state the mechanism and the
consequence of getting it wrong, not the planning provenance.

### Prefer compile errors over silent gaps

**Source:** the two guards this codebase already uses — `PHASE3_FAILURE_PHASES` /
`Phase3Failure["phase"]` (`update.ts:1301`, `errors.ts:323`) and
`_ReasonsCoverageProof` (`notify-reasons.ts:216-228`).
**Apply to:** every wiring decision. Widen a closed union; drop a function parameter
(`resourcesFromHandles`); add a required key to an explicit interface. The phase's failure
mode is "wired five of six places and the sixth stayed silent" — the compiler is the only
reliable sixth-place detector. ~12 `typeof cascadeUnstagePlugin` stub literals across
`uninstall.test.ts` / `remove.test.ts` / `cascade.test.ts` will break on the sixth
`dropped` key; that is the mechanism working, not collateral damage.

## No Analog Found

None. Every file in this phase modifies existing code with a sibling-kind precedent in the
same file or a direct precedent in a sibling bridge. The one genuinely new file
(`tests/helpers/workflow-home.ts`) is an extraction of code that already exists at
`tests/orchestrators/plugin/install-workflows.test.ts:54-79`.

The one item with **no** precedent to copy is the *shape choice* in
`reinstall.ts` (commit-in-place like `hooks` vs. a full replace/rollback/finalize triple).
That is a decision, not a missing analog — the `hooks` slot at `reinstall.ts:1607-1630` is
the documented in-file precedent for the recommended option.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{orchestrators,bridges,shared,persistence}/`,
`docs/output-catalog.md`, `tests/{architecture,helpers,orchestrators,live-uat}/`
**Files read this session:** 14
**Pattern extraction date:** 2026-08-15
**Line anchors valid against:** `features/workflows-spike` HEAD (`bb6af555` + Phase 103 commits)
