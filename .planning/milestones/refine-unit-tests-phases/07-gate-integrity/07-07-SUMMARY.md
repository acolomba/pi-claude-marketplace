---
phase: 07-gate-integrity
plan: 07
subsystem: architecture-gates
tags: [eslint, gate-integrity, effective-config, import-boundaries, no-console]
status: complete

requires:
  - "tests/architecture/gate-targets.ts (07-01 registry)"
  - "tests/architecture/source-scan.ts REPO_ROOT / stripComments"
provides:
  - "tests/architecture/eslint-effective-config.ts — shared calculateConfigForFile resolver + three offender blocks"
  - "resolved no-console severity sweep over the whole extension tree"
  - "resolved import-x/no-restricted-paths zone matrix + two offender proofs"
  - "per-name positive, dynamic-form, and negative controls for both joined ledger regexes"
affects:
  - "tests/architecture/import-boundaries.test.ts"
  - "tests/architecture/hooks-dispatch.test.ts"
  - "eslint.config.js"

tech-stack:
  added: []
  patterns:
    - "resolve the effective config through ESLint's own loader rather than reading config source"
    - "offender = real eslint.config.js + exactly one appended in-memory block"
    - "gate contract written as a named assertion so an offender can be driven through it"

key-files:
  created:
    - tests/architecture/eslint-effective-config.ts
    - tests/architecture/eslint-effective-config.test.ts
  modified:
    - tests/architecture/import-boundaries.test.ts
    - tests/architecture/hooks-dispatch.test.ts
    - eslint.config.js
  deleted:
    - tests/fixtures/bad-imports/edge-imports-bridges.ts

key-decisions:
  - "The offender configs are in-memory `overrideConfig` blocks over the real `eslint.config.js`; `overrideConfigFile: true` appears nowhere."
  - "The exempt-set and zone contracts are extracted as named assertion functions so each offender is driven through the identical assertion the benign control uses."
  - "The derived ledger-name count is pinned against a literal rather than compared to the registry group length, because comparing a derived array's length to its own source is vacuous."

requirements-completed: [GGAT-01, GGAT-03]

coverage:
  - deliverable: "Both boundary gates read the ESLint config that actually applies to a file"
    verification:
      - kind: test
        ref: "tests/architecture/eslint-effective-config.test.ts#OBS-01: exactly the registered extension modules resolve no-console to off"
        status: pass
      - kind: test
        ref: "tests/architecture/import-boundaries.test.ts#D-11: the real config resolves no-restricted-paths to error with one zone per layer folder"
        status: pass
    human_judgment: false
  - deliverable: "Exactly three extension files resolve no-console to 0, proved over a full 229-file sweep"
    verification:
      - kind: test
        ref: "tests/architecture/eslint-effective-config.test.ts#OBS-01: exactly the registered extension modules resolve no-console to off"
        status: pass
    human_judgment: false
  - deliverable: "Both sides of the exempt boundary are pinned"
    verification:
      - kind: test
        ref: "tests/architecture/eslint-effective-config.test.ts#IL-3: a registered exempt module resolves no-console to off"
        status: pass
      - kind: test
        ref: "tests/architecture/eslint-effective-config.test.ts#IL-2: a module beside an exempt one resolves no-console to error"
        status: pass
    human_judgment: false
  - deliverable: "Three offenders flip the resolved value and fail the gate; the real config is the benign control"
    verification:
      - kind: test
        ref: "tests/architecture/eslint-effective-config.test.ts#GGAT-03: a blanket block disabling no-console flips the resolved severity and fails the gate"
        status: pass
      - kind: test
        ref: "tests/architecture/import-boundaries.test.ts#GGAT-03: a rule-off override resolves to severity 0 and fails the zone gate"
        status: pass
      - kind: test
        ref: "tests/architecture/import-boundaries.test.ts#GGAT-03: a zone-substitution override resolves to a one-zone matrix and fails the zone gate"
        status: pass
    human_judgment: false
  - deliverable: "Every joined-regex name carries a positive control, a dynamic-form companion, and a negative control"
    verification:
      - kind: test
        ref: "tests/architecture/import-boundaries.test.ts#D-11: the plugin-ledger patterns match a violation naming each plugin ledger"
        status: pass
      - kind: test
        ref: "tests/architecture/import-boundaries.test.ts#D-11: neither ledger pattern matches a specifier naming a non-ledger module"
        status: pass
    human_judgment: false
  - deliverable: "The two superseded gates and the fixture and ignore block they needed are gone"
    verification:
      - kind: command
        ref: "git grep -l loadZones -- . | grep -v '^.planning'  →  no hits; git ls-files tests/fixtures/bad-imports/  →  empty"
        status: pass
    human_judgment: false

