# Phase 114: Degradation and documentation - Context

**Gathered:** 2026-09-07
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all four grey areas accepted as recommended

<domain>
## Phase Boundary

The host engine becomes the third soft dependency, and the contract of the one
bridge that installs executable code is written down.

**In scope:** the `workflow_control` soft-dependency probe and its
false-positive guard; `workflows` as the third `Dependency` member with its
`requires pi-dynamic-workflows` marker; the new reason token in the closed
`REASONS` set and in `docs/output-catalog.md` under the byte gate; a gate (not a
grep) proving marker coverage across every `Dependency[]` derivation site;
proof that envelope bytes do not depend on whether the engine is loaded; the new
`docs/workflows-compatibility.md` executable-code contract with its
admit-versus-run divergence table; the README pair; and settling the
path-bearing premise that Phase 109 left open.

**Out of scope:** install-time admission-gate warnings (Phase 115, WGATE-01..05);
the supported-set-growth backfill (Phase 116, WCONV-01..03); the live-UAT
`agent()` measurement (Phase 117, WEVID-01..02); the version bump, CHANGELOG
entry and PR, which are milestone-close work.

**This is the re-land of the archived Phase 105 onto a main that moved.** Two
things changed under it and both alter the work:

- `shared/concerns/soft-dep.ts` no longer holds a runtime `DEPENDENCIES` tuple.
  Main replaced it with a literal union (`type Dependency = "agents" | "mcp"`),
  and its module header states the reason: nothing iterates the members at
  runtime, so the union type alone is the sole declaration site. Phase 105's
  decision to "add the missing `DEPENDENCIES` order-and-length lock" no longer
  has a target.
- The ROADMAP adds criterion 6, which has no Phase 105 counterpart: the
  path-bearing premise behind `SUPPORTED_COMPONENT_PATH_KINDS` must be confirmed
  against Claude Code's own documentation or the behavior resting on it must
  change.

</domain>

<decisions>
## Implementation Decisions

### The soft dependency

- **Probe the quintinshaw-specific `workflow_control` tool, never bare
  `workflow`.** `@nicknisi/pi-workflows` registers a tool named `workflow` too,
  so a bare probe reports the engine this milestone *rejected on trust grounds*
  as present. A false positive here means the marker disappears for a user whose
  workflows cannot run (WDEP-01).

- **The discriminating test is the one that matters.** A session whose
  `getAllTools()` returns a tool named `workflow` but no `workflow_control` MUST
  read as absent. A test that only checks "present when `workflow_control` is
  present" passes under a bare `workflow` probe too, and therefore proves
  nothing about the requirement.

- **The probe lives in `platform/pi-api.ts`** as a third field on
  `SoftDepStatus`, beside `piSubagentsLoaded` and `piMcpAdapterLoaded`. That
  file's header names it the sanctioned import site for `pi.getAllTools()`.
  Follow the RH-3/RH-4 pattern already there rather than inventing a second
  shape.

- **`Dependency` gains `"workflows"` as a third union member. Do NOT reintroduce
  a runtime `DEPENDENCIES` tuple, and do NOT add an order-and-length lock for
  it.** Main removed the tuple deliberately and documented why in the module
  header. Reintroducing it to satisfy a criterion worded before the replay would
  be re-litigating main rather than re-landing the bridge. Criterion 1's
  "`DEPENDENCIES` carries a third member" reads onto the union; the byte-order
  guarantee it wanted is delivered instead by the two `docs/output-catalog.md`
  states (see The docs below), which pin the marker's position inside the brace
  by byte equality rather than by a tuple index.

- **The `dependencies` → flags parameter on `composeReasons` is a REQUIRED fifth
  positional boolean, never optional with a default.** An optional default
  compiles at every call site and visits none of them, which is exactly how a
  partial sweep ships looking complete. The compile errors are the coverage
  proof. This is the same reasoning that governed the third parameter, and it is
  the reason this project has a recurring "optional-field silent-omission"
  defect class to avoid.

- Marker order inside the brace is `agents`, `mcp`, `workflows` — append, do not
  interleave, so every existing two-marker byte form is unchanged.

### The marker-coverage gate (criterion 3)

