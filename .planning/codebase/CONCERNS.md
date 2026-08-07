# Codebase Concerns

**Analysis Date:** 2026-08-07

## Tech Debt

**Uncovered rare failure/rollback arms in mutating orchestrators:**
- Issue: overall Sonar coverage sits around 95.9% (line 96.7%, branch 90.5%),
  but the uncovered lines cluster in rollback and rare-failure branches of the
  largest orchestrators — precisely the paths where a silent regression is
  most costly. Tracked in
  `.planning/todos/pending/2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  (open, not yet actioned as of this analysis).
- Files: `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` (was
  49.7% coverage at capture), `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
  (87.9%, three-phase update rollback paths), `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
  (93.1%), `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
  (93.4%), `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`
  (93.7%), `extensions/pi-claude-marketplace/orchestrators/import/execute.ts`
  (94.1%)
- Impact: a regression in a rollback path (e.g. a partial-commit cleanup on
  update failure) could silently corrupt on-disk state with no test to catch
  it, violating NFR-1 (atomicity) and NFR-3 (safe-retry) guarantees.
- Fix approach: targeted sweep starting with `update.ts` (largest absolute
  uncovered chunk), then `reinstall.ts` / `install.ts` /
  `marketplace/update.ts` / `import/execute.ts`. For `edge-deps.ts`
  (dependency-injection wiring glue), decide explicitly whether to add tests
  or a `sonar.coverage.exclusions` entry in `sonar-project.properties` — an
  exclusion should be a deliberate call, not a default.

**Very large orchestrator files concentrate complexity:**
- Issue: several orchestrator files exceed 1,000-2,800 lines, each
  coordinating multi-phase transactional workflows (install/update/reinstall
  plus rollback).
- Files (by size): `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`
  (2793 lines), `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
  (2380 lines), `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`
  (2024 lines), `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`
  (1945 lines), `extensions/pi-claude-marketplace/domain/resolver.ts` (1534
  lines), `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`
  (1412 lines), `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
  (1282 lines)
- Impact: high cognitive load for reviewers and future contributors; several
  functions require `eslint-disable-next-line sonarjs/cognitive-complexity`
  to pass lint (see below), a proxy signal that complexity is already at the
  configured ceiling in multiple spots.
- Fix approach: no active refactor plan exists. If growth continues, consider
  splitting per-phase logic (prepare/commit/rollback) into named helper
  modules under each orchestrator's directory, following the pattern already
  used for `orchestrators/plugin/shared.ts`.

**Cognitive-complexity suppressions accepted at multiple call sites:**
- Issue: 8 functions across the orchestrator layer carry an explicit
  `eslint-disable-next-line sonarjs/cognitive-complexity` to bypass the
  linter's complexity ceiling rather than being decomposed.
- Files: `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:340`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1281,2257`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:386,459`,
  `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:538`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1409,1549`
- Impact: these functions are, by the project's own linting bar, harder to
  reason about and more failure-prone to modify safely; they are exactly the
  kind of code where the coverage gaps above are riskiest.
- Fix approach: none planned currently. Treat any future change to these
  functions as an opportunity to extract named sub-steps rather than adding
  more branches under the same suppression.

**`no-dynamic-delete` and `no-unnecessary-condition` suppressions on
closure-mutated state:**
- Issue: 17 additional inline `eslint-disable-next-line` suppressions exist,
  mostly for `@typescript-eslint/no-dynamic-delete` (deleting keys from
  `Record<string, ...>` state maps) and `@typescript-eslint/no-unnecessary-condition`
  (re-checking a boolean that TS's flow analysis believes is still `false`
  because it was mutated inside a `withLockedStateTransaction` closure the
  compiler can't see through).
- Files: `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:372,451`,
  `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:475,479`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:475,549,574`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:2020`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1109,1556,1582`,
  `extensions/pi-claude-marketplace/persistence/config-write-back.ts:88,145`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:2618,2789`
  the `no-unnecessary-condition` sites are all documented as required at
  runtime by inline comments explaining the closure-mutation gap.
- Impact: low per-instance risk (each is documented with a reason), but the
  repeated pattern across files signals that `withLockedStateTransaction`'s
  closure-based mutation-tracking is not type-safe by construction — every
  new orchestrator following this pattern will likely need the same
  suppression.
- Fix approach: if this pattern recurs again, consider a typed accumulator
  object returned from the transaction closure instead of captured outer
  `let` bindings, which TS can narrow without suppression.

## Known Bugs

No open bug reports were found in `.planning/todos/pending/` or the
milestone history at analysis time (the one pending todo is a coverage-sweep
task, not a bug). No `TODO`/`FIXME`/`HACK`/`XXX` markers exist anywhere under
`extensions/`.

## Security Considerations

**Path containment relies on convention across many call sites (NFR-10):**
- Risk: the project's core safety invariant — refusing to write outside
  `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`,
  `<scopeRoot>/mcp.json`, `<scopeRoot>/claude-plugins.json`, or
  `<scopeRoot>/claude-plugins.local.json` — depends on every write path
  calling the shared containment check consistently. A new orchestrator or
  bridge that writes files without going through the shared helper would
  silently violate NFR-10.
- Files: containment logic is expected under `extensions/pi-claude-marketplace/shared/`
  or `platform/`; every orchestrator under `extensions/pi-claude-marketplace/orchestrators/`
  is a call site that must honor it.
- Current mitigation: an architecture test guards network usage
  (`tests/architecture/no-orchestrator-network.test.ts`, a `FORBIDDEN_TARGETS`
  grep-gate) — no equivalent grep-gate test was found specifically for path
  containment during this pass.
- Recommendation: verify (or add) an architecture-level test asserting that
  every filesystem write in `orchestrators/` and `persistence/` routes
  through the shared path-containment/atomic-write helpers, mirroring the
  existing network-purity gate pattern.

**Git-source marketplace/plugin installs shell out to `isomorphic-git`
against user-supplied URLs:**
- Risk: marketplace `add` (GitHub source) and plugin git-URL sources
  (`domain/github-auth.ts`, `domain/auth-registry.ts`,
  `orchestrators/plugin/clone-cache.ts`, `orchestrators/plugin/fetch.ts`)
  clone and fetch from externally supplied repository URLs. Credential
  handling for private repos flows through `domain/github-auth.ts`.
- Files: `extensions/pi-claude-marketplace/platform/git.ts`,
  `extensions/pi-claude-marketplace/domain/github-auth.ts`,
  `extensions/pi-claude-marketplace/domain/auth-registry.ts`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts`
