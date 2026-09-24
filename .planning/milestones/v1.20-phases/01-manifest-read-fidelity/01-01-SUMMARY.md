---
phase: 01-manifest-read-fidelity
plan: 01
subsystem: domain
tags: [plugin-manifest, resolver, versioning, filesystem, typescript]

# Dependency graph
requires: []
provides:
  - "MANIFEST_CANDIDATES — the ordered, frozen manifest candidate list exported from domain/manifest-path.ts"
  - "domain/resolver.ts::readManifest walking that ordering with absence-only fall-through"
  - "orchestrators/plugin/shared.ts::resolvePluginVersion tier 1 walking the same ordering, stat-gated"
  - "tests/architecture/manifest-read-agreement.test.ts — the behavioral cross-reader gate, open for a third reader"
affects: [01-02, 01-03, 01-04, dependency-resolution, install-provenance]

actuals:
  tokens: 6250
  tasks: 2
  commits: 3
plan_head_before: c8899de2c214ec9790907149f6d27a569321c21b

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared ordered-candidate constant in domain/, consumed by every reader; each reader keeps its own I/O and error contract"
    - "Absence-only fall-through: a present-but-unusable candidate ends the walk instead of handing off"
    - "Behavioral cross-reader gate that plants a real tree on disk rather than grepping source"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/manifest-path.ts
    - tests/domain/manifest-path.test.ts
    - tests/architecture/manifest-read-agreement.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
    - tests/domain/resolver.test.ts
    - tests/orchestrators/plugin/shared.test.ts

key-decisions:
  - "MANIFEST_CANDIDATES ships as pre-joined RELATIVE paths built with path.join at module load, so each reader does one path.join(pluginRoot, candidate) and the byte form is right on Windows (D-01-06, CONTEXT discretion resolved)."
  - "readManifest keeps its post-stat body byte-for-byte and only gains the loop wrapper, so both reason strings and the {ok:true, manifest:null} arm are unchanged."
  - "resolvePluginVersion tier 1 extracts into two module-private helpers (manifestCandidateExists, readDeclaredPluginVersion) rather than an inline loop, so the never-throws contract and the D-01-07 stop condition each read in one place."
  - "manifestCandidateExists treats a denied stat (anything other than ENOENT / ENOTDIR) as PRESENT, because a stat this process was not allowed to make is not evidence of absence (D-01-07, D-01-09)."

patterns-established:
  - "Ordered-candidate constant: one frozen export names every location a file may live at; the ORDER is the stability contract, and readers loop it rather than joining their own path."
  - "Absence-only fall-through: only a path that is not there advances the walk. Unreadable, unparseable and schema-invalid all end it."
  - "Negative-control verification: a gate is proved by temporarily removing the behavior and confirming the new cases go red."

requirements-completed: [MANF-01, MANF-02, MANF-04, MANF-05]

coverage:
  - id: D1
    description: "Both manifest readers consume the single exported MANIFEST_CANDIDATES ordering; neither builds a manifest path of its own."
    requirement: MANF-01
    verification:
      - kind: unit
        ref: "tests/domain/manifest-path.test.ts#orders the wrapped manifest location ahead of the bare one"
        status: pass
      - kind: other
        ref: "grep -n MANIFEST_CANDIDATES over domain/resolver.ts and orchestrators/plugin/shared.ts — both consume it; grep -rn '\"plugin.json\"' over extensions/ returns no hand-built path"
        status: pass
    human_judgment: false
  - id: D2
    description: "A plugin whose only manifest is a bare <pluginRoot>/plugin.json is honored by the resolver and by the version reader."
    requirement: MANF-01
    verification:
      - kind: integration
        ref: "tests/architecture/manifest-read-agreement.test.ts#both readers honor a manifest that lives only at the bare path"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver.test.ts#MANF-01 a manifest at the bare plugin.json path is honored"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts#MANF-01 reads tier 1 from a manifest at the bare plugin.json path"
        status: pass
    human_judgment: false
  - id: D3
    description: "A plugin shipping both manifest locations resolves from .claude-plugin/plugin.json in both readers; the bare file cannot change the outcome."
    requirement: MANF-02
    verification:
      - kind: integration
        ref: "tests/architecture/manifest-read-agreement.test.ts#both readers prefer the wrapped manifest over a bare sibling"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver.test.ts#MANF-02 the wrapped plugin.json wins over a bare sibling"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts#MANF-02 prefers the wrapped manifest version over a bare sibling"
        status: pass
    human_judgment: false
  - id: D4
    description: "A manifest candidate that is present but unusable — malformed, or present-but-unreadable — never hands off to the next candidate, in either reader."
    requirement: MANF-04
    verification:
      - kind: unit
        ref: "tests/domain/resolver.test.ts#D-01-10 a malformed wrapped plugin.json is not rescued by a valid bare sibling"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver.test.ts#MANF-04 a malformed bare plugin.json is reported rather than skipped"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver.test.ts#D-01-09 an unreadable plugin.json reports malformed rather than absent"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/shared.test.ts#D-01-07 falls to the marketplace entry when the wrapped manifest is unparseable"
        status: pass
    human_judgment: false
  - id: D5
    description: "A plugin with neither manifest location present still resolves { ok: true, manifest: null } and still installs."
    requirement: MANF-05
    verification:
      - kind: integration
        ref: "tests/architecture/manifest-read-agreement.test.ts#both readers tolerate a plugin declaring no manifest at either path"
        status: pass
      - kind: unit
        ref: "tests/domain/resolver.test.ts#DFEN-02 entry silent + no plugin.json on disk -> installable carrying true"
        status: pass
    human_judgment: false

