# Domain — component schemas — adversarial re-review

**Scope:** `tests/domain/components/{hook-events,hook-if-targets,hook-tool-names,hooks,mcp,plugin}.test.ts`
and `extensions/pi-claude-marketplace/domain/components/{hook-events,hook-if-targets,hook-tool-names,hooks,mcp,plugin}.ts`.
Mutations were executed as throwaway `node --input-type=module` snippets against the
real modules (read-only; nothing in the tree was modified and no suite was run).
**First-pass file:** `unit-test-findings/domain-components.md`
**Clean files attacked:** 5 (`tests/domain/components/mcp.test.ts`, `hook-events.ts`,
`hook-if-targets.ts`, `hook-tool-names.ts`, `plugin.ts`)
**Existing findings graded:** 11

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 13 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 2 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture of this area does **not** hold up. Its headline BLOCKER
(plugin.test.ts's boolean-only rejects) is the weaker of the two problems in that
file, and the file it held up as the correct contrast (`mcp.test.ts`) has the same
defect in a more disguised form. Meanwhile a shipping production bug and a
completely unpinned schema both sat inside its `### Clean files` lists.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts`

- **[BLOCKER] `mapPiToClaudeToolName` returns `Object.prototype` members instead of a string** — `line 133`
  ```ts
  return (PI_TO_CLAUDE_TOOL_NAMES as Record<string, string>)[name] ?? name;
  ```
  `PI_TO_CLAUDE_TOOL_NAMES` is a plain object literal, so the index read walks
  `Object.prototype`. Executed against the real module:

  | input | returns |
  | --- | --- |
  | `"constructor"` | `function Object() { [native code] }` |
  | `"toString"` / `"valueOf"` / `"hasOwnProperty"` / `"isPrototypeOf"` / `"toLocaleString"` / `"propertyIsEnumerable"` | the corresponding native function |
  | `"__proto__"` | `Object.prototype` (an object) |

  The `?? name` fallback never fires because the prototype read is not `undefined`,
  and the `as Record<string, string>` assertion is exactly what hides the unsoundness
  from the compiler — the declared `: string` return type is violated at runtime.
  Reachable: the three call sites (`bridges/hooks/payloads/{pre-tool-use,post-tool-use,post-tool-use-failure}.ts:34/38/37`)
  all pass `event.toolName` straight into `tool_name:`, and Pi's `CustomToolCallEvent`
  arm types `toolName` as open-ended `string`. A custom/MCP tool named `toString`
  therefore emits a payload whose `tool_name` is a function, which `JSON.stringify`
  silently drops.
  All 14 cases in `tests/domain/components/hook-tool-names.test.ts:74–121` stay green
  because every row uses a safe name (`"mcp__server__tool"`, `"subagent"`,
  `"some_custom_tool"`, `""`, `"Bash"`, `"Read"`, `"Glob"`).
  **Fix:** guard the read — `Object.hasOwn(PI_TO_CLAUDE_TOOL_NAMES, name) ? … : name`
  — and drop the `as Record<string, string>` assertion. The in-repo reference is the
  sibling in this same directory: `hooks.ts:129` already uses `Object.hasOwn(v, "hooks")`
  for precisely this reason, and `bridges/hooks/if-field/index.ts:289–291` guards its
  `IF_PREFIX_TARGETS[prefix]` read with explicit literal comparisons first. Then add
  a data-driven reject loop over the eight prototype names to `hook-tool-names.test.ts`.

  Same root cause, **owned by the adjacent area** (`tests/domain/components/hooks/matcher.test.ts`):
  `domain/components/hooks/matcher.ts:50` does the same unguarded read on the
  *exported* `CLAUDE_TO_PI_TOOL_NAMES`. Verified: `parseMatcher("constructor")`
  returns `{ kind: "tool-set", piTools: Set { [Function: Object] } }` instead of
  `{ kind: "unmapped", token: "constructor" }`, and `parseMatcher("Bash|constructor")`
  returns `Set { "bash", [Function: Object] }`. The matcher string is
  plugin-author-controlled and `SAFE_MATCHER_CHARS` (`/^[A-Za-z0-9_|-]+$/`) admits
  every prototype name, so a `hooks.json` carrying `"matcher": "constructor"`
  **installs silently with a never-firing hook** instead of tripping the D-58-06
  strict-supportability trap the module header calls "the load-bearing design choice".
  Best fixed once, in my module, by exporting a guarded
  `mapClaudeToPiToolName(token: string): PiToolName | undefined` that `matcher.ts`
  calls instead of indexing the raw table.

### `tests/domain/components/plugin.test.ts`

- **[BLOCKER] `PLUGIN_MANIFEST_SCHEMA`'s property list is entirely unpinned — 14 of its 19 properties are deletable with the whole describe block green** — `lines 217–324`
  `PLUGIN_ENTRY_SCHEMA` gets a whole-value `assert.deepStrictEqual` at `lines 28–70`,
  which is what makes its boolean `Check()` cases sound. `PLUGIN_MANIFEST_SCHEMA`
  (`plugin.ts:96`) is module-private and gets no equivalent, so the manifest describe
  block rests on booleans alone. I compiled a mutant manifest schema keeping only
  `name`, `description`, `version`, `defaultEnabled`, `mcpServers` — deleting
  `...SUPPORTED_COMPONENT_PATH_FIELDS` (3), `...UNSUPPORTED_COMPONENT_FIELDS` (10)
  and `dependencies` — and ran all 22 rows of the block through it:
  **every accept and every reject stayed green.** TypeBox `Type.Object` leaves
  `additionalProperties` unset, so a deleted `Type.Optional(Type.Unknown())` field is
  indistinguishable from a declared one at the `Check()` level. The case titled
  `accepts opaque component payloads` (`line 228`) is therefore vacuous: it purports
  to prove the manifest declares those 13 component fields and passes for a schema
  that declares none of them.
  **Fix:** add a `describe("PLUGIN_MANIFEST_SCHEMA", …)` block mirroring `lines 27–71`
  and assert `assert.deepStrictEqual(PLUGIN_MANIFEST_VALIDATOR.Type(), expectedSchema)`
  against a hand-written literal. No new production export is needed —
  I verified `Compile()`'s result exposes `.Type()`, and
  `assert.deepStrictEqual(PLUGIN_ENTRY_VALIDATOR.Type(), PLUGIN_ENTRY_SCHEMA)` passes,
  so `.Type()` is a faithful pin. The expected manifest literal is
  `{ type: "object", properties: { name, description, version, defaultEnabled, skills,
  commands, agents, hooks, lspServers, monitors, themes, outputStyles, channels,
  userConfig, bin, settings, workflows, mcpServers, dependencies } }` with **no**
  `required` key.

### `tests/domain/components/hooks.test.ts`

*(not on the first pass's clean list, but this defect is new)*

- **[BLOCKER] The `ifPredicates` side-Map key arithmetic is unpinned — group and handler indices can be swapped undetected** — `line 167`
  The only assertion on the map anywhere in the suite is
  `new Map([["PostToolUse|0|0", …]])`. Both indices are **zero**, so mutating
  `ifPredicateMapKey` (`hooks.ts:173–179`) to
  `` `${claudeEvent}|${handlerIndex}|${groupIndex}` `` leaves the file green. This is
  the drift-prone producer/consumer contract the function's own doc comment says it
  exists to prevent ("Centralized so producers (parseHooksConfig) and consumers
  (flattenPluginIntoBuckets) cannot drift") — and `flattenPluginIntoBuckets` reads it
  back by the same string, so a swap corrupts dispatch for every config with more
  than one group or handler.
  The same single case also fails to discriminate the **post-filter re-indexing**
  documented at `hooks.ts:280–281` ("build the side-Map over the FILTERED subset").
  In the `line 109` fixture the sole surviving `if`-bearing handler is at raw index 0
  *and* filtered index 0, so raw-vs-filtered indexing is unobservable there.
  **Fix:** add one case whose config keeps two groups on one event, where the
  `if`-bearing handler in the **second** group sits at filtered handler index 2 and is
  preceded by a dropped `future-handler` (making its raw index 3), and
  `deepStrictEqual` the whole Map against the single key `"PostToolUse|1|2"`. Three
  distinct numbers — group 1, filtered handler 2, raw handler 3 — make the index swap,
  the raw-vs-filtered slip, and an off-by-one each separately detectable.

### `tests/domain/components/mcp.test.ts`

- **[WARNING] The reject loop asserts one constant error identity that carries no rejection reason, and never touches the two methods production uses** — `lines 63–96`
  All six rows assert the identical triple
  `{ constructorName: "ParseError", name: "Error", message: "Parse" }`. I confirmed
  at runtime that TypeBox's `ParseError` has **zero own enumerable properties**
  (`Object.keys(err)` is `[]`), so this triple is a constant that is the same for a
  rejected `null`, a rejected array, and a rejected number — it discriminates
  *nothing* about why the value was rejected. It is the same class of check the first
  pass condemned in `plugin.test.ts`, one layer down.
  Separately, `MCP_SERVERS_VALIDATOR`'s only production consumer
  (`domain/resolver.ts:1350,1356`) calls `.Check()` and `.Errors()`; this file
  exercises only `.Parse()`.
  **Fix:** replace the error-identity predicate with the structured diagnostic —
  `assert.deepStrictEqual(MCP_SERVERS_VALIDATOR.Errors(mcpServers), [{ keyword: "type",
  schemaPath: "#", instancePath: "", params: { type: "object" }, message: "must be object" }])`
  (verified output, deterministic for the pinned typebox version) — and add a
  `.Check()` accept/reject pair so the method production actually calls is owned here.
  I explicitly did *not* rate this BLOCKER: the accept/reject booleans do discriminate
  a wrong validator (compiling the wrong schema flips them), and the schema itself is
  pinned whole at `lines 10–22`.

### `extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts`

- **[WARNING] The header misattributes where its gate lives** — `lines 23–25`
  > "Architecture-test introspection pins `Object.keys(IF_PREFIX_TARGETS)` to the exact
  > tuple in locked order; adding a fifth entry without amending the test fails CI."

  `grep -rn "hook-if-targets" tests/architecture/` returns nothing. The only
  `Object.keys(IF_PREFIX_TARGETS)` pin in the repo is
  `tests/domain/components/hook-if-targets.test.ts:39–42` — the unit test, not an
  architecture test. The claim is true in substance (CI does fail) but false about
  its location, which is exactly the failure mode META-FINDINGS records for
  `orchestrators/marketplace/info.ts`. **Fix:** reword to name
  `tests/domain/components/hook-if-targets.test.ts`.

### `extensions/pi-claude-marketplace/domain/components/hook-events.ts`

- **[WARNING] Doc comment claims a private tuple's order serves "downstream consumers"** — `lines 101–102`
  `DISPATCHABLE_EVENTS` is module-private (`line 104`) and feeds exactly two things:
  `DISPATCHABLE_MEMBERS` (a `Set`, order-insensitive) and the `DispatchableEvent`
  union type (order-insensitive). No consumer can observe its order, so
  "Order matches `BUCKET_A_EVENTS` as a deterministic registration order for
  downstream consumers" describes a property nothing depends on and no test can pin.
  **Fix:** drop the sentence, or keep the tuple's order as a readability convention
  and say so.

### `tests/domain/components/hook-events.test.ts`

- **[WARNING] The three `isDispatchableEvent` reject cases reach a branch unreachable by any legal input, via `as` casts** — `lines 103–118`
  `DISPATCHABLE_EVENTS` (`hook-events.ts:104–115`) is element-for-element identical to
  `BUCKET_A_EVENTS`, so `isDispatchableEvent(event: BucketAEvent)` returns `true` for
  every value its parameter type admits. The `false` return is reached only by
  `eventName as BucketAEvent` (`line 110`) forcing `""`, `"sessionstart"`, and
  `"SessionStarts"` past the compiler — the module's own comment concedes the guard is
  "a defensive belt (debug-log + noop) that no live event reaches". This is the same
  decision class META-FINDINGS §"Decisions the fixing pass cannot make" item 1 records
  for the four prototype-patching files, in a milder form (casts, not prototype
  surgery). **Escalate, do not silently fix.** Two coherent outcomes: widen the
  signature to `isDispatchableEvent(event: string)` — which makes the three cases
  legitimate and matches how `dispatch-exec.ts:194` /
  `async-rewake/registry.ts:228` actually use it as a narrowing guard — or delete the
  three cases and accept the branch as compiler-forced (D-116-01a).

### `extensions/pi-claude-marketplace/domain/components/plugin.ts`

- **[WARNING] Header comment states a false fact about TypeBox** — `lines 11–12`
  > "TypeBox `Type.Optional` produces `T | undefined` in `Static<>`, not `T?`.
  > Use `=== undefined` checks downstream, not `in`."

  Falsified by this module's own paired test: `plugin.test.ts:11`
  (`{ name: "plugin", source: "./plugin" } satisfies PluginEntry`) type-checks with
  every optional field **absent**, which is only possible if `Static<>` renders them
  as `prop?:`. Had they been required-with-`undefined`, that line would need a
  `@ts-expect-error` like `lines 18–25` do. The downstream *advice* (`=== undefined`,
  not `in`) is still sound under `exactOptionalPropertyTypes`, but the stated reason
  is wrong. **Fix:** restate as "`Type.Optional` renders `prop?: T` in `Static<>`;
  prefer `=== undefined` over `in` because the validator accepts an explicitly-present
  `undefined`."
- **[WARNING] `PluginEntry` is a closed type narrowed from an open validator** — `lines 64–89`
  `PLUGIN_ENTRY_SCHEMA` leaves `additionalProperties` unset, and `plugin.test.ts:107–116`
  asserts an unknown `vendorField` is accepted. But `PLUGIN_ENTRY_VALIDATOR.Check(x): x is PluginEntry`
  (used at `orchestrators/plugin/install.ts:724` and `orchestrators/reconcile/backfill.ts:440`)
  narrows to a type that says those fields cannot exist. **Fix:** document the
  divergence on `PluginEntry` (`line 86`), or make it explicit with
  `Type.Object({…}, { additionalProperties: Type.Unknown() })` — and note that a
  schema change moves the pinned literal at `plugin.test.ts:30–63`.

### `extensions/pi-claude-marketplace/domain/components/hooks.ts` and its paired test

- **[WARNING] Seven runtime/type re-exports and four exported types have no owning case** — `hooks.ts:52–59, 81–104, 167, 193–200`
  `hooks.test.ts` imports exactly three symbols. Per the skill's barrel rule, each
  runtime re-export needs
  `assert.strictEqual(barrelExport, sourceModuleExport)`. Missing:
  `parseMatcher`, `HOOKS_CONFIG_SCHEMA`, `HOOKS_VALIDATOR` (runtime) and
  `ParsedMatcher`, `DroppedHook`, `HookHandlerEntry`, `HooksConfig` (types).
  This is load-bearing: production reaches `parseMatcher` *through* the barrel
  (`bridges/hooks/event-router.ts:46`), never from `hooks/matcher.ts` directly, so
  rewiring the re-export to a stale copy fails no case this module owns.
  Separately, the four locally-declared exported types
  (`CompileIfPredicateContext`, `CompileIfCallback`, `CompiledIfPredicateMap`,
  `HookConfigParseResult`) carry no `satisfies` / `@ts-expect-error` pair — **the only
  file in this directory with none.** `hook-events.test.ts:16–27`,
  `hook-tool-names.test.ts:10–12`, and `plugin.test.ts:11–25` all do it.
  **Fix:** add three `strictEqual` binding cases and one `satisfies`/`@ts-expect-error`
  block at the head of `hooks.test.ts`, copying `hook-events.test.ts:16–27`.
- **[WARNING] `result` is the value name in 11 of ~19 cases — the lone drifter in this directory** — `lines 26, 42, 62, 77, 102, 132, 185, 258, 322, 341, 367`
  The skill names `result` explicitly as a finding. Every sibling names by role:
  `schema`, `events`, `fields`, `closedSets`, `targets`, `prefixes`, `piToolName`,
  `claudeToolName`, `isValid`, `parsedMcpServers`. **Fix:** rename to
  `parsedHooks` (or `hooksParse`) throughout; the two cases that already name by role
  (`entries`, `lines 221/240`) show the target form.
- **[WARNING] `FIXTURE_DIR` does not hold the fixture directory** — `line 19`
  `path.dirname(fileURLToPath(import.meta.url))` is the *test file's own* directory;
  all four uses then walk `"../../fixtures/…"`. **Fix:** either rename to `TEST_DIR`,
  or (preferred, and it folds into the first pass's relocation finding) set
  `FIXTURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "hooks-fixtures")`
  after moving the four JSON files beside this test, and drop the `../../` walk.
- **[WARNING] The `compileIf` callback's context argument is only half asserted** — `lines 132–136`
  The callback records `{ rawIf, event, cwd: ctx.cwd }`, so mutating `hooks.ts:341` to
  `compileIf(rawIf, claudeEvent, { ...ctx, homedir: "/wrong", projectRoot: "/wrong" })`
  survives. **Fix:** record the whole third argument and assert
  `assert.deepStrictEqual(recordedCtx, TEST_IF_CTX)` (or `strictEqual` for identity)
  inside the expected Map value.
- **[WARNING] Empty `// arrange` phases** — `lines 59–60` and `lines 99–101`
  The phase marker is followed by a blank line and nothing else; the arranged value
  comes from the loop row. **Fix:** delete the empty `// arrange` marker in both
  data-driven loops, or move the row alias into it as the siblings do.