- **One table-driven test, one case per `Dependency[]` derivation site.** The
  sites are `orchestrators/plugin/install.ts`, `orchestrators/plugin/list.ts`,
  `orchestrators/plugin/shared.ts`, `orchestrators/plugin/reinstall.messaging.ts`,
  `orchestrators/plugin/update-row.ts`, `orchestrators/import/execute.ts`, and
  `orchestrators/reconcile/apply-outcomes.ts`. Confirm the list by reading the
  tree at plan time rather than trusting this enumeration — a closed-set
  amendment has already been bigger than its enumeration twice in this
  milestone.

- **It lives in `tests/architecture/`,** beside the closed-set lock tests.
  Criterion 3 is a cross-site coverage claim, so it wants one owner, not seven
  scattered assertions that can each be deleted without anything noticing.

- **The negative control is mandatory and its run is recorded in the SUMMARY.**
  Revert exactly one derivation, confirm exactly one case turns red, restore.
  This milestone has already shipped two guards that were green because they
  checked nothing — an exact-length tuple that did not fail to typecheck, and a
  replacement forcing construct that was unconditionally `never`. In both cases
  only the negative control caught it. A gate whose negative control has not
  been run has not been shown to be a gate.

- **Reach the derivations through the public outcome → messaging path.** They
  are module-private functions and must stay that way; exporting one so a test
  can call it is a test-only seam, which this project's conventions forbid
  (dependency injection over test-only seams). If a derivation cannot be
  reached from a public surface, that is a finding about the surface, not a
  licence to widen it.

### Engine-independent bytes (criterion 2)

- **The bridge never reads the probe.** `bridges/workflows/*` must not import
  `softDepStatus` or `SoftDepStatus`. The probe reaches only the notify marker.
  This is what makes criterion 2 structurally true rather than incidentally
  true, and it is what makes the write-anyway choice defensible.

- **"Same bytes" is proved by comparison, not by both installs succeeding.**
  Install the same fixture twice, differing only in the fake `getAllTools()`
  result, and compare the envelope file bytes. A test that only asserts both
  installs succeed would pass even if the engine-absent path wrote a different
  envelope.

- **Severity when the engine is absent is `warning`,** by the tri-state model:
  the operation WAS carried out — the envelopes are written and correct — but
  the desired state is not reached, because nothing runs them yet. Not `info`
  (that claims a success the user does not have) and not `error` (the install
  genuinely succeeded). Degradation never blocks the install; `agents` with
  pi-subagents is the established precedent.

- **WDEP-03 is pinned, not merely asserted in prose.** Write-anyway is only
  correct because recovery needs no reinstall: installing the engine and
  reloading must make already-installed workflows run. Pin that nothing on the
  load path removes or rewrites envelopes based on probe state. That is the
  difference between a defensible choice and a merely harmless one.

- **Copy `reinstall`'s no-severity-raise asymmetry** rather than "fixing" it. It
  is an existing deliberate precedent, and diverging from it here would make one
  kind behave unlike the other five.

### The docs

- **The executable-code contract goes in a new `docs/workflows-compatibility.md`,**
  mirroring `docs/hooks-compatibility.md` — feature table, legend, upstream
  column against Pi column, design rationale for what was implemented, deferred,
  or declared unsupportable. A per-kind contract buried in a general README is a
  contract nobody finds.

- **Say plainly that this is the first bridge to install executable code rather
  than data,** name the host engine, and give the trust grounds it was chosen
  on. A plugin author deciding whether to ship `workflows/` needs the sandbox
  comparison, not just the API.

- **The admit-versus-run divergence table is mandatory, not optional colour.**
  Pre-validation replicates only `DETERMINISM_BLOCKLIST`, the first of the
  engine's `parseWorkflowScript` gates. Six shapes this bridge admits are shapes
  the engine refuses at invocation: `meta` missing a non-empty `description`;
  `meta` not the first statement; `export let meta`; a non-exported `const meta`;
  `export const meta = {...}, other = 1`; and both stem-fallback arms (no `name`
  property, non-literal `name`). A template-literal `name` is admitted under a
  DIFFERENT name than the one the engine resolves. The failure is bounded and
  visible, but it is a documented divergence, not a guarantee.

- **The doc carries an "Install-time disposition" section.** Four of its five
  dispositions are Phase 111-113 behavior currently documented nowhere a plugin
  author would find.

