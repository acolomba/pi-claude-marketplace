# Milestones: pi-claude-marketplace

## url-source URL Sources (Shipped: 2026-07-13)

**Phases completed:** 4 phases, 20 plans, 49 tasks

**Key accomplishments:**

- Generic https:// sources now parse to a .git-canonical UrlSource, github.com URLs (string + object form) normalize to github kind, owner/repo@ref folds to github+ref, the samePlannedSource url arm is live and ref-aware, and the closed-set gains a truthful `authentication required` REASONS token.
- The three marketplace lifecycle orchestrators now handle `url`-kind sources: `add` clones `source.url` verbatim with no auth via a shared clone-into-guard helper, `classifyAddError` maps a 401/403 HttpError to `authentication required`, `update` re-fetches via the origin remote with atomic-swap parity and no auth, and `remove` deletes the url clone dir so re-add never hits `{stale clone}`.
- `marketplace info` now renders url sources as `url: <url>[#ref]` with `last_updated:` for git-backed kinds (never `path:`), a persisted url record loads correctly, and `import` maps both the flat legacy and nested upstream `extraKnownMarketplaces` shapes.
- Source-addressed `<12hex(sha256(url))>-<sha12>` cache-key helper, the `sha-<12hex>` git-source version convention with its `#<7hex>` list-surface render, the `plugin-clones/` NFR-10 path chokepoint, and the additive-optional `resolvedSha` state field — the dependency roots every later Phase 77 plan consumes.
- The resolver now classifies url / git-subdir / github-object plugin sources as installable by delegating clone-vs-probe to an injected `resolveGitPluginRoot` callback, staying network-free for list/info while anchoring git-subdir containment to the clone root (NFR-7 preserved via a materialized-only result arm).
- `materializePluginClone` clones a git plugin source at its pinned/resolved sha into the source-addressed `plugin-clones/<key>/` cache via staging + atomic rename, deduped by url+sha with an offline warm-cache short-circuit and a concurrent-install-tolerant rename; `resolvePluginPin` canonicalizes the clone url and resolves the pin sha-over-ref (unpinned HEAD via the new `resolveRemoteRef` GitOps primitive).
- `install.ts` now installs a `url` / `git-subdir` / `github`-object plugin end to end: it injects a clone-materializing `resolveGitPluginRoot` callback (Plan 02 seam) that runs the Plan 03 clone-cache seam, captures the resolved 40-hex sha as a side-channel, records `version: sha-<12hex>` (D-77-01) and the full `resolvedSha` (D-77-02), enforces git-subdir clone-root containment, and keeps zero git surface so the `no-orchestrator-network` gate stays green.
- fs-only `garbageCollectPluginClones` that derives live clone keys from surviving git-source state records (derive-not-persist) and deletes unreferenced `plugin-clones/<key>` dirs through the containment chokepoint, with ENOENT no-op and leak-swallow semantics.
- Uninstalled git-source plugins (url / git-subdir / github) now render `(available)` on `list` and `info` via a manifest short-circuit, and installed plugins with a cold clone cache degrade to plain `(upgradable)`/`(installed)` through an fs-only presence probe — all without cloning or touching the network.
- Post-commit `garbageCollectPluginClones(locations)` call in uninstall.ts that reclaims a git-source plugin's cached clone once its last referencer is removed, leaves a shared clone intact while another installed plugin references it, and never fails the user-visible uninstall on a GC leak.
- `update` now detects git-source sha changes (pinned manifest sha + unpinned re-resolved HEAD), materializes the new clone before the 3-phase swap, records the new resolvedSha, GCs the unreferenced old clone post-commit, and fails clean on a vanished repo -- with the version arrow already rendering `v#<7hex> → v#<7hex>`.
- Standalone marketplace remove and plugin uninstall now sweep the declarative config across BOTH claude-plugins.json and claude-plugins.local.json, so an orphaned sibling-layer declaration can no longer persist as a perpetual reconcile dangling-reference.
- The reconcile dangling-reference diagnostic now renders `{dangling reference}` instead of the reused `{source mismatch}` token, naming the real problem — an orphaned plugin declaration whose marketplace is undeclared — on both the marketplace row and the plugin child.
- Extracted list.ts's git-source short-circuit and warm-cache presence probe into a shared fs-only module, wired it into the completion bucketizer, and bumped the plugin-index cache schema — so install completion now offers not-installed git-source plugins as (available) at parity with list.
- Post-commit `garbageCollectPluginClones(locations)` call in `marketplace/remove.ts` that reclaims a git-source plugin's cached clone once the last marketplace referencing it is removed, at parity with the uninstall/update GC placement, without ever failing the user-visible remove and without adding any git surface.
- GitAuthProvider registry (host->descriptor lookup) with the RFC-8628 Device Flow engine parameterized by an optional provider descriptor that defaults to GITHUB_PROVIDER, keeping github.com behavior byte-identical.
- Registry-driven `buildAuthForHost` replaces the two inline `host="github.com"` Device Flow blocks in marketplace add/update, threads optional auth into `resolveRemoteRef`, and delivers the no-provider fail-clean contract -- with the D-79-03 cause line scoped (by user checkpoint decision) to the update path's cause-carrying child row.
- The plugin install / update / reinstall clone paths thread a host-keyed `GitAuthBundle` (from Plan 02's `buildAuthForHost`) through the clone-cache seam: private git-source plugins authenticate on provider hosts, public / no-provider hosts clone authless, no-provider clones fail clean with the bare `authentication required` row, and a command-scope once-per-host memo caps the flow -- all while `install.ts` / `reinstall.ts` stay off the platform-git gate.

---

## force-install Force Install (Shipped: 2026-07-02)

**Phases completed:** 12 phases, 33 plans, 71 tasks

**Key accomplishments:**

- Replaced the resolver's binary `installable: true | false` union with a three-way `state: installable | unsupported | unavailable` discriminant, splitting the decision into structural-defect vs unsupported-component signals (structural precedence) and adding the `requireForceInstallable` gate, with NFR-7 refined so `pluginRoot` is compile-unreadable on the minimal `unavailable` arm.
- Introduced the single shared render-time helper `narrowUnsupportedKinds` that derives per-kind unsupported markers from the resolver's typed `unsupported[]` component-kind list (lspServers -> lsp, else unsupported source), and routed `list`, `info`, and the `install` error surface through it so a given unsupported plugin renders byte-identical markers across all three surfaces by construction (D-64-02, RSTATE-05), while structural reasons stay on the `narrowResolverNotes` notes path for the `unavailable` arm.
- 1. [Rule 3 - Blocking] Widened `discoverGeneratedNames` param to `MaterializablePlugin`
- 1. [Rule 3 - Blocking] Added the paired output-catalog.md doc annotation for the new catalog state
- 1. [Rule 2 - Missing critical functionality] isReconcilePlanListEmpty must treat immediate-only marketplace actions as non-pending
- Added the force-installed (◉) and force-upgradable (●) realized plugin statuses, the will-force-install render modifier, and threaded both through every assertNever-forced render/projection/glyph/stamp site, landing the closed-set tripwire bumps + catalog rows + byte fixtures in one green lockstep commit.
- Implemented the single shared force-state deriver in `installedRowMessage`: force-installed is read live (read-only) from the persisted `record.compatibility.unsupported` and checked FIRST, then the clean-record upgradable branch splits on a no-network `resolveStrict` of the candidate manifest entry (unsupported -> force-upgradable, else upgradable), so FSTAT-03 auto-return falls out for free with no persisted flag, no migration, and no state write.
- Threaded the derived force signal into the detail and success surfaces: `info` reports `(force-installed)` with the `narrowUnsupportedKinds` dropped-component detail for an installed plugin re-resolving `unsupported`, and the `install --force` / `update --force` SUCCESS cascade row reads `(force-installed)` (info severity, reload-hint via TRANSITION_STATUS_LIST membership) when the live resolved state is `unsupported`, falling back to `(installed)` / `(updated)` for a fully-supported operation (FSTAT-03 -- no lingering force state).
- The reconcile pending surface now stamps a force modifier on the will-install row -- rendering `(will force install)` -- when the planned install candidate resolves `unsupported` via a no-network `resolveStrict`, while structurally asserting that no `will force update` row is ever produced (the plan has no update bucket).
- reinstall is now a pure repair primitive: overwrite of collisions and foreign content is unconditional, and `reinstall --force` errors as an UNKNOWN flag at the handler, usage string, router help, and completion provider.
- `list --unsupported` now selects not-installed plugins that resolve `unsupported` (keyed on an internal resolver-state bucket so the row keeps its `(unavailable)` byte form), `--installed` spans the full installed inventory including the derived force states, and `--unavailable` narrows to structural-unavailable only -- a clean four-way partition with no `--upgradable` filter and no rendered byte change.
- One shared pure per-entry classifier (`plugin-state-classifier.ts`) is now the single source of plugin-state classification for BOTH `list` and the completion bucketizer (D-67-02); the completion plugin-index cache carries the finer 7-status set (schema v2, auto-evicting), the bucketizer emits those statuses with no network access (NFR-5) and no provider-local reclassification, and a parity drift-guard pins the two surfaces together -- list rendering and no-`--force` completion stay byte-identical.
- With `--force` preceding the plugin positional, install completion now offers the force-installable candidates (`available` + `unsupported`) and update completion offers the force-upgrade candidates (`upgradable` + `force-upgradable`) -- `unavailable` excluded in both -- sourced from the finer 67-03 cache statuses via the shared classifier (no provider-local reclassification); without `--force` the candidate sets are byte-identical to today; `--force` is also a flag completion for install/update (not reinstall) and is registered as a boolean flag for positional extraction, fixing the `install --force <TAB>` -> null bug.
- Checked-in EXTENSION_VERSION constant (drift-guarded against package.json) plus an optional lastReconciledExtensionVersion stamp on STATE_SCHEMA, threaded through loadState normalization so the load-time backfill gate has both persisted inputs it needs.
- Reinstall now resolves the installable|unsupported union through requireForceInstallable and persists the real compatibility set, unblocking backfill re-materialization of force-installed plugins.
- Backfill promotions now have a typed `plugin-backfilled` outcome arm whose re-resolved `installable` boolean projects into an `(installed)` row when fully promoted or a `(force-installed)` row when partially re-materialized, folded into the single load-time applied cascade.
- A force-installed plugin's previously-skipped components now re-materialize automatically at load once the extension supports them: applyReconcile gates a cache-only scan on the lastReconciledExtensionVersion stamp, re-materializes each force-installed plugin whose supported set grew via the force-capable reinstall primitive, folds the promotions into the single reconcile cascade, and stamps the running version whenever the gate opened.
- The no-force install failure now points at `--force` exactly on the force-degradable `unsupported` arm via a typed `forceable` discriminant threaded from the resolver throw to the rendered row, while the structural `unavailable` arm stays byte-frozen.
- An otherwise-successful install/update whose declared soft-dep companion is unloaded now stamps warning (SEV-01), and a force-upgradable `no longer installable` decline follows invocation cardinality -- targeted warning, bulk info (SEV-04) -- both as producer-side desired-state stamps on the existing caller-stamped notification model.
- The marketplace autoupdate cascade now TAKES the force path automatically -- a force-upgradable plugin degrades in place and renders `(force-installed) {dropped kinds}` instead of a misleading `(skipped) {no longer installable}` -- and the row severity follows the persisted prior state: warning when it newly degrades a clean plugin, info when re-degrading an already force-installed one.
- The load-time backfill `(force-installed)` reconcile row now carries a factual `{reasons}` brace -- the re-resolved dropped-component kinds threaded onto `PluginBackfilledOutcome` and composed through the SAME shared `narrowUnsupportedKinds` seam install/list/info use -- so a re-materialized-but-still-degraded plugin renders `(force-installed) {lsp}` instead of a bare `(force-installed)`; a backfill with no dropped kinds stays brace-less (byte-identical to today), and the benign promotion stays info.
- Structural no-`--force` install failures now stamp `severity:error` (leading summary line fires) with no `--force` hint, completing the SEV-02 residual deferred by Phase 69; catalog/style-guide reconciled and catalog-UAT GREEN.
- PRD reconciled to the shipped force feature set -- `--force` install/update, the three-way resolver state (installable | unsupported | unavailable), the force-installed/force-upgradable derived tokens and rules, the frozen `--force` hint trailer, and the WR-01 autoupdate companion-warning scoping -- with the dropped-scope force out-of-scope bullet fully excised.
- Dropped the "placeholder" framing
- Converted the hooks supportability gate from reject-all to an accumulating `partitionHooks` that returns the supported `HooksConfig` strict subset plus a `dropped` enumeration at event + matcher-group + handler granularity, with `parseHooksConfig` threading the filtered subset while structural defects stay `{ok:false}`.
- Split `applyHooksConfig`'s single "hooks failed -> dirty -> unavailable" verdict into three outcomes -- structural defect stays `unavailable`, a parseable config with supportability drops routes to `partial.unsupported` + `droppedHooks` (force-degradable `unsupported`), and the kept non-empty subset still materializes -- so partial-hook plugins become force-installable while structural precedence is preserved.
- The `hooks` kind now renders the single aggregate `{unsupported hooks}` list marker through the shared `narrowUnsupportedKinds` helper (closed set stays 32), and `/claude:plugin info` enumerates each dropped handler as `event(matcher) (unsupported)` on the strict reader path, resolving the lenient->strict reader flip for now-resolving partial-hook plugins.
- Locked the byte-exact partial-hook output contract and proved the security-relevant PHOOK-04 strict-subset property: an `install --force` on a partial-hook plugin stages a `hooks.json` with every dropped event / matcher group absent while the supported group survives; without `--force` it blocks at error severity with the `--force` hint (SEV-02), and the `--force` degrade renders at info as `(force-installed) {unsupported hooks}` with no summary line (SEV-01 / D-71-06) -- all with no severity-layer or bridge source change.
- De-collapsed the resolver `unsupported` arm at the list/info render points so a not-installed, force-installable plugin renders a distinct `⊖ (unsupported)` row (new `ICON_UNSUPPORTED` glyph + `PluginUnsupportedMessage` variant), while structural failures keep `⊘ (unavailable)` — closing the D-64-01 deferral with filter buckets untouched.
- Extended the Phase-72 resolver-state-driven render token to the install-failure (⊖ unsupported) and manual update-decline (● force-upgradable) surfaces, repaired the info.ts non-resolvable latent divergence, and replaced the misleading `{no longer installable}` update-decline reason with a list-consistent degrade reason pointing at `--force`.
- Bulk `update` now suppresses per-plugin `(skipped) {up-to-date}` rows, counts realized transitions only (`Plugin update: N updated`), and never goes silent (`Plugin update: nothing to update`) — delivered via an opt-in `tally` envelope override so every other op's summary stays byte-identical.

---

## v1.13 Claude Hook Bridge (Shipped: 2026-06-19)

**Phases completed:** 7 phases, 32 plans, 52 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocking] Updated 13 pre-existing test fixtures + 3 production call sites for the widened schema
- 1. [Rule 2 - Missing critical functionality] Removed unused `SupportedKind` alias then re-introduced as exported type alongside `SUPPORTED_COMPONENT_KINDS`
- 1. [Rule 3 - Blocking] Exported `UNSUPPORTED_COMPONENT_KINDS` from `domain/resolver.ts`
- 1. [Rule 3 - Blocking] PiToolName derivation: `Exclude<..., string>` evaluates to `never`
- 1. [Rule 1 — Lint] Unnecessary escape character in `SAFE_MATCHER_CHARS` regex
- OBS-01 debug-output seam re-homed at `shared/debug-log.ts` with a per-file ESLint override; Phase 57 stub and TODO retired; three call sites rewired byte-for-byte.
- Hooks-bridge dispatch core landed -- liveEpoch + parsedConfigCache + routingTable module-state holder, 7-event pi.on factory with the `event.isError` PostToolUse/PostToolUseFailure split, no-op execution stub, and 21 unit tests pinning cache + rebuild + sort + epoch + composite-handler contracts.
- Hooks-bridge dispatch wiring landed: async-factory contract with `await registerHooksBridge` blocks first session event until 7 pi.on registrations complete; per-scope `rebuildRoutingTables` in apply.ts after every reconcile (gated on pristine scopes); install/uninstall maintain the parsed-config cache inside the per-plugin lock; 10 unit tests across 7 architecture blocks pin DISP-01..04 + OBS-01 + D-59-05.
- 8 hand-authored Pi -> Claude payload translators under `bridges/hooks/payloads/`, the `mapPiToClaudeToolName` TOOL-01 reuse helper colocated with the const map, and a `TranslationContext` factory ready for the Plan 60-02 exec body to consume.
- `dispatchHookExec` body filled with the real spawn body + per-event payload translation + HOOK-05 env vars + EXEC-02 timer escalation + EXEC-03 stderr sole-sink; ships `HookExecResult` + `parseHookStdout` + `installTimerLadder` as siblings; architecture whitelist widened to 2 entries.
- The dispatch chain is end-to-end live: a Pi event fires -> matcher narrows -> dispatchHookExec runs with the real spawn body (Plan 60-02) -> the D-60-02 reducer composes outcomes across entries with first-block-wins + left-to-right mutate -> the D-60-03 per-event adapter returns the Pi-shaped value the runtime expects.
- Standalone install / uninstall / reinstall / update of hooks-bearing plugins now updates the hooks-bridge routing table inside the per-plugin lock; phantom project-arm cache entries no longer leak past `hydrateProjectScopeForCwd`'s re-hydrate path; REQUIREMENTS.md HOOK-05 wording matches the chosen `_shared` per-session path scheme.
- Hand-authored glob engine + Bash subcommand parser + upstream-faithful prefix-to-Pi-event-set mapping + IfPredicate fall-open sentinel; parse-time-compile primitives for MATCH-03 with zero new runtime deps.
- parse-time `if`-field compile attached to every RoutingEntry via a side-Map; D-61-02 fail-open everywhere; dispatch consult (Plan 03) is now a single-line insertion against `entry.ifPredicate`.
- Phase 61 closes: `if`-field permission-rule matching ships in full -- AND composition with the group matcher, D-61-02 fail-open on every failure mode, D-61-03 substitute-cwd for path tools, D-61-04 Bash specificity-override + wrapper strip; REQUIREMENTS.md MATCH-03 amended atomically in the first commit.
- Bridge-owned asyncRewake registry: detached=false spawn + ring-buffered stderr/stdout + EXEC-02 timer ladder + captured-epoch zombie defense + exit-code-2 pi.sendMessage injection + PID-table-backed orphan reap on `/reload` — the THIRD and FINAL sanctioned `node:child_process` site in the extension tree, atomically supersedes the 2-element whitelist to 3 in the same commit (D-58-01).
- 1. [Rule 2 -- Missing critical functionality] Composite handler signatures widened beyond the plan's surface
- HookSummaryEntry discriminated union + ClaudeHookEvent literal-union + multi-line `hooks:` renderer arm in shared/notify.ts, foundation for plans 63-02..05.
- writeHookConfig + removeHookConfig at bridges/hooks/stage.ts with LIFE-03 subtree symlink walk + NFR-1 atomic write. Flatter verb pair per RESEARCH Open Question 2 -- the single-file artefact does not justify the mcp bridge's 3-verb prepare/commit/abort shape.
- Closed-set `"orphan rewake"` REASONS token + resolver-side detection + catalog/UAT landing -- atomic per D-58-01.
- Wires the hooks bridge into the install / update / reinstall / cascadeUnstagePlugin cascades between agents and mcp per D-63-01, and connects resolver-side `orphanRewake` to `PluginInstalledMessage.reasons` so `(installed) {orphan rewake}` surfaces through the existing v1.4 NotificationMessage cascade. Closes LIFE-01 and LIFE-02.
- Wire `info <plugin>` to surface a multi-line `hooks:` block by extending `composeResolvedComponents` to re-parse `<pluginRoot>/hooks/hooks.json` and project entries to the `HookSummaryEntry[]` carrier defined in Plan 63-01. Closes SURF-01.
- First-time-reader hook-support doc (docs/hooks.md, 257 lines, 9 sections, 8 supported events, 6 worked examples) plus README ## Hook support section linking to it, plus architecture-lint test pinning jargon prohibition, 8-event coverage, two cross-refs, and worked-example presence.
- Single architecture-lint test pinning SURF-03 / SURF-04 NON-additions + HOOK-04 prior completion via 5 grep-by-readFile invariants — zero source edits, v1.13 milestone close-out ready.
- 1. [Rule 3 - Blocking] ESLint cognitive-complexity ceiling required helper extraction
- Two-arm `parseHooksConfig` unwraps the upstream PLUGIN-format wrapper `{description?, hooks: {...}}` per Claude Code `plugin-dev/skills/hook-development/SKILL.md`, closing the wire-contract bug that flipped every wrapper-shipping plugin (hookify and siblings) to `(unavailable) {unsupported hooks}` before the install cascade could reach the hooks-bridge slot.
- New arm in `narrowResolverReasons` mirrors the four `hooks.json`-prefix families already recognised by `narrowResolverNotes`, closing the cross-surface REASONS asymmetry (SURF-01) so the install cascade and info/list probe surfaces emit the SAME `(unavailable) {unsupported hooks}` token for the SAME on-disk hooks-config failure -- pinned structurally by a new cross-surface parity test.
- Closed the cosmetic UAT gap 3 (Hooks bullet in README `## Features` list) and recorded the binding runtime UAT against the pi-uat sandbox -- the wrapper-format fix (63-09) and cross-surface classifier parity (63-10) land correctly at runtime; the residual `(unavailable) {unsupported hooks}` trip on hookify is the honest v1.13 bucket-A supportability gate (Stop-event admission deferred to v1.14+ per 63-09 Option A), not a defect.

