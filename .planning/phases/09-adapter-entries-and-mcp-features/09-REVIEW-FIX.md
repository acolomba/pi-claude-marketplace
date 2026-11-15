---
phase: 09-adapter-entries-and-mcp-features
fixed_at: 2026-11-15T00:08:12Z
review_path: .planning/phases/09-adapter-entries-and-mcp-features/09-REVIEW.md
iteration: 2
findings_in_scope: 9
fixed: 9
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

# Iteration 2

**Fixed at:** 2026-11-15T00:08:12Z
**Source review:** .planning/phases/09-adapter-entries-and-mcp-features/09-REVIEW.md (iteration 2, committed 8e2644da)
**Iteration:** 2

**Summary:**

- Findings in scope: 9 (2 critical, 4 warning, 3 info; fix scope `all`, as the orchestrator asked)
- Fixed: 9
- Skipped: 0

Every fix ran in the `features/gaps-mcp` checkout itself, `/home/acolomba/src/pi-claude-marketplace-gaps-mcp`, with no isolated review-fix worktree, as the orchestrator directed. So the verification below ran in that main checkout and can be reproduced from it. All test runs used the hermetic test homes (`test/platform/isolated-pi-home.ts` and the cucumber world). `npm run check` was not run, as directed. The commit hook ran `npm run check:commit` on each commit and it passed.

The orchestrator's design choices were applied: the adapter's own url reading for the origin, no `caFile` in the D-08-02 choice store, the earlier write-back rule for a kept stub's `caFile`, fail closed on a malformed marker member, a closed `reason` on the notice, and only a finite positive `idleTimeout` standing for the lifecycle. Each one waits for maintainer review with D-PG9-14 and D-PG9-15. The parent-line texts at the end of this section replace the iteration-1 texts for D-PG9-14 and D-PG9-15 and the pending-review list. No shared planning file was edited.

**Verification (main checkout, after the last fix commit):**

- Owner and caller unit tests: `test/bridges/mcp/**`, `test/shared/**`, `test/orchestrators/**`, `test/domain/mcp-*`, and `test/architecture/**` (which holds `mcp-config-notices`, `json-output-docs`, `wire-schema`, and the catalog tests): 10611 tests, 0 failures.
- `npm run test:integration`: passed.
- Direct coverage: 100% lines, branches, and functions for each touched source (`adapter-entry`, `adapter-doc`, `marker`, `stage`, `unstage`, `errors-bridges`, `notification-{mcp,json,wire}`).
- Cucumber `features/mcp-server`: adapter profile 148 scenarios passed, builtin profile 130 scenarios passed. Every new scenario is `@adapter-only`, because it reads `mcp-adapter.json`. `npm run check:features` passed.

## Fixed Issues (iteration 2)

### CR2-01 + WR2-01: The caFile origin test read the url text, not the adapter's `URL.origin`

