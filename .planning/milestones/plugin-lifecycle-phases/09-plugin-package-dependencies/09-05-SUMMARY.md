---
phase: 09-plugin-package-dependencies
plan: "05"
subsystem: phase-gate
tags: [gate, npm-run-check, handoff, nfr-5, spawn-rule]

requires:
  - "09-01: the packages ledger phase, the spawn module, and its gates"
  - "09-02: the loopback npm registry stand-in and the install scenarios"
  - "09-03: the D-PL9-03 local-folder note and the update hook"
  - "09-04: the local-folder, refusal, update, and reinstall scenarios"
provides:
  - "Gate evidence: npm run check exits 0 on the combined tree at fb0feda0"
  - "The parent's merge handoff: CHANGELOG line, D-PL9 decision rows, the NFR-5 amendment, backlog dispositions, uncertain choices, residue"
affects: [merge, PROJECT.md, AGENTS.md, CHANGELOG.md, BACKLOG.md, phase-11]

actuals:
  tokens: 9500
  tasks: 2
  commits: 0
plan_head_before: fb0feda02c53bc3057d79defbaf739a3b55cf889
plan_head_after: fb0feda02c53bc3057d79defbaf739a3b55cf889

tech-stack:
  added: []
  patterns: []

key-files:
  created:
    - .planning/phases/09-plugin-package-dependencies/09-05-SUMMARY.md
  modified: []

key-decisions:
  - "No fix was needed: the first full npm run check on the combined tree exited 0, so Task 1 made no commit"
  - "The proposed NFR-5 amendment also qualifies the path-source clause, because a path-source plugin inside a cloned marketplace can run npm"

requirements-completed: [PKD-03]

duration: 5min
completed: 2026-10-27
status: complete
---

# Phase 9 Plan 05: Phase Gate and Merge Handoff Summary

**`npm run check`, run unpiped on the combined tree at `fb0feda0`, exited 0 on its first run: 910 cucumber scenarios passed, and direct coverage merged 293 records. No fix was needed. This SUMMARY holds everything the parent applies at merge: the CHANGELOG line, the D-PL9-01..17 rows with the NFR-5 amendment, the backlog dispositions, 32 uncertain choices, and the residue.**

## Performance

- **Duration:** about 5 min (2026-10-27T05:02:35Z to 05:07Z)
- **Tasks:** 2 of 2
- **Files:** 1 created (this SUMMARY), 0 source files modified

## Task Commits

1. **Task 1: run `npm run check` and fix what it reports.** No commit. The first run exited 0, so there was nothing to fix.
2. **Task 2: audit the phase and write the handoff.** This SUMMARY, committed with STATE.md, ROADMAP.md, and REQUIREMENTS.md in the plan's docs commit.

## Gate evidence

| Field | Value |
| --- | --- |
| Command | `{ npm run check > <scratchpad>/09-05-check.log 2>&1; echo "CHECK_EXIT=$?" >> <scratchpad>/09-05-check.log; }` (not piped, exit code written into the log) |
| CHECK_EXIT | `CHECK_EXIT=0` |
| HEAD | `fb0feda02c53bc3057d79defbaf739a3b55cf889` |
| Node | v26.12.1 |
| npm | 11.20.0 |
| Start state | `git status --porcelain -- extensions test features rule-packs eslint.config.js` printed nothing |
| End state | the same command printed nothing after the run |
| Log | `/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-22442f56d78caa3a-pl-p9-pkgdeps-daec0a/301d64c5-00dc-4469-9c71-a274fd95f316/scratchpad/09-05-check.log` |
| Fix commits | none |
| Flakes | none |

The whole log (22 lines):

```text
> pi-claude-marketplace@0.20.1 check
> npm run --silent check:static && npm run --silent test:unpaired && npm run --silent test:integration && npm run --silent test:cucumber && npm run --silent test:coverage:direct:all

passed typecheck (17.3 s)
passed lint (7.4 s)
passed lint:workflows (0.4 s)
passed fallow (8.2 s)
passed format:check (13.1 s)
passed test:corresponding (6.5 s)
passed check:features (6.1 s)
Installed optional test peers pi-mcp-adapter@5.2.0 pi-subagents@0.74.0 (published by 2026-10-09T19:25:07.280Z) into node_modules/.cache/optional-peers.
ℹ pi-subagents 0.74.0 at .../node_modules/.cache/optional-peers/node_modules/pi-subagents
ℹ pi-subagents 0.74.0 at .../node_modules/.cache/optional-peers/node_modules/pi-subagents
Random order using seed: 78090

16 hooks (16 passed)
910 scenarios (910 passed)
9090 steps (9090 passed)
0m 53.249s (6m 25.682s executing your code)
Merged LCOV: coverage/direct.lcov (293 records)
CHECK_EXIT=0
```

The quiet reporter prints nothing for a passing test file, so the log has no failing test, no coverage shortfall, and no fallow, ESLint, Prettier, or feature-gate finding. The commit of this SUMMARY changes only planning Markdown. So under the local-verification reuse rule, this evidence covers the phase's final commit: `git diff fb0feda0 -- . ':(exclude,glob).planning/**/*.md'` is empty.

## Decision audit

Read-only. Each decision has its implementation. No gap needs code.

