# Feature Research

**Domain:** Machine-readable (JSON) presentation strategy for the `/claude:plugin` command surface of a Pi extension, selected by `ctx.mode` and carried over `pi.appendEntry`
**Milestone:** json-output (Mode-Keyed Presentation Strategies)
**Researched:** 2026-09-28
**Confidence:** HIGH for the upstream contract and the Pi transport (both read from primary artifacts); MEDIUM for the per-verb payload mapping (derived from the types and the catalog, not from a built prototype); LOW for the general CLI prior art beyond what was probed locally.

## Scope of this file

This file covers only the new JSON strategy: what a payload must carry, the contract rules around it, and what to leave out. The locked decisions D1-D8 are inputs and are not revisited here. Where a finding creates tension with a locked decision, it goes under "Open questions" at the end, not into a recommendation.

## Prior art (evidence)

### Claude Code `claude plugin ... --json` (the upstream contract)

Evidence: the installed binary `claude` 2.1.283 (strings grepped on 2026-09-28) and `https://code.claude.com/docs/en/plugins/cli-reference.md` (fetched 2026-09-28). The binary and the docs agree. Confidence HIGH.

- **Where it lives.** `--json` exists only on the shell CLI: `plugin list`, `plugin marketplace list`, `plugin install`, `uninstall`, `update`, `enable`, `disable`, `validate`, and `eval`. The in-session `/plugin` slash command has no JSON form. This confirms D3: no parity gap exists.
- **Mutating verbs print one result object.** For `install`/`uninstall`/`update`/`enable`/`disable`, the last stdout line is one JSON object with three fields that are always present: `command` (the subcommand), `outcome` (`"ok" | "failed"`), and `message` (the human-readable result). Other fields appear only when they apply: `plugin`, `pluginId` (`name@marketplace`), `scope`, `failureCode`, `alreadyInGoalState`, `installedScope`, `reverseDependents`, `shownCommand`, `installedVersion`/`availableVersion` (install), `keptData`/`savedKept` (uninstall), and `updateOutcome`/`oldVersion`/`newVersion`/`skipReason`/`blockedBy`/`refreshFailed` (update). The exit code is unchanged: 0 or 1.
- **Typed failure codes.** `failureCode` is snake_case: `op_failed`, `already_in_goal_state`, `settings_still_on`, `command_source_declined`, `entry_helper_unconfirmed`, `error_<category>`, and `claudeai_<code>`. For "already enabled", upstream exits 1 but sets `alreadyInGoalState: true` "so a script can treat that case as success". This is an ad-hoc tri-state layered on top of a binary outcome.
- **Usage errors print no result line.** They print only the reason on stderr and exit 1.
- **`plugin list --json`** prints a bare array. It has no envelope and no version field. Each object has `id`, `version` (`"unknown"` fallback), `scope`, `enabled`, and `installPath` (an absolute path). It may also have `installedAt`, `lastUpdated`, `projectPath`, `mcpServers`, `errors[]`, `notes[]`, `errorDetails[]`, and `noteDetails[]`. With `--available` the output becomes `{installed: [...], available: [{pluginId, name, marketplaceName, source, description?, version?, installCount?}]}`. That is a shape change keyed on a flag. The output is pretty-printed with `JSON.stringify(x, null, 2)`.
- **`plugin marketplace list --json`** prints an array of `{name, source, repo|url|path, ref?, installLocation}`, sorted.
- **No schema version anywhere.** Fields are gated by "Requires Claude Code v2.1.268 or later" notes in the docs instead.

Takeaways: (a) upstream always pairs structured fields with a human `message`; (b) failures carry a machine code; (c) upstream leaks absolute paths (`installPath`, `projectPath`) and ships no version field, and we should not copy either; (d) a one-bit `ok|failed` is too coarse, which is why upstream had to add `alreadyInGoalState`. Our existing tri-state severity already covers that case.

### Pi transport (what the consumer actually receives)

Evidence: pinned `@earendil-works/pi-coding-agent` 0.86.1 source, read 2026-09-28. Confidence HIGH.

- `pi.appendEntry(customType, data)` calls `sessionManager.appendCustomEntry`. The entry is `{type: "custom", customType, data, id, parentId, timestamp}`, followed by `_emit({type: "entry_appended", entry})` (`dist/core/agent-session.js:2131-2137`, `dist/core/session-manager.js:855-866`). The Pi envelope therefore already supplies `id` and an ISO `timestamp`, so the payload should not duplicate them.
- In RPC, every session event is forwarded with `output(toJsonEvent(event))` (`dist/modes/rpc/rpc-mode.js:265`). An extension slash command runs inside `session.prompt()`, and `preflightResult(true)` fires only after `command.handler` returns (`agent-session.js:944-949`). As a result, the RPC `{type: "response", command: "prompt", success: true}` for a `/claude:plugin` prompt arrives **after** every `entry_appended` event that the command produced. That response is the natural end-of-command marker. `success: true` means only that the command ran. It says nothing about the outcome.
- A handler that throws is routed to `emitError` and then to an `extension_error` frame in RPC. This is a separate channel. NFR-2 already forbids handler throws.
- Custom entries are **persisted to the session file**. Pi can share that file (`modes/interactive/session-share.js`, via Radius or a private gist) and export it to HTML. A JSON payload is therefore more durable and more shareable than today's ephemeral `ctx.ui.notify` string. This matters for NFR-9 (paths) and for payload size.
- **Today, RPC clients receive text.** RPC's `ui.notify` forwards `{type: "extension_ui_request", method: "notify", message, notifyType}` (`rpc-mode.js:87-95`). Under D3, RPC switches to JSON-only, so an existing RPC frontend that shows notify strings will stop showing `/claude:plugin` output. This is a consequence of a locked decision. See "Open questions".

