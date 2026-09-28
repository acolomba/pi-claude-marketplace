# Phase 114: Degradation and documentation - Research

**Researched:** 2026-09-07
**Domain:** Soft-dependency probing, closed-set growth, byte-gated documentation, upstream manifest-schema confirmation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**The soft dependency**

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

**The marker-coverage gate (criterion 3)**

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

**Engine-independent bytes (criterion 2)**

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

**The docs**

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

**Criterion 6 — the path-bearing premise**

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

### Claude's Discretion

- Plan and task decomposition; the compatibility doc's precise table columns and
  section order; the exact wording of the Spanish README additions; the shape of
  the table-driven gate's case records.

### Deferred Ideas (OUT OF SCOPE)

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
</user_constraints>

<phase_requirements>
## Phase Requirements

Requirement text lives in
`.planning/workstreams/workflows/milestones/workflows-REQUIREMENTS.md`
(the active `REQUIREMENTS.md` maps but does not restate them)
[VERIFIED: `.planning/workstreams/workflows/REQUIREMENTS.md:111` — `| WDEP-01..04, WDOC-01..03 | Phase 114 | Pending (re-land) |`].

| ID | Description (abridged from the archived file) | Research Support |
|----|-------------|------------------|
| WDEP-01 | Host engine probed via the quintinshaw-specific `workflow_control` tool, RH-3/RH-4 pattern. Bare `workflow` false-positives on `@nicknisi/pi-workflows`. | §Probe Design — both engines' tool names re-read from the **current** shipped tarballs (3.10.1 / 0.3.1) this session; the false positive is confirmed at today's versions, not inherited. |
| WDEP-02 | Engine absent -> artifacts still written, install still succeeds, carrying a degradation reason. Never blocks. | §Marker Plumbing — the `agents`/pi-subagents path is a render-time marker plus a severity stamp with no ledger gate; copying it cannot block. |
| WDEP-03 | Install the engine + `/reload` -> already-installed workflows work, no reinstall. | §Proving WDEP-03 — the install ledger's workflows phase takes no `pi` and no probe [VERIFIED: install.ts:1200-1240]; the engine registers from a `session_start` directory scan [VERIFIED: 3.10.1 `src/pi-extension.ts:252`, `src/saved-commands.ts:119`, `src/workflow-saved.ts:287`]. |
| WDEP-04 | `workflows` becomes the third `Dependency` member with its marker; new token joins `REASONS`. | §The Closed-Set Amendment Trail (re-derived against the current tree; **8 sites**, not the 7 Phase 113 recorded). |
| WDOC-01 | Docs state first-executable-code bridge, name the host engine and trust grounds, separate guaranteed from divergent semantics; carry the admit-versus-run divergence table. | §Docs Deliverable — the engine's refusal checks re-read verbatim from 3.10.1 this session (**nine checks**, not seven). |
| WDOC-02 | `docs/output-catalog.md` carries the new token and rendered states, under the byte gate. | §Catalog Amendment. |
| WDOC-03 | `acorn` (8.16.0) declared as a runtime dependency. | **ALREADY SATISFIED** [VERIFIED: `package.json` `dependencies` -> `"acorn": "^8.16.0"`]. Verification-only for this phase; a re-declaration is a review finding, not work. |
</phase_requirements>

## Summary

Criterion 6 is settled and it settles in the direction the CONTEXT expected. Claude
Code's plugin-manifest schema declares `workflows` as a union of a path string and an
array of path strings, in a definition byte-for-byte parallel to `themes` and
`outputStyles`, and the plugin loader normalizes it with the same
`Array.isArray(x) ? x : [x]` idiom it uses for `agents` and `skills`. Two independent
sources say so: the published reference page and the installed 2.1.251 binary. Nothing
changes in `domain/resolver.ts`. The work is to replace a paragraph in
`tests/domain/resolver.test.ts` with the citation and to carry it into the new doc.

Everything else in this phase is arithmetic on closed sets, and the arithmetic is
different from the archived Phase 105's because the tree moved under it. `composeReasons`
has **19** production call sites, not 31. `SoftDepStatus` has **111** literal
constructions in the test tree, and making `workflowEngineLoaded` required visits every
one. The closed-set token trail is **8** sites, not the 7 Phase 113 recorded, because
`docs/output-catalog.md`'s own prose count is currently stale at "43-member" against a
44-member tuple. The `Dependency[]` derivation list the CONTEXT hands you is correct at
seven — verified by reading all seven — but two of the seven are already exported
production functions with their own direct tests, which changes what the criterion-3 gate
has to reach through.

The engine numbers the docs must carry have all moved. `parseWorkflowScript` at 3.10.1
refuses at **nine** distinct checks, not seven, and the bridge already replicates **two**
of them (determinism and parse), not one. The engine's peer floor is
`pi-coding-agent >=0.80.8` against this project's `>=0.80.5`, verified directly from npm.
`@nicknisi/pi-workflows` has moved 0.2.2 -> 0.3.1 and still registers exactly one tool
named `workflow`, so the false positive the probe exists to avoid is live today.

**Primary recommendation:** land the confirmation first (it is cheap and unblocks the
doc), then the four artifacts of the soft dependency behind required fields, then the
catalog and doc amendments. Spell the token `requires pi-dynamic-workflows`. State nine
checks and two replicated, not seven and one — the archived figures and the CONTEXT's own
wording are both stale on that number, and Spike 027 is the authority the ROADMAP names.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Host-engine detection (`workflow_control`) | `platform/` | — | `pi.getAllTools()` is external Pi API surface; `platform/pi-api.ts:7-13` names itself the sole import site |
| Closed dependency set + marker literals | `shared/concerns/soft-dep.ts` | — | Owns the `Dependency` union, both marker constants, and the pure `softDepMarkers` helper (D-01) |
| Reason token membership + order | `shared/notify.ts` (`REASONS`) | `shared/notify-reasons.ts` (topic views) | `REASONS` is the byte-source of catalog truth; the topic groups are typed views with a compile-time coverage proof |
| Deciding a row declares `workflows` | `orchestrators/**` | — | Commands determine state and stamp reasons; `notify.ts` is a dumb renderer and must not probe |
| Severity raise on unloaded companion | `shared/notify-reasons.ts::companionSeverity` | orchestrator call sites | Pure given the probe; the orchestrator supplies the declares-flags |
| Rendered bytes for the new states | `docs/output-catalog.md` | `tests/architecture/catalog-uat.test.ts` | Bidirectional byte gate: doc state and fixture must land together |
| Upstream-premise confirmation | `docs/workflows-compatibility.md` | `tests/domain/resolver.test.ts` | The doc carries the citation; the test carries the consequence it pins |
| Executable-code contract | `docs/workflows-compatibility.md` | `README.md` / `README.es.md` | Per-kind compatibility contract, discoverable from the Features list |

## Standard Stack

No new packages. This phase installs nothing.

### Core (already declared, unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | peer `>=0.80.5` | `ExtensionAPI.getAllTools()` — the probe surface | The sole external Pi API dependency [VERIFIED: `package.json` `peerDependencies`] |
| `acorn` | `^8.16.0` (declared runtime dep) | `meta.name` extraction in `domain/workflow-script.ts` | WDOC-03 already satisfied [VERIFIED: `package.json` `dependencies`] |
| `node:test` | Node >= 20.19.0 builtin | every suite | Project standard |

### Referenced-but-not-installed (the subject of the docs)

| Package | Version | Role | Verification |
|---------|---------|------|--------------|
| `@quintinshaw/pi-dynamic-workflows` | **3.10.1**, published 2026-09-03, 57 published versions | the host engine — **never** a dependency of this repo | [VERIFIED: `npm view @quintinshaw/pi-dynamic-workflows version time.modified` -> `3.10.1` / `2026-09-03T20:51:28.204Z`; `versions --json` -> 57 entries] |
| `@nicknisi/pi-workflows` | **0.3.1** (was 0.2.2 at Phase 105) | the REJECTED engine — the false-positive source | [VERIFIED: `npm view @nicknisi/pi-workflows version` -> `0.3.1`; tarball unpacked and read this session] |

**Do not add either to `package.json`.** A dependency-manifest diff in this phase's
commits is itself a review finding.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** The two packages above are
documented, not depended on. No `package.json` / `package-lock.json` change is in scope.
`acorn ^8.16.0` is already declared and needs no re-verification for install purposes.

## Criterion 6 — the path-bearing premise, SETTLED (CONFIRMED)

### Verdict

**Upstream's plugin-manifest `workflows` field IS path-bearing, with the
`string | string[]` shape the premise assumed.** `SUPPORTED_COMPONENT_PATH_KINDS` keeps
`workflows`. `domain/resolver.ts` needs no change. `tests/domain/resolver.test.ts`'s
pinned case stays green and keeps its assertions; only its "premise has lineage but no
upstream citation" paragraph (lines 1804-1808) is replaced by the citation.

### Evidence A — published documentation (MEDIUM->HIGH; it is the primary source for the contract)

[CITED: https://code.claude.com/docs/en/plugins-reference — plugin.json component-path
field table, fetched 2026-09-07. Note `docs.claude.com/en/docs/claude-code/plugins-reference`
301-redirects here.]

The reference table lists `workflows` beside the other component-path fields:

| Field | Type | Documented wording |
|---|---|---|
| `skills` | string\|array | "Custom skill directories containing `<name>/SKILL.md`. Adds to the default `skills/` scan." |
| `commands` | string\|array | "Custom flat `.md` skill files or directories (replaces default `commands/`)" |
| `agents` | string\|array | "Custom agent files (replaces default `agents/`)" |
| **`workflows`** | **string\|array** | **"Custom workflow script files or directories (replaces default `workflows/`)"** |
| `outputStyles` | string\|array | "Custom output style files/directories (replaces default `output-styles/`)" |
| `experimental.themes` | string\|array | "Color theme files/directories (replaces default `themes/`)" |

### Evidence B — the shipped CLI binary (HIGH)

Claude Code **2.1.251**, `/home/acolomba/.local/share/claude/versions/2.1.251`, ELF,
214,326,616 bytes, read via `strings -n 8` this session.

**The manifest schema definition, verbatim** (whitespace as-emitted; `dt` = union,
`p` = object, `I` = array, `H` = the path-string schema also used by `themes` and
`outputStyles`):

```js
Ls=m(()=>p({workflows:dt([H().describe("Path to a workflows directory or .js file, relative to the plugin root. When set, the workflows/ directory is not auto-loaded — list its files here if you want both."),I(H().describe("Path to a workflows directory or .js file, relative to the plugin root. When set, the workflows/ directory is not auto-loaded — list its files here if you want both.")).describe("List of workflow directory or .js file paths. When set, the workflows/ directory is not auto-loaded.")]).optional()}))
```

