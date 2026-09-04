# Shared — soft dependencies and hooks concern

**Scope:** `extensions/pi-claude-marketplace/shared/concerns/*.ts` and their paired
tests under `tests/shared/concerns/`
**Test files reviewed:** 2
**Production modules reviewed:** 2

## Summary

Both pairs are clean and, for `soft-dep.ts`, exemplary: `soft-dep.test.ts` runs
the full 2×2×2×2 truth table over `declaresAgents` / `declaresMcp` /
`piSubagentsLoaded` / `piMcpAdapterLoaded` (16 rows, one `test()` each), every
title was checked by hand against its row and matches, and every assertion is
a `deepStrictEqual` against a hand-written expected array. `hooks.test.ts`
achieves full branch coverage of `appendHooksBlock`'s three-arm discriminated
union, including a genuinely sharp case (`distinguishes an absent lenient
matcher from an empty matcher`) that would catch a falsy-check regression an
`entry.matcher === undefined` check does not have. The soft-dep hermeticity
risk named in the assignment brief does not apply here: `softDepMarkers`
already takes the `SoftDepStatus` probe as a plain data parameter, so the test
constructs literal objects and never touches `node_modules` resolution — the
disease in the two global-npm-root integration tests lives in
`tests/integration/{skill-path-resolution,provenance-invisibility}.test.ts`
against `platform/pi-api.ts`'s real probe functions, outside this module and
outside this sweep's glob. `hooks.ts` here is confirmed distinct from
`bridges/hooks/`; the only other repo references to this module are a
grep-based architecture guard and a comment in `orchestrators/plugin/info.test.ts`,
neither of which re-tests its behavior. The only findings are two minor
production-style items in `hooks.ts` (an `| undefined` parameter that could be
`?`, and a documentation block that reads as an implementation note where the
guide asks for JSDoc on a public type).

## Unit test findings

### Clean files

- `tests/shared/concerns/soft-dep.test.ts`
- `tests/shared/concerns/hooks.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/shared/concerns/hooks.ts`

- **[WARNING] `| undefined` parameter instead of an optional parameter** —
  `line 111` (`entries: readonly HookSummaryEntry[] | undefined`). The style
  guide prefers `name?: Type` over `Type | undefined` for optional values.
  `exactOptionalPropertyTypes` does not affect function parameters (only
  object properties), so changing the signature to
  `entries?: readonly HookSummaryEntry[]` compiles and still accepts an
  explicit `undefined` argument at call sites — no test or caller needs to
  change. Do this rename; it also brings the parameter in line with the
  sibling `hooks?: readonly HookSummaryEntry[]` optional field on
  `PluginInfoComponentsResolved` in `notify.ts:1520`, which already uses `?`.

- **[WARNING] Public-type documentation written as an implementation-note
  block instead of JSDoc** — `lines 12-55`. This `//`-style block explains
  `ClaudeHookEvent` and `HookSummaryEntry`'s public shape and how a consumer
  should read the three `HookSummaryEntry` arms — that is "what a user of the
  code reads," which the guide assigns to `/** JSDoc */`, not `//`
  implementation notes. `ToolEvent` two exports down (`lines 69-80`) already
  gets a dedicated `/** */` doc comment. Split the block: keep a `/**...*/`
  comment directly above `ClaudeHookEvent` covering its own semantics, and one
  above `HookSummaryEntry` covering the three-arm discriminator contract,
  carrying over the existing rationale text rather than rewriting it.

### `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`

No findings. `softDepMarkers` is a pure function over three explicit
parameters, the `SoftDepStatus` probe is already an injected plain-data port
(not a hidden dependency), both exports are documented, and there is no
`as`/`!`/`any` usage.

### Clean files

- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts`

## Not covered

- `extensions/pi-claude-marketplace/platform/pi-api.ts` (`softDepStatus`,
  `hasLoadedPiSubagents`, `hasLoadedPiMcpAdapter`) — the real probe
  implementation that `SoftDepStatus` values come from at runtime. It is
  outside `shared/concerns/` and outside this assignment; its own test
  coverage (if any) was not reviewed here.