**Status:** fixed: requires human verification (logic change, D-PG9-14 pending maintainer review)
**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`, `test/bridges/mcp/adapter-entry.test.ts`, `features/mcp-server/lifecycle.feature`, `docs/output-catalog.md`, `docs/mcp-compatibility.md`
**Commit:** fb169a47
**Applied fix:** `resolvedUrl` reads a url as pi-mcp-adapter 7.0.1's `resolveServerUrl` does (`utils.ts:280-298`). It first applies the `getMissingEnvVars` scan: a reference without a default that names an unset variable gives no url. Then it makes the three `interpolateEnvVars` passes over the command's environment, with `PI_CLAUDE_MARKETPLACE_EMPTY` read as the empty string that Pi's process sets, and parses the result with `URL.parse`. The new entry must not be `command` or `socket` and must be a string url. When that url reads, its scheme must be `https:`. For a previous entry that defines a server, the two `URL.origin` values must match. When either url gives none (an unset variable or no parse), the `caFile` stays only while the url text is unchanged. The text regex and the lowercasing are gone. An override stub still defines no server, so only the transport decides. A stub's url that cannot be read yet keeps the `caFile`, and the adapter checks it when it connects ("fail only on positive evidence"). The catalog sentence now names `URL.origin` after variable replacement, and so does `docs/mcp-compatibility.md`.
**Tests:** nine keep cases (default port, userinfo, punycode, leading space, `${ACME_BASE}/v1` to `/v2` with the variable set, a `:-` default, the split token, an unchanged url that names an unset variable, and an unchanged url that does not parse). Five drop cases (`${ACME_HOST}` against `${acme_host}`, a changed url that names an unset variable, a variable value whose text names unset variables, a changed url that does not parse, and a variable that resolves to `http:`). One stub case.
**Red scenario:** `lifecycle.feature` "A caFile the user wrote for a plugin server whose url starts with a variable survives a reinstall (PG-MCP-09, D-PG9-14)". Its url is `${PI_CM_BASE}/mcp`, and the variable is set through the launch environment of the profile Pi.
**Negative control:** with `adapter-entry.ts` at 8e2644da, 9 of the new unit cases failed. The scenario failed too, because the reinstall reported `ca-file-removed` and dropped the `caFile`. The source was restored.

### CR2-02 + WR2-02 + WR2-04: The choice store carried a caFile to any origin, and write-back restored a deleted one

**Status:** fixed: requires human verification (logic change, the orchestrator's simpler choice, D-PG9-14 pending maintainer review)
**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts`, `bridges/mcp/adapter-entry.ts`, `test/bridges/mcp/adapter-doc.test.ts`, `test/bridges/mcp/adapter-entry.test.ts`, `features/mcp-server/lifecycle.feature`, `docs/output-catalog.md`, `docs/mcp-compatibility.md`, `CHANGELOG.md`
**Commit:** 8c2b4ad1
**Applied fix:** `leavingChoice` stores no `caFile`, because the store records no url to bind it to. This is the simpler of the two options: the store holds no origin. So an uninstall then install, or a disable then enable, drops the user's `caFile`. The docs and CHANGELOG say so, and the user sets it again. `restoredOverride` no longer special-cases `caFile`: a kept stub's `caFile` takes the live entry's value and is left out when the live entry lacks it, as for every other carried field. This is the behavior from before iteration 1. With the write-back removed, WR2-04 needs no write-back scenario: the behavior it asked to pin no longer exists, and two unit cases pin the restored rule.
**Residual for the maintainer:** a stub that held only `{caFile}` and whose `caFile` a restage removed (D-PG9-14) is not written back at uninstall. Before phase 9, `caFile` was not a carried field, so such a stub came back verbatim. The reviewer's alternative, a marker member such as `withheldFields`, would keep it, and is the next step if the maintainer wants it.
**Tests:** `adapter-doc.test.ts` "D-PG9-14: a leaving entry stores its user carried fields but not its caFile". The two `restoredOverride` cases now expect the `caFile` to be left out.
**Red scenario:** `lifecycle.feature` "An install after an uninstall does not give a plugin server at another origin the caFile the user wrote (PG-MCP-09, D-08-02, D-PG9-14)". It installs at `https://example.invalid`, sets `caFile`, uninstalls, then installs 1.1.0 at `https://other.example.invalid`.
**Negative control:** without the `field !== "caFile"` test in `leavingChoice`, the scenario failed with the `caFile` on the other origin, and so did the adapter-doc case. With `adapter-entry.ts` at the prior commit (which has the iteration-1 write-back), both `restoredOverride` cases failed.

### WR2-03: A malformed marker member was skipped, not refused

**Status:** fixed: requires human verification (logic change, fail closed as the project rule asks)
**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/marker.ts`, `bridges/mcp/adapter-doc.ts`, `bridges/mcp/stage.ts`, `bridges/mcp/unstage.ts`, `shared/errors-bridges.ts`, `test/bridges/mcp/{marker,adapter-doc,stage,unstage,adapter-entry}.test.ts`, `test/shared/errors-bridges.test.ts`, `features/mcp-server/lifecycle.feature`, `docs/output-catalog.md`, `docs/mcp-compatibility.md`
**Commit:** edcfc369
**Applied fix:** The iteration-1 filter (`defaultRecordOf`) is removed, so the parse again drops a malformed member whole. A new `hasMalformedMarkerMember` names a marker that has its owner but holds a `pluginSetFields`, `defaultFields`, or `keptOverride` member of another shape than `buildMarker` writes. `assertOwnedMarkersReadable` (adapter-doc) throws `McpConfigFileError` with the new defect `marker-not-valid` when an entry of the staging plugin, under either server key, has such a marker. The stage calls it inside `readTargetConfig`, so the existing AFILE-02 path applies. A plugin with servers refuses, its failed row names the file, and the file keeps its bytes. A plugin with no servers gets the `left-unchanged` notice. The unstage calls it too, so an uninstall or disable refuses such a file. Another plugin's malformed marker does not refuse the file. That is a smaller blast radius than refusing the whole file, and it still refuses every read that this extension would act on.
**Tests:** marker predicate cases (five malformed shapes, four that are not), the adapter-doc owner-scoping pair, two stage cases (a refusal that keeps the bytes, and an empty stage that reports left-unchanged), the unstage refusal, and the errors-bridges defect text. The iteration-1 filter cases are reverted, and the adapter-entry case that tested the filter is removed.
**Red scenario:** `lifecycle.feature` "An update refuses a plugin server whose recorded default list holds a malformed member and leaves the file unchanged (PG-MCP-06, D-PG9-03)". It replaces the `openUi: null` scenario and uses `"lifecycle":["lazy-keep-alive"]`, a default this extension writes.
**Negative control:** without the `assertOwnedMarkersReadable` call in the stage, the scenario failed (the update succeeded), and so did the two stage cases.
**Pre-existing, not changed:** the update's failed row reads `unreadable manifest` for every `McpConfigFileError`, the JSONC defects included (`update-flow.ts` falls back to that reason for an error with no errno). A typed reason for an MCP config refusal would be a separate change.

### IN2-01: The caFile line listed three causes

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/{adapter-entry,stage}.ts`, `shared/notification-{types,mcp,wire,json}.ts`, `schema/claude-plugin.schema.json` (regenerated), `docs/{json-output,output-catalog}.md`, seven test files, `features/mcp-server/lifecycle.feature`
**Commit:** fac55643
**Applied fix:** `McpCaFileRemovedNotice` carries `reason: McpCaFileRemovedReason`, one of `not-https`, `origin-changed`, or `url-unresolved`. `caFileRemovalReason` returns it in place of a boolean, and `stampServers` returns `{ server, reason }` rows. The line renders one clause per reason, with no "is now" for `not-https`. The TypeBox member, both generated schema copies, the JSON projection, the json-output field table, and the enum list all carry the reason. The catalog has one block per reason (`mcp-ca-file-removed`, `-origin-changed`, `-url-unresolved`), and the architecture lock reads all three. Its titles now name the catalog state, so the three rows of one kind stay distinct.
**Tests / scenario:** one notification-mcp case per reason. The fold, resolve, json, and stage cases carry the reason. The stdio scenario's result row now holds `"reason":"not-https"`.
**Negative control:** without `reason` in the JSON projection, 4 unit cases and the stdio scenario failed.

