---
status: resolved
trigger: "A project-scope plugin declaring SessionStart hooks installs cleanly, shows (installed), and its hooks.json is staged correctly under <cwd>/.pi/pi-claude-marketplace/hooks/<slug>/ -- but the handler never runs on the session that starts. The same plugin installed at user scope fires normally. No error, no notify, no debug line: the SessionStart routing bucket is simply empty for project scope at dispatch time."
created: 2026-08-14T00:00:00Z
updated: 2026-08-14T00:00:00Z
---

> Provenance: this record was NOT produced by a `/gsd-debug` session. The defect
> was found and root-caused during maintainer review of external PR #127
> (@rakesh-vs), which arrived with both the diagnosis and the fix. Every claim
> below was re-verified mechanically against the vendored pi runtime and the
> test suite before the PR was accepted; nothing here is taken from the PR
> description on trust.

## Symptoms

### Expected behavior

A project-scope plugin whose `hooks.json` declares `SessionStart` runs its
handler on every new Pi session, exactly as the same plugin does at user scope.

### Actual behavior

The handler never runs on the session that starts it. The hooks become
reachable only after a subsequent `/reload` rebuilds the routing tables --
by which time the `session_start` event they subscribe to has already passed.
User-scope `SessionStart` hooks are unaffected.

### Error messages

None. The bridge treats an empty routing bucket as a no-op, which is correct
when nothing is installed and silently wrong here.

## Root cause

Two facts about Pi's event order combine:

1. Pi emits `session_start` BEFORE `resources_discover`. Verified in the
   vendored runtime at `agent-session.js:1761-1762`: `bindExtensions` awaits
   `emit(this._sessionStartEvent)` and only then calls
   `extendResourcesFromExtensions(...)`, which is what emits
   `resources_discover`. The `/reload` path repeats the same order
   (`agent-session.js:2070-2071`). This ordering was already documented in
   `orchestrators/reconcile/apply.ts` (the A1 note) -- the hooks lane just
   never accounted for it.

2. The project-scope hook cache was hydrated only on `resources_discover`.
   `registerHooksBridge` runs at extension-load time, where no project `cwd`
   exists, so `index.ts` passes `homedir()`. That hydrates user scope
   correctly and resolves project scope against `<homedir>/.pi/...`, which is
   not the project. The correcting call, `hydrateProjectScopeForCwd(event.cwd)`,
   was wired into the `resources_discover` handler -- one event too late.

So at `SessionStart` dispatch the routing bucket held user-scope entries only.
Every other Claude event is unaffected: `session_start` is the sole dispatch
surface that fires before `resources_discover`.

The gap traces back to a wrong assumption recorded during v1.12 research
(`.planning/milestones/v1.12-research/ARCHITECTURE.md`): "`session_start`'s
`ctx` does not obviously carry cwd in the same shape." It does. `ExtensionContext`
declares `cwd: string` (`core/extensions/types.d.ts:216`), and the runner
serves it from a getter over the runner's own `cwd`, set in the constructor
(`core/extensions/runner.js:150-154`, `473-475`) -- so it is populated for
every event, not just `resources_discover`.

## Fix

`registerHooksBridge` wraps its own `session_start` registration: hydrate
project scope against `ctx.cwd`, rebuild the routing tables, ensure the
project `_shared` data dir exists when a project-scope `SessionStart` entry is
actually present, then delegate to the composite handler. Failures route
through the `hookDebugLog` seam so a hydrate error can never block dispatch.

Placement is load-bearing. Pi iterates an extension's handlers for one event
in registration order (`core/extensions/runner.js:583`), and the bridge's
dispatch handler is registered inside `registerHooksBridge`, which `index.ts`
awaits before registering anything else. A hydrate handler added in `index.ts`
would therefore have to sit above that `await` and would silently break if the
two lines were ever reordered. Putting it inside the bridge makes the bridge
responsible for its own precondition, with no ordering contract to keep.

## Evidence

- Premise, not docs: `agent-session.js:1761-1762` and `2070-2071` (emit order),
  `core/extensions/types.d.ts:216` and `runner.js:473-475` (`ctx.cwd` present).
- Handlers are awaited sequentially (`runner.js:576-606`), so the cache clear
  inside `hydrateProjectScopeForCwd` cannot race a concurrent rebuild.
- `/reload` constructs a fresh `ExtensionRunner` (`agent-session.js:2037`), so
  wrapper registrations do not accumulate across reloads.
- The mkdir target matches the dispatch lane: exec resolves
  `locationsFor(entry.scope, ctx.cwd)` (`bridges/hooks/dispatch-exec.ts:191`,
  `299`), the same `cwd` the wrapper passes to `ensureSharedDataDir`.
- Regression gate: reverting only `event-router.ts` to its pre-fix state makes
  `HOOK-E2E-02` fail with 0 dispatches against an expected 1.
- `npm run check` green on the fix: typecheck, lint, format, 3442 unit tests
  (1 skip), 19 integration tests, 0 failures.

## Resolution

Fixed by PR #127. `HOOK-E2E-02` pins the dispatch path; `HOOK-E2E-03` pins the
WR-05 side of the gate -- that a pristine project cwd stays empty across
`session_start` when only a user-scope plugin declares `SessionStart`, so the
new path cannot start creating `.pi/` directories inside users' projects.

Not fixed here, tracked as `HKDIR-01` in `.planning/BACKLOG.md`: the
factory-time `ensureSharedDataDir` loop gates on any `SessionStart` entry
existing across the whole table rather than one in the scope it is about to
write to, so a user-scope-only plugin still provokes a `_shared` mkdir under
the factory `cwd`'s project location.
