---
spike: 010
idea: claude-workflows-bridge
name: landing-zone-quintinshaw
type: standard
validates: "Given @quintinshaw/pi-dynamic-workflows as the target settled on trust grounds (009a), when its saved-workflow format, path model, and name rules are exercised with a hand-planted bridged artifact, then determine what a bridge must write, where, and what our NFR-10 containment boundary must become"
verdict: "⚠ PARTIAL"
related: ["008", "009a", "009b"]
tags: [pi-extension, workflows, landing-zone, scope-model, nfr-10]
---

# Spike 023: landing-zone-quintinshaw

## What This Validates

Spike 022a settled the target on trust grounds: `@quintinshaw/pi-dynamic-workflows`
sandboxes workflow scripts (`vm.createContext`, stubbed `process`, no reachable
escape) where `@nicknisi/pi-workflows` grants full host privilege. This spike
was originally scoped as a two-variant landing-zone comparison; it was re-aimed
at quintinshaw alone once the trust result made the engine choice lopsided.

The question that remains is not "does it work" but "what does it cost us":
quintinshaw's convenient properties (dominant adoption, real sandbox) come with
a path model that was built for its own `/workflows` save dialog, not for an
external writer.

## Research

Read from shipped source (`src/workflow-saved.ts`, `src/workflow-paths.ts`,
`src/saved-commands.ts`, `src/config.ts` at 3.5.1).

**Artifact format.** A saved workflow is a `.json` envelope, not a `.js` file:

```jsonc
{
  "name": "...",          // filename stem; must pass isSafeSavedWorkflowName
  "description": "...",
  "script": "...",        // the workflow source, as a string
  "parameters": { },      // optional
  "location": "project" | "user",   // set on read, not required on disk
  "path": "...",                    // set on read
  "savedAt": "ISO"                  // set by save(); display only
}
```

So a bridge does not copy a Claude `.js` file; it **wraps** it. The Claude
script becomes the `script` string field.

**Path model.** `workflowProjectPaths(cwd)` yields three read locations, and
`list()` walks them in priority order project > legacy project > user:

| Role | Path |
| --- | --- |
| canonical project | `~/.pi/workflows/projects/<slug>-<sha256(cwd)[:12]>/saved/` |
| legacy project | `<cwd>/.pi/workflows/saved/` |
| user | `~/.pi/workflows/saved/` |

The module's own header states the intent: *"New writes live under the user's
workflow home so projects do not get scattered `.pi/workflows` directories."*
The legacy location is read but no longer written by the engine itself.

## How to Run

```bash
npm install @quintinshaw/pi-dynamic-workflows@3.5.1
node paths.mjs                                     # path model + name rules
SANDBOX=$(mktemp -d); mkdir -p "$SANDBOX/proj"
HOME="$SANDBOX" FAKE_CWD="$SANDBOX/proj" node plant.mjs   # end-to-end plant
```

`plant.mjs` runs against a throwaway `HOME` so it never touches a real
`~/.pi/workflows`.

## What to Expect

`paths.mjs` prints the three resolved directories and which candidate names the
engine accepts. `plant.mjs` writes a hand-built envelope into each of the three
locations and shows what `storage.list()` / `storage.load()` return.

## Investigation Trail

1. **Resolved the path model against a known cwd** rather than reading the
   `join()` calls, to see the hashed project key materialize concretely
   (`some-project-e4c31526a114`).
2. **Tested the name rules against Claude's namespacing.** Claude runs a plugin
   workflow as `/<plugin>:<meta.name>`. `isSafeSavedWorkflowName` rejects only
   `/`, `\`, NUL, `.`/`..`, empty, untrimmed, and >128 chars -- so
   `acme-tools:release-audit` is **accepted verbatim**. Upstream's namespacing
   maps onto the engine's naming with no transformation.
3. **Planted a hand-built envelope into all three locations** under a sandboxed
   `HOME`, then asked the real `createWorkflowStorage(cwd)` what it saw. This is
   the load-bearing check: it proves a bridge can write files directly without
   calling the engine's `save()` API or mutating any index.
4. **Round-tripped the script** to confirm the Claude source survives the
   envelope byte-for-byte.
5. **Traced how a saved workflow becomes a command** (`saved-commands.ts`), to
   test the result against NFR-2 ("no fix may require a Pi process restart;
   `/reload` must suffice").
6. **Compared each path against `locationsFor()`** (`persistence/locations.ts:145`)
   to size the NFR-10 containment question.

## Results

**VERDICT: PARTIAL.** A bridge is mechanically viable and needs no engine API,
but every write target is a containment decision, and two of the three sit
outside our current boundary.

### Mechanically viable, confirmed end-to-end

```text
planted canonical project  -> $HOME/.pi/workflows/projects/proj-438b0a4edfb5/saved/acme-tools:proj-canonical.json
planted legacy project     -> $CWD/.pi/workflows/saved/acme-tools:proj-legacy.json
planted user               -> $HOME/.pi/workflows/saved/acme-tools:user-scope.json

