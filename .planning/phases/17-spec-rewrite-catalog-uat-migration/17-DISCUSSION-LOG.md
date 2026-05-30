# Phase 17: Spec Rewrite & Catalog UAT Migration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 17-Spec Rewrite & Catalog UAT Migration
**Areas discussed:** Frontmatter retention strategy, V1 callsite catalog UAT handling, Catalog UAT fixture structure, Style guide v2.0 depth

---

## Frontmatter retention strategy

### Q1: What's the v2.0 style-guide frontmatter strategy?

| Option | Description | Selected |
|--------|-------------|----------|
| Delete entirely | Drop status_tokens / reasons / markers / pattern_classes from v2.0 frontmatter. Style guide becomes prose-only -- closed sets are discoverable in shared/notify.ts (types) and shared/grammar/reasons.ts (REASONS until Phase 21). Delete grammar-frontmatter.test.ts in Phase 17 (advances SNM-26 from Phase 21 → Phase 17). Aligned with D-16-04 'renderer is the spec authority' and the LoC reduction milestone. | ✓ |
| Keep + drift-test against types | Retain frontmatter (split status_tokens into plugin_statuses + marketplace_statuses + dependencies; keep reasons aligned with REASONS minus the 3 structurally-absorbed entries; keep markers; rework pattern_classes for v2). Rewrite grammar-frontmatter.test.ts to assert parity against PLUGIN_STATUSES/MARKETPLACE_STATUSES/DEPENDENCIES/REASONS. SNM-26 stays Phase 21 (or rewrite happens in Phase 17 alongside the catalog rewrite -- planner's call). | |
| Keep but lossy + no drift test | Keep frontmatter as cosmetic doc aid only, no drift test -- explicit comment in frontmatter that types in shared/notify.ts are binding. Delete grammar-frontmatter.test.ts in Phase 17 (advances SNM-26). Acknowledges drift risk; cheap on test infrastructure. | |

**User's choice:** Delete entirely
**Notes:** Locks D-17-01. Types are now the binding closed-set authority; the style guide stops duplicating closed-set membership.

### Q2: How does Phase 17 resolve grammar-frontmatter.test.ts now that frontmatter is gone?

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it; advance SNM-26 to Phase 17 | Remove tests/architecture/grammar-frontmatter.test.ts and update REQUIREMENTS.md traceability (SNM-26 owner Phase 21 → Phase 17, status Complete). Phase 15's tests/architecture/notify-types.test.ts already locks closed-set membership at compile time -- no runtime drift test needed once the types ARE the contract. | ✓ |
| Replace with type-shape assertion file | Delete the YAML-parity logic but keep a small architecture test -- e.g. assertions that PLUGIN_STATUSES contains exactly the 10 expected literals or that REASONS still contains the 28 known entries. Reduces accidental const-array edits. Slightly more LoC than option A. Also advances SNM-26 to Phase 17. | |
| Defer -- keep frontmatter through Phase 17, delete in Phase 21 | Reverse course on D-17-01 partially: KEEP a minimal v2-aligned frontmatter (just enough to keep grammar-frontmatter.test.ts loading) and let Phase 21 do the full deletion as SNM-26 scheduled. Avoids cross-requirement coupling but contradicts the 'delete entirely' decision just made. | |

**User's choice:** Delete it; advance SNM-26 to Phase 17
**Notes:** Locks D-17-02. Compile-time closed-set proof in `tests/architecture/notify-types.test.ts` is the safety net; no runtime drift test needed.

---

## V1 callsite catalog UAT handling

### Q3: How does Phase 17 handle V1-callsite output verification during the Phase 17-20 migration window?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure exclusion (no V1 catalog gate) | Catalog UAT runs notify() only against the v2 catalog. V1 wrappers stay covered only by their existing unit tests (tests/shared/notify.test.ts) -- no byte-equal catalog gate during the migration window. Justification: V1 wrappers are FROZEN, deletion is scheduled Phase 21, and the unit tests already cover behavior. Simpler, single source of truth (the v2 catalog). Risk: subtle V1 output regressions wouldn't be caught between Phase 17 and the relevant migration wave. | ✓ |
| Transitional V1 snapshot file + dual UAT | Phase 17 freezes the current v1 catalog as docs/output-catalog-v1-snapshot.md and keeps a sibling test (e.g., tests/architecture/catalog-uat-v1.test.ts) that asserts V1 composers byte-equal against the snapshot -- unchanged from current behavior. The new docs/output-catalog.md is v2-only. As Phase 18/19/20 migrate a callsite, the V1-snapshot section for that command is deleted. Phase 21 deletes the snapshot + sibling test entirely. Stronger gate during transition; more bookkeeping. | |
| Per-section dual blocks in one catalog | docs/output-catalog.md keeps one file but each per-command section carries BOTH the v1 expected-output blocks (annotated as V1) and the v2 expected-output blocks (annotated as V2). The UAT runs BOTH -- v1 blocks against V1 composers, v2 blocks against notify(). Per-section migration deletes the v1 block. Most discoverable for reviewers; densest doc. | |

**User's choice:** Pure exclusion (no V1 catalog gate)
**Notes:** Locks D-17-03. Single source of truth (v2 catalog); V1 wrappers frozen + already covered by tests/shared/notify.test.ts; Phase 21 deletes the V1 path outright.

### Q4: How should the v2 catalog surface migration state per command?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent -- catalog is forward-looking spec only | v2 catalog presents v2 expected outputs as the authoritative spec without any 'currently V1 / migrated' annotation. Readers infer migration status from REQUIREMENTS.md SNM-23 + the per-phase ROADMAP. Cleanest catalog; lowest doc-churn (no edits needed when Phase 18/19/20 migrate). | ✓ |
| Header table tracking migration status | v2 catalog has a top-of-file section listing each /claude:plugin command + its migration phase + current emission source (V1 / notify()). This table is updated in Phase 18/19/20 as callsites migrate. Discoverable for reviewers; small bookkeeping cost per migration wave. | |
| Per-section migration-status callout | Each per-command H2 section opens with a small callout like 'Migrated via notify() in Phase 19' or 'Currently emitted by V1 wrappers; migrates Phase 19'. Phase 18/19/20 flips the callout as they migrate. Most contextual for readers but highest doc-churn. | |

**User's choice:** Silent -- catalog is forward-looking spec only
**Notes:** Locks D-17-04. Migration progress tracked in REQUIREMENTS.md SNM-23 traceability + ROADMAP.md; catalog stays clean.

---

## Catalog UAT fixture structure

### Q5: How are NotificationMessage fixtures organized vs. catalog text in the new UAT?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline catalog parser (mirror current pattern) | Keep the existing approach: catalog UAT reads docs/output-catalog.md at test time, walks per-command H2 sections, extracts <!-- catalog-state: STATE --> annotated fenced blocks. Fixtures live IN the test file as a Map<(section, state), NotificationMessage> with one entry per catalog state. Catalog text is sole source of expected output; fixtures construct inputs. Phase 16's per-variant fixtures inform but don't replace per-command fixtures -- a /claude:plugin install state combines a marketplace + a plugin row into one NotificationMessage that the catalog asserts byte-equal against. | ✓ |
| Code-first fixtures + catalog generated/extracted from them | Move fixtures into a TS module (e.g., tests/architecture/catalog-fixtures.ts) keyed by (section, state). The catalog UAT runs each fixture through notify() and asserts byte-equal against catalog text extracted by section/state. Catalog text remains the human-readable spec but tests no longer parse it for fixtures -- fixtures are first-class TS. Tighter type safety on fixtures; catalog text is still the assertion target. | |
| Reuse Phase 16 variant fixtures + per-command mapping table | Don't duplicate fixtures: import the Phase 16 per-variant fixtures from tests/shared/notify-v2.test.ts (or factor them to a shared module). Add a per-command mapping table that says 'section X state Y = compose variant A + variant B'. The catalog text remains assertion target; per-command outputs are computed by composing variants. Lower fixture LoC; more complex composition logic. | |

**User's choice:** Inline catalog parser (mirror current pattern)
**Notes:** Locks D-17-05. Reviewers' cognitive switch is minimal; catalog text remains sole source of truth for expected bytes.

### Q6: Catalog state-marker convention for v2?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing <!-- catalog-state: STATE --> markers | Keep the HTML-comment marker convention verbatim. STATE strings are human-readable identifiers (e.g., 'happy-path', 'scope-mismatch'). Each marker pairs with the next fenced block. Fixture lookup uses (section, state) tuple. Lowest friction -- reviewers already understand the convention. | ✓ |
| Switch to typed marker carrying variant hints | New marker shape like <!-- catalog-fixture: { variant: 'installed', scope: 'user' } --> embedding minimal NotificationMessage shape hints. Easier fixture authoring/auditing; slightly noisier in the .md; small risk of marker-fixture drift. | |

**User's choice:** Reuse existing <!-- catalog-state: STATE --> markers
**Notes:** Locks D-17-06. (section, state) tuple keys fixture lookup; no new marker conventions.

---

## Style guide v2.0 depth

### Q7: How deep does the v2.0 style guide go?

| Option | Description | Selected |
|--------|-------------|----------|
| Thin pointer doc (~5-7 sections, ~150-250 lines) | v2.0 has Overview, Type Model Reference (pointing at shared/notify.ts + notify-types.test.ts), Output Grammar Summary (one-page rule list: always-marketplace-header, computed severity, computed reload-hint, computed soft-dep, inline cause chains), Severity Routing reference, ES-5 supersession table preserved, Cross-References. Worked examples deferred to docs/output-catalog.md. Pattern Class Reference §16 deleted (renderer enumerates patterns inside notify() switches; catalog is the per-command example surface). Lowest LoC; aligns with 'renderer is the spec' authority. | ✓ |
| Medium re-narration (~10-12 sections, ~400-500 lines) | Keep narrative sections that explain WHY/WHEN (Foundational Rule, Status Icons, Severity Routing, Reload Hint, Soft-Dep Markers, Manual Recovery, Rollback Partial, Cause Chain, Non-Cascade Errors & UsageError, IL-3 console.warn, ES-5 Replacement Table, Cross-References). Drop pure-enumeration sections (Status Tokens, Reasons Enum) and Pattern Class Reference §16 -- those flow from the types. A few worked examples retained to bridge between rule and catalog example. | |
| Full re-narration (keep ≈20 sections, comparable LoC) | Rewrite each existing section in place for v2 (replace v1.3 grammar references with v2 type-driven rules; rewrite Pattern Class Reference for v2's smaller pattern set). Keeps the style guide as a comprehensive single-stop reference. Highest LoC; significant doc-churn risk; somewhat fights D-16-04 'renderer is the spec'. | |

**User's choice:** Thin pointer doc (~5-7 sections, ~150-250 lines)
**Notes:** Locks D-17-07. Style guide v1.0 → v2.0 drops ~720 lines (~970 → ~250). §16 Pattern Class Reference deleted; §17 Worked Examples Gallery merges into the catalog. Aligns with D-16-04 + v1.4 net-LoC milestone.

### Q8: Where does the ES-5 Supersession Table live in v2?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep in style guide -- mark 'fully retired Phase 21' | Preserve §15 in v2.0 style guide. Add a one-line note that the 5 legacy markers ('pending', etc.) are still blocked by tests/architecture/no-legacy-markers.test.ts until Phase 21 deletes both the markers and the test. Keeps the supersession record co-located with the style guide for ease of audit. | ✓ |
| Move to ADR docs/adr/v2-001-structured-notify.md | ES-5 supersession is a formal design pivot -- belongs in the ADR's 'Consequences' or a new 'Supersession Record' section. Style guide v2.0 contains just a one-line pointer to the ADR. Tightens the thin style guide further; ADR becomes the single design-history source. | |
| Move to PRD docs/prd/pi-claude-marketplace-prd.md §6.12 | ES-5 was defined in PRD §6.12; the supersession record can be inlined there as a 'V2 successor' subsection. Style guide v2.0 omits ES-5 entirely. Tightest possible style guide; PRD owns both the original and the supersession. | |

**User's choice:** Keep in style guide -- mark 'fully retired Phase 21'
**Notes:** Locks D-17-08. ES-5 Supersession Table stays co-located with the style guide. ADR + PRD untouched on this axis.

---

## Claude's Discretion

The planner has flexibility on (from CONTEXT.md "Claude's Discretion" subsection):

- Exact heading numbering / wording of the v2.0 style guide's ~5-7 sections.
- Whether the v2.0 style guide's "Type Model Reference" section embeds a TypeScript code snippet inline or strictly points at `shared/notify.ts`.
- Survival or absorption of the existing catalog `## Resolutions to apply to docs/messaging-style-guide.md` section (catalog lines 925-967).
- Plan granularity for the catalog UAT rewrite (one atomic plan vs. parser-rewrite-then-renderer-swap split).
- Fixture-module organization (inline in test file vs. factored to `tests/architecture/catalog-fixtures.ts` helper).
- Whether to refactor Phase 16's `tests/shared/notify-v2.test.ts` fixtures into a shared module imported by catalog-uat.
- Where the SNM-26 REQUIREMENTS.md traceability edit lands (separate plan vs. inside style-guide or test-deletion plan).
- Whether the Phase 17 ADR cross-reference lands as a separate plan or is folded into the style-guide rewrite.
- Exact rendering of `docs/output-catalog.md` §Conventions in v2.0 (trim vs. rewrite based on the v2 grammar simplifications).

## Deferred Ideas

(From CONTEXT.md `<deferred>` section -- all phase-mapped in REQUIREMENTS.md already.)

- Migrating callsites from V1 wrappers to `notify()` -- Phases 18, 19, 20.
- Deleting V1 wrappers -- Phase 21 (SNM-22).
- Deleting the 34-rule MSG-* lint plugin -- Phase 21 (SNM-27).
- Updating `tests/architecture/no-legacy-markers.test.ts` source set for V2 vocabulary -- Phase 21 (SNM-28).
- Retiring `shared/grammar/*.ts` files -- Phase 21 (SNM-29).
- Deleting V1 `presentation/*` composers -- Phase 21.
- `npm run check` baseline drift accounting -- Phase 21 (SNM-32).
- Branded `Version` type with `hash-<12hex>` / semver validation -- backlog.
- JSON output mode for notifications -- backlog.
- Pruning `Reason` to v1.4-active subset -- Phase 21 (alongside SNM-29).
- Factoring `tests/shared/notify-v2.test.ts` fixtures into a shared module -- Claude's Discretion in Phase 17 plan, otherwise Phase 21 test cleanup.
