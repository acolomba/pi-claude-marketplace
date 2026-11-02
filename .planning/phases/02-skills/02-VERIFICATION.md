---
phase: 02-skills
verified: 2026-11-02T11:20:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/02-skills/02-01-PLAN.md
  - .planning/phases/02-skills/02-01-SUMMARY.md
  - .planning/phases/02-skills/02-02-PLAN.md
  - .planning/phases/02-skills/02-02-SUMMARY.md
  - .planning/phases/02-skills/02-03-PLAN.md
  - .planning/phases/02-skills/02-03-SUMMARY.md
  - .planning/phases/02-skills/02-04-PLAN.md
  - .planning/phases/02-skills/02-04-SUMMARY.md
  - .planning/phases/02-skills/02-05-PLAN.md
  - .planning/phases/02-skills/02-05-SUMMARY.md
  - .planning/phases/02-skills/02-06-PLAN.md
  - .planning/phases/02-skills/02-06-SUMMARY.md
  - .planning/phases/02-skills/02-07-PLAN.md
  - .planning/phases/02-skills/02-07-SUMMARY.md
  - extensions/pi-claude-marketplace/bridges/skills/discover.ts
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts
  - extensions/pi-claude-marketplace/bridges/skills/index.ts
  - extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/unstage.ts
  - extensions/pi-claude-marketplace/edge/input-transform.ts
  - extensions/pi-claude-marketplace/edge/skill-aliases.ts
  - extensions/pi-claude-marketplace/edge/skill-read.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/discover.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
  - extensions/pi-claude-marketplace/persistence/project-installs.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - features/lib/pi-tui.ts
  - features/lib/skill-files.ts
  - features/plugin/autoapply.feature
  - features/plugin/install-dependencies.feature
  - features/plugin/update-dependencies.feature
  - features/skill/aliases.feature
  - features/skill/collisions.feature
  - features/skill/frontmatter.feature
  - features/skill/invocation.feature
  - features/skill/lifecycle.feature
  - features/skill/listing.feature
  - features/skill/model-reads.feature
  - features/skill/project-autoapply.feature
  - features/skill/project-provenance.feature
  - features/skill/project-trust.feature
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/skill/aliases.steps.ts
  - features/step_definitions/skill/collisions.steps.ts
  - features/step_definitions/skill/frontmatter.steps.ts
  - features/step_definitions/skill/listing.steps.ts
  - features/step_definitions/skill/project-provenance.steps.ts
  - features/step_definitions/skill/project-trust.steps.ts
covered_digest: "v4:sha256:253357bcdf551d5e420d0b15df4ac09c6176cfd46c42362cfcd8c88efe86bfae"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "The user-invocable: false gap is reported to Pi"
    reason: "User decision of 2026-11-02 (.planning/DUBIOUS-CHOICES.md, 'Decisions waiting on you' -> 'User decisions (2026-11-02)' -> A.1): the user examined each of the six items of the drafted Pi gap report and reported only real Pi bugs. Items 1 (user-invocable: false), 2 (skill display names and aliases), 3 (no hook on the model's skill read) and 5 (template name is the file name) are Pi design, not bugs, and are accepted as deviations; the extension changed for items 2, 3, 4 and 6 (command frontmatter-name aliases, model-read variable fill, the run_plugin_command tool, the zero-width-space guard against a second expansion). No gap report is filed. Item 6 goes upstream as a pull request the user will review (.planning/upstream/pi-input-transform-expand.patch). The npm run check half of the criterion is verified separately and is not covered by this override."
    accepted_by: "acolomba"
    accepted_at: "2026-11-02T11:15:00Z"
re_verification:
  previous_status: human_needed
  previous_score: 4/5
  gaps_closed:
    - "Criterion 5, report half: resolved by the user's 2026-11-02 decision (A.1) and recorded as an override"
  gaps_remaining: []
  regressions: []
---

# Phase 2: Skills Verification Report

**Phase Goal:** A bridged skill looks to Pi the way Claude Code defines it: listed under its qualified name with its description, its frontmatter honored or licensed as a divergence, its body sent to the model on invocation, name clashes resolved as decided, and the plugin lifecycle reflected in a new session.
**Verified:** 2026-11-02T11:20:00Z
**Status:** passed
**Re-verification:** Yes. The previous report (2026-11-01, head `3bfaab5`) scored 4/5, `human_needed`, with no `gaps:` section, so this run checks every criterion again against the current tree.
**Head:** `2ba505a` on `claude/quirky-planck-hhm592`, working tree clean before and after this run.

