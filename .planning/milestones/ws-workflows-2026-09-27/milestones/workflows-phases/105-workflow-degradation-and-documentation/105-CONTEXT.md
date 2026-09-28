# Phase 105: Workflow degradation and documentation - Context

**Gathered:** 2026-08-16
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — recommendations recorded as accepted

<domain>
## Phase Boundary

A user without the host engine still gets their workflows written and is told plainly why
they do not run yet, and the contract of a bridge that installs executable code is stated
where a plugin author will read it.

**In scope:** the `workflow_control` soft-dependency probe and its false-positive guard,
`workflows` as the third `DEPENDENCIES` member with its marker, the new degradation reason
token in the closed `REASONS` set and `docs/output-catalog.md`, write-anyway degradation
that converges on `/reload`, and the executable-code documentation contract with its
admit-versus-run divergence table.

**Out of scope:** everything about installing and removing artifacts — Phases 103 and 104
closed that. Also out of scope: the version bump, CHANGELOG entry and PR, which are
milestone-close work rather than phase work.

**This is the last phase of the milestone.** What it adds is not a feature so much as
honesty: today a user with no engine gets a silent success. The artifacts are written and
correct, and nothing runs, and nothing says why.

</domain>

<decisions>
## Implementation Decisions

### The probe

- Probe the **quintinshaw-specific `workflow_control` tool**, never bare `workflow`.
  `@nicknisi/pi-workflows` registers a tool named `workflow` too, so a bare probe reports
  a rejected engine as present — and that engine is the one this milestone refused on trust
  grounds (`runInThisContext()`, the real `process`, all env vars,
  `process.binding('fs')`). A false positive here means writing artifacts for an engine we
  deliberately did not target.

- The probe lives in **`platform/pi-api.ts`**, beside `hasLoadedPiMcpAdapter` and the
  pi-subagents probe. That file's header names it the sanctioned import site for
  `pi.getAllTools()` because that call belongs to the external Pi API surface. Follow the
  RH-3/RH-4 pattern already there rather than inventing a second shape.

- **The discriminating test is the one that matters.** A session whose `getAllTools()`
  returns a tool named `workflow` but no `workflow_control` MUST read as absent. A test
  that only checks "present when `workflow_control` is present" passes under a bare
  `workflow` probe too, and therefore proves nothing about the requirement.

### Degradation

- Severity is **warning**, by the tri-state model: the operation WAS carried out — the
  artifacts are written and correct — but the desired state is not reached, because nothing
  runs them yet. Not `info` (that would claim success the user does not have) and not
  `error` (the install genuinely succeeded).

- **Degradation never blocks the install.** That is the project's Core Value, and `agents`
  with pi-subagents is the established precedent: write the artifact, mark the dependency,
  let `/reload` converge.

- **Write-anyway is only correct because recovery needs no reinstall.** Installing the
  engine and running `/reload` must make already-installed workflows run. Pin that
  explicitly — it is the difference between a defensible choice and a merely harmless one,
  and it is criterion 3's whole point.

- `DEPENDENCIES` is a closed tuple growing from two members to three. Add the marker with
  it; a member without its marker is a half-registered dependency.

### The docs

- The executable-code contract goes in a **new `docs/workflows-compatibility.md`**, mirroring
  the existing `docs/hooks-compatibility.md`. That file is the established shape for a
  per-component-kind compatibility contract — feature table, legend, upstream column against
  Pi column, design rationale for what was implemented, deferred, or declared unsupportable.
  A per-kind contract buried in a general README is a contract nobody finds.

