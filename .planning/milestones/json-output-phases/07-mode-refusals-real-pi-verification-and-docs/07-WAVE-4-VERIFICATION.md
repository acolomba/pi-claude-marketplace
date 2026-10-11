# Wave 4 combined-tree verification

- Verified commit: `773004759eb6d400ab48136696d81a6f44f7e5f6` on `features/json`.
- Runtime: Node `v26.11.1`.
- `npm run check`: exit 0; static checks, unpaired tests, integration tests,
  and all 266 direct source/test coverage pairs passed.
- Full check log: `/tmp/json-output-wave07-4-check.log`.
- Independent merged-tree `07-corpus-audit.mjs --self-test` and `--retired`:
  exit 0. Seven negative controls reject invalid amendments. All 3,149
  originals survive with exactly one authorized refusal appended; the retained
  strict report states 3,150 baseline entries present and zero extras.
- Retirement audit read 848 tracked files and found no remaining references.
  Concrete input hashes match the strict pre-deletion evidence after exactly
  the three approved removals. All 264 catalog fences and both fixture locks
  remain unchanged.
- Executor task and summary commits were checked before manifest merge.
  Four scope warnings cover three durable JSON evidence companions and the
  existing optional-peer skip record. These documented deviations preserve
  ignored log evidence and disclose an existing limitation; they change no
  product behavior.
- Eight real-Pi tests passed without skips on installed 0.87.1 and floor
  0.86.1. The full corpus report separately records 10,227 passing tests and
  one existing optional pi-subagents resolver skip; WINDOWS entry 89 retains it.
- Schema-drift gate passed. Codebase-map drift remains advisory with `warn`
  and no mapper requested.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was
introduced. Descriptor-less judgments remain for phase review. Existing
root dependency remediation is still recorded in deferred-items.md.
