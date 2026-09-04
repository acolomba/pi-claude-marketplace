# Bridges — agents — adversarial re-review

**Scope:** all 9 production modules under `extensions/pi-claude-marketplace/bridges/agents/` and all 9 test modules under `tests/bridges/agents/`, read in full (8,054 lines), plus the two out-of-area modules the area's contract actually depends on (`orchestrators/plugin/shared.ts::pickAgentsSourceDir`, `shared/fs-utils.ts::cleanupStaging`/`rollbackReplacementCommon`) and `domain/name.ts::assertSafeName`/`generatedAgentName`.
**First-pass file:** `unit-test-findings/bridges-agents.md`
**Clean files attacked:** 14 (7 test modules + 7 production modules)
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 14 |
| Existing CONFIRMED | 6 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 2 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area was directionally right about quality and
wrong about where the holes are. Both of its BLOCKERs rest on mechanisms the
source refutes; meanwhile three single-token argument mutations survive all 2,375
lines of `stage.test.ts`, and the area's one genuine production defect sits at a
seam the partition hid.

## New findings — from the clean lists

### `tests/bridges/agents/stage.test.ts` (not on the clean list, but these are new)

- **[BLOCKER] The `mapModel ?? false` default is never proven — the AG-7 opt-in can be inverted undetected** — `stage.ts:148`, cases at `stage.test.ts:228`, `:400`, `:795`
  `mapModel` appears in exactly three cases and is `true` in all three (grep-verified: lines 228, 400, 795). Every case that *omits* `mapModel` uses a source agent with no `model:` frontmatter field, so the defaulted value is never observable. Mutating `stage.ts:148` from `mapModel: mapModel ?? false` to `mapModel ?? true` leaves the whole file green, while inverting the documented AG-7 contract (`types.ts:77-85`: "When false (the default), the generated frontmatter omits `model:` entirely") for every cascade-driven install. Add one case: source agent with `model: sonnet`, call `prepareStagePluginAgents` **without** `mapModel`, and `assert.strictEqual` the staged bytes against an expected literal that contains no `model:` line and whose provenance block has no `originalModel:` line.

- **[BLOCKER] `knownSkills` and `pluginDataDir` reach `convertAgent` unproven — 2 argument-threading mutations survive** — `stage.ts:145` and `stage.ts:144`
  `prepareStagePluginAgents`'s only job for these two fields is to thread them into `convertAgent`, and no case discriminates either:

  | Field | Threaded at | Why every case survives the mutation |
  | --- | --- | --- |
  | `knownSkills` | `stage.ts:145` | Passed as `["acme-helper"]` at `:227` and `:794`, `[]` at `:121`. No source-agent fixture in the file carries a `skills:` frontmatter line and no body contains an `acme:<skill>` token, so `mapSkills`/`detectSkillTokens` return empty for every input. Mutating to `knownSkills: []` deletes `skills:`, `skillPath:` and the whole skill legend from every generated agent and leaves the file green. |
  | `pluginDataDir` | `stage.ts:144` | `${CLAUDE_PLUGIN_DATA}` appears in **zero** fixture bodies (grep-verified). Mutating to `pluginDataDir: pluginRoot` — a plausible copy-paste — leaves the file green while every real agent body's `${CLAUDE_PLUGIN_DATA}` resolves to the wrong directory. |

  One fix covers both: extend the `agents-stage-family` case (`:135`) so `acme-helper.md` carries `skills: helper` and `bot.md`'s body reads `Read from ${CLAUDE_PLUGIN_ROOT}/data, ${CLAUDE_PLUGIN_DATA}/cache and ${CLAUDE_PROJECT_DIR}.`, pass `knownSkills: ["acme-helper"]`, and update the two expected byte blocks (`:162`, `:181`) to contain the `skills: acme-helper` + `skillPath: ../pi-claude-marketplace/resources/skills` pair and the substituted `pluginDataDir`. The commit-side twin at `:673` mirrors the same fixtures.

- **[WARNING] The expected value at `:2228` is computed from the actual result — the sibling three cases later does it right** — `stage.test.ts:2228-2234`
  ```ts
  assert.deepStrictEqual(
    (await readdir(locations.agentsStagingDir)).sort(),
    [path.basename(prepared.stagingDir),
     (await readdir(locations.agentsStagingDir)).find((n) => n.startsWith("backup-"))].sort(),
  );
  ```
  The second element of the *expected* array is read out of the directory being asserted. It is not fully vacuous, but it violates "expected values are built independently" and it is an un-phased assertion sitting inside `// arrange`. `tests/bridges/agents/stage.test.ts:2300-2303` already does this correctly (`readdir` once into `stagingEntries`, `find` the backup name, `assert.ok(backupName !== undefined)`). Rewrite `:2228` in that shape and compare `stagingEntries.sort()` against `[path.basename(prepared.stagingDir), backupName].sort()`.

