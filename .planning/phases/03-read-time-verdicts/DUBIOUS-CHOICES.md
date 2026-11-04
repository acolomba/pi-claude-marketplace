# Phase 3 (Read-Time Verdicts): Dubious Choices Log

The choices Phase 3 made without the user, in the shape of the root
`.planning/DUBIOUS-CHOICES.md` (read it for DC-01..DC-45, which these entries
stay consistent with) and of Phase 1's log
(`.planning/phases/01-foundation-and-pi-1-5-0/DUBIOUS-CHOICES.md`,
P1-DC-01..). Only this phase's session writes this file: each subagent ends
its report with `## Dubious Choices` (or "None"), and the session copies every
item here. The parent merges this file into the root log in Phase 6, and the
session sends each step's new entries to the parent as it goes.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.
