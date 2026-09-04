# Domain — component schemas

**Scope:** `tests/domain/components/{hook-events,hook-if-targets,hook-tool-names,hooks,mcp,plugin}.test.ts`
paired with `extensions/pi-claude-marketplace/domain/components/{hook-events,hook-if-targets,hook-tool-names,hooks,mcp,plugin}.ts`
**Test files reviewed:** 6
**Production modules reviewed:** 6

## Summary

All six production modules are paired 1:1 with a test module — no pairing gap, no BLOCKER on
coverage. `hook-events.test.ts`, `hook-if-targets.test.ts`, and `hook-tool-names.test.ts` model
their closed sets well: every enumerable table is asserted whole with `assert.deepStrictEqual()`,
and every exported type gets a `satisfies` / `@ts-expect-error` pair. The one systemic problem is
`plugin.test.ts`: every rejection case for both `PLUGIN_ENTRY_VALIDATOR` and
`PLUGIN_MANIFEST_VALIDATOR` (32 sibling cases across 7 loops) asserts only the `.Check()` boolean,
never the validator's structured `.Errors()` output — exactly the anti-pattern this sweep was
asked to hunt for, and a real gap: a validator that rejects for the *wrong* structural reason
still passes every one of these cases. `hook-tool-names.test.ts` has one fabricated case that
tests hand-rolled lookup logic living only in the test file, not any exported production
function. `hooks.test.ts` is otherwise solid (its `parseHooksConfig` result assertions are
exhaustive and well-built) but is organized flat where its siblings group by entry point, and its
JSON fixtures live in the whole-suite `tests/fixtures/` dumping ground rather than beside this
concern. A fixing pass should prioritize, in order: (1) plugin.test.ts's boolean-only rejects,
(2) the fabricated inverse-lookup case in hook-tool-names.test.ts, (3) the hooks.test.ts structure
and fixture-location cleanups.

## Unit test findings

### `tests/domain/components/plugin.test.ts`

- **[BLOCKER] Every validator rejection case asserts only the `.Check()` boolean, never the
  structured error** — `lines 155–169, 171–182, 184–201, 203–214` (`PLUGIN_ENTRY_VALIDATOR`) and
  `lines 280–291, 293–310, 312–323` (`PLUGIN_MANIFEST_VALIDATOR`); 7 loops, 32 sibling `test()`
  cases total, e.g. `rejects an entry without its ${missingField}`, `rejects the non-record value
  ...`, `rejects ${JSON.stringify(pluginEntry)}`, `rejects the MCP declaration ...`. Every one of
  these does only:
  ```ts
  const isValid = PLUGIN_ENTRY_VALIDATOR.Check(incompletePluginEntry);
  assert.strictEqual(isValid, false);
  ```
  A validator that rejects the input for a completely unrelated reason (wrong error path, wrong
  message, or one that happens to reject *everything*) passes every one of these cases — the
  compiled TypeBox validator's real diagnostic surface, `.Errors(value)`, is never touched. This
  file's sibling `domain/components/hooks.ts` already establishes the pattern to copy:
  `firstHookValidationDetail` in that module calls `HOOKS_VALIDATOR.Errors(value)` and formats the
  first error's `instancePath`/`message`. Fix: for every reject case in this file, alongside (or
  instead of) the `.Check()` boolean, pull `PLUGIN_ENTRY_VALIDATOR.Errors(candidate)` (or
  `PLUGIN_MANIFEST_VALIDATOR.Errors(candidate)`), take the first entry, and
  `assert.deepStrictEqual({ instancePath: first.instancePath, message: first.message }, {...})`
  against the exact expected path/message for that row (TypeBox's compiled-validator messages are
  deterministic for a pinned dependency version, so this is safe to hardcode once run once to
  observe the exact text — unlike the native-`JSON.parse` message case in `hooks.test.ts`, which
  is legitimately version-dependent). Apply the same treatment to all 7 loops; this is one
  systemic defect, not seven independent ones.
- **[WARNING] `mcp.test.ts` shows the correct contrast** — no location, informational: the sibling
  `mcp.test.ts` reject loop (its own file, lines 63–96) already asserts a structured error shape
  via `assert.throws` with `constructorName`/`name`/`message`. Use it as the template for the fix
  above; it is the one file in this batch that gets the accept/reject asymmetry right.

### `tests/domain/components/hook-tool-names.test.ts`

