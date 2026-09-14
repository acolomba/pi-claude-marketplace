---
quick_id: 260914-aer
status: completed
autonomous: true
---

# Reject invalid dependency declarations

User decision: follow Claude Code's handling of unusable dependency declarations.
This supersedes silent omission under D-01-05 and D-01-33 and the decision in
D-01-29 not to follow upstream's failure handling. Preserve valid dependency
rendering, manifest precedence, and the later phase's dependency-resolution scope.

## Tasks

1. Make the dependency parser reject a declaration containing any invalid
   element or a non-array field. Return a structured outcome with a safe field
   path; absent and empty declarations remain valid. Update its paired tests.
2. Apply the outcome at the manifest boundaries: reject an invalid plugin.json;
   isolate an invalid marketplace entry as an unsupported stub (drop it if no
   name can be recovered); keep healthy siblings usable. Ensure info reports an
   invalid own manifest without substituting the entry's dependencies. Preserve
   raw marketplace data when no dependency normalization is necessary.
3. Verify negative controls against the current implementation, direct coverage
   for affected pairs, and the full check chain. Record the decision and close
   only WR-01's resolved dependency-handling choice in the phase handoff.

## Scope

Expected source/test pairs: domain/dependencies, domain/manifest,
domain/resolver, orchestrators/plugin/info. Add an architecture test only if
cross-boundary evidence cannot be expressed through these public entry points.
No external API integration or database schema changes. No agents or isolated
worktrees: run inline under the skill adapter and project worktree opt-out.
Leave .planning/config.json and the user's other existing edits uncommitted.

Executed scope additions: the successful-install fixture used an invalid
object-shaped declaration and now uses a valid object-array declaration. The
retired-vocabulary architecture guard now masks only the upstream source
sentinel at its two exact use sites; a counterexample keeps status homonyms
forbidden. Both additions were required by failing full-suite tests.

## Verification

Each rejection test must fail before the fix and pass afterward. Use actual
temporary manifest files for reader tests. Verify malformed entries do not hide
healthy siblings, valid object ranges still render, and a good fallback cannot
rescue invalid dependencies in the selected own manifest. Run npm run check and
the affected direct-pair coverage commands; report any pre-existing failures.
