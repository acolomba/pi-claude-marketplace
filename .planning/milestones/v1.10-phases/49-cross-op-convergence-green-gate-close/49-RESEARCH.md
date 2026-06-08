# Phase 49: Cross-Op Convergence & GREEN-Gate Close - Research

**Researched:** 2026-06-07
**Domain:** Internal verification + milestone closure (TypeScript strict; structured notify model; byte-locked catalog UAT). NO new requirement closure.
**Confidence:** HIGH (all findings verified by reading the live source + running the suite; no external libraries involved)

## Summary

Phase 49 is the v1.10 capstone: it must PROVE that the audit's Class C cross-op
inconsistency is closed across the full plugin + marketplace op matrix, then close the
milestone GREEN with the catalog UAT byte-locked and traceability reconciled. Phases 46-48
already landed the per-op fixes; this phase's only NEW production code is (a) a dedicated
cross-op convergence test, (b) at most a small residual convergence fix, and (c)
doc/traceability reconciliation.

The central finding: **the convergence is NOT yet literally complete.** Five of the six ops
named in SC#1 converge on `info`'s canonical `⊘ <name> [scope?] (failed) {not added}` form
for the marketplace-absent precondition -- `install`, `uninstall`, `reinstall`, `update`
(plugin `@<mp>` and `<plugin>@<mp>` forms), `marketplace remove`, and `autoupdate`. The ONE
op that does NOT converge is **`marketplace update <missing-mp>`** (the marketplace-form
update, distinct from the plugin-update `@<mp>` form). It still throws `MarketplaceNotFoundError`
raw past the orchestrator boundary -- exactly the Theme 2 / Class C violation the audit
flagged for `remove`/`update` -- because neither `updateMarketplace` nor its edge handler
catches and re-routes that error to the `marketplace-not-added` variant the way `remove.ts`
and `autoupdate.ts` already do.

SC#2 (REASONS one-vocabulary), SC#3 (catalog byte-lock), SC#4 (`npm run check` GREEN at
1502 tests), and SC#5 (traceability) are all in good shape today. SC#2 and SC#5 require no
code change. SC#3 has one structural soft-spot worth a small hardening (orphan-fixture
detection). SC#4 is GREEN now and will stay GREEN if the convergence fix is byte-additive.

**Primary recommendation:** Close `marketplace update <missing-mp>` with a small,
`remove.ts`-mirrored convergence fix so SC#1 is literally true; add ONE dedicated cross-op
convergence test that drives the marketplace-absent precondition across all six ops and
asserts byte-identity against `info`'s `{not added}` form; close the two Phase-48-IN-02 /
Phase-47-IN-02 read-vs-write asymmetries per the per-item recommendations below; accept
Phase 47 IN-01 (perf, out of scope). Reconcile the catalog + traceability docs and gate GREEN.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cross-op convergence proof | Test (architecture) | -- | A single architecture-level matrix test owns the Class-C-closed assertion; it drives `notify()`/orchestrators through mock ctx, no disk/network |
| Marketplace-absent attribution | Orchestrator (`orchestrators/{plugin,marketplace}`) | shared/notify.ts (renderer) | Orchestrators detect the precondition and construct the `marketplace-not-added` variant; the renderer owns the byte form |
| Canonical reason vocabulary | shared/notify.ts (`REASONS` tuple) | tests/architecture/notify-types.test.ts | Closed-set source of truth lives in notify.ts; the length-lock proof guards it |
| Byte-form contract | docs/output-catalog.md | tests/architecture/catalog-uat.test.ts | The catalog is the normative spec; the UAT runner is the byte-equality gate |
| Traceability | .planning/REQUIREMENTS.md | -- | The requirement→phase table is the closure ledger |

## Standard Stack

No new libraries. This is an internal verification/closure phase on the existing stack
(Node `node:test`, TypeScript strict, the in-repo `notify()` renderer). No `## Standard
Stack` / `## Package Legitimacy Audit` actions are required because **this phase installs no
external packages**. Confirmed: `package.json` `check` script is
`typecheck && lint && format:check && test`; `test` runs `node --test` over
`tests/{architecture,...}/**/*.test.ts` (tests live at repo root, NOT under the extension dir).

## Architecture Patterns

### System Architecture Diagram

