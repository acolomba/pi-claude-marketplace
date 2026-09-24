---
spike: 011
idea: claude-workflows-bridge
name: workflows-bridge-shape
type: standard
validates: "Given our stage/commit/unstage + locationsFor + soft-dep machinery, when a workflows bridge is mapped onto it, then produce the reuse-vs-delta table including the NFR-10 containment amendment, namespacing, and collision handling"
verdict: "⚠ PARTIAL"
related: ["008", "009a", "010"]
tags: [architecture, bridges, nfr-10, design]
---

# Spike 024: workflows-bridge-shape

## What This Validates

Spikes 021-023 established that the kind is really shipped, that
`@quintinshaw/pi-dynamic-workflows` is the only credible target on trust
grounds, and that a hand-planted artifact is discovered end-to-end. This spike
maps the bridge onto existing house machinery and isolates what is genuinely
new.

This is primarily a code-mapping analysis, not an experiment -- with one
runnable integration check (`name-interop.mjs`) for the single reuse claim that
is cheap to verify and expensive to get wrong.

## How to Run

```bash
npm install @quintinshaw/pi-dynamic-workflows@3.5.1
node name-interop.mjs
```

Feeds our real `domain/name.ts::generatedCommandName` into their real
`isSafeSavedWorkflowName`.

## Investigation Trail

1. **Read the closest analog first.** `bridges/commands/` (flat `*.md` files,
   colon-namespaced, staged then renamed) rather than `bridges/agents/`, whose
   index-file mutation has no counterpart here -- spike 023 established that
   quintinshaw's registry is a directory scan.
2. **Verified the naming reuse claim rather than asserting it.** Ran our
   generator into their validator across four cases including RN-1 prefix
   elision.
3. **Traced the soft-dep probe** (`platform/pi-api.ts:162`) to confirm a third
   dependency is detectable by the existing pattern, and checked which tool
   name is distinctive enough to probe.
4. **Went looking for the colon/NTFS hazard flagged in spike 023** -- and found
   the question already answered in this codebase.
5. **Checked where each bridge's artifact name comes from**, which surfaced a
   parity divergence spike 023 did not reach.

## Results

**VERDICT: PARTIAL.** The mechanism maps almost entirely onto existing seams.
What is left is not mechanism at all -- it is three boundary decisions, and one
of them has no compliant answer.

### Correction to spike 023

