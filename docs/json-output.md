# JSON output

## Extract plugin rows

With this extension installed in Pi, run this command in Bash with `jq` available:

```bash
input_file=$(mktemp)
pi -p --mode json --no-session --offline "/claude:plugin list" </dev/null >"$input_file"
```

The file contains JSONL: one JSON event per line. Select the invocation ID for this command before extracting its plugin rows:

<!-- example: select-invocation -->

```bash
invocation_id=$(jq -er -s '
  [.[] | select(.type == "entry_appended")
   | .entry | select(.type == "custom" and .customType == "claude-plugin")
   | .data | select(.origin.kind == "command") | .origin.invocationId]
  | unique
  | if length == 1 then .[0]
    else error("Expected one command invocation") end
' "$input_file")
```

<!-- example: extract-plugin-rows -->

```bash
jq -c -e -s --arg invocation "$invocation_id" '
  [.[] | select(.type == "entry_appended")
   | .entry | select(.type == "custom" and .customType == "claude-plugin")
   | .data | select(.origin.kind == "command" and .origin.invocationId == $invocation)]
  | if any(.[]; .kind == "cascade") then
      [.[] | select(.kind == "cascade") | .marketplaces[].plugins[]]
    else error("No command outcome received") end
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

An absent command produces an error instead of an empty array. Row extraction does not decide whether the entire command succeeded. Keep the captured file for the severity and exit-policy examples, then remove it with `rm "$input_file"`.

## Read the event and payload

Pi wraps each notification in an `entry_appended` event. Its `entry` has `type: "custom"` and `customType: "claude-plugin"`. The extension payload is `entry.data`, which follows [the JSON schema](../schema/claude-plugin.schema.json). Other Pi events can appear in the same file.

The payload's `origin.kind` identifies `command`, `load`, or `hook` output. For a command, `origin.commandId` names the operation, such as `plugin list`. `origin.invocationId` identifies one run. Two runs of `plugin list` have the same command ID and different invocation IDs. For a file with several runs, set `invocation_id` to the run you need instead of using the single-run selector. The examples exclude load and hook entries.

Real CLI tests passed on Pi 0.86.1 and 0.87.1 with stdin closed. Both emitted a command-origin `cascade` with `marketplaces: []` for an empty installation. The tests load the production extension in temporary directories without operator credentials. See [the runtime tests](../tests/e2e/pi-json-output.test.ts).
