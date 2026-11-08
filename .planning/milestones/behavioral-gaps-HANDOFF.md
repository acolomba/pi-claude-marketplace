# behavioral-gaps handoff (2026-11-08)

## Where it stands

- Worktree `/home/acolomba/src/pi-claude-marketplace-behavioral-gaps`, branch `features/behavioral-gaps`, head after `51c2d702` (the Phase 2 merge). Nothing is pushed.
- All 16 phases are complete, verified, and merged. Each merge applied its parent lines: Key Decisions rows, BACKLOG entries, frozen-file seed titles, and docs. The root `.planning/DUBIOUS-CHOICES.md` holds every phase's entries plus the session-level ones S-01 to S-05.
- The CHANGELOG lines of each phase are collected, not yet written, in `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/45e74ef7-b24a-4893-854b-b4c04365a440/scratchpad/changelog-lines.md`. That scratchpad may be gone in a new session; the same lines are in each phase's last SUMMARY.md under "Parent lines".

## Open blocker: parallel adapter-profile flakes

The final `npm run check` passes every part except the cucumber adapter profile, which fails 10 to 18 of about 1,770 scenarios per run, a different set each run, at low load (load average about 8). Every failure passes when rerun alone or in a small group. The failures are new-session loads (no SessionStart hook run, no skill offered), autoupdate in a new session, autoapply, and `--local` or dependency commands. Builtin (152/152), direct coverage, and `test:modules` pass.

Measurements, adapter profile with the default `--parallel 8`, one run each:

| Tree | Result |
| --- | --- |
| Phase 15 branch (Phase 1 head plus scenarios) | 1659/1659 |
| Phase 3, 8, 12 branches (each alone) | 1670, 1651, 1644, all passed |
| `d8af83f0` (milestone after 9 merges) | 1718/1718 |
| `5a03d5a1` (after the Phase 10 merge) | 14 failed of 1727 |
| `0611ad11` (after Phase 5) | 18 failed of 1732 |
| Phase 6 branch (contains `d8af83f0` but not Phase 10) | 10 failed of 1732 |
| Phase 4 branch (everything but Phase 2) | 6 failed of 1770 |
| final tree | 16, then 13 failed of 1779 |
| final tree without `hook/session-end.feature` | 16 failed |
| final tree without `plugin/model-tools.feature` | 10 failed |

So no single merge is the cause. Two failing trees share neither Phase 6 nor Phase 10, and leaving out either suspect file does not help. The rate looks probabilistic once the suite passes about 1,720 scenarios. Single runs per tree are too few to prove a clean tree clean. No leftover test processes were found; `/tmp` inodes are at 12%; 19 `/tmp/pi-cm-*` directories were left behind; `/tmp/jiti` is 124 MB.

Suggested next step: `/gsd-debug` in a fresh session.

1. Run the final tree's adapter profile three times to get a base rate, then `d8af83f0` three times, to confirm that the earlier tree really is clean.
2. Read one failing scenario's whole output (all steps, not just the failing one) to see why a new session's load gave no hooks or skills.
3. Suspects: the shared `/tmp/jiti` compile cache under concurrent Pi starts; per-worker HOME switching in `features/support/isolated-pi-home.ts` (BeforeAll and Before) against long scenarios; leaked `/tmp/pi-cm-*` sandboxes.

Phase 1 recorded `/tmp/jiti` as shared by terminal Pis (child brief section 9).

## Then close the milestone

1. A clean `npm run check` on the final tree.
2. Write the CHANGELOG aggregate from the collected lines (`.agents/skills/changelog`).
3. The CI timing check: compare the three behavioral legs against the 15-minute job timeouts in `.github/workflows/ci.yml` (D-CF1-16).
4. `/gsd-audit-milestone`, then `/gsd-complete-milestone` on the branch before a PR (AGENTS.md).

## Environment debts

- The 15 phase worktrees `~/src/pi-claude-marketplace-behavioral-gaps-phase-N` and their branches still exist. Remove them when the milestone closes. Phase 2's branch carries one extra no-op merge, `11175c66`.
- A phase session ran `pre-commit install -f` in the main repository's shared `.git/hooks` to repair a migration-mode hook.
- Several phases wrote `.gsd/dispatch-isolation-sentinel.json` in this checkout (gitignored).
- Questions for the user are in the BACKLOG (ASYNCNEWSESSION-01) and in the High entries of the root dubious-choices log.
