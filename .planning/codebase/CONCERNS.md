---
last_mapped_commit: 5960d1c02ed242faa6accd4c1ff5da8c84f2accd
last_mapped_at: 2026-10-05
---
# Codebase Concerns

**Analysis Date:** 2026-10-05

## Tech Debt

**`.planning/` markdown has no automated formatting or lint gate:**
- Issue: `.pre-commit-config.yaml` excludes `.planning/` from `mdformat` and `markdownlint-cli2` (`exclude: ^(tests/fixtures/|tests/bridges/_fixtures/|\.planning/)`), and also from the smartquote/dash/ligature fixers. `npm run format:check` globs only `{extensions,rule-packs,tests}/**/*.{js,json,ts}` plus a few root files, so Prettier never touches `.planning/`.
- Files: `.pre-commit-config.yaml`, `.planning/codebase/*.md`, `.planning/BACKLOG.md`, all phase/plan artifacts under `.planning/`
- Impact: generated docs are point-in-time snapshots with no verification loop. They drift silently as code lands.
- Fix approach: none proposed; a periodic `/gsd-map-codebase` re-run is the only refresh.

**`fallow` dead-code classes are near-vacuous under `production: false`:**
- Issue: `.fallowrc.json` carries a `production` block (see the memory note on branch differences: `false` on main, `{deadCode: true}` on feature branches). Where production mode is off, tests join the reachability graph, so an export used only by a test is not flagged dead (FLOW-04 trade-off).
- Files: `.fallowrc.json`
- Impact: a genuinely unused production export with a lingering test reference is not caught by `npm run fallow`. Boundary, coverage, and cycle enforcement are unaffected.
- Fix approach: none; documented trade-off. Re-read `.fallowrc.json` `production` before relying on this.

**Rule pack `rule-packs/architecture.json` has known gaps:**
- Issue: the pack enforces output discipline (`no-stdio`, `no-console`, `migrate-console-warn-only`, `debug-log-console-error-only`) and import chokepoints (`write-file-atomic-chokepoint`, `no-network-modules`, `fetch-chokepoint`). It does not catch a dynamic `import()` of a banned module, an aliased `fetch` (`const f = fetch; f(...)`), or `node:http2`/`http2` (absent from the `no-network-modules` specifier list).
- Files: `rule-packs/architecture.json`
- Impact: a new network or atomic-write path can bypass the pack by one of those three routes with no gate reporting it.
- Fix approach: add `node:http2`/`http2` to `no-network-modules`; the other two need a fallow capability or an ESLint selector.

**`npm run fallow` empty-glob check depends on fallow's WARN text:**
- Issue: the `fallow` script in `package.json` runs `fallow rule-pack test --quiet 2>&1 | grep 'WARN.*rule pack'` and fails when it matches, to catch a rule whose `files` glob matches nothing. It relies on the exact warning wording.
- Files: `package.json` (`fallow` script), `rule-packs/architecture.json`
- Impact: if a fallow upgrade rewords the warning, the check passes vacuously and a dead rule goes unnoticed.
- Fix approach: after every fallow upgrade, re-prove the check against a deliberately empty glob (do not commit the control); see the fallow upgrade checklist.

**`write-file-atomic` has three excluded direct callers:**
- Issue: `write-file-atomic-chokepoint` excludes `shared/atomic-json.ts` (the chokepoint) plus `bridges/agents/stage.ts`, `bridges/mcp/stage.ts`, and `orchestrators/plugin/prune-rollback.ts`, which restore saved bytes on rollback and import `write-file-atomic` directly.
- Files: `extensions/pi-claude-marketplace/bridges/agents/stage.ts`, `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`
- Impact: NFR-1 atomicity is enforced by convention in these three; any new exclusion widens the hole silently.
- Fix approach: keep the list at three; route new writes through `atomicWriteJson`.

