# Phase 25: Runtime Publish & Verification - Research

**Researched:** 2026-05-29
**Domain:** Operational runtime delivery (`scripts/pi.sh` source-load) + byte-exact reproduction of two UAT findings (G-MIL-03 indent ladder, G-MIL-07 tab completion)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-25-01:** Delivery is the existing `scripts/pi.sh` (source-load `-e extensions/pi-claude-marketplace/index.ts` + `pi-subagents` + `pi-mcp-adapter` companions). NOT real `npm publish` / `npm link`. Companion loading is *better* fidelity than a bare publish/link (soft-dep probes resolve against real companion presence per SNM-16).
- **D-25-02:** Run reproductions under `scripts/pi.sh --home <tmp sandbox>` (sets `PI_CODING_AGENT_DIR` / `PI_CODING_AGENT_SESSION_DIR`). Sandbox is PRIMARY: reproducible, non-destructive. `--cd` controls cwd (the completion provider captures `process.cwd()` at registration).
- **D-25-03 (SNM-37 amendment, lockstep):** Amend SNM-37's "published to npm or npm-linked" wording to "loaded from source via `scripts/pi.sh` (sandbox home)." Purpose unchanged; only the methodology text. Amend in the SAME commit as the work (mirrors D-23-01 / D-24-03).
- **D-25-04 (SC#1 verification, behavioral not version-string):** `pi --version` is moot under a source-load (`-e` mode is not a separately-versioned package). The v1.4-identity proof is the BEHAVIORAL smoke -- a `/claude:plugin list` showing v1.4 catalog-conformant byte forms: no `/reload to pick up changes` trailer on read-only list, `v#<7hex>` hash display (SNM-35), `{lsp}` not `{lspServers}` (SNM-36). Reuse `runPiRuntimeSmoke` where it helps; the binding signal is the byte forms.
- **D-25-05:** Keep a real-`~/.pi`-home fallback for G-MIL-07 ONLY. If the sandbox does NOT reproduce G-MIL-07, a quick real-home spot-check confirms before concluding "refuted." G-MIL-03 (pure rendering) carries no such risk -- sandbox alone is sufficient.
- **D-25-06:** Packaged-artifact / real-publish validation is explicitly DEFERRED (recorded, not silently skipped). `scripts/pi.sh` does not validate the `files:` tarball or a real npm install. SNM-37 is not a release gate.
- **D-25-07:** Automate as much as possible first. G-MIL-03 byte-capture is FULLY automated -- capture leading-whitespace byte counts at the `ctx.ui.notify` boundary (before any tui/markdown rendering).
- **D-25-08:** For G-MIL-07, go straight to a live `scripts/pi.sh` interactive trigger with the user -- do NOT build a new harness layer. The unit test (`provider.test.ts:806`) already covers `getArgumentCompletions`; the suspected gap is tui consumption (live keystroke only). Final confirmation is an interactive escalation to the user.
- **D-25-09 (G-MIL-03 resolution boundary):** Byte-evidence first, then decide. If the renderer emits the catalog ladder correctly → observed 1/3 is a tui/markdown display artifact → record not-a-bug + catalog wording clarification, no renderer change. Only if the renderer *actually emits* a non-catalog ladder is it a real D-16-08 violation → fix at the renderer + byte-equality regression test.
- **D-25-10 (G-MIL-07 resolution boundary):** Root-cause first, then fix-or-defer. Candidates: (a) provider code-path divergence, (b) Pi-tui consumption of the `AutocompleteItem[]` payload, (c) `getInstalledPluginToMarketplacesMap` empty due to scope-root mismatch. If cause is OUR code → fix + regression. If cause is genuinely Pi-tui-external (`@earendil-works/pi-tui` behavior we don't own) → record finding + defer. Do NOT contort our code to fight the host.

### Claude's Discretion

- **Regression-test policy on a refuted finding:** whether to still add a byte-equality test locking the ladder even when G-MIL-03 is refuted (recommended default: yes -- cheap drift insurance, feeds Phase 26 GREEN gate), and similarly for G-MIL-07. Planner's call.
- **Exact sandbox fixture shape** (marketplaces + plugins): MUST include ≥1 installed plugin per marketplace (G-MIL-07 precondition) and a row exercising the `{...}` reason brace + an installed/available mix (G-MIL-03 ladder). Planner/executor own the concrete fixture.
- **Plan/wave decomposition.** SNM-37 is the gate; SNM-38 and SNM-39 parallelize after it. Likely: one setup/smoke plan (SNM-37) → SNM-38 plan ∥ SNM-39 plan. Planner owns the split.
- Whether `runPiRuntimeSmoke` is extended for the behavioral smoke or a new thin smoke is added -- discretion.

### Deferred Ideas (OUT OF SCOPE)

- **Real `npm publish` / packaged-artifact (release tarball) validation** -- out of v1.4.1 scope (D-25-06). `scripts/pi.sh` does not exercise the `files:` tarball or a real npm install. Belongs to an actual release effort.
- **State migration for already-installed hash-versioned plugins** -- carried from the v1.4.1 milestone deferral (REQUIREMENTS Out of Scope); not re-litigated here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (as amended by D-25) | Research Support |
|----|---------------------------------|------------------|
| SNM-37 | Load v0.2.0 source into an interactive Pi via `scripts/pi.sh` (sandbox home) [AMENDED from "npm publish/link" per D-25-03]; behavioral smoke confirms v1.4 conformance [AMENDED from "pi --version" per D-25-04]. Gating prerequisite for SNM-38/39. | `scripts/pi.sh` is a ready-made source-loader with companion bootstrap + `--home` sandboxing (verified). Behavioral smoke seam = `makeMockPi`/`makeCtx` notify-capture in `tests/e2e/_helpers.ts`. v1.4 byte forms verified against `docs/output-catalog.md` + catalog-uat test. |
| SNM-38 | G-MIL-03 (indent ladder) reproduced or refuted: leading-whitespace byte counts of `/claude:plugin list` vs catalog ladder. Real off-by-one → renderer fix + regression test; otherwise not-a-bug + catalog clarification. | **Evidence already conclusive: REFUTE.** Renderer emits catalog-conformant ladder (header column 0, plugin rows 2-space) -- verified by code read AND the existing `catalog-uat.test.ts` byte-equality gate. The UAT "truth" statement itself misquotes the contract (see Pitfall 1). |
| SNM-39 | G-MIL-07 (`update @<TAB>` empty) reproduced or refuted: fixture with ≥1 installed plugin per marketplace, trigger completion, capture. Real gap → root-cause + fix; otherwise not-a-bug / defer-with-rationale. | **Root cause already isolated: cause (b), Pi-tui-external → DEFER-WITH-FINDING.** `CombinedAutocompleteProvider.getSuggestions` intercepts any `@`-prefixed token for file-mention completion BEFORE delegating to our `getArgumentCompletions`. Verified in pi-tui 0.76.0 (the version `scripts/pi.sh` loads). Live trigger still required per D-25-08 to confirm the keystroke. |
</phase_requirements>

## Summary

This is an **operational + investigation** phase. No feature code is the deliverable -- the *reproductions* are. Two strong conclusions emerged from source inspection during research, both of which the plan should treat as the most-likely outcome while still executing the evidence-capture steps the user locked:

1. **G-MIL-03 (SNM-38) refutes by byte evidence.** The renderer emits the catalog-conformant ladder: marketplace header at **column 0**, plugin rows at **2-space** indent, cause-chain trailers at 4-space, rollback-phase causes at 6-space. This is enforced *today* by `tests/architecture/catalog-uat.test.ts` (byte-equality between `notify()` and `docs/output-catalog.md`), which is inside `npm run check`. The user's observed "1-space header / 3-space plugin" is a markdown/tui display artifact (the markdown renderer adds one leading space). Note: the UAT G-MIL-03 *truth* line itself misquotes the contract as "header at 2-space, plugin rows at 4-space" -- the catalog actually says "header at column 0; plugin rows two spaces beneath." The correct outcome is **not-a-bug + a catalog wording clarification** noting the display-layer caveat.

2. **G-MIL-07 (SNM-39) root-causes to a Pi-tui-external behavior → defer-with-finding.** `@earendil-works/pi-tui`'s `CombinedAutocompleteProvider.getSuggestions` (the host that drives our `SlashCommand.getArgumentCompletions`) checks `extractAtPrefix(textBeforeCursor)` **first**, before the slash-command argument branch. Any token whose first character after the last delimiter is `@` is routed to file-mention/fuzzy-file completion. For `/claude:plugin update @`, the `@` is intercepted; our `getArgumentCompletions` (which correctly returns `["@mp-a","@mp-b"]`, proven by `provider.test.ts:806`) is **never called**. If no files match in cwd the user sees nothing; if files exist they see file paths -- either way the bug is the interception. This is identical in pi-tui 0.74.2 (local) and 0.76.0 (the global version `scripts/pi.sh` actually loads). Cause (b); external to our code; **defer per SNM-39's "fix or defer" clause** -- do not contort our code to fight the host (D-25-10).

**SNM-37** delivery is solved: `scripts/pi.sh` already source-loads the extension + both companions and supports `--home <sandbox>`. The behavioral smoke (D-25-04) is fully automatable at the `ctx.ui.notify` boundary using the existing `makeMockPi`/`makeCtx` harness; the *interactive* `scripts/pi.sh` session is only strictly needed for the G-MIL-07 live keystroke confirmation (D-25-08).

**Primary recommendation:** Treat both findings as already-diagnosed (REFUTE / DEFER) but execute the locked evidence-capture steps anyway -- automated byte-capture for G-MIL-03, live interactive trigger for G-MIL-07 -- so the verdicts are *recorded with artifacts*, not asserted. Add the cheap regression tests (Claude's discretion: recommended yes). Amend SNM-37 + SC#1 wording in lockstep (D-25-03/04). No `npm publish`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Source-load delivery to runtime | CLI / process glue (`scripts/pi.sh`) | -- | The script execs the global `pi` bin with `-e` extension paths + sandbox env vars; it is the seam between the source tree and the runtime. |
| Behavioral smoke (byte forms) | Renderer (`shared/notify.ts`) | Test harness (`tests/e2e/_helpers.ts`) | Byte forms are produced by `notify()` and captured at `ctx.ui.notify`; the harness provides the capture seam. |
| G-MIL-03 indent ladder | Renderer (`shared/notify.ts` composers) | Catalog (`docs/output-catalog.md`) | The ladder is composed in `composeMarketplaceBlock`/`composePluginLines`; the catalog documents the canonical bytes. Both already agree. |
| G-MIL-07 completion delivery | **Host (`@earendil-works/pi-tui`)** | Our provider (`edge/completions/provider.ts`) | The `@`-precedence decision lives in pi-tui's `CombinedAutocompleteProvider`, NOT in our provider. Our provider is correct; the host intercepts. |
| Completion data resolution (scope roots) | Our resolver (`orchestrators/edge-deps.ts` → `persistence/locations.ts`) | Cache (`shared/completion-cache.ts`) | `makeLocationsResolver(process.cwd())` closes over cwd; this is candidate cause (c), ruled secondary by the cause-(b) finding but still spot-checked. |

## Standard Stack

No new packages. This phase installs nothing -- it exercises existing runtime + test infrastructure. The behavioral smoke and byte-capture reuse the existing `node:test` runner and the in-repo harness.

### Core (existing, carried forward)
| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| `scripts/pi.sh` | in-repo | Source-load delivery + sandbox home | The locked delivery mechanism (D-25-01); ready-made, no tooling to build. [VERIFIED: read `scripts/pi.sh`] |
| `node:test` runner | bundled Node ≥20.19 | Automated byte-capture + behavioral smoke + regression tests | Project's test framework; `npm run check` runs it. [VERIFIED: package.json scripts] |
| `tests/e2e/_helpers.ts` (`makeMockPi`, `makeCtx`, `runPiRuntimeSmoke`) | in-repo | Notify-capture harness + isolated-HOME runtime smoke | The byte-capture seam at `ctx.ui.notify` (D-25-07). [VERIFIED: read `_helpers.ts`] |
| `tests/architecture/catalog-uat.test.ts` | in-repo | Byte-equality between `notify()` and catalog | The existing G-MIL-03 regression gate; already locks the ladder. [VERIFIED: read test + catalog fixtures] |
| global `pi` (`@earendil-works/pi-coding-agent`) | **0.76.0** (global), 0.75.5 (local `.bin`) | The runtime `scripts/pi.sh` execs | `scripts/pi.sh` calls bare `pi`, resolving to the global install. [VERIFIED: `pi --version`, `command -v pi`] |
| `@earendil-works/pi-tui` | **0.76.0** (under global pi), 0.74.2 (local) | Hosts the completion provider; owns the `@`-precedence | The G-MIL-07 root-cause surface. [VERIFIED: read both compiled `autocomplete.js`] |

**Installation:** None.

**Version note (load-bearing for G-MIL-07):** `scripts/pi.sh` does `exec pi …`, which resolves to the **global** `pi` (0.76.0), whose bundled `pi-tui` is **0.76.0** -- NOT the repo's local `node_modules/@earendil-works/pi-tui@0.74.2`. The live G-MIL-07 trigger therefore exercises pi-tui 0.76.0. Research confirmed the `@`-interception logic is **byte-identical** between 0.74.2 and 0.76.0 (`extractAtPrefix` + `findLastDelimiter`, `PATH_DELIMITERS` set has no `@`), so the unit-test-version vs runtime-version gap does NOT change the verdict. [VERIFIED: diffed both compiled files]

## Package Legitimacy Audit

> Not applicable. This phase installs no external packages. All components are in-repo or already-present runtime dependencies. No slopcheck / registry verification required.

## Architecture Patterns

### System Architecture Diagram

```
SNM-37 DELIVERY + BEHAVIORAL SMOKE
==================================

  scripts/pi.sh --home <tmp> --cd <fixture>
        |
        | ensure_global_package pi-mcp-adapter, pi-subagents   (companions)
        | export PI_CODING_AGENT_DIR=<tmp>/agent
        | export PI_CODING_AGENT_SESSION_DIR=<tmp>/sessions
        v
  exec pi --no-extensions --no-skills --no-prompt-templates
          -e extensions/pi-claude-marketplace/index.ts
          -e <global>/pi-mcp-adapter/index.ts
          -e <global>/pi-subagents/src/extension/index.ts
        |
        v
  interactive Pi runtime (pi-tui 0.76.0)   <-- live G-MIL-07 trigger only

  --- automated behavioral smoke (preferred, D-25-07) bypasses the TUI ---
  node:test -> claudeMarketplaceExtension(makeMockPi())
            -> command.handler("list ...", makeCtx())
            -> notify(ctx, pi, NotificationMessage)
            -> ctx.ui.notify(bytes)   <== CAPTURE POINT (pre-tui)
            -> assert byte forms: no /reload trailer, v#<7hex>, {lsp}


G-MIL-03 INDENT LADDER (SNM-38)
===============================

  list orchestrator builds NotificationMessage (present/available rows)
        |
        v
  notify() -> composeMarketplaceBlock(mp)
        |        |
        |        +-- renderMpHeader(mp)            => "● name [scope] ..."   (0 leading spaces)
        |        +-- "  " + renderPluginRow(p)     => "  ● name v.. (..)"    (2 leading spaces)
        |        +-- renderIndentedCauseChain(c,"    ")  (4 spaces, failed/manual only)
        |        +-- rollback phase cause "      "        (6 spaces)
        v
  ctx.ui.notify(bytes)   <== count leading whitespace per line
        |
        v
  [pi-tui markdown render]  <-- ADDS a leading space  => user sees 1/3 (display artifact)


G-MIL-07 TAB COMPLETION (SNM-39)
================================

  keystroke "/claude:plugin update @" + Tab
        |
        v
  pi-tui CombinedAutocompleteProvider.getSuggestions(lines,...)
        |
        |  (1) atPrefix = extractAtPrefix(textBeforeCursor)
        |      findLastDelimiter -> tokenStart at "@"; text[tokenStart]==="@" -> returns "@"
        |  if (atPrefix) -> getFuzzyFileSuggestions("")   <<< INTERCEPTED HERE
        |      no files -> return null (user sees NOTHING)
        |      files    -> return file paths (also wrong)
        |
        |  (2) slash-command branch (NEVER REACHED for @-tokens):
        X----  command.getArgumentCompletions("update @")
               -> our getMarketplaceOnlyCompletions -> ["@mp-a","@mp-b"]  (correct, unreached)
```

### Pattern 1: Notify-boundary byte capture (the automated seam)
**What:** Drive the real `list` handler through `makeMockPi` + `makeCtx`; assert on `notifications[].message` -- the exact string passed to `ctx.ui.notify`, before any tui/markdown rendering.
**When to use:** SNM-37 behavioral smoke AND SNM-38 G-MIL-03 byte capture (both are pre-tui byte assertions).
**Example:**
```typescript
// Source: tests/e2e/_helpers.ts (makeMockPi / makeCtx) [VERIFIED]
const mock = makeMockPi(tools);
const { ctx, notifications } = makeCtx(env.cwd);
claudeMarketplaceExtension(mock.pi);
const command = mock.commands.get("claude:plugin");
await command.handler("list", ctx);
const body = notifications.at(-1)!.message;
// G-MIL-03: leading whitespace per line
const indents = body.split("\n").map((l) => l.length - l.trimStart().length);
// header lines -> 0, plugin rows -> 2 (catalog-conformant)
// SNM-37 behavioral smoke:
assert.doesNotMatch(body, /\/reload to pick up changes/);   // no trailer on read-only list
assert.match(body, /v#[0-9a-f]{7}\b/);                       // v#<7hex> hash display
assert.doesNotMatch(body, /lspServers/);                    // {lsp} not {lspServers}
```

### Pattern 2: Catalog byte-equality as the standing regression (G-MIL-03)
**What:** `tests/architecture/catalog-uat.test.ts` already pairs each `<!-- catalog-state: STATE -->` fenced block with a programmatic `NotificationMessage` and asserts byte-equality with `notify()` output. The `single-mp-mixed`, `same-plugin-both-scopes`, and `project-orphan-folded` list states encode the 0/2 ladder.
**When to use:** This IS the G-MIL-03 regression test. If the planner adds a fresh byte test it should mirror this pattern; otherwise cite this test as the existing lock.
**Example:**
```text
// Source: docs/output-catalog.md single-mp-mixed [VERIFIED]
● official [user] <autoupdate>      <-- 0 leading spaces (header, column 0)
  ● alpha v1.0.0 (installed)        <-- 2 leading spaces (plugin row)
  ⊘ epsilon (unavailable) {hooks, lsp}
  ○ gamma v2.0.0 (available)
```

### Pattern 3: Live interactive completion trigger (G-MIL-07, D-25-08)
**What:** Launch `scripts/pi.sh --home <sandbox> --cd <fixture-project>`, type `/claude:plugin update @`, press Tab, capture the result. Escalate to the user for the keystroke (no programmable TTY harness -- D-25-08 forbids building one).
**When to use:** SNM-39 confirmation ONLY. The root cause is already known from source; this records the live artifact.
**Note:** To make the file-interception visible/unambiguous, run from a `--cd` whose directory has NO files matching `@` (so the user sees *nothing*, matching the original report) OR note that a cwd with files shows *file paths* -- both confirm the same interception.

### Anti-Patterns to Avoid
- **Real `npm publish` / `npm link`:** Forbidden (D-25-01/06). Use `scripts/pi.sh`.
- **Building a programmable completion-keystroke harness for G-MIL-07:** Forbidden (D-25-08). The unit test already covers the provider; the gap is host consumption -- go live.
- **"Fixing" G-MIL-07 in our code by avoiding `@`-leading completions:** Forbidden (D-25-10). The cause is pi-tui-external; defer-with-finding. Contorting our provider to dodge the host's `@`-precedence would degrade the documented bare-`@<mp>` UX contract without fixing the actual interception.
- **Asserting on post-markdown bytes for G-MIL-03:** Wrong layer. Capture at `ctx.ui.notify` (pre-tui), per D-25-09. The markdown layer is exactly what introduces the false 1/3 appearance.
- **Trusting the UAT G-MIL-03 "truth" line verbatim:** It misquotes the contract (says 2/4; catalog says 0/2). Anchor on `docs/output-catalog.md` + `notify.ts` constants, not the UAT restatement.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Source-load delivery to Pi | Custom publish/link tooling | `scripts/pi.sh --home <tmp>` | Ready-made; companion bootstrap + sandbox env already implemented (D-25-01). |
| Notify byte capture | New capture shim | `makeMockPi`/`makeCtx` from `tests/e2e/_helpers.ts` | Existing notify-capture seam; pre-tui bytes. |
| G-MIL-03 regression | New ad-hoc byte test from scratch | Extend/cite `tests/architecture/catalog-uat.test.ts` | It already byte-locks the 0/2 ladder inside `npm run check`. |
| Completion keystroke simulation | A TTY/pi-tui harness | Live `scripts/pi.sh` interactive trigger (D-25-08) | The provider is unit-tested; only the host consumption needs live confirmation. |
| Installing fixture plugins | Hand-written state.json | `installTargetWithMockPi` / the install handler against a fixture marketplace | Mirrors the e2e install path; produces real `state.json` + caches the completion path reads. |

**Key insight:** Every capability this phase needs already exists. The deliverable is *evidence and verdicts*, not infrastructure. The one genuinely new artifact is the recorded reproduction outcome per finding (+ optional cheap regression tests).

## Runtime State Inventory

> This is an investigation/operational phase, not a rename/refactor/migration. The Runtime State Inventory categories are largely N/A, but the *sandbox vs. real-home* state question is load-bearing for G-MIL-07's false-refute guard (D-25-05), so it is answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | A prior real UAT sandbox exists at `tmp/pihome/agent/pi-claude-marketplace/state.json` (marketplace `claude-plugins-official`, installed plugin `pr-review-toolkit` at `version: "hash-2ea95f85703d"`). Demonstrates the exact v1.4 byte forms (`v#2ea95f8`, hash persistence intact). Useful as a reference, NOT as the sandbox (it lives in-repo and is `addedFromCwd: tmp/work`). | Use a fresh `--home <tmp>` sandbox; optionally mirror this fixture shape. |
| Live service config | None. No external services hold phase-relevant state. The companions (`pi-mcp-adapter@2.6.1`, `pi-subagents@0.24.3`) are globally installed and load via `ensure_global_package`. | None -- verified `npm ls -g`. |
| OS-registered state | None. | None. |
| Secrets/env vars | `scripts/pi.sh` sets `PI_CODING_AGENT_DIR=<home>/agent` and `PI_CODING_AGENT_SESSION_DIR=<home>/sessions` when `--home` is given. `getAgentDir()` (re-exported from `@earendil-works/pi-coding-agent`) reads `PI_CODING_AGENT_DIR` for user-scope root resolution. This is the scope-root seam for G-MIL-07 cause (c). | None to change; verify the sandbox sets the same var the resolver reads. |
| Build artifacts / installed packages | Source-load (`-e`) reads the live `.ts` tree directly -- no build artifact to stale. Local `node_modules` pi-tui (0.74.2) differs from the global pi's pi-tui (0.76.0); the runtime uses the global. | None -- verified `@`-logic identical across versions. |

**Scope-root false-refute guard (D-25-05) specifics:** For G-MIL-07 cause (b) the interception is deterministic regardless of home layout, so a clean sandbox WILL reproduce it. The false-refute risk D-25-05 guards against (cause c, scope-root mismatch) is therefore *secondary* here -- but the real-home spot-check is still cheap insurance and is locked, so keep it: if (improbably) the sandbox shows `@<mp>` candidates, spot-check the user's real `~/.pi` before concluding "refuted."

## Common Pitfalls

### Pitfall 1: The UAT G-MIL-03 "truth" line misquotes the contract
**What goes wrong:** The UAT finding's `truth:` field says "marketplace header at 2-space indent, per-plugin rows at 4-space indent." The actual catalog (`docs/output-catalog.md:15,51,137`) says "marketplace header at **column 0**; plugin rows **two spaces** beneath." ROADMAP SC#2 and SNM-38 also loosely say "2/4/6 ladder," which describes the *cause-chain* depth ladder (plugin row 2 → cause 4 → phase-cause 6), not the header/row pair.
**Why it happens:** Conflation of the absolute header/row indents (0/2) with the relative cause-chain ladder (2/4/6).
**How to avoid:** Anchor the byte comparison on `notify.ts` constants (header prefix `""`, plugin row prefix `"  "`, cause trailer `"    "`, phase cause `"      "`) and the catalog fenced blocks -- NOT the UAT restatement. The byte-evidence (D-25-09) settles it: the renderer emits 0/2/4/6, which matches the catalog.
**Warning signs:** A "fix" that changes the header to 2 spaces would BREAK the catalog-uat byte-equality test (the catalog shows column 0). That breakage is the signal you've followed the wrong "truth."

### Pitfall 2: pi-tui `@`-precedence silently swallows the slash-command completion
**What goes wrong:** Any `/claude:plugin <verb> @…` token never reaches `getArgumentCompletions`; pi-tui routes it to file-mention completion.
**Why it happens:** `CombinedAutocompleteProvider.getSuggestions` checks `extractAtPrefix` (line ~191) *before* the slash-command branch (line ~205). `@` is not in `PATH_DELIMITERS`, so the `@` token is treated as a file-mention prefix.
**How to avoid:** Don't try to fix it in our code (D-25-10 -- defer). Record the finding with the exact pi-tui line references. The bare-`@<mp>` form is the ONLY affected path; `<plugin>@<mp>` and bare `<TAB>` (plugin-half) both work because their token does not *start* with `@`.
**Warning signs:** The unit test (`provider.test.ts:806`) is green but the live keystroke shows nothing (or shows file paths). That green-test/red-runtime split IS the signature.

### Pitfall 3: e2e/runtime-smoke tests are NOT in `npm run check`
**What goes wrong:** Putting the behavioral smoke under `tests/e2e/` makes it invisible to the Phase-26 GREEN gate (`npm run check`).
**Why it happens:** `npm test` globs `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,shared,transaction}/**/*.test.ts` -- `tests/e2e/**` is excluded and runs only via `npm run test:e2e`.
**How to avoid:** If the behavioral smoke / G-MIL-03 byte assertions must gate `npm run check` (recommended for the GREEN-gate handoff to Phase 26), place them in one of the included directories (e.g., `tests/shared/` or `tests/architecture/`) rather than `tests/e2e/`. The catalog-uat regression already lives in `tests/architecture/` (in-check). [VERIFIED: package.json scripts]

### Pitfall 4: `scripts/pi.sh` execs the GLOBAL pi, not the local `.bin`
**What goes wrong:** Reasoning about runtime behavior from the repo's local pi-tui (0.74.2) when the live session runs the global pi's pi-tui (0.76.0).
**Why it happens:** `scripts/pi.sh` ends with bare `exec pi …`, resolving via PATH to `~/.npm-global/bin/pi` (0.76.0).
**How to avoid:** Verify behavior against the global version for any live-runtime claim. (Done here: `@`-logic is identical across 0.74.2/0.76.0.) [VERIFIED]

### Pitfall 5: Interactive `pi` needs a TTY; the smoke does not
**What goes wrong:** Trying to script the interactive `scripts/pi.sh` session for the behavioral smoke leads to TTY/PTY friction.
**Why it happens:** Bare `pi` launches the interactive TUI. `runPiRuntimeSmoke` sidesteps this with `pi --offline --no-extensions --extension <path> --help` (non-interactive, asserts load only).
**How to avoid:** Do the behavioral smoke via the in-process `makeMockPi`/`makeCtx` notify capture (no `pi` process at all) OR extend `runPiRuntimeSmoke`-style non-interactive invocation. Reserve the *interactive* `scripts/pi.sh` session strictly for the G-MIL-07 live keystroke (D-25-08), which genuinely needs the TUI.

## Code Examples

### G-MIL-03: the exact render chokepoints (catalog-conformant ladder)
```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts [VERIFIED]
// composeMarketplaceBlock (~:1254): header has NO prefix (column 0)
const lines: string[] = [renderMpHeader(mp, probe)];          // 0 leading spaces
for (const p of mp.plugins) {
  lines.push(...composePluginLines(p, probe, mp.scope));
}
// composePluginLines (~:1230): plugin row prefixed with 2 spaces
const lines: string[] = [`  ${renderPluginRow(p, probe, mpScope)}`];   // 2 spaces
if (p.status === "failed" || p.status === "manual recovery") {
  const trailer = renderIndentedCauseChain(p.cause, "    ");           // 4 spaces
}
// composeRollbackPartialLines (~:1207): phase rows 4 spaces, phase cause 6 spaces
lines.push(`    [${phase.phase}] (rollback failed)`);                  // 4 spaces
const phaseTrailer = renderIndentedCauseChain(phase.cause, "      ");  // 6 spaces
```

### G-MIL-07: the pi-tui interception (external; do not patch)
```javascript
// Source: @earendil-works/pi-tui@0.76.0 dist/autocomplete.js [VERIFIED]
async getSuggestions(lines, cursorLine, cursorCol, options) {
  const textBeforeCursor = currentLine.slice(0, cursorCol);
  const atPrefix = this.extractAtPrefix(textBeforeCursor);   // <-- checked FIRST
  if (atPrefix) {                                            // "@" matches here
    const suggestions = await this.getFuzzyFileSuggestions(rawPrefix, ...);
    if (suggestions.length === 0) return null;               // user sees NOTHING
    return { items: suggestions, prefix: atPrefix };         // or file paths
  }
  if (!options.force && textBeforeCursor.startsWith("/")) {
    // ... slash-command branch: command.getArgumentCompletions(argumentText)
    //     NEVER REACHED for @-leading tokens.
  }
}
extractAtPrefix(text) {
  const lastDelimiterIndex = findLastDelimiter(text);        // PATH_DELIMITERS = [space, tab, ", ', =]  (no @)
  const tokenStart = lastDelimiterIndex === -1 ? 0 : lastDelimiterIndex + 1;
  if (text[tokenStart] === "@") return text.slice(tokenStart);  // "/claude:plugin update @" -> "@"
  return null;
}
```

### G-MIL-07: our provider is correct (proves the gap is host-side)
```typescript
// Source: tests/edge/completions/provider.test.ts:793-814 [VERIFIED, passes]
const f = await makeFixture({
  state: { user: { "mp-a": {}, "mp-b": {} }, project: {} },
  manifests: {
    user: {
      "mp-a": [{ name: "p", status: "installed" }],
      "mp-b": [{ name: "p", status: "installed" }],
    },
    project: {},
  },
});
const items = await getArgumentCompletions("update @", f.resolver);
assert.deepEqual([...items.map((i) => i.label)].sort(), ["@mp-a", "@mp-b"]); // GREEN
```

## State of the Art

| Old Approach (REQUIREMENTS/ROADMAP as-written) | Current Approach (D-25 amendments) | When Changed | Impact |
|-----------------------------------------------|-----------------------------------|--------------|--------|
| SNM-37: "publish to npm OR `npm link` … verify via `pi --version`" | Source-load via `scripts/pi.sh --home <sandbox>`; behavioral byte-form smoke | D-25-01/03/04 (2026-05-29) | Amend SNM-37 + SC#1 wording in lockstep with the work (single commit). |
| G-MIL-07 recon hypothesis #1: "v0.1.7 vs v0.2.0 wiring divergence" | Moot once v0.2.0 source loads via `scripts/pi.sh` | This phase | Cause (a) provider-divergence is eliminated by loading the actual v0.2.0 source. |
| Treating G-MIL-03 as "off-by-one to fix" | Byte-evidence-first; renderer already catalog-conformant → not-a-bug | D-25-09 | Expected verdict is REFUTE + catalog clarification, not a renderer change. |

**Deprecated/outdated:**
- The UAT runtime_caveat's "deferred to follow-up after npm publish/link" is superseded by the `scripts/pi.sh` methodology (D-25-01).
- The UAT G-MIL-03 `truth:` restatement ("header 2-space / row 4-space") is incorrect; the catalog (0/2) is authoritative.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The live `scripts/pi.sh` G-MIL-07 trigger will reproduce the interception in pi-tui 0.76.0 (matching the static source analysis). | SNM-39 root cause | LOW -- `@`-logic verified byte-identical 0.74.2↔0.76.0; only a future pi-tui upgrade between research and execution could change it. Re-verify the global pi-tui version at execution time. |
| A2 | The user's original "saw nothing" specifically occurred because no cwd files matched `@`; a cwd with files would show file paths instead. | Pitfall 2 / live trigger | LOW -- both outcomes confirm the same interception; the verdict is unchanged either way. Affects only the *exact wording* of the recorded artifact. |
| A3 | Markdown rendering in pi-tui adds exactly one leading space (explaining the user's 1/3 vs the renderer's 0/2). | G-MIL-03 display-artifact rationale | LOW -- the *verdict* (renderer is catalog-conformant) does not depend on the exact display-layer transform; the byte capture at `ctx.ui.notify` is the binding evidence regardless of how markdown mutates it. |
| A4 | Placing new smoke/byte tests in `tests/architecture/` or `tests/shared/` includes them in `npm run check`. | Pitfall 3 / Validation | LOW -- verified against the `test` glob in package.json; stable. |

**Note:** No package, compliance, security, or retention claims are assumed -- the only assumptions are about *observed runtime behavior*, all LOW-risk and re-verifiable at execution time.

## Open Questions (RESOLVED)

1. **Does the planner add fresh regression tests on the refuted/deferred findings?**
   - What we know: Claude's-discretion item; recommended default is "yes" (cheap drift insurance feeding Phase 26's GREEN gate). G-MIL-03 is already covered by `catalog-uat.test.ts`.
   - What's unclear: whether a *dedicated* G-MIL-03 byte test adds value over the existing catalog gate, and whether any meaningful regression test exists for G-MIL-07 (the bug is host-external -- a regression test would only re-assert our provider, which `provider.test.ts:806` already does).
   - Recommendation: For G-MIL-03, cite the existing catalog-uat lock and optionally add one explicit "header=0 / row=2" leading-whitespace assertion in `tests/shared/` for readability. For G-MIL-07, the existing `provider.test.ts:806` is the only honest regression (it proves OUR side stays correct); add a *comment/finding doc* pointing at the pi-tui line numbers rather than a test that fights the host.
   - **RESOLVED (planner):** Yes for both. Plan 25-02 adds the readability test `tests/shared/snm38-indent-ladder.test.ts` (header=0 / row=2 leading-whitespace assertion) on top of the existing catalog-uat lock; plan 25-03 adds a finding comment above the GREEN `provider.test.ts` TC-6 case pointing at the pi-tui `getSuggestions` `@`-precedence rather than a host-fighting test.

2. **Should the deferred G-MIL-07 finding file an upstream note against `@earendil-works/pi-tui`?**
   - What we know: D-25-10 says "record the finding (with an upstream note) and defer."
   - What's unclear: whether "upstream note" means an actual GitHub issue on `earendil-works/pi-mono` or just an in-repo recorded finding.
   - Recommendation: Record the finding in-repo (UAT/STATE) with the exact pi-tui `getSuggestions` line references; the planner/user decides whether to also open an upstream issue (out of strict phase scope, but the finding is upstream-actionable).
   - **RESOLVED (planner):** Record in-repo only. Plan 25-03 T3 writes the finding (with pi-tui line refs) into `.planning/v1.4-MILESTONE-UAT.md` + `.planning/STATE.md`; opening an upstream `earendil-works/pi-mono` issue is left as the user's call (out of strict phase scope).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `pi` (global) | `scripts/pi.sh` interactive G-MIL-07 trigger | ✓ | 0.76.0 (`~/.npm-global/bin/pi`) | local `.bin/pi` 0.75.5 (but `scripts/pi.sh` uses global) |
| `pi-mcp-adapter` (global) | companion soft-dep probe (SNM-16) | ✓ | 2.6.1 | `ensure_global_package` auto-installs if missing |
| `pi-subagents` (global) | companion soft-dep probe (SNM-16) | ✓ | 0.24.3 | `ensure_global_package` auto-installs if missing |
| `@earendil-works/pi-tui` (under global pi) | G-MIL-07 root cause surface | ✓ | 0.76.0 | n/a (this IS the surface) |
| `node` test runner | automated byte capture + smoke | ✓ | ≥20.19 (engines) | n/a |
| `bash` | `scripts/pi.sh` | ✓ | -- | n/a |
| A TTY for interactive `pi` | live G-MIL-07 keystroke (D-25-08) | requires user terminal | -- | escalate to user (the locked plan: interactive escalation) |

**Missing dependencies with no fallback:** None for the automated work. The interactive G-MIL-07 trigger requires a human at a terminal -- this is the locked design (D-25-08: interactive escalation to the user), not a blocker.

**Missing dependencies with fallback:** None missing -- companions present; `ensure_global_package` covers re-install.

## Validation Architecture

> nyquist_validation is ENABLED. Each finding's "reproduced/refuted" verdict is made testable below.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in, ≥20.19) |
| Config file | none (glob-driven via package.json) |
| Quick run command | `node --test "tests/architecture/catalog-uat.test.ts"` (G-MIL-03 ladder lock) |
| Full suite command | `npm run check` (typecheck + lint + format:check + `npm test`) |
| Note | `npm test` EXCLUDES `tests/e2e/**`; e2e runs via `npm run test:e2e`. Behavioral-smoke / byte tests that must gate the GREEN gate belong in an included dir (`tests/architecture/` or `tests/shared/`). |

### Phase Requirements → Test Map
| Req ID | Behavior to prove | Test Type | Automated Command | File Exists? |
|--------|-------------------|-----------|-------------------|-------------|
| SNM-37 | v1.4 byte forms in `list`: no `/reload` trailer (read-only), `v#<7hex>`, `{lsp}` not `{lspServers}` | unit (notify-capture) | `node --test "tests/shared/snm37-behavioral-smoke.test.ts"` (drive `list` via `makeMockPi`/`makeCtx`, assert byte forms) | ❌ Wave 0 (new; reuse `_helpers` seam) |
| SNM-37 | Source loads under isolated HOME/cwd (load-only) | e2e smoke | `npm run test:e2e` (existing `pi-runtime-smoke.test.ts`) | ✅ |
| SNM-38 | Renderer emits header=col 0 / row=2-space ladder (catalog-conformant) | architecture (byte-equality) | `node --test "tests/architecture/catalog-uat.test.ts"` (`single-mp-mixed`, `project-orphan-folded` states) | ✅ |
| SNM-38 | Explicit leading-whitespace assertion (optional, readability) | unit | `node --test "tests/shared/snm38-indent-ladder.test.ts"` | ❌ Wave 0 (optional, Claude's discretion) |
| SNM-39 | OUR provider returns `["@mp-a","@mp-b"]` for `update @` (proves gap is host-side) | unit | `node --test "tests/edge/completions/provider.test.ts"` (line 806) | ✅ |
| SNM-39 | Live keystroke `update @<TAB>` (interception confirmation) | manual / interactive escalation | n/a -- `scripts/pi.sh --home <tmp> --cd <fixture>`; user presses Tab; capture result | ❌ manual (D-25-08, by design) |

### Sampling Rate
- **Per task commit:** `node --test "tests/architecture/catalog-uat.test.ts" "tests/edge/completions/provider.test.ts"` (the two existing locks) + any new SNM-37/38 test files.
- **Per wave merge:** `npm test` (full unit/integration glob).
- **Phase gate:** `npm run check` GREEN before `/gsd-verify-work`; the manual G-MIL-07 interactive verdict recorded as an artifact (UAT/STATE), since it is the one non-automatable success criterion.

### Wave 0 Gaps
- [ ] `tests/shared/snm37-behavioral-smoke.test.ts` -- drives `list` via `makeMockPi`/`makeCtx`, asserts the three v1.4 byte forms (covers SNM-37 behavioral half). Reuses the `_helpers.ts` capture seam. Place in `tests/shared/` to gate `npm run check`.
- [ ] (optional) `tests/shared/snm38-indent-ladder.test.ts` -- explicit per-line leading-whitespace assertion (header 0 / row 2). The catalog-uat test already covers this; add only for readability (Claude's discretion).
- [ ] Sandbox fixture builder -- marketplaces with ≥1 installed plugin each + a row exercising `{...}` reason brace + installed/available mix. Reuse `installTargetWithMockPi` or the install handler against a fixture marketplace (mirror `tmp/pihome` shape). Needed for BOTH the SNM-37 smoke fixture and the SNM-39 live precondition.
- [ ] No framework install needed -- `node:test` is built in.

*Manual verdict (SNM-39 live trigger) is intentionally non-automated per D-25-08; record as an artifact, not a test.*

## Security Domain

> `security_enforcement` is not set in `.planning/config.json` (treat as enabled), but this phase introduces NO new attack surface: no new packages, no new commands, no new input parsing, no new file writes outside the locked sandbox. It exercises existing read-only paths (`list`, completions) and a sandboxed `scripts/pi.sh` invocation.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched. |
| V3 Session Management | no | No sessions beyond Pi's own. |
| V4 Access Control | no | Read-only `list` + completions; no privilege boundary changed. |
| V5 Input Validation | minimal | The completion path parses user keystrokes, but no NEW parsing is added; existing `splitCompletionInput`/`extractPositionals` are unchanged. |
| V6 Cryptography | no | The only crypto-adjacent code (`hash-<12hex>` display) is render-only and untouched. |
| V12 File/Path | minimal | `scripts/pi.sh --home <tmp>` writes only under the sandbox; the extension's `assertPathInside` containment (NFR-10) is unchanged. Use a `--home` under a temp dir to avoid touching the real `~/.pi`. |

### Known Threat Patterns for {scripts/pi.sh + Node test harness}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Sandbox escapes to real `~/.pi` | Tampering | Always pass `--home <tmp>` (D-25-02); the real-home spot-check (D-25-05) is read-only. |
| `ensure_global_package` installs an unexpected package | Tampering/Elevation | Both companions already globally present (verified versions); the function only installs if absent. No new package names introduced. |
| Stale completion cache hides a real result (false refute) | Repudiation (wrong verdict recorded) | `getMarketplaceNamesAcrossScopes` reads state directly (no TTL); plugin index has a 10-min TTL -- `__resetCacheForTests` / fresh sandbox avoids stale reads in the automated path. |

## Sources

### Primary (HIGH confidence)
- `scripts/pi.sh` -- verified the source-load invocation, `ensure_global_package` companion bootstrap, and `--home` → `PI_CODING_AGENT_DIR`/`PI_CODING_AGENT_SESSION_DIR` mapping; bare `exec pi` (global resolution).
- `extensions/pi-claude-marketplace/shared/notify.ts` -- verified the indent ladder (`composeMarketplaceBlock` header=col 0, `composePluginLines` row=2-space, cause=4, phase-cause=6), `renderVersion`/`formatHashVersionForDisplay` (`v#<7hex>`), `composeReasons` (`lsp` member), `shouldEmitReloadHint` (`present` excluded → no trailer on list).
- `docs/output-catalog.md` -- verified canonical bytes: "header at column 0; plugin rows two spaces beneath" (L15/51/137); `single-mp-mixed` (L153-160), `project-orphan-folded` (L186-190), `hash-version-list` (`● hashed-plugin v#2ea95f8 (installed)`, L257).
- `tests/architecture/catalog-uat.test.ts` -- verified byte-equality gate exists and covers list states; inside `npm run check`.
- `node_modules/@earendil-works/pi-tui/dist/autocomplete.js` (0.74.2) AND `~/.npm-global/.../pi-tui/dist/autocomplete.js` (0.76.0) -- verified `getSuggestions` checks `extractAtPrefix` before the slash-command branch; `PATH_DELIMITERS` excludes `@`; logic byte-identical across versions. THE G-MIL-07 root cause.
- `extensions/pi-claude-marketplace/edge/register.ts` -- verified the dual surface: command-registered `getArgumentCompletions(prefix, makeLocationsResolver(process.cwd()))` (:98-99) vs `session_start` `addAutocompleteProvider` wrapper that delegates `getSuggestions` verbatim and only normalizes `applyCompletion` whitespace (:107-122) -- so the wrapper cannot override the `@`-precedence.
- `extensions/pi-claude-marketplace/edge/completions/{provider.ts,data.ts}` -- verified `update`→`allowMarketplaceOnly:true` (provider :196), `getMarketplaceOnlyCompletions` (:383) → `getPluginToMarketplacesMap("update")` → `getInstalledPluginToMarketplacesMap` (:313) = installed-plugins-only (the G-MIL-07 precondition).
- `tests/edge/completions/provider.test.ts:793-814` -- verified the `update @` → `["@mp-a","@mp-b"]` test passes with a mock resolver (proves OUR provider is correct; the gap is host consumption).
- `orchestrators/edge-deps.ts` + `persistence/locations.ts` -- verified `makeLocationsResolver(cwd)` closes over cwd; project scope = `<cwd>/.pi`, user scope = `getAgentDir()` (reads `PI_CODING_AGENT_DIR`). Cause (c) seam.
- `package.json` -- verified version 0.2.0 (no bump), engines `>=20.19.0`, peer deps `@earendil-works/*`, and that `npm test` excludes `tests/e2e/**`.
- `.planning/v1.4-MILESTONE-UAT.md` -- G-MIL-03 (:476-494, truth-line misquote), G-MIL-07 (:686-721, recon 4 hypotheses), runtime_caveat (:11-24), Triage (:739-749), follow-up (:765-770).
- Shell verification: `pi --version` (global 0.76.0, local 0.75.5), `npm ls -g` (pi-mcp-adapter@2.6.1, pi-subagents@0.24.3), `tmp/pihome/.../state.json` (real `hash-2ea95f85703d` fixture).

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` (SNM-37/38/39 wording), `.planning/ROADMAP.md` (Phase 25 SC + cross-cutting constraints), `.planning/STATE.md` (operator-gated SNM-37 hand-off blocker).

### Tertiary (LOW confidence)
- None -- all load-bearing claims verified against source or runtime.

## Landmark Drift Report

> CONTEXT.md / UAT cited line numbers; confirmed actuals below.

| Cited (CONTEXT.md / UAT) | Actual (verified 2026-05-29) | Status |
|--------------------------|------------------------------|--------|
| `edge/register.ts:95-99` cwd capture; `:98` getArgumentCompletions; `:108` addAutocompleteProvider | cwd at `:99`, getArgumentCompletions registered `:98-99`, session_start `:107`, addAutocompleteProvider `:108` | ✓ accurate |
| `provider.ts:196,202` allowMarketplaceOnly (CONTEXT) / `:204` (UAT recon) | `:196` (update), `:202` (reinstall) | CONTEXT accurate; UAT recon `:204` drifted |
| `data.ts:383` getMarketplaceOnlyCompletions; `:313` getInstalledPluginToMarketplacesMap; `:346` getPluginToMarketplacesMap | `:383`, `:313`, `:346` | ✓ accurate |
| `notify.ts:887` renderPluginRow; `:1184-1226` renderIndentedCauseChain; renderMpHeader | renderPluginRow `:921` (`:887` is a doc comment); renderIndentedCauseChain `:1191` (within cited range); renderMpHeader `:648` | renderPluginRow drifted to `:921` |
| `extensions/pi-claude-marketplace/tests/edge/completions/provider.test.ts:806` | actual path is `tests/edge/completions/provider.test.ts:806` (repo-root `tests/`, NOT under `extensions/`) | path prefix wrong; line `:806` correct |
| `docs/output-catalog.md` L155-189 indent examples | `single-mp-mixed` L153-160; `project-orphan-folded` L186-190 | ✓ in range |

## Metadata

**Confidence breakdown:**
- Delivery (SNM-37): HIGH -- `scripts/pi.sh` read in full; companions + sandbox env verified; behavioral-smoke seam confirmed.
- G-MIL-03 (SNM-38): HIGH -- renderer constants + catalog bytes + existing byte-equality test all agree on 0/2 ladder; verdict REFUTE is evidence-backed.
- G-MIL-07 (SNM-39): HIGH -- root cause located in pi-tui `getSuggestions` `@`-precedence, verified byte-identical in the exact runtime version (0.76.0); unit test confirms our side is correct.
- Pitfalls: HIGH -- each anchored to a verified source line.

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (stable; re-verify the global `pi`/`pi-tui` version at execution time if a Pi upgrade occurred, per A1).
