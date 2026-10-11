# Phase 1: Pi 1.0 floor and adapter-only detection - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Move the extension to Pi 1.0 and make the MCP soft-dependency probe count only
pi-mcp-adapter. Concretely: peers (Pi `>=1.0.0`, pi-subagents `>=0.74.0`,
pi-mcp-adapter `>=5.0.0` optional), dev dependencies at latest (TypeScript held
at `^6.0.3`), the features/mcp typing and peer-test fixes re-implemented at the
1.0 floor with re-derived contract pins, `engines.node` and NFR-4, the Stop and
engine canaries re-run live on Pi 1.0, `scripts/pi.sh` pins, and detection that
never mistakes Pi's built-in MCP (or a foreign `mcp` tool) for the adapter.

Requirements: PIFL-01..07, ADET-01, ADET-02. Adapter-file delivery, naming,
variables, migration and status belong to Phases 2-6.

**Claude Code position:** none applies. This phase covers Pi dependency floors
and the detection of a Pi companion extension; Claude Code ships MCP natively
and has no companion-extension concept. Every choice below is recommended from
Pi and project constraints (claude-code-compat-research: "no upstream position
known").

</domain>

<decisions>
## Implementation Decisions

Decision IDs below are milestone-scoped. v1.20 Phase 1 already cites
`D-01-07`, `D-01-32` and others in source, so source comments written in this
phase cite the requirement ID (`ADET-01`, `PIFL-04`, ...) instead of a
`D-01-NN` ID.

### Missing-adapter marker
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

### Detection proof
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

### Canaries (PIFL-07)
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

### features/mcp carry-over
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

### Locked by requirements (recorded for the planner, not re-discussed)
- **D-01-16:** `engines.node` becomes `^22.22.2 || ^24.15.0 || >=26.0.0`, the
  exact range `write-file-atomic@8` declares. It already sits inside Pi 1.0's
  `>=22.19.0`, so it is the floor both actually require (PIFL-06). NFR-4 says
  the same in `AGENTS.md` and `.planning/PROJECT.md`.
- **D-01-17:** `typescript-eslint`'s new `no-unsafe-enum-assignment` finding at
  `shared/notify-context.ts:345:30` is fixed in code, not disabled (PIFL-05).
  Research reads it as a likely false positive of a brand-new rule (the message
  names an empty enum), so the fix should make the computed access plainly
  non-enum rather than suppress the rule.

### Decided after research
- **D-01-18:** `/claude:plugin info` gains a `requires:` line. Today no info
  row carries a soft-dependency marker for any companion, so ADET-01's "and
  info" asked for something info never did. The line lists every companion
  the plugin's components need: agents need `pi-subagents`, mcp needs
  `pi-mcp-adapter`, workflows need `pi-dynamic-workflows`. A companion that is
  not loaded is tagged `(missing)`, for example
  `requires: pi-mcp-adapter (missing), pi-subagents`. The line is omitted when
  the plugin needs no companion. The names match the `{requires <name>}`
  marker names (D-01-01), so `pi-mcp-adapter`, never `pi-mcp`. The info plugin
  row itself gets no `{requires …}` brace (unchanged from today); the line
  carries the fact once. Placement, sort order of names, and whether the line
  appears on the `components: not resolved` row are planner decisions to settle
  against the existing info line order (`dependencies:` last, `note:` after it)
  and recorded in `docs/output-catalog.md` as a closed-catalog amendment with
  new `catalog-state` blocks. — **Reversibility:** costly — new catalog states
  and pinned info fixtures.
- **D-01-19:** No guard test for the old `requires pi-mcp` token. Tests pin the
  full new token (D-01-02) and that is the protection.
- **D-01-20:** The PRD rows that state NFR-4 (`prd.md:1038`) and RH-4
  (`prd.md:122`, `:629`) are updated in this phase alongside AGENTS.md and
  PROJECT.md, so no document keeps the old Node floor or the old detection
  rule.
- **D-01-21:** The operator approved the devDependency bump set in advance
  (Pi 1.0.0, pi-tui 1.0.0, typescript-eslint 8.71.0, eslint-plugin-sonarjs
  4.2.2, fallow 3.31.0, prettier 3.9.9, globals 17.13.0,
  eslint-plugin-import-x 4.17.1). The package-legitimacy check rated them
  "too new" only. No human-verify checkpoint before `npm install`.

### Claude's Discretion
- Plan split and wave order, with one constraint: contract pins move once.
  Detection lives in `platform/pi-api.ts` beside the two `types.d.ts` pins
  (`pi-api.ts:100:3`, `:108:3`), so pin re-derivation and the detection change
  are sequenced to touch the pins file once, after Prettier has run (Prettier
  moves pins).
- The name `ToolInventory` takes after the rename (D-01-14).
- How the IN-05 gate reads `package.json` (architecture test vs a shared
  constant), as long as it fails on drift.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research
- `.planning/research/STACK.md` — measured commands, the per-commit
  re-application table for `74162ca6`/`5b1d8ef6`/`dac3a245`/`69e0870a`/`4f82096f`,
  the Pi 0.87.1 -> 1.0.0 API delta, devDependency targets, the pi-mcp-adapter
  `pi-ai` peer gap, the fallow `lint.yml` SHA (`71369f80d099e25726ad04382f15aef14a251abc # v3.31.0`)
- `.planning/research/PITFALLS.md` §Pitfall 10 (detection), §Pitfall 12
  (replaying features/mcp), §Pitfall 13 (dev and CI environments)
- `.planning/research/SUMMARY.md` §Phase 1, §Open Decisions items 6-9, 14, 19, 20

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — PIFL-01..07, ADET-01, ADET-02 (ADET-02 amended by D-01-05)
- `.planning/ROADMAP.md` §Phase 1 — success criteria and notes

### features/mcp specifications (read with `git show`, re-implement, never cherry-pick)
- Commits `74162ca6` (test hunks only), `5b1d8ef6`, `dac3a245`, `69e0870a`,
  `4f82096f`, `0febc4ea`, `4460d902`, `e0ccc16e`, `4c6b8086`, `cdb490c9`, `8016fed7`
- `features/mcp:.planning/phases/01-pi-0-99-floor-and-spike/01-REVIEW-DISPOSITION.md`
  and `01-REVIEW.md` — IN-01..IN-10
- `features/mcp:.planning/phases/02-built-in-mcp-detection/02-REVIEW.md` — IN-02..IN-05
- `features/mcp:tests/e2e/_rpc.ts`, `features/mcp:tests/e2e/builtin-mcp-rpc.test.ts`

### Output vocabulary
- `docs/output-catalog.md` — soft-dep marker section (line ~69) and examples
- `docs/messaging-style-guide.md` — marker references (lines 9, 40, 91, 176)
- `docs/adr/v2-001-structured-notify.md` — computed soft-dep probe note

### Live UAT and engine docs
- `tests/live-uat/README.md` — canary prerequisites, runs, negative controls, observed results
- `docs/workflows-compatibility.md` — engine grades and version stamps

### Project rules
- `skills/local-verification/SKILL.md` — check scheduling
- `skills/typescript-google-style-review/SKILL.md`, `skills/typescript-comments/SKILL.md`,
  `skills/typescript-unit-testing/SKILL.md`, `skills/typescript-unit-testing-review/SKILL.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `platform/pi-api.ts`: `ToolInventory` (only `getAllTools()` today),
  `hasLoadedPiMcpAdapter` (tool `mcp` OR source contains `pi-mcp-adapter`),
  `softDepStatus`. `getCommands(): SlashCommandInfo[]` with `sourceInfo` is
  already in Pi's `ExtensionAPI` (0.87.1 `types.d.ts:1076`).
- `tests/e2e/install-soft-deps.test.ts`: mock-Pi soft-dep matrix with planted
  tools; extend it with the D-01-06 states.
- `tests/platform/hermetic-environment.ts`: exists on main; the features/mcp
  RPC test builds on it.
- `tests/live-uat/*.mjs`: four drivers, each with a
  `fallow-ignore-file unused-file` marker (precedent for D-01-15).

### Established Patterns
- Soft-dep markers are computed at render time from the probe
  (`shared/concerns/soft-dep.ts:66`, `shared/notify-reasons.ts:93`), never
  stored in `reasons` and never persisted, so the rename needs no state
  migration.
- Closed-set gates: `tests/architecture/closed-set-enrollment.test.ts`,
  `notify-closed-set-locks.test.ts`, `partial-vocabulary-guard.test.ts`,
  `compat-01-no-expansion.test.ts` pin the vocabulary; the rename updates them
  as an amendment, not an expansion.
- Floor gates: `tests/architecture/peer-floor.test.ts` (FLOOR-01) pins the Pi
  peer literal; `tests/architecture/workflows-doc-pins.test.ts` pins doc
  versions.
- Contract pins are `line:col` in
  `scripts/check-unused-type-members.contracts.json` (`406:5 -> 525:5`,
  `414:5 -> 533:5`); re-derive from the installed Pi 1.0 `types.d.ts` after
  `npm install` and after Prettier.
- pi-subagents peer tests: `tests/integration/provenance-invisibility.test.ts`,
  `tests/integration/skill-path-resolution.test.ts`.

### Integration Points
- `package.json` peers, devDependencies, `engines`; lock regenerated with
  `npm install`, never hand-merged.
- `scripts/pi.sh` `pi_cm_pins` (lines 97-100): adapter `2.37.0 -> 5.0.0`,
  pi-subagents `0.71.0 -> 0.74.0`, engine `3.13.0 -> 3.13.1`.
- `.github/workflows/lint.yml:56` fallow action SHA (`v3.28.0 -> v3.31.0`).
- Other `0.86.1` floor mentions: `README.md:38`, `README.es.md:38`,
  `AGENTS.md:61`, the PROJECT.md "Pi API" constraint,
  `tests/live-uat/README.md:211,239`, `tests/live-uat/stop-canary.mjs:226,228`.

</code_context>

<specifics>
## Specific Ideas

- Run `npm run check` with `TMPDIR` outside `/tmp` and an unpiped log that ends
  in `CHECK_EXIT` (the clone-cache temp-dir leak once exhausted `/tmp` inodes).
- A real-Pi run in a sandbox under the repository makes Pi ask for trust in
  every directory (the repo's `.agents/skills`); use a trust entry or a sandbox
  outside the repository.
- Pi 1.0 runs fullscreen by default; tmux or pexpect-driven checks may need
  `--tui-mode regular`.
- Adapter 5 writes `"-builtin:mcp"` into the user `settings.json` on first
  start; any run that loads the real adapter needs a sandboxed
  `PI_CODING_AGENT_DIR`.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-pi-1-0-floor-and-adapter-only-detection*
*Context gathered: 2026-10-02*
