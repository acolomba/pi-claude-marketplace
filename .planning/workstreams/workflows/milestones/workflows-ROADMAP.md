# Roadmap: workflows (Claude `workflows` Component-Kind Bridge)

**Workstream:** workflows
**Driver:** A Claude plugin shipping `workflows/` installs today with zero signal — the kind sits in neither `SUPPORTED_COMPONENT_KINDS` nor `UNSUPPORTED_COMPONENT_KINDS`, so its scripts are dropped and no surface says so, exactly the silent-ignore hazard `domain/resolver.ts`'s own closed-list warning (T-02-25) predicted.
**Created:** 2026-08-14

## Overview

A Claude plugin shipping `workflows/` installs its scripts as working Pi commands
hosted by `@quintinshaw/pi-dynamic-workflows`, across the full plugin lifecycle.
The host was chosen on trust grounds: it sandboxes scripts in a
`vm.createContext` realm, where `@nicknisi/pi-workflows` uses
`runInThisContext()` and hands untrusted third-party code the real `process`,
all environment variables, and `process.binding('fs')`.

This is the **first bridge to install executable code** rather than data, and
that shows up in three places the existing five bridges never had to handle:

- **The name is inside the file.** Claude names a plugin workflow
  `/<plugin>:<meta.name>` and the filename plays no part, so the command name is
  extracted from the script's exported `meta` by a static acorn AST walk — never
  a regex (a name-like phrase in a comment silently wins, and real scripts carry
  long headers), never by evaluation.

- **The artifact lands outside every current scope root.** The engine's storage
  root `~/.pi/workflows/` is a *sibling* of `~/.pi/agent/`, with no env override
  and no settings knob, so NFR-10 grows a new writable root rather than a
  subdirectory, and staging must sit adjacent to the target because the existing
  stage-under-`<extensionRoot>` pattern reproduces EXDEV here.

- **The engine rejects scripts before it parses them.** Its
  `DETERMINISM_BLOCKLIST` is a raw-text regex that cannot tell code from
  comment, so each script is pre-validated with the engine's own preprocessor
  *before* the install commits, and a rejection is reported truthfully rather
  than repeating the engine's message, which names a rule the script does not
  violate.

Every design claim was measured against production code during spikes 021-013,
not inferred from documentation. The findings are packaged in the
`spike-findings-pi-claude-marketplace` project skill and auto-load during
implementation.

**Design anchors carried by every phase:**

- Detection is convention-based first. Of 44 sampled repos, 16 are real Claude
  plugins shipping `workflows/` and **zero** declare the manifest field.

- The bridge makes no engine API call and mutates no index — the engine's
  registry is a plain directory scan, so a hand-planted envelope is discovered.

- The envelope shape, the project-key derivation, the saved-directory layout and
  the name validator are private internals of a 0.x package with no exported
  contract. Parity tests carry **hard-coded** expected values so an upstream
  change fails loudly instead of silently agreeing with a new implementation.

## Phases

### In progress workflows

🚧 **workflows — Claude workflows Component-Kind Bridge**

**Phase Numbering:**

- Integer phases (101-105): planned milestone work continuing the global counter
  from Phase 100, the final v1.18 phase.

- Decimal phases (101.1, 102.1): urgent insertions only, marked `INSERTED`.

- [ ] **Phase 101: Workflow component-kind recognition** — `workflows` joins the supported kinds on both axes (declared-in-manifest OR convention-on-disk), exposes `componentPaths.workflows`, and stops resolving to silence (WFLW-01..04)
- [x] **Phase 102: Workflow naming and script admission** — the acorn `meta.name` extractor with its four distinct outcomes, the collision error, the reused `generatedColonName` shape, and the engine-preprocessor pre-validation that runs before anything is written (WNAM-01..06, WVAL-01..03, WDOC-03)
- [x] **Phase 103: Workflow artifact materialization** — the `bridges/workflows/` triplet, the JSON envelope, the engine's canonical paths for both scopes, the NFR-10 root amendment with adjacent staging, and the 6th install-ledger phase (WBRG-01..04, WPTH-01..05, WLIF-01) (completed 2026-08-15)
- [x] **Phase 104: Workflow lifecycle completion** — update, uninstall, reinstall and enable/disable each keep artifacts in step, and the lingering-command remedy is stated (WLIF-02..06) (completed 2026-08-15)
- [x] **Phase 105: Workflow degradation and documentation** — the `workflow_control` probe, the third `DEPENDENCIES` member and its reason token, write-anyway degradation that converges on `/reload`, and the executable-code contract in the docs (WDEP-01..04, WDOC-01, WDOC-02) (completed 2026-08-16)

