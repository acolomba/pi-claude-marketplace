---
phase: 12
slug: messaging-foundations-renderer-primitives
status: passed
threats_open: 0
threats_closed: 14
asvs_level: 1
created: 2026-05-24
audited: 2026-05-24
register_authored_at_plan_time: true
---

# Phase 12 Security Audit -- messaging-foundations-renderer-primitives

**Audited:** 2026-05-24
**ASVS Level:** L1 (default; no AppSec target overrides set)
**Status:** SECURED
**Threats Closed:** 14 / 14
**Unregistered Flags:** 0

## Phase Scope

Phase 12 landed messaging foundations across four plans:

- **12-01** -- closed-set grammar constants (`STATUS_TOKENS`, `REASONS`) + drift test
- **12-02** -- reload-hint composer collapsed to single canonical trailer; 8 callsites migrated
- **12-03** -- IL-3 sanctioned `console.warn` reworded to style-guide §14.1 binding wording; atomic doc edit
- **12-04** -- `shared/notify.ts` header expanded with CMC-19 wrapper inventory

All mitigations are source-byte / diff / grep invariants enforced by tests or PR-time discipline. No production behavior changed beyond the documented D-CMC-10 carve-out (8 reload-hint trailers + IL-3 wording).

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-12.01-01 | Tampering | mitigate | CLOSED | `tests/architecture/grammar-frontmatter.test.ts:44-74` asserts set-equality of `STATUS_TOKENS` (14) and `REASONS` (23) against style-guide frontmatter; runs within `npm run check`. Phase 14 (D-14-10) upgraded the extractor to a memoized YAML loader but the drift-guard contract (set-equality, CI fails on drift) is preserved and broadened to 4 closed sets. |
| T-12.01-02 | Information Disclosure | accept | CLOSED | Acceptance rationale stands: `tests/architecture/grammar-frontmatter.test.ts` reads `docs/messaging-style-guide.md` via a fixed `STYLE_GUIDE_PATH` resolved from `REPO_ROOT`; no untrusted input crosses the boundary; file is tracked in-tree. |
| T-12.01-03 | Denial of Service | accept | CLOSED | Acceptance rationale stands: extractor regex (now `parseStyleGuideFrontmatter` in `tests/lint-rules/lib/frontmatter.js`) runs against a bounded in-tree file at test-load time; no untrusted input source. |
| T-12.02-01 | Information Disclosure | accept | CLOSED | Acceptance rationale stands and is strengthened: `extensions/pi-claude-marketplace/presentation/reload-hint.ts` returns the file-private `RELOAD_HINT_TRAILER = "/reload to pick up changes"` literal with no name interpolation; the new composer emits strictly less user data than the legacy verb-form which quoted plugin names. |
| T-12.02-02 | Tampering | mitigate | CLOSED | Phase-12 mitigation was satisfied at ship time (Phase 12 commits cca874f / f380835 / 8b1710c left `RELOAD_HINT_PREFIX` exported in `shared/markers.ts`). The constant was subsequently deleted in commit `c4d87d4` (`chore(13): ES-5 supersession atomic three-file edit`) -- the explicitly authorized downstream window per the plan ("D-CMC-08 retention through Phase 12; deletion is Phase 13's atomic three-file edit"). Phase 13 atomically updated the markers-snapshot test alongside the deletion; full test suite remains green at HEAD (1245+ tests). The Phase 12 threat (premature deletion within Phase 12) did not occur. |
| T-12.02-03 | Denial of Service | mitigate | CLOSED | `grep -rE 'reloadHint\("(load\|refresh\|drop)"' extensions/pi-claude-marketplace/` returns 0 matches; `grep -rF "ReloadVerb" extensions/` returns 0 matches; 8 callsites in 7 orchestrator files now use the 1-arg signature (verified at install.ts:766, uninstall.ts:245, update.ts:827, reinstall.ts:521+1219, marketplace/update.ts:528, marketplace/remove.ts:349+366, import/execute.ts:332+931). Note: Phase 13 added downstream callsites; the type-level breaking signature change ensures no missed callsite can compile. |
| T-12.03-01 | Information Disclosure | accept | CLOSED | Acceptance rationale stands: `extensions/pi-claude-marketplace/persistence/migrate.ts:179` interpolates only `${stateJsonPath}` (already known to the migration; it IS the write target) and `${errMsg}` (sanitized via `errorMessage()`); no new secret, PII, or environment data is surfaced. |
| T-12.03-02 | Tampering | mitigate | CLOSED | `tests/persistence/migrate.test.ts:189-197` asserts the IL-3 comment regex `/\/\/ eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail\n\s*console\.warn\(/` is matched in `migrate.ts` source; verified at migrate.ts:177-179 (IL-3 comment directly above the single console.warn callsite). |
| T-12.03-03 | Tampering | mitigate | CLOSED | The Phase 12 IL-3 rule (`no-restricted-syntax` selector for `console.warn` at eslint.config.js:108-112, plus `no-console: "error"` at line 132) is intact at HEAD. Phase 14 commits added new `msg/*` plugin rules (MSG-LC-1, MSG-LC-2 at lines 197-200) that strengthen, not widen, the IL-3 boundary -- defense-in-depth. The `persistence/migrate.ts` file is the sole authorized exemption (eslint.config.js:195) and is the only file containing the inline IL-3 disable directive. No widening occurred. |
| T-12.03-04 | Tampering | mitigate | CLOSED | `grep -c "console.warn(" extensions/pi-claude-marketplace/persistence/migrate.ts` returns 1; `tests/persistence/migrate.test.ts:200-205` source-byte test asserts `/console\.warn\(/g` returns exactly 1 match in the file; ESLint `no-restricted-syntax` + `no-console` rules enforce across the rest of the tree. |
| T-12.03-05 | Repudiation | mitigate | CLOSED | D-CMC-15 atomic-PR verified at commit `f380835` (`feat(12-03): land §14.1 IL-3 warn wording + atomically reframe doc`) -- the diff includes BOTH `extensions/pi-claude-marketplace/persistence/migrate.ts` AND `docs/messaging-style-guide.md`. Style guide §14.1 now reads "Wording (Phase 12 landed)" and "The wording above is the binding text shipped at persistence/migrate.ts:178 in Phase 12 per D-CMC-14" -- matching the bytes at migrate.ts:179. |
| T-12.04-01 | Tampering | mitigate | CLOSED | All four wrapper signatures verified byte-identical via `grep -F`: `notifySuccess(ctx: ExtensionContext, message: string): void` (notify.ts:48), `notifyWarning(...)` (line 53), `notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void` (line 76), `notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void` (line 95). |
| T-12.04-02 | Tampering | mitigate | CLOSED | Phase-12 acceptance criterion (`git diff HEAD -- eslint.config.js` empty at Plan 12-04 commit `8b1710c`) was satisfied at ship time. Subsequent Phase 14 commits modified eslint.config.js to ADD MSG-* plugin rules (additive defense-in-depth); the per-file `shared/notify.ts` override block (eslint.config.js:135-143) remains intact and unmodified. No widening of the notify boundary. |
| T-12.04-03 | Information Disclosure | accept | CLOSED | Acceptance rationale stands: `extensions/pi-claude-marketplace/shared/notify.ts` header comment cites internal IDs (CMC-19, D-CMC-11, D-CMC-13, MSG-SR-1..7) all of which are public in `.planning/` and `docs/messaging-style-guide.md`. |

