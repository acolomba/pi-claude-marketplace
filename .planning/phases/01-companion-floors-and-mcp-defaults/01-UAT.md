---
status: partial
phase: 01-companion-floors-and-mcp-defaults
source: [01-VERIFICATION.md]
started: 2026-11-12T07:36:00Z
updated: 2026-11-12T12:10:19.609Z
---

## Current Test

[testing complete]

## Tests

### 1. Real detached child calls a granted plugin MCP tool

expected: Launch demo:runner with async:true in the prepared authenticated Pi session. The child's actual transcript and server request log show the short echo call and echo:pg1-live. A foreground run or a staged-agent listing does not establish this result.
result: pass
source: automated
evidence: Real detached PID 3263124; run 7e8c4b83-e5b8-4e47-b231-179d48b6ddda. Both child provider requests offered only mcp__plugin_demo_stub__echo. The MCP server received pg1-live-short and the child received echo:pg1-live-short. The payload used the distinct suffix -short for log attribution.

### 2. Real detached child excludes the disallowed long adapter tool

expected: The parent and unrestricted demo:control child offer and can call mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c. A real demo:restricted child does not have that tool in its actual tool inventory, while mcp__plugin_demo_stub__echo remains available and callable. Preserve inventory or provider tool-schema evidence; a model's unsupported assertion is insufficient.
result: blocked
blocked_by: third-party
reason: pi-subagents 0.88.0 sets MCP_DIRECT_TOOLS=__none__ for children without explicit MCP selectors, so adapter 7.0.1 registers no direct tools. The unrestricted long-tool control and the restricted child's permitted short control both failed with tool-not-found. Long-tool absence cannot establish that disallowedTools caused the exclusion.
source: automated
evidence: Unrestricted PID 3263943, run 3b85d617-7578-4cd6-b216-1f86820cde8f; restricted PID 3264825, run 08ca46f2-df42-473b-900a-6ab9b547f479. Actual child provider schemas omit both direct tools before and after mcp connect. Parent schemas include both tools.

## Summary

total: 2
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 1

## Automated Run

The user requested automation before interruption. Both checks ran against real
detached children with an account-free, loopback-only OpenAI-compatible scripted
provider. The granted-call check passed. The exclusion check is blocked by the
installed companions; repeating it manually does not resolve that prerequisite.

The source-backed diagnosis and complete artifact paths are in
`../../debug/real-child-mcp-automation.md`. The fixture and driver remain under
`/tmp/pg1-live-bvydwvtq/`. From this checkout, with loopback bind permission:

```sh
PG_AGENT=demo:runner node /tmp/pg1-live-bvydwvtq/drive.mjs
PG_AGENT=demo:control node /tmp/pg1-live-bvydwvtq/drive.mjs
PG_AGENT=demo:restricted node /tmp/pg1-live-bvydwvtq/drive.mjs
```

The driver uses isolated HOME, PI_CODING_AGENT_DIR, TMPDIR, project files, and a
local provider with dummy credentials. It preserves actual provider tool schemas,
child status/transcripts, and MCP requests. Completed run artifacts are separate
from any later rerun. A child's process state `complete` alone is insufficient:
both blocked controls completed while their requested tool call failed.

| Evidence file under the fixture | SHA-256 of retained evidence |
|---|---|
| `drive.out` | `bcfcf9048bb446ec89e96e362b22345d47d4a1ebc7819cd8c844e090fcb54bf7` |
| `drive-control.out` | `cd2f7f542a1fed7de79c03523646b36e557d8c623d89b4a6247f2212ae41902d` |
| `drive-restricted.out` | `45cb4f0b6e60f9fc483a7e4348a4d50022c393113ac037392d506c9e67f7b676` |

No product code changed. These are recorded one-off automation runs, not new
permanent cucumber scenarios. All test processes were stopped. No phase-completion
waiver or acceptance of the remaining blocker was inferred.

## Original Manual Setup (Superseded by Automation)

The disposable fixture is at `/tmp/pg1-live-bvydwvtq`. It contains a local
`fixtures` marketplace with plugin `demo`, short and long-name stdio echo
servers, and three agents: `runner`, `restricted`, and unrestricted `control`.
No real provider credentials were copied. The automation above subsequently
started real Pi sessions with the local scripted provider.

The existing repository stub answered initialize, tools/list, and tools/call
in a direct smoke check. Evidence: `fixture-smoke.json` in that directory.
This checks fixture setup only; it does not pass either live test.

From the repository root, launch:

```sh
PI_CM_RUNTIME_PREFIX=/tmp/pg1-live-bvydwvtq/runtime scripts/pi.sh \
  --home /tmp/pg1-live-bvydwvtq/home \
  --cd /tmp/pg1-live-bvydwvtq/project
```

Configure the provider in this isolated home, using `/login` or the provider's
environment variables. The launcher pins pi-mcp-adapter 7.0.1 and
pi-subagents 0.88.0 and installs them if its private runtime is missing.
Then run these Pi commands:

```text
/claude:plugin marketplace add /tmp/pg1-live-bvydwvtq/marketplace --scope user
/claude:plugin install demo@fixtures --scope user
/reload
```

Ask the parent to launch each named agent with `async:true`. For test 1, ask
`demo:runner` to call the short echo tool with `pg1-live`. For test 2, first
use `demo:control` to call the long tool, then use `demo:restricted` to call
the short control and capture the real child's offered tool inventory.
Keep the child transcripts and the provider tool-schema trace for the
restricted child. The MCP request log is:

```text
/tmp/pg1-live-bvydwvtq/server-home/harness/mcp-stub-requests.jsonl
```

The log already contains the setup smoke call with `fixture-smoke`; only the
later live calls count toward acceptance. Record the date, installed versions,
child artifact paths, and observations for both tests. If temporary files
have been removed, `$gsd-verify-work 01` can rebuild the fixture from the setup
contract in `01-VERIFICATION.md` before continuing.

## Gaps

No local implementation failure is established. Test 1 passed automatically;
test 2 is blocked by the source-confirmed companion behavior described above.
Focused-feedback timing sign-off remains a separate validation-record item.
