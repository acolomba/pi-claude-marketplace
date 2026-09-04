---
phase: 103-workflow-artifact-materialization
reviewed: 2026-08-15T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - docs/output-catalog.md
  - eslint.config.js
  - .prettierignore
  - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
  - extensions/pi-claude-marketplace/bridges/workflows/index.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/bridges/workflows/unstage.ts
  - extensions/pi-claude-marketplace/domain/workflow-project-key.ts
  - extensions/pi-claude-marketplace/domain/workflow-script.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/platform/workflow-home.ts
  - tests/bridges/_fixtures/workflows-plugin/.claude-plugin/plugin.json
  - tests/bridges/_fixtures/workflows-plugin/workflows/broken.js
  - tests/bridges/_fixtures/workflows-plugin/workflows/drafter.workflow.js
  - tests/bridges/_fixtures/workflows-plugin/workflows/helpers.js
  - tests/bridges/_fixtures/workflows-plugin/workflows/stamped.workflow.js
  - tests/bridges/workflows/discover.test.ts
  - tests/bridges/workflows/paths.test.ts
  - tests/bridges/workflows/stage.test.ts
  - tests/bridges/workflows/unstage.test.ts
  - tests/domain/workflow-project-key.test.ts
  - tests/live-uat/README.md
  - tests/live-uat/workflow-storage-canary.mjs
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-workflows.test.ts
  - tests/persistence/locations.test.ts
  - tests/persistence/migrate.test.ts
  - tests/platform/workflow-home.test.ts
findings:
  critical: 5
  warning: 11
  info: 0
  total: 16
status: resolved
---

# Phase 103: Code Review Report

**Reviewed:** 2026-08-15
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

The bridge is well constructed on the axes the brief called out as highest risk, and
those checks came back clean:

- `assertNoWorkflowNameCollisions` is genuinely reachable — `prepareStageWorkflows`
  (`stage.ts:130`) runs it over the full verdict array before the first-wins dedup at
  `stage.ts:138-147`, and no name dedup exists upstream of it. The only upstream dedup is
  by resolved absolute path (`discover.ts:208-212`), which is not a name rule.
- `workflowProjectKey` is byte-faithful to the transcribed engine source, and
  `tests/domain/workflow-project-key.test.ts` pins it with measured literals rather than
  re-derivations — no tautology. The 48-char-slice-after-dash-strip ordering and the
  `resolve()`-before-`basename()` ordering are both witnessed.
