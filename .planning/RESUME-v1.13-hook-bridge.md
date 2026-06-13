# Resume v1.13 Claude Hook Bridge milestone planning

**For the next Claude Code session:** Read this file end-to-end before doing anything. Then continue the `/gsd-new-milestone` workflow from step 8 (research decision).

## Where we are

- Branch: `features/v1.13-hook-bridge`
- Milestone: v1.13 Claude Hook Bridge (defined; requirements and roadmap pending)
- Workflow position: `/gsd-new-milestone` steps 1–7 complete and committed
- Next pending step: step 8 — research decision (recommendation: **skip** the 4-agent parallel research pass; see "Decision shortcut" below)

## What's already committed on this branch

| Commit                                                              | What                                                                                |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `docs(planning): start v1.13 Claude Hook Bridge milestone`          | PROJECT.md Current Milestone section + STATE.md milestone switch + research doc     |
| `docs(planning): split v1.13 out-of-scope into upstream-fixable...` | Bucket H (semantically inapplicable) introduced; ConfigChange/Setup/InstructionsLoaded moved out of supported scope |
| `docs(planning): move WorktreeCreate/Remove from bucket C to G`     | Worktree pair → soft-dep + upstream PR pattern via pi-worktrees                     |
| `docs(planning): clarify upstream-PR distinction in bucket G...`    | Reframed language so bucket G PRs are clearly not project commitments               |
| `docs(planning): move TaskCreated/TaskCompleted from bucket C to H` | Pi has no canonical task primitive; bucket C ends up empty in v1.13 scope           |
| `docs(planning): sharpen B/D bucket split by future-stability`      | Bucket B reserved for structurally-stable synthesis; everything else moved to D     |

Run `git log --oneline main..HEAD` to verify all 6 commits are present.

## Authority source

**`docs/research/claude-hooks-vs-pi-events.md`** is the load-bearing artifact. Every bucket assignment, marketplace audit finding, soft-dep audit finding, payload-extension policy, and lifecycle design decision is captured there. Read it before working on requirements.

Companion: **`.planning/PROJECT.md`** has the Current Milestone section + Out of Scope additions for v1.13.

## v1.13 scope (locked)

**16 supported events:**

| Bucket                              | Count | Events                                                                                  |
| ----------------------------------- | ----- | --------------------------------------------------------------------------------------- |
| A — Direct 1:1 map                  | 8     | SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, PostToolUseFailure, PreCompact, PostCompact, SessionEnd |
| B — Stable synthesis                | 1     | FileChanged                                                                             |
| C — Bridge ships feature            | 0     | (empty — all candidates moved to G or H by the "would-anybody-naturally-invoke" filter) |
| D — Lossy or future-fragile synth   | 5     | CwdChanged, PostToolBatch, UserPromptExpansion, Stop, StopFailure                       |
| Soft-dep conditional (pi-subagents) | 2     | SubagentStart, SubagentStop                                                             |

**14 unsupported events** = 9 upstream-fixable (not committed by this project) + 5 semantically inapplicable:

| Bucket                                  | Count | Events                                                                  |
| --------------------------------------- | ----- | ----------------------------------------------------------------------- |
| E — pi-coding-agent runtime exposure PR | 4     | Notification, PermissionRequest, PermissionDenied, MessageDisplay       |
| F — Pi feature addition                 | 1     | TeammateIdle                                                            |
| G — Soft-dep extension PRs              | 4     | Elicitation, ElicitationResult (pi-mcp-adapter); WorktreeCreate, WorktreeRemove (pi-worktrees) |
| H — Semantically inapplicable           | 5     | ConfigChange, Setup, InstructionsLoaded, TaskCreated, TaskCompleted     |

## Critical subtleties (do not lose these)

1. **Bucket G is structurally different from soft-dep-conditional.** `pi-subagents` already publishes the events the bridge needs — installing the soft dep is sufficient (counted in the 16 supported). `pi-mcp-adapter` and `pi-worktrees` do NOT publish events yet — both the soft dep AND an upstream PR must land. The project is NOT committed to sending the G-bucket PRs.

2. **Marketplace audit:** 5/5 hook-using plugins in the official Anthropic marketplace are supportable under v1.13's scope (4 fully, 1 partially due to `asyncRewake` payload extension). Zero first-party plugins exercise any of the 14 unsupported events.

