# Phase 27: Marketplace & Autoupdate Output Grammar - Research

**Researched:** 2026-05-30
**Domain:** v2 `NotificationMessage` renderer grammar + closed-set tuples + byte-equality catalog contract (TypeScript strict, internal refactor, zero new deps)
**Confidence:** HIGH

## Summary

Phase 27 is a four-requirement operator-preference grammar refinement of the v2 `notify()` surface. All four reqs converge on `extensions/pi-claude-marketplace/shared/notify.ts` (the SOLE renderer), `docs/output-catalog.md` (the binding byte-contract), and the `tests/architecture/catalog-uat.test.ts` byte-equality gate. Three of the four (UXG-01, UXG-04, UXG-05) are renderer + catalog + test lockstep changes; UXG-06 is doc-only with one catalog-heading rename that has a hidden test-coupling consequence.

The dominant planning constraint is the **lockstep contract**: the catalog-uat driver (`catalog-uat.test.ts:1375`) parses every `<!-- catalog-state: STATE -->` fenced block out of `docs/output-catalog.md`, keys a `FIXTURES` map by the `##` section heading + state name, drives the fixture's `NotificationMessage` through the real `notify()`, and asserts byte-equality plus severity-arg shape. Any renderer byte-form change that lands without its matching catalog fenced-block edit (or vice versa) produces an immediate RED. Because the gate reads the live catalog at test time, renderer + catalog + fixture must change in the same commit.

A key de-risking discovery: the `MARKERS` closed-set tuple at `notify.ts:129` **already contains both `"autoupdate"` and `"no autoupdate"`** -- `<no autoupdate>` is already a legal closed-set member; it is simply never *emitted* today. `MARKERS`/`Marker` have **zero test consumers** (no test imports them) and the renderer emits `<autoupdate>` as a hardcoded string literal (`notify.ts:664`), not via the tuple. So UXG-04 adds no `MARKERS` members and has **no blast radius on `notify-types.test.ts`** (which only proofs `PLUGIN_STATUSES`/`MARKETPLACE_STATUSES`/`DEPENDENCIES` lengths) and **none on `markers-snapshot.test.ts`** (which snapshots only `shared/markers.ts` agent/recovery/lock constants, NOT the notify `MARKERS` tuple).

**Primary recommendation:** Land UXG-06 first (doc-only, unblocks the catalog-heading + FIXTURES-key coupling), then UXG-01 (smallest renderer change), then UXG-04 (the closed-set + dual-marker change with the most lockstep fixtures), then UXG-05 (the only req needing new orchestrator change-detection logic). Serialize all four within the phase because they all edit `notify.ts` and `docs/output-catalog.md` -- parallel waves would collide. UXG-04 introduces the only `MARKETPLACE_STATUSES` membership question; decide early whether `(autoupdate enabled)`/`(autoupdate disabled)`/idempotent-`skipped` statuses are *removed* from the tuple or *retained* (see Open Question 1).

<phase_requirements>
## Phase Requirements

| ID | Description (mapped to code, not restated) | Research Support |
|----|--------------------------------------------|------------------|
| UXG-01 | Drop `<last-updated <iso>>` from the list-surface header. | `renderMpHeader` SUB-BRANCH B, `notify.ts:665-666`; remove `lastUpdatedAt` token composition. `MarketplaceDetails.lastUpdatedAt?` field and state persistence stay. Lockstep set in §Lockstep Contract. |
| UXG-04 | Autoupdate flip renders `<autoupdate>`/`<no autoupdate>` markers (fresh) + `<autoupdate> {already autoupdate}` / `<no autoupdate> {already no autoupdate}` (idempotent), replacing `(autoupdate enabled/disabled)` and `(skipped) {already enabled/disabled}`. | New renderer arm for the flip-result surface; new emission of `<no autoupdate>` (already a `MARKERS` member); two new `REASONS` members `already autoupdate` / `already no autoupdate`; orchestrator payload rewrite in `autoupdate.ts`. See §UXG-04 Closed-Set Impact. |
| UXG-05 | `marketplace update` no-op renders `(skipped) {up-to-date}` not `(updated)`. | `update.ts:616-620` always emits `status: "updated"` for the autoupdate-OFF manifest-refresh path with `plugins: []`. Needs a "did anything actually change?" signal. See §UXG-05 Change Detection. |
| UXG-06 | Doc-only: github `marketplace add` never auto-enables autoupdate; catalog heading match `autoupdate`/`noautoupdate` verbs. | `add.ts` writes NO `autoupdate` field (verified L235-244, L311-320); only `bootstrap` enables it. Catalog L750 prose is wrong. Heading rename at catalog L843 has a FIXTURES-key coupling (see Pitfall 4). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| User-visible grammar emission (markers, status tokens, reasons) | `shared/notify.ts` renderer | -- | SNM-17: the `notify()` switch is the SOLE site that knows the grammar. Every byte form lives here. |
| Closed-set membership (`MARKERS`/`REASONS`/`MARKETPLACE_STATUSES`) | `shared/notify.ts` `as const` tuples | `notify-types.test.ts` (compile proof) | Tuples are the runtime carrier; derived literal-union types enforce at compile time. |
| Payload construction (which status/reasons/details a command emits) | `orchestrators/marketplace/{autoupdate,update,list}.ts` | -- | Orchestrators build `NotificationMessage`; they never compose strings. |
| "Did anything change?" detection (UXG-05) | `orchestrators/marketplace/update.ts` | `orchestrators/marketplace/shared.ts` (git `resolveRef`) | Change detection is orchestrator business logic, not a renderer concern. |
| Byte-contract spec | `docs/output-catalog.md` | `docs/messaging-style-guide.md` (closed-set pointer) | Catalog holds the byte forms; style guide points at the type model. |
| Byte-equality enforcement | `tests/architecture/catalog-uat.test.ts` | `tests/shared/notify-v2.test.ts`, `tests/orchestrators/marketplace/list.test.ts` | catalog-uat is the user-contract gate; the other two are per-variant locks. |

