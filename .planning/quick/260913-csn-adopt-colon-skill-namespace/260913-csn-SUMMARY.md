---
phase: 260913-csn
plan: 01
subsystem: domain
tags: [naming, skills, claude-code-parity, pr-180, semantic-merge]

# Dependency graph
requires:
  - "PR #180 (contributed): `generatedSkillName` joins with `commandNamespaceSeparator()` — `:` on POSIX, `.` on Windows — and elides both `<plugin>-` and `<plugin><sep>` source prefixes."
  - "PR #181 (merged main): the refine-unit-tests suite rewrite, which still asserted the pre-#180 hyphen skill names."
provides:
  - "Generated plugin skill names match what Claude Code registers (`<plugin>:<skill>`), so cross-skill references and agent skill preloads written as `plugin:skill` resolve without translation on POSIX."
  - "The merged unit suite (5975 tests) asserts the colon form everywhere a generated skill name appears; source-directory fixtures and deliberately-stale record seeds stay hyphenated."
  - "A CHANGELOG entry under [Unreleased] crediting @rakesh-vs (#180)."
affects: [skills-bridge, agents-bridge-preloads, reconcile, install, update, reinstall, enable-disable]

actuals:
  tasks: 3
  commits: 3
plan_head_before: 7db2c2e7

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separator parity by reuse: skills adopt the exact `commandNamespaceSeparator()` commands already use (#143), so POSIX/:  and Windows/. stay decided in one place (`platform/os.ts`)."
    - "Semantic-merge repair rule: only expectation values move to the new name form; source-directory fixtures, deliberately-stale record seeds, and the `skill source \"...\"` half of elision warnings stay as authored."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/name.ts
    - CHANGELOG.md
    - tests/bridges/skills/stage.test.ts
    - tests/edge/handlers/plugin/install.test.ts
    - tests/edge/handlers/plugin/reinstall.test.ts
    - tests/edge/handlers/plugin/update.test.ts
    - tests/orchestrators/plugin/enable-disable.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/install-outcome.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/orchestrators/plugin/update-flow.test.ts
    - tests/orchestrators/plugin/update-swap.test.ts
    - tests/orchestrators/reconcile/apply.test.ts
    - tests/orchestrators/reconcile/backfill.test.ts

key-decisions:
  - "D1 — PR #180 is sound and merges as-is: pi-coding-agent 0.84.4 loads a colon-named skill (warn-only `validateName`), `/skill:acme:foo` parses (name = everything to the first space), and the generated name lands in both the skill dir name and the rewritten frontmatter `name`, so Pi resolves it either way."
  - "D2 — no migration ledger is needed: uninstall, update, and reinstall all remove old artifacts by RECORDED names from state.json (`resources.skills`, `previousSkillNames`), so hyphen-era installs upgrade and uninstall cleanly; they keep hyphen names until re-materialized, which is the same staged-copy semantics hooks already have."
  - "D3 — fixture plants that occupy the GENERATED target (collision seeds, phase-3a obstacles, symlink decoys) move to the colon form with the expectations; several had gone vacuously green against paths production no longer writes (update-flow WR-01 zzz obstacle, install-outcome mcp-unwind survivor, update-swap failure obstacle, reinstall replacement-refusal plants, reconcile SF-01 conflictor)."
  - "D4 — deliberately-stale seeds stay hyphenated: reconcile BFILL-01's pre-backfill `promoted-tool` record (stamp 0.0.0) and enable-disable's bare recorded-name `s1` seeds exercise recorded-name honoring, not current generation."
  - "D5 — the same-class survey closes with agents as the one remaining divergence: `pi-claude-marketplace-<plugin>-<agent>` vs upstream `<plugin>:<agent>`. Left alone deliberately — the prefix IS the AG-5 ownership marker in the shared agents dir, and pi-subagents is a cross-extension namespace. Commands already match (#143); MCP server keys are verbatim; hooks have no user-facing names."

patterns-established:
  - "When a naming convention changes, grep for the OLD join pattern outside the generator before trusting the change is contained (`split(\"-\")`, template `${plugin}-`) — here the only stray was a doc comment."
  - "A fixture that plants an obstacle at a generated path is coupled to the generator: rename the plant with the generator or the test silently stops exercising its failure arm."

requirements-completed: [D1, D2, D3, D4, D5]

coverage:
  - id: D1
    description: "Pi accepts and resolves colon-named skills; the PR's upstream-parity claim verified against the vendored dependency, not the PR body."
    requirement: "D1"
    verification:
      - kind: other
        ref: "node_modules/@earendil-works/pi-coding-agent/dist/core/skills.js — validateName failures push warning diagnostics; loadSkillFromFile comment 'Still load the skill even with warnings' and returns the skill"
        status: pass
      - kind: other
        ref: "dist/core/agent-session.js _expandSkillCommand — name slice runs to the first space, so /skill:acme:foo matches skill 'acme:foo'"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hyphen-era installs uninstall/update cleanly under the new generator."
    requirement: "D2"
    verification:
      - kind: other
        ref: "update-swap.ts:239 previousSkillNames: record.resources.skills; reinstall-replace.ts:301 input.oldRecord.resources.skills; uninstall.ts removes by installed.resources.* — all recorded, none regenerated"
        status: pass
    human_judgment: false
  - id: D3
    description: "The merged suite is green and the repaired tests exercise their intended failure arms."
    requirement: "D3"
    verification:
      - kind: unit
        ref: "npm test — 5975 tests, 0 fail (was 144 fail after the origin/main merge)"
        status: pass
      - kind: integration
        ref: "npm run test:integration — 32 pass, 0 fail"
        status: pass
      - kind: other
        ref: "npm run check — typecheck, lint, fallow, format:check, test:corresponding (+negative), test:coverage:direct:negative, unit, integration all green (exit 0, captured unpiped)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Same-class survey: every generated-name surface checked against what Claude Code registers."
    requirement: "D5"
    verification:
      - kind: other
        ref: "domain/name.ts (three generators), bridges/mcp/parse.ts (verbatim server keys), bridges/agents/marker.ts (AG-5 prefix); live Claude Code environment lists plugin skills as plugin:skill and agents as plugin:agent"
        status: pass
    human_judgment: false

# Metrics
completed: 2026-09-13
status: complete
---

# Quick Task 260913-csn: Adopt the Colon Skill Namespace (PR #180) Summary

**Contributed PR #180 lands: plugin skills now generate `<plugin>:<skill>` on POSIX (`.` on Windows) through the same `commandNamespaceSeparator()` commands use, and the origin/main merge fallout — 144 unit tests still asserting the hyphen names — is repaired without touching production behavior.**

## Commits

All on branch `pr-180`, on top of merge commit `7db2c2e7` (origin/main at `553513a5`, #181,
merged into the PR head `330bb409`). Pre-commit scoped run green except the structural
trufflehog worktree failure (SKIP'd, documented); substitute filesystem scan clean at
`verified_secrets: 0, unverified_secrets: 0`.

| Task | SHA | Title |
|---|---|---|
| 1 | `f973f1e1` | `test: expect colon-namespaced skill names across the suite` |
| 2 | `57b0163e` | `docs: record the colon skill namespace change` |
| 3 | (this commit) | `docs(quick): record the PR #180 evaluation and repair` |

## Evaluation verdict

The PR is sound. Its one load-bearing claim — that Pi loads colon-named skills — was verified
against the vendored pi-coding-agent 0.84.4, not taken from the PR body: `validateName` failures
are warn-only, `loadSkillFromFile` returns the skill anyway, and `/skill:acme:foo` parses because
the name slice runs to the first space. The generated name is written to both the artifact
directory name and the frontmatter `name` (SK-3 rewrite), so Pi's frontmatter-first resolution
never disagrees with the directory. Migration needs no ledger: every removal path (uninstall,
update swap, reinstall replace) works from recorded names in `state.json`, so hyphen-era installs
upgrade cleanly and orphan nothing.

Costs accepted: every plugin skill now carries a warn-only name diagnostic in Pi's
"[Skill conflicts]" resources panel (cosmetic; a Pi-side relaxation would be the fix), and
sources `acme-foo`/`acme:foo` in one plugin now collide to one generated name — resolved by the
pre-existing D-07 first-wins skip, exercised by the suite.

## Same-class survey

| Surface | Generated form | Upstream (Claude Code) | Verdict |
|---|---|---|---|
| Commands | `<plugin>:<cmd>` / `.` on Windows | `<plugin>:<cmd>` | aligned since #143 |
| Skills | `<plugin>:<skill>` / `.` on Windows | `<plugin>:<skill>` | **aligned by #180** |
| Agents | `pi-claude-marketplace-<plugin>-<agent>` | `<plugin>:<agent>` | divergent, deliberate — the prefix is the AG-5 ownership marker; candidate future work, needs its own design |
| MCP servers | verbatim `.mcp.json` keys | verbatim keys | aligned |
| Hooks | no user-facing names | — | n/a |

## Merge repair

Merging origin/main brought PR #181's suite rewrite, whose tests predate #180's rename: 5975
unit tests ran with 144 failures, all one class (stale hyphen expectations; integration was
already green at 32/32). Repair touched 13 test files, expectations only, with two rules:
source-directory fixtures and deliberately-stale record seeds stay hyphenated; fixture plants
that occupy a GENERATED path move with the generator. The second rule mattered more than
expected — five tests had quietly stopped exercising their failure arms because their planted
obstacles no longer collided with what production writes.

Also fixed: `generatedCommandName`'s doc comment still claimed Pi "rejects" defective skill
names — the warn-only behavior this very PR depends on contradicts that; and CHANGELOG gained
the #180 entry under [Unreleased].
