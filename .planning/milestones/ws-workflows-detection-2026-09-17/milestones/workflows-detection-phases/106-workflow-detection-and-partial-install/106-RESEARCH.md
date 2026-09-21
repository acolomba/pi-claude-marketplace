# Phase 106: Workflow Detection and Partial Install - Research

**Researched:** 2026-08-29
**Domain:** TypeScript manifest admission, resolver classification, partial-install gating, and terminal reason parity
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

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

### Deferred Ideas (OUT OF SCOPE)

Workflow discovery beyond presence detection, validation, materialization, and
execution remain future work.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WDET-01 | The schemas accept a `workflows` declaration in marketplace entries and `plugin.json` files. | Add one opaque optional field to the shared unsupported-field object, which both schemas spread. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44,61-81,93-102] |
| WDET-02 | The resolver finds `<pluginRoot>/workflows/` without a manifest declaration. This includes the current `claude-security` and `code-modernization` layouts. | Add one fixed `dir` convention to the shared convention table; test both named layouts with synthetic plugin roots. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:375-397,532-567] |
| WDET-03 | A plugin with workflows resolves as `partially-available` and records `workflows` as an unsupported component. | Append the kind to the shared unsupported tuple. The existing decision stage already emits the partial arm after structural checks. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:375-383,1619-1640] |
| WDET-04 | Each unsupported-reason surface shows the exact `{workflows}` reason. | Extend the closed reason union and the single shared kind-to-reason classifier; keep all orchestrators on `narrowUnsupportedKinds`. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:68-85,183-216] |
| WDET-05 | A normal install rejects the partial plugin. An install with `--partial` installs only its supported components. | Reuse the existing `requireInstallable` versus `requirePartialInstallable` gate and existing supported-component ledger. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:748-770,915-1248] |
| WDET-06 | The extension does not materialize or execute workflow files. | Do not add a workflow bridge, ledger phase, resource schema field, or reload discovery field. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:915-1248; extensions/pi-claude-marketplace/persistence/state-io.ts:81-126; extensions/pi-claude-marketplace/orchestrators/discover.ts:10-52] |
</phase_requirements>

## Summary

Phase 106 is a narrow extension of the existing unsupported-component path. Add `workflows` to the shared opaque schema fields, append it to the resolver's canonical unsupported-kind tuple, and add a fixed `workflows/` directory convention. The shared collector already combines marketplace declarations, `plugin.json` declarations, and conventional paths into one ordered, deduplicated list for strict and loose modes. Structural errors are evaluated before unsupported kinds become `partially-available`. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44,61-81,93-102; extensions/pi-claude-marketplace/domain/resolver.ts:511-567,1545-1568,1619-1640]

No new installation machinery is required. The normal install gate already rejects the partial arm, while the `--partial` gate admits it. The materialization ledger has phases only for supported artifacts and persistence already stores arbitrary unsupported-kind strings separately from the fixed resource inventory. Therefore, the safest implementation changes classification and presentation only; it must not introduce a workflow bridge, workflow resource field, or execution path. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1689-1743; extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:748-770,915-1248; extensions/pi-claude-marketplace/persistence/state-io.ts:81-126]

Claude's current plugin reference recognizes both a `workflows` manifest field and a conventional `workflows/` plugin directory. It describes workflow values as custom file or directory paths, but this phase must deliberately ignore those values because D-106-01 and D-106-02 make the adapter's support detection opaque and presence-based. [CITED: https://code.claude.com/docs/en/plugins-reference]

**Primary recommendation:** Implement one end-to-end unsupported kind through the four shared seams—schema, resolver tuple/convention, reason vocabulary/classifier, and tests—while leaving install staging, state resources, and reload discovery structurally unchanged.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Accept workflow declarations | API / Backend (domain schema) | — | The shared `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA` both spread one unsupported-field object. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44,61-81,93-102] |
| Detect declarations and `workflows/` | API / Backend (resolver) | Filesystem boundary | The resolver owns the canonical kind tuple, fixed-path stat conventions, and shared collection loop. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:375-397,511-567] |
| Decide unavailable versus partial | API / Backend (resolver state machine) | — | Structural dirtiness wins before the unsupported list selects the partial arm. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1619-1640] |
| Enforce explicit partial consent | API / Backend (install orchestrator) | Command parser | The install orchestrator selects the normal or partial resolver gate from `opts.partial`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:748-770] |
| Render `{workflows}` everywhere | Shared presentation classifier | Terminal renderer | Consumers narrow typed kinds through one classifier; the renderer accepts only its closed reason vocabulary. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:183-216; extensions/pi-claude-marketplace/shared/notify.ts:84-190] |
| Retain compatibility metadata | Database / Storage (state JSON) | Install orchestrator | `compatibility.unsupported` is separate from the fixed materialized-resource inventory. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:81-126; extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1177-1227] |
| Exclude workflow execution and reload discovery | API / Backend (materialization boundary) | Pi host reload | The ledger has no workflow phase, and reload discovery returns only `skillPaths` and `promptPaths`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:915-1248; extensions/pi-claude-marketplace/index.ts:64-137] |