# Metrics
duration: 42 min
completed: 2026-09-13
status: complete
---

# Phase 1 Plan 1: Manifest read fidelity Summary

**A plugin's manifest now has one ordered set of locations — `MANIFEST_CANDIDATES` — walked by the resolver and by the version reader alike, so a bare `<pluginRoot>/plugin.json` is finally opened and a present-but-unusable candidate never hands off to its sibling.**

## Performance

- **Duration:** 42 min
- **Started:** 2026-09-13T16:04:00Z
- **Completed:** 2026-09-13T16:46:00Z
- **Tasks:** 2
- **Files modified:** 7 (3 created, 4 modified)

## Accomplishments

- `extensions/pi-claude-marketplace/domain/manifest-path.ts` exports the ordered, frozen candidate list. Element `[0]` is `.claude-plugin/plugin.json`, element `[1]` is the bare `plugin.json`, both pre-joined with `path.join` at module load so a reader does exactly one join onto a plugin root.
- Both readers were rewired onto it. `domain/resolver.ts::readManifest` wraps its existing stat-then-read gate in a loop and `continue`s only on a stat miss; every byte after the gate — the read, the `JSON.parse`, the `PLUGIN_MANIFEST_VALIDATOR` arm, both `malformed plugin.json:` reasons and the `{ ok: true, manifest: null }` arm — is unchanged. `orchestrators/plugin/shared.ts::resolvePluginVersion` tier 1 now stats each candidate before reading it, replacing a swallow-everything `catch` that could not tell absence from unreadable.
- `tests/architecture/manifest-read-agreement.test.ts` is the D-01-12 behavioral gate: it plants real trees under `mkdtemp` and drives `resolveStrict` (no seams injected, real disk) and `resolvePluginVersion` against the same tree. Its header leaves the reader list open for the third reader plan 01-04 adds.
- Eight per-reader unit cases cover precedence, both malformed shapes, the present-but-unreadable candidate and the absence-only fall-through — five on the resolver, three on the version reader, all insertions.

## Task Commits

1. **Task 1 (tracer, TDD): planted bare `plugin.json` honored by both readers**
   - RED — `7b80b498` `test(domain): gate manifest reader agreement on a planted tree`
   - GREEN — `b9a6e95d` `feat(domain): read a plugin manifest from one shared candidate list`
   - REFACTOR — none. The GREEN implementation already cleared both complexity ceilings and every gate; committing a no-op refactor would have been noise.
2. **Task 2: per-reader unit coverage** - `6586a1f7` `test(domain): cover manifest precedence and unusable candidates`

**Plan metadata:** committed separately with this SUMMARY.

### TDD Gate Compliance

- **RED** — `node --test --test-reporter=tap tests/architecture/manifest-read-agreement.test.ts`, exit 1. Target test `both readers honor a manifest that lives only at the bare path` failed on its own assertion (`resolved.defaultEnabled`, `true !== false`), not on a load or fixture error; the other two cases in the file passed, which is correct — they pin behavior that already held. Verified via `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK` / `target_test_failed`, evidence `tests: 3, pass: 2, fail: 1`.
- **GREEN** — the same command exits 0, 7 of 7 passing across the gate and the new paired test.
- **REFACTOR** — not entered; no change, so no commit (the reference permits this).

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/manifest-path.ts` — the ordered candidate list, its three-consumer header, and the stability-contract note saying the ORDER is the contract.
- `tests/domain/manifest-path.test.ts` — mandatory corresponding-test pair; asserts the ordering, the element count, that the value is frozen, and that no candidate is absolute.
- `tests/architecture/manifest-read-agreement.test.ts` — the cross-reader behavioral gate (bare-only, both-present, neither-present).
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `readManifest` loops the shared ordering; `import { MANIFEST_CANDIDATES }` added.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` — `manifestCandidateExists` and `readDeclaredPluginVersion` added; `resolvePluginVersion` tier 1 reduced to one call; `stat` added to the existing `node:fs/promises` import.
- `tests/domain/resolver.test.ts` — five cases, insertions only, one hunk.
- `tests/orchestrators/plugin/shared.test.ts` — three cases inside the existing `describe("resolvePluginVersion")`, insertions only; the five pre-existing cases are byte-unchanged.

## Decisions Made

