# Phase 7 (Workflows): Dubious Choices Log

Phase 7's share of the component-features review queue. Same shape as the root
`.planning/DUBIOUS-CHOICES.md`; the parent folds these entries into it at
merge. Only the Phase 7 orchestrator session writes this file; subagents report
theirs under `## Dubious Choices` and the orchestrator copies them here.

## Entries

### P7-DC-01: Phase 7 discuss decisions settled without the user

- **Phase / source:** Phase 7 smart discuss (`07-CONTEXT.md`).
- **Severity:** Medium. **Status:** open.
- **Choice:** FG-31 and FG-32, and the Phase 7 grey areas (refusal coverage,
  companion-missing recovery, lifecycle), were settled from upstream evidence
  and the engine 3.15.0 source, per the user's standing instruction and
  `CHILD-SESSION-BRIEF.md`.
- **Alternatives:** Ask the user, as the smart-discuss workflow would.
- **Why dubious:** The workflow presents each grey area for acceptance.
- **Recorded in:** `07-CONTEXT.md`.

### P7-DC-02: The engine's `{_, _raw, key=value}` argument shape is pinned (FG-32)

- **Phase / source:** Phase 7 discuss (D-CF7-02).
- **Severity:** Medium. **Status:** open.
- **Choice:** Accept the engine's slash-path shape and pin it in a scenario;
  record it as engine-owned behavior with an ID, not as a divergence.
- **Alternatives:** Pass the typed text as one string (upstream's Workflow tool
  passes `args` verbatim, so a string is the closest literal reading); or parse
  JSON typed after the command into a structured value.
