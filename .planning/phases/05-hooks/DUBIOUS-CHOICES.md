# Phase 5 (Hooks): Dubious Choices Log

The Phase 5 child session's review queue for the choices it made without the
user. It has the same shape as the root `.planning/DUBIOUS-CHOICES.md`
(DC-01..DC-27), and the parent merges it into that file. Only the Phase 5
session writes this file. Each subagent ends its report with a
`## Dubious Choices` section, and the session copies the items here.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call that a reviewer may reverse at low cost. Low:
  process, naming, or tooling.
- **Status.** `open` until the user reviews it; the user marks it `accepted`,
  `reversed`, or `follow-up`.

## Entries

### P5-DC-01: Commit trailers name this child session, not the parent session

- **Phase / source:** Phase 5 child session, git process.
- **Severity:** Low. **Status:** open.
- **Choice:** Commits on `features/component-features-phase-5` end with
  `Claude-Session: https://claude.ai/code/session_01EDUMG8q84hyEek3xsuxpLu`,
  the session that made them.
- **Alternatives:** The `Claude-Session` line in
  `.planning/CHILD-SESSION-BRIEF.md`
  (`session_01EDUMG5ARYqF6oZYKmj6oB3`), which names the parent session.
- **Why dubious:** The brief says "End every commit message with exactly" that
  line. The session's own attribution instruction names this session, and a
  trailer that names the session that made the commit keeps the record
  traceable.
- **Recorded in:** every Phase 5 commit message.

### P5-DC-02: Phase 5 discuss decisions settled without the user

- **Phase / source:** Phase 5 smart discuss (child session, research agents A, B, C).
- **Severity:** Medium. **Status:** open.
- **Choice:** All FG-20..FG-26 items, the compaction order, the SSDEDUP-01 key,
  the MCP proxy event, parallel hooks, and dedupe are settled from upstream
  probes and binary greps as D-CF5-01..22 in `05-CONTEXT.md`, without asking.
- **Alternatives:** Stop and ask the user, as ROADMAP's "the user's answers to
  FG-20 and FG-21 as one batch" says.
- **Why dubious:** The roadmap named FG-20/FG-21 as user questions. Each
  choice below has its own entry so it can be reversed.
- **Recorded in:** `.planning/phases/05-hooks/05-CONTEXT.md`.

### P5-DC-03: Pi `fork` sends SessionEnd `resume`; Pi `reload` runs no session hooks

- **Severity:** High. **Status:** open.
- **Choice:** D-CF5-02 maps Pi `fork` to SessionEnd `resume` (upstream
  `/branch` calls the resume path) and Pi `quit` to `prompt_input_exit` in TUI,
  `other` elsewhere. D-CF5-03 runs neither SessionStart nor SessionEnd on Pi
  `/reload`, as upstream `/reload-plugins`.
- **Alternatives:** `other` for `fork` and `reload`; SessionStart `startup`
  on reload; keep `reload` as a Pi-gap value.
- **Why dubious:** The `fork`->`resume` mapping comes from reading `/branch`
  in the binary; `/branch` is interactive only and was not probed. Users with
  cleanup hooks lose the run on reload. The `logout` matcher is admitted
  although it never fires (upstream also never sends it).
- **Recorded in:** D-CF5-02, D-CF5-03.

### P5-DC-04: Deviations licensed by phase ownership, not by upstream or Pi

- **Severity:** High. **Status:** open.
- **Choice:** Three items stop short of parity because the fix lives in files
  another phase or the parent owns: D-CF5-20 reports a manifest/marketplace-
  entry `hooks` field as `{unsupported hooks}` instead of merging it (upstream
  merges); D-CF5-08 tells existing partial installs to `reinstall` instead of
  healing them in `apply`; D-CF5-06 keeps `startup` for Pi `--resume`/`--fork`
  launches (the harness launcher is frozen).
- **Alternatives:** Implement the merge and the reconcile growth move now,
  touching orchestrators (`install-outcome.ts`, `enable-disable.ts`,
  `install-cascade.ts`, `reconcile/convergence.ts`).
- **Why dubious:** The parity rule names only a decision ID or a Pi gap as
  licenses; the child-session brief asks for zero edits outside ownership.
  Each deferral has a BACKLOG parent line. D-CF5-20 still edits
  `domain/hooks-resolution.ts` minimally, which no phase lists.
- **Recorded in:** D-CF5-06, D-CF5-08, D-CF5-20.

### P5-DC-05: Parallel hook execution supersedes DISP-04

- **Severity:** Medium. **Status:** open.
- **Choice:** D-CF5-09 runs matching hooks in parallel with a deterministic
  fold, as upstream, replacing the v1.13 DISP-04 sequential fan-out.
- **Alternatives:** Keep sequential and record a divergence.
- **Why dubious:** A large change in `dispatch.ts`; a later hook's side
  effects now happen even when an earlier one blocks; the recorder's line
  order becomes nondeterministic, so scenarios key runs by hook name.
- **Recorded in:** D-CF5-09.

### P5-DC-06: MCP proxy outer call runs no hook

- **Severity:** Medium. **Status:** open.
- **Choice:** D-CF5-12: a call-mode `mcp` proxy event fires no hook; the
  nested call fires once under the real tool name. Non-call actions still
  fire as `mcp`.
