---
phase: 05-install-and-update-rollback
verified: 2026-10-23T18:00:00Z
status: passed
score: 4/4 must-haves verified
---

# Phase 5: Install and Update Rollback - Verification

**Goal:** An install or an update that fails partway leaves the scope as it
was before the command, and the same command succeeds once the cause is gone.

| # | Success criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | A failed install reports its reason and leaves no record, declaration, or skill in a new session (INS-07) | VERIFIED | install-rollback.feature: failure row whole (`failed`, cause chain EISDIR on `{project dir}/.pi/mcp-adapter.json`; empty reasons per CONTEXT D-03), `claude-plugins.json` declares no plugins, scope has no installed plugins; new scenario: a session after the failed install offers no skills |
| 2 | The same install succeeds once the target is writable, and a session offers the skills (INS-07) | VERIFIED | install-rollback.feature retry scenario: `installed` 1.0.0, session offers `/skill:demo-skill` (`A skill of demo 1.0.0.`) |
| 3 | A failed update keeps the old version in list, info, session, and record (UPD-04) | VERIFIED | update-rollback.feature: failure row `failed` / `unreadable`; record `demo@fixtures 1.0.0 true`, declaration and staged `demo-skill` kept; `list` `upgradable` 1.0.0; `info` `installed` 1.0.0; session offers `A skill of demo 1.0.0.`; retry after unblock updates 1.0.0 -> 1.1.0 |
| 4 | Scenarios pass; check:features and check green | VERIFIED | `npm run check` exit 0 in the worktree at `83fd54fb`: static gates incl. fallow, unpaired, integration, `test:cucumber` 469 scenarios / 4473 steps passed, direct coverage merged |

## Product bugs

- **Fixed:** an update failing on a local file error (EISDIR/EIO/EBADF)
  reported `unreadable manifest`; now `unreadable` (`7671e03f`, CONTEXT D-04).
- **Not a bug:** the install EISDIR row with empty reasons (CONTEXT D-03;
  Claude Code 2.1.308 prints `Failed to install plugin X: <message>`).

## Scope note

UPD-04 is verified for the pre-swap (prepare) failure. A post-swap failure is
by design not rolled back (`rollback partial` + reinstall hint, update-swap
D-03) and is outside UPD-04 (CONTEXT D-02).

## For the orchestrator

- REQUIREMENTS INS-07 and UPD-04 can be marked complete; ROADMAP Phase 5 has
  one plan (05-01).
- Lock-held update row still reaches the `unreadable manifest` fallback; owner
  Phase 15.
