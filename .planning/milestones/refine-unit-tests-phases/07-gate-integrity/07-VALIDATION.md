---
phase: "07"
slug: "gate-integrity"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-10"
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `07-RESEARCH.md` §"Validation Architecture" — every command below was run
> in this tree during research, so the runtimes are measured rather than estimated.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in `node:test` (Node 26.8.2) with `node:assert/strict`; `strong-mock` 9.2.2 for strict interaction mocks |
| **Config file** | None — `package.json` scripts define the globs and concurrency |
| **Quick run command** | `node --test tests/architecture/<gate>.test.ts` |
| **Complexity command** | `npx fallow health --fail-on-issues` (~0.16 s) |
| **Structural command** | `npm run test:corresponding && npm run test:coverage:direct:negative` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | A single architecture gate is sub-second; the full ESLint sweep of 229 extension files is ~2.3 s; `fallow dead-code --production` is ~0.42 s |

---

## Sampling Rate

- **After every task commit:** `node --test <the gate file(s) the task touched>`, **plus**
  `npx fallow health --fail-on-issues`. The second command is not optional here:
  `eslint.config.js:315` turns `sonarjs/cognitive-complexity` **off** for `tests/**`, while
  Fallow's `maxCognitive: 15` analyses every unit including tests with zero threshold
  overrides. A new gate helper can pass `npm run lint` and still fail `npm run fallow`.
- **After every plan wave:** `npm run typecheck && npm run lint && npm run fallow && npm test`.
  Add `npm run test:coverage:direct:negative` for any wave touching
  `scripts/test-coverage-direct*.mjs`.
- **Extra sample, `__operations` / `__deps` removal only:**
  `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts`
  and the same for `reinstall-flow.ts` — the per-pair rule applies to any module whose
  signature changed.
- **Before `/gsd-verify-work`:** full `npm run check` green.
- **Max feedback latency:** under 30 seconds for a focused run.

---

## Per-Task Verification Map

