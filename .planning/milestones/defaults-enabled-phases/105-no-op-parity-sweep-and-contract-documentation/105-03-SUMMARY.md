---
phase: 105-no-op-parity-sweep-and-contract-documentation
plan: 03
subsystem: docs
tags: [documentation, enablement, defaultEnabled, requirements, readme]

requires:
  - phase: 104-pre-install-read-surfaces
    provides: the shipped three-input pre-install read rule and the review findings this plan corrects
  - phase: 102-install-and-persistence
    provides: the install-time write-through of the disabled state that the contract describes
provides:
  - a single contract document owning the enablement precedence rule end to end
  - one citable home for both enablement divergences (the dependency-requirement override and the entry-only read rule)
  - README reachability for the contract in both language editions
  - corrected OUT-02 and DOC-02 requirement text, and the matching roadmap criterion
affects: [105-06, source-comment re-anchoring, milestone close]

actuals:
  tokens: 5600
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Contract document modeled on docs/env-vars.md: vocabulary before the table that uses it, one `## Divergences and documented absences` section as the single citable home, affirmative absences"

key-files:
  created:
    - docs/plugin-enablement.md
  modified:
    - README.md
    - README.es.md
    - .planning/workstreams/defaults-enabled/REQUIREMENTS.md
    - .planning/workstreams/defaults-enabled/ROADMAP.md

key-decisions:
  - "The dependency divergence is stated as parsed-and-surfaced-but-never-honored, not as discarded wholesale — the false version was removed from the requirement and the roadmap in the same plan"
  - "The README pointer is a two-sentence paragraph rather than a lone bullet, because the configuration-files section is prose and carries no list"
  - "The contract records its own lack of an automated gate rather than acquiring one; building a documentation-test framework for one prose file was out of scope"

patterns-established:
  - "Divergence ownership: each caveat has one home; other surfaces point at it rather than restating it"
  - "Requirement corrections are wording-only — checkbox states, traceability rows and coverage counts do not move"

requirements-completed: [DOC-02]

coverage:
  - id: D1
    description: "docs/plugin-enablement.md states the shipped three-input precedence rule per surface, owns both divergences under `## Divergences and documented absences`, and records its own ungated status"
    requirement: "DOC-02"
    verification:
      - kind: other
        ref: "manual read of docs/plugin-enablement.md beside docs/output-catalog.md:380 — the two agree"
        status: pass
      - kind: other
        ref: "grep gates: `## Divergences and documented absences`=1, `## Not delivered (out of scope)`=1, `## Further reading`=1, `### `=2, `dropped entirely`=0, `not honored at all`=0, `D-104-0`=0, `--force`=0, `--unsupported`=0"
        status: pass
    human_judgment: true
    rationale: "The deliverable is prose. No automated gate binds it (recorded inside the document itself), so a human must confirm the claims match the code they describe."
  - id: D2
    description: "The contract is reachable from both README editions, in the configuration-files section of each"
    requirement: "DOC-02"
    verification:
      - kind: other
        ref: "grep -c 'docs/plugin-enablement.md' README.md = 1; README.es.md = 1; awk section attribution = `## Configuration files` / `## Archivos de configuración`"
        status: pass
    human_judgment: true
    rationale: "The Spanish sentence's register and terminology need a reader, not a grep."
  - id: D3
    description: "OUT-02 states the shipped three-input rule, DOC-02 states the dependency fact truthfully and covers the entry-only read rule, and the roadmap's criterion 3 carries the same corrected wording"
    requirement: "DOC-02"
    verification:
      - kind: other
        ref: "grep gates: REQUIREMENTS `not honored at all`=0 / `whose resolved`=0; ROADMAP `dropped entirely`=0; PDEP-01 counts unchanged (3 / 2); traceability rows and `v1 requirements: 15 total` unchanged; diff is 2 bullet lines + 1 criterion line"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-08-15
status: complete
---

# Phase 105 Plan 03: DOC-02 enablement contract Summary

**A new `docs/plugin-enablement.md` stating the shipped three-input enablement precedence rule per surface, owning both divergences under one citable heading, reachable from both READMEs — plus the OUT-02 / DOC-02 / roadmap wording corrections that stop three planning records contradicting the code.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-15T21:36:00Z
- **Completed:** 2026-08-15T21:48:00Z
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `docs/plugin-enablement.md` defines the three inputs before the table that uses them, then gives one precedence row per surface (install, update/reinstall, reconcile, the read surfaces, enable/disable), each transcribed from the shipped source named in the row.
- Both enablement divergences now have one home: the dependency-requirement override (quoted verbatim from the upstream plugins reference, including "at install **or enable** time") and the entry-only pre-install read rule, which previously lived only in an archiving phase decision ID.
- The document records its own absences affirmatively — including that it is NOT byte-gated, and that the central row renderer's drop of the pre-install token is covered by `tests/shared/notify-not-installed-reasons.test.ts` rather than by the catalog runner.
- Three planning records stopped describing a plugin's own dependency declarations as discarded wholesale; the pre-install requirement stopped naming the resolved default as the token's input.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the enablement contract document** - `3b47e5ac` (docs)
2. **Task 2: Make the contract reachable from both README editions** - `6ebd9e8a` (docs)
3. **Task 3: Stop the requirement and the roadmap contradicting the code** - `bacea408` (docs)

## Files Created/Modified

- `docs/plugin-enablement.md` - the enablement contract: three inputs, precedence per surface, where the state lives, both divergences, recorded absences, further reading
- `README.md` - one pointer to the contract in `## Configuration files`
- `README.es.md` - the Spanish sibling of the same pointer, same section
- `.planning/workstreams/defaults-enabled/REQUIREMENTS.md` - OUT-02 restated as the shipped three-input rule; DOC-02 corrected and widened to cover the entry-only read rule
- `.planning/workstreams/defaults-enabled/ROADMAP.md` - criterion 3's dependency clause corrected to match

