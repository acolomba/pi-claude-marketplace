# Phase 7: Marketplace Autoupdate - Research

**Researched:** 2026-10-19
**Domain:** Cucumber behavioral scenarios for `marketplace autoupdate` / `noautoupdate`, plus two test-first production changes in `orchestrators/marketplace/autoupdate.ts`
**Confidence:** HIGH (every claim below was read in this session or observed by running the real suite; no external library is involved)

## Summary

Phase 7 is mostly scenario work in `features/marketplace/autoupdate.feature`, using steps that already exist. The phase also makes two small production changes in one file. First, D-02 to D-05: a local entry without an `autoupdate` value is judged by the value it inherits. Second, D-08: an unscoped named miss carries no scope. No new library, step module, or support module is needed. The one gap is D-05: no scenario can make a config invalid without a new config-writing step, and the cucumber rules allow only one writer. So D-05 stays unit-tested, and the planner should flag that (Open Question 1).

I ran six probe scenarios against today's code, from a scratch file outside `features/` (nothing was committed). They confirmed: the payload of an empty nameless flip (AU-07); the D-01 row order; AU-09 with a different starting value in each scope; the D-07 scoped miss; that info shows `details autoupdate true` after a new session (AU-05); and that today's code fails the D-03 and D-08 expectations. The D-07 misses, AU-07, AU-09, and D-01 already **pass** on today's code. They are pins, not test-first changes. The D-03, D-04, and D-08 scenarios **fail** on today's code at exactly the assertion the decision names, so each one is a valid RED step.

CONTEXT.md's Integration Points list misses three unit tests that the D-02/D-04 change breaks: the write-failure test `D-06: an unnamed flip whose local write fails …` (autoupdate.test.ts:1050), `D-09: an unnamed --local flip changes only the local config …` (:1622), and the D-08 catalog byte total `EXPECTED_UTF8_BYTES` (catalog-contract.test.ts:22). They are listed below with the edit each needs.

**Primary recommendation:** Add an `InheritedValue` callback to `planFlip`/`layerAlreadySet`, built by `inheritFrom(base ConfigLoadResult)` (current base, lazy fail-closed) or `inheritAfterFlip(base, enable)` (post-flip base for the flagless nameless form). Replace `scope: opts.scope ?? "project"` with a conditional spread. Write each RED scenario first, using the Phase 6 `*-RED.json` evidence pattern.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Judging "already set" per layer, including inheritance (D-02..D-05) | orchestrators (`orchestrators/marketplace/autoupdate.ts`) | persistence (`loadConfig` trichotomy) | The flip planner owns per-layer decisions; persistence only reports `absent`/`invalid`/`valid` |
| Effective (merged) value shown by `list`/`info` | persistence (`config-merge.ts` `mergeScopeConfigs`) | orchestrators (`list.ts`, `scope-fanout.ts`) | Already field-merges local over base; unchanged by this phase |
| Not-added payload without scope (D-08) | orchestrators (`notifyNamedMiss`) | shared (`MarketplaceNotAddedMessage.scope?`) | The type already allows an absent scope; only the producer changes |
| Byte contract of the catalog S2 state | docs (`docs/output-catalog.md`) | tests/architecture (catalog fixtures + contract) | The catalog is the source of truth for the rendered bytes |
| Behavioral proof | `features/marketplace/autoupdate.feature` | existing shared steps | Verb phase owns its feature file (ROADMAP source-kind strategy) |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Row order of a nameless flip

- **D-01 (user):** Keep today's order. Within each scope, the rows of the
  marketplaces whose value changed come first, then the
  `(skipped) {already autoupdate}` or `{already no autoupdate}` rows. Each group
  keeps state-record insertion order, and project rows come before user rows.
  No production change. The scenario uses deliberately non-alphabetical names
  with interleaved starting values, such as `zeta` on and then `alpha` off, so
  it tells this grouping apart from insertion order and from alphabetical
  order.

#### A local entry without a value inherits it

- **D-02 (user):** A local-config entry that has no `autoupdate` value is
  judged by the value it inherits. When the base config declares the
  marketplace, it inherits the base entry's value, and a base entry without a
  value is off (MAU-4). Otherwise it inherits off. This replaces the Phase 3.2
  research rule ("an absent value in the local layer is no value at all, so a
  flip always writes it"). It refines 3.2 D-07: "already" is still judged per
  target layer, but the local layer's value now includes what it inherits. The
  rule applies to named and nameless flips, with and without `--local`.
- **D-03 (user):** As a result, a local flip writes an explicit value only
  when the flip changes the effective value:
  - After `marketplace add <src> --local` (declared in the local config only),
    `noautoupdate <name> --local` reports `(skipped) {already no autoupdate}`
    and writes nothing.
  - When the base config declares the marketplace off and the local entry has
    no value, `noautoupdate <name> --local` also reports
    `{already no autoupdate}` and writes nothing.
  - When the base declares it on and the local entry has no value,
    `noautoupdate <name> --local` still writes an explicit local `false` and
    reports `autoupdate disabled` (a per-machine override).
    `autoupdate <name> --local` there reports `{already autoupdate}`.
  - A local entry that has an explicit value is judged by that value, as it is
    today.
- **D-04 (user):** A nameless flip without `--local` judges a local entry
  against the base value as it stands after the flip. When the flip writes the
  base config, a local entry with no value is not written: it inherits the new
  value. A local entry whose explicit value differs from the request is still
  written. Every declaring layer still ends with the requested effective value,
  which is the outcome of 3.2 D-06. This rewrites the Phase 3.2 scenario
  "Enabling autoupdate for every marketplace sets it in each config that
  declares the marketplace": the local `tools` entry keeps no value, and the
  title changes to match.
- **D-05 (derived from CFG-03 and the fail-closed rule):** A local flip now
  needs the inherited value, so it must read the base config. When the
  inherited value is needed and the base config is invalid, the flip fails with
  the CFG-03 `invalid manifest` row that names the base file. It writes
  nothing. Never guess an inherited value from a config that cannot be read.
  Under `--local`, writes and rows still cover only the local layer (3.2 D-09).
  The planner chooses whether the base is read always or only when it is
  needed. The unit test "D-09: an unnamed --local flip reads only the local
  config" changes either way.
- **D-06:** Each behavior change in D-02 to D-04 first gets a scenario that
  fails on today's code, then the fix makes it pass (the Phase 6 C-10
  precedent). Paired unit tests keep 100% direct coverage. The change gets a
  CHANGELOG line, and every doc that states the old "always writes" rule is
  corrected. The tests that pin the old rule are listed under Integration
  Points.

#### Not-added results

