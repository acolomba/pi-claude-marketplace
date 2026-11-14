---
phase: 04-skill-and-workflow-install-defects
fixed_at: 2026-11-14T06:24:43Z
review_path: .planning/phases/04-skill-and-workflow-install-defects/04-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 6
skipped: 1
status: partial
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-11-14T06:24:43Z
**Source review:** .planning/phases/04-skill-and-workflow-install-defects/04-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 7 (scope `all`: WR-01..03 and IN-01..04)
- Fixed: 6
- Skipped: 1 (WR-01, the code already matches Claude Code 2.1.323)

The run was autonomous. Every orchestrator decision below is **pending maintainer review**.

## Where verification ran

Every check ran in the main checkout `/home/acolomba/src/pi-claude-marketplace-gaps` on `features/gaps`, with no worktree. The results can be reproduced from that tree. Node v26.13.1. Each test used a hermetic home (`test/platform/isolated-pi-home.ts`, `withHermeticHome`, the cucumber sandbox). The full `npm run check` was not run, as instructed.

## Fixed Issues

### WR-02: A traversal in a root-source entry's `skills` makes the whole plugin `unavailable`

**Files modified:** `extensions/pi-claude-marketplace/domain/component-paths.ts`, `test/domain/component-paths.test.ts`, `test/orchestrators/plugin/info.test.ts`, `features/skill/root-source-entries.feature`
**Commit:** b5c7dc4a
**Status:** fixed: requires human verification (a logic change)
**Applied fix:** This is the parity option, reviewer option 1. In the root-source arm, a listed path refused as a traversal (absolute or escaping) is dropped. It adds no note and does not set the refusal flag, so the plugin stays installable. The surviving listed folders load. When only traversals are listed, no skill path is collected and the plugin loads with no skills. A listed value that is not a string still adds its note and marks the plugin, and so does a refused `plugin.json` path (D-CF1-06). T-04-01 still holds: the owner case "the stat reader receives no refused listed path" now expects `dirty: false` and no notes. The stat reader still gets only `skills/a` plus the three conventional folders.

- The traversal branch (`else if (!listed.some(... "traversal"))`) was **not** removed. The orchestrator asked for that removal, but it applied only to the reviewer's fail-closed option 2. With the parity option, the branch is live: it is the "only traversals listed, so no skills" arm. The scenario "Info on a root-source entry whose only listed path escapes lists no skills" covers it (`available`, no skills row).
- Scenario changes in `root-source-entries.feature`:
  - The scenario at `:222` now expects `available` with no reasons and `skills: a`.
  - New: "Installing a root-source entry with an escaping listed path stages the listed skills inside the plugin".
  - New: "Info on a root-source entry whose only listed path escapes lists no skills".
  - Red before the fix: 11 scenarios, 3 failed (`unsupported source` and `unavailable` where `available` was expected; the install was refused). Green after: 11 of 11 passed.
- Four lenient-listing owner cases in `info.test.ts` depended on the escape note to make the plugin unavailable. A malformed `hooks/hooks.json` (`breakRootHooks`) now makes them unavailable. Their reason is now `unsupported hooks`, and a listed root now also lists `hooks`.
- Upstream evidence (2.1.323 binary): the root-source block's error sink `it` is local and is read only for `gt`. The later `_Ao` pass reports a refused path in the plugin's error list, but the plugin is still returned and loads.
- **Residual (maintainer question):** Pi now drops the refused path silently. Claude Code reports a `path-traversal` load error for it. A warning here would need a typed resolver field and two install and update spread sites, as `shadowedFolders` has. The plain note was not kept: on an installable plugin it shows nowhere, and on a partially-available plugin it would add `{unsupported source}` to the refusal reasons.

### WR-03: `containedRelativePath` depends on the process cwd

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, `test/orchestrators/plugin/info.test.ts`, `features/skill/root-source-entries.feature`
**Commit:** 17bd223c
**Applied fix:** `path.relative(".", declared)` is replaced by `path.normalize(declared)`, with one trailing separator removed. The test is now lexical and does not use the cwd. Two owner cases were added:

- `"../<basename of process.cwd()>/skills/b"` is refused.
- With `process.chdir` to the filesystem root (restored in `finally`), `"../skills/b"` and `"skills/../../skills/c"` are refused.

Both cases failed on the old code and pass on the new code. New scenario: "Info on an unavailable root-source entry does not list a listed path that climbs back through the working directory". It lists `../project/skills/b`, because Pi's cwd in the harness is `<sandbox>/project`. Red: `a, b` where `a` was expected. Green after the fix.