## Unregistered Flags

None.

- `12-01-SUMMARY.md` `## Threat Flags`: "None -- no new attack surface introduced" (matches T-12.01-01..03 dispositions).
- `12-02-SUMMARY.md` `## Threat Flags`: "None -- the new trailer is a fixed literal with NO name interpolation" (matches T-12.02-01..03 dispositions).
- `12-03-SUMMARY.md`: no `## Threat Flags` section; threats explicitly addressed inline against plan's `<threat_model>` (T-12.03-01..05).
- `12-04-SUMMARY.md`: no `## Threat Flags` section; threats covered by plan's `<threat_model>` (T-12.04-01..03); docs-only edit with no new attack surface.

## CHANGELOG D-CMC-10 Citation (Binding per W-1)

The Phase 12 D-CMC-10 carve-out (8 reload-hint callsite trailers emit new wording) is cited in `CHANGELOG.md` with all three required literal strings:

- `D-CMC-10` -- found
- `8 reload-hint callsite trailers now emit /reload to pick up changes; Phase 12 carve-out per D-CMC-10` -- found
- `roadmap criterion #2 authorizes` -- found

This satisfies the ship-gate per the Plan 12-02 Task 2 acceptance criterion.

## Notes for Downstream Phase Audits

- **RELOAD_HINT_PREFIX deletion:** Phase 13 commit `c4d87d4` deleted the constant from `shared/markers.ts` per the planned ES-5 supersession three-file atomic edit. Any future audit of Phase 13 should verify the markers-snapshot test row + PRD §6.12 row were updated atomically.
- **eslint.config.js additions:** Phase 14 commits (`bbc57a9`, `ff0726b`, `a0cad20`, `b1c204f`, `e3e4f06`, `cc5d6f9`, `09be954`) added new `msg/*` plugin rules. These are strengthening / additive guards; Phase 14 audits should verify no widening of IL-2/IL-3 boundaries.
- **Drift extractor upgrade:** Phase 14 (D-14-10) replaced the test-local hand-rolled regex extractor with a memoized YAML loader at `tests/lint-rules/lib/frontmatter.js`. The set-equality contract for `STATUS_TOKENS` and `REASONS` is preserved and extended to `MARKERS` and `PATTERN_CLASSES`.

---

*Auditor: gsd-security-auditor (Claude)*
*Phase: 12-messaging-foundations-renderer-primitives*
*Threats verified against PLAN.md `<threat_model>` blocks in 12-01-PLAN.md, 12-02-PLAN.md, 12-03-PLAN.md, 12-04-PLAN.md*