- Current mitigation: NFR-5 confines network access to `marketplace add`
  (GitHub source) and `update`/`marketplace update` against GitHub-source
  marketplaces only; `install`/`list`/`uninstall`/`marketplace remove` and
  path-source `marketplace add` are enforced network-free by the
  `no-orchestrator-network` architecture test.
- Recommendation: no specific gap identified beyond keeping the existing
  architecture test current as new git-touching call sites are added.

## Performance Bottlenecks

No specific hot-path profiling data or reported slow operations were found.
The domain resolver (`extensions/pi-claude-marketplace/domain/resolver.ts`,
1534 lines) and the large orchestrators are the most likely places for
algorithmic cost to accumulate (e.g. repeated full-state scans across many
marketplaces/plugins), but nothing in the codebase or planning history flags
a measured bottleneck as of this analysis.

## Fragile Areas

**Three-phase update/rollback orchestrators:**
- Files: `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
- Why fragile: these implement multi-step commit/rollback sequences
  (prepare → commit → rollback-on-failure) guarded by
  `withLockedStateTransaction`/`withStateGuard`-style locking
  (`extensions/pi-claude-marketplace/transaction/with-state-guard.ts`). The
  closure-mutation pattern already forces multiple lint suppressions (see Tech
  Debt above), and the failure/rollback branches are exactly the
  under-tested lines flagged in the open coverage-sweep todo.
- Safe modification: any change to a commit or rollback branch in these files
  should add or update a corresponding failure-path test before merging;
  changes should preserve the documented reasons behind each existing
  `eslint-disable` (they encode real TS flow-analysis limitations, not lint
  fatigue).
- Test coverage: below the rest of the codebase on these specific files —
  see Tech Debt section for exact figures at last measurement (2026-06-12).

**Cross-scope resolution helpers (`orchestrators/plugin/shared.ts`):**
- Files: `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts`
  (`resolveCrossScopePluginTarget`, `resolveInstalledMarketplaceTarget`)
- Why fragile: the two helpers deliberately share the same "requested scope
  → other scope → absent" decision shape but are intentionally not
  deduplicated (per `sonar-project.properties`'s `sonar.cpd.exclusions`
  comment, this was an explicit Phase 38 decision to keep per-type contracts
  visible at each call site). A future contributor unaware of that rationale
  might try to merge them, which would obscure the per-type discriminator
  each caller switches on.
- Safe modification: preserve the parallel-but-separate structure; consult
  the `sonar-project.properties` comment before attempting to extract a
  shared helper.

## Scaling Limits

Not applicable in the traditional sense — this is a local CLI/agent extension
operating on a user's filesystem, not a networked service with throughput
limits. No scaling constraints were identified.

## Dependencies at Risk

**`peerDependencies.@earendil-works/pi-coding-agent` pinned as `">=0.80.5"`,
`typebox` and `@earendil-works/pi-tui` pinned as `"*"`:**
- Risk: an unpinned `"*"` peer dependency range allows installs against any
  future breaking major version of `typebox` or `@earendil-works/pi-tui`,
  which could silently break the extension at load time.
- Impact: install-time or first-run breakage that surfaces only after a host
  environment upgrades one of these peers.
- Migration plan: NFR-11 already tracks pinning a floor for the pi-coding-agent
  peer (done: `>=0.80.5`, per `package.json`); the same discipline has not
  yet been applied to `typebox` or `@earendil-works/pi-tui`, both still `"*"`.

## Missing Critical Features

None identified — this document covers debt/risk, not the feature roadmap.
See `.planning/milestones/` and the project ROADMAP for planned and shipped
feature work.

## Test Coverage Gaps

**Rare failure/rollback arms in mutating orchestrators (see Tech Debt above
for full detail and file-by-file coverage figures):**
- What's not tested: exception and rollback branches in `update.ts`,
  `reinstall.ts`, `install.ts`, `marketplace/update.ts`, `import/execute.ts`,
  and the DI wiring in `orchestrators/edge-deps.ts`.
- Files: see Tech Debt section above.
- Risk: a regression in an untested rollback path could leave on-disk state
  (`state.json`, `mcp.json`, staged agent/skill directories) inconsistent
  after a failed operation, directly undermining NFR-1/NFR-3.
- Priority: High — these are the exact paths a partial-failure user hits in
  production, and they are already flagged in an open (unclaimed) todo.

---

*Concerns audit: 2026-08-07*
