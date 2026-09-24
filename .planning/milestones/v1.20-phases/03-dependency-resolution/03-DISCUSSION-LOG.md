# Phase 3: Dependency resolution - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-14
**Phase:** 3-Dependency resolution
**Areas discussed:** Version-constraint grammar, Cascade persistence across /reload, Partial-cascade failure handling, Auto-adding an unadded marketplace

---

## Version-constraint grammar

| Option | Description | Selected |
|--------|-------------|----------|
| Add semver as a direct dependency | Already resolved transitively via the Pi peer; makes it our own declared contract | ✓ |
| Document + implement a subset ourselves | No new dependency, but diverges from D-01-33's already-accepted declared-text grammar | |

**User's choice:** Add semver as a direct dependency.

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt comparison semantics only | semver + cross-manifest intersection, but check against the already-resolvable version — no live tag-hunting | |
| Full parity: replicate git-tag range resolution | Matches upstream's ls-remote --tags + <name>--v<range> tag lookup + re-pin exactly | ✓ |

**User's choice:** Full parity — replicate git-tag range resolution, against the presented recommendation.
**Notes:** Verified against the installed Claude Code 2.1.251 binary before presenting options — upstream genuinely does `git ls-remote --tags`, semver-intersects across declaring manifests, and re-pins to a matching `<name>--v<range>` tag. Operator chose to match this fully, accepting the substantial new-machinery cost over the cheaper comparison-only alternative.

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit NFR-5 amendment | Record a new documented carve-out, mirroring url-source's precedent | ✓ |
| Scope tag-lookup to cache-miss only | Narrower exception, diverges from upstream's always-check behavior | |

**User's choice:** Explicit NFR-5 amendment.

| Option | Description | Selected |
|--------|-------------|----------|
| Fail closed, no coerce | Hash/sha candidates never go through semver.coerce | |
| Run it through semver.coerce anyway | Matches upstream's exact fallback chain, accepts spurious-match risk | ✓ |

**User's choice:** Run it through semver.coerce anyway, against the presented recommendation.
**Notes:** Deliberate full-parity choice, including for a case (content-hash versions) that has no upstream equivalent.

---

## Cascade persistence across /reload

**User's choice (scope):** A cascade-installed dependency lands in the same scope as the plugin that requires it — not a separately chosen scope. (Volunteered directly, not picked from a presented option list.)

| Option | Description | Selected |
|--------|-------------|----------|
| claude-plugins.local.json | Gitignored overlay, npm-lockfile mental model | |
| claude-plugins.json (base, committed) | Same file the parent's entry lives in, via existing write-back machinery | |

**User's choice:** Neither as stated — "whichever the plugin that requires the dependency is [declared in]." Resolved as: mirror the parent's own file, transitively down the chain.
**Notes:** The user answered the underlying question (avoid a fixed file assignment) rather than picking a side of the binary framing I presented — recorded as its own rule in CONTEXT.md (D-03-06) rather than forcing it into one of the two options.

---

## Partial-cascade failure handling

| Option | Description | Selected |
|--------|-------------|----------|
| All-or-nothing rollback | Matches this project's existing atomic-materialization ethos | ✓ |
| Best-effort, per-entry outcomes | Mirrors orchestrators/import/'s existing cascade pattern | |

**User's choice:** All-or-nothing rollback.
**Notes:** Rollback scope confirmed as this run's own new materializations only — an already-installed dependency predating the run is never touched (RESV-05).

---

## Auto-adding an unadded marketplace

| Option | Description | Selected |
|--------|-------------|----------|
| Fail the dependency, don't auto-add | No marketplace is cloned without an explicit user action elsewhere | |
| Auto-add the marketplace | Transparent cascade clone, bigger trust/network surface | ✓ (initial) |

**User's choice (initial):** Auto-add the marketplace, against the presented recommendation.

Verified against the 2.1.251 binary after the initial pick: upstream warns
and skips ("...not found in any known marketplace; not auto-installing")
rather than auto-adding. Re-asked with the verified fact in hand.

| Option | Description | Selected |
|--------|-------------|----------|
| Match upstream: fail closed, don't auto-add | Reverse the earlier pick now that upstream is confirmed to not auto-add either | ✓ |
| Still auto-add, deliberately diverge from upstream | Keep the earlier choice as a recorded, deliberate divergence | |

**User's choice (final):** Match upstream — fail closed, don't auto-add.
**Notes:** Under this project's own D-03-07 (all-or-nothing), an unknown-marketplace dependency triggers the same whole-cascade rollback as any other failure reason — a deliberate, recorded divergence from upstream's own softer warn-and-continue for this specific case.

---

## Claude's Discretion

- Placement/naming of the new git-tag-listing capability in `platform/git.ts`.
- Whether cross-manifest range intersection is a new module or lives beside `domain/dependencies.ts`.
- Exact reason-token wording for the new failure reasons, following the existing closed-set `REASONS` pattern.
- Depth/format of cycle-detection reporting (RESV-04) — a visited-set walk, no new library.
- Exact shape of the guard-free multi-plugin lock composition under `withLockedStateTransaction`.

## Deferred Ideas

None — discussion stayed within phase scope.
