# WORKFLOW.md — GSD Path Pipeline SOP

Idea to shipped code through a gated pipeline. The `gsd-path` router reads
`.project/STATE.md`, reports the current state, and invokes the next skill.
Every handoff is on disk; the any-phase discussion sidecar also records its
dialogue and answers on disk. AGENTS.md supplies the shared operating rules.

**Path scope.** `.project/` paths describe the consuming project's artifacts.
References to `skills/`, `scripts/`, `platforms/`, `RUNTIME.md`, and `HOOKS.md`
describe the GSD Path source checkout, which an application need not contain.
For execution in an installed project, resolve each role, template, and helper
from the active skill's bundled absolute paths. Source-relative links below
are navigation within the GSD Path source checkout, not installed-file claims.

**Program flow.** When the work is a multi-milestone program, define runs in
program mode and writes `.project/CHARTER.md` (enduring scope and vetoes),
research and decide work at program scope, and the roadmap phase slices the
charter into `.project/ROADMAP.md` — milestone-granularity scope for every
milestone. The first milestone after roadmap approval runs define
(milestone mode), research and decide only when its roadmap entry has open
questions, then plan → build → ship. Each later milestone inspects the
now-shipped codebase, then runs define (milestone + brownfield), the same
open-question branch, and plan → build → ship, until the program completes.
While a milestone builds, the router may offer to plan the
next dependency-ready milestone in parallel under `.project/next/` (the
lookahead track, starting at inspect); at the milestone boundary the router
promotes it to the active paths in one commit. An explicit user ruling can instead abandon a
building milestone: its partial artifacts archive without review gates, its
roadmap entry becomes immutable `abandoned`, and the roadmap re-slices the
remaining entries. CHARTER.md, ROADMAP.md, and the program `.project/SYNTHESIS.md`
persist across milestones and never archive. Without CHARTER.md the pipeline
is the single-milestone flow below.

## Agent and concurrency contract