## Standard Stack

No new external packages. This is an internal refactor of existing TypeScript-strict code.

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| TypeScript | `^5.9.3` (existing) | Discriminated unions + `as const` literal-union closed sets | [CITED: CLAUDE.md tech-stack table] Already the project language; closed-set discipline is `(typeof X)[number]`. |
| node:test | bundled (Node ≥22) | Byte-equality + compile-proof tests | [CITED: CLAUDE.md] Existing test framework; no switch. |
| node:crypto (optional, UXG-05) | bundled | SHA comparison for change detection if a content-hash approach is chosen | [ASSUMED] Only if the manifest-content comparison route is selected (see Open Question 2). |

**Installation:** none.

## Package Legitimacy Audit

Not applicable -- this phase installs no external packages. All work is internal source edits within `extensions/pi-claude-marketplace/` and `docs/`. No `## Package Legitimacy Audit` table is required.

## Exact Code Locations Per Requirement

### UXG-01 -- Drop `<last-updated <iso>>` from `marketplace list`

**Renderer arm:** `renderMpHeader` `case undefined:` SUB-BRANCH B, `notify.ts:659-669`. The token is composed at:
```
const lastUpdatedToken =
  mp.details.lastUpdatedAt === undefined ? "" : `<last-updated ${mp.details.lastUpdatedAt}>`;  // notify.ts:665-666
return [ICON_INSTALLED, mp.name, `[${mp.scope}]`, autoupdateToken, lastUpdatedToken]              // notify.ts:667
  .filter((t) => t !== "")
  .join(" ");
```
**Change:** drop `lastUpdatedToken` from the join array; the `mp.details.autoupdate` token stays. [VERIFIED: notify.ts grep]

**Type/field disposition:** `MarketplaceDetails.lastUpdatedAt?` (`notify.ts:285`) and the state persistence (`state-io.ts:70`, 20 references across the extension) STAY -- REQUIREMENTS.md UXG-01 explicitly says "`MarketplaceDetails.lastUpdatedAt` may remain in state." `list.ts:74-88` still passes it through; it simply stops being rendered. This avoids touching `notify-types.test.ts:221-232` (the `_MarketplaceDetailsExpected` shape proof asserts `lastUpdatedAt?` is present -- leaving the field keeps that proof GREEN). [VERIFIED: REQUIREMENTS.md L14 + notify-types.test.ts]

**Doc-comment cleanup:** the `renderMpHeader` block-comment at `notify.ts:600-603` documents the dropped token and must be updated. The `notify-v2.test.ts` file-header mini-spec at L70 also references it.

### UXG-04 -- Autoupdate flip → `<autoupdate>` / `<no autoupdate>` markers

**Today's renderer arms** (`renderMpHeader`, `notify.ts:625-646`):
- `case "autoupdate enabled":` → `● <mp> [<scope>] (autoupdate enabled)` (L628)
- `case "autoupdate disabled":` → `● <mp> [<scope>] (autoupdate disabled)` (L632)
- `case "skipped":` → `● <mp> [<scope>] (skipped)` + optional `{<reasons>}` brace via `composeReasons` (L633-646)

**Today's orchestrator payload** (`autoupdate.ts:232-249`):
- fresh enable → `{ status: "autoupdate enabled", plugins: [] }`
- fresh disable → `{ status: "autoupdate disabled", plugins: [] }`
- idempotent → `{ status: "skipped", reasons: ["already enabled"|"already disabled"], plugins: [] }`

**Target byte forms (from REQUIREMENTS.md UXG-04):**
- fresh enable → `● <mp> [<scope>] <autoupdate>`
- fresh disable → `● <mp> [<scope>] <no autoupdate>`
- idempotent enable → `● <mp> [<scope>] <autoupdate> {already autoupdate}`
- idempotent disable → `● <mp> [<scope>] <no autoupdate> {already no autoupdate}`

**This is a marker-as-outcome form**, which the autoupdate.ts header-comment (L30-35) *currently forbids* ("the marker-as-outcome row form ... is NOT emitted by this orchestrator"). That comment must be inverted. This is exactly the design that Phase 17.1 / D-18-05 deliberately rejected in favor of the status tokens; UXG-04 reverses that decision. The planner should treat the inversion explicitly.

**Two implementation strategies (planner picks; see Open Question 1):**

*Strategy A -- reuse the `MarketplaceDetails` list-surface arm.* Route the flip result through `mp.status === undefined` + `details: { autoupdate: <bool> }`. The list-surface arm already emits `<autoupdate>` when `autoupdate === true`; extend SUB-BRANCH B so `autoupdate === false` emits `<no autoupdate>` (currently the false case emits nothing -- `notify.ts:664`). Then the idempotent `{already …}` brace needs the `mp.reasons` slot, which SUB-BRANCH B does not currently compose. This forces a structural decision: list-surface headers do not carry reasons today, so an idempotent flip can't be a pure list-surface header without adding a reasons composition to that arm.

*Strategy B -- keep dedicated flip-result arms but change their byte forms.* Keep `MarketplaceStatus` flip discriminators but rewrite the arm bodies to emit the marker form. e.g. an `"autoupdate enabled"` arm emits `<autoupdate>` and an `"autoupdate disabled"` arm emits `<no autoupdate>`; the idempotent path keeps `status: "skipped"` but the arm prepends the marker token before the brace (`<autoupdate> {already autoupdate}`). This is the lower-blast-radius option: it keeps `MARKETPLACE_STATUSES` membership intact and confines all change to arm bodies + the two new REASONS.

