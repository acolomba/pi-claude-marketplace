# Phase 103: Workflow artifact materialization - Context

**Gathered:** 2026-08-15
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — recommendations recorded as accepted

<domain>
## Phase Boundary

Installing a plugin that ships workflows writes engine-discoverable envelopes at
the engine's canonical paths for both scopes, inside an amended containment
root, atomically and reversibly.

**In scope:** the `bridges/workflows/` triplet (discover / stage / unstage), the
`{name, description, script}` JSON envelope, the two canonical saved paths and
the locally derived project key, the NFR-10 root amendment with adjacent
staging, workflows as a 6th materialize phase of the install ledger, and the
`info` `workflows:` line swapping from file stem to admitted `meta.name`.

**Out of scope, deliberately:** update / uninstall / reinstall / enable-disable
(Phase 104 — `runPhases` covers install and update only, and the other three
compose differently), the `workflow_control` soft-dep probe and its degradation
reason (Phase 105), and the executable-code documentation contract (Phase 105).
Phase 103 installs; Phase 104 keeps installed artifacts in step; Phase 105 says
what happens when the host engine is missing and writes it down.

</domain>

<decisions>
## Implementation Decisions

### Locations and the new writable root

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

### Bridge surface and soft-fail channel

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

### Project key derivation

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

### Ledger position and the `info` name swap

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

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/workflow-script.ts` (Phase 102) — `admitWorkflowScript` returning the
  four-arm `WorkflowVerdict` union (`NamedWorkflow` / `StemFallbackWorkflow` /
  `SkippedWorkflow` / `RefusedWorkflow`), `assertNoWorkflowNameCollisions`, and
  `WORKFLOW_SCRIPT_EXTENSIONS = [".js", ".mjs", ".cjs"]`. This phase consumes
  those verdicts; it does not re-derive names.
- `domain/name.ts::generatedColonName` — reused unchanged for `<plugin>:<name>`.
  No `:`-sanitizing step is added (standing policy,
  `bridges/commands/stage.ts:11`).
- `bridges/commands/{discover,stage,unstage,types,index}.ts` — the structural
  template: flat scan, symlink refusal, first-wins dedup, `warnings[]`.
- `shared/atomic-json.ts` — the atomic JSON write primitive for the envelope.
- `shared/path-safety.ts::assertPathInside` — the single containment chokepoint
  (NFR-10) that gains the new admitted root.
- `transaction/phase-ledger.ts::runPhases` / `Phase<C>` — unchanged; the new
  phase is an array element, not a change to the primitive.

### Established Patterns

- Bridges expose the stage/commit/unstage triplet so the ledger treats all kinds
  symmetrically; `prepareStage*` computes the write, `commitPrepared*` renames
  atomically, `unstage*` removes by recorded name.
- `ScopedLocations` is branded with a unique symbol; every name-derived path
  getter routes through `assertPathInside`.
- Typed error classes in `shared/errors-bridges.ts`, each `extends Error`,
  setting `this.name`, carrying readonly structured fields, doc-commented with
  the requirement ID.
- Comments cite durable spec IDs (`WBRG-01`, `WPTH-05`, `D-14`, `NFR-10`) and
  never GSD process artifacts.

### Integration Points

- `orchestrators/plugin/install.ts:1239` — the literal `phases` array
  (`skillsPhase, commandsPhase, agentsPhase, hooksPhase, mcpPhase, statePhase`).
  The workflows phase is appended before `statePhase`.
- `orchestrators/plugin/info.ts:704` — the existing workflows
  `discoverComponentNames` call whose name source this phase swaps.
- `persistence/locations.ts:38` — the `ScopedLocations` interface and
  `locationsFor(scope, cwd)` at line 144.
- `domain/resolver.ts` — `componentPaths.workflows`, already exposed by Phase
  101, is the discover input.

</code_context>

<specifics>
## Specific Ideas

- The envelope is a **wrap, not a copy**: `{name, description, script}` with the
  Claude source verbatim in `script`. `location`, `path` and `savedAt` are set
  by the engine on read and are omitted.
- Discovery must be proven against the engine's real `createWorkflowStorage`
  directory scan, with no engine API call and no index mutated — a hand-planted
  envelope was proven discoverable this way (Spike 023).
- The deprecated `<cwd>/.pi/workflows/saved/` legacy path is never written, even
  though it sits inside our existing scope root and is the easier target.
- Evidence base: `spike-findings-pi-claude-marketplace` project skill,
  `references/workflows-bridge.md`, sections 2, 4, 5, 6 and 8. Sources under
  `sources/023-landing-zone-quintinshaw/` and
  `sources/025-canonical-path-mechanics/` (`keyparity.mjs`, `exdev.mjs`).

</specifics>

<deferred>
## Deferred Ideas

- Update / uninstall / reinstall / enable-disable coverage → Phase 104
  (WLIF-02..06), including the lingering-command reload remedy.
- The `workflow_control` soft-dep probe, the third `DEPENDENCIES` member, its
  reason token, and write-anyway degradation → Phase 105 (WDEP-01..04).
- The executable-code contract and the admit-versus-run divergence table →
  Phase 105 (WDOC-01, WDOC-02).
- The six structural gates the engine applies that our pre-validation does not
  replicate — carried on WDOC-01, not fixed here (Phase 102 decision).

</deferred>
