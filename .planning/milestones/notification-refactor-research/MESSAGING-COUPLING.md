# Messaging / Notification Subsystem — Open-Closed Coupling Audit

## Executive summary

The notification subsystem is a single 3119-line monolith
(`extensions/pi-claude-marketplace/shared/notify.ts`) that owns every closed
grammar set, every per-status interface, the discriminated unions, the renderer
switches, and the severity/summary/reload ladders for all 18 commands. Today,
**adding a command that reuses existing grammar touches 5 central files**
(router switch + `SubcommandHandlers` interface, `register.ts`, optionally
`completions/provider.ts`, plus its catalog section + a UAT fixture) on top of
its own ~2 new vertical files. **Adding a command that introduces one new status
token + one new reason touches 9–11 central edit sites**, the worst of which are
six distinct constructs inside `notify.ts` (the status tuple, the per-variant
interface, the union member, the renderer switch arm, the severity/reload-ladder
arms, and the `notify-types.test.ts` length-locks) plus the hand-maintained
`docs/output-catalog.md` status-token table and a new catalog `(section, state)`
fixture pair.

The top three open-closed violations by severity are: (1) `notify.ts` itself as
a god-module that concentrates all command grammar; (2) the
`docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` byte-contract,
which is hand-authored and forces a manual edit in two files per new rendered
state; (3) the cross-cutting hooks-summary (`appendHooksBlock`) and soft-dep
marker injection (`composeReasons`) being embedded in the monolith rather than
contributed by concern-modules.

The localized-grammar proposal (each command declares an `as const` grammar
contribution; a registry unions them) **preserves compile-time exhaustiveness
with caveats** — a union of registered `as const` literals type-checks cleanly
for the *status-token set* and the *reason set*, but the per-status **renderer
arm** cannot be made exhaustive by a registry of render functions without losing
the `assertNever` guarantee; that arm must either stay a central switch keyed on
the (now registry-derived) union, or move to a discriminated render-fn table
whose exhaustiveness is proven by a `Record<Status, RenderFn>` mapped type. The
**catalog byte-stability is preserved only if the catalog/UAT gains a generation
or aggregation step** — today both the catalog markdown and the UAT fixture map
are hand-maintained and centrally located; moving grammar declarations into
command modules does not by itself relocate the catalog, so the catalog remains
a central artifact unless its per-command sections are generated from the
per-command grammar declarations.

Achievable target: **a new command touches 3 central files** (router
registration line, `register.ts` wiring line, and a generated/aggregated catalog
section) plus its own vertical slice — down from 5 (no new grammar) / 9–11 (new
grammar). The args-schema and completion provider are partially irreducible
(see Part D).

---

## Part A — Per-command "files-touched" matrix

### A.1 The command set (confirmed from the router)

`edge/router.ts` defines exactly two dispatchers and their accepted tokens.

Top-level (`routeClaudePlugin`, `edge/router.ts:143`–`172`), with the alias set
declared at `edge/router.ts:55`–`69` (`TOP_LEVEL_SUBCOMMANDS`):

- `bootstrap`, `install`, `uninstall`, `update`, `reinstall`,
  `list` (alias `ls`), `info` (dispatched to `pluginInfo`), `pending`,
  `enable`, `disable`, `import`, and `marketplace` (delegates to
  `routeMarketplace`).

Marketplace (`routeMarketplace`, `edge/router.ts:190`–`213`), aliases at
`edge/router.ts:75`–`85` (`MARKETPLACE_SUBCOMMANDS`):

- `add`, `remove` (alias `rm`), `list` (alias `ls`), `info`, `update`,
  `autoupdate`, `noautoupdate`.

That is **18 command handlers** wired in `edge/register.ts:78`–`97`
(`autoupdate`/`noautoupdate` share `makeAutoupdateHandler` with a boolean;
`enable`/`disable` share `makeEnableDisableHandler` with a boolean), routed via
**18 `SubcommandHandlers` interface fields** (`edge/router.ts:26`–`49`) and
**19 switch `case` labels** across the two routers (counting alias cases).

### A.2 Where a new command must be edited

Classification of every file an added command forces a change in. "Verified"
means I read the file and confirmed the construct.

#### Vertical (new files, acceptable)

