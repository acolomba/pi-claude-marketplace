# Phase 8: Background Autoupdate - Research

**Researched:** 2026-10-26
**Domain:** Pi extension lifecycle hooks (`input`, `session_shutdown`), in-process concurrency gate, raw load-origin notification kind, cucumber RPC driver
**Confidence:** HIGH (every seam read in this session; no new package)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Trigger, timing, and lifetime (AUP-01)

- **D-PL8-01: the background pass is not a load.** APL-D1 still holds: a load (`/reload`, session start) changes no installation state. The pass is a separate run that starts after the first message, touches only marketplaces whose autoupdate is on (the user's opt-in), and runs `marketplace update`'s refresh and cascade. NFR-5 amendment (for PROJECT.md): the background autoupdate pass runs `marketplace update`'s code for each marketplace with autoupdate on, so it may use the network as that command does, with stored credentials only (D-PL8-12).
- **D-PL8-02: arm on the first message, run once per extension runtime.** The pass arms on the runtime's first Pi `input` event (a submitted prompt that is not an extension command, which is Claude Code's "after you send your first message"), only in an interactive mode: `ctx.mode` `tui` or `rpc` (Pi's `hasUI` modes). `print` and `json` never arm (Claude Code: interactive sessions only). It waits `Math.floor(random() * maxDelay)` ms with `maxDelay` = 600 000 (10 minutes, the binary's constant) on an unref'd timer, then runs once. A later `input` in the same runtime does nothing. A new runtime (`/reload`, new, resume, fork) arms again on its own first message.
- **D-PL8-03: teardown and NFR-2.** `session_shutdown` cancels a pending timer and stops further steps. For `reload`, `new`, `resume`, and `fork` it awaits the step in flight, so the next runtime's load pass never meets this runtime's state lock. For `quit` it returns at once (the process ends; `proper-lockfile` releases its locks on exit). No throw escapes the `input` handler, the `session_shutdown` handler, or the timer callback: each failure goes to `hookDebugLog`, as `resources_discover` and `session_start` do today.

#### Foreground priority and lock contention (AUP-01)

- **D-PL8-04: an in-process gate gives `/claude:plugin` commands priority.** Every `/claude:plugin` command invocation runs through the gate's `runForeground`: it waits for the background step in flight and holds back further steps until the command returns. A background step is one marketplace refresh (`updateMarketplace` up to its cascade) or one plugin update; the pass checks the gate before its first step and yields between plugin updates (the cascade runs outside the scope lock, MU-4), so a command waits at most one step. So no command in this Pi process is refused `{lock held}` or reads a half-done step because of the background pass. The wait is silent. Commands are not serialized among themselves (unchanged).
- **D-PL8-05: the background pass skips what another process holds.** A step that meets `StateLockHeldError` (another Pi process holds the scope lock) is skipped for this pass and not retried in this runtime; the next runtime's pass tries again. A command in another Pi process can still meet `{lock held}` while this process's background step holds the lock: the same exposure two concurrent commands in two processes have today, under D-06 (`retries: 0`) unchanged.

#### Reuse (AUP-01)

- **D-PL8-06: the pass reuses `marketplace update <name>`.** For each scope (project first, MSG-GR-3) and each recorded marketplace whose merged config `autoupdate` is true (the value the cascade itself reads), the pass calls `updateMarketplace` with: a load-origin run (`{ kind: "load" }`) whose output sink and context are silent (the per-marketplace rows are not shown; their text goes to `hookDebugLog`), and the plugin update runner from `beginPluginUpdateRun`, wrapped to yield to the gate before each plugin and to collect each `updated` outcome. Refresh, cascade, dependency handling, rollback, and cache drop stay in `update.ts` and `update-flow.ts`, unchanged. An `InvalidGitHubBaseUrlError` that `updateMarketplace` rethrows ends the pass silently (debug log).

#### Defaults and opt-outs (AUP-02)

- **D-PL8-07: per-marketplace default stays "off unless the config sets it".** Claude Code's default-on set is the official names; in this project the official marketplace gets `autoupdate: true` from `bootstrap` (MPA-01, `features/plugin/bootstrap.feature`), and Phase 5's reserved-name refusal (MKT-01) keeps `bootstrap` the route to an official name. Claude Code's other default-on sources (`claudeai`, `pluginDirectory`) have no Pi counterpart (capability gap). Precedence maps directly: config local entry, then base entry (LAYER-09), then off; Claude Code: settings entry, then `known_marketplaces.json`, then the default. `marketplace/autoupdate.ts` is not changed.
- **D-PL8-08: Claude Code's opt-out variables, same names and rule.** `DISABLE_UPDATES` (truthy), `DISABLE_AUTOUPDATER` (truthy), or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` (any non-empty value) turn the pass off unless `FORCE_AUTOUPDATE_PLUGINS` (truthy) is set. Truthy is `1`, `true`, `yes`, or `on`, case-insensitive, trimmed (the binary's `Ne`). The pass reads them when it arms. Not mapped: Claude Code hides the `/plugin` toggle when the pass is off, but `marketplace autoupdate` / `noautoupdate` stay available here because the flag also scopes the manual `marketplace update` cascade; Claude Code's global-config `autoUpdates` and host-pin variables are Claude Code binary settings with no Pi meaning and are not read.
- **D-PL8-09: one Pi-only knob for the delay.** `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS`, a non-negative whole number of milliseconds, replaces the 10-minute maximum of the random delay; `0` runs the pass right after the first message. Any other value is ignored (the 10-minute maximum applies). It exists so the behavioral test and an operator can run the pass without waiting up to ten minutes; it follows the `PI_CLAUDE_MARKETPLACE_*` naming of the extension's other variables.

#### The notice (AUP-03)

- **D-PL8-10: one load-origin notice kind, `background-update`.** After the pass, when at least one plugin moved (an `updated` outcome), the pass raises one `background-update` notice through `shared/notification-dispatch.ts` with the real context and a load-origin run; otherwise it is silent. Failures, skips, and up-to-date results are debug-logged only (Claude Code logs them). Text, after Claude Code with Pi's reload command, names deduplicated by `<plugin>@<marketplace>`:
  - one plugin: `Plugin updated: alpha · Run /reload to apply`
  - two: `Plugins updated: alpha and beta · Run /reload to apply`
  - three or more: `Plugins updated: 3 plugins · Run /reload to apply`
  Severity `info`. JSON wire payload: `kind: "background-update"`, `origin: { kind: "load" }`, `severity: "info"`, `needsReload: true`, `plugins: [{ name, marketplace, scope, fromVersion?, toVersion }]` in pass order, one row per updated install (a plugin updated in both scopes has two rows).
- **D-PL8-11: no in-session reload.** Claude Code reloads command-sourced plugins in the running session; this project has no command source kind, so the notice always asks for `/reload`.
- **D-PL8-12: stored credentials only.** The pass's load-origin run makes `buildAuthForHost` return a stored-credential bundle with no Device Flow (existing AAP-02 / D-13 behavior), matching Claude Code's "never prompts".

### Claude's Discretion

- Module split, names, and test layout, inside the Files line: the gate, the scheduler, the pass, and the env policy live in new `orchestrators/marketplace/` modules (the gate may be its own module).
- The debug-log wording and category.

### Deferred Ideas (OUT OF SCOPE)

- Settling missing dependencies after a background update (Claude Code does it in the same pass): Phase 2 (RCN-06) owns the dependency step; the pass inherits whatever the reused cascade does.
- Retrying a marketplace skipped for a lock another process held, within the same runtime.
- A visible "waiting for background update" line while a command waits on the gate.

### Files note (from CONTEXT, binding)

