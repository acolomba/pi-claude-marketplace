---
phase: 04-skill-and-workflow-install-defects
reviewed: 2026-11-14T15:00:00Z
depth: standard
iteration: 3
reviewed_range: 1729cfc9..e50b3afd
iteration_2_range: 03f6b319..1729cfc9
iteration_1_range: e739fcfa..852b033f
files_reviewed: 17
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/component-paths.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - features/skill/root-source-entries.feature
  - features/workflow/agent-restrictions.feature
  - test/domain/component-paths.test.ts
  - test/domain/plugin-resolver.test.ts
  - test/orchestrators/plugin/discover-names.test.ts
  - test/orchestrators/plugin/info.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - CHANGELOG.md
  - docs/workflows-compatibility.md
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
  necessity: 0
status: issues_found
---

# Phase 4: Code Review Report

## Iteration 3

**Reviewed:** 2026-11-14T15:00:00Z
**Depth:** standard
**Iteration:** 3 (final)
**Range:** `1729cfc9..e50b3afd` (f273f776 and 1ea9b3b9 for WR-04, 91b0c917 for WR-05)
**Files Reviewed:** 17
**Findings:** critical 0, warning 1, info 2, total 3, necessity 0
**Status:** issues_found

### Summary

This iteration reviews the two fix commits for WR-04 and WR-05 and the one-character table alignment. I read every changed production function in full: `skillFileHint`, `refusedListedSkillPathMessage`, `refusedListedSkillPathMessages`, `classifyListedPaths`, and `collectRootSourceSkillPaths` (`component-paths.ts`), the `materializableFields` spread (`plugin-resolver.ts`), the `RefusedListedSkillPath` type (`resolver-types.ts`), the two discovery-warning spread sites (`install-outcome.ts:1251-1255`, `update-swap.ts:1710-1715`), `composeResolvedComponents` and its four callers (`info.ts`), and the note builder (`discover-names.ts`). I also read the callees that decide what the user sees: `notifyStagingHalves` (`staging-diagnostics.ts:126`, which redacts every discovery warning), `redactAbsolutePaths` (`shared/redact-absolute-paths.ts`), `resolveContainedComponentPath`, `validateComponentPath`, and `readDirEntriesTolerant`. I checked the wording against the Claude Code 2.1.323 binary through `strings`. I checked the engine claims against `@quintinshaw/pi-dynamic-workflows` 3.15.0 in `node_modules/.cache/optional-peers` (`src/agent.ts`, `src/pi-extension.ts`, `src/workflow-settings.ts`, `README.md`). I probed `redactAbsolutePaths` with a short `node -e` run on the new message shapes. I did not run `npm run check`, did not edit source, and did not commit. I read the necessity rubric. No finding meets its evidence rule.

Answers to the questions:

1. **WR-04 wording: matches 2.1.323.** The `/plugin` errors view renderer (`Xy`) prints `` `${component} path escapes plugin directory: ${path}` ``, `` `${component} path not found: ${path}` ``, and, for `component-load-failed`, `` `Failed to load ${component} from ${path}: ${reason}` ``. The loader `sD` builds the reason `path is a file; skills entries must be directories containing SKILL.md`, and it adds ` — point to the plugin root '.' instead` or ` — point to the parent directory '<dir>' instead` when the basename, lowercased, is `skill.md`. The fixer's three messages and both hint arms are the same text. Only the path forms differ (IN-06).
2. **WR-04 placement: correct.** Upstream pushes these errors into the plugin's error list, and the plugin still loads. Here, install (`install-outcome.ts:1253`) and update (`update-swap.ts:1712`) add them to the discovery warnings. The per-plugin diagnostic prints them as `warning` rows, and the cascade row stays `info`. Enable, reinstall, and apply moves reach the same two sites. `info` puts them first in `notes` (`info.ts:1170-1176`) for the installable, partially-available, and installed rows.
3. **The plugin stays installed.** `collectRootSourceSkillPaths` stores `refused` and leaves it out of its dirty return value, so `decideResolution` is not changed.
4. **T-04-01 still holds.** `classifyListedPaths` calls `statKind` only for `validated.ok`. A traversal is recorded from `listedRaws[index]` and never statted. The containment check itself (`assertPathInside`) is unchanged and runs before any read.
5. **NFR-7 is respected.** The field is on `MaterializableFields` only. `composeResolvedComponents` takes it as an optional member, and the `unavailable` lenient arm (`info.ts:2363-2371`) does not build it, so no consumer reads it from an arm that cannot carry it.
6. **WR-05 note: true in every Pi configuration.** Engine 3.15.0 sets `childCodemode = !this.sessionOptions.resourceLoader && this.providerMiddlewareExtensions.includes("builtin:codemode")` (`src/agent.ts:1238-1239`). It filters Pi's built-ins only in that arm (`:1247-1263`). The setting comes from the global `~/.pi/workflows/settings.json` or the project `<cwd>/.pi/workflows/settings.json` (`src/workflow-settings.ts`, `src/pi-extension.ts:102`). The Pi extension entry point passes no `resourceLoader`, so inside Pi the only case that keeps the restriction is the one the note names. "may use" covers Pi's `defaultTools` and the engine's `excludeSubagentTools`. The setting name and the value `builtin:codemode` are named exactly, and they cannot be confused with Pi's own `codemode` tool. The docs row, the upstream draft, and the CHANGELOG say the same.
7. **Regression, coverage, and fallow: no blocking risk.** Every new branch has an owner case: the three causes and both hint arms (`test/domain/component-paths.test.ts:1063-1118`), `file` against `missing` (`:1248-1249`), the traversal and absolute arms (`:1261-1283`), the `undefined` input, both arms of the resolver spread, and both spread sites. The new tests use `createHermeticEnvironment` or `withHermeticHome`. The new import `component-paths.ts` → `workflow-script.ts` stays inside `domain/`. `workflow-script.ts` imports only `name.ts` and `shared/errors.ts`, so it forms no cycle. Each new export has a consumer. The three-line spread at the two sites is short enough that the fixer's `npm run fallow` run (exit 0) covers it.

