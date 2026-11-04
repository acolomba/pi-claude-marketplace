# Phase 3 (Read-Time Verdicts): Dubious Choices Log

The choices Phase 3 made without the user, in the shape of the root
`.planning/DUBIOUS-CHOICES.md` (read it for DC-01..DC-45, which these entries
stay consistent with) and of Phase 1's log
(`.planning/phases/01-foundation-and-pi-1-5-0/DUBIOUS-CHOICES.md`,
P1-DC-01..). Only this phase's session writes this file: each subagent ends
its report with `## Dubious Choices` (or "None"), and the session copies every
item here. The parent merges this file into the root log in Phase 6, and the
session sends each step's new entries to the parent as it goes.

- **Severity.** High: changes what a user sees or diverges from upstream.
  Medium: a judgment call a reviewer may reverse at low cost. Low: process,
  naming, or tooling.
- **Status.** `open` until the user reviews it.

## Discuss step (Phase 3 session, 2026-11-04)

All answers are the recommended ones, settled without the user (P1-DC-01
precedent). Each is recorded in `03-CONTEXT.md`.

### P3-DC-01: The neutral stored verdict is the `none` view

- **Severity:** Medium. **Status:** open.
- **Choice:** the stored compatibility counts an MCP server as blocked only
  when both profiles block it (plus a bundle), so `sse` and
  `bareElicitationCapability` never enter a stored record.
- **Alternatives:** (a) store no MCP kind at all and rely only on the recorded
  configs; (b) store the active implementation's verdict with its basis.
- **Why dubious:** (a) loses a bundle block when the configs are unreadable;
  (b) makes the record depend on the implementation at install, which MREC-03
  forbids. The chosen view equals what `effectiveMcpCompatibility` computes
  for `none`, so a neutral record reads the same under `none` either way.

### P3-DC-02: Phase 3 changes the verdict that Phase 1's record writers write

- **Severity:** Medium. **Status:** open.
- **Choice:** `statePhase` (install) and the update-swap record write are
  Phase 1-owned functions in shared files; Phase 3 changes only which verdict
  they store and sets `compatibilityBasis: "neutral"`, in the narrowest diff.
- **Alternatives:** a parent line for Phase 1's functions, applied at merge.
- **Why dubious:** it edits a function another phase owns by the ownership
  table. Phase 1 is finished and the ROADMAP names Phase 3 as the writer of
  the neutral basis, so the edit cannot collide with a running sibling.

### P3-DC-03: The resolver gives a view per implementation, and every caller names one

- **Severity:** Medium. **Status:** open.
- **Choice:** the resolver classifies each server under both profiles and
  exposes `state`/`unsupported`/`droppedMcpServers` for a named
  implementation (`adapter`, `builtin`, `none`), with no default.
- **Alternatives:** keep the resolver adapter-only and let each caller run
  `effectiveMcpCompatibility` on the resolution.
- **Why dubious:** it widens the resolver's interface and touches every
  caller; the alternative leaves the resolver's own `state` wrong under
  built-in and is easy to forget at a new call site.

### P3-DC-04: One offline effective-read helper for every record read

- **Severity:** Low. **Status:** open.
- **Choice:** a new Phase 3 module joins `recordedMcpServers` and
  `effectiveMcpCompatibility`; a legacy record re-resolves offline from the
  cached clone; an unreadable read keeps the stored verdict.
- **Alternatives:** each surface calls the two frozen functions itself.
- **Why dubious:** a legacy record costs one offline re-resolve per read
  (list of many legacy plugins re-reads each manifest).

### P3-DC-05: The marker when no single implementation runs every server

- **Severity:** Medium. **Status:** open.
- **Choice:** with servers split (one only the adapter runs, one only
  built-in runs), the marker is `requires mcp` when none is active and the
  other implementation's name when one is active.
- **Alternatives:** no marker; always `requires mcp`; the implementation
  that runs more servers.
- **Why dubious:** D-MB-07 does not cover this case ("the implementation that
  would run every server" does not exist). Upstream has no counterpart:
  Claude Code runs every transport itself.

### P3-DC-06: `partially-installed` list rows gain the MCP marker

- **Severity:** High. **Status:** open.
- **Choice:** a partially-installed row whose blocked server another
  implementation runs shows `{unsupported mcp, requires <other>}`; today such
  a row carries no dependencies and shows no marker.
- **Alternatives:** keep the marker off partially-installed list rows.
- **Why dubious:** a visible change to `list`; D-MB-07's example requires the
  marker beside `{unsupported mcp}`, so this follows it.

### P3-DC-07: `info`'s `requires:` names the D-MB-07 marker, also when it is satisfied

- **Severity:** High. **Status:** open.
- **Choice:** a stdio plugin reads `requires: mcp` under either
  implementation and `requires: mcp (missing)` with none; JSON
  `{"companion":"mcp","missing":false}` replaces today's
  `{"companion":"pi-mcp-adapter","missing":false}` under the adapter.
- **Alternatives:** name the active implementation when it runs every server
  (`requires: pi-mcp-adapter` under the adapter, `requires: builtin mcp`
  under built-in); or drop the MCP entry when satisfied.
- **Why dubious:** it changes today's adapter output (JSON consumers see a new
  companion name). It keeps one meaning for the line: what the plugin needs.

