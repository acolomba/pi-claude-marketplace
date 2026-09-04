# Phase 103: Workflow artifact materialization - Research

**Researched:** 2026-08-15
**Domain:** Filesystem materialization of executable artifacts into a third-party
engine's private storage layout, outside the extension's own containment root
**Confidence:** HIGH

## Summary

This phase has an unusually strong evidence base and an unusually small unknown
surface. The host engine `@quintinshaw/pi-dynamic-workflows` is still published
at `3.5.1` (`latest`, last modified 2026-08-05) — the exact version spikes
010–013 measured — so every parity claim carried forward from those spikes was
re-verified this session by unpacking the published tarball and reading
`dist/workflow-paths.js`, `dist/workflow-saved.js`, `dist/fs-persistence.js`
and `dist/saved-commands.js` directly. The path derivation, the directory-scan
semantics, the name/filename equality contract, and the description-fallback
behavior are all confirmed from source rather than inferred.

The work splits into four separable pieces: (1) a pure project-key derivation in
`domain/`, (2) a `ScopedLocations` amendment plus a single injectable
home-directory seam in `platform/`, (3) a `bridges/workflows/` triplet modeled
structurally on `bridges/commands/` but with an inverted staging location, and
(4) two integration edits — a sixth ledger phase in `install.ts` and a name-source
swap in `info.ts`. Only the third and fourth carry real design risk.

Three findings materially change what the planner should write down. First,
**one of the fourteen project-key cases cannot be hard-coded** — `relative/path`
resolves against `process.cwd()`, and the spike README's own recorded value
(`path-c02fff3b6ab2`) differs from what the same code produces today
(`path-710b8d1783c7`), which is the proof rather than a discrepancy. Second,
**`bridgeWarnings` are dropped in standalone install mode** by D-19-01, so
routing WBRG-03's soft-fails there makes them invisible to the plain
`/claude:plugin install` surface. Third, **`stagedAny` gates
`InstallPluginOutcome.resourcesChanged`**, which `orchestrators/import/execute.ts`
consumes as a structural predicate — a workflows-only plugin would report
`resourcesChanged: false` unless the new staged-names array joins that
disjunction.

**Primary recommendation:** Build the key derivation and the locations amendment
first as a standalone plan (they are pure, fully specified, and testable with no
filesystem), then the bridge triplet, then the two integration edits last. Pin
the thirteen deterministic key cases as literals and pin the fourteenth
structurally; do not let a re-derivation into the expectation.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Locations and the new writable root**

- The workflow root is expressed as new **members of `ScopedLocations`**, not a
  standalone module. `persistence/locations.ts` is "the single source of every
  writable path" and its unique-symbol brand is what stops a project-scope path
  being substituted into a user-scope operation — a parallel path module would
  reintroduce exactly the substitution the brand exists to prevent.
  `locationsFor(scope, cwd)` already takes the `cwd` the project key needs.

- The containment chokepoint learns the new root as an **additional admitted
  root**, never as a bypass or an exemption at the call site. A write anywhere
  else — inside `~/.pi/workflows/` but outside the three admitted paths, or
  outside the root entirely — is still refused by `assertPathInside`.

- The root is derived from the engine's own base (`~/.pi/workflows/`) and does
  **not** honor `PI_CODING_AGENT_DIR`. The engine has no env override and no
  settings knob; honoring a variable the engine ignores would write artifacts
  where the engine never looks. Test relocation goes through a single injectable
  seam in the same shape as `platform/pi-api.ts`'s `getAgentDir` re-export —
  one function, one import site — not by threading an env var through.

- Staging is a directory **adjacent to the saved directories under
  `~/.pi/workflows/`**, dot-prefixed so the engine's `saved/`-scoped scan cannot
  see it. This is the EXDEV fix: `<extensionRoot>` staging renames across a
  filesystem boundary when the target is under `$HOME` and a project-scope
  `extensionRoot` is at `<cwd>/.pi/`.

**Bridge surface and soft-fail channel**

- The bridge follows the existing **`prepareStage*` / `commitPrepared*` /
  `unstage*`** triplet unchanged, modeled on `bridges/commands/` — flat
  non-recursive scan, D-14 symlink refusal, first-wins dedup. Not on
  `bridges/agents/`: there is no index to mutate, because the engine's registry
  is a plain directory scan.

- `discover` returns the **full verdict array plus `warnings[]`**, not
  admitted-only. Criterion 7 requires `info` to render admitted `meta.name`s at
  no new I/O cost, and `install` needs the skipped and refused arms to report
  them — one read serves both surfaces.

- **Warning versus error is split by blast radius.** A script that cannot be
  read, parsed, staged, or that pre-validation refuses is a per-file warning and
  the plugin still installs (WBRG-03, WVAL-02). A name collision is a hard
  install failure (WNAM-05) — it is a defect of the set, not of one file, and
  Phase 102 already built `assertNoWorkflowNameCollisions` to throw.

- When `meta.description` is absent or not a string literal, the envelope
  **omits the key** rather than synthesizing a description from the filename or
  the plugin name. A synthesized description is indistinguishable from a real
  one and would hide the divergence; the engine's non-empty-description
  requirement is already carried as divergence #1 on WDOC-01 (Phase 105).

**Project key derivation**

- The key derivation is a **pure function in `domain/`**, consumed by
  `persistence/locations.ts`. It is derivation, not a path bundle, and domain is
  the layer that may not write to disk — which is exactly the property that
  makes it testable against the 14 hard-coded cases without a filesystem.

- The 14 measured edge cases are carried as a test with **hard-coded expected
  keys** (WPTH-03), not as a re-derivation. Re-deriving would agree with any
  future implementation, including a wrong one; hard-coded values fail loudly
  when upstream changes.

- The key's input is the **resolved `cwd`** the scope bundle was built with, so
  the engine's `resolve()` normalization (`..` collapsing, relative paths) is
  reproduced rather than approximated. Note the sanitizer's dash-strip precedes
  the 48-char slice — order matters and one of the 14 cases exists to pin it.

**Ledger position and the `info` name swap**

- Workflows are appended as a **6th materialize phase, after `mcpPhase` and
  before `statePhase`**. Later-phase failure unstages them through the existing
  reverse-order `undo` walk; no new rollback machinery. Appending rather than
  inserting keeps the five proven phase orderings untouched.

- `info`'s `discoverComponentNames` call for workflows (built in Phase 101
  against the file stem) **routes through the new bridge discover**. Reading
  local script sources does not violate NFR-5 — that constraint is about the
  network, and `info` stays offline.

- On `info`, a script whose name cannot be resolved **falls back to the stem for
  display and never throws**. `info` is a read-only surface; a malformed script
  in a plugin must not make the whole plugin unviewable.

### Claude's Discretion

- Exact file split inside `bridges/workflows/` (`discover.ts` / `stage.ts` /
  `unstage.ts` / `types.ts` / `index.ts` versus a tighter grouping), the staging
  directory's exact name, the new `ScopedLocations` member names, and the
  internal ordering of tasks within each plan.

### Deferred Ideas (OUT OF SCOPE)

- Update / uninstall / reinstall / enable-disable coverage → Phase 104
  (WLIF-02..06), including the lingering-command reload remedy.
- The `workflow_control` soft-dep probe, the third `DEPENDENCIES` member, its
  reason token, and write-anyway degradation → Phase 105 (WDEP-01..04).
- The executable-code contract and the admit-versus-run divergence table →
  Phase 105 (WDOC-01, WDOC-02).
- The six structural gates the engine applies that our pre-validation does not
  replicate — carried on WDOC-01, not fixed here (Phase 102 decision).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WBRG-01 | Each discovered script installs as a JSON envelope `{name, description, script}` carrying the Claude source verbatim in `script` — a wrap, not a copied `.js`. `location`, `path`, `savedAt` are set by the engine on read and may be omitted. | Envelope shape verified against `SavedWorkflow` in `dist/workflow-saved.d.ts`; `location`/`path`/`savedAt` confirmed set in `loadFromFile`/`save`. See *Envelope contract*. |
| WBRG-02 | Discovery scans flat and non-recursively, refuses symlinks per D-14, dedups first-wins. `bridges/commands/discover.ts` is the analog with `.md` → `.js`. | `bridges/commands/discover.ts` read in full; the four structural divergences workflows needs are enumerated in *Pattern 2*. |
| WBRG-03 | A script that cannot be read or staged is reported through the bridge `warnings[]` soft-fail channel without failing the plugin install. | Channel exists (`InstallCtx.bridgeWarnings`), but **D-19-01 drops it in standalone mode** — see Pitfall 4. |
| WBRG-04 | Installed workflows are discovered by the engine's own `createWorkflowStorage` directory scan, no engine API call, no index mutated. | `list()` / `listJsonFilesSafe` read from the published tarball; scan is `readdirSync(dir).filter(f => f.endsWith(".json"))` over exactly three directories. See *Pattern 1*. |
| WPTH-01 | User scope → `~/.pi/workflows/saved/<plugin>:<name>.json`; project scope → `~/.pi/workflows/projects/<key>/saved/<plugin>:<name>.json`. | Both verified verbatim from `dist/workflow-paths.js`. |
| WPTH-02 | The deprecated `<cwd>/.pi/workflows/saved/` legacy project path is never written. | Confirmed the engine still *reads* it (`legacySavedDir`, priority 2 of 3). Never writing it is the correct choice and is testable as an absence. |
| WPTH-03 | The project key matches the engine byte-for-byte; carry the 14 measured edge cases with hard-coded expected keys. | All 14 recomputed this session; 13 are hard-codable, 1 is not. See *The 14 project-key cases*. |
| WPTH-04 | NFR-10 grows a new writable **root**, admitting three paths (both saved dirs and staging). Writes outside the admitted set are still refused. | `assertPathInside(parent, child, label)` takes its boundary as an argument — there is no global root registry. The amendment shape is spelled out in *Pattern 3*. |
| WPTH-05 | Staging sits adjacent to its target under `~/.pi/workflows/` so the commit `rename()` never crosses a filesystem. | EXDEV reproduced in spike 025 (`tmpfs` → `xfs`). The staging/commit sequence and its single divergence from every existing bridge is in *Pattern 4*. |
| WLIF-01 | Install materializes workflows as a 6th ledger phase; a later phase failure unstages them. | `phases` literal at `install.ts:1239`; `Phase<C>` contract and the reverse-order undo walk read in `transaction/phase-ledger.ts`. See *Pattern 5* and Pitfall 5. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These are binding on every plan in this phase.

