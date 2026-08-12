---
phase: 99-post-audit-tech-debt-closure
plan: 05
subsystem: domain
tags: [manifest, membership, drift-gate, refactor]
status: complete

requires:
  - "99-03: notify.ts and list.ts comment sites settled, so this plan's edits met no conflicting change"
  - "99-04: update.ts row composition landed before this plan rewired update's absence judgment"
provides:
  - "domain/manifest-lookup.ts: the ManifestLookup discriminant and lookupDeclaredPlugin, the one writing of the membership rule"
  - "list, info and update all judge manifest absence from that one derivation"
  - "tests/architecture/manifest-lookup-drift.test.ts: a whole-tree drift gate with a five-member, purpose-stated allowlist"
affects:
  - "any future surface that needs to ask whether a manifest declares a plugin -- it must consume the derivation or the gate fails"

tech-stack:
  added: []
  patterns:
    - "a domain rule exported as a VALUE plus a source-walking gate, so the duplication that exists is removed and the duplication that would exist tomorrow is blocked"
    - "an allowlist entry carries what its site looks the entry up FOR, and a staleness clause deletes an entry that stops matching"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/manifest-lookup.ts
    - tests/architecture/manifest-lookup-drift.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts

decisions:
  - "The soft-read wrapper and the `unverified` arm stay in list. Only list continues rendering past a failed read, so the read outcome is a per-surface I/O fact (BOUND-03 / D-95-05), not a membership fact."
  - "The exported derivation's return type excludes `unverified`, so a surface cannot call it and then claim absence about a manifest it never parsed."
  - "The derivation takes the `plugins` collection structurally rather than a whole `MarketplaceManifest`, because `update` holds its cached read as a narrowing whose array is `readonly`."
  - "The gate walks the whole extension tree rather than enumerating the sites that once held a copy; the allowlist names only the five non-absence lookups, each with its purpose."

requirements-completed: [D-99-02a]

metrics:
  duration: ~35m
  completed: 2026-08-10

actuals:
  tokens: 6000
  tasks: 3
  commits: 3
---

# Phase 99 Plan 05: Manifest-Membership Rule Summary

**The question "does this manifest declare this plugin" is now asked in one place and answered the same way on every surface that renders the answer, with a source walk standing between the tree and a fourth copy.**

## What Was Built

The rule was written three times: in `list.ts`, in `info.ts` and in `update.ts`. Only one of the three writings — list's — was guarded on a successful read. The audit's integration checker named this the largest remaining warning and set the bar: a fourth surface copying the idiom without the read-success guard would reintroduce the manifest-absence defect ungated.

`domain/manifest-lookup.ts` now exports the `ManifestLookup` discriminant and `lookupDeclaredPlugin`. The derivation covers the successful-read half only — exact string identity on `plugins[].name`, no case folding, no Unicode normalization — and its return type is narrowed to `declared | absent`, so it is structurally unable to express what a failed read means. The three surfaces consume it and keep their own, deliberately different read-failure handling.

The gate is the other half. It walks every `.ts` file under the extension tree and flags the raw idiom in three spellings, exempting the module that owns the rule and five sites that look an entry up for something other than judging absence.

## Task Commits

| Task | Name | Commit |
| --- | --- | --- |
| 1 (tracer) | Domain module plus the list consumer | `cb3bd8d3` |
| 2 | Rewire info and update onto the exported derivation | `2bbbe0dc` |
| 3 | Drift gate against a fourth re-derivation | `eedd789d` |

## Final Module and Exported Names

`extensions/pi-claude-marketplace/domain/manifest-lookup.ts` exports:

- `type ManifestLookup` — three arms: `declared` (carrying the entry), `absent`, `unverified`. All three live in the type although the derivation produces only two, because list's wrapper produces the third and every consumer switches on the same union.
- `function lookupDeclaredPlugin(manifest, pluginName): Extract<ManifestLookup, { kind: "declared" | "absent" }>` — the successful-read half.

The internal alias `ManifestPluginEntry` (`MarketplaceManifest["plugins"][number]`) is used in both the `declared` arm and the parameter, so the two are provably the same type.

