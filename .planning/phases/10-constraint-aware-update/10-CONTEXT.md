# Phase 10: Constraint-aware update - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning

<domain>
## Phase Boundary

An update never moves a plugin outside the range the installed plugins that
declare it hold it to. When the declared ranges leave room, the update selects
the highest available version inside their intersection; when they leave none,
that plugin's update is skipped and its row names who is holding it. Every
other plugin in the same run updates as before.

This covers all four surfaces, because all four route through
`runPluginUpdate` -> `preparePluginUpdate`: `update <plugin>`,
`update <marketplace>`, `update` (all), and the autoupdate cascade that
`orchestrators/marketplace/update.ts` drives through its injected
`pluginUpdate` seam.

Out of scope: changing what a dependency declaration MEANS (Phase 3 owns the
range algebra), the load-time satisfaction check (Phase 6 owns LOAD-01), and
the cross-marketplace allowlist (Phase 11).

</domain>

<decisions>
## Implementation Decisions

### Gate shape

- **D-10-01:** The gate is **two staged checks**, matching upstream's
  `updatePluginOp` in the 2.1.267 binary. Stage one intersects every
  constraining dependent's range and probes for the highest release tag
  satisfying it; a hit pins the update to that tag. Stage two runs when stage
  one found no satisfying tag: the candidate resolves as it does today, and the
  derived `toVersion` is then re-checked against the intersection — in range the
  update proceeds, out of range it is held. Stage two is what catches a
  repository with no release tags at all and a path source whose current copy
  has drifted out of range; without it, UPDT-01 is unmet for exactly the cases
  the tag probe cannot answer. Upstream's own debug line marks the seam:
  `no <name>--v* tag satisfying <range>; falling back to HEAD + post-fetch guard`.
  — **Reversibility:** costly — dropping stage two later means re-opening every
  update-row test that asserts a held row on a no-tag source.

- **D-10-02:** The intersection, the dependents lookup and the tag probe live in
  a **new leaf module** that `update-preflight.ts` composes through an injected
  field, rather than inline in `preparePluginUpdate`. The composition
  arrangement is the one `install-clone-probe.ts` already uses. Two reasons:
  `preparePluginUpdate` is already near the cognitive-complexity cap that ESLint
  and fallow both gate at 15, and a leaf gives the unit test a direct target
  instead of forcing every constraint case through the whole preflight.

- **D-10-03:** The gate sits **after `triageUpdateMembership` and before
  `resolveUpdateCandidate`**. Triage is what establishes there is a record and a
  manifest entry to constrain at all; running the gate before it would have to
  answer "who declares a plugin that is not installed".

- **D-10-04:** The dependents come from **`buildScopeDeclarationDetail`, inverted
  inside the leaf** — the leaf filters its `AddressedDependency` entries down to
  those naming this plugin's key and keeps their declared ranges. No new walk in
  `dependency-index.ts`. That walk is already offline, already fail-closed
  (D-05-07), already indexes disabled records (D-05-04), and is already pinned
  by the network-free gate. A third sibling walk would be a second answer to
  "what does X declare" that has to stay consistent with the first two.

- **D-10-05:** When the fail-closed walk refuses — a dependent's declarations
  cannot be established — **that plugin's update is skipped and the row carries
  the walk's cause line naming the unreadable declarer**. An unestablished
  declaration set may hide a range, and updating past an unknown constraint is
  precisely what the walk exists to prevent. This matches the uninstall
  refusal's shape (`{unreadable}` plus a naming cause line,
  `docs/dependency-resolution.md` §146), and differs from it only in that an
  update is skipped rather than refused.

### Who constrains

- **D-10-06:** **Every installed record in the same scope constrains, enabled or
  disabled.** Upstream reads `[...enabled, ...disabled]`, and D-05-04 already
  says it in this codebase's own words: installed is installed, and a disabled
  record keeps its declarations exactly as it keeps its inventory. The
  alternative — enabled only — would let an update move a dependency out of
  range while a dependent is briefly disabled, so re-enabling it would find a
  constraint that can no longer be satisfied.

- **D-10-07:** **Constraints are scope-local.** Each scope's update intersects
  only the ranges declared by records in that same state document (D-05-05), so
  a bare `update` fanning out over project and user evaluates each scope
  independently. Consistent with every other dependency surface in the
  extension; the alternative would make a user-scope plugin's update depend on
  which project directory the command ran in.

