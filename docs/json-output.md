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
       "prune-empty", "prune-committed-warning", "usage-error", "usage-info",
       "internal-error"] | index($kind) != null;
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

Real CLI tests passed on Pi 0.86.1 and 0.87.1 with stdin closed. Both emitted a command-origin `cascade` with `marketplaces: []` for an empty installation. The tests load the production extension in temporary directories without operator credentials. See [the runtime tests](../tests/e2e/pi-json-output.test.ts).

## Prepare one command for the examples

Keep `input_file` and `invocation_id` from the opening example. Run this preparation in the same Bash shell before each task below, or once for an unchanged capture. It stores the selected payloads in `command_entries` and fails if no known command outcome arrived. Run it after the command finishes so that later errors are included.

<!-- example: prepare-command -->

```bash
command_entries=$(jq -c -s --arg invocation "$invocation_id" '
  def outcome:
    .kind as $kind
    | ["cascade", "marketplace-info", "plugin-info", "marketplace-info-cascade",
       "plugin-info-cascade", "marketplace-not-added", "reconcile-pending-empty",
       "prune-empty", "prune-committed-warning", "usage-error", "usage-info",
       "internal-error"] | index($kind) != null;
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

An outcome reports a command result. The twelve kinds in `outcome` above match the extension's command-outcome classifier. An empty `cascade` counts as an outcome. `diagnostic`, `device-flow-prompt`, and lifecycle-only kinds do not. Silence, unrelated events, or only prompts and diagnostics fail with exactly `No command outcome received`.

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
{"schemaVersion":1,"origin":{"kind":"command","commandId":"plugin install","invocationId":"run-1"},"kind":"internal-error","severity":"error","needsReload":true,"causeChain":["Later step failed."],"truncated":false}
```

Completed changes remain. The severity example prints `error`, and the reload example prints `true`. An error does not promise rollback, and it does not erase earlier results. Keep the whole invocation when reporting failures.
