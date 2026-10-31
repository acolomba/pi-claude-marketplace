# Phase 5: Marketplace Command Parity - Pattern Map

**Mapped:** 2026-10-26
**Files analyzed:** 22 (new + modified)
**Analogs found:** 21 / 22

All paths are relative to the worktree root. `E` = `extensions/pi-claude-marketplace`. All analogs named here are git-tracked.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `E/platform/hosted-manifest-fetch.ts` (NEW) | platform utility | request-response (HTTPS GET) | `E/domain/github-auth.ts` (`requestCodeImpl`, the only `fetch` caller) + `E/platform/git.ts` (platform wrapper shape, typed errors) | role-match |
| `test/platform/hosted-manifest-fetch.test.ts` (NEW) | test | request-response | `test/domain/github-auth.test.ts:55-122` (`t.mock.method(globalThis, "fetch", …)`) | exact |
| `E/orchestrators/marketplace/shared.ts` (port type + `DEFAULT_HOSTED_FETCH`; `marketplaceFailureRows` marker; `fsErrnoReason`) | service/port | DI | `GitOps` + `DEFAULT_GIT_OPS` in same file `:150-230` | exact |
| `E/orchestrators/marketplace/add.ts` (hosted body, reserved name, D-PL5-16/17/18/19) | orchestrator | file-I/O + network | `addGitClonedInGuard` `add.ts:1215-1317` | exact |
| `E/orchestrators/marketplace/update.ts` (`refreshRecord` hosted arm) | orchestrator | network + file-I/O | `refreshRecord` url arm `update.ts:409-470` | exact |
| `E/orchestrators/marketplace/remove.ts` (`RecordedSourceKind`, fold call) | orchestrator | CRUD | same file `:123`, `:896-900`, `:1163-1173`; fold `:440-457` | exact |
| `E/orchestrators/marketplace/info.ts` (`buildBlock`) | orchestrator | transform | url branch in `buildBlock` `:71-101` | exact |
| `E/domain/source.ts` (hosted kind, funnel arm, D-PL5-13 split) | domain | transform | `UrlSource` arms; `parseKindObjectSource` `:267-302` | exact |
| `E/domain/name.ts` (`reservedMarketplaceNameRefusal`) | domain predicate | transform | `isReservedRecordKey` `name.ts:66-68` | exact |
| `E/persistence/state-io.ts` (`normalizeStoredSource` hosted arm) | persistence | CRUD | same fn `:357-388` | exact |
| compile-forced one-liners: `domain/plugin-resolver.ts:221`, `domain/version.ts:163`, `orchestrators/plugin/dependency-declaration-read.ts:202`, `orchestrators/plugin/info.ts:249`, `domain/source.ts:749,795` | domain | transform | the `"npm"` arm beside each | exact |
| `E/orchestrators/plugin/shared.ts` (`applyPartialCascadeFold` exhaustive) | utility | transform | itself `:1563-1607` | exact |
| `E/edge/router.ts` (`market` alias) | route | request-response | `ls` alias `router.ts:95,117,133,157,251,325` | exact |
| `E/edge/completions/provider.ts` (normalize `market`) | edge | transform | `:89-100,158-183,310-316` | role-match |
| `rule-packs/architecture.json`, `eslint.config.js` BLOCK F, `test/architecture/gate-targets.ts` | config | — | existing `fetch-chokepoint` exclude / `platform/git` pattern | exact |
| `features/lib/https-git-host/server.ts` (static route) | test stand-in | request-response | `HttpsGitHost.receive`/`reset` `server.ts:~439-500` | exact |
| `test/architecture/https-git-host-server.test.ts` (new cases) | test | — | existing cases in same file | exact |
| `features/lib/published-marketplace.ts` (hosted publication; anthropics-owner publication) | test fixture | file-I/O | `publishMarketplaceIn` `:186-231`; `publishOfficialMarketplace` `:238-262` | exact |
| `features/step_definitions/marketplace/publishing.steps.ts`, `add.steps.ts` | cucumber steps | — | `publishing.steps.ts:51-88` | exact |
| `features/marketplace/hosted-source.feature` (NEW, name at planner discretion) | feature | — | `features/marketplace/url-source.feature`, `url-source-update.feature` | exact |
| `features/marketplace/github-source.feature` (MKT-05 scenario) | feature | — | `url-source.feature:7-22` request-log pattern | exact |
| `docs/json-output.md` (ROWID) | doc | — | none needed | n/a |

