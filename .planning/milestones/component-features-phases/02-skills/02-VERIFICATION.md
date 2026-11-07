---
phase: 02-skills
verified: 2026-11-03T12:00:00Z
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
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - features/lib/pi-tui.ts
  - features/lib/skill-files.ts
  - features/plugin/autoapply.feature
  - features/plugin/install-dependencies.feature
  - features/plugin/project-locality.feature
  - features/plugin/project-trust.feature
  - features/plugin/update-dependencies.feature
  - features/skill/aliases.feature
  - features/skill/collisions.feature
  - features/skill/frontmatter.feature
  - features/skill/invocation.feature
  - features/skill/lifecycle.feature
  - features/skill/listing.feature
  - features/skill/model-reads.feature
  - features/skill/project-trust.feature
  - features/step_definitions/plugin/installation.steps.ts
  - features/step_definitions/skill/aliases.steps.ts
  - features/step_definitions/skill/collisions.steps.ts
  - features/step_definitions/skill/frontmatter.steps.ts
  - features/step_definitions/skill/listing.steps.ts
covered_digest: "v4:sha256:8d640381a953335f80811024c18ec05d1cc8d91bc605adcbf7a3262aa20c8803"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "The user-invocable: false gap is reported to Pi"
    reason: "User decision of 2026-11-02 (.planning/milestones/component-features-DUBIOUS-CHOICES.md, 'Decisions waiting on you' -> 'User decisions (2026-11-02)' -> A.1): the user examined each of the six items of the drafted Pi gap report and reported only real Pi bugs. Items 1 (user-invocable: false), 2 (skill display names and aliases), 3 (no hook on the model's skill read) and 5 (template name is the file name) are Pi design, not bugs, and are accepted as deviations; the extension changed for items 2, 3, 4 and 6 (command frontmatter-name aliases, model-read variable fill, the run_plugin_command tool, the zero-width-space guard against a second expansion). No gap report is filed. Item 6 goes upstream as a pull request the user will review (.planning/upstream/pi-input-transform-expand.patch). The npm run check half of the criterion is verified separately and is not covered by this override."
    accepted_by: "acolomba"
    accepted_at: "2026-11-02T11:15:00Z"
re_verification:
  previous_status: passed
  previous_score: 5/5
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 2: Skills Verification Report

**Phase Goal:** A bridged skill looks to Pi the way Claude Code defines it: listed under its qualified name with its description, its frontmatter honored or licensed as a divergence, its body sent to the model on invocation, name clashes resolved as decided, and the plugin lifecycle reflected in a new session.
**Verified:** 2026-11-03 (first verified 2026-11-01, re-verified 2026-11-02 at `2ba505a`)
**Status:** passed
**Re-verification:** Yes. This run rechecks every criterion at `03f9a45` after the locality redesign (D-LOC-01), the model-read fill change (W6) and the untrusted-autoapply fix (03d7c97). See "Re-verification 2026-11-03" below.
**Head:** `03f9a45` on `claude/quirky-planck-hhm592`. The working tree was clean before and after this run.

