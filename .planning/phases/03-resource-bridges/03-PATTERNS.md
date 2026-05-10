# Phase 3: Resource Bridges -- Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 26 (16 source modules, 5 unit-test files, 4 fixture corpora, 1 integration test)
**Analogs found:** 22 / 26 (4 new files have no V1 analog; covered by Phase 2 dependency patterns)

This map locks the pattern carry-forward for Phase 3's bridge implementation. **The dominant directive is "carry V1 forward."** V1's `agent/`, `mcp/`, and `resource/` modules already passed the 33 REQ-IDs Phase 3 owns; the work is shape (where files live, how the discriminated handles type-check) and three explicit deltas (D-07 schema-in-persistence, typed error subclasses, prepare/commit split for skills + commands). Markings:

- **`[V1]`** = direct carry-forward from V1 (read the V1 file, port verbatim or near-verbatim).
- **`[P2]`** = depends on Phase 2 output (already shipped at `extensions/claude-marketplace/`).
- **`[D-XX]`** = new pattern introduced by a Phase 3 CONTEXT decision; no V1 analog or explicit delta from V1.
- **`[NEW]`** = no analog at all; design from research + first principles.

## Coverage

| Match Quality | Count | Notes |
|---|---|---|
| Exact V1 analog | 14 | agents, MCP, frontmatter, marker, parse, effective-config, convert |
| Role-match V1 analog | 4 | skills/commands prepare-commit split (V1 single-phase `stagePluginResources`) |
| Phase 2 dependency | 4 | atomic-json, locations, name, errors -- new files build on these |
| No analog | 4 | `agents-index-schema.ts`, `agents-index-io.ts`, `errors-bridges.ts`, `vars.ts` |

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `bridges/skills/discover.ts` | bridge primitive (read) | request-response | V1 `resource/stage.ts` (skills branch of `discoverPluginResources`) | role-match |
| `bridges/skills/stage.ts` | bridge primitive (prepare/commit/abort) | file-I/O staging | V1 `resource/stage.ts::stagePluginResources` (skills) + V1 `agent/stage.ts` shape | role-match |
| `bridges/skills/unstage.ts` | bridge primitive (delete) | file-I/O | V1 `agent/stage.ts::unstagePluginAgents` (shape only) | role-match |
| `bridges/skills/rewrite-frontmatter.ts` | utility (text rewrite) | transform | V1 `resource/stage.ts::rewriteFrontmatterName` | exact |
| `bridges/skills/index.ts` | barrel re-export | n/a | V1 `agent/stage.ts` re-export header (lines 24-34) | role-match |
| `bridges/commands/discover.ts` | bridge primitive (read) | request-response | V1 `resource/stage.ts` (commands branch of `discoverPluginResources`) | role-match |
| `bridges/commands/stage.ts` | bridge primitive (prepare/commit/abort) | file-I/O staging | V1 `resource/stage.ts::stagePluginResources` (commands) | role-match |
| `bridges/commands/unstage.ts` | bridge primitive (delete) | file-I/O | V1 `agent/stage.ts::unstagePluginAgents` (shape only) | role-match |
| `bridges/commands/index.ts` | barrel re-export | n/a | V1 `agent/stage.ts` re-export header | role-match |
| `bridges/agents/stage.ts` | bridge primitive (prepare/commit/abort) | file-I/O staging | V1 `agent/stage.ts` (lines 232-566) | exact |
| `bridges/agents/unstage.ts` | bridge primitive (delete) | file-I/O + JSON | V1 `agent/stage.ts::unstagePluginAgents` (lines 591-663) | exact |
| `bridges/agents/convert.ts` | service (pure transform) | transform | V1 `agent/convert.ts` | exact |
| `bridges/agents/frontmatter.ts` | utility (parse + emit) | transform | V1 `agent/frontmatter.ts` | exact |
| `bridges/agents/marker.ts` | utility (predicate) | transform | V1 `agent/stage.ts::isSafeToTouch` (lines 200-230) | exact |
| `bridges/agents/index-mutation.ts` (bridge mutation logic) | service (in-memory partition) | transform | V1 `agent/stage.ts` partition logic (lines 360-386, 596-607) | exact |
| `bridges/agents/index.ts` (barrel re-export) | barrel re-export | n/a | Phase 3 Plan 03-05 split for clarity | role-match |
| `bridges/mcp/stage.ts` | bridge primitive (prepare/commit/abort) | JSON merge | V1 `mcp/stage.ts` (lines 81-173) | exact |
| `bridges/mcp/unstage.ts` | bridge primitive (delete) | JSON merge | V1 `mcp/stage.ts::unstageMcpServers` (lines 185-206) | exact |
| `bridges/mcp/parse.ts` | service (precedence resolver) | request-response | V1 `mcp/parse.ts` | exact |
| `bridges/mcp/merge.ts` (or `marker.ts`) | utility (marker shape) | transform | V1 `mcp/marker.ts` | exact |
| `bridges/mcp/collision-slots.ts` | utility (cross-slot scan) | request-response | V1 `mcp/effective-config.ts` | exact |
| `bridges/mcp/index.ts` | barrel re-export | n/a | V1 `mcp/marker.ts` shape (small) | role-match |
| `persistence/agents-index-schema.ts` | schema + JIT validator | n/a | Phase 2 `persistence/state-io.ts` (lines 38-84) | Phase 2 dep |
| `persistence/agents-index-io.ts` | persistence (load/save) | file-I/O JSON | Phase 2 `persistence/state-io.ts` (lines 119-220) + V1 `agent/stage.ts::loadAgentIndex/saveAgentIndex` | Phase 2 dep + V1 hybrid |
| `shared/vars.ts` | utility (substitution) | transform | V1 `plugin/vars.ts::substitutePluginVars` (NEW location, V1 logic) | exact |
| `shared/errors-bridges.ts` | typed error subclasses | n/a | Phase 2 `shared/path-safety.ts::SymlinkRefusedError` (subclass-of-PathContainmentError pattern) | Phase 2 dep |
| `tests/bridges/**/*.test.ts` | unit/integration tests | n/a | `tests/persistence/state-io.test.ts` + `tests/domain/name.test.ts` | Phase 2 dep |
| `tests/fixtures/plugins/**` | test fixture corpora | n/a | none | NEW |

## Pattern Assignments

Grouped by bridge directory.

---

### Skills bridge (`bridges/skills/`)

#### `bridges/skills/discover.ts`

