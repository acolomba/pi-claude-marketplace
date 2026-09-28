# Requirements Archive: workflows Claude workflows Component-Kind Bridge

**Archived:** 2026-08-16
**Status:** SHIPPED

For current requirements, see `.planning/workstreams/workflows/REQUIREMENTS.md`.

---

# Requirements: pi-claude-marketplace - Milestone workflows Claude workflows Component-Kind Bridge

**Defined:** 2026-08-14
**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artifact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Milestone goal:** A Claude plugin shipping `workflows/` installs its scripts as working Pi commands hosted by `@quintinshaw/pi-dynamic-workflows`, across the full plugin lifecycle, closing the silent-ignore gap that `domain/resolver.ts`'s own closed-list warning (T-02-25) predicted.

**Evidence base:** Every design claim below was measured against shipped code during spikes 021-026 (`.planning/spikes/`, idea key `claude-workflows-bridge`), not inferred from documentation. The findings are packaged in the `spike-findings-pi-claude-marketplace` project skill and auto-load during implementation.

## v1 Requirements

### Component Kind Recognition

<!-- Seams: domain/resolver.ts (SUPPORTED_COMPONENT_KINDS, SUPPORTED_COMPONENT_PATH_KINDS, componentPaths). -->

- [x] **WFLW-01**: A plugin shipping `<pluginRoot>/workflows/` has its workflow scripts recognized as installable components even when its manifest declares no `workflows` field. Convention detection is the load-bearing axis, not a fallback: of 44 sampled repos, 16 are real Claude plugins shipping `workflows/`, and **zero** declare the manifest field (Spike 021). A field-only implementation would find none of them.
- [x] **WFLW-02**: A plugin declaring the `workflows` manifest field (`string | array`, "Custom workflow script files or directories, replaces default `workflows/`") resolves those declared paths as workflow components. Mirror the both-axes structure `collectUnsupportedKinds` already uses -- declared-in-manifest OR convention-on-disk -- on the supported side.
- [x] **WFLW-03** (amended 2026-09-04 for the replay): A workflow-bearing plugin never installs with zero signal.

  **The premise below is no longer true and must not be planned against.** It states that `workflows` sits in neither closed list. PR #154 (2026-08-29) put it in `UNSUPPORTED_COMPONENT_KINDS`, so on the replay target such a plugin already gets a degradation, a reason token and a count -- the zero-signal gap is closed, by the opposite mechanism to the one this requirement proposed.

  What survives is the obligation, not the diagnosis: the replay moves `workflows` to the supported side (WINV-01) and must keep a signal while changing which one. A plugin that installs its workflows silently would newly satisfy the old letter and break the intent.

  Original text, kept for the record: "`workflows` currently sits in neither `SUPPORTED_COMPONENT_KINDS` nor `UNSUPPORTED_COMPONENT_KINDS`, so today such a plugin gets no degradation, no reason token, and no count -- unlike `monitors`/`themes`, which correctly demote to `partially-available`. Joining the supported list closes this by construction."

- [x] **WFLW-04**: The resolver exposes a `componentPaths.workflows` member so consumers can enumerate a plugin's resolved workflow sources, matching the existing per-kind shape.

### Workflow Artifact

<!-- Seams: bridges/workflows/ (new: discover/stage/unstage/types/index), modeled on bridges/commands/. -->

- [x] **WBRG-01**: Each discovered script installs as a JSON envelope `{name, description, script}` carrying the Claude source verbatim in `script` -- a wrap, not a copied `.js`. `location`, `path`, and `savedAt` are set by the engine on read and may be omitted.
- [x] **WBRG-02**: Discovery scans the workflows directory flat and non-recursively, refuses symlinks per D-14, and dedups first-wins. `bridges/commands/discover.ts` is the analog: same shape with `.md` changed to `.js`. Do **not** model on `bridges/agents/` -- its index-file mutation has no counterpart here.
- [x] **WBRG-03**: A script that cannot be read or staged is reported through the bridge `warnings[]` soft-fail channel without failing the plugin install.
- [x] **WBRG-04**: Installed workflows are discovered by the engine's own `createWorkflowStorage` directory scan, with no engine API call and no index to mutate. A hand-planted envelope was proven discoverable this way (Spike 023).

### Naming

