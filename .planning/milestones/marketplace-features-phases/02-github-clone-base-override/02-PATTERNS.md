# Phase 2: GitHub Clone-Base Override - Pattern Map

**Mapped:** 2026-10-15
**Files analyzed:** 15
**Analogs found:** 13 / 15 (README/CHANGELOG follow skills, not code analogs)

All paths are relative to the repo root; `E/` = `extensions/pi-claude-marketplace/`. All analogs are git-tracked.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `E/shared/github-base-url.ts` (NEW) | utility (env reader + validator + rewrite) | transform | `E/platform/workflow-home.ts` | role-match |
| `E/shared/errors.ts` (+ `InvalidGitHubBaseUrlError`) | model (typed error) | n/a | `StaleSourceCloneError` in same file (lines ~301-313) | exact |
| `E/platform/git.ts` (clone/fetch/resolveRemoteRef/listRemoteTags) | platform wrapper | request-response (network) | itself; `clone` :362-390 conditional-spread style | exact (in place) |
| `E/orchestrators/auth-host.ts` (drop `GITHUB_HOST`, add GitHub auth helper) | service | request-response | `buildCloneAuth` / `buildAuthForHost` in same file | exact |
| `E/orchestrators/marketplace/add.ts` (:95, :974) | orchestrator | request-response | `update.ts:398-408` auth build | exact |
| `E/orchestrators/marketplace/update.ts` (:398-408) | orchestrator | request-response | itself | exact |
| `E/orchestrators/plugin/update-flow.ts` (:145-191) | orchestrator | request-response | itself (move auth into github arm) | exact |
| `E/domain/clone-key.ts:83` | domain | transform | n/a (disable or seam constant) | n/a |
| `E/domain/source.ts`, `E/domain/auth-registry.ts` | domain | — | disable-with-reason lines only | n/a |
| `eslint.config.js` (D-06 local rule) | config | — | `plugins: {` block at :141 and BLOCK F :484-532 | role-match |
| `tests/shared/github-base-url.test.ts` (NEW) | test | — | `tests/platform/workflow-home.test.ts` (hermeticHome :26-49) | exact |
| `tests/platform/git.test.ts` (+ override cases) | test | — | `installRepositoryTransport` :301-341 in same file | exact |
| `tests/orchestrators/{auth-host,marketplace/add,marketplace/update,plugin/update-flow}.test.ts`, `tests/domain/clone-key.test.ts` | test | — | existing cases in each file + env restore pattern | exact |
| `README.md`, `README.es.md` | docs | — | `.agents/skills/readme/SKILL.md` | no code analog |
| `CHANGELOG.md` | docs | — | `.agents/skills/changelog/SKILL.md` | no code analog |

## Pattern Assignments

### `E/shared/github-base-url.ts` (utility, transform)

**Analog:** `E/platform/workflow-home.ts` (whole file, 41 lines)
- File header comment explains the rule and that the module "reads the environment ... and holds no state", read on every call (lines 18-22). Copy that shape; cite GHB-01..03, D-01, D-05, D-09, D-MF-01 (no phase numbers).
- Empty value = default (lines 11-12, 36): `if (process.env.PI_CODING_AGENT_DIR) { ... }` -> truthiness check, so `""` is unset (D-09).
```ts
export function workflowHomeDir(): string {
  if (process.env.PI_CODING_AGENT_DIR) {
    return path.join(getAgentDir(), "workflows");
  }
  return path.join(os.homedir(), ".pi", "workflows");
}
```
- API sketch and validation table: 02-RESEARCH.md "Seam (sketch)" and Pattern 5. Read env only after the `https://github.com/` prefix match. Export only what production imports (fallow dead-code). Must NOT be named `platform/git*` (BLOCK F regex `platform/git`, eslint.config.js:501). `shared/` imports nothing internal except `shared/errors.ts`.

### `E/shared/errors.ts` (+ `InvalidGitHubBaseUrlError`)

**Analog:** `StaleSourceCloneError` (errors.ts ~301-313):
```ts
export class StaleSourceCloneError extends Error {
  readonly absPath: string;
  readonly mpName?: string;
  constructor(absPath: string, mpName?: string) {
    super(`stale source clone at ${absPath}`);
    this.name = "StaleSourceCloneError";
    this.absPath = absPath;
    ...
  }
}
```
Fields: `readonly variable`, `readonly problem: "scheme" | "userinfo" | "query" | "fragment" | "not-a-url"`. Message names the variable, never the value (AUTH-09), contains no `/` (Pitfall 4 redaction). Doc comment cites GHB-03. Paired test `tests/shared/errors.test.ts` gains a case.

