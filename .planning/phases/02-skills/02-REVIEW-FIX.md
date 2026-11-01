---
phase: 02-skills
fixed_at: 2026-11-01T14:11:48Z
review_path: .planning/phases/02-skills/02-REVIEW.md
iteration: 2
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-11-01T14:11:48Z
**Source review:** .planning/phases/02-skills/02-REVIEW.md
**Iteration:** 2

**Summary:**

- Findings in scope: 4 (CR-01, WR-01, WR-02, WR-03; fix scope `critical_warning`, so IN-01..IN-05 were not attempted)
- Fixed: 4
- Skipped: 0

**Where verification ran:** in the main checkout `/home/user/pi-claude-marketplace` on branch `claude/quirky-planck-hhm592`. The orchestrator asked for no worktree, so the numbers can be reproduced from this tree. Every npm script, cucumber run, and commit ran under the root-sandbox wrapper (`nondac-sh`) with `NODE_OPTIONS=--max-old-space-size=6144`. Each fix ran its own unit files, direct coverage for each touched source-test pair (`scripts/test-coverage-direct.mjs`, all complete), `npm run test:modules` (exit 0), and its own cucumber feature. A red proof was taken for each fix by stashing only the source change. The commit hook ran `npm run check:commit` and passed on all four commits. Before the last commit: `npm run check:static` (exit 0) and `npx cucumber-js features/skill features/plugin` (732 scenarios, 8053 steps, all passed). After the last commit, `npm run test:integration` also passed (exit 0). `npm run check` (the full gate) was not run; it belongs to the phase gate.

## Decision D-CF2-13 (project-install provenance outside the repository)

The orchestrator settled this under the user's standing instruction to follow upstream Claude Code.

**Decision:** A project-scope bridged skill runs its `!` commands, and claims an alias, only when a user-scope provenance record says this user installed it into this project. The record is `<agentDir>/pi-claude-marketplace/project-installs.json`. It sits under the user scope root, inside NFR-10 containment, and is written atomically through `shared/atomic-json.ts` (NFR-1). It is keyed by the canonical (real) project path. For each staged skill it lists the plugin and the SHA-256 of the staged `SKILL.md`. A skill that fails the check aborts with a message that tells the user to install its plugin into this project, and nothing reaches the model.

**Upstream evidence (from 02-REVIEW.md CR-01):** Claude Code 2.1.316 keeps its installed set in `installed_plugins.json` under the user's config directory. Each project entry carries `scope: "project"` and `projectPath`. It drops a plugin that only the repository's settings enable with `not_installed_here`. Provenance never comes from the repository.

**Where it lives:**

- `bridges/skills/project-installs.ts` holds the ledger (read, verify, write).
- `commitPreparedSkills` writes the ledger for a project-scope commit. Install, update, reinstall, enable, apply, and import all reach it through the stage/commit triplet. A failed ledger write throws, so the caller's undo removes the skills.
- `unstagePluginSkills` drops entries when skills are removed (uninstall, disable, marketplace remove). A failed ledger write there becomes a warning and never blocks the removal.
- `orchestrators/skill-invocation.ts` checks the record, and so does `orchestrators/skill-alias-state.ts`.

**Parent line (hooks):** The hooks bridge has the same exposure: project-scope hook hydration reads the repository's tree and never checks provenance or trust. This is pre-existing and owned by the Hooks phase, and this fix leaves it unchanged. The Hooks phase should adopt the same provenance check, reusing the user-scope ledger pattern of D-CF2-13.

## Fixed Issues

### CR-01: Plugin content the user never installed still runs its `!` commands, because Pi trusts a project that holds only `.pi/pi-claude-marketplace/`

