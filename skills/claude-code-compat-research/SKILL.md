---
name: claude-code-compat-research
description: Research Claude Code plugin-system behavior before discussing pi-claude-marketplace choices, then anchor recommendations and CONTEXT.md decisions to verified upstream evidence.
---

# Claude Code compatibility research

pi-claude-marketplace gives Pi users the Claude plugin ecosystem: it installs real plugins from real Claude marketplaces and translates their components into Pi-native artifacts. Every behavior it gets wrong is a behavior a user already learned in Claude Code and now has to unlearn. Upstream parity is the product, not a courtesy.

So the default is to match Claude Code. Exactly two things license a divergence:

- **A recorded project decision.** AGENTS.md carries these with IDs -- SC-1, for instance, declines Claude Code's `local` scope and keeps exactly `user` and `project`.
- **A capability gap in Pi.** Pi has no equivalent for the upstream behavior, so parity is not available at any price.

"Upstream looks wrong to me" and "our way is simpler" are not licenses. A divergence that fits neither category is a question for the user, not a decision to settle inside the discussion.

Establish Claude Code's behavior before `analyze_phase` generates gray areas.

## First decide whether the phase touches the upstream contract

Not every phase does. Internal error plumbing, test structure, and Pi-only surfaces have no upstream analogue, and inventing one wastes the discussion.

Answer this in one line before researching anything. Research the phase if it touches component translation, install lifecycle, the command surface, scope, or enablement state -- anything a Claude Code user would recognize. Otherwise record that no upstream position applies and recommend from Pi and project constraints.

## Component reference

pi-claude-marketplace bridges five component kinds. Parity is the goal for each:

- [Skills](https://code.claude.com/docs/en/skills)
- [Commands](https://code.claude.com/docs/en/commands)
- [Agents](https://code.claude.com/docs/en/agents)
- [Hooks](https://code.claude.com/docs/en/hooks)
- [MCP servers](https://code.claude.com/docs/en/mcp)

The container and lifecycle surface around them:

- [Plugins reference](https://code.claude.com/docs/en/plugins-reference) -- manifest schemas, CLI commands, component specs
- [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) -- marketplace format, hosting, distribution
- [Settings](https://code.claude.com/docs/en/settings) and [the .claude directory](https://code.claude.com/docs/en/claude-directory) -- where enablement and scope state live
- [Environment variables](https://code.claude.com/docs/en/env-vars)

Kinds this project deliberately does not bridge -- `lspServers`, `monitors`, `themes`, `outputStyles`, `channels`, `userConfig`, `settings`, and [`workflows`](https://code.claude.com/docs/en/workflows) -- still need research when a phase proposes adopting one or when you need to confirm the classification still holds. `domain/unsupported-components.ts` keeps both sets closed, and a kind in neither set is silently ignored, so a new upstream component kind is a compatibility bug waiting to happen.

The [documentation index](https://code.claude.com/docs/llms.txt) routes anything not listed here. Read only the pages the phase needs.

## Evidence, strongest first

1. **The installed binary.** Documentation states the contract; the binary holds the exact tables, defaults, and closed sets. `grep -oa '<pattern>' ~/.local/share/claude/versions/<version>/claude` settles what the prose leaves open -- which variables are read, how a name is parsed, what a closed set contains. Record the version you grepped.
2. **Official documentation**, discovered through the index rather than from a remembered URL.
3. **The [CHANGELOG](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md)**, when the question is *when* a behavior changed or whether installed plugins predate it.
4. **Upstream-produced artifacts** -- official marketplace examples, installed plugins, generated manifests. An artifact proves what that artifact does, not what Claude Code guarantees; keep the distinction in the record.
5. **A sandboxed probe**, only once the four above leave the question open.

`claude plugin validate <path>`, `claude plugin details <name>`, and `claude plugin eval` answer many questions outright and need no sandbox.

Never turn missing evidence into an upstream position. State that the behavior is unknown or ambiguous, lower the confidence, and carry the uncertainty into both the discussion and the final context.

## The evidence record

Build one record per material compatibility question, then carry it forward unchanged into the option presentation and into CONTEXT.md -- the same fields serve all three:

- the question, and Claude Code's behavior, or an explicit "no upstream position known";
- evidence: URLs, artifact paths, or the grepped binary version, each with the retrieval or observation date;
- confidence as high, medium, or low, and the reason for that level;
- unresolved questions or conflicting evidence;
- the Pi or pi-claude-marketplace constraints that materially affect the choice;
- the proposed divergence, if any, and which of the two licenses covers it.

## Sandboxed probes

Run the smallest experiment that distinguishes the options, and record the exact command, fixture, exit status, and the output that decided it.

Record `claude --version` first. Create a fresh tree with `mktemp -d` and keep the config directory, plugin cache, working project, marketplace and plugin fixtures, and captured output inside it.

Scrub the ambient environment rather than overriding variables one at a time. `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_PLUGIN_CACHE_DIR`, and `CLAUDE_CODE_PLUGIN_SEED_DIR` all redirect state and the list grows with each release, so pass only the variables the probe needs, each pointed inside the temporary tree. A probe that inherits the operator's environment is not isolated even when every documented variable is set.

Prefer local-path fixtures and non-interactive `claude plugin` commands, run from the temporary project. Never read, write, add, remove, enable, disable, or update anything in the real user configuration or plugin cache, and never reuse `~/.claude`, the real project `.claude/`, or an existing marketplace clone. Put a timeout on anything that could block. Remove the tree when the probe finishes, keeping the evidence record.

If isolation cannot be established, or the probe would need credentials, destructive behavior, or unrelated network access, do not run it. Record the unresolved question instead.

## Present the choice

Show the context compactly before asking the user:

> **Claude Code:** installs are scoped `user`, `project`, or `local`, and `enabledPlugins` resolves across those three tiers in that order. Verified by grep against the 2.1.278 binary -- high confidence. **Matching option:** Option A, labeled `Claude Code` in the option list. **Compatibility:** a plugin enabled at one tier behaves as a Claude Code user expects. Option B re-resolves per command and would surprise anyone arriving from upstream. **Pi constraints:** Pi has no `local` scope (SC-1), so tier three has no target either way. **Recommendation:** Option A.

Every option must be a genuine implementation choice. Do not invent an upstream-compatible option the evidence does not support, and do not manufacture an upstream analogue for a project-internal decision -- mark that as having no known Claude Code position and recommend from Pi and project constraints. If evidence changes mid-discussion, correct the record before continuing.

## Preserve it in CONTEXT.md

Carry each record into the final `CONTEXT.md` alongside the option selected and the rationale for every divergence. Keep upstream facts, observed artifact behavior, and project decisions distinguishable: a future researcher must be able to re-check the source and understand why the project matched or diverged without reconstructing the discussion transcript.