- **[WARNING] `isPluginWrapper`'s third branch is untested** — `hooks.ts:133–134`
  Reachable and untested: an object whose own `hooks` property is *not* a plain object.
  `{"hooks": null}` falls through to direct validation and fails
  `"/hooks: must be array"`; `{"hooks": []}` validates *successfully* as a bare config
  with an event key literally named `hooks`, and partitions to
  `{ ok: true, value: {}, dropped: [{ kind: "event", event: "hooks" }] }` — a surprising
  behavior nothing records. **Fix:** add both rows to the loop at `lines 53–70`
  (which currently covers only the non-object arm) with full `deepStrictEqual`
  expectations.

### `tests/domain/components/hook-tool-names.test.ts`

- **[WARNING] Seven per-key cases fully subsumed by the whole-object assertion** — `lines 15–34` vs `lines 36–53`
  `assert.deepStrictEqual(mappings, expectedMappings)` at `line 52` pins every key and
  value; no mutation of `CLAUDE_TO_PI_TOOL_NAMES` can fail a `lines 15–34` row without
  first failing `line 52`. **Fix:** delete the `lines 15–34` loop. (Contrast
  `mapPiToClaudeToolName`'s seven forward rows at `lines 75–94`, which are *not*
  redundant — `PI_TO_CLAUDE_TOOL_NAMES` is module-private and those rows are its only
  pin.)

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `hook-events.ts` | `BUCKET_A_EVENTS` | `hook-events.test.ts:30` | owned (whole-tuple) |
| `hook-events.ts` | `BucketAEvent` | `hook-events.test.ts:16–18` | owned |
| `hook-events.ts` | `TOOL_EVENTS` | `hook-events.test.ts:54` | owned (whole-tuple) |
| `hook-events.ts` | `ToolEvent` | `hook-events.test.ts:19–21` | owned |
| `hook-events.ts` | `DispatchableEvent` | `hook-events.test.ts:22–24` | owned |
| `hook-events.ts` | `isDispatchableEvent` | `hook-events.test.ts:78–119` | owned; reject arm unreachable by real input |
| `hook-events.ts` | `NON_TOOL_EVENT_FIELDS` | `hook-events.test.ts:122` | owned (whole-object) |
| `hook-events.ts` | `StopFailureErrorType` | `hook-events.test.ts:25–27` | owned |
| `hook-events.ts` | `NON_TOOL_EVENT_CLOSED_SETS` | `hook-events.test.ts:143` | owned (whole-object) |
| `hook-if-targets.ts` | `IF_PREFIX_TARGETS` | `hook-if-targets.test.ts:6,34` | owned (whole-table + key order) |
| `hook-tool-names.ts` | `PiToolName` | `hook-tool-names.test.ts:10–12` | owned |
| `hook-tool-names.ts` | `CLAUDE_TO_PI_TOOL_NAMES` | `hook-tool-names.test.ts:36` | owned (whole-object) |
| `hook-tool-names.ts` | `mapPiToClaudeToolName` | `hook-tool-names.test.ts:74–121` | owned; **prototype-key inputs untested (BLOCKER above)** |
| `mcp.ts` | `MCP_SERVERS_SCHEMA` | `mcp.test.ts:10` | owned (whole-schema) |
| `mcp.ts` | `MCP_SERVERS_VALIDATOR.Parse` | `mcp.test.ts:50,71` | owned |
| `mcp.ts` | `MCP_SERVERS_VALIDATOR.Check` | — | **NO CASE** (production uses it: `resolver.ts:1350`) |
| `mcp.ts` | `MCP_SERVERS_VALIDATOR.Errors` | — | **NO CASE** (production uses it: `resolver.ts:1356`) |
| `plugin.ts` | `PLUGIN_ENTRY_SCHEMA` | `plugin.test.ts:28` | owned (whole-schema) |
| `plugin.ts` | `PluginEntry` | `plugin.test.ts:11–25` | owned |
| `plugin.ts` | `PLUGIN_ENTRY_VALIDATOR` | `plugin.test.ts:73–215` | owned |
| `plugin.ts` | `PLUGIN_MANIFEST_VALIDATOR` | `plugin.test.ts:217–324` | **partly owned — schema shape unpinned (BLOCKER above)** |
| `hooks.ts` | `parseHooksConfig` | `hooks.test.ts:21…383` | owned; key arithmetic unpinned |
| `hooks.ts` | `projectHookSummaryEntries` | `hooks.test.ts:210` | owned (whole-array) |
| `hooks.ts` | `hookSummaryEntriesFromPersisted` | `hooks.test.ts:231` | owned (whole-array) |
| `hooks.ts` | `CompileIfPredicateContext` | — | **NO CASE** (exercised incidentally as `TEST_IF_CTX`, never pinned) |
| `hooks.ts` | `CompileIfCallback` | — | **NO CASE** (incidental) |
| `hooks.ts` | `CompiledIfPredicateMap` | — | **NO CASE** (incidental) |
| `hooks.ts` | `HookConfigParseResult` | — | **NO CASE** (incidental) |
| `hooks.ts` | `parseMatcher` (re-export) | — | **NO CASE** — production imports it via this path (`event-router.ts:46`) |
| `hooks.ts` | `HOOKS_CONFIG_SCHEMA` (re-export) | — | **NO CASE** in the pair; exercised from `tests/architecture/hooks-foundation.test.ts:19` |
| `hooks.ts` | `HOOKS_VALIDATOR` (re-export) | — | **NO CASE** in the pair; exercised from `tests/architecture/hooks-foundation.test.ts:20` |
| `hooks.ts` | `ParsedMatcher` / `DroppedHook` / `HookHandlerEntry` / `HooksConfig` (type re-exports) | — | **NO CASE** |

