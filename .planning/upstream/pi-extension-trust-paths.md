# Pi: an extension cannot make its project files require trust

Patch: no patch exists; this report is not filed.
Repository: https://github.com/earendil-works/pi
Package version: 1.5.2, read as source, 2026-11-14.

The package is `@earendil-works/pi-coding-agent`, in `packages/coding-agent`. The installed copy is 1.5.0. A `diff` against the unpacked 1.5.2 tarball shows that `dist/core/trust-manager.js` and `dist/core/project-trust.js` are byte-identical in the two versions, so the line numbers below hold for both. The `dist/main.js` line numbers are from 1.5.0.

## Problem: Pi does not ask about a folder that holds only an extension's files

Pi decides whether a folder needs a trust decision from a fixed list. `dist/core/trust-manager.js:8-17` lists `settings.json`, `mcp.json`, `extensions`, `skills`, `prompts`, `themes`, `SYSTEM.md`, and `APPEND_SYSTEM.md` under `.pi/`. `hasTrustRequiringProjectResources` (`dist/core/trust-manager.js:157-176`) also counts `.agents/skills` in the folder or a parent. An extension cannot add a path to this list.

When the folder holds none of these resources, `resolveProjectTrusted` returns the saved decision, or `true` when there is none (`dist/core/project-trust.js:22-23`). It returns before the `project_trust` event at line 26, so Pi does not ask the user and no extension sees the event. `dist/main.js:603-607` computes the same answer for the first runtime without a call to the resolver. A saved "Do not trust" is honored in both places.

### Why this matters here

pi-claude-marketplace installs Claude Code plugins. A project-scope install writes `.pi/claude-plugins.json`, `.pi/pi-claude-marketplace/`, and `.pi/mcp-adapter.json`, and none of them is on the list. A repository that commits only these files is trusted without a prompt, unless the user saved "Do not trust" for it. Its project-scope plugins then run: skills, commands, hooks, MCP servers, and the plugin `bin` folders on `PATH`.

The extension gates every project-scope effect on `ctx.isProjectTrusted()` and keeps no trust state of its own. It follows Pi's answer and does not ask a second time. So it cannot make Pi ask before these files are used.

### Claude Code, for contrast

Claude Code loads a project-scope plugin only after the trust check that applies to project allow rules (the plugin loading page of the Claude Code documentation, fetched 2026-11-11). A repository that ships a plugin configuration does not run that plugin before the user trusts the folder.

## Draft issue

**Title:** Let an extension register project paths that require trust

**Body:**

```markdown
Pi 1.5.2 decides whether a project needs a trust decision from a fixed list of resources under `.pi/`, plus `.agents/skills` (`dist/core/trust-manager.js:8-17`, `:157-176`). For a folder that holds none of them, `resolveProjectTrusted` returns the saved decision, or `true`, before it emits `project_trust` (`dist/core/project-trust.js:22-23`). The user is not asked, and no extension sees the event.

An extension that reads project files of its own has no way to make Pi ask before those files are used. For example, an extension that installs plugins from a project configuration file under `.pi/` follows `ctx.isProjectTrusted()`, but a repository that commits only that file is trusted without a prompt.

Please add one of these:

1. A way for an extension to register project paths that require trust, so that `hasTrustRequiringProjectResources` counts them. For example, a `trustRequiringPaths` list in the extension manifest, or a registration call that runs before the trust decision.
2. The `project_trust` event for every project, so that an extension can ask for a decision when one of its own files is present.

A saved decision would still win, as it does today.
```
