---
phase: 105-workflow-degradation-and-documentation
plan: 04
subsystem: docs
tags: [documentation, workflows, executable-code, sandbox, evidence-grades, readme, i18n]

# Dependency graph
requires:
  - phase: 102-workflow-naming-and-script-admission
    provides: the acorn extractor, the four naming outcomes and the vendored determinism blocklist this document describes
  - phase: 103-workflows-bridge
    provides: the envelope shape, the canonical storage paths and the project-key derivation this document describes
  - phase: 104-workflow-lifecycle-completion
    provides: the removal asymmetry and the `stale workflow command` remedy the reload section describes
  - plan: 105-01
    provides: the `requires pi-dynamic-workflows` marker and the third `DEPENDENCIES` member the disposition section and the prose corrections describe
provides:
  - "`docs/workflows-compatibility.md` — the per-component-kind contract for the one bridge that installs executable code"
  - "the admit-versus-run divergence table: seven engine gates, one replicated, nine admitted-but-refused script shapes"
  - "three labelled evidence grades on the `agent()` failure finding, with the source read kept distinct from the runtime measurement"
  - "a Workflows entry in both READMEs' Features and Prerequisites lists — the document's only inbound link"
  - "corrected soft-dependency prose in the two ungated guide surfaces"
affects: [milestone close, version bump, CHANGELOG]

actuals:
  tokens: 9000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "An evidence grade is written in the sentence that makes the claim, never in a footnote — a source read and a runtime measurement are different strengths and must read as different strengths"
    - "A divergence table's row count is pinned to the upstream gate count, so a shorter table is detectable as an understatement rather than passing as a summary"
    - "The Spanish README is edited in the same change as the English one; an omitted bullet is a divergence, which is worse than a modest translation"

key-files:
  created:
    - docs/workflows-compatibility.md
  modified:
    - README.md
    - README.es.md
    - docs/messaging-style-guide.md
    - docs/open-closed-proof.md

key-decisions:
  - "The host engine is linked by its npm package page rather than by a `pi.dev/packages/...` URL: the two existing companions are unscoped pi.dev packages and the engine is npm-scoped, and an unverifiable link in a README is worse than a register mismatch"
  - "The rejected engine is named only inside the trust-grounds comparison; everywhere else it is `the rejected engine`, so the document cannot be skimmed as a recommendation of it"
  - "The dependency-bearing-variants sentence was recounted from the interface declarations rather than adjusted — its old numbers were wrong in two independent ways"
  - "`:62` and `:166-167` of the messaging guide were deliberately NOT touched: they are v1.3 history and a v1-to-v2 migration mapping, and the workflows marker has no predecessor in either"
  - "No new doc gate was added: three gates already cover the tuple, and a fourth would only be a fourth place to bump"

patterns-established:
  - "A compatibility document states which claims it measured, which it read, and which it takes from upstream, so a reader can weigh each one separately"
  - "The sandbox comparison is stated at full strength rather than softened, and the decision to state it is recorded as an accepted risk rather than made silently"

requirements-completed: [WDOC-01]