---

## v1.12 Marketplace and Plugin Config Files (Shipped: 2026-06-11)

**Phases completed:** 6 phases, 15 plans, 24 tasks

**Key accomplishments:**

- Declarative per-scope config files: `claude-plugins.json` + entry-level-override `claude-plugins.local.json`, typebox-validated with a discriminated absent/invalid/valid load seam — a 0-byte or corrupt file can never read as "uninstall everything" (CFG-01..03).
- Lossless first-run migration: upgrading installs generate the config from existing state.json with nothing uninstalled; atomic, idempotent, and convergence-proven (MIG-01..02).
- Pure 7-bucket reconcile planner + read-only `/claude:plugin preview` showing exactly what the next load will do, with six new closed-set `will *` tokens landed in atomic catalog lockstep (DIFF-01..02).
- Offline enable/disable: `disable` keeps the config entry + version pin while removing artefacts; `enable` re-materializes from the cached clone with zero network; a new `(disabled)` token renders distinctly from soft-degraded `unavailable` (ENBL-01..04).
- Automatic load-time reconciliation on every Pi startup/`/reload`: per-entry network soft-fail, one structured cascade (never a `/reload` hint), byte-stable fixed point, two-process race safe (RECON-01..06).
- Config write-back on every mutating command with `--local` targeting, batched import/bootstrap patches, SPLIT-01 cast sites fully rewired to merged-config truth, and the CFG-04 README workflow docs (WB-01..04).