- **Why dubious:** Upstream states no rule for text typed after
  `/<plugin>:<name>` (MEDIUM confidence; the 2.1.316 binary documents only the
  tool's `args` input). A script written for upstream that reads `args` as a
  string or as an array breaks here. Changing the shape would need an engine
  change, outside this project.
- **Upstream evidence:** 2.1.316 binary prose "args: any -- the value passed as
  Workflow's `args` input, verbatim"; engine 3.15.0
  `src/saved-commands.ts::parseCommandArgs`.
- **Recorded in:** `07-CONTEXT.md` D-CF7-02; `docs/workflows-compatibility.md`
  (wave 3).

### P7-DC-03: No run approval recorded as a Pi gap (FG-31)

- **Phase / source:** Phase 7 discuss (D-CF7-01).
- **Severity:** High. **Status:** open.
- **Choice:** Record the missing run approval as a Pi-gap divergence; the
  bridge adds no approval of its own.
- **Alternatives:** A bridge-side confirmation before the engine runs (needs a
  hook on the engine's command handler that the engine does not offer;
  wrapping the engine's command would mean the bridge registers commands the
  engine owns).
- **Why dubious:** Upstream asks before a plugin workflow runs in manual mode;
  here third-party code runs on a slash command with no prompt. It is a
  security-relevant difference, though the user already typed the command.
- **Recorded in:** `07-CONTEXT.md` D-CF7-01.

### P7-DC-04: Install-time refusal of nondeterministic and unparseable scripts kept (D-CF7-03)

- **Phase / source:** Phase 7 discuss (D-CF7-03).
- **Severity:** Medium. **Status:** open.
- **Choice:** Keep refusing these scripts at install and give the timing
  difference an ID, rather than admitting them and letting the engine refuse
  them at run as upstream's loader effectively does.
- **Alternatives:** Admit them with a caveat (as the six warned checks are),
  which matches upstream's timing.
- **Why dubious:** It is a divergence the project rules license only with a
  recorded decision; the doc recorded it without an ID until now.
- **Recorded in:** `07-CONTEXT.md` D-CF7-03.

### P7-DC-05: Commit trailer names this child session, not the parent

- **Phase / source:** Phase 7 session setup.
- **Severity:** Low. **Status:** open.
- **Choice:** Commits end with this session's `Claude-Session` link
  (`session_01EDUMG6U1zk7CfbwevqpZYJ`), which the session's own attribution
  settings give, instead of the parent's link that `CHILD-SESSION-BRIEF.md`
  quotes.
- **Alternatives:** Copy the brief's line verbatim.
- **Why dubious:** The brief says "exactly". The child's link is the one that
  leads to the transcript that made the commit.
- **Recorded in:** this file only.

### P7-DC-06: Phase 7 research choices (accepted by the orchestrator)

- **Phase / source:** Phase 7 research (`07-RESEARCH.md`); CONTEXT revised to match.
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. **Engine-later recovery uses a settings `packages` entry plus a new
     session, not a literal `/reload`.** Over RPC `/reload` goes to the model,
     and a scenario can start only one profile Pi. A new session re-reads Pi's
     settings as `/reload` does; verified live. Alternatives: drive `/reload`
     through the TUI driver, or edit frozen `world.ts` for a second profile Pi.
     Dubious because the session starts with reason `new`, not `reload`.
  2. **D-CF7-02 is now a divergence (supersedes P7-DC-02's "no upstream
     position").** The 2.1.316 binary makes a plugin workflow command a prompt
     command that tells the model `Workflow({ name, args: "<typed text>" })`,
     so upstream `args` is one string; the engine passes an object. Kept,
     licensed as a Pi-side gap (the engine owns the slash handler).
  3. **D-CF7-04 reworded:** Claude Code skips scripts whose `meta` is not
     first, has a reserved key, or lacks a description at load; the bridge
     admits them with a warning and the engine refuses them at run. Kept
     (WGATE decisions); switching to per-file skips would break tests outside
     this phase.
  4. **The install warning "the engine will refuse to load it" stays pinned**
     although the engine registers the command and refuses only at run; tests
     and the output catalog outside this phase pin it. Backlog parent line.
  5. **The listing `Then` picks bridged commands by the engine path plus a `:`
     in the name,** not by a hard-coded list of the engine's own commands.
  6. **Engine notices are compared after converting U+2014 to `--`,** because
     the commit hook rewrites em dashes outside `.planning/` and the hook
     config is not Phase 7's.
  7. **The refusal-fixture install is read with a `When`** (an info cascade
     plus a warning diagnostic), replacing CONTEXT's implied "the install
     shows a warning".
- **Recorded in:** `07-RESEARCH.md`, `07-CONTEXT.md`.

### P7-DC-07: Phase 7 pattern-map choices

- **Phase / source:** Phase 7 pattern map (`07-PATTERNS.md`).
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. **Shared record-reading helpers live in `features/lib/workflow-files.ts`**
     (documented as the fixture writer), because it is the only lib file
     Phase 7 may edit (`layout.md` freezes the others). Alternative: a new
     `features/lib/workflow-runs.ts`.
  2. **The shared topic module keeps the name `listing.steps.ts`,** close to a
     verb name, following the skill and slash-command precedent.
  3. **The notices step names its kind** (`the workflow engine shows these
     notices:`) instead of RESEARCH's `pi shows these notices:`, per
     `layout.md`'s rule that a new step names its kind.
- **Recorded in:** `07-PATTERNS.md`.

### P7-DC-08: Phase 7 planning choices

- **Phase / source:** Phase 7 planner (`07-01..07-06-PLAN.md`).
- **Severity:** Medium. **Status:** open.
- **Choices:**
  1. Wave 1 also creates `features/workflow/lifecycle.feature` with one
     scenario (the stale notice after uninstall), so the no-run `When` and the
     notices `Then` that 07-02 and 07-05 share are used in wave 1 and
     `check:features` stays green in every wave-2 worktree.
  2. `runs.steps.ts` keeps the three seed run steps; only the four new shared
     steps go to `listing.steps.ts` (Phase 2 instead moved every shared step to
     `listing.steps.ts`).
  3. 07-03 rewrites the `run.feature` description to name D-CF7-01 and keeps
     the seed scenario byte-identical.
  4. `sendWorkflowCommand` in `features/lib/workflow-files.ts` imports
     `promptDisposition` from `test/e2e/_rpc.ts`, using `layout.md`'s exception
     for a driver that reuses a process harness.
  5. T-07-07 (no run approval) is rated medium with disposition `transfer`,
     not high: the user consented at install and typed the command, and the
     missing hook belongs to the engine and Pi. P7-DC-03 still rates the
     decision High for review.
  6. 07-03's negative control is a script that throws, with a new failed-run
     `Then`.
  7. 07-02's caveat-run Outline puts each script on one line in an `Examples:`
     cell substituted into a doc string.
  8. The fixture `nope.js` ends with an unreachable `return "never";` to honor
     "every fixture script ends in a return".
  9. 07-04 runs its install-rows and list scenarios on the shared Pi, with no
     profile Pi.
  10. The listing `Then` compares the registry snapshot's command `path` with
      `resolveCompanion(...).entry`, which assumes each worktree runs
      `node scripts/install-test-peers.mjs`.
- **Recorded in:** `07-01..07-06-PLAN.md`.

### P7-DC-09: Wave 1 executor choices (listing tracer)

- **Phase / source:** Phase 7 wave 1 executor (`07-01-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. `requirements-completed` lists only WFL-01, not WFL-05: this plan
     delivers only the WLIF-06 stale notice after uninstall, and 07-05
     finishes WFL-05.
  2. The listing filter keeps only commands whose name holds a colon
     (research assumption A3). A future engine built-in with a colon, or a
     bridged command that lost its `<plugin>:` prefix, would still fail the
     whole-table comparison rather than pass silently.
  3. The WNAM-06 (prefix elision) scenario title does not name the ID, because
     the feature rules forbid ticket references in titles; the ID is in the
     commit and the SUMMARY only.
- **Process note:** the Write tool saved a raw U+2014 where the `—`
  escape was meant, and the `fix-unicode-dashes` hook turned the constant
  into `"--"`; the executor caught it and rewrote the escape byte-exactly.
  Later executors are warned.
- **Recorded in:** `07-01-SUMMARY.md`.

### P7-DC-10: Wave 2 executor choices (refusals)

- **Phase / source:** Phase 7 wave 2, refusals executor (`07-02-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Choices:**
  1. The setup `Given` (`..., which reported notes on workflow scripts of the
     plugin`) checks the shape only (an info cascade, then a warning diagnostic
     whose lines all start with `workflow script "`); a zero-line diagnostic
     would pass it. The one-script installs are pinned whole only in the
     install scenarios.
  2. `late.js` puts `const greeting = "late";` directly above the `meta` line;
     the other fixtures follow the plan's `meta`, blank line, `return` form.
  3. One `check:static` run lost its lint job to out-of-memory beside a warm-up
     ESLint; a lone `npm run lint` and a later full `check:static` passed.
  4. The SUMMARY's commit count was measured before the SUMMARY commit.
- **Parent line (BACKLOG):** the caveat text "was installed but the engine will
  refuse to load it" in `bridges/workflows/discover.ts` is inaccurate (the
  engine registers the command and refuses at run); rewording touches three
  unit tests, `docs/output-catalog.md`, and `refusals.feature`.
- **Recorded in:** `07-02-SUMMARY.md`.