| Constraint | Effect on this phase |
|-----------|---------------------|
| **NFR-1** — all disk mutations atomic (tmp + rename or atomic JSON write) | The envelope commit is `rename()` from adjacent staging; `atomicWriteJson` is **not** the right primitive here (see Pitfall 3). |
| **NFR-3** — every operation safe to retry (idempotent or fail-clean) | Unstage must be ENOENT-tolerant; a partially-committed rename set must reverse-walk. |
| **NFR-5** — `install` / `list` / `info` must not touch the network | `bridges/workflows/` imports no git surface. `info` reading local script bytes is not a network operation. The `no-orchestrator-network` gate scans `install.ts`, `list.ts`, `info.ts` for git tokens — adding a bridge import does not trip it. |
| **NFR-6** — `npm run check` stays green | typecheck + eslint + prettier + `test` + `test:integration`. Note `format:check` covers `**/*.{js,json,ts}` only; markdown is `mdformat`, not prettier. |
| **NFR-7** — discriminated `installable` union | The bridge takes `MaterializablePlugin`, never a raw `ResolvedPlugin`. |
| **NFR-10** — refuse to write outside the admitted roots | This phase *amends* the constraint. The CLAUDE.md text listing `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp.json` must gain the new root in the same change. |
| **IL-2** — all user-visible output via `ctx.ui.notify` through `shared/notify.ts` | The bridge emits no output; it returns `warnings[]` and the orchestrator routes them. ESLint BLOCK A forbids `process.stdout/stderr` writes inside `extensions/`. |
| **Comment policy** (`.claude/rules/typescript-comments.md`) | Cite `WBRG-01`, `WPTH-05`, `D-14`, `NFR-10`. Never `Phase 103`, `Plan NN`, `Wave N`, `Pitfall N`. |
| **Import direction** (ESLint BLOCK C) | `bridges/` may import `domain/`, `persistence/`, `shared/`, `platform/` — **cross-bridge imports forbidden**. `persistence/` may import `domain/`, `shared/`, `platform/`. `domain/` may import only `shared/` and `platform/`. All three edges this phase needs are already legal. |
| **Pi peer chokepoint** (ESLint BLOCK E) | Only `platform/pi-api.ts` may import `@earendil-works/pi-coding-agent`. The workflow-home seam needs no Pi import, so it may live in `platform/` as a plain module. |
| **Never commit to main; worktree commits prefix `SKIP=trufflehog`** | Work stays on `features/workflows-spike` in `.worktrees/workflows-spike`. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Project-key derivation from `cwd` | `domain/` | — | Pure function, no I/O, no writes — the layer's defining property, and what makes the 14 cases testable without a filesystem. |
| Workflow-home base directory resolution | `platform/` | — | Reads `os.homedir()`, an external-system fact. Mirrors `getAgentDir`'s position exactly; also the single point a test relocates. |
| Canonical saved/staging path composition + containment | `persistence/locations.ts` | `shared/path-safety.ts` | `ScopedLocations` is the sole source of writable paths (SC-2/SC-3/SC-7); every name-derived leaf routes through `assertPathInside`. |
| Script discovery + verdict production | `bridges/workflows/discover.ts` | `domain/workflow-script.ts` | The bridge does I/O and dedup; the domain module owns the decision. Discovery consumes verdicts, never re-derives names. |
| Envelope construction + staging write | `bridges/workflows/stage.ts` | — | Bridge layer owns the Claude→Pi artifact translation. |
| Commit (rename) and unstage (unlink) | `bridges/workflows/stage.ts` / `unstage.ts` | — | Uniform triplet so the ledger treats all six kinds symmetrically. |
| Ledger sequencing + rollback | `orchestrators/plugin/install.ts` | `transaction/phase-ledger.ts` | The literal `phases` array is the contract; `runPhases` is untouched. |
| Warning routing to the user | `orchestrators/plugin/install.ts` | `shared/notify.ts` | Bridges never notify (IL-2). |
| Component-name rendering on `info` | `orchestrators/plugin/info.ts` | `bridges/workflows/discover.ts` | Read-only surface; consumes the same verdicts install does. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `acorn` | `^8.16.0` (declared) | AST parse of workflow scripts | Already a runtime dependency (WDOC-03, Phase 102). Consumed only through `domain/workflow-script.ts` — **this phase adds no new acorn import site.** `[VERIFIED: package.json dependencies; tests/architecture/runtime-deps.test.ts]` |
| `node:fs/promises` | built-in | `readdir` / `lstat` / `readFile` / `writeFile` / `rename` / `unlink` / `mkdir` | Every existing bridge uses exactly these. `[VERIFIED: bridges/commands/stage.ts:24]` |
| `node:crypto` | built-in | `createHash("sha256")` for the project key | The engine uses the same call. `[VERIFIED: dist/workflow-paths.js:23]` |
| `node:os` | built-in | `homedir()` for the workflow root | The engine's own base. `[VERIFIED: dist/workflow-paths.js:9,15]` |
| `node:path` | built-in | `resolve` / `basename` / `join` | Order-sensitive: `resolve` before `basename`. `[VERIFIED: dist/workflow-paths.js:21-22]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `write-file-atomic` (via `shared/atomic-json.ts`) | `^8.0.0` | Atomic JSON write | **Do not use for the envelope.** See Pitfall 3. |
| `node:test` + `node:assert/strict` | built-in | All tests | House standard; no framework install needed. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A local `workflowHomeDir()` seam | Add `@quintinshaw/pi-dynamic-workflows` as a dependency and import `workflowHomeDir` | Rejected: `workflow-paths.js` is a private internal of a 0.x package with no exported contract; a hard dependency on it inverts the soft-dependency model Phase 105 is building, and the package pulls `@earendil-works/pi-coding-agent` transitively. Reimplementation with a pinned parity test is the correct trade. |
| Relocating the root for tests via a module seam | Relocating `process.env.HOME` | `os.homedir()` does follow `$HOME` on POSIX `[VERIFIED: node -e run this session]`, and `tests/e2e/_helpers.ts:116-135` already does exactly this. But `HOME` is process-global and `node --test` runs suites concurrently; `tests/architecture/compat-01-no-expansion.test.ts:63-66` explicitly forbids environment mutation for that reason. Use the seam for unit tests; e2e gets relocation for free. |
| Adding the engine as a `devDependency` to prove WBRG-04 live | Assert the envelope against the verified shape + a vendored scan reimplementation | See Open Question 1 — this is the one genuinely open call. |

**Installation:** No new packages. `npm install` is not part of this phase.

## Package Legitimacy Audit

This phase installs **no** external packages. `acorn@^8.16.0` was declared in
Phase 102 and is pinned by `tests/architecture/runtime-deps.test.ts` (three
clauses: present in `dependencies`, absent from `devDependencies`, lock entry
not marked `dev`). `[VERIFIED: package.json; tests/architecture/runtime-deps.test.ts:39-73]`

| Package | Registry | Role | Verdict | Disposition |
|---------|----------|------|---------|-------------|
| `acorn` | npm | already-declared runtime dep, no new import site | OK | No action |
| `@quintinshaw/pi-dynamic-workflows` | npm `3.5.1` (`latest`, modified 2026-08-05) | Host engine — **not** a dependency; inspected only to verify parity | OK | Not installed. Revisit only if Open Question 1 resolves toward a live test. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```text
  /claude:plugin install <plugin>@<mp>
              │
              ▼
   edge/handlers/plugin/install.ts        (parse --scope, resolve cwd)
              │
              ▼
   orchestrators/plugin/install.ts
     withLockedStateTransaction(scope)
              │
              ├─► domain/resolver.ts ──► resolved.componentPaths.workflows
              │                          (declared field OR conventional
              │                           <pluginRoot>/workflows — Phase 101)
              ▼
     runPhases([ skills, commands, agents, hooks, mcp, WORKFLOWS, state ])
                                                      │
                                                      ▼
                              bridges/workflows/discover.ts
                                 readdir(flat) ──► lstat (D-14 symlink refuse)
                                       │              │
                                       │              ▼
                                       │        readFile(source)
                                       │              │
                                       │              ▼
                                       │   domain/workflow-script.ts
                                       │     admitWorkflowScript(plugin, file, src)
                                       │              │
                                       │      ┌───────┴────────┬──────────┐
                                       │   named       stem-fallback   skipped
                                       │      │              │        / refused
                                       │      └──────┬───────┘            │
                                       │             ▼                    ▼
                                       │      admitted[]            warnings[]
                                       │             │
                                       ▼             ▼
                                   verdicts[]   assertNoWorkflowNameCollisions
                                       │        (THROWS — defect of the SET)
                                       ▼
                              bridges/workflows/stage.ts
                                prepareStageWorkflows
                                  ├─ envelope {name, description?, script}
                                  └─ writeFile ──► ~/.pi/workflows/<staging>/<uuid>/
                                                        │
                                commitPreparedWorkflows │  rename() — SAME FS
                                                        ▼
                       ┌────────────────────────────────┴──────────────────────┐
                  scope=user                                            scope=project
          ~/.pi/workflows/saved/                    ~/.pi/workflows/projects/<key>/saved/
          <plugin>:<name>.json                              <plugin>:<name>.json
                       └────────────────────────────────┬──────────────────────┘
                                                        │
                        (never written: <cwd>/.pi/workflows/saved/ — WPTH-02)
                                                        │
                                                        ▼
                                     @quintinshaw/pi-dynamic-workflows
                                       createWorkflowStorage(cwd).list()
                                         readdirSync(dir).filter(.json)
                                         dedup first-wins by envelope.name
                                         priority: project > legacy > user
                                                        │
                                                        ▼
                                    registerAllSavedWorkflows → /<plugin>:<name>


  /claude:plugin info <plugin>@<mp>          (read-only, offline)
              │
              ▼
   orchestrators/plugin/info.ts
     composeResolvedComponents(pluginRoot, resolved)
              │
              ├─ skills / commands / agents ──► discoverComponentNames (dir entries)
              └─ workflows ─────────────────► bridges/workflows/discover.ts
                                                (SAME read as install; renders
                                                 admitted meta.name, stem on
                                                 failure, NEVER throws)