## Project Constraints (from AGENTS.md)

- Read a file before editing it, trace callers before changing a function, and research before implementation.
- Work on `features/workflows-detection` in its linked worktree. Never commit to `main`, rebase, or rewrite history.
- Keep TypeScript strict and preserve the discriminated materializability contract so non-materializable arms do not expose `pluginRoot`.
- Preserve atomic file mutations, retry safety, containment, and `/reload` recovery. This phase must not add a network operation.
- Keep every user-visible message on the existing structured `ctx.ui.notify(message, severity)` path. Do not write to process stdout or stderr in command or bridge code.
- Keep the project English-only and telemetry-free.
- Keep `npm run check` green. Before a later commit, run the required pre-commit checks and the worktree-specific filesystem TruffleHog scan; never use `--no-verify`.
- Use Conventional Commits if implementation is committed later. Release and PR handoff must also follow the repository's version, changelog, title, and squash-merge rules.
- Write project documentation in clear, direct English under the project `simple-english` skill.

These directives come from the user-supplied `AGENTS.md` for this workspace. [VERIFIED: user-supplied AGENTS.md, 2026-08-29]

## Standard Stack

### Core

| Library / Runtime | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| Node.js | `>=20.19.0` | Runtime and built-in test runner | This is the declared project runtime. [VERIFIED: package.json:31-33,74-89] |
| TypeScript | `^6.0.3` | Strict domain unions and exhaustive closed sets | The resolver and notification contracts are TypeScript discriminated unions. [VERIFIED: package.json:27-29; extensions/pi-claude-marketplace/domain/resolver.ts:161-261] |
| TypeBox | `^1.1.38` | Runtime schemas for marketplace entries and plugin manifests | Both affected schemas already use TypeBox and share the unsupported-field object. [VERIFIED: package.json:27-28; extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44,61-81,93-102] |
| `node:test` | Built into Node.js | Unit, architecture, integration, and E2E tests | Existing relevant tests import `node:test`, and repository scripts execute them with `node --test`. [VERIFIED: tests/domain/manifest.test.ts:1-5; package.json:74-89] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Existing filesystem helpers | Repository code | Safe stat and test cleanup behavior | Reuse the resolver's convention-stat path and existing staging helpers; do not create a workflow reader. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:532-567; tests/orchestrators/discover.test.ts:1-14] |
| Existing structured notification system | Repository code | Closed reasons, status rows, hints, and reload trailer | Extend only the reason vocabulary and shared classifier. [VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:84-190; extensions/pi-claude-marketplace/shared/probe-classifiers.ts:183-216] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Shared unsupported-kind collection | Per-command workflow detection | Rejected: it would duplicate filesystem policy and cause strict/loose or surface drift. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:532-567,1545-1568] |
| Opaque `Type.Unknown()` field | A custom workflow payload schema | Rejected by D-106-01; upstream payload semantics are not support semantics for this adapter. [CITED: https://code.claude.com/docs/en/plugins-reference] |
| Existing partial-install ledger | A workflow-specific partial installer | Rejected: workflows are unsupported and must never be staged. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:17-22; extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:915-1248] |

**Installation:** No package installation. Phase 106 uses the current stack. [VERIFIED: package.json:8-29]

## Architecture Patterns

### System Architecture Diagram

```text
marketplace entry + optional plugin.json + resolved plugin root
                         |
                         v
                TypeBox schema admission
                         |
                         v
      shared collectUnsupportedKinds(entry, manifest, root)
         | declaration present       | workflows/ is a dir
         +---------------------------+
                         |
                 one ordered `workflows` kind
                         |
                         v
             structural decision point
             /                         \
      malformed                         sound + workflows
      unavailable                       partially-available
                                            |
                         +------------------+------------------+
                         |                                     |
                   normal gate                         --partial gate
                   reject + hint                       admit supported set
                                                               |
                             supported bridges + transaction ledger only
                                                               |
                  state.compatibility.unsupported = ["workflows"]
                  state.resources = skills/prompts/agents/mcp/hooks only
                                                               |
                     /reload discovers skillPaths + promptPaths only

typed unsupported kind -> narrowUnsupportedKinds -> `workflows`
                                             -> notify -> `{workflows}`
```