The Files line names `index.ts`, the new background module(s), `marketplace/autoupdate.ts` (defaults only), `shared/notification-types.ts` (one kind), and `docs/`. A new raw kind needs an arm in each exhaustive consumer (`notification-resolve.ts`, `notification-grammar.ts`, `notification-json.ts`, `notification-wire.ts`, `notification-dispatch.ts`) and the matching tests and docs; the foreground gate needs `edge/register.ts` to run the command handler through it; the behavioral test needs a world helper and steps under `features/`. Each is a minimal, additive change, recorded in the SUMMARY under files touched outside the Files line. `marketplace/autoupdate.ts` stays untouched (D-PL8-07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUP-01 | With autoupdate on for a marketplace, a session refreshes that marketplace and updates its installed plugins in the background after a delay, as Claude Code does, without blocking or racing a foreground command (AUTOUP-01) | §"index.ts wiring" (Pi `input`/`session_shutdown` shapes and ordering), §"The pass" (`updateMarketplace` reuse, wrapper over `beginPluginUpdateRun`), §"The foreground gate" (`register.ts` options bag), Pitfalls 1-6 |
| AUP-02 | The default autoupdate setting per marketplace and the operator opt-outs match Claude Code, mapped to Pi where Pi lacks the concept, with each mapping recorded (AUTOUP-01) | §"Env policy" (truthy parser, delay parse with the 32-bit timer ceiling), §"Docs" (`docs/env-vars.md` section; NFR-5 amendment in PROJECT.md/AGENTS.md) |
| AUP-03 | When a background update changed anything, the user gets one passive notice that names what changed and the `/reload` step (AUTOUP-01) | §"New raw kind `background-update`: every site" (11 production arms + 9 test/doc gates), §"Behavioral test" |
</phase_requirements>

## Project Constraints (from AGENTS.md)

- Read a file before editing; trace callers before modifying a function.
- Never commit to `main`; commit via `.agents/skills/committing/SKILL.md`; never `--no-verify`; never rebase.
- Plan `SUMMARY.md` files MUST include `## Threat Flags` (even "None").
- A `/claude:plugin`-visible behavior change ships with a cucumber scenario under `features/` that **fails without the change** (unit tests do not replace it).
- `npm run check` is the only full verdict; GSD gates (wave post-merge, phase, merge) run it on the combined tree. The commit hook runs `check:commit` only.
- Upstream parity is the default; divergences need a recorded decision ID or a Pi capability gap (CONTEXT records each: D-PL8-02 once-per-runtime, D-PL8-09 delay knob, `/reload` wording).
- Node `^22.22.2 || ^24.15.0 || >=26.0.0`; TypeScript strict (`exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `noImplicitReturns`).
- NFR-1 atomic writes (no new writes here), NFR-2 no Pi restart / no throw out of a lifecycle handler, NFR-3 retry-safe, NFR-5 network policy (needs the D-PL8-01 amendment), NFR-10 containment (unchanged: all writes go through reused code).
- Output channel IL-2: only `shared/notification-dispatch.ts` calls `ctx.ui.notify` / `appendEntry`; no `process.stdout`/`stderr`, no `console.*` except the two sanctioned sites. Debug output goes through `shared/debug-log.ts::hookDebugLog`.
- Scope model: exactly `user` and `project`; iterate project first (MSG-GR-3).
- Quality bar: typecheck + ESLint (`--max-warnings 0`, sonarjs recommended in production, cognitive complexity 15) + fallow (dead code with `includeEntryExports`, health cyclomatic 20 / cognitive 15, dupes fail on any clone group, boundary zones, rule pack) + Prettier + source/test pairing + 100% direct line/function/branch coverage per pair.
- Comments cite durable IDs (D-PL8-NN, AUP-NN, NFR-N), never phase/plan numbers; no comments on trivial code.
- Errors: typed classes, `instanceof` discrimination, never message matching.
- DI over test seams: no `_setXForTest`, no `__`-members (gated by `test/architecture/no-test-only-production-surface.test.ts`), no live boundary as a parameter default; real adapters bound in one composition module (`index.ts`).

## Summary

Everything this phase needs already exists as a seam; the work is wiring, one new raw notification kind, and one in-process gate. `updateMarketplace` (`orchestrators/marketplace/update.ts:243`) already does the whole refresh-then-cascade, takes an optional `gitOps` (so the new module never has to name `gitOps`/`DEFAULT_GIT_OPS`, which ESLint BLOCK F would reject), converts a held state lock into a failed row instead of throwing (`update.ts:730-733`), and rethrows only `InvalidGitHubBaseUrlError`. The cascade calls the injected `PluginUpdateFn` once per installed plugin, sequentially and outside the scope lock (`update.ts:568-581`), which is exactly the yield point D-PL8-04 needs: a wrapper around `beginPluginUpdateRun`'s function can release the gate, re-acquire it, run the real update, and collect `partition === "updated"` outcomes. A load-origin run already gives stored credentials only (`auth-host.ts:186`).

Pi delivers what the scheduler needs: `input` fires for a non-command prompt before the model check (`agent-session.js:1611-1651`), `session_shutdown` carries `reason: "quit" | "reload" | "new" | "resume" | "fork"` and Pi awaits each handler (`runner.js:813-840`). After teardown the old `pi`/`ctx` throw a stale-context error (`runner.js:482-490`), so the notice must be suppressed after `session_shutdown` and every emission wrapped. Node clamps a timer delay above 2 147 483 647 ms to 1 ms with a `TimeoutOverflowWarning` (verified locally), so the delay parser must reject such values.

The largest mechanical cost is the new raw kind: 11 production arms across 6 `shared/notification-*.ts` files, the regenerated `schema/claude-plugin.schema.json`, and 9 test/doc gates that enumerate raw kinds or payload kinds (two count to 22 and must become 23). The behavioral test needs one harness change outside `features/`: `test/e2e/_rpc.ts::rpcChildEnvironment` is an allowlist and drops any new variable, so `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS` cannot reach a dedicated Pi until that function (and its pin in `test/architecture/hermetic-git-environment.test.ts`) learns it.

**Primary recommendation:** Build one factory module `orchestrators/marketplace/background-update.ts` (gate + scheduler + pass, DI for timers/random/env/`updateMarketplace`/`beginPluginUpdateRun`), optionally split the env policy into `background-update-policy.ts`; pass its closure handlers to `pi.on` by reference from `index.ts` so `index.ts` gains no branch; add `runForeground` as an optional member of `registerClaudePluginCommand`'s existing `options` bag; add `background-update` as a fourth `LoadSurface` member following the `plugin-path-skipped` pattern for severity and the `mcp-migration` pattern for `needsReload`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Arm on first `input`, cancel on `session_shutdown` | entry (`index.ts`) | orchestrators (handler closures) | Only `index.ts` owns `pi.on`; the closures live in the orchestrator so `index.ts` stays branch-free |
| Foreground priority gate | orchestrators/marketplace (new) | edge (`register.ts` calls `runForeground`) | Gate state is per extension runtime; edge only wraps the handler, imports nothing new |
| Env policy (opt-outs, delay) | orchestrators/marketplace (new, pure) | entry binds `process.env` | `process.env` read inside logic is a hidden dependency (unit-test rules) |
| Refresh + cascade | orchestrators/marketplace/update.ts (reused) | orchestrators/plugin/update-flow.ts (reused) | D-PL8-06: no new refresh/cascade |
| Network + auth | orchestrators/auth-host.ts (reused) | platform/git.ts | load origin => stored credentials (D-PL8-12) |
| Notice text/JSON | shared/notification-* | — | IL-2 single chokepoint; text composed only in grammar |
| Behavioral proof | features/ + test/e2e/_rpc.ts | — | RPC-driven dedicated Pi |

## Standard Stack

No new runtime or dev dependency. Everything is in-repo or already installed.

| Component | Version (verified) | Use |
|-----------|-------------------|-----|
| `@earendil-works/pi-coding-agent` | 1.3.0 (`node_modules/.../package.json`) [VERIFIED: node_modules] | `input`, `session_shutdown` events; RPC driver |
| `node:test` + `strong-mock` | Node v26.12.1 local, strong-mock 9.2.2 [VERIFIED: node -p] | unit tests |
| `@cucumber/cucumber` | 13.3.0 [VERIFIED: node -p] | behavioral scenario |
| `fallow` | 3.35.0 installed (package.json `^3.33.1`) [VERIFIED: node -p] | static gate |
| `typebox` | per package.json | wire schema member |

## Package Legitimacy Audit

No external packages are installed by this phase. **Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```text
 user prompt (tui/rpc)                    /claude:plugin <cmd>
        |                                         |
        v                                         v
 Pi agent-session.prompt()            Pi _tryExecuteExtensionCommand
        |  (non-command text)                     |
        v                                         v
 pi.on("input") ---> onInput(event, ctx)     register.ts handler
        |  mode tui|rpc? first? env on?           |
        |  yes: delay = floor(random()*max)       v
        v                                   gate.runForeground(() => runCommand(...))
 setTimeout(delay).unref()                    | waits for in-flight background step,
        |                                     | blocks new steps until it returns
        v                                     v
 pass():                                   command runs (never {lock held} from us)
   for scope in [project, user]:
     loadState(read-only) ∩ merged config autoupdate===true
     for marketplace:
        gate.acquire  ── step: updateMarketplace({ silent ctx, silent load run,
        |                        pluginUpdate: wrapped })
        |                  refresh under scope lock -> cache drop
        |                  cascade (outside lock): for plugin:
        |                       wrapped(p, mp, scope):
        |                         gate.release; if stopped -> skip
        |                         gate.acquire; outcome = real(p, mp, scope)
        |                         if outcome.partition==="updated" -> collect row
        |                  silent notifyWithContext (-> hookDebugLog)
        gate.release
   if !stopped: notifyBackgroundUpdate(realCtx, openNotificationRun(pi,{kind:"load"}), rows)
        |                                (no-op when rows empty: AUP-03 silence)
        v
 notification-dispatch: tui/print -> ctx.ui.notify(text,"info")
                        json/rpc  -> pi.appendEntry("claude-plugin", payload)

 pi.on("session_shutdown") ---> onShutdown(event):
        clear timer; stopped=true;
        reason !== "quit" ? await in-flight step : return
```

### Recommended module layout (Claude's discretion; one proposal)

```text
extensions/pi-claude-marketplace/orchestrators/marketplace/
  background-update.ts         # createBackgroundUpdate(deps): { onInput, onShutdown, runForeground }
                               #   gate + scheduler + pass (keep every function <= cognitive 15)
  background-update-policy.ts  # optional split: backgroundUpdateEnabled(env), maxDelayMs(env)
test/orchestrators/marketplace/
  background-update.test.ts
  background-update-policy.test.ts   # only if the policy module is split out
```

Every new source file needs exactly one paired test at the mirrored path and 100% direct coverage when run alone (`.agents/skills/typescript-unit-tests/rules/pairing-and-design.md`). A gate in its own module (`background-gate.ts`) is legal but costs a third pair; keeping it inside `background-update.ts` is fine if fallow health stays under the ceilings.

### Pattern 1: Handlers passed by reference (keeps `index.ts` branch-free)

`index.ts` is a direct-coverage pair with `test/index.test.ts`. Any new arrow function or `try` in `index.ts` must be executed by that test. Passing closures returned by the factory (`pi.on("input", backgroundUpdate.onInput)`) adds no function or branch to `index.ts`. Use closures, not class methods (`@typescript-eslint/unbound-method` would flag a method reference). The handler parameter can be a narrow consumer type: Pi's `ExtensionHandler<E, R = undefined> = (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void` [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:1182], so a handler taking `(event: InputEvent, ctx: { readonly mode: string; readonly cwd: string; readonly ui: NotificationUi })` and returning `void` is assignable (ExtensionContext is a subtype of the narrow shape).

### Pattern 2: Raw load surface with an outside-the-table reload flag

Copy `plugin-path-skipped` for severity (a row in `RAW_SURFACE_SEVERITY`) and `mcp-migration` for `needsReload` (decided outside the severity table). See the site inventory below.

### Anti-patterns to avoid

- **Naming the git surface in the new module.** `updateMarketplace`'s `gitOps` is optional (`readonly gitOps?: GitOps;`, update.ts:182) and defaults inside (`const gitOps = opts.gitOps ?? DEFAULT_GIT_OPS;`, update.ts:244). Omit it. Do not add the module to `NETWORK_SEAMS`.
- **Importing a plugin ledger from `orchestrators/marketplace/`.** BLOCK C forbids `orchestrators/marketplace/**` importing `update-flow.ts` (a `PLUGIN_LEDGERS` member). Take `beginPluginUpdateRun` as an injected dependency (index.ts already holds `pluginUpdateOperations.beginPluginUpdateRun`).
- **Composing text in `notification-dispatch.ts`.** `test/architecture/presentation-sink.test.ts` allows exactly six string literals there; text goes in `notification-grammar.ts`.
- **Mentioning `ui` in `notification-dispatch.ts`.** The same gate counts `\bui\b` and allows only the two `ui.notify` calls inside `deliver`.
- **Calling `Math.random()` in production code.** `sonarjs/pseudo-random` is `error` in the recommended set and flags the call expression `Math.random` (verified in `node_modules/eslint-plugin-sonarjs/cjs/S2245/rule.js`). Inject `random`; bind `Math.random` by reference in `index.ts` (a reference is not a call, and `unbound-method` treats `Math` members as natively bound).

## New raw kind `background-update`: every site

### Production arms (all required; TS `noImplicitReturns` + mapped types make most of them compile errors until added)

| # | File:line | Existing pattern (verbatim) | What to add |
|---|-----------|-----------------------------|-------------|
| P1 | `shared/notification-types.ts:1616` | `export type LoadSurface = ReconcileAbortedSurface \| PluginPathSkippedSurface \| McpMigrationSurface;` [VERIFIED: read] | `BackgroundUpdateSurface` interface (`kind: "background-update"`, `plugins: readonly BackgroundUpdatePlugin[]`) and add it to `LoadSurface`. `RawSurface` already includes `LoadSurface` (`:1711-1720`). |
| P2 | `shared/notification-resolve.ts:616-627` | `"plugin-path-skipped": "warning",` / `} as const satisfies Record<Exclude<RawSurface["kind"], "mcp-migration">, Severity>;` [VERIFIED] | Row `"background-update": "info",` (the `satisfies` forces it). |
| P3 | `shared/notification-resolve.ts:666-704` `resolveRawSurface` | arms `case "plugin-path-skipped": return { kind, scope, reason: redactCredentials(surface.reason) };` and a pass-through group `case "usage-info": ... return surface;` [VERIFIED] | An arm. Recommend passing names through and redacting the free-text version strings with `redactCredentials`, matching the policy stated at `:655-665` for fields "read from plugin and config files". `ResolvedRawSurface` (`:650-653`) needs no change if the kind resolves to its own surface type. |
| P4 | `shared/notification-grammar.ts:1324-1373` `formatRawSurface` | `case "plugin-path-skipped": return [\`plugin PATH not refreshed ...\`, RAW_SURFACE_SEVERITY[surface.kind]];` [VERIFIED] | Arm returning `[composeBackgroundUpdateText(surface.plugins), RAW_SURFACE_SEVERITY[surface.kind]]`. Compose the D-PL8-10 text here (dedupe by `<name>@<marketplace>`; `<=2` join with `" and "`, else `` `${n} plugins` ``; `Plugin` vs `Plugins`; suffix ` · Run /reload to apply`). Do not reuse `RELOAD_HINT_TRAILER` (different wording). Update the D-15 JSDoc above it. |
| P5 | `shared/notification-json.ts:175-246` `wireRawSurface` | generic envelope `needsReload: false` (`:191-196`); `case "plugin-path-skipped": return { ...envelope, kind, scope, reason };` [VERIFIED] | Arm `case "background-update": return { ...envelope, needsReload: true, kind: surface.kind, plugins: surface.plugins.map(...) };` built field by field (D-03: no spread of model rows), `fromVersion` spread only when present (WIRE-04). Update the doc comment "Only the migration notice can need a reload". |
| P6 | `shared/notification-wire.ts:715-724` | `const PLUGIN_PATH_SKIPPED_PAYLOAD = Type.Object({ ...RAW_ENVELOPE_FIELDS, kind: Type.Literal("plugin-path-skipped"), scope: SCOPE, reason: Type.String() }, { additionalProperties: false });` [VERIFIED] | `BACKGROUND_UPDATE_PAYLOAD` with `plugins: Type.Array(Type.Object({ name: Type.String(), marketplace: Type.String(), scope: SCOPE, fromVersion: Type.Optional(Type.String()), toVersion: Type.String() }, { additionalProperties: false }), { minItems: 1 })`. Optionally narrow `needsReload: Type.Literal(true)`. |
| P7 | `shared/notification-wire.ts:857-889` `NOTIFICATION_PAYLOAD_SCHEMA` | members in declared order, `...PLUGIN_PATH_SKIPPED_PAYLOAD, MCP_CONFIG_NOTICES_PAYLOAD, MCP_MIGRATION_PAYLOAD,` then the inline `internal-error` object [VERIFIED] | Insert `BACKGROUND_UPDATE_PAYLOAD`. Recommended position: after `MCP_MIGRATION_PAYLOAD`, before the `internal-error` object (keeps load kinds together and the `internal-error` last). The position fixes the order `wire-schema.test.ts` asserts. |
| P8 | `shared/notification-dispatch.ts:84-101` `isRawOutcome` | `case "plugin-path-skipped": ... case "mcp-migration": return false;` [VERIFIED] | `case "background-update":` in the `false` group (not a command outcome). |
| P9 | `shared/notification-dispatch.ts:229-235` | `function emitLoadSurface(ctx, run, surface: LoadSurface): void { emitPresentation(ctx, run, resolveRawSurface(surface)); }` [VERIFIED] | Nothing; reused. |
| P10 | `shared/notification-dispatch.ts:253-260` | `export function notifyPluginPathSkipped(ctx, run, scope, reason): void { emitLoadSurface(ctx, run, { kind: "plugin-path-skipped", scope, reason }); }` [VERIFIED] | New exported `notifyBackgroundUpdate(ctx, run, plugins)`. Recommend an early return on `plugins.length === 0` (the `notifyDiagnostic` precedent at `:326-337`), so AUP-03 silence sits at the chokepoint and the pass calls it unconditionally. No string literal other than the `kind:` discriminant (presentation-sink literal gate). |
| P11 | `schema/claude-plugin.schema.json` | generated from `NOTIFICATION_PAYLOAD_SCHEMA` by `scripts/wire-schema.mjs` (`WIRE_SCHEMA_PATH = "schema/claude-plugin.schema.json"`) [VERIFIED] | Regenerate with `npm run schema:generate` (`"schema:generate": "node scripts/generate-wire-schema.mjs"`, package.json:96). Committed file; drift test compares. |

`emitPresentation` (`notification-dispatch.ts:559+`) needs no change: for `load` origin in `json`/`rpc` it falls through to `appendEntry(run.entrySink, payload)`; in `tui`/`print` it calls `formatRawSurface(presentation)!` then `deliver`. Raw surfaces never touch `commandState.needsReload` (only `"envelope" in presentation` does), the same as `mcp-migration`.

### Test and doc gates that enumerate raw kinds or payload kinds

| # | File:line | What it pins (verbatim excerpt) | Required change |
|---|-----------|------------------------------|-----------------|
| G1 | `test/architecture/wire-schema.test.ts:88-123` | ordered list ending `{ kind: "mcp-migration", schemaVersion: 1 }, { kind: "internal-error", schemaVersion: 1 },` and `test("the committed schema has exactly 22 payload members"` ... `assert.strictEqual(memberCount, 22);` [VERIFIED] | Insert `{ kind: "background-update", schemaVersion: 1 }` at the P7 position; 22 -> 23 (title and value). |
| G2 | `test/architecture/catalog-uat/catalog-wire.test.ts:166-188` `RAW_ORIGINS: Readonly<Record<RawSurface["kind"], NotificationOrigin>>` | `"plugin-path-skipped": { kind: "load" },` [VERIFIED] | `"background-update": { kind: "load" },` (typecheck forces it). |
| G3 | same file `:193-...` `RAW_SAMPLES: { readonly [K in RawSurface["kind"]]: ... }` | one sample per raw kind [VERIFIED] | A sample with one plugin row (no absolute path: WIRE-08 walk). |
| G4 | same file `emitRawSample` switch (`:301-339`) | `case "plugin-path-skipped": notifyPluginPathSkipped(ctx, run, surface.scope, surface.reason); return;` [VERIFIED] | `case "background-update": notifyBackgroundUpdate(ctx, run, surface.plugins); return;` plus the import. |
| G5 | same file `:480-517` | `"WIRE-02: the retained inventory and separate command error cover all 22 kinds"`, sorted kind list, `assert.strictEqual(PRESENTED.length, 334);` [VERIFIED] | Add `"background-update"` (sorted first), title 22 -> 23, `PRESENTED.length` 334 -> 335 (one more raw sample; the catalog parser skips "Out-of-band notifications", so a new catalog block adds no catalog example) [ASSUMED arithmetic; re-run the test to confirm]. |
| G6 | `test/shared/notification-grammar.test.ts:1949-2061` `RAW_SURFACE_ROWS: { readonly [K in ResolvedRawSurface["kind"]]: ... }` | one row per resolved kind with exact `expectedArguments` [VERIFIED] | A row; plus separate cases for 1, 2, 3+ names and the cross-scope dedupe. |
| G7 | `test/shared/notification-json.test.ts:2388-...` `RAW_CASES: { readonly [K in ResolvedRawSurface["kind"]]: ... }` | one row per resolved kind with the whole expected payload [VERIFIED] | A row with `needsReload: true` and a row without `fromVersion` if optional. |
| G8 | `test/shared/notification-dispatch.test.ts:514-604` classify table | `{ kind: "plugin-path-skipped", outcome: false, emit: (ctx, run) => { notifyPluginPathSkipped(ctx, run, "user", "Unreadable."); } },` [VERIFIED] | Row `{ kind: "background-update", outcome: false, emit: ... }`; plus a text-mode case and the empty-list no-op case. |
| G9 | `test/architecture/json-output-docs.test.ts:686-725` `assertReferenceInventory` | doc `kind:` sections must equal schema kinds and each documented path + requiredness must equal the schema [VERIFIED] | A `#### background-update` section in `docs/json-output.md` with `<!-- fields: kind:background-update -->`, `<!-- use: common-fields -->`, a `plugins` row, and a new nested fields block for the plugin row (pattern: `### MCP migration row`, `<!-- fields: mcp-migration-row -->`). Requiredness must match (`fromVersion` optional if the schema says so). |

Additional owner tests (not enumerating, but each touched source's direct coverage needs them): `test/shared/notification-resolve.test.ts` (resolve arm; redaction case), `test/shared/notification-wire.test.ts` (accept/reject cases, e.g. the `AMIG-03` pattern at `:484-514`), `test/shared/notification-types.test.ts` (type-only `satisfies` proof like `:375-388` for `PluginPathSkippedSurface`).

Optional, recommended for doc parity: a `test/architecture/background-update-notice.test.ts` byte lock that reads the catalog block through `test/architecture/catalog-block.ts::readCatalogBlock(state)` (pattern: `hooks-cap-notify.test.ts`, `mcp-migration-notice.test.ts`). Architecture tests have D-07-06 path rules; it imports only `shared/notification-dispatch.ts`, which existing gates already import.

Not affected: `json-output-docs.test.ts:268-280` (a sample list of non-outcome kinds; adding `background-update` there is optional), `no-credential-leak.test.ts` (per-site rows, no exhaustive kind map; add a row only if versions are redacted in P3), `presentation-sink.test.ts` (passes as long as P10 adds no literal and no `ui` mention).

## The foreground gate

### `edge/register.ts` change (one option, one wrap)

Current options bag [VERIFIED: register.ts:97-106]:

```ts
export function registerClaudePluginCommand(
  pi: ExtensionAPI,
  deps: EdgeDeps,
  hooksRouting: InstallHooksRouting,
  updatePlugins: UpdatePluginsFn,
  options: {
    readonly createInvocationId?: () => string;
    readonly createRecoveryId?: () => string;
  } = {},
): void {
```

Current handler [VERIFIED: register.ts:157-167]:

```ts
    handler: (args, ctx) => {
      requireNotificationMode(ctx.mode);
      const route = selectClaudePluginRoute(args, handlers);
      return runCommand(
        pi,
        ctx,
        route.commandId,
        (run) => routeClaudePlugin(route, handlers, ctx, run),
        { createInvocationId, createRecoveryId, openRun: openNotificationRun },
      );
    },
```

Recommended minimal change [ASSUMED names]: add `readonly runForeground?: (command: () => Promise<void>) => Promise<void>;` to the bag, bind `const runForeground = options.runForeground ?? ((command) => command());` beside `createInvocationId`, and return `runForeground(() => runCommand(...))`. Keep `requireNotificationMode` and `selectClaudePluginRoute` outside the gate so the existing "rejects mode before routing or probing" cases (`register.test.ts:1644`, `:1679`) keep their order. The type is inline, so `edge/` imports nothing new (BLOCK C and fallow `edge -> orchestrators` would allow it anyway). `runCommand` returns `Promise<void>` [VERIFIED: edge/command-run.ts:14-24].

The five existing callers (`index.ts:210`, `test/edge/register.test.ts:422` and `:2621`, `test/integration/reserved-record-keys.test.ts:101`, `test/integration/standalone-prune.test.ts:189`, `test/e2e/import-command.test.ts:117`) keep compiling because the member is optional. Coverage of `register.ts`: the `??` default is exercised by every existing case; add one case in `test/edge/register.test.ts` that supplies a `runForeground` and proves the command body runs only inside it (e.g. a gate that records entry/exit and a handler outcome observed between them). The harness to reuse is `registerCommandWithCache(...)` (`:388-449`), which passes the options bag at `:428-433`.

### Boundaries and lint for the new module

- fallow zones: `orchestrators/**` -> `orchestrators` zone; allowed imports include `persistence`, `platform`, `shared`, `transaction` [VERIFIED: .fallowrc.json rules]. `entry` (`index.ts`) may import `orchestrators` [VERIFIED].
- BLOCK C: `MARKETPLACE_LEDGERS` (`add`, `remove`, `update`, `autoupdate`) may not import each other; a non-ledger module in `orchestrators/marketplace/` may import `update.ts` [VERIFIED: eslint.config.js:23-28, :505-509]. `orchestrators/marketplace/**` may not import any `PLUGIN_LEDGERS` member (`install-flow`, `update-flow`, `uninstall`, `reinstall-flow`, `enable-disable`) [VERIFIED: eslint.config.js:15-21, :489-494]. So: import `updateMarketplace` from `./update.ts` is legal; take `beginPluginUpdateRun` by injection; `PluginUpdateFn`/`PluginUpdateOutcome` come from `../types.ts`.
- BLOCK F (default-deny over `orchestrators/**` minus `NETWORK_SEAMS`): no `platform/git` import, no identifier/key/string `gitOps`, `DEFAULT_GIT_OPS`, `refreshGitHubClone` [VERIFIED: eslint.config.js:80-104, :525-557]. Omitting `gitOps` keeps the module out of `NETWORK_SEAMS`. BLOCK F also re-applies the `appendEntry` call ban.
- Listing: the new module is NOT added to `NETWORK_SEAMS`, `MARKETPLACE_LEDGERS`, `MARKETPLACE_LEDGER_TARGETS` (`test/architecture/gate-targets.ts:38-43`), fallow zones (glob already covers it), or `sonar.cpd.exclusions`.
- `no-await-in-loop` is `error` under `extensions/**`; the sequential scope/marketplace loops each need `// eslint-disable-next-line no-await-in-loop -- <reason>` (precedent: update.ts:287, :312).
- fallow dead-code runs in production mode with `includeEntryExports: true`: export only what `index.ts` or another production module uses; a type exported only for tests is an unused export.

## The pass: exact signatures to reuse

| Symbol | Location | Signature / value (verbatim) |
|--------|----------|------------------------------|
| `updateMarketplace` | update.ts:243 | `export async function updateMarketplace(opts: UpdateMarketplaceOptions): Promise<void>` |
| `UpdateMarketplaceOptions` | update.ts:175-216 | `completionCache: CompletionCache; ctx: NotificationContext; name: string; scope?: Scope; cwd: string; gitOps?: GitOps; pluginUpdate?: PluginUpdateFn; run: NotificationRun; credentialOps?: CredentialOps; deviceFlowHttp?: DeviceFlowHttp; stateTransaction?: LockedStateTransactionDeps` (all `readonly`) |
| autoupdate read | update.ts:532 | `const autoupdate = ownValue(merged.marketplaces, name)?.entry.autoupdate ?? false;` (from `loadMergedScopeConfig(locations)`) |
| cascade | update.ts:568-581 | `if (!snapshot.autoupdate \|\| pluginUpdate === undefined) { return []; }` ... `for (const plugin of snapshot.plugins) { try { outcomes.push(await pluginUpdate(plugin, name, scope)); } catch (err) { rethrowInvalidGitHubBaseUrl(err); ... partition: "failed" ...` |
| lock contention | update.ts:730-733 | `if (err instanceof StateLockHeldError) { return ["lock held"]; }` (a refresh lock miss becomes a failed row, not a throw) |
| rethrow | update.ts:753-754 | `} catch (err) { rethrowInvalidGitHubBaseUrl(err);` |
| `PluginUpdateFn` | types.ts:607-611 | `(plugin: string, marketplace: string, scope: Scope) => Promise<PluginUpdateOutcome>` |
| `PluginUpdateOutcome` | types.ts:594-598 | `PluginUpdateUpdatedOutcome \| PluginUpdateUnchangedOutcome \| PluginUpdateSkippedOutcome \| PluginUpdateFailedOutcome` |
| updated arm | types.ts:358-361 | `readonly partition: "updated"; readonly fromVersion: string; readonly toVersion: string;` (+ `name` from `PluginUpdateBase`, types.ts:298) |
| `beginPluginUpdateRun` | update-flow.ts:1258 | `readonly beginPluginUpdateRun: (notification?: UpdateNotification) => PluginUpdateFn;` — pass `{ ctx, run }` (without it no dependency settle runs: update-flow.ts:1356-1358) |
| EdgeDeps shape | edge/types.ts | `readonly beginPluginUpdateRun: (notification: { readonly ctx: NotificationContext; readonly run: NotificationRun; }) => PluginUpdateFn;` |
| cascade-safe | update-flow.ts:715-727 | `runCascadeTarget` catches every throw into a failed outcome except `rethrowInvalidGitHubBaseUrl(err)` |
| `loadMergedScopeConfig` | persistence/config-merge.ts:185 | `(loc: ScopedLocations): Promise<ScopeLoadOutcome>`; never throws (loadConfig encodes failures) |
| `loadState` | persistence/state-io.ts:402-405 | `(extensionRoot: string, options: { readonly persistMigration?: boolean } = {}): Promise<ExtensionState>`; pass `{ persistMigration: false }` for a read-only snapshot; throws on unreadable/invalid state |
| `locationsFor` | persistence/locations.ts:202 | `(scope: Scope, cwd: string): ScopedLocations` |
| `openNotificationSnapshot` | shared/notification-run.ts | `(pi: PiInventory): NotificationSnapshot` (one soft-dep probe) |
| `openNotificationRun` | shared/notification-run.ts | `(pi: PiInventory & NotificationEntrySink, origin: NotificationOrigin, commandState?: CommandRunState): NotificationRun`; load origin gets no `commandState` |
| `NotificationRun` | shared/notification-run.ts | `interface NotificationRun extends NotificationSnapshot { readonly origin: NotificationOrigin; readonly entrySink: NotificationEntrySink; readonly commandState?: CommandRunState; }` |
| `NotificationContext` | platform/pi-api.ts:142-145 | `{ readonly mode: string; readonly ui: NotificationUi; }`, `NotificationUi.notify(message: string, severity?: "info" \| "warning" \| "error"): void` |
| stored creds | auth-host.ts:186 | `if (provider === undefined \|\| run.origin.kind !== "command") { return buildStoredCredentialAuth(host, credentialOps); }` |
| `hookDebugLog` | shared/debug-log.ts:22 | `export function hookDebugLog(detail: string, tag = "hooks"): void` (prints only when `PI_CLAUDE_MARKETPLACE_DEBUG === "1"`) |

**Silent run and silent context** (D-PL8-06). Recommended [ASSUMED construction]:

- Silent context: `{ mode: "print", ui: { notify: (message) => { hookDebugLog(message, "autoupdate"); } } }`. In `print`, `emitPresentation` calls `deliver`, which calls `ui.notify` with the composed text, so every per-marketplace row and every cascade/dependency/MCP notice text lands in the debug log and nothing reaches Pi. `print` is a valid mode for `requireNotificationMode`. The only other `ctx.mode` reader is `auth-host.ts:197`, inside the command-origin Device Flow branch, which a load run never reaches.
- Silent run: `{ ...openNotificationSnapshot(pi), origin: { kind: "load" }, entrySink: { appendEntry: () => undefined } }`, built once at pass start (before any shutdown can stale `pi`). With the `print` silent context the sink is never reached; a method definition is not an `appendEntry` call, so the JOUT-01 lint selector does not fire.
- Pass the same `{ ctx: silentCtx, run: silentRun }` to `beginPluginUpdateRun`, so dependency installs the cascade makes report silently too, and to `updateMarketplace`.

**What `updateMarketplace` emits (all swallowed by the silent context):** a `marketplace-not-added` row from `resolveScopeOrNotifyNotAdded` (shared.ts:741-782) if the record vanished; one `UPDATE_CONTEXT` cascade (failed / skipped up-to-date / updated with plugin rows); then `notifyMcpConfigNotices` for the cascade's MCP notices (update.ts:915). **What it throws:** `InvalidGitHubBaseUrlError` (from refresh or cascade) and anything thrown before the refresh guard, e.g. `loadState` failing inside `resolveScopeOrNotifyNotAdded`. Recommend: per marketplace `try/catch`; `instanceof InvalidGitHubBaseUrlError` ends the pass; anything else is debug-logged and the pass continues.

**Selecting marketplaces** [ASSUMED loop shape]: for scope in `["project", "user"]`, `locations = locationsFor(scope, ctx.cwd)`; `state = await loadState(locations.extensionRoot, { persistMigration: false })` in a `try` (skip the scope on throw); `{ merged } = await loadMergedScopeConfig(locations)`; targets are `Object.keys(state.marketplaces)` filtered by `ownValue(merged.marketplaces, name)?.entry.autoupdate === true`. Use `ctx.cwd` for `cwd` as the command handler does (`edge/handlers/marketplace/update.ts`: `cwd: ctx.cwd`). Note the cascade itself computes project locations from `process.cwd()` (update-flow.ts:649-653), the same as the foreground command.

## Env policy

- Truthy: `["1", "true", "yes", "on"].includes(value.trim().toLowerCase())` for `DISABLE_UPDATES`, `DISABLE_AUTOUPDATER`, `FORCE_AUTOUPDATE_PLUGINS`; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` counts when the string is non-empty (CONTEXT E3: `if(process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC)`; a whitespace-only value is non-empty and therefore on). Enabled = `FORCE || !(DISABLE_UPDATES || DISABLE_AUTOUPDATER || NONESSENTIAL)`. [CITED: 08-CONTEXT.md E3]
- Delay: accept only `/^\d+$/` values that are `<= 2147483647`; otherwise use `600000`. Node clamps a larger delay to 1 ms and emits a warning:

```text
(node:4117180) TimeoutOverflowWarning: 2147483648 does not fit into a 32-bit signed integer.
Timeout duration was set to 1.
fired after 5
```

[VERIFIED: local probe, Node v26.12.1] That warning goes to stderr, an IL-2 leak, and fires the pass at once.
- Read the env when arming (D-PL8-08). Inject `env: NodeJS.ProcessEnv`-like `Readonly<Record<string, string | undefined>>`; `index.ts` binds `process.env` by reference.

## index.ts wiring and its tests

### Pi event shapes [VERIFIED: node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts]

```ts
// :636-642
export interface SessionShutdownEvent {
    type: "session_shutdown";
    reason: "quit" | "reload" | "new" | "resume" | "fork";
    targetSessionFile?: string;
}
// :908-920
export type InputSource = "interactive" | "rpc" | "extension";
export interface InputEvent {
    type: "input";
    text: string;
    images?: ImageContent[];
    source: InputSource;
    streamingBehavior?: "steer" | "followUp";
}
// :212
export type ExtensionMode = "tui" | "rpc" | "json" | "print";
```

`platform/pi-api.ts:45-63` already re-exports `InputEvent`, `InputEventResult`, `SessionShutdownEvent`, `ExtensionContext` as types [VERIFIED]. No mirror is needed; `index.ts` and the new module import them from `./platform/pi-api.ts` (the `pi-peer-chokepoint` rule bans the peer elsewhere, type imports included).

### Event semantics that shape the design

- `input` fires only for non-command prompts: `prompt()` runs `_tryExecuteExtensionCommand` first and returns when handled, then `_runInputHandlers(text, images, options?.source ?? "interactive", ...)`, and only afterwards throws `formatNoModelSelectedMessage()` when no model is set [VERIFIED: agent-session.js:1602-1651]. RPC passes `source: "rpc"` (rpc-mode.js:298-319). Do not filter on `source === "interactive"` as `edge/skill-aliases.ts:81-84` does, or RPC never arms.
- `emitInput` stops at the first handler that returns `{ action: "handled" }` (runner.js:1201-1236). The hooks bridge registers its `input` handlers before `index.ts`'s own handlers (`index.ts:113` awaits `registerHooksBridge` first), so a UserPromptSubmit hook that blocks the prompt would also keep the arm handler from running. See Open Question 2.
- The arm handler must return synchronously (start the timer, do not await the pass), or it delays the prompt.
- `session_shutdown` handlers are awaited one by one (`await handler(event, ctx)`, runner.js:813-840); `teardownCurrent` and `dispose` await `emitSessionShutdownEvent` before `session.dispose()` (agent-session-runtime.js:103-112, :296-302). So awaiting the in-flight step for non-`quit` reasons holds the replacement exactly as D-PL8-03 intends.
- After teardown the old runtime is invalidated: `"This extension ctx is stale after session replacement or reload. ..."` thrown from the runner (runner.js:482-490). Anything the pass does with the real `ctx`/`pi` after `session_shutdown` throws. Set `stopped` in `onShutdown` and check it before the notice; wrap the notice in `try/catch` -> `hookDebugLog`.

### Proposed `index.ts` diff shape [ASSUMED names]

```ts
const backgroundUpdate = createBackgroundUpdate({
  pi,
  completionCache,
  beginPluginUpdateRun: pluginUpdateOperations.beginPluginUpdateRun,
  updateMarketplace,
  env: process.env,
  random: Math.random,
  setTimeout,
  clearTimeout,
});
pi.on("input", backgroundUpdate.onInput);
pi.on("session_shutdown", backgroundUpdate.onShutdown);
registerClaudePluginCommand(pi, {...}, hooksRouting, pluginUpdateOperations.updatePlugins, {
  runForeground: backgroundUpdate.runForeground,
});
```

Constructing the factory must start no timer (unit-test rule: "Constructing a service or adapter must not open a connection, read a file, or start a timer").

### How `test/index.test.ts` fakes `pi`

`loadExtension` (`test/index.test.ts:290-481`) builds `mock<ExtensionAPI>({ exactParams: true })` and declares one `when(() => { pi.on("<event>", It.willCapture(...)) }).thenReturn().times(1)` per registration, then `verify(pi)` [VERIFIED]. Matching captures are consumed in declaration order (the file header says the three `session_start` expectations "are consumed in declaration order"). Today it declares: bridge `session_start`, `session_shutdown`, `session_before_compact`, `session_compact`, `input` ("input dispatch"), `tool_call`, `tool_result`, `before_agent_start`, `agent_end`, `agent_settled`, `input` ("input loop reset"), `resources_discover`, `session_start` (session env), `registerCommand`, `session_start` (autocomplete), two `registerTool`, `session_start` (skill aliases), `input` ("skill alias input").

Required test changes: declare the new `pi.on("input", capture)` and `pi.on("session_shutdown", capture)` expectations at the position matching `index.ts`'s registration order (after "input loop reset" and before `resources_discover` if registered right after `registerHooksBridge`; anywhere else, move them accordingly), expose the two captured listeners on `LoadedExtension`, and add cases that drive them (mode gate, arm-once, shutdown cancels). The real factory binds the real `setTimeout`; drive arming with a `print`/`json` context (no timer) or arm then immediately call the captured `session_shutdown` listener so no live timer survives the case. If the handlers are passed by reference, `index.ts` gains no function to cover; the cases still prove the wiring.

## Behavioral test (cucumber)

### What exists and what a scenario can reuse

- Pi driver: `features/lib/pi-process.ts` — one request in flight; `entry_appended` lines are collected only while a request is pending (`handleLine` returns early when `pending === undefined`) [VERIFIED]. So entries the background pass appends after the prompt's response are not on any exchange; read them with `get_entries`.
- `get_entries` returns all session entries plus `leafId` (rpc-mode.js:503-513), and accepts `since: <entry id>` [VERIFIED]. `features/lib/pi-commands.ts::readSession` already validates `get_entries` with `ENTRIES_VALIDATOR` and validates each `claude-plugin` payload against `NOTIFICATION_PAYLOAD_SCHEMA` (DRV-01) [VERIFIED]. A session's entries include every earlier command's payloads, so the new step must read only entries after the prompt (count entries before the prompt and slice, or use `since` with the last entry id).
- RPC `prompt` response for a refused prompt: `{ id, type: "response", command: "prompt", success: false, error: message }` (rpc-mode.js:37-39, :298-319) [VERIFIED]. The sandbox Pi runs with `PI_OFFLINE=1`, an empty agent dir, and `--offline --no-session` (`test/e2e/_rpc.ts:183-212`), so a plain prompt is expected to fail with "No model selected." after the input handlers ran [ASSUMED: no model is configured; the step should assert `success === false` and `command === "prompt"`, not the message text].
- Dedicated Pi precedent: `ScenarioWorld.usePiWithGitHubBaseUrl(value)` (`features/support/world.ts`) starts `PiProcess.start(run.sandbox, { ...run.piEnvironment, PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: value })`, makes it `this.pi`, and registers `pi.stop()` as a release; step `"pi runs with the github base address {string}"` in `features/step_definitions/git-host.steps.ts:109-114` [VERIFIED].
- **Blocker for the env var:** `rpcChildEnvironment` is an allowlist. It copies only `HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE`, `PATH`, and the four `RpcGitEnvironment` keys (`NODE_EXTRA_CA_CERTS`, `GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL`, `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`) [VERIFIED: test/e2e/_rpc.ts:183-201]. `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS` never reaches the child unless `_rpc.ts` learns it (e.g. an optional `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS?: string` on `RpcGitEnvironment`, copied when defined). `test/architecture/hermetic-git-environment.test.ts:73-99` pins the exact output of `rpcChildEnvironment` with `deepStrictEqual`, so add a case there. Staging `test/e2e/_rpc.ts` (a non-`.test.ts` file under `test/`) makes the commit hook run all pairs' coverage. The same allowlist keeps the developer's `DISABLE_UPDATES` & co. out of every Pi the suite starts (good for hermeticity).
- The run's shared Pi never sends a plain prompt, and each scenario's `Before()` starts a `new_session` (`features/support/pi-process.ts`), which fires `session_shutdown` and cancels any pending timer under D-PL8-03. So only the dedicated Pi needs the zero delay.
- Reusable steps [VERIFIED]: `the marketplace {string} is published as a {source kind} source`, `the marketplace {string} offers these plugins:` (`marketplace/publishing.steps.ts:52, :91`), `the marketplace {string} is added to the {word} scope` (`:142`, runs through `this.pi`), `the user has run {string}` (`command.steps.ts:55`), `the result has these fields:` (`:84`), `the result lists these plugins:` (`:92`), `the user runs {string}` (`:77`). The setup chain from `features/marketplace/update.feature:563-575` ("Autoupdate exposes the offered version in a new session") is the template: publish `demo 1.0.0`, add, install, `marketplace autoupdate tools --scope project`, republish `demo 1.10.0`.

### Proposed scenario (title and behavior only; step text belongs to the writer)

`features/marketplace/background-update.feature`, `Feature: Marketplace background update` (the title must kebab-case to `marketplace-background-update`; `check-features.mjs:312-326`).

- **"A marketplace with autoupdate on updates its plugins after the first message"**: dedicated Pi with delay 0 (the Given must come before the setup commands, as with the GitHub base step); setup as above; When the user sends a plain message (new step: sends `prompt`, asserts the refusal, then polls `get_entries` with a named constant such as `BACKGROUND_UPDATE_TIMEOUT_MS` below the 30 s step timeout and a short poll interval, until at least one `claude-plugin` payload follows the prompt, and records those payloads); Then fields `kind background-update`, `severity info`, `needs reload true`; Then the plugin rows `demo | tools | project | 1.0.0 | 1.10.0`. Optionally a second When `the user runs "/claude:plugin list --scope project"` showing `1.10.0`. Without the change no payload ever follows the prompt and the poll times out, so the scenario fails. A wrong implementation that leaks the per-marketplace cascade to the real sink produces more than one payload and fails `lastResult()`'s exactly-one check.
- Consider an Outline over `dir`/`file` (untagged) plus `@url`/`@github` rows, as `update.feature`'s autoupdate scenarios do; the dedicated Pi inherits the run's git environment, so git rows work.
- AUP-03's "silent when nothing changed" and AUP-01's "never refused" are not provable by a scenario that fails without the change (silence is the pre-change behavior; the race is nondeterministic). Cover them in unit tests and say so in the plan.

### Foundation files the scenario touches

- `features/lib/result-rows.ts:23` `const ROW_FIELDS: ReadonlySet<string> = new Set(["marketplaces", "blocks"]);` [VERIFIED]. A top-level `plugins` array would otherwise appear as a JSON-string envelope column in `the result has these fields:`. Add `"plugins"` to `ROW_FIELDS` and teach `pluginRowRecords` a `background-update` arm (flatten each row: `name`, `marketplace`, `scope`, `from version`, `to version`) so `the result lists these plugins:` reads it and calls `markRowsCompared()`.
- `features/lib/pi-commands.ts`: add the send-and-wait driver (reuse `claudePluginPayloads` and `ENTRIES_VALIDATOR`).
- `features/support/world.ts`: a `usePiWith...` helper beside `usePiWithGitHubBaseUrl`; a named timeout constant with a comment if it exceeds the default.
- Recording: `recordResults(payloads, "session")` makes the world fail a passing scenario whose session results went uncompared — the stricter of the two sources.
- Step placement: a step about a marketplace verb goes in a verb module under `features/step_definitions/marketplace/`; a "send a message" step is a session concern (`session.steps.ts`). Layout rules: `.agents/skills/cucumber/rules/layout.md`. Phase 10 later owns `features/**` and `_rpc.ts`, but depends on Phases 1-9, so there is no concurrent conflict.

## Docs

- `docs/json-output.md`: new `#### background-update` section under "Payload kinds" (G9) with a nested plugin-row fields block; "Payload kind from the twenty-one kind sections below." (`:179` common-fields table) becomes twenty-two; the Origin prose (`:210`) gains one sentence that a background update reports as `background-update` with `origin.kind` `load`. Phase 5 also edits this file (merge risk).
- `docs/output-catalog.md`: a block under `## Out-of-band notifications` (`:5093`) with `<!-- catalog-state: background-update-one -->` (and `-two`, `-many`) fenced text, severity, trigger, and which test locks the bytes. That section is skipped by the catalog-uat parser (its own preamble says so), so no catalog fixture is required.
- `docs/env-vars.md`: the file today documents variables delivered to plugin components (`## Delivery mechanisms`, `## Overview matrix`, ...). Add a separate H2 (for example "Variables the extension reads") with a `Variable | Claude Code | Pi | Notes` table for `DISABLE_UPDATES`, `DISABLE_AUTOUPDATER`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `FORCE_AUTOUPDATE_PLUGINS` (same names and rule as Claude Code, D-PL8-08) and `PI_CLAUDE_MARKETPLACE_AUTOUPDATE_DELAY_MS` (pi-only, D-PL8-09), plus the not-mapped items (global-config `autoUpdates`, `CLAUDE_CODE_AUTOUPDATER_DISABLED_BY_HOST`, the hidden toggle). No gate reads this file [VERIFIED: grep of test/, scripts/, features/].
- AUP-02 "each mapping recorded": put the default-per-marketplace mapping (D-PL8-07) in the same doc section or a short `docs/` note.
- NFR-5 amendment (D-PL8-01): `.planning/PROJECT.md:1305` heading reads "amended by url-source, by D-03-03, and by D-MF-04" while `AGENTS.md:58` reads "... and by AAP-D1"; both need "and by D-PL8-01" plus one sentence. `AGENTS.md`'s project block embeds PROJECT.md (`claude_md_assembly.blocks.project: embed`), so edit PROJECT.md and keep AGENTS.md in step. Phase 11 also edits PROJECT.md.
- README: `README.md:306` "Toggle marketplace plugin auto-updates. When you update the marketplace manually, this extension also updates the installed plugins." stays true but incomplete; `README.es.md` mirrors it. Nothing becomes false, so no README edit is required; if one is made, it goes through the `readme` skill for both files.
- `CHANGELOG.md`: per AGENTS.md versioning, a bullet at PR time (changelog skill), not necessarily in this phase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Refresh + cascade + rollback + dependency settle | a background-specific update loop | `updateMarketplace` + `beginPluginUpdateRun` | D-PL8-06; MU-4 ordering, cache drop, lock handling already tested |
| Credential policy | a "no prompt" flag | load-origin run (`auth-host.ts:186`) | already stored-credentials-only |
| Lock-held handling | catching `StateLockHeldError` in the pass | nothing: refresh converts it to a failed row; cascade converts it to a failed outcome | the pass sees no throw |
| Silent output | a new "quiet" flag through notify | a `print` silent context + no-op sink | zero changes to dispatch |
| Text composition | strings in dispatch or the pass | `formatRawSurface` arm in grammar | IL-2 / D-16 gates |
| Timer cap | trusting the parsed env value | reject values above 2147483647 | Node clamps to 1 ms with a stderr warning |

## Common Pitfalls

### Pitfall 1: Notice after teardown throws
**What goes wrong:** the pass finishes after `/reload`/`new` started and calls `notify` on a stale `ctx`/`pi`. **Why:** the runner invalidates the old runtime (runner.js:482-490). **Avoid:** `stopped` flag checked before the notice; open the notice's run (`openNotificationRun(pi, { kind: "load" })`) only after that check; wrap in `try/catch` -> `hookDebugLog`. **Detect:** a unit case that shuts down mid-pass and asserts no emission and no throw.

### Pitfall 2: The wrapper cannot abort the cascade
**What goes wrong:** after shutdown the wrapper throws to stop; the cascade catches it and records a failed outcome, then calls the wrapper for the next plugin. **Avoid:** after `stopped`, the wrapper must not run the real update; throwing is acceptable (each plugin becomes a silent failed row) but return early on every call, and never call the real update. Also stop the marketplace loop.

### Pitfall 3: Gate deadlock by re-entry
**What goes wrong:** the pass acquires the gate for the refresh step and the wrapper tries to acquire it again inside the same `updateMarketplace` call. **Avoid:** model the gate as acquire/release of a single background token: the wrapper releases the refresh step's token, awaits foreground idle, re-acquires, runs one plugin update; the pass releases after `updateMarketplace` returns. Make the foreground check-and-set synchronous after each `await` (single-threaded JS makes that atomic).

### Pitfall 4: A hung fetch blocks every command
**What goes wrong:** `platform/git.ts` has no timeout (`grep -i "timeout\|abort"` finds nothing [VERIFIED]); a stalled background fetch holds the gate, so a `/claude:plugin` command waits indefinitely, silently (D-PL8-04). **Avoid:** cannot be solved inside this phase's decisions; record it (Open Question 1).

### Pitfall 5: Timer overflow and floating promises
`setTimeout(cb, > 2147483647)` fires after 1 ms (verified). Lint: `@typescript-eslint/no-misused-promises` rejects an async callback to `setTimeout`; use `() => { void runPass(); }` and make `runPass` catch everything. `unref()` the timer so it never keeps Pi alive.

### Pitfall 6: Two input handlers, wrong capture in `index.test.ts`
strong-mock consumes matching `It.willCapture` expectations in declaration order; declaring the new `input`/`session_shutdown` expectation in the wrong place hands the case the hooks bridge's listener. Declare them where `index.ts` registers them.

### Pitfall 7: Lint and fallow ceilings
`sonarjs/pseudo-random` (no `Math.random()` call in production), `no-await-in-loop` disables with reasons, cognitive complexity 15 under both ESLint and fallow (they disagree; satisfy both), `fallow dupes` fails on any new clone group (the per-marketplace try/catch-debug-log shape can clone `index.ts`'s handlers; keep it in one helper), production dead-code flags exports used only by tests.

### Pitfall 8: Middle dot and the text fixers
The notice uses `·` (U+00B7). The style guide wants printable non-ASCII as itself. The `texthooks` hooks (`fix-smartquotes`, `fix-spaces`, `fix-unicode-dashes`, `fix-ligatures`) are not expected to touch it [ASSUMED]; run `pre-commit run --files <changed .ts/.md>` once to confirm. No production `.ts` file uses it today.

### Pitfall 9: Interleaving with another process's lock
A step in this process holds the scope lock while a command in another Pi process runs: that command gets `{lock held}` (D-PL8-05 accepts this). Do not "fix" it by adding lock retries (reverses D-06).

## Code Examples

### Gate (shape only) [ASSUMED names; illustrative]

```ts
// orchestrators/marketplace/background-update.ts (excerpt)
let foreground = 0;
let idle: Promise<void> = Promise.resolve();
let releaseIdle: () => void = () => undefined;
let step: Promise<void> | undefined;

async function runForeground(command: () => Promise<void>): Promise<void> {
  foreground += 1;
  if (foreground === 1) {
    idle = new Promise((resolve) => { releaseIdle = resolve; });
  }
  try {
    await step;            // at most one background step
    await command();
  } finally {
    foreground -= 1;
    if (foreground === 0) releaseIdle();
  }
}
```

The background side awaits `idle` in a loop until `foreground === 0`, then sets `step` synchronously. Real code must satisfy `curly: all` and the padding rules.

### Notice text (grammar arm) [ASSUMED helper name; literals from D-PL8-10]

```ts
function composeBackgroundUpdateText(plugins: readonly BackgroundUpdatePlugin[]): string {
  const names = [...new Map(plugins.map((p) => [`${p.name}@${p.marketplace}`, p.name])).values()];
  const subject = names.length <= 2 ? names.join(" and ") : `${names.length} plugins`;
  return `${names.length === 1 ? "Plugin" : "Plugins"} updated: ${subject} · Run /reload to apply`;
}
```

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Autoupdate only on manual `marketplace update` | background pass after the first message (Claude Code `plugins/loading`) | new runtime behavior, opt-in per marketplace |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `PRESENTED.length` becomes 335 (one more raw sample, no new catalog example) | G5 | test edit off by N; re-run fixes |
| A2 | The sandbox Pi has no model, so a plain RPC prompt fails after the input handlers | Behavioral test | if a model existed, the prompt would try to call a provider (`--offline`), still after `input`; assert only `success === false` |
| A3 | `texthooks` leaves U+00B7 unchanged | Pitfall 8 | a hook rewrites the notice bytes; tests catch it |
| A4 | Claude Code's `D.bool()` accepts exactly `1/true/yes/on` (carried from CONTEXT E3, medium) | Env policy | an operator value like `TRUE ` still works; `y` would differ |
| A5 | Names in the notice dedupe by `<plugin>@<marketplace>` (locked D-PL8-10); Claude Code may dedupe after stripping `@marketplace` | Notice | two same-named plugins from different marketplaces print `alpha and alpha` here, `alpha` upstream; locked decision, flag only |
| A6 | All proposed identifiers (`createBackgroundUpdate`, `onInput`, `onShutdown`, `runForeground`, `notifyBackgroundUpdate`, `BackgroundUpdateSurface`, `BACKGROUND_UPDATE_PAYLOAD`, `BACKGROUND_UPDATE_TIMEOUT_MS`) | throughout | none; naming is Claude's discretion |

## Open Questions

1. **A stalled background fetch blocks foreground commands indefinitely.** What we know: no git timeout exists; D-PL8-04 makes commands wait silently. Recommendation: accept and record as a known limit (same exposure as a stalled foreground `marketplace update`), or ask the user whether a bounded wait is wanted (the deferred "waiting" line is related).
2. **`input` handler order and blocked prompts.** A UserPromptSubmit hook that returns `handled` stops `emitInput` before the arm handler. Recommendation: register the arm handler after the hooks bridge (simplest; a blocked prompt is arguably not a "sent" message) and note it; registering earlier would need to happen before `registerHooksBridge` at `index.ts:113`.
3. **`source: "extension"` inputs** (another extension's `sendUserMessage`) also fire `input`. D-PL8-02 does not exclude them. Recommendation: arm on any source; flag for review.
4. **`fromVersion` optional vs required.** `PluginUpdateUpdatedOutcome.fromVersion` is required (types.ts:360), so every row will carry it. D-PL8-10 locks `fromVersion?`. Recommendation: follow the lock (schema `Type.Optional`, doc "optional"), or confirm with the user that required is acceptable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | yes | v26.12.1 (CI uses 24) | — |
| npm | scripts | yes | 11.20.0 | — |
| Pi peer (RPC CLI) | cucumber | yes | 1.3.0 | — |
| @cucumber/cucumber | scenario | yes | 13.3.0 | — |
| fallow | `check:static` | yes | 3.35.0 | — |
| pre-commit | commit hook | assumed installed (memory: hooks installed) | — | run `npm run check:commit` manually |

No missing dependency.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` + `strong-mock` 9.2.2; `@cucumber/cucumber` 13.3.0 |
| Config | `package.json` scripts; `cucumber.json` (`order: random`, `parallel: 8`) |
| Quick run | `node --test <test-path>`; `npm run test:coverage:direct -- <source-or-test>` |
| Full suite | `npm run check` |

### Phase Requirements -> Test Map

| Req | Behavior | Type | Automated Command | File Exists? |
|-----|----------|------|-------------------|-------------|
| AUP-01 | arms on first `input` in tui/rpc only; once per runtime; delay `floor(random()*max)`; unref'd | unit | `node --test test/orchestrators/marketplace/background-update.test.ts` | ❌ Wave 0 |
| AUP-01 | pass selects recorded marketplaces with merged autoupdate true, project first, calls `updateMarketplace` with load run + silent ctx | unit | same | ❌ |
| AUP-01 | wrapper yields to the gate before each plugin; collects `updated` only; stops after shutdown | unit | same | ❌ |
| AUP-01 | `runForeground` waits for an in-flight step and blocks new steps; concurrent commands not serialized | unit | same | ❌ |
| AUP-01 | the `/claude:plugin` handler runs inside `runForeground` | unit | `node --test test/edge/register.test.ts` | ✅ (add case) |
| AUP-01 | shutdown: cancel timer; await step for reload/new/resume/fork; return at once for quit; no throw escapes | unit | background-update test | ❌ |
| AUP-01 | `index.ts` registers `input` + `session_shutdown` and passes `runForeground` | unit | `node --test test/index.test.ts` | ✅ (extend harness) |
| AUP-01/03 | end to end: delay 0, plain message, one `background-update` entry naming the plugin | behavioral | `npx cucumber-js --name '<scenario title>'` | ❌ Wave 0 |
| AUP-02 | truthy parser, NONESSENTIAL non-empty rule, FORCE override, delay parse incl. > 2147483647 | unit | policy test (own or inside background-update test) | ❌ |
| AUP-03 | text for 1 / 2 / 3+ names, dedupe across scopes, severity info | unit | `node --test test/shared/notification-grammar.test.ts` | ✅ (add rows) |
| AUP-03 | wire payload `needsReload: true`, load origin, rows in pass order; schema accepts/rejects | unit | `node --test test/shared/notification-json.test.ts test/shared/notification-wire.test.ts` | ✅ |
| AUP-03 | empty rows emit nothing; not a command outcome | unit | `node --test test/shared/notification-dispatch.test.ts` | ✅ |
| AUP-03 | schema, docs, catalog gates | architecture | `npm run test:unpaired` (wire-schema, catalog-wire, json-output-docs, presentation-sink, hermetic-git-environment) | ✅ (edit) |

### Sampling Rate

- **Per task commit:** the owner test(s) via `node --test <path>`, then `npm run test:coverage:direct -- <source>` for each touched source pair; the hook runs `check:commit` (static + unpaired + staged pairs; all pairs when `test/e2e/_rpc.ts` or a non-test file under `test/` is staged).
- **After notification-wire changes:** `npm run schema:generate`, then `node --test test/architecture/wire-schema.test.ts test/architecture/json-output-docs.test.ts test/architecture/catalog-uat/catalog-wire.test.ts`.
- **Cucumber task:** `npx cucumber-js --name '<scenario title>'`, then `npm run check:features` (also part of `check:static`); `npm run test:cucumber` for the full suite.
- **Static after each wave:** `npm run check:static`.
- **Wave merge / phase gate:** `npm run check` on the combined tree (runs cucumber too; `check:commit` does not).

### 100% direct coverage per touched source

`index.ts` (only new registrations; keep them branch-free), `edge/register.ts` (the `??` default and the supplied gate), each new `orchestrators/marketplace/background-*.ts`, and `shared/notification-{types,resolve,grammar,json,wire,dispatch}.ts` (each new arm needs its own case in its own owner test; another test's coverage does not count).

### Wave 0 Gaps

- [ ] `test/orchestrators/marketplace/background-update.test.ts` (and the policy test if split)
- [ ] `features/marketplace/background-update.feature` + steps + world helper + `_rpc.ts` env key + `hermetic-git-environment` case + `result-rows.ts` `plugins` row field

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (git credentials) | load-origin run -> stored credentials only, no Device Flow (`auth-host.ts:186`) |
| V5 Input Validation | yes (env values) | strict parsers: truthy set, `/^\d+$/` and `<= 2147483647` delay |
| V7 Error Handling / Logging | yes | failures to `hookDebugLog` only (debug-gated); notice versions pass `redactCredentials` if adopted (P3) |
| V3, V4, V6 | no | — |

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| Background step races a foreground command in-process | Tampering | `runForeground` gate (D-PL8-04) |
| Credential prompt in an unattended pass | Spoofing / Elevation | stored credentials only (D-PL8-12) |
| Opt-out env ignored | Repudiation of user choice | Claude Code variables honored at arm time (D-PL8-08) |
| Credential text in a notice | Information disclosure | resolve-time `redactCredentials` on free-text fields; no-credential-leak row if added |
| Timer overflow warning on stderr | Information disclosure / IL-2 | reject delays above the 32-bit ceiling |

## Sources

### Primary (HIGH confidence, read this session)
- `extensions/pi-claude-marketplace/{index.ts, edge/register.ts, edge/types.ts, edge/command-run.ts, edge/handlers/marketplace/update.ts, edge/skill-aliases.ts}`
- `extensions/pi-claude-marketplace/orchestrators/{marketplace/update.ts, marketplace/shared.ts, plugin/operations.ts, plugin/update-flow.ts, auth-host.ts, types.ts}`
- `extensions/pi-claude-marketplace/shared/notification-{types,resolve,grammar,json,wire,dispatch,run}.ts`, `shared/debug-log.ts`, `platform/pi-api.ts`, `persistence/{config-merge,state-io,locations}.ts`
- `node_modules/@earendil-works/pi-coding-agent/dist/{core/extensions/types.d.ts, core/extensions/runner.js, core/agent-session.js, core/agent-session-runtime.js, modes/rpc/rpc-mode.js}` (v1.3.0)
- `eslint.config.js`, `.fallowrc.json`, `package.json`, `node_modules/eslint-plugin-sonarjs/cjs/S2245/rule.js`, `node_modules/@typescript-eslint/eslint-plugin/dist/rules/unbound-method.js`
- `test/index.test.ts`, `test/edge/register.test.ts`, `test/architecture/{wire-schema,json-output-docs,presentation-sink,hermetic-git-environment,catalog-uat/catalog-wire,no-credential-leak,hooks-cap-notify}.test.ts`, `test/shared/notification-{grammar,json,dispatch,wire,types,resolve}.test.ts`, `test/e2e/_rpc.ts`
- `features/{support/world.ts, support/pi-process.ts, lib/pi-process.ts, lib/pi-commands.ts, lib/result-rows.ts, lib/field-rows.ts, step_definitions/*}`, `features/marketplace/{autoupdate,update}.feature`, `scripts/check-features.mjs`
- `.agents/skills/{cucumber,local-verification,typescript-unit-tests}/**`, `docs/{json-output,output-catalog,env-vars}.md`, `README.md`
- Local probe: Node `setTimeout` overflow behavior (v26.12.1)

### Secondary
- `08-CONTEXT.md` upstream evidence E1-E6 (Claude Code 2.1.310 binary + docs, gathered 2026-10-26). The binary's string table was re-grepped; the composer is not readable as JS text there, so E4's composer quote was not re-verified this session.

## Metadata

**Confidence breakdown:** Stack HIGH (no new deps). Architecture HIGH (every seam read). Pitfalls HIGH for the verified ones (stale ctx, timer overflow, allowlist env, lint rules), MEDIUM for gate deadlock modeling (design-level).
**Research date:** 2026-10-26
**Valid until:** 2026-11-25 (stable in-repo seams; re-check if Phases 3, 5, 6, or 7 merge first, since they edit `notification-types.ts`, `docs/json-output.md`, `notification-grammar.ts`, and `marketplace/update.ts`)
