# Phase 9: Adapter Entries and MCP Features - Context

**Gathered:** 2026-11-14
**Status:** Ready for planning
**Mode:** autonomous smart discuss (the user told this run to proceed without
asking). Every question that smart discuss would ask took its upstream-parity
answer. Decisions 5 and 20 of the PRD's section 5.2 are maintainer decisions;
this run answered them by upstream parity and the pi-mcp-adapter version the
suites install, and marks them **pending maintainer review**. Each is
reversible: it changes only what the next restage writes, and the marker
records each written default so a later restage can recompute or drop it.

<domain>
## Phase Boundary

Deliver PG-MCP-06, PG-MCP-09, PG-MCP-08, and PG-SEC-03, under
pi-mcp-adapter 7.0.1 (declared floor `>=7.0.1 <8` in `package.json`;
`scripts/install-test-peers.mjs` installs 7.0.1, the lowest version the range
admits, because `test/integration/optional-peer-suite-versions.json` names
only pi-subagents):

- The adapter entry written for a stdio plugin server holds
  `lifecycle: "lazy-keep-alive"`. A remote server's entry holds no
  `lifecycle`, so the adapter's default `lazy` applies. A lifecycle the user
  set on the entry is kept (PG-MCP-06).
- A value the user wrote in `protocolVersion`, `tasks`, `exposeResources`, or
  `caFile` on a plugin entry survives an update and a reinstall (PG-MCP-09).
- Every plugin server entry holds `openUi: false`, unless the user set
  `openUi`. The `sampling` capability cannot be withheld per server under
  adapter 7.0.1; the divergence is recorded as a decision that the
  compatibility page cites (PG-SEC-03).
- `docs/mcp-compatibility.md` states, for each implementation, whether a
  plugin server can use resources, prompts, elicitation, sampling, roots, and
  output limits, and that `@server:uri` mentions do not exist on Pi. One
  scenario per implementation reads a resource of a plugin server (PG-MCP-08).

Pi's built-in MCP has no lifecycle, UI, or sampling field for a registration,
so nothing this phase writes changes the built-in path. This phase changes
nothing inside Pi or a companion package. The per-server sampling switch is a
drafted request to pi-mcp-adapter, not a patch.

</domain>

<decisions>
## Implementation Decisions

### Stdio lifecycle (PG-MCP-06, decision 5)

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

### Fields the user wrote (PG-MCP-09)

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

### Powers the adapter gives a plugin server (PG-SEC-03, decision 20)

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

### Features beyond tools (PG-MCP-08)

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

### Behavioral evidence

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

### Records

- **D-PG9-12:** Correct `docs/mcp-compatibility.md` where it says this
  extension never writes `lifecycle` (`:143-147`, `:629`), the carried-field
  list (`:356`), and the `openUi` text if any. Append rows D-PG9-01, D-PG9-07,
  and D-PG9-08 to the Key Decisions table of `PROJECT.md`, each with its
  premise and the adapter version (7.0.1), marked pending maintainer review,
  and append "Amended by D-PG9-01" to the ANAME-05 text. Add one CHANGELOG
  bullet. These shared-file edits are append-style and limited to this
  phase's rows.

### Decided autonomously

Reversible technical choices: D-PG9-02, D-PG9-03, D-PG9-04, D-PG9-05,
D-PG9-06, D-PG9-09, D-PG9-10, D-PG9-11, D-PG9-12. Undo touches the default
table in one module, the carried-field list, or a doc, and the marker lets a
restage drop a default it wrote.

### Pending maintainer review

- D-PG9-01 (decision 5): `lazy-keep-alive` for stdio servers; amends ANAME-05.
  Alternative: `keep-alive` (starts every server at session start), or keep
  ANAME-05 and move PG-MCP-06 to Out of Scope.
- D-PG9-07 (decision 20, UI): `openUi: false` on every plugin entry.
- D-PG9-08 (decision 20, sampling): record the divergence; no global
  `settings.sampling` write.
- D-PG9-04: existing installs get the defaults only at the next restage; no
  load-time rewrite.

