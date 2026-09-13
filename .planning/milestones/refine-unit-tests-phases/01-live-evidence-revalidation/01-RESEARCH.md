# Phase 1: Live Evidence Revalidation - Research

**Researched:** 2026-09-04
**Domain:** Evidence-ledger design, hermetic revalidation, and milestone scope reconciliation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

### Manifest structure

- **D-01:** Use a file index plus a linked finding ledger. One file record is
  required for each of the 110 locked corpus paths, including files with no
  live findings.
- **D-02:** The canonical structured source is phase-owned
  `01-REVALIDATION.json`; generate a human-readable `01-REVALIDATION.md` view
  from it and fail validation if the view drifts.
- **D-03:** A file counts toward 110/110 only after its claims are enumerated,
  linked, and reconciled. Its derived outcome is one of `live findings`, `no
  live findings`, `control document`, or `superseded`.
- **D-04:** Lock the corpus path inventory, ordered by full relative path. Do
  not content-hash the files. If a corpus document is corrected during Phase
  1, reopen and re-review that file before completion.
- **D-05:** Preserve report-local finding labels under a corpus-path namespace;
  use a deterministic local ordinal only for unlabeled claims. Preserve every
  historical claim, and link duplicates to one canonical finding rather than
  deleting their source records.
- **D-06:** Separate evidence status (`confirmed`, `stale`, `superseded`,
  `duplicate`, or `inconclusive`) from routing (`Phase N`, evidence-only
  closure, deferred backlog, or operator decision).
- **D-07:** Every finding record carries current source and test references,
  validation method, command or probe result, disposition rationale, and
  destination. An unavailable field requires an explicit `N/A` reason.
- **D-08:** Extract actionable factual or prescriptive claims from briefs,
  synthesis files, and controls. Purely administrative text needs only a
  completed file record.
- **D-09:** Current evidence resolves disagreements between passes. The new
  ledger is authoritative; the old reports remain historical evidence even
  when corrected for clarity.
- **D-10:** A blocking validator must prove exactly 110 unique paths, unique
  identities, valid dispositions, complete claim links, and all mandatory
  evidence before Phase 1 passes.

### Confirmation threshold

- **D-11:** Apply an evidence ladder: failing behavioral probes for production
  defects, surviving mutations for test-strength claims, and current
  call-graph or static proof only for structural claims that cannot be
  executed.
- **D-12:** Mark a finding stale only with positive stale proof: locate the
  current symbol or replacement, rerun the original or an equivalent probe,
  and explain which premise no longer holds. Missing line references or green
  tests alone are insufficient.
- **D-13:** An `inconclusive` record blocks Phase 1 until the evidence gap is
  resolved or the user explicitly defers it out of active scope with a reason.
- **D-14:** Reproduction is hermetic by default. Use temporary roots and
  injected collaborators; probes involving real user state, credentials,
  network access, or destructive access require explicit approval or remain
  unresolved.

### Operator decisions

- **D-15:** Surface only operator decisions whose premises survive
  revalidation. Present one evidence dossier at a time with current proof,
  viable choices, affected findings, and a recommendation.
- **D-16:** Order surviving decisions by risk and dependency: safety and
  production contracts first, followed by decisions that unblock test
  architecture, gates, and coverage.
- **D-17:** Recommendations prioritize unit-test guideline conformity,
  specifically eliminating test-only exports, dead branches, and dishonest
  cases. Safety defects remain highest priority. Current evidence may justify
  public API or behavior changes rather than preserving them mechanically.
- **D-18:** Record each choice durably with its evidence, selected option,
  rejected alternatives, affected findings, and exact downstream requirement
  and phase changes.

### Scope rewriting

- **D-19:** When all premises behind a requirement are stale, move it out of
  active scope while preserving its ID and evidence trail. Do not delete it or
  mark it implemented.
- **D-20:** If that leaves a later phase empty, retire it from active execution
  without renumbering subsequent phases.
- **D-21:** Split mixed requirements: retain only confirmed clauses in active
  scope and move stale clauses into the evidence trail.
- **D-22:** A newly discovered issue may add a requirement and later-phase
  route only when it directly fits this milestone's unit-test-quality
  boundary. Defer unrelated discoveries.
