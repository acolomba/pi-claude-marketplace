---
id: 260819-bs8
slug: github-release-automation-and-codex-conf
description: GitHub release automation and Codex config tracking
date: 2026-08-19
status: complete
branch: features/gh-release-automation
commits:
  - 4d8f8a44 ci: create GitHub releases from the changelog on tag push
  - 6b2f14cd build: exclude the Codex harness directory from the hooks
  - 2c19c8cb chore: track the Codex harness configuration
---

# Quick Task 260819-bs8 Summary

## What shipped

**Release automation.** `.github/workflows/publish.yml` gains a `release` job
that runs `taiki-e/create-gh-release-action@v1` against `CHANGELOG.md` after
`publish` succeeds. The repository had 34 tags and zero GitHub releases; every
release since `v0.1.0` was tagged and published to npm with no releases-page
entry. The tag trigger also narrows from `v*` to `v*.*.*`.

**Hook exclusion.** `.codex/` joins `.claude/` in the top-level
`.pre-commit-config.yaml` `exclude` regex.

**Codex config tracked.** `.gitignore` replaces the blanket `/.codex` ignore
with granular `/.codex/gsd-*` rules; `.codex/config.toml` is now tracked.

## Verified

- `taiki-e/parse-changelog` v0.6.17, the parser the release action uses, was
  run locally against this repository's `CHANGELOG.md`. It parsed all 32
  version sections, matching the 32 `v*.*.*` tags, and its `0.16.1` output was
  byte-identical to a hand-rolled awk extractor.
- `v*.*.*` excludes the two GSD milestone tags (`v1.7`, `v1.8`) and matches all
  32 release tags. All 32 are present on the remote.
- Two draft releases were created on GitHub to confirm rendering. They are
  still open, unpublished, and awaiting review:
  `untagged-92da862d23938b45f5bd` (what the workflow emits with generated
  notes) and `untagged-d094d0abe0753e1c21a6` (changelog prose plus generated
  notes). Neither created a git tag.
- Every commit ran the full `pre-commit` suite clean, trufflehog included, with
  no `SKIP=` and no `--no-verify`.

## Deviations from plan

- A `release` job sourcing notes from `CHANGELOG.md` was chosen over GitHub's
  `--generate-notes`. The generated form reduces a release to its PR titles,
  which for `v0.16.1` is three Dependabot bumps and one line reading "handle
  deferred" where the changelog explains what that means.
- Task 2 (hook exclusion) was not in the original plan. It was added after
  markdownlint blocked the commit.
- The 84-file `.codex/skills/spike-findings-pi-claude-marketplace` mirror was
  removed from disk in a separate session mid-task, so only `config.toml`
  remained to track. It regenerates from `.planning/spikes/`, which is intact.

## Not done

- No push, no PR. Branch `features/gh-release-automation` is local.
- No backfill of the 32 existing tags. GitHub stamps a backfilled release with
  the creation date, not the original release date (verified against
  `jqlang/jq`, whose 2013 release displays as August 2015), and there is no API
  parameter to set it.
- Local `main` carries 8 unpushed `docs(spike-*)` commits that this branch sits
  on top of. Any PR from here would include them.
