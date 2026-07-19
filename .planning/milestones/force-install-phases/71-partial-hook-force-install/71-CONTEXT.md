# Phase 71: Partial Hook Force-Install - Context

**Gathered:** 2026-06-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `--force` component degradation to HOOKS. Today a `hooks.json` that
parses but contains any unsupportable handler (a non-bucket-A event, or an
unsupported matcher on a bucket-A event) fails the whole config and resolves the
plugin `unavailable` (structural). This phase makes that case force-degradable:
the plugin resolves `unsupported`, and `install --force` installs its supported
components PLUS the supportable hook handlers, dropping only the unsupportable
ones. Genuinely malformed configs (unparseable JSON, malformed handler) still
resolve `unavailable`.

This is the first time `--force` degrades a SUBSET of a single component file
(rather than dropping a whole separate artifact like `.lsp.json`/`themes/`).

Builds on Phase 64 (three-way resolver state + structural precedence), Phase 65
(`--force` path), Phase 66 (derived force state + `{unsupported hooks}` reason
rendering + `info` dropped-component detail).

Requirements PHOOK-01..05 and the five success criteria are locked by the
ROADMAP. Granularity is **event + matcher level** (user decision).

</domain>

<decisions>
## Implementation Decisions

### Partition, not reject-all (PHOOK-01)
- **D-71-01:** `checkMatcherSupportability` (and the parse path it gates) must
  PARTITION a parsed `hooks.json` into supported vs unsupported handlers at BOTH
  granularities: drop whole non-bucket-A events, AND drop individual unsupported
  matcher groups within an otherwise-supported event (installing that event's
  supportable groups). It currently `return`s on the FIRST failure — that
  short-circuit becomes an accumulating partition.

### Matcher-mix behavior (PHOOK-01)
- **D-71-02:** When a supported event has a MIX of supportable and unsupportable
  matcher groups, force installs ONLY the supportable groups; the event survives
  partially. (Not "drop the whole event on any bad group.")

### Degradable vs structural boundary (PHOOK-02, PHOOK-03)
- **D-71-03:** A supportability failure (non-bucket-A event, unsupported
  matcher) routes the dropped-handler signal to `partial.unsupported`
  (force-degradable) and KEEPS the supported handlers in the materialization
  set, so the plugin resolves `unsupported`. A STRUCTURAL failure — unparseable
  JSON, or a malformed handler (e.g. `type:"command"` with no `command`) — still
  feeds the structural `dirty` accumulator and resolves `unavailable`
  (structural precedence from D-64-07 preserved). The current single "hooks
  failed -> dirty -> unavailable" verdict (`applyHooksConfig` returning `true`)
  must be SPLIT into these two outcomes.

### Reason rendering (PHOOK-05)
- **D-71-04:** The compact `list` row keeps a SINGLE aggregate `{unsupported
  hooks}` marker regardless of how many events/matchers were dropped — reuses
  the existing reason vocabulary and the closed set (no new REASONS member, no
  tripwire change). The marker renders identically across `list` and `info` and
  at the force-degrade severity.

### info detail (PHOOK-05)
- **D-71-05:** `/claude:plugin info` ENUMERATES the specific dropped hook
  handlers (which events / which matcher groups were skipped), mirroring how
  FSTAT-07 surfaces dropped-component detail. The aggregate marker stays on the
  list row; the per-handler breakdown lives in `info`.

### Severity
- **D-71-06:** A direct `install --force` partial-hook degrade renders at
  **info** (no `Warning:`), consistent with SEV-01 (force degrade = info);
  without `--force` the plugin still blocks/errors (the SEV-02 `unsupported`
  arm error + `--force` hint already applies, since the plugin now resolves
  `unsupported`).

### Claude's Discretion / for planning
- The exact partition result TYPE, where the filtered `HooksConfig` is produced
  and threaded (resolver vs bridge), and the `info` detail wording — left to
  planning per the research questions below, provided behavior matches
  D-71-01..06.

</decisions>

<research_questions>
## Research Questions (for gsd-phase-researcher)

1. **Partition result shape.** `checkMatcherSupportability` returns a single
   `SupportabilityResult` (ok / first-fail). Design the partitioned return: the
   supported `HooksConfig` subset + an enumeration of dropped events/matcher
   groups + the structural-fail flag. Trace every current failure mode in
   `tryGroupTrip` / `tryHandlerTrip` / `checkMatcherSupportability` and classify
   each as SUPPORTABILITY (degradable) vs STRUCTURAL (stays unavailable) per
   D-71-03.
2. **Where the filtered config is produced and threaded.** Today the resolver
   records only `hooksConfigPath` (a pointer to the SOURCE file) and the hooks
   bridge reads/processes that source file at materialize time. For partial
   install the bridge must stage a FILTERED `hooks.json`. Decide: does the
   resolver compute + thread the filtered `HooksConfig` (it already parses it),
   or does the bridge re-run the partition? Map the `hooksConfigPath` ->
   `bridges/hooks/stage.ts` materialize seam.
