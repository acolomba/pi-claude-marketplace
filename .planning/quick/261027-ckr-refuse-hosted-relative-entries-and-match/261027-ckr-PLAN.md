---
phase: quick-261027-ckr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - test/domain/resolver-types.test.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - test/domain/plugin-resolver.test.ts
  - test/architecture/cross-surface-reason-parity.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - test/orchestrators/plugin/install-outcome.test.ts
  - features/marketplace/hosted-relative-entry.feature
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
  - test/orchestrators/plugin/list-flow.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - test/orchestrators/plugin/info.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - test/orchestrators/plugin/update-preflight.test.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
  - test/orchestrators/reconcile/convergence.test.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - test/domain/source.test.ts
  - test/persistence/state-io.test.ts
  - features/lib/published-marketplace.ts
  - features/step_definitions/marketplace/publishing.steps.ts
  - features/marketplace/hosted-source.feature
  - .planning/phases/05-marketplace-command-parity/05-CONTEXT.md
autonomous: true
requirements: [MKT-02]

estimate:
  tokens: 260000
  raw_tokens: 260000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "plugin install of a plugin that a hosted marketplace's catalog lists by a relative path (./plugins/x, ./, ./.claude-plugin) fails as (unavailable) {unsupported source} and records and declares nothing, where today ./plugins/x reads {source missing} and ./ or ./.claude-plugin installs the stored catalog tree"
    - "plugin list and plugin info show such an entry as unavailable with the reason unsupported source"
    - "plugin update (and so reinstall) of an installed plugin whose hosted catalog entry now names a relative path skips it as no longer installable and keeps the installed version; pending, the load preview, and apply plan no move onto it"
    - "Relative entries of a path, github, or url marketplace resolve exactly as before, and a hosted marketplace's git, npm, and unknown entries keep their verdicts"
    - "marketplace add of an https URL whose path ends in .json in any letter case (.JSON, .Json) downloads it as a hosted catalog; a stored url record or a legacy string record whose path ends in .JSON keeps loading as the git source it was"
    - "D-PL5-32 and D-PL5-33 are recorded in 05-CONTEXT.md after D-PL5-31, and npm run check exits 0, run unpiped, on the final HEAD"
  artifacts:
    - path: extensions/pi-claude-marketplace/domain/resolver-types.ts
      provides: "ResolveContext.marketplaceSource, the optional recorded source of the marketplace that lists the plugin"
      contains: "marketplaceSource"
    - path: extensions/pi-claude-marketplace/domain/plugin-resolver.ts
      provides: "the path-arm refusal of a hosted marketplace's path entry, carrying Claude Code's reason"
      contains: "url-catalog marketplace"
    - path: features/marketplace/hosted-relative-entry.feature
      provides: "install, list, info, update, and pending scenarios for a hosted catalog's relative entries"
    - path: extensions/pi-claude-marketplace/domain/source.ts
      provides: "parseHostedManifestForm matches the .json suffix in any letter case"
      contains: "D-PL5-33"
    - path: .planning/phases/05-marketplace-command-parity/05-CONTEXT.md
      provides: "the D-PL5-32 and D-PL5-33 decision bullets"
      contains: "D-PL5-32"
  key_links:
    - from: "orchestrators/plugin/install-outcome.ts resolveStrict context (install, enable, dependency members, import, apply)"
      to: "domain/plugin-resolver.ts deriveSourcePluginRoot path arm"
      via: "one added context member: the target record's source"
      pattern: "marketplaceSource: targetMp\\.source"
    - from: "orchestrators/plugin/update-preflight.ts resolveUpdateCandidate (update, reinstall, converge execution)"
      to: "domain/plugin-resolver.ts deriveSourcePluginRoot path arm"
      via: "one added context member: the marketplace record's source"
      pattern: "marketplaceSource: marketplace\\.source"
    - from: "orchestrators/plugin/list-flow.ts available rows and orchestrators/reconcile/convergence.ts recordMove"
      to: "orchestrators/plugin/list-candidate-version.ts resolveListCandidate, then resolveStrict"
      via: "the widened Pick<ResolveContext, ...> parameters of availableRowMessage and resolveListCandidate"
      pattern: "\"marketplaceRoot\" \\| \"marketplaceName\" \\| \"marketplaceSource\""
    - from: "orchestrators/plugin/info.ts installed and not-installed path arms"
      to: "domain/plugin-resolver.ts deriveSourcePluginRoot path arm"
      via: "one added context member each: mpRecord.source"
      pattern: "marketplaceSource: mpRecord\\.source"
    - from: "domain/source.ts parseHostedManifestForm"
      to: "the hosted kind for a .JSON URL"
      via: "a suffix test that ignores letter case"
      pattern: "D-PL5-33"
---

<objective>
Two user decisions on `features/plugin-lifecycle-p5`, recorded at the end as D-PL5-32
and D-PL5-33:

- **5.12 / D-PL5-32.** A hosted marketplace is one downloaded `marketplace.json`, so a
  plugin entry whose source is a relative path has no plugin files behind it. Claude
  Code refuses such an entry at install. Pi refuses it in the resolver, keyed on the
  marketplace record's source kind, and every surface that resolves the entry agrees:
  install, list, info, update and reinstall, and the convergence planner. This closes
  review IN-06 (`./` resolved to the stored tree). The proposed backlog entry
  HOSTED-REL-01 is then not needed.
- **5.23 / D-PL5-33.** `parseHostedManifestForm` matches the `.json` suffix in any
  letter case, so `https://h/M.JSON` is a hosted catalog, as it is upstream. D-PL5-04's
  narrowing stays otherwise.

Purpose: upstream parity (AGENTS.md "Upstream parity"). The upstream evidence is in
`<upstream_evidence>` below: Claude Code 2.1.310 binary strings and code.claude.com
docs, both checked 2026-10-27.

Output: one optional `ResolveContext` member, one resolver arm, a one-line wiring at
each surface listed in `<plan_decisions>`, a case-insensitive suffix test, unit cases,
one new feature file and one new scenario, one new feature step, the two decision
records, and a green `npm run check`.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/phases/05-marketplace-command-parity/05-CONTEXT.md

Rules to read before the task that needs them (each is short):
- `.agents/skills/committing/SKILL.md` (every commit)
- `.agents/skills/local-verification/rules/commands.md` and `rules/gates.md`
- `.agents/skills/cucumber/rules/features.md`, `rules/steps.md`, `rules/layout.md`, `rules/world-and-stand-ins.md`
- `.agents/skills/typescript-unit-tests/rules/cases.md`
- `.agents/skills/typescript-style/rules/comments.md`. Comments and test titles cite MKT-02 / D-PL5-32 / D-PL5-33 (or D-PL5-04 / D-PL5-05 / WR-02 / SRC-01 where those apply), never a phase, plan, or quick-task id. Add no comment to trivial code: the one-line wiring needs none.

Background only, do not re-derive: `05-REVIEW-FIX.md` IN-06 (the deferral this plan closes), and `.planning/quick/261027-a3p-*/261027-a3p-PLAN.md` plus its SUMMARY. The a3p PLAN is the model this plan follows: its RED/GREEN, commit, and gate procedure applies here unchanged.

<upstream_evidence>
Claude Code **2.1.310**. Binary strings dump at
`/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-22442f56d78caa3a-pl-p5-marketplace-3ea95a/b2617c82-721b-4c0b-a775-74b554dbc72d/scratchpad/cc.txt`,
grepped 2026-10-27 with `python3 -I`. Docs retrieved 2026-10-27. Confidence: high (the
code paths and the docs agree).

