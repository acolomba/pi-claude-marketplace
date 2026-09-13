---
phase: "1"
slug: "manifest-read-fidelity"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-12"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `01-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in) + `node:assert/strict`; `strong-mock@^9.2.2` available for strict interaction mocks |
| **Config file** | none — the runner is configured entirely by the `package.json` script globs |
| **Quick run command** | `node --test <test-path>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick pair ~2-10s; full `check` chain minutes |

**`npm run check` is a longer chain than `.planning/codebase/CONVENTIONS.md` documents.** The actual chain is:

```text
typecheck && lint && fallow && format:check
  && test:corresponding && test:corresponding:negative
  && test:coverage:direct:negative && test && test:integration
```

`test:corresponding` enforces strict 1:1 source↔test pairing in BOTH directions and fires at the fifth link, before any suite runs. Every task creating a production module must create its paired test in the SAME task.

---

## Sampling Rate

- **After every task commit:** `node --test <the touched pair(s)>` plus `npm run test:corresponding`
- **After every plan wave:** `npm run typecheck && npm run lint && npm run fallow && npm test`
- **Before `/gsd-verify-work`:** full `npm run check` green, plus `pre-commit run --all-files`
- **Max feedback latency:** ~10 seconds for the per-task pair run

---

## Per-Task Verification Map

Filled by the planner. Requirement→test mapping seeded from research:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|
| MANF-01 (resolver) | bare `<pluginRoot>/plugin.json` read and honored | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend | ⬜ pending |
| MANF-01 (version) | `resolvePluginVersion` tier 1 reads the bare manifest `version` | unit | `node --test tests/orchestrators/plugin/shared.test.ts` | ✅ amend | ⬜ pending |
| MANF-01 (agreement, D-01-12) | one planted bare-manifest fixture; both readers honor it | behavioral | `node --test tests/architecture/<new>.test.ts` | ❌ W0 | ⬜ pending |
| MANF-01 (constant) | `MANIFEST_CANDIDATES` ordering and shape | unit | `node --test tests/domain/manifest-path.test.ts` | ❌ W0 pair | ⬜ pending |
| MANF-02 | both present ⇒ wrapped wins, in both readers | unit ×2 | resolver + shared test files | ✅ amend | ⬜ pending |
| MANF-03 (normalization) | `"./skills/"`, `"a/../skills"`, `"."` normalize and dedup | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend | ⬜ pending |
| MANF-03 (no warning) | `ui5` shape ⇒ 0 warnings AND `ui-theme-designer` shape ⇒ 0 warnings (D-01-21) | unit | `node --test tests/bridges/skills/discover.test.ts` | ✅ amend | ⬜ pending |
| MANF-04 | malformed **bare** manifest ⇒ `unavailable` with `malformed plugin.json:` | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend | ⬜ pending |
| MANF-04 (D-01-10) | malformed **wrapped** + valid bare ⇒ still `unavailable` | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend | ⬜ pending |
| MANF-04 (D-01-09) | present-but-unreadable candidate ⇒ malformed, not skipped | unit | `node --test tests/domain/resolver.test.ts` | ✅ amend | ⬜ pending |
| MANF-05 | neither candidate present ⇒ `{ ok: true, manifest: null }`, still installs | unit | `node --test tests/domain/resolver.test.ts` | ✅ exists `:1108` | ⬜ keep green |
| DEPS-01 | object `{name, version, marketplace}` renders with its constraint | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ amend | ⬜ pending |
| DEPS-01 (parser) | object shape parses to `{ name, version?, marketplace? }` | unit | `node --test tests/domain/dependencies.test.ts` | ❌ W0 pair | ⬜ pending |
| DEPS-02 | mixed string/object array renders every element | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ amend | ⬜ pending |
| DEPS (D-01-02/03) | missing-marketplace fill-in; `@`-bearing bare string verbatim | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ amend | ⬜ pending |
| DEPS (D-01-04) | sort on the dependency NAME, not the display string | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ amend | ⬜ pending |
| DEPS (D-01-05) | element with no usable `name` dropped silently | unit | `node --test tests/domain/dependencies.test.ts` | ❌ W0 | ⬜ pending |
| D-01-22 (catalog) | new byte form pairs byte-equal with `notify()` | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ amend both sides | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/domain/manifest-path.test.ts` — mandatory pair for the new constant module; covers MANF-01 / MANF-02 ordering
- [ ] `tests/domain/dependencies.test.ts` — mandatory pair for the new parser; covers DEPS-01, DEPS-02, D-01-05
- [ ] `tests/architecture/<cross-reader>.test.ts` — D-01-12. Must live under `tests/architecture/` — only `architecture`, `e2e`, and `integration` are exempt from the corresponding-test pairing gate
- [ ] Manifest-planting fixture capability — no shared `tests/helpers/` directory exists; `withHermeticHome` is a per-file local helper with three different signatures, and `tests/edge/handlers/marketplace-seed.ts` cannot write a plugin-side `plugin.json` at all (only empty files via `componentFiles`). Either an inline `writeFile` in the new test or a `pluginManifests` option on `materializeMarketplaceTree`
- [ ] Framework install: none needed

---

## Manual-Only Verifications

All phase behaviors have automated verification. The two in-the-wild witness plugins (`ui5`, `ui-theme-designer`) are asserted through fixtures reproducing their declared shapes, not by fetching them.

---

## Security Domain (ASVS)

Applicable categories: **V5 Input Validation** (untrusted third-party manifest content) and **V12 File / Resource** (path containment).

- `PLUGIN_MANIFEST_VALIDATOR` and `assertPathInside` are reused unchanged; `assertPathInside` stays the single NFR-10 chokepoint and runs BEFORE normalization.
- D-01-14 **strengthens** the path posture: the stored value becomes the output of `path.relative(root, contained)`, which cannot begin with `..` once containment passed, replacing an arbitrary author spelling that three bridges re-join.
- The malformed-manifest exposure widens by exactly one additional candidate file — a sibling of a file already parsed from the same untrusted tree. No new class.
- Pre-existing and unchanged: the TOCTOU note at `shared/path-safety.ts:71-75` (threat model is "careless or malicious plugin author", not "concurrent in-process attacker").

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