The 2026-11-02 run read the tree at `2ba505a`. Changes it described there that are now gone: the project install ledger (`persistence/project-installs.ts`), D-CF2-13, D-CF2-14, D-CF2-15 and D-CF2-16. The user reversed all of them on 2026-11-02 (D-LOC-01, DC-41), and 5ecd962 deleted the ledger and its scenarios. Changes it described that still stand: command frontmatter-name aliases (`db5622a`), the model-read variable fill (`dfba92a`, now narrowed by `a7fb423`), the `run_plugin_command` tool (`cd3b5b1`, Phase 3 scope) and the second-expansion guard (`b48e1e4`).

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A new session lists each bridged skill as `/skill:<plugin>-<name>` with its description, including the description fallback as decided, and `disable-model-invocation`, `user-invocable: false` (under its Pi-gap divergence ID), frontmatter `name` (FG-07), and each FG-10 field behave as upstream or as a recorded divergence (SKL-01, SKL-02). | ✓ VERIFIED | `features/skill/listing.feature` (4 scenarios): the generated name and description, the first-line fallback, the heading / 100-character cut / `Plugin skill` outline, and the `when_to_use` fold. `features/skill/frontmatter.feature` (13): the `dropped fields` diagnostic for all eight D-CF1-05 fields in frontmatter order; no diagnostic for `allowed-tools`, `arguments`, `shell`, `user-invocable`; `disable-model-invocation` stays listed, runs on `/skill:demo-hidden`, and is absent from the model's system-prompt skill list (D-CF2-09); `user-invocable: false` stays listed and runnable (D-CF1-09); frontmatter `name: fancy` is listed under directory `review` (D-CF2-01). Neither feature changed after `2ba505a`. Both passed in this run. |
| 2 | Invoking a skill through the scripted model sends the model the skill body in a `<skill>` block, with path variables expanded and arguments handled as decided, and the model call log shows the whole message (SKL-03). | ✓ VERIFIED | `features/skill/invocation.feature` (9 scenarios) compares each whole model message: `ARGUMENTS:` append, named / positional / indexed / missing-index / raw placeholders, `${CLAUDE_SESSION_ID}` and `${CLAUDE_EFFORT}`, a `!` command, the failing-command abort, the escaped `!` argument, the companions-loaded run, the RPC `/demo:greet` alias, and a body that starts with `/demo:deploy` reaching the model inside the block. **Path variables (refreshed):** the old committed evidence, `project-provenance.feature` running ``!`sh ${CLAUDE_SKILL_DIR}/status.sh` ``, was deleted with the ledger (5ecd962). Current evidence: the unit tests `test/orchestrators/skill-invocation.test.ts:252-298` and `:617-721` fill `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` (334/334 passed in this run). I also re-ran a throwaway probe in the scratchpad, outside the repo: a skill body with all four variables reached the model as `{project dir}/.pi/pi-claude-marketplace/resources/skills/demo-paths`, `{home}/marketplaces/fixtures/plugins/demo`, `{project dir}/.pi/pi-claude-marketplace/data/fixtures/demo`, `{project dir}` (1 scenario, 12 steps passed). Wiring: `index.ts:283` `registerSkillAliases(pi)` -> `edge/skill-aliases.ts` -> `orchestrators/skill-invocation.ts::invokeBridgedSkill` (`:227`; trust gate `:240`) -> `fillSkill` (`invocationVariables`, `:143`) -> `finishedTransform`. **Model reads (refreshed, W6):** `model-reads.feature` (5): whole read and part read are filled; a non-staged file stays as it is; a PostToolUse hook on the read sees the staged text while the model gets the filled text; a hook's replacement reaches the model as the hook wrote it. Wired through `index.ts:290` `registerSkillReadFill` -> `edge/skill-read.ts` (`fill = fillSkillRead`, `:50`; `projectTrusted: ctx.isProjectTrusted()`, `:67`) -> `fillSkillRead` (`skill-invocation.ts:352-372`) -> `readToolReturns` (`platform/pi-api.ts:301`). The old "untrusted ledger" model-read scenario is gone, because the ledger is gone. |
| 3 | A skill and a command, or two skills, with one qualified name resolve as FG-08 decides, and the interactive `/plugin:skill` alias works as FG-09 decides, proven through the TUI driver (SKL-04, SKL-05). | ✓ VERIFIED | `features/skill/collisions.feature` (7, unchanged): the command wins and the skill is skipped with a warning (D-CF2-03), no `/skill:demo-clash` is offered, `/demo:clash` sends `COMMAND CLASH BODY`, `skills/` wins over a declared path (D-CF2-04), two directories eliding to one name keep the first. `features/skill/aliases.feature` (10, unchanged): `/demo:review`, `/demo:fancy`, `/fancy` reach `demo-review`; a shared name goes to the first skill; the elided `/demo:tool` alias is gone; a command keeps a frontmatter-name alias equal to its name; disable/enable remove and restore the alias. The terminal scenario drives `PiTuiSession` (`aliases.steps.ts`). `orchestrators/skill-alias-state.ts` lost its ledger filter in 5ecd962 (-94 lines). It now gates project aliases on trust only (`:205`). `features/skill/project-trust.feature` "A skill alias of an untrusted project reaches the model as typed" pins the gate. |
| 4 | After disable, uninstall, or update, a new session no longer offers the skill or offers the new version, and after enable it offers the skill again (SKL-06). | ✓ VERIFIED | Behavior-dependent (state transition), exercised by passing scenarios. `features/skill/lifecycle.feature` (7, unchanged, project scope): disable gives no skills and the typed text passes through; enable offers the skill again; uninstall gives no skills, and an invocation before `/reload` aborts with the missing-file message; update lists the new description and sends the new body. These now run with no user-scope ledger. The project-scope variants that lived in `project-provenance.feature` (update, reinstall, disable+enable keep a `!` skill runnable; D-CF2-16) were deleted with the ledger. `features/plugin/project-locality.feature` "A project skill runs its context command with no record of the install in the user scope" shows a trusted project's `!` skill runs with no ledger. |
| 5 | The `user-invocable: false` gap is reported to Pi, and `npm run check` passes on the phase branch. | PASSED (override) | **`npm run check` half: VERIFIED (reused gate).** The parent's last full gate is `npm run check` exit 0 at `b9f40ad` (cucumber 1537/1537, seed 469568, direct coverage 327 records). After it, only 03d7c97 changed code (`orchestrators/reconcile/load.ts`, `edge/handlers/plugin/autoapply.ts`, `autoapply-setting.ts`). I re-ran `features/plugin/autoapply.feature` with the trust and locality features: 42/42 scenarios passed. I did not run the full gate, as the brief asked. **Report half: Override.** The user resolved the gap report on 2026-11-02 (DUBIOUS-CHOICES A.1). Accepted by acolomba on 2026-11-02T11:15:00Z. |

