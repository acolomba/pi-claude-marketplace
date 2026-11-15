# Phase 9: Adapter Entries and MCP Features - Research

**Researched:** 2026-11-14
**Domain:** pi-mcp-adapter 7.0.1 entry defaults (`lifecycle`, `openUi`), the carried-field set, the MC-5 marker, the cucumber MCP harness, and the MCP compatibility page
**Confidence:** HIGH (code paths read this session; the two runtime effects that matter most were measured with a scratch probe under the real harness)

## Summary

The product change is small and lives in two modules. `bridges/mcp/adapter-entry.ts` gains four carried fields and two new defaults beside the D-PG1-11 timeout default. `bridges/mcp/marker.ts` widens `defaultFields` from numbers to JSON scalars. The defaults must go into `defaultFieldsFor` (after carried fields, before the marker), not into the closed table `translateMcpServer`. If the table wrote them, `pluginSetFieldsIn(translated)` would mark `lifecycle` and `openUi` as plugin-set, and the user could no longer override them. Pi's built-in path is unaffected: `translateBuiltinMcpServer` takes only transport, `oauth`, timeout, exposure, and description from the table.

The blast radius sits in the test harness, not the product. Two effects were **measured this session** with a scratch probe under the real cucumber harness and pi-mcp-adapter 7.0.1. (1) With `lifecycle: "lazy-keep-alive"`, the startup listing connection stays open: the stub's pid file is still there 4 s after `tools/list`, and the first tool call reuses the connection. The stub logs 4 messages instead of 7. (2) With `openUi: false`, the `initialize` capabilities lose `"extensions":{"io.modelcontextprotocol/ui":...}` but keep `"sampling":{}`, `"roots":{}`, and `"elicitation":{"form":{}}`. Effect (1) breaks the harness's adapter listing wait. `listingDone` in `features/lib/mcp-implementation.ts`, and its copy in `features/step_definitions/hook/tool-use.steps.ts:321`, wait until "no stub runs". Under the new default that never happens, so about 130 listing steps across 20 feature files would time out. A harness task must change the adapter's listing-done condition **before** the product default lands. Effects (1) and (2) together change the expected stub-message table of every adapter scenario that pins one (12 scenarios), and probably the `cached, connects on first use` status row of `companion-missing.feature`.

The resource scenarios (PG-MCP-08) were also probed with a scratch resource stub, and both pass today. Under the adapter, `mcp({"tool":"mcp__plugin_demo_res__read_notes"})` returns `mcp returned: stub notes`. Under Pi's built-in MCP, `tool_search` then `read_mcp_resource {"server":"plugin_demo_res","uri":"stub://notes"}` returns `read_mcp_resource returned: stub notes`. The adapter sends `resources/list` at connect when a server declares the `resources` capability, and Pi's built-in does not. So the resource must be opt-in on the stub. Turning it on for the default stub would add a `resources/list` row to every adapter message table.

**Primary recommendation:** Wave 0 first changes the harness's adapter listing-done condition and adds an opt-in resource mode to the stub. Then one product task changes `marker.ts` and `adapter-entry.ts` together with their owner tests. Then one expectation task updates every pinned entry, message table, and status row, and adds the D-PG9-11 scenarios and the resource guards. Docs and records come last.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Stdio lifecycle (PG-MCP-06, decision 5)

- **D-PG9-01 (pending maintainer review; decision 5; amends ANAME-05):**
  Write `lifecycle: "lazy-keep-alive"` on the adapter entry of a stdio plugin
  server. Premise: Claude Code connects a stdio plugin server at session start
  and keeps it connected for the session (PRD MCP-06 Upstream;
  `docs/research/parity-gaps/mcp.md` MCP-06, `UP/mcp.md:704`). Under
  pi-mcp-adapter 7.0.1, `lazy` (the default when no `lifecycle` is written,
  `init.ts:349`) stops an idle server after 10 minutes, and a server that
  holds state in memory loses it. `lazy-keep-alive` starts the server on its
  first use and then keeps it for the session (`init.ts:350`, `:683-684`;
  `docs/servers.md:49`). `keep-alive` would match upstream's start time too,
  but it starts every plugin server at every session start; the PRD's
  decision 5 asks for `lazy-keep-alive`, and this run takes it. Checked
  against pi-mcp-adapter 7.0.1 as installed by
  `scripts/install-test-peers.mjs`. A "no" from the maintainer moves
  PG-MCP-06 to Out of Scope and removes one default from the table.
- **D-PG9-02:** "stdio" means what `defaultRequestTimeoutMs` already reads
  (`domain/mcp-server-features.ts:72-86`): `type` absent or `"stdio"`. A
  remote server (`sse`, `http`, `streamable-http`) gets no `lifecycle`, so it
  stays `lazy`, which matches upstream's `cached` state for a remote server
  used before. pi-mcp-adapter 7.0.1 has no global lifecycle setting (`config.ts:2093` is
  a per-entry default of `lazy`), so a per-entry value overrides nothing the
  user set elsewhere.
- **D-PG9-03:** Precedence and recompute follow D-PG1-11 and D-PG1-13. A
  `lifecycle` the user wrote on the entry is a carried field (it is already
  in `CARRIED_FIELDS`) and wins. The plugin cannot set `lifecycle` (no Claude
  field maps to it). The marker's `defaultFields` records the written default,
  so a later restage recomputes it: a server that changes from stdio to remote
  loses it. A user value equal to the recorded default reads as the default,
  as for the timeout (accepted residual of D-PG1-13). The marker's
  `defaultFields` widens from numbers to JSON scalars (number, string,
  boolean); a marker an earlier release wrote, which holds only numbers, still
  reads.
- **D-PG9-04 (existing installs):** An installed plugin's entry gets the new
  defaults at its next restage: `update`, `reinstall`, a disable then enable,
  and an `apply` move, the same path that gave entries the default timeout
  (D-PG1-12). Nothing rewrites `mcp-adapter.json` at load (APL-D1). The
  CHANGELOG entry tells adapter users to run `reinstall` once to get the new
  defaults. The research must confirm which restage paths exist when the
  version does not change (D-PG1-12 measured `reinstall`), and the plan must
  prove the earlier-release case with a reinstall scenario.

#### Fields the user wrote (PG-MCP-09)

- **D-PG9-05:** Add `protocolVersion`, `tasks`, `exposeResources`, and
  `caFile` to `CARRIED_FIELDS` (`bridges/mcp/adapter-entry.ts`). None has a
  Claude field, so the closed table never writes one, and each is the user's.
  None carries a credential: `caFile` is a path to a PEM bundle that replaces
  the default roots for that entry (`types.ts:451-452`). A user's `caFile`
  survives a change of the plugin's `url`; with the new origin it can only
  narrow trust, so a mismatch fails closed (the connection is refused), never
  open. The uninstall restore (`restoredOverride`) and the kept-override path
  follow from the carried set with no other change.
- **D-PG9-06:** Do not write a `protocolVersion` default. Writing `"auto"` is
  an option the report raised (MCP-09 "Optionally"); for stdio each fresh
  `auto` connection adds one process spawn. Deferred (see Deferred Ideas).

#### Powers the adapter gives a plugin server (PG-SEC-03, decision 20)

- **D-PG9-07 (pending maintainer review; decision 20, the UI half):** Write
  `openUi: false` on every plugin server entry, stdio and remote, recorded as
  a default in the marker (D-PG9-03 rules). A user's `openUi` (already
  carried) wins. Premise: Claude Code 2.1.323 declares the client capabilities
  `{roots: {listChanged: true}, elicitation: {}}` and adds the
  `io.modelcontextprotocol/ui` extension only when `CLAUDE_CODE_MCP_APPS_HOST`
  is set, which a host application sets and the CLI does not (binary grep of
  `function wNs(){return{roots:{listChanged:!0},elicitation:{},...MMn()&&{extensions:{[kNs]:{mimeTypes:[SNs]}}}}}`
  and `function MMn(){return i.CLAUDE_CODE_MCP_APPS_HOST===!0}`). Its docs
  call UI resources "pages for a host application to render rather than
  content for Claude to read" (`UP/mcp.md:1734`). pi-mcp-adapter 7.0.1
  declares the extension to every server unless `openUi === false`
  (`server-manager.ts:1513-1516`), and `openUi: false` makes a tool that would
  defer to an MCP App form run and return its result inline
  (`docs/prompts-and-ui.md:60`), which is what a Claude Code CLI session sees.
  The project's rule that "a plugin cannot give itself a pi-mcp-adapter power
  that Claude Code does not give a plugin" (`docs/mcp-compatibility.md:317`)
  applies. Checked against pi-mcp-adapter 7.0.1.