## Pattern Assignments

### `E/platform/hosted-manifest-fetch.ts` (NEW, platform, request-response)

**Analogs:** `E/domain/github-auth.ts:172-207` (fetch call + status handling), `E/platform/git.ts:1-17` (platform import shape; platform may import only `shared/`).

Imports (copy shape of `platform/git.ts:1-12`; no `node:net`/`node:dns`/`undici` — `no-network-modules` bans them):
```ts
import * as fs from "node:fs";
import * as path from "node:path";

import { FetchedUrlCause, TooManyRedirectsError } from "../shared/errors.ts";
```

Fetch call shape (`github-auth.ts:178-193`):
```ts
const res = await fetch(deviceCodeUrl, { method: "POST", headers: {...}, body });
if (!res.ok) {
  throw new Error(`Device code request failed: HTTP ${res.status}...`);
}
```
For hosted: `fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) })`, loop up to 5 hops, read body with a 5 MiB cap. Throw errors shaped for the existing classifiers (RESEARCH Pattern 2 table): errno-coded `Error` (`code` from `err.cause.code`, `ETIMEDOUT` on `TimeoutError`), and `{ code: "HttpError", data: { statusCode } }` for non-2xx. Typed errors follow `shared/errors.ts` convention (`TooManyRedirectsError` at `errors.ts:606-611`):
```ts
export class TooManyRedirectsError extends Error {
  constructor() {
    super("too many redirects");
    this.name = "TooManyRedirectsError";
  }
}
```
Add one module-exported `HostedManifestUnreadableError` (cap/redirect refusal) and a userinfo refusal that strips credentials from its message (Pitfall 6). Redirect host check parses `new URL(target).hostname` by hand.

Gates to touch with it: `rule-packs/architecture.json` `fetch-chokepoint.exclude` (add the file, reword message; reword `no-network-modules` message), `eslint.config.js` BLOCK F `:525-555` add `{ regex: "platform/hosted-manifest", … }` and widen `NETWORK_FREE_SYNTAX_SELECTORS` `:81-106` to `/platform\/(?:git|hosted-manifest)/`, `test/architecture/gate-targets.ts:149` `CREDENTIAL_LEAK_TARGETS` append.

### `test/platform/hosted-manifest-fetch.test.ts` (NEW, test)

**Analog:** `test/domain/github-auth.test.ts:55-122`:
```ts
function fetchResponse(body: string, status = 200): Promise<Response> { ... }
...
context.mock.method(globalThis, "fetch", (input: string | URL | Request): Promise<Response> => { ... });
```
Use `new Response(body, { status, headers: { location } })` for redirect cases. No loopback server in unit tests (boundaries rule). Import order per CONVENTIONS (`node:assert/strict`, `node:test`, blank line, relative `.ts` production import).

### Hosted port in `E/orchestrators/marketplace/shared.ts`

**Analog:** same file `:150-230` and `:39`:
```ts
import * as defaultGit from "../../platform/git.ts";
...
export interface GitOps { clone(opts: {...}): Promise<void>; ... }
export const DEFAULT_GIT_OPS: GitOps = { clone: defaultGit.clone, ... };
```
Mirror: `export interface HostedManifestFetch { (url: string): Promise<Uint8Array> }` (or an object with one member) + `DEFAULT_HOSTED_MANIFEST_FETCH`. Callers default via `args.x ?? DEFAULT_…` (precedent `add.ts:604` `args.gitOps ?? DEFAULT_GIT_OPS`). No `__`-prefixed test member (`no-test-only-production-surface`). Test double: an inline closure in the add/update tests suffices; a reusable `test/platform/*-fake.ts` (shape of `test/platform/git-ops-fake.ts:1-40`, type-only imports) only if 2+ suites share it.

Also here: `marketplaceFailureRows` `:1000-1023` gains `marketplaceSubject: true`; extract `fsErrnoReason(code)` from `narrowCascadeFailure` `:838-876`.

### `E/orchestrators/marketplace/add.ts` hosted body