- The write-side containment chokepoint holds: `workflowArtifactPath`
  (`locations.ts:362-378`) runs `assertSafeName` (which rejects `/`, `\`, `.`, `..` and
  every control char including NUL) before `path.join`, then `assertPathInside`. The
  bridge never composes a target path itself. `tsc --noEmit` is clean.
- The envelope construction cannot be broken by script contents: `JSON.stringify` handles
  every byte sequence the reader can produce, and key order is fixed by literal order.

The defects are concentrated elsewhere, in two clusters.

**Cluster 1 — the artifact has no removal path.** `cascadeUnstagePlugin`
(`orchestrators/marketplace/shared.ts:334`) is the single removal primitive behind
`uninstall`, `disable` and `marketplace remove`, and it never calls
`unstagePluginWorkflows`. `update` never re-stages. The state field this phase added is
therefore write-only in production: nothing reads `resources.workflows` except the
reinstall carry-forward. Because these artifacts sit outside every scope root — which the
code's own comments repeatedly say is why the record is the only thing that knows they
exist — the consequence is permanent, unrecoverable orphaning of third-party executable
code registered with the host engine.

**Cluster 2 — the one live rollback path is a no-op in the case it exists for.** The
install ledger's workflows phase assigns `stagedWorkflowNames` *after* the commit
(`install.ts:1169`), so a commit throw leaves the undo with an empty removal list. The
sibling skills/commands phases deliberately assign before commit for exactly this reason.

A separate read-side containment regression appears on the `info` surface: the
`unavailable` arm now feeds unvalidated manifest paths into a discovery pass that reads
and parses file bodies.

## Structural Findings (fallow)

No structural pre-pass was supplied with this review.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: install undo removes nothing when the workflows commit throws

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1160-1193`

**Issue:** The workflows phase assigns the removal list *after* the commit:

```ts
c.workflowsPrep = prep;                              // 1167
const leak = await commitPreparedWorkflows(prep);    // 1168  <-- can throw
c.stagedWorkflowNames = prep.result.stagedNames;     // 1169  <-- never runs on throw
```

When `commitPreparedWorkflows` throws, `runPhases` invokes the failing phase's own `undo`
first (`transaction/phase-ledger.ts:105-129`, TR-02). That undo's gate
(`c.workflowsPrep === undefined`) passes — but its *payload*
(`previousWorkflowNames: c.stagedWorkflowNames`) is still the initial `[]` from
`install.ts:932`, so `unstagePluginWorkflows` iterates an empty list and removes nothing.

The gate was moved before the commit and documented as such; the data it gates on was
not. Compare `skillsPhase` (`install.ts:955-957`), whose comment states the contract this
phase breaks: *"Set before commit so undo can remove any dirs that were placed if commit
fails mid-loop."*

This is reachable: `commitPreparedWorkflows` renames per file and, on a mid-sequence
failure, reverses the completed renames. Any reverse-rename that itself fails
(`stage.ts:253-261`) leaves a committed envelope at its target, and the ledger undo — by
the phase's own comment at `install.ts:1154-1156`, "the only thing that removes them" —
then does nothing. The record is never written (the ledger failed), so the leaked file's
name is not recoverable from state either.

**Fix:**

```ts
    do: async (c) => {
      const prep = await prepareStageWorkflows({
        locations: c.locations,
        pluginName: c.plugin,
        resolved: c.resolved,
      });
      c.workflowsPrep = prep;
      // Set BEFORE the commit, matching the skills/commands phases: a partial
      // rename sequence leaves committed envelopes the undo must still remove.
      c.stagedWorkflowNames = prep.result.stagedNames;
      const leak = await commitPreparedWorkflows(prep);
      c.bridgeWarnings.push(...prep.result.warnings);

      if (leak !== undefined) {
        c.bridgeWarnings.push(leak);
      }
    },
```

---

### CR-02: uninstall, disable and marketplace remove never remove workflow envelopes

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:334-400`
(also `orchestrators/plugin/uninstall.ts:55`,
`orchestrators/plugin/enable-disable.ts:336`, `orchestrators/marketplace/remove.ts:638`)

**Issue:** `cascadeUnstagePlugin` is the sole removal primitive shared by all three verbs.
It imports and calls `unstagePluginSkills`, `unstagePluginCommands`,
`unstagePluginAgents`, `removeHookConfig` and `unstageMcpServers` — and nothing from
`bridges/workflows/`. `grep -rni workflow` over
`orchestrators/{plugin/uninstall.ts,plugin/enable-disable.ts,marketplace/}` returns zero
hits.

Three distinct failures follow:

1. **`uninstall` orphans permanently.** The envelopes stay in `~/.pi/workflows/saved/`
   (or `projects/<key>/saved/`) while `removePluginRecord` deletes the state record that
   held `resources.workflows` — the only inventory of those names. After uninstall the
   extension cannot ever name, find or remove them: they are outside every scope root, so
   no scope-root sweep reaches them, and the engine keeps registering them as live
   commands. `marketplace remove --cascade` multiplies this by every plugin in the
   marketplace.
2. **`disable` does not disable.** `runDisableBranch` cascades the other five kinds and
   preserves `resources` (ENBL-18), so a disabled plugin's workflow commands remain
   registered and runnable. `/claude:plugin disable` silently fails to stop one of the six
   component kinds, and it is the one that executes arbitrary code.
3. **`enable` cannot converge.** `runInstallLedger`'s workflows phase never passes
   `previousWorkflowNames` (see WR-01), so a re-materialization that produces a different
   generated name leaves the old envelope behind while overwriting the record.

Note this is not an oversight the code acknowledges: `reinstall.ts:1740-1747` carries an
explicit comment justifying its deliberate no-op, and no comparable note exists at any of
the three removal sites.

**Fix:** Add the sixth unstage to the cascade primitive so all three verbs inherit it:

```ts
// orchestrators/marketplace/shared.ts
import { unstagePluginWorkflows } from "../../bridges/workflows/index.ts";
// ...inside cascadeUnstagePlugin, alongside the other five:
const workflowsResult = await unstagePluginWorkflows({
  locations,
  previousWorkflowNames: installedPlugin.resources.workflows,
});
```

and thread the result through the same removed-names / warnings accumulation the other
five use. If lifecycle removal is genuinely deferred to a later phase, that deferral must
at minimum be recorded at the three call sites and carried in a phase CONTEXT, not left
implicit.

---

### CR-03: `update` never re-stages workflows, so the installed script bytes go stale

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1725-1750`

**Issue:** The update ledger reassigns each inventory in place
(`sRecord.resources.skills`, `.prompts`, `.agents`, `.mcpServers`, `.hooks`) and never
touches `.workflows`, and no update code path calls `prepareStageWorkflows`. After
`/claude:plugin update`, five of six component kinds reflect the new version while the
workflow envelopes still hold the *previous* version's script bytes.

Consequences: a workflow bug fix or security fix shipped by a plugin author can never be
delivered through `update`; a workflow removed upstream keeps running; a workflow renamed
upstream produces a live command under the old name plus a record that still claims it.
Because the envelope is executable code copied verbatim, "stale" here means the user keeps
running code the plugin author already withdrew, with no signal that anything diverged.

**Fix:** Add a workflows replacement step to the update ledger, passing the recorded
inventory as the previous-name list so renamed/removed workflows are cleaned:

```ts
const prep = await prepareStageWorkflows({
  locations,
  pluginName: plugin,
  resolved: installable,
  previousWorkflowNames: record.resources.workflows,
});
await commitPreparedWorkflows(prep);
sRecord.resources.workflows = [...prep.result.stagedNames];
```

(Note this exercises the currently-dead previous-name path — fix WR-02 first.)

---

### CR-04: `info` reads and discloses the contents of arbitrary files via unvalidated component paths

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:388-404`,
`1317-1338`, `1383-1396`

**Issue:** The `unavailable` resolver arm does not carry validated `componentPaths`, so
`buildNonInstallableRowFields` re-derives them with `deriveLenientComponentPaths(entry)`,
which copies raw manifest strings with only a `typeof d === "string"` filter — no
`path.isAbsolute` rejection, no `assertPathInside`, unlike
`domain/resolver.ts:845-863` which enforces both.

Before this phase those lenient paths reached only `discoverComponentNames`, which
enumerates directory entry *names*. They now reach `discoverWorkflowNames` →
`discoverPluginWorkflows`, which at `discover.ts:166-168` honors absolute paths outright
(`path.isAbsolute(workflowsRel) ? workflowsRel : ...`) and otherwise `path.resolve`s
against `pluginRoot` with no containment check — then **reads every `.js`/`.mjs`/`.cjs`
file body** in that directory (`discover.ts:217`), parses it, and renders the string
literal it finds at `meta.name` into the user-visible `workflows:` line
(`workflowDisplayName`, `info.ts:379-381`).

A marketplace entry of `{"name":"x","source":"...","workflows":"/etc"}` or
`{"workflows":"../../../../home/victim/notes"}` therefore turns `/claude:plugin info` — a
read-only, network-free inspection command a user runs precisely to *evaluate an untrusted
plugin before installing it* — into a file-content read of an attacker-chosen directory,
with the extracted strings echoed back to the terminal. It also causes untrusted
third-party JavaScript from outside the plugin root to be parsed.

This is an NFR-10 containment escape on the read side, and it is an escalation introduced
by this phase: the pre-existing lenient path leaked file *names*; it now leaks file
*contents*.

**Fix:** Validate the lenient paths before any of them is walked. Cheapest correct fix is
to filter in `deriveLenientComponentPaths`, so both the enumeration and the new discovery
inherit it:

```ts
for (const d of asDeclaredList((entry as Record<string, unknown>)[kind])) {
  if (typeof d !== "string" || path.isAbsolute(d) || out[kind].includes(d)) {
    continue;
  }
  // reject climbing spellings; the resolver's own gate is assertPathInside,
  // but this surface is sync -- a normalized-relative check is the equivalent.
  const normalized = path.normalize(d);
  if (normalized === ".." || normalized.startsWith(`..${path.sep}`)) {
    continue;
  }
  out[kind].push(d);
}
```

Additionally, drop the `path.isAbsolute(workflowsRel)` branch at `discover.ts:166-168`:
the resolver rejects absolute component paths outright, so that branch exists only to
serve callers that bypass validation.

---

### CR-05: `commitPreparedWorkflows` deletes previous targets with no backup and no restore

**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:226-267`

**Issue:** The commit removes every `_previousNames` target with a bare `unlink`
(226-236), *then* performs the renames (246-249). The rollback block (250-267) reverses
only the completed renames — it makes no attempt to restore the files it just unlinked,
and no copy of them was taken.

So on a mid-commit failure the saved directory is left with **neither** the previous
envelopes **nor** the new ones. Every sibling bridge avoids exactly this: skills, commands
and agents move previous content into a backup root and restore it via
`rollbackReplacementCommon` (`shared/fs-utils.ts:185-227`).

This is currently latent only because no production caller supplies
`previousWorkflowNames` (WR-01) — which means the defect will land the moment CR-02 or
CR-03 is fixed, in the exact commit that makes the path live.

**Fix:** Rename previous targets aside into `stagingRoot` instead of unlinking them,
record the moves, and restore them in the rollback block before cleanup:

```ts
const displaced: { from: string; to: string }[] = [];
for (const name of prepared._previousNames) {
  const target = await prepared.locations.workflowArtifactPath(name);
  const aside = path.join(prepared.stagingRoot, `.previous-${name}.json`);
  try {
    await rename(target, aside);
    displaced.push({ from: target, to: aside });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") { throw err; }
  }
}
// ...in the catch block, after reversing completedRenames:
for (const d of [...displaced].reverse()) {
  try { await rename(d.to, d.from); }
  catch (e) { rollbackLeaks.push(`failed to restore previous workflow ${d.from}: ${errorMessage(e)}`); }
}
```

Note the aside name must itself route through a containment check or use a name that
cannot collide with a live envelope.

---

## Warnings

### WR-01: `previousWorkflowNames` is a dead parameter; the whole re-stage branch is unreachable

**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:124`,
`types.ts:91`, `types.ts:116-118`

**Issue:** `grep -rn previousWorkflowNames extensions/` shows exactly one production call
site — `install.ts:1190`, which is the *unstage* input, not the stage input. No caller of
`prepareStageWorkflows` ever supplies it. Consequently `previousNames` is always `[]`,
which makes dead: the `previousNames.length === 0` clause of the noop guard (149), the
`_previousNames` field, and the entire previous-target removal loop in commit (226-236).
That dead loop is where CR-05 lives, and its absence is why enable cannot converge
(CR-02.3).

**Fix:** Wire the recorded inventory at the ledger. In `install.ts`'s workflows phase:

```ts
const previous = c.stateSnapshot.marketplaces[c.marketplace]?.plugins[c.plugin]
  ?.resources.workflows;
const prep = await prepareStageWorkflows({
  locations: c.locations,
  pluginName: c.plugin,
  resolved: c.resolved,
  ...(previous !== undefined && { previousWorkflowNames: previous }),
});
```

This is a no-op for a fresh install (no record) and closes the enable/re-materialize gap.

---

### WR-02: one file's `lstat` failure aborts the entire plugin install

**File:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:71-72`

**Issue:** `isWorkflowScriptFile` calls `await lstat(...)` with no try/catch. Any error —
ENOENT from a file removed between `readdir` and `lstat`, EACCES on a restricted entry,
EIO — propagates out of `scanWorkflowsDirectory`, out of `discoverPluginWorkflows`, and
fails the whole install.

This directly contradicts the module's stated discipline three lines of doc-comment away
(`discover.ts:135-137`): *"A read failure is a `warnings[]` entry naming the file, never a
throw — one unreadable script must not block the rest of the plugin."* The `readFile`
failure at 216-221 honors that; the `lstat` at 71 does not. The two IO calls sit on the
same file, one line apart in effect, with opposite failure policies.

**Fix:** Fold the `lstat` into the same soft-fail channel — return a discriminated result
so the caller can emit `readFailureWarning`:

```ts
async function isWorkflowScriptFile(dir: string, entry: Dirent):
  Promise<{ ok: true; admit: boolean } | { ok: false; reason: string }> {
  // ...cheap filters unchanged...
  try {
    const stat = await lstat(path.join(dir, entry.name));
    return { ok: true, admit: !stat.isSymbolicLink() };
  } catch (err) {
    return { ok: false, reason: errorMessage(err) };
  }
}
```

---

### WR-03: bare `catch {}` in `discoverWorkflowNames` swallows every error class

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:401-403`

**Issue:** The catch is untyped and unfiltered. Its doc comment (`info.ts:373-377`) claims
*"A genuine IO failure is NOT absorbed: the fallback re-reads the same directories and
rethrows, so an EACCES still reaches `narrowProbeError`"* — but that only holds for errors
raised by `readdir` on the *directory*. A per-file EACCES from the `lstat`/`readFile` pair
(WR-02) is absorbed here and the fallback's `readdir` then succeeds, so the failure is
silently converted into a stem-named row. `TypeError`s and other programming errors are
likewise swallowed.

This also violates `CONVENTIONS.md`'s error-handling rule: callers narrow on `instanceof`
and never catch broadly.

**Fix:** Catch only the intended class — the `assertSafeName` throw on an unsafe *plugin*
name, which is what the fallback exists for — and rethrow everything else:

```ts
} catch (err) {
  if ((err as NodeJS.ErrnoException).code !== undefined) {
    throw err; // a real IO failure must reach narrowProbeError
  }
  return await discoverComponentNames(pluginRoot, componentDirs, "workflows");
}
```

Better still: hoist the plugin-name assertion out of `admitWorkflowScript` into an
explicit pre-check at the two call sites, so `info` never needs a catch at all.

---

### WR-04: the staging-root containment check runs after `mkdir` and is tautological

**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:159-161`

