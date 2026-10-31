# Stack Research: json-output (Mode-Keyed Presentation Strategies)

**Domain:** Pi extension output layer. The same presentation model is formatted as text (`tui`/`print`) or as a versioned JSON payload (`json`/`rpc`) delivered through `pi.appendEntry`.
**Researched:** 2026-09-28
**Confidence:** HIGH. Every Pi claim below cites the installed `@earendil-works/pi-coding-agent@0.86.1`. The load-bearing ones were also measured with a throwaway probe extension run through the real `pi` bin (`dist/bundle/cli.js`), using a hermetic `HOME`/`PI_CODING_AGENT_DIR` in the session scratchpad. No repo file was touched.

Path shorthand: `pi/` = `node_modules/@earendil-works/pi-coding-agent/`.

## Bottom Line

**Add no dependencies.** The milestone needs two things:

1. `typebox` (already a dependency, `^1.1.38`, installed 1.3.31) for the wire schema, `Static<>` types, compiled validators, and JSON Schema export.
2. The Pi peer we already pin (`>=0.86.1`) for `ctx.mode` and `pi.appendEntry`.

The real stack-level work is in three places:

- **Signature plumbing.** `appendEntry` lives on `pi` (`ExtensionAPI`), not on `ctx`. Six of the D2 raw-string surfaces take only `ctx` today.
- **Two Pi timing constraints.** Entries appended during startup `session_start`/`resources_discover` are never streamed in `json`/`rpc` mode. Entries appended after the command handler returns are lost in `json` mode.
- **One RPC fact that D3 has to absorb.** `ctx.ui.notify` is *not* silent in `rpc` mode.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `typebox` | keep `^1.1.38` (installed 1.3.31; latest 1.3.34, published 2026-09-18) | Versioned wire schema (`schemaVersion` literal + `kind`-discriminated union), `Type.Static<>` for the TS model, `Compile()` validators for tests, JSON Schema export | Already the house schema library (`import Type from "typebox"` + `Compile` from `typebox/compile` in 8 production modules, such as `domain/components/plugin.ts:14-15,86,89`). 1.x schemas are plain JSON Schema 2020-12 objects with **no symbol keys** (verified: `Object.getOwnPropertySymbols(schema).length === 0`, and `JSON.stringify` round-trips byte-equal). So the schema *is* the published artifact, and no generator is needed. |
| `@earendil-works/pi-coding-agent` | keep peer `>=0.86.1`, dev `^0.86.1` (latest 0.87.1) | `ctx.mode`, `pi.appendEntry`, `entry_appended` session event | Every surface this milestone uses exists at 0.86.1. 0.87.1 is identical on those surfaces (`ExtensionMode` still at `types.d.ts:209`, `appendEntry` moved only to `:1060`, and `print-mode.js` still binds at `:53` and subscribes at `:84`). Do not bump the floor for this milestone. |

### Supporting Libraries

None. Each need below is already covered in-tree:

