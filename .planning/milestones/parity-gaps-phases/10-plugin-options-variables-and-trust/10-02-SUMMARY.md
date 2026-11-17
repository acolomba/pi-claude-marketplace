---
phase: 10-plugin-options-variables-and-trust
plan: "02"
subsystem: domain
status: complete
tags: [user-config, options, pi-mcp-adapter, conformance]
requires: []
provides:
  - "domain/user-config.ts: parseUserConfig, resolveOptions, replaceUserConfigReferences, hookOptionVariableName, ownedOptionVariableName"
  - "A1 verdict: an option default exported as serializeLiteral(value, false) comes out of pi-mcp-adapter 7.0.1 raw"
affects: [10-05, 10-10, 10-15, 10-17, 10-19]
tech-stack:
  added: []
  patterns: ["one strict typebox option schema plus small functions for the options rules", "Map/Set results and Object.fromEntries for own-key safety"]
key-files:
  created:
    - extensions/pi-claude-marketplace/domain/user-config.ts
    - test/domain/user-config.test.ts
  modified:
    - test/integration/adapter-expansion-conformance.test.ts
    - .fallowrc.json
decisions:
  - "A malformed option's detail lists every bad field of the first bad option, in declaration order then the missing required fields, so it always starts with the first bad field."
  - "The options-value hidden-character rule uses upstream's EXn pattern verbatim, plus a lone-surrogate check, read from the 2.1.323 binary."
metrics:
  duration: "~45 min"
  completed: 2026-11-15
actuals:
  tokens: 8657
  tasks: 2
  commits: 2
plan_head_before: d2d71d056f811c8d23d6ef74c081db147b9cd0a7
plan_head_after: 47958752a3700174ae9ccdad2dea7e7599af084c
---

# Phase 10 Plan 02: userConfig module and adapter conformance Summary

A pure `domain/user-config.ts` now parses a plugin's `userConfig` against Claude Code 2.1.323's strict schema, resolves defaults into two separate maps (hooks and content, MCP), and names the hook variable and the hashed process variable of an option. The conformance case shows that an escaped option default survives pi-mcp-adapter 7.0.1.

## Stop gate: assumption A1 HOLDS

Plans 10-10, 10-17, and 10-19 may start. With the environment `{<owned name>: serializeLiteral(default, false), PI_CLAUDE_MARKETPLACE_EMPTY: "", PI_CM_SECRET: "leak"}`, the adapter's own `interpolateEnvVars` returned the raw default for all 39 runs: 13 defaults times 3 contexts. No output held `leak`.

- Defaults: `fast`, the empty string, `{env:PI_CM_SECRET}`, `$env:PI_CM_SECRET`, `${PI_CM_SECRET}`, `${PI_CM_SECRET:-x}`, `a{env:PI_CM_SECRET}b`, `!echo pwned`, `~/bin/tool`, `$`, `{`, `$e`, `{en`.
- Contexts, written through `serializeSegments` as text, `ref`, text: bare `${<owned>}`, `--mode=${<owned>}`, and `${<owned>}/x`.
- The owned name matches `^\w+$`.
- Discrimination: when I temporarily exported the raw value instead of `serializeLiteral(value, false)`, the case failed, with outputs `leak`, `--mode=leak`, `aleakb`, and so on. I then restored the file before the commit.
- Pinned fact for plan 10-15: `resolveConfigPath("${<owned>}", env)` with the value `serializeLiteral("~/bin/tool", false)` returns `path.join(os.homedir(), "bin/tool")`. A leading `~/` in an option value is home-expanded in `command`, so the escape does not protect it.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Parse and resolve a plugin's userConfig in one pure module | a2bf9c65 | domain/user-config.ts, test/domain/user-config.test.ts, .fallowrc.json |
| 2 | Prove against pi-mcp-adapter that an escaped option value comes out raw | 47958752 | test/integration/adapter-expansion-conformance.test.ts |

## Red then green

- Task 1 red: I wrote the owner test before the source. `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/domain/user-config.test.ts` gave `ERR_MODULE_NOT_FOUND` for `extensions/pi-claude-marketplace/domain/user-config.ts`, with tests 1, fail 1, and exit 1.
- Task 1 green: 52 tests, 52 pass, exit 0. `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/user-config.ts` exit 0 (100% line, function, and branch). `npm run typecheck` exit 0. `npm run fallow` exit 0. ESLint on the pair exit 0.
- Task 2: `node scripts/install-test-peers.mjs` exit 0. The conformance file gave 66 tests, 66 pass, exit 0, and both D-PG10-23 cases passed. `git diff --quiet PLAN_BASE -- extensions/pi-claude-marketplace/bridges` exit 0.
- Both commits passed the hook, and `npm run check:commit` passed for each.

