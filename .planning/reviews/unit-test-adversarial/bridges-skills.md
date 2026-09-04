# Bridges — skills

**Scope:** `extensions/pi-claude-marketplace/bridges/skills/` (8 production modules) and `tests/bridges/skills/` (8 test modules)
**Test files reviewed:** 8
**Production modules reviewed:** 8

## Summary

This is one of the strongest areas in the codebase from a unit-testing standpoint. Every test uses real temp directories with `t.after` cleanup, compares complete byte strings (never substrings or re-parsed/normalized values), builds expected values as independent literals rather than by calling the production formatters, and follows the AAA-comment discipline consistently (`stage.test.ts` even uses the sanctioned `// act & assert` merge for its one single-expression case). Test doubles are all `t.mock.method`/`t.mock.timers`-based with correct restore-on-`t.after` (plus the required `syncBuiltinESMExports()` dance for CJS-mocked `node:fs/promises` functions), never hand-rolled objects. Pairing is complete and 1:1 in both directions; `index.test.ts` is a correct same-binding barrel test and `types.test.ts` is a correct type-only test with zero runtime assertions. The frontmatter byte-exactness discipline the assignment asked me to hunt for is fully honored: no test in this area re-parses emitted frontmatter, normalizes it, or calls a production emitter to build its own expected value.

The two themes worth a fixing pass, in priority order: (1) `stage.test.ts` repeats a ~15-line `ResolvedPluginInstallable` object literal 29 times where a single shared factory (the pattern `discover.test.ts` already uses) would remove ~400 duplicated lines; (2) every function-level doc comment across all 8 production files opens with an imperative or noun phrase instead of the Google-style third-person verb phrase — a purely cosmetic, but total and consistent, deviation worth a single repo-wide pass rather than a per-file patch. Neither issue is behavior-affecting; there are no BLOCKER findings in this area.

## Unit test findings

### `tests/bridges/skills/stage.test.ts`

- **[WARNING] Duplicated `ResolvedPluginInstallable` arrange literal across 29 tests** — first instances at `lines 55-66`, `112-123`, `194-205`, `257-268`, `343-354` (29 occurrences total, `grep -c 'satisfies ResolvedPluginInstallable' stage.test.ts` = 29). Every test hand-writes the full object (`installable`, `state`, `name`, `pluginRoot`, `supported`, `unsupported`, `notes`, `componentPaths`, `mcpServers`, `defaultEnabled`), differing only in `componentPaths.skills` and occasionally `supported`/`unsupported`. `discover.test.ts` already solves this for the same type with a local `resolvedPlugin(pluginRoot, skills)` helper (`discover.test.ts:17-30`). Add an equivalent factory at the top of `stage.test.ts` — e.g. `resolvedPlugin(pluginRoot, skillsDirs, overrides?: Partial<ResolvedPluginInstallable>)` — and call it from every test instead of inlining the literal. This removes roughly 400 duplicated lines and makes each test's actual point of variation (the skills paths, or an override) the only visible difference.

### Clean files

- `tests/bridges/skills/discover.test.ts`
- `tests/bridges/skills/frontmatter-degrade.test.ts`
- `tests/bridges/skills/frontmatter-scan.test.ts`
- `tests/bridges/skills/index.test.ts`
- `tests/bridges/skills/rewrite-frontmatter.test.ts`
- `tests/bridges/skills/types.test.ts`
- `tests/bridges/skills/unstage.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/bridges/skills/discover.ts`

