# Phase 3: Read-Time Verdicts - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Mode:** autonomous smart discuss; every answer is the recommended one,
settled without the user per the run's standing instructions, and each
judgment call is logged in `DUBIOUS-CHOICES.md` (P3-DC-NN).

<domain>
## Phase Boundary

A plugin's state (`installed`, `partially-installed`, `partially-available`,
`upgradable`...), each MCP server's verdict, the MCP soft-dependency marker,
`info`'s `requires:` line, and `--partial` consent follow the active MCP
implementation (`run.softDeps.mcpImplementation`: `adapter`, `builtin`, or
`none`). The stored compatibility becomes implementation-neutral
(`compatibilityBasis: "neutral"`), and every read surface computes the
effective state at read time with the frozen `effectiveMcpCompatibility`, so a
switch between implementations needs no plugin action and never asks for
consent (MREC-03..MREC-07, D-MB-01, D-MB-05..07).

Out of scope: registering servers with Pi (Phase 2), server status in `info`
(Phase 2, `info-mcp-status.ts`), agent grants (Phase 4), hook tool names
(Phase 5), CHANGELOG/README text and closed-set removals (Phase 6, parent
lines here). Frozen files from `01-FROZEN.md` are never edited; a needed
change is a parent line.

</domain>

<decisions>
## Implementation Decisions

### A. Neutral records and the effective read (MREC-03)

- **Neutral verdict = the `none` view.** The stored compatibility is the
  verdict that holds under every implementation: a server counts as blocked
  only when both profiles block it (`ws`, host-only types, a leading `~`,
  `headersHelper`, truthy `oauth.xaa`), and a `.mcpb`/`.dxt` bundle blocks.
  `sse` (built-in only) and `bareElicitationCapability` (adapter only) never
  enter the stored verdict. `installable` and `unsupported` are computed from
  that view plus the non-MCP kinds. (P3-DC-01)
- **Every writer of a new or replaced compatibility writes the neutral verdict
  and sets `compatibilityBasis: "neutral"`**: install (`statePhase` writes the
  basis on the new record), the update swap's final write, the update intent
  mark, the disabled pin refresh (`refreshDisabledRecord`), and the AMIG-01
  dropped-server write. A replacing writer calls `replaceCompatibility`
  first (it clears the basis), then sets the basis. Phase 1 owns the record
  write itself (`statePhase`, the update-swap record write); Phase 3 changes
  only what verdict they write and the basis, in the narrowest diff, and logs
  the edit to a Phase 1-owned function as a dubious choice if it must touch
  it. A legacy record (no basis) keeps the adapter reading, as P1-DC-02
  froze. (P3-DC-02)
- **The resolver computes per-implementation verdicts.** Phase 3 owns
  `domain/{mcp-resolution,plugin-resolver,resolver-types}.ts` state and
  verdicts. The resolver classifies each merged server under both profiles
  once, and exposes the resolution's `state`, `unsupported`, and
  `droppedMcpServers` for an implementation the caller names (`adapter`,
  `builtin`, or `none`), plus the neutral view that `statePhase` stores.
  `declaredMcpServers`, `mcpBundle`, and the entry points
  `recorded-servers.ts` calls stay as Phase 1 left them, and `mcpServers`
  stays the adapter-supported subset the mcp phase stages under every
  implementation (frozen interface 4, MSEL-04). The planner picks the shape
  (an option argument, or both views on the result); every caller passes the
  run's active implementation explicitly, never a default, so no surface
  silently keeps the adapter table. (P3-DC-03)
- **One effective-read helper.** A new orchestrator module (Phase 3 prefix,
  for example `orchestrators/plugin/mcp-verdict-read.ts`) joins a record with
  `recordedMcpServers(record, createLegacyServersReader(source))` and
  `effectiveMcpCompatibility(record, recorded, active)`. It is offline (the
  legacy reader re-resolves read-only from the cached clone) and is the only
  way a surface reads a record's MCP verdict. `list`, `info`, completions
  (`edge-deps.ts`), `pending`, `apply`'s convergence, the update preflight,
  and the promotion and re-enable gates read through it. When the read is
  `unreadable`, the stored verdict stands (frozen rule 1). (P3-DC-04)