<!-- Seams: domain/name.ts (generatedColonName, reused unchanged); new acorn-based extractor. -->

- [x] **WNAM-01**: The command name comes from the script's exported `meta.name`, extracted by a static acorn AST walk. Claude names a plugin workflow `/<plugin>:<meta.name>` and the filename plays no part. Never a regex: a name-like phrase in a comment or string literal silently wins, real scripts carry long headers (`drafter.workflow.js` declares `meta` at line 26), and a regex misses the double-quoted-key form. Never by evaluation: the script is untrusted third-party code.
- [x] **WNAM-02**: A script whose `meta` declaration has no `name` property, or whose `name` is not a string literal, falls back to the file stem. The value is never evaluated to resolve a non-literal.
- [x] **WNAM-03**: A script with no `meta` declaration is skipped with a warning and not installed.
- [x] **WNAM-04**: An unparseable script (acorn `SyntaxError`) is refused rather than name-scavenged -- it cannot run anyway.
- [x] **WNAM-05**: Two scripts in one plugin resolving to the same name fail the install with an explicit collision error, mirroring `assertNoCommandCollisions` (RN-6). `meta.name` introduces a duplicate axis filenames cannot have.
- [x] **WNAM-06** (amended 2026-09-04 for the replay): Generated names take the `<plugin>:<name>` shape and pass the engine's `isSafeSavedWorkflowName`, including RN-1 prefix elision. No `:`-sanitizing step is added -- colon-bearing basenames are standing policy (`bridges/commands/stage.ts:11`, "Windows is explicitly not targeted").

  **The original wording required the shape come "from `generatedColonName`, reused unchanged". That helper does not exist on the replay target.** The spike extracted it out of `generatedCommandName` so both could call it. On main, `generatedCommandName` instead grew `/`-separated nested command paths and an elision that declines to empty the head (CM-4, D-141-02) -- rules a flat, non-recursive workflow name (WBRG-02) can never exercise. Extracting a shared helper now would push those rules into a caller that cannot produce either shape and would refactor a function main changed recently for its own reasons.

  What the clause was protecting is the joining rule not drifting between commands and workflows. That is now held by a test, not by a shared call: `generatedWorkflowName` mirrors `generatedSkillName`'s structure and its owner test pins the `<plugin>:<elided>` output against the same cases. Re-verified against engine 3.10.1 in Spike 027 using this branch's `domain/name.ts`.

### Paths and Containment

<!-- Seams: persistence/locations.ts (new members + the NFR-10 root amendment). -->

- [x] **WPTH-01**: User-scope workflows install to `~/.pi/workflows/saved/<plugin>:<name>.json`; project-scope to `~/.pi/workflows/projects/<key>/saved/<plugin>:<name>.json`. Both are the engine's canonical paths.
- [x] **WPTH-02**: The deprecated `<cwd>/.pi/workflows/saved/` legacy project path is never written. It is inside our scope root and tempting, but its owner has stopped writing it; if the read is dropped upstream, installed workflows would silently stop resolving.
- [x] **WPTH-03**: The project key `<sanitized-basename>-<sha256(resolve(cwd)).hex[:12]>` is derived locally -- the engine exposes no usable helper -- and matches the engine byte-for-byte. Carry the 14 measured edge cases as a test with **hard-coded expected keys**, so an upstream change fails loudly instead of silently agreeing with a new implementation. Cases include unicode names (which slug to the literal `project`), >48-char truncation leaving a doubled dash (the dash-strip precedes the slice -- order matters), `/`, relative paths, and `..` normalization.
- [x] **WPTH-04**: NFR-10 grows a new writable **root**, not a subdirectory, admitting three paths: both saved dirs and staging. The engine's storage root `~/.pi/workflows/` is a *sibling* of `~/.pi/agent/`, with no env override and no settings knob to relocate it. The `agents/` precedent does not apply -- pi-subagents merely reads a directory already under our scope roots. Writes outside the admitted set are still refused.
- [x] **WPTH-05**: Staging sits adjacent to its target under `~/.pi/workflows/`, so the commit `rename()` never crosses a filesystem boundary. Every existing bridge stages under `<extensionRoot>` and renames into `<scopeRoot>`, which share a filesystem by construction; that guarantee is absent here, since the target is under `$HOME` while a project-scope `extensionRoot` is at `<cwd>/.pi/`. EXDEV was reproduced directly (Spike 025).

