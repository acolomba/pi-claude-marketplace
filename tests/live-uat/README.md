# Stop contract live runtime UAT

Live-Pi verification for the `agent_settled` Stop dispatcher (STOP-01, STOP-03, STOP-07). The mocked settle tests under `tests/bridges/hooks/` prove the dispatcher logic offline; this directory proves the settle **fire-point** on a real Pi runtime, which no fake `pi` can establish.

It has two halves:

- A **scripted canary** (`stop-canary.mjs`) that drives a real Pi session and autonomously asserts what a headless drive can observe: `agent_settled` dispatch and block re-entry.
- A **human verification checklist** (below) for the runtime timing / interrupt questions a headless drive cannot sustain -- the verifier routes these `human_needed` rather than passing them silently.

This harness is **standalone**. It is NOT part of `npm run check` (it needs a live `pi` binary, provider credentials, and the disposable sandbox).

## Prerequisites

| Requirement                                | Notes                                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pi` CLI **>= 0.80.5** on `PATH`           | `agent_settled` fire-point. Verified against 0.80.10.                                                                                                                                   |
| A disposable `PI_CODING_AGENT_DIR` sandbox | Use `$(pwd)/tmp/pi-uat/agent`. The harness refuses to run against any dir outside `tmp/pi-uat` (T-88-08) so the always-block canary never churns a real Pi state dir.                   |
| A working default provider in the sandbox  | The sandbox's `settings.json` selects the provider/model; a real turn must reach it. `--offline` disables only Pi's *startup* network ops (marketplace autoupdate), not the model call. |

## The scripted canary -- `stop-canary.mjs`

### Run

```bash
PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent node tests/live-uat/stop-canary.mjs
```

The harness:

1. Verifies the live-pi + sandbox preconditions (refuses non-sandbox dirs).
2. Builds a disposable path-source marketplace carrying a Stop-only "ralph-loop" plugin whose Stop hook **always** returns `{"decision":"block","reason":"keep going"}` and appends one line to a marker file per invocation.
3. Installs it into the sandbox (user scope) through the extension's own `/claude:plugin` machinery.
4. Drives a real `pi -p --mode json --no-tools --offline` turn and reads the marker file + the JSON lifecycle event stream.
5. **Always uninstalls the canary and removes the marketplace afterward** (the sandbox is left clean even on failure).

### What it asserts (exit 0 conditions for the scriptable half)

- **STOP-01** -- `agent_settled` fires and dispatches the Stop bucket end-to-end (`agent_settled` event present AND the Stop hook fired at least once).
- **STOP-03** -- block re-entry starts a new turn: two `turn_start` events for a single user prompt (the documented extra-turn-boundary divergence).

### What it routes to `human_needed` (exit non-zero)

- **STOP-07 cap loop** -- a one-shot `pi -p` STARTS the first hook-driven re-entry turn, then tears down its non-interactive lifecycle before that turn settles again, so it never runs the settle→block→re-enter loop to the 8-consecutive-block cap. The harness prints the proven half, then exits non-zero with a `SCRIPTABLE HALF PROVEN, CAP LOOP -> human_needed` message. Drive the cap interactively per **item 4** below.
- Any unmet precondition (no `pi`, wrong version, non-sandbox dir) exits non-zero with a `LIVE RUNTIME REQUIRED` message.

The harness **never fakes a live result**: it exits non-zero rather than reporting a cap it could not observe, so the verifier records `human_needed`.

### Observed result (recorded this phase)

Against `pi 0.80.10`, openai-codex provider, sandbox `tmp/pi-uat/agent`:

```text
blocks=1, agent_settled=1, turn_start=2, cap=8, capWarning=false
PASS STOP-01: agent_settled dispatched the Stop bucket end-to-end
PASS STOP-03: block re-entry started a second turn for one prompt
-> CAP LOOP routed to human_needed (headless pi does not sustain the loop)
exit 1
```

STOP-01 and STOP-03 are proven on real Pi. STOP-07's cap loop is item 4 in the human checklist.
