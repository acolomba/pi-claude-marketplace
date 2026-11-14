---
phase: 04-skill-and-workflow-install-defects
reviewed: 2026-11-14T12:00:00Z
depth: standard
iteration: 1
reviewed_range: e739fcfa..852b033f
files_reviewed: 33
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/domain/component-paths.ts
  - extensions/pi-claude-marketplace/domain/skill-sibling-paths.ts
  - extensions/pi-claude-marketplace/domain/skill-tokens.ts
  - extensions/pi-claude-marketplace/domain/workflow-script.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - features/lib/published-marketplace.ts
  - features/lib/upstream/index.ts
  - features/lib/upstream/workflows.ts
  - features/skill/root-source-entries.feature
  - features/skill/sibling-links.feature
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/workflow/runs.steps.ts
  - features/workflow/agent-restrictions.feature
  - features/workflow/references.feature
  - test/bridges/skills/stage.test.ts
  - test/domain/component-paths.test.ts
  - test/domain/skill-sibling-paths.test.ts
  - test/domain/skill-tokens.test.ts
  - test/domain/version.test.ts
  - test/domain/workflow-script.test.ts
  - test/orchestrators/plugin/discover-names.test.ts
  - test/orchestrators/plugin/info.test.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - test/orchestrators/plugin/update-swap.test.ts
  - CHANGELOG.md
  - docs/workflows-compatibility.md
  - .agents/skills/cucumber/rules/world-and-stand-ins.md
  - .fallowrc.json
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
  necessity: 0
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-11-14T12:00:00Z
**Depth:** standard
**Iteration:** 1
**Files Reviewed:** 33
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

_Reviewed: 2026-11-14T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