- `classifyInstalledRecord` and `derivePersistedInstalledStatus` take the
  effective `unsupported` instead of `record.compatibility.unsupported`, so
  one installed `sse` plugin is `installed` under the adapter and
  `partially-installed` under built-in with no reinstall.

### B. Markers, `requires:`, and severity (MREC-05, MREC-07)

- **Which marker.** For a plugin's MCP servers, let R be the servers at least
  one profile runs (non-malformed and not blocked by both), and I the
  implementations that run every server in R:
  - R empty (no MCP server, or every server blocked by both): no MCP
    `requires` marker and no MCP `requires:` entry; a blocked server still
    shows `{unsupported mcp}` only.
  - I = {adapter, builtin}: `requires mcp`; I = {adapter}:
    `requires pi-mcp-adapter`; I = {builtin}: `requires builtin mcp`.
  - I empty (servers split: one only the adapter runs, one only built-in
    runs): with no active implementation, `requires mcp`; with an active one,
    the other implementation's name. (P3-DC-05)
- **When it shows.** With no active implementation and R not empty, every
  plugin row with markers shows the marker (installed rows stay `installed`,
  D-MB-01). With an active implementation in I, no marker. With an active
  implementation not in I, the marker sits beside `{unsupported mcp}` after
  the content reasons: `{unsupported mcp, requires pi-mcp-adapter}` for `sse`
  under built-in, `{unsupported mcp, requires builtin mcp}` for a server with
  a bare elicitation capability under the adapter. At most one MCP marker per
  row, in the MCP slot of the soft-dependency order (agents, mcp, workflows).
  This includes `partially-installed` list rows, which today carry no
  dependencies. (D-MB-07, P3-DC-06)
- **`info`'s `requires:` line** names the marker of I with `(missing)` when
  the active implementation is not in I (or none is active), and without it
  when the active implementation runs every server. So a stdio plugin reads
  `requires: mcp` under the adapter and under built-in, and
  `requires: mcp (missing)` with none; JSON
  `{"companion":"mcp","missing":false}`. Today's adapter output
  `{"companion":"pi-mcp-adapter","missing":false}` changes. (P3-DC-07)
- **Severity.** `companionSeverity` raises warning exactly when an MCP marker
  shows, which is today's `requires pi-mcp-adapter` rule (D-MB-07); reconcile
  rows keep applying no companion severity. Phase 3 edits only the MCP arm of
  `shared/concerns/soft-dep.ts` and of `companionSeverity`, and the MCP
  wording in `notify-reasons.ts`; the closed sets already hold every token.
- **Inputs.** The `Dependency` passed to the markers carries the two
  per-profile verdict lists (or R and I) instead of today's bare
  `declaresMcp`; each emit site (the ~30 sites the survey found: install,
  cascade, update, reinstall, enable, import, apply, dependency moves, list,
  install-flow-results) gets it from its resolution or from the effective
  read. Hard-coded `false` sites stay `false`. (P3-DC-08)

### C. `--partial` consent (MREC-05, MREC-06)

- **User-run install and update ask against the active implementation**:
  the preflight gate uses the resolution's view for
  `run.softDeps.mcpImplementation`. With no active implementation, the view
  is `none`, so only servers both profiles block (and non-MCP drops) need
  `--partial` (D-MB-05); an `sse` plugin installs without consent and shows
  `{requires pi-mcp-adapter}`. (P3-DC-09)
- **A user-run update asks only for a new degrade**: the candidate's view is
  compared with the installed record's effective view under the same active
  implementation; the classifier's `partially-upgradable` split reads the
  effective record. A record that is already partial because of a switch is
  `partially-installed`(-upgradable), which keeps today's rules.