| File (pattern)                                    | What it holds                          | Evidence |
| ------------------------------------------------- | -------------------------------------- | -------- |
| `edge/handlers/<group>/<cmd>.ts` (NEW)            | thin-shim arg parse + delegate         | `edge/handlers/plugin/install.ts:39`–`89`; `edge/handlers/marketplace/add.ts:25`–`48` |
| `orchestrators/<group>/<cmd>.ts` (NEW)            | the command's behavior + notify call   | `orchestrators/plugin/install.ts:875`; `orchestrators/marketplace/add.ts:489` |

#### Central, always (open-closed violation regardless of grammar)

| File | Edit forced | Evidence (path:line) |
| ---- | ----------- | -------------------- |
| `edge/router.ts` — `SubcommandHandlers` interface | add a method field | `edge/router.ts:26`–`49` |
| `edge/router.ts` — `*_SUBCOMMANDS` `as const` tuple | add the token (+ aliases) | `edge/router.ts:55`–`69`, `:75`–`85` |
| `edge/router.ts` — switch arm | add a `case` | `edge/router.ts:143`–`172`, `:190`–`213` |
| `edge/router.ts` — `TOP_LEVEL_USAGE` / `MARKETPLACE_USAGE` | add a usage line | `edge/router.ts:87`–`110` |
| `edge/register.ts` — handler wiring | add a `make*Handler(pi[, deps])` entry | `edge/register.ts:78`–`97` |
| `edge/completions/provider.ts` — completion branch | extend TC-1/TC-3/TC-5/TC-6 dispatch + flag list if the command has new flags or a positional | `edge/completions/provider.ts:69`–`126` (`topLevelCompletions`, `flagCompletions`), `:189`–`245` (`pluginRefBranchConfig`), `:60`–`67`/`:163`–`172` (`MARKETPLACE_VERBS_WITH_NAME_ARG`) |

`edge/args-schema.ts` is **NOT** in this list: it is grammar-agnostic. It is a
generic positional validator (`parseCommandArgs<Spec>`, `args-schema.ts:65`) that
takes a per-command `{ positional, usage }` schema *from the handler* and an
`onError` callback; it hard-codes nothing command-specific
(`args-schema.ts:1`–`96`). A new command supplies its schema in its own handler,
so args-schema stays untouched. (This refutes the brief's tentative inclusion of
args-schema in the "central always" set; the central args coupling lives in the
router usage strings, not the schema validator.)

The completion provider is partly conditional: a command that takes no
positional and no new flag and is not a marketplace verb-with-name only needs the
`TOP_LEVEL_SUBCOMMANDS` tuple entry (already counted under router). A command
with a `<plugin>@<marketplace>` positional must add a `PluginRefMode` +
`pluginRefBranchConfig` arm (`provider.ts:174`–`245`); a marketplace verb with a
name positional must be added to `MARKETPLACE_VERBS_WITH_NAME_ARG`
(`provider.ts:60`–`67`); a command with a new flag must extend `flagCompletions`
(`provider.ts:85`–`126`).

#### Central, conditional on NEW grammar (worst offenders)

A new **status token** (e.g. a hypothetical `"archived"`) forces edits in all of:

| Construct in `notify.ts` | Edit | Evidence |
| ------------------------ | ---- | -------- |
| `PLUGIN_STATUSES` `as const` tuple | add literal | `notify.ts:450`–`467` |
| `STATUS_TOKENS` `as const` tuple (if it is a render token) | add literal | `notify.ts:275`–`298` |
| per-variant `interface Plugin*Message` | add a new interface | e.g. `notify.ts:590`, `:654`, `:794` |
| `PluginNotificationMessage` union | add the union member | `notify.ts:844`–`860` |
| `renderPluginRow` switch | add a render arm (icon + label) | `notify.ts:1798`–`1977` (arms at `:1809`, `:1957`) |
| `computeSeverity` / `cascadeSeverity` | add an arm IF the token affects severity | `notify.ts:2084`–`2123`, `:2134` |
| `shouldEmitReloadHint` | add to the trigger set IF state-changing | `notify.ts:2386`–`2437` (trigger list `:2424`–`2430`) |

Plus, OUTSIDE `notify.ts`:

