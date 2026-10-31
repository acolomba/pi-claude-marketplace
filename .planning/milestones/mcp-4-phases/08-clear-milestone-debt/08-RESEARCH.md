# Phase 8: Clear milestone debt - Research

**Researched:** 2026-10-09
**Domain:** In-repo debt clearing: pi-mcp-adapter 5.2.0 entry semantics, fallow 3.31.0 audit attribution, own-key lookups on JSON state maps, notification severity model
**Confidence:** HIGH for the adapter, fallow and JS-semantics findings (each was probed live this session); MEDIUM for the wave plan (it rests on reading, not on a full `npm run check`)

## Summary

Read the eight design questions in this order: four findings change the plan and two of them contradict the CONTEXT premise.

1. **DEBT-01 needs one fix to pass.** fallow `audit` gates only on clone groups the branch *introduces* (`--gate new-only` is the default). At HEAD only 2 of the 14 groups are introduced, and both are in `tests/architecture/catalog-uat/fixtures/plugin-info.ts`. I hoisted the shared `commit-commands` row in a scratch clone. That one change took the verdict from `warn` to `pass`, and `tsc --noEmit` stayed clean. The other 12 groups are inherited and do not gate. **But edits inside an inherited group's span turn it into an introduced group.** I tested this: rewriting the `state.marketplaces[...]` lookups in `orchestrators/plugin/shared.ts`, as OWNKEY-01 will, turned 2 inherited groups into introduced ones and the verdict went back to `warn`. Run the audit last, after every wave.
2. **D-08-02 (MCPOVR-01): neither listed candidate is clean. Use a third shape that stays within D-08-02's constraints.** pi-mcp-adapter loads a marker-less stub that no other source defines as a real server. I probed this. The adapter skips a `{disabled:true}` stub, but still lists it as a disabled server. For any other carried field, `connect` throws `Server <key> must configure exactly one of command, url, or socket`. Init reports that throw as an `error` notify. So option (a) breaks every non-`disabled` choice. Option (b), a `state.json` store, needs two files written in sequence, a schema change, and every unstage caller changed. **Recommended:** keep the choices in a top-level member of the same `mcp-adapter.json`, outside `mcpServers`. The adapter's `validateConfig` ignores unknown top-level keys (probed), and its own writers keep them. So one atomic write moves a choice out of the entry when it leaves, and back in when it is staged.
3. **D-08-03 (MCPROW-01) rests on a misread.** Two facts:
   - `(installed)` *is* the catalog's normal enable row (`enable-fresh`).
   - MCP notices never raise the enable row's severity.

   The warning in `tests/integration/mcp-variable-expansion.test.ts:314-343` comes from SEV-01, the `{requires pi-mcp-adapter}` raise for an unloaded companion. install takes the same raise. When the adapter is loaded, enable already renders an info row with separate warning notice lines. import already renders an info row with separate notices. The code change is likely zero. The real question is whether SEV-01 should stay on enable. That question goes to the operator (Open Question 1).
4. **D-08-04 (WR-02) side check: OAuth mode refuses three header shapes this extension writes** (probed against the adapter's `resolveOAuthHeaders`):
   - a kept `${VAR}` that is unset;
   - a withheld credential written as `""`;
   - any value that holds the split token `{env:PI_CLAUDE_MARKETPLACE_EMPTY}`. That variable is set to `""`, and the adapter counts `""` as missing.

   The first two are what CONTEXT predicted. The split-token case is new.

The other questions (D-08-05, D-08-06, D-08-07) have direct answers, given in the sections below.

**Primary recommendation:**
- Land the plugin-info hoist (DEBT-01) and the disjoint batches first.
- Implement D-08-02 as a top-level choice store in `mcp-adapter.json`, composed in `bridges/mcp/adapter-doc.ts`.
- Treat D-08-03 as a test-and-record task until the operator rules on SEV-01.
- Run D-08-06, then OWNKEY-01, last and alone.
- Re-run `npx fallow audit --base $(git merge-base origin/main HEAD)` after every plan that edits a file with an inherited clone span.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Carried fields

- **D-08-01:** `openUi` and `trace` join `CARRIED_FIELDS`
  (`bridges/mcp/adapter-entry.ts`). Both are user preferences in
  pi-mcp-adapter's `ServerEntry` with no credential content, the same class
  as `debug`. The AFILE-06 pin test against `ServerEntry` changes with it.

#### MCPOVR-01: per-server choices outlive the plugin lifecycle

- **D-08-02:** A user's per-server choices (the carried fields, including
  `disabled` from `/mcp-adapter disable`) live apart from the plugin's
  lifecycle. They survive update and reinstall (already true, AFILE-06),
  plugin disable then enable, AND uninstall then reinstall. Upstream
  evidence: Claude Code 2.1.296 stores the `/mcp` choice in
  `~/.claude.json` `projects[<path>].disabledMcpServers`, keyed by
  `plugin:<plugin>:<server>`, and no plugin disable, enable or uninstall
  code touches it (`08-UPSTREAM-EVIDENCE.md` §1). The operator: "it's ok for
  the two lifecycles to be separate."
- Storage is Claude's discretion, with constraints: the choices must sit
  outside the entry that disable and uninstall remove; they are keyed by
  the generated server key (one key builder, `domain/name.ts`); writes stay
  atomic (NFR-1) and inside the NFR-10 write set; a `/reload` alone must
  converge (NFR-2). Candidates: a marker-less user stub left in
  `mcp-adapter.json` (the D-02-21 `keptOverride` / stub write-back path
  already does this for absorbed overrides; check how pi-mcp-adapter
  treats a stub no other source defines), or a scope-level store in
  `state.json` that outlives the install record. Research which one
  pi-mcp-adapter tolerates and pick the simpler.
- Divergence to document: upstream keys the choice per project; ours is per
  scope file. Record it as a Pi capability gap in `docs/mcp-compatibility.md`.

#### MCPROW-01: success row plus separate notices

- **D-08-03:** `enable` of a plugin whose servers carry unset variables or
  withheld credentials renders the normal enabled row at info severity, not
  `(installed)` at warning. The MCP variable notices render as their own
  warning lines, as `install` does. `import` rows show the same notices the
  same way. Upstream reports enable and install as plain success and shows
  missing-variable warnings separately (`/mcp`, `claude mcp list`);
  `08-UPSTREAM-EVIDENCE.md` §2. Showing the notice at enable and import is a
  Pi capability gap (Pi has no `/mcp`). Renderer, `docs/output-catalog.md`
  and the pinned tests change together; follow the tri-state severity model
  (info = desired state reached, warning = carried out but short).

#### WR-02: OAuth with headers (parity fix)

- **D-08-04:** Write `auth: "oauth"` on a remote (http/sse) entry whose
  `headers` is non-empty and has no `Authorization` key
  (case-insensitive); otherwise leave `auth` unset. This matches Claude
  Code 2.1.296, which builds its OAuth provider unless `headers` carries
  Authorization (or a headersHelper mints one), with or without an `oauth`
  object; pi-mcp-adapter turns OAuth off for any non-empty `headers`
  unless `auth: "oauth"` is set (`08-UPSTREAM-EVIDENCE.md` §3). The
  Phase 3 UAT acceptance carried no decision ID and no capability gap, so
  the parity default applies. Fix the `03-REVIEW.md` claim "Claude keeps
  OAuth in both cases" in the docs: true only without Authorization.
  Side check: in OAuth mode the adapter refuses to connect when a header
  `${VAR}` is unset or empty, where upstream warns and keeps the raw text;
  confirm what `bridges/mcp/substitute.ts` writes and record the result.

#### Phase 5 remedy rows (IN-07, IN-08)

- **D-08-05:** Make both remedies true.
  - IN-08: reinstall falls back to a fresh clone when the mirror HEAD is
    unreadable (`orchestrators/plugin/reinstall-clone-probe.ts`), so the
    existing `reinstall` remedy works and retries are safe (NFR-3). Network
    use stays inside the existing git-source cache-miss rule (NFR-5).
  - IN-07: the warm recorded-sha clone that lacks the plugin subdir
    (`missing-subdir` / `escapes`) gets a row naming
    `/claude:plugin update <plugin>@<marketplace>`. Amend D-05-02 and the
    catalog block together.

#### Phase 4 IN-02: explicit environment

- **D-08-06:** Thread a `ClaudeEnv` through the install ledger,
  update-swap, reinstall-replace and the reconcile migration into
  `prepareStageMcpServers`, defaulting to `process.env` at the entry point
  the way `orchestrators/plugin/info.ts` already does. House DI rule
  (CONVENTIONS "Dependency injection over test-only seams"). Its own plan:
  it collides with the migration and OWNKEY-01 batches.

#### OWNKEY-01: inherited keys

- **D-08-07:** Name-indexed lookups on plain-object state maps refuse
  inherited keys (`constructor`, `__proto__`, `toString`, ...). Fix at the
  source as well as the reads: names are validated by `assertSafeName`,
  which lets `constructor` and `__proto__` through; a `__proto__` key in a
  write drops the record. Triage counts 131 lookups in 30 files; a shared
  helper (e.g. `shared/own-key.ts`) plus a name-validation rule is the
  expected shape. Planner decides the split (triage suggests two waves).

#### Fallow audit (PR blocker)

