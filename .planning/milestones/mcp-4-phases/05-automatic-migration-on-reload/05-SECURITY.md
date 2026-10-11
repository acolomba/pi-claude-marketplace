---
phase: "5"
slug: "automatic-migration-on-reload"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-08"
---

# Phase 5 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (05-01..05-05 `<threat_model>` blocks); mitigations verified by
> gsd-security-auditor at ASVS L1, block_on high, 2026-10-08.

---

# Phase 5 (automatic-migration-on-reload) threat register

ASVS level 1, block_on high. Source: `<threat_model>` blocks of 05-01..05-05-PLAN.md. T-05-SC appears in all five plans and is counted once.
Paths are relative to the repo root; `ext/` = `extensions/pi-claude-marketplace/`.

| Threat ID | Category | Component | Severity | Disposition | Status | Evidence |
|-----------|----------|-----------|----------|-------------|--------|----------|
| T-05-01 | Tampering | `notifyMcpMigration` rows | medium | mitigate | CLOSED | `ext/shared/notification-dispatch.ts:608-622` (`isControlCodeUnit` + `printable`, C0/DEL/C1 -> `\uXXXX`); applied to file-derived strings at :686, :690, :697, :707, :719, :725, :729, :731, :733, :735 and leftover notice :359; tests `tests/shared/notification-dispatch.test.ts:6982` "AMIG-03: control characters in names and details render as \u escapes" (ESC `\u001b` and NUL `ac\u0000me`), also :6631, :7197, :7546 |
| T-05-02 | Information disclosure | migration notice | medium | mitigate | CLOSED | Details redacted: `ext/orchestrators/reconcile/mcp-migration.ts:329` (stopped), :504 (unfinished), `ext/orchestrators/reconcile/apply.ts:1330` (isolated catch); file-unreadable rows carry fixed basenames :562, :580; collision source via `sourceLabel` :313-323; exact notice text asserted in `tests/integration/mcp-migration.test.ts:138` ("AMIG-01: /reload moves an installed plugin's mcp.json entry ...", `deepStrictEqual` on notifications) |
| T-05-03 | Elevation of privilege | re-staged entry | high | mitigate | CLOSED | Only marker owner + key names read from legacy entries: `ext/bridges/mcp/legacy.ts:75-92` (`readLegacyMcpOwners`); staged servers come from the offline resolve, not the legacy entry: `mcp-migration.ts:338-350` (`stagedSource` -> `action.resolved.mcpServers`), :367 `prepareStageMcpServers`; integration `tests/integration/mcp-migration.test.ts:138-155` seeds `approveTools: true, enabled: false` and asserts `freshAdapterBytes` (note: `lifecycle` itself is not seeded in any case; `approveTools` is) |
| T-05-04 | Denial of service | `applyReconcile` | medium | mitigate | CLOSED | `ext/orchestrators/reconcile/apply.ts:1313-1332` `migrateScopeIsolated` try/catch -> `stopped` row, called at :1398; per-owner failures are rows: `mcp-migration.ts:381-390` (stage), :497 (removal); test `tests/orchestrators/reconcile/mcp-migration.test.ts:795` "a prepare failure for one owner is a stopped row ... and the next owner still moves" |
| T-05-05 | Tampering | lock-free writers of `mcp-adapter.json` | low | accept | CLOSED | Accepted risk (plan 05-01): "Same window as every install today; each write is an atomic rename, so a file is never torn." Premise holds: adapter writes go through `atomicWriteJson` (`ext/bridges/mcp/stage.ts:618`) |
| T-05-06 | Elevation of privilege | servers declaring `tools[].permission_policy` / `toolPermissions` | medium | mitigate | CLOSED | `ext/domain/mcp-server-features.ts:313` `unenforcedToolRules`; `ext/bridges/mcp/stage.ts:343-362` `toolRuleNotices`, emitted from the shared prepare at :572 (the path every stager and the migration at `mcp-migration.ts:367` use); heading `ext/shared/notification-dispatch.ts:435` "MCP server tool rules not enforced."; `docs/mcp-compatibility.md:134`; tests `tests/integration/mcp-tool-rules.test.ts:23` (install warns), `tests/integration/mcp-migration.test.ts:214` (migration warns) |
| T-05-07 | Information disclosure | tool-rules notice | low | mitigate | CLOSED | Notice text carries field names only: `ext/shared/notification-dispatch.ts:351`; `tests/integration/mcp-tool-rules.test.ts:71` asserts no notification contains `rule-tool-a7`, `rule-tool-b7` or `always_deny` |
| T-05-08 | Tampering | `{malformed mcp}` boundary | medium | mitigate | CLOSED | `ext/domain/mcp-server-features.ts:226-253` (`TOOL_POLICY` literal union, `REMOTE_SERVER_SCHEMA` validates `tools` and `toolPermissions`); `tests/domain/mcp-server-features.test.ts:481` (invalid `permission_policy` -> malformed), :486 (invalid `toolPermissions` -> malformed) |
| T-05-09 | Tampering | leftover deletion (`leftoverNames`) | high | mitigate | CLOSED | `ext/bridges/mcp/legacy.ts:140-167` (`isLeftover`: no own marker; stub, or full definition with own `directTools` only when `panelCopies`; `leftoverNames`: own key in selected `serverKey` map, not a new key); old names = the plugin's own marked legacy keys `ext/bridges/mcp/stage.ts:490`; own-scope file `panelCopies: true` :499, project file `panelCopies: false` :278; each deletion reported (`leftover-removed` notice stage.ts:234, rendered notification-dispatch.ts:359); negative tests `tests/bridges/mcp/legacy.test.ts:442, :453, :472, :484, :495, :509, :520`; integration `tests/integration/mcp-legacy-sweep.test.ts:137` "a user's own full server under the old name stays and is not reported" |
| T-05-10 | Tampering | cross-scope write of the project `mcp-adapter.json` | low | accept | CLOSED | Accepted risk (plan 05-03): "Written only for a user-scope plugin with stubs under its old names, by atomic rename; the window equals the adapter's own lock-free writers." Premise holds: `ext/bridges/mcp/stage.ts:262` (user scope + legacy names only), :278 (stubs only, `panelCopies: false`) |
| T-05-11 | Denial of service (lost server) | `rollbackMcpReplacement`, `replacePreparedMcp` | high | mitigate | CLOSED | `ext/bridges/mcp/stage.ts:700-714` (restore in reverse write order; a failed `mcp.json` restore returns at once, adapter files left as written); :726-748 `replacePreparedMcp` (adapter, project, then legacy; failure restores earlier writes and rethrows); :756-765 `rollbackMcpReplacement`; fault-injection tests `tests/bridges/mcp/stage.test.ts:3112, :3130, :3163, :3326, :3344` |
| T-05-12 | Tampering | `__proto__` / hostile keys in swept files | medium | mitigate | CLOSED | `ext/bridges/mcp/legacy.ts:175-198` (`withoutServers`/`without` copy via `safeSet`), :141, :145, :164 (`Object.hasOwn`); `ext/bridges/mcp/stage.ts:296` (`Object.hasOwn`), :391 (`safeSet`), :540/:592 (`withoutServers`); `ext/orchestrators/reconcile/mcp-migration.ts:140` `ownValue` own-key lookup; tests `tests/bridges/mcp/legacy.test.ts:558` "a __proto__ old name stays an own key", :608 "__proto__ keys stay own keys in the copy" |
| T-05-13 | Information disclosure | load-time source read | high | mitigate | CLOSED | `ext/orchestrators/plugin/git-source-probe.ts:203-213` `makeRecordedShaPresenceProbe` uses only `pathExists`/`readFile` (imports :17-36, no `platform/git`); used at `mcp-migration.ts:257`; neither file is in `NETWORK_SEAMS` (`eslint.config.js:44`, BLOCK F at :334-344 lints them); cold-cache case `tests/integration/mcp-migration.test.ts:427` |
| T-05-14 | Spoofing | forged marker for an unowned entry | medium | mitigate | CLOSED | `ext/orchestrators/reconcile/mcp-migration.ts:282-287` (no record in this scope's state -> `reportUnowned`, no action), :214-218; marker strings via `printable` `ext/shared/notification-dispatch.ts:729`; tests `tests/orchestrators/reconcile/mcp-migration.test.ts:1035`, `tests/integration/mcp-migration.test.ts:281, :298` |
| T-05-15 | Information disclosure | collision row source | medium | mitigate | CLOSED | `ext/orchestrators/reconcile/mcp-migration.ts:313-323` `sourceLabel` (scope labels, "project .mcp.json", else basename), used at :387; test `tests/orchestrators/reconcile/mcp-migration.test.ts:1220` with source `~/.config/mcp/mcp.json` expecting label `mcp.json` |
| T-05-16 | Tampering | unparseable config files | medium | mitigate | CLOSED | `ext/orchestrators/reconcile/mcp-migration.ts:550-565` (`readOwnersOrReport`, before the lock), :568-583 (`adapterConfigReadable`), :592 (checked before any write in `migrateLocked`); rows carry `file: "mcp.json"` / `"mcp-adapter.json"` only; tests `tests/orchestrators/reconcile/mcp-migration.test.ts:909, :944` |
| T-05-17 | Repudiation | record degraded at load | medium | mitigate | CLOSED | Removal rows with cause `ext/orchestrators/reconcile/mcp-migration.ts:471-485`, rendered `ext/shared/notification-dispatch.ts:689-704`; record change `mcp-migration.ts:416-430` (`installable = false`, `unsupported += "mcpServers"`); integration `tests/integration/mcp-migration.test.ts:486` asserts record, notice rows and `info` breakdown `plugin:hello:live (unsupported ws)` |
| T-05-18 | Denial of service (lost server or trigger) | write order | high | mitigate | CLOSED | `ext/orchestrators/reconcile/mcp-migration.ts:586-616` `migrateLocked`: stage/commit per owner, then `saveState` :609, then `removeOwnerLegacyEntries` :614 (header :13-28); tests `tests/orchestrators/reconcile/mcp-migration.test.ts:671, :700` (recorded order), :1487, :1537 (crash in each of `commitPreparedMcp`/`saveState`/`removeLegacyMcpEntries` converges); integration `tests/integration/mcp-migration.test.ts:625` with `lockedLink` real refusal |
| T-05-19 | Tampering | forged marker naming an installed plugin | low | accept | CLOSED | Accepted risk (plan 05-05): "The marker is the MC-5 ownership contract and the file is the user's own; a forged marker can only make the plugin's own move remove that entry, and the removal is listed." |
| T-05-SC | Tampering | npm/pip/cargo installs | low | accept | CLOSED | Accepted risk (plans 05-01..05-05): "This plan installs no package." Premise holds: `git diff faab8758..HEAD -- package.json package-lock.json` is empty (faab8758 = "docs(05): create phase plan") |

## Accepted Risks

- **T-05-05** (Tampering, low) -- lock-free writers of `mcp-adapter.json` (`/mcp-adapter` panel, disable): same window as every install today; each write is an atomic rename, so a file is never torn.
- **T-05-10** (Tampering, low) -- cross-scope write of the project `mcp-adapter.json`: written only for a user-scope plugin with stubs under its old names, by atomic rename; the window equals the adapter's own lock-free writers.
- **T-05-19** (Tampering, low) -- forged marker naming an installed plugin: the marker is the MC-5 ownership contract and the file is the user's own; a forged marker can only make the plugin's own move remove that entry, and the removal is listed.
- **T-05-SC** (Tampering, low) -- npm/pip/cargo installs: the phase installs no package.
- Residual (inside T-05-09, D-05-10): a hand-written entry that happens to match one of the adapter's two shapes under an old name of the same plugin is removed; accepted by D-05-10, and every such removal is reported by name.
- Lost restriction (inside T-05-06, D-05-05): a plugin's declared per-tool rules are not enforced by pi-mcp-adapter; accepted by operator rule D-05-05 and surfaced as the "MCP server tool rules not enforced." warning.

## Trust Boundaries

- `<scopeRoot>/mcp.json` content -> migration and notice: keys and marker strings are file content the user, Pi or another tool may have written (05-01).
- Cached marketplace manifest and plugin source -> re-staged entry: the entry is rebuilt from the plugin source through the closed translator (05-01).
- Plugin manifest -> installed MCP server: a plugin's declared per-tool restrictions no longer gate the install (05-02).
- Marker-less entries in `mcp-adapter.json` -> deletion: content the user or the adapter wrote; the leftover rule deletes only the adapter's two shapes under an old name (05-03).
- User-scope command -> project `mcp-adapter.json`: a user-scope stage writes another scope's file without that scope's lock (05-03).
- Load-time step -> network: the step must never reach a remote, even when a clone is missing (05-04).
- Marker strings in `mcp.json` -> notice: an unowned entry's plugin and marketplace names are unvalidated file content (05-04).
- Load-time step -> install record: the step changes a record on a load the user did not start (05-05).
- Crash between file writes: a partial run must neither lose a server nor lose the trigger (05-05).

## Unregistered Flags

None. All five SUMMARY.md `## Threat Flags` sections read "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."

---

## Security Audit Trail

| Date | Auditor | Threats found | Closed | Open |
|------|---------|---------------|--------|------|
| 2026-10-08 | gsd-security-auditor (L1) | 20 | 20 | 0 |