**Quality:** 146 commits, 187 files, +40,241/−964 lines; `npm run check` GREEN at close (1804 unit + 10 integration, +289 vs v1.11). 5 review criticals and 30+ warnings found and fixed across phases. Known deferred items at close: 1 (see STATE.md Deferred Items) plus register items in `milestones/v1.12-MILESTONE-AUDIT.md` (zero-component/disabled-marker ambiguity, Nyquist back-fill, CFGV2 backlog).

---

## v1.11 Notification Summary-Line Grammar (Shipped: 2026-06-08)

**Phases completed:** 1 phases, 1 plans, 3 tasks

**Key accomplishments:**

- Every error/warning notification now carries a non-empty summary first line with the detail rendered as its own block, emitted through ONE shared `emitWithSummary` seam so the standalone-vs-cascade divergence that caused the v1.10 glued-label defect cannot recur.

---

## v1.10 Error Attribution & Message-Type Consistency (Shipped: 2026-06-08)

**Phases completed:** 4 phases, 10 plans, 28 tasks

**Key accomplishments:**

- A dedicated `marketplace-not-added` variant + `ContentReason` exclusion + per-status `MarketplaceNotificationMessage` union + a single `isInfoKind`/`assertNever` guard make the v1.10 attribution foot-guns unrepresentable -- with ZERO rendered-byte changes for any v1.0-v1.9 command.
- install/uninstall now converge on info's model: a missing or wrong-scope marketplace renders standalone `(failed) {not added}` on the marketplace subject (not `{not in manifest}` on a plugin row, not silent), backed by a new discriminated cross-scope resolver and truthful cascade-failure reasons.
- Reinstall's marketplace-existence/scope precondition now emits one standalone `(failed) {not added}` consistently across the explicit-scope-plugin, explicit-scope-marketplace, and bare forms (ATTR-03), with a truthful `unreadable` cascade last-resort (ATTR-09) and the `[requestedScope]` cross-scope bracket (SCOPE-01).
- update's missing-marketplace precondition re-attributed to the canonical standalone `(failed) {not added}` for both the `<plugin>@<mp>` and `@<mp>` forms, eliminating the raw `MarketplaceNotFoundError`/`Error` -> `{not found}` misattribution while preserving the cascade never-throw contract -- closing ATTR-02 and the update half of SCOPE-01.
- The D-48-A `MpFailed.reasons?` type+renderer foundation, the typed `InvalidMarketplaceManifestError`, and ATTR-07 `marketplace add` precondition attribution land atomically in one GREEN state -- the marketplace subject can now render its own closed-set reason, and all five `add` precondition failures route through `notify` as `(failed) {<reason>}` rows instead of raw throws.
- autoupdate/noautoupdate (S1+S2) and marketplace remove (S3+S4) of a missing marketplace now converge on the standalone `(failed) {not added}` variant -- no reason-less row, no `{not found}`, no raw `MarketplaceNotFoundError` escaping the orchestrator -- with the StateLockHeldError `{lock held}` path preserved.
- A path-source malformed/schema-invalid `marketplace.json` during `marketplace update` now renders `(failed) {invalid manifest}` -- never the lying `{network unreachable}` -- via the typed `InvalidMarketplaceManifestError` branch in `reasonsFromCascadeError` (recognized before the `?? ["network unreachable"]` default), with zero network on the path-source failure path (NFR-5); the github no-errno catch-all is preserved and the three bare-`(failed)` byte forms are regression-locked. Final phase gate `npm run check` exits 0 (1502 tests).
- `marketplace update <missing-mp>` now converges on the canonical standalone `(failed) {not added}` variant (explicit-scope `⊘ <name> [scope] (failed) {not added}` + bracketless bare form) instead of raw-throwing MarketplaceNotFoundError -- closing the last residual Class-C gap so SC#1 is literally true.
- `narrowProbeError` now maps a schema-invalid `InvalidMarketplaceManifestError` to `{invalid manifest}` on the read-only `marketplace info` / `plugin info` / `list` surfaces -- parity with the `marketplace add` write path -- while preserving `{unparseable}` for malformed JSON, with the new read-surface byte form catalog-documented and fixture-locked.
- A dedicated cross-op byte-identity matrix test that proves every converged op (info / install / uninstall / reinstall / plugin-update / marketplace-remove / autoupdate / the newly-converged marketplace-update) emits the byte-identical `⊘ <name> [scope?] (failed) {not added}` row, plus a catalog-uat inverse-walk orphan gate and the milestone GREEN-gate evidence (npm run check exit 0, 1510 tests).

