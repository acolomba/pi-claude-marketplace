---
status: resolved
trigger: "Milestone completion found three unresolved deferred items in phases 2 and 7."
created: 2026-10-29T00:00:00-04:00
updated: 2026-10-29T00:00:00-04:00
---

## Symptoms

expected: |
  A cold-cache git-source install reads the dependencies in the root plugin's
  own plugin.json. Completed fixes have resolved deferred records with current
  test evidence, so the milestone artifact scan finds no open item.
actual: |
  The dependency walk runs before a cold git root exists in the clone cache,
  so it reads only the marketplace entry. Two phase 7 deferred records also
  remain open even though later work changed the lock assertions and redacted
  the random staging path.
errors: |
  No command error. The milestone completion audit reports three open deferred
  items.
timeline: |
  Phase 2 deferred the cold-cache root dependency bug. Phase 7 deferred the
  lock-count and staging-path items. Later changes fixed the two phase 7 items,
  but their deferred records were not closed.
reproduction: |
  Install a pinned git-source root on a cold clone cache. Put a dependency only
  in the root plugin's plugin.json and omit it from the marketplace entry. The
  install records the root but not its dependency.

## Current Focus

hypothesis: |
  The cold-cache bug occurs because sharedCascadeOptions reads the dependency
  declaration before the install ledger materializes the root. Running the
  existing write-free install preview first will materialize the root. Pinning
  the root ledger to the previewed commit will keep the preview and install on
  one revision. The phase 7 items need record updates only.
test: |
  Add an owner test and a Cucumber scenario where only a cold git root's own
  manifest declares a path-source dependency. Run the current phase 7 lock and
  unreadable-skill cases without source changes.
expecting: |
  The new cases fail before the fix because only the root installs. The phase 7
  cases pass on the current tree.
next_action: |
  NONE. The cold-cache owner test and Cucumber scenario pass. The phase 7 lock
  and unreadable-skill cases pass, and all three deferred records are resolved.

## Evidence

- timestamp: 2026-10-29T00:00:00-04:00
  checked: "install-flow-ledger.ts, dependency-declaration-read.ts, and install-outcome.ts"
  found: "The cascade reads declarations before runInstallLedger calls the clone-materializing preflight."
  means: "A cold git root cannot supply its own manifest to the first dependency walk."
- timestamp: 2026-10-29T00:00:00-04:00
  checked: "test/edge/register.test.ts prune lock assertions"
  found: "Both cases now expect three locks and name the state, package, and clone cleanup locks."
  means: "The phase 7 lock-count deferred item is stale."
- timestamp: 2026-10-29T00:00:00-04:00
  checked: "Phase 10 strict path redaction and the unreadable-skill Cucumber token"
  found: "Public causes replace the random absolute staging path with [redacted path], and Cucumber has a stable token."
  means: "The phase 7 staging-path deferred item is stale."
- timestamp: 2026-10-29T00:00:00-04:00
  checked: "Cold git root owner test and Cucumber scenario after the fix"
  found: "Both the requested root and its manifest-only dependency install; the clone seam clones once."
  means: "The root preview exposes the own-manifest declaration and the ledger reuses its commit."

## Eliminated

- hypothesis: "The dependency declaration reader can clone a missing root directly."
  evidence: "The module is intentionally filesystem-only, and the architecture rule forbids a git seam there."
- hypothesis: "The phase 7 lock assertions still expect one lock."
  evidence: "The current assertions expect three calls."

## Notes

- The third phase 7 deferred item about the missing-dependency row is a product
  decision. The milestone scanner previously accepted it and it is outside this
  repair.

## Resolution

root_cause: |
  sharedCascadeOptions walked the dependency graph before runInstallLedger
  materialized the requested git root. The filesystem-only declaration reader
  therefore fell back to the marketplace entry on a cold cache.
fix: |
  installPluginWithTransaction now runs the existing write-free install preview
  before it builds the dependency cascade. The preview materializes a cold git
  root. The requested member's ledger uses the previewed commit when no release
  tag already selected a commit.
verification: |
  The focused owner test passes and records both plugins with one clone. The
  focused Cucumber scenario passes with 1 scenario and 10 steps. The current
  prune owner test passes, and the existing unreadable-skill install scenario
  supplies the stable redacted error contract.
files_changed:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
  - features/plugin/install-dependencies.feature