| Decision | File or scenario | Evidence |
| --- | --- | --- |
| D-PL9-01 | `orchestrators/plugin/package-install.ts` | Table rows at lines 80 (`bun.lock`), 85 (`npm-shrinkwrap.json`), 86 (`package-lock.json`), 88 (`bun.lockb`, refused). `UNSUPPORTED_LOCKFILES` at line 95 and the yarn/pnpm text at line 97. Scenario Outline "A plugin whose only lockfile is <lockfile> ..." (three rows) |
| D-PL9-02 | `package-install.ts` | Listing fields at lines 100-103 (`dependencies`, `optionalDependencies`, `peerDependencies`, `workspaces`) |
| D-PL9-03 | `package-install.ts` line 266; scenario "A plugin from a local marketplace is installed with a note naming the command to run in its folder" | Note text `... is outside the folders this extension manages, so it was not changed. To install them, run "<command> <args>" in that folder`. Outside-root and symlink (T-09-15) unit cases |
| D-PL9-04 | `package-install.ts` lines 354 (`previous-node_modules`) and 413 (`locations.sourcesStagingDir`) | The park and the two restore cases (09-03) |
| D-PL9-05 | `install-outcome.ts` lines 1527 and 1540-1542 | `workflowsPhase, packagesPhase, statePhase`. The undo case removes a node_modules the phase created |
| D-PL9-06 | `package-install.ts` lines 274-282 and 506 (`target.policy.skipSameRevision`) | Scenario "Reinstalling a plugin whose packages are installed makes no npm request" (with `the npm cache is empty`) |
| D-PL9-07 | `materialize-latest.ts` lines 12, 103, 111 | Two `installUpdatedPackages` calls. Scenario "Updating a plugin installs the packages its new lockfile lists" |
| D-PL9-10 | `eslint.config.js` lines 31-35 and 523 | `PACKAGE_INSTALL_SEAM` BLOCK C zone with the D-PL9-10 message |
| D-PL9-11 | `rule-packs/architecture.json` lines 111-122; `test/architecture/no-shell-out.test.ts` line 149 | `child-process-chokepoint` with four exclusions. "exactly four files may import node:child_process" |
| D-PL9-12, D-PL9-15 | `platform/package-manager.ts` lines 74-79, 161-162, 181 | `timeoutMs`, `killGraceMs`, `env` options. `npm_config_update_notifier: "false"`, `shell: false`, one `createPackageManagerRunner` factory |
| D-PL9-13 | `features/lib/npm-registry.ts` lines 263-267 | `registry=http://<loopback>/`, `update-notifier=false`, `fetch-retries=0`, `logs-max=0`, `loglevel=silent` |
| D-PL9-14 | `shared/notify-reasons.ts`, `shared/notification-types.ts` | `git diff 0483948f -- <both files>` is empty. Notes ride `discoveryWarnings` and the outcome's `notes` |
| D-PL9-16 | `package-install.ts` lines 210 and 215 | `its package.json is not valid JSON`, `its package.json is not a JSON object` |
| D-PL9-17 | `09-02-SPIKE.txt`; scenario "A session start hook of an installed plugin loads the npm package its lockfile lists" | `SPIKE: positive -- SPIKE RESULT: ran from /tmp/pi-cm-features-GHuwb5/project/.pi/pi-claude-marketplace/sources/tools/plugins/pkp -- SPIKE PAYLOADS: []` |

Also: `git diff 0483948f -- shared/notify-reasons.ts shared/notification-types.ts CHANGELOG.md .planning/PROJECT.md .planning/BACKLOG.md AGENTS.md` is empty.

## CHANGELOG line

A sub-bullet for the PR's `[Unreleased]` entry (37 words):

```markdown
  - A plugin with `package.json` and a `package-lock.json`, `npm-shrinkwrap.json`, or `bun.lock` gets its npm or bun packages on install and update, as in Claude Code. A failed or refused package install leaves the plugin installed, with a note.
```

## Decision rows

For `.planning/PROJECT.md` "Key Decisions" (Decision | Rationale | Outcome):

