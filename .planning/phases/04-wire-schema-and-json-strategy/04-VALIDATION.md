---
phase: "4"
slug: "wire-schema-and-json-strategy"
# status lifecycle: draft (seeded by plan-phase) -> validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-03"
---

# Phase 4 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## From research (04-RESEARCH.md "Validation Architecture")

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` (Node 24 CI) + `strong-mock` doubles |
| Config file | none (npm scripts) |
| Quick run command | `node --test tests/shared/notification-json.test.ts` (or the owner file of the task) |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WIRE-01 | Every catalog fixture and raw kind converts; `schemaVersion === 1` integer; kind from the union | architecture | `node --test tests/architecture/catalog-uat/catalog-wire.test.ts` | ❌ Wave 0 |
| WIRE-03/04/05/06 | Verbatim tokens, raw values, `scope`, absent-not-null, `[]`, order, `summary`, `tally`, `noOp`, `id` | unit (owner) | `node --test tests/shared/notification-json.test.ts` | ❌ |
| WIRE-08 | Walk: no path missing from text, no live `Error`, no `undefined`/`null` | architecture | `node --test tests/architecture/catalog-uat/catalog-wire.test.ts` | ❌ |
| WIRE-09 | Regenerated document deep-equals the committed file; `schema/claude-plugin.schema.json` in `files`; `npm pack --dry-run` lists it | unit + plan step | `node --test tests/scripts/generate-wire-schema.test.ts`; `npm pack --dry-run 2>&1 \| grep claude-plugin.schema.json` | ❌ |
| JOUT-02 | `Compile(schema).Check` over all 260 + 8 raw; planted invalid fixture fails; a converter returning `{}` reports failures (inject the converter into the harness function) | architecture | `node --test tests/architecture/catalog-uat/catalog-wire.test.ts` | ❌ |
| PMOD-04 | Each site redacts; text bytes unchanged; JSON contains no credential | unit + architecture | `node --test tests/shared/redact-credentials.test.ts tests/architecture/no-credential-leak.test.ts`; `node scripts/notify-corpus.mjs check` | partial (gate exists) |
| LLMT-01 | `details` rows and blocks match wire shapes; `upgradable` verbatim; line text unchanged | unit | `node --test tests/edge/handlers/tools.test.ts` | ✅ (update) |
| Text lock | Catalog bytes unchanged | architecture | `node --test tests/architecture/catalog-uat/catalog-contract.test.ts` | ✅ |

### Sampling Rate
- **Per task commit:** the owner test(s) plus pre-commit hooks (`check:changed` runs inside them).
- **Per plan:** `npm run test:architecture`, `npm run lint:type-members`, `npm run fallow`, `node scripts/notify-corpus.mjs check`.
- **Phase gate:** full `npm run check` green, plus `npm pack --dry-run` listing the schema file.

### Wave 0 Gaps
- [ ] `tests/shared/redact-credentials.test.ts`: covers PMOD-04
- [ ] `tests/shared/notification-present.test.ts` (if the presentation module is separate)
- [ ] `tests/shared/notification-wire.test.ts` and `tests/shared/notification-json.test.ts`: 100% direct coverage
- [ ] `tests/architecture/catalog-uat/catalog-wire.test.ts`, plus the `present` hook on the 4 `emit` fixtures
- [ ] `tests/scripts/generate-wire-schema.test.ts`

---

## Sampling Rate

- **After every task commit:** the task's owner tests plus `npm run typecheck`, and pre-commit run manually (`SKIP=trufflehog pre-commit run --files ...`)
- **After every plan wave:** `npm run check` unpiped with the exit code written to a log, then `node scripts/notify-corpus.mjs check` (3134 present / 0 extra unless the D-08 ledger says otherwise) and `git diff --exit-code 4e6c568a -- docs/output-catalog.md`
- **Before `/gsd-verify-work`:** full suite green
- **Max feedback latency:** 1600 seconds

---

## Per-Task Verification Map

Filled by the planner per task.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 1600s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