Spike 023 flagged colon-in-filename as an open decision ("sanitize or accept
POSIX-only"). It is **already settled policy in this codebase**, at
`bridges/commands/stage.ts:11`:

> Filenames carry the literal colon (`:`) in the basename. POSIX targets allow
> this; Windows is explicitly not targeted.

Commands already write `<extensionRoot>/resources/prompts/<plugin>:<command>.md`.
A workflows bridge inherits the existing posture rather than introducing a new
hazard. Drop it from the decision list.

### Reuse: what works unchanged

| Seam | Where | Why it carries |
| --- | --- | --- |
| Name generation | `domain/name.ts:90` `generatedColonName` | Already emits `<plugin>:<name>`, the exact shape Claude uses AND their validator accepts. Verified, incl. RN-1 elision. **No new generator.** |
| Flat-file discovery | `bridges/commands/discover.ts` | Same shape: non-recursive dir scan, D-14 symlink refusal, first-wins dedup, `warnings[]` soft-fail channel. `.md` -> `.js` is the only change. |
| Colon filenames | `bridges/commands/stage.ts:11` | Existing policy, see correction above. |
| Atomic commit | `bridges/commands/stage.ts` staging-then-rename | Same-FS rename, NFR-1. Unchanged. |
| Soft-dep probe | `platform/pi-api.ts:162` `softDepStatus` | Pattern is "`pi.getAllTools()` contains a named tool". quintinshaw registers `workflow`, `workflow_control`, `deep_research`. Probe **`workflow_control`** -- `workflow` is also registered by `@nicknisi/pi-workflows` and would false-positive. |
| Reason composition | `shared/concerns/soft-dep.ts:52` `softDepMarkers` | Same declares-flag + probe -> marker shape. |
| Transactional ledger | `transaction/phase-ledger.ts` `runPhases` | Append one `Phase` to the literal array at `orchestrators/plugin/install.ts:1240` and its `update.ts` counterpart. |

### Delta: real new work

| Change | Location | Character |
| --- | --- | --- |
| `workflows` in kind tuples + `componentPaths` | `domain/resolver.ts:325,336` + `PartialResolution` | Mechanical, but touches the discriminated union |
| New bridge directory | `bridges/workflows/{discover,stage,unstage,types,index}.ts` | Modeled on `bridges/commands/` |
| **Envelope wrap** | `bridges/workflows/stage.ts` | Genuinely new. Every other bridge copies or rewrites a file; this one *wraps* source into `{name, description, script}` JSON (spike 023). |
| 6th ledger phase | `orchestrators/plugin/install.ts`, `update.ts` | Mechanical |
| `DEPENDENCIES` third member | `shared/concerns/soft-dep.ts:31` | Closed-set amendment (currently `["agents", "mcp"]`) |
| New REASONS token | `shared/notify.ts` + `docs/output-catalog.md` | Closed-set catalog amendment |
| `hasLoadedPiDynamicWorkflows` | `platform/pi-api.ts` | Small, follows RH-3/RH-4 |
| **Write target** | `persistence/locations.ts` + NFR-10 | The hard one -- see below |
| **Preprocessor pre-validation** | `bridges/workflows/stage.ts` | New: guard against 009a's raw-text `DETERMINISM_BLOCKLIST` rejecting a script for a comment |

### Concepts with no house analog

1. **Writing outside `<scopeRoot>`.** Every current write target is
   `<scopeRoot>/...`. `agents/` looked like a precedent but is not: pi-subagents
   reads a directory *under* our scope roots, whereas quintinshaw's storage root
   `~/.pi/workflows/` is a **sibling** of `~/.pi/agent/`.
2. **Installing executable code rather than data.** Every bridge today installs
   markdown or JSON config. Even with 009a's sandbox, this is a threat-model
   change, not a feature addition.
3. **Pre-validating against a third-party engine's text preprocessor.** Nothing
   in the codebase does this today.

### The open decisions

**D1 -- which path does project scope write?**

| Option | For | Against |
| --- | --- | --- |
| `<cwd>/.pi/workflows/saved/` (legacy) | Inside `<projectScopeRoot>`; NFR-10 grows a subdirectory, exactly like `agents/` did; expressible as a `ScopedLocations` member | The engine calls it legacy and no longer writes it. If the read path is dropped, installed workflows silently stop resolving |
| `~/.pi/workflows/projects/<slug>-<sha256(cwd)[:12]>/saved/` | The engine's canonical, actively-maintained location | Outside every scopeRoot, so not expressible as `ScopedLocations` at all; requires reproducing their private hash + `sanitizePathSegment`; a hash change orphans our writes with no error |

**D2 -- does user scope get a bridge at all?** There is no compliant path:
`~/.pi/workflows/saved/` is outside `getAgentDir()`. Either NFR-10 grows a new
writable *root*, or user-scope workflow installs are refused with a reason token
(project-scope only). The latter is a real scope-model asymmetry -- SC-1 has two
symmetric scopes today, and no component kind is currently project-only.

**D3 -- where does the artifact name come from?** This one spike 023 missed.
Claude derives a plugin workflow's command name from **`meta.name` inside the
script** (`acme-tools` + `meta.name: release-audit` -> `/acme-tools:release-audit`).
Every bridge we have derives names from the **filename**
(`generatedCommandName(plugin, source)` where `source` is the file stem).

| Option | For | Against |
| --- | --- | --- |
| Parse `meta.name` from the script | Exact upstream parity; the command matches what the plugin author declared and what Claude Code shows | Requires parsing JS. A regex is precisely the defect class 009a/009b found in both engines; doing it properly means an acorn dependency |
| Use the filename stem | Zero new machinery, reuses `generatedCommandName` as-is | Parity break whenever `meta.name` differs from the filename -- and spike 021 found real plugins using both `rpi.js` and `drafter.workflow.js` naming, so divergence is likely |

### Recommendation

If this is built: **D1 legacy path, D2 project-scope only, D3 parse `meta.name`
with acorn.** The reasoning is that D1's legacy path keeps the whole feature
inside the containment model we already defend and test, and a future path
change is a bridge-internal fix; whereas the canonical path makes NFR-10 a
promise we cannot keep and couples us to a private hash. D2 follows from D1 --
if there is no compliant user path, do not invent one to fill a symmetry. D3
because a name that disagrees with the plugin author's declaration is a parity
bug users will report, and the parsing hazard is exactly what a real parser
avoids.

**But the honest summary is that the case is weaker than when this started.**
The bridge costs a new component kind across the resolver, a new bridge
directory, a 6th ledger phase, two closed-set amendments, a new soft-dep probe,
a JS parser dependency, an NFR-10 amendment, and a first-of-its-kind
executable-code install -- in exchange for parity with a kind whose Pi-side host
is a single third-party extension in a fragmented eight-way field, on a
deprecated storage path, with no first-party Pi engine to stabilize against.
The WFLW-01 mechanical fix from spike 021 (two table entries, catching 16 of 16
real plugins with a `{unsupported workflows}` reason) delivers the honesty
without any of that, and it is what the closed-set guarantee actually requires.

Recommend shipping the spike-008 fix now and revisiting the bridge if and when
Pi grows a first-party workflow engine -- at which point D1 and D2 likely
dissolve, because a first-party engine would almost certainly read from the
scope roots the way `@nicknisi`, `@wichayutdew`, and `@osolmaz` already
independently converged on.

### Decision of record (operator, 2026-08-14)

**The recommendation above was not taken.** The operator elected to build the
bridge on `@quintinshaw/pi-dynamic-workflows`, writing the **canonical** paths
for both scopes -- D1 Option 1, and D2 answered as "yes, user scope is
supported". `.planning/BACKLOG.md`'s WFLW-01 entry was rewritten around that
objective.

The cost analysis above stands as a finding and is not retracted; it is the
price of the feature, not an argument that the feature is wrong. What the
decision changes:

- **D1 resolved: canonical.** Nothing depends on the deprecated legacy read
  path. Costs reproducing the project key, which spike 025 validated at 14/14
  parity, and it removes the silent-breakage risk entirely.
- **D2 resolved: both scopes.** SC-1's scope symmetry is preserved; NFR-10
  grows a new writable root rather than a subdirectory.
- **D3 still open.** The `meta.name` versus filename question is carried in the
  backlog entry with its three options.
- **One item this spike got wrong.** The reuse table above assumed the
  agents-bridge staging pattern (stage under `<extensionRoot>`, rename into the
  target) carries over. Under the canonical-path decision it does not -- the
  target moved to `$HOME` while a project-scope `extensionRoot` stays at
  `<cwd>/.pi/`, so `rename()` can fail `EXDEV`. Spike 025 reproduced this and
  established that staging must live adjacent to the target. The NFR-10
  amendment covers three paths, not two.

### Caveats

- No prototype bridge was built. The reuse claims are code-mapping plus one
  verified naming check; the "mechanical" labels are estimates from reading the
  seams, not from an implementation.
- `runPhases` consumers were confirmed as `install.ts` and `update.ts` only.
  `uninstall`/`reinstall`/`enable-disable` compose differently and were not
  traced -- a real plan must check whether each needs the new phase.
- The recommendation is a judgment call on cost versus parity, not a finding.
