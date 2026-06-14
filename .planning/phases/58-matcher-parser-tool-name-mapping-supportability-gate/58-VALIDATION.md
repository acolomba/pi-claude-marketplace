---
phase: 58
slug: matcher-parser-tool-name-mapping-supportability-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-14
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `58-RESEARCH.md` § "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in) — Node 20.19+ |
| **Config file** | none — `node:test` self-configures via `node --test` |
| **Quick run command** | `node --test --test-name-pattern="hooks\|TOOL\|MATCH" tests/architecture/hooks-*.test.ts tests/domain/components/hooks.test.ts` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~5 s (quick); ~30 s (full check incl. lint, typecheck, prettier, tests) |

---

## Sampling Rate

- **After every task commit:** Run quick command (sub-second on the hooks subset).
- **After every plan wave:** Run `npm run check` (full lint + typecheck + tests + format).
- **Before `/gsd-verify-work`:** Full suite must be green; catalog-uat byte-equality MUST pass.
- **Max feedback latency:** ~5 s for the quick subset, ~30 s for the full check.

---

## Per-Task Verification Map

> Maps every Phase 58 requirement + load-bearing decision to a verifying command. The plan-checker will cross-walk this map against generated PLAN.md tasks; uncovered rows must be filled at planning time. `T-58-*` threat refs are placeholders pending the security-domain block in `58-RESEARCH.md` § "Security Domain" — wire concrete refs when the planner emits `<threat_model>`.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 58-XX-MATCH-01a | TBD | TBD | MATCH-01 | — | `parseMatcher("Edit")` → `{kind:"tool-set", piTools:Set(["edit"])}` | unit | `node --test tests/domain/components/hooks.test.ts` | ❌ W0 (extend) | ⬜ pending |
| 58-XX-MATCH-01b | TBD | TBD | MATCH-01 | — | `parseMatcher("Edit\|Write")` → `{kind:"tool-set", piTools:Set(["edit","write"])}` | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-MATCH-01c | TBD | TBD | MATCH-01 | — | `parseMatcher("")` / `parseMatcher("*")` → `{kind:"match-all"}` | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-MATCH-01d | TBD | TBD | MATCH-01 | — | `parseMatcher("mcp__server__tool")` → `{kind:"mcp-literal", literal:"mcp__server__tool"}` | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-MATCH-01e | TBD | TBD | MATCH-01 | T-58-01 (Pitfall 1) | `parseMatcher("edit")` (Pi-form lowercase) → `{kind:"unmapped"}` — never matches Pi runtime events | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-MATCH-02a | TBD | TBD | MATCH-02 | T-58-02 (Pitfall 8) | `parseMatcher("Edit.*")` → `{kind:"regex"}` | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-MATCH-02b | TBD | TBD | MATCH-02 | T-58-02 (Pitfall 6) | `parseMatcher("\|")` / `parseMatcher("Edit\|")` → `{kind:"regex"}` (loud rejection) | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-01a | TBD | TBD | TOOL-01 | — | TypeScript exhaustiveness: every Pi `ToolCallEvent.toolName` literal has a `PI_TO_CLAUDE_TOOL_NAMES` entry | architecture | `npm run typecheck` | ❌ W0 (new) | ⬜ pending |
| 58-XX-TOOL-01b | TBD | TBD | TOOL-01 | — | Runtime invariant: `PI_TO_CLAUDE_TOOL_NAMES` and `CLAUDE_TO_PI_TOOL_NAMES` are inverses | architecture | `node --test tests/architecture/hooks-tool-name-map.test.ts` | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-01c | TBD | TBD | TOOL-01 | — | `mcp__server__tool` bypasses the table (no entry needed) | unit | `node --test tests/domain/components/hooks.test.ts` | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-02a | TBD | TBD | TOOL-02(a) | T-58-02 | Regex matcher in `hooks.json` → `parseHooksConfig` returns `ok: false, reason: "unsupported hooks"`; `installable: false` | unit | `node --test tests/domain/components/hooks.test.ts` | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-02b | TBD | TBD | TOOL-02(b) | T-58-03 (Pitfall 10) | Unmapped Claude tool (`MultiEdit` / `WebFetch` / `Task`) → same flip | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-02c1 | TBD | TBD | TOOL-02(c) | T-58-04 | Non-bucket-A event (`Stop`, `Notification`) → same flip | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-02c2 | TBD | TBD | TOOL-02(c) | T-58-05 (Pitfall 5) | `UserPromptSubmit` with non-empty matcher → same flip (Claude has no matcher support upstream) | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-02c3 | TBD | TBD | TOOL-02(c) | T-58-06 | `SessionStart` `source: "clear"` / `"compact"` (no Pi field) → same flip | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-02c4 | TBD | TBD | TOOL-02(c) | T-58-06 | `PreCompact`/`PostCompact` `trigger: "manual"` / `"auto"` (no Pi field) → same flip | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-02d | TBD | TBD | TOOL-02(d) | — | Handler `type: "http"` (non-`command`) → same flip | unit | same | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-02cs | TBD | TBD | TOOL-02 closed-set | — | `BUCKET_A_EVENTS` tuple deepEqual lock = exactly the 8 documented events | architecture | `node --test tests/architecture/hooks-supportability.test.ts` | ❌ W0 | ⬜ pending |
| 58-XX-TOOL-02det | TBD | TBD | TOOL-02 debug | — | `hookDebugLog` carries `(a)`/`(b)`/`(c)`/`(d)` distinguishing detail when `PI_CLAUDE_MARKETPLACE_DEBUG=1` | unit | `node --test tests/domain/components/hooks.test.ts` | ❌ W0 | ⬜ pending |
| 58-XX-D-58-06a | TBD | TBD | D-58-06 | — | Per-non-tool-event source/reason/trigger closed-set membership lock; architecture-test deepEqual | architecture | `node --test tests/architecture/hooks-supportability.test.ts` | ❌ W0 | ⬜ pending |
| 58-XX-HOOK-04a | TBD | TBD | HOOK-04 | — | `REASONS` tuple member is `"unsupported hooks"`; tuple length unchanged at 31 | architecture | `npm run typecheck` (`_Assert_ReasonsLen extends 31`) | ✅ `tests/architecture/notify-types.test.ts:912` | ⬜ pending |
| 58-XX-HOOK-04b | TBD | TBD | HOOK-04 | — | Resolver flow: malformed `hooks.json` renders `(unavailable) {unsupported hooks}` via existing notify cascade across all 5 orchestrator surfaces | integration | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (re-key 13 fixtures) | ⬜ pending |
| 58-XX-HOOK-04c | TBD | TBD | HOOK-04 | — | `narrowResolverNotes` emits `"unsupported hooks"` for both `"malformed hooks.json: …"` and `"unsupported hooks: …"` notes; tightened substring match | unit | `tests/shared/probe-classifiers.test.ts` (verify or create) | ❌ W0 | ⬜ pending |
| 58-XX-HOOK-04d | TBD | TBD | HOOK-04 (grammar) | — | Failed-row subject-first grammar invariant holds with `{unsupported hooks}` | architecture | `node --test tests/architecture/notify-grammar-invariant.test.ts` | ✅ (extend) | ⬜ pending |
| 58-XX-D-58-02 | TBD | TBD | D-58-02 | — | `MANIFEST_FIELD_REASONS` set no longer contains `"hooks"` (keeps `"lspServers"`); `MANIFEST_FIELD_TO_REASON` drops `"hooks"` entry | unit | extend existing `install.ts` tests | ⚠️ verify | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Plan-time TODO:** Replace `TBD` Plan / Wave columns and `58-XX-*` task-ID prefixes once the planner emits the final PLAN.md frontmatter. The verification map row count (25) is the floor — additional rows for plan-specific implementation tasks may be added.

