# Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning. Phase 17.1 (V2 Grammar Amendment: Autoupdate Surface) landed 2026-05-26; the dependency recorded in D-18-04 is satisfied. Phase 17.2 (renderScopeBracket orphan-fold contract fix) also landed 2026-05-26.

<domain>
## Phase Boundary

Migrate every state-change notification callsite in the 5 marketplace orchestrators (`orchestrators/marketplace/{add,autoupdate,list,remove,update}.ts`) from the V1 severity-named wrappers (`notifySuccess` / `notifyWarning` / `notifyError`) to the V2 structured entrypoint `notify(ctx, pi, NotificationMessage)`. Narrow the MSG-* drift-guard lint to exclude the now-migrated marketplace family. Prove correctness through the catalog UAT byte-equality gate (fixtures already shipped in Phase 17) and through per-file orchestrator unit tests that assert V2 byte shape end-to-end through real `notify()`.

**In scope (this phase):**

1. Migrate `orchestrators/marketplace/add.ts` (2 V1 callsites; pilot for the locked construction pattern).
2. Migrate `orchestrators/marketplace/autoupdate.ts` (4 V1 callsites) using the new dedicated MarketplaceStatus values landed by Phase 17.1.
3. Migrate `orchestrators/marketplace/list.ts` (1 V1 callsite).
4. Migrate `orchestrators/marketplace/remove.ts` (4 V1 callsites; the post-state cleanup-leak `notifyWarning` is DROPPED per D-18-01).
5. Migrate `orchestrators/marketplace/update.ts` (5 V1 callsites; the marketplace-level retry-hint suffix is DROPPED per D-18-02).
6. Update each orchestrator's unit tests in lockstep with its migration (byte-exact V2 assertions per D-18-06).
7. Drop now-orphaned `presentation/*` composer imports from each migrated orchestrator (each per-file plan owns its own cleanup).
8. Narrow MSG-Block 1 (`msg-sr-1..6`) and MSG-Block 1b (`msg-gr-3`) in `eslint.config.js` to exclude `orchestrators/marketplace/**` (additive ignores per D-18-07).
9. Verify catalog UAT (`tests/architecture/catalog-uat.test.ts`) byte-equality stays GREEN for every marketplace-family `(section, state)` fixture.
10. Verify `npm run check` GREEN; no orchestrators outside the marketplace family have changed call-site shape.

**Out of scope (not Phase 18):**