This flow follows existing resolver, gate, ledger, persistence, classifier, and discovery boundaries. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:511-567,1619-1743; extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:915-1248; extensions/pi-claude-marketplace/persistence/state-io.ts:81-126; extensions/pi-claude-marketplace/orchestrators/discover.ts:10-52]

### Recommended Project Structure

```text
extensions/pi-claude-marketplace/
├── domain/components/plugin.ts           # opaque declaration admission
├── domain/resolver.ts                    # kind tuple + directory convention
├── shared/probe-classifiers.ts           # typed kind -> exact reason
├── shared/notify.ts                      # closed REASONS tuple
└── shared/notify-reasons.ts              # reason-group coverage union

tests/
├── domain/manifest.test.ts               # entry + plugin.json acceptance
├── domain/resolver-strict.test.ts        # declarations, convention, precedence
├── domain/resolver-loose.test.ts         # shared-mode parity
├── shared/probe-classifiers.test.ts      # exact mapping, order, dedupe
├── orchestrators/plugin/
│   ├── cross-surface-reason-parity.test.ts
│   └── install.test.ts                   # consent, staging, state, no copy
├── orchestrators/discover.test.ts        # reload resource boundary
└── architecture/
    ├── notify-closed-set-locks.test.ts
    └── catalog-uat.test.ts

docs/output-catalog.md                    # byte-level output contract
```

Every listed production seam and test analog already exists at these paths. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-102; extensions/pi-claude-marketplace/domain/resolver.ts:375-397; tests/domain/resolver-strict.test.ts:629-661; tests/orchestrators/plugin/install.test.ts:5409-5755]

### Pattern 1: Extend the shared opaque declaration object

**What:** Add one optional unknown field to `UNSUPPORTED_COMPONENT_FIELDS`. Both marketplace-entry and plugin-manifest schemas spread that object, so one edit covers both inputs. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44,61-81,93-102]

**When to use:** Use for top-level workflow declarations only. Do not add an `experimental` workflow namespace because the only current nested special cases are themes and monitors. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:511-529]

**Example:**

```typescript
// Required by WDET-01 and D-106-01.
workflows: Type.Optional(Type.Unknown()),
```

The exact new key is `workflows`, and both target declaration locations are required by WDET-01. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:9-13]

### Pattern 2: Append one unsupported kind and one fixed convention

**What:** Append `workflows` to `UNSUPPORTED_COMPONENT_KINDS`, then append `{ relativePath: "workflows", kind: "dir" }` to `UNSUPPORTED_COMPONENT_CONVENTIONS`. The existing collection loop checks each kind once, prefers a declaration, and otherwise checks the convention; declaration plus directory therefore collapses to one list entry. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:375-397,532-567]

**When to use:** Use in both strict and loose resolution through the existing shared driver. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1545-1568]

```typescript
// Append after every existing member to preserve all existing positions.
"workflows",

// Append to the fixed convention table.
{ relativePath: "workflows", kind: "dir" },
```

The exact new kind and directory are required by WDET-02 and D-106-02. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:11-13; .planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-CONTEXT.md:23-32]

### Pattern 3: Map once at the classifier boundary

**What:** Add `workflows` to `UnsupportedReason`, map only that typed kind to `workflows`, and append the reason to `REASONS`. Also add it to the `UnsupportedReason` topic group in `notify-reasons.ts` so the compile-time coverage proof remains exhaustive. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:68-85,183-216; extensions/pi-claude-marketplace/shared/notify-reasons.ts:93-105,217-257]

**When to use:** Use for list, info, install, update, autoupdate, enable, reconcile, and backfill projections. Do not copy this mapping into any orchestrator. [VERIFIED: .planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-UI-SPEC.md:215-229]

```typescript
if (kind === "workflows") return "workflows";
```

The exact input and output literal are locked by WDET-04 and the UI contract. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:15-18; .planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-UI-SPEC.md:104-137]

### Pattern 4: Prove absence at materialization boundaries

**What:** Assert that a workflow-bearing plugin can stage a supported skill under `--partial`, while the workflow source file is absent from every materialized target and every state resource list. Assert only `compatibility.unsupported` contains `workflows`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1177-1227; extensions/pi-claude-marketplace/persistence/state-io.ts:81-126]