- **R-1 Install refusal.** `installResolvedPlugin` materializes each closure member
  through a helper that runs only for a string (relative) entry source:
  `D2e(await lV(id, marketplaceInstallLocation, entry.source, ...))`, and when no entry
  path comes back it throws `Cannot install ${id}: ${reason}` (telemetry tag
  `plugin install marketplace entry path refused`). The location check `Xt` returns the
  install location when it is a directory; when the marketplace source is `url` (a
  hosted catalog, whose install location is the downloaded `.json` file) and the
  location is not a directory, it returns nothing, so the result is `entry-refused`
  before the entry path is joined. Every string entry of a url-catalog marketplace is
  refused, `./` included. The reason (`U("entry-refused")`) is, verbatim:
  `its marketplace entry path does not stay inside the marketplace directory (an absolute, climbing, network-shaped, backslash-containing or link-traversing entry, an entry of a fetched marketplace that resolves or opens outside its tree — or a relative entry in a url-catalog marketplace, which has no local directory)`.
  The dash is U+2014 (`—` in the binary).
- **R-2 Load and update.** `xet` maps `entry-refused` to failure code
  `marketplace_entry_path_refused` with the message
  `Plugin source path refused: <entry source, at most 300 chars> does not stay inside its marketplace directory. Check that the marketplace entry has a plain relative path.`
  Its callers are the plugin loader (a load error, so `claude plugin list` shows the
  plugin as failed to load), the cache sync of enabled plugins, and `plugin update`
  (`{outcome: "failed", failureCode: "marketplace_entry_path_refused"}`). The failure
  code's severity table rates it `bad`.
- **R-3 Docs.**
  - `plugins/host-marketplace.md`, "Avoid relative-path entries in a URL-hosted
    marketplace": Claude Code downloads only the file, and an entry whose source is a
    relative path "then fails at install with `its marketplace entry path does not stay inside the marketplace directory`".
  - `plugins/troubleshooting.md`, "Plugins with relative paths fail in URL-based
    marketplaces": installs fail with that sentence; already-installed plugins fail to
    load with `Plugin source path refused`.
  - `errors.md`, "Marketplace entry path does not stay inside the marketplace
    directory": quotes the full `Cannot install my-plugin@my-marketplace: ...` message,
    and the `claude plugin list` "failed to load" message. The same refusal family also
    covers absolute, climbing (`..`), network-shaped, backslash, and symlink-escaping
    entries.
- **R-4 URL classification (`qbe`).** An `http(s)://` input has its fragment split
  off. A URL that ends `.git` or contains `/_git/` is git; a github.com
  `/<owner>/<repo>` path is git; a gitlab.com project path is git; every other one
  returns `{source: "url", url}`, the hosted catalog. There is no `.json` test, so
  letter case never decides upstream: `https://h/M.JSON` is a catalog.
- **R-5 Pi facts.**
  - The hosted kind exists only on this branch (absent from tag `v0.20.1` and from
    `origin/main`). No released Pi recorded a hosted marketplace, or a plugin from one.
  - `MarketplaceRecord.source` is `unknown`; `persistence/state-io.ts`
    `normalizeStoredSource` revalidates it at load.
  - `orchestrators/plugin/clone-cache.ts` already names a record's source
    `marketplaceSource: unknown`.
  - Pi already refuses the rest of upstream's family (a climbing or absolute path
    entry) as `unavailable` with the reason `unsupported source`.
  - An unavailable install row carries reasons and no cause (D-15-01, see
    `install.messaging.ts` `composeNotInstallableMessage`). Install reads a
    not-installable plugin the way list and info do (XSURF-01).
  - `plugin update` skips a resolver refusal as `no longer installable`, and only a
    missing plugin directory fails `{source missing}` (SRC-01, `update-preflight.ts`
    `candidateFailure`).
  - The pre-commit fixer `fix-unicode-dashes` (texthooks) rewrites a literal unicode
    dash in every file outside `.planning/`.
</upstream_evidence>

<interfaces>
Current code at HEAD 7ec095d3. Line numbers are approximate; read the named function before editing it.

domain/resolver-types.ts:
- `ResolveContext` (lines 195-224): `marketplaceRoot`, `marketplaceName`, `readFileText?`, `statKind?`, `resolveGitPluginRoot?`, `resolvePathPluginRoot?`, `pathPluginPin?`.
- Its compile proof is `test/domain/resolver-types.test.ts`: the `resolveContextContract` literal (about lines 141-146) is checked with `satisfies ResolveContext`.

domain/plugin-resolver.ts:
- Already imports `parsePluginSource` from `./source.ts` (lines 45-52).
- `unavailable(name, notes)` (lines 118-125) builds the structural arm.
- `classifySourceSupport` (lines 221-237) rejects npm, hosted, and unknown PLUGIN sources. It is untouched.
- `sourceEscapeReason` (lines 239-254) is the NFR-10 note `source path escapes marketplace root: <raw>`.
- `deriveSourcePluginRoot(entry, ctx, parsedSource, partial)` (lines 424-462). Its path arm first takes the pinned branch (`ctx.resolvePathPluginRoot` with `ctx.pathPluginPin`, lines 431-434), then resolves under `ctx.marketplaceRoot` with the escape check (lines 436-445).
- `preflightStages` (lines 501-602) calls it at line 565; `partial.notes` is still empty there.

Reason narrowing (no change needed):
- `shared/probe-classifiers.ts` `narrowResolverNotes` (list, info, update) maps a note no arm matches to `unsupported source`.
- `orchestrators/plugin/install.messaging.ts` `narrowResolverReasons` (install) falls back to `unsupported source` when no note classifies.
- `test/architecture/cross-surface-reason-parity.test.ts` pins that both sides agree, through a `{ note, reason }` table (lines 48-84).

Wiring sites. Each record's `source` is `unknown`, so no cast is needed:
- `orchestrators/plugin/install-outcome.ts` (`runInstallLedgerBody`):
  - `targetMp` is set at line 703.
  - The context is `resolveStrict(entry, { marketplaceRoot: targetMp.marketplaceRoot, marketplaceName: marketplace, resolveGitPluginRoot ... })` (lines 746-748).
  - Line 783 already passes `marketplaceSource: targetMp.source` to the tag-clone call inside the pinned-path callback, so the file's count of `marketplaceSource` goes from 1 to 2.
- `orchestrators/plugin/update-preflight.ts` `resolveUpdateCandidate` (lines 437-509):
  - The context is `resolveStrict(entry, { marketplaceRoot: marketplace.marketplaceRoot, marketplaceName: marketplace.name, ... })` (lines 452-454).
  - Line 477 already passes `marketplaceSource: marketplace.source` to the tag clone, so the count goes from 1 to 2.
  - `candidateFailure` (lines 519-549) skips a `no-longer-installable` throw as `no longer installable` unless its notes narrow to `source missing`.
- `orchestrators/plugin/info.ts`:
  - The installed path arm is `resolveStrict(entry, { marketplaceRoot: mpRecord.marketplaceRoot, marketplaceName: mpRecord.name, readFileText })` (lines 2347-2351). Its non-installable branch renders `installed` with the narrowed reasons (lines 2362-2389).
  - The not-installed path arm is the same context (lines 2748-2752). It goes to `buildNotInstalledNonInstallableRow`, then `buildNotInstalledPathRow`: `unavailable` with reasons from `narrowResolverNotes`, and components enumerated leniently under the derived root.
  - The git arms (lines 2210, 2589) never see a path entry. Leave them alone.