```

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── domain/
│   ├── workflow-script.ts        # Phase 102 — consumed unchanged
│   └── workflow-project-key.ts   # NEW: pure key derivation
├── platform/
│   └── workflow-home.ts          # NEW: the single relocatable seam
├── persistence/
│   └── locations.ts              # AMENDED: new members + one chokepoint method
├── bridges/
│   └── workflows/                # NEW
│       ├── types.ts
│       ├── discover.ts
│       ├── stage.ts
│       ├── unstage.ts
│       └── index.ts              # barrel; underscore fields NOT re-exported
├── orchestrators/plugin/
│   ├── install.ts                # AMENDED: workflowsPhase + stagedAny + ctx
│   └── info.ts                    # AMENDED: name-source swap
└── shared/
    └── errors-bridges.ts         # AMENDED if a typed error is needed

tests/
├── domain/workflow-project-key.test.ts   # the 14 cases
├── persistence/locations.test.ts          # AMENDED: new members
├── bridges/workflows/{discover,stage,unstage}.test.ts
├── bridges/_fixtures/                     # workflow script fixtures
└── orchestrators/plugin/…                 # ledger + info swap
```

### Pattern 1: The engine's discovery contract (WBRG-04)

`createWorkflowStorage(cwd)` scans exactly three directories and nothing else.
Everything below is verbatim from the published 3.5.1 tarball.

```js
// Source: @quintinshaw/pi-dynamic-workflows@3.5.1 dist/workflow-paths.js:12-38
export const WORKFLOW_HOME_RELATIVE_DIR = ".pi/workflows";
export const WORKFLOW_PROJECTS_SUBDIR = "projects";
export function workflowHomeDir() {
    return join(homedir(), WORKFLOW_HOME_RELATIVE_DIR);
}
export function workflowUserSavedDir() {
    return join(workflowHomeDir(), "saved");
}
export function workflowProjectPaths(cwd) {
    const key = workflowProjectKey(cwd);
    const rootDir = join(workflowHomeDir(), WORKFLOW_PROJECTS_SUBDIR, key);
    return {
        key, rootDir,
        runsDir:     join(rootDir, "runs"),
        savedDir:    join(rootDir, "saved"),
        settingsPath: join(rootDir, "settings.json"),
        legacyRunsDir:  resolve(cwd, WORKFLOW_RUNS_DIR),
        legacySavedDir: resolve(cwd, WORKFLOW_SAVED_DIR),
    };
}
```

```js
// Source: @quintinshaw/pi-dynamic-workflows@3.5.1 dist/config.js:15-19
export const WORKFLOW_RUNS_DIR = ".pi/workflows/runs";
export const WORKFLOW_SAVED_DIR = ".pi/workflows/saved";
export const USER_WORKFLOW_SAVED_DIR = "~/.pi/workflows/saved";
```

```js
// Source: @quintinshaw/pi-dynamic-workflows@3.5.1 dist/fs-persistence.js:80-89
export function listJsonFilesSafe(fs, dir) {
    try {
        if (!fs.existsSync(dir))
            return [];
        return fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    }
    catch {
        return [];
    }
}
```

```js
// Source: @quintinshaw/pi-dynamic-workflows@3.5.1 dist/workflow-saved.js:80-101
        list() {
            const workflows = [];
            const seen = new Set();
            const addDir = (dir, location) => {
                for (const file of listJsonFilesSafe(fs, dir)) {
                    const wf = loadFromFile(join(dir, file), location);
                    if (wf && !seen.has(wf.name)) {
                        seen.add(wf.name);
                        workflows.push(wf);
                    }
                }
            };
            // Priority order mirrors load(): project > legacy project > user.
            addDir(projectDir, "project");
            addDir(legacyProjectDir, "project");
            addDir(userDir, "user");
            return workflows.sort((a, b) => a.name.localeCompare(b.name));
        },
```

Five consequences the planner should treat as fixed facts:

1. **The scan is flat and `.json`-suffix-only.** `readdirSync` is not
   `withFileTypes`, so a *directory* named `x.json` inside a saved dir would be
   listed and then fail its read (degrading to `null`, not throwing). Our staging
   directory must therefore never live inside a saved dir, and never end in
   `.json`.
