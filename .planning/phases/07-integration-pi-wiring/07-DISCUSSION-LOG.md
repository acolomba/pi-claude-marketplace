# Phase 7: Integration & Pi Wiring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 7-Integration & Pi Wiring
**Areas discussed:** Live e2e suite architecture, platform/pi-api.ts wrapper, resources_discover wiring, Multi-process concurrency test

---

## Live e2e suite architecture

### Q1: Test tree layout + PR/nightly split

| Option | Description | Selected |
|--------|-------------|----------|
| New tests/e2e/ + dual workflows | New tests/e2e/ glob excluded from `npm test`. Two workflow files: ci.yml (always-on) + new e2e-nightly.yml (cron + workflow_dispatch). | ✓ |
| Extend tests/integration/ + env-gated | Fold e2e under tests/integration/ with `PI_CM_E2E_REF` env var. Single workflow with matrix. | |
| tests/e2e/ + single workflow + matrix | New dir but single workflow with `if:` gates per cell. | |

**Initial Claude question:** "what is idiomatic in typescript projects?" → Reflected back the playwright / tRPC / next.js convention.

**User's choice:** Lock the idiomatic layout (option 1).
**Notes:** Followed up with secondary confirmation: PR runs pinned-SHA, nightly runs floating-main. Idiomatic patterns surveyed: tests/e2e/ + two workflows + pinned SHA constant in code + anonymous GitHub by default with GITHUB_TOKEN fallback.

---

### Q2: Target plugin selection + soft-dep matrix

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-pick by component coverage + 4 soft-dep cells | 3 plugins by hand to cover all 4 component kinds; 2x2 soft-dep matrix on the multi-component one. | |
| Auto-select first 3 installable + 1 soft-dep matrix | Walk upstream manifest, take first 3 installable. Coverage drifts with upstream. | |
| Hand-pick 5+ plugins with full 2x2 soft-dep on each | Heaviest; ~20+ CI cells. | |
| **Free-text (chosen)** | "hand-pick by coverage, and ideally one construct per plugin if possible, e.g. one with commands, one with skills, one with agents, one with mcp; ok to test combos too, but isolation is preferred" | ✓ |

**User's choice:** Hand-pick 4 plugins isolated by component kind (1 skills-only, 1 commands-only, 1 agents-only, 1 mcp-only). Combos secondary. 2x2 soft-dep matrix against agents-only and mcp-only plugins (since soft-deps only matter for those kinds).
**Notes:** Caveat flagged for planner: if upstream `anthropics/claude-plugins-official` doesn't have plugins isolated to one kind, fall back to minimal-overlap selection and document deviation.

---

### Q3: Failure classification (upstream-change vs regression)

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot pinned manifests + diff on nightly | tests/e2e/_fixtures/<sha>/ snapshots; nightly diffs against snapshot. Non-empty diff + fail = upstream change (warning); empty diff + fail = regression (red). | ✓ |
| Tag-based bucketing in test names | Test labels classify. Less structural. | |
| No automated classifier -- manual triage | Nightly red opens a GitHub issue tagged e2e-nightly; human reads diff. | |

**User's choice:** Snapshot pinned manifests + diff on nightly.
**Notes:** Pinned-SHA PR runs always must pass.

---

### Q4: How to drive the extension

| Option | Description | Selected |
|--------|-------------|----------|
| Simulate /reload via post-install discovery call | After install, test directly invokes the resources_discover handler. | |
| Spawn real Pi process via child_process | Each test spawns `pi --extension ...`, drives via stdin, asserts on stdout. | |
| Skip /reload simulation V1 | Manual-smoke checklist only. | |
| **Clarified to two-layer (chosen)** | User clarified: "i'm good with most e2e tests go right at index.ts to validate the entire surface, but i also want to see tests that test the basics going through pi itself (even if only one command is registered), and ideally some tests would be able to exercise the plugins somehow" -- then later: "remember, we don't need to test via the TUI necessarily, https://github.com/earendil-works/pi/tree/main/packages/agent can be enough" | ✓ |

