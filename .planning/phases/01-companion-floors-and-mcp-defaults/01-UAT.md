---
status: complete
acceptance: completed
phase: 01-companion-floors-and-mcp-defaults
source: [01-VERIFICATION.md]
started: 2026-11-12T07:36:00Z
updated: 2026-11-13T12:03:56Z
---

## Current Test

[testing complete]

## Tests

### 1. Real detached child calls a granted plugin MCP tool

expected: Launch demo:runner with async:true in the prepared authenticated Pi session. The child's actual transcript and server request log show the short echo call and echo:pg1-live. A foreground run or a staged-agent listing does not establish this result.
result: pass
source: automated
evidence: Real detached PID 3263124; run 7e8c4b83-e5b8-4e47-b231-179d48b6ddda. Both child provider requests offered only mcp__plugin_demo_stub__echo. The MCP server received pg1-live-short and the child received echo:pg1-live-short. The payload used the distinct suffix -short for log attribution.
fresh_evidence: On 2026-11-13, the published 0.88.1 short-grant child completed, offered only mcp__plugin_demo_stub__echo in both provider requests, called it once, and received echo:pg1-live-short. See /tmp/pg1-live-companion-pHdbmd/summary.json, drive.out, and server-home/harness/mcp-stub-requests.jsonl.

### 2. Real detached child excludes the disallowed long adapter tool

expected: The parent and unrestricted demo:control child offer and can call mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c. A real demo:restricted child does not have that tool in its actual tool inventory, while mcp__plugin_demo_stub__echo remains available and callable. Preserve inventory or provider tool-schema evidence; a model's unsupported assertion is insufficient.
result: pass
source: automated
evidence: On 2026-11-13, published pi-subagents 0.88.1 completed all three real detached children. demo:control offered both MCP tools in all three provider requests and called long once; demo:restricted omitted long in all three requests while offering and calling short once. The runner checked child completion, echo output, and server tools/call records. Fixture: /tmp/pg1-live-companion-pHdbmd; inventories: summary.json; child and provider log: drive.out; MCP calls: server-home/harness/mcp-stub-requests.jsonl; complete command output: /tmp/261113-8yn-real-child-0881.log.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0
deferred_accepted: 0

## Published 0.88.1 Adoption Supplement — 2026-11-13

The installed package identifies `pi-subagents@0.88.1`, published from `nicobailon/pi-subagents` with registry integrity `sha512-Yrt0kBT+ChgnmcVzBu2004lwuwmRTHdr1jGUdLd9X7+TAdpLaCILCRFHQhnM9u4fnyOPDLE8wASnedp0nuXc9g==`. The detailed launch module passed six of six checks on 0.88.1. Its two positive ambient cases failed on intact 0.88.0, with all four explicit controls passing. Logs: `/tmp/261113-8yn-positive-old-red.tap` and `/tmp/261113-8yn-positive-new-green.tap`.

`env -u PG_COMPANION_INDEX -u PG_AGENT node .planning/debug/artifacts/real-child-mcp-automation/run.mjs` passed against the installed 0.88.1 package. In `/tmp/pg1-live-companion-pHdbmd/summary.json`, runner offers and calls short, control offers short and long and calls long, and restricted offers and calls short while omitting long from every provider request. All three child statuses are complete. `/tmp/pg1-live-companion-pHdbmd/drive.out` holds provider requests and status; `/tmp/pg1-live-companion-pHdbmd/server-home/harness/mcp-stub-requests.jsonl` holds the actual MCP calls. The full output is `/tmp/261113-8yn-real-child-0881.log`. Foreground agent-grants scenarios also passed: adapter 14/14 scenarios (210 steps), built-in 6/6 (95 steps), in `/tmp/261113-8yn-agent-grants-adapter.log` and `/tmp/261113-8yn-agent-grants-builtin.log`.

This is runtime acceptance of test 2, with fresh confirmation of test 1. PG-MCP-02 is accepted after the merged-tree gate. `npm run check` passed (exit 0) at `2db3b81a9cc97098bee6bc744d451aeab4fe9fad`, Node v26.13.0; log: `/tmp/subagents0881-root-check.log`. The original 0.88.0 blocked run remains below as historical evidence.

