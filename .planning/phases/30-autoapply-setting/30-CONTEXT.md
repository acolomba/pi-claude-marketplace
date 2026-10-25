# Phase 30: Autoapply Setting - Context

**Gathered:** 2026-10-25
**Status:** Ready for planning
**Mode:** autonomous discuss (`--auto`). The orchestrating session relayed the
user's 2026-10-24 decision (ROADMAP Phase 30 **Decision**) and asked for a run
without prompts. Every open choice below took the recommended answer, and the
final report lists the four the session named as "unsure".

<domain>
## Phase Boundary

AAP-01..03: a boolean `autoapply` setting in the desired-state plugin
configuration (`claude-plugins.json` / `claude-plugins.local.json`, both
scopes), default off.

- **Off** (unset or `false`): a load (session start, `/reload`) behaves exactly
  as phase 29 left it (APL-03): no state change, `pending`'s block with the
  `/claude:plugin apply` trailer, silence when nothing is pending.
- **On:** the load runs `apply` (APL-01, APL-02) itself, before resource
  aggregation in `resources_discover`, so the plugins it installs are
  discoverable in that same session. It clones and uses the network on a cache
  miss, as `apply` does.

Out of scope: a trust prompt (AAP-D1), showing the setting in `pending`,
`list` or `info` (D-07), a command that flips the setting (users edit the
config, as for `enabled`), one-apply convergence of the co-shipped dependency
case (BACKLOG APPLY1-01, D-12b of phase 29).

</domain>

<decisions>
## Implementation Decisions

