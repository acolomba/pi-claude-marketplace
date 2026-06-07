---
phase: 45
slug: manifest-in-memory-cache
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-07
---

# Phase 45 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built-in), Node native TS strip |
| **Config file** | none -- invoked via the `test` npm script glob |
| **Quick run command** | `node --test "tests/domain/manifest-cache.test.ts" "tests/domain/manifest.test.ts"` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~quick: a few seconds · full: ~tens of seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** < 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 45-01-xx | 01 | 0 | CACHE-01 | -- | N reads → 1 loader/parse/validate; hits return by reference | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ W0 | ⬜ pending |
| 45-01-xx | 01 | 0 | CACHE-02 (success→success) | -- | `(mtimeMs,size)` change → reload + new value | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ W0 | ⬜ pending |
| 45-01-xx | 01 | 0 | CACHE-02 + CACHE-05 (failure→success) | -- | prior negative entry discarded on key change; re-attempt succeeds | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ W0 | ⬜ pending |
| 45-01-xx | 01 | 0 | CACHE-05 (negative caching) | T-staleness | repeated bad-file reads re-throw same instance, no re-parse; `.message` == uncached throw | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ W0 | ⬜ pending |
| 45-01-xx | 01 | 0 | CACHE-05/D-02 (stat-fail) | -- | `stat()` failure = pure miss → real loader every read; NOT negative-cached; original `code` preserved | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ W0 | ⬜ pending |
| 45-01-xx | 01 | 0 | CACHE-03 | -- | fresh cache starts empty (first read is a miss); no cache file/sidecar written | unit | `node --test tests/domain/manifest-cache.test.ts` | ❌ W0 | ⬜ pending |
| 45-02-xx | 02 | 1 | CACHE-06 | T-tamper | `loadMarketplaceManifest` stays sole `readFile(...marketplace.json)`; single-seam gate green | architecture | `node --test tests/architecture/manifest-read-seam.test.ts` | ✅ | ⬜ pending |
| 45-02-xx | 02 | 1 | CACHE-04 | -- | byte-identical user-visible output across the catalog | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ | ⬜ pending |
| 45-02-xx | 02 | 1 | CACHE-04 (full gate) | -- | typecheck + lint + format + all tests green | gate | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Task IDs are placeholders -- the planner assigns final IDs; the requirement→test mapping is the binding contract.*

---

## Wave 0 Requirements

- [ ] `tests/domain/manifest-cache.test.ts` -- new file covering CACHE-01, CACHE-02 (both arms), CACHE-05, CACHE-03, and the D-02 stat-fail path, using an **injected counting loader** + `mkdtemp`/`writeFile` harness mirrored from `tests/domain/manifest.test.ts`.
- [ ] No new conftest/fixtures needed (tmpdir+writeFile pattern is inline).
- [ ] No framework install -- `node:test` is built-in.

*`tests/architecture/manifest-read-seam.test.ts` and `tests/architecture/catalog-uat.test.ts` already exist and must stay green -- no new work beyond keeping them passing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| -- | -- | -- | -- |

*All phase behaviors have automated verification.*

---

## Test Landmines (carry into VERIFICATION)

- **mtime resolution:** Do NOT rewrite the same byte length and expect an mtime change -- flaky across filesystems. Drive CACHE-02 off a **size** change (add/remove a plugin entry or pad a field). Same-tick same-size collision is an accepted residual risk (Non-Goal: no content hashing).
- **`readFile` is unmockable:** `t.mock.method` on the `node:fs/promises` `readFile` named export throws `Cannot redefine property` (ESM namespace non-configurable). Use the injected loader, never "mock readFile".
- **Singleton leakage:** unit tests must construct a **fresh** `createManifestCache(...)` instance, not route through the module singleton.
- **Concurrent same-path load:** keep CACHE-01 sequential (`await` each read), not `Promise.all` (no in-flight de-dup by design, D-04).

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/domain/manifest-cache.test.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