**When to use:** Use one integration-style install test for the complete WDET-05/WDET-06 contract. Keep reload discovery coverage on its stable unit seam because discovery exposes only skill and prompt arrays. [VERIFIED: tests/orchestrators/plugin/install.test.ts:5409-5755; tests/orchestrators/discover.test.ts:58-90]

### Anti-Patterns to Avoid

- **Parsing the declaration:** A custom manifest path is not an instruction to read, validate, copy, or execute content in this phase. Upstream supports custom workflow paths, but this adapter's locked contract is detection-only. [CITED: https://code.claude.com/docs/en/plugins-reference]
- **Adding `workflows` to `MANIFEST_FIELD_REASONS`:** The install messaging path already begins with typed unsupported kinds and then narrows generic `contains <kind>` notes. A second special case would duplicate classification policy. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:430-472,521-550,594-630]
- **Adding a workflow ledger phase or bridge:** The current ledger intentionally materializes only supported component classes. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:915-1248]
- **Adding `resources.workflows`:** The state schema separates compatibility facts from materialized resources. Expanding the resource object would misrepresent an unsupported component and create needless migration surface. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:81-126,147-178]
- **Testing only one resolver mode:** Both modes pass through the same unsupported collector; a regression in either entry route must be pinned. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1545-1568]
- **Letting the soft signal hide structural failure:** The resolver's structural arm must remain first. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1619-1640]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Workflow payload validation | A workflow schema, parser, or script validator | `Type.Optional(Type.Unknown())` presence admission | Validation and execution are out of scope, while upstream payloads can name custom files or directories. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:24-36] [CITED: https://code.claude.com/docs/en/plugins-reference] |
| Directory discovery | Recursive scanning or filename matching | Existing fixed-path `dir` convention stat | WDET-02 requires directory existence only, and the resolver already owns this pattern. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:11-13; extensions/pi-claude-marketplace/domain/resolver.ts:386-397,532-567] |
| Partial-install control flow | A workflow-specific option or prompt | Existing `--partial` gate | Normal and partial gates already distinguish the two materializable arms. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1689-1743; extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:748-770] |
| Reason propagation | Per-command `workflows` branches | Shared `narrowUnsupportedKinds` mapping | First-wins deduplication and parity already live in one helper. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:183-216] |
| Workflow persistence | A new resource record or migration | Existing `compatibility.unsupported: string[]` | Compatibility metadata already carries unsupported kind strings independently of materialized paths. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:81-126] |
| Workflow runtime | A bridge, loader, runner, or reload hook | No implementation | WDET-06 explicitly forbids materialization and execution. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:20-22] |

**Key insight:** This phase succeeds by classifying workflows and preserving their absence from every materialization boundary, not by partially implementing workflow support.

## Common Pitfalls

### Pitfall 1: Schema admission without resolver membership

**What goes wrong:** Manifests parse, but workflows never appear in `unsupported`, so the plugin remains fully installable.

**Why it happens:** Schema admission and resolver classification are separate shared tables. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44; extensions/pi-claude-marketplace/domain/resolver.ts:375-383]

**How to avoid:** Change both tables and add an assertion on exact resolver state and `unsupported` order.

**Warning signs:** WDET-01 passes while WDET-03 fails.

### Pitfall 2: Falling through to `{unsupported component}`

**What goes wrong:** Resolver state is correct, but every surface emits the old generic reason.

**Why it happens:** `kindToReason` maps only hooks and LSP specially, then falls back to `unsupported component`. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:199-216]

**How to avoid:** Add the dedicated workflow branch before the fallback and pin typed-kind plus note-path parity.

**Warning signs:** `narrowUnsupportedKinds(["workflows"])` does not return exactly `["workflows"]`.

### Pitfall 3: Closed-set edits are incomplete

**What goes wrong:** Typecheck or architecture tests fail after `REASONS` grows.

**Why it happens:** The tuple, topic union, coverage proof, exact-length lock, and catalog are coordinated contracts. [VERIFIED: extensions/pi-claude-marketplace/shared/notify.ts:84-190; extensions/pi-claude-marketplace/shared/notify-reasons.ts:93-105,217-257; tests/architecture/notify-closed-set-locks.test.ts:1-40]

**How to avoid:** Append one tail member, update the reason topic, change the exact count from the quoted current value `39` to the required new value `40`, and add byte examples. The current source test says `"REASONS is the closed 39-entry reason set"` and asserts `REASONS.length, 39`. [VERIFIED: tests/architecture/notify-closed-set-locks.test.ts:29-40]