- **D-07 (user):** Pin the scoped misses in both directions for both verbs.
  When only the project holds the name, `autoupdate <name> --scope user` and
  `noautoupdate <name> --scope user` fail with `marketplace-not-added`,
  scope `user`, and the reason `marketplace not added to user scope`. The
  reverse direction is the same with `--scope project`. No config changes. This
  mirrors RM-05 and INFO-06.
- **D-08 (user):** An unscoped `autoupdate <name>` or `noautoupdate <name>` for
  a name that neither scope holds fails with `marketplace-not-added` and
  **no scope**. This matches `remove`, `info`, and `update` (RM-06, INFO-05,
  UPD-09). Today the result names `[project]`, the first scope tried (ATTR-05,
  output-catalog S2). That is a production change in `notifyNamedMiss`, the
  catalog S2 entry, the unit tests, and the cross-op convergence matrix, where
  autoupdate moves into the bracketless bare-form matrix. It is written
  test-first. Unchanged: when no scope changed, a layer refusal is still
  reported as the first scope's refusal (3.2 D-09), and an explicit `--scope`
  miss still carries the requested scope. — **Reversibility:** costly — it
  changes the documented catalog S2 bytes and the JSON `marketplace-not-added`
  payload's `scope` field, so undoing it touches the catalog, the convergence
  matrix, and the unit and behavioral tests again.

#### Pinned as they are (carried forward, not re-asked)

- AU-09 (milestone invariant): an unscoped named flip changes every scope whose
  target layer declares the name, project row before user row. A scope whose
  target layer does not declare the name produces no row (3.2 D-09).
- 3.2 D-05 to D-07 otherwise stand: a named flip changes only its target layer
  and is refused when only the other layer declares the marketplace. A row
  reports the target layer, so a base flip reports the base value even when a
  local value overrides it.
- The flip changes no installed plugin and needs no reload. Severity is
  `info` for changed and already-set rows.
- AU-03 is an Outline over a flagless add, with an untagged `dir`/`file`
  block, an `@url` block, and an `@github` block. Phase 3 set this pattern even
  for requirements that list only dir.

### Claude's Discretion

- Exact Gherkin wording, fixture names, step boundaries, and plan split, within
  `.agents/skills/cucumber/rules/`.
- How AU-05 proves persistence, as long as the asserted value is one the
  default cannot produce. For example: `autoupdate`, then a new session that
  shows on in both `list` and `info`; or `autoupdate`, then `noautoupdate`,
  then a new session that shows off.
- Whether AU-09 uses different starting values per scope (one scope
  `already autoupdate`, the other `autoupdate enabled`) to show that each scope
  is judged on its own.
- Whether AU-06, AU-07, and the D-07 misses run for both verbs as separate
  scenarios or as an Outline (an Outline needs three or more variants).
- Whether a new `features/step_definitions/marketplace/autoupdate.steps.ts` is
  needed, or the shared steps suffice.

### Deferred Ideas (OUT OF SCOPE)

- Activating the `@url` and `@github` rows remains in Phases 9 and 10.
- A session-start autoupdate run (Claude Code parity) remains deferred in
  PROJECT.md. Discussion did not reopen it.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AU-01 | `autoupdate` turns autoupdate on for a marketplace | New named scenario; row `autoupdate enabled`, base config `autoupdate true`. No existing scenario isolates it (autoupdate.feature uses it only as setup or with layers). |
| AU-02 | `autoupdate` on a marketplace already on is skipped as `already autoupdate` | New named scenario; row `skipped` + `already autoupdate`. The existing scenario at autoupdate.feature:148 mixes in a local override, so add a plain one. |
| AU-03 | A newly added marketplace has autoupdate off, so `noautoupdate` is skipped as `already no autoupdate` (dir, url, gh) | Source-kind Outline: untagged dir/file, `@url`, `@github`; config row `name`/`source` proves nothing was written. |
| AU-04 | `noautoupdate` turns autoupdate off | New named scenario after a `Given` enable; row `autoupdate disabled`, base config `autoupdate false`. |
| AU-05 | The setting shows in `list` and `info` and survives a new session | `Given the user has started a new pi session` then `list` / `info`; probe P6 verified `details autoupdate true` in info after a new session. |
| AU-06 | Without a name, the change applies to every marketplace of both scopes | The D-01 scenario (probe P7, passes today) covers both scopes; add config tables for both scopes. |
| AU-07 | Without a name and with nothing added, the result is empty | Probe P1 passes today: fields `kind cascade` / `severity info` / `needs reload false`, then `the result lists no marketplaces`. |
| AU-08 | A name neither scope holds fails as `marketplace not added` | The D-08 RED scenario: `marketplace-not-added` with no `scope` row; fails today (probe P2 shows the extra `scope project`). |
| AU-09 | Without `--scope`, `autoupdate <name>` for a name both scopes hold changes both | Probe P8 passes today: project `skipped already autoupdate`, user `autoupdate enabled`, no tally fields (single cardinality). |
</phase_requirements>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Never commit to `main`; work stays on `features/cucumber-behavioral-tests`. Merge, never rebase. Never `--no-verify`.
- Commit messages follow Conventional Commits and name no milestone, phase, plan, or wave (`.agents/skills/committing/SKILL.md`).
- Read a file before editing it. Trace callers before changing a function (done below for `setMarketplaceAutoupdate`).
- Upstream parity is the default. The CONTEXT records no divergence for this phase (`autoupdate`/`noautoupdate` exist only in Pi).
- `npm run check` must stay green: typecheck, ESLint (`--max-warnings 0`), fallow (dead code, health `maxCognitive: 15`/`maxCyclomatic: 20`, dupes), Prettier, pairing, `check:features`, unit + integration + cucumber, and 100% direct coverage per pair.
- Output goes only through `notify()`/`notifyWithContext()` (IL-2). No direct `ctx.ui.notify`.
- Disk writes are atomic (`writeBatchedConfigEntries`, NFR-1). A flip writes only config, never `state.json` (WR-05/SPLIT-01).
- NFR-5: `autoupdate.ts` must not import `platform/git` (it is not in `NETWORK_SEAMS`).
- Comments cite durable IDs (D-NN, AU-NN, CFG-03), never phase, plan, or wave references, and they avoid comments on trivial code.
- Every plan SUMMARY.md includes `## Threat Flags`.
- Tests that touch user scope run under `withHermeticHome` / `withHermeticEnvironment` / `createHermeticEnvironment`. The existing autoupdate unit and integration tests already do.

## Standard Stack

