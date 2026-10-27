---
quick_id: 261027-9lp
status: complete
commits: [230de367, edac58eb]
---

# Agent-target refusal: one redacted form, true update reason

User-delegated follow-up to Phase 4's uncertain choices (D-PL4-07 and the
"unreadable manifest" label on a plain update's refusal).

## What changed

- `shared/errors-bridges.ts`: new `AgentTargetOccupiedError` (readonly
  `targetPath`). Its message renders the path through `redactAbsolutePaths`.
- `bridges/agents/target-check.ts`: throws it. The install preview of a fresh
  dependency, a dependency move, and an update's WR-C check now show the same
  text: `Cannot replace agent target with non-previous content at <file>.md`.
  The agents commit in `stage.ts` keeps its full-path message.
- `orchestrators/plugin/update-flow.ts`: `directFailReasons` gives that refusal
  no closed-set reason, as the install row for the same refusal does.

## Scenarios

- `install-dependencies.feature` (new dependency over a user's agent file) and
  `update-dependencies.feature` (plain update over a user's agent file) now
  expect the file name; the update row expects no reason. Both fail on the old
  source (checked by reverting `extensions/` only); the update scenario also
  fails with only `update-flow.ts` reverted (`unreadable manifest`).

## Decision rows

| ID | Decision | Rationale |
|----|----------|-----------|
| D-PL4-08 | Every write-free agent-target refusal (install preview, dependency move, update WR-C) names only the file, through `redactAbsolutePaths`; the error keeps the full path in `targetPath`. Replaces D-PL4-07's split. | User decision: one form, no absolute path on a row. |
| D-PL4-09 | A plain update's agent-target refusal carries no closed-set reason; the cause names the file. | The fallback `unreadable manifest` was false; the install row carries none; no closed-set reason fits. |

## Uncertain

- D-PL4-09 picks "no reason" over a new closed-set reason (for example
  `agent target occupied`), which would need the reason vocabulary, the wire
  map and the output catalog.

## Threat Flags

None -- no security-relevant surface outside the plan's scope was introduced.
