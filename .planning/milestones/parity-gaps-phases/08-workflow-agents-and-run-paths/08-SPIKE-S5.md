# Spike S5: the workflow engine in a pi-subagents background child, and pi-mcp-adapter in a workflow subagent

This record holds what spike S5 measured. Each outcome below comes from a run. None is a prediction. The predictions of 08-RESEARCH.md R1 are replaced by this record.

## Environment

- Run date: 2026-11-14, local time (UTC 2026-11-15, 03:44 to 03:50).
- Operating system: Linux 7.2.15-200.fc44.x86_64 (Fedora 44). The harness finds the fixture's processes through `/proc`, so the probe runs on Linux only.
- Node: v26.13.1.
- Pi: `@earendil-works/pi-coding-agent` 1.5.0, the repository's dev dependency, which the harness starts in RPC mode.
- pi-subagents: 0.88.1, the version in `test/integration/optional-peer-suite-versions.json`.
- Workflow engine: `@quintinshaw/pi-dynamic-workflows` 3.15.0.
- pi-mcp-adapter: 7.0.1.
- Each companion version was read from the installed package in `node_modules/.cache/optional-peers`, which `node scripts/install-test-peers.mjs` filled. The driver resolved each one through `resolveCompanion` and reported the same versions in its output.
- Tree: this worktree at `0920efcb`. The driver loaded this tree's extension and harness modules.

## Fixture

The driver is a scratch copy of `features/lib/real-subagent-child.ts`. It was kept outside the worktree, in a scratch directory, and it was deleted after the record was written. Its imports point at this tree's harness modules by absolute path, and its `EXTENSION_ENTRY` points at this tree's `extensions/pi-claude-marketplace/index.ts`. Each run builds its own fixture under the OS temp directory with `mkdtemp`: `HOME`, `PI_CODING_AGENT_DIR` (`<home>/.pi/agent`), a trusted project, and a local marketplace with the plugin `demo`. Every Pi gets the harness allowlist environment, with `PI_OFFLINE=1`. The provider is the harness's scripted OpenAI-compatible server on the loopback address, with the dummy key `pg3-dummy-key`. Every run used the adapter profile.

The scratch copy adds these things to the harness:

1. The engine. `resolveCompanion("pi-dynamic-workflows")` gives its entry, `extensions/workflow.ts`. The entry is passed to the main Pi's `extensions` beside pi-subagents and the adapter. It is also added to the `extensions` list of the fixture's Pi `settings.json`, after this extension and the adapter, so a child session loads the engine as a user's child does. The driver reports the engine version with the others.
2. The workflows. The plugin `demo` gets `workflows/scan.js`:

   ```js
   export const meta = {name:"scan",description:"Scans the project."};

   return "scan: " + (await agent("[pg8-step] Say the word."));
   ```

   The provider has no script for `[pg8-step]`, so it answers the engine's subagent with `Done.`. The plugin also gets `workflows/probe.js`, which S5(b) uses:

   ```js
   export const meta = {name:"probe",description:"Calls the stub mcp server."};

   return "probe: " + (await agent("[pg3-mcp-step] Call the echo tool."));
   ```

   The install saved both as `saved/demo:scan.json` and `saved/demo:probe.json` under `{agent dir}/workflows/`.
3. The agents. Each has `background: true` and the body `Run the tools the task names.`. The ambient arm is `amb-block` and `amb-default`, with no `tools` line. The listed arm is `lst-block`, `lst-default`, and `lst-fg`, with `tools: Read`. After the install commands, and before the session that launches a child starts, the driver changed `tools: read` to `tools: read, workflow` in the generated files `pi-claude-marketplace-demo-lst-block.md`, `pi-claude-marketplace-demo-lst-default.md`, and `pi-claude-marketplace-demo-lst-fg.md`. That is the form that option B would write. The generated ambient file has no `tools` line.
4. The scripted calls. `amb-block`, `lst-block`, and `lst-fg` make one call `workflow {"name":"demo:scan","background":false}`. `amb-default` and `lst-default` make one call `workflow {"name":"demo:scan"}` with no `background` argument, which is what a real model sends. The main session's `subagent` call for `lst-fg` also carries `"async": false`. The calls for the other agents carry no launch mode.
5. The observations. The provider also records the text of each tool result after the last user message of a request. The driver reads each child's messages from the session file that the run's `status.json` records, and lists `{agent dir}/workflows/` after each runner exits.