## Branch census

**Reachable and untested (findings):**

- `hooks.ts:133–134` — `isPluginWrapper` third arm (own `hooks` present, not a plain
  object). Two distinct downstream outcomes, neither recorded. See WARNING above.
- `hooks.ts:305–319` — `buildIfPredicateMap`'s outer loop never runs with more than
  one event key, and its inner loop never with `groupIndex > 0`. The single covered
  key is `"PostToolUse|0|0"`. Folded into the BLOCKER above.
- `hooks.ts:341` — `compileIf` is never observed receiving a non-tool `claudeEvent`,
  although `buildIfPredicateMap` does not filter by tool-event and the
  `CompiledIfPredicateMap` doc (`line 161`) claims non-tool entries collapse to the
  fall-open sentinel downstream.
- `mcp.ts:16` — `MCP_SERVERS_VALIDATOR.Check` / `.Errors` (see census).

**Unreachable by real input:**

- `hook-events.ts:136` — the `false` return of `isDispatchableEvent`. `DISPATCHABLE_EVENTS`
  ≡ `BUCKET_A_EVENTS`, so no value of the declared parameter type reaches it. Currently
  propped up by `as` casts. **Operator decision** — see the WARNING above.
- `hooks.ts:150` — the `first.instancePath || "<root>"` empty-string arm is reachable
  (covered at `hooks.test.ts:67`); the `as [HookValidationError, …]` destructuring
  assertion guarding an empty `Errors()` array is not, and is correctly commented.