- **D-PG9-08 (pending maintainer review; decision 20, the sampling half;
  records the divergence):** Write nothing for `sampling`. Claude Code 2.1.323
  declares no `sampling` capability (same capability object). pi-mcp-adapter
  7.0.1 has no per-server sampling field: sampling is one global
  `settings.sampling`, on by default when UI approval is available
  (`init.ts:185`, `docs/configuration.md:225-226`), and it governs every
  server, the user's own included. This project does not own the user's
  `settings`, so writing `settings.sampling: false` would remove a power from
  servers it did not install. The divergence is licensed by a pi-mcp-adapter
  capability gap. Mitigation as measured in source: in a UI session each
  sampling request asks the user to confirm, and in a session without UI
  sampling is off unless the user set `samplingAutoApprove`
  (`sampling-handler.ts:171`). Draft the request for a per-server switch as
  `.planning/upstream/pi-mcp-adapter-per-server-sampling.md` and add a
  BACKLOG entry whose trigger is a published adapter release with that
  switch. The compatibility page cites D-PG9-08.

#### Features beyond tools (PG-MCP-08)

- **D-PG9-09:** Add a "Features beyond tools" section to
  `docs/mcp-compatibility.md` with one row per feature (resources, prompts,
  elicitation, sampling, roots, output limits) and one column per
  implementation, plus Claude Code's behavior. Say that `@server:uri` mentions
  do not exist on Pi. Every cell names its evidence: a scenario, a run, or a
  source line. A cell that no scenario or run backs says "unmeasured" and
  names the source it was read from. The prompt command name under the
  adapter comes from spike S3, which ran the adapter's naming code outside a
  session, so that cell says so.
- **D-PG9-10:** One scenario per implementation reads a resource of a plugin
  server: the stub MCP server (`features/lib/mcp-stub-server.ts`) gains one
  static text resource, and a scripted model reads it through the tool each
  implementation offers (the adapter's resource tool; Pi's
  `read_mcp_resource`). These two scenarios are regression guards: no
  behavior changes, so they are expected to pass on today's code. VALIDATION
  records them as guards, not as red-green proofs, as the ROADMAP note for
  this phase says.

#### Behavioral evidence

- **D-PG9-11:** Each visible change ships a scenario that fails without it,
  in the pattern of the request-timeout scenarios in
  `features/mcp-server/lifecycle.feature:394-562`: the written entry of a
  stdio server holds `lifecycle: "lazy-keep-alive"` and `openUi: false`; a
  remote server's entry holds `openUi: false` and no `lifecycle`; a user's
  `lifecycle` and `openUi` survive an update; a server that changes from
  stdio to remote loses the lifecycle default; an entry an earlier release
  wrote gets both defaults at reinstall; a user's `protocolVersion: "auto"`
  survives an update and a reinstall, and so do `tasks`, `exposeResources`,
  and `caFile`. All adapter-only. Owner unit tests cover the marker widening
  and the carried fields. All tests run in a hermetic home and never touch
  the real `~/.pi/agent`.

#### Records

- **D-PG9-12:** Correct `docs/mcp-compatibility.md` where it says this
  extension never writes `lifecycle` (`:143-147`, `:629`), the carried-field
  list (`:356`), and the `openUi` text if any. Append rows D-PG9-01, D-PG9-07,
  and D-PG9-08 to the Key Decisions table of `PROJECT.md`, each with its
  premise and the adapter version (7.0.1), marked pending maintainer review,
  and append "Amended by D-PG9-01" to the ANAME-05 text. Add one CHANGELOG
  bullet. These shared-file edits are append-style and limited to this
  phase's rows.

#### Decided autonomously

Reversible technical choices: D-PG9-02, D-PG9-03, D-PG9-04, D-PG9-05,
D-PG9-06, D-PG9-09, D-PG9-10, D-PG9-11, D-PG9-12. Undo touches the default
table in one module, the carried-field list, or a doc, and the marker lets a
restage drop a default it wrote.

#### Pending maintainer review

- D-PG9-01 (decision 5): `lazy-keep-alive` for stdio servers; amends ANAME-05.
  Alternative: `keep-alive` (starts every server at session start), or keep
  ANAME-05 and move PG-MCP-06 to Out of Scope.
- D-PG9-07 (decision 20, UI): `openUi: false` on every plugin entry.
- D-PG9-08 (decision 20, sampling): record the divergence; no global
  `settings.sampling` write.
- D-PG9-04: existing installs get the defaults only at the next restage; no
  load-time rewrite.

### Claude's Discretion

The marker field's type name and parser shape. Whether the defaults live in
`domain/mcp-server-features.ts` beside `defaultRequestTimeoutMs` or in
`adapter-entry.ts`. The stub resource's URI and text. Scenario wording and
splits across feature files. Plan splits. No exception to plan size,
security, coverage, or verification gates.

### Deferred Ideas (OUT OF SCOPE)