### IN2-02: A non-number idleTimeout suppressed the lifecycle default

**Status:** fixed: requires human verification (small logic change, D-PG9-15)
**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts`, `test/bridges/mcp/adapter-entry.test.ts`, `features/mcp-server/lifecycle.feature`, `docs/mcp-compatibility.md`, `CHANGELOG.md`
**Commit:** a4fbb81c
**Applied fix:** `userHolds` counts `idleTimeout` as the user's lifecycle only when it is a finite number above 0. The adapter reads a per-entry idle time only when it is a number (`init.ts:1031`), and it never stops a server for idle time when the number is not positive (`lifecycle.ts:146`), so `0`, a negative number, a string, or `null` chooses no lifetime, and the `lazy-keep-alive` default stays. (For `0` and negative numbers, the entry was already never stopped for idle time; the default now also gives it the keep-alive behavior. A string or `null` fell back to the global idle time.)
**Tests:** four unit cases (zero, a negative number, a numeric string, `null`).
**Red scenario:** `lifecycle.feature` "An idleTimeout of zero the user wrote for a stdio plugin server leaves the lifecycle default in place (PG-MCP-06, D-PG9-15)".
**Negative control:** with `adapter-entry.ts` at the prior commit, the 4 cases and the scenario failed.

### IN2-03: Comment lines past 100 columns and a broken wrap

**Status:** fixed
**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/types.ts`, `orchestrators/marketplace/shared.ts`
**Commit:** f09c1ae2
**Applied fix:** Both named blocks are rewrapped to the surrounding width. Three other comment lines over 100 columns remain in files this iteration touched (`adapter-doc.ts:405`, and the two `eslint-disable-next-line` reasons at `stage.ts:739` and `unstage.ts:167`). They predate this review's scope, so they were left alone.

## Parent-line texts (iteration 2; for the orchestrator; not applied)

These replace the iteration-1 texts of the same items above.

**09-CONTEXT.md, append under "Fields the user wrote (PG-MCP-09)" (replaces the iteration-1 D-PG9-14 bullet):**

> - **D-PG9-14 (proposed during the code-review fix, pending maintainer review; amends D-PG9-05 and D-08-02):** A carried `caFile` is written only while the new entry is an https server and, when the entry it replaces defines a server, at that entry's origin. An https server has no `command` or `socket`, and has a string url that does not read as another scheme. The origin is the `URL.origin` of each url read as pi-mcp-adapter's `resolveServerUrl` reads it, with the command's environment: references without a default must name set variables, and three interpolation passes follow (`utils.ts:146-165`, `:280-298`). When either url names an unset variable or does not parse, the `caFile` stays only while the url text is unchanged. An override stub defines no server, so only the transport decides for it, and a stub's url that cannot be read yet keeps the `caFile` for the adapter to check at connect time. Otherwise the stage leaves `caFile` out and emits the `ca-file-removed` MCP config notice with a closed `reason`: `not-https`, `origin-changed`, or `url-unresolved`. The D-08-02 choice store keeps no `caFile`, because it records no url, so a disable then enable or an uninstall then install drops it. A kept override's `caFile` follows the live entry on write-back like every other carried field, so a stub whose `caFile` a restage removed comes back without it. Premise: pi-mcp-adapter 7.0.1 refuses a `caFile` beside `command` or `socket` or a url that is not https after interpolation (`validateCaFile`, `http-ca.ts:9-18`), scopes the bundle to the url's `URL.origin` (`http-ca.ts:24`, `:42`), and treats `caFile` as url-bound (`URL_BOUND_AUTH_FIELDS`, `config.ts:1070-1081`). D-PG9-05's "None carries a credential" and "can only narrow trust" are withdrawn: at its origin, the entry trusts exactly the bundle. Residual: a stub that held only `{caFile}` is not written back once a restage removed its `caFile`.