### the agent's Discretion

The marker field's type name and parser shape. Whether the defaults live in
`domain/mcp-server-features.ts` beside `defaultRequestTimeoutMs` or in
`adapter-entry.ts`. The stub resource's URI and text. Scenario wording and
splits across feature files. Plan splits. No exception to plan size,
security, coverage, or verification gates.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `bridges/mcp/adapter-entry.ts`: `CARRIED_FIELDS` (`:48-62`, already holds
  `lifecycle` and `openUi`), `carriedFields`/`isRecordedDefault`, and
  `defaultFieldsFor` (`:316-334`), which writes the D-PG1-11 timeout default.
  The new defaults join `defaultFieldsFor`.
- `bridges/mcp/marker.ts`: `defaultFields` is typed
  `Readonly<Record<string, number>>` and parsed by `isNumberRecord` (`:32`,
  `:85-91`, `:112`, `:155`). Widen it.
- `domain/mcp-server-features.ts`: `defaultRequestTimeoutMs` (`:72-86`) holds
  the stdio/remote switch.
- `features/mcp-server/lifecycle.feature:394-562`: the timeout scenarios
  (user value survives update; stdio to remote; disable and enable; earlier
  release gets the default at reinstall) are the pattern for D-PG9-11.
- `features/lib/mcp-stub-server.ts`: the stdio stub; needs a resource.

### Established Patterns

Entry content changes live in `adapter-entry.ts` or the closed table (module
header). The marker names what the extension wrote so a restage can tell the
user's values from its own. Scenarios pin the written `mcp-adapter.json`
entry. Built-in registrations are rebuilt from the record each session.

### Integration Points

- Anything that compares an entry with what a restage would write (status
  rows, `apply` convergence, AMIG-01 move, `info`) must tolerate the new
  fields. Research must find every reader of `mcp-adapter.json` entries.
- `docs/mcp-compatibility.md` server status rows describe lazy states; check
  that `lazy-keep-alive` keeps the same states before the first use.

</code_context>

<specifics>
## Specific Ideas

Evidence checked 2026-11-14:

1. **Adapter version.** `package.json` peer range `pi-mcp-adapter >=7.0.1 <8`;
   `scripts/install-test-peers.mjs` installed `pi-mcp-adapter@7.0.1` into
   `node_modules/.cache/optional-peers` (run output on 2026-11-14).
   `test/integration/optional-peer-suite-versions.json` names only
   `pi-subagents: 0.88.1`.
2. **Adapter 7.0.1 source** (`node_modules/.cache/optional-peers/node_modules/pi-mcp-adapter/`):
   `types.ts:452` `caFile`, `:475` `lifecycle`, `:479` `exposeResources`,
   `:497` `openUi`, `:519` `protocolVersion`, `:528` `tasks`; settings
   `:690-691` `sampling`, `samplingAutoApprove`; `server-manager.ts:1511-1528`
   `buildClientCapabilities`; `init.ts:185` sampling gate; `init.ts:349-350`
   lifecycle default and keep-alive persistence.
3. **Claude Code 2.1.323 binary**
   (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.323/claude`):
   the client capability object quoted in D-PG9-07. No `sampling` key.
4. **PRD** sections 5.2 (decisions 5 and 20), 7.3 (MCP-06, MCP-08, MCP-09,
   SEC-03); report `docs/research/parity-gaps/mcp.md` MCP-06, MCP-08, MCP-09,
   and the "More than upstream" finding 1.

</specifics>

<deferred>
## Deferred Ideas

- Writing `protocolVersion: "auto"` for remote servers (MCP-09 option).
- A `{requires pi-mcp-adapter}` hint for a plugin whose server offers
  prompts (the report's open question); the project cannot know it at
  install.
- Withholding sampling once pi-mcp-adapter ships a per-server switch (BACKLOG
  entry from D-PG9-08).
- Claude Code's bare `elicitation: {}` versus the adapter's `{form, url}`;
  `bareElicitationCapability` stays blocked under the adapter.
- `keep-alive` (start at session start) as an alternative to D-PG9-01.

</deferred>