**Compiler-forced, not removable (D-116-01a):**

- `hook-events.ts:190` / `:285–287` — the `satisfies Readonly<Record<NonToolEvent, …>>`
  clauses. Totality and the `UserPromptSubmit`/`Stop` exclusion are enforced at compile
  time; no runtime case can or should re-derive them. Correctly untested.
- `hook-tool-names.ts:87` — `satisfies Record<PiToolName, string>` performs excess-property
  checking on the object literal, so an eighth private entry is a compile error. Note the
  asymmetry: `CLAUDE_TO_PI_TOOL_NAMES satisfies Record<string, PiToolName>` (`line 106`)
  does **not** constrain the key set at all — the whole-object assertion at
  `hook-tool-names.test.ts:36–53` is its only gate, and it is a sound one.

## Grading of first-pass findings

### `tests/domain/components/plugin.test.ts`

- **OVERSTATED** — *Every validator rejection case asserts only the `.Check()` boolean* —
  correct severity: **WARNING**, and only for the manifest half. For
  `PLUGIN_ENTRY_VALIDATOR` the schema it is compiled from is pinned whole at
  `lines 28–70`, so "rejects for a completely unrelated reason" would require TypeBox
  itself to be wrong; and the boolean cases *do* discriminate a wrong schema/validator
  binding (I confirmed `Compile(PLUGIN_MANIFEST_SCHEMA)` in the entry slot flips
  `rejects an entry without its name`, and vice versa). Hardcoding 32 `.Errors()`
  expectations would largely re-test the library. The real hole in this file is the
  unpinned manifest schema — see the new BLOCKER. If the `.Errors()` treatment is
  applied anywhere, apply it only to the manifest rejects, and the shape is
  `{ keyword, schemaPath, instancePath, params, message }`, e.g. `{ name: 42 }` →
  `[{ keyword: "type", schemaPath: "#/properties/name", instancePath: "/name",
  params: { type: "string" }, message: "must be string" }]` (executed, deterministic).