### Lifecycle

<!-- Seams: transaction/phase-ledger.ts, orchestrators/plugin/{install,update,uninstall,reinstall,enable-disable}.ts. -->

- [x] **WLIF-01**: Install materializes workflows as a 6th phase of the transactional ledger, and a later phase failure unstages them. Append to the literal `Phase` array in `orchestrators/plugin/install.ts`.
- [x] **WLIF-02**: Update re-stages workflows -- adding, removing, and replacing artifacts to match the new plugin version. `update.ts` is the only other `runPhases` consumer.
- [x] **WLIF-03**: Uninstall removes every workflow artifact it installed, leaving nothing behind outside the scope root. This is load-bearing: the artifacts land outside `<scopeRoot>`, so a lifecycle gap here leaks executable files into `~/.pi/workflows/` with nothing tracking them.
- [x] **WLIF-04**: Reinstall replaces workflow artifacts.
- [x] **WLIF-05**: Disable removes workflow artifacts and enable re-materializes them. `uninstall`/`reinstall`/`enable-disable` compose differently from `runPhases` and must each be checked individually rather than assumed covered by the ledger change.
- [x] **WLIF-06**: When a removed workflow's command lingers for the session, the user is told the reload remedy. Pi has no `unregisterCommand`, so uninstall is asymmetric by host limitation: registration needs `/reload` (NFR-2 satisfied) but deregistration cannot happen at all mid-session.

#### Carried forward from the Phase 103 code review

Findings the Phase 103 review raised that are lifecycle work by definition. They
are recorded here rather than fixed in place, because implementing them inside
the install-only phase would have meant building Phase 104 early. Each names the
requirement it belongs to.

- **CR-02 -> WLIF-03 / WLIF-05.** `cascadeUnstagePlugin`
  (`orchestrators/marketplace/shared.ts`) is the single removal primitive behind
  `uninstall`, `disable` and `marketplace remove`, and it calls five bridges, not
  six. Uninstall therefore orphans envelopes permanently -- they sit outside
  every scope root and `removePluginRecord` deletes the only inventory naming
  them -- and `disable` leaves workflow commands registered and runnable, which
  is the one component kind that executes code. Add the sixth unstage to the
  cascade primitive so all three verbs inherit it.

- **CR-03 -> WLIF-02.** The update ledger reassigns five inventories in place and
  never touches `.workflows`, and no update path calls `prepareStageWorkflows`.
  A workflow bug fix or security fix shipped by a plugin author cannot reach the
  user through `update`, and a workflow withdrawn upstream keeps running. Pass
  `record.resources.workflows` as the previous-name list so renamed and removed
  workflows are cleaned rather than accumulated.

- **WR-01 -> WLIF-02 / WLIF-05.** `previousWorkflowNames` is accepted by
  `prepareStageWorkflows` and supplied by no production caller, so the re-stage
  branch is unreachable and `enable` cannot converge when a re-materialization
  produces a different generated name. Wiring the recorded inventory at the
  ledger is a no-op for a fresh install. The commit path was made safe for that
  arrival in Phase 103 (previous targets are displaced and restored rather than
  unlinked), so this is now a wiring change, not a redesign.

- **WR-06 -> WLIF-02 / WLIF-05, alongside WR-01.** Workflow names never reach
  the PI-6 cross-plugin conflict guard, and the commit `rename()` has no
  already-exists check -- so a user's own hand-saved `acme:ship` is silently
  overwritten. The right guard is the ownership pre-check the other bridges use:
  refuse a target that exists and is not in `_previousNames`. It cannot land
  before WR-01, because with `_previousNames` always empty it would refuse every
  `enable` re-materialization of a plugin's own envelopes. It must therefore land
  in the same change that wires the recorded inventory.

- **WR-10 -> WLIF-03.** The live canary's teardown `rm -rf`s the sandbox HOME
  immediately after `uninstall`, so any envelope the uninstall failed to remove
  is deleted a moment later and the canary passes regardless. It is the only
  automated surface that exercises the real engine's storage layout, and it is
  structurally blind to the removal half of the lifecycle. Assert the saved
  directory holds no `<plugin>:` envelope BETWEEN the uninstall and the `rm`.

