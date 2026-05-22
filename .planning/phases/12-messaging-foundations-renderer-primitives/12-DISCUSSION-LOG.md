# Phase 12: Messaging Foundations & Renderer Primitives - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 12-messaging-foundations-renderer-primitives
**Areas discussed:** Constants module shape, Reload-hint composer migration, Notify wrapper signature evolution, Migrate.ts wording

---

## Area Selection

User initially selected only **Constants module shape**. After completing that area, user opted to **explore more gray areas** and selected all three remaining: reload-hint composer migration, notify wrapper signature evolution, migrate.ts wording.

---

## Constants Module Shape

### Q1: Location

| Option | Description | Selected |
|--------|-------------|----------|
| `shared/grammar/` subdirectory | New subdir with `status-tokens.ts`, `reasons.ts`. Anchors a "messaging grammar" surface; sibling to `shared/markers.ts`. | ✓ |
| `shared/` flat (peer to markers.ts) | Flat files peer to existing `shared/markers.ts`, `shared/notify.ts`. | |
| `presentation/grammar/` | Group with renderers. Downside: orchestrators would have to reach into presentation/. | |

**User's choice:** `shared/grammar/` subdirectory.

### Q2: TS shape

| Option | Description | Selected |
|--------|-------------|----------|
| `as const` array + derived literal union | Single source: array iterates for drift test, literal union types Phase 13 callsites. Zero runtime cost; matches existing `PluginRenderStatus` pattern. | ✓ |
| TypeBox union schema | Provides JIT runtime validation. Heavier than needed — these are token constants, not validated payloads. | |
| Named `const` per token + readonly Set | Per-token imports give precise grep/refactor surface. Verbose; 38 named constants total is high churn. | |

**User initially requested clarification — asked for recommendation.** Claude recommended `as const` array + derived literal union with rationale: zero runtime cost, single source for both Phase 13 callsites and Phase 14 drift test, matches NFR-7's discriminated-union discipline and the codebase's existing `as const` patterns.

**User's choice:** `as const`, single module per set.

**Notes:** User combined two decisions in the reply ("single module per set" implicitly chose Module split = one file per set: `status-tokens.ts` + `reasons.ts`).

### Q3: YAML reader infrastructure

| Option | Description | Selected |
|--------|-------------|----------|
| Test-local YAML parse, no shared utility | Phase 12 ships equality test inline. Phase 14 builds its own richer reader when needed. Smallest surface. | ✓ |
| Publish a shared frontmatter loader | Phase 12 lands `shared/grammar/load-frontmatter.ts`. Less duplication later; more surface now for a single consumer. | |
| Embed YAML lists as TS arrays in test code | No YAML parsing at all in Phase 12. Effectively double-sources the contract — violates "frontmatter is sole source of truth." | |

**User's choice:** Test-local YAML parse, no shared utility.

### Q4: Bare-token modeling

| Option | Description | Selected |
|--------|-------------|----------|
| Flat — single `StatusToken` union, all 14 members | `STATUS_TOKENS` is one array. Render-shape branching is Phase 13's concern. Matches frontmatter 1:1. | ✓ |
| Split into two sub-unions | `COMPACT_STATUS_TOKENS` (12) + `BARE_STATUS_TOKENS` (2). Type-safety for renderer; cost: two arrays to keep aligned. | |
| Flat union + branded `BareStatusToken` derived type | Single source + optional type-narrowing. Slightly more surface. | |

**User's choice:** Flat — single `StatusToken` union, all 14 members.

---

## Reload-Hint Composer Migration

### Q1: Migration strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Replace in-place + mechanically migrate 5 callsites | Phase 12 swaps signature AND updates all callsites in same phase. Satisfies "verb selector gone" + keeps `npm run check` green. | ✓ |
| Side-by-side: keep old, add new under different name | Doesn't satisfy success criterion #2 ("three-verb selector is gone from `presentation/reload-hint.ts`"). | |
| Replace in-place + leave callsites broken until Phase 13 | Violates NFR-6 (`npm run check` green throughout). Not viable. | |

**User's choice:** Replace in-place + mechanically migrate 5 callsites (actually 6 — install, uninstall, plugin/update, marketplace/update, marketplace/remove, import/execute).

**Notes:** Claude flagged that this means user-visible output changes for those 6 surfaces in Phase 12, which is strictly beyond migrate.ts. Recorded as carve-out flag D-CMC-10 — read as authorized by criterion #2 (verb selector gone) which structurally requires the trailer to change wherever the composer is called.

### Q2: New literal location

