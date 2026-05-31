# Milestones: pi-claude-marketplace

## v1.5 Notification Output Polish (Shipped: 2026-05-31)

**Phases completed:** 17 phases, 61 plans, 116 tasks

**Key accomplishments:**

- SNM-12 amended to `notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void` (per D-16-01) so render-time soft-dep probing has a place to live; SNM-15 refined to gate the reload-hint marketplace branch on state-changing statuses only (per D-16-12) because failed marketplace operations roll back; ADR v2-001 Decision snippet aligned in one atomic docs commit so 16-02's renderer cannot cite a stale source-of-truth.
- 1. [Rule 1 -- Blocking bug] Function-overload pattern required instead of two separate `export function` definitions
- Added a file-private `renderMpHeader(mp: MarketplaceNotificationMessage): string` helper to `shared/notify.ts`, switching over `"added" | "removed" | "updated" | "failed" | undefined` with explicit `mp.details === undefined` runtime guard and `assertNever(mp.status)` exhaustiveness default.
- Added a file-private `renderPluginRow(p: PluginNotificationMessage, probe: SoftDepStatus): string` helper to `shared/notify.ts`, switching over the full 10-variant PluginNotificationMessage discriminated union with `default: return assertNever(p);` for compile-time exhaustiveness (D-16-10), per-row soft-dep marker injection from `dependencies?` + threaded SoftDepStatus probe (D-16-15), and a SOLE-site renderScopeBracket helper preventing the `[undefined]` hazard on optional-`scope?` variants (BLOCKER-1 fix).
- Wired the file-private renderMpHeader (plan 03) + renderPluginRow (plan 04) into the public `notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void` V2 entry point -- the sole public surface for state-change notifications (SNM-12 / D-16-01). softDepStatus(pi) is called once per invocation (D-16-14); per-plugin cause-chain trailers + rollbackPartial child rows render at the documented 2/4/6-space indent shape (D-16-04 / D-16-08); multi-marketplace blocks join with one blank line (D-16-07); the reload-hint trailer appends per the D-16-12 trigger ladder (D-16-13); severity dispatches via the D-16-11 first-match ladder using the V1-established magic-string second-arg convention.
- Created `tests/shared/notify-v2.test.ts` (1141 lines, 32 passing tests) as the per-status unit suite for the V2 `notify(ctx, pi, message)` and `notifyUsageError(ctx, message)` entry points landed by Phase 16 plans 02-05. The test file carries the de facto v2 grammar mini-spec in its header per D-16-04 authority resolution; this file IS the binding correctness gate for Phase 16's v2 grammar until Phase 17 lifts the spec into `docs/output-catalog.md` (SNM-19 / SNM-20 / SNM-31).
- v2.0 thin pointer style guide (150 lines, no YAML frontmatter) replaces v1.0's 954-line enumeration spec; closed-set authority moves from frontmatter keys to `as const` tuples in `shared/notify.ts`. Dead frontmatter parity test deleted atomically with the YAML removal. SNM-26 advanced Phase 21 -> Phase 17 / Complete as a forced consequence.
- v2.0 always-marketplace-header user-contract catalog (928 lines, 50 catalog-state markers across 14 per-command H2 sections + Manual recovery + Empty + Usage) replaces v1.0's 971-line single-plugin-carve-out shape; every fenced expected-output block is now byte-equal to what `notify(ctx, pi, message)` emits given a corresponding structured fixture. The plan deliberately leaves `tests/architecture/catalog-uat.test.ts` in a known-RED state per Pitfall 2 -- Plan 17-03 restores `npm run check` GREEN by rewriting the UAT to drive `notify()` against per-(section, state) `NotificationMessage` fixtures.
- Catalog UAT (`tests/architecture/catalog-uat.test.ts`) rewritten from V1 composer fan-out (renderRow / cascadeSummary / renderManualRecovery / renderRollbackPartial / renderPluginList / renderMarketplaceList / appendReloadHint) to a single `notify(ctx, pi, message)` invocation per fixture. 48 CatalogFixture entries populate the (section, state) keyed FIXTURES map; driver loop asserts byte-equality between notify()'s output and the v2.0 catalog AND the magic-string severity arg shape per fixture. `npm run check` returns to GREEN, closing the deliberate Plan 17-02 RED window per Pitfall 2; the SNM-31 user-contract gate is now structurally enforced.
- `extensions/pi-claude-marketplace/shared/notify.ts`
- `extensions/pi-claude-marketplace/shared/notify.ts`
- `docs/output-catalog.md`
- `docs/adr/v2-001-structured-notify.md`
- `renderScopeBracket` now takes both the plugin scope and the parent marketplace scope and emits the inline `[<scope>]` bracket only in the documented orphan-fold case, with `mp.scope` threaded through the renderer chain and three sibling 17.1-review warnings (WR-01/WR-03/WR-06) folded into the same notify.ts hygiene sweep.
- The `project-orphan-folded` catalog state's byte form on `docs/output-catalog.md:191` now drops the `[user]` token to match the post-Plan-01 renderer, the matching `tests/architecture/catalog-uat.test.ts` fixture is cleaned of its workaround comment, and the WR-05 dead-helper hack is gone -- catalog UAT byte-equality is GREEN.
- Three new boundary-case unit tests lock the three previously-thin or uncovered branches of `hasLoadedPiSubagents` / `hasLoadedPiMcpAdapter` so silent drift in Pi's tool shape is caught by CI; platform source `pi-api.ts` is unchanged.
- `npm run check` exits 0 against the post-Wave-1+2 worktree -- typecheck + ESLint + Prettier + 1360 tests all pass; all six 17.1 review warnings (WR-01..WR-06) and CR-01 are closed with grep-able verification evidence; production source delta across the phase is confined to `extensions/pi-claude-marketplace/shared/notify.ts`; Phase 17.2 is ready for verification + close-out.
- 1. [Rule 3 - Blocking] Extended plumbing past the plan's stated 8-file scope
- 1. [Rule 3 - Blocking] Updated 3 transitive byte assertions in bootstrap tests
- 1. [Rule 3 - Blocking] Updated 5 transitive byte assertions in bootstrap tests
- V2 list-surface notification: single `notify(opts.ctx, opts.pi, { marketplaces: [...] })` call constructing `mp.status === undefined` payloads with conditional `details: MarketplaceDetails`, surfacing the previously-dropped `<last-updated <iso>>` marker.
- 6-callsite V1 -> V2 notify() migration of `marketplace/update.ts`; retry-hint DROP (D-18-02); per-plugin cause-chain restructure (D-18-03); glyph flip on cascade skipped rows (Risks #5)
- Additive `ignores` exempts `orchestrators/marketplace/
- 1. [Rule 3 - Blocking] Import order corrected by ESLint
- 1. [Rule 3 - Blocking] ESLint MSG-CC-1 lint rule on hand-composed cause-chain literal
- 1. [Rule 3 - Blocking] SonarJS cognitive-complexity 17 > 15 in `reinstallPlugin`
- Extended MSG-Block 1 + 1b `ignores: [...]` arrays in `eslint.config.js` with the plugin-orchestrator-family path string per D-19-08, then verified all 4 Phase 19 Success Criteria GREEN end-to-end as the Wave 3 phase gate.
- DROP 2 V1 notifyError catch-all wrappers in edge/handlers/plugin/{bootstrap,import}.ts + 1 catch-all test deletion; closes SNM-23 architecture goal for the edge family with zero V1 notifyError wrapper callsites remaining.
- Append `"extensions/pi-claude-marketplace/orchestrators/import/
- `2ae0aab`
- `560d959`
- COMPLETE -- v1.4 Structured Notification Messages milestone CLOSED.
- Collapsed `shouldEmitReloadHint` to a purely plugin-row-driven rule so empty `marketplace add`/`remove`, no-op `update`, and autoupdate fresh-flips stop emitting the `/reload` trailer; clean remove now carries `(uninstalled)` rows so true state changes still fire it (closes SNM-33 / G-MIL-01 / G-MIL-02 / G-MIL-06).
- `resolvePluginVersion` reordered to a 3-tier precedence (plugin.json `version` -> marketplace `entry.version` -> PI-7 hash) via an in-place plugin.json re-read, so a plugin declaring its own version now surfaces that version instead of an opaque content hash.
- Renamed the lone camelCase REASONS member `lspServers` -> `lsp` so unsupported-LSP plugin rows render `{lsp}` instead of `{lspServers}`, propagated through two detection-vs-emission seams via a typed `MANIFEST_FIELD_TO_REASON` map, with catalog/fixture/doc byte forms and spec wording amended in lockstep. SC#4 manifest surface untouched.
- SNM-37 gate satisfied: v0.2.0 source-loads into a Pi runtime via `scripts/pi.sh` (sandbox home, no npm publish/link), and a new `tests/shared/` behavioral smoke proves v1.4 identity at the pre-tui notify boundary (no `/reload` trailer, `v#<7hex>`, `{lsp}` not `{lspServers}`).
- G-MIL-03 indent ladder refuted by binding pre-tui byte evidence: the renderer emits the catalog-conformant 0/2/4 ladder at `ctx.ui.notify`; the observed 1/3 visual is a markdown/tui display-layer artifact, now locked by an explicit leading-whitespace test and recorded as a catalog clarification.
- G-MIL-07 (`/claude:plugin update @<TAB>` surfaces nothing) is DEFER-WITH-FINDING: our completion provider is correct (TC-6 GREEN, `update @` -> `["@mp-a","@mp-b"]`); the gap is host-side `@`-precedence in the GLOBAL `@earendil-works/pi-tui` 0.76.0 that `scripts/pi.sh` execs, confirmed by a LIVE keystroke trigger that surfaced file paths instead of marketplace candidates -- pi-tui-external, so it is deferred with line-level evidence rather than worked around in our code (D-25-10).
- v1.4.1 (Post-ship UAT Patches) milestone closed: `npm run check` GREEN end-to-end on a clean tree (1137/1137, exit 0), SNM-33/34/35/36 regression tests located + re-confirmed GREEN, CHANGELOG folded to one unreleased `[0.2.0]`, and SNM-23 + SNM-40 traceability rows reconciled -- milestone ready for `/gsd-complete-milestone`.
- Corrected the false "github `marketplace add` defaults autoupdate ON" catalog claim and renamed the autoupdate command heading to the real `autoupdate|noautoupdate` verbs, with the catalog-uat FIXTURES key synced byte-for-byte to keep byte-equality GREEN.
- `marketplace list` headers stop rendering the `<last-updated <iso>>` token (UXG-01); `MarketplaceDetails.lastUpdatedAt?` stays in the type + state, only the renderer emission is removed -- landed across renderer + catalog + 3 byte surfaces in one atomic commit.
- The `marketplace autoupdate` / `noautoupdate` flip surface now renders `<autoupdate>` / `<no autoupdate>` marker tokens (with `{already autoupdate}` / `{already no autoupdate}` idempotence braces) instead of `(autoupdate enabled)` / `(autoupdate disabled)` / `(skipped) {already …}` status tokens, achieving byte-form parity with the `marketplace list` surface while keeping `MARKETPLACE_STATUSES` and `MARKERS` closed sets intact (Strategy B).
- 1. [Rule 3 - Blocking] Pre-existing github-source test (MU-4) flipped to the no-op form
- 1. [Rule 3 - Blocking] MU-5 test setup incompatible with the WR-02 narrowing
- `computeSeverity` rewritten as a 5-arm first-match ladder with a `BENIGN_REASONS` closed set, so a cascade whose only non-success rows are benign idempotent no-op skips (`{up-to-date}` / `{already …}`) computes `info` instead of `warning` -- a pure severity-arg change, every rendered byte string unchanged.
- Task 1 -- Spike evidence lock
- `notify()` now prepends a human-readable summary line ("N plugin operation(s) [and M marketplace operation(s)] failed/skipped.") before the cascade body for error/warning severity, giving the host `Error:`/`Warning:` prefix a meaningful sentence to introduce; info severity is byte-identical.
- Updated all 16 `error`/`warning` byte blocks in `docs/output-catalog.md` to prepend the Phase 29 summary line so each fenced block is byte-equal to `notify()`'s post-Plan-29-01 output, kept the catalog-UAT byte-equality gate green, and documented the summary-line composition in the messaging style guide and the structured-notify ADR.
- `preflightUpdate` now consults the marketplace manifest before the not-installed guard, so `update <nonexistent>@<mp>` renders `(failed) {not in manifest}` (matching `install`) instead of the misleading `(skipped) {not installed}`.

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