---

## v1.9 Manifest In-Memory Cache (Shipped: 2026-06-07)

**Phases completed:** 1 phases, 2 plans, 3 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocking] Split CACHE-01 into 2 tests to satisfy the 7-block acceptance criterion
- `createManifestCache(loader)` stat-keyed memoization wired behind the `loadMarketplaceManifest` seam -- by-reference success hits, same-instance negative re-throw, stat-fail fall-through -- turning Plan 45-01's Wave 0 suite GREEN with byte-identical output and zero call-site churn.

---

## v1.8 Plugin and Marketplace Info Commands (Shipped: 2026-06-04)

**Phases completed:** 3 phases, 5 plans, 10 tasks

**Key accomplishments:**

- `/claude:plugin marketplace info` and `/claude:plugin info` show detailed information about a given marketplace or plugin.
- Type-model and render-seam foundations: `MarketplaceInfoMessage` / `PluginInfoMessage` variants, a `wrapDescription` helper, and a new `not added` reason landed in one atomic commit.
- Per-scope rendering end-to-end, tab-completion plumbing, the install-cascade form, plugin description wrap at column 66, a components "not resolved" marker, plus catalog states and UAT entries.

---

## v1.7 Transaction Resilience Hardening (Shipped: 2026-06-02)

**Phases completed:** 5 phases, 5 plans, 9 tasks

