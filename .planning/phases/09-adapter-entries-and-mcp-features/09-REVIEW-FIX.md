---
phase: 09-adapter-entries-and-mcp-features
fixed_at: 2026-11-14T22:54:42Z
review_path: .planning/phases/09-adapter-entries-and-mcp-features/09-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-11-14T22:54:42Z
**Source review:** .planning/phases/09-adapter-entries-and-mcp-features/09-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 11 (1 critical, 4 warning, 6 info; fix scope `all`, as the orchestrator asked)
- Fixed: 11
- Skipped: 0

Every fix ran in the `features/gaps-mcp` checkout itself, `/home/acolomba/src/pi-claude-marketplace-gaps-mcp`, with no isolated review-fix worktree, as the orchestrator directed. All test runs used the hermetic test homes (`test/platform/isolated-pi-home.ts` and the cucumber world). `npm run check` was not run, as directed. The commit hook ran `npm run check:commit` on each commit and it passed.

Three new decision IDs are proposed and wait for maintainer review: D-PG9-14 (caFile), D-PG9-15 (idleTimeout), and D-PG9-16 (stdio restart). The parent-line texts at the end of this report record them. No shared planning file was edited.

## Fixed Issues

### CR-01: A carried `caFile` makes pi-mcp-adapter refuse a plugin server whose update changes it to stdio or to plain http

**Status:** fixed: requires human verification (logic change, decision D-PG9-14 pending maintainer review)
**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`, `bridges/mcp/stage.ts`, `bridges/mcp/types.ts`, `orchestrators/marketplace/shared.ts`, `shared/notification-{types,mcp,resolve,json,wire,dispatch}.ts`, `schema/claude-plugin.schema.json`, `docs/{mcp-compatibility,output-catalog,json-output}.md`, `CHANGELOG.md`, `features/mcp-server/lifecycle.feature`, and seven test files
**Commit:** 0ed26d1c
**Applied fix:** A restage keeps a carried `caFile` only while the new entry is an https server (no `command`, no `socket`, an `https:` url) and, when the entry it replaces defines a server, at the same origin. The origin is the scheme and authority, compared as lowercased text so that a `${VAR}` host still compares. An override stub defines no url, so only the transport decides for a stub. Each removal emits a new user-visible MCP config notice, `ca-file-removed` ("MCP server caFile removed."), the last section in order. The notice has a catalog block, a wire schema member, JSON output docs, and redaction. The unstage fold drops it for a removed server. `restoredOverride` now writes a kept override's `caFile` back when the live entry lacks one, so a user stub does not lose its `caFile`. The code comment and `docs/mcp-compatibility.md` no longer say "can only narrow" or "None of the four holds a credential". The text now follows the adapter's url-bound treatment (`URL_BOUND_AUTH_FIELDS`, `validateCaFile`).
**Decision taken (pending review):** drop the `caFile` with a user-visible notice, rather than keep it only in the kept override. Bind it to the origin, not the exact url (the adapter's merge binds to the exact url string, but its CA fetch is origin-scoped). Same-origin path changes keep the `caFile`, so the two D-PG9-05 scenarios still hold.
**Tests:** new unit cases in `test/bridges/mcp/adapter-entry.test.ts` cover stdio, plain http, another origin, a socket or non-string url in the previous entry, a same-origin url in a different case, a stub absorbed by a stdio entry, and two `restoredOverride` cases. The other new cases are in `stage.test.ts` (the notice and its order), `notification-{mcp,resolve,json}.test.ts`, `orchestrators/marketplace/shared.test.ts` (the fold), and `test/architecture/mcp-config-notices.test.ts` (the catalog bytes). Direct coverage is 100% for each touched source. `npm run test:integration` passed. The cucumber suite passed under the adapter profile (`features/mcp-server` plus `subagent-child.feature`, 164 scenarios) and the builtin profile (`features/mcp-server`, 130 scenarios). `check-features` passed.
**Red scenario:** `lifecycle.feature` "An update that makes a plugin server a stdio server removes the caFile the user wrote and says so (PG-MCP-09, D-PG9-14)". The scenario pins the result table with the notice and the written entry.
**Negative control:** with `caFileApplies` forced true, the scenario failed, and so did 7 unit cases and the stage case. With the `restoredOverride` caFile branch disabled, the two write-back cases failed. The source was restored and checked.

### WR-01: The `lazy-keep-alive` default voids a user's `idleTimeout` and the global `settings.idleTimeout`, and the docs claim the opposite

**Status:** fixed: requires human verification (logic change, decision D-PG9-15 pending maintainer review)
**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`, `test/bridges/mcp/adapter-entry.test.ts`, `features/mcp-server/lifecycle.feature`, `docs/mcp-compatibility.md`, `CHANGELOG.md`
**Commit:** 8b0a89d1
**Applied fix:** `defaultFieldsFor` treats a carried `idleTimeout` as the user's choice of lifetime and writes no `lifecycle` default beside it. A recorded `lifecycle` default goes at the next restage. The entry stays `lazy`, and the user's `idleTimeout` applies. Upstream parity does not argue against this. `idleTimeout` is a pi-mcp-adapter-only field, and D-PG9-03 says that a user value wins. `docs/mcp-compatibility.md` now states the true behavior: the keep-alive idle check skips such a server (`lifecycle.ts`), so the global `settings.idleTimeout` does not apply to a stdio plugin server that holds the default. The user-overrides text and a CHANGELOG sub-bullet name the effect of the global setting.
**Tests:** two unit cases (a fresh user `idleTimeout`, and a recorded lifecycle default that goes). Caller owner tests in `test/bridges/mcp/*` and the plugin and reconcile orchestrators passed. `npm run test:integration` passed.
**Red scenario:** `lifecycle.feature` "An idleTimeout the user wrote for a stdio plugin server survives an update in place of the lifecycle default (PG-MCP-06, D-PG9-15)". A second server in the scenario keeps the default.
**Negative control:** with the rule disabled, the scenario and both unit cases failed. The source was restored.
**Parent line needed:** the D-PG9-02 wording ("a per-entry value overrides nothing the user set elsewhere") is wrong. See the parent-line texts below.