metrics:
  duration: "1h 5m"
  completed: 2026-09-10

actuals:
  tokens: 41000
  tasks: 3
  commits: 4

commits: 4
plan_head_before: 360d4c2432903d636a0960ae213e3336aa8050fa
---

# Phase 07 Plan 07: Effective-Config Gate Integrity Summary

Both `GGAT-03` gaps now resolve the ESLint configuration that actually applies to a file through
`ESLint#calculateConfigForFile`, and three in-memory offenders built from the real
`eslint.config.js` prove each gate fires.

## Accomplishments

- **`tests/architecture/eslint-effective-config.ts`** — one shared resolver over ESLint's own
  loader, plus the three offender blocks and the "exactly one appended block" assertion. Every
  construction names the real config file; the boolean form of `overrideConfigFile` appears
  nowhere in the file (`grep -c` returns 0).
- **`no-console` closed-set gate** — sweeps all 229 `.ts` files under
  `extensions/pi-claude-marketplace/`, asserts a non-zero visited count, and deep-equals the
  resulting exempt set against `NO_CONSOLE_EXEMPT_TARGETS`. Severity 1 and rule-absent are
  asserted empty as separate clauses, because an off rule and an absent rule are different states.
- **Zone matrix gate** — probes one real module per layer folder from
  `ZONE_REPRESENTATIVE_TARGETS`, asserts severity 2 and eight zones, and deep-equals the resolved
  per-zone `from` sets against the D-11 matrix.
- **Three offender proofs** — each driven through the very assertion the benign control uses, via
  `assert.throws(..., assert.AssertionError)`.
- **Per-name controls on both joined ledger regexes** — a synthesized static specifier, a
  synthesized `await import()` specifier, and an on-disk read, all in one loop per direction, plus
  a negative control naming a real non-ledger module.
- **Deletions** — the `hooks-dispatch.test.ts` config scrape, `loadZones()`, the
  synthetic-`overrideConfig` canary with its 14-line explanatory comment block,
  `tests/fixtures/bad-imports/edge-imports-bridges.ts`, and `eslint.config.js` BLOCK D.

## Measured Results

**Extension `.ts` file count: 229** (`find extensions/pi-claude-marketplace -name '*.ts' | wc -l`),
matching the count research measured. The sweep asserts a **non-zero** count rather than pinning
229 — the `<behavior>` element states the non-zero form, and a hard pin would fail on every
unrelated new extension module while the deep-equal on the exempt set already fails if the sweep
collapses to zero.

**Resolved exempt set (severity 0), sorted — exactly three, matching `NO_CONSOLE_EXEMPT_TARGETS`:**

```
extensions/pi-claude-marketplace/persistence/migrate.ts
extensions/pi-claude-marketplace/shared/debug-log.ts
extensions/pi-claude-marketplace/shared/notification-dispatch.ts
```

226 resolve to severity 2. Zero resolve to severity 1. Zero resolve with `no-console` absent.

**Offender resolution table, measured this session against the real config:**

| Config source | `no-console` | `no-restricted-paths` severity | zones |
|---------------|--------------|--------------------------------|-------|
| real `eslint.config.js` (benign control) | `[2,{}]` | 2 | 8 |
| + `BLANKET_NO_CONSOLE_OFF` | `[0,{}]` | 2 | 8 |
| + `RESTRICTED_PATHS_OFF` | `[2,{}]` | **0** | 8 |
| + `ZONE_SUBSTITUTION` | `[2,{}]` | 2 | **1** |

The `RESTRICTED_PATHS_OFF` row is `ABG-004` exactly: the eight zones survive the switch-off, so a
gate reading the options without the severity reports a healthy matrix for a rule that no longer
runs. The gate now asserts that survival explicitly, so the mechanism is documented by a passing
assertion rather than by prose.

### Negative control 1 — one appended block (observed, then restored)

A second block was temporarily appended to `RESTRICTED_PATHS_OFF`. **Two cases failed**, both with:

```
AssertionError [ERR_ASSERTION]: D-07-10: the restricted-paths off offender appends 2 blocks to
eslint.config.js, not one. An offender is the REAL configuration plus one mutation; more than one
makes it a rewritten configuration, which proves nothing about the configuration that ships.
```

(`D-07-10: every offender appends exactly one block to the real configuration` and
`GGAT-03: a rule-off override resolves to severity 0 and fails the zone gate`.) The constant was
restored from a byte copy and the suite returned to 12/12 passing.

### Negative control 2 — derived ledger-name count (observed, then restored)

`PLUGIN_LEDGER_TARGETS` was temporarily `.slice(1)`-ed inside `import-boundaries.test.ts` — a
faithful simulation of a name dropping out of the registry, without editing `gate-targets.ts`
(unowned this wave). **One case failed:**