- `orchestrators/plugin/list-flow.ts` (available rows): `availableRowMessage(manifestEntry, { marketplaceRoot: mpRecord.marketplaceRoot, marketplaceName: mpName }, ...)` (lines 393-398).
- `orchestrators/plugin/list-candidate-row.ts` `availableRowMessage(manifestEntry, marketplaceContext: Pick<ResolveContext, "marketplaceRoot" | "marketplaceName">, locations, declaredEnabled)` (lines 124-129). It passes the context to `resolveListCandidate`. An unavailable verdict renders `reasons: narrowResolverNotes(resolved.notes)` (about line 100).
- `orchestrators/plugin/list-candidate-version.ts` `resolveListCandidate(manifestEntry, marketplaceContext: Pick<ResolveContext, "marketplaceRoot" | "marketplaceName">, locations)` (lines 47-51). A path entry goes to `resolveStrict(manifestEntry, marketplaceContext)` (line 54).
- `orchestrators/reconcile/convergence.ts` `recordMove`: `resolveListCandidate(entry, { marketplaceRoot: mp.marketplaceRoot, marketplaceName: mp.name }, input.locations)` (lines 397-401). `pathOffer` returns no offer for an unavailable candidate (lines 298-300).
- An object literal with an extra member fails TypeScript's excess-property check, so both `Pick` parameters must name the new member before list-flow.ts and convergence.ts can pass it.

