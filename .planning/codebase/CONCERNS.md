# Codebase Concerns

**Analysis Date:** 2026-08-18

## Tech Debt

**`.planning/` markdown has no automated formatting or lint gate:**
- Issue: `.pre-commit-config.yaml` explicitly excludes `.planning/` from `mdformat` (`exclude: ^(tests/fixtures/|tests/bridges/_fixtures/|\.planning/)`) and from `markdownlint-cli2` (same exclude line), and also skips `fix-smartquotes`, `fix-unicode-dashes`, and `fix-ligatures` for `.planning/`. `npm run format:check` (see `package.json`) globs only `**/*.{js,json,ts}`, so Prettier never touches `.planning/` either.
- Files: `.pre-commit-config.yaml`, `.planning/codebase/*.md`, `.planning/BACKLOG.md`, and all phase/plan artifacts under `.planning/`
- Impact: these generated docs (STACK.md, ARCHITECTURE.md, CONVENTIONS.md, BACKLOG.md, phase plans) are point-in-time snapshots with no verification loop. They drift silently as code lands — nothing fails CI or pre-commit when a doc goes stale, is malformed, or contradicts the source it describes.
- Fix approach: none proposed in this pass; noted as a structural gap for future consideration (e.g., a periodic `/gsd-map-codebase` re-run gate, or a lightweight staleness check).

**`fallow`'s dead-code/unused-export classes are near-vacuous under `production: false`:**
- Issue: `.fallowrc.json` sets `"production": false` (confirmed by direct read), which admits `tests/**` into the reachability graph. This is what makes the codebase's `_*ForTest` DI seam convention analyzable without ~130 false positives (per `.planning/BACKLOG.md` FLOW-04). But the flip side — recorded in STACK.md and BACKLOG.md's FLOW-04 closure note — is that under `production: false`, fallow promotes every discovered file to an entry point, so an export consumed only by a test (and never by production code) is not flagged as dead.
- Files: `.fallowrc.json`
- Impact: a genuinely unused production export that happens to have a lingering test reference will not be caught by `npm run fallow`'s dead-code check. Boundary, coverage, and cycle enforcement are unaffected (each independently verified per FLOW-01/02/04's closure notes).
- Fix approach: none — this is a knowing, documented trade-off (FLOW-04), not a bug. Carried here as a residual gap for anyone auditing why a stale export slipped through.

## Known Bugs / Silent-Failure Surfaces

**Hook dispatch failures are silent by design (`dispatch-exec.ts`):**
- Symptoms: a hook handler whose command is missing (ENOENT), or whose `CLAUDE_PLUGIN_DATA` path fails the NFR-10 containment assert, or whose stdout/stderr exceeds the manual caps, resolves to `{ kind: "noop" }` with only a `hookDebugLog` trace call — no `ctx.ui.notify`, nothing visible to the user in the session.
- Files: `extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts` (documented "Never-throws contract" in the file header: "every error path resolves to `{ kind: "noop" }` + `hookDebugLog`")
- Trigger: any of — spawn-time error (ENOENT, containment violation), stdout overflow past `STDOUT_MAX_BYTES` (1 MB), stderr overflow past `STDERR_MAX_BYTES` (64 KB), or an EPIPE from a fast-exiting child on stdin write
- Workaround: `hookDebugLog` output is the only trace; there is no user-facing signal that a configured hook silently never ran. This is the largest silent-failure surface in the codebase — a misconfigured or broken hook produces no error, no warning, nothing.

