---
status: complete
phase: 92-mcp-staging-parity
source: [92-01-SUMMARY.md, 92-02-SUMMARY.md]
started: 2026-08-05T01:15:11Z
updated: 2026-08-05T02:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Placeholder substitution in committed mcp.json
expected: Installing a plugin whose .mcp.json declares ${CLAUDE_PLUGIN_ROOT} (and/or ${CLAUDE_PLUGIN_DATA}) in command/args stages an mcp.json entry with those placeholders replaced by the real install paths — no literal ${CLAUDE_*} tokens remain anywhere in the staged entry (deep substitution: nested args, objects, arrays all covered) and the ownership marker is intact (MENV-01).
result: pass
note: "Verified live 2026-08-04 (user ran marketplace add + install --scope project in sandbox Pi from tmp/work; Claude inspected tmp/work/.pi/mcp.json at user request). Fixture mcp-probe@menv-uat-mkt. command/args real paths (pluginRoot=marketplace source dir for path-source mkt; data dir under .pi/pi-claude-marketplace/data/menv-uat-mkt/mcp-probe; CLAUDE_PROJECT_DIR=tmp/work); nested metadata.nested.deep[0] substituted, deep[1] plain string untouched; grep '${CLAUDE_' count = 0; _piClaudeMarketplace marker intact on all three entries."

### 2. Stdio env injection with declared-wins precedence
expected: A stdio (command-bearing) server's staged entry gains env keys CLAUDE_PLUGIN_ROOT and CLAUDE_PLUGIN_DATA set to the real paths even when the plugin declared no env; a plugin-declared env key with the same name wins over the injected default (appearing once, with substitution applied to its value). A url-type entry gets its strings substituted but never gains a synthesized env (MENV-02, D-92-02).
result: pass
note: "Verified live 2026-08-04 from the same committed tmp/work/.pi/mcp.json: menv-stdio (no declared env) gained injected CLAUDE_PLUGIN_ROOT/DATA (+PROJECT_DIR, project scope); menv-declared kept CLAUDE_PLUGIN_ROOT='declared-wins-literal' (exactly 1 occurrence in file — declared wins, no dup), MENV_DATA_REF substituted to data-dir/declared, non-declared CLAUDE_PLUGIN_DATA still injected; menv-url url substituted, no env key synthesized."

### 3. Project vs user scope CLAUDE_PROJECT_DIR arm
expected: A project-scope install substitutes ${CLAUDE_PROJECT_DIR} to the project cwd and injects env.CLAUDE_PROJECT_DIR=cwd on stdio entries; the same plugin installed at user scope leaves the ${CLAUDE_PROJECT_DIR} token untouched and injects no CLAUDE_PROJECT_DIR env key — that is the only divergence between the two scopes (MENV-03).
result: pass
note: "Verified live 2026-08-04. Project arm covered by Tests 1-2 (CLAUDE_PROJECT_DIR=tmp/work substituted + injected). User arm: after uninstalling the project copy, install --scope user staged tmp/pi-uat/agent/mcp.json with exactly ONE ${CLAUDE_*} literal in the file — ${CLAUDE_PROJECT_DIR}/notes in args (passthrough) — and no CLAUDE_PROJECT_DIR env key on any entry; data paths re-derived to the user-scope data dir. Procedure detour: first user-scope install attempt from cwd=tmp/work failed CLEAN with a server-collision error (project copy still declared menv-* in slot[3] tmp/work/.pi/mcp.json) — designed MC-4 cross-slot detection (name-only, no owner exemption; same behavior plan 02's tests isolate scopes for), user confirmed the error notification; fail-clean verified (no state.json/claude-plugins.json/mcp.json mutation at user scope). Also observed: project-scope uninstall cascade emptied tmp/work/.pi/mcp.json with no orphans."

### 4. Re-derivation on reinstall/update
expected: Re-staging the same plugin (reinstall, or update after the install root changes) re-derives all paths from the fresh install location — no substring of any stale/old root remains; re-staging with an unchanged root is byte-identical (idempotent, no double-substitution); foreign mcp.json entries not owned by the plugin survive verbatim and gain no injected CLAUDE_* keys (MENV-04).
result: pass
note: "Verified live 2026-08-04. Planted a foreign 'their-server' (marker _someOtherTool, raw ${CLAUDE_PLUGIN_ROOT} token in args, own env) plus top-level field theirTopLevelField into tmp/pi-uat/agent/mcp.json, then reinstall --scope user. Post-reinstall: all three menv-* entries deep-equal the pre-reinstall snapshot (idempotent, no double-substitution); their-server byte-verbatim (token still literal, env only THEIR_KEY — no injected CLAUDE_* keys); top-level field survived; no stale project-cwd (tmp/work) substring anywhere. New-pluginRoot arm covered by automated stage.test.ts MENV-04 re-stage-with-new-root test; live scope-switch (Test 3) additionally demonstrated per-location data-path re-derivation."

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