- **[WARNING] No rollback case proves the replacement backup root is cleaned; the finalize case does** — `stage.test.ts:1461`, `:1554`, `:1652`, `:1717`, `:2069`
  All five rollback cases assert `exists(prepared.stagingDir) === false` and stop there. `rollbackReplacementCommon` (`shared/fs-utils.ts:219-226`) cleans **two** roots — staging and backup — and deleting the `cleanupStaging(input.backupRoot, …)` line leaves every agents case green. The finalize case at `:2246` already asserts the stronger form (`readdir(locations.agentsStagingDir)` is `[]`). Add that same line to the five rollback cases. The production line is owned by `tests/shared/fs-utils.test.ts`, but the agents cases are where a leaked `backup-<uuid>` directory would actually be observed.

- **[WARNING] Three cases require a non-root uid with no guard; the repo already has the guard** — `stage.test.ts:2304` (chmod 0o500), `unstage.test.ts:431` (chmod 0o555), `discover.test.ts:110` (chmod 0o000)
  Each expects an `EACCES` that never fires for uid 0, so under a root container all three fail against the bridge logic instead of naming the environment. `tests/orchestrators/reconcile/apply.test.ts:200-206` is the in-repo reference: it refuses up front with `if (typeof process.getuid === "function" && process.getuid() === 0) { throw new Error("… run this suite as a non-root user"); }` and carries a comment saying why. Copy that guard to the three cases above (or to a local `denyWrites` helper in each file).

### `tests/bridges/agents/unstage.test.ts`

- **[WARNING] The success-path `warnings` array never carries a corruption — one of two return arms is unproven** — `unstage.ts:117-121`, cases at `:21`, `:158`, `:275`, `:338`
  `unstagePluginAgents` returns `loaded.corruptions` from **both** the early-return arm (`unstage.ts:59-63`) and the final arm (`:117-121`). Only the early-return arm is covered: the corruption case at `:473` has no matching row, so it short-circuits. Mutating the final arm to `warnings: Object.freeze([])` leaves every case green while silently swallowing the AG-4 soft-fail warning for any user whose index has a bad row *and* a plugin to remove. Extend the case at `:21` ("removes owned current and legacy agents…") by adding one schema-invalid row (drop `targetPath`, as `:492-502` does) to `storedIndex`, and add the corresponding validation message to its expected `warnings`.
  **The same shape exists one module over**: `stage.ts:189-199`'s noop arm also returns `aggregatedWarnings`, and both noop cases (`stage.test.ts:49`, `:92`) have empty warnings — mutating that arm to `Object.freeze([])` also survives. Reachable: a corrupt index row belonging to another plugin plus `agentsSourceDir: null`. Fix both arms together.

- **[WARNING] No `Object.isFrozen` assertion, unlike all three siblings** — `unstage.ts:117-121`
  `unstagePluginAgents` freezes `removedNames`, `failed` and `warnings`; no case checks it. `discover.test.ts:61-62`, `index-mutation.test.ts:193-194` and `stage.test.ts:85-88` all assert `Object.isFrozen(...) === true` on their frozen returns. Add the three assertions to the case at `:21`.

### `tests/bridges/agents/discover.test.ts`

- **[WARNING] `discover.ts:89`'s labelled `assertSafeName` is never exercised, and the case that looks like it covers it belongs to `domain/name.ts`** — `discover.test.ts:246-257`
  The case "rejects a source name that elides to an empty generated suffix" asserts `{ name: "Error", message: "Name must be a non-empty string." }` — the **unlabelled** prefix, which `assertSafeName` only emits when `label` is omitted (`domain/name.ts:26`). That throw comes from `generatedAgentName`'s internal `assertSafeName(elided)` (`name.ts:147`), not from `discover.ts:89`, which passes `` `agent name in ${sourcePath}` ``. Deleting line 89 outright leaves every case green (`generatedAgentName` re-validates `source` at `name.ts:144`), so the only thing the guard contributes — the source-path context in the message — is unasserted. Add a case with `---\nname: ../escape\n---\n` and assert `` `agent name in ${sourcePath} "../escape" must not contain path separators.` ``. Ownership note: the message currently asserted is `tests/domain/name.test.ts`'s to own.

- **[WARNING] The documented raw-bytes hashing contract is not discriminated by any fixture** — `discover.ts:82-84`, case at `:9`
  The module header and `types.ts:41` both promise the digest is taken over **raw bytes**, not decoded text. Every fixture is valid UTF-8, and for valid UTF-8 the two are byte-identical — verified: the pinned digest `908a44e1…` for the BOM fixture at `discover.test.ts:21` is the same whether you hash `bytes` or `bytes.toString("utf8")`. Mutating `.update(bytes)` to `.update(text)` survives the whole file. Add one fixture containing a lone `0xff` byte (`Buffer.from([0x2d,0x2d,0x2d,0x0a,0xff,0x0a])`) with its independently computed digest; the two hashes differ there.