- **REFUTED** — *`mcp.test.ts` shows the correct contrast* — it does not.
  `tests/domain/components/mcp.test.ts:79–94` asserts a constant
  `{ constructorName: "ParseError", name: "Error", message: "Parse" }` for all six
  rows, and TypeBox's `ParseError` carries **no own enumerable properties** (verified),
  so the assertion is information-free about the rejection reason — the same defect the
  first pass condemned here. The correct in-repo template is `hooks.test.ts:65–68` and
  `:86–106`, which deep-compare the whole `{ ok: false, reason }` including the exact
  `instancePath: message` text produced by `hooks.ts:143–151`.

### `tests/domain/components/hook-tool-names.test.ts`

- **CONFIRMED** — *A test re-implements the production lookup instead of calling it* —
  BLOCKER stands, and it is worse than "tests nothing": the real Claude→Pi consumer
  (`domain/components/hooks/matcher.ts:50–53`) maps a miss to
  `{ kind: "unmapped", token }`, so the fabricated `?? toolName` passthrough encodes
  the *opposite* contract. Deleting the loop is right; the productive replacement is
  the guarded `mapClaudeToPiToolName` named in the new BLOCKER, which fixes the
  prototype bug and gives this case a real subject at the same time.

### `tests/domain/components/hooks.test.ts`