- **D-10-08:** **Provenance does not change the gate.** The question is who
  declares this key, not how the record got here, so a directly-installed plugin
  that something also depends on is held exactly as a `provenance: "dependency"`
  one is. Upstream reads declarations and never reads provenance here, and
  UPDT-01 carves out no exception.

### Skip row vocabulary

- **D-10-09:** The held row carries **one new closed-set reason token** (working
  name `dependents constrain` — the planner settles the exact two-or-three-word
  wording against `docs/messaging-style-guide.md`). Neither existing neighbour
  fits: `version conflict` already covers two subjects (declarations that
  contradict each other, and an installed copy outside them) and this is a third
  where nothing contradicts anything; `no matching version` says the source
  advertised no tag in range, which misdescribes the post-fetch-guard arm where a
  version WAS found and simply is not admissible. This is a closed-set amendment
  and touches every pin surface: the `REASONS` tuple, the `notify-reasons.ts`
  header count, `docs/output-catalog.md` (state and byte counts, pinned by
  `tests/architecture/catalog-uat/catalog-contract.test.ts` and
  `catalog-parser.test.ts`), and `tests/architecture/notify-closed-set-locks.test.ts`.
  — **Reversibility:** one-way — the token is published user-visible output and a
  catalog state; removing it later means a catalog amendment plus a byte-count
  change on every pinned surface.

- **D-10-10:** **One token, three arms, distinguished on the cause line.**
  Disjoint dependent ranges, no tag satisfying the intersection, and a fetched
  version outside the intersection all render the same brace; the cause line says
  which situation it is and names the holders. A reason token is one to three
  lowercase words and the set is a literal tuple, so it cannot interpolate an
  identifier — the split follows the `dependency cycle` and `dependents
  unsatisfied` precedent, where the token names the condition and the naming
  rides the cause line.

- **D-10-11:** The cause line **names the constraining plugins and marks which of
  them are disabled**. Upstream's remedy points at the disabled holder first
  (`Update or uninstall "B" to unblock (it is currently disabled)`), and without
  the marking a user is told to update a plugin that is not even loading.

- **D-10-12:** Severity of the held row is **warning on every surface, including
  the autoupdate cascade**. This is a deliberate departure from the SEV-01 /
  WR-01 split already in `update-row.ts`, where the autoupdate cascade stays
  `info` for an absent companion. The reasoning differs: an absent soft-dep
  companion is a thing the user could not act on anyway, whereas a constraint
  hold is a state that persists across every future run until the user changes a
  declaration — a background run that reports it at `info` hides the one fact
  that explains why the plugin never moves. Planner: state this divergence
  explicitly where the severity is set, so the next reader does not "fix" it back
  to the split.

- **D-10-13:** When the plugin is already at the highest version the intersection
  admits, the row **keeps its existing `{up-to-date}` brace** and discloses the
  range and its holders **on the cause line**. No second token and no catalog
  churn, and the user can still tell "nothing newer exists" from "nothing newer
  is allowed" — upstream discloses the same thing in prose
  (`already at the latest version satisfying ^1.2.0 (1.4.2, required by A)`).

### Path-source fallback

- **D-10-14:** For a constrained **path source** with no satisfying marketplace
  tag, the update **falls back to the marketplace's current copy and lets stage
  two decide**: in range the update proceeds, out of range it is held. This is
  upstream's shape verbatim, and it is the arm that makes D-10-01's second stage
  earn its place. Phase 7's install-side arm (D-07-07: fall back and always
  accept, leaving the constraint to LOAD-01) is deliberately NOT ported whole —
  on an install the alternative is having nothing, but on an update it would mean
  knowingly moving an in-range plugin to an out-of-range version, which is the
  thing UPDT-01 forbids.

- **D-10-15:** When that fallback lands in range, the successful row **reuses
  Phase 7's existing `{dependency current copy}` token**. Same fact, same phrase:
  no tag pinned this, the marketplace's current copy is what landed. No catalog
  amendment.

- **D-10-16:** An unreadable local tag listing folds into the same
  no-satisfying-tag arm, as it already does on the install side (D-07-07) — an
  unreadable listing and an empty one are the same user-visible fact.

### Pin threading and network policy