### Soft Dependency

<!-- Seams: shared/concerns/soft-dep.ts (DEPENDENCIES), platform/pi-api.ts (probe), shared/notify.ts (REASONS). -->

- [x] **WDEP-01**: The host engine is probed via the quintinshaw-specific `workflow_control` tool, following the RH-3/RH-4 `pi.getAllTools()` pattern. Probing bare `workflow` false-positives on `@nicknisi/pi-workflows`, which registers a tool of that name too.
- [x] **WDEP-02**: With the engine absent, workflow artifacts are still written and the plugin install still succeeds, carrying a degradation reason. Degradation never blocks the install (Core Value); `agents`/pi-subagents is the precedent.
- [x] **WDEP-03**: Installing the engine and running `/reload` makes already-installed workflows work, with no reinstall required. This is what makes WDEP-02's write-anyway choice correct rather than merely harmless.
- [x] **WDEP-04**: `workflows` becomes the third member of `DEPENDENCIES` (currently `["agents", "mcp"]`) with its marker, and the new reason token joins the closed `REASONS` set in `shared/notify.ts`.

### Pre-Validation

- [x] **WVAL-01**: Every script is validated against the engine's own text-level preprocessor **before** the install commits, not after.
- [x] **WVAL-02**: A script rejected by pre-validation is skipped and reported; the remaining workflows and the plugin still install. Whole-plugin failure is wrong here because the engine's `DETERMINISM_BLOCKLIST` is a raw-text regex run before acorn parses and cannot tell code from comment -- a header comment mentioning `Date.now` trips it.
- [x] **WVAL-03**: The rejection names the offending script and the real reason, including when a raw-text match fired on a comment. The engine's own message names a rule the script does not violate; ours must not repeat that.

### Documentation

- [x] **WDOC-01**: Docs state plainly that this is the **first bridge to install executable code** rather than data, name the host engine and why it was chosen on trust grounds, and state which script semantics are guaranteed versus divergent from Claude. Claude's `agent()` resolves to `null` on failure with a documented `pipeline(...)` + `.filter(Boolean)` pattern. The host's failure path is **runtime-measured** on `@nicknisi` (throws) and **source-read** on quintinshaw at 3.5.1 (`agent()` rejects -- every failure branch in `agentImpl` throws), never driven at runtime there because that needs real spawn machinery. The docs must label each evidence grade rather than letting one pass for another. Do not assume a verbatim copy preserves behavior.
  - **Carried in from Phase 102 research (measured against engine 3.5.1, not inferred):** the docs MUST carry the admit-versus-run divergence table. Our pre-validation replicates only `DETERMINISM_BLOCKLIST`, which is the first of **seven** gates in the engine's `parseWorkflowScript`. Six shapes we admit are shapes the engine refuses at invocation: `meta` missing a non-empty `description`, `meta` not the first statement, `export let meta`, a non-exported `const meta`, `export const meta = {...}, other = 1`, and both WNAM-02 stem-fallback arms (no `name` property, non-literal `name`). A template-literal `name` is admitted under a different name than the one the engine resolves. The failure is bounded and visible -- the artifact installs, the command registers, and the engine reports `/<name> failed: <message>` at invocation -- but it is a documented divergence, not a guarantee.
- [x] **WDOC-02**: `docs/output-catalog.md` carries the new reason token and the new rendered states, under the existing byte-equality gate.
- [x] **WDOC-03**: `acorn` (8.16.0) is declared as a runtime dependency -- the fourth, alongside `isomorphic-git` / `proper-lockfile` / `write-file-atomic`. It is present transitively via eslint today but undeclared, and it is the same parser the engine uses for the same job.

## Future Requirements

Tracked but deliberately out of this milestone. Each remains on `.planning/BACKLOG.md`.

- **MIGR-01**: replace field-level backward-compat migration with a `STATE_VALIDATOR.Check()` staleness gate (spikes 001-003 complete, blueprint packaged)
- **PDEP-01**: `claude:plugin info` silently drops version-pinned plugin dependencies (spikes 004-005 complete, blueprint packaged)
- **Progress messages**: `ctx.ui.custom()` + `BorderedLoader` behind a ~1s delay helper for foreground `install`/`update`/`marketplace add` (spikes 006-007 complete, human-verified head-to-head)
- **COV-01**: coverage exclusion policy and the two out-of-bound orchestrators
- **REASON-01**: unify malformed-input failures under a "malformed X" reason family
- **UAT-02**: reconcile cascade invisible on `/reload` (host TUI limitation)
- **WR-12**: update-verb degradation signals