**Key accomplishments:**

- Closed TR-02 by restructuring runPhases catch block so the failing phase's own undo runs FIRST (separate call site, via new invokeFailingPhaseUndo helper) BEFORE the reverse-walk over executed[]; PathContainmentError still re-throws (PI-14); failing-phase RollbackPartial prepends to reverse-walk partials (AS-4 newest-first); Phase<C>.undo JSDoc amended in place to document the tolerate-partial-do-throw contract.

---

## v1.6 GitHub Private Marketplace Authentication (0.3.0, Shipped: 2026-06-01)

**Phases completed:** 7 phases, 11 plans, 25 tasks

**Key accomplishments:**

- Device Flow (RFC 8628) authentication for private GitHub marketplaces: on first access Pi shows a one-time code and verification URL via `ctx.ui.notify`; the user authorizes from any browser, and subsequent add/update reuse the stored token silently.
- Credentials stored in the OS keychain via `git credential approve`; no token ever appears in `state.json`, error messages, or UI output. Stale tokens are auto-evicted via `git credential reject` and Device Flow re-triggered on auth failure.
- New `platform/git-credential.ts` (`CredentialOps`) and `domain/github-auth.ts` (Device Flow state machine with an injectable HTTP seam); the `GitOps` interface is threaded through `shared.ts`. No new npm runtime dependencies.

