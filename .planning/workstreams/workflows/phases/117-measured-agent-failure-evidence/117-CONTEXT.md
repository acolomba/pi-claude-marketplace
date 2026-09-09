# Phase 117: Measured `agent()` failure evidence - Context

**Gathered:** 2026-09-09
**Status:** Ready for planning

<domain>
## Phase Boundary

The claim that decides whether a copied workflow script degrades or dies rests on
a measurement against a real engine rather than a source read, and every document
that states it says so at the grade it actually holds.

The seam is `tests/live-uat/` (a new standalone canary),
`docs/workflows-compatibility.md`'s `### agent() failure semantics` section, and
the archived `105-VERIFICATION.md`. This phase touches no production code under
`extensions/` -- it produces evidence and corrects records.

Requirements in scope: WEVID-01, WEVID-02, WDOCS-02.

</domain>

<decisions>
## Implementation Decisions

### D-117-01: What the canary is

- **The canary does not exist on this branch and must be created.**
  `105-VERIFICATION.md:91` calls `tests/live-uat/workflow-storage-canary.mjs`
  "PRESENT, code-reviewed", but that described the spike branch; the replay
  (109-114) never re-landed it. `ls tests/live-uat/` holds only
  `manifest-absence-canary.mjs`, `stop-canary.mjs` and `README.md`. Criterion 1
  reads as though the file is being extended. It is not.
- **It carries ONLY the `agent()` assertions WEVID-01 names.** The W1/W2/W3
  storage assertions the archived record describes belong to that archived
  milestone's requirement, and re-landing them is scope none of WEVID-01,
  WEVID-02 or WDOCS-02 asks for. If a later phase wants the storage canary back,
  it can say so.
- **The failure is driven, and the OBSERVABLE is asserted.** The assertion is
  rejection versus resolution to `null` -- what a script author actually
  experiences -- never which internal branch ran. A test that asserts the branch
  re-states the source read this phase exists to replace.
- **Prefer a shape that needs no provider credentials.** A failure occurring
  before any provider call still exercises the divergence. If credentials prove
  unavoidable, say so in the SUMMARY rather than quietly requiring them.
- **The exit contract matches the two existing canaries exactly.** An unmet
  precondition or an unobserved assertion exits NON-ZERO with a human-readable
  reason, so a verifier records `human_needed` rather than a silent pass. Never
  skip-and-pass when the engine is absent.

### D-117-02: Grade, version and counts

- **The engine version is 3.10.1, not the 3.5.1 criterion 3 names.** 3.10.1 is
  npm's current (`npm view @quintinshaw/pi-dynamic-workflows version`) and is the
  grade the compatibility doc already carries for its other rows. The criterion's
  pin is stale; correct it and record the correction rather than honoring a stale
  number.
- **The grade becomes `runtime-measured at 3.10.1` only if the canary actually
  runs.** Name the version inside the grade, never a bare "measured" -- the row
  directly above it already reads `runtime-measured` for the rejected engine, and
  two rows at different versions must not read identically.
- **If the canary genuinely cannot run, the row stays `source-read only` and the
  phase says so plainly.** Upgrading a grade on an unrun canary is the exact
  defect WDOCS-02 exists to correct; committing it in the same phase that
  corrects it would be indefensible.
- **The "six of the seven real Anthropic workflow scripts, twelve times in
  total" census is measured or dropped.** It appears ONLY in `REQUIREMENTS.md:64`
  -- never in the doc -- and has never been measured on this tree. Phase 116
  measured that ZERO plugins in either cached marketplace carry a `workflows/`
  directory, so those scripts may not be locally reachable at all. If they are
  not, state the `pipeline(...)` + `.filter(Boolean)` consequence without the
  unverifiable census. This is the milestone's "assume the enumeration is short
  until measured" rule applied to a figure nothing has ever checked.

### D-117-03: The 105 self-contradiction

- **The UNRUN record wins.** `105-VERIFICATION.md` carries `status: passed` and a
  status line reading "live canary closed 2026-08-16", while `:55` and `:91` say
  the W1/W2/W3 canary is UNRUN. Its own `why_human` field settles which is right:
  what closed on that date was **Phase 104's structurally identical canary**, not
  this one. The status line is the over-claim.
- **The archived artifact is corrected surgically, not rewritten.** Fix the false
  claim and add a dated note saying what was actually closed and when. Do not
  restate the history to look as though it was always right -- the point of the
  correction is that a record over-claimed, and erasing the evidence of that
  removes the lesson.
- **Scope is found by grep, not by memory.** All three sites in that file
  (frontmatter/status line, `:55`, `:91`) plus anything else citing it as
  evidence for a closed canary.

### Claude's Discretion

The canary's internal structure, the failure-induction technique, file naming,
and task/wave decomposition are at the planner's discretion within the
constraints above.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `tests/live-uat/manifest-absence-canary.mjs` and `stop-canary.mjs` -- the two
  established standalone canaries. Both are excluded from `npm run check`, both
  carry a whole-file `fallow-ignore-file unused-file` marker, and both are the
  two pre-approved entries in `.fallowrc.json`'s `duplicates.ignoredClones`.
- `tests/live-uat/README.md` -- carries the honesty contract in writing and a
  per-canary table a third entry must join.
- The scratch-install route, already written down in `105-VERIFICATION.md:9`:
  `npm install --prefix /tmp/wf-engine @quintinshaw/pi-dynamic-workflows` plus
  `PI_WORKFLOW_ENGINE_ROOT=/tmp/wf-engine/node_modules`.

### Established Patterns

- A canary exits non-zero with a human-readable reason on an unmet precondition,
  so an absent engine is reported rather than silently passed.
- Every canary cleans up after itself even on failure.
- The compatibility doc's tables carry a per-row Grade column; rows at different
  grades sit side by side deliberately and the doc says not to read the table as
  one uniform measurement.

### Integration Points

- `docs/workflows-compatibility.md` is in **Phase 114's** verification
  `covered_files`, so editing it will make 114's verification stale. That is
  expected and is why 114's re-verification is sequenced after this phase.
- `tests/architecture/workflows-doc-pins.test.ts` gates parts of that doc. Check
  whether the `agent()` section is gated before assuming an edit is free.
- A new top-level `tests/` directory would redden
  `tests/architecture/unit-suite-glob-completeness.test.ts`; `tests/live-uat/` is
  already exempt from the file-pairing gate.

</code_context>

<specifics>
## Specific Ideas

The doc's own sentence is the target to make true or false:

> The chosen engine's behavior has never been observed at run time, because
> driving it needs real subagent spawn machinery the fixtures avoid. It is stated
> here at the grade it holds today. Upgrading it to a measurement is separate
> work that has not been done, and no result should be inferred from this section
> until it has been.

This phase is that separate work. Either the sentence goes and a measured grade
replaces it, or the sentence stays and the phase says why it could not be
removed.

</specifics>

<deferred>
## Deferred Ideas

- Re-landing the W1/W2/W3 storage assertions from the archived canary. Out of
  scope here (D-117-01); a later phase can take it if the storage path wants
  live coverage again.

</deferred>
