# Entry rules

Part of the `changelog` skill: `.agents/skills/changelog/SKILL.md`.

## Shape

- Put the entry under `## [Unreleased]`, newest first. A release moves the section under `## [x.y.z] - YYYY-MM-DD`.
- One top-level bullet per pull request. Its last token is the PR number in parentheses, after the final period: `... at spawn. (#138)`.
- One change: one line. Several changes in one PR: a top line that stands on its own, then one detail per sub-bullet, indented two spaces. No third level. The PR number stays on the top line only.
- A PR of many small, unrelated fixes gets one line that names the areas: `Fixed miscellaneous bugs in agent discovery, path containment, and notification counts. (#181)`.
- A PR with no user-visible change gets one brief, general line that names the area: `Internal: the test suite now runs in a hermetic Pi home. (#196)`. Dependency bumps are the exception and get no entry.

## Wording

- Lead with what changed for the reader, not with the mechanism.
- Write one sentence. Add a second only if the reader must do something. Keep each sentence to 25 words or fewer.
- Use active voice and a simple tense. Name the symptom, not the investigation.
- Keep code, flags, file names, and output tokens such as `{not in manifest}` verbatim, in backticks.
- Put rationale, internals, and rejected alternatives in the commit body or the PR, never here.

## Credits and references

- Thank everyone who is not `@acolomba`. The clause sits before the PR number.
  - PR author: `Thanks to @rakesh-vs. (#152)`
  - Issue reporter: `Thanks to @kevinkirkup, who reported #179. (#188)`
  - Feature request: `Thanks to @EasonSpirit, who requested this in #21. (#60)`
  - Both: `Thanks to @rakesh-vs, who reported #140 and wrote the fix. (#141)`
- Every closed issue appears exactly once, on the entry for the PR that closed it. The PR body's `Closes #N` line or the closing comment names that PR.
- Contributors add their own credit line.

## Do not

- Do not explain what the old code did internally.
- Do not list what remains unimplemented. That belongs in an issue.
- Do not describe what upstream does unless the reader must match it.
- Do not spread one change across several bullets, and do not split one PR across several top-level entries.
- Do not commit without `pre-commit run --files CHANGELOG.md` (mdformat and markdownlint).
