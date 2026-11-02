---
phase: 06-mcp-servers
plan: 06
subsystem: testing
tags: [cucumber, pi-mcp-adapter, mcp, lifecycle, user-overrides]

requires:
  - phase: 06-mcp-servers
    provides: "06-01 shared MCP steps (listing.steps.ts) and fixture writers (mcp-server-files.ts: writeMcpAdapterOverride, publishStubServersFile)"
provides:
  - "features/mcp-server/lifecycle.feature: MCP-08 removal, restore, replacement, no-update control, and user-override survival scenarios"
  - "features/step_definitions/mcp-server/lifecycle.steps.ts: the user-override Given"
affects: [06-07, 06-08, 06-09]

actuals:
  tokens: 6793
  tasks: 3
  commits: 3
plan_head_before: 38f3900e2eae43d2ac45a3fef8cb3aee95395a16
plan_head_after: acbf7d67552a7619fc37c306589b4b559196f8aa

tech-stack:
  added: []
  patterns:
    - "A lifecycle scenario runs its verbs in the shared Pi, then starts the profile Pi with pi-mcp-adapter as the stand-in for /reload (D-CF6-11)"
    - "A removed or disabled server is told apart by mcp({}) next to the proxy call, because both give the same not-found text"

key-files:
  created:
    - features/mcp-server/lifecycle.feature
    - features/step_definitions/mcp-server/lifecycle.steps.ts
  modified: []

key-decisions:
  - "The replaced .mcp.json in the update and no-update scenarios uses the wrapper-less root form, because the shared Given reads {\"mcpServers\": {\"stub\": {\"stub\": ...}}} as a stub marker on mcpServers"
  - "The override Given edits the installed entry under the adapter key plugin_demo_stub_, the form a user meets in pi-mcp-adapter's panel"

patterns-established:
  - "Every MCP lifecycle scenario compares the whole model calls and either the stub's whole log or an empty log"

requirements-completed: [MCP-08]

coverage:
  - id: D1
    description: "After disable, a later session gets the not-found answer for the proxy call, MCP: 0/0 servers, 0 tools from mcp({}), and an empty stub log"
    requirement: MCP-08
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#Disabling a plugin removes its server from what pi-mcp-adapter offers"
        status: pass
    human_judgment: false
  - id: D2
    description: "After uninstall, the same texts as disable and an empty stub log (research A4, measured)"
    requirement: MCP-08
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#Uninstalling a plugin removes its server from what pi-mcp-adapter offers"
        status: pass
    human_judgment: false
  - id: D3
    description: "After disable then enable, the adapter lists the server again and the call answers mcp returned: echo:ping, with the stub's whole log"
    requirement: MCP-08
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#Enabling a disabled plugin offers its server again"
        status: pass
    human_judgment: false
  - id: D4
    description: "An update to 1.1.0 whose .mcp.json sets STUB_TAG v2 answers mcp returned: v2:echo:ping; the same published change with no update still answers mcp returned: echo:ping"
    requirement: MCP-08
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#Updating a plugin replaces its server with the new version's"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#A published change to the server reaches no session until the plugin updates"
        status: pass
    human_judgment: false
  - id: D5
    description: "A user's disabled: true on plugin_demo_stub_ survives an update, a disable then enable, and an uninstall then install, as pi-mcp-adapter reports a disabled server, with an empty stub log (D-08-01, D-08-02)"
    requirement: MCP-08
    verification:
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#A user's disabled choice for a plugin server survives an update"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#A user's disabled choice for a plugin server survives a disable and enable"
        status: pass
      - kind: e2e
        ref: "features/mcp-server/lifecycle.feature#A user's disabled choice for a plugin server survives an uninstall and install"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 06: MCP server lifecycle Summary

**Eight cucumber scenarios pin MCP-08 on pi-mcp-adapter 7.0.0: disable and uninstall remove the plugin server from a later session, enable restores it, an update replaces it with the new `.mcp.json` (`v2:echo:ping`) while a published change with no update does not leak, and a user's `disabled: true` survives update, disable then enable, and uninstall then install.**

## Performance

- **Duration:** about 70 min (much of it waiting on ESLint under five parallel executors)
- **Started:** 2026-11-01T15:00Z
- **Completed:** 2026-11-01T16:10Z
- **Tasks:** 3
- **Files modified:** 2 (both created)

## Accomplishments

- `features/mcp-server/lifecycle.feature` (`Feature: MCP server lifecycle`): a Background that installs `demo` 1.0.0 with the stub server `stub` at user scope, then one scenario per verb. Each runs its verbs in the shared Pi, starts a profile Pi with pi-mcp-adapter as the stand-in for `/reload` (D-CF6-11), and compares the whole model calls and the stub's whole log (or an empty one).
- The no-update negative control shows that a published `.mcp.json` change reaches no session until `update` runs.
- `features/step_definitions/mcp-server/lifecycle.steps.ts`: the Given `the user has disabled the mcp server {string} in the mcp-adapter.json file of the {word} scope`, which writes the user's own edit through `writeMcpAdapterOverride` and checks the file reads back as written. No Then reads `mcp-adapter.json`.
- No product file changed, and no product break was found.

