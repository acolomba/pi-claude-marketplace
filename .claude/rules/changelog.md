---
paths:
  - "CHANGELOG.md"
---

# CHANGELOG entries

Target 40 words or fewer per bullet.

## Before you write

Apply the `simple-english` skill and the `humanizer:humanizer` skill to every
entry you add or change.

## Rules

- State one user-visible change per entry. Lead with what changed for the
  reader, not with the mechanism that changed.
- Write one sentence. Add a second only if the reader must do something.
- Keep each sentence to 25 words or fewer.
- Use active voice and a simple tense.
- Name the symptom, not the investigation. The reader wants to know whether
  this affected them, not how it was found.
- Put rationale, internals, and rejected alternatives in the commit body or the
  PR, never here.
- Keep the `(#NNN)` reference and any contributor credit.

## Do not

- Do not explain what the old code did internally.
- Do not describe what upstream does unless the reader must match it.
- Do not list what remains unimplemented. That belongs in an issue.
- Do not spread one change across several bullets.

## Example

Too long, at 88 words:

> A hook handler's `timeout` is now read as seconds, which is what Claude
> Code's hooks specification declares and what plugin authors write. The bridge
> consumed the bare number as milliseconds, so a plugin's `timeout: 2` -- two
> seconds upstream -- armed a 2 ms SIGTERM that killed the handler at spawn.
> Every declared timeout was a thousand times shorter than written, and a hook
> killed that way degraded to a silent no-op with nothing in the output to say
> so. Thanks to @rakesh-vs for the contribution (#138).

Better, at 33 words:

> Hook `timeout` now reads as seconds, matching Claude Code. It read as
> milliseconds before, so every declared timeout fired a thousand times early
> and killed the handler at spawn. Thanks to @rakesh-vs (#138).