- **D-23:** Before Phase 2 planning, update `REQUIREMENTS.md` and `ROADMAP.md`
  from the completed ledger so later execution contains only confirmed work.

### Folded Todos

- **No gate detects an unused type member:** revalidate the pending todo's
  premise during Phase 1. If it remains live, implementation stays assigned to
  Phase 7 with offender and benign controls; Phase 1 records evidence only.

### the agent's Discretion

- Exact JSON field names and normalization details, provided the locked
  evidence semantics and blocking validation remain machine-checkable.
- How the 110 files are divided into execution plans and review batches.
- Which safe command or probe satisfies each rung of the evidence ladder.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 1's evidence and scope-gate boundary.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|---|---|---|
| RVAL-01 | Maintainers individually inspect all 110 files: 45 first-pass, 58 adversarial, and 7 control/synthesis documents. | Lock a sorted inventory before adjudication; require a completed file record even when no actionable claim exists. [VERIFIED: .planning/REQUIREMENTS.md:11-13 — “all 110 files … 45 first-pass reports, 58 adversarial reports, and 7 briefs, synthesis documents, or controls”] |
| RVAL-02 | Map every report and finding to current disposition, live references, and reproduction evidence. | Use separate file and finding collections, deterministic identities, evidence-method-specific required fields, referential-integrity checks, and generated Markdown drift detection. [VERIFIED: .planning/REQUIREMENTS.md:14-17 — “maps every report and recorded finding to a current disposition, live source and test references, and reproduction evidence”] |
| RVAL-03 | Resolve nine operator decisions only after revalidating their premises. | Model decisions as dossiers linked to canonical findings; keep decisions blocked until all premise findings have terminal evidence statuses. [VERIFIED: .planning/REQUIREMENTS.md:18-19 — “nine operator decisions … only after their current premises are revalidated”] |
| RVAL-04 | Remove stale, struck, superseded, and bundled backlog claims from active scope with evidence. | Generate a scope-impact table from the ledger before editing requirements/roadmap; preserve IDs and historical links, then validate active traceability. [VERIFIED: .planning/REQUIREMENTS.md:20-22 — “move out of active scope with explicit current evidence before implementation planning”] |
</phase_requirements>

## Summary

Plan this phase as a reproducible evidence-data pipeline with five gates: freeze the sorted 110-path inventory; enumerate every actionable claim; adjudicate each claim against the live tree; resolve only surviving operator decisions; then rewrite requirements and roadmap from the resulting ledger. The corpus records its historical authority as commit `c8417fbc`, and explicitly says its old `file:line` references belong to that tree. [VERIFIED: .planning/reviews/unit-test-adversarial/README.md:7-9 — “Tree reviewed: branch `features/unit-test-refactor` at commit `c8417fbc`” and “All `file:line` references in the reports refer to that tree.”]

The current directory layout does contain 110 Markdown files, with 45 first-level area reports, 58 files below `adversarial/`, and seven first-level controls/syntheses. This was positively enumerated from the live filesystem during research, not inferred from report prose. [VERIFIED: live `rg --files`/`find` inventory on 2026-09-04] The corpus also warns that split adversarial areas issue overlapping grading verdicts and that its own summaries can disagree with marker counts, so plan completion around identity and referential integrity, never around inherited aggregate counts. [VERIFIED: .planning/reviews/unit-test-adversarial/_AUDIT.md — live file read on 2026-09-04]

**Primary recommendation:** Build and test the validator/generator first, then execute bounded review batches that can only mark a file complete when every extracted claim links to a terminal, evidence-complete ledger record. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:23-53 — D-01 through D-10]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Corpus inventory and claim ledger | Repository tooling / planning artifacts | Filesystem | This is an offline repository audit; no runtime product tier owns it. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:9-14] |
| Behavioral and mutation probes | Test harness | Production module under observation | Probes observe public behavior without changing production/test code in Phase 1. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:57-70] |
| Structural proof | Static analysis / CodeGraph | Source/test tree | Static proof is reserved for non-executable structural claims. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:57-60] |
| Operator decisions | Planning/governance | Evidence ledger | Each choice is downstream of surviving, linked premises. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:72-86] |
| Requirement and roadmap reconciliation | Planning/governance | Evidence ledger | Phase 2 is gated on the rewritten active scope. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:88-101] |

