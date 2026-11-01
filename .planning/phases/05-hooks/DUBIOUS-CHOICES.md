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

### P5-DC-18: Wave 4 executor choices (05-08 tool context and Stop feedback)

- **Phase / source:** executor of 05-08.
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. A Stop block with no reason still re-enters with an empty
     `Stop hook feedback:\n` part (upstream requires `reason`; not probed).
  2. A Stop hook that blocks and gives `additionalContext` sends two parts,
     reason first (not probed).
  3. The re-entry's `details.pluginId` and the STOP-07 cap notice name the
     first hook that sends feedback (before: the first blocking hook).
  4. Tool context uses its own custom type `claude-hook-tool-context`, not
     05-06's `claude-hook-additional-context` (that constant lives in
     `event-router.ts`, not owned by 05-08).
  5. Tool context is sent even after a PreToolUse `continue:false`; Stop
     notices show before the re-entry decision, so also under `continue:false`.
  6. The new When requires the prompt disposition `started`; the routed
     `updatedToolOutput` scenario is its own test-only commit.
- **Recorded in:** `05-08-SUMMARY.md`.

### P5-DC-19: Docs and gate plan choices (05-09)

- **Phase / source:** executor of 05-09.
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. `docs/hooks-compatibility.md` downgrades five rows from ✓ to ⚠ where a
     plan measured a gap (PreCompact exit 2 does not stop compaction; "other
     exit" stderr not shown; `continue:false` on PostToolUse only logs and on
     UserPromptSubmit gives no notice; `updatedToolOutput` reads only Pi's
     content array; `transcript_path` is `""` under `--no-session`) and raises
     PostCompact to ✓.
  2. Fixed two TOOL-02 comments in `hook-events.ts` that said "unavailable"
     where the code gives "partially-available".
  3. Left the stale `bypass_permissions_disabled` in
     `docs/research/claude-hook-config-syntax.md:103` as a parent line (file
     outside the plan; D-CF5-21 says such mentions are removed).
  4. The session events table lists Pi `/new` beside RPC `new_session` and
     saved-session resume as `resume`; scenarios drive only RPC `new_session`,
     resume is unit-tested only.
  5. Decision rows mark D-CF5-06, 08, 16, 20, 28 "Deferred", the rest "Locked".
  6. The GSD plan-commit ledger write was refused by the worktree guard, so
     `plan_head_before` is the known base `df1a1fbc`.
- **Gate:** the merged tree's build inputs equal the gated commit `e3f0676`, so
  the session reused 05-09's phase-gate result instead of rerunning it.
- **Recorded in:** `05-09-SUMMARY.md`.

### P5-DC-20: Security audit closures that rest on judgment

- **Phase / source:** `/gsd-secure-phase 5` (security auditor), 31/31 closed.
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. T-05-28 (project-scope hooks with no D-CF2-13 provenance check, high) is
     CLOSED by documented transfer only; the exposure is live on this branch
     until the parent applies the guard (P5-DC-11) and re-runs
     `/gsd-secure-phase` after the merge.
  2. T-05-23 (escape sequences in hook-notice text) is closed at L1; hook
     notice text reaches `ctx.ui.notify` verbatim, with no control-character
     filter (open at L2, low).
  3. T-05-12 (outer `mcp` proxy runs no hook, D-CF5-12) is an accepted
     medium policy-bypass risk for adapter paths without a nested Pi call.
  4. The five accepted risks are persisted as AR-05-01..05 in `05-SECURITY.md`.
  5. Unregistered flag: the routed `updatedToolOutput` fix (`6bbe6ba`) lets a
     plugin hook replace the tool output the model reads (upstream parity;
     content whitelist in place), with no threat ID.
  6. Fail-open edges noticed, not registered: stdout/stderr overflow settles
     `noop` before the `onFailure` check; a generation change mid-bucket drops
     a computed deny. Handed to code review.
- **Recorded in:** `05-SECURITY.md`.

### P5-DC-21: Nyquist gap fill exposed a PostToolUseFailure stdin divergence

- **Phase / source:** `/gsd-validate-phase 5` (Nyquist auditor) and the session.
- **Severity:** Medium. **Status:** open.
- **Choice:** The auditor's only gap (HOOK-04 had no PostToolUseFailure
  scenario) was filled with a scenario that showed the bridge sends
  `tool_response`, while Claude Code 2.1.316's schema sends `error: string`
  (binary grep). Under the bug policy the session dispatched a fix in the
  same phase: `error` carries the joined text parts of Pi's content, and the
  scenario pins upstream's shape. `tool_use_id`, `is_interrupt`, and
  `duration_ms` stay deferred (D-CF5-28).
- **Alternatives:** Pin today's `tool_response` shape and record a divergence.
- **Why dubious:** Found after the plans ran, so the fix was not planned; a
  plugin that read `tool_response` on PostToolUseFailure (non-upstream) would
  break.
- **Recorded in:** `05-VALIDATION.md`, the fix commit.

### P5-DC-22: Code review fixes and the D-CF5-09 rewrite rule

