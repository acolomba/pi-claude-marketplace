---
phase: 261006-cwq
plan: 01
subsystem: docs
tags: [workflows, pi-dynamic-workflows, compatibility, changelog, launcher]
status: complete
requires: []
provides:
  - "scripts/pi.sh engine pin 3.13.1 with a comment that says no grade names 3.13.1 and why the pin holds below engine PR #238"
  - "docs/workflows-compatibility.md: 3.13.1 rationale for the Pi 0.86.1 minimum, one remaining limit (#232), #238 storage-override warning"
  - "CHANGELOG.md: release wait narrowed to #232; Pi 0.86.1 bullet with no child-tool claim"
affects: [workflows bridge, live-UAT canaries]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - scripts/pi.sh
    - docs/workflows-compatibility.md
    - CHANGELOG.md
decisions:
  - "Pin engine 3.13.1 in scripts/pi.sh but raise no evidence grade to 3.13.1; the live-UAT 3.13.0 pins stay because they reproduce published grades"
  - "Keep Pi 0.86.1 as the minimum because the 2026-09-23 run tested that version"
  - "Hold the launcher pin below the engine release with PR #238 until the bridge follows PI_CODING_AGENT_DIR (WPTH-04)"
metrics:
  duration: "~6 min"
  completed: 2026-10-06
actuals:
  tokens: 2600
  tasks: 1
  commits: 1
plan_head_before: 162673835d542d9982dfe97520d10d431582ca52
plan_head_after: e0b0abac80aec9c3ef91c3f443e66b0a92be14af
---

# Quick Task 261006-cwq: Update workflow-engine compatibility docs and pins Summary

The launcher now pins `@quintinshaw/pi-dynamic-workflows@3.13.1`. The compatibility guide gives the real reason for the Pi 0.86.1 minimum, lists only the `--no-extensions -e` delivery limit (engine PR #232), and warns about the `PI_CODING_AGENT_DIR` storage override in engine PR #238. The changelog waits only for #232. No evidence grade moved.

## Commit

- `e0b0abac` (`e0b0abac80aec9c3ef91c3f443e66b0a92be14af`) -- `docs(workflows): pin engine 3.13.1 and update compatibility notes`
- Shortstat: 3 files changed, 16 insertions(+), 8 deletions(-)
- Numstat against 16267383: CHANGELOG.md 2/2, docs/workflows-compatibility.md 7/3, scripts/pi.sh 7/3

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Pin engine 3.13.1 and bring the guide and changelog in line with it | e0b0abac | scripts/pi.sh, docs/workflows-compatibility.md, CHANGELOG.md |

All eight TXT edits (TXT-1 to TXT-8) were applied verbatim by exact anchor match. Each anchor matched once. TXT-9 is the commit message.

## Verification

- Precondition: held at HEAD 16267383 (no diff, clean paths, branch `features/workflows-refine`).
- `<verify>`: exit 0 after the edits, and exit 0 again after the commit (in bash and in zsh).
- `npm view @quintinshaw/pi-dynamic-workflows@3.13.1 version` returned `3.13.1`.
- `npm view @quintinshaw/pi-dynamic-workflows@3.13.1 dist.attestations.provenance.predicateType` returned `https://slsa.dev/provenance/v1`.
- `SKIP=npm-check pre-commit run --files scripts/pi.sh docs/workflows-compatibility.md CHANGELOG.md`: exit 0 on Node v26.10.0. No fixer rewrote a file.
- Commit hook: passed (gitlint passed). `npm run check:commit` was skipped ("no files to check") because no staged file is a build input.
- `npx --no-install fallow audit --base HEAD --format json --quiet` (fallow 3.30.0): verdict `pass`.
- POST-1: exit 0.
- Post-commit deletion check: no deletions.
- Verification scope: focused task verification passed; no build input changed, so the hook skipped npm-check and no full check is required.

## Choices made (from the plan)

- One task, one commit, as the task scope requires.
- The live-UAT files stay unchanged: every engine version there reproduces a published grade. The `scripts/pi.sh` comment says no grade names 3.13.1, so nobody aligns those pins with the launcher pin.
- The changelog Pi bullet keeps only its first sentence. `.claude/rules/changelog.md` puts rationale in the commit body, and a child-tool claim would wrongly read as excluding 3.13.0.
- The status-label limit is dropped, not reworded. The guide says 3.13.1 "keeps one known limit from 3.13.0", and the `scripts/pi.sh` comment names #234.
- Two planner additions kept: TXT-3 names 3.13.1 in the peer bullet, and the last two sentences of TXT-1 hold the pin below the release with #238.
- The provenance paragraph and the grade list stay unchanged. Each new claim states its source in place. No grade moves to 3.13.1.
- The Pi minimum stays 0.86.1. `package.json` does not change.

## Deviations from Plan

None - plan executed exactly as written.

## Follow-ups (out-of-scope observations, not acted on)

1. The bridge does not follow engine pull request #238. `extensions/pi-claude-marketplace/platform/workflow-home.ts` reads only `os.homedir()` (WPTH-04). Once a release includes #238, a user with `PI_CODING_AGENT_DIR` set loses sight of the installed workflows. `tests/live-uat/workflow-storage-canary.mjs` W0 also fails against such a release, because the canary sets `PI_CODING_AGENT_DIR` to its sandbox and points `HOME` at a child of it. This needs a decision before the launcher pin or a canary pin moves past 3.13.1.
2. `scripts/pi.sh` launches Pi with `--no-extensions -e`, the mode in which 3.13.1 can leave result delivery pending. Engine pull requests #232 and #238 both merged after 3.13.1, so the release that brings #232 will probably also bring #238. Taking #232 into the launcher therefore depends on item 1.
3. The `CHANGELOG.md` bullet "Pi Coding Agent 0.86.1 is now required." came from PR #205 (5c652697) and carries no PR number, which `.claude/rules/changelog.md` requires on every top-level bullet.
4. `docs/workflows-compatibility.md` still grades its source reads "unchanged at 3.13.0". The task scope reports those bodies unchanged at 3.13.1 too (`parseWorkflowScript`, `validateMeta`, the determinism blocklist, `src/workflow-saved.ts`, the project-key derivation, and the tool names), but nothing in this repository recorded that re-read. `WPIN-01` tracks a machine-checkable re-read.
5. `docs/workflows-compatibility.md` counts "60 versions" from `1.0.0` through `3.13.0`. That range is still accurate, but the count predates 3.13.1.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: scripts/pi.sh, docs/workflows-compatibility.md, CHANGELOG.md (modified)
- FOUND: commit e0b0abac in HEAD history
