# Resume v1.13 Claude Hook Bridge milestone — at step 10 (roadmap)

**For the next Claude Code session:** Read this file end-to-end before doing anything. Then continue the `/gsd-new-milestone` workflow from **step 10 (Create Roadmap)** — spawn `gsd-roadmapper` against the 31 REQs in `.planning/REQUIREMENTS.md`.

## Where we are

- Branch: `features/v1.13-hook-bridge`
- Milestone: v1.13 Claude Hook Bridge (REQUIREMENTS.md committed; roadmap pending)
- Workflow position: `/gsd-new-milestone` **steps 1–9 complete and committed**. The previous session iterated heavily on scope and locked the final shape.
- Next pending step: **step 10 — create roadmap** (spawn `gsd-roadmapper` with `--reset-phase-numbers` OFF; continue phase numbering from Phase 57, since v1.12 ended at Phase 56)
- Branch is ahead of main by ~14 commits (verify with `git log --oneline main..HEAD`)

## What's already committed on this branch

Run `git log --oneline main..HEAD` to verify. Key checkpoints in order:

1. Initial milestone setup (6 commits) — PROJECT.md scope, STATE.md milestone switch, the authority research doc `docs/research/claude-hooks-vs-pi-events.md`, bucket refinements
2. Original RESUME handoff doc (this file's predecessor)
3. v1.12 research archived to `.planning/milestones/v1.12-research/`
4. Parallel research pass for v1.13: `STACK.md` / `FEATURES.md` / `ARCHITECTURE.md` / `PITFALLS.md` / `SUMMARY.md` written under `.planning/research/`
5. Initial REQUIREMENTS.md committed (30 REQs across 8 categories — the 16-event scope)
6. New authority doc `docs/research/claude-hook-config-syntax.md` after fetching Claude Code hook contract end-to-end
7. `if` field + `asyncRewake` promoted from ESCALATE to IMPLEMENT (added MATCH-03, HOOK-06, EXEC-05; verified Pi's `pi.sendMessage` + `CustomMessage` primitives match Claude Code's `<system-reminder>` semantic)
8. **v1.13 scope cut to bucket-A only** (the critical decision — see below)
9. PROJECT.md synced to bucket-A-only scope
10. SURF-06 added — user-facing hook-support doc REQ
11. This RESUME doc update

## v1.13 scope (locked — DIFFERENT from original)

**Original scope** (per PROJECT.md initial commit + early research): 16 events — bucket A + B + D + soft-dep conditional.

**Final v1.13 scope**: **bucket A only — 8 events**. The strict-supportability stance (plugins unavailable for any sub-100% fidelity) was internally inconsistent with shipping bucket B and bucket D events that have documented loss modes. Cut to bucket A only for internal consistency. **This is a deliberate scope reduction, not a regression.**

**8 v1.13-supported events** (bucket A, direct 1:1 map to Pi runtime events, 100% fidelity):

- `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PreCompact`, `PostCompact`, `SessionEnd`

**Everything else** is deferred or unsupported:

| Bucket | Events | v1.13 disposition | v1.14+ unblocker |
|---|---|---|---|
| B | FileChanged | Deferred (chokidar + cross-platform CI) | PAYL-V2-01 |
| D | CwdChanged, PostToolBatch, UserPromptExpansion, Stop, StopFailure | Deferred (lossy synthesis) | PAYL-V2-02..PAYL-V2-06 |
| soft-dep conditional | SubagentStart, SubagentStop | Deferred (sync-mode synthesis is best-effort + soft-dep gating immature) | PAYL-V2-07 |
| E | Notification, PermissionRequest, PermissionDenied, MessageDisplay | Blocked on upstream `pi-coding-agent` PR | EPROM-01 |
| F | TeammateIdle | Blocked on new Pi feature | FPROM-01 |
| G | Elicitation, ElicitationResult, WorktreeCreate, WorktreeRemove | Blocked on upstream `pi-mcp-adapter` + `pi-worktrees` PRs | GPROM-01 |
| H | ConfigChange, Setup, InstructionsLoaded, TaskCreated, TaskCompleted | Permanently inapplicable to Pi | HPROM-01 (permanent gate) |

## REQUIREMENTS.md — 31 REQs across 9 categories

The authoritative contract is `.planning/REQUIREMENTS.md`. Summary:

| Category | REQ-IDs | Purpose |
|---|---|---|
| HOOK | HOOK-01..06 | New `hooks` component type; schema v2 migration; payload-extension tolerance; `{hooks}` → `{unsupported hooks}` REASONS rename; CLAUDE_* env vars; `asyncRewake` registry (HOOK-06) |
| MATCH | MATCH-01..03 | Claude-form literal + pipe-OR matchers; regex detect/reject; **`if` field implementation** (MATCH-03) with full permission-rule syntax + Bash subcommand parsing + glob match |
| TOOL | TOOL-01..02 | Bidirectional Pi ↔ Claude tool-name mapping table; **4-condition plugin-supportability gate** (regex / unknown tool / event not in bucket A / non-`command` handler) |
| DISP | DISP-01..04 | Composite-per-event handler; routing rebuild from `reconcile/apply.ts`; epoch guard against zombie dispatch; deterministic ordering via `compareByNameThenScope` |
| EXEC | EXEC-01..05 | spawn with Pi cwd + dual CLAUDE_/PI_ env; 600s timeout (upstream parity); IL-2 stderr → debug-log; `args` exec-form support; **`asyncRewake` background-spawn pattern** (EXEC-05) |
| PAYL | PAYL-01 | Bucket A 8 translators with Pi → Claude tool-name translation in stdin payload (bucket B/D/soft-dep dropped from v1.13) |
| SURF | SURF-01..06 | `info hooks:` line; typed HookSummary; (SURF-03 placeholder for v1.14+); no `list` hook column; rewakeMessage/Summary warning; **user-facing `docs/hooks.md` linked from README** (SURF-06) |
| LIFE | LIFE-01..03 | 5th bridge in `runPhases.ts` cascade; NotificationMessage reload-hint reuse; per-plugin containment + `fs.realpath` + `assertPathInside` |
| OBS | OBS-01 | `shared/debug-log.ts` env-gated sole debug seam |

## Authority sources

- `docs/research/claude-hooks-vs-pi-events.md` — event taxonomy, bucket assignments, marketplace audit, soft-dep wiring (scoped to original 16 events; still authoritative for bucket classifications)
- `docs/research/claude-hook-config-syntax.md` — full Claude Code hook config field reference (file layout, standard fields, per-event stdin/stdout, env vars, `if` / `asyncRewake` semantics, per-plugin audit, IMPLEMENT/TOLERATE/ESCALATE verdicts)
- `.planning/REQUIREMENTS.md` — the 31-REQ contract (authoritative for current scope)
- `.planning/PROJECT.md` § "Current Milestone: v1.13 Claude Hook Bridge" — synced with the bucket-A-only scope

**Scope-mismatch note for the roadmapper**: the five supporting-research docs at `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS,SUMMARY}.md` were written against the original 16-event scope. Treat any reference there to FileChanged (bucket B), bucket-D events, or soft-dep Subagent events as v1.14+ promotions (PAYL-V2-01..PAYL-V2-07). In particular:

- **STACK.md's chokidar@^5 runtime dep is deferred to v1.14+** (PAYL-V2-01)
- **PITFALLS.md's bucket-D loss-mode catalog is deferred to v1.14+**
- **ARCHITECTURE.md's 9-phase ordering shrinks** because bucket-B/D/soft-dep phases drop out of v1.13
- MATCH-03 (`if` field) and HOOK-06 + EXEC-05 (`asyncRewake`) stay in v1.13 as forward-compat investments despite no first-party first-party plugin in bucket-A-only scope exercising them

REQUIREMENTS.md's top section reiterates this scope-mismatch note for the roadmapper.

## Marketplace coverage under v1.13

| Plugin | Hooks? | v1.13 verdict | v1.14+ unblocker |
|---|---|---|---|
| 8 plugins with no hooks (`agent-sdk-dev`, `claude-opus-4-5-migration`, `code-review`, `commit-commands`, `feature-dev`, `frontend-design`, `plugin-dev`, `pr-review-toolkit`) | no | INSTALLS | n/a |
| `explanatory-output-style`, `learning-output-style` | yes (SessionStart only) | INSTALLS | n/a |
| `ralph-wiggum` | yes (Stop) | UNAVAILABLE `{unsupported hooks}` | PAYL-V2-04 (Stop) |
| `hookify` | yes (incl Stop) | UNAVAILABLE `{unsupported hooks}` | PAYL-V2-04 (Stop) |
| `security-guidance` | yes (incl Stop + MultiEdit/NotebookEdit) | UNAVAILABLE `{unsupported hooks}` | PAYL-V2-04 + PROM-01 |

**10/13 first-party plugins install (76.9%); 2/5 hook-using plugins (40%).** Down from the original 16-event-scope projection of 12/13 (92.3%). The trade-off is deliberate: smaller surface, 100% fidelity, internal consistency between event-level and plugin-level supportability.

## Substantive decisions made during the previous session

These are NOT all captured in REQUIREMENTS.md verbatim — they're the user's stated preferences that informed the scope:

1. **Strict-supportability stance at PLUGIN level**: plugins unavailable for any sub-100% hook fidelity (not per-entry soft-degrade for hooks)
2. **Strict-supportability stance at EVENT level** (this session's final decision): drop bucket B/D/soft-dep events because they have documented loss modes; only ship bucket A (1:1 mapping events)
3. **Implement `if` field** (MATCH-03): research confirmed it's tractable in pure JS (~300 LoC); upstream Claude Code itself documents the filter as "best-effort, fail-open on parse failure" so our equally-best-effort impl matches contract
4. **Implement `asyncRewake` family** (HOOK-06 + EXEC-05): research found Pi DOES have the matching primitive (`pi.sendMessage` with `deliverAs: "nextTurn"` + `CustomMessage` with `display: false` = `<system-reminder>` semantic equivalent)
5. **Keep MATCH-03 + HOOK-06 + EXEC-05** despite no first-party driver in bucket-A-only scope — forward-compat investment for third-party plugins
6. **`{hooks}` REASONS token renamed to `{unsupported hooks}`** with catalog-UAT byte-form updates in lockstep (HOOK-04)
7. **Soft-dep precedent NOT broken at the component level**: hooks have strict supportability; existing v1.12 agent-component soft-degrade behavior is untouched
8. **Add SURF-06 user-facing hook-support doc** — `docs/hooks.md` linked from README, written for first-time readers (plugin authors / end users), NOT for project maintainers; no internal jargon, uses Claude Code's own field names verbatim

## Sanity checks before resuming

```bash
# Branch
git rev-parse --abbrev-ref HEAD          # expect: features/v1.13-hook-bridge

# Commits ahead of main
git log --oneline main..HEAD             # expect: ~14 commits, last is this RESUME doc update

# Milestone state
grep -A1 "^milestone:" .planning/STATE.md   # expect: v1.13

# REQ count
grep -c "^- \[ \] \*\*" .planning/REQUIREMENTS.md  # expect: 31

# Marketplace coverage line
grep "10/13" .planning/REQUIREMENTS.md   # expect: matches the coverage table
```

## Where to start the next session

After reading this file, PROJECT.md (Current Milestone section), and REQUIREMENTS.md end-to-end, the next concrete action is:

1. Acknowledge that context is restored and confirm v1.13 scope is bucket-A-only with 31 REQs.
2. Resume the `/gsd-new-milestone` workflow at **step 10 — Create Roadmap**.
3. Spawn `gsd-roadmapper` with phase numbering continuing from **Phase 57** (v1.12 ended at Phase 56; no `--reset-phase-numbers`).
4. Feed the roadmapper:
   - `.planning/REQUIREMENTS.md` (the 31 REQs — primary input)
   - `.planning/PROJECT.md` (current milestone + decisions + constraints)
   - `.planning/research/SUMMARY.md` (research synthesis — with the scope-mismatch caveat that the bucket-B/D/soft-dep references are now v1.14+)
   - The two authority docs as cross-references
5. After roadmapper returns ROADMAP CREATED:
   - Present roadmap inline (phase table, requirements mapping, success criteria)
   - Ask user for approval via AskUserQuestion
   - On approve, commit `.planning/ROADMAP.md` + updated `.planning/STATE.md` + updated `.planning/REQUIREMENTS.md` traceability table
6. Then step 10.5 (link pending todos to roadmap phases — likely no-op if `.planning/todos/pending/` is empty)
7. Then step 11 — print the "milestone initialized" closer and exit the workflow.

After that, the user can `/clear` again and start the first phase with `/gsd-discuss-phase 57` (or whatever the first new phase number is) or `/gsd-plan-phase 57`.

## Roadmapper guidance

The roadmapper should derive phases that:

- Land HOOK-01 / HOOK-02 (schema bump + component type) FIRST — leaf dependency for everything else
- Group MATCH-01 + MATCH-02 (matcher parser + regex reject) with HOOK-03 (TypeBox `additionalProperties: true`) — pure-code phase, no I/O
- TOOL-01 (Pi ↔ Claude tool-name mapping table) is consumed by MATCH-03 + PAYL-01 → land it with the parser phase
- TOOL-02 (resolver supportability gate) consumes the parser output → land after parser, before dispatch
- DISP-01..04 (dispatch core: composite handlers, routing table, epoch guard, ordering) is a standalone phase; depends on TOOL-01 + parser
- EXEC-01..04 (spawn + env + timeout + args) — small phase, mostly mechanical
- PAYL-01 (bucket A 8 translators) — fan-out to ~8 small files; can be a single phase with one test per event
- MATCH-03 (`if` field, ~300 LoC across 5 modules) — distinct phase, possibly parallel-eligible with the bucket-A translators
- HOOK-06 + EXEC-05 (`asyncRewake` registry + background spawn) — distinct phase, ~250-300 LoC
- LIFE-01..03 (cascade integration + reload-hint + containment) — depends on dispatch core
- SURF-01..05 (info/list/notify rendering + payload-extension warning) + HOOK-04 (REASONS rename + catalog-UAT lockstep) — surface phase
- SURF-06 (user-facing docs/hooks.md + README link) — documentation phase, can be last or parallel
- OBS-01 (debug-log seam) — cross-cutting, can be folded into dispatch core phase

Roadmapper may propose 6–9 phases. The exact split is its call. The previous session's research suggested 9 phases for the 16-event scope; with bucket B/D/soft-dep removed, ~6–7 phases is more realistic.