- **CONFIRMED** — *No `describe()` grouping despite three tested entry points* — three
  exported entry points, flat file; `hook-events.test.ts` and `plugin.test.ts` group.
- **CONFIRMED** — *Fixture JSON files live in the whole-suite dumping ground* —
  `line 19` + four `../../fixtures/` walks; `tests/fixtures/` is shared with four other
  suites. Pair the move with the `FIXTURE_DIR` rename above.
- **CONFIRMED** — *One test asserts three unrelated behaviors at once* — `lines 109–171`.
  The proposed split is right but incomplete: the same case is also the only pin on the
  `ifPredicates` key format, so whichever split fragment inherits the Map assertion must
  be the one carrying the multi-group/multi-handler fixture from the new BLOCKER.
- **OVERSTATED** — *Partial regex match on a non-deterministic message* — `line 82`.
  The first pass concedes it is defensible in the same bullet; the suffix is V8's own
  `JSON.parse` text and pinning it would make the suite Node-version-fragile. Correct
  outcome: an informational note (add the one-line comment), not a WARNING.

### `tests/domain/components/hook-events.test.ts`

- **UNDERSTATED** — *Expected filter criterion is derived from the production module's
  own export* — `line 68`. Severity stays WARNING, but the recorded fix does not
  address the actual problem: the case at `lines 65–75` is **tautological given its two
  siblings**. Both of its inputs are already pinned to hand-written literals
  (`BUCKET_A_EVENTS` at `line 30`, `TOOL_EVENTS` at `line 54`), so the filtered result is
  determined — the case cannot fail unless one of those two already failed. Swapping in
  a literal `Set` leaves a case that still discriminates nothing. **Delete `lines 65–75`.**

### `tests/domain/components/hook-if-targets.test.ts`

- **CONFIRMED** — *Vacuous uniqueness assertion* — `line 43`. `Object.keys()` on an
  object literal cannot return duplicates; no implementation of `IF_PREFIX_TARGETS`
  fails it. Delete the line.

### `extensions/pi-claude-marketplace/domain/components/hooks.ts`

- **CONFIRMED** — *`hookDebugLog` is an imported singleton invoked directly from
  `parseHooksConfig`* — and the first pass's "leave it alone, repo-wide seam" conclusion
  is right. One fact it missed, worth carrying to whoever owns the repo-wide decision:
  `shared/debug-log.ts:23` reads `process.env.PI_CLAUDE_MARKETPLACE_DEBUG` *inside* the
  function, so this is the "`process.env` read buried in logic" shape, not merely an
  imported singleton — and `hooks.test.ts` runs both `parseHooksConfig` failure branches
  (`lines 58, 72, 98`) without neutralizing it, so a developer with the variable set gets
  `console.error` output from these unit cases. Assertions are unaffected.

