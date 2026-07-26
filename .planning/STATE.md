---
gsd_state_version: 1.0
milestone: v1.15
milestone_name: frontmatter-compliance
current_phase: 86
status: planning
stopped_at: Phase 86 context gathered
last_updated: "2026-07-26T10:46:58.166Z"
last_activity: 2026-07-25
last_activity_desc: Milestone v1.15 roadmap created (1 phase, 11/11 requirements mapped)
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Current Position

Phase: 86 — Skill and command frontmatter compliance (not started)
Plan: —
Status: Roadmap created; ready to plan Phase 86
Last activity: 2026-07-25 — Milestone v1.15 roadmap created (1 phase, 11/11 requirements mapped)

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

**Last session:** 2026-07-26T10:46:58.135Z
**Stopped at:** Phase 86 context gathered
**Resume file:** .planning/phases/86-skill-and-command-frontmatter-compliance/86-CONTEXT.md

## Performance Metrics

No plans executed yet for v1.15.

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| —    | —        | —     | —     |

## Decisions

None recorded yet for v1.15 (design decisions are pre-captured in the Roadmap Summary
above and in `docs/research/issue-101-skill-frontmatter-diagnosis.md`). Plan-phase and
execution will record per-plan decisions here.

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

- Plan Phase 86 with `/gsd-plan-phase 86`
