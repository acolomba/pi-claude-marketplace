---
phase: 02-skills
reviewed: 2026-11-01T13:06:30Z
depth: standard
iteration: 2
files_reviewed: 13
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts
  - extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - extensions/pi-claude-marketplace/orchestrators/discover.ts
  - extensions/pi-claude-marketplace/edge/skill-aliases.ts
  - features/step_definitions/skill/project-trust.steps.ts
  - features/skill/project-trust.feature
  - features/skill/frontmatter.feature
  - features/skill/lifecycle.feature
findings:
  critical: 1
  warning: 3
  info: 5
  total: 9
status: issues_found
---

# Phase 2: Code Review Report (iteration 2)

**Reviewed:** 2026-11-01T13:06:30Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This pass checks the fixes in commits 6218a48, cd7b747, b1ea2de, and 488472b (diff base 1ab4199). It also looks for regressions in them and rates the three gaps the fixer reported. I ran the real modules under Node against each input below.

Status of the iteration-1 findings:

- **CR-01 (record writer, indented `---`): resolved.** The original input now gives `description: "Part one.\n---\nPart two.\n"` plus the record. `closingFenceIndex` uses Pi's own rule (`indexOf("\n---", 3)` in `dist/utils/frontmatter.js`). The same input class still breaks the other writers in the same staging pipeline (WR-02).
- **WR-01 (record key spellings): resolved.** The double-quoted, single-quoted, spaced, and escaped (`"pi-claude-\x6darketplace":`) forms are all removed and replaced. A nested `meta.pi-claude-marketplace` is kept. Running the writer twice gives one record. The same spelling class still breaks the `name` and `description` writers (WR-03). One exotic form now leaves an empty key behind (IN-04).
- **WR-02 (failures escaping the input handler): resolved.** A read or parse failure aborts with a usage error. Any other rejection is turned into an abort at the edge, and a table-load failure returns `continue`. I found no regression. One small robustness item remains (IN-05).
- **WR-03 (project trust): not resolved for the scenario it described.** Pi 1.4.0 treats a project as trusted, with no prompt, when the project holds no resource from `TRUST_REQUIRING_PROJECT_CONFIG_RESOURCES`. `.pi/pi-claude-marketplace/` is not on that list. So the cloned repository in the original finding still runs its `!` commands and claims a bare alias. The new gate only works when the repository also ships, for example, `.pi/settings.json`, and an attacker would not ship one. The fix's own scenario has to add "the project holds a pi settings file" to make the gate bite. This is now **CR-01**. The model-side exposure that the fix left in place is **WR-01**.

Fixer gaps:

1. **The WR-03 residual is CR-01 (critical).** Requiring a `state.json` record does not close it, because the project's `state.json` sits in the same tree the attacker controls. The alias loader already requires it, and the original scenario forged it. Upstream keeps provenance outside the repository; see CR-01.
2. **A forged record claiming a bare name is IN-03.** Only CR-01's attacker can reach it. A record written by install claims exactly one bare name, which matches upstream. Once provenance exists, this gap is closed too.
3. **`frontmatterBlockEnd` is WR-02 (warning, pre-existing).** It is wider than reported. `setDescriptionScalar` breaks the same way whenever the description is rewritten (a `when_to_use` fold, a path variable, the empty-description fallback, or the 1,536 cap). The phase now has two fence rules in one pipeline.

## Critical Issues