### P3-DC-08: The marker input carries per-profile verdicts

- **Severity:** Low. **Status:** open.
- **Choice:** the MCP `Dependency` carries the verdicts each emit site already
  has instead of a bare `declaresMcp`.
- **Alternatives:** recompute the verdicts inside the marker function from
  raw configs.
- **Why dubious:** about 30 emit sites change shape at once.

### P3-DC-09: With no implementation, consent covers only blocks under both

- **Severity:** Medium. **Status:** open.
- **Choice:** under `none`, `--partial` is asked only for servers both
  profiles block (and non-MCP drops); an `sse` plugin installs without it.
- **Alternatives:** never ask under `none` (a `ws` server too).
- **Why dubious:** D-MB-05 says "needs no `--partial` consent" without the
  qualifier; a `ws` server is dropped under every implementation, so the drop
  is a content drop, not a missing soft dependency.

### P3-DC-10: Apply's convergence asks only for a new degrade under the active implementation

- **Severity:** Medium. **Status:** open.
- **Choice:** a catalog move is held for consent only when the candidate drops
  something the installed record, read under the active implementation, does
  not; enable, import, promotion, and cascades read the neutral stored
  `installable`.
- **Alternatives:** compare against the neutral view only.
- **Why dubious:** a version that newly adds an `sse` server is held under
  built-in but not under the adapter, so the same apply differs by
  implementation (D-MB-06 says consent is against the active implementation).

### P3-DC-11: No load warning row after a switch

- **Severity:** Medium. **Status:** open.
- **Choice:** the load prints nothing new when a plugin becomes partial
  because of a switch; `list` and `info` show it.
- **Alternatives:** a load warning row naming the plugin and the marker.
- **Why dubious:** a user may miss that a server stopped running; APL-D1 and
  "a switch needs no user action" favor silence.

### P3-DC-12: AMIG-01 stays adapter-explicit

- **Severity:** Low. **Status:** open.
- **Choice:** the legacy `mcp.json` move stages the adapter view into
  `mcp-adapter.json` under every implementation and keeps its notice text; its
  record write stores the neutral verdict with the basis.
- **Alternatives:** skip the move under built-in.
- **Why dubious:** under built-in the moved entries feed only the adapter
  file, which the active implementation does not read.

### P3-DC-13: Agreeing tag pairs fold into one `@mcp` scenario

- **Severity:** Low. **Status:** open.
- **Choice:** the nine `verdict-markers.feature` pairs whose twins now agree
  become single `@mcp` scenarios; new pairs pin the rows that differ.
- **Alternatives:** keep the pairs with identical bodies.
- **Why dubious:** P1-DC-16 moved them as pairs on the expectation that they
  differ; folding loses that history.

## Plan step: research (2026-11-04)

### P3-DC-14: Standard research ran despite the ROADMAP's "no `--research-phase`"; decisions numbered D-P3-NN

- **Severity:** Low. **Status:** open.
- **Choice:** plan-phase's default research step ran (the ROADMAP flag rules
  out only a research-only run); the CONTEXT decisions got IDs D-P3-01..23 so
  the decision-coverage gate can track them.
- **Alternatives:** skip research and plan from CONTEXT and the survey.
- **Why dubious:** costs time on the critical path.

### P3-DC-15: The resolver's top-level verdict becomes the neutral view; views come from `effectiveMcpCompatibility`

- **Severity:** Medium. **Status:** open.
- **Choice:** `resolveStrict` keeps its two-argument signature (frozen
  `recorded-servers.ts` calls it); its top-level verdict is the neutral view,
  and a pure `resolutionFor(resolved, active)` derives each implementation's
  view with the frozen `effectiveMcpCompatibility`. Refines D-P3-03.
- **Alternatives:** an option argument on `resolveStrict` (breaks the frozen
  caller); both views stored on the result.
- **Why dubious:** a call site that forgets `resolutionFor` silently reads the
  `none` view.

### P3-DC-16: `mcpServers` kind ordering follows `effectiveMcpCompatibility`