### WR-02: Keep-alive health checks respawn a crashed stdio plugin server in the background, an upstream divergence with no decision ID

**Status:** fixed (records a divergence; decision D-PG9-16 proposed, pending maintainer review)
**Files modified:** `docs/mcp-compatibility.md`, `CHANGELOG.md`
**Commit:** 80ee569c
**Research:** In the Claude Code 2.1.323 binary, the transport-close handler runs `if(Nr!=="stdio"&&Nr!=="sdk"){... attempting automatic reconnection ...}else ... on({...go,type:"failed"})`. So only a remote transport reconnects by itself, with backoff, and a closed stdio server is marked failed until `/mcp` reconnects it. This agrees with U25 in `docs/research/parity-gaps/mcp.md:81`. pi-mcp-adapter 7.0.1 behaves differently. `checkKeepAliveConnection` (`lifecycle.ts:165-211`) reconnects a keep-alive server whose connection is not `connected`, every 30 seconds, with a backoff of 30 s to 5 min. `lazyConnect` (`init.ts:978`) also restarts a stopped server at its next tool call in every lifecycle mode. `eager` is not health-checked, but it still restarts on use and starts at Pi start. So no small change gives parity, and the restart is recorded as a divergence.
**Applied fix:** A Connection lifecycle paragraph and a Loading divergence bullet state the restart, its source lines, and the reason (D-PG9-16, a project decision plus an adapter gap). The text says the behavior is unmeasured. The CHANGELOG mentions the background restart.
**Tests / negative control:** none (docs only).

### WR-03: Phantom requirement — the release-0.23.0 fixture deletes an `openUi` default that no release ever wrote

**Status:** fixed: requires human verification (necessity finding)
**Files modified:** `features/lib/mcp-server-files.ts`
**Commit:** da5735a5
**Applied fix:** Removed `delete entry.openUi;` and "and `openUi`" from the doc comment.
**Tests:** the 0.23.0 reinstall scenario in `lifecycle.feature` still passes. The full adapter `features/mcp-server` run passed.

### WR-04: The docs present `openUi: false` as the user's way out without saying that it breaks agent MCP grants

**Status:** fixed
**Files modified:** `docs/mcp-compatibility.md`
**Commit:** 80ee569c
**Applied fix:** Both passages (Features beyond tools, and the Loading divergence) now say that, under pi-subagents 0.88.1, an entry with `openUi: false` stops every agent granted one of the server's tools from launching (D-CF6-10). So the user sets it only on a server that no agent is granted.

### IN-01: A single malformed `defaultFields` member turns every recorded default into a user value, permanently