The immediately preceding definitions in the same bundle region are
`ct` (`outputStyles`) and `pt` (`themes`), written with an identical
`dt([H().describe(...), I(H().describe(...)).describe(...)])` body. `workflows` is not a
special case; it is a member of that family.

**The loader, verbatim** (`A` is the parsed manifest, `e` the plugin root, `F` the
accumulated component-path record):

```js
let qe=Ks(e,"agents");if(Ee)F.agentsPath=qe;if(A.agents){let Ye=Array.isArray(A.agents)?A.agents:[A.agents],ht=await xk(Ye,e,A.name,t,"agents","Agent","specified in manifest but",y,!1,d);if(ht.length>0)F.agentsPaths=ht}
…
if(Ue)F.workflowsPath=Ks(e,"workflows");if(A.workflows){let Ye=Array.isArray(A.workflows)?A.workflows:[A.workflows],ht=await xk(Ye,e,A.name,t,"workflows","Workflow","specified in manifest but",y,!1,d);if(ht.length>0)F.workflowsPaths=ht}
```

with the auto-load guard defined in the same statement list as its siblings:

```js
let ge=!A.commands&&U,Ee=!A.agents&&B,Le=z,ve=A.outputStyles,xe=!ve&&V,De=!(A.experimental?.themes??A.themes)&&me,Ue=!A.workflows&&fe
```

and the shadowing diagnostic:

```js
if(A.workflows&&fe){s6(A.name,pe,"workflows");let Ye=Ks(e,"workflows");if(!OHt(A.workflows,e,Ye))v.push({type:"folder-shadowed-by-manifest",source:t,plugin:A.name,component:"workflows",folderPath:Ye,manifestFields:[A.experimental?.workflows!==void 0?"experimental.workflows":"workflows"]})}
```

`xk` is the shared path-resolution helper: same function, same argument positions, for
`agents`, `skills`, `outputStyles`, `themes` and `workflows`.

**Distinguish the decoy.** A second `workflows:ye().optional().describe("@internal")` in
the same binary belongs to the SKILL frontmatter schema (its neighbours are
`mcpServers` / `lspServers` / `agents` / `outputStyles` / `themes` / `channels` /
`monitors` / `settings` / `userConfig` / `defaultEnabled` / `experimental` /
`dependencies`, all `@internal`). It is not the plugin manifest and must not be cited as
one.

### Two real divergences the confirmation exposes (for the compatibility doc, NOT for this phase to fix)

1. **Declared-vs-convention semantics differ.** Upstream REPLACES: `Ue=!A.workflows&&fe`
   means the default `workflows/` scan runs only when the manifest is silent, and
   declaring the field while the folder exists raises `folder-shadowed-by-manifest`.
   This project UNIONs: `collectStrictComponentKind` appends the convention directory
   after the declared paths whenever `<pluginRoot>/workflows` stats as a directory
   [VERIFIED: `domain/resolver.ts:1053-1062`]. That is pre-existing D-07 behavior shared
   with `commands` and `agents`; document it, do not change it here.
2. **Upstream admits a `.js` FILE path, not only a directory.** The schema's own wording
   is "a workflows directory **or .js file**". `validateComponentPath` neither stats nor
   requires a directory [VERIFIED: `domain/resolver.ts:963-1007`], so a file path resolves
   fine; whether `discoverPluginWorkflows` enumerates a file target is a bridge question
   this research did not drive. See Open Questions.

## Architecture Patterns

### System architecture

```text
  Pi host session
        │  pi.getAllTools()
        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ platform/pi-api.ts   (sole pi.getAllTools() import site)       │
 │   hasLoadedPiSubagents   -> tool named "subagent"        (RH-3)│
 │   hasLoadedPiMcpAdapter  -> "mcp" OR sourceInfo match    (RH-4)│
 │   hasLoadedWorkflowEngine-> tool named "workflow_control" ◄NEW │
 │   softDepStatus(pi) -> { piSubagentsLoaded,                    │
 │                          piMcpAdapterLoaded,                   │
 │                          workflowEngineLoaded ◄NEW }           │
 └───────────────────────────┬───────────────────────────────────┘
                             │ ONE SoftDepStatus snapshot per notify() call
        ┌────────────────────┴──────────────────────┐
        ▼                                            ▼
 ┌──────────────────────────────┐        ┌───────────────────────────────┐
 │ orchestrators/** (7 sites)    │        │ shared/notify.ts (renderer)    │
 │  <staged workflows?>          │  row   │  composeReasons(reasons,       │
 │    -> dependencies += ◄NEW    │───────►│    declaresAgents,             │
 │       "workflows"             │        │    declaresMcp,                │
 │  companionSeverity(...)       │        │    declaresWorkflows, ◄NEW     │
 │    -> info | warning          │        │    probe)                      │
 └──────────────────────────────┘        │        │                       │
                                          │        ▼                       │
                                          │ shared/concerns/soft-dep.ts    │
                                          │  Dependency = "agents"|"mcp"   │
                                          │              |"workflows" ◄NEW │
                                          │  softDepMarkers -> Reason[]    │
                                          └────────┬──────────────────────┘
                                                   │ "{r1, r2, r3}" brace
                                                   ▼
                                          ctx.ui.notify(text, severity)
                                                   │ byte-compared against
                                                   ▼
                                          docs/output-catalog.md
                                    (tests/architecture/catalog-uat.test.ts)

  ── STRUCTURALLY DISJOINT from everything above ──
  install ledger workflows phase  ──►  bridges/workflows/{stage,unstage}.ts
        (takes no `pi`, no probe)        prepareStageWorkflows(input)
                                                   │
                                                   ▼
                       <workflowsSavedDir>/<generatedName>.json
                       user    -> ~/.pi/workflows/saved/
                       project -> ~/.pi/workflows/projects/<key>/saved/
                                                   │
                       engine `session_start` -> registerAllSavedWorkflows
                                              -> storage.list() (plain readdir)
```

The lower branch is criterion 2 and WDEP-03: the artifact path and the probe path never
touch, so envelope bytes cannot vary with the probe and a later `/reload` converges by
construction.

### Pattern 1: the RH-3 probe shape (copy, do not invent)

[VERIFIED: `extensions/pi-claude-marketplace/platform/pi-api.ts:125-135`]

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

`hasLoadedPiMcpAdapter` is the richer RH-4 variant that also substring-matches
`sourceInfo.source` against `"pi-mcp-adapter"` [VERIFIED: `pi-api.ts:142-156`].

**Take RH-3, not RH-4.** The RH-4 `sourceInfo` fallback exists because `mcp` is a generic
tool name. `workflow_control` is distinctive and registered unconditionally, and a
`sourceInfo.source.includes("pi-dynamic-workflows")` arm would re-open exactly the
false-positive surface WDEP-01 exists to close.

### Pattern 2: closed-set growth forced by a required field

Three widenings, each forcing its own compile-error sweep. The sweep sizes measured on
the current tree:

| Widening | Sites forced | Measured by |
|---|---|---|
| `SoftDepStatus` gains required `workflowEngineLoaded: boolean` | **111** literal constructions in `tests/**` + **2** in production | `grep -rn "piSubagentsLoaded:" tests/ --include=*.ts \| wc -l` -> 111; `softDepStatus` + `companionSeverity` reads in `extensions/` |
| `composeReasons` gains required 4th boolean (probe moves to 5th position) | **19** production call sites in **4** files + 2 test sites | see §Marker Plumbing |
| `companionSeverity`'s object param gains required `declaresWorkflows` | 3 call sites | `install.ts`, `update.ts`, `enable-disable.ts` |

**Anti-pattern: an optional-defaulted parameter.** `declaresWorkflows = false` compiles
everywhere and visits nothing. This project has a named recurring defect class for exactly
that ("optional-field silent-omission"), and the CONTEXT locks the required form.

### Pattern 3: the table-driven architecture gate

`tests/architecture/notify-stamp-coverage.test.ts` is the shape criterion 3's gate should
take: it imports the exported builders (`buildReconcileAppliedCascade`,
`buildReconcilePendingNotification`), feeds a table of outcome literals, and asserts the
stamps on the resulting messages. No source grep, no private export.

`tests/architecture/source-scan.ts` exports `assertNoForbiddenSurface(...)` and
`stripComments(...)` and is the ready-made mechanic for the "`bridges/workflows/**` never
reads the probe" clause. Its WR-06 rule matters: **a target that does not exist FAILS**,
so the clause cannot green over a renamed file.

### Anti-patterns to avoid

- **Probing bare `workflow`.** Verified false positive at `@nicknisi/pi-workflows@0.3.1`
  this session.
- **Adding a `sourceInfo.source` fallback arm** to the workflows probe.
- **Inserting the new `REASONS` member after `requires pi-mcp`.** It reads better and it
  is wrong: the tuple's own header says new tokens append at the tail and existing
  entries never reorder [VERIFIED: `notify.ts:83-84`], and the COMPAT-01 gate asserts
  enumeration equality including order. Brace order is set by `softDepMarkers`'s push
  order, NOT by `REASONS` index, so the tail position costs nothing.
- **Restructuring `docs/output-catalog.md`.** The region is additively amendable; a
  restructure moves bytes on untouched states.
- **Stamping the marker on `uninstalled` / `disabled` rows.** Structural (MSG-SD-3 /
  ENBL-15 / D-100-06): those variants have no `dependencies` field, and their composers
  hard-code the declares-flags `false`.
- **Raising severity on the reinstall row.** Existing deliberate asymmetry; the catalog's
  reinstall `success-with-soft-dep` block carries no `needs attention` line
  [VERIFIED: `docs/output-catalog.md:876-882`].
- **Editing `orchestrators/plugin/info.ts` in a "dependencies" sweep.** Its
  `dependencies` identifier is the Claude plugin manifest's own `dependencies`
  declaration (backlog PDEP-01), an unrelated concept. Sweep for the `Dependency` TYPE
  and the `declaresAgents` identifier, never the bare word.

## The seven `Dependency[]` derivation sites — read, not trusted

All seven confirmed by reading the tree. The CONTEXT's enumeration is correct and
complete; nothing was missed. What the CONTEXT does not say is that they are not equally
private.

