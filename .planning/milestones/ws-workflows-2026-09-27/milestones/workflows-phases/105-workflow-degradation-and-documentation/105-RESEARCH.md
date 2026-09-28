# Phase 105: Workflow degradation and documentation - Research

**Researched:** 2026-08-16
**Domain:** Soft-dependency probing, closed-set growth, byte-gated documentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**The probe**

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

**Degradation**

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

**The docs**

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

- **State what was measured and what was not.** Claude's `agent()` resolves to `null` on
  failure, with a documented `pipeline(...)` + `.filter(Boolean)` pattern. The host
  counterpart was measured on `@nicknisi` (it throws) and was **NOT** measured on
  quintinshaw — driving its `agent()` needs real spawn machinery. Write "not measured", not
  a hedge that reads as a measurement.

- Say plainly that this is the **first bridge to install executable code rather than data**,
  name the host engine, and give the trust grounds it was chosen on. A plugin author
  deciding whether to ship `workflows/` needs the sandbox comparison, not just the API.

- `docs/output-catalog.md` sits under a byte-equality gate. Phase 104 added
  `stale-workflow-command` additively and deliberately left the region shaped to admit a
  second additive amendment — follow that, do not restructure.

### Claude's Discretion

- The reason token's exact spelling and the marker's, the compatibility doc's precise table
  columns, and plan/task decomposition.

### Deferred Ideas (OUT OF SCOPE)