No package is added. The phase uses what the repo already pins.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@cucumber/cucumber` | `^13.3.0` [VERIFIED: package.json:18] | Behavioral scenarios | The suite runner; `npm run test:cucumber` is `cucumber-js` [VERIFIED: package.json:106] |
| `node:test` + `node:assert/strict` + `strong-mock` | repo pins | Paired unit tests | `tests/orchestrators/marketplace/autoupdate.test.ts` already uses all three [VERIFIED: autoupdate.test.ts:1-7] |

**Installation:** none.

## Package Legitimacy Audit

Not applicable. This phase installs no external package.

## Architecture Patterns

### System Architecture Diagram

```text
/claude:plugin marketplace (no)autoupdate [<name>] [--scope s] [--local]
        │
        ▼
edge/handlers/marketplace/autoupdate.ts ──► setMarketplaceAutoupdate(opts)
        │                                        │
        │                       flipScopes: scopes = scope ? [scope] : [project, user]
        │                                        │  (each under withLockedStateTransaction)
        │                                        ▼
        │                     ┌── name? ── planNamedFlip ──► load target layer (CFG-03 throw)
        │                     │                │           ► state has name? else NotFound
        │                     │                │           ► load OTHER config (ConfigLoadResult)
        │                     │                │           ► layer gate (refused/undeclared/other-unreadable)
        │                     │                ▼
        │                     │           planFlip([name], target, enable, INHERITED) ◄── NEW (D-02..D-05)
        │                     └── no name ─ planEveryFlip
        │                                      --local: local layer + inheritFrom(base result, lazy fail-closed)
        │                                      flagless: base+local layers + inheritAfterFlip(base, enable)  (D-04)
        │                                        ▼
        │                         writeFlipPlan (one batched write per stale layer; skipped if orchestrated)
        ▼                                        ▼
notify rows: changed first, then already (D-01) │ named miss ─► notifyNamedMiss
                                                 │     refusal → first scope's refusal row
                                                 │     none    → marketplace-not-added, scope only when --scope given (D-08)
```

### Recommended file touch list

```text
extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts   # D-02..D-05, D-08
tests/orchestrators/marketplace/autoupdate.test.ts                          # paired unit (100% direct)
tests/integration/marketplace-layer-autoupdate.test.ts                      # D-04 expectation
tests/architecture/cross-op-convergence.test.ts                             # D-08 matrix move
tests/architecture/catalog-uat/fixtures/marketplace-autoupdate.ts           # D-08 S2 fixture
tests/architecture/catalog-uat/catalog-contract.test.ts                     # D-08 byte total
docs/output-catalog.md                                                      # Config files prose + S2
README.md, README.es.md                                                     # nameless-flip sentence
CHANGELOG.md                                                                # amend the unreleased layer bullet
features/marketplace/autoupdate.feature                                     # all scenarios
```

No new step module, support module, or lib module is needed (see "Scenario inventory").

### Pattern 1: Inherited value as a lazily evaluated callback (D-02..D-05)

**What:** `layerAlreadySet` today returns `!layer.local && !enable` for a missing own value [VERIFIED: autoupdate.ts:297-304]:

```ts
function layerAlreadySet(layer: FlipLayer, name: string, enable: boolean): boolean {
  const own = ownValue(layer.config.marketplaces, name)?.autoupdate;
  if (own === undefined) {
    return !layer.local && !enable;
  }

  return own === enable;
}
```

Change it so a local layer without an own value compares the **inherited** value. Use `&&` short-circuit so the base config is consulted only for a valueless local entry. That gives "fail only when needed" for D-05 with no extra branch.

**Recommended shape** (skeleton; names are suggestions, every identifier other than the new ones is quoted from the file):

```ts
// Source: derived from autoupdate.ts:274-304, 312-339, 401-451 and config-io.ts:112-115
/** The `autoupdate` value a local entry without one of its own inherits (D-02). */
type InheritedValue = (name: string) => boolean;

function layerAlreadySet(
  layer: FlipLayer,
  name: string,
  enable: boolean,
  inherited: InheritedValue,
): boolean {
  const own = ownValue(layer.config.marketplaces, name)?.autoupdate;
  if (own !== undefined) {
    return own === enable;
  }

  // MAU-4: a base entry without a value is off; a local one inherits (D-02).
  return (layer.local && inherited(name)) === enable;
}

/**
 * D-02 / D-05: the base entry's current value, off when the base config is
 * absent or does not set it. An invalid base config fails closed, and only when
 * a valueless local entry asks for it.
 */
function inheritFrom(base: ConfigLoadResult): InheritedValue {
  return (name) => {
    if (base.status === "invalid") {
      throw invalidConfigError(path.basename(base.filePath));
    }

    return (
      base.status === "valid" && (ownValue(base.config.marketplaces, name)?.autoupdate ?? false)
    );
  };
}

/** D-04: after a flagless nameless flip, a base config that declares the marketplace holds `enable`. */
function inheritAfterFlip(base: FlipLayer, enable: boolean): InheritedValue {
  return (name) => enable && ownValue(base.config.marketplaces, name) !== undefined;
}
```

- `planFlip(names, layersOf, enable, inherited)`: pass `inherited` through to `layerAlreadySet` in the existing `layers.filter(...)` (autoupdate.ts:326). Its complexity does not change.
- `planEveryFlip`:
  - With `--local`: load the local layer with `loadFlipLayer(localConfigJsonPath, true)` first, so an invalid local still fails first, as today (unit test :1456). Then pass `inheritFrom(await loadConfig(locations.baseConfigJsonPath))`.
  - Without `--local`: keep the base-then-local `loadFlipLayer` order (autoupdate.ts:442-445), so an invalid base is named first. Pass `inheritAfterFlip(base, opts.enable)`.
- `planNamedFlip`: load `other` once with `loadConfig(...)`, after the state-record check (autoupdate.ts:412-414). Pass it to a now-synchronous `requireTargetDeclares(target, other, name)`, which today calls `loadConfig(otherPath)` itself (autoupdate.ts:378-383). Then pass `inheritFrom(other)` to `planFlip`.
  - For a base target, `inherited` is never called (`layer.local` is false). Say so in a short comment, or pass `inheritFrom({ status: "absent" })` when `!local` (a literal of the `absent` arm, config-io.ts:113).
  - Orchestrated mode now also reads `other`. That is harmless: `loadConfig` never throws [VERIFIED: config-io.ts:117-125, "NEVER throws on missing, malformed, or schema-invalid input"].
- Leave `writeFlipPlan` unchanged. It still writes `{ autoupdate: enable }` only to the layers in `plan.writes` (autoupdate.ts:347-364).

**Why the lazy callback, not a pre-computed per-layer field:** D-05 lets the planner choose between reading the base always and reading it only when needed. The design above reads the base always (one cheap `loadConfig`), but **fails** only when a valueless local entry needs it. An `--local` flip over local entries that all carry explicit values still succeeds when the base is broken. That matches D-05's wording: "When the inherited value is needed and the base config is invalid, the flip fails".

**Failure rendering (verified by code path, no change needed):** the `invalidConfigError` thrown inside planning is raised under `withLockedStateTransaction`, before any write. `flipScopes` catches it as a non-refusal, non-NotFound error and builds `scopeFailure` → reason `"invalid manifest"` [VERIFIED: autoupdate.ts:215-229, 510-515]. Expected bytes:
- Named form: like the existing CFG-03 test at autoupdate.test.ts:1247-1284, with `'    cause: Config file "claude-plugins.json" failed schema validation.'`.
- Nameless form: like the existing test at :1456-1491, with `⊘ (unknown) [project] (failed)` and the tally `Marketplace autoupdate: 2 failures`.

### Pattern 2: Omit the scope on an unscoped named miss (D-08)

Today [VERIFIED: autoupdate.ts:561-567]:

```ts
  const missScope = opts.scope ?? "project";
  notify(opts.ctx, opts.run, {
    kind: "marketplace-not-added",
    name,
    scope: missScope,
    ...(await crossScopeFlag({ cwd: opts.cwd, marketplace: name, scope: opts.scope })),
  });
