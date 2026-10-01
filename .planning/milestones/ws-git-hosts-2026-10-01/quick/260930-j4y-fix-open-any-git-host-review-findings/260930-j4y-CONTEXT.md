# Quick 260930-j4y: fix the open any-git-host review findings -- Context

**Gathered:** 2026-09-30
**Source:** `BACKLOG.md` GHRED-01 and GHADD-01. Full finding text:
`.planning/workstreams/git-hosts/milestones/any-git-host-phases/01-private-repos-on-any-git-host/01-REVIEW.md`
and `.planning/workstreams/git-hosts/milestones/any-git-host-phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-REVIEW.md`.
Status at HEAD of each finding: the milestone audit,
`.planning/workstreams/git-hosts/milestones/any-git-host-MILESTONE-AUDIT.md`.

## Locked decisions

- **Q-01 (GHADD-01 WR-03): ownership marker.** Before the staging clone is renamed into
  `sources/<name>`, `marketplace add` writes a marker inside that clone's `.git/` directory.
  Leftover recognition accepts a tree only when the marker is present AND its `origin` matches the
  source being added. A tree without the marker refuses as `{stale clone}`, exactly as before the
  milestone. Leftovers created by released versions carry no marker and need one manual delete;
  that is accepted. The marker write is a disk mutation, so it goes through the existing
  containment and atomic-write discipline (NFR-1, NFR-10).
- **Q-02 (GHRED-01 WR-01): fail clean on a cross-origin 401.** When the transport in
  `platform/git.ts` follows a redirect to another origin (scheme, host, port) and that hop answers
  401, it fails with a typed error before isomorphic-git can call `onAuth`. No credential lookup,
  no `onAuthFailure` eviction, no Device Flow prompt. This makes the recorded DD-3 note true
  ("a cross-origin redirect target that needs its own credential fails clean"). Upstream git would
  ask for the target's credential; isomorphic-git cannot, so this stays a recorded Pi capability
  gap, not a new divergence.
- **Q-03 (GHADD-01 IN-05): do not change the cache identity.** Case-insensitive host recognition
  (and recognition of a leftover created before the `github.com` host fold) is fixed in the
  COMPARISON only, for example by parsing the leftover's `origin` through the same source parser
  before comparing canonical identities. `canonicalCloneUrl` and every cache key stay as they are.

## Scope

Every open item in both backlog entries. Where a finding turns out to be wrong or already fixed at
HEAD, record that with evidence instead of changing code. The audit recorded these as closed:
Phase 1 WR-02, Phase 3 CR-01, WR-05, WR-10, WR-11.

## Constraints that bind this task

- `npm run check` must be green at the end: typecheck, ESLint, fallow (dead code, health, dupes;
  check the EXIT CODE, not the glyph), Prettier, `test:corresponding`, coverage at 100%
  lines/functions/branches, unit and integration tests. Write the exit code to a log, never read it
  through a pipe.
- `npm run lint:type-members`: any new type member is read by production or pinned in
  `scripts/check-unused-type-members.contracts.json`. Pins are line:col; run Prettier BEFORE
  repinning, and remap pins in files whose lines shift.
- `tests/architecture/no-credential-leak.test.ts`: no credential field in an `Error` or a
  notification. A new error for a malformed `Location` must not carry the raw server string
  unsanitized.
- The no-orchestrator-network gate: `orchestrators/auth-host.ts` stays free of value imports from
  `platform/git.ts`.
- Rules in `skills/typescript-google-style-review/SKILL.md`, `skills/typescript-comments/SKILL.md`,
  `skills/typescript-unit-testing/SKILL.md` and `skills/typescript-unit-testing-review/SKILL.md`.
  Comments cite decision/requirement IDs, never phase or plan numbers.
- Typed errors: `extends Error`, set `name`, typed readonly fields, callers narrow with
  `instanceof`. Tests assert by type, not by message substring.
- Commits: Conventional Commits, no GSD milestone/phase mentions, body lines <= 80. This is a git
  worktree: run `SKIP=trufflehog pre-commit run --files <files>` before each commit, then commit
  with `SKIP=trufflehog`. Never `--no-verify`, never amend.
- Record the user-visible changes in `CHANGELOG.md` under `## [Unreleased]`.
- When done, mark GHRED-01 and GHADD-01 closed in `.planning/BACKLOG.md` (heading struck through
  with `-- CLOSED`, plus a one-paragraph disposition naming this quick task), following the
  existing closed-entry style in that file.