Strategy B is recommended: it isolates the change to renderer arm bodies + REASONS + the orchestrator's reasons array values, with no `MARKETPLACE_STATUSES` churn and no `notify-types.test.ts` length-lock edit.

**Closed-set deltas under Strategy B:**
- **`REASONS`** (`notify.ts:63-92`): the requirement's idempotent reasons are `already autoupdate` / `already no autoupdate`. The current members `already enabled` (L87) / `already disabled` (L88) are used ONLY by the autoupdate idempotent path (verified: only `autoupdate.ts:238` produces them; the catalog `enable-idempotent`/`disable-idempotent` fixtures consume them). Disposition: **rename** `already enabled` → `already autoupdate` and `already disabled` → `already no autoupdate`, OR **add** the two new and **remove** the two old. Either way it is a closed-set tuple edit; `REASONS`/`Reason` have a compile cascade only through `composeReasons` call sites that pass literals -- and the only literal producers are `autoupdate.ts:238`. Grep confirms no other producer references `"already enabled"`/`"already disabled"`. [VERIFIED: grep across extensions/]
- **`MARKERS`** (`notify.ts:129`): NO CHANGE. Both `"autoupdate"` and `"no autoupdate"` are already members. UXG-04 only changes whether `<no autoupdate>` is *emitted*. [VERIFIED: notify.ts:129]
- **`MARKETPLACE_STATUSES`** (`notify.ts:234-242`): NO CHANGE under Strategy B (arms keep their discriminators, byte forms change). Under Strategy A, `"autoupdate enabled"`/`"autoupdate disabled"`/possibly `"skipped"` could be removed -- which WOULD require editing `notify-types.test.ts:119-123` (length-lock `7`) and `:152-166` (`_MarketplaceStatusExpected`) plus the style guide pointer at `messaging-style-guide.md:27,52`. This is the primary reason to prefer Strategy B.

**`<no autoupdate>` conflict with the catalog (Pitfall -- see §Common Pitfalls):** the catalog currently states three times (L29, L80, L845) that "`<no autoupdate>` is not emitted by `notify()`." UXG-04 makes it emitted on the flip surface. The catalog autoupdate-marker prose at L78-80 and the marketplace-list note at L29 must be reconciled: `<no autoupdate>` is now emitted on the flip-result surface but the *list* surface still conveys autoupdate-off by marker absence (UXG-04 does not change the list surface). Be precise about which surface emits which.

### UXG-05 -- `marketplace update` no-op → `(skipped) {up-to-date}`

**Today's logic** (`update.ts:565-641`, function `refreshOneMarketplace`):
- autoupdate OFF (or `pluginUpdate === undefined`): `update.ts:616-620` unconditionally emits `{ name, scope, status: "updated", plugins: [] }`. This is the `autoupdate-off-manifest-refresh` catalog state (`catalog-uat.test.ts:1237`, catalog L808-812). This always says `(updated)` even when nothing changed.
- autoupdate ON: `update.ts:631-640` emits `{ status: "updated", plugins: outcomes.map(...) }` where per-plugin `unchanged` outcomes already render `⊘ … (skipped) {up-to-date}` via `outcomeToCascadePluginMessage` `case "unchanged"` (`update.ts:440-448`).

**The gap is the autoupdate-OFF path.** A manifest-only refresh (`snapshotAfterRefresh` → `refreshRecord`, `update.ts:240-273`) re-validates the manifest and stamps `record.lastUpdatedAt = now` (L262) but does **not** track whether the manifest content actually changed. There is no current signal distinguishing "refreshed, nothing changed" from "changed."

**Signals available to add a change detector:**
1. **Git SHA comparison (github sources):** `refreshGitHubClone` (`shared.ts:137`) uses `resolveRef` which returns a SHA (`shared.ts:87`). Capture the clone HEAD SHA *before* the fetch/forceUpdateRef and compare *after*; equal SHA ⇒ no upstream change. The `onFetchSucceeded` callback already exists as a hook seam (`update.ts:250-252`, sets `cloneAdvanced`). [VERIFIED: shared.ts grep]
2. **Manifest-content comparison (both sources):** `loadMarketplaceManifest` (`manifest.ts:48`) returns the parsed `MarketplaceManifest`. Read the manifest before refresh, read after, compare (deep-equal or a stable JSON hash via `node:crypto`). Differs ⇒ changed. Works for path sources too (which have no git SHA). [VERIFIED: manifest.ts]
3. **lastUpdatedAt is NOT a usable signal** -- it's stamped to `now` on every refresh regardless of content (`update.ts:262`), so it always "changes." Do not key off it.

**Interaction with reload-hint discipline (G-MIL-06 / SNM-33):** the autoupdate-OFF path already emits NO `/reload` trailer because `shouldEmitReloadHint` (`notify.ts:1104-1119`) fires only on a plugin row with a state-change status, and this payload has `plugins: []`. UXG-05 is **orthogonal to reload-hint** -- it only changes the marketplace-header status token from `(updated)` to `(skipped)` and adds the `{up-to-date}` reason. Severity: `status: "skipped"` routes to `warning` via `computeSeverity` (`notify.ts:1066-1073`); the catalog fixture must set `expectedSeverity: "warning"`. (NOTE: this `warning` routing for a benign skip is exactly what UXG-02 in Phase 28 will later soften to `info` -- Phase 27 should emit `warning` to stay consistent with the current ladder, and Phase 28 handles the benign-skip severity refinement. Do NOT pre-empt UXG-02.)

