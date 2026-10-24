# JSON output

## Extract plugin rows

With this extension installed in Pi, run this command in Bash with `jq` available:

```bash
input_file=$(mktemp)
pi -p --mode json --no-session --offline "/claude:plugin list" </dev/null >"$input_file" || exit $?
```

The file contains JSONL: one JSON event per line. Select the invocation ID for this command before extracting its plugin rows:

<!-- example: select-invocation -->

```bash
invocation_id=$(jq -er -s '
  [.[] | select(.type == "entry_appended")
   | .entry | select(.type == "custom" and .customType == "claude-plugin")
   | .data | select(.origin.kind == "command") | .origin.invocationId]
  | unique
  | if length == 0 then "No command outcome received\n" | halt_error(1)
    elif length == 1 then .[0]
    else error("Expected one command invocation") end
' "$input_file") || exit $?
printf '%s\n' "$invocation_id"
```

<!-- example: extract-plugin-rows -->

```bash
jq -c -e -s --arg invocation "$invocation_id" '
  def outcome:
    .kind as $kind
    | ["cascade", "marketplace-info", "plugin-info", "marketplace-info-cascade",
       "plugin-info-cascade", "marketplace-not-added", "reconcile-pending-empty",
       "reconcile-applied-cascade", "prune-empty", "prune-committed-warning",
       "usage-error", "usage-info", "internal-error"] | index($kind) != null;
  [.[] | select(.type == "entry_appended")
   | .entry | select(.type == "custom" and .customType == "claude-plugin")
   | .data | select(.origin.kind == "command" and .origin.invocationId == $invocation)]
  | if any(.[]; outcome) | not then
      "No command outcome received\n" | halt_error(1)
    elif any(.[]; .kind == "cascade") then
      [.[] | select(.kind == "cascade") | .marketplaces[].plugins[]]
    else "No plugin inventory received\n" | halt_error(1) end
' "$input_file"
```

A valid empty inventory prints this array and exits successfully:

```json
[]
```

For an installed plugin named `review` in marketplace `tools`, the extracted rows can look like this:

```json
[{"status":"installed","name":"review","id":"review@tools","reasons":[]}]
```

An absent command produces an error instead of an empty array. A command outcome without a `cascade` fails with `No plugin inventory received`. Row extraction does not decide whether the entire command succeeded. Keep the captured file for the severity and exit-policy examples, then remove it with `rm "$input_file"`.

## Read the event and payload

Pi wraps each notification in an `entry_appended` event. Its `entry` has `type: "custom"` and `customType: "claude-plugin"`. The extension payload is `entry.data`, which follows [the JSON schema](../schema/claude-plugin.schema.json). Other Pi events can appear in the same file.

The payload's `origin.kind` identifies `command`, `load`, or `hook` output. For a command, `origin.commandId` names the operation, such as `plugin list`. `origin.invocationId` identifies one run. Two runs of `plugin list` have the same command ID and different invocation IDs. For a file with several runs, set `invocation_id` to the run you need instead of using the single-run selector. The examples exclude load and hook entries.

Real CLI tests passed on Pi 1.0.0, both the installed runtime and the exact-floor fixture, with stdin closed. Both runs emitted a command-origin `cascade` with `marketplaces: []` for an empty installation. The tests load the production extension in temporary directories without operator credentials. See [the runtime tests](../test/e2e/pi-json-output.test.ts).

## Prepare one command for the examples

Keep `input_file` and `invocation_id` from the opening example. Run this preparation in the same Bash shell before each task below, or once for an unchanged capture. It stores the selected payloads in `command_entries` and fails if no known command outcome arrived. Run it after the command finishes so that later errors are included.

<!-- example: prepare-command -->

```bash
command_entries=$(jq -c -s --arg invocation "$invocation_id" '
  def outcome:
    .kind as $kind
    | ["cascade", "marketplace-info", "plugin-info", "marketplace-info-cascade",
       "plugin-info-cascade", "marketplace-not-added", "reconcile-pending-empty",
       "reconcile-applied-cascade", "prune-empty", "prune-committed-warning",
       "usage-error", "usage-info", "internal-error"] | index($kind) != null;
  [.[] | select(.type == "entry_appended")
   | .entry | select(.type == "custom" and .customType == "claude-plugin")
   | .data | select(.origin.kind == "command" and .origin.invocationId == $invocation)]
  | if any(.[]; outcome) then .
    else "No command outcome received\n" | halt_error(1) end
  | if all(.[];
      .schemaVersion == 1 and (.kind | type) == "string" and
      (.origin.commandId | type) == "string" and (.origin.commandId | length) > 0 and
      (.origin.invocationId | length) > 0 and
      (.severity == "info" or .severity == "warning" or .severity == "error") and
      (.needsReload | type) == "boolean") then .
    else "Unsupported command envelope\n" | halt_error(1) end
' "$input_file") || exit $?
```

An outcome reports a command result. The thirteen kinds in `outcome` above match the extension's command-outcome classifier. An empty `cascade` counts as an outcome. `diagnostic`, `device-flow-prompt`, and lifecycle-only kinds do not. Silence, unrelated events, or only prompts and diagnostics fail with exactly `No command outcome received`.

Unknown kinds remain in the selected data but cannot establish an outcome. Additional fields are preserved. An unfamiliar severity, a nonboolean `needsReload`, or an unsupported schema version fails with `Unsupported command envelope`. These checks cover the fields used here. They do not replace validation of the full payload against the schema.