Since `3bfaab5` the tree took 425 commits. Those that touch this phase: the project install ledger moved from `bridges/skills/project-installs.ts` to `persistence/project-installs.ts` (`29a755e`); D-CF2-15 (background autoupdate changes only the user scope, `0b29f66`); D-CF2-16 (a re-stage that names no plugin only refreshes the ledger, `fed700e`); command frontmatter-name aliases, which renamed the alias loader to `loadPluginAliases` and added a `command` alias target (`db5622a`); the model-read variable fill (`dfba92a`, new `edge/skill-read.ts` and `features/skill/model-reads.feature`); the `run_plugin_command` tool (`cd3b5b1`, Phase 3 scope); and the second-expansion fix (`b48e1e4`, new `edge/input-transform.ts`).

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A new session lists each bridged skill as `/skill:<plugin>-<name>` with its description, including the description fallback as decided, and `disable-model-invocation`, `user-invocable: false` (under its Pi-gap divergence ID), frontmatter `name` (FG-07), and each FG-10 field behave as upstream or as a recorded divergence (SKL-01, SKL-02). | ✓ VERIFIED | `features/skill/listing.feature`: the generated name and description, the first-line fallback, the heading / 100-character cut / `Plugin skill` outline, and the `when_to_use` fold. `features/skill/frontmatter.feature`: the `dropped fields` diagnostic for all eight D-CF1-05 fields in frontmatter order; no diagnostic for `allowed-tools`, `arguments`, `shell`, `user-invocable`; `disable-model-invocation` stays listed, runs on `/skill:demo-hidden`, and is absent from the model's system-prompt skill list (D-CF2-09); `user-invocable: false` stays listed and runnable (D-CF1-09, PROJECT.md:1743); frontmatter `name: fancy` is listed under directory `review` (D-CF2-01). These files did not change since the previous report except one step file (`frontmatter.steps.ts`, the ledger import path). |
| 2 | Invoking a skill through the scripted model sends the model the skill body in a `<skill>` block, with path variables expanded and arguments handled as decided, and the model call log shows the whole message (SKL-03). | ✓ VERIFIED | `features/skill/invocation.feature` compares each whole model message: `ARGUMENTS:` append, named / positional / indexed / missing-index / raw placeholders, `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}`, a `!` command, the failing-command abort, the escaped `!` argument, the companions-loaded run, the RPC `/demo:greet` alias, and (new) a body that starts with `/demo:deploy` reaching the model inside the block. Path variables: `project-provenance.feature` runs ``!`sh ${CLAUDE_SKILL_DIR}/status.sh` `` and gets `Status: ran`, which needs the substitution. My own throwaway probe (scratchpad, not committed) put `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` in a body and the exact expected expansion passed (1 scenario, 12 steps). Wiring: `index.ts:273` `registerSkillAliases(pi)` -> `edge/skill-aliases.ts` input handler -> `orchestrators/skill-invocation.ts::invokeBridgedSkill` -> `fillSkill` (`invocationVariables` supplies the four path values) -> `finishedTransform`. New: `model-reads.feature` shows the D-CF1-03 amendment (variables filled, arguments empty, `!` left literal, untrusted-ledger and non-staged files untouched), wired through `index.ts:280` `registerSkillReadFill` -> `edge/skill-read.ts` `tool_result` -> `fillSkillRead`. |
| 3 | A skill and a command, or two skills, with one qualified name resolve as FG-08 decides, and the interactive `/plugin:skill` alias works as FG-09 decides, proven through the TUI driver (SKL-04, SKL-05). | ✓ VERIFIED | `features/skill/collisions.feature` (unchanged): the command wins and the skill is skipped with a warning (D-CF2-03), no `/skill:demo-clash` is offered, `/demo:clash` sends `COMMAND CLASH BODY`, `skills/` wins over a declared path (D-CF2-04), two directories eliding to one name keep the first. `features/skill/aliases.feature` (unchanged): `/demo:review`, `/demo:fancy`, `/fancy` reach `demo-review`; a shared name goes to the first skill; the elided `/demo:tool` alias is gone; a command keeps a frontmatter-name alias equal to its name; disable/enable remove/restore the alias. The terminal scenario drives `PiTuiSession` (`aliases.steps.ts`): types `/demo:fa`, waits for Pi's completion menu marker, presses Tab, sends `Ada`, and compares the whole model message. The command-alias change keeps skill precedence correct: `edge/skill-aliases.ts` routes `target.kind === "skill"` to `invokeBridgedSkill` and only a `command` target to `commandAliasResult`. |
| 4 | After disable, uninstall, or update, a new session no longer offers the skill or offers the new version, and after enable it offers the skill again (SKL-06). | ✓ VERIFIED | Behavior-dependent (state transition); exercised by passing scenarios, not by presence. `features/skill/lifecycle.feature` (unchanged): disable gives no skills and the typed text passes through; enable offers the skill again; uninstall gives no skills, and an invocation before `/reload` aborts with the missing-file message; update lists the new description and sends the new body. `project-provenance.feature` adds the project-scope variants: update, reinstall, and disable+enable keep a `!` skill runnable, and (new, D-CF2-16) a bare `update` or `reinstall` leaves an unrecorded skill refused. All passed in the reused gate run. |
| 5 | The `user-invocable: false` gap is reported to Pi, and `npm run check` passes on the phase branch. | PASSED (override) | **`npm run check` half: VERIFIED.** The reused log `decisions-check.log` (written 11:12 UTC, after `2ba505a` at 02:58 UTC, tree clean) shows typecheck and the static checks, unpaired, integration, cucumber `1554 scenarios (1554 passed)`, `16785 steps (16785 passed)` (seed 82800), direct coverage `330 records`, `EXIT=0`. **Report half: Override.** The user resolved the gap report on 2026-11-02 (DUBIOUS-CHOICES A.1): items 1, 2, 3, 5 are Pi design and accepted as deviations, no report is filed, item 6 goes upstream as a pull request after the user's review (`.planning/upstream/pi-input-transform-expand.patch`, present). Accepted by acolomba on 2026-11-02T11:15:00Z. |