## Out of Scope

| Feature | Reason |
|---------|--------|
| Upstream Claude Code's dependency-resolution engine (auto-install, semver, prune, cascades) | Standing scope decision -- this project's opaque, no-auto-resolution handling of `dependencies` remains intentional and still valid |
| Hosting on `@nicknisi/pi-workflows` | Uses `runInThisContext()` and hands scripts the real `process`, all environment variables, and `process.binding('fs')`/`('spawn_sync')`. Rejected on trust grounds (Spikes 022a/009b) |
| Hosting on the `@wichayutdew` / `@osolmaz` / `@davidorex` family | Declarative YAML/graph DSLs -- cannot host an arbitrary Claude imperative script at all |
| Writing the deprecated `<cwd>/.pi/workflows/saved/` legacy path | Its owner has stopped writing it; depending on a read it may drop would silently break installed workflows |
| Filename-derived command names as the primary mechanism | Misnames every command in a `<name>.workflow.js` plugin, and a dot passes both `assertSafeName` and `isSafeSavedWorkflowName`, so the wrong name installs silently (Spike 026). Survives as the documented fallback only |
| Executing scripts at install time to read metadata | Untrusted third-party code |
| Relocating the engine's storage root | No env override and no settings knob exist; `WorkflowSettings` carries only behavioral keys |
| Fixing the lingering-command asymmetry on uninstall | Pi has no `unregisterCommand`. Not ours to fix; WLIF-06 reports the remedy instead |
| A first-party Pi workflow API | Pi core has none at 0.84.2 (verified against `dist/index.d.ts` and `docs/`). If one ships, revisit -- three extensions already converged on reading `<scopeRoot>/workflows/`, which would dissolve the containment problem entirely |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WFLW-01 | Phase 101 | Complete |
| WFLW-02 | Phase 101 | Complete |
| WFLW-03 | Phase 101 | Complete |
| WFLW-04 | Phase 101 | Complete |
| WNAM-01 | Phase 102 | Complete |
| WNAM-02 | Phase 102 | Complete |
| WNAM-03 | Phase 102 | Complete |
| WNAM-04 | Phase 102 | Complete |
| WNAM-05 | Phase 102 | Complete |
| WNAM-06 | Phase 102 | Complete |
| WVAL-01 | Phase 102 | Complete |
| WVAL-02 | Phase 102 | Complete |
| WVAL-03 | Phase 102 | Complete |
| WDOC-03 | Phase 102 | Complete |
| WBRG-01 | Phase 103 | Complete |
| WBRG-02 | Phase 103 | Complete |
| WBRG-03 | Phase 103 | Complete |
| WBRG-04 | Phase 103 | Complete |
| WPTH-01 | Phase 103 | Complete |
| WPTH-02 | Phase 103 | Complete |
| WPTH-03 | Phase 103 | Complete |
| WPTH-04 | Phase 103 | Complete |
| WPTH-05 | Phase 103 | Complete |
| WLIF-01 | Phase 103 | Complete |
| WLIF-02 | Phase 104 | Complete |
| WLIF-03 | Phase 104 | Complete |
| WLIF-04 | Phase 104 | Complete |
| WLIF-05 | Phase 104 | Complete |
| WLIF-06 | Phase 104 | Complete |
| WDEP-01 | Phase 105 | Complete |
| WDEP-02 | Phase 105 | Complete |
| WDEP-03 | Phase 105 | Complete |
| WDEP-04 | Phase 105 | Complete |
| WDOC-01 | Phase 105 | Complete |
| WDOC-02 | Phase 105 | Complete |

**Coverage:**

- v1 requirements: 35 total
- Mapped to phases: 35 ✓
- Unmapped: 0

Phase distribution: Phase 101 (4), Phase 102 (10), Phase 103 (10), Phase 104 (5), Phase 105 (6).

---

*Requirements defined: 2026-08-14*
*Last updated: 2026-08-14 after roadmap creation (5 phases, 101-105)*