- **Enable, apply, reinstall, import, autoupdate, promotion, and cascades
  never ask because of a switch**: their gates read the neutral stored
  `installable` (or pass `partial: true`, as reinstall and autoupdate do
  today), which no implementation changes. Apply's convergence move needs
  consent only when the candidate drops something the installed record,
  read under the active implementation, does not drop; a switch alone never
  holds a move. (P3-DC-10)

### D. Load, pending, apply, and AMIG-01 after a switch

- **No load warning row for a switch.** A switch changes no record, and
  APL-D1 keeps the load to `pending`'s block; `list` and `info` show the new
  state. (P3-DC-11)
- **`pending` and `apply` show nothing for a state that changed only because
  the implementation changed** (there is nothing to apply). Their forced-
  install preview (`(will partially install)`) and their rows read the active
  implementation like every other surface.
- **AMIG-01 stays explicit about the adapter**: it moves legacy `mcp.json`
  entries into `mcp-adapter.json`, an adapter file, under every
  implementation (MSEL-04), so its staging uses the adapter view by name and
  its notice keeps "pi-mcp-adapter cannot run it". Its dropped-server record
  write writes the neutral verdict with the basis, so a migration never puts
  an adapter verdict back into a neutral record. (P3-DC-12)

### E. Behavioral tests and red proof

- `features/mcp-server/verdict-markers.feature`: each tag pair whose twins
  now agree (a stdio server runs under both, so no marker) folds into one
  `@mcp` scenario; new pairs pin the implementation-specific rows: an `sse`
  plugin (`installed` under the adapter, `partially-installed` with
  `{unsupported mcp, requires pi-mcp-adapter}` under built-in, with no
  reinstall between, MREC-03/07), a bare-elicitation server
  (`{unsupported mcp, requires builtin mcp}` under the adapter), `info`'s
  per-server verdict lines (MREC-04), and a `ws` server (`{unsupported mcp}`
  only under both). New Phase 3 files may be named
  `features/mcp-server/verdict-*.feature` with `mcp-server/verdict-*` steps
  and `features/lib/mcp-verdict-*.ts` helpers. (P3-DC-13)
- **No active implementation** is reached with the frozen steps
  (`the user's pi settings turn off pi's built-in mcp`,
  `the user restarts pi with no mcp`), in `@own-implementation` scenarios:
  `{requires mcp}`, `{requires pi-mcp-adapter}` (sse), and
  `{requires builtin mcp}` rows, `requires: mcp (missing)` in `info`, an
  install with no `--partial`, and Pi's settings file unchanged (MREC-05).
  `companion-missing.feature` is rewritten on this model and loses its
  `@builtin-only` tag; `invalid-configs.feature` loses `@adapter-only` and
  runs `@mcp`.
- **Consent scenarios** (MREC-06): a user-run install and update ask under
  the implementation that blocks; enable and `apply` after a switch do not.
- Each changed behavior records its red proof per profile (the scenario
  fails on the Phase 1 tree under that profile). The e2e marker tests
  (`adapter-detection-rpc`, `install-soft-deps`) and the marker/state
  assertions in `test/integration/mcp-*` follow the new rules; new
  integration cases go in `test/integration/mcp-verdict-*`.

### F. Parent lines and process

- CHANGELOG parent lines: the two new reasons (`requires mcp`,
  `requires builtin mcp`), the state that follows the active implementation,
  and the `requires:` change. `docs/json-output.md` already lists the reasons
  (closed set, Phase 1); any wording change there is a parent line.
- `docs/messaging-style-guide.md` marker text is Phase 3's and is updated.
- Wave 3 merges `origin/features/mcp-builtin` (Phases 5, 4, 2) before the
  phase gate and re-runs every owned row under both profiles.

### Claude's Discretion

- The resolver's API shape for the per-implementation view, the effective
  read module's name and signature, and how the marker inputs travel through
  `Dependency`, as long as every caller passes the active implementation
  explicitly.