**User's choice:** TWO-LAYER e2e: (A) bulk imports index.ts and drives registered handlers with a mock ExtensionAPI; (B) Pi-runtime smoke layer uses `@earendil-works/pi-agent-core` programmatically (NOT subprocess `pi`) with isolated Pi settings root.

**Notes:**
- Initially proposed subprocess `pi <command>`; user corrected to pi-agent-core programmatic approach.
- ~8 smoke tests via agent-core, one per command group (install/uninstall/update/list/marketplace {add,remove,list,update,autoupdate}).
- Plugin verification: assert resources_discover returns staged paths + assert Pi-surface presence (skill/prompt/agent enumeration via agent-core). Does NOT invoke installed skill/command bodies.
- Research flag: agent-core must support extension loading + isolated settings + programmatic dispatch; fall back to subprocess `pi` with HOME override if any missing.

---

## platform/pi-api.ts wrapper

### Q1: What shape should pi-api.ts be?

| Option | Description | Selected |
|--------|-------------|----------|
| Thin typed re-export + soft-dep helpers | Typed re-exports of ExtensionAPI etc + softDepStatus helpers moved here. Light scope. | ✓ |
| Full adapter class around the Pi API | Wrap every pi.* call in a class/interface; orchestrators consume PiApi. Heavy refactor. | |
| Skip the file entirely -- amend ROADMAP | Drop SC #1's wrapper requirement. | |

**User's choice:** Thin typed re-export + soft-dep helpers.

---

### Q2: Migration of presentation/soft-dep.ts

| Option | Description | Selected |
|--------|-------------|----------|
| Move + add deprecated re-export shim | Move softDepStatus etc to platform/pi-api.ts. Keep presentation/soft-dep.ts as one-line re-export. | ✓ |
| Move + update every callsite | Move and update every import. Cleaner end state; one larger commit. | |
| Re-export only, keep originals in presentation/ | Awkward direction. | |

**User's choice:** Move + add deprecated re-export shim.

---

### Q3: Tighten the import boundary?

**Initial Claude question:** Asked the tighten-vs-permissive question. User responded with sub-question: "what are the advantages of going through pi-api.ts?"

**Claude's response (summary):** Single peer-dep upgrade point; grep-able surface; type-narrowing point; mock seam for tests; future multi-version compat shim. Honest counterweight: TypeScript already surfaces breakage at every callsite; mild DX friction; ~12 import edits.

**Refined question + options:**

| Option | Description | Selected |
|--------|-------------|----------|
| Tighten: only platform/pi-api.ts imports the peer dep | ESLint no-restricted-imports forbids the peer-dep imports outside platform/pi-api.ts. ~12-file migration. | ✓ |
| Tighten ONLY type imports | Allow `import type` from peer dep anywhere; runtime imports through pi-api.ts. | |
| Keep permissive | Just add the wrapper; other layers can still import directly. | |

**User's choice:** Tighten: only platform/pi-api.ts imports the peer dep.
**Notes:** Codebase scan confirmed every existing peer-dep import is `import type` (no runtime imports), so migration is zero-runtime-cost.

---

### Q4: V1 surface shape

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal surface that's actually used | Re-export ExtensionAPI, ExtensionContext, ExtensionCommandContext, Tool, AutocompleteItem, resources_discover event types + softDepStatus helpers. ~7-10 exports. | ✓ |
| Wide surface: re-export everything in types.d.ts | Future-proof but verbose; some exports never get consumed. | |
| Minimal surface + getAllTools probe wrapper | Like Recommended plus a typed helper. | |

**User's choice:** Minimal surface (YAGNI for unused).

---

## resources_discover wiring

### Q1: Where should the aggregator live?