```

The message type already makes the scope optional [VERIFIED: shared/notification-types.ts:1086-1091, `readonly scope?: Scope;` and `readonly presentInOtherScope?: boolean;`]. `crossScopeFlag` already returns `{}` when `scope` is `undefined` [VERIFIED: orchestrators/marketplace/shared.ts:946-962]. `remove`/`update` already emit the scopeless form through `resolveScopeOrNotifyNotAdded`: `notify(opts.ctx, opts.run, { kind: "marketplace-not-added", name: opts.name });` [VERIFIED: shared.ts:733-735]. Replace the field with the house conditional spread, the same idiom the edge handler uses (`...(parsed.scope !== undefined && { scope: parsed.scope })`, edge/handlers/marketplace/autoupdate.ts:58):

```ts
  notify(opts.ctx, opts.run, {
    kind: "marketplace-not-added",
    name,
    ...(opts.scope !== undefined && { scope: opts.scope }),
    ...(await crossScopeFlag({ cwd: opts.cwd, marketplace: name, scope: opts.scope })),
  });
```

Then update the JSDoc above `notifyNamedMiss` (autoupdate.ts:538-544). Its text "the bracket names the first one in SC-6 order: project" becomes wrong. Refusal reporting (`const [refusal] = refusals`) stays (D-08 "Unchanged").

### Pattern 3: Test-first RED evidence (D-06, Phase 6 precedent)

Phase 6 recorded the failing run as `.planning/phases/06-marketplace-update-and-c-10-fix/06-01-RED.json`. The file holds `command`, `exitCode`, `output` (junit XML), `targetTest`, `targetFile`, `expected`, `actual`, `semanticAssessment`, `nodeVersion`, `baseCommit`, and `diff` [VERIFIED: 06-01-RED.json]. Its command was:

```bash
npm run --silent test:cucumber -- features/marketplace/file-source-update.feature --parallel 1 \
  --name '^An external manifest is refreshed from its original file$' \
  --format summary --format junit:/tmp/06-01-tracer-red.xml