storage.list() sees
  acme-tools:proj-canonical    location=project  scriptBytes=138
  acme-tools:proj-legacy       location=project  scriptBytes=138
  acme-tools:user-scope        location=user     scriptBytes=138

storage.load('acme-tools:proj-legacy') -> loaded
  script survived verbatim: true
```

All three hand-written files were discovered. There is no index to mutate and
no registry to call -- the same "directory is the registry" property that makes
the skills and commands bridges simple. A `stage`/`commit`/`unstage` triplet
maps directly: write the envelope to a staging path, atomic-rename into the
saved dir, unlink by recorded name on rollback.

### The containment problem (NFR-10)

`locationsFor(scope, cwd)` sets `scopeRoot` to `getAgentDir()` (user, default
`~/.pi/agent/`) or `<cwd>/.pi` (project). NFR-10 confines every write to
`<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or
`<scopeRoot>/mcp.json`.

| quintinshaw target | Inside a scopeRoot? | Notes |
| --- | --- | --- |
| `<cwd>/.pi/workflows/saved/` (legacy project) | **Yes** -- `<projectScopeRoot>/workflows/saved/` | Sits at the same tier as `agents/`. Only needs the NFR-10 list extended, exactly as `agents/` once was. |
| `~/.pi/workflows/projects/<hash>/saved/` | **No** | Sibling of `~/.pi/agent/`, not under it. |
| `~/.pi/workflows/saved/` (user) | **No** | Same -- `~/.pi/workflows/` is not `~/.pi/agent/`. |

This is the crux, and it is genuinely awkward:

- The **one** path that fits our containment model and our scope model cleanly
  is the one the engine calls **legacy** and no longer writes to itself. Betting
  the project-scope bridge on a read path its owner has already deprecated is a
  real risk -- if it is dropped, installed workflows silently stop resolving.
- The **canonical** project path requires us to reproduce
  `sha256(resolve(cwd)).slice(0,12)` plus their `sanitizePathSegment` rules to
  compute a directory name. That is a private implementation detail with no
  exported helper contract; if their hashing changes, our writes land in an
  orphaned directory with no error. It is also outside any `scopeRoot`, so it
  cannot be expressed as a `ScopedLocations` member at all.
- **User scope has no compliant option.** `~/.pi/workflows/saved/` is outside
  `getAgentDir()`, so a user-scope workflow install cannot be contained by the
  current NFR-10 wording under any choice.

Unlike the `agents/` precedent -- where pi-subagents reads a directory that
happens to sit under our own scope roots -- this engine's storage root is a
sibling of Pi's agent dir, not a child. NFR-10 would have to grow a genuinely
new *root*, not just a new subdirectory, for user scope.

### `/reload` semantics satisfy NFR-2, with one asymmetry

`registerAllSavedWorkflows` enumerates `storage.list()` at extension load and
calls `pi.registerCommand(wf.name, ...)` per workflow. Each handler re-loads by
name from live storage, so an **edit** to an installed workflow takes effect
without reload; a **new** workflow needs the registration pass to re-run, i.e.
`/reload`. That matches NFR-2 and our hooks-bridge staged-copy semantics.

Uninstall is the asymmetric case, and their source names it:

> Pi has no `unregisterCommand`, so a command cannot be removed mid-session.

After an uninstall the `/acme-tools:release-audit` command persists until
reload. Their handler degrades by notifying *"is not available in this project
-- reload the session to drop the stale command."* A bridge inherits this: our
uninstall would remove the file, but the command lingers for the session. That
is a notify-wording question for the closed-set reason catalog, not a blocker.

### A naming hazard the accepted-name test surfaced

`acme-tools:release-audit` is accepted as a name, which means the file is
`acme-tools:release-audit.json`. A colon is legal in a POSIX filename and
**illegal on NTFS**. `isSafeSavedWorkflowName` screens `/`, `\`, and NUL but not
`:`. Any bridge adopting Claude's namespacing verbatim would produce filenames
that cannot be created on Windows, and Pi ships Windows support
(`docs/windows.md`). A bridge must either sanitize the separator (diverging
from upstream's displayed command name) or accept being POSIX-only. Not
resolved here.

### Signal for spike 024

The bridge shape is mostly settled: wrap-not-copy, write a `.json` envelope,
no index mutation, stage/commit/unstage maps cleanly, `/reload` suffices. The
open items 011 must decide are all boundary questions, not mechanism questions:

1. Which path does project scope write -- deprecated-but-contained (legacy) or
   canonical-but-uncontained (hashed)?
2. Does user scope get a bridge at all, given no compliant path exists?
3. What exact NFR-10 amendment does the answer require?
4. Colon-in-filename: sanitize or accept POSIX-only.

### Caveats

- Measured at 3.5.1. The legacy-path read, the hash function, and the name
  validator are all internal details, and the legacy read is the one most
  likely to be removed.
- `plant.mjs` exercises `createWorkflowStorage` directly, not a live `pi`
  session. Command registration was traced in source, not observed in a TUI --
  a real-session check belongs in UAT before any bridge ships.
- `savedAt` was omitted from the planted envelopes and nothing objected; that
  it is display-only was inferred from `save()`, not proven by a rendering test.