---

## v1.5 Notification Output Polish (0.2.0, Shipped: 2026-05-31)

**Phases completed:** 3 phases, 10 plans, 25 tasks

**Key accomplishments:**

- Benign no-ops (already up-to-date, idempotent autoupdate flips) now render as dim info text instead of yellow `Warning:` output.
- The autoupdate surface uses `<autoupdate>` / `<no autoupdate>` marker tokens; `marketplace update` with no manifest change renders `(skipped) {up-to-date}`.
- Dropped the noise `<last-updated <iso>>` token from `marketplace list` and corrected the github-source autoupdate catalog prose.
- `notify()` now prepends a summary line so the host `Error:`/`Warning:` label introduces the cascade body; the colorless-cascade variant (UXG-03) was deferred-with-finding (the host couples label and color to a single arg).

---

## v1.4.1 Post-ship UAT Patches (0.2.0, Shipped: 2026-05-31)

**Phases completed:** 5 phases, 8 plans, 23 tasks

**Key accomplishments:**

- Reload-hint discipline: the `/reload to pick up changes` hint now fires only when a Pi-visible resource actually changed (no spurious hints on read-only or no-op operations).
- Version display: hash-version plugins render as `v#<7hex>` (git short SHA) instead of `vhash-<12hex>`; a plugin.json-declared version now takes precedence over the content hash.
- Grammar consistency: unsupported-LSP plugin rows render `{lsp}` instead of `{lspServers}`.
- Runtime publish and verification: v0.2.0 source-loads into a Pi runtime via `scripts/pi.sh`; the G-MIL-03 indent gap was refuted by byte evidence, and G-MIL-07 tab-completion was deferred-with-finding (host-side pi-tui `@`-precedence).