- Version bump, CHANGELOG entry, PR — milestone-close work, not phase work.
- The four residual risks accepted in Phase 104 (the untested double-fault branch, the
  narrow update double fault, the POSIX-only tests that skip as root, and
  `unplaceWorkflows`'s unstructured leak channel) stay accepted; they are recorded in
  STATE.md and are not this phase's work.
- Replicating the engine's other six `parseWorkflowScript` gates — deliberately NOT done;
  the divergence is documented instead (WDOC-01), which is this phase's chosen treatment.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WDEP-01 | Host engine probed via the quintinshaw-specific `workflow_control` tool, RH-3/RH-4 pattern. Bare `workflow` false-positives on `@nicknisi/pi-workflows`. | §Probe Design — both engines' `registerTool` sites read from the shipped tarballs this session; the false positive is confirmed, not inferred. |
| WDEP-02 | Engine absent -> artifacts still written, install still succeeds, carrying a degradation reason. Never blocks. | §Marker Plumbing — the `agents`/pi-subagents path is purely a render-time marker plus a severity stamp; it has no gate on the ledger. Copying it is structurally incapable of blocking. |
| WDEP-03 | Install the engine + `/reload` -> already-installed workflows work, no reinstall. | §Proving WDEP-03 — the engine registers from a plain directory scan on `session_start`; three-layer proof recommended (structural gate + unit + canary extension). |
| WDEP-04 | `workflows` becomes the third `DEPENDENCIES` member with its marker; new token joins `REASONS`. | §The Four Artifacts + §Token Artifact Trail (re-derived post-104). |
| WDOC-01 | Docs state first-executable-code bridge, name the host engine and trust grounds, separate guaranteed from divergent semantics; carry the admit-versus-run divergence table. | §Docs Deliverable — all seven `parseWorkflowScript` gates read verbatim from engine 3.5.1 source this session. |
| WDOC-02 | `docs/output-catalog.md` carries the new token and rendered states under the byte gate. | §Catalog Amendment. |
</phase_requirements>

## Summary

This phase adds one soft dependency to a codebase that already has exactly two, and one
document to a `docs/` tree that already has the template. Almost nothing here is novel
design — the value of this research is in (a) verifying the engine facts the whole phase
rests on against the shipped package rather than against spike notes, (b) enumerating the
blast radius of a third `DEPENDENCIES` member honestly, because it is much wider than
"add a string to a tuple" suggests, and (c) naming the two traps: a reason-token spelling
that names the *rejected* engine, and a probe that changes nothing observable in the
existing catalog fixtures only because no fixture stages a workflow today.

Every load-bearing engine claim in the CONTEXT was re-verified this session against
`@quintinshaw/pi-dynamic-workflows@3.5.1` and `@nicknisi/pi-workflows@0.2.2`, unpacked from
npm. `workflow_control` exists and is registered through `pi.registerTool`; nicknisi
registers `workflow` and nothing else workflow-shaped; the seven `parseWorkflowScript`
gates are exactly seven; and `registerAllSavedWorkflows` is a `session_start` handler that
walks `storage.list()`, which is a plain directory scan. That last fact is the mechanism
that makes WDEP-03 true, and it means WDEP-03 is provable structurally rather than only by
live UAT.

The real cost centre is the `declaresAgents` / `declaresMcp` boolean pair. It appears at 96
source sites across 13 orchestrator/shared files, and `composeReasons(reasons, declaresAgents,
declaresMcp, probe)` has 31 call sites. A third dependency is not one edit; it is a
compile-error-driven sweep. That is a feature, not a bug — Phase 101 established the house
pattern ("the compile errors it forces are the closure proof") — but it must be planned as a
sweep with a required (never optional-defaulted) third parameter, or the sweep silently
does not happen.

**Primary recommendation:** Add `workflowEngineLoaded` to `SoftDepStatus` and
`declaresWorkflows` as a **required** third positional/field parameter to `softDepMarkers`,
`composeReasons` and `companionSeverity`, then let the compiler enumerate the ~30 call sites.
Mirror the `agents` stamping set exactly (install / update / enable / list / import /
reconcile, and NOT uninstall / disable, and NO severity raise on reinstall). Spell the token
`requires pi-dynamic-workflows`, not `requires pi-workflows` — the latter names the engine
this milestone rejected.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Host-engine detection (`workflow_control`) | `platform/` | — | `pi.getAllTools()` is external Pi API surface; `platform/pi-api.ts` is the declared sole import site for it |
| Closed dependency set + marker literals | `shared/concerns/soft-dep.ts` | — | Owns `DEPENDENCIES`, `Dependency`, both marker constants, and the pure `softDepMarkers` helper (D-01) |
| Reason token membership + order | `shared/notify.ts` | `shared/notify-reasons.ts` | `REASONS` is the byte-source of catalog truth; the topic-grouped views are typed views over it |
| Deciding a row declares `workflows` | `orchestrators/plugin/*` | — | Commands determine state and stamp reasons; `notify.ts` is a dumb renderer and must not probe |
| Severity raise on unloaded companion | `shared/notify-reasons.ts::companionSeverity` | orchestrator call sites | Pure given the probe; the orchestrator supplies the declares-flags |
| Rendered bytes for the new states | `docs/output-catalog.md` | `tests/architecture/catalog-uat.test.ts` | Bidirectional byte gate: doc and fixture must land together |
| Executable-code contract | `docs/workflows-compatibility.md` | `README.md` / `README.es.md` | Per-kind compatibility contract, discoverable from the Features list |

## Standard Stack

No new packages. This phase installs nothing.

### Core (already declared, unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | peer `>=0.80.5`, dev `^0.83.0` | `ExtensionAPI.getAllTools()` — the probe surface | Already the sole external Pi API dependency [VERIFIED: package.json] |
| `node:test` | Node >= 20.19.0 builtin | every test suite | Project standard [VERIFIED: package.json scripts] |

### Referenced-but-not-installed (the subject of the docs)

| Package | Version | Role | Verification |
|---------|---------|------|--------------|
| `@quintinshaw/pi-dynamic-workflows` | 3.5.1 (published 2026-08-05) | the host engine — **never** a dependency of this repo | [VERIFIED: `npm view @quintinshaw/pi-dynamic-workflows version` -> `3.5.1`; `time.modified` -> `2026-08-05T16:39:24.428Z`] |
| `@nicknisi/pi-workflows` | 0.2.2 | the REJECTED engine — the false-positive source | [VERIFIED: `npm view @nicknisi/pi-workflows version` -> `0.2.2`] |

**Do not add either to `package.json`.** The Phase 103 canary rationale states the trade
explicitly: adding the engine to a dependency block swaps a loud pinned failure for a flaky
one and pulls the Pi host in transitively. The live canary resolves it out-of-tree via
`PI_WORKFLOW_ENGINE_ROOT` instead [VERIFIED: tests/live-uat/workflow-storage-canary.mjs:160-174].

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** The two packages named above
are documented, not depended on. No `package.json`, `package-lock.json` or dependency
manifest change is in scope. (A dependency-manifest diff in this phase's commits is itself a
review finding.)

## Architecture Patterns

### System Architecture Diagram

```text
  Pi host session
        │
        │ pi.getAllTools()
        ▼
 ┌──────────────────────────────────────────────────────────────┐
 │ platform/pi-api.ts                                            │
 │   hasLoadedPiSubagents  -> tool named "subagent"              │
 │   hasLoadedPiMcpAdapter -> tool "mcp" OR sourceInfo match     │
 │   hasLoadedWorkflowEngine -> tool named "workflow_control" ◄NEW│
 │   softDepStatus(pi) -> { piSubagentsLoaded,                   │
 │                          piMcpAdapterLoaded,                  │
 │                          workflowEngineLoaded ◄NEW }          │
 └────────────────────────┬─────────────────────────────────────┘
                          │ SoftDepStatus snapshot (ONE per notify() call)
      ┌───────────────────┴────────────────────┐
      │                                         │
      ▼                                         ▼
 ┌───────────────────────────┐        ┌──────────────────────────────┐
 │ orchestrators/plugin/*     │        │ shared/notify.ts (renderer)   │
 │  stagedWorkflowNames.len>0 │        │  composeReasons(reasons,      │
 │    -> dependencies += ◄NEW │        │    declaresAgents,            │
 │       "workflows"          │───────►│    declaresMcp,               │
 │  companionSeverity(...)    │  row   │    declaresWorkflows, ◄NEW    │
 │    -> info | warning       │        │    probe)                     │
 └───────────────────────────┘        │      │                         │
                                       │      ▼                         │
                                       │ shared/concerns/soft-dep.ts    │
                                       │  DEPENDENCIES = [agents, mcp,  │
                                       │                  workflows◄NEW]│
                                       │  softDepMarkers -> Reason[]    │
                                       └──────────────┬─────────────────┘
                                                      │ "{r1, r2}" brace
                                                      ▼
                                          ctx.ui.notify(text, severity)
                                                      │
                                          byte-compared against
                                                      ▼
                                             docs/output-catalog.md
                                       (tests/architecture/catalog-uat.test.ts)

  ── independent of all of the above ──
  ~/.pi/workflows/saved/<plugin>:<name>.json   (written by Phase 103's bridge)
        │
        │ engine session_start handler
        ▼
  createWorkflowStorage(cwd).list()  -> plain readdir over 3 dirs
        │
        ▼
  registerAllSavedWorkflows -> pi.registerCommand per envelope
```

The right-hand branch is the whole of WDEP-03: the artifact path and the probe path never
touch. Nothing the install writes depends on the probe's answer, so installing the engine
later and reloading converges by construction.

### Pattern 1: The RH-3/RH-4 probe shape

**What:** a named-tool predicate over `pi.getAllTools()`, wrapped in `try/catch` that
degrades to `false`.
**When to use:** every companion-extension probe. Both existing probes use it; do not invent
a second shape.
**Existing code** [VERIFIED: extensions/pi-claude-marketplace/platform/pi-api.ts:129-160]:

```ts
/**
 * RH-3: pi-subagents loaded iff `pi.getAllTools()` contains a tool named
 * "subagent". Probe failures degrade to unloaded.
 */
export function hasLoadedPiSubagents(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "subagent");
  } catch {
    return false;
  }
}
```

`hasLoadedPiMcpAdapter` is the richer RH-4 variant: it also substring-matches
`sourceInfo.source` against `"pi-mcp-adapter"`, and it casts through
`tool as { name?: unknown; sourceInfo?: { source?: unknown } }` to read the optional field
[VERIFIED: platform/pi-api.ts:146-160].

**Which shape does `workflows` take?** RH-3, not RH-4. The RH-4 `sourceInfo` fallback exists
because pi-mcp-adapter's tool name is generic enough to be uncertain; `workflow_control` is
distinctive and is registered unconditionally. Adding a `sourceInfo.source.includes("pi-dynamic-workflows")`
arm would *re-open* the false-positive surface the requirement exists to close — a session
running some other extension whose source string happens to contain that substring would read
as present. Recommend the plain RH-3 name predicate.

### Pattern 2: closed-set growth forced by a required field

The house pattern, established in this milestone: make the new member REQUIRED so the
compiler enumerates every construction site.

Phase 101 decision, verbatim from STATE.md:

> `componentPaths.workflows` is a REQUIRED schema member; the compile errors it forces are
> the closure proof

Applied here, three widenings each force their own sweep:

1. `SoftDepStatus` gains a required `workflowEngineLoaded: boolean` -> every literal
   construction fails to compile. There are exactly two production constructions
   (`softDepStatus`) and several test literals (`tests/platform/pi-api.test.ts:59,62,128-129`).
2. `softDepMarkers` / `composeReasons` gain a required `declaresWorkflows: boolean` -> 31
   `composeReasons` call sites fail to compile.
3. `companionSeverity`'s object parameter gains a required `declaresWorkflows` -> 3 call
   sites fail to compile (`install.ts:1967`, `update.ts:2510`, `enable-disable.ts:1075`).

**Anti-pattern: an optional-defaulted parameter.** `declaresWorkflows = false` compiles
everywhere and visits nothing. The whole reason a closed set is a tuple in this codebase is
that growing it must be loud. An optional default makes the third member silent exactly where
it matters.

### Pattern 3: the `Dependency` -> row derivation, five copies

There is no single `dependenciesFrom(...)` helper. Five near-identical derivations exist,
each in its own file, each pushing `"agents"` then `"mcp"` in that order:

| Site | Function | Source of the flags |
|------|----------|---------------------|
| `orchestrators/plugin/install.ts:1899-1906` | inline `const dependencies: Dependency[] = []` | `installCtx.stagedAgentNames.length > 0` / `stagedMcpServerNames.length > 0` |
| `orchestrators/plugin/list.ts:300-310` | `dependenciesFromDeclares` | `record.resources.agents.length > 0` / `record.resources.mcpServers.length > 0` (list.ts:450-451) |
| `orchestrators/plugin/update-row.ts:171-175` | `outcomeDependencies` | `outcome.declaresAgents` / `outcome.declaresMcp` |
| `orchestrators/plugin/reinstall.ts:1074-1082` | `dependenciesFromOutcome` | `outcome.declaresAgents` / `outcome.declaresMcp` |
| `orchestrators/plugin/shared.ts:108-123` | `enableRowDependencies` | `signals.stagedAgents === true` / `stagedMcpServers === true` |
| `orchestrators/reconcile/apply.ts:319-332` | `dependenciesFromInstall` | `outcome.declaresAgents` / `outcome.declaresMcp` |
| `orchestrators/import/execute.ts:318-325` | `dependenciesFromInstalled` | `o.declaresAgents` / `o.declaresMcp` |

Seven, counting reconcile and import. Each needs a third arm. **Order matters** — the brace
join is byte-critical and `softDepMarkers` emits in `DEPENDENCIES` tuple order, so the
derivations must push `"workflows"` LAST, matching the tuple append.

`sonarjs/no-identical-functions` is an ESLint **error** in this repo. Seven three-arm
copies of the same shape may trip it where two-arm copies did not. Consolidating into one
shared helper is the clean answer, but it moves code across the `orchestrators/` /
`shared/` boundary — plan a fallback (keep them local, accept the widening) if the
consolidation collides with the import-boundary gates.

### Anti-Patterns to Avoid

- **Probing bare `workflow`.** Verified false positive, see §Probe Design.
- **Adding a `sourceInfo.source` fallback arm to the workflows probe.** Reopens the false
  positive the requirement closes.
- **Restructuring `docs/output-catalog.md`.** Phase 104 left the uninstall region shaped for
  a second additive amendment; a restructure would move bytes on untouched states and fail
  the gate for reasons unrelated to this phase.
- **Stamping the marker on `uninstalled` / `disabled` rows.** MSG-SD-3 is structural: those
  variants have no `dependencies` field by construction, and `uninstall.messaging.ts:64` /
  `enable-disable.messaging.ts:113` hard-code `composeReasons(p.reasons, false, false, probe)`.
  Threading a `true` there would be inventing, not copying.
- **Raising severity on the reinstall row.** `reinstall.ts:956` stamps
  `severity: reasons.length > 0 ? "warning" : "info"` and never calls `companionSeverity`.
  The catalog's reinstall `success-with-soft-dep` block carries no `needs attention` summary
  line [VERIFIED: docs/output-catalog.md:725-737], confirming reinstall deliberately does not
  raise. Copy that asymmetry.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting the host engine | a `require.resolve` / filesystem probe for the package | `pi.getAllTools()` name predicate in `platform/pi-api.ts` | The question is "is the extension LOADED in this session", not "is it installed". A resolvable-but-not-enabled package answers the wrong question. |
| Rendering the marker | pushing the token into `reasons[]` at the orchestrator | `dependencies: [..., "workflows"]` + render-time `composeReasons` | D-16-15: soft-dep markers are computed by the renderer, never caller-placed. `docs/output-catalog.md:67` states this as contract. |
| Deciding severity | an inline ternary at each row composer | `companionSeverity(...)` from `shared/notify-reasons.ts` | One producer-local classifier already exists and is what the catalog prose describes. |
| Marker ordering in the brace | hand-ordering push calls | `softDepMarkers` iterating in `DEPENDENCIES` order | The join is byte-critical; the tuple is the order authority. |
| A second closed-set completeness check | a runtime assertion | the existing `_ReasonsCoverageProof` type in `notify-reasons.ts:235-238` | A literal added to `REASONS` without a topic-group home is already a TS2344 compile error. |
| A doc-freshness check | a new docs test | the existing byte gate (`catalog-uat.test.ts`) + closed-set locks | Adding a third gate over the same facts creates a third place to bump. |

**Key insight:** every mechanism this phase needs already exists and is exercised by two
dependencies. The work is arithmetic (2 -> 3), not design. The failure mode is an incomplete
sweep, which is why every widening should be a required field.

## Probe Design (WDEP-01)

### The engine facts, verified this session

Both packages were fetched from npm and unpacked; the quotes below are verbatim from the
shipped tarballs.

**`@quintinshaw/pi-dynamic-workflows@3.5.1` registers two tools at extension load**
[VERIFIED: `package/extensions/workflow.ts:176-178` of the 3.5.1 tarball]:

```ts
  const workflowControlTool = createWorkflowControlTool({ getManager });
  pi.registerTool(workflowTool);
  pi.registerTool(workflowControlTool);
```

The control tool's name is a literal [VERIFIED: `package/src/workflow-control-tool.ts:76`]:

```ts
    name: "workflow_control",
```

A third tool `deep_research` also exists [VERIFIED: `package/src/deep-research.ts:22` — `name: 'deep_research',`], but it is not
workflow-distinctive and is a worse probe target.

**`@nicknisi/pi-workflows@0.2.2` registers exactly one tool, named `workflow`**
[VERIFIED: `package/index.ts:242-243` of the 0.2.2 tarball]:

```ts
  pi.registerTool({
    name: 'workflow',
```

A full scan of the nicknisi package for `name:` string literals yields
`'demo'`, `'lanes'`, `'research'`, `'workflow'`. No `workflow_control`.

**Conclusion:** the false positive is real and the discriminator is exact. A session with
nicknisi loaded exposes `workflow` and not `workflow_control`; a session with quintinshaw
loaded exposes both.

### Recommended probe

```ts
export interface SoftDepStatus {
  piSubagentsLoaded: boolean;
  piMcpAdapterLoaded: boolean;
  workflowEngineLoaded: boolean;
}

/**
 * WDEP-01: the `@quintinshaw/pi-dynamic-workflows` host engine is loaded iff
 * `pi.getAllTools()` contains a tool named "workflow_control". The engine
 * registers BOTH `workflow` and `workflow_control`; `@nicknisi/pi-workflows`
 * registers only `workflow`, so probing the bare name would report a rejected
 * engine as the host. Probe failures degrade to unloaded.
 */
export function hasLoadedWorkflowEngine(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "workflow_control");
  } catch {
    return false;
  }
}

export function softDepStatus(pi: ExtensionAPI): SoftDepStatus {
  return {
    piSubagentsLoaded: hasLoadedPiSubagents(pi),
    piMcpAdapterLoaded: hasLoadedPiMcpAdapter(pi),
    workflowEngineLoaded: hasLoadedWorkflowEngine(pi),
  };
}
```

Note the doc comment cites `WDEP-01` — a requirement ID, which the comment policy permits —
and names both engines. Do NOT cite a phase number.

### The discriminating test (CONTEXT calls this the test that matters)

The naive positive/negative pair is insufficient:

```ts
// INSUFFICIENT -- passes under a bare `workflow` probe too
assert.equal(hasLoadedWorkflowEngine(makePi([{ name: "workflow_control" }])), true);
assert.equal(hasLoadedWorkflowEngine(makePi([])), false);
```

The case that proves the requirement is the nicknisi shape:

```ts
// The @nicknisi/pi-workflows session shape: `workflow` present,
// `workflow_control` absent. A bare-name probe returns true here.
assert.equal(hasLoadedWorkflowEngine(makePi([{ name: "workflow" }])), false);
// And the quintinshaw shape, which registers BOTH.
assert.equal(
  hasLoadedWorkflowEngine(makePi([{ name: "workflow" }, { name: "workflow_control" }])),
  true,
);
```

The second assertion matters as much as the first: it proves the probe is not merely
*rejecting* `workflow` (which a probe for a nonexistent name would also do), but selecting
on the discriminator while the decoy is present. `tests/platform/pi-api.test.ts` already
has the `makePi(tools: ToolStub[])` factory and the `makeThrowingPi()` degrade helper
[VERIFIED: tests/platform/pi-api.test.ts:27-37], so the fixture cost is zero.

## The Four Artifacts of a Soft Dependency

CONTEXT states the invariant: *a probe, a `DEPENDENCIES` member, a marker, and a reason
token — four things, and a partial set is a latent bug.*

An important clarification the plan must not miss: **for the two existing dependencies, the
marker and the reason token are the SAME string.** They are not two artifacts to invent.

[VERIFIED: extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts:29-39]

```ts
export const DEPENDENCIES = ["agents", "mcp"] as const;

/**
 * Closed set of dependency probe targets (SNM-06). Derived from
 * `DEPENDENCIES` via indexed access.
 */
export type Dependency = (typeof DEPENDENCIES)[number];

/** Soft-dep marker literals -- both are REASONS members (closed set). */
const SOFT_DEP_MARKER_AGENTS: Reason = "requires pi-subagents";
const SOFT_DEP_MARKER_MCP: Reason = "requires pi-mcp";
```

The comment says it outright: *both are REASONS members*. So "the member with its marker"
means: `"workflows"` in the tuple, plus a `const SOFT_DEP_MARKER_WORKFLOWS: Reason = "<token>"`
whose value is the new `REASONS` entry. One token, two roles.

### Token spelling — a naming hazard worth escalating

The token spelling is Claude's discretion, but one obvious candidate is actively wrong:

| Candidate | Verdict |
|-----------|---------|
| `requires pi-workflows` | **REJECT.** `pi-workflows` is the npm name of `@nicknisi/pi-workflows` — the engine this milestone refused on trust grounds. A degradation message telling the user they need `pi-workflows` points them at the rejected engine. The whole phase exists because these two are confusable. |
| `requires pi-dynamic-workflows` | **RECOMMEND.** Names the actual package unambiguously. Abbreviating the scope is precedented: `requires pi-mcp` abbreviates `pi-mcp-adapter`. |
| `requires workflow engine` | Acceptable fallback. Truthful and unambiguous, but breaks the `requires <package-name>` shape both existing markers use, and gives the user no name to install. |

Recommend `requires pi-dynamic-workflows`. It satisfies the catalog's "1-3 words lowercase,
hyphenated where natural" convention [CITED: docs/output-catalog.md:63] and preserves the
`requires <installable-thing>` grammar.

### Where the token's topic-group home is — DIFFERENT from Phase 104

Phase 104's `stale workflow command` went into `CommandPrivateReason`. This token does not.
Both existing soft-dep markers live in the shared `UNSUPPORTED_REASONS` group
[VERIFIED: extensions/pi-claude-marketplace/shared/notify-reasons.ts:93-103]:

```ts
export const UNSUPPORTED_REASONS = [
  "unsupported hooks",
  "lsp",
  "requires pi-subagents",
  "requires pi-mcp",
  "unsupported source",
  // D-90-05: the truthful marker for a dropped non-carve-out component kind.
  "unsupported component",
  "no longer installable",
] as const;
```

The new token belongs here, beside its two siblings. `UNSUPPORTED_REASONS` order is not
byte-critical (only `REASONS` order is) and no test enumerates this group, so placement
within it is free — put it immediately after `"requires pi-mcp"` for readability.

## Token Artifact Trail (re-derived post-Phase-104)

Phase 104's summary lists four artifacts for a token addition. Re-derived against the tree as
it stands today, the list is **six**, and one of them is new since 104 wrote its note.

| # | Artifact | Current state | Change |
|---|----------|---------------|--------|
| 1 | `REASONS` tuple tail | `notify.ts:91-189`, ends `"stale workflow command",` at line 188 | append after it; existing entries never move |
| 2 | The tuple's count sentences | `notify.ts:80-89` says "39-entry"; `notify-reasons.ts:7-22` says "39-entry" twice plus a bump narration ("D-90-05 ... 37 to 38 ... WLIF-06 moved it from 38 to 39") | bump to 40 and extend the narration |
| 3 | Topic-group home | `UNSUPPORTED_REASONS` (see above) | append the literal; `_ReasonsCoverageProof` (notify-reasons.ts:235-238) is the compile gate |
| 4 | COMPAT-01 order array | `tests/architecture/compat-01-no-expansion.test.ts` hand-written member list (`"requires pi-subagents"` at line 141) | append the new member at the tail |
| 5 | Length pin | `tests/architecture/notify-closed-set-locks.test.ts:29,39` — `test("OUT-08: REASONS is the closed 39-entry reason set", ...)` and `assert.equal(REASONS.length, 39);` | bump title AND assertion to 40 |
| 6 | Catalog byte gate | `docs/output-catalog.md` state + `tests/architecture/catalog-uat.test.ts` fixture, both required | add paired state/fixture (see §Catalog Amendment) |

**What Phase 104 changed that helps:** `tests/shared/notify-v2.test.ts`'s malformed-token
order assertion was re-anchored on `indexOf("malformed mcp")` instead of `REASONS.slice(-3)`,
specifically so a further tail append does not trip it [VERIFIED: 104-06-SUMMARY.md:196-202,
"Phase 105's own tail append will not trip it"]. Verify this holds but do not expect to touch
it.

**A stale count Phase 104 missed — worth fixing here.**
`docs/output-catalog.md:63` still reads:

> The closed-set membership is defined by the 38-member
> `extensions/pi-claude-marketplace/shared/notify.ts::REASONS` tuple.

It was already wrong before this phase (the tuple has been 39 since Phase 104). This is
prose, not a fenced block, so it is outside the byte gate and no test caught it. Correcting
it to 40 in the same sweep is cheap and in-scope for WDOC-02 ("the catalog carries the new
token"). Flag it so the planner does not treat it as an unexpected diff.

## Marker Plumbing: the full blast radius

This is the section the planner most needs. `grep -rn "declaresAgents\|declaresMcp" extensions`
returns **96 hits**; `composeReasons(` has **31 call sites in `extensions/`**.

### Tier 1 — the shared vocabulary (3 files, forced by required fields)

| File | Change |
|------|--------|
| `platform/pi-api.ts` | `SoftDepStatus` gains `workflowEngineLoaded`; new `hasLoadedWorkflowEngine`; `softDepStatus` composes three |
| `shared/concerns/soft-dep.ts` | `DEPENDENCIES` -> 3 members; `SOFT_DEP_MARKER_WORKFLOWS`; `softDepMarkers` gains a third declares-flag and a third `if` block, appended LAST |
| `shared/notify-reasons.ts` | token into `UNSUPPORTED_REASONS`; `companionSeverity`'s object param gains `declaresWorkflows`; count sentences |

`companionSeverity` today [VERIFIED: shared/notify-reasons.ts:79-86]:

```ts
export function companionSeverity(
  { declaresAgents, declaresMcp }: { declaresAgents: boolean; declaresMcp: boolean },
  probe: SoftDepStatus,
): "info" | "warning" {
  return (declaresAgents && !probe.piSubagentsLoaded) || (declaresMcp && !probe.piMcpAdapterLoaded)
    ? "warning"
    : "info";
}
```

Adding a third disjunct pushes this toward `sonarjs/cognitive-complexity` territory only
mildly, but the three-way `||` chain over a destructured triple is a readability cliff. A
`DEPENDENCIES`-driven loop over a `Record<Dependency, keyof SoftDepStatus>` map is the
cleaner form and makes a fourth dependency free — consider it, but only if it does not
disturb `softDepMarkers`'s emit order.

### Tier 2 — the renderer (1 file, 31 call sites)

`shared/notify.ts::composeReasons` [VERIFIED: shared/notify.ts:2077-2091]:

```ts
export function composeReasons(
  reasons: readonly Reason[] | undefined,
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): string {
  const composed: Reason[] = reasons === undefined ? [] : [...reasons];
  composed.push(...softDepMarkers(declaresAgents, declaresMcp, probe));

  if (composed.length === 0) {
    return "";
  }

  return `{${composed.join(", ")}}`;
}
```

Of the 31 call sites, **28 pass `false, false`** and become `false, false, false`. Purely
mechanical. The three that matter route through two composers that already read
`p.dependencies`, so their CALLERS need no change at all:

- `installedLikeRow` (notify.ts:2244-2270) — reads `p.dependencies.includes("agents")` /
  `.includes("mcp")`; add `.includes("workflows")`. Serves the `installed` / `updated` /
  `reinstalled` rows across 6 command render maps.
- `partiallyInstalledRow` (notify.ts:2187-2211) — same, with the `?? false` optional-field
  form.
- The central `renderPluginRow` switch arms `installed` (notify.ts:2287-2300), `updated`
  (2305-2318) and `reinstalled` (~2320) inline the same `.includes(...)` pair.

This is the single best piece of news in the phase: because the two shared composers own the
`dependencies` -> flags translation, the marker reaches six command surfaces through three
edits.

Also update the `pluginRow` helper's doc comment (notify.ts:2146-2148, "Both declares-flags
are `false`") and the `renderPluginRow` header block (notify.ts:2110-2117) which enumerates
which arms declare `dependencies`.

### Tier 3 — the orchestrators (which surfaces stamp)

**Copy the `agents` set exactly.** Derived by tracing `declaresAgents` through the tree:

| Surface | Stamps `{requires pi-subagents}` today? | Therefore stamps the workflows marker? | Site |
|---------|---|---|---|
| `install` (standalone) | YES + severity raise via `companionSeverity` | YES + raise | `install.ts:1899-1906`, `1967-1974` |
| `install` (outcome for cascades) | YES (`declaresAgents` on `InstallPluginOutcome`) | YES | `install.ts:2017-2018` |
| `update` | YES + severity raise | YES + raise | `update.ts:2320-2321`, `2504-2513`; row at `update-row.ts:112,171-175` |
| `reinstall` | YES marker, **NO** severity raise | YES marker, NO raise | `reinstall.ts:1074-1082`, `1940-1943`, severity at `:956` |
| `enable` (standalone) | YES + severity raise | YES + raise | `enable-disable.ts:323-324`, `953-954`, `1075-1078`; `shared.ts::enableRowDependencies` |
| `list` (inventory row) | YES, derived from `record.resources` | YES, from `record.resources.workflows` | `list.ts:300-310`, `450-451`, `573` |
| `import` cascade | YES | YES | `import/execute.ts:78-79`, `318-325`, `727-728` |
| `reconcile` projections | YES marker, `info` severity (both arms) | YES marker, no raise | `reconcile/apply.ts:319-332`, `apply-outcomes.ts:95,134`, `reconcile/notify.ts:512,614,625` |
| `uninstall` | **NO** — structural (MSG-SD-3) | **NO** | `uninstall.messaging.ts:64` hard-codes `false, false` |
| `disable` | **NO** — structural (ENBL-15 / D-100-06) | **NO** | `enable-disable.messaging.ts:113`; `list.ts:444-451` derives BELOW the disabled early return |
| `marketplace update` child rows | NO (`declaresAgents: false` hard-coded) | NO | `marketplace/update.ts:574-575` |
| `fetch` / `info` / pending rows | NO (no `dependencies` field) | NO | — |
| `plugin info` | separate `dependencies: readonly string[]` — the **plugin manifest's** `dependencies`, an unrelated concept | NO | `info.ts:1611,1690,1862,...` |

**Trap:** `orchestrators/plugin/info.ts` uses the identifier `dependencies` for something
completely different — the Claude plugin manifest's own `dependencies` declaration (the
PDEP-01 backlog item). A grep-driven sweep will hit it. It is NOT part of this change.

**Where the "did this stage workflows" fact comes from.** The install ledger already tracks
it: `installCtx.stagedWorkflowNames` [VERIFIED: install.ts:1317 `workflows: [...c.stagedWorkflowNames],`
and install.ts:1880-1882 where it joins the `stagedAny` reduce]. The persisted record already
carries it: `resources.workflows` is a REQUIRED `string[]` in the state schema
[VERIFIED: persistence/state-io.ts:132 `workflows: Type.Array(Type.String()),`], which is what
`list`'s inventory row reads. Nothing new needs to be recorded — the fact is already on both
the ledger context and the record.

`LedgerDegradationSignals` in `orchestrators/plugin/shared.ts:53-91` will need a
`stagedWorkflows?: boolean` sibling to `stagedAgents` / `stagedMcpServers` for the enable
path, and `enableRowDependencies`'s `Pick<...>` (shared.ts:109) must widen to include it.
Beware the `partition?: never` refusal on that signature (shared.ts:110-111, WR-01) — it
exists to exclude update/reinstall outcome shapes and must survive the widening.

## Proving WDEP-03 (criterion 3)

The phase description asks whether this is "an assertion about the artifacts being
probe-independent, a live-UAT step, or both." **Both — and the structural half is the
stronger one.**

### The mechanism, verified against engine 3.5.1

The engine registers saved workflows in a `session_start` handler
[VERIFIED: `package/extensions/workflow.ts:252` — `pi.on("session_start", (_event: unknown, ctx: ExtensionContext) => {`,
with the registration call at `:289`]:

```ts
    // First registration (and post-rebuild catch-up for target-only names).
    // Handlers load by name from the live storage, so a later same-session
    // overwrite picks up the new script; Pi still cannot drop source-only
    // names left over from a prior generation — those handlers notify.
    registerAllSavedWorkflows(pi, getCwd, getStorage, getManager);
```

`registerAllSavedWorkflows` iterates storage, nothing else
[VERIFIED: `package/src/saved-commands.ts:132-149`]:

```ts
export function registerAllSavedWorkflows(
  pi: ExtensionAPI,
  cwd: string | (() => string),
  storage: WorkflowStorage | (() => WorkflowStorage),
  manager?: WorkflowManager | (() => WorkflowManager | undefined),
): void {
  const getStorage = typeof storage === "function" ? storage : () => storage;
  const getCwd = typeof cwd === "function" ? cwd : () => cwd;
  for (const wf of getStorage().list()) {
```

And `list()` is a plain directory walk over three directories with first-wins dedup
[VERIFIED: `package/src/workflow-saved.ts:129-153`]:

```ts
    list(): SavedWorkflow[] {
      const workflows: SavedWorkflow[] = [];

      const seen = new Set<string>();
      const addDir = (dir: string, location: "project" | "user") => {
```
```ts
      // Priority order mirrors load(): project > legacy project > user.
      addDir(projectDir, "project");
      addDir(legacyProjectDir, "project");
      addDir(userDir, "user");
```

**No index. No install-time registration hook. No engine API call.** An envelope already
sitting in `~/.pi/workflows/saved/` is picked up on the next session start regardless of
when, or by whom, it was written. That is WBRG-04 restated from the other direction, and it
is exactly why write-anyway is correct.

### Recommended three-layer proof

1. **Structural (unit, cheap, the real proof).** Assert that the install path's written
   artifact does not vary with the probe: run the same install twice against mock `pi`
   objects differing ONLY in whether `workflow_control` is present, and assert the two
   produce byte-identical envelope files and identical `record.resources.workflows`. This
   makes "probe-independent" a machine-checked property rather than a claim. It is the
   assertion that would actually fail if someone later added a `if (!engineLoaded) skip`
   short-circuit to the ledger.

2. **Architectural gate (source scan, very cheap).** The repo already has the idiom:
   `tests/architecture/no-orchestrator-network.test.ts` greps orchestrator sources for
   forbidden tokens via `tests/helpers/source-scan.ts`. A sibling clause asserting that no
   file under `bridges/workflows/` references `softDepStatus` / `workflowEngineLoaded` /
   `hasLoadedWorkflowEngine` encodes "the bridge never asks whether the engine is loaded" as
   a boundary, not a convention. Recommended — it is the cheapest possible guard against the
   regression that would break WDEP-03.

3. **Live canary (extend, do not duplicate).** `tests/live-uat/workflow-storage-canary.mjs`
   already installs through the real extension and reads back through a real engine 3.5.1
   `createWorkflowStorage`, in both scopes, with a working `PI_WORKFLOW_ENGINE_ROOT` route
   [VERIFIED: tests/live-uat/workflow-storage-canary.mjs:160-174, 219]. The natural extension
   is a fourth assertion: perform the install with a mock `pi` exposing NO `workflow_control`,
   observe the row carries the degradation marker, then instantiate the real engine storage
   and assert `list()` still reports the workflow. That is a literal reproduction of
   "installed without the engine, then the engine finds it" — the closest thing to the user's
   `/reload` without driving a Pi session.

Layer 3 requires the operator to have the engine resolvable (`PI_WORKFLOW_ENGINE_ROOT` or a
global install). It is NOT in `npm run check` by design. Plan it as a HUMAN-UAT / verification
step, not a wave gate. Layers 1 and 2 must be in `npm run check`.

## Catalog Amendment (WDOC-02)

### How the gate works

`tests/architecture/catalog-uat.test.ts` reads `docs/output-catalog.md` at test time,
extracts every fenced block preceded by `<!-- catalog-state: STATE -->` inside a per-command
`## \`/claude:plugin <verb>\`` H2, pairs each `(section, STATE)` with a `CatalogFixture`, and
asserts byte equality against what `notify(mockCtx, mockPi, message)` emits. The walk is
bidirectional — a catalog state with no fixture is flagged as an orphan, and vice versa
[VERIFIED: tests/architecture/catalog-uat.test.ts:1-34, 62-155].

### The probe fixtures are about to become misnamed

```ts
/** Probe reports both pi-subagents and pi-mcp-adapter loaded -- no soft-dep markers fire. */
function piWithBothLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "mcp" }],
  };
}
```
[VERIFIED: tests/architecture/catalog-uat.test.ts:177-182]

Once the third probe exists, `piWithBothLoaded()` reports the workflow engine **absent** —
the name becomes a lie and the "no soft-dep markers fire" claim becomes conditional on no
fixture declaring `workflows`. Two things follow:

1. **No existing catalog state changes bytes**, because no existing fixture's message carries
   `dependencies: ["workflows"]` (that member does not exist yet). This is the reassuring
   half — verify it by running the suite, do not assume it.
2. **Rename the helpers and add a third.** Suggested: `piWithAllLoaded()` (three tools),
   keep `piWithMcpLoaded()` / `piWithNothingLoaded()`, add a `piWithoutWorkflowEngine()`
   returning `[{ name: "subagent" }, { name: "mcp" }]` — i.e. exactly today's
   `piWithBothLoaded` body, under a name that states what it means. Every existing fixture
   keeps its current probe behaviour by pointing at the renamed helper.

The same `MockPi` / `piWithBothLoaded` pair exists independently in
`tests/shared/notify-v2.test.ts:159-175`. Both files need the same treatment.

### Which states to add

The catalog is additive-amendable. Phase 104's note is explicit: *"The catalog's uninstall
section is additively amendable. This plan added one state as a sibling and removed nothing;
a second additive amendment lands cleanly."* [VERIFIED: 104-06-SUMMARY.md:266]

Minimum for WDOC-02: **one state under `## \`/claude:plugin install <plugin>@<marketplace>\``**,
a sibling of `success-with-soft-dep` (docs/output-catalog.md:470-482). Suggested name
`success-with-workflow-engine-absent`. Its block will carry the `needs attention` summary
line, because `warning` makes `notify()` prepend it — verified by the sibling
`success-with-soft-dep` block, which carries `A plugin operation needs attention.` at
docs/output-catalog.md:475.

Strongly consider a **second** state showing the token composing with an existing marker in
one brace (`{requires pi-subagents, requires pi-dynamic-workflows}`), because the ORDER of the
markers inside the brace is the byte-critical fact the `DEPENDENCIES` tuple order determines,
and a single-marker state does not pin it. This is the same reasoning that produced
`success-with-orphan-rewake-and-soft-dep`.

Do **not** add a state per verb. Phase 104's decision is the precedent:

> Only the uninstall section gained a catalog state. The other three stamping verbs are
> covered by the closed-set gates plus per-verb render assertions, which keeps the catalog
> region additively amendable for the next phase rather than rewritten.

Also amend, as prose (outside the byte gate, no fixture needed):

- `docs/output-catalog.md:67` — the soft-dep paragraph names both markers and says
  "the 4 dep-bearing variants"; extend to name the third marker.
- `docs/output-catalog.md:63` — the stale "38-member" count (see §Token Artifact Trail).
- `docs/messaging-style-guide.md:28` (`export type Dependency; // "agents" | "mcp"`), `:61`
  ("the closed set of **2** soft-dependency probe targets"), `:67`, `:84`, `:166`, `:62`, `:9`.
- `docs/open-closed-proof.md:56` — names the soft-dep concern's contents.

## Docs Deliverable (WDOC-01)

### `docs/hooks-compatibility.md` section by section

The template, read in full [VERIFIED: docs/hooks-compatibility.md, 256 lines]:

| Line | Section | What it does | Workflows analogue |
|------|---------|--------------|--------------------|
| 1-7 | Title + framing + legend + source-of-truth paragraph | Declares the legend (`✓` / `✗` / `⚠`), states which upstream doc the "Claude Code" column reflects and which source tree the "Pi" column reflects | Same shape. Upstream = Claude Code's workflows docs; Pi column = `bridges/workflows/` + `domain/` extractor + the host engine at a pinned version |
| 9-38 | `## Events` — the big feature table | Row per upstream feature, three columns + notes | `## Script API surface` — row per Claude workflow global (`agent`, `pipeline`, `parallel`, `meta`, …) |
| 39-43 | `### Turn-boundary timing shift` — a narrative subsection for the ONE irreducible divergence | Explains a divergence too subtle for a table cell, and justifies why it is still marked `✓` | `### Admit-versus-run divergence` — the mandated table plus its "bounded and visible" framing |
| 45-72 | `### Event status classification` — three named buckets with forward paths | "Deferred for engineering reasons" / "Blocked on upstream Pi support" / "Permanently inapplicable" | Reuse verbatim as a bucket scheme for what the bridge does not replicate |
| 74-91, 108-131, 133-141, 143-154, 156-181, 182-201, 203-213, 215-223 | Six more per-facet tables | Each a narrow slice with its own table | Fold to: naming, storage/paths, sandbox, determinism |
| 225-251 | `## Install-time disposition` — the four responses (partial-partition drop / structural unavailable / silent fall-open / silent drop) | The single most valuable section: what happens to a plugin declaring something unsupported | Direct analogue: per-script skip (WNAM-03), whole-script refusal (WNAM-04), collision hard error (WNAM-05), pre-validation skip (WVAL-02), degradation marker (WDEP-02) |
| 253-256 | `## Further reading` | Two links: upstream reference, host runtime docs | Same |

The document is table-dominant, uses `--` for em-dash breaks, has no emoji, and never cites a
GSD artifact. Match that register. `mdformat` (not prettier) is the formatter for markdown
here — `npm run format:check` covers only `js,json,ts`.

### Recommended structure for `docs/workflows-compatibility.md`

```markdown
# Workflow compatibility

<framing paragraph: what a Claude workflow is, what installing one under Pi means>
<THE executable-code paragraph -- see below>

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes).

<source-of-truth paragraph: upstream column = Claude Code workflows reference;
 Pi column = bridges/workflows/ + the host engine at 3.5.1>

## The host engine and why it was chosen
   <trust grounds + THE SANDBOX TABLE>
   <upstream stability warning>

## Naming
   <meta.name, acorn, the four outcomes, the stem fallback, collisions>

## Storage and discovery
   <both scope paths, the project key, discovery precedence, the legacy path we refuse>

## Script semantics: guaranteed versus divergent
   <what a verbatim copy does and does not preserve>
   <agent() failure: Claude -> null + pipeline().filter(Boolean); host -> see below>

## Admit-versus-run divergence
   <THE MANDATORY TABLE -- 7 gates, we replicate 1>
   <the "bounded and visible" paragraph>

## Determinism
   <DETERMINISM_BLOCKLIST verbatim, the comment false-positive, why we pre-validate>

## Install-time disposition
   <the five responses, mirroring hooks' four>

## Registration and reload
   <edit takes effect without reload; new workflow needs /reload; uninstall asymmetry>

## Further reading
```

### The executable-code paragraph — the thing WDOC-01 exists for

This must be near the top, unhedged. Facts it must carry, all sourced:

- Every other bridge installs **data** that Pi interprets: a skill is markdown, a command is
  a prompt template, an agent is a frontmatter document, an MCP entry is a JSON server
  declaration, a hook is a command line the host spawns under its own rules. A workflow is
  **JavaScript that a third party wrote and that an engine will execute**.
- The engine is `@quintinshaw/pi-dynamic-workflows`, chosen on trust grounds: it runs scripts
  in a `vm.createContext` realm.
- The rejected alternative and why: `@nicknisi/pi-workflows` uses `runInThisContext()` and
  hands the script the real `process`, all environment variables, and `process.binding('fs')`.
- The consequence for a plugin author: shipping `workflows/` means shipping code that runs on
  a user's machine inside that sandbox. The sandbox comparison is the information they need.

### The sandbox table (measured, one identical fixture)

Carry verbatim from the spike findings [CITED: .claude/skills/spike-findings-pi-claude-marketplace/references/workflows-bridge.md:192-200]:

| Probe | quintinshaw | nicknisi |
| --- | --- | --- |
| `process` own keys | `cwd` (frozen stub) | real host `process` |
| `process.env` | `undefined` | object, 60 vars |
| `process.binding('fs')` | TypeError | real fs internals |
| Function-constructor escape | no escape | host realm |
| clock/RNG | rejected pre-parse | live values |

### The admit-versus-run divergence table — all seven gates verified

`parseWorkflowScript` runs seven gates in order before a workflow can execute
[VERIFIED: `package/src/workflow.ts:1343-1402` of the 3.5.1 tarball]. Our pre-validation
replicates only gate 1.

| # | Gate | Engine's refusal | We replicate? |
|---|------|------------------|---------------|
| 1 | `DETERMINISM_BLOCKLIST.test(script)` | `"Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable"` | **YES** (WVAL-01) |
| 2 | first statement must be `ExportNamedDeclaration` | ``"`export const meta = { name, description, phases }` must be the first statement in the script"`` | no |
| 3 | declaration is `VariableDeclaration` with `kind === "const"` | ``"meta export must be `export const meta = ...`"`` | no |
| 4 | `declaration.declarations.length !== 1` | `"meta export must declare only \`meta\`"` | no |
| 5 | declarator id is an `Identifier` named `meta` | `` "meta export must declare `meta`" `` | no |
| 6 | `declarator.init` present | `"meta must have a literal value"` | no |
| 7 | `evaluateLiteral` + `validateMeta` | e.g. `"meta.description must be a non-empty string"` | no |

The blocklist regex, verbatim [VERIFIED: `package/src/workflow.ts:370`]:

```ts
const DETERMINISM_BLOCKLIST = /\bDate\s*\.\s*now\b|\bMath\s*\.\s*random\b|\bnew\s+Date\s*\(\s*\)/;
```

`validateMeta`'s two name/description clauses, verbatim [VERIFIED: `package/src/workflow.ts:1450-1455`]:

```ts
function validateMeta(meta: unknown): asserts meta is WorkflowMeta {
  if (!meta || typeof meta !== "object") throw new Error("meta must be an object");
  const value = meta as WorkflowMeta;
  if (typeof value.name !== "string" || !value.name.trim()) throw new Error("meta.name must be a non-empty string");
  if (typeof value.description !== "string" || !value.description.trim())
    throw new Error("meta.description must be a non-empty string");
```

This maps the CONTEXT's six admitted-but-refused shapes onto gates:

| Shape we admit | Refused by | Note |
|---|---|---|
| `meta` missing a non-empty `description` | gate 7 (`validateMeta`) | our envelope omits `description` rather than synthesizing (Phase 103 decision) |
| `meta` not the first statement | gate 2 | |
| `export let meta` | gate 3 | |
| a non-exported `const meta` | gate 2 (the statement is not an `ExportNamedDeclaration`) | |
| `export const meta = {...}, other = 1` | gate 4 | |
| both WNAM-02 stem-fallback arms (no `name` property; non-literal `name`) | gate 7 (no `name`) / gate 7 via `evaluateLiteral`'s `non-literal node type` (non-literal `name`) | our fallback names the command from the stem; the engine never gets that far |

**Template-literal `name` is the subtle one, and it is subtler than "admitted under a
different name".** `evaluateLiteral` DOES accept a `TemplateLiteral` with no interpolations and
returns its cooked text [VERIFIED: `package/src/workflow.ts:585-588`]:

```ts
    case "TemplateLiteral":
      if (node.expressions.length > 0) throw new Error(`template interpolation not allowed in ${path}`);
      return node.quasis.map((quasi: AnyNode) => quasi.value.cooked ?? quasi.value.raw).join("");
```

So for `` name: `deploy` ``: the engine resolves `deploy`; our WNAM-01 extractor requires a
string **Literal** and falls back to the file stem. The command installs under the stem-derived
name while the engine's own `meta.name` says something else. For a template literal WITH
interpolation, gate 7 refuses. Both arms belong in the table, stated separately.

**The framing sentence the CONTEXT mandates:** the failure is bounded and visible — the
artifact installs, the command registers, and the engine reports `/<name> failed: <message>`
at invocation. It is a documented divergence, not a guarantee.

### `agent()` failure semantics — a finding that needs an operator decision

CONTEXT locks the wording: *"Write 'not measured', not a hedge that reads as a measurement."*
The locked claim is that quintinshaw's failure path was not measured because driving its
`agent()` needs real spawn machinery.

That remains true of *runtime measurement*. But a source read is now available and it is
unambiguous: quintinshaw's `agent()` returns a promise that **rejects**; it does not resolve
to `null`. Every failure branch in `agentImpl` throws — the agent-limit branch throws
`agentLimitError()`, the budget branch throws a `WorkflowError` with
`WorkflowErrorCode.TOKEN_BUDGET_EXHAUSTED`, and `throwIfAborted()` throws
`WorkflowError("workflow aborted", ...)` [VERIFIED: `package/src/workflow.ts:516-548, 560-570`].
The wrapper explicitly attaches a no-op catch only so an un-awaited rejection does not crash
the process:

```ts
    call.catch(() => {}).finally(() => shared.inFlight.delete(call));
```

So both candidate host engines diverge from Claude's `null`-on-failure contract, in the same
direction. That STRENGTHENS the docs' warning rather than weakening it.

**Recommended treatment, flagged for the operator:** keep the honesty the decision demands by
separating the two evidence grades explicitly — "measured at runtime on `@nicknisi` (throws);
read from the engine source on quintinshaw (rejects); NOT driven at runtime on quintinshaw,
because driving its `agent()` needs real spawn machinery." That is neither a hedge nor a
claimed measurement. Because it adds a claim the CONTEXT did not authorize, the planner should
surface it as a checkpoint rather than silently writing it.

### Upstream stability warning — mandatory, not a footnote

CONTEXT is explicit. Facts to carry [CITED: references/workflows-bridge.md:228-233], with the
version re-verified this session:

- The envelope shape, the cwd-key derivation, the saved-directory layout and the name
  validator are private internals of a 0.x-era package with no exported contract.
- 50 releases since May 2026; current 3.5.1, published 2026-08-05
  [VERIFIED: `npm view @quintinshaw/pi-dynamic-workflows version time.modified`].
- No env-var override and no settings knob to relocate storage (`WorkflowSettings` carries
  only behavioral keys).
- Pi core has no first-party workflow API at 0.84.2.

### Discoverability: what else to touch

There is **no doc gate and no test that enumerates `docs/*.md`**. `tests/docs/` appears in the
`npm test` glob but the directory does not exist [VERIFIED: `ls tests` shows no `docs` entry;
package.json's test glob includes `docs`]. So a new doc file is invisible unless something
links it.

Exactly one place links `docs/hooks-compatibility.md` from user-facing text, and it has a
translated twin:

- `README.md:28` — `- Hooks. Partial support. For more information, see [Hook compatibility](docs/hooks-compatibility.md).`
- `README.es.md:28` — `- Hooks (ganchos). Soporte parcial. Para más información, consulta [Compatibilidad de hooks](docs/hooks-compatibility.md).`

Both READMEs carry a **Features** bullet list naming the five supported component kinds
(Commands / Skills / Agents / Hooks / MCP servers), and both carry a **Prerequisites** list
naming the two optional companions. `workflows` is now a sixth supported kind with a third
optional companion and is absent from both lists in both languages.

Recommend, and plan explicitly:

1. A **Workflows** bullet in both Features lists, linking the new doc, in the
   `Agents. Requires [pi-subagents](...)` register.
2. A `@quintinshaw/pi-dynamic-workflows` entry in both Prerequisites lists.
3. The Spanish twin is a real deliverable, not an afterthought — `README.es.md` is
   line-for-line parallel and a one-language change leaves it wrong.

`CLAUDE.md`'s project description also enumerates the translated artifact kinds ("skills,
commands, agents, MCP servers") and omits workflows. Out of scope by CONTEXT (it is not a
`docs/` file and not named in the requirements), but worth flagging as a milestone-close item.

## Common Pitfalls

### Pitfall: the token spelling names the rejected engine

**What goes wrong:** `requires pi-workflows` ships. It is the npm name of
`@nicknisi/pi-workflows`, refused on trust grounds by this milestone's own scope decisions.
**Why it happens:** it is the obvious parallel to `requires pi-subagents` / `requires pi-mcp`,
and the component kind is called `workflows`.
**How to avoid:** spell it `requires pi-dynamic-workflows`. Add the rationale to the
`SOFT_DEP_MARKER_WORKFLOWS` doc comment so a future rename does not undo it.
**Warning signs:** any diff introducing the literal `pi-workflows` (without `dynamic`).

### Pitfall: an optional-defaulted third parameter silently skips the sweep

**What goes wrong:** `declaresWorkflows = false` compiles at all 31 `composeReasons` call
sites, so no site is visited, and only the sites someone remembered get the third axis.
**Why it happens:** 28 of the 31 sites want `false`, so a default feels like pure win.
**How to avoid:** make it required. The three sites that matter are found BY the compile
errors at the 28 that do not.
**Warning signs:** a diff that touches `composeReasons`'s signature but not
`list.messaging.ts`, `fetch.messaging.ts`, `install.messaging.ts`, `uninstall.messaging.ts`,
`enable-disable.messaging.ts`, `reconcile.messaging.ts`, `import/execute.messaging.ts`,
`marketplace/remove.messaging.ts`, `marketplace/update.messaging.ts`.

### Pitfall: `piWithBothLoaded()` becomes a lie and the name hides it

**What goes wrong:** after the third probe lands, every fixture using `piWithBothLoaded()`
runs with the workflow engine ABSENT while its name and doc comment say "no soft-dep markers
fire". The suite stays green (no fixture declares `workflows` yet), so the drift is invisible
until the first workflows fixture is added and mysteriously fires a marker.
**How to avoid:** rename to `piWithAllLoaded()` and give it the third tool in the same commit
that adds the probe. Two files: `tests/architecture/catalog-uat.test.ts:177-182` and
`tests/shared/notify-v2.test.ts:159-175`.
**Warning signs:** a probe change with no diff in either test file.

### Pitfall: a grep-driven sweep edits `orchestrators/plugin/info.ts`

**What goes wrong:** `info.ts` uses `dependencies: readonly string[] | undefined` at six
sites — the Claude plugin manifest's own `dependencies` declaration, an entirely different
concept (backlog PDEP-01). A sweep for "dependencies" edits it.
**How to avoid:** sweep for the `Dependency` TYPE and the `declaresAgents` identifier, never
the bare word.
**Warning signs:** `info.ts` in the changed-file list.

### Pitfall: markers render in the wrong order inside the brace

**What goes wrong:** the brace reads `{requires pi-dynamic-workflows, requires pi-subagents}`
on some rows and the reverse on others, and the catalog gate fails on a state you did not
touch.
**Why it happens:** `softDepMarkers` pushes in source order; the seven `Dependency[]`
derivations push in their own order; if any derivation puts `"workflows"` before `"mcp"`, a
row declaring both renders differently.
**How to avoid:** append `"workflows"` LAST in `DEPENDENCIES` and LAST in every derivation and
LAST in `softDepMarkers`. Add a catalog state that pins a two-marker brace so the order is
byte-gated, not conventional.
**Warning signs:** a `Dependency[]` derivation whose new arm is not the last `push`.

### Pitfall: seven three-arm copies trip `sonarjs/no-identical-functions`

**What goes wrong:** `npm run lint` fails on rules that tolerated the two-arm copies.
`sonarjs/no-identical-functions` and `sonarjs/cognitive-complexity: 15` are both **errors**.
**How to avoid:** budget for an extraction. Phase 104 hit the complexity ceiling twice and
solved it by extracting named helpers (`freshDisableRow`, `raisedSeverity`) — the same move
applies here. Do not reach for a disable directive.
**Warning signs:** the executor adding `// eslint-disable-next-line sonarjs/...`.

### Pitfall: the phase quietly regresses WDEP-03 by short-circuiting the ledger

**What goes wrong:** someone reads "degrade when the engine is absent" as "skip staging when
the engine is absent". The install then succeeds with a marker and writes nothing, and
`/reload` after installing the engine finds nothing to register.
**Why it happens:** "degrade" is ambiguous; every other degradation in this codebase drops
something.
**How to avoid:** the structural probe-independence test in §Proving WDEP-03, layer 1, plus
the layer-2 boundary gate. Both fail loudly on this exact regression.
**Warning signs:** any conditional on the probe result inside `bridges/workflows/` or inside
the install ledger's workflows phase.

### Pitfall: the catalog prose count is already stale and looks like this phase's bug

**What goes wrong:** `docs/output-catalog.md:63` says "38-member REASONS tuple" while the
tuple has 39 members. A reviewer sees the number wrong in this phase's diff neighbourhood and
attributes it here.
**How to avoid:** fix it to 40 in the same sweep and say so in the plan's action sentence.

## Code Examples

### The three widened shared functions

```ts
// shared/concerns/soft-dep.ts
export const DEPENDENCIES = ["agents", "mcp", "workflows"] as const;

/**
 * WDEP-04: the host workflow engine `@quintinshaw/pi-dynamic-workflows`.
 * Deliberately NOT spelled `pi-workflows` -- that is the npm name of
 * `@nicknisi/pi-workflows`, the engine this bridge does not target, so the
 * short form would point the operator at the wrong package to install.
 */
const SOFT_DEP_MARKER_WORKFLOWS: Reason = "requires pi-dynamic-workflows";

export function softDepMarkers(
  declaresAgents: boolean,
  declaresMcp: boolean,
  declaresWorkflows: boolean,
  probe: SoftDepStatus,
): readonly Reason[] {
  const markers: Reason[] = [];

  if (declaresAgents && !probe.piSubagentsLoaded) {
    markers.push(SOFT_DEP_MARKER_AGENTS);
  }

  if (declaresMcp && !probe.piMcpAdapterLoaded) {
    markers.push(SOFT_DEP_MARKER_MCP);
  }

  // Appended LAST, matching the DEPENDENCIES tuple tail -- the brace join is
  // byte-critical and this order is what the catalog pins.
  if (declaresWorkflows && !probe.workflowEngineLoaded) {
    markers.push(SOFT_DEP_MARKER_WORKFLOWS);
  }

  return markers;
}
```

The token literal above is a RECOMMENDATION, not a verified value — see the Assumptions Log.

### The install-row derivation (the WDEP-02 site)

```ts
// orchestrators/plugin/install.ts, inside the !orchestrated success arm
const dependencies: Dependency[] = [];
if (installCtx.stagedAgentNames.length > 0) {
  dependencies.push("agents");
}

if (installCtx.stagedMcpServerNames.length > 0) {
  dependencies.push("mcp");
}

// WDEP-02: a staged workflow declares the host engine. The envelope is written
// whether or not the engine is loaded -- the marker reports that nothing runs
// it yet, and the engine's own load-time storage scan picks it up on the next
// reload with no reinstall (WDEP-03).
if (installCtx.stagedWorkflowNames.length > 0) {
  dependencies.push("workflows");
}
```

`installCtx.stagedWorkflowNames` already exists [VERIFIED: install.ts:1317, 1882].

### The structural probe-independence assertion (WDEP-03 layer 1)

```ts
// Sketch. WDEP-03: the artifact must not vary with the probe -- that is what
// makes the write-anyway degradation converge on /reload rather than merely
// fail quietly.
test("WDEP-03: the installed envelope is byte-identical with and without the engine", async () => {
  const withEngine = await installOnce(makePi([{ name: "workflow_control" }]));
  const withoutEngine = await installOnce(makePi([]));

  assert.deepEqual(withoutEngine.record.resources.workflows, withEngine.record.resources.workflows);
  assert.equal(withoutEngine.envelopeBytes, withEngine.envelopeBytes);
  // Non-vacuity: the run WITHOUT the engine must have carried the marker, or
  // the two runs agreeing proves only that neither degraded.
  assert.match(withoutEngine.message, /\{[^}]*requires pi-dynamic-workflows[^}]*\}/);
  assert.doesNotMatch(withEngine.message, /requires pi-dynamic-workflows/);
});
```

The non-vacuity clause follows the pattern Phase 104 established: *"The negative half of each
verb's pair asserts the WHOLE rendered block, not the token's absence."*

## Runtime State Inventory

This is not a rename or migration phase, but the closed sets it grows have on-disk and
byte-gated mirrors, so the categories are answered explicitly rather than skipped.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None.** `state.json` already carries `resources.workflows` as a REQUIRED `string[]` [VERIFIED: persistence/state-io.ts:132]; no schema change, no version bump, no migration. The reason token and the probe are render-time only and are never persisted. | none |
| Live service config | **None.** No external service holds any of these strings. | none |
| OS-registered state | **None** from this phase. The host engine registers commands at its own `session_start`; this repo registers nothing new. (Phase 104's `stale workflow command` already covers the lingering-command asymmetry.) | none |
| Secrets / env vars | **None.** `PI_WORKFLOW_ENGINE_ROOT` is read only by the live-UAT canary and is unchanged. | none |
| Build artifacts | **None.** No build step (`tsc --noEmit`), no dependency manifest change, no `EXTENSION_VERSION` change (version bump is milestone-close work, explicitly deferred). | none |
| Byte-gated documents | `docs/output-catalog.md` (byte-equality gate), plus prose counts in `messaging-style-guide.md` / `open-closed-proof.md` that no test covers | additive amendment + prose sweep |

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json` [VERIFIED: .planning/config.json].

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node >= 20.19.0 builtin), no external runner |
| Config file | none — driven by `package.json` scripts |
| Quick run command | `node --test "tests/platform/pi-api.test.ts"` (single suite) |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

Unit glob: `tests/{architecture,bridges,docs,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`
[VERIFIED: package.json `test` script]. Note `tests/docs` is in the glob but does not exist —
a new `tests/docs/*.test.ts` would be picked up automatically if the phase wants one.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WDEP-01 | `workflow_control` present -> loaded | unit | `node --test tests/platform/pi-api.test.ts` | ✅ extend |
| WDEP-01 | bare `workflow` only -> NOT loaded (the discriminating case) | unit | same | ✅ extend |
| WDEP-01 | both tools present -> loaded (decoy does not defeat the discriminator) | unit | same | ✅ extend |
| WDEP-01 | throwing `getAllTools()` -> degrades to false | unit | same (`makeThrowingPi` exists) | ✅ extend |
| WDEP-01 | `softDepStatus` composes three flags | unit | same | ✅ extend |
| WDEP-02 | install with engine absent still writes envelopes and succeeds | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ extend |
| WDEP-02 | the row carries the marker at `warning` severity, asserted on the Pi API arg | unit | same | ✅ extend |
| WDEP-02 | engine loaded -> row renders byte-identically to today (negative half asserts the WHOLE block) | unit | same | ✅ extend |
| WDEP-03 | envelope + record byte-identical across the two probe states, with non-vacuity | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ❌ Wave 0 |
| WDEP-03 | `bridges/workflows/**` references no probe symbol (boundary gate) | architecture | `node --test tests/architecture/*.test.ts` | ❌ Wave 0 (new clause; `tests/helpers/source-scan.ts` exists) |
| WDEP-03 | real engine `list()` finds an envelope installed with the engine absent | live-UAT | `PI_WORKFLOW_ENGINE_ROOT=... node tests/live-uat/workflow-storage-canary.mjs` | ✅ extend (out of `npm run check` by design) |
| WDEP-04 | `DEPENDENCIES` is exactly `["agents","mcp","workflows"]`, in order | unit | `node --test tests/shared/notify-v2.test.ts` (or a new closed-set clause) | ❌ Wave 0 — **no test currently pins `DEPENDENCIES` at all** |
| WDEP-04 | `REASONS.length === 40` and the tail is the new token | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts` | ✅ bump |
| WDEP-04 | COMPAT-01 enumeration equality with the new member | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ bump |
| WDEP-04 | the token has a topic-group home | typecheck | `npm run typecheck` (`_ReasonsCoverageProof` TS2344) | ✅ structural |
| WDOC-02 | catalog state ↔ fixture byte equality, both directions | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ extend |
| WDOC-02 | two-marker brace order pinned | architecture | same (second catalog state) | ❌ Wave 0 |
| WDOC-01 | doc exists and is linked from both READMEs | manual-only | reviewer read | — |

### Sampling Rate

- **Per task commit:** the single suite the task touched (`node --test tests/<dir>/<file>.test.ts`)
- **Per wave merge:** `npm run typecheck && npm run lint && npm test`
- **Phase gate:** `npm run check` green, plus the live canary run recorded as HUMAN-UAT

### Wave 0 Gaps

- [ ] A `DEPENDENCIES` order-and-length lock. The CONTEXT asserts closed sets are "pinned by
      order-and-length lock tests", but `grep -rn "DEPENDENCIES" tests` returns exactly one
      hit and it is an unrelated comment in `no-telemetry-deps.test.ts`. **`DEPENDENCIES` is
      currently unpinned.** Adding the pin belongs in this phase — it is the only closed set
      of the four without one, and this is the phase that grows it.
- [ ] `tests/orchestrators/plugin/install.test.ts` — the probe-independence pair (WDEP-03 layer 1)
- [ ] A boundary clause asserting `bridges/workflows/**` never reads the probe (WDEP-03 layer 2)
- [ ] A second catalog state pinning two-marker brace order
- [ ] Renamed probe helpers in `catalog-uat.test.ts` and `notify-v2.test.ts` (not a new test,
      but a Wave-0-shaped prerequisite: every later fixture depends on the rename)

## Security Domain

`security_enforcement` is not set to `false` in config, so the section is included. This is a
render-and-docs phase with a narrow surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | no auth surface touched |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (marginal) | the probe reads `tool.name` from the Pi host and compares against a closed literal; no interpolation, no path, no user input |
| V6 Cryptography | no | — |
| V7 Error handling / logging | yes | the probe's `catch { return false; }` must NOT log or surface the caught error — matches both existing probes |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path or name leakage through a rendered reason token | Information disclosure | The token is a fixed closed-set literal with zero interpolation — the same reasoning that made Phase 104's T-104-06-03 inapplicable. Keep it literal; never interpolate a plugin, workflow or path name into it. |
| A false-positive probe causing artifacts to be written for an untrusted engine | Elevation of privilege (indirect) | This is WDEP-01's entire purpose. The probe selects the sandboxed engine's distinctive tool. NOTE: the probe does not *gate* writing — artifacts are written regardless (WDEP-02) — so a false positive misreports rather than mis-writes. Say so in the docs. |
| The docs understating the executable-code risk | — (informational integrity) | WDOC-01 is itself the control. The sandbox comparison table is the load-bearing content; do not soften it. |
| A dependency-manifest change smuggled in with the docs | Supply chain | No `package.json` / `package-lock.json` change is in scope. Treat any such diff as a review finding. |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `REASONS` had 38 members | 39, tail `"stale workflow command"` | Phase 104 (2026-08-15) | this phase appends the 40th; the count sentences in `notify.ts` and `notify-reasons.ts` both need bumping, and the narration sentence needs extending |
| `notify-v2.test.ts` order assertion anchored on `REASONS.slice(-3)` | anchored on `indexOf("malformed mcp")` | Phase 104 | a tail append no longer trips it — verify, do not fix |
| `PluginUninstalledMessage` had no `reasons` field | optional `reasons?` | Phase 104 | irrelevant here (uninstall never carries a soft-dep marker) — do not be tempted by the newly-available field |
| Engine at 3.5.0-era spike measurements | 3.5.1, published 2026-08-05 | upstream | every engine claim in this document was re-read against 3.5.1 this session |

**Stale in the tree right now:**

- `docs/output-catalog.md:63` — "38-member REASONS tuple" (tuple is 39)
- `docs/messaging-style-guide.md:61` — "the closed set of **2** soft-dependency probe targets"
- `docs/messaging-style-guide.md:28` — `export type Dependency; // "agents" | "mcp"`
- `docs/messaging-style-guide.md:67` — "REQUIRED only on `installed | updated | reinstalled | present`" (mentions `present`, a retired status) and "The other 12 variants" (there are 19 statuses)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The reason token should be spelled `requires pi-dynamic-workflows` | §Token spelling | Discretionary per CONTEXT. Wrong choice is cheap to change BEFORE the catalog byte gate and the COMPAT-01 enumeration land; expensive after. Settle the spelling in task 1. |
| A2 | No existing catalog state changes bytes when the third probe lands | §Catalog Amendment | If wrong, the byte gate fails on states this phase did not touch and the diff looks like a regression. Verify empirically by running `catalog-uat.test.ts` immediately after the probe lands and before any fixture edit. |
| A3 | `declaresWorkflows` as a required third parameter is preferable to collapsing `composeReasons` onto `readonly Dependency[]` | §Marker Plumbing | The collapse is the cleaner end state and would make a fourth dependency free, but it reshapes a byte-critical signature at 31 sites in a phase whose acceptance is a byte gate. If the planner prefers the collapse, it should be its own task with the catalog gate run before and after. |
| A4 | Seven `Dependency[]` derivations is the complete set | §Pattern 3 | Derived by grepping `declaresAgents` / `Dependency[]`. A missed one renders a row without the marker — silent, not a compile error, because the derivation returns a valid `Dependency[]` either way. Recommend a test that asserts every dep-bearing surface can produce the marker, rather than trusting the grep. |
| A5 | `sonarjs/no-identical-functions` will or will not fire on the three-arm copies | §Pitfalls | Unmeasured — depends on the rule's similarity threshold. Budget a task for extraction; do not assume it is free either way. |
| A6 | The operator will accept a "read from source, not driven at runtime" formulation for quintinshaw's `agent()` failure path | §agent() failure semantics | CONTEXT locked "not measured". The source read is new information the decision predates. Surface as a checkpoint; do not write it unilaterally. |
| A7 | README Features/Prerequisites edits (both languages) are in scope | §Discoverability | CONTEXT scopes the docs deliverable to `docs/workflows-compatibility.md` + `docs/output-catalog.md`. The README pointer is the only discoverability path that exists, so it is arguably implied by "stated where a plugin author will read it" — but it is an extra file pair. Confirm with the operator or plan it as a clearly-labelled sub-task. |
| A8 | The `stagedWorkflows` signal name for `LedgerDegradationSignals` | §Tier 3 | Naming only; mirrors `stagedAgents` / `stagedMcpServers`. |

## Open Questions

1. **Does the reinstall row's no-raise asymmetry survive review?**
   - What we know: `reinstall.ts:956` stamps severity from `reasons.length` alone and never
     calls `companionSeverity`; the catalog's reinstall soft-dep block carries no summary
     line, so the asymmetry is deliberate and byte-pinned.
   - What's unclear: whether a *workflows* marker on reinstall should behave the same. CONTEXT
     says severity is `warning` by the tri-state model, which argues for a raise; "copy the
     agents precedent, do not invent" argues against.
   - Recommendation: copy the precedent (no raise on reinstall). The tri-state argument in
     CONTEXT is about the INSTALL row, and diverging from the sibling markers on one verb
     would make reinstall's brace and its severity disagree with each other. Record it as a
     decision either way so a reviewer does not read it as an oversight.

2. **Should `DEPENDENCIES` grow a pin in this phase?**
   - What we know: the CONTEXT asserts all four closed sets are pinned; `DEPENDENCIES` is not.
   - What's unclear: whether adding a pin counts as scope creep.
   - Recommendation: add it. It is three lines, it is the set this phase grows, and its absence
     is exactly the kind of gap the "four artifacts, a partial set is a latent bug" invariant
     is meant to catch.

3. **One catalog state or two?**
   - What we know: one state satisfies WDOC-02 literally; two are needed to byte-pin marker
     ORDER inside the brace.
   - Recommendation: two. The order is the only genuinely new byte behaviour this phase
     introduces, and `success-with-orphan-rewake-and-soft-dep` is the standing precedent for
     pinning a composed brace with its own state.

4. **Does the docs deliverable need its own "Install-time disposition" section, or does the
   admit-versus-run table cover it?**
   - What we know: `hooks-compatibility.md`'s equivalent section is the most useful in that
     file, and workflows has five distinct dispositions already implemented (per-script skip,
     whole-script refusal, collision hard error, pre-validation skip, engine-absent degradation).
   - Recommendation: write it. Four of the five are Phases 102-104 behaviour that is currently
     documented nowhere a plugin author would find.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | >= 20.19.0 per `engines` | — |
| npm registry access | verifying engine facts | ✓ | — | spike findings (already transcribed here) |
| `node_modules` (symlink into the primary checkout) | `npm run check` | ✓ | — | none — this is why executors must run sequentially, not in agent worktrees |
| `@quintinshaw/pi-dynamic-workflows` | live canary layer 3 only | ✗ (not in local or global `node_modules`) | 3.5.1 available on npm | `PI_WORKFLOW_ENGINE_ROOT=<dir>/node_modules` after an out-of-tree `npm i`; the canary prints this exact hint on an unmet precondition [VERIFIED: tests/live-uat/workflow-storage-canary.mjs:219] |
| `pre-commit` | commit hooks | assumed ✓ | — | none; `--no-verify` is forbidden |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** the host engine. Layers 1 and 2 of the WDEP-03 proof
require nothing beyond `npm run check`; only layer 3 needs the engine, and it is deliberately
outside `npm run check`. Plan the phase so that no wave gate depends on the engine being
present.

## Project Constraints (from CLAUDE.md)

Directives that bind this phase:

- **Git:** never commit to `main`; never rebase or rewrite history; run
  `pre-commit run --all-files` BEFORE `git commit` and never `--no-verify`. From this
  worktree, prefix with `SKIP=trufflehog` **only after** a clean filesystem-mode trufflehog
  scan of the paths being committed (`--results=verified,unknown --fail`); the git-mode hook
  is structurally broken in a linked worktree.
- **Commit messages:** Conventional Commits, title 5-72 chars, body lines <= 80. **No GSD
  milestone or phase mentions.**
- **Comments and test titles:** no `Phase NN` / `Plan NN` / `Wave N` / `Task N` / `Pitfall N`.
  Requirement and decision IDs (`WDEP-01`, `WDOC-01`, `SNM-06`, `D-16-15`, `MSG-SD-3`,
  `NFR-2`, `RH-3`) are the sanctioned anchors [CITED: .claude/rules/typescript-comments.md].
- **Output channel (IL-2):** all user-visible messages through `ctx.ui.notify` via
  `shared/notify.ts`; direct `process.stdout`/`process.stderr` lint-forbidden in the extension.
- **Quality bar (NFR-6):** `npm run check` must stay green.
- **Recovery model (NFR-2):** no fix may require a Pi process restart; `/reload` must suffice.
  This phase's whole degradation story is an instance of it.
- **Style:** Prettier `printWidth: 100`, `trailingComma: "all"`; explicit return types on all
  exported functions; `curly: all`; `sonarjs/cognitive-complexity: 15` (error).
- **Markdown:** formatted by `mdformat` via pre-commit, NOT prettier. `npm run format:check`
  covers only `js,json,ts`. Never run `prettier --write` on `docs/*.md`.
- **Versioning:** the bump is offered before a PR — explicitly deferred to milestone close by
  CONTEXT, so this phase touches neither `package.json` nor `sonar-project.properties` nor
  `CHANGELOG.md` nor `EXTENSION_VERSION`.
- **Project skills:** `simple-english` is available and is a good fit for the new
  compatibility doc's prose (short sentences, active voice) — but the existing
  `hooks-compatibility.md` register is denser than STE. Match the sibling document, not the
  skill's default, unless the operator prefers otherwise.

## Sources

### Primary (HIGH confidence)

- `@quintinshaw/pi-dynamic-workflows@3.5.1` npm tarball, unpacked and read this session:
  `extensions/workflow.ts` (tool registration at :176-178, `session_start` at :252,
  `registerAllSavedWorkflows` at :289), `src/workflow-control-tool.ts` (:76),
  `src/deep-research.ts` (:22), `src/workflow.ts` (`DETERMINISM_BLOCKLIST` :370, `agent`/`agentImpl`
  :516-570, `parseWorkflowScript` :1343-1402, `evaluateLiteral` :1404-1448, `validateMeta`
  :1450-1465), `src/saved-commands.ts` (:132-149), `src/workflow-saved.ts` (:45-60, :129-153)
- `@nicknisi/pi-workflows@0.2.2` npm tarball, unpacked and read this session: `index.ts` (:242-243)
- `npm view` for both packages (versions and publish date)
- Repository sources read this session: `platform/pi-api.ts`, `shared/concerns/soft-dep.ts`,
  `shared/notify-reasons.ts`, `shared/notify.ts` (lines 1-200, 1900-2320),
  `orchestrators/plugin/shared.ts`, `orchestrators/plugin/install.ts` (1870-2030),
  `orchestrators/plugin/list.ts`, `orchestrators/plugin/reinstall.ts` (930-960),
  `orchestrators/plugin/update.ts` (2495-2530), `docs/hooks-compatibility.md` (full),
  `docs/output-catalog.md` (450-745), `tests/architecture/catalog-uat.test.ts` (1-200, 1180-1290),
  `tests/platform/pi-api.test.ts`, `tests/live-uat/workflow-storage-canary.mjs` (1-80),
  `README.md`, `README.es.md`, `package.json`, `.planning/config.json`

### Secondary (MEDIUM confidence)

- `.claude/skills/spike-findings-pi-claude-marketplace/references/workflows-bridge.md` — the
  sandbox comparison table (Spikes 022a/009b), the upstream-stability paragraph, the
  registration/reload asymmetry. Measured during the spikes; not re-measured this session, but
  every claim in it that could be checked against the 3.5.1 source was and held.
- `.planning/spikes/024-workflows-bridge-shape/README.md:80` — the tool-name inventory
  (`workflow`, `workflow_control`, `deep_research`), confirmed exactly by this session's read.
- `.planning/workstreams/workflows/phases/104-workflow-lifecycle-completion/104-06-SUMMARY.md`
  — the token artifact trail and the additive-amendability note; re-derived against the tree
  and found to have grown by two entries (see §Token Artifact Trail).

### Tertiary (LOW confidence)

- None. No claim in this document rests on a web search or on training memory alone.

## Metadata

**Confidence breakdown:**

- Engine facts (probe target, false positive, seven gates, load-time registration): **HIGH** —
  read verbatim from the shipped 3.5.1 and 0.2.2 tarballs this session
- Marker plumbing blast radius: **HIGH** — enumerated by grep over the working tree with
  per-site line numbers
- Token artifact trail: **HIGH** — re-derived, and the two additions past Phase 104's list are
  named
- Docs structure: **HIGH** — the template was read in full
- Token spelling and the `composeReasons` signature choice: **MEDIUM** — discretionary
  recommendations with stated rationale and stated alternatives
- `sonarjs` reaction to the widened derivations: **LOW** — unmeasured, budgeted as a risk

**Research date:** 2026-08-16
**Valid until:** 2026-09-15 for the repository-internal facts; **7 days** for the engine facts
— `@quintinshaw/pi-dynamic-workflows` has shipped 50 releases since May 2026 and its internals
carry no exported contract, so re-verify `workflow_control` and the `parseWorkflowScript` gate
list against the then-current version if this phase slips.
