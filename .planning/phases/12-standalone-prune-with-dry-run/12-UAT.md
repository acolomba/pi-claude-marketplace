---
status: testing
phase: 12-standalone-prune-with-dry-run
source: [12-VERIFICATION.md]
started: 2026-09-24T14:42:18Z
updated: 2026-09-24T14:42:18Z
---

## Current Test

number: 1
name: Real Pi scratch-scope command flow
expected: |
  Preview shows only the project orphan as (will uninstall) {dependency pruned}
  and changes no file. Actual prune shows its (uninstalled) row, removes that
  record and staged skill, and leaves held and explicit project plugins plus
  the user scope intact. After /reload, list shows the orphan as available.
awaiting: user response

## Tests

### 1. Real Pi scratch-scope command flow

expected: Preview is read-only; actual prune removes only the project orphan; after /reload, list shows the orphan as available and the other plugins as installed.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Scratch Run

The agent ran this flow in Pi 0.86.1 with a disposable project and agent directory.
Pi rendered these rows:

```text
● mp [project]
  ○ orphan (will uninstall) {dependency pruned}

● mp [project]
  ○ orphan v1.0.0 (uninstalled) {dependency pruned}

/reload to pick up changes
```

After `/reload`, `/claude:plugin list --scope project` showed `app`, `explicit`,
and `held` as installed, and `orphan` as available. The project state held those
three installs, the user state still held `useronly`, and the orphan skill file
was absent.

A fresh untouched fixture is at `/tmp/p12-prune-live-rXoycu`. To inspect it in
Pi, run this command in a terminal:

```bash
cd /tmp/p12-prune-live-rXoycu/project
PI_CODING_AGENT_DIR=/tmp/p12-prune-live-rXoycu/agent pi --offline --no-session --no-extensions --extension /home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/index.ts --approve
```

Run `/claude:plugin prune --scope project --dry-run`, then
`/claude:plugin prune --scope project`, `/reload`, and
`/claude:plugin list --scope project`. The fixture uses only `/tmp` paths.

## Gaps
