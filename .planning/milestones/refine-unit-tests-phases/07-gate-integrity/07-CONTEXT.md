# Phase 7: Gate Integrity - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 makes the repository's structural gates prove two separate things: that
they **visit** every target they claim to guard, and that they **fire** on a real
violation while staying green on a benign near-miss. It closes the terminal gate
gaps recorded in the live evidence ledger — target-list omissions, pattern-form
blind spots, effective-config blindness, unenrolled closed sets, production-unowned
exports, and test-only production surface — and it makes composed-path target lists
self-validating so a gate can no longer report success over targets that stopped
resolving.

Three requirements are active: `GGAT-01` (scanning-gate visitation, offender and
benign controls, plus deterministic changed-pair base selection and a fail-closed
zero-selection case), `GGAT-03` (`FLOW-07`'s two terminal effective-config and
broad-override gaps), and `GGAT-04` (closed-set and delegated-contract gates
covering their real production consumers and any public seams the approved splits
created).

Out of scope: the regenerated per-pair coverage baseline and the pre-commit/CI
wiring of the changed-pair gate (Phase 8, `RCOV-01`/`RCOV-03`); `FLOW-07`'s
edge-by-edge ESLint-versus-Fallow matrix comparison and the question of removing
`import-x/no-restricted-paths` (closed to evidence-only by `SCOPE-REQ-GGAT-03`);
`GGAT-02`/`AGCOL-01` (evidence-only, no terminal finding); and any new gate for a
claim that has not been independently revalidated (`D-22`).

</domain>

<decisions>
## Implementation Decisions

### Offender and Control Mechanism

- **D-07-01:** File-scanning gates prove firing through a hermetic `mkdtemp`
  temp-root copy. Copy the real targets into the temporary root, mutate one copy
  to create the offender, and run the real scan against an injected root. The
  offender is derived from the real file, so it cannot drift from the target it
  represents. This requires `assertNoForbiddenSurface` and every bespoke walker to
  accept a root parameter instead of closing over `REPO_ROOT`. —
  **Reversibility:** costly — the root parameter reaches every current and future
  caller of the shared scan mechanic, so reverting means re-inlining `REPO_ROOT`
  at each gate.
- **D-07-02 (amended after research):** Gates that invoke a real tool (ESLint flat
  config, Fallow) prove firing through an offender **config**, not an offender
  fixture. Each offender is the real `eslint.config.js` (or `.fallowrc.json`) plus
  one appended mutation, resolved against **real extension files**. The original
  wording called for a committed in-repo fixture linted through the real config;
  measurement showed that is not possible here — `tests/fixtures/bad-imports/**` is
  globally ignored at `eslint.config.js:303` and sits outside BLOCK C's
  `extensions/pi-claude-marketplace/**/*.ts` glob, so `calculateConfigForFile`
  returns `undefined` for it and the zone rule is absent even with `ignore: false`.
  Delete the synthetic-`overrideConfig` canary in `import-boundaries.test.ts` rather
  than leaving the weak form beside the strong one. The two mechanisms remain
  deliberate: temp-root copies for file scans, offender configs for tool runs.
- **D-07-03:** Visitation is proved separately from firing. Each scan reports the
  set of paths it actually opened, and the gate deep-compares that set against its
  declared target list. This catches both a target that stopped resolving and a
  target list that quietly shrank — the existing `ENOENT` rule (`WR-06`) catches
  only the first.
- **D-07-04:** Every gate carries two benign controls: an unmutated copy of the
  same real target (proving the gate is not failing everything) and a near-miss
  (the forbidden token inside a comment or a string literal, proving
  comment-stripping and pattern precision).

### Composed-Target Discoverability

- **D-07-05:** Gate targets live in one central registry module under
  `tests/architecture/` holding **full literal repo-relative paths**. Every gate
  imports its targets from the registry and composes nothing locally, so a
  literal-match stale-path scan reads one file and sees every guarded target. —
  **Reversibility:** costly — undoing it means redistributing every path constant
  back into the gates that use it and losing the single scan point.
- **D-07-06:** The registry is enforced by a self-hosting meta-gate that scans the
  gate files themselves: a production path named anywhere in `tests/architecture/**`
  outside the registry is an offender. The meta-gate gets the same temp-root
  offender and benign controls as every other gate, so it proves it fires.