| # | File | Function | Exported? | Public surface that reaches it |
|---|------|----------|-----------|-------------------------------|
| 1 | `orchestrators/plugin/install.ts:1812` | `composeInstalledRow(installCtx, pi)` | private | `installPlugin(...)` — a full install run only |
| 2 | `orchestrators/plugin/list.ts:306` | `dependenciesFromDeclares(...)` via `installedRowMessage` (`:437`, private), called at `:610` | private | `loadPluginListPayload(...)` / `listPlugins(...)` |
| 3 | `orchestrators/plugin/shared.ts:125` | `enableRowDependencies(signals)` | **EXPORTED** (production: `enable-disable.ts:1264`, `reconcile/notify.ts:567`) | direct call; already has `tests/orchestrators/plugin/shared.test.ts` |
| 4 | `orchestrators/plugin/reinstall.messaging.ts:364` | `dependenciesFromOutcome(outcome)` | private | exported `reinstalledRowFromOutcome` (`:233`) / `outcomeToPluginMessage` (`:279`) |
| 5 | `orchestrators/plugin/update-row.ts:160` | `outcomeDependencies(a, m)` | private | exported `updatedRowFromOutcome` (`:100`) |
| 6 | `orchestrators/import/execute.ts:361` | `dependenciesFromInstalled(o)` via private `buildImportNotificationMarketplaces` (`:392`, called at `:1201`) | private | `importClaudeSettings(...)` — a full import run only |
| 7 | `orchestrators/reconcile/apply-outcomes.ts:439` | `dependenciesFromInstall(outcome)` | **EXPORTED** (production: `reconcile/apply.ts:462`, `reconcile/backfill.ts:398`) | direct call; already has `tests/orchestrators/reconcile/apply-outcomes.test.ts` |

**Answer to the CONTEXT's question ("report whether reaching them through a public
surface is actually possible for every site, and name any site where it is not").**

Yes for all seven, with no new export and no test-only seam. Three tiers:

- **Tier A (direct, 2 sites):** #3 and #7 are already exported for production reasons and
  already have direct owner tests. The gate calls them.
- **Tier B (one hop, 2 sites):** #4 and #5 sit behind exported outcome->row composers that
  take a plain outcome object and return a message. The gate builds the outcome and reads
  the row.
- **Tier C (full run, 3 sites):** #1, #2, #6 are reachable only by driving `installPlugin`
  / `loadPluginListPayload` / `importClaudeSettings`. That is expensive but **already
  routine in this repo**: `tests/orchestrators/plugin/install.test.ts` drives real installs
  under `withHermeticHome` with a parameterized fake `getAllTools()`
  [VERIFIED: `install.test.ts:293-310` — `makeCtx(piOverrides?: { readonly toolNames?: readonly string[] })`],
  and it already has a `writeWorkflowScripts(pluginRoot, workflows)` fixture helper
  [VERIFIED: `install.test.ts:408-431`].

**Recommended gate shape.** One `tests/architecture/` suite, one case per site, each case
a `{ site, drive: () => Promise<string> | string }` record returning the RENDERED row (or
the composed `dependencies` array read off the built message), asserting the row carries
`requires pi-dynamic-workflows` under an engine-absent probe and does not under an
engine-present one. Tier C cases will be slow; that is the honest price of not exporting a
private helper.

**Negative control (mandatory).** Delete the `dependencies.push("workflows")` arm from
exactly one site, run the suite, confirm exactly one case reddens, restore. Record the
transcript in the SUMMARY. Do this once per site if budget allows; once at minimum, on a
Tier C site (the ones most likely to be reached vacuously).

## Marker Plumbing: the measured blast radius

### Tier 1 — shared vocabulary (3 files)

| File | Change | Current state |
|------|--------|---------------|
| `platform/pi-api.ts` | `SoftDepStatus` gains `workflowEngineLoaded`; new `hasLoadedWorkflowEngine`; `softDepStatus` composes three | 2-field interface at `:120-123`; `softDepStatus` at `:158-163` |
| `shared/concerns/soft-dep.ts` | `Dependency` union gains `"workflows"`; `SOFT_DEP_MARKER_WORKFLOWS`; `softDepMarkers` gains a third declares-flag and a third `if`, **appended LAST** | `type Dependency = "agents" \| "mcp"` at `:30`; markers at `:33-34`; `softDepMarkers` at `:44-60` |
| `shared/notify-reasons.ts` | token appended to the `UnsupportedReason` union; `companionSeverity` object param gains `declaresWorkflows`; module-header count sentences | `UnsupportedReason` is a literal-union type (one-line append); `companionSeverity` at `:87-95` |

`companionSeverity` today [VERIFIED: `notify-reasons.ts:87-95`]:

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

A third disjunct keeps it well under both complexity ceilings. A
`Record<Dependency, keyof SoftDepStatus>` loop would be cleaner and would make a fourth
dependency free, but it is a larger change in a phase whose acceptance is a byte gate —
recommend the third disjunct, note the loop as a follow-up.

### Tier 2 — the renderer

`composeReasons` [VERIFIED: `shared/notify.ts:2269-2283`], **19 production call sites**
across 4 files:

| File | Call sites | Lines |
|---|---|---|
| `shared/notify.ts` | 17 | 2006, 2033, 2321, 2357, 2416, 2447, 2478, 2511, 2527, 2547, 2572, 2687, 2705, 2723, 3726, 3800 (+ the definition at 2269) |
| `orchestrators/marketplace/update.messaging.ts` | 1 | 77 |
| `orchestrators/import/execute.messaging.ts` | 1 | 102 |
| `orchestrators/reconcile/reconcile.messaging.ts` | 1 | 189 |

Of those, exactly **5** translate `dependencies` -> declares-flags and therefore need a
third `.includes("workflows")`; the other 14 pass literal `false, false` and become
`false, false, false`:

| Composer | Line | Serves |
|---|---|---|
| `partiallyInstalledRow` | 2357-2362 (`p.dependencies?.includes(...) ?? false`) | `(partially-installed)` on every surface |
| `installedLikeRow` | 2416-2421 | the 7 folded `installed` / `updated` / `reinstalled` command arms |
| `renderPluginRow` case `"installed"` | 2687-2692 | the central switch |
| `renderPluginRow` case `"updated"` | 2705-2710 | the central switch |
| `renderPluginRow` case `"reinstalled"` | 2723-2728 | the central switch |

