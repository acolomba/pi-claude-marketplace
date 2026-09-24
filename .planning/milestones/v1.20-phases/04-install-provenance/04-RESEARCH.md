# Phase 4: Install provenance - Research

**Researched:** 2026-09-15
**Domain:** Persisted-schema evolution (typebox + migrate fill) and reconcile-diff correctness in a
TypeScript Pi extension
**Confidence:** HIGH for the code census, the schema blast radius and the complexity budget (all
measured by probe this session). MEDIUM for the plan shape. **LOW / BLOCKED for PROV-03** — see
Open Question 1, which must be answered before planning.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-04-01: Provenance stores the MODE ONLY — `"explicit" | "dependency"`.** No declaring-plugin
  list, no back-reference of any kind. A stored declarer list is a cache of another plugin's
  manifest: it drifts whenever any plugin is installed, updated or uninstalled, and nothing would
  keep it honest. `--prune` instead re-derives "does anything still need this?" at prune time by
  reading the installed plugins' declarations offline (the Phase 1 `domain/dependencies.ts` read).
  Deriving on demand cannot go stale.
  — **Reversibility:** cheap to extend later (a declarer list could be added as an optional additive
  field), costly to retract once written.

- **D-04-02: The desired-state config holds ONLY explicitly-requested plugins.** Cascade-installed
  dependencies are NOT written to `claude-plugins.json` or its `.local.json` overlay. Operator
  decision, 2026-09-15: *"don't write dependencies to config... the desired state configuration only
  contains explicit plugins."* Dependencies are already derivable from the marketplace records plus
  the declaring plugins' manifests, so the config write bought nothing that provenance does not buy
  more honestly.

  This REVERSES the shape of Phase 3's CR-01 fix — both arms at
  `orchestrators/plugin/install-flow.ts:1340-1365`: the `dependencyPluginPatches` arm and the
  `writeOrchestratedDeclarations` call's `dependencyKeys` argument. Phase 3's own artifacts
  (SUMMARY, REVIEW, REVIEW-FIX, VERIFICATION) all describe that write as the correct fix. It IS
  correct as a mechanism — it works, and its tests prove it works. It is the wrong design. **Those
  artifacts do not settle this question; this decision supersedes them.**
  — **Reversibility:** one-way in practice — Phase 5's `--prune` is built on the separation this
  restores.