**Status:** fixed: requires human verification (logic change in the marker parse)
**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/marker.ts`, `test/bridges/mcp/marker.test.ts`, `test/bridges/mcp/adapter-entry.test.ts`, `features/mcp-server/lifecycle.feature`
**Commit:** b7e6c434
**Applied fix:** The parse now keeps the scalar members and leaves out only the malformed one ("filter, do not reject"). An all-scalar record reads by identity, as before. `Object.fromEntries` keeps a scalar `__proto__` key as data, and an object-valued one is filtered out. The same commit rewrapped the long JSDoc line that IN-05 names in `marker.ts:74`, because the change rewrote that sentence.
**Decision taken (pending review):** filter rather than fail closed. The marker parse already tolerates each other malformed member (`pluginSetFields`, `keptOverride`) by leaving it out. The maintainer's corrupt-data preference, which is to refuse the command with `{unreadable}`, is the alternative.
**Tests:** the marker cases now expect the scalar members to remain. A new adapter-entry case shows that the other defaults are computed again. Caller tests passed (`test/bridges/mcp/*`, `markers-snapshot`, `marketplace/shared`, `uninstall`, `install-flow-ledger`). `npm run test:integration` passed.
**Red scenario:** `lifecycle.feature` "A recorded default list with one malformed member still lets an update to a remote server drop the stdio defaults (PG-MCP-06, D-PG9-03)".
**Negative control:** with `marker.ts` at HEAD, the scenario, the adapter-entry case, and three marker cases failed. The file was restored.

### IN-02: CHANGELOG omits the project-server re-approval that the lifecycle default triggers

**Status:** fixed
**Files modified:** `CHANGELOG.md`
**Commit:** 80ee569c
**Applied fix:** A sub-bullet now says that pi-mcp-adapter asks for project server approval again after the reinstall, and that it starts a stdio server again in the background when the server exits. The commit also reworded the CR-01 caFile sub-bullet to drop the rationale, as the changelog rules require. Security advisory 4 also names the sampling and UI divergences. The page covers them, and the CHANGELOG rules keep upstream behavior out of entries, so they were not added.

### IN-03: The `exposeResources` cell cites `init.ts` for the global setting, which lives in `config.ts`

**Status:** fixed
**Files modified:** `docs/mcp-compatibility.md`
**Commit:** 80ee569c
**Applied fix:** The cell now says that `config.ts` copies the global setting into each entry that lacks one, and that `init.ts` reads the entry. mdformat realigned the table.

### IN-04: `adapterEntryDefaults` returns a shared module constant and restates the marker value union

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/domain/mcp-server-features.ts`, `bridges/mcp/marker.ts`, `bridges/mcp/adapter-entry.ts`, `test/domain/mcp-server-features.test.ts`
**Commit:** fb7afdbe
**Applied fix:** Both inner default objects and the outer table are now frozen with `Object.freeze`. `AdapterEntryDefaultValue` is named once in the domain module. `MarkerDefaultValue` is removed, and the marker and the entry builder import the domain type (bridges may import domain).
**Tests:** a new case asserts that the stdio and remote defaults are frozen. Negative control: without the freeze, the case failed.

### IN-05: Comment lines past the 100-column width

**Status:** fixed
**Files modified:** `features/lib/hook-mcp-tool-server.ts` (and `marker.ts` within b7e6c434)
**Commit:** 60a54816
**Applied fix:** Rewrapped the overview comment line. The two remaining lines over 100 characters in that file are code string literals, not comments, so they were left alone.

### IN-06: The D-PG9-07 guard test leaves out `streamable-http`

**Status:** fixed
**Files modified:** `test/domain/mcp-server-features.test.ts`
**Commit:** 9af644ee
**Applied fix:** Added `{ type: "streamable-http" }` to the guard's servers. This is a regression guard on correct behavior, so no red-green proof applies.

## Parent-line texts (for the orchestrator; not applied)

**09-CONTEXT.md, append under "Fields the user wrote (PG-MCP-09)":**

> - **D-PG9-14 (proposed during the code-review fix, pending maintainer review; amends D-PG9-05):** A carried `caFile` is written only while the new entry is an https server (no `command` or `socket`, an `https:` url) and, when the entry it replaces defines a server, at that entry's origin (scheme and authority, compared as lowercased text). Otherwise the stage leaves it out and emits the `ca-file-removed` MCP config notice. A kept override's `caFile` is written back when the live entry lacks one. Premise: pi-mcp-adapter 7.0.1 refuses a `caFile` beside `command` or `socket` or a non-https url (`validateCaFile`, `http-ca.ts:9-18`), scopes the bundle to the entry's origin (`http-ca.ts:24`, `:42`), and treats `caFile` as url-bound (`URL_BOUND_AUTH_FIELDS`, `config.ts:1070-1081`). D-PG9-05's "None carries a credential" and "can only narrow trust" are withdrawn: at its origin, the entry trusts exactly the bundle.

**09-CONTEXT.md, D-PG9-02, replace the last sentence:**

> pi-mcp-adapter 7.0.1 has no global lifecycle setting (`config.ts:2093` is a per-entry default of `lazy`). A written `lifecycle: "lazy-keep-alive"` does, however, override the user's global `settings.idleTimeout` for that server once it has started, because the adapter's idle check skips keep-alive servers (`lifecycle.ts:146`). D-PG9-15 lets a user `idleTimeout` on the entry replace the default.

**09-CONTEXT.md, append under "Stdio lifecycle (PG-MCP-06, decision 5)":**

> - **D-PG9-15 (proposed during the code-review fix, pending maintainer review; amends D-PG9-01 and D-PG9-03):** A carried user `idleTimeout` counts as the user's `lifecycle`: no `lifecycle` default is written beside it, and a recorded one goes at the next restage, so the entry stays `lazy` and the user's `idleTimeout` applies. Premise: pi-mcp-adapter 7.0.1 never stops a started `lazy-keep-alive` server for idle time, whatever the entry or global `idleTimeout` says (`lifecycle.ts:146`, `init.ts:1032-1034`, `docs/configuration.md:135`).
> - **D-PG9-16 (proposed during the code-review fix, pending maintainer review; records a divergence of D-PG9-01):** Under `lazy-keep-alive`, pi-mcp-adapter 7.0.1 health-checks a started stdio server every 30 seconds and starts it again in the background after it exits, with a backoff of 30 s to 5 min (`lifecycle.ts:19-20`, `:165-211`). Claude Code 2.1.323 marks a closed stdio server failed until `/mcp` reconnects it; only a remote transport reconnects by itself (binary: `if(Nr!=="stdio"&&Nr!=="sdk"){…automatic reconnection…}else …type:"failed"`; U25). No adapter mode keeps a server without restarting it, and every mode restarts a stopped server at its next tool call (`lazyConnect`, `init.ts:978`). Licensed by a project decision (D-PG9-01) plus a pi-mcp-adapter capability gap. Alternatives for the maintainer: keep it; `eager`, which starts at Pi start as Claude Code does and has no background restart but still restarts on use; or file an upstream request for a no-restart keep-alive mode.

**09-CONTEXT.md, "Pending maintainer review" list, append:**

> - D-PG9-14 (caFile kept only at the same https origin, with a notice).
> - D-PG9-15 (a user `idleTimeout` replaces the lifecycle default).
> - D-PG9-16 (the background restart of a crashed stdio server, recorded as a divergence).
> - IN-01 fix choice: a malformed `defaultFields` member is filtered out, not refused with `{unreadable}`.

**PROJECT.md Key Decisions, append three rows after D-PG9-08 (same column shape):**

> | **D-PG9-14 (parity-gaps, Phase 9, proposed in the code-review fix of 2026-11-14, pending maintainer review; amends D-PG9-05): a user `caFile` stays only at the same https origin**: A restage writes a carried `caFile` only while the entry stays an https server at the origin of the entry it replaces, and otherwise leaves it out with the `ca-file-removed` notice; a kept override stub's `caFile` comes back on write-back. Premise: pi-mcp-adapter 7.0.1 refuses a `caFile` beside `command`, `socket` or a non-https url and binds it to the url (`http-ca.ts`, `config.ts`, read in source). Measured: `features/mcp-server/lifecycle.feature`. | See `phases/09-adapter-entries-and-mcp-features/09-REVIEW-FIX.md`. | Pending maintainer review |
> | **D-PG9-15 (parity-gaps, Phase 9, proposed in the code-review fix of 2026-11-14, pending maintainer review; amends D-PG9-01): a user `idleTimeout` replaces the lifecycle default**: No `lifecycle` default is written beside a carried `idleTimeout`. Premise: pi-mcp-adapter 7.0.1 never stops a started `lazy-keep-alive` server for idle time (`lifecycle.ts`, read in source), so the default voided the user's value and the global `settings.idleTimeout`. Measured: `features/mcp-server/lifecycle.feature`. | See `phases/09-adapter-entries-and-mcp-features/09-REVIEW-FIX.md`. | Pending maintainer review |
> | **D-PG9-16 (parity-gaps, Phase 9, proposed in the code-review fix of 2026-11-14, pending maintainer review): record the stdio background restart**: Under the D-PG9-01 default, pi-mcp-adapter 7.0.1 restarts a crashed stdio plugin server in the background (30 s checks, backoff to 5 min); Claude Code 2.1.323 marks it failed until `/mcp` reconnects it (binary grep). No adapter mode keeps a server without restarting it. Read in source, unmeasured. | See `phases/09-adapter-entries-and-mcp-features/09-REVIEW-FIX.md`. | Pending maintainer review |

**PROJECT.md D-PG9-01 row, append to the first cell:** "Amended by D-PG9-15; its background restart is recorded by D-PG9-16."

**09-SECURITY.md (optional, for the next audit):** T-09-15 and AR-09-05 can cite D-PG9-14. A `caFile` no longer survives a change of origin or transport, so the "carried `caFile` across a url change" residual now covers only same-origin path changes. Advisory 1 is resolved by 0ed26d1c, Advisory 2 by 80ee569c, and Advisory 4 by 80ee569c.

______________________________________________________________________

_Fixed: 2026-11-14T22:54:42Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
