# Phase 3: Dependency resolution - Research

**Researched:** 2026-09-14
**Domain:** Transitive plugin dependency resolution — semver range intersection, live git-tag range resolution, multi-plugin atomic cascade under one state lock
**Confidence:** HIGH (upstream algorithm extracted verbatim from the installed binary; every integration point read from source this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-03-01:** Add `semver` as a direct dependency (already resolved transitively at `7.8.0` via the `@earendil-works/pi-coding-agent` peer, so no new download — this makes it OUR OWN declared contract rather than an incidental resolution of someone else's). Upstream itself bundles the real `semver` package (`semver.validRange`, `semver.satisfies`, `semver.valid`, `semver.coerce` all appear verbatim in the compiled binary) — this is a verified parity fact, not a guess. Phase 1's D-01-33 already accepts the full semver-ish charset (`^`, `~`, comparisons, `||`, x-ranges) as valid DECLARED text for parsing/rendering; without a real evaluator, a value that parses and renders fine in `info` could never actually be resolved against in this phase — `semver` closes that display/resolve gap. — **Reversibility:** costly — every downstream constraint-evaluation call site would need to change evaluator.

- **D-03-02 (full upstream parity, operator's explicit choice over the scoped-down recommendation):** Replicate upstream's full mechanism, not just its comparison primitive:
  1. **Cross-manifest range intersection** (matches Phase 1's D-01-31 note): every declaring plugin's range for the same dependency name accumulates into an array; the effective constraint is the INTERSECTION, computed as a combinatorial cross-product of each range's `semver`-OR-branches joined with AND (space-separated conjuncts), with a size guard that fails closed as `"too-complex"` past a threshold rather than hanging on a pathological input. An empty accumulator intersects to the wildcard `*` (no constraint).
  2. **Git-tag range resolution for a not-yet-installed constrained dependency:** when the intersected range is not `*`, do NOT just check whatever this project's resolver already produces for that plugin. Query the dependency's marketplace-entry SOURCE repo's tags over the network (`git ls-remote --tags` equivalent — upstream shells to a real `git ls-remote --tags -- <url>`), looking for a tag named `<pluginName>--v<semver>`, and re-pin the install to whichever matching tag satisfies the range. No matching tag → the dependency fails as `"no-matching-tag"`, naming the constraint (RESV-03's own wording).
  3. **Already-installed dependency check** (RESV-05's "left alone" case still needs a conflict check): the RECORDED version is checked via `semver.valid(v) ?? semver.coerce(v)?.version` then `semver.satisfies(...)` against the intersected range; an unsatisfied already-installed dependency reports `"range-conflict"` with `why: "installed-unsatisfied"`.

  This is substantially more machinery than "map onto existing cascade primitives" — it is a genuinely new capability (live tag enumeration on a source repo, re-pinning to an alternate tag, a "many tags per plugin, pick one" concept this project's git-source model does not have anywhere else: everywhere else, one marketplace entry maps to one pinned ref). The operator chose it deliberately after the scoped-down alternative (comparison-only, no tag-hunting) was presented and explained as the lower-cost path. Plan and research for this phase accordingly — this is the single largest piece of new surface RESV-03 introduces. — **Reversibility:** one-way.

- **D-03-03 (NFR-5 amendment, forced by D-03-02):** Record a new NFR-5 carve-out in `PROJECT.md` Constraints, mirroring how `url-source` amended NFR-5 for cache-miss git-source installs: a CONSTRAINED dependency resolution may query its source repo's tags over the network even when a cached/resolvable version of that dependency already exists — because the constraint may demand a DIFFERENT tag than what's cached. This must land as an explicit, visible constraint amendment, not an incidental side effect discovered later by the no-orchestrator-network architecture test or a future reader of NFR-5.

- **D-03-04 (deliberate risk acceptance):** A candidate plugin with no real semver version — this project's PI-7 content-hash (`hash-<12hex>`) or git-sha (`sha-<12hex>`) fallback, which has no upstream equivalent — is run through the SAME `semver.valid ?? semver.coerce` fallback chain as any other candidate, matching upstream's exact mechanism (D-03-02.3) rather than special-casing it. The operator accepted the documented risk this carries: `semver.coerce()` on a hex string can extract a misleading digit sequence and produce a spurious "version" that unpredictably satisfies or fails a range. Do not add a hash/sha guard that upstream does not have — full parity means this edge case too.

- **D-03-05:** A cascade-installed dependency lands in the SAME SCOPE as the plugin that declared it (the requesting/parent plugin's own install target scope) — never a separately chosen scope. `install foo --scope project` cascades its dependencies into project scope; it never silently writes into user scope.

- **D-03-06:** Within that scope, a dependency's config entry goes into WHICHEVER FILE the requesting plugin's own entry is declared in — base `claude-plugins.json` or the local `.local.json` overlay — mirroring the parent exactly, via the existing config-write-back machinery (`persistence/config-write-back.ts::writePluginConfigEntry`, whatever target-selection helper the parent's own explicit-install path already uses). This is transitive by construction: a dependency-of-a-dependency mirrors its immediate parent, which recursively traces back to wherever the ORIGINAL explicit install landed — no special-casing needed for multi-level chains, and no conflict is possible within one cascade run (RESV-05 means an already-installed dependency is never re-written or moved between files; only a dependency's FIRST install picks a file, and it has exactly one parent at that moment).

- **D-03-07:** All-or-nothing rollback. If `foo` depends on `bar` and `baz`, and `bar` installs successfully but `baz` fails, `bar` is uninstalled too and `install foo` fails cleanly reporting `baz`'s failure and reason. Matches this project's existing atomic-materialization ethos (NFR-1/NFR-3, the phase-ledger rollback discipline everywhere else) over the `orchestrators/import/`-style best-effort per-entry-outcome pattern the ROADMAP names as available machinery — the operator chose atomicity over reusing that specific pattern. Retry-safe: re-running `install foo` after a failure starts from a clean slate. **Rollback scope is this cascade run's OWN new materializations only.** An already-installed `bar` that PREDATES this run (RESV-05) is never touched by rollback — only what this specific `install foo` invocation itself newly installed gets unwound on failure.

- **D-03-08:** A dependency naming a marketplace the user never added FAILS that dependency — it does not trigger an auto-add/auto-clone. This matches upstream's own verified behavior exactly: `"<pluginId> plugin.json declares dependency \"<dep>\" not found in any known marketplace; not auto-installing"` (warn class, dependency lookup against ALREADY-KNOWN marketplaces only — upstream never clones a marketplace to resolve a dependency). Reason names the missing marketplace and hints `marketplace add`. **One deliberate divergence from upstream within this same case:** upstream treats an unknown-marketplace dependency as a soft warn-and-skip that still lets the requesting plugin install degraded. Under this project's own D-03-07 (all-or-nothing), an unknown-marketplace dependency is just one more failure reason among others — it triggers the SAME whole-cascade rollback, not a silent degrade. Record this explicitly so it reads as a decision, not a missed parity case.

### Claude's Discretion

- Exact placement/naming of the new git-tag-listing capability in `platform/git.ts` (the sole `isomorphic-git` import site) — whatever `isomorphic-git` API best matches `git ls-remote --tags` semantics.
- Whether cross-manifest range intersection (D-03-02.1) is a new `domain/`-layer module or lives alongside `domain/dependencies.ts` — so long as it stays network-free pure computation, separate from the network-touching tag-lookup step.
- Exact reason-token wording for `"no-matching-tag"`, `"range-conflict"`/`"installed-unsatisfied"`, `"too-complex"`, and "dependency's marketplace not added" — follow `docs/messaging-style-guide.md` and the existing closed-set `REASONS` pattern rather than inventing new prose per call site.
- How deep a cycle-detection report names the chain (RESV-04) — a visited-set walk during the cascade is sufficient; no dependency-graph library exists in this codebase and none is needed for cycle detection specifically (only the version-constraint work needs `semver`).
- Whether the guard-free ledger body (`runInstallLedgerBody`) is called directly per cascade member under one outer `withLockedStateTransaction`, or a new guard-free "install several plugins under one held lock" wrapper is extracted — `withLockedStateTransaction` is not re-entrant (`proper-lockfile`, `retries: 0`), so SOME guard-free composition is required; the exact shape is a planning-time call.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. (MIGR-01's staleness gate remains Phase 4's dependency per Phase 1's context; not re-opened here.)

Also out of scope per CONTEXT.md `<domain>`: install provenance / the `origin: explicit | dependency` distinction (Phase 4), `--prune` (Phase 5), MIGR-01's staleness gate.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESV-01 | Installing a plugin also installs the plugins it declares as dependencies | §Pattern 1 (closure walk), §Pattern 3 (cascade ledger), §Pattern 5 (config write-back closes the `/reload` clause) |
| RESV-02 | A dependency that names a marketplace resolves from that marketplace; one that names none resolves from the depending plugin's marketplace | §Pattern 1 — upstream's `Jm(dep, declaringPlugin)` fill-in, applied to `domain/dependencies.ts`'s `DeclaredDependency.marketplace?` |
| RESV-03 | A dependency whose version constraint no available plugin satisfies fails the install with a reason naming the constraint | §Pattern 2 (range intersection), §Pattern 4 (git-tag resolution), §Code Examples |
| RESV-04 | A dependency cycle terminates instead of installing forever | §Pattern 1 — the **two-set** walk (path stack + visited memo); §Pitfall 1 |
| RESV-05 | A dependency that is already installed is not reinstalled | §Pattern 1 (early return), §Pattern 2.3 (`installed-unsatisfied` conflict check) |
| RESV-06 | When a dependency cannot be installed, the user learns which dependency failed and why, and the install does not leave a half-materialized plugin behind | §Pattern 3 (outer ledger rollback), §Don't Hand-Roll, §Pitfall 2 |

</phase_requirements>

## Summary

The whole of upstream's dependency-resolution mechanism was extracted verbatim from the installed Claude Code 2.1.251 bundle this session. It is **four separate, small algorithms**, not one big one, and the phase plans much more cleanly once they are kept apart: a pure closure walk that produces a topologically-ordered install list, a pure range-intersection function, a network-touching tag lookup, and a two-line already-installed satisfaction check. Only the third touches the network. The first is where RESV-02, RESV-04 and RESV-05 all live, and it needs no semver at all.

The most consequential correction this research makes to the phase's prior understanding is that **cycle detection is not a visited-set walk** — it is a *two-set* walk. Upstream carries a path stack (`A`, an array) for cycle detection *and* a separate visited memo (`v`, a `Set`) to avoid exponential re-walking on a diamond. CONTEXT.md's "a visited-set walk during the cascade is sufficient" describes only the memo half; a single visited set cannot distinguish "already seen on this path" (a cycle) from "already seen on a sibling path" (a diamond, which is legal), and a naive implementation will report a false cycle on a perfectly valid diamond graph. The correction is small in code and large in behavior.

On the integration side, every seam this phase needs already exists and every one was read from source this session. `platform/git.ts` already imports `isomorphic-git`'s `listServerRefs` (for `resolveRemoteRef`), which accepts a `prefix` parameter — that is the exact `git ls-remote --tags` equivalent, so the new tag-listing wrapper is a near-copy of an existing function rather than new territory. `runInstallLedger` takes the state snapshot as a parameter and acquires no lock, so N calls under one `withLockedStateTransaction` compose without further work. The cascade's all-or-nothing rollback (D-03-07) maps directly onto a second, *outer* `runPhases` ledger with one `Phase` per cascade member — `do` = install that member, `undo` = `cascadeUnstagePlugin` + drop its record. The one real architectural decision left is where the network-touching tag probe lives relative to `tests/architecture/no-orchestrator-network.test.ts`, and that has an exact precedent: `install-clone-probe.ts` is the non-gated leaf that both gated install owners reach git through today.

**Primary recommendation:** Build four small modules, not one cascade module — `domain/dependency-closure.ts` (pure two-set walk), `domain/dependency-range.ts` (pure intersection + satisfaction), `orchestrators/plugin/dependency-tag-probe.ts` (the non-gated network leaf, modelled byte-for-byte on `install-clone-probe.ts`), and `orchestrators/plugin/install-cascade.ts` (the outer `runPhases` ledger). Keep the network in exactly one of them, keep the two pure ones in `domain/`, and drive the whole cascade from inside `install-flow.ts`'s existing single `withLockedStateTransaction`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Parse a `dependencies` array element | `domain/` (`dependencies.ts`, exists) | — | Already delivered by Phase 1; pure, no I/O `[VERIFIED: extensions/pi-claude-marketplace/domain/dependencies.ts:183-207]` |
| Resolve a dependency ref to `plugin@marketplace` (RESV-02) | `domain/` | — | Pure string resolution against the declaring plugin's own marketplace |
| Dependency closure walk + cycle detection (RESV-04) | `domain/` | — | Pure graph walk over an injected lookup function; upstream's own `fze` takes the lookup as a parameter |
| Cross-manifest range intersection (D-03-02.1) | `domain/` | — | Pure `semver` computation; CONTEXT.md explicitly requires it stay network-free |
| Already-installed satisfaction check (D-03-02.3) | `domain/` | — | Two `semver` calls over a recorded string |
| Live git-tag enumeration (D-03-02.2) | `platform/` (`git.ts`) | `orchestrators/plugin/` (new probe leaf) | `platform/git.ts` is the sole `isomorphic-git` import site `[VERIFIED: extensions/pi-claude-marketplace/platform/git.ts:3-4]`; the probe leaf is the NFR-5-legal call site |
| Per-member materialization | `orchestrators/plugin/` (`install-outcome.ts`, exists) | `bridges/` | `runInstallLedger` is the guard-free body already built for this caller class |
| Multi-member atomic rollback (D-03-07) | `transaction/` (`phase-ledger.ts`, exists) | `orchestrators/plugin/` | `runPhases` is the generic all-or-nothing primitive; the cascade is a second instantiation of it |
| Config write-back for cascade members (D-03-05/06) | `persistence/` (`config-write-back.ts`, exists) | `orchestrators/plugin/shared.ts` | `selectDeclaringConfigWriteTarget` already answers "which physical file"; the cascade reuses the parent's ONE selection |
| Reason-token rendering | `shared/` (`notification-types.ts`, `notification-grammar.ts`) | — | Closed-set `REASONS` vocabulary; sole sanctioned output surface |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `semver` | `^7.8.5` | Range validation, intersection, satisfaction, coercion | Upstream Claude Code bundles this exact package and calls `validRange`, `minVersion`, `satisfies`, `valid`, `coerce` `[VERIFIED: ~/.local/share/claude/versions/2.1.251 — binary grep]`. 618,795,170 weekly downloads, repo `github.com/npm/node-semver`, not deprecated, no postinstall `[VERIFIED: npm registry]` |
| `isomorphic-git` | `^1.41.8` (installed `1.41.9`) | `listServerRefs({ prefix: "refs/tags/" })` for tag enumeration | Already a direct dependency and already the tag-capable API; no new dependency `[VERIFIED: package.json dependencies; node_modules/isomorphic-git/index.d.ts:2142-2157]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/semver` | `^7.x` | TypeScript declarations for `semver` | **Required, not optional** — see the pitfall below. Add as a `devDependency` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `semver` | Hand-rolled comparator | Rejected by D-03-01 and by §Don't Hand-Roll; upstream uses the real package, so parity demands it |
| `isomorphic-git.listServerRefs` | Spawning `git ls-remote --tags` | Upstream shells out `[VERIFIED: binary grep — "ls-remote","--tags","--",e]`, but this project has a closed shell-out allow-list of exactly three modules and `platform/git.ts` is not one of them `[VERIFIED: tests/architecture/gate-targets.ts:443-447]`. Use `listServerRefs`. |
| A graph library (`toposort`, `dependency-graph`) | — | Not needed. Upstream's own walk is ~20 lines with a plain `Set` and an array `[VERIFIED: binary grep]`, and post-order accumulation gives the topological order for free |

**Installation:**

```bash
npm install semver
npm install --save-dev @types/semver
```

**Version verification (run this session):**

```
npm view semver version      -> 7.8.5   (dist-tags.latest = 7.8.5)
npm view @types/semver version -> 7.8.0
npm view semver scripts.postinstall -> (empty)
npm view @types/semver scripts.postinstall -> (empty)
```

> **Correction to D-03-01's stated premise — flagged, not re-litigated.** The decision (add `semver` as a direct dependency) is right and stands. Its *rationale* is partly inaccurate and the plan should not repeat the inaccurate half. `npm ls semver` in this tree resolves `semver@7.8.0` **nested under `@earendil-works/pi-coding-agent`**, which is a **peer** dependency (present locally only because it is also a `devDependency`), and the hoisted top-level `node_modules/semver@7.8.5` comes from the **ESLint dev-tooling chain** (`eslint-plugin-import-x`, `eslint-plugin-sonarjs`, `typescript-eslint`) `[VERIFIED: npm ls semver output this session]`. In a consumer's production install of `pi-claude-marketplace`, neither of those chains is guaranteed present. So "no new download" is true for *this* dev tree and false in general — adding `semver` to `dependencies` is a genuine new runtime dependency, which is exactly what makes it the correct call. Plan and CHANGELOG wording should say so.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `semver` | npm | published 2026-06-19 | 618,795,170/wk | github.com/npm/node-semver | OK | Approved |
| `@types/semver` | npm | published 2026-08-02 | 26,249,083/wk | github.com/DefinitelyTyped/DefinitelyTyped | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Both were discovered from an authoritative source — `semver`'s API names appear verbatim in the Claude Code bundle this phase is targeting parity with, and `@types/semver` is the DefinitelyTyped package for it. Both return `OK` from `gsd-tools query package-legitimacy check --ecosystem npm`, neither declares a `postinstall`, and no package name in this phase originated from a web search.

## Architecture Patterns

### System Architecture Diagram

```
  /claude:plugin install foo@mp [--scope S] [--local]
              │
              ▼
  edge/handlers/plugin/install.ts  ── parses flags, resolves scope
              │
              ▼
  orchestrators/plugin/install-flow.ts   ◄── network-free gate target
              │
              │  ONE withLockedStateTransaction(locations)   (proper-lockfile, retries: 0)
              │  ┌──────────────────────────────────────────────────────────────┐
              ▼  │                                                              │
  selectDeclaringConfigWriteTarget({locations, local, key})  ── ONE selection,   │
              │  │   reused by EVERY cascade member (D-03-06 by construction)    │
              ▼  │                                                              │
  ┌────────────────────────────────────────────────────────────┐                │
  │  NEW: install-cascade.ts                                    │               │
  │                                                             │               │
  │  step 1  resolveDependencyClosure()  ── domain/, PURE        │               │
  │          ├─ path stack  → cycle  (RESV-04)                   │               │
  │          ├─ visited memo → diamond dedup                     │               │
  │          ├─ installed?   → skip   (RESV-05)                  │               │
  │          ├─ mp unknown?  → fail   (D-03-08)                  │               │
  │          └─ post-order   → topological install order         │               │
  │                     │                                        │               │
  │  step 2  per member, if constrained:                         │               │
  │          intersectRanges()  ── domain/, PURE (semver)         │               │
  │             │  "*"? ──── skip tag lookup entirely             │               │
  │             └─ non-"*" ──► dependency-tag-probe.ts  ══════════╪═► NETWORK     │
  │                              listRemoteTags(url)              │   (NFR-5      │
  │                              pick tag `<name>--v<semver>`     │    amendment) │
  │                              re-pin member's source ref       │               │
  │                     │                                        │               │
  │  step 3  runPhases([ Phase(dep1), Phase(dep2), … Phase(foo) ])│               │
  │             do:   runInstallLedger(state, …)  ── guard-FREE   │               │
  │             undo: cascadeUnstagePlugin + drop record          │               │
  │                   (this run's OWN members only, D-03-07)      │               │
  └────────────────────────────────────────────────────────────┘                │
              │  │                                                              │
              ▼  │                                                              │
  writeBatchedConfigEntries(current, targetConfigPath, …)  ── ONE saveConfig     │
              │  │   declares EVERY member → buildUninstallBucket never sweeps   │
              ▼  │   them on the next /reload (RESV-01 reload clause)            │
          tx.save()  ── ONE state write                                          │
              │  └──────────────────────────────────────────────────────────────┘
              ▼
  notify()  ── shared/notification-dispatch.ts (sole ctx.ui.notify call site)
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── domain/
│   ├── dependencies.ts              # EXISTS (Phase 1) — element parser
│   ├── dependency-closure.ts        # NEW — two-set walk, cycle + order (RESV-02/04/05)
│   └── dependency-range.ts          # NEW — intersect + satisfies (RESV-03, semver)
├── platform/
│   └── git.ts                       # EXTEND — listRemoteTags() wrapper
└── orchestrators/plugin/
    ├── dependency-tag-probe.ts      # NEW — the NFR-5-legal network leaf
    ├── install-cascade.ts           # NEW — the outer runPhases ledger
    ├── install-flow.ts              # EXTEND — drive the cascade inside its lock
    └── install-cascade.messaging.ts # NEW (likely) — the per-member row builder
```

Each new `extensions/…/X/Y.ts` **requires** a matching `tests/X/Y.test.ts` — see §Pitfall 6.

### Pattern 1: The dependency closure walk (RESV-02, RESV-04, RESV-05, D-03-08)

**What:** A pure depth-first walk that yields a topologically-ordered install list or the first failure. Takes the catalog lookup as a parameter, so it is network-free and trivially testable.

**When to use:** Step 1 of the cascade, before any version work and before any materialization.

**Upstream's implementation, de-minified** `[VERIFIED: ~/.local/share/claude/versions/2.1.251 — grep -oaP 'async function fze\(e,t,r,o=new Set,u\)\{.{0,1100}']`:

```js
// Verbatim minified source, reformatted only by inserting newlines:
async function fze(e, t, r, o = new Set, u) {
  let d = qt(e).marketplace, y = [], v = new Set, A = [];
  async function R(F, U) {
    if (F !== e && r.has(F) && !u?.has(F)) return null;
    let B = qt(F).marketplace;
    if (!r.has(F) && B !== d && !(B && o.has(B)))
      return { ok: !1, reason: "cross-marketplace", dependency: F, requiredBy: U };
    if (A.includes(F)) return { ok: !1, reason: "cycle", chain: [...A, F] };
    if (v.has(F)) return null;
    v.add(F);
    let z = await t(F);
    if (!z) { /* …force-include escape… */ return { ok: !1, reason: "not-found", missing: F, requiredBy: U }; }
    A.push(F);
    for (let V of z.dependencies ?? []) {
      let me = Jm(V, F), fe = await R(me, F);
      if (fe) return fe;
    }
    A.pop(); y.push(F); return null;
  }
  let O = await R(e, e);
  if (O) return O;
  return { ok: !0, closure: y };
}
```

Reading the identifiers:

| Minified | Role | Requirement it serves |
|----------|------|----------------------|
| `e` | root plugin key (`plugin@marketplace`) | — |
| `t` | async catalog lookup `(key) => entry \| undefined` | injected seam — keeps the walk pure |
| `r` | set of already-installed keys | **RESV-05** — first `if` returns `null` (skip) |
| `o` | set of known/added marketplace names | **D-03-08** — `cross-marketplace` when the dep's mp is neither the root's nor known |
| `A` | **path stack** (array) | **RESV-04** — `A.includes(F)` is the cycle test; `chain: [...A, F]` is the reportable chain |
| `v` | **visited memo** (Set) | diamond dedup — *not* the cycle test |
| `y` | post-order accumulator | **install order** — dependencies land before dependents |
| `Jm(V, F)` | resolve dep ref `V` in the context of declaring plugin `F` | **RESV-02** — the marketplace fill-in |

**Three things to carry into the port:**

1. `A` and `v` are **different sets with different jobs**. Drop `v` and a diamond re-walks exponentially; drop `A` and a cycle never terminates; conflate them and a legal diamond is misreported as a cycle. CONTEXT.md's "visited-set walk" phrasing describes `v` only.
2. `A.pop()` runs only on the success path — on a failure the stack is abandoned mid-walk, which is what lets `chain` carry the full path.
3. Order of guards is load-bearing: already-installed → marketplace-known → cycle → memo. An already-installed dependency is skipped *before* its marketplace is checked, which is what makes a previously-installed plugin from a since-removed marketplace not fail the cascade.

**RESV-02's fill-in** maps onto Phase 1's parser output: `DeclaredDependency.marketplace` is optional `[VERIFIED: extensions/pi-claude-marketplace/domain/dependencies.ts:35-40]` — verbatim:

```ts
export interface DeclaredDependency {
  readonly name: string;
  readonly version?: string;
  readonly marketplace?: string;
  readonly sha?: string;
}
```

Absent `marketplace` → the declaring plugin's own marketplace. `orchestrators/plugin/info.ts` already does exactly this for display via a local `withDeclaringMarketplace` helper `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:432-434]`; Phase 3 applies its own resolution semantics to the same parsed shape, per D-01-19/D-01-32.

### Pattern 2: Cross-manifest range intersection (D-03-02.1)

**What:** Fold N declared ranges for one dependency name into one effective range, or fail closed.

**Upstream's implementation** `[VERIFIED: ~/.local/share/claude/versions/2.1.251 — grep -oaP 'function Tct\(.{0,1400}']`, verbatim minified, reformatted:

```js
function Tct(e) {
  if (e.length === 0) return { ok: !0, range: "*" };
  let t = 0; for (let y of e) t += y.length;
  if (t > pze) return Jme(`total input ${t} chars > ${pze}`);
  let r = [];
  for (let y of e) {
    let v = Jy.validRange(y);
    if (v === null) return { ok: !1, reason: "invalid" };
    r.push(v.split("||").map((A) => A.trim()).filter(Boolean));
  }
  let o = r[0] ?? [];
  if (o.length > b3) return Jme(`${o.length} conjuncts after 1/${e.length} inputs > ${b3}`);
  for (let y = 1; y < r.length; y++) {
    let v = r[y] ?? [], A = o.length * v.length;
    if (A > b3) return Jme(`${A} conjuncts after ${y+1}/${e.length} inputs > ${b3}`);
    let R = []; for (let O of o) for (let F of v) R.push(`${O} ${F}`);
    o = R;
  }
  let u = o.filter((y) => { let v = Jy.validRange(y); return v !== null && Jy.minVersion(v) !== null; });
  if (u.length === 0) return { ok: !1, reason: "disjoint" };
  let d = Jy.validRange(u.join(" || "));
  return d === null ? { ok: !1, reason: "disjoint" } : { ok: !0, range: d };
}
```

`Jy` is the bundled `semver`. The two size guards are `[VERIFIED: binary grep — 'pze=4096' and 'var b3=1024']`:

- `pze = 4096` — total input characters across all ranges, checked **before** any parsing.
- `b3 = 1024` — maximum conjunct count, checked **before** each cross-product step *and* after the first input.

`Jme(...)` builds the `too-complex` failure. Three distinct failure reasons come out of this one function: `"invalid"` (a range `semver.validRange` rejects), `"too-complex"` (either size guard), `"disjoint"` (every conjunct is unsatisfiable, or the rejoined union is not a valid range).

**Two subtleties worth naming in the plan:**

- The `minVersion(v) !== null` filter is how upstream detects that a conjunct like `">=2.0.0 <1.0.0"` is unsatisfiable. `semver.validRange` accepts it happily; `minVersion` returns `null`. Using `validRange` alone would let a disjoint intersection through as a "valid" range that then matches nothing, producing `no-matching-tag` instead of the truthful `range-conflict`.
- The conjunct guard is checked **before** computing the product (`A = o.length * v.length` is compared to the cap *before* the loops run), so a pathological input fails without ever allocating the product. Porting this as a post-hoc length check would hang on exactly the input the guard exists for.

### Pattern 3: The outer cascade ledger (D-03-07)

**What:** A second `runPhases` instantiation, one `Phase` per cascade member, giving all-or-nothing rollback across plugins — exactly as `runPhases` already gives all-or-nothing rollback across bridges within one plugin.

**Why this is the right shape:** `runPhases` already does precisely what D-03-07 describes, including the awkward parts. `[VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:154-174]` — on the first throw it runs the failing phase's own `undo` first, then walks `executed` in reverse, and it **never throws on its own**:

```ts
export async function runPhases<C>(phases: readonly Phase<C>[], ctx: C): Promise<RunPhasesResult> {
  const executed: Phase<C>[] = [];
  for (const phase of phases) {
    try {
      await phase.do(ctx);
      executed.push(phase);
    } catch (err) {
      const original = err instanceof Error ? err : new Error(String(err));
      const failingPartial = await invokeFailingPhaseUndo(phase, ctx);
      const reversePartials = await rollbackExecuted(executed, ctx);
      const rollbackPartials: RollbackPartial[] =
        failingPartial === undefined ? reversePartials : [failingPartial, ...reversePartials];
      return { ok: false, error: original, rollbackPartials, leaks: [] };
    }
  }
  return { ok: true, rollbackPartials: [], leaks: [] };
}
```

`executed` is what makes D-03-07's "this cascade run's OWN new materializations only" fall out for free: a dependency that was skipped as already-installed never becomes a `Phase`, so it is never in `executed`, so `undo` never touches it. **No explicit "did this run install it" bookkeeping is needed** — do not build one.

`undo` per member is `cascadeUnstagePlugin(plugin, marketplace, locations, installedPlugin)` `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:307-312]`, which unstages skills → commands → agents → MCP in PU-1 order and is already the primitive both `plugin uninstall` and `marketplace remove` reuse, plus dropping the member's record from the in-memory snapshot.

**The one real tension — name it in the plan, don't let it surface at review.** `phase-ledger.ts`'s header states the literal-array discipline `[VERIFIED: extensions/pi-claude-marketplace/transaction/phase-ledger.ts:5-9]`:

> ```
> // This is a FUNCTION, not a coordinator-class. Orchestrators build a literal
> // `const PHASES: Phase<InstallCtx>[] = [...]` at every call site.
> // Literal-array call sites are the explicit anti-pattern guard against
> // implicit phase ordering -- a coordinator-with-`add()` API would let
> // the order drift across refactors.
> ```

A cascade array is necessarily **derived**, one element per closure member, so it cannot be a literal. The defensible reading: the discipline guards against *implicit* ordering, and the cascade's order is not implicit — it is the closure walk's post-order, which is an explicit, tested contract of Pattern 1. Say that in the module header rather than leaving a reader to reconcile it. Note also that `ARCHITECTURE.md` currently asserts `runPhases` has "exactly ONE production consumer"; that sentence needs updating. **No architecture test enforces the single-consumer claim** — I grepped `tests/architecture/` and `.fallowrc.json` for `runPhases` and found no match, so this is a docs edit, not a gate amendment `[VERIFIED: grep over tests/architecture/ and .fallowrc.json returned no `runPhases` occurrence]`.

### Pattern 4: The NFR-5-legal network leaf (D-03-02.2, D-03-03)

**The constraint.** `install-flow.ts` and `install-outcome.ts` are both members of `NETWORK_FREE_TARGETS` `[VERIFIED: tests/architecture/gate-targets.ts:53-54]`, verbatim:

```ts
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts",
```

and the gate's forbidden surface is five patterns `[VERIFIED: tests/architecture/no-orchestrator-network.test.ts:66-79]` — an import from `platform/git`, a dynamic import of it, and the bare tokens `DEFAULT_GIT_OPS`, `gitOps`, `refreshGitHubClone`. Note `{ name: "gitOps reference", pattern: /\bgitOps\b/ }` is a **bare identifier match**: a seam field named `gitOps` in either owner fails the gate even with no import.

**The precedent, already in the tree.** The same registry entry explains how the install owners legally reach git today `[VERIFIED: tests/architecture/gate-targets.ts:44-52]`, verbatim:

> ```
> // NFR-5 (amended): both install owners carry ZERO git surface of their own. A
> // git-source (url / git-subdir / github) clone is delegated to the
> // install-clone-probe.ts leaf, which reaches the clone-cache.ts sibling seam
> // where the git surface legally lives. The flow composes the leaf and the
> // ledger invokes that injected operation; neither owner names `gitOps`.
> ```

`install-clone-probe.ts` is **not** a member of `NETWORK_FREE_TARGETS`, and `install-outcome.ts` reaches it through an injected, non-`gitOps`-named option `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:444]`: `await (opts.cloneProbe ?? probeInstallClone)({…})`, declared as `readonly cloneProbe?: typeof probeInstallClone;` `[VERIFIED: install-outcome.ts:162]`.

**Recommendation:** copy that shape exactly. A new `orchestrators/plugin/dependency-tag-probe.ts` (not gated), exporting `probeDependencyTags`, injected into the cascade as `readonly tagProbe?: typeof probeDependencyTags`. Nothing named `gitOps`; no `platform/git` import in either gated owner. This requires **no change to `gate-targets.ts` and no new exemption** — which is the cheapest possible reconciliation of D-03-03 with the gate, and the one CONTEXT.md's canonical_refs note anticipated ("a new leaf module outside the forbidden list").

**The `platform/git.ts` wrapper.** `resolveRemoteRef` already calls `listServerRefs` `[VERIFIED: extensions/pi-claude-marketplace/platform/git.ts:229-239]`, and the typedef accepts a `prefix` `[VERIFIED: node_modules/isomorphic-git/index.d.ts:2142-2157]` — verbatim from the `.d.ts`:

```ts
export function listServerRefs({ http, onAuth, onAuthSuccess, onAuthFailure, corsProxy, url, headers, forPush, protocolVersion, prefix, symrefs, peelTags, }: {
    http: HttpClient;
    onAuth?: AuthCallback | undefined;
    onAuthFailure?: AuthFailureCallback | undefined;
    onAuthSuccess?: AuthSuccessCallback | undefined;
    url: string;
    corsProxy?: string | undefined;
    forPush?: boolean | undefined;
    headers?: { [x: string]: string; } | undefined;
    protocolVersion?: 2 | 1 | undefined;
    prefix?: string | undefined;
    symrefs?: boolean | undefined;
    peelTags?: boolean | undefined;
}): Promise<ServerRef[]>;
```

`prefix: "refs/tags/"` is the `--tags` equivalent, and `peelTags: true` gives annotated tags their target commit in `ServerRef.peeled` — the same field `resolveRemoteRef` already prefers `[VERIFIED: platform/git.ts:260]`: `return match.peeled ?? match.oid;`. Model the new function's options interface, conditional-auth spread, and `AuthFailureCallback` cast on `resolveRemoteRef` verbatim; the cast comment at `platform/git.ts:141-149` explains why it is needed under `exactOptionalPropertyTypes`.

### Pattern 5: Cascade config write-back (D-03-05, D-03-06, RESV-01's reload clause)

**The mechanism the reload clause turns on** `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:501-506]`, verbatim:

```ts
    for (const pluginName of Object.keys(mpRecord.plugins)) {
      const key = `${pluginName}@${mpName}`;
      if (!declaredPluginKeys.has(key)) {
        uninstall.push({ scope, plugin: pluginName, marketplace: mpName });
      }
    }
```

Any recorded plugin whose `plugin@marketplace` key is absent from the merged declared config is planned for uninstall on the next `resources_discover`. Declaring every cascade member closes it. **No change to `buildUninstallBucket` is needed** — CONTEXT.md asked this be verified at planning time rather than assumed; it is verified. (Note the line number: CONTEXT.md and ROADMAP quote 352 and 484; the function is at **484** in the current tree.)

**The write target.** `selectDeclaringConfigWriteTarget` returns a discriminated result `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:552-562]` whose `selected` arm carries `targetConfigPath`, `targetIsLocal`, `current`, and `sibling`. `install-flow.ts` already calls it exactly once inside the lock `[VERIFIED: install-flow.ts:685-689]`. D-03-06 then falls out with **no new selection logic at all**: reuse the parent's single `selection` for every member. Do not call the selector per member — a second call would re-read the config and could disagree with the first.

**Use the batched writer, not N single writes.** `writeBatchedConfigEntries` applies N plugin patches in memory and calls `saveConfig` exactly once `[VERIFIED: extensions/pi-claude-marketplace/persistence/config-write-back.ts:180-208]`; its header states the structural guarantee: *"this function contains exactly ONE `await saveConfig(...)` call"* `[VERIFIED: config-write-back.ts:175-178]`. `import` already uses it for exactly this reason. N calls to `writePluginConfigEntry` would be N full-file rewrites and N chances to tear.

### Anti-Patterns to Avoid

- **Calling `installPlugin` (the lock-acquiring entry point) recursively.** `withLockedStateTransaction` uses `proper-lockfile` with `retries: 0` `[VERIFIED: extensions/pi-claude-marketplace/transaction/with-state-guard.ts:158-166]`, verbatim: `return lockfile.lock(locations.extensionRoot, { lockfilePath: locations.stateLockFile, realpath: false, retries: 0, stale: 10_000, update: 2_000, });`. A nested acquire self-deadlocks into `ELOCKED` → `StateLockHeldError`. Use `runInstallLedger`, which is guard-free by contract.
- **A single visited set for cycle detection.** Reports a false cycle on a legal diamond. See §Pitfall 1.
- **A `gitOps`-named field anywhere in `install-flow.ts` or `install-outcome.ts`.** Bare-identifier gate match; no import required to fail.
- **Per-member `selectDeclaringConfigWriteTarget` calls.** Re-reads the config inside the lock and can split members across two physical files, which D-03-06 exists to prevent.
- **Per-member `saveConfig` / `tx.save()`.** `tx.save()` throws if called twice `[VERIFIED: with-state-guard.ts:93-96]`: `if (saved) { throw new Error("LockedStateTransaction.save() called more than once."); }`.
- **Special-casing `hash-`/`sha-` versions in the satisfaction check.** D-03-04 forbids it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Range validation / comparison | A regex comparator, or extending PL-5's string compare | `semver` `validRange`/`satisfies`/`valid`/`coerce`/`minVersion` | Prerelease precedence, x-ranges, `\|\|` unions, build metadata. Upstream uses the real package; parity requires the same semantics |
| Detecting an unsatisfiable intersected range | Comparing endpoints by hand | `semver.minVersion(range) !== null` | `validRange(">=2.0.0 <1.0.0")` succeeds; `minVersion` is what returns `null`. This is the whole `disjoint` detection |
| Multi-plugin all-or-nothing rollback | A try/catch that unwinds a local array | `transaction/phase-ledger.ts::runPhases` | Failing-phase-own-undo-first ordering, reverse walk, `RollbackPartial` aggregation, and the PI-14 `PathContainmentError` re-throw are all already correct and already rendered by the grammar |
| Removing one member's artifacts on rollback | Calling the five bridges' `unstage*` inline | `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin` | PU-1 ordering and the AG-5 foreign-content strict-throw semantics; already the primitive `uninstall` and `marketplace remove` share |
| Tag listing | Spawning `git ls-remote` | `platform/git.ts` wrapper over `listServerRefs({ prefix })` | The shell-out allow-list is closed at three modules and `platform/git.ts` is not one `[VERIFIED: tests/architecture/gate-targets.ts:443-447]` |
| Choosing base vs `.local.json` | An `opts.local ? … : …` ternary | `selectDeclaringConfigWriteTarget` | D-103-13 removed this exact ternary from three call sites; the flag says where to WRITE, not where a declaration LIVES |
| Writing N config entries | A loop over `writePluginConfigEntry` | `writeBatchedConfigEntries` | One atomic `saveConfig` instead of N full-file rewrites |
| Topological ordering | A separate sort pass | The closure walk's post-order accumulator | `y.push(F)` after the child loop *is* the topological order |
| Tracking "did this run install it" for rollback scope | A per-member `wasNewlyInstalled` flag | `runPhases`'s own `executed` array | A skipped member never becomes a `Phase`, so it is structurally unreachable by `undo` |

**Key insight:** every primitive this phase needs already exists in the tree and is already gate-tested. The genuinely new code is four small pure-ish functions (walk, intersect, satisfy, tag-pick) plus one thin `isomorphic-git` wrapper. Effort spent re-deriving the composition primitives is effort not spent on the four functions that carry the actual requirements.

## Runtime State Inventory

Not applicable — this is a feature phase, not a rename/refactor/migration. No existing string is being renamed and no persisted value is being re-keyed. (Phase 4, PROV-01, is the one that touches the persisted record's key set.)

## Common Pitfalls

### Pitfall 1: One set cannot do both jobs (RESV-04)

**What goes wrong:** A `visited: Set` used as the cycle test reports a cycle for the legal diamond `A → B → D`, `A → C → D`: `D` is visited on the `B` branch, so the `C` branch sees it as "already visited" and — if that set is the cycle test — calls it a cycle. Install of a perfectly valid plugin graph fails.

**Why it happens:** CONTEXT.md's Claude's-Discretion note says "a visited-set walk during the cascade is sufficient", which describes upstream's memo (`v`) and omits its path stack (`A`). Both exist in the upstream source and they are checked in sequence: `if (A.includes(F)) return cycle;` then `if (v.has(F)) return null;`.

**How to avoid:** Carry two structures. `path: string[]` — pushed before recursing into children, popped after, and `path.includes(key)` is the *only* cycle test. `visited: Set<string>` — added on first entry, never removed, and a hit is a *success* short-circuit. The reportable chain is `[...path, key]`.

**Warning signs:** A test fixture with a diamond fails while a linear chain passes. Or: an exponential-blowup fixture (`A` depends on `B,C`; both on `D,E`; both on `F,G`; …) hangs — that is `visited` missing.

### Pitfall 2: A partially-materialized dependency survives because rollback ran outside the lock

**What goes wrong:** Member 3 fails; the cascade returns a failure; the caller unwinds members 1 and 2 *after* `withLockedStateTransaction` has already returned. Another process acquires the lock in between and observes half a cascade.

**Why it happens:** `runPhases` never throws — it returns `{ ok: false, … }` `[VERIFIED: phase-ledger.ts:169]`. It is easy to return that result up out of the closure and handle it at the call site, which is outside the lock.

**How to avoid:** The cascade's `runPhases` call and its result handling both live **inside** the single `withLockedStateTransaction` closure, and the failure path returns from inside that closure **without** calling `tx.save()`. `install-flow.ts` already demonstrates the no-save abort discipline for its own precondition misses `[VERIFIED: install-flow.ts:727-731]` — `marketplaceAbsent = true; return;` with the comment *"WR-04: precondition miss -- read-only in effect, NO tx.save()."*

**Warning signs:** A rollback test that passes when run alone but leaves `state.json` mutated. A `tx.save()` reachable on a failure path.

### Pitfall 3: `semver` ships no types

**What goes wrong:** `import semver from "semver"` fails `tsc --noEmit` with TS7016 under this project's `strict` config, and `npm run check` is red before the first line of logic is written.

**Why it happens:** `semver@7.8.5` declares no `types`/`typings` field and ships no `.d.ts` `[VERIFIED: node_modules/semver/package.json — `types` field resolves to NONE; `ls node_modules/semver/*.d.ts node_modules/semver/types` returns "No such file or directory" for both]`.

**How to avoid:** Add `@types/semver` to `devDependencies` in the same commit as `semver`. Prefer the deep submodule imports (`semver/functions/satisfies.js`) only if bundle size matters — it does not here, and the flat `import { satisfies, validRange, … } from "semver"` form is what `@types/semver` types best.

**Warning signs:** TS7016 "Could not find a declaration file for module 'semver'".

### Pitfall 4: Adding a `REASONS` member trips an enumeration-equality gate

**What goes wrong:** A new reason token is added, and `tests/architecture/compat-01-no-expansion.test.ts` fails with a deep-equal mismatch that looks unrelated to the change.

**Why it happens:** The gate pins `REASONS` by full enumeration in declared order, by design `[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts:14-20]` — verbatim: *"`REASONS`, `STATUS_TOKENS`, `PLUGIN_STATUSES`, and `MARKETPLACE_STATUSES` each equal a hand-written literal member list, in the tuple's own declared order. ENUMERATION equality, not a count… Adding, removing, or renaming any member fails here and forces a deliberate amendment."*

The current 44-member vocabulary is `[VERIFIED: extensions/pi-claude-marketplace/shared/notification-types.ts:6-59]`, verbatim: `"up-to-date"`, `"not found"`, `"already installed"`, `"not installed"`, `"not in manifest"`, `"invalid manifest"`, `"no longer installable"`, `"unsupported source"`, `"unsupported component"`, `"unsupported hooks"`, `"lsp"`, `"requires pi-subagents"`, `"requires pi-mcp"`, `"rollback partial"`, `"unreadable"`, `"unparseable"`, `"unreadable manifest"`, `"source mismatch"`, `"plugins remain"`, `"concurrently uninstalled"`, `"concurrently updated"`, `"stale clone"`, `"duplicate name"`, `"lock held"`, `"already autoupdate"`, `"already no autoupdate"`, `"already enabled"`, `"already disabled"`, `"permission denied"`, `"source missing"`, `"network unreachable"`, `"marketplace not added"`, `"marketplace not added to user scope"`, `"marketplace not added to project scope"`, `"orphan rewake"`, `"authentication required"`, `"dangling reference"`, `"malformed mcp"`, `"malformed skill"`, `"malformed command"`, `"installs disabled"`, `"marketplace in user scope"`, `"marketplace in project scope"`, `"workflows"`, `"data kept"`.

**How to avoid:** Plan the vocabulary amendment as an explicit task with its own gate edit and a `docs/output-catalog.md` entry, exactly as `"data kept"` was handled in Phase 2 (it carries an inline comment recording why it exists). Note `"marketplace not added"` **already exists** — D-03-08's failure may not need a new token at all, only a new rendering context. Check the existing set before minting.

### Pitfall 5: The two complexity gates disagree, and the intersection algorithm is the likely casualty

**What goes wrong:** `npm run lint` is green and `npm run fallow` is red on the same function, or vice versa.

**Why it happens:** `sonarjs/cognitive-complexity: 15` (ESLint) and `health.maxCognitive: 15` (fallow) are independently computed by different algorithms, both apply, and `.fallowrc.json` currently carries **zero** `thresholdOverrides` `[CITED: .planning/codebase/CONVENTIONS.md]`. The intersection function has a size guard, a validate loop, a nested cross-product double loop, a filter, and a rejoin — the shape most likely to exceed one ceiling.

**How to avoid:** Extract from the start, as CONTEXT.md's own Established Patterns note advises: `checkTotalSize`, `splitIntoOrBranches`, `crossProduct`, `filterSatisfiable`, `rejoin`. Also `health.maxUnitSize: 60` lines.

**Warning signs:** A single function over ~40 lines with three or more nesting levels.

### Pitfall 6: Every new module needs its mirrored test file, or `npm run check` fails before any test runs

**What goes wrong:** `npm run test:corresponding` fails on a new production module with no paired test.

**Why it happens:** `scripts/check-corresponding-tests.mjs` enforces a strict 1:1 mirror `[VERIFIED: scripts/check-corresponding-tests.mjs:29-32]`, verbatim:

```js
function expectedTestPath(sourcePath) {
  const relativePath = sourcePath.slice(`${productionRoot}/`.length, -3);
  return `${testRoot}/${relativePath}.test.ts`;
}
```

with only `architecture`, `e2e`, `integration`, `scripts` exempt as test roots `[VERIFIED: check-corresponding-tests.mjs:10]`: `const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration", "scripts"]);`. It is a member of the `check` chain, which runs `typecheck && lint && lint:workflows && … && test:corresponding && …` before `npm test` `[VERIFIED: package.json scripts.check]`.

**How to avoid:** One plan = one module = one mirrored test file, matching the project's existing "each executable plan owns one source-test pair" convention. Four new modules ⇒ at minimum four plans.

### Pitfall 7: The tag-glob assumption will miss on nearly every real marketplace

**What goes wrong:** A constrained dependency against a third-party marketplace resolves `no-matching-tag` and the whole cascade rolls back, and it looks like a defect.

**Why it happens:** `<pluginName>--v<semver>` is Anthropic's own release-tooling convention `[VERIFIED: binary grep — Y0t="--v"]`, not a git standard. CONTEXT.md §Specific Ideas already flags this as expected.

**How to avoid — and a parity nuance CONTEXT.md does not capture.** Upstream does **not** hard-fail every no-match. Its two arms are `[VERIFIED: binary grep — the `no-matching-tag` call site]`, verbatim:

```js
let rr = await GBt(Un, ko.entry.name, Tr.range, Yn);
if (rr === null && !xn) return { ok:!1, reason:"no-matching-tag", dep:Cn, range:Tr.range };
if (rr === null) n(`materializeOne(${Cn}): no ${ko.entry.name}--v* tag satisfying ${Tr.range} on marketplace repo; falling through to HEAD copy`);
else if (Ci = rr, xn && typeof ko.entry.source === "string") { … }
```

`xn` is `Ar === null && typeof ko.entry.source === "string"` — the entry's source is a plain string that did not parse as a git source, so the tag query ran against the **marketplace repo** rather than the plugin's own source repo. In that case a no-match **falls through to a HEAD copy** with a debug log. Only when the tag query ran against the plugin's own git source does it hard-fail as `no-matching-tag`. So "full parity" has a fallback arm. Whether to port it is a **planning decision**, and D-03-07's all-or-nothing posture pulls one way while D-03-02's "full upstream parity" pulls the other. Surface it to the operator rather than silently picking. *(Note this is a different case from D-03-08's unknown-marketplace divergence, which CONTEXT.md did already decide.)*

## Code Examples

### Reference: upstream's already-installed satisfaction check (D-03-02.3, D-03-04)

`[VERIFIED: ~/.local/share/claude/versions/2.1.251 — grep -oaP 'function ROt\(.{0,400}']`, verbatim:

```js
function k3(e, t) {
  let r = Jy.valid(e) ?? Jy.coerce(e)?.version;
  return r !== void 0 && Jy.satisfies(r, t);
}
```

Two `semver` calls and a nullish coalesce. This is the entire mechanism CONTEXT.md's D-03-02.3 and D-03-04 describe, and `Jy` is the bundled `semver`. Port shape:

```ts
// Source: verbatim structural port of Claude Code 2.1.251's `k3`.
import { coerce, satisfies, valid } from "semver";

/**
 * D-03-04: a recorded version with no real semver form -- PI-7's `hash-<12hex>`
 * or `sha-<12hex>` -- runs through the same `valid ?? coerce` ladder as any
 * other candidate, matching upstream exactly. `coerce` on a hex string can
 * extract a misleading digit run; that risk is accepted rather than guarded,
 * because a guard upstream does not have is a parity divergence of its own.
 */
export function recordedVersionSatisfies(recorded: string, range: string): boolean {
  const normalized = valid(recorded) ?? coerce(recorded)?.version;
  return normalized !== undefined && satisfies(normalized, range);
}
```

### Reference: upstream's user-visible failure wording

`[VERIFIED: binary grep — `Cct` and `ROt` bodies]`, verbatim:

```js
case "disjoint":      return `${e} "${y}" has conflicting version requirements (no version satisfies all of: ${d})`;
case "too-complex":   return `${e} "${y}" has version requirements too complex to intersect — simplify the ranges: ${d}`;
case "invalid":       return `${e} "${y}" has an invalid version requirement among: ${d}`;
case "installed-unsatisfied": return `${e} "${y}" is installed at ${efe(CH(u??"an unknown version"))}, which does not satisfy: ${d}`;
```

```js
function ROt(e, t, r) { let o = efe(CH(r)); return `${e} "${CH(t)}" has no git tag satisfying ${o}`; }
```

`e` is `"Plugin"` when the failing key is the root and `"Dependency"` otherwise; `CH` strips control characters (`/[\x00-\x08\x0b-\x1f\x7f]/g`) and `efe` truncates at 200 chars with `… (+N chars)` `[VERIFIED: binary grep — `Zme=200`, `cXt`]`. This project must **not** copy the prose — `docs/messaging-style-guide.md` and the closed `REASONS` set govern. But the **sanitize-and-truncate discipline is worth copying verbatim in spirit**: these strings interpolate untrusted manifest text into a line-oriented row, which is the same forgery surface `domain/dependencies.ts` guards against with its allowlists `[VERIFIED: extensions/pi-claude-marketplace/domain/dependencies.ts:22-26]`. Phase 1's `TOKEN_PATTERN` / `VERSION_PATTERN` allowlists already cover declared text; a range produced by *intersection* is synthesized from allowlisted inputs and so inherits the guarantee, but the plan should state that reasoning rather than leave it implicit.

### Reference: the tag-name convention and lookup

`[VERIFIED: binary grep — `Y0t="--v"` and the `GBt` body]`:

```js
Y0t = "--v";
// inside GBt, after the ls-remote output lands in `d`:
let y = `${t}${Y0t}`, v = new Map;   // t = plugin name; y = the tag-name prefix
```

So the tag prefix is `` `${pluginName}--v` `` and the remainder is parsed as a semver version. Upstream memoizes per-URL via the `o` Map parameter (`o?.get(e)` / `o?.set(e, u)`, with `o?.delete(e)` on failure so a transient error is retried) — worth porting, since one cascade can query the same marketplace repo for several dependencies. That memo is the direct analogue of the existing `authMemo: Map<string, AuthAttemptResult>` already threaded through the install options `[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:173]`.

### Reference: how a guard-free ledger call is made today

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:720-731]`, verbatim:

```ts
      const result = await runInstallLedger(
        state,
        locations,
        buildInstallLedgerOptions(opts, { scope, cwd, marketplace, plugin }),
        capture,
        transaction,
      );
      if (result.kind === "marketplace-absent") {
        // WR-04: precondition miss -- read-only in effect, NO tx.save().
        marketplaceAbsent = true;
        return;
      }
```

`state` is `tx.state` — the caller's snapshot. Every argument is per-call; nothing is module-scoped. **N invocations under one lock therefore compose with no further work**, which settles the mechanics half of CONTEXT.md's open discretion item. The locking contract is stated on the function itself `[VERIFIED: install-outcome.ts:492-500]`, verbatim:

> ```
> * Locking contract: the CALLER owns the per-scope state lock and the
> * load/save lifecycle. This function performs NO `withStateGuard` /
> * `withLockedStateTransaction` / `saveState` of its own -- `proper-lockfile`
> * (`retries: 0`) is NOT re-entrant, so nesting a second guard on the same
> * `stateLockFile` self-deadlocks (ELOCKED -> StateLockHeldError; the defect
> * that made the fresh-enable path unreachable).
> ```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PI-13 / PR-5: no auto-resolution, manual install only | Cascade install of declared dependencies | This milestone (v1.20) | Retired, not worked around — REQUIREMENTS.md §RESV states this explicitly |
| PL-5: versions compared as strings | Real `semver` evaluation for dependency constraints | This phase (D-03-01) | Scoped to constraint evaluation. PL-5's string compare governs other surfaces and is not being replaced wholesale |
| `git ls-remote` via subprocess (upstream's choice) | `isomorphic-git.listServerRefs({ prefix })` | This phase | No `git` binary on PATH requirement (D-21, MA-7); the shell-out allow-list stays closed at three modules |
| One marketplace entry ⇒ one pinned ref | A constrained dependency may re-pin to an alternate tag | This phase (D-03-02.2) | Genuinely new to this codebase's git-source model, as CONTEXT.md notes |

**Deprecated / not applicable:**
- `orchestrators/import/`'s best-effort per-entry-outcome failure semantics: available machinery, deliberately **not** adopted for failure handling (D-03-07). Its per-entry *outcome reporting* shape may still inform the rendering.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `b3 = 1024` is the conjunct cap used by the intersection function specifically | Pattern 2 | Two `b3` bindings appear in the bundle (`var b3=1024` and `let b3=qI`); minifier scope reuse means the one in `Tct`'s scope is probably but not provably 1024. A wrong cap changes only *when* `too-complex` fires, not whether. Pick a documented project-owned cap and say so rather than claiming parity on this number |
| A2 | `Jm(dep, declaringPlugin)` implements exactly the marketplace fill-in RESV-02 describes | Pattern 1 | Inferred from call position (`Jm(V, F)` where `V` is a raw dependency element and `F` the declaring plugin key) and from `qt(x).marketplace` being the key splitter. The body was not extracted. If it does more, RESV-02's port could miss a case |
| A3 | `@types/semver@^7.x` is version-compatible with `semver@7.8.5` | Standard Stack | Registry shows `@types/semver@7.8.0` against `semver@7.8.5`; DefinitelyTyped commonly trails by patch. A mismatch surfaces immediately as a typecheck error, not at runtime |
| A4 | A new non-gated leaf module needs no `gate-targets.ts` edit | Pattern 4 | Based on `install-clone-probe.ts` being absent from `NETWORK_FREE_TARGETS` while both its callers are members. Confirmed structurally; the gate's own fire/pass controls were not re-run against a planted new module |
| A5 | The cascade's derived `Phase[]` array is compatible with the D-01 literal-array discipline | Pattern 3 | A reviewer may read the discipline more strictly. Mitigation is a module-header rationale, not a code change. Worth an explicit operator nod at plan-review |
| A6 | The existing `"marketplace not added"` reason can carry D-03-08's failure without a new token | Pitfall 4 | If the rendering needs to name the *dependency* as well as the marketplace, a new token (and a COMPAT-01 amendment) is required after all |

## Open Questions

1. **Does upstream's HEAD-copy fallback for a no-match on the marketplace repo get ported?** (Pitfall 7)
   - What we know: upstream hard-fails `no-matching-tag` only when the tag query ran against the plugin's own git source; a query against the marketplace repo that finds nothing logs and falls through to a HEAD copy. Extracted verbatim.
   - What's unclear: D-03-02 says "full upstream parity" and D-03-07 says all-or-nothing. The fallback arm is a *soft degrade*, which is the shape D-03-08 deliberately diverged from in the adjacent case.
   - Recommendation: **raise at plan-review as a one-question confirmation.** Given D-03-08's precedent (uniform failure propagation was chosen over upstream's softer handling), the consistent answer is almost certainly "hard-fail both arms" — but it is a parity divergence and should be recorded as a decision, not absorbed silently.

2. **Where do a plugin's dependencies come from at cascade time?**
   - What we know: `ResolvedPlugin`'s materializable arms carry exactly twelve fields and `dependencies` is **not** among them `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver-types.ts:67-80]` — verbatim: `installable`, `name`, `pluginRoot`, `supported`, `unsupported`, `notes`, `componentPaths`, `mcpServers`, `hooksConfigPath`, `orphanRewake`, `droppedHooks`, `defaultEnabled`. The resolver *validates* the field and discards it `[VERIFIED: domain/plugin-resolver.ts:281-284]`. `orchestrators/plugin/info.ts` re-reads it raw and implements D-01-32's plugin.json-first order in a private local helper `[VERIFIED: info.ts:1174-1175]`.
   - What's unclear: whether Phase 3 widens `MATERIALIZABLE_FIELDS` to carry the parsed dependencies, or extracts D-01-32's read order into a shared `domain/` helper that both `info.ts` and the cascade call.
   - Recommendation: **extract the read order into `domain/`.** Widening the resolver union pulls `dependencies` into a typebox schema that four surfaces destructure, for one consumer. The shared helper also removes the current duplication in `info.ts`, and keeps the cascade from importing a gated read-surface sibling. Note `info.ts` is a `NETWORK_FREE_TARGETS` member, so the cascade must not import from it either way.

3. **Does the intersection accumulator include the root plugin's own declared constraints on itself?**
   - What we know: upstream builds the accumulator from two maps (`mr`, `Qn`) and `GGn` collects from installed plugins' `depConstraints`. The root's participation was not traced.
   - What's unclear: whether an *installed* plugin's constraint on a dependency the *current* install also names is accumulated (it appears to be — `GGn` walks installed plugins).
   - Recommendation: resolve at plan time by extracting `GGn`'s caller. It matters: if installed plugins contribute constraints, `install foo` can fail on a range declared by an unrelated already-installed plugin, which is surprising behavior that needs a reason token that explains itself.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.x local; CI pins 24; `engines` floor `>=20.19.0` | — |
| npm | `semver` install | ✓ | bundled | — |
| `isomorphic-git` | tag listing | ✓ | 1.41.9 (declared `^1.41.8`) | — |
| `semver` | constraint evaluation | ✓ (hoisted 7.8.5, dev-chain provenance) | 7.8.5 | none needed — becomes a direct dep |
| `@types/semver` | typecheck | ✗ | — | none — must be installed |
| Claude Code 2.1.251 binary | upstream parity re-verification | ✓ | `~/.local/share/claude/versions/2.1.251` (newest installed; 2.1.236 and 2.1.243 also present) | — |
| Network (HTTPS to git hosts) | D-03-02.2 tag lookup at runtime | ✓ | — | A tag-lookup failure must degrade to a typed failure reason, never an unhandled throw — see upstream's `o?.delete(e)` + `return null` on `ls-remote` failure |

**Missing dependencies with no fallback:** `@types/semver` — install it.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in) + `strong-mock@^9.2.2` |
| Config file | none — configured via `package.json` scripts |
| Quick run command | `node --test "tests/domain/dependency-closure.test.ts"` (per-file) |
| Full suite command | `npm test` then `npm run test:integration` |

`[VERIFIED: package.json scripts — `test`, `test:integration`, `check`]`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESV-01 | Cascade installs declared dependencies; survives `/reload` | unit + integration | `node --test tests/orchestrators/plugin/install-cascade.test.ts` | ❌ Wave 0 |
| RESV-01 | Reload durability (config declares every member) | integration | `node --test "tests/integration/**/*.test.ts"` | ❌ Wave 0 |
| RESV-02 | Named marketplace wins; absent falls back to declaring plugin's | unit | `node --test tests/domain/dependency-closure.test.ts` | ❌ Wave 0 |
| RESV-03 | Unsatisfiable range fails naming the constraint | unit | `node --test tests/domain/dependency-range.test.ts` | ❌ Wave 0 |
| RESV-03 | No matching `<name>--v*` tag fails naming the range | unit | `node --test tests/orchestrators/plugin/dependency-tag-probe.test.ts` | ❌ Wave 0 |
| RESV-04 | Cycle terminates and reports its chain | unit | `node --test tests/domain/dependency-closure.test.ts` | ❌ Wave 0 |
| RESV-04 | **Diamond does NOT report a cycle** (Pitfall 1 control) | unit | same file | ❌ Wave 0 |
| RESV-05 | Already-installed dependency skipped, not reinstalled | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` | ❌ Wave 0 |
| RESV-05 | Already-installed but unsatisfying reports the conflict | unit | `node --test tests/domain/dependency-range.test.ts` | ❌ Wave 0 |
| RESV-06 | Failed member ⇒ whole cascade rolled back, nothing half-materialized | unit (footprint) | `node --test tests/orchestrators/plugin/install-cascade.test.ts` | ❌ Wave 0 |
| RESV-06 | Pre-existing dependency NOT touched by rollback (D-03-07) | unit (footprint) | same file | ❌ Wave 0 |
| NFR-3 | Re-running after a failure reaches the same result | unit (replay) | same file | ❌ Wave 0 |
| NFR-5 | Neither install owner gains a git surface | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ exists |
| — | New `REASONS` members amended deliberately | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ exists |
| — | New modules have mirrored tests | gate | `npm run test:corresponding` | ✅ exists |

Per the project's whole-footprint convention recorded in STATE.md for Phase 116-24, every destructive/rollback case must compare the **surviving install records and on-disk artifacts of both scope roots** as one whole value beside the notification — a notification-only assertion of a rollback passes while proving nothing about whether state changed.

### Sampling Rate

- **Per task commit:** `node --test "tests/<layer>/<module>.test.ts"` plus `npm run typecheck`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` green (typecheck → lint → lint:workflows → fallow → format:check → test:corresponding → test:coverage:direct:negative → test → test:integration) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/domain/dependency-closure.test.ts` — RESV-02, RESV-04, RESV-05 (incl. the diamond control)
- [ ] `tests/domain/dependency-range.test.ts` — RESV-03, D-03-02.1, D-03-02.3, D-03-04
- [ ] `tests/orchestrators/plugin/dependency-tag-probe.test.ts` — D-03-02.2
- [ ] `tests/orchestrators/plugin/install-cascade.test.ts` — RESV-01, RESV-06, D-03-07
- [ ] `tests/platform/git.test.ts` — extend for the new tag wrapper (file exists)
- [ ] `tests/architecture/compat-01-no-expansion.test.ts` — amend the `REASONS` pin (file exists)
- [ ] Framework install: none — `node:test` and `strong-mock` already present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (indirect) | The tag probe reuses `buildAuthCallbacks` / `CredentialOps` for private repos — never a new credential path `[VERIFIED: platform/git.ts:429-492]` |
| V3 Session Management | no | No sessions |
| V4 Access Control | yes | NFR-10 containment: a re-pinned dependency's clone must still resolve inside its owning clone root; `assertPathInside` is the chokepoint |
| V5 Input Validation | yes | `domain/dependencies.ts`'s `TOKEN_PATTERN` / `VERSION_PATTERN` / `SHA_PATTERN` allowlists, plus `semver.validRange` as a second gate before any range reaches a network query |
| V6 Cryptography | no | None introduced |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious `dependencies` entry forges a notification row (newline/ANSI injection) | Spoofing | Phase 1's allowlists reject the element whole `[VERIFIED: domain/dependencies.ts:22-26]`; an intersected range is synthesized from allowlisted inputs |
| Dependency cascade installs an attacker-chosen plugin from an attacker-named marketplace | Elevation of Privilege | D-03-08: no auto-add. A dependency can only name an **already-added** marketplace; the user's `marketplace add` remains the trust decision |
| Unbounded-cost range input hangs the resolver | Denial of Service | The two size guards (4096 chars, 1024 conjuncts), both checked **before** the work they bound |
| Cycle causes unbounded recursion | Denial of Service | The path stack; report-and-terminate |
| Tag-name injection into the remote query | Tampering | Upstream rejects unsafe URLs before querying (`if (!MB(e)) … return null` in `GBt`) `[VERIFIED: binary grep]`; `listServerRefs` takes a structured `url` with no shell, so no argument injection surface exists |
| Credential leaked into a dependency failure reason | Information Disclosure | `tests/architecture/no-credential-leak.test.ts` scans named files; the new probe leaf touching auth must be assessed for membership `[VERIFIED: tests/architecture/gate-targets.ts:397-408 — CREDENTIAL_LEAK_TARGETS]` |
| Absolute paths leaked into a failure row | Information Disclosure | `shared/redact-absolute-paths.ts`; the existing basename-only discipline on config failures |

## Project Constraints (from CLAUDE.md)

- **Read before editing; trace callers before modifying a function.**
- **Never commit to `main`.** Work on `features/manifest` (current branch). Branch names `features/*`.
- **Conventional Commits**, title 5–72 chars, body lines ≤80. No GSD milestone/phase mentions in commit messages or PR titles.
- **Run `pre-commit run --all-files` (or `--files <changed>`) BEFORE `git commit`.** Never `--no-verify`. CI runs `--all-files`, so a scoped run can hide violations.
- **Never rebase, never rewrite history.** Merge to update branches. `--squash` on PR merge.
- **`SKIP=trufflehog`** when committing from inside a worktree.
- **`npm run check` must stay green** — the full chain, fallow included.
- **All user-visible output via `ctx.ui.notify`** through `shared/notification-dispatch.ts` (IL-2). No `process.stdout`/`process.stderr` in extension code.
- **All disk mutations atomic** (NFR-1); every operation idempotent or fail-clean (NFR-3); no fix may require a Pi restart (NFR-2).
- **Containment (NFR-10):** never write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp.json`.
- **No telemetry (IL-4), English-only (IL-1).**
- **Comments cite decision/requirement IDs, never GSD phase/plan/wave numbers** (`.claude/rules/typescript-comments.md`). No narration of code that no longer exists.
- **Versioning:** before a PR, offer to bump `package.json`, `sonar-project.properties`, `package-lock.json`, and update `CHANGELOG.md`.
- **PR descriptions:** use the `simple-english` skill (Plain mode) and `humanizer`.
- **Project skills available:** `humanizer`, `simple-english`, `typescript-google-style-review`, `typescript-unit-testing-review` (present in both `.claude/skills/` and `.agents/skills/`). The last two should be applied to this phase's new `.ts` modules and their mirrored tests.

## Sources

### Primary (HIGH confidence)

- `~/.local/share/claude/versions/2.1.251` — Claude Code bundle, 214,326,616 bytes. Extracted this session: `fze` (closure walk), `Tct` (range intersection), `GBt` (tag lookup), `k3` (satisfaction check), `Cct`/`ROt` (failure wording), constants `pze=4096`, `b3=1024`, `Y0t="--v"`, and the `no-matching-tag` call site with its two arms. Anchor occurrence counts: `no-matching-tag` ×4, `range-conflict` ×7, `installed-unsatisfied` ×3, `not found in any known marketplace` ×2, `not auto-installing` ×3. Newest installed version; 2.1.236 and 2.1.243 also present.
- Repository source read this session: `platform/git.ts`, `transaction/with-state-guard.ts`, `transaction/phase-ledger.ts`, `domain/dependencies.ts`, `domain/resolver-types.ts` (1-112), `persistence/config-write-back.ts`, `orchestrators/plugin/install-clone-probe.ts`, `orchestrators/plugin/install-outcome.ts` (150-217, 440-740), `orchestrators/plugin/install-flow.ts` (610-939), `orchestrators/plugin/shared.ts` (500-729), `orchestrators/reconcile/plan.ts` (470-514), `shared/notification-types.ts` (1-62), `tests/architecture/gate-targets.ts`, `tests/architecture/no-orchestrator-network.test.ts`.
- `node_modules/isomorphic-git/index.d.ts:2142-2157` — `listServerRefs` signature, installed version 1.41.9.
- npm registry via `npm view` and `gsd-tools query package-legitimacy check`: `semver@7.8.5`, `@types/semver@7.8.0`.

### Secondary (MEDIUM confidence)

- `.planning/codebase/ARCHITECTURE.md`, `CONVENTIONS.md`, `STACK.md` — layering, gate inventory, complexity ceilings.
- `.planning/PROJECT.md` — NFR-5 amendment precedents (url-source, fetch verb).
- `.planning/phases/03-dependency-resolution/03-CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`.
- `scripts/check-corresponding-tests.mjs`, `package.json` scripts, `tests/architecture/compat-01-no-expansion.test.ts`, `tests/architecture/no-telemetry-deps.test.ts`, `tests/architecture/import-boundaries.test.ts` (partial reads).

### Tertiary (LOW confidence)

- None. No web search was used; every claim traces to the binary, the repository, `node_modules`, or the npm registry.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — `semver` confirmed on the registry *and* confirmed as upstream's own choice by binary extraction; the missing-types fact measured directly in `node_modules`.
- Upstream algorithms: **HIGH** — extracted verbatim from the compiled bundle, not inferred from docs. Two identifier roles (`Jm`, the second `b3` binding) are inferred rather than extracted and are logged as A1/A2.
- Architecture / integration points: **HIGH** — every seam opened with `Read` this session and quoted verbatim with line ranges.
- Pitfalls: **HIGH** for 1–6 (each traced to a gate or to extracted upstream source); **MEDIUM** for 7's parity nuance, which is extracted but whose disposition is an open decision.
- Open questions 2 and 3: **MEDIUM** — question 2's premise is verified (the resolver's field set is a closed literal with no `dependencies`); the recommendation between two viable shapes is a judgment call.

**Research date:** 2026-09-14
**Valid until:** 2026-10-14 (30 days). Re-verify sooner if the Claude Code binary updates past 2.1.251 — D-03-01, D-03-02 and D-03-08 all rest on its extracted behavior.