### `tests/bridges/agents/types.test.ts`

- **[WARNING] `undefined!` makes five field-type checks accept any type** — `types.test.ts:57`, `:62`, `:106`, `:145`, `:206`
  `undefined!` has type `never`, which is assignable to everything, so `locations: undefined!` and `resolved: undefined!` prove nothing about the declared field types. Mutating `StageAgentsInput.locations` from `ScopedLocations` to `string` (or deleting the `ScopedLocations` brand entirely) leaves this type-only module compiling clean — which matters because META-FINDINGS already records that the `ScopedLocations` brand is never proven anywhere. Replace the `locations` sites with a real `locationsFor("user", "/scope")` value (imported from `persistence/locations.ts`) and the `resolved` sites with a minimal `satisfies MaterializablePlugin` literal, and add one `// @ts-expect-error` proving a hand-built object literal is **not** assignable to `locations`.

### `tests/bridges/agents/frontmatter.test.ts`

- **[WARNING] `Object.prototype` surgery to reach a compiler-forced branch — a fifth instance of the class META-FINDINGS escalated** — `frontmatter.test.ts:278-310`
  The case installs a setter on `Object.prototype.interceptedAgentField` so that `raw[key] = value` is swallowed and `applyFrontmatterLine`'s `raw[state.lastKey] ?? ""` (`frontmatter.ts:149`) sees `undefined`. Tracing the real inputs: `state.lastKey` is only set immediately after `raw[key] = value` (`:167-168`), so the `?? ""` arm is unreachable by any file content — it exists solely because `noUncheckedIndexedAccess` types `raw[key]` as `string | undefined` (category D-116-01a). Unlike the four files META-FINDINGS lists, this one has a clean production fix that removes the dilemma: carry the folded value in `FoldState` (`interface FoldState { lastKey: string | null; foldedValue: string; lastKeyFoldable: boolean }`), append to `state.foldedValue` in the dash branch and write it through to `raw`, and the index read — with its coalesce — disappears. Then delete this case.

### `tests/bridges/agents/marker.test.ts`

- **[WARNING] No `describe()` grouping, unlike every multi-export sibling in the area** — whole file
  `marker.ts` has four exported entrypoints (three constants + `isOwnedAgentFile`) and `marker.test.ts` uses 11 bare top-level `test()` calls. `convert.test.ts`, `frontmatter.test.ts`, `index-mutation.test.ts`, `index.test.ts` and `stage.test.ts` all group one `describe()` per exported entrypoint, which is what the rule asks for when a module has several. Wrap the three constant cases and the eight `isOwnedAgentFile` cases in four one-level `describe()` blocks named for their exports.

### `tests/bridges/agents/index-mutation.test.ts`

- **[WARNING] The exported `PartitionedIndex` type has no owning case — the test re-declares its shape inline** — `index-mutation.test.ts:171-174`
  `expectedPartition` ends with `satisfies { previous: readonly AgentsIndexEntry[]; other: readonly AgentsIndexEntry[] }`, an inline restatement of the production type. Change it to `satisfies PartitionedIndex` (importing the type) so a mutation to the exported interface — e.g. widening `previous` to `AgentsIndexEntry[]` and losing the readonly contract — becomes a compile error here.

### `tests/bridges/agents/convert.test.ts` (not on the clean list; these are new)

- **[WARNING] A mutating accessor plants an otherwise-unreachable message branch — a sixth instance of the same class** — `convert.test.ts:498-538`
  The `get tools()` fixture returns `"WebFetch"` on the first read and `undefined` on later reads, purely to reach `convert.ts:503`'s `raw.tools ?? "(default read,bash,edit)"`. That arm is unreachable by real input: when `raw.tools` is genuinely `undefined`, `mapTools` substitutes `["Read","Bash","Edit"]`, three tools map, and the AG-11 throw never fires. Production fix that makes the branch reachable through public behavior: have `mapTools` return the label it used (`sourceLabel: rawTools ?? "(default read,bash,edit)"`) alongside `mapped`/`dropped`, and have `convertAgent` interpolate `toolsResult.sourceLabel`. The omitted-tools case at `:758` then covers the default arm honestly, and this case can be deleted.

- **[WARNING] The AGSK-02 qualifier-spacing tolerance is entirely untested** — `convert.ts:383-384`
  The comment promises that `spec-tree: review-changes` and `spec-tree :review-changes` "resolve like the tight form instead of silently dropping the preload the user obviously intended", implemented by the two `.trim()` calls. Every `skills:` fixture in the file uses the tight form (`:137`, `:562`, `:656`), so deleting both `.trim()` calls leaves the file green. Add two data rows to a loop asserting `skills: spec-tree-review-changes` in the emitted bytes and `warnings: []` for both spaced spellings.