## Task Commits

1. **Task 1: disabling removes the server (tracer)**: `be41db1` (test)
2. **Task 2: uninstall, enable, update, and the no-update control**: `74e0011` (test)
3. **Task 3: the user's disabled choice survives three verb pairs**: `acbf7d6` (test)

Tracer gate: after Task 1, the scenario passed three times in a row and `npm run check:features` passed, so the plan expanded.

## Measured literals (adapter 7.0.0, Pi 1.4.0)

Setup severities, from `the user has run ...` in the shared Pi (which has no adapter):

- `install demo@fixtures --scope user`: every result a warning (`{requires pi-mcp-adapter}`).
- `disable demo@fixtures --scope user`: every result info, with or without the user's override.
- `uninstall demo@fixtures --scope user`: every result info, with or without the user's override.
- `enable demo@fixtures --scope user`: every result a warning.
- `update demo@fixtures --scope user` (1.0.0 to 1.1.0): every result a warning.

After disable and after uninstall (research A4: uninstall matches disable):

- Proxy call `mcp({"tool": "mcp__plugin_demo_stub__echo", "args": {"text": "ping"}})`: `mcp returned: Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.`
- `mcp({})`: `mcp returned: MCP: 0/0 servers, 0 tools`
- Stub log: empty.

With the user's `disabled: true` on `plugin_demo_stub_` (research A5), after an update, after a disable then enable, and after an uninstall then install, all three the same:

- Proxy call: the same not-found text as above, `mcp returned: Tool "mcp__plugin_demo_stub__echo" not found. Use mcp({ search: "..." }) to search.`
- `mcp({})`: `mcp returned: MCP: 0/0 servers, 0 tools (1 disabled)\n\n⊘ plugin_demo_stub_ (disabled)\n\nmcp({ server: "name" }) to list tools, mcp({ search: "..." }) to search` (the mark is U+2298; the fix-unicode-dashes hook leaves it alone).
- Stub log: empty. The `disabledServerReason` text (`Server "<key>" is disabled. Run /mcp-adapter enable ...`) does not reach the model on either call.

After enable, and after an update with no override: two startup rounds plus `tools/call` in the stub log, as in the seed scenario. The call answers `mcp returned: echo:ping` after enable and `mcp returned: v2:echo:ping` after the update. With the published change and no update, it answers `mcp returned: echo:ping`.

## Files Created/Modified

- `features/mcp-server/lifecycle.feature`: the MCP-08 scenarios
- `features/step_definitions/mcp-server/lifecycle.steps.ts`: the user-override Given

## Decisions Made

- The proxy-call text cannot tell a removed server from a disabled one (research Pitfall 3), so every removal and override scenario also scripts `mcp({})`. Its answer tells them apart: `0/0 servers` against `(1 disabled)`.
- The override scenarios start the profile Pi with no listing wait, because a disabled server never starts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The planned replacement `.mcp.json` cannot be written through the shared Given**
- **Found during:** Task 2
- **Issue:** The plan's doc string `{"mcpServers": {"stub": {"stub": {"env": {"STUB_TAG": "v2"}}}}}` fails in `withStubServers`. The value of `mcpServers` is an object whose one member is `stub`, so it reads as a stub marker on the member `mcpServers`, and its options are invalid: `Error: the stub marker of "mcpServers" takes only "plugin" (a string) and "env" (strings)`. `features/lib/mcp-server-files.ts` is not this plan's file.
- **Fix:** The update and no-update scenarios publish the wrapper-less root form `{"stub": {"stub": {"env": {"STUB_TAG": "v2"}}}}`. The marker expands to the server `stub`, and the product reads a root `.mcp.json` without `mcpServers` as the server map (`domain/mcp-resolution.ts`, `"mcpServers" in parsed ? parsed.mcpServers : parsed`). The shared Given is still the one that writes the file, as the plan's key link requires.
- **Files modified:** `features/mcp-server/lifecycle.feature`
- **Verification:** the update scenario answers `v2:echo:ping` and the control `echo:ping`, three runs each.
- **Committed in:** `74e0011`

**2. [Rule 1 - Bug] The `readFile` count criterion counts the import line**
- **Found during:** Task 3
- **Issue:** `grep -c 'readFile' lifecycle.steps.ts` prints `2`, against "at most `1`". One line is the named import, and the other is the Given's only read-back. No Then exists in the module.
- **Fix:** None. The named import follows every other step module. A default import of `node:fs/promises`, used only to pass the grep, would have no precedent under `features/`. The criterion's intent (no Then reads the file) holds.
- **Files modified:** none
- **Committed in:** n/a

