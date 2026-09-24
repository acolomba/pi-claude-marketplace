# Phase 12: Standalone prune with dry-run - Discussion Log

> **Audit trail only.** Planning, research, and execution use CONTEXT.md.

**Date:** 2026-09-23
**Phase:** 12-standalone-prune-with-dry-run
**Areas discussed:** preview rows, empty result, backlog marker

---

## Area selection

| Option | Description | Selected |
| --- | --- | --- |
| Preview and empty-result messages | Discuss command output first. | ✓ |
| Backlog marker only | Resolve the old inventory-marker proposal. | |
| All three | Discuss output and backlog disposition together. | |

## Preview rows

| Option | Description | Selected |
| --- | --- | --- |
| `(will uninstall)` with prune reason | Pending status plus `{dependency pruned}`. | ✓ |
| `(will uninstall)` under a preview heading | Pending status with context only in the heading. | |
| Same uninstall row under a dry-run heading | Actual status, qualified by a heading. | |

**User's choice:** `(will uninstall) {dependency pruned}` for each candidate.

## Empty result

| Option | Description | Selected |
| --- | --- | --- |
| Nothing to prune with scope and reason | Normal result with scope and explanation. | ✓ |
| Bare Nothing to prune | Short normal result without explanation. | |
| No message | Silence on an empty sweep. | |

**User's choice:** `Nothing to prune` with selected scope and a reason.

## Backlog marker

| Option | Description | Selected |
| --- | --- | --- |
| Drop the marker idea | Close the backlog item without the extra `list`/`info` token. | ✓ |
| Keep as separate backlog item | Re-file the marker for a later phase. | |

**User's choice:** Drop the marker idea; `prune --dry-run` supplies the
inventory and Claude Code has no such marker.

## Agent Discretion

Choose exact no-orphans sentence and the implementation structure within the
locked row, scope, flag, and safety contracts.

## Deferred Ideas

None.