| Option | Description | Selected |
|--------|-------------|----------|
| New orchestrators/discover.ts | Pure function of locations resolvers. Tests under tests/orchestrators/discover.test.ts. | ✓ |
| Inline in index.ts | Implement directly in the pi.on callback. Harder to test. | |
| edge/discover.ts | Put under edge/. Conflicts with edge/ → persistence/ import boundary. | |

**User's choice:** New orchestrators/discover.ts.

---

### Q2: Path source (state.json vs disk walk)

| Option | Description | Selected |
|--------|-------------|----------|
| Walk on-disk resources dirs | Source-of-truth is disk; reflects reality even if state.json drifts. | ✓ |
| Read state.json + resolve paths | Faster; trusts state.json over reality. | |
| Disk walk + cross-reference state.json | Strictly correct but adds complexity. | |

**User's choice:** Walk on-disk resources dirs.

---

### Q3: Error semantics

| Option | Description | Selected |
|--------|-------------|----------|
| ENOENT = empty; everything else = aggregated throw | Missing dir treated as empty; other fs errors per scope collected; throw AggregateResourcesDiscoverError. | ✓ |
| Any per-scope error aggregates (strict) | ENOENT counts as a failure too. Noisy. | |
| Silently drop ALL per-scope errors | Errors logged via notify.warning; never throws. Loses SK-5 contract. | |

**User's choice:** ENOENT = empty; everything else = aggregated throw.

---

### Q4: cwd capture timing

| Option | Description | Selected |
|--------|-------------|----------|
| Capture cwd inside the event handler | Each invocation reads process.cwd() at that moment. Reflects user cd between /reloads. | ✓ |
| Capture cwd at session_start | Lock at session start. Predictable but surprising. | |
| Capture cwd at registration time (once) | Worst of both. | |

**User's choice:** Capture cwd inside the event handler.

---

## Multi-process concurrency test

### Q1: Concurrency level needed?

**Initial Claude question:** real child processes vs worker_threads vs in-process Promise.all.

**User's response:** "do we really need this concurrency test?"

**Claude's response (summary):** Honest tradeoff laid out. Belt-and-suspenders, not load-bearing, but cheap insurance against a withStateGuard OCC regression. ONE test if any.

**Refined question:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, one test via child_process.fork | Single test asserting one wins, other rolls back. ~1-2s cost. | |
| Drop SC #3 -- amend ROADMAP | Mark SC #3 deferred to v2. | |
| Yes, but in worker_threads instead of fork | Cheaper startup. Shared FD table is technically not real multi-process. | |
| **Free-text follow-up (chosen path)** | "is the current process safe for concurrence? i understand there's a rename, but is it the only operation? i'm ok with a last-writer wins, as long as there's not more than one operation that can lead to intermediate corrupt states" → triggered investigation | ✓ |

**Claude's investigation:** Read with-state-guard.ts (intra-process only; no re-load-and-diff). Read install.ts (PI-15 check is against once-loaded snapshot). Concluded:
- File-level corruption: never (atomic writes everywhere) ✅
- state.json validity: always ✅
- State-vs-disk consistency: NOT guaranteed under multi-process -- different-plugin same-marketplace race can leave orphan resources

**User's response (after seeing the honest assessment):** "Drop the concurrency test entirely" → then immediately followed by: "i changed my mind. let's make this concurrency-safe and test it"

**Final outcome:** Add cross-process safety via file lock + ship the multi-process test. Areas Q2-Q5 below capture the implementation choices.

---

### Q2: Concurrency-control mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| File lock via proper-lockfile@^4 | Standard battle-tested. npm CLI uses it. Auto-handles stale locks via heartbeat. Closes TOCTOU window completely. | ✓ |
| Optimistic re-load + diff at save | No new dep. Small TOCTOU window remains. | |
| Monotonic version field + atomic CAS | Schema migration to state.json schemaVersion 2. | |
| File lock + version field (belt-and-suspenders) | Both. Heaviest. | |

**User's choice:** File lock via proper-lockfile@^4.