**Orchestrated-mode install failures lose rollback detail across the outcome boundary:**
- Symptoms: `classifyInstallFailure` (`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:2423`) collapses every failure variant to `{ status: "failed", error, cause }` — a flat `Error` plus a formatted string. Per-phase rollback children (`RollbackPartial[]`, from `transaction/phase-ledger.ts`) that are attached to `PluginFailedMessage` in the standalone-notify path are dropped here.
- Files: `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (`classifyInstallFailure`, line 2423; contrast with the standalone catch-site comment at line ~1598-1607 describing the `rollbackPartial` field carried by `PluginFailedMessage`)
- Trigger: any install driven through a cascade (reconcile-triggered install/update, or bulk `import`) that fails mid-ledger
- Impact: a reconcile- or import-driven install renders a bare `(failed)` row where the standalone `/claude:plugin install` path would show per-phase rollback detail in the notification.

## Reconciliation Model Limits

**Load-time reconcile is config-to-record, not a deep diff against disk:**
- Problem: `applyReconcile` (`extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`) diffs the **declared config** (merged `claude-plugins.json`) against **installation records** in `state.json` — it does not re-verify that recorded artifacts still exist on disk.
- Files: `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`, `orchestrators/reconcile/plan.ts`
- Cause: by design (documented in ARCHITECTURE.md's Data Flow section) — reconcile answers "does the config match the record," not "does the record match the filesystem."
- Impact: an artifact deleted underneath an intact state record (e.g., a user manually `rm`s a skill file, or a bridge-committed file is lost) is not detected or repaired by `/reload`; the state record still claims it is installed.

## CI Coverage Gaps

**CI `paths-ignore` skips `docs/**`, but a test byte-compares against a file under `docs/`:**
- Issue: `.github/workflows/ci.yml` (both jobs, lines 14-19 and 24-29) and `.github/workflows/sonarcloud.yml` (lines 7-12 and 17-22) list `docs/**` in `paths-ignore`, so a docs-only commit does not trigger CI. But `tests/architecture/catalog-uat.test.ts` reads `docs/output-catalog.md` at test time and byte-compares 166 annotated fenced examples against live `notify()` output (confirmed: the test asserts `expect exactly 166 annotated catalog examples`, and its header describes a "BINDING USER-CONTRACT GATE: byte-equality between `notify()`'s output and the catalog").
- Files: `.github/workflows/ci.yml`, `.github/workflows/sonarcloud.yml`, `docs/output-catalog.md`, `tests/architecture/catalog-uat.test.ts`
- Impact: a docs-only edit to `docs/output-catalog.md` that breaks the byte-parity contract (e.g., a typo fix that changes an annotated example's exact text) can merge without CI ever running the test that would catch it. The test only runs when something outside `docs/**`/`**/*.md` also changes in the same push/PR.

## Open Backlog Items (from `.planning/BACKLOG.md`)

**UAT-02 — reconcile cascade invisible on `/reload` (host TUI limitation, open):**
- `@earendil-works/pi-coding-agent`'s `handleReloadCommand` calls `rebuildChatFromMessages()` after `session.reload()`, which reconstructs the chat from the LLM transcript only — any `ctx.ui.notify` output emitted during the reload pipeline (including the reconcile cascade, RECON-04) is erased from the visible chat. Not our fork; no upstream issue filed as of 2026-06-11 per operator decision. Workaround: run `/claude:plugin pending` before reload, or `list` after.

**REASON-01 — malformed-input failures misfiled under the "unsupported" reason family (open):**
- Two cases mislabel a parse/structural defect as an unsupported-kind: inline malformed `mcpServers` resolves to `{unsupported source}` via the `narrowResolverNotes` catch-all, and malformed `hooks.json` (invalid JSON/schema) resolves to `{unsupported hooks}`. Both belong in a `{malformed <feature>}` family parallel to `{invalid manifest}`/`{unparseable}`. Deliberately left unchanged in Phase 85's `{malformed mcp}` introduction (out of scope for that milestone).

**COV-01 — coverage exclusion policy and two under-tested orchestrators (open):**
- `orchestrators/import/execute.ts` (59 uncovered lines, 94.53%) and `orchestrators/marketplace/update.ts` (50 uncovered, 95.49%) sit outside the D-99-05b bounded-sweep scope (update/reinstall/install only). Both files' uncovered remainder is rare-failure and cascade-diagnostic arms. Undecided: follow-on bounded sweep vs. accept as-is — explicitly NOT to be resolved via a `sonar.coverage.exclusions` entry, per the policy recorded in the same backlog item.

---

*Concerns audit: 2026-08-18*