## Phase Details

### Phase 101: Workflow component-kind recognition

**Goal**: A plugin carrying workflow scripts is recognized as carrying installable workflow components — whether it declares them in its manifest or ships them by convention — and its resolved sources are enumerable by the same per-kind shape every other component kind uses.
**Depends on**: Nothing (first phase of the milestone; extends the existing resolver)
**Requirements**: WFLW-01, WFLW-02, WFLW-03, WFLW-04
**Success Criteria** (what must be TRUE):

  1. A plugin with `<pluginRoot>/workflows/*.js` and **no** `workflows` manifest field resolves with those scripts counted as workflow components — the shape 16 of 16 sampled real plugins ship, and the shape a field-only implementation would find none of.
  2. A plugin declaring the `workflows` manifest field resolves the declared paths in both the string and the array form, and a declared path that does not exist is treated exactly as the existing per-kind path validation treats it.
  3. A workflow-bearing plugin reports a workflow component count on `list` and `info` instead of resolving as though the directory were not there — the zero-signal outcome it produces today, unlike `monitors`/`themes`, which correctly demote to `partially-available`.
  4. Consumers can enumerate a resolved plugin's workflow sources through `componentPaths.workflows`, and the closed-set architecture gates (kind enumeration equality, no-expansion contract) pass with the new member counted rather than tripping.

**Plans**: 4/4 plans executed

Plans:

- [x] 101-01-PLAN.md — admit `workflows` on both axes, close every compile-forced construction site, and render the `workflows:` line on `info`
- [x] 101-02-PLAN.md — the strict-mode and loose-mode admission matrices
- [x] 101-03-PLAN.md — the paired catalog state and the render-order prose sweep
- [x] 101-04-PLAN.md — pin the reconcile backfill boundary and the disabled-record compatibility refresh

### Phase 102: Workflow naming and script admission

**Goal**: Every discovered script either resolves to the command name Claude itself would give it, or is refused with a stated reason — decided statically, before anything is written, and never by running the script.
**Depends on**: Phase 101 (consumes the resolved workflow sources)
**Requirements**: WNAM-01, WNAM-02, WNAM-03, WNAM-04, WNAM-05, WNAM-06, WVAL-01, WVAL-02, WVAL-03, WDOC-03
**Success Criteria** (what must be TRUE):

  1. A script exporting `meta` with a string-literal `name` yields the command name `<plugin>:<meta.name>` from `generatedColonName` reused unchanged — including when `meta` is declared 26 lines down behind a header comment, when the key is double-quoted, and when the file is named `<something-else>.workflow.js`, where the stem would have misnamed the command silently.
  2. The other three extractor outcomes are handled distinctly rather than collapsed: no `name` property and a non-literal `name` both fall back to the file stem with the value never evaluated, a script with no `meta` declaration is skipped with a warning and not installed, and an unparseable script (acorn `SyntaxError`) is refused rather than name-scavenged.
  3. Two scripts in one plugin resolving to the same name fail with an explicit collision error naming the offenders, mirroring `assertNoCommandCollisions` (RN-6) on an axis filenames alone cannot produce.
  4. Every generated name passes the engine's `isSafeSavedWorkflowName`, including its RN-1 prefix elision, with no `:`-sanitizing step added.
  5. A script the engine's preprocessor would reject is identified before any write, skipped with the other scripts in the same plugin still admitted, and reported by filename with the real reason — explicitly including the case where the raw-text blocklist matched inside a comment, which the engine's own message misattributes to a rule the script does not violate.
  6. `acorn` (8.16.0) is a declared runtime dependency — the fourth, alongside `isomorphic-git` / `proper-lockfile` / `write-file-atomic` — rather than reached transitively through eslint, and `npm run check` stays green.

**Plans**: 2/2 plans executed

Plans:

- [x] 102-01-PLAN.md — declare the parser, add the workflow name generator with its engine-parity gate, and drive one script from source to an admitted command name
- [x] 102-02-PLAN.md — the three remaining verdict arms, the engine's text-level pre-validation with the real reason, and the collision error

### Phase 103: Workflow artifact materialization

