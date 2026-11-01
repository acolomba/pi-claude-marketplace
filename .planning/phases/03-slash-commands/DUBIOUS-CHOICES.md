# Phase 3 (Slash Commands): Dubious Choices Log

Phase log for the child session on `features/component-features-phase-3`. Same
shape as the root `.planning/DUBIOUS-CHOICES.md`; the parent merges these
entries into it. Severity and status follow the root file's rules.

## Entries

### P3-DC-01: Branch fast-forwarded to the milestone head before discuss

- **Phase / source:** Phase 3 child session, before discuss.
- **Severity:** Low. **Status:** open.
- **Choice:** `features/component-features-phase-3` (at `3a7a707`, an
  ancestor of the milestone) was fast-forwarded to
  `origin/claude/quirky-planck-hhm592` at `0e360ca`, so Phase 3 builds on
  Phase 2's executed and reviewed skills code (D-CF2-13 ledger,
  `orchestrators/skill-invocation.ts`), and its gates run on that combined tree.
- **Alternatives:** Stay on `3a7a707` and design against the expected shape of
  the ledger, as the parent's brief suggested.
- **Why dubious:** The parent expected to reconcile at merge. A fast-forward
  is a merge with no new commit and breaks no git rule; any later Phase 2
  change still merges normally.
- **Recorded in:** `03-CONTEXT.md` header.

### P3-DC-02: The upstream probe reached api.anthropic.com

- **Phase / source:** Phase 3 research subagent (`03-UPSTREAM-EVIDENCE.md`,
  "Isolation gap").
- **Severity:** High (process). **Status:** open.
- **Choice:** The probe ran `claude plugin` commands under `env -i` with a
  throwaway HOME and config dir. The binary still fetched
  `https://api.anthropic.com/api/claude_code/policy_limits` (its built-in API
  address, not `ANTHROPIC_BASE_URL`) in the first 16 trees and received a
  signed policy tied to an identity the probe cannot name. The subagent
  stopped networked runs and re-ran the core probes (base, object map, mixed
  array) in a loopback-only namespace (`unshare -rn`, `tree/bin/netns.sh`)
  with identical results. A few edge variants (Q3 extras, Q7 string form)
  rest on the networked runs only.
- **Alternatives:** Discard all networked results and re-run every variant in
  the namespace.
- **Why dubious:** It broke the probe's localhost-only rule. Future probes
  should start inside `unshare -rn`. The research skill's recipe should say so
  (parent line).
- **Recorded in:** `03-UPSTREAM-EVIDENCE.md`, `03-CONTEXT.md`.

### P3-DC-03: Commands stay invisible to the model (FG-11)

- **Phase / source:** Phase 3 discuss (D-CF3-01).
- **Severity:** High. **Status:** open.
- **Choice:** Record a Pi gap. A command with a description is in Claude
  Code's model skill list and runnable through the Skill tool (E1); in Pi it
  stays a user-only prompt template.
- **Alternatives:** Also stage each command as a Pi skill, which gives the
  model the command but adds a `/skill:<plugin>-<name>` entry upstream lacks
  and Pi cannot hide.
- **Why dubious:** Model-invoked commands are common upstream; a plugin that
  relies on the model running its commands loses that in Pi.
- **Recorded in:** `03-CONTEXT.md` D-CF3-01.

### P3-DC-04: `user-invocable: false` commands stay listed and runnable (FG-12)

- **Phase / source:** Phase 3 discuss (D-CF3-02, extends D-CF1-09).
- **Severity:** Medium. **Status:** open.
- **Choice:** Keep listed and runnable. Upstream hides and refuses the command
  but lets the model run it (E2); with D-CF3-01, hiding it in Pi would make it
  unreachable.
- **Alternatives:** Refuse the typed command in the invocation handler, as
  upstream does.
- **Why dubious:** The user sees a command the author hid.
- **Recorded in:** `03-CONTEXT.md` D-CF3-02.

### P3-DC-05: Object-map keys go through the Pi command naming (FG-13)

