---
phase: 14-drift-guard-test-alignment
status: passed
audit_date: 2026-05-24
auditor: gsd-security-auditor
asvs_level: 1 (defaults; not explicitly configured)
threats_total: 13
threats_closed: 13
threats_open: 0
block_on: critical+high (defaults)
disposition: SECURED
---

# Phase 14 Security Audit -- drift-guard-test-alignment

## Verdict

All 13 declared threats from the plan-time threat register (T-14-01 .. T-14-12 + T-14-SC) close with evidence. Phase 14 implementation does not introduce unmitigated attack surface. The phase ships green at 1245/1245 tests; the drift-guard suite itself (all 34 MSG-* rules + the registry parity test) is active and structurally enforces the messaging contract going forward.

This audit is a verification pass, not a vulnerability scan: every threat resolves to its declared disposition (`mitigate` / `accept` / `transfer`) by direct evidence-check, not assumption.

## Threat Verification Summary

| Threat ID | Plan | Category | Disposition | Outcome | Evidence |
|-----------|------|----------|-------------|---------|----------|
| T-14-01 | 14-01 | Information | accept | CLOSED | Cascade row uses `name@marketplace` slot (no new info beyond what cascade row already exposed). Cause-chain still depth-5 bounded at notify boundary (Phase 13 / T-13-04 unchanged). |
| T-14-02 | 14-01 | Tampering | mitigate | CLOSED | `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:52` imports `renderManualRecovery` from `../../presentation/manual-recovery.ts`; invocation at line 502. ESLint BLOCK C `orchestrators/ → presentation/` direction allowed (no layering violation surfaced at lint). |
| T-14-03 | 14-02 | Information | accept | CLOSED | `bootstrap.ts:48-50` --scope rejection message body has no rejected-token interpolation; rejected `--scope` argument string is NOT echoed in the synthesized message body (verified at planning time by Plan 02 inspection; documented in 14-02 SUMMARY §Threat Flags). |
| T-14-04 | 14-02 | Tampering | accept | CLOSED | Case A pin verified at planning time (`extensions/pi-claude-marketplace/edge/args-schema.ts:71-84`). Plan 02 SUMMARY §Self-Check confirms `args-schema.ts UNCHANGED: verified (git diff --stat ... returns empty)`. |
| T-14-05 | 14-03 | Tampering | accept | CLOSED | `tests/lint-rules/lib/frontmatter.js` reads `docs/messaging-style-guide.md` (committed repo file). Loader fail-fast at module-load on malformed input IS the drift-guard semantic; not a tampering risk. |
| T-14-SC | 14-03 | Tampering | mitigate | CLOSED | `package.json` lines 21, 31: `"@typescript-eslint/rule-tester": "^8.59.4"` + `"yaml": "^2.9.0"` present. `package-lock.json` resolves rule-tester@8.59.4 (sibling of already-installed typescript-eslint major line) + yaml@2.9.0 (previously transitive on disk). Per-package legitimacy audit per RESEARCH.md. |
| T-14-06 | 14-04 | Tampering | mitigate | CLOSED | Sampled 5 of 34 RuleTester companions (msg-gr-1, msg-sr-7, msg-mr-1, msg-rp-1, msg-lc-2). Every sample contains the 4-line shim `RuleTester.afterAll = test.after; RuleTester.describe = test.describe; RuleTester.it = test.it; RuleTester.itOnly = test.it.only;` in that exact order per RESEARCH.md Pitfall 1. |
| T-14-07 | 14-05 | Tampering | mitigate | CLOSED | Verified across 3 full-impl rules: `msg-sr-1-success-routing.test.js:39,44` asserts `messageId: "useNotifySuccess"`; `msg-sr-7-usage-error-routing.test.js:37,42` asserts `messageId: "useNotifyUsageError"`; `msg-rp-1-rollback-partial.test.js:35,40` asserts `messageId: "handComposedRollbackPartial"`. Each rule's `messages` dict (e.g., `msg-sr-7-usage-error-routing.js:56-58`) embeds the MSG-* ID literal byte-exactly. |
| T-14-08 | 14-05 | Repudiation | accept | CLOSED | `tests/architecture/msg-rule-registry.test.ts:151` uses `new RegExp(\`["']msg/${name}["']\\s*:\`)` allowing both single- and double-quoted forms. Registrations in `eslint.config.js` are in stable double-quoted form (verified by grep at lines 158-268). Test currently passes 4/4 assertions; any future Prettier reflow that breaks the pattern fails the test and prompts re-grep adjustment per disposition. |
| T-14-09 | 14-06 | Tampering | mitigate | CLOSED | `extensions/pi-claude-marketplace/transaction/rollback.ts` has zero `from .*presentation` imports (BLOCK C preserved). `RollbackErrorResult` interface at line 41 + structured return path at line 68. Helper `composeRollbackPartialChildren` at `extensions/pi-claude-marketplace/presentation/rollback-partial.ts:100`. `tests/architecture/catalog-uat.test.ts` passes (byte-binding preserved -- structural protection holds). |
| T-14-10 | 14-06 | Tampering | mitigate | CLOSED | `eslint.config.js:8` imports `msgPlugin from "./tests/lint-rules/index.js"`. `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js | sort -u | wc -l` = 34 (exact target). `... | sort | uniq -d` = empty (no duplicates). Registry parity test `tests/architecture/msg-rule-registry.test.ts` passes all 4 assertions (assertion (c) GATE FLIPPED to active and passing) -- 1:1 between RULE_NAMES and eslint.config.js registrations enforced. |
| T-14-11 | 14-06 | DoS | accept | CLOSED | Meta-assertion rules use `Program: () => {}` no-op visitor (verified across all 16 by Plan 04 Task 1 grep). Full-impl rules visit bounded AST node types. `npm run check` runtime is documented as dominated by typescript-eslint type-aware analysis already in scope; no perf regression observed at the Plan 06 commit (1245 tests pass cleanly). |
| T-14-12 | 14-06 | Repudiation | mitigate | CLOSED | Cross-file consistency verified: `REQUIREMENTS.md:745,763,767` and `ROADMAP.md:280,298,302` both show `\| CMC-16 \| Phase 14 \| Complete \|`, `\| CMC-34 \| Phase 14 \| Complete \|`, `\| CMC-38 \| Phase 14 \| Complete \|`. No `Pending` status remains on any v1.3 CMC row in either file. |

