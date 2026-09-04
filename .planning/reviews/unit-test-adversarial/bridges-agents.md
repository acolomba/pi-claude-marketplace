# Bridges — agents

**Scope:** `extensions/pi-claude-marketplace/bridges/agents/**` and `tests/bridges/agents/**`
**Test files reviewed:** 9
**Production modules reviewed:** 9

## Summary

Pairing is complete in both directions (9 production modules, 9 matching test files) and the overall quality is the highest seen in this sweep: real-filesystem tests with fresh `mkdtemp` per case and `t.after` cleanup, complete-value `deepStrictEqual`/exact-byte `strictEqual` assertions almost everywhere, structured error assertions (`instanceof` + full field comparison, never message-substring matching), no committed `only`/`skip`, no nested `describe`, and the two required special-case files (`index.test.ts` as a same-binding barrel test, `types.test.ts` as a pure `satisfies`/`@ts-expect-error` type test) are both textbook. The two things a fixing pass should attack first: (1) `stage.test.ts` has two genuine branch-coverage gaps in business-critical behavior — the AS-9 noop short-circuit's complementary case, and the force-replace-over-foreign-content success (finalize) path — where a plausible wrong implementation would leak or destroy user data undetected; (2) `stage.test.ts` also carries ~30x duplicated boilerplate for a `resolved` fixture field that the production code never even reads, which is worth extracting to a local factory. Everything else is minor polish (one inconsistent partial assertion in `convert.test.ts`, one uncommented clever mid-iteration failure injection, two small production-code readability/design notes).

## Unit test findings

### `tests/bridges/agents/stage.test.ts`

- **[BLOCKER] Missing case: AS-9 noop short-circuit's complement is never exercised** — `describe("prepareStagePluginAgents")` (lines 48-670) and `describe("commitPreparedAgents")` (lines 672-1259). `prepareStagePluginAgents`'s noop guard is `if (converted.length === 0 && previousEntries.length === 0)` (`stage.ts:189`). Every existing test that reaches this branch has BOTH sides empty (no agents component, or an empty agents directory with no prior install) — see "returns a frozen no-op result..." (line 49) and "keeps an empty agents directory as a no-op..." (line 92). No test covers the case where a plugin's agent(s) were removed from source (or `agentsSourceDir` becomes empty/null) while an agents-index entry from a prior install of that exact (marketplace, plugin) still exists. In that case the function MUST take the `"staged"` path (with empty `_newEntries`/`stagedNames` but non-empty `_previousEntries`) so that `commitPreparedAgents` removes the stale target file and drops it from the index. A wrong implementation that short-circuits on `converted.length === 0` alone (dropping the `&& previousEntries.length === 0` clause) would pass every current test in this file while permanently leaking every previously-installed agent whenever a plugin drops its last agent. Add a case: seed `agents-index.json` with one entry owned by (marketplace, plugin), call `prepareStagePluginAgents` with `agentsSourceDir: null` (or an emptied directory), assert `prepared.kind === "staged"` with `result.stagedNames === []` and `_previousEntries.length === 1`, then `commitPreparedAgents(prepared)` and assert the old target file no longer exists and the persisted index no longer lists it.

- **[BLOCKER] Missing case: `finalizeAgentsReplacement` after a force-replace over foreign content** — `describe("finalizeAgentsReplacement")` (lines 2172-2375), compare with "force replaces foreign previous content and rollback restores it exactly" (lines 1461-1552). That test calls `replacePreparedAgents(prepared, { force: true })` over a foreign-marked previous target and then exercises only `rollbackAgentsReplacement`, confirming the foreign file and index are restored. No test calls `finalizeAgentsReplacement` on that same kind of replacement to verify the SUCCESS path: that the backup holding the displaced foreign file is permanently removed and the persisted index permanently excludes the foreign row. A `finalizeAgentsReplacement` that fails to clean up the backup directory in this specific shape (silently leaving the foreign file recoverable/leaked on disk forever), or one that behaves differently when the replacement was a forced foreign override, would go completely undetected. Add a case that mirrors lines 1461-1552 through `replacePreparedAgents(prepared, { force: true })`, then calls `finalizeAgentsReplacement(replacement)` instead of rollback, and asserts the backup directory is gone, the foreign file is gone, and the index/agents-dir contents are the final (non-foreign) state.

- **[WARNING] ~31x duplicated `resolved` fixture the production code never reads** — e.g. lines 55-66, 98-109, 204-215, 369-380, 479-490, 565-576, 629-640, 742-753, 1349-1360, 2009-2020 (31 occurrences total). Every test builds an ~11-19 line `resolved: {...} satisfies ResolvedPluginInstallable` literal, identical apart from `supported`/`componentPaths.agents`. `prepareStagePluginAgents` never reads `resolved` at all — confirmed by `stage.ts`'s destructuring of `input` (`resolved` is absent) and by grep across the file. This is pure boilerplate that buries each case's actual arrange step under a wall of irrelevant fixture. Extract a local factory in this file, e.g. `function buildResolved(agentsDirs: readonly string[] = []): ResolvedPluginInstallable { return { ...fixed fields..., supported: agentsDirs.length > 0 ? ["agents"] : [], componentPaths: { skills: [], commands: [], agents: agentsDirs } }; }`, and call it with the one field that actually varies per case.