- **[BLOCKER] A test re-implements the production lookup instead of calling it** — `lines 55–71`,
  the `for (const { suppliedToolName, expectedPiToolName } of [...])` loop under
  `describe("CLAUDE_TO_PI_TOOL_NAMES")`, titled `` `passes ${JSON.stringify(suppliedToolName)}
  through an inverse lookup` ``. The "act" step is:
  ```ts
  const piToolName =
    (CLAUDE_TO_PI_TOOL_NAMES as Readonly<Record<string, string>>)[toolName] ?? toolName;
  ```
  `hook-tool-names.ts` exports no Claude→Pi lookup-with-fallback function — only the raw
  `CLAUDE_TO_PI_TOOL_NAMES` object (already fully covered by the `deepStrictEqual` test at line
  36) and the one-directional `mapPiToClaudeToolName`. This case writes its own copy of a
  hypothetical consumer's fallback expression and then asserts that expression against itself; all
  three rows (`""`, `"bash"`, `"mcp__server__tool"`) miss the map on purpose and hit the `??`
  fallback, so the case only proves that indexing a plain object with an absent key and falling
  back with `??` returns the fallback — native JS semantics, not anything `hook-tool-names.ts`
  owns. A wrong implementation of the real production code cannot fail this case because no real
  production code runs in it. Fix: delete this loop. If the Claude→Pi inverse-lookup-with-fallback
  behavior is genuinely load-bearing production logic (e.g. duplicated inline at a bridge call
  site), export it from `hook-tool-names.ts` as a named function (mirroring
  `mapPiToClaudeToolName`) and test *that* function here instead.

### `tests/domain/components/hooks.test.ts`

- **[WARNING] No `describe()` grouping despite three tested entry points** — `lines 21–383`. Every
  other file in this directory (`hook-events.test.ts`, `hook-if-targets.test.ts` excepted since it
  has one entry point, `hook-tool-names.test.ts`, `plugin.test.ts`, `mcp.test.ts`) groups its cases
  under `describe(<exportName>, ...)`. This file tests three exported functions
  (`parseHooksConfig`, `projectHookSummaryEntries`, `hookSummaryEntriesFromPersisted`) as one flat
  sequence of ~20 `test()` calls. Wrap the `parseHooksConfig` cases (lines 21–312, plus 314–383)
  in `describe("parseHooksConfig", ...)`, and the two projection tests (lines 210–229, 231–248) in
  their own `describe()` blocks, for consistency with the rest of the directory.
- **[WARNING] Fixture JSON files live in the whole-suite dumping ground, not beside this concern**
  — `line 19` (`FIXTURE_DIR`) and the `readFile` calls at `lines 252–255, 316–319, 335–338,
  361–364`. All four fixtures (`hookify-hooks.json`, `hooks-notification-only.json`,
  `hooks-posttooluse-and-notification.json`, `hooks-pretooluse-matcher-mix.json`) resolve to
  `tests/fixtures/`, a top-level directory also used by `tests/domain/resolver.test.ts`,
  `tests/orchestrators/import/marketplaces.test.ts`, `tests/orchestrators/plugin/info.test.ts`,
  and `tests/e2e/import-command.test.ts` — a generic shared dumping ground, not a directory scoped
  to the hooks-parsing concern. Move these four files to a location beside this test (e.g.
  `tests/domain/components/hooks-fixtures/`) and update the four `path.resolve` calls. Coordinate
  with any other reviewer touching `tests/fixtures/` before moving, since the directory is shared.
- **[WARNING] One test asserts three unrelated behaviors at once** — `lines 109–171`,
  `test("parseHooksConfig keeps supported handlers, drops rejected groups and handlers, and
  compiles if fields", ...)`. The title names three separate behaviors (keeping a supported
  handler, dropping an unsupported handler/group, compiling an `if` field) in one case built over
  one large hand-assembled fixture. The final `deepStrictEqual` is exhaustive and not weak, so this
  is a structure/readability finding, not a correctness one: split into
  `parseHooksConfig keeps a handler with a passing if field`,
  `parseHooksConfig drops an unsupported handler type`,
  `parseHooksConfig drops a regex matcher group`, and
  `parseHooksConfig compiles the if field only for a supported handler` (or similar), each with its
  own minimal fixture, so a future failure names the one behavior that broke.
- **[WARNING] Partial regex match on a non-deterministic message** — `line 82`,
  `assert.match(result.reason, /^hooks\.json is not valid JSON: /);` inside `test("parseHooksConfig
  rejects invalid JSON", ...)`. Every other reject case in this file (lines 65, 105, 195, 261, 325,
  344, 370 [`deepStrictEqual` calls]) asserts the complete `{ ok: false, reason }` value; this one
  only checks a prefix. This is defensible — the suffix is `JSON.parse`'s own native error text,
  which is Node/V8-version-dependent and not something the production module controls — but note
  it explicitly (e.g. a one-line comment) so a future reader does not "fix" the inconsistency by
  copying the boolean-only pattern from `plugin.test.ts` instead of understanding why this one
  case is partial by necessity.