| Option | Description | Selected |
|--------|-------------|----------|
| Local const inside `presentation/reload-hint.ts` | Private to composer file. `RELOAD_HINT_PREFIX` stays snapshot-test-only in markers.ts until Phase 13's atomic ES-5 edit. Cleanest separation. | ✓ |
| New constant in `shared/grammar/reload-hint.ts` | Promote to shared grammar constant. Consistent framing but over-extraction for a one-consumer constant. | |
| Add `RELOAD_HINT_TRAILER` to `shared/markers.ts` | Single 'markers' home for user-contract strings. Cost: mixes legacy ES-5 + v1.3 replacement in one file. | |

**User's choice:** Local const inside `presentation/reload-hint.ts`.

---

## Notify Wrapper Signature Evolution

### Q1: Wrapper signature evolution scope

| Option | Description | Selected |
|--------|-------------|----------|
| Keep four wrappers pure-string; Phase 13 builds composers | Wrappers stay `(ctx, message: string)`. Composition in `presentation/` in Phase 13. Cleanest layering; preserves D-07. | ✓ |
| Add `notifyCascadeSummary` 5th helper now | Phase 12 adds the helper that internally routes per MSG-SR-4..6. Blurs D-07 line between wrapper-as-severity-sink and composer. | |
| Widen four wrappers with optional structured payload arg | `notifySuccess(ctx, body, options?)`. Erodes four-wrapper minimalism; duplicates the `appendReloadHint` pattern. | |

**User's choice:** Keep four wrappers pure-string; Phase 13 builds composers.

### Q2: `notifyError` cause arg treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Leave `notifyError` signature + body untouched | Phase 12 = "lock API surface"; Phase 13 = "fix internal wrapper bodies." Cause arg position and type stay stable. | ✓ |
| Phase 12 also rewrites cause-trailer to MSG-CC-1 form | Pull cause-chain rewrite into Phase 12. Cost: changes user-visible error output beyond migrate.ts (and reload-hint). | |
| Drop the `cause` arg from `notifyError` | Forces eager cleanup. Cost: every `notifyError(ctx, msg, cause)` callsite needs inline change to stay compiling. | |

**User's choice:** Leave `notifyError` signature + body untouched.

---

## Migrate.ts Wording (CMC-36/37)

### Q1: §14.1 wording resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Roadmap wins — Phase 12 locks §14.1 bytes literally | Phase 12 writes proposed wording verbatim. Style guide §14.1 updated to remove the discretion sentence. Single source of truth re-established. | ✓ |
| Style guide wins — structural form only in Phase 12, Phase 13 finalizes bytes | Re-categorizes CMC-36 as partial Phase 12. Requires roadmap update. | |
| Phase 12 tightens wording now (one-pass polish) | Risks wording bikeshed during phase planning. | |

**User's choice:** Roadmap wins — Phase 12 locks §14.1 bytes literally.

### Q2: Style guide §14.1 edit timing

| Option | Description | Selected |
|--------|-------------|----------|
| Same Phase 12 commit/PR as migrate.ts rewrite | One atomic change keeps code and contract aligned. Drift-guard read consistency. | ✓ |
| Separate follow-up commit, still in Phase 12 scope | Same phase, two commits. Acceptable but less atomic. | |
| Defer style guide update to Phase 13 | Leaves §14.1 contradicting itself for a full phase window. | |

**User's choice:** Same Phase 12 commit/PR as migrate.ts rewrite.

---

## Open Issue Surfaced (not locked by user)

### REQUIREMENTS.md CMC-08 vs frontmatter `reinstalled`

Claude proposed a follow-up question about a doc inconsistency:

- REQUIREMENTS.md CMC-08 says the closed status-tokens set is the frontmatter PLUS `reinstalled` (15 tokens).
- Style-guide §3 frontmatter has exactly 14 tokens, no `reinstalled`.
- Roadmap Phase 12 success criterion #1 says "exactly the set in the style-guide frontmatter."

**User denied the question.** The inconsistency is flagged in CONTEXT.md under `<canonical_refs>` and `<deferred>` for the planner / researcher to reconcile during Phase 12 plan creation. Not locked here.

---

## Claude's Discretion

- **Plan decomposition.** Whether to split Phase 12 into 4, 5, or fewer plans. Recommended natural groupings noted in CONTEXT.md `<decisions>`.
- **YAML parser choice for the drift test.** `yaml` (modern, ESM, small) vs `js-yaml` (popular, larger) vs hand-rolled regex (single test, known shape). Planner decides.
- **Reload-hint test rewrite breadth.** D-CMC-09 specifies minimum; planner picks how many additional assertions.

---

## Deferred Ideas

- **REQUIREMENTS.md CMC-08 vs frontmatter `reinstalled` reconciliation** (see Open Issue above).
- **Shared frontmatter loader** — explicitly deferred to Phase 14 per D-CMC-04.
- **Cause-chain rewrite to MSG-CC-1 form** — explicitly Phase 13's work per D-CMC-12.