2. **The staging directory is invisible because it is outside the three scanned
   dirs, not because it is dot-prefixed.** The CONTEXT rationale ("dot-prefixed
   so the engine's `saved/`-scoped scan cannot see it") reaches the right answer
   by a wrong mechanism: the scan is scoped to three exact paths, so anything
   else under `~/.pi/workflows/` is invisible regardless of its name. Keep the
   dot prefix anyway — it is good hygiene against a human `ls` and against any
   future engine change — but do not let a test assert the dot prefix as the
   protection.
3. **The dedup key is the envelope's `name` field, not the filename.**
   `loadFromFile` returns `null` unless `isSafeSavedWorkflowName(data.name ?? "")`
   passes, so an envelope with a missing or unsafe `name` is silently dropped.
4. **`load(name)` and `delete(name)` compose the path as
   `join(dir, `${name}.json`)`.** So the filename stem MUST equal the envelope
   `name`, or the workflow lists but cannot be loaded by name or deleted. The
   `SavedWorkflow.name` doc comment says so outright: `/** Command name (filename
   without extension). */` `[VERIFIED: dist/workflow-saved.d.ts:6-7]`
5. **Project shadows user.** A project-scope install of `acme:deploy` hides a
   user-scope one of the same name, silently. Not this phase's problem, but it
   is the correct answer for Phase 104's cross-scope reasoning.

### Pattern 2: The bridge triplet, and where it diverges from `bridges/commands/`

`bridges/commands/` is the right template. Four divergences are mandatory.

| Aspect | `bridges/commands/` | `bridges/workflows/` | Why |
|--------|--------------------|--------------------|-----|
| Suffix filter | `entry.name.endsWith(".md")` | `WORKFLOW_SCRIPT_EXTENSIONS` = `[".js", ".mjs", ".cjs"]`, matched **case-insensitively** | Phase 102 exports the tuple; `fileStem` lowercases before matching so a `Thing.JS` admitted by the filter does not carry `.JS` into the name. `[VERIFIED: domain/workflow-script.ts:293-313]` |
| Name derivation | `generatedCommandName(plugin, stem)` in `discover` | `admitWorkflowScript(plugin, fileName, source)` — needs the file **contents** | The name comes from `meta.name`, so discover must `readFile` every candidate. This is the extra I/O that makes one shared read worth having. |
| `assertSafeName` on the source name | Called directly in `discover` — **throws** | **Must NOT be called.** `admitWorkflowScript` internally routes an unsafe name into a per-file `refused` verdict via `generateOrRefuse` | A direct `assertSafeName` on the file name would turn one badly-named script into a whole-plugin install failure, violating WBRG-03 / WVAL-02. `[VERIFIED: bridges/commands/discover.ts:99; domain/workflow-script.ts:327-342]` |
| Dedup key | generated command name | generated workflow name, **and** the collision assert runs over the **full verdict array before** any dedup | Phase 102 deliberately diverged: `assertNoWorkflowNameCollisions` takes the whole array and narrows internally so a caller cannot dedup first. `[VERIFIED: domain/workflow-script.ts:190-211]` |

Ordering inside `prepareStageWorkflows` must mirror
`prepareStageCommands`: discover → collision assert → materialization-gate
short-circuit → staging dir → per-file write. `[VERIFIED: bridges/commands/stage.ts:168-198]`

The verdict union `discover` returns:

```ts
// Source: extensions/pi-claude-marketplace/domain/workflow-script.ts:78-82
export type WorkflowVerdict =
  NamedWorkflow | StemFallbackWorkflow | SkippedWorkflow | RefusedWorkflow;

/** The two arms that carry a `generatedName`, and so the two a collision can involve. */
export type AdmittedWorkflow = NamedWorkflow | StemFallbackWorkflow;
```

`NamedWorkflow` carries `fileName`, `metaName`, `generatedName`, and an optional
`description`. `StemFallbackWorkflow` carries `fileName`, `generatedName`,
optional `description` — **but no `metaName`**, which matters for the `info`
rendering (see Pattern 6). `[VERIFIED: domain/workflow-script.ts:36-50]`

Design the `DiscoveredWorkflow` record to carry the absolute source path
alongside the verdict, since `admitWorkflowScript` only takes a bare file name:

```ts
export interface DiscoveredWorkflow {
  readonly verdict: WorkflowVerdict;
  /** Absolute path to the source script. Undefined only if the read failed. */
  readonly scriptFile: string;
  /** Source bytes, read once and reused by stage. */
  readonly source: string;
}
```

Reusing `source` from discover into stage is what makes "one read serves both
surfaces" true rather than aspirational — `bridges/commands/stage.ts` re-reads
each file at stage time (`readFile(command.commandFile)` at line 218), and
copying that shape here would double the I/O for no gain.

### Pattern 3: The `ScopedLocations` amendment and the containment mechanism

`assertPathInside(parent, child, label)` takes its boundary **as an argument**.
There is no global registry of admitted roots — "the single chokepoint" means
every path composition routes through `ScopedLocations`, and each getter passes
the correct hard-coded parent.

```ts
// Source: extensions/pi-claude-marketplace/shared/path-safety.ts:77-101
export async function assertPathInside(
  parent: string,
  child: string,
  label: string,
): Promise<void> {
```

So "NFR-10 learns the new root" is implemented as: three new members on the
frozen bundle, composed from hard-coded suffixes on a new base, plus one
`assertPathInside`-guarded method for the name-bearing leaf. This is exactly the
`pluginCloneDir` / `pluginCacheFile` shape already in the file.

Recommended amendment (member names are Claude's discretion; these are a
consistent set):

```ts
/** `~/.pi/workflows/` -- the host engine's storage root (WPTH-04). NOT under
 *  scopeRoot and NOT relocated by PI_CODING_AGENT_DIR: the engine derives it
 *  from homedir() and honors no override, so writing anywhere else would put
 *  artifacts where the engine never looks. */
readonly workflowsHomeDir: string;
/** The scope's canonical saved dir (WPTH-01):
 *    user    -> `<workflowsHomeDir>/saved/`
 *    project -> `<workflowsHomeDir>/projects/<key>/saved/`
 *  The deprecated `<cwd>/.pi/workflows/saved/` is NEVER this value (WPTH-02). */
readonly workflowsSavedDir: string;
/** `<workflowsHomeDir>/.workflows-staging/` -- adjacent to the target so the
 *  commit rename() stays within one filesystem (WPTH-05). Deliberately NOT
 *  under extensionRoot, unlike every other bridge's staging dir. */
readonly workflowsStagingDir: string;
/** Returns `<workflowsSavedDir>/<generatedName>.json` after assertSafeName +
 *  assertPathInside containment checks (SC-7 / NFR-10). The SOLE sanctioned
 *  composer of a workflow artifact path. */
workflowArtifactPath(generatedName: string): Promise<string>;
```

Two structural notes:

- `workflowsHomeDir` and `workflowsStagingDir` are **scope-independent** — they
  are byte-identical for `locationsFor("user", cwd)` and
  `locationsFor("project", cwd)`. Only `workflowsSavedDir` branches. That is a
  first for this bundle and worth a test that asserts it deliberately, so a
  future reader does not "fix" it.
- The existing comment block at `locations.ts:182-191` explains why
  `assertPathInside` is *not* called in the factory body (it is async;
  `locationsFor` is sync; suffix-only construction makes escape impossible).
  The project key is *not* a hard-coded suffix — it is derived from `cwd`. But
  it is also not attacker-controlled in the sense `assertSafeName` guards
  against: the sanitizer's character class is `[a-z0-9._-]` with everything else
  collapsed to `-`, and the `^-+|-+$` strip plus the `|| "project"` fallback
  make `.` and `..` unreachable outputs. State that reasoning in the comment
  rather than leaving the asymmetry unexplained.

### Pattern 4: The staging / commit / unstage sequence

The single divergence from every existing bridge is the staging **location**.
Everything else is the commands shape.

```text
prepareStageWorkflows(input)
  1. discover  -> { discovered: DiscoveredWorkflow[], warnings: string[] }
  2. assertNoWorkflowNameCollisions(discovered.map(d => d.verdict))   // THROWS
  3. if (admitted.length === 0 && previousNames.length === 0)
       return { kind: "noop", result: { …, warnings } }               // gate
  4. stagingRoot = join(locations.workflowsStagingDir, randomUUID())
     mkdir(stagingRoot, { recursive: true })
     assertPathInside(locations.workflowsStagingDir, stagingRoot, …)
  5. for each admitted verdict:
       stagedFile = join(stagingRoot, generatedName + ".json")
       assertPathInside(stagingRoot, stagedFile, …)
       targetFile = await locations.workflowArtifactPath(generatedName)
       envelope   = { name: generatedName,
                      ...(description !== undefined && { description }),
                      script: source }                                // verbatim
       writeFile(stagedFile, JSON.stringify(envelope, null, 2) + "\n", "utf8")
       renamePairs.push({ from: stagedFile, to: targetFile })
     on throw -> appendLeakToError(err, await cleanupStaging(stagingRoot, …))

commitPreparedWorkflows(prepared)
  1. noop branch -> undefined
  2. unlink each previous-named target (ENOENT-tolerant)
  3. mkdir(savedDir, { recursive: true })          // lazy-create, both levels
  4. sequential rename(from, to), tracking completedRenames[]
     on throw -> reverse-walk rename(to, from), accumulate rollbackLeaks[],
                 appendLeaks(err, [...rollbackLeaks, cleanupStaging(...)])
  5. return cleanupStaging(stagingRoot, "workflows staging directory")

unstagePluginWorkflows({ locations, previousWorkflowNames })
  for each name: target = await locations.workflowArtifactPath(name)
                 unlink(target)  // ENOENT-tolerant, idempotent (NFR-3)
```

`mkdir(savedDir, { recursive: true })` at step 3 creates
`~/.pi/workflows/projects/<key>/saved/` including both intermediate levels — the
engine's `ensureDir` does the same, so we are not racing it into an
inconsistent state. `[VERIFIED: dist/workflow-saved.js:26,54-55]`

The reverse-walk rollback shape is lifted verbatim from
`commitPreparedCommands`. `[VERIFIED: bridges/commands/stage.ts:329-352]`

**Note on the staging directory's lifetime:** `~/.pi/workflows/.workflows-staging/`
is created lazily and removed by `cleanupStaging` after every commit, but the
*parent* is never removed. An empty dot-directory left under the engine's home
is harmless and invisible to its scan. Do not add pruning logic.

### Pattern 5: The sixth ledger phase

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1235-1246
  // D-01 literal-array; order is part of the contract -- never refactor
  // to a dynamic builder. D-63-01: hooks slot lands between agents and mcp.
  // The PRD-fixed sequence is
  // [skills, commands, agents, hooks, mcp, state].
  const phases: readonly Phase<InstallCtx>[] = [
    skillsPhase,
    commandsPhase,
    agentsPhase,
    hooksPhase,
    mcpPhase,
    statePhase,
  ];
```

The workflows phase slots between `mcpPhase` and `statePhase`. Model it on
`mcpPhase` — it is the closest structural match (prep handle on ctx, warnings
pushed to `bridgeWarnings`, undo gated on the prep handle being defined):

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1111-1143
  const mcpPhase: Phase<InstallCtx> = {
    name: "mcp",
    do: async (c) => { … c.mcpPrep = prep; … c.bridgeWarnings.push(...result.warnings); },
    undo: async (c) => { if (c.mcpPrep === undefined) { return; } await unstageMcpServers({…}); },
  };
```

`InstallCtx` gains `workflowsPrep?: PreparedWorkflowsStaging` and
`stagedWorkflowNames: readonly string[]` alongside the four existing
`staged*Names` arrays. `[VERIFIED: install.ts:391-407]`

The `Phase<C>` contract requires the undo to tolerate a partial `do`:

```ts
// Source: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:26-39
 * A single ledger phase. `do` runs forward; `undo` (optional) is invoked
 * in reverse order over successfully-completed phases AND on the throwing
 * phase itself (failing-phase own-undo runs first from the catch block,
 * before the reverse walk -- TR-02). `undo` MUST tolerate being called
 * after a partial-do throw -- it cannot assume `do` ran to completion;
 * gate on context-set sentinels and keep bridge cleanup helpers
 * ENOENT-tolerant.
```

Since `statePhase` is the only phase after workflows and it has no `undo`,
criterion 6's "a failure in any later phase unstages them" reduces to exactly
one live path: a `statePhase` throw (`ConcurrentInstallError`, or the defensive
"marketplace disappeared" arm). That is the case the test must construct — do
not settle for a synthetic seventh phase, which would prove the ledger works
rather than that this wiring does.

### Pattern 6: The `info` name-source swap

`composeResolvedComponents` currently takes `(pluginRoot, resolved)` and has
**no access to the plugin name**. `admitWorkflowScript` requires it (it is the
prefix for `generatedColonName` and is `assertSafeName`-checked first). Threading
the plugin name in is therefore mandatory and touches every call site.

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:704-708
  const workflows = await discoverComponentNames(
    pluginRoot,
    resolved.componentPaths.workflows,
    "workflows",
  );
```

Call sites of `composeResolvedComponents`: `info.ts:1214`, `1535`, `1627`,
`1894`, `2078`, plus the `Parameters<typeof composeResolvedComponents>[1]` type
references at `1189`, `2073`. Adding a third parameter is a wide but mechanical
edit; adding the name to the existing `resolved` bag is narrower and the
`unavailable` arm at `1307` already builds that object literal from
`deriveLenientComponentPaths(entry)`, where `entry.name` is in hand. Prefer the
bag.

**What to render.** The other kinds render *source* names, not generated ones —
commands render the `.md` basename, not `<plugin>:<cmd>`. `[VERIFIED: info.ts:261-263,287-290]`
The catalog documents this distinction explicitly for the state-only row
("The component names are the Pi-generated INSTALLED names … different from the
source names that the manifest-backed states above show (D-96-01)").
So the manifest-backed workflows line must show **`meta.name`**, not
`generatedName`. That means:

- `NamedWorkflow` → render `verdict.metaName`
- `StemFallbackWorkflow` → render the file stem (it carries no `metaName`; the
  stem must be recomputed or the verdict extended)
- `SkippedWorkflow` / `RefusedWorkflow` → render the file stem, never throw

The `StemFallbackWorkflow` arm has no `metaName` and no stem field. Two options:
recompute the stem in the bridge from `fileName` using
`WORKFLOW_SCRIPT_EXTENSIONS` (duplicating the private `fileStem` helper), or
export `fileStem` from `domain/workflow-script.ts`. **Export it** — a second
copy of a case-insensitive suffix-strip is exactly the drift `WORKFLOW_SCRIPT_EXTENSIONS`
was exported to prevent, and the module's own comment says the filter and the
stem rule must admit the same set.

**Sorting and casing.** `discoverComponentNames` sorts
`localeCompare(a, b, undefined, { sensitivity: "base" })` and the renderer
assumes pre-sorted input. The bridge path must sort identically.
`[VERIFIED: info.ts:335]`

**The catalog prose is now false.** `docs/output-catalog.md:1593` says "The names
are the enumerated script stems, which the orchestrator sorts before it gives
them to the renderer." That sentence must change in the same commit. The fenced
`text` block under `<!-- catalog-state: installed-single-scope-with-workflows -->`
does **not** change — the byte gate feeds the renderer a message fixture
(`tests/architecture/catalog-uat.test.ts:2982-3001`) whose `components.workflows`
is a literal array, so the name-source swap is invisible to it. Remember
markdown is formatted by `mdformat`, not prettier.

### Anti-Patterns to Avoid

- **Naming a workflow from the filename.** `agentops` names files
  `<meta.name>.js` (3/3 match) but `paperjury` uses `<name>.workflow.js` (3/3
  diverge); a dot passes both `assertSafeName` and `isSafeSavedWorkflowName`, so
  stem-naming misnames silently with nothing to catch it.
- **Extracting `meta.name` with a regex, or by evaluating the script.** Phase 102
  settled this; this phase must not reintroduce a shortcut.
- **Modeling on `bridges/agents/`.** There is no index to mutate — the engine's
  registry is a directory scan, and `agents/index-mutation.ts` has no counterpart.
- **Adding a `:`-sanitizing step.** Standing policy
  (`bridges/commands/stage.ts:11-12`, "Windows is explicitly not targeted"), and
  the engine's own `isSafeSavedWorkflowName` forbids only `/`, `\` and NUL.
- **Writing `<cwd>/.pi/workflows/saved/`.** It is inside our scope root and
  needs no NFR-10 amendment, which is exactly why it is tempting. The engine
  still reads it, but its module header says new writes live under the user's
  workflow home; if the read is dropped upstream, installed workflows silently
  stop resolving.
- **Staging under `<extensionRoot>`.** Cross-mount `rename()` fails EXDEV.
- **Calling `assertSafeName` on the discovered file name.** Turns a per-file
  refusal into a whole-plugin failure.
- **Depending on the engine package at runtime.** Its path and storage modules
  are private internals of a 0.x package with 50 releases since May 2026.

## The 14 project-key cases (WPTH-03)

The engine's derivation, verbatim from the published tarball:

```js
// Source: @quintinshaw/pi-dynamic-workflows@3.5.1 dist/workflow-paths.js:20-46
export function workflowProjectKey(cwd) {
    const projectPath = resolve(cwd);
    const slug = sanitizePathSegment(basename(projectPath) || "project");
    const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 12);
    return `${slug}-${hash}`;
}
function sanitizePathSegment(value) {
    const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    return sanitized || "project";
}
```

Two orderings are load-bearing: the dash-strip runs **before** the 48-char
slice, and `resolve()` runs **before** `basename()`.

All fourteen keys recomputed this session from that transcription
`[VERIFIED: computed via node, this session; matches sources/025-canonical-path-mechanics/README.md:96-107 for every case except #13]`:

| # | Input `cwd` | Expected key | What it pins |
|---|-------------|--------------|--------------|
| 1 | `/home/acolomba/some-project` | `some-project-e4c31526a114` | plain absolute |
| 2 | `/home/acolomba/UPPER-Case-Name` | `upper-case-name-68af6a471604` | lowercasing |
| 3 | `/home/acolomba/name with spaces & symbols!` | `name-with-spaces-symbols-0dd0a90eb124` | runs of disallowed chars collapse to ONE dash; the trailing `!`-dash is stripped |
| 4 | `/home/acolomba/проект` | `project-cd4339b8af82` | all-Cyrillic slugs to the literal `project` |
| 5 | `/home/acolomba/日本語プロジェクト` | `project-3cc7d84ca611` | all-CJK slugs to the literal `project` |
| 6 | `/home/acolomba/---leading-and-trailing---` | `leading-and-trailing-adab370c9067` | leading + trailing dashes stripped |
| 7 | `/home/acolomba/` + `"a".repeat(60)` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-243d40bfeca2` | 48-char slice (48 `a`s) |
| 8 | `/home/acolomba/` + `"a".repeat(47)` + `-b` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa--79e41bdb3cef` | **strip BEFORE slice** — 47 `a`s + a surviving trailing dash + the joining dash = doubled dash |
| 9 | `/home/acolomba/.hidden` | `.hidden-c67d01a972fa` | `.` is inside the allow class, so a leading dot survives |
| 10 | `/home/acolomba/dots.in.name` | `dots.in.name-a7042d00116c` | interior dots survive |
| 11 | `/` | `project-8a5edab28263` | empty basename → the `|| "project"` fallback |
| 12 | `/home/acolomba/trailing/` | `trailing-0a1fd85765a9` | `resolve()` strips the trailing slash |
| 13 | `relative/path` | **NOT HARD-CODABLE** — see below | `resolve()` runs against `process.cwd()` |
| 14 | `/home/acolomba/../acolomba/some-project` | `some-project-e4c31526a114` | `..` normalization; **identical to case 1** |

Cases 7 and 8 in full, since the `a`-counts are the whole point:

- Case 7 slug = `"a" × 48`, key = `"a"×48 + "-243d40bfeca2"`.
- Case 8 slug = `"a" × 47 + "-"`, key = `"a"×47 + "--79e41bdb3cef"`.

Write both with `"a".repeat(N)` in the test rather than as pasted literals — a
pasted 48-character run is unreviewable and a miscount fails as a hash mismatch
that reads like an upstream drift.

### Case 13 is the trap

`resolve("relative/path")` = `join(process.cwd(), "relative/path")`, so the
hashed input — and therefore the key — depends on where the test process runs.
The proof is in the evidence base itself: spike 025's README records
`path-c02fff3b6ab2`, and the identical code run from this worktree today produces
`path-710b8d1783c7`. That is not a regression; it is two different `cwd`s.
A hard-coded literal for case 13 would fail on every machine but the spike author's.

**Recommendation — split the assertion, do not drop the case.** The case exists
to pin that `resolve()` runs before `basename()`, and that property is fully
testable without pinning the hash:

```ts
// WPTH-03: the relative case's HASH is cwd-dependent by construction, so the
// pin is split. The slug half is hard-coded (it is what `resolve()` -> `basename()`
// ordering produces); the identity half proves the resolution happened at all.
// A single hard-coded key here would pass only on the machine that wrote it.
const relative = "relative/path";
assert.match(workflowProjectKey(relative), /^path-[0-9a-f]{12}$/);
assert.equal(workflowProjectKey(relative), workflowProjectKey(path.resolve(relative)));
```

The second assertion is the one that would fail if an implementation dropped
`resolve()`, because a `basename("relative/path")` without `resolve` still yields
`path` — so the slug alone does not pin the ordering, and neither does a
tautological re-derivation. State that reasoning in the test comment; it is the
kind of thing a later reader will otherwise "simplify" back into a tautology.

An alternative worth considering if the split feels unsatisfying: `process.chdir`
to a fixed temp path and hard-code the resulting key. Reject it — `node --test`
runs suites concurrently and `chdir` is process-global; the compat-01 gate
forbids exactly this for exactly this reason.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading a workflow's command name | A regex, a partial parser, or a `meta` evaluator | `domain/workflow-script.ts::admitWorkflowScript` | Phase 102 shipped it with four verdict arms, last-wins duplicate-key handling, spread-opacity detection, and comment/literal/split attribution. |
| Name collision detection | A local `Map` grouping in the bridge | `assertNoWorkflowNameCollisions(verdicts)` | Takes the FULL array by design so the caller cannot dedup first. |
| `<plugin>:<name>` construction | String template + a `:` sanitizer | `domain/name.ts::generatedWorkflowName` | Applies RN-1 prefix elision, `assertSafeName` at three labelled points, and the engine's 128-char + trim-equality rules. |
| Reversible per-file rename with rollback | A bespoke try/catch ladder | The `commitPreparedCommands` reverse-walk shape | Already handles partial-failure reverse rename, leak accumulation, and `appendLeaks` composition. |
| Best-effort staging cleanup | `rm` in a try/catch | `shared/fs-utils.ts::cleanupStaging` | Swallows ENOENT, returns a leak string instead of throwing, bounded to one call (T-03-03). |
| Symlink refusal | `realpath` comparison | `shared/path-safety.ts::assertPathInside` (+ a per-entry `lstat` in discover) | D-14 refuses ALL symlinks and D-16 walks every parent component, not just the leaf. |
| The 5-phase → 6-phase transition | A phase-registry or builder | Append one element to the literal array | D-01 literal-array discipline is an explicit anti-pattern guard; a builder lets ordering drift across refactors. |
| Project-key parity | Importing the engine's `workflowProjectKey` | A pure reimplementation + a pinned parity test | The function is a private internal with no export contract. |

**Key insight:** every hand-roll temptation in this phase is a second copy of a
rule that already has exactly one home — and in each case the second copy would
agree with the first on the happy path and diverge on precisely the edge the
first was written to handle.

## Common Pitfalls

### Pitfall 1: Hard-coding the relative-path key

**What goes wrong:** The test greens on the author's machine and reds in CI, or
worse, greens everywhere because someone "fixed" it by re-deriving the expected
value — which makes the assertion a tautology that can never fail.
**Why it happens:** The spike README presents all 14 rows in one table with
concrete keys, which reads as 14 hard-codable values.
**How to avoid:** Split case 13 into a slug-shape pin plus a
resolve-equivalence pin, as above.
**Warning signs:** an expected value computed by calling the function under test.

### Pitfall 2: `resources.workflows` and the state schema

**What goes wrong:** Adding a **required** `workflows: Type.Array(Type.String())`
to `PLUGIN_INSTALL_RECORD_SCHEMA.resources` makes every pre-existing
`state.json` fail validation on load, because nothing fills it.
**Why it happens:** `resources` currently has five required members
(`skills`, `prompts`, `agents`, `mcpServers`, `hooks`) and `hooks` was added the
same way — but only because `ensurePluginResources` in `persistence/migrate.ts`
fills it before validation runs. `[VERIFIED: persistence/state-io.ts:63-72,119-125; persistence/migrate.ts:100]`
**How to avoid:** Decide deliberately whether Phase 103 persists staged workflow
names at all. Criterion 6 (rollback leaves nothing behind) needs only in-ctx
tracking. Phase 104 (uninstall/update/disable) genuinely needs the record. Two
defensible answers: persist now with a `migrate.ts` fill (recommended — the
migrate helper already iterates every record and the "additive with a fill"
precedent is established), or defer the whole record question to Phase 104.
**Do not** silently omit it and let Phase 104 discover the gap.
**Warning signs:** `tests/persistence/migrate.test.ts` red; `loadState` throwing
on a fixture.
**Note on the COMPAT-01 gate:** it pins the record's **outer** key set only
(`compatibility, enabled, hookEntries, installedAt, resolvedSha, resolvedSource,
resources, updatedAt, version`) and does not enumerate `resources`' inner keys,
so adding a member there does not trip it.
`[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts:342-358]`

### Pitfall 3: Using `atomicWriteJson` for the envelope

**What goes wrong:** The envelope lands directly at its final path with no
staging, so there is nothing to `unstage` on rollback and WPTH-05's whole
rationale evaporates.
**Why it happens:** CONTEXT lists `shared/atomic-json.ts` as "the atomic JSON
write primitive for the envelope", and it *is* the house JSON writer.
**How to avoid:** Read the module's own scope statement:

```ts
// Source: extensions/pi-claude-marketplace/shared/atomic-json.ts:15-18
 * Used ONLY for JSON files that participate in `withStateGuard`
 * (state.json, mcp.json, agents-index.json). Staging-tree commits use the
 * hand-rolled `mkdir`+`writeFile`+`rename` pattern (different problem shape,
 * EXDEV risk lives there).
```

Use plain `writeFile` into staging + `rename` to the target. NFR-1 atomicity
comes from the rename, which is why the rename must not cross a filesystem.
**Warning signs:** a `renamePairs` array that is never populated; an unstage
that has nothing to remove.

### Pitfall 4: `bridgeWarnings` are invisible in standalone mode

**What goes wrong:** WBRG-03's per-file warnings are collected correctly and
then silently dropped for a plain `/claude:plugin install`.

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1753-1763
  // Bridge-side soft warnings (e.g. agents bridge cleanup-leak return
  // values aggregated during the staged phases). The standalone-mode
  // user-visible warning is DROPPED per D-19-01: bridge-side soft
  // warnings have no clean representation. The orchestrated-mode
  // collection path is preserved.
  for (const w of installCtx.bridgeWarnings) {
    if (orchestrated) {
      postCommitWarnings.push(w);
    }
    // else: D-19-01 -- dropped in standalone mode.
  }
```

**Why it happens:** The alternative channel — `frontmatterDegradations`, which
does surface a closed-set reason token on the standalone row — requires a new
`REASONS` member, and the closed set is pinned by
`tests/architecture/compat-01-no-expansion.test.ts:126-171` and by the
`docs/output-catalog.md` byte gate. WDEP-04 explicitly schedules the new reason
token for Phase 105.
**How to avoid:** Route into `bridgeWarnings` (matching the MCP bridge
precedent at `install.ts:1128-1130`), and record the visibility gap as an
explicit carry-forward into Phase 105's scope — a verifier's "defer to phase N"
that lands in no phase's context ships un-fixed.
**Warning signs:** an acceptance criterion phrased as "the user sees a warning
when a script is skipped" — that is not achievable in this phase without
expanding the closed set.

### Pitfall 5: `stagedAny` and `resourcesChanged`

**What goes wrong:** A plugin that ships **only** workflows installs
successfully but reports `resourcesChanged: false`, and
`orchestrators/import/execute.ts` consumes that as a structural predicate.

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1765-1772
  // PI-9 corollary: track whether anything was actually staged. Preserved
  // verbatim because `InstallPluginOutcome.resourcesChanged` is consumed
  // by import/execute.ts as a structural predicate.
  const stagedAny =
    installCtx.stagedSkillNames.length > 0 ||
    installCtx.stagedCommandNames.length > 0 ||
    installCtx.stagedAgentNames.length > 0 ||
    installCtx.stagedMcpServerNames.length > 0;
```

**Why it happens:** The comment says "Preserved verbatim", which reads as
do-not-touch. It means "do not change the semantics", not "do not add the sixth
kind".
**How to avoid:** Add `installCtx.stagedWorkflowNames.length > 0` to the
disjunction, and write the test as a workflows-only fixture plugin — the exact
shape that exposes it.
**Warning signs:** an import cascade that reports no change for a
workflows-bearing plugin; a reload hint that does not fire.

### Pitfall 6: Envelope `name` diverging from the filename stem

**What goes wrong:** The workflow appears in `list()` but `load(name)` and
`delete(name)` both miss it, because those compose `join(dir, name + ".json")`
from the *requested* name while `list()` reports the *envelope's* name.
**Why it happens:** They are two independent fields and nothing cross-checks
them at write time.
**How to avoid:** Compose both from one variable — `generatedName` — and assert
the equality in a bridge test by reading the committed file back and comparing
`JSON.parse(bytes).name` against `basename(path, ".json")`.
**Warning signs:** an envelope built from `verdict.metaName` instead of
`verdict.generatedName`.

### Pitfall 7: An `info` throw from `assertSafeName(pluginName)`

**What goes wrong:** `admitWorkflowScript` calls
`assertSafeName(pluginName, "plugin name")` as its very first statement and
throws on failure — deliberately, because an unsafe plugin name disqualifies
every script at once. On the read-only `info` surface that turns one bad plugin
name into an unviewable plugin, violating the CONTEXT decision that `info`
"never throws". `[VERIFIED: domain/workflow-script.ts:124-131]`
**Why it happens:** Plugin names reaching `info` normally come from a validated
manifest, so the throw is unreachable on the happy path and easy to overlook.
**How to avoid:** The info-side call wraps the whole workflows discovery in a
try/catch that falls back to the current stem-based `discoverComponentNames`
behavior. Note `info.ts` already has a `componentsResolved: false` degrade path
for `composeResolvedComponents` throws — but that degrades the *whole* component
block, which is heavier than criterion 7 asks for.
**Warning signs:** an `info` test with a plugin name containing `/` or a control
char that expects a rendered row and gets a rejection.

### Pitfall 8: Assuming `memfs` is the test filesystem

**What goes wrong:** A plan that specifies memfs-based tests, following
`.planning/codebase/STACK.md`, which lists `memfs ^4.57.2` as the testing
filesystem mock.
**Why it happens:** STACK.md is stale on this point. `memfs` is in
`devDependencies`, but a grep across `tests/` finds **zero** importers.
`[VERIFIED: grep -rln "memfs" tests/ returns nothing, this session]`
**How to avoid:** Follow the actual house pattern — `mkdtemp(join(os.tmpdir(),
…))` plus committed fixtures under `tests/bridges/_fixtures/`, as in
`tests/bridges/commands/discover.test.ts:1-36`.
**Warning signs:** an `import { fs } from "memfs"` line in a new test.

### Pitfall 9: Info's `.js`-only suffix strip

**What goes wrong:** A `.mjs` or `.cjs` workflow script renders on `info` with
its extension attached, or not at all.
**Why it happens:** `nameFromEntry` hard-codes `const suffix = kind ===
"workflows" ? ".js" : ".md"` while the bridge admits all three of
`WORKFLOW_SCRIPT_EXTENSIONS`. `[VERIFIED: info.ts:287]`
**How to avoid:** The swap to bridge-backed discovery fixes this as a
side-effect, but only if the fallback path is *also* fixed — and only if the
`unavailable`-arm path at `info.ts:1307` routes through the same code.
**Warning signs:** a fixture with only `.js` scripts, which cannot catch it.

## Code Examples

### The envelope (WBRG-01)

```ts
// The engine's SavedWorkflow minus the three fields it sets on read.
// `name` MUST equal the filename stem -- load()/delete() compose the path
// from the name, while list() reports the envelope's own field.
interface WorkflowEnvelope {
  readonly name: string;          // `<plugin>:<meta.name>` after RN-1 elision
  readonly description?: string;  // OMITTED when meta.description is absent or
                                  // not a string literal -- never synthesized
  readonly script: string;        // the Claude source, byte-for-byte
}
```

An omitted `description` is safe at registration — the engine synthesizes a
fallback:

```js
// Source: @quintinshaw/pi-dynamic-workflows@3.5.1 dist/saved-commands.js:66-67
    pi.registerCommand(wf.name, {
        description: wf.description || `Saved workflow: ${wf.name}`,
```

This is a direct verification of the CONTEXT decision: omitting the key costs
nothing at registration, and the engine's *run-time* non-empty-description gate
(in `parseWorkflowScript`) is already carried as WDOC-01 divergence #1.

### The project key (WPTH-03), reimplemented

```ts
// domain/workflow-project-key.ts
//
// WPTH-03: byte-identical reimplementation of the host engine's private
// `workflowProjectKey`. The engine exposes no contract for it, so parity is
// held by a test with hard-coded expectations rather than by an import.
//
// Two orderings are load-bearing and easy to invert:
//   - the leading/trailing dash strip runs BEFORE the 48-char slice, so
//     truncation can reintroduce a trailing dash;
//   - resolve() runs BEFORE basename(), so relative and non-normalized
//     spellings of one project collapse onto one key.
import { createHash } from "node:crypto";
import path from "node:path";

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 48);

  return sanitized || "project";
}

export function workflowProjectKey(cwd: string): string {
  const projectPath = path.resolve(cwd);
  const slug = sanitizePathSegment(path.basename(projectPath) || "project");
  const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 12);

  return `${slug}-${hash}`;
}
```

Note the house lint prefers `replaceAll`; both patterns here are genuine regexes
with `g`, which `replaceAll` accepts. Sonar's "prefer string literal" smell
applies only to literal patterns, which these are not.

### The relocatable seam

```ts
// platform/workflow-home.ts
//
// WPTH-04: the host engine derives its storage root as
// `join(homedir(), ".pi/workflows")` and honors NO env override and no
// settings knob -- `WorkflowSettings` carries only behavioral keys. Writing
// anywhere else would put artifacts where the engine never looks, so this
// deliberately does NOT read PI_CODING_AGENT_DIR.
//
// This is the sole import site for the root, mirroring `pi-api.ts`'s
// `getAgentDir` position, so a test can relocate storage without mutating
// process-global environment state that concurrent suites also read.
import os from "node:os";
import path from "node:path";

let override: string | undefined;

export function workflowHomeDir(): string {
  return override ?? path.join(os.homedir(), ".pi", "workflows");
}

/** Test-only relocation seam. Pass `undefined` to restore the real root. */
export function setWorkflowHomeDirForTesting(dir: string | undefined): void {
  override = dir;
}
```

A module-level mutable is the smallest thing that works and matches how the
codebase already tolerates process-lifetime state (`shared/completion-cache.ts`).
If module state feels too loose, the alternative is threading the base through
`locationsFor(scope, cwd, opts?)` — narrower blast radius but a wider signature
change across every `locationsFor` call site. Either is defensible; the seam is
the CONTEXT decision and the simpler diff.

### The discover skeleton (WBRG-02 / WBRG-03)

```ts
async function isWorkflowScriptFile(dir: string, entry: Dirent): Promise<boolean> {
  const lowered = entry.name.toLowerCase();
  if (
    entry.name.startsWith(".") ||
    !entry.isFile() ||
    !WORKFLOW_SCRIPT_EXTENSIONS.some((ext) => lowered.endsWith(ext))
  ) {
    return false;
  }

  // D-14: refuse symlinked entries without touching the file body.
  const stat = await lstat(path.join(dir, entry.name));
  return !stat.isSymbolicLink();
}
```

`WORKFLOW_SCRIPT_EXTENSIONS` is `[".js", ".mjs", ".cjs"]`.
`[VERIFIED: domain/workflow-script.ts:293]`

The `ENOENT`/`ENOTDIR` → empty-array guard is
`bridges/commands/discover.ts:36-48` verbatim; a `readFile` failure on an
individual script is a per-file `warnings[]` entry, not a throw (WBRG-03).

## Runtime State Inventory

This is a materialization phase, not a rename, but it writes outside the
extension's own roots for the first time — so the inventory is worth stating.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `state.json` per scope: `resources` gains (or does not gain) a `workflows` member. No existing record carries one. | Decide per Pitfall 2; if added, a `migrate.ts` fill is mandatory. |
| Live service config | The host engine's registry is a directory scan with **no index file** and no database. Nothing to reconcile. `[VERIFIED: dist/workflow-saved.js:80-101]` | None. |
| OS-registered state | None — no scheduler, no daemon, no launchd/systemd unit. | None. |
| Secrets / env vars | None. `PI_CODING_AGENT_DIR` is deliberately **not** honored for this root; `HOME` is read transitively via `os.homedir()`. | None. |
| Build artifacts | None — the repo has no build step (`tsc --noEmit`). | None. |
| **New: artifacts outside `<scopeRoot>`** | `~/.pi/workflows/saved/` and `~/.pi/workflows/projects/<key>/saved/` accumulate files that no scope-root cleanup will ever see. | Phase 104 owns removal (WLIF-03). This phase must at minimum ensure ledger rollback leaves nothing behind (criterion 6). |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | ≥ 20.19.0 required; `os.homedir()`, `fs.rename`, `crypto.createHash` all long-stable | — |
| `acorn` | `domain/workflow-script.ts` (already imported) | ✓ | `^8.16.0` in `dependencies` | — |
| `write-file-atomic` | not used by this phase | ✓ | `^8.0.0` | — |
| `@quintinshaw/pi-dynamic-workflows` | proving WBRG-04 against the real scan | ✗ (not installed) | `3.5.1` on npm | Assert against the verified envelope shape + a scan reimplementation — see Open Question 1 |
| `pi-subagents` | unrelated to this phase | ✗ locally | — | The two pi-subagents integration tests resolve from the global peer and skip in CI; unrelated pre-existing condition |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the host engine — see Open Question 1.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in) + `node:assert/strict`; no config file |
| Config file | none — glob lives in `package.json` scripts |
| Quick run command | `node --test "tests/bridges/workflows/**/*.test.ts"` |
| Full suite command | `npm run check` (typecheck + lint + format:check + test + test:integration) |

