# Phase 1: Harness on System Git - Pattern Map

**Mapped:** 2026-11-23
**Files analyzed:** 20 (plus about 15 inline fixture-migration test files listed in RESEARCH.md "Fixture Migration Inventory")
**Analogs found:** 20 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `features/lib/hermetic-git.ts` (MOD) | utility (env builder + runner) | request-response (subprocess) | itself, lines 16-42 | exact |
| `test/platform/git-test-repository.ts` (REWRITE) | test fixture builder | file-I/O | itself (API) + `features/lib/hermetic-git.ts` `runGit` | exact |
| `test/orchestrators/plugin/warm-mirror-seed.ts` (REWRITE) | test fixture | file-I/O | `test/platform/git-test-repository.ts` (new form) | role-match |
| ~15 inline isomorphic-git test files (MOD) | tests | file-I/O | new existing-directory helper in `git-test-repository.ts` | role-match |
| `features/lib/https-git-host/server.ts` (MOD) | stand-in server | request-response | itself, `GitHostArm` lines 72-79, `arm()` line 424 | exact |
| `features/lib/https-git-host/cgi.ts` (MOD) | stand-in CGI adapter | request-response | itself, `cgiEnvironment` lines 38-68, `runHttpBackend` line 134-140 | exact |
| `features/lib/ssh-git-host.ts` (NEW) | stand-in + executable stub | event/subprocess | `features/lib/state-lock-holder.ts` (self-spawning module), `features/lib/hook-files.ts:490-500` (`#!/bin/sh` wrapper), `HttpsGitHost` (lifecycle) | role-match |
| `features/lib/git-clones.ts` (MOD) | inspection helper | file-I/O | `features/lib/git-marketplace.ts` / `git-plugin.ts` (`runGit` callers) | role-match |
| `features/lib/pi-rpc.ts` (MOD) | env allowlist | transform | itself, `RpcGitEnvironment` 49-65, `rpcChildEnvironment` 192-215 | exact |
| `features/lib/real-subagent-child.ts` (MOD) | Pi launcher | request-response | itself 471-504 | exact |
| `features/support/pi-process.ts` (MOD) | cucumber lifecycle hooks | event-driven | itself 140-160 (`HttpsGitHost.start` + `piEnvironment`) | exact |
| `test/integration/subagent-hook-ownership.test.ts` (MOD) | integration test | request-response | itself 118-140 | exact |
| `test/integration/concurrent-install.test.ts`, `load-reconcile-race.test.ts` (MOD, optional) | integration fork env | subprocess | `rpcChildEnvironment` (from-scratch allowlist) | partial |
| `test/architecture/hermetic-git-environment.test.ts` (MOD) | test | transform | itself 1-130 | exact |
| `test/architecture/https-git-host-cgi.test.ts`, `https-git-host-server.test.ts` (MOD) | test | request-response | themselves | exact |
| `test/architecture/ssh-git-host.test.ts` (NEW) | test | subprocess | `test/architecture/https-git-host-server.test.ts` | role-match |
| `.github/workflows/ci.yml`, `e2e-nightly.yml` (MOD) | config | — | `ci.yml:85-91` named steps | exact |
| `package.json` e2e scripts (MOD) | config | — | existing `PI_CM_E2E_REF=...` script prefix | exact |

All named analogs verified git-tracked (`git ls-files`).

## Pattern Assignments

### `features/lib/hermetic-git.ts` (utility)

Base to extend (lines 16-42, verbatim):
```typescript
export function hermeticGitEnvironment(home: string): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: home,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_AUTHOR_NAME: "features",
    GIT_AUTHOR_EMAIL: "features@example.test",
    GIT_COMMITTER_NAME: "features",
    GIT_COMMITTER_EMAIL: "features@example.test",
  };
}

export async function runGit(cwd: string, home: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", ...args],
    { cwd, env: hermeticGitEnvironment(home) },
  );
  return stdout.trim();
}
```
Add a closed `HermeticGitVariables` interface (`GIT_AUTHOR_DATE`, `GIT_COMMITTER_DATE`, `GIT_SSL_CAINFO`, `GIT_PROTOCOL`) as an optional second param spread last (RESEARCH Pattern 1), plus a variant runner taking named variables and a stdin Buffer (for `pack-objects --stdout --revs`) returning a Buffer. Keep file header style (`@fileoverview`, DRV-03 citation). Async `execFile` only, never sync.

