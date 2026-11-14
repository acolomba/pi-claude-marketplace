# pi-dynamic-workflows: an agent type's tool policy does not reach Pi's built-in tools

Patch: no patch exists; this report is not filed.
Repository: https://github.com/QuintinShaw/pi-dynamic-workflows
Package version: 3.15.0 installed and 3.15.2 read as source, 2026-11-13; 3.15.1 measured by spike S4 with Pi 1.5.2, 2026-11-11.

## Problem: a read-only agent type holds bash, edit, and write

A workflow script can run an agent with `agent(prompt, { agentType })`. The agent type's definition can restrict its tools with `tools` (an allow list) or `disallowedTools` (a deny list). The engine applies those lists to its own custom tools only. Pi creates its built-in tools (`read`, `bash`, `edit`, `write`, and the others) independently of the custom tools, so the child session keeps them. Only the codemode branch passes the policy to Pi.

### Where the engine applies the policy

In `src/agent.ts`, the child session is built in this order:

| Step                                                                                               | 3.15.0 | 3.15.1 | 3.15.2 |
| -------------------------------------------------------------------------------------------------- | ------ | ------ | ------ |
| `applyToolPolicy(` filters `[...baseTools, ...(options.tools ?? [])]` into `customTools`           | 1210   | 1210   | 1211   |
| `if (childCodemode) {`, the only branch that adds policy-filtered names to `excludedTools`         | 1247   | 1247   | 1248   |
| `excludedTools.push(...policyTools.filter((tool) => !permitsChildTool(tool.name))...)`             | 1260   | 1260   | 1261   |
| `excludedTools.push(...[...deniedToolNames].filter(...))`, the denied names                        | 1262   | 1262   | 1263   |

The codemode branch's own comment states the gap: "Pi creates core tools independently of customTools. Deny policy-filtered names at its registry boundary so codemode cannot rediscover them." Outside that branch, `excludedTools` holds only the engine's own exclusions, and it reaches Pi as `excludeTools: excludedTools` (line 1448 at 3.15.0). 3.15.0 was read from the installed package. 3.15.1 and 3.15.2 were read from the published tarballs.

### Measured tool list

Spike S4 ran the engine's own child-session code on 3.15.1 with Pi 1.5.2 and stopped before a model request. With an agent type that allows only `read`, the child's active tools were `read`, `bash`, `edit`, and `write`. With an agent type that denies `bash`, `bash` stayed active. The engine passed Pi the filtered custom tools and an exclusion list that held only `workflow` and `workflow_control`.

### Claude Code, for contrast

Claude Code 2.1.323 keeps the restriction. When a workflow runs an agent type, it builds the subagent's options from the agent definition, with `disallowedTools` joined from the definition's list and the call's list, and `tools` taken from the definition. A read-only plugin agent stays read-only inside a workflow there.

Until the engine applies the policy in every mode, pi-claude-marketplace notes at install, update, and `info` which of `read`, `bash`, `edit`, and `write` such an agent type gets outside codemode.

## Draft issue

**Title:** Apply an agent type's tool policy to Pi's built-in tools in every mode

**Body:**

```markdown
An agent type's `tools` and `disallowedTools` filter only the engine's custom tools. Pi creates its built-in tools independently, so a child session keeps them unless codemode is on.

In 3.15.2, `src/agent.ts:1211` applies `applyToolPolicy` to `customTools`. Only the `if (childCodemode) {` branch at `src/agent.ts:1248` adds the policy-filtered names and the denied names to `excludedTools` (lines 1261 and 1263). The code is the same in 3.15.0 and 3.15.1, one line earlier.

Measured on 3.15.1 with Pi 1.5.2: a child whose agent type allows only `read` has `read`, `bash`, `edit`, and `write` active. A child whose agent type denies `bash` keeps `bash`. The exclusion list holds only `workflow` and `workflow_control`.

Claude Code keeps an agent definition's `tools` and `disallowedTools` when a workflow runs the agent, so a plugin's read-only agent can write files when the same workflow runs under this engine.

Please add the policy-filtered built-in names and the denied names to `excludedTools` in every mode, as the codemode branch already does.
```