coverage:
  - id: D1
    description: "A plugin author reading one document learns that this bridge installs executable code, which engine runs it, and how tightly that engine is sandboxed against the alternative"
    requirement: WDOC-01
    verification:
      - kind: manual
        ref: "docs/workflows-compatibility.md — the executable-code paragraph at the top and the five-row sandbox comparison under `## The host engine and why it was chosen`"
        status: pass
    human_judgment: true
    rationale: "Prose against a requirement's text. No test enumerates `docs/*.md`, so the acceptance is a reviewer read; the mechanical halves (heading set, table row counts, evidence phrases, absence of process citations) were grep-checked and are recorded below."
  - id: D2
    description: "The admit-versus-run divergence carries one row per engine gate with exactly one marked replicated, and both template-literal arms are stated separately"
    requirement: WDOC-01
    verification:
      - kind: manual
        ref: "gate table: 7 data rows, `**yes**` appears exactly once in the file; shape table: 9 data rows, two of which are the template-literal arms"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every claim in the script-semantics section carries its evidence grade in the text, and the host engine's `agent()` claim is labelled a source read at a stated version and explicitly not a runtime measurement"
    requirement: WDOC-01
    verification:
      - kind: manual
        ref: "`Evidence grade: documented upstream` x1, `Evidence grade: measured at runtime` x3, `Evidence grade: read from the shipped engine source at 3.5.1` x2, `not driven at runtime` x1; `not measured` x0 anywhere in the file"
        status: pass
    human_judgment: false
  - id: D4
    description: "Both READMEs name the kind, name the engine, link the document, and stay structurally parallel"
    requirement: WDOC-01
    verification:
      - kind: manual
        ref: "Features 5 -> 6 bullets and Prerequisites 3 -> 4 entries in each file; one link to the new document in each; `grep -c '^- '` identical across the two files"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Spanish twin's register is matched rather than reviewed by a translator"
    verification: []
    human_judgment: true
    rationale: "One wording choice was made without a reviewer and is named under Issues Encountered. It was written rather than omitted, per the plan's instruction, because an omitted bullet leaves the two entry-point documents disagreeing about which component kinds are supported."

duration: 17min
completed: 2026-08-15
status: complete
---

# Phase 105 Plan 04: Workflow degradation and documentation Summary

**The contract of the one bridge that installs executable code is now written down: which engine runs a third party's JavaScript, how tightly that engine is sandboxed against the alternative it was chosen over, which script shapes install and then refuse to run, and which of those claims were measured versus read.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-15T23:05 (context read)
- **Completed:** 2026-08-15T23:17:25-04:00 (last task commit)
- **Tasks:** 3
- **Files created/modified:** 5

## Accomplishments

- `docs/workflows-compatibility.md` exists and mirrors `docs/hooks-compatibility.md` section for section: framing, legend, source-of-truth paragraph, a big feature table, per-facet sections, an install-time disposition section, and two further-reading links. It says in its second paragraph, unhedged, that a workflow is not data but JavaScript a third party wrote and an engine executes on the machine of whoever installs the plugin.
- The trust grounds are stated at full strength. The measured sandbox comparison sits in the document with both engines named and its evidence grade on the sentence above it, because the comparison is the fact a plugin author's decision turns on.
- The admit-versus-run divergence is a table, not a caveat: seven gates in the engine's own order with its refusal message on each, exactly one marked replicated, and nine admitted-but-refused script shapes mapped onto the gate that refuses each. Both template-literal arms are separate rows, because they fail differently -- one is refused outright and the other resolves to a name the bridge did not install under.
- The `agent()` finding carries three evidence grades in three sentences: documented upstream for Claude, measured at runtime for the rejected engine, read from the shipped engine source at 3.5.1 for the host engine, with an explicit statement that the host engine's path was not driven at runtime and that a source read is the weaker evidence.
- Both READMEs name workflows as a supported component kind, name the host engine in Prerequisites, and link the new document -- which is its only inbound link, since nothing in this repository enumerates `docs/*.md`.
- The two ungated prose surfaces that still described a two-member dependency set now describe a three-member one, and the sentence that named a retired status was recounted from the declarations rather than nudged.

## Task Commits

1. **Task 1: The workflows compatibility document** -- `ae180f51` (docs)
2. **Task 2: Both READMEs name the kind, the engine, and the document** -- `8949f8f3` (docs)
3. **Task 3: The three prose surfaces the closed-set growth left stale** -- `8f9df71b` (docs)

## Files Created/Modified