---

### Q3: Lock behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Fail-fast with retry hint | Don't wait. Throw immediately with retry hint. proper-lockfile retries: 0. | ✓ |
| Wait with timeout (e.g. 5s) | Brief delay then success or timeout error. | |
| Wait indefinitely | Worst UX. | |

**User's choice:** Fail-fast with retry hint.

---

### Q4: Error contract

| Option | Description | Selected |
|--------|-------------|----------|
| New marker string + supersede PI-15's contract | STATE_LOCK_HELD_PREFIX in markers.ts. PI-15 superseded for V1. D-21/D-23/D-24 supersession pattern. | ✓ |
| Keep PI-15 string + use it for lock-hold too | Same error message regardless of HOW detected. Message wrong for non-install paths. | |
| Per-operation contextual messages | Lock-held error per verb. Breaks markers-snapshot single-source pattern. | |

**User's choice:** New marker string + supersede PI-15.

---

### Q5: Lock scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-scope lock | Lockfile at `<scopeRoot>/pi-claude-marketplace/.state-lock`. User and project scope locks independent. | ✓ |
| Single global lock | One lockfile at ~/.pi/agent/. Over-restrictive. | |
| Per-marketplace lock | Finer-grained but more complex. | |

**User's choice:** Per-scope lock.

---

## Claude's Discretion

- D-01 SHA refresh policy (Dependabot-style vs manual PR vs scheduled bump) -- planning picks; default manual PR
- D-01 tmpdir isolation, GITHUB_TOKEN handling, retry/timeout posture -- planning picks per idiomatic conventions
- D-04 ESLint rule exact pattern + exception list -- planning picks; default exempts `platform/pi-api.ts` + `tests/**/*` + `index.ts`
- D-06 `proper-lockfile` config details (heartbeat, stale timeout) -- planning picks per library defaults
- D-09 read-only operations don't need the lock -- confirmed; planner adds a no-deadlock test
- D-10 aggregator dedup semantics -- no dedup at aggregator layer; consumer (Pi) decides precedence
- D-13 callback shape (async arrow vs explicit Promise chain) -- equivalent; idiomatic choice
- NFR-8 architecture test exact assertion -- planning picks AST walk vs grep-based check

## Deferred Ideas

- Manifest mtime cache implementation (NFR-8 / PERF-01) -- Phase 7 lands the seam only; cache impl is post-V1
- `@earendil-works/pi-agent-core` deeper integration beyond ~8 smoke tests
- Subprocess `pi <command>` driver (fallback only if agent-core insufficient)
- Full surface via Pi binary (over-invests)
- Invoking installed skill/command bodies in e2e (post-V1; brittle)
- Dependabot-style SHA refresh automation
- GitHub Actions concurrency-group on e2e workflows
- Lock-held graceful retry/queue mode (`--wait` flag)
- Per-marketplace lock granularity (current per-scope sufficient)
- Cross-process OCC in `withStateGuard` IN ADDITION to the lock (belt-and-suspenders; no race remains)
- Pluggable Pi-API compat shim for multiple peer-dep versions (V2 concern)
- Multi-version Node CI matrix (Phase 1 D-01 locked to Node 24)
- Telemetry on lock contention rates (IL-4 forbids V1)
- e2e GitHub Actions cost budget enforcement

## Process Notes

- User changed their mind once on the concurrency-test question (drop → keep + fix), driven by an honest review of the actual `withStateGuard` implementation. Net result: stronger safety guarantee than the original ROADMAP SC #3 (the lock prevents the race entirely vs. detecting it at commit).
- User redirected away from subprocess-based test driving once and again, toward programmatic API access (`pi-agent-core`). Memory entry created: `feedback_test_drivers.md` -- prefer programmatic API over subprocess for test drivers.
- BACKLOG.md created during the discussion to capture deferred ideas surfaced (manifest cache, pi-agent-core deeper integration).
