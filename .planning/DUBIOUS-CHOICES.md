# component-features: Dubious Choices Log

Review queue for the choices made without the user during the
component-features milestone (`/gsd-autonomous`, started 2026-10-31). The user
asked that every sub-session report its dubious choices to the parent session,
that the parent collect them in one file for later review, and that nobody
interrupt the user unless a conflict is truly unresolvable. When in doubt, the
run follows Claude Code upstream and diverges only for a reason specific to
this project.

## How this file works

- Only the parent session writes this file. Each subagent and sub-session ends
  its report with a `## Dubious Choices` section (or says "None"), and the
  parent copies every item here, so parallel work never conflicts on it.
- One entry per choice: what was chosen, the alternatives, why it is dubious,
  the upstream evidence, and where the choice is recorded (decision ID, file).
- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call that a reviewer may reverse at low cost. Low:
  process, naming, or tooling.
- **Status.** `open` until the user reviews it; the user marks it `accepted`,
  `reversed`, or `follow-up`.

## Entries

### DC-01: Pre-fan-out decisions settled without the user

- **Phase / source:** milestone-wide; parent session.
- **Severity:** Medium. **Status:** open.
- **Choice:** The decisions that ROADMAP.md and DEC-01 say Phase 1's discuss
  step settles "with the user" (FG-01..FG-06, FG-10, FG-14, FG-29, FG-33, the
  six function directory names) are settled by the parent session from
  upstream research, per the user's instruction for this run.
- **Alternatives:** Stop and ask the user, as the roadmap text says.
- **Why dubious:** The roadmap made these decisions a user gate because six
  parallel phases depend on them. Each decision has its own entry below so
  that the user can reverse any one of them.
- **Recorded in:** `.planning/phases/01-harness-and-version-raise/01-CONTEXT.md`.

### DC-02: Phase discovery read from STATE.md, not `init.manager`

- **Phase / source:** milestone-wide; parent session.
- **Severity:** Low. **Status:** open.
- **Choice:** `gsd-tools query init.manager` reported all seven phases as
  executed with stale verification, because `.planning/phases/` does not exist
  yet and the tool matched the phase numbers against archived milestone phase
  directories (`01-manifest-read-fidelity`, `04-install-provenance`, ...). The
  run ignored its "re-run `/gsd-execute-phase N`" actions and treated STATE.md
  (Phase 1 of 7, not started) and `init.phase-op` (no context, no plans) as the
  truth.
- **Alternatives:** Follow the manager's actions, which would have run
  execute-phase against archived plans of an earlier milestone.
- **Why dubious:** It overrides a tool verdict. It is a GSD tooling defect
  worth reporting upstream: phase numbers repeat across milestones here.
- **Recorded in:** this file only.