`tests/` glob for the unit lane:
`tests/{architecture,bridges,docs,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`.
A new `tests/bridges/workflows/` directory is picked up automatically; a new
`tests/platform/workflow-home.test.ts` likewise.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WPTH-03 | 13 hard-coded keys + the split relative case | unit | `node --test "tests/domain/workflow-project-key.test.ts"` | ❌ Wave 0 |
| WPTH-01 | user vs project saved dir; project key in the path | unit | `node --test "tests/persistence/locations.test.ts"` | ✅ amend |
| WPTH-02 | `<cwd>/.pi/workflows/saved/` never appears in any composed path, and is empty after an install | unit + integration | same + a bridge test asserting the absence | ❌ Wave 0 |
| WPTH-04 | `workflowArtifactPath` refuses `../escape`, `a/b`, `.`, `..`, empty, control chars | unit | `node --test "tests/persistence/locations.test.ts"` | ✅ amend (mirror the `pluginCloneDir` cases at lines 185-193) |
| WPTH-05 | staging root is under `workflowsHomeDir`, NOT under `extensionRoot`, for BOTH scopes | unit | `node --test "tests/persistence/locations.test.ts"` | ✅ amend |
| WBRG-02 | flat scan; `.mjs`/`.cjs` admitted; nested dir ignored; symlink refused; dotfile ignored; first-wins dedup | unit | `node --test "tests/bridges/workflows/discover.test.ts"` | ❌ Wave 0 |
| WBRG-01 | committed bytes parse to `{name, description?, script}`; `script` byte-identical to source; `description` key ABSENT when undefined; filename stem === envelope `name` | unit | `node --test "tests/bridges/workflows/stage.test.ts"` | ❌ Wave 0 |
| WBRG-03 | unreadable script → `warnings[]`, plugin still installs; refused/skipped verdicts likewise | unit | same | ❌ Wave 0 |
| WBRG-04 | a committed envelope satisfies the engine's read predicate (`isSafeSavedWorkflowName(data.name)`), sits in a `listJsonFilesSafe`-visible directory, and the staging dir is invisible to that scan | unit | `node --test "tests/bridges/workflows/stage.test.ts"` | ❌ Wave 0 — see Open Question 1 |
| WLIF-01 | six phases in order; a `statePhase` throw unstages workflows; `~/.pi/workflows/**` empty after rollback | integration | `node --test "tests/orchestrators/plugin/…"` | ❌ Wave 0 |
| Criterion 7 | `info` renders `meta.name` for a `<name>.workflow.js` fixture; falls back to stem for a malformed script; never throws | unit | `node --test "tests/orchestrators/plugin/info…"` | ✅ amend |
| WNAM-05 (regression) | two scripts with the same `meta.name` fail the install as a whole | unit | bridge stage test | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test "tests/{domain,persistence,bridges}/**/*.test.ts"`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/domain/workflow-project-key.test.ts` — WPTH-03
- [ ] `tests/bridges/workflows/discover.test.ts` — WBRG-02, WBRG-03
- [ ] `tests/bridges/workflows/stage.test.ts` — WBRG-01, WBRG-04, WNAM-05
- [ ] `tests/bridges/workflows/unstage.test.ts` — WLIF-01 (removal half)
- [ ] `tests/bridges/_fixtures/` — a workflow-bearing plugin fixture. Needs at
      minimum: a `<meta.name>.js` where stem === name; a `<other>.workflow.js`
      where stem ≠ name (the divergence criterion 7 exists to prove); a `.mjs`;
      a helper module with no `meta` (silent skip); an unparseable file; and a
      `Date.now`-in-a-comment file (WVAL-03 refusal). Reuse Phase 102's fixture
      sources if they exist as files rather than inline strings.