- **[WARNING] Uncommented failure-injection technique** — `test("surfaces a rollback leak when staging vanishes during commit", ...)`, lines 1217-1225. `Object.defineProperty(stagedFilePaths, 1, { get() { rmSync(...); return zuluPair; } })` is a legitimate but non-obvious way to make the staging directory vanish between the first and second iteration of the rename loop. Per the AAA convention, setup that is not obvious should carry a comment; this arrangement has none. Add a one-line comment above the `Object.defineProperty` call, e.g. `// Deleting the staging dir from inside the array getter simulates it vanishing between the alpha and zulu renames.`

### `tests/bridges/agents/convert.test.ts`

- **[WARNING] Inconsistent partial assertion breaks the file's own full-byte-comparison standard** — `test("ignores unmapped disallowed tools while retaining mapped and dropped source tools", ...)`, lines 398-438. This case asserts only `assert.match(agent.fileContent, /^tools: read$/m)` plus a 3-of-7-field `deepStrictEqual` subset (`droppedFields`, `droppedTools`, `warnings`), while every other `convertAgent` case in this file (e.g. lines 66-153, 616-666, 668-710, 712-756) compares the complete `fileContent` string with `assert.strictEqual`. The regex-plus-partial-fields pattern here leaves the rest of the generated file (description line, provenance field order, model/thinking lines) unverified, so a regression elsewhere in the same conversion would not be caught by this case. Rewrite to build the complete expected `fileContent` literal and compare with `assert.strictEqual`, matching every sibling case in this `describe` block.

### Clean files

- `tests/bridges/agents/index.test.ts`
- `tests/bridges/agents/types.test.ts`
- `tests/bridges/agents/marker.test.ts`
- `tests/bridges/agents/discover.test.ts`
- `tests/bridges/agents/index-mutation.test.ts`
- `tests/bridges/agents/frontmatter.test.ts`
- `tests/bridges/agents/unstage.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/bridges/agents/stage.ts`

- **[WARNING] Inline `randomUUID()` is a hidden, uninjected dependency** — `stage.ts:223` (`prepareStagePluginAgents`'s staging dir) and `stage.ts:458` (`replacePreparedAgents`'s backup root). Both call `randomUUID()` from `node:crypto` directly rather than taking it as an explicit dependency. This is exactly the "inline `randomUUID()`" pattern flagged as a testability design smell: it works today only because every test discovers the resulting path via the function's own return value (`prepared.stagingDir`, or by listing `agentsStagingDir`) rather than predicting it — nothing currently depends on determinism here. If a future test ever needs a deterministic ID (e.g. to assert an exact staging path, or to force a collision), thread it as an explicit `idGenerator?: () => string` field on `StageAgentsInput`, defaulting to `randomUUID` at the orchestrator composition root — the same explicit-parameter fix already applied to `cwd`/`projectDir` in this same input type.

- **[WARNING] `StageAgentsInput.resolved` is accepted but never consumed** — `stage.ts:97-110` (`prepareStagePluginAgents`'s destructuring of `input` omits `resolved`), confirmed by grep: `resolved` does not appear anywhere else in `stage.ts`. Every production call site (`orchestrators/plugin/install.ts`, `update.ts`, `reinstall.ts`) and every test in `stage.test.ts` must still construct a full `ResolvedPluginInstallable` value to satisfy `StageAgentsInput`, purely to satisfy the type. Either wire it into an actual use, or add a one-line comment at the field's declaration in `types.ts:72` explaining why the agents bridge accepts-but-ignores it (e.g. "kept for input-shape symmetry with the skills/commands bridges' stage inputs"), so a future reader does not have to grep to discover it is dead wiring.

### `extensions/pi-claude-marketplace/bridges/agents/convert.ts`

- **[WARNING] AG-11/AG-12 throw bare `Error` while the sibling AG-9 conflict gets a typed class** — `convert.ts:500-505` (`convertAgent`'s empty-mapped-tools throw) and `convert.ts:624-627` (`assertNoAgentCollisions`). Both throw `new Error(...)` with the structured detail (source tool lists / collision groups) baked only into the message string, while the sibling AG-9 cross-owner conflict in this same bridge (`stage.ts` via `AgentOwnershipConflictError`) gets a dedicated class with readonly structured fields, matching the project's documented Error Handling convention (typed error classes, one per failure mode, structured fields rather than message-only). No current caller needs to branch on this programmatically, so this is low priority, but flagging for consistency with the convention already applied one file over.

- **[WARNING] IIFE-in-ternary is harder to read than a plain `if`/`else`** — `convert.ts:256-264`:
  ```ts
  const tokens =
    rawTools === undefined
      ? ((): string[] => {
          warnings.push(...);
          return ["Read", "Bash", "Edit"];
        })()
      : splitCsv(rawTools);
  ```
  An immediately-invoked arrow function is used solely to combine a side effect (pushing a warning) with a value in one ternary arm. Simplify to a `let tokens: string[];` followed by a plain `if (rawTools === undefined) { warnings.push(...); tokens = [...]; } else { tokens = splitCsv(rawTools); }` — same behavior, no IIFE.

### Clean files

- `extensions/pi-claude-marketplace/bridges/agents/types.ts`
- `extensions/pi-claude-marketplace/bridges/agents/marker.ts`
- `extensions/pi-claude-marketplace/bridges/agents/index.ts`
- `extensions/pi-claude-marketplace/bridges/agents/discover.ts`
- `extensions/pi-claude-marketplace/bridges/agents/index-mutation.ts`
- `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`
- `extensions/pi-claude-marketplace/bridges/agents/unstage.ts`
