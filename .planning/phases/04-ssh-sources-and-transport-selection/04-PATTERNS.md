# Phase 4: SSH Sources and Transport Selection - Pattern Map

**Mapped:** 2026-11-25
**Files analyzed:** 27 (new and modified, grouped below)
**Analogs found:** 25 / 27

All paths are relative to the repo root; extension paths drop the `extensions/pi-claude-marketplace/` prefix where marked `ext/`. Every analog named is git-tracked (checked with `git ls-files`). Line numbers come from RESEARCH §A and from reads made for this file on 2026-11-25.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `ext/domain/git-url.ts` (NEW, `iTs` port) | utility (pure validator) | transform | `ext/domain/source.ts` `unsupportedUrlReason`/`rejectedScheme` 100-124 (replaced), `refRefusal` 161-163 | role-match |
| `ext/domain/github-transport.ts` (NEW, pure plan + note kinds) | utility (pure policy) | transform | `ext/domain/release-tag.ts` (pure, transport-free, structural input types) | role-match |
| `ext/domain/clone-key.ts` (+ `gitHubRepoOf`, `Ort` fold; `originMatchesSource` 121-131) | utility | transform | same file, `canonicalCloneUrl` 86-88 / `networkCloneUrl` 99-108 | exact |
| `ext/domain/source.ts` (scp + http arms, gated url/raw/git-subdir url, `samePlannedSource`) | utility (parser) | transform | same file, `gatedUrlField` 237-242, `parseUrlSourceForm` 490-506 | exact |
| `ext/domain/name.ts` (`reservedMarketplaceNameRefusal` 97-113 folds url kinds) | utility | transform | itself | exact |
| `ext/platform/git-process.ts` (+ `runSsh`, ssh lookup, override facts) | platform (spawn site) | request-response | same file `run` 1036-1075 + `findGitOnPosix` 784-797 + `sshEnvironment` 554-582; second-program analog `ext/platform/package-manager.ts` 113-127 | exact |
| `ext/platform/git.ts` (+ probe, `-G`, `--get-url`, Windows `-G` through git) | platform (verbs) | request-response | same file `runRemote` 285-302 | exact |
| `ext/platform/git-failure-kind.ts` (`ssh-auth` detail) | utility (classifier table) | transform | same file ROWS 80-128 (`git-missing` already carries `detail`) | exact |
| `ext/shared/github-base-url.ts` (SSH-form `insteadOf` pairs, wire URL) | utility | transform | same file `gitHubInsteadOfPairs` 114-121, `gitHubWireUrl` 95-102 | exact |
| PREFER_HTTPS reader (moved D-SG-15 reader, e.g. `ext/shared/upstream-flag.ts`) | utility | transform | `ext/orchestrators/marketplace/clone-swap.ts` 97-110 | exact |
| `ext/orchestrators/github-transport.ts` (NEW, context + `runOverTransports`) | service (non-seam) | request-response | `ext/orchestrators/auth-host.ts` `buildAuthForHost` 180-225 (memo threaded per command) | role-match |
| `ext/orchestrators/marketplace/{add,clone-swap,update,shared}.ts` | service (seams) | request-response | `clone-swap.ts` `checkFreshness` 232-259 / `cloneIntoStaging` 303-326; `add.ts` `gitStagingSteps` 920-951 | exact |
| `ext/orchestrators/plugin/{clone-cache,install-flow-cascade-context,install-outcome,install-clone-probe,update-flow,update-preflight,reinstall-flow,fetch,info,dependency-tag-probe,marketplace-tag-probe}.ts` | service | request-response | `authMemo` threading, `install-flow-cascade-context.ts` 60-71, 116-180 | exact |
| `ext/orchestrators/auth-host.ts` (`hostFromCloneUrl` 108-114 scp-safe) | utility | transform | itself | exact |
| `ext/orchestrators/import/marketplaces.ts` (+ `git` kind, 40-67) | service | transform | its own `url`/`github` cases | exact |
| `ext/shared/errors.ts` (+ `GitHubTransportsFailedError`) | model (error) | - | `StaleSourceCloneError` / `MarketplaceUpdateError` (cause bag) | exact |
| `ext/shared/notification-{types,wire,json,grammar}.ts` (row `clone?` field) | model + transform | transform | row `hint` field: `notification-wire.ts` 181-187, 268, 310 | role-match |
| `features/lib/ssh-git-host/*` (existing stand-in; no change expected) | test support | - | itself | exact |
| `features/step_definitions/ssh-host.steps.ts` (NEW) or additions to `git-host.steps.ts` | test (steps) | request-response | `features/step_definitions/git-host.steps.ts` 359-388, 398-403 | exact |
| `features/support/world.ts` (+ PREFER_HTTPS profile variable) | test support | - | same file 251-257, 811-820 | exact |
| `features/lib/pi-rpc.ts` `RpcGitEnvironment` (+ variable) | test support | - | same file 54-90 | exact |
| `features/marketplace/ssh-source.feature`, `features/marketplace/github-transport.feature`, `features/plugin/github-transport.feature` (NEW) | test (behavioral) | - | `features/marketplace/github-source.feature`, `device-flow.feature` | role-match |
| `features/marketplace/unsupported-source.feature` (21-28 flip) | test | - | itself | exact |
| `test/architecture/hermetic-git-environment.test.ts` | test (architecture) | - | itself 64-110, 450-478 | exact |
| `eslint.config.js` `NETWORK_SEAMS` / `NETWORK_SEAM_NAMES` (expected unchanged) | config | - | itself 64-109 | exact |
| `test/domain/git-url.test.ts`, `test/domain/github-transport.test.ts`, `test/orchestrators/github-transport.test.ts` (NEW pairs) | test | - | `test/domain/source.test.ts`, `test/platform/git-process.test.ts` 154-170 (`createHost({platform:"win32"})`) | role-match |
| WINDOWS ledger entry, PROJECT.md / AGENTS.md NFR-5 text | docs | - | none (record-keeping; `gsd-tools windows append`) | n/a |

