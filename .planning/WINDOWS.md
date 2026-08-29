---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 1
total_count: 4
last_updated: 2026-08-29T18:04:45.703Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 86 | unrun-verify | extensions/pi-claude-marketplace/bridges/skills/stage.ts |  | SKILL-01 backstop: after /reload a degraded skill's /skill:<name> resolves and the model never auto-invokes it (disable-model-invocation) — needs a live Pi session, not exercised in unit tests | open |  | 2026-07-26T13:18:03.001Z |  |
| 2 | 88 | stub | extensions/pi-claude-marketplace/bridges/hooks/settle.ts |  | stop_hook_active hardcoded false in synthetic Stop event; loop-protection flag + 8-block cap land in plan 03 (STOP-07) | open |  | 2026-07-30T12:26:37.974Z |  |
| 3 | 88 | stub | extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts |  | thin StopFailure translator; errorMessage classifier lands in plan 04 (SFAIL-03) | open |  | 2026-07-30T12:26:38.396Z |  |
| 4 | 109 | deviation | tests/shared/atomic-json.test.ts | 55 | TypeScript inferred a literal-only expected-document set before the Task 2 type check widened it to Set<string>. | fixed |  | 2026-08-29T18:04:33.606Z | 2026-08-29T18:04:45.703Z |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "86",
    "file": "extensions/pi-claude-marketplace/bridges/skills/stage.ts",
    "line": null,
    "description": "SKILL-01 backstop: after /reload a degraded skill's /skill:<name> resolves and the model never auto-invokes it (disable-model-invocation) — needs a live Pi session, not exercised in unit tests",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-26T13:18:03.001Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "88",
    "file": "extensions/pi-claude-marketplace/bridges/hooks/settle.ts",
    "line": null,
    "description": "stop_hook_active hardcoded false in synthetic Stop event; loop-protection flag + 8-block cap land in plan 03 (STOP-07)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-30T12:26:37.974Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "stub",
    "phase": "88",
    "file": "extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts",
    "line": null,
    "description": "thin StopFailure translator; errorMessage classifier lands in plan 04 (SFAIL-03)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-30T12:26:38.396Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "109",
    "file": "tests/shared/atomic-json.test.ts",
    "line": 55,
    "description": "TypeScript inferred a literal-only expected-document set before the Task 2 type check widened it to Set<string>.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-08-29T18:04:33.606Z",
    "resolved_at": "2026-08-29T18:04:45.703Z"
  }
]
````