- **The admit-versus-run divergence table is mandatory, not optional colour.** Our
  pre-validation replicates only `DETERMINISM_BLOCKLIST`, the FIRST of seven gates in the
  engine's `parseWorkflowScript`. Six shapes we admit are shapes the engine refuses at
  invocation: `meta` missing a non-empty `description`; `meta` not the first statement;
  `export let meta`; a non-exported `const meta`; `export const meta = {...}, other = 1`;
  and both stem-fallback arms (no `name` property, non-literal `name`). A template-literal
  `name` is admitted under a DIFFERENT name than the one the engine resolves. The failure is
  bounded and visible — the artifact installs, the command registers, and the engine reports
  `/<name> failed: <message>` at invocation — but it is a documented divergence, not a
  guarantee, and the docs must say so in those terms.

- **State what was measured and what was not, and label each kind of evidence.** Claude's
  `agent()` resolves to `null` on failure, with a documented `pipeline(...)` +
  `.filter(Boolean)` pattern. `@nicknisi`'s counterpart was measured at runtime (it throws).
  quintinshaw's was **read from the shipped 3.5.1 source** — `agent()` rejects, every
  failure branch in `agentImpl` throws — but was never driven at runtime, because that needs
  real spawn machinery.

  > **Superseded in part — see A6 below.** This bullet originally said to write "not
  > measured" for quintinshaw. That is no longer true and must not be written. The rule the
  > bullet encodes is unchanged: never let one kind of evidence pass for another. Say
  > runtime-measured where it is runtime-measured and source-read where it is source-read.

- Say plainly that this is the **first bridge to install executable code rather than data**,
  name the host engine, and give the trust grounds it was chosen on. A plugin author
  deciding whether to ship `workflows/` needs the sandbox comparison, not just the API.

- `docs/output-catalog.md` sits under a byte-equality gate. Phase 104 added
  `stale-workflow-command` additively and deliberately left the region shaped to admit a
  second additive amendment — follow that, do not restructure.

### Settled after research (orchestrator decisions, do not re-open)

- **A6 — `agent()` failure semantics: state what the source read shows, labelled as a source
  read.** This CONTEXT originally locked the wording to "not measured" for quintinshaw.
  Research has since read the shipped 3.5.1 source: its `agent()` **rejects** — every
  failure branch in `agentImpl` throws — it does not resolve to `null` the way Claude's
  does. "Not measured" would now be false. Write the finding, and label its provenance
  exactly: read from the shipped source at 3.5.1, not driven at runtime. The original
  decision's intent was *never claim a measurement you did not make*; a source read is a
  different and weaker kind of evidence, and saying which kind it is honors that intent
  better than either alternative. This strengthens the divergence warning rather than
  softening it.

- **A7 — the README pair is IN SCOPE.** `README.md` and its line-for-line twin
  `README.es.md` each carry a Features list naming five component kinds and a Prerequisites
  list naming two companion extensions — workflows is absent from all four lists. Criterion
  5 requires the contract to be stated "where a plugin author will read it", and a plugin
  author reads the README before they read `docs/`. Shipping a sixth component kind that no
  entry-point document mentions would make the milestone undiscoverable. Add workflows to
  both Features lists, add the host engine to both Prerequisites lists, and link the new
  compatibility doc from both. Update the Spanish twin in the same change — it is a
  maintained line-for-line translation, and leaving it divergent is worse than a modest
  translation. Match its existing register; if any wording is uncertain, add it and say so
  in the summary rather than silently omitting it.

- **The token is `requires pi-dynamic-workflows`, NOT `requires pi-workflows`.** The obvious
  spelling is the npm name of `@nicknisi/pi-workflows` — the engine this milestone rejected
  on trust grounds — so a degradation message would point the user at the wrong package, and
  the more dangerous one. `requires pi-mcp` already precedents abbreviating a scope.

- **The `dependencies` → flags parameter is REQUIRED, never optional with a default.** An
  optional default compiles at all 31 `composeReasons` call sites and visits none of them,
  which is exactly how a partial sweep ships looking complete. The compile errors are the
  coverage proof.

- **Add the missing `DEPENDENCIES` order-and-length lock.** It is the only one of the four
  closed sets without one, and this is the phase that grows it — the moment a pin is worth
  the most.

