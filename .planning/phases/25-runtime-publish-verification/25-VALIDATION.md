---
phase: 25
slug: runtime-publish-verification
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-29
---

# Phase 25 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in, ≥20.19) |
| **Config file** | none -- glob-driven via `package.json` (`npm test` globs `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,shared,transaction}/**/*.test.ts`; `tests/e2e/**` is EXCLUDED, runs via `npm run test:e2e`) |
| **Quick run command** | `node --test "tests/architecture/catalog-uat.test.ts" "tests/edge/completions/provider.test.ts"` (the two existing locks) + any new SNM-37/38 test file |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + `npm test`) |
| **Estimated runtime** | ~30-60 seconds for the in-check suite; `npm run test:e2e` adds the load-only runtime smoke |

---

## Sampling Rate

- **After every task commit:** Run the quick command (the touched test files + the two existing locks).
- **After every plan wave:** Run `npm test` (full in-check unit/integration glob).
- **Before `/gsd-verify-work`:** `npm run check` must be GREEN; the manual G-MIL-07 interactive verdict recorded as an artifact (UAT/STATE).
- **Max feedback latency:** ~60 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 25-01-01 | 01 | 1 | SNM-37 | T-25-01 / T-25-03 | source loads under isolated HOME; no sandbox escape to real `~/.pi`; runtime version re-verified | e2e smoke (existing) | `npm run test:e2e` (`pi-runtime-smoke.test.ts`) | ✅ | ⬜ pending |
| 25-01-02 | 01 | 1 | SNM-37 | -- | v1.4 byte forms at pre-tui notify boundary (no `/reload` trailer, `v#<7hex>`, `{lsp}`) | unit (notify-capture) | `node --test "tests/shared/snm37-behavioral-smoke.test.ts"` | ❌ W0 | ⬜ pending |
| 25-01-03 | 01 | 1 | SNM-37 | -- | SNM-37 text + SC#1 amended in lockstep (doc) | doc assertion | `grep -q 'scripts/pi.sh' .planning/REQUIREMENTS.md && grep -q behavioral .planning/ROADMAP.md` | ✅ (target files) | ⬜ pending |
| 25-02-01 | 02 | 2 | SNM-38 | T-25-04 / T-25-05 | renderer emits header=col 0 / row=2-space ladder (catalog-conformant); no wrong-truth header→2 "fix" | architecture (byte-equality, existing) | `node --test "tests/architecture/catalog-uat.test.ts"` | ✅ | ⬜ pending |
| 25-02-02 | 02 | 2 | SNM-38 | T-25-04 | explicit per-line leading-whitespace assertion (header 0 / row 2) + catalog clarification recorded | unit | `node --test "tests/shared/snm38-indent-ladder.test.ts"` | ❌ W0 (optional, Claude's discretion: YES) | ⬜ pending |
| 25-03-01 | 03 | 2 | SNM-39 | T-25-08 / T-25-09 | OUR provider returns `["@mp-a","@mp-b"]` for `update @` (proves gap is host-side); no provider contortion | unit (existing) | `node --test "tests/edge/completions/provider.test.ts"` (TC-6 :806) | ✅ | ⬜ pending |
| 25-03-02 | 03 | 2 | SNM-39 | T-25-06 / T-25-07 | live `update @<TAB>` interception confirmation under `--home` sandbox; read-only real-home spot-check | manual / interactive escalation | n/a -- `scripts/pi.sh --home <tmp> --cd <fixture>`; user presses Tab; capture result (D-25-08) | ❌ manual (by design) | ⬜ pending |
| 25-03-03 | 03 | 2 | SNM-39 | -- | G-MIL-07 verdict recorded (root_cause/artifacts/missing) + G-MIL-03 cross-ref; SNM-37 blocker resolved | doc assertion | `grep -q 'CombinedAutocompleteProvider\|extractAtPrefix\|pi-tui' .planning/v1.4-MILESTONE-UAT.md` | ✅ (target files) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/shared/snm37-behavioral-smoke.test.ts` -- drives `list` via `makeMockPi`/`makeCtx` (or the catalog-uat `mock.fn()` ctx), asserts the three v1.4 byte forms (covers SNM-37 behavioral half). Reuses the `tests/e2e/_helpers.ts` capture seam. MUST live in `tests/shared/` to gate `npm run check` (RESEARCH Pitfall 3). [plan 01, task 2]
- [ ] `tests/shared/snm38-indent-ladder.test.ts` -- explicit per-line leading-whitespace assertion (header 0 / row 2), anchored on `notify.ts` constants, NOT the UAT 2/4 misquote. The catalog-uat test already covers this; added for readability + drift insurance (Claude's discretion: YES). [plan 02, task 2]
- [ ] Sandbox fixture builder -- marketplaces with ≥1 installed plugin each + a row exercising the `{...}` reason brace + an installed/available mix + ≥1 hash-versioned plugin. Reuse `installTargetWithMockPi` or the install handler against a fixture marketplace (mirror the `tmp/pihome` shape). Needed for BOTH the SNM-37 smoke fixture and the SNM-39 live precondition. [plans 01/03]
- [ ] No framework install needed -- `node:test` is built in.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live `/claude:plugin update @<TAB>` interception confirmation | SNM-39 | Pi-tui consumption only manifests at a live keystroke in a real TTY; D-25-08 forbids building a programmable keystroke harness; final confirmation is an interactive escalation to the user | `scripts/pi.sh --home <tmp-sandbox> --cd <fixture-project-with-no-@-matching-files>`; type `/claude:plugin update @`; press Tab; report nothing / file paths / `@<mp>` candidates; D-25-05 read-only real-`~/.pi` spot-check if `@<mp>` candidates appear in the sandbox |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are the one locked manual escalation (SNM-39 live trigger, D-25-08) backed by the automated TC-6 provider lock
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (the single manual task 25-03-02 is flanked by automated 25-03-01 and 25-03-03)
- [x] Wave 0 covers all MISSING references (the two new `tests/shared/` files + the fixture builder)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-29
