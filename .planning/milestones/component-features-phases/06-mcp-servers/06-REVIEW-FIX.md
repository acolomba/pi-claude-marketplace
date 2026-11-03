---
phase: 06-mcp-servers
fixed_at: 2026-11-01T18:49:23Z
review_path: .planning/phases/06-mcp-servers/06-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 7
skipped: 2
status: partial
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-11-01T18:49:23Z
**Source review:** .planning/phases/06-mcp-servers/06-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 9 (WR-01..WR-08, plus IN-06 by orchestrator direction)
- Fixed: 7 (WR-03, WR-04, WR-05, WR-06, WR-07, WR-08, IN-06)
- Skipped: 2 (WR-01, WR-02: skipped (documented), by orchestrator direction)

Every fix ran in the main checkout `/home/user/pi-claude-marketplace` on
`features/component-features-phase-6`, with no worktree. Each commit's hook ran
`npm run check:commit` in that checkout and passed. All the commands ran
through the `nondac-sh` wrapper. The numbers below can be reproduced from this
tree.

## Fixed Issues

### WR-03: The file-source catch-alls swallow every error class

**Files modified:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts`, `test/domain/mcp-resolution.test.ts`, `test/domain/plugin-resolver.test.ts`, `docs/mcp-compatibility.md`
**Commit:** 1565b7f
**Status:** fixed: requires human verification (error-classification logic)
**Applied fix:** Both catch sites now go through one helper,
`fileSystemFailureDetail`. It returns the message of an `Error` that carries a
Node `code`, and it rethrows anything else: a `TypeError` with no code from a
defect, or a non-`Error` rejection. The `JSON.parse` call is now separate from
the stat and the read (`readServerFileText`), so a `SyntaxError` from the parse
is the only error without a code that skips. The new unit cases skip a read
that fails with EMFILE, EIO, or a Node `ERR_INVALID_ARG_VALUE` path error. They
rethrow a non-`Error` value and a `TypeError` with no code, both from a
reference read and from the `.mcp.json` stat. The non-`Error` cases were
skipped before, and D-CF6-02 does not require skipping them, so they now
propagate. The plugin-resolver test that Phase 6 had flipped to "skips a
standalone .mcp.json whose read rejects with a non-Error" is restored,
byte-identical, to its pre-Phase-6 form, "resolveStrict propagates a non-Error
standalone mcp read rejection". `npm run test:coverage:direct --
extensions/pi-claude-marketplace/domain/mcp-resolution.ts` reports 100%
(branches 86/86, functions 20/20, lines 369/369).
**Transient errors, decided by upstream:** the `mit` loader in Claude Code
2.1.316 runs `try{w=await h.readFile(y,…)}catch(G){if(z(G))return null;return
t(S(\`Failed to load MCP servers from ${y}: ${G}\`),{level:"error"}),null}`. So
it returns no servers for every failure of its read: silently for the `z(G)`
class, and with an error-level debug line for the others. So EMFILE, EIO, and
the rest keep being skipped, and the doc now says so.
**No cucumber scenario:** in production the dependencies are `fs.stat` and
`fs.readFile`, which throw only errors that carry a code. So no `/claude:plugin`
behavior a user can see changes.

### WR-04: The AMIG-01 notice says the plugin "no longer declares" a server it still declares

**Files modified:** `test/integration/mcp-migration.test.ts`
**Commit:** 990c107
**Applied fix:** As directed, the product message is unchanged and the test
still pins the real behavior. A one-line comment at the expected line says the
reconcile wording is imprecise for a server that was skipped as malformed. The
wording change belongs to reconcile, so it is a parent line below.

### WR-05: The WLIF-01 "undo before the workflows phase ran" test cannot reach the branch it names

**Files modified:** `test/orchestrators/plugin/install-flow-ledger.test.ts`
**Commit:** e7c68d9
**Applied fix:** The test cannot be made to reach that branch. Under TR-02, the
workflows undo runs only for a phase that started. A failure after the
workflows phase runs the undo with `workflowsPrep` already set, so the early
return can be reached only through a failure inside the workflows phase's own
`do`. The existing case "WLIF-01: a workflows prepare failure leaves the undo
with nothing to remove" already does that. Mocking the prepare in this test
would only duplicate that case. So the edit stays inside the test: it is
retitled "WLIF-01: a plugin refused for an inline malformed MCP server saves no
workflow", and its arrange comment now says what the test proves. The comment
also points to the prepare-failure case that reaches the early return. The
branch is still covered, so there is no coverage gap and no parent line.

### WR-06: The loopback HTTP stand-in poisons its log chain on one bad request

**Files modified:** `features/lib/mcp-server-http.ts`
**Commit:** 08ac5c1 (together with IN-06)
**Applied fix:** `parseMessage` now returns `undefined` for a body that holds no
JSON-RPC object (text that is not JSON, a batch array, `null`). The server logs
the request and answers it with `400` and a JSON-RPC parse error. The log chain
keeps going after a failed append (`entry.then(ok, ok)`). The request handler
catches the rejection of `answer`, so no rejection goes unhandled. A request
that the server received whole and then failed to answer gets `500`, and
`close()` rejects with an `AggregateError` of those failures. A request that
the client cut off mid-body (`!request.complete`) is not a failure, because the
release's `closeAllConnections` does exactly that. For a non-POST request the
server drains the body with `resume()` instead of reading it into a promise
that nobody awaits. A POST body that rejects before the chain reaches it gets a
handler attached at once. Checked with scratch probes:

- Bad bodies get `400` and later requests still log in order (`POST,POST,POST,tools/list,GET`).
- With the harness directory missing, each append failure answers `500`, and `close` rejects with 2 errors.
- A client that aborted mid-body is not counted.
- No unhandled rejection occurs.

`features/mcp-server/configuration.feature`, which uses the server, passed 3
times (seeds 502111, 74251, 976368; 10/10 scenarios each).

### IN-06: `McpHttpServer.start` never rejects when `listen` fails

**Files modified:** `features/lib/mcp-server-http.ts`
**Commit:** 08ac5c1 (together with WR-06)
**Applied fix:** `start` sets `server.once("error", reject)` around `listen`
and removes that listener in the listen callback. A scratch probe that emits a
listen error now rejects `start` with the error.

### WR-07: Two absence checks depend on the registry probe winning a race

**Files modified:** `features/mcp-server/sources.feature`, `features/mcp-server/invalid-configs.feature`
**Commit:** 28af4fa
**Applied fix:** Both scenarios used the registry steps, "With a plugin.json,
the marketplace entry's servers are ignored" and the Outline "A broken MCP
config file contributes no server and the plugin's other sources still load"
(all four rows, including "readable by nobody"). They now script one
`mcp({})` call and compare its whole status text, using existing steps.
pi-mcp-adapter builds that text from its config, so a server the bridge wrote
shows up whatever the connection timing is. The registry steps stay in use in
`listing.feature`.
**Red proof (seed 846205):** I made two temporary regressions, reverted with
`git checkout --` before the commit. The first read the entry's `mcpServers`
next to a `plugin.json`. The second left the "readable by nobody" file
readable. Both scenarios failed on `MCP: 0/2 servers, 2 tools`, listing
`plugin_demo_d_` or `plugin_demo_hidden_`.
**Green, 3 runs each:** `sources.feature` seeds 32045, 246188, 643757 (6/6
scenarios each). `invalid-configs.feature` seeds 678377, 823812, 437938 (8/8
scenarios each).

### WR-08: The override-survives-update scenario cannot tell "choice kept across a rewrite" from "entry never rewritten"

**Files modified:** `features/mcp-server/lifecycle.feature`
**Commit:** c6d618e
**Applied fix:** The 1.1.0 publication in "A user's disabled choice for a
plugin server survives an update" now also changes the server's `STUB_TAG` to
`v2`, as the "Updating a plugin replaces its server" scenario does. The update
must therefore rewrite the entry. The title is unchanged, because
`06-06-SUMMARY.md` references it as an anchor.
**Red proof:** I dropped `...carriedFields(input.previous[name], ...)` from
`stampServers` for the run, then reverted it. The scenario failed, and the call
reached the rewritten server: `v2:echo:ping` (seed 550427). The old,
version-only form also fails under the same mutation (seed 824036). So today's
update does rewrite an unchanged entry, and the old scenario did exercise the
carry-over. Only nothing in the scenario required the rewrite.
**Green, 3 runs:** seeds 370946, 9679, 267522 (8/8 scenarios each).

## Skipped Issues

### WR-01: The root `.mcp.json` is read through symlinks with no containment

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:320`
**Reason:** skipped (documented). As directed, the resolver behavior is
unchanged. The research shows the current behavior is upstream parity. I
recorded it in `docs/mcp-compatibility.md` ("Server sources" and a Divergences
item) and added a comment at the `.mcp.json` read (commit afc5ca4).
**Upstream evidence (Claude Code 2.1.316, sandboxed probe on 2026-11-01:
`env -i`, HOME and `CLAUDE_CONFIG_DIR` inside an `mktemp -d` tree, local
fixtures only):**

- A plugin of a local directory marketplace is read in place. `plugin list`
  shows `Read from: <marketplace>/plugins/<name>`. A root `.mcp.json` that
  links to a file outside the marketplace loads (`plugin:out:outsrv`). After I
  edited the link's target, the next `mcp list` showed the new server name
  (`outsrv2`), so the file is read through the link at load.
- A git plugin (`url` source) keeps its links as cloned in
  `plugins/cache/<mk>/<plugin>/<sha>/`. A root `.mcp.json` that is an absolute
  link outside the clone loads (`plugin:ga:gasrv`).
- In the binary, the `mit` loader reads with a plain `readFile`. `confine`
  (`Kbt`, realpath containment) applies only to directory-loaded project
  plugins (`mY`: `scope==="project"` and a source ending in `@<builtin
  marketplace>`).
- Confidence: high for the two probed cases. The probe did not cover a
  hosted-manifest or github-source marketplace.

**Original issue:** `resolveStrictMcp` reads `<pluginRoot>/.mcp.json` through
`fs.stat` and `readFile`, which follow links, while a reference is held to
`assertPathInside`.

### WR-02: A symlinked reference inside the plugin root is fatal

**File:** `extensions/pi-claude-marketplace/domain/mcp-resolution.ts:186-191`; `docs/mcp-compatibility.md:236-242`
**Reason:** skipped (documented). As directed, the resolver behavior is
unchanged. The refusal is now a Divergences item in `docs/mcp-compatibility.md`
licensed by MCPR-04, which applies the D-14 refusal of every symbolic link to
`mcpServers` reference paths (recorded in `.planning/PROJECT.md`, v1.14
mcp-string-refs), and by NFR-10. "Server sources" and "Invalid server configs"
also state it (commit afc5ca4).
**Upstream evidence (same probe):** Claude Code follows the link in every
probed case:

- an in-root reference link in a directory plugin (`plugin:inl:inlsrv`) and in a git plugin (`plugin:gi:gisrv`);
- a reference link outside the marketplace (`plugin:refout:refoutsrv`);
- a root link into the marketplace (`plugin:mkin:mkinsrv`).

One caveat for `gi`: my first fixture gave it the same command line as `inl`,
and the debug log showed upstream suppressing `plugin:gi:gisrv` as a duplicate
of `plugin:inl:inlsrv`. That already proves the read went through the link. I
then fixed the cached copy's args, and the server listed. I did not change the
note text, which says "escapes plugin root" for an in-root link. That is a
resolver message, and the orchestrator said not to change resolver behavior. It
is a parent line below.
**Original issue:** `SymlinkRefusedError` extends `PathContainmentError`, so an
in-root link is reported as an escape and the plugin becomes `(unavailable)
{malformed mcp}`, which the doc did not say.

## Parent lines

- **Reconcile AMIG-01 wording (WR-04):** the move reports `<server> (<plugin>)
  [<scope>] <plugin> no longer declares it.` for a server that the plugin still
  declares in a file source but that the resolver skipped as malformed
  (D-CF6-02). Reconcile owns that message. Suggest one of two changes: report
  such a server under the existing `malformed mcp` reason, or word the line so
  it does not say the plugin dropped the server. Change
  `test/integration/mcp-migration.test.ts` (the commented expected line) and
  `docs/mcp-compatibility.md` "Entries that the move removes" at the same time.
- **Link rule for MCP files (WR-01, WR-02), needs a user decision:** the root
  `.mcp.json` follows links anywhere, which is upstream parity (measured). An
  `mcpServers` reference refuses any link, even inside the root (MCPR-04/D-14,
  NFR-10), where upstream follows it. The options are:
  1. Keep both as documented.
  2. Let references follow links that resolve inside the plugin root, which is
     parity and needs MCPR-04 amended.
  3. Contain the root `.mcp.json` too, for example with the realpath boundary
     of D-PL2-17/D-PL2-24. That is a new divergence and needs its own license.

  Separately, the refusal note says `escapes plugin root` for an in-root link.
  `locateReference` could check `error instanceof SymlinkRefusedError` and say
  the path crosses a link.

## Verification

- Every commit: `npm run check:commit` passed in the commit hook (main
  checkout).
- The changed feature files passed 3 times each (seeds above), and
  `configuration.feature` passed 3 times for the changed stand-in.
- Unit owners touched: `test/domain/mcp-resolution.test.ts` (direct coverage
  100%), `test/domain/plugin-resolver.test.ts`, the reconcile, install, info,
  update-preflight, enable-disable, list-flow, and install-flow-ledger tests,
  `test/architecture/manifest-read-agreement.test.ts`, and the AMIG-01
  integration case. All of them pass.
- Full gate: `npm run check` in the main checkout at the final fix commit
  (c6d618e) passed, exit 0. Every static check passed, and so did
  `test:unpaired` and `test:integration`. `test:cucumber` passed 1268/1268
  scenarios (seed 154136). `test:coverage:direct:all` passed, with the merged
  LCOV at 318 records. The two `Legacy marketplace migration could not be
  persisted` lines are the sanctioned IL-3 warning that tests trigger on
  purpose.

---

_Fixed: 2026-11-01T18:49:23Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Dubious Choices

1. **WR-03 predicate width:** an error is skipped if it is any `Error` that carries a Node `code`, including Node's `ERR_*` path errors such as `ERR_INVALID_ARG_VALUE` for a NUL byte. The review's fix used an allowlist of errno names instead. I chose the wider rule because upstream's `mit` skips every `readFile` failure. Errors without a code, and non-`Error` values, now propagate.
2. **WR-03 untested rethrow site:** the rethrow in `locateReference` has no case of its own. It shares the covered helper, and the real path guard throws only coded errors or containment errors, so no test can drive it without injecting the guard (IN-07, which was left as is).
3. **WR-03 restored test:** I restored the pre-Phase-6 form of the plugin-resolver test, which is a file Phase 6 does not own. The change stays within the D-CF6-02 rule that a `git diff` criterion limits ("tests outside ownership that pin the old behavior").
4. **WR-06 failure policy:** a bad POST body is answered `400` and logged. It shows as a bare `POST` row in the request table, but it does not fail the release. An append or answer failure rejects `close()`. A client abort mid-body is ignored.
5. **WR-05 approach:** I corrected the title and comment instead of mocking `prepareWorkflowsStaging`, because an existing case already reaches the early return.
6. **WR-08 title kept:** I left the scenario title unchanged so the `06-06-SUMMARY.md` anchor still resolves. The arrange alone makes the scenario discriminate.
7. **WR-01/WR-02 evidence scope:** the doc's upstream claims rest on one sandbox probe (a directory marketplace and `file://` url plugins) plus binary strings. Hosted and github marketplaces were not probed. For `gi`, I fixed the fixture by editing the cached copy in place. The debug log had already shown the read through the link.
8. **WR-01 comment in product code:** I added a three-line comment at the `.mcp.json` read. It changes no behavior and corrects the module's stated containment rule (T-06-07).