- **Label every evidence grade; never let one kind pass for another.** Engine
  claims cite `@quintinshaw/pi-dynamic-workflows` **3.10.1** and **Spike 027**,
  per this milestone's evidence base — not the 3.5.1 figures the archived Phase
  105 context used. Say runtime-measured where it is runtime-measured and
  source-read where it is source-read. Claude's `agent()` resolves to `null` on
  failure with a documented `pipeline(...)` + `.filter(Boolean)` pattern; the
  host's divergence is stated at whatever grade it actually holds. Phase 117
  owns upgrading that grade — this phase must not pre-state a measurement Phase
  117 has not yet made.

- **The engine's own peer floor (`pi-coding-agent >=0.80.8`) is documented as
  distinct from this project's (`>=0.80.5`)** — criterion 5. Two floors, stated
  as two, so a reader does not infer this project raised its own.

- **The README pair is in scope.** `README.md` and its line-for-line twin
  `README.es.md` each carry a Features list naming component kinds and a
  Prerequisites list naming companion extensions. Add workflows to both Features
  lists, add the host engine to both Prerequisites lists, and link the new
  compatibility doc from both. Update the Spanish twin in the same change —
  leaving it divergent is worse than a modest translation. Match its existing
  register; if any wording is uncertain, add it and say so in the summary rather
  than silently omitting it.

- **`docs/output-catalog.md` is amended additively under its existing byte
  gate:** the new reason token plus **two** rendered states, so the marker's
  order inside the brace is byte-pinned rather than conventional. Follow the
  region's established additive shape; do not restructure. Check the file's
  prose member counts for the `REASONS` tuple while there — prose is not covered
  by the byte gate and has gone stale before.

- **The token is `requires pi-dynamic-workflows`, NOT `requires pi-workflows`.**
  The obvious spelling is the npm name of `@nicknisi/pi-workflows` — the engine
  rejected on trust grounds — so a degradation message would point the user at
  the wrong package, and the more dangerous one. `requires pi-mcp` already
  precedents abbreviating a scope.

### Criterion 6 — the path-bearing premise

- **Settle it against Claude Code's own artifacts, not against this project's
  own lineage.** WFLW-02 states the `string | array` shape and Spike 021
  recorded it as assumption A1 at risk grade Low, but neither is an upstream
  citation, and `tests/domain/resolver.test.ts` names this phase as the owner of
  the confirmation.

- **Research both the published docs and the installed CLI binary.** Docs give
  the contract; the binary gives the exact tables. A scouting grep of Claude
  Code **2.1.251** already found `plugin_load_workflows_dir_failed`,
  `" workflows from plugin "`, `workflowsPath` / `workflowsPaths`,
  `.claude/workflows/`, and a namespace switch that groups `workflows` with
  `commands` / `agents` / `skills` / `rules`. So the field is neither absent
  upstream nor inline-map-shaped, and confirmation is the expected outcome. Do
  not treat that scout as the citation — it is a starting point, and the
  research step must produce the actual manifest-field evidence and name the
  version it read.

- **Record whichever way it goes, in both places.** On confirmation: cite it in
  `docs/workflows-compatibility.md` and replace the "premise has lineage but no
  upstream citation" paragraph in `tests/domain/resolver.test.ts` with the
  citation. On falsification: change the behavior — remove `workflows` from
  `SUPPORTED_COMPONENT_PATH_KINDS` so a malformed declaration degrades rather
  than resolving `unavailable` — and turn the pinned test rather than deleting
  it, the same red-then-green discipline WINV-04 required.

### Settled after research (orchestrator decisions, do not re-open)

Research re-derived every inherited number against the current tree and against
the 3.10.1 engine. Several moved. These decisions dispose of what it escalated.

- **R1 — criterion 6 is CONFIRMED; the behavior does not change.** Upstream's
  plugin manifest declares `workflows` as `string | array`, described in Claude
  Code 2.1.251's own schema as "Path to a workflows directory or .js file,
  relative to the plugin root", in a body shaped identically to `themes` and
  `outputStyles`, with the loader normalizing it through the same
  `Array.isArray(...) ? ... : [...]` idiom it uses for `agents`. The published
  reference at `code.claude.com/docs/en/plugins-reference` agrees.
  `SUPPORTED_COMPONENT_PATH_KINDS` keeps `workflows`. What changes is prose only:
  the "premise has lineage but no upstream citation" paragraph in
  `tests/domain/resolver.test.ts` is replaced by the citation, and
  `docs/workflows-compatibility.md` carries it too. Grade the binary read HIGH
  and the published page MEDIUM, and say which is which.