- **V1 grammar/type amendments to support the new autoupdate surface** -- delivered by Phase 17.1 (V2 Grammar Amendment: Autoupdate Surface), completed 2026-05-26. Phase 18 inherits the landed grammar; no further amendments in this phase. See D-18-04 below.
- **Migrating `orchestrators/plugin/**`** -- Phase 19 (Migration Wave 2 -- Plugin Orchestrator Family).
- **Migrating `edge/handlers/**` + V1 `notifyUsageError` 3-arg signature** -- Phase 20 (Migration Wave 3 -- Edge + UsageError).
- **Deleting V1 wrappers (`notifySuccess` / `notifyWarning` / `notifyError` / V1 `notifyUsageError`)** -- Phase 21 (SNM-22).
- **Deleting the 34-rule MSG-* lint plugin under `tests/lint-rules/`** -- Phase 21 (SNM-24, SNM-25, SNM-27).
- **Removing the bounded `shared/notify.ts` ignores added by Phase 16 to MSG-Block 4a + 5** -- Phase 21 alongside V1 wrapper deletion.
- **Deleting V1 `presentation/*` composers** -- Phase 21 (alongside SNM-22 wrapper deletion). All composers stay imported by V1 wrappers and by non-marketplace orchestrator families until then.
- **Touching `tests/presentation/marketplace-list.test.ts`** or other presentation/* unit tests -- Phase 21 deletes them with the composers they cover. Phase 18 leaves them alone (the composer module is still imported by the V1 wrappers' transitive call graph during the migration window).
- **Restoring the V1 free-text retry-anchor sentence on `marketplace remove` partial** -- already dropped from the v2 catalog by D-17-09 (Phase 17). Phase 18 inherits the drop.
- **Restoring the V1 install-failure-with-anchor surface** -- already dropped by D-17-10 (Phase 17).

</domain>

<decisions>
## Implementation Decisions

### Plan granularity & ordering

- **D-18-08:** Phase 18 ships **6 plans** -- 5 per-file migration plans + 1 lint/cleanup plan. Plans 18-01..05 each migrate exactly one orchestrator file (add / autoupdate / list / remove / update) + the file's unit tests + drop that file's now-orphaned `presentation/*` composer imports. Plan 18-06 narrows MSG-Block 1 + 1b in `eslint.config.js` and confirms catalog UAT GREEN end-to-end. Plan-per-file scoping keeps each commit atomic (one orchestrator + its tests) and matches Phase 16's small-plan precedent (6 plans across 6 waves).
  - **Amendment 2026-05-26 (post-research, user-locked):** Phase 18 now ships **7 plans** -- adds **Plan 18-00 (Wave 0 pre-cleanup):** pre-thread `pi: ExtensionAPI` through every marketplace orchestrator's `*Options` interface (`add.ts`, `autoupdate.ts`, `list.ts` -- `remove.ts` and `update.ts` already accept `pi`), through each `edge/handlers/marketplace/<file>.ts` handler factory signature, and through the wiring in `extensions/pi-claude-marketplace/edge/register.ts` (lines 50, 84, 88-89). Plan 18-00 lands in one atomic commit BEFORE Plan 18-01. Plans 18-01..05 then ONLY swap V1 wrappers for V2 `notify(ctx, pi, message)` calls + update tests + drop `presentation/*` imports (no plumbing churn). Rationale: research found 3 of 5 orchestrators don't currently receive `pi`; threading it inline per-plan would force every Wave-2 plan to touch shared `register.ts` and bundle plumbing-with-migration. The Wave 0 split matches Phase 16's land-infrastructure-first precedent and decouples plumbing churn from migration churn so each migration plan stays surgical.
- **D-18-09:** Wave structure is **3 waves**: Wave 1 = 18-01 (`add.ts`) pilot only; Wave 2 = 18-02..05 (`autoupdate.ts`, `list.ts`, `remove.ts`, `update.ts`) in parallel; Wave 3 = 18-06 (lint narrowing + final catalog UAT verification). The pilot-first arrangement locks the V2 NotificationMessage construction pattern on the simplest case before parallelizing across 4 agents. `add.ts` is the right pilot because it has the smallest callsite count (2), no cascade or rollback semantics, and its primary success path maps cleanly to a single-`MarketplaceNotificationMessage`-with-empty-`plugins[]` payload. Wave-2 plans inherit the locked pattern by reading the merged add.ts diff. Wave 3 cannot start until ALL of Wave 2 lands -- the lint narrowing assumes every marketplace orchestrator has stopped calling V1 wrappers.
  - **Amendment 2026-05-26 (post-research, user-locked):** Wave structure is now **4 waves**: Wave 0 = 18-00 (`pi` plumbing pre-cleanup) -- must land first; Wave 1 = 18-01 (`add.ts` V1->V2 pilot) -- depends on 18-00; Wave 2 = 18-02..05 (`autoupdate.ts`, `list.ts`, `remove.ts`, `update.ts`) in parallel -- depends on 18-01; Wave 3 = 18-06 (lint narrowing + final catalog UAT verification) -- depends on Wave 2 completion. Wave 0 is a single-plan wave that materially shrinks each downstream migration plan and removes the only shared-file (`register.ts`) hotspot from Wave 2 parallelism. Plans referencing the original 3-wave numbering MUST be read against the 4-wave numbering above. Plan 18-05 (`update.ts`) plan must additionally account for the **6 V1 callsites** (CONTEXT-canonical-refs line 126 says 5; research verified actual is 6 -- line 220 in `updateAllMarketplaces` empty-targets case is the missed one).

### V1 surfaces that don't map cleanly to V2

- **D-18-01:** `orchestrators/marketplace/remove.ts` emits a SECOND `notifyWarning` after the primary `notifySuccess` when post-state cleanup leaks (e.g., the agent-index write fails, the skills/prompts staging directory cleanup fails). The V2 `MarketplaceNotificationMessage` type has no field that represents "cleanup leak after successful state mutation"; folding it into `status: "failed"` would misrepresent the operation (state mutation DID succeed); emitting a second `notify()` call doubles severity routing and has no catalog fixture to gate against. **Decision: DROP the cleanup-leak warning entirely.** Precedent: D-17-09 already drops the V1 free-text retry-anchor trailer from the v2 catalog on the same "no V2 representation" basis. Cleanup failures still flow through the underlying domain layer (return value or internal log); the user just doesn't see a separate user-facing warning. Lowest test churn, cleanest V2 catalog conformance, no double-notification ambiguity.
- **D-18-02:** `orchestrators/marketplace/update.ts` calls `notifyError(ctx, \`${errorMessage(err)}\n${err.retryHint}\`, err.cause)` for marketplace-level failures (clone unreachable, manifest validation error). The retry-hint is an inline second line on the error message. V2 catalog `docs/output-catalog.md:836` explicitly says marketplace-level cause-chain trailers are NOT emitted by `notify()` -- mp failures render as the bare header alone (`⊘ official [user] (failed)`). **Decision: DROP the retry-hint from the user-visible surface.** The orchestrator builds `MarketplaceNotificationMessage { status: "failed", plugins: [] }` and `notify()` renders the bare failed header (severity=error). The `retryHint` field remains internal to the Error subclass for programmatic inspection; no fabricated synthetic plugin row, no cause-chain composition. Precedent: D-17-09 + D-18-01.
- **D-18-03:** `orchestrators/marketplace/remove.ts` cascade-summary cause-chain composition (remove.ts:344-354 inline `causeChainTrailer(err)` baked into a `notifyWarning` body) is REPLACED by the V2 partial-state shape (catalog `<!-- catalog-state: partial -->` at docs/output-catalog.md:775-786): `MarketplaceNotificationMessage { status: "failed", plugins: [PluginUninstalledMessage | PluginFailedMessage { cause?: Error }] }`. Plugin-level cause-chains render at 4-space indent under each failed plugin row per D-16-08. No `notifyWarning` direct call -- severity is computed by `notify()` (any failed → error per D-16-11; per-plugin uninstalled in the same payload still drives the reload-hint trailer per D-16-12).
- **D-18-04:** `orchestrators/marketplace/autoupdate.ts` could not migrate until Phase 17.1 (V2 Grammar Amendment: Autoupdate Surface) landed. Phase 17.1 was inserted into the v1.4 roadmap and completed 2026-05-26: Phase 15 type model amended (added `"autoupdate enabled"` | `"autoupdate disabled"` | `"skipped"` to `MarketplaceStatus`, taking it from 4 to 7 entries; added optional `reasons?: readonly Reason[]` to `MarketplaceNotificationMessage`; added `"already enabled"` and `"already disabled"` to `REASONS` in `shared/grammar/reasons.ts`); Phase 16 renderer amended (3 new arms added to `renderMpHeader` switch; `computeSeverity` ladder routes `"skipped"` to warning consistent with plugin `"skipped"`; `shouldEmitReloadHint` fires on fresh `autoupdate enabled` / `autoupdate disabled` and NOT on `skipped`); Phase 17 catalog rewritten (`marketplace autoupdate` section now has 5 catalog states: `enable-fresh`, `disable-fresh`, `enable-idempotent`, `disable-idempotent`, `failure-not-found`; catalog-uat fixtures updated); ADR amended (`docs/adr/v2-001-structured-notify.md` Decision section reflects the 7-entry MarketplaceStatus closed set; new `## Amendment: Phase 17.1` section appended). Phase 18's plan 18-02 now constructs `MarketplaceNotificationMessage` payloads with the new statuses + reasons against the landed grammar.
- **D-18-05:** User-locked design for marketplace autoupdate enable/disable surface (LOCKED HERE; Phase 17.1 amends the type model / renderer / catalog to support it):

| Operation | `mp.status` | `mp.reasons` | Renderer output |
|---|---|---|---|
| `enable foo`, fresh flip | `"autoupdate enabled"` | none | `● foo [user] (autoupdate enabled)` |
| `disable foo`, fresh flip | `"autoupdate disabled"` | none | `● foo [user] (autoupdate disabled)` |
| `enable foo`, already enabled | `"skipped"` | `["already enabled"]` | `● foo [user] (skipped) {already enabled}` |
| `disable foo`, already disabled | `"skipped"` | `["already disabled"]` | `● foo [user] (skipped) {already disabled}` |
| `enable missing-mp` | `"failed"` (existing) | none | `⊘ missing-mp [user] (failed)` |

  Severity ladder: `failed → error`; `skipped → warning` (consistent with plugin `skipped` per D-16-11); `autoupdate enabled / autoupdate disabled → info (no severity arg)`. Reload-hint ladder: fresh enable/disable triggers the trailer (the marketplace persistence record was mutated, state was touched); `skipped` does NOT trigger (no state change). `marketplace list` keeps its existing `<autoupdate>` / absent-marker on the list-surface header arm (unchanged).

### Existing orchestrator-test migration

- **D-18-06:** Each per-file plan (18-01..05) updates the matching `tests/orchestrators/marketplace/<file>.test.ts` IN LOCKSTEP with the orchestrator migration. Tests stay END-TO-END through real `notify()` via mock `ctx` -- the existing `makeCtx()` pattern that records `{ message, severity }` tuples is preserved verbatim. Byte-exact `assert.equal(note.message, "<V2 byte string>")` assertions are rewritten from V1 strings to V2 strings derived from the V2 catalog's expected shapes (and from `tests/shared/notify-v2.test.ts` per-variant fixtures where the orchestrator's edge-case shape isn't in the catalog). Belt-and-braces coverage with catalog UAT: orchestrator tests catch construction-bugs WITH a byte gate; catalog UAT catches renderer-bugs. Behavior assertions stay (notification count, severity tier, state mutations via `loadState`, error types thrown, reload-hint presence/absence via `.includes(...)`). Tests are not factored to a shared notify-fixture module; existing per-orchestrator structure is preserved to minimize diff.
- **Implicit consequence (no separate D):** For `add.ts` specifically, V2 byte output for github-source success is `● <mp> [<scope>] (added)\n\n/reload to pick up changes` -- different from V1's `● <mp> [<scope>] <autoupdate> (added)` (no reload-hint, no `(added)` token because V1 added.ts didn't emit one). The `<autoupdate>` marker MOVES from the add-success arm to the list-surface header (per V2 catalog `<!-- catalog-state: github-source -->` at docs/output-catalog.md:728-734). Per D-18-06 the test assertion flips from `note.message.includes("/reload to pick up changes") === false` to `=== true`. This is a deliberate user-visible behavior change driven by D-16-12 reload-hint computation rules; the user accepts it as the V2 grammar's contract.
- **Implicit consequence:** `presentation/marketplace-list.test.ts` and other `tests/presentation/*.test.ts` STAY untouched in Phase 18 even where the underlying composer is no longer imported by marketplace orchestrators -- the composers remain imported by V1 wrappers (still alive until Phase 21) and by `orchestrators/plugin/**` (Phase 19) and `edge/handlers/**` (Phase 20). Phase 21 deletes both the composers and their tests together.

### MSG-* lint glob narrowing strategy

- **D-18-07:** Plan 18-06 narrows ONLY MSG-Block 1 (`msg-sr-1..6` severity routing) and MSG-Block 1b (`msg-gr-3` per-scope rendering) in `eslint.config.js`. Both keep their existing `files:` globs unchanged and ADD an `ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]` entry. MSG-Block 1b's existing `edge/handlers/**` scope is unchanged (Phase 20 owns that surface). All other MSG-Blocks (2, 3, 4a, 4b, 5, 6) need NO modification in Phase 18 -- Block 2 is edge-only; Blocks 3/4a/4b/5/6 are global with composer-specific ignores and detect raw string literals at any callsite, but migrated orchestrators construct `NotificationMessage` payloads structurally with no raw token/marker/trailer literals (notify() owns ALL render-time string composition per D-16-04 + SNM-17). Phase 19 extends the same ignores entry with `orchestrators/plugin/**`; Phase 20 extends with `orchestrators/edge/**` AND removes Block 1b's `edge/handlers/**` glob entry; Phase 21 deletes the entire MSG-* plugin wiring. Additive narrowing keeps each phase's lint diff small and reviewable.

### Claude's Discretion

The planner has flexibility on:

- Exact ordering of file mutations within each per-file plan (e.g., update the orchestrator first or the test file first -- both are atomic within a single plan commit).
- Whether `orchestrators/marketplace/shared.ts` stale comment cleanup (references to `notifyError` patterns from V1 days) happens inside the per-file plan that last touches `shared.ts`, inside plan 18-06, or is deferred to Phase 21. `shared.ts` does NOT call notify wrappers itself; only its comment block references them.
- Whether the pilot 18-01 (`add.ts`) adds a NotificationMessage construction comment / mini-recipe in the orchestrator source that Wave 2 plans literally follow, or whether the locked pattern is allowed to emerge from the diff alone. Either preserves the pilot-first discipline.
- Whether to extract a tiny shared helper for the common `pi: { getAllTools: () => [] }` mock-pi shape used by every orchestrator test, or accept the existing inline definition per-file. Either satisfies the test pattern.
- Specific severity-tier assertion form: `assert.equal(note.severity, undefined)` (status quo) vs. helper like `assertSeverity(note, "info")`. Either is acceptable.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth design

- `.planning/ROADMAP.md` §"Phase 18: Migration Wave 1 -- Marketplace Orchestrator Family" -- Goal + 4 success criteria. SC #2 (MSG-* lint narrowing) is satisfied by D-18-07; SC #3 (catalog UAT GREEN for marketplace family) is satisfied by Phase 17 fixtures + D-18-06 test discipline; SC #1 (zero V1 callers in marketplace/**) is the migration result; SC #4 (`npm run check` GREEN, other families unchanged) is the gate plan 18-06 verifies.
- `.planning/REQUIREMENTS.md` §"Migration & Deletion" SNM-22 -- "All notifySuccess/Warning/Error call sites across orchestrators (~20 sites) migrated... V1 severity-named wrappers are deleted from shared/notify.ts." Phase 18 satisfies the "marketplace family migrated" partial (Phase 19 plugin, Phase 20 edge); Phase 21 closes the requirement when V1 wrappers are deleted. Phase 18 closes ZERO requirements directly -- it's a pure execution phase contributing to SNM-22 closure.
- `docs/output-catalog.md` -- Phase 17 v2.0 catalog. BINDING USER CONTRACT for every marketplace-family command surface. Sections to honor: `## /claude:plugin marketplace list` (lines 686-716), `## /claude:plugin marketplace add <source>` (lines 718-758), `## /claude:plugin marketplace remove <name>` (lines 760-793), `## /claude:plugin marketplace update <name>` (lines 795-836), `## /claude:plugin marketplace autoupdate <enable|disable> <name>` (lines 838-895). NOTE: the autoupdate section is REWRITTEN by Phase 17.1 before Phase 18's plan 18-02 lands.
- `docs/messaging-style-guide.md` -- Phase 17 v2.0 pointer doc. Cross-reference for renderer-as-spec discipline; types are the contract.
- `docs/adr/v2-001-structured-notify.md` -- Accepted (Phase 15 D-15-13). Phase 17.1 amends the Decision section to reflect the corrected MarketplaceStatus set.

### V2 renderer & types (binding contract)

- `extensions/pi-claude-marketplace/shared/notify.ts` -- The v2 grammar IS this file's renderer behavior. `notify(ctx, pi, message)` at line 1034 is the binding entry point. `renderMpHeader` at line 529 owns the marketplace header switch with `assertNever` exhaustiveness (Phase 17.1 amends this switch). `renderPluginRow` (file-private) owns the plugin row switch. `composeMarketplaceBlock` joins header + plugin rows. `softDepStatus(pi)` probes at notify-time per `notify()` invocation (single probe, D-16-14). NOT modified directly by Phase 18 -- Phase 17.1 owns the renderer amendments.
- `tests/shared/notify-v2.test.ts` -- Phase 16's per-variant unit tests (1141 lines, 32 tests). Authoritative source of v2 expected output strings per (plugin status × marketplace status × edge case). Phase 18 orchestrator tests cross-reference these fixtures when an edge-case byte shape isn't covered by the catalog.
- `tests/architecture/catalog-uat.test.ts` -- Phase 17 byte-equality runner. Drives every `(section, state)` catalog fixture through `notify(mockCtx, mockPi, message)` and asserts byte-equality against the catalog block. Phase 18's plan 18-06 verifies this stays GREEN end-to-end after every marketplace orchestrator has migrated. Fixture map keys for marketplace family at lines 1085-1259.

### Phase 17.1 amendment lineage (landed -- contract 18-02 relies on)

- `.planning/phases/17.1-v2-grammar-amendment-autoupdate-surface/` -- Completed 2026-05-26 (4 plans landed: type model, renderer, catalog, ADR). The 7-entry `MarketplaceStatus`, optional `reasons?:` field, new `renderMpHeader` arms, severity ladder, reload-hint trigger ladder, and 5-state autoupdate catalog block are the binding contract Plan 18-02 (autoupdate.ts migration) constructs payloads against. Read 17.1's `17.1-CONTEXT.md` (D-17.1-01..D-17.1-08) and the four `17.1-0N-SUMMARY.md` files for what each amendment shipped.
- `.planning/phases/17.2-renderscope-bracket-orphan-fold-contract-fix/` -- Completed 2026-05-26. Fixed `renderScopeBracket(pluginScope, mpScope)` to honor the orphan-fold contract; threaded `mp.scope` through `composePluginLines`/`renderPluginRow`; updated all 10 call sites. Phase 18 orchestrator tests must construct payloads that round-trip through the orphan-folded renderer (plugin-scope bracket suppressed when `p.scope === mp.scope`).

### Phase 16 lineage (controlling renderer decisions)

- `.planning/phases/16-renderer-public-api-alongside-v1/16-CONTEXT.md` -- Decisions D-16-01..D-16-18. D-16-04 (renderer-as-spec); D-16-06 (caller-order honored); D-16-07 (one blank line between mp blocks); D-16-08 (4-space indent for cause-chain under plugin row); D-16-09 (renderMpHeader / renderPluginRow file-private switches own all grammar); D-16-11 (severity ladder); D-16-12 (reload-hint trigger ladder + state-changing-marketplace refinement); D-16-13 (reload-hint joined with one blank line); D-16-14 (single softDepStatus probe per notify call); D-16-15 (soft-dep markers at render time); D-16-17 (`(no marketplaces)` empty sentinel).
- `.planning/phases/15-type-model-adr-refresh/15-CONTEXT.md` -- Decisions D-15-01..D-15-16. D-15-04 (version vs from/to placement on plugin variants); D-15-06 (mp.status?/mp.details? independent optionals); D-15-07 (MarketplaceStatus 4 entries pre-amendment); D-15-08/09 (empty arrays IS the structural empty sentinel); D-15-10/12 (compile-time closed-set membership lock).

### Phase 17 lineage (catalog contract)

- `.planning/phases/17-spec-rewrite-catalog-uat-migration/17-CONTEXT.md` -- Decisions D-17-01..D-17-10. D-17-03 (pure exclusion: catalog UAT drives notify() only); D-17-09 (V1 free-text retry-anchor dropped -- precedent for D-18-01 + D-18-02); D-17-10 (V1 install-failure-with-anchor dropped).

### Source files Phase 18 modifies

- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` -- 2 V1 callsites (`notifySuccess` at line 160; `notifyWarning` at line 141). Plan 18-01 (Wave 1 pilot).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` -- 4 V1 callsites (`notifyError` at 141, 155; `notifySuccess` at 163, 184). Plan 18-02 (Wave 2). DEPENDS on Phase 17.1.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts` -- 1 V1 callsite (`notifySuccess` at line 67). Plan 18-03 (Wave 2). The list-surface uses `MarketplaceNotificationMessage { status: undefined, details: MarketplaceDetails }` -- the only command surface in the marketplace family that uses the list-surface arm of `renderMpHeader`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` -- 4 V1 callsites (`notifySuccess` at 422; `notifyWarning` at 299, 354, 407). Plan 18-04 (Wave 2). D-18-01 drops the cleanup-leak warning; D-18-03 restructures the cascade-summary cause-chain into per-plugin payload rows.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts` -- 5 V1 callsites (`notifySuccess` at 220, 631; `notifyWarning` at 599, 647 (via dispatch ternary); `notifyError` at 584 (2-arm `\\n${err.retryHint}` form), 586). Plan 18-05 (Wave 2). D-18-02 drops the retry-hint suffix; D-18-03 restructures the cascade-summary cause-chains.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` -- Comments only (lines 481-484). Planner discretion on when to clean.
- `tests/orchestrators/marketplace/add.test.ts` -- Byte-exact assertions rewritten to V2 shape. Plan 18-01.
- `tests/orchestrators/marketplace/autoupdate.test.ts` -- Byte-exact assertions rewritten with Phase 17.1's new statuses + reasons. Plan 18-02.
- `tests/orchestrators/marketplace/list.test.ts` -- Byte-exact assertions rewritten. Plan 18-03.
- `tests/orchestrators/marketplace/remove.test.ts` -- Byte-exact assertions rewritten; cleanup-leak tests DELETED (per D-18-01) or behavior-only assertions retained. Plan 18-04.
- `tests/orchestrators/marketplace/update.test.ts` -- Byte-exact assertions rewritten; retry-hint assertions DELETED (per D-18-02). Plan 18-05.
- `tests/orchestrators/marketplace/cascade.test.ts` -- Planner discretion; if it asserts on V1 cascade strings, those flip to V2; if it tests only the shared cascade helper at function level (no notify output), no change needed. Plan 18-04 (the remove plan owns cascade) OR plan 18-06.
- `tests/orchestrators/marketplace/shared.test.ts` -- Likely unchanged (tests `applyAutoupdateFlipInPlace`, `cascadeUnstagePlugin`, etc. -- pure functions, no notify output). Planner verifies.
- `eslint.config.js` -- Plan 18-06 adds `ignores: ["extensions/pi-claude-marketplace/orchestrators/marketplace/**"]` to MSG-Block 1 (lines ~152-169) and MSG-Block 1b (lines ~170-188). No other changes.

### Source files Phase 18 reads but does NOT modify

- `extensions/pi-claude-marketplace/shared/notify.ts` -- V2 renderer; Phase 17.1 amends; Phase 18 only IMPORTS `notify`, `NotificationMessage`, `MarketplaceNotificationMessage`, `PluginNotificationMessage`, etc.
- `extensions/pi-claude-marketplace/presentation/*` -- V1 composers. Each per-file plan DROPS its file's imports of these, but does not modify the composer files themselves (Phase 21 deletes).
- `tests/presentation/*.test.ts` -- Stays untouched (composer tests remain valid until Phase 21 deletes the composers).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`tests/orchestrators/marketplace/*.test.ts` mock-ctx pattern** -- Every file already defines a local `makeCtx()` that returns `{ ctx, notifications: NotifyRecord[] }` recording `{ message, severity }` tuples. The pattern threads through `pi: { getAllTools: () => [] }` for `softDepStatus(pi)`. Phase 18 preserves this pattern verbatim per D-18-06; the only change is the byte-string assertion targets.
- **`extensions/pi-claude-marketplace/shared/notify.ts::notify`** -- Public V2 entry point. Each migrated orchestrator imports this in place of the V1 wrappers; signature is `(ctx, pi, message)`. The `pi` arg flows through every orchestrator already (used for domain operations and now also for the notify probe).
- **`tests/shared/notify-v2.test.ts` per-variant fixtures** -- 32 unit tests over the 10 plugin statuses × 4 marketplace statuses + edge cases. Authoritative source for V2 byte strings when an orchestrator test's scenario isn't directly in the catalog.
- **`tests/architecture/catalog-uat.test.ts` FIXTURES map** -- Lines 1085-1259 contain the (section, state) fixture entries for the 5 marketplace command sections. These already model the V2 NotificationMessage payload shapes the orchestrator must construct -- effectively a reference implementation each orchestrator can pattern-match against.

### Established Patterns

- **Renderer-as-spec discipline (D-16-04)** -- The V2 grammar IS `shared/notify.ts`'s rendering behavior. Orchestrators MUST construct payloads such that `notify()` emits the catalog-expected bytes. No orchestrator-level string composition of tokens, markers, or trailers.
- **Single-`notify()`-call-per-orchestration discipline** -- Every state-changing orchestrator call emits exactly one `notify()` call with one complete `NotificationMessage`. No SECOND notify after the primary (per D-18-01). Failures route through the same call with `status: "failed"` rows.
- **Per-plugin cause chains (D-16-08)** -- `cause?: Error` lives on `PluginFailedMessage` and `PluginManualRecoveryMessage`; renders at 4-space indent below the plugin row. No marketplace-level cause chains in V2 (per catalog 836).
- **Caller-order honored (D-16-06)** -- `notify()` does NOT sort `marketplaces[]` or `plugins[]`. Orchestrators control iteration order. `autoupdate.ts`'s existing alphabetic sort (lines 178-180) is REMOVED in Plan 18-02 because the orchestrator's responsibility ends at "build the payload in display order"; `notify()` honors it. Alphabetic sort moves to the orchestrator's payload-construction loop if desired; otherwise it inherits the SC-6 scopes-loop order.
- **Single `softDepStatus(pi)` probe per `notify()` call (D-16-14)** -- Phase 18 orchestrators do NOT compute soft-dep state themselves; they declare `dependencies: readonly Dependency[]` on installed/updated/reinstalled plugin rows; `notify()` probes once and threads the result through `renderPluginRow`.
- **`makeCtx()` test pattern with structured pi mock** -- Phase 18 tests preserve `ctx.pi: { getAllTools: () => [] }` (typed via `ExtensionContext` cast). Soft-dep tests can supply a non-empty `getAllTools()` return to flip the probe outcome.

### Integration Points

- **Phase 17.1 amendments ↔ Plan 18-02 (autoupdate.ts)** -- 17.1 landed 2026-05-26 (`VERIFICATION.md status: passed`); the new `MarketplaceStatus` values (`"autoupdate enabled"`, `"autoupdate disabled"`, `"skipped"`), optional `reasons?:` field on `MarketplaceNotificationMessage`, and the corresponding `renderMpHeader` arms are now in `shared/notify.ts`. Plan 18-02 imports against the landed grammar; the planner reads `17.1-CONTEXT.md` + `17.1-03-SUMMARY.md` (catalog rewrite) to ground payload construction.
- **Catalog UAT (Phase 17) ↔ Phase 18 migration** -- Catalog UAT byte-equality MUST stay GREEN across every wave. Wave 1 (add.ts pilot) verifies the construction pattern produces catalog-expected bytes for the simplest shape; Wave 2 verifies for the remaining 4 (autoupdate post-17.1; list; remove; update); Wave 3 plan 18-06 runs catalog UAT once more as a final safety net before lint narrowing.
- **MSG-* lint scoping (Phase 14 + Phase 16 bounded windows) ↔ Plan 18-06** -- Block 1 (lines 152-169) + Block 1b (lines 170-188) gain a marketplace-family ignore entry. Block 4a + Block 5 bounded `shared/notify.ts` ignores (Phase 16, ending at Phase 21) are NOT touched by Phase 18. The bounded ignores survive until Phase 21 because V1 wrappers + V1 composers still exist and still get linted.
- **Phase 19/20/21 ↔ Phase 18's lint narrowing** -- Phase 19 ADDS `orchestrators/plugin/**` to the same `ignores:` entry; Phase 20 ADDS `orchestrators/edge/**` AND removes Block 1b's `edge/handlers/**` files entry; Phase 21 deletes the entire MSG-* plugin wiring. Additive narrowing keeps each phase's lint diff minimal.

</code_context>

<specifics>
## Specific Ideas

- **V2 catalog autoupdate redesign** (D-18-05, blocking Phase 17.1): the user-locked design replaces the catalog's flattened `(updated)` for autoupdate enable/disable with dedicated tokens that preserve the V1 distinction. See D-18-05 table above for the exact 5-state mapping.
- **`marketplace add` GitHub-source success now emits reload-hint** (consequence of D-16-12 + Phase 18 migration): V1 add.ts test asserts `note.message.includes("/reload to pick up changes") === false`; V2 catalog `<!-- catalog-state: github-source -->` includes the trailer. Plan 18-01 flips this assertion. User-visible behavior change accepted as the V2 grammar's contract.
- **`marketplace remove` partial state cause-chain MOVES from marketplace level to per-plugin level** (D-18-03): V1 emits an inline `causeChainTrailer(err)` inside a `notifyWarning` body. V2 emits `PluginFailedMessage { cause?: Error }` per failed plugin, with 4-space-indent rendering by `renderPluginRow`. Catalog `<!-- catalog-state: partial -->` at docs/output-catalog.md:775-786 is the reference shape.
- **`marketplace update` mp-failure becomes a bare failed header** (D-18-02): V1 emits multi-line message with retry-hint suffix and full Error.cause chain. V2 emits `⊘ <mp> [<scope>] (failed)` alone -- no cause-chain, no retry hint, no plugin rows because the failure happened before plugin cascade evaluation.
- **MSG-Block 1 + 1b ignores entry as an additive contract across Phases 18/19/20** -- The ignore entry that Plan 18-06 adds is THE same key Phase 19 and Phase 20 extend. Path string: `"extensions/pi-claude-marketplace/orchestrators/marketplace/**"`.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 19 (Migration Wave 2 -- Plugin Orchestrator Family)** -- Migrates `orchestrators/plugin/**` (`install.ts`, `uninstall.ts`, `reinstall.ts`, `update.ts`, `list.ts`, `bootstrap.ts`). Extends MSG-Block 1 + 1b ignores with `orchestrators/plugin/**`. Closes 0 SNM-IDs (execution phase contributing to SNM-22).
- **Phase 20 (Migration Wave 3 -- Edge + UsageError)** -- Migrates `edge/handlers/**` (13 callsites per CMC-34 baseline) + V1 3-arg `notifyUsageError` → V2 1-arg form. Closes SNM-23. Extends MSG-Block 1 ignores; removes Block 1b's `edge/handlers/**` entry.
- **Phase 21 (Final Teardown + GREEN gate)** -- Deletes V1 wrappers, the 34-rule MSG-* lint plugin, presentation/* composers, the bounded shared/notify.ts ignores, grammar/* closed-set files (decision pending). Closes SNM-22, SNM-24..29, SNM-32.
- **`orchestrators/marketplace/shared.ts` stale comment cleanup** -- references to `notifyError` patterns in comments at lines 481-484. Planner discretion (see Claude's Discretion above).
- **Test-helper extraction for `makeCtx()` + `pi: { getAllTools: () => [] }`** -- Currently inlined in every orchestrator test file. Cosmetic refactor; deferred to Phase 21 cleanup or a quick task.
- **`presentation/marketplace-list.test.ts` (and other composer tests) deletion** -- Deferred to Phase 21 when the composers themselves are deleted.
- **JSON output mode for notifications** -- REQUIREMENTS.md §"Out of Scope" backlog (v1.4 stays English-only with rendered byte output).
- **Branded `Version` type with `hash-<12hex>` / semver validation** -- Carried backlog from Phase 15/16.

### Reviewed Todos (not folded)

None -- `gsd-sdk query todo.match-phase 18` returned `matches: []` and `todo_count: 0`. No pre-targeted todos in the codebase for this phase.

</deferred>

---

*Phase: 18-Migration Wave 1 -- Marketplace Orchestrator Family*
*Context gathered: 2026-05-26*
