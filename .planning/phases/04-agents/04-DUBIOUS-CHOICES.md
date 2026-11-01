# Phase 4 (Agents): Dubious Choices Log

Phase log for the child session running Phase 4 of `component-features`, in the
shape of the root `.planning/DUBIOUS-CHOICES.md`. The parent merges these
entries into the root file. Severity and status follow the root file's rules.

## Entries

### P4-DC-01: Commit attribution names this child session

- **Phase / source:** Phase 4 child session, setup.
- **Severity:** Low. **Status:** open.
- **Choice:** Commit trailers use this session's own `Claude-Session` URL
  (`session_01EDUMG75mZrbnf4k1GJQjc9`), as the session's attribution notice
  says, not the parent's URL that `CHILD-SESSION-BRIEF.md` prints.
- **Alternatives:** Copy the brief's trailer exactly.
- **Why dubious:** The brief says "exactly"; the parent may grep for its own
  URL.

### P4-DC-02: Upstream probes read host token files

- **Phase / source:** upstream research subagent (discuss step).
- **Severity:** Medium (process/security). **Status:** open.
- **Choice:** The Claude Code 2.1.316 probes ran under `env -i` with a fresh
  HOME and config dir, but the binary reads the hard-coded
  `/home/claude/.claude/remote/.oauth_token` and `.session_ingress_token`
  regardless. All 52 captured requests went to the local stub; no auth
  header was saved; no credential files were written. Found after the last
  probe; no probe ran afterwards. The subagent also added
  `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` and `TMPDIR`, and edited only
  the probe's own `.claude.json` to reach the trust dialog.
- **Why dubious:** The compat-research skill requires full isolation; it was
  not achievable. Future probes should run where `/home/claude/.claude/remote`
  does not exist or is unreadable.

### P4-DC-03: Discuss decisions settled without the user

- **Phase / source:** Phase 4 smart discuss (`04-CONTEXT.md`, D-CF4-01..14).
- **Severity:** High for items 1-4, Medium for 5-7, Low for the rest.
  **Status:** open.
- **Items:**
  1. **D-CF4-04 (skill preload, XK-01):** the bridge inlines preloaded skill
     content into the agent's system prompt, because pi-subagents passes only
     a path. Upstream puts it in the child's first user message. A skill
     update now needs the agent re-staged (same install, so it happens), and
     the generated agent file grows by each preloaded skill.
  2. **D-CF4-05 (`async`):** every non-MCP bridged agent now emits
     `async: false` (foreground default, as upstream), changing behavior for
     users who relied on pi-subagents' async default; `background: true`
     emits `async: true`. MCP-granted agents are left alone for Phase 6.
  3. **D-CF4-14 (`advertise: true`):** bridged agents enter the parent system
     prompt, which changes every parent prompt with pi-subagents loaded and
     may break sibling phases' whole-prompt comparisons at merge.
  4. **D-CF4-09 (trust):** the untrusted-project refusal is kept as a Pi-gap
     divergence (upstream runs plugin agents untrusted); the alternative of
     writing project agents into user scope was rejected.
  5. **D-CF4-01 (nested):** dotfiles and case-insensitive `.md` now load, as
     upstream; flattening nested segments with `-` can collide with a flat
     name (first wins, warns).
  6. **D-CF4-07 (`--map-model`):** targets refreshed to the 5.x model IDs
     upstream's first-party table names (account-dependent upstream).
  7. **D-CF4-03:** the fallback description text changes to upstream's.
  8. **D-CF4-10:** AGT-04 may close on a recorded gap instead of a scenario.
  9. **D-CF4-08:** the stale ANAME-02 "cannot narrow" warning is left for
     Phase 6 / the parent instead of fixed here.
- **Upstream evidence:** `04-UPSTREAM-AGENTS.md`; pi-subagents facts in
  `04-PI-SUBAGENTS.md`.

### P4-DC-04: Planning-workflow deviations

- **Phase / source:** Phase 4 plan-phase orchestration (child session).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The `ai-integration` plan:pre step hook was not dispatched although the
     phase goal contains "agent": the phase translates plugin agents for
     pi-subagents and builds no AI system (same reasoning as DC-11).
  2. Plans are made with `REVERSIBILITY_GATES: false`, as DC-12 does for the
     whole run.
  3. Background planner/checker spawns are awaited through the harness's
     completion notifications instead of `gsd_stall_watch` polling (the
     notification is reliable here, and polling would read subagent
     transcripts).
  4. VALIDATION.md is seeded from the template (frontmatter only); the
     validation map lives in `04-RESEARCH.md` "Validation Architecture".

### P4-DC-05: Research open questions answered by the orchestrator

- **Phase / source:** Phase 4 researcher (`04-RESEARCH.md`); answered in
  `04-CONTEXT.md` "Amendments after research".
