---
phase: 02-skills
reviewed: 2026-11-01T14:42:42Z
depth: standard
iteration: 3
files_reviewed: 25
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts
  - extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts
  - extensions/pi-claude-marketplace/bridges/skills/index.ts
  - extensions/pi-claude-marketplace/bridges/skills/project-installs.ts
  - extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/skills/skill-names.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/types.ts
  - extensions/pi-claude-marketplace/bridges/skills/unstage.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/discover.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
  - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
  - features/skill/frontmatter.feature
  - features/skill/project-provenance.feature
  - features/skill/project-trust.feature
  - features/step_definitions/skill/project-provenance.steps.ts
  - test/bridges/skills/frontmatter-degrade.test.ts
  - test/bridges/skills/frontmatter-scan.test.ts
  - test/bridges/skills/project-installs.test.ts
  - test/bridges/skills/rewrite-frontmatter.test.ts
  - test/bridges/skills/stage.test.ts
  - test/bridges/skills/unstage.test.ts
  - test/orchestrators/skill-alias-state.test.ts
  - test/orchestrators/skill-invocation.test.ts
findings:
  critical: 1
  warning: 5
  info: 6
  total: 12
status: issues_found
---

# Phase 2: Code Review Report (iteration 3)

**Reviewed:** 2026-11-01T14:42:42Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

This pass reviews the round-2 fixes, `git diff 9cbcd36 c284184` (commits 4e3b32f, 6a7ea1b, 8b05948, c284184). I ran the real modules under Node for the frontmatter cases and ran two throwaway cucumber scenarios from the scratchpad against the real harness. Nothing in the tree was changed.

Status of the round-2 findings:

- **CR-01 (repository content runs `!` commands): not closed.** The ledger check works for the case it was built for. A repository that ships staged files and a forged `state.json` is stopped, whether at invocation or at the alias. Symlinked cwds, trailing slashes, and missing or malformed ledgers all fail closed. The digest covers the same string that is parsed and run, so there is no gap between check and use. User-scope skills are not gated. But D-CF2-13 assumes that "a repository cannot write" the ledger, and that is false. A repository that commits `.pi/claude-plugins.json` with `autoapply: true` makes this extension install the repository's own plugin at load time. That install writes the ledger, and the user's first `/skill:<x>` runs the `!` commands. I reproduced this end to end (**CR-01** below).
- **WR-01 (discovery in an untrusted project): resolved.** Pi resolves trust before `resources_discover`, and the untrusted branch now gives Pi no project paths. I found no regression.
- **WR-02 (one fence rule): resolved.** `frontmatterBlockEnd` now matches Pi 1.4.0's `indexOf("\n---", 3)` (`dist/utils/frontmatter.js:9`), and `skill-names.ts` has no local copy left.
- **WR-03 (key spellings): resolved for the listed spellings, with one regression.** A node that holds more than one key (a flow mapping) is now treated as the `name` node. The rewrite then drops every other key without an error, where it used to fail loudly (**WR-05**).

## Critical Issues