### `tests/domain/components/hook-events.test.ts`

- **[WARNING] Expected filter criterion is derived from the production module's own export** —
  `line 68`, `const toolEventMembers: ReadonlySet<string> = new Set(TOOL_EVENTS);` inside
  `test("retains tool events in their admitted-event relative order", ...)`. The final assertion
  (`assert.deepStrictEqual(events, expectedEvents)`) still compares against an independent
  hardcoded literal, so the case is not vacuous — but the membership set used to filter
  `BUCKET_A_EVENTS` is built from `TOOL_EVENTS`, a value the module under test also exports, rather
  than from an independently written `Set(["PreToolUse", "PostToolUse", "PostToolUseFailure"])`
  literal. Prefer the literal Set so this case's only production input is `BUCKET_A_EVENTS`,
  matching the "expected values built independently" rule.

### `tests/domain/components/hook-if-targets.test.ts`

- **[WARNING] Vacuous uniqueness assertion** — `line 43`,
  `assert.strictEqual(new Set(prefixes).size, prefixes.length);` inside `test("publishes unique
  permission prefixes in matching precedence", ...)`. `prefixes` comes from `Object.keys()` on a
  JS object literal, which cannot contain duplicate keys by construction — no implementation of
  `IF_PREFIX_TARGETS` can make this assertion fail. The preceding `assert.deepStrictEqual(prefixes,
  expectedPrefixes)` in the same test already does the real work (order + membership). Remove the
  uniqueness line.

### Clean files

- `tests/domain/components/mcp.test.ts` — both the schema-shape check and the accept/reject
  `MCP_SERVERS_VALIDATOR` loops are structured correctly; the reject loop already asserts
  `constructorName`/`name`/`message`, not a boolean or a substring.

## Production code findings

### `extensions/pi-claude-marketplace/domain/components/hooks.ts`

- **[WARNING] `hookDebugLog` is an imported singleton invoked directly from `parseHooksConfig`** —
  `line 45` (import), called at `lines 246, 260`. Per the testability checklist this is the
  "imported singleton" hidden-dependency shape rather than an injected port. In isolation this
  would suggest making the debug sink an explicit parameter. Given `shared/debug-log.ts::
  hookDebugLog` is a project-wide sanctioned side-channel (IL-3/OBS-01, documented in
  ARCHITECTURE.md as "distinct from user-facing notify()") called the same way from many modules
  across the bridge/hooks tree, and its own behavior is never asserted here (correctly — log calls
  are only asserted in a module whose job is logging), treat this as a low-priority note rather
  than something this fixing pass should refactor in isolation; a repo-wide change to that seam is
  out of scope for one module.

### `extensions/pi-claude-marketplace/domain/components/mcp.ts`

- **[WARNING] Inconsistent per-export documentation in a two-export file** — `line 13`.
  `MCP_SERVERS_SCHEMA` has no JSDoc of its own, while the very next export, `MCP_SERVERS_VALIDATOR`
  (`line 15`), has `/** JIT-compiled validator (D-07). Use \`.Check(value)\` or \`.Parse(value)\`.
  */`. The file-level header explains the schema's purpose, but since the sibling export gets its
  own line, add a one-line JSDoc above `MCP_SERVERS_SCHEMA` too (e.g. describing it as the
  string-keyed, value-opaque object schema) for consistency within the same four-line export
  block.

### Clean files

- `extensions/pi-claude-marketplace/domain/components/hook-events.ts`
- `extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts`
- `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts`
- `extensions/pi-claude-marketplace/domain/components/plugin.ts`

## Not covered

- `hooks.ts` re-exports `parseMatcher`/`ParsedMatcher` (from `./hooks/matcher.ts`),
  `HOOKS_CONFIG_SCHEMA`/`HOOKS_VALIDATOR`/`HookHandlerEntry`/`HooksConfig` (from
  `./hooks/schema.ts`), and `DroppedHook` (from `./hooks/partition.ts`). Whether those bindings are
  exercised anywhere through this specific re-export path (as opposed to being imported directly
  from their origin files) was not checked — that would require reading
  `tests/domain/components/hooks/**`, which this assignment explicitly excludes.
- The `hooks/partition.ts`, `hooks/schema.ts`, and `hooks/matcher.ts` production modules
  themselves were not reviewed (out of scope: not directly under `domain/components/`).
- I did not run `node --test`, `npm run typecheck`, or any coverage tool against these files, per
  the diagnostic-review constraint; all findings are from static reading.
