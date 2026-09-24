# Phase 07: Marketplace-repository tag resolution for path-source dependencies - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 07-marketplace-repo-tag-resolution
**Areas discussed:** Materialization mechanics (carried over from a prior interrupted session), Fallback notice prominence, DIVG-01 doc wording review

---

## Materialization mechanics (resumed from a prior session's pause)

A prior session in this same autonomous run researched the ROADMAP-named "open mechanics question" (materializing a plugin's files from a tag inside a marketplace clone whose own checkout sits at a different commit), proposed reusing the existing `plugin-clones/<key>/` cache + GC, then paused before the user confirmed — the first framing question was rejected and the user asked to clarify before answering, but ran `/gsd-pause-work` before giving that clarification.

On resuming this session, the user confirmed the framing with a plain "yes" after it was re-presented (this time as a statement to react to rather than a multi-option AskUserQuestion).

**User's choice:** Confirmed — reuse the `plugin-clones/<key>/` cache and `clone-gc.ts` sweep; checkout the tag into a new keyed directory via isomorphic-git with a separate `dir`/`gitdir` pair against the marketplace clone's object store.
**Notes:** No further objection was raised to the framing itself once re-presented plainly.

---

## Fallback notice prominence

| Option | Description | Selected |
|--------|-------------|----------|
| Warning-level line | Row surfaces a warning now, matching upstream's shape (verified via string search of the installed Claude Code binary: `Plugin dependency install warning for {name}: resolved to a commit whose plugin.json says version {X}, used for constraint checks`) | |
| Quiet info note | Lower-key note since nothing is broken yet — Phase 6's load-time check is what actually disables a dependent if the fallback version is genuinely out of range | ✓ |

**User's choice:** Quiet info note.
**Notes:** Deliberate divergence from upstream's warning-level phrasing for this fallback case, on the reasoning that the install itself always succeeds and Phase 6 already owns surfacing an actual problem.

---

## DIVG-01 doc wording review

| Option | Description | Selected |
|--------|-------------|----------|
| Claude's discretion | Write following the existing divergence entries' format in `docs/dependency-resolution.md` | ✓ |
| Show a draft first | Draft and review before committing | |

**User's choice:** Claude's discretion.
**Notes:** None.

---

## Claude's Discretion

- DIVG-01 doc wording (see above).
- Exact info-note phrasing/placement for the TAGS-02 fallback row — tone is locked (info, not warning); wording is an implementation detail.

## Deferred Ideas

None — discussion stayed within phase scope.
