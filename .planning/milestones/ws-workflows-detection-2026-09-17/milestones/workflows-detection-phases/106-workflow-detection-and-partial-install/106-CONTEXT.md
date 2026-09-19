# Phase 106: Workflow Detection and Partial Install - Context

**Gathered:** 2026-08-29
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase finds workflow components declared by marketplace entries or
`plugin.json`. It also finds the conventional `<pluginRoot>/workflows/`
directory. An affected plugin becomes `partially-available` and shows the exact
`{workflows}` reason. The existing `--partial` path installs only supported
components.
Workflow validation, materialization, and execution remain out of scope.

</domain>

<decisions>
## Implementation Decisions

### Unsupported-component alignment

- **D-106-01:** Treat `workflows` as an opaque optional unsupported-component
  declaration in both marketplace entries and standalone `plugin.json` files.
  A defined top-level field is a declaration regardless of its value, matching
  the existing presence-based rule for other unsupported component fields.
- **D-106-02:** Detect the conventional `workflows/` path by directory
  existence. Do not inspect, parse, or validate its contents. Declaration and
  convention detection are additive signals and collapse to one `workflows`
  kind.
- **D-106-03:** Apply the same workflow detection in strict and loose resolver
  modes through the shared unsupported-kind collection path.
- **D-106-04:** Map the typed `workflows` kind to the dedicated closed-set
  `{workflows}` reason on every unsupported-reason surface. Use the existing
  first-wins deduplication and canonical resolver ordering when other reasons
  are also present. Do not add source-specific reason variants.
- **D-106-05:** Preserve the generic partial-install contract. A normal install
  rejects a workflow-bearing plugin, while `--partial` admits its
  `partially-available` resolution and stages only supported components. Persist
  `workflows` in the installation record's compatibility data, but never add
  workflow paths to materialized resources.
- **D-106-06:** Preserve structural-failure precedence. Workflow detection is
  a soft unsupported-component signal and cannot make an otherwise malformed
  plugin materializable.

### the agent's Discretion

- Choose the exact closed-set tuple position for `workflows` while preserving
  stable ordering for all existing unsupported kinds.
- Choose test organization and helper extraction, provided declaration,
  convention, resolver-mode, output-parity, and no-materialization behavior are
  covered.
- Do not add new declaration namespaces unless research finds an existing
  authoritative schema rule that the resolver already follows for comparable
  unsupported components.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone contract

- `.planning/workstreams/workflows-detection/REQUIREMENTS.md` — Defines WDET-01 through WDET-06, including the
  exact reason token and the no-materialization boundary.
- `.planning/workstreams/workflows-detection/ROADMAP.md` — Defines the Phase 106 goal, success criteria, and
  dependency on completed Phase 105.
- `.planning/PROJECT.md` — Defines the project constraints, current milestone,
  and established partial-availability behavior.

No external specification or ADR was cited during discussion.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `extensions/pi-claude-marketplace/domain/components/plugin.ts` centralizes
  the opaque unsupported fields shared by marketplace entries and
  `plugin.json`.
- `extensions/pi-claude-marketplace/domain/resolver.ts` owns the unsupported
  kind tuple, conventional-path table, shared collection loop, and three-way
  materializability decision.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` is the shared
  kind-to-reason mapping used to keep list, info, and install output aligned.

### Established Patterns

- Unsupported declarations use `Type.Optional(Type.Unknown())` and are
  detected by field presence rather than content validation.
- Conventional unsupported components use `stat` kind checks. Declaration and
  convention detection feed one deduplicated kind list.
- Structural defects resolve as `unavailable`. Unsupported kinds resolve as
  `partially-available` and retain `pluginRoot` and supported components.
- `requireInstallable` rejects the partial arm. `requirePartialInstallable`
  admits it and the normal ledger naturally stages only supported components.

### Integration Points

- Extend the shared plugin schemas and resolver unsupported-kind collection.
- Extend the closed reason vocabulary and shared `workflows` reason mapping.
- Verify every resolver consumer and rendered surface through the existing
  parity seams rather than adding per-surface workflow branches.
- Verify installation records retain `compatibility.unsupported =
  ["workflows"]` as applicable while all materialized resource lists omit
  workflows.

</code_context>

<specifics>
## Specific Ideas

Use the current `claude-security` and `code-modernization` plugin layouts as
conventional-directory regression cases. Keep workflow handling deliberately
boring: it is another unsupported component, except that its user-visible
reason is the exact `{workflows}` token required by the milestone.

</specifics>

<deferred>
## Deferred Ideas

Workflow discovery beyond presence detection, validation, materialization, and
execution remain future work.

</deferred>

---

*Phase: 106-workflow-detection-and-partial-install*
*Context gathered: 2026-08-29*