**Role:** Bridge primitive -- enumerate skill subdirs that contain `SKILL.md`.
**Closest analog:** `extensions/claude-marketplace/resource/stage.ts` (V1 `discoverPluginResources` skills branch, lines 46-72)
**Pattern carry-forward `[V1]`:** Subdir scan → `SKILL.md` filter → `generatedSkillName` per entry. Returns `[]` on missing component dir.
**Pattern delta `[D-09]` `[D-10]`:** SK-2 elision now handled by Phase 2 `domain/name.ts::generatedSkillName` (verified Phase 2 line 51). For SK-5 (D-10), this file ALSO serves as the per-scope `resources_discover` helper -- Phase 7 calls it twice (once per scope) and aggregates errors.
**Pattern delta `[NEW]`:** Sort by `entry.name` for deterministic warning ordering (V1 doesn't sort skills; research line 422 recommends).

**Excerpt (V1 carry-forward, lines 46-72 of `resource/stage.ts`):**
```typescript
const skillsComponent = await readComponentDirectory(resolved, "skills");
if (skillsComponent !== undefined) {
  for (const entry of skillsComponent.entries) {
    if (!entry.isDirectory()) continue;
    assertSafeName(entry.name, `skill directory name in ${skillsComponent.dir}`);
    const skillDir = path.join(skillsComponent.dir, entry.name);
    if (!(await pathExists(path.join(skillDir, "SKILL.md")))) continue;
    skills.push({
      name: entry.name,
      generatedName: generateSkillName(resolved.name, entry.name),
      skillDir,
    });
  }
}
```

#### `bridges/skills/stage.ts`

**Role:** Bridge primitive -- prepare/commit/abort for skills with per-skill atomic dir rename.
**Closest analog:** V1 single-phase `resource/stage.ts::stagePluginResources` (skills branch, lines 178-204) for the per-skill cp+rewrite logic; V1 `agent/stage.ts` (lines 280-525) for the prepare/commit/abort discipline.
**Pattern carry-forward `[V1]`:** `cp -r` skill dir → rewrite SKILL.md `name:` frontmatter → substitute `${CLAUDE_PLUGIN_ROOT}`/`${CLAUDE_PLUGIN_DATA}` → write back. Discriminated `noop | staged` union shape from V1 agents.
**Pattern delta `[D-04]`:** Bridge owns its own staging dir under `<extensionRoot>/skills-staging/<uuid>/` (V1 had orchestrator-level staging dir). Per-skill atomic dir rename at commit (V1 was orchestrator-level tree rename). Same-FS guarantee under `<extensionRoot>/`.
**Pattern delta `[D-08]`:** Substitution helper now `shared/vars.ts::substituteClaudeVars(body, { pluginRoot, pluginData })` -- new location, V1 logic.
**Pattern delta `[NEW]` `[RN-6]`:** New `assertNoSkillCollisions(discovered)` mirrors V1's `assertNoAgentCollisions` (V1 `agent/convert.ts` lines 455-478) -- two source skill names that elide to same generated name throw with both source names listed.

**Excerpt -- prepare shape (V1 `agent/stage.ts` lines 322-468 -- carry the `noop | staged` discriminated return):**
```typescript
export async function prepareStageSkills(input: StageSkillsInput): Promise<PreparedSkillsStaging> {
  const discovered = await discoverPluginSkills({ pluginName, resolved });
  assertNoSkillCollisions(discovered);  // RN-6 throw
  const previousNames = input.previousSkillNames ?? [];

  if (discovered.length === 0 && previousNames.length === 0) {
    return { kind: "noop", result: { stagedNames: [], warnings: [] } };
  }

  const stagingRoot = path.join(locations.extensionRoot, "skills-staging", randomUUID());
  await mkdir(stagingRoot, { recursive: true });
  // ... per-skill cp+rewrite+substitute, collect rename pairs
  return { kind: "staged", locations, stagingRoot, result, _previousNames, _newRenamePairs, ... };
}
```

**Excerpt -- per-skill cp + frontmatter + vars (V1 `resource/stage.ts` lines 188-203, carry verbatim):**
```typescript
for (const skill of skills) {
  assertSafeName(skill.generatedName, "generated skill name");
  const destDir = path.join(skillsOutDir, skill.generatedName);
  assertPathInside(skillsOutDir, destDir, "staged skill destination");
  await cp(skill.skillDir, destDir, { recursive: true });

  const skillMdPath = path.join(destDir, "SKILL.md");
  let content = await readFile(skillMdPath, "utf8");
  content = rewriteFrontmatterName(content, skill.generatedName);  // SK-3
  content = substitutePluginVars(content, pluginRoot, pluginDataDir);  // SK-4
  await writeFile(skillMdPath, content, "utf8");
}
```

**Excerpt -- commit cleanup-on-error (V1 `agent/stage.ts` lines 408-420, carry the `appendLeakToError` pattern):**
```typescript
try {
  for (const c of converted) { /* writeFile each into staging */ }
} catch (err) {
  throw appendLeakToError(err, await cleanupAgentsStaging(stagingDir));
}
```

#### `bridges/skills/unstage.ts`

**Role:** Bridge primitive -- remove previously-staged skill dirs by name.
**Closest analog:** V1 `agent/stage.ts::unstagePluginAgents` (lines 591-663) for the loop-and-tolerate-ENOENT shape (skills don't have an index, so simpler).
**Pattern carry-forward `[V1]`:** ENOENT-tolerant per-name `rm({recursive: true, force: true})` loop → return `removedNames`.
**Pattern delta `[NEW]`:** Skills bridge has no on-disk index; caller (Phase 5) passes `previousSkillNames` from `state.json`. Foreign-content refusal does not apply -- skills directory is owned end-to-end by name (D-06).

**Excerpt (V1 unstage shape, simplified):**
```typescript
export async function unstagePluginSkills(input: UnstagePluginSkillsInput): Promise<UnstageSkillsResult> {
  const skillsTargetRoot = path.join(input.locations.extensionRoot, "resources", "skills");
  const removed: string[] = [];
  for (const name of input.previousSkillNames) {
    const dir = path.join(skillsTargetRoot, name);
    await assertPathInside(skillsTargetRoot, dir, "skill to unstage");
    try {
      await rm(dir, { recursive: true, force: true });
      removed.push(name);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
  }
  return { removedNames: removed, warnings: [] };
}
```

#### `bridges/skills/rewrite-frontmatter.ts`

**Role:** Utility -- rewrite SK-3 `name:` field, preserve all other frontmatter, add frontmatter if missing.
**Closest analog:** V1 `resource/stage.ts::rewriteFrontmatterName` (lines 294-320).
**Pattern carry-forward `[V1]`:** Carry verbatim. Algorithm: detect `---` start; find closing `\n---`; regex-replace `^name:.*$` (multiline mode) or prepend if absent.

**Excerpt (V1 lines 294-320, carry verbatim):**
```typescript
function rewriteFrontmatterName(content: string, newName: string): string {
  if (!content.startsWith("---")) {
    return `---\nname: ${newName}\n---\n\n${content}`;
  }
  const end = content.indexOf("\n---", 3);
  if (end === -1) {
    return `---\nname: ${newName}\n---\n\n${content}`;
  }
  const frontmatter = content.slice(3, end);
  const body = content.slice(end + 4);
  const nameRegex = /^name:.*$/m;
  let newFrontmatter: string;
  if (nameRegex.test(frontmatter)) {
    newFrontmatter = frontmatter.replace(nameRegex, `name: ${newName}`);
  } else {
    newFrontmatter = `\nname: ${newName}` + frontmatter;
  }
  return `---${newFrontmatter}\n---${body}`;
}
```

#### `bridges/skills/index.ts`

**Role:** Barrel re-export.
**Closest analog:** V1 `agent/stage.ts` re-export header (lines 24-34).
**Pattern carry-forward `[V1]`:** Re-export `prepareStageSkills`, `commitPreparedSkills`, `abortPreparedSkills`, `unstagePluginSkills`, `discoverPluginSkills`, plus shared types (`PreparedSkillsStaging`, `StageSkillsInput`, `StageSkillsCommitResult`).

---

### Commands bridge (`bridges/commands/`)

#### `bridges/commands/discover.ts`

**Role:** Bridge primitive -- enumerate flat `*.md` files (non-recursive, ignore non-md).
**Closest analog:** V1 `resource/stage.ts` (commands branch of `discoverPluginResources`, lines 73-87).
**Pattern carry-forward `[V1]`:** `entry.isFile() && entry.name.endsWith(".md")` filter → strip `.md` for command name → `generatedCommandName(plugin, name)`.
**Pattern delta `[D-09]`:** CM-2 elision now handled by Phase 2 `domain/name.ts::generatedCommandName` (verified Phase 2 line 67).

**Excerpt (V1 lines 73-87, carry verbatim):**
```typescript
const commandsComponent = await readComponentDirectory(resolved, "commands");
if (commandsComponent !== undefined) {
  for (const entry of commandsComponent.entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    const commandName = entry.name.slice(0, -3);
    commands.push({
      name: commandName,
      generatedName: generateCommandName(resolved.name, commandName),
      commandFile: path.join(commandsComponent.dir, entry.name),
    });
  }
}
```

#### `bridges/commands/stage.ts`

**Role:** Bridge primitive -- prepare/commit/abort for commands with per-file atomic rename.
**Closest analog:** V1 `resource/stage.ts::stagePluginResources` (commands branch, lines 205-219) + V1 `agent/stage.ts` (lines 280-525) for prepare/commit/abort shape.
**Pattern carry-forward `[V1]`:** Read source `.md` → substitute vars → write to staging → atomic-rename per-file at commit. Discriminated `noop | staged` union.
**Pattern delta `[D-04]`:** Bridge owns staging dir under `<extensionRoot>/commands-staging/<uuid>/` (or analogous under prompts dir adjacent for atomic rename). Per-file `rename` is atomic per-OS guarantee.
**Pattern delta `[D-08]`:** `shared/vars.ts::substituteClaudeVars` (CM-3).
**Pattern delta `[NEW]` `[RN-6]`:** `assertNoCommandCollisions(discovered)` -- two source commands eliding to same `<plugin>:<command>` throw both source names.

**Excerpt -- per-command write+substitute (V1 lines 209-218, carry verbatim):**
```typescript
for (const command of commands) {
  assertSafeName(command.generatedName, "generated command name");
  const destFile = path.join(promptsOutDir, command.generatedName + ".md");
  assertPathInside(promptsOutDir, destFile, "staged prompt destination");
  let content = await readFile(command.commandFile, "utf8");
  content = substitutePluginVars(content, pluginRoot, pluginDataDir);  // CM-3
  await writeFile(destFile, content, "utf8");
}
```

#### `bridges/commands/unstage.ts`

**Role:** Bridge primitive -- remove previously-staged command files by name.
**Closest analog:** V1 `agent/stage.ts::unstagePluginAgents` (shape only, no marker check needed for commands per D-06).
**Pattern carry-forward `[V1]`:** ENOENT-tolerant per-name `rm` loop on `<promptsRoot>/<generatedName>.md`. Same shape as `bridges/skills/unstage.ts`.

#### `bridges/commands/index.ts`

**Role:** Barrel re-export.
**Closest analog:** V1 `agent/stage.ts` re-export header.
**Pattern delta `[D-01]`:** Per-bridge concrete signatures (no shared `Bridge<P>` interface). Re-export the bridge's prepare/commit/abort/unstage + types.

---

### Agents bridge (`bridges/agents/`)

#### `bridges/agents/stage.ts`

**Role:** Bridge primitive -- prepare/commit/abort with marker discipline + ownership guard + agents-index update.
**Closest analog:** V1 `agent/stage.ts` (lines 232-566 -- the `prepareStagePluginAgents` / `commitPreparedAgents` / `abortPreparedAgents` triplet).
**Pattern carry-forward `[V1]`:** Carry the entire prepare/commit/abort triplet verbatim except for the deltas below. The ten-step prepare algorithm (discover → AG-12 collision → load index → partition by `(mp, plugin)` → AG-9 cross-owner guard → noop short-circuit → safety-check previous targets → write staged files into `<extensionRoot>/agents-staging/<uuid>/` → build new index entries → aggregate warnings) is correct and battle-tested.
**Pattern delta `[D-07]`:** Replace inline `loadAgentIndex` / `saveAgentIndex` calls with imports from `persistence/agents-index-io.ts`. Replace inline `validateAgentIndexEntry` with the JIT validator from `persistence/agents-index-schema.ts`.
**Pattern delta `[NEW errors-bridges]`:** Replace plain `Error("Refusing to overwrite agent file at ${path}: ${reason}")` with typed `AgentForeignContentError extends PathContainmentError`. Replace plain `Error("Refusing to stage agents for ...: ${list}.")` with typed `AgentOwnershipConflictError`.
**Pattern delta `[NEW]`:** Hoist V1's `isSafeToTouch` predicate into `bridges/agents/marker.ts::isOwnedAgentFile` so it's testable in isolation.

**Excerpt -- 10-step prepare skeleton (V1 lines 322-468, the structural template to copy):**
```typescript
export async function prepareStagePluginAgents(input: StagePluginAgentsInput): Promise<PreparedAgentsStaging> {
  // 1. Discover (or [] if agentsSourceDir === "")
  const discovered = agentsSourceDir === "" ? [] : await discoverPluginAgents({ pluginName, agentsDir: agentsSourceDir });
  // 2. AG-12 collision detection within this plugin
  assertNoAgentCollisions(discovered);
  // 3. Convert (AG-7 mapping pipeline)
  const converted = discovered.map((d) => convertAgent({ pluginName, pluginRoot, pluginDataDir, knownSkills, discovered: d, sourceHash: d.sourceHash }));
  // 4. Load index, partition by (marketplace, plugin)
  const existingIndex = await loadAgentsIndex(locations);
  const previousEntries = existingIndex.entries.filter((e) => e.marketplace === marketplaceName && e.plugin === pluginName);
  const otherEntries = existingIndex.entries.filter((e) => !(e.marketplace === marketplaceName && e.plugin === pluginName));
  // 5. AG-9 cross-owner guard
  const otherNames = new Map(otherEntries.map((e) => [e.generatedName, e]));
  const conflicts = converted.map((c) => ({ name: c.generatedName, owner: otherNames.get(c.generatedName) })).filter((x) => x.owner !== undefined);
  if (conflicts.length > 0) {
    throw new AgentOwnershipConflictError(/* "<name>" already owned by <other-mp>/<other-plugin> */);
  }
  // 6. AS-9 noop short-circuit
  if (converted.length === 0 && previousEntries.length === 0) {
    return { kind: "noop", result: { stagedNames: [], warnings: [] } };
  }
  // 7. Safety-check previous targets (foreign content refusal -- AG-5)
  for (const entry of previousEntries) {
    const safety = await isOwnedAgentFile(entry.targetPath);
    if (!safety.ok) throw new AgentForeignContentError(entry.targetPath, safety.reason);
  }
  // 8. Write staged files into <extensionRoot>/agents-staging/<uuid>/
  const stagingDir = path.join(locations.agentsStagingDir, randomUUID());
  await mkdir(stagingDir, { recursive: true });
  // ... try/catch with appendLeakToError on cleanup
  // 9. Build new index entries
  // 10. Aggregate warnings + index corruptions
  return { kind: "staged", locations, stagingDir, result, _previousEntries, _otherEntries, _newEntries, _stagedFilePaths };
}
```

**Excerpt -- commit phase (V1 lines 480-525, carry verbatim):**
```typescript
export async function commitPreparedAgents(prepared: PreparedAgentsStaging): Promise<string | undefined> {
  if (prepared.kind === "noop") return undefined;
  // 6. Remove old target files (ENOENT-tolerant)
  await Promise.all(_previousEntries.map(async (entry) => {
    try { await rm(entry.targetPath); }
    catch (err) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err; }
  }));
  // 7. mkdir agents dir + parallel rename staged -> target
  await mkdir(locations.agentsDir, { recursive: true });
  await Promise.all(_stagedFilePaths.map(({ from, to }) => rename(from, to)));
  // 8. Persist new index
  await saveAgentsIndex(locations, { schemaVersion: 1, entries: [..._otherEntries, ..._newEntries] });
  // 9. Best-effort cleanup
  return cleanupAgentsStaging(stagingDir);
}
```

#### `bridges/agents/unstage.ts`

**Role:** Bridge primitive -- remove agents owned by `(marketplace, plugin)` from disk + index.
**Closest analog:** V1 `agent/stage.ts::unstagePluginAgents` (lines 591-663).
**Pattern carry-forward `[V1]`:** Filter index by `(mp, plugin)` → safety-check each (foreign-content preserves entry in `failed[]`) → `rm` each → save reduced index. Carry the `removedNames` / `failed` shape verbatim.
**Pattern delta `[NEW errors-bridges]`:** No throws -- failures are surfaced through the `failed[]` channel (preserved index entries). `AgentForeignContentError` only thrown from `prepare`, NOT from `unstage` (V1 behavior preserved).

**Excerpt (V1 lines 591-663, carry the per-entry outcome union):**
```typescript
type Outcome =
  | { kind: "removed"; name: string }
  | { kind: "preserved"; entry: AgentIndexEntry; failure: UnstagePluginAgentsFailure };

const outcomes = await Promise.all(matching.map(async (entry): Promise<Outcome> => {
  const fail = (reason: string): Outcome => ({ kind: "preserved", entry, failure: { name: entry.generatedName, targetPath: entry.targetPath, reason } });
  let safety: SafetyResult;
  try { safety = await isOwnedAgentFile(entry.targetPath); }
  catch (err) { return fail(errorMessage(err)); }
  if (!safety.ok) return fail(safety.reason);
  try { await rm(entry.targetPath); }
  catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") return fail(errorMessage(err));
  }
  return { kind: "removed", name: entry.generatedName };
}));
```

#### `bridges/agents/convert.ts`

**Role:** Service -- pure AG-7 mapping pipeline + AG-11 throw + AG-12 collision detector + agent-name generator.
**Closest analog:** V1 `agent/convert.ts` (478 lines).
**Pattern carry-forward `[V1]`:** Carry verbatim. `MODEL_MAP`, `TOOL_MAP`, `THINKING_VALUES` are user contract -- DO NOT EDIT. Carry `splitCsv`, `dedupePreservingOrder`, `mapModel`, `mapTools`, `mapThinking`, `mapSkills`, `convertAgent`, `discoverPluginAgents`, `assertNoAgentCollisions`.
**Pattern delta `[D-09]`:** Replace V1's local `generateAgentName` (lines 82-91) with import from Phase 2 `domain/name.ts::generatedAgentName` (already implements the elision logic).
**Pattern delta `[D-08]`:** Replace V1's `substitutePluginVars(body, pluginRoot, pluginDataDir)` import from `plugin/vars.ts` with `shared/vars.ts::substituteClaudeVars(body, { pluginRoot, pluginData: pluginDataDir })`.

**Excerpt -- model/tool maps (V1 lines 59-77, **carry verbatim** -- user contract):**
```typescript
const MODEL_MAP: Record<string, string> = {
  sonnet: "anthropic/claude-sonnet-4-6",
  opus: "anthropic/claude-opus-4-7",
  haiku: "anthropic/claude-haiku-4-5",
};
const TOOL_MAP: Record<string, string> = {
  Read: "read", Bash: "bash", Edit: "edit", Write: "write",
  Grep: "grep", Glob: "find", LS: "ls",
};
const THINKING_VALUES = new Set(["off", "minimal", "low", "medium", "high", "xhigh"]);
```

**Excerpt -- AG-11 empty-tools throw (V1 lines 381-388, carry verbatim):**
```typescript
if (toolsResult.mapped.length === 0) {
  throw new Error(
    `Cannot convert agent "${sourceName}" in plugin "${pluginName}": ` +
    `the mapped tool list is empty (pi-subagents has no safe representation of "no tools"). ` +
    `Source tools: ${rawFrontmatter.tools ?? "(default read,bash,edit)"}; ` +
    `disallowedTools: ${rawFrontmatter.disallowedTools ?? "(none)"}.`,
  );
}
```

**Excerpt -- AG-12 collision (V1 lines 455-478, carry verbatim, function name preserved):**
```typescript
export function assertNoAgentCollisions(agents: readonly { sourceName: string; generatedName: string }[]): void {
  const groups = new Map<string, string[]>();
  for (const agent of agents) {
    const arr = groups.get(agent.generatedName) ?? [];
    arr.push(agent.sourceName);
    groups.set(agent.generatedName, arr);
  }
  const collisions: string[] = [];
  for (const [generatedName, sources] of groups) {
    if (sources.length > 1) {
      collisions.push(`"${generatedName}" <- [${sources.map((s) => `"${s}"`).join(", ")}]`);
    }
  }
  if (collisions.length > 0) {
    throw new Error(`Generated agent name collision detected. Rename one of the source agents:\n  ` + collisions.join("\n  "));
  }
}
```

#### `bridges/agents/frontmatter.ts`

**Role:** Utility -- AG-6 parse + AG-8 emit. Owns YAML quote-flip, body normalize, `-->` HTML-comment escape, deterministic field order.
**Closest analog:** V1 `agent/frontmatter.ts` (226 lines).
**Pattern carry-forward `[V1]`:** Carry verbatim. `GENERATED_AGENT_MARKER` constant, `emitYamlScalar` quote-flip, `sanitizeProvenance`, `parseFrontmatter`, `normalizeBody`, `emitGeneratedAgentFile` -- all user contract.

**Excerpt -- the marker constant (V1 line 23, **carry verbatim** -- user contract per AG-5):**
```typescript
export const GENERATED_AGENT_MARKER = "generated by pi-claude-marketplace";
```

**Excerpt -- field-order policy (V1 lines 173-192, carry verbatim):**
```typescript
lines.push(`name: ${frontmatter.name}`);
lines.push(`description: ${emitYamlScalar(frontmatter.description)}`);
if (frontmatter.model !== undefined) lines.push(`model: ${frontmatter.model}`);
lines.push(`tools: ${frontmatter.tools.join(",")}`);
if (frontmatter.thinking !== undefined) lines.push(`thinking: ${frontmatter.thinking}`);
if (frontmatter.skills.length > 0) lines.push(`skills: ${frontmatter.skills.join(",")}`);
lines.push("systemPromptMode: replace");
lines.push("inheritProjectContext: true");
lines.push("inheritSkills: false");
const generatedFrontmatter = "---\n" + lines.join("\n") + "\n---\n";
```

#### `bridges/agents/marker.ts`

**Role:** Utility -- AG-5 two-part marker check predicate (basename starts with `claude-marketplace-` AND body contains `generated by pi-claude-marketplace`).
**Closest analog:** V1 `agent/stage.ts::isSafeToTouch` (lines 200-230).
**Pattern delta `[NEW]`:** Hoist V1's inline predicate into a named module so it's testable in isolation. Same algorithm.

**Excerpt (V1 lines 200-230, carry verbatim, rename to `isOwnedAgentFile`):**
```typescript
const GENERATED_AGENT_PREFIX = "claude-marketplace-";
type SafetyResult = { ok: true } | { ok: false; reason: string };

export async function isOwnedAgentFile(targetPath: string): Promise<SafetyResult> {
  const base = path.basename(targetPath);
  if (!base.startsWith(GENERATED_AGENT_PREFIX)) {
    return { ok: false, reason: `target filename "${base}" does not start with "${GENERATED_AGENT_PREFIX}"` };
  }
  let contents: string;
  try { contents = await readFile(targetPath, "utf8"); }
  catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ok: true };
    throw err;
  }
  if (!contents.includes(GENERATED_AGENT_MARKER)) {
    return { ok: false, reason: `target ${targetPath} is missing the generated marker` };
  }
  return { ok: true };
}
```

#### `bridges/agents/index-mutation.ts` (bridge mutation logic)

**Role:** Service -- in-memory partition + merge for the agents-index. Compute next index from `(prevEntries ∪ otherEntries ∪ newEntries)`.
**Closest analog:** V1 `agent/stage.ts` partition logic (lines 360-386, 596-607).
**Pattern carry-forward `[V1]`:** Two filters by `(marketplace, plugin)` tuple. Concat `[...otherEntries, ...newEntries]` for the next index.
**Pattern delta `[D-07]`:** This file does NOT do the JSON IO -- that's `persistence/agents-index-io.ts`. This file is pure in-memory compute (testable without disk).
**Pattern delta `[Plan 03-05]`:** Split from `index.ts` into a separate `index-mutation.ts` so the barrel `index.ts` can stay a pure re-export. Resolves PATTERNS.md vs plan double-use of `index.ts`.

**Excerpt -- partition by `(mp, plugin)` (V1 lines 362-367):**
```typescript
const previousEntries = existingIndex.entries.filter(
  (e) => e.marketplace === marketplaceName && e.plugin === pluginName,
);
const otherEntries = existingIndex.entries.filter(
  (e) => !(e.marketplace === marketplaceName && e.plugin === pluginName),
);
```

#### `bridges/agents/index.ts` (barrel re-export)

**Role:** Re-export public surface. **Resolved per Plan 03-05:** the barrel lives at `index.ts`; the in-memory mutation logic lives at `index-mutation.ts` (separate file). This eliminates the double-use ambiguity flagged in earlier drafts.

---

### MCP bridge (`bridges/mcp/`)

#### `bridges/mcp/stage.ts`

**Role:** Bridge primitive -- prepare/commit/abort for MCP servers via in-memory JSON merge with `_claudeMarketplace` markers.
**Closest analog:** V1 `mcp/stage.ts` (lines 81-173).
**Pattern carry-forward `[V1]`:** Carry verbatim except for the deltas below. Read scoped `mcp.json` → partition existing servers by marker (ours vs theirs) → cross-slot collision check → noop short-circuit → stamp new entries with marker → build merged doc → atomic JSON write.
**Pattern delta `[NEW errors-bridges]`:** Replace plain `Error("Refusing to stage MCP servers for ...: name "${name}" already exists in ${owningPath}.")` with typed `McpServerCollisionError` carrying `{ serverName, owningPath }`.
**Pattern delta `[D-04]` `[MC-6]` `[AS-8]`:** Discriminated `noop | staged` union -- noop branch returns when `newNames.length === 0 && ours.size === 0`. The noop MUST NOT materialize the file (PRD §5.8 MC-6 + Phase 3 success criterion 4). V1 already implements this correctly.

**Excerpt -- prepare partition + collision check + stamping (V1 lines 81-143, carry verbatim):**
```typescript
export async function prepareStageMcpServers(input: StageMcpInput): Promise<PreparedMcpStaging> {
  const doc = await readScopedDoc(locations.mcpJsonPath);
  const existing = getMcpServers(doc);

  // Partition existing into ours-vs-theirs by marker
  const ours = new Set<string>();
  const theirs: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(existing)) {
    if (isOwnedBy(value, pluginName, marketplaceName)) ours.add(name);
    else theirs[name] = value;
  }

  // MC-4 collision check across all four pi-mcp-adapter slots; self-replace OK
  const newNames = Object.keys(servers);
  if (newNames.length > 0) {
    const effective = await loadEffectiveServerNames(locations.cwd);  // <-- 4-slot scan
    for (const name of newNames) {
      if (ours.has(name)) continue;
      const owningPath = effective.get(name);
      if (owningPath !== undefined && owningPath !== locations.mcpJsonPath) {
        throw new McpServerCollisionError(/* `name "${name}" already exists in ${owningPath}.` */);
      }
      if (Object.prototype.hasOwnProperty.call(theirs, name)) {
        throw new McpServerCollisionError(/* `name "${name}" already exists in ${locations.mcpJsonPath}.` */);
      }
    }
  }

  // AS-8 noop branch
  if (newNames.length === 0 && ours.size === 0) return { kind: "noop" };

  // Stamp markers
  const marker = buildMarker(pluginName, marketplaceName);
  const stamped: Record<string, unknown> = {};
  for (const [name, entry] of Object.entries(servers)) {
    stamped[name] = { ...(entry as Record<string, unknown>), [CLAUDE_MARKETPLACE_MARKER_KEY]: marker };
  }
  const next: RawMcpDoc = { ...doc, mcpServers: { ...theirs, ...stamped } };
  return { kind: "staged", locations, stagedNames: newNames, _nextDoc: next };
}
```

**Excerpt -- commit (V1 lines 149-155, carry verbatim except `mcpJsonPath`):**
```typescript
export async function commitPreparedMcp(prepared: PreparedMcpStaging): Promise<void> {
  if (prepared.kind === "noop") return;
  await atomicWriteJson(prepared.locations.mcpJsonPath, prepared._nextDoc);
}
```

**Excerpt -- abort (V1 lines 162-164, carry verbatim -- no-op since prepare wrote nothing):**
```typescript
export function abortPreparedMcp(_prepared: PreparedMcpStaging): void {
  // No-op: nothing was written outside memory pre-commit.
}
```

#### `bridges/mcp/unstage.ts`

**Role:** Bridge primitive -- drop server entries with marker matching `(plugin, marketplace)`.
**Closest analog:** V1 `mcp/stage.ts::unstageMcpServers` (lines 185-206).
**Pattern carry-forward `[V1]`:** Read scoped `mcp.json` → split by marker → atomic write of kept entries → return removed names.
**Pattern delta `[MC-7]`:** Tolerate missing `mcpServers` field without crashing (V1 already does via `getMcpServers` returning `{}`).
**Pattern delta `[D-04]`:** Don't materialize the file if `removed.length === 0` (V1 already does -- early return).

**Excerpt (V1 lines 185-206, carry verbatim except `mcpJsonPath`):**
```typescript
export async function unstageMcpServers(input: UnstageMcpInput): Promise<UnstageMcpResult> {
  const doc = await readScopedDoc(locations.mcpJsonPath);
  const existing = getMcpServers(doc);
  const removed: string[] = [];
  const kept: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(existing)) {
    if (isOwnedBy(value, pluginName, marketplaceName)) removed.push(name);
    else kept[name] = value;
  }
  if (removed.length === 0) return { removedNames: [] };
  await atomicWriteJson(locations.mcpJsonPath, { ...doc, mcpServers: kept });
  return { removedNames: removed };
}
```

#### `bridges/mcp/parse.ts`

**Role:** Service -- MC-1 precedence chain (entry > manifest > standalone `.mcp.json`).
**Closest analog:** V1 `mcp/parse.ts` (100 lines).
**Pattern carry-forward `[V1]`:** Carry verbatim. First-match-wins precedence; malformed at matched source throws (no fallthrough).
**Pattern delta `[NONE]`:** This file is small and correct as-is.

**Excerpt -- precedence chain (V1 lines 40-100, carry verbatim):**
```typescript
export async function resolvePluginMcpServers(input: ResolvePluginMcpServersInput): Promise<ResolvedMcpServers> {
  if (entry.mcpServers !== undefined) {
    return { source: "marketplace-entry", servers: parseMcpServers(entry.mcpServers, "marketplace-entry mcpServers") };
  }
  if (manifest.mcpServers !== undefined) {
    return { source: "plugin-manifest", servers: parseMcpServers(manifest.mcpServers, "plugin-manifest mcpServers") };
  }
  const standalonePath = path.join(pluginRoot, ".mcp.json");
  let raw: string;
  try { raw = await readFile(standalonePath, "utf8"); }
  catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "ENOTDIR") return { source: "none", servers: {} };
    throw err;
  }
  // ... MC-2: accept both wrapped and unwrapped forms
  return { source: "standalone", servers: parseMcpServers(serversValue, ...) };
}
```

#### `bridges/mcp/merge.ts` (`marker.ts` rename)

**Role:** Utility -- `_claudeMarketplace` marker shape and ownership predicate.
**Closest analog:** V1 `mcp/marker.ts` (41 lines).
**Pattern carry-forward `[V1]`:** Carry verbatim. `CLAUDE_MARKETPLACE_MARKER_KEY = "_claudeMarketplace"`, `readMarker`, `buildMarker`, `isOwnedBy`.
**Note:** CONTEXT.md mentions `bridges/mcp/merge.ts` and `bridges/mcp/collision-slots.ts`. Plan should clarify whether `merge.ts` = `marker.ts` (V1 name) or a new file. Recommended: keep `marker.ts` for the marker-shape utilities (V1 carry) and use `merge.ts` for the partition-and-stamp logic if extracted from `stage.ts`.

**Excerpt -- marker key + readMarker (V1 lines 1-29, **carry verbatim** -- user contract):**
```typescript
export const CLAUDE_MARKETPLACE_MARKER_KEY = "_claudeMarketplace";

export function readMarker(value: unknown): ClaudeMarketplaceMarker | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const marker = (value as Record<string, unknown>)[CLAUDE_MARKETPLACE_MARKER_KEY];
  if (typeof marker !== "object" || marker === null || Array.isArray(marker)) return null;
  const obj = marker as Record<string, unknown>;
  if (typeof obj.plugin !== "string" || typeof obj.marketplace !== "string") return null;
  return { plugin: obj.plugin, marketplace: obj.marketplace };
}
```

#### `bridges/mcp/collision-slots.ts`

**Role:** Utility -- enumerate four pi-mcp-adapter slots and map server name → first-declaring path.
**Closest analog:** V1 `mcp/effective-config.ts` (55 lines).
**Pattern carry-forward `[V1]`:** Carry verbatim. The four-slot list (`~/.config/mcp/mcp.json`, `~/.pi/agent/mcp.json`, `<cwd>/.mcp.json`, `<cwd>/.pi/mcp.json`) is user contract per RN-5/MC-4.
**Pattern delta `[NEW]`:** Optionally hoist the slot constant to `MCP_COLLISION_SLOTS` (CONTEXT.md mentions this name) for testability.

**Excerpt -- four-slot read order (V1 lines 8-16, **carry verbatim** -- user contract):**
```typescript
export async function loadEffectiveServerNames(cwd: string): Promise<Map<string, string>> {
  const home = homedir();
  const candidates: string[] = [
    path.join(home, ".config", "mcp", "mcp.json"),  // shared-global
    path.join(home, ".pi", "agent", "mcp.json"),    // pi-global
    path.join(cwd, ".mcp.json"),                    // shared-project
    path.join(cwd, ".pi", "mcp.json"),              // pi-project
  ];
  // ... first-declaring wins; malformed JSON contributes nothing; EACCES propagates
}
```

#### `bridges/mcp/index.ts`

**Role:** Barrel re-export.
**Closest analog:** V1 `mcp/marker.ts` shape (small).
**Pattern delta `[D-01]`:** Per-bridge concrete signatures. Re-export `prepareStageMcpServers`, `commitPreparedMcp`, `abortPreparedMcp`, `unstageMcpServers`, `resolvePluginMcpServers`, `MCP_COLLISION_SLOTS`, marker types.

---

### Persistence layer additions (`persistence/`)

#### `persistence/agents-index-schema.ts`

**Role:** Schema definition + JIT-compiled validator for `agents-index.json` (schemaVersion 1).
**Closest analog:** Phase 2 `persistence/state-io.ts` (lines 38-84) -- the `STATE_SCHEMA` + `STATE_VALIDATOR` pattern.
**Pattern delta `[D-07]` `[NEW]`:** No V1 analog at module level (V1 hand-rolled `validateAgentIndexEntry` inline). Mirror Phase 2's TypeBox JIT pattern.

**Excerpt -- TypeBox schema pattern from Phase 2 `state-io.ts` (lines 38-84, structural template):**
```typescript
import Type from "typebox";
import { Compile } from "typebox/compile";

const AGENTS_INDEX_ENTRY_SCHEMA = Type.Object({
  plugin: Type.String(),
  marketplace: Type.String(),
  sourceAgent: Type.String(),
  generatedName: Type.String(),
  sourcePath: Type.String(),
  targetPath: Type.String(),
  sourceHash: Type.String(),
  originalModel: Type.Optional(Type.String()),
  droppedFields: Type.Array(Type.String()),
  droppedTools: Type.Array(Type.String()),
  warnings: Type.Array(Type.String()),
});

export const AGENTS_INDEX_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(1),
  entries: Type.Array(AGENTS_INDEX_ENTRY_SCHEMA),
});

export type AgentsIndex = Type.Static<typeof AGENTS_INDEX_SCHEMA>;
export const AGENTS_INDEX_VALIDATOR = Compile(AGENTS_INDEX_SCHEMA);
```

**Decision point for planner:** Phase 2 calls the field `entries`; V1 calls it `agents`. The on-disk shape is breaking either way relative to V1. Pick `entries` for forward consistency with Phase 2's vocabulary; document the rename in the plan.

#### `persistence/agents-index-io.ts`

**Role:** Persistence -- load + save with file-level throw, per-row soft-fail (AG-4).
**Closest analog:** V1 `agent/stage.ts::loadAgentIndex` (lines 78-126) + `saveAgentIndex` (lines 173-188); structural template from Phase 2 `persistence/state-io.ts::loadState` / `saveState` (lines 119-220).
**Pattern carry-forward `[V1]`:** AG-4 soft-fail discipline -- file-level corruption (parse fail, missing schemaVersion, missing entries array) throws; per-row corruption drops the row + collects into `corruptions[]` returned through `LoadedAgentsIndex`.
**Pattern delta `[D-07]`:** Use `AGENTS_INDEX_VALIDATOR.Check` for per-row validation instead of hand-rolled `validateAgentIndexEntry`. Use `atomicWriteJson` for save (Phase 2 dependency).

**Excerpt -- file-level vs per-row split (V1 lines 78-126, carry the discipline):**
```typescript
export async function loadAgentsIndex(locations: ScopedLocations): Promise<LoadedAgentsIndex> {
  let text: string;
  try { text = await readFile(locations.agentsIndexPath, "utf8"); }
  catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { schemaVersion: 1, entries: [], corruptions: Object.freeze([]) };
    }
    throw err;
  }
  // file-level: parse + schemaVersion + entries-is-array -> THROW
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch (err) { throw new Error(`Failed to parse agents-index at ${path}: ...`, { cause: err }); }
  // ... schemaVersion + entries-array file-level checks throw

  // per-row: validate each, collect corruptions
  const validEntries: AgentsIndexEntry[] = [];
  const corruptions: string[] = [];
  for (const [index, entry] of parsedEntries.entries()) {
    if (AGENTS_INDEX_VALIDATOR.Check(/* entry */)) validEntries.push(entry);
    else corruptions.push(`${path}.entries[${index}]: ${firstValidationErrorDetail(entry)}`);
  }
  return { schemaVersion: 1, entries: validEntries, corruptions };
}
```

**Excerpt -- save uses atomicWriteJson (Phase 2 carry, line 219):**
```typescript
export async function saveAgentsIndex(locations: ScopedLocations, index: AgentsIndexFileOnDisk): Promise<void> {
  // schema-validate before write (Phase 2 saveState pattern at line 212)
  if (!AGENTS_INDEX_VALIDATOR.Check(index)) throw new Error(`saveAgentsIndex refused: ...`);
  await atomicWriteJson(locations.agentsIndexPath, index);
}
```

**Note:** `locations.agentsIndexPath` is NOT YET in Phase 2's `ScopedLocations` brand. Plan must add `agentsIndexPath: <extensionRoot>/agents-index.json` to `persistence/locations.ts`.

---

### Shared layer additions (`shared/`)

#### `shared/vars.ts`

**Role:** Utility -- pure substitution helper for `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`.
**Closest analog:** V1 `plugin/vars.ts::substitutePluginVars` (consumed by V1 `agent/convert.ts` line 5 and `resource/stage.ts` line 7).
**Pattern carry-forward `[V1]`:** Carry the substitution algorithm (string replace of two literal placeholders). Both skills (SK-4) and commands (CM-3) consume.
**Pattern delta `[D-08]`:** Move from `plugin/vars.ts` (V1 location) to `shared/vars.ts` (Phase 3 location). Rename `substitutePluginVars(body, pluginRoot, pluginDataDir)` to `substituteClaudeVars(body, { pluginRoot, pluginData })` to make the call sites self-documenting.

**Excerpt -- the function signature pattern:**
```typescript
export interface ClaudeVars {
  pluginRoot: string;   // ${CLAUDE_PLUGIN_ROOT} -- absolute pluginRoot from ResolvedPluginInstallable
  pluginData: string;   // ${CLAUDE_PLUGIN_DATA} -- <scopeRoot>/claude-marketplace/data/<mp>/<plugin>/
}

export function substituteClaudeVars(body: string, vars: ClaudeVars): string {
  return body
    .replaceAll("${CLAUDE_PLUGIN_ROOT}", vars.pluginRoot)
    .replaceAll("${CLAUDE_PLUGIN_DATA}", vars.pluginData);
}
```

**Note:** Phase 3 emits the substituted string only. The `data/<mp>/<plugin>/` directory creation is Phase 5's install orchestrator concern (CONTEXT D-08).

#### `shared/errors-bridges.ts`

**Role:** Typed error subclasses for Phase 3 bridge throws.
**Closest analog:** Phase 2 `shared/path-safety.ts::SymlinkRefusedError` (lines 30-40) -- the "subclass-of-PathContainmentError, override `name` + `message`, add domain-specific fields" pattern.
**Pattern delta `[NEW]` `[D-06]`:** No V1 analog (V1 throws plain `Error`). Phase 1 D-17 inheritance pattern says PI-14 `instanceof PathContainmentError` should still catch foreign-content refusals.

**Excerpt -- subclass pattern from Phase 2 `shared/path-safety.ts` (lines 30-40, structural template):**
```typescript
export class SymlinkRefusedError extends PathContainmentError {
  readonly linkPath: string;
  readonly linkTarget: string;
  constructor(parent: string, child: string, label: string, linkPath: string, linkTarget: string) {
    super(parent, child, label);
    this.name = "SymlinkRefusedError";
    this.message = `${label} contains symlink ${linkPath} -> ${linkTarget} (parent: ${parent}, target: ${child}).`;
    this.linkPath = linkPath;
    this.linkTarget = linkTarget;
  }
}
```

**New error types Phase 3 introduces:**
- `AgentForeignContentError extends PathContainmentError` -- AG-5 refusal to overwrite non-`claude-marketplace-` agent file or file missing the marker. Carries `targetPath`, `reason`.
- `AgentOwnershipConflictError extends Error` -- AG-9 refusal when generated agent name is owned by a different `(marketplace, plugin)`. Carries `conflicts: { name, owner: { marketplace, plugin } }[]`.
- `McpServerCollisionError extends Error` -- MC-4 refusal when server name exists in another pi-mcp-adapter slot. Carries `serverName`, `owningPath`.
- `BridgeStagingError extends Error` -- generic wrapper for staging tmp failures (uses `Error.cause`).

---

### Tests (`tests/bridges/**`)

#### `tests/bridges/skills/*.test.ts`, `tests/bridges/commands/*.test.ts`, `tests/bridges/agents/*.test.ts`, `tests/bridges/mcp/*.test.ts`, `tests/bridges/integration.test.ts`

**Role:** Unit tests (per-bridge primitives) + integration test (cross-bridge install/uninstall).
**Closest analog:** Phase 2 `tests/persistence/state-io.test.ts` (round-trip, cleanup helper, fixtures) and `tests/domain/name.test.ts` (REQ-ID-prefixed test names).
**Pattern carry-forward `[P2]`:** `node:test` test runner; `node:assert/strict`. `tmpExtensionRoot` helper that creates `mkdtemp` + cleanup with retry on `ENOTEMPTY`. Test name prefixed with REQ-ID for grep-able coverage.

**Excerpt -- tmpExtensionRoot helper pattern (Phase 2 `tests/persistence/state-io.test.ts` lines 28-51, carry verbatim):**
```typescript
async function tmpExtensionRoot(): Promise<{ root: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-bridges-test-"));
  const root = path.join(dir, "claude-marketplace");
  await mkdir(root, { recursive: true });
  const cleanup = async (): Promise<void> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try { await rm(dir, { recursive: true, force: true }); return; }
      catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOTEMPTY" && attempt < 9) {
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
          continue;
        }
        throw err;
      }
    }
  };
  return { root, cleanup };
}
```

**Excerpt -- REQ-ID-prefixed test name pattern (Phase 2 `tests/domain/name.test.ts` lines 15-37):**
```typescript
test("RN-2 assertSafeName accepts valid simple name", () => { ... });
test("AG-9 prepareStagePluginAgents throws AgentOwnershipConflictError on cross-(mp,plugin) collision", async () => { ... });
test("AG-5 isOwnedAgentFile rejects file without marker even when basename matches", async () => { ... });
test("AS-9 prepareStagePluginAgents returns kind:'noop' when no agents and no previous entries", async () => { ... });
```

**Test taxonomy (1:1 with REQ-IDs):**
- `tests/bridges/skills/` -- one file per primitive: `discover.test.ts`, `stage.test.ts` (prepare/commit/abort), `unstage.test.ts`, plus `rewrite-frontmatter.test.ts`. SK-1, SK-2, SK-3, SK-4, SK-5, RN-6.
- `tests/bridges/commands/` -- same shape. CM-1, CM-2, CM-3, CM-4, RN-6.
- `tests/bridges/agents/` -- `discover.test.ts`, `stage.test.ts`, `unstage.test.ts`, `convert.test.ts`, `frontmatter.test.ts`, `marker.test.ts`, `index.test.ts` (round-trip, per-row corruption, file-level corruption). AG-1..12, AS-9, RN-4.
- `tests/bridges/mcp/` -- `stage.test.ts`, `unstage.test.ts`, `parse.test.ts`, `slots.test.ts` (4-slot fixture). MC-1..8, RN-5, AS-8.
- `tests/bridges/integration.test.ts` -- full install / re-stage / uninstall cycle exercising all four bridges.
- `tests/bridges/types.test.ts` -- `@ts-expect-error` block proving cross-bridge `Prepared<bridge>` handles can't be passed (D-01 corollary).

#### `tests/fixtures/plugins/{full-plugin,empty-mcp,empty-agents,foreign-agent}/`

**Role:** Static plugin fixtures for bridge tests.
**Closest analog:** None at fixture level; structurally `tests/persistence/fixtures/legacy/` (Phase 2 has 3 small JSON files for legacy state.json migration) and `tests/domain/fixtures/hash-stability/` (Phase 2 has multi-file plugin fixtures with intentional encoding variations).
**Pattern delta `[NEW]`:** Build plugin fixture trees mirroring real Claude plugin layouts. Each fixture is a complete plugin directory under the test fixtures root.

**Fixture directory shape (proposed):**
```
tests/fixtures/plugins/
  full-plugin/                       # AG-1..12 + SK-1..4 + CM-1..3 + MC-1..6 happy path
    .claude-plugin/plugin.json
    skills/<skill1>/SKILL.md
    skills/<skill2>/SKILL.md
    commands/<cmd1>.md
    commands/<plugin>-<cmd2>.md      # tests CM-2 elision
    agents/<agent1>.md
    agents/<plugin>-<agent2>.md      # tests AG-1 elision
    .mcp.json
  empty-mcp/                         # AS-8 noop -- empty plugin, ensures no mcp.json materialized
    .claude-plugin/plugin.json
  empty-agents/                      # AS-9 noop -- agents/ dir but empty
    agents/.gitkeep                  # or omit dir entirely
  foreign-agent/                     # AG-5 foreign-content refusal corpus
    agents/no-marker.md              # basename matches but body lacks GENERATED_AGENT_MARKER
    agents/wrong-basename.md         # body has marker but basename doesn't start with claude-marketplace-
```

**Excerpt -- fixture loading pattern from Phase 2 `tests/persistence/state-io.test.ts` lines 25-26:**
```typescript
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures/plugins");
// ...
const fullPluginRoot = path.join(FIXTURES, "full-plugin");
```

---

## Shared Patterns (cross-cutting)

### Atomic JSON write
**Source:** `extensions/claude-marketplace/shared/atomic-json.ts` (Phase 2 carry-forward of Phase 1 D-03).
**Apply to:** `bridges/mcp/stage.ts` (mcp.json), `persistence/agents-index-io.ts` (agents-index.json). NOT to staging-tree commits (those use `mkdir`+`writeFile`+`rename`).
**Excerpt:**
```typescript
import writeFileAtomic from "write-file-atomic";
export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8" });
}
```

### Path containment
**Source:** `extensions/claude-marketplace/shared/path-safety.ts::assertPathInside` (Phase 1 D-15 chokepoint).
**Apply to:** Every name-derived path in every bridge -- staging dir entries, target file/dir paths, source resolution. SC-7 / NFR-10.
**Excerpt:**
```typescript
await assertPathInside(scopedAgentsDir, targetFile, "agent target path");
await assertPathInside(stagingDir, stagedFile, "staged agent path");
```

### Cleanup-on-error with leak surfacing
**Source:** V1 `agent/stage.ts` (lines 408-420) + V1 `errors.ts::appendLeakToError`.
**Apply to:** Every bridge's prepare-time staging loop where partial writes need rollback.
**Excerpt:**
```typescript
try {
  for (const c of converted) { await writeFile(stagedFile, c.fileContent, "utf8"); }
} catch (err) {
  throw appendLeakToError(err, await cleanupStaging(stagingDir, "agents staging directory"));
}
```

**Note:** Phase 2 `shared/errors.ts` already has `appendLeakToError` and `appendLeaks`. V1's `cleanupStaging` lives in V1's `fs-utils.ts`; Phase 3 needs to either port it to `shared/fs-utils.ts` (NEW file) or inline the `rm({recursive:true,force:true})` per bridge. **Recommendation:** add `cleanupStaging(dir, label)` to `shared/fs-utils.ts` (returns `string | undefined` -- the leak message if cleanup failed).

### Discriminated `noop | staged` union for Prepared<bridge>
**Source:** V1 `agent/stage.ts::PreparedAgentsStaging` (lines 289-312) and V1 `mcp/stage.ts::PreparedMcpStaging` (lines 65-72).
**Apply to:** All four bridges' Prepared types. The `noop` branch MUST short-circuit commit + abort with no I/O when there's nothing to stage AND nothing previously owned. AS-8 (mcp) and AS-9 (agents) make this binding; skills + commands also follow for consistency.
**Excerpt:**
```typescript
export type PreparedAgentsStaging = PreparedAgentsNoop | PreparedAgentsStaged;
export interface PreparedAgentsNoop {
  readonly kind: "noop";
  readonly result: StageAgentsCommitResult;  // empty stagedNames + empty warnings
}
export interface PreparedAgentsStaged {
  readonly kind: "staged";
  readonly locations: ScopedLocations;
  readonly stagingDir: string;
  readonly result: StageAgentsCommitResult;
  readonly _previousEntries: readonly AgentsIndexEntry[];
  readonly _otherEntries: readonly AgentsIndexEntry[];
  readonly _newEntries: readonly AgentsIndexEntry[];
  readonly _stagedFilePaths: readonly { from: string; to: string }[];
}
```

### Notify routing forbidden in bridges (IL-2)
**Source:** Phase 2 `shared/notify.ts` -- the SOLE sanctioned `ctx.ui.notify` call site.
**Apply to:** **NEVER** import `shared/notify.ts` from any `bridges/` file. Bridges throw or return `CommitResult` containing `warnings[]` / `failed[]`. Phase 4/5 orchestrators are the consumers that route to `notifyWarning` / `notifyError`.
**Verification:** This is enforced by the existing `tests/architecture/import-boundaries.test.ts`. Phase 3 plan must NOT add `bridges → presentation` or `bridges → notify` edges.

### Marker constants (user contract)
**Source:** Phase 2 `shared/markers.ts` (`PI_SUBAGENTS_NOT_LOADED`, `PI_MCP_ADAPTER_NOT_LOADED`, `RELOAD_HINT_PREFIX`) and V1 `agent/frontmatter.ts::GENERATED_AGENT_MARKER`.
**Apply to:** Bridges DO NOT emit `PI_SUBAGENTS_NOT_LOADED` / `PI_MCP_ADAPTER_NOT_LOADED` -- those are Phase 4/5 orchestrator concerns. Bridges DO use `GENERATED_AGENT_MARKER` literally in `bridges/agents/frontmatter.ts` and `bridges/agents/marker.ts`.
**Verification:** `tests/architecture/markers-snapshot.test.ts` (existing) extends to assert `bridges/agents/frontmatter.ts::emitGeneratedAgentFile` output contains the verbatim `generated by pi-claude-marketplace` string.

### Schema + JIT validator at module load
**Source:** Phase 2 `persistence/state-io.ts` (lines 76-84) -- `Compile` from `typebox/compile`, exported at module top level.
**Apply to:** `persistence/agents-index-schema.ts` -- same pattern. JIT compile happens once at module import; per-row check is `.Check(value)` (no recompile cost).

### Staging-dir UUID pattern
**Source:** V1 `agent/stage.ts` (line 404) + node:crypto::randomUUID.
**Apply to:** All bridge prepare functions that need a private staging tmp -- skills, commands, agents (NOT mcp; MCP merges in memory). Same-FS guarantee: staging dirs MUST live under `<extensionRoot>/<bridge>-staging/<uuid>/` so the rename to `<scope>` paths (which share the FS) is atomic.
**Excerpt:**
```typescript
import { randomUUID } from "node:crypto";
const stagingDir = path.join(locations.agentsStagingDir, randomUUID());
await mkdir(stagingDir, { recursive: true });
```

**Note for planner:** Phase 2's `ScopedLocations` already exposes `agentsStagingDir`. For skills + commands, plan must add `skillsStagingDir` and `commandsStagingDir` (or accept them via input parameter -- TBD by planner).

---

## No Analog Found

Files where V1 has no precedent and Phase 2 dependencies don't fully cover:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `persistence/agents-index-schema.ts` | schema + validator | n/a | V1 had inline hand-rolled validation; Phase 3 D-07 hoists to dedicated module. Pattern from Phase 2 `state-io.ts` covers structurally. |
| `shared/errors-bridges.ts` | typed error subclasses | n/a | V1 used plain `Error`; Phase 3 D-06 + Phase 1 D-17 require typed subclasses. Pattern from Phase 2 `path-safety.ts::SymlinkRefusedError` covers structurally. |
| `tests/bridges/types.test.ts` | type-level proof | n/a | New `@ts-expect-error` block asserts D-01 corollary (cross-bridge handles not interchangeable). No V1 or Phase 2 analog. |
| `tests/fixtures/plugins/**` | static fixtures | n/a | Phase 2 has small fixtures; Phase 3 needs full plugin trees with explicit edge cases (foreign agents, empty mcp, empty agents). Build from scratch. |

## Open Questions for Planner

(From research conclusion -- preserve here so planner sees them.)

1. **Bridge file granularity within a directory.** CONTEXT.md mentions `bridges/skills/{stage,unstage,index}.ts`. V1 has prepare/commit/abort/unstage. Should Phase 3 split prepare/commit/abort across multiple files or co-locate in one `stage.ts`? Pattern map assumes co-located in `stage.ts` (matches V1 mental model); planner should confirm.
2. **`bridges/mcp/merge.ts` vs `marker.ts`.** CONTEXT.md mentions `merge.ts`; V1 has `marker.ts`. Recommend `marker.ts` (V1 carry, marker-shape utilities) and inline merge logic in `stage.ts`; planner to decide.
3. **`agents-index.json` field name `entries` vs `agents`.** Phase 2 vocabulary suggests `entries`; V1 used `agents`. This is a breaking change either way relative to V1 (the schema name is new in successor). Recommend `entries`.
4. **`locations.agentsIndexPath` and `locations.skillsStagingDir` / `commandsStagingDir`.** Phase 2's `ScopedLocations` brand has `agentsStagingDir` but not the other three. Plan must extend `persistence/locations.ts` (or pass the paths via input -- BUT D-09 + Phase 2 D-09 say all name-derived paths route through `ScopedLocations`).
5. **`shared/fs-utils.ts::cleanupStaging`.** V1 has it in `fs-utils.ts`; Phase 2 has no equivalent in `shared/`. Plan must port (recommended) or inline per bridge.
6. **`barrel index.ts` per bridge.** Already in CONTEXT.md but pattern map confirms shape (re-export public surface; do not re-export `_`-prefixed internal fields of Prepared<bridge>).

## Metadata

**Analog search scope:**
- V1 source under `git show features/initial:extensions/claude-marketplace/{agent,mcp,resource}/` (8 files, 2089 lines)
- Phase 2 outputs under `extensions/claude-marketplace/{shared,domain,persistence}/` (verified currently shipped)
- Existing tests under `tests/{persistence,domain,architecture,shared}/` (test-pattern templates)

**Files scanned:**
- V1: `agent/stage.ts`, `agent/convert.ts`, `agent/frontmatter.ts`, `mcp/stage.ts`, `mcp/parse.ts`, `mcp/marker.ts`, `mcp/effective-config.ts`, `resource/stage.ts`
- Phase 2: `shared/atomic-json.ts`, `shared/path-safety.ts`, `shared/errors.ts`, `shared/markers.ts`, `shared/notify.ts`, `domain/name.ts`, `domain/resolver.ts`, `domain/components/mcp.ts`, `persistence/locations.ts`, `persistence/state-io.ts`, `persistence/migrate.ts`
- Tests: `tests/persistence/state-io.test.ts`, `tests/domain/name.test.ts`, `tests/architecture/import-boundaries.test.ts`

**Pattern extraction date:** 2026-05-10
