# Phase 10: Constraint-aware update - Research

**Researched:** 2026-09-22
**Domain:** TypeScript orchestrator refactor — threading a version-constraint gate into the existing plugin-update preflight, reusing Phase 3/7 domain algebra and probes
**Confidence:** HIGH (every claim below is `[VERIFIED: <path>:<lines>]` from a same-session `Read`, unless tagged `[ASSUMED]`)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-10-01:** The gate is **two staged checks**, matching upstream's `updatePluginOp` in the 2.1.267 binary. Stage one intersects every constraining dependent's range and probes for the highest release tag satisfying it; a hit pins the update to that tag. Stage two runs when stage one found no satisfying tag: the candidate resolves as it does today, and the derived `toVersion` is then re-checked against the intersection — in range the update proceeds, out of range it is held. Stage two is what catches a repository with no release tags at all and a path source whose current copy has drifted out of range; without it, UPDT-01 is unmet for exactly the cases the tag probe cannot answer. Upstream's own debug line marks the seam: `no <name>--v* tag satisfying <range>; falling back to HEAD + post-fetch guard`. — **Reversibility:** costly — dropping stage two later means re-opening every update-row test that asserts a held row on a no-tag source.
- **D-10-02:** The intersection, the dependents lookup and the tag probe live in a **new leaf module** that `update-preflight.ts` composes through an injected field, rather than inline in `preparePluginUpdate`. The composition arrangement is the one `install-clone-probe.ts` already uses. Two reasons: `preparePluginUpdate` is already near the cognitive-complexity cap that ESLint and fallow both gate at 15, and a leaf gives the unit test a direct target instead of forcing every constraint case through the whole preflight.
- **D-10-03:** The gate sits **after `triageUpdateMembership` and before `resolveUpdateCandidate`**. Triage is what establishes there is a record and a manifest entry to constrain at all; running the gate before it would have to answer "who declares a plugin that is not installed".
- **D-10-04:** The dependents come from **`buildScopeDeclarationDetail`, inverted inside the leaf** — the leaf filters its `AddressedDependency` entries down to those naming this plugin's key and keeps their declared ranges. No new walk in `dependency-index.ts`. That walk is already offline, already fail-closed (D-05-07), already indexes disabled records (D-05-04), and is already pinned by the network-free gate. A third sibling walk would be a second answer to "what does X declare" that has to stay consistent with the first two.
- **D-10-05:** When the fail-closed walk refuses — a dependent's declarations cannot be established — **that plugin's update is skipped and the row carries the walk's cause line naming the unreadable declarer**. An unestablished declaration set may hide a range, and updating past an unknown constraint is precisely what the walk exists to prevent. This matches the uninstall refusal's shape (`{unreadable}` plus a naming cause line, `docs/dependency-resolution.md` §146), and differs from it only in that an update is skipped rather than refused.
- **D-10-06:** **Every installed record in the same scope constrains, enabled or disabled.** Upstream reads `[...enabled, ...disabled]`, and D-05-04 already says it in this codebase's own words: installed is installed, and a disabled record keeps its declarations exactly as it keeps its inventory. The alternative — enabled only — would let an update move a dependency out of range while a dependent is briefly disabled, so re-enabling it would find a constraint that can no longer be satisfied.
- **D-10-07:** **Constraints are scope-local.** Each scope's update intersects only the ranges declared by records in that same state document (D-05-05), so a bare `update` fanning out over project and user evaluates each scope independently. Consistent with every other dependency surface in the extension; the alternative would make a user-scope plugin's update depend on which project directory the command ran in.
- **D-10-08:** **Provenance does not change the gate.** The question is who declares this key, not how the record got here, so a directly-installed plugin that something also depends on is held exactly as a `provenance: "dependency"` one is. Upstream reads declarations and never reads provenance here, and UPDT-01 carves out no exception.
- **D-10-09:** The held row carries **one new closed-set reason token** (working name `dependents constrain` — the planner settles the exact two-or-three-word wording against `docs/messaging-style-guide.md`). Neither existing neighbour fits: `version conflict` already covers two subjects (declarations that contradict each other, and an installed copy outside them) and this is a third where nothing contradicts anything; `no matching version` says the source advertised no tag in range, which misdescribes the post-fetch-guard arm where a version WAS found and simply is not admissible. This is a closed-set amendment and touches every pin surface: the `REASONS` tuple, the `notify-reasons.ts` header count, `docs/output-catalog.md` (state and byte counts, pinned by `tests/architecture/catalog-uat/catalog-contract.test.ts` and `catalog-parser.test.ts`), and `tests/architecture/notify-closed-set-locks.test.ts`. — **Reversibility:** one-way — the token is published user-visible output and a catalog state; removing it later means a catalog amendment plus a byte-count change on every pinned surface.
- **D-10-10:** **One token, three arms, distinguished on the cause line.** Disjoint dependent ranges, no tag satisfying the intersection, and a fetched version outside the intersection all render the same brace; the cause line says which situation it is and names the holders. A reason token is one to three lowercase words and the set is a literal tuple, so it cannot interpolate an identifier — the split follows the `dependency cycle` and `dependents unsatisfied` precedent, where the token names the condition and the naming rides the cause line.
- **D-10-11:** The cause line **names the constraining plugins and marks which of them are disabled**. Upstream's remedy points at the disabled holder first (`Update or uninstall "B" to unblock (it is currently disabled)`), and without the marking a user is told to update a plugin that is not even loading.
- **D-10-12:** Severity of the held row is **warning on every surface, including the autoupdate cascade**. This is a deliberate departure from the SEV-01 / WR-01 split already in `update-row.ts`, where the autoupdate cascade stays `info` for an absent companion. The reasoning differs: an absent soft-dep companion is a thing the user could not act on anyway, whereas a constraint hold is a state that persists across every future run until the user changes a declaration — a background run that reports it at `info` hides the one fact that explains why the plugin never moves. Planner: state this divergence explicitly where the severity is set, so the next reader does not "fix" it back to the split.
- **D-10-13:** When the plugin is already at the highest version the intersection admits, the row **keeps its existing `{up-to-date}` brace** and discloses the range and its holders **on the cause line**. No second token and no catalog churn, and the user can still tell "nothing newer exists" from "nothing newer is allowed" — upstream discloses the same thing in prose (`already at the latest version satisfying ^1.2.0 (1.4.2, required by A)`).
- **D-10-14:** For a constrained **path source** with no satisfying marketplace tag, the update **falls back to the marketplace's current copy and lets stage two decide**: in range the update proceeds, out of range it is held. This is upstream's shape verbatim, and it is the arm that makes D-10-01's second stage earn its place. Phase 7's install-side arm (D-07-07: fall back and always accept, leaving the constraint to LOAD-01) is deliberately NOT ported whole — on an install the alternative is having nothing, but on an update it would mean knowingly moving an in-range plugin to an out-of-range version, which is the thing UPDT-01 forbids.
- **D-10-15:** When that fallback lands in range, the successful row **reuses Phase 7's existing `{dependency current copy}` token**. Same fact, same phrase: no tag pinned this, the marketplace's current copy is what landed. No catalog amendment.
- **D-10-16:** An unreadable local tag listing folds into the same no-satisfying-tag arm, as it already does on the install side (D-07-07) — an unreadable listing and an empty one are the same user-visible fact.
- **D-10-17:** The satisfying tag reaches the swap by **pinning the source the candidate resolves against**, so `resolvedSha` and `toVersion` come out of the paths that already fill them. No new field on `PreparedPluginUpdate`. This is D-07-02's argument one verb over — the pin is written through the same literal shape the git-backed arm always has, so the swap, `finalizeUpdateRecord` and the disabled-refresh projection (`disabledPinProjection`) need no change. A new optional field is the silent-omission class this milestone has already shipped three times: it compiles clean at every derivation site that forgets it.
- **D-10-18:** **One tag memo per run, shared across the whole bulk update.** A bulk `update` or an autoupdate cascade touches many plugins from one marketplace; a run-scoped memo bounds that to one listing per URL and one per marketplace root, exactly as the install cascade's `tagMemo` / `marketplaceTagMemo` already do. This is also what keeps the autoupdate cascade's warm-cache expectation honest for path sources.
- **D-10-19:** No gate edit is needed. `update-preflight.ts` is already outside `NETWORK_FREE_TARGETS` (it is one of the update family's two permitted git consumers), and the new leaf follows `dependency-tag-probe.ts`'s arrangement — absent from `NETWORK_FREE_TARGETS`, composed and invoked through an injected field whose name the gate does not match. Success criterion 3 pins this: `update-flow.ts` / `update-preflight.ts` remain the only git consumers per `tests/architecture/no-orchestrator-network.test.ts`.

### Claude's Discretion

- The exact wording of the new reason token (two or three lowercase words, subject-first grammar per `docs/messaging-style-guide.md`).
- The leaf module's file name and its exported surface shape.
- Whether the three cause-line arms share one composer or three.
- How the unconstrained regression is proven (success criterion 3: "an unconstrained plugin updates exactly as before") — a byte-equality assertion over a rendered row is acceptable only if the fixture actually exercises the gate; a vacuous byte-equality that compares a value to itself is not.

### Deferred Ideas (OUT OF SCOPE)

- **Docs sweep for the update section of `docs/dependency-resolution.md`.** The prose that says what `update` does to a dependency record predates every constraint behaviour in this phase. It is in scope to amend the parts this phase makes untrue; a broader rewrite of the section is not.
- **`marketplace remove` and the constraint gate.** Removing a marketplace can strand a constraining dependent. BACKLOG `PRUNE-GUARD-MR-01` already tracks the adjacent guard question; this phase does not touch it.
- **Showing the effective range on `info` / `list`.** A held plugin's row explains itself only when an update runs. Surfacing "held to <range> by <A>" on an inventory surface is a separate capability and belongs in its own phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| UPDT-01 | `update` and `autoupdate` move a plugin that installed plugins constrain only to the highest version that satisfies every dependent's range. | Patterns 2-4 (dependents inversion, tag-probe decode, pin threading) give the exact call shapes; Finding 1 (Pitfall 1) flags that `deriveUpdateToVersion` must be corrected for a pinned git source or the recorded version will be wrong even though the RIGHT commit was fetched. |
| UPDT-02 | When no version satisfies every range, the update of that plugin is skipped and reported, naming the constraining plugin(s). | Finding 2 (Pitfall 2) identifies the exact type/renderer gap (`PluginSkippedMessage.cause`, `composePluginLinesWith`'s status gate) that must close for the cause line to reach the user at all; Finding 3 (Pitfall 3) shows severity is free via `skipSeverity` as long as the new token is never added to `IDEMPOTENT_REASONS`. |
</phase_requirements>

## Summary

Phase 10 has no new library to select and no new architectural layer to add — it is a precise, surgical wiring job inside an already-large orchestrator family. The two-stage gate (D-10-01), the inversion of `buildScopeDeclarationDetail` (D-10-04), the tag probes (D-10-17/18), and the closed-set reason amendment (D-10-09) all have exact working precedents already in the codebase: `orchestrators/reconcile/dependency-verdict.ts` is the byte-for-byte model for "fold N declarers' ranges, measure a recorded version against the fold," `orchestrators/plugin/install-cascade.ts::resolveMemberTagSource` / `toMemberConstraintOutcome` is the byte-for-byte model for "decide git vs. path, probe, decode the three-way tag-probe result," and `orchestrators/plugin/install-clone-probe.ts` is the byte-for-byte model for "leaf composed through an injected field, default seam baked in." The planner's job is almost entirely *citation*, not invention.

Two findings in this research are **not** cosmetic and change what the plan must do beyond what CONTEXT.md's decisions describe procedurally:

1. **`deriveUpdateToVersion` computes the wrong version for a pinned git-source update as written today.** `update-preflight.ts:229-240` derives `toVersion` from `parsePluginSource(entry.source).kind` and `resolvedSha`, calling `shaVersion(resolvedSha)` — a `sha-<12hex>` pseudo-version — for *any* git-backed source with a resolved sha, whether or not that sha came from a satisfying release tag. The install-side precedent (`docs/dependency-resolution.md:94`) records the **tag's own semver** (`1.2.0`), not a sha-derived string, when a dependency pins to a tag. Stage one's pin (D-10-01) must therefore carry the tag's `version` string all the way to `toVersion`, or the swapped record will show `sha-a1b2c3d4e5f6` instead of `1.2.0` for every git-pinned update — a visible, wrong, and probably review-blocking regression. See Finding 1 below.
2. **`PluginSkippedMessage` has no `cause` channel, and the row composer that would render one does not treat `skipped` as a cause-bearing status.** D-10-11 asks the held row's cause line to interpolate constraining-plugin identifiers with a disabled marking — exactly the pattern `PluginDisabledMessage.cause` and `PluginFailedMessage.cause` already carry — but today `cause?: Error` exists only on `failed` / `manual recovery` / `disabled` / `uninstalled` rows, and `notification-grammar.ts::composePluginLinesWith` (the ONE place that renders a `cause:` trailer) gates on exactly those four statuses. `skipped` is not among them. See Finding 2 below.

**Primary recommendation:** build the gate as one new leaf module (working name `update-constraint-gate.ts`, in `orchestrators/plugin/`) composed into `update-preflight.ts` through an injected field defaulted to the real implementation, following `install-clone-probe.ts`'s exact composition shape; widen `PluginSkippedMessage` with an optional `cause?: Error` field and extend `composePluginLinesWith`'s status gate to include `"skipped"`, on the `PluginDisabledMessage.cause` precedent; and thread the tag's own `version` string (not a `resolvedSha`-derived one) into `toVersion` whenever stage one pins.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Dependents lookup (who declares this key, with ranges) | API / Backend (orchestrator) | Domain (range algebra) | `buildScopeDeclarationDetail` already lives in `orchestrators/plugin/dependency-index.ts` — offline, fail-closed, reads local state + cached manifests only. The new leaf inverts its output; it does not re-walk anything. |
| Range intersection | Domain | — | `domain/dependency-range.ts::intersectDependencyRanges` is pure, already used by both the install cascade and the load-time check. No new evaluator. |
| Tag resolution (git) | API / Backend (orchestrator, network leaf) | — | `orchestrators/plugin/dependency-tag-probe.ts`, exempted from the network-free gate by name, exactly as it is for install. |
| Tag resolution (path/local marketplace clone) | API / Backend (orchestrator, local-fs leaf) | — | `orchestrators/plugin/marketplace-tag-probe.ts`, network-free by construction (reads the local clone). |
| Pin threading into candidate resolution | API / Backend (orchestrator) | Domain (`resolveStrict`) | The pin never becomes a new field; it is injected through the SAME `ctx.resolveGitPluginRoot` / `ctx.resolvePathPluginRoot` + `ctx.pathPluginPin` callback shape `domain/plugin-resolver.ts` already exposes. |
| Held-row vocabulary / severity / cause line | API / Backend (notification layer: `shared/notification-types.ts`, `notification-grammar.ts`, `notify-reasons.ts`) | — | Closed-set amendment, exactly the D-10-09 checklist; severity derives for free from `skipSeverity` (see Finding 3). |

## Standard Stack

No new external package. `semver` (already the project's own runtime dependency per `domain/dependency-range.ts` header, `[VERIFIED: extensions/pi-claude-marketplace/domain/dependency-range.ts:8-11]`) is reused unchanged. No installation step is needed.

### Alternatives Considered

Not applicable — CONTEXT.md's decisions already pick the reuse path (D-10-04, D-10-17, D-10-02) over any alternative library or hand-rolled evaluator.

## Package Legitimacy Audit

Not applicable. This phase installs no external package; every module it touches or adds is first-party code inside `extensions/pi-claude-marketplace/`.

## Architecture Patterns

### System Architecture Diagram

```
             update <plugin> | update <mp> | update (all) | autoupdate cascade
                                         |
                                         v
                          orchestrators/plugin/update-flow.ts
                                (runPluginUpdate)
                                         |
                                         v
                     orchestrators/plugin/update-preflight.ts
                              (preparePluginUpdate)
        1. triageUpdateMembership  ---------------------------------+
        2. [NEW] constraint gate (injected field, default composed) |
           - invert buildScopeDeclarationDetail -> dependents[]     |
           - intersectDependencyRanges(dependents' ranges)          |
           - STAGE ONE: probe tags (git: dependency-tag-probe.ts /  |
             path: marketplace-tag-probe.ts), pick highest          |
             satisfying tag -> pin (sha or path-tag oid)            |
        3. resolveUpdateCandidate(entry, ..., clone.probe) ---------+
           - clone.probe wraps pin: {...gitSource, sha: pin} OR
             ctx.pathPluginPin / ctx.resolvePathPluginRoot
        4. deriveUpdateToVersion -- [FIX NEEDED, see Finding 1]:
           must prefer the pinned tag's own `version` over
           shaVersion(resolvedSha) when a pin was applied
        5. STAGE TWO (no satisfying tag / no tags at all):
           resolve as today, then re-check derived toVersion
           against the SAME intersected range -> proceed or hold
                                         |
                     held? --------------+----------------- not held?
                     |                                            |
                     v                                            v
         PluginUpdateSkippedOutcome                    PreparedPluginUpdate
         reasons: [new token]                                     |
         notes: [cause text]                                      v
         cause: Error(...)  [NEW FIELD, Finding 2]     update-swap.ts (unchanged,
                     |                                   already reads toVersion/
                     v                                   resolvedSha off the prepared
     update-cascade.ts / update.messaging.ts             record)
     (manual / autoupdate cascades) -- severity
     via skipSeverity(reasons) -> "warning" for any
     non-idempotent reason, for FREE (Finding 3)
                     |
                     v
     notification-grammar.ts::composePluginLinesWith
     -- MUST add "skipped" to its cause-bearing status
        gate (currently failed/manual recovery/
        disabled/uninstalled only) [Finding 2]
```

### Recommended Project Structure

No new directories. One new file at `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts` (working name — CONTEXT.md leaves the exact name to the planner, D-10 Claude's Discretion), paired with `tests/orchestrators/plugin/update-constraint-gate.test.ts` (pairing convention below).

### Pattern 1: Leaf composed through an injected field, default baked in

**What:** A pure(ish) orchestrator leaf exposes its real dependencies as an optional `seam`/field parameter defaulted to the real implementation, so `preparePluginUpdate` can inject a test double without a DI framework.
**When to use:** Exactly this phase's D-10-02 requirement.
**Example (the exact model to copy):**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts:17-39
export interface InstallCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

export interface InstallCloneProbeOptions {
  readonly source: GitBackedSource;
  readonly locations: ScopedLocations;
  readonly seam?: InstallCloneCacheSeam;
  readonly auth: { /* ... */ };
}

const REAL_INSTALL_CLONE_CACHE_SEAM: InstallCloneCacheSeam = {
  resolvePluginPin,
  materializePluginClone,
  materializeOrRefreshPluginMirror,
};

export async function probeInstallClone(options: InstallCloneProbeOptions): Promise<{
  readonly result: GitPluginRootResult;
  readonly resolvedSha: string | undefined;
}> {
  const seam = options.seam ?? REAL_INSTALL_CLONE_CACHE_SEAM;
  // ...
}
```
`update-preflight.ts` already uses the identical shape for `UpdateCloneCacheSeam` / `cloneCacheSeam` (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:50-54, 565-570]`) — the new leaf's injected field on `PreparePluginUpdateOptions` should sit right beside it.

### Pattern 2: Invert an already-built declarations map instead of re-walking

**What:** `dependency-verdict.ts`'s `constraintsByKey` shows exactly how to fold several `AddressedDependency` entries into `Map<key, ranges[]>` — this is the D-10-04 inversion the new leaf performs, just keyed the other direction (by the DECLARED key, collecting which DECLARERS name it, instead of by the declarer, collecting what it declares).
**When to use:** D-10-04's dependents lookup.
**Example:**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:168-183
function constraintsByKey(
  declared: readonly AddressedDependency[],
): ReadonlyMap<string, readonly string[]> {
  const byKey = new Map<string, string[]>();
  for (const dependency of declared) {
    const key = `${dependency.name}@${dependency.marketplace}`;
    const ranges = byKey.get(key) ?? [];
    if (dependency.version !== undefined) {
      ranges.push(dependency.version);
    }
    byKey.set(key, ranges);
  }
  return byKey;
}
```
The new leaf's inversion walks `ScopeDeclarationDetailResult.declarations` (a `ReadonlyMap<declarerKey, readonly AddressedDependency[]>`, `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:150-159]`) and, for each declarer's entries, keeps only those whose `${dep.name}@${dep.marketplace}` equals the TARGET plugin's key (D-10-04's "filters ... down to those naming this plugin's key"), retaining the declarer's own key and its enabled/disabled bit (read separately off `state.marketplaces[mp].plugins[name].enabled` — see Finding 4 below, `declarations` does NOT carry the record itself).

### Pattern 3: Three-way tag-probe decode shared by both source kinds

**What:** `install-cascade.ts::toMemberConstraintOutcome` decodes ONE probe-result shape (`pinned` / `no-matching-tag` / `tag-listing-failed`) that both `probeDependencyTags` (git) and `probeMarketplaceTags` (path) converge on, so the decode is written once.
**When to use:** Stage one of D-10-01, on both source kinds.
**Example:**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:625-659
function toMemberConstraintOutcome(
  member: ClosureMember,
  range: string,
  probed:
    | { readonly kind: "pinned"; readonly oid: string; readonly version: string }
    | { readonly kind: "no-matching-tag"; readonly range: string }
    | { readonly kind: "tag-listing-failed"; readonly classification: DependencyTagListingFailureReason },
): MemberConstraintOutcome {
  if (probed.kind === "pinned") {
    return { kind: "resolved", member: { ...member, pin: { oid: probed.oid, version: probed.version } } };
  }
  if (probed.kind === "no-matching-tag") {
    return { kind: "failed", failure: { kind: "no-matching-tag", key: member.key, range: probed.range } };
  }
  return { kind: "failed", failure: { kind: "tag-listing-failed", key: member.key, range: renderConstraintRange(range), classification: probed.classification } };
}
```
The install cascade's `resolveMemberTagSource` (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:574-602]`) is the exact model for the update-side "git vs. path vs. absent" decision: it calls `parsePluginSource(declared.entry.source).kind` and branches `url|git-subdir|github -> git`, `path -> path`, else `absent`. The update leaf makes the identical call on `triaged.entry.source`.

### Pattern 4: Pin threaded through the resolver's own callback contract, never a new field

**What:** `domain/plugin-resolver.ts`'s `ResolveContext` already has BOTH the git-pin mechanism (`ctx.resolveGitPluginRoot` callback, which the caller can wrap to override `sha`) and the path-pin mechanism (`ctx.resolvePathPluginRoot` + `ctx.pathPluginPin`, D-07-06). Install already uses both (Phase 3/7); update-preflight.ts currently uses NEITHER — it calls `resolveStrict(entry, { marketplaceRoot, resolveGitPluginRoot })` with no `pathPluginPin` / `resolvePathPluginRoot` at all (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:257]`), and its `resolveGitPluginRoot` argument is `clone.probe`, which pins ONLY when the parsed source already carries `sha` (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:223-227]`).
**When to use:** D-10-17's pin-threading.
**Example (install's exact wrap, to be mirrored for update):**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:463-509
const resolved = await resolveStrict(entry, {
  marketplaceRoot: sourceMp.marketplaceRoot,
  resolveGitPluginRoot: async (gitSource) => {
    const clone = await (opts.cloneProbe ?? probeInstallClone)({
      // RESV-03: a pinned dependency materializes the exact commit its
      // release tag resolved to. Overriding `sha` is what routes the probe
      // down its already-pinned arm, so no second materialization path
      // exists for a constrained install.
      source: opts.sourcePinOverride === undefined ? gitSource : { ...gitSource, sha: opts.sourcePinOverride },
      locations,
      auth: { /* ... */ },
    });
    resolvedSha = clone.resolvedSha;
    return clone.result;
  },
  ...(opts.sourcePinOverride !== undefined && {
    pathPluginPin: opts.sourcePinOverride,
    resolvePathPluginRoot: async (pathSource, pin) => {
      const result = await (opts.pathPinProbe ?? materializeMarketplaceTagClone)({
        locations, marketplaceRoot: sourceMp.marketplaceRoot,
        marketplaceSource: sourceMp.source, marketplaceName: sourceMp.name,
        pathSource, tagOid: pin,
      });
      if (result.kind === "materialized") { resolvedSha = result.resolvedSha; }
      return result;
    },
  }),
});
```
Note that BOTH the git and path branches receive the SAME string (`sourcePinOverride`, the tag's commit oid). `update-preflight.ts`'s `resolveUpdateCandidate` (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:250-296]`) will need the analogous plumbing: a pin (oid, from stage one) closes over `clone.probe` on the git arm, and a NEW `pathPluginPin`/`resolvePathPluginRoot` pair must be added to its `resolveStrict` call for the path arm — today entirely absent.

### Anti-Patterns to Avoid

- **Don't mutate `entry.source` to inject the pin.** Neither install nor the pattern above ever rewrites the `PluginEntry` — the pin travels through the `ResolveContext` callback closures, not the entry. `entry` stays the raw manifest-declared shape throughout (`preflightStages` re-derives `parsePluginSource(entry.source)` internally at `domain/plugin-resolver.ts:498`, so a caller-side mutation would have to survive that re-parse anyway — the callback-closure route is strictly simpler and is what install already does).
- **Don't add a second range-intersection evaluator.** `intersectDependencyRanges` is the one place "what several declared ranges come to" is answered (`domain/dependency-range.ts` header, `[VERIFIED: extensions/pi-claude-marketplace/domain/dependency-range.ts:1-16]`).
- **Don't add a new field to `PreparedPluginUpdate`.** D-10-17 is explicit and the "optional field silent-omission class" is a named, recurring defect class in this codebase (three prior instances per MEMORY.md); `toVersion` / `resolvedSha` already exist and already flow through `update-swap.ts::applyAllSuccessRecordFields` (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:569-589]`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Folding several declared ranges into one | A second intersection routine | `domain/dependency-range.ts::intersectDependencyRanges` | Already caps input size (4096 chars) and projected conjuncts (1024) before any parse; a second evaluator would need to reimplement both caps or reopen a DoS surface. |
| Picking the highest tag that satisfies a range | A version-sort-and-filter loop | `domain/release-tag.ts::selectHighestSatisfyingTag` | Already used by both existing probes; already tested against prefix-matching and semver-comparison edge cases. |
| Deciding whether a dependency's source is git or path | A fresh `parsePluginSource` branch | `install-cascade.ts::resolveMemberTagSource`'s exact branch shape (git: `url`\|`git-subdir`\|`github`; path: `path`; else `absent`) | This is the established, tested decision; a second copy is a second place to drift when a fourth source kind is ever added. |
| Deciding who declares a given plugin, with ranges | A new state-document walk | `orchestrators/plugin/dependency-index.ts::buildScopeDeclarationDetail`, inverted | It is already offline, already fail-closed (D-05-07), already indexes disabled records (D-05-04), and is already pinned by the network-free gate — a sibling walk is a second answer to "what does X declare" (D-10-04's own reasoning). |

**Key insight:** every sub-problem this phase touches was already solved once, for install (Phase 3) or load-time check (Phase 6) or uninstall (Phase 5). The risk in this phase is not "solve a hard problem" but "find the exact precedent and copy its shape without drifting a field name or an edge case."

## Runtime State Inventory

Not applicable — this is neither a rename nor a refactor of persisted-state shape. `PreparedPluginUpdate` gains no field (D-10-17); `PluginInstallRecord`'s key set (pinned by COMPAT-01, `[VERIFIED: tests/shared/notification-types.test.ts:688-701]`) is untouched by this phase.

## Common Pitfalls

### Pitfall 1: `deriveUpdateToVersion` silently records the wrong version for a pinned git update

**What goes wrong:** `deriveUpdateToVersion` (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:229-240]`) is:
```typescript
async function deriveUpdateToVersion(
  entry: PluginEntry,
  installable: MaterializablePlugin,
  resolvedSha: string | undefined,
): Promise<string> {
  const kind = parsePluginSource(entry.source).kind;
  if ((kind === "url" || kind === "git-subdir" || kind === "github") && resolvedSha !== undefined) {
    return shaVersion(resolvedSha);
  }
  return resolvePluginVersion(entry, installable);
}
```
and `shaVersion` (`[VERIFIED: extensions/pi-claude-marketplace/domain/version.ts:42-44]`) is `"sha-" + fullSha.slice(0, 12)`. For ANY git-backed source with a `resolvedSha`, this fires — whether that sha came from an ordinary unpinned clone refresh OR from stage one's satisfying-tag pin. The pinned arm of `DependencyTagProbeResult` / `SelectedReleaseTag` carries the tag's OWN semver in `.version` (`[VERIFIED: extensions/pi-claude-marketplace/domain/release-tag.ts:46-53]`, `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts:59-65]`), and the install-side documentation states plainly that a tag-pinned dependency "records the version the tag names, for example `1.2.0`. It does not record a git object name" (`[VERIFIED: docs/dependency-resolution.md:94]`). If `deriveUpdateToVersion` is left as-is, a stage-one pin would still write `sha-a1b2c3d4e5f6` into `record.version` instead of `1.2.0`.
**Why it happens:** the function has no way today to know a pin was applied — `resolvedSha` alone does not distinguish "pinned to a release tag" from "refreshed to the branch head."
**How to avoid:** the leaf (or `preparePluginUpdate`) must carry the pinned tag's `version` string alongside the pin's `oid`/`sha`, and `deriveUpdateToVersion`'s caller must prefer it over `shaVersion(resolvedSha)` whenever a pin was applied — for BOTH the git arm (tag `.version`) and the path arm (a pinned path source's tag `.version`, or fall through to `resolvePluginVersion` reading the pinned tree's own manifest, which is already correct because `installable.pluginRoot` will already point at the pinned tag's materialized tree).
**Warning signs:** a catalog fixture or a live-session `update` on a tag-pinned dependency renders `v#sha-...` in the version-arrow instead of the tag's semver.

### Pitfall 2: the held row has nowhere to put its cause line today

**What goes wrong:** D-10-10/D-10-11 want a `cause:` trailer naming constraining plugins (mirroring the LOAD-01 `Update "X" to satisfy R, or uninstall "Y"` remedy, `[VERIFIED: docs/dependency-resolution.md:198-202]`). But:
- `PluginSkippedMessage` (`[VERIFIED: extensions/pi-claude-marketplace/shared/notification-types.ts:452-458]`) has fields `status`, `name`, `reasons`, `version?`, `scope?` — **no `cause`**.
- `notification-grammar.ts::composePluginLinesWith` is the ONE place a `cause:` trailer is composed, and it gates on `p.status === "failed" || p.status === "manual recovery" || p.status === "disabled" || p.status === "uninstalled"` (`[VERIFIED: extensions/pi-claude-marketplace/shared/notification-grammar.ts:1638-1643]`) — `"skipped"` is absent from that list.
- Both cascades' rendering routes through this composer: `notification-dispatch.ts` calls `composePluginLinesWith(p, probe, mp.scope, renderPluginRowBody)` for cascade rows (`[VERIFIED: extensions/pi-claude-marketplace/shared/notification-dispatch.ts:370,412]`), and `UPDATE_CONTEXT`'s own render map (`orchestrators/marketplace/update.messaging.ts:64-95`) is explicitly "lifted verbatim from the central `renderPluginRow`" so it inherits the same trailer-composition path.

**Why it happens:** every existing precedent for an interpolating cause line rides a row status that is either a failure (`failed`, `manual recovery`) or already state-changed against the user's back (`disabled` via LOAD-01, `uninstalled` via LOAD-03). A held UPDATE is neither — it's the first case where a `skipped` partition needs to interpolate identifiers.
**How to avoid:** add `readonly cause?: Error;` to `PluginSkippedMessage` (mirroring the exact JSDoc precedent on `PluginDisabledMessage.cause`, `[VERIFIED: extensions/pi-claude-marketplace/shared/notification-types.ts:351-362]`, which states "It rides the cause chain because the sentence interpolates two plugin identifiers, and the cause chain is the only channel in this grammar that legally interpolates one"), and add `"skipped"` to `composePluginLinesWith`'s status list. Both edits are additive/widening, so they should not disturb any other `skipped` row's byte-frozen form (no other skipped producer sets `.cause`, so `renderIndentedCauseChain(undefined, ...)` returns `""` and pushes nothing — confirm this empty-string short-circuit exists before relying on it).
**Warning signs:** `notify-closed-set-locks.test.ts` / `compat-01-no-expansion.test.ts` stay green (they don't gate this), but a catalog fixture for the held state renders no `cause:` line at all, or a `TS2353`/`TS2739` on `PluginSkippedMessage` when the leaf tries to set `.cause`.

### Pitfall 3: severity for the held row is almost free, but two call sites decide it independently

**What goes wrong:** `skipSeverity(reasons)` (`[VERIFIED: extensions/pi-claude-marketplace/shared/notify-reasons.ts:125-131]`) returns `"warning"` unless EVERY reason in the row is in `IDEMPOTENT_REASON_SET` (`up-to-date`, `already installed`, `already autoupdate`, `already no autoupdate`, `already enabled`, `already disabled`). The new held token is not idempotent, so BOTH cascades already compute `"warning"` for it automatically, with **zero code change**, as long as the planner does not special-case it into the idempotent set:
  - Manual cascade: `update-cascade.ts::cascadeSkipSeverity` (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts:44-57]`) only special-cases `not installed`/`not found` (→ `error`) and `no longer installable` (→ cardinality-dependent); everything else falls through to `skipSeverity(reasons)`.
  - Autoupdate cascade: `update.messaging.ts`'s `"skipped"` case (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts:187-199]`) calls `skipSeverity(reasons)` directly, with no cardinality branch at all.
**Why it happens / matters:** D-10-12 calls this out explicitly as "a deliberate departure from the SEV-01/WR-01 split" and asks the planner to "state this divergence explicitly where the severity is set, so the next reader does not 'fix' it back to the split." Since the divergence is achieved by DOING NOTHING SPECIAL (the default `skipSeverity` behavior already produces `warning` on both surfaces), there is a real risk a future reviewer "fixes" one of the two cascades to match the WR-01 `info`-for-autoupdate pattern used by the `updated` partition (`update.messaging.ts:171-174`), not realizing the `skipped` partition's default already IS `warning` and must STAY that way.
**How to avoid:** leave `cascadeSkipSeverity` and the autoupdate `"skipped"` case untouched (no bespoke branch for the new token), but add an inline comment at BOTH call sites stating the new token relies on the `skipSeverity` default and must never be added to `IDEMPOTENT_REASONS`.
**Warning signs:** a future PR moves the new token into `IDEMPOTENT_REASONS` "for consistency" (it would silently downgrade the held row to `info` on every surface).

### Pitfall 4: `contracts.json` line:col pins will shift under every edit to `update-preflight.ts` / `dependency-index.ts`

**What goes wrong:** `scripts/check-unused-type-members.contracts.json` pins several members of `update-preflight.ts`, `update-swap.ts`, `dependency-index.ts`, `dependency-tag-probe.ts` and `marketplace-tag-probe.ts` at EXACT `file:line:col` locations (`[VERIFIED: scripts/check-unused-type-members.contracts.json:621-650,792-813,961-974,1065-1070]`, e.g. `"id": "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:132:56"`). Any line inserted or removed above one of these anchors in the edited file invalidates the pin, and `npm run lint:type-members` fails with a stale-contract error rather than a helpful diff.
**Why it happens:** the gate is a whole-program static analysis whose accepted-exception list is line-anchored, not name-anchored (per MEMORY.md's "contracts.json pins are line:col").
**How to avoid:** run `npm run lint:type-members:audit` after editing either file and remap any shifted `id`/`filter`/`refines` triples before considering the task done; do not treat a green `npm run check` from BEFORE the edit as evidence this gate will stay green after.
**Warning signs:** `npm run lint:type-members` reports a member at a line that no longer holds the type it names.

### Pitfall 5: cognitive-complexity headroom on `preparePluginUpdate` is already thin

**What goes wrong:** the ESLint `sonarjs/cognitive-complexity` rule is capped at 15 for orchestrator code (`[VERIFIED: eslint.config.js:88]`, repeated at lines 336, 458), and `update-preflight.ts` is 629 lines (`[VERIFIED: wc -l extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts]`) with `preparePluginUpdate` already composing `triageUpdateMembership`, `makeUpdateCloneProbe`, `resolveUpdateCandidate`, `deriveUpdateToVersion`, and the disabled-refresh branch (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:541-618]`). D-10-02's own stated rationale is this exact ceiling.
**Why it happens:** every new conditional branch inside `preparePluginUpdate` itself (rather than inside the injected leaf) adds directly to its score.
**How to avoid:** call the new leaf as ONE additional `await` + one `if ("held" in verdict)`-shaped branch inside `preparePluginUpdate`, keeping every constraint-specific branch (git-vs-path decode, stage-one/stage-two split, cause-line composition) inside the leaf itself, exactly as D-10-02 directs.
**Warning signs:** `npm run lint` (ESLint) fails on `preparePluginUpdate` with a cognitive-complexity violation after the gate is wired in inline.

## Code Examples

### The dependents-lookup starting point (verbatim, to invert)
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:150-159
export type ScopeDeclarationDetailResult =
  | {
      readonly ok: true;
      readonly declarations: ReadonlyMap<string, readonly AddressedDependency[]>;
    }
  | {
      readonly ok: false;
      readonly declarer: string;
      readonly cause: Error;
    };
```
Called as `buildScopeDeclarationDetail({ state, locations })` — no `exclude` parameter (unlike its `buildScopeDeclarationIndex` sibling), because "the load-time question has no key under decision, so every record is at once a potential declarer and a potential dependency" (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts:54-58]`). The update-side leaf calls it the SAME way (no exclude) and does its own filtering after the fact, exactly as `dependency-verdict.ts`'s `unsatisfiedEntries` does.

### Reading a declaring record's enabled/disabled bit (Finding 4)
`declarations` is keyed by `${name}@${marketplace}` and its VALUES are `readonly AddressedDependency[]` — plain declaration data, no `enabled` bit attached. To answer D-10-11's "which of them are disabled," the leaf must separately look up `state.marketplaces[mp]?.plugins[name]?.enabled` for each declarer key it collects, using `isRecordedButDisabled` (`[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:283-284]`, `return !record.enabled;`) exactly as `dependency-verdict.ts::recordedPlugins` does when it builds its own `Map<key, RecordedPlugin>` alongside the declarations walk (`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts:143-155]`).

### The two probe result shapes converge on ONE selector
```typescript
// Source: extensions/pi-claude-marketplace/domain/release-tag.ts:46-53
export type SelectedReleaseTag =
  | { readonly kind: "pinned"; readonly tag: string; readonly oid: string; readonly version: string }
  | { readonly kind: "no-matching-tag"; readonly range: string };
```
`dependency-tag-probe.ts::probeDependencyTags` returns a structurally-superset type (`DependencyTagProbeResult`, adds `tag-listing-failed` with a `classification`), and `marketplace-tag-probe.ts::probeMarketplaceTags` returns `SelectedReleaseTag | { kind: "tag-listing-failed"; cause: Error }` (no `classification` — a local read has nothing to classify). Both funnel through `selectHighestSatisfyingTag(candidates, prefix, range)` (`[VERIFIED: extensions/pi-claude-marketplace/domain/release-tag.ts:99-113]`).

## State of the Art

Not applicable in the "external ecosystem moved" sense — this is an internal-codebase phase. The one relevant "state of the art" fact is that the codebase's OWN pattern for this exact kind of gate has been iterating for 3 prior phases (3, 7, 9) and Phase 10 is asked to be the 4th application, not a new design.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `update` never reads constraints | `update`/`autoupdate` gate every move through the intersected declared range | This phase (UPDT-01/02) | Closes the last of the four upstream-parity gaps opened by RESV-01..06 (install already gates; load-time already gates; update did not). |

**Deprecated/outdated:** none — no prior update-side constraint mechanism exists to deprecate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `renderIndentedCauseChain(undefined, indent)` returns `""` and therefore adds no line for a `skipped` row whose `.cause` is unset — inferred from the function's use pattern at `notification-grammar.ts:1644-1647` (`if (trailer !== "") { lines.push(trailer); }`) but the function body itself (`notification-grammar.ts:1061`) was not read this session. | Pitfall 2 / Finding 2 | If wrong, widening `PluginSkippedMessage` with an optional `cause` field could print an empty or malformed trailer line on every EXISTING skipped row once the type allows the field, even though no other producer sets it — Wave 0 must add a byte-equality regression test for at least one pre-existing skipped-row fixture before relying on this. |
| A2 | The working name `update-constraint-gate.ts` for the new leaf module is illustrative only; CONTEXT.md explicitly leaves the file name to the planner (D-10 Claude's Discretion). | Architecture Patterns | None — purely a naming placeholder, not a locked decision. |
| A3 | `resolvePathPluginRoot`'s callback signature (`(parsedSource, pin) => Promise<GitPluginRootResult>`) shown in `deriveSourcePluginRoot` (`domain/plugin-resolver.ts:392-393`) is assumed compatible with a `materializeMarketplaceTagClone`-shaped call the same way install's `install-outcome.ts:494-508` uses it; the `ResolveContext` interface's own declaration (its full field list/JSDoc) was not read this session, only its two call sites. | Pattern 4 | Low — both call sites agree on the shape used; if `ResolveContext`'s declared type differs subtly (e.g., extra required fields), a TypeScript compile error will surface it immediately during planning/execution, not silently. |

**If this table is empty:** N/A — three assumptions recorded above, all low-to-moderate risk and self-revealing (either a test fails or a compile error surfaces).

## Open Questions

1. **Exact wording of the new reason token and its cause-line sentence.**
   - What we know: CONTEXT.md gives a working name (`dependents constrain`) and explicitly defers exact wording to the planner against `docs/messaging-style-guide.md`; upstream's own string is available for structural reference (`Autoupdate held "<plugin>" at <version> — version constraint from <A, B> (note: <B> is currently disabled)`).
   - What's unclear: whether the three arms (disjoint declarations / no satisfying tag / fetched version out of range, D-10-10) share ONE cause-line composer or three, also left to planner discretion.
   - Recommendation: planner picks the wording and composer count; this research does not need to pre-decide it, since CONTEXT.md already scopes it as discretion.

2. **Whether `ResolveContext`'s full field list needs a NEW optional field, or reuses `pathPluginPin`/`resolvePathPluginRoot` verbatim for the update path.**
   - What we know: install already uses `pathPluginPin: string` + `resolvePathPluginRoot: (source, pin) => Promise<GitPluginRootResult>` (D-07-06) unchanged; update-preflight.ts's current call to `resolveStrict` supplies neither.
   - What's unclear: whether `resolveUpdateCandidate`'s signature needs widening to accept a pin object (oid, tag version) that it then threads into both the git-wrapping callback and the two new `resolveStrict` fields, or whether a smaller helper suffices.
   - Recommendation: planner designs `resolveUpdateCandidate`'s new signature; the mechanism (which two `ResolveContext` fields to fill) is settled by this research, the exact call shape is an implementation decision for the plan.

## Environment Availability

Skipped — this phase adds no new external tool, service, or runtime dependency. It reuses `isomorphic-git`-backed probes (`platform/git.ts::listRemoteTags`, `listTags`, `resolveTagOid`) already exercised by Phases 3 and 7, and the project's existing `semver` dependency.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` (no third-party test runner) `[VERIFIED: package.json:87]` |
| Config file | none — invoked directly via npm scripts |
| Quick run command | `node --test tests/orchestrators/plugin/update-preflight.test.ts` (swap in the new leaf's own test path once created) |
| Full suite command | `npm run check` (typecheck, lint, fallow, format:check, corresponding-tests, coverage:direct, coverage:unit at 100% lines/functions/branches, integration, lint:type-members) `[VERIFIED: package.json:78]` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UPDT-01 | Highest version inside the intersection is selected, both source kinds, all four invocation surfaces | unit | `node --test tests/orchestrators/plugin/update-preflight.test.ts` (extend) + new leaf's own test file | ✅ existing file to extend / ❌ new leaf file, Wave 0 |
| UPDT-01 | Cascade rendering (manual + autoupdate) is unaffected for an unconstrained plugin (success criterion 3's regression proof) | unit | `node --test tests/orchestrators/plugin/update-cascade.test.ts tests/orchestrators/marketplace/update.messaging.test.ts` | ✅ |
| UPDT-02 | No satisfying version anywhere → skip, reason names constraining plugin(s) | unit | new leaf's own test file + `update-preflight.test.ts` | ❌ Wave 0 |
| SC3 (network policy) | `update-flow.ts` / `update-preflight.ts` remain the only git consumers | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** the quick run command above, scoped to the file(s) touched.
- **Per wave merge:** `npm run test:coverage:direct` (100%-per-module gate; `scripts/test-coverage-direct.pin.json` currently has an EMPTY `rows: []`, `[VERIFIED: scripts/test-coverage-direct.pin.json:1-4]`, meaning there are currently NO exempted shortfalls anywhere in the tree — a new leaf module MUST ship with a paired test file achieving 100% direct coverage or this gate fails outright, not just degrades).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/orchestrators/plugin/update-constraint-gate.test.ts` (or whatever name the leaf takes) — covers UPDT-01/UPDT-02, paired per `scripts/test-coverage-direct.mjs::sourceToTest` (`extensions/pi-claude-marketplace/orchestrators/plugin/<X>.ts` ↔ `tests/orchestrators/plugin/<X>.test.ts`, `[VERIFIED: scripts/test-coverage-direct.mjs:31-40]`).
- [ ] A byte-equality catalog fixture for the held row (both cascades) in `tests/architecture/catalog-uat/fixtures/plugin-update.ts` — required by `catalog-contract.test.ts`'s exact-state-count assertion (currently 222 states / 30,538 UTF-8 bytes, `[VERIFIED: tests/architecture/catalog-uat/catalog-contract.test.ts:123-124]`; both constants must be bumped in the SAME change as the new fixture).
- [ ] Framework install: none — `node:test` is built in.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no | Update reuses the existing credential bundle (`DEFAULT_CREDENTIAL_OPS`, `buildAuthForHost`) already wired into `update-preflight.ts`; no new auth surface. |
| V3 Session Management | no | N/A — CLI extension, no session concept. |
| V4 Access Control | no | No new privilege boundary; the gate only READS declared ranges and installed records already reachable by every other command in this scope. |
| V5 Input Validation | yes | `intersectDependencyRanges` already caps total input size (4096 chars) and projected conjuncts (1024) before parsing (`domain/dependency-range.ts:28,37`), reused unchanged — the new leaf must not bypass these caps by calling `semver` directly. |
| V6 Cryptography | no | No cryptographic operation is added; git-transport TLS/SSH is unchanged infrastructure. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| A crafted tag name selecting an arbitrary unpinned ref | Tampering | `selectHighestSatisfyingTag`'s prefix test (`readPinCandidate`, `[VERIFIED: extensions/pi-claude-marketplace/domain/release-tag.ts:73-88]`) rejects any candidate not starting with `${pluginName}--v`, reused unchanged by this phase — no new selection logic is introduced. |
| ReDoS / combinatorial explosion via a crafted multi-declaration range set | Denial of Service | `intersectDependencyRanges`'s two project-owned caps (checked BEFORE parsing, `domain/dependency-range.ts:82-97,147-165`), reused unchanged. The new leaf must call this function rather than hand-rolling a fold, or the caps are lost. |
| Credential leakage across the new leaf's tag-probe call | Information Disclosure | `AUTH-09`'s established rule — no credential value is read, stored, or placed on a returned arm (`dependency-tag-probe.ts:28-31`); the leaf must thread the SAME `{ctx, credentialOps, deviceFlowHttp?, authMemo?}` bundle `update-preflight.ts` already builds (`update-preflight.ts:572-577`), not compose a second one. |

## Sources

### Primary (HIGH confidence — read this session)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` (full file, 629 lines)
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts` (full file, 276 lines)
- `extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts` (full file, 320 lines)
- `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts` (full file)
- `extensions/pi-claude-marketplace/domain/release-tag.ts` (full file)
- `extensions/pi-claude-marketplace/domain/dependency-range.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` (lines 560-802, tag-source/constraint-outcome sections)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` (lines 440-510, 160-190)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts` (lines 428-747, finalize/apply-record sections)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts` (full file)
- `extensions/pi-claude-marketplace/orchestrators/types.ts` (lines 240-370, outcome type definitions)
- `extensions/pi-claude-marketplace/shared/notification-types.ts` (lines 1-210, 343-460)
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` (full file)
- `extensions/pi-claude-marketplace/shared/notification-grammar.ts` (lines 533-570, 1590-1656)
- `extensions/pi-claude-marketplace/domain/plugin-resolver.ts` (lines 355-595)
- `extensions/pi-claude-marketplace/domain/version.ts` (lines 42-44)
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` (lines 1063-1080)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (`enabled`/`isRecordedButDisabled` region)
- `tests/architecture/gate-targets.ts` (full file)
- `tests/architecture/no-orchestrator-network.test.ts` (full file)
- `tests/architecture/notify-closed-set-locks.test.ts` (full file)
- `tests/architecture/compat-01-no-expansion.test.ts` (full file)
- `tests/architecture/dependency-doc-agreement.test.ts` (full file)
- `tests/architecture/catalog-uat/catalog-contract.test.ts` (full file)
- `tests/shared/notification-types.test.ts` (full file)
- `docs/dependency-resolution.md` (lines 82-280, resolution/promotion/uninstall/load-time/failure sections)
- `docs/output-catalog.md` (state/byte-count region and grep survey)
- `scripts/test-coverage-direct.mjs` (lines 1-70)
- `scripts/test-coverage-direct.pin.json` (full file)
- `scripts/check-unused-type-members.contracts.json` (grep survey for update-family/dependency-index entries)
- `docs/unused-type-member-gate.md` (lines 1-80)
- `eslint.config.js` (complexity-rule grep)
- `.planning/config.json`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/phases/10-constraint-aware-update/10-CONTEXT.md`

### Secondary (MEDIUM confidence)
- None used — no web/docs lookup was needed; this is a pure in-repo refactor phase and every claim above was verified against source in this session.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new package, `semver` reuse confirmed in `domain/dependency-range.ts`.
- Architecture: HIGH — every pattern cited has a same-session `Read` of the exact precedent file/lines.
- Pitfalls: HIGH for Findings 1-3 (each backed by a direct code read showing the gap); MEDIUM for the exact remediation shape (left to planner discretion per CONTEXT.md).

**Research date:** 2026-09-22
**Valid until:** 30 days (stable internal codebase; the only external-facing risk is upstream Claude Code CLI behavior drift, which this phase does not re-verify against a live binary — CONTEXT.md's `<specifics>` already cites the 2.1.267 binary strings as the reference).
