# Phase 101: Workflow component-kind recognition - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

A plugin carrying workflow scripts resolves as carrying installable workflow
components -- whether it declares them in its manifest or ships them by
convention -- and its resolved sources are enumerable through
`componentPaths.workflows`, the same per-kind shape every other component kind
uses.

This phase is **recognition only**. It ends where the resolver's output ends:
the kind is admitted, the paths are collected, and the `info` surface reports
the kind. It does NOT extract `meta.name` (Phase 102), does NOT write any
artifact (Phase 103), and does NOT probe for the host engine or emit a
degradation reason (Phase 105).

</domain>

<decisions>
## Implementation Decisions

### Resolver admission shape

- `workflows` joins **both** `SUPPORTED_COMPONENT_KINDS` (the public closed set)
  and `SUPPORTED_COMPONENT_PATH_KINDS` (the private path-bearing subset). The
  Claude manifest field is path-bearing (`string | array`, "Custom workflow
  script files or directories, replaces default `workflows/`") and the
  convention directory name equals the kind name, so `collectStrictComponentKind`
  already implements the required both-axes shape -- declared-in-manifest OR
  convention-on-disk -- with no new code.
- Both resolution modes admit it through the shared tuple. `resolveLoose`
  iterates the same `SUPPORTED_COMPONENT_PATH_KINDS`, so entry-declared
  workflows resolve and a manifest-only declaration produces the existing
  `component declarations conflict` note. No mode-specific split of the tuple.
- Both tuples get `workflows` **appended last**:
  `["skills", "commands", "agents", "hooks", "workflows"]` and
  `["skills", "commands", "agents", "workflows"]`. Order is a locked contract;
  appending is the minimal reviewable delta.
- `componentPaths.workflows` is **required, not optional** --
  `Type.Array(Type.String())` on `ComponentPathsSchema`, and `workflows: []` in
  `emptyResolution()`, matching the other three members. A missing-vs-empty
  distinction buys nothing and would force `?? []` at every consumer.

### Discovery and validation semantics

- A declared path that does not exist on disk is **accepted into
  `componentPaths.workflows` with no note** -- identical to skills, commands and
  agents. `validateComponentPath` is shape-only (relative + containment); it
  never stats. WFLW-02 asks for exactly this treatment.
- A manifest field naming a **file** and one naming a **directory** are both
  accepted verbatim, because validation is shape-only and no branch is needed.
  The convention probe stays `statKind === "dir"` on `<pluginRoot>/workflows`.
- An **empty** `workflows/` directory still puts `workflows` into `supported[]`.
  The directory existing is the signal, exactly as for an empty `skills/`.
  Emptiness surfaces downstream as zero enumerated names.
- This phase emits **no** workflows-specific note or reason token. No
  degradation reason, no soft-dependency marker, no `contains workflows` note.
  Those belong with the `workflow_control` probe (WDEP, Phase 105); adding a
  placeholder now would fight the closed `REASONS` set twice.

### Surface signal and closed-set gates

- The `info` `workflows:` line **lands in this phase**, because SC 3 names both
  `list` and `info`. That means: add `workflows?: readonly string[]` to
  `PluginInfoComponentsResolved.components`, grow `COMPONENT_KINDS` in
  `shared/notify.ts` from a 5-tuple to a 6-tuple, and widen
  `discoverComponentNames`'s `kind` union to accept `"workflows"` with `.js`
  entries.
- The line shows the **file stem** in this phase. Phase 102 swaps the name
  source to the extracted `meta.name`. This phase owns the plumbing; Phase 102
  owns the name. The intermediate stem-named state never reaches a user because
  both phases land in the same milestone.
- The pinned closed-set test at `tests/architecture/hooks-foundation.test.ts:199`
  is **updated in place** to the 5-tuple, dropping "4-tuple" from its title and
  keeping its locked-shape-and-order rationale. No second parallel pin.
- New tests **extend existing files**: `tests/domain/resolver-strict.test.ts` and
  `tests/domain/resolver-loose.test.ts` for behavior,
  `tests/architecture/hooks-foundation.test.ts` for the closed-set pin, and
  `docs/output-catalog.md` plus its byte-equality gate for the new `info` line.
  No new test file.

### Claude's Discretion

- The exact wording of updated comments and test titles, subject to
  `.claude/rules/typescript-comments.md` (decision and requirement IDs are
  traceability anchors and stay; planning-artifact references are forbidden).
- Whether `discoverComponentNames`'s `.js` handling reuses `nameFromEntry` with
  a new kind arm or takes a small dedicated branch, provided the sorted,
  deduped, `readonly string[]` contract is unchanged.
- Fixture placement and naming for the new resolver test cases.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/resolver.ts::collectStrictComponentKind` (line 882) already unions
  entry-declared + manifest-declared + convention-on-disk paths with first-wins
  dedup, and pushes the kind into `partial.supported` when any path landed. This
  is the both-axes mechanism WFLW-01/WFLW-02 require; it needs no change beyond
  the tuple membership.
- `domain/resolver.ts::validateComponentPath` (line 804) does shape-only
  validation -- non-string reject, absolute reject, `assertPathInside`
  containment -- and is `SupportedPathKind`-typed, so it widens automatically.
- `domain/resolver.ts::collectLooseComponentKind` (line ~1250) is the loose-mode
  counterpart, entry-only with a manifest-conflict note.
- `orchestrators/plugin/info.ts::discoverComponentNames` (line 311) is the
  per-kind name enumerator; its `kind` parameter is a
  `"skills" | "commands" | "agents"` union today.

### Established Patterns

- `SUPPORTED_COMPONENT_KINDS` is the PUBLIC closed set read by surface renderers
  and architecture tests; `SUPPORTED_COMPONENT_PATH_KINDS` is the PRIVATE subset
  that carries per-entry component-path semantics. `hooks` sits in the first and
  not the second, because its discovery is a convention *file*, not a path field.
  `workflows` sits in both.
- `COMPONENT_KINDS` in `shared/notify.ts:3308` is a length-exact tuple derived
  from `keyof PluginInfoComponentsResolved["components"]`. Adding a key to the
  interface without growing the tuple is a deliberate typecheck failure, so the
  renderer can never silently omit a kind.
- `decideResolution` gives structural defects precedence over unsupported-kind
  signal, so `unavailable` never leaks `pluginRoot` (NFR-7).
- Closed-set contracts are pinned by architecture tests that assert exact shape
  and order, with the rationale in the assertion message.

### Integration Points

- `domain/resolver.ts` -- `ComponentPathsSchema` (line 62), the
  `PartialResolution` interface (line 378), `emptyResolution()` (line 402), and
  the two tuples (lines 325 / 336).
- `shared/notify.ts` -- `PluginInfoComponentsResolved` (line 1390) and
  `COMPONENT_KINDS` / `appendResolvedComponentLines` (lines 3300-3348).
- `orchestrators/plugin/info.ts` -- `discoverComponentNames` (line 311) and its
  call site (lines 687-696).
- `tests/architecture/hooks-foundation.test.ts` -- the closed-set pin.
- `docs/output-catalog.md` -- the byte-equality gate over rendered output.

### Consequence to check during planning

- `orchestrators/reconcile/apply.ts::supportedSetGrew` (line 1286) re-materializes
  an installed plugin when the resolved supported set is strictly larger than the
  recorded one and still contains every recorded kind. Admitting `workflows`
  moves that boundary, so a plugin already installed with a `workflows/`
  directory will re-resolve with a grown supported set on the next reconcile.
  That is the intended CR-01 self-healing path, but the plan must confirm the
  behavior is correct rather than accidental, and cover it with a test.

</code_context>

<specifics>
## Specific Ideas

- The evidence base is fixed and non-negotiable: of 44 sampled repos, 16 are
  real Claude plugins shipping `workflows/` and **zero** declare the manifest
  field. Convention detection is the load-bearing axis; a field-only
  implementation finds none of them. Any test suite for this phase must exercise
  the convention-only plugin as the primary case, not as an afterthought.
- `bridges/agents/` is the wrong model for anything in this milestone -- there is
  no index to mutate. This phase touches no bridge at all.

</specifics>

<deferred>
## Deferred Ideas

- Extracting the command name from the script's exported `meta` with an acorn AST
  walk, and swapping the `info` line's name source from file stem to `meta.name`
  -- Phase 102.
- The engine-preprocessor pre-validation that admits or refuses each script --
  Phase 102.
- Writing any artifact, the `bridges/workflows/` triplet, the NFR-10 containment
  root amendment, and the 6th install-ledger phase -- Phase 103.
- The `workflow_control` soft-dependency probe, the third `DEPENDENCIES` member,
  and the new degradation reason token -- Phase 105.

</deferred>