**Warning signs:** The compiler's reason coverage proof fails, or catalog UAT reports a fixture/count mismatch.

### Pitfall 4: Duplicate signals become duplicate reasons

**What goes wrong:** A declaration plus a `workflows/` directory renders `{workflows, workflows}`.

**Why it happens:** A second collection path or per-surface mapping bypasses the canonical loop and first-wins classifier deduplication.

**How to avoid:** Reuse `collectUnsupportedKinds` and `narrowUnsupportedKinds`; test declaration plus directory as one exact kind and one exact reason. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:532-567; extensions/pi-claude-marketplace/shared/probe-classifiers.ts:183-197]

**Warning signs:** Exact array assertions contain two workflow entries.

### Pitfall 5: Declared workflow paths are followed

**What goes wrong:** The adapter reads a manifest-controlled path, crosses containment expectations, or executes untrusted code.

**Why it happens:** Upstream defines workflow values as custom paths, which can tempt implementation beyond this phase's scope. [CITED: https://code.claude.com/docs/en/plugins-reference]

**How to avoid:** Treat any defined top-level value as a boolean signal and stat only the fixed literal `<pluginRoot>/workflows` convention.

**Warning signs:** New code iterates a workflow value, resolves a caller-supplied workflow path, reads workflow file contents, or imports a workflow module.

### Pitfall 6: A test proves partial consent but not non-materialization

**What goes wrong:** `--partial` succeeds, but a future generic-copy change can silently stage workflow files.

**Why it happens:** Success-row and state assertions do not inspect target paths or the fixed resource inventory.

**How to avoid:** Seed a sentinel workflow script, run normal and partial installs in fresh environments, inspect all target roots, and assert state resource keys remain exactly `"skills"`, `"prompts"`, `"agents"`, `"mcpServers"`, and `"hooks"`. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:105-125]

**Warning signs:** Tests check only notification text.

### Pitfall 7: The E2E reload check becomes the fast feedback loop

**What goes wrong:** Per-task verification becomes slow or environment-sensitive.

**Why it happens:** `tests/e2e/resources-discover.test.ts` installs named external target fixtures before invoking the reload handler. [VERIFIED: tests/e2e/resources-discover.test.ts:6-20]

**How to avoid:** Use install and discovery unit seams per commit; retain `npm run test:e2e` for the phase gate. The discovery unit directly pins the only returned resource arrays. [VERIFIED: tests/orchestrators/discover.test.ts:58-90; package.json:81-88]

**Warning signs:** A focused edit requires marketplace fixture installation or external cache state.

## Code Examples

Verified implementation shapes from current repository patterns:

### Opaque field shared by both schemas

```typescript
const UNSUPPORTED_COMPONENT_FIELDS = {
  // ...existing fields remain in their existing positions...
  workflows: Type.Optional(Type.Unknown()),
} as const;
```

The existing object uses `Type.Optional(Type.Unknown())` for each unsupported declaration and is spread into both relevant schemas. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44,61-81,93-102]

### Fixed conventional directory detection

```typescript
const UNSUPPORTED_COMPONENT_CONVENTIONS = [
  // ...existing conventions remain unchanged...
  { relativePath: "workflows", kind: "dir" },
] as const;
```

The existing table uses `relativePath` plus `"file" | "dir"` checks, and WDET-02 supplies the exact new path and kind. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:386-397; .planning/workstreams/workflows-detection/REQUIREMENTS.md:11-13]

### Dedicated reason before generic fallback

```typescript
function kindToReason(kind: string): UnsupportedReason {
  if (kind === "lspServers") return "lsp";
  if (kind === "hooks") return "unsupported hooks";
  if (kind === "workflows") return "workflows";
  return "unsupported component";
}
```

The first, second, and fallback branches are the current verbatim values `"lspServers" -> "lsp"`, `"hooks" -> "unsupported hooks"`, and `"unsupported component"`; WDET-04 supplies the exact workflow branch. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:199-216; .planning/workstreams/workflows-detection/REQUIREMENTS.md:15-18]

### No workflow staging branch

```typescript
const record = {
  compatibility: {
    unsupported: [...resolved.unsupported],
  },
  resources: {
    skills,
    prompts,
    agents,
    mcpServers,
    hooks,
  },
};
```