- `docs/workflows-compatibility.md` (new, 200 lines) -- ten sections: the host engine and its trust grounds, the script API surface, naming, storage and discovery, guaranteed-versus-divergent semantics, the admit-versus-run divergence, determinism, install-time disposition, registration and reload, further reading
- `README.md` -- a Workflows bullet in Features linking the new document, and the host engine in Prerequisites
- `README.es.md` -- the same two edits at the same positions, translated
- `docs/messaging-style-guide.md` -- the `Dependency` union sketch, the probe-target set and its package mapping, the overview marker list, the computed-probe grammar invariant, and the recounted dependency-bearing-variants sentence
- `docs/open-closed-proof.md` -- the soft-dep concern's contents described as a three-member tuple with three marker constants

## Decisions Made

- **The host engine is linked by its npm package page, not by a `pi.dev/packages/...` URL.** The two existing Prerequisites entries link pi.dev because both are unscoped Pi packages; the engine is npm-scoped (`@quintinshaw/pi-dynamic-workflows`) and whether pi.dev indexes it under that path could not be confirmed offline. A link that resolves is worth more than a link that matches the neighbours' shape.
- **The rejected engine is named exactly twice, both times inside the trust-grounds comparison.** Everywhere else in the document it is "the rejected engine". A reader skimming the script-semantics section should not come away with a second package name that looks like an option.
- **The dependency-bearing-variants sentence was recounted, not adjusted.** See Issues Encountered for both numbers and what they replaced.
- **`:62` and `:166-167` of the messaging guide were left alone deliberately.** Both name only the two older markers, but `:62` records which three v1.3 reasons the v2.0 type model absorbed and `:166-167` maps retired v1 free-text lines onto their v2 reasons. The workflows marker existed in neither v1.3 nor v1, so adding it to either would make a correct historical record false.
- **No new gate was added over these prose facts.** The tuple itself is already covered by the closed-set length-and-order lock, the catalog byte gate, and the compile-time coverage proof. A fourth gate over the same facts would be a fourth place to bump on the next dependency.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Two more sentences in the same file enumerated the marker set and still said two**

- **Found during:** Task 3
- **Issue:** The plan named `:28`, `:61` and `:67` of `docs/messaging-style-guide.md`. Two further sentences enumerate the same closed set and were equally stale: the Overview's parenthetical marker list (`{requires pi-subagents}` / `{requires pi-mcp}`), and the "Computed soft-dep probe" grammar invariant, which describes the per-dependency probe path one dependency at a time and described only two. Correcting the sentence that names the count while leaving two sentences that name the members is the same partial-set defect the task exists to close.
- **Fix:** Both extended to name the third marker and the third probe. The `dependencies: ["workflows"]` arm is described in the same shape as its two siblings.
- **Files modified:** `docs/messaging-style-guide.md`
- **Verification:** `grep -n 'pi-subagents\|pi-mcp\|pi-dynamic-workflows'` over the file now shows the third member on every line that enumerates the current set, and only on those lines
- **Committed in:** `8f9df71b`

**2. [Rule 3 - Blocking] The engine gate table needed a distinguishable single replicated mark**

- **Found during:** Task 1
- **Issue:** The acceptance criterion counts "replicated marks", and a bare `yes` in a table cell is not countable without also matching prose elsewhere in the document.
- **Fix:** The one replicated row carries `**yes**`, which appears exactly once in the file, so the criterion is checkable by a single grep rather than by reading.
- **Files modified:** `docs/workflows-compatibility.md`
- **Committed in:** `ae180f51`

### Scope held

- `docs/output-catalog.md` was not touched -- `git diff --name-only -- docs/output-catalog.md` is empty across all three commits. Its prose corrections landed with the catalog states.
- No source file, dependency manifest or lockfile is in any of the three commits. `git diff --name-only` over the plan names five markdown files and nothing else, which is the threat register's T-105-04-SC control.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Neither changed the plan's shape. The missing-critical fix extends the same correction to two sentences the plan's line list missed.

## Issues Encountered