- **D-08-08:** `npx fallow audit --base <merge-base with origin/main>`
  must read `pass`. At `24d2d904` it reads `warn` with 14 clone groups:
  - 4 are new on this branch: the two `tests/architecture/catalog-uat/fixtures/plugin-info.ts`
    groups (P3 WR-05; hoist the shared fixture row), `bridges/agents/stage.ts:514`
    vs `bridges/skills/stage.ts:563`, and the live-uat canary pair
    `tests/live-uat/manifest-absence-canary.mjs:631` vs
    `tests/live-uat/stop-canary.mjs:485` (main's `ignoredClones` key
    `dup:cc950b18:2` no longer matches after this branch edited
    `stop-canary.mjs`).
  - 10 exist on main unchanged in content; the audit counts them because
    this branch edited lines inside their spans (all share the
    mid-expression hash `c77b3abb6f87acd9`, so their `-rN` handles cannot
    be `ignoredClones` keys).
  Remove the new groups by refactoring. For the 10 pre-existing groups,
  extract where cheap and safe; otherwise use the house precedent, a
  `fallow-ignore-next-line code-duplication -- <reason>` marker on a
  reviewed group (CONVENTIONS "Suppressions"), and update the marker count
  there. Re-run the audit after every change; marker spans move.

### Claude's Discretion

- Every `fix` and `wontfix` classification in `08-TRIAGE.md`, unless a
  plan finds the triage wrong at HEAD (then record why). `wontfix` rows
  get their reason written into the disposition file.
- Plan split and wave order. Triage batches A-H touch disjoint files and
  can share a wave; OWNKEY-01 (batch I), D-08-06 and any catalog-wide
  change (D-08-03, D-08-05 IN-07) run alone or after the batches they
  collide with.
- Wording of new or changed catalog rows, within the notification grammar
  (subject-first rows; `Error:`/`Warning:` followed by a summary).

### Deferred Ideas (OUT OF SCOPE)

- P7 IN-06 sub-item (absolute path in a verbatim canary transcript):
  wontfix per triage; masking it requires a live re-run.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEBT-01 | `npx fallow audit` against the merge-base with `origin/main` reads `pass`, so the Lint `fallow-audit` job passes the PR. | §Fallow audit: only 2 groups are introduced, both are in `plugin-info.ts`, and the hoist alone gives `pass` (verified). Edits inside inherited spans turn those groups into introduced ones (verified), so the final audit must run after every wave. One marker on one instance hides the whole group (verified). |
