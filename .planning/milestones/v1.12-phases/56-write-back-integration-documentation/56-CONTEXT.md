# Phase 56: Write-Back Integration & Documentation - Context

**Gathered:** 2026-06-11
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped via workflow.skip_discuss)

<domain>
## Phase Boundary

Every mutating command records its change into the config file as a targeted entry-level patch (with a `--local` flag to target the local file instead), so the committed config stays the authoritative record -- and the `.local` gitignore convention and config workflow are documented.

Success criteria (from ROADMAP):

1. Each mutating command -- marketplace add/remove/autoupdate/noautoupdate and plugin install/uninstall/reinstall/update -- records its change as a targeted entry-level patch of the base config file, re-read under the scope lock immediately before write (never serializing the merged view back), composed inside the command's existing `withLockedStateTransaction` closure (WB-01, NFR-1).
2. A `--local` flag on those commands targets `claude-plugins.local.json` instead of the base file, and a `--local` write never touches the base file (WB-02; the write-target selection is explicit, not inferred).
3. The `import` command records all imported marketplaces and plugins, and `bootstrap` records its marketplace and autoupdate setting, into the config file -- each as a single batched multi-entry patch under one lock, not N full-file rewrites (WB-03, WB-04).
4. After any single mutating command, an immediately following load-time reconcile is a no-op (the config write-back already reflects reality), proven by a config-state-consistency architecture test that also confirms unknown keys are preserved on write-back (WB-01 round-trip integrity).
5. The README documents the `claude-plugins.json` / `claude-plugins.local.json` workflow and the `.local` gitignore convention so a user knows which file to commit and which to keep local (CFG-04).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

Inherited constraints and prior art (the frozen foundation):
- Phase 54 already built the WB-01-shape patch for enable/disable: read the targeted file fresh inside the lock, patch the entry, save via `saveConfig` (see `writeConfigEntry` in `orchestrators/plugin/enable-disable.ts`) and the `--local` parsing convention (`extractLocalFlag` — order-insensitive). Generalize, don't duplicate.
- Phase 55 deliberately removed config write-back from reconcile-driven (orchestrated-mode) paths — reconcile applies config→reality and must NEVER write config (SPLIT-02). Write-back happens ONLY on user-invoked commands (standalone mode). Keep the orchestrated/standalone distinction intact.
- Never serialize the merged view back (Pitfall: MergedConfig is a view; write-back patches the physical base or local file re-read fresh under the lock).
- Unknown keys in config files must be preserved on write-back (forward-compat, lenient schema D-09) — round-trip integrity test required.
- After a mutating command, reconcile must be a no-op (the command updated both reality AND config) — consistency architecture test required.
- SPLIT-02 architecture test gates config writers; if new modules call `saveConfig`, the write-seams test's allow-list mechanics may need a deliberate, justified widening (its regexes target atomicWriteJson on config paths — saveConfig callers are sanctioned; verify rather than assume, as in Phase 52 A1).
- SPLIT-01 cast sites (`// SPLIT-01:` tagged, Phases 51-52) were scheduled for rewire "in Phases 54-56": this phase should resolve the remaining `record.autoupdate` cast reads on the marketplace side (autoupdate flips become config write-back; state stops being the autoupdate source of truth). Audit remaining tags and either rewire or document why they stay.
- CFG-04 documentation lands in README.md: which file to commit (claude-plugins.json), which to keep local (.local.json + gitignore convention).

</decisions>

<code_context>
## Existing Code Insights

Codebase context will be gathered during plan-phase research.

</code_context>

<specifics>
## Specific Ideas

No specific requirements — discuss phase skipped. Refer to ROADMAP phase description and success criteria.

</specifics>

<deferred>
## Deferred Ideas

None — discuss phase skipped.

</deferred>
