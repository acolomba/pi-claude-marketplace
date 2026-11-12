---
status: testing
phase: 01-companion-floors-and-mcp-defaults
source: [01-VERIFICATION.md]
started: 2026-11-12T07:36:00Z
updated: 2026-11-12T07:36:00Z
---

## Current Test

number: 1
name: Real detached child calls a granted plugin MCP tool
expected: |
  The actual background child calls mcp__plugin_demo_stub__echo with
  text pg1-live and returns echo:pg1-live. Its transcript and the server
  request log show the call, without an unresolved selector or unavailable tool.
awaiting: user response

## Tests

### 1. Real detached child calls a granted plugin MCP tool

expected: Launch demo:runner with async:true in the prepared authenticated Pi session. The child's actual transcript and server request log show the short echo call and echo:pg1-live. A foreground run or a staged-agent listing does not establish this result.
result: [pending]

### 2. Real detached child excludes the disallowed long adapter tool

expected: The parent and unrestricted demo:control child offer and can call mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c. A real demo:restricted child does not have that tool in its actual tool inventory, while mcp__plugin_demo_stub__echo remains available and callable. Preserve inventory or provider tool-schema evidence; a model's unsupported assertion is insufficient.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Prepared Local Fixture

The disposable fixture is at `/tmp/pg1-live-bvydwvtq`. It contains a local
`fixtures` marketplace with plugin `demo`, short and long-name stdio echo
servers, and three agents: `runner`, `restricted`, and unrestricted `control`.
No provider credentials were copied and no Pi session was started.

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

No reported failures. Both tests await live results. The verification report
is `human_needed`, with 18/20 truths verified and no implementation blocker.
Focused-feedback timing sign-off remains a separate validation-record item.
