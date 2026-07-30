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

## Human verification checklist

These runtime timing / interrupt behaviours cannot be sustained by a headless `pi -p` drive (which tears down its non-interactive lifecycle after the initial request). They require a **human at an interactive `pi` session**. Each item below is an explicit `human_needed` verification: record the observed result against the expected result; a mismatch is a STOP-01 / STOP-07 regression.

**Interactive setup** (shared by all items):

```bash
export PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent
export PI_CLAUDE_MARKETPLACE_DEBUG=1   # emit [hooks] dispatch logs on stderr
pi --no-extensions \
   --extension "$(pwd)/extensions/pi-claude-marketplace/index.ts" \
   --offline --mode json
```

For items that need an installed Stop hook, install a Stop-only plugin whose hook logs its received stdin and echoes a decision. A minimal observing hook:

```bash
#!/usr/bin/env bash
# stop-observe.sh -- log stdin (carries stop_hook_active) then decide.
cat >> /tmp/stop-uat/stdin.log
echo >> /tmp/stop-uat/stdin.log
# For the always-block canary, uncomment the next line:
# printf '%s' '{"decision":"block","reason":"keep going"}'
```

### Item 1 -- abort mid-tool-call does NOT fire Stop (STOP-01)

- **Repro:** In an interactive session, start a turn that calls a slow tool (e.g. ask the model to run `bash -c 'sleep 30'`). While the tool is running, interrupt the turn (the Pi interrupt key). Watch the `--mode json` stream and the `[hooks]` debug log.
- **Expected:** the final assistant message carries `stopReason: "aborted"`; the settle gate maps `aborted` → **neither** Stop nor StopFailure, so **no** Stop/StopFailure hook fires (no `stop-observe.sh` invocation, no marker). Pi's provider contract says every interrupt path surfaces a final assistant message with `stopReason: "aborted"`.
- **Failure signature:** a Stop (or StopFailure) hook fires after an abort, OR the final message's `stopReason` is not `"aborted"` on some interrupt path (e.g. interrupting exactly at the tool-result boundary). Record which interrupt paths, if any, do not carry `"aborted"`.

### Item 2 -- settle timing with queued user messages (STOP-01)

- **Repro:** Start a turn, then while it is still running submit a **second** user message so it queues. Let both drain. Count `agent_settled` events and Stop hook firings in the `--mode json` stream / `[hooks]` log.
- **Expected:** upstream Claude fires `Stop` once per response; Pi's `agent_settled` fires **once, after the queue fully drains** (no automatic retry / compaction / queued continuation remains), so exactly **one** settle-time Stop dispatch for the whole drained sequence.
- **Failure signature:** `agent_settled` (and the Stop dispatch) fires mid-queue before the drain, or fires more than once for a single logical completion. Document any per-response vs per-settle divergence from the upstream cadence.

### Item 3 -- re-entry does NOT self-clear `stop_hook_active` (STOP-07)

- **Repro:** Install the always-block canary (the `stop-observe.sh` above with the `block` line uncommented, logging stdin). Send one prompt and let the block re-enter at least twice. Inspect `stop-observe.sh`'s `stdin.log`: read the `stop_hook_active` field of each consecutive Stop payload. Then submit a **genuine** new user prompt.
- **Expected:** the bridge's re-entry uses `sendMessage(customType: "claude-hook-stop-block", display: false, …)`, which does **not** pass through the `input` event -- so `stop_hook_active` stays `true` across every consecutive re-entry (the 2nd+ Stop payloads show `"stop_hook_active": true`). Only the genuine user prompt fires `input`, which clears the flag (the next Stop payload after it shows `"stop_hook_active": false`).
- **Failure signature:** the 2nd consecutive Stop payload shows `"stop_hook_active": false` (the injected re-entry self-cleared the flag via a stray `input`), or a genuine user prompt fails to clear it.

### Item 4 -- the 8-consecutive-block override cap (STOP-07)

- **Repro:** Install the always-block canary. In an **interactive** session (a real TTY -- the scripted `stop-canary.mjs` proves only the first re-entry; headless `pi` cannot sustain the loop), send one prompt and let the always-block hook drive the re-entry loop with no further input.
- **Expected:** the loop runs settle → block → re-enter for 8 consecutive blocks; the **8th** block is suppressed (no re-entry), the turn ends, and the warning surfaces **exactly once**: `Stop hook override cap reached.` followed by the detail naming the plugin (`… blocked 8 times in a row; the turn ended despite its active block.`). The marker/`stdin.log` shows exactly 8 block invocations, then the run goes idle (no livelock).
- **Failure signature:** the marker shows more than 8 blocks (the cap did not bound the livelock -- a T-88-02 regression), the warning is missing or fires more than once, or the run never terminates.
