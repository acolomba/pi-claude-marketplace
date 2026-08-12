# Phase 100: Disabled-plugin information retention - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution
> agents. Decisions are captured in CONTEXT.md -- this log preserves the
> alternatives considered.

**Date:** 2026-08-11
**Phase:** 100-disabled-plugin-information-retention
**Areas discussed:** Hooks while disabled, Backfill for old records, Reasons on
disabled rows, Where the inventory renders, Type invariant

______________________________________________________________________

## Hooks while disabled

### Where the persisted detail lives

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level optional key | Beside `resolvedSha`; optional, additive, no `schemaVersion` bump, no migrate fill. Amends COMPAT-01's key-set clause with a stated reason. | ✓ |
| Nested inside `resources` | Passes COMPAT-01's key-set clause untouched (it reads top-level properties only), but `resources` stops being five homogeneous name-list arrays and it reads as dodging the gate. | |
| Widen `resources.hooks` elements | Most cohesive shape, but legacy records hold plain strings -- needs a union or a `schemaVersion: 3` migration. | |

**User's choice:** Top-level optional key.

### Where the detail comes from

Asked twice, in two independent framings, after a mid-discussion finding
changed the option set. The answer held both times.

| Option | Description | Selected |
|--------|-------------|----------|
| Leave `hooks.json`, deregister it | Disable stops calling `removeHookConfig`; the new hydrate `enabled` guard stops the routing. No schema change at all. Makes hooks the one kind whose artifact survives disable. | |
| Persist hook entries in the record | Full fidelity independent of any file. Costs an additive key plus a COMPAT-01 amendment and a second copy of a fact `hooks.json` owns for enabled records. | ✓ |
| Keep deleting, kind-level fidelity | Report that hooks exist without naming their events. Smallest change; under-reports exactly one kind. | |
| Re-read from the plugin source | Offered in the first framing only. Full fidelity, no schema change, but reintroduces a plugin-root resolution the manifest-absent case cannot always satisfy. | |

**User's choice:** Persist hook entries in the record.
**Notes:** Position held across both framings, so it is recorded as considered
rather than incidental. The consequence is that disable keeps calling
`removeHookConfig` and artifact removal stays symmetric across all five kinds.

### Legacy records lacking the new key

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `readStateOnlyHookEntries` as fallback | Record wins when present; file read covers absence. No regression for existing enabled manifest-absent records. | ✓ |
| Retire the read outright | One reader, zero disk access, structural INFO-12 guarantee -- at the cost of a real regression window. | |

**User's choice:** Keep as legacy fallback.

### Entry payload

| Option | Description | Selected |
|--------|-------------|----------|
| Supported entries only | Event plus matcher; byte-parity with today's hooks line, since the staged file is the filtered supported subset by construction. | ✓ |
| Also record dropped/unsupported handlers | Would let `info` name handlers a partially-installed plugin does not run, using `HookSummaryEntry`'s existing `lenient` arm. Captures information the record never held. | |

**User's choice:** Supported entries only.
**Notes:** The rejected option is preserved as a deferred idea.

### Soft-dependency markers on disabled rows

| Option | Description | Selected |
|--------|-------------|----------|
| Guard on `enabled` -- keep rows bare | Disabled rows render byte-identically to today; preserves D-97-01. | ✓ |
| Let the markers render | A disabled record genuinely declares agents and MCP servers, so the marker is a durable fact -- but it warns about something that cannot currently fail. | |

**User's choice:** Guard on `enabled`.

______________________________________________________________________

## Backfill for old records

| Option | Description | Selected |
|--------|-------------|----------|
| None -- self-heal only | Enable overwrites `resources` wholesale, so the next enable/disable cycle repopulates. Still-declared disabled plugins resolve from the manifest. | ✓ |
| Record-only backfill at reconcile | Re-derive from the cached manifest, write the record, materialize nothing, never touch `enabled`. Reopens the region ENBL-08 fenced off and writes predicted rather than recorded names. | |
| Opportunistic persist-on-read | Closes the window with no dedicated scan, but makes `list`/`info` writers -- they are lock-free, network-free and mutation-free today, with coverage asserting it. | |

**User's choice:** None -- self-heal only.
**Notes:** Offered after establishing that a still-declared disabled plugin
needs no backfill at all, which bounds the unrecoverable population to records
disabled before this ships whose manifest later drops them and which are never
re-enabled.

______________________________________________________________________

## Reasons on disabled rows

| Option | Description | Selected |
|--------|-------------|----------|
| `{not in manifest}` only | Durable and actionable -- it is the difference between a plugin you can re-enable and one you cannot. Preserves D-97-01's bare disabled-partial row. | ✓ |
| All applicable reasons | Purest reading of D-95 (orchestrators decide, no filtering), but reverses D-97-01 and sits awkwardly beside suppressing soft-dep markers on the same row. | |
| None -- keep rows bare | Zero rendered-byte change; user gets no signal until an enable that cannot succeed. | |

**User's choice:** `{not in manifest}` only.
**Notes:** Decided after confirming that `runEnableBranch` re-runs
`runInstallLedger`, which resolves from the marketplace manifest -- so a
disabled manifest-absent record genuinely cannot be re-enabled. The governing
rule was stated during discussion and is carried into CONTEXT.md: render durable
facts that constrain the next action; suppress facts about suspended runtime
behavior.

______________________________________________________________________

## Where the inventory renders

| Option | Description | Selected |
|--------|-------------|----------|
| Route disabled through `buildBlock` | Widen `PluginInfoRowBase`'s `Extract` with `disabled`, as FSTAT-07 did for `partially-installed`. Inherits the manifest-backed → record-backed ladder and dissolves the mixed-message-kind problem. | ✓ |
| Give the cascade row a components block | Smaller control-flow diff, but puts an info-only concern on the shared cascade shape and never reaches manifest resolution -- contradicting the backfill decision. | |

**User's choice:** Route disabled through `buildBlock`.
**Notes:** Framed only after verifying that this is a per-surface subset
widening rather than a new status token, so COMPAT-01's status clause and
SNM-02's 19-entry lock both stay green.

______________________________________________________________________

## Type invariant

| Option | Description | Selected |
|--------|-------------|----------|
| Re-point at the new invariant | `toDisabledRecord` becomes generic in its resources shape, making "disable changed the inventory" a compile error at the producer. | ✓ |
| Narrow the brand to `enabled: false` | Smallest edit, but pins nothing under structural typing while still reading as a guarantee. | |
| Drop the brand entirely | Honest that the invariant is retired; converts a compile-time guarantee into a runtime-tested one. | |

**User's choice:** Re-point at the new invariant.

______________________________________________________________________

## Claude's Discretion

- Requirement IDs for this phase (ENBL-10+); the roadmap left assignment to
  discuss and no preference was expressed.
- The exact name of the new top-level record key.
- Whether the hydrate `enabled` guard needs its own drift-gate clause or is
  covered by the existing ENBL-05 whole-tree gate.

## Deferred Ideas

- Converge reinstall/update's old-version removal onto `cascadeUnstagePlugin`.
  Raised by the operator; real work, complicated by reinstall's removal being a
  replace-in-place rather than a plain removal. Its own phase.
- Persist the dropped/unsupported handler detail an install partitions out, so
  `info` can name handlers a partially-installed plugin does not run.
- `2026-08-10-coverage-exclusion-versus-tests-for-the-out-of-bound-orchestr.md`
  -- reviewed as a phase-todo match and deliberately not folded.