| Decision | Rationale | Outcome |
| --- | --- | --- |
| D-PL9-01: A plugin's package install copies Claude Code 2.1.310's lockfile table in order: `bun.lock` (`bun install --frozen-lockfile --ignore-scripts`), `npm-shrinkwrap.json` and `package-lock.json` (`npm ci --ignore-scripts --workspaces=false --no-audit --no-fund`), `bun.lockb` refused. `yarn.lock` or `pnpm-lock.yaml` alone is refused | Upstream parity. One closed table holds the order as data | Good |
| D-PL9-02: It runs only when `package.json` lists `dependencies`, `optionalDependencies`, `peerDependencies`, or `workspaces` and a table lockfile is present. No recognized lockfile is silent | Upstream. The zero-package lockfile check came with the sanitizer (D-PL9-08, 2026-10-27): a checked lockfile that lists no package runs nothing and says nothing | Good (uncertain choice 1) |
| D-PL9-03: A plugin root outside `<scopeRoot>/pi-claude-marketplace/` (a dir or file marketplace) is never written. Without node_modules, the install notes the folder and the command to run there | NFR-10, plus the Pi capability gap: plugins run in place, not from a per-version cache copy | Good (uncertain choice 3) |
| D-PL9-04: The install runs in a `sources-staging` work dir that receives only `package.json` and the lockfile. node_modules is renamed into the plugin root. A replaced one is parked in the work dir and restored when the move fails | Same filesystem as both clone roots. No plugin `.npmrc` or `bunfig.toml` is read | Good |
| D-PL9-05: `packages` is an install ledger phase between workflows and state. It never throws for a package failure. Its undo removes a node_modules it created | Every `runInstallLedger` caller gets it. A bridge failure never spends the network | Good |
| D-PL9-06: The ledger skips a root that has node_modules. The update hook replaces it when the move changed the commit or the version, and keeps it otherwise | Enable and reinstall of an unchanged copy stay offline. A revision move can bring a new lockfile | Good (uncertain choice 5) |
| D-PL9-07: The shared update runner (`materialize-latest.ts`) runs the package step after a swap that ends `updated` and appends its note to the outcome's notes | update, reinstall, apply catalog moves, and dependency moves share that runner | Good |
| D-PL9-08 (reversed 2026-10-27): Claude Code 2.1.310's lockfile check is ported (`domain/package-lockfile.ts`). Before npm or bun runs, `package.json` and the lockfile are checked: registry packages with a range, tag, or `npm:` alias only; no folder links or bundled copies; exact versions; download links with an integrity hash, off GitHub, GitLab (outside its package API), Bitbucket, and SourceHut, and over http only to npm's own registry; no `overrides` or `patchedDependencies`. A refusal is the note `Skipped installing this plugin's dependencies: <reason>.` and nothing runs. A passing lockfile is rewritten (root `plugin-dependencies` at 0.0.0, install fields only, npm always on `package-lock.json`), and npm runs with `--git=<workDir>/git-is-disabled`. An `"http://` lockfile first runs `npm config get registry` in the work dir with only a `{}` package.json, on a second runner bound to Claude Code's 30-second limit (`uks`); the install keeps 60 seconds | Upstream parity for what reaches npm (PKD-01). PKGDEP-03 narrows to the secret redaction of npm output | Good |
| D-PL9-09: Superseded by D-PL9-14 (no reason token; the note is the warning surface) | | Superseded |
| D-PL9-10: NFR-5 amendment (text below) | A plugin's hooks and MCP servers need their packages. Claude Code installs them at install and update | Good |
| D-PL9-11: Only `platform/git-credential.ts`, `bridges/hooks/dispatch-exec.ts`, `bridges/hooks/async-rewake/registry.ts`, and `platform/package-manager.ts` import `node:child_process`. `test/architecture/no-shell-out.test.ts` enforces it (it also rejects dynamic `import()` and `require`), and so does the rule-pack rule `child-process-chokepoint`. Only `orchestrators/plugin/package-install.ts` imports `platform/package-manager.ts` (`eslint.config.js` BLOCK C zone) | Corrected list: `exec-timer.ts` and `ring-buffer.ts` only name `child_process` in comments | Good |
| D-PL9-12: `platform/package-manager.ts` exports one runner factory that takes the launcher, timeout, kill grace, environment, and the host (platform, Node binary, file probe, group signal). The runner never rejects. `package-install.ts` binds the real launcher once | Dependency injection. No parameter defaults to a live boundary | Good |
| D-PL9-13: Scenarios run the real npm against a loopback registry stand-in. The sandbox `~/.npmrc` pins the registry with `update-notifier=false`, `fetch-retries=0`, `logs-max=0`, `loglevel=silent` | No scenario reaches the public registry. The failure note is deterministic | Good |
| D-PL9-14: A package note rides `discoveryWarnings` (install ledger) and the updated outcome's `notes` and `packageNote` (update runner); apply prints it as a post-commit warning and a dependency move puts it on the moved row's cause line. No new Reason member (backlog PKGDEP-04) | A Reason member reaches files that Phases 1 and 3 own | Good (uncertain choice 6) |
| D-PL9-15: The spawn passes the argv verbatim, adds `npm_config_update_notifier=false`, never spawns synchronously, and takes the command as a parameter | The state lock's refresh needs the event loop. No banner in notes. `sonarjs/no-os-command-from-path` | Good |
| D-PL9-16: An unparseable `package.json` gets the note "its package.json is not valid JSON". A non-object gets "its package.json is not a JSON object" | Claude Code's texts. Fail visibly, never block | Good |
| D-PL9-18 (2026-10-27): On Windows a package manager is looked up only in the absolute PATH entries (never the current directory), `.exe` before `.cmd` in each directory. An `.exe` starts directly; `npm.cmd` becomes `<Node binary> <npm.cmd folder>\node_modules\npm\bin\npm-cli.js <args>`; every launch has `shell: false`. A `bun.cmd`, an `npm.cmd` without `npm-cli.js`, and a missing command become the failure note. Other platforms are unchanged | Pi capability gap: Node refuses to spawn a `.cmd` without a shell, so the npm entry route replaces upstream's execa/cross-spawn shell route | Good |
| D-PL9-19 (2026-10-27): A package manager that outlives the timeout is stopped with its whole process tree: POSIX starts it detached and signals its process group (SIGTERM, then SIGKILL), falling back to the process alone when the group signal throws or the pid is below 2; Windows runs `<SystemRoot>\System32\taskkill.exe /PID <pid> /T /F` at both steps. The run never rejects and still settles one grace after SIGKILL | Closes the process-group residue of 09-REVIEW WR-01, so the 60-second limit holds (PKD-02) | Good |
| D-PL9-17: The proof that a plugin finds its modules is a scenario where a session start hook of the installed plugin `require`s the npm package its lockfile lists and writes what it exports to a project file | The spike was positive: `SPIKE: positive -- SPIKE RESULT: ran from .../.pi/pi-claude-marketplace/sources/tools/plugins/pkp -- SPIKE PAYLOADS: []`. The hook runs from the plugin root, so Node resolves the package from its node_modules | Good |
| D-PL9-20 (2026-10-27): A failed, timed-out, or refused package install stays an install-time warning shown with the plugin's row (the D-PL9-14 note) | The user kept uncertain choice 2. Pi has no log that the user reads, so the install note is the only place where the user learns of the failure until PKGDEP-02's load diagnostic | Good |
| D-PL9-21 (2026-10-27): `marketplace update` with autoupdate on shows an updated plugin's package note as `/claude:plugin update` does: a warning diagnostic `Plugin "<name>" updated; 1 declared component has a note.` after the cascade rows and before the MCP config notices. Only the package note | The cascade dropped it (uncertain choice 34). WRN-02 owns the other notes of the cascade and replaces this call with its shared placement | Good (uncertain choices 62, 63) |
| D-PL9-22 (2026-10-27): Uninstall, with its `--prune` members, `prune`, and apply's uninstall step, removes the node_modules that the package step wrote into a plugin folder inside `<scopeRoot>/pi-claude-marketplace/`, unless another installed plugin of the scope runs from that folder. The step writes the marker `node_modules/.pi-claude-marketplace` before its rename. Only a marked node_modules with no symlink on the way is removed: it is moved into `sources-staging` and deleted there, after the state save and best effort | A kept clone's old node_modules made the next install skip the step (WR-03). A node_modules from git or from the user has no marker, so it stays (NFR-10, D-PL9-03) | Good (uncertain choices 57-61, 65) |

### D-PL9-10: NFR-5 amendment text