- **D-10-17:** The satisfying tag reaches the swap by **pinning the source the
  candidate resolves against**, so `resolvedSha` and `toVersion` come out of the
  paths that already fill them. No new field on `PreparedPluginUpdate`. This is
  D-07-02's argument one verb over — the pin is written through the same literal
  shape the git-backed arm always has, so the swap, `finalizeUpdateRecord` and
  the disabled-refresh projection (`disabledPinProjection`) need no change. A new
  optional field is the silent-omission class this milestone has already shipped
  three times: it compiles clean at every derivation site that forgets it.

- **D-10-18:** **One tag memo per run, shared across the whole bulk update.** A
  bulk `update` or an autoupdate cascade touches many plugins from one
  marketplace; a run-scoped memo bounds that to one listing per URL and one per
  marketplace root, exactly as the install cascade's `tagMemo` /
  `marketplaceTagMemo` already do. This is also what keeps the autoupdate
  cascade's warm-cache expectation honest for path sources.

- **D-10-19:** No gate edit is needed. `update-preflight.ts` is already outside
  `NETWORK_FREE_TARGETS` (it is one of the update family's two permitted git
  consumers), and the new leaf follows `dependency-tag-probe.ts`'s arrangement —
  absent from `NETWORK_FREE_TARGETS`, composed and invoked through an injected
  field whose name the gate does not match. Success criterion 3 pins this:
  `update-flow.ts` / `update-preflight.ts` remain the only git consumers per
  `tests/architecture/no-orchestrator-network.test.ts`.

### Claude's Discretion

- The exact wording of the new reason token (two or three lowercase words,
  subject-first grammar per `docs/messaging-style-guide.md`).