Fixer's open points:

- **Path forms.** For `missing`, upstream prints the resolved absolute path. NFR-9 would reduce that to its basename here, so the plugin-relative form tells the user more. For `file`, upstream prints the path as written (`./notes.md`, hint `'./skills/a'`), and the fix prints the normalized path (`notes.md`, hint `'skills/a'`). This is a small difference, and the fixer records it as a decision for the maintainer to confirm (IN-06).
- **`../outside/x` printing as `..x`.** This is a real defect in the new warning, not only a pre-existing note problem. See WR-06.

### Narrative Findings (AI reviewer)

### Warnings

#### WR-06: The new traversal warning prints a different path for any traversal with more than one segment

**File:** `extensions/pi-claude-marketplace/domain/component-paths.ts:95-100` (the message), rendered through `extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts:126` and `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1171-1173`; root cause `extensions/pi-claude-marketplace/shared/redact-absolute-paths.ts:71-72`
**Issue:** WR-04 exists to tell the user which listed path does not load. The warning puts the traversal in as written. But both surfaces then pass the line through `redactAbsolutePaths`, and the last regex there, `(?<![\w:/\\])(?:…|\/)[\w./\\~-]+[\\/][\w./\\~-]+`, does not exclude `.` from its lookbehind. So the `/` after `..` starts an "absolute path", and the regex reduces it to its basename. Measured with `node -e` on the current tree:

| Listed path | Printed at install and `info` |
| --- | --- |
| `../outside` | `skills path escapes plugin directory: ../outside` (correct) |
| `../outside/x` | `skills path escapes plugin directory: ..x` |
| `../../x` | `skills path escapes plugin directory: ..x` |
| `skills/../../x/y` | `skills path escapes plugin directory: skills/..y` |

Claude Code prints each of these as written. No decision licenses the change: NFR-9 covers absolute paths, and these paths are relative. The printed `..x` names a path that the plugin does not list, so the warning is false for the most likely real form of the mistake (`../<sibling>/skills`). The scenario Outline (`features/skill/root-source-entries.feature:246-247`), the update scenario, and the two `info` scenarios use only the one-segment `../outside`, so they do not catch it. The fixer found the cause and also noted that the same defect affects the older `escapes plugin root: "../a/b"` notes. That does not make the new text correct.
**Fix:** Exclude `.` from the lookbehind, so that a separator after a dot never starts an absolute path:
```ts
const absolutePath =
  /(?<![\w:/\\.])(?:[A-Za-z]:[\\/]|\\\\(?:\?\\)?|\/)[\w./\\~-]+[\\/][\w./\\~-]+/g;
```
No case in `test/shared/redact-absolute-paths.test.ts` has a dot directly before a separator, so the change should not break an existing case. Add owner cases for `../a/b`, `./a/b`, and `skills/../../x/y`. Those cases must keep their text, and an absolute path after a space must still be reduced. Add a `../outside/skills` row to the install Outline. With this change, `missing` and `file` can also print as written (IN-06), if the maintainer wants that. If changing the shared redaction is out of scope for this phase, record the defect as a BACKLOG item and as a known limit in the D-PG4-01 parent line. Do not leave it unrecorded.

### Info

#### IN-06: `missing` and `file` paths print plugin-relative and normalized, not in upstream's form

