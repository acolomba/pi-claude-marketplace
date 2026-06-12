# Phase 51: Config Schema, Persistence & State Split - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-09
**Phase:** 51-Config Schema, Persistence & State Split
**Areas discussed:** Config file shape, Version pin semantics, Schema strictness & evolution, Trichotomy & load-seam shape

---

## Config file shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat: two records | `marketplaces` keyed by name + `plugins` keyed by `plugin@marketplace`; per-plugin override granularity | ✓ |
| Nested under marketplaces | Plugins inside marketplace entries (state.json D-09 style); coarse override unit | |

**User's choice:** Flat: two records (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Raw string | `"source": "acme/claude-tools"` — same string as `marketplace add`, classified via `parsePluginSource` | ✓ |
| Structured object | `{ "kind": "github", ... }` — explicit but verbose, second source grammar | |

**User's choice:** Raw string (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Project root / home | Project scope: relative to project root; user scope: relative to home; `~` expansion | ✓ |
| Config-file-relative | Resolve against the scope root; forces `../` prefixes | |
| Absolute paths only | Simplest but kills committed-config portability | |

**User's choice:** Project root / home (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Optional + defaults | autoupdate omitted = false; enabled omitted = true; `{}` valid entry | ✓ |
| Boolean plugin shorthand too | `"plugin@mp": true` accepted; schema union + write-back ambiguity | |
| All fields required | Verbose; zero default-resolution logic | |

**User's choice:** Optional + defaults (Recommended)

---

## Version pin semantics

| Option | Description | Selected |
|--------|-------------|----------|
| No version field | Config = pure intent; resolved versions stay internal; ENBL-02 pin = internal record | ✓ |
| Recorded (informational) pin | Write-back records resolved version; churns, inert if hand-edited | |
| Enforced pin | Reconcile enforces; clones at HEAD so mostly soft-fails; pulls CFGV2-01 forward | |

**User's choice:** No version field (Recommended)
**Notes:** Installation has no version selector (`resolvePluginVersion` derives from cached clone), so a config pin would be inert in v1.12.

| Option | Description | Selected |
|--------|-------------|----------|
| Ensure-entry only | update/reinstall write-back = ensure entry exists; no-op if present | ✓ |
| Pure no-op | Skip write-back entirely; hand-deleted entry + update → surprise uninstall at next reconcile | |

**User's choice:** Yes — ensure-entry only (Recommended)

---

## Schema strictness & evolution

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: unknown = invalid | Typos surface loudly; initially selected | (initially ✓) |
| Lenient: ignore unknown keys | Unknown keys ignored; typos silently inert; defaults apply | ✓ (revised) |

**User's choice:** Initially "Strict", then explicitly reversed at the area-close check: "i gave you the wrong answer for the first question. let's ignore unknown keys."
**Notes:** Follow-up on write-back handling of unknown keys inside patched entries: user briefly said "2" (drop), then immediately corrected: "ok, sorry, 1, preserve" → entry-level patches preserve unknown fields (round-trip).

| Option | Description | Selected |
|--------|-------------|----------|
| Optional, must be 1 | `schemaVersion` accepted if present (= 1), omitted = 1; no boilerplate | ✓ |
| Required, literal 1 | state.json ST-1 parity; boilerplate in every file | |
| No version field in v1.12 | Smallest surface; evolution rule only by convention | |

**User's choice:** Optional, must be 1 (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| No bump; scrub on load | schemaVersion stays 1; legacy-migration path scrubs leftover autoupdate | ✓ |
| Bump to 2 | Explicit epoch; downgrade hostility for an optional-field removal | |

**User's choice:** No bump; scrub on load (Recommended)
**Notes:** Ordering rail recorded: scrub must not destroy autoupdate intent before Phase 52 migration captures it into the generated config.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both | Config source = desired authority; state source = materialized record; mismatch ⇒ re-add | ✓ |
| Drop source from state | Literal SPLIT-01; source drift undetectable | |

**User's choice:** Keep both (Recommended)

---

## Trichotomy & load-seam shape

| Option | Description | Selected |
|--------|-------------|----------|
| Both top-levels required | Unambiguous-empty gate; typo'd top-level key aborts | |
| Optional, absent = empty | Consistent with defaults ethos; typo reads as empty | ✓ (user-clarified) |

**User's choice:** User declined the original question to clarify: both records optional; a declared plugin with no visible marketplace entry simply can't load (per-entry soft-fail, not a validation error); a project-scoped plugin can load via a user-scoped marketplace entry.
**Notes:** Cross-scope visibility confirmed as one-way project→user, mirroring CMP-3 (`orchestrators/plugin/shared.ts:203-222`); user confirmed "Yes, exactly".

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated result | `absent \| invalid \| valid` union; exhaustive handling forced | ✓ |
| Throw + ENOENT default | loadState parity; careless catch can turn invalid into empty | |

**User's choice:** Discriminated result (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Whole scope invalid | One bad file aborts the scope's reconcile | |
| Fall back to valid file | Use the valid file with a warning | ✓ |

**User's choice:** Fall back to valid file
**Notes:** Follow-up surfaced the destructive edge (local-only plugin uninstalled while local broken). Options: fallback + no prune (additive-only) / fallback with full reconcile / revert to abort. User chose **Fallback with full reconcile** — deliberate, consequences accepted.

**Area close:** User: "all good, but make sure messaging for success and errors is consistent with all the other operations" → D-19 messaging-consistency constraint recorded.

## Claude's Discretion

- loadConfig vs config-merge API split; merge provenance on MergedConfig
- Validation-error detail format in the `invalid` arm
- Naming and file placement (per research ARCHITECTURE.md structure)
- SPLIT-02 architecture-test enforcement style

## Deferred Ideas

- Version pins with teeth (CFGV2-01, v2)
- Boolean plugin shorthand (`"plugin@mp": true`)
- Mass-prune sanity guard for typo'd/empty-looking configs (reconcile phases 53/55, research Pitfall 1)