Change the Network policy heading in both files to end "... by AAP-D1, and by D-PL9-10". Note that `.planning/PROJECT.md` line 1305 still reads "amended by url-source, by D-03-03, and by D-MF-04", although its body already cites AAP-D1, while `AGENTS.md` line 58 lists AAP-D1. Add this sentence before the last sentence:

```text
An operation that materializes a plugin through the install ledger or the shared update runner (install, update,
reinstall, enable, import, apply, and the dependency installs and moves they cascade into) may run that plugin's own
package manager, which reaches the plugin's package registry, when the plugin root lies inside
<scopeRoot>/pi-claude-marketplace/, ships package.json listing dependencies with a supported lockfile, and has no
node_modules; an update to a new revision always runs it (D-PL9-10).
```

Then replace the last sentence ("`list`, `info`, `uninstall`, `marketplace remove`, and path-source operations MUST NOT touch the network") with:

```text
`list`, `info`, `uninstall`, `marketplace remove`, and a load without `autoapply` MUST NOT touch the network. A
path-source plugin reaches the network only through the package install above, and only when its root lies inside a
cloned marketplace (D-PL9-10).
```

The second change is new in this SUMMARY (uncertain choice 32). A path-source plugin of a git or url marketplace lives under `<scopeRoot>/pi-claude-marketplace/sources/`, so the package install runs npm for it. The 09-02 scenarios prove this: the spike plugin ran from `sources/tools/plugins/pkp`. The old clause "path-source operations MUST NOT touch the network" would then be false. A plugin of a directory marketplace stays network-free (D-PL9-03 note, scenario "A plugin from a local marketplace ...").

### D-PL9-11: spawn rule text

For the constraint list or the Conventions section:

```text
Only four files import node:child_process: platform/git-credential.ts, bridges/hooks/dispatch-exec.ts,
bridges/hooks/async-rewake/registry.ts, and platform/package-manager.ts (D-21, D-PL9-11). The rule-pack rule
child-process-chokepoint and test/architecture/no-shell-out.test.ts (which also rejects dynamic import() and require)
enforce it. Only orchestrators/plugin/package-install.ts imports platform/package-manager.ts (eslint.config.js BLOCK C,
D-PL9-10).
```

## Backlog dispositions

- **PKGDEP-01: closed by this phase.** Commits: `f5ddedc8` feat(plugin): install a plugin's own npm or bun packages; `7e44cb66` feat(plugin): skip package installs that Claude Code refuses; `9eee85ff` test(features): prove plugin package installs end to end; `caf36f6b` test(features): prove a plugin hook loads its npm package; `ac0c892d` feat(plugin): note the package install a local plugin folder needs; `8a7b2348` feat(plugin): install the packages of an updated plugin; `f5d7880c` test(features): cover package notes for local folders and lockfiles; `949ff8c6` test(features): cover package installs on update and reinstall. The session-start rerun on a fresh machine moves to PKGDEP-02.
- **PKGDEP-02 (new):** the load-time "packages not installed" / "packages refused" diagnostic, and `update` retrying the package install of an up-to-date plugin, as Claude Code 2.1.310 does (texts in the 09-CONTEXT.md upstream evidence). Seams: `orchestrators/reconcile/load.ts` and the up-to-date path of `update-flow.ts`.
- **PKGDEP-03 (new, narrowed 2026-10-27):** Claude Code's secret redaction of npm output (T-09-10). The lockfile-content sanitizer it also named landed in `40c4963b` feat(plugin): check a plugin's lockfile before installing its packages (D-PL9-08 reversed).
- **PKGDEP-05 (new):** uninstall removes the plugin's node_modules from a clone it keeps, so a later install of a new lockfile does not skip the package step (review WR-03). Closed by quick task 261027-b8d (D-PL9-22), commit `b3320aa2`.
- **PKGDEP-04 (new):** a closed-set row reason for a package install that did not happen, on the install, update, enable, reconcile, and reinstall rows (the composer fan-out in 09-RESEARCH.md section 7).

## Uncertain choices (for user review)

32 items here, 33-38 in the review addendum, 39-56 from quick task 261027-95p, and 57-65 from quick task 261027-b8d. Items 1-7 are CONTEXT's. Items 8-12 are the planner's. Items 13-31 come from the 09-01..09-04 SUMMARYs. Item 32 is new in this plan.