| File | Edit | Evidence |
| ---- | ---- | -------- |
| `tests/architecture/notify-types.test.ts` — tuple length-lock | bump the `extends N` literal + add the `_V<Variant>` alias + per-field `@ts-expect-error` blocks | `notify-types.test.ts:145` (PLUGIN_STATUSES len 16), `:159` (STATUS_TOKENS len 22), `:174`–`196` (bidirectional value set), `:84`–`114` (per-variant aliases) |
| `docs/output-catalog.md` — Status token reference table | add a row | `docs/output-catalog.md:129`–`146` (plugin), `:150`–`158` (marketplace) |
| `docs/output-catalog.md` — the command's H2 section | add a `<!-- catalog-state: STATE -->` + fenced expected block | per-command H2 list at `docs/output-catalog.md:162`–`1840` |
| `tests/architecture/catalog-uat.test.ts` — FIXTURES map | add a `(section, state)` fixture | `catalog-uat.test.ts:246` onward (e.g. install section `:537`) |

A new **reason** (e.g. extending `REASONS`) forces:

| Construct | Edit | Evidence |
| --------- | ---- | -------- |
| `REASONS` `as const` tuple | add literal | `notify.ts:72`–`113` |
| `BENIGN_REASONS` set | add IF the reason is an idempotent no-op (affects severity) | `notify.ts:140`–`147` |
| `notify-types.test.ts` — `_Assert_ReasonsLen` | bump `extends 32` | `notify-types.test.ts:920` |
| `docs/output-catalog.md` + `catalog-uat.test.ts` | document + fixture any state that emits the reason | as above |

### A.3 Concrete counts

- **New command, NO new grammar** (reuses existing statuses/reasons; takes a
  positional with existing completion shape): touches **5 central files** —
  `edge/router.ts` (3 constructs: interface field, tuple, switch+usage),
  `edge/register.ts`, `edge/completions/provider.ts`, `docs/output-catalog.md`
  (new H2 section), `tests/architecture/catalog-uat.test.ts` (new fixtures). Plus
  ~2 vertical files. (If the command takes no positional and no new flag,
  `provider.ts` drops out → 4 central files.)

- **New command WITH one new status token + one new reason**: touches **9–11
  central files/edit-sites** — the 5 above, plus inside `notify.ts` six distinct
  constructs (tuple, interface, union, render arm, severity arm, reload arm) and
  the `REASONS`/`BENIGN_REASONS` edits, plus the `notify-types.test.ts`
  length-locks and the catalog status-token reference table. `notify.ts` alone
  accounts for 6 of those edit sites.

### A.4 Two end-to-end traces (verified)

**Plugin command — `install`:**

1. Edge handler `makeInstallHandler` (`edge/handlers/plugin/install.ts:39`)
   parses args, calls `installPlugin` (`:78`). Errors route through
   `notifyUsageError` (`:59`, `:71`) imported from `shared/notify.ts:24`.
2. Wired in `edge/register.ts:80` (`install: makeInstallHandler(pi)`).
3. Routed in `edge/router.ts:147` (`case "install"`), interface field
   `edge/router.ts:28`, tuple `edge/router.ts:60`, usage `edge/router.ts:90`.
4. Completion branch: `pluginRefBranchConfig` `"install"` arm
   (`edge/completions/provider.ts:194`); `--map-model` flag added to
   `flagCompletions` (`provider.ts:109`–`117`).
5. Orchestrator `installPlugin` (`orchestrators/plugin/install.ts:875`)
   constructs `PluginInstalledMessage` / `PluginFailedMessage` payloads inline
   (e.g. the success `status: "installed"` row carries `dependencies` derived
   from staged content per the doc-comment `install.ts:183`–`193`; the failure
   `notify(...)` call at `install.ts:1128`, the `marketplace-not-added` call at
   `:1194`, the invalid-config row at `:1168`). It imports `notify` from
   `shared/notify.ts:116`. The status literal `"installed"` is type-checked
   against `PluginInstalledMessage` (`notify.ts:590`); the renderer arm is
   `notify.ts:1809`.
6. Catalog: `docs/output-catalog.md:322` H2 section + states; fixtures at
   `catalog-uat.test.ts:537`.

