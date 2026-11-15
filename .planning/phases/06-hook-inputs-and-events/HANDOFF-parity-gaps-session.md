# parity-gaps autonomous run — handoff (2026-11-15)

Standing instruction: run all phases autonomously (reversible upstream-parity defaults, flagged for maintainer review); stop only for PR, publish, merge to main. Hermetic homes only; never touch the real ~/.pi/agent.

## Branches and worktrees
- `features/gaps` — /home/acolomba/src/pi-claude-marketplace-gaps (this session's cwd). Phases 1–6 complete.
- `features/gaps-agents` — ~/src/pi-claude-marketplace-gaps-agents. Phase 7 complete (d0898ebd); Phase 8 executed, in review.
- `features/gaps-mcp` — ~/src/pi-claude-marketplace-gaps-mcp. Phase 9 complete (f52e67d9); Phase 10 executing (wave 1 done).
- Side branches keep their old STATE.md on purpose (phase complete there reverted STATE; update STATE at merge).

## Executor dispatch (important)
The GSD isolation hook reads its sentinel from THIS checkout. Before each gsd-executor dispatch, from this checkout run:
`node .claude/gsd-core/bin/gsd-tools.cjs query dispatch-isolation --raw --phase NN --plan NN-MM --force-isolation none`
and start the prompt with `[gsd:dispatch phase="NN" plan="NN-MM"]`. Shared executor rules: scratchpad `exec-rules-gaps.md`, `exec-rules-agents.md`, `exec-rules-mcp.md`. Root-pin guards: `root-pin.sh`, `root-pin-gaps-agents.sh`, `root-pin-gaps-mcp.sh`.
Wave gate: `npm run check > log 2>&1; echo "exit=$?" >> log` in background; read the exit= line. A timing-only failure may be rerun once.

## Status at handoff
- UPDATE 2026-11-15: Phase 6 COMPLETE on features/gaps. Parent records applied (daef4bac: D-PG6 rows, D-CF5-06/28 and D-BG-403 superseded, BACKLOG items, codebase maps, reasoning-model skill rule, 03-VERIFICATION PG-HOOK-07a row closed); validation and security (205e10b8, 31/31 threats closed); review iteration 1 fixed WR-01/02 and documented WR-03 (cf060a19..aa4b5b6e), iteration 2 Info only; phase gate green at 4a4f3a82 (1967+188); verification passed with two judgment-tier overrides pending maintainer review (4b3392d2); HOOKPAYLOAD-01, HOOKLAUNCH-01, CHILDSESSIONID-01 closed; PG-HOOK-04/06/11 complete.
- UPDATE: Phase 6 06-12 done, wave 7 gate green at 3312c94a (1966+186). Phase 10: 10-04 and 10-05 done (8c993ecd; wave 2 complete, wave 2 gate NOT yet run — run it next, then 10-06). Parent line from 10-05: remove `userConfig` from the not-bridged list in .agents/skills/claude-code-compat-research/SKILL.md:43. Phase 8 close-out delegated to a general-purpose agent (fix WR2-01/IN2, gate, verify, phase complete 8 on its branch) — check its report/commits on features/gaps-agents.
- Phase 8 COMPLETE on features/gaps-agents (98aaf822): gate green a78def62 (1974+185), verification passed with criterion-5 override (option A). Open for maintainer: T-08-13 open nonblocking; AG-11 zero-tool-agent install refusal vs Claude Code launch-time refusal (IN3-01); IN3-02 settings keys docs. Merge parent lines: BACKLOG engine-trust request, IN3 docs follow-up, CHANGELOG workflow agents line.
- Phase 6: plans 06-01..06-12 done; 06-13 (docs + consolidated records) next; then validation, security, review loop (max 3), phase gate, verifier, fingerprint, `phase complete 6`, STATE/REQUIREMENTS hand fixes. Last green gate 4d74af3a (wave 6). Wave 7 gate after 06-12.
- Phase 8: all plans done (08-06 skipped: option A); gate green f7360834; validation/security/review committed 3826ad12; fixes 8305e78b; re-review iteration 2 running. Then: fix loop, phase gate, verifier, complete (on its branch; skip STATE).
- Phase 10: 10-01..10-03 done (both stop gates passed). Wave 1 gate: one timing failure (bootstrap.feature:147, 25 s timeout under load); rerun in progress (/tmp/pg10-wave1b.log). Next: 10-04, 10-05 (wave 2) ... 10-21 (wave 9).
- Phase 11: not started (needs 6, 8, 10 merged).

## Merge work (after 6, 8, 10)
Merge features/gaps-agents and features/gaps-mcp into features/gaps (no rebase), resolve STATE/ROADMAP, run combined `npm run check`. Apply parent lines collected in SUMMARYs/fix reports:
- PROJECT.md Key Decisions: D-PG5 (done), D-PG6-01..24 (done on features/gaps), D-PG7-01..19, D-PG8-01..17, D-PG10-* (10-20 writes).
- BACKLOG: close AGTEXCL-01 after verification (HOOKLAUNCH-01, CHILDSESSIONID-01, HOOKPAYLOAD-01 closed on features/gaps); mark WOUT-01 stale; add: ambient workflow/workflow_control on no-tools agents (T-08-17), engine trust for .pi/workflows/settings.json (T-08-13), widen agents repair to Claude Code's full set; MCPSAMPLING-01/MCPOPENUI-01 already added on gaps-mcp.
- CHANGELOG lines from 07-xx, 08-02/04, 06-13, 10-20.
- ROADMAP/REQUIREMENTS: amend Phase 8 criterion 5 and PG-WF-05 (option A, not a gap).
- STACK.md YAML bullet (agent frontmatter is now YAML).
- Security re-checks: Phases 7 and 9 audits predate their review-fix rounds.

## Decisions pending maintainer review (highlights)
D-PG7-04 (unparseable agent gets all tools; conflicts with fail-closed rule), D-PG7-17/18/19, D-PG9-07 amendment (openUi withheld), D-PG9-14/15/16, D-PG8-11 option A, D-PG6-02 (nested child names launcher), F12, D-PG10-01 (trust gap confirmed; security), D-PG10-19 (defaults on hooks/content beyond Claude Code), D-PG10-23. Overrides: Phase 5 (1), 7 (2), 9 (4).

## Lifecycle after Phase 11
Re-verify Phases 1–2 staleness, fix UAT parser ambiguity, keep AGTLONGNAME01/PG1TIMING01 open; audit, complete, cleanup; offer version bump; final report of decisions and deviations. No PR/merge without the user.