```
                        marketplace-absent precondition (single condition)
                                          |
        +-----------------+-----------------+-----------------+-----------------+-----------------+------------------+
        |                 |                 |                 |                 |                 |                  |
     install          uninstall         reinstall      plugin update      mp remove        autoupdate       MP UPDATE <name>
   install.ts        uninstall.ts      reinstall.ts     update.ts         remove.ts       autoupdate.ts       update.ts
        |                 |                 |                 |                 |                 |                  |
  marketplaceAbsent  resolveCrossScope  MarketplaceNot   MarketplaceNot   catch Mkt-      catch Mkt-       resolveScopeFromState
   flag (in guard)   PluginTarget       AddedSignal       AddedSignal     NotFoundError   NotFoundError      / withStateGuard
        |            -> absent/other      (thrown +         (thrown +       -> notify        -> notify        THROWS Mkt-
        |               -scope arm         caught)           caught)        not-added        not-added      NotFoundError RAW
        v                 v                 v                 v                 v                 v                  |
   notify(ctx,pi, {kind:"marketplace-not-added", name, scope?})  ... (6 ops converge) ...                          X  NO CATCH
        |                                                                                                          (edge handler
        v                                                                                                           bare; error
   renderMarketplaceNotAdded() -> "⊘ <name> [scope?] (failed) {not added}"  (severity=error, no reload-hint)        escapes to Pi)
        |
        v
   THE CANONICAL INFO MODEL  (the byte form every converged op matches)
```

The diagram traces the convergence claim: a single precondition fans out to seven op
entrypoints; six funnel into the SAME `marketplace-not-added` emission, one (`MP UPDATE
<name>`) breaks out with a raw throw (the `X` path).