### CR-01: Plugin content the user never installed still runs its `!` commands, because Pi trusts a project that holds only `.pi/pi-claude-marketplace/`

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:107-134,234-236`; `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts:156,166`; `extensions/pi-claude-marketplace/orchestrators/discover.ts:25-43`. Pi side: `node_modules/@earendil-works/pi-coding-agent/dist/core/trust-manager.js:8-17,151-170`, `core/project-trust.js:22-24`, `main.js:594-599`.

**Issue:**

- Pi's `resolveProjectTrusted` returns `true` when `hasTrustRequiringProjectResources(cwd)` is false (`project-trust.js:22-24`). `main.js:596-599` computes `projectTrusted = !hasTrustRequiringResources || trustStore.get(cwd) === true`.
- That check looks only at `.pi/{settings.json, mcp.json, extensions, skills, prompts, themes, SYSTEM.md, APPEND_SYSTEM.md}` and the `.agents/skills` directories on the way up the tree.
- A repository that commits only `.pi/pi-claude-marketplace/` (a `state.json` plus `resources/skills/<x>/SKILL.md`) is therefore trusted, and the user is never asked.

In such a project:

- `aggregateDiscoveredResources` serves every `resources/skills/*/SKILL.md` and reads no state at all, so Pi lists `/skill:<x>`.
- `findBridgedSkill` accepts any loaded file at the staged path. `request.projectTrusted` is `true`, so the gate at line 234 passes, and `fillSkill` runs the file's `!` commands with the user's whole environment.
- With a forged `state.json` and record line, `loadQualifiedSkillAliases` also gives the skill one bare name (`/review`, `/test`, `/commit`). `installedForms` keeps that name, because a bare name is a form that install writes.

This is the exact scenario WR-03 described. Deterministic shell execution is new in this milestone (D-CF1-02 / D-CF2-06), and its threat-model premise ("the commands come from the installed plugin") is still false for files the user did not install.

The project-scope hooks bridge hydrates from the same tree and also never calls `ctx.isProjectTrusted()`. It is outside this phase's file scope, but the same project-level decision should cover it.

**Would requiring the plugin in `state.json` close it?** No. `<cwd>/.pi/pi-claude-marketplace/state.json` is inside the repository, so the attacker writes it along with the staged file. The alias loader already filters by state (`loadedSkills`), and the original attack included a forged state. Matching the staged directory against that record only checks the attacker's files against each other. The only variant it closes is `/skill:<x>` without a state file, and that is the cheapest variant to forge around.

**What upstream does:** Claude Code 2.1.316 (`/opt/claude-code/bin/claude`) never takes plugin content from the repository:

- The installed set is `installed_plugins.json` under the user's config directory. Each project-scope entry carries `scope: "project"` and `projectPath`. The loader picks `a.find((r) => r.scope === "project" && r.projectPath === o)` for the current project.
- A plugin that only the repository's settings enable is dropped with reason `not_installed_here`: "only the repository's settings enable it and it is not installed on this machine".
- A folder the user has not trusted drops project plugins with `untrusted_for_folder`. Trust is stored per project as `projects[<path>].hasTrustDialogAccepted`, also in user config.
- In both cases, provenance lives outside the repository.

**Fix:**

1. Anchor provenance in the user scope, which a cloned repository cannot write. On every project-scope materialization (install, update, reinstall, enable, apply, import), write `<agentDir>/pi-claude-marketplace/project-installs.json` atomically. Key it by the canonical project path, and store the plugin id, the generated skill names, and a SHA-256 of each staged `SKILL.md`.
2. At discovery, in the project branch of `aggregateDiscoveredResources`, accept a project skill directory only when that ledger lists it for `canonical(cwd)` and the hash matches. Make the same check in `findBridgedSkill`, in `loadQualifiedSkillAliases`, and in the project-scope hooks hydration.
3. When content is present but not listed, report it the way upstream reports `not_installed_here`. The user runs `/claude:plugin apply` or `install` to adopt it.
4. Keep the `ctx.isProjectTrusted()` gate as a second condition.

All new writes stay inside `<scopeRoot>/pi-claude-marketplace/` (NFR-10). Record the decision in CONTEXT with an ID, together with the hooks bridge. Add a cucumber scenario with no `.pi/settings.json`: a committed `.pi/pi-claude-marketplace/` tree whose `/skill:<x>` and bare alias run nothing.

## Warnings

### WR-01: In a project that Pi does not trust, the staged skills are still discovered, listed to the model, and readable

**File:** `extensions/pi-claude-marketplace/orchestrators/discover.ts:17-43`; `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:230-236`

**Issue:** The fix gates only typed invocation and aliases. `aggregateDiscoveredResources` still returns the project's skill and prompt paths when `ctx.isProjectTrusted()` is false. So in a project Pi refuses to trust:

- Pi lists this extension's project skills in the system prompt.
- The model can read their bodies, and the bodies can tell it to run commands through its bash tool. Pi has no permission modes (D-CF1-02).
- Pi itself withholds `.pi/skills` and `.pi/prompts` in that state (`package-manager.js:2024`).
- Upstream loads no project-scope plugin component before trust (`project-scope-suppressed-untrusted`).

The fixer licensed this by citing a Pi gap ("`resources_discover` registers project skills before it can know..."). That gap does not exist. `ResourceLoader.reload` resolves trust and calls `setProjectTrusted` (`core/resource-loader.js:362-365`) before `extendResourcesFromExtensions` emits `resources_discover` (`core/agent-session.js:2688`). The handler receives a `ctx` whose `isProjectTrusted()` already holds the decision.

The comment at `skill-invocation.ts:231-233` ("nothing of it reaches the model") is therefore inaccurate. Under the parity constraint in CLAUDE.md, this divergence has no license.

**Fix:** In the `resources_discover` handler (`index.ts` `prepareResources` / the aggregate call), pass the project locations only when `ctx.isProjectTrusted()` is true:

```ts
const discovered = await aggregateDiscoveredResources(
  userLocations,
  ctx.isProjectTrusted() ? projectLocations : undefined,
);
```

Keep the invocation gate for a trust change within a session. Then the untrusted `/skill:<x>` is an unknown name to Pi, as it is upstream. Correct the comment.

### WR-02: The shared scanner `frontmatterBlockEnd` still stops at an indented `---`, so `name` and `description` rewrites break skills that Pi accepts (pre-existing; fixer gap 3)

**File:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts:12-21`; callers `rewrite-frontmatter.ts:30-49`, `frontmatter-degrade.ts:114-140,211-216`; local duplicate `skill-names.ts:173-176`

**Issue:** `frontmatterBlockEnd` matches any line whose `trim()` is `---`. Pi closes the block only at a column-0 `---`. Reproduced with the real modules:

- **Name after the scalar.** `description: |\n  Part one.\n  ---\n  Part two.\nname: review` parses in Pi. `rewriteFrontmatterName` does not see `name`, inserts a second one, and fails with `Map keys must be unique`. This is the fixer's case.
- **Name before the scalar, description rewritten.** `name` comes first, and `when_to_use` follows the same block scalar. `setDescriptionScalar` cuts the description node at the indented `---`, and the leftover lines give `All mapping items must start at the same column`. `augmentSkillDescription` calls `setDescriptionScalar` whenever the effective value changes: a `when_to_use` fold, a `${CLAUDE_*}` path variable in the description, the empty-description fallback, or the 1,536 cap. So the trigger is wider than the fixer reported.
- **Degrade path.** `repairSingleLineScalars` stops early, so a repairable line after such a scalar is never repaired, and the skill degrades to the placeholder.

Every failure throws inside `stageSkill`, and the whole plugin install, update, or reinstall fails with an error that points at this extension's own line. This was not introduced by this phase.

The CR-01 fix makes the code harder to maintain. One staging pass now runs two different fence rules (`frontmatterBlockEnd` and `closingFenceIndex`). The header of `frontmatter-scan.ts` says the module exists so "a fix to the span rule lands once".

**Fix:** Move Pi's rule into the shared scanner and delete the local copy:

```ts
/** Index of Pi's closing fence: the first later line that starts with `---` at column 0. */
export function frontmatterBlockEnd(lines: readonly string[]): number {
  const index = lines.findIndex((line, i) => i > 0 && line.startsWith("---"));
  return index === -1 ? lines.length : index;
}
```

`skill-names.ts` then imports it in place of `closingFenceIndex`. Add unit rows to `rewrite-frontmatter.test.ts` and `frontmatter-degrade.test.ts`: `name` after the scalar, and `when_to_use` after the scalar. Extend the existing frontmatter scenario with a `name`-after row and a `when_to_use` row.

### WR-03: The WR-01 key-spelling class still breaks the `name` and `description` writers (pre-existing)

**File:** `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts:14,35-45`; `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts:121-138`

**Issue:** `rewriteNameNode` finds the key with `startsWith("name:")`, and `setDescriptionScalar` finds it with `startsWith(DESCRIPTION_KEY)`. Reproduced:

- With `"name": review` or `name : review`, Pi parses `name: "review"`. The rewriter does not see the key, inserts `name: <generated>` as the first line, and the SKILL-03 check throws `Map keys must be unique`.
- `"description": d` with a `when_to_use` gets a second `description`, with the same error.

In both cases the plugin install fails on a skill that Pi and upstream accept. This is the WR-01 defect in the two sibling writers that run right before the record writer. The cd7b747 fix (`isRecordNode`) solves it, but only for the record key.

**Fix:** Generalize the parse-per-node lookup into `frontmatter-scan.ts`, for example `topLevelNodeIndex(lines, blockEnd, key)`, which uses `parseFrontmatter` on each column-0 node exactly as `isRecordNode` does. Use it for `name`, `description`, and the record key. Add unit rows for the quoted and spaced spellings of `name` and `description`.

## Info

### IN-01: A `!` command cannot be cancelled by the user (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:193-200`