**Analog:** `addGitClonedInGuard` (`add.ts:1215-1317`). Core skeleton to share (do NOT copy — fallow dupes fails; extract the tail into a helper taking a `recognize` callback):
```ts
const stagingDir = await locations.sourcesStagingDir(randomUUID());
try { await gitOps.clone({...}); } catch (err) {
  const leak = await cleanupStaging(removalOps, stagingDir, "marketplace clone staging");
  throw appendLeakToError(err, leak);
}
let stagedAtFinal = false; let finalDir: string | undefined; let leftoverLeak: string | undefined;
try {
  await writeOwnershipMarker(stagingDir);
  const manifestPath = path.join(stagingDir, ".claude-plugin", "marketplace.json");
  const { name: derivedName, comparisonJson } = await newMarketplaceName(manifestPath, state.marketplaces, locations.scope);
  finalDir = await locations.sourceCloneDir(derivedName);
  if (await pathExists(finalDir)) {
    leftoverLeak = await recognizeLeftover({ finalDir, derivedName, source, gitOps, removalOps });
    if (leftoverLeak !== undefined) throw new UnremovableLeftoverCloneError(finalDir, derivedName, leftoverLeak);
  }
  await mkdir(path.dirname(finalDir), { recursive: true });
  await rename(stagingDir, finalDir);
  stagedAtFinal = true;
  setOwn(state.marketplaces, derivedName, { name, scope, source, addedFromCwd: cwd,
    manifestPath: path.join(finalDir, ".claude-plugin", "marketplace.json"),
    marketplaceRoot: finalDir, lastUpdatedAt: new Date().toISOString(),
    lastSuccessfulManifest: comparisonJson, plugins: {} });
  return derivedName;
} catch (err) { /* MA-9: cleanupStaging + appendLeakToError(joinLeaks(...)) */ }
```
Hosted step 1 = fetch bytes → `mkdir <staging>/.claude-plugin` → `fs.writeFile` bytes (no `write-file-atomic`; no `readFile` of the manifest — `test/architecture/manifest-read-seam.test.ts`). Marker: root-level JSON via `assertPathInside` + `atomicWriteJson` (same as git marker `add.ts:1130-1146`). Leftover recognizer: mirror `recognizeLeftover` `add.ts:1164-1199` (marker url match → cleanup; absent/different → `StaleSourceCloneError`; EACCES/EIO → `UnreadableSourceCloneError`).

Other add edits and their in-file anchors: `parseAddableSource` `:545-565` (admit hosted); `newMarketplaceName` `:387-407` (add `source` param; order `isReservedRecordKey` → reserved → duplicate); `ReservedMarketplaceNameError extends InvalidMarketplaceManifestError` copying `ConfigInvalidError` `:533-538`; `failedAddRow` `:818-849` child-row condition; `surfaceLockHeldAdd` `:883-902` drops its own spread; `handleAddFailure` `:933-981` → `narrowProbeError(withoutCleanupLeaks(err))` (precedent `reconcile/apply-outcomes.ts:771`); `errorAddReason` `:335-348` uses `fsErrnoReason`; `redeclareRecordedSource` `:479-516` repair branch; `runAddInGuard` `:643-739` / `runAddOutcome` `:1040-1122` for D-PL5-19.

### `E/orchestrators/marketplace/update.ts` hosted refresh arm

**Analog:** `refreshRecord` url arm (`update.ts:409-470`):
```ts
const remoteUrl =
  source.kind === "github" || source.kind === "url" ? networkCloneUrl(source) : undefined;
...
} else if (source.kind === "url") {
  const cloneDir = await locations.sourceCloneDir(name);
  await refreshUrlClone({ cloneDir, source, gitOps, ctx, run: args.run, credentialOps, ... });
} else if (source.kind !== "path") {
  throw new Error(`Cannot update marketplace "${name}": unsupported source kind "${source.kind}"`);
```
Add `else if (source.kind === "hosted")`: fetch → staging file under `locations.sourcesStagingDir(uuid)` → `loadMarketplaceManifestDocument(stagingFile)` → `rename` over `recordedManifestPath(record)` → cleanup staging; fall through to the shared tail. `remoteUrl` must return `source.url` for hosted. `cloneAdvanced` stays false. Thread port through `UpdateMarketplaceOptions`, `UpdateAllMarketplacesOptions`, `RefreshOneArgs` as optional. Add `HostedManifestUnreadableError` → `unreadable` arm in `reasonsFromCascadeError` (and in `add.ts::classifyAddError`).

