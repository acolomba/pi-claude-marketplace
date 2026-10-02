# Handoff — close milestone v1.20 (transitive-dependencies)

Written 2026-09-17 at the end of an autonomous run that stopped, by operator
choice, at the milestone-audit tech-debt gate. Read this before touching
anything; it supersedes the `Session Continuity` prose in STATE.md.

## Where things stand

- Branch `features/manifest`, checkout `/home/acolomba/src/pi-claude-marketplace-manifest`
  (a git worktree; `SKIP=trufflehog` is required on every pre-commit run).
  HEAD `5674585a`. Everything the run produced is committed.
- The operator's own uncommitted edits are NOT ours: `.claude/settings.json`,
  `.codex/config.toml`, `.planning/config.json`, `.planning/state.json`, and
  untracked `.claude/CLAUDE.md`, `.codegraph/`, `.mcp.json`, `AGENTS.md`.
  Never stage them; never `git add -A`.
- All 5 phases are complete and verified (`phase.complete` ran for Phase 5;
  ROADMAP shows `[x]` on every phase; REQUIREMENTS shows 26/26 Complete).
- `.planning/v1.20-MILESTONE-AUDIT.md` exists: `status: tech_debt`,
  26/26 requirements, 5/5 seams, 2/2 flows, 0 blockers.
- `/gsd-complete-milestone v1.20` and `/gsd-cleanup` have NOT run.
- `npm run check` was green at `d3e3405f` (6467 unit / 32 integration);
  only `.planning/` and docs commits follow it.

## Why we stopped

Nyquist (`validate-phase`) and the security threat-model audit
(`secure-phase`) never ran on Phases 3, 4, 5. Both are phase-scoped gates:
**once `complete-milestone` archives the phase directories, neither command
can find its target any more** (memory: "Archived milestone kills
phase-scoped gates"). They must run first.

## Ordered to-do

Run each command in a fresh context (`/clear` between them). All are
GSD skills; none needs this handoff's prose to be re-derived.

1. `/gsd-secure-phase 3`, then `4`, then `5`
   - Phase 5's three plans carry `<threat_model>` blocks (ASVS L1, block on
     high; T-05-03 and T-05-09 are the `high` rows, both disposed `mitigate`).
   - Writes `NN-SECURITY.md`; a SECURED verdict is the expected outcome.
   - Note: `05-SECURITY.md` must exist for the `verify:post` security hook to
     stop nagging.
2. `/gsd-validate-phase 3`, then `4`, then `5`
   - Promotes each `NN-VALIDATION.md` from `status: draft` to
     `status: validated` and fills `nyquist_compliant`. Phase 5's per-task
     map was filled by the planner; Phases 3/4 may need Wave-0 rows filled.
3. Settle the two open design decisions from `05-REVIEW.md` (either is a
   one-commit change or an explicit "accepted" note in REVIEW-FIX.md):
   - **IN-05** — a present-but-corrupt own `plugin.json` beside a silent
     marketplace entry currently reads "declares nothing" (D-05-06 fallback).
     Stricter option: add `{ kind: "unusable" }` to `OwnManifestRead` consumed
     only by `orchestrators/plugin/dependency-index.ts`, map it to
     `unreadableDeclarer(...)`, add the case to
     `tests/orchestrators/plugin/dependency-index.test.ts`. Otherwise accept.
   - **IN-06** — a declarer-read refusal renders `{unreadable}` (same token as
     the unclassified cascade default; the `cause:` line is the
     discriminator). Alternative: mint `dependents unknown` — a closed-set
     amendment across all ten pin surfaces (see `05-02-SUMMARY.md` for the
     procedure and current pin values: 212 catalog states, `REASONS.length`
     56, byte lock 28_543). 05-CONTEXT's stated preference is to keep the
     existing truthful member → the cheap answer is "accept".
4. Triage, don't necessarily fix:
   - `PRUNE-GUARD-MR-01` in `.planning/BACKLOG.md` (`marketplace remove`
     bypasses the dependents guard) — leave in backlog unless you want it in
     this release.
   - `.planning/phases/01-manifest-read-fidelity/deferred-items.md` — one
     open item (`(remote)` info rows drop `dependencies`; a catalog
     amendment). Mark `status: resolved` only if you act on it; otherwise it
     surfaces in `audit-uat`/`complete-milestone` scans, which is intended.
   - Six Info nits in `05-REVIEW.md` (IN-01..04, IN-07, IN-08) — optional.