## Project Constraints (from AGENTS.md)

- When `.codegraph/` exists, use `codegraph explore` before grep/find or direct file reading to locate or understand code. [VERIFIED: AGENTS.md:1-10 — “reach for it BEFORE grep/find or reading files when you need to understand or locate code”]
- CodeGraph is a discovery aid, not evidence by itself for a behavioral claim; the plan must still record the current source/test references and the validating probe or static proof required by D-07 and D-11. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:42-44,57-60]

## Standard Stack

### Core

| Library/tool | Version | Purpose | Why Standard |
|---|---:|---|---|
| Node.js built-ins (`node:fs`, `node:path`) | `>=20.19.0` project contract; `v26.8.1` available | Enumerate, parse, render, and validate artifacts | No new dependency is needed; recursive `readdir` exists from Node 20.1.0 and results must be explicitly sorted. [VERIFIED: package.json:32-34 — `"node": ">=20.19.0"`] [CITED: https://nodejs.org/api/fs.html] |
| `node:test` + `node:assert/strict` | bundled with Node | Unit-test validator, generator, and negative fixtures | These are the mandated project test tools. [VERIFIED: .agents/skills/typescript-unit-testing-review/SKILL.md:16-19] |
| CodeGraph CLI | installed | Locate current symbols and call paths before textual search | Required by AGENTS.md when `.codegraph/` exists. [VERIFIED: environment probe on 2026-09-04] |
| Git CLI | `2.55.0` available | Record current commit and inspect historical `c8417fbc` when necessary | The historical commit exists locally and is the corpus provenance anchor. [VERIFIED: live `git cat-file -t c8417fbc` returned `commit` on 2026-09-04] |

### Supporting

| Library/tool | Version | Purpose | When to Use |
|---|---:|---|---|
| TypeScript | `^6.0.3` | Type-check any new validator/test modules | Use if the phase implements the tooling as `.ts`; preserve repository ESM conventions. [VERIFIED: package.json:29,98] |
| Prettier / ESLint / Fallow | repository-pinned | Existing quality gates | Run through `npm run check` after tooling and tests are complete. [VERIFIED: package.json:75-96] |
| `jq` | available | Ad-hoc ledger inspection only | Helpful to reviewers, but the blocking validator must not depend on an undeclared workstation utility. [VERIFIED: environment probe on 2026-09-04] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|---|---|---|
| Repository-native Node script | Shell/grep pipeline | Reject: shell parsing is too fragile for nested Markdown claims, referential integrity, and portable negative fixtures. [VERIFIED: corpus report formats sampled from first-pass and adversarial records on 2026-09-04] |
| Explicit schema assertions in code | Add a schema package | Do not add a package for a phase-local closed JSON format; focused assertions and exhaustive validation are sufficient and avoid a package-legitimacy/install gate. [ASSUMED] |

**Installation:** None. This phase should add no external package. [VERIFIED: required capabilities are present in Node and current devDependencies; package.json:8-30]

## Package Legitimacy Audit

Not applicable: the recommended implementation installs no external package. [VERIFIED: Standard Stack above]

## Architecture Patterns

### System Architecture Diagram

```text
live corpus directory
        |
        v
sorted path inventory ---- mismatch/duplicate ----> blocking validator failure
        |
        v
per-file claim extraction ---- administrative only ----> completed file record
        |
        v
namespaced source claims ---> canonical finding ledger <--- duplicate links
                                      |
             +------------------------+-----------------------+
             |                        |                       |
             v                        v                       v
     behavioral probe          mutation probe          static/call-graph proof
             |                        |                       |
             +------------------------+-----------------------+
                                      |
                                      v
                       terminal status + route + rationale
                                      |
                    +-----------------+------------------+
                    v                                    v
          surviving decision dossiers         scope-impact reconciliation
                    |                                    |
                    v                                    v
          recorded operator choices          REQUIREMENTS.md + ROADMAP.md
                    \____________________  __________________/
                                         \/
                         generated Markdown + final validator
```

This flow directly implements the locked separation of source records, canonical findings, evidence status, routing, and operator decisions. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:23-53,72-101]

### Recommended Project Structure