---

## Wave 0 Requirements

- [ ] `extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts` — TOOL-01 source-of-truth bidirectional map (D-58-04)
- [ ] `extensions/pi-claude-marketplace/domain/components/hook-events.ts` — bucket-A 8-event closed-set tuple + per-non-tool-event field-name/value-set maps (D-58-06)
- [ ] `tests/architecture/hooks-tool-name-map.test.ts` — TOOL-01 completeness (TypeScript exhaustiveness via `as const satisfies Record<PiToolName, string>`) + inverse-invariant runtime test
- [ ] `tests/architecture/hooks-supportability.test.ts` — TOOL-02 closed-set + per-event invariants (BUCKET_A_EVENTS deepEqual + per-event source/reason/trigger value sets)
- [ ] Extend `tests/domain/components/hooks.test.ts` — `parseMatcher` + `checkMatcherSupportability` unit tests (covers 17 rows above)
- [ ] Verify or create `tests/shared/probe-classifiers.test.ts` — narrowed substring-match update for `narrowResolverNotes`
- [ ] Re-key all 13 `tests/architecture/catalog-uat.test.ts` fixture rows from `reasons: ["hooks"]` → `reasons: ["unsupported hooks"]` (lines 272, 276, 507, 582, 829, 1175, 1708 per research)
- [ ] Re-key all 8 `docs/output-catalog.md` `{hooks}` occurrences → `{unsupported hooks}`
- [ ] Update `docs/messaging-style-guide.md` closed-set REASONS documentation

*Framework already installed (`node:test` is built-in; `package.json` already has `npm run check`).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `/reload` honors the TOOL-02 flip across an existing Pi session | TOOL-02 reconcile-honors-flip | Reconcile crossing a `/reload` boundary is end-to-end behavior — covered by reconcile fixtures, but a smoke check confirms the cascade reaches the user surface. | 1. Install a plugin whose `hooks.json` declares a regex matcher. 2. Confirm `(unavailable) {unsupported hooks}` row renders in `list`. 3. Run `/reload`. 4. Confirm `info <plugin>` still renders the unavailable row with the same reason. |
| `hookDebugLog` distinguishes (a)/(b)/(c)/(d) under `PI_CLAUDE_MARKETPLACE_DEBUG=1` | TOOL-02 debug | The debug envelope path is feature-flag gated; production unit tests cover the gating, but a one-time smoke check confirms the four detail strings render. | `PI_CLAUDE_MARKETPLACE_DEBUG=1 ./scripts/install-fixture.sh fixtures/hooks-tool-02-a` (etc. for b/c/d); grep stderr for `(a) regex` / `(b) unmapped tool:` / `(c) non-bucket-A event:` / `(d) non-command handler:` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (24/25 automated; HOOK-04 reconcile is integration via catalog-uat; manual smoke check covers `/reload` continuity)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (quick command covers every wave)
- [ ] Wave 0 covers all ❌-marked rows in the verification map (8 W0 items above)
- [ ] No watch-mode flags (`--test` runs once; `npm run check` runs once)
- [ ] Feedback latency < 30 s (quick: ~5 s; full: ~30 s)
- [ ] `nyquist_compliant: true` set in frontmatter once planner finalizes Plan / Wave columns

**Approval:** pending (planner fills Plan/Wave columns; checker verifies coverage during plan-checker pass)