- **Candidate representation (CONTEXT discretion under D-01-06):** pre-joined relative paths, not nested arrays. Each reader does one `path.join(pluginRoot, candidate)`, and building the entries with `path.join` at module load keeps the Windows byte form aligned with the platform joiner.
- **Version-reader shape:** tier 1 became two module-private helpers rather than an inline loop with a trailing `break`. The `break`-terminated form was written first and read badly — the stop condition was implicit in control flow. `readDeclaredPluginVersion` returning `string | undefined` states it directly, and `resolvePluginVersion` keeps its three tiers visible as three statements.
- **Denied stat counts as present.** `manifestCandidateExists` returns `false` only for `ENOENT` and `ENOTDIR`. Every other stat failure is a path this process could not inspect, and D-01-07 admits absence as the sole reason to try the next candidate — so the walk stops and tier 2 answers, which also preserves the never-throws contract the resolver's rethrowing `defaultStatKind` cannot have here.
- **No `readManifest` helper extraction.** The plan said everything after the stat gate stays as it is; keeping it inline made the diff a pure wrapper and left both reason strings provably untouched. Measured cognitive complexity stayed well under both ceilings.

## Deviations from Plan

None - plan executed exactly as written.

The plan's own commit discipline overrides the GSD `{type}({phase}-{plan})` scope convention: CLAUDE.md forbids milestone, phase, plan and wave references in commit messages, so the three commits use `test(domain)` / `feat(domain)` scopes and cite durable spec IDs in their bodies instead. That is the plan's instruction, not a deviation from it.

## Issues Encountered

- **TruffleHog cannot run in this linked worktree**, as CLAUDE.md documents: its pre-commit entry is a git-mode scan and `.git` here is a file, so it aborts on `failed to read index file`. Cleanliness was confirmed on every commit by the documented filesystem route (`trufflehog filesystem <paths> --results=verified,unknown --fail`, `verified_secrets: 0`, `unverified_secrets: 0`) before prefixing each commit with `SKIP=trufflehog`. No other hook was skipped and `--no-verify` was never used.
- **A green test proves nothing until you make it red.** Rather than trust three new bare-manifest cases that passed on first run, the bare candidate was temporarily removed from `MANIFEST_CANDIDATES` and the suites re-run: seven of the new cases went red and the pre-existing ones stayed green. The module was then restored and verified byte-identical (`git diff` empty).

## Known Regression Window (closed by plan 01-03)

Making the bare manifest readable is what causes `ui-theme-designer` to start emitting two duplicate-skill warnings it does not emit today — it declares `"./skills/<name>"`, and the skills bridge's convention probe re-enumerates the same directories once the manifest is actually opened. This is expected and is D-01-21's scope, not this plan's. **Plan 01-03 must land before the phase can claim ROADMAP criterion 3.** Nothing here should be "fixed" to suppress it.

## Verification

Every `<verify>` command in the plan was run, and the plan-level `<verification>` block on top of them:

| Command | Result |
|---|---|
| `node --test tests/architecture/manifest-read-agreement.test.ts tests/domain/manifest-path.test.ts` | 7 pass, 0 fail |
| `node --test tests/domain/resolver.test.ts tests/orchestrators/plugin/shared.test.ts` | 242 pass, 0 fail |
| `npm run test:corresponding` | `Corresponding-test gate passed.` |
| `npm run typecheck` | clean, no `error TS` |
| `npm run lint` | exit 0, no ` error ` lines |
| `npm run fallow` | exit 0 — `dead-code` no issues, `health` 0 above threshold, `dupes` below threshold with no clone group naming the new code. No `thresholdOverrides` and no `ignoredClones` entry was added. |
| Pre-change baseline suites (`resolver` + `skills/discover` + `plugin/shared`) | 244 pass, 0 fail before; 249 pass, 0 fail after (the delta is the new cases) |
| `npm run check` (full 9-link chain) | exit 0 — 5309 unit + 31 integration passing |

## Next Phase Readiness

- `MANIFEST_CANDIDATES` is exported and consumed; plan 01-04's third reader in `orchestrators/plugin/info.ts` imports it the same way, and the architecture gate's header already anticipates a third half.
- Plan 01-02 (`domain/dependencies.ts`) and plan 01-03 (`bridges/skills/discover.ts` `seenByDir`) are unblocked and touch no file this plan changed.
- The one carried concern is the regression window above: plan 01-03 is now load-bearing for the phase's ROADMAP criterion 3, not optional cleanup.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/manifest-path.ts` — FOUND
- `tests/domain/manifest-path.test.ts` — FOUND
- `tests/architecture/manifest-read-agreement.test.ts` — FOUND
- `7b80b498`, `b9a6e95d`, `6586a1f7` — all three FOUND in `git log`
- `git rev-list --count c8899de2..HEAD` = 3, matching `actuals.commits`
- `.planning/STATE.md` and `.planning/ROADMAP.md` — not modified by this plan (orchestrator owns them)

---
*Phase: 01-manifest-read-fidelity*
*Completed: 2026-09-13*