### Other CLIs (general conventions)

- **npm** (11.19.1, probed locally): `npm view <missing> --json` writes `{"error": {"code": "E404", "summary": "...", "detail": "..."}}` to stdout, human text to stderr, and exits 1. This is prior art for a typed error object inside the JSON channel, with a code plus a human summary. HIGH (observed).
- **gh** (2.97.0, probed locally): `--json field,field` selects fields explicitly. An unknown field is a usage error that lists the available fields. `--jq` and `--template` post-process the output. Field selection is a client-side convenience, and there is no version field. HIGH (observed).
- **Terraform** (`terraform show -json`, machine-readable UI): `format_version` is `"major.minor"`. A minor bump is additive, and consumers "ignore any object properties with unrecognized names". A major bump is breaking, and consumers "reject any input which reports an unsupported major version". The streamed UI frames carry `@level` (severity), `@message` (human summary), and a `type` discriminant. Clients facing an unknown `type` should present at least `@message`. This is the closest analogue to our case (a streamed, typed, severity-bearing event log), and it states the versioning policy outright. LOW per the confidence seam (web source), though it is vendor documentation.
- **kubectl `-o json`**: every object carries `apiVersion` and `kind`, and lists are `{kind: "List", items: [...]}`. Errors are text on stderr, not JSON. LOW (from training, not re-verified).

### Competitor: `@nklisch/pi-plugins` control channel

Source: `docs/competitive-analysis/pi-plugins.md` (code read at commit `175142c`). They emit `pi.appendEntry` frames in rpc/json modes and a zod discriminated union of `accepted`/`progress`/`result` frames with strict ordering. The grammar is versioned as `plugin-control/v1`. It also has an 11-code exit-code vocabulary, `--cursor`/`--limit` pagination, and an `--output human|json` flag. Appendix D of that document records our decision to adopt only `ctx.mode` and `appendEntry` and to invent no pagination, exit codes, or bespoke status grammar. MRO-01 (`.planning/BACKLOG.md:1051`) tracks the adopted part.

## Feature Landscape

### Table Stakes (Users Expect These)

A consumer (a script using `pi --mode json`, or an RPC client) cannot use the output reliably without these.