### `test/platform/git-test-repository.ts` (fixture builder)

Keep the exported API exactly (lines 15-30: `GitTestRepositoryOptions{boundary:"local"}`, `GitTestCommitFile`, `GitTestRepository{dir,gitdir,initialOid,commit,pack}`, `createGitTestDirectory`, `createGitTestRepository`). Keep the per-repository counter (line 55 `let commitIndex = 0;`, date `1_700_000_000 + commitIndex`, offset 0) -- not module-level (git.test.ts:362-373 asserts two repos share oids). Keep `mkdtemp` + `t.after(rm)` (lines 53-56). Replace `git.init/add/commit` with `runGit`-style calls through the shared builder; body per RESEARCH Pattern 2 (proven 124/124). Add an existing-directory helper (init, commit-all, tag, rev-parse, config get) so the ~15 inline sites do not create `fallow dupes` clone groups. Drop the `isomorphic-git` import.

### `features/lib/https-git-host/cgi.ts` + `server.ts` (refusing arm)

Union to extend (`server.ts:72-79`):
```typescript
export type GitHostArm =
  | { readonly kind: "status"; readonly status: ArmedStatus }
  | { readonly kind: "drop" }
  ...
  | { readonly kind: "redirect"; readonly location: string };
```
Add `| { readonly kind: "refuse-sha-want" }`; set through the existing `arm(directory, arm, owner)` (line 424), looked up by `armFor` (line 204). The arm must reach the CGI call rather than be answered in `receive`.

Env passthrough to make conditional (`cgi.ts`, inside `cgiEnvironment`):
```typescript
  const protocol = optionalHeader(request.headers, "git-protocol");
  if (protocol !== undefined) {
    environment.GIT_PROTOCOL = protocol;
  }
```
Spawn site (`cgi.ts:140`): `spawn("git", ["http-backend"], { env, stdio: ["pipe","pipe","pipe"] })` -> prepend config args: default `-c uploadpack.allowReachableSHA1InWant=true`; refusing `-c uploadpack.allowReachableSHA1InWant=false -c uploadpack.allowAnySHA1InWant=false` and no `GIT_PROTOCOL`. Use `-c`, never `GIT_CONFIG_COUNT`.

### `features/lib/ssh-git-host.ts` (NEW)

Self-spawn idiom (`state-lock-holder.ts:39` and `:136-143`):
```typescript
const thisFile = fileURLToPath(import.meta.url);
...
if (process.argv[1] === thisFile) {
  const [, , extensionRoot, lockFile] = process.argv;
  if (extensionRoot === undefined || lockFile === undefined) {
    throw new Error("usage: state-lock-holder.ts <extension root> <lock file>");
  }

  await holdUntilStdinEnds(extensionRoot, lockFile);
}
```
Launch via `process.execPath` + `thisFile` (`state-lock-holder.ts:65`). Wrapper generation follows `hook-files.ts:490-500` (`"#!/bin/sh"` line array, `"${process.execPath}" "<module>" ... "$@"`); use `exec` and pass the stand-in dir as fixed first arg (no env var). Lifecycle shape (`start(dir)`, `arm`, `reset`, snapshot, `close`) mirrors `HttpsGitHost` (`server.ts:351`, `424`). Arm type a discriminated union like `GitHostArm`. Argv parser table-driven (a `Set` of value-taking options) to stay under cognitive 15. upload-pack env = `hermeticGitEnvironment(home, { GIT_PROTOCOL })` only (drop git's `GIT_EXEC_PATH`). Stderr strings copied from CONTEXT.md `<specifics>`.

### `features/lib/pi-rpc.ts` (env allowlist)

Interface (lines 49-65) gains required `readonly GIT_SSL_CAINFO: string` and `readonly PATH: string`. Copy rule in `rpcChildEnvironment` (lines 200-215):
```typescript
  if (git !== undefined) {
    environment.NODE_EXTRA_CA_CERTS = git.NODE_EXTRA_CA_CERTS;
    environment.GIT_CONFIG_NOSYSTEM = git.GIT_CONFIG_NOSYSTEM;
    environment.GIT_CONFIG_GLOBAL = git.GIT_CONFIG_GLOBAL;
```
Add `GIT_SSL_CAINFO` and overwrite `PATH` with `git.PATH` the same way.

### `features/support/pi-process.ts` (lifecycle)

Literal site to extend (lines 150-156):
```typescript
    gitHost = await HttpsGitHost.start(path.join(root, "git-host"));
    // The global git config is absent until a scenario writes it (DRV-03).
    const piEnvironment = {
      NODE_EXTRA_CA_CERTS: gitHost.certificatePath,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: path.join(sandbox.home, ".gitconfig"),
      PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL: `https://${gitHost.address}`,
    } satisfies RpcGitEnvironment;