### `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts`

- **[WARNING] The `GENERATED_AGENT_MARKER` re-export has no production consumer and no owning case, and its comment claims otherwise** — `frontmatter.ts:33-35`
  The comment reads "Re-export so consumers can import from one module rather than knowing which agents/\* file owns the constant." Grep across `extensions/` and `tests/`: nothing in production imports it from here, `frontmatter.test.ts` never touches it, and the sole importer is `tests/integration/provenance-invisibility.test.ts:36-37` — out of the unit-suite glob. Every other consumer (`tests/architecture/markers-snapshot.test.ts`, `tests/orchestrators/plugin/{install,uninstall}.test.ts`, `tests/orchestrators/marketplace/shared.test.ts`) imports from `marker.ts` or the bridge barrel. Delete the re-export and repoint the integration test at `marker.ts`, or, if it is kept, add a same-binding `assert.strictEqual` case to `frontmatter.test.ts` matching `index.test.ts`'s barrel pattern.

### `extensions/pi-claude-marketplace/bridges/agents/discover.ts` + `orchestrators/plugin/shared.ts`

- **[WARNING] The agents bridge is multi-directory by design and single-directory in production; two `discover.test.ts` cases exercise a path production cannot reach** — `discover.ts:14-19` (D-07 header), `orchestrators/plugin/shared.ts:943-950`
  `discoverPluginAgents` takes `agentsDirs: readonly string[]` and implements cross-directory first-wins dedup with a warning, "for symmetry with the skills/commands bridges". Production never hands it more than one entry: `pickAgentsSourceDir` returns `componentPaths.agents[0]` and discards the rest, and it is the only feed for both call sites (`bridges/agents/stage.ts:128`, `orchestrators/plugin/discover-names.ts:58`). The sibling bridges do iterate the whole array (`bridges/skills/discover.ts:147`, `bridges/commands/discover.ts:360`). `componentPaths.agents` genuinely can hold several entries — `domain/resolver.ts:1043-1052` appends every manifest/entry-declared path **and** the conventional `<pluginRoot>/agents` directory — so a plugin declaring `"agents": ["custom-agents"]` alongside a conventional `agents/` directory installs only the first, with no note. The behavior is pinned as intentional by `tests/orchestrators/plugin/shared.test.ts:1368-1388` (two cases pass `["…","other"]` and assert only the first survives), so this is an **operator decision**, not an unambiguous bug: either thread `resolved.componentPaths.agents` through `StageAgentsInput` (which also resolves the first pass's "`resolved` is accepted but never consumed" finding by *using* it) and keep `discover.test.ts:173`/`:213`, or accept single-dir, delete the array parameter and those two cases, and correct the D-07 header comment. Do not leave the current split, where the bridge advertises a contract the orchestrator cannot deliver.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `index.ts` | 10 runtime re-exports | `index.test.ts:78-206`, one `describe` each | owned (complete) |
| `index.ts` | `AgentsReplacement`, `PreparedAgentsStaging` (types) | `index.test.ts:47-76` `Same<>` + `@ts-expect-error` | owned |
| `types.ts` | 16 type exports | `types.test.ts` (all 16 imported and `satisfies`-checked) | owned; 5 field checks defeated by `undefined!` |
| `marker.ts` | `GENERATED_AGENT_PREFIX` / `_MARKER` / `_MARKER_LEGACY` | `marker.test.ts:14`, `:25`, `:36` | owned |
| `marker.ts` | `isOwnedAgentFile` | `marker.test.ts:47-262` (8 cases) | owned |
| `marker.ts` | `SafetyResult` (type) | — | no case (consumed by `unstage.ts:22`) |
| `discover.ts` | `discoverPluginAgents` | `discover.test.ts:9-257` | owned |
| `discover.ts` | `DiscoverPluginAgentsResult` (type) | — | no case |
| `index-mutation.ts` | `partitionByOwner` | `index-mutation.test.ts:12`, `:183` | owned |
| `index-mutation.ts` | `findOwnershipConflicts` | `index-mutation.test.ts:199`, `:299`, `:325`, `:397` | owned |
| `index-mutation.ts` | `PartitionedIndex` (type) | — | NO CASE — shape re-declared inline at `:171` |
| `frontmatter.ts` | `emitYamlScalar` | `frontmatter.test.ts:11-61` (7 rows) | owned |
| `frontmatter.ts` | `sanitizeProvenanceValue` | `frontmatter.test.ts:63-93` (3 rows) | owned |
| `frontmatter.ts` | `parseFrontmatter` | `frontmatter.test.ts:95-311` | owned |
| `frontmatter.ts` | `emitGeneratedAgentFile` | `frontmatter.test.ts:313-479` (3 whole-byte cases) | owned |
| `frontmatter.ts` | `GENERATED_AGENT_MARKER` (re-export) | — | NO CASE — only importer is an integration test |
| `frontmatter.ts` | `ParsedFrontmatter`, `GeneratedFrontmatterFields`, `SkillLegendEntry`, `GeneratedProvenanceFields` | — | no case (checked structurally through the function params only) |
| `convert.ts` | `MODEL_MAP`, `TOOL_MAP`, `THINKING_VALUES` | `convert.test.ts:12`, `:30`, `:52` | owned (whole-map compares) |
| `convert.ts` | `convertAgent` | `convert.test.ts:65-937` | owned |
| `convert.ts` | `assertNoAgentCollisions` | `convert.test.ts:939-975` | owned |
| `stage.ts` | `prepareStagePluginAgents` | `stage.test.ts:48-670` | owned; 3 input fields unproven (see BLOCKERs) |
| `stage.ts` | `commitPreparedAgents` | `stage.test.ts:672-1259` | owned |
| `stage.ts` | `abortPreparedAgents` | `stage.test.ts:1261-1340` | owned |
| `stage.ts` | `replacePreparedAgents` | `stage.test.ts:1342-2066` | owned |
| `stage.ts` | `rollbackAgentsReplacement` | `stage.test.ts:2068-2170` | owned |
| `stage.ts` | `finalizeAgentsReplacement` | `stage.test.ts:2172-2375` | owned |
| `unstage.ts` | `unstagePluginAgents` | `unstage.test.ts:21-526` | owned |

Pairing is complete in both directions (9 ↔ 9); the first pass was right about that.

## Branch census

**Reachable and untested (findings above unless noted):**
- `unstage.ts:117-121` final-arm `loaded.corruptions` — reachable, untested.
- `stage.ts:189-199` noop-arm `aggregatedWarnings` — reachable (corrupt row for another plugin + `agentsSourceDir: null`), untested.
- `stage.ts:148` `mapModel ?? false`, `:145` `knownSkills ?? []`, `:144` `pluginDataDir` — reachable, untested.
- `discover.ts:89` `assertSafeName(sourceName, "agent name in …")` failing arm — reachable, untested.
- `convert.ts:108` `.filter((part) => part !== "")` in `splitCsv` — reachable (`tools: "Read,,Bash"`, or a trailing comma), untested; no fixture in the repo has an empty CSV item. Low impact (an empty token would otherwise land in `droppedTools`).
- `convert.ts:383-384` qualifier/remainder `.trim()` — reachable, untested (finding above).
- `stage.ts:470` `assertSafeName(entry.generatedName, "previous agent name")` — reachable from a hand-edited `agents-index.json`, untested. Containment does not depend on it (`:477`'s `assertPathInside(backupRoot, backup)` and `:471`'s `assertPathInside(agentsDir, targetPath)` both hold), so deleting it changes only the message. Defense-in-depth.
- `stage.ts:494` `removeOrphanIfPresent(pair.to, "file")` in the TR-06 owned-basename arm — reachable only when the index row's `targetPath` differs from the new target path and an orphan occupies the latter. Every case reaches this line with `pair.to` already absent, so the removal never fires. On POSIX `rename` overwrites a file anyway, so the arm only matters when the orphan is a directory.

**Unreachable by real input (defensive, not findings):**
- `stage.ts:225`, `:233`, `:235` `assertPathInside` failure arms — `stagingDir` is `join(agentsStagingDir, randomUUID())` and target basenames are `assertSafeName`-checked generated names, so no real input escapes. (The `:233` call *is* executed and throws `ENAMETOOLONG` from its own `lstat` in the case at `stage.test.ts:618`; that is the syscall failing, not the containment arm.) The one reachable sibling — `:471`, fed by index JSON — is properly covered at `stage.test.ts:1850`.

**Compiler-forced, not removable as written (D-116-01a):**
- `frontmatter.ts:149` `raw[state.lastKey] ?? ""` — forced by `noUncheckedIndexedAccess`; covered today only by `Object.prototype` surgery. A `FoldState.foldedValue` refactor removes it (see finding).
- `convert.ts:152` `candidate === undefined` in `detectSkillTokens` — the regex always fills group 1; forced by `noUncheckedIndexedAccess`. Currently covered incidentally (the `seen.has(token)` half of the same condition is exercised at `convert.test.ts:579`), so no case is lying about it.
- `convert.ts:503` `raw.tools ?? "(default read,bash,edit)"` — unreachable after `mapTools` defaults; covered only by the mutating-accessor fixture. Removable via the `sourceLabel` refactor (see finding).

## Grading of first-pass findings

### `tests/bridges/agents/stage.test.ts`

- **OVERSTATED** — *[BLOCKER] Missing case: AS-9 noop short-circuit's complement is never exercised*. The stated mechanism is wrong: `stage.test.ts:1383` ("rejects foreign previous content by default") writes **no** agent source file into `agentsSourceDir` while seeding one owned index row, so it reaches `stage.ts:189` with `converted.length === 0` and `previousEntries.length === 1`, and `assert.strictEqual(prepared.kind, "staged")` at `:1435` kills exactly the mutation the finding says survives (dropping the `&& previousEntries.length === 0` clause). What is genuinely missing is narrower: no **commit-path** case has empty `_newEntries` with non-empty `_previousEntries`, i.e. nothing proves end-to-end that a plugin dropping its last agent gets the stale target removed and its row dropped. Correct severity: WARNING. Correct fix: add the missing case to `describe("commitPreparedAgents")`, not to `prepareStagePluginAgents`.
- **OVERSTATED** — *[BLOCKER] Missing case: `finalizeAgentsReplacement` after a force-replace over foreign content*. `finalizeAgentsReplacement` (`stage.ts:552-565`) reads neither `force` nor `_foreignPreservedEntries`; it is two `cleanupStaging` calls, and `cleanupStaging` is a recursive `rm(..., {recursive:true, force:true})` (`shared/fs-utils.ts:42`), so the force/foreign shape shares an identical, branch-free code path with the covered case. The backup-directory cleanup contract is already pinned at `stage.test.ts:2228-2246` (both directories present in arrange, `readdir(agentsStagingDir)` empty after finalize), and the "index permanently excludes the foreign row" half is pinned at `:1527-1543`. There is no surviving mutation unique to this combination. Correct severity: WARNING at most (a combination not exercised), and the higher-value neighbour is the backup-root gap on the *rollback* side, filed above.
- **CONFIRMED** — *[WARNING] ~31× duplicated `resolved` fixture*. Exactly 31 (`grep -c "satisfies ResolvedPluginInstallable"`). See the UNDERSTATED grade on the paired production finding: deleting the field beats extracting a factory.
- **CONFIRMED** — *[WARNING] Uncommented failure-injection technique* (`:1217-1225`). Worth adding that the technique is not gratuitous: the staging directory must vanish *between* two iterations of a sequential in-function loop, and there is no external hook point, so the array-index getter is the only seam. That justification belongs in the comment the finding asks for.

### `tests/bridges/agents/convert.test.ts`

- **CONFIRMED** — *[WARNING] Inconsistent partial assertion* (`:398-438`). The regex-plus-3-of-8-fields shape is real and the sibling cases do compare whole `fileContent`. Scope note for the fixer: the same `assert.match`/`.find(line => line.startsWith(...))` technique also appears at `:275-282`, `:345-352` and `:609-612`. The two data-driven loops are defensible — they assert a projection plus all three provenance arrays, and whole-byte assembly is owned by `frontmatter.test.ts` — but `:609` builds its expectation by regex-escaping a multi-line block and should become a whole-`fileContent` `strictEqual` alongside `:398`.

### `extensions/pi-claude-marketplace/bridges/agents/stage.ts`

- **CONFIRMED** — *[WARNING] Inline `randomUUID()` is a hidden, uninjected dependency* (`:223`, `:458`). Correct by the letter of the rule. Two qualifiers for the fixer: nothing is currently blocked (every case discovers the path from the return value), and the identical pattern lives in `bridges/skills/stage.ts:192,399` and `bridges/commands/stage.ts:193,380` — fix all three bridges in one change or none, or the bridges drift.
- **UNDERSTATED** — *[WARNING] `StageAgentsInput.resolved` is accepted but never consumed*. Grep-confirmed: the token `resolved` appears **zero** times in `stage.ts` outside the type import. But the recommended fix (add a comment claiming "input-shape symmetry with the skills/commands bridges") is the wrong direction, because the siblings do not merely *accept* `resolved` — they **consume** it: `bridges/commands/stage.ts:166` destructures it and forwards it to discovery, and `bridges/skills/discover.ts:147` reads `input.resolved.componentPaths.skills`. The agents bridge is the only one that takes a pre-flattened `agentsSourceDir: string | null` instead, which is the same decision that discards every `componentPaths.agents` entry after the first (see the production finding above). Raise to: an unused field that is the visible symptom of a real behavioral asymmetry, and the resolution of the 31-fixture duplication — if `resolved` is used, the field earns its place; if single-dir is confirmed intended, delete `resolved` from `StageAgentsInput` and 31 twelve-line fixtures disappear from `stage.test.ts` with it.

### `extensions/pi-claude-marketplace/bridges/agents/convert.ts`

- **CONFIRMED** — *[WARNING] AG-11/AG-12 throw bare `Error`* (`:500-505`, `:624-627`). Accurate, and correctly rated low: `convert.test.ts:461` and `:968` assert with `assert.throws(fn, new Error(exact))`, which compares name + full message, so the current cases are not message-substring matching. A typed class would let them assert structured fields instead, which is the actual upgrade.
- **CONFIRMED** — *[WARNING] IIFE-in-ternary* (`:256-264`). Style, correctly WARNING.

## Still clean after attack

- `tests/bridges/agents/index.test.ts` — genuinely clean. All 10 runtime re-exports have a same-binding `assert.strictEqual` case, so re-pointing any barrel line at a different function fails; the `@ts-expect-error` block at `:73-76` additionally proves the barrel does **not** leak `PreparedAgentsStaged` or `GENERATED_AGENT_PREFIX`, killing the over-export mutation. Removing an export is a compile error. The only mutation it misses is *adding* a new unexpected export, which no sibling barrel test in `tests/bridges/*/index.test.ts` guards either — not drift.
- `tests/bridges/agents/marker.test.ts` — survived: inverting `&&`→`||` in the two-marker check (the legacy-only case at `:104` fails), returning `ok:true` for a marker-free file, replacing `path.basename(targetPath)` with the full path, reordering the basename check after the file read (the missing-file + foreign-basename case at `:62` fails), and any edit to either reason string (both compared with whole-object `deepStrictEqual`). The one-byte marker variants at `:156` and `:183` kill substring-loosening mutations.
- `tests/bridges/agents/index-mutation.test.ts` — survived: swapping `previous`/`other`, changing `&&` to `||` in the owner predicate (the same-marketplace and same-plugin decoys at `:28` and `:40` land in `other`), reordering either output array, dropping the `Object.freeze`, and changing `findOwnershipConflicts` to first-wins instead of last-wins (`:325` pins the `Map` semantics explicitly).
- `tests/bridges/agents/frontmatter.test.ts` `emitGeneratedAgentFile` — survived every rendering mutation I tried: dropping any one frontmatter line, reordering the deterministic field order, changing the `provenance` indentation from two to four spaces, rendering an empty list as a block instead of inline `[]`, dropping `skillPath` when `skills` is non-empty, flipping `inheritSkills`, and dropping the legend's leading newline. All three cases compare the complete file with `strictEqual`, which is the reference form META-FINDINGS names.
- `tests/bridges/agents/unstage.test.ts` — survived: reordering `[...nonMatching, ...preservedEntries]`, changing `schemaVersion`, dropping the ENOENT tolerance in the `rm` catch, treating a foreign target as removed, and rewriting the index on the no-match path (`:155` and `:525` compare exact stored bytes; `:210-223` compares `ino`/`size`/`mtimeNs`/`ctimeNs` to prove the replay writes nothing at all — a genuinely strong idempotence proof).
- `tests/bridges/agents/stage.test.ts` replacement lifecycle — survived: dropping `_foreignPreservedEntries` from `commitPreparedAgents`'s saved index (`:999`), including them in `replacePreparedAgents`'s saved index (`:1527`), skipping the backup rename, skipping the `oldIndexText` capture (`:1647`), returning `undefined` instead of `ManualRecoveryError` when rollback leaks (`:2040-2045`), and losing the `WeakMap` handle check (`:2120`, `:2325`).
- `tests/bridges/agents/discover.test.ts` ordering — reversing the `localeCompare` sort or replacing it with any non-alphabetical comparator fails the case at `:9`. Deleting the sort entirely is the one mutation that survives, since it leaves the order to `readdir` and the fixtures happen to be created alphabetically; that is a caveat, not a finding worth a fix.

## Not covered

- I did not run any test, coverage, or lint command (brief prohibits it). Every coverage and mutation claim above is from reading the source plus one throwaway `node -e` hash check outside the repo.
- I read `orchestrators/plugin/shared.ts::pickAgentsSourceDir`, `shared/fs-utils.ts` and `domain/name.ts` only as far as needed to settle claims about the agents bridge; their own tests are graded by other areas.
- `tests/integration/provenance-invisibility.test.ts` and `tests/integration/skill-path-resolution.test.ts` import from this area but are outside the sweep glob; I used them only to establish that the `frontmatter.ts` marker re-export has no unit-suite consumer.

## Meta-findings impact

### New cross-cutting evidence

1. **Argument-threading mutations are an unexamined defect class.** The two BLOCKERs here are not weak assertions or missing branches — they are *collaborator-call-with-one-argument-wrong* mutations at a bridge's prepare seam, surviving a 2,375-line test file that is otherwise excellent. The shape is generic: a `prepare*` function whose only job for field X is to pass it to a pure converter, tested exclusively with fixtures where X is inert (`knownSkills` with no `skills:` frontmatter, `pluginDataDir` with no `${CLAUDE_PLUGIN_DATA}` token, an optional flag never exercised at its default). **Check `tests/bridges/skills/stage.test.ts`, `tests/bridges/commands/stage.test.ts` and `tests/bridges/mcp/stage.test.ts` for the same three questions**: does any fixture make each threaded input observable, and is every `?? default` on the input object exercised at its default? This class is invisible to a reviewer reading either module alone.

2. **The "one return arm carries the warnings, the other's is unproven" shape.** `unstage.ts` and `stage.ts` in this area both return `loaded.corruptions` from two arms and only cover one. Every bridge that calls a `loadXIndex`-style loader with soft-fail corruption reporting is a candidate. **Check `bridges/skills/*`, `bridges/commands/*`, `bridges/mcp/*` and `persistence/*` consumers for load-time warning arrays returned from more than one arm.**

3. **Two more instances for the "unreachable branch propped up by runtime surgery" decision.** META-FINDINGS' Decision #1 names four files. Add `tests/bridges/agents/frontmatter.test.ts:278-310` (`Object.prototype` setter) and `tests/bridges/agents/convert.test.ts:498-538` (a mutating property accessor — a *new* variant of the technique, not prototype patching). Both differ from the four listed cases in one useful way: each has a clean production refactor that makes the branch either disappear (`FoldState.foldedValue`) or become genuinely reachable (`mapTools` returning `sourceLabel`). That gives the operator a third option beyond "delete the branch" / "keep the propping test": **restructure so the branch is reachable through public behavior**, which is what the guidelines actually ask for. Worth checking whether the four listed files admit the same third option.

4. **Root-uid fragility has an in-repo fix nobody propagated.** `tests/orchestrators/reconcile/apply.test.ts:200-206` guards its `chmod`-based EACCES provocation with an explicit `process.getuid() === 0` refusal and a comment. Three cases in this area (and, by inspection of the pattern, likely many more repo-wide) use `chmod 0o000`/`0o500`/`0o555` to provoke `EACCES` with no such guard. **Recommend a repo-wide grep for `chmod(` in `tests/` and propagation of the `apply.test.ts` guard** — it is a one-line copy per site and converts a confusing logic failure into a legible environment failure.

5. **A partitioned sweep cannot see a bridge/orchestrator contract mismatch.** The agents bridge advertises multi-directory discovery (`agentsDirs: readonly string[]`, cross-directory dedup, a dedicated warning, two paired test cases) while its only production feed discards everything after `componentPaths.agents[0]`. The bridge reviewer sees a well-tested feature; the orchestrator reviewer sees a two-line helper with three passing cases; neither sees that the feature is unreachable. **Recommend one targeted pass that walks each bridge's `StageXInput` field-by-field back to its orchestrator call site** — the same walk would have caught the unused `resolved` field, the flattening, and the argument-threading gaps in item 1 as one coherent defect.

### Corrections to META-FINDINGS.md

- **"Clean verdicts are not [reliable]" — confirmed, and the asymmetry is sharper than stated.** In this area the clean list contained 14 files and yielded 11 new findings, while the *recorded* BLOCKERs were the two weakest claims in the file. The lesson for the consolidation is not just "attack clean lists" but "the first pass's severity signal is anti-correlated with evidence quality here": both BLOCKERs cited mechanisms the source refutes, while every WARNING it filed held up.
- **The "Patterns to propagate" table should gain a row for whole-file byte assertions on generated artifacts.** `tests/bridges/agents/frontmatter.test.ts:313-479` is a second reference implementation of the "whole-message assertion against hand-written strings" pattern currently credited only to `*.messaging.test.ts` — it compares a complete multi-line generated *file* (frontmatter + provenance mapping + legend + body) against a hand-written literal, three times, and catches every line-drop and reordering mutation I tried. For generated-artifact bridges it is a better template than the messaging files, because it demonstrates the technique on multi-line structured output.

### Confirmations

- **"The `ScopedLocations` brand is never proven" (Gates that do not gate, item 5) — independently confirmed from a second angle.** `tests/bridges/agents/types.test.ts` writes `locations: undefined!` at `:57`, `:106` and `:206`. `undefined!` has type `never`, so those `satisfies` checks accept *any* declared type for the field — the brand is not merely unproven, it is actively bypassed in the one module whose job is type verification. Fix listed above.
- **"Sibling drift is the dominant shape" — confirmed with four fresh instances in a single directory**: `unstage.test.ts` alone omits the `Object.isFrozen` assertions its three siblings make; `marker.test.ts` alone omits per-entrypoint `describe()`; `stage.test.ts:2228` derives its expected value from the actual while `:2300` (same `describe`, 70 lines later) does it correctly; and three chmod cases diverge from `apply.test.ts`'s guarded form. In every case the correct form already exists within a few files, so the fixes are propagation.
- **"Reviewing production alongside tests was worth it" — confirmed.** The highest-value item this pass produced (the `componentPaths.agents` flattening and its relationship to the unused `resolved` field) is invisible from the test layer alone and was reachable only by tracing a bridge input back through two orchestrator modules.