The orchestrator declares its grammar **inline as message-literal `status` /
`reasons` fields**, type-checked against the central union — it does NOT import
or extend any tuple. The grammar (icon, label, severity, reload-trigger) lives
entirely in `notify.ts`.

**Marketplace command — `marketplace add`:**

1. Edge handler `makeAddHandler` (`edge/handlers/marketplace/add.ts:25`) →
   `openMarketplaceCommand` (`:30`) → `addMarketplace` (`:38`).
2. Wired in `edge/register.ts:90` (`marketplaceAdd: makeAddHandler(pi, deps)`).
3. Routed in `edge/router.ts:191` (`case "add"`), interface field
   `edge/router.ts:42`, tuple `edge/router.ts:76`, usage `edge/router.ts:104`.
4. Completion branch: `add` is **excluded** from
   `MARKETPLACE_VERBS_WITH_NAME_ARG` (`provider.ts:60`–`67`; free-form source),
   so no name-completion edit — only the `MARKETPLACE_SUBCOMMANDS` tuple entry
   (already in router count) feeds `marketplaceSubcommandCompletions`
   (`provider.ts:132`).
5. Orchestrator `addMarketplace` (`orchestrators/marketplace/add.ts:489`)
   constructs `MarketplaceNotificationMessage` payloads inline: success
   `status: "added"` (`add.ts:557`–`566`), failure `status: "failed"` +
   `reasons: [reason]` (`add.ts:469`–`480`). The `classifyAddError` map
   (`add.ts:227`–`271`) returns closed-set `ContentReason` values
   (`"duplicate name"`, `"stale clone"`, etc.) imported from
   `shared/notify.ts:83`. Status literal `"added"` type-checks against `MpAdded`
   (`notify.ts:880`); renderer arm `notify.ts:1464`.
6. Catalog: `docs/output-catalog.md:900` H2 + the five ATTR-07 failure states
   (`add-duplicate-name`, etc. at `catalog-uat.test.ts:1427`–`1505`).

Both traces confirm the structural pattern: **the vertical slice declares
*which* status/reason it emits (via the message literal), but the grammar
*definitions* (the closed tuples, the renderer arms, the ladders) are all
central in `notify.ts`, and the user-contract surface (catalog + UAT fixtures)
is central in two more files.**

---

## Part B — Central coupling inventory

For each construct: **STAY** (genuinely cross-cutting), **LOCALIZE** (should
travel with a command), or **DELETE** (vanishes under caller-stamped
severity/reload).

### B.1 Closed `as const` tuples

| Construct | Location | Classification | Notes |
| --------- | -------- | -------------- | ----- |
| `REASONS` (32 entries) | `notify.ts:72`–`113` | LOCALIZE (union of per-command contributions) | Members are command-specific (`"duplicate name"` is add-only, `"orphan rewake"` is install-only, `"not installed"` is uninstall-only). Each belongs with its command. |
| `BENIGN_REASONS` | `notify.ts:140`–`156` | DELETE | Content-derived severity input. Under caller-stamped `severity`, the caller decides benign-vs-actionable; `allBenign` (`:156`) and the whole BENIGN set disappear. |
| `STATUS_TOKENS` (22) | `notify.ts:275`–`298` | LOCALIZE | Documentation/reference tuple; only consumed by `notify-types.test.ts:58`. Per-command tokens. |
| `PLUGIN_STATUSES` (16) | `notify.ts:450`–`467` | LOCALIZE | The discriminator set; each status is a single command's transition token. |
| `MARKETPLACE_STATUSES` (9) | `notify.ts:479`–`489` | LOCALIZE | Same. |
| `MARKERS` (`autoupdate` / `no autoupdate`) | `notify.ts:309` | STAY-ish / LOCALIZE to the autoupdate concern | Only autoupdate command + list surface use it; could localize to a marketplace-flags concern-module. Only consumed by tests today. |
| `DEPENDENCIES` (`agents`/`mcp`) | `notify.ts:498` | STAY (soft-dep concern-module) | Genuinely cross-cutting: drives `composeReasons` soft-dep injection for every install/update/reinstall row. Belongs in a soft-dep concern-module, not the monolith. |
| `PATTERN_CLASSES` (12) | `notify.ts:324`–`337` | DELETE-or-STAY (doc-only) | Not emitted; "exists so the style-guide body and catalog can reference labels" (`:317`–`323`). Pure documentation. Removable or relocate to docs. |