## Decisions Made

- **The dependency divergence is stated as parsed-and-surfaced-but-never-honored.** `normalizeDependencies` (`orchestrators/plugin/info.ts`) filters a plugin's declared dependency array to its string-shaped elements, sorts them and renders them; the schema accepts the field opaquely on both declaration sites. What is missing is resolution, auto-install and any enablement consequence. The false "discarded wholesale" phrasing was removed from all three records rather than transcribed into a fourth.
- **Every sentence naming a plugin's own dependency declarations qualifies the word,** and the divergence paragraph says so explicitly, because the same word names the soft-dependency companion extensions on the notification rows.
- **The README pointer is a paragraph, not a bullet** (see Deviations).
- **No documentation-test framework was built.** `tests/docs/` does not exist despite appearing in the test glob, and `docs/output-catalog.md` is the only byte-gated document in the repository. The gap is recorded inside the new document as a stated limit.

## Verification performed

- **The manual comparison the plan requires was made.** The new document's read-surfaces precedence row was read beside `docs/output-catalog.md:380`. They agree: the catalog says the user's own `enabled` value wins in either direction and the marketplace entry answers only where the user has set none; the contract's row says `{installs disabled}` renders only where the user is silent AND the entry declares `false`, with the same both-directions consequence spelled out. The catalog's "two declarations decide the token" and the contract's "three inputs" are not in tension — the contract's Inputs-consulted cell for that row names exactly the same two, and the third input is the `plugin.json` site the row deliberately does not read.
- The divergence subsections follow the `docs/env-vars.md` templates named in the plan: the dependency override uses the "we implement only half the contract" shape, the entry-only rule uses the "the value is unknowable when we would need it, so we decline rather than approximate" shape.
- `pre-commit run --files <changed files>` clean on every commit (mdformat re-aligned the precedence table and renumbered the input list, as expected). The JavaScript formatter was never run over any markdown file.
- Grep gates from the acceptance criteria all pass; recorded per-deliverable in the `coverage:` frontmatter above.
- Per the executor brief, `npm test` / `npm run check` were NOT run — two sibling executors are mid-edit in the same worktree. Nothing in this plan touches `extensions/` or `tests/`.

## Deviations from Plan

### 1. [Rule 2 — Form choice] The README pointer is a paragraph, not a list item

- **Found during:** Task 2
- **Issue:** The plan describes the addition as a "bullet", copying the grammar of `README.md:28`'s hooks-compatibility bullet. But that bullet lives inside the five-item features list, and the host section the plan selects (`## Configuration files`) is prose plus tables with no list anywhere in it. A lone one-item bullet after a paragraph reads as a stray list item in both editions.
- **Fix:** Kept the plan's grammar for the link sentence verbatim ("For more information, see [Plugin enablement](docs/plugin-enablement.md).", and its Spanish counterpart "Para más información, consulta [Activación de complementos](...)") and rendered the addition as a two-sentence paragraph immediately after the paragraph that names those files as the authoritative record.
- **Files modified:** `README.md`, `README.es.md`
- **Verification:** Every Task 2 acceptance criterion still passes — one occurrence per edition, both attributed to the configuration-files heading, relative href with no leading slash, comparable two-line diffs, no reflow churn.
- **Committed in:** `6ebd9e8a`

---

**Total deviations:** 1 (form choice, no scope change)
**Impact on plan:** None. No requirement re-scoped, no acceptance criterion weakened.

## Findings surfaced (not fixed)

- **Two more planning records still describe a plugin's own dependency declarations as discarded.** `REQUIREMENTS.md`'s v2 bullet `DFEN-V2-01` says "Blocked on PDEP-01 (dependency declarations are currently dropped)", and its Out of Scope table row says "plugin `dependencies` are opaque and dropped today (PDEP-01)". Both carry the same imprecision this plan corrected two lines above them. They were left as found because the plan's acceptance criterion pins the diff to exactly two bullet lines, and the surgical-changes rule forbids widening a wording correction into a sweep. A later plan or the milestone close should apply the same correction to both.
- **`docs/env-vars.md` is still an orphan.** `docs/` has no index, and after this plan exactly two of its documents are reachable from the README. The plan explicitly forbids retro-linking it here; it is surfaced as a real gap.
- **The catalog and the contract now overlap on the pre-install token's prose.** They agree today, and nothing binds them. `docs/output-catalog.md:380` remains the byte-gated home of the rendered form; the contract is the home of the rule. If either is edited, the other needs a read.

## Issues Encountered

- The `trufflehog` pre-commit hook cannot run in a linked worktree (git-mode scan, `.git` is a file). Confirmed clean by a filesystem-mode scan over the committed paths before each commit — `verified_secrets: 0`, `unverified_secrets: 0` — then committed with `SKIP=trufflehog` per the repository's documented route.
- A sibling executor's commit (`21dfb4db`) landed between Task 2 and Task 3 in the shared worktree. Every commit used an explicit pathspec, so no sibling file was swept in; verified by the per-commit file lists.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `DOC-02` now covers the entry-only pre-install read rule, which is the precondition for the source-comment re-anchoring sweep: a comment citing `DOC-02` for that rule now cites a requirement that genuinely covers it, and `docs/plugin-enablement.md` is the durable prose home it can point at.
- `DOC-02`'s traceability row remains `Pending`; the requirement is not complete until the phase's remaining documentation plans land.

## Self-Check: PASSED

All five deliverable files exist on disk and all three task commits resolve in `git log`.

---
*Phase: 105-no-op-parity-sweep-and-contract-documentation*
*Completed: 2026-08-15*