### CR-01: A repository's own project config can make the extension write the provenance ledger, so a cloned repository still runs its `!` commands

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts:89-106`; `extensions/pi-claude-marketplace/bridges/skills/stage.ts:523-544,616`; the premise at `extensions/pi-claude-marketplace/bridges/skills/project-installs.ts:12-17` and `orchestrators/skill-invocation.ts:281-287`

**Issue:** D-CF2-13 trusts a ledger entry because "a repository cannot write" the user scope. It does not need to. Three facts combine:

- `loadReconcileWithReader` reads `effectiveAutoapply` from four config files, the project base config `<cwd>/.pi/claude-plugins.json` among them. When the value is `true`, it runs `applyReconcile` on every load. Nothing checks trust or provenance first.
- Pi 1.4.0 does not ask about trust for `.pi/claude-plugins.json`, because it is not in `TRUST_REQUIRING_PROJECT_CONFIG_RESOURCES` (`core/trust-manager.js:8-17`). The project is trusted with no prompt.
- `apply` adds the declared marketplace and installs the declared plugin into the project scope. A marketplace `source` can be a path relative to the cwd (`marketplace/add.ts:1946`), so the marketplace can sit in the repository itself, and no network is needed. The skills commit then runs `recordProjectSkills`, which records every project-scope commit, including this one. The ledger now lists the repository's skill with its digest.

**Failure scenario (reproduced):** I used a scratchpad copy of the provenance background with no `.pi/settings.json`. The setup was a project base config with `{ "autoapply": true }`, a `marketplaces` entry, and a `plugins` entry for `demo`, plus a new session. The user never ran `install`. `/skill:demo-status` then sent the model `<skill name="demo-status" ...>Status: ran</skill>`, so `printf ran` ran. The same files with autoapply off pass the typed text through unchanged. A real repository would ship `.pi/claude-plugins.json` and `./mp/` and wait for the user to type the skill name, or its bare alias (`/review`, `/commit`).

Upstream Claude Code 2.1.316 never installs a plugin because repository settings name it. Such a plugin is `not_installed_here` until the user installs it. The extension's own `autoapply` feature is the divergence that reopens the hole. A repository must not be able to turn it on for the user.

**Fix:** Make provenance come from a user decision, and add an ID for this decision next to D-CF2-13:

1. Ignore `autoapply` from project-scope config files (both layers) when deciding whether a load runs `apply`. A repository cannot opt the user in. Only the user-scope configs can turn on load-time apply.
2. Even with user-scope autoapply on, a load-time apply should not add project-scope entries to the ledger unless Pi's trust store explicitly trusts the project. The default no-files trust does not count. One way is to have `applyReconcile` take a ledger port, and pass a no-op ledger for the project scope during a load. The installed skills then abort with the not-installed message until the user runs an explicit command.
3. Add a scenario to `features/skill/project-provenance.feature`. It has no `.pi/settings.json`, a project base config `{ "autoapply": true }` that declares a marketplace and a plugin, and a new session. `/skill:demo-status` must run nothing, and the model must receive nothing.

## Warnings

### WR-01: The abort message tells the user to `install`, which fails with "already installed" in every case that reaches it

**File:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:214-216`

**Issue:** `notInstalledHereMessage` says "Install its plugin into this project with --scope project, then run /reload". A project skill reaches this abort only when the project's `state.json` already records its plugin, because otherwise the alias and discovery paths would not offer it under a staged name. This happens in three cases:

- a clone whose committed `state.json` records the plugin (the CR-01 case);
- a project install made before this change (DUBIOUS-CHOICES DC-29 item 3);
- a `SKILL.md` that changed after the install, for example after a `git pull`.

In all three, `/claude:plugin install demo@fixtures --scope project` fails with `Plugin "demo" is already installed in marketplace "fixtures".` (`features/plugin/install.feature:211-221`). Plain `apply` does not re-stage either, so the user is left with no working fix. Only `reinstall`, or `uninstall` followed by `install`, rewrites the ledger.

**Fix:** Name the command that works: "... Reinstall its plugin into this project with /claude:plugin reinstall <plugin>@<marketplace> --scope project, then run /reload." Take the plugin id from the project's `state.json` record, which is already read on the alias path. Update the provenance scenario's expected message. Add a CHANGELOG line for existing project installs.

### WR-02: Any read error or unknown content makes the ledger writer replace the whole ledger, dropping every other project's entries

**File:** `extensions/pi-claude-marketplace/bridges/skills/project-installs.ts:86-109,162-180`

**Issue:** `update` uses the same lenient `readLedgerText` and `parseLedger` as the check. Every read error (`EACCES`, `EIO`, `EMFILE`, `EISDIR`) and every validation miss becomes `{}`. The writer then saves `{version: 1, projects: {<this project>: ...}}`. `test/bridges/skills/project-installs.test.ts:169-193` pins this as intended ("replaces a ledger that is of another shape").

**Failure scenarios:**

- A transient `EMFILE` during a bulk `import`, or one hand-edited entry missing `sha256`. The next project-scope install deletes the provenance of every other project, and nothing is reported. Each of those projects' skills then aborts and needs a reinstall (WR-01).
- A later release writes `version: 2`. Running an older extension once wipes it.

Failing closed is right for the read side. On the write side it destroys data.

**Fix:** In `update`, treat only `ENOENT` as an empty ledger. Throw a typed error for any other read failure and for content that fails `LEDGER_VALIDATOR`. The install then rolls back through the existing undo, and its message names the ledger file. Keep `provenProjectSkills` lenient. Change the two "replaces a ledger" unit cases to expect a rejection and an unchanged file.

### WR-03: The digest covers only `SKILL.md`, but `!` commands run other files of the staged skill and of the project plugin root, which sit in the repository tree

**File:** `extensions/pi-claude-marketplace/bridges/skills/stage.ts:523-544`; `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts:138-153,281-287`