**09-CONTEXT.md, append under "Stdio lifecycle (PG-MCP-06, decision 5)" (replaces the iteration-1 D-PG9-15 bullet; D-PG9-16 stays as written in iteration 1):**

> - **D-PG9-15 (proposed during the code-review fix, pending maintainer review; amends D-PG9-01 and D-PG9-03):** A carried user `idleTimeout` that is a finite number above 0 counts as the user's `lifecycle`. No `lifecycle` default is written beside it, and a recorded one goes at the next restage, so the entry stays `lazy` and the user's `idleTimeout` applies. Any other `idleTimeout` (0, negative, a string, `null`) chooses no idle stop in the adapter, and the default stays. Premise: pi-mcp-adapter 7.0.1 never stops a started `lazy-keep-alive` server for idle time, whatever the entry or global `idleTimeout` says (`lifecycle.ts:146`, `init.ts:1032-1034`, `docs/configuration.md:135`). It reads a per-entry idle time only when it is a number (`init.ts:1031`), and it stops a server for idle time only when that time is positive (`lifecycle.ts:146`).

**09-CONTEXT.md, D-PG9-03, append:**

> A marker member of another shape than this extension writes (`pluginSetFields`, `defaultFields`, or `keptOverride`) on an entry of the plugin makes a stage or unstage refuse the scope's `mcp-adapter.json` with `McpConfigFileError` (`marker-not-valid`). The file keeps its bytes, and a stage with no servers reports it left unchanged (AFILE-02). The marker is this extension's own record, so only a hand edit or corruption leaves such a member, and the project refuses corrupt data rather than read past it.

**09-CONTEXT.md, "Pending maintainer review" list (replaces the iteration-1 additions):**

> - D-PG9-14 (caFile kept only at the same `URL.origin` after the adapter's variable reading, with a notice that carries its reason; no caFile in the choice store; the stub write-back residual).
> - D-PG9-15 (a finite positive user `idleTimeout` replaces the lifecycle default).
> - D-PG9-16 (the background restart of a crashed stdio server, recorded as a divergence).
> - D-PG9-03 addition: a malformed marker member of the plugin's entry refuses the file (fail closed). This replaces the iteration-1 filter choice.

**PROJECT.md Key Decisions, D-PG9-14 row (replaces the iteration-1 row text):**

> | **D-PG9-14 (parity-gaps, Phase 9, proposed in the code-review fix of 2026-11-14, revised 2026-11-15, pending maintainer review; amends D-PG9-05 and D-08-02): a user `caFile` stays only at the same https origin**: A restage writes a carried `caFile` only while the entry stays an https server at the `URL.origin` of the entry it replaces, with each url read as pi-mcp-adapter reads it. An unreadable url keeps it only while the url text is unchanged. Otherwise the restage leaves it out with the `ca-file-removed` notice and its reason. The choice store keeps no `caFile` across an uninstall or a disable. Premise: pi-mcp-adapter 7.0.1 refuses a `caFile` beside `command`, `socket` or a non-https url and binds it to the url's origin (`http-ca.ts`, `utils.ts`, `config.ts`, read in source). Measured: `features/mcp-server/lifecycle.feature`. | See `phases/09-adapter-entries-and-mcp-features/09-REVIEW-FIX.md`. | Pending maintainer review |

**PROJECT.md Key Decisions, D-PG9-15 row (replaces the iteration-1 row text):**

> | **D-PG9-15 (parity-gaps, Phase 9, proposed in the code-review fix of 2026-11-14, revised 2026-11-15, pending maintainer review; amends D-PG9-01): a positive user `idleTimeout` replaces the lifecycle default**: No `lifecycle` default is written beside a carried `idleTimeout` that is a finite number above 0. Premise: pi-mcp-adapter 7.0.1 never stops a started `lazy-keep-alive` server for idle time, and it reads a per-entry idle time only when it is a positive number (`lifecycle.ts`, `init.ts`, read in source). Measured: `features/mcp-server/lifecycle.feature`. | See `phases/09-adapter-entries-and-mcp-features/09-REVIEW-FIX.md`. | Pending maintainer review |

______________________________________________________________________

_Fixed: 2026-11-15T00:08:12Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
