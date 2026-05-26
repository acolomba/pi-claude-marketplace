---
phase: 17
slug: spec-rewrite-catalog-uat-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-26
---

# Phase 17 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `17-RESEARCH.md` §"Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in) + `node:assert/strict` |
| **Config file** | none (configured via `package.json` scripts) |
| **Quick run command** | `npm test -- --test-name-pattern="catalog UAT\|notify-types"` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~3-5s (catalog UAT); ~30-60s (full suite) |

---

## Sampling Rate

- **After every task commit:** `npm test tests/architecture/catalog-uat.test.ts` (~3s, covers SNM-20 + SNM-31)
- **After every plan wave:** `npm run check` (typecheck + lint + format + full test suite; covers all 4 requirements)
- **Before `/gsd-verify-work`:** `npm run format && npm run check` GREEN
- **Max feedback latency:** ~5 seconds (catalog UAT scope) / ~60 seconds (full suite)

---

## Per-Task Verification Map

> Filled in by `/gsd-plan-phase` once PLAN.md files exist. Initial scaffold maps each requirement
> to its primary verification artifact; planner refines per-task once tasks are split.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 17-XX-XX | A (style guide) | 1 | SNM-19 | -- | Style guide v2.0 published; no frontmatter; <= 250 lines | meta (docs) | `wc -l docs/messaging-style-guide.md && head -1 docs/messaging-style-guide.md` | -- W0 | pending |
| 17-XX-XX | A (style guide) | 1 | SNM-19 | -- | ES-5 Supersession Table retained verbatim + Phase 21 annotation | meta (docs) | `grep -A 8 "ES-5 Supersession Table" docs/messaging-style-guide.md` | -- W0 | pending |
| 17-XX-XX | A (style guide) | 1 | SNM-26 | -- | `tests/architecture/grammar-frontmatter.test.ts` absent | meta (file) | `test ! -f tests/architecture/grammar-frontmatter.test.ts` | -- W0 | pending |
| 17-XX-XX | A (style guide) | 1 | SNM-26 | -- | REQUIREMENTS.md SNM-26 row: owner Phase 17, status Complete | meta (docs) | `grep "SNM-26" .planning/REQUIREMENTS.md` | -- W0 | pending |
| 17-XX-XX | B (catalog) | 2 | SNM-20 | -- | Catalog v2.0 single-plugin install renders two-line marketplace-header form | byte-equality | `npm test tests/architecture/catalog-uat.test.ts -- --test-name-pattern="install"` | YES (post Plan C) | pending |
| 17-XX-XX | B (catalog) | 2 | SNM-20 | -- | Catalog v2.0 orphan-fold case present (plugin.scope != mp.scope) | byte-equality | `npm test tests/architecture/catalog-uat.test.ts -- --test-name-pattern="orphan-fold\|scope-mismatch"` | YES (post Plan C) | pending |
| 17-XX-XX | C (catalog UAT) | 3 | SNM-31 | -- | Catalog UAT drives `notify()` only (no V1 composer imports) | typecheck | `npm run typecheck && grep -L "presentation/" tests/architecture/catalog-uat.test.ts` | YES | pending |
| 17-XX-XX | C (catalog UAT) | 3 | SNM-31 | -- | Every (section, state) tuple has a fixture entry; byte-equality holds | byte-equality | `npm test tests/architecture/catalog-uat.test.ts` | YES | pending |
| 17-XX-XX | -- | final | All | -- | `npm run check` GREEN | full suite | `npm run check` | YES | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All Wave 0 items below are **OPTIONAL**. The primary user-contract gate (catalog UAT byte-equality
via `notify()`) covers SNM-20 + SNM-31 directly. SNM-19 + SNM-26 are documentation/file-existence
changes whose absence-of-failure is verified by `npm run check` GREEN.

- [ ] (Optional) `tests/architecture/style-guide-shape.test.ts` -- assert style guide v2.0 has no YAML frontmatter (first line is `# Messaging Style Guide`, not `---`) AND total line count <= 250
- [ ] (Optional) `tests/architecture/grammar-frontmatter-absent.test.ts` -- assert `tests/architecture/grammar-frontmatter.test.ts` does NOT exist (defense against accidental restore)
- [ ] (Optional) `tests/architecture/catalog-uat-imports.test.ts` -- assert `tests/architecture/catalog-uat.test.ts` does NOT import from `extensions/pi-claude-marketplace/presentation/*` (locks D-17-03 pure exclusion structurally)

*Planner may elect to add 1-3 lightweight architecture tests if explicit gates are wanted, but they are not strictly required.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Style guide v2.0 reads as a coherent pointer doc (~5-7 sections, ~150-250 lines) | SNM-19 | Editorial coherence is human judgment | Read `docs/messaging-style-guide.md` end-to-end; verify each H2 section is a navigation pointer, not an enumeration |
| Catalog v2.0 per-command sections are byte-equal to what the renderer emits | SNM-20 | Comprehensive byte-equality is automated, but section-narrative editorial accuracy is human-reviewed | Spot-check 3-5 per-command sections vs. their `notify()` emission |
| ADR v2-001 cross-reference to Phase 17 lands in Accepted-status block | SNM-19 (criterion #5) | Trivial editorial; one-line addition | `grep "Phase 17" docs/adr/v2-001-structured-notify.md` |
| v2.0 catalog Conventions section documents v1->v2 dropped surfaces (per D-17-09, D-17-10) | SNM-20 | Editorial documentation; human-reviewed | Read Conventions section; verify mentions of dropped `Claude plugin import summary` preamble, retry anchor, source-mismatch diagnostic, and `install-failure-with-anchor` state |

---

## Validation Sign-Off

- [ ] All tasks have automated verify OR Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills per-task map

**Approval:** pending