- **Phase / source:** `/gsd-code-review 5 --fix --auto` (reviewer and fixer).
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. WR-01 skipped and D-CF5-09 reworded: the input rewrite is the last one in
     routing order whatever the hook decided, as upstream's fold (`jFt`) keeps
     the last `updatedInput` (the old wording "of the winning decision"
     contradicted E11). Upstream uses finish order; the bridge uses routing
     order for determinism.
  2. WR-02: a steer's or follow-up's prompt context reaches the model just
     before the queued prompt, not after it (Pi gap: no carrier after a queued
     prompt), documented in `docs/hooks-compatibility.md`.
  3. WR-03: hook notices lose control characters (except line breaks and tabs)
     and are cut at 2,000 user-visible characters with `… (+N chars)`; the cap
     is the fixer's choice (no upstream cap found).
  4. WR-04: a PreCompact block now cancels the compaction (upstream stops it
     and reports `Compaction blocked by PreCompact hook: ...`); the notice is
     `info`, not upstream's warning (new severity would extend the closed set).
  5. CR-01: only the bridge's own overflow kill counts as an `onFailure`
     failure; a hook that exits 0 after overflowing stays a noop.
  6. One fix commit (`0df61e7`) ran its hook without the non-DAC env; the hook
     still passed.
  7. IN-01 (generation-change discard) refuted as intended (DISP-03); the six
     info findings were left out of the fix scope.
- **Recorded in:** `05-REVIEW.md`, `05-REVIEW-FIX.md`, `05-CONTEXT.md` D-CF5-09.

### P5-DC-23: Code review iteration 2 fixes

- **Phase / source:** `/gsd-code-review 5 --fix --auto`, iteration 2 fixer.
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. CR-01: an output overflow no longer kills the hook; the bridge drains past
     its EXEC-02 caps (1 MB stdout, 64 KB stderr) and the exit code decides,
     so an exit-2 deny is never lost. Upstream keeps all output; stdout cut at
     the cap is not read as JSON, so a JSON answer over 1 MB is lost (no D-CF5
     ID; EXEC-02 cited in the docs). A hook that writes forever now runs to
     its timeout.
  2. WR-01: every PreCompact block cancels the compaction and is named in the
     notice, as upstream's `blockedBy`.
  3. WR-02: a follow-up's prompt context waits in a runtime queue and is sent
     at the `turn_end` whose next queued message has the follow-up's text
     (Pi's `deliverAs` gives the context its own model call in Pi's default
     one-at-a-time mode). Text matching misses expanded follow-ups (skill or
     template), and identical texts could swap contexts; documented.
  4. Removed one `fallow-ignore` code-duplication marker that is no longer
     needed, so `.planning/codebase/CONVENTIONS.md`'s "exactly 41" marker
     count is now 40 (parent line).
  5. `test/index.test.ts` imports `TurnEndEvent` straight from the Pi peer
     because the frozen `platform/pi-api.ts` does not re-export it (parent
     line: re-export it).
- **Recorded in:** `05-REVIEW-FIX.md`.

### P5-DC-24: Code review stopped at the iteration cap with two open warnings

- **Phase / source:** `/gsd-code-review 5 --fix --auto`, iteration 3 (cap 3).
- **Severity:** Medium. **Status:** open.
- **Choice:** The iteration-3 review left 0 critical and 2 warnings, both edge
  cases of the follow-up prompt-context carrier (`a17639b`): (WR-01) a
  follow-up whose UserPromptSubmit hook is still running when the run ends
  loses its context (Pi rechecks `isStreaming` after the input handlers); a
  follow-up queued after the last `turn_end` is read with no `turn_end` before
  it; (WR-02) a terminating tool batch (a PreToolUse `continue:false`) and
  `followUpMode: "all"` read follow-ups the bridge does not send context for.
  They are not fixed in this phase; both go to BACKLOG parent lines with the
  reviewer's suggested fix (check `ctx.isIdle()` in `queuePromptContext`,
  match `event.prompt` in `before_agent_start`, send all matching queued
  follow-ups). The 12 info findings stay open in `05-REVIEW.md`.
- **Alternatives:** A fourth fix pass beyond the workflow's cap.
- **Why dubious:** The main follow-up path is right; the edge cases lose hook
  context silently (debug line only), which D-CF5-13's intent forbids.
- **Recorded in:** `05-REVIEW.md` (iteration 3), this entry.

### P5-DC-25: Transition run without PROJECT.md edits; security audit not re-run after fixes

- **Phase / source:** Phase 5 transition (post-completion mode) and verification.
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. `evolve_project` was skipped: the child-session rules forbid PROJECT.md
     edits, and `05-09-SUMMARY.md` carries the PROJECT.md parent lines (the 28
     D-CF5 rows, the line-1344 correction). STATE.md got only its focus and
     progress lines; decisions and blockers sections are left to the parent's
     merge to avoid conflicts with sibling phases.
  2. `05-SECURITY.md` was audited at `b5ff1e7`, before the code-review fix
     commits `0d877aa`..`a17639b` (overflow handling, notice escape stripping,
     follow-up context queue). Those fixes strengthen mitigations and were
     reviewed by three review passes, but no second security audit ran; the
     parent's post-merge `/gsd-secure-phase` (T-05-28) can cover them.
  3. `phase.complete` reported "files not on disk" warnings for command
     strings in the SUMMARYs; they are parser false positives.
- **Recorded in:** this file.