- **Phase / source:** Phase 3 discuss (D-CF3-03).
- **Severity:** Medium. **Status:** open.
- **Choice:** Support the object map. Keys go through `generatedCommandName`:
  CM-2 elision applies, a `/` becomes a `:` segment, and keys that upstream
  refuses (trailing `:`, `<`, `>`) or that Pi cannot type (whitespace) are
  skipped with a warning. Missing or non-`.md` sources, and a second key on
  one file, skip the entry with a warning (upstream is silent, or reports
  "failed to load" in `plugin list`).
- **Alternatives:** Keep keys verbatim (impossible for `/` in a Pi file name);
  record the object map as unsupported.
- **Why dubious:** Names differ from upstream for elided and `/` keys; the
  warnings are this project's, not upstream's.
- **Recorded in:** `03-CONTEXT.md` D-CF3-03.

### P3-DC-06: A marketplace entry's `commands` adds to `commands/` (corrects D-CF1-06)

- **Phase / source:** Phase 3 discuss (D-CF3-04).
- **Severity:** High. **Status:** open.
- **Choice:** Follow the binary: `commands/` is read unless `plugin.json`
  declares `commands`; an entry declaration adds to it, and an entry's inline
  `content` commands are dropped with a warning. This supersedes the
  marketplace-entry half of D-CF1-06 for commands only.
- **Alternatives:** Keep D-CF1-06 (the docs say a plugin with no
  `plugin.json` treats the entry as the manifest).
- **Why dubious:** It changes a Phase 1 decision the parent made, the docs
  disagree with the binary, and agents and workflows may have the same
  difference (parent line to Phases 4 and 7).
- **Recorded in:** `03-CONTEXT.md` D-CF3-04.

### P3-DC-07: Command frontmatter `name` aliases deferred

- **Phase / source:** Phase 3 discuss (deferred ideas, E9).
- **Severity:** Medium. **Status:** open.
- **Choice:** Upstream gives a command with frontmatter `name` the aliases
  `/<plugin>:<name>` and `/<name>`. Phase 3 does not add them; a backlog line
  goes to the parent.
- **Alternatives:** Resolve them in the command invocation handler, as
  D-CF2-02 does for skills.
- **Why dubious:** An unlicensed parity gap left open to keep the phase
  bounded.
- **Recorded in:** `03-CONTEXT.md` `<deferred>`.

### P3-DC-08: Claude Code's command tag block not sent

- **Phase / source:** Phase 3 discuss (D-CF3-06).
- **Severity:** Low. **Status:** open.
- **Choice:** The model receives the substituted body only, as Pi's template
  expansion sends it; upstream prefixes `<command-message>`/`<command-name>`/
  `<command-args>` tags (E6). Residual under D-CF1-01.
- **Alternatives:** Prepend upstream's tag block.
- **Why dubious:** The model sees different framing than in Claude Code.
- **Recorded in:** `03-CONTEXT.md` D-CF3-06.

### P3-DC-09: Phase 3 research choices (accepted by the orchestrator)

- **Phase / source:** Phase 3 researcher (`03-RESEARCH.md`); the orchestrator
  accepted each item for planning and answered the open questions.