Use the host-specific child-agent tool defined by the runtime dispatch contract
bundled in the `gsd-path` skill, or the build contract's
[dispatch driver](https://github.com/open-gsd/gsd-path/blob/main/RUNTIME.md#dispatch-driver) when the owner supplies a child
command. Spawn independent work up to the available
child capacity and batch any remainder. Every spawned agent has isolated
context, so its brief must include the absolute role path, exact input paths,
one distinct output path, relevant constraints, the output contract, and the
deterministic logical task name defined by the dispatch contract. Do not rely
on conversation context.

Within a wave, readiness is continuous: a parallel dispatch round gives every
coder a distinct linked worktree at the clean primary HEAD recorded as its
task base; a serial round (one ready task) uses the bound branch in the
primary worktree. A dependent task dispatches in a fresh round as soon as its
dependencies land — never idling behind unrelated in-flight tasks. Task
landing stays serial, processing completions as they arrive. A same-wave task
never runs before its same-wave dependencies are done. Task verification
reconstructs the recorded base plus only that task patch; combined branch-tip
evidence does not count. The orchestrator calls `scripts/isolation.py` for
isolate, recover, land, and retire; it never invents `git worktree add` or
`--detach`.

The parent orchestrator owns dispatch and lifecycle. It binds one structured
run when the host provides one, creates one task per independent brief, waits
for terminal results, validates provenance, transfers staged artifacts from
disposable roots, and cleans up every child and temporary root before applying
a gate. Children never delegate another GSD Path child. A timeout or
cancellation is a blocked result, not a skipped result.

| Stage | Independent children | Scheduling | Parent hand-off |
| --- | --- | --- | --- |
| inspect | codebase mapper, docs auditor | two concurrent briefs | validate and transfer both artifacts |
| define | none | coordinator-led user gate | write approved INTENT.md (program mode: CHARTER.md) |
| research | assigned dimensions | concurrent up to capacity, then batches | validate each evidence file as it returns; RESEARCH.md gate after all settle |
| decide | one decider | serial | validate SYNTHESIS.md |
| roadmap | one roadmapper | serial; program flow only | validate ROADMAP.md |
| plan | one planner; zero in quick mode | serial | validate PLAN.md and task wave assignments |
| build | dependency-ready coders; wave reviewers | coder rounds, then wave review | commit code and wave artifacts |
| ship | final integration and gap reviewers | independent reviewers concurrent | verify, approve, archive, and ship |

Non-interactive phases auto-advance when their artifacts pass their gates.
User approval remains required at define, roadmap, plan, final-review patch
selection, and final shipping checkpoints. Decide auto-advances after its
evidence gate unless a `NEEDS-USER` decision remains. The opt-in quick-lane
grant for selected intent or plan gates is described in the
[router contract](skills/gsd-path/SKILL.md#pre-approval); all other gates
still ask.

Every user-facing checkpoint follows one handoff shape: **Outcome** states what
was produced or learned, **Review** links the primary canonical artifact by its
resolved absolute path, and **Next** asks the single required question or names
the next action. Text the user is expected to send back verbatim goes in its
own fenced code block, never a blockquote, so it pastes cleanly. Supporting
artifacts are summarized or linked only when they
help the decision. Write the artifact before asking, never present a bare
approval question, and after the answer relink the updated artifact before the
router continues or a direct invocation names its exact next skill.

`$gsd-path status` reports the `pipeline_state.py status` snapshot and stops —
it does not auto-advance. `$gsd-path-forensics` is read-only diagnosis when a
helper blocks. `$gsd-path-undo` previews then applies helper-owned undo of
unpublished work; it never invents `git reset`.

### Plain-prompt re-entry

<!-- gsd-path/plain-prompt-reentry/v1 -->

Project installs record the selected runtime in `.gsd-path/runtime.json` and
keep a stable launcher at `.gsd-path/status_runtime.py`. Runtime implementation
lives under `~/.gsd-path/runtimes/`; clones and named checkouts inherit the
declaration. Missing versions require explicit restoration, not a download
during status or guard execution.
On any turn that did not explicitly invoke a GSD Path
skill, an owned `.project/STATE.md` activates re-entry. Informational prompts
finish read-only and end with the current **Outcome** / **Review** / **Next**
handoff. Both informational and mutation replies use the status result's
`handoff.next` for **Next**. Mutation prompts make no changes. The status engine
never initializes state or advances a phase.

The optional pre-tool guard backs this up where it has deterministic evidence.
See [HOOKS.md](https://github.com/open-gsd/gsd-path/blob/main/HOOKS.md#what-gets-blocked) for write restrictions, including
closed milestone branches and target worktrees. Shell provenance
cannot prove which skill initiated a command, so the always-loaded AGENTS.md
contract owns shell cases.

### New GitHub repository creation

An explicit request to create a GitHub repository enters a pre-initialization
gate. Resolve and preview the GitHub owner/name, visibility, normal default
checkout, `gsd-path/M001` branch, and a distinct linked-worktree path.
Create no repository, checkout, worktree, pipeline state, journal, or preview
file until the user approves every target; present the pre-creation review
inline from the bootstrap helper's read-only `preview` result. An existing
empty invocation folder may be the linked worktree with approved
`--reuse-empty-worktree`; Git populates it in place. Keep the workspace journal
outside that folder. Preserve nonempty folders and choose another target;
never delete the invocation folder or its state to pass a preview.

After approval, the bundled bootstrap helper writes an exact transaction
journal under the approved workspace before mutation. Its `create` command
creates or verifies the GitHub repository and bootstrap README, clones the
default branch, resolves its exact SHA, creates or adopts the approved GSD Path
branch and linked worktree at that SHA, then publishes STATE.md and a
fixed-format `.project/REPOSITORY.md` together with one same-filesystem
`.project/` directory rename. The default checkout remains clean,
and all pipeline artifacts live only in the linked worktree. A retry with the
same approved targets resumes from the first missing stage; any mismatch or
unowned collision blocks without deletion. The journal is removed only after
both artifacts are durable. Existing repositories do not pass through this
transaction.

## Phase 0 — Inspect (`gsd-path-inspect`)

**Input:** an existing codebase with no `.project/STATE.md`, or owned v2 state
at `inspect/active|blocked`. **Output:**
`.project/research/evidence-codebase.md` and
`.project/research/DOCS-AUDIT.md`.

When STATE.md is absent, the router runs the bundled
`scripts/detect_project.py initialize --repo <absolute-root> --template
<absolute-state-template> --require-git` helper before asking anything and routes from its
returned JSON. `route: setup-repository` leaves a non-Git folder unchanged and
asks for repository setup before creating state. `brownfield` initializes `inspect/active` and routes here;
`greenfield` initializes `define/active` and skips to define; `orphan` blocks.
Owned state routes by STATE.md without rerunning the helper. Reserve `classify`
for read-only inspection; do not re-derive a verdict from a directory listing.

For a newly initialized existing Git repository, the state router returns
`bind-initial` while `STATE.branch` is null. The router fetches the recorded
[default branch](#default-branch) (`origin/main` in this document),
runs `pipeline_git.py bind-initial` with that exact SHA, and records the
returned `gsd-path/M00N` binding through `pipeline_state.py transition` before
entering inspect or define. Build consumes this binding and never creates or
selects the milestone branch.

Before either inspect agent writes a phase artifact, freeze a sorted Markdown
inventory that excludes `.project/**` and all vendored/generated trees. Two
read-only agents then run in parallel. The codebase mapper establishes what
actually exists: stack, entry points, architecture, conventions, maturity,
recent activity, load-bearing surprises, and open questions only the user
can settle. The docs auditor inventories every `.md`, extracts testable
claims (commands, features, structure, status, config, integrations),
verifies each against the code by the cheapest sufficient method, and
issues verdicts — `verified`, `stale`, `aspirational`, `unverifiable` —
with recorded evidence, plus a remediation queue classified `fix-doc`,
`fix-code`, or `NEEDS-USER`. The auditor uses the frozen inventory verbatim in
alignment-false mode, so neither agent's output can enter the scan.

Build, test, lint, and help commands run only in orchestrator-created,
agent-specific disposable worktrees at a recorded clean revision. If one is
not available, agents use static evidence or record `unverifiable`; they never
run project commands in the source worktree.

The orchestrator presents ground truth in one screen — what the project is,
what demonstrably works, where docs and code disagree — then enters the
define in brownfield mode. Inspect changes nothing outside `.project/`.

**Gate:** both artifacts match their templates; every claim has a verdict and
every claimless doc appears once in the descriptive list, together covering
the frozen inventory exactly; ground truth was presented before any question
was asked.

## Phase 1 — Define (`gsd-path-define`)

**Input:** a raw idea — or, brownfield, the inspection artifacts. **Output:**
`.project/intent/INTENT.md`; program mode instead writes `.project/CHARTER.md`
and defers INTENT.md to per-milestone derivation (milestone mode, `Lane:
milestone`).

Brownfield mode inverts the opening: present ground truth first, then
interview only on deltas — this milestone's goal, what must change, what
must not break (recorded as vetoes). Established facts are stated for
correction, never asked. Milestone + brownfield still does not re-interview
charter or roadmap scope; it presents ground truth, fills Current state, and
collects doc-vs-code rulings before confirmation. Every doc-vs-code conflict from the audit gets a
user ruling (`fix-doc`, `fix-code`, or `accept-drift`) recorded verbatim in
both INTENT.md and DOCS-AUDIT.md's durable User rulings table. Actionable rows
start at `planned: no`; accepted
`fix-code` items become scope. The codebase map fills INTENT.md's
`## Current state` so downstream phases inherit ground truth.

Cover the problem, users, observable success, scope in, scope out, constraints,
risks, and surfaces — what a person opens, sees, or types into to get the
result. INTENT.md records them as `Surfaces:` (`none` only when nobody touches
the work directly), and every named surface carries a success criterion
observable there rather than a passing test standing in for it. Chase contradictions and challenge the core assumption. Record
vetoes and corrections verbatim. Unresolved items remain tagged `RESEARCH` or
`NEEDS-USER`. A user-supplied document (PRD, issue, design doc) is read
first and presented as settled coverage for correction; the interview covers
only its gaps and contradictions.

Once the success criteria are drafted, define runs the spec-reach probes
([spec-probes.md](skills/gsd-path/references/spec-probes.md)). The edge probe
walks each criterion through a closed edge taxonomy (boundary, adjacency,
empty, encoding, ordering, precision, idempotency, concurrency) and records
the user's ruling per applicable edge in INTENT.md `## Edge coverage`:
`criterion SCn` (stated in a success criterion), `held-out` (a named test
pins it), or `dismissed` with a reason. The prohibition probe asks what each
criterion must never silently become and records kept items in
`## Prohibitions` as `criterion SCn`, `judgment`, or `dismissed`. Define
never rules on an edge itself. `scripts/check_handoffs.py intent` checks
both tables before every approval question, and the `define/done` transition
refuses an intent whose tables are incomplete. An INTENT.md without these
sections predates the probes and is not rechecked.

At approval define classifies the milestone lane in INTENT.md: `quick`
when scope fits at most two deliverable-sized tasks in one wave with no open
questions and no cross-wave risk; otherwise `standard`. Milestone mode — a
program milestone derived from an approved roadmap entry — records `Lane:
milestone` instead: research and decide run only when the roadmap entry lists
open questions, and planning writes a Settled-only milestone SYNTHESIS.md from
the program synthesis before dispatching the planner. The quick lane skips
research and decide — planning enters directly from `define/done`, writes
a Settled-only SYNTHESIS.md and a single wave (full or deep review depth,
at most two tasks) without a planner agent, and the rest of the
pipeline runs unchanged. A quick plan that outgrows those bounds corrects the
lane to `standard` and reroutes through research.

**Gate:** the user receives the playback summary, lane, and absolute-path
Markdown link to INTENT.md before approving it.

## Phase 2 — Research (`gsd-path-research`)

**Input:** INTENT.md. **Output:** `research/RESEARCH.md` plus one evidence
file per dispatched dimension, drawn from the four standard dimensions:

- `research/evidence-domain.md`
- `research/evidence-stack.md`
- `research/evidence-pitfalls.md`
- `research/evidence-similar.md`

Brownfield: `research/evidence-codebase.md` from inspect counts as a
fifth standard input downstream — researchers read it so recommendations
fit the code that exists (the stack researcher weighs migration cost, the
pitfalls researcher checks which traps are already sprung).

Follow the [research phase contract](skills/gsd-path-research/SKILL.md) for
dispatch eligibility, skipped dimensions, question assignments, and evidence
paths. Every finding needs a checked source,
confidence, and a tie-back to INTENT.md.

**Gate:** RESEARCH.md records every standard dimension exactly once, every
dispatched file exists, matches the evidence template, contains at least one
finding, and answers its assigned `RESEARCH` questions; every skipped
dimension is recorded with its reason. Each file is validated as its
researcher returns. A missing or invalid file gets one corrected redispatch
as soon as a child slot opens, ahead of queued initial dimensions and while
other researchers may still be running. The cross-file gate runs only after
all dimensions settle.

## Phase 3 — Decide (`gsd-path-decide`)

**Input:** INTENT.md and every dispatched evidence file. **Output:**
`.project/research/SYNTHESIS.md`.

The decider turns evidence into commitments. Each genuinely open decision
names the selection, runner-up and why it lost, cited evidence, and
confidence. A choice already settled by an intent constraint or the existing
codebase is one line under Settled citing the settling source — never a full
block with an invented runner-up.
Conflicts are ruled on or escalated; unanswered intent questions remain
visible. `## For the planner` identifies wave-one blockers, the walking
skeleton, and pitfall-to-task guidance.

**Gate:** all required decision areas are resolved and cited — as a decision
block or a Settled line naming its source; all evidence
files were considered; the planner brief is complete; and every `NEEDS-USER`
item has a recorded user ruling. Any missing, optional, or unresolved decision
blocks advancement.

## Phase 3.5 — Roadmap (`gsd-path-roadmap`)

Program flow only — requires `.project/CHARTER.md` and a program
`.project/SYNTHESIS.md`. **Input:** charter, program synthesis, and the
dispatched evidence set. **Output:** `.project/ROADMAP.md`.

The roadmapper slices the charter's full scope into the fewest
dependency-ordered, independently shippable milestones. M001 is the thinnest
end-to-end skeleton that burns the riskiest decisions. Rolling-wave: entries
carry goal, dependencies, scope in/out, success criteria, risks, and open
questions — never waves, tasks, or file lists. Charter scope coverage is
total: every `Full scope: in` item maps to a milestone, and silent scope cuts
are forbidden (`NEEDS-USER` instead). A non-empty `Open questions` entry
inserts milestone-scoped research and decide before that milestone's
planning. An approved roadmap may be re-sliced only at a milestone boundary;
`shipped` entries are immutable except Status/Archive/Integrated.

**Gate:** total charter coverage, unique ordered ids, acyclic earlier-id
dependencies, complete entry fields, no task-level detail, no vetoed scope —
and the user approves the milestone list. Approval transitions STATE to
`roadmap/done`, marks the first `pending` entry `active`, and is
checkpointed as a `.project/`-only Git commit (deferred to build's
transition commit during a new-repository transaction or before Git
exists).

## Phase 4 — Plan (`gsd-path-plan`)

**Input:** both `.project/intent/INTENT.md` and
`.project/research/SYNTHESIS.md`, plus relevant existing code. **Output:**
`.project/plan/PLAN.md` and one full task file per task in `.project/tasks/`.

Order work by risk and dependency:

1. Wave one burns down assumptions that could invalidate the plan.
2. Wave two delivers the thinnest running end-to-end slice.
3. Later waves add features, then polish.

Tasks are deliverable-sized: each is the largest coherent vertical slice —
feature plus its tests and wiring — one agent run can complete, split only
when file scopes, dependencies, or capacity force it. Every task contains
inlined context, real paths, approach constraints, an interface contract
naming the exact shapes exchanged with other tasks (`None` when
independent), an Intent coverage section, observable acceptance criteria, a
meaningful `verify` command that names a path from that task's files,
declared files, deps, and
orchestrator-owned `base`/`worktree`/`task_branch` fields initialized
to null. PLAN.md Intent coverage maps every INTENT.md success criterion to a
task AC; that task's Verify must fail if the SC is skipped. When INTENT.md
names surfaces, PLAN.md also carries a `## Surface contract`: per surface, the
entry point, what empty, loading, error, and success show, the walkthrough a
reviewer performs, the task that delivers it, and the criteria it is proven
by — which that task must own, in the same wave as the capability behind it.
`check_handoffs.py final` then requires each of those criteria to name its
surface in FINAL.md with the walkthrough as its Check, so a surface criterion
cannot be marked `met` on internal test output.
Every `held-out` edge gets a PLAN.md `## Held-out checks` row naming the task
and test file; that test is in the task's files, its Verify runs it, and its
Acceptance criteria state the edge id and ruling.
`scripts/check_handoffs.py plan` gates the table; `wave` and `final`
require a verdict per owned SC id. Acceptance criteria,
owned SCs, and Verify are the contract; the coder owns
implementation decisions inside the stated constraints. The planner reads
`.project/LESSONS.md` when present and assigns each wave a `Review depth` —
`full`, `verify-only` for low-risk waves, or sparingly `deep` for
irreversible or security-critical waves; wave 1 and any wave touching
authentication, payments, data migration, or concurrency stays `full` or
`deep`. PLAN.md Config may name an optional `review_panel` (`off` by
default, or `detected` / a named family list). In program flow CHARTER.md
holds the durable default; each milestone INTENT copies it and may
override. After the structural gate
and before approval, the planner runs `scripts/review_panel.py` against
advertised host model slugs and may write `.project/review/PLAN-PANEL.md`.
The panel is advisory: it never averages findings or replaces user
approval. Quick lane stays `off`. Config may also set
`finding_skeptics: on` (default `off`) to have the build spawn one
read-only skeptic per failed criterion group from a blocking `deep` review
before fix tasks are opened; a refuted group spawns no fix task unless the
user explicitly overrides all refutations for that cycle.
Same-wave tasks may depend on each other only when their file scopes do not
overlap; the build executes those tasks in dependency layers. No two tasks
that can run concurrently may share a file.

**Gate:** both required inputs exist; deps resolve without cycles and each one
carries named data or a named prerequisite effect; layer and
file-scope rules hold; criteria and verifies can fail meaningfully; every
INTENT success criterion is in the Intent coverage table; tasks are
deliverable-sized with no unforced splits; INTENT and SYNTHESIS are honored;
and the user approves the wave summary. Approval is checkpointed the same
way — a `.project/`-only commit carrying the approved PLAN.md, task set, and
STATE transition — so planning artifacts never sit uncommitted until build
(the same deferral exceptions apply; patch-mode approvals are committed by
build's re-entry transition instead).

## Phase 5 — Build (`gsd-path-build`)

**Input:** the approved plan and tasks. **Output:** committed code, updated
task files, and wave reviews.

A blocked build returns through the guarded
[build recovery contract](skills/gsd-path/references/build-recovery.md) when
approved intent must change or the remaining task inventory needs repair.
It preserves landed work, re-gates changed contracts, and returns through a new
plan approval checkpoint. Ship and archived milestones cannot use this path.

The build contract is not restated here. Branch binding, the wave loop, task
isolation and landing, wave review, fix batching, completion, and milestone
abandon live only in the canonical
[skills/gsd-path-build/SKILL.md](skills/gsd-path-build/SKILL.md).
`skills/gsd-path/BUILD.md` is its generated mirror. The build orchestrator
reads the canonical file; no build agent receives this section.

Program lookahead starts at inspect under `.project/next/`, then runs define
in milestone + brownfield mode. `roadmap/done` always routes to define in
milestone mode; only the first roadmap approval produces that state. Later
non-lookahead milestones enter inspect directly — through the router's
next-milestone transition after ship, or the post-abandon re-slice transition
— and never pass through `roadmap/done`.

## Phase 6 — Ship (`gsd-path-ship`)

### Final review (`gsd-path-ship final`)

**Input:** INTENT.md success criteria and the running system. **Output:**
`.project/review/FINAL.md`, one distinct `.project/review/final-gap-N.md` per
cross-wave risk, and (when blocked) `.project/review/PATCH-FINDINGS.md`.

Run `workflow_run.py prepare-final` to collect project Verify and reuse valid
final evidence. A quick lane's single full wave may cover final scope, including
surface walkthroughs, in its existing review. The runtime proves freshness and
generates FINAL.md from that record. Dispatch an integration reviewer only when
that proof is incomplete or stale; dispatch gap reviewers only for uncovered
cross-wave risks through the shared capacity-aware contract. The integration reviewer marks each success
criterion `met`, `not-met`, or `unverifiable` with checked evidence. A criterion
tagged by a `held-out` edge or `judgment` prohibition is `met` only when its
evidence cites every tag id; otherwise the reviewer records `unverifiable`
(insufficient spec evidence) and `check_handoffs.py final` refuses a `met`
that skips a tag. Each gap
reviewer records `pass` or `blocked` for its assigned end-to-end or cross-wave
risk. List only genuine
risks that could plausibly fail; never pad the list. The runtime
runs PLAN.md's project Verify and generates its gap view. Single-repo output
lives in the command/commit ledger; for member milestone evidence and reruns,
see [S4a1](docs/multi-repo-work.md#slices). Other gap
reviewers do not re-run it. The orchestrator
creates one disposable worktree at exact reviewed HEAD
per reviewer; project commands never run in the primary worktree. Every final
artifact records that full reviewed HEAD. The parent validates and atomically
transfers each staged reviewer output to the canonical `.project/review/` path
before removing its exact disposable root. Retry may reuse an uncommitted output
only when its SHA and complete numbered risk mapping still match. Stale
uncommitted assigned outputs are regenerated. A prior blocked output committed
by the patch build may be replaced only when its findings were copied verbatim
into approved, now-done patch tasks; otherwise a stale committed output blocks.

**Gate:** `not-met`, `unverifiable`, or any blocked gap blocks shipment. Turn
the findings into a user-approved patch wave via `gsd-path-plan` patch mode and
return through the build/review loop. Passing the final gate leaves STATE.md at
`ship/active` while the archive transaction runs; `shipped/done` is written
only after the archive and manifest validate.

A missing or malformed reviewer output gets one corrective follow-up, then a
`NEEDS-USER` block rather than a fabricated patch. Project Verify's gap view is generated from its recorded execution. Rebuild a
missing view from that receipt; never rerun a command to repair a report. A failed
execution stops further reviewer dispatch until its evidence is resolved. Only valid evidenced FINAL/gap findings
enter PATCH-FINDINGS.md and patch planning, and the build orchestrator commits
that finding set with the approved patch artifacts before executing the new
wave.

### Archive transaction

**Input:** the shipped milestone's `.project/` artifacts. **Output:**
`.project/archive/<NNN>-<milestone-slug>/` with a MANIFEST.md.

STATE.archive is a write-ahead transaction id. The bundled Python archive helper
chooses one plus the maximum numeric prefix, persists the exact target before
creating or moving, and reuses it on every retry. Shipping moves — never
deletes — every supporting document into that numbered archive: `intent/`,
`research/`, `plan/`, `tasks/`, `review/`, and optional `discuss/`.
REPOSITORY.md, LESSONS.md, and the program artifacts (CHARTER.md,
ROADMAP.md, top-level SYNTHESIS.md) remain active project metadata; a program
ship also marks the milestone's roadmap entry `Status: shipped` with its
archive pointer inside the ship commit. MANIFEST.md is
written by same-directory temporary file plus atomic rename and lists
shippable archive files, ship date, final verdicts, wave/task/cycle counts, and
carried-forward items. A precommit helper gate validates canonical files, the
active-root allowlist, metadata, success rows, counts, and exact contents before
STATE may become shipped.

The helper rejects a CLI slug that does not match STATE.milestone, fake or
symlinked Markdown artifacts, dirty older archives, and any target already in
HEAD. Manifest criteria must match FINAL.md, cycle counts come from contiguous
real wave-review files, every final artifact names the reviewed HEAD, and Notes
must be completed. A committed target is immutable and routes only to
validation.

Ship preparation removes file-free `.claude` staging directories left under the
active `.project/` tree. Archive preflight also removes them from the current
uncommitted archive. At the `.project/` top level, ship input and active-root
checks skip non-pipeline entries only when Git neither tracks nor would add
them (for example, an ignored, untracked `.DS_Store`). Tracked entries still
block, and pipeline-owned active paths block even when ignored. Strict checks
under `.project/` and the current archive skip a regular `.DS_Store` only when
Git ignores it and does not track it; the manifest omits that file. A tracked
or non-ignored `.DS_Store` receives normal checks and is listed if archived.
Other ignored archive files still block shipment, and committed archives remain
untouched.

One exception: a DOCS-AUDIT.md with pending `planned: no` rulings is copied
atomically back into a recreated `research/` so the alignment queue survives;
the archived original keeps full history. Active and archived research may
coexist only for that byte-identical carry-forward. When a lookahead track
brings its own `research/`, `promote-next` removes the carry-forward in the
promotion commit, but only if the lookahead DOCS-AUDIT.md keeps every
carry-forward ruling (a pending row may gain a `T###`); otherwise promotion
stops.

Archives become read-only when committed. No phase may modify a committed
archive; the next milestone's inspection may read it. A retry with a persisted
archive path bypasses missing active review preconditions and resumes that
same transaction. The router validates every shipped state before reporting
or starting new work. An exact `.STATE.md.gsd-path-tmp` left before the
write-ahead rename is removed only by `prepare`. A crash after STATE becomes
`shipped/done` but before commit may run `prepare` and preflight only while the
target is absent from HEAD, then creates the single ship commit without
rewriting the transition.

If discussion resumes after `prepare` but before the ship commit, it copies the
archived pair back to active storage and appends there. A repeated `prepare`
accepts only a complete, valid active pair whose bytes extend both archived
files, atomically replaces the archived records, removes the active copy, and
forces manifest regeneration. Divergence or an incomplete pair blocks.

The ship phase closes the milestone with exactly one commit on the bound
branch: the shipped STATE.md, the final-review artifacts, and the archive
move with its MANIFEST.md, staged from `.project/` only, subject
`ship: M00N — <milestone-slug>` and a body naming `Archive:` and
`Reviewed-HEAD:`. The ship commit must contain only `.project/`
paths. There is no untracked-project fallback. Every pipeline commit carries
the subject and field body defined by its canonical phase contract; task-land
fields live only in the
[build contract](skills/gsd-path-build/SKILL.md).

### Default branch

Path ships onto the default branch of `origin`. The name is not fixed.
`detect_project.py initialize` reads the local `refs/remotes/origin/HEAD` one
time and records the name in `STATE.md` as `default_branch`; an unset
`origin/HEAD` records `main`. Run `git remote set-head origin --auto` before
the first Path run so that the record is the default branch of the forge. A
`STATE.md` without the field means `main`, so older projects do not change.

This document writes `main` and `origin/main` for the recorded default branch.
In a project that records `master`, read them as `master` and `origin/master`:
the integration merge subject ends with `into master`, and the user's merge
request in `external-landing` mode targets `master`.

The record does not change after initialization. Bind, integrate, validate,
promotion, and the git guard read it. When the forge default no longer agrees
with the record, integration stops with `remote default must be <recorded>`.
A lookahead `next/STATE.md` must carry the same `default_branch` as the active
state, or promotion stops. Names in the reserved `gsd-path/`,
`gsd-path-integrate/`, and `gsd-path-task/` namespaces, and names with `#` or
a quote character, cannot be recorded.

In a multi-repo project, each repository has its own record. The coordinator
records its default branch in `STATE.md`, as above. `members.py add` reads the
local `refs/remotes/origin/HEAD` of the member one time and records the name
in the member's section of `.project/MEMBERS.md`, as `Default branch: <name>`;
an unset `origin/HEAD` records `main`. Run `git remote set-head origin --auto`
in the member before you add it. A section without the field means `main`, so
an older `MEMBERS.md` does not change. The members of one project can have
different default branches, and the coordinator default can differ from them.
The same name rules apply.

Build start, the task brief check, undo, the member pre-push guard, and member
close read the member record. The member bound branch starts at
`origin/<recorded>`, the member merge subject ends with `into <recorded>`, and
a member pull request targets `<recorded>`. When the remote default of the
member no longer agrees with the record, `members.py validate` and member
close stop with `remote default must be <recorded>`.

Not supported: a new repository that Path creates uses `main`. This includes
`members.py add --create`, which stops when the new repository has another
default branch.

### Integration

After the postcommit validator passes, ship performs integration — the only
path from the bound branch to the default branch. The bound branch never
receives merges or back-merges, and the default checkout is never entered;
the local default branch ref may lag origin, which is harmless because
binding resolves remote SHAs. `STATE.integration_default` stores the project
choice and `STATE.integration` stores the current milestone choice. Both are
`direct`, `pull-request`, or `external-landing`; they may change only before build, and the current
milestone resets to the project default at the next handoff. Older v2 state
without these fields means `direct`. `STATE.integration_source` is `default` or
`milestone` so an explicit override remains distinct when its value happens to
match the project default.

Ship fetches origin, refreshes `origin/HEAD`, mirrors published milestone tags,
and requires the remote default to be the recorded
[default branch](#default-branch). It then follows the locked mode:

- `direct` creates a temporary named worktree (`gsd-path-integrate/M00N`) at
  the fetched remote-default SHA and merges the ship commit with `--no-ff`
  under subject `integrate: M00N — merge gsd-path/M00N into main`. A clean
  merge is pushed to `main`; a conflict is aborted and surfaced to the user.
  Path never resolves it automatically. The bound branch and annotated
  `milestone/<NNN>-<slug>` tag are then published, and the temporary worktree
  is removed.
- `pull-request` requires `gh` authentication for GitHub.com and a GitHub.com
  origin. Path publishes the exact ship commit and creates or reuses the one
  eligible PR to `main` with a GSD Path credit footer. It returns
  `awaiting-merge` until a human GitHub user merges it with a merge commit or a
  rebase merge; Path never enables auto-merge or merges the PR. After
  validation, Path creates the annotated milestone tag. The [ship contract](skills/gsd-path-ship/SKILL.md)
  owns the candidate, provenance, topology, publication, and recovery rules.
- `external-landing` is for an origin that is not GitHub.com, such as GitLab,
  Gitea, or GitHub Enterprise Server, where a merge request is the only route
  to `main`. It needs no forge CLI. Path publishes the bound branch at the
  exact ship commit, does not push `main`, and returns `awaiting-merge` with
  the required merge subject and body. You open the merge request in your
  forge (for example with `glab`), let your pipeline run, and merge it with a
  merge commit that has exactly that message. Do not squash, rebase, or
  fast-forward. Your forge may delete the source branch after the merge. On
  the next ship invocation, Path validates the two-parent merge on `main` and
  creates the annotated milestone tag.

Ship leaves the primary worktree and `STATE.branch` on the shipped local
`gsd-path/M00N`; the router owns the later branch handoff. NNN always comes
from the persisted `STATE.archive` sequence. Integration is pending from the
ship commit until the selected mode's merge and tag proof passes. The ship
commit is the crash-recovery transaction id. Resume is idempotent: direct mode
resumes its merge/tag/push transaction; PR mode reuses the exact PR and waits
or completes its tag after merge.
The router must not report shipped or start the next milestone while
integration is pending — it routes back to ship. Once validation passes, the
router fetches the latest `origin/main`, binds the next milestone there, and
records both that base and the earlier milestone landing. A missing remote
bound branch is allowed only for validated PR integration.

**Gate:** the bundled validator proves the committed shipped state, complete
archive and manifest, valid carry-forward, clean worktree, the newest commit
with a recognized ship subject in HEAD history, `.project/`-only paths in that
commit, and no `.project` change after it; the bundled `validate-integrated`
command then proves the matching integration merge commit, its
`milestone/<NNN>-<slug>` tag, and the merge on origin/main before the router
reports shipped or starts a new milestone. The ship contract owns accepted
historical subject forms. Direct-mode commits use the canonical form above;
PR-mode validation requires origin network access to prove live publication
and uses tag metadata and topology instead of merge text.
`integrate:` subjects in HEAD history are expected in direct mode; the
no-`.project`-change-after-ship drift rule lives on the gsd-path branch, which
receives no further `.project` commits before the next milestone. Product
commits after shipping do not disturb a validated shipment.

## Standing process — Discussion (`gsd-path-discuss`)

Runs as an explicit sidecar from any active non-shipped phase: inspect,
define, research, decide, roadmap, plan, build, or ship. It does not
advance the pipeline, own STATE.md, or edit a phase handoff. A shipped
milestone is archived and must not be reopened for discussion; start a new
milestone first.

**Input:** the current user question, `AGENTS.md`, `WORKFLOW.md`,
`.project/STATE.md`, the existing `.project/discuss/` records, and the
phase-specific artifacts and code needed to answer it. **Output:**
`.project/discuss/DIALOGUE.md` and `.project/discuss/ANSWERS.md`.

The discussion skill never commits. The current phase orchestrator verifies
that each change is append-only and includes it in the next normal `.project/`
checkpoint. During build this happens before the next clean layer base; during
ship the records move into the archive and enter the single ship commit.

The discussion skill reads intent vetoes, settled synthesis decisions, and
current plan/task contracts as governing constraints. It checks the smallest
relevant code paths, callers, tests, and artifacts, distinguishes fact from
inference, and pushes back on unsupported premises with cited reasoning. It
records the user's corrections, vetoes, decisions, evidence, confidence,
unresolved `RESEARCH`/`NEEDS-USER` items, and the phase owner for follow-up.

Use existing research evidence first. If a current external fact, unfamiliar
library behavior, or unresolved risk requires more evidence, perform focused
research and record its query, sources, and confidence. Do not launch the full
research phase from an arbitrary phase: its STATE transition and RESEARCH.md
handoff belong to the router and research skill. If the answer needs formal
milestone evidence, leave a tagged follow-up for that owner.

Append one verbatim user turn and assistant answer to DIALOGUE.md, plus one
self-contained answer record to ANSWERS.md, before returning the response.
The bundled deterministic helper locks STATE, validates or recovers the pair,
allocates IDs and lineage, journals the paired publication, reports pending
receipts, and appends dispositions; the model supplies only the grounded
semantic fields.
Every record carries stable `T###` thread identity, `D###`/`A###` linkage, and
supersession. Mark a bounded resolved answer `final`; use `working` only for an
explicitly provisional turn. A required formal follow-up remains pending until
the named owner appends a `Disposition X###` receipt. The router and every phase
scan pending receipts before work and before advancement; they apply the answer
through a legal gate or block visibly rather than continuing from stale input.
A final discussion answer is durable context, not approval by itself.

**Gate:** the two append-only records exist, include the current phase/status,
and contain the evidence, research status, confidence, unresolved items, and
next owner needed to resume without chat history.

## Standing process — Docs audit (`gsd-path-docs-audit`)

Runs inside inspection and standalone only at a stable pre-build phase boundary
or `ship/blocked` with no active task. It requires owned v2 STATE and blocks
during build, active review, or shipped history. Answers one question with
evidence: does the project do what its documents say?

Inventory every `.md` → extract testable claims → verify each by the
cheapest sufficient method (run the command, read the code, run the test,
check history) → verdict with recorded evidence → remediation queue. With
`.project/` present it also audits the pipeline against itself: done tasks
must have a proven landing commit and a passing Verify, SYNTHESIS decisions must
match the code's actual shape, STATE must agree with task
frontmatter. Useful mid-project as a drift check before a milestone review.
The auditor never edits anything.

**Audit-to-plan path.** Standalone runs end with a ruling walk: the user
rules `fix-code`, `fix-doc`, or `accept-drift` on each queue item, recorded
verbatim in DOCS-AUDIT.md (`accept-drift` suppresses the item in future
audits). Actionable rulings are queued, not executed: each sits in
DOCS-AUDIT.md marked `planned: no` until the user is ready. The audit
offers alignment once at close; after that, the `gsd-path` router mentions the queue in
its status line and `gsd-path-plan` offers — per item, before any planning —
to absorb queued rulings: folded into a normal plan as ordinary tasks, or
appended via **patch mode** as one gated wave on the approved PLAN.md (one
full task per finding, evidence inlined, `fix-doc` tasks verified by
re-running the audit's claim check). Absorbed rulings get their task id in
the queue row; declined ones stay queued and are offered again. The queue
never blocks the pipeline and never enters a plan wholesale unseen. Builds
from patch waves run the normal review-gate loop. A shipped milestone never
reopens because its plan is archived; start and inspect a new milestone, then
offer carried-forward rulings during its normal planning. Final review's
evidenced `not-met` criteria and blocked gaps travel the same patch-mode road,
with their exact ordered source-file and row list.

## Handoff contract

```text
.project/
  STATE.md                   pipeline owner, phase, branch, archive transaction, log
  REPOSITORY.md              persistent new-GitHub checkout/worktree binding
  LESSONS.md                 cross-milestone lessons; appended at ship, read by the planner
  CHARTER.md                 program scope and vetoes (program flow); never archives
  ROADMAP.md                 milestone slicing (program flow); never archives
  SYNTHESIS.md               program decisions at top level (program flow); never archives
  next/                      lookahead track: next milestone's STATE.md and phase
                             artifacts while the active milestone builds (program flow)
  intent/INTENT.md           approved intent and hard constraints
  research/evidence-codebase.md   brownfield ground truth (inspect)
  research/DOCS-AUDIT.md     doc-vs-code verdicts and remediation queue
  research/RESEARCH.md       research dispatch/question/output manifest
  research/evidence-*.md     evidence for dispatched dimensions; RESEARCH.md records skips
  research/SYNTHESIS.md      decision artifact; authoritative after decide gate
  plan/PLAN.md               waves, config, and project verify
  tasks/T###-slug.md         full contract, clean base SHA, status
  review/wave-N.cycleC.md    per-wave verdicts (deep uses contract/adversarial lenses)
  review/wave-N.cycleC.skeptic-<locator>.md  optional deep-review refutation evidence
  review/wave-N.cycleC.panel.md  optional cross-model wave panel
  review/PLAN-PANEL.md       optional cross-model plan panel
  review/final-gap-N.md      cross-wave gap verdicts
  review/FINAL.md            success-criteria verdicts
  review/PATCH-FINDINGS.md   ordered evidenced findings for patch planning
  discuss/DIALOGUE.md        append-only any-phase discussion transcript
  discuss/ANSWERS.md         append-only discussion answers and decisions
  archive/<NNN>-<slug>/      read-only shipped milestones, each with MANIFEST.md
```

At ship, everything except `STATE.md`, `REPOSITORY.md`, `LESSONS.md`, `archive/`, `next/`, and
the program artifacts (`CHARTER.md`, `ROADMAP.md`, top-level `SYNTHESIS.md`)
moves into the numbered archive; active paths above describe the current milestone
only, including the discussion records. The ship step appends one lesson line per repeat-offender criterion and
STATE.md log escalation to LESSONS.md before committing.

Artifact formats are bundled with the installed `gsd-path` skill. Each phase
resolves and passes their absolute paths. A missing or malformed artifact
fails its phase gate.

## Error handling

- Missing precondition: route to the phase that produces it.
- Missing or empty agent output: respawn once, then surface the failure.
- Conflicting sources of truth: stop and report; never average.
- Cycle cap, threatened veto, or checkpoint `NEEDS-USER`: ask the user —
  through an interactive user-input tool when available, with the
  recommended option listed first and justified in one line, alongside the
  real alternatives.
- Otherwise handle the problem, record it on disk, and continue.