### `E/orchestrators/marketplace/remove.ts`

Hosted: extend `RecordedSourceKind` `:123`, narrowing `:896-900`, `removePath(sourceCloneDir)` condition `:1163-1173`. Fold: delete hand-rolled block `:440-457` and call `applyPartialCascadeFold(plugin, outcome.dropped)` imported from `../plugin/shared.ts` (legal: not a `PLUGIN_LEDGERS` member; `fallow trace` reports no cycle). Precedent import site: `uninstall.ts:102` / `:819`.

### `E/orchestrators/plugin/shared.ts` — `applyPartialCascadeFold` (`:1563-1607`)

Current per-axis hand-written filters (`:1592-1607`):
```ts
installed.resources.skills = installed.resources.skills.filter((n) => !dropped.skills.includes(n));
... (n) => !dropped.commands.includes(n)   // -> resources.prompts
installed.resources.hooks = installed.resources.hooks.filter((n) => !dropped.hooks.includes(n));
```
Replace with a typed table + typed key list (not `Object.entries`):
```ts
const DROPPED_AXIS_FIELD = { skills: "skills", commands: "prompts", agents: "agents",
  hooks: "hooks", mcpServers: "mcpServers", workflows: "workflows" } as const satisfies
  Record<keyof UnstageOutcome["dropped"], keyof PluginInstallRecord["resources"]>;
```
`UnstageOutcome` type-imported from `../marketplace/shared.ts` (already imported at `:54`). Callers unchanged: `install-cascade.ts:1317`, `enable-disable.ts:906,1730`, `uninstall.ts:819`.

### `E/domain/name.ts` / `E/domain/source.ts` / `E/persistence/state-io.ts`

- Predicate beside `isReservedRecordKey` (`name.ts:66-68`, `return name === "__proto__";`).
- `source.ts`: new `HostedManifestSource` in `ParsedSource`; funnel arm between path and URL arms (`:449-462`), not inside `parseUrlSourceForm`; `parseKindObjectSource` `:267-302` `case "hosted"`; D-PL5-13 first-delimiter split at `:411-435`; compile-forced `samePlannedSource :749`, `sourceLogical :795`.
- `state-io.ts::normalizeStoredSource` `:357-388`: hosted arm re-parses `obj.raw`; round-trip test in `test/persistence/state-io.test.ts` (Pitfall 1).

### `E/orchestrators/marketplace/info.ts` `buildBlock` (`:71-101`)

Project hosted as `{ sourceKind: "url", url: src.url }` (keeps notification types/json/grammar untouched).

### `E/edge/router.ts` (`market` alias)

**Analog:** `ls` everywhere it appears. `TOP_LEVEL_SUBCOMMANDS` `:86-106` (add `"market"`), usage line `:157` shows `(alias: ls)`. Dispatch (`:280-283`):
```ts
switch (head) {
  case "marketplace":
    return selectMarketplaceRoute(rest, handlers);
```
→ add `case "market":` fallthrough; commandId stays `"marketplace <verb>"`. Pins: `test/architecture/flag-catalog-drift.test.ts:120-125,210-232`, `test/edge/router.test.ts:98,115`, `test/edge/register.test.ts:148,165`, `features/plugin/help.feature:13,21,39`.

`E/edge/completions/provider.ts`: normalize `tokens[0] === "market"` to `"marketplace"` once before `:89-100`, `:158-183`, `:310-316` (avoids a 4-site clone group).

### `features/lib/https-git-host/server.ts` (static route)

