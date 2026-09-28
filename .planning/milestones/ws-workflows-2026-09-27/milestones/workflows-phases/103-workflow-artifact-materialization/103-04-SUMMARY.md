---
phase: 103-workflow-artifact-materialization
plan: 04
subsystem: orchestrators
tags: [workflows, info, naming, containment, live-uat]
status: complete

requires:
  - bridges/workflows/discover.ts (discoverPluginWorkflows, the full verdict array)
  - domain/workflow-script.ts (the verdict union and the suffix tuple)
  - persistence/state-io.ts (resources.workflows on the install record)
provides:
  - domain/workflow-script.ts exports fileStem
  - bridges/workflows WorkflowDiscoveryTarget (the structural discovery input)
  - the bridge-backed workflows name source on both info rendering arms
  - tests/live-uat/workflow-storage-canary.mjs
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - CLAUDE.md (the NFR-10 containment clause)
  - docs/output-catalog.md (the workflow-bearing rendered state's prose)
  - tests/live-uat/README.md

tech-stack:
  added: []
  patterns:
    - one read of a script's bytes serving both the install ledger and a read-only surface
    - a local catch that narrows a degrade rather than widening it
    - an out-of-suite live driver in place of a devDependency on a 0.x package

key-files:
  created:
    - tests/live-uat/workflow-storage-canary.mjs
  modified:
    - extensions/pi-claude-marketplace/domain/workflow-script.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
    - extensions/pi-claude-marketplace/bridges/workflows/types.ts
    - extensions/pi-claude-marketplace/bridges/workflows/index.ts
    - docs/output-catalog.md
    - CLAUDE.md
    - tests/orchestrators/plugin/info.test.ts
    - tests/live-uat/README.md

decisions:
  - The bridge discovery's input was narrowed to a structural target so the info surface can supply a re-derived plugin root; MaterializablePlugin stays assignable and NFR-7 still holds
  - The unsafe-plugin-name case is pinned at the level it is observable, because the resolver screens the same name first and the local catch is defence in depth
  - The live driver gained a PI_WORKFLOW_ENGINE_ROOT route and a storage-module import fallback, which is what let it actually run against 3.5.1

requirements: [WBRG-02, WBRG-04]

metrics:
  duration: ~2h
  completed: 2026-08-15

estimate:
  tokens: 56000
  tasks: 2
actuals:
  tokens: 15245
  tasks: 2
  commits: 2
---

# Phase 103 Plan 04: The declared workflow name, the fourth writable root, and the live proof Summary

`info` now shows the name a workflow script gives itself rather than the name its file
happens to carry, on both rendering arms and without a malformed script costing the user
the plugin; the project instructions name the root the code writes to; and a real
`@quintinshaw/pi-dynamic-workflows` 3.5.1 storage instance was observed listing and loading
what the install wrote, in both scopes.

## What Was Built

**One stem rule, exported.** `fileStem` in `domain/workflow-script.ts` is public now. Its
doc comment records why: the discovery filter and the fallback rendering must admit and
strip the same suffix set, and a second case-insensitive strip would agree with the first
on `.js` and diverge on exactly the `.mjs` / `.cjs` / mixed-case cases the first exists to
handle. Behaviour is unchanged.

**The bridge-backed name source.** `composeResolvedComponents` gained a third `pluginName`
parameter, and its workflows arm calls `discoverPluginWorkflows` instead of walking
directory entries. A `named` verdict renders its `metaName`; every other arm renders the
file stem, the skipped and refused ones included, because `info` is an inventory and a
script that vanished from the list is harder to find than one listed under its file name.
Source names, never generated ones — which is what every other kind on this surface
renders, and the catalog documents the one row that does otherwise.

Both arms are covered. The arm that renders a plugin the resolver could not resolve has
`entry.name` in hand, so it passes the same name; leaving it on stems would have put two
kinds of name for one component kind on one surface.

**The narrow catch.** The whole discovery is wrapped in a try/catch that falls back to the
directory-entry enumeration. The fallback re-reads the same directories, so an IO failure
still propagates to `narrowProbeError` — only a decision-layer throw is absorbed, and the
heavier whole-component-block degrade is left alone.

**The fallback's suffix strip.** `nameFromEntry` hard-coded `.js` for this kind while the
bridge admitted three. It now admits with `WORKFLOW_SCRIPT_EXTENSIONS` and strips with
`fileStem`, so the two paths cannot disagree about which files are scripts or about how
much of the name is suffix.

**The containment clause.** The amended `CLAUDE.md` bullet, verbatim:

> **Containment (NFR-10, re-anchored by url-source, extended by workflows):** Refuse to
> write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`,
> `<scopeRoot>/mcp.json`, or the workflow storage root `~/.pi/workflows/` -- and inside
> that root, only `saved/` (user scope), `projects/<key>/saved/` (project scope), and the
> `.pi-claude-marketplace-staging/` staging directory are admitted; a write inside the root
> but outside those three is still refused. The workflow root is a **sibling** of the
> user-scope agent directory, not a subdirectory of any scope root, and
> `PI_CODING_AGENT_DIR` does not relocate it: the host workflow engine derives it from the
> home directory and honors no override, so writing anywhere else would put artifacts where
> the engine never looks. Plugin roots must resolve inside their **owning clone root**
> (marketplace clone for `path` sources, `plugin-clones/<key>/` for git sources)

**The live storage canary.** `tests/live-uat/workflow-storage-canary.mjs` builds a
temporary HOME plus a temporary working directory, installs a workflow-bearing plugin
through the extension's own `/claude:plugin install` in each scope, and reads the result
back through a real engine storage instance. It fabricates nothing and it is reachable from
no script `npm run check` runs.

## Key Implementation Notes

**Relocating HOME is what sandboxes the engine.** The engine derives its storage root from
the home directory and honors no override, so the driver sets `HOME` before it imports
anything, and pins `PI_CODING_AGENT_DIR` into the same sandbox so an inherited value cannot
put this extension's own scope root outside it. Extension modules are imported dynamically
for that reason — a static import would run before the environment was set.

**The driver reads the project half through the engine's own key.** After proving each
scope, it lists again from an unrelated project directory and asserts the project envelope
is invisible there while the user one is not. That is the engine's key derivation checked
against this repository's reimplementation of it, rather than ours checked against itself.

**The fixture's two names disagree on purpose.** The script is `ship.workflow.js` and
declares `deploy`. A stem-named install would still land a file the engine lists, so a
fixture whose file name and declared name agree cannot tell a correct install from a
misnamed one — in the offline tests or in the live driver.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The bridge discovery's input type was narrowed to a structural target**

- **Found during:** Task 1, Step C
- **Issue:** `discoverPluginWorkflows` took `resolved: MaterializablePlugin`, but
  `composeResolvedComponents` holds a structural bag plus a separately re-derived
  `pluginRoot` — the `unavailable` arm has no resolver arm to hand over at all. The plan's
  Step C says to call the discovery "with the plugin name and the resolved workflow
  component paths", which that signature does not accept.
- **Fix:** A `WorkflowDiscoveryTarget` interface in `bridges/workflows/types.ts` carrying
  exactly what the discovery reads — `pluginRoot` and `componentPaths.workflows`. It is a
  narrowing of the requirement, not a widening: `pluginRoot` stays required, so NFR-7's
  property holds and `MaterializablePlugin` is assignable untouched. The install path is
  byte-unchanged. The alternative — synthesising a fake `MaterializablePlugin` at the info
  call site — would have needed a cast through a discriminated union that exists to make
  such casts unnecessary.
- **Files modified:** `bridges/workflows/types.ts`, `bridges/workflows/discover.ts`,
  `bridges/workflows/index.ts`
- **Commit:** 13d5ba29

**2. [Rule 1 - Bug] The live driver could not load the engine by either route it was given**

- **Found during:** Task 2, Step B, on the first real run
- **Issue:** Two independent blockers, both invisible until the driver ran against a real
  install. `createRequire(...).resolve` fails on the published package with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`, because its `exports` map declares only the `import`
  condition and the CommonJS resolver reports no main. And the package's own entry point
  imports `@earendil-works/pi-ai`, so on a machine without the Pi host packages it fails to
  import before any storage code runs — which is the transitive coupling the decision to
  keep it out of `package.json` was about, arriving from the other direction.
- **Fix:** Resolution reads the entry the package itself declares when the CommonJS
  resolver refuses, and carries the storage module as a second import candidate, reporting
  which one it used. A third route, `PI_WORKFLOW_ENGINE_ROOT`, lets an operator point at any
  scratch `node_modules` — no global install and no change to `package.json`. Without these
  the driver could only ever have reported its own precondition miss.
- **Files modified:** `tests/live-uat/workflow-storage-canary.mjs`
- **Commit:** c9f0f3c9

### The unsafe-plugin-name case is pinned where it is observable

The plan asks for a case that "use[s] a plugin name the safe-name rule rejects and
assert[s] that the info row still renders and that the workflows line falls back to the
directory-entry names". The first half is testable and is tested. The second is not
reachable through this surface.

`preflightStages` in `domain/resolver.ts` calls `assertSafeName(entry.name)` as its first
statement, and every arm that reaches `composeResolvedComponents` — installed, available,
partially-available, unavailable, warm-git — passes through it. A plugin name the rule
rejects therefore throws in the resolver and the row renders `(unavailable) {unreadable}`
with `components: not resolved`; it never reaches the workflows discovery, so the fallback
branch cannot be driven by that input.

Two consequences, both taken:

- The local catch stays. It is defence in depth against a second throw site rather than the
  only guard, and the test comment says so in those words, so a later reader does not
  mistake it for dead weight or for the whole protection.
- The catch branch is covered by a different case that IS reachable: a `chmod 0o000`
  workflows directory. The bridge throws `EACCES`, the catch runs, the fallback re-reads the
  same directory and throws again, and the row renders `{permission denied}`. That case
  pins the property that actually matters about the catch — that it narrows the degrade
  without swallowing IO failures.

The behaviour row is therefore split across two cases rather than dropped, and the plan's
truth ("a plugin name the safe-name rule rejects does not make the plugin unviewable on
`info`") holds and is asserted.

### Acceptance criterion not met literally

`grep -c 'discoverPluginWorkflows' orchestrators/plugin/info.ts` is `2`, not `1`: one import
line and one call. There IS exactly one call site and it is wrapped once, which is the
criterion's stated intent. The same counting shape produced the two `writeFile` /
`workflowsSavedDir` gate divergences recorded in the wave-1 summary.

All other gates were measured and met — see Verification below.

## Live Driver Result

**Run, and it passed.** `@quintinshaw/pi-dynamic-workflows` 3.5.1 was installed into a
scratch prefix (`npm install --prefix /tmp/wf-engine`), the driver was pointed at it with
`PI_WORKFLOW_ENGINE_ROOT`, and the scratch install was deleted afterwards. Nothing was added
to `package.json`, nothing was installed globally, and nothing was installed into the
repository.

```text
PASS: @quintinshaw/pi-dynamic-workflows loaded from PI_WORKFLOW_ENGINE_ROOT via its storage module
PASS: Ua: the user-scope install recorded the workflow name "wfuser:deploy"
PASS: Ub: the engine lists "wfuser:deploy" from its user half
PASS: Uc: load("wfuser:deploy") returned the source script byte for byte
PASS: Ud: nothing from the staging directory ".pi-claude-marketplace-staging" appears in the listing
PASS: Pa: the project-scope install recorded the workflow name "wfproj:deploy"
PASS: Pb: the engine lists "wfproj:deploy" from its project half
PASS: Pc: load("wfproj:deploy") returned the source script byte for byte
PASS: Pd: nothing from the staging directory ".pi-claude-marketplace-staging" appears in the listing
PASS: X: the project key isolates the project envelope while the user one stays global
exit 0
```

So WBRG-04's backstop truth — "a real `@quintinshaw/pi-dynamic-workflows` instance lists an
installed envelope" — is observed rather than deferred. The half it does NOT establish is
command registration after a reload: that needs a live `pi` host with a configured provider,
which is the same residue the manifest-absence canary's Flow C carries.

The precondition path was exercised too, before the engine was available: the driver exited
non-zero, named the package, listed each route it tried, and printed both ways to make it
available.

## Known Stubs

None. No stub patterns, no TODO/FIXME markers, no unrun `<verify>` blocks. One skip guard
was added — the `chmod`-based case skips on Windows, matching the two guards already in the
same file — and it runs on this machine. The single skipped test in the suite total is
pre-existing and unrelated.

## Threat Flags

None. Every surface this plan touches is already in the plan's threat register: the
read-only rendering over a malformed plugin (T-103-16), reading script bytes on a read-only
surface (T-103-17), the display names themselves (T-103-18), the live driver's sandbox
(T-103-19), and the supply-chain coupling (T-103-20). T-103-20's mitigation was exercised
directly: the engine is in no dependency block, asserted by a criterion that reads all four,
and the driver reports an absent engine rather than skipping silently.

T-103-SC needs no legitimacy checkpoint. The plan installs no package into this repository.
The scratch `npm install --prefix` used to run the live driver installed the engine the
research audited to an `OK` verdict at the version it audited (3.5.1), outside the repository
and outside the global root, and it was removed afterwards.

## Verification

`npm run check` exit 0: typecheck, lint, format:check, 3610 unit tests (3609 pass, 1
pre-existing skip, 0 fail), 18 integration tests, 0 failures.

| Gate | Required | Actual |
|---|---|---|
| `tests/orchestrators/plugin/info.test.ts` case count | >= 7 higher | 76 (was 68) |
| `tests/architecture/catalog-uat.test.ts` | green | green |
| `git diff docs/output-catalog.md \| grep -c '^[-+]```'` | 0 | 0 |
| `grep -c 'export function fileStem'` in the domain module | 1 | 1 |
| files mentioning `fileStem` | 2 | 2 (`domain/workflow-script.ts`, `orchestrators/plugin/info.ts`) |
| `grep -c 'discoverPluginWorkflows'` in `info.ts` | 1 | 2 (import + the single call — see above) |
| `stems` in the workflow catalog state's range | 0 | 0 |
| the declared-name field named in that range | >= 1 | 1 |
| `grep -cE '=== "workflows" \? "\.js"'` in `info.ts` | 0 | 0 |
| `info-manifest-absent.test.ts` + `list.test.ts` unedited | pass | pass |
| `node --check` on the driver | exit 0 | exit 0 |
| engine in any dependency block | absent | absent |
| `grep -rc 'workflow-storage-canary' package.json` | 0 | 0 |
| `grep -c 'workflow-storage-canary'` in the live-uat README | >= 2 | 3 |
| `grep -c 'process.exit'` in the driver | >= 2 | 3 |
| `grep -ciE 'workflows' CLAUDE.md` | increases | 1 -> 2 |
| `pre-commit run --files CLAUDE.md tests/live-uat/README.md` | passes | passes (mdformat reformatted the README's table; re-run clean) |
| GSD-process tokens in the changed source, test and driver files | none | none |

The driver leaves nothing behind: after a run, no `/tmp/workflow-storage-*` sandbox
survives and the developer's real `~/.pi/workflows` is untouched.

## Forward Notes

- Command registration after a `/reload` is the half of WBRG-04 the driver does not reach.
  It needs a live `pi` host with a configured provider, the same residue the
  manifest-absence canary carries as its Flow C.
- The standalone-surface visibility gap recorded by the sibling plan is unchanged by this
  one. `info` renders the inventory; it does not report why a script was skipped, and the
  reason token that would is scheduled with the soft-dependency work of the following phase.
- `PI_WORKFLOW_ENGINE_ROOT` is a driver-only convention. Nothing in the extension reads it,
  and nothing should: the engine's storage root is derived from the home directory because
  the engine derives it that way.

## Self-Check: PASSED

All ten touched files verified present on disk; both commit hashes verified in `git log`.