- **D-07-07:** Registry scope is `tests/architecture/**` only. The `.mjs` gate
  scripts keep their own path handling; they are plain JavaScript and cannot import
  a `.ts` registry.
- **D-07-08:** A pattern built by joining a name list into a regex (the `D-11`
  ledger pair is the worked example) carries a positive control per name: synthesize
  the exact specifier a violation would use and assert the pattern matches it. This
  is what catches a regex that drifted from its name list while still reporting
  success.

### Effective Config Resolution

- **D-07-09:** Both `GGAT-03` gaps are closed by resolving the effective ESLint
  config through `ESLint#calculateConfigForFile`. ESLint applies its own cascade, so
  a later blanket override or an off-switch shows up as the resolved severity or
  options rather than as a block the gate never looked at. Do not reimplement the
  flat-config cascade inside a gate.
- **D-07-10:** The gate varies its config source across three offenders — a blanket
  override, a duplicate-zone substitution, and a rule-off — each constructed as the
  real `eslint.config.js` plus **one** appended mutation, so no offender can drift
  from the real config. The unmodified real config is the benign control.
- **D-07-11:** The `no-console` severity gate sweeps every extension `.ts` file,
  because the obligation is that exactly three files are exempt and only a full sweep
  can prove that set is complete. The zone-matrix gate probes one representative file
  per folder.
- **D-07-12:** Delete the regex source-scrape in
  `tests/architecture/hooks-dispatch.test.ts` once effective resolution replaces it.
  It is the defect (`AHG-014`), and a superseded gate left in place invites someone
  to trust it. — **Reversibility:** reversible — the scrape is a single test body.

### Changed-Pair Selection

- **D-07-13:** Base selection uses a deterministic, ordered fallback chain —
  `origin/main`, then `main`, then the upstream tracking ref, then `HEAD~1` — and
  **prints which candidate it selected**. It exits non-zero only when every candidate
  fails. The printed choice is what makes the selection auditable.
- **D-07-14:** Zero selected pairs distinguishes its two causes. Pass when the
  changed-path set resolved successfully and simply held no pairable entries,
  reporting which paths were skipped and why. Fail when the path set came back empty
  because base resolution or a git invocation failed. A docs-only commit stays green;
  a broken selector goes red.
- **D-07-15:** The base-selection and zero-selection proofs extend
  `scripts/test-coverage-direct.negative.mjs`, which already plants failures against
  this exact gate through an injected `mkdtemp` root and already runs inside
  `npm run check`. New cases plant a repository with no `origin/main`, a shallow
  clone, and a docs-only change.
- **D-07-16:** Phase 7 owns the behavior change **and** its proofs; Phase 8 wires an
  already-correct gate into scoped pre-commit and a dedicated CI job (`RCOV-03`). A
  criterion cannot prove fail-closed behavior against a script that is not fail-closed
  yet.

### Test-Only Production Surface

- **D-07-17:** Several findings routed here were already closed by earlier work —
  `shared/completion-cache.ts` now owns its plugin-index memory privately behind
  `createCompletionCache()` with no test-only export, and `orchestrators/plugin/list.ts`
  has been split. Record those as closed-by-earlier-phase with positive current
  evidence rather than re-fixing them, and still add the gate so the class cannot
  return.
- **D-07-18 (amended after research):** The test-only-surface gate fires on real
  offenders, and **both** live offenders are removed in this phase:
  1. `orchestrators/plugin/reinstall-replace.ts` exports
     `__operations?: ReinstallReplaceOperations` on `ReplaceReinstalledPluginInput`.
  2. `orchestrators/plugin/reinstall-flow.ts:138,151` carries a second `__deps` bag
     plus a forwarding site — surfaced by research, absent from the original wording.

  `MF-DEC-07` and `D-05-01` forbid both. Give each a production-owned collaborator
  the way Phase 5 did elsewhere, so the gate ships green against a tree that actually
  satisfies it. Removing one and gating the other is the same split `D-07-19` warns
  against. No allow-list entry: this milestone has repeatedly found allow-lists go
  stale and silent. — **Reversibility:** costly — each collaborator becomes part of
  its flow's public shape, so reverting means migrating the call sites and owner
  tests back.

### Production-Unowned Exports