The current state record persists these exact compatibility and resource keys. Keep this shape unchanged except that the existing unsupported array can now contain the requirement-supplied value `"workflows"`. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1177-1227; .planning/workstreams/workflows-detection/REQUIREMENTS.md:11-22]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Only the existing unsupported fields and conventions are classified. | Add workflow declaration and conventional-directory presence to the same opaque unsupported-kind collector. | Phase 106 | Workflow-bearing plugins become partial without adding workflow support. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44; extensions/pi-claude-marketplace/domain/resolver.ts:375-397] |
| Non-hook, non-LSP kinds use `{unsupported component}`. | `workflows` gets its own exact closed reason; all other current mappings stay stable. | Phase 106 | Users can identify the specific unsupported capability across all surfaces. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:199-216; .planning/workstreams/workflows-detection/REQUIREMENTS.md:15-18] |
| Upstream plugin layouts can contain a default `workflows/` directory and manifest-declared custom workflow paths. | This adapter recognizes declaration or conventional-directory presence but does not interpret the payload. | Current upstream reference; Phase 106 adapter boundary | Detection aligns with upstream packaging without creating a runner or custom-path trust boundary. [CITED: https://code.claude.com/docs/en/plugins-reference] |

**Deprecated/outdated:**

- The output catalog currently describes the closed set as `"38-member"`, while the source lock test quotes and asserts `39`. Phase 106 must correct the catalog to the new exact count `40` when it adds `workflows`. [VERIFIED: docs/output-catalog.md:61-65; tests/architecture/notify-closed-set-locks.test.ts:29-40]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | None. The recommendations derive from locked phase decisions, opened repository sources, and the official Claude plugin reference. | — | — |

## Open Questions

No implementation-blocking questions remain. The context locks declaration semantics, fixed-path detection, tuple placement, reason text, partial consent, persistence behavior, and the no-materialization boundary. [VERIFIED: .planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-CONTEXT.md:21-55]

One execution note remains: use synthetic local fixtures named for `claude-security` and `code-modernization` rather than making their tests depend on a network fetch. WDET-02 requires their current layout pattern, and the milestone explicitly forbids new network operations. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:11-13,30-36]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Build and tests | ✓ | `v26.7.0` | Declared minimum is `>=20.19.0`. [VERIFIED: local `node --version`, 2026-08-29; package.json:31-33] |
| npm | Test scripts and phase gate | ✓ | `11.19.0` | Direct `node --test` for focused suites. [VERIFIED: local `npm --version`, 2026-08-29; package.json:74-89] |
| pre-commit | Later commit gate | ✓ | `4.5.1` | None; AGENTS.md requires it before commit. [VERIFIED: local `pre-commit --version`, 2026-08-29] |
| External service or new package | None | Not required | — | This phase uses local code, fixtures, and the existing dependency set. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:30-36; package.json:8-29] |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

The project has Nyquist validation enabled. [VERIFIED: .planning/config.json:16-33]

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` on Node `v26.7.0` locally. [VERIFIED: local `node --version`, 2026-08-29; tests/domain/manifest.test.ts:1-5] |
| Config file | None; commands and glob scopes are defined in `package.json`. [VERIFIED: package.json:74-89] |
| Quick run command | `node --test tests/domain/manifest.test.ts tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat.test.ts` |
| Install-boundary command | `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/discover.test.ts` |
| Full suite command | `npm run check` |

Both focused commands completed successfully before implementation on 2026-08-29: the classification/catalog command passed 7 files in about 2.7 seconds, and the install/discovery command passed 2 files in about 6.5 seconds. [VERIFIED: local test execution, 2026-08-29]

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| WDET-01 | Marketplace entry and standalone `plugin.json` accept opaque defined `workflows` values. | Schema unit | `node --test tests/domain/manifest.test.ts` | ✅ Extend existing cases at `tests/domain/manifest.test.ts:194-205,382-398`. [VERIFIED: tests/domain/manifest.test.ts:194-205,382-398] |
| WDET-02 | Strict and loose resolvers detect a literal `workflows/` directory; `claude-security` and `code-modernization` fixture layouts classify identically. | Resolver unit | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` | ✅ Extend existing convention and partial cases. [VERIFIED: tests/domain/resolver-strict.test.ts:629-661; tests/domain/resolver-loose.test.ts:199-215,292-298] |
| WDET-03 | Declarations and convention yield exact `partially-available` plus `unsupported: ["workflows"]`; declaration plus directory dedups; structural failure still wins. | Resolver unit | `node --test tests/domain/resolver-strict.test.ts tests/domain/resolver-loose.test.ts` | ✅ Existing resolver state tests provide the analogs. [VERIFIED: tests/domain/resolver-strict.test.ts:629-661; tests/domain/resolver-loose.test.ts:199-215] |
| WDET-04 | Typed and note paths emit exact `workflows`, preserve first-wins order, and agree across reason-bearing surfaces. Closed-set count becomes 40 and catalog bytes include `{workflows}`. | Classifier + architecture UAT | `node --test tests/shared/probe-classifiers.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts tests/architecture/notify-closed-set-locks.test.ts tests/architecture/catalog-uat.test.ts` | ✅ Extend existing per-kind and multi-kind parity cases. [VERIFIED: tests/orchestrators/plugin/cross-surface-reason-parity.test.ts:100-185; tests/architecture/notify-closed-set-locks.test.ts:29-40] |
| WDET-05 | Normal install rejects with partial hint; fresh `--partial` run stages supported components and renders `partially-installed` with `{workflows}`. | Orchestrator integration unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ Extend existing partial success and normal rejection cases. [VERIFIED: tests/orchestrators/plugin/install.test.ts:5409-5465,5510-5555,5719-5755] |
| WDET-06 | Sentinel workflow file is absent from target roots and resource inventory; reload discovery exposes only supported skill/prompt paths. | Boundary integration + discovery unit | `node --test tests/orchestrators/plugin/install.test.ts tests/orchestrators/discover.test.ts` | ✅ Existing install fixtures and discovery assertions can be extended. [VERIFIED: tests/orchestrators/discover.test.ts:58-90; extensions/pi-claude-marketplace/persistence/state-io.ts:105-125] |

