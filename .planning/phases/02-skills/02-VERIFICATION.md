---
phase: 02-skills
verified: 2026-11-01T16:20:00Z
status: human_needed
score: 4/5 must-haves verified
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
  - extensions/pi-claude-marketplace/bridges/skills/project-installs.ts
  - extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/unstage.ts
  - extensions/pi-claude-marketplace/edge/skill-aliases.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/discover.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
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
covered_digest: "v4:sha256:ba4cf6599313a7e8532fe161cfd51a21e58387a67da7dbee01670156047dda0f"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Review the drafted Pi gap report in 02-07-SUMMARY.md, section 'Pi gap report (D-CF2-10, drafted, not filed)', and file it at https://github.com/earendil-works/pi/issues, or decide not to file it."
    expected: "The `user-invocable: false` gap (D-CF1-09), the missing skill display name or alias (D-CF2-02), and the missing hook on the model's own skill reads (D-CF1-03) are reported to Pi, or the user records that they chose not to report them."
    why_human: "ROADMAP Phase 2 criterion 5 says the gap is reported to Pi. D-CF2-10 makes the filing the user's call: the phase has no credential for Pi's tracker, and a public post on the user's behalf needs the user."
---

# Phase 2: Skills Verification Report

**Phase Goal:** A bridged skill looks to Pi the way Claude Code defines it: listed under its qualified name with its description, its frontmatter honored or licensed as a divergence, its body sent to the model on invocation, name clashes resolved as decided, and the plugin lifecycle reflected in a new session.
**Verified:** 2026-11-01T16:20:00Z
**Status:** human_needed
**Re-verification:** No. This is the first verification. Three code review rounds came before it.
**Head:** `3bfaab5` on `claude/quirky-planck-hhm592`, working tree clean.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A new session lists each bridged skill as `/skill:<plugin>-<name>` with its description, including the description fallback as decided. `disable-model-invocation`, `user-invocable: false` (D-CF1-09), frontmatter `name` (FG-07), and each FG-10 field behave as upstream or as a recorded divergence (SKL-01, SKL-02). | ✓ VERIFIED | `features/skill/listing.feature`: the generated name and description, the first-line fallback, the D-CF1-04 outline (heading, 100-character cut, `Plugin skill`), and the `when_to_use` fold. `stage.ts:145` calls `descriptionFallback(body, "Plugin skill")`. `features/skill/frontmatter.feature`: the dropped-fields diagnostic for all eight D-CF1-05 fields in frontmatter order (`stage.ts:353` `droppedInvocationFieldsWarning`), no diagnostic for `allowed-tools`/`arguments`/`shell`/`user-invocable`, `disable-model-invocation` listed and runnable but absent from the system-prompt skill list, `user-invocable: false` listed and runnable (D-CF1-09 is recorded in PROJECT.md:1708), and frontmatter `name: fancy` listed under directory `review` (D-CF2-01). |
| 2 | Invoking a skill through the scripted model sends the model the skill body in a `<skill>` block, with path variables expanded and arguments handled as decided, and the model call log shows the whole message (SKL-03). | ✓ VERIFIED | `features/skill/invocation.feature` compares each whole model message: `ARGUMENTS:` append, named, positional, indexed, missing-index, and raw placeholders, `${CLAUDE_SESSION_ID}`/`${CLAUDE_EFFORT}`, a `!` command, the failing-command abort (usage-error, and the scripted model's overflow guard proves nothing reached the model), the escaped `!` argument, with the companions loaded, and over RPC through `/demo:greet`. Path variables: `project-provenance.feature` runs ``!`sh ${CLAUDE_SKILL_DIR}/status.sh` `` and gets `Status: ran`. I also ran a throwaway probe (not committed): a body `Dir ${CLAUDE_SKILL_DIR} ...` reached the model as `Dir {project dir}/.pi/pi-claude-marketplace/resources/skills/demo-status ...`, and after `update` a body `${CLAUDE_PLUGIN_ROOT}` reached it as `{home}/marketplaces/fixtures/plugins/demo`. Wiring: `edge/skill-aliases.ts:184-205` routes interactive and RPC input to `orchestrators/skill-invocation.ts::invokeBridgedSkill`, which substitutes, then runs `expandContextInjections`, then builds Pi's `<skill>` block. |
| 3 | A skill and a command, or two skills, with one qualified name resolve as FG-08 decides, and the interactive `/plugin:skill` alias works as FG-09 decides, proven through the TUI driver (SKL-04, SKL-05). | ✓ VERIFIED | `features/skill/collisions.feature`: the command wins and the skill is skipped with a warning (D-CF2-03, `discover.ts:125`), no `/skill:demo-clash` is offered, `/demo:clash` sends `COMMAND CLASH BODY`, the `skills/` copy wins over a declared path (D-CF2-04), and two directories that elide to one name keep the first. `features/skill/aliases.feature`: `/demo:review`, `/demo:fancy`, and `/fancy` all reach `demo-review`; a shared frontmatter name goes to the first skill; the elided `/demo:tool` alias is gone; a command keeps a frontmatter-name alias that equals its name; disable and enable remove and restore the alias. The terminal scenario "Completing a skill alias in the terminal sends the skill to the model" drives `PiTuiSession` (`features/step_definitions/skill/aliases.steps.ts`): it types `/demo:fa`, waits for Pi's completion menu, presses Tab, sends `Ada`, and compares the whole model message. |
| 4 | After disable, uninstall, or update, a new session no longer offers the skill or offers the new version, and after enable it offers the skill again (SKL-06). | ✓ VERIFIED | `features/skill/lifecycle.feature`: disable gives no skills and the typed text passes through; enable offers the skill again; uninstall gives no skills, and invoking before `/reload` aborts with the missing-file message; update lists the new description and sends the new body. These scenarios exercise the state transition and passed in the gate run. My throwaway probe also showed that a project skill with a `!` command still runs after disable then enable, and after update. Both paths write the D-CF2-13 ledger. |
| 5 | The `user-invocable: false` gap is reported to Pi, and `npm run check` passes on the phase branch. | ? UNCERTAIN (human) | `npm run check` half: VERIFIED. The log `p2fix3-check.log` ends with `EXIT=0` at 16:06, after HEAD `3bfaab5` (15:59), with a clean tree: static checks, unpaired tests, integration, cucumber 1251/1251 (seed 369171), and direct coverage (319 records). Report half: the text is drafted as ready to file in `02-07-SUMMARY.md` (three gaps: D-CF1-09, D-CF2-02, D-CF1-03), but it has not been filed. Under D-CF2-10 the user files it. |

**Score:** 4/5 truths verified (0 present but behavior-unverified, 1 waiting for the user)

### Plan must-haves

| Plan | Artifacts | Key links | Prohibitions |
|------|-----------|-----------|--------------|
| 02-01 | 5/5 | 3/3 | none |
| 02-02 | 3/3 | 2/2 | 1 test-tier: all eight fields reported. Enforced by the frontmatter-order scenario. |
| 02-03 | 3/3 | 4/4 | 2 test-tier. Extension input never reaches the runner: enforced by `test/edge/skill-aliases.test.ts` (source `extension` rows) and by the handler's early return. An aborted invocation sends nothing: enforced by the abort scenario plus the scripted model's overflow guard (`session.steps.ts:110-114`). |
| 02-04 | 3/3 | 2/2 | 1 test-tier: a skipped skill is named in the diagnostic. Enforced by the collisions warning scenario. |
| 02-05 | 1/1 | 1/1 | none |
| 02-06 | 4/4 | 3/3 | 1 test-tier: an alias never takes another source's command name. Enforced by `skill-aliases.ts:195` and the "frontmatter name a command of the plugin has" scenario. |
| 02-07 | 1/1 | 1/1 | none |

All counts come from `gsd-tools query verify.artifacts` and `verify.key-links`, which exited 0 for every plan. Every test-tier prohibition has wired enforcement, so none is flagged.

### Review-fix decisions (D-CF2-13, D-CF2-14)

| Decision | Status | Evidence |
|----------|--------|----------|
| D-CF2-13: a project skill runs its `!` commands and claims an alias only when the user-scope ledger lists it with a digest of its staged directory | ✓ VERIFIED | `skill-invocation.ts::isInstalledHere` checks the ledger for every project skill. `skill-alias-state.ts:225` gates the alias. `stage.ts::recordProjectSkills` writes the ledger on commit, through the install ledger and `update-swap.ts`. `unstage.ts::forgetProjectSkills` drops the entries. `project-provenance.feature` covers: a missing ledger, digest changes to `SKILL.md`, to a helper script, and to an added file, the alias, the reinstall that the abort names, an unknown ledger on install (it fails and keeps the file), and the warning for uninstall, disable, and `marketplace remove`. |
| D-CF2-14: a load-time autoapply applies only the user scope | ✓ VERIFIED | `orchestrators/reconcile/load.ts::applyUserScope` passes `scope: "user"`, then gives the project scope the read-only pass. `project-autoapply.feature` shows that a repository-declared plugin is not installed at load (the typed text passes through), and that it runs after an explicit `/claude:plugin apply`. `features/plugin/autoapply.feature` was rewritten to match. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| A body path variable reaches the model expanded, and enable or update keeps a `!` project skill runnable | `npx cucumber-js` on a scratch feature (not committed), under the nondac wrapper | Path variable and enable scenarios passed. The update scenario was written to fail on purpose so it would print what the model received: `New {home}/marketplaces/fixtures/plugins/demo status ran` | ✓ PASS |
| A user-scope skill runs its `!` command through its bare alias | the same, in a scratch `user.feature` (also written to fail on purpose) | `<skill name="demo-status" location="{agent dir}/...">...Status ran\n\nARGUMENTS: x</skill>` | ✓ PASS |
| Full gate | reused `npm run check` log | `EXIT=0`, 1251/1251 scenarios | ✓ PASS |

The working tree was clean after the probes.

### Probe Execution

Step 7c: not applicable. No plan declares a `scripts/*/tests/probe-*.sh` probe.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| SKL-01 | 02-01 | ✓ SATISFIED | `listing.feature` |
| SKL-02 | 02-02 | ✓ SATISFIED | `frontmatter.feature` |
| SKL-03 | 02-03 | ✓ SATISFIED | `invocation.feature`, `project-provenance.feature`, verifier probe |
| SKL-04 | 02-04 | ✓ SATISFIED | `collisions.feature`, alias clash scenario |
| SKL-05 | 02-06 | ✓ SATISFIED | `aliases.feature` (RPC and TUI) |
| SKL-06 | 02-05 | ✓ SATISFIED | `lifecycle.feature`, alias enable/disable scenarios |

No orphaned requirements: REQUIREMENTS.md maps only SKL-01..SKL-06 to Phase 2. Their checkboxes still read `Pending`. Tools write that file, and phase completion updates it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all 42 phase-modified source and feature files) | - | TBD / FIXME / XXX / TODO / HACK / placeholder | none found | - |
| `extensions/pi-claude-marketplace/index.ts` | 192-199 | An untrusted project now gives Pi no project `skillPaths` **and no** `promptPaths` | ℹ️ Info | This change, from review round 2, also withholds Phase 3's project prompt templates in an untrusted project. Phase 3 should know this at merge. |
| `orchestrators/{reconcile/load.ts, plugin/uninstall.ts, plugin/enable-disable.ts, marketplace/remove.ts, marketplace/shared.ts}`, `features/plugin/autoapply.feature`, `index.ts` | - | Edits outside the ROADMAP ownership list | ℹ️ Info | The review fixes required these edits, and the parent chose them. They raise the merge-conflict surface with Phases 3 and 5, so re-verify after those merges, as the merge procedure says. |
| `02-SECURITY.md` | - | The register predates review rounds 1-3 (no T-entry for the D-CF2-13 ledger, the D-CF2-14 autoapply mitigation, or the WR-03 plugin-root residual) | ℹ️ Info | 02-REVIEW-FIX.md lists this as a parent line. It does not affect the goal. |