### B.2 Discriminated unions

| Construct | Location | Classification |
| --------- | -------- | -------------- |
| `PluginNotificationMessage` (16 arms) | `notify.ts:844`–`860`; per-variant interfaces `:590`–`834` | LOCALIZE — each `Plugin*Message` interface + its union membership should be declared with the owning command and unioned by a registry. |
| `MarketplaceNotificationMessage` (10 arms) | `notify.ts:975`–`985`; `MpCommon` + arms `:873`–`964` | LOCALIZE — same. |
| `NotificationMessage` (top-level, 8 arms) | `notify.ts:1260`–`1268` | STAY (the envelope) — the top-level union of *kinds* is the dispatch contract; it can be a registry union but the envelope itself is central. |
| `StandaloneKind` + `isInfoKind` | `notify.ts:1283`–`1311` | STAY — the standalone-vs-cascade routing predicate is genuinely cross-cutting dispatch. |
| `PluginInfoRow` (`componentsResolved` arms) | `notify.ts:1085`–`1146` | LOCALIZE to the `info` command vertical. |

### B.3 Renderer dispatch (per-status switch arms)

| Construct | Location | Classification |
| --------- | -------- | -------------- |
| `renderMpHeader` switch (10 arms) | `notify.ts:1462`–`1566` | LOCALIZE — each arm (icon + label grammar) is one command's presentation; should travel with the status declaration. |
| `renderPluginRow` switch (16 arms) | `notify.ts:1798`–`1977` | LOCALIZE — same; the icon constants `ICON_*` (`:1323`–`1336`) are the shared presentation vocabulary that STAYS. |
| `pluginRow` helper (folds 4 arms) | `notify.ts:1776`–`1796` | STAY (shared row-composition primitive). |
| `composeReasons` | `notify.ts:1706`–`1727` | STAY (shared reason+soft-dep brace composer). |
| info renderers (`renderMarketplaceInfo` `:2585`, `renderPluginInfo` `:2826`, the two cascade renderers) | `notify.ts:2585`–`2870` | LOCALIZE to the `info` vertical. |
| `dispatchInfoMessage` switch | `notify.ts:2935`–`2980` | STAY (dispatch) but its arms reference localizable renderers. |

### B.4 Severity / summary / reload ladders (the spine being replaced)

| Construct | Location | Classification under caller-stamped spine |
| --------- | -------- | ----------------------------------------- |
| `cascadeSeverity` (4-arm content ladder) | `notify.ts:2084`–`2123` | DELETE the content-derivation; **relocate** to a `max-reduce over row.severity`. The brief's "dumb reducer" replaces this with `rows.reduce(maxSeverity)`. |
| `reconcileAppliedSeverity` | `notify.ts:2130`–`2132` | DELETE (delegates to `cascadeSeverity`). |
| `computeSeverity` (info-kind + cascade dispatch) | `notify.ts:2134`–`2174` | PARTIALLY STAYS — the standalone-kind branch (`:2153`) still needs a per-kind severity, but the cascade branch becomes the max-reduce. The hard-coded `marketplace-not-added → error` / `plugin-info failed → error` (`:2154`–`2157`) become caller-stamped `severity` on those rows. |
| `BENIGN_REASONS` / `allBenign` | `notify.ts:140`–`158` | DELETE — content→severity mapping gone. |
| `buildSummaryLine` + `buildSummaryLineForCascade` | `notify.ts:2304`–`2354`, `:2251`–`2271` | STAYS as a reducer over caller-stamped facts — but the **counting** of which rows are "failed"/"skipped" (`countFailedRows` `:2202`, `countSkippedRows` `:2229`) changes from status-token matching to `row.severity` tallying. The brief says notify "tallies rows by severity." |
| `operationPhrase` | `notify.ts:2277` | STAY (pure pluralization). |
| `count*Operations` / `count*Rows` | `notify.ts:2192`–`2244` | RELOCATE/REWRITE to tally by `row.severity` instead of `p.status === "failed"`. |
| `shouldEmitReloadHint` | `notify.ts:2386`–`2437` | DELETE the status-token→reload mapping (the trigger list at `:2424`–`2430` and the `disable-cascade` straddle at `:2421`); **replace** with OR-reduce over caller-stamped `row.needsReload`. The `isInfoKind` short-circuit (`:2394`) stays as routing but the per-token logic vanishes. |
| `RELOAD_HINT_TRAILER` literal | `notify.ts:2030` | STAY (the trailer string itself). |