1. **No-lockfile is silent (D-PL9-02).** Upstream and PKGDEP-01 skip a `package.json` with no recognized lockfile silently. The warning applies to refused lockfiles only. Alternative: warn on `package.json` with no lockfile.
2. **Warning at install time (D-PL9-09, now D-PL9-14).** Upstream only logs at install and tells the user at the next load. With no load diagnostic yet (PKGDEP-02), we warn on the install. Alternative: stay silent and build the load diagnostic. Kept: D-PL9-20 (quick task 261027-b8d).
3. **Path-source plugins of a dir or file marketplace are not written (D-PL9-03).** Upstream copies every plugin into its cache, so it always installs. We run them from the user's folder, and NFR-10 forbids writes there, so we note the command. Alternative: amend NFR-10 to allow node_modules in the user's folder.
4. **Sanitizer deferred (D-PL9-08).** A lockfile with `git:` or `file:` dependencies installs here and is refused upstream (PKGDEP-03). Alternative: port it now. Superseded by D-PL9-08 reversed (quick task 261027-95p, `40c4963b`).
5. **Skip when node_modules exists (D-PL9-06).** A stale node_modules after `marketplace update` changes a path-in-clone plugin's lockfile is refreshed only by that plugin's `update`. Alternative: always reinstall.
6. **No row reason token (D-PL9-14).** A failure shows as a warning note, not a `{packages not installed}` reason on the row (PKGDEP-04). Alternative: widen the phase to the reason vocabulary and the row composers.
7. **Files outside the ROADMAP Files line:** `test/architecture/no-shell-out.test.ts` and `gate-targets.ts`. The spawn gate fails without them. The full phase list is under "Files outside the Files line" below.
8. **D-PL9-03 note wording:** `Skipped installing this plugin's dependencies: its folder <root> is outside the folders this extension manages, so it was not changed. To install them, run "<command> <args>" in that folder.` Renderers redact the folder to its basename (NFR-9).
9. **Timeout detail `timed out after 60 seconds` (A7).** Our own text. Upstream's text for this case was not confirmed.
10. **npm output is trimmed before the note** (`stderr.trim() || stdout.trim() || error.message`). Claude Code uses it untrimmed.
11. **The 32 MB cap, the regular-file check (symlinks refused), and `BUN_INSTALL_CACHE_DIR` in the work dir.** Copied from Claude Code 2.1.310. CONTEXT does not name them.
12. **ROADMAP success criterion 2 (handoff item for the parent).** It says a "lockfile-less" package install leaves the plugin installed with a warning. D-PL9-02 keeps a missing lockfile silent, as Claude Code does, so this phase reads "lockfile-less" as "refused lockfile" (`bun.lockb`, `yarn.lock`, `pnpm-lock.yaml`). The parent edits ROADMAP Phase 9 criterion 2 to read "refused" instead of "lockfile-less", or overrules D-PL9-02.
13. **`install-flow.test.ts` census row (09-01).** The phase order change required one new row, `before:packages skills=empty commands=empty agents=empty`, in a file outside files_modified. The commit hook fails without it.
14. **`PACKAGE_INSTALL_SEAM` is a string constant, not an array (09-01).** The zone's `target` extglob names the basename directly.
15. **`newWorkDirName: randomUUID` is passed directly, not wrapped (09-01).** A wrapper would be a function no test calls.
16. **Requirements ticking.** 09-01 and 09-02 did not tick PKD-01 or PKD-02, and 09-02 listed `requirements-completed: []`. 09-03 and 09-04 ticked PKD-01 and PKD-02 after the update half landed. This plan ticks PKD-03, because the gate is green and the decision IDs are in this handoff. The parent may hold PKD-03 open until it copies the rows into PROJECT.md.
17. **Windows (09-01, RESEARCH A1).** `npm` is `npm.cmd` there, and Node refuses to spawn it without a shell, so a package install on Windows always becomes a failure note. Superseded by D-PL9-18 (quick task 261027-95p, `9ffd4e7b`).
18. **A missing plugin root is a quiet skip, an unlistable root is a skip note, and a failed work-dir removal is ignored (09-01 key decisions).**
19. **Small comment edits beyond the count change (09-01).** `install-outcome.ts` "an 8-element", and the BLOCK C header in `eslint.config.js` ("The next four", plus one sentence on PACKAGE_INSTALL_SEAM).
20. **`the npm registry receives no request` moved to a later commit (09-02).** The feature gate fails on an unused step, so it landed with the scenario that uses it.
21. **The failure scenario's `needs reload` cell is `false` (09-02),** as the payload carries it.
22. **The hook scenario has no `the session reports these results:` step (09-02).** The session reported no payload, as in the spike.
23. **09-02 shape choices.** `world.ts` imports `NpmRegistry` and `npmConfigText` as values (the plan said type imports). `pluginPackageFiles` returns a `Record`, not a named interface. `arm(name, status)` fails for a package the registry does not serve. `features/lib/installation-record.ts` was not created and `git-source.steps.ts` was not touched, although both were in files_modified (fallow found no clone to share).
24. **`update-flow.test.ts` second warning (09-03).** "a post-commit clone cleanup failure preserves the successful update" makes `plugin-clones/` unreadable. The update hook then reports a skip note (`EACCES ... scandir`), so the test now expects two notifications, the second a warning. A file outside files_modified.
25. **Replace detection from the listing, not from ENOENT (09-03).** `replacesNodeModules` comes from the detection's directory listing. A park error, an ENOENT race included, becomes the RUNERR note.
26. **The restore in the package-manager-wrote-none case is not best effort (09-03).** A failed restore there becomes the RUNERR note.
27. **The symlink case is titled `T-09-15: ...` (09-03),** after the threat it pins.
28. **A non-`updated` outcome, and an `updated` outcome with no note, are returned as the same object (09-03).**
29. **`the npm cache is empty` step in the reinstall scenario (09-04).** Without it, a forced `npm ci` installs from the cache the install filled and makes no request, so the scenario did not fail with the force rule removed. The step sits in `packages.steps.ts`, not `npm-registry.steps.ts`.
30. **09-04 scenario choices.** The refusal step's lockfile text is fixed prose. The update scenario states only the npm request log, not the git host requests. The new tables are aligned on their own widths.
31. **The outside-root npm and bun cases are one data-driven loop (09-03),** two `test()` rows.
32. **The NFR-5 amendment also rewrites the path-source clause (this plan).** See "D-PL9-10: NFR-5 amendment text". The planner's draft kept "path-source operations MUST NOT touch the network" implied. That clause is false for a path-source plugin in a cloned marketplace. Alternative: keep the clause and skip the package install for every path-source plugin, which breaks the 09-02 scenarios and upstream parity.

### Files outside the Files line (whole phase)

The ROADMAP Files line names: the new platform module (`platform/package-manager.ts`), the new install-phase module (`orchestrators/plugin/package-install.ts`), `install-outcome.ts` (ledger array only), `materialize-latest.ts` (update hook only), `shared/notify-reasons.ts`, `rule-packs/architecture.json`, and `eslint.config.js`. `shared/notify-reasons.ts` was not changed (D-PL9-14). The phase also changed these files:

