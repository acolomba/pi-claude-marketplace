---
paths:
  - "CHANGELOG.md"
---

# CHANGELOG entries

One entry per pull request, written for the reader, 40 words or fewer per
bullet.

## Before you write

Load the `simple-english` skill in Plain mode and the `humanizer` skill. Apply
both to every line you add or change, then run their self-checks. In
particular: no `-ing` clause hanging off a comma, no `should`, `would`,
`could`, or `may`, no semicolon, and no dash between two statements.

## Shape

- Put the entry under `## [Unreleased]`, newest first. A release moves the
  section under `## [x.y.z] - YYYY-MM-DD`.
- One top-level bullet per pull request. Its last token is the PR number in
  parentheses, after the final period: `... at spawn. (#138)`.
- One change: one line. Several changes in one PR: a top line that stands on
  its own, then one detail per sub-bullet, indented two spaces. No third
  level. The PR number stays on the top line only.
- A PR of many small, unrelated fixes gets one line that names the areas:
  `Fixed miscellaneous bugs in agent discovery, path containment, and
  notification counts. (#181)`.
- A PR with no user-visible change gets no entry. A release with nothing
  user-visible says so in one line.

## Wording

- Lead with what changed for the reader, not with the mechanism.
- Write one sentence. Add a second only if the reader must do something.
  Keep each sentence to 25 words or fewer.
- Use active voice and a simple tense. Name the symptom, not the
  investigation.
- Keep code, flags, file names, and output tokens such as `{not in manifest}`
  verbatim, in backticks.
- Put rationale, internals, and rejected alternatives in the commit body or
  the PR, never here.

## Credits and references

- Thank everyone who is not `@acolomba`. The clause sits before the PR
  number.
  - PR author: `Thanks to @rakesh-vs. (#152)`
  - Issue reporter: `Thanks to @kevinkirkup, who reported #179. (#188)`
  - Feature request: `Thanks to @EasonSpirit, who requested this in #21. (#60)`
  - Both: `Thanks to @rakesh-vs, who reported #140 and wrote the fix. (#141)`
- Every closed issue appears exactly once, on the entry for the PR that
  closed it. The PR body's `Closes #N` line or the closing comment names that
  PR.
- Contributors add their own credit line.

## Do not

- Do not explain what the old code did internally.
- Do not describe what upstream does unless the reader must match it.
- Do not list what remains unimplemented. That belongs in an issue.
- Do not spread one change across several bullets, and do not split one PR
  across several top-level entries.
- Do not commit without `pre-commit run --files CHANGELOG.md` (mdformat and
  markdownlint).

## Examples

Too long, at 88 words:

> A hook handler's `timeout` is now read as seconds, which is what Claude
> Code's hooks specification declares and what plugin authors write. The bridge
> consumed the bare number as milliseconds, so a plugin's `timeout: 2` -- two
> seconds upstream -- armed a 2 ms SIGTERM that killed the handler at spawn.
> Every declared timeout was a thousand times shorter than written, and a hook
> killed that way degraded to a silent no-op with nothing in the output to say
> so. Thanks to @rakesh-vs for the contribution (#138).

Better, at 33 words, with the PR's other changes nested under it:

> - Hook `timeout` now reads as seconds, the same as Claude Code. It read as
>   milliseconds before, so every declared timeout fired a thousand times
>   early and killed the handler at spawn. Thanks to @rakesh-vs. (#138)
>   - Sync hook defaults now match Claude Code per event: 30 s on
>     `UserPromptSubmit`, 1.5 s on `SessionEnd`, 600 s elsewhere.
>   - A `timeout` that is not a number falls back to its event default
>     instead of failing the install.