```text
.planning/phases/01-live-evidence-revalidation/
├── 01-REVALIDATION.json       # canonical file/finding/decision/scope ledger
├── 01-REVALIDATION.md         # generated human-readable view
├── 01-REVALIDATION-SCHEMA.md  # field semantics and reviewer protocol
└── 01-RESEARCH.md             # this planning research
scripts/
├── revalidation.mjs           # inventory, validate, and render subcommands
└── revalidation.negative.mjs  # hermetic planted-invalid fixtures
```

The two canonical output paths are locked verbatim: `01-REVALIDATION.json` and `01-REVALIDATION.md`. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:26-28 — “`01-REVALIDATION.json`” and “`01-REVALIDATION.md`”] The exact script and schema-document paths above are recommendations, not existing paths. [ASSUMED]

### Pattern 1: Two-level identity model

Use `files[]` for exactly one record per corpus path and `findings[]` for canonical issues. Each file record owns `claimRefs[]`; each source claim identity is `<full-corpus-path>#<preserved-label-or-local-ordinal>`. Duplicate claims remain source records and point to one canonical finding. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:23-38]

Recommended invariants:

- `files.map(path)` exactly equals a freshly enumerated, sorted corpus path list. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:32-34,51-53]
- Every claim belongs to exactly one file and links to exactly one canonical finding unless explicitly administrative. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:23-25,35-47]
- Every duplicate points to a non-duplicate canonical record; reject cycles and dangling references. [ASSUMED]
- File outcome is derived from linked findings, never entered independently without cross-checking. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:29-31]

### Pattern 2: Discriminated evidence records

Use method-specific records so the validator can demand the right proof:

```js
// Recommended skeleton; field names are discretionary.
{
  method: "behavioral-probe",
  command: "node --test <focused-test-or-probe>",
  exitCode: 1,
  observed: "<exact failure summary>",
  sourceRefs: ["<current path:line>"],
  testRefs: ["<current path:line or N/A reason>"]
}
```

The permitted evidence methods are behavioral probes for production defects, mutations for test-strength claims, and static/call-graph proof only for non-executable structural claims. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:57-60 — “failing behavioral probes”, “surviving mutations”, and “current call-graph or static proof”]

### Pattern 3: Batch by review area, close by file

Use the 45 first-pass area slugs as work partitions because adversarial split reports map back to those areas, but calculate completion only at the individual 110-file level. [VERIFIED: .planning/reviews/unit-test-adversarial/README.md:13-19] High-volume split areas should be separate plans or waves to cap reviewer context, while shared synthesis/control documents should be reviewed after their referenced area claims exist in the ledger. [ASSUMED]

Suggested plan sequence:

1. Wave 0: schema/protocol, locked inventory, renderer, validator, and planted-invalid fixtures. [ASSUMED]
2. Area batches: first-pass report plus all associated adversarial slices; populate claims and live dispositions. [ASSUMED]
3. Control batch: briefs, `_AREAS.md`, `_AUDIT.md`, `META-FINDINGS.md`, README, and clean-list repair; extract factual/prescriptive claims and reconcile contradictions. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:45-50]
4. Decision batch: nine dossiers in risk/dependency order. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:74-86]
5. Scope batch: requirement-by-requirement impact, roadmap retirement/splitting, regenerated view, final validator. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:90-101]

### Pattern 4: Positive stale proof

For every stale disposition, require all three: current symbol/replacement location, rerun of original or equivalent probe, and an explanation of the invalid premise. A missing old path, changed line number, or passing aggregate suite is not stale proof. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:61-64]

### Anti-Patterns to Avoid