- **R2 — two upstream divergences fall out of that confirmation and belong in
  the doc, not in the code.** Upstream *replaces* the convention directory when
  the field is declared; this project *unions* declared-with-implicit (D-07).
  And upstream admits a `.js` FILE path where this project's discovery walk
  expects a directory. Neither is this phase's behavior to change. Read
  `bridges/workflows/discover.ts` at plan time: if a file target is silently
  dropped, document it as an install-time disposition; if it throws, that is a
  bug and earns a `[workflows-replay]` Broken Windows entry rather than a
  same-phase fix.

- **R3 — the refusal count: nine checks, six shapes, no total.** State that
  `parseWorkflowScript` refuses at NINE checks at 3.10.1 and that this bridge
  replicates TWO of them (determinism and parse), with determinism running
  first. Enumerate the six distinct `validateMeta` message shapes. Do NOT state
  a single refusal-message total — check 2's message is acorn's and is not
  enumerable, so any total would be a number with no honest counting rule.
  **Spike 027's "validateMeta carries four messages / twelve in all" does not
  reconcile with the 3.10.1 source and must not be repeated.** Correct Spike
  027's record in the same change that publishes the doc; a spike left saying
  something the source contradicts is how a wrong figure gets cited again.
  Every "seven gates / we replicate one" figure inherited from the archived
  phase is stale — do not ship it anywhere.

- **R4 — `piWithBothLoaded()` is renamed to `piWithAllLoaded()` across all 302
  call sites**, with `{ name: "workflow_control" }` added to its body. Its
  current name and its "no soft-dep markers fire" comment both become false the
  moment the third probe field lands, and leaving a lying name in 302 places is
  worse than the sweep. Two constraints on how: do the rename with an
  editor-scoped symbol rename, **not** a `sed` sweep — a text substitution
  across two large fixture files is exactly the change that silently rewrites a
  string inside a fixture. And verify the zero-byte claim empirically: run
  `tests/architecture/catalog-uat.test.ts` immediately after the probe field
  lands and BEFORE any fixture edit. No existing fixture declares `workflows`,
  so the added tool should change zero catalog bytes; if it does not, the byte
  gate is reporting a state this phase did not intend to touch.

- **R5 — the criterion-3 gate asserts on the RENDERED ROW at every site.** The
  seven derivation sites sit in three reachability tiers: two are already
  exported functions with their own tests, two sit one hop behind exported
  outcome-to-row composers, and three are reachable only by driving a full
  `installPlugin` / `loadPluginListPayload` / `importClaudeSettings`. Asserting
  on the rendered row makes all seven cases prove the same end-to-end claim —
  "this surface renders the marker" — rather than seven different intermediate
  ones. **Target the negative control at one of the three hard-to-reach sites**,
  not at an easy one: those are the cases a gate can most easily satisfy
  vacuously.

- **R6 — the eighth closed-set site is `docs/output-catalog.md`'s prose member
  count**, which reads "43-member" against a tuple that has been 44 since Phase
  113 and becomes 45 here. It sits outside the byte gate, which is why it went
  stale. Fix it, and treat the trail as eight sites rather than the seven the
  prior phase recorded.

- **R7 — `WDOC-03` is already satisfied.** `acorn` is declared at `^8.16.0` in
  `package.json` `dependencies`. This phase VERIFIES that and changes nothing.
  No `package.json`, `package-lock.json`, `sonar-project.properties`,
  `CHANGELOG.md` or version-constant edit is in scope; any such change is a
  review finding.

- **R8 — do not plan against `tests/live-uat/workflow-storage-canary.mjs`.** It
  does not exist on this tree. Cite Spike 027 for engine behavior instead, and
  do not let the compatibility doc name a `tests/...` path that does not
  resolve — `tests/architecture/no-stale-test-citations.test.ts` gates that.

### Claude's Discretion

- Plan and task decomposition; the compatibility doc's precise table columns and
  section order; the exact wording of the Spanish README additions; the shape of
  the table-driven gate's case records.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/platform/pi-api.ts` — `softDepStatus(pi)`
  returns the `SoftDepStatus` snapshot; the pi-subagents probe (RH-3) and the
  mcp-adapter probe (RH-4) are the two shapes to copy. Currently no `workflow`
  string appears in this file.