- **Severity:** Low. **Status:** open.
- **Choice:** when only one implementation blocks, the `mcpServers` kind goes
  last in `unsupported`, so the adapter reason order changes for a
  bare-elicitation plugin that also has other unsupported kinds.
- **Alternatives:** keep the resolver's order and accept install/list drift.
- **Why dubious:** a byte change in a rare adapter row.

### P3-DC-17: Record reads split into a pure helper and an I/O helper to avoid import cycles

- **Severity:** Medium. **Status:** open.
- **Choice:** `mcp-verdict.ts` (pure) and `mcp-verdict-read.ts` (I/O, imported
  only by cycle-safe modules); the update swap and rows get the record verdict
  as data from `materialize-latest.ts`, because the frozen
  `recorded-servers.ts` imports `install-outcome.ts`.
- **Alternatives:** direct imports (fallow cycle failure).
- **Why dubious:** data threading through more parameters.

### P3-DC-18: Legacy records with no MCP trace skip the offline re-resolve

- **Severity:** Medium. **Status:** open.
- **Choice:** a wrapped legacy reader answers "no servers" without I/O for a
  legacy record with no MCP trace (no `resources.mcpServers`, no
  `mcpServers` kind), so `list` does not re-resolve every old plugin.
- **Alternatives:** always re-resolve (may hash whole plugin trees per list).
- **Why dubious:** a legacy record whose servers were all adapter-blocked
  with no stored kind would read as no servers; the stored kind covers that.

### P3-DC-19: The `"mcp"` dependency becomes `{ kind: "mcp", runEvery }`

- **Severity:** Medium. **Status:** open.
- **Choice:** `Dependency` gains `McpDependency { kind: "mcp", runEvery:
  McpImplementationId[] }` in place of the `"mcp"` literal; catalog fixtures
  use `runEvery: ["adapter"]` so the frozen catalog counters keep their bytes.
- **Alternatives:** keep `"mcp"` as adapter-only and add a new arm.
- **Why dubious:** every emit site and fixture changes shape.

### P3-DC-20: Record-driven consent gates read the `none` view; fresh import/apply installs read the active view

- **Severity:** Medium. **Status:** open.
- **Choice:** enable, re-enable, promotion, and promoting import gate on the
  `none` view (never asks because of a switch, safe for legacy adapter
  records); a fresh import or apply install (no record) gates on the active
  implementation.
- **Alternatives:** active view everywhere; `none` everywhere.
- **Why dubious:** a fresh import under built-in of an `sse` plugin asks for
  consent that the same import under the adapter does not.

### P3-DC-21: The update intent mark keeps the old record's basis

- **Severity:** Medium. **Status:** open.
- **Choice:** `markUpdateInProgress` keeps the old basis instead of forcing
  `"neutral"`, because it changes only the notes of the old verdict.
- **Alternatives:** force `"neutral"` as D-P3-02's list says.
- **Why dubious:** departs from the literal D-P3-02 list.

### P3-DC-22: Completions stay on the stored verdict (parent line)

- **Severity:** Medium. **Status:** open.
- **Choice:** the completion resolver has no run (frozen `edge/register.ts`)
  and its cache keys only scope and marketplace, so completions keep reading
  the stored verdict; a parent line asks for a run in the completion path.
- **Alternatives:** probe the implementation inside completion (forbidden
  before every extension loads), or edit the frozen file.
- **Why dubious:** `update --partial` completion candidates may differ from
  `list` after a switch.

### P3-DC-23: Phase 3 edits files the ownership table does not name

- **Severity:** Low. **Status:** open.
- **Choice:** `edge/handlers/tools.ts`, `edge/handlers/plugin/browse.ts`,
  `orchestrators/types.ts`, `orchestrators/plugin/fetch.ts`, and
  `reconcile/{pending,read-pass,apply,notify}.ts` change to carry the new
  marker data and views; no sibling owns them.
- **Alternatives:** parent lines.
- **Why dubious:** widens the merge surface with siblings.

### P3-DC-24: An unreadable record read falls back to the stored adapter reading for markers

- **Severity:** Low. **Status:** open.
- **Choice:** with no readable recorded servers, markers use the stored
  verdict as the adapter's (frozen rule 1).
- **Alternatives:** no marker.
- **Why dubious:** under built-in, an unreadable legacy record may show the
  adapter marker.

### P3-DC-25: `fetch` rows switch to the active view

- **Severity:** Low. **Status:** open.
- **Choice:** `fetch` rows (not named by MREC-03) follow the active
  implementation for consistency.
- **Alternatives:** leave them on the stored verdict.
- **Why dubious:** scope widening.

## Plan step: planner (2026-11-04)

The planner's choices, numbered here. Each is Low unless marked.

