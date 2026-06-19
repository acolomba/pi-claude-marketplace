---
phase: 260618-uns
plan: 01
subsystem: spec-docs
tags: [docs, requirements, prd, info-surface, glyph-catalog]
dependency-graph:
  requires:
    - shipped behavior on features/v1.13-hook-bridge (commits 8a7c278, 70017c5, a0011dd)
  provides:
    - REQUIREMENTS.md SURF-01 + SURF-02 aligned with shipped info-surface contract
    - PRD PL-4 aligned with the 4-glyph catalog and current closed-set status markers
  affects:
    - future planners reading SURF-01 / SURF-02 / PL-4 as authoritative
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - docs/prd/pi-claude-marketplace-prd.md
decisions:
  - Drop `v1.0+` anchor from SURF-01 (forbidden forward-incompatible reference).
  - Keep `components: not resolved` phrasing in SURF-01 ONLY inside the NFR-5 non-path-resolvable carve-out clause.
  - Append SURF-02 inline (no rewrite); existing HookSummary / ClaudeHookEvent / no-string-re-derivation claims are still accurate.
  - PL-4 status closed set drawn from notify.ts L277-296 / L506, with the composite `(installed, upgradable)` removed because `upgradable` is its own top-level status token.
metrics:
  duration: ~3min
  completed: 2026-06-18
---

# Phase 260618-uns Plan 01: Sync requirements with recent info/glyph behavior

Synced `.planning/REQUIREMENTS.md` (SURF-01 rewritten, SURF-02 amended) and
`docs/prd/pi-claude-marketplace-prd.md` (PL-4 rewritten) with three
already-shipped behavior changes on `features/v1.13-hook-bridge` so the spec
matches what the code does today.

## What changed

### Edit 1 — REQUIREMENTS.md SURF-01 (full rewrite)

SURF-01 previously claimed the `hooks:` line renders ONLY for installable
plugins and that unavailable plugins render `components: not resolved`. The
shipped behavior (per `info.ts::composeResolvedComponents` L382-435 and the
four `buildRow` arms) is broader: the `hooks:` line renders on EVERY
path-resolvable info row — resolver-success, resolver-bail-fallback,
available, AND unavailable. The new prose describes:

- The four path-resolvable arms that all flow through `composeResolvedComponents`.
- The `event(matcher)` vs `event`-alone rendering split for tool vs non-tool events on the resolver-success path.
- The lenient-reader path (`resolved.hooksConfigPath === undefined`) that walks the on-disk `<pluginRoot>/hooks/hooks.json` and emits one `kind: "lenient"` entry per non-empty group, with `(unsupported)` suffix for events outside `BUCKET_A_EVENTS`.
- The unchanged NFR-5 / INFO-05 carve-out for non-path-resolvable sources (`github` / `url` / `git-subdir` / `npm` / `unknown`) — these still emit `componentsResolved: false` with no on-disk walk.
- That TOOL-02's strict supportability policy is unchanged — this REQ governs the info surface's DESCRIPTION, not whether the plugin installs.

Forbidden phrasing removed: `v1.0+`, `ONLY for installable plugins`,
`unavailable plugins continue to render \`components: not resolved\``.

### Edit 2 — REQUIREMENTS.md SURF-02 (inline addendum)

The existing SURF-02 text (typed `HookSummary` discriminated model, closed-set
`ClaudeHookEvent` tuple, no-string-re-derivation contract, `GatingReason` /
`FidelityNote` removal) is still accurate and was preserved verbatim. Appended
an addendum describing the third tagged arm:

- `{ kind: "lenient"; event: string; groupCount: number; supported: boolean }`.
- Produced ONLY by the info-surface `readLenientHookSummary` helper at `orchestrators/plugin/info.ts` (not by the resolver-side strict parser).
- Renderer branches on `"kind" in entry` first, then on `"matcher" in entry` for the tool/non-tool untagged-arm split.
- HOOK-01 strict parser at `domain/components/hooks.ts::parseHooksConfig` is unchanged — install correctness is non-negotiable.

