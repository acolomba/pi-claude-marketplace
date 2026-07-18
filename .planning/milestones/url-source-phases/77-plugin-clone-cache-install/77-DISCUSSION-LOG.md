# Phase 77: Plugin clone cache + install - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-11
**Phase:** 77-plugin-clone-cache-install
**Areas discussed:** Version format (PURL-09), Cache location & key (PURL-02/04), Unpinned install policy (PURL-09), github-object routing (PURL-01)

---

## Version format (PURL-09)

| Option | Description | Selected |
|--------|-------------|----------|
| sha-<12hex> | 12-hex truncation of the resolved commit, prefixed `sha-`; parallels PI-7 `hash-<12hex>`, names provenance, compact in list rows | ✓ |
| Full 40-hex sha | Raw commit sha verbatim; precise but long and breaks the prefixed-version family style | |
| Short 12-hex unprefixed | Compact but visually indistinguishable from a truncated content hash | |

**User's choice:** sha-<12hex>

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, store full sha | Dedicated state.json field with the full 40-hex resolved sha; truncation-collision-proof Phase 78 change detection and GC refcounting | ✓ |
| No, 12-hex is enough | ~48 bits sufficient at this scale; one field fewer | |

**User's choice:** Yes, store full sha
**Notes:** Version string is a display concern; comparisons in Phase 78 use the full sha.

---

## Cache location & key (PURL-02/04)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-scope cache | `<scopeRoot>/pi-claude-marketplace/plugin-clones/<key>/` — inside NFR-10 containment, same-FS atomic staging, per-scope dedup | ✓ |
| User-global shared cache | Cross-scope dedup but violates project-scope containment; cross-scope GC complexity | |

**User's choice:** Per-scope cache

| Option | Description | Selected |
|--------|-------------|----------|
| sha256(url)-12 + sha-12 | `<12hex-of-url-hash>-<sha12>` — fixed-length, filesystem-safe for any URL, no sanitization spec needed | ✓ |
| Sanitized host-path + sha12 | Human-browsable but needs a sanitization spec with real edge-case risk | |

**User's choice:** sha256(url)-12 + sha-12
**Notes:** Before deciding, user asked what the existing github marketplace convention is. Verified in code: marketplace clones key by the manifest's `name` field (`sources/<name>/`, add.ts:652), not by URL — inapplicable to the plugin cache because PURL-04 requires source-addressed dedup (two differently-named plugins sharing one url+sha share one clone). Plugin github sources have NO current convention (resolver rejects them today, resolver.ts:503).

---

## Unpinned install policy (PURL-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse cached clone | Second unpinned install of the same url reuses the cache — no network warm-cache, offline-friendly; staleness handled by Phase 78 update | ✓ |
| Re-resolve HEAD each install | Fresher pins but network-dependent installs and duplicate monorepo clones | |

**User's choice:** Reuse cached clone
**Notes:** "Install is pin-time, update is refresh-time."

---

## github-object routing (PURL-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Generic cache path, public-only | Reconstruct `https://github.com/owner/repo`, flow through the same plugin-clones cache; private repos fail `authentication required` until Phase 79 | ✓ |
| Existing github clone path with device-flow auth | Private github repos work now but second clone lifecycle, no dedup, Phase 79 must unify | |

**User's choice:** Generic cache path, public-only

---

## Claude's Discretion

- Resolver three-way state / partial-degradation interplay mechanics
- git-subdir escape/missing-subdir failure UX (existing REASONS tokens preferred; new token only via the closed-set amendment process)
- Cold-cache offline install failure classification
- Canonical-URL form for the sha256(url) cache key (recommended: parse-time canonical)
- Ref-but-no-sha entry resolution mechanics

## Deferred Ideas

- Private-repo plugin auth (Phase 79 provider registry)
- Clone GC / update swaps / offline reinstall / list-info guarantees (Phase 78, PURL-05..08)