| Feature | Why Expected | Complexity | Notes / dependencies on existing code |
|---------|--------------|------------|----------------------------------------|
| **TS-1 Payload envelope with `schemaVersion`** | Every mature JSON surface versions its output (Terraform `format_version`, kubectl `apiVersion`, competitor `plugin-control/v1`). Upstream's lack of a version is the counter-example: it has to gate fields with "requires v2.1.268" prose. | LOW | `customType: "claude-plugin"` is the namespace (D4). Put `schemaVersion: 1` (integer) at the top of `data`. Do not add a `timestamp`/`id`: the Pi envelope already has both. typebox `Type.Literal(1)`. |
| **TS-2 Compatibility policy, written down** | Consumers need to know what a version bump means. Without a policy, every additive change is a potential break. | LOW | Recommended policy: integer major version. Additive changes do **not** bump it: a new optional field, a new payload `kind`, or a new member in a closed set (`Reason`, `StatusToken`). Removing, renaming, changing a type, or changing meaning bumps it. Consumers must ignore unknown fields and must treat unknown enum members as opaque, falling back to `severity`. The project amends closed sets often (`Reason` has 46 members today), so bumping on every amendment would churn. Put the policy in the schema reference doc. |
| **TS-3 One discriminated union keyed by `kind`** | Consumers switch on one field. Terraform uses `type`, and our model already uses `kind`. | MEDIUM | Map 1:1 from `NotificationMessage` (`cascade`, `marketplace-info`, `plugin-info`, `marketplace-info-cascade`, `plugin-info-cascade`, `marketplace-not-added`, `reconcile-pending-empty`, `reconcile-applied-cascade`). Add the D2 raw surfaces as kinds: `usage-error`, `usage-info`, `diagnostic`, `device-flow-prompt`, `hook-rewake-summary`, `stop-hook-override-cap`. The legacy `kind: undefined` cascade must serialize as an explicit `"cascade"`. Depends on the D1 model. |
| **TS-4 Success signalled by `severity`, not exit code** | Pi exits 0 in print/json regardless (D5, Appendix D), and RPC's `success` only means "ran". The payload is the only outcome channel. | LOW | Reuse the closed `Severity` set (`info`/`warning`/`error`) with its tri-state meaning: info = desired state reached, warning = carried out but short, error = not carried out. Every payload carries `severity` as a **required** field, including info surfaces. Today the info kinds leave it implicit (`dispatchInfoMessage` derives it from `kind`). This is not a new "status field" (Appendix D forbids inventing one). It is the existing model field, serialized. |
| **TS-5 Per-invocation verdict rule, documented** | One command can emit several payloads. Examples: `marketplace update` emits one per target (catalog `update-all-many-alpha`/`-beta`); a device-flow prompt precedes a cascade; `import` emits a cascade plus a `diagnostic`. A consumer needs one answer per command. | LOW | Document the rule: the command's verdict is the maximum `severity` over all `claude-plugin` entries appended between sending the prompt and receiving the RPC `response`, or before process exit in `--mode json -p`. The same rule gives `needsReload` as an OR over entries. No code needed beyond the docs. |
| **TS-6 `needsReload` as a required boolean** | This is the machine form of the `/reload to pick up changes` trailer. A script that installs and then uses a plugin must know whether to reload. | LOW | This is already a model decision (`shouldEmitReloadHint`, the OR over caller-stamped `needsReload`). Serialize it at the payload level, and per row where the row carries it. It is required, never absent. |
| **TS-7 Closed-set tokens emitted verbatim as enums** | Stable enums instead of free text are the core value of JSON output. | LOW | Emit `status`, `reasons[]`, `scope`, and `severity` using the **existing** literal strings (`"partially-installed"`, `"not in manifest"`, `"requires pi-mcp"`). Do not add a parallel snake_case code vocabulary like upstream's `failureCode`: it would double the closed-set gates (`compat-01-no-expansion`, `notify-closed-set-locks`) and let the two vocabularies drift apart. Spaces in enum values are legal JSON and read fine in `jq`. The `reasons` tokens are our typed failure codes. |
| **TS-8 Reasons carry the soft-dep markers, in contract order** | `{requires pi-subagents}` tells a consumer that the install succeeded but a companion is missing. Losing it silently would misreport a degraded install. | MEDIUM | D1 moves `softDepMarkers` and the `softDepStatus(pi)` probe out of the renderer into the model, which yields a fully composed `reasons[]`: typed reasons first, then markers in the order agents, mcp, workflows (MSG-GR-4). Emit that array unchanged. Also emit `dependencies[]` on the four dependency-bearing rows, so a consumer can tell "declares agents" apart from "agents companion missing". Depends on D1 landing first. |
| **TS-9 Raw values, not display forms** | A consumer compares versions and dates by value. The text surface abbreviates for people. | LOW | `version` is the full persisted string (`hash-2ea95f85703d`, `sha-a1b2c3d4e5f6`, `1.2.3`), never `v#2ea95f8`. Emit `lastUpdatedAt` in full ISO, even though the list surface hides it (UXG-01). Emit `autoupdate` as a boolean, never the `<autoupdate>` marker text. No glyphs, no `v` prefix, no indentation. These are text-converter formatting decisions and must not reach the JSON converter. |
| **TS-10 Explicit scope on every row that has one** | The text form hides a plugin's `[scope]` when it equals the marketplace's scope (orphan-fold, D-13-18). A consumer should not have to reproduce that fold rule. | LOW | For rows that have an install scope (installed, upgradable, disabled, partially-*, and the realized transitions), always emit the resolved scope. `pluginScopeOrFallback` already exists for the LLM-tool surface, but it also stamps the marketplace scope onto `available`/`unavailable` rows, where it means "listed from", not "installed at". Keep `scope` absent there. The marketplace block's own `scope` stays required. |
| **TS-11 Failure detail serialized explicitly** | `cause?: Error` and `rollbackPartial[].cause` are how a failed row explains itself. `JSON.stringify(new Error("x"))` produces `{}`, so a naive converter silently drops every cause. | LOW-MEDIUM | Have the model precompute `causeChain: string[]` (depth 5 with a `truncated` flag, the same walk as `causeChainTrailer`, including the `CleanupContextError` basename rendering). Text joins it with `" -> "` and JSON emits the array. Per phase: `rollbackPartial: [{phase, causeChain?}]`. Redaction must match the text form byte for byte (see TS-13). |
| **TS-12 Usage errors are payloads** | Upstream prints nothing on a usage error. A JSON consumer then cannot tell a usage error from a silent success. | LOW | `{kind: "usage-error", severity: "error", message, usage}`. `usage-info` (help) is `{severity: "info", usage}`. D6's `browse` refusal outside tui uses the same channel and names `list` in `message`. About 20 files call `notifyUsageError`, but the change stays inside the dispatch owner. |
| **TS-13 No new path disclosure (NFR-9)** | Payloads persist in a shareable session file. That exposes more than an ephemeral notify string does. | LOW | Rule: no wire field may carry a path the text form would not show. Emit no `installPath`/`projectPath`/`stateJsonPath` (upstream does, and we should not). Keep the existing composition-site redaction (`redactAbsolutePaths` in reconcile, info notes, and diagnostics) as the single policy. A path-source `marketplace info` keeps `absPath`, because the text shows it and the user typed it. Pin this with a gate that lists the schema's string fields. |
| **TS-14 Array order is a contract; object key order is not** | Consumers diff outputs and assert in tests. | LOW | Marketplace blocks and rows keep model order (`compare-name-scope`: name first, project before user). `reasons[]` keeps its contract order, and multiple payloads from one invocation keep emission order. State in the docs that key order is not guaranteed. |
| **TS-15 Optional means absent, never `null`** | A single representation per state. `JSON.stringify` drops `undefined`, `exactOptionalPropertyTypes` already forbids stamping `undefined`, and typebox `Type.Optional` models it as absent. | LOW | Upstream does the same ("appear only when they apply"). Always-required fields: `schemaVersion`, `kind`, `severity`, `needsReload`, and `origin` (TS-16). Empty collections are `[]` and not absent where the model has them (for example `marketplaces: []` replaces the `(no marketplaces)` sentinel, and `plugins: []` replaces the bare header). |
| **TS-16 `origin` distinguishes command output from lifecycle output** | In `--mode json`, the load-time reconcile (`resources_discover`), hook rewake summaries, and the Stop-cap warning show up in the same event stream as command output. They are not responses to any command. | MEDIUM | `origin: {type: "command", command: "plugin install" \| "marketplace add" \| ...}`, `{type: "load"}` (reconcile, PATH refresh, reconcile-aborted), or `{type: "hook"}` (rewake, Stop cap). Use a machine command id, not the human `Messaging.label`. The id also tells `enable` apart from `install`: both render an `(installed)` row. This needs the edge router's verb threaded into the dispatch strategy, which touches `NotificationContext` (already being widened for `mode`/`appendEntry`). |
| **TS-17 Structured raw surfaces (D2), including the two missed ones** | Total coverage means every emission has a typed kind, not a string wrapped in JSON. | MEDIUM | `device-flow-prompt {verificationUri, userCode}`: `domain/github-auth.ts:436` builds the string today, so the domain must pass the two values instead. `stop-hook-override-cap {pluginId, cap: 8}`. `hook-rewake-summary {text, pluginId}` (the text is plugin-author prose, passed through). `diagnostic {header, lines[]}` (3 call sites). **Also found:** `makeRawNotifyFn` has two more callers in `index.ts` besides device flow: `reconcile aborted: <err>` (error, `index.ts:128`) and `plugin PATH not refreshed for <scope> scope ...` (warning, `index.ts:149`). D2's wording ("`makeRawNotifyFn` (device-flow code)") names only one of the three. Both need kinds, for example `reconcile-aborted {causeChain}` and `plugin-path-skipped {scope, reason}`. |
| **TS-18 Published schema reference** | Consumers need the contract without reading TypeScript. | LOW | typebox schemas already are JSON Schema. Ship a `docs/` reference (kinds, fields, versioning policy, the verdict rule, and the print-mode limitation per D5). Adding a generated schema file is optional (see D-3 below). |
| **TS-19 In-process JSON capture helper for tests** | The milestone's second motivation is structured behavioral tests. | LOW | A fake `pi.appendEntry` that records `{customType, data}` and runs `Value.Check(schema, data)` on every capture, so any test that captures also validates the schema. Fakes carry an explicit `mode` (D7). The e2e path is `pi -p --mode json --no-session --offline "/claude:plugin list"`. |