### Edit 3 — PRD PL-4 (full row rewrite)

PL-4 previously claimed a 3-glyph catalog `(●/○/⊘)` and a composite
`(installed, upgradable)` status marker. The shipped behavior (per `notify.ts`
L1324-1337 icons and L277-296 / L506 status set) is:

- 4-glyph catalog `●` / `○` / `⊘` / `◌` (adds `◌` U+25CC DOTTED CIRCLE for the disabled state).
- Status marker drawn from the actual closed set: `(installed)` / `(upgradable)` / `(available)` / `(unavailable)` / `(uninstalled)` / `(updated)` / `(reinstalled)` / `(skipped)` / `(failed)` / `(manual recovery)` / `(disabled)` / `(present)`, optionally followed by a `{reasons}` brace on the 5 reason-bearing variants.
- Role legend added: `●` installed / pending-positive; `○` not-installed / pending-removal; `⊘` error/blocked; `◌` deliberate disabled.

The stale composite `(installed, upgradable)` was dropped because `upgradable`
is its own top-level status token in the current `PluginStatus` closed set,
not a sub-state of `installed`.

## Verification

### Grep checks (post-commit, pre-cosmetic mdformat reflow)

| Check | File | Result |
|-------|------|--------|
| `v1.0+` removed from REQUIREMENTS | `.planning/REQUIREMENTS.md` | OK (0 hits) |
| `installed, upgradable` removed from PRD | `docs/prd/pi-claude-marketplace-prd.md` | OK (0 hits) |
| `ONLY for installable plugins` removed | `.planning/REQUIREMENTS.md` | OK (0 hits) |
| `(●/○/⊘)` 3-glyph literal removed | both files | OK (0 hits) |
| `kind: "lenient"` present | `.planning/REQUIREMENTS.md` | 2 hits (SURF-01 + SURF-02) |
| `◌` present | `docs/prd/pi-claude-marketplace-prd.md` | 1 hit (PL-4) |
| `readLenientHookSummary` present | `.planning/REQUIREMENTS.md` | 1 hit (SURF-02) |

The single remaining `components: not resolved` occurrence in REQUIREMENTS.md
is the legitimate new SURF-01 NFR-5 carve-out clause (non-path-resolvable
sources), not the stale "unavailable plugins continue to render..." claim.

### `npm run check`

Pass: 2317 / 2319; fail: 1; skipped: 1.

The single failure is `tests/docs/hooks-doc.test.ts > docs/hooks.md ships all
6 worked-example sections` — pre-existing, tied to the uncommitted
`docs/hooks.md` edits in the working tree, explicitly called out in the task
intent as out-of-scope. No source / test files were touched by this commit.

### `pre-commit run --files <changed files>`

First pass: `mdformat` modified the PRD's PL-4 table separator/padding
(cosmetic — widened to accommodate the longer cell). Re-run: all hooks
passed. The mdformat reflow did not break any prose; positive-content greps
still hit.

### Working tree state

`README.md` and `docs/hooks.md` remain modified-unstaged after the commit, as
required. The new untracked artefacts `.bg-shell/`, `.gsd/`,
`.playwright-mcp/`, `link-row-overview.png` were pre-existing and untouched.

## Commit

- `6926acc` — `docs(spec): sync SURF-01 / SURF-02 / PL-4 with shipped info contract`
  - 2 files changed, 11 insertions(+), 11 deletions(-)
  - Branch: `features/v1.13-hook-bridge` (sequential, non-worktree mode)

## Deviations from Plan

None — plan executed exactly as written, including the planner-anticipated
cosmetic mdformat reflow of the PRD PL-4 table separator.

## Self-Check: PASSED

- `.planning/REQUIREMENTS.md` — FOUND, modified at SURF-01 (L71) + SURF-02 (L72)
- `docs/prd/pi-claude-marketplace-prd.md` — FOUND, modified at PL-4 (L339)
- Commit `6926acc` — FOUND in git log
- README.md and docs/hooks.md — confirmed left unstaged
- No source / test files in commit diff
