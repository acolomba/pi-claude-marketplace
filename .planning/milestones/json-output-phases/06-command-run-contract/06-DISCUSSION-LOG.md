# Phase 6: Command-Run Contract - Discussion Log

> Audit trail only. Decisions are captured in CONTEXT.md.

**Date:** 2026-10-09
**Areas discussed:** Command identity, silent successful runs, failures after partial output

## Command identity

### How should origin.command identify aliases?

| Option | Selected |
| --- | --- |
| Canonical name only | Yes |
| Exact spelling |  |
| Both |  |

**User choice:** 1. Canonical name only: ls becomes plugin list; marketplace rm becomes marketplace remove.

### What should origin.command contain for invalid commands?

| Option | Selected |
| --- | --- |
| Recognized parent | Yes |
| Dedicated unknown IDs |  |
| Attempted command text |  |

**User choice:** 1. Recognized parent: plugin for unknown top-level verbs; marketplace for missing or unknown marketplace verbs. The usage-error explains the mistake.

### Which identity should delegated work retain?

| Option | Selected |
| --- | --- |
| Outer command | Yes |
| Executing operation |  |

**User choice:** 1. Outer command and same invocation ID throughout delegated work. Bare /claude:plugin uses plugin browse.

### How should help marketplace and marketplace help be identified?

| Option | Selected |
| --- | --- |
| marketplace help for both | Yes |
| plugin help for both |  |
| Distinct identities |  |

**User choice:** 1. marketplace help for both spellings.

## Silent successful runs

### How should a normal return with no output satisfy the contract?

| Option | Selected |
| --- | --- |
| Require an explicit result | Yes |
| Automatic acknowledgment |  |

**User choice:** 1. Require an explicit result. Valid empty results use the appropriate typed payload. A handler returning without output produces an internal-error for the missing result.

### Is a device-flow prompt or diagnostic without an outcome sufficient?

| Option | Selected |
| --- | --- |
| Require an outcome | Yes |
| Any payload satisfies the contract |  |

**User choice:** 1. Require an outcome. Prompts and diagnostics alone do not establish success; emit internal-error for the missing result.

## Failures after partial output

### What needsReload should an internal-error carry after an earlier reload requirement?

| Option | Selected |
| --- | --- |
| Preserve the known reload requirement | Yes |
| False on the error itself |  |

**User choice:** 1. Preserve the known reload requirement: true if an earlier result required reload. Completed changes are not claimed to be rolled back.

### What happens if appendEntry fails and the internal-error delivery also fails?

| Option | Selected |
| --- | --- |
| Contain and debug-log it | Yes |
| Let the command reject |  |

**User choice:** 1. Contain and debug-log the failure, stop emitting, and return. Document that the sink failure prevents guaranteed payload delivery. Do not retry the operation or roll back completed changes.

## Completion

The user selected all three discussion areas, accepted each recommendation,
and selected readiness to write context and continue planning.

## Agent discretion

No additional product decisions delegated. Internal implementation details
follow project conventions.

## Deferred ideas

None. Phase 7 documentation carries the accepted delivery limit.
