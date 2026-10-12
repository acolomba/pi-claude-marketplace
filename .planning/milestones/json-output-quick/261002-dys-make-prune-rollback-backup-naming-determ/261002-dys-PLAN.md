---
phase: 261002-dys
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - tests/orchestrators/plugin/prune-rollback.test.ts
  - tests/orchestrators/plugin/prune.test.ts
  - .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl
autonomous: true
requirements: [TEXT-01, NFR-6]

estimate:
  tokens: 95000
  raw_tokens: 95000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "A production prune still names its backup directory with the prune-backup- prefix plus six random characters under the scope's extension root: createPruneOperation binds Node's mkdtemp and rm, and its signature and the prune edge handler are unchanged."
    - "preparePruneRollback creates its backup root only through the injected createBackupRoot, passing <extensionRoot>/prune-backup- as the prefix and reporting the created directory's basename as backupName."
    - "Every rollback-failure case in tests/orchestrators/plugin/prune.test.ts expects the backup directory prune-backup-ABC123 by its exact name; no expected message or backup path reads the name back from disk."
    - "Two captures of tests/orchestrators/plugin/prune.test.ts are byte-identical."
    - "baseline.jsonl differs from 6394ac1c only in the 8 prune.test.ts entries, each changed only in its backup-directory suffix; meta.json and every file under scripts/ are unchanged, so no corpus normalizer exists."
    - "node scripts/notify-corpus.mjs check exits 0 with 3133 baseline entries present, 0 missing, and 0 extra."
  artifacts:
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts"
      provides: "PruneRestoreOps.createBackupRoot and its single reader in preparePruneRollback"
      contains: "createBackupRoot"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts"
      provides: "createPrunePlugin takes the backup operations as an explicit fourth collaborator"
      contains: "restoreOps: PruneRestoreOps"
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts"
      provides: "The one Node binding of the prune backup operations"
      contains: "createBackupRoot: mkdtemp"
    - path: "tests/orchestrators/plugin/prune-rollback.test.ts"
      provides: "Deterministic backup stub, exact-name proof, and the Node mkdtemp prefix proof"
      contains: "prune-backup-ABC123"
    - path: "tests/orchestrators/plugin/prune.test.ts"
      provides: "Exact backup names in all eight rollback-failure cases"
      contains: "prune-backup-ABC123"
    - path: ".planning/phases/01-presentation-model/notify-corpus/baseline.jsonl"
      provides: "Reproducible prune.test.ts corpus entries"
      contains: "prune-backup-ABC123"
  key_links:
    - from: "extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts"
      to: "extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts"
      via: "createPruneOperation passes NODE_PRUNE_RESTORE_OPS as createPrunePlugin's fourth argument"
      pattern: "NODE_PRUNE_RESTORE_OPS"
    - from: "extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts"
      to: "extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts"
      via: "the sweep hands its injected restoreOps to preparePruneRollback"
      pattern: "preparePruneRollback\\(locations, candidates, restoreOps\\)"
    - from: "extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts"
      to: "the injected creator"
      via: "preparePruneRollback creates the backup root through ops.createBackupRoot with the prune-backup- prefix"
      pattern: "ops\\.createBackupRoot\\("
---

<objective>
Make the prune rollback messages byte-stable under test so `node scripts/notify-corpus.mjs check` can exit 0. Inject the backup-root creator through the existing `PruneRestoreOps` seam instead of calling `mkdtemp` inline, and wire Node's `mkdtemp` and `rm` at the composition owner. This follows the user's locked decision of 2026-10-02: make the prune tests deterministic and do NOT add a corpus normalizer.

Purpose: the TEXT-01 wire corpus captured 8 random `prune-backup-XXXXXX` suffixes from `tests/orchestrators/plugin/prune.test.ts`, so the corpus check can never pass in Phases 3-7. Production behavior must not change: the same `prune-backup-` prefix under the scope's extension root and the same `mkdtemp` uniqueness.

Output: the injected creator and its Node binding, deterministic prune tests that name `prune-backup-ABC123` exactly, a proof that Node's `mkdtemp` still yields the prefixed directory, and a baseline in which exactly the 8 prune entries are re-captured.
</objective>

<execution_context>
@.claude/gsd-core/workflows/execute-plan.md
@.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@.planning/codebase/CONVENTIONS.md
@skills/local-verification/SKILL.md
@skills/typescript-unit-testing/SKILL.md
@skills/typescript-comments/SKILL.md
@skills/typescript-google-style-review/SKILL.md
@extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts
@extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
@scripts/notify-corpus.mjs