**3. [Cosmetic] The disable scenario's calls table was realigned in Task 2**
- **Found during:** Task 2
- **Issue:** Task 1's table had seven spare spaces in its text column.
- **Fix:** Copied the uninstall scenario's aligned table, which has the same rows. The cells did not change.
- **Committed in:** `74e0011`

---

**Total deviations:** 3 (1 blocking, 1 criterion not met as written, 1 cosmetic).
**Impact on plan:** Every behavior the plan named is pinned. Only the shape of the replacement `.mcp.json` differs from the plan text.

## Issues Encountered

- One `npm run lint` was killed by the OOM killer (exit 137) while another executor's ESLint ran. The next `npm run check:static` passed. Every later static run passed too.
- `REQUIREMENTS.md` is not edited here, as with plan 06-01. The orchestrator marks MCP-08.

## Handed-over fix

None. No product break was found: disable, uninstall, enable, update, and the user-override rules all behave as the plan expected on adapter 7.0.0.

## Red proof

No product change, so no red-then-green proof applies. Each scenario fails under a plausible wrong product: a verb that leaves the server would give `echo:ping` and a non-empty stub log; an update that keeps the old entry would give `echo:ping` where `v2:echo:ping` is pinned; a verb that drops the user's `disabled` would start the stub. The enable scenario and the no-update control show both answers, so the expected texts are not vacuous.

## Next Phase Readiness

- Plan 06-08 (docs) can cite the measured literals above for uninstall (same as disable) and for a disabled override (`(1 disabled)` and `⊘ ... (disabled)`).
- Plan 06-07 has nothing to fix from this plan.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-06-14 and T-06-15 are mitigated by the scenarios as planned. The override Given writes only the sandbox's `{agent dir}/mcp-adapter.json`.

## Parent lines

- `features/lib/mcp-server-files.ts` (`withStubServers`): a document `{"mcpServers": {"stub": {"stub": {...}}}}` cannot be written through the shared Given, because the `mcpServers` member reads as a stub marker. A server named `stub` needs the wrapper-less root form, or a second server beside it. A later parent line may make the marker rule skip a member named `mcpServers`, or document the limit in the Given's comment.
- Plan 06-08, `docs/mcp-compatibility.md` "User overrides": the `disabled` override is now shown behaviorally to survive update, disable then enable, and uninstall then install. pi-mcp-adapter lists it as `⊘ <key> (disabled)` with `(1 disabled)` in its status line.
- Phase 6 log (the orchestrator appends): the dubious choices below.

## Self-Check: PASSED

- FOUND: `features/mcp-server/lifecycle.feature`, `features/step_definitions/mcp-server/lifecycle.steps.ts`
- FOUND commits on this branch: `be41db1`, `74e0011`, `acbf7d6` (3, measured `git rev-list --count 38f3900..HEAD`)
- Acceptance criteria: Task 1 `^Feature: MCP server lifecycle$` = 1 and `MCP: 0/0 servers, 0 tools` >= 1: PASS. Task 2 `v2:echo:ping` = 1 and `^  Scenario` = 8 (>= 5): PASS. Task 3 `writeMcpAdapterOverride(` = 1 and `survives` = 3: PASS; `readFile` = 2, see Deviation 2.
- Plan verification: `npx cucumber-js features/mcp-server/lifecycle.feature` 8/8 passed three runs in a row (seeds 85549, 851518, 471238). `npm run check:features` passed. `npx fallow dupes --fail-on-issues --format human --quiet` exited 0. `npm run check:static` passed before each commit.

## Dubious Choices

1. **Wrapper-less replacement `.mcp.json`.** Alternatives: a scenario-local Given in `lifecycle.steps.ts` that writes `stubMcpFileText` with the new env (off the plan's key link to the shared Given); a second server beside `stub` (it would add a second server's messages to the stub log); renaming the server (the update would then remove one server and add another, not replace it). Dubious because the scenario now also depends on the root `.mcp.json` being read without its `mcpServers` wrapper. That is product behavior from before this phase, but this plan did not check it against Claude Code 2.1.316.
2. **Kept the named `readFile` import against a literal grep criterion.** Alternative: `import fs from "node:fs/promises"` to make the count 1. Dubious because a criterion was left unmet as written.
3. **The override survives an update that changes only the version.** The update re-stages the same server definition. A stronger form would also change the server's `.mcp.json`, to show that the choice survives a changed definition. Alternative not taken, to keep each override scenario about one verb pair.
4. **The no-update control also compares the stub's whole log.** That log is the same for both versions (the stub does not log its `STUB_TAG`), so only the model's answer tells the versions apart. The plan asked for the log in every scenario, so it stays.