Also update the `pluginRow` doc comment (`:2294`, "Both declares-flags are `false`"), the
`installedLikeRow` header (`:2383-2384`, "drives the `{requires pi-subagents}` /
`{requires pi-mcp}` markers"), and the `partiallyInstalledRow` header (`:2331-2332`).

**Two test sites the compiler will name:**

- `tests/shared/notify.test.ts:4923` — `type Probe = Parameters<typeof composeReasons>[3];`
  becomes `[4]`. This is a positional index; a silent off-by-one here would type `Probe`
  as `boolean` and make the whole suite's probe literals wrong.
- `tests/shared/notify.test.ts:5193` — `composeReasons(reasons, agents, mcp, probe)`.

### Tier 3 — which surfaces stamp

Copy the `agents` set exactly. Derived by tracing `declaresAgents` (57 occurrences across
16 production files):

| Surface | Stamps `{requires pi-subagents}`? | Therefore workflows? | Where the fact comes from |
|---|---|---|---|
| `install` standalone + outcome | YES + `companionSeverity` raise | YES + raise | `installCtx.stagedWorkflowNames.length > 0` [VERIFIED: `install.ts:378, 1235, 1343`] |
| `update` | YES + raise | YES + raise | outcome `declaresWorkflows` (new REQUIRED member) |
| `reinstall` | YES marker, **NO** raise | YES marker, NO raise | outcome flag |
| `enable` standalone + reconcile projection | YES + raise | YES + raise | `LedgerDegradationSignals.stagedWorkflows?: boolean` (new) |
| `list` inventory row | YES from `record.resources` | YES from `record.resources.workflows` | already a REQUIRED `string[]` in the state schema |
| `import` cascade | YES | YES | outcome flag |
| `reconcile` projections | YES marker, `info` both arms | YES marker, no raise | `dependenciesFromInstall` |
| `uninstall` / `disable` | **NO** — structural | **NO** | composers hard-code `false, false` |
| `marketplace update` child rows / `fetch` / `info` / pending | NO | NO | no `dependencies` field |

**`LedgerDegradationSignals` needs a `stagedWorkflows?: boolean` sibling**
[VERIFIED: `orchestrators/plugin/shared.ts:70-108`], and `enableRowDependencies`'s
`Pick<..., "stagedAgents" | "stagedMcpServers">` must widen. Preserve the
`partition?: never` refusal on that signature (`shared.ts:126`, WR-01) — it exists to
exclude the update/reinstall outcome shapes and must survive the widening. Producer sites
for the existing signal are `enable-disable.ts:355` and `reconcile/apply.ts:537`; the
workflows counterpart is `summary.stagedWorkflowNames.length > 0`, which
`enable-disable.ts:366` already reads for a different purpose.

**`declaresAgents` / `declaresMcp` are REQUIRED members** on the outcome types
[VERIFIED: `orchestrators/types.ts:71-72, 176-177, 462-463`]. Adding `declaresWorkflows`
as REQUIRED there is what forces the orchestrator half of the sweep.

## The Closed-Set Amendment Trail — EIGHT sites, re-derived

Phase 113 recorded the trail as seven and named the two its plan had missed
[VERIFIED: `113-04-SUMMARY.md:285-303`]. Re-derived against the current tree, adding
`"requires pi-dynamic-workflows"` is an **eight**-site transaction. Site 8 is new: the
catalog's own prose count went stale when Phase 113 bumped the tuple.

| # | Artifact | Current state (verified) | Change |
|---|----------|--------------------------|--------|
| 1 | `REASONS` tuple tail + its header count | `shared/notify.ts:83` says "44-entry"; tail member is `"stale workflow command"` | append at the TAIL; bump to 45 |
| 2 | Topic-group home | `shared/notify-reasons.ts` `type UnsupportedReason` — a literal union holding `"requires pi-subagents"` and `"requires pi-mcp"` | append the literal after `"requires pi-mcp"`; `_ReasonsCoverageProof` is the compile gate |
| 3 | `notify-reasons.ts` module header count sentences | `:7` and `:14` both say "44-entry"; the header carries a bump narration ending "WLIF-06 appends `stale workflow command` … (43 to 44)" | bump both to 45 and extend the narration |
| 4 | Length pin (architecture) | `tests/architecture/notify-closed-set-locks.test.ts:29` (test TITLE names the count) and `:55` `assert.equal(REASONS.length, 44)` | bump title AND assertion to 45 |
| 5 | Enumeration pin | `tests/architecture/compat-01-no-expansion.test.ts:127-172` — hand-written 44-member list, order-significant, tail `"stale workflow command"` | append at the END |
| 6 | Second length assertion | `tests/shared/notify.test.ts:5008` `assert.equal(REASONS.length, 44)` | bump to 45 |
| 7 | Catalog byte gate | `docs/output-catalog.md` state(s) + `tests/architecture/catalog-uat.test.ts` fixture(s) + the exact-count assertion at `:5493-5501` (currently **192**) | add 2 paired states; bump 192 -> 194 in BOTH the comment and the message string |
| 8 | **Catalog prose count (currently STALE)** | `docs/output-catalog.md:63` reads "The **43**-member … `REASONS` tuple defines the closed set." The tuple has been 44 since Phase 113. | correct to 45; say so in the plan's action sentence so a reviewer does not read the delta as this phase's bug |

`tests/shared/notify-reasons.test.ts:47-48` carries a type-level
`_ReasonsCoverageProof extends [never, never]` pin. It needs **no edit** (it is a proof,
not a count) but it is a second independent reader that goes red on a member with no
topic-group home — useful as one arm of the removal experiment.

`tests/architecture/cross-surface-reason-parity.test.ts` enumerates resolver-note ->
reason mappings per surface, not the reason SET; a token with no note behind it does not
appear there. Verified unchanged in shape.

### Also stale, outside every gate (prose sweep, cheap and in scope)

| File:line | Current text | Why it is wrong |
|---|---|---|
| `docs/output-catalog.md:63` | "The 43-member … `REASONS` tuple" | tuple is 44 (site 8 above) |
| `docs/output-catalog.md:69` | names only `requires pi-subagents` and `requires pi-mcp` | must name the third marker |
| `docs/messaging-style-guide.md:28` | ``export type Dependency; // "agents" \| "mcp", derived from DEPENDENCIES tuple`` | the tuple was deleted; the union is the declaration site |
| `docs/messaging-style-guide.md:61` | "`DEPENDENCIES` — the closed set of 2 soft-dependency probe targets" | tuple deleted AND 2 -> 3 |
| `docs/messaging-style-guide.md:67` | "REQUIRED only on `installed \| updated \| reinstalled \| present` … The other 12 variants" | `present` is a retired status; there are 19 statuses |
| `docs/messaging-style-guide.md:84, 166-167` | enumerate the two probes / two markers | extend |

`docs/open-closed-proof.md:56` already reflects the tuple deletion correctly — no change
needed there.

## Catalog Amendment (WDOC-02)

### How the gate works, mechanically

`tests/architecture/catalog-uat.test.ts` reads `docs/output-catalog.md` at test time,
walks it line by line, arms on a `## \`/claude:plugin <verb>\`` H2 and on a
`<!-- catalog-state: STATE -->` comment (regex `CATALOG_STATE_RE` at `:99`), pairs each
`(section, STATE)` with the NEXT fenced block, looks the pair up in the `FIXTURES` map
(`:364`), renders `notify(mockCtx, mockPi, fixture.message)` and asserts byte equality.
The walk is **bidirectional**: an unmatched catalog annotation fails, and an orphan
FIXTURES entry fails (`:5635`). An exact-count assertion (`:5497`, currently 192) stops a
parser refactor from silently reading a fraction of the corpus.

### What a catalog state entry looks like

Doc side [VERIFIED: `docs/output-catalog.md:537-550`]:

````markdown
### Success with orphan-rewake AND a soft-dep marker in the same brace

<!-- catalog-state: success-with-orphan-rewake-and-soft-dep -->

```text
A plugin operation needs attention.

● official [user]
  ● helper v1.0.0 (installed) {orphan rewake, requires pi-subagents}

/reload to pick up changes
```

<explanatory paragraph naming the decision IDs>
````

Fixture side [VERIFIED: `tests/architecture/catalog-uat.test.ts:1156-1178`]:

```ts
    "success-with-orphan-rewake-and-soft-dep": {
      pi: piWithMcpLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },
```

### The two states to add

Both under `## \`/claude:plugin install <plugin>@<marketplace>\``, as siblings of
`success-with-soft-dep` (`docs/output-catalog.md:509-520`):

1. `success-with-workflow-engine-absent` — `dependencies: ["workflows"]`, engine-absent
   probe, `severity: "warning"`, `expectedSeverity: "warning"` (so the
   `A plugin operation needs attention.` summary line renders).
2. A composed-brace state pinning marker ORDER — `dependencies: ["agents", "workflows"]`
   under a probe with neither loaded, rendering
   `{requires pi-subagents, requires pi-dynamic-workflows}`. This is the byte-order
   guarantee that replaces the deleted `DEPENDENCIES` tuple index, per the CONTEXT.

Bump the exact-count assertion 192 -> 194, in the comment AND the message string.

### The probe-fixture naming problem (measured; bigger than Phase 105 assumed)

`piWithBothLoaded()` returns `[{ name: "subagent" }, { name: "mcp" }]`
[VERIFIED: `catalog-uat.test.ts:212-216`; the same helper exists independently at
`tests/shared/notify.test.ts:67-71`]. Once the third probe field exists, that helper
reports the engine ABSENT while its name and doc comment say "no soft-dep markers fire".

**Call-site counts, measured:** `piWithBothLoaded()` appears **186** times in
`catalog-uat.test.ts` and **116** times in `notify.test.ts` — 302 sites. Phase 105
recommended a rename without measuring this.

Three options, for the planner:

| Option | Cost | Risk |
|---|---|---|
| **A.** Add `{ name: "workflow_control" }` to `piWithBothLoaded()`'s body and rename it `piWithAllLoaded()` | 302 mechanical call-site edits (sed-able) + 2 doc comments | Low. No existing fixture declares `workflows`, so the added tool changes zero bytes — but VERIFY by running `catalog-uat.test.ts` immediately after the probe lands and before any fixture edit. |
| **B.** Add the tool to `piWithBothLoaded()` and rewrite only its doc comment | 2 edits | The name says "both" over three tools. Cheap now, misleading later. |
| **C.** Leave `piWithBothLoaded()` alone; add `piWithAllLoaded()` and `piWithoutWorkflowEngine()` for new fixtures | 2 files, ~6 lines | `piWithBothLoaded`'s "no soft-dep markers fire" comment becomes conditional and stays that way. |

Recommend **A** if the sweep is acceptable, else **B** with the comment restated as a
present-tense fact. Do not pick C: it leaves a lying name in 302 places.

## Proving criterion 2 and WDEP-03

Three layers; layers 1-2 are in `npm run check`, layer 3 does not exist on this tree.

**Layer 1 — the byte-comparison test (the criterion-2 deliverable).** Install one fixture
twice, differing only in the fake tool list, and compare envelope bytes.

Everything the test needs already exists in `tests/orchestrators/plugin/install.test.ts`:
- `makeCtx({ toolNames: [...] })` builds the fake `pi` [VERIFIED: `:293-310`]
- `withHermeticHome(fn)` isolates `$HOME` [VERIFIED: `:312-330`]
- `writeWorkflowScripts(pluginRoot, workflows)` plants `<pluginRoot>/workflows/<name>.js`
  [VERIFIED: `:408-431`], already used by the phase's existing cases (the file mentions
  `workflow` 127 times)
- envelope target: `<workflowsSavedDir>/<generatedName>.json` [VERIFIED:
  `persistence/locations.ts:169-179`], `workflowsSavedDir` = `~/.pi/workflows/saved/` for
  user scope [VERIFIED: `locations.ts:116-126`]

**Non-vacuity is mandatory.** Two agreeing runs prove nothing unless the engine-absent run
actually degraded:

```ts
assert.equal(withoutEngine.envelopeBytes, withEngine.envelopeBytes);
assert.deepEqual(withoutEngine.record.resources.workflows, withEngine.record.resources.workflows);
// Non-vacuity: without the engine the row MUST carry the marker...
assert.match(withoutEngine.message, /\{[^}]*requires pi-dynamic-workflows[^}]*\}/);
// ...and with it, the WHOLE rendered block must be the clean form.
assert.doesNotMatch(withEngine.message, /requires pi-dynamic-workflows/);
```

**Layer 2 — the boundary gate.** `bridges/workflows/**` currently references no probe
symbol at all [VERIFIED: `grep -rn "softDepStatus\|SoftDepStatus\|hasLoaded" extensions/pi-claude-marketplace/bridges/`
returns nothing], and `prepareStageWorkflows` takes a `StageWorkflowsInput` with no `pi`
[VERIFIED: `bridges/workflows/types.ts:112-120`]. The install ledger's workflows phase
likewise reads no probe [VERIFIED: `install.ts:1200-1240`]. Encode that as an
`assertNoForbiddenSurface` clause over `bridges/workflows/*.ts` (plus the ledger phase
file) forbidding `softDepStatus` / `SoftDepStatus` / `hasLoadedWorkflowEngine` /
`workflowEngineLoaded`. This is the cheapest guard against the one regression that would
break WDEP-03.

**Layer 3 — the live canary DOES NOT EXIST on this tree.** `tests/live-uat/` holds only
`manifest-absence-canary.mjs`, `stop-canary.mjs` and `README.md`
[VERIFIED: `ls tests/live-uat/`]. `workflow-storage-canary.mjs`, which Phase 105's
research recommended extending, is not here. **Do not plan an extension to a file that
does not exist.** Spike 027 already re-drove the equivalent probes against 3.10.1 out of
tree and recorded "hand-planted envelope found by `storage.list()` — holds, all three
tiers" with a negative control. That is the evidence; cite Spike 027 rather than
re-manufacturing a canary.

## Engine facts, re-verified at 3.10.1

Everything below was read this session from the unpacked
`@quintinshaw/pi-dynamic-workflows@3.10.1` tarball, and cross-checked against
`.planning/spikes/027-workflow-engine-3-10-1-recheck/README.md`.

### Numbers that CHANGED since the archived Phase 105 doc — do not ship the old ones

