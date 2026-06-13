# Stack Research — v1.13 Claude Hook Bridge

**Domain:** Pi extension milestone (incremental — hook-bridge component added to an
already-shipped successor architecture)
**Researched:** 2026-06-13
**Confidence:** HIGH

## Scope of this research

This is a **subsequent-milestone STACK delta**. The existing v1.0–v1.12 stack is
locked and authoritative (see `.planning/milestones/v1.12-research/STACK.md`
for the rationale; the `package.json` snapshot at the top of this milestone
is the binding inventory). The question answered here is **only**: what
additions, version bumps, or new dev-tool choices are required *specifically*
to implement the v1.13 hook bridge?

The 7 focus areas in the research brief are mapped section-by-section below.
Each item is marked **NEW**, **NO CHANGE — already in stack**, or
**VERSION BUMP**. Items mapped to roadmap phases call out which bridge phase
the dependency unblocks.

## Recommended Stack (delta only)

### Core Technologies

| Technology | Version | Status | Purpose | Why Recommended |
|------------|---------|--------|---------|-----------------|
| **Node.js** | `>=20.19.0` (effective `>=22.18` for native TS strip; no further floor change in v1.13) | **NO CHANGE — already in stack** | Runtime | `chokidar@^5` engines `>=20.19.0` aligns exactly with the existing NFR-4 floor — no additional floor required. `@parcel/watcher` would have been the only candidate that materially relaxed the floor, and it's rejected on other grounds (see Alternatives). |
| **TypeScript** | `^6.0.3` | **NO CHANGE — already in stack** | Language; strict-mode discriminated unions for the 16-arm `HookEventPayload` union (focus area 4) | Already declared. The hook-bridge payload union pattern is structurally identical to v1.4's `PluginNotificationMessage` / v1.10's `MarketplaceNotificationMessage` discriminated unions; no new TS feature is needed. |
| **typebox** | `*` peer dep, `^1.1.38` dev | **NO CHANGE — already in stack** | Runtime validation of `hooks/hooks.json` per-plugin manifests + the discriminated `HookEventPayload` union at the bridge boundary (focus area 4) | TypeBox 1.x's native `Type.Union([...], { discriminator: 'hook_event_name' })` is exactly the shape needed for the 16-arm payload union; JIT-compiled validators (`Schema.Compile`) keep the per-tool-call hot path (`PreToolUse`/`PostToolUse` dispatch) cheap. Already the contract validator for `state.json` / `claude-plugins.json` / `marketplace.json` — same idiom, same package. **Confirmed: a JSON-Schema-only validator (Ajv) is the wrong choice here because the bridge needs the static TS type out the back of the schema declaration to type-narrow inside each per-event payload translator.** |
| **@earendil-works/pi-coding-agent** | `>=0.74.0` peer (dev pin `^0.79.0`) | **NO CHANGE — already in stack** | Host API surface: `pi.on(event, handler)`, `pi.events`, `pi.sendUserMessage(content, opts)`, `ctx.ui.notify`. | `ReplacedSessionContext.sendUserMessage(content, { deliverAs?: "steer" \| "followUp" }): Promise<void>` is declared at `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:292` and re-declared at `:865`. This is the load-bearing API for bucket-D `Stop` synthesis (canary plugin `ralph-wiggum`) — verified present at the v0.79.0 dev pin and the `>=0.74.0` peer floor. **No version bump required for the hook bridge.** Whether to tighten the peer floor again for v1.13 is a NFR-11 question, not a hook-bridge stack question. |

### Supporting Libraries

