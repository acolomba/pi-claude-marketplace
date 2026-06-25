---
phase: 01-localized-type-model-command-context-spine
plan: 01
subsystem: notifications
tags: [typescript, discriminated-union, command-context, notify, output-neutral]

# Dependency graph
requires:
  - phase: (none — first plan of the phase, builds on the V1 notify monolith)
    provides: shared/notify.ts central vocabulary + switches + closed REASONS set
provides:
  - CommandContext<Status,Msg> interface + RenderFn + Single/Plural cardinality aliases (shared/notify-context.ts)
  - notifyWithContext adapter dispatching per-row body via context.render[status] through the shared emitWithSummary seam
  - emitContextCascade seam in notify.ts (parameterized per-plugin row renderer; byte-identical cascade composition)
  - Exported shared presentation vocabulary (ICON_*, joinTokens, renderScopeBracket, renderVersion, composeVersionArrow, composeReasons, pluginRow)
  - Universal MessageBase shape carrying inert optional severity?/needsReload? (D-06/D-07)
  - Topic-grouped reason enums + compile-time completeness proof (shared/notify-reasons.ts); REASONS membership byte-identical
affects: [Wave-2 per-command migrations (plugin family, marketplace family, import, reconcile), Plan 01-05 central-switch removal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CommandContext<Status,Msg> interface + per-command `as const satisfies` pin (interface, not class — D-04)"
    - "Mapped render member `{ [K in Status]: RenderFn<Extract<Msg,{status:K}>> }` as the D-10 missing-arm-is-TS2741 exhaustiveness anchor"
    - "Adapter seam: notifyWithContext dispatches per-row body via context.render, reuses emitWithSummary for severity/summary/reload (output byte-identical)"
    - "Closed-set reorganization via typed VIEWS over the byte-source tuple + compile-time partition-completeness proof (OUT-08)"

key-files:
  created:
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts

key-decisions:
  - "CommandContext is an interface + per-command `as const satisfies CommandContext<...>` (not a class) — label and the render map are data, so the satisfies-pin is the idiomatic TS that still enforces the contract (D-04)."
  - "notifyWithContext dispatches the per-row body through context.render[status] (NOT the central renderPluginRow switch) via a new emitContextCascade seam that reuses the shared marketplace-header/cause-chain/rollback/reload-hint/severity/summary path, so output is byte-identical."
  - "Closed REASONS tuple stays the byte-source in notify.ts (membership + order unchanged); notify-reasons.ts provides topic-grouped typed VIEWS + a compile-time completeness proof rather than recomposing the tuple (avoids reorder risk — OUT-08)."
  - "Universal severity?/needsReload? live on a shared MessageBase interface extended by MpCommon + the 16 plugin row interfaces; dependencies stays REQUIRED on installed/updated/reinstalled so soft-dep marker gating is unchanged (Pitfall 4)."

patterns-established:
  - "CommandContext spine: shared interface + per-command satisfies-pin, mapped render exhaustiveness."
  - "Adapter-then-migrate: new entry point (notifyWithContext) alongside legacy notify(); both share emitWithSummary."
  - "Closed-set reorganization without byte drift: typed views + partition proof over the byte-source tuple."

requirements-completed: [MOD-01, MOD-02, MOD-03, OUT-07, OUT-08]

# Metrics
duration: ~30min
completed: 2026-06-24
---

# Phase 1 Plan 01: Localized type-model & command-context spine Summary

**Shared CommandContext<Status,Msg> spine + notifyWithContext adapter (dispatches via context.render through the shared emitWithSummary seam), exported presentation vocabulary, inert universal severity?/needsReload? base fields, and a topic-grouped reasons split — all output byte-identical (114 catalog-uat fixtures + notify-v2 unchanged).**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-24T17:27:14Z
- **Tasks:** 3
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments
- `CommandContext<Status,Msg>` interface with `Messaging.label` + a mapped `render` member (the D-10 TS2741 missing-arm exhaustiveness anchor), `RenderFn`, and `Single`/`Plural` cardinality aliases — the horizontal surface every Wave-2 command builds against.
- `notifyWithContext` entry point that dispatches each per-plugin row body through `context.render[row.status]` (not the central switch) via a new `emitContextCascade` seam, while reusing the shared severity/summary/reload + single `ctx.ui.notify` path so output stays byte-identical.
- Widened the shared presentation vocabulary to `export` (bodies unchanged) so sibling command render maps can call it (D-11), and added the inert universal `severity?`/`needsReload?` base fields (D-06/D-07).
- Split the closed 32-entry REASONS set into three shared topic-grouped enums with a compile-time partition-completeness proof; the runtime tuple's membership and order are byte-identical (OUT-08).

## Task Commits

Each task was committed atomically:

1. **Task 1: Export shared presentation vocabulary + add inert optional base fields** — `2245c1f9` (feat)
2. **Task 2: Create notify-context.ts — CommandContext, RenderFn, cardinality aliases, notifyWithContext adapter** — `5d7ccb4b` (feat)
3. **Task 3: Split the closed REASONS set into topic-grouped enums (membership byte-identical)** — `8a159b42` (feat)

## Files Created/Modified
- `extensions/pi-claude-marketplace/shared/notify-context.ts` (created) — `CommandContext<Status,Msg>` interface (interface + satisfies-pin idiom), `RenderFn`, `Single`/`Plural` cardinality aliases, and the `notifyWithContext` entry point that dispatches via `context.render[status]`.
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (created) — three shared topic-grouped reason enums (idempotent / unsupported-components / failure-class) + a compile-time completeness proof asserting the partition exactly covers the closed `Reason` set.
- `extensions/pi-claude-marketplace/shared/notify.ts` (modified) — exported the presentation vocabulary (`ICON_*`, `joinTokens`, `renderScopeBracket`, `renderVersion`, `composeVersionArrow`, `composeReasons`, `pluginRow`); added the universal `MessageBase` shape (inert `severity?`/`needsReload?`) extended by `MpCommon` + 16 plugin row interfaces; added the `emitContextCascade` seam + parameterized `composePluginLinesWith`; added a D-09 anchor on `REASONS`.

## Decisions Made
- **CommandContext is an interface, not a class (D-04 discretion):** `label` and the render map are pure data, so a per-command `const ... as const satisfies CommandContext<...>` is the idiomatic TS that still enforces "a command cannot be wired without `Messaging.label` and a total render map." Documented with a `D-04` anchor.
- **`notifyWithContext` dispatches via `context.render`, not the central switch:** a new exported `emitContextCascade` seam in notify.ts parameterizes only the per-plugin row body renderer; the marketplace header, description/cause-chain/rollback trailing lines, the `(no marketplaces)` sentinel, the reload-hint trailer, and the severity/summary `emitWithSummary` path all stay central and byte-identical. Each Wave-2 render map reproduces the verbatim switch-arm bytes, so dispatch is byte-identical and proven per-command by catalog-uat.
- **Reasons split keeps `REASONS` as the byte-source:** the tuple in notify.ts is unchanged (membership + order); notify-reasons.ts holds typed topic VIEWS + a compile-time completeness proof (`_ReasonsCoverage` resolving to `true` only when the partition is total) rather than recomposing the tuple — the sanctioned zero-reorder-risk path (OUT-08).
- **`dependencies` reconciliation (Pitfall 4):** `severity?`/`needsReload?` were added to a shared `MessageBase`; `dependencies` was deliberately left REQUIRED on the `installed`/`updated`/`reinstalled` arms (not promoted to optional base), so soft-dep marker injection stays gated to exactly those three render arms — no marker can leak onto a row that never declares a soft dep.

## Deviations from Plan

None — plan executed exactly as written. The three tasks and their acceptance criteria were implemented as specified; no bugs, missing critical functionality, or blocking issues required auto-fixing.

## Issues Encountered
- **One TS cast went through `unknown`:** the generic `dispatchRow` in notify-context.ts initially used `as RenderFn<PluginNotificationMessage>`, which TS rejected (TS2352, insufficient overlap with `RenderFn<Extract<Msg,...>>`). Resolved by routing the cast through `unknown` (`as unknown as RenderFn<PluginNotificationMessage>`) — expected for the Wave-1 generic bridge between the broad cascade row type and a command's narrower `Msg`; each call site only ever supplies rows whose statuses its render map covers.
- **Worktree trufflehog hook structural failure:** the pre-commit `trufflehog` hook fails in a linked worktree because it reads `.git/index` expecting a directory while the worktree `.git` is a file (`error preparing repo: ... not a directory`). This is the documented worktree limitation, not a secret finding. Each commit's staged diff was scanned independently with `trufflehog filesystem` (0 verified/unverified secrets, exit 0) before committing with the sanctioned `SKIP=trufflehog` prefix per the project CLAUDE.md.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- The spine compiles and all byte gates are green (`npm run check` exit 0; `catalog-uat` + `notify-v2` + `notify-grammar-invariant` byte-identical; `git diff docs/output-catalog.md` empty).
- Wave-2 per-command migrations can now declare their own `CommandContext` const (statuses + render map + `Messaging.label`), import the exported vocabulary, reference the topic-grouped reason enums, and route through `notifyWithContext` — each migration is full-cutover end-to-end validated by that command's catalog-uat run.
- Legacy `notify(ctx, pi, message)` still serves all un-migrated callers (it still drives the central switches); removal of those central switches is Plan 01-05.

## Self-Check: PASSED

- Created files present: `shared/notify-context.ts`, `shared/notify-reasons.ts`, `01-01-SUMMARY.md`.
- Task commits present: `2245c1f9`, `5d7ccb4b`, `8a159b42`.
- `npm run check` exit 0; `catalog-uat` + `notify-v2` + `notify-grammar-invariant` green and byte-identical; `git diff docs/output-catalog.md` empty.

---
*Phase: 01-localized-type-model-command-context-spine*
*Completed: 2026-06-24*