**Recommended approach:** manifest-content comparison (#2) because it covers both source kinds uniformly and needs no git-layer plumbing. The "changed" path keeps `status: "updated"`; the "unchanged" path emits `{ name, scope, status: "skipped", reasons: ["up-to-date"], plugins: [] }`. Note `"up-to-date"` is already a `REASONS` member (`notify.ts:64`). The marketplace-level `skipped` arm already exists (`renderMpHeader` `case "skipped":`, `notify.ts:633-646`) and already renders `(skipped) {<reason>}` -- so this needs NO new renderer arm, only the orchestrator decision + a new catalog state + fixture. [VERIFIED: notify.ts:633-646 + REASONS:64]

### UXG-06 -- Doc-only catalog correction + heading rename

**Verified behavior:** `add.ts` writes NO `autoupdate` field for either source kind -- github at `add.ts:235-244`, path at `add.ts:311-320`. Only `bootstrap` enables autoupdate (catalog L682 confirms "Bootstrap also enables autoupdate"). [VERIFIED: add.ts grep]

**Catalog fixes:**
1. `docs/output-catalog.md:750` (`github-source` prose): "GitHub-source marketplaces default to autoupdate ON; the persisted record stores `autoupdate: true`" is FALSE. Correct to: github `add` never enables autoupdate; opt-in via `bootstrap` or explicit `marketplace autoupdate`. The byte form of the `github-source` fenced block (L747, `● claude-plugins-official [user] (added)`) is already correct and does NOT change -- only the prose. [VERIFIED: catalog L744-750]
2. `docs/output-catalog.md:843` heading `## /claude:plugin marketplace autoupdate <enable|disable> <name>` should match the real edge verbs `autoupdate` / `noautoupdate` (router.ts:74-75, 179-182; there is no `disable` subcommand -- it's `noautoupdate`). [VERIFIED: router.ts]

**HIDDEN COUPLING (critical):** the catalog-uat driver keys `FIXTURES` by the `##` heading text (`catalog-uat.test.ts:1285` key is the literal string `"/claude:plugin marketplace autoupdate <enable|disable> <name>"`). If UXG-06 renames the catalog heading, the `FIXTURES` map key at `catalog-uat.test.ts:1285` MUST change byte-identically in the same commit, or the driver reports `missing-fixture` for every autoupdate state (`catalog-uat.test.ts:1396-1413`). This makes UXG-06 NOT purely doc-only -- it has a test edit. Because UXG-04 also rewrites these same autoupdate fixtures, sequencing UXG-06 and UXG-04 together (or UXG-06 first) avoids double-touching the heading/key. [VERIFIED: catalog-uat.test.ts:1285 + driver L1395]

## UXG-04 Closed-Set Impact (consolidated)

| Closed set | Location | Δ under Strategy B (recommended) | Blast radius |
|------------|----------|----------------------------------|--------------|
| `MARKERS` | notify.ts:129 | NONE (`<no autoupdate>` already a member) | NONE -- no test imports `MARKERS`; renderer emits string literals, not tuple values. |
| `REASONS` | notify.ts:63-92 | rename/replace `already enabled`/`already disabled` → `already autoupdate`/`already no autoupdate` | Only producer is `autoupdate.ts:238`; only consumers are the idempotent catalog fixtures. Type cascade through `Reason` is satisfied by editing those two literals. |
| `MARKETPLACE_STATUSES` | notify.ts:234-242 | NONE under Strategy B | Strategy A would force `notify-types.test.ts:119-123` length-lock + `:152-166` membership edits + style-guide pointer edits. Avoid. |
| `PLUGIN_STATUSES` | notify.ts:211-223 | NONE | -- |

**`notify-types.test.ts` blast radius under Strategy B: NONE.** That test does not reference `REASONS`, `MARKERS`, `STATUS_TOKENS`, or `PATTERN_CLASSES` at all (verified by grep -- it only proofs `PLUGIN_STATUSES`/`MARKETPLACE_STATUSES`/`DEPENDENCIES` and per-variant field discipline). A `REASONS` rename does not touch it. [VERIFIED: notify-types.test.ts grep returned no matches for REASONS/MARKERS/STATUS_TOKENS]

**`markers-snapshot.test.ts` blast radius: NONE.** That test snapshots `GENERATED_AGENT_MARKER`, `RECOVERY_PLUGIN_REINSTALL_PREFIX`, `STATE_LOCK_HELD_PREFIX` from `shared/markers.ts` and a locations sentinel -- it has NOTHING to do with the notify `MARKERS` tuple. [VERIFIED: markers-snapshot.test.ts full read]

## The Lockstep Contract (dominant planning constraint)

The catalog-uat gate reads `docs/output-catalog.md` at test time and drives each fenced block through `notify()`. For each requirement, the following files must change in **one commit** to avoid an intermediate RED:

| Req | `notify.ts` renderer | `docs/output-catalog.md` | `catalog-uat.test.ts` fixture | `notify-v2.test.ts` byte test | Other |
|-----|---------------------|--------------------------|-------------------------------|-------------------------------|-------|
| UXG-01 | drop `lastUpdatedToken` (L665-667) + comment L600-603 | table L27, prose L29/L698/L724, `mixed-scopes` block L715 | `mixed-scopes` fixture L1134 (drop `lastUpdatedAt`) | L664-686 (drop the `<last-updated>` assertion) + mini-spec L70 | `tests/orchestrators/marketplace/list.test.ts:154-189` (the dedicated `<last-updated>` test) |
| UXG-04 | flip-result arms L625-646 + comment L30-35 | autoupdate section L843-897 (5 state blocks) + marker prose L29/L78-80 | autoupdate fixtures L1286-1338 (4 of 5 byte forms + reasons) | autoupdate tests L539-600 | `autoupdate.ts:232-249` payload + header comment L1-56 |
| UXG-05 | NONE (reuses `skipped` arm L633-646) | new `update` no-op state block near L806-814 | `update` section L1236+ (new "no-op-skipped" fixture; possibly retire/repurpose `autoupdate-off-manifest-refresh`) | new byte test mirroring L823 | `update.ts:565-641` change detector + L1-56 header comment |
| UXG-06 | NONE | github prose L750 + heading L843 | FIXTURES key L1285 (must match renamed heading) | NONE | `router.ts` usage strings already correct (no change) |

**Why one commit per req, not one big commit:** each req has an independent fixture set, so per-req atomic commits keep the GREEN gate verifiable at each boundary. But the per-req commit is itself a multi-file lockstep edit. The `catalog-uat.test.ts` driver requires `examples.length >= 30` (L1379) so removing a catalog state without a fixture (or vice versa) fails the count or reports `missing-fixture`.

## Runtime State Inventory

This is a renderer/grammar refactor -- but UXG-05 touches persisted-record refresh logic, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `MarketplaceDetails.lastUpdatedAt` persisted in `state.json` (`state-io.ts:70`). UXG-01 stops RENDERING it but UXG-01 keeps it in state. | None -- no data migration. Field stays; only renderer stops emitting. |
| Stored data | `record.autoupdate?: boolean` persisted (`state-io.ts:71`). UXG-04 changes how the flip RESULT renders, not the stored value semantics. | None -- `applyAutoupdateFlipInPlace` (`shared.ts:379`) still writes `record.autoupdate = enable`. |
| Live service config | None -- pi-claude-marketplace has no external service registrations relevant to grammar. | None -- verified: no n8n/Datadog/Task-Scheduler analog in this repo. |
| OS-registered state | None. | None. |
| Secrets/env vars | None -- no secret-keyed strings touched. | None. |
| Build artifacts | None -- TypeScript stripped at runtime (Node ≥22.18); no compiled artifacts carry these strings. | None. |

**Canonical question -- after all files are edited, what runtime state still carries the old byte forms?** Nothing user-persisted: the dropped `<last-updated>` and the old `(autoupdate enabled)` byte forms exist only at render time. `state.json` records are unaffected. UXG-05's change detector reads (not writes) manifest content; `record.lastUpdatedAt` keeps being stamped on every refresh (intentional, used elsewhere).

## Architecture Patterns

### Renderer-emission-is-the-sole-grammar-site (SNM-17)
**What:** every byte form is produced by the `notify()` switch in `shared/notify.ts`; orchestrators build typed payloads only.
**When to use:** every UXG req. Never add a string literal in an orchestrator.
**Example:** UXG-05's "unchanged" path is an orchestrator *decision* (`status: "skipped"` vs `"updated"`) -- the `(skipped) {up-to-date}` bytes come from the existing `renderMpHeader` `skipped` arm.

### Closed-set `as const` tuple + derived literal-union
**What:** `export const REASONS = [...] as const; export type Reason = (typeof REASONS)[number];`
**When to use:** UXG-04's reason additions. Adding/renaming a member is a tuple edit; the `Reason` type updates automatically; producers passing the old literal become compile errors.
**Anti-pattern to avoid:** emitting a marker/reason as a raw string outside the closed set -- `composeReasons` types its accumulator as `Reason[]`, so out-of-set strings fail typecheck at the call site (`notify.ts:818-824`).

### Catalog-state fixture pairing
**What:** every `<!-- catalog-state: STATE -->` block in the catalog must have a matching `FIXTURES[section][state]` entry; the section key is the `##` heading text verbatim.
**When to use:** every req that adds/removes/renames a catalog state OR a heading (UXG-04, UXG-05, UXG-06).

### Anti-patterns to avoid
- **Editing the renderer byte form without the catalog block** → instant byte-mismatch RED (`catalog-uat.test.ts:1429`).
- **Renaming a catalog heading without the FIXTURES key** → `missing-fixture` RED for every state under that heading.
- **Pre-empting UXG-02** (Phase 28): do NOT change benign-skip severity routing in this phase. UXG-05's `{up-to-date}` mp-skip routes `warning` here.
- **Expanding `MARKETPLACE_STATUSES`** when Strategy B avoids it -- unnecessary `notify-types.test.ts` churn.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reasons-brace composition for the idempotent flip | A new brace-formatter | `composeReasons` (`notify.ts:818`) -- already used by the mp `skipped` arm | Single canonical `{<r>, <r>}` formatter; handles empty-collapse + soft-dep injection. |
| mp-level `(skipped) {reason}` rendering for UXG-05 | A new renderer arm | Existing `renderMpHeader` `case "skipped":` (`notify.ts:633-646`) | Already emits `● <mp> [<scope>] (skipped) {<reason>}`. Only the orchestrator decision is new. |
| `<no autoupdate>` marker | A new MARKERS entry | Already present at `notify.ts:129` | The member exists; only emission is missing. |
| Manifest deep-compare for UXG-05 | Field-by-field diff | `JSON.stringify` of the validated `MarketplaceManifest` (stable key order from typebox) or `node:crypto` SHA of the raw file bytes | Whole-manifest equality is the correct grain; per-field diffing is over-engineered for a no-op detector. |

**Key insight:** three of UXG-04/05's renderer needs are already-built (the `skipped` arm, `composeReasons`, the `no autoupdate` marker member). The genuinely new work is (a) UXG-04 flip-arm byte-form rewrite + 2 reason renames + orchestrator payload, (b) UXG-05 change-detection logic in `update.ts`.

## Common Pitfalls

### Pitfall 1: The catalog's "`<no autoupdate>` is not emitted" prose vs. UXG-04
**What goes wrong:** UXG-04 makes `<no autoupdate>` emitted on the flip surface, but the catalog says three times (L29, L80, L845) it is "not emitted by `notify()`." Leaving that prose creates a contradiction that a reviewer (or the user) will flag.
**Why it happens:** the marker was reserved as a `MARKERS` member in Phase 17.1 but deliberately never emitted; the catalog documented the non-emission as a contract.
**How to avoid:** in the UXG-04 commit, rewrite L29/L78-80/L845 to scope the statement: `<no autoupdate>` is now emitted on the **flip-result** surface (`marketplace autoupdate`/`noautoupdate`), while the **list** surface still conveys autoupdate-off by marker absence (UXG-04 does not change the list surface). Be surface-precise.
**Warning signs:** a catalog grep for "not emitted" returning the autoupdate prose after the UXG-04 edit.

### Pitfall 2: catalog-uat byte-equality gate is whitespace- and token-exact
**What goes wrong:** a stray double-space (from a non-collapsed empty join slot) or a missing/extra token fails `catalog-uat.test.ts:1429` with a byte diff.
**Why it happens:** `joinTokens`/the `.filter(t => t !== "").join(" ")` discipline collapses empty slots; if a new token is added without an empty-slot guard, a `false` autoupdate could leave a gap.
**How to avoid:** for UXG-04 fresh-disable, ensure the `<no autoupdate>` token is non-empty in the disable arm; for UXG-01, ensure dropping `lastUpdatedToken` from the join array (not just emptying it) so no trailing space remains. Mirror the existing `.filter`/`joinTokens` pattern.
**Warning signs:** `[BYTE MISMATCH]` output showing identical-looking strings (the diff is whitespace).

### Pitfall 3: heading rename desyncs the FIXTURES key (UXG-06)
**What goes wrong:** renaming the catalog `##` heading at L843 without updating `catalog-uat.test.ts:1285` makes the driver report `missing-fixture` for all 5 autoupdate states.
**Why it happens:** the driver derives the section name from the heading text (`catalog-uat.test.ts` `loadCatalogExamples`), so the FIXTURES key is the heading-string literal.
**How to avoid:** treat UXG-06 as a doc + 1-line-test change; rename heading and key byte-identically in the same commit.
**Warning signs:** `[MISSING FIXTURE] section=… state=…` for every autoupdate state.

### Pitfall 4: UXG-05 change detection keyed off `lastUpdatedAt` (wrong signal)
**What goes wrong:** `record.lastUpdatedAt` is stamped to `now` on every refresh (`update.ts:262`) regardless of content, so keying "changed?" off it makes everything look changed → no-op never detected.
**Why it happens:** `lastUpdatedAt` reads like a change-timestamp but is a refresh-timestamp.
**How to avoid:** key change detection off manifest content (pre/post compare) or git SHA, never `lastUpdatedAt`.
**Warning signs:** the no-op fixture still renders `(updated)`.

### Pitfall 5: `MARKETPLACE_STATUSES` length-lock RED (only under Strategy A)
**What goes wrong:** removing `"autoupdate enabled"`/`"autoupdate disabled"`/`"skipped"` from `MARKETPLACE_STATUSES` (Strategy A) fails `notify-types.test.ts:119-123` (length must be 7) and `:152-166` (exact membership) and `assertNever` in `renderMpHeader`.
**How to avoid:** use Strategy B (retain discriminators, change arm bodies) -- zero `MARKETPLACE_STATUSES` churn.
**Warning signs:** typecheck failure on `_Assert_MarketplaceStatusesLen` / `_Assert_MarketplaceStatusValues`.

## Code Examples

### Closed-set REASONS edit (UXG-04, Strategy B)
```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:87-88 (current)
//   "already enabled",
//   "already disabled",
// After UXG-04 (rename in place; preserves closed-set length):
//   "already autoupdate",
//   "already no autoupdate",
// Producer that must change in lockstep: orchestrators/marketplace/autoupdate.ts:238
//   reasons: [opts.enable ? "already autoupdate" : "already no autoupdate"],
```

### Existing mp-skipped arm reused by UXG-05 (no renderer change)
```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:633-646
case "skipped": {
  const reasonsBrace = composeReasons(mp.reasons, false, false, probe);
  return reasonsBrace === ""
    ? `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (skipped)`
    : `${ICON_INSTALLED} ${mp.name} [${mp.scope}] (skipped) ${reasonsBrace}`;
}
// UXG-05 orchestrator decision (update.ts:616-620, the autoupdate-OFF branch):
//   if (!manifestChanged) {
//     notify(ctx, pi, { marketplaces: [{ name, scope, status: "skipped",
//                                        reasons: ["up-to-date"], plugins: [] }] });
//   } else {
//     notify(ctx, pi, { marketplaces: [{ name, scope, status: "updated", plugins: [] }] });
//   }
```

### UXG-01 join-array edit (drop the token, not empty it)
```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:667 (current)
return [ICON_INSTALLED, mp.name, `[${mp.scope}]`, autoupdateToken, lastUpdatedToken]
  .filter((t) => t !== "").join(" ");
// After UXG-01 (remove lastUpdatedToken from the array entirely):
return [ICON_INSTALLED, mp.name, `[${mp.scope}]`, autoupdateToken]
  .filter((t) => t !== "").join(" ");
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Autoupdate flip → `(autoupdate enabled)` status token | (UXG-04) flip → `<autoupdate>`/`<no autoupdate>` marker | Phase 27 (this) | Reverses the Phase 17.1 / D-18-05 status-token design; the `autoupdate.ts:30-35` "marker-not-emitted" comment inverts. |
| `marketplace update` no-op → `(updated)` | (UXG-05) no-op → `(skipped) {up-to-date}` | Phase 27 | Mirrors plugin-level no-op; needs new change detection. |
| List shows `<last-updated <iso>>` | (UXG-01) marker dropped | Phase 27 | List surface loses the ISO timestamp token; field stays in state. |
| Catalog claims github `add` defaults autoupdate ON | (UXG-06) corrected: never auto-enabled | Phase 27 | Doc-only; byte form unchanged. |

**Deprecated/outdated by this phase:**
- The `<no autoupdate> is not emitted` contract prose (catalog L29/L80/L845) -- superseded for the flip surface.
- The `already enabled`/`already disabled` REASONS members (replaced by `already autoupdate`/`already no autoupdate` under Strategy B).

## Validation Architecture

> nyquist_validation: true (config.json) -- section included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node ≥22) |
| Config file | none (run via `npm run check` → typecheck + ESLint + Prettier + `node --test`) |
| Quick run command | `node --test tests/shared/notify-v2.test.ts tests/architecture/catalog-uat.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior (observable signal) | Test Type | Automated Command | File Exists? |
|--------|------------------------------|-----------|-------------------|-------------|
| UXG-01 | list header has NO `<last-updated …>` token | byte-equality | `node --test tests/shared/notify-v2.test.ts` (edit L664-686 assertion) | ✅ edit existing |
| UXG-01 | catalog `mixed-scopes` block byte-equal w/o `<last-updated>` | catalog-uat | `node --test tests/architecture/catalog-uat.test.ts` (edit `mixed-scopes` fixture L1134) | ✅ edit existing |
| UXG-01 | orchestrator-level list render w/o `<last-updated>` | orchestrator | `node --test tests/orchestrators/marketplace/list.test.ts` (rewrite L154-189) | ✅ edit existing |
| UXG-04 | fresh enable → `● foo [user] <autoupdate>` | byte-equality | notify-v2.test.ts L539 (rewrite) + catalog-uat `enable-fresh` fixture L1286 | ✅ edit existing |
| UXG-04 | fresh disable → `● foo [user] <no autoupdate>` | byte-equality | notify-v2.test.ts L553 + catalog-uat `disable-fresh` L1293 | ✅ edit existing |
| UXG-04 | idempotent enable → `● foo [user] <autoupdate> {already autoupdate}` (warning) | byte+severity | notify-v2.test.ts L567 + catalog-uat `enable-idempotent` L1300 (`expectedSeverity: "warning"`) | ✅ edit existing |
| UXG-04 | idempotent disable → `● foo [user] <no autoupdate> {already no autoupdate}` (warning) | byte+severity | catalog-uat `disable-idempotent` L1316 | ✅ edit existing |
| UXG-04 | `autoupdate.ts` emits the new payload reasons | orchestrator | `node --test tests/orchestrators/marketplace/autoupdate*.test.ts` | ⚠️ verify exists (Wave 0 check) |
| UXG-05 | no-op update → `● <mp> [<scope>] (skipped) {up-to-date}`, NO `/reload`, warning | byte+severity+trailer-absent | new test in notify-v2.test.ts (mirror L823 negative-trailer pattern) + new catalog-uat fixture | ✅ existing files; new cases |
| UXG-05 | changed update still → `(updated)` | orchestrator | `node --test tests/orchestrators/marketplace/update*.test.ts` (change-detector unit test) | ⚠️ verify exists |
| UXG-06 | catalog prose + heading; FIXTURES key matches | catalog-uat (missing-fixture guard) | `node --test tests/architecture/catalog-uat.test.ts` | ✅ edit existing |

### Sampling Rate
- **Per task commit:** `node --test tests/shared/notify-v2.test.ts tests/architecture/catalog-uat.test.ts tests/architecture/notify-types.test.ts`
- **Per wave merge:** `npm run check`
- **Phase gate:** `npm run check` GREEN before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] Confirm an orchestrator-level test file exists for `autoupdate.ts` and `update.ts` (`tests/orchestrators/marketplace/autoupdate*.test.ts`, `update*.test.ts`) -- needed to lock UXG-04 payload + UXG-05 change-detector at the orchestrator boundary. If absent, add minimal payload-shape tests.
- [ ] No framework install needed (node:test bundled).
*(The renderer-level byte locks and the catalog-uat gate already exist and only need edits.)*

## Environment Availability

> Phase is code/doc-only with no new external dependencies.

Step 2.6: SKIPPED for external tooling. The only runtime dependencies are Node ≥22 (present, project baseline) and the existing dev toolchain (`npm run check`). UXG-05's change detector uses `node:crypto` and `node:fs` (both bundled) if the content-hash route is chosen -- no install.

## Security Domain

> security_enforcement not present in config.json → treat as enabled. This phase is grammar/doc only.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | marginal | Manifest content is already validated via typebox `MARKETPLACE_VALIDATOR` (`manifest.ts:52`); UXG-05 reads already-validated content. No new untrusted-input surface. |
| V6 Cryptography | marginal | If UXG-05 uses a SHA for manifest comparison, use `node:crypto` SHA-256 (already the project's hash primitive per PI-7) -- never hand-roll. Hash is for change detection only, not security. |
| All others | no | No auth/session/access-control/secret surface touched by a renderer refactor. |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Marketplace.json content read for diff | Tampering | Already mitigated: `loadMarketplaceManifest` validates schema before the value is consumed (`manifest.ts:48-61`). UXG-05 must compare only post-validation parsed content. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | UXG-05 manifest-content comparison is the preferred change-detection route (vs. git SHA) | UXG-05 Change Detection | LOW -- both routes are viable; content-compare is source-kind-uniform. Planner/discuss may prefer SHA for github. Surfaced as Open Question 2. |
| A2 | Strategy B (retain `MARKETPLACE_STATUSES`, rewrite arm bodies) is preferred for UXG-04 | UXG-04 | MEDIUM -- if the user/discuss prefers routing flips through the list-surface arm (Strategy A), `MARKETPLACE_STATUSES` shrinks and `notify-types.test.ts` length-lock edits are required. Surfaced as Open Question 1. |
| A3 | `node:crypto` is only needed if the SHA route is chosen for UXG-05 | Standard Stack | LOW -- content deep-equal needs no crypto. |
| A4 | Orchestrator-level tests for `autoupdate.ts`/`update.ts` exist | Validation Architecture | LOW -- Wave 0 verifies; if absent, add minimal tests. |

## Open Questions

1. **UXG-04 implementation strategy: dedicated flip arms (B) vs. list-surface reuse (A)?**
   - What we know: Strategy B isolates the change to arm bodies + 2 REASONS + the orchestrator payload, with zero `MARKETPLACE_STATUSES`/`notify-types.test.ts` churn. Strategy A unifies the flip surface with the list surface but needs a reasons slot on the list arm and `MARKETPLACE_STATUSES` shrinkage.
   - What's unclear: REQUIREMENTS.md UXG-04 says the change "unif[ies] the `marketplace autoupdate` flip output with the `marketplace list` surface" -- which *reads* like Strategy A intent, but the idempotent `{already …}` brace is not expressible on the current list arm.
   - Recommendation: Strategy B for lowest blast radius; raise the "unify with list surface" wording in discuss-phase to confirm the user wants byte-form parity (both emit `<autoupdate>`/`<no autoupdate>`) rather than literal arm-sharing. Byte-form parity is achievable under B.

2. **UXG-05 change detection: manifest content-compare or git SHA?**
   - What we know: content-compare works for both source kinds; git SHA only for github but is cheaper for github.
   - What's unclear: whether path-source `marketplace update` no-ops are common enough to require uniform handling (they are -- path sources never advance, so they are *always* no-ops unless the local file changed).
   - Recommendation: content-compare (uniform, correct for path sources). Confirm in discuss-phase.

3. **UXG-05 fate of the `autoupdate-off-manifest-refresh` catalog state.**
   - What we know: that state (catalog L808, fixture L1237) currently asserts `(updated)` for the no-op path -- which UXG-05 makes wrong.
   - Recommendation: repurpose it into two states -- `update-no-op-skipped` (`(skipped) {up-to-date}`) and a `manifest-refresh-changed` (`(updated)`) -- or rename the existing block. Keep `examples.length >= 30` satisfied.

## Sources

### Primary (HIGH confidence)
- `extensions/pi-claude-marketplace/shared/notify.ts` (full read) -- renderer arms, closed-set tuples, `composeReasons`, `shouldEmitReloadHint`, `computeSeverity`.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{autoupdate,update,list,add}.ts` (full read) -- payload construction + the UXG-05 refresh path + UXG-06 no-autoupdate-write verification.
- `tests/architecture/catalog-uat.test.ts` (driver + autoupdate/list/update fixtures) -- lockstep gate mechanics + FIXTURES-key coupling.
- `tests/architecture/notify-types.test.ts` (full read) -- closed-set blast-radius analysis (no REASONS/MARKERS reference).
- `tests/architecture/markers-snapshot.test.ts` (full read) -- confirmed it does NOT snapshot the notify MARKERS tuple.
- `tests/shared/notify-v2.test.ts` (autoupdate + list-surface tests) -- byte-assertion edit targets.
- `docs/output-catalog.md` (autoupdate/list/update/add sections) -- byte forms + `<no autoupdate>`-not-emitted prose.
- `docs/messaging-style-guide.md` (full read) -- closed-set authority pointer.
- `.planning/REQUIREMENTS.md` (UXG-01/04/05/06 exact target byte forms), `.planning/ROADMAP.md` (Phase 27 success criteria), `.planning/v1.4-MILESTONE-UAT.md` (findings 1/4/5/6 operator-observed output).
- Grep verifications: `MARKERS` already contains `no autoupdate`; `already enabled/disabled` only produced by `autoupdate.ts:238`; FIXTURES key = heading literal at `catalog-uat.test.ts:1285`.

### Secondary (MEDIUM confidence)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (grep) -- `applyAutoupdateFlipInPlace`, `refreshGitHubClone`/`resolveRef` SHA availability for UXG-05.
- `extensions/pi-claude-marketplace/domain/manifest.ts` -- `loadMarketplaceManifest` returns parsed `MarketplaceManifest` (UXG-05 content-compare seam).
- `extensions/pi-claude-marketplace/edge/router.ts` -- `autoupdate`/`noautoupdate` verb truth for UXG-06.

### Tertiary (LOW confidence)
- None -- all claims verified against source or catalog.

## Metadata

**Confidence breakdown:**
- Code locations per req: HIGH -- every file:line verified by direct read/grep.
- Closed-set blast radius: HIGH -- confirmed `MARKERS` pre-contains `no autoupdate`, no test imports it, `notify-types.test.ts` does not reference REASONS/MARKERS.
- Lockstep contract: HIGH -- driver mechanics read directly from `catalog-uat.test.ts`.
- UXG-05 change detection: MEDIUM -- the signal options are verified available, but the chosen approach is a design decision for discuss-phase.

**Research date:** 2026-05-30
**Valid until:** 2026-06-29 (stable internal codebase; 30-day window)
