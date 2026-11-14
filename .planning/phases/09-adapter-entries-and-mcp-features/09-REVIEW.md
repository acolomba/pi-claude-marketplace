---
phase: 09-adapter-entries-and-mcp-features
iteration: 2
reviewed: 2026-11-14T23:02:17Z
depth: deep
files_reviewed: 29
files_reviewed_list:
  - CHANGELOG.md
  - docs/json-output.md
  - docs/mcp-compatibility.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-mcp.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - features/lib/hook-mcp-tool-server.ts
  - features/lib/mcp-server-files.ts
  - features/mcp-server/lifecycle.feature
  - schema/claude-plugin.schema.json
  - test/architecture/mcp-config-notices.test.ts
  - test/bridges/mcp/adapter-entry.test.ts
  - test/bridges/mcp/marker.test.ts
  - test/bridges/mcp/stage.test.ts
  - test/domain/mcp-server-features.test.ts
  - test/orchestrators/marketplace/shared.test.ts
  - test/shared/notification-json.test.ts
  - test/shared/notification-mcp.test.ts
  - test/shared/notification-resolve.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
  necessity: 0
status: issues_found
---

# Phase 9: Code Review Report (iteration 2)

**Reviewed:** 2026-11-14T23:02:17Z
**Depth:** deep
**Files Reviewed:** 29
**Status:** issues_found

## Summary

Scope: the fix commits `73ccf9d7..deed945b` in the `features/gaps-mcp` worktree, excluding `.planning/`. I read the iteration-1 review and `09-REVIEW-FIX.md`, checked each fix, and traced the new `caFile` rule through its callers: `stage.ts` (`previous` = choice store, then owned entries, then overlays), `adapter-doc.ts` (`leavingChoice`, `writtenBackOverride`, `storedChoicesFor`), and `unstage.ts`. I compared the rule against pi-mcp-adapter 7.0.1 (`http-ca.ts`, `utils.ts` `resolveServerUrl`, `lifecycle.ts`, `init.ts`) under `node_modules/.cache/optional-peers/`. Claude Code has no `caFile` field, so upstream parity does not decide the `caFile` questions. The evidence is a direct probe of `stampServers` and `restoredOverride` (scratch script, pure functions, hermetic `HOME`), plus the targeted owner tests. These all pass: `wire-schema`, `mcp-config-notices`, `adapter-entry`, `marker`, `stage`, `notification-{mcp,resolve,json}`, `marketplace/shared`, and `mcp-server-features`.

Verified as fixed, with no new defect:

- **WR-01 / D-PG9-15.** A carried `idleTimeout` suppresses the `lifecycle` default, and a previously recorded `lifecycle` default leaves the entry and the marker. Probe: the previous `defaultFields: {requestTimeoutMs, lifecycle}` plus a user `idleTimeout: 5` gives an entry with no `lifecycle` and `defaultFields: {requestTimeoutMs}`. This matches `checkConnections` (`lifecycle.ts:146`) and the per-entry idle read (`init.ts:1031`).
- **The `ca-file-removed` wire path.** The new notice is present end to end: the TypeBox member (`notification-wire.ts:767`), both generated schema copies (standalone and migration, `schema/claude-plugin.schema.json:2473`, `:2709`), the JSON projection, the summary table, the section order, the migration warning predicate, the redaction of plugin and server, and the unstage fold (keyed names match `generatedMcpServerKey`). The notice carries no path, so no redaction gap exists. `json-output.md` and the output catalog list the kind in order.
- **IN-04.** Both inner tables and the outer table are frozen. The only callers (`adapter-entry.ts:424`, and `defaultRequestTimeoutMs` in `mcp-builtin-translation.ts:85`) read the table and copy it through `Object.fromEntries`. Nothing mutates it.
- **WR-02, WR-03, WR-04, IN-02, IN-03, IN-05 (both named lines), and IN-06** are fixed as described.

New and remaining defects. All but one are in the D-PG9-14 `caFile` rule. Its origin test is a text regex, not the adapter's URL origin, and it is applied only to one of the three places a carried `caFile` can come from:

- A url whose scheme sits in a variable loses the user's `caFile` on every restage, which is a regression (CR2-01).
- The D-08-02 choice store carries a `caFile` to any https origin with no notice (CR2-02).
- The text comparison disagrees with the adapter's `URL.origin` (WR2-01).
- The uninstall write-back undoes a deletion the user made (WR2-02).

The IN-01 fix conflicts with the project's fail-closed rule (WR2-03).