- **Severity:** Medium (items 1, 4, 6); the rest Low. **Status:** open.
- **Items:**
  1. AGT-04 closes on a recorded gap (D-CF4-10): the detached runner cannot
     load the scripted model (`JITI_ALIAS` maps `@earendil-works/pi-ai` to
     `./compat`, no `providers/faux`), measured; the parent/child call race
     also remains. A fix needs a frozen file or pi-subagents.
  2. `opusplan` maps to sonnet (upstream record) instead of opus (D-CF4-07 as
     first written).
  3. Declared folder paths recurse (upstream refuses folders); a declared
     symlinked file is refused (upstream follows it).
  4. The untrusted default-scope run is not pinned (its error text names
     repository paths no frozen token covers); only the explicit-scope pair.
  5. `Tool(spec)` maps by tool name; `effort` is lowercased.
  6. D-CF4-04 edits two orchestrator call sites outside Phase 4 ownership
     (`install-outcome.ts`, `update-swap.ts`), minimal and inside their own
     functions; the preload reads the plugin source `SKILL.md`, which can
     differ from the staged copy when the skills bridge repairs YAML or when
     Phase 2 adds a transform later.
  7. Agents without `tools` in a plugin that ships MCP servers keep today's
     output (no `async` field), extending the D-CF4-05 exception.
  8. Researcher choices accepted: `$ARGUMENTS` in a preloaded skill stays
     literal (frozen port, upstream would empty it); AGT-05 "load the
     companion, then `/reload`" is stood in by starting a profile Pi with the
     companion after the shared-Pi install; the default fixture skill from
     `path-marketplace.ts` is an acceptable Phase 1 stand-in for XK-01.
  9. Tests outside Phase 4 ownership need expected-value edits (generated
     bytes, 4.x model IDs): `update-swap.test.ts`, `reinstall-flow.test.ts`,
     `install-flow-ledger.test.ts`, `edge/handlers/plugin/install.test.ts`,
     `update.test.ts`.

### P4-DC-06: Phase 4 planning choices

- **Phase / source:** Phase 4 planner (`04-01..06-PLAN.md`, `COVERAGE.md`).
- **Severity:** Medium (items 1, 2, 5, 9); the rest Low. **Status:** open.
- **Items:**
  1. The D-CF4-04 skip warnings and the D-CF4-05 guided-field warnings go to
     the existing hygiene channel, so a standalone install does not print them;
     scenarios see them through an `apply` that moves the plugin. CONTEXT says
     "install warning".
  2. The builtins control hides only the builtin `researcher` (the em-dash
     fixer rewrites its description), so it shows 12 of 13 builtins; new step
     `pi-subagents hides the builtin agent {string}`.
  3. Settings Givens merge into `{agent dir}/settings.json` after the profile
     Pi starts; a release restores the previous bytes.
  4. The `has these agents:` table reads any column other than `file` and
     `body` as a frontmatter key (loosens the unknown-column rule).
  5. One trailing `[1m]` is stripped from a model alias; the `claude-`
     pass-through is case-sensitive and refuses `:` and whitespace (T-04-06,
     beyond the decision text). `thinking` is matched exactly; only `effort`
     is normalized.
  6. A `Tool(spec)` in `disallowedTools` disallows the whole tool; a `*`
     anywhere in `tools` takes the omitted-tools path.
  7. Preloads are read lazily for named skills only; read errors propagate;
     an unparseable skill is skipped; skipped skills are left out of
     `skills:`; a known skill with no source row keeps its `skills:` entry.
  8. The walk is depth first, so a nested agent wins over a flat file with
     the same flattened name (upstream lists both); a folder at 32 segments
     is skipped silently (upstream debug-logs).
  9. AGT-04 closes on the recorded gap from the researcher's measured runs;
     no new probe is planned.
  10. `install-outcome.ts` gains a `stagedSkillRecords` context field (4 edits)
      to keep 100% coverage; two `update-flow.test.ts` cases outside
      ownership get new expectations and titles.
  11. AGT-06 gains two pins: a trusted default-scope run and a user-scope
      agent run in an untrusted project.
  12. Three tasks exceed the five-file split rule (04-01: 17 files plus a
      deletion; 04-02 Task 1: 9; 04-05 Task 1: 10), forced by the wave split.
  13. Wave 1 deletes the seed `features/step_definitions/agent/runs.steps.ts`;
      wave 3 creates a new one. Expected agent literals in tests change twice
      (`advertise` in wave 1, `async` in wave 2).
  14. The planner wrote `COVERAGE.md` and edited ROADMAP.md's Phase 4 plan
      list unasked; estimates are its own (`confidence: low`).

### P4-DC-07: Plan 04-01 executor choices (agent listing)

- **Phase / source:** executor for 04-01 (`04-01-SUMMARY.md`).
- **Severity:** Low, except item 2 (Medium: changes generated bytes).
  **Status:** open.
- **Items:**
  1. The fallback warning fires whenever `description` is missing, even when
     `when_to_use`/`when-to-use` supplies the listed text (plan behavior rows).
  2. A present description is now trimmed (upstream `zie` trims), so
     re-staging changes the bytes of an agent whose description had
     surrounding spaces.
  3. An existing flat-discovery unit case was rewritten (its expectation
     contradicted D-CF4-01), against the plan's "keep every case" line.
  4. The settings merge (`withSetting`, `mergeUserSetting`) is private to
     `listing.steps.ts`; it writes two-space JSON, not Pi's key order.
  5. The builtins control pins pi-subagents 0.84.0's 12 builtin descriptions
     as literals; an upgrade that rewords one breaks it.
  6. Expected listing order is pi-subagents' own name sort, measured.
  7. The declared-file scenario writes its file with the frozen generic file
     Given (the file lives outside `agents/`).
  8. Deviations: the advertised-agents lookup was moved into a private helper
     to clear a fallow clone with the frozen `model.steps.ts` and Phase 2's
     `skill/frontmatter.steps.ts` (no marker); the plan's start commit is
     recorded in the executor scratch folder (the worktree guard blocks
     `.git` writes).
- **Parent lines from 04-01:** a CHANGELOG bullet; `shared/fs-utils.ts`
  `isPlainMarkdownFile` doc comment still names the agents bridge;
  `docs/prd/pi-claude-marketplace-prd.md:471` still states the old fallback.