**`domain/github-auth.ts` calls `fetch` though domain/ is described as network-free:**
- Issue: `extensions/pi-claude-marketplace/domain/github-auth.ts` performs Device Flow HTTP calls (`fetch(deviceCodeUrl, ...)`, default adapter over `globalThis.fetch`). ARCHITECTURE.md calls domain/ pure and network-free. It is the sole `fetch` exemption in `fetch-chokepoint` and is on the NFR-5 exemption list in `eslint.config.js`.
- Impact: layering description and reality disagree; the file is a network surface living in the "pure" layer.
- Fix approach: keep the injectable HTTP seam; consider moving the module to `platform/` or documenting the exception in ARCHITECTURE.md.

**D-11 ledger path lists in `eslint.config.js` are literal and fail open on rename:**
- Issue: `PLUGIN_LEDGERS` and `MARKETPLACE_LEDGERS` (`eslint.config.js`, BLOCK C) are hand-written file paths feeding `import-x/no-restricted-paths` zones. Renaming or splitting a ledger leaves a stale entry and the zone stops covering it, with no error.
- Files: `eslint.config.js`
- Impact: the plugin/marketplace ledger separation silently stops being enforced for the renamed file.
- Fix approach: when renaming a ledger, update the lists in the same change; a path-existence assertion in a gate test would close the gap.

## Known Bugs / Silent-Failure Surfaces

**Hook dispatch failures are silent by design (`dispatch-exec.ts`):**
- Symptoms: a hook command that is missing (ENOENT), a `CLAUDE_PLUGIN_DATA` path failing the NFR-10 containment assert, or stdout/stderr over the caps resolves to `{ kind: "noop" }` with only a `hookDebugLog` trace. Nothing reaches `ctx.ui.notify`.
- Files: `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (never-throws contract in the file header; `STDOUT_MAX_BYTES` 1 MB, `STDERR_MAX_BYTES` 64 KB)
- Trigger: spawn-time error, output overflow, or EPIPE on stdin write of a fast-exiting child
- Workaround: `hookDebugLog` output is the only trace. This is the largest silent-failure surface in the codebase.

**Orchestrated-mode install failures lose rollback detail across the outcome boundary:**
- Symptoms: `classifyInstallFailure` (`extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:681`, called from `orchestrators/plugin/install-flow.ts:1261`) collapses every failure to `{ status: "failed", error, cause }`. Per-phase `RollbackPartial[]` children (from `transaction/phase-ledger.ts`) attached to `PluginFailedMessage` in the standalone path are dropped.
- Trigger: any install driven through a cascade (reconcile install/update, bulk `import`) that fails mid-ledger
- Impact: reconcile- or import-driven failures render a bare `(failed)` row where `/claude:plugin install` shows rollback detail.

## Reconciliation Model Limits

**Load-time reconcile is config-to-record, not a deep diff against disk:**
- Problem: `applyReconcile` (`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`) diffs declared config against `state.json` records. It does not re-verify that recorded artifacts exist on disk.
- Files: `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `orchestrators/reconcile/plan.ts`
- Impact: an artifact deleted underneath an intact record is not detected or repaired by `/reload`.

## CI Coverage Gaps

**Staged deletions of build inputs do not trigger the commit hook (accepted):**
- Issue: the `npm-check` hook in `.pre-commit-config.yaml` runs only when a staged file matches its `files:` pattern; a pure deletion of a build input (for example a file under `extensions/` or `rule-packs/`) does not run `npm run check:commit`.
- Impact: a deletion that breaks an import or a pair is caught only by PR CI. Accepted by the operator.
- Note: `docs/output-catalog.md` is now listed in both the CI `paths` build inputs (`.github/workflows/ci.yml`) and the hook pattern, so a catalog-only edit runs `tests/architecture/catalog-uat/` checks. Other `docs/**` files remain outside the build inputs.

## Open Backlog Items (from `.planning/BACKLOG.md`)

**UAT-02 - reconcile cascade invisible on `/reload` (host TUI limitation, open):**
- `@earendil-works/pi-coding-agent`'s `handleReloadCommand` calls `rebuildChatFromMessages()` after `session.reload()`, erasing any `ctx.ui.notify` output emitted during reload, including the reconcile cascade (RECON-04). Not our code; no upstream issue filed per operator decision. Workaround: run `/claude:plugin pending` before reload, or `list` after.

---

*Concerns audit: 2026-10-05*