<interfaces>
Current contracts at 6394ac1c (the plan's starting commit). The executor can use these directly.

From extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts:
- `export interface PruneRestoreOps { readonly link?: typeof link; readonly removeBackup: typeof rm; readonly afterMetadataRead?: (target: string) => Promise<void>; readonly inspectBackup?: (target: string) => Promise<Stats>; }`. Its JSDoc reads "Filesystem operations faultable at the restore seam."
- `export interface PruneRollback { readonly backupName: string; readonly rollback: () => Promise<readonly PruneRestoreFailure[]>; readonly discard: () => Promise<void>; }`
- `export async function preparePruneRollback(locations: ScopedLocations, members: readonly IndexedRecord[], ops: PruneRestoreOps): Promise<PruneRollback>`. Line 297 builds the backup root inline with Node's `mkdtemp` under `locations.extensionRoot` with the prefix `"prune-backup-"`. Line 342 sets `backupName: path.basename(backupRoot)`. `restoreArtifact` (line 175) also uses `mkdtemp`, for a `.prune-restore-` staging directory. That use stays.

From extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts:
- `export function createPrunePlugin(transaction: UninstallTransaction, hooksRouting: UninstallHooksRouting, completionCache: CompletionCache): (options: PrunePluginOptions) => Promise<void>`. Line 278 calls `preparePruneRollback(locations, candidates, { removeBackup: rm })`. `rm` (line 4) is the file's only `node:fs/promises` import.
- `PruneRollbackError` builds the user-visible text "Prune rollback was incomplete. Inspect <backupName>/manifest.json under this scope's pi-claude-marketplace directory before retrying."

From extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts:
- `export function createPruneOperation(hooksRouting: UninstallHooksRouting, completionCache: CompletionCache): (options: PrunePluginOptions) => Promise<void>` returns `createPrunePlugin(REAL_UNINSTALL_TRANSACTION, hooksRouting, completionCache)`.
- Precedent for module-private Node bindings with a `//` note: `NODE_FETCH_STATUS`, `NODE_PLUGIN_INFO_READER`. The existing import is `import { readdir, readFile, stat } from "node:fs/promises";`.
- Callers of `createPruneOperation`: `edge/handlers/plugin/prune.ts` (`makePruneHandler`) and `tests/orchestrators/plugin/operations.test.ts`. Neither changes.

From scripts/notify-corpus.mjs (exports used for the splice; importing the module does not run `main`):
- `parseCorpus(text)` turns JSONL text into entries `{ file, message, severity, argc }`.
- `serializeCorpus(entries)` produces one ASCII-only JSON line per entry, sorted by file and then by entry key. This is the exact form `baseline.jsonl` is written in.
- `capture --out <file> --files <path>` writes one test file's entries. The capture hook records `file` relative to the repo root, the same key the baseline uses.
- `check` captures both suites and diffs them against the baseline. It prints `Notify corpus check passed: <N> baseline entries present, <X> extra.` on success.
- `meta.json` holds `nodeVersion` v26.10.0, `capturedAt` 2026-10-02T02:57:59.708Z, `entries` 3133, `files` 76, `argcOne` 1659, `argcTwo` 1474. Only the `baseline` verb writes it.
</interfaces>

Planning findings, each verified at 6394ac1c:

- The catalog fixture's fixed name (`tests/architecture/catalog-uat/fixtures/plugin-prune.ts`) is a literal `Error` message built by hand. It never runs the prune orchestrator, so there is no mechanism to reuse. The plan reuses only its name, `prune-backup-ABC123`, so both corpus sources name the same directory.
- `baseline.jsonl` holds 11 `prune-backup-` names. 8 are random, on lines 1991-1998, all in `tests/orchestrators/plugin/prune.test.ts`. 3 are the fixed `ABC123`, in `tests/architecture/catalog-uat/catalog-contract.test.ts`. prune.test.ts owns 37 entries in total.
- These 8 prune.test.ts cases emit a backup name: "a failed state save retains a missing skill directory and restores state", "a save that writes then rejects restores state and retains the skill backup", "a failed save removes newly created state and retains the skill backup", "an occupied restore target reports rollback partial and retains the backup", "a missing skill directory reports manual recovery and restores state", "a concurrent MCP edit survives failed save with its original in recovery backup", "an MCP edit after a cascade with no MCP resources survives failed persistence", and "rollback details survive a simultaneous lock-release failure". Every prune.test.ts case that calls prune twice does so in a scope with no retained backup, so a fixed name never collides.
- Each prune-rollback.test.ts case prepares exactly one backup in its own hermetic scope, so a fixed name never collides there either.
- `edge/handlers/plugin/prune.ts`, `tests/edge/handlers/plugin/prune.test.ts`, and `tests/orchestrators/plugin/operations.test.ts` need no change. The handler test reaches only empty sweeps. The two composed prune cases in the operations test succeed, so the real binding creates the backup and discards it, and no name reaches a message.
- A random name cannot be asserted in prune.test.ts or operations.test.ts: any notification that names a directory made by `mkdtemp` re-enters the corpus with a random suffix. prune-rollback.test.ts emits no notifications, so the readdir/regex proof of the real `mkdtemp` wiring moves there.
- `scripts/check-changed.mjs` exempts only Markdown under `.planning/`. A commit that touches `baseline.jsonl` therefore takes the pre-commit `npm-check-changed` hook into its full fallback: `npm run check` plus `npm run test:coverage:direct:all`. The pre-commit rule mandates that run. Task 3 lets it run and records it.
- No git pre-commit hook is installed in this checkout (`.git/hooks` has only `pre-commit.sample`). Run pre-commit by hand before every commit.
- The repo-root `tmp/` directory is gitignored (`.gitignore` `/tmp/`). Scratch files under `tmp/notify-corpus/` are invisible to `check:changed` and are never committed.
- Node is v26.10.0, which matches `meta.json`. `scripts/check-unused-type-members.contracts.json` pins nothing in the three production files, so no line:col pin should move. Run the gate anyway.
- `typeof mkdtemp` assigns to `(prefix: string) => Promise<string>` under the installed `@types/node`, because its first overload returns `Promise<string>`. A scratch `tsc --strict --exactOptionalPropertyTypes` probe passed.
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Inject the backup-root creator end to end and prove one rollback message names it exactly</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts, extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts, extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts, tests/orchestrators/plugin/prune-rollback.test.ts, tests/orchestrators/plugin/prune.test.ts</files>
  <read_first>extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts, extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts, extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts, tests/orchestrators/plugin/prune-rollback.test.ts, tests/orchestrators/plugin/prune.test.ts (lines 1-40 and 640-690), skills/typescript-unit-testing/SKILL.md, skills/typescript-comments/SKILL.md</read_first>
  <behavior>
    - prune-rollback.test.ts, "retained backup maps two skills to their exact recovery targets", with the deterministic stub: `rollback.backupName` equals `prune-backup-ABC123`. The manifest and both skill backups are read from `<extensionRoot>/prune-backup-ABC123`. This is red before the production change, because the name is random.
    - prune-rollback.test.ts, new case, with Node's `mkdtemp` and `rm` passed as the backup operations: `rollback.backupName` is `prune-backup-` followed by exactly six ASCII letters or digits, and the extension root's only `prune-backup-` entry is that name.
    - prune.test.ts, "a failed state save retains a missing skill directory and restores state": the notification names `prune-backup-ABC123` exactly, and the skill backup is read from `<extensionRoot>/prune-backup-ABC123/0/SKILL.md`. This is red before the production change.
    - Every other prune-rollback, prune, and operations case keeps passing, with its assertions unchanged.
  </behavior>
  <action>
Red first: add the test changes below before the production change, run the two owner suites, and see the two exact-name assertions fail on a random name. Then make the production change.

Production, `extensions/pi-claude-marketplace/orchestrators/plugin/prune-rollback.ts`:
- Add a required member `createBackupRoot`, typed `(prefix: string) => Promise<string>`, as the first member of `PruneRestoreOps`. Give it a one-line JSDoc that states its contract: it creates a new directory whose path is the prefix plus a unique suffix, as `mkdtemp` does, and returns that path.
- Rewrite the interface JSDoc so it covers backup creation and removal and says the optional members fault the restore steps. Use present tense and no history (skills/typescript-comments).
- In `preparePruneRollback`, create the backup root by calling `ops.createBackupRoot` with the same prefix the function builds now: the extension root joined with `"prune-backup-"`. Change nothing else. The manifest, `backupName`, and the cleanup on a failed snapshot stay as they are.
- Keep the `mkdtemp` import. `restoreArtifact` still uses it for its `.prune-restore-` staging directory, which never reaches a message and is out of scope.

Production, `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts`:
- `createPrunePlugin` takes a fourth required parameter, `restoreOps: PruneRestoreOps`. Add `PruneRestoreOps` to the existing type import of `PruneRestoreFailure` from `./prune-rollback.ts`.
- Pass `restoreOps` to `preparePruneRollback` in place of the inline object.
- Remove the `node:fs/promises` import this change leaves unused, together with its now-empty import group.
- Extend the factory JSDoc to say it also binds the backup operations its rollback snapshot uses.
- Use a fourth positional parameter, not an options object. That keeps the sibling factory shape: every parameter is a required collaborator.

Production, `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts` (the composition owner):
- Add `mkdtemp` and `rm` to the existing `node:fs/promises` import. Type-import `PruneRestoreOps` from `./prune-rollback.ts`.
- Declare a module-private constant `NODE_PRUNE_RESTORE_OPS: PruneRestoreOps` with `createBackupRoot: mkdtemp` and `removeBackup: rm`, directly above `createPruneOperation`. Bind the bare functions, with no wrapper, so production keeps the same prefix and the same uniqueness.
- Above the constant, add a `//` note in the style of the `NODE_FETCH_STATUS` note. It says this is the one concrete binding of the prune backup operations, that `mkdtemp` appends six random characters to the prefix `preparePruneRollback` passes so every sweep gets its own backup directory under the scope's extension root, and that `rm` removes it.
- `createPruneOperation` passes `NODE_PRUNE_RESTORE_OPS` as the fourth argument to `createPrunePlugin`. Its own signature does not change, so `edge/handlers/plugin/prune.ts` and `edge/register.ts` are not touched. Update its JSDoc to name the Node-backed backup operations.

Tests, `tests/orchestrators/plugin/prune-rollback.test.ts`:
- Add a module-scope stateless stub named `restoreOps`, checked with `satisfies PruneRestoreOps` (type-import the interface).
  - Its `createBackupRoot` appends `ABC123` to the prefix, creates that directory with a non-recursive `mkdir`, and returns its path. A non-recursive `mkdir` fails as `mkdtemp` does when the parent is missing or the name exists.
  - Its `removeBackup` is `rm`.
  - Add one `//` line explaining that it mirrors `mkdtemp` with a fixed suffix, so a retained backup has a known name. The name matches the catalog fixture's.
- Every `preparePruneRollback` call passes the stub:
  - A bare object whose only member is `removeBackup: rm` becomes `restoreOps`.
  - An object that adds `link`, `inspectBackup`, or `afterMetadataRead`, including the `ops` constant in "MCP edit during rollback observation remains current with recovery backup", or that replaces `removeBackup`, spreads `restoreOps` first and keeps its own members.
- In "retained backup maps two skills to their exact recovery targets", drop the readdir lookup of the backup name. Assert that `rollback.backupName` equals `prune-backup-ABC123`, and read the manifest and both skill backups under that literal directory.
- Add one case whose title states the behavior, for example "names the backup root with Node's mkdtemp under the extension root".
  - Pass Node's `mkdtemp` (import it) and `rm` as the backup operations.
  - Assert `rollback.backupName` with an anchored regex: `prune-backup-` followed by exactly six ASCII letters or digits.
  - Assert that the extension root's `prune-backup-` entries equal `[rollback.backupName]`.
  - Mark the phases with `// arrange`, `// act`, and `// assert`.
  - This is the kept readdir/regex proof of the real `mkdtemp` wiring. It lives in this file because the file emits no notifications.
- Leave the other readdir assertions unchanged. The `[]`, length-1, and `[rollback.backupName]` checks prove removal or retention, and the fixed name does not change that.

Tests, `tests/orchestrators/plugin/prune.test.ts`:
- Add the same `restoreOps` module-scope stub, with a type import of `PruneRestoreOps` and the same comment.
- Pass the stub as the fourth argument in the `prune()` helper and in the `pruneWithRoutes` call.
- Convert "a failed state save retains a missing skill directory and restores state":
  - Drop its readdir lookup and the `assert.ok` that guards it.
  - Read the skill backup at `<extensionRoot>/prune-backup-ABC123/0/SKILL.md`.
  - Spell `prune-backup-ABC123` literally in the expected message. A template literal left with no interpolation becomes a double-quoted string, like the lines around it.
- Leave the other seven rollback cases for Task 2. They still read the name from disk and keep passing with the stub.

Gates and commit:
- Do not run `npm run check`. The orchestrator runs the full check.
- After `<verify>` passes, preview the selection with `npm run check:changed -- --list`. Expect scope "focused".
- Run `npx fallow audit --format json --quiet --explain --gate-marker agent`. The verdict must not be fail.
- Run `SKIP=trufflehog pre-commit run --files` on the five files. If a hook rewrites a file, inspect the diff, re-stage the same explicit paths, and re-run until clean. Never use `git add -A`, `--no-verify`, or a SKIP other than trufflehog.
- Write the message to `tmp/commit-msg.txt` and run `SKIP=trufflehog git commit -F tmp/commit-msg.txt`. In zsh, backticks inside a `-m` string execute.
- Title: `refactor(prune): inject the backup directory creator`.
- Body lines are at most 80 characters. They cite the user decision (deterministic tests, no normalizer). They contain no GSD phase or plan numbers. End the message with the session's attribution trailers.
  </action>
  <verify>
    <automated>node --test tests/orchestrators/plugin/prune-rollback.test.ts tests/orchestrators/plugin/prune.test.ts tests/orchestrators/plugin/operations.test.ts && npm run typecheck && node scripts/check-unused-type-members.mjs --root . && grep -q 'createBackupRoot: mkdtemp' extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts && git diff --quiet 6394ac1c -- extensions/pi-claude-marketplace/edge tests/edge tests/orchestrators/plugin/operations.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `PruneRestoreOps` declares `createBackupRoot`, and `preparePruneRollback` reads it, so the type-member gate passes with no contract-pin change.
    - `operations.ts` holds exactly one binding, `createBackupRoot: mkdtemp`, and passes `NODE_PRUNE_RESTORE_OPS` to `createPrunePlugin`. The edge handlers, the edge tests, and operations.test.ts are unchanged from 6394ac1c.
    - prune.ts no longer imports from `node:fs/promises`. Typecheck and ESLint report no unused import.
    - The new Node-mkdtemp case and the exact-name case in prune-rollback.test.ts pass, and so does the converted prune.test.ts case.
    - The pre-commit run passes in focused scope: direct coverage is 100% for the prune-rollback, prune, and operations pairs, `npm run fallow` reports no dupes, dead-code, health, or private-type-leak finding, and corresponding tests and consumer tests pass. The fallow audit verdict is not fail.
    - One new commit on `features/json` has a Conventional Commits title of 72 characters or fewer.
  </acceptance_criteria>
  <done>Prune creates its backup root through the injected `createBackupRoot`. Production binds Node's `mkdtemp` and `rm` once in operations.ts. Both test files inject a deterministic `prune-backup-ABC123` creator. One prune message and one rollback case assert the exact name, and a rollback case proves that Node's `mkdtemp` yields a `prune-backup-` directory under the extension root. The change is committed, with the focused pre-commit run passing.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Name the fixed backup directory in the remaining seven prune rollback cases</name>
  <files>tests/orchestrators/plugin/prune.test.ts</files>
  <read_first>tests/orchestrators/plugin/prune.test.ts (lines 320-360, 688-1100)</read_first>
  <behavior>
    - Each of the seven cases below expects `prune-backup-ABC123` by its exact name in its expected message, or reads its backup at that literal directory, or both. None looks the name up with readdir.
    - The two cases that assert no backup exists still assert an empty `prune-backup-` listing: "actual prune with a missing state skips snapshot and save" and "a failed save without directory artifacts completes rollback".
  </behavior>
  <action>
Make these edits in `tests/orchestrators/plugin/prune.test.ts` only. In each case, drop the readdir lookup of the backup name and the `assert.ok` or prefix-regex check that guards it. Read every backup file (the manifest, numbered entries, and `0/SKILL.md`) under `<extensionRoot>/prune-backup-ABC123`. Spell the name literally in the expected message, and turn a template literal left with no interpolation into a double-quoted string.
- "a save that writes then rejects restores state and retains the skill backup"
- "a failed save removes newly created state and retains the skill backup"
- "an occupied restore target reports rollback partial and retains the backup". Its prefix regex on the readdir name goes. Against the stub it proves nothing, and the Node-mkdtemp proof now lives in prune-rollback.test.ts.
- "a missing skill directory reports manual recovery and restores state". Build its `backupRoot` from the literal directory.
- "a concurrent MCP edit survives failed save with its original in recovery backup". Remove its prefix regex the same way.
- "an MCP edit after a cascade with no MCP resources survives failed persistence". Read the manifest and its mcp backup entry under the literal directory. Keep its other assertions.
- "rollback details survive a simultaneous lock-release failure". Replace its wildcard backup-name match with an exact check that the message contains `Inspect prune-backup-ABC123/manifest.json`. Keep its other assertions.

Leave the two empty-listing assertions in "actual prune with a missing state skips snapshot and save" and "a failed save without directory artifacts completes rollback". They prove that no backup exists, and the fixed name does not change that.

Change nothing else: no other case, no phase comments, no assertion other than the lookups named here. The `readdir` import stays, because those two cases use it.

Gates and commit:
- After `<verify>` passes, run the fallow audit and `SKIP=trufflehog pre-commit run --files tests/orchestrators/plugin/prune.test.ts`. The run should be focused on the prune pair, with direct coverage at 100%.
- Commit with `SKIP=trufflehog git commit -F tmp/commit-msg.txt`, titled `test(prune): name the fixed backup directory in rollback cases`. Follow the same message rules as Task 1.
  </action>
  <verify>
    <automated>node --test tests/orchestrators/plugin/prune.test.ts && grep -q 'startsWith("prune-backup-")' tests/orchestrators/plugin/prune.test.ts && ! grep -n 'const \[backupName\]' tests/orchestrators/plugin/prune.test.ts && ! grep -n 'prune-backup-\[' tests/orchestrators/plugin/prune.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - No readdir lookup of the backup name remains in prune.test.ts. The only `prune-backup-` readdir filters left are the two in the empty-listing cases (check with `grep -n`). No wildcard backup-name regex remains in the file.
    - All eight rollback-failure cases name `prune-backup-ABC123` exactly, and prune.test.ts passes.
    - The focused pre-commit run passes, with 100% direct coverage for the prune pair. The fallow audit verdict is not fail. One new commit exists.
  </acceptance_criteria>
  <done>Every rollback-failure message prune.test.ts emits names the fixed backup directory, and its expected values never read the name back from disk. Committed.</done>
</task>

<task type="auto">
  <name>Task 3: Re-capture prune.test.ts's corpus entries and prove the corpus gate passes</name>
  <files>.planning/phases/01-presentation-model/notify-corpus/baseline.jsonl</files>
  <read_first>scripts/notify-corpus.mjs, .planning/phases/01-presentation-model/notify-corpus/meta.json</read_first>
  <precondition>`node --version` reports major 26, the major `meta.json` records (v26.10.0). Corpus messages embed Node's own error text, so another major would move unrelated entries.</precondition>
  <action>
Work in this order. Keep every scratch file under `tmp/notify-corpus/`, which is gitignored and never committed. Do not run the `baseline` verb: it re-captures every file and rewrites `meta.json`. Do not change any file under `scripts/`. The user rejected a corpus normalizer.

1. Determinism. Capture the prune suite twice:
   - `node scripts/notify-corpus.mjs capture --out tmp/notify-corpus/prune-a.jsonl --files tests/orchestrators/plugin/prune.test.ts`
   - the same command with `--out tmp/notify-corpus/prune-b.jsonl`

   Each file must hold 37 lines, and the two files must be byte-identical. The only backup name in them must be `prune-backup-ABC123`. If the line count is not 37, stop: a case gained or lost a notification.
2. Splice. Write a throwaway ESM script under `tmp/notify-corpus/` that imports `parseCorpus` and `serializeCorpus` from `scripts/notify-corpus.mjs`. The script parses `baseline.jsonl`, drops every entry whose `file` is `tests/orchestrators/plugin/prune.test.ts`, adds the 37 entries parsed from `prune-a.jsonl`, and writes `serializeCorpus` of the result back to `baseline.jsonl`. Do not edit lines by hand.
3. Isolation. Run the corpus half of `<verify>`. It proves four things against 6394ac1c, where the baseline is unchanged since 0a05d28d:
   - Every line that is not a prune.test.ts line is byte-identical.
   - The prune.test.ts lines equal the old lines with only each six-character backup suffix replaced by `ABC123`. Severity, argc, and all other text are unchanged.
   - `git diff --numstat` reports 8 insertions and 8 deletions.
   - `prune-backup-ABC123` is the only backup name left anywhere in the corpus.

   If any check fails, stop. Something other than the suffix changed.
4. `meta.json` stays untouched. Step 3 proves that every non-prune line is unchanged, that each prune line keeps its severity and argc, and that the prune count stays 37. So `entries`, `files`, `argcOne`, and `argcTwo` (3133, 76, 1659, 1474) still describe the baseline. `capturedAt` and `nodeVersion` describe the last full `baseline` run, and this splice does not replace that run.
5. Full corpus check. Run `node scripts/notify-corpus.mjs check` detached, in the background, because it runs both suites under the hook and can exceed the 10-minute foreground limit. Redirect stdout and stderr to `tmp/notify-corpus/check.log`, then append a `CHECK_EXIT=<status>` line taken from the command's own exit status. Never pipe the command.

   The check passes when the log shows `CHECK_EXIT=0` and the line `Notify corpus check passed: 3133 baseline entries present, 0 extra.`, and no `missing in` or `extra in` line.
   - If the run aborts because a test failed, re-run once (runner flakes are known). If the same test also fails on 6394ac1c, stop and report it as pre-existing. Do not commit.
   - If the check reports a pair in another file that differs only by a `prune-backup-` suffix, treat that file the same way: give its test a deterministic creator, re-capture with `--files`, and splice. Record it in the SUMMARY. The plan-time evidence says no such file exists.
6. Commit.
   - Run `npm run check:changed -- --list`. Expect scope "full" with reason "Shared, removed, configuration, or unclassified inputs": the selector exempts only Markdown under `.planning/`.
   - Run the fallow audit.
   - Run `SKIP=trufflehog pre-commit run --files .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl` in the background, logging to `tmp/notify-corpus/precommit.log` with a `PRECOMMIT_EXIT=<status>` line. Its `npm-check-changed` hook runs `npm run check` and `npm run test:coverage:direct:all`, as the pre-commit rule requires. Let it finish. Never SKIP `npm-check-changed`, never use `--no-verify`, and do not run `npm run check` separately.
   - Commit with `SKIP=trufflehog git commit -F tmp/commit-msg.txt`, titled `test(notify): re-capture the prune corpus entries`. The body says that 8 prune.test.ts entries change only their backup suffix, that this follows the user's decision (deterministic tests, no normalizer), and that `meta.json` is unchanged.
  </action>
  <verify>
    <automated>B=.planning/phases/01-presentation-model/notify-corpus/baseline.jsonl; P='"file":"tests/orchestrators/plugin/prune.test.ts"'; O=tmp/notify-corpus/baseline-6394ac1c.jsonl; git show 6394ac1c:$B > $O && N=$(git diff --numstat 6394ac1c -- $B) && cmp tmp/notify-corpus/prune-a.jsonl tmp/notify-corpus/prune-b.jsonl && test "$(wc -l < tmp/notify-corpus/prune-a.jsonl)" -eq 37 && cmp <(grep -vF "$P" $O) <(grep -vF "$P" $B) && diff <(grep -F "$P" $O | sed -E 's/prune-backup-[A-Za-z0-9]{6}/prune-backup-ABC123/g' | sort) <(grep -F "$P" $B | sort) && test "$(printf '%s' "$N" | cut -f1,2)" = "$(printf '8\t8')" && test "$(grep -oE 'prune-backup-[A-Za-z0-9]+' $B | sort -u)" = prune-backup-ABC123 && git diff --quiet 6394ac1c -- scripts .planning/phases/01-presentation-model/notify-corpus/meta.json && grep -qx 'CHECK_EXIT=0' tmp/notify-corpus/check.log && grep -qF 'Notify corpus check passed: 3133 baseline entries present, 0 extra.' tmp/notify-corpus/check.log</automated>
  </verify>
  <acceptance_criteria>
    - Two prune.test.ts captures are byte-identical and hold 37 lines each.
    - Compared with 6394ac1c, `baseline.jsonl` changes exactly 8 lines, all prune.test.ts entries, each only in its backup suffix. Every other file's entries are byte-identical, and `meta.json` and `scripts/` are unchanged.
    - `node scripts/notify-corpus.mjs check` exits 0 with 3133 baseline entries present and 0 extra.
    - The broadened pre-commit run (`npm run check` and `npm run test:coverage:direct:all`) exits 0, and the fallow audit verdict is not fail. One new commit contains only `baseline.jsonl`.
  </acceptance_criteria>
  <done>The baseline holds reproducible prune.test.ts entries. The full corpus check passes with zero missing and zero extras, and the change is committed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| prune orchestrator to `<scopeRoot>/pi-claude-marketplace/` | Prune creates the backup root, fills it, and deletes it recursively. That directory is the NFR-10 containment root. |
| test suites to the committed corpus baseline | The baseline is the TEXT-01 gate input. A splice made by hand could hide unrelated output drift. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-261002-dys-01 | Tampering / Elevation of privilege | `PruneRestoreOps.createBackupRoot`, whose returned root `removeBackup` deletes recursively | medium | mitigate | `preparePruneRollback` still computes the prefix from `locations.extensionRoot`, a `ScopedLocations` path. The only production binding is the bare Node `mkdtemp`, in the module-private `NODE_PRUNE_RESTORE_OPS` in operations.ts. `createPruneOperation` keeps its signature, so the command edge cannot supply a creator. The new prune-rollback.test.ts case proves that Node's `mkdtemp` places the prefixed root under the extension root. |
| T-261002-dys-02 | Information disclosure | rollback-partial notification that names the backup directory | low | accept | The text shape is unchanged: it shows the basename only, relative to "this scope's pi-claude-marketplace directory". The production suffix stays random. Causes still pass through `redactCauseChain`. |
| T-261002-dys-03 | Tampering | `baseline.jsonl` splice | medium | mitigate | The splice goes through `parseCorpus`/`serializeCorpus` only. `cmp` proves the non-prune lines are identical to 6394ac1c, and the normalized diff proves the prune lines changed only in the suffix. numstat shows 8/8, `meta.json` and `scripts/` are unchanged, and the full corpus check reports 0 missing and 0 extra. |
| T-261002-dys-04 | Repudiation | commit gates for the corpus commit | low | mitigate | Pre-commit runs its full fallback. `npm-check-changed` is never skipped and `--no-verify` is never used. The SUMMARY records each command, exit status, commit, and Node version. |
| T-261002-dys-SC | Tampering | npm/pip/cargo installs | low | accept | No dependency is installed or changed. `package.json` and `package-lock.json` are untouched. |
</threat_model>

<verification>
- Owner suites pass: `node --test tests/orchestrators/plugin/prune-rollback.test.ts tests/orchestrators/plugin/prune.test.ts tests/orchestrators/plugin/operations.test.ts`.
- `npm run typecheck` and `node scripts/check-unused-type-members.mjs --root .` pass.
- The focused pre-commit runs pass for Tasks 1 and 2. They cover ESLint, `npm run fallow`, corresponding tests, 100% direct coverage for the changed pairs, and consumer tests.
- The full pre-commit run passes for Task 3 (`npm run check` and `npm run test:coverage:direct:all`). The fallow audit verdict is not fail before each commit.
- The corpus is deterministic and isolated, and the full `node scripts/notify-corpus.mjs check` exits 0 with 0 extra (Task 3 `<verify>`).
- The edge handlers, edge tests, operations.test.ts, `scripts/`, and `meta.json` are unchanged from 6394ac1c.
</verification>

<success_criteria>
- Three commits on `features/json`. Each has a Conventional Commits title and no GSD phase or plan reference, and none is amended or rebased.
- `node scripts/notify-corpus.mjs check` exits 0, reporting 3133 baseline entries present and 0 extra.
- Production prune behavior is unchanged: Node's `mkdtemp` creates `prune-backup-XXXXXX` under the scope's extension root, and `rm` removes it.
- Every expected prune rollback message names `prune-backup-ABC123` exactly.
- No corpus normalizer exists.
</success_criteria>

<output>
Create `.planning/quick/261002-dys-make-prune-rollback-backup-naming-determ/261002-dys-SUMMARY.md` with `status: complete` in its frontmatter. Do not commit it, and do not edit STATE.md or ROADMAP.md: the orchestrator's docs commit owns them. Include:

- The three commit SHAs and what each changed.
- A corpus record of every changed entry. List each of the 8 by test title, severity, and argc, with its old random suffix and the new `prune-backup-ABC123`, and note any entries that become identical. Add the 16 raw lines (8 removed, 8 added) from `git diff 6394ac1c -- .planning/phases/01-presentation-model/notify-corpus/baseline.jsonl` in a fenced block.
- Proof that no other file's entries changed, and that no other test file emits a random backup name: the `cmp` result, the only-fixed-name grep, and the full check line.
- Why `meta.json` is unchanged, with the four recomputed counts.
- Verification evidence: each command, its exit status, the commit, the Node version, and the scope. Tasks 1 and 2 were focused. Task 3's pre-commit run broadened to the full check, so the orchestrator can decide whether to reuse it under the unchanged-input rule in skills/local-verification.
- Notes for the orchestrator. The STATE.md item "Carried concern -- corpus nondeterminism" and the matching Operator Next Steps bullet are now resolved. ROADMAP's milestone-invariant paragraph counts the approved corpus changes (29), and the operator decides whether to record this 8-entry re-capture there, as was done for CR-01.
- A `## Threat Flags` section, as AGENTS.md requires. Write "None" if no surface outside this plan's `<threat_model>` was introduced.
</output>