| Claim | Phase 105 (3.5.1) | Today (3.10.1) | Evidence |
|---|---|---|---|
| Engine version / date | 3.5.1, 2026-08-05 | **3.10.1, 2026-09-03** | [VERIFIED: `npm view … version time.modified`] |
| Published releases | "50 since May 2026" | **57 versions** | [VERIFIED: `npm view … versions --json`] |
| `parseWorkflowScript` refusal checks | "seven gates" | **nine checks** | [VERIFIED: `src/workflow.ts:1504-1573`] + [CITED: Spike 027] |
| Checks the bridge replicates | "one (determinism)" | **two (determinism + parse)** | [CITED: Spike 027 table rows 1-2] |
| Extension entry file | `extensions/workflow.ts` | **`src/pi-extension.ts`** | [VERIFIED: `src/pi-extension.ts:173-174`] |
| Rejected engine version | `@nicknisi/pi-workflows@0.2.2` | **0.3.1** | [VERIFIED: `npm view`; tarball read] |
| Engine peer floor | not stated | **`pi-coding-agent >=0.80.8`, `pi-tui >=0.80.6`** | [VERIFIED: `npm view @quintinshaw/pi-dynamic-workflows@3.10.1 peerDependencies`] |

### The probe target (WDEP-01) — both engines re-read

`@quintinshaw/pi-dynamic-workflows@3.10.1` registers both tools
[VERIFIED: `package/src/pi-extension.ts:173-174`]:

```ts
  pi.registerTool(workflowTool);
  pi.registerTool(workflowControlTool);
```

with the names as literals [VERIFIED: `package/src/workflow-control-tool.ts:76` ->
`name: "workflow_control"`; `package/src/workflow-tool.ts:174` -> `name: "workflow"`].

`@nicknisi/pi-workflows@0.3.1` registers exactly one tool
[VERIFIED: `package/index.ts:336-337`]:

```ts
  pi.registerTool({
    name: 'workflow',
```

A scan of every `name: '<literal>'` in that package yields `autoimplement`, `autoplan`,
`bake_off`, `demo`, `dispatch`, `engine`, `gates`, `lanes`, `research`, `workflow`. **No
`workflow_control`.** The false positive is real at today's versions.

### The nine refusal checks (WDOC-01's divergence table)

[VERIFIED: `package/src/workflow.ts:1504-1573`, read verbatim this session]

| # | Check | Engine's refusal message | Bridge today |
|---|---|---|---|
| 1 | `DETERMINISM_BLOCKLIST.test(script)` over RAW TEXT | "Workflow scripts must be deterministic: Date.now()/Math.random()/new Date() are unavailable" | **replicates** |
| 2 | `parse(script, …)` (acorn) | acorn `SyntaxError` | **replicates** |
| 3 | first statement is `ExportNamedDeclaration` | "\`export const meta = { name, description, phases }\` must be the first statement in the script" | no |
| 4 | declaration is a `const` `VariableDeclaration` | "meta export must be \`export const meta = ...\`" | no |
| 5 | exactly one declarator | "meta export must declare only \`meta\`" | no |
| 6 | declarator id is `Identifier` named `meta` | "meta export must declare \`meta\`" | partly |
| 7 | `declarator.init` present | "meta must have a literal value" | partly |
| 8 | `evaluateLiteral(declarator.init, "meta")` | e.g. "template interpolation not allowed in meta.name" | partly, falls back to the stem |
| 9 | `validateMeta(meta)` | see below | name only |

**Order matters and is counter-intuitive:** determinism runs BEFORE the parse, so a script
that is both nondeterministic and unparseable reports the determinism failure.

The blocklist regex is byte-unchanged from 3.5.1
[VERIFIED: `package/src/workflow.ts:402`]:

```ts
const DETERMINISM_BLOCKLIST = /\bDate\s*\.\s*now\b|\bMath\s*\.\s*random\b|\bnew\s+Date\s*\(\s*\)/;
```

**A discrepancy the docs must not inherit.** Spike 027 states "`validateMeta` alone
carries four messages, for twelve refusal messages in all." Read verbatim at 3.10.1,
`validateMeta` throws **six** distinct messages
[VERIFIED: `package/src/workflow.ts:1611-1626`]:

```ts
function validateMeta(meta: unknown): asserts meta is WorkflowMeta {
  if (!meta || typeof meta !== "object") throw new Error("meta must be an object");
  const value = meta as WorkflowMeta;
  if (typeof value.name !== "string" || !value.name.trim()) throw new Error("meta.name must be a non-empty string");
  if (typeof value.description !== "string" || !value.description.trim())
    throw new Error("meta.description must be a non-empty string");
  if (value.model !== undefined && typeof value.model !== "string") throw new Error("meta.model must be a string");
  if (value.phases !== undefined) {
    if (!Array.isArray(value.phases)) throw new Error("meta.phases must be an array");
    for (const phase of value.phases) {
      if (!phase || typeof phase !== "object" || typeof (phase as WorkflowMetaPhase).title !== "string") {
        throw new Error("each meta phase must have a title string");
      }
    }
  }
}
```

**Recommendation:** the doc states the **nine checks** (a number both this session's read
and Spike 027 agree on) and does NOT restate a total message count. Check 2's message is
acorn's, which is not enumerable. If the planner wants a message count, it is 8 fixed
messages from checks 1 and 3-8, plus 6 from `validateMeta`, plus acorn's variable text —
neither "twelve" nor any single number is honest. Flag this to the operator; do not
silently pick one.