## Critical Issues

### CR2-01: A `caFile` on a server whose url starts with a variable is removed at every update and reinstall, with a false notice

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:263-292`
**Issue:** `httpsOriginOf` decides that an entry is https only when the written url text matches `/^https:\/\/[^/?#]*/i`. The adapter encoding keeps the plugin's references in the url (AVAR-01..03). The probe stages `{type: "http", url: "${BASE}/mcp"}` with `BASE=https://a.example` set, and the written url is `"${BASE}/mcp"` verbatim. So for a plugin url such as `${API_BASE_URL}/mcp`, `httpsOriginOf(translated)` is `undefined`, and `caFileApplies` returns false even when the previous entry has the identical url. pi-mcp-adapter 7.0.1 does accept that entry: `validateCaFile` checks `new URL(resolveServerUrl(definition)).protocol`, which reads the url after environment interpolation (`http-ca.ts:14-15`, `utils.ts:280-293`). Probe result for previous = new = `${BASE}/mcp`:

```
{"url":"${BASE}/mcp",...,"requestTimeoutMs":300000,...} removed= [ 's' ]
```

So the fix creates a regression. Before 0ed26d1c, a user's `caFile` on such an entry worked and survived restages. Now every update, reinstall, enable, and `apply` convergence removes it. Each time, the user sees a `ca-file-removed` notice saying that the server "is now a stdio server, a plain http server, or an https server at another origin", which is false, because nothing changed. The notice advises "Set it on the entry again", but the next restage removes the value again. The fixer's claim that "a `${VAR}` host still compares" holds only for a reference after a literal `https://`.
**Fix:** Decide only what can be decided. Treat the transport check as failed only on positive evidence: `command` or `socket` is present, or the url has a literal scheme that is not `https`. When the url text starts with a reference (`${`, `$env:`, `{env:`), the scheme cannot be known at stage time. Keep the `caFile` when the url text is unchanged from the previous entry (or compare the unresolved prefix up to the first literal `/`), and leave the final check to `validateCaFile` at connect time. Add a unit case (`${BASE}/mcp` → `${BASE}/mcp` keeps `caFile`, `caFileRemoved: []`) and a `lifecycle.feature` scenario that sets the variable in the world env.

```ts
const REFERENCE_LED = /^(\$\{\w+(:-[^}]*)?\}|\$env:\w+|\{env:\w+\})/;

function urlOrigin(url: string): string | undefined {
  if (REFERENCE_LED.test(url)) return url.split("/", 1)[0]; // unresolved, compare as text
  try { const u = new URL(url); return u.protocol === "https:" ? u.origin : undefined; }
  catch { return HTTPS_ORIGIN.exec(url)?.[0]; } // `https://${HOST}` keeps the text rule
}
```

### CR2-02: The D-08-02 choice store carries a `caFile` to any https origin with no notice, so the origin binding does not hold across uninstall/install or disable/enable

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:274-292`; `extensions/pi-claude-marketplace/bridges/mcp/stage.ts:551-562`; `extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts:510-520`
**Issue:** `caFileApplies` exempts a previous entry that `definesServer` reports as defining no server, so that a user stub's `caFile` applies to whatever https origin the plugin has. But a stub is not the only previous entry that holds no url. When a plugin's entry leaves the file (uninstall, disable, or an update that drops the server), `withPluginServersKeepingChoices` stores `leavingChoice(entry)`. That value is the user's carried fields only, `caFile` included, with no `url` (`adapter-doc.ts:510-520`, `unstage.ts:163`). At the next stage, `storedChoicesFor` puts those fields into `previous` (`stage.ts:551`, `:562`). `definesServer` is false for them, so the `caFile` goes onto the new entry whatever its origin, and `caFileRemoved` stays empty. Probe: previous `{caFile: "/ca.pem"}` (the shape of a stored choice) and new url `https://evil.example/mcp` give `"caFile":"/ca.pem"`, `removed= []`.