### Differentiators (Competitive Advantage)

These are not required for a usable contract, but each adds value at low cost or lines up with the Core Value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **D-1 `summary` string on warning/error payloads** | A generic client that does not know a `kind` can still show one human line. This is Terraform's "present at least `@message`" rule. It partly offsets the RPC text loss (see Open questions). Upstream always has `message`. | LOW | The model already computes the summary line (D1): "A plugin operation has failed." Emit it when present. This is model data, not a rendering of the text form, so the peer architecture holds. |
| **D-2 Numeric `tally`** | Scripts get counts without walking the tree. | LOW | `{failures, warnings, successes}`, or `{updated: n}` under the UGRM-02 update override. Present only when the model makes a tally eligible (plural cardinality with a label). Drop the English "Plugin list: 3 successes" string. |
| **D-3 Exported JSON Schema file plus a drift gate** | Consumers validate with any JSON Schema tool. It matches the project's gate culture (a test that plants the violation). | LOW-MEDIUM | Generate `schema/claude-plugin.v1.json` from the typebox objects, commit it, and test that the committed file equals the export. Include it in the npm package `files`. |
| **D-4 `id: "<name>@<marketplace>"` on plugin rows** | This is upstream's `pluginId` convention, which Claude Code users already know. It can be pasted back as a command argument. | LOW | A pure concatenation in the converter. Harmless under D1, since it is formatting, not a decision. |
| **D-5 Structured advisories** | `pending`'s retained-workflow-staging advisory is pre-rendered prose with a 4-space indent baked in (`composeRetainedWorkflowsAdvisories`). Serializing it verbatim leaks text formatting into JSON. | MEDIUM | Model it as `retainedWorkflowStaging: [{name, envelopeCount?}]`, and let the text converter compose the sentence. `PluginInfoRowBase.notes` (WR-09) can stay free-text strings, since they are already redacted sentences about files. Remove the indent in both places. This is D1-consistent work, just not on D1's named list. |
| **D-6 Explicit no-op marker on `update`** | `emitUpdateNoOpCascade` produces the "Plugin update: nothing to update" headline. Only the orchestrator's choice of emitter records that decision. | LOW | `noOp: true` on the cascade payload, or derive it as `tally.updated === 0` and document that. Either way the decision moves into the model. |
| **D-7 `invocationId` correlating the payloads of one command run** | Async hook payloads (rewake) can interleave with command output, so "contiguous entries" is not a safe grouping rule. | LOW-MEDIUM | A random id minted once per handler invocation and stamped on every command-origin payload. Tests need an injectable generator. The RPC `response` boundary (TS-5) already covers most consumers, so this is P2. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Embedding the full rendered text in the payload** (`text: "● official [user]\n  ● foo ..."`) | It looks like a free fallback for RPC clients, and upstream has `message`. | The JSON converter would have to call the text converter, which breaks D1's peer architecture. It doubles the size of every persisted entry. It invites consumers to scrape the text, which is the failure mode JSON exists to end. It also drags glyphs and catalog bytes into a second contract. | D-1 `summary` (model-computed) plus typed fields. |
| **A per-command `--json` flag** | Upstream's CLI has one. | D3: selection is by mode only, and upstream's flag is on the shell CLI, not `/plugin`. A flag creates a second selection axis and a second test matrix. | `pi --mode json` / RPC. |
| **Pagination (`--cursor`/`--limit`)** | The competitor has it, and big lists are big. | No Pi contract anchors it (Appendix D searched the pinned API). It would be bespoke grammar, and our lists are bounded by a user's marketplaces. | Existing filter flags (`--installed`, `--available`, ...). Document `--no-session` for scripted runs to avoid session bloat. |
| **Exit-code vocabulary / `outcome: ok\|failed`** | Upstream and the competitor both have one. | Pi cannot set exit codes from a command (Appendix D). A binary outcome loses the tri-state, which is why upstream had to bolt on `alreadyInGoalState`. | `severity` (TS-4) and the verdict rule (TS-5). |
| **A new snake_case `failureCode` vocabulary** | It looks more "API-like" than `"not in manifest"`. | It adds a second closed set that must be kept in sync with `Reason` forever, doubling the gates. | Emit `Reason` tokens verbatim (TS-7). |
| **Fields the text form does not show** (`installPath`, state paths, clone roots, raw manifest dumps) | Upstream's `list --json` has `installPath` and `mcpServers`. | NFR-9. Session files persist and can be shared. It widens the contract past the model. | Keep to the model's fields (TS-13). A consumer needing paths can read `state.json`. |
| **Runtime schema validation before every `appendEntry` in production** | Belt and braces. | A validation failure would have to throw or drop output, and both break NFR-2 / never-silent. It also costs time on every emit. | Compile-time `Static<typeof Schema>` in production, `Value.Check` in the test capture helper (TS-19). |
| **`null` placeholders for absent optionals** | Some consumers like a fixed shape (gh does this). | Two representations of "absent" means `exactOptionalPropertyTypes` friction and converter branches. | Absent (TS-15). |
| **ANSI, glyphs, `v#` short SHAs, `<autoupdate>` markers in JSON** | "Keep it consistent with text." | These are display decisions and are meaningless to machines. | TS-9. |
| **Streaming progress frames (`accepted`/`progress`/`result`)** | The competitor has them. | No consumer need was identified. It is bespoke grammar, and our commands are short. The device-flow prompt is the only mid-command emission, and it is already its own `kind`. | One payload per notify seam, plus the RPC response as the end marker. |
| **Duplicating Pi's entry `id`/`timestamp` inside `data`** | Self-contained payloads. | It is redundant, and it makes tests non-deterministic. | Read them from the `entry_appended` envelope. |