**Score:** 5/5 truths verified (4 VERIFIED, 1 PASSED by override; 0 present but behavior-unverified)

### Plan must-haves

| Plan | Artifacts | Key links | Prohibitions |
|------|-----------|-----------|--------------|
| 02-01 | 5/5 | 3/3 | none |
| 02-02 | 3/3 | 2/2 | 1 test-tier: all eight fields reported. Enforced by the frontmatter-order scenario. |
| 02-03 | 3/3 | 4/4 | 2 test-tier. Extension input never reaches the runner: the handler returns `continue` for `source === "extension"`, and `test/edge/skill-aliases.test.ts` covers it. An aborted invocation sends nothing: the abort scenarios plus the scripted model's overflow guard. |
| 02-04 | 3/3 | 2/2 | 1 test-tier: a skipped skill is named in the diagnostic. Enforced by the collisions warning scenario. |
| 02-05 | 1/1 | 1/1 | none |
| 02-06 | 4/4 | 2/3 (one renamed, see below) | 1 test-tier: an alias never takes another source's command name. Enforced by the `command.source !== "skill" && command.name === token` early return in `edge/skill-aliases.ts` and the "frontmatter name a command of the plugin has" scenario. |
| 02-07 | 1/1 | 1/1 | none |

I re-ran `gsd-tools query verify.artifacts` and `verify.key-links` on every plan at `03f9a45`. The results are the same as on 2026-11-02. No Phase 2 plan names the ledger, so its removal broke no plan artifact or link. 02-06 still reports 2/3 because its pattern `loadQualifiedSkillAliases` is the old name of `loadPluginAliases` (`db5622a`). The link is wired under the new name.

