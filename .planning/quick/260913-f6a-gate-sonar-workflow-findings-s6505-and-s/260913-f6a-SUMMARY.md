---
quick_id: 260913-f6a
slug: gate-sonar-workflow-findings-s6505-and-s
date: 2026-09-13
status: complete
actuals:
  tokens: 3634
  tasks: 4
  commits: 3
plan_head_before: c3b035924228975a892eaff6ed993e6e46100aa3
---

# Quick Task 260913-f6a -- Summary

Fixed both SonarQube workflow findings and gated each one, so neither can come back
silently. `githubactions:S6505` (install scripts run during `npm ci`) is gated by a local
script; `githubactions:S7637` (external actions not hash-pinned) is gated by zizmor.

## What changed

**The fixes.** All 8 `npm ci` calls now pass `--ignore-scripts`. The 3 external action
references are pinned to commit SHAs, each with a trailing version comment in the form
Dependabot maintains. No `actions/*` reference was touched -- S7637 covers external actions
only, which is why Sonar reports 3 and not 23.

**`zizmor.yml` (new).** Carries one policy block: `actions/*` stays on a version ref,
every other owner must be hash-pinned. No `ignore:` entries.

**`scripts/check-workflow-install-scripts.mjs` (new).** The S6505 gate. No off-the-shelf
linter carries that rule, so this is a local script in the shape of
`scripts/check-corresponding-tests.mjs`: a named export returning a violation array, a
`main()` that takes an optional `--root`, and an `import.meta.url` guard. It scans
`.github/workflows` for `.yml` and `.yaml` and flags any `npm ci`, `npm install` or `npm i`
line that omits the flag.

**`scripts/check-workflow-install-scripts.negative.mjs` (new).** The planted-violation
proof. It builds a `mkdtemp` fixture, plants an install line with no flag, asserts exactly
one violation, then rewrites the same line with the flag and asserts none.

**Wiring.** `lint:workflows` and `lint:workflows:negative` in `package.json`, both appended
to the `check` chain after `npm run lint`. Two new pre-commit hooks: the local
`workflow-install-scripts`, and the upstream `zizmor` hook at `v1.30.1` with
`--min-severity high`. `sonar.sources` now covers `.github`, which it never did before --
that omission is why neither rule had ever reached a quality gate.

## Why a severity floor and not an ignore list

`unpinned-uses` is the only High-severity audit this repository trips. The four audits the
operator already declined sit below it: `archived-uses` and `dependabot-cooldown` are
Medium, `artipacked` and `self-repository` are Low. A `--min-severity high` floor therefore
leaves exactly the S7637 findings.

The floor also survives new files. A filename `ignore:` list would make every newly added
workflow fail the hook until someone remembered to edit the config. The cost of the floor
is that it is scoped by severity rather than by audit identity: a future zizmor release
that adds another High-severity audit will fire. That is a loud failure on a real
supply-chain finding, which is the better failure mode.

## Both gates were proven by planting a violation

The repository's conventions ask a new gate to prove it fires on a real violation, not just
that its configuration is present. Both were proven:

- **S6505.** `npm run lint:workflows:negative` exits 0. The fixture plants an install line
  with no flag, gets exactly one violation, then clears once the flag is added. It also
  covers the `npm install` and `npm i` spellings and a `.yaml` workflow, so neither the
  spelling nor the file extension is a hole to hide an install in.
- **S7637.** A temp fixture with `some-vendor/some-action@v1` made zizmor exit **14** with
  one High finding. Hash-pinning that same line took it to exit **0**.
  `actions/checkout@v7` stayed green in both runs, which confirms the `ref-pin` policy
  works and the `actions/*` references were correctly left alone. Nothing in the working
  tree was touched to run this.

## Verification

| Check | Result |
| --- | --- |
| `uvx zizmor --config zizmor.yml --persona=regular --min-severity=high` over workflows + `dependabot.yml` + `.pre-commit-config.yaml` | exit 0, no findings |
| `grep -c 'actions/[a-z-]*@[0-9a-f]\{40\}'` per workflow file | 0 for all 5 |
| `npm run lint:workflows` | passed |
| `npm run lint:workflows:negative` | passed |
| `npm run lint` | clean |
| `npm run format` then `npm run format:check` | clean, nothing rewritten |
| `npm run fallow` | exit 0 (the new file is not reported as `unused-file`) |
| `pre-commit run --all-files` | exit 0; `zizmor` and `npm lint workflows` both ran and passed |

