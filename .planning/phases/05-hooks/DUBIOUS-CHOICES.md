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

### P5-DC-13: Plan-check revision: a 25-file plan accepted, five waves

- **Phase / source:** plan checker iteration 1 and the planner's revision.
- **Severity:** Low. **Status:** open.
- **Choice:** The old 05-07 was split: 05-07 keeps the `hook-notice` kind
  with its first caller (25 files, justified in its "Scope note" because the
  kind must land in one commit), the new 05-08 owns tool context and Stop, and
  the gate plan became 05-09. Phase 5 now has 9 plans in 5 waves (supersedes
  P5-DC-12's "8 plans, 4 waves"). 05-01, 05-02, 05-06 keep 15-18 files with a
  scope note. The 05-06/05-07 ordering is `coupling_justified`, not a
  dependency.
- **Alternatives:** Spread the kind over two commits (red tree between them);
  six waves with a dependency.
- **Why dubious:** The per-plan budget is exceeded by design; the coupling
  justification holds only if 05-07's tests never assert a context value.
- **Recorded in:** `05-07-PLAN.md` "Scope note", `05-08-PLAN.md`, `05-09-PLAN.md`.

### P5-DC-14: Executor prompts read the GSD execution files by path

- **Phase / source:** Phase 5 execute-phase orchestration.
- **Severity:** Low. **Status:** open.
- **Choice:** As DC-17 did for Phase 1, each executor prompt names
  `execute-plan.md`, `summary.md`, `checkpoints.md`, `tdd.md`,
  `worktree-path-safety.md`, and `executor-examples.md` by absolute path for
  the executor to read, instead of inlining their text. The worktree branch
  check is embedded verbatim.
- **Alternatives:** Inline the files verbatim, as the workflow says.
- **Why dubious:** Departs from the literal build-time embed instruction; an
  executor that skipped a read would miss the contract.
- **Recorded in:** this file.

### P5-DC-15: Wave 1 executor choices (05-01 session tracer, 05-02 process)

- **Phase / source:** executors of 05-01 and 05-02.
- **Severity:** Medium. **Status:** open.
- **05-01:**
  1. Terminal (TUI) scenarios start a profile Pi and install to the user
     scope through it, instead of using the shared Pi: the shared Pi kept the
     plugin's SessionEnd hook routed and recreated `<home>/harness` in the
     next scenario's reset.
  2. Edited two byte cases in `test/bridges/hooks/dispatch-exec.test.ts`
     (05-02's file); the merge was clean.
  3. A failed compaction SessionStart leg logs and still runs PostCompact; a
     stale generation stops both.
  4. The terminal Given polls the hook log every 50 ms (30 s cap) for the
     `startup` run.
  5. The `compact_summary` literal is Pi's own split-turn summary text, so it
     changes if Pi changes that text.
  6. The session-id projection applies to every cell, not only
     `CLAUDE_ENV_FILE`.
  7. Task 3's red run restored base sources temporarily (not committed).
- **05-02:**
  1. Edited one line of `runs.steps.ts` (05-01's file) so the `arguments`
     cell gets run-token projection; also `test/bridges/hooks/runtime.test.ts`
     (outside its file list) for the new `TimerLadder.fired()`.
  2. The `onFailure` message drops `\n<stderr>` when stderr is empty; broken
     JSON reports the hook's stderr; the `onFailure` check runs before the
     parse, so exit 1 with valid deny JSON blocks with the `onFailure`
     message (upstream order unprobed).
  3. The "ignored" debug line for Stop/async `onFailure` fires on every run.
  4. `TimerLadder.fired()` is true only when SIGTERM reaches a child still
     running at its deadline (HKDR-01 grandchild case not counted).
  5. Script hooks need a `dir` or `file` publication (mode bit).
- **Recorded in:** `05-01-SUMMARY.md`, `05-02-SUMMARY.md`.

### P5-DC-16: Wave 2 executor choices (05-03 tool use, 05-04 configuration, 05-05 lifecycle)

- **Phase / source:** executors of 05-03, 05-04, 05-05.
- **Severity:** Medium. **Status:** open.
- **05-03:**
  1. On an exit other than 0 and 2, a JSON object on stdout is applied whole
     ("the fields alone decide"); a signal kill and plain stdout stay noop.
  2. Default reasons taken from the binary: `[<command>]: No stderr output`,
     `Blocked by hook`; `Operation stopped by hook` for `continue:false`
     without `stopReason` (not verified upstream).
  3. `ask` without a terminal blocks with the hook's reason alone; an `ask`
     without a reason uses Pi's default block text; the TUI dialog wording
     (`PreToolUse:<Tool> hook asks to allow this call`) is the bridge's own.
  4. One type assertion widens `tool_result` content past the frozen
     `pi-api.ts` text-only type (parent line to widen it).
  5. Contexts: empty ones dropped; the SessionStart buffer now holds one joined
     entry (before, only the last hook's context survived).
  6. `applyMutationInPlace` and its three tests removed; the dispatch-level
     UserPromptSubmit context case deleted, not moved (fallow clone).
  7. Tests outside its list edited minimally: `dispatch-exec.test.ts`,
     `event-router.test.ts`, `test/index.test.ts`.
  8. Found, not fixed in 05-03: PostToolUse `updatedToolOutput` edits
     `event.content` in place and returns `undefined`, so Pi 1.4 drops it.
     The session routes the fix to 05-06 (owns `event-adapters.ts` in wave 3)
     under the bug policy.
- **05-04:**
  1. Edited `test/domain/plugin-resolver.test.ts` (3 cases) and
     `test/orchestrators/plugin/list-flow.test.ts` (1 case), which pinned the
     old silent-ignore rule.
  2. A marketplace-entry `hooks` counts in every form; only the manifest gets
     the D-CF5-27 convention-path exception. An empty inline `{}` counts as
     declared; `""`, `null`, `[]`, `[""]` do not.
  3. A whitespace-only `if` on a tool-less event still compiles to match-all
     (upstream skips only an empty `if`).
  4. Info names manifest/entry hooks only through the `unsupported hooks`
     reason (`orchestrators/plugin/info.ts` is not owned).
  5. One commit per TDD task (no separate red commit); one style-only commit.
- **05-05:** no product change; the update scenario checks hook runs, not
  model calls.
- **Recorded in:** `05-03-SUMMARY.md`, `05-04-SUMMARY.md`, `05-05-SUMMARY.md`.

### P5-DC-17: Wave 3 executor choices (05-06 additional context, 05-07 hook notices)

- **Phase / source:** executors of 05-06 and 05-07.
- **Severity:** Medium. **Status:** open.
- **05-06:**
  1. Edited two cases in `test/bridges/hooks/dispatch.test.ts` (05-07's file)
     for the returned `updatedToolOutput` patch; merge was clean.
  2. Plain-text context follows the documented rule: stdout not starting
     with `{` and ending with `}` is plain text (a JSON array or number
     counts as context); braced stdout that fails to parse adds nothing;
     multi-line JSON is a parse failure (upstream edge not probed).
  3. Context reaches the model as one hidden custom message
     (`claude-hook-additional-context`, `display: false`), one text part per
     event; upstream injects a system-reminder in the same request.
  4. Whitespace-only context is dropped when the message is built; a prompt
     queued while streaming sends its context with the next run (not probed).
  5. The `updatedToolOutput` fix (routed by the session) is pinned by unit
     cases and an uncommitted probe scenario; the session routes the
     committed scenario to 05-08, which owns `tool-use.feature`.
  6. A type assertion keeps 100% branch coverage in `wire-protocol.ts`.
- **05-07:**
  1. Session notices are labelled `<Event>:<value>` (`SessionStart:clear says:
     ...`), not D-CF5-14's literal `<Event>[:<Tool>]`; SessionStart is verified
     upstream, SessionEnd and PostCompact by inference.
  2. The kind has one severity, `info`; upstream draws the blocked-prompt
     message as a warning and the hook error in the error colour.
  3. Exit-2 blocks on SessionStart, SessionEnd, PostCompact are reported too;
     a blocked prompt still shows its hooks' system messages first (unverified
     upstream); UserPromptSubmit `continue:false` shows no notice (BACKLOG).
  4. `HOOK_NOTICE_PAYLOAD` sits before the `internal-error` arm, moving it from
     index 22 to 23; an extra step `the hooks show the user no messages`.
  5. A manual TruffleHog run flags existing fake `ghp_` fixtures as verified
     through the proxy; commits ran without any skip.
- **Recorded in:** `05-06-SUMMARY.md`, `05-07-SUMMARY.md`.
