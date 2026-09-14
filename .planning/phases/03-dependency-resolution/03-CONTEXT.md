# Phase 3: Dependency resolution - Context

**Gathered:** 2026-09-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Installing a plugin also installs the plugins it declares as dependencies —
resolved by name+marketplace, version-constrained, cycle-safe, idempotent on
an already-installed dependency, and durable across `/reload`. This
supersedes the PI-13/PR-5 "manual install only" decision (retired by this
milestone, not worked around).

Requirements: RESV-01..06.

Not in this phase: install provenance / the `origin: explicit | dependency`
distinction (Phase 4 — every record this phase writes is still "explicit" by
Phase 4's own reading), `--prune` (Phase 5), MIGR-01's staleness gate (never
this milestone's Phase 3).

</domain>

<decisions>
## Implementation Decisions

### Version-constraint grammar (RESV-03)

Verified against the installed Claude Code CLI binary
(`~/.local/share/claude/versions/2.1.251`), not docs or the spike summary —
same evidentiary bar Phase 1 used for D-01-25..30.

- **D-03-01:** Add `semver` as a direct dependency (already resolved
  transitively at `7.8.0` via the `@earendil-works/pi-coding-agent` peer, so
  no new download — this makes it OUR OWN declared contract rather than an
  incidental resolution of someone else's). Upstream itself bundles the real
  `semver` package (`semver.validRange`, `semver.satisfies`, `semver.valid`,
  `semver.coerce` all appear verbatim in the compiled binary) — this is a
  verified parity fact, not a guess. Phase 1's D-01-33 already accepts the
  full semver-ish charset (`^`, `~`, comparisons, `||`, x-ranges) as valid
  DECLARED text for parsing/rendering; without a real evaluator, a value that
  parses and renders fine in `info` could never actually be resolved against
  in this phase — `semver` closes that display/resolve gap.
  — **Reversibility:** costly — every downstream constraint-evaluation call
  site would need to change evaluator.

- **D-03-02 (full upstream parity, operator's explicit choice over the
  scoped-down recommendation):** Replicate upstream's full mechanism, not
  just its comparison primitive:
  1. **Cross-manifest range intersection** (matches Phase 1's D-01-31 note):
     every declaring plugin's range for the same dependency name accumulates
     into an array; the effective constraint is the INTERSECTION, computed as
     a combinatorial cross-product of each range's `semver`-OR-branches
     joined with AND (space-separated conjuncts), with a size guard that
     fails closed as `"too-complex"` past a threshold rather than hanging on
     a pathological input. An empty accumulator intersects to the wildcard
     `*` (no constraint).
  2. **Git-tag range resolution for a not-yet-installed constrained
     dependency:** when the intersected range is not `*`, do NOT just check
     whatever this project's resolver already produces for that plugin.
     Query the dependency's marketplace-entry SOURCE repo's tags over the
     network (`git ls-remote --tags` equivalent — upstream shells to a real
     `git ls-remote --tags -- <url>`), looking for a tag named
     `<pluginName>--v<semver>`, and re-pin the install to whichever matching
     tag satisfies the range. No matching tag → the dependency fails as
     `"no-matching-tag"`, naming the constraint (RESV-03's own wording).
  3. **Already-installed dependency check** (RESV-05's "left alone" case
     still needs a conflict check): the RECORDED version is checked via
     `semver.valid(v) ?? semver.coerce(v)?.version` then
     `semver.satisfies(...)` against the intersected range; an unsatisfied
     already-installed dependency reports `"range-conflict"` with
     `why: "installed-unsatisfied"`.

  This is substantially more machinery than "map onto existing cascade
  primitives" — it is a genuinely new capability (live tag enumeration on a
  source repo, re-pinning to an alternate tag, a "many tags per plugin, pick
  one" concept this project's git-source model does not have anywhere else:
  everywhere else, one marketplace entry maps to one pinned ref). The
  operator chose it deliberately after the scoped-down alternative
  (comparison-only, no tag-hunting) was presented and explained as the
  lower-cost path. Plan and research for this phase accordingly — this is
  the single largest piece of new surface RESV-03 introduces.
  — **Reversibility:** one-way — once shipped, retracting live tag
  resolution back to "check whatever's already resolvable" changes observed
  install outcomes for any dependency with a real constraint.

- **D-03-03 (NFR-5 amendment, forced by D-03-02):** Record a new NFR-5
  carve-out in `PROJECT.md` Constraints, mirroring how `url-source` amended
  NFR-5 for cache-miss git-source installs: a CONSTRAINED dependency
  resolution may query its source repo's tags over the network even when a
  cached/resolvable version of that dependency already exists — because the
  constraint may demand a DIFFERENT tag than what's cached. This must land
  as an explicit, visible constraint amendment, not an incidental side
  effect discovered later by the no-orchestrator-network architecture test
  or a future reader of NFR-5.

- **D-03-04 (deliberate risk acceptance):** A candidate plugin with no real
  semver version — this project's PI-7 content-hash (`hash-<12hex>`) or
  git-sha (`sha-<12hex>`) fallback, which has no upstream equivalent — is run
  through the SAME `semver.valid ?? semver.coerce` fallback chain as any
  other candidate, matching upstream's exact mechanism (D-03-02.3) rather
  than special-casing it. The operator accepted the documented risk this
  carries: `semver.coerce()` on a hex string can extract a misleading digit
  sequence and produce a spurious "version" that unpredictably satisfies or
  fails a range. Do not add a hash/sha guard that upstream does not have —
  full parity means this edge case too.

### Cascade persistence across `/reload` (RESV-01's reload clause)

`orchestrators/reconcile/plan.ts::buildUninstallBucket` (line 484) sweeps any
plugin recorded in `state.json` whose `plugin@marketplace` key is not present
in the merged `claude-plugins.json` + `.local.json` declared config. A
cascade-installed dependency that never reaches config is uninstalled on the
very next `/reload` — this is the concrete mechanism the open decision named
in STATE.md/ROADMAP resolves.

- **D-03-05:** A cascade-installed dependency lands in the SAME SCOPE as the
  plugin that declared it (the requesting/parent plugin's own install target
  scope) — never a separately chosen scope. `install foo --scope project`
  cascades its dependencies into project scope; it never silently writes
  into user scope.

- **D-03-06:** Within that scope, a dependency's config entry goes into
  WHICHEVER FILE the requesting plugin's own entry is declared in — base
  `claude-plugins.json` or the local `.local.json` overlay — mirroring the
  parent exactly, via the existing config-write-back machinery
  (`persistence/config-write-back.ts::writePluginConfigEntry`, whatever
  target-selection helper the parent's own explicit-install path already
  uses). This is transitive by construction: a dependency-of-a-dependency
  mirrors its immediate parent, which recursively traces back to wherever
  the ORIGINAL explicit install landed — no special-casing needed for
  multi-level chains, and no conflict is possible within one cascade run
  (RESV-05 means an already-installed dependency is never re-written or
  moved between files; only a dependency's FIRST install picks a file, and
  it has exactly one parent at that moment).

### Partial-cascade failure handling (RESV-06, NFR-3)

- **D-03-07:** All-or-nothing rollback. If `foo` depends on `bar` and `baz`,
  and `bar` installs successfully but `baz` fails, `bar` is uninstalled too
  and `install foo` fails cleanly reporting `baz`'s failure and reason.
  Matches this project's existing atomic-materialization ethos (NFR-1/NFR-3,
  the phase-ledger rollback discipline everywhere else) over the
  `orchestrators/import/`-style best-effort per-entry-outcome pattern the
  ROADMAP names as available machinery — the operator chose atomicity over
  reusing that specific pattern. Retry-safe: re-running `install foo` after
  a failure starts from a clean slate (no partial dependency debris to
  reconcile with on the next attempt).

  **Rollback scope is this cascade run's OWN new materializations only.** An
  already-installed `bar` that PREDATES this run (RESV-05) is never touched
  by rollback — only what this specific `install foo` invocation itself
  newly installed gets unwound on failure.

### Auto-adding an unadded marketplace (RESV-02)

Also upstream-verified against the 2.1.251 binary, after an initial pick was
reversed once the verified behavior came back.

- **D-03-08:** A dependency naming a marketplace the user never added FAILS
  that dependency — it does not trigger an auto-add/auto-clone. This matches
  upstream's own verified behavior exactly: `"<pluginId> plugin.json
  declares dependency \"<dep>\" not found in any known marketplace; not
  auto-installing"` (warn class, dependency lookup against ALREADY-KNOWN
  marketplaces only — upstream never clones a marketplace to resolve a
  dependency). Reason names the missing marketplace and hints
  `marketplace add`.

  **One deliberate divergence from upstream within this same case:**
  upstream treats an unknown-marketplace dependency as a soft warn-and-skip
  that still lets the requesting plugin install degraded. Under this
  project's own D-03-07 (all-or-nothing), an unknown-marketplace dependency
  is just one more failure reason among others (unsatisfiable constraint,
  cycle, install error) — it triggers the SAME whole-cascade rollback, not a
  silent degrade. This keeps the failure-propagation model uniform across
  every reason a dependency can fail, at the cost of this one point of
  divergence from upstream's specific softer handling. Record this
  explicitly so it reads as a decision, not a missed parity case.

### Claude's Discretion

- Exact placement/naming of the new git-tag-listing capability in
  `platform/git.ts` (the sole `isomorphic-git` import site) — whatever
  `isomorphic-git` API best matches `git ls-remote --tags` semantics.
- Whether cross-manifest range intersection (D-03-02.1) is a new
  `domain/`-layer module or lives alongside `domain/dependencies.ts` — so
  long as it stays network-free pure computation, separate from the
  network-touching tag-lookup step.
- Exact reason-token wording for `"no-matching-tag"`,
  `"range-conflict"`/`"installed-unsatisfied"`, `"too-complex"`, and
  "dependency's marketplace not added" — follow `docs/messaging-style-guide.md`
  and the existing closed-set `REASONS` pattern rather than inventing new
  prose per call site.
- How deep a cycle-detection report names the chain (RESV-04) — a visited-set
  walk during the cascade is sufficient; no dependency-graph library exists in
  this codebase and none is needed for cycle detection specifically (only the
  version-constraint work needs `semver`).
- Whether the guard-free ledger body (`runInstallLedgerBody`) is called
  directly per cascade member under one outer `withLockedStateTransaction`,
  or a new guard-free "install several plugins under one held lock" wrapper
  is extracted — `withLockedStateTransaction` is not re-entrant
  (`proper-lockfile`, `retries: 0`), so SOME guard-free composition is
  required; the exact shape is a planning-time call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Upstream dependency-resolution contract
- `~/.local/share/claude/versions/2.1.251` — the installed Claude Code CLI
  binary this phase's upstream-parity decisions (D-03-01, D-03-02, D-03-08)
  were verified against directly (grep the compiled bundle, not docs).
  Key anchors to re-grep if verifying further: `range-conflict`,
  `no-matching-tag`, `not found in any known marketplace`, the `Jy` symbol
  (bundled `semver`), and the `--v` tag-suffix convention. Re-verify against
  whichever version is current if the binary is updated before planning.
- `.planning/spikes/004-claude-plugin-dependency-spec/README.md` — the
  validated upstream spec for the `dependencies` field shape (Phase 1's
  source); this phase's resolution mechanism is a DIFFERENT layer (how a
  parsed dependency gets satisfied, not how it's parsed).

### Prior phase decisions this phase builds on
- `.planning/phases/01-manifest-read-fidelity/01-CONTEXT.md` — `domain/dependencies.ts`'s
  `DeclaredDependency` shape (D-01-20), D-01-31's cross-manifest
  last-wins-vs-intersect distinction (this phase implements the intersect
  half), D-01-32's plugin.json-first read order this phase reuses for
  resolution.

### Project rules
- `.planning/REQUIREMENTS.md` §"Planning Notes" — facts verified 2026-09-09
  that planning MUST NOT re-derive: no semver library was a direct
  dependency before this phase, no in-the-wild dependency fixtures exist
  (all RESV test data is necessarily synthetic), `orchestrators/import/` and
  `orchestrators/plugin/bootstrap.ts` are the existing cascade/composer
  machinery, reconcile's `applyPluginUninstalls()` runs with no command line.
- `.planning/codebase/ARCHITECTURE.md` — `orchestrators/plugin/` network
  boundary (`tests/architecture/no-orchestrator-network.test.ts`
  `FORBIDDEN_TARGETS`); D-03-02/D-03-03's tag-lookup network call is a NEW,
  deliberate exception that must be reconciled with this gate at planning
  time — it cannot land inside a file that test currently forbids network
  imports in without either an explicit exemption (like `update-flow.ts`/
  `update-preflight.ts`) or a new leaf module outside the forbidden list.
- `.planning/codebase/CONVENTIONS.md` — typed error classes, the dual
  cognitive-complexity ceilings, and the "plant the violation" gate-testing
  rule.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/dependencies.ts` (Phase 1) — the `DeclaredDependency` parser this
  phase consumes as input. Returns typed `{name, version?, marketplace?,
  sha?}`; the marketplace fill-in (declaring plugin's own marketplace when
  omitted) is a render-time concern in `info`, so Phase 3 applies its OWN
  resolution semantics to the same parsed shape (D-01-19/D-01-32).
- `orchestrators/plugin/install-outcome.ts::runInstallLedger` /
  `runInstallLedgerBody` (~line 527/569) — the GUARD-FREE 6-phase
  materialization body, exactly what a cascade needs to call per dependency
  under one held lock rather than `installPlugin` (which acquires its own
  lock and would self-deadlock on `withLockedStateTransaction`'s
  non-reentrant `proper-lockfile`).
- `transaction/phase-ledger.ts::runPhases` / `Phase<C>` — per-plugin
  materialization already has all-or-nothing rollback at the single-plugin
  level; D-03-07 extends this discipline to the multi-plugin cascade level,
  it does not replace it.
- `persistence/config-write-back.ts::writePluginConfigEntry` — the write
  D-03-06 reuses for a dependency's config entry, same as an explicit
  install already does.
- `orchestrators/plugin/shared.ts::selectDeclaringConfigWriteTarget` — named
  in the codebase as the existing base-vs-local file selection logic;
  D-03-06 mirrors the PARENT's own resolution through this same seam rather
  than introducing new target-selection logic.
- `orchestrators/plugin/bootstrap.ts::bootstrapClaudePlugin` — a worked
  example of composing two orchestrator calls (`addMarketplace` then
  `setMarketplaceAutoupdate`) with typed-error idempotency narrowing
  (`instanceof MarketplaceDuplicateNameError`); a useful shape reference for
  composing multiple plugin installs, though it has no rollback of its own.

### Established Patterns

- `withLockedStateTransaction` (`transaction/with-state-guard.ts`) is NOT
  re-entrant (`proper-lockfile`, `retries: 0`) — a cascade must acquire ONE
  lock for the whole multi-plugin operation and drive the guard-free ledger
  bodies within it, never call the lock-acquiring `installPlugin` from
  inside another lock holder.
- `platform/git.ts` is the SOLE `isomorphic-git` import site in the
  codebase (NFR-5/architecture chokepoint) — any new tag-listing operation
  D-03-02 needs belongs here, not inlined elsewhere.
- Two independently-computed complexity gates (ESLint `sonarjs/cognitive-
  complexity: 15`, fallow `health.maxCognitive: 15`) both apply to whatever
  new cascade/intersection/tag-resolution code this phase adds — the
  combinatorial intersection algorithm (D-03-02.1) in particular is a good
  candidate for staying flat via extracted helpers from the start.

### Integration Points

- `orchestrators/reconcile/plan.ts::buildUninstallBucket` (line 484) — the
  mechanism D-03-05/D-03-06 satisfy by construction (declaring the
  dependency in config means reconcile never sees it as "recorded but not
  declared"). No change to `buildUninstallBucket` itself is anticipated;
  verify this at planning time rather than assuming it.
- `tests/architecture/no-orchestrator-network.test.ts` `FORBIDDEN_TARGETS` —
  the install owners (`install-flow.ts`, `install-outcome.ts`) are in this
  list today. D-03-02's tag-lookup network call needs a plan for where it
  lives relative to this gate (see canonical_refs note above).
- `orchestrators/import/` (`execute.ts`, `index.ts`) — the per-entry-outcome
  cascade pattern the ROADMAP names as available machinery. This phase does
  NOT adopt its best-effort failure semantics (D-03-07 chose all-or-nothing
  instead), but its per-entry OUTCOME REPORTING shape (what gets told to the
  user about each cascade member) may still be a useful rendering reference.

</code_context>

<specifics>
## Specific Ideas

- The `<pluginName>--v<semver>` git tag naming convention (verified in the
  2.1.251 binary) is Anthropic's own plugin-release tooling convention, not
  a general git-tagging standard — a third-party marketplace's source repo
  is unlikely to follow it. D-03-02's tag resolution will very likely
  resolve to "no matching tag" for most real-world sources today; this is
  expected, not a bug, given REQUIREMENTS.md's finding that no real
  marketplace currently ships dependencies with real constraints.
- No dependency-graph/cycle-detection library exists in this codebase and
  none is needed — RESV-04 is a visited-set walk during the cascade, not a
  graph-theory problem.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (MIGR-01's staleness gate
remains Phase 4's dependency per Phase 1's context; not re-opened here.)

### Reviewed Todos (not folded)

- `2026-09-02-detect-unused-code-and-type-members.md` — matched again at
  score 0.6 on generic keywords ("resolves", "phase", "milestone"), same as
  Phase 1's review. Concerns dead-code/unused-type-member detection,
  unrelated to dependency resolution. Not folded.

</deferred>

---

*Phase: 3-Dependency resolution*
*Context gathered: 2026-09-14*