| Need | Covered by | Evidence |
|------|------------|----------|
| Runtime validation of emitted payloads (test side) | `Compile(schema).Check(v)` / `.Errors(v)` from `typebox/compile` | Verified on 1.3.31: `.Errors()` yields `{keyword, schemaPath, instancePath, params, message}` records. `Compile` exposes `Check, Parse, Errors, Clean, Convert, Create, Default, Decode, Encode`, and `IsAccelerated()` returns `true` (JIT). |
| TS types for the wire model | `Type.Static<typeof ClaudePluginPayload>` | House idiom (`plugin.ts:86`) |
| JSON Schema file for docs | `JSON.stringify(schema, null, 2)` | 1.x objects are pure JSON Schema. Verified output: `{"anyOf":[{"type":"object","required":[...],"properties":{"schemaVersion":{"type":"number","const":1},...}}],"$id":"...","title":"..."}` |
| Typing the captured event in tests | `CustomEntry`, `JsonAgentSessionEvent`, `SessionEntry` (type-only) | Root-exported: `pi/dist/index.d.ts:20` (`CustomEntry`), `:28` (`JsonAgentSessionEvent`) |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node:test` + in-process fake `pi` | JSON capture helper (milestone target feature) | The fake implements the consumer-owned `appendEntry(customType, data)` view and pushes `{customType, data}` into an array. Tests assert `customType === "claude-plugin"` and `COMPILED_PAYLOAD.Check(data)`. No library needed. |
| Real `pi` bin (`pi/dist/bundle/cli.js`, the `bin` target per `pi/package.json:9-11`) | Optional e2e smoke of the JSON stream | See "Headless invocation" below. It needs no model or credentials. |

## Verified Pi API Facts (answers to the six research questions)

### Q1. `appendEntry` signature and where it is reachable

- **Signature:** `appendEntry<T = unknown>(customType: string, data?: T): void` on `ExtensionAPI` (`pi/dist/core/extensions/types.d.ts:991`). The handler type is `AppendEntryHandler` (`:1203`). It returns `void`, not the entry id.
- **It is NOT on any context type.** `ExtensionContext` (`types.d.ts:210-250`) and `ExtensionCommandContext extends ExtensionContext` (`:255`) have no `appendEntry`. Measured: `typeof ctx.appendEntry === "undefined"` inside `session_start`.
- **Consequence for our code:** every output site needs `pi` (or a sink bound from it) as well as `ctx`. Current state:

| Output site | Holds `pi` today? |
|---|---|
| `notify(ctx, pi, msg)`, `emitContextCascade`, `emitUpdateNoOpCascade`, `emitReconcileAppliedContextCascade` | Yes, but typed as `ToolInventory` (`notification-dispatch.ts:271-275, 407-460`). Widen the view. |
| `notifyUsageError`, `notifyUsageInfo`, `notifyDiagnostic`, `makeRawNotifyFn`, `notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap` | **No. `ctx` only** (`notification-dispatch.ts:112, 119, 142, 167, 200, 347`). These are the D2 raw surfaces and each needs a signature change. |
| `resources_discover` handler | Yes: `applyReconcile({ ctx, pi, ... })` (`index.ts:116`). The last-ditch `makeRawNotifyFn(ctx)` calls at `index.ts:126, 147` need `pi` added. |
| Async-rewake exit handler | Yes: `spawnAndRegister(..., ctx, pi, ...)` (`bridges/hooks/async-rewake/registry.ts:187-193`) |
| Stop-cap (`reenterBounded`) | Yes: `(runtime, pi, ctx, ...)` (`bridges/hooks/settle.ts:370-375`) |
| LLM tools (`edge/handlers/tools.ts:75-82, 401-407`) | Not an output site. Tools return `{content, details}` to the LLM and never call `notify`. **Leave out of scope.** |

- **Lifecycle constraints on the `pi` object** (these are why a bound sink must be *called late*, never captured early):
  - During the factory body, `appendEntry` **throws** `"Extension runtime not initialized..."`. The runtime is created with `notInitialized` stubs (`pi/dist/core/extensions/loader.js:106-108, 119`) that `bindCore` replaces later (`runner.js:190`). We never emit at load time today; keep it that way.
  - After `/reload` invalidates the old runtime, `pi.appendEntry` **throws** the stale message (`assertActive`, `loader.js:111-115, 288-291`). `ctx.mode` and `ctx.ui` throw the same way (`runner.js:535-542`). The async-rewake generation guard (`registry.ts:420-428`) already drops prior-load exits, and the existing try/catch around the notify call must cover the append too.

### Q2. `--no-session` and "before a session exists"

- **Works under `--no-session`.** `main.js:284-285` selects `SessionManager.inMemory(...)`, which is constructed with `persist = false` (`session-manager.js:1274-1276`). `appendCustomEntry` (`:855-866`) still pushes the entry and `_appendEntry` (`:770-775`) still runs. Only `_persist` returns early (`:740-742`). `agent-session.js:2131-2137` then emits `entry_appended`. Measured: the entry appeared on stdout under `--no-session`.
- **A session object always exists** by the time any handler runs, because `bindExtensions` runs after session creation. The only "no session" window is the factory body, where the call throws (Q1).
- **Correction to D4 ("saved to session file"):** even *with* a session, nothing reaches disk until an assistant message exists. `flushed = false` at construction (`session-manager.js:593`), and `_persist` defers while `!hasAssistant` (`:743-752`). Measured: a session-backed `--mode json "/probe"` run wrote **no** `.jsonl`. This does not block anything, since the stdout stream is the product. But the milestone should not promise that JSON output persists for slash-only runs.

### Q3. Exact wire serialization

- **Event shape:** `AgentSessionEvent` arm `{ type: "entry_appended"; entry: SessionEntry }` (`pi/dist/core/agent-session.d.ts:56-58`). The entry is built in `appendCustomEntry` (`session-manager.js:856-863`) with this key order: `type, customType, data, id, parentId, timestamp`. `CustomEntry<T>` is `{ type: "custom"; customType: string; data?: T }` plus the base fields (`session-manager.d.ts:81-85`).
- **JSON mode** writes `JSON.stringify(toJsonEvent(event)) + "\n"` (`pi/dist/modes/print-mode.js:84-87`). `toJsonEvent` passes every non-`message_update` event through unchanged (`modes/json-event.js:16-19`). The first stdout line is the session header (`print-mode.js:97-101`).
- **RPC mode** writes `serializeJsonLine(toJsonEvent(event))` (`modes/rpc/rpc-mode.js:265-266`). `serializeJsonLine` is `JSON.stringify(value) + "\n"` with LF-only framing (`modes/rpc/jsonl.js:3-10`).
- **Measured line (json mode):**
  ```
  {"type":"entry_appended","entry":{"type":"custom","customType":"probe","data":{...},"id":"3531028b","parentId":"06821977","timestamp":"2026-09-28T21:02:56.933Z"}}
  ```
- **`data` round-trip rules.** `data` is plain `JSON.stringify` with no Pi-side transform:
  - `undefined`-valued keys are **dropped** (measured: `{u: undefined}` vanished).
  - `null`, booleans, nested arrays, and floats survive (measured).
  - U+2028 inside strings is emitted raw. That is valid because framing is LF-only (measured, and `jsonl.js:3-7`).
  - `BigInt` or a cycle makes `JSON.stringify` **throw synchronously inside the subscriber**. `_emit` has no try/catch (`agent-session.js:333-337`), so the throw propagates **out of our `pi.appendEntry(...)` call** in `json`/`rpc` mode but not in `tui`. The compiled-validator test is the guard.
  - `Error` instances serialize as `{}`, and `Map`/`Set` serialize as `{}`. Project plain objects only.
  - The entry holds `data` **by reference** in the in-memory session (`session-manager.js:856-863`). Build a fresh object per emission and never mutate it afterwards. Otherwise a later RPC `get_entries` returns different bytes than the ones streamed.
- **Precedent:** Pi uses this pattern itself. Its bug-report bundle defines `BUG_REPORT_CUSTOM_ENTRY_TYPE = "pi.bug-report"` with `schemaVersion: 1` (`pi/dist/bundle/chunks/chunk-CMRUVXTE.js`). Our `"claude-plugin"` custom type with a payload-level `schemaVersion` matches Pi's own convention. The session header `"version": 3` is Pi's own and unrelated to ours.

### Q4. Headless invocation without a model: YES

- `pi --mode json --no-session --offline -ne -e <ext> "/claude:plugin list" </dev/null` runs the command with **no provider, no credentials, and no `--model`**. Measured: hermetic agent dir with empty `auth.json`, exit 0, entry streamed.
- **Why it works:**
  - `main.js:737-740` exits 1 only if `session.model` is falsy.
  - `pi-agent-core` seeds a placeholder model `{id:"unknown", provider:"unknown", ...}` (`pi/node_modules/@earendil-works/pi-agent-core/dist/agent.js:18-22`). Measured: `ctx.model` is `unknown/unknown`.
  - `session.prompt` dispatches extension commands first (`agent-session.js:944-950`), before model/auth validation (`:985-996`).
- **Gotchas for a harness:**
  - **Close stdin.** Non-RPC modes read piped stdin (`main.js:707-709`). The first measured run with an inherited open stdin hung until the 60 s timeout. Use `stdio: ["ignore", "pipe", "pipe"]`.
  - `--mode json` alone selects json (`main.js:84-86`), so `-p` is redundant.
  - **Exit code is 0 even when the command throws.** `_tryExecuteExtensionCommand` catches the error and routes it to `emitError` (`agent-session.js:1076-1083`). Print/json then writes `Extension error (command:<name>): <msg>` to **stderr** (`print-mode.js:78-79`) and stdout carries only the header. Exit 1 is reserved for text-mode assistant errors (`print-mode.js:110-118`). JSON consumers must judge success from payload `severity`, as PROJECT.md already states.
  - Use `-ne -e <path>` for a hermetic extension set and `HOME` + `PI_CODING_AGENT_DIR` for a hermetic agent dir.

### Q5. typebox 1.x idioms for the versioned wire schema

- **Shape:** an envelope object per `kind`, each carrying `schemaVersion: Type.Literal(1)` and `kind: Type.Literal("...")`, with `{ additionalProperties: false }`, collected in `Type.Union([...], { $id, title })`. Measured behavior:
  - `Type.Literal(1)` emits `{"type":"number","const":1}`.
  - The union emits `anyOf`.
  - `additionalProperties: false` rejects extra keys (`Check` returned `false`).
  - Root `$id`/`title` options survive into the JSON output.
- **No `Type.Discriminated` in 1.x.** Measured: `"Discriminated" in Type === false`. A union of literal-tagged objects is the idiom, and TS narrows `Static<>` on `kind` normally.
- **Types:** `export type ClaudePluginPayload = Type.Static<typeof CLAUDE_PLUGIN_PAYLOAD_SCHEMA>` (house idiom `plugin.ts:86`). Derive the model types from the schema, not the reverse. Otherwise the text and JSON strategies can drift from the wire contract.
- **Optional fields:** `Type.Optional` makes `Check` accept an explicit `undefined` (measured). In this codebase `Static<>` yields `T | undefined` under `exactOptionalPropertyTypes` (`plugin.ts:11` comment). Serialization drops the key. **Prefer required fields with empty arrays or `Type.Null()` unions in the wire schema.** A fixed shape is kinder to `jq` consumers and avoids the "optional-field silent-omission" class the project has already shipped three times.
- **Validators:** `export const CLAUDE_PLUGIN_PAYLOAD_VALIDATOR = Compile(CLAUDE_PLUGIN_PAYLOAD_SCHEMA)`, following the house pattern (`plugin.ts:89`). Use it in the JSON capture helper and in a per-`kind` fixture test. Whether production also validates before emitting is a design choice. It is cheap, but it adds a failure path at an NFR-2 boundary, so if it is done, degrade to a debug log and never throw.
- **Publishing:** commit `JSON.stringify(schema, null, 2)` with an explicit `$schema: "https://json-schema.org/draft/2020-12/schema"` added via the options bag (typebox 1.x targets 2020-12 natively: `node_modules/typebox/readme.md:159, 334`) as a docs artifact next to `docs/output-catalog.md`. Lock it with a drift test that compares the committed file to the live schema. This mirrors how `output-catalog.md` locks the text bytes, and it plants a real diff rather than reading config.
- **No dual-instance hazard:** Pi ships its own nested `typebox@1.3.27` (`pi/package.json:68`), but `appendEntry` takes `unknown` data, so our schema objects never cross into Pi's typebox.

### Q6. `ctx.mode` on every context we receive: YES

- `ExtensionMode = "tui" | "rpc" | "json" | "print"` (`types.d.ts:209`). `ExtensionContext.mode` is at `:214`.
- The contexts that reach our output sites all carry it:
  - command handlers: `ExtensionCommandContext` (`:901`, `extends ExtensionContext` at `:255`)
  - every `pi.on` handler: `ExtensionHandler` ctx (`:907`), which includes `resources_discover` and `session_start`
  - tool `execute` ctx (`:373`)
  - `ProjectTrustContext` (`:399`), which we do not use
- **It is a live getter**, re-read on each access and guarded by `assertActive` (`runner.js:539-542`). It defaults to `"print"` until `bindExtensions` runs (`runner.js:149, 296-299`).
- **Bound values:**
  - `tui`: `modes/interactive/interactive-mode.js:1419, 1615, 1937`
  - `rpc`: `rpc-mode.js:232`
  - `json`/`print`: `print-mode.js:54`
- Measured: `json` in a json run and `rpc` in an RPC run.
- `hasUI` is true only for `tui` and `rpc` (`runner.js:345-347`; `pi/docs/rpc.md:1205`).
- **`ExtensionMode` is not exported from the package root.** `pi/dist/index.d.ts:8` omits it, and the package `exports` map has only `.`, `./rpc-entry`, `./client`, `./experimental/plugin`. Derive it in `platform/pi-api.ts` as `export type ExtensionMode = ExtensionContext["mode"];`. This is the same structural-derivation pattern the file already uses for `AgentMessage`/`StopReason` (`pi-api.ts:123-125`).

## Integration With `platform/pi-api.ts`

Keep `pi-api.ts` the sole Pi import site and extend its consumer-owned views. Add no new wrappers beyond these:

```ts
// Derived: not root-exported by the peer (index.d.ts:8).
export type ExtensionMode = ExtensionContext["mode"];