### `E/platform/git.ts` (network chokepoint)

**Analog:** the existing conditional-spread style in `clone` (:362-390) and `fetch` (:392-405):
```ts
const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
await git.clone({
  fs, http, dir: opts.dir,
  url: opts.url,
  ...(opts.ref !== undefined && { ref: opts.ref }),
  ...(authCbs !== undefined && { onAuth: ..., onAuthFailure: ... as git.AuthFailureCallback }),
});
```
Apply: `url: gitHubWireUrl(opts.url)`; `if (wire !== opts.url) await git.setConfig({ path: "remote.origin.url", value: opts.url })`; in `fetch`, `getConfig` the recorded `remote.<remote ?? "origin">.url` and spread `...(wire !== recorded && { url: wire })`. Same for `resolveRemoteRef` (:458) and `listRemoteTags` (:540); their thrown messages name the wire URL. `fetched <wire url>` cause tail only when rewritten (D-10; precedent `refreshUrlClone` in `orchestrators/marketplace/shared.ts:379-389`). Full sketch: 02-RESEARCH.md "Platform clone/fetch".

### `E/orchestrators/auth-host.ts`

**Analog (same file):** `buildAuthForHost` short-circuits to stored credential when no provider:
```ts
const provider = findProviderForHost(host);
if (provider === undefined) {
  return buildStoredCredentialAuth(host, credentialOps);
}
```
and `buildCloneAuth` forwards optional fields with conditional spreads:
```ts
return buildAuthForHost({
  host: hostFromCloneUrl(cloneUrl, kind),
  credentialOps: auth.credentialOps, ctx: auth.ctx, run: auth.run,
  ...(auth.deviceFlowHttp !== undefined && { deviceFlowHttp: auth.deviceFlowHttp }),
  ...(auth.authMemo !== undefined && { authMemo: auth.authMemo }),
});
```
New `buildGitHubAuth`: override set -> `buildStoredCredentialAuth(overrideHost, credentialOps)` unconditionally (Pitfall 3); else `buildAuthForHost({ host: "github.com" via seam })`. Delete `export const GITHUB_HOST = "github.com";` (:81) so `tsc` lists readers (`add.ts:95,974`, `update-flow.ts:79,151`). `hostFromCloneUrl` github arm -> seam host; non-github arm -> `new URL(gitHubWireUrl(cloneUrl)).host` (D-09, git-subdir).

### `E/orchestrators/marketplace/update.ts` (:395-408)

Current code to replace (the inline literal):
```ts
const host = hostFromCloneUrl(
  `https://github.com/${source.owner}/${source.repo}.git`,
  "github",
);
const auth = buildAuthForHost({ host, credentialOps, ctx, run: args.run,
  ...(deviceFlowHttp !== undefined && { deviceFlowHttp }) });