- [ ] `tests/platform/workflow-home.test.ts` — seam set/restore behavior
- [ ] No framework install needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No credential surface in this phase |
| V3 Session Management | no | — |
| V4 Access Control | yes | NFR-10 path containment — `assertPathInside` on every name-derived leaf, `assertSafeName` upstream of every `path.join` with an untrusted component |
| V5 Input Validation | yes | Plugin-supplied file names, `meta.name` values, and script bytes are all untrusted. `assertSafeName` + `assertSafeSavedWorkflowName` (Phase 102) + the sanitizer's closed character class |
| V6 Cryptography | partial | `sha256` is used for a **namespacing key**, not a security boundary. Do not add HMAC or salt — the value must match the engine byte-for-byte |
| V12 File Handling | yes | D-14 symlink refusal on every discovered entry and on every path component; `lstat` before `readFile` so a symlinked script's body is never read |
| V14 Configuration | yes | The new writable root must be named in CLAUDE.md's NFR-10 clause in the same change |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious `meta.name` containing `../` or `/` | Tampering / Elevation | `generatedWorkflowName` → `assertSafeName` rejects separators, `.`, `..`, control chars; the engine's own `isSafeSavedWorkflowName` is a second gate. A failure is a per-file `refused` verdict, not an escape. |
| Symlinked script pointing outside the plugin root | Information Disclosure | `lstat` + `isSymbolicLink()` before any read (D-14) |
| Symlinked *parent* directory in the target path | Tampering | `assertPathInside` walks every component from parent to child (D-16), not just the leaf |
| Script executing at name-extraction time | Elevation of Privilege | `domain/workflow-script.ts` parses, never evaluates — no `eval`, no `Function`, no `vm`, no dynamic import. This phase adds no new evaluation site. |
| TOCTOU between containment check and write | Tampering | Documented residual risk (`path-safety.ts:71-76`); threat model is "careless or malicious plugin author", not a concurrent in-process attacker. Unchanged by this phase. |
| Cross-plugin artifact overwrite in a shared saved dir | Tampering | **New in this phase.** Unlike `promptsTargetDir`, the saved dir is shared with the user's own `/workflows`-saved artifacts and with every other plugin. The `<plugin>:` prefix namespaces it, but nothing enforces ownership at write time. Worth an explicit note; the PI-6 "non-previous content" rejection that `replacePreparedCommands` applies is a Phase 104 concern (reinstall), not a Phase 103 one. |

