---
phase: 02-skills
fixed_at: 2026-11-01T12:59:47Z
review_path: .planning/phases/02-skills/02-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-11-01T12:59:47Z
**Source review:** .planning/phases/02-skills/02-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03; fix scope `critical_warning`, so IN-01 and IN-02 were not attempted)
- Fixed: 4
- Skipped: 0

**Where verification ran:** in the isolated worktree `.claude/worktrees/rf-02-*`, with a full copy (`cp -a`, not a link) of the main checkout's `node_modules`. Every npm script and commit ran under the root-sandbox wrapper (`nondac-sh`) with `NODE_OPTIONS=--max-old-space-size=6144`. Each fix ran its own unit file, direct coverage for each touched source-test pair (`scripts/test-coverage-direct.mjs <source>`: complete), `npm run test:modules` (exit 0), and its cucumber feature; the commit hook ran `npm run check:commit` and passed on all four commits. `npx cucumber-js features/skill` ran before the last commit: 59 scenarios, 655 steps, all passed. `npm run check` (the full gate) was not run; it belongs to the phase gate.

## Fixed Issues

### CR-01: The record writer breaks a valid skill whose block scalar holds an indented `---` line, and the plugin install fails

**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts`, `test/bridges/skills/skill-names.test.ts`, `features/skill/frontmatter.feature`
**Commit:** 6218a48
**Applied fix:** `writeSkillRecord` and `withoutRecordNode` now find the closing fence with a local `closingFenceIndex`: the first line after the opening one that starts with `---` at column 0. That is Pi 1.4.0's own rule (`dist/utils/frontmatter.js`: `normalized.indexOf("\n---", 3)`), so it also matches a `----` line the way Pi does. The shared scanner `frontmatter-scan.ts::frontmatterBlockEnd` is unchanged (see Dubious Choices). Added a unit row with a block-scalar description that holds an indented `---`, and the scenario "Installing a skill whose block-scalar description holds an indented rule line installs it". Red proof: without the fix the scenario failed with `cascade | error | false | A plugin operation has failed.` in place of `cascade | info | true`.

### WR-01: An author key `"pi-claude-marketplace":` or `pi-claude-marketplace :` is not removed, and the install fails on a duplicate key

**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts`, `test/bridges/skills/skill-names.test.ts`, `features/skill/frontmatter.feature`
**Commit:** cd7b747
**Applied fix:** parse-and-rewrite instead of a text prefix. `withoutRecordNode` now takes each column-0 line inside the block as the start of a top-level node (its span from `keyValueEnd`), parses that node alone with Pi's `parseFrontmatter`, and removes the node whose parsed key is `pi-claude-marketplace`. A node that does not parse alone (for example an alias of another node's anchor) is treated as not the record. This covers the double-quoted, single-quoted, spaced, and escaped (`"pi-claude-\x6darketplace":`) spellings. Unit rows for the four spellings, a look-alike key that is kept, and the unparseable-alone node; a three-row Scenario Outline "Installing a skill whose frontmatter spells this extension's own key differently installs it". Red proof: without the fix all four unit rows and all three scenario rows failed (install `cascade | error`).