### B.5 Cross-cutting concerns embedded in the monolith

| Concern | Location in `notify.ts` | Modularized today? | Should be |
| ------- | ----------------------- | ------------------ | --------- |
| Hooks summary rendering (`appendHooksBlock`, `COMPONENT_KINDS`) | `notify.ts:2702`–`2774` | NO — embedded in the monolith | A hooks concern-module that contributes the `hooks:` block to the info renderer. `HookSummaryEntry` types already live at `notify.ts:198`–`221` for an import-fence reason (`shared/`→`domain/` fence, `:160`–`196`). |
| Soft-dep marker injection (`SOFT_DEP_MARKER_AGENTS/MCP`, `composeReasons` soft-dep branch, `softDepStatus` probe) | `notify.ts:1582`–`1583`, `:1714`–`1720` | NO — embedded | A soft-dep concern-module owning `DEPENDENCIES`, the markers, and the probe-to-marker mapping; the central composer pulls from it. |
| Path redaction (`redactAbsolutePaths`) | `notify.ts:244`–`255` | partially (single function) | STAY (genuinely cross-cutting security primitive). |

---

## Part C — Localization proposal (validated against the two constraints)

### C.1 The shape

Each command vertical declares an `as const` grammar contribution co-located
with its orchestrator, e.g.:

```ts
// orchestrators/plugin/install.grammar.ts (illustrative)
export const INSTALL_GRAMMAR = {
  statuses: ["installed"],          // as const
  reasons: ["orphan rewake"],       // as const, install-owned reasons
  render: { installed: renderInstalledRow },
} as const;
```

A central registry imports each contribution and unions them:

```ts
const CONTRIBUTIONS = [INSTALL_GRAMMAR, UNINSTALL_GRAMMAR, ...] as const;
type PluginStatus = (typeof CONTRIBUTIONS)[number]["statuses"][number];
```

### C.2 Does "union of registered consts" type-check? (TypeScript mechanics)

**For the status-token set and reason set: YES, cleanly.** Indexed access over a
`readonly` tuple-of-tuples
(`(typeof CONTRIBUTIONS)[number]["statuses"][number]`) distributes to the exact
union of all literals. This is the same `(typeof X)[number]` idiom already used
16 times in `notify.ts` (`:115`, `:300`, `:505`, etc.), just one level deeper.
The bidirectional set-equality proofs in `notify-types.test.ts:127`–`196` would
be rewritten to assert `PluginStatus extends <union-of-contributions>` and back
— still compile-time, no runtime degradation. **The length-locks
(`notify-types.test.ts:145`, `:159`, `:920`) become unnecessary or trivially
recomputed**, since the registry tuple is the single source.

**Where it strains:**

1. **Discriminated-union narrowing.** `PluginNotificationMessage` is a union of
   *named interfaces* (`notify.ts:844`), and the renderer narrows on `p.status`
   with per-arm field access (`p.dependencies`, `p.from`/`p.to`, `p.reasons`).
   A union built by `(typeof CONTRIBUTIONS)[number]["messageType"]` works **only
   if each contribution exports a real `interface`/`type`**, not an inferred
   value type — you cannot infer `readonly Dependency[]` field requiredness from
   an `as const` value. So the *message interfaces* must stay nominal `type`
   declarations (they can live in the command module), and the registry unions
   the *types*, not values. This is fine but means two parallel registries: a
   value registry (tuples + render fns) and a type registry (union of message
   interfaces). They must be kept in lockstep — a `satisfies` assertion can pin
   the value tuple to `keyof`/`["status"]` of the type union, preserving a
   compile-time drift gate equivalent to today's bidirectional proof.