**`meta.description` is a live gap** (Spike 027's own finding): the engine requires a
non-empty string, the bridge never checks it, and the envelope carries `description` as a
field filled from `meta`. A Claude script with no `meta.description` installs, registers a
command, and dies at first invocation. It belongs in the admit-versus-run table as a
divergence; the WARNING for it is Phase 115's (WGATE-01), not this phase's.

### The sandbox comparison — grades differ per row

Spike 027 re-drove ONE sandbox row at 3.10.1 ("no `process.env`, no `require` — holds").
The other rows carry the Spike 022a/009b grade. Source reads at 3.10.1 corroborate two
more. State the grades separately:

| Probe | quintinshaw | nicknisi | Grade at 3.10.1 |
|---|---|---|---|
| `process` own keys | `cwd` (frozen stub) | real host `process` | source-read [VERIFIED: `src/workflow-capability-contract.ts:457` -> `runtimeGlobal("process", { signature: "process: { cwd(): string }" })`] |
| `process.env` | `undefined` | object, 60 vars | **runtime-measured at 3.10.1** [CITED: Spike 027] |
| `process.binding('fs')` | TypeError | real fs internals | measured at 3.5.1 only [CITED: workflows-bridge.md:198] |
| Function-constructor escape | no escape | host realm | measured at 3.5.1; corroborated by source [VERIFIED: `src/workflow.ts:1399-1405`, whose own comment says host built-ins are deliberately not injected because "`.constructor` would be the host Function (a determinism-guard bypass)"] |
| clock / RNG | rejected pre-parse **AND neutered in-realm** | live values | **refinement at 3.10.1**: `DETERMINISM_PRELUDE` [VERIFIED: `src/workflow.ts:417-434`] replaces `Math.random` and `Date` inside the realm, so there are TWO layers, not one |

`vm.createContext` + `runInContext` is unchanged [VERIFIED: `src/workflow.ts:1399, 1409`].

### `agent()` failure semantics — the grade that holds TODAY

Claude's `agent()` resolves to `null` on failure with a documented `pipeline(...)` +
`.filter(Boolean)` pattern. The host counterpart:

- `@nicknisi`: **runtime-measured** — throws.
- `@quintinshaw`: **source-read only** — every failure branch in `agentImpl` throws.
  **NOT driven at runtime**, because that needs real spawn machinery
  [CITED: Spike 027, "agent() failure semantics stay unmeasured … keeps its source-read
  grade. Unchanged from 3.5.1"].

Write those two grades as two grades. Phase 117 (WEVID-01/02) owns the upgrade; this
phase must not pre-state it.

### WDEP-03's mechanism at 3.10.1

- `pi.on("session_start", …)` [VERIFIED: `src/pi-extension.ts:252`]
- `registerAllSavedWorkflows(...)` [VERIFIED: `src/saved-commands.ts:119`]
- `storage.list()` is a plain directory walk [VERIFIED: `src/workflow-saved.ts:287`]

No index, no install-time registration hook, no engine API call. An envelope already on
disk is picked up on the next session start regardless of who wrote it or when.

### Upstream stability warning (mandatory in the doc)

The envelope shape, the cwd-key derivation, the saved-directory layout and the name
validator are private internals of a 0.x package with **57 published versions** and no
exported contract. There is no env-var override and no settings knob to relocate storage.
Two more facts from Spike 027 worth carrying: the engine depends on `acorn ^8.16.0` (the
same range this bridge declares, for the same job), and at 3.10.1 `runWorkflow` reaches
`@earendil-works/pi-server` transitively — a probe-only concern, since the bridge never
calls `runWorkflow`.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Detecting the host engine | a `require.resolve` / filesystem probe | `pi.getAllTools()` name predicate in `platform/pi-api.ts` | The question is "is the extension LOADED in this session", not "is the package installed" |
| Rendering the marker | pushing the token into `reasons[]` at the orchestrator | `dependencies: [..., "workflows"]` + render-time `composeReasons` | D-16-15: markers are computed by the renderer, never caller-placed |
| Deciding severity | an inline ternary at each row composer | `companionSeverity(...)` | One producer-local classifier already exists |
| Marker ordering in the brace | hand-ordering pushes per site | append LAST in `softDepMarkers` + the two byte-pinned catalog states | The join is byte-critical; the catalog is the order authority now that the tuple is gone |
| A second closed-set completeness check | a runtime assertion | the existing `_ReasonsCoverageProof` | A literal added to `REASONS` without a topic-group home is already a TS2344 |
| A `bridges/workflows` purity grep | a bespoke scanner | `assertNoForbiddenSurface` from `tests/architecture/source-scan.ts` | Its WR-06 rule makes a missing target FAIL rather than silently pass |
| A live workflow canary | a new `.mjs` driver | cite Spike 027 | The re-measurement is already done, with a negative control |

## Common Pitfalls

### Pitfall: shipping the "seven gates / we replicate one" figure

**What goes wrong:** the doc states a gate count that is wrong in both directions. The
ROADMAP says seven, WGATE-02 says six, the archived Phase 105 research says seven, and
the CONTEXT's own decision text says "the first of the engine's `parseWorkflowScript`
gates". At 3.10.1 there are **nine** checks and the bridge replicates **two**.
**How to avoid:** state nine and two, cite 3.10.1 and Spike 027, and note the check order
(determinism before parse).
**Warning sign:** the literal string "seven gates" in the new doc.

### Pitfall: the token spelling names the rejected engine

**What goes wrong:** `requires pi-workflows` ships — the npm name of the engine this
milestone refused on trust grounds.
**How to avoid:** `requires pi-dynamic-workflows`, with the rationale in the
`SOFT_DEP_MARKER_WORKFLOWS` doc comment so a future rename does not undo it.
**Warning sign:** any diff introducing `pi-workflows` without `dynamic`.

### Pitfall: inserting the new REASONS member next to its two siblings

**What goes wrong:** the member goes after `"requires pi-mcp"` (index 12) because it reads
better. That reorders 32 members and reddens the COMPAT-01 enumeration pin against a
correct-looking tuple.
**How to avoid:** append at the TAIL, after `"stale workflow command"`. The brace order is
set by `softDepMarkers`'s push order, not by tuple index — the two are independent.

### Pitfall: an optional-defaulted `declaresWorkflows`

**What goes wrong:** 14 of the 19 `composeReasons` sites want `false`, so a default feels
free. It compiles everywhere and visits nothing, and the 5 sites that matter are the ones
you find BY the errors at the 14 that do not.
**How to avoid:** required. Same for `SoftDepStatus.workflowEngineLoaded` (111 test
literals) and the outcome types' `declaresWorkflows`.

### Pitfall: `Parameters<typeof composeReasons>[3]` silently changes meaning

**What goes wrong:** `tests/shared/notify.test.ts:4923` extracts the probe type by
POSITION. Inserting the fourth boolean makes `[3]` resolve to `boolean`, and every probe
literal in that suite then type-checks against the wrong thing.
**How to avoid:** grep for `Parameters<typeof composeReasons>` before touching the
signature; it is one site today.

### Pitfall: `piWithBothLoaded()` becomes a lie in 302 places

**What goes wrong:** after the third probe field lands, every fixture using that helper
runs with the engine ABSENT while its name and comment claim "no soft-dep markers fire".
The suite stays green (no fixture declares `workflows` yet), so the drift is invisible
until the first workflows fixture mysteriously fires a marker.
**How to avoid:** decide Option A/B/C in §Catalog Amendment in the same task that adds the
probe, and run `catalog-uat.test.ts` immediately after the probe lands, before any fixture
edit, to confirm zero existing states moved.

### Pitfall: planning against `tests/live-uat/workflow-storage-canary.mjs`

**What goes wrong:** a task references a file that does not exist on this tree. Phase 105's
research recommended extending it; it is gone.
**How to avoid:** `ls tests/live-uat/` before writing the task. Cite Spike 027 instead.

### Pitfall: a new doc citing a `tests/...` path that does not resolve

**What goes wrong:** `tests/architecture/no-stale-test-citations.test.ts` policies
`docs/**` `.md` prose: every `tests/...` path named must exist on disk.
`docs/adr/`, `docs/research/` and `docs/plans/` are excluded; a new
`docs/workflows-compatibility.md` is **not**.
**How to avoid:** cite only suites that exist at commit time, and land the doc after the
suites it names.

### Pitfall: a grep-driven sweep edits `orchestrators/plugin/info.ts`

**What goes wrong:** `info.ts` uses `dependencies` for the Claude plugin manifest's own
`dependencies` declaration (backlog PDEP-01), an unrelated concept.
**How to avoid:** sweep for the `Dependency` TYPE and the `declaresAgents` identifier.
**Warning sign:** `info.ts` in the changed-file list.

### Pitfall: the catalog prose count looks like this phase's bug

**What goes wrong:** `docs/output-catalog.md:63` says "43-member" against a 44-member
tuple. A reviewer sees a wrong number in this phase's diff neighbourhood.
**How to avoid:** correct it to 45 in the same commit and name it in the action sentence.

## Code Examples

### The probe (WDEP-01)

```ts
// platform/pi-api.ts
export interface SoftDepStatus {
  piSubagentsLoaded: boolean;
  piMcpAdapterLoaded: boolean;
  workflowEngineLoaded: boolean;
}

/**
 * WDEP-01: the `@quintinshaw/pi-dynamic-workflows` host engine is loaded iff
 * `pi.getAllTools()` contains a tool named "workflow_control". The engine
 * registers BOTH `workflow` and `workflow_control`; `@nicknisi/pi-workflows`
 * registers only `workflow`, so probing the bare name would report a different
 * engine as the host. Probe failures degrade to unloaded.
 */
export function hasLoadedWorkflowEngine(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "workflow_control");
  } catch {
    return false;
  }
}
```

### The discriminating test (the one that matters)

`tests/platform/pi-api.test.ts` already has `extensionApiWithTools(tools)`
[VERIFIED: `:27-29`], so the fixture cost is zero.

```ts
// INSUFFICIENT on its own -- a bare `workflow` probe passes this pair too.
assert.equal(hasLoadedWorkflowEngine(extensionApiWithTools([{ name: "workflow_control" }])), true);
assert.equal(hasLoadedWorkflowEngine(extensionApiWithTools([])), false);

// The case that proves the requirement: the @nicknisi/pi-workflows session shape.
assert.equal(hasLoadedWorkflowEngine(extensionApiWithTools([{ name: "workflow" }])), false);
// And the quintinshaw shape, which registers BOTH -- proving the probe SELECTS on the
// discriminator while the decoy is present, not merely rejects an absent name.
assert.equal(
  hasLoadedWorkflowEngine(
    extensionApiWithTools([{ name: "workflow" }, { name: "workflow_control" }]),
  ),
  true,
);
```

### The marker, appended LAST

```ts
// shared/concerns/soft-dep.ts
export type Dependency = "agents" | "mcp" | "workflows";

/**
 * WDEP-04: the host workflow engine `@quintinshaw/pi-dynamic-workflows`.
 * Deliberately NOT spelled `pi-workflows` -- that is the npm name of
 * `@nicknisi/pi-workflows`, a different engine, so the short form would point
 * the operator at the wrong package to install.
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

  // Appended LAST: the brace join is byte-critical and this order is what the
  // two catalog states pin.
  if (declaresWorkflows && !probe.workflowEngineLoaded) {
    markers.push(SOFT_DEP_MARKER_WORKFLOWS);
  }

  return markers;
}
```

### The `Dependency` union pin (the existing lock, extended)

[VERIFIED: `tests/shared/concerns/soft-dep.test.ts:9-12`]

```ts
void ("agents" satisfies Dependency);
void ("mcp" satisfies Dependency);
void ("workflows" satisfies Dependency);   // <- add
// @ts-expect-error Dependency excludes unknown companion targets
void ("hooks" satisfies Dependency);
```

This is the union's existing lock. It is what the CONTEXT means by "the byte-order
guarantee is delivered by the catalog states instead" — the union has a membership pin
already; it never had an order pin, and does not need one.

### The install-row derivation (site 1 of 7)

```ts
// orchestrators/plugin/install.ts, composeInstalledRow
const declaresWorkflows = installCtx.stagedWorkflowNames.length > 0;
…
// WDEP-02: a staged workflow declares the host engine. The envelope is written
// whether or not the engine is loaded -- the marker reports that nothing runs
// it yet, and the engine's own session_start storage scan picks it up on the
// next reload with no reinstall (WDEP-03).
if (declaresWorkflows) {
  dependencies.push("workflows");
}
```

`installCtx.stagedWorkflowNames` already exists [VERIFIED: `install.ts:378, 1235, 1343`].

## Runtime State Inventory

Not a rename or migration phase, but the closed sets it grows have on-disk and byte-gated
mirrors, so every category is answered explicitly.

| Category | Items found | Action required |
|---|---|---|
| Stored data | **None.** `state.json` already carries `resources.workflows`; the reason token and the probe are render-time only and never persisted. No schema change, no migration. | none |
| Live service config | **None.** No external service holds any of these strings. | none |
| OS-registered state | **None from this phase.** The host engine registers commands at its own `session_start`; this repo registers nothing new. | none |
| Secrets / env vars | **None.** `PI_WORKFLOW_ENGINE_ROOT` is a spike-only variable and is not read by this tree's tests. | none |
| Build artifacts | **None.** No build step, no dependency-manifest change, no `EXTENSION_VERSION` change (version bump is milestone-close work). | none |
| Byte-gated documents | `docs/output-catalog.md` under `catalog-uat.test.ts`; prose counts in `messaging-style-guide.md` covered by no test | additive amendment + prose sweep |

## Validation Architecture

`workflow.nyquist_validation` is `true` [VERIFIED: `.planning/config.json`].

### Test framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node >= 20.19.0 builtin), no external runner, no config file |
| Quick run command | `node --test "tests/platform/pi-api.test.ts"` (single suite) |
| Full suite command | `npm run check` |

**`npm run check` is longer than `.planning/codebase/STACK.md` records.** Verbatim
[VERIFIED: `package.json:77`]:

```
npm run typecheck && npm run lint && npm run fallow && npm run format:check &&
npm run test:corresponding && npm run test:corresponding:negative &&
npm run test:coverage:direct:negative && npm test && npm run test:integration
```

Unit glob [VERIFIED: `package.json:83`]:
`tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts` plus `tests/index.test.ts`.
**`docs` is NOT in the glob** and `tests/docs/` does not exist. A new test directory would
redden `tests/architecture/unit-suite-glob-completeness.test.ts`, which cross-checks the
scripts' globs against a recursive walk of `tests/`. Put new suites in existing
directories.

`tests/architecture/` is exempt from the file-pairing gate
[VERIFIED: `scripts/check-corresponding-tests.mjs:10` — `const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration"]);`],
so the criterion-3 gate needs no paired production module.

### Success criteria -> validation map

| Criterion | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| 1 | `Dependency` union carries `"workflows"` | typecheck | `npm run typecheck` (`satisfies` pin) | ✅ extend `tests/shared/concerns/soft-dep.test.ts` |
| 1 | every marker-rendering surface renders `requires pi-dynamic-workflows` | architecture | `node --test tests/architecture/<new>.test.ts` | ❌ Wave 0 |
| 1 | `workflow_control` present -> loaded | unit | `node --test tests/platform/pi-api.test.ts` | ✅ extend |
| 1 | bare `workflow` only -> NOT loaded (**the discriminating case**) | unit | same | ❌ Wave 0 (new case, existing harness) |
| 1 | both tools present -> loaded (decoy does not defeat the discriminator) | unit | same | ❌ Wave 0 |
| 1 | throwing `getAllTools()` -> false | unit | same | ✅ extend |
| 2 | install with engine absent still writes envelopes and succeeds | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ extend |
| 2 | **envelope bytes identical across the two probe states, with non-vacuity** | unit | same | ❌ Wave 0 |
| 2 | `bridges/workflows/**` + the ledger phase reference no probe symbol | architecture | `node --test tests/architecture/<gate>.test.ts` | ❌ Wave 0 (`assertNoForbiddenSurface` exists) |
| 3 | one case per derivation site; **negative control run and recorded** | architecture | the new gate | ❌ Wave 0 |
| 4 | doc exists, states the nine checks and the two replicated, cites 3.10.1 + Spike 027 | manual | reviewer read | — |
| 4 | every `tests/...` path the doc cites resolves | architecture | `node --test tests/architecture/no-stale-test-citations.test.ts` | ✅ existing, auto-covers |
| 5 | this project's floor stays `>=0.80.5` | architecture | `node --test tests/architecture/peer-floor.test.ts` | ✅ existing (`FLOOR-01`) |
| 5 | the engine's floor is documented as distinct | manual | reviewer read | — |
| 6 | non-string `workflows` still resolves `unavailable` | unit | `node --test tests/domain/resolver.test.ts` | ✅ existing, stays green; only its prose changes |
| 7 | whole gate | full | `npm run check` | ✅ |
| WDOC-02 | catalog state <-> fixture byte equality, both walks | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ extend |
| WDOC-02 | two-marker brace order byte-pinned | architecture | same (second catalog state) | ❌ Wave 0 |
| WDEP-04 | `REASONS.length === 45`, enumeration equality, coverage proof | architecture + typecheck | `notify-closed-set-locks`, `compat-01-no-expansion`, `npm run typecheck` | ✅ bump |

### The negative control for criterion 3's gate

The gate's claim is "every `Dependency[]` derivation site stamps `workflows`". A gate that
reads seven sites but only exercises two is green over five it never touched. The control:

1. Pick one Tier C site (`install.ts`, `list.ts` or `import/execute.ts`) — the ones most
   likely to be reached vacuously.
2. Delete its `dependencies.push("workflows")` arm.
3. Run the gate. **Exactly one case must redden**, and the failure message must name that
   site.
4. Restore, re-run, confirm green.
5. Paste the failing output into the SUMMARY.

Two failure modes this catches that a green run does not: a case whose drive function
never actually stages a workflow (so the row has no `workflows` in `dependencies` either
way, and the assertion is vacuous), and a case that asserts on a shared composer rather
than on its own site's derivation (so one deletion reddens several cases, or none).

If budget allows, repeat for all seven. If not, do the one and say in the SUMMARY which
six were not individually controlled — an unstated partial control is how this milestone
already shipped two guards that checked nothing.

### Sampling rate

- **Per task commit:** the single suite the task touched.
- **Per wave merge:** `npm run typecheck && npm run lint && npm test`.
- **Phase gate:** `npm run check` green.

### Wave 0 gaps

- [ ] `tests/architecture/<new>.test.ts` — the seven-site marker-coverage gate (criterion 3)
- [ ] A `bridges/workflows` probe-purity clause (criterion 2, layer 2)
- [ ] `tests/orchestrators/plugin/install.test.ts` — the byte-comparison pair with
      non-vacuity (criterion 2)
- [ ] `tests/platform/pi-api.test.ts` — the discriminating `workflow`-without-
      `workflow_control` case
- [ ] Two paired catalog states + fixtures; exact-count 192 -> 194
- [ ] The `piWithBothLoaded` decision (Option A/B/C), applied in the same task as the probe

## Security Domain

`security_enforcement` is not `false` in config, so the section is included. Narrow
surface: a render-time marker, a doc, and a confirmed premise.

### Applicable ASVS categories

| ASVS Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | no | no auth surface touched |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (marginal) | the probe compares `tool.name` against a closed literal; no interpolation, no path, no user input |
| V6 Cryptography | no | — |
| V7 Error handling / logging | yes | the probe's `catch { return false; }` must NOT log or surface the caught error — matches both existing probes |

### Known threat patterns

| Pattern | STRIDE | Mitigation |
|---|---|---|
| Path or name leakage through a rendered reason token | Information disclosure | The token is a fixed closed-set literal with zero interpolation. Keep it literal; never interpolate a plugin, workflow or path name into it. |
| A false-positive probe reporting an untrusted engine as the host | Elevation of privilege (indirect) | WDEP-01's entire purpose. Note that the probe does not GATE writing — artifacts are written regardless (WDEP-02) — so a false positive misreports rather than mis-writes. Say so in the docs. |
| The docs understating the executable-code risk | informational integrity | WDOC-01 is itself the control. The sandbox comparison is the load-bearing content; do not soften it, and do not let a 3.5.1-grade row pass as a 3.10.1 measurement. |
| A dependency-manifest change smuggled in with the docs | Supply chain | No `package.json` / `package-lock.json` change is in scope. `acorn` is already declared; a re-declaration or a version bump is a review finding. |
| A doc that names a package the user should install | Supply chain (typosquat adjacency) | `pi-workflows` and `pi-dynamic-workflows` are two real, different packages. Every install instruction in the doc and both READMEs must name the scoped form `@quintinshaw/pi-dynamic-workflows`. |

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| `DEPENDENCIES` runtime tuple in `soft-dep.ts` | `type Dependency = "agents" \| "mcp"` literal union | main, post-Phase-105 | Criterion 1's "third member" reads onto the union; no tuple to grow, no order lock to add |
| `REASONS` had 43 members | 44, tail `"stale workflow command"` | Phase 113 | this phase appends the 45th; the catalog's prose count was left at 43 and is stale |
| `composeReasons` had 31 call sites | 19, in 4 files | tree evolution | the sweep is a third the size Phase 105 planned for |
| Engine 3.5.1, "seven gates" | 3.10.1, **nine checks**, bridge replicates **two** | Spike 027 (2026-09) | every gate-count figure in the archived docs and in the ROADMAP is stale |
| `tests/live-uat/workflow-storage-canary.mjs` | does not exist on this tree | replay | do not plan an extension to it |
| `acorn` undeclared (WDOC-03 open) | declared `^8.16.0` in `dependencies` | Phase 110/111 | WDOC-03 is verification-only |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node.js | everything | ✓ | >= 20.19.0 per `engines` | — |
| npm registry access | engine fact re-verification | ✓ | — | Spike 027 (already transcribed here) |
| Claude Code binary | criterion 6 | ✓ | `2.1.251` at `/home/acolomba/.local/share/claude/versions/2.1.251` (also 2.1.236, 2.1.243) | the published docs page, already cited |
| `strings` (binutils) | criterion 6 | ✓ | — | `grep -a` with bounded windows |
| `@quintinshaw/pi-dynamic-workflows` | doc facts | ✗ locally; fetched out-of-tree this session | 3.10.1 on npm | this document + Spike 027 |
| `pre-commit` | commit hooks | assumed ✓ | — | none; `--no-verify` is forbidden |
| `spike-findings-pi-claude-marketplace` skill | evidence base named by CONTEXT | **✗ NOT IN THIS WORKTREE** | — | it lives at `/home/acolomba/pi-claude-marketplace/.worktrees/workflows-spike/.claude/skills/spike-findings-pi-claude-marketplace/`; the sandbox-table rows are transcribed above so the planner needs no second read |

**Missing with no fallback:** none.

**Note for executors:** an unbounded `grep -oE '.{2600}...'` over the 405k-line strings
dump of the Claude binary times out at 180s. Use a Python/Node slice on the single big
line instead (the manifest schema is at byte offset ~12,525,546 of the dump; the loader at
line 367,536).

## Project Constraints (from CLAUDE.md)

- **Git:** never commit to `main`; never rebase or rewrite history; run
  `pre-commit run --all-files` BEFORE `git commit`; never `--no-verify`. From a worktree,
  prefix with `SKIP=trufflehog` only after a clean filesystem-mode trufflehog scan
  (`--results=verified,unknown --fail`) of the paths being committed.
- **Commit messages / PR titles:** Conventional Commits, title 5-72 chars, body lines
  <= 80. **No GSD milestone or phase mentions.**
- **Comments and test titles:** no `Phase NN` / `Plan NN` / `Wave N` / `Task N` /
  bare `Pitfall N`. Requirement and decision IDs (`WDEP-01`, `WDOC-01`, `SNM-06`,
  `D-16-15`, `MSG-SD-3`, `NFR-2`, `RH-3`) are the sanctioned anchors. Do not narrate code
  that no longer exists.
- **Broken Windows ledger:** prefix every `windows append` description with
  `[workflows-replay]`.
- **Output channel (IL-2):** all user-visible output through `shared/notify.ts`.
- **Quality bar (NFR-6):** `npm run check` green — and it now includes `fallow`,
  `test:corresponding`, `test:corresponding:negative` and
  `test:coverage:direct:negative` as well as the two test suites.
- **Recovery model (NFR-2):** no fix may require a Pi restart; `/reload` must suffice.
  This phase's whole degradation story is an instance of it.
- **Style:** Prettier `printWidth: 100`, `trailingComma: "all"`; explicit return types on
  exported functions; `curly: all`; `sonarjs/cognitive-complexity: 15` AND fallow
  `maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60`, independently computed —
  green on one is not green on the other.
- **Markdown:** formatted by `mdformat` via pre-commit, NOT prettier.
  `npm run format:check` covers only `js,json,ts`. Never run `prettier --write` on
  `docs/*.md` or the READMEs.
- **Read before edit; trace callers before modifying a function.**
- **CodeGraph:** `.codegraph/` exists; prefer `codegraph explore "<symbols>"` over
  grep/find for code questions.
- **Versioning:** the bump is offered before a PR — explicitly deferred to milestone close
  by CONTEXT, so this phase touches neither `package.json` nor
  `sonar-project.properties` nor `CHANGELOG.md` nor `EXTENSION_VERSION`.
- **Project skills:** `simple-english` and `humanizer` are available at
  `.agents/skills/`. `docs/hooks-compatibility.md`'s register is denser than STE — match
  the sibling document, not the skill's default, unless the operator prefers otherwise.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Adding the third probe field changes ZERO existing catalog-state bytes (no existing fixture declares `workflows`) | §Catalog Amendment | If wrong, the byte gate fails on states this phase did not touch and the diff reads as a regression. **Verify empirically** by running `catalog-uat.test.ts` right after the probe lands, before any fixture edit. |
| A2 | `sonarjs/no-identical-functions` will not fire on the seven three-arm derivation copies | §Marker Plumbing | Unmeasured; it tolerates the two-arm copies today, and the three `renderPluginRow` arms are already near-identical. Budget a task for a named-helper extraction; do not reach for a disable directive. |
| A3 | `Option A` (rename `piWithBothLoaded` across 302 sites) is mechanically safe | §Catalog Amendment | A sed across two large test files is exactly the kind of change that silently rewrites a string inside a fixture. Prefer an editor-scoped rename and diff the result. |
| A4 | The `stagedWorkflows` name for the new `LedgerDegradationSignals` member | §Marker Plumbing Tier 3 | Naming only; mirrors `stagedAgents` / `stagedMcpServers`. |
| A5 | The compatibility doc should state nine checks and decline to state a total refusal-MESSAGE count | §Engine facts | Spike 027 says "twelve"; the verbatim source gives 8 fixed + 6 from `validateMeta` + acorn's variable text. Declining a total is honest; if the operator wants a number, it needs a stated counting rule. |
| A6 | Criterion 3's gate can reach all seven sites without a new export | §The seven derivation sites | Verified by reading each site's caller chain, but the three Tier C sites have not been *driven* in a prototype gate this session. If a Tier C drive turns out to need a seam, that is a finding about the surface (per CONTEXT), not a licence to export. |
| A7 | Upstream's `.js`-file `workflows` path is admitted by this project's resolver but may not be enumerated by the bridge | §Criterion 6 divergences | Not driven. If the bridge silently ignores a file target, that is a divergence the doc must name — see Open Questions. |

## Open Questions (RESOLVED)

All four were settled after this document was written. Each resolution lives in
`114-CONTEXT.md`'s `### Settled after research` block and is cited by label from the
plans; the pointers below are the trail, not a second copy.

1. **Does `discoverPluginWorkflows` handle a `workflows` component path that points at a
   `.js` FILE rather than a directory?** — **RESOLVED. See CONTEXT D-114-02.** Answered by
   reading the code at plan time: `bridges/workflows/discover.ts` reaches the filesystem
   through `shared/fs-utils.ts::readDirEntriesTolerant`, which returns `[]` on both
   `ENOENT` and `ENOTDIR`. An upstream-legal `.js` file target is therefore silently
   dropped — no throw, no warning. That is a documented install-time disposition for the
   compatibility doc, not a bug, so no Broken Windows entry is owed.
   - What we know: upstream's schema explicitly admits "a workflows directory **or .js
     file**"; `validateComponentPath` does not stat and accepts any contained relative
     string, so the path reaches the bridge.
   - What's unclear: whether the bridge's discovery walk treats a file target as an empty
     directory (silent drop) or errors.
   - Recommendation: read `bridges/workflows/discover.ts` at plan time. If it silently
     drops, that is a documented divergence for the compatibility doc's install-time
     disposition section, NOT a behavior change this phase makes. If it throws, it is a
     bug worth a Broken Windows entry.

2. **How many refusal MESSAGES should the divergence table claim?** — **RESOLVED. See
   CONTEXT D-114-03.** Nine checks, two replicated, the six `validateMeta` message shapes
   enumerated, and no single refusal-message total (check 2's message is acorn's and is not
   enumerable). Spike 027's "twelve" must not be repeated, and Spike 027's own record is
   corrected in the same change that publishes the doc.
   - What we know: nine checks; `validateMeta` throws six distinct messages; check 2's
     message is acorn's and is not enumerable.
   - Recommendation: state the nine checks and enumerate the six shapes the CONTEXT
     mandates. Escalate the "twelve" figure to the operator rather than repeating it or
     silently replacing it.

3. **Does the reinstall row's no-severity-raise asymmetry apply to workflows too?** —
   **RESOLVED. Yes; copy it.** CONTEXT's "Engine-independent bytes" area locks it: the
   asymmetry is an existing deliberate precedent and diverging from it here would make one
   component kind behave unlike the other five. Recorded as a decision so a reviewer does
   not read it as an oversight.
   - What we know: `reinstall` stamps severity from `reasons.length` alone and never calls
     `companionSeverity`; the catalog's reinstall soft-dep block carries no
     `needs attention` line, so the asymmetry is byte-pinned and deliberate.
   - Recommendation: copy it (CONTEXT locks this). Record it as a decision so a reviewer
     does not read it as an oversight.

4. **Does the criterion-3 gate assert on the rendered ROW or on the derived
   `Dependency[]`?** — **RESOLVED. The rendered ROW, at every site. See CONTEXT D-114-05.** All
   seven cases then prove the same end-to-end claim rather than seven different
   intermediate ones, and the negative control targets one of the three hard-to-reach
   sites, never an easy one.
   - What we know: Tier A/B sites hand back a `Dependency[]` or a message directly; Tier C
     sites hand back a rendered notification string.
   - Recommendation: assert on the RENDERED row for every case, so all seven prove the
     same end-to-end claim ("this surface renders the marker") rather than seven different
     intermediate ones. Claude's discretion per CONTEXT; state the choice in the plan.

## Sources

### Primary (HIGH confidence)

- **Claude Code 2.1.251 binary**, `/home/acolomba/.local/share/claude/versions/2.1.251`,
  read via `strings -n 8` this session: the plugin-manifest `workflows` schema definition,
  the plugin loader's `workflows` branch, the `Ue=!A.workflows&&fe` auto-load guard, the
  `folder-shadowed-by-manifest` diagnostic, and the parallel `agents` / `skills` /
  `outputStyles` / `themes` branches.
- **`@quintinshaw/pi-dynamic-workflows@3.10.1`** npm tarball, unpacked and read this
  session: `src/pi-extension.ts` (:173-174 tool registration, :252 `session_start`),
  `src/workflow-control-tool.ts` (:76), `src/workflow-tool.ts` (:174),
  `src/workflow.ts` (`DETERMINISM_BLOCKLIST` :402, `DETERMINISM_PRELUDE` :417-434,
  `vm.createContext` :1399-1409, `parseWorkflowScript` :1504-1573, `validateMeta`
  :1611-1626), `src/saved-commands.ts` (:119), `src/workflow-saved.ts` (:287),
  `src/workflow-capability-contract.ts` (:129, :457).
- **`@nicknisi/pi-workflows@0.3.1`** npm tarball, unpacked and read this session:
  `index.ts` (:336-337), plus a full scan of `name:` literals.
- `npm view` for both packages: versions, publish date, peer dependencies, dependencies,
  version count.
- **Repository sources read this session:** `platform/pi-api.ts`,
  `shared/concerns/soft-dep.ts`, `shared/notify-reasons.ts` (1-140),
  `shared/notify.ts` (80-205, 2255-2440, 2660-2740), `domain/resolver.ts` (340-380,
  920-1090, 1580-1660), `orchestrators/plugin/{install.ts,list.ts,shared.ts,update-row.ts,reinstall.messaging.ts}`,
  `orchestrators/import/execute.ts`, `orchestrators/reconcile/apply-outcomes.ts`,
  `orchestrators/types.ts`, `bridges/workflows/{stage.ts,types.ts}`,
  `persistence/locations.ts`, `tests/architecture/{catalog-uat,compat-01-no-expansion,notify-closed-set-locks,notify-stamp-coverage,peer-floor,no-stale-test-citations,partial-vocabulary-guard,unit-suite-glob-completeness}.test.ts`,
  `tests/architecture/source-scan.ts`, `tests/platform/pi-api.test.ts`,
  `tests/domain/resolver.test.ts` (1780-1835), `tests/shared/concerns/soft-dep.test.ts`,
  `tests/orchestrators/plugin/install.test.ts` (280-435),
  `docs/output-catalog.md` (45-70, 505-570, 876-885), `docs/hooks-compatibility.md`
  (structure), `docs/messaging-style-guide.md`, `README.md`, `README.es.md`,
  `package.json`, `.planning/config.json`, `scripts/check-corresponding-tests.mjs`.

### Secondary (MEDIUM confidence)

- [CITED: https://code.claude.com/docs/en/plugins-reference] — the published plugin.json
  component-path field table, fetched 2026-09-07. Primary for the CONTRACT; graded MEDIUM
  only because it was read through a fetch-and-summarize step rather than byte-for-byte.
  It agrees with the binary, which is the HIGH source.
- `.planning/spikes/027-workflow-engine-3-10-1-recheck/README.md` — the 3.10.1
  re-measurement, its negative control, the engine peer floor, the `meta.description` gap,
  and the `agent()` grade. Every claim in it that could be checked against the 3.10.1
  source this session was checked and held, except the `validateMeta` message count (see
  §Engine facts).
- `/home/acolomba/pi-claude-marketplace/.worktrees/workflows-spike/.claude/skills/spike-findings-pi-claude-marketplace/references/workflows-bridge.md`
  (:190-242) — the sandbox comparison table and the upstream-stability paragraph, measured
  at 3.5.1. Not in this worktree; transcribed above.
- `.planning/workstreams/workflows/milestones/workflows-phases/105-workflow-degradation-and-documentation/105-RESEARCH.md`
  — the archived predecessor. Every quantitative claim in it was re-derived against the
  current tree; the ones that moved are tabulated in §State of the Art.
- `.planning/workstreams/workflows/phases/113-update-enable-disable-reconcile/113-04-SUMMARY.md`
  (:285-303) — the seven-site closed-set trail, re-derived here and found to be eight.

### Tertiary (LOW confidence)

- None. No claim in this document rests on a web search alone or on training memory.

## Metadata

**Confidence breakdown:**

- Criterion 6 (upstream `workflows` is path-bearing): **HIGH** — two independent sources,
  one of them the shipped binary's own schema, quoted verbatim.
- Engine facts (probe target, false positive, nine checks, `session_start` registration,
  peer floor): **HIGH** — read verbatim from the current 3.10.1 / 0.3.1 tarballs and
  confirmed against npm metadata this session.
- Blast radius (19 `composeReasons` sites, 111 `SoftDepStatus` literals, 302 fixture-helper
  call sites, 7 derivation sites, 8 closed-set sites): **HIGH** — counted by grep over the
  working tree, with per-site line numbers.
- Reachability of all seven derivation sites from public surfaces: **MEDIUM-HIGH** — each
  caller chain was read, but no prototype gate was driven (A6).
- `validateMeta` message count vs Spike 027's "four": **HIGH** for the source read,
  **unresolved** as a documentation figure (A5).
- Sandbox-table row grades: **MIXED and labelled per row** — one runtime-measured at
  3.10.1, two source-corroborated at 3.10.1, two carrying the 3.5.1 grade.
- `sonarjs` reaction to the widened derivations: **LOW** — unmeasured, budgeted as a risk.

**Research date:** 2026-09-07
**Valid until:** 2026-10-07 for the repository-internal facts and the upstream manifest
schema; **7 days** for the engine facts — `@quintinshaw/pi-dynamic-workflows` has 57
published versions and no exported contract, so re-verify `workflow_control`, the check
list and the peer floor against the then-current version if this phase slips.