**This is the first bridge to write executable code rather than data.** The
prose contract for that is WDOC-01 (Phase 105) and explicitly out of scope here,
but the fact should shape how carefully the plans treat the refusal paths.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Every bridge stages under `<extensionRoot>` | Workflows stage adjacent to the target under `~/.pi/workflows/` | This phase | The same-filesystem guarantee that made the first five bridges safe by construction is absent here |
| NFR-10 admits three paths, all under `<scopeRoot>` | A fourth root outside `<scopeRoot>` entirely | This phase | `~/.pi/workflows/` is not reachable from any scope root; scope-root cleanup will never find these artifacts |
| Component names on `info` come from directory entries | Workflows' names come from parsed script contents | This phase | `info` reads file bodies for the first time. Still offline, so NFR-5 is untouched. |

**Deprecated / outdated:**

- `<cwd>/.pi/workflows/saved/` — the engine still reads it (priority 2 of 3) but
  its module header says new writes live under the user's workflow home. Never
  write it.
- `.planning/codebase/STACK.md`'s claim that `memfs` is used for filesystem
  mocking — no test imports it.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A module-level mutable override is acceptable as the test seam, rather than a `locationsFor` signature change | Code Examples | Low — both work; the signature change is a wider mechanical diff. CONTEXT locks "one function, one import site", which the seam satisfies. |