**File:** `extensions/pi-claude-marketplace/domain/component-paths.ts:619-623`
**Issue:** Upstream prints a missing path as the resolved absolute path (`Ce`) and a file path as written (`ve`), and it takes the hint's parent from the written path. The fix prints `validated.relative` for both: `./notes.md` → `notes.md`, and the hint names `'skills/a'` for `./skills/a/SKILL.md` where upstream names `'./skills/a'`. NFR-9 explains the `missing` form. For `file`, the only reason is the redaction defect in WR-06.
**Fix:** Keep the current form as the fixer's pending decision 1. Or, after WR-06, print the `file` path as written. Either way, record the form in the D-PG4-01 parent line.

#### IN-07: An absolute listed path prints as `skills path escapes plugin directory: skills`, which reads like the conventional folder escapes

**File:** `extensions/pi-claude-marketplace/domain/component-paths.ts:97`; pinned by `test/orchestrators/plugin/info.test.ts:2196`
**Issue:** NFR-9 reduces `/home/u/outside/skills` to its basename `skills`. That is correct under the project rule, but the result names the conventional folder that the plugin does load. The older `must be relative (got absolute "skills")` note has the same shape.
**Fix:** A wording question for the maintainer. One option is to keep the cause visible, for example `skills path escapes plugin directory: skills (absolute path)`. Another is to accept the reduced form as it is.

### Iteration-2 findings, status after the fixes

| ID | Status | Note |
| --- | --- | --- |
| WR-04 | Fixed, with a residual | The wording and placement match 2.1.323, the plugin stays installed, and T-04-01 and NFR-7 hold. Multi-segment traversals print the wrong path (WR-06). |
| WR-05 | Fixed | The note is true in every Pi configuration and names `providerMiddlewareExtensions` and `builtin:codemode` exactly. The D-PG4-12 wording is still pending maintainer review. |
| IN-05 | Open (maintainer question) | Not changed, as instructed. It does not block. |

---

## Iteration 2

**Reviewed:** 2026-11-14T13:30:00Z
**Depth:** standard
**Iteration:** 2
**Range:** `03f6b319..1729cfc9` (b5c7dc4a WR-02, 17bd223c WR-03, 0e914540 IN-01, 246e0e06 IN-02, f104b67e IN-03, 84c69fe5 IN-04)
**Files Reviewed:** 17
**Status:** issues_found

### Summary

