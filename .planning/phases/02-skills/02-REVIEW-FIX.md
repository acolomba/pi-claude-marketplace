---
phase: 02-skills
fixed_at: 2026-11-01T15:53:05Z
review_path: .planning/phases/02-skills/02-REVIEW.md
iteration: 3
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report (iteration 3)

**Fixed at:** 2026-11-01T15:53:05Z
**Source review:** .planning/phases/02-skills/02-REVIEW.md (iteration 3)
**Iteration:** 3 (the last fix iteration; only the verifier follows)

**Summary:**

- Findings in scope: 10. The parent chose CR-01, WR-01 to WR-05, IN-01, IN-02, IN-03 and IN-06.
- Fixed: 10
- Skipped: 0
- Left to the parent: IN-04 (extra scenarios for update, reinstall and enable) and IN-05 (the CONTEXT and CHANGELOG lines). See "Parent lines" below.

## History

- **Iteration 1** fixed the round-1 review: one critical and three warnings (the record writer's indented fence, record-key spellings, a stale staged file, and `!` in an untrusted project).
- **Iteration 2** fixed CR-01 and WR-01 to WR-03 of round 2 (commits 4e3b32f, 6a7ea1b, 8b05948, c284184). CR-01 added decision D-CF2-13: a user-scope ledger of the project skills this user installed. A project skill runs its `!` commands and claims an alias only when the ledger lists it with the digest of its staged file.
- **Iteration 3** (this report) fixes the round-3 findings. CR-01 adds decision D-CF2-14 below.

## Where verification ran

Every step ran in the main checkout `/home/user/pi-claude-marketplace` on branch `claude/quirky-planck-hhm592`. The parent asked for no worktree, so every number can be reproduced from this tree. Every npm script, cucumber run and commit ran under the root-sandbox wrapper (`nondac-sh`) with `NODE_OPTIONS=--max-old-space-size=6144`.

Each fix ran these checks:

- its unit files;
- direct coverage of every touched source-test pair (`npm run test:coverage:direct -- <source>`), all at 100%;
- its cucumber feature;
- a red proof. Only the source change was stashed, and the new test or scenario was shown to fail.

The commit hook ran `npm run check:commit` on every commit and passed. Before the report: `npm run check:static`, `npm run test:modules`, and `npx cucumber-js features/skill features/plugin features/marketplace`. The results are in "Final checks" at the end. The full `npm run check` was not run; the parent runs it.

## Decision D-CF2-14 (load-time autoapply never applies the project scope)

The parent took this decision. It is recorded here with its ID.

**Decision:** A load-time apply (the `autoapply` path in `orchestrators/reconcile/load.ts`) may change the project scope only when Pi holds an explicit trust record for the project. Pi 1.4.0 auto-trusts a project that has no trust-requiring files, and that does not count. If an explicit trust record cannot be told apart through the allowed routes, a load-time apply never changes the project scope. The user scope is applied, and the project scope gets the read-only pass and the same pending block `pending` prints, ending with the `/claude:plugin apply` trailer. An explicit `/claude:plugin apply` still applies both scopes and writes the ledger, because a command the user types is consent, as accepting upstream's install prompt is. This holds whichever config file turned autoapply on.

**Upstream parity:** Claude Code reads repository-declared plugins and marketplaces from `.claude/settings.json` only after the workspace trust dialog, and it asks the user before it installs them. It never installs them silently.

**Measurement (Pi 1.4.0, `node_modules/@earendil-works/pi-coding-agent`):**

- `core/project-trust.js::resolveProjectTrusted` returns `true` at once when `hasTrustRequiringProjectResources(cwd)` is false. It does that before it reads the trust store. The other ways a project becomes trusted are a `trustOverride`, an extension's `project_trust` answer, a trust-store entry, `defaultProjectTrust: "always"`, and the prompt. The prompt's "Trust (this session only)" option writes nothing to the store.
- The extension context exposes only `isProjectTrusted(): boolean` (`core/extensions/types.d.ts:238`). It is `true` for an auto-trusted project too.
- Pi's root does export `ProjectTrustStore` (`dist/index.d.ts:28`), and `getEntry(cwd)` returns the nearest explicit decision. But `platform/pi-api.ts` does not re-export it. That file is frozen, and the `pi-peer-chokepoint` rule forbids importing the peer anywhere else.
- Reading `<agentDir>/trust.json` directly would copy Pi's private file format, its ancestor walk, and its lock outside the NFR-11 boundary. I did not treat that as an allowed route.

**Verdict:** explicit trust cannot be told apart through the allowed routes, so the fallback applies. A load never applies the project scope.

**Where it lives:** `load.ts::autoapplyUserScope` runs the injected apply step with `scope: "user"`. The read-only pass then covers the project scope only, or both scopes when autoapply is off or the apply step threw (AAP-03).

## Fixed Issues

### CR-01: A repository's own project config can make the extension write the provenance ledger

**Status:** fixed
**Commit:** 11a3db9
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts`, `test/orchestrators/reconcile/load.test.ts`, `test/index.test.ts`, `features/plugin/autoapply.feature`, `features/skill/project-autoapply.feature` (new)
**Applied fix:** This implements D-CF2-14 as above.

New scenarios in `features/skill/project-autoapply.feature` reuse the reviewer's scratch reproduction: no `.pi/settings.json`, a project base config with `autoapply: true`, and a marketplace and a plugin declared there.

- "A skill of a plugin that only the repository's autoapply config declares runs no context command". After a new session, `/skill:demo-status` reaches the model as the literal text.
- "A skill of a plugin that the repository's config declares runs its context command after the user applies the config". After `/claude:plugin apply` and a new session, the model receives `Status: ran`.

**Red proof:** without the fix, the first scenario received `<skill name="demo-status" ...>Status: ran</skill>`, so the `!` command ran. Four `autoapply.feature` scenarios also failed: the three rows of the new Outline and the project move scenario.

**Changed AAP tests and scenarios** (they assumed that a load applies the project scope):

- `features/plugin/autoapply.feature`:
  - "A new session installs the plugins a project config declares when the config turns autoapply on" became "... a user config declares when the project config turns autoapply on". The marketplace and plugin moved to the user scope.
  - "A new session clones and installs a git-source plugin that a project config declares ..." became "... a user config declares ...", in the user scope.
  - "Autoapply in the user config applies the plugins a project config declares" was replaced by the Outline "A new session leaves the plugins a project config declares pending when a config turns autoapply on". Its rows are user base, project base and project local. The new expectation is the read-only pending block, twice (two loads), with nothing installed and no skills offered.
  - The three precedence scenarios ("A project local config that turns autoapply off overrides ...", "A project config that turns autoapply off overrides ...", "A project local config that turns autoapply on overrides ...") keep their autoapply files. Their marketplace and plugin moved to the user scope, so they still prove the precedence.
  - "A failed install during an autoapply session ...", "An autoapply session that an invalid GitHub base address stops ...", "An autoapply session moves an installed plugin ..." and "Autoapply on changes the setting and installs nothing until the next load" moved to the user scope.
  - New: "An autoapply session leaves the move of a project plugin pending". It shows the project `will update` row, and the installed project copy stays at 1.0.0.
  - "A config that turns autoapply off keeps a new session read-only" and "A config whose autoapply is not a boolean ..." stay at project scope, because they never applied.
- `test/orchestrators/reconcile/load.test.ts`:
  - "AAP-02 / D-05: a project config that turns autoapply on hands the load to the apply step and prints nothing itself" became "D-CF2-14: ... hands the apply step the user scope only and prints the project's pending block". The handed options now include `scope: "user"`.
  - New: "AAP-02 / D-05: an autoapply load whose project scope matches its config prints nothing itself".
- `test/index.test.ts`: the two AAP index cases seed and turn on autoapply in the user scope. `seedEnabledPluginWithMissingDependency` and `turnAutoapplyOn` take a scope root. The first case was renamed "... installs a user plugin's missing dependency ...".

### WR-01: The abort message tells the user to `install`

**Status:** fixed
**Commit:** 9dc0c2c
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts`, `test/orchestrators/skill-invocation.test.ts`, `features/skill/project-provenance.feature`
**Applied fix:** The abort now reads: `... Reinstall its plugin into this project with /claude:plugin reinstall <plugin>@<marketplace> --scope project, then run /reload to use it.` The plugin and marketplace are taken from the project's `state.json` record that lists the skill. A new `loadState` dependency reads it. When no record lists the skill, or the state cannot be read, the message names `/claude:plugin reinstall --scope project`, which reinstalls every project plugin.

**Verified:** the new scenario "A project skill whose install the user's pi directory does not record runs its context command after the reinstall the abort names" runs that exact `reinstall` command after the ledger is removed, starts a new session, and gets `Status: ran`.

**Red proof:** the message scenario failed on the old text.

### WR-02: Any read error or unknown content makes the ledger writer replace the whole ledger

**Status:** fixed
**Commit:** 065a9db (IN-06 later moved it to per-project files)
**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/project-installs.ts`, `extensions/pi-claude-marketplace/shared/errors-bridges.ts` (new `ProjectSkillLedgerError`), `test/bridges/skills/project-installs.test.ts`, `test/shared/errors-bridges.test.ts`, `features/skill/project-provenance.feature`, `features/step_definitions/skill/project-provenance.steps.ts`
**Applied fix:** The writer treats only `ENOENT` as an empty ledger. Any other read error throws `ProjectSkillLedgerError(file, "unreadable", { cause })`. Content that is not JSON, or not this version's layout, throws `ProjectSkillLedgerError(file, "unknown-content")`. After IN-06, content that names another project throws the same way. The message names the file and says that it was left unchanged. The check side (`provenProjectSkills`) stays lenient and fails closed.

The two unit cases that pinned the old "replaces a ledger" behavior now expect a rejection and an unchanged file. The rows are not JSON, another version, a missing digest, another project, and a directory in place of the file (`EISDIR`).

**Scenario:** "Installing a project skill's plugin while the user's record of project skill installs holds content pi cannot update fails and keeps the record". The cause chain is `The project skill ledger skills.json holds content this version cannot update; it was left unchanged.` The record keeps its bytes, and the project has no installed plugins.

**Red proof:** without the fix, the install succeeded and overwrote the record.

**Note:** an `update` or `reinstall` that hits such a ledger fails after the physical swap. The update family is not transactional (its design is hand-rolled, with no undo for a phase-3 commit failure). It reports "Plugin ... failed during physical replace. Run /claude:plugin reinstall ... to repair it", with the ledger error as the cause. The new skill files are in place but not in the ledger, so they abort at invocation, which fails closed. They work again once the user removes or repairs the named file.

### WR-03: The digest covers only `SKILL.md`

**Status:** fixed
**Commit:** fdbf921
**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/project-installs.ts` (`SkillTreeEntry`, `NODE_SKILL_TREE_LISTER`, `skillTreeDigest`), `extensions/pi-claude-marketplace/bridges/skills/stage.ts`, `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts`, `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts`, their tests, `test/bridges/skills/stage.test.ts`, `features/skill/project-provenance.feature`, `features/step_definitions/skill/project-provenance.steps.ts`
**Applied fix:** The ledger digest now covers the whole staged skill directory. Every regular file is hashed by its bytes, and every symbolic link by its target string. Directories carry no entry. Any other entry kind, such as a FIFO, throws, so the check fails closed. The walker never follows a link. Node's recursive `readdir` does follow a symlinked directory (I measured this), so the walker is hand-written.

The entries are sorted by relative path with `/` separators, and the SHA-256 is taken over their JSON list. The `SKILL.md` entry is replaced by the hash of the exact bytes that the invocation parses and runs, so there is still no gap between the check and the use for that file. The invocation and the alias loader list the directory again at use time, and any difference fails closed: an edited, added or removed file, or a directory they cannot list.

**Scenario:** the provenance Background's skill now runs a helper, ``!`sh ${CLAUDE_SKILL_DIR}/status.sh` ``. The new Outline "A project skill whose staged directory changed after the install runs no context command" has three rows: an edited `SKILL.md`, an edited `status.sh`, and an added `notes/added.md`.

**Red proof:** the `status.sh` and `notes/added.md` rows ran the command without the fix. The `SKILL.md` row was already covered.

**Accepted residual (not fixed):** files under `${CLAUDE_PLUGIN_ROOT}` outside the staged skill directory stay unhashed. For a project install, that root is a clone under `<cwd>/.pi/pi-claude-marketplace/`, which sits in the repository tree. A `!` command that runs a script from the plugin root, such as ``!`node ${CLAUDE_PLUGIN_ROOT}/scripts/x.js` ``, still runs that script as the repository holds it now. The same is true of a symbolic link's target outside the skill directory: the link's target string is hashed, but the target's bytes are not. The threat register needs an ID for this residual (see "Parent lines").

### WR-04: The ledger warning that unstage returns is dropped by every caller

**Status:** fixed
**Commit:** 4f57d1f
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (`UnstageOutcome.skillWarnings`), `extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts` (`surfaceUnstageWarnings`), `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`, their tests, `features/skill/project-provenance.feature`
**Applied fix:** `cascadeUnstagePlugin` carries the skills slot's warnings on its outcome as `skillWarnings`, set only when non-empty, on success and on failure. The standalone uninstall, the standalone disable, and the clean arm of the standalone `marketplace remove` show them after their rows. Each plugin gets one `diagnostic` notification: `Plugin "<p>" [<scope>] uninstalled|disabled; N cleanup warning(s).`, with the warning lines redacted.

This reuses the existing `diagnostic` kind through `notifyDiagnostic`. It adds no closed-set reason, so there is no separate reason commit. `marketplace remove` reaches the helper through `plugin/staging-diagnostics.ts`, one of the leaf composers that BLOCK C allows.

**Scenario:** the Outline "Removing a project skill while the user's record of project skill installs holds content pi cannot update removes it and warns" has uninstall, disable and `marketplace remove` rows.

**Red proof:** all three rows failed without the source change, and so did the three new orchestrator unit cases.

**Not wired (residual):**

- The install undo (`install-outcome.ts` skills undo) and the install-cascade undo still ignore the warning. In the case that reaches them, the commit's own ledger write has just failed against the same file. A rollback note there would report a ledger that was never written, so it would mislead.
- An orchestrated uninstall or disable (through `apply` or `import`) and the partial-failure arms of the three verbs do not show it either. Their failed rows already speak.

### WR-05: `topLevelNodeIndex` treats a multi-key node as the `name` node

**Status:** fixed
**Commit:** a9e8b3e
**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts`, `extensions/pi-claude-marketplace/bridges/skills/stage.ts` (`stageNamedSkill`), `extensions/pi-claude-marketplace/shared/errors-bridges.ts` (new `SkillFrontmatterNodeError`), `test/bridges/skills/frontmatter-scan.test.ts`, `test/bridges/skills/stage.test.ts`, `test/shared/errors-bridges.test.ts`, `features/skill/frontmatter.feature`
**Applied fix:** A top-level node counts as `key`'s node only when it holds `key` alone. A node that holds the key beside other keys throws `SkillFrontmatterNodeError` with the key, the 1-based line and the node's keys. An example is the flow mapping `{name: x, description: y, ...}`, on one line or over several. The staging loop adds the skill's source name. A node that does not parse alone keeps the plain-spelling fallback.

This restores the pre-c284184 contract, under which the install fails visibly, and it improves the message. The message is now `The frontmatter of the skill "review" holds "name" on line 2 in one node with other keys (name, description, disable-model-invocation); write each key on its own line.`

**Scenario:** "Installing a skill whose frontmatter holds its name in one flow mapping with other keys fails and names the skill". The install fails with that cause, and the project scope has no installed plugins.

**Red proof:** without the fix, the install reported `cascade | info` (silent key loss).

### IN-01: An explicit-key `name` node leaves an empty key behind

**Status:** fixed (correct handling, not a refusal; see Dubious Choices)
**Commit:** 546864c
**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts`, `test/bridges/skills/frontmatter-scan.test.ts`, `test/bridges/skills/rewrite-frontmatter.test.ts`, `test/bridges/skills/frontmatter-degrade.test.ts`
**Applied fix:** `keyValueEnd` now absorbs the column-0 `: <value>` line that follows a column-0 `? <key>` line, and any indented line before it. So `? name` / `: review` is one node that parses as `{name: review}`. The name writer and the description writer then replace the whole node, as they do for every other spelling.

**Unit rows:** four rows for `keyValueEnd` (value line and continuation, only the first value line, no absorption after a plain key, no value line), one for `topLevelNodeIndex`, one name rewrite and one description rewrite.

**Red proof:** four unit rows failed without the fix.

**No scenario:** the old output put an extra `""` key in the staged frontmatter, which Pi ignores. What Pi offers is the same before and after, and no step reads the staged file's text.

### IN-02: A failed ledger write skips staging cleanup

**Status:** fixed
**Commit:** 7d81290
**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/stage.ts`, `test/bridges/skills/stage.test.ts`
**Applied fix:** `commitPreparedSkills` cleans the staging directory before the ledger write, in the new `cleanUpAndRecord`. It then appends any cleanup leak to the write's error through `appendLeakToError`, which gives a `CleanupLeakError` whose cause is the ledger error. The unit cases prove an empty staging root after a failed write, and the leak text on the error.

**Red proof:** both cases failed without the fix.

**No scenario:** the leftover is an empty directory under the staging root, which no command shows.

### IN-03: The `createUnstagePluginSkills` doc comment documents the wrong function

**Status:** fixed
**Commit:** 0d45bf2
**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/unstage.ts`
**Applied fix:** The comment is back above the factory. It also says that the factory drops the names from the ledger at project scope and reports a ledger it could not update in `warnings`.

### IN-06: Without a lock, a lost `forget` brings back a removed entry

**Status:** fixed (structurally, not by remove-and-verify)
**Commit:** 70d9c6c
**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/project-installs.ts`, `features/step_definitions/skill/project-provenance.steps.ts`, `features/skill/project-provenance.feature` (the redacted file name), `test/bridges/skills/project-installs.test.ts`, `test/orchestrators/skill-invocation.test.ts`, `test/orchestrators/skill-alias-state.test.ts`, `test/orchestrators/plugin/install-flow-ledger.test.ts`, `test/shared/errors-bridges.test.ts`
**Applied fix:** The ledger is now one file per project: `<agentDir>/pi-claude-marketplace/project-installs/<sha256(real project path)>/skills.json`, holding `{ version: 1, project, skills }`. When a project's last skill is forgotten, its directory is removed.

Every write for project P comes from a skills commit or unstage at P's project scope. Those run inside operations that hold P's scope state lock: the install ledger body, the update swap, and the uninstall, disable and `marketplace remove` cascades. So writes for one project never interleave, and a write for one project never reads or rewrites another project's file. Neither a lost `forget` nor a lost `remember` can happen across projects any more. A file whose `project` field names another path lists nothing to the check and is refused by the writer.

**Unit case:** "IN-06: a change to one project leaves the ledger of another project untouched".

**No scenario:** the race needs two processes at once.

## Accepted residuals

- **WR-03:** the files of the plugin root outside the staged skill directory, and the targets of symbolic links, are not hashed (see WR-03).
- **D-CF2-14:**
  - A repository's project config can still turn on load-time apply for the user scope, because `effectiveAutoapply` reads all four files (AAP-01). It installs only what the user's own configs declare. A user config that declares a marketplace by a path relative to the cwd would resolve inside the repository. That is a pre-existing quirk of AAP-01, and this fix leaves it unchanged.
  - A project the user did explicitly trust no longer auto-applies at load either. That is the fallback the parent named.
- **WR-04:** the install undo paths and the orchestrated arms do not show the warning (see WR-04).
- **IN-06:** the guarantee assumes that every ledger write holds the project's state lock. I checked the three callers that write the ledger: `install-outcome.ts`, `update-swap.ts`, and `marketplace/shared.ts::cascadeUnstagePlugin` through uninstall, disable, `marketplace remove` and the install-cascade undo. A future writer outside a project lock would bring the race back.

## Parent lines

These are for files this fixer may not edit.

- **02-CONTEXT.md (IN-05):** add D-CF2-13 (the user-scope ledger of project skill installs, now one file per project under `pi-claude-marketplace/project-installs/<sha256>/skills.json`, with a digest over the whole staged skill directory). Add D-CF2-14 as worded above.
- **CHANGELOG.md (IN-05):** "Project-scope skills run their `!` commands only when you installed their plugin into the project on this machine. Existing project installs need `/claude:plugin reinstall <plugin>@<marketplace> --scope project` once. A load with `autoapply` on now applies only the user scope; run `/claude:plugin apply` to apply a project's config."
- **DUBIOUS-CHOICES.md DC-29:**
  - Correct item 1. The ledger is now per project and written under the project's state lock, so the cross-project lost update (both `remember` and `forget`) is closed. A lost update within one project cannot happen while the lock holds.
  - Update item 3. The working command is `reinstall`, not `install`.
- **Threat register (02-SECURITY.md or the milestone register):** an ID for the WR-03 residual (plugin-root files and link targets are not hashed), and the D-CF2-14 decision as the mitigation for "a repository installs its own plugin through autoapply".
- **`platform/pi-api.ts` (frozen):** if a later change re-exports Pi's `ProjectTrustStore` (or a narrow "explicit trust entry for cwd" helper), D-CF2-14 can allow load-time project apply for an explicitly trusted project, as the parent's first branch describes.
- **Hooks phase (pre-existing, from iteration 2):** project hook hydration still trusts the repository tree. It should adopt the D-CF2-13 ledger, and D-CF2-14 now keeps load-time autoapply out of the project scope for hooks too.
- **IN-04 (left to the parent):** scenarios that check what Pi offers after the WR-02 and WR-03 outlines of round 2, and `update`, `reinstall` and `enable` keeping a project skill runnable. This iteration adds a reinstall-then-run scenario (WR-01) and the digest scenarios (WR-03). The update and enable cases are still open.
- **docs/output-catalog.md:** if the catalog lists every diagnostic header, add `Plugin "<p>" [<scope>] uninstalled|disabled; N cleanup warning(s).` (WR-04). The unpaired architecture tests passed without it.

## Final checks

These ran in the main checkout after the last commit (4f57d1f):

- `npm run check:static`: exit 0. Typecheck, lint, lint:workflows, fallow, format:check, test:corresponding and check:features all passed.
- `npm run test:modules`: exit 0. The one console line is the sanctioned IL-3 migration warning that a test provokes.
- `npx cucumber-js features/skill features/plugin features/marketplace`: exit 0, with 1242 scenarios and 12881 steps passed. The autoapply scenarios live in `features/plugin/autoapply.feature` and `features/skill/project-autoapply.feature`. There is no `features/reconcile` directory.
- The commit hook (`npm run check:commit`) passed on all ten commits.

Not run here: `npm run test:integration` and the full `npm run check`. The parent runs `npm run check`.

---

_Fixed: 2026-11-01T15:53:05Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