**Analog:** `HttpsGitHost.receive` and `reset` (same file). Insertion point — after logging and arm check, before CGI:
```ts
const served = servedPath(logged.path, `https://${this.address}`);
if (served === undefined) { answerServerError(logged, res); return; }
const arm = armFor(this.arms, served);
if (arm !== undefined && failArmed(arm, logged, req, res)) { return; }
// <- static-file lookup here: set logged.status, res.end(bytes)
```
`reset()` clears state with `this.arms.clear(); this.log.splice(0); ...` — add a `this.statics.clear()` (a `private readonly statics = new Map<string, Buffer>()` beside `arms`). Public `serve(path, bytes)` / URL getter mirrors `repositoryUrl(directory, owner)`. Arms keyed by `repositoryKey`; give static paths an arm key so 404/500/drop arms apply. Cert trust needs nothing (`features/support/pi-process.ts:88` sets `NODE_EXTRA_CA_CERTS`). Cover in `test/architecture/https-git-host-server.test.ts`.

### `features/lib/published-marketplace.ts`

- Hosted publication: add `"hosted"` to `SourceKind` (`:30`) and `parseSourceKind` (`:103`), and a `case "hosted"` in `publishMarketplaceIn` (`:186-231`) that calls `writeMarketplace(root, name, plugins, manifestPath)` then registers the bytes with the git host's static route; `source` = served https URL. Reuse `republishMarketplace`/`rewritePublishedManifest` (`:278-289`) for refresh scenarios.
- Anthropics-owner publication (Pitfall 2 fixture migration): generalize `publishOfficialMarketplace` (`:238-262`), which today throws unless `name === "claude-plugins-official"`; keep `OFFICIAL_OWNER = "anthropics"` and the `repositoryPath(dir, OFFICIAL_OWNER)` / `repositoryShorthand(dir, OFFICIAL_OWNER)` calls.

### Steps: `features/step_definitions/marketplace/publishing.steps.ts`

**Analog** (`:64-78`):
```ts
Given(
  "the marketplace {string} is published as the official marketplace",
  async function (this: ScenarioWorld, name: string) {
    if (this.publishedMarketplace(name) !== undefined) { assert.fail(...); }
    this.onRelease(() => rm(path.join(this.marketplacesRoot, name), { recursive: true, force: true }));
    const published = await publishOfficialMarketplace(this.publicationSites, name);
    this.recordPublished(name, published);
  },
);
```
New `Given`s: `the marketplace {string} is published by the anthropics organization`; D-PL5-18 directory-manifest and D-PL5-17 deleted-clone `Given`s go in `add.steps.ts` next to `the manifest of the marketplace {string} to add cannot be read`. If `{source kind}` gains `hosted`, the existing `is published as a {source kind} source` step covers hosted publication for free.

### Features: hosted scenarios + MKT-05

**Analog:** `features/marketplace/url-source.feature:7-22`:
```gherkin
Scenario: Adding a url marketplace clones it from the git host
  Given the marketplace "tools" is published as a url source
  When the user runs "/claude:plugin marketplace add https://{git host}/acme/tools.git --scope project"
  Then the result lists these marketplaces:
    | name  | scope   | status |
    | tools | project | added  |
  Then the git host receives these requests:
    | method | path | status |
```
Refresh analog: `features/marketplace/url-source-update.feature`. Offline proofs for list/info/install: `Then the git host receives no request` after each `When` (D-PL5-08).

## Shared Patterns

- **Network DI port:** `GitOps`/`DEFAULT_GIT_OPS` (`orchestrators/marketplace/shared.ts:150-230`) with `?? DEFAULT_…` fallback at the call site (`add.ts:604`). Apply to the hosted fetcher in add/update/install-outcome path.
- **Staging + atomic rename + MA-9 leak append:** `cleanupStaging`, `appendLeakToError`, `joinLeaks`, `UnremovableLeftoverCloneError` (`add.ts:1225-1317`). Apply to hosted add, hosted refresh, D-PL5-17 repair.
- **Error classification reuse:** shape fetch errors like isomorphic-git (`code: "HttpError"`, `data.statusCode`; errno `code`) so `classifyGitTransportFailure` / `classifyGitHostFailure` / `hostHttpFailureFrame` (`shared/git-failure-classifiers.ts:25-82`) work unchanged.
- **Typed errors:** `extends Error`, `this.name = …`, readonly fields, `instanceof` discrimination (`shared/errors.ts:606-624`).
- **Marketplace subject rows:** `marketplaceSubject: true` → `rowId` emits bare name (`shared/notification-json.ts:456-462`).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| Redirect host-class check inside `platform/hosted-manifest-fetch.ts` | utility | transform | No hand-rolled IP/hostname classifier exists; `node:net` is banned. Use RESEARCH Pattern 2 upstream rule (`Ase`) as the spec. |

## Metadata

**Analog search scope:** `E/platform`, `E/domain`, `E/orchestrators/{marketplace,plugin}`, `E/edge`, `features/lib`, `features/step_definitions/marketplace`, `features/marketplace`, `test/platform`, `test/domain`, `test/architecture`
**Files scanned:** ~20
**Pattern extraction date:** 2026-10-26