**Score:** 5/5 truths verified (4 VERIFIED, 1 PASSED by override; 0 present but behavior-unverified)

### Plan must-haves

| Plan | Artifacts | Key links | Prohibitions |
|------|-----------|-----------|--------------|
| 02-01 | 5/5 | 3/3 | none |
| 02-02 | 3/3 | 2/2 | 1 test-tier: all eight fields reported. Enforced by the frontmatter-order scenario. |
| 02-03 | 3/3 | 4/4 | 2 test-tier. Extension input never reaches the runner: the handler returns `continue` for `source === "extension"` and `test/edge/skill-aliases.test.ts` covers it. An aborted invocation sends nothing: the abort scenarios plus the scripted model's overflow guard. |
| 02-04 | 3/3 | 2/2 | 1 test-tier: a skipped skill is named in the diagnostic. Enforced by the collisions warning scenario. |
| 02-05 | 1/1 | 1/1 | none |
| 02-06 | 4/4 | 3/3 (one renamed, see below) | 1 test-tier: an alias never takes another source's command name. Enforced by the `command.source !== "skill" && command.name === token` early return in `edge/skill-aliases.ts` and the "frontmatter name a command of the plugin has" scenario. |
| 02-07 | 1/1 | 1/1 | none |

`gsd-tools query verify.artifacts` exited 0 for every plan. `verify.key-links` exited 0 for every plan except 02-06, which reported 2/3: its pattern `loadQualifiedSkillAliases` no longer exists, because `db5622a` renamed it `loadPluginAliases` when command aliases joined the table. The link itself is intact: `edge/skill-aliases.ts` imports `loadPluginAliases` from `orchestrators/skill-alias-state.ts` as the default `loadAliases`, and every `skill` target in the table goes to `invokeBridgedSkill`. I count it as WIRED (renamed), not a regression. Every test-tier prohibition has wired enforcement, so none is flagged.