**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/project-installs.ts` (new), `extensions/pi-claude-marketplace/bridges/skills/stage.ts`, `extensions/pi-claude-marketplace/bridges/skills/types.ts`, `extensions/pi-claude-marketplace/bridges/skills/unstage.ts`, `extensions/pi-claude-marketplace/bridges/skills/index.ts`, `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts`, `extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts`, `test/bridges/skills/project-installs.test.ts` (new), `test/bridges/skills/stage.test.ts`, `test/bridges/skills/types.test.ts`, `test/bridges/skills/unstage.test.ts`, `test/orchestrators/skill-invocation.test.ts`, `test/orchestrators/skill-alias-state.test.ts`, `test/orchestrators/plugin/install-flow-ledger.test.ts`, `features/skill/project-provenance.feature` (new), `features/step_definitions/skill/project-provenance.steps.ts` (new)
**Commit:** 4e3b32f
**Applied fix:** This implements D-CF2-13 (above).

- `PreparedSkillsStaged` gains the internal `_pluginName`.
- `commitPreparedSkills(ops, prepared, ledger = NODE_PROJECT_SKILL_LEDGER)` reads each committed `SKILL.md` at its target after the renames. It records the digests and forgets the previous names it replaced. The ledger is called only at project scope.
- `createUnstagePluginSkills(remover, ledger)` forgets the requested names at project scope.
- The invocation reads the staged file once. It aborts with `The skill <typed> was not installed into the project <cwd> on this machine, or its file changed after the install. Install its plugin into this project with --scope project, then run /reload to use it.` unless the ledger lists `<generated name>` for the canonical `cwd` with the digest of those exact bytes. The digest is of the bytes that then run, so there is no gap between check and use.
- The alias loader reads the ledger once for the project root and drops every name of a project skill that fails the check.
- Unit cases cover ledger key canonicalization (symlink and missing path), forget and remember, order kept, no write when nothing changes, malformed ledgers, the commit record (project), no ledger call (user scope), commit failure propagation, the unstage forget and its warning, four invocation abort variants (no ledger, other project, other digest, other skill), a user skill that reads no ledger, and three alias variants.
- `install-flow-ledger.test.ts` (outside Phase 2's files; minimal touch) now expects the ledger file in the user tree after an allowed project install.

**Scenarios** (`features/skill/project-provenance.feature`, no `.pi/settings.json`, so Pi trusts the project without asking):

- "A project skill whose install the user's pi directory does not record runs no context command" (usage-error with the message above)
- "A skill alias of a project skill whose install the user's pi directory does not record reaches the model as typed"
- "A project skill the user installed into the project runs its context command"

The step "the user's pi directory records no plugin install for the project" removes the user-scope ledger and keeps the project's real `state.json` and staged tree. That is exactly what a clone of a repository that commits its `.pi/pi-claude-marketplace/` holds.

**Red proof:** without the fix, `/skill:demo-status` started a model turn (`disposition: 'started'`, the `!` command ran), and `/fancy now` sent the model `<skill ...>Status: ran ... ARGUMENTS: now</skill>`.

### WR-01: In a project that Pi does not trust, the staged skills are still discovered, listed to the model, and readable

**Files modified:** `extensions/pi-claude-marketplace/index.ts`, `extensions/pi-claude-marketplace/orchestrators/discover.ts`, `extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts`, `test/index.test.ts`, `test/orchestrators/discover.test.ts`, `features/skill/project-trust.feature`
**Commit:** 6a7ea1b
**Applied fix:**

- The `resources_discover` handler passes `ctx.isProjectTrusted() ? locationsFor("project", event.cwd) : undefined`. This is a minimal touch outside Phase 2's files, in `index.ts` and `orchestrators/discover.ts`, whose project parameter is now optional. Pi resolves trust before it emits the event (`resource-loader.js:362-365`).
- The invocation's trust gate stays for a trust change within a session. Its comment no longer claims that "nothing of it reaches the model".
- `test/index.test.ts`: the strict context mock in `loadExtension` now answers `isProjectTrusted()` with `true` (`anyTimes`), and the six literal contexts gained `isProjectTrusted: () => true`. A new case proves that an untrusted project's prompt is left out while the user's is kept, with exactly one trust read.
- `discover.test.ts` gained the `undefined`-project case.

**Scenario change:** `features/skill/project-trust.feature` changed on purpose, because the observable behavior changed.

- The scenario "runs no context command and asks for trust" (its usage-error is no longer reachable from a new session) became "A new session in an untrusted project offers none of its skills".
- A new scenario, "A skill of an untrusted project runs no context command and reaches the model as typed", shows that `/skill:demo-status` now reaches the model as the literal text, as Pi passes an unknown skill through and as upstream does for a name it does not know.
- The alias scenario is unchanged. "the user has started a new pi session" moved from the Background into the two scenarios that need it.

**Red proof:** without the fix, the session offered `/skill:demo-skill` and `/skill:demo-status`, and the typed invocation was aborted by the trust gate with no model call. `features/agent/project-trust.feature` still passes.

### WR-02: The shared scanner `frontmatterBlockEnd` still stops at an indented `---`, so `name` and `description` rewrites break skills that Pi accepts

**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts`, `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts`, `test/bridges/skills/frontmatter-scan.test.ts`, `test/bridges/skills/rewrite-frontmatter.test.ts`, `test/bridges/skills/frontmatter-degrade.test.ts`, `features/skill/frontmatter.feature`
**Commit:** 8b05948
**Applied fix:**