### Required Artifacts (changed since the previous report)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `persistence/project-installs.ts` | D-CF2-13 ledger | REMOVED (by decision) | Deleted in 5ecd962 under D-LOC-01. No reference is left under `extensions/`. Not a Phase 2 plan artifact. |
| `edge/skill-read.ts` | Model-read fill | ✓ VERIFIED | Registered at `index.ts:290`, after the hooks bridge's `tool_result` handler. Passes `offset`, `limit` and the read text (W6). Paired test passes. |
| `platform/pi-api.ts::readToolReturns` | Re-runs Pi's read tool to check that a result is the skill's own text (W6) | ✓ VERIFIED | `:301`; called by `fillSkillRead`. |
| `edge/input-transform.ts` | Zero-width-space guard | ✓ VERIFIED | Unchanged since `2ba505a`. |
| `orchestrators/skill-alias-state.ts` | Alias table for skills and commands | ✓ VERIFIED | Ledger filter removed; trust gate only (`:205`). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.ts` | `edge/skill-aliases.ts` | `registerSkillAliases(pi)` | WIRED | `index.ts:283` (was `:273`) |
| `edge/skill-aliases.ts` | `orchestrators/skill-invocation.ts` | `invokeBridgedSkill` default | WIRED | `/skill:` tokens and `skill` alias targets |
| `edge/skill-aliases.ts` | `orchestrators/skill-alias-state.ts` | `loadPluginAliases` default | WIRED (renamed) | See the 02-06 note above |
| `index.ts` | `edge/skill-read.ts` | `registerSkillReadFill(pi)` | WIRED | `index.ts:290` (was `:280`) |
| `edge/skill-read.ts` | `orchestrators/skill-invocation.ts` | `fillSkillRead` default | WIRED | `skill-read.ts:50` |
| `fillSkillRead` | `platform/pi-api.ts` | `readToolReturns` | WIRED | `skill-invocation.ts:367` |
| `bridges/skills/{stage,unstage}.ts` | `persistence/project-installs.ts` | `ProjectSkillLedger` | REMOVED (by decision) | D-LOC-01 reversed D-CF2-13. The skill gates now read only `ctx.isProjectTrusted()`: `skill-invocation.ts:240,357`, `skill-alias-state.ts:205`, `edge/skill-read.ts:67`, discovery `index.ts:211`. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All skill scenarios | `npx cucumber-js features/skill` | 74/74 scenarios, 816/816 steps (seed 893164) | ✓ PASS |
| Trust, locality, autoapply (incl. 03d7c97) | `npx cucumber-js features/plugin/autoapply.feature features/plugin/project-trust.feature features/plugin/project-locality.feature` | 42/42 scenarios, 403/403 steps (seed 513417) | ✓ PASS |
| Path variables in a skill body reach the model expanded | throwaway probe in the scratchpad, `npx cucumber-js --parallel 1 <scratchpad>/probe/paths.feature` | 1 scenario, 12 steps passed | ✓ PASS |
| Skill bridge, aliases, read fill, invocation unit tests | `node --test test/bridges/skills/*.test.ts test/edge/skill-aliases.test.ts test/edge/skill-read.test.ts test/edge/input-transform.test.ts test/orchestrators/skill-invocation.test.ts test/orchestrators/skill-alias-state.test.ts` | 334/334 | ✓ PASS |
| Full gate | reused `npm run check` at `b9f40ad` | exit 0, cucumber 1537/1537 | ✓ PASS (reused) |

### Probe Execution

Step 7c: not applicable. No plan declares a `scripts/*/tests/probe-*.sh` probe.

### Requirements Coverage

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| SKL-01 | 02-01 | ✓ SATISFIED | `listing.feature` |
| SKL-02 | 02-02 | ✓ SATISFIED | `frontmatter.feature` |
| SKL-03 | 02-03 | ✓ SATISFIED | `invocation.feature`, `model-reads.feature`, `skill-invocation.test.ts`, verifier probe |
| SKL-04 | 02-04 | ✓ SATISFIED | `collisions.feature`, alias clash scenario |
| SKL-05 | 02-06 | ✓ SATISFIED | `aliases.feature` (RPC and TUI) |
| SKL-06 | 02-05 | ✓ SATISFIED | `lifecycle.feature` (project scope, no ledger), alias disable/enable scenarios |

No orphaned requirements: REQUIREMENTS.md maps only SKL-01..SKL-06 to Phase 2, and all six are now `[x]` / `Complete` (lines 67-72, 177-182).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (all covered source, feature, and step files) | - | TBD / FIXME / XXX / TODO / HACK / placeholder | none found | - |
| `features/skill/invocation.feature` | - | Resolved 2026-11-03: the scenario "A skill's path variables are filled in when it runs" now pins `${CLAUDE_SKILL_DIR}`, `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` and `${CLAUDE_PROJECT_DIR}` in a typed skill's body. | ℹ️ Info | Was a warning in this re-verification. |
| `.planning/PROJECT.md` | 1823 | D-CF3-01 still says the model cannot run a bridged command, but `run_plugin_command` (A.1 item 4) lets it | ℹ️ Info | Phase 3 record lag; noted in 03-VERIFICATION.md |
| `.planning/phases/02-skills/02-06-PLAN.md` (key link 3) | - | Stale pattern `loadQualifiedSkillAliases` | ℹ️ Info | The checker reports 2/3. The link is wired under its new name. |

The 2026-11-02 Info rows are resolved. D-CF2-13..16 are no longer "Pending (user review)": the user reversed them (PROJECT.md:1788 and the rows after it, "Reversed 2026-11-02 (user, DC-41)"). The SKL requirement rows now read Complete.

### Human Verification Required

None for the success criteria. Two non-blocking manual items from `02-VALIDATION.md` stay as before (unit tests cover them, and they are not success criteria): `shell: powershell` with a real `pwsh` plus the Windows `bash-missing` abort, and a typed argument naming `${CLAUDE_PLUGIN_ROOT}`.

### Gaps Summary

No gaps. Criteria 1-4 are proven by passing cucumber scenarios that compare what Pi lists and what the model receives. Criterion 5's `npm run check` half rests on the parent's gate at `b9f40ad` plus my re-run of the only feature that 03d7c97 touched. Its report half is closed by the user's recorded decision, carried here as an override. One warning: the path-variable clause of SC2 lost its only committed scenario with the ledger. Unit tests and a probe in this run show the behavior still holds.

## Re-verification 2026-11-03

**What I rechecked:** all five ROADMAP criteria and SKL-01..06 at `03f9a45`. I ran `features/skill` (74/74), the autoapply, project-trust and project-locality features (42/42), the skill unit tests (334/334), and the plan artifact and key-link checks. I also ran a throwaway path-variable probe.

**What changed since 2026-11-02:**

- **Ledger removed (D-LOC-01, 5ecd962).** `persistence/project-installs.ts`, `features/skill/project-provenance.feature`, `features/skill/project-autoapply.feature`, `features/step_definitions/skill/project-provenance.steps.ts` and `project-trust.steps.ts` no longer exist. I dropped them from `covered_files`. The previous report cited `project-provenance.feature` as evidence for SC2 (path variables) and SC4 (project re-stage), and cited D-CF2-14/15/16 as live behavior. That evidence is replaced above. D-CF2-13..16 are reversed, not pending.
- **Trust through Pi alone.** Project skills, aliases and the read fill are gated only on `ctx.isProjectTrusted()`. The lifecycle scenarios run at project scope with no ledger and pass.
- **W6 (a7fb423).** `fillSkillRead` now fills only when the result equals Pi's own re-read of the staged file. `model-reads.feature` swapped its untrusted-ledger scenario for two hook scenarios. SC2's fill evidence is refreshed.
- **03d7c97.** An untrusted project's configs no longer turn autoapply on. `autoapply.feature` passes. No skill criterion depends on it.
- Line references moved: `index.ts:283/290`, `skill-read.ts:50/67`.
- Added to `covered_files`: `platform/pi-api.ts`, `features/plugin/project-locality.feature`, `features/plugin/project-trust.feature`. The digest is recomputed.

**Verdict:** still passed, 5/5. One new warning (path-variable scenario coverage). No gap.

---

_Verified: 2026-11-03_
_Verifier: Claude (gsd-verifier)_
