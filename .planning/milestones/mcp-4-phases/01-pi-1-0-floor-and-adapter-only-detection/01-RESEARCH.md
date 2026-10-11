# Phase 1: Pi 1.0 floor and adapter-only detection - Research

**Researched:** 2026-10-02
**Domain:** Pi extension host floor bump, companion-extension detection, closed-catalog marker rename, live canaries
**Confidence:** HIGH (every load-bearing claim was read from the tree, from the installed Pi 1.0.0 / adapter 5.0.0 / engine 3.13.1 packages, or observed in a scratch run on real Pi 1.0.0)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decision IDs below are milestone-scoped. v1.20 Phase 1 already cites
`D-01-07`, `D-01-32` and others in source, so source comments written in this
phase cite the requirement ID (`ADET-01`, `PIFL-04`, ...) instead of a
`D-01-NN` ID.

#### Missing-adapter marker
- **D-01-01:** The MCP soft-dependency marker is renamed from
  `{requires pi-mcp}` to `{requires pi-mcp-adapter}`. Pi 1.0 depends on
  `@earendil-works/pi-mcp@^1.0.0` ("Standalone Model Context Protocol client
  for pi"), so the old token names a package every Pi 1.0 user already has. The
  new token names the package to install, like `{requires pi-subagents}` and
  `{requires pi-dynamic-workflows}`. This is a closed-catalog amendment: the
  `Reason` union in `shared/notification-types.ts`, the grammar and
  soft-dep concern, `docs/output-catalog.md`, `docs/messaging-style-guide.md`,
  the ADR v2-001 note, `docs/workflows-compatibility.md`, and every test that
  pins the token. Marker order inside the brace (`agents`, `mcp`, `workflows`)
  does not change. — **Reversibility:** costly — about 40 source and test files
  plus four docs pin the token; reverting repeats the catalog amendment.
- **D-01-02:** Tests pin the full token, closing brace included. Today's
  substring `"{requires pi-mcp"` (no closing brace) also matches
  `{requires pi-mcp-adapter}`, so a positive assertion would pass on either
  token and verify nothing.
- **D-01-03:** The marker is the same whether or not Pi's built-in MCP is
  active. No built-in probe feeds the renderer and no second token exists.
- **D-01-04:** The README soft-dependency paragraph says, in this phase, that
  Pi's built-in MCP does not satisfy the requirement. It is the same paragraph
  PIFL-03 edits for the adapter floor and the `pi-ai` peer gap.

#### Detection proof
- **D-01-05:** The adapter counts as loaded when `pi.getCommands()` lists an
  `mcp-adapter` command, or when a tool or command `sourceInfo.source` contains
  `pi-mcp-adapter`. A bare tool named `mcp` no longer counts, so a foreign
  extension's `mcp` tool is not mistaken for the adapter. This amends ADET-02's
  text, which said "as well as its tool and source"; REQUIREMENTS.md is
  updated with this context. The house rule stays: a probe arm that throws
  means "not loaded" (a possible false warning, never a false all-clear).
  Guard each arm on its own so a throwing `getCommands()` does not sink the
  source arm. — **Reversibility:** reversible — one probe function and its
  matrix.
- **D-01-06:** The built-in-only negative test (ADET-01) is two layers:
  - A mock matrix (unit plus the e2e soft-dep matrix) that plants the built-in's
    exact tool and command inventory, captured once from a real sandboxed
    Pi 1.0 run (see D-01-14) and cited in the test. States: adapter loaded;
    adapter with `disableProxyTool` and no servers (command only); fork install
    (command present, foreign source); built-in only; neither; a foreign `mcp`
    tool (now "not loaded").
  - A real-Pi RPC test (D-01-14).

#### Canaries (PIFL-07)
- **D-01-07:** "The workflow-engine canary" means both engine canaries:
  `tests/live-uat/workflow-agent-failure-canary.mjs` and
  `tests/live-uat/workflow-storage-canary.mjs`, at engine 3.13.1 with the
  scratch prefix resolving the engine's `pi-coding-agent` peer to 1.0.0. The
  Stop canary (`tests/live-uat/stop-canary.mjs`) runs on Pi 1.0 with the keyless
  stub provider.
- **D-01-08:** If a canary fails on Pi 1.0 for a reason outside this
  repository's code (Pi or the engine), record the failing run verbatim in
  `tests/live-uat/README.md` as Pi 1.0 evidence, file a BACKLOG entry (and a
  ledger entry if it is a broken window) naming the upstream issue, limit the
  docs' verified claim to the last passing version, and amend PIFL-07 to match.
  The phase still closes. A failure our code causes gets fixed, not recorded.
- **D-01-09:** The executor runs every canary: a scratch
  `npm install --prefix` outside the repository, `PI_CODING_AGENT_DIR` under
  `tmp/pi-uat`, the stub provider for the Stop canary, and each canary's
  negative control. Verbatim output goes into the README "Observed result"
  sections and replaces the 0.99.2 evidence that `4f82096f` carried. The
  verifier checks the recorded runs. No `human_needed` checkpoint.
- **D-01-10:** `docs/workflows-compatibility.md` is re-graded for 3.13.1.
  Runtime-measured claims move to 3.13.1 from the new canary runs. A
  source-read claim is stamped "unchanged at 3.13.1" only after its cited body
  is diffed from 3.13.0 to 3.13.1. The known diff is
  `installHostCreateAgentSession()` plus provider-error preservation, so most
  bodies should be byte-identical. A body that changed keeps its 3.13.0 stamp
  and the change is described.

#### features/mcp carry-over
- **D-01-11:** The Stop canary port treats `4f82096f`, `0febc4ea`, `4460d902`
  and `e0ccc16e` as one specification, re-implemented against the current tree
  (`0febc4ea` restores the README engine-canary sections that `4f82096f`
  deleted). It also closes features/mcp Phase 1 findings IN-01 (stale
  "cap loop needs interactive drive" wording), IN-08 (read the child's exit
  status, do not infer it from `!run.timedOut`), IN-09 (the "timed out at the
  cap" row must not name a cause the observation does not prove) and IN-10
  (a proven regression must exit with a code distinct from the expected
  headless result).
- **D-01-12:** The pi-subagents peer-test port (`5b1d8ef6`, `dac3a245`,
  `69e0870a`, floor `0.74.0`) also closes IN-05 (a gate ties the test floor
  constant to `package.json`'s `pi-subagents` peer), IN-06 (`isBelowPeerFloor`
  treats a prerelease of the floor as below it), IN-07 (an explicit
  `PI_SUBAGENTS_ROOT` that names nothing, or the wrong package, fails loudly
  instead of reading as "not installed"), IN-02 (stale pi-subagents facts in
  comments) and IN-04 (one shared loader instead of two copies). The floor is
  proven with zero skips against 0.74.0 through `PI_SUBAGENTS_ROOT`, never by a
  green default run (locally the global install is 0.47.1, so the default run
  skips by design).
- **D-01-13:** IN-03: the `toolInfo` fixture becomes one shared test seed
  instead of three copies, so the next `ToolInfo` change touches one place. It
  also carries the `exposure: "direct"` field that Pi 1.0's `ToolInfo`
  requires.
- **D-01-14:** The RPC harness (`tests/e2e/_rpc.ts`, features/mcp `4c6b8086`,
  `cdb490c9`, `8016fed7`) is ported with features/mcp Phase 2 review fixes
  IN-04 (a sandbox location that does not exist yet fails with a clear error,
  not a raw `ENOENT`) and IN-05 (the normal-exit path sweeps Pi's process
  group). Its consumer is a port of `tests/e2e/builtin-mcp-rpc.test.ts` with the
  semantics inverted. Built-in only and neither: rows carry
  `{requires pi-mcp-adapter}`. A fixture extension that registers an
  `mcp-adapter` command: no marker. No real adapter is installed, so
  pi-mcp-adapter stays out of devDependencies. The same run captures the
  built-in's live tool and command inventory for D-01-06's mock matrix. Also
  apply features/mcp Phase 2 IN-02 (rename `ToolInventory` now that it covers
  slash commands) and IN-03 (a catalog sentence that says "both" soft-dependency
  flags when there are three). Skip Phase 2 IN-01: it cites requirement IDs of
  the abandoned design.
- **D-01-15:** The OpenAI-compatible stub server lives at
  `tests/live-uat/openai-stub-server.mjs`, with the same
  `fallow-ignore-file unused-file` marker and justification as the four live-UAT
  drivers. The README's prerequisites point at that path. No spike directory
  named after the abandoned milestone is created.

#### Locked by requirements (recorded for the planner, not re-discussed)
- **D-01-16:** `engines.node` becomes `^22.22.2 || ^24.15.0 || >=26.0.0`, the
  exact range `write-file-atomic@8` declares. It already sits inside Pi 1.0's
  `>=22.19.0`, so it is the floor both actually require (PIFL-06). NFR-4 says
  the same in `AGENTS.md` and `.planning/PROJECT.md`.
- **D-01-17:** `typescript-eslint`'s new `no-unsafe-enum-assignment` finding at
  `shared/notify-context.ts:345:30` is fixed in code, not disabled (PIFL-05).
  Research reads it as a likely false positive of a brand-new rule (the message
  names an empty enum), so the fix should make the computed access plainly
  non-enum rather than suppress the rule.

### Claude's Discretion
- Plan split and wave order, with one constraint: contract pins move once.
  Detection lives in `platform/pi-api.ts` beside the two `types.d.ts` pins
  (`pi-api.ts:100:3`, `:108:3`), so pin re-derivation and the detection change
  are sequenced to touch the pins file once, after Prettier has run (Prettier
  moves pins).
- The name `ToolInventory` takes after the rename (D-01-14).
- How the IN-05 gate reads `package.json` (architecture test vs a shared
  constant), as long as it fails on drift.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PIFL-01 | Pi peer `>=1.0.0`, dev `^1.0.0` for pi-coding-agent and pi-tui, FLOOR-01 pins the new literal | §Standard Stack (versions re-verified 2026-10-02); §Pattern 1 (one commit: bump + contracts re-pin); FLOOR-01 site `tests/architecture/peer-floor.test.ts:19,25` |
| PIFL-02 | pi-subagents optional peer `>=0.74.0`; both peer integration tests run with zero skips via `PI_SUBAGENTS_ROOT` | §Pattern 6 (shared loader + `semver`); IN-04..IN-07 fix targets |
| PIFL-03 | pi-mcp-adapter `>=5.0.0` optional peer, never a devDependency; README states floor + `pi-ai` gap | §Pattern 7 (README paragraph); §Validation (peer-floor gate asserts absence from devDependencies and from the lock) |
| PIFL-04 | 74162ca6/5b1d8ef6/dac3a245/69e0870a re-implemented at 1.0, contract pins re-derived | §Pattern 1, §Pattern 5 (toolInfo seed), §Pitfall 1-3 (pin mechanics, measured) |
| PIFL-05 | devDeps at latest except TS `^6.0.3`; `no-unsafe-enum-assignment` fixed in code; fallow `lint.yml` SHA | §Pattern 2 (verified fix + pin move); §Standard Stack |
| PIFL-06 | `engines.node` = `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`; NFR-4 amended in AGENTS.md and PROJECT.md | §Pattern 8 (every NFR-4 / `>=20.19.0` site enumerated) |
| PIFL-07 | Stop canary + both engine canaries pass live on Pi 1.0 / engine 3.13.1; `scripts/pi.sh` pins | §Pattern 9 (run recipes); research pre-runs all passed (§Canary pre-run evidence) |
| ADET-01 | Built-in-only: install, list, info report the MCP component as needing pi-mcp-adapter; built-in-only negative test | §Pattern 3/4 (probe + RPC test); **Open Question 1: `info` renders no soft-dep marker today (observed live)** |
| ADET-02 | Detected via `mcp-adapter` command or `pi-mcp-adapter` source; bare `mcp` tool does not count | §Pattern 3 (probe incl. Pi's `mcp-adapter:N` collision suffix, observed live) |
</phase_requirements>

## Project Constraints (from AGENTS.md / CLAUDE.md)

- Never commit to `main`; branch `features/mcp-4`. Conventional Commits, title 5-72 chars, body lines <= 80, no GSD milestone/phase mentions in commit messages.
- Run `pre-commit run --files <changed>` (or `--all-files` before push) **before** `git commit`; never `--no-verify`; never amend after a failed hook. In a worktree prefix commits with `SKIP=trufflehog`.
- No rebase / history rewrite; merge to update.
- TypeScript: read `skills/typescript-google-style-review`, `skills/typescript-comments` for every `.ts`; `skills/typescript-unit-testing{,-review}` for `tests/**/*.ts`.
- Comments cite durable IDs (ADET-01, PIFL-04, RH-4...), never `Phase NN`/`Plan NN`/bare `Pitfall N`, and never narrate removed code ("the former X", "renamed from").
- Build verification per `skills/local-verification/SKILL.md`: focused checks per task; full `npm run check` at phase/merge gates. Any commit touching `package.json`, the lock, `scripts/*.json`, shared test support or `tests/e2e/` makes `check:changed` pick **full** scope (`npm run check` + `test:coverage:direct:all` [+ `test:e2e` when `tests/e2e/` changed]) [VERIFIED: scripts/check-changed.mjs:13-17,147-161].
- Upstream parity is the default; this phase has no Claude Code position (CONTEXT).
- Containment (NFR-10), atomic writes (NFR-1), `/reload` recovery (NFR-2), no telemetry, English only, output only through `ctx.ui.notify` via `shared/notification-dispatch.ts` (IL-2).
- Node `>=20.19.0` (NFR-4) is the constraint this phase **changes** (D-01-16).
- Companions (pi-mcp-adapter, pi-subagents, engine) never in `dependencies`/`devDependencies`/lock (D-98-10, NFR-5); pinned only in `scripts/pi.sh`.
- Fallow gate: `fallow audit --format json --quiet --explain --gate-marker agent` before commit/push.
- Operator landmines: `npm run check` with `TMPDIR` outside `/tmp` **and outside the repository**, unpiped log ending in `CHECK_EXIT`; real-Pi runs need a sandboxed `PI_CODING_AGENT_DIR`; markdown is formatted by mdformat, never Prettier.

## Summary

Pi 1.0.0 is a drop-in for production code (milestone STACK research, re-confirmed: the bumped scratch tree at `/var/tmp/mcp4-rs/lintx` passes `tsc` and `lint:type-members`). The phase is mostly mechanical, but four facts measured this session change how it must be planned:

1. **The `no-unsafe-enum-assignment` fix is solved and it moves a contract pin.** The rule's computed-member handler reports any access whose receiver is a mapped type whose constraint the key is not assignable to; `context.render[row.status as Status]` trips it because the function's `Status` type parameter is not the interface's `Status` parameter. No enum is involved (hence "expected enum ."). Reading the map through a `Readonly<Record<string, unknown>>` local is lint-clean, typecheck-clean, Prettier-clean and passes `notify-context.test.ts`, but it moves the `notify-context.ts:346:29` / `:346:14` type-selection pins to `:346:61` / `:346:46` [VERIFIED: scratch run, `lint:type-members` exit 0 after re-pin]. So the contracts file must change in the same commit as the Pi bump's `types.d.ts` pins (406→525, 414→533).
2. **Detection must accept Pi's collision suffix.** When two extensions register the same command, Pi 1.0 renames them `mcp-adapter:1`, `mcp-adapter:2` [VERIFIED: runner.js resolveRegisteredCommands + live run]. A probe matching `name === "mcp-adapter"` alone reports a doubly-installed adapter (user + project scope) as missing.
3. **The live built-in inventory is captured.** On real Pi 1.0 with one stub stdio server, the built-in registers tool `mcp__stub__echo` (exposure `deferred`, namespace `mcp__stub`, `sourceInfo.source: "builtin"`, `path: "builtin:mcp"`) and command `mcp` (`path: "builtin:mcp"`, `source: "builtin"`); `-builtin:mcp` removes both. Today's probe already marks built-in-only correctly, and a foreign `mcp` tool **suppresses the marker today** (false positive reproduced live) [VERIFIED: /var/tmp/mcp4-rs/rpc/run-*.json].
4. **`info` never renders a soft-dependency marker.** On Pi 1.0 the `info` row for the same plugin is `● mcp-fixture v1.0.0 (installed)` with an `mcp: fixture` component line, in every state; `docs/output-catalog.md` has no `info` state carrying `{requires ...}`. ADET-01 and ROADMAP SC-5 say "install, list **and info**". This is a scope question the planner must resolve with the user before locking plans (Open Question 1).

All three canaries already pass on Pi 1.0.0 / engine 3.13.1 in a scratch copy (Stop: blocks=8, agent_settled=8, turn_start=8, exit 1 via the cap routing; engine agent: A0-A3 PASS; engine storage: W0-W5 both scopes PASS; both `--invert` controls exit 1). D-01-08's failure path is therefore unlikely to be needed. Of the 3.13.0→3.13.1 changes, only `src/errors.ts`, `src/agent.ts`, `src/pi-extension.ts` (one added export line) and four non-cited files changed; every body the compatibility doc stamps "unchanged at 3.13.0" (`workflow.ts`, `saved-commands.ts`, `workflow-saved.ts`, `workflow-paths.ts`, `workflow-tool.ts`, `workflow-capability-contract.ts`, `workflow-manager.ts`, and the `pi-extension.ts` session-start body) is byte-identical at 3.13.1.

**Primary recommendation:** Plan four waves: (1) floor/tooling bump + lint fix + the single contracts re-pin in one commit; (2) probe-count helper + `toolInfo`/inventory seeds (test support only, no pins); (3) detection change + `ToolInventory` rename (≤13-char name) + marker rename with line-count-preserving comment edits and an "unchanged contracts file" acceptance check; (4) RPC harness/test, pi-subagents loader port, Stop-canary port, live canary runs and docs. Resolve Open Question 1 (info marker) before wave 3 is planned.

## Architectural Responsibility Map

This is a Pi extension (no browser/server tiers); the map uses the repository's own layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Adapter detection probe | `platform/pi-api.ts` | — | The only production importer of the Pi API; probes inspect `pi.getAllTools()`/`pi.getCommands()` |
| Marker token (closed `Reason` set) | `shared/notification-types.ts` + `shared/concerns/soft-dep.ts` | `shared/notify-reasons.ts` (`UnsupportedReason` partition, compile-checked) | Renderer computes markers at render time; nothing persisted |
| Marker emission per row | `shared/notification-dispatch.ts` (single probe per emission) | orchestrators stamp `dependencies` + severity | "notify is a dumb renderer": probe is threaded, not re-derived |
| Floor/peer declarations | `package.json` + lock root | `tests/architecture/peer-floor.test.ts` (FLOOR-01) | Gate reads both |
| Upstream type-member pins | `scripts/check-unused-type-members.contracts.json` | `npm run lint:type-members` | line:col pins into installed `types.d.ts` and local files |
| Real-Pi proof | `tests/e2e/_rpc.ts` + RPC test | `tests/platform/hermetic-environment.ts`, `tests/pi-runtime.ts` | `ctx.ui.notify` prints nothing in print/json mode; RPC forwards it |
| Live canaries | `tests/live-uat/*.mjs` (operator-run) | `tests/live-uat/README.md` evidence | Not part of `npm run check` |
| Launcher pins | `scripts/pi.sh` `pi_cm_pins` | — | Companions pinned only here (D-98-10) |

## Standard Stack

### Core (versions re-read from the npm registry 2026-10-02)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@earendil-works/pi-coding-agent` | peer `>=1.0.0`, dev `^1.0.0` (1.0.0, published 2026-10-01T19:15Z) | Host API | Milestone baseline; `engines.node >=22.19.0` [VERIFIED: npm registry + installed package.json] |
| `@earendil-works/pi-tui` | peer `*` (unchanged), dev `^1.0.0` (1.0.0, 2026-10-01T19:11Z) | `AutocompleteProvider` type | Lockstep with Pi's nested copy [VERIFIED: npm registry] |
| `pi-subagents` | optional peer `>=0.74.0` (0.74.0, 2026-09-30) | Agents soft dep | Ships compiled `src/agents/{skills,frontmatter}.js` [VERIFIED: unpacked tarball] |
| `pi-mcp-adapter` | **add** optional peer `>=5.0.0` + `peerDependenciesMeta.optional` (5.0.0, 2026-10-02T00:12Z) | MCP soft dep | Registers `mcp-adapter` unconditionally at load (`index.ts:1698`) [VERIFIED: unpacked tarball] |
| `@quintinshaw/pi-dynamic-workflows` | 3.13.1 (`scripts/pi.sh` pin only) | Engine canaries | Peers unchanged (`pi-coding-agent >=0.80.8`); scratch install resolves its peer to 1.0.0 [VERIFIED: scratch install] |
| `write-file-atomic` | `^8.0.0` (8.0.0) | runtime | `engines.node ^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` [VERIFIED: package-lock.json] |
| `semver` | `^7.8.5` (already a runtime dependency) | prerelease-correct floor compare in the pi-subagents loader | Already in `dependencies`; do not hand-roll compare |

### Development tools (all at registry latest 2026-10-02 except TypeScript)

| Tool | Current | Target |
|------|---------|--------|
| `typescript-eslint` | `^8.70.1` | `^8.71.0` (needs the D-01-17 fix) |
| `eslint-plugin-sonarjs` | `^4.0.3` | `^4.2.2` |
| `fallow` | `^3.27.0` | `^3.31.0` + `.github/workflows/lint.yml:56` → `fallow-rs/fallow@71369f80d099e25726ad04382f15aef14a251abc # v3.31.0` [CITED: .planning/research/STACK.md] |
| `prettier` | `^3.8.3` | `^3.9.9` |
| `globals` | `^17.6.0` | `^17.13.0` |
| `eslint-plugin-import-x` | `^4.16.2` | `^4.17.1` |
| `typescript` | `^6.0.3` | **hold** (`latest` is 7.0.2; typescript-eslint 8.71 peers `<6.1.0`) |
| others (`@eslint/js` 10.0.1, `@stylistic/eslint-plugin` 5.10.0, `@types/*`, `eslint` 10.11.0, `strong-mock` 9.2.2, `typebox` 1.3.34) | latest | unchanged |

**Installation (in the worktree, after a human-verify checkpoint, see audit below):**
```bash
npm install -D @earendil-works/pi-coding-agent@^1.0.0 @earendil-works/pi-tui@^1.0.0
npm install -D typescript-eslint@^8.71.0 eslint-plugin-sonarjs@^4.2.2 fallow@^3.31.0 \
  prettier@^3.9.9 globals@^17.13.0 eslint-plugin-import-x@^4.17.1
# then hand-edit peerDependencies / peerDependenciesMeta / engines and run `npm install`
# once more so the lock root mirrors them; never hand-merge the lock
```

## Package Legitimacy Audit

Run via `gsd-tools query package-legitimacy check --ecosystem npm` on 2026-10-02. Every package below is an existing dependency or companion of this project (in `package.json` or `scripts/pi.sh` today); the `SUS` verdicts are all the single signal `too-new`, i.e. the *target version* was published in the last days, not a new package name. No package has a `preinstall`/`install`/`postinstall` script [VERIFIED: `npm view <pkg>@<ver> scripts.*`].

| Package | Registry | Age (package / target version) | Source Repo | Verdict | Disposition |
|---------|----------|------------------|-------------|---------|-------------|
| @earendil-works/pi-coding-agent@1.0.0 | npm | 5 mo / 1 day | earendil-works | SUS (too-new) | Flagged — planner adds one checkpoint before the install |
| @earendil-works/pi-tui@1.0.0 | npm | 5 mo / 1 day | earendil-works | SUS (too-new) | Flagged — same checkpoint |
| typescript-eslint@8.71.0 | npm | 7 yr / 4 days | typescript-eslint | SUS (too-new) | Flagged — same checkpoint |
| eslint-plugin-sonarjs@4.2.2 | npm | 8 yr / 4 days | SonarSource | SUS (too-new) | Flagged — same checkpoint |
| fallow@3.31.0 | npm | 7 mo / 2 days | fallow-rs | SUS (too-new) | Flagged — same checkpoint |
| prettier@3.9.9 | npm | 9 yr / 9 days | prettier | SUS (too-new) | Flagged — same checkpoint |
| globals@17.13.0 | npm | 13 yr / 1 day | sindresorhus | SUS (too-new) | Flagged — same checkpoint |
| eslint-plugin-import-x@4.17.1 | npm | — | un-ts | OK | Approved |
| pi-subagents@0.74.0 | npm | 8 mo / 2 days | — | SUS (too-new) | Not installed in the repo; scratch prefix only |
| pi-mcp-adapter@5.0.0 | npm | 8 mo / <1 day | nicobailon | SUS (too-new) | Declared as optional peer only; never installed in the repo |
| @quintinshaw/pi-dynamic-workflows@3.13.1 | npm | 4 mo / 3 days | — | SUS (too-new) | Scratch prefix only |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** all target versions above (recency only). Because PIFL-01/05 lock these exact versions, one `checkpoint:human-verify` before the single `npm install` step covers the set.

## Architecture Patterns

### System flow (detection, after this phase)

```
Pi 1.0 runtime ──getAllTools()──┐                 ┌── getCommands() ──── Pi 1.0 runtime
                                 ▼                 ▼
                     platform/pi-api.ts::softDepStatus(pi)
          ┌───────────────┬──────────────────────────────────┬─────────────────────┐
          │ subagents arm │ MCP adapter arms (each own try)   │ workflow engine arm │
          │ tool=subagent │ A: command name mcp-adapter[:N]   │ tool=workflow_control│
          │               │    or command src ∋ pi-mcp-adapter│                     │
          │               │ B: tool src ∋ pi-mcp-adapter      │                     │
          └───────┬───────┴───────────────┬──────────────────┴──────────┬──────────┘
                  ▼                       ▼ (A || B; throw ⇒ false)      ▼
              SoftDepStatus { piSubagentsLoaded, piMcpAdapterLoaded, workflowEngineLoaded }
                                          ▼
   shared/notification-dispatch.ts notify(): one probe per emission ──► concerns/soft-dep.ts
                                          ▼                              softDepMarkers()
              row brace {…, requires pi-subagents, requires pi-mcp-adapter, requires pi-dynamic-workflows}
                                          ▼
                              ctx.ui.notify (install / list rows; see OQ-1 for info)
```

Built-in MCP (`mcp__<server>__<tool>` tools, `/mcp` command, `source: "builtin"`) and any foreign `mcp` tool never satisfy arm A or B.

### Pattern 1: One commit for bump + lint fix + contracts re-pin

**What:** `package.json` (peers, devDeps, engines), regenerated lock, the 74162ca6 test hunks (via the D-01-13 seed), `tools.test.ts` `ExtensionToolContext`, FLOOR-01 literal, the D-01-17 fix, and `scripts/check-unused-type-members.contracts.json` change together.
**Why:** after `npm install` the old pins (`types.d.ts:406:5`, `:414:5`) name nothing and `lint:type-members` exits 2; after the typescript-eslint bump `npm run lint` fails until the fix lands; the fix moves the `notify-context.ts:346` pins. Any commit touching `package.json` runs the **full** check in pre-commit, so every one of these must be green in the same commit.
**Exact contracts edits** [VERIFIED: scratch tree `/var/tmp/mcp4-rs/lintx`, `node scripts/check-unused-type-members.mjs` exit 0]:
```text
pi-api.ts:100:3   upstream  .../types.d.ts:406:5  ->  .../types.d.ts:525:5
pi-api.ts:108:3   upstream  .../types.d.ts:414:5  ->  .../types.d.ts:533:5
notify-context.ts id      346:29 -> 346:61   (owner "arm", key "status")
notify-context.ts filter  346:14 -> 346:46
```
The `types.d.ts` lines verbatim [VERIFIED: installed pi-coding-agent 1.0.0 `dist/core/extensions/types.d.ts:524-533`]: line 525 `    type: "resources_discover";`, line 533 `    themePaths?: string[];`. Re-derive after Prettier and after `npm install` in the real worktree; do not copy numbers blindly.

### Pattern 2: The `no-unsafe-enum-assignment` fix (D-01-17)

Current code [VERIFIED: extensions/pi-claude-marketplace/shared/notify-context.ts:345-346]:
```ts
  const arm = context.render[row.status as Status] as
    RenderFn<Extract<Msg, { status: Status }>> | undefined;
```
Mechanism [VERIFIED: node_modules/@typescript-eslint/eslint-plugin/dist/rules/no-unsafe-enum-assignment.js, `'MemberExpression[computed = true]'` handler]: the rule collects the mapped-type constraint of the receiver's declaration (`render: { [K in Status]: ... }` → the *interface's* `Status`), and reports when the key type is not assignable to it. The function's own `Status` type parameter is not assignable to the interface's, so it reports; it never checks that an enum is present, which is why the message ends `expected enum .`. Upstream has no matching issue (`gh search issues no-unsafe-enum-assignment`: only #12951, a different, closed case).

Recommended fix (verified lint 0 / tsc 0 / Prettier clean / `tests/shared/notify-context.test.ts` 13/13):
```ts
  const render: Readonly<Record<string, unknown>> = context.render;
  const arm = render[row.status] as RenderFn<Extract<Msg, { status: Status }>> | undefined;
```
The key becomes `string` against a `string`-keyed receiver, so no mapped enum constraint exists for any future version of the rule to resolve, and the `as Status` cast disappears. Variants that also pass but rely on rule gaps: destructuring `const { render } = context;` (BindingElement is not inspected) and `Readonly<Partial<Record<Status, unknown>>>` (type alias not resolved) — do not use. A `Readonly<Partial<Record<string, RenderFn<…>>>>` annotation fails `tsc` (TS2322 under `exactOptionalPropertyTypes`). Update the doc comment above `dispatchRow` (it says "The cast bridges ..."): it must describe the string-keyed read in present tense.

### Pattern 3: The adapter probe (ADET-02, D-01-05)

Current probe [VERIFIED: extensions/pi-claude-marketplace/platform/pi-api.ts:143-152,181-199]:
```ts
export interface ToolInventoryItem {
  readonly name?: unknown;
  readonly sourceInfo?: { readonly source?: unknown };
}
export interface ToolInventory {
  getAllTools(): readonly ToolInventoryItem[];
}
...
function hasLoadedPiMcpAdapter(pi: ToolInventory): boolean {
  try {
    return pi.getAllTools().some((tool) => {
      if (tool.name === "mcp") {
        return true;
      }
      const src = tool.sourceInfo?.source;
      return typeof src === "string" && src.includes("pi-mcp-adapter");
    });
  } catch {
    return false;
  }
}
```
Pi 1.0 shapes [VERIFIED: pi-coding-agent 1.0.0 `dist/core/slash-commands.d.ts:2-8`, `dist/core/source-info.d.ts:2-10`, `dist/core/extensions/types.d.ts:1239,1248`]:
```ts
export type SlashCommandSource = "extension" | "prompt" | "skill";
export interface SlashCommandInfo {
    name: string;
    description?: string;
    source: SlashCommandSource;
    sourceInfo: SourceInfo;
}
export interface SourceInfo { path: string; source: string; scope: SourceScope; origin: SourceOrigin; baseDir?: string; }
    getAllTools(): ToolInfo[];
    getCommands(): SlashCommandInfo[];
```
`getCommands()` returns extension commands under their **invocation name**: `${command.name}:${occurrence}` whenever two extensions register the same name [VERIFIED: pi-coding-agent 1.0.0 `dist/core/extensions/runner.js:550-577` and `dist/core/agent-session.js:2645-2651` (`name: command.invocationName`, `source: "extension"`); live run `run-adapter-dup.json` listed `mcp-adapter:1` and `mcp-adapter:2`]. Before `bindCore` both `getAllTools` and `getCommands` throw "Extension runtime not initialized" (`loader.js:107-130`), so the existing throw-means-unloaded rule covers load-time calls.

Recommended shape (names are proposals; `PiInventory` is 11 chars, see Pitfall 4):
```ts
/** The command metadata the pi-mcp-adapter probe inspects. */
export interface CommandInventoryItem {
  readonly name?: unknown;
  readonly source?: unknown;
  readonly sourceInfo?: { readonly source?: unknown };
}

/** Consumer-owned view of the Pi API that the soft-dependency probes read. */
export interface PiInventory {
  getAllTools(): readonly ToolInventoryItem[];
  getCommands(): readonly CommandInventoryItem[];
}

// ADET-02: Pi suffixes a command two extensions both register (`mcp-adapter:1`).
const ADAPTER_COMMAND = /^mcp-adapter(?::\d+)?$/;

function isAdapterSource(source: unknown): boolean {
  return typeof source === "string" && source.includes("pi-mcp-adapter");
}

/** Runs one probe arm; a throwing arm reports "not loaded" (RH-4 house rule). */
function probeArm(arm: () => boolean): boolean {
  try {
    return arm();
  } catch {
    return false;
  }
}

/**
 * ADET-02: pi-mcp-adapter is loaded iff an extension command is named
 * `mcp-adapter` (the adapter registers it unconditionally, also with
 * `disableProxyTool` and from a fork), or a command or tool source names
 * `pi-mcp-adapter`. A bare `mcp` tool does not count. Both arms always run,
 * so every snapshot reads `getCommands()` once.
 */
function hasLoadedPiMcpAdapter(pi: PiInventory): boolean {
  const viaCommands = probeArm(() =>
    pi.getCommands().some(
      (command) =>
        command.source === "extension" &&
        ((typeof command.name === "string" && ADAPTER_COMMAND.test(command.name)) ||
          isAdapterSource(command.sourceInfo?.source)),
    ),
  );
  const viaTools = probeArm(() =>
    pi.getAllTools().some((tool) => isAdapterSource(tool.sourceInfo?.source)),
  );
  return viaCommands || viaTools;
}
```
- Evaluate both arms unconditionally: the per-snapshot read count stays fixed at 3 `getAllTools()` + 1 `getCommands()` regardless of state, which strict mocks pin (Pitfall 5).
- `command.source === "extension"` keeps a prompt template or skill named `mcp-adapter` from counting (skills are `skill:<name>`; prompts keep their name). This is a recommendation inside D-01-05, not a new decision; drop it if the planner prefers the literal D-01-05 text.
- Cite `ADET-02` in the comment; PRD RH-4 (`docs/prd/pi-claude-marketplace-prd.md:629`) still defines the old probe and should be amended in the docs plan.

### Pattern 4: The real-Pi RPC test (ADET-01, D-01-14)

Port `features/mcp:tests/e2e/_rpc.ts` (read in full this session) with:
- **IN-04:** wrap each `realpath(location)` in `assertSandboxInsideTmp` and rethrow `runRpcSession: sandbox location ${location} does not exist`; return the resolved paths and pass *those* to `spawn` and the child env.
- **IN-05:** on `child.on("exit")` call `killProcessGroup(child)` (it already swallows `ESRCH`) before `close` resolves, so stdio MCP grandchildren never outlive a clean exit.
- Also reject a sandbox inside the repository (`REPO_ROOT`) with a clear error: Pi 1.0 asks for trust in every directory under the repo because of `.agents/skills` (CONTEXT specifics), and the harness cancels dialogs, so the case would fail with `dialogs: ["select"|"confirm"]` instead of naming the cause. This bites when `TMPDIR` points inside the repo.
- Keep: allowlisted env `{ HOME, PI_CODING_AGENT_DIR, PI_OFFLINE: "1", PATH }`, `--mode rpc --offline --no-session`, never `--no-extensions` (it removes `builtin:mcp`), `detached: true` + group `SIGKILL` hard stop, `t.signal` abort.

States for the inverted test (each proven first through `get_commands`):

| State | Setup | `get_commands` proof | install/list row suffix | install severity |
|-------|-------|----------------------|------------------------|------------------|
| built-in only | `<agentDir>/mcp.json` with one stub stdio server | `mcp` from `builtin:mcp`; no `mcp-adapter*` | ` {requires pi-mcp-adapter}` | `warning` |
| neither | `<agentDir>/settings.json` `{"extensions":["-builtin:mcp"]}` | no `mcp`, no `mcp-adapter*` | ` {requires pi-mcp-adapter}` | `warning` |
| adapter command (fork / `disableProxyTool`) | `--extension <root>/adapter-fixture.mjs` registering `mcp-adapter` | `mcp-adapter` from the fixture path (source `cli`, no `pi-mcp-adapter` substring) | `` (none) | info (`notifyType` absent) |
| foreign `mcp` tool (recommended extra) | `--extension <root>/foreign-mcp.mjs` registering tool `mcp` | `mcp` from `builtin:mcp` only | ` {requires pi-mcp-adapter}` | `warning` |

Fixture extensions are plain JavaScript written by the test into `env.root` [VERIFIED: live run]:
```js
export default function (pi) {
  pi.registerCommand("mcp-adapter", { description: "Fixture mcp-adapter command.", handler: async () => {} });
}
```
A minimal stdio MCP stub (newline-delimited JSON-RPC answering `initialize`, `tools/list`, `tools/call`; 25 lines) made the built-in register `mcp__stub__echo` under `--offline` [VERIFIED: `/var/tmp/mcp4-rs/rpc/stub-mcp.mjs`, `run-builtin.json`]. The built-in connects asynchronously on `session_start` (`dist/extensions/mcp/index.js:840-895`); an extension command prompt does not wait for it. To make the "built-in tools exist" half of the state real and to satisfy D-01-14's "the same run captures the inventory", add an `inventory-probe` fixture command that polls `pi.getAllTools()` (bounded, e.g. 8 s) until an `mcp__` tool appears, then `ctx.ui.notify(JSON.stringify({ tools, commands }))`; assert on it before reading rows. Session wall time was ~9 s per state locally, so 4 states cost ~40 s in the CI `e2e-tests` job (20-minute timeout, Node 24, `npm ci --ignore-scripts`; Pi comes from devDependencies) [VERIFIED: .github/workflows/ci.yml e2e-tests job].

Captured Pi 1.0.0 built-in inventory for the D-01-06 mock matrix (cite this run in the test; re-capture from the ported test) [VERIFIED: live run 2026-10-02, `/var/tmp/mcp4-rs/rpc/run-builtin.json`]:
```json
{ "tool":    { "name": "mcp__stub__echo", "exposure": "deferred", "namespace": "mcp__stub",
               "sourceInfo": { "path": "builtin:mcp", "source": "builtin", "scope": "temporary", "origin": "top-level" } },
  "command": { "name": "mcp", "source": "extension",
               "sourceInfo": { "path": "builtin:mcp", "source": "builtin", "scope": "temporary", "origin": "top-level" } },
  "alsoPresent": ["tool codemode (builtin:codemode, model-only)", "tool tool_search (builtin:tool-search, model-only)",
                  "command llama (builtin:llama.cpp)"] }
```
CLI-loaded fixtures report `sourceInfo.source: "cli"`; `pi install npm:pi-mcp-adapter` yields the package spec as `source` (e.g. `npm:pi-mcp-adapter`) [VERIFIED: package-manager.js:1008 `metadata = { source: sourceStr, ... }`].

### Pattern 5: Shared test support (D-01-06, D-01-13, WR-08)

- **Probe-count helper.** Port features/mcp `81d609b5`/`20e2bb16`/`284b1bad` as specification: `expectSoftDepProbes(pi, probes, tools = [], commands = [])` in `tests/edge/notification-boundary.ts` states `getAllTools()` `times(probes * 3)` and `getCommands()` `times(probes)`; a count of 0 states nothing (`strong-mock` treats `times(0)` as no limit). Callers state probes, not reads. Today 23 direct `when(() => pi.getAllTools())...times(3|N*3)` sites in 19 files plus `createNotificationBoundary`'s `toolProbes` (186 literal arguments per features/mcp) pin raw reads [VERIFIED: rg]. Doing this refactor in its own wave **before** the probe change means the probe change edits one helper instead of ~40 sites.
- **Inventory seeds** (`tests/platform/pi-inventory-seed.ts`, next to the probe tests): `toolInfo(name)` returning a Pi `ToolInfo` with `exposure: "direct"` (replaces the copies at `tests/architecture/workflows-marker-coverage.test.ts:97-109`, `tests/orchestrators/plugin/list-flow.test.ts:78-90`, `tests/orchestrators/plugin/reinstall.messaging.test.ts:62-74`), plus seeds for the D-01-06 states (`adapterCommand()`, `builtinMcpInventory()` from the captured run, `foreignMcpTool()`, `forkAdapterCommand()`). Seeds return fresh values (unit-testing skill). Support modules need no meta-test and are outside the corresponding-test pairing (`check-corresponding-tests.mjs` only pairs `*.test.ts`).
- **"Adapter loaded" fixtures must change.** Every double that plants `{ name: "mcp" }` as "adapter loaded" flips to "not loaded" after the probe change: `tests/architecture/catalog-uat/mock-pi.ts:70,75,91`, `tests/shared/notification-summary.test.ts:37`, `tests/shared/notification-dispatch.test.ts:50,62`, `tests/architecture/notify-will-reload-agreement.test.ts:61`, `tests/architecture/notify-grammar-invariant.test.ts:60`, `tests/orchestrators/plugin/install-cascade.messaging.test.ts:42-43`, `tests/orchestrators/plugin/enable-disable.test.ts:4394`, `tests/orchestrators/plugin/reinstall-flow.test.ts:325,9395`, `tests/platform/pi-api.test.ts:307,424`, plus `toolNames` seeds in list-flow/reinstall.messaging [VERIFIED: rg]. They should plant the adapter command seed. `tests/e2e/_helpers.ts::makeMockPi` must gain a `commands` parameter and always define `getCommands` (otherwise the commands arm throws and is silently "not loaded").
- **Plain-object doubles** `{ getAllTools: () => [] }` typed as the inventory (146 `getAllTools` mentions in 58 test files; 32 in `prune.test.ts` alone) stop compiling once `getCommands` is required; features/mcp added `getCommands: () => []` at each site. A shared `emptyPiInventory()` seed is the cheaper edit.

### Pattern 6: pi-subagents peer loader (D-01-12)

One module `tests/integration/pi-subagents-peer.ts` (integration root is outside corresponding-test pairing) exporting `findPiSubagentsPackage()` and `loadPiSubagentsModule<T>(peer, "skills" | "frontmatter")`, imported by `tests/integration/provenance-invisibility.test.ts` and `tests/integration/skill-path-resolution.test.ts`.
- **IN-05/IN-06 with `semver` (already a runtime dependency):** read `package.json` `peerDependencies["pi-subagents"]`, `const floor = semver.minVersion(range)` (throw if null), `semver.lt(version, floor)` → skip below floor. `semver.lt("0.74.0-rc.1", "0.74.0")` is true, which closes IN-06 without a hand-written comparator. Reading the floor from `package.json` removes the constant entirely, so no drift is possible; add a FLOOR-01-style case for `pi-subagents` (`>=0.74.0`, lock root in sync) to `tests/architecture/peer-floor.test.ts` so a bump is still a deliberate gate edit.
- **IN-07:** when `PI_SUBAGENTS_ROOT` is set, a missing `package.json` or `name !== "pi-subagents"` fails the test; the skip stays only for the `npm root -g` fallback.
- **5b1d8ef6/dac3a245:** import `src/agents/{frontmatter,skills}.js` in place (0.74.0 ships them); a present at-or-above-floor package whose module is missing or fails to import fails, never skips.
- **IN-02:** drop the closed `exports` subpath list and the `0.35.1 execution.ts` / `agents.ts` references; describe the behavior without version-pinned file names.
- Proof run (local global is 0.47.1, CI has none): `npm install --prefix /var/tmp/<dir>/subagents pi-subagents@0.74.0` then `PI_SUBAGENTS_ROOT=/var/tmp/<dir>/subagents/node_modules/pi-subagents npm run test:integration` and confirm `skipped 0` for both files; plus a negative run with `PI_SUBAGENTS_ROOT=/nonexistent` that must fail.

### Pattern 7: Marker rename (D-01-01/02)

Code sites (3) [VERIFIED: read]: `shared/notification-types.ts:27` `  | "requires pi-mcp"` (keep position 13 of the union; COMPAT-01 reads declaration order), `shared/notify-reasons.ts:108` (`UnsupportedReason` partition; `_UncoveredReason`/`_ExtraReason` make a one-sided rename a compile error), `shared/concerns/soft-dep.ts:35` `const SOFT_DEP_MARKER_MCP: Reason = "requires pi-mcp";`.
Comment-only production sites (13 files, 20 lines): `platform/pi-api.ts:12`, `shared/concerns/soft-dep.ts:25`, `shared/notification-types.ts:397`, `shared/notification-grammar.ts:269,564,619`, `shared/notification-dispatch.ts:59`, `orchestrators/types.ts:467`, `orchestrators/reconcile/notify.ts:616`, `orchestrators/plugin/{update-swap.ts:1418, update-row.ts:113, uninstall.ts:59,1314, shared.ts:110, reinstall.messaging.ts:224,358, list-flow.ts:28,736, install.messaging.ts:134, install-flow.ts:839}`.
Closed-set gates (amend in place, same position, comment with ADET-01 rationale, no "renamed from"): `tests/architecture/compat-01-no-expansion.test.ts:233`, `notify-closed-set-locks.test.ts:54`, `closed-set-enrollment.test.ts:135,165,209`, `tests/shared/notification-types.test.ts:50`. COMPAT-01's header states "Adding, removing, or renaming any member fails here and forces a deliberate amendment"; a rename keeps every length lock unchanged.
Tests: 24 files / 49 lines (list in §Sources). **D-01-02 open-ended assertions to close:** `tests/e2e/install-soft-deps.test.ts:15-16` (`"{requires pi-mcp"` used with `includes`), `tests/orchestrators/plugin/uninstall.test.ts:1284` (negative `includes("{requires pi-mcp")`), `tests/orchestrators/plugin/reinstall-flow.test.ts:1367-1368` (`/\{[^}]*requires pi-mcp[^}]*\}/`). Positive checks use the closed brace or a token boundary (`/requires pi-mcp-adapter[,}]/`); the negative uninstall check uses `requires pi-mcp-adapter`.
Docs: `docs/output-catalog.md:69,248,250,395 (also IN-03: "both" → three flags),565,1516,2163,3733`; `docs/messaging-style-guide.md:9,40` + the mapping table row (waived in `partial-vocabulary-guard.test.ts:316-319`, update its `why`); `docs/adr/v2-001-structured-notify.md:72`; `docs/workflows-compatibility.md:212`; optional `docs/research/claude-hooks-vs-pi-events.md:273`. The catalog UAT (`tests/architecture/catalog-uat/catalog-contract.test.ts`) byte-compares those blocks.
**Old-token guard (recommended):** features/mcp `1ce19128` added `ABSENT_RETIRED_MARKERS = ["requires pi-mcp"]` to the vocabulary guard. That substring is a prefix of the new token, so here use the delimited forms: `"requires pi-mcp}"`, `"requires pi-mcp,"`, `` "requires pi-mcp`" ``, `'requires pi-mcp"'`. The guard matches by substring over the extension tree, the two guarded docs, the PRD and `tests/**` minus e2e/integration.
**README (D-01-04, PIFL-03):** `README.md:38-41` / `README.es.md:38-41` prerequisites: `Pi Coding Agent 1.0.0 or newer`; the pi-mcp-adapter bullet gains `5.0.0 or newer`, "Pi's built-in MCP does not replace it", and the upstream `pi-ai` peer gap (adapter 5.0.0 declares optional peer `@earendil-works/pi-ai ^0.84.1 … || ^0.99.0`, excluding 1.0; `pi install` is unaffected because it passes `--legacy-peer-deps`) [CITED: .planning/research/STACK.md §pi-ai Peer Gap]. Do not write the sentence "pi-mcp-adapter is not loaded" anywhere (vocabulary guard `ABSENT_SOFT_DEP_PROSE`, `partial-vocabulary-guard.test.ts:400`).

### Pattern 8: Every NFR-4 / Node floor site (D-01-16)

| Site | Today | Action |
|------|-------|--------|
| `package.json:35-36` `engines.node` | `>=20.19.0` | `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`; lock root `packages[""].engines` follows via `npm install` |
| `AGENTS.md:59` | `Node >= 20.19.0 (NFR-4)` | new range; `AGENTS.md:61` Pi API → `>=1.0.0` (dev `^1.0.0`) |
| `.planning/PROJECT.md:893,895` (and the stale tooling bullet `:887`) | same | same |
| `docs/prd/pi-claude-marketplace-prd.md:1038` NFR-4 definition | `MUST work with Node >= 20.19.0` | not named by D-01-16; flag for the planner (the PRD is where NFR-4 is defined) |
| `extensions/pi-claude-marketplace/shared/extension-version.ts:6-8` comment | justifies the literal by "experimental below Node 22 ... at the NFR-4 floor" | the reason weakens at Node 22; comment-only, keep or restate (no behavior change) |
| `docs/competitive-analysis/pi-plugins.md:19,430,515,610,654`, `zmarketplace.md:433` | quote `>=20.19.0` | optional doc refresh |
| `.planning/codebase/STACK.md` | `>=20.19.0`, `>=0.86.1` | refresh map docs at phase end (optional) |
| CI (`ci.yml`, `lint.yml`, `sonarcloud.yml`, `publish.yml`, `e2e-nightly.yml`) | Node 24 | inside the new range; no change. `ci.yml:49-59` comment already cites write-file-atomic's range |
No test pins `engines` today [VERIFIED: rg `20.19|engines` over tests/].

### Pattern 9: Canary run recipes (PIFL-07, D-01-07..10)

All in the worktree after `npm install` puts Pi 1.0.0 in `node_modules`. Use a scratch root on disk, outside the repository and outside `/tmp` (inode pressure): e.g. `S=/var/tmp/mcp4-uat`.

**Stop canary (keyless stub, D-01-15):**
```bash
mkdir -p tmp/pi-uat/agent "$S"
printf '%s\n' '{"providers":{"stubllm":{"baseUrl":"http://127.0.0.1:18787/v1","api":"openai-completions","apiKey":"stub","models":[{"id":"stub"}]}}}' > tmp/pi-uat/agent/models.json
printf '%s\n' '{"defaultProvider":"stubllm","defaultModel":"stub"}' > tmp/pi-uat/agent/settings.json
STUB_HTTP_LOG="$S/stub-http.log" node tests/live-uat/openai-stub-server.mjs > "$S/stub.out" 2>&1 &
STUB_PID=$!
TMPDIR="$S" PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/agent node tests/live-uat/stop-canary.mjs > "$S/stop.log" 2>&1; echo "STOP_EXIT=$?" >> "$S/stop.log"
kill "$STUB_PID"; wc -l "$S/stub-http.log"; rm -rf tmp/pi-uat/agent
```
Negative controls already in the driver: unset `PI_CODING_AGENT_DIR`; `PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/../../.pi/agent` (refused, containment). After IN-10 the expected headless exit becomes the "cap-trip warning → human" code and a regression gets a distinct code; record both codes in the README.

**Engine canaries (3.13.1):**
```bash
mkdir -p "$S/wf-engine" tmp/pi-uat/wf-agent tmp/pi-uat/wf-store
TMPDIR="$S" npm install --prefix "$S/wf-engine" @quintinshaw/pi-dynamic-workflows@3.13.1
node -e 'console.log(require(process.argv[1]).version)' "$S/wf-engine/node_modules/@earendil-works/pi-coding-agent/package.json"   # must print 1.0.0
E="PI_WORKFLOW_ENGINE_ROOT=$S/wf-engine/node_modules TMPDIR=$S"
env $E PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-agent node tests/live-uat/workflow-agent-failure-canary.mjs            # exit 0
env $E PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-agent node tests/live-uat/workflow-agent-failure-canary.mjs --invert   # exit 1 naming A1
env $E PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-store node tests/live-uat/workflow-storage-canary.mjs                 # exit 0
env $E PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-store node tests/live-uat/workflow-storage-canary.mjs --invert        # exit 1 at [user] W2
env TMPDIR="$S" PI_CODING_AGENT_DIR=$(pwd)/tmp/pi-uat/wf-store node tests/live-uat/workflow-storage-canary.mjs         # unset engine root -> LIVE ENGINE REQUIRED
rm -rf "$S/wf-engine" tmp/pi-uat/wf-agent tmp/pi-uat/wf-store
```
npm 11.19.1 prints `npm warn install-scripts ... not yet covered by allowScripts` for esbuild/protobufjs/@google/genai; the canaries still passed. The README says never add `--ignore-scripts`; keep that.

**Doc re-grade (D-01-10):** diff the cited bodies with both tarballs:
```bash
cd "$S" && npm pack @quintinshaw/pi-dynamic-workflows@3.13.0 @quintinshaw/pi-dynamic-workflows@3.13.1
mkdir a b && tar -xzf quintinshaw-pi-dynamic-workflows-3.13.0.tgz -C a && tar -xzf quintinshaw-pi-dynamic-workflows-3.13.1.tgz -C b
diff -rq a/package/src b/package/src
diff -u a/package/src/pi-extension.ts b/package/src/pi-extension.ts
```
Measured result: changed `src/{agent,display,errors,pi-extension,workflow-authoring-coverage,workflow-commands}.ts`; unchanged `workflow.ts`, `saved-commands.ts`, `workflow-saved.ts`, `workflow-paths.ts`, `workflow-tool.ts`, `workflow-capability-contract.ts`, `workflow-manager.ts` [VERIFIED: diff -rq]. `pi-extension.ts` gains only `export { installHostCreateAgentSession } from "./agent.js";` at line 35, so the session-start registration cited at `docs/workflows-compatibility.md:214` is byte-identical (lines +1). `errors.ts` widens `classifyProviderLimit`'s regex with `out of\s+(?:your\s+)?(?:extra|included)\s+usage` (lines +3 after 159); the doc already keeps `errors.ts`/`agent.ts` claims at their 3.10.1 grade (`:156`), so they stay. Stamp sites: `:7, :11-12 (grade definitions), :19, :56, :58, :79, :97, :115, :116, :146, :154, :156, :160, :183, :191-198, :214, :222, :224` [VERIFIED: grep]. `:196` (a manual live saved-workflow run on Pi 0.86.1 + engine 3.13.0 with an OpenAI child) and `:198` (two observed engine limits) are not canary claims; they keep their dated stamps unless re-observed. `:191` must become `>=1.0.0` (WDEP-04 gate reads package.json, `tests/architecture/workflows-doc-pins.test.ts:126-152`), `:192` names 3.13.1, `:194` → "Install Pi 1.0.0 or a newer version"; the gate's header comment `:12` names `>=0.86.1`.

**`scripts/pi.sh`** (`:95-101`): `pi-mcp-adapter@5.0.0`, `pi-subagents@0.74.0`, `@quintinshaw/pi-dynamic-workflows@3.13.1`; entry paths stay valid (`pi-mcp-adapter/index.ts`, `pi-subagents/index.js`, engine `extensions/workflow.ts`) [VERIFIED: unpacked tarballs]. The `:95` comment "3.13.0 is the engine version ... grades" moves to 3.13.1. Under `--no-extensions` + `-e`, the adapter's tools/commands report `source: "cli"`, so only the command arm detects it there (tool-source arm fails) — another reason the command arm is primary.

### Anti-Patterns to Avoid
- **Cherry-picking features/mcp commits:** pins are line:col and main moved; use the commits as specifications (Pitfall 12 in milestone PITFALLS).
- **Short-circuiting the two MCP arms:** `viaTools || viaCommands` makes the `getCommands()` read count depend on state, so strict mocks need per-state counts.
- **Matching `name === "mcp-adapter"` only:** misses Pi's `mcp-adapter:N` collision names.
- **Keeping `{ name: "mcp" }` as the "adapter loaded" seed:** after the change it means "not loaded", and suites that assert "no marker" go red in bulk (or, worse, an assertion written with an open-ended substring stays green).
- **Running the RPC test with `TMPDIR` inside the repo:** trust dialogs; the harness cancels them and the case fails without naming why.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Version floor compare incl. prereleases | `localeCompare(..., { numeric: true })` | `semver.minVersion(range)` + `semver.lt` (runtime dep already) | IN-06: `"0.73.1-rc.1".localeCompare("0.73.1")` is 1 |
| Finding Pi's CLI | PATH lookup | `tests/pi-runtime.ts::resolvePiRuntime` | Single sanctioned resolver; reads the lock-pinned devDependency |
| Sandbox HOME/agent dir | ad-hoc mkdtemp + env juggling | `tests/platform/hermetic-environment.ts::createHermeticEnvironment` | Same on main and features/mcp; restores env and cleans up |
| Seeing `ctx.ui.notify` from real Pi | `--mode json`/`-p` scraping | Pi `--mode rpc` (`extension_ui_request` with `method: "notify"`) | notify is a no-op in print/json mode (D-20) |
| Pi command inventory | parsing settings or `--help` | RPC `get_commands` / `pi.getCommands()` | Includes invocation-name suffixes and `sourceInfo` |
| Counting probe reads in strict mocks | literal `times(3)` per suite | one `expectSoftDepProbes` helper | WR-08: one place to change when the probe's read shape changes |
| Engine body diff | reading two GitHub tags | `npm pack` both versions + `diff -rq` | The published tarball is what users get |
| Lock edits | hand-merging `package-lock.json` | `npm install` after editing `package.json` | Lock regeneration is the convention; memory: commit normalized forms |

**Key insight:** every hard part of this phase already has a seam in the repo or in Pi; the risk is in replay mechanics (pins, counts, substrings), not in new logic.

## Runtime State Inventory

The marker rename and the probe change are a rename/refactor of user-visible output.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — markers are computed at render time from `dependencies` + the probe and never stored in `reasons` or `state.json`; `extensions/pi-claude-marketplace/persistence/` names no `Reason` and no `requires pi-` string [VERIFIED: rg] | none |
| Live service config | None — no external service holds the token | none |
| OS-registered state | None | none |
| Secrets/env vars | None renamed. New/used env names: `PI_SUBAGENTS_ROOT` (test-only), `PI_WORKFLOW_ENGINE_ROOT`, `PI_CODING_AGENT_DIR` (unchanged) | none |
| Build artifacts / installed packages | (1) Worktree `node_modules` has Pi 0.87.1 until `npm install`; `tests/pi-runtime.ts` resolves the CLI from it, so canaries must run after the install. (2) `scripts/pi.sh` private prefix (`${XDG_CACHE_HOME:-~/.cache}/pi-claude-marketplace/pi-runtime`) holds adapter 2.37.0 / subagents 0.71.0 / engine 3.13.0; `pin_met` reinstalls when pins change. (3) The operator's global `pi-subagents` is 0.47.1 (below floor → integration tests skip by design). (4) Adapter 5 writes `"-builtin:mcp"` into the *user* `settings.json` on first start — any real-adapter run needs a sandboxed `PI_CODING_AGENT_DIR` | (1) install before canaries; (2) none (auto-reinstall); (3) prove floor via `PI_SUBAGENTS_ROOT`; (4) sandbox |

## Common Pitfalls

### Pitfall 1: Contract pins move with comment and import edits
**What goes wrong:** `lint:type-members` exits 2 with empty stdout ("Invalid contract: ... names no declaration") after an edit that shifted a pinned line.
**Why it happens:** 13 files this phase edits carry line:col pins: `uninstall.ts` 10, `install-flow.ts` 6, `pi-api.ts` 6 (lines 100,106,107,108,124), `notify-context.ts` 6, `list-flow.ts` 4, `reinstall.messaging.ts` 4, `update-swap.ts` 4, `reconcile/notify.ts` 4, `notification-grammar.ts` 4, and 2 each in `install.messaging.ts`, `orchestrators/plugin/shared.ts`, `notification-dispatch.ts`, `notification-types.ts` [VERIFIED: contracts JSON scan]. The `pi-api.ts:12` header comment sits above the 100-124 pins.
**How to avoid:** rename tokens in comments without rewrapping (keep line counts); run Prettier, then `npm run lint:type-members` after each plan; acceptance criterion for waves 2-4: `git diff --exit-code scripts/check-unused-type-members.contracts.json`. If a line must move, remap with the line delta only (memory: Prettier invalidates pins; repin by shifting the LINE).
**Warning signs:** exit 2 with no findings listed.

### Pitfall 2: The bump commit is all-or-nothing
**What goes wrong:** committing the Pi bump without the pins, or the typescript-eslint bump without the D-01-17 fix, cannot pass pre-commit (full `npm run check` is selected for `package.json`).
**How to avoid:** Pattern 1, one commit. Expect a ~10 minute hook.

### Pitfall 3: `check:changed` escalates to the full suite
**What goes wrong:** shared test support (`tests/edge/notification-boundary.ts`, seeds), `tests/e2e/**`, `scripts/*.json` and `package.json` all select full scope (`npm run check` + `test:coverage:direct:all`, + `test:e2e` for e2e paths).
**How to avoid:** fewer, larger commits for test-support waves; budget hook time; run with `TMPDIR=/var/tmp/<dir>`.

### Pitfall 4: Renaming `ToolInventory` rewraps imports
**What goes wrong:** three import lines that name it are 98 characters (`orchestrators/plugin/install-flow.ts:84`, `update-cascade.ts:21`, `enable-disable.ts:122`; printWidth 100). A name longer than 15 characters makes Prettier wrap them, shifting every line below (install-flow.ts has 6 pins).
**How to avoid:** pick a name of 15 characters or fewer; `PiInventory` (11) keeps all three on one line.

### Pitfall 5: Strict mocks catch the new `getCommands()` read — loudly
**What goes wrong:** 23 strict `getAllTools()` expectations in 19 files plus the shared boundary have no `getCommands()` expectation; the probe's call throws inside its arm (swallowed) and `verify()` then throws `UnexpectedCalls` [VERIFIED: strong-mock 9.2.2 README "It will also throw if any unexpected calls happened that were maybe caught"].
**How to avoid:** land the `expectSoftDepProbes` helper first (Pattern 5).

### Pitfall 6: Open-ended substring assertions stay green on the wrong token
**What goes wrong:** `includes("{requires pi-mcp")` and `/\{[^}]*requires pi-mcp[^}]*\}/` match both tokens (D-01-02).
**How to avoid:** close the token (Pattern 7 list); the planted negative check is "the old token makes the case fail".

### Pitfall 7: `info` has no marker (see Open Question 1)
**What goes wrong:** a plan that asserts `{requires pi-mcp-adapter}` on the `info` row fails, because the info message variant carries plugin `dependencies?: readonly string[]` (other plugins), not soft-dep kinds, and the catalog defines no info soft-dep state.

### Pitfall 8: Stop-canary epilogue and the retained clone
**What goes wrong:** IN-10 changes the `main().then(exit 0, exit 1)` epilogue that `.fallowrc.json` `duplicates.ignoredClones: ["dup:cc950b18:2"]` retains between `stop-canary.mjs` and `manifest-absence-canary.mjs` (header comments in both files explain it).
**How to avoid:** after the IN-10 edit run `npx fallow dupes`; if the clone is gone, remove the entry and both header paragraphs; if a new clone appears (e.g. the IN-08 spawn/close block, reported in review as `dup:c77b3abb6f87acd9-r20`), change both drivers together or justify. Check `$?`, not the glyph (memory: fallow dupes prints a red glyph on exit 0).

### Pitfall 9: README section loss
**What goes wrong:** `4f82096f` matched the first `### Prerequisites` heading and deleted the engine-canary sections; `0febc4ea` restored them.
**How to avoid:** edit the Stop section's tables by anchoring on `## Stop contract canary`; verify with `grep -c '^## ' tests/live-uat/README.md` before/after (5 `##` sections today).

### Pitfall 10: TMPDIR and trust
**What goes wrong:** `/tmp` inode exhaustion (73% used on this machine today) and repo-local sandboxes trigger trust prompts.
**How to avoid:** `TMPDIR=/var/tmp/<dir>` for checks, canaries and the RPC test.

## Code Examples

### Inverted RPC case skeleton
```ts
// Source: features/mcp:tests/e2e/builtin-mcp-rpc.test.ts (structure), inverted per D-01-14
const ADAPTER_FIXTURE_SOURCE = `export default function (pi) {
  pi.registerCommand("mcp-adapter", { description: "Fixture mcp-adapter command.", handler: async () => {} });
}
`;

const STATES: readonly PiMcpState[] = [
  {
    title: "ADET-01: with only Pi's built-in MCP, the install and list rows carry {requires pi-mcp-adapter}",
    prepare: async (env) => {
      await writeJson(path.join(env.agentDir, "mcp.json"), {
        mcpServers: { stub: { command: process.execPath, args: [await writeStubServer(env.root)] } },
      });
      return { extraExtensions: [await writeInventoryProbe(env.root)], adapterCommands: [] };
    },
    expectedRowSuffix: " {requires pi-mcp-adapter}",
    expectedInstallNotifyType: "warning",
  },
  // neither (-builtin:mcp), adapter command fixture (no marker, info), foreign `mcp` tool (marker)
];
```

### Probe matrix row (unit, `tests/platform/pi-api.test.ts`)
```ts
// Source: captured Pi 1.0.0 run (see RESEARCH), seeds in tests/platform/pi-inventory-seed.ts
{ behavior: "ADET-01: Pi's built-in MCP alone does not count as the adapter",
  tools: [builtinMcpTool()], commands: [builtinMcpCommand()], expected: false },
{ behavior: "ADET-02: a doubly-registered adapter (mcp-adapter:2) counts",
  tools: [], commands: [adapterCommand("mcp-adapter:2")], expected: true },
{ behavior: "ADET-02: a throwing getCommands() leaves the tool-source arm deciding",
  tools: [{ sourceInfo: { source: "npm:pi-mcp-adapter" } }], commands: THROWS, expected: true },
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Built-ins are hidden runtime features | Built-ins are extensions `builtin:<name>`; `-builtin:mcp` disables; `--no-extensions` removes them | Pi 0.99.0 | Never pass `--no-extensions` in the RPC harness |
| Adapter is the only MCP client | Pi ships `builtin:mcp` (`@earendil-works/pi-mcp`); adapter 5 turns it off and owns `/mcp` | Pi 0.99 / adapter 5.0.0 | `/mcp` ownership is not an adapter signal; `mcp-adapter` is |
| `ToolInfo` without exposure | `ToolInfo.exposure` required (`direct \| model-only \| codemode \| deferred \| hidden`) | Pi 0.99 | Seeds carry `exposure: "direct"` |
| Headless `pi -p` stops after one re-entry | Headless run drives the settle→block→re-enter loop to the cap | Pi 0.87 | Stop canary observes blocks=8 headless (confirmed on 1.0.0) |

**Deprecated/outdated:** RH-4's "tool name `mcp`" clause (PRD `:122`, `:629`) — superseded by ADET-02.

## Canary pre-run evidence (research, scratch copy — NOT a substitute for D-01-09)

Scratch: `/var/tmp/mcp4-rs/lintx` = HEAD source + all PIFL-01/05 bumps (Pi 1.0.0); its `stop-canary.mjs` is the `4f82096f` version. Engine 3.13.1 in `/var/tmp/mcp4-rs/wf-engine` (its Pi peer resolved to 1.0.0).
```text
[stop-canary] PASS: live pi 1.0.0 (.../pi-coding-agent/dist/bundle/cli.js) >= 0.99.2, sandbox .../tmp/pi-uat/agent
[stop-canary] observed: Stop-hook blocks=8, agent_settled=8, turn_start=8, cap=8, capWarning=false.
[stop-canary] PASS: STOP-01 ...   [stop-canary] PASS: STOP-03 ... (8 turns for one prompt ...)
[stop-canary] SCRIPTABLE HALF PROVEN, CAP LOOP -> human_needed:   STOP_EXIT=1   (stub logged 8 requests)
[wf-agent-canary] engine 3.13.1 ... A0, A1, A2, A3 PASS   EXIT=0;  --invert: FAILED A1, exit 1
[wf-storage-canary] engine 3.13.1 ... W0, [user] W1-W5, [project] W1-W5 PASS; all assertions proven; exit 0;  --invert: FAIL [user] W2, exit 1
```
Live RPC detection matrix on Pi 1.0.0 with **today's** probe (`/var/tmp/mcp4-rs/rpc/run-*.json`): built-in only → marker; neither → marker; adapter-command fixture → marker (expected to flip to none); foreign `mcp` tool → **no marker** (the false positive ADET-02 removes); duplicate fixtures → `mcp-adapter:1`, `mcp-adapter:2`. `info` rows carried no marker in all five runs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Filtering commands to `source === "extension"` is acceptable inside D-01-05 | Pattern 3 | Low — drop the filter if the user reads D-01-05 literally |
| A2 | `PiInventory` is an acceptable name (discretion item) | Pattern 3 / Pitfall 4 | Low — any ≤15-char name works |
| A3 | The ~10-minute full pre-commit run per config-touching commit fits the operator's 9-minute hook budget poorly; plans should minimize such commits | Pitfall 2-3 | Medium — slow but not wrong |
| A4 | `docs/workflows-compatibility.md:196,198` keep their 3.13.0/0.86.1 stamps because no canary re-measures them | Pattern 9 | Low — the operator may want them re-observed (needs a real provider) |
| A5 | The Stop canary on the real worktree behaves like the scratch run (same Pi, same extension source) | Canary evidence | Low — the executor re-runs it anyway |

## Open Questions

None of these is resolved. No user decision on them exists yet.

1. **ADET-01 / SC-5 name `info`, but `info` renders no soft-dependency marker.**
   - What we know: observed live on Pi 1.0 in every state (`● mcp-fixture v1.0.0 (installed)` + `mcp: fixture`); `docs/output-catalog.md` has `{requires ...}` states only under list, install, reinstall, import, enable and reconcile; the info message's `dependencies` field is the plugin-dependency list (`readonly string[]`), not soft-dep kinds (`shared/notification-types.ts:880,893`).
   - What's unclear: whether the requirement intends a new info marker (a catalog/state expansion: info row variant gains soft-dep flags, new catalog states, catalog UAT fixtures) or meant "install and list".
   - Recommendation: ask the user before planning wave 3. If "install and list", amend ADET-01 and ROADMAP SC-5 text the same way D-01-05 amended ADET-02, and have the RPC test assert the info row is unchanged. If "info too", add a plan for the info marker and keep it inside the closed vocabulary (same token, no new reason).
2. **Old-token absence guard.** Recommended (Pattern 7) but not in CONTEXT; cheap and catches regressions. Planner's call.
3. **PRD edits.** NFR-4 (`prd.md:1038`) and RH-4 (`:122`, `:629`) restate what this phase changes; CONTEXT names only AGENTS.md/PROJECT.md. Recommend updating the PRD rows in the docs plan so the PRD stops contradicting code. Planner's or user's call.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.10.0 local (CI 24) | — |
| npm | installs, lock | ✓ | 11.19.1 | — |
| Pi 1.0.0 | RPC test, canaries | ✗ in worktree (0.87.1 installed) | — | `npm install` in wave 1 |
| npm registry network | `npm install`, scratch prefixes, `npm pack` | ✓ | — | — |
| pi-subagents 0.74.0 | PIFL-02 proof | ✗ global is 0.47.1 | — | scratch `npm install --prefix /var/tmp/...` + `PI_SUBAGENTS_ROOT` |
| engine 3.13.1 | PIFL-07 | scratch only | — | scratch prefix (verified) |
| pre-commit | commits | ✓ | 4.5.1 | — |
| fallow CLI | gates | ✓ | 3.27.0 (3.31.0 after bump) | — |
| gh | upstream issue lookup | ✓ | — | — |
| /var/tmp disk | TMPDIR, scratch prefixes | ✓ | 176 GB free | — |
| /tmp inodes | — | 73% used | — | avoid; use /var/tmp |

**Missing dependencies with no fallback:** none.
**Missing with fallback:** Pi 1.0 (install), pi-subagents 0.74.0 (scratch prefix).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `strong-mock` 9.2.2; typed ESLint; fallow; `lint:type-members` |
| Config file | `package.json` scripts, `eslint.config.js`, `.fallowrc.json`, `scripts/check-unused-type-members.contracts.json` |
| Quick run command | `node --test tests/platform/pi-api.test.ts tests/shared/concerns/soft-dep.test.ts` (owner tests) / `npm run test:architecture` |
| Full suite command | `TMPDIR=/var/tmp/<dir> npm run check > tmp/check.log 2>&1; echo "CHECK_EXIT=$?" >> tmp/check.log` plus `TMPDIR=/var/tmp/<dir> npm run test:e2e > tmp/e2e.log 2>&1; echo "E2E_EXIT=$?" >> tmp/e2e.log` |

### Phase Requirements → Test Map
| Req / Decision | Behavior | Test Type | Automated Command | Fails when | File Exists? |
|--------|----------|-----------|-------------------|-----------|-------------|
| PIFL-01 | peer `>=1.0.0`, lock in sync | architecture | `node --test tests/architecture/peer-floor.test.ts` | literal ≠ `>=1.0.0` or lock desync | ✅ (edit) |
| PIFL-01 | doc floor bullet | architecture | `node --test tests/architecture/workflows-doc-pins.test.ts` | `docs/workflows-compatibility.md:191` ≠ package.json | ✅ |
| PIFL-04 | Pi 1.0 types compile; pins valid | typecheck + analyzer | `npm run typecheck && npm run lint:type-members` | 23 type errors return / exit 2 on stale pin | ✅ |
| PIFL-04 / D-01-13 | one `toolInfo` seed with `exposure` | grep + tsc | `rg -c "function toolInfo" tests` → 1 (in the seed) | a copy reappears | ❌ seed (Wave 0) |
| PIFL-02 | floor from package.json, prerelease below floor, loud override | integration | `PI_SUBAGENTS_ROOT=<prefix>/node_modules/pi-subagents npm run test:integration` → both files pass, 0 skipped; `PI_SUBAGENTS_ROOT=/nonexistent` → fails | skip reported, or bad override reads "not installed" | ✅ (edit) + ❌ shared loader |
| PIFL-02 / IN-05 | pi-subagents peer literal + lock | architecture | `node --test tests/architecture/peer-floor.test.ts` | drift | ❌ new cases |
| PIFL-03 | adapter optional peer; not a devDependency; absent from lock packages | architecture | same file, new cases | `devDependencies["pi-mcp-adapter"]` or `packages["node_modules/pi-mcp-adapter"]` present, or `peerDependenciesMeta` not optional | ❌ new cases |
| PIFL-05 | devDeps latest, TS held | manual check + lint | `npm outdated` (only `typescript` 7.x listed); `npm run lint` | lint error at notify-context | ✅ |
| PIFL-05 | fallow action SHA | grep | `grep -c 71369f80d099e25726ad04382f15aef14a251abc .github/workflows/lint.yml` → 1 | old SHA | ✅ |
| PIFL-06 | engines + NFR-4 text | grep | `node -p 'require("./package.json").engines.node'`; `rg -n "20\.19" AGENTS.md .planning/PROJECT.md` → none | old floor | manual |
| PIFL-07 | Stop + engine canaries live | live-only | Pattern 9 recipes; verifier reads README "Observed result (2026-10-xx, pi 1.0.0 / engine 3.13.1)" + negative-control lines | any canary not exit-as-documented | ✅ drivers |
| PIFL-07 | `pi.sh` pins | grep | `rg -n "pi-mcp-adapter@5.0.0|pi-subagents@0.74.0|pi-dynamic-workflows@3.13.1" scripts/pi.sh` → 3 | old pins | ✅ |
| ADET-01 | built-in-only + neither → marker | unit + e2e mock + RPC | `node --test tests/platform/pi-api.test.ts`; `npm run test:e2e` (install-soft-deps matrix + RPC test) | marker missing in built-in-only state | ❌ RPC test, ✅ matrix (edit) |
| ADET-02 | `mcp-adapter`/`:N` command or source counts; bare `mcp` does not; arms independent | unit | `node --test tests/platform/pi-api.test.ts` (rows: adapter, disableProxyTool command-only, fork, `mcp-adapter:2`, foreign `mcp` tool, throwing getCommands + adapter tool source, both throw) | any row flips | ✅ (edit) |
| D-01-01/02 | renamed token everywhere; full-token assertions | architecture + unit | `npm run test:architecture` (COMPAT-01, closed-set locks/enrollment, catalog UAT, vocabulary guard); planted control: temporarily restore `"requires pi-mcp"` in `soft-dep.ts:35` → typecheck fails (`_UncoveredReason`) | old token reappears; open substring passes on either token | ✅ (edit) |
| D-01-14 IN-04/IN-05 | clear missing-sandbox error; group swept on clean exit | e2e unit-ish | case in the RPC test file calling `runRpcSession` with a missing `cwd` → rejects with "does not exist" | raw ENOENT | ❌ |
| D-01-17 | rule enabled, no disable | lint + grep | `npm run lint`; `rg -n "no-unsafe-enum-assignment" eslint.config.js extensions` → none | disable comment added | ✅ |
| D-01-10 | stamps match diffs | review + grep | `rg -n "3\.13\.1" docs/workflows-compatibility.md`; diff recipe output recorded in plan summary | a changed body stamped unchanged | manual |

### Sampling Rate
- **Per task commit:** owner tests for touched files; pre-commit (`check:changed`, which escalates to full for config/shared-support/e2e paths).
- **Per wave merge:** `npm run check` (unpiped log, `CHECK_EXIT`) and, for waves touching `tests/e2e/`, `npm run test:e2e`.
- **Phase gate:** `npm run check` + `npm run test:e2e` + `PI_SUBAGENTS_ROOT` integration run (0 skips) + recorded live canary runs, all green before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/platform/pi-inventory-seed.ts` — `toolInfo` (with `exposure`), adapter/built-in/foreign inventory seeds, `emptyPiInventory()`
- [ ] `expectSoftDepProbes` in `tests/edge/notification-boundary.ts` (port of features/mcp WR-08 helper)
- [ ] `tests/integration/pi-subagents-peer.ts` — shared loader
- [ ] `tests/e2e/_rpc.ts` + `tests/e2e/adapter-detection-rpc.test.ts` (name at planner's discretion)
- [ ] `tests/live-uat/openai-stub-server.mjs` (D-01-15)

## Security Domain

`security_enforcement` is absent from `.planning/config.json` (treated as enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes (probe reads untyped Pi metadata) | `unknown`-typed consumer views + `typeof` narrowing; throw ⇒ unloaded |
| V6 Cryptography | no | — |
| V10 Malicious code / supply chain | yes | lock regenerated by npm; no install scripts in bumped packages; companions never in the lock (D-98-10) |
| V14 Configuration | yes (test harness env) | RPC child env allowlist (no provider keys), sandbox containment, process-group kill |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Foreign extension registers `mcp` to suppress the warning | Spoofing | ADET-02: bare `mcp` tool no longer counts (live false positive reproduced today) |
| RPC child reaches a real provider with inherited credentials | Information disclosure | env built from scratch (`HOME`, `PI_CODING_AGENT_DIR`, `PI_OFFLINE`, `PATH` only) |
| Test writes into the operator's real Pi dir (adapter writes `-builtin:mcp` to user settings) | Tampering | sandboxed `PI_CODING_AGENT_DIR`; canaries refuse paths outside `tmp/pi-uat`; real adapter never loaded in tests |
| Orphaned stdio MCP grandchildren | Denial of service | detached group + group SIGKILL on clean exit (IN-05) |
| Stub provider exposed on the network | Information disclosure | binds `127.0.0.1` only; logs no headers |

## Sources

### Primary (HIGH confidence)
- Tree reads this session: `extensions/pi-claude-marketplace/platform/pi-api.ts:1-207`, `shared/concerns/soft-dep.ts:1-77`, `shared/notification-types.ts:1-60,385-405`, `shared/notify-reasons.ts:80-125`, `shared/notify-context.ts:40-80,300-367`, `scripts/check-unused-type-members.contracts.json:685-800,895-910`, `scripts/check-changed.mjs:11-17,120-240`, `scripts/check-corresponding-tests.mjs:1-140`, `scripts/pi.sh:1-30,85-101,178-230`, `tests/architecture/{peer-floor,compat-01-no-expansion,closed-set-enrollment,notify-closed-set-locks,partial-vocabulary-guard,workflows-doc-pins}.test.ts` (relevant ranges), `tests/architecture/catalog-uat/mock-pi.ts`, `tests/e2e/{_helpers.ts,install-soft-deps.test.ts}`, `tests/platform/hermetic-environment.ts`, `tests/pi-runtime.ts`, `tests/live-uat/{README.md,stop-canary.mjs}`, `docs/workflows-compatibility.md` (stamp lines), `docs/output-catalog.md` (marker lines), `.github/workflows/{ci,lint}.yml`, `.fallowrc.json`, `package.json`, `package-lock.json` engines.
- `git show` of features/mcp: `tests/e2e/_rpc.ts`, `tests/e2e/builtin-mcp-rpc.test.ts`, `tests/edge/notification-boundary.ts`, `tests/integration/provenance-invisibility.test.ts`, `extensions/.../platform/pi-api.ts`, `.planning/phases/01-pi-0-99-floor-and-spike/01-REVIEW.md` (IN-01..IN-10) + `01-REVIEW-DISPOSITION.md`, `.planning/phases/02-built-in-mcp-detection/02-REVIEW.md` (IN-01..IN-05); commits `74162ca6`, `4f82096f`, `0febc4ea`, `4460d902`, `e0ccc16e`, `81d609b5`, `20e2bb16`, `284b1bad`, `503c32b9`, `a06b8ece`, `1ce19128`.
- Installed packages: `@earendil-works/pi-coding-agent@1.0.0` (`dist/core/slash-commands.d.ts`, `source-info.{d.ts,js}`, `extensions/types.d.ts:524-533,1115-1140,1230-1255`, `extensions/runner.js:540-640`, `extensions/loader.js:107-140,325-350`, `agent-session.js:2587-2700`, `package-manager.js`, `extensions/mcp/{config,index}.js`, `modes/rpc/rpc-types.d.ts`), `@typescript-eslint/eslint-plugin@8.71.0` rule source, `pi-mcp-adapter@5.0.0` `index.ts:1690-1705`, `pi-subagents@0.74.0` layout, `@quintinshaw/pi-dynamic-workflows@3.13.0/3.13.1` tarball diff, `strong-mock@9.2.2` README.
- Executed in scratch (`/var/tmp/mcp4-rs`): eslint/tsc/prettier/`lint:type-members`/`notify-context.test.ts` on fix variants; five real-Pi 1.0 RPC sessions; Stop canary with stub provider; both engine canaries + `--invert` controls at 3.13.1; npm registry `npm view` for every package (2026-10-02).
- `gsd-tools query package-legitimacy check` (2026-10-02).

### Secondary (MEDIUM confidence)
- `.planning/research/STACK.md`, `PITFALLS.md` (milestone research, 2026-10-01): fallow v3.31.0 peeled SHA, `pi-ai` peer gap measurements, prior scratch results.
- GitHub `typescript-eslint/typescript-eslint` issue search for `no-unsafe-enum-assignment` (#12951 closed, different case; #12956 performance).

### Tertiary (LOW confidence)
- WebSearch for the rule's false positive: no relevant result.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — registry re-read today; bumped tree typechecks and passes the type-member gate.
- Architecture (probe, RPC, seeds): HIGH — Pi 1.0 sources read and five live RPC sessions observed.
- Pitfalls: HIGH — pin counts, import widths and strict-mock behavior measured; canary behavior pre-run.
- Open Question 1 (info marker): HIGH that the gap exists; the resolution needs the user.

**Research date:** 2026-10-02
**Valid until:** 2026-10-16 (Pi, adapter and engine are releasing weekly; re-check `npm view` before the install step)

## Open Questions -- Resolved (2026-10-02, operator)

1. info marker: resolved by CONTEXT D-01-18 -- info gains a `requires:` line
   (every needed companion, `(missing)` when not loaded); ADET-01 keeps "info".
2. Delimited old-token guard: declined (D-01-19).
3. PRD NFR-4 / RH-4 rows: update in this phase (D-01-20).
4. Package legitimacy checkpoint: operator approved the bump set; no
   human-verify checkpoint (D-01-21).