Concrete path: the user installs a plugin whose server is at `https://a.example` and sets `caFile`. The user uninstalls, so the store keeps `{caFile}`. The marketplace moves the server to `https://b.example`, and the user installs again. The new entry trusts only the user's bundle at `b.example`, so pi-mcp-adapter refuses the TLS handshake unless the bundle signs `b.example`. No notice is shown. This is the CR-01 failure that D-PG9-14 was written to prevent, through the D-08-02 path. The new write-back (WR2-02) opens a second route. A stub's `caFile` that a stdio update removed comes back on the stub at uninstall. A later install whose server is https at another origin then absorbs the stub and carries the `caFile` with no check. D-PG9-14 says "when the entry it replaces defines a server", so its text permits both routes. That wording is the gap.
**Fix:** Bind a stored `caFile` to its origin. In `leavingChoice`, also store the leaving entry's origin when `caFile` is stored (for example a `caFileOrigin` member, or the url). In `appliedCarriedFields`, treat a stored choice as defining that origin, so a change of origin leaves out the `caFile` and emits `ca-file-removed`. For a stub written back after a D-PG9-14 drop, either keep the drop in the marker (see WR2-02) or keep the stub exemption and record the residual in D-PG9-14 for the maintainer. Add a stage-level unit case (store `{caFile}` recorded at origin A, restage at origin B → removed and reported) and a scenario: install, set `caFile`, uninstall, origin change, install.

## Warnings

### WR2-01: The origin comparison is text, not the adapter's `URL.origin`, so same-origin urls lose the `caFile` and different variable names compare equal

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:261-272`; `docs/output-catalog.md` (the "MCP server caFile removed" block)
**Issue:** pi-mcp-adapter scopes the bundle with `new URL(resolveServerUrl(definition)).origin` (`http-ca.ts:24`, `:42`). The extension compares the lowercased text of `https://<authority>`. Probe results, previous → new:

- `https://a.example/mcp` → `https://a.example:443/mcp`: removed (same `URL.origin`).
- `https://a.example/mcp` → `https://u@a.example/mcp`: removed. Userinfo is part of the regex match but not of the origin.
- `https://bücher.example` → `https://xn--bcher-kva.example`: removed (same origin after IDNA).
- `https://a.example/mcp` → ` https://a.example/mcp` (leading space, which `URL` strips): removed.
- `https://${HOST}/mcp` → `https://${host}/mcp`: kept. Environment variable names are case-sensitive on Linux, so these can be different hosts, and lowercasing makes them equal.
- `http://a.example` → `https://a.example` (scheme upgrade, same host): removed. This is defensible, because the adapter refused that `caFile` beside http. But the notice then says the server is "at another origin".

Each false removal deletes a user value and shows a notice. The first three are false positives against the adapter's own rule. The catalog also says that the origin is "the scheme and the host with its port". The code also compares userinfo, and it does not normalize the port.
**Fix:** For a url with no reference, compare `new URL(url).origin` (in a `try`, and treat a parse failure as no https). Use the text rule only for a reference in the host, and lowercase only the scheme and the literal parts, not `${…}` names. Add unit cases for `:443`, userinfo, and the punycode/Unicode pair, and correct the catalog sentence.

### WR2-02: `restoredOverride` brings back a `caFile` the user deleted from the live entry

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:355-378`; `test/bridges/mcp/adapter-entry.test.ts:1916-1935`
**Issue:** The rule for every other carried field is that the live value wins, and a field missing from the live entry is left out (the doc comment at lines 349-354). The new `else if (field === "caFile")` branch gives `caFile` the kept value whenever the live entry lacks it. The stated reason is that "no pi-mcp-adapter writer removes it", but a user can delete it by hand. The code cannot tell a D-PG9-14 removal from a user's deletion, because the marker records neither. The pinned unit case shows the problem. Its live entry is `https://acme.example/mcp` with no `caFile`, a shape that D-PG9-14 cannot produce from a kept stub (a stub is exempt from the origin test, and the live entry is https). The only way to reach that shape is a user deletion, and the test asserts that the `caFile` comes back. The change has a second effect: a kept `{caFile}` stub whose live entry lacks `caFile` was "emptied" before (`writtenBackOverride`, `adapter-doc.ts:317-327`), so the entry left with no write-back. Now the stub is written back and reported as `override-restored`. The stub's `caFile` then feeds the unchecked stub route in CR2-02.
**Fix:** Record the removal. When `appliedCarriedFields` removes a `caFile` that came from a kept override, add a marker member (for example `withheldFields: ["caFile"]`). In `restoredOverride`, restore the kept `caFile` only when the live marker lists it. Otherwise the live value wins as for every other field. Change the 1916 case to expect no `caFile`, and keep the 1937 stdio case with the marker member.

### WR2-03: The IN-01 fix skips corrupt marker data and carries on, against the project's fail-closed rule, and still reclassifies the malformed field