- **D-07-19 (amended after research):** The production-unowned-export gate is a
  repository-wide **pinned snapshot**, not a must-be-zero sweep. The original wording
  assumed two instances; the measured census is **91 unowned exports in
  `extensions/`** (102 with `scripts/`), confirmed by two independent instruments —
  `fallow dead-code --production --unused-exports` and a from-scratch TypeScript
  compiler-API census. A must-be-zero gate cannot ship green, and `D-07-18`
  forecloses an allow-list.

  The gate therefore commits the full census list beside itself and asserts the
  measured set equals it **exactly**. This is `markers-snapshot.test.ts`'s house
  pattern, and it is not an allow-list: an allow-list forgives named entries silently
  and forever, while a pinned set fails on any change in either direction — an
  addition, a removal, or a swap — forcing a conscious diff.

  `DCORE-030` (`MARKETPLACE_VALIDATOR`, `domain/manifest.ts:40`) and its identical
  twin `surfacePostCommitWarnings` (`orchestrators/reconcile/apply.ts:921`) are both
  removed in this phase and the pin drops by two. They are one defect with two
  instances; gating one while leaving the other is the split that lets a class
  survive. The remaining entries stay pinned, not remediated — many are legitimate
  design (the `create*` injectable factories exist for exactly the dependency-injection
  pattern `CONVENTIONS.md` prescribes), and a 91-item remediation is a phase of its own.
  — **Reversibility:** reversible — the pin is one committed list.
- **D-07-20:** Fallow's `production: false` setting stays as it is. It is `FLOW-06`'s
  deliberate fix, paired with `includeEntryExports`, and the operator owns that
  question separately. The unowned-export gate is therefore a **test**, not a config
  change — which is also why the blind spot exists: under `production: false` a test
  import counts as a consumer.

### Carried-Forward Constraints

- `MF-DEC-07` and Phase 5 decisions `D-05-01` through `D-05-03` remain binding: no
  test-only export, dead default, `__deps` bag, or ignore pragma. Case-owned real
  temporary filesystems by default; a narrow production-owned port only where
  authorized.
- Phase 6 established that architecture gates require planted offenders and benign
  controls, never configuration-existence assertions. That stands and is strengthened
  here by the visitation obligation.
- `SCOPE-REQ-GGAT-01` excludes the folded unused-type-member todo from active scope:
  prose alone does not establish a terminal property-member gap, and `D-22` forbids
  adding a new gate until that claim is independently revalidated.
- `SCOPE-REQ-GGAT-02` keeps `GGAT-02`/`AGCOL-01` evidence-only. No active work.
- Both complexity ceilings apply independently to every new gate helper: ESLint's
  `sonarjs/cognitive-complexity: 15` and Fallow's `health.maxCognitive: 15` /
  `maxCyclomatic: 20` / `maxUnitSize: 60`. Passing one does not predict the other.
- `duplicates.threshold: 3` applies to gate fixture setup. Shared temp-root and
  registry helpers must be extracted, not copied across gate files.

### Rulings Taken After Research

- **`SHC-F047` redundant-gate audit:** `tests/shared/markers.test.ts` is the module's
  owner test, which `.claude/rules/typescript-unit-testing.md` requires, so it keeps
  the byte pins. `tests/architecture/markers-snapshot.test.ts` retains only what the
  owner test cannot express — the `locationsFor` assertion at `:72-76` and the
  agents-bridge markers at `:34-44`, which come from a different module. Its dangling
  `no-legacy-markers.test.ts` citation is fixed either way.
- **`OPEFR-F007`:** try converting `orchestrators/plugin/fetch.ts:483`'s dynamic
  `import()` to a static import. If `npm run check` stays green, make it static and
  close the finding outright rather than documenting a form with no reason.
  `orchestrators/plugin` → `domain` is a legal zone edge and `fetch.ts` already imports
  other `domain/` modules statically. The gate gains the dynamic-`import()` pattern
  regardless: `OPEF-F01` is about the gate's blind spot, not about that one call site.

### Claude's Discretion

- Exact registry module name, constant names, and grouping, provided every entry is a
  full literal repo-relative path.
- How many new gate files to create versus folding a new clause into an existing gate,
  provided the dupes threshold is respected and each gate keeps its own
  requirement-anchored failure message.
- Whether `HHD-027` (copied expected tables) and `HHD-028` (optional dependencies only
  ever passed `undefined`) become one gate or two.
- The disposition of `SHC-F047`'s redundant-gate audit, provided the finding is closed
  with recorded current evidence either way.
- The shape of the production-owned collaborator that replaces `__operations`, provided
  it is a real production responsibility and not a forwarding seam.