- Wave split inside the ROADMAP's suggested structure (tracer: neutral
  record plus effective `list`; then info verdicts, markers, consent in
  parallel; then merge and gate).

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `domain/mcp-implementation.ts`: `profileFor`, `effectiveMcpCompatibility`
  (frozen); `orchestrators/mcp/recorded-servers.ts`: `recordedMcpServers`,
  `createLegacyServersReader` (frozen, no consumer yet).
- `persistence/state-io.ts`: `replaceCompatibility` (clears the basis),
  `mcpServerConfigsOf`, `DISABLED_PIN_FIELDS` in `update-preflight.ts`.
- Closed sets already hold `requires mcp`, `requires builtin mcp`, companions
  `mcp` and `builtin mcp` (`notification-types.ts:298-299`,
  `shared/concerns/soft-dep.ts:42-43`, `notification-wire.ts`).

### Established Patterns
- Markers: `softDepMarkers` (`soft-dep.ts:108-131`) is called only by
  `composeRowReasons` (`notification-resolve.ts:436-450`) for row policies
  with `markers: true`; `companionRequirements` (`soft-dep.ts:139-162`) feeds
  `info`'s `requires:` (`info.ts:3119-3135`, grammar
  `notification-grammar.ts:844-854`); `companionSeverity`
  (`notify-reasons.ts:89-102`).
- State: `classifyInstalledRecord` (`plugin-state-classifier.ts:119`, callers
  `list-installed-row.ts:143`, `edge-deps.ts:145`),
  `derivePersistedInstalledStatus` (`info.ts:1736`), `partialDegrade` in
  `update-swap.ts:1692`.
- Consent: `requireInstallable`/`requirePartialInstallable`
  (`plugin-resolver.ts:819-884`), install `preflightInstallResolve`
  (`install-outcome.ts:722`), update `resolveUpdateCandidate`
  (`update-preflight.ts:455`, `widensPartialGate` :726), convergence
  `recordMove` (`reconcile/convergence.ts:407-456`), stored-installable gates
  in `enable-disable.ts:395,1004`, `install-cascade.ts:1444`,
  `install-flow-results.ts:409,496`, `import/execute.ts:1143`.
- Resolver: `mergeServers` (`mcp-resolution.ts:93-109`) runs the adapter
  classifier; `recordMergedServers` (:346-374) builds `mcpServers`,
  `declaredMcpServers`, `droppedMcpServers`, `mcpBundle`, and the
  `mcpServers` kind; `decideResolution` (`plugin-resolver.ts:792-808`).

### Integration Points
- The run snapshot: `run.softDeps.mcpImplementation` (frozen interface 2).
- Every emit site of the MCP `Dependency` (survey list: install-flow-ledger,
  install-outcome, install-cascade(+messaging), update-swap, update-row,
  update-cascade, shared, enable-disable, reinstall.messaging,
  dependency-move, import/execute, reconcile/apply, reconcile/notify,
  list-installed-row, install-flow-results).

</code_context>

<specifics>
## Specific Ideas

- D-MB-07's example must render byte-exactly: `{unsupported mcp, requires pi-mcp-adapter}`.
- The ROADMAP success criterion 1 example (one `sse` plugin, available under
  the adapter and partially available under built-in, no reinstall) is the
  wave-1 tracer.
- Environment facts from `.planning/CHILD-SESSION-BRIEF.md` (root DAC wrapper
  `nondac-sh`, warm ESLint first, worktree hook caveat, zizmor without
  `GH_TOKEN`, per-executor scratch folders, `files_deleted`, TDD commits
  test and implementation together) apply to every executor.

</specifics>

<deferred>
## Deferred Ideas

- A load notice that names a plugin whose state changed because of a switch
  (rejected for this phase by APL-D1; could be a v2 idea).
- Removing `requires pi-mcp-adapter` wording variants or any closed-set entry
  that ends up unused: Phase 6.

</deferred>
