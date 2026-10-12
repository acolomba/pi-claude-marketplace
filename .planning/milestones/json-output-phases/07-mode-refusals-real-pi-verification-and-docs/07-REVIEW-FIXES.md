---
phase: "07"
status: fixed
fixed: 1
skipped: 0
---

# Phase 7 review fixes

## Fixed Issues

### WR-01: Executable guide changes bypass both build-input selectors

Commit `0dffe6c1` adds `docs/json-output.md` to CI's shared build-input list
and to the npm-check hook's documentation alternative. A direct selector
probe confirmed a guide-only file set matches the hook and both CI triggers.
YAML, workflow-security, and other fixers passed. The normal commit hook
passed `npm run check:commit`, including executable guide architecture tests.

The configuration change invalidated the previous concrete-input corpus
fingerprint. The exact three historical tools were temporarily restored from
`a9673e10`, without modifying their contents or capture selection. A fresh
full capture produced exactly the same 3,150 serialized records. The ledger
head and capture evidence now identify the corrected configuration; the
original pre-amendment ledger remains in `bf2e84ab`. No original or added
baseline tuple changed, and metadata is unchanged.

Both real Pi runtimes then passed all eight tests, zero skips. The fresh
strict report records 3,150 baseline entries present and zero extras;
10,227 tests passed, zero failed, and the same one optional-peer skip remains.
`--final` passed immediately before removing exactly the three restored tools.
`--retired` then passed across 848 tracked files with unchanged behavior
inputs. Durable refreshed reports are in `07-CORPUS-CAPTURE-EVIDENCE.json`,
`07-CORPUS-FINAL.json`, and `07-RETIREMENT.json`.

Final `npm run check` exited 0 at `0dffe6c1deeb9609360f8c4614fa7b9a2f43e5c1`,
Node v26.11.1, with all 266 direct coverage pairs. Only planning evidence
changed during that final check. It satisfies the combined-tree phase and
regression gates: six prior verification reports reference 124 existing
owner test files covered by the configured full-suite command. Live log:
`/tmp/json-output-review07-final-check.log`.

The original review remains intact. Its one warning is fixed; no finding was
skipped or deferred. The sixteen whole-repository structural duplicate groups
were outside the phase review scope, as the reviewer verified. Existing root
dependency remediation and optional-peer coverage limits remain documented,
not waived. Human judgments are still pending.

## Threat Flags

None -- the selector fix adds verification coverage and changes no product
behavior. Fresh corpus proof preserves deletion-last ordering after the fix.