```

For Phase 7, use one RED file for each production change (D-02/D-03, D-04, D-08), or one per plan. Each file shows that the new scenario fails on the pre-fix commit at the decision's assertion, then passes after the fix. `--name` is a regular expression, so anchor it with `^…$`.

### Anti-Patterns to Avoid

- **Pre-computing the inherited value eagerly for every name:** that fails a `--local` flip whose local entries all carry explicit values when the base is broken. Keep it lazy.
- **Reading the merged view (`loadMergedScopeConfig`) to decide "already":** the merge treats an invalid arm as empty (config-merge.ts:23-25). That would silently inherit "off" from a broken base, which D-05 forbids.
- **Changing `writeFlipPlan` or the patch shape:** D-04 changes only *which* layers are stale. The batched `{ autoupdate }`-only patch stays.
- **Putting `scope: undefined` in the message literal:** this fails under `exactOptionalPropertyTypes`. Use the conditional spread.
- **A two-variant Outline:** an Outline needs three or more variants (features.md). AU-08 for the two verbs is either two scenarios or one.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Reading the base config tolerantly | A custom `readFile`+`JSON.parse` | `loadConfig` (returns `absent`/`invalid`/`valid`) | Already the CFG-03 trichotomy; never throws |
| Basename-only invalid-config error | A new error message | `invalidConfigError(path.basename(...))` (autoupdate.ts:274-276) | The byte form is pinned by existing tests |
| Own-key membership | `in` / bracket access | `ownValue(...)` | Guards `__proto__`/`constructor` names (test :1730) |
| Cross-scope reason | Manual state probe | `crossScopeFlag` | Never throws; returns `{}` with no scope |
| New config-corruption step | Writing configs in a new `Given` | Unit tests for D-05 (see Open Question 1) | steps.md allows exactly one config-writing step |

## Runtime State Inventory

This is not a rename or migration phase. The behavior change affects only how future flips decide. Configs that earlier flips wrote stay as they are:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing user `claude-plugins.local.json` files may hold an explicit `autoupdate` that an older flip wrote (the old "always writes" rule). It is still a valid explicit override, judged by its own value (D-03 last bullet). | None. No migration; mention it in CHANGELOG only if wanted |
| Live service config | None. No external service holds autoupdate state | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None | None |

## Common Pitfalls

### Pitfall 1: The write-failure unit test silently stops failing

**What goes wrong:** `D-06: an unnamed flip whose local write fails reports the marketplaces the base write already flipped` (autoupdate.test.ts:1050-1108) seeds the local `mp` entry **without a value** (`'{"schemaVersion":1,"marketplaces":{"mp":{"source":"./src"}}}\n'`), and the base declares `mp`. Under D-04 the local entry is no longer stale, so no local write happens and the expected failure never occurs.
**How to avoid:** Seed the local entry with an explicit value opposite to the request (`"autoupdate":false` with `enable: true`). The local write then still runs and still hits the symlink refusal. Update the expected unchanged `localTarget` bytes to match. This test is the only coverage of `writeFlipPlan`'s `done` computation (autoupdate.ts:356-358), so losing it breaks 100% direct coverage.

### Pitfall 2: `D-09: an unnamed --local flip changes only the local config …` flips to "already"

**What goes wrong:** autoupdate.test.ts:1622-1663 seeds base `mp: { source: "./src" }` (off) and local `mp: { source: "./src" }`, then runs `noautoupdate --local`. Under D-02 the local entry inherits off, so the result is `{already no autoupdate}`, and the test's expected write of `"autoupdate": false` fails.
**How to avoid:** Seed base `mp` with `autoupdate: true`. That keeps the test's point (only the local file changes, and `extras` gets no row).

### Pitfall 3: The catalog byte total

**What goes wrong:** `catalog-contract.test.ts` sums the UTF-8 bytes of every catalog example and compares the sum to `EXPECTED_UTF8_BYTES = 46_633` [VERIFIED: catalog-contract.test.ts:22, 281-284]. Dropping `[project] ` (10 bytes) from S2 changes the total.
**How to avoid:** Change the S2 code block (output-catalog.md:4489), the fixture (fixtures/marketplace-autoupdate.ts:93-101, remove `scope: "project"`), and the constant to `46_623` together. Then run `node --test tests/architecture/catalog-uat/catalog-contract.test.ts`. Recompute the constant from the failure message if the arithmetic is off.

### Pitfall 4: Probe or RED scenarios that only fail by accident

**What goes wrong:** A scenario can fail on today's code for an unrelated reason, such as a missing tally field.
**How to avoid:** Read the RED diff (Phase 6 recorded `semanticAssessment`). In this session's probes, the D-03 RED diff is exactly `'autoupdate disabled'` vs `'skipped', 'already no autoupdate'`, and the D-08 RED diff is exactly the extra `['scope','project']` row.

### Pitfall 5: Named flips carry no tally; nameless flips do

**What goes wrong:** Stating the wrong `the result has these fields:` set. The step compares **all** fields (`namesLike` appends unstated ones, command.steps.ts:124-129).
**Observed (probes):**
- A named flip, even with two rows (AU-09), has only `kind`/`severity`/`needs reload`.
- A non-empty nameless flip adds `tally label` `Marketplace autoupdate` (or `Marketplace noautoupdate`), `tally failures`, `tally warnings`, and `tally success count`.
- An empty nameless flip has no tally.

### Pitfall 6: `Given the user has run` requires severity `info`

`Given the user has run {string}` asserts `payload.severity === "info"` and exactly one cascade [VERIFIED: command.steps.ts:101-104; pi-commands.ts:87-95]. Setup flips are fine. A setup that fails cannot be a `Given`.

## Code Examples

### D-01 / AU-06 scenario layout that separates the three orderings (probe P7, passes today)

The CONTEXT example "`zeta` on and then `alpha` off" alone gives `alpha, zeta`. That is also alphabetical order, so add a third project marketplace:

```gherkin
  # Insertion: project zeta(on), alpha(off), mid(on); user yankee(on), bravo(off)
  # Grouped (expected): alpha, zeta, mid | bravo, yankee
  # Alphabetical would be: alpha, mid, zeta | bravo, yankee   (differs in project)
  # Insertion would be:    zeta, alpha, mid | yankee, bravo   (differs in both)
    When the user runs "/claude:plugin marketplace autoupdate"
    Then the result has these fields:
      | kind                | cascade                |
      | severity            | info                   |
      | needs reload        | false                  |
      | tally label         | Marketplace autoupdate |
      | tally failures      | 0                      |
      | tally warnings      | 0                      |
      | tally success count | 5                      |
    Then the result lists these marketplaces:
      | name   | scope   | status             | reasons            |
      | alpha  | project | autoupdate enabled |                    |
      | zeta   | project | skipped            | already autoupdate |
      | mid    | project | skipped            | already autoupdate |
      | bravo  | user    | autoupdate enabled |                    |
      | yankee | user    | skipped            | already autoupdate |
```

Add `the "claude-plugins.json" file of the project scope declares these marketplaces:` and the user-scope equivalent, each with `autoupdate true` on every row. This makes the scenario prove AU-06 ("applies to every marketplace") and not only the order.

### AU-07 empty result (probe P1, passes today)

```gherkin
  Scenario: Enabling autoupdate for every marketplace with none added reports an empty result
    When the user runs "/claude:plugin marketplace autoupdate"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists no marketplaces
```

Optionally add `Then the "claude-plugins.json" file of the project scope does not exist` (and user), as update.feature:185-192 does.

### AU-08 / D-08 RED (probe P2 fails today on the extra `scope project`)

```gherkin
  Scenario: Enabling autoupdate for a marketplace neither scope holds fails as not added without a scope
    When the user runs "/claude:plugin marketplace autoupdate tools"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | reasons      | marketplace not added               |
```

Mirrors update.feature:232-242 and info.feature:71-79. Consider seeding an unrelated marketplace (`other`) as update.feature does, so "nothing added" is not the only path. Seeding `tools` in the **user** state only is not possible through public steps, because every add declares it in a config.

### D-07 scoped miss (probe P9, passes today), as an Outline over 4 variants

```gherkin
  Scenario Outline: A flip with a scope that does not hold the marketplace reports the other scope
    Given the marketplace "tools" is published as a dir source
    Given the marketplace "tools" is added to the <added scope> scope
    When the user runs "/claude:plugin marketplace <verb> tools --scope <requested scope>"
    Then the result has these fields:
      | kind         | marketplace-not-added               |
      | severity     | error                               |
      | needs reload | false                               |
      | summary      | A marketplace operation has failed. |
      | name         | tools                               |
      | scope        | <requested scope>                   |
      | reasons      | <reasons>                           |
    Then the "claude-plugins.json" file of the <added scope> scope declares these marketplaces:
      | name  | source                    |
      | tools | {home}/marketplaces/tools |
    Then the "claude-plugins.json" file of the <requested scope> scope does not exist

    Examples:
      | verb         | added scope | requested scope | reasons                                |
      | autoupdate   | project     | user            | marketplace not added to user scope    |
      | noautoupdate | project     | user            | marketplace not added to user scope    |
      | autoupdate   | user        | project         | marketplace not added to project scope |
      | noautoupdate | user        | project         | marketplace not added to project scope |
```

This Outline has no `source kind` column and no tagged block, which update.feature:212-230 shows is allowed. Note: the `does not exist` step on the requested scope relies on no session start creating that file. Probe P9 confirmed it for the user scope.

### AU-03 source-kind Outline

Type the add yourself, as info.feature:12 does, so `<source>` drives both the command and the config table:

```gherkin
  Scenario Outline: A newly added marketplace has autoupdate off
    Given the marketplace "tools" is published as a <source kind> source
    Given the user has run "/claude:plugin marketplace add <source> --scope project"
    When the user runs "/claude:plugin marketplace noautoupdate tools --scope project"
    Then the result has these fields:
      | kind         | cascade |
      | severity     | info    |
      | needs reload | false   |
    Then the result lists these marketplaces:
      | name  | scope   | status  | reasons               |
      | tools | project | skipped | already no autoupdate |
    Then the "claude-plugins.json" file of the project scope declares these marketplaces:
      | name  | source   |
      | tools | <source> |

    Examples:
      | source kind | source                                                    |
      | dir         | {home}/marketplaces/tools                                 |
      | file        | {home}/marketplaces/tools/.claude-plugin/marketplace.json |

    @url
    Examples:
      | source kind | source                            |
      | url         | https://{git host}/acme/tools.git |

    @github
    Examples:
      | source kind | source     |
      | github      | acme/tools |
