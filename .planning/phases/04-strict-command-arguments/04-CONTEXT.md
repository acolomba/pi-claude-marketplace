# Phase 4: Strict Command Arguments — Context

<domain>ARGS-01: validate all current verbs and extend the flag catalog/guard.</domain>
<decisions>
- User chose to ADD and document --local support for marketplace info/list/update.
- Follow-up decision: KEEP MERGED READS; use --local only for config writes.
- Therefore info/list remain merged-view reads with --local accepted and documented;
  update also leaves config files unchanged: its existing refresh writes state/cache,
  and plugin cascade mode explicitly skips config write-back. Do not invent a config
  mutation or pass an unused local field through that path.
- --local is orthogonal to --scope and never creates a third scope or local-only filter.
- Unknown flags and surplus positionals must be rejected before orchestrator work.
- Enumerate actual verbs/aliases and test public handler behavior; old counts are evidence only.
- Widen the catalog/guard to marketplace verbs and completion paths with offender/benign controls.
</decisions>
<code_context>
parseCommandArgs drops positionals beyond schema length. parseArgs accepts all
non-scope tokens as positional; extractLocalFlag rejects other long flags but
marketplace info/list/update skip it. Info uses makeSingleNameMarketplaceHandler;
list/update call parseCommandArgs directly. All three orchestrators currently lack
local options. Info/list load merged config. Marketplace update has single/bulk
forms and a pluginUpdate cascade; update-swap.finalizeUpdateRecord gates config
write-back on !args.cascade. The marketplace owner itself has no config writer.
All three accept --local without filtering their reads or adding config writes.
The catalog currently has 12 plugin verbs and is also used by completions.
</code_context>