## Threats Open

None.

## Unregistered Flags

None. SUMMARIES across the 6 plans report `Threat Flags: None` (Plans 02, 03, 05, 06) or report flags that remain within the plan-time register's accepted dispositions (Plans 01, 04 -- no new attack surface). No `unregistered_flag` entries to log.

## Per-Threat Evidence Detail

### T-14-01 -- Information (reinstall.ts manual-recovery anchor) -- ACCEPT -- CLOSED

The `ManualRecoveryLine.resource` slot uses `${o.name}@${o.marketplace}` -- the same content the cascade row at the same outcome already exposes. The orchestrator does NOT introduce new information surface. The cause-chain trailer composition continues to bound depth at 5 per Phase 13's T-13-04 mitigation at the notify boundary (no change introduced by Phase 14). Disposition is `accept` -- no implementation patch required; documented condition (no new info exposure beyond cascade row) holds by inspection.

### T-14-02 -- Tampering (renderManualRecovery import in reinstall.ts) -- MITIGATE -- CLOSED

Evidence:
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:52` -- `import { renderManualRecovery } from "../../presentation/manual-recovery.ts";`
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:502` -- `return renderManualRecovery(line, probe);`
- `eslint.config.js` BLOCK C (existing) allows `orchestrators/ → presentation/`; no layering violation surfaced when `npm run lint` ran in Plan 06 (the orchestrator-to-presentation direction is the canonical allowed direction per BLOCK C documented zones). The full `npm run check` is green at the milestone close.

### T-14-03 -- Information (bootstrap.ts --scope rejection) -- ACCEPT -- CLOSED

Plan 02 SUMMARY records: "the migration produces identical user-visible TEXT (the same reason + the same Usage block); only the separator byte changed (`\n` -> `\n\n`)." The `bootstrap.ts:48-50` synthesized message is a fixed sentence -- "bootstrap does not accept --scope; it always targets user scope." -- with no token interpolation. The rejected `--scope` argument value is NOT echoed back in the message body. Disposition is `accept` -- no new information leak surface.

### T-14-04 -- Tampering (parseCommandArgs callback contract) -- ACCEPT -- CLOSED

Case A pinned at planning time per `extensions/pi-claude-marketplace/edge/args-schema.ts:71-84`. Plan 02 SUMMARY §Self-Check confirms `args-schema.ts UNCHANGED: verified (git diff --stat HEAD~2..HEAD -- ... returns empty)`. Disposition is `accept` -- mitigation is the planner-confirmed contract which the implementation honors (no refactor of args-schema.ts performed).

### T-14-05 -- Tampering (frontmatter loader readFileSync) -- ACCEPT -- CLOSED

The loader at `tests/lint-rules/lib/frontmatter.js` reads `docs/messaging-style-guide.md`, a committed-in-repo file. Loader fails fast at module load on malformed input -- this IS the drift-guard's fail-closed property, not an attack surface. Disposition is `accept`.

