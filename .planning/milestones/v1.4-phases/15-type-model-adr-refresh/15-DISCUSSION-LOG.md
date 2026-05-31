# Phase 15: Type Model & ADR Refresh - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 15-Type Model & ADR Refresh
**Areas discussed:** Reasons & per-variant field shape, MarketplaceDetails shape, Compile-check + runtime const arrays, ADR refresh depth

---

## Reasons & per-variant field shape

### Q1: How should v1.3's closed Reason enum attach to the new plugin variants?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-variant required: only on the 5 that need it | unavailable/upgradable/skipped/failed/manual recovery carry required `reasons: readonly Reason[]` (empty array allowed). Other 5 omit. Pushes per-variant discipline into the discriminated union -- emitting `(installed) {up-to-date}` becomes a compile error. Import Reason from shared/grammar/reasons.ts. | ✓ |
| Optional `reasons?: readonly Reason[]` on every variant | Uniform optional field. Drawback: structurally allows reasons on success variants where v1.3 never emits them -- moves discipline back to renderer. | |
| Drop reasons; fold into `cause?: Error` | Closed Reason set retired in Phase 15. Clashes with SNM-10 scoping cause to Error chains. Loses compile-time enforcement on the 28-phrase closed set. | |
| You decide / researcher recommends | Defer to researcher. | |

**User's choice:** Per-variant required on the 5 that need it.
**Notes:** Locks v1.3's per-row {reason} brace into the type system. D-15-01 in CONTEXT.md.

---

### Q2: How should the 7 non-success variants handle the SNM-06 dependencies field?

| Option | Description | Selected |
|--------|-------------|----------|
| Absent on all 7 non-success variants | Discriminated union has no `dependencies` field on failed/skipped/uninstalled/available/unavailable/upgradable/manual-recovery. Symmetric with Reason decision. Renderer probe path only reachable from the 3 success arms. | ✓ |
| Optional `dependencies?: readonly Dependency[]` on all 10 | Uniform field. Re-introduces per-variant drift class -- fixture could put `dependencies: ['agents']` on a failed row and trigger a probe. | |
| Absent on most; optional on uninstalled only | MSG-SD-3 forbids the marker on uninstalled. Hypothetical. | |
| You decide / defer | Defer to researcher. | |

**User's choice:** Absent on all 7 non-success variants.
**Notes:** D-15-02 in CONTEXT.md.

---

### Q3: Where does the Reason type live for the new variants?

| Option | Description | Selected |
|--------|-------------|----------|
| Import from shared/grammar/reasons.ts unchanged | 28-entry closed set + drift test stay intact. Phase 21 (SNM-29) makes survive/retire call. 3 entries become structurally absorbed but stay in runtime array. | ✓ |
| Redefine inline in shared/notify.ts as a literal union | Couples Phase 15 to a partial SNM-29 outcome. Re-runs drift question (now between two literal unions). | |
| Import + prune to v1.4-active subset | `Exclude<Reason, 'rollback partial' \| 'requires pi-subagents' \| 'requires pi-mcp'>`. Marginal benefit, adds v2-vs-v1.3 cognitive split. | |
| You decide | Defer pruning vs. straight-import to planner. | |

**User's choice:** Import from shared/grammar/reasons.ts unchanged.
**Notes:** D-15-03 in CONTEXT.md. Pruning deferred to Phase 21 alongside the grammar/ retire-or-keep decision.

---

### Q4: Where does plugin version go in the new model?

| Option | Description | Selected |
|--------|-------------|----------|
| Optional `version?: string` per-variant; required `from`/`to` on updated | Mirrors v1.3 PluginInlineRow / PluginListRow shapes. Hash-version is just a string. | ✓ |
| Required `version: string` on every variant | Forces synthetic placeholders on rows where v1.3 catalog emits no version. | |
| Replace string with a dedicated `Version` branded type | Over-engineering for a types-only phase. SNM-01..11 don't ask for it. Backlog. | |
| You decide / defer | Defer to researcher. | |

**User's choice:** Optional per-variant with from/to on updated.
**Notes:** D-15-04 in CONTEXT.md.

---

## MarketplaceDetails shape

### Q1: What's the exact MarketplaceDetails shape?

| Option | Description | Selected |
|--------|-------------|----------|
| `{ autoupdate: boolean; lastUpdatedAt?: string }` -- minimal, mirrors persistence | autoupdate REQUIRED boolean (record always knows). lastUpdatedAt?: string ISO matches persistence/state-io.ts:70 exactly. | ✓ |
| `{ autoupdate?: boolean; lastUpdatedAt?: string; source?: ParsedSource }` | Adds future-proofing source field. Couples to domain/source.ts. YAGNI for v1.4. | |
| Split into separate sub-objects | Two-sub-object shape, no behavior payoff. | |
| You decide / researcher recommends | Defer field set to researcher. | |

**User's choice:** Minimal `{ autoupdate: boolean; lastUpdatedAt?: string }`.
**Notes:** D-15-05 in CONTEXT.md.

---