## Calculate command severity

After preparation, calculate the maximum severity across all selected command entries. The order is `info` < `warning` < `error`. Prompts, diagnostics, and unknown kinds participate in this calculation when a known outcome also exists.

<!-- example: command-severity -->

```bash
printf '%s\n' "$command_entries" | jq -r '
  [.[].severity | {info: 0, warning: 1, error: 2}[.]] | max
  | ["info", "warning", "error"][.]
'
```

For an info outcome followed by an error, this prints `error`. Reversing those entries still prints `error`. An error from another invocation, a load event, or a hook does not change the selected command's severity.

## Set a script exit status

After preparation, use this example to display every selected payload and set an exit status. Info and warning outcomes succeed. Warnings remain visible in stdout with their severity and message fields. Any selected error makes the example exit with status 1 after printing the payloads.

<!-- example: command-exit-status -->

```bash
printf '%s\n' "$command_entries" | jq -c '
  .[],
  (if any(.[]; .severity == "error") then
     "Command reported an error\n" | halt_error(1)
   else empty end)
'
```

This is the example's policy. It does not change wire severity or Pi's process exit behavior. Check Pi's process status separately for CLI and runtime failures. A zero Pi exit status alone does not prove command success. Malformed JSON makes the preparation fail before the example runs.

## Detect reload needs

After preparation, combine every selected `needsReload` with boolean OR. This includes earlier successes if a later entry reports an error. A printed `false` is a valid answer, so this example does not use `jq -e`.

<!-- example: needs-reload -->

```bash
printf '%s\n' "$command_entries" | jq 'any(.[]; .needsReload)'
```

The output is the JSON boolean `true` or `false`. This example reports reload needs even for failed commands. Use the exit-status example to judge success.

## Keep partial results

One invocation can emit an installed plugin row and then an `internal-error`. For example, the exit-status example displays both payloads below in order, then prints `Command reported an error` to stderr and exits 1:

```jsonl
{"schemaVersion":1,"origin":{"kind":"command","commandId":"plugin install","invocationId":"run-1"},"kind":"cascade","severity":"info","needsReload":true,"marketplaces":[{"name":"tools","scope":"user","plugins":[{"status":"installed","name":"review","id":"review@tools","reasons":[]}]}]}
{"schemaVersion":1,"origin":{"kind":"command","commandId":"plugin install","invocationId":"run-1"},"kind":"internal-error","severity":"error","needsReload":true,"summary":"Later step failed.","cause":{"causeChain":["Later step failed."],"truncated":false}}
```

Completed changes remain. The severity example prints `error`, and the reload example prints `true`. An error does not promise rollback, and it does not erase earlier results. Keep the whole invocation when reporting failures.

## Schema reference

The current `schemaVersion` is `1`. A new optional field, a new kind, or a new closed-set member keeps the same version. Removing or renaming a field, changing its type, or changing its meaning requires a version bump.

A closed set lists the currently supported values. Consumers must handle unfamiliar values conservatively even when the version stays the same. Preserve unknown fields and kinds when forwarding records. Do not treat an unfamiliar kind as proof of a command outcome. If a new severity or other value prevents a safe verdict, report an unsupported value instead of assuming success. The examples above follow this policy. The committed schema describes the current producer and rejects additional object properties. An older copy of that strict schema can therefore reject valid additive output from a newer producer.

The tables describe `entry.data`, outside Pi's event wrapper. Field paths are relative to the object named by the table. `[]` means an array of the linked object or primitive type. Requiredness applies when the containing object exists. A conditional field exists only in the branch described in its meaning. Optional fields are omitted when absent, rather than set to `null`.

### Common fields

Every kind includes these fields. The `internal-error` kind narrows origin and severity as stated below. The command verdict is the maximum severity over all entries with that command's `origin.invocationId`, excluding load, hook, and other invocation entries.

<!-- fields: common-fields -->

