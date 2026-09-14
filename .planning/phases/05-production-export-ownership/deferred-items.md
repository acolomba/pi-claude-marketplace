# Deferred Items

Out-of-scope findings surfaced while executing phase 05 plans. Each entry names
the owner file so a later bounded plan can pick it up; none is a gate failure.

- Comments in non-owned persistence files still name `CONFIG_VALIDATOR.Check` /
  `STATE_VALIDATOR.Check`
  status: open
  **What:** plan 05-12 changed `loadConfig`, `saveConfig`, `loadState` and
  `saveState` to take validity and the diagnostic from the compiled validator's
  first `Errors` entry, so neither module calls `Check` any more. Six comments
  outside the plan's declared owner set still name the `Check` call by method:
  `persistence/config-write-back.ts:61`, `persistence/migrate-config.ts:12`, and
  `persistence/migrate.ts` lines 122, 159, 175 and 201.
  **Why it is deferred:** the behavioural claim each comment makes is still true
  -- `saveConfig` and `saveState` still refuse an invalid in-memory value before
  any byte reaches disk, through the same compiled schema. Only the method name
  drifted. Those three files belong to other owners in the phase's disjoint-file
  wave structure, and 05-CONTEXT's execution rules forbid editing an owner a
  plan does not declare.
  **Suggested fix:** rename the call in each comment, or drop the method name and
  keep the behavioural sentence, in whichever later plan next owns those files.

- The archived force-reinstall spike prototype imports the now-private
  `STATE_VALIDATOR`
  status: open
  **What:**
  `.planning/spikes/003-force-reinstall-on-version-mismatch/prototype.ts:17`
  imports `STATE_VALIDATOR` from `persistence/state-io.ts`. Plan 05-12 made that
  binding module-private, so the prototype no longer resolves.
  **Why it is deferred:** the file is an archived planning artifact. It is outside
  `tsconfig.json`'s `include`, inside ESLint's ignored paths, absent from fallow's
  entry graph, and run by no npm script, so nothing in the gate chain reads it.
  D-09 preserves historical evidence, and rewriting a recorded experiment would
  falsify the record it exists to hold.
  **Suggested fix:** none required. If the spike is ever re-run, copy the schema
  into the prototype rather than re-exporting the validator.