2. **The renderer arm exhaustiveness.** Today `renderPluginRow`'s `assertNever`
   default (`notify.ts:1973`) is the compile-time gate that every status has a
   render arm. A registry of render functions
   (`Record<string, RenderFn>`) **loses** this — a missing arm becomes a runtime
   `undefined`, not a compile error. To preserve it, the render table must be
   typed `Record<PluginStatus, RenderFn>` (a *mapped* type over the
   registry-derived union). A mapped `Record<Union, Fn>` IS exhaustive at
   compile time: omitting a key is TS2741. **This is the one construct where the
   localized form must be deliberately typed as a total `Record` to keep the
   `assertNever`-equivalent guarantee** — a plain `switch` relocated into a
   command module cannot see sibling commands' statuses, so the central
   `Record<PluginStatus, RenderFn>` is the exhaustiveness anchor and stays
   central (it just delegates to per-command render fns).

3. **Field-presence invariants** (`reasons` required only on 5 variants,
   `dependencies` required only on 3, etc., enforced by the ~80
   `@ts-expect-error` blocks in `notify-types.test.ts:355`–`839`). These are
   per-interface and travel WITH the interface to the command module; they
   remain compile-time. No regression — just relocation of the test assertions.

**Verdict on exhaustiveness:** preservable, *with the caveat* that (a) message
shapes stay as nominal types (not inferred from `as const`), and (b) the
per-status render dispatch must be a total `Record<Status, RenderFn>` mapped
type rather than a switch, to keep the missing-arm-is-a-compile-error property.

### C.3 Catalog byte-stability (the harder constraint)

`tests/architecture/catalog-uat.test.ts` reads `docs/output-catalog.md`, extracts
each `(H2 section, catalog-state)` fenced block (`catalog-uat.test.ts:74`–`151`),
pairs it with a **hand-authored `NotificationMessage` fixture** in the central
`FIXTURES` map (`:246` onward), and byte-compares against `notify()`
(`:36`–`45`). The catalog markdown is **hand-maintained**: the per-command H2
sections (`output-catalog.md:162`–`1840`) AND the central "Status token
reference" table (`output-catalog.md:127`–`158`) are written by hand and
documented as deriving their *closed-set membership* from `notify.ts::REASONS` /
`PluginStatus` (`output-catalog.md:60`, `:148`) — but that derivation is by
convention, not generated.

**Implication for localization:** moving grammar declarations into command
modules does **not** relocate the catalog. Two things break the open-closed goal:

- The central "Status token reference" table (`output-catalog.md:129`–`158`)
  still needs a manual row per new token unless it is **generated** from the
  registry. This is a documentation aggregation that a build step could emit
  from `CONTRIBUTIONS`.
- The central `FIXTURES` map (`catalog-uat.test.ts:246`) still needs a manual
  entry per new `(section, state)`. The fixtures are pure `NotificationMessage`
  data, so they *could* be co-located with the command and aggregated by the
  test runner — but the byte-exact expected blocks live in the markdown, which
  the parser walks centrally.

**To keep byte-stability AND open-closed:** the catalog needs a
generation/aggregation seam. Two viable shapes: (i) each command module exports
its catalog fixtures + expected blocks; the catalog markdown's per-command
section is *generated* from those (the UAT then compares generated-vs-committed
or just renders fixtures directly, dropping the markdown round-trip for new
commands); or (ii) keep the markdown hand-authored but aggregate `FIXTURES` from
per-command exports so only the markdown (one file) needs a manual section. Both
preserve the byte contract; neither makes the catalog *zero-touch*. **The
catalog is therefore irreducibly a central artifact that needs ONE edit per new
rendered state** (either a generated section it derives, or a hand-written
section) — see Part D.

### C.4 What genuinely must stay central

- The top-level `NotificationMessage` envelope + `notify()` dispatcher
  (`notify.ts:2987`–`3035`) and `emitWithSummary` seam (`:2919`).
- `isInfoKind` standalone-vs-cascade routing (`notify.ts:1299`).
- The shared presentation vocabulary: `ICON_*` constants (`notify.ts:1323`),
  `joinTokens`/`renderScopeBracket`/`renderVersion`/`composeVersionArrow`
  (`:1590`–`1706`), `composeReasons` (`:1706`).
- The reducer spine (`notify` as max-severity / OR-needsReload / tally) — by
  design.
- The `Record<Status, RenderFn>` exhaustiveness anchor (C.2 caveat 2).
- The soft-dep + hooks concern-modules (cross-cutting), pulled from by the
  central composer.