- **Counting headings or severity markers as findings:** reports group repeated instances and adversarial slices can re-grade the same original claim. Use explicit source-claim identities and canonical links. [VERIFIED: .planning/reviews/unit-test-adversarial/_AUDIT.md — live file read on 2026-09-04]
- **Treating “green” as refutation:** a weak test can remain green under a wrong implementation; use the mutation named by the claim. [VERIFIED: .agents/skills/typescript-unit-testing-review/SKILL.md:8-14]
- **Copying old line references:** the corpus explicitly anchors those references to `c8417fbc`. [VERIFIED: .planning/reviews/unit-test-adversarial/README.md:7-9]
- **Deleting duplicate or stale source records:** preserve them and change status/routing. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:35-50,90-96]
- **Editing production/tests while adjudicating:** Phase 1 establishes evidence and scope; later phases own confirmed implementation. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:9-14]
- **Marking a file complete before claim reconciliation:** path visitation alone does not count. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:29-31]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Test runner/assertions | New harness or assertion DSL | `node:test`, `node:assert/strict` | Project-mandated and already available. [VERIFIED: .agents/skills/typescript-unit-testing-review/SKILL.md:16-19] |
| Code navigation | Regex-only call-graph reasoning | CodeGraph first, then current source reads | AGENTS.md requires CodeGraph-first discovery. [VERIFIED: AGENTS.md:1-10] |
| Evidence status inference | Infer stale from missing files/lines or a green suite | Positive stale proof protocol | Locked by D-12. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:61-64] |
| Human-readable report maintenance | Edit JSON and Markdown separately | Deterministic Markdown generator plus drift check | Locked by D-02. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:26-28] |
| Corpus inventory | Maintained list copied from README | Live recursive enumeration, normalization, explicit sort | README is historical prose; Node enumeration supports recursion but does not promise sorted output. [CITED: https://nodejs.org/api/fs.html] |

**Key insight:** the hard problem is proof completeness and traceability, not JSON serialization. The validator must reject semantically incomplete records even when the JSON parses. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:42-53]

## Runtime State Inventory

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | None identified. Phase outputs are repository files; no database/datastore is named as an authority for the corpus. [VERIFIED: required phase artifacts and canonical references in .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:118-168] | No data migration. Revalidate if an individual finding explicitly concerns stored runtime data; that evidence belongs to the finding, not the phase ledger's own state. [ASSUMED] |
| Live service config | None applicable to the revalidation ledger. Probes touching external service configuration, credentials, or real user state are prohibited without approval. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:67-70] | Use injected collaborators or temporary roots; otherwise keep the finding unresolved. No service mutation in Phase 1. [VERIFIED: same source] |
| OS-registered state | None identified. The phase does not rename or re-register a service, task, daemon, or package. [VERIFIED: Phase Boundary, .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:7-14] | No OS migration. If a corpus claim names OS state, use a non-destructive probe or record an approval-dependent gap. [ASSUMED] |
| Secrets/env vars | No ledger secret or environment-variable rename. Real credentials and developer state are outside default probe authority. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:67-70] | Never record secret values in command output; use fake environment/config inputs. [ASSUMED] |
| Build artifacts / installed packages | No rename of an installed package. Generated `01-REVALIDATION.md` is a derived artifact that must be regenerated from JSON and checked for drift. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:26-28] | Regenerate the view at every ledger change; do not migrate installed artifacts. [VERIFIED: same source] |

## Common Pitfalls

### Pitfall 1: False 110/110 completeness

**What goes wrong:** every path exists in `files[]`, but unlabeled claims, brief prescriptions, or duplicated findings were never linked. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:23-47]

**How to avoid:** derive completion only when all extracted claims have valid links and terminal evidence; include negative fixtures for missing file, duplicate path, duplicate claim identity, dangling finding, incomplete evidence, illegal status/route, and Markdown drift. [ASSUMED]

### Pitfall 2: Confusing historical grading with current disposition

**What goes wrong:** `CONFIRMED`, `REFUTED`, or `DUPLICATE-OF` in the adversarial pass is copied as live truth. Those are historical verdicts against the first pass, not evidence against the post-v1.19 tree. [VERIFIED: .planning/reviews/unit-test-adversarial/README.md:15-19]

**How to avoid:** preserve the old verdict as source metadata; independently assign the new evidence status from current proof. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:39-50]

### Pitfall 3: A mutation is described but not executed

**What goes wrong:** the ledger repeats a report's hypothetical mutation without recording that it survived now. [VERIFIED: evidence ladder requires “surviving mutations”, .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:57-60]

**How to avoid:** record exact patch/probe, focused command, exit code, and observed result; restore the working tree after each reversible mutation and verify no unrelated changes were touched. [ASSUMED]

### Pitfall 4: Decision dossiers race ahead of premises

**What goes wrong:** operator choices are made from META-FINDINGS before all linked area claims settle, forcing later reversals. [VERIFIED: .planning/REQUIREMENTS.md:18-19]