| DEBT-02 | Every review finding of Phases 1-7 reads `fixed`, `wontfix` with a reason, or `already-fixed` in its disposition file; none reads `open`, `deferred` or `skipped`. | §Disposition ledgers: current tallies per ledger; Phase 7 has no ledger yet; GSD's ledger parser accepts only `open\|fixed\|skipped\|deferred` (a pitfall). |
| DEBT-03 | Per-server choices, now including `openUi` and `trace`, survive update, reinstall, plugin disable then enable, and uninstall then reinstall (D-08-01, D-08-02; closes MCPOVR-01). | §D-08-02 storage: adapter behavior was probed; the top-level choice store is recommended; the touch points are listed. |
| DEBT-04 | enable/import success rows with separate notices (D-08-03); OAuth kept beside non-Authorization headers (D-08-04); Phase 5 remedies work (D-08-05); explicit staging environment (D-08-06); own-key lookups (D-08-07). | Sections D-08-03, D-08-04, D-08-05, D-08-06 and OWNKEY-01 below. |
| DEBT-05 | ROADMAP Phase 1 criterion 4, the `STATE.md` ADET-02 wording, and the review disposition ledgers match the code. | §Records: the exact lines are confirmed at HEAD. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Upstream parity:** Claude Code's behavior is the default. Only two things license a divergence: a recorded decision ID, or a Pi capability gap. "Simpler" does not license one; take such a case to the operator as a question.
- **NFR-1:** every disk mutation is atomic (`shared/atomic-json.ts` / `write-file-atomic`).
- **NFR-2:** `/reload` alone must converge.
- **NFR-3:** every operation is idempotent or fails clean.
- **NFR-5:** network only for git-source install/update/reinstall on a cache miss. `list`, `info`, `uninstall` and path-source operations never touch the network. ESLint BLOCK F is default-deny for `orchestrators/` and `domain/` outside `NETWORK_SEAMS`.
- **NFR-10:** writes stay in `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp-adapter.json` and `<scopeRoot>/mcp.json`.
- **IL-2:** all user output goes through `shared/notification-dispatch.ts`. The `notify-chokepoint` rule pack enforces this.
- **Quality bar (NFR-6):** `npm run check` stays green. It covers typecheck, ESLint (`--max-warnings 0`), fallow (dead code, health with `maxCognitive 15`/`maxCyclomatic 20`, dupes, rule pack), Prettier, source/test pairing, and 100% direct coverage per pair.
- **Two cognitive-complexity gates:** ESLint `sonarjs/cognitive-complexity: 15` and fallow `maxCognitive: 15`. They disagree, so satisfy both.
- **No `!`/`as` escape hatches** in `extensions/`. Compiler-forced unreachable branches are not dead code (memory).
- **Pairing:** every new production module (e.g. `shared/own-key.ts`) needs exactly one mirrored test (`tests/shared/own-key.test.ts`) at 100% direct coverage. Cases use AAA comments, are hermetic, and touch no real `~/.pi/agent`.
- **DI rule:** do not default a parameter to a live boundary; wire real adapters in one composition module (`skills/typescript-unit-testing/SKILL.md` §Design). This bears on D-08-06; see below.
- **Comments:** cite durable IDs (`D-08-0N`, `AFILE-06`); no phase or plan references (`skills/typescript-comments`).
- **Git:** never commit to `main`; Conventional Commits; run `SKIP=npm-check pre-commit run --files ...` before committing; never `--no-verify`; never `git add -A`, because the operator edits files mid-session (memory).
- **GSD gates** run `npm run check` on the combined tree after each wave.
- **Tests that need the adapter:** `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`.
- **Tests that need pi-subagents:** `PI_SUBAGENTS_ROOT=/var/tmp/mcp4-reverify-p1/subagents/node_modules/pi-subagents` (0.74.0, present; verified).
- **Scratch:** `TMPDIR=/var/tmp/mcp4-p8-research`. `/tmp` is at 80% of its inode cap (verified with `df -i`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Carried-field set (D-08-01) | bridges-mcp (`adapter-entry.ts`) | tests (`adapter-entry.test.ts` pins) | Entry content belongs only in `adapter-entry.ts` / the closed table (module header). |
| Choice store capture/consume (D-08-02) | bridges-mcp (`adapter-doc.ts` composer, `stage.ts`, `unstage.ts`) | — | The one composer, `withPluginServers`, already decides what an owned entry leaves behind. A store in the same document needs no orchestrator change. |
| `auth: "oauth"` rule (D-08-04) | domain (`mcp-server-features.ts` closed table) | bridges-mcp (substitute writes header values) | The closed table owns every translated field (ANAME-07). |
| Enable/import row severity (D-08-03) | orchestrators (`enable-disable.ts::freshEnableRow`, `import/execute.ts`) | shared (`notifyMcpConfigNotices`) | Commands stamp severity; `notify.ts` is a dumb renderer (memory). |
| Reinstall mirror fallback (D-08-05 IN-08) | orchestrators (`reinstall-clone-probe.ts`, `git-source-probe.ts`) | — | Source choice is an orchestrator concern; clone-cache is the network seam. |
| Migration remedy row (D-08-05 IN-07) | orchestrators (`reconcile/mcp-migration.ts`) | shared (`notification-dispatch.ts` row text), docs catalog | The row type and its text live in the dispatch chokepoint. |
| Staging environment (D-08-06) | orchestrators (composition: `operations.ts`, reconcile wiring) | bridges-mcp (`StageMcpInput.env`) | Composition roots bind `process.env`; logic takes it as a parameter. |
| Own-key lookups (D-08-07) | shared (`own-key.ts`, leaf) | domain (`name.ts` rule), every orchestrator/persistence/edge site | `shared/` is the only zone that every zone may import. |

## Standard Stack

No new packages. Everything uses the existing stack.

### Core (already installed, versions verified this session)
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| fallow | 3.31.0 [VERIFIED: `npx fallow --version`] | audit / dupes gate | The CI action pin is the same 3.31.0 SHA [VERIFIED: `.github/workflows/lint.yml:73`] |
| pi-mcp-adapter (scratch, optional peer) | 5.2.0 [VERIFIED: package.json in `/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`] | conformance target | Pi loads the TS sources at the package root (`exports "." -> ./index.ts`); `dist/` is the compiled copy used for probes |
| Node | v26.11.1 [VERIFIED: `node --version`] | runtime | CI runs on Node 24 |
| typebox | existing | state / manifest schemas | `STATE_SCHEMA` is unchanged under the recommended D-08-02 design |

## Package Legitimacy Audit

Not applicable: this phase installs no external packages.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Fallow audit (D-08-08 / DEBT-01)

### What gates the verdict [VERIFIED: `npx fallow audit --help`, fallow 3.31.0]

> "By default, only findings introduced by the changeset affect the verdict; inherited findings are reported with new-vs-inherited attribution and individual JSON findings include `introduced: true/false`."

Audit at HEAD `7f76dc6e`, base `369eaec352cb99c91ae3b5d3324d9c27ba9e9152` (the merge-base) [VERIFIED: run this session]:
`"verdict":"warn"`, `"duplication_introduced":2,"duplication_inherited":12,"duplication_demoted":1`.

| # | Instances (HEAD lines) | introduced | Planned edits inside the span? | Recommendation |
|---|------------------------|-----------|--------------------------------|----------------|
| r13 | `tests/architecture/catalog-uat/fixtures/plugin-info.ts:8-26 / 31-49 / 55-73` | **true** | WR-05 | **Extract.** Hoist the row to `const COMMIT_COMMANDS_INSTALLED = {...} as const` and spread it into each fixture. Verified in a scratch clone: the verdict becomes `pass`, 0 introduced, and `tsc --noEmit` is clean. |
| r1 | `plugin-info.ts:31-50 / 55-80` | **true** | WR-05 | The same hoist removes it (verified). |
| r3 | `tests/live-uat/manifest-absence-canary.mjs:631-648 / stop-canary.mjs:485-506` | false (`demotion_reason: "no-added-lines"`) | P1 IN-02 edits `:321`/`:399` (outside the span). P1 IN-06 wants a justification. | **Marker.** One `// fallow-ignore-next-line code-duplication -- <reason>` above the spawn+timeout block. It doubles as the IN-06 justification. Extracting would need a new imported `.mjs` helper that is unreachable from the entry graph, which needs its own `fallow-ignore-file unused-file`. That costs more and makes no sense for drop-in operator scripts. `ignoredClones` is not possible: the fingerprint is the mid-expression hash. |
| r6 | `bridges/agents/stage.ts:514-523 / bridges/skills/stage.ts:563-572` | false | none planned | **Marker**, per house precedent (`bridges/agents/stage.ts:382`, `bridges/commands/stage.ts:462` already mark the same commit-and-rollback shape). Extraction would need a cross-bridge helper in `shared/fs-utils.ts`. |
| r11 / r14 | `orchestrators/plugin/shared.ts:293-311 / 953-970` and `:311-327 / 970-982` | false today | **YES: OWNKEY-01** | **Extract during the OWNKEY wave.** I rewrote the lookups to `ownValue(...)` in a scratch clone: both groups turned into introduced ones and the verdict went to `warn` (verified). The duplicate is the explicit-scope "requested → other scope" resolution. A helper parameterized by a `present(state)` predicate removes both. If extraction trips a complexity gate, use one marker per group. |
| r8 | `orchestrators/plugin/install-flow.ts:1681-1715 / 2411-2441` | false | **Likely D-08-06** (both spans are the option objects passed to the install cascade; adding `env` to both would edit inside the spans) | Re-audit after D-08-06. If the group turns introduced, either extract a `cascadeOptions(...)` builder or add a marker. [ASSUMED that the edit lands inside the span] |
| r9 | `orchestrators/plugin/enable-disable.messaging.ts:79-90 / install.messaging.ts:108-123` | false | Only if D-08-03 changes the enable render map | Re-audit after D-08-03. A marker per house precedent (the render-map arms already carry one at `enable-disable.messaging.ts:91`). |
| r5 | `shared/notification-dispatch.ts:1075-1085 / 1121-1131` | false | Batch C edits `:641-655` and `:869-872` (outside the span) | Leave it. Re-audit. |
| r7 | `domain/plugin-resolver.ts:428-443 / 470-485` | false | The name rule (OWNKEY) touches `:515` (outside) | Leave it. Re-audit. |
| r12 | `tests/architecture/catalog-uat/fixtures/plugin-list.ts:93-123 / 270-300` | false | none | Leave it. |
| r2 | `orchestrators/plugin/reinstall.messaging.ts:373-387 / orchestrators/reconcile/apply-outcomes.ts:666-680` | false | none | Leave it. |
| r4 | `orchestrators/plugin/info.ts:2179-2193 / 2289-2303` | false | P3 IN-04 (`:2972-2986`) and OWNKEY sites (`:1258`, `:3016`, ...) are outside | Leave it. Re-audit. |
| r10 | `orchestrators/plugin/install-flow.ts:831-842 / uninstall.ts:929-940` | false | none | Cheap extraction is possible: a workflows-staging-GC logging helper in a non-ledger module. Both callers are `PLUGIN_LEDGERS`, so the helper cannot live in either. Optional. |

**Marker semantics, verified on fallow 3.31.0 this session:** I put one `fallow-ignore-next-line code-duplication` above the first line of ONE instance of the r11 group. The whole group left the audit report. The other group, whose span did not contain the marked line, stayed. So one marker per group is enough. Place it where the next line is inside a reviewed instance. CONVENTIONS warns that fallow never reports a `code-duplication` marker as stale.

**Records to fix (P1 IN-06):**
- `.fallowrc.json` on this branch has no `ignoredClones`. The branch deleted `"ignoredClones": ["dup:cc950b18:2"]` [VERIFIED: `git diff 369eaec3 HEAD -- .fallowrc.json`].
- `.planning/codebase/CONVENTIONS.md` and `STACK.md` still describe that key. The "exactly 20 markers / eight `code-duplication`" counts must change with every marker added [VERIFIED: `rg -n "fallow-ignore" extensions tests scripts` = 20 lines, 8 of them `code-duplication`].
- Merge hazard: main still has the key. A later merge of main can bring it back. Keep the branch side.

**CI gate** [VERIFIED: `.github/workflows/lint.yml:71-87`]: the job fails on `verdict == 'warn'` or `analysis-degraded == 'true'`. It runs `npm ci --ignore-scripts` first, so local runs need `node_modules` present to match.

## D-08-02 / DEBT-03: where per-server choices live

### What pi-mcp-adapter 5.2.0 does with a stub no other source defines (VERIFIED by probe)

I wrote this user file into a hermetic HOME/`PI_CODING_AGENT_DIR` under `/var/tmp/mcp4-p8-research`, then called `loadMcpConfig` from `dist/config.js`:

```json
{ "_piClaudeMarketplace": { "choices": { "plugin_p_s_": { "disabled": true } } },
  "mcpServers": { "plugin_p_s_": { "excludeTools": ["x"] }, "plugin_p_d_": { "disabled": true } } }
```

- Effective config: `{"mcpServers":{"plugin_p_s_":{"excludeTools":["x"]},"plugin_p_d_":{"disabled":true}}}`. **Both stubs become servers.** The unknown top-level member is dropped silently, with no warning printed.
- `new McpServerManager(cwd).connect(name, def)` results:
  - `plugin_p_s_` → `Server plugin_p_s_ must configure exactly one of command, url, or socket`
  - `plugin_p_d_` → `MCP server "plugin_p_d_" is disabled`
- Source of the transport check: `server-manager.ts:1148`.
- Startup handling (`init.ts:281-438`):
  - Disabled entries are filtered out. When all are disabled, it shows `MCP: All N server(s) are disabled` (info).
  - A non-disabled stub enters `startupServers`. That means always for `eager`/`keep-alive`, and for lazy servers when uncached. Its failure is shown as `ui.notify("MCP: Failed to connect to <name>: ...", "error")`.
  - For lazy servers the failure is cached as `discoveryFailed` by config hash, so it is tried once, then again on first use. Eager servers fail on every startup.
  - The status, footer and panel list a disabled stub as a `disabled` server (`mcp-status.ts:22-44`).
- `validateConfig` keeps only `mcpServers`/`mcp-servers`, `imports`, `settings`, `claudePlugins` (`config.ts:1294-1305`). An unknown top-level key is ignored.
- The adapter's own writers (`readRawConfigObject` → modify → `writeRawConfigObject` = `JSON.stringify(raw)`, `config.ts:1621-1661`) keep unknown top-level keys.
- **`/mcp-adapter disable` writes to the PROJECT file**, not to the plugin's entry in the user file. Evidence:
  - `writeProjectServerDisabledOverride` uses `getProjectPiConfigPath(cwd)` = `<cwd>/.pi/mcp-adapter.json` whatever the server's scope (`config.ts:1726-1776`, `233-235`).
  - Disable writes `{...existing, disabled: true}`, which keeps an existing marker.
  - Enable removes `disabled` and deletes an entry left empty.
- Consequences of that write target:
  - For a **user-scope** plugin, the `/mcp-adapter disable` choice already lives outside the plugin's entry. It already survives the plugin lifecycle, and it is per project, as upstream's is.
  - For a **project-scope** plugin, the choice lands inside the plugin's marked entry. Disable or uninstall then removes it (MCPOVR-01).
  - Hand-edited carried fields in either scope's marked entry are lost the same way.
- `docs/mcp-compatibility.md:172` ("`/mcp-adapter disable` writes `disabled: true`" in the plugin's entry) is accurate only at project scope. Fix it alongside D-08-02.

### Options compared

| Criterion | (a) marker-less stub in `mcpServers` | (b) scope store in `state.json` | **(c) top-level choice store in `mcp-adapter.json` (recommended)** |
|-----------|-----------------------------------|-------------------------------|------------------------------------------------------------|
| Adapter tolerance | **Fails.** Any non-`disabled` field gives a connect error at startup (`error` notify). A `disabled` stub shows as a ghost server while the plugin is disabled or uninstalled. | Invisible to the adapter | Ignored silently (probed) |
| NFR-1 atomic | One write | **Two files:** the bridge's unstage write to `mcp-adapter.json`, then the orchestrator's `saveState`. A failure between them loses the choice. | One write. The choice moves from entry to store inside the same document write. |
| NFR-2 `/reload` converges | yes | yes, if every stage path reads it | yes. Every staging path (install, cascade, enable, import, update, reinstall, reconcile, migration) goes through `prepareStageMcpServers`, which reads the target doc. |
| NFR-3 retry-safe | yes | Partial-failure window above | Capture is idempotent: once the entry is gone there is nothing left to capture, and the store keeps the value. Consume is idempotent too. |
| NFR-10 write set | in set | in set | in set (same file) |
| Code surface | bridges-mcp | `STATE_SCHEMA`, `loadState` normalization (an unthreaded top-level field is dropped, as with `lastReconciledExtensionVersion`, BFILL-02, `state-io.ts:497-512`), every unstage caller (uninstall, disable, prune, marketplace remove, reconcile, cascade undo) and every stage caller | bridges-mcp only: `adapter-doc.ts` (compose), `stage.ts` (read into `stampServers`), `unstage.ts` (adapter target only), `marker.ts`/`adapter-entry.ts` helpers |
| New user contract | none | none | Yes: a top-level member name. Proposed `_piClaudeMarketplace` with `serverChoices: { <generatedKey>: { <carried fields> } }`, parallel to the MC-5 per-entry marker. The member name is the planner's call; confirm it with the operator if in doubt. |

D-08-02 lists (a) and (b) as candidates and leaves storage to Claude's discretion within its constraints. (c) meets every listed constraint: outside the removed entry, keyed by the generated key, atomic, inside NFR-10, converges on `/reload`. (a) fails the "pi-mcp-adapter tolerates" test. (c) is simpler than (b).

### Recommended mechanics, option (c)

1. **Capture** (whenever one of the plugin's own entries leaves the adapter file without being restaged: disable, uninstall, prune, marketplace remove, cascade undo, an update that drops a server):
   - Store the entry's *user* carried fields, `CARRIED_FIELDS` minus the marker's `pluginSetFields` (ANAME-07).
   - Leave out fields the written-back `keptOverride` stub already holds (D-02-21 path, `restoredOverride`).
   - Write nothing when the result is empty.
   - Implement it in `withPluginServers`/`survivingEntry` (`adapter-doc.ts:308-387`), which already decides what each owned entry leaves behind.
   - **Never write the store into the legacy `mcp.json`.** `unstage.ts` calls the same composer for `PI_MCP_SERVER_KEYS`, so make capture an explicit step for the adapter target only.
2. **Consume** (stage):
   - Pass the stored choices for each new key into `stampServers` as the lowest-precedence `previous` source. Today `previous` is `{ ...ours, ...overlays }`; that order then becomes store < ours < overlay.
   - Delete the consumed keys from the store in the same `_nextDoc` write. A choice then lives in exactly one place: in the live entry while the server is staged, and in the store while it is not.
   - A restage that finds a previous entry keeps today's AFILE-06 carry and drops any stale store copy.
3. **Rollback:**
   - A single-plugin install already restores the exact prior bytes (D-02-11), so the store comes back with them.
   - A failed cascade unwinds by marker-keyed unstage, which re-captures the same fields (D-02-18). No new rollback code is needed.
4. **Interaction with P2 IN-05:** an emptied kept override must not be written back as `{}`. Fix it in the same `survivingEntry` change. Combining the two is natural.
5. **Docs:**
   - `docs/mcp-compatibility.md` §User overrides: the carried list plus `openUi` and `trace`, and the lifecycle rule.
   - Add a Pi-capability-gap row: upstream keys the choice per project, ours per scope file.
   - Note that user-scope `/mcp-adapter disable` already writes a per-project stub.
   - `docs/output-catalog.md` mcp-override-kept prose: the carried list.

### Files and tests (DEBT-03)

- `bridges/mcp/adapter-entry.ts`: `CARRIED_FIELDS` gains `"openUi"`, `"trace"`. [VERIFIED: `adapter-entry.ts:41-51` currently reads `"disabled", "approveTools", "includeTools", "excludeTools", "lifecycle", "idleTimeout", "requestTimeoutMs", "debug", "searchKeywords"`.] Both are members of the adapter's `ServerEntry`: `openUi?: boolean;` (`types.ts:497`) and `trace?: boolean;` (`types.ts:501`) [VERIFIED: read this session].
- `tests/bridges/mcp/adapter-entry.test.ts` changes:
  - `CARRIED_KEYS` (`:73-83`)
  - the exact-JSON carried expectation (`:1042`)
  - `SERVER_ENTRY_KEYS` (`:16-52`), which already lists `openUi` and `trace`
- Store tests:
  - `tests/bridges/mcp/adapter-doc.test.ts`, `stage.test.ts`, `unstage.test.ts`
  - `tests/integration/mcp-override-lifecycle.test.ts`: new cases for project-scope `disabled: true` + `openUi` across disable→enable and uninstall→reinstall
  - One conformance case under `PI_MCP_ADAPTER_ROOT`, loading `dist/config.js` with a hermetic HOME, that proves the adapter ignores the store member

## D-08-03 / MCPROW-01: enable and import rows

### What the code does today (VERIFIED by reading)

- Enable row severity is computed in `orchestrators/plugin/enable-disable.ts:2862-2895` (`freshEnableRow`). There are three raises: malformed degrade, `staleWorkflowCommand`, and `companionSeverity(...)` (SEV-01, unloaded companion). **MCP config notices never raise the row.**
- The notices go out separately, after the rows, through `notifyMcpConfigNotices(ctx, sink.mcpConfigNotices)` (`enable-disable.ts:2450, 2475`). Each section is one `ctx.ui.notify(..., "warning")` (`shared/notification-dispatch.ts:466-475`).
- The catalog's normal enable row is `● foo-plugin v1.2.3 (installed)`, info (`docs/output-catalog.md` `enable-fresh`, §`/claude:plugin enable`, ~line 3825). `enable-soft-dep` documents `A plugin operation needs attention.` + `{requires pi-subagents}` at warning per SEV-01 / WR-06.
- The pinned integration case `tests/integration/mcp-variable-expansion.test.ts:314-343` expects `"A plugin operation needs attention.\n\n● mp [project]\n  ● hello v1.0.0 (installed) {requires pi-mcp-adapter}\n\n/reload to pick up changes"` at `"warning"`, then two separate warning notices. Pi has no adapter loaded in that case, so the warning is SEV-01. The update case (`:265-270`) shows the same raise. Reinstall (`:303-307`) has no raise, by design (`reinstall.messaging.ts:367-371`).
- Import already renders an info row with the `{requires ...}` marker, then the two separate warning notices (`tests/orchestrators/import/execute.test.ts:1985-2007`). This matches catalog `soft-dep-markers` ("Severity: info").

### Consequence

D-08-03's target, "success row at info, notices as their own warning lines", already holds whenever pi-mcp-adapter is loaded. Only the adapter-unloaded case renders warning, and the SEV-01 raise does that, the same raise install takes (catalog line 583, `install-flow.ts:907`). D-08-03 says "as install does", so keeping SEV-01 keeps enable consistent with install. Dropping SEV-01 on enable would contradict the recorded SEV-01 / D-98-02 decision and the `enable-soft-dep` catalog block. That makes it an operator question (Open Question 1), not something to fix silently.

### Recommended work (pending the operator's answer)

- Add pinned tests with the adapter loaded (`makePi([], [adapterCommand()])`, already used at `tests/orchestrators/plugin/enable-disable.test.ts:7234`):
  - enable of a plugin with an unset variable gives `● mp [user]\n  ● foo v1.2.3 (installed)\n\n/reload to pick up changes` (info), then the `MCP server variables not set.` warning;
  - the same for import.
- Catalog: add one sentence under `/claude:plugin enable` pointing to the AVAR-04/05 notice blocks, which already list enable and the import cascade as emitters, and stating that the row keeps its own severity.
- Close MCPROW-01 in `.planning/BACKLOG.md` with this finding.
- If the operator rules that SEV-01 must not raise on enable, the change is `freshEnableRow`'s `companionSeverity` call. It needs a decision ID, an amendment to the `enable-soft-dep` catalog block, and changes to `mcp-variable-expansion.test.ts:339-340` plus the enable soft-dep unit tests. Re-audit fallow group r9 afterwards.

## D-08-04 / WR-02: `auth: "oauth"`

- **Where:** `domain/mcp-server-features.ts:151-153`. `remoteOptions(server)` returns `{ ...oauthField(server.oauth), ...remoteTimeoutField(server) }` [VERIFIED: read]. Add `auth: "oauth"` when `server.headers` is a plain object with at least one key and no key whose `toLowerCase() === "authorization"`.
  - The keys are known before expansion, and expansion never changes keys (`substitute.ts:87-98` copies keys verbatim).
  - Choose the field position deliberately: the tests compare `JSON.stringify` order.
- **AFILE-06 / ANAME-07 interaction:**
  - `auth` is not a carried field, so it is plugin-owned, like every closed-table field. The table rewrites it on every stage.
  - A user override holding `auth` stays inert and is reported by `inactiveOverrideFields` (`adapter-entry.ts:144-154`), as today.
  - The plugin's own declared `auth` is still dropped (the hostile-key test).
  - A user can still turn OAuth off with an `auth: false` stub in another source. The adapter merges overrides per field (`config.js:752-814`).
- **Tests that change:**
  - `tests/bridges/mcp/adapter-entry.test.ts:796-851`: the hostile sse server with `headers: {"X-Team":"core"}` now gains `auth: "oauth"`.
  - `tests/domain/mcp-server-features.test.ts:27-51` (sse with `X-Team`), `:82-89` (http/streamable-http with `{A:"1"}`), `:283-294` (an exact JSON string).
  - Add rows: Authorization key, lowercase `authorization`, `{}` headers, and no headers. None of these four gets `auth`.
- **Docs:**
  - `docs/mcp-compatibility.md:137` lists `auth` among dropped adapter-only fields. Reword it: the plugin's `auth` is dropped, and the extension writes `auth: "oauth"` itself under D-08-04.
  - Add a translated-field row.
  - Fix the "Claude keeps OAuth in both cases" claim (true only without Authorization).
- **Side check result (record it in docs and in the plan), VERIFIED by calling `resolveOAuthHeaders` from `dist/mcp-auth-fetch.js`** with `PI_CLAUDE_MARKETPLACE_EMPTY=""`:

  | Header value written by this extension | When | OAuth mode result |
  |---|---|---|
  | `acme` (literal) | plain header | OK |
  | `${SET_VAR}` | variable set at install, kept as a reference | OK |
  | `${UNSET_VAR}` | unset, no default (`claude-mcp-variables.ts:172-180` keeps a `ref` and reports missing) | **THROWS** `Missing environment credential in OAuth HTTP headers` |
  | `""` | remote-sink deny-listed variable (`deniedSegment`, `claude-mcp-variables.ts:120-142`) | **THROWS** `Failed to resolve OAuth HTTP headers` (empty after trim) |
  | `a{env:PI_CLAUDE_MARKETPLACE_EMPTY}b` | literal text holding an adapter trigger, or a reference followed by `[\w}]`/`:\w` (`adapter-escape.ts:16-30`, `MARKER_COMPLETION`) | **THROWS** `Missing environment credential...`. `applyMcpAdapterEnv` sets the variable to `""` (`shared/session-env.ts:112`), and the adapter treats `!process.env[name]` as missing (`mcp-auth-fetch.ts:19-22`). |
  | `Bearer ` | withheld credential inside a larger value | OK (trimmed to `Bearer`) |

  The first two refusals were expected; upstream keeps the raw text and warns. The third (split token) is new, and CONTEXT did not anticipate it. For a header like `X-Tenant: ${TENANT}_eu` with D-08-04 applied, the adapter refuses to connect even when `TENANT` is set.
  - Without `auth: "oauth"`, the adapter drops OAuth for any headers. That is today's behavior.
  - Options: write `auth` regardless (follows D-08-04; record the divergence), or skip `auth` when any header value holds the split token or an empty or unset value (narrows D-08-04).
  - Open Question 2.

## D-08-05: Phase 5 remedies

### IN-08 (reinstall falls back when the mirror HEAD is unreadable)

- `orchestrators/plugin/reinstall-clone-probe.ts:51-61`: `readMirrorHeadSha(mirrorRoot)` throws on a missing or garbled `.git/HEAD` or `packed-refs` (`git-source-probe.ts:57-88`). Wrap that read. On a throw, fall through to the existing recorded-sha path (`:63-75`).
- That path is `materializePluginClone({ pin: recordedSha })` under key `pluginCloneKey(cloneUrl, pin)`, a different directory from the URL-keyed mirror (`clone-cache.ts:189-231`).
  - A present key directory is a warm offline hit.
  - Otherwise it clones into staging and promotes atomically, which is retry-safe.
- **NFR-5:** an unreadable mirror cannot serve the build, so it is a cache miss for a git-source reinstall. That is inside the amended NFR-5. `reinstall-clone-probe.ts` names no git identifier (it reaches git through `clone-cache.ts`, a `NETWORK_SEAMS` member), so BLOCK F is unaffected. [VERIFIED: file read]
- **Keep the migration presence probe aligned.** `makeRecordedShaPresenceProbe` is documented as "reinstall's source choice ... with `not-cached` in place of the clone" (`git-source-probe.ts:195-215`). Give `probeMirror` the same throw→fall-through (to `probeShaClone`). It stays file-read only, so it is still network-free.
  - The pinned `headless-mirror` case (`tests/orchestrators/reconcile/mcp-migration.test.ts:1215-1230`) seeds no sha clone, so it still yields `source-unreadable`.
  - Its `reinstall` remedy is now true.
- **Tests:** `tests/orchestrators/plugin/reinstall-clone-probe.test.ts` gets a headless mirror whose seam `materializePluginClone` fake is called with the recorded pin; `tests/orchestrators/plugin/git-source-probe.test.ts` gets the fall-through.

### IN-07 (moved subdir names `update`)

- Today `offlineCloneRead` (`orchestrators/reconcile/mcp-migration.ts:258-283`) sets `unread = result.kind === "not-cached"`. A `missing-subdir`/`escapes` result from the warm clone therefore becomes `marketplace-unreadable` (`:318-322`).
- [VERIFIED: `mcp-migration.ts:253`] `type OfflineMiss = "not-listed" | "source-unreadable" | "marketplace-unreadable";`
- [VERIFIED: `domain/resolver-types.ts:184-192`] `GitPluginRootResult` kinds: `"materialized"`, `"not-cached"`, `"escapes"`, `"missing-subdir"`.
- Add a fourth miss for those two kinds from the clone read, and a matching row kind in `shared/notification-dispatch.ts` (row types `:478-622`, text `leftRowLine` `:762-781`) whose text names `/claude:plugin update <plugin>@<marketplace>`. Keep `printable(...)` on every interpolated name.
- **Lockstep set:**
  - `docs/output-catalog.md`: a new block near the `marketplace-unreadable` block (~line 4409)
  - `tests/architecture/mcp-migration-notice.test.ts`: a states table at ~`:105`; byte-equal to the catalog at `:221`
  - `tests/shared/notification-dispatch.test.ts`
  - `tests/orchestrators/reconcile/mcp-migration.test.ts`
  - `.planning/phases/05-automatic-migration-on-reload/05-CONTEXT.md:56-68` (the D-05-02 amendment)
- This collides with Batch B (`mcp-migration.ts`) and Batch C (`notification-dispatch.ts`), so sequence it after both. D-08-06 also edits `mcp-migration.ts`.

## D-08-06: explicit `ClaudeEnv` for staging

- **Today:** `bridges/mcp/stage.ts:485` `env: input.env ?? process.env`; `StageMcpInput.env?: ClaudeEnv | undefined` (`bridges/mcp/types.ts:39-43`) [VERIFIED: read].
- **The four staging callers** [VERIFIED: grep + read]:
  - `orchestrators/plugin/install-outcome.ts:966` (`mcpPhase`, reached through `runInstallLedger(state, locations, options: InstallLedgerOptions, capture?, transaction?)`, `:628-641`)
  - `orchestrators/plugin/update-swap.ts:323`
  - `orchestrators/plugin/reinstall-replace.ts:450` (through `operations.prepareStageMcpServers`)
  - `orchestrators/reconcile/mcp-migration.ts:439` (through `operations.prepareStageMcpServers`)
- **`runInstallLedger` callers:**
  - `install-flow.ts:1197`
  - `install-cascade.ts:988, 1137` (`seam.runInstallLedger`)
  - `enable-disable.ts:384, 897` (`transaction.runInstallLedger`)
  - import and reconcile reach these through the install and enable operations.
- **Info precedent:** `createGetPluginInfo(reader, env: ClaudeEnv = process.env)` (`orchestrators/plugin/info.ts:3202-3207`), bound at `operations.ts:191` through the default. The unit-testing skill forbids defaulting a parameter to a live boundary and says to wire it in one composition module. Reconcile the two by binding `process.env` explicitly in the composition module (`orchestrators/plugin/operations.ts`, next to `INSTALL_TRANSACTION` / `ENABLE_DISABLE_TRANSACTION` / `REAL_REINSTALL_TRANSACTION`, and at the reconcile and migration wiring) rather than as a default parameter deep in logic.
- **Prescriptive method:**
  - Make `StageMcpInput.env` required and delete the `?? process.env`.
  - Add a required `env: ClaudeEnv` to `InstallLedgerOptions`, the update-swap and reinstall-replace staging inputs, and `McpMigrationInput`.
  - Let `tsc` list every call site that fails, up to the composition roots, and bind `process.env` only there.
  - Expect M size, touching hot files (install-outcome, update-swap, reinstall-replace, mcp-migration, install-flow, install-cascade, enable-disable, reconcile/apply, import/execute, operations.ts).
- **Tests on the global sentinel** `${PI_CM_UNSET_IN_EVERY_ENV}`, 3 occurrences [VERIFIED: grep]:
  - `tests/orchestrators/plugin/install-flow.test.ts`
  - `tests/orchestrators/plugin/enable-disable.test.ts`
  - `tests/orchestrators/plugin/install-cascade.test.ts`

  Once `env` is explicit, these can pass `{}` instead of trusting the sentinel. The suites that mutate `process.env` keep working through the composition-root binding:
  - `tests/integration/mcp-variable-expansion.test.ts`
  - `tests/orchestrators/import/execute.test.ts`
  - `tests/orchestrators/reconcile/apply.test.ts`
  - `tests/bridges/mcp/stage.test.ts`
- **Fallow:** group r8 (`install-flow.ts` cascade option objects) is likely to turn introduced. Re-audit.

## OWNKEY-01 / D-08-07: inherited keys

### JS semantics (VERIFIED with node this session)

| Operation | `__proto__` key | `constructor` key |
|-----------|-----------------|-------------------|
| `JSON.parse('{"__proto__":{...}}')` | own property; prototype intact | own |
| `Object.fromEntries([["__proto__",1]])` (used by `migrateLegacyMarketplaceRecords`, `persistence/migrate.ts:283`) | own | own |
| `{...obj}` spread / `{[k]: v}` computed literal | own | own |
| `Object.assign({}, obj)` | **lost** (setter) | own |
| `obj[k] = v` on a `{}` | **lost** (reparents; `JSON.stringify` gives `{}`) | own |
| `({})[k]` read | `Object.prototype` (object) | **inherited function** |
| `delete obj[k]` | deletes own only, safe | safe |
| `Object.hasOwn(obj, k)` | correct | correct |

So `loadState` already yields own keys for every name. The bugs are reads, where inherited members look like records, and bracket writes with `__proto__`.

### Sites [VERIFIED: grep at HEAD]

- 131 non-comment matches of `(marketplaces|plugins)\??\.?\[[A-Za-z_][A-Za-z0-9_.]*\]` in 32 files. That is 2 more files than the triage counted: `bridges/hooks/routing-state.ts` (2) and `orchestrators/reconcile/types.ts` (1).
- Heaviest files:
  - `orchestrators/plugin/shared.ts`: 21
  - `import/execute.ts`: 11
  - `plugin/reinstall-targets.ts`: 10
  - `plugin/enable-disable.ts`: 9
  - `plugin/install-outcome.ts`: 8
  - `plugin/install-cascade.ts`: 7
  - `marketplace/autoupdate.ts`: 7
  - `plugin/info.ts`: 5
  - `marketplace/remove.ts`: 5
- Sites keyed by `` `${plugin}@${marketplace}` `` (config `plugins[key]`, `merged.plugins[pluginKey]`) can never be a prototype member, because the key always contains `@`. Leave them alone or convert them for uniformity.
- **Write sites that drop a `__proto__` record:**
  - `marketplace/add.ts:899, 1072`
  - `install-outcome.ts:473, 1131`
  - `install-disable-cascade.ts:185`
  - `enable-disable.ts:862, 1458`
  - `install-cascade.ts:1162`
  - `reinstall-record.ts:161`
  - `plugin/shared.ts:1270`
  - `import/execute.ts:1243, 1286, 1316`
  - `marketplace/autoupdate.ts:378`
- **Precedent:** `ownValue<T>(map, key)` already exists, module-private, in `orchestrators/reconcile/mcp-migration.ts:159-162` ("so a marker string such as `constructor` names no record"). Write-side precedent: `bridges/mcp/safe-set.ts` (defineProperty for `__proto__`). That one lives in the bridges-mcp zone, which `persistence/` cannot import.

### Recommended shape

- **`shared/own-key.ts`** (leaf; every zone may import it) with:
  - `ownValue<T>(map: Readonly<Record<string, T>>, key: string): T | undefined` (`Object.hasOwn`)
  - `setOwn<T>(map: Record<string, T>, key: string, value: T): void` (`Object.defineProperty`, enumerable/writable/configurable, as `safeSet`)

  Pair it with `tests/shared/own-key.test.ts` (100% direct coverage, data-driven over `Object.getOwnPropertyNames(Object.prototype)`). Replace mcp-migration's local `ownValue` with the import. Optionally re-point `bridges/mcp/safe-set.ts` at it; out of scope unless it is free.
- **Name rule.** Do not put it in `assertSafeName`. That helper also validates skill, command, agent and workflow names and clone keys (`persistence/locations.ts:317-381`, `bridges/*`), and a skill directory named `constructor` is harmless.
  - Add a dedicated predicate in `domain/name.ts` (e.g. `isReservedRecordKey(name)`, built from `Object.getOwnPropertyNames(Object.prototype)`).
  - Apply it where a name becomes a state key:
    - plugin entry names in the resolver (`domain/plugin-resolver.ts:515`, next to `assertSafeName(entry.name)`; surface it as an existing `unavailable`/malformed reason so the catalog does not change)
    - marketplace names at `marketplace add` (`orchestrators/marketplace/add.ts`, `derivedName`)
    - optionally dependency refs (`domain/dependencies.ts`)
  - CLI refs (`edge/handlers/plugin/shared.ts:27-37`) need no rule once reads use `ownValue`. A reserved name then reads as "not installed" / "marketplace not added", which is the upstream outcome for any unknown name.
- **Parity note** [VERIFIED: grep of the Claude Code 2.1.296 binary]: upstream's plugin and marketplace name rules reject path separators, `..`, `.`, spaces, control/bidi characters, a leading `.`, `MEMORY.md`, and Anthropic look-alikes. It warns on non-kebab-case. I found no prototype-name reservation, but absence of evidence is not proof. [ASSUMED that upstream accepts `constructor`] Of the `Object.prototype` names, only `constructor` is valid kebab-case. Rejecting it is a small divergence, and D-08-07 licenses it. Open Question 3 asks whether to reject the full set or only `__proto__`.

### Wave split

1. **OWNKEY wave 1** (after D-08-06 and every batch that edits `orchestrators/plugin/*`, `orchestrators/reconcile/*`, or `orchestrators/import/*`):
   - `shared/own-key.ts` + test; the `domain/name.ts` predicate + test; the resolver and `marketplace add` rule
   - the edge-reachable read paths: `plugin/info.ts` (`:1258, 3016, 3027, 3120, 3160`), `orchestrators/scope-fanout.ts`, `plugin/shared.ts` scope resolution (**extract the r11/r14 duplicate here**), `marketplace/shared.ts:626, 734, 914`, `plugin/uninstall.ts`, `plugin/enable-disable.ts`
   - hermetic tests: `info constructor@mp`, `info x@constructor`, `uninstall constructor@mp`, `enable constructor@mp`, `disable x@toString`
2. **OWNKEY wave 2:**
   - the rest: install family, update family, reinstall family, import, reconcile, autoupdate, list, `persistence/config-write-back.ts`, `edge/completions/data.ts`, `edge-deps.ts`, `bridges/hooks/routing-state.ts`
   - every write site through `setOwn`
   - P1 IN-01 comment rewords (same files)
   - an integration case: a manifest that declares a `__proto__` plugin is refused or unavailable, and `state.json` keeps every other record
3. Optional guard: an ESLint `no-restricted-syntax` selector banning computed member access on `.marketplaces`/`.plugins`. **Pitfall:** flat config replaces, not merges, `no-restricted-syntax` options for files matched by two blocks. BLOCK F already sets it for `orchestrators/**` and `domain/**` (`eslint.config.js:333-359`). Any new selector must be spread into BLOCK F's array *and* a separate block for the other extension files. Also, array-typed `plugins[i]` would false-positive. Recommend skipping it unless a measurement on the real tree is clean.

## Records and ledgers (DEBT-02, DEBT-05)

- **Ledger tallies at HEAD** [VERIFIED: grep of `| <status> |` cells]:

  | Ledger | Tally |
  |--------|-------|
  | `01-REVIEW-DISPOSITION.md` | 5 fixed / 11 open |
  | `02-...` | 7 fixed / 8 deferred / 1 skipped |
  | `03-...` | 10 open |
  | `04-...` | 7 fixed / 9 open |
  | `05-...` | 4 fixed / 8 open |
  | `06-...` | 1 fixed / 2 open |

  **Phase 7 has no `07-REVIEW-DISPOSITION.md`**. `07-REVIEW-FIX.md` records 8 fixed and the IN-06 sub-item skipped. DEBT-02 needs one, with the sub-item `wontfix` and the deferred reason.
- **Format:** YAML frontmatter `findings:` list (`id`, `severity`, `disposition`, `title`) + `open: N` + `total: N` + `recorded:`, then a Markdown table `| Finding | Severity | Disposition | Source |`. Hand edits must update both the frontmatter and the table, and set `open: 0`.
- **GSD enum pitfall** [VERIFIED: `.claude/gsd-core/workflows/execute-phase/steps/code-review-disposition.md:392, 898`]: the ledger row parser accepts only `(open|fixed|skipped|deferred)`. A `wontfix` or `already-fixed` cell fails to match and falls back to `open` the next time the code-review gate rewrites that phase's ledger. DEBT-02's vocabulary (`wontfix`, `already-fixed`) is outside the enum.
  - Old phases are not normally re-reviewed, so the risk is low.
  - Record in each ledger's source cell why the value is outside the enum. Do not run `/gsd-code-review` on Phases 1-7 afterwards.
  - Phase 8's own review ledger uses the tool's enum.
- **ROADMAP Phase 1 criterion 4** (`.planning/ROADMAP.md:99`) still names `scripts/pi.sh` pins "adapter 5.0.0 ... engine 3.13.1". Add an amendment note (D-04-12, D-07-07, quick task 261006-kr1), in the style criterion 3 uses at `:98`.
- **`.planning/STATE.md:636`** reads "... or by a command or tool sourceInfo.source containing pi-mcp-adapter". The code requires an *extension* command (`platform/pi-api.ts:204-213`, per triage). Note: `STATE.md:630` also says `pi-mcp-adapter >=5.0.0` (now `>=5.2.0`). It is historical, so add an amendment note if the planner wants full consistency.
- **BACKLOG:** close MCPOVR-01 (`.planning/BACKLOG.md:3796`) and MCPROW-01 (`:3820`).

## Architecture Patterns

### Data flow for D-08-02 (choice store)

```
user edit / /mcp-adapter disable (project scope) ──► marked entry in <scope>/mcp-adapter.json
                                                           │
   disable / uninstall / prune / mp remove / undo          │ unstageMcpServers → withPluginServers(config, p, mp, {})
   update that drops a server                               ▼
                                   ┌─ entry has restorable keptOverride? ─► write back restoredOverride (D-02-21/23)
                                   └─ user carried fields not in that stub ─► top-level store[<key>]   (same atomic write)
                                                           │
   enable / reinstall / install / reconcile / migration    │ prepareStageMcpServers → partitionServers + read store
                                                           ▼
                stampServers(previous = store[key] < ours[key] < overlays[key]) ─► new marked entry
                                   store[key] deleted in the same _nextDoc write
```

### Anti-Patterns to Avoid

- **Writing choices as a transport-less `mcpServers` entry.** The adapter turns it into a failing server (probed).
- **Putting the reserved-name rule in `assertSafeName`.** That widens a divergence to skill, command, agent and workflow names.
- **Extending one clone instance and not the other during a sweep.** Fallow re-keys the group as introduced (probed). Extract or mark in the same plan.
- **Defaulting `env` deep in logic.** Bind it at the composition module (unit-testing skill).
- **`git add -A` in a parallel-executor worktree.** Stage named files only (memory).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Own-key reads | per-site `Object.hasOwn` ternaries | `shared/own-key.ts::ownValue` | 131 sites; one tested helper; the precedent is already in `mcp-migration.ts:159` |
| `__proto__`-safe writes | `obj[k] = v` | `setOwn` (defineProperty) | A bracket write reparents the object |
| Atomic writes | `fs.writeFile` | `shared/atomic-json.ts` | NFR-1; the rule pack forbids `write-file-atomic` elsewhere |
| Clone suppression keys | `ignoredClones` with `-rN` handles | an inline `fallow-ignore-next-line code-duplication -- <reason>` | Mid-expression hashes give no stable key (CONVENTIONS) |
| User output | direct `ctx.ui.notify` | `notification-dispatch.ts` helpers | IL-2 rule pack |

## Runtime State Inventory

This is not a rename phase. D-08-02 changes the on-disk content of `mcp-adapter.json`.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `mcp-adapter.json` files have no store member. Choices that earlier disable or uninstall runs already lost cannot be recovered. | None. The store is additive; absent means empty. |
| Live service config | pi-mcp-adapter reads the file at load. It ignores the new member (probed). | None |
| OS-registered state | None (verified: no OS registration in this extension) | None |
| Secrets/env vars | `PI_CLAUDE_MARKETPLACE_EMPTY` is set to `""` at load (`session-env.ts:112`). D-08-04 interacts with it (see the side check). | None for D-08-02. Record the D-08-04 refusal. |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: An inherited clone group turns introduced mid-phase
**What goes wrong:** the audit is `pass` after WR-05, then `warn` again after OWNKEY or D-08-06.
**Why:** fallow attributes a group as introduced when the changeset edits lines inside its span. This was verified on `plugin/shared.ts`.
**How to avoid:** extract, or put one marker per group, in the plan that edits the span. Run the audit as the last step of every plan that touches a file listed in the fallow table.
**Warning signs:** `"duplication_introduced":` is greater than 0 in `npx fallow audit ... --format json`.

### Pitfall 2: The choice store is written into the legacy `mcp.json`
**What goes wrong:** Pi's own `mcp.json` gains an unknown top-level key. `unstage.ts` runs the same composer for both files.
**How to avoid:** add store capture for the adapter target only, and test it.

### Pitfall 3: D-08-04 refuses headers that hold kept references or split tokens
**What goes wrong:** a remote server with `X-Org: ${ORG}` (unset) or `X-Id: ${ID}_x` stops connecting once `auth: "oauth"` is written.
**How to avoid:** the operator decides (Open Question 2). Either way, record it in `docs/mcp-compatibility.md` §Divergences.

### Pitfall 4: A disposition vocabulary outside GSD's enum
**What goes wrong:** a later `/gsd-code-review` on an old phase resets `wontfix` rows to `open`.
**How to avoid:** set `open: 0` by hand, note the reason in the source cell, and do not re-run old phase reviews.

### Pitfall 5: The D-08-03 premise
**What goes wrong:** an executor "fixes" the enable severity by dropping SEV-01. That breaks the `enable-soft-dep` catalog block and install parity.
**How to avoid:** get the operator's answer before planning any renderer change.

### Pitfall 6: `no-restricted-syntax` override collision
**What goes wrong:** a new block silently disables the NFR-5 selectors for orchestrators and domain.
**How to avoid:** do not add the optional OWNKEY lint guard, or merge it into BLOCK F's array.

### Pitfall 7: Cognitive complexity in `survivingEntry`/`withPluginServers`
**What goes wrong:** store capture plus the IN-05 drop pushes the function past 15 on one of the two gates.
**How to avoid:** a separate pure helper (`capturedChoices(entry)`), unit-tested through the exported `withPluginServers`.

## Code Examples

### Own-key helper (shape)
```typescript
// shared/own-key.ts -- D-08-07: a state map keyed by user or manifest names
// reads only own keys, so `constructor` or `__proto__` names no record.
export function ownValue<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

export function setOwn<T>(map: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(map, key, { value, enumerable: true, writable: true, configurable: true });
}
```
Source: `orchestrators/reconcile/mcp-migration.ts:159-162` and `bridges/mcp/safe-set.ts:13-24` (in-repo precedents) [VERIFIED: read].

### Plugin-info fixture hoist (the DEBT-01 pass, verified in a scratch clone)
```typescript
const COMMIT_COMMANDS_INSTALLED = {
  status: "installed",
  name: "commit-commands",
  version: "1.2.0",
  description: "Helpful git commit commands for everyday use.",
  componentsResolved: true,
  components: { agents: ["review-bot"], commands: ["c1", "c2"], skills: ["commit-summary"] },
  requires: [{ companion: "pi-subagents", missing: false }],
} as const;
// each fixture: plugin: { ...COMMIT_COMMANDS_INSTALLED, dependencies: [...] }
```
Every value above is quoted from `tests/architecture/catalog-uat/fixtures/plugin-info.ts:15-26` [VERIFIED: read]. Run Prettier after the edit.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ignoredClones: ["dup:cc950b18:2"]` for the canary pair | No key on this branch; an inline marker is the only option | branch commit 5df69d88 / merge 8bebd44b | CONVENTIONS/STACK are stale |
| Per-entry choices only (AFILE-06 carry) | Plus a store that outlives the entry (D-08-02) | this phase | MCPOVR-01 closed |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-08-06's edits land inside the `install-flow.ts` r8 clone spans and turn the group introduced | Fallow table | Low: the audit re-run catches it |
| A2 | Upstream Claude Code accepts a plugin or marketplace named `constructor` or `__proto__` (no prototype reservation found; absence is not proof) | OWNKEY | A reserved-name rule may be more or less divergent than stated |
| A3 | The operator accepts a new top-level member in `mcp-adapter.json` as the D-08-02 store (within "storage is Claude's discretion") | D-08-02 | The planner may need a checkpoint to confirm the member name |
| A4 | pi-mcp-adapter's OAuth path works on `httpTransport: "sse"` entries the same as on http | D-08-04 | sse servers with headers might behave differently after D-08-04 |
| A5 | Old phases' code-review gates will not be re-run after the milestone, so out-of-enum ledger values persist | Ledgers | Rows could revert to `open` |

## Open Questions

1. **D-08-03 vs SEV-01.**
   - What we know: the enable warning in the pinned case is SEV-01 (adapter unloaded), not MCP notices. With the adapter loaded, the enable and import rows are already info, followed by separate warning notices. install takes the same SEV-01 raise.
   - What's unclear: whether the operator wants enable to drop SEV-01 (diverging from install and from catalog `enable-soft-dep`) or only wanted notices kept out of row severity (already true).
   - Recommendation: ask before planning. The default plan is tests + catalog note + close MCPROW-01, with no renderer change.
2. **D-08-04 refusal cases.**
   - Write `auth: "oauth"` exactly as decided and accept that the adapter refuses headers holding unset or empty references or split tokens? Or skip `auth` for such entries?
   - Recommendation: keep D-08-04 as written, because upstream also keeps OAuth there. Record all three refusal shapes as an adapter-side divergence in `docs/mcp-compatibility.md`. Surface the split-token case to the operator as new information.
3. **Reserved-name set for D-08-07.**
   - Reject all `Object.prototype` own names (12 names, including `constructor`), or only `__proto__`?
   - Recommendation: with complete own-key reads and writes, `__proto__` alone is enough for defense in depth, and it keeps a kebab-valid `constructor` installable, which is closer to upstream. CONTEXT's wording suggests both; confirm.
4. **The D-08-08 "4 new groups" premise.**
   - The audit marks only the 2 plugin-info groups as introduced. The canary and agents/skills pairs are inherited and do not gate.
   - Recommendation: still mark both (house precedent, and IN-06 asks for the canary justification), but do not spend extraction effort on them.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | everything | ✓ | v26.11.1 (CI: 24) | — |
| fallow | DEBT-01 | ✓ | 3.31.0, signed | — |
| pi-mcp-adapter scratch | conformance tests, D-08-02/04 probes | ✓ | 5.2.0 at `/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter` | none (tests throw on a wrong root) |
| pi-subagents scratch | pi-subagents peer tests in `npm run check` | ✓ | 0.74.0 at `/var/tmp/mcp4-reverify-p1/subagents/node_modules/pi-subagents` | The global 0.47.1 skips silently, which is not acceptable |
| Claude Code binary | parity greps | ✓ | 2.1.296 | docs |
| `/tmp` inodes | any test run | ⚠ 80% used | — | `TMPDIR=/var/tmp/...` |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in), strict TS run natively |
| Config file | `package.json` scripts; `scripts/test-coverage-direct.mjs` |
| Quick run command | `node --test <test-path>` (one owner test) |
| Full suite command | `npm run check` (static + unpaired + integration + direct coverage of all pairs) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEBT-01 | audit verdict `pass` against the merge-base | gate | `TMPDIR=/var/tmp/mcp4-p8-research npx fallow audit --base $(git merge-base origin/main HEAD) --format json \| node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);console.log(a.verdict,a.attribution.duplication_introduced);process.exit(a.verdict==="pass"?0:1)})'` | ✅ tool |
| DEBT-01 | the whole-tree fallow gate stays green | gate | `npm run fallow` | ✅ |
| DEBT-02 | no ledger reads open/deferred/skipped; Phase 7 ledger exists | doc check | `! grep -nE "disposition: (open\|deferred\|skipped)\|\\\| (open\|deferred\|skipped) \\\|" .planning/phases/0[1-7]-*/0[1-7]-REVIEW-DISPOSITION.md && ! grep -nE "^open: [1-9]" .planning/phases/0[1-7]-*/0[1-7]-REVIEW-DISPOSITION.md && test -f .planning/phases/07-docs-and-live-proof/07-REVIEW-DISPOSITION.md` | ❌ the Phase 7 ledger must be created |
| DEBT-03 | `openUi`/`trace` carried | unit | `node --test tests/bridges/mcp/adapter-entry.test.ts` | ✅ (update) |
| DEBT-03 | choice store capture/consume, no store in `mcp.json` | unit | `node --test tests/bridges/mcp/adapter-doc.test.ts tests/bridges/mcp/unstage.test.ts tests/bridges/mcp/stage.test.ts` | ✅ (new cases) |
| DEBT-03 | disable→enable and uninstall→reinstall keep `disabled`/`openUi` (project scope) | integration | `node --test tests/integration/mcp-override-lifecycle.test.ts` | ✅ (new cases) |
| DEBT-03 | the adapter ignores the store member | conformance | `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter node --test tests/integration/<new or existing conformance file>` | ❌ Wave 0 |
| DEBT-04 (D-08-03) | enable/import with the adapter loaded: info row, then separate warnings | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/import/execute.test.ts` | ✅ (new cases) |
| DEBT-04 (D-08-04) | `auth: "oauth"` rule | unit | `node --test tests/domain/mcp-server-features.test.ts tests/bridges/mcp/adapter-entry.test.ts` | ✅ (update) |
| DEBT-04 (D-08-05) | reinstall mirror fallback; presence-probe alignment; IN-07 row | unit + architecture | `node --test tests/orchestrators/plugin/reinstall-clone-probe.test.ts tests/orchestrators/plugin/git-source-probe.test.ts tests/orchestrators/reconcile/mcp-migration.test.ts tests/architecture/mcp-migration-notice.test.ts tests/shared/notification-dispatch.test.ts` | ✅ (new cases) |
| DEBT-04 (D-08-06) | staging uses the passed env, not the process env | unit | `node --test tests/bridges/mcp/stage.test.ts tests/orchestrators/plugin/install-outcome.test.ts tests/orchestrators/plugin/update-swap.test.ts tests/orchestrators/plugin/reinstall-replace.test.ts tests/orchestrators/reconcile/mcp-migration.test.ts` | ✅ (update) |
| DEBT-04 (D-08-07) | own-key helper; reserved names refused; `info/uninstall/enable constructor@mp` read as not found; a `__proto__` record is never dropped | unit + integration | `node --test tests/shared/own-key.test.ts tests/domain/name.test.ts tests/orchestrators/plugin/info.test.ts tests/orchestrators/plugin/uninstall.test.ts tests/orchestrators/plugin/enable-disable.test.ts` | ❌ `tests/shared/own-key.test.ts` (Wave 0) |
| DEBT-05 | ROADMAP criterion 4 amendment; STATE ADET-02 wording | doc check | `grep -n "D-04-12\|D-07-07" .planning/ROADMAP.md \| grep -n "99:"` and `grep -n "extension command" .planning/STATE.md` | ✅ |

### Sampling Rate
- **Per task commit:** the owner test (`node --test <path>`); the pre-commit hook runs `check:commit`.
- **Per plan that touches a fallow-table file:** the DEBT-01 audit command above.
- **Per wave merge:** `npm run check` with `PI_MCP_ADAPTER_ROOT` and `PI_SUBAGENTS_ROOT` set (the GSD gate, `workflow.test_command`).
- **Phase gate:** `npm run check` green and the audit at `pass` on the final tree, then the DEBT-02 grep.

### Wave 0 Gaps
- [ ] `tests/shared/own-key.test.ts`: pairs with the new `shared/own-key.ts` (pairing gate)
- [ ] An adapter conformance case for the store member (D-08-02), through `tests/integration/pi-mcp-adapter-peer.ts`'s `loadPiMcpAdapterModule`, with a hermetic HOME
- [ ] `.planning/phases/07-docs-and-live-proof/07-REVIEW-DISPOSITION.md`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (D-08-04 OAuth mode) | The adapter's OAuth provider. The extension writes only `auth: "oauth"` and never a credential. |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | typebox schemas; own-key reads (D-08-07); `printable(...)` on file-derived names in rows |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prototype-key confusion (`constructor@mp` reads a function as a record; a `__proto__` write drops a record) | Tampering / DoS | `ownValue`/`setOwn` + the reserved-name rule (D-08-07) |
| Choice store leaking credentials | Information disclosure | Store only `CARRIED_FIELDS`, which by construction carry no credential (`adapter-entry.ts:34-40` comment) |
| OAuth header refusal leaking values | Information disclosure | The adapter strips values from errors (`mcp-auth-fetch.ts:32-35`); the extension's notices name variables only |
| Hostile names in migration rows | Spoofing (terminal) | `printable` escaping; P5 IN-05 extends it to `\p{Cf}`, `\p{Zl}`, `\p{Zp}` |

## Sources

### Primary (HIGH confidence)
- pi-mcp-adapter 5.2.0 source and dist at `/var/tmp/mcp4-p7-research/a520/node_modules/pi-mcp-adapter`: `config.ts`/`config.js` (`loadMcpConfigWithSources`, `validateConfig`, `mergeServerMaps`, `writeProjectServerDisabledOverride`, raw writers), `server-manager.ts:1148`, `init.ts:281-438`, `types.ts:438-532`, `mcp-auth-fetch.ts:12-36`, `mcp-status.ts:18-78`. Three live probes (`loadMcpConfig`, `McpServerManager.connect`, `resolveOAuthHeaders`).
- fallow 3.31.0: `audit --help`; JSON audits at HEAD and in a scratch clone (hoist → `pass`; OWNKEY-style edit → introduced; single marker → group hidden).
- Repository reads at `7f76dc6e`: every file:line cited above.
- Claude Code 2.1.296 binary greps: plugin and marketplace name rules.
- `08-UPSTREAM-EVIDENCE.md`: upstream contract for D-08-02..04.

### Secondary (MEDIUM confidence)
- `08-TRIAGE.md` file:line evidence, spot-checked where cited.

### Tertiary (LOW confidence)
- A1-A5 in the Assumptions Log.

## Metadata

**Confidence breakdown:**
- Fallow behavior: HIGH (three live audits)
- Adapter behavior: HIGH (source + probes)
- D-08-03 diagnosis: HIGH (code + catalog + pinned tests agree)
- Wave plan and the D-08-06 surface: MEDIUM (`tsc`-driven discovery is prescribed, not pre-run)

**Research date:** 2026-10-09
**Valid until:** 2026-10-23, or until a merge from `main` moves the merge-base or fallow/adapter versions change