### `extensions/pi-claude-marketplace/domain/components/mcp.ts`

- **CONFIRMED** — *Inconsistent per-export documentation in a two-export file* — `line 13`.
  Real but low value; note that the same drift exists between `plugin.ts:88`
  (`/** JIT-compiled validator (D-07). */`) and `mcp.ts:15`
  (`… Use \`.Check(value)\` or \`.Parse(value)\`.`) — fix both in one pass or neither.

## Still clean after attack

- **`tests/domain/components/hook-if-targets.test.ts`** (minus the vacuous `line 43`) —
  I could not find a surviving mutation. `deepStrictEqual` on the whole table catches a
  dropped `piEvents` member, a `Set`→array swap, a `"path"`↔`"command"` swap on any
  entry, and an added fifth prefix; `Object.keys` at `line 39` catches a key reorder
  that `deepStrictEqual` cannot see. The two cases are genuinely complementary.
- **`tests/domain/components/hook-events.test.ts`** (minus `lines 65–75` and the
  unreachable-arm cases) — whole-tuple / whole-object `deepStrictEqual` on all four
  tables catches: reordering `BUCKET_A_EVENTS`, dropping `Stop`, swapping
  `NON_TOOL_EVENT_FIELDS.SessionStart`↔`SessionEnd` values, replacing a `null` sentinel
  with a string, adding or removing any of the ten `STOP_FAILURE_ERROR_TYPES` (caught
  transitively — the closed set is derived from that tuple), and emptying
  `NON_TOOL_EVENT_CLOSED_SETS.SessionStart`.
- **`tests/domain/components/plugin.test.ts`, entry half** — the whole-schema
  `deepStrictEqual` at `lines 28–70` catches every mutation the boolean cases miss:
  I confirmed an entry schema stripped of all 14 component/dependency fields passes all
  17 boolean cases and fails `line 69`. Making `name` optional, retyping `description`,
  adding `additionalProperties: false`, and compiling the manifest schema into the entry
  validator are all caught.
- **`tests/domain/components/hooks.test.ts`, projection half** — `lines 210–248` are
  strong: `matcher ?? ""` → `?? undefined`, dropping the non-tool arm, and building
  `TOOL_EVENT_MEMBERS` from `BUCKET_A_EVENTS` instead of `TOOL_EVENTS` all fail.
- **`tests/domain/components/hooks.test.ts`, partition/wrapper half** — `lines 250–383`
  compare whole `{ ok, value, dropped, ifPredicates }` results against hand-written
  literals; dropping the wrapper unwrap, keeping a `Notification` event, or keeping a
  regex matcher group all fail. Building the `if` map over the *unfiltered* config also
  fails (`line 167` would gain two entries) — only the raw-vs-filtered *index* value is
  unpinned.
- **`extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts`** — no
  production defect beyond the misattributed gate comment. `mcp.ts` likewise, beyond the
  JSDoc asymmetry the first pass recorded.

## Not covered

- `domain/components/hooks/{matcher,partition,schema}.ts` and their paired tests are
  another area's assignment. I read `matcher.ts` only far enough to trace the
  `CLAUDE_TO_PI_TOOL_NAMES` consumer and confirm the prototype-key bug reaches it; I did
  not review `matcher.test.ts`, `partition.test.ts`, or `schema.test.ts`.
- `domain/resolver.ts` is another area's file. I read `readManifest`
  (`lines 623–650`) and the MCP validation block (`lines 1345–1360`) only to establish
  which validator methods production calls and whether deleting manifest schema
  properties would break the typecheck downstream (it would not — `readManifest`
  immediately widens the narrowed value to `Record<string, unknown> | null`).
- I did not run `node --test`, `npm run typecheck`, or any coverage tool. The mutation
  results above come from executing compiled TypeBox validators and the two pure
  lookup functions in isolation, not from running the suite.
- `PluginEntry`'s exact `Static<>` rendering was inferred from what `plugin.test.ts:11–25`
  must be doing to compile, not from a `tsc` run.

## Meta-findings impact

### New cross-cutting evidence

**1. Unguarded object-literal lookup tables are a repo-wide defect class, not a local
bug.** Two of the three sites in this area index a plain object literal with an
untrusted string and treat any non-`undefined` result as a hit:
`hook-tool-names.ts:133` (`mapPiToClaudeToolName`) and
`domain/components/hooks/matcher.ts:50` (`parseMatcher`). Both return
`Object.prototype` members for the eight prototype key names, verified at runtime. The
matcher one is the serious one: the matcher string comes from a plugin's own
`hooks.json`, and `"matcher": "constructor"` yields `{ kind: "tool-set" }` instead of
`{ kind: "unmapped" }`, so the plugin **installs silently with a dead hook** rather than
tripping the D-58-06 `(unavailable) {unsupported hooks}` trap that module exists to
enforce. The third site in the area (`bridges/hooks/if-field/index.ts:289–291`) is safe
only because it compares against literals before indexing, and
`hooks.ts:129` uses `Object.hasOwn` correctly — so the repo already contains both the
bug and its fix.
**Other areas to check:** any `X[key]` where `X` is a `const … = { … } as const` table
and `key` comes from a manifest, a matcher, a config file, or a Pi event —
`shared/notify*.ts` catalogues, `domain/source.ts`, `bridges/mcp/substitute.ts`
(`${VAR}` name lookups), `edge/flag-catalog.ts`, and the `TRANSLATORS` /
`REQUIRED_EVENT_FIELDS` records in `bridges/hooks/dispatch-exec.ts` (those two are keyed
on a narrowed union, so probably safe — worth a look). A one-line grep for
`as Record<string, ` in `extensions/` finds the casts that hide this from the compiler.

