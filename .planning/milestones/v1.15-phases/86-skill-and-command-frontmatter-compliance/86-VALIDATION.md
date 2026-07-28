---
phase: 86
slug: skill-and-command-frontmatter-compliance
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 86 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) + `node:assert/strict` |
| **Config file** | none — glob-driven via `package.json` `test` script |
| **Quick run command** | `node --test "tests/bridges/skills/**/*.test.ts" "tests/bridges/commands/**/*.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + `npm test` + `npm run test:integration`) |
| **Estimated runtime** | ~30s quick; ~2–3 min full |

---

## Sampling Rate

- **After every task commit:** Run the quick command (skills + commands bridge tests) plus `npm run typecheck`
- **After every plan wave:** Run `npm test` (full unit set) + `npm run test:integration`
- **Before `/gsd-verify-work`:** `npm run check` must be green
- **Max feedback latency:** ~30 seconds (quick command)

---

## Per-Task Verification Map

> Seeded from RESEARCH.md Phase Requirements → Test Map. Task IDs are populated
> once plans exist; the requirement → test-command mapping below is authoritative.

| Requirement | Behavior | Threat Ref | Test Type | Automated Command | File Exists |
|-------------|----------|------------|-----------|-------------------|-------------|
| PARSE-01 | source gate parses before rewrite/substitution | T-86 V5 | unit | `node --test "tests/bridges/skills/stage.test.ts"` | ✅ extend |
| PARSE-02 | staged self-inflicted breakage throws (not degraded) | T-86 V5 | unit | `node --test "tests/bridges/skills/stage.test.ts"` | ✅ extend |
| SKILL-01 | unparseable skill → `disable-model-invocation` block, body verbatim | — | unit | `node --test "tests/bridges/skills/stage.test.ts"` | ✅ extend |
| SKILL-02 | empty/absent desc → first-body-line fallback | — | unit | new helper test + `stage.test.ts` | ❌ Wave 0 |
| SKILL-03 | written `name` == generated name; folded scalar cannot corrupt | — | unit | `node --test "tests/bridges/skills/rewrite-frontmatter.test.ts"` | ✅ extend |
| WTU-01 | `when_to_use` appended into `description` | — | unit | new helper test | ❌ Wave 0 |
| WTU-02 | combined truncated at 1,536 (hard cut); >1024 still loads in Pi | DoS-context | unit | new helper test | ❌ Wave 0 |
| CMD-01 | unparseable command → neutralized (name-from-file, first-body-line) | — | unit | `node --test "tests/bridges/commands/stage.test.ts"` | ✅ extend |
| WARN-01 | degrade → reason token on row + detail via `notifyDiagnostic` | — | unit | `tests/shared/notify-v2.test.ts` + orchestrator test | ✅ extend |
| CLASS-01 | REASONS 35→37 byte-stable; FAILURE_REASONS membership; proof compiles | — | unit + typecheck | `npm run typecheck` + `tests/shared/notify-v2.test.ts` | ✅ extend |
| NREG-01 | valid + non-empty desc + no `when_to_use` → byte-for-byte identical | Tampering | unit | `stage.test.ts` byte-equality assertion | ✅ extend |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] New skills helper module test — first-paragraph extraction, `when_to_use` fold, 1,536 truncation, safe scalar emit (covers SKILL-02, WTU-01, WTU-02)
- [ ] Fixtures: a skill whose source frontmatter throws (unquoted `: ` mid-scalar); a description-less skill; a skill with a `>-`/`|` block-scalar description; a folded multi-line `name`; a command whose frontmatter throws (covers PARSE/SKILL/CMD arms)
- [ ] Byte-equality (NREG-01) assertion helper for the happy path
- [ ] Framework install: none — `node:test` already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/skill:<name>` resolves + never auto-invoked after `/reload` for a degraded skill | SKILL-01 | Requires a live Pi `/reload` and skill listing | Install a plugin with an unparseable skill; `/reload`; confirm `/skill:<name>` runs and the model does not auto-invoke it |
| A >1024-char combined description loads in Pi (warning, not `skill: null`) | WTU-02 / D-86-05 | Requires observing a live Pi startup diagnostic | Install a skill whose combined `description`+`when_to_use` is 1025–1536 chars; `/reload`; confirm the skill loads with a non-fatal warning |

*Automated coverage backs every requirement; the two rows above are live-`/reload` observability confirmations.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