**Issue:** `stageSkill` copies the whole skill directory (`stage.ts:313`). A `!` command usually runs a helper script, for example ``!`bash ${CLAUDE_SKILL_DIR}/scripts/status.sh` ``. `CLAUDE_SKILL_DIR` is the staged directory under `<cwd>/.pi/pi-claude-marketplace/resources/skills/<name>/`. For a project install, `CLAUDE_PLUGIN_ROOT` is a clone under `<cwd>/.pi/pi-claude-marketplace/`. Neither is hashed. The comment "the digest is of the very bytes that run below" holds for the command text, not for the code the command runs.

**Failure scenario:** The user installs plugin `p` into a team repository that commits its `.pi/pi-claude-marketplace/` tree, and the ledger records `p-status`. A later pull changes only `resources/skills/p-status/scripts/status.sh`. The `SKILL.md` digest still matches, and `/skill:p-status` runs the new script. Upstream keeps plugin files in `~/.claude/plugins/cache`, where the repository cannot write.

**Fix:** Hash the staged skill tree, not just its `SKILL.md`. Use sorted relative paths, entry types, symlink targets, and file bytes, store that digest, and compute it again at invocation. Either add the plugin root's tree for project scope, or record that root as an accepted residual with an ID in the threat register.

### WR-04: The ledger warning that unstage returns is dropped by every caller

**File:** `extensions/pi-claude-marketplace/bridges/skills/unstage.ts:43-61,99-102`; callers `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:571-575`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:1250-1253`

**Issue:** `forgetProjectSkills` turns a failed ledger write into `warnings`, and its doc comment promises that the failure "becomes a warning". `cascadeUnstagePlugin` reads only `skillsResult.removedNames`, and the install undo ignores the result entirely. No caller has ever read `UnstageSkillsResult.warnings`, which was always empty until now. So when uninstall, disable, or `marketplace remove` cannot update the ledger, the user is told nothing, and stale entries stay behind. If the same bytes come back (`git checkout` of a committed tree), a skill the user removed passes the check again.

**Fix:** Fold `skillsResult.warnings` into the cascade's bridge warnings in `cascadeUnstagePlugin` (`hygieneWarning` or the existing staging-warning path), and into the undo's rollback notes. Add a unit case in `test/orchestrators/marketplace/shared.test.ts` with a ledger that rejects.

### WR-05: `topLevelNodeIndex` takes a node that holds several keys as the `name` node, so the rewrite drops the others without an error (regression from c284184)

**File:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts:81-88,95-107`; `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts:28-39`; `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts:122`

**Issue:** `nodeHoldsKey` asks only whether the parsed node *has* the key. A flow-mapping frontmatter, `{name: review, description: Reviews a change., disable-model-invocation: true}`, is one column-0 node that holds `name`. `rewriteNameNode` replaces the whole node with `name: demo-review`. SKILL-03 checks only `name`, so the check passes. `augmentSkillDescription` compares against the source's description, finds it unchanged, and writes nothing. The staged frontmatter is `{name: "demo-review"}` plus the record. `description`, `disable-model-invocation`, `allowed-tools`, `arguments`, and `shell` are gone. Before c284184, the `startsWith("name:")` lookup missed this node, the inserted line made the YAML invalid, and the install failed loudly.

**Failure scenario (reproduced):** I ran a scratchpad scenario with that skill file. `install demo@fixtures --scope project` reports `cascade | info`, but the new session offers only `/skill:demo-skill`. Pi drops `demo-review` because it has no description, and the user is told nothing. A YAML-valid skill that Pi and Claude Code both accept now disappears without a message. If the description is rewritten instead (with `when_to_use`), `disable-model-invocation: true` is lost, so the model can invoke a skill its author restricted to the user.

**Fix:** Count a node as `key`'s node only when it holds that key alone:

```ts
const keys = Object.keys(frontmatter);
return keys.length === 1 && keys[0] === key;
```

When a node holds the key along with others, make the writers throw a typed error that names the skill, as the pre-c284184 code effectively did, or degrade the skill. Add a `frontmatter-scan.test.ts` row for a flow mapping and an explicit-key (`? name`) node (IN-01).

## Info

### IN-01: An explicit-key `name` node now leaves an empty key behind (IN-04 class, now in the name writer)

