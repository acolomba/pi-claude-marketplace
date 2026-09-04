# Extension entry point

**Scope:** `tests/index.test.ts` paired with `extensions/pi-claude-marketplace/index.ts`
**Test files reviewed:** 1
**Production modules reviewed:** 1

## Summary

This is one of the strongest suites in the sweep. NFR-2 containment is proven, not
asserted-by-inspection: the suite plants real throwing collaborators (a `Proxy`
that refuses the nth `event.cwd` read, and a replacement `ui.notify` that always
throws) for every documented failure route, including the case the brief flagged
as commonly missing — the notify call itself throwing, at both the first-failure
and last-ditch levels. Registration is proven with `strong-mock`, `exactParams:
true`, exact event/command/tool names, and an explicit `verifyBoundary()` in every
case's assert phase; no `It.isAny()`, `anyTimes()`, or hidden `verify()` appears.
Stage order (hydrate → reconcile → recompute → aggregate) is proven through a
single shared counter on the `event.cwd` Proxy rather than a `strong-mock`
cross-mock log, which is the correct substitute here since none of those four
functions are injected seams `strong-mock` could wrap — each ordinal case's
stage-specific side effect (PATH mutated or not, which message renders) would
fail under a swapped order, so the technique is load-bearing, not decorative. The
production file's two remaining rough edges are both type-safety/documentation
gaps, not behavior bugs: a `.bind(pi) as unknown as (...)` cast with no comment
explaining what it works around, and a placeholder `ExtensionContext` forced by a
sibling module's over-broad parameter type.

## Unit test findings

### Clean files

- `tests/index.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/index.ts`

- **[WARNING] Placeholder `ExtensionContext` cast is a symptom of an over-broad
  consumer parameter** — `line 61` (`const placeholderCtx = {} as unknown as
  ExtensionContext;`), consumed at `line 62`. This is the pattern the review
  brief calls out repo-wide: a hand-built object double-cast through `unknown`
  to satisfy a parameter the callee does not actually read. Confirmed by
  reading `registerHooksBridge` (`extensions/pi-claude-marketplace/bridges/hooks/event-router.ts:705-707`):
  its `opts: { ctx: ExtensionContext; cwd: string; executor?: HookExecutor }`
  requires a full `ExtensionContext`, but the function body never references
  `opts.ctx` (only `opts.cwd` and `opts.executor` are read — grep confirms no
  other occurrence). The parameter that should narrow is `registerHooksBridge`'s
  `opts.ctx` field, not anything in this file: drop `ctx` from that options type
  (or type it as a consumer-declared port that reflects what the function
  actually needs, which today is nothing) so `index.ts` can call
  `registerHooksBridge(pi, { cwd: homedir() })` directly and delete
  `placeholderCtx` and its unsafe cast entirely. The existing comment (lines
  44-49) is a fine justification for *why* a placeholder exists today, but the
  right fix is to make the placeholder unnecessary rather than to keep
  documenting it.

- **[WARNING] Double-cast on the `resources_discover` registration has no
  comment explaining what it works around** — `lines 30-36` (`const
  onResourcesDiscover = pi.on.bind(pi) as unknown as (...) => void;`). Per the
  style guide, `as unknown as` needs an obvious or commented reason; the only
  nearby comment (lines 38-60) explains the DISP-01 await-ordering rationale,
  not why this specific registration cannot be written as a direct
  `pi.on("resources_discover", handler)` call the way every other registration
  in this file is. The peer dependency's own `ExtensionAPI.on` overload for
  `resources_discover` (`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts:869`)
  takes `ExtensionHandler<ResourcesDiscoverEvent, ResourcesDiscoverResult> =
  (event, ctx) => Promise<R | void> | R | void`, and the peer's own
  `ResourcesDiscoverEvent`/`ResourcesDiscoverResult` are structurally identical
  to the local ones re-declared in `platform/pi-api.ts:90-100` — on a first
  read it is not obvious why a direct call would fail to typecheck. Two
  concrete next steps for whoever picks this up: (1) try deleting lines 30-36
  and calling `pi.on("resources_discover", async (event, ctx) => {...})`
  directly at line 64, matching every other registration in this file and in
  `registerHooksBridge`; if `tsc` still passes, remove the workaround. (2) If
  it does not typecheck, add a comment stating the specific overload-resolution
  reason, following the precedent already set for `ToolResultEventResult` in
  `platform/pi-api.ts:72-83`. This review did not run `tsc` (out of scope per
  the sweep's rules), so which of the two applies is unverified.

- **[WARNING] Entry-point doc comment states only "why," never "what"** —
  `lines 23-28`, directly above `export default async function
  claudeMarketplaceExtension`. The comment opens with "DISP-01: async
  factory;" and spends its five lines entirely on await-ordering rationale; it
  never states in a sentence what the function does (registers the hooks
  bridge, the `resources_discover`/`session_start` handlers, the
  `/claude:plugin` command, and the two MCP tools). Sibling exported functions
  in this codebase lead with a "what" clause before the rationale — e.g.
  `recomputePluginPath` (`orchestrators/plugin-path.ts:70-73`: "recompute the
  plugin-PATH from install state and apply it to `process.env`.") — so this is
  a real gap against the file's own established pattern, not an invented
  external rule. Add one leading sentence describing what the factory
  registers before the existing DISP-01 rationale; keep the rationale as-is.

### Clean files

(none beyond the findings above — everything else in the file, including error
handling, catch-block discipline, spread safety on `aggregateDiscoveredResources`'s
result, and the `session_start` handler, reviewed clean)

## Not covered

- Did not run `tsc`, `eslint`, `fallow`, `node --test`, or coverage tooling, per
  the sweep's read-only rule. The `.bind(pi) as unknown as (...)` finding above
  is therefore reported as "needs verification," not as a confirmed dead
  workaround.
- Did not review `tests/edge/notification-boundary.ts` as a target of its own
  findings (it is shared test-support code presumably owned by whichever
  assignment covers `tests/edge/`); it was read only to confirm how
  `tests/index.test.ts` uses `createNotificationBoundary`.