// Consumer-owned view of ExtensionAPI.appendEntry (types.d.ts:991),
// mirroring the ToolInventory pattern.
export interface EntrySink {
  appendEntry(customType: string, data?: unknown): void;
}

// NotificationContext gains the selector. Every fake must now declare a mode
// (D7), and the compiler enforces it.
export interface NotificationContext {
  readonly ui: NotificationUi;
  readonly mode: ExtensionMode;
}
```

- The existing `ToolInventory` parameter becomes `ToolInventory & EntrySink` at the dispatch seam, or a named intersection. The real `ExtensionAPI` satisfies both structurally.
- Read `ctx.mode` **at emit time**. Never cache it at factory time: no ctx exists then, and a reload re-binds the mode.
- Type-only re-exports for tests: `CustomEntry`, `JsonAgentSessionEvent`.

## Pi Timing Constraints the Roadmap Must Absorb

These are Pi behaviors, not choices we control. All three were measured.

1. **Startup `session_start`/`resources_discover` emissions are not streamed in `json` or `rpc`.** `bindExtensions` fires both events (`agent-session.js:2029-2030`) *before* the mode subscribes to session events (`print-mode.js:53` vs `:84`; `rpc-mode.js:230` vs `:265`). Measured in both modes: the entries exist in `ctx.sessionManager.getEntries()`, but no `entry_appended` line is written.
   - Affected output: the load-time reconcile cascade (`applyReconcile`), `reconcile aborted`, and the plugin-PATH warnings.
   - RPC clients can recover these through `{"type":"get_entries"}` (`pi/docs/rpc.md:718-727`).
   - `json`-mode consumers cannot. The entries are in memory only and are never written to disk (Q2).
   - The `/reload` path emits after the subscriber is attached (`agent-session.js:2339-2340`), so reload-time reconcile output *should* stream. That is source-read only, not measured: **MEDIUM**.
2. **Emissions after the command handler resolves are lost in `json` mode.** `runPrintMode` disposes the runtime right after `prompt()` returns (`print-mode.js:104-109, 134-139`). Measured: an append inside the awaited handler streamed, and a `setTimeout(0)` append after return did not. Every `/claude:plugin` output must be emitted before the handler's promise settles. Current handlers await their orchestrators, so this is a rule to keep, not a fix to make. Hook-originated output (rewake, Stop-cap) fires during an agent turn, which is inside `prompt()`.
3. **`ctx.ui.notify` is live in `rpc`.** RPC forwards it as `{"type":"extension_ui_request","method":"notify","message":...,"notifyType":...}` (`rpc-mode.js:87-96`; `pi/docs/rpc.md:1191, 1277-1291`). Measured. It is a no-op only in `print`/`json` (`runner.js:113-117`, installed when `uiContext` is undefined at `:296-297`). Under D3, `rpc` → JSON only, which means an RPC front-end that renders `notify` text today will stop seeing `/claude:plugin` text. This does not re-open D3, but requirements should state it explicitly as accepted behavior.

**Typed errors (D3/D6):** a *thrown* handler error reaches `json` consumers only as a stderr line, while stdout gets nothing and the exit code is 0 (measured). In `rpc` it arrives as `{"type":"extension_error",...}` (measured).
- The `browse`-outside-`tui` error (D6) has a known strategy (JSON), so it should be *emitted* as an error-severity payload. Throwing it would leave the stream empty.
- Only the unknown-`mode` case (D3's default arm) has no strategy and must throw.

## Installation

```bash
# Nothing to install. typebox ^1.1.38 and the Pi peer >=0.86.1 are already declared.
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `pi.appendEntry("claude-plugin", payload)` (D4) | `pi.sendMessage({customType, content, display, details})` | Never, for this purpose. Custom *messages* participate in LLM context (`pi/docs/extensions.md:1457`), which D4 exists to avoid. |
| `typebox` `Compile().Check/Errors` | `ajv` | Only if a consumer needed ajv-specific keywords or formats. Not the case: typebox's JIT validator covers Draft 3 through 2020-12 (`node_modules/typebox/readme.md:159`). |
| Committed JSON Schema + drift test | Generating the schema at publish time (`prepack`) | If the schema were large or derived from many modules. A drift test keeps it reviewable in PRs and needs no build step, which fits "no bundler/build step". |
| Deriving `ExtensionMode` from `ExtensionContext["mode"]` | Deep import from `pi/dist/core/extensions/types.js` | Never. The `exports` map blocks deep imports, and derivation is the established pattern. |
| Literal-tagged `Type.Union` of objects | A single object with a `kind` enum and optional per-kind fields | Never. It loses `Static<>` narrowing and pushes consumers back to optional-field guessing. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `ajv`, `zod`, `valibot`, or any second schema library | Duplicates typebox. Two sources of truth for the wire contract. | `typebox` + `typebox/compile` |
| `json-schema-to-typescript`, `quicktype`, `@sinclair/typebox-codegen` | `Type.Static<>` already derives types from the schema, so codegen would invert the source of truth | `Type.Static<typeof SCHEMA>` |
| `@sinclair/typebox` (0.x package name) | The legacy line. 0.x schemas carry symbol `Kind` keys, so `JSON.stringify` is not a faithful export. The house uses the `typebox` 1.x package. | `typebox@^1` |
| Direct `process.stdout.write` of JSON (a "just print it" shortcut) | Forbidden by IL-2/D8 and by both ESLint and the fallow rule pack. It would not work anyway: non-interactive modes redirect `process.stdout.write` to **stderr** (`pi/dist/core/output-guard.js:38-50`). | `pi.appendEntry` |
| A per-command `--json` flag or `pi.registerFlag` | D3. Mode selection comes from `ctx.mode` only. | Exhaustive `switch (ctx.mode)` |
| `pi.registerEntryRenderer("claude-plugin", ...)` | TUI-only rendering of custom entries (`types.d.ts:975`; `docs/extensions.md:1659`). `tui` uses the text strategy and never appends. | Nothing, since the text strategy covers `tui` |
| Emitting from the extension factory body, or caching `pi`/`ctx.mode` across `/reload` | `appendEntry` throws before `bindCore` (`loader.js:106-108, 119`) and after invalidation (`loader.js:111-115`) | Resolve the sink and mode at each emit |
| Bumping the Pi peer floor to 0.87.x for this milestone | No relevant surface changed (checked in the 0.87.1 tarball). A bump only widens the NFR-11 audit. | Keep `>=0.86.1` |