This iteration reviews the fix commits only. I read every changed production function in full, and the callers and callees that decide what each fix does: `validateComponentPath`, `survivingListedPaths`, `addListedSkillPaths`, `addDeclaredSkillPaths`, and `markSupportedWhenCollected` (`component-paths.ts`); `buildNotInstallablePathRowFields`, `deriveLenientComponentPaths`, `rootSourceLenientSkillPaths`, and `containedRelativePath` (`info.ts`); and `discoverPluginSkills`, `skillsFolderFirst`, `collectSkillSubdirs`, and `isSelfSkillDir` (`bridges/skills/discover.ts`). I read the test and scenario diffs, not every test file in full. I checked each upstream claim against the Claude Code 2.1.323 binary (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`, through `strings`). I checked each engine claim against `@quintinshaw/pi-dynamic-workflows` 3.15.0 in `node_modules/.cache/optional-peers` and Pi 1.5.0 in `node_modules/@earendil-works/pi-coding-agent`. I ran no `npm run check` and no tests, as instructed. I read the necessity rubric. No finding meets its evidence rule.

Answers to the four questions:

1. **WR-01 skip: confirmed.** In 2.1.323, `QAo` (the marketplace-entry loader) first runs the root-source block, which sets `skillsPaths` to the listed survivors minus the root and `skills/`. Then, in both loading arms, it calls `_Ao`. The arms are no `plugin.json` (`mode:"assign"`) and `plugin.json` present (`mode:"append"`). `_Ao` runs `entry.skills` through `sD` again and filters out only `qp(ff(r,"skills"))`: `ne=(await sD(q,…)).filter((Ee)=>qp(Ee)!==X)`. In assign mode, `e.skillsPaths=ne`. In append mode, the code appends the members of `ne` that are not already present. Either way a listed root is a skills path again, next to the kept `skillsPath` (`skills/`). Pi's `[".", "skills"]` is the same set, and `skillsFolderFirst` (`bridges/skills/discover.ts:202-207`) reads `skills/` first, as upstream reads `skillsPath` before `skillsPaths`. WR-01 from iteration 1 is withdrawn. No code change is needed.
2. **WR-02: upstream does tell the user.** The root-source block's sink `it` is local, but `_Ao`'s second `sD` pass pushes `{type:"path-traversal",component:"skills",path:"../outside"}` into the plugin's error list. `QAo` then runs `s.push(...Ee)`. The `/plugin` errors view renders it as "skills path escapes plugin directory: ../outside" and adds a remediation hint. The plugin still loads. The fix now drops the path with no output, so this is a parity gap. See WR-04.
3. **IN-04 note: true in every engine mode, but not in every Pi configuration.** Under `builtin:codemode` the note's "outside codemode" qualifier holds. Outside codemode the note also holds when the engine's registry does not resolve the agent type, when pi-subagents is absent, and when an embedder injects a resource loader. But the child's active built-ins come from the user's Pi `defaultTools` setting, and `DEFAULT_TOOL_NAMES` applies only when that setting is unset. So the note can name a tool the agent does not have. See WR-05.
4. **Regression, coverage, and fallow: no blocking risk found.** WR-03's `path.normalize` form is lexical. It refuses `..`, `../x`, and `a/../..`, and trims one trailing separator. IN-01's probe errors stay inside the row builder's `try`. An escaping string still never reaches a read (T-04-03). Every new branch I traced has a unit case: `malformedListed`, the `[]` and `undefined` returns of the lenient fallback, `allowsAll` through an empty or `*` value, the `denied` arm, and the `unkept.length === 0` arm. `listedToolNames` has a consumer (`discover-names.ts`), its owner test, and a barrel test, so `fallow dead-code` stays clean. The `readEntriesOrEmpty` → `readEntriesOrMissing` delegation removes a would-be clone. One narrowing of D-PG4-11 is recorded as IN-05.

### Narrative Findings (AI reviewer)

### Warnings

#### WR-04: A refused listed skills path of a root-source entry is dropped without a word, while Claude Code 2.1.323 reports it as a plugin load error

**File:** `extensions/pi-claude-marketplace/domain/component-paths.ts:620-649` (pinned by `features/skill/root-source-entries.feature:222` and the new "only listed path escapes" scenario; owner cases in `test/domain/component-paths.test.ts:1184-1207` and `:1348-1356`)
**Issue:** After b5c7dc4a, `collectRootSourceSkillPaths` keeps only the `cause === "type"` refusals as notes. An absolute or escaping listed path produces nothing. Install prints `severity: info` with no reason, and `info` prints `available` with no advisory. In 2.1.323, the same entry gets one `path-traversal` error. `_Ao` calls `sD(q,r,n.name,s,"skills","Skill","from marketplace entry",y,…)`, and `sD` runs `v.push({type:"path-traversal",source:s,plugin:r,path:ve,component:h,…})` into the plugin's error list `Ee`. `QAo` then runs `if(r){await SPt(Ae,Ee),s.push(...Ee)…}`, and the `/plugin` errors view renders the entry as `` `${component} path escapes plugin directory: ${path}` `` with the hint "This path was skipped because it could not be confirmed inside the plugin…". The plugin still loads, so the fix got the outcome right but dropped the report. Neither license covers the silent drop: no decision ID records it, and Pi has no capability gap here. Pi has a warning channel, and `shadowedFolders` already carries a typed resolver warning to install, update, and `info`. D-PG4-01 also says, for the fallback arm, "The existing refusal notes still print." The fixer recorded this as a residual question. Under AGENTS.md "Upstream parity", the default is the upstream behavior, so this is a finding and not only a question.

The same `_Ao` pass also reports a listed path that is missing (`path-not-found`) or that names a file ("path is a file; skills entries must be directories containing SKILL.md — point to the parent directory …"). `survivingListedPaths` drops those without a word too. That was already true before this range, but a warning field added for traversals should carry these two causes as well.
**Fix:** Add a typed field next to `shadowedFolders`, for example `refusedListedSkillPaths: readonly { path: string; cause: "traversal" | "missing" | "file" }[]`. Fill it in `collectRootSourceSkillPaths`, and do not set the dirty flag. Spread it into the install and update warnings at the two `shadowedFolders` spread sites, and render it in `info` as an advisory. Then change the `:222` scenario and the "only listed path escapes" scenario to expect `severity: warning` and the warning row. Leave the plugin `installed`/`available`. If the maintainer prefers the silent drop, record it as a decision ID that amends D-PG4-01, and correct the "existing refusal notes still print" sentence.

#### WR-05: The restriction note can name a tool the agent does not have, because the engine's child session takes its built-ins from the user's Pi `defaultTools` setting

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:77-82`, `:90-97`, `:143`, `:150-153`
**Issue:** `unkeptBuiltinTools` takes for granted that, outside codemode, the child always holds `read`, `bash`, `edit`, and `write`. The doc comment says "so a note is never false". The engine builds the child with `settingsManager: SettingsManager.create(runCwd, agentDir)` (`pi-dynamic-workflows/src/agent.ts:1416`), and `sessionOptions` is `{}` unless an embedder passes one (`:873`). Pi then computes the child's active built-ins as `settingsManager.getDefaultTools() ?? DEFAULT_TOOL_NAMES` (`pi-coding-agent/dist/core/sdk.js:148`, `:160`). `defaultTools` is a documented user setting (`docs/cli.md:128`) that accepts `-name` modifiers. The policy-filtered custom tools (`agent.ts:1210-1214`) do not add back a tool that the agent's `tools` excludes. Example: a user with `"defaultTools": ["-write"]` installs a plugin whose workflow runs an agent with `tools: Read, Grep`. The note says "the agent can use bash, edit, and write", but the agent has no `write`. D-PG4-11 accepts a missing note but never a false one. The iteration-1 fix suggestion ("may use") would have avoided this. The chosen form "can use <list>" does not.

There is a related wording risk. Pi has its own `codemode` tool (`"defaultTools": ["+codemode"]`, `docs/cli.md:164`), which is not the engine's `builtin:codemode` provider-middleware option. Only the engine option makes the child keep the restriction (`agent.ts:1238-1239`). A user who turned on Pi's codemode can read "outside codemode" as "not my case".
**Fix:** Make the clause depend on Pi's default tools, and name the engine option. For example: `…which restricts its tools; unless the workflow engine runs with builtin:codemode, it does not keep that restriction, so the agent may use bash, edit, and write`. Or keep "can use" and add "when Pi's default tools include them". Change the `discover-names.ts:150-153` doc comment so it no longer says "never false". Update the expected text in the four scenarios of `features/workflow/agent-restrictions.feature` and in the `restrictionNote` helper in `test/orchestrators/plugin/discover-names.test.ts`. This wording is still part of D-PG4-12, which is pending maintainer review.

### Info

#### IN-05: An agent whose `tools` lists all four built-ins, or a scoped `Bash(spec)`, now gets no note, which narrows the D-PG4-11 trigger without a recorded decision

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:90-97` (pinned by the `'["Read", "Bash(git log *)"]'` → `"edit and write"` case and the "allows every built-in" no-note case in `test/orchestrators/plugin/discover-names.test.ts`)
**Issue:** D-PG4-11 defines the trigger as a non-empty `tools` or `disallowedTools`. The fix suppresses the note when the four built-ins are all kept, and `listedToolNames` reads `Bash(git log *)` as plain `Bash`. Take `tools: Read, Bash(git log *), Edit, Write`. Before the fix this agent got a note. Now it gets none. Outside codemode the engine gives it unrestricted `bash` (Pi's core tool, not policy-filtered). With a user `defaultTools` that adds `grep`/`find`/`ls`, the agent also gets tools its upstream list leaves out. Both are missing notes, which D-PG4-11 accepts. But this suppression was not part of D-PG4-11 or D-PG4-12, and it was introduced as a review fix.
**Fix:** Add it to the D-PG4-12 maintainer question: "suppress the note when the four built-ins are kept, and treat `Tool(spec)` as a full allowance". Alternatively, count a `Tool(spec)` entry as a restriction the engine does not keep, and list that tool.

### Iteration-1 findings, status after the fixes

| ID | Status | Note |
| --- | --- | --- |
| WR-01 | Withdrawn | Upstream `_Ao` re-admits a listed root (question 1). The current code matches 2.1.323. |
| WR-02 | Fixed, with a residual | The plugin now loads as upstream loads it. The missing user report is WR-04. |
| WR-03 | Fixed | The normalization is lexical. Unit cases at the cwd and at `/` cover it. |
| IN-01 | Fixed | The lenient fallback now matches the strict one. The listing still keeps missing paths when another path survives, which is harmless: they read as empty. |
| IN-02 | Recorded | A residual bullet in `docs/research/parity-gaps/skills-commands.md`. The maintainer still has to decide. |
| IN-03 | Fixed | The CHANGELOG wording now matches update semantics. |
| IN-04 | Fixed, with residuals | The "outside codemode" qualifier is correct for the engine. WR-05 and IN-05 are the residuals. |

Planning residuals (not source, not counted): `04-01-SUMMARY.md` and `04-02-SUMMARY.md` still describe the behavior from before the fixes, as the fixer's "Parent lines" note says.

---

## Iteration 1

**Reviewed:** 2026-11-14T12:00:00Z
**Depth:** standard
**Iteration:** 1
**Range:** `e739fcfa..852b033f`
**Files Reviewed:** 33 (`extensions/pi-claude-marketplace/bridges/skills/stage.ts`, `domain/component-paths.ts`, `domain/skill-sibling-paths.ts`, `domain/skill-tokens.ts`, `domain/workflow-script.ts`, `orchestrators/plugin/discover-names.ts`, `orchestrators/plugin/info.ts`, `orchestrators/plugin/install-outcome.ts`, `orchestrators/plugin/update-swap.ts`; `features/lib/published-marketplace.ts`, `features/lib/upstream/index.ts`, `features/lib/upstream/workflows.ts`; `features/skill/root-source-entries.feature`, `features/skill/sibling-links.feature`, `features/workflow/agent-restrictions.feature`, `features/workflow/references.feature`; `features/step_definitions/marketplace/publishing.steps.ts`, `features/step_definitions/plugin/installation.steps.ts`, `features/step_definitions/workflow/runs.steps.ts`; `test/bridges/skills/stage.test.ts`, `test/domain/{component-paths,skill-sibling-paths,skill-tokens,version,workflow-script}.test.ts`, `test/orchestrators/plugin/{discover-names,info,install-outcome,update-swap}.test.ts`; `CHANGELOG.md`, `docs/workflows-compatibility.md`, `.agents/skills/cucumber/rules/world-and-stand-ins.md`, `.fallowrc.json`)
**Findings:** critical 0, warning 3, info 4, total 7, necessity 0
**Status:** issues_found

## Summary

This review covers the code commits `f2b48edc..852b033f` (range `e739fcfa..852b033f`). The `.planning/` files in the range were not reviewed as source. I read every changed production function in full, and also the callers and callees that decide what each change does: `discoverPluginSkills`/`isSelfSkillDir` (skills discovery), `decideResolution` and the `structuralDirty` fold in `plugin-resolver.ts`, `discoverComponentNames` and `buildNonInstallableRowFields` in `info.ts`, `declaredAgentName`/`generatedAgentName`/`assertSafeName` in `domain/name.ts`, and `resolveContainedComponentPath`. I checked the root-source rule against the Claude Code 2.1.323 binary at `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`. I ran no `npm run check` and no tests. I probed `path.relative(".", ...)` with a short `node -e` run, from cwd `/` and from a nested cwd.

The PG-WF-01 slash change (`skill-tokens.ts:119-123`), the sibling-path rewriter (`skill-sibling-paths.ts`), and the PG-SEC-01 join (`discover-names.ts`, `workflow-script.ts`) are correct for the cases their decisions name. The regex replacer reads its `offset` argument from the right position. The sticky dot-segment check has the right anchor. `declaredAgentName` cannot throw after agent discovery has already validated every name part. The AST walk is bounded, and if it fails it costs only the note. The notes are added once, at install (`install-outcome.ts:1244-1249`) and at the swap (`update-swap.ts:1706-1710`).

All three warnings are in the root-source skills rule (PG-CORE-01), where the code does not do what 2.1.323 does, which D-PG4-01 says to "copy exactly":

- A listed plugin root (`"."`/`"./"`) is collected as a skills path of its own. Upstream filters the root out (WR-01).
- A listed path refused as a traversal makes the whole plugin `unavailable`. Upstream loads the surviving listed folders, or loads the plugin with no skills. So the traversal arm that D-PG4-01 describes can never be observed (WR-02).
- The routed `containedRelativePath` question is a real defect, rated Warning and not a security issue. It depends on the process cwd, but it cannot widen a read past the plugin root (WR-03).

The known BACKLOG items (WFCMDCOLLIDE-01, WFAGENTCONST-01, PRELOADSIBLING-01, STAGEDUPMARKER-01, WFRESTRICTGATE-01, INFOAGENTESCAPE-01) are not raised again.

I read the necessity rubric (`.claude/gsd-core/references/necessity-review.md`). No finding meets its evidence rule. Each `try`/`catch` in the new code guards untrusted plugin input, which is a trust boundary. WR-02 explains why the traversal arm cannot be observed, but it is counted as a parity defect, not as a necessity finding, because the fix may make that arm needed again.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: A listed plugin root is collected as a skills path, so install and `info` read the whole marketplace root as a skills folder

**File:** `extensions/pi-claude-marketplace/domain/component-paths.ts:571-585` (also `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2242-2245`, pinned by `test/domain/component-paths.test.ts:1142-1153`)
**Issue:** In 2.1.323 the listed paths that survive go through `At=rt.some(root or skills)` and then `Dt=rt.filter((Ht)=>{let ln=qp(Ht);return ln!==wt&&ln!==Tt})`. A listed root or a listed `skills/` keeps the `skills/` folder, and `skillsPaths` holds only the **other** listed paths. Upstream never scans the root itself as a skills path. D-PG4-01 says the same: "`skills/` stays only when a listed path is `skills/` itself or the plugin root. Such a path then does not count twice." `addListedSkillPaths` adds every survivor, `.` included, and then adds `skills`, so `componentPaths.skills` becomes `[".", "skills"]`. The test pins this as `expectedPaths: [".", "skills"]`. The effects:
- **Install** (`bridges/skills/discover.ts:254-268`): for the `.` element, `isSelfSkillDir(pluginRoot)` runs. If the marketplace root has a `SKILL.md`, the whole root, `.git` and every other plugin's files included, is staged as one skill named after the clone folder (`path.basename(skillsDir)`). If the root has no `SKILL.md`, every top-level folder that holds a `SKILL.md` is admitted as an extra skill. Upstream loads none of these.
- **`info`** (`discoverComponentNames` with `componentNamesFromEntries`, `info.ts:359-369`): a root with no `SKILL.md` lists **every** top-level directory as a skill name, so `.claude-plugin`, `.git`, `skills`, `docs`, and so on show up. This holds for the installable row (strict `componentPaths`) and for the lenient unavailable row (`rootSourceLenientSkillPaths` keeps `.` and then pushes `skills`).

**Fix:** Do what upstream does: when a survivor is `.` or `skills`, keep the conventional folder and leave both out of the collected list.
```ts
// addListedSkillPaths
const keepsFolder = survivors.some((relative) => relative === "." || relative === "skills");
for (const relative of survivors) {
  if (relative !== "." && relative !== "skills") {
    addComponentPath(resolution, "skills", seenPaths, relative);
  }
}
if (keepsFolder && (await statKind(path.join(pluginRoot, "skills"))) === "dir") {
  addComponentPath(resolution, "skills", seenPaths, "skills");
}
```
Make the same change in `rootSourceLenientSkillPaths`: drop `.` from `kept` and push `skills` when `.` or `skills` was kept. Then change the two unit cases at `component-paths.test.ts:1142-1153` to expect `["skills"]` and `[]`.

### WR-02: A traversal in a root-source entry's `skills` makes the whole plugin `unavailable`, so the D-PG4-01 "installs no skills" arm can never be observed

**File:** `extensions/pi-claude-marketplace/domain/component-paths.ts:618-641` (folded at `extensions/pi-claude-marketplace/domain/plugin-resolver.ts:833-856`, `:871-873`; pinned by `features/skill/root-source-entries.feature:222-242`)
**Issue:** `collectRootSourceSkillPaths` returns `[...listed, ...declared].some((v) => !v.ok)`. `collectStrictComponentPaths` folds that flag into `structuralDirty`, and `decideResolution` then returns `unavailable(name, notes)`, which carries no `componentPaths` (NFR-7). Upstream handles this differently. In the binary, the error sink of the listed-path check is the local `it=[]`. It is read only for `gt=it.some((St)=>St.type==="path-traversal")` and is never pushed onto the plugin's error list `Ee`. So upstream:
- with `["./skills/a", "../outside"]`, loads `a` and nothing else. Here the plugin is `unavailable {unsupported source}`, and the feature scenario at `:222-242` pins exactly that.
- with only traversals listed, loads the plugin with **no skills**, and its commands, agents, hooks, and MCP servers still load. Here the plugin cannot be installed at all.

So the branch at `:635` (traversal means collect nothing, otherwise fall back to D-CF1-06) never changes an outcome anyone can see. Whenever a listed path is refused, the flag is `true` and the resolver throws the collected paths away. D-PG4-01 ("the plugin installs no skills") and the 04-01 summary describe behavior the code does not have. No recorded decision ID licenses the divergence, and no Pi capability gap explains it. AGENTS.md "Upstream parity" says this must go to the maintainer as a question.
**Fix:** Pick one of these and record it:
1. Parity: in the root-source arm, report a refused **listed** path as a note only and do not set the flag. Return `declared.some((v) => !v.ok)` so that a refused `plugin.json` path still follows the D-CF1-06 rule. Then change the feature scenario to expect `installed`/`available` with skill `a`, and add a case for only-traversals that installs the plugin with no skills.
2. Keep the fail-closed behavior: record it as a decision that amends D-PG4-01 (PROJECT.md parent line), delete the traversal branch at `:635`, since it then changes nothing, and correct the 04-01 summary.

### WR-03: `containedRelativePath` depends on the process cwd, so `info` shows an escaping listed path as a contained folder (routed from the security audit)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2255-2266`
**Issue:** `path.relative(".", declared)` resolves both sides against `process.cwd()`. It does not normalize the string by itself. I measured it with `node -e`:
- cwd `/`: `"../outside"` → `"outside"`, `"../../x"` → `"x"`, `"skills/../.."` → `""` (returned as `"."`, which by WR-01 also adds `skills`).
- **any** cwd: a path that climbs out and comes back through the cwd's own name folds into the tree. From `/home/acolomba/src`, `"../src/skills/a"` → `"skills/a"`.

**Severity:** a real defect, Warning, not Critical. The returned value is always a relative path that does not start with `..`. On POSIX, `path.relative` never returns an absolute path. `discoverComponentNames` then joins it under `pluginRoot` (`info.ts:423`). So the read stays inside the plugin root, and NFR-10 holds: what changes is **which** folder inside the root is read, not whether the read escapes. The cost is accuracy. The lenient row (used only for an `unavailable` plugin, `info.ts:2315-2326`) lists skills from `<pluginRoot>/outside` or `<pluginRoot>/skills/a` for a path the strict resolver refuses as a traversal. The answer also changes with the directory Pi was started from. The unit and feature cases that cover `../outside` pass only because the test cwd is never `/`. (On win32, a drive-relative `D:foo` makes `path.relative` return an absolute path. Joined under `pluginRoot`, that gives a malformed path, not an escape.)
**Fix:** Normalize by string only. The cwd must not take part:
```ts
function containedRelativePath(declared: string): string | undefined {
  if (path.isAbsolute(declared)) {
    return undefined;
  }
  const normalized = path.normalize(declared).replace(/[\\/]+$/u, "");
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    return undefined;
  }
  return normalized === "" || normalized === "." ? "." : normalized;
}
```
`path.normalize` is lexical: `"../outside"` → `"../outside"`, `"skills/../.."` → `".."`, `"a/../../b"` → `"../b"`. Add a unit case for `"../<cwd basename>/skills/a"` that must be refused, so the cwd dependence cannot come back.

## Info

### IN-01: For an unavailable root-source plugin, the lenient `info` listing keeps listed paths that the strict rule would drop

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2232-2248`
**Issue:** The strict arm keeps a listed path only when it is contained **and** `statKind` returns `dir` (`survivingListedPaths`, `component-paths.ts:553-563`). When no listed path survives and none is a traversal, the strict arm falls back to D-CF1-06 (`skills/` plus the manifest paths). The lenient mirror keeps every contained string, including folders that are missing and paths that name files. Take an entry `skills: ["./skills/typo"]` on a plugin that is unavailable for another reason, such as a malformed `hooks.json`. The lenient row lists no skills, but the strict rule would list `skills/*`. The `info` row is then not the install's authoring view that D-PG4-01 asks the mirror to give.
**Fix:** In the lenient mirror, run the empty-survivor fallback lexically: when no kept path names an existing directory, return `undefined` so `deriveLenientComponentPaths` uses the D-CF1-06 rule. Or record the lenient row as best-effort in the doc comment.

### IN-02: A parent-relative path into the file's own skill stays dead after staging

**File:** `extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts:55-60`
**Issue:** `matchSibling` leaves out the file's own skill on purpose (D-PG4-04). But a staged skill folder is renamed (`a` becomes `demo-a`). So `../a/references/x.md`, written in `skills/a/SKILL.md`, resolves in Claude Code and names a missing folder here. The unit test at `test/domain/skill-sibling-paths.test.ts` ("leaves a path into the own skill of SKILL.md as written") pins the dead path. Rewriting to `../demo-a/references/x.md` would be as safe as the sibling rewrite: the folder exists, and the path resolves into the plugin's own staged tree.
**Fix:** A maintainer question. Either let own-skill matches through (drop the `candidate === ownSkill` exclusion), or list this residual next to D-PG4-06 in the CONTEXT, the docs, or the BACKLOG.

### IN-03: The CHANGELOG says an installed plugin gets the new links and workflow names "at its next update"

**File:** `CHANGELOG.md:16`
**Issue:** `update` materializes again only when the version changes. A plugin with a pinned `version` and an unchanged source reports up to date and keeps its old staged text. The root-source bullet on the line above correctly sends users to `reinstall`, and this bullet does not.
**Fix:** "An installed plugin gets the new links and workflow names when it updates to a new version, or at `/claude:plugin reinstall`."

### IN-04: The restriction note says "the agent can use read, bash, edit, and write" even when that is not true

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts:77-82`, `:113-117`
**Issue:** `restrictsTools` fires for any non-blank `tools`/`disallowedTools`. That includes an agent whose `tools` already allows all four of Pi's built-ins, where nothing is lost. The docs row (`docs/workflows-compatibility.md`, D-PG4-14) also records that the engine **does** remove denied built-ins under `builtin:codemode`, so in that mode the note's last clause is wrong. D-PG4-11 accepts missing notes but not false notes ("a missing note, never a false one").
**Fix:** Word the clause as a possibility ("so the agent may use read, bash, edit, and write"), or skip the note when the agent's `tools` already covers every Pi built-in. Either way, the D-PG4-12 wording is still pending maintainer review.

---

_Reviewed: 2026-11-14T15:00:00Z (iteration 3); 2026-11-14T13:30:00Z (iteration 2); 2026-11-14T12:00:00Z (iteration 1)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
