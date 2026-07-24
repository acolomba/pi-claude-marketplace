---
phase: 84
slug: emit-an-agent-local-skillpath-field-on-every-generated-agent
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 84 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `84-RESEARCH.md` §Validation Architecture. Per-task map is
> filled once plans exist (task IDs assigned by the planner).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node built-in `node:test` (via `node --test`) |
| **Config file** | none — glob-driven via `package.json` `scripts.test` |
| **Quick run command** | `node --test tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert.test.ts` |
| **Full suite command** | `npm run check` (typecheck + lint + format:check + `npm test` + `npm run test:integration`) |
| **Estimated runtime** | ~15s quick · ~2–3 min full check |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert.test.ts`
- **After every plan wave:** Run `npm run check`
- **Before `/gsd-verify-work`:** `npm run check` green, plus the manual SC-2 resolver script and SC-4 live-spawn A/B re-run with captured output
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Seeded pre-plan — task IDs are assigned by the planner. Fill after plans land.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | AGSK-06 (SC-1) | — | `skillPath` emitted iff `skills:` non-empty; skill-less byte-identical | unit | `node --test tests/bridges/agents/frontmatter.test.ts` | ✅ | ⬜ pending |
| TBD | — | — | AGSK-06 (SC-1 legend) | — | every legend entry `(available on demand)`, never `(preloaded in your context)` | unit | `node --test tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/convert.test.ts` | ✅ | ⬜ pending |
| TBD | — | — | AGSK-06 (SC-2) | — | `resolveSkillsWithFallback` resolves bridged skill by generated name; not in parent/global catalog | integration/script | new resolver-contract fixture (see Wave 0) | ❌ W0 | ⬜ pending |
| TBD | — | — | AGSK-06 (SC-3) | — | `package.json` declares `pi-subagents >=0.35.0` (optional peer); `npm run check` green | CI gate | `npm run check` | ✅ | ⬜ pending |
| TBD | — | — | AGSK-06 (SC-4) | — | live foreground spawn loads/uses skill; A/B without `skillPath` fails | manual UAT | `subagent({ ..., async: false })` A/B | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] SC-2 has no existing test exercising `resolveSkillsWithFallback` against a real staged skill dir. Plan must decide: a permanent `tests/integration/` fixture importing `pi-subagents` `src/agents/skills.ts` (guarded by a presence check + `test.skip` on dynamic-import failure, since pi-subagents is an optional peer not vendored in `node_modules`), OR a one-off manual verification script captured in UAT evidence (mirroring 84-NOTES.md's three-way verification).
- [ ] (Optional) SC-3 needs no new test beyond `npm run check` passing; planner may add a lightweight architecture test asserting `pi-subagents` appears in `peerDependencies` with the expected range (mirroring `extension-version-sync.test.ts`). `no-telemetry-deps.test.ts` confirmed unaffected by adding `pi-subagents`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live spawn A/B loads and uses the bridged skill | AGSK-06 (SC-4) | Inherently a live-environment check; not automatable in `node --test` | Run `subagent({ agent: <bridged-agent>, task, async: false })` twice — with and without `skillPath` in the generated file — using a unique-token skill; with `skillPath` the subagent emits the token, without it prints the no-skill sentinel. Use `async: false` to avoid the pi-subagents #526 async-runner TypeBox confound. |
| Resolver-contract check | AGSK-06 (SC-2) | Requires the installed pi-subagents package (optional peer, may be absent in CI) | Import `resolveSkillsWithFallback` from installed pi-subagents against a real staged skill install; assert `resolved` is non-empty for the generated name and `discoverAvailableSkills(cwd)` excludes it (invocation-private). |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (SC-2 resolver fixture)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