## Pattern Assignments

### `ext/domain/git-url.ts` (pure validator, NEW)

**Analog:** `ext/domain/source.ts` 100-124 (the text this replaces). Shape: a module-private function per rule returning a message string; caller gets `string | undefined`.

```ts
function unsupportedUrlReason(raw: string): string {
  const scheme = rejectedScheme(raw);
  return `${raw} is not supported; ${scheme} URLs are rejected -- only https:// URLs and local paths are accepted`;
}
```

Wire-in point, `source.ts` 237-242 (replace the https-only gate with the validator; keep `unknownObjectSource` as the refusal carrier):

```ts
function gatedUrlField(obj: Record<string, unknown>, field: string): GitHubSource | UrlSource | UnknownSource {
  return parseUrlSourceForm(field) ?? unknownObjectSource(obj, nonRelativeReason(field));
}
```

Rules and messages: RESEARCH §B (10 rules, upstream order; `U` supported-list text). Domain zone imports `shared/` only. Watch Sonar/fallow on ported regexes (RESEARCH Pitfall 11): name each regex as a module constant, keep each rule a small function for the cognitive-complexity ceiling of 15. Redaction for display: reuse `shared/redact-credentials.ts`, do not port `jh`.

### `ext/domain/github-transport.ts` (pure plan, NEW)

**Analog:** `ext/domain/release-tag.ts` 1-30 — pure policy module, header comment explains why it takes structural input types instead of `platform/git.ts` types:

```ts
// `ReleaseTagCandidate` is a structural `{ name, oid }` shape rather than
// `platform/git.ts`'s `RemoteTag` type, so this module stays free of any
// transport concern.
```

Apply the same: probe result `"configured" | "not-configured" | "unknown"`, surface, `platform`, `preferHttps`, `baseOverride`, skip-check facts as plain structural inputs (lazy thunks for probe/checks). Output `{ transport: "ssh" | "https"; url }[]`, note kind, retry allowance. Order is RESEARCH §E steps 1-7 (non-Windows) and §W (Windows). Use `assertNever`-exhaustive switches on surface.

### `ext/domain/clone-key.ts` (`gitHubRepoOf` / `Ort`)

**Analog:** itself. Keep `canonicalCloneUrl` 86-88 byte-identical (directory keys). Replace `originMatchesSource` body 121-131, which currently is:

```ts
export function originMatchesSource(originUrl: string, source: GitHubSource | UrlSource): boolean {
  const origin = parsePluginSource(originUrl);
  if (origin.kind !== "github" && origin.kind !== "url") {
    return false;
  }
  const originIdentity = normalizedIdentity(canonicalCloneUrl(origin));
  return (
    originIdentity !== undefined && originIdentity === normalizedIdentity(canonicalCloneUrl(source))
  );
}
```

New order: `gitHubRepoOf` on both sides first (lower-cased `owner/repo` equality), then the existing exact compare for non-GitHub. The SSH candidate URL is a new function beside `networkCloneUrl` (99-108); do not change `networkCloneUrl` (every caller expects HTTPS). Update the D-3-01/IN-05 doc comment (IN-05 closes). Fold rules: RESEARCH §C.

### `ext/platform/git-process.ts` (probe launch, `runSsh`)

**Analog 1, same spawn site's `run`** (1036-1075): lookup, cwd, `runProcess` with captures and `windowsHide: true`:

```ts
const processRun = await runProcess(
  { spawn: options.spawn, host },
  {
    command: git,
    args: gitArguments(request, rules, words),
    cwd,
    env: gitEnvironment(options.env, rules, request.lane, ssh, cwd),
    timeoutMs,
    killGraceMs: options.killGraceMs,
    signal: request.signal,
    ...(request.input !== undefined && { input: request.input }),
    stdout: STDOUT_CAPTURE,
    stderr: STDERR_CAPTURE,
    windowsHide: true,
  },
);
```

**Analog 2, launching a second program through `runProcess`** — `ext/platform/package-manager.ts` 113-127 (another chokepoint-exempt launcher of a non-git program; same `{ spawn, host }` first argument, its own env and capture). `runSsh` follows this shape but lives inside `createGitProcess` so it shares `host`, `options.spawn`, `options.env`, `killGraceMs`, and `neutralDirectory(operation)` (1101-1103). No new rule-pack exemption is needed because the launch stays in `git-process.ts` (`child-process-chokepoint`).

**Lookup analog** `findGitOnPosix` 784-797 (absolute PATH entries only, no cache on miss for ssh; return a "missing" fact instead of throwing `gitMissing`):

```ts
for (const directory of directories) {
  const candidate = path.posix.join(directory, "git");
  // eslint-disable-next-line no-await-in-loop -- PATH order decides which git runs
  if (await host.isExecutable(candidate)) {
    return candidate;
  }
}
```

Windows: reuse `findOnWindowsPath` (imported line 114) and `WINDOWS_LOOKUP_EXTENSIONS`.

**Request constant analog** `VERSION_REQUEST` 639: `const VERSION_REQUEST: GitRequest = { subcommand: "version", lane: "network", timeoutMs: 5_000 };` — define `SSH_PROBE` (argv per CONTEXT, `timeoutMs: 3_000`) and `SSH_PRINT_CONFIG` (`-G`, 5_000) the same way, closed purpose set as `GitSubcommand` 129-140 is.

**User override facts**: `sshEnvironment` 554-582 reads `userValue(base, "GIT_SSH_COMMAND", rules)` and `config.get("core.sshcommand")` from `SSH_CONFIG_READ` (445-451). The skip check needs "present, empty included" (Pitfall 4): write a separate reader over `spellingsOf(env, name, rules)` (669) instead of `userValue` (509), which treats empty as unset. Windows `-G` check: append ` -G >&2` to the `GIT_SSH_COMMAND` that `sshEnvironment` builds (`wrapped`, line 573), network lane.

Exports stay narrow: three existing `fallow-ignore-next-line unused-export` markers (969, 1157, 1179) — do not add new exported names only tests use.

### `ext/platform/git-failure-kind.ts` (`ssh-auth` detail)

**Analog:** same table, rows 80-128; `git-missing` already has a `detail`:

```ts
[127, { kind: "git-missing", detail: "not-found" }],
...
[/^\S+: Permission denied \(publickey/m, { kind: "ssh-auth" }],          // -> detail: "publickey"
...
[/^fatal: Could not read from remote repository/m, { kind: "ssh-auth" }], // -> detail: "unconfirmed"
```

Ripple: `shared/errors.ts` 1316 union, `shared/git-failure-classifiers.ts` 148, and every `{ kind: "ssh-auth" }` literal in tests/fakes in the same commit (Pitfall 9).

### `ext/shared/github-base-url.ts` (D-SG-21 SSH pairs)

**Analog:** itself, 114-121 — prefix check, then lazy `readGitHubBase()`:

```ts
export function gitHubInsteadOfPairs(url: string): readonly string[] {
  if (!url.startsWith(`${GITHUB_ORIGIN}/`)) {
    return [];
  }
  const base = readGitHubBase();
  return base === undefined ? [] : [`url.${base.url}/.insteadOf=${GITHUB_ORIGIN}/`];
}
```

Extend: for any URL `gitHubRepoOf` folds, emit the pair for the address's own prefix through the host separator (case-sensitive match; a fixed list misses spellings, RESEARCH §F). Keep "read the variable only after the prefix matched" (GHB-04). `gitHubWireUrl` 95-102 maps the SSH spellings the same way. Note `shared/` cannot import `domain/` (leaf); either put the prefix extraction in `shared/` or pass the folded form in — check `.fallowrc.json` zones before choosing.

### PREFER_HTTPS reader (D-SG-15 reuse)

**Analog:** `ext/orchestrators/marketplace/clone-swap.ts` 97-110:

```ts
export const KEEP_MARKETPLACE_ON_FAILURE_VARIABLE =
  "CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE";
const TRUE_VALUES: ReadonlySet<string> = new Set(["1", "true", "yes", "on"]);
export function keepMarketplaceOnFailure(env: NodeJS.ProcessEnv = process.env): boolean {
  return TRUE_VALUES.has((env[KEEP_MARKETPLACE_ON_FAILURE_VARIABLE] ?? "").trim().toLowerCase());
}
```

Move `TRUE_VALUES` and a generic `upstreamFlagIsTrue(name, env)` into a `shared/` module, keep `keepMarketplaceOnFailure` as a thin caller (so its existing tests and callers stay), add `preferHttps(env = process.env)`. One body only, or `fallow dupes` fails. New source file needs its test pair (`test:corresponding`).

### `ext/orchestrators/github-transport.ts` (context + runner, NEW, not a seam)

**Analog for the per-command memo:** `ext/orchestrators/auth-host.ts` 180-225 — optional memo passed in by the command root, read-then-set, debug line on reuse:

```ts
authMemo?: Map<string, AuthAttemptResult>;
...
const memoized = authMemo?.get(host);
if (memoized !== undefined) {
  hookDebugLog(`reusing the sign-in for ${host}`, "auth");
  return memoized;
}
...
authMemo?.set(host, result);
```

Context `{ sshProbe?: Promise<SshProbeResult>; notes: ... }` built at the same command roots that allocate `authMemo` today:
- `orchestrators/plugin/update-flow.ts:512` `authMemo: opts.authMemo ?? new Map<string, AuthAttemptResult>(),`
- `orchestrators/plugin/reinstall-flow.ts:550`, `orchestrators/plugin/fetch.ts:157`, `orchestrators/plugin/info.ts:267`
- install root `install-flow.ts` (`createInstallPlugin`), `reconcile/apply.ts` (~327), `import/execute.ts`.
- NOT `marketplace/update.ts:507` (marketplace path probes each clone, CONTEXT).

Name the field and type so they do not match BLOCK F's `NETWORK_SEAM_NAMES` (eslint.config.js 107-108: `gitOps|DEFAULT_GIT_OPS|refreshCloneBySwap|hostedManifestFetch|...`). The module must not import `platform/git` (it is outside `NETWORK_SEAMS`); seams pass `attempt` closures in.

### Threading through the install cascade

**Analog:** `ext/orchestrators/plugin/install-flow-cascade-context.ts` 60-71 (options type) and the conditional-spread forwarding at 62-64, 270, 443:

```ts
export interface CascadeInstallOptions {
  ...
  readonly authMemo?: Map<string, AuthAttemptResult>;
  readonly tagProbe?: CascadeTagProbe;
  ...
}
...
...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
```

Add the transport context as a separate field next to `authMemo` everywhere it is forwarded (`grep -rn authMemo ext/` ~64 sites, 20 files), so Phase 5 can delete `authMemo` without untangling it (`exactOptionalPropertyTypes` requires the conditional-spread form).

### Marketplace seams (`add.ts`, `clone-swap.ts`, `update.ts`)

- `clone-swap.ts`: `CloneSwapArgs.url` (138) becomes `urls: readonly string[]`; `checkFreshness` 232-259 and `cloneIntoStaging` 303-326 loop over the list in order (`// eslint-disable-next-line no-await-in-loop -- <reason>` as at git-process.ts 790). Callers `marketplace/update.ts` 552-571, `plugin/update-flow.ts` 297, `plugin/clone-cache.ts` 610-640 change in one commit.
- `add.ts` `gitStagingSteps` 920-951 wraps the single `networkCloneUrl(source)` clone (935-940) with `runOverTransports`. `parseAddableSource` 780-813 gains a `commandLine` flag passed only by `edge/handlers/marketplace/add.ts`.

### `ext/shared/errors.ts` (`GitHubTransportsFailedError`)

**Analog:** CONVENTIONS `StaleSourceCloneError` pattern plus the `{ cause }` option of `MarketplaceUpdateError`: `extends Error`, `this.name = "GitHubTransportsFailedError"`, readonly typed fields (both attempts' transport and URL, last `GitFailure`), doc comment citing D-SG-22. Classify via `instanceof` in the classifier arm, never by message.

### Notification `clone?` row field

**Analog:** the optional closed-set row field `hint`:

```ts
// notification-wire.ts 181-187
const ROW_HINTS = {
  "partial-install": true,
  ...
  enable: true,
} as const satisfies Record<RowHint, true>;
// 268
const ROW_HINT = literalEnum(ROW_HINTS);
// 310 (plugin row schema)
hint: Type.Optional(ROW_HINT),
```

Enroll `transport` (`ssh | https`) and `why` (`configured | not-configured | preferred-https | ssh-only`) as `Record<..., true>` + `literalEnum`, add `clone: Type.Optional(Type.Object({...}, { additionalProperties: false }))` on the plugin row (302-313) and the marketplace row (329-331). JSON projection follows the conditional-spread style of `wireAdvisories` (`notification-json.ts` 400-410):

```ts
...(carrier.advisories === undefined ? {} : { advisories: [...carrier.advisories] }),
```

Types: `TransitionMessageBase` (417-420) and `MpCommon`/`MpAdded`/`MpUpdated`/`MpFailed` (951-970) in `notification-types.ts`. Do not use `advisories` (cascade-level, not per row; RESEARCH §N). URL in github.com terms (GHB-04). Rebaseline catalog fixtures and run `npm run schema:generate` if the schema is committed.

### Cucumber steps (SSH stand-in, profile)

**Stand-in (built, unused):** `features/lib/ssh-git-host/launch.ts` 28-39:

```ts
export type SshProbeArm =
  | { readonly kind: "authenticated"; readonly user: string }
  | { readonly kind: "denied" }
  | { readonly kind: "host-key" }
  | { readonly kind: "hold" };
export interface SshHostArm { readonly probe: SshProbeArm; readonly proxy?: string; }
```

`features/lib/ssh-git-host/host.ts`: `searchPath()` 93, `register(host, arm)` 98, `mark()` 116, `launchesSince(window)` 121, `reset()` 134. Already wired: `features/support/pi-process.ts` 162-175 (`PATH: sshHost.searchPath()`), 252 (`run.sshHost.reset()`), 284 (empty-snapshot assertion `sshHost: await run.sshHost.snapshot()`).

**Profile Given analog:** `features/step_definitions/git-host.steps.ts` 359-388 (`pi runs with github's requests routed to the stand-ins`): CONNECT proxy + `usePiWithProfile({ withoutGitHubBaseOverride: true, httpsProxy })`. Extend that profile with optional `variables` (PREFER_HTTPS) rather than a new launcher.

**Then-table analog** (per-`When` window), git-host.steps.ts 398-403:

```ts
const rows = this.requestsOfLastCommand().requests.map((request) => [
  request.method, request.path, String(request.status),
]);
assert.deepStrictEqual([["method", "path", "status"], ...rows], table.raw());
```

New `the ssh stand-in receives these launches:` uses `mark()` before the `When` and `launchesSince` after, `argv` joined by spaces, whole-table compare.

**Scenario Pi variables:** `features/support/world.ts` 251-257 `ScenarioPiVariables` Pick, and the per-variable starter (811-820):

```ts
async usePiWithKeptMarketplaceOnFailure(value: string): Promise<void> {
  await this.usePiWithVariables({ CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: value });
}
```

Add `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` to the Pick and to `RpcGitEnvironment` in `features/lib/pi-rpc.ts` 54-90 (documented optional member, "set only for a scenario's own Pi"). A user `GIT_SSH_COMMAND` skip-check scenario needs a profile variable pointing at the stub `ssh`. Skip-check config Givens write `GIT_CONFIG_GLOBAL` (`<home>/.gitconfig`).

**Feature files:** new `features/marketplace/ssh-source.feature` (shared Pi, register `127.0.0.1`, add `git@127.0.0.1:acme/tools.git`), `features/{marketplace,plugin}/github-transport.feature` (profile Pi, probe arms, fallback both ways, PREFER_HTTPS no-probe). Model on `features/marketplace/github-source.feature` (request rows 19-23) and `device-flow.feature` (profile Pi). Flip `features/marketplace/unsupported-source.feature` 21-28 per RESEARCH §X. Every behavior change ships a failing-without-change scenario (AGENTS.md).

### Architecture tests

**Hermetic environment:** `test/architecture/hermetic-git-environment.test.ts` — `CLAUDE_CODE_PLUGIN_PREFER_HTTPS: "1"` already sits in `INHERITED_VARIABLES` (line 95), so the shell value must not leak. Add it in the "only a scenario's own Pi gets them" case beside the two upstream variables (450-478):

```ts
const git = {
  ...
  CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS: "1000",
  CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: "true",
} satisfies RpcGitEnvironment;
...
assert.deepStrictEqual(environment, { ..., CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE: "true" });
```

**Network seams:** `eslint.config.js` 64-109 (`NETWORK_SEAMS` list with one-line reasons, `NETWORK_SEAM_NAMES`). Expected unchanged: the probe launches from `platform/git-process.ts`, the runner names no git surface. `test/edge/handlers/plugin/fetch.test.ts:60` references the list by comment only. If a new module must name the git surface, add it with a reason line, matching the existing entries.

## Shared Patterns

### Optional fields under `exactOptionalPropertyTypes`
**Source:** `install-flow-cascade-context.ts` 62-64; `notification-json.ts` 405
**Apply to:** every forwarded transport context, the `clone?` row field
```ts
...(opts.authMemo !== undefined && { authMemo: opts.authMemo }),
```

### Sequential loops
**Source:** `platform/git-process.ts` 790
**Apply to:** URL-list loops in `clone-swap.ts`, the runner, the ssh lookup
```ts
// eslint-disable-next-line no-await-in-loop -- <the constraint that forces sequence>
```

### Typed failures, `instanceof` discrimination
**Source:** CONVENTIONS Error Handling; `platform/git-failure-kind.ts` ROWS
**Apply to:** retry rules (read `kind`/`detail`, never stderr text in orchestrators), `GitHubTransportsFailedError`

### Debug lines
**Source:** `auth-host.ts` (`hookDebugLog(message, category)`)
**Apply to:** skip-check outcomes ("staying on SSH" lines, RESEARCH §E), probe errors

### Port beside `DEFAULT_GIT_OPS`, not new `GitOps` members
**Source:** RESEARCH §D; binding site `orchestrators/marketplace/shared.ts`
**Apply to:** the SSH verbs (avoids rippling into `test/platform/git-ops-fake.ts` and `test/platform/system-git-ops.ts`); give it a name BLOCK F does not match; add a `create*Fake` in `test/platform/`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `ext/domain/git-url.ts` rules themselves | validator | transform | No existing multi-scheme git validator; port verbatim from RESEARCH §B / Code Examples (`iTs`) |
| Windows `-G`-through-git check | platform | request-response | No existing git command with an appended ssh option; derive from `sshEnvironment` 573 and RESEARCH §W; unit rows with `createHost({ platform: "win32" })` (`test/platform/git-process.test.ts` 154-170) |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,platform,shared,orchestrators}`, `features/{lib,support,step_definitions,marketplace}`, `test/architecture`, `eslint.config.js`
**Files scanned:** ~30
**Pattern extraction date:** 2026-11-25