### WR-02: Failures other than the cores' errors escape the input handler, and Pi then sends its own expansion or the literal alias to the model

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts`, `extensions/pi-claude-marketplace/edge/skill-aliases.ts`, `test/orchestrators/skill-invocation.test.ts`, `test/edge/skill-aliases.test.ts`, `features/skill/lifecycle.feature`
**Commit:** b1ea2de
**Applied fix:** `invokeBridgedSkill` now catches a `readFile` or `parseFrontmatter` failure of the staged file and returns `abort` with `Cannot read the skill <typed>: <cause>. Run /reload to load the installed skills again.` The edge's `invoke` is now an `async` function whose `try` turns any other rejection (or a synchronous throw while building the request) into an `abort` with the error's message, so the handler reports through `notifyUsageError` and returns `handled`. A failure to load the alias table returns `continue`: with no table, no alias is known, so the token stays Pi's text, as for any name no skill claims.
**Decision (outcome):** abort and `handled`, never `continue`. Pi's own fallback after a handler throw is the D-CF2-06 path this bridge replaces: Pi re-reads the file in `_expandSkillCommand`, emits a second error on ENOENT, and sends the typed text to the model; on a hand-broken file that Pi still parses, it sends the body with unrun `!` patterns. Upstream has no equivalent state: Claude Code 2.1.316 reads a skill's content when it loads the skill, so a removed file does not change the running session. The closest upstream behavior for a name it cannot run is a local error ("Unknown skill") with nothing sent to the model, which the abort matches. Scenario "Invoking a skill that an uninstall removed before a reload reports the missing file" (uninstall in the running session, then `/skill:demo-greet Ada`). Red proof: without the fix the step failed with two `ENOENT` extension errors (this extension's, then Pi's own `skill_expansion` error) and no usage-error result.

### WR-03: Project-scope staged skills run their `!` commands, and their record's bare aliases take effect, without consulting Pi's project trust

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts`, `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts`, `extensions/pi-claude-marketplace/edge/skill-aliases.ts`, `test/orchestrators/skill-invocation.test.ts`, `test/orchestrators/skill-alias-state.test.ts`, `test/edge/skill-aliases.test.ts`, `features/skill/project-trust.feature` (new), `features/step_definitions/skill/project-trust.steps.ts` (new)
**Commit:** 488472b
**Applied fix:**

- `SkillInvocationRequest` gains `projectTrusted` (the edge passes `ctx.isProjectTrusted()`). A skill whose loaded file is the project-scope staged path aborts before its file is read when the project is not trusted: `The skill <typed> belongs to the project <cwd>, which Pi does not trust. Trust the project folder, then run /reload to use it.` Nothing runs and nothing reaches the model. User-scope skills are unaffected.
- `loadQualifiedSkillAliases(pi, cwd, projectTrusted, deps)` reads the project root only when the project is trusted. The edge caches one table per (trust, cwd) pair and passes the trust to completion too, so an untrusted project's alias is neither completed nor resolved, and reaches the model as typed.
- The loader keeps only the record names install writes for the plugin that `state.json` says owns the staged skill: names that start with `<plugin>:`, and the first bare (colon-free) name. Other names in a record are dropped.
- Unit cases: untrusted project aborts without reading; a user skill still runs in an untrusted project; the loader skips the project root when untrusted but keeps the user scope; out-of-form record names are dropped; the edge passes trust to the alias table and the invocation. Scenarios (Background: a pi settings file, an untrusted profile Pi, a project-scope install of a skill with frontmatter `name: fancy` and body ``Status: !`printf ran; exit 3` ``): "A skill of an untrusted project runs no context command and asks for trust" and "A skill alias of an untrusted project reaches the model as typed". Red proof: without the fix the first scenario reported `Shell command failed for pattern "!`printf ran; exit 3`": ran`, so the repository's command ran in an untrusted project, and the alias scenario sent nothing to the model because the alias ran the same command and aborted.

**Decision (user-visible; settled autonomously):** a project-scope bridged skill runs only when Pi trusts the project. Upstream evidence, Claude Code 2.1.316 (`/opt/claude-code/bin/claude`): the plugin loader reports `project-scope-suppressed-untrusted` with "... skipped because this workspace was not trusted when plugins were scanned. After accepting the trust dialog, run /reload-plugins (or relaunch) to load what qualifies.", and lists the plugin skip reason `untrusted_for_folder`: "its marketplace is declared by this folder's files, which you have not trusted for plugins". So upstream loads no project-scope plugin component before trust. Pi 1.4.0 gates its own `.pi/skills`, `.pi/extensions`, and `.pi/prompts` on the same flag (`core/package-manager.js`, `projectTrusted`) and exposes it as `ctx.isProjectTrusted()`. The divergence that remains (the skill stays listed as `/skill:<name>` and an invocation reports the trust message instead of upstream's absence) is licensed by the Pi gap: this extension's `resources_discover` registers project skills before it can know whether a typed invocation will follow, and gating discovery itself was left out of this fix (see Dubious Choices).

---

_Fixed: 2026-11-01T12:59:47Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