- **Two catalog states, not one**, so the marker's order inside the brace is byte-pinned
  rather than conventional.

- **Copy `reinstall`'s no-severity-raise asymmetry** rather than "fixing" it — it is an
  existing deliberate precedent, and diverging from it here would make one kind behave
  unlike the other five.

- **The new compatibility doc gets an "Install-time disposition" section.** Four of its five
  dispositions are Phase 102-104 behaviour currently documented nowhere a plugin author
  would find.

- **Fix `docs/output-catalog.md`'s stale "38-member REASONS tuple" prose** — the tuple has
  been 39 since Phase 104 and becomes 40 here. It is prose, so no gate caught it.

### Claude's Discretion

- The reason token's exact spelling and the marker's, the compatibility doc's precise table
  columns, and plan/task decomposition.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `platform/pi-api.ts` — `softDepStatus(pi)` returns the snapshot; the pi-subagents probe
  (RH-3) and the mcp-adapter probe (RH-4) are the two shapes to copy.
- `shared/concerns/soft-dep.ts` — `DEPENDENCIES = ["agents", "mcp"] as const` and the
  derived `Dependency` type via indexed access. Growing the tuple grows the type.
- `shared/notify.ts` — the closed `REASONS` set, its topic grouping in `notify-reasons.ts`,
  and the closed-set lock tests. Phase 104 traced all seven artifacts a token addition
  touches; reuse that trail.
- `docs/hooks-compatibility.md` — the structural template for the new compatibility doc.
- `docs/output-catalog.md` — the byte-equality gate, already amended additively once this
  milestone.

### Established Patterns

- A soft dependency is: a probe in `platform/pi-api.ts`, a `DEPENDENCIES` member, a marker,
  and a reason token — four things, and a partial set is a latent bug.
- Commands determine state and stamp severity and reasons; `shared/notify.ts` is a dumb
  renderer and must not probe state itself.
- Closed sets (`REASONS`, `STATUS_TOKENS`, `MARKERS`, `DEPENDENCIES`) are pinned by
  order-and-length lock tests plus the catalog byte gate.

### Integration Points

- `platform/pi-api.ts` — the probe and `softDepStatus`.
- `shared/concerns/soft-dep.ts` — `DEPENDENCIES` and the marker.
- `shared/notify.ts` + `shared/notify-reasons.ts` + `docs/output-catalog.md` — the token.
- The install/update/reinstall/enable rows — where the degradation reason is stamped.
- `docs/` — the new `workflows-compatibility.md`.

</code_context>

<specifics>
## Specific Ideas

- The engine sandbox comparison, measured on one identical fixture, belongs in the docs:
  quintinshaw gives a frozen `process` stub with `cwd` only, `process.env` undefined,
  `process.binding('fs')` a TypeError, no Function-constructor escape, and clock/RNG
  rejected pre-parse. `@nicknisi` gives the real host `process`, 60 env vars, real fs
  internals, and a Function-constructor escape into the host realm.
- Upstream stability is a documented risk, not a footnote: the envelope shape, the
  cwd-key derivation, the saved-directory layout and the name validator are private
  internals of a 0.x package with 50 releases since May 2026 and no exported contract.
- Evidence base: `spike-findings-pi-claude-marketplace` project skill,
  `references/workflows-bridge.md` — section 7 ("Soft-dep probe") and the whole Constraints
  section.

</specifics>

<deferred>
## Deferred Ideas

- Version bump, CHANGELOG entry, PR — milestone-close work, not phase work.
- The four residual risks accepted in Phase 104 (the untested double-fault branch, the
  narrow update double fault, the POSIX-only tests that skip as root, and
  `unplaceWorkflows`'s unstructured leak channel) stay accepted; they are recorded in
  STATE.md and are not this phase's work.
- Replicating the engine's other six `parseWorkflowScript` gates — deliberately NOT done;
  the divergence is documented instead (WDOC-01), which is this phase's chosen treatment.

</deferred>