- **The recount produced two corrections, not one.** The stale sentence read: `dependencies` REQUIRED only on `installed | updated | reinstalled | present`, "the other **12** variants omit the field; only those **4** switch arms reach the per-dependency probe path." Recounted from the interface declarations in `shared/notify.ts`: `PLUGIN_STATUSES` has **19** members (the sentence's arithmetic implied 16); `present` is not among them and does not appear anywhere in the file, so it is genuinely retired; `dependencies` is REQUIRED on **3** variants (`installed`, `updated`, `reinstalled`) and OPTIONAL on exactly **1** (`partially-installed`, WR-03); **15** variants omit it entirely. The "4 switch arms" figure survives unchanged but for a different reason than the sentence gave -- it is 3 required plus 1 optional, not 4 required. The corrected sentence says so.
- **One Spanish wording choice was made without a reviewer, and is named here rather than omitted.** The bullet reads `- Workflows (flujos de trabajo). Requiere ... Para más información, consulta [Compatibilidad de workflows](docs/workflows-compatibility.md).` The uncertainty is the head noun. `README.es.md` translates a component kind when a settled Spanish term exists (`Comandos`, `Habilidades`, `Agentes`, `Servidores MCP`) and keeps the English product term with a gloss when it does not (`Hooks (ganchos)`). Workflows was treated as the second case, because the directory a plugin ships is literally `workflows/` and the command surface names the kind in English -- so the bullet parallels the hooks bullet exactly. A reviewer preferring `Flujos de trabajo (workflows)` should invert it; the link text `Compatibilidad de workflows` follows the head noun either way and would become `Compatibilidad de flujos de trabajo`.
- **A stale count survives inside `shared/notify.ts` and was deliberately not fixed here.** Its per-variant discipline comment (around `:612`) reads "REQUIRED only on installed / updated / reinstalled (SNM-06). Other 7 variants omit." The named list is now correct but the count predates several variants -- 15 omit it, and the comment does not mention the `partially-installed` optional arm. This plan is markdown-only by its own verification clause, so a source edit here would have been an unexplained diff. Worth a one-line correction at milestone close.

## Known Stubs

None. Every section named in the plan is written, and no section is a placeholder.

## User Setup Required

None. This plan installs nothing, touches no dependency manifest, and changes no runtime behaviour.

## Next Phase Readiness

This is the last plan of the phase and of the milestone's requirement set. Notes for milestone close:

- **`CLAUDE.md`'s project description still enumerates five translated artifact kinds** ("skills, commands, agents, MCP servers") and omits workflows. The research flagged it as out of scope for this phase because it is not a `docs/` file and is named in no requirement. It is now the only entry-point surface that does not mention the kind.
- **The engine facts in the new document are pinned to 3.5.1 and carry a stated shelf life.** The document says so in its own upstream-stability paragraph. If the milestone's PR slips, re-read `workflow_control`, the seven `parseWorkflowScript` gates and the determinism blocklist against the then-current engine before shipping.
- **The version bump, CHANGELOG entry and PR remain milestone-close work**, untouched by any of this phase's plans.
- **The document has exactly one inbound link per language and no gate protects it.** Nothing enumerates `docs/*.md`, so a future README restructure that drops the Features bullet makes the contract invisible again with no test failing.

## Self-Check: PASSED

- All five named files exist on disk; `docs/workflows-compatibility.md` is 200 lines and carries all ten section headings, each appearing exactly once.
- All three commit hashes resolve in `git log`: `ae180f51`, `8949f8f3`, `8f9df71b`.
- `git diff --diff-filter=D` across the three commits is empty -- no file was deleted.
- `.planning/workstreams/workflows/STATE.md` and `ROADMAP.md` appear in none of the three commits.
- `npm run check` exits 0, unpiped: typecheck, lint, format:check, unit tests and integration tests all ran, `# fail 0` on both test runs, zero `not ok` lines.

---

*Phase: 105-workflow-degradation-and-documentation*
*Completed: 2026-08-15*