## Stack Patterns by Variant

**If `ctx.mode` is `"tui"`:**
- Text strategy through `ctx.ui.notify` (bytes locked by `docs/output-catalog.md`). `browse` uses the interactive strategy.
- No `appendEntry`, because `tui` users read notifications, and appending would also grow the session file with unrendered entries.

**If `ctx.mode` is `"print"`:**
- Text strategy. Pi discards it through the no-op UI (`runner.js:113-117`). Silence is the accepted D5 behavior.
- Do not "helpfully" append entries. Print mode writes nothing but the final assistant text (`print-mode.js:110-126`).

**If `ctx.mode` is `"json"` or `"rpc"`:**
- JSON strategy: exactly one `pi.appendEntry("claude-plugin", payload)` per logical notification, where the one-`notify`-per-invocation discipline maps to one-entry-per-invocation.
- Payload built fresh, JSON-safe, and validated in tests with the compiled validator.

**Any other value:**
- Typed error thrown (TS forces the arm through the `switch-exhaustiveness-check` rule the repo already uses). At runtime this reaches stderr/`extension_error`, not the JSON stream.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@earendil-works/pi-coding-agent@0.86.1` (installed) | `@earendil-works/pi-coding-agent@0.87.1` (latest) | `ExtensionMode`, `ExtensionContext.mode`, `appendEntry`, `entry_appended`, and the bind-then-subscribe order in `print-mode.js`/`rpc-mode.js` are unchanged. The 0.87.x changelog touches `--mode` validation only: invalid values now exit nonzero. |
| `typebox@1.3.31` (ours) | Pi's nested `typebox@1.3.27` | Independent copies. No schema object crosses `appendEntry` (it takes `unknown`). |
| `typebox@^1.1.38` | Node `>=20.19` ESM, TS `^6` | 1.x is ESM-only and developed against TS 7 (`typebox/readme.md:334`). It is already in use under the project toolchain. |

## Sources

All HIGH confidence unless marked. Primary sources are the installed package and measured runs; no third-party web source was needed.

- `pi/dist/core/extensions/types.d.ts`: `:209, :214, :216, :255, :373, :399, :901, :907, :991, :1203`
- `pi/dist/core/extensions/loader.js`: `:106-119` (throwing stubs), `:111-115` and `:288-291` (`assertActive` wrapper)
- `pi/dist/core/extensions/runner.js`: `:113-145` (no-op UI), `:149` (default mode), `:190` (bindCore), `:296-299` (setUIContext), `:345-347` (hasUI), `:535-546` (live `mode` getter)
- `pi/dist/core/agent-session.js`: `:333-337` (`_emit`, no try/catch), `:944-950` / `:985-996` (command before model check), `:1062-1084` (handler error capture), `:2009-2031` (bindExtensions fires `session_start` + `resources_discover`), `:2131-2137` (`appendEntry` → `entry_appended`), `:2339-2340` (reload path)
- `pi/dist/core/agent-session.d.ts:56-58`; `pi/dist/core/session-manager.d.ts:81-85`
- `pi/dist/core/session-manager.js`: `:593, :740-752, :770-775, :855-866, :1274-1276`
- `pi/dist/modes/print-mode.js`: `:53-54, :78-79, :84-88, :97-101, :104-139`; `pi/dist/modes/json-event.js:16-19`
- `pi/dist/modes/rpc/rpc-mode.js`: `:24, :87-96, :230-232, :265-266`; `pi/dist/modes/rpc/jsonl.js:3-10`
- `pi/dist/main.js`: `:80-91, :284-285, :707-709, :737-740`; `pi/dist/core/model-resolver.js:297-299`; `pi/node_modules/@earendil-works/pi-agent-core/dist/agent.js:18-22`
- `pi/dist/core/output-guard.js:38-50`; `pi/dist/index.d.ts:8, :20, :28`; `pi/package.json:9-11, :68`
- `pi/docs/extensions.md:1457, 1510-1512, 1659, 992-994`; `pi/docs/rpc.md:718-727, 1191, 1205, 1277-1291`
- Measured probes (scratchpad extension, real `pi` bin, hermetic agent dir):
  - json mode with no model: works; entry streamed; startup entries absent; post-return timer entry absent
  - print mode: silent, exit 0
  - rpc: `notify` forwarded as `extension_ui_request`, entry streamed, startup entry absent
  - thrown handler error: json → stderr + exit 0; rpc → `extension_error`
  - session-backed slash-only run: no `.jsonl` written
- `typebox@1.3.31` behavior measured in-process: union/literal JSON output, `additionalProperties:false` rejection, `Optional` + `undefined`, `.Errors()` shape, no symbol keys, no `Type.Discriminated`
- npm registry (2026-09-28): `typebox` latest 1.3.34; `@earendil-works/pi-coding-agent` latest 0.87.1 (tarball inspected for API diffs)

---
*Stack research for: json-output (mode-keyed presentation strategies)*
*Researched: 2026-09-28*