- **P3-DC-26 (Low): five waves instead of the ROADMAP's three.** The
  `Dependency` type change (wave 2) and the marker rule (wave 3) get their
  own waves so same-wave plans own disjoint files. Alternative: three waves of
  larger, overlapping plans. Adds two gates to the critical path.
- **P3-DC-27 (Low): `declaresMcp` keeps its name, typed `McpDependency | false`.**
  Alternative: rename to `mcpDependency`. Keeps ~340 `false` literals; the name
  now reads like a boolean.
- **P3-DC-28 (Low): 03-06 imports `readRecordMcpVerdict` directly** in the
  update modules, relying on fallow 3.35 not counting type-only edges as
  cycles. Alternative: inject a reader port. A fallow upgrade could change it.
- **P3-DC-29 (Low): `InstallLedgerOptions.consentView` is required**, `"none"`
  at enable, re-enable, and promotion. Alternatives: optional with a default;
  `partial: true` there.
- **P3-DC-30 (Medium): 03-05 edits `toInstallLedgerSummary` in
  `install-outcome.ts`**, beyond the consent gate the ownership table names.
  Alternative: project the view at every consumer. Possible merge friction
  with Phase 4.
- **P3-DC-31 (Low): convergence asks only for kinds the candidate's active view
  drops and the record's effective view does not; `move.partial =
  !effective.installable`.** Alternative: compare with the stored neutral
  verdict. A record already partial after a switch moves without asking.
- **P3-DC-32 (Low): the AMIG-01 dropped-server write uses the `none` view plus
  the basis, keeps `supported` and `notes`, and writes only on change.**
  Alternative: always rewrite.
- **P3-DC-33 (Low): `info` carries the MCP dependency through a required
  `InfoBlock.mcpDependency`** and row builders returning `{ row, mcpDependency }`.
  Alternatives: a wire field (frozen closed set), or recompute from rows
  (impossible). Touches ~7 builders in a 3,362-line file.
- **P3-DC-34 (Low): `requires:` entries sort by code-unit companion name**, so
  `builtin mcp` and `mcp` come before the `pi-` names. Alternative: keep the
  MCP entry's old position. Visible order change.
- **P3-DC-35 (Low): 03-08 refactors 03-04's `mcpDependencyMarker`** so the
  marker and `requires:` share one name table (ADET-01). Alternative: a second
  table.
- **P3-DC-36 (Medium): 03-08 edits one cell of Phase 2's
  `features/mcp-server/project-scope.feature`** (`plugin requires` becomes
  `[{"companion":"mcp","missing":false}]`) before the merge, to keep the wave 4
  gate green. Alternatives: accept a red wave gate; move the `requires:` change
  after the merge. A sibling-file edit and a likely merge conflict.
- **P3-DC-37 (Low): 03-08's new `requires:` scenarios use not-installed
  plugins** to stay independent of 03-05 in the same wave. Alternative:
  installed plugins with `--partial`.
- **P3-DC-38 (Low): the e2e foreign-tool case also turns off built-in MCP** so
  it still proves ADET-02.
- **P3-DC-39 (Low): the e2e marker tests move to 03-08 (wave 4);** 03-09 reruns
  `npm run test:e2e` after the merge.
- **P3-DC-40 (Medium): 03-09 retags `invalid-configs.feature`'s two tool-call
  scenarios `@mcp`** (if Phase 2 merged), proving the skipped server with the
  frozen `pi lists these registered mcp servers:` step. Alternatives: keep
  `@adapter-only` with an ID; add `@mcp` twins. The proof moves from "answers
  a call" to "is registered".
- **P3-DC-41 (Medium): 03-09 continues if a sibling has not merged yet**,
  records the missing phase as a wait, and runs the gate. Alternative: stop
  with BLOCKED.md. The parent re-verifies after the last merge.
- **P3-DC-42 (Medium): wave 5 (03-09, the milestone merge) runs in the main
  checkout, not an executor worktree** (orchestrator decision), because the
  worktree deletions guard would block sibling deletions the plan cannot
  declare. Alternative: worktree with listed paths.
- **P3-DC-43 (Low): 03-09's conflict policy**: frozen files take the
  milestone side; owned files keep Phase 3's functions and the milestone's
  others; sibling files take the milestone side with Phase 3's rules
  re-applied; STATE.md and ROADMAP.md keep both sides. Alternative: `-X ours`
  or `-X theirs`.
- **P3-DC-44 (Low): the merge commit title is
  `chore: merge the parallel component work`**, with no branch, milestone, or
  phase name. Alternative: git's default message.
- **P3-DC-45 (Low): commit trailers use the brief's
  `Claude-Session: https://claude.ai/code/session_01EDUMG7S9uXh4o5dikBwum8`**
  (orchestrator decision: the brief is the user's contract and says "exactly
  these two lines"), although this child session's own URL is
  `session_01EDUMG5p4jHecGXqAFGi3Do`. Alternative: the child's own URL.
- **P3-DC-46 (Low): ROADMAP.md's Phase 3 plan list is filled on this branch.**
  Alternative: leave "TBD". Possible merge conflict with siblings.
- **P3-DC-47 (Low): 03-04 tags the two `companion-missing` info scenarios
  `@builtin-only` for one wave** before 03-08 rewrites them.
- **P3-DC-48 (Low): the two concurrency edge probes are
  `verification: backstop`**, resting on the existing state lock; no
  concurrency test.

## Plan step: revision (2026-11-04)

- **P3-DC-49 (Low): 03-02 stays one plan of three green commits** (field type,
  then vocabulary, then producer pins), still about 225k tokens. Alternative:
  two plans, which pushes 03-04 and 03-08 one wave later.
- **P3-DC-50 (Low): `mcpDependencyOfResolution` is dropped** (fallow rejects
  an export used only by its own file); producers call
  `mcpDependencyOf(Object.values(<resolution>.declaredMcpServers))`; one phrase
  of 03-08 changed to match.
- **P3-DC-51 (Low): the 03-02 executor reads line ranges** of CONTEXT,
  RESEARCH, and FROZEN, not whole files.
- **P3-DC-52 (Low): `update-cascade.ts` and `reinstall-record.ts` dropped from
  03-02's files** by reading, not by a compile.
- **P3-DC-53 (Low): interim marker between 03-02 and 03-04**: a plugin whose
  only servers are bare-elicitation servers shows `requires pi-mcp-adapter`
  without the adapter until 03-04 lands; no test covers the interim.

## Execute step (2026-11-04)

- **P3-DC-54 (Low): executor prompts name the GSD execution files by
  absolute path instead of inlining them** (about 150 KB per dispatch), as
  component-features DC-17 did; the small worktree branch-check block is
  inlined with its base SHA. Alternative: inline every file verbatim.
- **P3-DC-55 (Low): the post-merge gate of each wave is the brief's gate**
  (`npm run check` in parts plus both cucumber profiles in their CI shards),
  not GSD's generic build sniff; GSD's evaluation-scope commit spot-check is
  replaced by a check of the merged commits and SUMMARY, because commit titles
  carry no plan IDs (brief).

### Wave 1 (03-01, neutral record and read-time list)

- **P3-DC-56 (Medium): the list switch scenario uses a fresh Pi with
  built-in MCP, not the "restart without pi-mcp-adapter" step**, because
  pi-mcp-adapter turns built-in MCP off on its machine, so that restart lands
  on no implementation. The plugin installs under the adapter-profile Pi and is
  listed from a fresh built-in Pi with no reinstall. Alternatives: two restarts;
  expect the no-implementation row.
- **P3-DC-57 (Medium): sibling tests pin the cleared basis after update and
  reinstall for one wave** (`install-flow-ledger`, `operations`,
  `reinstall-flow`), until 03-06 writes the basis in the update runner.
- **P3-DC-58 (Low): the LLM list tool opens one snapshot also on its
  load-failure paths.**
- **P3-DC-59 (Low): the no-trace legacy proof strips the record's trace and
  keeps a declared sse server**, since removing the manifest turns the list into
  a bare `(failed)` header.
- **P3-DC-60 (Low): `resolutionFor` spreads the neutral resolution**, relying
  on "every implementation blocks what neutral blocks" to leave no stale
  `droppedMcpServers`.
- **P3-DC-61 (Low): the interim update/reinstall basis gap is tracked in the
  SUMMARY, not WINDOWS.md**, to avoid ledger conflicts between parallel
  worktrees.
- **P3-DC-62 (Low): the browse loader's implementation wiring has no dedicated
  unit test**; it is proven through the shared payload builder.

### Wave 2 (03-02 structured MCP dependency, 03-03 info and fetch verdicts)

- **P3-DC-63 (Medium): a warm git installed plugin under a partially-available
  view keeps the existing `components: not resolved` fallback (D-78-04)**, so
  under built-in an installed github plugin with an sse server reads
  `(partially-installed) {unsupported mcp}` without its server lines.
  Alternative: list the warm tree's components as not-installed git rows do
  (also changes today's `lspServers` git rows).
- **P3-DC-64 (Low): `info` reads the record verdict for every installed
  block**, also path rows that resolve fresh (a legacy record pays one extra
  offline resolve). Alternative: read lazily in the three record arms.
- **P3-DC-65 (Low): a hand-edited record with a malformed recorded config
  writes every recorded server in `info`** instead of falling back to the
  staged names.
- **P3-DC-66 (Low): the built-in info scenario pins `status unknown` for the
  written stub**; Phase 2's status reader will change that cell (fixed at the
  merge).
- **P3-DC-67 (Low): info unit tests seed the neutral record through a local
  helper**, not the shared seed outside the plan's files.
- **P3-DC-68 (Medium): interim `requires pi-mcp-adapter` for a plugin whose
  only server is bare-elicitation** (a test pins it) until 03-04 switches the
  rule.
- **P3-DC-69 (Low): the declared-row MCP dependency is read inside the state
  lock** and carried on the `"declared"` outcome (the caller after the lock has
  no marketplace record).
- **P3-DC-70 (Low): a redundant `marketplaceRecord === undefined` guard** only
  narrows the type in `promoteDependencyRecord` and `declareInstalledPlugin`.
- **P3-DC-71 (Low): a Task 3 ws case uses a hand-made legacy record**; a second
  realistic case covers bare elicitation under built-in.
- **P3-DC-72 (Low): `execute.test.ts`'s table column renamed to `mcp`** to
  satisfy the plan's acceptance grep.
- **P3-DC-73 (Low): `false as const` in two test files.**
- **P3-DC-74 (Low): `isMcpDependency` checks `typeof === "object"`**, relying on
  `McpDependency` staying the union's only object member.

### Wave 3 (03-04, the D-MB-07 marker rule)

- **P3-DC-75 (Medium): the "settings unchanged" step's expected text includes
  Pi's own `"retry": {"enabled": false}`**, which Pi saves to the same user
  settings file when the harness turns auto-retry off over RPC; the step
  compares the whole text. Alternatives: compare only `extensions`; snapshot
  the file after Pi starts (needs world state or a frozen-file change).
- **P3-DC-76 (Low): a `When pi-mcp-adapter finishes listing the tools of the
  stub mcp server ...` wait step** follows the restart `When`, because the only
  listing wait is a `Given` in a frozen module. Alternative: a parent line for a
  `When` form in the frozen module.
- **P3-DC-77 (Low): the kept `companion-missing` info scenarios' setup reads
  `which did not fail`** (a stdio install under built-in no longer warns).
- **P3-DC-78 (Low): a partially-installed row carries its MCP dependency even
  when an implementation runs every server**, so an lsp-degraded plugin with a
  stdio server reads `{lsp, requires mcp}` with no implementation active.
  Alternative: carry it only when the MCP kind is unsupported.
- **P3-DC-79 (Low): "split" names an empty `runEvery`.**
- **P3-DC-80 (Low): feature descriptions longer than the two or three lines
  the cucumber rules ask for** (verdict-markers 6, companion-missing 8,
  verdict-list 4); `check:features` does not count them.
- **P3-DC-81 (Low): the 03-04 executor ran pre-commit with
  `SKIP=npm-check,trufflehog`** because its worktree guard refused the
  `env -u` form; the orchestrator re-ran trufflehog on the merged files (it
  reports Skipped for file runs).

### Wave 4 (03-05 install consent, 03-06 update consent and neutral writes, 03-07 reconcile and AMIG-01, 03-08 `requires:` line)

- **P3-DC-82 (Medium): `summary.resolved` from `toInstallLedgerSummary` is now
  the active view** for every consumer (03-05). Alternative: a separate member
  for the active view.
- **P3-DC-83 (Medium): the enable, update, and apply switch scenarios use a
  fresh built-in Pi** (install under the adapter-profile Pi, act from a Pi that
  runs Pi's built-in MCP), as 03-01 did, because the restart without
  pi-mcp-adapter lands on no implementation where an sse verdict does not
  change. One load-row scenario turns built-in off in settings, then restarts
  with it on.
- **P3-DC-84 (Low): a second `requirePartialInstallable` on the neutral
  resolution narrows the type only.**
- **P3-DC-85 (Low): hand-built test options pass `consentView: "none"`.**
- **P3-DC-86 (Low): the enable cascade member row stays `installed
  {dependency enabled, requires pi-mcp-adapter}` under built-in** for an sse
  member (that row never followed its resolution's status).
- **P3-DC-87 (Medium): 03-06 edits Phase 1's record writers**
  (`applyAllSuccessRecordFields`, `markUpdateInProgress`,
  `refreshDisabledRecord`/`nextDisabledPin`) in the narrowest diff (P3-DC-02).
- **P3-DC-88 (Low): `update-swap.ts` imports `mcp-verdict-read.ts`; fallow
  reports no cycle** (a later import from `install-outcome.ts` into the update
  family would close one).
- **P3-DC-89 (Low): autoupdate with no command notification reads
  `mcpImplementation ?? "none"`.**
- **P3-DC-90 (Low): `newlyDegraded` is read at swap start**, before the swap
  writes.
- **P3-DC-91 (Low): a missing marketplace in the prepared update state throws
  marketplace-removed** (defensive; the preflight rules it out).
- **P3-DC-92 (Low): existing update fixtures name `mcpImplementation: "none"`.**
- **P3-DC-93 (Low): a `--partial` update under built-in is now a warning row**
  (the `requires pi-mcp-adapter` marker raises warning); it was info.
- **P3-DC-94 (Medium): apply holds more moves**: a record already partial for
  one kind is held when the candidate drops a new kind (D-12 moved it before).
  Alternative: ask only when the record is installable.
- **P3-DC-95 (Medium): AMIG-01 converts every moving legacy record to the
  neutral basis**, so the first reload after an upgrade writes `state.json`
  even for a plain stdio move. Alternative: write only when the verdict
  differs (leaves a bare-elicitation record installable under the adapter).
- **P3-DC-96 (Low): `applyNeutralVerdict` passes the record with its basis**,
  so an already-neutral record's stored `mcpServers` kind stays a block even if
  the source no longer declares a blocked server.
- **P3-DC-97 (Low): the migration suite's default record carries the neutral
  basis**; a `legacyPluginRecord` covers legacy records.
- **P3-DC-98 (Low): `applyDroppedServers` renamed `applyNeutralVerdict`.**
- **P3-DC-99 (Low): `read-pass.test.ts` has only compile-forced edits.**
- **P3-DC-100 (Medium): the second `companion-missing` info scenario installs
  while pi-mcp-adapter is active** (the world allows one profile Pi per
  scenario), so it proves only that a loaded adapter gives an untagged `mcp`.
- **P3-DC-101 (Low): the e2e foreign-tool case turns Pi's built-in MCP off**,
  so it no longer shows a foreign `mcp` tool beside the built-in command.
- **P3-DC-102 (Low): `mcpDependencyOf` reads every declared server**, so an sse
  plus stdio plugin under built-in reads `requires: pi-mcp-adapter (missing)`
  (D-P3-08 intent).
- **P3-DC-103 (Low): a not-installed sse plugin under built-in now shows
  `requires: pi-mcp-adapter (missing)`**, where it had no requires line.
- **P3-DC-104 (Medium, orchestrator fix after the merge): apply's catalog move
  now carries the run's implementation** (`PluginConvergeTarget.mcpImplementation`,
  commit 1178bd7), so a move to an sse version under built-in reports
  `partially-installed {unsupported mcp, requires pi-mcp-adapter}` instead of
  `updated {requires pi-mcp-adapter}`; 03-06 had left the runner on the
  neutral view because the target type lived in 03-07's files.

### Wave 5 (03-09, milestone merge and phase gate)

- **P3-DC-105 (Low): the 03-09 executor's commits name its own session in
  the `Claude-Session` trailer** (`session_01EDUMG5p4jHecGXqAFGi3Do`, the
  harness attribution) instead of the brief's
  `session_01EDUMG7S9uXh4o5dikBwum8`; every other commit of the phase uses the
  brief's. History is not rewritten.
- **P3-DC-106 (Low): `invalid-configs.feature` keeps `@adapter-only` on its
  two tool-call scenarios and adds `@builtin-only` twins** proving the skipped
  server through `pi lists these registered mcp servers:` (that frozen step
  lists nothing under pi-mcp-adapter). D-P3-18 asked for `@mcp`.
- **P3-DC-107 (Low): STATE.md frontmatter counters combined by hand** at the
  merge (the orchestrator recomputes them).
- **P3-DC-108 (Low): the merge commit body says `companion-missing.feature`
  took the milestone's `not loaded`; eb4ebf7 restores `status unknown`**,
  because our rewritten scenario turns Pi's built-in MCP off. The parent's
  d1711fd expectation is deliberately not re-applied there.
- **P3-DC-109 (Low): Phase 4's `installGrantedAgent` test helper passes the
  run's implementation as `consentView`** (compile-forced at the merge).
- **P3-DC-110 (Low): Phase 2's `builtin-status.feature` `plugin requires`
  cells (seven) now read `[{"companion":"mcp","missing":false}]`** under our
  `requires:` rule (state rows are Phase 3's).
- **P3-DC-111 (Low): the orchestrator's own phase gate on the merged tree
  (e6eb687 plus docs) had one adapter failure, Phase 2's
  `lifecycle.feature:396` "A new session offers the plugin's tool again"
  (seed 115524, the listing after a new session under load)**; it passed 4 of 4
  alone and the full adapter rerun passed 1599/1599 (seed 888709), so it is
  recorded as a load flake, not a Phase 3 regression. Every other part was
  green: static, unpaired, integration, builtin 128/128, direct coverage, and
  the whole `test:modules`. The full gate stands in for GSD's regression gate.

## Code review and fix (2026-11-04)

The review (03-REVIEW.md) found 1 critical, 3 warnings, 3 info. The
orchestrator decided each finding before the fix:

- **P3-DC-112 (Medium): review decisions.** CR-01 fixed (the no-trace
  shortcut only for records without a basis; AMIG-01 writes the server
  configs). WR-01 fixed (an unreadable record never holds a move or flags
  `newlyDegraded` because of MCP alone). WR-02 fixed for cascades only:
  dependency moves ask only for a new degrade under the active implementation;
  a plain user-run `update` keeps today's rules, as D-P3-12 and D-MB-06 allow.
  WR-03: the `pending` preview no longer promises a partial install that
  `apply` refuses. IN-03 skipped (P3-DC-91). Alternatives: make a user-run
  update also ask only for a new degrade; let `apply` install the sse plugin
  partially (contradicts P3-DC-20).
- **P3-DC-113 (Medium): no cucumber scenario for CR-01 or WR-01**; no step
  seeds a released-build legacy record, AMIG-01 never had a scenario, and
  scenarios must not read bridge-written files. Unit and integration cases
  carry the proof.
- **P3-DC-114 (Low): WR-01's rule is narrower than the decision**: an
  unreadable record's `mcpServers` drop is excused only when the candidate's
  neutral resolution does not drop it too, so a newly added ws server still
  asks.
- **P3-DC-115 (Low): an excused WR-01 record moves with `partial: true`.**
- **P3-DC-116 (Low): WR-02 uses an injected, lazily read port**
  (`readRecordDegradeBaseline`), set only by `dependency-move.ts`.
- **P3-DC-117 (Medium): WR-03 previews `(will install)` for an sse plugin
  under built-in that `apply` refuses**; a new `@builtin-only` scenario pins
  apply's `(failed) {unsupported mcp}` row. Alternatives: preview a failed row
  (changes the pending tally); have apply pass `partial: true`. A kind every
  implementation drops (lsp, ws) still previews `(will partially install)` and
  apply still refuses it (predates Phase 3; FSTAT-06 and the frozen catalog).
- **P3-DC-118 (Low): the agreeing pending twins fold into one `@mcp`
  scenario.**
- **P3-DC-119 (Low): CR-01 writes server configs only when the migration
  rewrites the verdict or basis.**
- **P3-DC-120 (Low): IN-01 rewords four switch-scenario titles** instead of
  adding an explicit adapter Pi.
- **P3-DC-121 (Low): IN-02's style-guide rule lists reinstall rows too**
  (`reinstall.messaging.ts` calls `companionSeverity`).

### Review iteration 2 (2026-11-04)

The re-review found three new issues from the fixes (WR-04, WR-05, IN-04)
and kept WR-03 open.

- **P3-DC-122 (Medium): WR-03 decision reversed to D-P3-15's literal text.**
  `pending` previews a declared fresh install under the active implementation
  again (an sse plugin under built-in previews `(will install)` with
  `partial: true`), while `apply` refuses that install (`(failed)
  {unsupported mcp}`). The mismatch predates Phase 3 for every partially
  available kind; it is accepted here with a BACKLOG parent line ("apply
  refuses a declared install pending previews as will partially install;
  choose one behavior for both"). Supersedes P3-DC-117. Alternatives: preview
  the neutral view (iteration 1); let apply install partially.
- **P3-DC-123 (Low): WR-04: an unreadable legacy record (no basis) read
  under the adapter counts as readable**, so its new drops are not excused;
  under built-in or none the excuse stays.
- **P3-DC-124 (Medium): WR-05: AMIG-01 writes the verdict, basis, configs, and
  bundle flag only from the recorded version's servers** (through the frozen
  `recordedMcpServers`, which refuses `version-mismatch`); otherwise the record
  stays fully legacy (adapter verdict, no basis, no configs), while staging
  keeps using the current checkout (reinstall parity). Alternative: a separate
  version check on the migration's resolve (misses tag-pinned path sources).
- **P3-DC-125 (Low): an existing AMIG-01 integration test deletes the install's
  `mcpServerConfigs` before the reload** so its record looks like a released
  build's.
- **P3-DC-126 (Low): IN-04: a dependency move admits a candidate without
  `--partial` only when it drops `mcpServers` alone**; any other dropped kind
  keeps the `--partial` rule, even one the record already drops (no scenario,
  it restores the earlier behavior).
- **P3-DC-127 (Low): `03-REVIEW-FIX.md` lists iteration 2 first** and keeps
  iteration 1's outcomes under an `iteration_1:` key.