**File:** `extensions/pi-claude-marketplace/bridges/mcp/marker.ts:68-89, 120-122`; `features/mcp-server/lifecycle.feature` (the "one malformed member" scenario)
**Issue:** The rule applies here. The `_piClaudeMarketplace` marker is this extension's own state, stored inside a file the user can edit. `buildMarker` writes only scalar `defaultFields` members, and pi-mcp-adapter never reads or writes inside the marker (`marker.ts:41-43`). So a non-scalar member can come only from a hand edit or from corruption. It is corrupt data, and the project rule is to refuse the whole command with `{unreadable}`, never to skip it and carry on. The fix filters the bad member instead (`defaultRecordOf`), and that does not stop the reclassification the fix was meant to stop: the malformed member's own field still becomes the user's value, permanently. Probe: `defaultFields: {requestTimeoutMs: 1800000, lifecycle: ["lazy-keep-alive"]}` with `lifecycle: "lazy-keep-alive"` on the entry gives the `lifecycle` carried as the user's value and `defaultFields: {requestTimeoutMs: 1800000}`, so the default is never recomputed. The new scenario uses `"openUi": null`, which names no default the table writes, so it does not exercise this case. The fix report records "filter, not fail closed" as a choice still pending review.
**Fix:** Fail closed. When `defaultFields` is present and is not a record of scalars (and, for consistency, when `pluginSetFields` or `keptOverride` is present but malformed), treat the scope's `mcp-adapter.json` as unreadable for the stage. Return it through the existing `McpConfigFileError` → `left-unchanged` path (`stage.ts:474-484`), or through a dedicated reason that names the server, so the command refuses and the file keeps its bytes. Change the scenario to a malformed `lifecycle` member and expect the refusal. If the maintainer keeps filtering, add a stage warning naming the server and field, and record the residual in D-PG9-03.

### WR2-04: No behavioral scenario covers the user-visible write-back of a `caFile` at uninstall or disable

**File:** `features/mcp-server/lifecycle.feature`; `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:376-377`
**Issue:** AGENTS.md ("Behavioral tests") requires a cucumber scenario that fails without the change for each user-visible `/claude:plugin` behavior. The `restoredOverride` change alters what uninstall and disable write. The stub comes back with its `caFile`, and the command now reports an `override-restored` notice where before it removed the stub silently. Only unit cases cover it (`adapter-entry.test.ts:1916`, `:1937`). The single caFile scenario covers only the update-to-stdio notice.
**Fix:** Add a scenario: a user stub `{caFile}`, install, an update to stdio (notice), then uninstall. Assert the written-back stub and the `override-restored` row. It should fail with the `caFile` branch removed. Write it after WR2-02 is settled, so that it pins the intended rule.

## Info

### IN2-01: The `ca-file-removed` line gives three possible causes and says "is now" even when nothing changed

**File:** `extensions/pi-claude-marketplace/shared/notification-mcp.ts:105-107`
**Issue:** The line says that the server "is now a stdio server, a plain http server, or an https server at another origin". The stage knows which of the three applies, but the notice carries no discriminator, so the user must work it out. The line also fires when nothing changed: a `caFile` hand-added on a stdio entry, an http entry, or the CR2-01 reference-led url. In those cases "is now" is wrong. The other notices in this family give the specific fact (the field names, the variable names).
**Fix:** Add a closed `reason` member (`stdio` | `not-https` | `other-origin`) to `McpCaFileRemovedNotice`, the wire schema, and the generated schema. Render one clause per reason, and drop "now" for a server that did not change.

### IN2-02: A carried `idleTimeout` that is not a number also suppresses the lifecycle default

**File:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:402-407`
**Issue:** `userHolds` counts any own `idleTimeout`, including `null` or `"5"`. pi-mcp-adapter reads a per-entry idle time only when it is a number (`init.ts:1031`), and `??` lets `null` fall through (`init.ts:351`). So with such a value the server becomes `lazy` under the global idle time (10 minutes by default), which neither the user nor D-PG9-15 chose.
**Fix:** Count `idleTimeout` as the user's lifetime choice only when `typeof carried.idleTimeout === "number"`, or record the edge in D-PG9-15.

### IN2-03: New comment lines past 100 columns and a broken sentence wrap

**File:** `extensions/pi-claude-marketplace/bridges/mcp/types.ts:91` (103 columns); `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:484-487`
**Issue:** The fix put back the IN-05 defect class. `types.ts:91` runs past the block width. The `foldUnstageNotices` comment breaks after "of the scope's", leaving the rest of the sentence on a short orphan line.
**Fix:** Rewrap both blocks to the width of the surrounding comment.

---

_Reviewed: 2026-11-14T23:02:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