```
AssertionError [ERR_ASSERTION]: PLUGIN_LEDGER_TARGETS carries 4 ledgers rather than 5. A name
removed from the group takes its positive control with it, so the count is pinned here rather than
derived -- otherwise the proof shrinks silently alongside the pattern it proves.
```

The file was restored from a byte copy and returned to 10/10 passing.

**Interpretation recorded:** the acceptance criterion reads "assert the derived name count equals
the registry group length". Taken literally that is vacuous — `PLUGIN_LEDGERS` is
`PLUGIN_LEDGER_TARGETS.map(...)`, so its length equals the source's length by construction and
removing a registry entry would shrink both sides together. The criterion's own follow-on
("confirm that assertion fails when a name is removed") only holds against a **literal** pin, so
`EXPECTED_PLUGIN_LEDGER_COUNT = 5` / `EXPECTED_MARKETPLACE_LEDGER_COUNT = 4` are pinned in the gate
and the failure above is the confirmation.

### The deleted canary's job

The canary at `import-boundaries.test.ts:316-419` proved that
`import-x/no-restricted-paths` emits the right `ruleId` when violated. It did so against a fixture
the real rule never applied to, through a fully synthetic `overrideConfigFile: true` config —
which is why `D-07-02` (amended) rejects it. **That job is now carried by the three offender
configs**, which resolve against real extension files through the real configuration and prove
the rule's severity and zone matrix change when the configuration changes. The `Why an
overrideConfig` comment block at `:325-338` was deleted in the same commit as the body it
explained, so no orphaned narration was left behind.

## Exports Added and Removed

Plan 07-15 pins the unowned-export census; every delta below is attributable to this plan.

**Added — `tests/architecture/eslint-effective-config.ts` (all consumed by a gate in this plan):**

| Line | Export |
|------|--------|
| 54 | `ResolvedRuleEntry` (type) |
| 57 | `EffectiveConfig` (interface) |
| 62 | `AppendedBlocks` (type) |
| 76 | `BLANKET_NO_CONSOLE_OFF` |
| 88 | `RESTRICTED_PATHS_OFF` |
| 100 | `ZONE_SUBSTITUTION` |
| 129 | `assertSingleAppendedBlock` |
| 146 | `resolveEffectiveConfigs` |
| 176 | `resolveEffectiveConfig` |
| 190 | `ruleSeverity` |

`npx fallow dead-code --fail-on-issues` exits 0, confirming every one of the ten has a consumer.

**Removed:** none. `loadZones()`, `FlatConfigBlock`, and `RestrictedPathsRule` in
`import-boundaries.test.ts` were module-private, never exported.

`resolveEffectiveConfigs` (plural) is not named in the plan's artifact list. It was added because
the single-file form constructs one `ESLint` instance per call: measured, a fresh instance costs
~20 ms, so the 229-file sweep would cost ~5 s instead of the 2.2 s a shared instance costs. The
singular `resolveEffectiveConfig` the plan names exists and delegates to it.

## Deviations from Plan

### 1. [Rule 3 - Blocker] Task 2 landed as two commits after a staging slip

- **Found during:** Task 2 commit
- **Issue:** `git add` was given the already-`git rm`-ed fixture path in the same invocation as the
  two modified files. `git add` aborted with `fatal: pathspec ... did not match any files`, and the
  commit that followed carried only the staged deletion.
- **Fix:** A second commit (`bff4ee82`) carried `import-boundaries.test.ts` and `eslint.config.js`,
  with a message stating it completes the previous one. No history was rewritten and no amend was
  used, per project policy.
- **Files modified:** none beyond the plan's own set.
- **Commits:** `d1174322` (fixture deletion), `bff4ee82` (the rest of Task 2).

### 2. [Interpretation] Sweep asserts a non-zero file count rather than pinning 229

Recorded above under "Measured Results". The plan's `<behavior>` element states the non-zero form;
the acceptance criterion offers "or records the current count in the SUMMARY if the tree has moved"
and the count is recorded (229, unchanged from research).

### 3. [Interpretation] Derived-name count pinned against a literal

Recorded above under "Negative control 2".

**Total deviations:** 1 auto-fixed (Rule 3), 2 recorded interpretations. **Impact:** none on the
delivered contract; every `<behavior>` clause and `<acceptance_criteria>` row is satisfied.

## Registry Groups Wanted (for 07-16)

Three path literals in this plan's files could not be sourced from `tests/architecture/gate-targets.ts`
because the wave does not own that file. Recorded here so 07-16 can close them:

1. **`orchestrators/marketplace` as a directory root.** `import-boundaries.test.ts` composes
   `` `${ORCHESTRATORS_REL}/marketplace` `` (named `MARKETPLACE_ORCHESTRATORS_REL`) for the
   marketplace-direction walk. `DIRECTORY_ROOT_TARGETS` carries `orchestrators` and
   `orchestrators/plugin` but not `orchestrators/marketplace`. This walk needs every module in the
   folder, not only the ledgers, so a file group cannot replace it.
2. **A `no-console` probe pair.** `eslint-effective-config.test.ts` borrows
   `ZONE_REPRESENTATIVE_TARGETS` for its two boundary probes (`shared/path-safety.ts`,
   `domain/manifest.ts`). Membership is compile-checked, so the reference cannot go stale, but a
   dedicated `NO_CONSOLE_PROBE_TARGETS` would say what the paths are for.
3. **Two non-ledger specifiers.** `PLUGIN_NON_LEDGER_SPECIFIER` (`../plugin/clone-cache.ts`) and
   `MARKETPLACE_NON_LEDGER_SPECIFIER` (`../marketplace/shared.ts`) are relative import specifiers,
   not repository-relative paths, so they do not fit the registry's current contract. A group of
   the repository-relative forms they correspond to would let the negative controls derive them.

## Verification

| Command | Result |
|---------|--------|
| `node --test tests/architecture/eslint-effective-config.test.ts` | 5 pass, 0 fail |
| `node --test tests/architecture/hooks-dispatch.test.ts` | 2 pass, 0 fail (the two unrelated sibling cases) |
| `node --test tests/architecture/import-boundaries.test.ts` | 10 pass, 0 fail |
| `node --test "tests/architecture/*.test.ts"` | 383 pass, 0 fail |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 (with BLOCK D removed — no remaining file depended on that ignore) |
| `npx prettier --check "**/*.{js,json,ts}"` | exit 0 |
| `npx fallow health --fail-on-issues` | exit 0, 0 above threshold |
| `npx fallow dead-code --fail-on-issues` | exit 0, no issues |
| `npx fallow dupes --fail-on-issues` | exit 0 |
| `grep -c "matchAll(/files:" hooks-dispatch.test.ts` | 0 |
| `grep -c "objectTail" hooks-dispatch.test.ts` | 0 |
| `grep -c "overrideConfigFile: true" eslint-effective-config.ts` | 0 |
| `grep -c "severity === 0\|=== 0)" eslint-effective-config.test.ts` | 1 |
| `grep -c "loadZones" import-boundaries.test.ts` | 0 |
| `git grep -l loadZones` outside `.planning/` | no hits |
| `git ls-files tests/fixtures/bad-imports/` | empty |
| `grep -c "9-zone" eslint.config.js` / `grep -c "Plan 05" eslint.config.js` | 0 / 0 |
| `grep -n '"g"' import-boundaries.test.ts` | no hits — all 4 `new RegExp(` patterns are non-global |

## Known Stubs

None.

## Threat Flags

None. No offender writes to the repository; every one is an in-memory `overrideConfig` array over
the real `eslint.config.js`, and each is asserted to hold exactly one block. `.fallowrc.json` is
neither read nor written by any gate in this plan (`D-07-20`).

## Notes on Shared-Tree Execution

Four sibling plans committed to `features/refine-unit-tests` concurrently. Consequences recorded
for the wave reconciler:

- `git rev-list --count 360d4c24..HEAD` reports **10**; **4** of those are this plan's
  (`2e67384e`, `d1174322`, `bff4ee82`, `c2894a0e`). `commits: 4` in the frontmatter is the
  plan-attributable count, measured with `git log --grep="07-07"`.
- `SKIP=trufflehog pre-commit run --files ...` reported `npm lint` / `npm typecheck` /
  `npm format check` as "files were modified by this hook" on two runs. Each hook is
  `pass_filenames: false` and none of them writes; the modifications were sibling writes landing
  mid-run. Re-running each command standalone returned exit 0 every time, and `git diff` confirmed
  none of this plan's files had been rewritten.
- No file outside this plan's `files_modified` set was edited.

## Next

Phase 07 continues — `07-12` through `07-16` remain. `07-16` should consume the three registry
groups recorded above.

## Self-Check: PASSED

- `tests/architecture/eslint-effective-config.ts` — FOUND
- `tests/architecture/eslint-effective-config.test.ts` — FOUND
- `tests/fixtures/bad-imports/edge-imports-bridges.ts` — DELETED (confirmed via `git ls-files`)
- Commits `2e67384e`, `d1174322`, `bff4ee82`, `c2894a0e` — all present in `git log`
- All plan-level `<verification>` commands re-run at close-out; every one exits 0