**File:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts:95-107`

**Issue:** For `? name` followed by `: x`, the `?` line parses alone as `{name: null}`. `rewriteFrontmatterName` replaces only that line, and the staged frontmatter becomes `{name: <gen>, "": "x"}`. Before c284184 this input failed the install. It now installs with a key the author never wrote. `setDescriptionScalar` handles `? description` the same way.

**Fix:** Treat a column-0 `?` line and the `:` line after it as one node in `keyValueEnd`, or reject the node as in WR-05.

### IN-02: A failed ledger write skips staging cleanup

**File:** `extensions/pi-claude-marketplace/bridges/skills/stage.ts:616-619`

**Issue:** `recordProjectSkills` throws before `cleanupStaging` runs. The skills undo removes the target directories but not `<skillsStagingDir>/<uuid>/`, so each failed write leaves an empty staging directory behind, and no leak warning names it.

**Fix:** Run `cleanupStaging` before `recordProjectSkills`, or in a `finally`, and keep the leak message.

### IN-03: The `createUnstagePluginSkills` doc comment now documents the wrong function

**File:** `extensions/pi-claude-marketplace/bridges/skills/unstage.ts:22-36,37-42`

**Issue:** The new `forgetProjectSkills` and its comment were inserted between `createUnstagePluginSkills` and its "Per-name `rm({recursive:true})` loop" comment. TypeScript attaches the nearest comment, so the factory now has no doc and the old comment documents nothing.

**Fix:** Move the old comment back above `createUnstagePluginSkills`.

### IN-04: The new scenarios check that the install succeeds, not what Pi offers, and the provenance feature does not cover the digest

**File:** `features/skill/frontmatter.feature:117-148,180-209`; `features/skill/project-provenance.feature`

**Issue:**

- The WR-02 and WR-03 outlines stop at `cascade | info` and `installed`. They would still pass if the writer had silently dropped the description or `when_to_use` (WR-05 shows such a loss is possible).
- The provenance feature tests only "ledger deleted". No scenario changes the staged `SKILL.md` while the ledger is present. That digest half is the part that stops a `git pull` from changing what runs, and only unit tests cover it.
- No scenario shows that `update`, `reinstall`, or `enable` keep a project skill runnable. Each of those reaches the ledger through `commitPreparedSkills` on a separate path.

**Fix:** Add `Then the session offers these skills:` with the expected description to each outline. Add a provenance scenario that appends a line to the staged `SKILL.md`, starts a new session, and expects the usage-error. Add one that runs `/claude:plugin update` or `reinstall` and then `/skill:demo-status`, and expects `Status: ran`.

### IN-05: D-CF2-13 is not recorded in `02-CONTEXT.md`, and the upgrade effect has no CHANGELOG line

**File:** `.planning/phases/02-skills/02-CONTEXT.md` (decisions end at D-CF2-12); `CHANGELOG.md`

**Issue:** The round-2 fix asked for the decision to be recorded in CONTEXT with an ID. It exists only in `02-REVIEW-FIX.md` and `DUBIOUS-CHOICES.md` DC-29. DC-29 item 3 says the reinstall requirement for existing project installs "needs a CHANGELOG line", and none was added.

**Fix:** Add D-CF2-13, and the CR-01 autoapply decision, to `02-CONTEXT.md`. Add the CHANGELOG line with the working command (WR-01).

### IN-06: Without a lock, a lost `forget` brings back a removed entry

**File:** `extensions/pi-claude-marketplace/bridges/skills/project-installs.ts:162-180`

**Issue:** DC-29 item 1 calls a lost update "closed (that project's skills abort)". That holds for a lost `remember`. A lost `forget` fails open instead. Process A installs into project X while process B uninstalls from project Y. Both read the ledger, B writes, then A writes from its earlier read, and Y's removed entries return. As in WR-04, the risk is limited to the same bytes coming back.

**Fix:** None needed beyond the accepted residual. Correct DC-29 item 1 so that it says this.

## Previous rounds

- **Round 1** (1 critical, 3 warnings, all fixed): indented `---` in the record writer, record-key spellings, a stale staged file falling through to Pi's expansion, and an untrusted project running `!`.
- **Round 2** (1 critical, 3 warnings, 5 info): CR-01 was Pi auto-trusting a project that holds only `.pi/pi-claude-marketplace/`. WR-01 to WR-03 were discovery in untrusted projects, the fence rule, and the `name`/`description` key spellings. All four were addressed in this diff. Round-2 IN-01 to IN-05 (cancelling a `!` command, guarding `!` in variable values, a forged bare-name record, exotic record-key forms, and the cached rejected alias load) were outside the fix scope. They are unchanged, and this round did not score them again. Round-2 IN-03 is now covered by the ledger except in the CR-01 autoapply case.

---

_Reviewed: 2026-11-01T14:42:42Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3_