## Per-verb payload content

Every payload has this envelope: `{schemaVersion, kind, origin, severity, needsReload, summary?, tally?}` plus the kind body. "Rows" below means `PluginNotificationMessage` serialized by TS-7 through TS-11: `status`, `name`, `id` (D-4), `version?`, `scope?`, `description?`, `reasons[]`, `dependencies[]?`, `from`/`to` (updated), `partialHint?`, `enableHint?`, `partial?` (will install), `causeChain?`, `rollbackPartial?`, and `severity`/`needsReload` where stamped. A marketplace block is `MarketplaceNotificationMessage`: `name`, `scope`, `status?`, `details?{autoupdate, lastUpdatedAt?}`, `reasons?`, `severity?`, `plugins[]`.

| Command | Payload kind(s) | Body content beyond the envelope | Notes |
|---------|-----------------|----------------------------------|-------|
| `list` | `cascade` (plural, label "Plugin list") | `marketplaces[]` of statusless `MpList` blocks with `details`, plus inventory rows (`installed`, `upgradable`, `available`, `remote`, `unavailable`, `partially-available`, `partially-installed`, `partially-upgradable`, `disabled`) | `marketplaces: []` replaces `(no marketplaces)`. Inventory rows carry no soft-dep markers (their `dependencies` is omitted by design). `needsReload: false`. Unparseable or zero-plugin manifests show as reasons on the block. |
| `info <p>@<mp>` | `plugin-info` or `plugin-info-cascade` (both scopes); `marketplace-not-added`; failure `cascade` | `marketplaceName`, `marketplaceScope`, `marketplaceDetails`, `plugin: {status, name, version?, scope?, description?, reasons?, notes?, componentsResolved, components?{agents, commands, hooks: HookSummaryEntry[], mcp, skills, workflows}, dependencies?}` | Keep `componentsResolved: false` as a discriminant, not an absent `components`. `HookSummaryEntry` is already a structured union and passes through as-is. The `--fetch`-skipped warning (D-96-04) shows up as `severity: warning`. |
| `pending` | `cascade` (label "Reconcile pending") or `reconcile-pending-empty` | Rows: `will install`/`will uninstall`/`will enable`/`will disable` with `scope`, `partial?`; empty form: advisories (D-5) | `needsReload: false` by construction. The "0 actions" wording is text-only; the JSON consumer reads the empty kind. |
| `install` | `cascade` (single); `marketplace-not-added`; optional preceding `device-flow-prompt` | One block plus one row: `installed`, `partially-installed`, `unavailable`, `partially-available` (`partialHint`), `failed` (`causeChain`, `rollbackPartial`), or `disabled` (`enableHint`) | `marketplace-not-added {name, scope?, presentInOtherScope?}`. `dependencies` and the composed markers go on success rows. |
| `uninstall` | `cascade` (single); `marketplace-not-added` | `uninstalled` (`reasons` may be `["stale workflow command"]`), `failed`, or `skipped {not installed}` | Uninstall rows never carry soft-dep markers (MSG-SD-3). The model must keep that true. |
| `update [target]` | `cascade` (single or plural), or the no-op cascade (D-6) | `updated {from, to, dependencies}`, `skipped {up-to-date}` (benign, info), `partially-upgradable` (decline, `partialHint`), `failed`, `manual recovery`; `tally {updated}` | Emit `from`/`to` in full, not as the short-SHA arrow. |
| `reinstall` | `cascade` | `reinstalled`, `skipped`, `failed`, `unavailable`, `disabled`, with `reasons` (`stale workflow command`, degraded kinds) | Per-scope blocks stay separate (no orphan-fold in JSON anyway). |
| `fetch` | `cascade` (label "Plugin fetch") | `available`, `partially-available`, `remote`, `skipped` (no-op, FTCH-03) | Pi-only verb with no upstream analogue. |
| `enable` / `disable` | `cascade` | Enable: `installed` or `partially-installed` (`dependencies`). Disable: `disabled` (`needsReload: true`, the RLD-05 stamp). Both: `skipped {already enabled \| already disabled}` (benign) | `origin.command` is what tells enable apart from install (TS-16). Note the upstream difference: the upstream CLI exits 1 with `already_in_goal_state`, while ours reports info. The tri-state already encodes it, so no flag is needed. |
| `import` | `cascade` (plural, mixed subjects); optional `diagnostic`; optional `device-flow-prompt` | Marketplace blocks with `status` (`added`/`failed`/`skipped`) plus plugin rows; `tally` | Mixed-subject summary wording (D-03) arrives via `summary`. |
| `bootstrap` | `cascade` | One marketplace block, `added` or `updated`, with `plugins: []` | `needsReload: false` (marketplace-only). |
| `browse` | tui: none (interactive). Other modes: `usage-error` (D6) | `message` names `list` | Replaces the `list` fallback at `edge/handlers/plugin/browse.ts:140`. |
| `help` / bare | `usage-info` | `usage` (free text) | Usage text is inherently prose, so it passes through verbatim. |
| any verb, bad args | `usage-error` | `message`, `usage` | Always `severity: error`. |
| `marketplace list` | `cascade` (label "Marketplace list") | Statusless blocks with `details`, `plugins: []` | Upstream's `marketplace list --json` also carries the source. Our `MpList` does not. Deferred (see v1.x). |
| `marketplace add` | `cascade`; optional `device-flow-prompt` | Block with `status: added` or `failed` plus `reasons` (`duplicate name`, `stale clone`, `unsupported source`, `source missing`, `invalid manifest`, `authentication required`, `network unreachable`) | The device-flow prompt payload must reach the RPC client promptly, or auth waits until the flow times out. |
| `marketplace remove` | `cascade`; `marketplace-not-added` | Block `removed` or `failed` with child rows (`uninstalled`/`failed`) | Partial removal is `severity: error` with per-plugin detail. |
| `marketplace info` | `marketplace-info` or `marketplace-info-cascade`; failure forms | `name`, `scope`, `details {autoupdate, lastUpdatedAt?}`, `source` (`github {owner, repo, ref?}` / `url {url, ref?}` / `path {absPath}`), `description?` | Emit `lastUpdatedAt` for every source kind that has it. Text gates it (D-76-10), but that is display policy. Confirm that stored `url` values cannot carry userinfo credentials before persisting them to the session. |
| `marketplace update [name]` | `cascade`, **one per target**; optional `device-flow-prompt` | Blocks `updated`/`skipped {up-to-date}`/`failed`, with nested autoupdate plugin rows (`updated`, `disabled` pin-moved, `not in manifest`) | Multi-emission is a documented contract (TS-5). |
| `marketplace autoupdate` / `noautoupdate` | `cascade` | Block `autoupdate enabled`/`autoupdate disabled`/`skipped {already autoupdate \| already no autoupdate}` | Info. |
| Load (`resources_discover`) | `reconcile-applied-cascade`; `diagnostic`; `reconcile-aborted`; `plugin-path-skipped` | Mixed-subject rows including the backfill `components now supported`; post-commit warnings | `origin.type: "load"`. No reload hint, structurally. The last two kinds are the ones D2's list missed (TS-17). |
| Hooks | `hook-rewake-summary`; `stop-hook-override-cap` | `{pluginId, text}`; `{pluginId, cap: 8}` | `origin.type: "hook"`. The rewake text is untrusted plugin-author prose. Pass it through as data and never interpret it. |