**How to avoid:** the validator rejects a resolved decision if any premise is `inconclusive` or lacks live evidence; present dossiers one at a time in D-16 order. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:65-86]

### Pitfall 5: Scope rewrite destroys history

**What goes wrong:** stale requirements are deleted or marked implemented, breaking traceability. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:90-96]

**How to avoid:** retain IDs and evidence trail, split mixed requirements, and retire empty phases without renumbering. [VERIFIED: same source]

## Code Examples

### Deterministic live inventory

```js
// Source: Node.js fs.readdirSync documentation + repository sorting precedent.
const entries = readdirSync(corpusRoot, { recursive: true, withFileTypes: true })
const paths = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => normalizeRelativePath(entry))
  .sort()
```

Recursive enumeration and `Dirent` output are documented by Node; explicit sorting is required because enumeration order is not the locked identity order. [CITED: https://nodejs.org/api/fs.html] The repository's direct-coverage inventory also sorts its discovered paths before validating completeness. [VERIFIED: scripts/test-coverage-direct.mjs:72-81 — CodeGraph source read on 2026-09-04]

### Completeness assertion shape

```js
assert.deepStrictEqual(
  ledger.files.map(({ path }) => path),
  liveCorpusPaths,
)
assert.strictEqual(new Set(ledger.files.map(({ path }) => path)).size, 110)
```

The literal `110` is locked by the requirement and validator decision. [VERIFIED: .planning/REQUIREMENTS.md:11-13 — “all 110 files”] Compare the whole sorted list, not only the count, so one missing and one extra path cannot cancel out. [ASSUMED]

### Generated-view drift check

```js
const expectedMarkdown = renderRevalidation(ledger)
assert.strictEqual(readFileSync(markdownPath, 'utf8'), expectedMarkdown)
```

This implements the locked single-source rule: JSON is canonical and drift is a validation failure. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:26-28]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Plan from consolidated `META-FINDINGS.md` and old locations | Revalidate every source claim against live tree, then plan | Post-v1.19 milestone boundary | Historical reports remain evidence but do not authorize implementation. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:9-14,48-50] |
| Trust per-report counts/headings | Canonical identities plus linked duplicates and derived totals | Phase 1 decision D-05 | Overlapping split reports and grouped findings no longer corrupt totals. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:35-38] |
| Maintain narrative result manually | Canonical JSON generates Markdown | Phase 1 decision D-02 | Machine validation and human review share one source. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:26-28] |

**Deprecated/outdated:** archived `file:line` locations from `c8417fbc` are locator hints only. [VERIFIED: .planning/reviews/unit-test-adversarial/README.md:7-9]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Explicit in-code schema assertions are preferable to adding a schema dependency for this phase-local format. | Standard Stack | Planner may choose an existing approved schema mechanism instead. |
| A2 | Suggested script/schema documentation paths are new recommendations. | Architecture Patterns | Planner must choose paths that satisfy current repository conventions. |
| A3 | Review batches should group first-pass reports with their adversarial slices and defer synthesis controls until area claims exist. | Architecture Patterns | Different batching may be more efficient, but gates must remain the same. |
| A4 | Duplicate-link cycle rejection and semantic negative-fixture set are necessary validator details. | Architecture / Pitfalls | A different model can satisfy the locked integrity requirement if equally complete. |
| A5 | No runtime-state migration is needed beyond repository artifacts. | Runtime State Inventory | An individual corpus finding may reveal external state requiring a separately approved probe. |

## Open Questions (RESOLVED)

1. **Exact JSON field names and schema layout — RESOLVED**
   - The canonical ledger is normalized with top-level `files`, `sourceClaims`, `findings`, `decisions`, and `scopeChanges` arrays. `files` holds one record per locked corpus path and links to namespaced source-claim IDs. `sourceClaims` preserves every report-local label or deterministic unlabeled ordinal and links to exactly one canonical finding. `findings` owns evidence status, routing, current source/test references, the discriminated validation record, rationale, and destination. `decisions` links premise finding IDs to evidence, options, selection/rejection, and downstream consequences. `scopeChanges` links each requirement/phase edit to findings and decisions. IDs and cross-links are unique, repository-relative paths are normalized POSIX paths, and array order is deterministic. `01-REVALIDATION-SCHEMA.md` is the executable prose contract and `01-REVALIDATION.json` is the canonical instance. [RESOLVED from D-01 through D-10 and planner design]