### Required Test Cases

1. Add `workflows` acceptance cases for both shared schema consumers. Include at least one non-path value to prove opacity and defined-value presence semantics. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44,61-81,93-102]
2. Add strict and loose cases for top-level marketplace declaration, top-level plugin-manifest declaration, conventional directory only, and declaration plus directory. Assert the exact ordered unsupported array. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:511-567,1545-1568]
3. Add a both-defects case: a structural defect plus workflow signal must stay `unavailable`, must not expose a materializable root, and must not gain a partial hint. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1619-1640]
4. Add classifier cases for a single workflow kind, duplicate workflow kinds, and combined existing kinds. Required examples include exact order `["lsp", "workflows"]` and `["unsupported component", "workflows"]`. [VERIFIED: .planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-UI-SPEC.md:118-137]
5. Add one cross-surface parity row for workflows and one multi-kind row. The same typed input must drive list/info and install mapping. [VERIFIED: tests/orchestrators/plugin/cross-surface-reason-parity.test.ts:100-185]
6. Add normal and partial install cases using a supported skill plus a sentinel file under `workflows/`. Use fresh test environments so the rejected normal install cannot contaminate the partial case. Assert no state after rejection, supported materialization after opt-in, exact compatibility metadata, unchanged resource keys, and absence of the sentinel outside the source root. [VERIFIED: tests/orchestrators/plugin/install.test.ts:323-401,5409-5755]
7. Update catalog examples and the exact-length architecture lock in the same change as the reason tuple. [VERIFIED: tests/architecture/notify-closed-set-locks.test.ts:13-16,29-40; tests/architecture/catalog-uat.test.ts:1-40]

### Sampling Rate

- **Per task commit:** Run the smallest affected command from the requirement map; all are below 30 seconds on the current baseline. [VERIFIED: local test execution, 2026-08-29]
- **After resolver/reason integration:** Run both focused commands from the Test Framework table.
- **Per wave merge:** Run `npm test` and `npm run test:integration`. These are the repository's unit and integration script boundaries. [VERIFIED: package.json:81-89]
- **Phase gate:** Run `npm run check`, then `npm run test:e2e` under the repository's expected pinned E2E environment. [VERIFIED: package.json:75-88]
- **Before commit:** Run `pre-commit run --files <changed files>` and the AGENTS.md worktree-specific TruffleHog filesystem scan. Do not commit in the research task.

### Wave 0 Gaps

- [ ] Extend the existing install fixture builder or add a local helper that can create `workflows/` with a sentinel script. [VERIFIED: tests/orchestrators/plugin/install.test.ts:125-186,244-283,323-401]
- [ ] Add workflow-specific cases to the existing test files in the requirement map. No new test framework or config is needed. [VERIFIED: package.json:74-89]
- [ ] Update `docs/output-catalog.md` and its architecture fixture/count contract together. [VERIFIED: docs/output-catalog.md:61-65; tests/architecture/catalog-uat.test.ts:1-40]

## Security Domain