- Wave membership and plan granularity, provided plans that touch the shared registry,
  the shared scan mechanic, or `eslint.config.js` are serialized.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and Evidence Authority

- `.planning/ROADMAP.md` §"Phase 7: Gate Integrity" — goal, boundary, and the four
  success criteria, including criterion 4's composed-path obligation.
- `.planning/REQUIREMENTS.md` §"Gate Integrity" — the active `GGAT-01`, `GGAT-03`, and
  `GGAT-04` contracts.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION.json` — the terminal
  finding routes. This is the authority over historical review prose. The thirteen
  findings routed to Phase 7 are `OMR-F01`, `OMRR-F004`, `OPEF-F01`, `OPIB-F07`,
  `DCORE-030`, `SCN-F025`, `HHD-027`, `HHD-028`, `OPLU-A-F07`, `OPLU-B-F15`,
  `SHC-F046`, `SHC-F047`, and `OPEFR-F007`; `ABG-004` and `AHG-014` are the two
  `GGAT-03` gaps, and `ORA-F32` is the deferred-backlog twin of `DCORE-030`.
- `.planning/phases/01-live-evidence-revalidation/01-REVALIDATION-SCHEMA.md` —
  interpretation rules for the live evidence ledger.
- `.planning/BACKLOG.md` §"FLOW-07: is the ESLint `no-restricted-paths` zone matrix now
  redundant?" — the settled reachability measurement and the standing argument. Read it
  to know what is already closed, not to reopen it.

### Prior Phase Contracts

- `.planning/phases/05-injection-and-ownership-design/05-CONTEXT.md` — legitimate
  production ports, ownership boundaries, and the classification that governs the
  `__operations` removal.
- `.planning/phases/06-assertion-and-module-refinement/06-CONTEXT.md` — the no-forwarding-seam
  rule, minimal-surface rule, and the stale-path-scan-returns-zero proof obligation that
  criterion 4 generalizes.
- `.planning/phases/04-hermetic-test-infrastructure/04-CONTEXT.md` — hermetic filesystem
  and typed-collaborator constraints that the temp-root mechanism must honour.

### Codebase Guidance

- `.planning/codebase/CONVENTIONS.md` §"Fallow" — the "a gate wants a test that plants the
  violation, not one that reads the config" rule, the eleven `fallow-ignore` census, and the
  two independently-computed complexity ceilings.
- `.planning/codebase/ARCHITECTURE.md` §"Architectural Constraints" — the `D-11` cycle-gate
  pair, the `FORBIDDEN_TARGETS` network boundary, and why the network gate is not replaceable
  by a Fallow boundary rule.
- `.planning/codebase/TESTING.md` — direct source-test pairing, strict doubles, and
  owner-test conventions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `tests/architecture/source-scan.ts`: `assertNoForbiddenSurface` and `stripComments` are the
  shared scan mechanic for the network gate and the `COMPAT-01` no-expansion gate. Its `WR-06`
  ENOENT rule is the existing half of the visitation obligation; `D-07-01` and `D-07-03` extend
  it with an injected root and a visited-path report. Its header already records why reads go
  through `node:fs/promises` rather than a `grep` subprocess, and why one gate delegating to
  another must not import a `*.test.ts` module (`D-98-09`).
- `scripts/test-coverage-direct.negative.mjs`: already plants refusals against the direct-coverage
  gate through an injected `mkdtemp` root and already runs inside `npm run check` via
  `test:coverage:direct:negative`. It is the established owner for the new base-selection cases.
- `scripts/check-corresponding-tests.negative.mjs` and `scripts/revalidation.negative.mjs`: the
  same negative-harness pattern applied to two other gates — useful as shape references.
- `tests/fixtures/bad-imports/edge-imports-bridges.ts`: the existing committed offender fixture.
  It is currently linted through a synthetic `overrideConfig` (`tests/architecture/import-boundaries.test.ts`,
  the `D-11` canary), which is precisely what `ABG-004` faults. Reuse the fixture, replace the
  synthetic config with the real resolved one.

### Established Patterns

- Gates make one deep-equality assertion against an empty offenders array, so a failure reports
  every offending file at once rather than only the first.
- Failure messages are requirement-anchored: each names its `D-`, `NFR-`, or `WR-` identifier and
  states the sanctioned alternative.
- Every scanning clause strips comments before matching, because source headers legally name the
  forbidden symbols in prose.
- `npm run check` chains typecheck, lint, fallow, format, the two correspondence gates, the
  direct-coverage negative gate, unit tests, and integration tests. Fallow is a mandatory member
  of that chain, not an optional extra.

### Integration Points

- `tests/architecture/no-orchestrator-network.test.ts` — `FORBIDDEN_TARGETS` needs
  `orchestrators/marketplace/autoupdate.ts`, `list.ts`, and `remove.ts` added (`OMR-F01`,
  `OMRR-F004`) and a dynamic-`import()` pattern alongside the static `from` form (`OPEF-F01`).
  `OPEFR-F007` sits on the deferred backlog but names the same `fetch.ts` import form; document
  or promote it while this gate is open.
- `tests/architecture/partial-vocabulary-guard.test.ts` — must extend to the recursive unit-test
  sources it claims to police (`OPIB-F07`), then repair stale terminology while preserving
  requirement IDs.
- `tests/architecture/import-boundaries.test.ts` — `loadZones()` returns the first block
  configuring `import-x/no-restricted-paths`; the `D-11` ledger-pair regexes are joined from
  `PLUGIN_LEDGERS` and `MARKETPLACE_LEDGERS`; the zone matrix is built from
  `` `${EXTENSION_ROOT}/...` `` templates. All three are targets of `D-07-05`, `D-07-08`, and
  `D-07-09`.
- `tests/architecture/hooks-lifecycle.test.ts` — composes targets through
  `path.join(ORCH_DIR, "install-flow.ts")` and siblings. The specific stale names were already
  repaired; `D-07-05` moves the composition into the registry so it cannot recur.
- `tests/architecture/markers-snapshot.test.ts` and
  `extensions/pi-claude-marketplace/shared/markers.ts` — the subject of `SHC-F047`'s
  redundant-gate audit.
- `extensions/pi-claude-marketplace/shared/concerns/hooks.ts` — `Dependency` and the shared
  `ClaudeHookEvent` are enrolled in no architecture gate (`SCN-F025`); this is the
  closed-set half of `GGAT-04`.
- `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` and
  `bridges/hooks/dispatch.ts` / `event-router.ts` — the concrete offenders for the
  copied-expected-table gate (`HHD-027`) and the sentinel-threading gate (`HHD-028`).

</code_context>

<specifics>
## Specific Ideas

- Treat "the gate reports success" as a failure mode in its own right. A gate whose target list
  silently stops resolving is worse than a missing gate, because it buys confidence it has not
  earned. Every gate this phase touches must be able to answer both "what did you read?" and
  "what would make you fail?".
- Derive every offender from the real artifact — a mutated copy of the real target file, or the
  real `eslint.config.js` plus one appended override. A hand-authored offender drifts, and drift
  is how these gates went quiet in the first place.
- Prefer one shared mechanism over per-gate cleverness, then prove the shared mechanism itself.
  The registry and the temp-root scan are each a single point that a single meta-gate can hold to
  account.

</specifics>

<deferred>
## Deferred Ideas

- **Unused type-member detection** (todo `2026-09-02-detect-unused-code-and-type-members.md`,
  matched at score 0.6): reviewed and deliberately **not folded**. `SCOPE-REQ-GGAT-01` excludes
  it from active scope because prose alone does not establish a terminal property-member gap,
  and `D-22` forbids adding a gate until the claim is independently revalidated. It stays in the
  bundled backlog and is named again in Phase 9's `CLOSE-02` criteria.
- **`FLOW-07` matrix removal** — whether the ESLint `no-restricted-paths` zone matrix can be
  removed in favour of Fallow's 13-zone model still needs an edge-by-edge allow-list comparison,
  not another zone count. Closed to evidence-only for this milestone by `SCOPE-REQ-GGAT-03`.
- **`ORA-F32`'s routing** — the finding is recorded as deferred-backlog, but `D-07-19` closes its
  instance as part of the repository-wide sweep. Record that the instance closed early while the
  finding keeps its backlog identity.
- **`.mjs` gate-script path registry** — enrolling `scripts/check-corresponding-tests.mjs` and
  `scripts/test-coverage-direct.mjs` in a shared target registry needs a `.mjs` or JSON source of
  truth they can both import. Out of scope per `D-07-07`.

</deferred>

---

*Phase: 7-Gate Integrity*
*Context gathered: 2026-09-10*