### IN-01: The lenient `info` listing keeps listed paths that the strict rule would drop

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, `test/orchestrators/plugin/info.test.ts`, `features/skill/root-source-entries.feature`
**Commit:** 0e914540
**Status:** fixed: requires human verification (a logic change)
**Applied fix:** `info` can check the disk on this arm, so the gap was fixed rather than documented. `buildNotInstallablePathRowFields` now takes a `resolveComponents(pluginRoot)` function. The partially-available arm passes its resolved payload. The unavailable arm derives the lenient paths after the plugin root is known, inside the row builder's existing `try`, so a probe EACCES is still classified.

- `rootSourceLenientSkillPaths` is now async. It probes each kept, lexically contained listed path with `reader.listDirectory`, through the new `readEntriesOrMissing`. `readEntriesOrEmpty` now delegates to it, so there is no clone.
- When no kept path is a directory, the result depends on the listed paths. If one was absolute or escaping, nothing is listed. Otherwise the result is `undefined`, so the D-CF1-06 rule applies, as the strict fallback does.
- A refused path still never reaches a read (T-04-03).
- The recording-reader cases now show the probe reads before the composition reads.
- Two cases were added: listed folders that are missing or are files fall back to `skills/`, and a missing folder beside an escaping path lists nothing.
- New scenario: "Info on an unavailable root-source entry whose listed folders are all missing lists the skills folder". Red: no skills row. Green: `a, b`.
- **Remaining difference:** the strict arm checks containment by realpath (`assertPathInside`). The lenient arm checks it lexically. A listed symlink that leaves the plugin is refused at install, but the lenient listing still reads it. This difference existed before this fix, and the fix does not widen it.

### IN-02: A parent-relative path into the file's own skill stays dead after staging

**Files modified:** `docs/research/parity-gaps/skills-commands.md`
**Commit:** 246e0e06
**Applied fix:** The repository has no skills compatibility page. Only the CHANGELOG line and the research record describe sibling links. So the residual is recorded as a "Residual" bullet in the SKILL-04 section of the research record, as a maintainer question. No code was changed.

### IN-03: The CHANGELOG says the new links arrive "at its next update"

**Files modified:** `CHANGELOG.md`
**Commit:** f104b67e
**Applied fix:** The bullet now reads: "An installed plugin gets the new links and workflow names when it updates to a new version, or at `/claude:plugin reinstall`."