- **[WARNING] Method doc opens with an imperative/noun phrase, not a third-person verb phrase** — `line 130` (`discoverPluginSkills`, the module's sole export): "Enumerate skill subdirs in `resolved.componentPaths.skills`..." should read "Enumerates skill subdirs in...". This recurs identically across every function-level doc comment in this bridge; see the grouped note under `stage.ts` below for the full file list. Fix by rewording the opening clause to third person; a repo-wide sweep is more efficient than fixing this module in isolation.

### `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts`

- **[WARNING] Every function doc opens with an imperative/noun phrase, not a third-person verb phrase** — `lines 41, 63, 75, 86, 119, 133, 142, 158` (`synthesizeUnparseableSkill`, `skipFencedBlock`, `collectParagraph`, `firstBodyParagraph`, `foldWhenToUse`, `truncate1536`, `emitSafeDoubleQuotedScalar`, `setDescriptionScalar`). E.g. line 142 "Emit `value` as a safe double-quoted..." should read "Emits `value` as...". All 8 function docs in this file need the same one-word verb-form fix.

### `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts`

- **[WARNING] Both exported function docs open with a noun phrase / conditional clause, not a third-person verb phrase** — `line 12` (`frontmatterBlockEnd`: "Index of the closing `---` fence...") and `line 24` (`keyValueEnd`: "Given a top-level key line at `keyIndex`, return the index..."). Reword to "Returns the index of the closing `---` fence..." and "Returns the index of the last line a top-level key's value spans, given `keyIndex`..." respectively (or similar), matching the third-person-verb-phrase convention.

### `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts`

- **[WARNING] Both function docs open with an imperative phrase, not a third-person verb phrase** — `line 23` (`rewriteNameNode`: "Replace (or insert) the `name` field...") and `line 52` (`rewriteFrontmatterName`, the module's sole export: "Rewrite the `name:` field..."). Reword to "Replaces (or inserts)..." and "Rewrites the...".
- **[WARNING] SKILL-03 backstop throws a plain `Error` with structured data folded into the message string** — `lines 79-83`. The project's own error-handling convention (`CONVENTIONS.md` "Error Handling") requires domain errors to be typed subclasses carrying readonly structured fields, "never encode structured data only in the message string." Here the produced/expected names are interpolated into the message via `JSON.stringify` instead of being carried as fields, and `rewrite-frontmatter.test.ts` (lines 145-197) is forced to assert on the full message text as a result. If this is meant as an internal "should never happen" assertion rather than a caller-facing domain error, a short comment saying so would justify the deviation; otherwise, add a small typed `SkillNameRewriteError extends Error` with `producedName`/`expectedName` fields (mirroring the pattern documented for `StaleSourceCloneError` in `CONVENTIONS.md`) and update the test to assert those fields instead of the composed message.

### `extensions/pi-claude-marketplace/bridges/skills/stage.ts`

- **[WARNING] Every function doc opens with an imperative/noun phrase, not a third-person verb phrase** — `lines 67, 86-96 (comment block), 147, 307, 372, 388` (`extractBodyAfterFrontmatter`, `augmentSkillDescription`, `prepareStageSkills`, `commitPreparedSkills`, `abortPreparedSkills`, `replacePreparedSkills`). The exported-function cases are the most visible: "Phase-1 of the skills bridge two-phase commit..." (line 147) and "Phase-2 of..." (line 307) describe what the function *is* rather than what it *does* in a verb phrase; "Cleanup-only counterpart to commit..." (line 372) and "Reinstall-safe replacement helper..." (line 388) are the same pattern. This is the same file-wide issue as `discover.ts`/`frontmatter-degrade.ts`/`frontmatter-scan.ts`/`rewrite-frontmatter.ts`/`unstage.ts` above — a single repo-wide documentation-register pass would fix all of them together; note the summary calls this out as a cross-cutting theme rather than a per-file defect.
- **[WARNING] Inline `randomUUID()` is a hidden, un-injected dependency** — `lines 192, 399` (`prepareStageSkills`'s staging-root path, `replacePreparedSkills`'s backup-root path). Per the testability-design checklist, an inline `randomUUID()` call is a hidden dependency; the sanctioned fix is to make it an explicit parameter (e.g. an injected `generateId(): string`, defaulted to `randomUUID` only at the real call site) or a dependencies-object member. In practice this does not currently block or weaken any test — nothing asserts on the generated path, tests always read it back from `prepared.stagingRoot` — so this is a forward-looking design note, not something the existing suite is straining against today.
- **[WARNING] `type` alias of an object literal where `interface` belongs** — `line 55` (`type SkillsReplacementInternals = Readonly<{ backupRoot: string; backups: readonly {...}[]; renamed: readonly {...}[] }>;`). Per the style guide, object shapes are declared with `interface`, not a `type` alias wrapping an object literal (the `Readonly<>` wrapper doesn't change that this is an object-literal shape, not a union/utility composition). Rewrite as `interface SkillsReplacementInternals { readonly backupRoot: string; readonly backups: readonly {...}[]; readonly renamed: readonly {...}[]; }`, matching the individually-marked-`readonly`-field convention already used throughout `types.ts`.

### `extensions/pi-claude-marketplace/bridges/skills/unstage.ts`

- **[WARNING] Method doc opens with a noun phrase, not a third-person verb phrase** — `line 17` (`unstagePluginSkills`, the module's sole export): "Per-name `rm({recursive:true})` loop. Names are validated with..." should open with something like "Removes previously-staged skill directories by name, validating each with...". Same file-wide theme as the other five files above.

### Clean files

- `extensions/pi-claude-marketplace/bridges/skills/index.ts`
- `extensions/pi-claude-marketplace/bridges/skills/types.ts`
