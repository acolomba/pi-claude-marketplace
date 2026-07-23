# Phase 84: Agent skillPath resolution (end-to-end skill availability) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 84-emit-an-agent-local-skillpath-field-on-every-generated-agent
**Areas discussed:** Legend accuracy, Peer dependency floor

---

## Legend accuracy (AGSK-04)

Grounding: `frontmatter.ts:335` currently renders
`entry.preloaded ? "preloaded in your context" : "available on demand"`.
pi-subagents 0.35.x delivers skills lazily (listed as available, read on demand) —
never eager preload — so the "preloaded" annotation overclaims once `skillPath`
makes emitted skills actually resolve.

| Option | Description | Selected |
|--------|-------------|----------|
| Collapse to "on demand" | Every referenced skill annotates as `(available on demand)`; drop the `(preloaded in your context)` state and the `preloaded` branch. Accurate for 0.35.x lazy delivery. Re-amends AGSK-04 to single-state; updates byte-identity fixtures. In scope for Phase 84. | ✓ |
| Keep two-state wording | Retain `(preloaded in your context)` for emitted skills vs `(available on demand)` otherwise (current AGSK-04 amended form). Smaller diff, but "preloaded" misrepresents lazy delivery. | |

**User's choice:** Collapse to "on demand"
**Notes:** Folds the AGSK-04 wording correction into Phase 84 since this phase is
what makes skills actually resolve (via lazy delivery), exposing the overclaim.

---

## Peer dependency floor

| Option | Description | Selected |
|--------|-------------|----------|
| `>=0.35.0` | Matches locked success criterion 3; lowest version where `skillPath` / PR #470 exists — widest compatibility. Planning confirms #526 irrelevance to the spawn path; revisit if it applies. | ✓ |
| `>=0.35.1` | Pins to the exact version verified live end-to-end, incl. the #526 async-runner peer-resolution fix. Safer if #526 touches spawns; marginally higher floor. | |

**User's choice:** `>=0.35.0`
**Notes:** Keep the floor at the version where `skillPath` shipped; treat #526 as a
planning-time verification item, not a reason to raise the floor pre-emptively.

---

## Claude's Discretion

- AGSK-06 requirement text — author to mirror the four ROADMAP success criteria; add to REQUIREMENTS.md during planning.
- Exact refactor of the legend entry type and removal of the `preloaded` field — planner's call, provided the emitted annotation is uniformly `(available on demand)` and byte-identity holds for agents with no `<plugin>:<source-skill>` tokens.

## Deferred Ideas

- Merge `main` into `features/issue-86-agent-skill-preloads` before shipping (branch predates main's fetch-plugin / url-source work). Release hygiene, not Phase 84 scope.