```
Start `SshGitHost` beside it (same `BeforeAll`, `root` subdir `ssh-host`), add `GIT_SSL_CAINFO: gitHost.certificatePath` and the stub-first `PATH`; reset in `Before()` with the empty-snapshot assertion and close in `AfterAll()` as `gitHost` is. Same edit at `real-subagent-child.ts:499-504` and `subagent-hook-ownership.test.ts:135-140` (empty-file certificate pattern at 471-472 / 118-119).

### `test/architecture/hermetic-git-environment.test.ts`

Grow `INHERITED_VARIABLES` (lines 25-40, `as const` object) with the CONTEXT list (GIT_CONFIG_COUNT/KEY_0/VALUE_0/PARAMETERS, GIT_SSL_CAINFO, GIT_SSH*, SSH_AUTH_SOCK, SSH_ASKPASS, proxies both cases, XDG_CONFIG_HOME, GIT_TRACE, GCM_INTERACTIVE, CLAUDE_CODE_PLUGIN_PREFER_HTTPS). Keep the `inheritVariables(t)` save/restore helper (lines 43-59) and AAA-commented cases with exact `assert.deepStrictEqual` key sets (lines 68-87, 90-115). Update every literal `git` object (seven) with the two new members; add a case per new builder (named-variable addition, CGI default/refusing, stub upload-pack env).

### `test/architecture/ssh-git-host.test.ts` (NEW)

Copy structure from `test/architecture/https-git-host-server.test.ts`: start host in a mkdtemp root, `t.after` close, real `git clone` through `runGit` with stub dir first on PATH. Assert exit codes and stable fragments (`successfully authenticated`, `Permission denied (publickey`), not full stderr or request counts.

### CI workflows

Copy named-step shape (`ci.yml:90-91`):
```yaml
      - name: Run the unit tests that have no source pair
        run: npm run test:unpaired
```
Insert `- name: Log the git version` / `run: git --version` before the test step in jobs at `ci.yml` lines ~85 (static), ~116 (integration), ~179 (behavioral), ~221 (e2e-tests), ~252 (direct-coverage), and in `e2e-nightly.yml`.

## Shared Patterns

### Hermetic environment (DRV-03)
**Source:** `features/lib/hermetic-git.ts:16-28`. **Apply to:** every test-side git spawn, CGI, ssh stub upload-pack, integration forks. Build from scratch; never `{ ...process.env }` (anti-pattern at `test/integration/concurrent-install.test.ts:126,131`, `load-reconcile-race.test.ts:143`).

### Subprocess call style
Async `execFile`/`spawn`, argument array, no shell, `process.execPath` absolute node (`state-lock-holder.ts:65`).

### Test style
`node:test` + `node:assert/strict`, `// arrange / act / assert` comments, `t.after` cleanup, IDs (DRV-03, SG-HRN-0n) in titles/comments, never phase numbers.

## No Analog Found

None. The SSH argv parser has no direct analog; use RESEARCH Pattern 4 argv table.

## Metadata

**Analog search scope:** `features/lib/`, `features/support/`, `test/architecture/`, `test/platform/`, `.github/workflows/`
**Files scanned:** 10
**Pattern extraction date:** 2026-11-23
**Verification note:** run gates with `PATH="/opt/pi-claude-marketplace/bin:$PATH"` in this sandbox (RESEARCH Pitfall 7).