2. **How to execute destructive mutation probes safely — RESOLVED**
   - Copy the required source-test pair and supporting fixture files into a repository-local temporary directory, apply the mutation only inside that isolated copy, and run the focused test against the copy. Record the exact mutation, command, exit status, and observed surviving failure/pass behavior, then remove the temporary copy. Never patch the developer's live source or test files. Probes involving real user state, credentials, network access, or destructive access remain blocked on explicit approval and otherwise stay inconclusive. [RESOLVED from D-11 through D-14]

3. **Current CodeGraph graph status and final tracked validator locations — RESOLVED**
   - Use the existing CodeGraph index per `AGENTS.md`; it is independent of the disabled GSD graphify feature, which remains out of scope. The validator/renderer is tracked at `scripts/revalidation.mjs`, its semantic negative runner at `scripts/revalidation.negative.mjs`, and its Node test suite at `tests/architecture/revalidation.test.ts`. These are the final paths used by every plan and by `01-VALIDATION.md`; no runtime mirror or generated alternate location is permitted. [RESOLVED from live CodeGraph/tooling inspection and the Wave 0 design]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---:|---|---|
| Node.js | validator, renderer, focused probes | ✓ | `v26.8.1` | Project minimum is `>=20.19.0`. [VERIFIED: package.json:32-34] |
| npm | project scripts | ✓ | `11.19.0` | direct `node` commands for focused scripts |
| Git | historical/current evidence | ✓ | `2.55.0` | current-tree reads only when history is unnecessary |
| CodeGraph CLI | code discovery | ✓ | installed; version not reported | direct reads only after CodeGraph discovery |
| jq | optional inspection | ✓ | version not probed | Node JSON parsing |

**Missing dependencies with no fallback:** None observed. [VERIFIED: environment probes on 2026-09-04]

**Missing dependencies with fallback:** Context7 CLI/MCP was unavailable; official Node documentation was obtained from nodejs.org through web search and classified MEDIUM by the research confidence seam. [VERIFIED: tool probes and `classify-confidence` on 2026-09-04]

## Validation Architecture

Nyquist validation is enabled. [VERIFIED: .planning/config.json:16-22 — `"nyquist_validation": true`]

### Test Framework

| Property | Value |
|---|---|
| Framework | Node built-in test runner on available Node `v26.8.1` [VERIFIED: environment probe] |
| Config file | none; repository scripts invoke `node --test` directly [VERIFIED: package.json:82-95] |
| Quick run command | `node --test <new revalidation validator test path>` [VERIFIED: .agents/skills/typescript-unit-testing-review/SKILL.md:12-14] |
| Full suite command | `npm run check` [VERIFIED: package.json:75-96] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| RVAL-01 | Exactly the locked sorted 110-path inventory is represented and every file completes only after claim reconciliation. | unit + live manifest check | `node scripts/revalidation.mjs validate` | ❌ Wave 0 [ASSUMED path] |
| RVAL-02 | Unique identities, valid links/status/routes, method-specific evidence, and generated-view equality are enforced. | unit + negative fixtures | `node --test tests/architecture/revalidation.test.ts` | ❌ Wave 0 [ASSUMED path] |
| RVAL-03 | A decision cannot resolve until every premise has live terminal evidence and selected/rejected alternatives are recorded. | unit | `node --test tests/architecture/revalidation.test.ts --test-name-pattern='decision'` | ❌ Wave 0 [ASSUMED path] |
| RVAL-04 | Scope changes preserve IDs/history; stale-only requirements leave active scope and mixed requirements split. | unit + artifact validation | `node scripts/revalidation.mjs validate` | ❌ Wave 0 [ASSUMED path] |

### Sampling Rate

- **Per task commit:** focused validator tests plus `node scripts/revalidation.mjs validate`. [ASSUMED]
- **Per wave merge:** regenerate Markdown, validate, then run tests for any behavioral probes retained as evidence. [ASSUMED]
- **Phase gate:** `npm run check`, generated view clean, no `inconclusive` record, and exact 110/110 coverage before Phase 2 planning. [VERIFIED: package.json:75-96; .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:51-53,65-66,100-101]