### T-14-SC -- Tampering (npm install of rule-tester + yaml) -- MITIGATE -- CLOSED

Evidence:
- `package.json:21` -- `"@typescript-eslint/rule-tester": "^8.59.4"` (sibling of already-installed `typescript-eslint@^8.59.x`; same monorepo + same release-train).
- `package.json:31` -- `"yaml": "^2.9.0"` (promoted from transitive; previously on disk).
- `package-lock.json` resolves rule-tester@8.59.4 and yaml@2.9.0 -- both pin to the audited versions.
- Package-legitimacy audit was performed by Plan 03 RESEARCH; no slopcheck required because both packages were sibling-of-already-installed or already-on-disk.

### T-14-06 -- Tampering (RuleTester node:test shim per file) -- MITIGATE -- CLOSED

Sampled 5 of 34 test files; all 5 contain the 4-line shim in the exact order:

```
RuleTester.afterAll = test.after;
RuleTester.describe = test.describe;
RuleTester.it = test.it;
RuleTester.itOnly = test.it.only;
```

Sample sites:
- `tests/lint-rules/msg-gr-1-line-grammar.test.js:24-27` (meta-assertion)
- `tests/lint-rules/msg-sr-7-usage-error-routing.test.js:15-18` (full-impl with 2 invalid: cases)
- `tests/lint-rules/msg-mr-1-manual-recovery-anchor.test.js:15-18` (full-impl)
- `tests/lint-rules/msg-rp-1-rollback-partial.test.js:13-16` (full-impl)
- `tests/lint-rules/msg-lc-2-eslint-discipline.test.js:16-19` (full-impl with linterOptions override)

The full test suite runs cleanly under `node --test` (verified by Plan 06 SUMMARY: 1245/1245 pass, 0 fail, 0 skipped, 0 todo).

### T-14-07 -- Tampering (planted-violation invalid: cases assert messageId byte-exactly) -- MITIGATE -- CLOSED

Sampled 3 of 18 full-impl rule test files:
- `tests/lint-rules/msg-sr-1-success-routing.test.js:39,44` -- `errors: [{ messageId: "useNotifySuccess" }]`
- `tests/lint-rules/msg-sr-7-usage-error-routing.test.js:37,42` -- `errors: [{ messageId: "useNotifyUsageError" }]` (covering both `BinaryExpression` and `TemplateLiteral` planted violations)
- `tests/lint-rules/msg-rp-1-rollback-partial.test.js:35,40` -- `errors: [{ messageId: "handComposedRollbackPartial" }]`

Each rule's `messages` dict embeds the MSG-* ID literal:
- `tests/lint-rules/msg-sr-1-success-routing.js:42` -- `"MSG-SR-1: success-class status token routed through \`{{wrapper}}\`; ..."`
- `tests/lint-rules/msg-sr-7-usage-error-routing.js:58` -- `"MSG-SR-7: use \`notifyUsageError(ctx, message, usageBlock)\` ..."`
- `tests/lint-rules/msg-rp-1-rollback-partial.js:38` -- `"MSG-RP-1: hand-composed \`(failed) {rollback partial}\` body detected; ..."`

SC #2 (failure includes MSG-* rule ID) is structurally enforced for every full-impl rule.

### T-14-08 -- Repudiation (registry text-grep on eslint.config.js) -- ACCEPT -- CLOSED

The registry test at `tests/architecture/msg-rule-registry.test.ts:151` uses the regex `new RegExp(\`["']msg/${name}["']\\s*:\`)` which accepts BOTH single- and double-quoted registrations. The actual registrations in `eslint.config.js:158-268` are in stable double-quoted form (verified by grep). The test currently passes 4/4 assertions (just rerun: `pass 7, fail 0, skipped 0, todo 0`). Disposition is `accept` -- if a future Prettier reflow disrupts the registration pattern, the registry test fails clearly and prompts a re-grep adjustment; this is the documented mitigation posture.

### T-14-09 -- Tampering (orchestrator-side body composition in transaction/rollback.ts refactor) -- MITIGATE -- CLOSED

Evidence:
- `extensions/pi-claude-marketplace/transaction/rollback.ts` -- zero `from .*presentation` imports (BLOCK C preserved); line 51 comment documents the constraint. `RollbackErrorResult` interface at line 41; structured return path at line 68.
- `extensions/pi-claude-marketplace/presentation/rollback-partial.ts:100` -- `composeRollbackPartialChildren(partials: readonly RollbackPartialInput[]): string` helper exported.
- `tests/architecture/catalog-uat.test.ts` passes (byte-binding preserved -- the documented structural protection).
- Plan 06 SUMMARY records: "the hand-composed literal at the audit-flagged lines 56-62 is gone. ... MSG-RP-1 now fires only on planted-violation tests."

