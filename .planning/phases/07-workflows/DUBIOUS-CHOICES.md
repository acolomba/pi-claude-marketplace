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