## How consumers judge success

1. **Scripts (`pi --mode json -p --no-session --offline "/claude:plugin <verb> ..."`).** Parse the stdout JSONL. Keep `type == "entry_appended" && entry.customType == "claude-plugin"`. Check `entry.data.schemaVersion`: reject unknown majors, and ignore unknown fields and kinds. Verdict = max `severity` over the entries whose `origin.type == "command"`. `error` means the command did not happen, `warning` means it happened but fell short, and `info` means the desired state was reached (benign skips such as `already installed` count as info). The process exit code is always 0 and says nothing (D5). If there are zero command-origin entries, treat it as a failure: the handler threw, which should never happen under NFR-2. A `jq` one-liner in the docs would show this.
2. **RPC clients.** Same filter. The command's entries end at the `{type: "response", command: "prompt"}` for that request, whose `success: true` means only that the command ran. Surface `device-flow-prompt` to the user at once. Load/hook-origin entries can arrive at any time and belong to no request.
3. **In-process tests.** Use the capture helper (TS-19). Assert on typed fields, never on bytes (the catalog tests keep owning the text bytes).

## Feature Dependencies

```
D1 presentation model (severity, reload, tally, summary, soft-dep markers upstream of rendering)
    ├──requires──> TS-8 composed reasons with markers
    ├──requires──> TS-4 / TS-6 required severity + needsReload on every kind
    ├──requires──> TS-11 precomputed causeChain
    └──enables───> D-1 summary, D-2 numeric tally, D-5 structured advisories, D-6 no-op marker

TS-1 envelope + TS-3 kind union ──requires──> typebox wire schema
    └──enables───> TS-18 docs, D-3 exported schema + drift gate, TS-19 capture helper

TS-16 origin/command id ──requires──> router verb threaded into NotificationContext (widened for mode/appendEntry anyway)
    └──enhances──> TS-5 verdict rule, D-7 invocationId

TS-17 raw-surface kinds ──requires──> domain/github-auth.ts passes {verificationUri, userCode}, not a string
                        ──requires──> index.ts load-path raw strings get kinds

TS-12 usage-error kind ──enables──> D6 browse refusal
TS-13 no-new-paths ──conflicts──> copying upstream list --json fields (installPath, projectPath)
Embedded full text (anti) ──conflicts──> D1 peer converters
```