| Library | Version | Status | Purpose | When to Use |
|---------|---------|--------|---------|-------------|
| **chokidar** | `^5.0.0` | **NEW** | `fs.watch`-backed cross-platform file-system watcher with debounce, atomic-write awareness, ignore-list filtering, and stable rename/replace semantics. Used by bucket-B `FileChanged` synthesis. | One watcher instance per bridge process, established at load-time with the union of all enabled plugins' `FileChanged` matcher patterns. Cross-cutting between **bridge dispatch core** and **bucket-B synthesis** phases (see Roadmap implications below). |
| **node:child_process** (built-in) | bundled | **NO CHANGE — already in stack** | Spawning hook commands (`hooks/*.sh` / `hooks/*.py` / etc.) as child processes per the Claude Code hook contract (focus area 6) | Use `spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'], cwd, env, timeout })`. Feed the hook's input JSON on stdin; read stdout to EOF, then `JSON.parse` the captured stdout buffer. **`execa` rejected** — see "What NOT to Use". The bridge needs stdout buffering and exit-code/timeout handling, both of which `spawn` provides natively; the only `execa` value-add (cross-platform shell quoting) is irrelevant here because hook commands are always invoked by absolute path with explicit `args`, not via a shell string. |
| **node:fs/promises** (built-in) | bundled | **NO CHANGE — already in stack** | Reading per-plugin `hooks/hooks.json`; `chmod` of hook scripts on Unix at install time (operational gotcha #1 from the authority doc); per-plugin `hooks/` subtree containment checks (NFR-10 extension). | Already used pervasively. The chokidar watcher does its own `fs` calls internally. |
| **node:crypto** (built-in) | bundled | **NO CHANGE — already in stack** | If the dispatch table grows a "fingerprint-of-installed-plugin-hooks" key for the `/reload` cache invalidation, use `createHash('sha256')` on the sorted hook-entry list. | Already required by PI-7 hash-versioning; reusing the same import keeps the dep surface flat. |
| **node:timers** (built-in `setTimeout`/`clearTimeout`) | bundled | **NO CHANGE — already in stack** | Manual debounce for the bucket-D `PostToolBatch` safety-net timer (focus area 2) | Pi's existing pattern uses inline `setTimeout` for the rare debounce case (see `manifest-cache` post-load re-stat, `bridges/transaction/rollback.ts`). **`p-debounce` / `lodash.debounce` rejected** — chokidar already debounces FS events via its `awaitWriteFinish` option (the only place a real debounce primitive matters in v1.13); the `PostToolBatch` safety-net is a single-shot "fire if not already fired after N ms" timer, which is one `setTimeout` + one boolean flag, not a debounce. Adding a dep for that is overhead. |
| **proper-lockfile** | `^4.1.2` | **NO CHANGE — already in stack** | Cross-process exclusivity of `state.json` mutation when a `hooks/` subtree is being extracted during install (the existing v1.7 `withLockedStateTransaction` path picks this up for free). | Hook-bridge state changes (install / uninstall / enable / disable) go through the same v1.12 reconcile path — the lock is already held. |
| **write-file-atomic** | `^8.0.0` | **NO CHANGE — already in stack** | Atomic writes to `state.json` and `claude-plugins.json` when the v1.13 schema gains the `hooks` component arm. | NFR-1 atomicity is already enforced via this dep for all four scope-rooted JSON files. The hook-bridge component just adds another array slot under the existing `plugins[<id>]` record. |

### Development Tools

| Tool | Version | Status | Purpose | Notes |
|------|---------|--------|---------|-------|
| **`@types/chokidar`** | — | **NOT NEEDED** | chokidar v4+ ships its own `.d.ts`. | Bundled types since v3.5.x; v5 keeps them. Do NOT install a separate `@types/chokidar`. |
| **eslint + typescript-eslint + stylistic + import-x + sonarjs** | (existing pins) | **NO CHANGE — already in stack** | Lint discipline on the new `bridges/hooks/*.ts` tree. | The existing 8-zone import-direction rule (BLOCK C) covers the new `bridges/hooks/` directory automatically — no new lint config required. |
| **node:test** | bundled | **NO CHANGE — already in stack** | Unit/integration coverage of the dispatch table, payload translators, matcher compiler, bucket-B `FileChanged` synthesis, bucket-D `Stop` round-trip. | Test the chokidar layer behind a `WatchHost` seam so unit tests can drive synthetic events without real disk I/O. |
| **memfs** | `^4.57.2` | **NO CHANGE — already in stack** | In-memory fs for unit tests of the per-plugin `hooks/hooks.json` parser and the `chmod` install step. | Already used pervasively in `tests/persistence/` and `tests/bridges/`. Note: chokidar does NOT respect `memfs` (it uses `node:fs.watch` directly), so chokidar-backed FS-watch tests need real tempdirs or a `WatchHost` mock — pick the mock seam path for unit tests; reserve real tempdir tests for the integration tier. |

## Installation

```bash
# Runtime addition (one new dep)
npm install chokidar@^5

# Everything else is already declared in package.json — no other install needed.
```

Resulting `package.json` `dependencies` delta:

```json
{
  "dependencies": {
    "chokidar": "^5.0.0",
    "isomorphic-git": "^1.38.1",
    "proper-lockfile": "^4.1.2",
    "write-file-atomic": "^8.0.0"
  }
}
```

`devDependencies` and `peerDependencies` unchanged.

## Alternatives Considered

### Focus area 1 — File-system watcher for bucket-B `FileChanged`

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **`chokidar@^5`** | **`node:fs.watch` (built-in)** | If the bridge only ever needs a single-directory non-recursive watch with no cross-platform abstraction. Rejected for v1.13: Claude `FileChanged` matchers support glob patterns over the plugin tree; the bridge would need to re-implement chokidar's debounce, atomic-write awareness (editor-save tmp+rename storms emit one logical change but ~3 `fs.watch` events), per-platform recursive-watch fallbacks (Linux pre-recursive-flag landed late; macOS FSEvents vs Linux inotify diverge on rename semantics), and ignore-list filtering. That's exactly chokidar's job. The `ENOENT-on-replace` and Linux-recursive footguns are real and chokidar is the canonical Node solution. |
| **`chokidar@^5`** | **`@parcel/watcher@^2.5.6`** | If the bridge needed sub-millisecond change-detection latency on huge trees (Parcel's use case: re-bundling on every save during dev). Rejected for v1.13: (a) native bindings — every Node version bump + every platform combination (Linux x64/arm64, macOS x64/arm64, Windows x64) needs a prebuilt binary, raising the install-failure surface; (b) much heavier install footprint than chokidar; (c) chokidar v5 dropped its own native-bindings dep tree (no more `fsevents` optional dep on non-macOS) and is now a thin layer over `node:fs.watch` + `readdirp@^5`, so its complaint-of-record (heavy install) is gone. Pi's hook-bridge watches a handful of plugin trees with infrequent change rates — chokidar's latency is fine. |
| **`chokidar@^5`** | **Pi host-provided watch channel** | If `@earendil-works/pi-coding-agent` exposed a consumer-side watch event. Verified absent at `dist/core/extensions/types.d.ts` (the cross-mapping table notes Pi's `session_start` return field `watchPaths` is **producer-only** — the host doesn't emit a `file_changed` event back). Bridge owns the watch lifecycle. |

### Focus area 2 — Debounce primitive

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Inline `setTimeout` + chokidar's `awaitWriteFinish`** | **`p-debounce@^4`** | If the bridge needed Promise-returning debounced functions with last-call resolution semantics. Rejected: chokidar already handles the only real debounce case (FS-event coalescing), and the `PostToolBatch` safety-net is a single-shot "fire-once-if-not-already-fired" timer, not a debounce. |
| **Inline `setTimeout` + chokidar's `awaitWriteFinish`** | **`lodash.debounce`** | If the project already pulled in lodash. Rejected: pulling lodash for one debounce call would be 70 KB+ for a four-line primitive; pulling `lodash.debounce` alone is cleaner but still a new dep with no other use. |

### Focus area 3 — Matcher translation for tool-matcher syntax

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **Pure-JS string parser (literal + pipe-OR)** | **`new RegExp(pattern)` (built-in)** | Already adequate **if/when** full regex matchers are unblocked (deferred per the milestone scope — "Full regex matchers (literal + pipe-OR covers 100% of first-party plugins)"). Confirmed: NO new dep needed for full-regex support either. The matcher compiler is a tiny pure-JS function that returns `(input: string) => boolean` and switches on the syntax kind it parsed (literal / pipe-OR / regex). |
| **Pure-JS string parser** | **`micromatch` / `minimatch`** | If/when the bridge needed glob-style matchers (e.g., for `security-guidance`'s `Bash(git commit:*)` prefix-glob `if` conditions, per the marketplace audit). Rejected for v1.13: the audit calls this out as a "literal-OR + prefix-glob" need that can be served by a hand-rolled `startsWith` check on the parsed `Bash(<prefix>)` form. If the audit ever upgrades the requirement to true glob, `micromatch@^4` is the right add then, not now. |

### Focus area 4 — Hook payload discriminated union

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **typebox 1.x `Type.Union([...], { discriminator: "hook_event_name" })`** | **JSON-Schema-only validator (Ajv)** | If the bridge only needed to validate incoming payloads against a schema with no static-typing handshake. Rejected: NFR-7's discriminated-union discipline applies here too — the per-event payload translators *must* be type-narrowed to a specific arm by the time they run; Ajv would force a manual `as PreToolUsePayload` cast at every translator boundary, regressing the v1.0 "no `pluginRoot` read from non-installable plugin" type-safety pattern. |
| **typebox 1.x** | **Zod 4.x** | If the project's contract surface had been Zod-based. Rejected on the v1.12 STACK's same reasoning (peer dep contract is `typebox`; perf and JIT-compile parity). |

### Focus area 5 — Synthetic user message for `Stop` synthesis

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **`pi.sendUserMessage(content, { deliverAs: "followUp" })`** | **`pi.events.emit(...)` of a custom synthetic event** | If the host did NOT expose a user-message injection primitive. Confirmed present (verified at `dist/core/extensions/types.d.ts:292` and `:865`); no synthesis required. **Use `deliverAs: "followUp"`** — this is the documented in-band "treat this as if the user typed it next" semantic that bucket-D's `Stop` block-to-continue contract maps to. `"steer"` is for mid-turn corrections and would race the agent-loop teardown that `agent_end` represents. |

### Focus area 6 — Hook stdout JSON contract parsing

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| **`node:child_process.spawn` + manual stdout buffering + `JSON.parse` in a try/catch** | **`execa@^9`** | If the bridge needed `execa`'s cross-platform shell quoting, kill-tree-on-timeout, or its piped-streams DSL. Rejected: hook commands are invoked by absolute path with explicit `args` arrays (not shell strings), so quoting is moot; `spawn` accepts `timeout` and signal-on-timeout options natively since Node 16; and the bridge needs to keep stdin under direct control to push the hook's input JSON, which is one line of `child.stdin.write(JSON.stringify(input)); child.stdin.end();`. **The CLAUDE.md heuristic ("don't add `execa` unless built-ins can't cover") applies cleanly here.** |
| **`node:child_process.spawn`** | **`secure-json-parse`** for the stdout `JSON.parse` step | If the bridge wanted hardening against prototype-pollution payloads in hook stdout. Probably not needed for v1.13: hook commands are author-written plugin code, not user-input — the threat model is "buggy hook" not "adversarial hook". A `try { JSON.parse(stdout) } catch { warn + drop }` is sufficient. Reconsider only if a future plugin's hook stdout is sourced from network input. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **`node:fs.watchFile` (poll-based)** | Polling-based, not event-driven; CPU cost scales with the number of watched files; latency is bounded by the poll interval (1s default). The bridge's `FileChanged` synthesis fires on every editor save in the entire watched tree — polling would either be slow (5s+ latency) or expensive (100ms poll × dozens of files × the bridge's whole process lifetime). chokidar uses `fs.watch` internally for exactly this reason; do not regress. | `chokidar@^5` (which wraps `fs.watch` with the cross-platform glue). |
| **`@parcel/watcher`** | Native bindings raise the install-failure surface; pre-built binaries needed for every (Node major × platform × arch) combination; doesn't materially improve latency for the bridge's use case (handful of plugin trees, infrequent changes); chokidar v5 already shed its own native-bindings dep. | `chokidar@^5`. |
| **`fsevents` (macOS-only)** | Only works on macOS; would force the bridge to ship `fsevents`-or-`inotify` branches in code. chokidar v5 no longer ships `fsevents` as an optional dep — it's pure-JS now and uses the platform's `fs.watch` recursive flag where supported. | `chokidar@^5`. |
| **`execa`** | The bridge's needs (stdin push, stdout capture, timeout, exit-code read) are all in `node:child_process.spawn` directly; `execa`'s value-adds (shell-string quoting, kill-tree, signal mapping) are either irrelevant or unnecessary. Adding it would be a new dep with no bridge-specific justification — fails the CLAUDE.md heuristic. | `node:child_process.spawn`. |
| **`p-debounce` / `lodash.debounce`** | chokidar already debounces FS events via `awaitWriteFinish`. The only other debounce-shaped need (`PostToolBatch` safety-net timer) is a single-shot `setTimeout` + flag, not a debounce. | Inline `setTimeout` + chokidar's built-in option. |
| **Any new lockfile lib** (e.g., `lockfile`, `lock-file`) | `proper-lockfile@^4.1.2` is already in the stack and is the cross-process exclusivity primitive for `state.json` mutation. The v1.13 hook-component install path picks it up via the existing v1.12 reconcile orchestrator. | `proper-lockfile@^4.1.2` (no change). |
| **Any non-ESM dep** | The project is `"type": "module"`; TypeBox 1.x is ESM-only; the existing v1.12 stack note "Commit fully to ESM-only" still binds. | Verify ESM compatibility before adding any new dep. |
| **Any telemetry/analytics dep** (Sentry, OpenTelemetry, posthog, etc.) | IL-4 forbids telemetry. The hook-bridge surface area is exactly the kind of subsystem where someone might want "how often does PostToolBatch fire?" instrumentation — the answer is "use debug-level logging via `console.warn`-with-tag, never a telemetry dep". | None. |
| **Any i18n dep** (i18next, formatjs, etc.) | IL-1 forbids i18n. New hook-bridge user-visible strings stay English-only and route through `ctx.ui.notify` per IL-2. | None. |

## Stack Patterns by Decision Point

### Pattern: chokidar lifecycle bound to bridge load/unload

`pi.on(...)` returns void (no unsubscribe — confirmed at the authority doc's "Constraint: `pi.on()` is non-removable" section). The chokidar watcher's lifetime should mirror this — one instance created at bridge load-time, never torn down within a single Pi process. On `/reload`, the bridge re-runs the v1.12 reconcile path, which produces a fresh enabled-plugin set; the watcher's `watched` paths get reconciled to match (chokidar exposes `watcher.add(paths)` / `watcher.unwatch(paths)` for this — both are idempotent).

The bridge does **not** call `watcher.close()` inside the Pi process. The watcher tears down when the Pi process exits. This matches the "no unsubscribe" constraint and avoids the failure mode where a botched `/reload` leaves the watcher half-disposed.

### Pattern: Discriminated `HookEventPayload` union via TypeBox

Mirror v1.10's `MarketplaceNotificationMessage` shape — one `Type.Object({ ... })` per hook event, then `Type.Union([...], { discriminator: 'hook_event_name' })`. The dispatch table's per-event handler type-narrows by switching on the discriminator and then routes to a translator that returns a Pi return shape. The `assertNever(p)` exhaustiveness check at the default arm is the same pattern v1.10 already uses for the four `MpStatus` arms; one shared `assertNever` lives in `shared/notify.ts` already (D-21-01).

### Pattern: `spawn` with explicit `args`, never via shell

```ts
const child = spawn(absoluteHookScriptPath, [], {
  cwd: pluginRoot,
  env: { ...process.env, /* hook-event-specific env vars per Claude contract */ },
  stdio: ['pipe', 'pipe', 'pipe'],
  timeout: HOOK_TIMEOUT_MS, // per-event budget; SIGKILL on overrun
});
child.stdin.write(JSON.stringify(input));
child.stdin.end();
```

Never invoke via `spawn('sh', ['-c', ...])` or `exec(...)`. The plugin author can put a `#!/usr/bin/env bash` shebang in their hook script if they need shell features; the bridge stays out of the quoting story entirely.

### Pattern: Bucket-D `Stop` round-trip via `sendUserMessage`

```ts
pi.on('agent_end', async (event, ctx) => {
  const hookResults = await dispatchStopHooks(/* per-plugin */);
  const blockingResult = hookResults.find(r => r.decision === 'block');
  if (blockingResult) {
    await ctx.sendUserMessage(blockingResult.reason, { deliverAs: 'followUp' });
  }
});
```

The `deliverAs: 'followUp'` semantic is the in-band "treat as if the user typed this next" path. This is the canary contract for `ralph-wiggum`.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `chokidar@^5.0.0` | Node `>=20.19.0` (NFR-4 floor exactly) | Engines align with the project's existing floor — no new floor pressure. Pure-JS implementation as of v5; no platform-specific native bindings. Dep `readdirp@^5` is pure-JS. |
| `chokidar@^5.0.0` | ESM-only consumers | Ships ESM build; works under the project's `"type": "module"`. |
| `chokidar@^5.0.0` | `node:test` (built-in) | Compatible; reserve real-tempdir tests for `tests/integration/` per the memfs-doesn't-work-with-fs.watch note above. Unit tests should drive a `WatchHost` mock seam, not chokidar directly. |
| `@earendil-works/pi-coding-agent` `>=0.74.0` (peer floor) | `pi.sendUserMessage(content, opts)` API | Verified present at the existing dev pin `^0.79.0` and confirmed at the floor `>=0.74.0` via the shipped `dist/core/extensions/types.d.ts`. No peer-floor bump required for v1.13. |

## Roadmap Implications (mapping each delta to a v1.13 phase)

The downstream consumer (roadmapper) will use this table to slot each new
dependency into the right phase. "Cross-cutting" means the item is used by
more than one phase.

| Stack item | Bridge phase(s) | Cross-cutting? |
|------------|----------------|----------------|
| `chokidar@^5` | bucket-B `FileChanged` synthesis | No — single-bucket; the dispatch core wires the watcher's events into the synthetic `FileChanged` translator. |
| Discriminated `HookEventPayload` TypeBox union | resolver/state phase (parses `hooks/hooks.json`) + dispatch core (registers handlers) + per-bucket synthesis (each translator narrows to its arm) | **Cross-cutting.** Land the union in the resolver/state phase so subsequent phases can import the per-event types. |
| `pi.sendUserMessage` (no new dep) | bucket-D `Stop` synthesis | No — single-event use. |
| `node:child_process.spawn` for hook exec (no new dep) | dispatch core (every fired hook spawns) | **Cross-cutting at runtime, single-implementation-site.** Land a `runHookCommand(absolutePath, input): Promise<HookResult>` helper in the dispatch-core phase and reuse it everywhere. |
| Matcher compiler (pure-JS; literal + pipe-OR; no new dep) | dispatch core (entry-time compilation) + per-bucket synthesis (matcher-evaluation at fire time) | **Cross-cutting.** One compiler function returning `(input: string) => boolean`; called once per registered hook entry at bridge load. |
| Inline `setTimeout` for `PostToolBatch` safety-net (no new dep) | bucket-D `PostToolBatch` synthesis | No — single-bucket. |
| Hook-payload-extension tolerance (no new dep — uses the existing typebox parser's `additionalProperties: true` mode on `HookEntry` schema + a known-extensions allow-list constant) | resolver/state phase (parse-time warning) + dispatch core (debug-log at fire time) | **Cross-cutting.** Land the known-extensions constant in resolver/state phase. |

## Sources

### Authoritative (HIGH confidence)

- **`@earendil-works/pi-coding-agent`** `dist/core/extensions/types.d.ts` shipped with peer-dep at the v0.79.0 dev pin, read 2026-06-13:
  - `:292` and `:865` — `ReplacedSessionContext.sendUserMessage(content: string | (TextContent | ImageContent)[], options?: { deliverAs?: "steer" | "followUp" }): Promise<void>` — confirms bucket-D `Stop` synthesis primitive exists; no synthesis required.
  - Grep for `watchPaths|fs.watch|FileChanged|chokidar` in the same file returned zero matches — confirms the host does NOT provide a consumer-side watch event; the bridge owns the watcher (independent confirmation of the authority doc's claim).
- **npm registry, queried 2026-06-13:**
  - `npm view chokidar version engines` → `5.0.0`, `engines.node: >=20.19.0` (aligns with project floor exactly; no floor pressure).
  - `npm view chokidar dependencies` → `{ readdirp: '^5.0.0' }` (pure-JS, no native bindings).
  - `npm view @parcel/watcher version engines` → `2.5.6`, `engines.node: >= 10.0.0` (would not raise floor — rejected on other grounds: native bindings + install-failure surface).
- **Authority doc** `/home/acolomba/pi-claude-marketplace/docs/research/claude-hooks-vs-pi-events.md` (Phase 6 input, 2026-06-12):
  - "Constraint: `pi.on()` is non-removable" — informs the chokidar-lifecycle pattern (no teardown within the Pi process).
  - "Bridge implications" — confirms matcher translation is "trivial" string-check work (no regex engine dep required).
  - "Operational gotchas" #1 — hook scripts need `chmod +x` on install; uses `node:fs/promises` built-in (already in stack).
  - "Operational gotchas" #3 — atomic `state.json` writes via `write-file-atomic` (already in stack).
  - Bucket-D synthesis table — `Stop` uses `pi.sendUserMessage()` (verified above), `PostToolBatch` uses `tool_execution_end` counting + `turn_end` safety-net (uses `setTimeout`, no new dep).
- **v1.12 STACK research** at `/home/acolomba/pi-claude-marketplace/.planning/milestones/v1.12-research/STACK.md`:
  - "What V1 Already Got Right" — confirms TypeBox 1.x + write-file-atomic + proper-lockfile + node:test are the locked baseline; no change requested for v1.13.
  - "What NOT to Use" — confirms ESM-only commitment, no telemetry, no i18n; constraints carried into v1.13.
- **`pi-claude-marketplace/package.json`** as of `features/v1.13-hook-bridge` HEAD — confirms current dep set; `chokidar` not declared (NEW), no other dep is missing from the hook-bridge dep ledger.

### Cross-referencing (MEDIUM confidence — ecosystem signal, not load-bearing)

- chokidar v4→v5 migration notes (paulmillr/chokidar README, 2026): v4 dropped globs and v5 dropped the optional `fsevents` native dep, completing the "pure-JS Node FS watcher" pivot. Confirms the v5-over-v4 recommendation.
- Schema-validation perf landscape (TypeBox JIT competitive with ArkType, both ~3-4× faster than Zod 4) carries over from v1.12 STACK; no v1.13 re-benchmarking needed because the hook-payload union sits on the same hot path (per-tool-call) as the manifest validation that v1.12 already sized.

---
*Stack research for: v1.13 Claude Hook Bridge (subsequent-milestone delta over the locked v1.12 stack)*
*Researched: 2026-06-13*