## Historical Test 2 Blocked Run — 2026-11-12

### Superseded test 2 run on pi-subagents 0.88.0

expected: The parent and unrestricted demo:control child offer and can call mcp__plugin_demo_a-server-whose-name-runs-well-past-the_a4df039c. A real demo:restricted child does not have that tool in its actual tool inventory, while mcp__plugin_demo_stub__echo remains available and callable. Preserve inventory or provider tool-schema evidence; a model's unsupported assertion is insufficient.
result: blocked
blocked_by: third-party
disposition: accepted-deferral
tracking: AGTAMBIENT-01 / SEED-261112-81c
reason: pi-subagents 0.88.0 sets MCP_DIRECT_TOOLS=__none__ for children without explicit MCP selectors, so adapter 7.0.1 registers no direct tools. The unrestricted long-tool control and the restricted child's permitted short control both failed with tool-not-found. Long-tool absence cannot establish that disallowedTools caused the exclusion.
source: automated
evidence: Unrestricted PID 3263943, run 3b85d617-7578-4cd6-b216-1f86820cde8f; restricted PID 3264825, run 08ca46f2-df42-473b-900a-6ab9b547f479. Actual child provider schemas omit both direct tools before and after mcp connect. Parent schemas include both tools.


## Historical Automated Run — 2026-11-12

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

## Historical Local Companion Fix — 2026-11-12

The user authorized a companion regression, fix, and automated reruns. Local
pi-subagents commit `1e79b864159430cc124783a7d7c9e4e5daa2a7bf`, based on upstream
`7e2794efba0b727af51d08c36614ea939f1a827b`, restores adapter configuration for
children without a tool allowlist or capability ceiling. Explicit restrictions
remain enforced. The regression failed before the fix and after reverting it,
and passed after reapplying it.

All three actual detached children passed with the local build: the short-grant
child called short; the unrestricted child offered and called long; the restricted
child omitted long in every provider request and offered and called short.
A fresh-fixture replay of the saved runner also passed. The runnable fixture,
patch, provenance, and retained logs are in
`../../debug/artifacts/real-child-mcp-automation/README.md`.

Companion typecheck, package build, 25 owner tests, and three focused MCP
integration cases passed. The full unit suite had three failures, all reproduced
with the patch reverted. The full adjacent integration module timed out; the
focused MCP cases passed separately. See the artifact for exact commands.

These results validate the local fix. This project's pinned 0.88.0 dependency
has not changed. The fix was subsequently pushed as PR #3259; its reviewed head is `7629470d1d86f62e4fd4b6ccb1ee4b2c28953db4`, with CI passing in the recorded review. No fixed package release is claimed. Test 2 remains
blocked for that dependency until the fix is adopted and the same runner passes
against the adopted build. No manual rerun is requested.

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

No local implementation failure is established. Tests 1 and 2 pass on the published 0.88.1 companion. PG-MCP-02 acceptance is complete; the combined-tree gate passed. Focused-feedback timing sign-off remains a separate validation-record item.

## Historical Accepted External-Dependency Deferral — 2026-11-12

The user explicitly instructed: "let's add this pending work to a gsd trigger ... to upgrade to the version of pi-subagents that fixes this problem, and move on from phase 1". Phase 1 acceptance is complete with that specific deferral. **Test 2 remains recorded as blocked on installed 0.88.0; it is not a passed test.** No manual test remains pending.

[SEED-261112-81c](../../seeds/SEED-261112-81c-adopt-pi-subagents-ambient-mcp-fix.md) and BACKLOG AGTAMBIENT-01 carry the release trigger, dependency upgrade, replacement of the two known-bug assertions, three real-child controls on the adopted build, full gate, and acceptance-record updates. The seed surfaces during companion upgrades and milestone planning; it does not monitor releases in the background. PR review/CI success does not establish publication.

The six installed-launch characterization cases pass on 0.88.0. Substituting the actual fixed module makes exactly the two known-bug cases fail while the four restriction controls pass; the original peer module was restored. All three positive real-child controls pass on the local fixed build. These results preserve the defect and fix evidence until adoption. Focused-feedback timing bookkeeping remains advisory debt in `01-VALIDATION.md`.
