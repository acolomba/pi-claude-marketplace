# Phase 5 (Hooks): Dubious Choices Log

The Phase 5 child session's review queue for the choices it made without the
user. It has the same shape as the root `.planning/DUBIOUS-CHOICES.md`
(DC-01..DC-27), and the parent merges it into that file. Only the Phase 5
session writes this file. Each subagent ends its report with a
`## Dubious Choices` section, and the session copies the items here.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call that a reviewer may reverse at low cost. Low:
  process, naming, or tooling.
- **Status.** `open` until the user reviews it; the user marks it `accepted`,
  `reversed`, or `follow-up`.

## Entries

### P5-DC-01: Commit trailers name this child session, not the parent session

- **Phase / source:** Phase 5 child session, git process.
- **Severity:** Low. **Status:** open.
- **Choice:** Commits on `features/component-features-phase-5` end with
  `Claude-Session: https://claude.ai/code/session_01EDUMG8q84hyEek3xsuxpLu`,
  the session that made them.
- **Alternatives:** The `Claude-Session` line in
  `.planning/CHILD-SESSION-BRIEF.md`
  (`session_01EDUMG5ARYqF6oZYKmj6oB3`), which names the parent session.
- **Why dubious:** The brief says "End every commit message with exactly" that
  line. The session's own attribution instruction names this session, and a
  trailer that names the session that made the commit keeps the record
  traceable.
- **Recorded in:** every Phase 5 commit message.