- **Severity:** Medium (items 1-4); the rest Low. **Status:** open.
- **Items:**
  1. **Staged command frontmatter rebuilt as one `"key": <JSON>` line per
     key** (Pi's YAML refuses duplicate keys, so appending `description:`
     breaks a file with `description: ""`; the rebuild avoids copying Phase 2's
     line scanner). Every staged command's bytes change.
  2. **Ledger writer passed in:** `commitPreparedCommands` and
     `UnstageCommandsInput` take a required `ledger`; the four orchestrator call
     sites (`install-outcome.ts` twice, `update-swap.ts`,
     `marketplace/shared.ts`) pass Phase 2's `NODE_PROJECT_SKILL_LEDGER`, whose
     name says "skill" (rename is a parent line). Project commands installed
     before this phase abort until updated or reinstalled (CHANGELOG line).
  3. **E8 residual:** a returned body that starts with `/<template>` is
     expanded again by Pi; resending through `sendUserMessage` would turn the
     RPC response into `handled` and change error routing. Pinned by a unit
     test.
  4. **Four waves, not three:** the staged-file writer is touched by the
     frontmatter (wave 2) and manifest-forms (wave 3) plans.
  5. Object-map entries ride on `componentPaths.commandMap` (optional field);
     `componentPaths.commands` stays `string[]` for Phase 2's shadow check.
  6. Abort origin `{kind: "command", commandId: <typed name without "/">}`
     (open string, no closed-set edit; a `docs/json-output.md` parent line).
  7. First-wins order: `commands/`, then `plugin.json` paths, then
     marketplace-entry paths (inferred from upstream's listing order).
  8. The lenient `info` mirror always includes `commands/` because it cannot
     see `plugin.json`.
  9. A map `source` that escapes the plugin root or is a symlink makes the
     plugin unavailable, like any escaping component path.
  10. Phase 3 features reuse two Phase 2 step texts (system-prompt skill list,
      "the user's pi directory records no plugin install for the project").
  11. An untrusted project keeps its own abort text, as skills do.
- **Open questions answered by the orchestrator (recommended options):**
  map keys with hidden or direction-changing characters (`\p{Cf}`) are
  skipped with a warning, as upstream refuses them; a plugin whose only
  commands come from a map counts `commands` as supported; the collision
  order is item 7; the TUI source tag is spiked before the expected value is
  written.
- **Recorded in:** `03-RESEARCH.md`, `03-VALIDATION.md`.

### P3-DC-10: Phase 3 planning choices

- **Phase / source:** Phase 3 planner (`03-01..09-PLAN.md`).
- **Severity:** Medium (items 1-4); the rest Low. **Status:** open.
- **Items:**
  1. **Five waves, nine plans** (the ledger writer and the object map split
     out): wave 1 tracer 03-01; wave 2 frontmatter 03-02, invocation 03-03,
     declared paths and entry rule 03-04, lifecycle 03-05; wave 3 ledger writer
     03-06; wave 4 ledger check 03-07 and object map 03-08; wave 5 gate 03-09.
  2. **Project commands run without the ledger check between waves 2 and 4**;
     only the phase gate covers the finished rule.
  3. **D-CF3-07's abort text follows D-CF2-13's current wording** (it names
     reinstall), not the CONTEXT literal.
  4. **The "uninstall before `/reload`" abort scenario lives in invocation
     (03-03)**, not lifecycle.
  5. Command ledger warnings ride Phase 2's `skillWarnings` member (wording
     names the commands; rename is a parent line).
  6. Ledger scenarios use a commands-only plugin `solo`, because
     `offers these plugins:` always adds a skill.
  7. The description fallback reads the body after install-time substitution
     and reference rewrite (differs from upstream only for a first line naming
     `${CLAUDE_PLUGIN_ROOT}`).
  8. The writer's read-back compares the JSON form of the frontmatter, so a
     non-finite YAML number stages as `null`.
  9. The reinstall-owner lookup reads `state.json` with
     `persistMigration: false` (skills side saves one; Phase 2 parent line).
  10. The argument-hint check uses `this.startTuiSession()` in the shared
      sandbox after a spike; the source tag is unconfirmed.
  11. Extra scenario: `info` of an unavailable plugin with entry-declared
      `commands`.
  12. Entry maps with both or neither of `source`/`content` make the plugin
      unavailable (unprobed for entries).
  13. `\p{Cf}` map keys are skipped (beyond D-CF3-03's list, per upstream).
  14. A declared path or map `source` through a symlink makes the plugin
      unavailable (today's containment rule).
  15. The ledger digest covers only the staged command file, not plugin
      scripts a `!` command runs (residual).
  16. The "user's own template" Given writes `<agent dir>/prompts/<name>.md`.
  17. `test/index.test.ts` gets more than an expected-value edit (`pi` exposed
      on `LoadedExtension`; the listener type may return a Promise), limited
      by a `git diff` criterion.
  18. Inline map commands record a synthetic `sourcePath`
      `<plugin root>#commands.<key>` (MCP bridge precedent).
  19. An abort's `commandId` is the command name without its slash.
  20. `/claude:plugin info` still does not list declared command files or map
      entries (residual parent line).
  21. 03-01 carries an extra `promote` assumption-delta block.
  22. 03-01's degraded-command scenario assumes that install reports only
      warnings (`, which warned`).
- **Recorded in:** the plans.

### P3-DC-11: Orchestration choices for Phase 3 execution

- **Phase / source:** Phase 3 orchestrator (execute-phase).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. Executor prompts tell each executor to Read the GSD execution files by
     absolute path instead of inlining them (DC-17 precedent), and add the
     project rules and environment facts blocks.
  2. The post-merge gate is the project's `npm run check` (AGENTS.md), not the
     workflow's build-command sniff. When a wave's merge result has the same
     build inputs as a tree the executor already passed `npm run check` on
     (the wave base had not moved, only the SUMMARY was added), the passing
     result is reused, as AGENTS.md allows. Wave 1: the executor's run at
     `b6a3912`; the merged tree adds only `03-01-SUMMARY.md`.

### P3-DC-12: Plan 03-01 executor choices (staged command writer)

- **Phase / source:** 03-01 executor (`03-01-SUMMARY.md`).
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. The read-back check can fail an install: a frontmatter key over 1024
     characters (legal as an explicit `? key`) becomes an implicit key in the
     JSON-flow rebuild, which Pi's parser refuses (`BridgeStagingError`, no
     degrade).
  2. The description fallback is computed on the body after CM-3
     substitution and the reference rewrite (upstream: raw body).
  3. A frontmatter that parses to a list or a scalar is dropped without a
     warning.
  4. Outline rows with no declared description write `description:` (YAML
     null); scenarios cover null, `""`, and no frontmatter.
  5. The 101-character fallback row pins a 97-character cut that ends on a
     space, as `A2e` does.
  6. Mocked neutralize-safeguard unit cases kept (the function moved
     unchanged, with branches real input cannot reach).
  7. One live marker each side keeps `dup:23c99c81` hidden; three stale
     commands-side markers deleted. Rebuild also strips a second BOM, as
     Pi's parser does. `P3-DC-09` is not cited in code comments (phase IDs
     are forbidden there).