The main Pi launched the five agents in turn in one fixture, so each child ran in its own runner process.

## Command

Each run started from the worktree root. SCRATCH stands for the path of the scratch directory.

```sh
env -u PI_CM_TEST_HOME P0801_OUT=SCRATCH/out-a.json \
  node --import "$PWD/test/platform/isolated-pi-home.ts" SCRATCH/driver.ts a
```

The argument `b` runs S5(b) with the engine settings file, and `c` runs the control with no engine settings file. `--import` of `test/platform/isolated-pi-home.ts` gives the driver process itself a temporary `HOME` and `PI_CODING_AGENT_DIR`.

S5(a) ran twice, with the same driver. The second run captured the engine's run records in full. The table quotes the second run (UTC 03:46:32 to 03:47:49, driver exit 0). The first run (UTC 03:44:49 to 03:45:47, driver exit 0) gave the same outcome for every row. The one difference is in row a5, which the note below the table states.

## S5(a)

| id | arm | observation | outcome | deciding output | exit status |
| --- | --- | --- | --- | --- | --- |
| a1 | ambient | Declared tool names of the child's first provider request (last user text `Task: [pg3-task-demo:amb-block]: run the tools.`) | pass | `read, bash, edit, write, bg_wait, pi_claude_marketplace_list, pi_claude_marketplace_plugin_list, mcp, subagent, contact_supervisor, workflow, workflow_control, subagent_supervisor`. The request of `amb-default` declares the same list. Both `workflow` and `workflow_control` are declared. | driver 0 |
| a1 | listed | Declared tool names of the child's first provider request (`Task: [pg3-task-demo:lst-block]: run the tools.`) | pass | `read, workflow, contact_supervisor`. The request of `lst-default` declares the same list. `workflow_control` is not declared. | driver 0 |
| a2 | ambient | `state` of the run's `status.json`, for `amb-block` and `amb-default` | pass | `"state": "complete"`, step `{"agent": "demo:amb-block", "status": "complete", "exitCode": 0}`; the same for `demo:amb-default` | driver 0, runner step exitCode 0 |
| a2 | listed | `state` of the run's `status.json`, for `lst-block` and `lst-default` | pass | `"state": "complete"`, step `{"agent": "demo:lst-block", "status": "complete", "exitCode": 0}`; the same for `demo:lst-default`. No "requested unavailable child tools" error. | driver 0, runner step exitCode 0 |
| a3 | ambient | A provider request whose last user text holds `[pg8-step]`, inside the launch of `amb-block` | pass | `Task label: agent 1` / `[pg8-step] Say the word.`, declared tools `read, bash, edit, write, store_put, store_get`. It arrived between the child's first and second request. | driver 0 |
| a3 | listed | The same, inside the launch of `lst-block` | pass | `Task label: agent 1` / `[pg8-step] Say the word.`, declared tools `read, bash, edit, write, store_put, store_get` | driver 0 |
| a4 | ambient | The `workflow` tool result in the child's session file, for the call `{"name":"demo:scan","background":false}` of `amb-block` | pass | `isError: false`: `Workflow **scan** completed with **1** agent(s).` ... `## Result` ... `"scan: Done."`. The child then made its next request in the same turn and answered `Done.`. | driver 0 |
| a4 | listed | The same, for the blocking call of `lst-block` | pass | `isError: false`: `Workflow **scan** completed with **1** agent(s).` ... `## Result` ... `"scan: Done."` | driver 0 |
| a5 | ambient | For the call `{"name":"demo:scan"}` of `amb-default`: the tool result, the engine's run record after the runner exits, and a later provider request of the child | recorded | Tool result: `Workflow "scan" started in the background.` / `Run ID: scan-mwhamy7e-bjynwq` / `It keeps running on its own. When it finishes, the result is delivered back` / `here and the conversation continues automatically`. The engine's `[pg8-step]` request arrived, and the child's next request had the same last user text and no result in it; the child answered `Done.` and ended. Run record `projects/<key>/runs/scan-mwhamy7e-bjynwq.json`: `summary` `{"total":1,"done":1,...,"error":0}`, `pendingDelivery` `{"kind":"complete",...}`. After the child's last assistant message, the session file holds one `custom_message` of type `workflow-result`: `✓ Background workflow "scan" finished (1 agents · 2 tok · 0.2s).` / `scan: Done.`. No provider request of the child came after it. | driver 0, runner step exitCode 0 |
| a5 | listed | The same, for the call `{"name":"demo:scan"}` of `lst-default` | recorded | Tool result: `Workflow "scan" started in the background.` / `Run ID: scan-mwhangb4-ihvdzb`. The `[pg8-step]` request arrived, the child's next request carried no result, and the child answered `Done.`. Run record `scan-mwhangb4-ihvdzb.json`: `summary` `{"total":1,"done":1,...,"error":0}`, `pendingDelivery` `{"kind":"complete",...}`. The session file holds no `workflow-result` message. | driver 0, runner step exitCode 0 |
| a6 | listed | The main session's `subagent` call for `lst-fg` with `"async": false` | pass | `isError: true`: `Agent 'demo:lst-fg' ran as a foreground child, which never loads the parent's ambient extensions, and these child tools were unavailable: workflow.` No status file was written, and no provider request with the task marker of `lst-fg` arrived. | driver 0 |

Notes on the rows:

- a5 varies between runs. In the first run, neither default-call child's session file held a `workflow-result` message, and both run records held `pendingDelivery` `{"kind":"complete",...}`. In the second run, the engine appended the message to the session file of `amb-default` after the child's last answer, but not to that of `lst-default`. In both runs, no provider request of any child carried the result. A run that the child started with the default call completes in the runner, but its result never reaches the child's model.
- In a workflow's own subagent (row a3), the engine declares neither `workflow` nor `workflow_control`. This matches `DEFAULT_EXCLUDED_SUBAGENT_TOOLS` in the engine's `src/agent.ts`.
- No run printed an `extension_error` record in the main Pi. Its stderr held only Pi's warning that the adapter's `/mcp` command keeps the built-in `mcp` extension from loading, which every adapter-profile run prints.

## S5(b)

S5(b) ran in the main session of two new fixtures of the same design, in the adapter profile, with no pi-subagents child. The fixture's Pi `settings.json` lists this extension, pi-mcp-adapter, and the engine in `extensions`. The adapter gets the harness's onboarding seed. Before the workflow command, the driver waited until the stub server had logged a `tools/list` and no stub process ran, which is the adapter's listing rule of `waitForStubListing`. The install wrote the plugin server to `mcp-adapter.json` with `"directTools": "search"`.

- Run b (UTC 03:48:57, driver exit 0) wrote `{"providerMiddlewareExtensions":["pi-mcp-adapter"]}` to `{agent dir}/workflows/settings.json` before the main Pi started. That is the path that `platform/workflow-home.ts` computes when `PI_CODING_AGENT_DIR` is set.
- Run c (UTC 03:49:27, driver exit 0) is the control. Its fixture has no engine settings file: the driver read `{agent dir}/workflows/settings.json` and found no file.

In both runs, the main session sent the typed workflow command `/demo:probe` and Pi answered `{"disposition":"handled"}`. The provider script for `[pg3-mcp-step]` makes two calls: first `mcp {"tool":"mcp__plugin_demo_stub__echo","args":{"text":"pg8-proxy"}}`, the adapter's proxy tool, then `mcp__plugin_demo_stub__echo {"text":"pg8-direct"}`, the plugin tool called directly. After the run ended, the main session's prompt `[pg3-main-mcp]` made the same two calls.

An earlier run b, at UTC 03:48:12 with driver exit 0, recorded no tool result texts, so the driver was changed to record them, and run b was repeated. The earlier run gave the same outcome for every row that it recorded.

| id | arm | observation | outcome | deciding output | exit status |
| --- | --- | --- | --- | --- | --- |
| b1 | settings | Declared tool names of the workflow subagent's provider requests (last user text `Task label: agent 1` / `[pg3-mcp-step] Call the echo tool.`) | pass | First request: `read, bash, edit, write, mcp, store_put, store_get`. Second and third requests: the same list plus `mcp__plugin_demo_stub__echo`. The adapter's `mcp` tool is declared from the first request, and the plugin tool is declared after the proxy call. | driver 0 |
| b2 | settings | The subagent's tool results and the stub server's message log | pass | Proxy call result: `echo:pg8-proxy`. Direct call result: `echo:pg8-direct`. Stub log after the command: the sequence `initialize`, `notifications/initialized`, `tools/list` twice (once in the earlier run b), then `tools/call {"name":"echo","arguments":{"text":"pg8-proxy"}}`, `tools/call {"name":"echo","arguments":{"text":"pg8-direct"}}`. | driver 0 |
| b3 | settings | The last progress entry of the run, and Pi's records from the command on | pass | `pi-dynamic-workflows:progress` `"status":"completed"`, `"resultPreview":"probe: Done."`, `"doneCount":1,"errorCount":0`, agent model `pg3-loopback/scripted`. No `extension_error` record. | driver 0 |
| b4 | settings | The main session calls the plugin tool after the run | pass | `mcp` result `echo:pg8-proxy`, `mcp__plugin_demo_stub__echo` result `echo:pg8-direct`, both `isError: false`. Stub log: a new `initialize`, `tools/list`, then both `tools/call` requests. No `extension_error` record. | driver 0 |
| b5 | control, no settings file | Declared tool names of the workflow subagent's provider requests, in run c | pass | Every request: `read, bash, edit, write, store_put, store_get`. Tool results: `Tool mcp not found`, then `Tool mcp__plugin_demo_stub__echo not found`. The stub log has no message from the command. The run still ended `"status":"completed"` with `"probe: Done."`, and the main session's calls after it worked as in b4. | driver 0 |

## Verdicts

- S5(a) blocking call: Passed for both arms. A real pi-subagents 0.88.1 background child that loads engine 3.15.0 was offered `workflow`, ran `demo:scan` with `background: false`, and got `scan: Done.` in the same turn. This was true for an agent with no `tools` list and for an agent whose generated `tools` line lists `read, workflow`. The run's `status.json` was `complete`, and pi-subagents' required-tool check did not refuse the listed agent.
- S5(a) default call: The child got the text `Workflow "scan" started in the background.` and a run ID. Its model ended the turn, so the result never reached it. The run itself completed in the runner, and its record keeps `pendingDelivery` `{"kind":"complete"}`. In one of four default-call children, the engine appended a `workflow-result` message to the child's session file after the child's last answer, and no provider request came after that message.
- S5(a) agent with no tools list: Yes. A background child of an agent with no `tools` list was offered both `workflow` and `workflow_control`, beside this extension's tools, `mcp`, and pi-subagents' own tools. Claude Code gives neither tool to a subagent.
- S5(a) foreground control: Yes. pi-subagents refused the launch with `"async": false` before any model request, with `Agent 'demo:lst-fg' ran as a foreground child, which never loads the parent's ambient extensions, and these child tools were unavailable: workflow.`
- S5(b) adapter setting: Works. With `{"providerMiddlewareExtensions":["pi-mcp-adapter"]}` in `{agent dir}/workflows/settings.json` and the adapter in Pi's `settings.json` `extensions`, a workflow subagent was offered the adapter's `mcp` tool. It called the plugin's stub server through `mcp` (`echo:pg8-proxy`), and after that proxy call it also called `mcp__plugin_demo_stub__echo` directly (`echo:pg8-direct`). The run completed with no extension error, and the main session's plugin tool still worked afterwards.
- S5(b) control: With no engine settings file, a workflow subagent was offered only `read, bash, edit, write, store_put, store_get`. Both calls failed with `Tool mcp not found` and `Tool mcp__plugin_demo_stub__echo not found`, and the stub server got no request.