Security enforcement is enabled because `.planning/config.json` does not set `security_enforcement` to `false`. [VERIFIED: .planning/config.json:1-53]

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | No | Phase 106 adds no identity or credential path. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:7-36] |
| V3 Session Management | No | Phase 106 changes plugin classification, not Pi session state. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:7-36] |
| V4 Access Control | No new control | Existing scope and containment policy remains unchanged; no workflow write target is introduced. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:915-1248] |
| V5 Input Validation | Yes | Admit the top-level declaration as opaque input, convert it only to a boolean presence signal, and stat one fixed literal directory. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44; extensions/pi-claude-marketplace/domain/resolver.ts:511-567] |
| V6 Cryptography | No | Phase 106 adds no secret, signature, hash, or transport mechanism. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:7-36] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Manifest-controlled path traversal | Tampering / Elevation of privilege | Ignore workflow payload paths. Stat only `path.join(pluginRoot, "workflows")` through the existing fixed convention path. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:386-397,532-567] |
| Unintended script execution | Elevation of privilege | Never read, import, spawn, validate, or materialize workflow contents. Test with a sentinel script and assert absence from all targets. [VERIFIED: .planning/workstreams/workflows-detection/REQUIREMENTS.md:20-36] |
| Soft signal bypasses structural validation | Tampering | Keep structural failure precedence and assert `--partial` cannot admit the both-defects case. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1619-1640] |
| Unsupported artifact becomes persistent runtime state | Tampering | Store only the string in `compatibility.unsupported`; do not grow the materialized resource schema or reload response. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:81-126; extensions/pi-claude-marketplace/orchestrators/discover.ts:10-52] |
| Surface-specific reason spoofing or drift | Repudiation | Route the typed kind through one closed-set classifier and byte-level catalog tests. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:183-216; tests/architecture/catalog-uat.test.ts:1-40] |

## Sources

### Primary (HIGH confidence)

- `extensions/pi-claude-marketplace/domain/components/plugin.ts` — shared marketplace and plugin manifest schema fields. [VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:34-44,61-81,93-102]
- `extensions/pi-claude-marketplace/domain/resolver.ts` — unsupported kinds, conventions, shared mode path, state precedence, and gates. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:375-397,511-567,1545-1743]
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts`, `shared/notify.ts`, and `shared/notify-reasons.ts` — closed reason classification and coverage. [VERIFIED: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:68-85,183-216; extensions/pi-claude-marketplace/shared/notify.ts:84-190; extensions/pi-claude-marketplace/shared/notify-reasons.ts:93-105,217-257]
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` and `install.messaging.ts` — consent gate, ledger, persistence projection, and presentation consumers. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:748-770,915-1248,1572-1602,1685-1751; extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:430-472,521-630]
- `extensions/pi-claude-marketplace/persistence/state-io.ts`, `orchestrators/discover.ts`, and `index.ts` — no-materialization and reload boundaries. [VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:81-178; extensions/pi-claude-marketplace/orchestrators/discover.ts:10-52; extensions/pi-claude-marketplace/index.ts:64-137]
- Existing tests named in Validation Architecture — exact analogs and executable verification seams. [VERIFIED: tests/domain/resolver-strict.test.ts:629-661; tests/orchestrators/plugin/cross-surface-reason-parity.test.ts:100-185; tests/orchestrators/plugin/install.test.ts:5409-5755]

### Secondary (MEDIUM confidence)

- [Claude Code plugin reference](https://code.claude.com/docs/en/plugins-reference) — official manifest `workflows` field, path behavior, and conventional plugin layout. [CITED: https://code.claude.com/docs/en/plugins-reference]

### Tertiary (LOW confidence)

- None.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — package versions and commands were read from `package.json`, and the local runtime was probed. [VERIFIED: package.json:8-33,74-92; local version probes, 2026-08-29]
- Architecture: HIGH — the resolver, gates, ledger, persistence, classifier, and reload callers were traced from source. [VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:511-1743; extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:748-1248]
- Pitfalls: HIGH — each risk follows from an existing boundary or locked decision and has an exact regression seam. [VERIFIED: .planning/workstreams/workflows-detection/phases/106-workflow-detection-and-partial-install/106-CONTEXT.md:21-55; tests/orchestrators/plugin/cross-surface-reason-parity.test.ts:100-185]
- Upstream format context: MEDIUM — checked against the current official Claude plugin reference through web research. [CITED: https://code.claude.com/docs/en/plugins-reference]

**Research date:** 2026-08-29
**Valid until:** 2026-09-05 for upstream workflow-format statements; repository architecture remains valid until these source seams change.