3. **Reason + info plumbing.** How the dropped-handler enumeration reaches
   `info` (D-71-05) while the list row stays aggregate (D-71-04) — reuse the
   Phase 64 `narrowUnsupportedKinds` / render-time marker family and the
   `partial.unsupported` channel.
4. **Existing hooks tests / fixtures.** Identify the hooks resolver + bridge
   tests and catalog-uat fixtures that assume "non-bucket-A => unavailable" so
   they can be migrated to the new partition behavior.

</research_questions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Resolver hooks classification (the core change)
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` —
  `checkMatcherSupportability` (~805, the reject-all loop), `parseHooksConfig`
  (~346-372, where supportability folds into the parse `ok:false`),
  `tryGroupTrip`/`tryHandlerTrip`/`tryNonToolEventTrip`,
  `BUCKET_A_MEMBERS` (~680).
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` —
  `BUCKET_A_EVENTS` (the 8-event supported set).
- `extensions/pi-claude-marketplace/domain/resolver.ts` —
  `readStandaloneHooks` (~716-752), `applyHooksConfig` (~797-826, currently
  pushes to `partial.notes` + returns `true` -> structural), `decideResolution`
  (~1010-1024, structural-precedence three-way), `addUnsupportedKindNotes`
  (~927-942, the `partial.unsupported` pattern to mirror).

### Hooks bridge (filtered materialization)
- `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` — materializes
  `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` (~6,35); the
  per-event routing in `event-router.ts` / `event-adapters.ts` / `dispatch.ts`.

### Force + reason + severity foundation
- `.planning/phases/64-resolver-three-way-state/64-CONTEXT.md` — three-way
  state, structural precedence (D-64-07), render-time marker family.
- `.planning/phases/66-derived-force-state-glyphs/66-CONTEXT.md` — `info`
  dropped-component detail (FSTAT-07), `{unsupported hooks}` rendering.
- `.planning/phases/69-force-path-severity/69-CONTEXT.md` — SEV-01 (force
  degrade = info), SEV-02 (no-force unsupported error + `--force` hint).
- `extensions/pi-claude-marketplace/shared/notify.ts` — reason composer +
  closed-set REASONS (must stay 32 per D-71-04).

### Requirements & specs
- `.planning/REQUIREMENTS.md` — PHOOK-01..05.
- `.planning/ROADMAP.md` — Phase 71 goal + success criteria.
- `docs/output-catalog.md`, `docs/messaging-style-guide.md` — byte forms
  (catalog-UAT must stay GREEN).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `partial.unsupported` + `addUnsupportedKindNotes` pattern — the degradable
  channel the dropped-hooks signal should join (mirror it for hooks).
- `narrowUnsupportedKinds` render-time marker family (Phase 64) + the `info`
  dropped-component detail (Phase 66) — reused for D-71-04 / D-71-05.
- The per-event hooks bridge (`event-router`/`event-adapters`) — already
  processes hooks per-event, so staging a filtered subset is feasible.

### Established Patterns
- `decideResolution`: `structuralDirty` -> `unavailable`; else
  `partial.unsupported.length > 0` -> `unsupported`; else `installable`. The
  whole change hinges on routing supportability-failures to `partial.unsupported`
  instead of `dirty`.
- Byte-exact output contract: notify tests + catalog-uat assert exact bytes;
  reason vocabulary is a closed set (keep `{unsupported hooks}` aggregate to
  avoid a REASONS tripwire change).
- Comment/test-title policy: D-71-NN / PHOOK-NN / NFR-N IDs, never GSD
  phase/plan references.

### Integration Points
- `install --force` / `update --force` orchestrators (Phase 65) already gate on
  `requireForceInstallable`; once hooks plugins resolve `unsupported` they flow
  through that path automatically — the new work is the resolver partition +
  bridge filtered-staging + info detail.
- Real unlocked plugins (validation targets): hookify (skills+agents+commands +
  Stop hook), ralph-loop (commands + Stop), security-guidance (bucket-A hooks +
  Stop) from `anthropics/claude-plugins-official`.

</code_context>

<specifics>
## Specific Ideas

Origin: analysis of the official marketplace showed ZERO mixed force-installable
plugins under the current rules — the only `unsupported` plugins are LSP-only
(force installs nothing). The plugins with real partial value (skills/commands +
hooks) are blocked `unavailable` solely by the `Stop` event. This phase converts
that structural rejection into force-degradation so those plugins install their
supported surface.

Key correctness lever: the structural-vs-supportability split. Malformed configs
MUST stay `unavailable` (force cannot help broken structure); only the
"we-don't-support-this-event/matcher" case becomes degradable. The materialized
`hooks.json` must be a strict, deterministic subset of the source — the bridge
never stages a dropped handler.

</specifics>

<deferred>
## Deferred Ideas

- Expanding `BUCKET_A_EVENTS` to natively support `Stop`/`SubagentStop`/
  `Notification` (would make these plugins fully `installable`, no `--force`) —
  separate concern; only pursue if Pi's hook bridge can actually dispatch those
  events. Not in this phase.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 71-partial-hook-force-install*
*Context gathered: 2026-06-28*