5. If any of steps 1–4 changed code: `npm run check` and
   `SKIP=trufflehog pre-commit run --all-files` (CI runs `--all-files`;
   scoped runs hide pre-existing violations).
6. Re-run `/gsd-audit-milestone` so the audit reads `passed` (or accept
   `tech_debt` for whatever you chose to leave). Delete and let it rewrite
   `.planning/v1.20-MILESTONE-AUDIT.md`; commit.
7. Optional but recommended before archive (memory: "Milestone-close UAT
   before archive"): `/gsd-audit-uat` — the Phase 5 UAT is already 4/4
   passed (`05-UAT.md`), so this should be a no-op sweep.
8. `/gsd-complete-milestone v1.20`
   - Memory: the CLI archives phases and writes MILESTONES/STATE but stamps
     today's date and verbose bullets; **original-path deletions stay
     unstaged** — `git add -u .planning/phases/` before committing. ROADMAP
     reorg, PROJECT.md evolution, a RETROSPECTIVE, and REQUIREMENTS.md
     deletion are manual.
   - **Skip the git tag** — tags track npm releases (`v0.x.y`), not
     milestones.
   - ROADMAP.md: the active milestone heading must be `### In progress vX.Y`
     form while active; after close, the archived summary line should not
     contain the word "shipped" in a way that trips the `/SHIPPED/i` scan
     for the NEXT milestone (memory: "shipped in ROADMAP prose").
9. `/gsd-cleanup` — dry-run first; it archives phase directories. Remove any
   `node_modules` symlink in a worktree before cleanup if one exists.
10. Ship: `/gsd-ship` (or `/gsd-pr-branch` then `gh pr create`). Before the
    PR, offer the version bump per CLAUDE.md — `package.json` (currently
    `0.18.3`) + `package-lock.json` + `EXTENSION_VERSION` in
    `extensions/pi-claude-marketplace/shared/extension-version.ts` +
    `sonar.projectVersion` in `sonar-project.properties` + `CHANGELOG.md`
    (`[Unreleased]` needs entries for: bare `plugin.json` read, object-shaped
    dependency rendering in `info`, dependency resolution on install,
    install provenance / schemaVersion 3, `uninstall --keep-data`,
    `uninstall --prune`, the dependents-remain refusal). Re-run `npm test`
    after the bump (a test pins the version). PR title: Conventional
    Commits, ≤72 chars, no GSD phase/milestone mentions; PR body via the
    `simple-english` (Plain) + `humanizer` skills; merge with `--squash`.

## Gotchas observed this run (environment, not regressions)

- Worktree isolation auto-degrades on this checkout (HEAD is ~224 commits
  past `origin/HEAD`); executors run sequentially on the main tree. Force the
  isolation sentinel to `none` before any dispatch
  (`gsd-tools query dispatch-isolation --raw --phase N --plan N-MM
  --force-isolation none`).
- `state.update-progress` warns "no `Progress:` line" on this workstream
  STATE.md — harmless. `phase.complete` stomps `current_phase_name` and the
  Current Position narrative; restore them after any run.
- `tdd-red-evidence` reads top-level TAP names only; `describe`-nested
  subtests report `INVALID_RED` even when the raw TAP shows the target
  failing — record raw TAP evidence in the SUMMARY instead of restructuring.
- Harness IDE diagnostics on `.ts` (e.g. `dependency-index.ts`) are false
  positives; trust `npm run typecheck`.
- The decision-coverage gate parser needs each `- **D-NN: title**` bullet's
  bold to close on line 1 and to contain exactly one colon inside the bold.
- The two pi-subagents integration tests resolve a global peer and can fail
  locally on a stale global version; they passed on this machine.

## Done means

- `03/04/05-SECURITY.md` exist with no open threats; `03/04/05-VALIDATION.md`
  read `status: validated`.
- IN-05 and IN-06 each have a recorded decision.
- `v1.20-MILESTONE-AUDIT.md` regenerated after the above.
- Milestone archived under `.planning/milestones/v1.20-*`, phases cleaned,
  STATE.md/ROADMAP.md/PROJECT.md consistent, and a PR open from
  `features/manifest` with CI green.
- Delete this file in the same commit that closes the milestone.