```

The source cells are copied from add.feature:20-33 [VERIFIED]. The config table without an `autoupdate` column fails if the flip writes `false`, because `compareDeclarations` compares whole entries (config.steps.ts:107-115, field-rows.ts:90-96).

### D-03 / D-04 RED scenarios (fail on today's code)

- **D-03a** (probe P3 fails today with `autoupdate disabled`): `Given … published as a dir source`, `Given the user has run "/claude:plugin marketplace add {home}/marketplaces/tools --scope project --local"`, `When … noautoupdate tools --scope project --local` → `skipped` / `already no autoupdate`. Then the local config declares `| name | source |` only, and `the "claude-plugins.json" file of the project scope does not exist`.
- **D-03b:** the base is added (no value) and the local is added with `--local` (no value), then `noautoupdate tools --scope project --local` → `already no autoupdate`. Both configs keep `| name | source |`.
- **D-03c:** the base is added, `Given … autoupdate tools --scope project`, the local is added with `--local`, then `When … autoupdate tools --scope project --local` → `already autoupdate`, and the local config keeps `| name | source |`. Today it writes `true` and reports `autoupdate enabled` (by code: autoupdate.ts:299-300 returns false for a local layer, so the entry is stale).
- **D-03 override (already pinned):** autoupdate.feature:109-127, "Disabling autoupdate with --local writes the setting to the local config only", covers "base on, local none → writes explicit `false`". It keeps passing (inherited `true` ≠ `false` → stale).
- **D-04 (rewrite autoupdate.feature:82-107):** change the last table to `| name | source |` / `| tools | {home}/marketplaces/tools |` and the title, for example to "Enabling autoupdate for every marketplace sets the base config and leaves a valueless local entry to inherit it". The rows and the base-config table stay unchanged. Today the local entry gains `autoupdate true`, so the table fails.

## Scenario inventory and step coverage

Every scenario above uses existing steps only:

| Step | Defined at |
|------|-----------|
| `the marketplace {string} is published as a {source kind} source` | marketplace/publishing.steps.ts:46-57 |
| `the marketplace {string} is added to the {word} scope` (`--scope`, no `--local`) | publishing.steps.ts:104-114 |
| `the user has run {string}` / `the user runs {string}` | command.steps.ts:101-122 |
| `the result has these fields:` / `the result lists these marketplaces:` / `the result lists no marketplaces` | command.steps.ts:124-158 |
| `the {string} file of the {word} scope declares these marketplaces:` / `does not exist` / `declares no marketplaces` | config.steps.ts:133-168 |
| `the user has started a new pi session` | session.steps.ts:20-22 |
| `the marketplace info result has these fields:` | marketplace/info.steps.ts:51-61 |

**No `autoupdate.steps.ts` is needed.** Creating one with no step would also break the layout rules. AU-05 (probe P6, passes today) uses the full info table form of info.feature:7-25. With no manifest description, the `description` row is left out: P6 passed without it.

**Existing scenarios that already cover parts of AU-0x (avoid duplicates):**
- list.feature:14-54 shows `details autoupdate true` per scope in `list`, but not across a new session.
- info.feature:103-119 shows `details autoupdate true` in an info cascade.
- autoupdate.feature:62-80 covers an AU-09 variant: an unscoped named flip where the project's local-only layer produces no row.
- add.feature:175-193 shows `details autoupdate false` after a new session. That is the default, so it cannot prove AU-05 persistence.

**AU-05 recommendation:** two scenarios, "An enabled autoupdate shows in the list of a new session" and "… in the info of a new session". Each one: add, `Given the user has run "… autoupdate tools --scope project"`, `Given the user has started a new pi session`, then `When` list/info → `true`. Splitting keeps one `When` per scenario (features.md "One scenario proves one behavior").

**`npm run check:features` rules to respect:** tags appear only on `Examples:`. A tagged block must have a `source kind` column whose kind fits the tag. The untagged block holds only `dir`/`file`. All steps are lower case after the keyword. `Given` steps come before the first `When`. No `And`/`But`. Columns are aligned.

## Tests and docs that pin today's rules (complete list)

| File:line | Test / passage | Decision | Required edit |
|-----------|----------------|----------|---------------|
| tests/orchestrators/marketplace/autoupdate.test.ts:495-517 | reports a named marketplace absent from both implicit scopes | D-08 | message → `⊘ missing-mp (failed) {marketplace not added}` |
| :544-593 | LAYER-02: a local flip writes an explicit value into a local entry that has none | D-02/D-03 | Becomes "already no autoupdate", local bytes unchanged. Add a companion case: base `autoupdate: true` + local none + disable `--local` → writes explicit `false` |
| :1050-1108 | D-06: an unnamed flip whose local write fails … | D-04 | **Not in CONTEXT.** Seed local `mp` with `"autoupdate":false` so the local write still happens (Pitfall 1) |
| :1192-1216 | SCOPE-01: an unscoped flip both scopes miss names no other scope … | D-08 | message → `⊘ mp (failed) {marketplace not added}`; retitle away from "names no other scope" if desired |
| :1493-1565 | D-06: an unnamed flip sets the value in every layer that declares each marketplace | D-04 | expected local `tools` entry without `autoupdate` |
| :1569-1620 (`baseOnUnnamedCases`, test at :1587) | first case "writes the explicit value into a local entry that has none" | D-04 | message `● mp [project] <autoupdate> {already autoupdate}\n\nMarketplace autoupdate: 1 success`, local unchanged; retitle |
| :1622-1663 | D-09: an unnamed --local flip changes only the local config … | D-02 | **Not in CONTEXT.** Seed base `mp` `autoupdate: true` (Pitfall 2) |
| :1701-1728 | D-09: an unnamed --local flip reads only the local config | D-05 | Replace with (a) local explicit value + malformed base → succeeds, base untouched; (b) local valueless + malformed base → `{invalid manifest}` naming `claude-plugins.json`, nothing written. Add (c) a named `--local` variant of (b) |
| tests/integration/marketplace-layer-autoupdate.test.ts:258-281 | D-07: the list reads the value both layers carry, then the local override | D-04 | `afterEnable` becomes `{ base: true, local: undefined, listed: true }`; the notifications and `afterOverride` are unchanged |
| tests/architecture/cross-op-convergence.test.ts:28-34, 264-282 | header "SCOPE-BRACKET ASYMMETRY" + `OPS_BARE` comment | D-08 | Add `"autoupdate"` to `OPS_BARE`; keep it in `OPS_EXPLICIT_SCOPE`; rewrite both comments (install stays the only explicit-only op) |
| tests/architecture/catalog-uat/fixtures/marketplace-autoupdate.ts:90-101 | `autoupdate-missing-not-added-bare` | D-08 | Drop `scope: "project"`; fix the comment |
| tests/architecture/catalog-uat/catalog-contract.test.ts:22 | `EXPECTED_UTF8_BYTES = 46_633` | D-08 | `46_623` (Pitfall 3) |
| docs/output-catalog.md:4467 | "Config files" paragraph: "`{already autoupdate}` means that layer already has the value … A flip without a name changes every config that declares each marketplace" | D-02/D-04 | State the inherited value and the D-04 "valueless local entry is not written" rule |
| docs/output-catalog.md:4485-4491 | S2 prose + block `⊘ missing-mp [project] (failed) {marketplace not added}` | D-08 | No bracket; prose matches remove/info/update ("absent from both scopes carries no bracket") |
| features/marketplace/autoupdate.feature:82-107 | "Enabling autoupdate for every marketplace sets it in each config that declares the marketplace" | D-04 | Rewrite (see above) |
| autoupdate.ts:122-131, 291-296, 427-433, 538-544 | `AutoupdateOptions.local` doc ("The base config is NEVER touched on the --local path"), `layerAlreadySet` doc, `planEveryFlip` doc ("with `--local` only `claude-plugins.local.json` is read and written"), `notifyNamedMiss` doc | D-02..D-05, D-08 | Make the docs say "never written" (the base is now read), and describe inheritance and the scopeless miss |
| README.md:182, README.es.md:180 | "without a name set the value in every config that declares each marketplace" | D-04 | A valueless local entry inherits the new base value; keep the two READMEs in sync (`readme` skill) |
| CHANGELOG.md `[Unreleased]` layer bullet (sub-bullet "Without a name, `autoupdate` and `noautoupdate` set the value …") | from this branch | D-02..D-04, D-08 | Amend this branch's existing bullet (one entry per PR, `changelog` skill) rather than adding a new top-level bullet |

**Checked, no change needed:**
- `docs/json-output.md:326-340`: `scope` is already `optional`, "Selected scope when specified".
- edge handler tests: they pin no not-added bytes.
- `tests/architecture/config-state-consistency.test.ts`: base-layer flips only.
- `bootstrap.test.ts`: a base-layer named flip with `scope: "user"`. D-02 changes only local-layer judgement, and D-08 only the unscoped case.
- The autoupdate.feature scenarios at lines 7, 28, 45, 62, 109, 129, 148, and 166, and list.feature:56. They keep passing (inherited value reasoning in the D-03 notes).

## Question 2: other callers of the old "always writes" rule

- `setMarketplaceAutoupdate` has exactly two production callers: `edge/handlers/marketplace/autoupdate.ts:52` and `orchestrators/plugin/bootstrap.ts:126` [VERIFIED: grep of extensions/ plus reading both]. Bootstrap passes `scope: "user"`, `enable: true`, and no `local`. It is a base-target flip, so its judgement is unchanged (`layer.local` false). D-08 does not apply because the scope is explicit.
- No reconcile code calls the flip. `orchestrators/reconcile/*` mentions autoupdate only in comments and in the notify vocabulary. `migrateFirstRunConfig` runs only when the config is absent (apply.ts:211-229). So **orchestrated mode has no production caller today**. Only unit tests exercise it (autoupdate.test.ts:595-700).
- `list.ts:108`, `scope-fanout.ts:91` (info), `update.ts:489`, and `plugin/list-flow.ts:675,702` all read `ownValue(merged.marketplaces, name)?.entry.autoupdate ?? false`. The merged value is `{ ...baseEntry, ...localEntry }` (config-merge.ts:99-101), so a valueless local entry already shows the base value. D-02 aligns the flip's "already" with what `list`/`info` show. No reader changes.
- A new Pi session runs reconcile. Reconcile never writes the autoupdate config: orchestrated adds skip write-back (add.ts:443-445), and migration is first-run only. So AU-05 sees exactly the bytes the flip wrote. Probe P6 confirmed that info shows `true` after `new_session`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| A valueless local entry is "no value"; a flip always writes it (3.2 research rule) | It inherits the base value or off; written only when the effective value changes | This phase (D-02..D-04) | Fewer redundant per-machine overrides; `{already …}` agrees with `list` |
| Unscoped named miss names `[project]` (ATTR-05 S2) | No scope, like remove/info/update | This phase (D-08) | Catalog S2 bytes and JSON `scope` field change |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Flagless add" in CONTEXT's AU-03 bullet means an add without `--local`, not an add without `--scope` | Code Examples (AU-03) | Low. Using `--scope project` matches add.feature. If the user meant no flags at all, change the scope to the default `user` (add.feature:35-39 shows the default) |
| A2 | The D-03c failure on today's code (base on, local valueless, `autoupdate --local` → `autoupdate enabled`) | D-03 RED | Low. Derived from reading autoupdate.ts:297-304, not run as a probe |
| A3 | `EXPECTED_UTF8_BYTES` becomes `46_623` | Pitfall 3 | Low. Arithmetic on a 10-byte removal; the failing test prints the real total |

## Open Questions

1. **D-05 has no behavioral scenario.**
   - What we know: no step can make a config invalid. steps.md says the config steps "never write them, with one exception" (the plugins-member writer). 3.2 D-08 asked the planner to flag behaviors that only unit tests can reach. D-06 requires scenarios for D-02 to D-04 only.
   - Recommendation: cover D-05 with paired unit tests (named and nameless `--local`, base malformed, valueless vs explicit local entry). Flag the gap in the plan so the orchestrator can confirm. Adding a config-corruption step would need a steps.md rule change, which is out of this phase's scope.
2. **AU-08 for both verbs?**
   - What we know: both verbs share `notifyNamedMiss`, and an Outline needs 3+ variants.
   - Recommendation: two short scenarios (`autoupdate tools`, `noautoupdate tools`), because D-08 names both verbs.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | all checks | ✓ | v26.11.1 (engines `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0`) | CI runs Node 24 |
| `node_modules` incl. `@cucumber/cucumber` | `test:cucumber`, `check:features` | ✓ | per lockfile | — |
| Headless Pi (`@earendil-works/pi-coding-agent` dev dep) | cucumber driver | ✓ | the autoupdate feature ran green | — |

Measured on this tree (2026-10-19):
- `npx cucumber-js features/marketplace/autoupdate.feature`: 9 scenarios, 4.7 s wall.
- `npm run test:cucumber` (full): 208 scenarios / 2258 steps, 8.6 s wall.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`: green, 4.9 s, quiet on success.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `@cucumber/cucumber` ^13.3.0 (scenarios); `node:test` (unit, integration, architecture) |
| Config file | `cucumber.json` (`tags: "not @url and not @github"`, `parallel: 8`, `order: random`) |
| Quick run command | `npx cucumber-js features/marketplace/autoupdate.feature` (about 5 s) |
| One scenario | `npm run --silent test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^<title>$'` |
| Paired unit coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` |
| One unit test | `node --test --test-name-pattern '<title>' tests/orchestrators/marketplace/autoupdate.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements → Test Map

| Req / Decision | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AU-01 | named `autoupdate` → `autoupdate enabled`, base `true` | cucumber | quick run | ❌ new scenario |
| AU-02 | named `autoupdate` twice → `skipped`/`already autoupdate` | cucumber | quick run | ❌ new scenario |
| AU-03 | new marketplace off: Outline dir/file (+@url/@github rows) | cucumber Outline | quick run + `npm run check:features` (dry-runs the tagged rows) | ❌ new scenario |
| AU-04 | named `noautoupdate` → `autoupdate disabled`, base `false` | cucumber | quick run | ❌ new scenario |
| AU-05 | `true` in `list` and `info` after a new session | cucumber ×2 | quick run | ❌ new scenarios |
| AU-06 + D-01 | nameless flip over both scopes, changed-first grouping, configs | cucumber | quick run | ❌ new scenario (passes today, pin) |
| AU-07 | nameless flip with nothing added → empty | cucumber | quick run | ❌ new scenario (passes today, pin) |
| AU-08 + D-08 | unscoped miss, no `scope` | cucumber (RED first) + unit :495, :1192 + architecture cross-op + catalog | quick run; `node --test tests/architecture/cross-op-convergence.test.ts tests/architecture/catalog-uat/catalog-contract.test.ts tests/architecture/catalog-uat/catalog-wire.test.ts` | ❌ scenario; unit/arch edits |
| AU-09 | unscoped named, both scopes, each judged on its own | cucumber | quick run | ❌ new scenario (passes today, pin) |
| D-02/D-03 | valueless local entry judged by its inherited value | cucumber RED ×3 (D-03a/b/c) + unit :544 (+ companion) + :1622 | quick run; paired coverage | ❌ scenarios; unit edits |
| D-04 | flagless nameless flip leaves a valueless local entry | cucumber RED (rewrite :82) + unit :1493, :1587, :1050 + integration :258 | quick run; paired coverage; `node --test tests/integration/marketplace-layer-autoupdate.test.ts` | ✅ rewrite |
| D-05 | invalid base fails closed only when needed | unit only (Open Question 1) | paired coverage | ❌ unit cases |
| D-07 | scoped misses, both verbs, both directions, configs unchanged | cucumber Outline (4 rows) | quick run | ❌ new Outline (passes today, pin) |

### Sampling Rate

- **Per task commit:** the pre-commit hook runs `npm run check:commit` (static + unpaired + staged-pair coverage). Also run the quick cucumber command for the feature file: `check:commit` does **not** run cucumber.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green on the combined tree before `/gsd-verify-work`.

### Wave 0 Gaps

None. The existing infrastructure covers every requirement. No new step, support, or lib module is needed.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | `loadConfig` typebox validation (CFG-03); `ownValue` own-key reads (`__proto__`/`constructor` names) |
| V6 Cryptography | no | — |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Guessing the inherited value from a corrupt base config | Tampering | D-05 fail-closed `{invalid manifest}` before any write |
| Path disclosure in the error | Information disclosure | `invalidConfigError(path.basename(...))`, basename only (T-56-02-05) |
| Writing outside the scope | Tampering | Unchanged: `writeBatchedConfigEntries(…, scopeRoot, …)` containment |

## Sources

### Primary (HIGH confidence, read this session)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` (whole file)
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:724-1078` (`resolveScopeOrNotifyNotAdded`, `crossScopeFlag`, `marketplaceLayerVerdict`)
- `extensions/pi-claude-marketplace/persistence/config-io.ts:95-164`, `config-merge.ts:1-118`
- `extensions/pi-claude-marketplace/shared/notification-types.ts:1086-1091`
- `orchestrators/plugin/bootstrap.ts`, `edge/handlers/marketplace/autoupdate.ts`, `orchestrators/marketplace/list.ts:75-130`, `scope-fanout.ts:91`, `add.ts:420-468`, `reconcile/apply.ts:205-230`
- `tests/orchestrators/marketplace/autoupdate.test.ts`, `tests/integration/marketplace-layer-autoupdate.test.ts`, `tests/architecture/cross-op-convergence.test.ts`, `tests/architecture/catalog-uat/{catalog-contract.test.ts, fixtures/marketplace-autoupdate.ts, catalog-wire.test.ts}`
- `features/marketplace/{autoupdate,add,info,list,remove,update}.feature`, `features/step_definitions/{command,config,session}.steps.ts`, `features/step_definitions/marketplace/{info,publishing}.steps.ts`, `features/lib/{field-rows,layer-config,pi-commands,marketplace-info-fields}.ts`, `cucumber.json`, `scripts/check-features.mjs` (header)
- `.agents/skills/{cucumber,local-verification,typescript-unit-tests,typescript-style,committing,changelog}`
- `.planning/phases/06-marketplace-update-and-c-10-fix/06-01-RED.json`, `06-01-SUMMARY.md`
- Probe runs P1-P9 of the real suite (scratch feature outside `features/`, not committed)

### Secondary / Tertiary
- None. No external source was needed. CONTEXT.md carries the upstream evidence record (Claude Code 2.1.296), and this research found no gap in it.

## Metadata

**Confidence breakdown:**
- Production change shape: HIGH. Every touched function was read, and the failure path was traced through existing tests.
- Scenario inventory and payload shapes: HIGH. Observed by running probes against today's code.
- Pitfalls and pinned-test list: HIGH. Each test was read; two were found that CONTEXT does not list.

**Research date:** 2026-10-19
**Valid until:** until `autoupdate.ts`, `config.steps.ts`, or the cucumber rules change (stable, about 30 days)