---

## v1.4 Structured Notification Messages (0.2.0, Shipped: 2026-05-31)

**Phases completed:** 9 phases, 43 plans, 106 tasks

**Key accomplishments:**

- Replaced V1's ad-hoc per-orchestrator output with a single structured `notify(ctx, pi, message: NotificationMessage)` entry point: every command renders a consistent marketplace-header + indented-plugin-rows format with status tokens, cause-chain trailers, and per-row soft-dependency markers.
- Migrated the marketplace, plugin, and edge-handler orchestrator families off the V1 `notifyError` wrappers across three migration waves, then deleted the V1 composer fan-out and narrowed the lint glob to zero V1 callers.
- Lifted the v2 grammar into `docs/output-catalog.md` as the binding user contract, enforced by a byte-equality catalog-UAT runner; closed-set authority (statuses, reasons, markers) moved to `as const` tuples in `shared/notify.ts`.

---

## v1.3 Consistent Messaging

**Status:** Complete
**Shipped:** 2026-05-25
**Phases:** 5 (12, 13, 14, 14.1, 14.2)
**Plans:** 27
**Timeline:** 2026-05-21 → 2026-05-24 (~3 days)
**Commits:** 223 (37 `feat(`)
**Files changed:** 180 (+15,030 / -1,917)
**Requirements:** 38/38 CMC requirements satisfied
**Tests:** 1249/1249 green