### Wave 0 Gaps

- [ ] `scripts/revalidation.mjs` — enumerate, validate, and render ledger. [ASSUMED path]
- [ ] `tests/architecture/revalidation.test.ts` — positive and planted-negative semantic validation. [ASSUMED path]
- [ ] Schema/protocol documentation defining identities, required fields, evidence ladder, and completion rules. [ASSUMED]
- [ ] Initial locked `01-REVALIDATION.json` with all 110 sorted file records and zero falsely completed reviews. [VERIFIED output path: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:26-28]
- [ ] Negative cases for missing/extra/duplicate paths, duplicate identities, dangling/cyclic duplicate links, missing evidence, illegal status/route, unresolved decision premise, and Markdown drift. [ASSUMED]

## Security Domain

Security enforcement is not explicitly disabled, so this section is required. [VERIFIED: .planning/config.json:1-54 — no `security_enforcement: false` setting]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | Phase tooling must not use credentials or live identity providers. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:67-70] |
| V3 Session Management | no | No session-bearing service is part of the ledger pipeline. [VERIFIED: Phase Boundary, .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:7-14] |
| V4 Access Control | no | Repository-local validation only; filesystem sandbox/normal repository permissions apply. [ASSUMED] |
| V5 Input Validation | yes | Treat corpus Markdown and JSON as untrusted inputs; validate paths, identities, enumerations, references, and required evidence before rendering or routing. [VERIFIED: D-10, .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:51-53] |
| V6 Cryptography | no | D-04 explicitly forbids content hashing; no cryptographic function is required. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:32-34] |

### Known Threat Patterns for Repository Evidence Tooling

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Path traversal or symlink escape in a recorded reference | Tampering / Information disclosure | Normalize repo-relative paths, reject absolute/`..` escapes, and do not read referenced paths outside the repository/corpus root. [ASSUMED] |
| Markdown content interpreted as instructions | Spoofing / Tampering | Treat corpus text as evidence data; only project/orchestrator instructions govern execution. [VERIFIED: mandatory untrusted-input boundary loaded for this research session] |
| Evidence output captures credentials or real user paths | Information disclosure | Hermetic fixtures, redacted command output, and approval gate for real state. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:67-70] |
| Generated Markdown manually altered | Tampering | Regenerate from canonical JSON and fail on byte drift. [VERIFIED: .planning/phases/01-live-evidence-revalidation/01-CONTEXT.md:26-28] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/01-live-evidence-revalidation/01-CONTEXT.md` — locked decisions, outputs, evidence ladder, routing, and scope rules.
- `.planning/REQUIREMENTS.md` — RVAL-01 through RVAL-04.
- `.planning/reviews/unit-test-adversarial/README.md` — historical commit and corpus taxonomy.
- `.planning/reviews/unit-test-adversarial/META-FINDINGS.md` and `_AUDIT.md` — operator-decision structure and corpus contradictions, treated as claims requiring revalidation.
- `.agents/skills/typescript-unit-testing-review/SKILL.md` and `.claude/rules/typescript-unit-testing.md` — current unit-test review contract.
- `package.json` and `.planning/config.json` — live tools, commands, versions, engine, and validation toggle.
- `scripts/test-coverage-direct.mjs` and `scripts/check-corresponding-tests.mjs` — repository precedents for sorted discovery, completeness, round-trip mapping, and negative fixtures (read via CodeGraph).

### Secondary (MEDIUM confidence)

- [Node.js File System documentation](https://nodejs.org/api/fs.html) — recursive `readdir` and `Dirent` behavior.
- [Node.js Test Runner documentation](https://nodejs.org/api/test.html) — direct test invocation and concurrency behavior.

### Tertiary (LOW confidence)

- Recommendations explicitly tagged `[ASSUMED]`, summarized in the Assumptions Log.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — uses current repository tools and official Node documentation.
- Architecture: HIGH — driven by 23 locked implementation decisions and live corpus inspection.
- Pitfalls: HIGH — derived from explicit corpus contradictions and the current unit-test review contract.

**Research date:** 2026-09-04
**Valid until:** 2026-10-04; re-run the live inventory and environment probes if the tree changes before planning.