**2. "Pinning the schema whole" is a stronger and cheaper gate than pinning every
rejection reason — and it is applied inconsistently.** `plugin.test.ts` and `mcp.test.ts`
both pin their *exported* schema with `deepStrictEqual`, which makes their boolean
`Check()` cases sound; `PLUGIN_MANIFEST_SCHEMA` is private and unpinned, and 14 of its
19 properties are consequently deletable with 22 cases green. `Compile()`'s result
exposes `.Type()`, so a private schema can be pinned through its exported validator with
no new production export. **Every other area holding a TypeBox schema should check
whether its schema literal is asserted whole or only sampled through booleans** —
candidates: `domain/manifest.ts` (`MARKETPLACE_*`), `persistence/state-io.ts`
(`STATE_SCHEMA`, `PLUGIN_INSTALL_RECORD_SCHEMA`), `persistence/agents-index-schema.ts`,
`domain/components/hooks/schema.ts` (`HOOKS_CONFIG_SCHEMA`). This changes the shape of
the "structured error assertions" workstream: prefer one whole-schema assertion per
module over N hardcoded `.Errors()` expectations.

**3. A third kind of gate-comment lie.** META-FINDINGS records comments that
*misdescribe a symbol's status*; `hook-if-targets.ts:23–25` misdescribes a gate's
*location* ("Architecture-test introspection pins …" — no file under `tests/architecture/`
references the module), and `plugin.ts:11–12` misstates a *library fact* its own paired
test disproves. Suggested check for every area: grep your production comments for
"architecture test", "the gate", "pinned by", "CI fails" and verify each named location
exists.

### Corrections to META-FINDINGS.md

- §"Ranked by leverage" item 3 lists "Replace fragment assertions on rendered messages"
  and names `*.messaging.test.ts` as the reference implementation for whole-value
  assertions. That table should not be read as implying the *validator* files in this
  area are already correct: `tests/domain/components/mcp.test.ts:79–94` asserts a
  constant, information-free error triple, and `tests/domain/components/plugin.test.ts:217–324`
  asserts booleans against an unpinned schema. Both are the same "the check passes for
  the wrong reason" class, in a non-message form the current ranking does not cover.
- §"Real defects found outside the test layer" should gain the
  `mapPiToClaudeToolName` / `parseMatcher` prototype-key bug. Like the `mcp.json`
  null/string crash it is a shipping bug found by reading production alongside tests, and
  the `parseMatcher` half is author-reachable through plain plugin JSON.
- §"Known gaps in this sweep" — the first-pass file for this area put the `hooks.ts`
  re-export question under `## Not covered` rather than recording it as a finding. It is
  a finding: production imports `parseMatcher` through the barrel path
  (`bridges/hooks/event-router.ts:46`), so the barrel rule applies. Worth checking
  whether other areas parked barrel re-exports under "Not covered" the same way.

### Confirmations

- §"Gates that do not gate" item 2 (**hooks-schema gate scans the wrong file**) —
  **independently confirmed from the production side.** I read
  `domain/components/hooks.ts` end to end: it contains no TypeBox schema literal at all;
  `HOOKS_VALIDATOR` and `HOOKS_CONFIG_SCHEMA` are imported from
  `./hooks/schema.ts` at `hooks.ts:50` and re-exported at `:54–59`.
  `tests/architecture/no-hooks-strict-additional-properties.test.ts:26–29` points
  `HOOKS_TS_PATH` at `hooks.ts`, and its own header says the grep exists to block
  "an `as unknown as never` cast … that could slip a strict gate into the TypeBox
  schema" — there is no TypeBox schema in that file to slip anything into. Fix:
  retarget at `domain/components/hooks/schema.ts`, or scan both.
- §"Decisions the fixing pass cannot make" item 1 (**unreachable branches propped up by
  tests**) — confirmed with a fourth instance in a milder form:
  `hook-events.test.ts:103–118` uses `as BucketAEvent` casts rather than prototype
  surgery to reach `isDispatchableEvent`'s `false` arm, which no legal input reaches
  because `DISPATCHABLE_EVENTS` ≡ `BUCKET_A_EVENTS`. Same decision, cheaper resolution:
  widening the parameter to `string` makes the cases legitimate *and* matches how
  `dispatch-exec.ts:194` and `async-rewake/registry.ts:228` use the function.
- §"The dominant shape: sibling drift" — confirmed. `hooks.test.ts` is the lone drifter
  in a six-file directory on three separate conventions its five siblings all follow:
  `describe()` grouping, `satisfies`/`@ts-expect-error` type pins, and naming values by
  role instead of `result`.
- §"Provenance and confidence" — confirmed emphatically. Three of the five clean-list
  entries in this area carried real findings, including the only shipping bug in the
  area.