### C.5 Measurable target

A new command should touch:

1. `edge/router.ts` registration (interface field + tuple + switch + usage) —
   **irreducible** routing.
2. `edge/register.ts` one wiring line — **irreducible**.
3. ONE catalog section (generated-from or hand-written) — **irreducible** byte
   contract.

= **3 central files**, down from **5** (no new grammar) and **9–11** (new
grammar). The `notify.ts` 6-construct edit and the `notify-types.test.ts`
length-lock edits collapse to **zero central edits** (they move into the command
module's grammar declaration + co-located type test), and `completions/provider.ts`
becomes a registry-driven dispatch (one contribution field) rather than a
hand-edited branch — though see Part D for why it is only *partially* reducible.

---

## Part D — Risks / open questions

1. **The completion provider is only partially reducible.** `provider.ts`
   dispatches on positional shape (`pluginRefBranchConfig` `:189`, the
   marketplace-verb set `:60`, the flag list `:85`). A registry could supply a
   per-command "completion contribution" (positional kind + flags), but the
   *dispatch logic* (TC-1..TC-6 priority, `:255`–`312`) is genuinely
   cross-cutting and stays central. Realistic target: a command adds a
   declarative completion descriptor, not a code branch — but the descriptor
   schema must cover every shape `provider.ts` currently special-cases (free-form
   source for `add`, `allowMarketplaceOnly` for update/reinstall, the `info`
   union-across-scopes mode). Some commands will still need bespoke logic.

2. **The router usage strings are hand-aggregated.** `TOP_LEVEL_USAGE` /
   `MARKETPLACE_USAGE` (`router.ts:87`–`110`) are monolithic multi-line strings.
   A registry of per-command usage lines could build these, but the ordering and
   the top-level-vs-marketplace split are central composition. This is a small,
   genuinely-central aggregation.

3. **Catalog cannot be fully zero-touch (the hard blocker).** As shown in C.3,
   the byte-exact user contract lives in a central markdown + a central fixture
   map. Open-closed for the *catalog* requires a generation step; without it the
   catalog remains a central file edited once per new rendered state. This is the
   single biggest obstacle to the "touch only the vertical slice" ideal, and the
   milestone must decide whether to invest in catalog generation or accept ONE
   central catalog edit per command as the floor.

4. **Two parallel registries (value + type) risk drift.** C.2 caveat 1 requires a
   value registry (tuples/render fns) and a type registry (message interfaces)
   kept in lockstep via `satisfies`. This is a new invariant to gate; if the
   `satisfies` pin is dropped, drift becomes silent. The current monolith avoids
   this by co-locating tuple and interface; splitting them reintroduces a
   coupling that must be test-gated (replacing the existing bidirectional proofs
   at `notify-types.test.ts:127`–`215`).

5. **Caller-stamped severity/needsReload moves invariants out of the type system
   into the callers.** Today `computeSeverity` (`notify.ts:2134`) and
   `shouldEmitReloadHint` (`:2386`) derive these *structurally* from the closed
   status set — a single audited site. Once each orchestrator stamps its own
   `severity` + `needsReload` per row, correctness is distributed across ~18
   call sites (e.g. the install failure routing at `install.ts:1069`–`1141`,
   the add failure at `add.ts:442`–`481`). There is no compile-time guarantee
   that a caller stamps the *right* severity; the structural ladder's
   first-match poisoning correctness (D-28-09, `notify.ts:2051`) becomes a
   per-caller responsibility. This is a deliberate trade (caller owns intent) but
   it relocates a class of correctness from one reducer to many producers — the
   catalog UAT remains the only end-to-end gate that the stamped values render
   correctly.

6. **`disable-cascade` straddle.** The one place where the same status
   (`disabled`) means different reload behavior depending on cascade kind
   (`notify.ts:2417`–`2430`, kind `disable-cascade` vs list/info) is exactly the
   case caller-stamped `needsReload` *cleans up*: the disable orchestrator stamps
   `needsReload: true` on its rows, the list orchestrator stamps `false`. This is
   a genuine win for the new spine and should be called out as motivation, not
   risk — it removes the structural `disable-cascade` kind entirely.