`npm run check` was not run, per the task constraints: nothing here touches `extensions/`
or `tests/`, and the steps above cover every gate the changed files reach.

## Deviations from plan

**1. Three commits instead of the plan's single Task 4 commit.** The plan batched all
changes into one commit; the execution constraints require one atomic commit per task. The
constraint won. Each commit is coherent on its own: the fixes plus config, then the S6505
gate, then the zizmor hook plus the Sonar sources.

**2. Scoped hook runs before the first two commits.** `pre-commit run --files <changed>`
ran before commits 1 and 2; the full `--all-files` run the plan asks for ran immediately
before commit 3, with the final staged content and nothing changed after. `CLAUDE.md`
sanctions both forms.

**3. `SKIP=trufflehog` was required on every hook run.** TruffleHog cannot read a
worktree's `.git` file (`failed to read index file: ... not a directory`). This checkout is
a worktree, and `CLAUDE.md` already documents the prefix for exactly this case. Not a new
finding and not a code problem.

**4. The new local hook carries a `name:` field.** The plan listed `entry`, `language`,
`pass_filenames` and `files`. Every sibling hook in the `- repo: local` block has a `name:`
too, so it got one for consistency.

**5. The negative control asserts more than the plan's two cases.** The plan asked for
plant-then-fix. It also covers `npm install`, `npm i`, and `.yaml` discovery, because the
gate makes those claims and an unproven claim in a gate is the hole this kind of test
exists to close.

**6. The three action SHAs were verified against the GitHub API before pinning.** Worth
recording: `fallow-rs/fallow` `v3.25.0` is an **annotated tag**, so the tag ref's object
SHA is `af0aefc1...`, which is the tag object and *not* a commit. Dereferencing it gives
`30167b42...`, which is what the plan specified and what was used. Pinning a tag object
SHA instead of the commit SHA would have been wrong. All three SHAs in the plan checked
out.

## One self-inflicted error, caught before it was committed

The first attempt to insert the local hook used JavaScript `String.replace` with a string
replacement. The replacement text ended in `$'`, which `replace` expands to "everything
after the match", and it duplicated a chunk of `.pre-commit-config.yaml` into the middle of
the new `files:` pattern. The file was restored with `git checkout -- .pre-commit-config.yaml`
and the edit redone with a replacer **function**, which does no `$` expansion. Nothing was
staged or committed in the corrupted state, and the restore discarded no other work -- that
file had no other uncommitted change.

## Observation, not a defect

`fallow dupes` now reports a 20-line clone group between
`scripts/check-corresponding-tests.mjs` and `scripts/check-workflow-install-scripts.mjs` --
the `main()` plus `import.meta.url` tail the plan asked to be copied "exactly". The gate
exits 0, and the same shape already exists between `scripts/test-coverage-direct.mjs` and
`scripts/test-coverage-direct.report.mjs`, so the house already carries this form and does
not treat it as a violation. The CI `fallow-audit` delta job may annotate it on the pull
request as newly introduced. Left as-is; extracting a shared helper across two gate scripts
would trade a visible convention for an indirection.

## Watch item, carried from the plan

Adding `.github` to `sonar.sources` may surface `githubactions:*` findings beyond these two
rules on the next pull request. That cannot be measured locally -- it needs a SonarCloud
run. If the quality gate reports new rules, triage them separately.

## Out of scope, left alone

`actionlint` with shellcheck flags SC1083 on `ci.yml`'s `git rev-parse --verify
origin/main^{commit}`. Neither tool is in this repository's pre-commit pipeline, and the
task brief marked this pre-existing. Untouched.

## Commits

| Commit | Message |
| --- | --- |
| `8a8a0396` | `ci: ignore install scripts and hash-pin external actions` |
| `03b89b8a` | `ci: add a gate for npm install-script execution` |
| `69797ebc` | `ci: run zizmor on workflows and index them in Sonar` |

## Self-Check: PASSED

All created files exist and all three commits are present in `git log`.