### The divergence (AAP-D1)
- **D-01 (AAP-D1, user, 2026-10-24):** any configuration file may turn
  `autoapply` on, the committed project base config included, and no trust
  gate or prompt guards it.
  - **Risk (recorded as the user's accepted cost):** cloning a repository whose
    `.pi/claude-plugins.json` sets `"autoapply": true` and starting `pi` in it
    installs and enables the plugins that file declares, hooks and MCP servers
    included, before the user has read the file. Hooks run commands on Pi
    events. The user who commits the file is trusted the way a committed
    `package.json` script is.
  - **Upstream comparison:** Claude Code has no autoapply equivalent. A plugin
    enabled only in a project's `.claude/settings.json` with an external source
    is not fetched; the user sees "Plugin "<name>" is enabled in project
    settings but isn't installed here" and installs it by command. Upstream
    does install user/managed-settings plugins in a background pass after start
    (phase 29 D-01). Evidence: `code.claude.com/docs/en/plugins/loading.md`,
    retrieved 2026-10-24 (phase 29 D-01).
  - License: a recorded project decision (this ID). It also amends phase 29's
    D-06 ("a load never touches the network"): a load with `autoapply` on may
    use the network exactly as `apply` may (NFR-5 as amended by D-03-03 and
    D-MF-04). AGENTS.md's network policy carries the amendment.

### The setting (AAP-01)
- **D-02:** `autoapply` is an optional top-level boolean of `CONFIG_SCHEMA`
  (`persistence/config-io.ts`), beside `schemaVersion`, `marketplaces` and
  `plugins`. Absent means off. `schema/claude-plugin.schema.json` is the
  notification payload schema, not the config schema, so it does not change.
- **D-03 (non-boolean, fail closed):** a non-boolean value fails schema
  validation, so that file is `invalid` under CFG-03, as `"enabled": "yes"`
  is today. Moreover, when any of the four config files (two layers, two
  scopes) is invalid, the load does not autoapply at all: it runs phase 29's
  read-only load, whose pending block reports the invalid config row. The
  value of an unreadable file is unknown, and "we don't paper over corrupt
  data": the closed state is the read-only load, not a guess.
- **D-04 (combination, follows upstream settings precedence):** one effective
  value per load, read from the most specific layer that sets the key:
  project local, then project base, then user local, then user base, else
  `false`. Claude Code resolves a settings key the same way (local overrides
  project, which overrides user). The effective value governs the whole load:
  on, the load applies both scopes; off, neither. So a user turns it on for
  every project in the user config, and a project can turn it off (or on) for
  itself. A project file that turns it on also applies the user scope, which
  only applies the user's own declarations. No per-scope split.

### The load (AAP-02)
- **D-05:** `orchestrators/reconcile/load.ts` decides. It reads the effective
  value first (a pure helper over the four `ConfigLoadResult`s, beside the
  merge in `persistence/config-merge.ts`); when on, it calls the injected
  `apply` step (`createApplyReconcile`'s operation, bound in `index.ts`) for
  both scopes with the load's run, `cwd`, hooks routing and completion cache,
  and returns. The apply step already runs the read pass, the MCP move, the
  per-session warnings and the routing rebuild that the read-only load runs,
  so nothing is lost. `load.ts` stays outside `NETWORK_SEAMS`: it names no git
  surface and reaches the network only through the injected step.
- **D-06:** `index.ts` already runs the load before
  `aggregateDiscoveredResources`, so skills and prompt templates installed by
  the load are offered in that session. Hooks are live too (the routing
  rebuild). No change to `session_start`.

### Output (unsure item 2)
- **D-07:** an autoapply load prints `apply`'s report unchanged: its rows,
  severity, tally, and the `/reload` trailer when the rows stamp
  `needsReload`. The trailer stays because the companion extensions
  (pi-mcp-adapter, pi-subagents) read their files from their own handlers,
  which can run before `resources_discover`, so an MCP server or agent the
  load installed may still need a reload; the trailer is the existing,
  row-stamped fact (RLD-02) and the load-time MCP migration notice already
  carries it. One change: an apply with nothing to change prints nothing at
  load (the `Apply: nothing to change.` advisory is for the command; the
  load's silence contract RECON-05 / phase 29 D-05 wins). An options flag on
  the apply step selects this.
- **D-08:** `pending`, `list` and `info` do not show the setting. `pending`
  keeps listing what `apply` would do and keeps its apply trailer; with
  autoapply on, the next load does it. No upstream surface shows an
  equivalent setting.

### Failure (AAP-03)
- **D-09:** the apply step's own soft-fail stays: per-entry failures are
  `(failed)` rows (RECON-03), a held lock or a corrupt state file is that
  scope's row, and the other scope still runs (WR-01). A throw that escapes
  the apply step (for example GHB-03's `InvalidGitHubBaseUrlError`) is caught
  in `load.ts` and becomes the `reconcile-aborted` row, as `index.ts` does for
  the read-only load (NFR-2). Changes the apply could not make stay pending:
  `pending` lists them and the next autoapply load retries them (NFR-3).
- **D-10:** with phase 29's D-12b, a dependent shipped with the newer
  dependency it needs settles on the second autoapply load. Scenarios do not
  assume one load settles it.

### Docs
- **D-11:** README.md and README.es.md ("Configuration files") gain the
  setting, its default, the precedence and the risk; `docs/` pages that
  describe the load (`plugin-enablement.md` if it does) mention it; the
  CHANGELOG's unreleased milestone entry gains one line. AGENTS.md's network
  policy names AAP-D1.

### Scenarios
- **D-12:** a new `features/plugin/autoapply.feature`, each scenario failing
  without the change:
  - with `autoapply: true` in the project base config, a new session installs
    a declared path-source plugin, reports apply's rows, records it, and offers
    its skill in that same session;
  - a git-source plugin declared with autoapply on is cloned and installed by
    the load;
  - a user-config `autoapply: true` applies a project's declarations; a
    project local `false` overrides a base `true` (precedence);
  - `autoapply: false` (explicit) keeps the phase 29 read-only load;
  - a non-boolean value reports the invalid config and changes nothing;
  - a failure during the load-time apply (a held state lock, or an
    unreachable git host) reports a failed row, does not stop the load, and
    `pending` still lists the change;
  - a catalog change after `marketplace update` is applied by the next load.

  Pi's RPC `new_session` binds the extension twice, so a session runs two
  loads: the first applies, the second finds nothing pending and is silent.
  Scenarios state the rows the session reports as they are.

### Claude's Discretion
- Helper and option names, the exact text of the docs, scenario titles and
  step wording within `.agents/skills/cucumber/rules/`.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` "### Phase 30: Autoapply Setting"; `.planning/REQUIREMENTS.md` AAP-01..03
- `.planning/phases/29-load-converges-on-the-catalog/29-CONTEXT.md` (APL-D1/D2, D-05, D-06, D-12a/b)
- `AGENTS.md` Constraints (Upstream parity, NFR-2, NFR-5)
- `extensions/pi-claude-marketplace/index.ts`, `orchestrators/reconcile/{load,apply,read-pass}.ts`, `persistence/config-{io,merge}.ts`
- `features/plugin/{apply,reconcile,pending}.feature`, `features/step_definitions/{config,session}.steps.ts`
- `.agents/skills/cucumber/`, `.agents/skills/local-verification/SKILL.md`

</canonical_refs>

<code_context>
## Existing Code Insights

- `createLoadReconcile(reader)` / `createApplyReconcile(reader)` are both built
  once in `index.ts`; the apply operation takes `{ ctx, run, cwd, hooksRouting,
  completionCache, scope? }` and emits one cascade, or the
  `reconcile-pending-empty` advisory with `command: "apply"` when empty.
- `loadMergedScopeConfig(loc)` returns both layers' `ConfigLoadResult`s.
- Config steps: `a config in scope {word} and layer {word}, with this text:`
  writes arbitrary config text, so `autoapply` needs no new setup step.

</code_context>

<deferred>
## Deferred Ideas

- A trust prompt for a project file that turns autoapply on (rejected by
  AAP-D1; revisit only on user request).
- A `/claude:plugin autoapply` toggle verb.

</deferred>

---

*Phase: 30-autoapply-setting*
*Context gathered: 2026-10-25*
