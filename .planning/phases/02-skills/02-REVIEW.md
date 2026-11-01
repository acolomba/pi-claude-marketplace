---
phase: 02-skills
reviewed: 2026-11-01T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/skills/discover.ts
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
  - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/edge/skill-aliases.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
  - features/lib/pi-tui.ts
  - features/lib/skill-files.ts
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/skill/aliases.steps.ts
  - features/step_definitions/skill/collisions.steps.ts
  - features/step_definitions/skill/frontmatter.steps.ts
  - features/step_definitions/skill/listing.steps.ts
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Structural Findings (fallow)

`fallow audit --base 5fff9c4`: verdict `pass`, 0 dead-code issues, 0 complexity findings, 0 clone groups. `npm run check` passes on this tree. No structural findings.

## Narrative Findings (AI reviewer)

## Summary

I reviewed the skills bridge changes (the stored name record, the D-CF2-03 command shadow, `skills/`-first discovery, and the D-CF1-04 description fallback), the session-time alias loader, the new typed-skill invocation (argument substitution, then `!` injection), and the edge input handler. The order of substitution and injection is correct (T-01-22). An abort returns `handled` and reports only through `notifyUsageError` (T-01-24). Extension input passes through (D-CF2-05). The alias claim rules match D-CF2-02.

The main defect is in the record writer. It finds the frontmatter end with a scanner that treats an indented `---` line as the closing fence. Pi's parser does not. So a skill that Pi parses and that installed before this phase now fails the whole plugin install. I reproduced this against the real `writeSkillRecord`. The writer also does not remove an author key spelled in a form other than the exact `pi-claude-marketplace:` prefix, so the install fails on a duplicate key. The invocation lets non-core errors escape to Pi, which swallows them and falls back to its own expansion. Project-scope staged skills now run their `!` commands without asking Pi whether the project is trusted.

## Critical Issues

### CR-01: The record writer breaks a valid skill whose block scalar holds an indented `---` line, and the plugin install fails

**File:** `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts:184-205` (called from `extensions/pi-claude-marketplace/bridges/skills/stage.ts:365-369`; scanner `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts:13-21`)

**Issue:** `writeSkillRecord` finds the block end with `frontmatterBlockEnd`, which matches any line whose `trim()` is `---`, indented lines included. Pi's `parseFrontmatter` closes the block only at a column-0 `\n---`. So in a frontmatter such as:

```yaml
---
name: review
description: |
  Part one.
  ---
  Part two.
---
```

Pi reads `description` as `"Part one.\n---\nPart two.\n"`, and the skill installed before this phase: `rewriteFrontmatterName` and `augmentSkillDescription` both leave it intact, as I confirmed. The new writer puts the record line before `  ---`, inside the block scalar. The read-back parse then throws `All mapping items must start at the same column` (reproduced with the real module). The throw happens inside `stageSkill`, so `prepareStageSkills` cleans up and rethrows, and the whole plugin install, update, or reinstall fails. The YAML error points at this extension's own generated line, so the author cannot act on it. A horizontal rule in a long block-scalar `description` or `when_to_use` is enough to cause it. This is a regression for a skill that Pi accepts.

**Fix:** Find the closing fence the way Pi does: a line that is exactly `---` at column 0 after the opening line. Use that rule in `writeSkillRecord` and in `withoutRecordNode`. `extractBodyAfterFrontmatter` in `stage.ts` already uses the same rule.

```ts
/** Index of Pi's closing fence: the first later line that is exactly `---` at column 0. */
function recordBlockEnd(lines: readonly string[]): number {
  const index = lines.findIndex((line, i) => i > 0 && line.replace(/\r$/, "") === "---");
  return index === -1 ? lines.length : index;
}
// in writeSkillRecord:
const lines = withoutRecordNode(source, recordBlockEnd(source));
const closing = recordBlockEnd(lines);
```

Add a `skill-names.test.ts` case with an indented `---` inside a block scalar, plus a cucumber row if the listing feature has a frontmatter Outline.

## Warnings

### WR-01: An author key `"pi-claude-marketplace":` or `pi-claude-marketplace :` is not removed, and the install fails on a duplicate key

**File:** `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts:168-176`

**Issue:** `withoutRecordNode` removes an author's record key only when the line starts with the exact text `pi-claude-marketplace:`. YAML also accepts the same key as `"pi-claude-marketplace":`, `'pi-claude-marketplace':`, or `pi-claude-marketplace :`. Pi's parser takes each of these as the same key, so the PARSE-01 gate passes. The writer then appends its own line, and the read-back throws `Map keys must be unique` (reproduced for both the quoted and the spaced forms). The record cannot be spoofed, because the read-back check holds. But the plugin cannot be installed at all, and the error names this extension's line, not the author's key. This affects every staging verb and every cascade that includes the plugin.

**Fix:** Match the key by its YAML spelling, not by a literal prefix:

```ts
const RECORD_KEY_LINE = /^(["']?)pi-claude-marketplace\1\s*:/;
const keyIndex = lines.slice(1, blockEnd).findIndex((line) => RECORD_KEY_LINE.test(line));
```

