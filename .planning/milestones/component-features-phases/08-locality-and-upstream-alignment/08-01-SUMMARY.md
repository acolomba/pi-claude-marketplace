---
phase: 08-locality-and-upstream-alignment
plan: 01
subsystem: plugin
tags: [locality, project-trust, workflows, retroactive]
status: complete
retroactive: true

requires:
  - phase: 02-skills
    provides: "the project-trust gate on project skills"
  - phase: 07-workflows
    provides: "workflow staging and the engine's storage precedence"
provides:
  - "project components gated on Pi's project trust alone, with no user-folder ledger"
  - "in-project saved workflows and staging"
  - "scenarios that pin trust and locality in place of the provenance scenarios"
affects: [02-skills, 03-slash-commands, 05-hooks, 07-workflows]

plan_head_before: 4630208b894286372a845eead891f96f1286c388
plan_head_after: 64c2c9d4b25f791aee5fa8a0c5a1889b82752448

key-files:
  created:
    - features/plugin/project-trust.feature
    - features/plugin/project-locality.feature
    - features/workflow/storage.feature
    - features/step_definitions/workflow/storage.steps.ts
  deleted:
    - extensions/pi-claude-marketplace/persistence/project-installs.ts
    - features/skill/project-provenance.feature
    - features/slash-command/project-provenance.feature
    - features/hook/project-provenance.feature
    - features/plugin/project-provenance-upgrade.feature
    - features/skill/project-autoapply.feature
  modified:
    - extensions/pi-claude-marketplace/persistence/locations.ts
    - extensions/pi-claude-marketplace/orchestrators/skill-invocation.ts
    - extensions/pi-claude-marketplace/orchestrators/skill-alias-state.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts
    - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
    - extensions/pi-claude-marketplace/bridges/workflows/unstage.ts
    - .planning/PROJECT.md

key-decisions:
  - "D-LOC-01: a project-scope operation affects only its project; the git credential helper is the one exception"
  - "D-CF2-13, D-CF2-14, D-CF2-15, D-CF2-16 and D-CF3-07 reversed"
  - "T-05-34 closed as consistent: project plugin data stays in the project"
  - "Hook trust at command time comes from the last project hydrate (user confirmed)"
  - "A plugin's own old workflow copies are removed from the user home as a migration cleanup (user confirmed)"
---

# Plan 08-01 Summary: Locality redesign

## Commits

- 5ecd962 fix(plugin): gate project plugins on Pi's project trust alone
- c8bf3d2 fix(workflows): keep a project's workflows inside the project
- 3d8e548 docs: describe project trust and in-project workflow storage
- 64c2c9d docs(planning): record the project locality decision
- bdd541c docs(planning): record the user's locality confirmations

## What changed

- The provenance ledger in the user's pi folder is gone, with the code built
  only to protect it. Project skills, commands, aliases, the model command
  tool, the skill-read fill and hooks check only `ctx.isProjectTrusted()`.
- The hooks bridge routes a project's hooks only when Pi trusts the project.
  Install, update, enable and apply have no `ctx`, so their hook cache
  writer uses the trust answer the last project hydrate recorded.
- Autoapply at load and the background autoupdate cover both scopes again,
  the project scope only in a trusted project.
- Project workflows are saved in `<cwd>/.pi/workflows/saved/` and staged in
  `<cwd>/.pi/pi-claude-marketplace/workflows-staging/`, on the same
  filesystem as the target. The staging sweep reaches only that project.
- Installs made before this change keep working: uninstall, disable, update
  and reinstall remove the plugin's own recorded copies from
  `~/.pi/workflows/projects/<key>/saved/`. Nothing new is written there.
- The provenance scenarios are replaced by scenarios that pin trust and
  locality.

## Test evidence

`npm run check` exit 0, cucumber 1532/1532 (seed 507232) on the locality
change (DC-42).

## Deviations and open points

- Accepted gap (user's choice): Pi 1.4.0 auto-trusts a project that has none
  of Pi's own trust-requiring paths. This extension's files are not on that
  list, so a repository that ships only them is trusted.
- Autoapply in an untrusted project still applies the user scope and shows
  the project's pending block (DC-42 item 3).
- A later pi-dynamic-workflows release may drop the in-project saved source
  (BACKLOG WFLOCAL-01).
- `AGENTS.md`'s generated constraints block still shows the old NFR-10
  wording until GSD regenerates it (DC-42 item 5).