Task IDs are assigned by the planner. This table is the requirement-level contract each task
must inherit from; `/gsd-validate-phase` fills the Task ID / Plan / Wave columns after planning.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|
| GGAT-01 | The shared scan accepts an injected root and reports the paths it opened | unit | `node --test tests/architecture/source-scan.test.ts` | ✅ extend | ⬜ pending |
| GGAT-01 | `no-orchestrator-network` covers `marketplace/{autoupdate,list,remove}.ts`, fires on a temp-root offender, stays green on the unmutated copy and on the comment near-miss | unit | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ extend | ⬜ pending |
| GGAT-01 | The gate matches a dynamic `import("…platform/git…")` and not the legitimate `plugin-resolver` dynamic import | unit | same command | ✅ extend | ⬜ pending |
| GGAT-01 | Every gate's visited-path set deep-equals its registry group, and each group is non-empty | unit | `node --test "tests/architecture/*.test.ts"` | ❌ W0 | ⬜ pending |
| GGAT-01 | A production path named in `tests/architecture/**` outside the registry is an offender; the meta-gate fires on a temp-root offender | unit | `node --test tests/architecture/<registry>.test.ts` | ❌ W0 | ⬜ pending |
| GGAT-01 | Each joined-regex name has a positive control: the synthesized specifier matches, and the composed path resolves | unit | `node --test tests/architecture/import-boundaries.test.ts` | ✅ extend | ⬜ pending |
| GGAT-01 | `partial-vocabulary-guard` reads the recursive unit-test sources and fires on a planted offender | unit | `node --test tests/architecture/partial-vocabulary-guard.test.ts` | ✅ extend | ⬜ pending |
| GGAT-01 | Base selection tries `origin/main` → `main` → upstream → `HEAD~1`, prints the chosen candidate, and exits non-zero only when all fail | unit (negative harness) | `npm run test:coverage:direct:negative` | ✅ extend | ⬜ pending |
| GGAT-01 | Zero pairs from a resolved-but-empty change set passes and names the skipped paths; zero pairs from a failed git invocation exits non-zero | unit (negative harness) | same command | ✅ extend | ⬜ pending |
| GGAT-01 | Fixture repos: no `origin/main`; shallow clone; docs-only commit | unit (negative harness) | same command | ✅ extend (`git init` machinery is new) | ⬜ pending |
| GGAT-03 | Exactly three extension files resolve `no-console` to `0`, over a full 229-file sweep | unit | `node --test tests/architecture/eslint-effective-config.test.ts` | ❌ W0 | ⬜ pending |
| GGAT-03 | A blanket `files:["**/*.ts"]` + `no-console:"off"` offender config flips the resolved severity and the gate fails on it | unit | same command | ❌ W0 | ⬜ pending |
| GGAT-03 | The resolved zone matrix matches the expected per-folder forbidden set; a zone-substitution offender and a rule-off offender each fail the gate | unit | `node --test tests/architecture/import-boundaries.test.ts` | ✅ extend | ⬜ pending |
| GGAT-03 | The `hooks-dispatch.test.ts` regex scrape is gone | unit | `npm test` (absence of the case) plus the registry meta-gate | ✅ delete per `D-07-12` | ⬜ pending |
| GGAT-04 | `BUCKET_A_EVENTS.length === 10`, and `Exclude<ClaudeHookEvent, BucketAEvent>` is `never` at compile time | unit + typecheck | `node --test tests/architecture/<closed-sets>.test.ts && npm run typecheck` | ❌ W0 | ⬜ pending |
| GGAT-04 | `softDepMarkers` handles exactly the two `Dependency` members and both marker literals are `REASONS` members | unit | same command | ❌ W0 | ⬜ pending |
| GGAT-04 | The production `REQUIRED_EVENT_FIELDS` table is not duplicated as a test oracle; the test derives its rows from the production table | unit | `node --test tests/bridges/hooks/dispatch-exec.test.ts` | ✅ revise | ⬜ pending |
| GGAT-04 | Optional collaborators are exercised with a real value at least once, not only `undefined` | unit | `node --test tests/bridges/hooks/dispatch.test.ts tests/bridges/hooks/event-router.test.ts` | ✅ extend | ⬜ pending |
| GGAT-04 | No `__`-prefixed options member survives under `extensions/`, excluding `declare const … : unique symbol` brands | unit | `node --test tests/architecture/<test-only-surface>.test.ts` | ❌ W0 | ⬜ pending |
| GGAT-04 | `replaceReinstalledPlugin` and the reinstall flow take their operations as production-owned parameters; no `__operations` and no `__deps` in the tree | unit | `node --test tests/orchestrators/plugin/reinstall-replace.test.ts tests/orchestrators/plugin/reinstall-flow.test.ts` | ✅ revise | ⬜ pending |
| GGAT-04 | The unowned-export census equals its committed pin, computed via `fallow dead-code --production` with `.fallowrc.json` unchanged | unit | `node --test tests/architecture/<unowned-exports>.test.ts` | ❌ W0 | ⬜ pending |
| GGAT-04 | Marker byte pins have exactly one owner; the dangling `no-legacy-markers.test.ts` citation is gone | unit | `node --test tests/shared/markers.test.ts tests/architecture/markers-snapshot.test.ts` | ✅ revise | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/architecture/<registry>.ts` — the literal repo-relative target registry (`D-07-05`).
      Every other gate task depends on it, so it lands first.
- [ ] `tests/architecture/<registry>.test.ts` — the self-hosting meta-gate (`D-07-06`), with an
      explicit allowance for the deliberate non-paths in `source-scan.test.ts`.
- [ ] `tests/architecture/temp-root-control.ts` — shared `mkdtemp` / copy / mutate helper.
      Extracting it is not optional: `duplicates.threshold: 3` makes copied fixture setup across
      gate files a hard failure.
- [ ] `tests/architecture/eslint-effective-config.test.ts` — replaces the `hooks-dispatch.test.ts`
      scrape (`D-07-12`).
- [ ] Three in-memory offender configs — blanket `no-console:"off"`, zone substitution, and
      rule-off — each supplied as `new ESLint({ cwd, overrideConfigFile: "eslint.config.js",
      overrideConfig: [oneBlock] })`. **Superseded route:** this file originally called for three
      committed files under `tests/fixtures/eslint-probe/`. Planning measured that route as
      impossible here and `07-07-PLAN.md` records the evidence — `fallow dead-code` flags the
      fixture's `export default` as an unused export, importing it from a `.ts` gate to give it a
      consumer fails `tsc` with `TS7016`, and `npm run lint`'s type-aware project service refuses
      a `.js` file outside `tsconfig.json`. The in-memory form still satisfies `D-07-10` (the real
      config file through ESLint's own loader, plus exactly one appended block) and is stronger:
      the one-mutation property becomes mechanically assertable as `overrideConfig.length === 1`.
      It is NOT the synthetic form `D-07-02` rejects — that form passed `overrideConfigFile: true`,
      which discards the config file entirely, and the plans prohibit it explicitly.
      The zone-substitution block must carry at least one zone; `zones: []` is rejected by the
      rule schema.
- [ ] A closed-set enrollment gate for `ClaudeHookEvent` / `Dependency`, plus the
      `Exclude<ClaudeHookEvent, BucketAEvent> extends never` compile-time proof and a correction
      to the `hook-events.ts:58-65` doc comment (research proved `satisfies` is one-directional:
      `tsc --noEmit --strict` exits 0 on a union member absent from the tuple).
- [ ] A test-only-surface gate (`__`-prefix plus `@internal Test-only`), with a documented
      carve-out for `declare const … : unique symbol`.
- [ ] An unowned-export gate wrapping `fallow dead-code --production --unused-exports`, asserting
      the census equals the committed pin (`D-07-19` as amended).
- [ ] `scripts/test-coverage-direct.mjs` — a root parameter on `changedPaths`/`gitLines` and an
      exported `selectBase(root)`, mirroring `assertCompleteCoverage`'s existing
      `selectedProjectRoot = projectRoot`.
- [ ] `git init` fixture machinery in `scripts/test-coverage-direct.negative.mjs` — the file has
      `mkdtemp` machinery already but constructs no git repositories.

---

## Manual-Only Verifications

All phase behaviors have automated verification. Every gate this phase touches is proved by a
runnable command; there is no UI, no network dependency, and no timing-sensitive behavior in
scope.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a named Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers every ❌ reference in the map above
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s
- [ ] Every task that adds a gate helper also runs `npx fallow health --fail-on-issues`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
