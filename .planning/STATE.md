---
gsd_state_version: 1.0
milestone: v1.15
milestone_name: frontmatter-compliance
status: Awaiting next milestone
stopped_at: Completed 86-05-PLAN.md
last_updated: "2026-07-28T12:20:36.205Z"
last_activity: 2026-07-28
last_activity_desc: Milestone v1.15 completed and archived
progress:
  total_phases: 1
  completed_phases: 1
  total_plans: 5
  completed_plans: 5
  percent: 100
current_phase: 86
current_phase_name: Skill and command frontmatter compliance
---

# Project State

## Current Position

Phase: Milestone v1.15 complete
Plan: —
Status: Awaiting next milestone
Last activity: 2026-07-28 — Milestone v1.15 completed and archived

## Roadmap Summary

- 1 phase (Phase 86), continuing the global counter from Phase 85 (v1.14
  mcp-string-refs).

- All 11 requirements (PARSE-01/02, SKILL-01/02/03, WTU-01/02, CMD-01, WARN-01,
  CLASS-01, NREG-01) land in one cohesive phase. Rationale: the two-gate parse model
  spans BOTH the skills and commands staging seams (PARSE-01), and the new
  failure-class REASONS token (CLASS-01), the install-time warning surface (WARN-01),
  and the verbatim-write guarantee (NREG-01) are shared machinery both bridges consume.
  The only bridge-specific work is skill *synthesize* (SKILL-01/02/03 + WTU folding) vs
  command *neutralize* (CMD-01). Splitting skills-from-commands would strand a
  single-requirement commands phase or leave a parse gate wired but degradation
  deferred — both anti-patterns. One phase delivers the whole capability.

- Locked design decisions carried into the phase (from
  `docs/research/issue-101-skill-frontmatter-diagnosis.md`):

  - Mirror Claude Code's *observable* behavior via Pi's own machinery — literal
    empty-metadata parity is impossible (Pi returns `skill: null` on empty
    description). Unparseable skill → synthesized `disable-model-invocation: true`
    block + short fixed placeholder description, body verbatim, install never
    hard-fails. Unparseable command → neutralize (Pi's command loader has no
    non-empty-description gate).

  - Parse with Pi's own `parseFrontmatter` (public root export since peer floor
    `>=0.74.0`; import via the `platform/pi-api.ts` boundary for byte-identical
    accept/reject). Verify it was already exported at the declared floor.

  - Two gates: source frontmatter parsed BEFORE rewrite/substitution (attribution +
    trigger); staged bytes re-parsed AFTER as a Pi-acceptability backstop (a valid
    source whose staged output fails is self-inflicted — loud/test-guarded, never
    attributed to the author).

  - `when_to_use` appended to the Pi `description`, combined text truncated at 1,536
    chars (Claude Code's skill-listing cap).

  - Written skill `name` verified against the parsed value (catches folded-scalar
    corruption), not a blind line regex.

  - Classification: failure-class, not soft-degrade — a malformation of a *supported*
    component. New token parallels `malformed mcp` in `FAILURE_REASONS`; `REASONS`
    tuple amendment stays byte-stable (OUT-08).

  - Rejected approaches (do NOT rebuild): quote-repair heuristic; whole-block re-emit
    (agents-bridge style) — skills' target format is real structured YAML.

  - The diagnosis doc's Prevalence section is STALE: its two example skills were fixed
    upstream in `acolomba/claude-plugins` PR #17 (`>-` block scalars). The code gap
    remains real for third-party plugins (issue #101 is against another plugin). The
    bridge does NOT corrupt a valid source; the fix is a robustness/compliance gate.

## Session

**Last session:** 2026-07-26T14:27:52.840Z
**Stopped at:** Completed 86-05-PLAN.md
**Resume file:** None

## Performance Metrics

No plans executed yet for v1.15.

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |
| Phase 86 P01 | 35min | 3 tasks | 11 files |
| Phase 86 P02 | 36min | 2 tasks | 10 files |
| Phase 86 P03 | 45min | 2 tasks | 5 files |
| Phase 86 P04 | 22min | 1 tasks | 3 files |
| Phase 86 P05 | 30min | 1 tasks | 5 files |

## Decisions

None recorded yet for v1.15 (design decisions are pre-captured in the Roadmap Summary
above and in `docs/research/issue-101-skill-frontmatter-diagnosis.md`). Plan-phase and
execution will record per-plan decisions here.

- [Phase 86]: parseFrontmatter re-exported through platform/pi-api.ts as the sole sanctioned import site (PARSE-01)
- [Phase 86]: REASONS catalog amended 35->37 with per-kind malformed skill / malformed command under FAILURE_REASONS (D-86-01 / CLASS-01)
- [Phase 86]: setDescriptionScalar replaces the full description node span incl. block scalars, never a lone description: line (SKILL-03 corruption class)
- [Phase ?]: 86-02: two read-only parseFrontmatter gates wrap the skills staging seam; gate-1 throw synthesizes disable-model-invocation (body verbatim), gate-2 throw is our defect (loud)
- [Phase ?]: 86-02: degrade record threads bridge -> installCtx.frontmatterDegradations -> standalone {malformed skill} warning row + degradedKinds outcome seam
- [Phase ?]: 86-03: augment arm runs only on the gate-1 RETURN branch; NREG-01 keeps a present in-cap description with no when_to_use byte-identical
- [Phase ?]: 86-03: description-less+bodyless skills fall back to a fixed non-empty placeholder so Pi does not drop them (skill:null on empty description)
- [Phase ?]: 86-03: SKILL-03 name safety = full name-node-span replacement + re-parse assertion that written name equals generated name
- [Phase ?]: WARN-01 orchestrated surface: reconcile (installed) row raised to warning with one malformed skill/command token per kind; degraded-but-installed keeps (installed), not (partially-installed) (D-86-03)
- [Phase ?]: redactAbsolutePaths applied at the surfacePostCommitWarnings emission seam so all post-commit warnings are redacted before notifyDiagnostic (T-86-03/NFR-9)

## Deferred Items

Items acknowledged and deferred at v1.14 milestone close on 2026-07-23. All are
pre-existing (none from v1.14 mcp-string-refs).

| Category | Item | Status |
|----------|------|--------|
| backlog | REASON-01 — unify all parse-error reasons under a `{malformed <feature>}` family | deferred (v1.15 adds one more failure-class member; broad unification stays out of scope) |
| debug | knowledge-base | unknown |
| quick_task | 260621-kmm-add-explicit-enabled-boolean-field-to-pl | unknown |
| quick_task | 260718-tli-fix-pr-88-external-contribution-to-pass- | unknown |
| todo | 2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in | testing |
| seed | SEED-001-remote-plugin-status-fetch-verb | dormant (appears superseded by url-source/fetch-plugin — verify + close) |

## Operator Next Steps

- Start the next milestone with /gsd-new-milestone