**Goal**: Installing a plugin that ships workflows writes engine-discoverable envelopes at the engine's canonical paths for both scopes, inside an amended containment root, atomically and reversibly.
**Depends on**: Phase 102 (staging needs the admitted name and the pre-validation verdict as inputs, not as follow-ups)
**Requirements**: WBRG-01, WBRG-02, WBRG-03, WBRG-04, WPTH-01, WPTH-02, WPTH-03, WPTH-04, WPTH-05, WLIF-01
**Success Criteria** (what must be TRUE):

  1. `install` of a workflow-bearing plugin writes one `{name, description, script}` envelope per admitted script, carrying the Claude source verbatim in `script` — a wrap, not a copied `.js` — and the engine's own `createWorkflowStorage` directory scan finds it with no engine API call and no index mutated.
  2. User-scope installs land at `~/.pi/workflows/saved/<plugin>:<name>.json` and project-scope at `~/.pi/workflows/projects/<key>/saved/<plugin>:<name>.json`; the deprecated `<cwd>/.pi/workflows/saved/` legacy path is never written; and the derived project key matches the engine byte-for-byte across the 14 measured edge cases, held as **hard-coded** expectations (unicode names slugging to `project`, the >48-char truncation whose dash-strip precedes the slice, `/`, relative paths, `..` normalization).
  3. NFR-10 admits three new paths under one new writable root — both saved directories and staging — and a write anywhere else, inside or outside that root, is still refused at the containment chokepoint.
  4. Staging sits adjacent to its target under `~/.pi/workflows/`, so the commit `rename()` succeeds for a project-scope install whose `<extensionRoot>` is on a different filesystem from `$HOME` — the EXDEV failure reproduced directly during the spikes.
  5. Discovery scans the workflows directory flat and non-recursively, refuses symlinks per D-14, and dedups first-wins; a script that cannot be read or staged is reported through the bridge `warnings[]` channel without failing the plugin install.
  6. Workflows materialize as a 6th phase of the install ledger, and a failure in any later phase unstages them, leaving nothing behind under `~/.pi/workflows/`.
  7. The `info` command's `workflows:` line shows each script's admitted `meta.name` rather than its file stem. Phase 101 built this line against the file stem and named Phase 102 as the phase that would swap the name source; Phase 102's scope fence forbids reading directories, so the swap lands here — the discover path already reads every script's source, and `discoverComponentNames` consumes the same verdicts at no new I/O cost.

**Plans**: 4 plans

Plans:

- [x] 103-01-PLAN.md — the tracer slice: one script from a plugin directory to an engine-discoverable envelope through every layer, then the unstage half that makes it reversible
- [x] 103-02-PLAN.md — the fourteen project-key parity cases, the bundle's paths and refusal set, and the project-scope landing
- [x] 103-03-PLAN.md — the per-file soft-fail channel, the collision hard-fail, and the install record's workflows inventory
- [x] 103-04-PLAN.md — the `info` name swap on both arms, the containment-clause amendment, and the live storage canary

### Phase 104: Workflow lifecycle completion

**Goal**: Every remaining lifecycle verb keeps workflow artifacts in step with the plugin, so nothing executable is ever left outside the scope root with no record tracking it.
**Depends on**: Phase 103 (composes the same bridge triplet the install ledger uses)
**Requirements**: WLIF-02, WLIF-03, WLIF-04, WLIF-05, WLIF-06
**Success Criteria** (what must be TRUE):

  1. `update` to a plugin version that adds one workflow, removes another and changes a third's `meta.name` leaves exactly the new version's artifacts on disk and nothing from the old one.
  2. `uninstall` removes every workflow artifact its install wrote, in both scopes, leaving `~/.pi/workflows/` free of that plugin's files — the load-bearing case, since these artifacts live outside `<scopeRoot>` and a gap here leaks executable files with nothing tracking them.
  3. `reinstall` replaces the artifacts, and `disable` removes them while `enable` re-materializes them — each checked against its own composition rather than assumed covered by the `runPhases` change, which only `install` and `update` consume.
  4. When a removed workflow's command lingers for the rest of the session, the user is told the reload remedy — Pi has no `unregisterCommand`, so the asymmetry is a host limitation to report, not a defect to hide.

**Plans**: 6 plans

Plans:

- [x] 104-01-PLAN.md — extract the hermetic workflow-home test helper and teach the update fixtures to express two named scripts
- [x] 104-02-PLAN.md — the sixth cascade unstage, the structured unstage failure, and the live canary's removal assertion
- [x] 104-03-PLAN.md — supply the recorded inventory and refuse an unowned target in one change; prove the disable/enable round trip converges
- [x] 104-04-PLAN.md — update's four insertion sites, the widened phase union, and the add/remove/rename triad
- [x] 104-05-PLAN.md — reinstall's handle set, the commit-in-place slot, and the dropped carry-forward parameter
- [x] 104-06-PLAN.md — the lingering-command reason token, its catalog state, and the four verbs that stamp it

### Phase 105: Workflow degradation and documentation