### Q2: Should MarketplaceNotificationMessage structurally constrain `status?` / `details?` co-occurrence?

| Option | Description | Selected |
|--------|-------------|----------|
| Independent optionals -- keep SNM-02 as written | Never co-occur in practice; renderer ignores details when status set. Mirrors v1.3 MarketplaceRow's independent status/marker. | ✓ |
| Split into two named variants | StateChange vs ListEntry discriminated union. Compile error to mix. Two interfaces to maintain. | |
| Single shape with discriminator field | Add `kind: 'state-change' \| 'list-entry'`. Adds ceremony with no behavior payoff. | |
| You decide | Defer to planner. | |

**User's choice:** Independent optionals.
**Notes:** D-15-06 in CONTEXT.md.

---

### Q3: Is dropping 'skipped' from MarketplaceStatus intentional?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes -- 4 values, no 'skipped' (SNM-05 locked) | v1.4 marketplace-skipped rows re-route through one of 4 statuses with no-op semantics OR disappear. Catalog rewrite in Phase 17 confirms. | ✓ |
| Add 'skipped' -- 5 values total | Would require flagging SNM-05 for amendment. Contradicts locked requirement. | |
| 4 values; add reasons[] to marketplace level | Mixes per-row reasons into a level reserved for plugins. | |
| Defer to researcher | Read output-catalog and revisit. | |

**User's choice:** Yes -- 4 values; SNM-05 locked.
**Notes:** D-15-07 in CONTEXT.md. Flagged as downstream-verification item for researcher.

---

### Q4: What does empty `plugins: []` mean on a MarketplaceNotificationMessage?

| Option | Description | Selected |
|--------|-------------|----------|
| Empty array IS the explicit '(no plugins)' rendering | On list surface triggers `(no plugins)` bare token. On state-change paths, empty is the normal case -- header alone. Switch branches on status presence. | ✓ |
| Add `plugins: readonly PluginNotificationMessage[] \| null` | null = unknown, [] = explicit empty. Three-state distinction rarely load-bearing. | |
| Marketplace-level `noPlugins?: true` discriminator | Sentinel field; empty array can express directly. | |
| You decide / defer | Defer to Phase 16. | |

**User's choice:** Empty array IS the explicit '(no plugins)' rendering.
**Notes:** D-15-08 in CONTEXT.md.

---

### Q5: What does empty top-level `marketplaces: []` mean?

| Option | Description | Selected |
|--------|-------------|----------|
| Empty array → `(no marketplaces)` rendering on list surface; never on state-change paths | Symmetric with plugin-level decision. State-change paths always populate at least one marketplace. | ✓ |
| Forbid empty top-level array; renderer asserts length >= 1 | Add brand or non-empty tuple type. Loses empty-list rendering path. | |
| Add `noMarketplaces?: true` flag at top level | Same ceremony objection. | |
| You decide / defer | Defer to Phase 16. | |

**User's choice:** Empty array → `(no marketplaces)` on list surface.
**Notes:** D-15-09 in CONTEXT.md.

---

## Compile-check + runtime const arrays

### Q1: Where does SC#2's compile-time proof live?

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone `tests/architecture/notify-types.test.ts` | Consistent with v1.3 architecture-tests precedent. Failures appear in test runner. | ✓ |
| In-file `type _Assert = ...` block in shared/notify.ts | Closest to types it proves. Failure surfaces at tsc time, not test runner. Pollutes public-API file. | |
| Both: in-file for round-trip + standalone for closed-set | Two-surface approach. Slight drift risk. | |
| You decide | Defer location to planner. | |

**User's choice:** Standalone tests/architecture/notify-types.test.ts.
**Notes:** D-15-10 in CONTEXT.md.

---

### Q2: Ship runtime PLUGIN_STATUSES / MARKETPLACE_STATUSES const arrays now?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship in Phase 15 alongside the types | Mirrors shared/grammar/status-tokens.ts pattern. PluginStatus stays SNM-04-compliant (derived via indexed access from the tuple). Phase 16/17 fixture iteration for free. | ✓ |
| Defer to Phase 16 | Pure types only in Phase 15. Closer to SNM-04 literal wording. | |
| Ship MARKETPLACE_STATUSES only; defer PLUGIN_STATUSES | Asymmetric. | |
| You decide | Defer to planner. | |

**User's choice:** Ship in Phase 15.
**Notes:** D-15-11 in CONTEXT.md.

---

### Q3: Ship DEPENDENCIES const array too?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes -- ship DEPENDENCIES alongside the other const arrays | Symmetric. Two-line addition. Phase 16 renderer iterates DEPENDENCIES for per-dependency probe; test fixtures iterate to confirm. | ✓ |
| Type only -- literal union, no const array | Smallest surface. No fixture iteration benefit. | |
| You decide | Defer to planner. | |

**User's choice:** Yes -- ship DEPENDENCIES.
**Notes:** D-15-11 (combined) in CONTEXT.md.

---