### IN-04: The restriction note says the agent can use read, bash, edit, and write when that is not true

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts`, `extensions/pi-claude-marketplace/bridges/agents/convert.ts`, `extensions/pi-claude-marketplace/bridges/agents/index.ts`, `test/orchestrators/plugin/discover-names.test.ts`, `test/bridges/agents/convert.test.ts`, `test/bridges/agents/index.test.ts`, `test/orchestrators/plugin/{install-outcome,update-swap,info}.test.ts`, `features/workflow/agent-restrictions.feature`, `docs/workflows-compatibility.md`, `.planning/upstream/pi-dynamic-workflows-agent-tool-restriction.md`, `CHANGELOG.md`
**Commit:** 84c69fe5
**Status:** fixed: requires human verification (a logic change, and D-PG4-12 wording)
**Applied fix:**

- Engine check, source-read at 3.15.0 in `node_modules/.cache/optional-peers/node_modules/@quintinshaw/pi-dynamic-workflows/src/agent.ts:1237-1263`. With `builtin:codemode`, the engine pushes every built-in that the policy does not permit (`read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find`, `ls`), and every denied name, into `excludeTools`. So under codemode the note was false, and the sentence is now qualified.
- New note text, built by the one `restrictionNote` that install, update, and `info` share:

  ```text
  workflow script "scan.js" in "workflows" runs agent type "demo:reader", which restricts its tools; outside codemode the workflow engine does not keep that restriction, so the agent can use bash, edit, and write
  ```

- The list holds the built-ins among read, bash, edit, and write that the agent's `tools` does not allow, plus the ones its `disallowedTools` denies. `Intl.ListFormat("en")` joins them. An absent or blank `tools`, or one that lists `*`, allows every tool. Claude Code's built-in agents use `tools: ["*"]` (2.1.323 binary). An agent whose restriction keeps all four built-ins gets no note.
- The bridge's D-CF4-08 splitter is exported as `listedToolNames` from `bridges/agents/convert.ts` and the agents barrel, so the note parses `tools` the way staging does: commas, whitespace, inline arrays, and `Tool(spec)`.
- **Interpretation to confirm:** the orchestrator wrote "that the agent's `tools` does not allow". I also counted `disallowedTools` denials. Without them, an agent with only `disallowedTools: Bash`, which loses `bash` under the engine, would get no note.
- Scenarios: the three existing scenarios now carry the new text. A new scenario, "Installing a plugin whose workflow runs an agent that allows every Pi built-in tool gives no note", was added. Red: 4 of 4 failed. Green: 4 of 4 passed.
- The docs row now says the loss holds outside codemode, and that the note names only the tools among `read`, `bash`, `edit`, and `write` that the agent type does not allow, with no note when it allows all four. The draft gained one line on what the install note reports. Its request body was already accurate, because it says "unless codemode is on". The CHANGELOG bullet now ends "outside codemode".

## Skipped Issues

### WR-01: A listed plugin root is collected as a skills path

**File:** `extensions/pi-claude-marketplace/domain/component-paths.ts:571-585` (and `info.ts` `rootSourceLenientSkillPaths`)
**Reason:** The code context differs from what the review describes. The current code already matches Claude Code 2.1.323, which the orchestrator gave as the goal of this fix. The review read only the root-source block (`Dt=rt.filter(... ln!==wt&&ln!==Tt)`). That block does leave the root out of `skillsPaths`. But in every loading arm, 2.1.323 then runs `_Ao`, which processes `entry.skills` again:

- No `plugin.json` (`!Ne`): assign mode, `e.skillsPaths=ne`.
- `strict` with a `plugin.json`: append mode.

In both arms, `ne` is the surviving listed paths filtered by `qp(Ee)!==qp(ff(r,"skills"))`. Only the `skills/` folder is removed, so a listed root is a skills path again. Upstream's loader (`qTn`) then reads the root as one skill when it holds `SKILL.md`, and otherwise reads each top-level folder that holds `SKILL.md`. The skills bridge does the same through `isSelfSkillDir`. Upstream's path-error text also points authors at the root: "point to the plugin root '.' instead".

So the strict `[".", "skills"]` matches upstream's `skillsPath: skills/` with `skillsPaths: [root]`. The requested change would create a divergence that no recorded decision and no Pi capability gap licenses. Per AGENTS.md "Upstream parity", this goes to the maintainer as a question. No code was changed, and the unit cases that pin `[".", "skills"]` stay.

- Related and not changed: for a listed root with no `SKILL.md`, `info` lists every top-level folder (`.claude-plugin`, `hooks`, `skills`, ...). This follows `discoverComponentNames`'s existing policy ("`isSkillDir` filtering is bridge-layer only -- info surfaces authoring intent"), which applies to every skills path.

**Original issue:** In 2.1.323 a listed root or a listed `skills/` keeps the `skills/` folder, and `skillsPaths` holds only the other listed paths, so upstream never scans the root itself.

## Decisions pending maintainer review

1. WR-01 skipped, because the 2.1.323 second pass keeps a listed root as a skills path. Confirm whether parity is wanted here, or whether the orchestrator's reading stands, which would need a recorded divergence.
2. WR-02 parity: a refused listed path is dropped with no note and no warning. Should a warning (a typed field like `shadowedFolders`) mirror upstream's `path-traversal` load error?
3. WR-02: the traversal branch is kept, because it is now the observable "no skills" arm.
4. IN-01: the probe reads each kept listed directory twice (once to probe, once to list names).
5. IN-02: whether to rewrite own-skill `../a/...` paths to `../<plugin>-a/...`.
6. IN-04: `disallowedTools` counts toward the note. `*` allows every tool. The new D-PG4-12 wording names the tools the agent gets anyway and adds "outside codemode".

## Parent lines

- **PROJECT.md / D-PG4-01 (WR-02):** add to the D-PG4-01 exception text: "A listed path refused as a traversal (absolute or escaping) is dropped and never read. The surviving listed folders load, or, when every listed path is refused, the plugin loads with no skills. The plugin stays installable, as in Claude Code 2.1.323." The CONTEXT clause "the plugin installs no skills" is now observable as written.
- **04-01-SUMMARY.md (not edited):** these statements are out of date after b5c7dc4a. A2 says "both make the plugin unavailable at install", and the flagged assumptions say the "no listed path survives" arms "cannot be reached by an install". A refused listed path no longer makes the plugin unavailable.
- **04-02-SUMMARY.md (not edited):** these statements are out of date after 17bd223c and 0e914540. `containedRelativePath` is now `path.normalize`-based. Deviation 3 ("the lenient mirror is lexical and has no stat, so it keeps a missing listed path") no longer holds: the lenient mirror probes directories and falls back to D-CF1-06.
- **D-PG4-12 wording:** the note now reads "...which restricts its tools; outside codemode the workflow engine does not keep that restriction, so the agent can use <the built-ins it gets anyway>". There is no note when it would name none.
- **BACKLOG candidate:** the WR-02 dropped-path warning (decision 2), if the maintainer wants it.

---

_Fixed: 2026-11-14T06:24:43Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