| A2 | `resources.workflows` should be persisted in Phase 103 with a `migrate.ts` fill, rather than deferred to Phase 104 | Pitfall 2 | Medium — deferring is defensible, but the decision must be explicit or Phase 104 inherits an unstated gap. Flag for the planner. |
| A3 | The `info` workflows line should render `meta.name`, not `generatedName`, to match how the other kinds render source names | Pattern 6 | Medium — criterion 7 says "admitted `meta.name`", which supports this reading, and the catalog's D-96-01 note draws the source/generated distinction explicitly. Worth a one-line confirmation before the plan locks it. |
| A4 | Threading the plugin name through `composeResolvedComponents`'s `resolved` bag is preferable to a third parameter | Pattern 6 | Low — pure ergonomics; five call sites either way. |
| A5 | `.workflows-staging` is a suitable staging directory name | Pattern 3 | Low — explicitly Claude's discretion in CONTEXT. |
| A6 | The engine will remain at 3.5.1 through this milestone | throughout | Low — verified `latest` today; a bump would require re-verifying the key derivation and the scan, which is exactly what the pinned test is for. |

## Open Questions

1. **How is WBRG-04 proven?**
   - What we know: the engine's read path is fully verified from source this
     session — `listJsonFilesSafe` is `readdirSync(dir).filter(f =>
     f.endsWith(".json"))`, `loadFromFile` requires
     `isSafeSavedWorkflowName(data.name ?? "")`, and `list()` dedups on the
     envelope's `name`. Spike 023 additionally proved a hand-planted envelope
     is discoverable by the *real* `createWorkflowStorage`.
   - What's unclear: whether the phase should add
     `@quintinshaw/pi-dynamic-workflows` as a `devDependency` to re-prove that
     live in CI, or assert against the verified contract instead. A live test
     couples the suite to a 0.x package with 50 releases since May 2026 and adds
     a transitive `@earendil-works/pi-coding-agent` install; a contract test
     cannot catch an upstream scan change.
   - Recommendation: **assert against the contract, not the package.** Write the
     test as three explicit clauses — (a) the committed file's basename ends
     `.json` and its stem equals `JSON.parse(bytes).name`; (b) that name passes a
     locally-vendored copy of `isSafeSavedWorkflowName`; (c) the staging
     directory contains no `.json` file after commit and is not inside any of
     the three scanned directories. Then add the engine to `tests/live-uat/` as a
     `.mjs` driver (the existing pattern for exactly this kind of
     upstream-coupled check — `manifest-absence-canary.mjs`, `stop-canary.mjs`),
     kept out of the typed tree and out of `npm run check`. That gets the live
     proof without the CI coupling.

2. **Does `resources.workflows` land in Phase 103 or Phase 104?**
   - What we know: criterion 6 does not require it; WLIF-03 (Phase 104) does.
     The additive-with-a-fill precedent (`hooks`) is established and
     `ensurePluginResources` already iterates every record.
   - What's unclear: whether the planner would rather keep Phase 103's diff
     minimal.
   - Recommendation: land it here. The state record and the ledger phase that
     populates it belong in one change; splitting them means Phase 104 opens
     with a schema migration before it can do its actual work.

3. **Does the `unavailable`-arm info path need the same swap?**
   - What we know: `deriveLenientComponentPaths` (info.ts:1239) seeds
     `workflows: ["workflows"]` and feeds `composeResolvedComponents` at line
     1307, so that arm renders workflows too.
   - What's unclear: whether criterion 7 covers it. The criterion says "the
     `info` command's `workflows:` line", unqualified.
   - Recommendation: cover it. The arm has the plugin name in hand (`entry.name`),
     and leaving one arm on stems would produce two different name sources on one
     surface — precisely the inconsistency criterion 7 exists to remove.

## Sources

### Primary (HIGH confidence)

- `@quintinshaw/pi-dynamic-workflows@3.5.1` published tarball, unpacked and read
  this session: `dist/workflow-paths.js`, `dist/workflow-saved.js`,
  `dist/workflow-saved.d.ts`, `dist/fs-persistence.js`, `dist/saved-commands.js`,
  `dist/config.js` — path derivation, scan semantics, name/filename contract,
  description fallback, registration behavior
- `npm view @quintinshaw/pi-dynamic-workflows version dist-tags` — `3.5.1`,
  `latest`, modified 2026-08-05
- In-repo source read this session: `persistence/locations.ts`,
  `shared/path-safety.ts`, `shared/fs-utils.ts`, `shared/atomic-json.ts`,
  `domain/workflow-script.ts`, `domain/name.ts` (workflow half),
  `domain/resolver.ts` (component-kind tuples), `bridges/commands/{discover,
  stage,unstage,types}.ts`, `transaction/phase-ledger.ts`,
  `orchestrators/plugin/install.ts` (ctx + phases + warning routing),
  `orchestrators/plugin/info.ts` (component composition), `persistence/state-io.ts`,
  `eslint.config.js` (BLOCK C / BLOCK E), `package.json`
- In-repo tests read this session: `tests/persistence/locations.test.ts`,
  `tests/architecture/compat-01-no-expansion.test.ts`,
  `tests/architecture/runtime-deps.test.ts`, `tests/bridges/commands/discover.test.ts`,
  `tests/e2e/_helpers.ts`, `tests/e2e/install-soft-deps.test.ts`,
  `tests/architecture/catalog-uat.test.ts` (workflows fixture),
  `docs/output-catalog.md` (workflows state)
- Project skill `spike-findings-pi-claude-marketplace`:
  `references/workflows-bridge.md`,
  `sources/023-landing-zone-quintinshaw/{paths,plant}.mjs`,
  `sources/025-canonical-path-mechanics/{keyparity,exdev}.mjs` + `README.md`
- Recomputation of all 14 project keys via `node`, this session

### Secondary (MEDIUM confidence)

- `sources/025-canonical-path-mechanics/README.md` EXDEV measurement
  (`tmpfs` → `xfs`, `EXDEV`) — machine-specific but the constraint it
  establishes is general
- `.planning/codebase/{ARCHITECTURE,CONVENTIONS}.md` — accurate on layering and
  style

### Tertiary (LOW confidence)

- `.planning/codebase/STACK.md`'s `memfs` claim — contradicted by a grep this
  session; treat as stale

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new packages; every primitive already in use in a
  sibling bridge
- Paths and key derivation: HIGH — read from the published engine source, not
  from documentation or memory; all 14 cases recomputed
- Architecture / bridge shape: HIGH — the template is a file in this repo, read
  in full, and the four divergences are each traceable to a specific line
- Pitfalls: HIGH — 1, 3, 4, 5, 8 were each found by reading the specific source
  line that contradicts an assumption a plan would otherwise make
- Test strategy: MEDIUM — the framework and house pattern are certain; the
  WBRG-04 proof strategy is Open Question 1

**Research date:** 2026-08-15
**Valid until:** 2026-09-14 (30 days). Re-verify sooner if
`@quintinshaw/pi-dynamic-workflows` publishes past 3.5.1 — the key derivation,
the scan, and the envelope shape are all private internals with no export
contract.
