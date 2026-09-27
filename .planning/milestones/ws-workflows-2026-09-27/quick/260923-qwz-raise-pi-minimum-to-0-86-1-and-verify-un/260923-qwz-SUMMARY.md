---
phase: 260923-qwz
plan: 01
subsystem: workflows
tags: [pi-version, workflow-engine, live-uat]
requires: []
provides:
  - Pi peer floor of 0.86.1
  - Live evidence for the published workflow engine on that host
affects: [workflows, NFR-11]
key-files:
  modified:
    - package.json
    - package-lock.json
    - scripts/check-unused-type-members.contracts.json
    - docs/workflows-compatibility.md
requirements-completed: [NFR-11]
completed: 2026-09-23
status: complete
implementation-commit: f85d7eb9
---

# Pi 0.86.1 workflow engine compatibility

Pi 0.86.1 ran a saved workflow with the published, unpatched
`@quintinshaw/pi-dynamic-workflows` 3.13.0 engine.

## Changes

- Raised the Pi peer and development dependency floor to 0.86.1 and refreshed
  the lockfile, architecture check, live canary prerequisite, and current docs.
- Moved three upstream type declaration pins in the unused member gate to
  their positions in Pi 0.86.1. The old pins caused that gate to exit before
  producing JSON.
- Recorded the remaining engine limits in the workflow compatibility guide.

## Live verification

- Loaded the marketplace and engine through normal Pi package discovery in a
  disposable Pi home. The host ran Pi 0.86.1, the engine was 3.13.0, and the
  engine resolved its own Pi dependency at 0.87.1.
- Installed a fixture plugin through the marketplace bridge. Its saved workflow
  ran with an OpenAI child. The child called native `read` and
  `structured_output`, returned `workflow-tool-probe`, and finished. The parent
  session received the workflow result. Persisted status was `completed`, and
  `pendingDelivery` was `null`.
- `/workflows list` reported the completed run. `/workflows status <id>` still
  printed `Workflow running` for it. A launch using `--no-extensions -e` can
  also leave result delivery pending; the successful run used normal discovery.
- Removed the copied auth file from the disposable Pi home after the test.

## Automated verification

- The peer-floor and workflow documentation architecture tests passed.
- The FIFO architecture test passed outside the sandbox. The sandbox denies
  its `mkfifo` subprocess with `EPERM`.
- The unused member gate's live sensitivity test passed after the Pi type
  declaration pins were updated.
- The full `npm run check` gate passed after that update: unit coverage was
  100%, all 36 integration tests passed, and all seven unused member negative
  controls passed.
- Fallow's diff and agent-marker audits passed. Pre-commit passed on every
  implementation file before commit `f85d7eb9`.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