**Issue:** `runShell` is called without `signal`, although `PromptShellRequest.signal` exists for this purpose. A slow `!` command holds Pi's input pipeline until the 120 s timeout. When the user cancels, upstream reports `Shell command interrupted ...`.

**Fix:** Pass `ctx.signal` through `SkillInvocationRequest` when it is defined. Record the remaining gap in the D-CF2-10 Pi report.

### IN-02: Variable values in the body are not guarded against `!`, so a project path can form an injection pattern (carried forward)

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:137-152`; `extensions/pi-claude-marketplace/bridges/skills/stage.ts:361`

**Issue:** `${CLAUDE_PROJECT_DIR}` and the other path variables go into the body without `guardBangs` before `expandContextInjections` scans it. This matches upstream, so it is parity, not a bug. It is listed so the threat model names it.

**Fix:** None needed for parity. If a stricter stance is wanted, guard variable values before injection and record the divergence.

### IN-03: A forged record can still claim one bare name (fixer gap 2), and only CR-01's attacker can reach it

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts:89-93`

**Issue:** `installedForms` filters by shape, not by provenance. Any one colon-free name passes, because install writes exactly one bare name: `frontmatterNameAliases` gives `[qualified, name]` for a colon-free frontmatter `name`, which is upstream parity. The name cannot be checked against the frontmatter, because SK-3 rewrites `name` at install.