### Pattern 1: Cross-op convergence test (the SC#1 proof)
**What:** A single `tests/architecture/*.test.ts` that, for the marketplace-absent
precondition, constructs the `marketplace-not-added` payload each op WOULD emit and asserts
every op's rendered bytes equal `info`'s `{not added}` row byte-for-byte.
**When to use:** This phase -- it makes Class-C closure a first-class, regression-locked
assertion (per CONTEXT decision #1; preferred over relying only on the catalog matrix).
**Two viable shapes (recommend the renderer-level matrix as primary):**

1. **Renderer-level matrix (recommended primary).** All six converged ops emit the IDENTICAL
   `{ kind: "marketplace-not-added", name, scope? }` payload. Build the canonical payload
   once, run it through `notify()` via a mock ctx, capture the byte string, then assert that
   the byte string is what `info`, `install`, `uninstall`, `reinstall`, `update`, `remove`,
   and `autoupdate` each produce. Because they share ONE variant + ONE renderer, the proof is
   that each orchestrator constructs the same variant -- assert at the construction seam.
   Cheap, deterministic, no disk/network.
   ```typescript
   // Source: shared/notify.ts renderMarketplaceNotAdded (lines 2124-2136)
   // The canonical row every converged op must match:
   //   "⊘ ghost-mp [project] (failed) {not added}"   (scope present)
   //   "⊘ ghost-mp (failed) {not added}"             (bare / absent-from-both)
   ```

2. **Orchestrator-level matrix (stronger, more setup).** Drive each real orchestrator
   (`installPlugin`, `uninstallPlugin`, `reinstallPlugin`, `updatePlugin`/`updateMarketplace`,
   `removeMarketplace`, `setMarketplaceAutoupdate`) against an empty-state mock filesystem and
   capture the `ctx.ui.notify` call. This is the strongest proof (it exercises each
   orchestrator's actual detection path) but needs the per-op test fixtures already present in
   `tests/orchestrators/`. Recommend this for the ONE op that needed a fix (`marketplace
   update`) and the renderer-level matrix for the breadth assertion.

**Recommendation:** ship BOTH a renderer-level breadth matrix (all 6 ops, byte-identity) AND
an orchestrator-level regression test for the newly-converged `marketplace update <missing-mp>`
(proves the raw throw is gone and the bytes match). The catalog UAT already byte-locks each
op's `missing-marketplace-not-added` state individually; the convergence test adds the
cross-op equality assertion the catalog UAT structurally cannot make (it checks each state
against its own expected block, never state-A against state-B).

### Pattern 2: Mirror `remove.ts`'s catch-and-reroute for the residual fix
**What:** `remove.ts` (lines 185-243) and `autoupdate.ts` (lines 160-182, 223-242) both
catch `MarketplaceNotFoundError` and re-emit `{ kind: "marketplace-not-added", name, scope }`.
`updateMarketplace` does not. The fix mirrors that exact pattern.
**Where the raw throw originates (two sites):**
- Bare form: `resolveScopeFromState(name, ...)` throws `MarketplaceNotFoundError` when absent
  in both scopes (`marketplace/shared.ts:485`).
- Explicit-scope form: passes straight through to `snapshotAfterRefresh` →
  `withStateGuard` → `throw new MarketplaceNotFoundError(name, [scope])`
  (`marketplace/update.ts:437-438`).
**Example (the convergence arm to add in `updateMarketplace`):**
```typescript
// Source: mirrors orchestrators/marketplace/remove.ts:185-205
// In updateMarketplace (orchestrators/marketplace/update.ts:201-225), wrap the
// resolve + refresh so a MarketplaceNotFoundError routes to the canonical variant:
try {
  // ... existing resolve + refreshOneMarketplace ...
} catch (err) {
  if (err instanceof MarketplaceNotFoundError) {
    notify(opts.ctx, opts.pi, {
      kind: "marketplace-not-added",
      name: opts.name,
      ...(opts.scope !== undefined && { scope: opts.scope }),
    });
    return;
  }
  throw err; // genuine refresh failures keep their (failed) cascade path
}
```
**Caveat (must preserve):** the catch must NOT swallow genuine refresh failures
(`MarketplaceUpdateError`, network/clone errors, `StateLockHeldError`). Those already route to
the `(failed)` cascade path (catalog states `mp-failure-network`,
`update-path-invalid-manifest`) and must stay there. Only `MarketplaceNotFoundError` reroutes.
The bare-form (`updateAllMarketplaces`) never hits this -- it enumerates existing records, so a
named-but-missing marketplace can only arrive via `updateMarketplace` (the single-name form).

### Anti-Patterns to Avoid
- **Adding a new REASONS member for the marketplace-update miss.** LOCKED OUT (CONTEXT
  "Locked", REQUIREMENTS Out of Scope): reuse the structural `marketplace-not-added` variant.
  No `marketplace not added` REASONS member; the tuple stays at 29.
- **A convergence "test" that only re-checks the catalog UAT.** The catalog UAT checks each
  state against its OWN expected block; it never asserts state-A bytes == state-B bytes. A
  convergence test that just re-runs catalog-uat proves nothing new (CONTEXT decision #1
  explicitly prefers the explicit matrix).
- **Fixing `marketplace add`'s `invalid manifest` asymmetry by routing it through
  `marketplace-not-added`.** `add` failures are NOT the marketplace-absent precondition; they
  are precondition-class-3 (manifest) / class-other (duplicate/unsupported). Out of SC#1's
  matrix.
- **Touching the renderer byte forms.** The 6 converged ops are byte-locked. Any convergence
  fix is byte-ADDITIVE (a new catalog state + fixture for `marketplace update`), never a
  mutation of existing forms.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Marketplace-absent emission | A new per-op reason/row | The existing `MarketplaceNotAddedMessage` variant + `renderMarketplaceNotAdded` | One variant, one renderer = byte-identity by construction (the whole point of convergence) |
| Catch-and-reroute for the residual fix | A bespoke error handler | Copy `remove.ts:185-205` / `autoupdate.ts:160-170` verbatim-in-spirit | Those are the already-reviewed, already-tested convergence patterns |
| Byte-equality assertion | A new string differ | The existing `catalog-uat.test.ts` driver + a small cross-op equality test | The driver already does `notify()`-through-mock-ctx capture |

**Key insight:** convergence is achieved by making every op construct the SAME variant, not
by making every op produce the same string independently. The type model (one variant) is the
mechanism; the test just proves no op slipped its own row in.

## Cross-Op Convergence Matrix (SC#1) -- VERDICT

For the **"marketplace absent in target scope"** precondition. Canonical model =
`info`'s `⊘ <name> [scope?] (failed) {not added}` (severity `error`, no reload-hint).

| Op | Entry / detection | Emits `marketplace-not-added`? | Catalog state present? | Converges? |
|----|-------------------|-------------------------------|------------------------|------------|
| **info** (model) | `marketplace info` / `plugin info` (info.ts) | YES (the model) | `scope-mismatch-not-added`, `missing-marketplace-not-added-absent-from-both` | ✅ canonical |
| **install** | `marketplaceAbsent` flag in guard (install.ts:777-803) | YES, with `[scope]` (edge defaults scope) | `missing-marketplace-not-added` | ✅ |
| **uninstall** | `resolveCrossScopePluginTarget` → `marketplace-absent`/`other-scope` arms (uninstall.ts:156-176) | YES | `missing-marketplace-not-added` | ✅ |
| **reinstall** | `MarketplaceNotAddedSignal` thrown + caught (reinstall.ts:416-420, 490-591) | YES | `missing-marketplace-not-added`, `...-absent-from-both` | ✅ |
| **update (plugin `@<mp>` / `<plugin>@<mp>`)** | `MarketplaceNotAddedSignal` thrown + caught (update.ts:351-353, 1771-1854) | YES | `missing-marketplace-not-added`, `...-absent-from-both` | ✅ |
| **marketplace remove** | catch `MarketplaceNotFoundError` → reroute (remove.ts:185-205) | YES | `remove-missing-not-added`, `remove-missing-not-added-bare` | ✅ |
| **autoupdate / noautoupdate** | catch `MarketplaceNotFoundError` + `missingEverywhere` → reroute (autoupdate.ts:160-170, 223-242) | YES | (states under autoupdate section) | ✅ |
| **marketplace update `<missing-mp>`** | `resolveScopeFromState` / `withStateGuard` THROW `MarketplaceNotFoundError` RAW (update.ts:206-208, 437-438) | **NO** | **NONE** (section has only no-op/changed/mixed/network/invalid-manifest) | ❌ **DOES NOT CONVERGE** |

**VERDICT: 6 of 7 op-paths converge; `marketplace update <missing-mp>` is the one residual
gap.** Its edge handler (`edge/handlers/marketplace/update.ts`) has no try/catch (confirmed),
so the raw `MarketplaceNotFoundError` escapes to the Pi command runner -- unstyled, no
`(failed)` row, no closed-set reason. This is precisely the audit's Theme 2 / Class C
`remove`/`update` raw-throw finding, still live for the marketplace-form update.

**SC#1 wording lists `update` in the matrix.** The plugin-update `@<mp>` form already
converges (Phase 47), which arguably satisfies a literal reading of "update". But the
audit's matrix row (Theme 1 table) and Theme 2 explicitly call out the marketplace-form
`update` raw throw, and SC#1's stated goal is "Class C closed across the whole matrix, not
merely fixed per-op." Leaving the marketplace-form update throwing raw means the milestone
ships with a known live Class-C instance. **Recommendation: close it** (small fix, below).

## Adjudication of the 4 deferred items (CONTEXT decision #2)

### 1. marketplace `update <missing-mp>` convergence (OQ#1) -- **CLOSE NOW**
The marketplace-form update is the ONLY op still throwing `MarketplaceNotFoundError` raw past
the orchestrator boundary. It is a small, `remove.ts`-mirrored convergence fix (see Pattern 2),
reuses the existing variant (no new mechanism, no new REASONS member), and is squarely in this
phase's "close convergence" scope. Without it SC#1 is not literally true and the milestone
ships a live Class-C instance the audit named. Close cost: a try/catch in `updateMarketplace`,
two new catalog states (`update-missing-not-added` explicit-scope + `update-missing-not-added-bare`),
two catalog-uat fixtures, and a regression test. Byte-additive; `npm run check` stays GREEN.
**Risk if accepted instead:** the milestone's own SC#1 verification would have to be reworded
to "update (plugin form only)", contradicting the audit's matrix and Theme 2.

### 2. Phase 48 IN-02 -- `info` `{unreadable}` vs `add` `{invalid manifest}` for a schema-invalid manifest -- **CLOSE NOW (one-line arm)**
Confirmed asymmetry: `classifyAddError` (write path, add.ts:165-167) maps
`InvalidMarketplaceManifestError` → `invalid manifest`; `narrowProbeError` (read path,
probe-classifiers.ts:46-48) only unwraps a `SyntaxError` cause to `unparseable` and lets a
schema-invalid manifest (typed error, NO SyntaxError cause) fall through to `unreadable`. For
the SAME on-disk condition the user sees two different reasons across surfaces -- a
precondition-class-3 cross-surface inconsistency, the exact kind this phase closes. `invalid
manifest` is ALREADY a REASONS member, so the fix is a one-line arm in `narrowProbeError`:
```typescript
// Source: shared/probe-classifiers.ts -- add before/after the SyntaxError-cause arm:
if (err instanceof InvalidMarketplaceManifestError) {
  // SyntaxError cause => malformed JSON => {unparseable}; otherwise schema-invalid => {invalid manifest}
  return err.cause instanceof SyntaxError ? "unparseable" : "invalid manifest";
}
```
This subsumes the existing `SyntaxError`-cause arm (collapse them). Catalog impact: the
`marketplace info` / `plugin info` `unreadable`-manifest catalog state(s) shift to `invalid
manifest` -- update the catalog block + fixture in lockstep (byte-additive supersession).
**Counter-argument considered:** "read vs write semantics differ." Rejected -- the user-facing
*reason* describes the manifest's state (it is invalid), which is identical regardless of read
vs write. The asymmetry is a leak of the classifier's internal ladder, not a real semantic
distinction. Small fix, in scope.

### 3. Phase 47 IN-02 -- `preflightUpdate` concurrent-removal reports `(skipped) {not in manifest}` (lying reason) -- **ACCEPT (with rationale)**
Located at update.ts:585-600: inside `preflightUpdate`, when `mp === undefined` (the
marketplace container vanished between the unlocked enumerate read and the cascade), the
outcome is `(skipped) {not in manifest}`. This reason is technically untruthful (the real
condition is "the marketplace was concurrently removed mid-cascade"). HOWEVER:
- It is a rare TOCTOU concurrency edge, NOT part of the marketplace-absent matrix SC#1 proves
  (the up-front `enumerateMarketplaceTarget` already emits `{not added}` via
  `MarketplaceNotAddedSignal` for the normal absent case; this arm only fires on a race AFTER
  enumeration succeeded).
- `concurrently uninstalled` / `concurrently updated` already exist as REASONS members and the
  update path already throws those for the plugin-row concurrent-removal case (update.ts:866,
  935) -- so a truthful reason IS available. But routing this mp-level race through a new
  outcome row is a behavior change on a path with no catalog state and no user report.
- It is NOT a cross-OP inconsistency (the audit's Class C) -- it is an intra-op rare-edge
  reason imprecision (closer to Class A "lying reason," but on a non-matrix path).
**Recommendation: ACCEPT, documented.** Optionally a one-line reason swap to `concurrently
uninstalled` if the planner wants zero lying reasons in the tree -- but it is NOT required for
SC#1 and adds a catalog state for a race path. If accepted, record the rationale in the phase
SUMMARY + a code comment so it is not re-flagged. (Lower priority than items 1 and 2.)

### 4. Phase 47 IN-01 -- install M1 zero-delta state save -- **ACCEPT (out of scope)**
A performance nicety (the install path saves state even on a zero-delta marketplace-absent
miss). Not a reason/attribution/convergence issue. Explicitly out of convergence scope per
CONTEXT. **Recommendation: ACCEPT.** No action; note in SUMMARY.

**Adjudication summary:** CLOSE items 1 (marketplace-update convergence) and 2 (info/add
manifest asymmetry); ACCEPT items 3 (concurrent-removal reason, rare non-matrix edge) and 4
(zero-delta save, perf). Items 1+2 are small, byte-additive, reuse existing variants/members.

## SC#2 -- REASONS one-vocabulary -- CLEAN (no action)
`tests/architecture/notify-types.test.ts:670-674` locks `REASONS.length === 29` (`_l4`) and
proves `"not added" ∈ REASONS` (`_l4b`). The canonical marketplace-missing condition is the
structural `marketplace-not-added` VARIANT (not a content reason) -- `renderMarketplaceNotAdded`
hard-codes the `{not added}` brace; `ContentReason = Exclude<Reason, "not added">` makes a
mixed `["not added", "permission denied"]` row a compile error (TYPE-02). No new `marketplace
not added` member exists. **Optional strengthening (LOW priority):** add a one-line type
assert that `"not added"` is NOT assignable to `ContentReason` (locks TYPE-02 against a future
regression that re-admits the structural reason into content fields). Not required for SC#2.

## SC#3 -- Catalog byte-lock + no orphan/stale state
The catalog UAT (`tests/architecture/catalog-uat.test.ts`) parses every
`<!-- catalog-state: X -->` annotation in `docs/output-catalog.md`, looks up the matching
`(section, state)` fixture, drives it through `notify()`, and asserts byte-equality + severity
(lines 2047-2160). It also asserts `examples.length >= 30` (currently well above). Every
corrected byte form from 46-48 IS documented (verified: 11 `missing-marketplace-not-added`
catalog states across install/uninstall/reinstall/update/info; `remove-missing-not-added*`;
add `(failed)` states; `update-path-invalid-manifest`).

**Orphan-detection gap (structural soft-spot):** the driver walks
**catalog → fixture** (a catalog state with NO fixture fails as `missing-fixture`). It does
NOT walk **fixture → catalog** -- a FIXTURES entry with no corresponding catalog annotation is
silently never exercised (an orphan fixture). "No orphan" is therefore only HALF-checked
today.
**Recommendation:** add a coverage assertion that iterates every `(section, state)` key in the
`FIXTURES` map and asserts a matching catalog annotation was parsed (the inverse walk). This
makes "no orphaned/stale catalog state remains" (SC#3 wording) a real, both-directions gate --
cheap, deterministic, and exactly the SC#3 intent. When the marketplace-update convergence fix
adds new catalog states + fixtures, this inverse check confirms they stay paired.

## SC#4 -- `npm run check` GREEN, no test-count regression
**VERIFIED this session:** `npm test` → `# tests 1502 # pass 1502 # fail 0` (top-level plan
`1..1495`; 1502 counts subtests). Matches the STATE.md Phase-48 close (1502 GREEN). Phase 45
baseline = 1473; current 1502 ≥ 1473 ✅ (29 net added across 46-48). The convergence fix +
new tests will ADD tests (count goes up, never down). `check` = `typecheck && lint &&
format:check && test`; all four must pass on a clean tree at the GREEN gate.
**NFR spot-checks (all unaffected by this phase's plan):**
- **NFR-5 (no network on path/non-network ops):** the marketplace-update convergence fix
  routes a missing marketplace through `notify()` BEFORE any `gitOps` call (the resolver reads
  `loadState` only); the IN-02 `narrowProbeError` arm is read-only classification. No new
  network surface. The path-source `{invalid manifest}` (ATTR-10) classification stays
  zero-gitOps.
- **NFR-7 (discriminated `installable`):** untouched -- no resolver changes.
- **NFR-10 (containment):** untouched -- no new disk writes outside the scope root; the
  convergence fix only adds a `notify()` emission + a `return` on the throw path.

## SC#5 -- Traceability -- CLEAN (no reconciliation needed)
`.planning/REQUIREMENTS.md` (read in full) maps all 15 v1.10 requirements to phases with NO
`TBD`: ATTR-01/02/03/04/08/09 + SCOPE-01 → Phase 47; ATTR-05/06/07/10 → Phase 48; TYPE-01..04
→ Phase 46. The Traceability table (lines 70-94) shows all 15 `Complete`, coverage line
"Mapped: 15, Unmapped: 0 ✓", and an explicit note that Phase 49 closes no requirements. STATE.md
+ ROADMAP §"Phase 49" agree. **No reconciliation required.** The only doc update SC#5 might
want at close is flipping the milestone status line (ROADMAP `🚧 v1.10 ... (in progress)` →
done) -- that is `/gsd-complete-milestone`'s job, not this phase's.

## Common Pitfalls

### Pitfall 1: Treating the plugin-update `@<mp>` form as satisfying SC#1's "update"
**What goes wrong:** concluding `update` already converges and skipping the marketplace-form
fix.
**Why:** Phase 47 converged the PLUGIN update (`@<mp>` / `<plugin>@<mp>` via
`MarketplaceNotAddedSignal`). The MARKETPLACE update (`marketplace update <name>`) is a
separate orchestrator (`orchestrators/marketplace/update.ts`) that still throws raw.
**How to avoid:** the matrix above distinguishes the two. SC#1's matrix descends from the
audit's Theme 1/2 which names the marketplace-form update raw throw.
**Warning sign:** no `missing-marketplace-not-added` catalog state under the `marketplace
update <name>` section (confirmed absent).

### Pitfall 2: The convergence catch swallowing genuine refresh failures
**What goes wrong:** a too-broad `catch` in `updateMarketplace` reroutes `MarketplaceUpdateError`
/ network / lock errors to `{not added}`, hiding real failures.
**How to avoid:** narrow the catch to `err instanceof MarketplaceNotFoundError`; re-throw
everything else (it already routes to the `(failed)` cascade path:
`mp-failure-network` / `update-path-invalid-manifest`).
**Warning sign:** the `mp-failure-network` or `update-path-invalid-manifest` catalog-uat
fixtures go RED.

### Pitfall 3: A convergence test that asserts each op against its own block (not against `info`)
**What goes wrong:** re-implementing the catalog UAT and calling it a convergence test.
**How to avoid:** the convergence assertion is byte-IDENTITY across ops -- build `info`'s
expected row once, assert every other op's emission equals THAT exact string (and equals each
other). The cross-op equality is the new information.

### Pitfall 4: Forgetting the scope-bracket variants in the convergence matrix
**What goes wrong:** asserting only the `[scope]` form and missing the bare (absent-from-both)
form, or vice-versa.
**Why:** the convergence has TWO canonical rows: `⊘ <name> [scope] (failed) {not added}`
(explicit scope / scope-mismatch) and `⊘ <name> (failed) {not added}` (absent from both,
no bracket). Each op that supports a bare form must match the bracketless row too.
**How to avoid:** the matrix test parameterizes over `{ scope: "project" }` and
`{ scope: undefined }`. Note: `install` ALWAYS carries a scope (edge defaults it), so it has
no bracketless variant -- document that asymmetry rather than asserting a bracketless install row.

## Runtime State Inventory

Not applicable -- this is a verification + closure phase. No rename/refactor/migration; no
stored-data, live-service-config, OS-registered-state, secrets/env, or build-artifact churn.
The only mutations are source (a try/catch + a `narrowProbeError` arm), docs (catalog),
tests (new convergence + coverage assertions), and `.planning` (no reconciliation needed).
**None found in any category -- verified by phase scope (no string rename, no persistence
shape change; STATE.md "No on-disk state shape changes" for the whole milestone).**

## Validation Architecture

> nyquist_validation is enabled (config.json `workflow.nyquist_validation: true`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` (Node >= 20.19.0; native TS strip on 22.18+) |
| Config file | none -- `package.json` `test` script globs `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts` |
| Quick run command | `node --test "tests/architecture/**/*.test.ts"` (catalog + types + the new convergence test) |
| Full suite command | `npm test` (or `npm run check` for the full gate) |

### Phase Requirements → Test Map
This phase closes NO requirements; the "requirements" are the 5 success criteria. Map:

| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC#1 | All 6 ops emit byte-identical `{not added}` for marketplace-absent; `marketplace update <missing>` converges (no raw throw) | architecture (cross-op matrix) + orchestrator (regression) | `node --test "tests/architecture/cross-op-convergence.test.ts"` ; `node --test "tests/orchestrators/marketplace/update.test.ts"` | ❌ Wave 0 (new convergence test); update.test.ts exists (add a case) |
| SC#2 | REASONS length-lock 29 + `not added` member; no new member | architecture (compile proof) | `node --test "tests/architecture/notify-types.test.ts"` | ✅ (`_l4`/`_l4b`) |
| SC#3 | Catalog byte-equality GREEN + no orphan fixture (both walks) | architecture (catalog UAT + inverse coverage) | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ catalog walk; ❌ Wave 0 inverse-walk assertion |
| SC#4 | `npm run check` exit 0, count ≥ 1473, no regression | full gate | `npm run check` | ✅ (1502 GREEN now) |
| SC#5 | Traceability all-mapped, no TBD | manual doc verify (no test) | grep `TBD` `.planning/REQUIREMENTS.md` → none | ✅ (clean) |
| IN-02 fix | Schema-invalid manifest reads `{invalid manifest}` on info/list (parity with add) | unit (probe-classifiers) + catalog UAT | `node --test "tests/shared/*probe*.test.ts"` + catalog-uat | ⚠ verify a probe-classifier test file exists; add a case |

### Sampling Rate
- **Per task commit:** `node --test "tests/architecture/**/*.test.ts"` (the catalog + types +
  convergence cluster -- the fast contract gate, < 5 s).
- **Per wave merge:** `npm test` (full suite, ~23 s).
- **Phase gate:** `npm run check` green (typecheck + lint + format + 1502+ tests) before
  `/gsd-verify-work` → `/gsd-audit-milestone` → `/gsd-complete-milestone`.

### Wave 0 Gaps
- [ ] `tests/architecture/cross-op-convergence.test.ts` -- the SC#1 cross-op byte-identity
  matrix (covers all 6 converged ops + the two scope-bracket rows).
- [ ] `tests/architecture/catalog-uat.test.ts` -- ADD an inverse-walk coverage assertion
  (every FIXTURES `(section,state)` key has a matching catalog annotation) for SC#3 "no orphan".
- [ ] `tests/orchestrators/marketplace/update.test.ts` -- ADD a regression case proving
  `updateMarketplace` of a missing marketplace emits `marketplace-not-added` (no raw throw),
  explicit-scope + bare forms.
- [ ] probe-classifier / info-surface test -- ADD a schema-invalid-manifest case asserting
  `{invalid manifest}` (IN-02 close). Verify the existing test file path before creating new.
- [ ] No framework install needed (`node:test` already in use).

*(If the planner ACCEPTS item 1 instead of closing it, the first three Wave-0 items shrink to
the renderer-level matrix over the 6 already-converged ops + the SC#3 inverse walk; document
the marketplace-update raw throw as an accepted residual -- but that contradicts SC#1's literal
wording, so CLOSE is recommended.)*

## State of the Art

Not applicable -- internal phase, no ecosystem/library currency concerns. The relevant "state
of the art" is internal: the v1.4 / v1.4.1 / v1.5 lesson that `shared/notify.ts` changes
serialize (no parallel waves) and that catalog/byte/test changes land atomically
(supersession). This phase's small fixes (try/catch + one classifier arm) each touch the
catalog + fixtures + tests and must land as atomic supersession commits, GREEN at each step.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `marketplace update <missing-mp>` throws raw with no edge-handler catch | Matrix / decision #1 | LOW -- verified by reading update.ts:206-208/437-438 + edge/handlers/marketplace/update.ts (no try/catch) and the absent catalog state |
| A2 | `invalid manifest` is already a REASONS member (no new member for IN-02) | decision #2 | LOW -- verified in notify.ts:76 (`"invalid manifest"` in REASONS) |
| A3 | The convergence fix is byte-additive and keeps `npm run check` GREEN | SC#4 | LOW -- it adds emissions/states/tests, mutates no existing byte form |

**All three are tool-verified this session (source reads + suite run), so risk is LOW; none
are training-data assumptions.** No `[ASSUMED]`-from-training claims in this research.

## Open Questions

1. **Should Phase 47 IN-02 (concurrent-removal `{not in manifest}`) be closed for a
   zero-lying-reasons tree, or accepted as a rare non-matrix edge?**
   - What we know: it is a TOCTOU race path with no catalog state, not part of SC#1's matrix;
     a truthful reason (`concurrently uninstalled`) already exists.
   - What's unclear: whether the operator wants strictly-zero lying reasons even on race paths.
   - Recommendation: ACCEPT for v1.10 (document it); offer the one-line `concurrently
     uninstalled` swap as an optional polish task if the planner wants it. It does not block
     SC#1.

2. **Does the IN-02 catalog change (info/list `{unreadable}` → `{invalid manifest}` for
   schema-invalid) touch any OTHER catalog state that currently expects `unreadable`?**
   - What we know: `narrowProbeError`'s `unreadable` is the permissive fallback for ANY other
     thrown shape, not just schema-invalid manifests.
   - What's unclear: whether an existing catalog state's `unreadable` byte form would shift.
   - Recommendation: the fix is scoped to `InvalidMarketplaceManifestError` only (a typed
     error) -- generic `unreadable` fallbacks (EIO, unknown) are untouched. The planner should
     grep catalog states for `unreadable` and confirm only the schema-invalid-manifest state
     shifts; lock the rest with the catalog UAT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `node --test`, typecheck | ✓ | (project floor >= 20.19.0) | -- |
| npm scripts (`check`/`test`) | GREEN gate | ✓ | package.json present | -- |

No external services, no network, no databases. The whole phase runs offline (NFR-5 honored
by construction). **No missing dependencies.**

## Project Constraints (from CLAUDE.md)

- **TypeScript strict; `ctx.ui.notify` only** (IL-2): the convergence fix emits via `notify()`
  (the sole sanctioned `ctx.ui.notify` site) -- no direct stdout/stderr. The single sanctioned
  `console.warn` (IL-3, migrate.ts) is unrelated.
- **`npm run check` must stay GREEN** (NFR-6): every commit GREEN; atomic supersession for
  catalog/byte/test changes.
- **NEVER commit to main; never `--no-verify`; run `pre-commit` before commit:** the
  orchestrator owns commits (this research commits nothing). Worktree commits prefix
  `SKIP=trufflehog` (per MEMORY).
- **No new REASONS member; REASONS stays 29; reuse `not added` variant** (LOCKED): all
  recommended fixes reuse existing members/variant.
- **No telemetry (IL-4), English-only (IL-1), two scopes only (SC-1):** unaffected.
- **NFR-5/7/10 unaffected:** verified above (no new network/resolver/containment surface).

## Sources

### Primary (HIGH confidence -- read in full this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` -- REASONS (29), `MarketplaceNotAddedMessage`,
  `renderMarketplaceNotAdded` (2124-2136), `isInfoKind`/`StandaloneKind`/`assertNever`,
  `computeSeverity`/`shouldEmitReloadHint`/`dispatchInfoMessage`/`notify`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{shared,install,uninstall,reinstall,update}.ts`
  -- the converged plugin ops, `MarketplaceNotAddedSignal`, cross-scope resolvers,
  `preflightUpdate` (IN-02 P47).
- `extensions/pi-claude-marketplace/orchestrators/marketplace/{add,remove,autoupdate,update}.ts`
  -- `classifyAddError` (165-167), remove/autoupdate catch-and-reroute, `updateMarketplace`
  raw-throw sites (206-208, 437-438).
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts` -- confirmed no try/catch.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` -- `narrowProbeError` (IN-02 P48).
- `tests/architecture/{catalog-uat,notify-types}.test.ts` -- byte runner (2047-2160; catalog→fixture
  only), REASONS length-lock (`_l4`/`_l4b`, 670-674).
- `docs/output-catalog.md` -- all `missing-marketplace-not-added*` states; confirmed NO
  marketplace-update not-added state.
- `.planning/{REQUIREMENTS,STATE,ROADMAP}.md` + `49-CONTEXT.md` + `research/v1.10-attribution-audit.md`.
- `npm test` run this session: **1502 pass / 0 fail.**

### Secondary / Tertiary
- None -- no web/library research applicable to an internal closure phase.

## Metadata

**Confidence breakdown:**
- Convergence matrix verdict: HIGH -- every op path traced in source + catalog states cross-checked.
- Deferred-item adjudication: HIGH -- both close-now items verified (raw throw present; `invalid
  manifest` already a member); both accept items are rare/perf and out of the matrix.
- Traceability / SC#2 / SC#4: HIGH -- REQUIREMENTS read in full (clean), length-lock read, suite run GREEN.
- SC#3 orphan-gap: HIGH -- driver code read; the catalog→fixture-only walk is explicit in the source.

**Research date:** 2026-06-07
**Valid until:** 2026-07-07 (stable internal codebase; valid until the source changes -- re-verify
the `marketplace update` raw-throw status and the 1502 count if any commit lands before planning)