Unit-test anchors (use each file's own hermetic helper):
- `test/domain/plugin-resolver.test.ts`:
  - Helpers: `resolveContext(marketplaceRoot, files, name)` (lines 138-167), `pluginEntry(over)` (lines 183-185), `gitCtx(result)` (about line 2794), `pathPinCtx(result, files, pin)` (lines 2976-2988).
  - Models: the D-PL5-05 hosted-plugin-source case (lines 2906-2924) and the escape case (about lines 2950-2965).
- `test/orchestrators/plugin/install-outcome.test.ts`:
  - Helpers: `createHermeticEnvironment`, `seedPlugin(cwd, opts)`, `runInstallLedger(state, locations, options)`, `projectInstallOptions(cwd)` (lines 911-922).
  - Model: the D-PL5-28 refusal case (lines 924-948).
- `test/orchestrators/plugin/update-preflight.test.ts`:
  - Helpers: `seedUpdate({ installed, source })`, `prepare(seed, opts)`, `pluginRecord(version)`.
  - Models: the npm skip case (lines 596-623) and "SRC-01: fails a path source whose directory is missing as source missing at the installed version" (lines 625-642).
- `test/orchestrators/plugin/info.test.ts`:
  - Helpers: `withHermeticHome`, `seedPathMarketplace({ scope, scopeRoot, cwd, mpName, manifest })`, `getPluginInfo(...)`, `makeCtx()`.
  - Model: "SRC-01 / VER-02: a path plugin whose directory is missing reads source missing at the entry version" (lines 812-832).
- `test/orchestrators/plugin/list-flow.test.ts`. Models: "LIST-01 / D-67-01: a structurally-unavailable plugin shows under --unavailable ..." (about line 1374) and the D-PL5-28 case (about line 2908).
- `test/orchestrators/reconcile/convergence.test.ts`:
  - Helpers: `createFixture`, `stageMarketplace(fixture, name, entries)` (its record's source is `acme/<name>`), `stateOf`, `pluginRecord(resolvedSource, overrides)`.
  - Models: "D-10 / D-18-11: a changed plugin root at the same version is a move" (lines 188-204) and "D-10: an unavailable candidate is not a move" (lines 342-356).

5.23 anchors:
- `domain/source.ts` `parseHostedManifestForm` (lines 399-438). Its doc comment says the suffix match is case sensitive (line 402); the suffix test is at line 429. `hostedObjectSource` (lines 287-297) re-parses a stored hosted record through the same funnel.
- `test/domain/source.test.ts`: the parse table (lines 386-454). The row "parses an https URL ending in an uppercase .JSON as a Git URL" (lines 409-413) expects `url` today.
- `test/persistence/state-io.test.ts`: the stored-source table (lines 915-982), with the two WR-02 `.json` rows (lines 945-963).
- `features/lib/published-marketplace.ts`: `HOSTED_MANIFEST` (line 38), `HostedPublication` (lines 115-123), `serveHostedManifest` (lines 129-132), and the hosted arm of `publishMarketplaceIn` (lines 264-278). The git host (`features/lib/https-git-host/server.ts`) serves files by exact path.
- `features/step_definitions/marketplace/publishing.steps.ts`: the step `the marketplace {string} is published as a {source kind} source` (lines 58-69) is the model for the new step.
- `features/marketplace/hosted-source.feature` has 11 `Scenario` lines. "Adding a hosted marketplace downloads its catalog once" (lines 7-22) is the model for the new scenario.

Feature steps that already exist (the writer owns the step text):
- `the marketplace {string} is published as a {source kind} source` (with `hosted`)
- `the marketplace {string} publishes this manifest:` (re-serves a hosted catalog)
- `the marketplace {string} offers these plugins:`
- `the git repository {string} holds these plugins:`
- `the marketplace {string} offers these plugins from git repositories:`
- `the marketplace {string} is added to the {word} scope`
- `the user has run {string}` (and its `, which failed` and `, which warned` forms)
- `the user runs {string}`
- `the result has these fields:`
- `the result lists these plugins:`
- `the result lists these marketplaces:`
- `the {word} scope has no installed plugins`
- `the installation record of the {word} scope holds these plugins:`
- `the "claude-plugins.json" file of the {word} scope declares no plugins` and `... declares these marketplaces:`
- `the git host receives these requests:`
- `the git host receives no request`

05-CONTEXT.md anchors:
- D-PL5-04 (line 78).
- The hosted relative-entry note under "Hosted marketplace.json (MKT-02)" (line 85).
- D-PL5-31 (line 160). The new bullets go directly after it, under "### Post-phase amendments (2026-10-27)".
- "Uncertain choices" items 1 (line 219) and 12 (line 230).
</interfaces>

<plan_decisions>
Settled for this plan. Task 3 records them in 05-CONTEXT.md.

- **Seam (D-PL5-32).** `ResolveContext` gains the optional member `marketplaceSource?: unknown`: the recorded source of the marketplace that lists the plugin.
  - The resolver parses it through `parsePluginSource`, as `samePlannedSource` parses a stored source. When it parses `hosted`, the path arm of `deriveSourcePluginRoot` refuses first: before the pinned-path callback (so no tag clone of a hosted source is ever tried) and before the NFR-10 escape check.
  - The refusal returns `unavailable(entry.name, [...partial.notes, <reason>])`.
  - Every path entry is refused: `./plugins/x`, `./`, `./.claude-plugin`, `../x`, an absolute path, a `~/` path. Git, npm, and unknown entries keep their verdicts.
  - Why the record: every other hosted check in the code keys on the record's parsed source, and `normalizeStoredSource` revalidates it at load. The hosted ownership marker is a file a clone or a local directory could hold, so it was rejected as the signal.
- **Reason text.** `<reason>` is R-1's sentence, verbatim. It lives in a module-private constant of `domain/plugin-resolver.ts`, with the dash written as the escape `—` (the `fix-unicode-dashes` fixer would rewrite a literal dash). Test files spell it the same way. No feature file carries it, because no row prints a resolver note.
- **Wired surfaces.** One added context member per site, plus two widened `Pick` parameters:
  - install: `install-outcome.ts`. This also covers enable, dependency members, `import`, and `apply`.
  - update and reinstall: `update-preflight.ts`. This also covers `apply`'s converge execution.
  - list available rows: `list-flow.ts`, through `list-candidate-row.ts` and `list-candidate-version.ts`.
  - info: `info.ts`, both path arms.
  - the convergence planner: `convergence.ts`, so `pending`, the load preview, and `apply` plan no move.
- **Outcome.**
  - install: `(unavailable) {unsupported source}`, with nothing recorded or declared.
  - list and info: `unavailable`, `unsupported source`.
  - update and reinstall: `(skipped) {no longer installable}`, with the installed version kept (SRC-01).
  - convergence: no move.
  - No reason token is added and `shared/notification-types.ts` is not touched. `unsupported source` is how Pi already reports a climbing or absolute entry, the rest of the same upstream family.
- **Divergences** (all go to the SUMMARY for user review):
  - (a) The install row reads `(unavailable) {unsupported source}`, not Claude Code's `Cannot install <id>: <reason>`. License: recorded decisions D-15-01 (an unavailable row carries no cause) and XSURF-01 (install agrees with list and info). Alternative: a failed row with the sentence as its cause. That would split install from list and info, and would put the U+2014 dash into a feature file, which the dash fixer rewrites.
  - (b) `plugin update` skips with `{no longer installable}`, where Claude Code fails it as `marketplace_entry_path_refused` with R-2's sentence. License: the SRC-01 rule (Pi's update skips a resolver refusal). Flag it for review.
  - (c) An installed plugin whose hosted entry later names a relative path keeps loading, with no warning. Claude Code fails to load it (R-2). License: APL-D1 (a load changes no installation state). The missing warning is a choice. No released Pi recorded a hosted marketplace (R-5), so only a catalog change after a release can produce such a plugin.
  - (d) Not gated:
    - tab completion (`edge-deps.ts` through `git-source-probe.ts`; the D-PL5-28 (g) precedent);
    - the pending force-install preview (`reconcile/notify.ts`, whose row reads the same either way);
    - AMIG (`reconcile/mcp-migration.ts`, which moves only legacy MCP entries an earlier release wrote, and no released version records a hosted marketplace);
    - the installed row's upgradable hint in `plugin list` (`list-installed-row.ts`, which follows the version);
    - `plugin fetch` (git entries only).
    - A constrained dependency on a relative hosted entry fails at the release-tag probe as `{no matching tag}` (`install-cascade.ts`, Phase 2's file) before the resolver runs.
- **D-PL5-33.** The suffix test of `parseHostedManifestForm` ignores letter case. The rest of D-PL5-04 stands:
  - a URL whose path does not end in `.json` still clones as git (MURL-01, D-76-01, D-2-01, D-2-02);
  - the github.com arm stays first;
  - the fragment is dropped and the query kept;
  - `gatedUrlField` never makes a manifest url object hosted.
  - Stored records keep their kind: a `url` record revalidates through the url object form, and a legacy string record that now parses hosted revalidates as url (WR-02). The state-io guard rows prove it.
- **Amendments to existing 05-CONTEXT.md text** (append only, edit nothing else):
  - D-PL5-04: ` Its \`.json\` match ignores case (D-PL5-33).`
  - The hosted relative-entry note (line 85): ` Reversed by D-PL5-32.`
  - "Uncertain choices" item 1: ` The suffix match ignores case (D-PL5-33, user decision 5.23).`
  - Item 12: ` Fixed by D-PL5-32 (user decision 5.12).`
- **Exports.** No new export. The reason constant and the hosted test are module-private, so fallow's production dead-code run has nothing to flag.
- **Out of scope** (proposals go to the SUMMARY):
  - edits to CHANGELOG.md, BACKLOG.md, PROJECT.md, and AGENTS.md;
  - the e2e suite;
  - the unwired surfaces of divergence (d);
  - merging and pushing.
</plan_decisions>
</context>

<source_audit>
| Source item | Covered by |
| --- | --- |
| 5.12: refuse a hosted catalog's relative entry (`./`, `./plugins/x`) with Claude Code's outcome | Task 1 (install, the tracer), Task 2 (list, info, update, convergence) |
| Verify the exact sentence and the surfaces that show it in the binary | `<upstream_evidence>` R-1 to R-3, done during planning; carried into D-PL5-32 by Task 3 |
| Find the narrowest seam; keep other phases' files to one-line touches | `<plan_decisions>` Seam: one optional context member, one resolver arm, one line or one widened `Pick` per site |
| Decide how list and info show such an entry, with no new token if one fits | Task 2: `unavailable` with `unsupported source` (existing token) |
| 5.23: case-insensitive `.json` suffix in `parseHostedManifestForm`, keeping D-PL5-04's narrowing | Task 3 |
| Record D-PL5-32 and D-PL5-33 after D-PL5-31 | Task 3 |
| A cucumber scenario that fails without each user-visible change | Task 1 (install Outline), Task 2 (list, info, update, pending), Task 3 (`.JSON` add); RED captured before each change |
| Unit tests with a hermetic home | every task, inside each test file's own hermetic or temporary-scope helper |
| `npm run check` unpiped, exit 0 | Task 3 |
| Review IN-06 / proposed HOSTED-REL-01 | Tasks 1 and 2; the SUMMARY says HOSTED-REL-01 is not needed |
</source_audit>

<tasks>

<task type="tracer">
  <name>Task 1: End-to-end install refusal: a hosted catalog's relative entry, from the record's source to the install row</name>
  <files>extensions/pi-claude-marketplace/domain/resolver-types.ts, test/domain/resolver-types.test.ts, extensions/pi-claude-marketplace/domain/plugin-resolver.ts, test/domain/plugin-resolver.test.ts, test/architecture/cross-surface-reason-parity.test.ts, extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts, test/orchestrators/plugin/install-outcome.test.ts, features/marketplace/hosted-relative-entry.feature</files>
  <read_first>.agents/skills/cucumber/rules/features.md and layout.md; .agents/skills/typescript-unit-tests/rules/cases.md; .agents/skills/typescript-style/rules/comments.md; .agents/skills/committing/SKILL.md; features/marketplace/hosted-source.feature (its install scenario and request-log steps); features/plugin/install.feature ("Installing a path-source plugin whose directory is missing names it unavailable as source missing"); domain/plugin-resolver.ts deriveSourcePluginRoot and preflightStages; the resolver-test helpers and models named in interfaces; the install-outcome test models named in interfaces</read_first>
  <behavior>
    - New feature file `features/marketplace/hosted-relative-entry.feature`, `Feature: Marketplace hosted relative entry`.
      - Its 2-3 line description: a hosted marketplace is one catalog file, so an entry that names a relative path has no plugin files behind it; Pi refuses such an entry as Claude Code does; the run's loopback https git host serves the catalog and records every request.
    - Its Outline "Installing a plugin that a hosted catalog lists by a relative path fails as unavailable with an unsupported source", with an `<entry source>` column (`./plugins/demo`, `./`, `./.claude-plugin`). This is not a `source kind` column, so the hosted-kind Outline rule does not apply. Steps:
      - The marketplace "tools" is published as a hosted source, publishes a manifest whose one entry is `demo` 1.0.0 at `<entry source>` (the placeholder in the doc string), and is added to the project scope.
      - The user runs `/claude:plugin install demo@tools --scope project`.
      - The result has kind `cascade`, severity `error`, needs reload `false`, and the summary `A plugin operation has failed.`.
      - It lists `tools | project | demo@tools | demo | unavailable | unsupported source`.
      - The project scope has no installed plugins, `claude-plugins.json` declares no plugins, and the git host receives no request.
      - RED: the `./plugins/demo` row reads `source missing`; the other two rows install the stored catalog tree.
    - `test/domain/plugin-resolver.test.ts`: one data-driven table of D-PL5-32 cases (titles start `MKT-02 / D-PL5-32:`). Every case compares the whole verdict, or `{ state, name, notes }` for the unavailable arm.
      - Refused, with notes exactly `[<reason>]`:
        - a hosted record source in the stored object form `{ kind: "hosted", raw, url }`, with entries `./plugins/demo` (its directory present in the stat map), `./` (the marketplace root, present), `../demo`, and `/abs/demo`;
        - the same `./plugins/demo` with the hosted source in string form.
      - Pinned path: `pathPinCtx(materialized)` plus a hosted source is refused, and its `resolvePathPluginRoot` double records zero calls.
      - Unchanged guards:
        - `./plugins/demo` with a path, github, or url record source, or with no `marketplaceSource`, resolves `installable` at the same root as today;
        - a hosted marketplace's `{ source: "url", url }` entry still resolves through `resolveGitPluginRoot`;
        - its npm entry still notes `unsupported source kind: npm`.
    - `test/domain/resolver-types.test.ts`: the `resolveContextContract` literal gains a `marketplaceSource` member, so the compile proof fails without the new member.
    - `test/architecture/cross-surface-reason-parity.test.ts`: a new `{ note: <reason>, reason: "unsupported source" }` row, so both surfaces read the new note the same way.
    - `test/orchestrators/plugin/install-outcome.test.ts`, case "D-PL5-32: installing a relative entry of a hosted marketplace fails as not installable and writes nothing":
      - Arrange: a seeded marketplace whose record source is a hosted object and whose entry is `./`.
      - Assert: `runInstallLedger` rejects with `PluginShapeError` whose whole `shape` is the not-installable shape with reasons `[<reason>]`.
      - Assert: the marketplace's `plugins` stay `{}` and `state.json` keeps its bytes. Model the D-PL5-28 case.
  </behavior>
  <action>
    1. **RED first.** This is the required "fails without the change" evidence.
       - Add the feature file with its Outline, using only the existing steps from interfaces.
       - Add the unit cases and the parity row. Spell the reason with the six-character escape `—` in every test file.
       - Run `npx cucumber-js features/marketplace/hosted-relative-entry.feature` and `node --test test/domain/plugin-resolver.test.ts test/architecture/cross-surface-reason-parity.test.ts test/orchestrators/plugin/install-outcome.test.ts`, and save the failing output in the scratchpad for the SUMMARY.
       - The new resolver and install cases fail because nothing refuses yet. The parity row may already pass (the catch-all maps it): say so. `npm run typecheck` fails on the contract literal: say so.
       - Do not commit the RED state.
    2. **In domain/resolver-types.ts**, add `readonly marketplaceSource?: unknown` to `ResolveContext`.
       - Its doc comment says, citing D-PL5-32: the recorded source of the marketplace that lists the plugin (`MarketplaceRecord.source`); a hosted catalog holds no plugin files, so the resolver refuses every path entry of such a marketplace; when the member is absent, path entries resolve under `marketplaceRoot` as before.
    3. **In domain/plugin-resolver.ts**:
       - Add a module-private constant holding R-1's reason verbatim, with the dash as the escape `—`, and a module-private predicate that parses `ctx.marketplaceSource` through `parsePluginSource` and tests for `hosted`.
       - Make the predicate the first check of the path arm in `deriveSourcePluginRoot`. It returns the `unavailable` verdict with `[...partial.notes, <reason>]`. Add a branch and nothing else, so both complexity gates stay under 15.
       - Extend the module header and the `deriveSourcePluginRoot` doc comment by one sentence each (D-PL5-32: a hosted catalog has no plugin directory, so the path arm refuses before the pinned callback and the escape check, with Claude Code's reason).
       - After editing, confirm the source holds the escape and not a literal dash: the gate below counts `tree — or` with a literal backslash. If the editor wrote a literal character, rewrite that line through a short script.
    4. **In orchestrators/plugin/install-outcome.ts**, add `marketplaceSource: targetMp.source,` to the `resolveStrict` context, after `marketplaceName`. Change nothing else.
    5. **Run the neighbors before GREEN:**
       - `npx cucumber-js features/marketplace/hosted-source.feature features/marketplace/hosted-source-update.feature features/plugin/install.feature features/plugin/install-dependencies.feature` must stay green.
       - A path or git marketplace's relative entries must be untouched.
    6. **GREEN, then commit.**
       - Re-run the owner tests, `node --test test/domain/resolver-types.test.ts`, direct coverage for the two sources, the feature file, and `npm run check:features`.
       - Every new unit case runs inside its file's own hermetic helper (`createHermeticEnvironment` in install-outcome.test.ts; in-memory contexts in the resolver test). No test writes to the real `~/.pi/agent`.
       - Run `SKIP=npm-check pre-commit run --files` with the 8 files, and restage any fixer change.
       - Stage exactly the 8 paths with `git add --`. Never use `git add -A` or `git add .`; the operator edits concurrently.
       - Commit in the foreground with the longest tool timeout: `fix(plugin): refuse a relative entry of a hosted marketplace on install`. The body says why (Claude Code 2.1.310 refuses every relative entry of a url-catalog marketplace at install) and ends with the session's attribution trailer.
       - Never use `--no-verify` or `--amend`, and never pipe the commit's output.
       - Afterwards `git status --short` must list none of the 8 paths.
  </action>
  <verify>
    <automated>node --test test/domain/plugin-resolver.test.ts test/domain/resolver-types.test.ts test/architecture/cross-surface-reason-parity.test.ts test/orchestrators/plugin/install-outcome.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/plugin-resolver.ts extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts && npx cucumber-js features/marketplace/hosted-relative-entry.feature features/marketplace/hosted-source.feature features/plugin/install.feature features/plugin/install-dependencies.feature && npm run check:features && test "$(grep -c 'marketplaceSource' extensions/pi-claude-marketplace/domain/resolver-types.ts)" -ge 1 && test "$(grep -c 'marketplaceSource' extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts)" -ge 2 && test "$(grep -c 'url-catalog marketplace' extensions/pi-claude-marketplace/domain/plugin-resolver.ts)" -ge 1 && test "$(grep -c 'tree \\u2014 or' extensions/pi-claude-marketplace/domain/plugin-resolver.ts)" -ge 1 && test "$(grep -c 'url-catalog' test/architecture/cross-surface-reason-parity.test.ts)" -ge 1 && test "$(grep -c 'D-PL5-32' test/domain/plugin-resolver.test.ts)" -ge 1 && test "$(grep -c '^  Scenario' features/marketplace/hosted-relative-entry.feature)" -ge 1</automated>
  </verify>
  <done>
    - The Outline rows and the new resolver and install cases failed before the change, with the RED output saved, and pass after it.
    - The path, git, and hosted-source neighbors stay green.
    - plugin-resolver.ts and install-outcome.ts keep 100% direct coverage.
    - The commit hook (`npm run check:commit`) passed on a commit holding exactly the 8 files.
    - Gate baselines at 7ec095d3: resolver-types `marketplaceSource` 0; install-outcome `marketplaceSource` 1; plugin-resolver `url-catalog marketplace` 0 and escape 0; parity `url-catalog` 0; resolver-test `D-PL5-32` 0; the feature file absent.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The same refusal on list, info, update, and the convergence planner</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts, extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts, extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts, test/orchestrators/plugin/list-flow.test.ts, extensions/pi-claude-marketplace/orchestrators/plugin/info.ts, test/orchestrators/plugin/info.test.ts, extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts, test/orchestrators/plugin/update-preflight.test.ts, extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts, test/orchestrators/reconcile/convergence.test.ts, features/marketplace/hosted-relative-entry.feature</files>
  <read_first>.agents/skills/cucumber/rules/steps.md and world-and-stand-ins.md; features/plugin/update.feature ("Updating a plugin whose marketplace now names a missing source directory fails as source missing and keeps it installed"); features/plugin/list.feature (the first scenario's unavailable npm row); features/plugin/info.feature (the npm info scenario); features/marketplace/hosted-source.feature (the hosted install scenario with a url git entry, and the pending scenario); the wiring sites and the test models named in interfaces</read_first>
  <behavior>
    - Four scenarios in `features/marketplace/hosted-relative-entry.feature`. The writer owns the step text and pins every field table from the GREEN run. Each scenario must fail before this task.
      - "The plugin list shows the plugins a hosted catalog lists by a relative path as unavailable with an unsupported source":
        - A hosted `tools` publishes `demo` at `./plugins/demo` and `root` at `./`, both 1.0.0, and is added to the project scope; then `/claude:plugin list --scope project`.
        - Both rows read `unavailable | unsupported source | | 1.0.0`, and the git host receives no request.
        - RED: demo reads `source missing` and root reads `available`.
      - "Info on a plugin that a hosted catalog lists by a relative path names it unavailable with an unsupported source":
        - `root` at `./`; `/claude:plugin info root@tools`.
        - The plugin-info fields: status `unavailable`, reasons `unsupported source`, version `1.0.0`, and the rest as GREEN prints them. The git host receives no request.
        - RED: status `available`.
      - "Updating a plugin that a hosted catalog now lists by a relative path skips it as no longer installable and keeps it installed":
        - The git repository "ghp" holds `ghp` 1.0.0; the hosted `tools` offers it from git repositories as a url source; it is added; the user has run the install.
        - The marketplace then publishes a manifest listing `ghp` 2.0.0 at `./`, and the user has run `/claude:plugin marketplace update tools --scope project`.
        - `/claude:plugin update ghp@tools --scope project` lists `ghp` as `skipped` with `no longer installable`, and the installation record still holds `ghp@tools | 1.0.0 | true`. The request-log step states what GREEN shows (expected: no request).
        - RED: the update moves ghp onto the stored tree and reads `updated`.
      - "A hosted catalog that now lists an installed plugin by a relative path leaves nothing pending":
        - The same setup, then `/claude:plugin pending --scope project`.
        - The result is `reconcile-pending-empty`, and the git host receives no request.
        - RED: the planner previews a move.
    - Unit cases (titles start `D-PL5-32:`). Each fails without its own wiring line.
      - list-flow.test.ts: a recorded hosted marketplace whose catalog lists an uninstalled entry at `./` renders the exact `(unavailable) {unsupported source}` row.
      - info.test.ts:
        - not installed: the same entry gives the exact `⊘ ... (unavailable) {unsupported source}` notification;
        - installed: a recorded plugin whose catalog entry is now `./` gives the exact row the non-installable installed branch prints (expected `installed` with `{unsupported source}`; pin what GREEN prints).
      - update-preflight.test.ts: `seedUpdate` with a hosted marketplace record source and the entry `./`.
        - `prepare` returns exactly the skipped outcome: partition `skipped`, reasons `["no longer installable"]`, notes `['Plugin "hello" is no longer installable: <reason>']`, with the other fields as the model case shows.
        - Extend the seed with an optional marketplace source if it has none; that is a test-only change.
      - convergence.test.ts: a `tools` record whose source is a hosted object, whose catalog lists `demo` at `./` at a new version, and whose `demo` record sits at another root.
        - `planConvergence` returns `{ moves: [], holds: [], declines: [] }`.
        - Without the line, the same setup yields a move, as the D-10 / D-18-11 model shows.
  </behavior>
  <action>
    1. **RED first.**
       - Add the four scenarios and the unit cases. Spell the reason with `—` in the update-preflight expectation.
       - Run `npx cucumber-js features/marketplace/hosted-relative-entry.feature` and `node --test test/orchestrators/plugin/list-flow.test.ts test/orchestrators/plugin/info.test.ts test/orchestrators/plugin/update-preflight.test.ts test/orchestrators/reconcile/convergence.test.ts`, and save the failing output.
       - Report each failure against the RED expectations in behavior. Do not commit the RED state.
    2. **Wire each site with one added member**, the record's `source`, and nothing else:
       - `marketplaceSource: mpRecord.source` in both info.ts path-arm contexts;
       - `marketplaceSource: marketplace.source` in the update-preflight.ts `resolveUpdateCandidate` context;
       - `marketplaceSource: mpRecord.source` in the list-flow.ts available-row context;
       - `marketplaceSource: mp.source` in the convergence.ts `recordMove` context.
    3. **Widen the two parameters** to `Pick<ResolveContext, "marketplaceRoot" | "marketplaceName" | "marketplaceSource">`: `availableRowMessage` in list-candidate-row.ts and `resolveListCandidate` in list-candidate-version.ts. Let Prettier reflow the literals.
       - Do not touch `list-installed-row.ts`, `git-source-probe.ts`, `edge-deps.ts`, `reconcile/notify.ts`, `reconcile/pending.ts`, `reconcile/mcp-migration.ts`, `fetch.ts`, or `install-cascade.ts`. They are the not-gated surfaces of divergence (d).
    4. **Fixture check.**
       - Run `npx cucumber-js features/plugin/list.feature features/plugin/info.feature features/plugin/update.feature features/plugin/pending.feature features/plugin/reinstall.feature features/plugin/apply.feature features/marketplace/hosted-source.feature`.
       - A scenario that changes because a fixture lists a relative entry from a hosted catalog is fixed test-side and listed under Deviations. None is expected: no existing hosted scenario installs or lists a relative entry.
    5. **GREEN, then commit.**
       - Re-run everything above, direct coverage for the 6 sources, and `npm run check:features`.
       - Every new unit case runs inside its file's own hermetic helper (`withHermeticHome` in info.test.ts and list-flow.test.ts, `createFixture` in convergence.test.ts, `seedUpdate`'s temporary directory in update-preflight.test.ts). No test writes to the real `~/.pi/agent`.
       - Run `SKIP=npm-check pre-commit run --files` with the 11 files, then `git add --` with exactly those paths.
       - Commit in the foreground: `fix(plugin): refuse hosted relative entries in list, info, and update`, with the attribution trailer. Task 1's commit rules apply.
  </action>
  <verify>
    <automated>node --test test/orchestrators/plugin/list-flow.test.ts test/orchestrators/plugin/list-candidate-row.test.ts test/orchestrators/plugin/list-candidate-version.test.ts test/orchestrators/plugin/info.test.ts test/orchestrators/plugin/update-preflight.test.ts test/orchestrators/reconcile/convergence.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts extensions/pi-claude-marketplace/orchestrators/plugin/info.ts extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts && npx cucumber-js features/marketplace/hosted-relative-entry.feature features/marketplace/hosted-source.feature features/plugin/list.feature features/plugin/info.feature features/plugin/update.feature features/plugin/pending.feature && npm run check:features && test "$(grep -c 'marketplaceSource' extensions/pi-claude-marketplace/orchestrators/plugin/info.ts)" -ge 2 && test "$(grep -c 'marketplaceSource' extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts)" -ge 2 && test "$(grep -c 'marketplaceSource' extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts)" -ge 1 && test "$(grep -c 'marketplaceSource' extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts)" -ge 1 && test "$(grep -c 'marketplaceSource' extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts)" -ge 1 && test "$(grep -c 'marketplaceSource' extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts)" -ge 1 && test "$(grep -c '^  Scenario' features/marketplace/hosted-relative-entry.feature)" -ge 5 && test "$(grep -c 'D-PL5-32' test/orchestrators/plugin/update-preflight.test.ts)" -ge 1 && test "$(grep -c 'D-PL5-32' test/orchestrators/reconcile/convergence.test.ts)" -ge 1</automated>
  </verify>
  <done>
    - The four scenarios and the five unit cases failed before the change and pass after it.
    - Every site changed by one member, or by one widened `Pick`.
    - The six sources keep 100% direct coverage, and both complexity gates pass in the commit hook.
    - Gate baselines at 7ec095d3: `marketplaceSource` in info.ts 0, update-preflight.ts 1, list-flow.ts 0, list-candidate-row.ts 0, list-candidate-version.ts 0, convergence.ts 0; hosted-relative-entry Scenario lines 1 after Task 1; `D-PL5-32` in the update-preflight and convergence tests 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Match the hosted .json suffix in any case, record D-PL5-32 and D-PL5-33, and pass the full gate</name>
  <files>extensions/pi-claude-marketplace/domain/source.ts, test/domain/source.test.ts, test/persistence/state-io.test.ts, features/lib/published-marketplace.ts, features/step_definitions/marketplace/publishing.steps.ts, features/marketplace/hosted-source.feature, .planning/phases/05-marketplace-command-parity/05-CONTEXT.md</files>
  <read_first>.agents/skills/cucumber/rules/steps.md, layout.md, and world-and-stand-ins.md (the hosted publication and the git host's served files); .agents/skills/local-verification/rules/gates.md; domain/source.ts parseHostedManifestForm and hostedObjectSource; persistence/state-io.ts revalidateStoredUrlSource and revalidateStoredStringSource; the 5.23 anchors named in interfaces; .planning/phases/05-marketplace-command-parity/05-CONTEXT.md (the "Post-phase amendments (2026-10-27)" section, D-PL5-04, the hosted relative-entry note, "Uncertain choices")</read_first>
  <behavior>
    - New scenario in features/marketplace/hosted-source.feature: "Adding a hosted marketplace whose URL ends in an uppercase .JSON downloads its catalog".
      - The marketplace "tools" is published as a hosted source that the git host serves as `marketplace.JSON`.
      - The user runs `/claude:plugin marketplace add https://{git host}/acme/tools/marketplace.JSON --scope project`.
      - The result is cascade, info, needs reload `false`; `tools | project | added`.
      - `claude-plugins.json` declares `tools` with that URL.
      - The git host receives exactly `GET /acme/tools/marketplace.JSON 200`.
      - RED: the URL clones as git, so the add fails and the host logs an `info/refs` request.
    - The new step publishes a hosted marketplace served under a named file (proposed text: `the marketplace {string} is published as a hosted source served as {string}`; the writer owns it), in publishing.steps.ts.
      - It records the publication as the existing publish step does, and registers its release.
      - It asserts that the publication's source URL ends with the file name it served.
      - It writes no token into step text, and the module exports nothing.
    - features/lib/published-marketplace.ts:
      - `HostedPublication` gains the served file name; `serveHostedManifest` serves under it, so every later change re-serves the same name.
      - The hosted arm of `publishMarketplaceIn` and the new publisher share one private helper (no fallow clone group). The default stays `marketplace.json`.
    - test/domain/source.test.ts (titles start `D-PL5-33:`):
      - The uppercase row becomes "D-PL5-33: parses an https URL ending in an uppercase .JSON as a hosted catalog", expecting `{ kind: "hosted", raw, url }`.
      - New row: a mixed-case `.Json` with a fragment, expecting the fragment dropped from `url`.
      - New guard rows: a `.JSONL` path stays `url`; a query naming `m.JSON` stays `url`.
    - test/persistence/state-io.test.ts, two guard rows that pass before and after (say so in the SUMMARY):
      - "a stored URL source whose path ends in an uppercase .JSON as a URL source";
      - "a legacy string URL whose path ends in an uppercase .JSON as a URL source".
  </behavior>
  <action>
    1. **RED first.**
       - Add the scenario, the step and its library change, and the unit rows.
       - Run `npx cucumber-js features/marketplace/hosted-source.feature` and `node --test test/domain/source.test.ts test/persistence/state-io.test.ts`, and save the failing output.
       - Expected: the scenario and the hosted `.JSON` and `.Json` rows fail; the guard rows pass. Do not commit the RED state.
    2. **In domain/source.ts parseHostedManifestForm**, make the suffix test ignore letter case. Lower-case the URL path before the string comparison; Sonar prefers string arguments to a regular expression for a literal suffix.
       - Replace the doc comment's sentence about the case-sensitive match with one that says the match ignores case, as Claude Code reads any such URL as a catalog (D-PL5-33). Change nothing else in the function.
    3. **GREEN, then commit the code.**
       - Run the owner tests, `npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/source.ts`, `npx cucumber-js features/marketplace/hosted-source.feature features/marketplace/url-source.feature features/marketplace/unsupported-source.feature features/marketplace/add.feature`, and `npm run check:features`.
       - The tests write only to scratch directories, never to the real `~/.pi/agent`.
       - Run `SKIP=npm-check pre-commit run --files` with the 6 code and test files, then `git add --` with exactly those paths.
       - Commit in the foreground: `fix(marketplace): match a hosted catalog's .json suffix in any case`, with the attribution trailer.
    4. **Record the decisions in 05-CONTEXT.md.**
       - Re-read the file first; the operator edits it concurrently.
       - Directly after the D-PL5-31 bullet, under "### Post-phase amendments (2026-10-27)", insert two bullets with sub-bullets, built from plan_decisions and upstream_evidence:
         - `**D-PL5-32 (hosted relative entries, user decision 5.12, 2026-10-27; closes review IN-06):**` with sub-bullets for: the rule; the seam and the wired surfaces; the outcome per surface; the wording (R-1's reason verbatim, and that no row prints it, D-15-01); the evidence (R-1 to R-3, binary 2.1.310 and the three docs pages, 2026-10-27); the divergences (a) to (d) with their licenses.
         - `**D-PL5-33 (hosted .json suffix in any case, user decision 5.23, 2026-10-27; amends D-PL5-04):**` with the rule, what stays of D-PL5-04, the stored-record guard (WR-02), and the evidence (R-4).
       - Make the four appends listed in plan_decisions. Edit nothing else.
       - Run `SKIP=npm-check pre-commit run --files` on that file, `git add --` with that one path, and commit: `docs: record the hosted relative-entry and .json case decisions`.
    5. **Run the full gate on the combined tree:** `npm run check`.
       - Do not pipe it. Redirect its output to a log in the scratchpad, and capture the status on its own, for example `npm run check > "$LOG" 2>&1; status=$?; echo "npm run check exit=$status"`.
       - It can outlast a 10-minute foreground call, so run it once in the background and wait for the completion notice. No sleep or poll loops.
       - It must exit 0. If it fails, fix the cause in the owning task's files with a new commit (never amend), and run it again.
       - Record the command, exit status, HEAD SHA, `node --version`, and scope (check:static, test:unpaired, test:integration, test:cucumber, test:coverage:direct:all) in the SUMMARY.
    6. **Write the quick SUMMARY** that output describes. Do not commit it, STATE.md, or this PLAN; the orchestrator commits the docs. Do not merge or push.
  </action>
  <verify>
    <automated>node --test test/domain/source.test.ts test/persistence/state-io.test.ts && npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/source.ts && npx cucumber-js features/marketplace/hosted-source.feature features/marketplace/url-source.feature features/marketplace/unsupported-source.feature && npm run check:features && test "$(grep -c '^  Scenario' features/marketplace/hosted-source.feature)" -ge 12 && test "$(grep -c 'D-PL5-33' extensions/pi-claude-marketplace/domain/source.ts)" -ge 1 && test "$(grep -c 'D-PL5-33' test/domain/source.test.ts)" -ge 1 && test "$(grep -c 'D-PL5-32' .planning/phases/05-marketplace-command-parity/05-CONTEXT.md)" -ge 2 && test "$(grep -c 'D-PL5-33' .planning/phases/05-marketplace-command-parity/05-CONTEXT.md)" -ge 2 && npm run check</automated>
  </verify>
  <done>
    - The `.JSON` scenario and the hosted parse rows failed before the change and pass after it. The guard rows pass before and after, as intended.
    - source.ts keeps 100% direct coverage.
    - 05-CONTEXT.md holds D-PL5-32 and D-PL5-33 after D-PL5-31, plus the four appends.
    - `npm run check` exits 0 on the final HEAD, and the SUMMARY records its status, SHA, and Node version.
    - Four commits exist (two in Tasks 1-2, the code and docs commits here), each made by explicit pathspec and through the hooks. Nothing is merged or pushed.
    - Gate baselines at 7ec095d3: hosted-source Scenario lines 11; `D-PL5-33` in source.ts 0 and in source.test.ts 0; `D-PL5-32` and `D-PL5-33` in 05-CONTEXT.md 0 each.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| hosted catalog -> resolver | A downloaded `marketplace.json` names each entry's source; the server that publishes it is not trusted to point Pi at Pi's own files. |
| state.json record -> resolver | The record's source decides whether a marketplace has a plugin tree; it is revalidated at load. |
| user-typed URL -> source classifier | The suffix decides between a git clone and a hosted download. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-ckr-01 | Tampering | domain/plugin-resolver.ts deriveSourcePluginRoot (path arm) | high | mitigate | A hosted catalog can no longer root a plugin at Pi's stored download (`./`, `./.claude-plugin`), for example one whose inline MCP servers would load from the catalog alone. Every path entry of a record whose source parses `hosted` is refused before any root is derived, ahead of the pinned callback and the escape check. Proven by the resolver table and the install Outline (Task 1). |
| T-ckr-02 | Tampering | update-preflight.ts, convergence.ts | high | mitigate | A catalog refresh that re-points an installed plugin to a relative path cannot move it onto the stored tree through `plugin update`, `reinstall`, or `apply`: update skips it, and the planner plans no move (Task 2 unit cases and scenarios). |
| T-ckr-03 | Spoofing | ResolveContext.marketplaceSource wiring | medium | mitigate | The refusal keys on the state record's source, which `normalizeStoredSource` revalidates, not on a file inside the tree that a clone or a directory could plant. Each wiring line has a unit case that fails without it. |
| T-ckr-04 | Repudiation | the not-gated surfaces of divergence (d) | low | accept | Each is recorded in D-PL5-32 with the reason it is safe or out of scope, and listed in the SUMMARY for user review. |
| T-ckr-05 | Tampering / SSRF | domain/source.ts parseHostedManifestForm (`.JSON`) | medium | mitigate | A `.JSON` URL now takes the hosted download instead of a git clone, under the same D-PL5-07 guards (https only, 10 s, 5 MiB, redirect checks D-PL5-29 to D-PL5-31). Stored `url` records keep their kind (WR-02), proven by the state-io guard rows. |
| T-ckr-SC | Tampering | npm/pip/cargo installs | high | accept | This plan installs no packages. |
</threat_model>

<verification>
- RED evidence is saved for every new scenario and unit case, captured before its source change. The state-io and source guard rows are noted as passing before and after, by design.
- Owner tests and 100% direct coverage pass for every touched source.
- `npx cucumber-js` passes features/marketplace (hosted-relative-entry, hosted-source, hosted-source-update, url-source, unsupported-source, add) and features/plugin (install, install-dependencies, list, info, update, pending). `npm run check:features` passes.
- Every count gate moves from its recorded baseline at 7ec095d3.
- `npm run check` exits 0 on the final HEAD, run unpiped, with its status read from the shell.
</verification>

<success_criteria>
- A plugin that a hosted catalog lists by a relative path:
  - cannot be installed: `(unavailable) {unsupported source}`, nothing recorded;
  - reads `unavailable` / `unsupported source` in list and info;
  - is skipped by update as `no longer installable`;
  - is never planned as a move.
- Path, github, and url marketplaces resolve relative entries as before.
- An https URL whose path ends in `.json` in any letter case adds as a hosted catalog, and stored records keep their kind.
- D-PL5-32 and D-PL5-33 are in 05-CONTEXT.md.
- Four commits went through the hooks by pathspec, and `npm run check` exits 0.
- Nothing is merged or pushed.
</success_criteria>

<output>
Create `.planning/quick/261027-ckr-refuse-hosted-relative-entries-and-match/261027-ckr-SUMMARY.md`. Do not commit it. Its frontmatter carries `status: complete`. It contains:
- What changed, by surface (install, list, info, update and reinstall, the convergence planner) and for the `.json` suffix, with the commit SHAs and their titles.
- RED evidence: each scenario and unit case that failed before its change, with the failing step or assertion; the guard rows that passed before and after.
- Verification: owner tests, direct coverage, cucumber runs, and the `npm run check` record (status, SHA, Node version, scope).
- The D-PL5-32 and D-PL5-33 text as committed.
- The upstream evidence (R-1 to R-4) in short, with the binary version and the docs pages.
- Choices for user review: divergences (a) to (d) from plan_decisions.
- For the parent:
  - HOSTED-REL-01 need not be added to BACKLOG.md; D-PL5-32 does it, and review IN-06 is closed.
  - Proposed backlog entries: a load-time warning for an installed plugin whose hosted entry names a relative path (divergence c), and the not-gated surfaces of divergence (d).
  - Proposed CHANGELOG sub-bullets under the marketplace-parity entry:
    - "`plugin install` refuses a plugin that a hosted marketplace lists by a relative path, as Claude Code does, and `list`, `info`, and `update` report it as unavailable."
    - "A hosted marketplace URL whose path ends in `.json` in any letter case is downloaded as a catalog."
- Deviations, including any fixture fixed test-side.
- `## Threat Flags`, even if the answer is "None -- no security-relevant surface outside the plan's `<threat_model>` was introduced."
</output>