**Issue:**

```ts
const stagingRoot = path.join(locations.workflowsStagingDir, randomUUID());
await mkdir(stagingRoot, { recursive: true });
await assertPathInside(locations.workflowsStagingDir, stagingRoot, "workflows staging root");
```

Two problems. First, ordering: the directory is created *before* the check, so if the
check ever fired, the write has already happened. Second, the check cannot fail: a
`randomUUID()` joined onto a fixed parent is contained by construction, and
`assertPathInside` starts the symlink walk *at* the parent (`path-safety.ts:87-93`, "the
boundary itself is trusted"), so a symlinked `workflowsStagingDir` is not detected — and
`mkdir` with `recursive: true` would already have followed it.

The check therefore costs an `lstat` and conveys a guarantee it does not provide, which is
worse than omitting it: a future reader will read it as covering the staging root.

**Fix:** Either drop it and note that containment is by construction (matching
`sourcesStagingDir`'s reasoning at `locations.ts:344-349`), or move it before the `mkdir`
and extend it to the staging root itself:

```ts
await assertPathInside(locations.workflowsHomeDir, locations.workflowsStagingDir,
  "workflows staging directory");
await mkdir(stagingRoot, { recursive: true });
```

---

### WR-05: the "byte-for-byte" contract does not survive a non-UTF-8 script

**File:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:217`,
`bridges/workflows/stage.ts:38-41`, `types.ts:80`

**Issue:** `stage.ts`'s header states the script bytes are *"copied verbatim — never
reformatted, transpiled, minified, re-encoded or line-ending-normalized"*, and `types.ts`
annotates the field *"The Claude source, byte-for-byte. Never transformed or
re-encoded."* But discovery reads with `readFile(full, "utf8")`, which decodes through
`Buffer.toString("utf8")` and replaces every invalid byte sequence with U+FFFD:

```
Buffer.from([0x65,0x78,0x70,0x6f,0x72,0x74,0xff,0xfe]).toString('utf8')
  === "export��"
```

A latin-1-encoded or otherwise non-UTF-8 workflow script is therefore silently corrupted
before the envelope is built — which the header names as the precise hazard ("any silent
edit changes what runs while still looking like a faithful copy"). CRLF and non-ASCII
identifiers are covered by `stage.test.ts:172-193`; invalid bytes are not tested.

**Fix:** Either narrow the claim in both comments to "the decoded UTF-8 text, verbatim",
or read as a Buffer and reject non-round-tripping input as a per-file `refused` verdict:

```ts
const buf = await readFile(full);
const source = buf.toString("utf8");
if (!Buffer.from(source, "utf8").equals(buf)) {
  warnings.push(readFailureWarning(entry.name, workflowsDir, "is not valid UTF-8"));
  continue;
}
```

---

### WR-06: workflow names are absent from the PI-6 cross-plugin conflict guard

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:868-890`

**Issue:** `generatedNames` carries only `skills`, `commands` and `agents`;
`assertNoCrossPluginConflicts` therefore never sees workflow names. The saved directory is
shared — `unstage.ts:6-10` says so explicitly: *"The saved directory IS shared — with the
user's own hand-saved workflows and with every other plugin"* — and the only protection
named is the `<plugin>:` prefix.

That prefix does not protect against the user's own saved workflows. A user who has saved
a workflow literally named `acme:ship` (nothing in the engine's name rule forbids the
colon) has it silently overwritten by `rename()` at `stage.ts:247`, with no
already-exists check and no warning. Once CR-02 is fixed, uninstalling `acme` will also
delete it.

**Fix:** At minimum, make the commit refuse to clobber an unowned target — check for an
existing target that is not in `_previousNames` before the rename and fail the phase, the
same ownership pre-check `shared/fs-utils.ts:82-99` documents as the PI-6 vector for the
other bridges.

---

### WR-07: a second process-lifetime mutable global lands in production code

**File:** `extensions/pi-claude-marketplace/platform/workflow-home.ts:22-32`

**Issue:** `let override: string | undefined` plus an exported
`setWorkflowHomeDirForTesting` is module-level mutable state shipped in the published
extension and callable at runtime by anything that imports `platform/workflow-home.ts`.
`ARCHITECTURE.md` states: *"Global state: None at the module level in
`extensions/pi-claude-marketplace/` proper; `shared/completion-cache.ts` holds a
process-lifetime cache explicitly invalidated by mutating orchestrators."* This adds a
second exception, and unlike the cache it is not invalidated by anything — a leaked
override silently redirects every subsequent workflow write.

The rationale in the header (env vars are process-global and suites run concurrently) is
sound, but `node --test` already runs each test *file* in its own process, so the
concurrency argument is weaker than stated.

**Fix:** If the seam stays, guard it so it cannot be armed outside a test run
(`if (process.env.NODE_ENV === "test")`, or gate on the presence of `node:test` in
`process.execArgv`), and update ARCHITECTURE.md's global-state clause to name it.

---

### WR-08: no test covers the commit rollback or the prepare-time cleanup path

**File:** `tests/bridges/workflows/stage.test.ts`

**Issue:** `stage.ts` carries two failure paths with non-trivial logic and neither is
exercised: the mid-sequence rename rollback with its `rollbackLeaks` accumulation
(`stage.ts:250-267`) and the `appendLeakToError(err, await cleanupStaging(...))` wrapper
on a write failure during prepare (`stage.ts:181-183`). The suite covers only happy paths
plus the noop arm. CR-01 and CR-05 both live in exactly the untested region — a rollback
test asserting "neither the old nor the new envelope survives" would have caught CR-05,
and a commit-throw test at the ledger level would have caught CR-01.

**Fix:** Add a case that makes the second rename fail (e.g. pre-create a directory at the
second target path) and assert both that the first envelope was reversed out of the saved
directory and that the staging tree was cleaned.

---

### WR-09: live-uat entry path uses `URL.pathname` instead of `fileURLToPath`

**File:** `tests/live-uat/workflow-storage-canary.mjs:488`

**Issue:** `const here = path.dirname(new URL(import.meta.url).pathname);` does not
percent-decode. A repository checked out under a path containing a space, `#` or any
non-ASCII character yields `%20`/`%23` in `here`, and every subsequent
`path.join(repoRoot, ...)` import fails with a misleading ENOENT. The file already imports
`pathToFileURL` from `node:url` and uses `fileURLToPath` correctly in
`tests/bridges/workflows/discover.test.ts:37`, so the correct idiom is in hand.

**Fix:** `const here = path.dirname(fileURLToPath(import.meta.url));` (add
`fileURLToPath` to the existing `node:url` import).

---

### WR-10: the live canary cannot observe the orphan it is best placed to catch

**File:** `tests/live-uat/workflow-storage-canary.mjs:472-485`

**Issue:** `teardown` runs `uninstall` for both plugins and then `rm -rf`s the sandbox
HOME — which contains the engine's storage root. Any envelope the uninstall failed to
remove (CR-02) is deleted by the teardown a moment later, so the canary passes. The
harness is the only automated surface that exercises the real engine's storage layout, and
it is structurally blind to the removal half of the lifecycle.

**Fix:** Assert emptiness between the uninstall and the `rm`:

```ts
await ext.quiet(`uninstall ${USER_PLUGIN}@${MARKETPLACE_NAME} --scope user`);
const afterUninstall = await storage.list();
assertEqual(afterUninstall.filter((w) => w.name.startsWith(`${USER_PLUGIN}:`)).length, 0,
  "uninstall must leave no envelope behind: nothing else can ever find it");
```

---

### WR-11: two test-fixture drifts and one over-broad lint ignore

**File:** `tests/orchestrators/plugin/install-workflows.test.ts:223`,
`eslint.config.js:22`

**Issue:** Three smaller quality defects:

1. `armConcurrentInstallRace`'s hidden record literal
   (`install-workflows.test.ts:218-228`) omits `workflows` from its `resources` object.
   It escapes type-checking only because it reaches state through an untyped
   `Object.defineProperty` getter. Every other fixture in the phase was updated; this one
   silently models a record shape the schema now rejects, and a future test that routes it
   through `STATE_VALIDATOR` will fail for a reason unrelated to what it is testing.
2. The eslint ignore added at `eslint.config.js:22` is
   `tests/bridges/_fixtures/**/*.{js,mjs,cjs}` — every bridge fixture directory, present
   and future — while the justification in the adjacent comment is specific to workflow
   scripts. Scope it to `tests/bridges/_fixtures/workflows-plugin/**/*.{js,mjs,cjs}`.
3. `discover.ts:208-212` dedups declared workflow directories by the resolved absolute
   path string. On a case-insensitive filesystem a manifest declaring both `workflows` and
   `Workflows` names one directory but produces two distinct strings, so every script is
   discovered twice and `assertNoWorkflowNameCollisions` fails the install of a
   well-formed plugin — the exact failure the path dedup was added to prevent
   (`discover.ts:146-153`).

**Fix:** Add `workflows: []` to the hidden record; narrow the eslint ignore glob; key
`seenPaths` on a case-folded path where `process.platform` indicates a case-insensitive
filesystem, or dedup on `path.resolve(...)` compared with `fs.realpath` when available.

---

_Reviewed: 2026-08-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Resolution (2026-08-16)

All 16 findings are closed. CR-01, CR-04, CR-05 and the in-scope warnings were fixed
within Phase 103. CR-02, CR-03, WR-01, WR-06 and WR-10 were lifecycle work by definition
(WLIF-02..06) and were deferred to Phase 104 by an explicit orchestrator decision, recorded
onto the Lifecycle requirements in `REQUIREMENTS.md` rather than left in this file. Phase 104
closed all five and its own verification confirmed them absent from the tree no longer.