- Writing `protocolVersion: "auto"` for remote servers (MCP-09 option).
- A `{requires pi-mcp-adapter}` hint for a plugin whose server offers
  prompts (the report's open question); the project cannot know it at
  install.
- Withholding sampling once pi-mcp-adapter ships a per-server switch (BACKLOG
  entry from D-PG9-08).
- Claude Code's bare `elicitation: {}` versus the adapter's `{form, url}`;
  `bareElicitationCapability` stays blocked under the adapter.
- `keep-alive` (start at session start) as an alternative to D-PG9-01.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PG-MCP-06 | Under the adapter, a stdio plugin server that has started stays running for the session (`lifecycle: "lazy-keep-alive"`), unless the user set a lifecycle on the entry. Remote servers stay `lazy`. | Default goes in `defaultFieldsFor` keyed on the D-PG9-02 type switch (Pattern 1). Measured: the startup listing connection stays and the call reuses it (Probe A). The harness listing wait must change first (Pitfall 1). |
| PG-MCP-09 | A value the user wrote in `protocolVersion`, `tasks`, `exposeResources`, or `caFile` on a plugin entry survives an update or reinstall. | Add four names to `CARRIED_FIELDS` (adapter-entry.ts:50-64). The closed table writes none of them (Code Examples). The test that treats `caFile` as a credential must change (Pitfall 5). |
| PG-MCP-08 | The page states each implementation's features beyond tools, and that `@server:uri` mentions do not exist on Pi. One resource scenario per implementation. | Measured tool names and argument shapes (Probe B, Probe C). The resource must be opt-in on the stub (Pitfall 3). Evidence table for the docs is under Features Beyond Tools: Evidence. |
| PG-SEC-03 | The entry withholds sampling and the MCP UI extension, or the divergence is recorded. | `openUi: false` default (measured to drop the UI extension, Probe A). Sampling stays declared, measured as `"sampling":{}` (Probe A). D-PG9-08 records the divergence, with an upstream draft and a BACKLOG entry. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Upstream parity is the default. A divergence needs a recorded decision ID or a Pi capability gap. D-PG9-08 is licensed by the pi-mcp-adapter gap (no per-server sampling field).
- All disk mutations are atomic. The MCP stage already writes through `atomicWriteJson` and `writeIfChanged` (stage.ts). No new write path is needed.
- Recovery is `/claude:plugin apply` then `/reload`. Nothing may rewrite `mcp-adapter.json` at load except the AMIG-01 move (APL-D1). D-PG9-04 keeps this.
- Containment (NFR-10): no new write targets.
- Quality bar: `npm run check` green, with 100% direct coverage per source-test pair. Fallow health: cognitive complexity 15, cyclomatic 20, and ESLint `sonarjs/cognitive-complexity` 15 on its own algorithm.
- A user-visible `/claude:plugin` change ships a cucumber scenario that fails without it.
- Every `@adapter-only` or `@builtin-only` scenario names an ID in its title or feature description (`.agents/skills/cucumber/rules/features.md:121`).
- Comments cite durable IDs (D-PG9-xx, PG-MCP-xx), not phase or plan numbers.
- Never commit to main, never `--no-verify`, merge only and no rebase. Prefix `windows append --description` with `[parity-gaps]`.
- Every plan SUMMARY carries `## Threat Flags`.
- Tests use hermetic homes (`test/platform/isolated-pi-home.ts`, and the cucumber world), never the real `~/.pi/agent`.
- Markdown is formatted by mdformat and markdownlint through pre-commit, not Prettier.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Which defaults an adapter entry gets (`lifecycle`, `openUi`, timeout) | bridges/mcp (`adapter-entry.ts` `defaultFieldsFor`) | domain (`mcp-server-features.ts` type switch) | The module header says every change to entry content belongs in adapter-entry.ts or the table. The table must not hold defaults (Pitfall 2). |
| Recording a written default (marker `defaultFields`) | bridges/mcp (`marker.ts`) | -- | MC-5 marker owner. Readers go through `defaultFieldsOf`. |
| Carrying user fields across a restage | bridges/mcp (`adapter-entry.ts` `CARRIED_FIELDS`, `carriedFields`) | bridges/mcp (`adapter-doc.ts` choice store, `restoredOverride`) | One set drives carry-forward, the choice store (D-08-02), the uninstall restore, and the override-kept notice. |
| Restage triggers (update, reinstall, enable, apply, AMIG-01) | orchestrators (`install-outcome.ts`, `update-swap.ts`, `reconcile/mcp-migration.ts`) | -- | No orchestrator change is needed. They call `prepareStageMcpServers`. |
| Built-in registrations | orchestrators/mcp + bridges/mcp `builtin-*` | -- | Built from records each session. Untouched. |
| Behavioral proof | features/ (harness `features/lib/mcp-implementation.ts`, stub, lifecycle/configuration/invocation feature files) | -- | The harness listing wait is a foundation file (cucumber layout rules). |
| Docs and records | `docs/mcp-compatibility.md`, `docs/output-catalog.md`, `.planning/PROJECT.md`, `CHANGELOG.md`, `.planning/upstream/`, `.planning/BACKLOG.md` | -- | Append-style edits limited to this phase's rows. |

## Standard Stack

No new packages. Everything runs on the installed stack.

| Component | Version | Purpose | Evidence |
|-----------|---------|---------|----------|
| pi-mcp-adapter | 7.0.1 (test peer) | Reads `lifecycle`, `openUi`, `protocolVersion`, `tasks`, `exposeResources`, `caFile` | [VERIFIED: node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/package.json `"version": "7.0.1"`] |
| @earendil-works/pi-coding-agent | 1.5.0 (dev) | Built-in MCP and resource tools | [VERIFIED: node_modules/@earendil-works/pi-coding-agent/package.json `"version": "1.5.0"`] |
| @cucumber/cucumber | 13.3.0 | Behavioral suite | [VERIFIED: node_modules/@cucumber/cucumber/package.json] |
| Claude Code | 2.1.323 binary | Upstream client capabilities | [VERIFIED: binary grep, below] |

## Package Legitimacy Audit

Not applicable. This phase installs no external package. No `npm install`, and the `package.json` and lockfile do not change.

## Architecture Patterns

### Data flow of one restage (unchanged shape, new members marked)

```
plugin .mcp.json / manifest
   │
   ▼
translateMcpServer (closed table, domain)      ── never writes lifecycle/openUi/protocolVersion/tasks/exposeResources/caFile
   │  translated
   ▼
substituteAndInject + withOAuthDecision (bridges/mcp/substitute.ts)
   │
   ▼
pluginSetFieldsIn(translated)                   ── carried fields the plugin set (only requestTimeoutMs can be)
   │
   ├── previous entry / absorbed stub / stored choice (adapter-doc.ts partition + storedChoicesFor)
   ▼
carriedFields(previous, pluginSet)              ── CARRIED_FIELDS (+4 NEW), skips values equal to previous marker's recorded default
   │
   ▼
defaultFieldsFor(entry, translated, carried)    ── requestTimeoutMs (+ NEW lifecycle for stdio, + NEW openUi:false for stdio+remote)
   │
   ▼
{...translated, ...carried, ...defaultFields, _piClaudeMarketplace: buildMarker({pluginSetFields, defaultFields, keptOverride})}
   │
   ▼
withPluginServersKeepingChoices → writeIfChanged(mcp-adapter.json)   (byte-equal → no write)
```

### Pattern 1: one default table keyed by the server type (recommended)

**What:** Keep the stdio/remote switch in one place. Add a domain function beside `defaultRequestTimeoutMs`, or widen it, that returns the ordered defaults for a server type. `defaultFieldsFor` then drops each field the plugin (`translated`) or the user (`carried`) already holds.

**Recommended key order** (entry and marker alike): `requestTimeoutMs`, `lifecycle`, `openUi`. Existing byte pins then only gain lines after `requestTimeoutMs`.

```typescript
// Shape only. Field names and values from adapter types.ts:475/497 and CONTEXT D-PG9-01/07.
type AdapterDefault = number | string | boolean;

function defaultFieldsFor(
  entry: unknown,
  translated: Readonly<Record<string, unknown>>,
  carried: Readonly<Record<string, unknown>>,
): Readonly<Record<string, AdapterDefault>> {
  if (!isPlainObject(entry)) {
    return {};
  }

  const defaults: Record<string, AdapterDefault> = {};
  for (const [field, value] of Object.entries(adapterEntryDefaults(entry))) {
    if (!Object.hasOwn(translated, field) && !Object.hasOwn(carried, field)) {
      defaults[field] = value;
    }
  }

  return defaults;
}
// adapterEntryDefaults: stdio (type absent | "stdio") → { requestTimeoutMs: 1_800_000, lifecycle: "lazy-keep-alive", openUi: false }
//                       remote (sse | http | streamable-http) → { requestTimeoutMs: 300_000, openUi: false }
//                       other → {}
```

A loop over `Object.entries` keeps the function flat, which matters for the two complexity gates. A plain object literal per arm avoids building a `Map`. `defaults[field] = value` takes field names from a fixed table, never from input, so it needs no `safeSet`.

### Pattern 2: widen the marker parser to JSON scalars

```typescript
// marker.ts — replaces isNumberRecord (marker.ts:52-54)
function isScalar(value: unknown): value is number | string | boolean {
  return typeof value === "number" || typeof value === "string" || typeof value === "boolean";
}

function isScalarRecord(value: unknown): value is Readonly<Record<string, number | string | boolean>> {
  return isPlainObject(value) && Object.values(value).every(isScalar);
}
```

Keep the all-or-nothing rule of today. A malformed member drops the whole `defaultFields`, and each value then reads as the user's. This fails toward keeping the file's values, never toward overwriting them. `isRecordedDefault` (adapter-entry.ts:214-221) compares with `===`, so `"1800000"` never matches `1800000`. The type of its `defaults` parameter widens with the marker type.

### Anti-Patterns to Avoid

- **Writing the defaults in `translateMcpServer`:** `pluginSetFieldsIn` would list them as plugin-set, a user value would lose to them, and the built-in table reads `translateMcpServer` too. Keep them in `defaultFieldsFor`.
- **Copying the parsed `defaultFields` into the new marker:** the new marker must hold only the defaults computed for this write (today's behavior). That is what makes a stdio-to-remote change drop `lifecycle`.
- **Turning on `resources` in the default stub:** adapter discovery sends `resources/list` when the capability is present (server-manager.ts:1992-1999, measured in Probe B). Every adapter message table would change.
- **Fixed sleeps in the listing wait:** the harness rule is poll with a deadline (`POLL_MS`, `TOOL_LISTING_TIMEOUT_MS`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Writing the adapter file | a new writer | `writeIfChanged` / `atomicWriteJson` in stage.ts | NFR-1, byte-equal no-op (AS-8) |
| Own-key copy of server maps | `obj[name] = …` with input names | `safeSet` (bridges/mcp/safe-set.ts) | WR-01 `__proto__` server names |
| Telling the user's value from the default | a second marker member | the existing `defaultFields` + `isRecordedDefault` | D-PG1-13 machinery, already covers the choice store and restore |
| Listing-done detection | sleeps | poll `readStubRequests` + `probedRegistry` like the built-in branch of `listingDone` | deterministic, existing deadline constants |
| Scenario home isolation | custom temp dirs | the cucumber world (hermetic home per scenario) | security rule |

## Runtime State Inventory

This phase changes what the next restage writes. It is a migration-like phase, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `<scopeRoot>/mcp-adapter.json` entries of installed plugins (user and project scope) lack `lifecycle` and `openUi`. Their markers may hold a numbers-only `defaultFields` (dev builds of this milestone) or none (released 0.23.0). The `_piClaudeMarketplace.serverChoices` store holds user carried fields only. Recorded defaults are excluded by `userCarriedFields`, adapter-doc.ts:510-520. | No data migration (D-PG9-04, APL-D1). Entries get the defaults at the next restage: reinstall, disable then enable, update to a new revision, apply move, or AMIG-01 move. Code edit only. |
| Live service config | pi-mcp-adapter's `mcp-cache.json` in the agent dir. `computeServerHash` hashes `openUi: false` but not `lifecycle` (metadata-cache.ts:143-176). pi-mcp-adapter's project approvals hash the whole definition, marker included (project-server-trust.ts:101-103). | None in code. Document it: the first session after a restage relists each server, and an approved project-scope server needs approval again (as already noted for the D-PG1 timeout in CHANGELOG). |
| OS-registered state | None. Verified: the extension registers no OS service. | None |
| Secrets/env vars | None. `caFile` is a path, not a secret. No env var name changes. | None |
| Build artifacts | None. No build step. | None |

**Restage paths when the version does not change (D-PG9-04 question):**

| Path | Rewrites `mcp-adapter.json`? | Evidence |
|------|------------------------------|----------|
| `reinstall` | Yes, always | `reinstall-flow.ts:216` `skipSameRevision: false`, then `update-swap.ts:433` `prepareStageMcpServers`; measured by D-PG1-12 scenario `lifecycle.feature:533-562` |
| `disable` then `enable` | Yes. Disable unstages (`orchestrators/marketplace/shared.ts:617` `unstageMcpServers`), and enable reinstalls through the install ledger (`install-outcome.ts:1474`) | `lifecycle.feature:502-531` (timeout re-default) |
| `update` with nothing new | **No.** The update policy skips the recorded revision (`update-flow.ts:1447` `skipSameRevision: true`), and the preflight returns `unchanged` (`update-preflight.ts:1300-1311`) | code read |
| `apply` catalog move at the same revision | **No.** `CONVERGE_MATERIALIZATION.skipSameRevision: true` (`update-flow.ts:1445-1450`). Only a growth-only move (`REMATERIALIZE_MATERIALIZATION`, `update-flow.ts:1463-1466`, D-10/D-25, a strictly grown supported set) re-materializes the same revision. | code read |
| `apply` enable step | Yes, when the config flips a disabled plugin to enabled (install ledger) | code read |
| AMIG-01 legacy move at load | Yes, only for a plugin that still has marked entries in the legacy `mcp.json` (`reconcile/mcp-migration.ts:489-501`) | `legacy-move.feature` |
| ordinary load | No (APL-D1) | -- |

So the CHANGELOG line "run `reinstall` once" is correct. `update` alone does not help until the plugin publishes a new revision.

## Common Pitfalls

### Pitfall 1: The adapter listing wait never finishes under `lazy-keep-alive` (BLOCKER for the suite)

**What goes wrong:** `listingDone` (features/lib/mcp-implementation.ts) returns true for the adapter only when `stubPidFiles(harness).length === 0`, because "the adapter lists them over a connection that it closes". The hook steps copy this rule (features/step_definitions/hook/tool-use.steps.ts:310-321). Under `lazy-keep-alive` the startup listing connection is resident (`init.ts:410` `resident = (definition.lifecycle ?? "lazy") !== "lazy" || ...`, and `init.ts:430-431` closes only `!resident`), so the stub keeps running. **Measured (Probe A):** `PROBE pid files after listing + 4s: ["mcp-stub-1596662.pid"]` with `lifecycle: "lazy-keep-alive"`, against `[]` for the control.
**Blast radius:** `has listed the tools` and `finishes listing the tools` steps appear about 130 times across 20 feature files (`sources` 28, `configuration` 14, `listing` 14, `lifecycle` 12, `agent-grants` 11, `tool-use` 8, `mcp-tool-names` 7, `invocation` 7, and others).
**How to avoid:** Change the adapter arm of `listingDone`, and the hook copy, before the default lands. Use "tools/list logged AND Pi's registry has a stub tool", which is the built-in arm's rule. `registryAfterListing` already relies on the adapter registering a server's tools with Pi after its listing ends. A second option is "the adapter's `mcp-cache.json` holds the server", written once per startup pass (init.ts:447-458). The registry rule reuses existing code. Check it against both lifecycles: a stub that stays `lazy` because a remote or user-set lifecycle applies still closes. Update the comments that state the old rule (mcp-implementation.ts `listingDone`, listing.steps.ts:139-142, mcp-stub-server.ts header).
**Warning signs:** `the adapter mcp implementation did not finish listing the tools of …` with `running: ["mcp-stub-….pid"]`.

### Pitfall 2: Defaults placed in the closed table become "plugin-set"

**What goes wrong:** `pluginSetFieldsIn(translated)` (adapter-entry.ts:200-202) lists every carried field the translated entry holds. `lifecycle` and `openUi` are carried fields (adapter-entry.ts:55, :60). A default written by `translateMcpServer` would be marked plugin-set, so a user value would be overwritten and kept only in the marker.
**How to avoid:** Write the defaults in `defaultFieldsFor` only. The domain function may compute them, but `translateMcpServer` must not return them.

### Pitfall 3: A resource on the default stub changes every adapter message table

**What goes wrong:** pi-mcp-adapter lists resources at connect when the server declares `capabilities.resources` (server-manager.ts:1990-2000). **Measured (Probe B):** the log shows `initialize`, `notifications/initialized`, `tools/list`, `resources/list` per connection. Pi's built-in does not list at connect (runtime.js:93-96 "not listed at connect", measured in Probe C: `initialize`, `notifications/initialized`, `tools/list`, `resources/read` only).
**How to avoid:** Make the resource opt-in. Options: a fifth stub argument, an env variable on the stub entry as with `STUB_TAG`, or a new `Given … has the stub mcp server "stub" with a static resource` step that writes the args. Extend `resultFor` (mcp-stub-server.ts) with `resources/list` and `resources/read`, and the `initialize` result with `resources: {}`, only in that mode. Keep `STUB_TOOL_NAMES` unchanged.

### Pitfall 4: Every adapter stub-message table and one status row change

**What goes wrong:** With `openUi: false` the `initialize` params lose `"extensions":{"io.modelcontextprotocol/ui":{"mimeTypes":["text/html;profile=mcp-app"]}}`. With `lazy-keep-alive` the second `initialize`, `notifications/initialized`, `tools/list` triple before the first `tools/call` disappears when the startup listing ran in the same session. **Measured (Probe A),** lazy-keep-alive and openUi false:

```
PROBE messages: [["initialize",{"protocolVersion":"2025-11-25","capabilities":{"sampling":{},"roots":{},"elicitation":{"form":{}}},"clientInfo":{"name":"pi-mcp-plugin_demo_stub_","version":"1.0.0"}}],["notifications/initialized",null],["tools/list",null],["tools/call",null]]
```

The control (no lifecycle, no openUi) gave two `initialize` rows with the UI extension and 7 messages.
**Scenarios to re-expect (adapter or own-implementation, each with an initialize row):** `invocation.feature` (3 adapter scenarios: "A scripted call through the mcp tool…", "A direct call to the tool a search activated…", "A call to a tool the plugin's server does not list…"); `listing.feature` ("A search through the mcp tool activates…"); `lifecycle.feature` ("Enabling a disabled plugin offers its server again", "Updating a plugin replaces its server…", "A published change to the server reaches no session…"); `configuration.feature` ("The plugin root variable in args reaches the server…"); `project-scope.feature` ("An allowed project-scope plugin server connects…"); `agent-grants.feature` (two D-CF6-10 foreground scenarios); `companion-missing.feature` ("A server installed with no MCP implementation answers once pi starts with pi-mcp-adapter…", MREC-05). Builtin tables do not change.
**Status row:** `companion-missing.feature:168` expects `cached, connects on first use` after the startup listing. With a resident connection the adapter reports `connected` (mcp-status.ts:46-48). [ASSUMED from source; not probed] Re-measure.
**How to avoid:** Re-measure each table once after the product change and paste what the stub logs. Do not hand-edit rows from the prediction. These re-expected tables are also the behavioral red-green proof of PG-MCP-06 (one connection) and of the UI half of PG-SEC-03 (no UI extension).

### Pitfall 5: A unit test classifies `caFile` as a credential that must stay inside the marker

**What goes wrong:** `test/bridges/mcp/adapter-entry.test.ts` "AFILE-06: an absorbed override's credentials stay inside the marker and only carried fields become active" (around :1009-1062) puts `caFile: "/stub/ca.pem"` with the bearer and OAuth fields. It asserts that `caFile` is not active on the entry. After D-PG9-05, `caFile` is carried and becomes active. The `CARRIED_KEYS` list in the same test file (around :74-88) and the AFILE-06 every-key test (around :861) also change. The code comment at adapter-entry.ts:41-49 says "No credential-bearing field is in the set". It stays true, but it should say why `caFile` is not a credential (D-PG9-05).
**How to avoid:** Move `caFile` out of that test's override into a dedicated D-PG9-05 case, and say so in the plan.

### Pitfall 6: A marker test expects a string member to be rejected

**What goes wrong:** marker.test.ts `defaultFieldsOf` "a member containing a string" (`defaultFields: { requestTimeoutMs: "1800000" }` → `{}`) contradicts D-PG9-03.
**How to avoid:** Turn that case into "returns the string value", add cases for a boolean member and a mixed earlier-release `{requestTimeoutMs: 1800000}` member, and keep the rejection cases for object, array, and null members.

### Pitfall 7: The `@mcp` configuration scenario writes the adapter file under both profiles

**What goes wrong:** Both profiles write `mcp-adapter.json` at install (01-06 SUMMARY), so `configuration.feature` "A server that declares no timeout is written to mcp-adapter.json with the idle window…" (`@mcp`) changes under both profiles.
**How to avoid:** Update its expected text, or let the new stdio and remote default scenario replace it. D-PG9-11 asks for adapter-only scenarios, but this existing `@mcp` pin must be updated either way.

### Pitfall 8: The earlier-release helper removes only the timeout

`writeMcpAdapterEntryWithoutRequestTimeout` (features/lib/mcp-server-files.ts) deletes `requestTimeoutMs` and `defaultFields` only. The D-PG9-04 reinstall scenario needs an entry as released 0.23.0 wrote it: no `requestTimeoutMs`, `lifecycle`, `openUi`, or `defaultFields`. The CHANGELOG `[Unreleased]` holds the timeout default, so no published release writes `defaultFields`. Widen the helper and rename its step, or add a sibling. Keep the D-PG1-12 scenario's meaning.

### Pitfall 9: Downgrade residual

A released 0.23.0 reading a new entry ignores `defaultFields` and carries `lifecycle` and `openUi` as user values. They then stay after an upgrade too, because a value with no recorded default reads as the user's. This is the same class as the D-PG1 timeout residual. It is benign because the values are the defaults. Record it, but do not fix it.

## Code Examples

### Verbatim in-repo values the plan depends on

`CARRIED_FIELDS` today [VERIFIED: extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts:50-64]:

```typescript
const CARRIED_FIELDS = [
  "disabled",
  "approveTools",
  "includeTools",
  "excludeTools",
  "lifecycle",
  "idleTimeout",
  "requestTimeoutMs",
  "debug",
  "searchKeywords",
  "openUi",
  "trace",
  "appendStructuredContent",
  "roots",
] as const;
```

Marker member and parser today [VERIFIED: extensions/pi-claude-marketplace/bridges/mcp/marker.ts:32, :52-54, :91, :112, :155]:

```typescript
  readonly defaultFields?: Readonly<Record<string, number>>;
function isNumberRecord(value: unknown): value is Readonly<Record<string, number>> {
  return isPlainObject(value) && Object.values(value).every((member) => typeof member === "number");
}
    ...(isNumberRecord(defaultFields) ? { defaultFields } : {}),
    readonly defaultFields?: Readonly<Record<string, number>>;
export function defaultFieldsOf(value: unknown): Readonly<Record<string, number>> {
```

Type switch [VERIFIED: extensions/pi-claude-marketplace/domain/mcp-server-features.ts:72-86]:

```typescript
  switch (server.type) {
    case undefined:
    case "stdio":
      return STDIO_IDLE_TIMEOUT_MS;
    case "sse":
    case "http":
    case "streamable-http":
      return REMOTE_IDLE_TIMEOUT_MS;
    default:
      return undefined;
  }
```

The closed table's output keys: `serverFields` (`command`, `args`, `env`, `url`, `headers`, `httpTransport: "sse"`, `auth`, `oauth`, `requestTimeoutMs`), then `description`, `directTools`, `toolPrefix` [VERIFIED: domain/mcp-server-features.ts:96-248]. It writes no `protocolVersion`, `tasks`, `exposeResources`, `caFile`, `lifecycle`, or `openUi`. So none of the four new carried fields can be plugin-set, and PG-MCP-09 needs no table change. The project validates no carried value: `carriedFields` copies any JSON value as is (adapter-entry.ts:223-244), which is the AFILE-06 rule.

pi-mcp-adapter 7.0.1 entry types [VERIFIED: pi-mcp-adapter/types.ts:452, :475, :479, :497, :519, :528]:

```typescript
  caFile?: string;
  lifecycle?: "keep-alive" | "lazy" | "lazy-keep-alive" | "eager";
  exposeResources?: boolean;
  openUi?: boolean;
  protocolVersion?: "legacy" | "auto" | "2026-07-28";
  tasks?: boolean;
```

Global settings [VERIFIED: pi-mcp-adapter/types.ts:659, :690-692]: `exposeResources?: boolean;`, `sampling?: boolean;`, `samplingAutoApprove?: boolean;`, `elicitation?: boolean;`. A global `settings.exposeResources` fills entries without their own value (config.ts:749-752).

### Scenario steps the new scenarios reuse

- Pinned entry text: `Then the mcp configuration file "mcp-adapter.json" of the user scope holds this text:` (lifecycle.feature:409 pattern, with `{home}` and `{agent dir}` tokens).
- User edit: `Given the user has set the request timeout of the mcp server "plugin_demo_kept_" to 45000 ms in the mcp-adapter.json file of the user scope` (lifecycle.steps.ts:32-39 calls `writeMcpAdapterOverride(file, key, fields)`). Add sibling steps for `lifecycle`, `openUi`, and the four D-PG9-05 fields. `writeMcpAdapterOverride` already merges arbitrary fields (mcp-server-files.ts).
- Restage verbs: `When the user has run "/claude:plugin update demo@fixtures --scope user", which did not fail` and the same with `reinstall`.
- Model calls: `Given the scripted model plays these steps:` (model.steps.ts:85), then `Then the model receives these calls:` (model.steps.ts:97), and under built-in `Then the model receives these calls, with each tool search reduced to the tools it loads:` (builtin-tool-search.steps.ts:18).
- Fixture with no started server: `pi-features-absent-mcp-server`, as the D-PG1 lifecycle scenarios use, for pure file pins.

### Measured resource call shapes (Probe B and Probe C)

Adapter (measured, `--profile adapter`):

```
| reply | tool | arguments                                    |
|       | mcp  | {"tool": "mcp__plugin_demo_res__read_notes"} |
→ 'tool call mcp {"tool":"mcp__plugin_demo_res__read_notes"}'
→ 'mcp returned: stub notes'
```

The tool name is `formatToolName("read_" + resourceNameToToolName(name), key, "mcp")`, where resource-tools.ts:3-17 lowercases the name and replaces non-alphanumerics with `_`, and types.ts:954 gives `mcp__<key>` for prefix `mcp`. For the stub server `stub` and resource name `notes`, that is `mcp__plugin_demo_stub__read_notes`.

Built-in (measured, `--profile builtin`):

```
|       | tool_search       | {"query": "read_mcp_resource"}                       |
|       | read_mcp_resource | {"server": "plugin_demo_res", "uri": "stub://notes"} |
→ 'tool_search returned: found list_mcp_resource_templates: … found list_mcp_resources: … found mcp__plugin_demo_res__echo: Echoes.\nfound read_mcp_resource: …'
→ 'tool call read_mcp_resource {"server":"plugin_demo_res","uri":"stub://notes"}'
→ 'read_mcp_resource returned: stub notes'
```

The resource tools take their server's exposure (deferred for a non-`alwaysLoad` plugin server, index.js:357-380), so the model needs `tool_search` first. The query `read_mcp_resource` loads all three resource tools and the stub's echo tool, so the expected table carries Pi's own tool descriptions. A narrower query is not available, because tool search ranks by text. Expect the full `found …` list, and note that a Pi upgrade that rewords those descriptions changes the row.

## Features Beyond Tools: Evidence for the docs table (D-PG9-09)

"Measured" means a scenario or run backs the cell. Every other cell is "unmeasured, source read", with the source named.

| Feature | Claude Code 2.1.323 | pi-mcp-adapter 7.0.1 | Pi built-in 1.5.0 |
|---------|--------------------|----------------------|-------------------|
| Resources | `@server:protocol://path` mentions, plus list and read tools. UI resources are hidden. [CITED: code.claude.com/docs/en/mcp "Use MCP resources", fetched 2026-11-14] | Yes, one tool per resource, `mcp__<key>_read_<name>`, through the `mcp` tool. **Measured** (Probe B; the new guard scenario). Off when the entry or the global setting has `exposeResources: false` (init.ts:471). | Yes, `list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource {server, uri}` behind `tool_search`. **Measured** (Probe C; the new guard scenario). UI resources are left out (resources.js:15-18). |
| `@server:uri` mentions | Yes [CITED: same page] | No mention syntax. Unmeasured: no handler found in the adapter source (grep for `@` handling found only npm package parsing) [ASSUMED] | No. Pi's `@` completes files. Unmeasured, docs/mcp.md has no mention syntax [ASSUMED] |
| Prompts | `/server:prompt (MCP)`; `/mcp__server__prompt` also runs [CITED: docs "prompts as slash commands"] | Slash commands `/mcp__<serverPart>__<prompt>` (docs/prompts-and-ui.md:7). For a plugin server the name is `/mcp__mcp__plugin_demo_stub___review`, from spike S3, which ran the adapter's naming code outside a session (PRD :952). Unmeasured in a session. | None. The client declares only `roots`. **Measured** capabilities `{"roots":{}}` (invocation.feature:62; Probe C log). No prompt code in dist/extensions/mcp. |
| Elicitation | Dialog in interactive sessions. Declares `elicitation: {form:{}, url:{}}` on most connections [CITED: docs "Elicitation modes"]. The binary's base object is `elicitation:{}` [VERIFIED: binary grep] | Yes, form mode when Pi has dialog UI, URL mode only in TUI (docs/prompts-and-ui.md:19-21; init.ts:197). **Measured** declaration `"elicitation":{"form":{}}` in the harness (Probe A). A dialog was not run. | None. **Measured** capabilities `{"roots":{}}`. |
| Sampling | Not declared. **Verified:** `function wNs(){return{roots:{listChanged:!0},elicitation:{},...MMn()&&{extensions:{[kNs]:{mimeTypes:[SNs]}}}}}`, and `LC_ALL=C grep -aoc 'sampling:{}'` gives `0` | Declared to every server while `settings.sampling !== false` and UI or `samplingAutoApprove` is present (init.ts:184-186). Each request asks for confirmation unless auto-approved (sampling-handler.ts:166-176). **Measured** declaration `"sampling":{}` with `openUi: false` (Probe A). No per-server switch (D-PG9-08). | None. **Measured** capabilities `{"roots":{}}`. |
| MCP Apps UI | Extension only when `CLAUDE_CODE_MCP_APPS_HOST` is set [VERIFIED: binary `function MMn(){return i.CLAUDE_CODE_MCP_APPS_HOST===!0}`] | Declared unless `openUi === false` (server-manager.ts:1511-1516). **Measured:** gone with `openUi: false` (Probe A). The new default writes `openUi: false` (D-PG9-07). | Not rendered. UI resources are left out (docs/mcp.md:248). |
| Roots | Launch dir plus `--add-dir` dirs, with `list_changed` [CITED: docs "roots/list"] | The session cwd as the one root, unless `roots: false` (server-manager.ts:1531-1534). **Measured** `"roots":{}` (Probe A). | The session cwd (runtime.js:283). **Measured** `"roots":{}`. |
| Output limits | Warns at 10,000 tokens. `MAX_MCP_OUTPUT_TOKENS` defaults to 25,000. Text over 50,000 characters is saved to a file. `_meta["anthropic/maxResultSizeChars"]` allows up to 500,000 [CITED: docs "MCP output limits"] | Global `settings.outputGuard`: 51,200 bytes, 2,000 lines, details 16,384 bytes (types.ts:538-546). No per-server value. Unmeasured. | A fixed 20 KiB (`MCP_OUTPUT_MAX_BYTES = 20 * 1024`, tools.js:31). The middle is cut, and the full text goes to a temp file (docs/mcp.md:234). Unmeasured. |

Probe A also measured, for the Connection lifecycle section, that under `lazy-keep-alive` a session with no valid cached tool list keeps the startup listing connection for the session. In a session whose cache is valid, the server starts on first use (init.ts:362-394; `lazy-keep-alive` is not in `startupServers` unless `needsDiscovery`). The deferred-runtime rule treats `lazy-keep-alive` like `lazy` (index.ts:434-435, :1117), so the "status unknown until first use" text at docs :605 and output-catalog :3058 applies to "lazy or lazy-keep-alive" servers. `openUi: false` is part of the cache hash (metadata-cache.ts:173-174), so the first session after a restage always relists.

Upstream lifecycle premise [CITED: code.claude.com/docs/en/mcp, "Plugin-provided MCP servers"]: "At session startup, Claude Code connects the servers for enabled plugins automatically."

## Readers and Writers of Adapter Entries and the Marker (question 1)

| Site | Reads/Writes | Effect of widening `defaultFields` and adding defaults |
|------|--------------|--------------------------------------------------------|
| `bridges/mcp/marker.ts` `readMarker`, `buildMarker`, `defaultFieldsOf` (:65-157) | parse/build | Widen the types and parser (Pattern 2). Rejecting an inherited member already uses `Object.hasOwn`. |
| `bridges/mcp/adapter-entry.ts` `isRecordedDefault`, `carriedFields`, `defaultFieldsFor`, `stampServers`, `userCarriedFields`, `restoredOverride`, `inactiveOverrideFields` (:200-385) | entry build, restore | Widen the parameter type. Add 4 carried names. Generalize the defaults. `restoredOverride` never adds a field the kept override lacks, so a default never leaks into a restored stub. |
| `bridges/mcp/adapter-doc.ts` partition, `writtenBackOverride`, `leavingChoice` / `capturedChoices` (D-08-02 store) (:211-639) | file compose | No code change. The choice store excludes recorded defaults through `userCarriedFields`, so `lifecycle` and `openUi` defaults are never stored. A user's `protocolVersion` and the other three new fields are stored at disable or uninstall and restored at enable or install. |
| `bridges/mcp/stage.ts` prepare (`stampServers` :538, `overrideKeptNotices` :252-277 via `inactiveOverrideFields`) | write | No code change. The `override-kept` notice no longer lists `protocolVersion`, `tasks`, `exposeResources`, or `caFile` for an absorbed stub. Check notice expectations that name them: none found by grep in features or tests. |
| `bridges/mcp/unstage.ts` (`restoredOverrideNames` :127) | write | No code change. |
| `bridges/mcp/legacy.ts` (AMIG-01 owner and stubs, `markerOwnerOf`, `isOwnedBy`) | read owner only | Unaffected by marker content. |
| `orchestrators/reconcile/mcp-migration.ts` (AMIG-01 move :489-501) | restage | Writes the new defaults on the move. `legacy-move.feature` (8 pinned texts) and `subagent-child.feature` (4) change. |
| `orchestrators/plugin/install-outcome.ts:1474`, `update-swap.ts:433` | restage | No code change. |
| info status (`orchestrators/plugin/info-mcp-status.ts`) | adapter status bus, not the file | No compare of entry content. A row can change from `cached, connects on first use` to `connected` (Pitfall 4). |
| `apply` convergence, `pending` | records vs catalog, not entry content | No compare of entry content. Verified by `mcpAdapterJsonPath` readers: legacy.ts, stage.ts, unstage.ts, prune-rollback.ts (byte restore), mcp-migration.ts. |
| built-in (`domain/mcp-builtin-translation.ts`, `bridges/mcp/builtin-*`) | records | Unaffected. It picks only transport, oauth, timeout, exposure, and description. |

### Owner tests and fixtures that pin whole entries or marker contents (counts are grep hits of `requestTimeoutMs` / `defaultFields`)

Unit: `test/bridges/mcp/stage.test.ts` (65/30), `test/bridges/mcp/adapter-entry.test.ts` (45/6, with `STDIO_DEFAULT`/`REMOTE_DEFAULT`/`STDIO_MARKER`/`REMOTE_MARKER` constants at :93-96), `test/bridges/mcp/marker.test.ts` (17/14), `test/orchestrators/plugin/install-flow-ledger.test.ts` (18/8), `test/orchestrators/plugin/update-flow.test.ts` (9/2), `test/orchestrators/plugin/reinstall-flow.test.ts` (4/2), `test/orchestrators/plugin/update-swap.test.ts` (2/1), `test/orchestrators/reconcile/mcp-migration.test.ts` (2/1), `test/bridges/mcp/adapter-doc.test.ts` (8/0; Phase 1 needed no edit), `test/bridges/mcp/substitute.test.ts` (5/0), `test/domain/mcp-server-features.test.ts` (15/0, changes only if the default table moves to domain), `test/architecture/integration-materialization-gate.test.ts` (2/1, byte pin at :93-103), `test/architecture/mcp-config-notices.test.ts` (1/0).
Integration: `test/integration/mcp-override-lifecycle.test.ts` (22/6), `mcp-home-path-partial.test.ts`, `mcp-legacy-sweep.test.ts`, `mcp-tool-rules.test.ts`, `mcp-variable-expansion.test.ts` (2/1 each).
Behavioral, entry pins: `features/mcp-server/lifecycle.feature` (4 file texts), `legacy-move.feature` (8), `configuration.feature` (1, `@mcp`), `features/plugin/subagent-child.feature` (4).
Behavioral, message tables and status: see Pitfall 4.
Phase 1 reference for size: plan 01-06 hit 63 unit and 16 integration expectation failures and 4 adapter scenarios for the timeout alone (01-06-SUMMARY).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No `lifecycle` on entries (ANAME-05) | `lazy-keep-alive` for stdio (D-PG9-01) | this phase | One process per stdio server for the session after first use, or from session start when the cache is invalid |
| UI extension declared to plugin servers | `openUi: false` default (D-PG9-07) | this phase | MCP App tools return results inline. The cache relists once. |
| Numbers-only `defaultFields` | JSON scalars | this phase | Old markers still read |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `companion-missing.feature:168` will read `connected` instead of `cached, connects on first use` | Pitfall 4 | One scenario expectation. Re-measure. |
| A2 | The registry-based listing-done rule (tools/list logged and Pi has a stub tool) is reliable for adapter scenarios, including the hook steps | Pitfall 1 | Flaky waits. Fall back to the `mcp-cache.json` rule. |
| A3 | No `@server:uri` mention handler exists in pi-mcp-adapter 7.0.1 or Pi 1.5.0 | Features table | Doc cell wrong. Only grep and docs back the absence. Keep the cell "unmeasured". |
| A4 | The adapter's startup `MCP: N servers connected` ui.notify (init.ts:533-540, shown when a resident server connects at startup) does not enter `resultsOf("session")`, which holds this extension's payloads | Pitfall 4 | "the session reports no results" steps fail. Probe A passed its steps, but it had no such step. |
| A5 | Each re-expected agent-grants table (pi-subagents children load the adapter too) follows the same pattern | Pitfall 4 | More table edits. Re-measure. |

## Open Questions (RESOLVED)

1. **Where does "Amended by D-PG9-01" go?** `PROJECT.md` has no ANAME-05 row. ANAME-05 lives only in the archived `.planning/milestones/mcp-4-REQUIREMENTS.md:97-98` and the "Validated" bullet `PROJECT.md:1428-1434` (ANAME-01..07). Recommendation: follow the D-PG1-11 precedent (PROJECT.md:2387). Put "amends ANAME-05" in the D-PG9-01 row title, and note it in the `_Last updated…_` footer (PROJECT.md:2690). Do not edit the archived file. Optionally add "(ANAME-05 amended by D-PG9-01)" to the Validated bullet.
   **RESOLVED:** 09-06 puts "amends ANAME-05" in the D-PG9-01 row title and the footer.
2. **The harness listing rule, registry or cache file?** Recommend the registry rule with a measurement task over `listing.feature`, `invocation.feature`, and `features/hook/tool-use.feature` under the adapter profile.
   **RESOLVED:** 09-01 adopts the registry rule (plus the stub's logged tool name) and measures it with resident stubs.
3. **Do the defaults live in domain or the bridge?** Recommend a domain function beside `defaultRequestTimeoutMs`, so there is one type switch, unit-tested in `test/domain/mcp-server-features.test.ts`, with filtering in `defaultFieldsFor`. Either way satisfies CONTEXT.
   **RESOLVED:** 09-03 adds the domain function beside `defaultRequestTimeoutMs`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all | ✓ | /home/linuxbrew/.linuxbrew/bin/node | -- |
| pi-mcp-adapter test peer | adapter profile | ✓ | 7.0.1 in node_modules/.cache/optional-peers | `node scripts/install-test-peers.mjs` |
| Pi | both profiles | ✓ | 1.5.0 | -- |
| Claude Code binary | doc evidence only | ✓ | 2.1.323 | -- |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (unit, integration), @cucumber/cucumber 13.3.0 (behavioral) |
| Config file | `cucumber.json` (profiles `adapter`, `builtin`), `package.json` scripts |
| Quick run command | `node --import "$PWD/test/platform/isolated-pi-home.ts" --test test/bridges/mcp/adapter-entry.test.ts test/bridges/mcp/marker.test.ts` |
| Pair coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts` (and `marker.ts`, `domain/mcp-server-features.ts` if touched) |
| One feature, one profile | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/lifecycle.feature` (and `--profile builtin`) |
| One scenario | `npx cucumber-js --profile adapter --name '<scenario title>'` |
| Full suite (wave gate, phase gate) | `npm run check` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Red before / guard | File Exists? |
|--------|----------|-----------|-------------------|--------------------|-------------|
| PG-MCP-06 | stdio entry holds `lifecycle: "lazy-keep-alive"`, recorded in `defaultFields`; remote has none | unit + e2e | `node --import … --test test/bridges/mcp/adapter-entry.test.ts`; `npm run test:cucumber:profile -- --profile adapter features/mcp-server/lifecycle.feature` | red before | ✅ files, new cases |
| PG-MCP-06 | user `lifecycle` survives update; stdio→remote drops the default; earlier-release entry gets it at reinstall | e2e `@adapter-only` | same, lifecycle.feature | red before | ✅ file, new scenarios |
| PG-MCP-06 | startup listing connection serves the first call (one `initialize`) | e2e `@adapter-only` | `npm run test:cucumber:profile -- --profile adapter features/mcp-server/invocation.feature` | red before (re-expected table) | ✅ |
| PG-MCP-09 | `protocolVersion: "auto"`, `tasks`, `exposeResources`, `caFile` survive update and reinstall | unit + e2e `@adapter-only` | adapter-entry.test.ts; lifecycle.feature | red before | ✅ files, new cases |
| PG-MCP-09 | stored choice keeps the four fields across disable/enable; `restoredOverride` restores them | unit | adapter-doc.test.ts / adapter-entry.test.ts | red before | ✅ |
| PG-SEC-03 | every entry holds `openUi: false` unless the user set it; user `openUi` survives | unit + e2e `@adapter-only` | adapter-entry.test.ts; lifecycle.feature / configuration.feature | red before | ✅ |
| PG-SEC-03 | `initialize` carries no UI extension | e2e `@adapter-only` | invocation.feature (re-expected tables) | red before | ✅ |
| PG-SEC-03 | divergence recorded and cited | doc review | manual: `docs/mcp-compatibility.md` cites D-PG9-08; PROJECT.md row; upstream draft; BACKLOG entry | n/a | ❌ new records |
| PG-MCP-08 | adapter reads a stub resource via `mcp__plugin_demo_stub__read_<name>` | e2e `@adapter-only` | `npm run test:cucumber:profile -- --profile adapter <resource feature>` | **guard: passes today** (measured Probe B) | ❌ new scenario + stub mode |
| PG-MCP-08 | built-in reads a stub resource via `tool_search` + `read_mcp_resource` | e2e `@builtin-only` (BLT-01 or PG-MCP-08 in title) | `npm run test:cucumber:profile -- --profile builtin <resource feature>` | **guard: passes today** (measured Probe C) | ❌ new scenario |
| PG-MCP-08 | features-beyond-tools table and `@server:uri` statement | doc review | manual | n/a | ❌ new section |
| D-PG9-03 | numbers-only and scalar `defaultFields` both read; object/array/null rejected | unit | `node --import … --test test/bridges/mcp/marker.test.ts` | red before (string case flips) | ✅ |

### Sampling Rate

- **Per task commit:** the owner test of each touched pair, plus `npm run check:commit` through the hook. The feature file under its profile when a feature or step file changes.
- **Per wave merge:** `npm run check` on the combined tree.
- **Phase gate:** `npm run check` green, then both cucumber profiles in full (inside `check`).

### Wave 0 Gaps

- [ ] `features/lib/mcp-implementation.ts` `listingDone` adapter arm and `features/step_definitions/hook/tool-use.steps.ts:310-321`: a listing rule that does not need the stub to exit (Pitfall 1). Prove it green on the full adapter profile with today's code before the default lands.
- [ ] `features/lib/mcp-stub-server.ts`: opt-in static resource (`resources: {}` capability, `resources/list`, `resources/read`) plus a `Given` step to declare it (Pitfall 3).
- [ ] `features/lib/mcp-server-files.ts`: a released-entry helper with no `lifecycle`, `openUi`, `requestTimeoutMs`, or `defaultFields` (Pitfall 8), and override steps for `lifecycle`, `openUi`, and the four D-PG9-05 fields.

### Red/green vs guard summary

Red before, green after: every new or re-expected entry pin, the re-expected adapter stub-message tables, the marker string case, and the carried-field cases. Guards, expected to pass on today's code: the two resource scenarios (D-PG9-10). Probes B and C ran them in scratch form, and both read `stub notes`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | -- |
| V3 Session Management | no | -- |
| V4 Access Control | yes (what powers a plugin server gets) | closed table: a plugin cannot set `lifecycle`, `openUi`, `caFile`, `protocolVersion`, `tasks`, `exposeResources` (mcp-server-features.ts:238-248) |
| V5 Input Validation | yes (marker and entries from a user-editable JSONC file) | `isPlainObject` + `Object.hasOwn` + scalar check; `safeSet` for input-named keys |
| V6 Cryptography | no (`caFile` is passed to the adapter, not read here) | -- |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype pollution through a `__proto__` key in `defaultFields` or a server map | Tampering | `JSON.parse` makes `__proto__` an own data property. `defaultFields` is only read by fixed `CARRIED_FIELDS` names behind `Object.hasOwn` (adapter-entry.ts:220). The new marker is built from computed defaults, never copied from the parsed one. Server maps go through `safeSet`. |
| Type confusion in `defaultFields` (`"1800000"` vs `1800000`, object members) | Tampering | Scalar-only parse, and an all-or-nothing reject keeps the file's value as the user's. `===` compare. |
| A user forges a marker default to get a value recomputed | Tampering (self) | Same-user file; no privilege boundary. Accepted D-PG1-13 residual. |
| A plugin sets a trust-related field (`caFile`) or a power (`openUi: true`, `lifecycle: eager`) | Elevation | The closed table drops every adapter-only field. Only the user's own entry value is carried. |
| A carried `caFile` survives a `url` change to a new origin | Spoofing | It replaces default roots for that entry, so a mismatch refuses the TLS connection: it fails closed (types.ts:451-452, D-PG9-05). Not probed. |
| Sampling stays declared to plugin servers | Elevation | Accepted divergence D-PG9-08. The adapter confirms each request with the user unless the user set `samplingAutoApprove`, and it turns sampling off without UI (init.ts:184-186, sampling-handler.ts:166-176). Upstream draft plus BACKLOG. |
| A resident stdio process lives longer (`lazy-keep-alive`) | Denial of service (resource) | Bounded to the session. The user can set `lifecycle` per entry. Documented. |
| Project approval invalidated by changed entry bytes | -- (usability) | pi-mcp-adapter re-asks in a trusted interactive session (project-server-trust.ts:101-103). Document it in the CHANGELOG. |

## Records: where things go (questions 9 and 10)

- `docs/mcp-compatibility.md`: `:143` ("never writes `lifecycle`… ANAME-05"), `:145` (7.0.0 two-start measurement), `:147` (user may set `lifecycle`, now a default), `:314` (a plugin cannot choose `protocolVersion`, but the user's value now survives), `:356` (the carried list gains 4 fields, and the two defaults are explained), `:364` ("Today this applies only to `requestTimeoutMs`" stays true), `:593`/`:605` (lazy state wording), `:629` (Loading divergence: rewrite it for D-PG9-01, and add Sampling as a divergence citing D-PG9-08). Add a new "Features beyond tools" section, for example after "Connection lifecycle" (`:139`) or before "Divergences" (`:613`). Also stale: `docs/output-catalog.md:5261` (carried list, already missing `appendStructuredContent` and `roots`) and `:3058` ("every server is lazy").
- `PROJECT.md`: Key Decisions table ends at `:2395` (D-PG4-11/12). Append D-PG9-01, D-PG9-07, and D-PG9-08 in the D-PG1 row format (`:2387`), with Outcome `Pending maintainer review`. Update the footer `:2690`. See Open Question 1 for ANAME-05.
- `CHANGELOG.md`: add one sub-bullet under the milestone's existing `[Unreleased]` top bullet (CHANGELOG.md:5-19, the parity-gaps aggregate), 40 words or fewer, active voice, with the `reinstall` instruction. Follow `.agents/skills/changelog/rules/entries.md`, and load `simple-english` (Plain) and `humanizer`. Run `pre-commit run --files CHANGELOG.md`.
- `.planning/upstream/pi-mcp-adapter-per-server-sampling.md`: copy the shape of `pi-dynamic-workflows-agent-tool-restriction.md`. Use an H1 problem title, then `Patch: no patch exists; this report is not filed.`, `Repository:`, and `Package version: 7.0.1 … read as source, 2026-11-14`. Then a Problem section with the source lines (init.ts:184-186, server-manager.ts:1511-1528, types.ts:690-691), a "Claude Code, for contrast" paragraph (binary capability object), and a `## Draft issue` with Title and a fenced Body. Ask for a per-server `sampling: false` that drops `sampling: {}` from `buildClientCapabilities`, like `openUi`.
- `.planning/BACKLOG.md`: append `## <ID>-01: <one-line>`, then `Noted 2026-11-14 (parity-gaps, Phase 9). …` naming the trigger (a published pi-mcp-adapter release with a per-server sampling switch) and the draft path, as WFRESTRICTGATE-01 does (BACKLOG.md:5313-5315). Suggested ID: `MCPSAMPLING-01`.

## Sources

### Primary (HIGH confidence)

- In-repo source read this session: `bridges/mcp/{adapter-entry,marker,adapter-doc,stage}.ts`, `domain/mcp-server-features.ts`, `domain/mcp-builtin-translation.ts`, `orchestrators/plugin/{update-flow,update-preflight,materialize-latest,reinstall-flow}.ts`, `orchestrators/reconcile/convergence.ts`, `features/lib/{mcp-stub-server,mcp-server-files,mcp-implementation}.ts`, `features/step_definitions/mcp-server/{listing,lifecycle}.steps.ts`, `features/support/world.ts`.
- pi-mcp-adapter 7.0.1 source: `types.ts`, `init.ts`, `index.ts`, `server-manager.ts`, `metadata-cache.ts`, `mcp-status.ts`, `project-server-trust.ts`, `proxy-modes.ts`, `resource-tools.ts`, `sampling-handler.ts`, `docs/prompts-and-ui.md`, `docs/configuration.md`, `docs/servers.md`.
- Pi 1.5.0: `dist/extensions/mcp/{resources,runtime,tools,index}.js`, `docs/mcp.md`.
- Claude Code 2.1.323 binary grep (capability object, `MMn`, `sampling:{}` count 0).
- Scratch probes run 2026-11-14 under the real harness (hermetic homes), files in the session scratchpad, not in the repo:
  - Probe A: adapter, `lifecycle`/`openUi` override vs control, stub message log and pid files.
  - Probe B: adapter, resource stub, `mcp` call to `mcp__plugin_demo_res__read_notes`.
  - Probe C: built-in, resource stub, `tool_search` + `read_mcp_resource`.

### Secondary (MEDIUM confidence)

- code.claude.com/docs/en/mcp.md (fetched 2026-11-14): plugin servers connect at session startup, output limits, resources, prompts, elicitation, roots.
- `docs/research/parity-gaps/mcp.md`, `docs/prd/parity-gaps-prd.md` (spike S3 prompt name).

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH. No new packages, and versions were read from the installed package.json files.
- Architecture: HIGH. The code paths were read, and the change sites are small and named.
- Pitfalls: HIGH for Pitfalls 1, 3, and 4 (measured). MEDIUM for the status row and agent-grants tables (A1, A5).

**Research date:** 2026-11-14
**Valid until:** 2026-12-14, or the next pi-mcp-adapter or Pi bump, whichever comes first.
