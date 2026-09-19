# Deferred items -- Unused Type Member Gate

Out-of-scope discoveries logged during execution. Not fixed here.

## `tests/orchestrators/marketplace/remove.test.ts` reads the operator's real user scope

Found during plan 06-10, Task 2 (`npm run test:coverage:direct:all`).

The case "swallows clone garbage-collection failure and safely reports the
retry" makes a second `removeMarketplace` call with `scope: "user"` while
`HOME` is the developer's own. `PI_CODING_AGENT_DIR` defaults to
`~/.pi/agent/`, so `loadState` reads the real
`~/.pi/agent/pi-claude-marketplace/state.json`.

`state-io.ts:400-407` admits only `schemaVersion` 1 or 2. A developer whose
real install carries `schemaVersion: 3` (written by a newer build) gets:

```
Error: state.json at ~/.pi/agent/pi-claude-marketplace/state.json has an
unsupported schema version
```

Measured both ways on the same tree: 23 pass / 1 fail with the real `HOME`,
24 pass / 0 fail with `HOME` pointed at an empty directory. CI runners have no
`~/.pi/agent/`, so the suite is green there and the defect stays latent.

Out of scope for the member-gate repairs: a different subsystem, a file none of
the six repair plans owns, and no relation to any type-member edit. Fixing it
means giving the case a hermetic home (the `withHermeticHome` helper) rather
than relaxing the schema gate.

## Six ledger notes name a witness coordinate the fresh report no longer holds

Found during plan 06-10, Task 3, while restoring re-keyed notes in
`06-LIVE-TRIAGE.md`. Measured by re-deriving every `test-only-observed` note
from `check-unused-type-members.mjs --json` and comparing it to the stored text.

Each entry reads: row, then the note's cited witness, then what the fresh
report says. (Converted from a table at the milestone close so the
acknowledge writer can match each entry; every cell is preserved verbatim.)

- Row `bridges/hooks/routing-state.ts:138:3`; note says `tests/architecture/hooks-lifecycle.test.ts:457:44`; report says `:453:44`
- Row `bridges/hooks/routing-state.ts:139:3`; note says same; report says `:453:44`
- Row `bridges/hooks/routing-state.ts:140:3`; note says same; report says `:453:44`
- Row `orchestrators/types.ts:221:3`; note says `tests/orchestrators/plugin/update-flow.test.ts:8879:66`; report says `:8877:66`
- Row `orchestrators/types.ts:222:3`; note says same; report says `:8877:66`
- Row `orchestrators/types.ts:223:3`; note says same; report says `:8877:66`

Witness counts and syntax kinds still match; only the line numbers drifted. The
two offsets line up with earlier repairs in this phase that shifted those test
files without re-reading the notes keyed to them.

`--check` does not police note text against the report -- it only requires that
a note exist -- so these rows read `explained` and the audit is silent. None sit
in a file plan 06-10 touched, and the plan's own contract forbids changing a note
outside its four owner areas, so they were measured and recorded rather than
edited.

Closing it wants either a re-derivation pass over every `test-only-observed`
note, or a `--check` rule that compares a note's cited coordinate against the
fresh report so the drift cannot stay silent next time.
  status: acknowledged