| Field path      | Type              | Presence | Meaning                                               |
| --------------- | ----------------- | -------- | ----------------------------------------------------- |
| `schemaVersion` | integer `1`       | required | Payload compatibility version.                        |
| `kind`          | string            | required | Payload kind from the twenty-one kind sections below. |
| `origin`        | [Origin](#origin) | required | Source of this notification.                          |
| `severity`      | string            | required | `info`, `warning`, or `error`, in increasing order.   |
| `needsReload`   | boolean           | required | Whether completed changes need `/reload`.             |

<!-- /fields -->

### Structured summary

The ten structured kinds through `prune-committed-warning` also permit this field. The producer includes it on warning and error payloads, and it can be empty. Raw kinds omit it. `internal-error` requires it.

<!-- fields: structured-summary -->

| Field path | Type   | Presence | Meaning                                                                          |
| ---------- | ------ | -------- | -------------------------------------------------------------------------------- |
| `summary`  | string | optional | Human-readable warning or error summary, separate from structured result fields. |

<!-- /fields -->

### Origin

<!-- fields: origin -->

| Field path     | Type            | Presence    | Meaning                                                                            |
| -------------- | --------------- | ----------- | ---------------------------------------------------------------------------------- |
| `kind`         | string          | required    | `command`, `load`, or `hook`.                                                      |
| `commandId`    | nonempty string | conditional | Required only for `command`. Names the operation, such as `plugin list`.           |
| `invocationId` | nonempty string | conditional | Required only for `command`. Identifies one invocation, including its nested work. |

<!-- /fields -->

Load and hook origins have only `kind`. Command IDs can repeat across runs. Invocation IDs keep their results separate, including overlapping commands.

### Command origin

`internal-error` uses the command branch of [Origin](#origin). Both identifiers are required.

<!-- fields: command-origin -->

<!-- use: origin -->

| Field path     | Type            | Presence | Meaning                                  |
| -------------- | --------------- | -------- | ---------------------------------------- |
| `commandId`    | nonempty string | required | Command operation as defined in Origin.  |
| `invocationId` | nonempty string | required | Command invocation as defined in Origin. |

<!-- /fields -->

### Payload kinds

Each section includes [Common fields](#common-fields). References to a body reuse its fields at the payload root. Cascaded info blocks contain only that body, without their own envelope.

#### cascade

Command results or inventory, including an empty `marketplaces` array.

<!-- fields: kind:cascade -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

| Field path          | Type                                      | Presence | Meaning                                                         |
| ------------------- | ----------------------------------------- | -------- | --------------------------------------------------------------- |
| `marketplaces`      | [Marketplace block](#marketplace-block)[] | required | Marketplace and plugin rows in model order.                     |
| `tally`             | [Tally](#tally)                           | optional | Counts for a plural result.                                     |
| `noOp`              | boolean `true`                            | optional | The command reports no work.                                    |
| `needsApply`        | boolean `true`                            | optional | `pending` lists changes that `/claude:plugin apply` would make. |
| `advisories`        | string[]                                  | optional | Advisory lines in caller order.                                 |
| `retainedWorkflows` | [Retained workflow](#retained-workflow)[] | optional | Workflow staging retained for recovery.                         |

<!-- /fields -->

#### reconcile-applied-cascade

Applied load-time reconciliation. It carries no `noOp`, advisories, or retained workflows. `/claude:plugin apply` (`origin.commandId` `plugin apply`) reports the changes it made with this kind, so the kind is a command outcome.

<!-- fields: kind:reconcile-applied-cascade -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

| Field path     | Type                                      | Presence | Meaning                                 |
| -------------- | ----------------------------------------- | -------- | --------------------------------------- |
| `marketplaces` | [Marketplace block](#marketplace-block)[] | required | Reconciled marketplace and plugin rows. |
| `tally`        | [Tally](#tally)                           | optional | Counts for a plural result.             |

<!-- /fields -->

#### marketplace-info

One marketplace. Adds the fields of [Marketplace info body](#marketplace-info-body) at the root.

<!-- fields: kind:marketplace-info -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

<!-- use: marketplace-info-body -->

<!-- /fields -->

#### plugin-info

One plugin. Adds the fields of [Plugin info body](#plugin-info-body) at the root.

<!-- fields: kind:plugin-info -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

<!-- use: plugin-info-body -->

<!-- /fields -->

#### marketplace-info-cascade

Information about multiple marketplaces.

<!-- fields: kind:marketplace-info-cascade -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

| Field path | Type                                              | Presence | Meaning                                                           |
| ---------- | ------------------------------------------------- | -------- | ----------------------------------------------------------------- |
| `blocks`   | [Marketplace info body](#marketplace-info-body)[] | required | At least one marketplace body, without per-block envelope fields. |

<!-- /fields -->

#### plugin-info-cascade

Information about multiple plugins.

<!-- fields: kind:plugin-info-cascade -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

| Field path | Type                                    | Presence | Meaning                                                      |
| ---------- | --------------------------------------- | -------- | ------------------------------------------------------------ |
| `blocks`   | [Plugin info body](#plugin-info-body)[] | required | At least one plugin body, without per-block envelope fields. |

<!-- /fields -->

#### marketplace-not-added

A requested marketplace is absent from the selected scope.

<!-- fields: kind:marketplace-not-added -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

| Field path | Type     | Presence | Meaning                                                       |
| ---------- | -------- | -------- | ------------------------------------------------------------- |
| `name`     | string   | required | Requested marketplace name.                                   |
| `scope`    | Scope    | optional | Selected scope when specified.                                |
| `reasons`  | Reason[] | required | Resolved not-added reason, including scope-specific variants. |

<!-- /fields -->

#### reconcile-pending-empty

No pending reconciliation changes. `pending` and `apply` both report it; `origin.commandId` names which. A `pending` report can carry retained staging information.

<!-- fields: kind:reconcile-pending-empty -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

| Field path          | Type                                      | Presence | Meaning                                 |
| ------------------- | ----------------------------------------- | -------- | --------------------------------------- |
| `advisories`        | string[]                                  | optional | Advisory lines in caller order.         |
| `retainedWorkflows` | [Retained workflow](#retained-workflow)[] | optional | Workflow staging retained for recovery. |

<!-- /fields -->

#### prune-empty

No orphaned dependencies to prune in the scope.

<!-- fields: kind:prune-empty -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

| Field path | Type  | Presence | Meaning                    |
| ---------- | ----- | -------- | -------------------------- |
| `scope`    | Scope | required | Scope of the orphan sweep. |

<!-- /fields -->

#### prune-committed-warning

A warning after the prune state save succeeded.

<!-- fields: kind:prune-committed-warning -->

<!-- use: common-fields -->

<!-- use: structured-summary -->

| Field path | Type            | Presence | Meaning                            |
| ---------- | --------------- | -------- | ---------------------------------- |
| `scope`    | Scope           | required | Scope whose prune state was saved. |
| `cause`    | [Cause](#cause) | optional | Serialized warning cause.          |

<!-- /fields -->

#### usage-error

An invalid command or a mode refusal.

<!-- fields: kind:usage-error -->

<!-- use: common-fields -->

| Field path | Type   | Presence | Meaning                             |
| ---------- | ------ | -------- | ----------------------------------- |
| `message`  | string | required | Error and remedy.                   |
| `usage`    | string | required | Usage help. The field can be empty. |

<!-- /fields -->

#### usage-info

Explicitly requested command help.

<!-- fields: kind:usage-info -->

<!-- use: common-fields -->

| Field path | Type   | Presence | Meaning     |
| ---------- | ------ | -------- | ----------- |
| `usage`    | string | required | Usage help. |

<!-- /fields -->

#### diagnostic

An out-of-band warning. It does not establish a command outcome.

<!-- fields: kind:diagnostic -->

<!-- use: common-fields -->

| Field path | Type     | Presence | Meaning                                  |
| ---------- | -------- | -------- | ---------------------------------------- |
| `header`   | string   | required | Diagnostic heading.                      |
| `lines`    | string[] | required | Diagnostic body lines in supplied order. |

<!-- /fields -->

#### device-flow-prompt

Authorization instructions. It does not establish a command outcome or carry an access token.

<!-- fields: kind:device-flow-prompt -->

<!-- use: common-fields -->

| Field path        | Type   | Presence | Meaning                                       |
| ----------------- | ------ | -------- | --------------------------------------------- |
| `verificationUri` | string | required | Address where the user authorizes the device. |
| `userCode`        | string | required | Code the user enters at that address.         |

<!-- /fields -->

#### async-rewake-summary

A plugin author's asynchronous hook summary.

<!-- fields: kind:async-rewake-summary -->

<!-- use: common-fields -->

| Field path | Type   | Presence | Meaning                                                                               |
| ---------- | ------ | -------- | ------------------------------------------------------------------------------------- |
| `text`     | string | required | Author's summary text, kept verbatim. This is distinct from the envelope's `summary`. |

<!-- /fields -->

#### stop-override-cap

A Stop-hook override reached its re-entry limit.

<!-- fields: kind:stop-override-cap -->

<!-- use: common-fields -->

| Field path | Type                | Presence | Meaning                                  |
| ---------- | ------------------- | -------- | ---------------------------------------- |
| `pluginId` | string              | required | Plugin whose hook reached the cap.       |
| `cap`      | nonnegative integer | required | Re-entry cap that triggered the warning. |

<!-- /fields -->

#### reconcile-aborted

Load-time reconciliation stopped after a failure.

<!-- fields: kind:reconcile-aborted -->

<!-- use: common-fields -->

| Field path     | Type   | Presence | Meaning                   |
| -------------- | ------ | -------- | ------------------------- |
| `causeMessage` | string | required | Renderable cause message. |

<!-- /fields -->

#### plugin-path-skipped

A load pass could not refresh one scope's plugin PATH.

<!-- fields: kind:plugin-path-skipped -->

<!-- use: common-fields -->

| Field path | Type   | Presence | Meaning                                          |
| ---------- | ------ | -------- | ------------------------------------------------ |
| `scope`    | Scope  | required | Scope whose PATH refresh was skipped.            |
| `reason`   | string | required | Free-text reason, outside the closed Reason set. |

<!-- /fields -->

#### mcp-config-notices

One section of facts about the MCP config files that a command or the load pass rewrote or left unchanged. Severity is always `warning`, and `needsReload` is always `false`. One operation emits one entry for each section that has a notice, in this order: `comments-dropped`, `left-unchanged`, `override-kept`, `variables-missing`, `credentials-blanked`, `tool-rules-unenforced`, `leftover-removed`.

<!-- fields: kind:mcp-config-notices -->

<!-- use: common-fields -->

| Field path | Type                                      | Presence | Meaning                                                                  |
| ---------- | ----------------------------------------- | -------- | ------------------------------------------------------------------------ |
| `notices`  | [MCP config notice](#mcp-config-notice)[] | required | At least one notice, all of the section's kind, each distinct line once. |

<!-- /fields -->

#### mcp-migration

The one notice of a load pass that moved plugin MCP servers from `mcp.json` to `mcp-adapter.json`, for both scopes. Its origin is `load`. Severity is `warning` when a row stayed in `mcp.json`, a server was removed as unsupported or malformed, or a notice warns, and `info` otherwise. A load pass that has notices but no rows emits `mcp-config-notices` entries instead.

<!-- fields: kind:mcp-migration -->

<!-- use: common-fields -->

| Field path    | Type                                      | Presence | Meaning                                                                                 |
| ------------- | ----------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `needsReload` | boolean                                   | required | `true` exactly when a server moved or was removed.                                      |
| `rows`        | [MCP migration row](#mcp-migration-row)[] | required | At least one row: moved rows, then removed rows, then rows left in `mcp.json`.          |
| `notices`     | [MCP config notice](#mcp-config-notice)[] | required | Notices about the files the migration wrote, in section order. An empty array is valid. |

<!-- /fields -->

#### internal-error

An unexpected command failure or a final outcome when ordinary delivery failed. Its origin is always `command`, severity is always `error`, and `summary` is required.

<!-- fields: kind:internal-error -->

<!-- use: common-fields -->

| Field path | Type                              | Presence | Meaning                   |
| ---------- | --------------------------------- | -------- | ------------------------- |
| `origin`   | [Command origin](#command-origin) | required | Command branch only.      |
| `summary`  | string                            | required | Redacted failure summary. |
| `cause`    | [Cause](#cause)                   | required | Redacted failure chain.   |

<!-- /fields -->

### Marketplace block

<!-- fields: marketplace-block -->

| Field path | Type                                        | Presence | Meaning                                              |
| ---------- | ------------------------------------------- | -------- | ---------------------------------------------------- |
| `name`     | string                                      | required | Marketplace name.                                    |
| `scope`    | Scope                                       | required | Marketplace scope.                                   |
| `plugins`  | [Plugin row](#plugin-row)[]                 | required | Plugin rows in model order. An empty array is valid. |
| `status`   | MarketplaceStatus                           | optional | Result of the marketplace operation.                 |
| `details`  | [Marketplace details](#marketplace-details) | optional | Autoupdate and last-update information.              |
| `reasons`  | Reason[]                                    | optional | Resolved marketplace reasons.                        |

<!-- /fields -->

### Plugin row

<!-- fields: plugin-row -->

| Field path        | Type                                | Presence | Meaning                                                                                                                                                                                                                                         |
| ----------------- | ----------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`          | PluginStatus                        | required | Plugin state or operation result.                                                                                                                                                                                                               |
| `name`            | string                              | required | Plugin name.                                                                                                                                                                                                                                    |
| `id`              | string                              | required | Qualified address, `<name>@<marketplace>`. A dependency row named by its `<plugin>@<marketplace>` key keeps that key. When a failed `marketplace add` has a child row, the row names the source after redaction, and its id is that name alone. |
| `reasons`         | Reason[]                            | required | Resolved reasons, including soft-dependency markers. Empty means no reasons.                                                                                                                                                                    |
| `version`         | string                              | optional | Plugin version. On a reinstalled, partially installed, or failed row that carries `from`, the version it moved to; an updated row carries `to` instead.                                                                                         |
| `from`            | string                              | optional | Version before the move, on an update row, or on a reinstalled, partially installed, or failed row whose revision moved.                                                                                                                        |
| `to`              | string                              | optional | Version after an update.                                                                                                                                                                                                                        |
| `fromCommit`      | string                              | optional | Full commit before a move whose version did not change. Present exactly when the text form shows the short commits.                                                                                                                             |
| `toCommit`        | string                              | optional | Full commit after a move whose version did not change. Present exactly when the text form shows the short commits.                                                                                                                              |
| `scope`           | Scope                               | optional | Plugin installation scope.                                                                                                                                                                                                                      |
| `description`     | string                              | optional | Plugin description.                                                                                                                                                                                                                             |
| `partial`         | boolean                             | optional | Whether only part of the plugin is supported.                                                                                                                                                                                                   |
| `hint`            | RowHint                             | optional | Follow-up action hint.                                                                                                                                                                                                                          |
| `cause`           | [Cause](#cause)                     | optional | Serialized cause line: a failure, a remedy, or the constraint disclosure of an updated, reinstalled, or partially installed row.                                                                                                                |
| `leaks`           | string[]                            | optional | Paths left behind by failed cleanup, after redaction.                                                                                                                                                                                           |
| `rollbackPartial` | [Rollback phase](#rollback-phase)[] | optional | Rollback phases that did not finish.                                                                                                                                                                                                            |

<!-- /fields -->

### Marketplace details

<!-- fields: marketplace-details -->

| Field path      | Type    | Presence | Meaning                                    |
| --------------- | ------- | -------- | ------------------------------------------ |
| `autoupdate`    | boolean | required | Whether marketplace autoupdate is enabled. |
| `lastUpdatedAt` | string  | optional | Recorded last-update timestamp.            |

<!-- /fields -->

### Marketplace info body

<!-- fields: marketplace-info-body -->

| Field path            | Type                                        | Presence | Meaning                                         |
| --------------------- | ------------------------------------------- | -------- | ----------------------------------------------- |
| `name`                | string                                      | required | Marketplace name.                               |
| `scope`               | Scope                                       | required | Marketplace scope.                              |
| `details`             | [Marketplace details](#marketplace-details) | required | Marketplace settings and timestamp.             |
| `source`              | [Marketplace source](#marketplace-source)   | required | Source selected by `sourceKind`.                |
| `description`         | string                                      | optional | Marketplace description.                        |
| `allowedMarketplaces` | string[]                                    | optional | Marketplace names allowed for dependency edges. |

<!-- /fields -->

### Marketplace source

Each source has exactly one branch. Branch-specific fields are absent from the other branches.

<!-- fields: marketplace-source -->

| Field path   | Type   | Presence    | Meaning                                                            |
| ------------ | ------ | ----------- | ------------------------------------------------------------------ |
| `sourceKind` | string | required    | `github`, `url`, or `path`.                                        |
| `owner`      | string | conditional | Required for `github`. Repository owner.                           |
| `repo`       | string | conditional | Required for `github`. Repository name.                            |
| `ref`        | string | optional    | Git ref for `github` or `url`. Absent for `path`.                  |
| `url`        | string | conditional | Required for `url`. Repository URL.                                |
| `absPath`    | string | conditional | Required for `path`. Absolute source path, deliberately preserved. |

<!-- /fields -->

### Plugin info body

<!-- fields: plugin-info-body -->

| Field path           | Type                                        | Presence | Meaning                                     |
| -------------------- | ------------------------------------------- | -------- | ------------------------------------------- |
| `marketplaceName`    | string                                      | required | Marketplace from which the plugin was read. |
| `marketplaceScope`   | Scope                                       | required | Scope of that marketplace record.           |
| `marketplaceDetails` | [Marketplace details](#marketplace-details) | required | Marketplace settings and timestamp.         |
| `plugin`             | [Plugin info row](#plugin-info-row)         | required | Resolved or unresolved plugin information.  |

<!-- /fields -->

### Plugin info row

<!-- fields: plugin-info-row -->

| Field path           | Type                                              | Presence    | Meaning                                                                                                                                 |
| -------------------- | ------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `status`             | PluginInfoStatus                                  | required    | Plugin information state.                                                                                                               |
| `name`               | string                                            | required    | Plugin name.                                                                                                                            |
| `id`                 | string                                            | required    | Qualified address, `<name>@<marketplaceName>`.                                                                                          |
| `reasons`            | Reason[]                                          | required    | Resolved reasons. Empty means no reasons.                                                                                               |
| `version`            | string                                            | optional    | Plugin version.                                                                                                                         |
| `scope`              | Scope                                             | optional    | Plugin installation scope.                                                                                                              |
| `description`        | string                                            | optional    | Plugin description.                                                                                                                     |
| `notes`              | string[]                                          | optional    | Ordered advisory lines about component files.                                                                                           |
| `dependencies`       | string[]                                          | optional    | Dependency addresses with any version or SHA constraints, sorted by dependency name.                                                    |
| `componentsResolved` | boolean                                           | required    | Selects the resolved (`true`) or unresolved (`false`) branch.                                                                           |
| `components`         | [Components](#components)                         | conditional | Required when `componentsResolved` is `true`. Absent when it is `false`.                                                                |
| `requires`           | [Companion requirement](#companion-requirement)[] | optional    | Companion extensions the resolved components need, sorted by name. Absent when none is needed and when `componentsResolved` is `false`. |

<!-- /fields -->

### Components

Component names are sorted alphabetically. A missing component field means that no entries of that type are supplied.

<!-- fields: components -->

| Field path  | Type                        | Presence | Meaning                                                          |
| ----------- | --------------------------- | -------- | ---------------------------------------------------------------- |
| `agents`    | string[]                    | optional | Agent names.                                                     |
| `commands`  | string[]                    | optional | Command names.                                                   |
| `hooks`     | [Hook entry](#hook-entry)[] | optional | Hook events and matchers.                                        |
| `mcp`       | [MCP server](#mcp-server)[] | optional | MCP servers, in Claude Code's `plugin:<plugin>:<server>` naming. |
| `skills`    | string[]                    | optional | Skill names.                                                     |
| `workflows` | string[]                    | optional | Admitted workflow names in `<plugin>:<name>` form.               |

<!-- /fields -->

### MCP server

A server that a partial install leaves out has `unsupportedFeature` and no state. A server that the plugin writes can have its state and its variable names.

<!-- fields: mcp-server -->

| Field path           | Type            | Presence | Meaning                                                                     |
| -------------------- | --------------- | -------- | --------------------------------------------------------------------------- |
| `name`               | string          | required | Server name, `plugin:<plugin>:<server>`.                                    |
| `unsupportedFeature` | string          | optional | Claude Code MCP feature that pi-mcp-adapter cannot run.                     |
| `unsetVariables`     | string[]        | optional | Referenced environment variables that are not set. Names only.              |
| `withheldVariables`  | string[]        | optional | Credential variables written as empty values. Names only.                   |
| `status`             | McpServerStatus | optional | pi-mcp-adapter's last known state of a server that an install record lists. |

<!-- /fields -->

### Companion requirement

<!-- fields: companion-requirement -->

| Field path  | Type      | Presence | Meaning                                     |
| ----------- | --------- | -------- | ------------------------------------------- |
| `companion` | Companion | required | Companion extension that a component needs. |
| `missing`   | boolean   | required | Whether the companion was not loaded.       |

<!-- /fields -->

### Hook entry

The plain branch has `event` and an optional `matcher`. The lenient branch adds `kind` and `supported`.

<!-- fields: hook-entry -->

| Field path  | Type             | Presence    | Meaning                                                         |
| ----------- | ---------------- | ----------- | --------------------------------------------------------------- |
| `event`     | string           | required    | Hook event name.                                                |
| `matcher`   | string           | optional    | Hook matcher when specified.                                    |
| `kind`      | string `lenient` | conditional | Required in the lenient branch. Absent in the plain branch.     |
| `supported` | boolean          | conditional | Required in the lenient branch. Whether this hook is supported. |

<!-- /fields -->

### MCP config notice

`kind` selects the branch. Branch-specific fields are absent from the other branches. Notices name fields and variables, never their values.

<!-- fields: mcp-config-notice -->

| Field path | Type     | Presence    | Meaning                                                                                                |
| ---------- | -------- | ----------- | ------------------------------------------------------------------------------------------------------ |
| `kind`     | string   | required    | McpConfigNoticeKind.                                                                                   |
| `scope`    | Scope    | required    | Scope of the config file.                                                                              |
| `file`     | string   | required    | `mcp-adapter.json`, or `mcp.json` for `comments-dropped` and `left-unchanged`.                         |
| `plugin`   | string   | conditional | Required for every kind except `comments-dropped` and `left-unchanged`. Plugin that provides `server`. |
| `server`   | string   | conditional | Required where `plugin` is. Server key in `file`.                                                      |
| `fields`   | string[] | conditional | Required for `override-kept` and `tool-rules-unenforced`. Field names, in their file order.            |
| `names`    | string[] | conditional | Required for `variables-missing` and `credentials-blanked`. Variable names, in first-seen order.       |

<!-- /fields -->

### MCP migration row

`kind` selects the branch. Branch-specific fields are absent from the other branches.

<!-- fields: mcp-migration-row -->

| Field path    | Type            | Presence    | Meaning                                                                                                                              |
| ------------- | --------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `kind`        | string          | required    | McpMigrationRowKind.                                                                                                                 |
| `scope`       | Scope           | required    | Scope the row belongs to.                                                                                                            |
| `plugin`      | string          | conditional | Required except for `stopped` and `file-unreadable`. Plugin that owns the servers.                                                   |
| `marketplace` | string          | conditional | Required where `plugin` is. Marketplace of the plugin.                                                                               |
| `from`        | string          | conditional | Required for `moved`. Server key in `mcp.json`.                                                                                      |
| `to`          | string          | conditional | Required for `moved`. Server key in `mcp-adapter.json`.                                                                              |
| `server`      | string          | conditional | Required for `removed`. Server key that was removed from `mcp.json`.                                                                 |
| `cause`       | McpRemovalCause | conditional | Required for `removed`. Why the server was removed without a move.                                                                   |
| `feature`     | string          | optional    | Only for `removed` with cause `unsupported-feature`. The Claude Code feature that blocks the server.                                 |
| `detail`      | string          | conditional | Required for `stopped` and `unfinished`. Why the move stopped or did not finish. It has no absolute path.                            |
| `servers`     | string[]        | conditional | Required for every kind except `moved`, `removed`, `stopped`, and `file-unreadable`. Server keys in `mcp.json`.                      |
| `key`         | string          | conditional | Required for `collision`. Server key that another config source already defines.                                                     |
| `source`      | string          | conditional | Required for `collision`. That config source, as a scope file or a home-relative path.                                               |
| `file`        | string          | conditional | Required for `file-unreadable` (`mcp.json` or `mcp-adapter.json`) and `unfinished` (`mcp.json` or `project-scope mcp-adapter.json`). |

<!-- /fields -->

### Cause

<!-- fields: cause -->

| Field path   | Type     | Presence | Meaning                                                            |
| ------------ | -------- | -------- | ------------------------------------------------------------------ |
| `causeChain` | string[] | required | Serialized error messages, outermost first, after redaction.       |
| `truncated`  | boolean  | required | Whether serialization stopped before the whole chain was included. |

<!-- /fields -->

### Rollback phase

<!-- fields: rollback-phase -->

| Field path | Type            | Presence | Meaning                                |
| ---------- | --------------- | -------- | -------------------------------------- |
| `phase`    | string          | required | Name of the incomplete rollback phase. |
| `cause`    | [Cause](#cause) | optional | Failure from that rollback phase.      |

<!-- /fields -->

### Tally

All counts are nonnegative integers. The failure and warning counts are always present when the tally exists.

<!-- fields: tally -->

| Field path | Type                            | Presence | Meaning                                |
| ---------- | ------------------------------- | -------- | -------------------------------------- |
| `label`    | string                          | required | Subject of the count, such as plugins. |
| `failures` | nonnegative integer             | required | Error rows.                            |
| `warnings` | nonnegative integer             | required | Warning rows.                          |
| `success`  | [Success tally](#success-tally) | optional | Successful operation count.            |

<!-- /fields -->

### Success tally

<!-- fields: success-tally -->

| Field path | Type                | Presence | Meaning                                  |
| ---------- | ------------------- | -------- | ---------------------------------------- |
| `count`    | nonnegative integer | required | Successful rows.                         |
| `verb`     | string              | optional | Operation named by the successful count. |

<!-- /fields -->

### Retained workflow

<!-- fields: retained-workflow -->

| Field path      | Type                | Presence | Meaning                                      |
| --------------- | ------------------- | -------- | -------------------------------------------- |
| `name`          | string              | required | Name of the retained workflow staging entry. |
| `envelopeCount` | nonnegative integer | optional | Observed count of stored workflow envelopes. |

<!-- /fields -->

### Closed-set tokens

These are native wire values, including spaces and hyphens. They are not the labels produced by the text renderer. `Scope` is `user` or `project`.

`PluginStatus`: `installed`, `updated`, `reinstalled`, `uninstalled`, `available`, `unavailable`, `upgradable`, `failed`, `skipped`, `manual recovery`, `will install`, `will uninstall`, `will enable`, `will disable`, `disabled`, `partially-installed`, `partially-upgradable`, `partially-available`, `remote`.

`PluginInfoStatus`: `installed`, `available`, `remote`, `unavailable`, `partially-available`, `failed`, `partially-installed`, `disabled`.

`MarketplaceStatus`: `added`, `removed`, `updated`, `failed`, `autoupdate enabled`, `autoupdate disabled`, `skipped`.

`RowHint`: `partial-install`, `partial-update`, `stale-gate-update`, `enable`.

`Reason`: `up-to-date`, `not found`, `already installed`, `not installed`, `not in manifest`, `invalid manifest`, `no longer installable`, `unsupported source`, `unsupported component`, `unsupported hooks`, `lsp`, `requires pi-subagents`, `requires pi-mcp-adapter`, `rollback partial`, `unreadable`, `unparseable`, `unreadable manifest`, `source mismatch`, `plugins remain`, `concurrently uninstalled`, `concurrently updated`, `stale clone`, `duplicate name`, `lock held`, `already autoupdate`, `already no autoupdate`, `already enabled`, `already disabled`, `permission denied`, `source missing`, `network unreachable`, `marketplace not added`, `marketplace not added to user scope`, `marketplace not added to project scope`, `orphan rewake`, `authentication required`, `dangling reference`, `malformed mcp`, `malformed skill`, `malformed command`, `installs disabled`, `marketplace in user scope`, `marketplace in project scope`, `data kept`, `no matching version`, `version conflict`, `constraint too complex`, `invalid version constraint`, `dependency marketplace not added`, `dependency cycle`, `dependency failed`, `dependency promoted`, `dependency pruned`, `dependency unsatisfied`, `dependency version unsatisfied`, `dependents unsatisfied`, `dependency current copy`, `dependency enabled`, `dependents remain`, `dependency installed`, `dependents constrain`, `cross-marketplace`, `stale workflow command`, `requires pi-dynamic-workflows`, `components now supported`, `unsupported mcp`, `marketplace in local layer only`, `marketplace in base layer only`, `plugin in local layer only`, `plugin in base layer only`, `already installed in base layer`, `already installed in local layer`, `still installed in base layer`, `still installed in local layer`, `disabled in local layer`, `enabled in local layer`, `network error`.

`McpServerStatus`: `connected`, `cached, connects on first use`, `needs authentication`, `pending approval`, `disabled`, `not connected`, `failed`, `status unknown`, `not loaded`, `overridden by project scope`.

`Companion`: `pi-dynamic-workflows`, `pi-mcp-adapter`, `pi-subagents`.

`McpConfigNoticeKind`: `comments-dropped`, `left-unchanged`, `override-kept`, `variables-missing`, `credentials-blanked`, `tool-rules-unenforced`, `leftover-removed`.

`McpMigrationRowKind`: `moved`, `removed`, `stopped`, `unowned`, `not-listed`, `source-unreadable`, `source-outdated`, `marketplace-unreadable`, `collision`, `file-unreadable`, `unfinished`.

`McpRemovalCause`: `not-declared`, `disabled`, `unsupported-feature`, `malformed`.

## Limitations

Print mode uses Pi's silent `notify` behavior. Scripts that need plugin output must use `--mode json`. Plugin command severity does not determine Pi's process exit status. Pi can exit zero after a command reports an error. Independent CLI or runtime failures can still return nonzero. Check both the process status and the selected command's payloads.

Entries emitted during `session_start` and `resources_discover` are not streamed in JSON or RPC mode. These hooks run before the output subscription starts. RPC clients can retrieve those entries with `get_entries`. The absence of a startup entry from the stream does not mean that the hook did not run.

RPC front-ends receive custom `claude-plugin` entries through the JSON strategy. They do not also receive the human `notify` text. Front-ends must render these entries, at least the `device-flow-prompt` fields `verificationUri` and `userCode`, so users can authorize the device.

A slash-command-only run does not create its initial session file until an assistant message exists. This applies even when persistence is enabled. The independent `--no-session` flag disables persistence altogether. An entry in session memory or the event stream therefore does not prove that Pi wrote a session file.

The [real-runtime tests](../test/e2e/pi-json-output.test.ts) passed on installed Pi 1.0.0 and on the separate exact-floor fixture, also Pi 1.0.0. Both runs verified schema-valid command output, startup memory without streaming, RPC retrieval, and slash-only persistence timing. An earlier [execution record](../.planning/milestones/json-output-phases/07-mode-refusals-real-pi-verification-and-docs/07-03-SUMMARY.md#verification-evidence) records the same checks on Pi 0.87.1 and the earlier 0.86.1 floor. These tests use fresh directories and no operator credentials.

Output delivery has four accepted limits:

- Each ordinary command append failure gets one direct recovery attempt on the same sink. Successful recovery permits later entries and a new recovery attempt for a later independent failure.
- The extension does not retry the business operation because output failed.
- Failed output does not undo completed changes or promise rollback. Earlier results and `needsReload` remain relevant.
- If the sink also rejects recovery, delivery closes. Sustained sink failure can leave no command outcome, even after work completed.

The [command-run evidence](../.planning/milestones/json-output-phases/06-command-run-contract/06-03-SUMMARY.md#fault-path-evidence) covers recovery, retained changes, and separate overlapping invocations. Invocation IDs correlate output for one command, including its nested work. They are not persistent user identifiers or cross-session tracking, and the extension sends no telemetry. If no known outcome arrives, the examples fail with `No command outcome received`. Prompts, diagnostics, silence, and a zero Pi exit status cannot establish success. Keep earlier payloads when a later failure arrives.