### Human Verification Required

#### 1. File the Pi gap report (ROADMAP criterion 5)

**Test:** Read "Pi gap report (D-CF2-10, drafted, not filed)" in `.planning/phases/02-skills/02-07-SUMMARY.md`, and file it at https://github.com/earendil-works/pi/issues, or decide not to.
**Expected:** Pi has a report of the `user-invocable: false` gap, the missing display name and aliases, and the missing hook on the model's own skill reads. If the user decides not to file it, record that decision.
**Why human:** The filing is a public post on the user's account (D-CF2-10, T-02-19).

Non-blocking manual items from `02-VALIDATION.md`. Unit tests cover them, and they are not success criteria:
- `shell: powershell` with a real `pwsh`, and the Windows `bash-missing` abort.
- A typed argument that names `${CLAUDE_PLUGIN_ROOT}`, since the frozen prompt step rejects `{...}` text.

### Gaps Summary

No code gaps. Every SKL requirement has a passing cucumber scenario that observes only what Pi reports, and the key decisions are wired as described. That includes the two review-fix decisions, D-CF2-13 and D-CF2-14. The phase is not `passed` for one reason only: criterion 5 says the gap is reported to Pi, and D-CF2-10 leaves that filing to the user. Parent-owned items are not counted as gaps: the CHANGELOG, README, and docs lines, the PROJECT key decisions D-CF2-01..14, the CONTEXT notes for D-CF2-13/14, the IN-04 extra update/enable scenarios, and the threat-register IDs. My throwaway probe confirmed that the IN-04 update and enable cases already behave correctly.

---

_Verified: 2026-11-01T16:20:00Z_
_Verifier: Claude (gsd-verifier)_