Plugin authors cannot forge a record, since the WR-01 fix strips any author key before writing. Only someone who writes the staged file directly can, and that is CR-01's attacker. A built-in Pi command name still wins in interactive mode, because `interactive-mode.js` handles built-ins before `prompt()`/`emitInput`.

**Fix:** None beyond CR-01. A user-scope ledger that stores each staged file's hash makes the record trustworthy as written.

### IN-04: Exotic record-key forms change or fail the staged frontmatter

**File:** `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts:195-206,223-228`

**Issue:** Reproduced:

- An explicit-key node, `? pi-claude-marketplace` with `: v` on the next line, is detected from its `?` line alone. Only that line is removed, so the staged frontmatter gains `"": "v"`. The install succeeds with an empty key the author never wrote.
- `x: &a 1` with `pi-claude-marketplace: *a` (an alias that does not parse alone; the fixer knew this) gives a duplicate key and the install fails.
- A `...` document-end line before the closing fence makes the record line a second YAML document, and the install fails.

All three need deliberately unusual YAML. Both failures are fail-closed.

**Fix:** Treat a `?` line and the `:` line that follows it as one node. Alternatively, detect `RECORD_KEY in parsed.frontmatter` before writing, and refuse with a discovery warning that names the author's key when the node cannot be removed cleanly.

### IN-05: A rejected alias-table load is cached for the rest of the session

**File:** `extensions/pi-claude-marketplace/edge/skill-aliases.ts:131-144,206-214`

**Issue:** `getQualifiedAliases` caches the promise before it settles. If `loadAliases` rejects (for example, `pi.getCommands()` or `getAgentDir()` throws once), every later lookup reuses the rejected promise. The new `onRejected` handler returns `continue`, so every alias stays silent until the next `session_start`. Completion rejects too.

`loadQualifiedSkillAliases` catches state and file errors internally, so the trigger is unlikely.

**Fix:** `aliases.catch(() => cache.delete(key))` when the promise is cached, so the next input retries.

---

_Reviewed: 2026-11-01T13:06:30Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