**Delivered:** Every user-visible `ctx.ui.notify` callsite (and the single sanctioned `console.warn`) brought into conformance with `docs/messaging-style-guide.md` v1.0 and the per-command catalog in `docs/output-catalog.md`. The v1.3 user-contract is now structurally enforced by a 34-rule ESLint drift-guard plugin and a byte-equality catalog UAT runner.

**Key accomplishments:**

- **Closed-set grammar primitives** (`STATUS_TOKENS`, `REASONS`, `MARKERS`, `PATTERN_CLASSES`) under `shared/grammar/` with YAML-frontmatter set-equality drift test reading `docs/messaging-style-guide.md` as the binding contract (Phase 12).
- **Wave 1 presentation composers** (`compact-line`, `cascade-summary`, `manual-recovery`, `rollback-partial`, `cause-chain`, `reload-hint`, `sort`) under `presentation/` consumed by every user-visible orchestrator; per-scope rendering, orphan-fold, per-row soft-dep markers via `PluginCascadeRow.declaresAgents/Mcp`, 2-arm severity dispatch (Phase 13).
- **ES-5 atomic supersession** (`c4d87d4`): single commit deletes 5 legacy markers, retires the snapshot byte-equality assertion, rewrites PRD §6.12 ES-5 to a pointer, rolls back temporary ESLint marker-restriction blocks (CMC-35, D-30).
- **Per-command catalog conformance** enforced by `tests/architecture/catalog-uat.test.ts` byte-equality runner against `docs/output-catalog.md`; static audit `no-legacy-markers.test.ts` prevents re-introduction.
- **34-rule ESLint drift-guard plugin** (16 meta-assertion + 18 full-impl) under `tests/lint-rules/` wired into `eslint.config.js` with per-rule scoping; 4-way registry parity test ties style-guide body ↔ rule files ↔ ESLint wiring ↔ plugin module (Phase 14, CMC-38).
- **CMC-13 import-path closure** (Phase 14.1): widened `InstallPluginOutcome.installed` with REQUIRED `declaresAgents`/`declaresMcp` predicates, propagated through import orchestrator and cascade-row build.
- **CR-01 cross-scope ordering fix + MSG-GR-3 active two-axis AST rule** (Phase 14.2): 3 user-first `scopeOrder` helpers deleted, routed through canonical `compareByNameThenScope`; MSG-GR-3 promoted from no-op to active rule; retroactive `/gsd:secure-phase` + `/gsd:validate-phase` for Phases 12 and 14.1.

**Known deferred items at close:** 7 (see STATE.md Deferred Items -- completed quick tasks with stale-format SUMMARY frontmatter; no follow-up work).

---

## Completed Milestones

### v1.0: successor architecture

**Status:** Complete
**Completed:** 2026-05-11

Shipped the PRD-derived successor architecture for `pi-claude-marketplace`: `/claude:plugin` command surface, marketplace lifecycle, plugin `install` / `uninstall` / `update`, top-level `list`, skills/commands/agents/MCP bridges, tab completion, real Pi wiring, live/runtime e2e coverage, and cross-process state locking.

### v1.1: Reinstall Command

**Status:** Complete
**Completed:** 2026-05-14

Added the `reinstall` command (Phases 8-9) replacing installed plugins without leaving them absent if reinstall fails. Syntax and scoping are analogous to `update`; each plugin replacement is atomic; cached manifests and recorded versions are reused with no network sync; plugin data directories are deleted only after successful replacement.

### v1.2: Claude Settings Import

**Status:** Complete
**Completed:** 2026-05-20

Added `/claude:plugin import [--scope user|project]` (Phases 10-11). Claude settings discovery + base/override merge per scope; enabled-plugin extraction; official `claude-plugins-official` built-in mapping plus `extraKnownMarketplaces` directory/GitHub source mapping; idempotent orchestration with unavailable-plugin warning aggregation and reused marketplace/plugin atomic semantics.