## Lines for later plans

The exports landed as the contract names them, plus two types the signatures need. fallow's private-type-leak rule requires these types to be exported.

| Export | Shape |
| --- | --- |
| `parseUserConfig(value: unknown): UserConfigParse` | `{ kind: "ok", schema: UserConfigSchema } \| { kind: "malformed", detail: string }` |
| `UserConfigOption` | `Type.Static` of the strict option schema |
| `UserConfigSchema` | `Readonly<Record<string, UserConfigOption>>`, built with `Object.fromEntries` (a `__proto__` key is an own key) |
| `UserConfigParse` | the parse result union (added) |
| `resolveOptions(schema: UserConfigSchema \| undefined): ResolvedOptions` | `declared`, `values`, `mcpValues`, `unsetRequired`, `sensitive` |
| `replaceUserConfigReferences(text, replace: (key, matched) => string): string` | one `replaceAll` pass over `/\$\{user_config\.([^}]+)\}/g` |
| `hookOptionVariableName(key)` | `CLAUDE_PLUGIN_OPTION_` + `key.replaceAll(/[^A-Za-z0-9_]/g, "_").toUpperCase()` |
| `ownedOptionVariableName(address: OwnedOptionAddress)` | `PI_CLAUDE_MARKETPLACE_OPTION_` + the first 16 hex of SHA-256 of `scope\0marketplace\0plugin\0key` |
| `OwnedOptionAddress` | `{ scope: Scope; marketplace; plugin; key }` (added) |

Malformed detail texts (10-05 turns them into a note):

- `userConfig is not an object`
- `userConfig key "<key>" is not an identifier`
- `userConfig option "<key>" is not an object`
- `userConfig option "<key>": <problem>, <problem>, ...`, where a problem is `field "<f>" is not valid`, `field "<f>" is not a known field`, `field "<f>" is missing`, `field "options": <upstream message>`, `field "options" value <i>: <upstream message>`, or `field "default": <upstream message>`. Keys and fields are quoted with `JSON.stringify`.

Example (the abbreviated fixture): `userConfig option "mode": field "title" is missing, field "description" is missing`.

Note for 10-05: the detail lists every bad field of the first bad option, so its length grows with the manifest. If a note needs a bound, truncate it at the resolver.

`.fallowrc.json`: `extensions/pi-claude-marketplace/domain/user-config.ts` is in `entry`, and an `ignoreExports` entry lists all ten exports. Plan 10-19 removes both.

## Parent-owned lines

The parent may record these. This plan did not touch them.

- `10-VALIDATION.md`, Wave 0: both gaps are closed: "`domain/user-config.ts` pair (test/domain/user-config.test.ts, 52 cases, 100% direct coverage)" and "conformance case for assumption A1 (two D-PG10-23 cases in test/integration/adapter-expansion-conformance.test.ts)".
- STATE.md decision: "Assumption A1 holds: pi-mcp-adapter 7.0.1's interpolateEnvVars returns the raw default for an option exported as serializeLiteral(value, false), for 13 defaults in 3 contexts, and leaks no other variable. A leading ~/ is still home-expanded in command."
- STATE.md decision: "A malformed userConfig detail lists every bad field of the first bad option, first bad field first."
- PG-CORE-03: the module only. Wiring lands in 10-05 to 10-19, so do not mark the requirement complete yet.

## Deviations from Plan

1. **[Rule 2 - Completeness] The malformed detail lists all bad fields of the first bad option.** The plan says the detail "names the first bad key or field". My detail starts with that field and then adds the other bad fields of the same option. This keeps the code free of a branch that can never run, and it gives a fuller message. The tests pin the whole detail text.
2. **[Rule 3 - Blocking] Unicode escapes were rewritten.** My first write of the two files put raw U+200B, U+202E, and U+2800 characters where I meant `\u` escapes, and the `forbid-bidi-controls` hook failed. I restored the ASCII escapes, and the hook passed before the commit.
3. **Two type exports were added**, `UserConfigParse` and `OwnedOptionAddress`, because the exported signatures need them.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-10-03: input is read with `Object.entries`, the schema is built with `Object.fromEntries`, the results are `Map` and `Set`, and tests cover `__proto__` and `constructor`. T-10-04: one strict schema plus the options rules; any failure rejects the whole value. T-10-05: the conformance case sets a secret and asserts that no output holds it. When I exported the raw value instead, the case failed. T-10-SC: no package was installed or changed. `node scripts/install-test-peers.mjs` installed only the declared test peers into `node_modules/.cache/optional-peers`.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/user-config.ts
- FOUND: test/domain/user-config.test.ts
- FOUND: a2bf9c65, 47958752 (ancestors of HEAD)