### Dependency Notes

- **Everything in the per-verb table requires D1 first.** Without the model refactor, the JSON converter would have to re-derive severity, markers, and hints. That is exactly the duplication D1 exists to prevent, and it would drift from the text form.
- **TS-16 and TS-17 touch call sites outside the dispatch owner.** Every other JSON feature stays inside `shared/` plus the strategy switch. These two change `edge/router.ts` threading, `domain/github-auth.ts`, and `index.ts`. Plan them explicitly.
- **TS-19 depends on TS-3's schema object existing.** Build the schema before the helper so the helper validates from day one.

## MVP Definition

### Launch With (v1: this milestone)

- [ ] TS-1, TS-2, TS-3: envelope, versioning policy, kind union. Without these there is no contract.
- [ ] TS-4, TS-5, TS-6: severity/needsReload required on every payload, plus the verdict rule. This is the only outcome channel Pi allows.
- [ ] TS-7 through TS-11, TS-14, TS-15: faithful, raw-valued, ordered, absent-not-null serialization of the model.
- [ ] TS-12, TS-17: typed usage errors and every raw surface, including `reconcile-aborted` and `plugin-path-skipped` (D2 total coverage).
- [ ] TS-13: no new path disclosure. The session file is persistent and shareable.
- [ ] TS-16: origin. Without it, load-time and hook output can't be told apart from command output in the stream.
- [ ] TS-18, TS-19: schema reference and capture helper (milestone scope: docs and test enablement).
- [ ] D-1, D-2, D-6: summary, numeric tally, no-op marker. Near-free once D1 lands, and they close obvious gaps.

### Add After Validation (v1.x)

- [ ] D-3 exported schema file plus drift gate: when the first external consumer appears.
- [ ] D-4 `id` field: when a consumer asks to pipe rows back into commands.
- [ ] D-5 structured advisories: when `pending` gains a second advisory kind, or a consumer parses one.
- [ ] Marketplace `source` on `marketplace list` rows (upstream parity for `marketplace list --json`): this needs an `MpList` model change that the text form must then ignore.

### Future Consideration (v2+)

