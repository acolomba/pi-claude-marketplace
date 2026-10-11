# Phase 08 deferred items

## DEF-08-04-01: `windows status --pick` fails when stdout is a pipe

- **Found during:** 08-04, task 2 acceptance check.
- **Symptom:** `node .claude/gsd-core/bin/gsd-tools.cjs windows status --pick ledger.open_count` exits 1 with `--pick "ledger.open_count": command output was not JSON` when its stdout is a pipe or a `$(...)` capture. With stdout redirected to a file it prints `0` and exits 0.
- **Cause (measured):** the full status JSON is larger than the pipe buffer (85,009 bytes before this plan, about 92 KB after). The pre-plan ledger fails the same way, so the dispositions did not cause it. The defect is in the vendored, gitignored gsd-tools, which this project does not edit.
- **Workaround:** redirect to a file and read the file, or parse `windows status` JSON with a reader (`| node -e ...`), which works.
- **Ship gate unaffected:** `/gsd-ship` captures the full `windows status --raw` JSON and reads `.ledger.open_count` with `jq`, without `--pick`; that path reads `0` on the disposed ledger.
- **Out of scope:** gsd-tools is upstream tooling that this project does not edit.
  status: acknowledged