- `extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts` — holds
  `type Dependency = "agents" | "mcp"`, the two marker constants
  (`requires pi-subagents`, `requires pi-mcp`), and the pure
  `softDepMarkers(declaresAgents, declaresMcp, probe)` helper.
- `extensions/pi-claude-marketplace/shared/notify.ts` — the closed `REASONS`
  set, `composeReasons(reasons, includesAgents, includesMcp, probe)`, and the
  two central soft-dep row composers `installedLikeRow` and
  `partiallyInstalledRow`, which are the sole composition sites for the
  soft-dep-bearing rows.
- `docs/hooks-compatibility.md` — the structural template for the new
  compatibility doc.
- `docs/output-catalog.md` — the byte-equality gate, already amended additively
  during this milestone for `stale workflow command`.
- `tests/architecture/notify-closed-set-locks.test.ts` and the sibling
  architecture gates — the shape a closed-set/coverage lock takes here.

### Established Patterns

- A soft dependency is four things: a probe in `platform/pi-api.ts`, a
  `Dependency` member, a marker, and a reason token. A partial set is a latent
  bug.
- Commands determine state and stamp severity and reasons; `shared/notify.ts` is
  a dumb renderer and must not probe state itself.
- Closed sets are pinned by lock tests plus the catalog byte gate.
- Architecture gates verify by *planting* a violation, never by re-reading the
  rule's own configuration.
- No test-only seams: a dependency that is hard to test wants to be an explicit
  collaborator, not a hole punched in the production module.

### Integration Points

- `platform/pi-api.ts` — the probe and `SoftDepStatus`.
- `shared/concerns/soft-dep.ts` — the `Dependency` union, the third marker, and
  `softDepMarkers`.
- `shared/notify.ts` + `shared/notify-reasons.ts` + `docs/output-catalog.md` —
  the token and its rendered states.
- The seven `Dependency[]` derivation sites across `orchestrators/` — where the
  new member is stamped.
- `domain/resolver.ts` (`SUPPORTED_COMPONENT_PATH_KINDS`) and
  `tests/domain/resolver.test.ts` — only if criterion 6 falsifies the premise.
- `docs/workflows-compatibility.md` (new), `README.md`, `README.es.md`.

</code_context>

<specifics>
## Specific Ideas

- The engine sandbox comparison, measured on one identical fixture, belongs in
  the docs: quintinshaw gives a frozen `process` stub with `cwd` only,
  `process.env` undefined, `process.binding('fs')` a TypeError, no
  Function-constructor escape, and clock/RNG rejected pre-parse. `@nicknisi`
  gives the real host `process`, 60 env vars, real fs internals, and a
  Function-constructor escape into the host realm. Re-check these against 3.10.1
  before publishing them — they were established at an earlier version.
- Upstream stability is a documented risk, not a footnote: the envelope shape,
  the cwd-key derivation, the saved-directory layout and the name validator are
  private internals of a 0.x package with roughly 50 releases since May 2026 and
  no exported contract.
- Evidence base: the `spike-findings-pi-claude-marketplace` project skill,
  `references/workflows-bridge.md` — section 7 ("Soft-dep probe") and the whole
  Constraints section; Spike 027 for the 3.10.1 re-measurement.

</specifics>

<deferred>
## Deferred Ideas

- Version bump, CHANGELOG entry, PR — milestone-close work, not phase work.
- Replicating the engine's other `parseWorkflowScript` gates as install-time
  refusals — deliberately not done. Phase 115 warns instead (WGATE-01..05), and
  the "Out of Scope" table records why the strict direction was refused.
- Upgrading the `agent()` failure claim from a source read to a measurement —
  Phase 117 (WEVID-01..02). This phase states the grade it holds today.
- `WPIN-01`, a machine-checkable re-read of the vendored `DETERMINISM_BLOCKLIST`
  and the envelope internals against a newer engine — recorded as a future
  requirement, not this milestone's work.
- The uncapped double read of every candidate script body on the `info` surface
  (code-review IN-02, deferred from Phase 113) — logged in `.planning/BACKLOG.md`.

</deferred>