- **Alternatives:** Map the outer call to the inner name and skip the nested
  one; keep firing both (today's double fire for match-all hooks).
- **Why dubious:** Calls the adapter runs inside the proxy without a nested Pi
  call (its fallbacks) then reach no hook at all, so a policy hook can be
  bypassed on those paths; today a match-all hook could block them as `mcp`.
- **Recorded in:** D-CF5-12.

### P5-DC-07: systemMessage severity and the extra decision fixes

- **Severity:** Low. **Status:** open.
- **Choice:** D-CF5-14 uses `info` severity (stream-json says `notice`; docs
  say "Warning message") and also shows SessionStart's message (medium
  evidence). D-CF5-11 makes PreToolUse `ask` confirm in the TUI and block
  elsewhere, ignores `defer` (Pi gap), and lets the planner defer uncovered
  decision fixes to BACKLOG.
- **Alternatives:** `warning` severity; scope the decision fixes out.
- **Why dubious:** The probes ran in `-p` only; interactive `ask` was not seen.
- **Recorded in:** D-CF5-11, D-CF5-14.

### P5-DC-08: Phase 1's empty `transcript_path` finding closed as a harness artifact

- **Severity:** Low. **Status:** open.
- **Choice:** D-CF5-07 keeps `""` for a `--no-session` Pi (Pi gap) and closes
  the finding: a saved Pi session sends a path from the first turn.
- **Alternatives:** Invent a path for in-memory sessions, as upstream does
  under `--no-session-persistence`.
- **Why dubious:** A hook that calls `Path(transcript_path)` in Python sees
  the current directory for `""`.
- **Recorded in:** D-CF5-07.

### P5-DC-09: UI design-contract step skipped on a false frontend match

- **Severity:** Low. **Status:** open.
- **Choice:** `check ui-plan-gate 5` answered `frontend: true` from the token
  "form" with no frontend evidence; `ui_phase` is false. The step was skipped,
  as DC-11 did for Phase 1.
- **Alternatives:** Run `gsd-ai-integration-phase 5`, the only `plan:pre`
  step hook with a skill.
- **Recorded in:** this file.

### P5-DC-10: Research open questions settled by the session

- **Severity:** Medium. **Status:** open.
- **Choice:** D-CF5-23..28 in `05-CONTEXT.md`: skip `if` hooks on tool-less
  events (upstream); one `HookSurface` kind for every hook notice; one Stop
  feedback message with a paragraph per reason, first deny reason wins;
  `/reload` through the TUI driver and resume unit-tested only; a manifest
  `hooks` string naming `hooks/hooks.json` is not partial; `tool_use_id` and
  `mcp_server` deferred; four waves instead of three.
- **Alternatives:** A second notice kind; one message per Stop reason; a
  hook-owned Pi extension to trigger reload; adding the stdin extras now.
- **Why dubious:** Upstream's choice among several deny reasons was not
  probed; the TUI reload scenario's stability is unverified; the researcher
  ran spike scenarios from the scratchpad (no repo edit).
- **Recorded in:** `05-CONTEXT.md` "Planning clarifications", `05-RESEARCH.md`.

### P5-DC-11: Project-scope hook provenance check (D-CF2-13) deferred to the merge

- **Phase / source:** parent note to the Hooks phase (2026-11-01).
- **Severity:** High. **Status:** open.
- **Choice:** Phase 5 does not add the D-CF2-13 provenance check to
  project-scope hooks, because the ledger module
  (`bridges/skills/project-installs.ts`) is not on this branch yet. A parent
  line in the last plan's SUMMARY asks for the hydrate of project-scope hooks
  to consult the generalized ledger (kind `hooks`) after the merge.
- **Alternatives:** Build a hooks-only ledger now (a second file the parent
  would need to reconcile); wait for the parent to merge Phase 2 first.
- **Why dubious:** Until then, project-scope hooks from repository-controlled
  state can run commands with no provenance check (pre-existing exposure).
- **Recorded in:** the last plan's SUMMARY "Parent lines".

### P5-DC-12: Phase 5 planning choices

- **Phase / source:** gsd-planner (8 plans, 4 waves) and the pattern mapper.
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. Four waves instead of the ROADMAP's three; both wave-3 plans depend on
     every wave-2 plan, which serializes the waves.
  2. `onFailure` lands in wave 1 (05-02), reading the field through the
     handler index signature; 05-04 adds it to the schema in wave 2.
  3. The notice kind is named `hook-notice`; error notices use `info`
     severity; exit-2 block notices also show on SessionStart, SessionEnd,
     and PostCompact (beyond D-CF5-24); the blocked-prompt notice leaves out
     upstream's "Original prompt:" line.
  4. `ask` stays a mutate `permissionDecision` with no new result arm; the
     PreToolUse block reason uses upstream's text (D-CF5-11).
  5. The prompt-context buffer sits beside the SessionStart buffer (different
     lifetimes).
  6. Deferred to BACKLOG parent lines: PostToolUse `continue:false`, a Stop
     hook error notice, non-blocking error notices for exits other than 0 and
     2, PreCompact exit-2 blocking, the `updatedToolOutput` shapes.
  7. If the TUI driver is flaky, the TUI reload and quit scenarios fall back
     to unit tests. Async-rewake substitution and the Stop/async `onFailure`
     ignore are unit-tested only. The second-compaction scenario states only
     the second run.
  8. D-CF5-20's "info names it" is met through the unsupported reason only.
  9. Threat T-05-28 (project-scope hooks without provenance, high) is
     `transfer` to the merge (P5-DC-11), which `/gsd-secure-phase` may flag.
     The guard insertion point is named as `tryHydrateOnePlugin`; a second
     routing-cache writer (`readAndCachePluginHooksWith`) is named for the
     parent.
  10. `planSpawn` substitution takes the three path values, not the env
      (pattern mapper; avoids unreachable `?? ""` branches).
  11. Unverified assumptions: how plain stdout is trimmed, and the
      `[command]` text in `onFailure` messages.
- **Recorded in:** `05-0*-PLAN.md`, `05-PATTERNS.md`.