- `frontmatterBlockEnd` now uses Pi 1.4.0's rule: the first later line that starts with `---` at column 0, which also closes at a `----` line, as Pi does.
- `skill-names.ts` dropped its local `closingFenceIndex` and uses the shared scanner, so the staging pipeline has one fence rule.
- New unit rows:
  - the scanner passes over an indented rule line and closes at `---- `;
  - `name` after a block scalar holding an indented `---`;
  - `setDescriptionScalar` with that block scalar before `when_to_use`;
  - the colon repair of a line after it.
- New scenario: a three-row Outline, "Installing a skill whose block-scalar description holds an indented rule line before another key installs it". The rows are `name` before and `when_to_use` after, `name` after, and a repairable colon line after.

**Red proof:** the four new unit rows failed. In the scenario, rows 1 and 2 failed with `cascade | error | A plugin operation has failed.`, and row 3 degraded with `warning`.

### WR-03: The WR-01 key-spelling class still breaks the `name` and `description` writers

**Files modified:** `extensions/pi-claude-marketplace/bridges/skills/frontmatter-scan.ts`, `extensions/pi-claude-marketplace/bridges/skills/skill-names.ts`, `extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts`, `extensions/pi-claude-marketplace/bridges/skills/frontmatter-degrade.ts`, `test/bridges/skills/frontmatter-scan.test.ts`, `test/bridges/skills/rewrite-frontmatter.test.ts`, `test/bridges/skills/frontmatter-degrade.test.ts`, `features/skill/frontmatter.feature`
**Commit:** c284184
**Applied fix:**

- The parse-per-node lookup moved from `skill-names.ts` (`isRecordNode`) into `frontmatter-scan.ts` as `topLevelNodeIndex(lines, blockEnd, key)`. The name rewrite, the description writer, and the record writer all use it.
- A node that does not parse alone (an alias of another node's anchor) still matches its plain spelling `<key>:`. This keeps the old behavior for `name: *n`, which would otherwise have regressed into a duplicate-key failure.
- New unit rows:
  - `topLevelNodeIndex` for the plain, double-quoted, single-quoted, spaced, and escaped spellings; an aliased node; a look-alike key; another key's alias; nested and block-scalar lines; a comment; the body; a sparse slot;
  - the name rewrite for `"name":`, `'name':`, `name :`, and `name: *n`;
  - `setDescriptionScalar` for `"description":`, `'description':`, and `description :`.
- New scenario: a four-row Outline, "Installing a skill whose frontmatter spells its name or description key differently installs it", each row with a `when_to_use`, so that the description is rewritten.

**Red proof:** the six spelling unit rows failed, and all four scenario rows failed with `cascade | error | A plugin operation has failed.`

---

_Fixed: 2026-11-01T14:11:48Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
