# Phase 22: Install Failure Reasons - Context

**Gathered:** 2026-10-23
**Status:** Ready for planning
**Mode:** autonomous smart discuss; the run is autonomous and non-interactive, so every recommended answer below was taken without a prompt.

<domain>
## Phase Boundary

No install failure renders without its reason. Requirements: INR-01..INR-04.
The 2026-10-23 second-round decision in ROADMAP "### Phase 22" is binding:
follow Claude Code unless a recorded divergence applies.

Observed today (probe scenarios run against the current tree):

- `install app@gits`, where `app` depends on the git plugin `ghp` and the
  host answers 404 for `ghp`: the `ghp@gits` row is `failed` with an empty
  brace and the cause `HTTP Error: 404 Not Found, fetched ...`
  (`install-cascade.messaging.ts::failureFacts`, member arm).
- `/reload` with `ghp@gits` declared and the host answering 404: the row reads
  `{unreadable}` (`reconcile/apply-outcomes.ts::classifyOrchestratorThrow`
  falls through to `narrowProbeError`). With `app@gits` declared, the row
  already reads `{dependency failed}` with the 404 in its cause chain.
- A plugin pinned to a sha the repository lacks: `failed`, empty brace, cause
  `Failed to checkout "<sha>" because commit <sha> is not available locally.`
  (isomorphic-git `CommitNotFetchedError` from `clone-cache.ts::checkoutPinWithRefetch`).
- `appendLeakToError` returns a plain `Error` with no `code`/`data`, so
  `classifyGitHostFailure` cannot see the host's answer behind a leak.
- `install-cascade.ts::checkInstalledMember` reports the normalized
  intersection (`">=2.0.0 <3.0.0-0"`), while the contradictory-declarations arm
  reports the declared ranges (`"^1.0.0 ^2.0.0"`).

Files this phase owns: `orchestrators/plugin/install-cascade.ts`,
`install-cascade.messaging.ts`, `install.messaging.ts`, `clone-cache.ts`,
`orchestrators/reconcile/apply-outcomes.ts` (`classifyOrchestratorThrow` only),
`shared/git-failure-classifiers.ts`, `shared/errors.ts` (additions only), their
paired unit tests, `features/plugin/git-source.feature`,
`features/plugin/install-dependencies.feature`,
`features/step_definitions/plugin/git-source.steps.ts`.

</domain>

<decisions>
## Implementation Decisions

### Upstream evidence (Claude Code 2.1.309 binary)

- **D-01:** Upstream's dependency-conflict formatter (`Vfn`) prints the
  DECLARED constraints for every arm: `has conflicting version requirements
(no version satisfies all of: ${c})` and `is installed at ${v}, which does
not satisfy: ${c}`, where `c = ranges.map(q).join(", ")` and `q` returns the
  declared text unchanged when it is a valid range. Upstream never prints the
  normalized intersection.
- **D-02:** Upstream's git-subdir sha path throws a plain
  `Failed to fetch commit ${sha}` / `Failed to checkout commit ${sha}` error;
  it has no closed reason vocabulary, so the token is ours to pick from the
  existing vocabulary.

### INR-01: git refusals in a cascade and on /reload

- **D-03:** The member arm of `failureFacts` classifies the failing member's
  ledger error with `classifyGitHostFailure`, the ladder a direct install uses,
  so the dependency row reads `{source missing}` / `{network unreachable}` /
  `{network error}` / `{authentication required}`. A rollback partial still
  wins (`rollback partial` first, as the single-plugin row does). The cause is
  kept on every arm, including auth: the cascade row has always carried the
  member's cause, and D-79-03's bare auth row is the standalone row's rule.
- **D-04:** `classifyOrchestratorThrow` (reconcile, backfill and the other
  orchestrated callers) consults `classifyGitHostFailure` after the typed
  ladder and before `narrowProbeError`, so a declared git plugin whose clone
  the host refuses reads its git reason on `/reload` instead of `{unreadable}`.
- **D-05:** On `/reload`, a declared plugin whose DEPENDENCY's clone was
  refused keeps `{dependency failed}` (a reconcile outcome carries one reason,
  and that row's subject is the declared plugin); the 404 stays in its cause
  chain. This matches how `/reload` reports every other dependency failure.
  The dependency's own git reason is shown by the command's member row (D-03).
- **D-06:** Import's `unexpected-failure` fallthrough is out of scope (phase
  24 owns import reasons).

### INR-02: cleanup leaks

- **D-07:** `appendLeakToError` returns a typed `CleanupLeakError` (extends
  `Error`, `cause` = the original) instead of a plain `Error`; message and
  cause chain are unchanged. `classifyGitHostFailure` and
  `classifyGitSourceAccessFailure` classify the error behind any number of
  leak wrappers, so every caller of the ladder keeps the reason without its
  own unwrap. (Amended by review and verification: the transport ladder,
  `hostHttpStatus`, and `classifyOrchestratorThrow`'s probe fallback read
  through the wrappers too.)
- **D-08:** The standalone auth row stays bare (D-79-03) except when a leak
  wrapped the error: then the cause is kept, because it carries the
  manual-cleanup hint (MA-9), which outranks the bare-row rule.

### INR-03: a pin the remote lacks

- **D-09:** `materializePluginClone` turns a `CommitNotFetchedError` from the
  checkout of a FRESH staging clone (after the ref-hint refetch) into a typed
  `PinnedCommitMissingError` (sha, `cause` = the isomorphic-git error).
  `classifyGitHostFailure` maps it to `source missing`: the existing token
  `marketplace add` uses for "a ref or object the remote does not have". A
  fresh clone of the remote that still lacks the commit is exactly that claim,
  so the WR-01 concern (a local read on a damaged warm mirror) does not apply;
  the warm-mirror copy path already treats a missing commit as "clone instead".
  `classifyGitSourceAccessFailure`'s `NotFoundError` arm is not used for
  install, since it cannot tell a remote miss from a local read.

### INR-04: one range form

- **D-10:** The `installed-unsatisfied` arm reports the member's declared
  ranges, joined and bounded as the contradictory-declarations arm does
  (`renderConstraintRange(member.ranges.join(" "))`), so both causes quote
  what the user wrote. The space join and quotes stay (a cosmetic difference
  from upstream's `, ` join, listed for the user).

### Tests

- **D-11:** Cucumber: a dependency refusal (command) and a declared plugin's
  refusal on `/reload` in `git-source.feature`; a pin the repository lacks in
  `git-source.feature` (new step "pins the plugin ... to a commit its
  repository lacks"); the INR-04 cause line updated in
  `install-dependencies.feature`. The leak path cannot be provoked from a
  scenario (cleanup must fail), so INR-02 is unit-tested only.
- **D-12:** Unit tests in the paired files for every new branch (100% direct
  coverage).

### Claude's Discretion

Exact error-message wording of `PinnedCommitMissingError`.

</decisions>

<deferred>
## Deferred Ideas

- Import's fallthrough for git refusals (phase 24).
- Upstream's `, `-joined, unquoted range list (cosmetic).

</deferred>