### Q4: Should the compile-check file also assert per-variant structural invariants beyond closed-set membership?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes -- lock all per-variant invariants | ~10 lines of `type _Assert_<field>_<variant> = ...` blocks. Catches accidental field additions. Mirrors `no-legacy-markers.test.ts`'s enforce-the-rule-once pattern. | ✓ |
| No -- closed-set membership only | Cheaper file, weaker safety net. | |
| Yes for failed/manual-recovery field discipline only; defer the rest | Lock cause?/rollbackPartial? per-variant only. | |
| You decide | Defer to planner. | |

**User's choice:** Yes -- lock all per-variant invariants.
**Notes:** D-15-12 in CONTEXT.md.

---

## ADR refresh depth

### Q1: How deep is the ADR refresh?

| Option | Description | Selected |
|--------|-------------|----------|
| Full Decision/Consequences rewrite + status flip + closed-set updates | Rewrite end-to-end to reflect single-`notify` + computed severity + computed reload + always-marketplace-header + dropped trailer + per-plugin causes. Flip Proposed → Accepted. Replace per-outcome wrapper snippets with one `notify(ctx, payload)` snippet. | ✓ |
| Surgical patches: status flip, rename types, drop-trailer note, spec-change note | Add a `### v1.4 Update` block at top patching differences. Leaves internally-contradictory ADR. | |
| Replace ADR entirely with v2-002 superseding doc | Move v2-001 to Superseded; new ADR for final design. Drifts from SNM-21's "refresh" wording. | |
| You decide / defer scope to planner | Defer rewrite scope to planner. | |

**User's choice:** Full Decision/Consequences rewrite.
**Notes:** D-15-13 in CONTEXT.md.

---

### Q2: What happens to the ADR's Open Questions section?

| Option | Description | Selected |
|--------|-------------|----------|
| Resolve both inline; remove the Open Questions section | Q1 (cascade abstraction) answered by single union + always-marketplace-header spec. Q2 (runtime validation) answered by discriminated union + assertNever. ADR ends clean. | ✓ |
| Move both to a 'Resolved Questions' section | Audit-trail-friendly. Marginally longer. | |
| Leave Open Questions; add new v1.4-era questions | Re-introduces moving-target tone after flipping to Accepted. | |
| You decide | Defer. | |

**User's choice:** Resolve both inline; remove the section.
**Notes:** D-15-14 in CONTEXT.md.

---

### Q3: Rewrite Migration section to cite concrete phase numbers?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes -- replace abstract phases with Phase 16-21 references | Migration becomes a forward reference for downstream planning. REQUIREMENTS.md traceability mitigates drift if numbers change. | ✓ |
| Keep abstract phase names; add footnote pointing to ROADMAP.md | Drift-free; more indirection. | |
| Delete Migration section entirely | ADRs traditionally don't carry execution plans. Loses per-phase rationale. | |
| You decide / defer | Defer to planner. | |

**User's choice:** Yes -- cite Phase 16-21.
**Notes:** D-15-15 in CONTEXT.md.

---

### Q4: What happens to 'Alternatives Considered' Alt 2 (single-notify-no-wrappers -- now the actual design)?

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite Alt 2 as ACCEPTED with a note on what changed | Discriminated-union literal narrowing on `status:` recovers per-outcome-wrapper autocomplete ergonomics. assertNever retains compile-error gate. Honest about design pivot. | ✓ |
| Delete Alts 1-6 entirely; replace with brief 'Why single notify' paragraph | Strips historical pro/con; loses Alt 4/5/6 rationale for future debates. | |
| Keep all 6 alternatives + 'Design Pivot' callout | Most thorough; longest. | |
| You decide / defer | Defer. | |

**User's choice:** Rewrite Alt 2 as ACCEPTED with a note.
**Notes:** D-15-16 in CONTEXT.md.

---

## Claude's Discretion

- Exact `type _Assert_*` formulation for each per-variant invariant in the compile-check file (multiple valid TS idioms).
- Naming convention for per-variant interfaces inside `PluginNotificationMessage` union (named exports vs. inline anonymous variants).
- Whether to re-export `Reason` from `shared/notify.ts` as a single-import convenience.
- Commit granularity within Phase 15 (one commit for types, one for compile-check, one for ADR -- vs. one big commit).

## Deferred Ideas

- Branded `Version` type with hash-`<12hex>` / semver validation -- backlog.
- `source?: ParsedSource` on `MarketplaceDetails` -- YAGNI for v1.4; revisit if Phase 17 catalog rewrite reveals need.
- Splitting MarketplaceNotificationMessage into discriminated StateChange vs ListEntry variants -- rejected per D-15-06; revisit if Phase 16 unit tests find the co-occurrence is a real footgun.
- Pruning `Reason` to a v1.4-active subset -- rejected per D-15-03; revisit in Phase 21 alongside SNM-29 grammar/ retire-or-keep.
- In-file `type _Assert = ...` block in shared/notify.ts -- rejected as primary surface per D-15-10; planner has discretion to use for narrow self-referential claims.
- Separate `v2-002-notify-single-entrypoint.md` ADR superseding v2-001 -- rejected per D-15-13.
