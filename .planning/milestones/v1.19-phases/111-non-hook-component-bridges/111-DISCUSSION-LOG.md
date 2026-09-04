# Phase 111: Non-Hook Component Bridges - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-30
**Phase:** 111-Non-Hook Component Bridges
**Areas discussed:** Fixture ownership

---

## Fixture Ownership

### Static source inputs

| Option                    | Description                                                                          | Selected |
| ------------------------- | ------------------------------------------------------------------------------------ | -------- |
| Hybrid ownership          | Keep immutable, byte-rich sources in `_fixtures`, but copy them before mutation.     |          |
| Fully case-local          | Construct every source tree inside each owner case, including complex byte examples. | ✓        |
| Shared read-only fixtures | Let several owners read common fixture trees directly.                               |          |

**User's choice:** Fully case-local.
**Notes:** The user asked for concrete examples before selecting. The local-tree example kept
the complete multiline input beside the case.

### Existing fixture cleanup

| Option                 | Description                                                                                   | Selected |
| ---------------------- | --------------------------------------------------------------------------------------------- | -------- |
| Remove unused fixtures | Delete each fixture after its last legitimate supplemental or integration consumer is gone.   | ✓        |
| Keep legacy fixtures   | Retain all existing fixtures for reference after owners stop using them.                      |          |
| Move all consumers     | Convert every supplemental consumer to local inputs and remove the entire fixture collection. |          |

**User's choice:** Remove unused fixtures.
**Notes:** Fixtures with a genuine remaining cross-module consumer remain in place.

### Setup reuse

| Option                      | Description                                                                                                 | Selected |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| Small fresh-value factories | Allow concern-local helpers that return fresh setup; each case owns distinguishing inputs and expectations. | ✓        |
| No setup reuse              | Spell out all directories, files, and values inline in every case.                                          |          |
| Complete scenario builders  | Let helpers construct reusable whole-plugin scenarios with case overrides.                                  |          |

**User's choice:** Small fresh-value factories.
**Notes:** Factories cannot hide meaningful source bytes or compute expected results.

### Supplemental suites

| Option                           | Description                                                                        | Selected |
| -------------------------------- | ---------------------------------------------------------------------------------- | -------- |
| Keep only cross-module evidence  | Retain genuine cross-module or orchestrator-facing cases; absorb owner duplicates. | ✓        |
| Preserve every supplemental case | Keep all cases, including behavior already proved by one owner.                    |          |
| Fold everything into owners      | Delete all supplemental non-hook bridge suites after moving useful assertions.     |          |

**User's choice:** Keep only cross-module evidence.
**Notes:** Retained supplemental cases must prove a boundary that one mirrored owner cannot
prove alone.

## the agent's Discretion

- Exact names and locations for small concern-local fresh-value factories.
- Exact case division and ordering within each mirrored owner.
- Classification of each existing supplemental case, subject to the cross-module-only rule.

## Deferred Ideas

None.