Placement is `domain/` because the rule is a pure, network-free, write-free derivation over a domain type, and because `domain/` depends only on `shared/` — no consumer can close a cycle by importing it. `npm run lint` (with `import-x`'s cycle rule) exits 0.

## The Allowlist as Shipped

Five entries, each stating what its site looks the entry up FOR:

| Site | Stated purpose |
| --- | --- |
| `orchestrators/plugin/install.ts` | Fetches the entry it is about to INSTALL (the resolver's input). A miss throws `PluginShapeError` kind `not-in-manifest`; it renders no absence row. |
| `orchestrators/plugin/reinstall.ts` | Fetches the entry it is about to REINSTALL from the cached manifest. A miss throws; it renders no absence row. |
| `orchestrators/reconcile/pending.ts` | Fetches the entry a pending install would materialize. A miss means "not a candidate" (returns `undefined`) — the scan emits nothing, so no claim is made about the record. |
| `orchestrators/reconcile/apply.ts` | Fetches the entry to resolve OFFLINE when re-materializing a recorded plugin. A miss returns `undefined` and the plugin is left alone. |
| `orchestrators/edge-deps.ts` | Feeds the completion cache's upgrade-candidate compare (PL-5 version diff). A miss reads as "not upgradable"; the cache row carries no absence reason. |

Every one was read before it was allowlisted; none of the five turns a miss into a rendered absence claim. The plan's pre-verified enumeration matched the tree exactly after tasks 1 and 2 removed three of the original eight writings.

A staleness clause backs the list: the walk records which allowlisted files actually matched and asserts the two sets are equal, so an entry that stops writing the idiom must be deleted rather than left as evidence of a copy that is no longer there.

## No Existing Test Assertion Was Edited

Explicit confirmation, as the plan requires. Across all three commits the only test file in the diff is the NEW gate:

```text
extensions/pi-claude-marketplace/domain/manifest-lookup.ts     | 60 ++
extensions/pi-claude-marketplace/orchestrators/plugin/info.ts  | 16 +-
extensions/pi-claude-marketplace/orchestrators/plugin/list.ts  | 31 +--
extensions/pi-claude-marketplace/orchestrators/plugin/update.ts| 13 +-
tests/architecture/manifest-lookup-drift.test.ts               | 305 +++
```

Every existing absence assertion passed unchanged: list's manifest-absent inventory rows (90/90 in the two list suites, identical to the pre-edit baseline), info's manifest-absent arms and update's `{not in manifest}` failed and skipped rows (192/192 across the four task-2 suites), and the byte-pinned catalog states in `catalog-uat`. No rendered byte, status token, reason or severity moved.

## The Gate Proven Load-Bearing

The planted-twin self-test pins each pattern's reach with inline literals — parenthesised and bare arrow parameters, double- and single-quoted comparison targets with inner whitespace, a block-bodied predicate, and a destructured `({ name }) =>` binding. Three controls pin what the patterns must leave alone: a legitimate call into the rule, a name predicate over a different collection, and a `plugins` find on a different field.

Beyond the self-test, the walk half was confirmed against the real pre-refactor tree: running `RAW_LOOKUP_ARROW` over `info.ts` and `update.ts` at commit `cb3bd8d3` (before task 2 rewired them) flags both. The gate would have caught the two surfaces it was written to collapse, so it is not a pattern that merely matches its own twin.

No pattern carries the `g` flag, and a membership assertion proves each proven pattern actually reaches the walk.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The derivation's parameter had to be the `plugins` collection, not `MarketplaceManifest`**

- **Found during:** Task 2, at the first typecheck after rewiring `update`.
- **Issue:** `update.ts::loadCachedMarketplaceManifest` declares its return as `{ name: string; plugins: readonly PluginEntry[] }`. A `readonly` array is not assignable to the mutable `MarketplaceManifest["plugins"]`, so the call failed with TS2345.
- **Fix:** The parameter is `{ readonly plugins: readonly ManifestPluginEntry[] }` — the rule reads nothing else off the manifest, so taking the collection structurally is both sufficient and honest about what the derivation depends on. The entry type in the `declared` arm is unchanged.
- **Files modified:** `extensions/pi-claude-marketplace/domain/manifest-lookup.ts`
- **Commit:** `2bbbe0dc`

### Non-deviations worth recording

- Task 3 is marked `tdd="true"`, but its subject is a gate over code that tasks 1 and 2 had already made correct. A RED commit would have required deliberately breaking production code, so the RED obligation was met instead by proving the gate fires on the real pre-refactor sources at `cb3bd8d3` (recorded above) and on six planted twins. The task shipped as one test-only commit.
- Prettier rewrapped one regex declaration in the gate file during the pre-commit run; the file was restaged and the gate re-run green before committing.
- The `import-x/order` rule sorts `domain/manifest-lookup.ts` BEFORE `domain/manifest.ts` (the `-` sorts under `.`), which is how all three import blocks are written.

## Verification

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `node --test tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/list-manifest-absent.test.ts` | 90/90 — identical to the pre-edit baseline |
| `node --test .../info.test.ts .../info-manifest-absent.test.ts .../update.test.ts .../catalog-uat.test.ts` | 192/192 |
| `node --test tests/architecture/manifest-lookup-drift.test.ts` | 4/4, self-test included |
| `npm run lint` | exit 0 — no cycle, explicit return type present |
| `PI_SUBAGENTS_ROOT=... npm run check` | **exit 0** — 3398 unit (0 fail, 1 pre-existing platform-conditional skip) + 18 integration (0 fail) |

Every exit code was read directly from a redirected file, never through a pipe.

## Known Stubs

None. The rule has one writing, all three surfaces consume it, and the gate walks the whole tree rather than an enumerated subset.

## Threat Flags

None. `T-99-05-01` (an absence claim about an unparsed manifest) is mitigated by the derivation's return type plus the gate's two halves. `T-99-05-02` (layering) is mitigated by the `domain/` placement, with `npm run lint` as the control. `T-99-05-03` is accepted as planned — the derivation operates on an already-validated manifest and adds no parsing surface. `T-99-05-04` (gate regex cost) is mitigated: bounded character classes, one bounded lazy segment, no nested quantifier, no global flag. No package was installed.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/manifest-lookup.ts` — FOUND
- `tests/architecture/manifest-lookup-drift.test.ts` — FOUND
- `.planning/phases/99-post-audit-tech-debt-closure/99-05-SUMMARY.md` — FOUND
- Commits `cb3bd8d3`, `2bbbe0dc`, `eedd789d` — all FOUND in `git log`
- `grep -rn "plugins\.find(" extensions/` returns the domain module plus exactly the five allowlisted sites
- `.planning/STATE.md` / `.planning/ROADMAP.md` — unmodified by this plan