| File | Reason |
| --- | --- |
| `test/platform/package-manager.test.ts`, `test/orchestrators/plugin/package-install.test.ts` | The paired tests of the two new modules. Pairing and 100% direct coverage require them |
| `test/orchestrators/plugin/install-outcome.test.ts`, `test/orchestrators/plugin/materialize-latest.test.ts` | The paired tests of the two changed modules |
| `test/architecture/no-shell-out.test.ts`, `test/architecture/gate-targets.ts` | The spawn whitelist. It fails with a fourth `child_process` importer (D-PL9-11) |
| `test/orchestrators/plugin/install-flow.test.ts` | One census row for the new phase (09-01; outside that plan's files_modified too) |
| `test/orchestrators/plugin/update-flow.test.ts` | One notification count (09-03; outside that plan's files_modified too) |
| `features/lib/npm-registry.ts`, `features/support/npm-registry.ts`, `features/support/world.ts`, `features/lib/published-marketplace.ts`, `features/step_definitions/npm-registry.steps.ts`, `features/step_definitions/plugin/packages.steps.ts`, `features/plugin/package-dependencies.feature` | The behavioral tests that AGENTS.md requires for a visible `/claude:plugin` change |

This plan changed no file outside its files_modified.

## Deferred follow-ups

Known residue for the parent (Phase 11, LCDOC-01). This phase may not edit these files:

- "exactly three" `child_process` comments are now wrong, because there are four: `platform/git-credential.ts` (line 9), `bridges/hooks/dispatch-exec.ts` (lines 43 and 49), `bridges/hooks/async-rewake/registry.ts` (line 9), `bridges/hooks/exec-timer.ts` (lines 19-20).
- `.planning/codebase/INTEGRATIONS.md` line 17 says "one of exactly three files". STACK.md and CONVENTIONS.md count the rule pack's rules (now 12, with `child-process-chokepoint`). ARCHITECTURE.md describes a seven-phase install ledger (now eight).
- README and docs say nothing about plugin package installs yet.
- `enable` shows no discovery warnings until Phase 1's WRN-01 lands, and the notes of install-cascade members are not shown (Phase 1 WRN-02). So on those paths a package note reaches only orchestrated callers.
- Windows: Node refuses to spawn `npm.cmd` without a shell, so a package install there becomes a note (A1). Resolved by D-PL9-18 (`9ffd4e7b`).
- A failure after the ledger returns (a later cascade member, or the outer state save) does not undo a node_modules that the packages phase created. It stays in the clone, untracked and harmless, and the next install skips it.
- A plugin whose skill directory is its root copies node_modules on re-materialization (skills bridge copy). Rare.
- The package step runs inside the install ledger's state lock for up to about 65 seconds, so a concurrent command in the same scope meets `{lock held}` meanwhile (D-PL9-05 accepts it).
- `.planning/PROJECT.md` line 1305's Network policy heading omits "and by AAP-D1" although its body cites AAP-D1 (see the D-PL9-10 amendment text).
- `.planning/codebase/ARCHITECTURE.md` lists the plugin modules that marketplace code reaches (leaf composers, `orchestrators/types.ts`, the `pluginUpdate` seam). `orchestrators/marketplace/update.ts` now also imports `surfaceDiscoveryWarnings` from `orchestrators/plugin/shared.ts` (D-PL9-21, quick task 261027-b8d), so that list is incomplete.
- `docs/output-catalog.md` has no entry for the package-note diagnostic that `marketplace update` with autoupdate now sends after its cascade rows (D-PL9-21, quick task 261027-b8d).

Task 1 recorded nothing: the gate was green on its first run.

## Deviations from Plan

None in the source tree. The plan said to commit the SUMMARY through the plan's normal SUMMARY commit. The orchestrator forbids `gsd-tools query commit` (it passes `--no-verify`), so the SUMMARY, STATE.md, ROADMAP.md, and REQUIREMENTS.md are committed with `git commit -F <message file> -- <paths>`.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Final disposition of the phase register:

| Threat | Disposition | Final state |
| --- | --- | --- |
| T-09-01 | mitigate | Every runnable row carries `--ignore-scripts` (package-install.ts lines 56 and 61) |
| T-09-02 | mitigate | The work dir holds only package.json and the lockfile; a unit case pins it |
| T-09-03 | mitigate | `shell: false`, argv from the closed table, command as a parameter (package-manager.ts line 162) |
| T-09-04 | mitigate | 60 s timeout, SIGTERM then SIGKILL after 5 s, asynchronous spawn |
| T-09-05 | mitigate | `assertPathInside(locations.extensionRoot, pluginRoot)` gates the run; undo removes only what it created |
| T-09-06 | mitigate | lstat regular-file check and the 32 MB cap |
| T-09-07 | mitigate | Notes cut to 500 characters and rendered through `redactAbsolutePaths` |
| T-09-08 | mitigate | Sanitizer ported (D-PL9-08 reversed, `domain/package-lockfile.ts`, `40c4963b`); npm runs with git disabled |
| T-09-09 | mitigate | `no-shell-out.test.ts` four-file whitelist, `child-process-chokepoint`, the BLOCK C zone; all green in the gate run |
| T-09-10 | accept | No port of Claude Code's secret redactor (PKGDEP-03); notes capped and local |
| T-09-11 | accept | The `finally` removes the work dir; a failed removal only costs disk |
| T-09-12 | mitigate | The package-file step requires the loopback stand-in, which writes the sandbox `.npmrc` first |
| T-09-13 | mitigate | 127.0.0.1 port 0; the world release closes connections and removes `.npmrc` |
| T-09-14 | mitigate | Spike files removed by a `trap`; only the uncommitted `09-02-SPIKE.txt` line remains, by design |
| T-09-15 | mitigate | Any `assertPathInside` rejection means no write and the D-PL9-03 note; the symlink case pins it |
| T-09-16 | mitigate | Park and restore; two restore cases |
| T-09-17 | mitigate | The park lives in the work dir (`previous-node_modules`) |
| T-09-18 | mitigate | `redactAbsolutePaths` shows the basename |
| T-09-19 | accept | The update hook runs after the rename-based swap; the worst case is a failure note |
| T-09-20 | mitigate | `writePublishedPluginFiles` refuses paths outside the publication; the lockfile step accepts three names only |
| T-09-21 | mitigate | Every RED edit was restored; `git diff --quiet -- extensions` before each commit |
| T-09-22 | mitigate | This plan made no fix, so it added no suppression marker, lowered no threshold, and skipped no test |
| T-09-23 | mitigate | The exit code was written into the log and read back (`CHECK_EXIT=0`), and the log body was read |
| T-09-24 | mitigate | Every scenario that can spawn npm starts the loopback stand-in first; dir-marketplace scenarios spawn nothing |
| T-09-SC | accept | No plan of the phase added a dependency (`package.json` and `package-lock.json` unchanged since 0483948f) |

## Addendum: code review fixes

The code review (`09-REVIEW.md`, disposition in `09-REVIEW-DISPOSITION.md`) found two blockers and five warnings. Six were fixed in a5ec61b8..adb28310; `npm run check` exited 0 at adb28310 (912 scenarios). D-PL9-06 and D-PL9-14 above carry the fixed behavior.

### New uncertain choices (33-38; total 38)

33. **A dependency move's package note rides the row's cause line (CR-02).** It reads `cause: <range disclosure> -> <note>` and raises the row to warning. A separate field would need `notification-types.ts`, which this phase may not edit.
34. **`marketplace update` with autoupdate still drops the note.** Its rows render through `orchestrators/marketplace/update.messaging.ts`, outside the fix's functions. Follow-up. Resolved by D-PL9-21 (quick task 261027-b8d, `93e5cd3c`).
35. **The D-PL9-03 note names the marketplace, not the plugin's folder (WR-02).** It now reads `its folder in the marketplace "<name>" is outside the folders this extension manages ...`, so redaction leaves it whole. A relative path would need the marketplace root at both callers.
36. **The failure note compacts npm output (WR-04).** It strips ANSI and control characters, drops `npm warn` lines when anything else printed, strips `npm error` / `npm ERR!` prefixes, and joins lines with "; " before the 500-character cut. Claude Code logs the raw text.
37. **No process-group kill (WR-01).** The run settles one grace after SIGKILL, but a grandchild holding the pipes can keep running. Superseded by D-PL9-19 (quick task 261027-95p).
38. **WR-03 not fixed.** Uninstall keeps node_modules in a kept clone, so a later install skips the step (PKGDEP-05). Resolved by D-PL9-22 (quick task 261027-b8d, `b3320aa2`).

### Quick task 261027-95p (39-56; total 56)

The user reversed D-PL9-08 and decided D-PL9-18 and D-PL9-19 on 2026-10-27. These are the choices that work made.

39. **The registry query is ported, not "refuse every http link".** The sandbox and real local registries (Verdaccio) use http, so `npm config get registry` runs in the work dir when the lockfile holds `"http://`, and an http link passes only on that origin.
40. **The registry query has Claude Code's 30-second limit (`uks`), the install keeps 60 seconds.** `PackageInstallOps` carries a second injected runner, `runRegistryQuery`, which `DEFAULT_PACKAGE_INSTALL_OPS` binds with `timeoutMs: 30_000`. A query that fails, times out, or answers anything but an http URL leaves the origin undefined, so every http link is refused.
41. **The sanitizer runs only for a contained plugin.** The D-PL9-03 note for a plugin outside the extension root reads no lockfile, so a local-folder plugin is not checked.
42. **bun's format refusal says "this extension".** Upstream says "this version of Claude Code".
43. **Hostname reading.** One trailing `.` is dropped, then every leading `www.` (upstream `Pst`'s trailing-dot handling was not confirmed).
44. **The 120-character cut and the exact-version check.** `cut(x)` is the first 120 characters (upstream's `Ve(x,120)` may add an ellipsis). `semver.parse(v) !== null` is the exact-version test.
45. **Rewritten files are two-space JSON with a trailing newline.** Upstream's serializer `_()` was not decoded.
46. **No byte-order mark is stripped.** Upstream wraps both texts in `No()` before parsing, which may strip a BOM; this port parses the text as read, so a lockfile with a BOM is "not valid JSON". Resolved: the mark is stripped as upstream strips it. One leading U+FEFF is removed from package.json, package-lock.json / npm-shrinkwrap.json, and bun.lock before parsing (`shared/bom.ts` `stripBom`, which is Claude Code's `No`). Two marks are still "not valid JSON" (quick task 261027-b8d).
47. **The tarball spec pattern is copied as is.** `/\.(?:tgz|tar.gz|tar)$/i` keeps upstream's unescaped middle dot, so `x.tar-gz` is refused as a tarball too.
48. **Names are lowered A-Z only before the name patterns.** A full `toLowerCase()` would turn some non-ASCII letters (the Kelvin sign) into ASCII ones the patterns accept.
49. **The registry query runs npm for a bun lockfile too,** as upstream does, because the http rule is about npm's saved token.
50. **Windows looks for `.exe` and `.cmd` only** (no PATHEXT, `.com`, or `.bat`). `bun.cmd`, and shims with no `npm-cli.js` beside them (Scoop), fail with a note. A root-relative entry such as `\tools` counts as absolute (`path.win32.isAbsolute`).
51. **POSIX keeps the bare-name spawn.** Only win32 resolves PATH; Linux and macOS spawn `npm`/`bun` as before and probe no file.
52. **No Windows scenario.** cucumber runs on Linux, where nothing changes. Unit cases drive a win32 host with a recording file probe.
53. **No process-tree scenario (handoff item for the parent: Phase 10 harness).** The 60-second constant and the run-wide Pi environment leave no harness knob (no per-scenario PATH, no timeout override), and a production env variable would be a test-only seam. A real process tree in `test/platform/package-manager.test.ts` proves it instead (RED: stdout held `late`). The parent carries a Phase 10 harness item: a knob that shortens the 60-second timeout for a scenario, so a cucumber scenario can prove the tree kill end to end.
54. **The group kill falls back on any throw, not only ESRCH,** and the pid must be a safe integer above 1; otherwise only the process is signalled.
55. **Windows is not detached** (a detached process would open its own console window); `taskkill /T /F` runs at both steps, from `<SystemRoot>\System32` (the env variable read in any case, default `C:\Windows`), with the run's cwd and env, `shell: false`, and an error listener. A taskkill that cannot start leaves the run to the WR-01 deadline.
56. **A detached npm can outlive a Pi that was killed hard,** until its pipes to Pi break and it exits; its work dir lives under `sources-staging`, and the next run uses a fresh one.

### Quick task 261027-b8d (57-65; total 65)

The user and the parent decided D-PL9-20..22 and the byte-order mark on 2026-10-27. These are the choices that the work made.

57. **How uninstall knows that the step wrote node_modules (D-PL9-22).** The step writes `node_modules/.pi-claude-marketplace` into the work dir's tree before the rename, so the marker moves in with the tree. Uninstall removes only a node_modules that holds the marker as a regular file. Two other rules were rejected. "The work-dir rename is the only writer inside the extension root" is false for a git clone that tracks a vendored node_modules: removing it would delete tracked files and break a plugin that ships no lockfile. A field in the state record needs a schema change, and the rename cannot write it at the same moment as the tree.
58. **A marker write that fails is ignored.** The tree then moves in without a marker, and uninstall keeps it, so that one plugin keeps WR-03's old behavior. A work dir with no node_modules fails the write in the same way, and the existing "nothing to move" arm then runs.
59. **A shared folder stays.** Uninstall keeps node_modules while another installed plugin of the scope runs from the same folder: two marketplaces that list one git plugin share its clone. The check reads the state that the uninstall saved, outside the lock, as the clone GC does. Lock discipline for post-commit cleanups belongs to Phase 7.
60. **The removal moves node_modules into `sources-staging` before it deletes it.** The folder keeps all of its node_modules or none. A failed delete leaves the copy under `sources-staging`, which costs disk only, like a leftover work dir. A failed move is only debug-logged (D-19-01), so that plugin keeps its node_modules. On Windows, a loaded native module can block the move. The removal takes `Pick<PackageInstallOps, "newWorkDirName">`, so by type it can never start a package manager (NFR-5 for uninstall).
61. **A node_modules written before this change has no marker,** so uninstall keeps it. Only this unreleased branch made such installs.
62. **The autoupdate cascade shows only the package note.** It does not show the outcome's other `notes`, which a direct `/claude:plugin update` also shows. WRN-02 (Phase 1, sibling branch) owns cascade warnings. When it merges, its shared placement must replace this call, or the package note shows twice.
63. **The note is sent from `orchestrators/marketplace/update.ts`,** in `refreshOneMarketplace`, after the cascade rows and before the MCP config notices. It is not sent from `update.messaging.ts`, whose functions map outcomes to rows and cannot send a second notification. `update.messaging.ts` is unchanged, which Phase 1 also edits. `update.ts` now imports `surfaceDiscoveryWarnings` from `orchestrators/plugin/shared.ts`. That module is not a ledger, and update.ts already reached it type-only. ARCHITECTURE.md's list of the plugin modules that marketplace code reaches is now incomplete (Phase 11, LCDOC-01).
64. **Byte-order mark: one mark only.** `shared/bom.ts` `stripBom` is reused (FMBOM-01, T-FMBOM-02). It is the same function as Claude Code's `No`. A file that starts with two marks is still refused as not valid JSON.
65. **The in-use check compares `resolvedSource` strings exactly.** Two records that reach one folder through different spellings of its path (a symlinked parent, a trailing separator) count as two folders, so uninstalling one of them removes the marked node_modules that the other still uses. Every writer of `resolvedSource` stores the resolved plugin root, so the spellings agree in practice. The clone GC also reads `resolvedSource` as stored, with no realpath.

### Further files outside the Files line (review fixes)

| File | Reason |
| --- | --- |
| `extensions/pi-claude-marketplace/orchestrators/types.ts` | `packageNote?` on `PluginUpdateUpdatedOutcome` (CR-02) |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts` | `postCommitWarnings?` on converged and backfilled outcomes, `carriedPackageNote` (CR-02) |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts` | `convergedMoveOutcomes` only (CR-02) |
| `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts` | `grownMoveOutcomes`, `surfacePostCommitWarnings`, `postCommitWarningsOf` (CR-02) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts` | `moveRow`, `withPackageNote` (CR-02) |
| `test/orchestrators/reconcile/{notify,apply,apply-outcomes}.test.ts`, `test/orchestrators/plugin/dependency-move.test.ts` | Paired tests of those sources (100% direct coverage) |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`, `test/orchestrators/marketplace/update.test.ts` | `surfaceCascadePackageNotes`, the autoupdate cascade's package note, and its paired test (D-PL9-21, quick task 261027-b8d) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`, `test/orchestrators/plugin/uninstall.test.ts` | `removeUnusedPackages` in the post-commit cleanup and `pluginRoot` on `PrunedMember` and the cleanup bag, with the paired test (D-PL9-22, quick task 261027-b8d) |
| `extensions/pi-claude-marketplace/domain/package-lockfile.ts`, `test/domain/package-lockfile.test.ts` | One leading byte-order mark stripped before the npm and bun lockfile parse, with the paired test (uncertain choice 46, quick task 261027-b8d) |

### Further follow-ups (review info items)

IN-01 a failed restore deletes the parked node_modules; IN-02 an unlistable root warns for a plugin with no package.json; IN-03 the BLOCK C zone exempts by basename; IN-04 captured output can split multi-byte characters; IN-05 the diagnostic header calls the note a "declared component"; IN-06 a rolled-back cascade leaves members' node_modules; IN-07 the timeout note uses the constant, not the runner's timeout; IN-08 an update that drops its dependencies keeps the old node_modules.

## Self-Check: PASSED

- FOUND: .planning/phases/09-plugin-package-dependencies/09-05-SUMMARY.md
- FOUND: the gate log with `CHECK_EXIT=0`
- FOUND: all eight PKGDEP-01 commits as ancestors of HEAD
- No commit to check for Task 1 (no fix was needed)