**Goal**: A user without the host engine still gets their workflows written and is told plainly why they do not run yet, and the contract of a bridge that installs executable code is stated where a plugin author will read it.
**Depends on**: Phase 104 (the degradation reason rides the rows every lifecycle verb composes, and the converge-on-`/reload` behavior is only verifiable once artifacts exist)
**Requirements**: WDEP-01, WDEP-02, WDEP-03, WDEP-04, WDOC-01, WDOC-02
**Success Criteria** (what must be TRUE):

  1. The host engine is detected by the quintinshaw-specific `workflow_control` tool via the RH-3/RH-4 `pi.getAllTools()` pattern, and a session carrying `@nicknisi/pi-workflows` instead does not read as present — the false positive a bare `workflow` probe produces.
  2. With no engine loaded, the plugin still installs and its workflow artifacts are still written, with the row carrying the new degradation reason at the severity the tri-state model gives it; degradation never blocks the install.
  3. Installing the engine and running `/reload` makes those already-installed workflows run, with no reinstall — which is what makes the write-anyway choice correct rather than merely harmless.
  4. `workflows` is the third member of `DEPENDENCIES` with its marker, the new token joins the closed `REASONS` set, and `docs/output-catalog.md` carries the token and the new rendered states under the existing byte-equality gate.
  5. The docs state plainly that this is the first bridge to install executable code rather than data, name the host engine and the trust grounds it was chosen on, and separate which script semantics are guaranteed from which diverge from Claude — including that Claude's `agent()` resolves to `null` on failure with a documented `pipeline(...)` + `.filter(Boolean)` pattern, and that both candidate host engines diverge from it, each claim labelled with its evidence grade: `@nicknisi` throws (measured at runtime), quintinshaw rejects (read from the published 3.5.1 source, not driven at runtime).

**Plans**: 4 plans

Plans:

- [x] 105-01-PLAN.md — the tracer: the `workflow_control` probe, the third `DEPENDENCIES` member with its marker and reason token, the required declares-flag through every render path, and the two byte-gated catalog states
- [x] 105-02-PLAN.md — the six remaining `Dependency[]` derivations and a stamp-coverage gate, because widening a derivation is not compile-forced
- [x] 105-03-PLAN.md — probe independence at three strengths: the byte-equality pair, the bridge boundary gate, and the live canary's engine-absent assertion
- [x] 105-04-PLAN.md — `docs/workflows-compatibility.md`, the README pair in both languages, and the three stale prose surfaces

## Progress

**Execution Order:**
Phases execute in numeric order: 101 → 102 → 103 → 104 → 105

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 101. Workflow component-kind recognition | 4/4 | In Progress|  |
| 102. Workflow naming and script admission | 0/2 | Not started | - |
| 103. Workflow artifact materialization | 4/4 | Complete    | 2026-08-15 |
| 104. Workflow lifecycle completion | 6/6 | Complete    | 2026-08-15 |
| 105. Workflow degradation and documentation | 4/4 | Complete    | 2026-08-16 |

## Coverage

| Requirement | Phase |
|-------------|-------|
| WFLW-01 | Phase 101 |
| WFLW-02 | Phase 101 |
| WFLW-03 | Phase 101 |
| WFLW-04 | Phase 101 |
| WNAM-01 | Phase 102 |
| WNAM-02 | Phase 102 |
| WNAM-03 | Phase 102 |
| WNAM-04 | Phase 102 |
| WNAM-05 | Phase 102 |
| WNAM-06 | Phase 102 |
| WVAL-01 | Phase 102 |
| WVAL-02 | Phase 102 |
| WVAL-03 | Phase 102 |
| WDOC-03 | Phase 102 |
| WBRG-01 | Phase 103 |
| WBRG-02 | Phase 103 |
| WBRG-03 | Phase 103 |
| WBRG-04 | Phase 103 |
| WPTH-01 | Phase 103 |
| WPTH-02 | Phase 103 |
| WPTH-03 | Phase 103 |
| WPTH-04 | Phase 103 |
| WPTH-05 | Phase 103 |
| WLIF-01 | Phase 103 |
| WLIF-02 | Phase 104 |
| WLIF-03 | Phase 104 |
| WLIF-04 | Phase 104 |
| WLIF-05 | Phase 104 |
| WLIF-06 | Phase 104 |
| WDEP-01 | Phase 105 |
| WDEP-02 | Phase 105 |
| WDEP-03 | Phase 105 |
| WDEP-04 | Phase 105 |
| WDOC-01 | Phase 105 |
| WDOC-02 | Phase 105 |

All 35 v1 requirements mapped to exactly one phase. No orphans, no duplicates.

---

*Roadmap created: 2026-08-14*