### Required Artifacts (changed since the previous report)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `persistence/project-installs.ts` | D-CF2-13 ledger (moved from `bridges/skills/`) | ✓ VERIFIED | Imported by `bridges/skills/index.ts`, `stage.ts`, `unstage.ts`, `skill-invocation.ts`, `command-invocation.ts`, hooks `event-router.ts`, `update-swap.ts` (`admittedProjectLedger`, D-CF2-16). Paired test `test/persistence/project-installs.test.ts`. |
| `edge/skill-read.ts` | Model-read fill (D-CF1-03 amendment) | ✓ VERIFIED | Registered at `index.ts:280`, after the hooks bridge's `tool_result` handler. Paired test present. Scenarios in `model-reads.feature`. |
| `edge/input-transform.ts` | Zero-width-space guard (item 6) | ✓ VERIFIED | `finishedTransform` used by `skill-aliases.ts::inputResult` and by the command invocation handler. Paired test present. A skill block never starts with `/`, so skill output is unchanged; the new invocation scenario pins that. |
| `orchestrators/skill-alias-state.ts` | Alias table, now skills and commands | ✓ VERIFIED | `loadPluginAliases` returns `PluginAliasTarget = skill | command`. Skill alias scenarios unchanged and passing. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.ts` | `edge/skill-aliases.ts` | `registerSkillAliases(pi)` | WIRED | `index.ts:273` |
| `edge/skill-aliases.ts` | `orchestrators/skill-invocation.ts` | `invokeBridgedSkill` default | WIRED | `/skill:` tokens and `skill` alias targets |
| `edge/skill-aliases.ts` | `orchestrators/skill-alias-state.ts` | `loadPluginAliases` default | WIRED (renamed) | See the 02-06 note above |
| `index.ts` | `edge/skill-read.ts` | `registerSkillReadFill(pi)` | WIRED | `index.ts:280` |
| `edge/skill-read.ts` | `orchestrators/skill-invocation.ts` | `fillSkillRead` default | WIRED | `skill-read.ts:52` |
| `bridges/skills/{stage,unstage}.ts` | `persistence/project-installs.ts` | `ProjectSkillLedger` | WIRED | `bridges/skills/index.ts:13` binds `NODE_PROJECT_SKILL_LEDGER` |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Path variables in a skill body reach the model expanded | `npx cucumber-js --parallel 1 <scratchpad>/probe/paths.feature` (throwaway, outside the repo) | `1 scenario (1 passed)`, `12 steps (12 passed)`; the exact expected text with `{project dir}/.pi/.../demo-paths`, `{home}/marketplaces/fixtures/plugins/demo`, `{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo`, `{project dir}` matched | ✓ PASS |
| Full gate | reused `npm run check` log at `2ba505a` | `EXIT=0`, cucumber 1554/1554 | ✓ PASS |

The working tree was clean after the probe.

### Probe Execution

Step 7c: not applicable. No plan declares a `scripts/*/tests/probe-*.sh` probe.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| SKL-01 | 02-01 | ✓ SATISFIED | `listing.feature` |
| SKL-02 | 02-02 | ✓ SATISFIED | `frontmatter.feature` |
| SKL-03 | 02-03 | ✓ SATISFIED | `invocation.feature`, `project-provenance.feature`, `model-reads.feature`, verifier probe |
| SKL-04 | 02-04 | ✓ SATISFIED | `collisions.feature`, alias clash scenario |
| SKL-05 | 02-06 | ✓ SATISFIED | `aliases.feature` (RPC and TUI) |
| SKL-06 | 02-05 | ✓ SATISFIED | `lifecycle.feature`, alias disable/enable scenarios, project re-stage scenarios |

No orphaned requirements: REQUIREMENTS.md maps only SKL-01..SKL-06 to Phase 2. Their checkboxes and table rows still read `Pending`; phase completion updates them.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all covered source, feature, and step files) | - | TBD / FIXME / XXX / TODO / HACK / placeholder | none found | - |
| `.planning/PROJECT.md` | 1737, 1743, 1761 | D-CF1-03 still reads "applies only to user-invoked skills" with no amendment note; D-CF1-09 still says "The gap is reported to Pi"; D-CF2-10 still reads "Pending (user files)" | ℹ️ Info | Decision records lag the 2026-11-02 user decision. Code and DUBIOUS-CHOICES agree with the decision; the parent should update these rows. Does not affect the goal. |
| `.planning/phases/02-skills/02-06-PLAN.md` (key link 3) | - | Stale pattern `loadQualifiedSkillAliases` | ℹ️ Info | The checker reports 2/3 until the pattern is updated; the link is wired under its new name. |
| D-CF2-13, D-CF2-14, D-CF2-15, D-CF2-16 | - | Security decisions "Pending (user review)" | ℹ️ Info | Not success criteria of this phase. Listed in DUBIOUS-CHOICES section B for the user. |

### Human Verification Required

None for the success criteria. Two non-blocking manual items from `02-VALIDATION.md` stay as before (unit tests cover them, they are not success criteria): `shell: powershell` with a real `pwsh` plus the Windows `bash-missing` abort, and a typed argument naming `${CLAUDE_PLUGIN_ROOT}`.

### Gaps Summary

No gaps. Criteria 1-4 are proven by passing cucumber scenarios that compare what Pi lists and what the model receives, and the changes since the previous report (ledger move, D-CF2-15/16, command aliases, model-read fill, second-expansion guard) left the skill scenarios green and the links wired. Criterion 5's `npm run check` half passes at `2ba505a`; its report half is closed by the user's recorded decision, carried here as an override.

---

_Verified: 2026-11-02T11:20:00Z_
_Verifier: Claude (gsd-verifier)_