- [ ] D-7 `invocationId`: only if async-hook interleaving proves to be a real correlation problem beyond the RPC response boundary.
- [ ] A text-bearing companion field for RPC frontends: only if the D3 consequence (below) is reopened.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| TS-1/2/3 envelope, policy, kinds | HIGH | MEDIUM | P1 |
| TS-4/5/6 severity, verdict rule, needsReload | HIGH | LOW | P1 |
| TS-7/8 verbatim enums, composed reasons | HIGH | MEDIUM (rides D1) | P1 |
| TS-9/10/14/15 raw values, scope, order, absent | HIGH | LOW | P1 |
| TS-11 cause chain | HIGH | LOW-MEDIUM | P1 |
| TS-12 usage-error kind | MEDIUM | LOW | P1 |
| TS-13 no new paths | HIGH (risk) | LOW | P1 |
| TS-16 origin/command id | HIGH | MEDIUM | P1 |
| TS-17 raw-surface kinds (6 + 2 found) | MEDIUM | MEDIUM | P1 |
| TS-18/19 docs, capture helper | HIGH (milestone goal) | LOW | P1 |
| D-1 summary / D-2 tally / D-6 no-op | MEDIUM | LOW | P1 |
| D-3 schema file + gate | MEDIUM | LOW-MEDIUM | P2 |
| D-4 `id` | LOW-MEDIUM | LOW | P2 |
| D-5 structured advisories | LOW-MEDIUM | MEDIUM | P2 |
| D-7 invocationId | LOW | LOW-MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Claude Code CLI `--json` (2.1.283) | `@nklisch/pi-plugins` | Our approach |
|---------|-------------------------------------|-----------------------|--------------|
| Selection | Per-command `--json` flag, shell only | `--output human\|json` flag, plus mode-keyed channel | `ctx.mode` only (D3) |
| Transport | stdout, last line (mutations) or whole stdout (lists) | `appendEntry` in rpc/json; stdout lines in print | `appendEntry` in json/rpc; print silent (D4/D5) |
| Versioning | None (per-field "requires vX") | `plugin-control/v1` grammar id | `schemaVersion` integer plus a written additive policy |
| Outcome | `outcome: ok\|failed` plus exit 0/1 plus `alreadyInGoalState` | 11-code exit vocabulary (in payload) | Tri-state `severity`, max over the invocation |
| Error codes | snake_case `failureCode` | Closed diagnostic reason/action vocabularies | Existing closed `Reason` tokens, verbatim |
| Human text | `message` always present | Human output mode | `summary` on warning/error only; no embedded render |
| Usage errors | No JSON line, stderr, exit 1 | Exit 2 | `usage-error` payload |
| Paths | `installPath`, `projectPath` absolute | Scrubbed provenance | Nothing beyond what text shows (NFR-9) |
| Pagination | None | `--cursor`/`--limit` | None (Appendix D) |
| Progress | None | `accepted`/`progress`/`result` frames | None; device-flow prompt is its own kind |

## Open questions (for requirements, not decided here)

1. **RPC text loss (a consequence of D3).** RPC clients receive `/claude:plugin` notify text today via `extension_ui_request`. Under D3 they will receive only `entry_appended` custom entries. A frontend that does not understand `claude-plugin` will show nothing, and the device-flow code is the dangerous case, because auth then waits until the flow times out. D3 is locked. The requirements should still name this behavior change, and the docs should say that RPC frontends must render `device-flow-prompt` at minimum. D-1 `summary` softens but does not remove the gap.
2. **D2's raw-surface list is incomplete.** `makeRawNotifyFn` has three callers (`orchestrators/auth-host.ts:112`, `index.ts:128`, `index.ts:149`), not one. The two `index.ts` load-path strings need kinds for "total coverage" to hold.
3. **`appendEntry` during `resources_discover`.** Whether the session manager accepts custom entries during extension load, before the first prompt, in `--mode json -p` and in `--no-session`, was not verified. This is for architecture or phase research to check, since load-origin payloads depend on it.
4. **Session growth.** Every RPC `list` appends a full inventory to the persisted session. Recommending `--no-session` for scripts covers one-shot use. Long-lived RPC sessions accumulate entries, and no Pi mechanism prunes custom entries.
5. **URL userinfo.** Check whether a stored `url`-source marketplace can carry `user:token@` before `marketplace info` persists it into a shareable session. The text form has the same exposure today, but it is ephemeral there.

## Sources

- Claude Code 2.1.283 binary (`/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.283/claude`), strings grepped 2026-09-28: install/uninstall/update/enable/disable `--json` result objects, `failureCode` derivation, `plugin list --json` / `--available` / `marketplace list --json` builders. HIGH.
- [Plugin commands reference](https://code.claude.com/docs/en/plugins/cli-reference.md), fetched 2026-09-28: "JSON result format", `plugin list` "JSON output" tables, exit codes. HIGH (agrees with the binary).
- `claude plugin <verb> --help` output, 2.1.283. HIGH.
- `@earendil-works/pi-coding-agent` 0.86.1 (pinned): `dist/core/agent-session.js` (appendEntry, prompt/extension command path), `dist/core/session-manager.js` / `.d.ts` (CustomEntry), `dist/modes/rpc/rpc-mode.js` (event forwarding, ui.notify forwarding, prompt response timing), `dist/core/extensions/runner.js` (no-op UI), `dist/modes/interactive/session-share.js`. HIGH.
- npm 11.19.1 and gh 2.97.0, probed locally 2026-09-28. HIGH.
- [Terraform JSON output format](https://developer.hashicorp.com/terraform/internals/json-format) and [machine-readable UI](https://developer.hashicorp.com/terraform/internals/machine-readable-ui). LOW per the confidence seam (webfetch); used only as an analogy.
- [gh formatting help](https://cli.github.com/manual/gh_help_formatting). LOW per the seam; the behavior was also observed locally.
- kubectl `-o json` conventions: training knowledge, not re-verified. LOW.
- `docs/competitive-analysis/pi-plugins.md` (control channel, exit codes, pagination, Appendix D decisions) and `.planning/BACKLOG.md` MRO-01.
- In-repo: `extensions/pi-claude-marketplace/shared/notification-types.ts`, `notification-dispatch.ts`, `notification-summary.ts`, `notify-context.ts`, `redact-absolute-paths.ts`, `errors.ts`, `edge/handlers/tools.ts`, `edge/handlers/plugin/browse.ts`, `index.ts`, `domain/github-auth.ts`, `orchestrators/*/*.messaging.ts`; `docs/output-catalog.md`; `.planning/MILESTONE-CONTEXT.md`; `docs/prd/pi-claude-marketplace-prd.md` (NFR-9).

---
*Feature research for: JSON presentation strategy for `/claude:plugin` (json-output milestone)*
*Researched: 2026-09-28*