3. **`Stop` is the load-bearing test case.** Three first-party plugins (`ralph-wiggum`, `hookify`, `security-guidance`) hook it; canary plugin = `ralph-wiggum`. The bridge's bucket-D synthesis MUST round-trip `{"decision": "block", "reason": "..."}` correctly.

4. **Hook-payload extensions:** `asyncRewake` / `rewakeMessage` / `rewakeSummary` on `security-guidance` are non-Claude-Code hook-entry fields that the bridge tolerates (ignore + debug-log unknown fields, warn at install time).

5. **Bucket H drop policy:** debug-log only at hook-config parse time; NO install-time warning (would be noise).

6. **Plugin lifecycle:** all install / uninstall / enable / disable operations go through `/reload` because Pi's `pi.on(...)` returns void (no unsubscribe). This matches v1.12's existing reconcile pattern. See § "Plugin lifecycle and hook routing" in the research doc.

## Decision shortcut for step 8 (research vs skip)

The `gsd-new-milestone` workflow at step 8 asks "Research the domain ecosystem for new features before defining requirements?". Default behavior is to spawn 4 parallel `gsd-project-researcher` agents covering Stack / Features / Architecture / Pitfalls.

**Recommendation: SKIP.** The existing research doc (`docs/research/claude-hooks-vs-pi-events.md`) already covers what those 4 agents would produce, and it's specifically scoped to this milestone (Claude Code hook taxonomy, Pi event taxonomy, cross-mapping, feasibility, marketplace audit, soft-dep audits, lifecycle architecture). Spawning 4 fresh researchers would duplicate work and not surface anything new.

## After step 8: define REQUIREMENTS.md

Probable requirement categories to derive REQ-IDs from:

1. **Resolver / state schema** — new `hooks` component type alongside skills/commands/agents/mcpServers; state.json schema bump
2. **Bridge dispatch core** — one composite `pi.on(...)` per Pi event type; internal per-plugin routing; matcher translation (literal + pipe-OR; full regex deferred)
3. **Bucket A payload translators** — the 8 direct-map events
4. **Bucket B synthesis** — `FileChanged` via `fs.watch`
5. **Bucket D synthesis** — `CwdChanged`, `PostToolBatch`, `UserPromptExpansion`, `Stop`, `StopFailure` (each has documented loss mode)
6. **Stop synthesis (canary: ralph-wiggum)** — bridge intercepts `agent_end`, queues synthetic user message via `pi.sendUserMessage()`
7. **Soft-dep wiring (pi-subagents)** — async runs subscribe to `subagent:async-started` / `subagent:async-complete`; sync runs synthesize from `tool_call` / `tool_result` filtered on `toolName === "subagent"`; per-row `{requires pi-subagents}` marker when absent
8. **Lifecycle integration with v1.12 reconcile** — install/uninstall/enable/disable reconcile hooks through claude-plugins.json; per-plugin `hooks/` subtree containment (NFR-10 extension)
9. **Hook-payload-extension tolerance** — ignore + debug-log unknown fields; install-time warning for known ones
10. **Bucket H drop policy** — silent drop at parse time for the 5 H events; debug log only

The roadmapper agent will split these into phases (continuing numbering from Phase 56 / v1.12).

## Sanity checks before resuming

Run these to confirm the on-disk state matches expectations:

```bash
# Branch
git rev-parse --abbrev-ref HEAD  # expect: features/v1.13-hook-bridge

# Commits
git log --oneline main..HEAD     # expect: 6 commits, last is "sharpen B/D bucket split"

# Working tree clean (modulo runtime junk)
git status --porcelain           # untracked .bg-shell/ .gsd/ etc are fine

# Milestone state
grep -A1 "^milestone:" .planning/STATE.md   # expect: v1.13
grep "Claude Hook Bridge" .planning/PROJECT.md  # expect: matches in Current Milestone section
```

## Where to start the next session

After reading this file, the doc, and PROJECT.md, the next concrete action is:

1. Acknowledge the user that context is restored and confirm v1.13 scope is as locked above.
2. Resume the `/gsd-new-milestone` workflow at step 8.
3. If the user accepts the skip recommendation, proceed directly to step 9 (define REQUIREMENTS.md).
4. If not, spawn the 4 parallel `gsd-project-researcher` agents per the workflow template.