```
-> `buildGitHubAuth({ credentialOps, ctx, run: args.run, ...deviceFlowHttp spread })`. Also: rethrow `InvalidGitHubBaseUrlError` past the per-target catch in `refreshOneMarketplace` (fold at ~:694), mirroring `add.ts:570-575` (D-08).

### `E/orchestrators/marketplace/add.ts` (:974 `addGithubInGuard`)

Same substitution as update.ts; `add.ts:570-575` already rethrows unclassified errors (the D-08 precedent to copy into update and plugin verbs).

### `E/orchestrators/plugin/update-flow.ts` (`makeSyncCloneOnce` :145-191)

Current eager build (Pitfall 2):
```ts
const auth = buildAuthForHost({ host: GITHUB_HOST, credentialOps, ctx: opts.ctx, run: opts.run, ... });
...
if (source.kind === "github") {
  const cloneDir = await locations.sourceCloneDir(mpName);
  await refreshGitHubClone(cloneDir, source.ref, gitOps, undefined, auth);
```
Move the `buildGitHubAuth(...)` call inside the `source.kind === "github"` arm so path-only runs never read the variable.

### `eslint.config.js` (D-06 `no-github-literal`)

**Analogs:** existing `plugins: {` registration (:141) and BLOCK F (:484-532) for a files-scoped block with an ID-citing comment:
```js
{
  // BLOCK F (NFR-5 / PI-2 / PL-3 / PRL-07): default-deny. ...
  files: ["extensions/pi-claude-marketplace/orchestrators/**/*.ts", ...],
  ignores: NETWORK_SEAMS,
  rules: { "no-restricted-imports": [...], "no-restricted-syntax": [...] },
},
```
Do NOT use `no-restricted-syntax` (flat config replaces options per block; APPEND block :477-482 and BLOCK F both redefine it). Use an inline local plugin rule (sketch in 02-RESEARCH.md Pattern 4): block A over `extensions/pi-claude-marketplace/**/*.ts` registers + enables; a later block turns it `"off"` for `shared/github-base-url.ts` (not `ignores`). Disables: `// eslint-disable-next-line <ns>/no-github-literal -- <reason>` at `auth-registry.ts:54-56`, `source.ts:614/630/644/762`, and `clone-key.ts:83` unless it imports a seam constant. Unused directives fail lint (`--max-warnings 0`).

### `tests/shared/github-base-url.test.ts` (NEW pair) and env cases in owner tests

**Analog:** `tests/platform/workflow-home.test.ts` `hermeticHome` (:26-49):
```ts
const previousAgentDirectory = process.env.PI_CODING_AGENT_DIR;
t.after(async () => {
  if (previousAgentDirectory === undefined) {
    delete process.env.PI_CODING_AGENT_DIR;
  } else {
    process.env.PI_CODING_AGENT_DIR = previousAgentDirectory;
  }
});
delete process.env.PI_CODING_AGENT_DIR;
```
Register restore before mutating; delete (never assign `undefined`). Optional shared helper `tests/shared/github-base-url-environment.ts` (staging it makes `check:commit` run all pairs). Must hit 100% direct coverage: unset, empty, prefix miss, each refusal, path prefix, trailing slashes, host with port, IPv6.

### `tests/platform/git.test.ts` (override cases)

**Analog:** `installRepositoryTransport` (:301-341) mocks `http.request` keyed on `REMOTE_URL` (:68 `https://${HOST}/owner/repo.git`) and throws on unplanned URLs:
```ts
t.mock.method(http, "request", async (request) => {
  const infoUrl = `${REMOTE_URL}/info/refs?service=git-upload-pack`;
  if (request.url === infoUrl && request.method === "GET") { ... }
  if (request.url === `${REMOTE_URL}/git-upload-pack` && request.method === "POST") { ... }
  throw new Error(`unplanned Git HTTP request: ...`);
});
```
Add a variant parameterized by the wire URL: clone `https://github.com/owner/repo.git` with the variable set, assert requests hit `<base>/owner/repo.git` and `remote.origin.url` stays canonical; fetch, resolveRemoteRef, listRemoteTags same; unset cases need no new tests (existing suite proves GHB-04).

## Shared Patterns

- **Env read + restore:** `platform/workflow-home.ts` + `tests/platform/workflow-home.test.ts:26-49`. Apply to the seam and every override test case.
- **Typed errors:** `shared/errors.ts` class shape (`extends Error`, `this.name`, readonly fields, ID-citing doc). Callers narrow with `instanceof`.
- **Conditional spread for optional/unchanged-when-unset options:** `platform/git.ts` and `auth-host.ts` `...(x !== undefined && { k: x })`. This is how unset stays byte-identical.
- **Command-level rethrow:** `add.ts:570-575` for D-08.
- **Comments:** cite GHB-0x / D-0x / D-MF-01 only; no comments on trivial code.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `README.md` / `README.es.md` | docs | Follow `.agents/skills/readme/SKILL.md`; both copies in one commit; placement near `README.md:200-235` |
| `CHANGELOG.md` | docs | Follow `.agents/skills/changelog/SKILL.md`; one bullet under `## [Unreleased]` |
| Local ESLint plugin rule body | config | No existing custom rule in `eslint.config.js`; use the RESEARCH Pattern 4 prototype |

## Metadata

**Analog search scope:** `E/platform`, `E/shared`, `E/orchestrators/{auth-host.ts,marketplace,plugin}`, `eslint.config.js`, `tests/platform`
**Files scanned:** ~12
**Pattern extraction date:** 2026-10-15