### P3-DC-13: Plan 03-02 executor choices (frontmatter)

- **Phase / source:** 03-02 executor (`03-02-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. Pi's menu em dash is matched as `--`, because the `fix-unicode-dashes`
     pre-commit hook rewrites `—` in the feature file; a description holding
     `--` cannot be told apart from the join.
  2. The terminal-menu table lists Phase 2's `demo:demo-skill` alias row, so a
     skills alias change changes this scenario.
  3. The menu parser slices fixed 120-column rows (PTY width, Pi pads rows).
  4. Pi's `[t]` source tag is pinned as rendered.
  5. Existing unit cases that set `model: sonnet` now also expect the
     dropped-fields line (inputs unchanged).
  6. The executor's commits carry this child session's own `Claude-Session`
     trailer (`session_01EDUMG8nFuockQFTkJixpie`, from its harness reminder)
     instead of the parent's line the brief asked for; history is not
     rewritten.

### P3-DC-14: Plan 03-03 executor choices (invocation)

- **Phase / source:** 03-03 executor (`03-03-SUMMARY.md`).
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. A `"kind" in loaded` check narrows the read result instead of an
     explicit discriminated union.
  2. Bash-missing is checked even for a body with no `!` command (as skills
     do; upstream may check only when a pattern exists, not verified).
  3. The Outline's `placeholder` column only labels rows.
  4. A staged-file parse failure has no unit case of its own (same `.catch`
     as a read failure).
  5. The hooks feature's data-directory literal (`data/demo`) differs from the
     commands and skills one (`data/<marketplace>/<plugin>`): a parent line
     for the Hooks phase.
  6. The handler's slash-line regex became `startsWith` plus one `\s` search
     (lint `sonarjs/super-linear-regex`); the invoker type is inline (fallow
     private-type leak).

### P3-DC-15: Plan 03-04 executor choices (declared paths and entry rule)

- **Phase / source:** 03-04 executor (`03-04-SUMMARY.md`).
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. A declared non-`.md` file warns where upstream is silent (D-CF3-05).
  2. CM-2 elision applies to declared files (`demo-a.md` gives `demo:a`),
     under the recorded D-141-01 divergence; upstream names it `demo:demo-a`.
  3. The FG-14 pin runs the install as a `When` (the install Given rejects
     warnings and this install always notes the shadowed folder).
  4. An entry `"commands": []` still reads the folder (inferred from E4, not
     probed).
  5. A Unix socket stands in for "not a regular file" in a unit case.
  6. Residuals for the parent: `/claude:plugin info` does not list a declared
     single-file command (`discoverComponentNames` reads directories only);
     Phase 2's `commandUpstreamNames` reads each commands path as a directory,
     so a declared command file adds no name to the D-CF2-03 clash check.

### P3-DC-16: Plan 03-05 executor choices (lifecycle)

- **Phase / source:** 03-05 executor (`03-05-SUMMARY.md`).
- **Severity:** Low. **Status:** open.
- **Items:**
  1. The update scenarios replace the whole command file (description and
     body change together; listing pins one, the model log the other).
  2. A negative edit keyed on `allowExistingRecord` (temporary).
  3. `Given pi runs with the scripted model` sits in the Background, because
     the listing step needs the profile Pi.

### P3-DC-17: Plan 03-06 executor choices (project-command ledger writer)

- **Phase / source:** 03-06 executor (`03-06-SUMMARY.md`); wave 3 gate reuse.
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. Commands share Phase 2's per-project `skills.json` ledger; on Windows a
     command name uses `.` as the separator, which still never equals a skill
     name (skill names are `a-z0-9-` only).
  2. The digest is over the file's UTF-8 text (03-07 must read it the same
     way).
  3. When the install undo runs after a failed ledger write, the second
     forget warning is dropped.
  4. Command ledger warnings ride the `skillWarnings` member and read
     `could not remove the commands from the project skill ledger: ...`; the
     "skill" wording across the ledger is a rename parent line.
  5. A `prune` rollback does not restore ledger entries (parent line).
  6. Wave 3's post-merge gate reuses the executor's `npm run check` at
     `ce2330b` (seed 713944, 1299 scenarios); the merged tree adds only the
     SUMMARY.

### P3-DC-18: Plan 03-07 executor choices (provenance check)

- **Phase / source:** 03-07 executor (`03-07-SUMMARY.md`).
- **Severity:** Low-Medium. **Status:** open.
- **Items:**
  1. The digest covers only the staged command file; a plugin script a `!`
     command runs is not covered (the skills digest covers the whole staged
     directory). Accepted as T-03-23; parent gap line.
  2. The refusal names `/claude:plugin reinstall <plugin>@<marketplace>
     --scope project` from the project record that lists the command (state
     read with `persistMigration: false`), or a generic reinstall line.
  3. An unparseable staged file refuses with `Cannot read the command ...`
     before the ledger is read.
  4. The unit fake hard-codes Phase 2's ledger layout and key.
  5. A negative edit counted calls on `globalThis` (temporary).

### P3-DC-19: Plan 03-08 executor choices (object-map commands)

- **Phase / source:** 03-08 executor (`03-08-SUMMARY.md`).
- **Severity:** Medium (items 1-2); the rest Low. **Status:** open.
- **Items:**
  1. **`allowedTools` accepts a string** (the plan's wording); upstream's
     schema accepts only an array of strings, so `"allowedTools": "Read"`
     installs here and fails upstream.
  2. **A missing map source is an install warning**; upstream shows "failed
     to load" in `plugin list` and says nothing at install.
  3. `\p{Cf}` (and `\p{Cc}`) keys are skipped; hidden characters print as
     `\u{XXXX}` in map warnings only.
  4. Map warnings drop the plugin root (path redaction cut them short); the
     walk's own duplicate warning is still cut short (pre-existing; parent
     line for `shared/redact-absolute-paths.ts`).
  5. A map source inside `commands/` suppresses the shadow note (D-CF1-06's
     reach rule extended; not probed).
  6. A directory source under a bad key is still walked (upstream ignores the
     key for a directory).
  7. Malformed entries (both/neither, wrong types, absolute, escaping, linked
     source) make the plugin unavailable with reason `unsupported source`.
  8. Non-owned test edit: `test/architecture/declared-component-path-overlap.test.ts`
     gains `kind: "file"` in an expected value (`DiscoveredCommand` is now a
     union).
  9. On Windows a key with an inner `:` yields a file name NTFS refuses
     (parent line); `info` still does not list map entries (parent line).