- The leaf module's file name and its exported surface shape.
- Whether the three cause-line arms share one composer or three.
- How the unconstrained regression is proven (success criterion 3: "an
  unconstrained plugin updates exactly as before") — a byte-equality assertion
  over a rendered row is acceptable only if the fixture actually exercises the
  gate; a vacuous byte-equality that compares a value to itself is not.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone intent and upstream parity
- `.planning/HANDOFF-upstream-dependency-parity.md` — row 3 is this phase's
  source of truth for the upstream/Pi delta; "Facts a planner needs" lists the
  upstream error codes and the closed-set amendment checklist.
- `.planning/REQUIREMENTS.md` §"Constraint-aware update (UPDT)" — UPDT-01,
  UPDT-02 and the Out of Scope table.
- `.planning/ROADMAP.md` §"Phase 10: Constraint-aware update" — the three
  success criteria and the owners note.

### Behaviour docs this phase must amend
- `docs/dependency-resolution.md` — §126/§128 describe what `update` does to a
  dependency record today ("`reinstall` and `update` never promote"); the
  constraint behaviour is new prose. §146's fail-closed paragraph is the model
  for D-10-05's cause line.
- `docs/output-catalog.md` — the new reason token is a catalog state; state and
  byte counts are pinned by
  `tests/architecture/catalog-uat/catalog-contract.test.ts` and
  `tests/architecture/catalog-uat/catalog-parser.test.ts`.
- `docs/messaging-style-guide.md` — row grammar and token wording.

### Prior-phase decisions this phase builds on
- `.planning/phases/07-marketplace-repo-tag-resolution/07-CONTEXT.md` — D-07-02
  (same literal pin shape, no downstream change), D-07-03 and D-07-07 (the
  current-copy fallback and its `{dependency current copy}` token).
- `.planning/phases/06-load-time-dependency-check-and-allowed-uninstall/06-CONTEXT.md`
  — LOAD-01's out-of-range arm, which this phase must not duplicate.
- `.planning/phases/09-reload-installs-missing-dependencies/09-CONTEXT.md` —
  D-09-05 (`rootRanges` folded once) as the precedent for threading a caller's
  ranges into a resolution.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `domain/dependency-range.ts::intersectDependencyRanges` — folds N declared
  ranges into one effective range, or returns `invalid` / `disjoint` /
  `too-complex`. Already caps total input size and projected conjuncts. The
  `disjoint` arm is the first of D-10-10's three cause-line situations.
- `orchestrators/plugin/dependency-index.ts::buildScopeDeclarationDetail` —
  offline, fail-closed walk of every installed record's declarations in one
  state document, keeping the whole declaration (range included). Its
  `AddressedDependency` entries are what D-10-04 inverts.
- `orchestrators/plugin/dependency-tag-probe.ts::probeDependencyTags` — git
  source: lists remote tags, returns `pinned` / `no-matching-tag` /
  `tag-listing-failed`, with a per-URL memo and the shared host auth bundle.
- `orchestrators/plugin/marketplace-tag-probe.ts::probeMarketplaceTags` — path
  source: the same three-arm result read from the local marketplace clone, with
  a per-root memo.
- `domain/release-tag.ts::selectHighestSatisfyingTag` — the one selector both
  probes end in; this is where "highest satisfying" already lives.
- `orchestrators/plugin/install-cascade.ts::toMemberConstraintOutcome` — the
  existing three-way decode of a probe result. Worth reading before writing the
  update-side decode, which has a different destination but the same input.

### Established Patterns
- **One gate, four surfaces:** `update <plugin>`, `update <mp>`, `update` (all)
  and the autoupdate cascade all reach `preparePluginUpdate`, so the constraint
  check is written once. `orchestrators/marketplace/update.ts` reaches the plugin
  update only through its injected `pluginUpdate` seam, which is what keeps the
  `marketplace -> plugin` module edge out of the graph — do not close that cycle.
- **Preflight verdict subset (NFR-7):** `UpdatePreflightOutcome` is a strict
  subset of `UpdateRunOutcome`, so a preflight verdict returns straight through
  with no cast. A new held verdict is a `skipped` partition row and must not gain
  `cause`, `toVersion` or `phaseFailures` — the `never` proofs on
  `PreflightFailedOutcome` are load-bearing.
- **Row composition:** `update-row.ts` is the `(updated)` partition's sole
  composer, shared by both cascades so one run cannot be reported two ways; it
  takes a severity policy rather than deriving one. `update.messaging.ts` holds
  the render map total over update's own statuses — a missing arm is a TS2741
  compile error at the `satisfies` site.
- **Closed-set amendment:** every new user-visible token moves the `REASONS`
  tuple, the `notify-reasons.ts` header count, `docs/output-catalog.md`, and
  `notify-closed-set-locks.test.ts` together.

### Integration Points
- `update-preflight.ts::preparePluginUpdate` — the gate's call site (D-10-03).
- `update-preflight.ts::deriveUpdateToVersion` / `makeUpdateCloneProbe` — where
  a pinned source has to be honoured (D-10-17).
- `update-preflight.ts::skippedCandidate` / `staticPreflightRow` — the existing
  builders for a `skipped` verdict; the held row is a third caller.
- `refreshDisabledPluginUpdate` / `disabledPinProjection` — the disabled-record
  refresh path. A constrained plugin that is itself disabled still runs through
  here, so the pin has to be consistent on that arm too (WR-01 already forbids
  leaving a stale `resolvedSha` behind).
- `orchestrators/marketplace/update.ts::outcomeToCascadePluginMessage` — how a
  per-plugin outcome becomes a row in the autoupdate cascade.

</code_context>

<specifics>
## Specific Ideas

- Upstream's exact strings, read out of the 2.1.267 binary, are the reference for
  the cause-line content (not for byte-copying — Pi's row grammar differs):
  - held: `Autoupdate held "<plugin>" at <version> — version constraint from <A, B> (note: <B> is currently disabled)`
  - remedy: `Update or uninstall "<B>" to unblock (it is currently disabled)`
  - already satisfied: `<plugin> is already at the latest version satisfying <ranges> (<version>, required by <A>).`
  - debug seam: `no <name>--v* tag satisfying <range>; falling back to HEAD + post-fetch guard`
- Upstream's post-fetch guard compares the fetched manifest version against each
  dependent's range individually and reports the subset that is unsatisfied —
  not the intersection — so the message names only the dependents that actually
  reject the fetched version. Worth mirroring: naming a dependent whose range the
  fetched version DOES satisfy would send the user to the wrong plugin.

</specifics>

<deferred>
## Deferred Ideas

- **Docs sweep for the update section of `docs/dependency-resolution.md`.** The
  prose that says what `update` does to a dependency record predates every
  constraint behaviour in this phase. It is in scope to amend the parts this
  phase makes untrue; a broader rewrite of the section is not.
- **`marketplace remove` and the constraint gate.** Removing a marketplace can
  strand a constraining dependent. BACKLOG `PRUNE-GUARD-MR-01` already tracks the
  adjacent guard question; this phase does not touch it.
- **Showing the effective range on `info` / `list`.** A held plugin's row explains
  itself only when an update runs. Surfacing "held to <range> by <A>" on an
  inventory surface is a separate capability and belongs in its own phase.

</deferred>

---

*Phase: 10-constraint-aware-update*
*Context gathered: 2026-09-22*