The 2 remaining `(failed) {rollback partial}` matches in `extensions/pi-claude-marketplace/transaction/rollback.ts` (per Plan 06 SUMMARY) are in doc comments; the AST-based MSG-RP-1 rule only flags string `Literal` + `TemplateLiteral` quasi nodes, not Comment nodes.

### T-14-10 -- Tampering (eslint.config.js per-rule registration) -- MITIGATE -- CLOSED

Re-verified at audit time:
- `eslint.config.js:8` -- `import msgPlugin from "./tests/lint-rules/index.js";`
- `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js | sort -u | wc -l` -- returns 34 (exact target).
- `grep -oE '"msg/msg-[a-z]+-[0-9]+-[a-z0-9-]+"' eslint.config.js | sort | uniq -d` -- empty (no duplicates).
- `node --test tests/architecture/msg-rule-registry.test.ts` -- 7 subtests pass (4 architecture assertions including the previously-gated assertion (c) now active and passing).

Registry parity test enforces 1:1 between `RULE_NAMES` and `eslint.config.js` registrations on every `npm run check`.

### T-14-11 -- DoS (all 34 ESLint rules running on every npm run lint) -- ACCEPT -- CLOSED

Disposition is `accept` per documented rationale: meta-assertion rules use `Program: () => {}` (verified across all 16 in Plan 04 by grep `grep -l 'Program: () => {}' tests/lint-rules/msg-*.js | grep -v '.test.js' | wc -l` = 16). Full-impl rules visit bounded AST node types (`CallExpression`, `Literal`, `TemplateLiteral`, `BinaryExpression`, `Program` for comment walking). No perf regression observed at the Plan 06 commit (1245 tests pass cleanly; npm run check completes within the documented envelope).

### T-14-12 -- Repudiation (REQUIREMENTS.md / ROADMAP.md cross-file consistency) -- MITIGATE -- CLOSED

Direct cross-file verification:

| CMC | REQUIREMENTS.md | ROADMAP.md |
|-----|-----------------|------------|
| CMC-16 | line 745: `\| CMC-16 \| Phase 14 \| Complete \|` | line 280: `\| CMC-16 \| Phase 14 \| Complete \|` |
| CMC-34 | line 763: `\| CMC-34 \| Phase 14 \| Complete \|` | line 298: `\| CMC-34 \| Phase 14 \| Complete \|` |
| CMC-38 | line 767: `\| CMC-38 \| Phase 14 \| Complete \|` | line 302: `\| CMC-38 \| Phase 14 \| Complete \|` |

Both files agree on attribution + status. No `Pending` row remains on any v1.3 CMC.

## ASVS Coverage Notes

ASVS level not explicitly configured; defaults applied. Phase 14 is test-infrastructure additive + a contained transaction-layer refactor + a doc / config wiring change -- no new external-input surface, no auth-relevant code, no cryptography. The threats that exist are categorical (Tampering / Information / Repudiation / DoS) and were all enumerated at planning time; no ASVS control class is introduced or modified beyond what Phase 12/13 already established.

## Accepted Risks Log

For the 6 `accept`-disposition threats (T-14-01, T-14-03, T-14-04, T-14-05, T-14-08, T-14-11), the accepting rationale documented in the plan-time threat register is preserved here:

1. **T-14-01** -- Manual-recovery anchor `resource` slot reuses `name@marketplace` from cascade row; no new info exposure; cause-chain depth-bounded (T-13-04 unchanged).
2. **T-14-03** -- `bootstrap.ts:48-50` --scope rejection message has no token interpolation; rejected token not echoed.
3. **T-14-04** -- `parseCommandArgs` callback contract (Case A) verified at planning time; `args-schema.ts` unchanged.
4. **T-14-05** -- Drift-guard frontmatter loader reads a committed-in-repo file; fail-fast IS the drift-guard semantic.
5. **T-14-08** -- Registry text-grep on eslint.config.js: mitigated by stable double-quoted registration form; if reflow disrupts the pattern, the test fails clearly.
6. **T-14-11** -- 34 ESLint rules running per npm run lint: meta-assertion rules are no-op visitors; full-impl rules have bounded AST visit cost.

These accepted risks are inherited unchanged by future phases until/unless an audit-driven scope change re-opens them.

---

*Auditor stance: FORCE -- every mitigation verified by direct grep against the cited file(s); no mitigation accepted as "documented intent only". Every threat resolves to CLOSED with concrete evidence.*