Another option is to detect `RECORD_KEY in parsed.frontmatter` before writing and report a discovery warning that names the author key.

### WR-02: Failures other than the cores' errors escape the input handler, and Pi then sends its own expansion or the literal alias to the model

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:215-224`; `extensions/pi-claude-marketplace/edge/skill-aliases.ts:142-161`

**Issue:** `readFile` and `parseFrontmatter` run outside the `try`. Any error other than `ContextInjectionError` or `InvocationTooLargeError` propagates, and the edge's `.then` has no `.catch`. Pi's `emitInput` (`core/extensions/runner.js`) catches a handler throw, calls `emitError`, and continues with the original text. Then:

- For `/skill:<gen> args`, Pi's `_expandSkillCommand` runs. If the staged file still parses in Pi's own way, for example after a hand edit that breaks YAML, the model receives the body with its `!` patterns not run and the raw arguments appended. This is exactly the D-CF2-06 path that the bridge exists to replace.
- For an alias (`/demo:review args`, `/fancy args`), the literal alias text goes to the model.

There is a realistic trigger. After `/claude:plugin uninstall`, `disable`, or `update` in this or another Pi process, and before `/reload`, Pi still lists the skill while its staged file is gone or replaced. `readFile` then rejects with ENOENT. The user sees only a generic extension error.

**Fix:** Return a usage-error abort for an unreadable or unparsable staged file. Add a final catch at the edge, so the handler never rejects:

```ts
let parsed: ParsedSkill;
try {
  parsed = parseFrontmatter(await dependencies.readFile(skill.location));
} catch (error) {
  return { kind: "abort", message: `Skill ${request.typed} cannot be read (${errorMessage(error)}); run /reload.` };
}
```

In `invoke`, add `.catch((error) => { reportAbort(ctx, errorMessage(error)); return { action: "handled" }; })`.

### WR-03: Project-scope staged skills run their `!` commands, and their record's bare aliases take effect, without consulting Pi's project trust

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:104-131`, `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts:84-96,138-148`, `extensions/pi-claude-marketplace/edge/skill-aliases.ts:163-189`

**Issue:** Pi 1.4.0 loads `.pi/skills`, `.pi/extensions`, and `.pi/prompts` only when the project is trusted (`package-manager.js:2024-2052`). `ctx.isProjectTrusted()` reports that state. This extension serves `<cwd>/.pi/pi-claude-marketplace/resources/skills/*/SKILL.md` through `resources_discover` whatever the trust state. That exposure existed before this phase. This phase adds deterministic execution on top of it:

- `findBridgedSkill` treats any loaded file at the staged path as installed plugin content. It never checks `state.json`, and it never checks trust.
- `loadQualifiedSkillAliases` takes `names` from the record line of a file under the project root, unchecked. Any string except a reserved command name becomes a bare alias, and the loader does not require the `<plugin>:` prefix that `frontmatterNameAliases` guarantees at install.

So a cloned repository that commits `.pi/pi-claude-marketplace/state.json` and a staged `SKILL.md` can claim bare names such as `review`, `test`, or `commit`. When the user types `/review ...` in an untrusted project, the repository's shell commands run with the user's whole environment. Pi has no permission modes, so nothing asks first (D-CF1-02). The Phase 1 threat model justifies the commands as coming "from the installed plugin". That premise does not hold for files that the user did not install. The hooks bridge has a similar exposure, so this may need a project-level decision rather than a local fix only.

**Fix:** In `findBridgedSkill`, or at the edge, refuse a project-scope skill when `!ctx.isProjectTrusted()`: return `abort` with a message, or `not-bridged`, so that Pi's own expansion runs no command. Skip the project root in `loadQualifiedSkillAliases` under the same condition. At load, keep only record names that are the skill's identity, start with `<plugin>:`, or contain no `:` and match a single frontmatter-derived alias. Record the decision in CONTEXT if the project accepts the risk.

## Info

### IN-01: A `!` command cannot be cancelled by the user

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:190-197`

**Issue:** `runShell` is called without `signal`, although `PromptShellRequest.signal` exists for this purpose. A slow `!` command (a network `git fetch`, or a prompt waiting on stdin) holds Pi's input pipeline until the 120 s timeout. Upstream reports `Shell command interrupted ...` when the user cancels. While Pi is streaming, `ctx.signal` is defined, and it is not passed either.

**Fix:** Pass `ctx.signal` through `SkillInvocationRequest` when it is defined. Record the remaining gap (no abort signal during input handling) in the D-CF2-10 Pi report.

### IN-02: Variable values in the body are not guarded against `!`, so a project path can form an injection pattern

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:134-149`; `extensions/pi-claude-marketplace/bridges/skills/stage.ts:361`

**Issue:** `${CLAUDE_PROJECT_DIR}` (the install cwd, written in at install) and the other path variables go into the body without `guardBangs`. `expandContextInjections` then scans that body. A project directory whose path contains `` !`...` `` after whitespace runs that text. This matches upstream (`FZt` before injection), so it is parity, not a bug. It is listed so the threat model names it.

**Fix:** None needed for parity. If a stricter stance is wanted, guard variable values with `guardBangs` before injection, and record the divergence.

---

_Reviewed: 2026-11-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