- **D-04-03: schemaVersion 2 → 3. The field is REQUIRED at v3. Absence is filled with
  `"explicit"`, and the upgrade is SILENT.** No released version through v0.18.3 had a dependency
  cascade, so every record written by a released build genuinely IS explicit — the default is
  truthful, not a guess. Records Phase 3 wrote on development trees are mislabelled; the ROADMAP
  already accepted that cost ("lands on development trees only, and this milestone releases as a
  single version").

  The mechanism is the `enabled` precedent exactly: `persistence/migrate.ts::ensurePluginEnabled`
  fills an absent required field with its truthful default BEFORE `STATE_VALIDATOR.Check` runs, and
  says nothing. Mirror it — same iteration shape, same mutated-flag discipline, same "only an ABSENT
  field is filled; a present-but-wrong value is left for the validator to reject with an actionable
  error."
  — **Reversibility:** costly — a shipped schemaVersion is on users' disks.

- **D-04-04: The whole reversal lands in Phase 4, in a fixed three-step order.** Phase 3 stays
  closed and verified; its config write is treated as a bridge that Phase 4 retires rather than a
  defect that reopens the phase.

  **The order is part of the contract:**

  1. The provenance field exists and every install path writes it.
  2. `buildUninstallBucket` skips records with `provenance: "dependency"`.
  3. Only then, remove the config write.

  **Any plan that reorders these is wrong.** The config write is currently the ONLY thing stopping
  `buildUninstallBucket` from sweeping cascade dependencies on the next `resources_discover`.
  Removing it before step 2 lands re-opens CR-01 — a blocker-severity data-loss defect where a
  user's dependencies silently vanish on reload. Step 3 must not land in an earlier execution wave
  than step 2.

  CR-01's regression test stays honest across all three steps: it asserts that a cascade-installed
  dependency survives a reload, which remains true throughout — first via the config write, then via
  provenance.

  The alternatives considered and rejected: reopening Phase 3 to revert the write (leaves a window
  where dependencies ARE swept, and forces a re-verification of a phase closed at 5/5), and
  deferring the removal to Phase 5 (makes Phase 5 the largest phase in the milestone on top of
  PRUNE-01..04 and FLAG-01, and ships the conflation for a phase longer).

- **D-04-05: `buildUninstallBucket` keeps sweeping genuine orphans. Exactly one exemption is added:
  `provenance: "dependency"`.** A recorded plugin that is neither named in the merged config nor
  marked as a dependency is still uninstalled, exactly as today. This is the smallest change that
  makes the model work, and it leaves established reconcile behavior otherwise untouched.

  The alternative — keep an orphan and report it instead — is safer against an accidental hand-edit
  of `claude-plugins.json`, but it changes reconcile behavior well beyond this phase's scope and
  would need its own closed-set reason token and catalog byte form. Rejected for this phase; not
  reopened by it either.

- **D-04-06: PROV-04 is reworded, and this phase borrows nothing from MIGR-01.** As written,
  PROV-04 demands a pre-milestone record be "reported as stale rather than silently repaired" —
  which D-04-03's silent upgrade does not satisfy and is not trying to. Replacement wording:

  > **PROV-04**: an install record written before this milestone is upgraded to the current schema
  > with a truthful default, and no record is misreported as a dependency.

  The consequence: the MIGR-01 guard-wording question — the notify text and recovery command for
  "stale state, absent config" — is NOT answered in this phase. It returns to MIGR-01 in the
  backlog, intact. The ROADMAP's "Scope of the borrowed MIGR-01 answer" note is superseded, as is
  its "a required field is the staleness detector" note (a required field WITH a migrate fill is not
  a staleness detector — that is the whole point of D-04-03).

- **Derived rule, not a separate decision — Provenance is a one-way ratchet: `dependency` →
  `explicit`, never the reverse.** This is the direct consequence of PROV-02 and PROV-03 read
  together — an explicit install stays explicit when a later plugin declares it (PROV-02), and a
  dependency becomes explicit when the user installs it by name (PROV-03). Stating it as one rule is
  easier to implement correctly and easier to test than two independent transition cases. PROV-03
  also requires the upgrade touch nothing else: no other record changes.

### Claude's Discretion

- Exact field name on the install record (`provenance` is the working name used throughout this
  document and the requirements) and whether the two values are a typebox `Type.Union` of literals
  or a named enum-ish constant — follow whatever the neighbouring fields in
  `PLUGIN_INSTALL_RECORD_SCHEMA` already do.
- Where the `dependency`-exemption predicate lives relative to `buildUninstallBucket` — inline
  condition versus a named helper. The function is small and flat today; keep it under both
  cognitive-complexity ceilings.
- Whether the three-step order (D-04-04) maps to three plans or to waves within fewer plans, so long
  as step 3 never precedes step 2.
- How the provenance value is threaded from the cascade into each member's install record — the
  cascade already knows which member is the root (`rootKey`) and which are closure members.

### Deferred Ideas (OUT OF SCOPE)

- **Reporting a genuine orphan instead of sweeping it** (the rejected arm of D-04-05). It needs its
  own closed-set reason token and catalog byte form, and it changes reconcile behavior beyond this
  milestone's scope. Worth revisiting if an accidental config edit ever costs someone an install.
- **MIGR-01's staleness gate** — the notify wording and recovery command for "stale state, absent
  config", plus deleting `persistence/migrate.ts` and replacing `migrate-config.ts` with a
  loud-failure guard. D-04-06 returns the wording half to MIGR-01 rather than answering a fraction
  of it here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROV-01 | Each install record states whether the user asked for the plugin directly or it arrived as another plugin's dependency. | § Install-Record Write-Site Census — exactly **two** production record constructors and **one** clone site; one provenance-decision site (`install-flow.ts:1181`). |
| PROV-02 | A plugin the user installed directly stays marked as such even when a later install declares it as a dependency. | § PROV-02 / PROV-03 Transition Sites — satisfied **by construction**; RESV-05 members never become a ledger phase. Needs a planted test, not code. |
| PROV-03 | A plugin first installed as a dependency becomes directly-installed when the user installs it by name. | § PROV-02 / PROV-03 Transition Sites + **Open Question 1**. There is **no promotion path today** — `install <already-installed>` throws `already-installed`. This is a decision, not an implementation detail. |
| PROV-04 | An install record written before this milestone is upgraded to the current schema with a truthful default, and no record is misreported as a dependency. | § schemaVersion 2 → 3 Blast Radius — the `ensurePluginEnabled` template, plus the six `state-io.ts` sites and **four** (not three) architecture pins. |
</phase_requirements>

## Summary

The production-code footprint of this phase is small and now precisely known: **two** record
constructors, **one** clone site, **one** provenance-decision site, **one** reconcile predicate,
**one** migrate fill, and **six** `schemaVersion` literals. A falsification probe run this session
(schema field added, `tsc --noEmit`, edits reverted) produced exactly **three** production
type errors, and a full six-file probe implementation typechecked the production tree clean.

The **test** footprint is not small, and this is the finding most likely to change the plan's shape.
The same probe, carried through to a working implementation and run against the unit suite,
produced **861 failing test cases across 39 files** — against only **51** compiler diagnostics in
**31** files. The gap is a runtime one: ~765 of those failures are a single `saveState refused:
in-memory state failed schema validation ... must have required property` raised by test fixtures
that build a `PluginInstallRecord` loosely enough that `tsc` never sees the omission. The remaining
**96 failures across 20 files** are genuine byte-exact and behavioral assertions that must be
amended deliberately. Typecheck is therefore **not** a sufficient gate for this phase's fixture
work; the unit suite is.

Two further findings are load-bearing. First, **`migrateLegacyMarketplaceRecords` has one point of
cognitive-complexity headroom left under fallow**, measured: 17/14 today, 18/**15** after the
provenance fill, against a ceiling of 20/15 — and fallow's ceiling is inclusive, so the function
lands exactly on the line. ESLint's independently-computed `sonarjs/cognitive-complexity` reads the
same function at **7**, so fallow is the binding gate here and ESLint will not warn you. Second,
**the `PROV-NN` identifier family is already taken**: the shipped `url-source` milestone defined
`PROV-01..07` as *git auth **prov**ider* requirements, with 48 live citations across
`extensions/`, `tests/` and `docs/`. A source comment citing `PROV-02` today already means "a public
repo carries no auth bundle."

**Primary recommendation:** plan three waves matching D-04-04 exactly — (1) field + migrate fill +
every write site + fixture sweep, (2) `buildUninstallBucket` exemption, (3) config-write removal +
doc rewrite — and settle **Open Question 1 (PROV-03 promotion)** before writing any plan, because
its answer decides whether this phase touches the closed notification vocabulary and the output
catalog.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Provenance field declaration + validation | `persistence/` (`state-io.ts`) | — | `PLUGIN_INSTALL_RECORD_SCHEMA` is the sole validation boundary for the persisted record (its own doc comment says so). |
| Legacy back-fill of an absent provenance | `persistence/` (`migrate.ts`) | — | `migrate.ts` is the only code that runs before `STATE_VALIDATOR.Check`; ENBL-02 established the pattern. |
| Deciding a member's provenance value | `orchestrators/plugin/` (`install-flow.ts`) | — | `rootKey` vs. closure member is known only at the cascade's composition root. |
| Writing the value onto the record | `orchestrators/plugin/` (`install-outcome.ts` statePhase, `reinstall-record.ts`) | — | These are the only two producers of a whole `PluginInstallRecord`. |
| Preserving provenance across a snapshot | `persistence/` (`clonePluginRecord`) | — | Enumerating clone; lives beside the schema by design. |
| Honouring provenance during reconcile | `orchestrators/reconcile/` (`plan.ts`) | — | `buildUninstallBucket` is pure and already holds the marketplace record. |
| Deciding what the desired-state config names | `orchestrators/plugin/` (`install-flow.ts` + `shared.ts`) | `persistence/config-write-back.ts` | The write-back arms are orchestrator policy; the persistence layer is a mechanism. |

Sanity check for the planner: **nothing in this phase belongs in `bridges/`, `edge/`, `platform/`
or `transaction/`.** A task that proposes a change there is misassigned.

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md`, `./.claude/CLAUDE.md`, `.planning/codebase/CONVENTIONS.md`
and `.claude/rules/typescript-comments.md`. The planner must not recommend anything contradicting
these.

| # | Directive | Where it bites in this phase |
|---|-----------|------------------------------|
| C1 | Read a file before editing it; trace callers before modifying a function. | Every write site listed below. |
| C2 | **Never commit to `main`.** Branch names `features/*`. `.planning/config.json` sets `git.branching_strategy: "none"`, so work stays on `features/manifest`. | Execution. |
| C3 | Conventional Commits; title 5–72 chars; body lines ≤ 80; **no GSD milestone/phase mentions**. | Every commit. |
| C4 | Run `pre-commit run --all-files` **before** `git commit`; never `--no-verify`; never amend after a hook failure. | Every commit. Memory note: CI runs `--all-files`, so a scoped `--files` run hides pre-existing violations. |
| C5 | Never rebase; never rewrite history; merge only. | Execution. |
| C6 | `npm run check` must stay green. It is `typecheck && lint && lint:workflows && lint:workflows:negative && fallow && format:check && test:corresponding && test:corresponding:negative && test:coverage:direct:negative && test && test:integration`. | Phase gate. Note `lint:workflows*` — `.planning/codebase/STACK.md`'s summary of this chain omits them. |
| C7 | **Two independently-computed cognitive-complexity ceilings**: ESLint `sonarjs/cognitive-complexity: 15` AND fallow `health.maxCognitive: 15` (plus `maxCyclomatic: 20`, `maxUnitSize: 60`, `maxCrap: 0`). Passing one is not evidence about the other. | `migrateLegacyMarketplaceRecords` — see the measured budget below. |
| C8 | Comment policy: cite decision/requirement IDs (`D-04-NN`, `RESV-NN`, `ENBL-NN`); **never** `Phase N` / `Plan N` / `Wave N` / `Pitfall N` / `milestone vX.Y`; never narrate removed code (`the former X`, `X used to …`). | The comments that move with the retired config write (they currently cite "RESV-01's reload clause"). |
| C9 | All user-visible output through `ctx.ui.notify` via `shared/notification-dispatch.ts`; the REASONS set is closed and gated. | Only if Open Question 1 resolves toward a new outcome row. |
| C10 | `.fallowrc.json` zone boundaries (13 zones) — `persistence` may not import `orchestrators`, etc. | The exemption predicate must read the record `plan.ts` already holds, not import from `orchestrators/plugin/`. |
| C11 | Gate tests **plant the violation**; they never merely re-read a config object. | Every new gate assertion in this phase. |
| C12 | 1:1 source↔test pairing enforced by `scripts/check-corresponding-tests.mjs`; each pair reaches 100% function/line/branch coverage **run alone**. | Any NEW production module needs a paired test. Recommendation: create none. |
| C13 | Markdown is formatted by `mdformat` (pre-commit), **not** prettier; `format:check` covers only `js/json/ts`. | The `docs/dependency-resolution.md` and `README.md` rewrites in step 3. |

## Standard Stack

**No new dependency is required or recommended for this phase.** Every mechanism it needs already
exists in the tree.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typebox` | `^1.1.38` | Declare `provenance` as a two-literal union on `PLUGIN_INSTALL_RECORD_SCHEMA`; widen `STATE_SCHEMA.schemaVersion`. | Already the sole validation boundary for the persisted record. `[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:29-30,81,287-302]` |
| `node:test` | built-in (Node 26.8.2 locally, Node 24 in CI) | The whole test surface. | `[VERIFIED: package.json scripts, probe output]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `Type.Union([Type.Literal("explicit"), Type.Literal("dependency")])` | A named exported const tuple + `Type.Unsafe` | The neighbouring fields in `PLUGIN_INSTALL_RECORD_SCHEMA` use inline `Type.*` calls with no named constants (`enabled: Type.Boolean()`, `compatibility: Type.Object({...})`), and `MARKETPLACE_RECORD_SCHEMA.scope` already spells a two-literal union inline as `Type.Union([Type.Literal("user"), Type.Literal("project")])` `[VERIFIED: state-io.ts:264]`. D-04-01's discretion clause says "follow whatever the neighbouring fields already do" — so **inline** is the answer. |

**Installation:** none.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** No `npm install` is required; every
change is to first-party source under `extensions/pi-claude-marketplace/`, `tests/`, `docs/` and
`README.md`. No `[SLOP]` or `[SUS]` verdicts to report, and no `checkpoint:human-verify` install
gate is needed.

---

## 1. Install-Record Write-Site Census

**Method (this is why the numbers are trustworthy).** Rather than reason about where records are
built, I added the required field to the schema and let the compiler and the test runner answer.
Both probes were fully reverted; `git status --porcelain extensions/ tests/` is empty and
`tsc --noEmit` is clean as of this writing.

### 1a. What the compiler found

Probe: add `provenance: Type.Union([Type.Literal("explicit"), Type.Literal("dependency")])` to
`PLUGIN_INSTALL_RECORD_SCHEMA`, then `./node_modules/.bin/tsc --noEmit`.

```
extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts(936,7): error TS2741
extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts(128,3): error TS2741
extensions/pi-claude-marketplace/persistence/state-io.ts(149,3): error TS2741
```

`[VERIFIED: probe, 2026-09-15 — 54 diagnostics total, 3 under extensions/, 51 under tests/]`

**Exactly three production sites.** That is the complete required-field census.

### 1b. The full census, with the correct value at each site

| # | Site | file:line | Arm | Correct provenance | Compiler-caught? |
|---|------|-----------|-----|--------------------|------------------|
| 1 | `statePhase.do` — `mpInner.plugins[c.plugin] = { … }` | `orchestrators/plugin/install-outcome.ts:936-986` | **Every** install: standalone, orchestrated (reconcile + import), cascade root, cascade dependency, **and the enable re-materialization** | `existing?.provenance ?? <from options>` — see note E below | ✅ TS2741 |
| 2 | `recordReinstalledOutcome` — `marketplace.plugins[input.name] = { … }` | `orchestrators/plugin/reinstall-record.ts:128-145` | reinstall's replace step | `input.oldRecord.provenance` (carry forward, exactly as `installedAt` does at `:143`) | ✅ TS2741 |
| 3 | `clonePluginRecord` | `persistence/state-io.ts:147-179` | reinstall's before-snapshot | `record.provenance` | ✅ TS2741 |
| 4 | `toDisabledRecord` | `persistence/state-io.ts:215-224` | disable (`enable-disable.ts:450`) and install-landed-disabled (`install-disable-cascade.ts:164`) | rides through — the body is `{ ...record, enabled: false, updatedAt }` | n/a (spread) |
| 5 | `installed.updatedAt = …` | `orchestrators/plugin/enable-disable.ts:418` | disable timestamp | untouched | n/a |
| 6 | `installed.updatedAt = now()` | `orchestrators/plugin/install-disable-cascade.ts:93` | install-landed-disabled | untouched | n/a |
| 7 | `applyPerBridgeResources` + `applyAllSuccessRecordFields` + `sRecord.updatedAt = …` | `orchestrators/plugin/update-swap.ts:665-691` | update finalize | untouched — **in-place field mutation, not a rebuild** | n/a |
| 8 | `refreshDisabledRecord` — `record.version = …` etc. | `orchestrators/plugin/update-preflight.ts:439-462` | disabled-plugin update refresh | untouched — in-place | n/a |
| 9 | `applyPartialCascadeFold(installed, outcome.dropped)` | `orchestrators/plugin/install-cascade.ts:~705` | cascade rollback partial | untouched — subtracts resources only | n/a |
| 10 | `delete marketplaceRecord.plugins[member.name]` | `install-cascade.ts:712` | cascade undo | n/a (deletion) | n/a |
| 11 | `delete mp.plugins[ids.plugin]` | `orchestrators/plugin/uninstall.ts:390` | uninstall | n/a | n/a |
| 12 | `delete record.plugins[pluginName]` | `orchestrators/marketplace/remove.ts:318` | marketplace remove | n/a | n/a |

**The provenance-DECISION site is singular.** Every install — standalone, reconcile-driven, or
import-driven — routes through `install-flow.ts`'s cascade, and the per-member ledger options are
assembled at exactly one place:

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1181-1191
        ledgerOptionsFor: (member) => {
          const pinVersion =
            member.pinnedVersion ?? (member.key === rootKey ? opts.pinVersionOverride : undefined);
          return buildInstallLedgerOptions(opts, {
            scope,
            cwd,
            marketplace: member.marketplace,
            plugin: member.name,
            ...(member.pinnedOid !== undefined && { sourcePin: member.pinnedOid }),
            ...(pinVersion !== undefined && { pinVersion }),
          });
        },
```

`member.key === rootKey` is already the root/dependency discriminant in scope, so the threading
D-04-01's discretion clause asks about is a one-line addition here plus a `provenance` member on
`buildInstallLedgerOptions`'s `core` parameter (`install-flow.ts:271-289`) and on
`InstallLedgerOptions` (`install-outcome.ts:150-185`). The full probe implementation did exactly
this and the production tree typechecked clean.
`[VERIFIED: probe, 2026-09-15 — "PROD_ERRORS=0" with all six files patched]`

That the cascade runs on *every* install is stated by the suite itself:

> `runInstallCascade` runs on EVERY install, orchestrated or not, so the record is written either
> way; only the DECLARATION rode the standalone arm.
> `[VERIFIED: tests/orchestrators/plugin/install-flow.test.ts:3493-3495]`

**Note E — the enable path is the subtle one.** `enable-disable.ts::runEnableBranch` reaches the
same statePhase through `runInstallLedger` with a **hand-built** options object that does *not* go
through `buildInstallLedgerOptions`:

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:314-331
    const result = await transaction.runInstallLedger(
      state,
      locations,
      {
        ctx: opts.ctx,
        scope,
        …
        pinVersionOverride: recordedVersion,
        allowExistingRecord: true,
        partial,
        removalOps: createRemovalOps(),
      },
      capture,
    );
```

Because `allowExistingRecord: true` guarantees `existing !== undefined` in statePhase, writing
`provenance: existing?.provenance ?? <from options>` — the identical shape `installedAt` already
uses at `install-outcome.ts:984` (`installedAt: existing?.installedAt ?? nowIso`) — makes enable
preserve provenance without the enable branch having to know the field exists, and lets the options
member stay optional. This is the recommended design; the probe used it and it compiled.

**The documented `clonePluginRecord` drift hazard does NOT apply to this field.** The function's own
doc comment warns:

> a key added to `PLUGIN_INSTALL_RECORD_SCHEMA` and not added here is dropped from every snapshot
> **with no compile error** and no observable failure until a later reader wants it
> `[VERIFIED: extensions/pi-claude-marketplace/persistence/state-io.ts:137-141]`

That is true for an *optional* key (`resolvedSha`, `hookEntries`, both spread conditionally). For a
**required** key the compiler does fire — TS2741 at `state-io.ts:149`, measured above. The planner
should still add it deliberately, but should not budget a bespoke guard test for a hazard the
typechecker already covers here.

---

## 2. PROV-02 / PROV-03 Transition Sites

### PROV-02 — satisfied by construction; this is a test task, not a code task

The cascade's already-installed branch is a single, well-named code path, and it is *read-only over
the record*:

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:557-568 (doc comment)
/**
 * RESV-05: an already-installed dependency is CHECKED and never touched.
 *
 * It is not in the closure, so it never becomes a `Phase`, and no code path
 * below can reinstall it, re-pin it or re-declare it -- whether or not it
 * satisfies the constraint. …
 */
function checkInstalledMember(
```

`checkInstalledMember` reads `recordedVersionOf(state, member)` and returns either `undefined` or a
`range-conflict` failure. It performs **no** mutation. The partition itself comes from the closure
walk:

```ts
// extensions/pi-claude-marketplace/domain/dependency-closure.ts:268-269
  const isRoot = edge.key === ctx.options.rootKey;
  if (!isRoot && ctx.options.installedKeys.has(edge.key)) {
```

So PROV-02 needs **no production change**. The risk is the opposite one the project has been burned
by: a test that passes vacuously. The PROV-02 test must be written so it would FAIL if the cascade
ever started touching skipped members — install `B` explicitly, snapshot its record with
`clonePluginRecord`, install `A` (which declares `B`), then `assert.deepStrictEqual` the *whole*
post-record against the snapshot. A test that asserts only `provenance === "explicit"` would pass
against a cascade that rewrote every other field.

### PROV-03 — **no promotion path exists today.** This is Open Question 1.

`install <plugin>` where the plugin is already recorded in the target scope does not promote
anything; it fails:

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:414-419
  if (targetMp.plugins[plugin] !== undefined && opts.allowExistingRecord !== true) {
    // PI-5 (already-installed) and PI-15 (race-at-commit) collapse here;
    // this site surfaces the PI-5 wording and the state-commit phase's
    // defensive throw surfaces PI-15.
    throw new PluginShapeError({ kind: "already-installed", plugin, marketplace });
  }
```

which renders as a `(failed)` row carrying the closed-set reason `"already installed"`
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:376 — `reasons: ["already installed"] as const,`; token declared at shared/notification-types.ts:9]`.

The root is never skipped by the closure walk (`isRoot` guard above), so this throw is reached for
the exact scenario PROV-03 names. There is **one** code path and it currently produces a failure.

The one-way-ratchet framing in CONTEXT is right that the *rule* is one rule. But it is **not**
implementable as one edit, because the two halves land in different places and have different costs:

- PROV-02's half is an **absence** of code (nothing touches the record) — free.
- PROV-03's half is a **new behavior** at a site that today throws — and changing what
  `install <already-installed>` reports is a change to the pinned output catalog.

See Open Question 1 for the options and their costs. **Do not let a plan assume PROV-03 is a
two-line change.**

---

## 3. schemaVersion 2 → 3 Blast Radius

### 3a. `state-io.ts` — six literals plus the guard (CONTEXT's list is correct; here it is verified)

| Site | Line(s) | Current text (verbatim) |
|------|---------|--------------------------|
| Record schema, where the field lands | `81` | `export const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({` |
| Neighbour fields the new one sits beside | `123-125` | `  enabled: Type.Boolean(),` / `  installedAt: Type.String(),` / `  updatedAt: Type.String(),` |
| Clone enumeration | `175-177` | `    enabled: record.enabled,` / `    installedAt: record.installedAt,` / `    updatedAt: record.updatedAt,` |
| Version union | `288` | `  schemaVersion: Type.Union([Type.Literal(1), Type.Literal(2)]),` |
| `DEFAULT_STATE` | `305-308` | `export const DEFAULT_STATE: ExtensionState = Object.freeze({` / `  schemaVersion: 2,` |
| ENOENT return | `387` | `      return { schemaVersion: 2, marketplaces: {} };` |
| `loadState` version guard | `406-413` | `    parsedRecord.schemaVersion !== 1 &&` / `    parsedRecord.schemaVersion !== 2` … `throw new Error(…unsupported schema version…)` |
| Normalized rebuild, stamped arm | `455-461` | `      ? {` / `          schemaVersion: 2,` / `          lastReconciledExtensionVersion: reconciliationStamp,` |
| Normalized rebuild, bare arm | `462` | `      : { schemaVersion: 2, marketplaces };` |

That is **three** `{ schemaVersion: 2 }` object literals (387, 458, 462) — CONTEXT says
"the two `{ schemaVersion: 2 }` literals at lines 387/458/462", which names three line numbers.
There are three. `[VERIFIED: state-io.ts:387,458,462]`

Also note the doc comment at `281-286` describes the union's meaning and says
"`persistMigratedState` always writes schemaVersion 2" — it needs the same amendment, as does the
`PLUGIN_INSTALL_RECORD_SCHEMA` header block at `60-80` (which enumerates HOOK-02 and ENBL-02 by
name).

### 3b. `migrate.ts` — the `ensurePluginEnabled` template is exactly right

```ts
// extensions/pi-claude-marketplace/persistence/migrate.ts:161-184
function ensurePluginEnabled(mp: Record<string, unknown>): boolean {
  const plugins = mp.plugins;
  if (typeof plugins !== "object" || plugins === null || Array.isArray(plugins)) {
    return false;
  }

  let mutated = false;
  for (const plRaw of Object.values(plugins as Record<string, unknown>)) {
    if (typeof plRaw !== "object" || plRaw === null || Array.isArray(plRaw)) {
      continue;
    }

    const pl = plRaw as Record<string, unknown>;
    // Only an ABSENT field is filled. A present-but-non-boolean value
    // (e.g. null) is intentionally left untouched for STATE_VALIDATOR.Check
    // to reject with an actionable error rather than being silently coerced.
    if (pl.enabled === undefined) {
      pl.enabled = true;
      mutated = true;
    }
  }

  return mutated;
}
```

**WHERE in the sequence the new fill must run** — the answer is: anywhere inside
`migrateLegacyMarketplaceRecords`'s per-marketplace loop, because the whole function runs *before*
the check. The ordering that matters is at the `loadState` seam, not within `migrate.ts`:

```ts
// extensions/pi-claude-marketplace/persistence/state-io.ts:434-438, 464
  const { marketplaces, mutated } = migrateLegacyMarketplaceRecords(
    parsed,
    extensionRoot,
    scrubAutoupdate,
  );
  …
  if (!STATE_VALIDATOR.Check(normalized)) {
```

Follow the existing call order in `migrateLegacyMarketplaceRecords:246-251` and put the provenance
fill immediately after `ensurePluginEnabled`:

```ts
    mutated = ensureMarketplacePaths(mpName, mp, extensionRoot) || mutated;
    mutated = ensurePluginResources(mp) || mutated;
    mutated = ensurePluginEnabled(mp) || mutated;
    if (scrubAutoupdate) {
```

`[VERIFIED: extensions/pi-claude-marketplace/persistence/migrate.ts:246-251]`

The module header comment block at `12-30` enumerates every fill (ST-4, ST-5, HOOK-02/D-57-01,
ENBL-02) and needs a matching paragraph. The `migrateLegacyMarketplaceRecords` doc comment at
`192-207` has a per-behavior bullet list; add one there too.

### 3c. **THE COMPLEXITY BUDGET — measured, and the binding gate is fallow, not ESLint**

| Function | fallow cyclo/cog (before) | fallow cyclo/cog (after) | ESLint sonarjs cog (before → after) | Ceilings |
|----------|---------------------------|---------------------------|--------------------------------------|----------|
| `migrateLegacyMarketplaceRecords` (`migrate.ts:209`) | **17 / 14** | **18 / 15** | 7 → 7 | 20 / 15 |
| `buildUninstallBucket` (`plan.ts:484`) | 6 / 10 | 7 / 11 | 10 → 11 | 20 / 15 |
| new `ensurePluginProvenance` | — | 9 / 8 | — → 6 | 20 / 15 |

`[VERIFIED: probe, 2026-09-15 — `fallow health --complexity --max-cognitive 1 --max-cyclomatic 1 --format json`
before and after; `eslint --rule '{"sonarjs/cognitive-complexity":["error",1]}'` before and after]`

At the real thresholds the probed tree still passes:

```
✓ No functions exceed complexity thresholds (0.00s)
  13287 functions analyzed (max cyclomatic: 20, max cognitive: 15, max CRAP: 0.0)
```

`[VERIFIED: probe, 2026-09-15 — `fallow health --complexity --fail-on-issues --format human`, exit 0]`

**So fallow's ceiling is inclusive (15 passes, 16 fails) and the function lands exactly on it.**
Consequences the plan must carry:

- `migrateLegacyMarketplaceRecords` has **zero** fallow cognitive headroom after this change. Any
  further conditional inside it — in this phase, in Phase 5, or in a review fix — breaks the gate.
- ESLint reads the same function at 7 and will stay silent. Running `npm run lint` green is **not**
  evidence that `npm run fallow` is green. This is exactly the C7 hazard.
- A plan that budgets "run lint after each task" but defers fallow to the phase gate will discover
  this late. Recommend: run `npm run fallow` in the same breath as `npm run lint` for any task that
  touches `migrate.ts`.
- If a reviewer later wants the fill inlined rather than extracted into `ensurePluginProvenance`,
  that pushes the score past the ceiling. The extracted-helper shape is not a style preference here;
  it is what keeps the gate green.

### 3d. Architecture pins — CONTEXT names three; **there are four**

| # | Gate | file:line | Current text | Required amendment |
|---|------|-----------|--------------|--------------------|
| 1 | Record key set, enumeration equality | `tests/architecture/compat-01-no-expansion.test.ts:439-463` | `const expected = ["compatibility","enabled","hookEntries","installedAt","resolvedSha","resolvedSource","resources","updatedAt","version"];` | Add `"provenance"` **and rewrite the failure message**, which today sanctions only optional additive keys: *"A key may join it only as an OPTIONAL additive field that needs no schemaVersion bump and no migrate fill (the resolvedSha / hookEntries precedent)"*. A required key + a bump + a fill is a **new precedent** and the message must record it. **Do NOT relax the equality into a subset check.** |
| 2 | schemaVersion union | `tests/architecture/compat-01-no-expansion.test.ts:529-542` | `const expected = [1, 2];` … message: *"COMPAT-01: no state-schema migration was introduced. A third version means an on-disk migration, which this work promised not to require."* | `[1, 2, 3]` + a message that states the migration WAS introduced and why. |
| 3 | `DEFAULT_STATE.schemaVersion` | `tests/architecture/compat-01-no-expansion.test.ts:544-556` | `const expected = 2;` | `3`. |
| 4 | **MISSED BY CONTEXT** — a second, independent union pin | `tests/architecture/hooks-foundation.test.ts:38-57` | `test("ENBL-02: STATE_SCHEMA.schemaVersion is Type.Union([Literal(1), Literal(2)])", …)` with `assert.equal(anyOf.length, 2, "schemaVersion union must have exactly two members (1 and 2)")` | Title, arity and both `const` membership assertions. Its own comment says *"any future widening to v3 requires this test to be updated"* — this is that moment. |

Both files confirmed failing under the probe:
`not ok 35 - COMPAT-01: the persisted install record holds exactly its inherited key set`,
`not ok 38 - COMPAT-01: the state schema version union is unchanged`,
`not ok 39 - COMPAT-01: the default state still declares the current schema version`,
`not ok 116 - ENBL-02: STATE_SCHEMA.schemaVersion is Type.Union([Literal(1), Literal(2)])`.
`[VERIFIED: probe, 2026-09-15]`

Two further pins were checked and are **not** affected: the COMPAT-01
"no manifest-snapshot or orphan field" clause (`compat-01-no-expansion.test.ts:497-527`, whose
`shapes` list does not include `provenance`), and `tests/architecture/gate-targets.ts:684-688`,
which censuses `PLUGIN_INSTALL_RECORD_SCHEMA` / `STATE_SCHEMA` / `STATE_VALIDATOR` as gate-only
exports — an added field does not change that census.

### 3e. **The fixture blast radius — the number that should shape the plan**

Full probe implementation (six production files patched, production tree typechecking clean), then
the unit suite:

```
# tests 6363
# pass 5502
# fail 861
```

`[VERIFIED: probe, 2026-09-15 — `node --test "tests/{architecture,…}/**/*.test.ts" "tests/index.test.ts"`, exit 1]`

Dominant failure message, by count:

```
254  saveState refused: in-memory state failed schema validation: /marketplaces/mp/plugins/hello: must have require…
119  saveState refused: …/marketplaces/mp/plugins/alpha: must have require…
 50  saveState refused: …/marketplaces/mp/plugins/gp: must have required p…
 36  saveState refused: …/marketplaces/official/plugins/hello: …
 …
```

**Failures by test file (all 861):**

```
 276 tests/orchestrators/plugin/update-flow.test.ts       18 tests/orchestrators/plugin/update-preflight.test.ts
  71 tests/orchestrators/plugin/info.test.ts              14 tests/orchestrators/edge-deps.test.ts
  61 tests/orchestrators/plugin/uninstall.test.ts         14 tests/orchestrators/plugin/install-cascade.test.ts
  54 tests/orchestrators/plugin/list-flow.test.ts         13 tests/orchestrators/plugin/install-flow.test.ts
  34 tests/edge/handlers/plugin/uninstall.test.ts         10 tests/orchestrators/plugin/reinstall-targets.test.ts
  28 tests/edge/handlers/plugin/reinstall.test.ts         10 tests/orchestrators/plugin/shared.test.ts
  26 tests/edge/handlers/plugin/list.test.ts               9 tests/orchestrators/marketplace/add.test.ts
  26 tests/orchestrators/reconcile/backfill.test.ts        7 tests/edge/handlers/marketplace/update.test.ts
  24 tests/orchestrators/marketplace/update.test.ts        7 tests/orchestrators/plugin/reinstall-flow.test.ts
  23 tests/orchestrators/reconcile/apply.test.ts           6 tests/transaction/with-state-guard.test.ts
  22 tests/edge/handlers/plugin/update.test.ts             5 tests/orchestrators/plugin/clone-gc.test.ts
  22 tests/edge/handlers/tools.test.ts                     5 tests/persistence/migrate.test.ts
  22 tests/orchestrators/marketplace/remove.test.ts        4 tests/edge/register.test.ts
  19 tests/persistence/state-io.test.ts                    4 tests/orchestrators/plugin-path.test.ts
  18 tests/edge/handlers/plugin/enable-disable.test.ts     4 tests/orchestrators/plugin/bootstrap.test.ts
   3 tests/architecture/compat-01-no-expansion.test.ts     3 tests/bridges/hooks/event-router.test.ts
   2 tests/orchestrators/marketplace/autoupdate.test.ts    2 tests/orchestrators/plugin/enable-disable.test.ts
   2 tests/orchestrators/plugin/install-outcome.test.ts    2 tests/orchestrators/plugin/update-swap.test.ts
   1 tests/architecture/hooks-foundation.test.ts           1 tests/index.test.ts
   1 tests/orchestrators/reconcile/pending.test.ts
```

**Failures that are NOT the fixture-shape `saveState` refusal — 96 across 20 files.** These are the
byte-exact and behavioral assertions that need reading and deciding, not mechanical editing:

```
 18 tests/persistence/state-io.test.ts          3 tests/edge/handlers/tools.test.ts
 11 tests/orchestrators/marketplace/remove.test.ts   3 tests/orchestrators/marketplace/update.test.ts
  9 tests/orchestrators/marketplace/add.test.ts      3 tests/orchestrators/plugin/shared.test.ts
  7 tests/orchestrators/reconcile/backfill.test.ts   2 tests/edge/register.test.ts
  6 tests/orchestrators/reconcile/apply.test.ts      2 tests/orchestrators/edge-deps.test.ts
  6 tests/transaction/with-state-guard.test.ts       2 tests/orchestrators/plugin/enable-disable.test.ts
  5 tests/orchestrators/plugin/install-flow.test.ts  1 tests/architecture/hooks-foundation.test.ts
  5 tests/persistence/migrate.test.ts                1 tests/index.test.ts
  4 tests/orchestrators/plugin-path.test.ts          1 tests/orchestrators/reconcile/pending.test.ts
  4 tests/orchestrators/plugin/bootstrap.test.ts     3 tests/architecture/compat-01-no-expansion.test.ts
```

Notable individual cases in that 96, by title:

- `validates schema version 3` — `tests/persistence/state-io.test.ts:222` is a **negative** test
  asserting v3 is currently *rejected*. It inverts.
- `publishes the exact frozen default state`, `saves exact version-2 bytes and loads the complete state`,
  `normalizes a complete version-2 document and preserves its stamp`,
  `migrates legacy state, persists exact bytes, and replays as a fixed point` — byte-exact
  `state.json` contracts in `state-io.test.ts` / `migrate.test.ts`.
- `clones every plugin field without retaining nested aliases`, `clones a legacy plugin without
  inventing optional fields` — the `clonePluginRecord` field census.
- Six cases in `tests/transaction/with-state-guard.test.ts` asserting literal
  `'{\n  "schemaVersion": 2,\n  "marketplaces": {},\n …'` bytes.
- `RESV-01 / WR-09: an orchestrated install declares its cascade dependencies, so the next reload keeps them`,
  `RESV-01 / D-03-06: a cascade dependency is declared in the parent's own file`,
  `RESV-01 / D-01-32: a dependency declared only in the plugin's own manifest installs` — the three
  config-write tests, see § 4.

**Interpretation for the planner.** 95 lines in `tests/` match `^\s*installedAt:`
`[VERIFIED: rg -c over tests/, 2026-09-15]`; 51 of them are compiler-visible; the rest are loosely
typed and only fail at `saveState`. A large share of the 861 failures collapse when a handful of
shared per-file fixture builders are fixed (note `tests/orchestrators/plugin/update-flow.test.ts`:
276 failures from **2** compiler diagnostics). But the count is not knowable from typecheck alone,
so the work item is "run `npm test` and drive it to zero," not "fix the tsc errors."

---

## 4. What Removing the Config Write Actually Touches

### 4a. The two arms

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1343-1348 (standalone arm)
          // RESV-01's reload clause: declare every member the cascade newly
          // installed, in the SAME batched patch and therefore the same
          // physical file. …
          dependencyPluginPatches: Object.fromEntries(
            installed.members.map((member) => [member.key, {}]),
          ),
```

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:1351-1362 (orchestrated arm)
        await writeOrchestratedDeclarations({
          current, targetConfigPath, scopeRoot: locations.scopeRoot,
          plugin, marketplace, rootKey,
          dependencyKeys: installed.members
            .map((member) => member.key)
            .filter((key) => key !== rootKey),
          landedDisabled: disabledInstall.landed,
        });
```

Both comment blocks cite "RESV-01's reload clause" as the justification. Per C8 the justification
moves to provenance and the comments go with the code — but do **not** replace them with a narration
of what was removed.

### 4b. Does `writeOrchestratedDeclarations` become dead? **No — it loses one argument and half its body.**

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:421-453
async function writeOrchestratedDeclarations(args: {
  readonly current: Parameters<typeof writeBatchedConfigEntries>[0];
  readonly targetConfigPath: string;
  readonly scopeRoot: string;
  readonly plugin: string;
  readonly marketplace: string;
  readonly rootKey: string;
  readonly dependencyKeys: readonly string[];
  readonly landedDisabled: boolean;
}): Promise<void> {
  if (args.dependencyKeys.length === 0) {
    if (args.landedDisabled) {
      await writePluginConfigEntry(…, { enabled: false });
    }
    return;
  }
  await writeBatchedConfigEntries(…);
}
```

With `dependencyKeys` always empty, the `writeBatchedConfigEntries` tail is unreachable and the
function reduces to *"if the install landed disabled, write the single `enabled: false` entry."* The
`rootKey` argument becomes unused, and the `writeBatchedConfigEntries` reference survives only
inside the `Parameters<typeof …>[0]` type expression at line 422 — so the import would stay
type-referenced and would **not** be flagged by ESLint `no-unused-vars` unless that type expression
is also rewritten (e.g. to `Parameters<typeof writePluginConfigEntry>[0]`, or to the named
`ScopeConfig`). **Rewrite it in the same task**, or the dead import rots silently.

Its own doc comment at `408-416` explains why the batched writer exists here ("the batched writer
earns its place only when several keys must land in ONE atomic save, which is the cascade case") —
that rationale goes away with the arm.

### 4c. `writeAdoptingConfigEntries` — remove the parameter, do not merely stop passing it

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:805-833
export async function writeAdoptingConfigEntries(opts: {
  …
  readonly pluginPatch: Partial<PluginConfigEntry>;
  readonly dependencyPluginPatches?: Record<string, Partial<PluginConfigEntry>>;
}): Promise<void> {
  …
    plugins: {
      ...opts.dependencyPluginPatches,
      [`${opts.plugin}@${opts.marketplace}`]: opts.pluginPatch,
    },
```

`install-flow.ts:1319` is the only caller that passes it; `enable-disable.ts:216,224` and
`enable-disable.ts:100` use the same function without it. An unused **optional property on an inline
object-literal parameter type** is not reported by fallow `dead-code` or by
`@typescript-eslint/no-unused-vars`, so leaving it is silent rot. Remove the property, the spread
at `:828`, and the doc paragraph at `790-804` (including the D-03-06 paragraph at `796-804`, whose
subject disappears).

### 4d. Tests that assert the dependency IS declared — **invert, do not delete**

| Test | file:line | What to invert |
|------|-----------|----------------|
| `RESV-01 / WR-09: an orchestrated install declares its cascade dependencies, so the next reload keeps them` | `tests/orchestrators/plugin/install-flow.test.ts:3486` | The declaration half at `:3552` (`assert.deepEqual(declared.config.plugins?.["some-other-plugin@mp"], {})`) becomes "is NOT declared". **The reload half at `:3562-3576` stays verbatim** — `assert.deepEqual(planned.pluginsToUninstall, [])`, a second `reconcilePass()`, and `"the dependency survives the reload that follows the install"`. That is the CR-01 regression, and D-04-04 is right that it stays honest across all three steps. Rename the title (it names the mechanism, not the promise). |
| `RESV-01 / D-03-06: a cascade dependency is declared in the parent's own file` | `tests/orchestrators/plugin/install-flow.test.ts:4828` | Asserts the complete config bytes: `'…"plugins": {\n    "some-other-plugin@mp": {},\n    "hello@mp": {}\n  }…'`. New expected bytes name `hello@mp` only. D-03-06's config-entry half is retired by D-04-02; **D-03-05's scope half stands** and should get its own surviving assertion. |
| `RESV-01 / D-01-32: a dependency declared only in the plugin's own manifest installs` | `tests/orchestrators/plugin/install-flow.test.ts:4869` | Failed under the probe; same config-bytes shape. |
| `RESV-01 declares every cascade dependency in the requesting plugin's own file` | `tests/orchestrators/plugin/shared.test.ts:1085` | Direct `writeAdoptingConfigEntries` unit test of `dependencyPluginPatches`. Deleted with the parameter. |
| `RESV-01 omitting the dependency patches writes the same bytes as an empty record` | `tests/orchestrators/plugin/shared.test.ts:1113` | Same. |
| `RESV-01 a key in both records resolves in the requesting plugin's favour` | `tests/orchestrators/plugin/shared.test.ts:1149` | Same — this one pins the precedence rule that disappears. |

### 4e. Documentation that states the retired behavior

| File | Line | Current text |
|------|------|--------------|
| `docs/dependency-resolution.md` | 116 | *"Within that scope, a dependency's entry goes into the same file the asking plugin's entry is in: either `claude-plugins.json` or `claude-plugins.local.json`. This matters after a reload. Pi removes any recorded plugin the configuration does not name, so an undeclared dependency would disappear on the next `/reload`. Declaring each dependency in the parent's own file keeps it."* |
| `docs/dependency-resolution.md` | 155 | Cross-reference to README §Configuration files described as *"the files a dependency's entry lands in."* |
| `README.md` | 344 | *"A plugin can declare the other plugins it needs. The install adds them too, into the same scope and the same configuration file."* |

`tests/architecture/dependency-doc-agreement.test.ts` gates `docs/dependency-resolution.md`'s
**failure-reason table** against the tokens the cascade actually stamps — it does not read the
"Where a dependency lands" section, so the prose rewrite is un-gated and easy to forget. Put it in
the same task as the code removal. Markdown is formatted by `mdformat` via pre-commit (C13), not
prettier.

---

## 5. `buildUninstallBucket`'s Exemption

```ts
// extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:484-510
function buildUninstallBucket(
  state: ExtensionState,
  scope: Scope,
  marketplaceDiff: MarketplaceDiff,
  declaredPluginKeys: ReadonlySet<string>,
): PlannedPluginUninstall[] {
  const uninstall: PlannedPluginUninstall[] = [];
  const retainedMarketplaces = new Set(marketplaceDiff.recordedByDeclared.values());
  for (const [mpName, mpRecord] of Object.entries(state.marketplaces)) {
    if (marketplaceDiff.conflictedRecorded.has(mpName)) {
      continue;
    }

    if (!retainedMarketplaces.has(mpName)) {
      continue;
    }

    for (const pluginName of Object.keys(mpRecord.plugins)) {
      const key = `${pluginName}@${mpName}`;
      if (!declaredPluginKeys.has(key)) {
        uninstall.push({ scope, plugin: pluginName, marketplace: mpName });
      }
    }
  }

  return uninstall;
}
```

**Correction to CONTEXT.** CONTEXT says *"`mpRecord.plugins[pluginName]` is already in hand at that
point."* The outer loop already destructures `mpRecord`, but the **inner** loop at `:501` iterates
`Object.keys(...)`, so the record is reachable but not bound. No new state has to be threaded in —
change `Object.keys` to `Object.entries` (what the probe did) or index `mpRecord.plugins[pluginName]`
inline. `Object.entries` is the cleaner read and matches the outer loop's own style.

**Complexity, measured:** `6 / 10` → `7 / 11` under fallow, `10 → 11` under ESLint sonarjs, against
`20 / 15` on both. Four points of headroom on the tighter axis. D-04-01's discretion note is
satisfied by the inline condition; a named helper is not needed and would add a function that
`check-corresponding-tests.mjs` has nothing to say about but that the 100%-branch-coverage rule
(C12) would still have to reach.

**Purity is preserved.** `tests/architecture/reconcile-planner-purity.test.ts` structurally forbids
effectful imports in `plan.ts`; reading a field off a record it already holds adds none.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Back-filling an absent required field on a legacy record | A bespoke normalizer, a "state version detector", or a repair command | `persistence/migrate.ts`'s `ensurePluginEnabled` shape, called from `migrateLegacyMarketplaceRecords` | It is the only code that runs before `STATE_VALIDATOR.Check`, and ENBL-02 already proved the pattern end to end (including the documented over-fill caveat). |
| Deciding whether a member is a dependency | A second pass over the closure, or a lookup keyed on the member name | `member.key === rootKey` at `install-flow.ts:1181` | The discriminant is already in scope at the one site that builds per-member options. |
| Preserving provenance across enable | A branch in `enable-disable.ts` | `existing?.provenance ?? …` in statePhase, mirroring `installedAt: existing?.installedAt ?? nowIso` | `allowExistingRecord: true` guarantees `existing` is defined on that path; one expression covers install, enable and re-materialize. |
| Preserving provenance across update | Anything | Nothing — update mutates fields in place (`update-swap.ts:665-691`, `update-preflight.ts:439-462`) | The record object is never rebuilt, so unrelated fields ride through by construction. |
| Preserving provenance across reinstall | A merge helper | `input.oldRecord.provenance`, one line beside `installedAt: input.oldRecord.installedAt` at `reinstall-record.ts:143` | The function already carries forward exactly the fields that must survive. |
| Detecting a record that predates the field | A sentinel value, `provenance: "unknown"`, or an optional field | A required field + a migrate fill (D-04-03) | The `resolvedSha` / `hookEntries` precedent (optional, no bump, no fill) is explicitly the wrong one here: absence must not read as "no answer yet." |

**Key insight:** every mechanism this phase needs is already in the tree with a named precedent. The
only genuinely new decision is PROV-03's promotion semantics.

---

## Common Pitfalls

### Pitfall A: treating `npm run typecheck` as the fixture gate
**What goes wrong:** 51 compiler diagnostics, 861 failing tests. The compiler sees only the
strictly-typed fixture literals.
**Why it happens:** test fixtures reach `saveState` through loosely-typed intermediates, so the
required-field violation surfaces as a runtime validator refusal rather than a type error.
**How to avoid:** the exit criterion for the field task is `npm test` at zero failures, not `tsc`.
**Warning signs:** `saveState refused: in-memory state failed schema validation: /marketplaces/<mp>/plugins/<name>: must have required property`.

### Pitfall B: running `npm run lint` and inferring `npm run fallow`
**What goes wrong:** `migrateLegacyMarketplaceRecords` sits at fallow cognitive **15/15** after this
change while ESLint reads it at **7**. A later conditional breaks a gate ESLint never mentions.
**Why it happens:** two independently-computed algorithms, one shared ceiling number (C7).
**How to avoid:** run `npm run fallow` alongside `npm run lint` on any task touching `migrate.ts`;
keep the fill in its own extracted helper rather than inlining it.
**Warning signs:** a fallow `health` finding naming `migrate.ts:209`.

### Pitfall C: reordering the three steps, or splitting step 3 across the step-2 boundary
**What goes wrong:** CR-01 reopens — a blocker-severity data-loss defect.
**Why it happens:** step 3 is the smallest diff and looks like a tidy-up.
**How to avoid:** D-04-04 is a correctness contract. See § 7 for the verified per-step end states.

### Pitfall D: a PROV-02 test that passes vacuously
**What goes wrong:** the project has shipped this exact failure once already — CR-01 passed every
test while falsifying RESV-01, because the tests exercised a path reconcile does not drive.
PROV-02 is satisfied by an *absence* of code, so a weak test proves nothing.
**How to avoid:** snapshot the record before the second install and `assert.deepStrictEqual` the
whole thing after. A `provenance === "explicit"` assertion alone would pass against a cascade that
rewrote every other field.

### Pitfall E: `PROV-NN` in source comments means something else already
**What goes wrong:** `PROV-01..07` is the shipped `url-source` milestone's **git auth provider**
requirement family — 48 citations across `extensions/`, `tests/` and `docs/`. Examples:
`domain/auth-registry.ts:102` — *"PROV-01: return the provider whose hostMatch accepts `host`"*;
`orchestrators/auth-host.ts:17` — *"carries no auth bundle (PROV-02); a private one fails clean
(PROV-04)"*; `install-flow.ts:252` — *"the auth notify seam (PROV-03)"*.
`[VERIFIED: rg -o "PROV-[0-9]+" over extensions/ tests/ docs/, 2026-09-15 — PROV-03 ×16, PROV-02 ×13, PROV-04 ×11, PROV-05 ×5, PROV-01 ×2, PROV-07 ×1]`
`[VERIFIED: .planning/milestones/url-source-REQUIREMENTS.md:43 — "**PROV-01**: `GitAuthProvider` registry (id, host match, authenticate)…"]`
**Why it matters:** C8 makes requirement IDs the durable traceability anchor in comments and test
titles. A new comment reading `// PROV-02: an explicit install stays explicit` is genuinely
ambiguous against a file that already cites PROV-02 for auth bundles — and `install-flow.ts` cites
both families.
**How to avoid:** anchor this phase's source comments and test titles on the **decision** IDs
(`D-04-01` … `D-04-06`), not on bare `PROV-NN`. If a requirement anchor is wanted, qualify it. The
requirement IDs in `REQUIREMENTS.md` can stay as they are; it is the *source* anchors that need to
disambiguate. Flag this to the operator.

### Pitfall F: `writeOrchestratedDeclarations`'s dead import surviving the removal
**What goes wrong:** `Parameters<typeof writeBatchedConfigEntries>[0]` at `install-flow.ts:422`
keeps the import type-referenced after its only value use is deleted, so no gate complains.
**How to avoid:** rewrite the type expression in the same task.

### Pitfall G: a removed optional parameter that no gate reports
**What goes wrong:** `dependencyPluginPatches?` on `writeAdoptingConfigEntries` becomes unreachable
but stays in the signature; fallow `dead-code` does not report unused optional properties on inline
object-literal parameter types.
**How to avoid:** delete the property, the spread, and the doc paragraph together.

### Pitfall H: stale config entries left on development trees after step 3
**What goes wrong:** records written between step 1 and step 3 are declared in
`claude-plugins.json` *and* carry `provenance: "dependency"`. Nothing removes those declarations, so
a dev tree ends the phase with a config that violates D-04-02's invariant on that machine.
**Why it is acceptable:** reconcile reads declared + recorded + enabled as steady state, so the
residue is inert. The ROADMAP already accepted dev-tree residue ("lands on development trees only,
and this milestone releases as a single version"). No cleanup is in scope — but say so in the
summary rather than discovering it during UAT.

---

## Runtime State Inventory

This phase changes a persisted on-disk schema, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | `<scopeRoot>/pi-claude-marketplace/state.json`, one per scope (`user` = `~/.pi/agent/`, `project` = `<cwd>/.pi/`). Every `marketplaces.<mp>.plugins.<name>` record gains a required `provenance` and the document's `schemaVersion` moves 2 → 3. | **Data migration** (`migrate.ts` fill, silent, best-effort persisted by `persistMigratedState`) **AND** code edits at the three write sites. Both are required and they are different tasks. |
| | `<scopeRoot>/claude-plugins.json` and `claude-plugins.local.json` — dev trees carry cascade-dependency entries Phase 3 wrote. | **None in scope.** See Pitfall H. Inert after step 3; no migration, no repair command. |
| | `state.json` files on the operator's real machine written by the Phase 3 dev build carry `provenance`-less records for plugins that ARE dependencies. The fill labels them `"explicit"`. | **None** — ROADMAP accepted this cost explicitly. Worth one line in the phase summary so a later `--prune` surprise is not a mystery. |
| **Live service config** | None. This extension owns no external service; no n8n/Datadog/Cloudflare surface exists in this repo. | None — verified by absence of any such integration in `platform/` (the layer holds only `pi-api.ts`, `git.ts`, `git-credential.ts`). |
| **OS-registered state** | None. No task scheduler, no pm2, no launchd, no systemd unit is registered by this extension. | None. |
| **Secrets / env vars** | `PI_CODING_AGENT_DIR`, `TEST_CONCURRENCY`, `PI_CM_E2E_REF`, `GIT_TERMINAL_PROMPT`, `GCM_INTERACTIVE`. None is read by, or named after, anything this phase renames. | None. |
| **Build artifacts / installed packages** | No build step (`tsc --noEmit`; Node runs `.ts` natively). No egg-info, no compiled binary, no global install. The published npm package version does not move in this phase. | None. |

**The canonical question — after every file in the repo is updated, what still holds the old
shape?** Exactly one thing: `state.json` documents already on disk. `migrate.ts`'s fill is the
whole answer, and `loadState` is the only reader, so there is no second path that could bypass it.
`saveState` revalidates before every write (`state-io.ts:487`) and `config-state-write-seams.test.ts`
gates that `atomicWriteJson` never targets `state.json` outside `saveState` /
`persistMigratedState`, so the two-writer invariant is machine-checked.

---

## 6. Feasibility of the Three-Step Order (D-04-04)

**Answer: yes, the three steps land in three separately-green waves. No intermediate state is
broken.** Verified per step:

| After step | Cascade dependency is protected by | `npm run check` reachable? | CR-01 regression test |
|------------|------------------------------------|----------------------------|------------------------|
| **1** — field + fill + all write sites + fixture sweep | the config write (unchanged) | Yes — provenance is written and validated but read by nobody. | Passes, via the config declaration. |
| **2** — `buildUninstallBucket` exemption | config write **and** provenance (redundant) | Yes. A declared dependency never reaches the new `provenance !== "dependency"` clause, so the exemption is inert-but-correct. | Passes, via the config declaration. |
| **3** — config write removed + docs | provenance alone | Yes. | Passes, via provenance. Its declaration assertion at `install-flow.test.ts:3552` inverts **in this wave**, and its reload assertions at `:3562-3576` are untouched. |

Two practical constraints on how the waves are cut:

1. **Step 1 is by far the largest** (861 failing tests to drive to zero, 39 files) and it has no
   natural internal split that leaves a green tree: the field cannot exist as optional-then-required
   without two migrate passes, and the fixture sweep cannot be partial because `npm test` is a
   single gate. Plan it as one wave with several tasks, not as several waves.
2. **Steps 2 and 3 are small and could share a wave** — but only if step 3's tasks are ordered after
   step 2's *within* that wave and the wave is executed sequentially. Given
   `workflow.parallelization: true` and the project's worktree model, **the safer plan is three
   waves**, because a parallel executor could otherwise land step 3's commit before step 2's.

**One thing that is genuinely awkward, stated plainly:** step 2's exemption is untestable
end-to-end until step 3 lands, because while the config write exists, no cascade dependency is ever
undeclared. Step 2's proof must therefore be a **unit** test against `buildUninstallBucket` /
`planReconcile` with a hand-built state where a `provenance: "dependency"` record is *not* in
`declaredPluginKeys` — a planted violation (C11), not an end-to-end one. The end-to-end proof
arrives with step 3. A plan that promises an end-to-end test for step 2 is promising something the
intermediate tree cannot show.

---

## Validation Architecture

> `.planning/config.json` sets `workflow.nyquist_validation: true`, so this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node's built-in runner). Local Node **v26.8.2**; CI pins **Node 24**. |
| Config file | **none** — suites are selected by glob in `package.json` scripts. |
| Quick run command | `node --test tests/<path>/<file>.test.ts` (single file, seconds) |
| Full unit suite | `npm test` → `node --test "tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,scripts,shared,transaction}/**/*.test.ts" "tests/index.test.ts"` (6363 cases on the current tree) |
| Integration suite | `npm run test:integration` → `node --test "tests/integration/**/*.test.ts"` |
| Phase gate | `npm run check` — `typecheck && lint && lint:workflows && lint:workflows:negative && fallow && format:check && test:corresponding && test:corresponding:negative && test:coverage:direct:negative && test && test:integration` |
| Pairing gate | `scripts/check-corresponding-tests.mjs` — 1:1 `extensions/pi-claude-marketplace/X.ts` ↔ `tests/X.test.ts`, with `architecture`, `e2e`, `integration`, `scripts` exempt as non-corresponding roots. |

**Wave 0 gaps: none.** Every file this phase touches already has its paired test:
`tests/persistence/state-io.test.ts`, `tests/persistence/migrate.test.ts`,
`tests/orchestrators/reconcile/plan.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`,
`tests/orchestrators/plugin/install-outcome.test.ts`,
`tests/orchestrators/plugin/install-cascade.test.ts`,
`tests/orchestrators/plugin/reinstall-record.test.ts`,
`tests/orchestrators/plugin/shared.test.ts`. **Recommendation: create no new production module**, so
no new pair and no new 100%-run-alone coverage obligation is incurred (C12).

### Phase Requirements → Test Map

| Req | Behavior | Test type | Automated command | File exists? | Must be observed FAILING against |
|-----|----------|-----------|-------------------|--------------|----------------------------------|
| PROV-01 | The record schema declares a required two-literal `provenance`; the key set pin names it | architecture | `node --test tests/architecture/compat-01-no-expansion.test.ts` | ✅ | the un-amended pin (already observed failing: `not ok 35`) |
| PROV-01 | A cascade root records `"explicit"`; each cascade dependency records `"dependency"` | unit | `node --test tests/orchestrators/plugin/install-cascade.test.ts` | ✅ | an `install-flow.ts` that passes a constant instead of `member.key === rootKey` |
| PROV-01 | A standalone install with no dependencies records `"explicit"` | unit | `node --test tests/orchestrators/plugin/install-outcome.test.ts` | ✅ | statePhase omitting the field (`saveState` refuses) |
| PROV-01 | `clonePluginRecord` carries the field; reinstall's replace carries it forward | unit | `node --test tests/persistence/state-io.test.ts` + `.../plugin/reinstall-record.test.ts` | ✅ | an omission at `state-io.ts:149` / `reinstall-record.ts:128` (TS2741, plus a runtime clone census) |
| PROV-02 | An explicitly-installed plugin's record is **byte-identical** after a later install declares it as a dependency | unit | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ✅ | a cascade that includes already-installed members in the closure (mutate `dependency-closure.ts:269`'s `!isRoot &&` guard to plant it) |
| PROV-03 | **BLOCKED** — see Open Question 1 | — | — | — | — |
| PROV-04 | A v2 document with no `provenance` loads, fills `"explicit"`, and is persisted | unit | `node --test tests/persistence/migrate.test.ts` | ✅ | the fill absent (`STATE_VALIDATOR.Check` throws at `state-io.ts:464`) |
| PROV-04 | A present-but-invalid `provenance` is left for the validator, not coerced | unit | `node --test tests/persistence/migrate.test.ts` | ✅ | a fill that overwrites rather than only filling absence (ENBL-02's discipline) |
| PROV-04 | **No record is misreported as a dependency** — after a migrate of a multi-record legacy document, every record reads `"explicit"` | unit | `node --test tests/persistence/migrate.test.ts` | ✅ | a fill defaulting to `"dependency"` |
| PROV-04 | `loadState` accepts v1, v2 and v3 and rejects anything else; `DEFAULT_STATE` is v3 | unit | `node --test tests/persistence/state-io.test.ts` | ✅ | the un-widened guard at `state-io.ts:409-410` (already observed failing: `validates schema version 3`) |
| D-04-05 / Crit. 5 | `buildUninstallBucket` does not plan an uninstall for an undeclared record whose provenance is `"dependency"` | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ | the un-exempted inner loop at `plan.ts:501-506` |
| D-04-05 / Crit. 5 | It **still** plans one for an undeclared record whose provenance is `"explicit"` (genuine orphan) | unit | `node --test tests/orchestrators/reconcile/plan.test.ts` | ✅ | an over-broad exemption that skips every undeclared record |
| D-04-02 / Crit. 5 | A cascade install writes the root's key to the config and **no dependency key** | unit | `node --test tests/orchestrators/plugin/install-flow.test.ts` | ✅ | the un-removed arms at `install-flow.ts:1346` / `:1358` |
| D-04-04 / CR-01 | A cascade-installed dependency **survives `applyReconcile`** with no config declaration | integration-in-unit | `node --test tests/orchestrators/plugin/install-flow.test.ts` (the `:3486` case) | ✅ | step 3 landed without step 2 (the plan's own ordering hazard — **worth planting once, deliberately, as the proof that step 2 is load-bearing**) |

### Sampling Rate

- **Per task commit:** the touched file's paired test, plus — for any task touching `migrate.ts` —
  `npm run fallow` (Pitfall B). Seconds.
- **Per wave merge:** `npm test` **and** `npm run test:integration`. `npm test` is the only gate that
  sees the fixture blast radius; `tsc` is not (Pitfall A).
- **Phase gate:** `npm run check` green, then `pre-commit run --all-files` (C4, C13 — the markdown
  hooks only fire there).

### The project's own hard-won rule, applied

A green suite is not proof. CR-01 passed every test while falsifying RESV-01, because the tests
exercised `installPlugin` directly and never drove `applyReconcile` — the path reconcile actually
takes. Three concrete consequences for this phase:

1. **The criterion-5 test must drive `applyReconcile`, not `planReconcile` alone.** The existing
   `:3486` case already does (it calls `reconcilePass()` twice); keep that shape. A new test that
   only calls `planReconcile` and asserts `pluginsToUninstall === []` would be the same mistake.
2. **PROV-02's proof must be falsifiable** — see Pitfall D. Prefer planting the violation
   (temporarily relax `dependency-closure.ts:269`) and observing the failure before writing the fix,
   over asserting one field.
3. **The exemption's negative control matters as much as its positive case.** D-04-05 keeps
   sweeping genuine orphans; a test that only proves the dependency is kept would pass against an
   exemption that keeps everything.

### Regression surface

The 96 non-`saveState` failures enumerated in § 3e **are** the regression surface: each is an
existing behavioral or byte-exact contract this phase moves. Every one must be read and amended
deliberately — a byte assertion that is "fixed" by copying the new actual bytes back into the
expectation has verified nothing (`assertions`: *"Expected values are built independently"*). The
765 fixture-shape failures are mechanical and carry no contract.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v26.8.2 (engines floor `>=20.19.0`; CI pins 24) | — |
| `node_modules` installed | typecheck, lint, fallow, tests | ✓ | present | `npm ci` |
| `typescript` (`tsc`) | `npm run typecheck` | ✓ | `./node_modules/.bin/tsc` runs | — |
| `eslint` | `npm run lint` | ✓ | flat config loads, exit 0 on probed files | — |
| `fallow` | `npm run fallow` | ✓ | **3.22.0** (`.fallowrc.json` loaded; 13287 functions analyzed) | — |
| `prettier` | `npm run format:check` | ✓ (declared `^3.8.3`) | not exercised this session | — |
| `pre-commit` | C4 | not probed — memory note records **no pre-commit hook is installed**, so it must be run by hand (`pre-commit run --all-files`), budget ~9 min | — | run it explicitly before every commit |
| Network | nothing in this phase | n/a | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

One environment caveat carried from CONTEXT that the planner must honour: **force the isolation
sentinel before every `Agent()` dispatch.** `workflow.use_worktrees` is `true` but
`worktree base-check` reports `shouldDegrade: true`, and a bare `dispatch-isolation` call
re-resolves to `harness-worktree` and silently undoes the force. Also relevant: a memory note
records that worktrees lack `node_modules`, which would make `npm run check` unrunnable in one —
another argument for sequential execution here.

---

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so it is treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase touches no credential path. (The `auth-host.ts` / `git-credential.ts` surfaces are untouched — note the `PROV-NN` naming collision in Pitfall E is a *documentation* hazard, not a security one.) |
| V3 Session Management | no | No sessions. |
| V4 Access Control | no | No authorization decisions. |
| V5 Input Validation | **yes** | `typebox` + `STATE_VALIDATOR.Check`. The new field is a closed two-literal union, so an arbitrary string in a hand-edited `state.json` is rejected at load with an actionable path (`/marketplaces/<mp>/plugins/<name>/provenance`). The migrate fill deliberately fills only an **absent** field; a present-but-wrong value reaches the validator (ENBL-02's discipline, restated in D-04-03). |
| V6 Cryptography | no | None involved. |
| V12 File & Resource | **yes, unchanged** | `shared/path-safety.ts::assertPathInside` and `shared/atomic-json.ts` remain the only write paths; `config-state-write-seams.test.ts` gates that `state.json` is written only by `saveState` / `persistMigratedState`. This phase adds no writer. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Hand-edited `state.json` sets `provenance: "dependency"` on every record to make reconcile stop sweeping | Tampering | Accepted and in-scope-by-design: the user owns their own state file, and `--prune` (Phase 5) still re-derives "does anything still need this?" from live manifests rather than trusting the field. Worth one sentence in the phase summary. |
| A malformed `provenance` value wedges the extension at load | Denial of Service | The union rejects it with a named path; `loadState` throws a message naming the file and the first validator error (`state-io.ts:316-324`). This is the existing, intended behavior for every required field. |
| Removing the config write silently orphans a user's plugin | Tampering / availability | This is CR-01's failure mode and is precisely what D-04-04's ordering prevents. The criterion-5 test is the control. |
| A new persisted field leaks plugin-supplied content into `state.json` | Information Disclosure | Not applicable — `provenance` is a value this extension computes, never a value a plugin manifest supplies. Contrast `hookEntries`, whose schema exists specifically to bound plugin-supplied payload (`state-io.ts:38-54`). |

No new attack surface, no new dependency, no new network call.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The 861 runtime failures collapse to roughly the ~95 `installedAt:` fixture-construction lines once each is given a `provenance`, leaving the 96 non-`saveState` cases as the real work. I measured the failure counts and the line counts, but did **not** run a mechanical fixture fix to confirm the residual is exactly 96. | § 3e | The fixture wave is larger than planned. Mitigation: the plan's exit criterion is `npm test` at zero, so the risk is schedule, not correctness. |
| A2 | `Type.Union([Type.Literal("explicit"), Type.Literal("dependency")])` inline (rather than a named constant) is what "follow the neighbouring fields" means. Based on `MARKETPLACE_RECORD_SCHEMA.scope` at `state-io.ts:264` using exactly that shape. | § Standard Stack | Cosmetic; a reviewer may prefer a named tuple. Low. |
| A3 | Three waves rather than two is the safer cut given `parallelization: true`. I did not verify how the executor orders tasks *within* a wave. | § 6 | If within-wave ordering is in fact guaranteed sequential, three waves is merely slightly slower. |
| A4 | No new production module is needed, so `check-corresponding-tests.mjs` and the 100%-run-alone coverage rule impose no new obligation. Depends on Open Question 1 resolving without a new messaging module. | § Validation Architecture | If PROV-03 needs a new outcome arm, a new `*.messaging.ts` surface (and its pair) may be required. |
| A5 | `pre-commit` is not installed as a git hook in this checkout and must be run by hand. Carried from an operator memory note; not probed this session. | § Environment Availability | A commit could land without hook checks; CI `lint.yml` would catch it on the PR. |
| A6 | The stale dev-tree config entries left after step 3 (Pitfall H) are inert and need no cleanup. Reasoned from `classifyDeclaredPlugin`'s declared+recorded+enabled steady state (`plan.ts:465-475`); not exercised end to end. | Pitfall H | If wrong, a dev tree would show spurious reconcile activity. Cheap to check during UAT. |

---

## Open Questions

### 1. **PROV-03 has no implementation today, and closing it may touch the closed output vocabulary. BLOCKING.**

- **What we know.** `install <plugin>@<marketplace>` where the plugin is already recorded in the
  target scope throws `PluginShapeError({ kind: "already-installed" })` at
  `install-outcome.ts:414-419` and renders a `(failed)` row carrying the closed-set reason
  `"already installed"` (`install.messaging.ts:376`). The closure walk never skips the root
  (`dependency-closure.ts:268-269`), so this is the one and only path for PROV-03's scenario. The
  PI-15 site is on the **non-mutating** arm, so a promotion written there would be discarded —
  `install-flow.ts` saves only on its mutating arm (`WR-04: the SOLE mutating arm saves explicitly`).
- **What's unclear.** What the user should SEE, and therefore how much of the pinned output surface
  this phase touches. Three candidate answers, with costs:

  | Option | Shape | Cost |
  |--------|-------|------|
  | **(a) Promote + report a new outcome** | `install B` on a dependency-installed `B` promotes provenance to `"explicit"`, writes `B@mp` into the config (consistent with D-04-02), and reports a distinct row. | A new `REASONS` member + a `docs/output-catalog.md` row + a `catalog-uat` fixture + a bump of `catalog contract matches all 20 fixture modules to 205 exact documented states` + `notify-closed-set-locks.test.ts`. **Largest.** |
  | **(b) Promote + reuse `already installed`** | Same state change, but the row keeps today's bytes. | No vocabulary change, but an operation that mutates state while reporting `(failed) {already installed}` is arguably dishonest, and it contradicts the notification tri-state model in the operator's own memory (*error = not carried out*). |
  | **(c) Promote via the config, not the command** | Read PROV-03 as "the user names it in `claude-plugins.json`". D-04-02 makes a config-named plugin explicit by definition (CONTEXT `<specifics>`: *"is a config-named plugin explicit? — trivially yes"*), so reconcile promotes a declared record whose provenance reads `"dependency"`. | `plan.ts` is **pure** and gated by `reconcile-planner-purity.test.ts`, so the promotion must be an apply-side action — i.e. a new reconcile bucket or fold, which D-04-05 explicitly scopes out ("exactly one exemption is added"). |

- **Recommendation.** Take this to the operator before planning. My reading is that **(a)** is what
  the ROADMAP's criterion 3 actually promises ("becomes directly-installed when the user installs it
  by name, and no other record changes") and that (c) is a different requirement wearing PROV-03's
  clothes. But (a) expands this phase into the catalog, which nothing in D-04-01..06 anticipated —
  so it is the operator's call, not mine.

### 2. **`PROV-NN` collides with a shipped requirement family. Needs a naming ruling.**

- **What we know.** `PROV-01..07` already means *git auth **prov**ider* in this codebase, with 48
  citations. `install-flow.ts` cites both families' worth of anchors today.
- **What's unclear.** Whether to (i) anchor this phase's comments on `D-04-NN` only, (ii) qualify the
  new IDs in source (e.g. `INST-PROV-01`), or (iii) renumber the v1.20 requirement family.
- **Recommendation.** (i) for this phase — it is zero-cost, C8 already blesses decision IDs as
  first-class anchors, and it leaves `REQUIREMENTS.md` untouched. Raise (iii) with the operator as a
  milestone-level hygiene question, since Phase 5's `PRUNE-NN` has no such collision and the problem
  is contained to PROV.

### 3. Does the phase summary need to name the mislabelled dev-tree records?

- **What we know.** The fill labels every Phase-3-written dependency record `"explicit"`. The
  ROADMAP accepted this. `--prune` (Phase 5) will therefore decline to prune those specific plugins
  on the operator's own machine.
- **Recommendation.** One sentence in the phase summary plus a note in Phase 5's UAT: if a Phase-5
  `--prune` UAT "fails to prune an obvious dependency", this is why, and the remedy is to uninstall
  and reinstall it rather than to debug `--prune`.

---

## Sources

### Primary (HIGH confidence — read or executed this session)
- `extensions/pi-claude-marketplace/persistence/state-io.ts` (full read) — schema, clone, load/save.
- `extensions/pi-claude-marketplace/persistence/migrate.ts` (full read) — the ENBL-02 fill template.
- `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:430-545` — `buildUninstallBucket`,
  `classifyDeclaredPlugin`, `diffPlugins`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts:247-330, 405-470, 1150-1420`
  — ledger-options builder, `writeOrchestratedDeclarations`, both config-write arms.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:145-215, 380-470, 900-1010`
  — options type, PI-15 sanity check, statePhase.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts:500-730` — RESV-05,
  `checkInstalledMember`, member phase and undo.
- `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts` (full read).
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:780-860` — `writeAdoptingConfigEntries`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:300-345` — the second
  ledger composition root.
- `extensions/pi-claude-marketplace/domain/dependency-closure.ts:268-269` — the root-never-skipped guard.
- `extensions/pi-claude-marketplace/shared/notification-types.ts:6-70` — the closed `REASONS` set.
- `tests/architecture/compat-01-no-expansion.test.ts:400-560`, `tests/architecture/hooks-foundation.test.ts:30-60`.
- `tests/orchestrators/plugin/install-flow.test.ts:3486-3580, 4828-4875`.
- `package.json` scripts; `.planning/config.json`; `scripts/check-corresponding-tests.mjs`;
  `scripts/test-coverage-direct.mjs`.
- `.agents/skills/typescript-unit-testing-review/SKILL.md`; `.claude/rules/typescript-comments.md`.
- `docs/dependency-resolution.md:105-125,155`; `README.md:344`.
- `.planning/milestones/url-source-REQUIREMENTS.md:43` — the colliding PROV family.

### Probes executed this session (HIGH confidence — all reverted, tree verified clean)
1. Schema-field-only probe → `tsc --noEmit` → 54 diagnostics (3 production, 51 test across 31 files);
   error codes `44×TS2741, 6×TS2322, 3×TS2345, 1×TS2719`.
2. `fallow health --complexity --max-cognitive 1 --max-cyclomatic 1 --format json` before/after →
   per-function cyclomatic/cognitive for `migrateLegacyMarketplaceRecords`, `buildUninstallBucket`,
   `ensurePluginProvenance`.
3. `fallow health --complexity --fail-on-issues` at real thresholds → exit 0 at cognitive 15
   (ceiling is inclusive).
4. `eslint --rule '{"sonarjs/cognitive-complexity":["error",1]}'` before/after → sonarjs scores.
5. Six-file full probe implementation → production `tsc` clean (`PROD_ERRORS=0`), then
   `node --test` over the unit glob → `# tests 6363 / # pass 5502 / # fail 861`, attributed by file
   and partitioned into `saveState`-refusal vs. behavioral.
6. `rg -o "PROV-[0-9]+"` over `extensions/ tests/ docs/` → the ID-collision census.

Restore verification: `git status --porcelain extensions/ tests/` empty; `tsc --noEmit` silent.

### Not consulted
No external documentation, package registry or web source was needed: this phase adds no dependency
and every mechanism has an in-repo precedent. No `research-plan` seam invocation was warranted.

---

## Metadata

**Confidence breakdown:**
- Write-site census: **HIGH** — enumerated by the compiler, not by reasoning.
- schemaVersion blast radius: **HIGH** — six source sites read verbatim; four architecture pins
  observed failing under probe (CONTEXT named three).
- Complexity budget: **HIGH** — measured before and after with both tools at real and lowered
  thresholds.
- Test blast radius: **HIGH** for the counts and the file attribution; **MEDIUM** for A1's inference
  about how much collapses mechanically.
- Config-write removal: **HIGH** for what it touches; **MEDIUM** for whether
  `writeOrchestratedDeclarations` should be collapsed into its caller rather than slimmed.
- Three-step feasibility: **HIGH** — each step's end state reasoned against the actual predicates and
  the CR-01 test's own assertions.
- PROV-03: **LOW / BLOCKED** — no implementation exists and the design question is unanswered.

**Research date:** 2026-09-15
**Valid until:** 2026-10-15 for the stack; **invalidated immediately** by any commit touching
`state-io.ts`, `migrate.ts`, `plan.ts`, `install-flow.ts`, `install-outcome.ts` or
`reinstall-record.ts` — the line numbers above are exact and this tree moves.
