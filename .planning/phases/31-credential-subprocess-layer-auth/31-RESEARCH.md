# Phase 31: Credential Subprocess Layer (AUTH-06, AUTH-08, AUTH-09) - Research

**Researched:** 2026-06-01
**Domain:** Cross-platform OS keychain access via `git credential fill/approve/reject` subprocess; injectable `CredentialOps` interface for test isolation; token leakage prevention
**Confidence:** HIGH

## Summary

Phase 31 ships a new file `extensions/pi-claude-marketplace/platform/git-credential.ts`
that wraps the `git credential fill / approve / reject` subprocess as an injectable
`CredentialOps` interface (mirroring the existing `GitOps` pattern in
`orchestrators/marketplace/shared.ts`). Tests inject a `makeMockCredentialOps`
factory so the suite never touches the developer's OS keychain.

The phase is **platform-tier only**. No domain, orchestrator, edge, or bridge file
changes. The `OnAuthRequiredCallback` plumbing into `GitOps.clone` / `fetch` and the
Device Flow itself land in Phases 32-34. Phase 31's deliverable is the keychain seam
plus the architecture-level "no token leak" gate.

**Critical environmental constraint:** the architecture test
`tests/architecture/no-shell-out.test.ts` forbids ALL `node:child_process` /
`child_process` imports anywhere in `extensions/pi-claude-marketplace/`. This was the
D-21 supersession that retired the V1 `execFile("git", [...])` shell-out in favor of
`isomorphic-git`. Phase 31 cannot proceed without a structured exception that
narrows the rule to allow `node:child_process` in `platform/git-credential.ts` only.
This MUST be the first task in the plan -- without it, the new file fails the
architecture gate before its first byte is written.

**`pi.exec` is not viable** for credential subprocesses. The earlier milestone
research (`.planning/research/STACK.md`, `SUMMARY.md`) suggested `pi.exec` but
inspection of `node_modules/@earendil-works/pi-coding-agent/dist/core/exec.js` shows
`spawn(..., { stdio: ["ignore", "pipe", "pipe"] })` -- stdin is hard-ignored.
`git credential fill` REQUIRES feeding `protocol=https\nhost=github.com\n\n` over
stdin. Phase 31 MUST use `node:child_process.spawn` directly, under the narrowed
architecture-test exception.

**Primary recommendation:** define the `CredentialOps` interface in `platform/git-credential.ts`; ship a default implementation that spawns `git credential fill/approve/reject` via `node:child_process.spawn`; ship `makeMockCredentialOps` in `tests/helpers/credential-mock.ts` (sibling of `tests/helpers/git-mock.ts`); narrow the no-shell-out architecture test to exempt `platform/git-credential.ts`; add a new architecture test that grep-asserts no token field is ever passed to state write functions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion -- discuss phase was skipped per user setting. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Claude's Discretion
All implementation choices.

### Deferred Ideas (OUT OF SCOPE)
None -- discuss phase skipped.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-06 | Successful Device Flow stores the token in the OS keychain (macOS Keychain / Windows Credential Manager / Linux gnome-keyring) via `git credential approve` | `CredentialOps.approve()` implementation -- spawns `git credential approve` with `protocol=https\nhost=github.com\nusername=…\npassword=…\n\n` on stdin; the OS-specific helper is selected by the user's git config (osxkeychain on macOS, manager-core on Windows, libsecret on Linux). Phase 31 ships the seam; Phase 32 calls it. |
| AUTH-08 | Subsequent add/update against the same host reuse the stored token via `git credential fill` without triggering Device Flow again | `CredentialOps.fill()` implementation -- spawns `git credential fill` with `protocol=https\nhost=github.com\n\n`, parses `username=…\npassword=…` lines from stdout, returns `null` on miss (non-zero exit OR empty stdout). Phase 31 ships the seam; Phase 33's `buildAuthCallbacks` consults it before invoking Device Flow. |
| AUTH-09 | The access token never appears in state.json, error messages, or any ctx.ui.notify output | Architecture test (new): `tests/architecture/no-credential-leak.test.ts` grep-asserts (1) no `password`/`token`/`access_token` field appears in any persistence write function and (2) no `Error` constructor in `platform/git-credential.ts` interpolates a `GitAuth.password`. Unit tests assert thrown errors carry the operation name only (e.g. `git credential fill failed: exit 128`), never the credential body. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Spawn `git credential` subprocess | `platform/git-credential.ts` | -- | Platform tier is the only zone permitted to wrap external runtime primitives (D-13 boundary). Mirrors `platform/git.ts` (the only file that imports `isomorphic-git`). |
| Parse `git credential fill` stdout into `GitCredentials` | `platform/git-credential.ts` | -- | Wire-format parsing lives next to the subprocess that produces it. |
| Define `CredentialOps` interface + `DEFAULT_CREDENTIAL_OPS` | `platform/git-credential.ts` | -- | Same file as the default implementation. Mirrors `orchestrators/marketplace/shared.ts::GitOps` placement -- the interface lives where the default impl lives (the GitOps interface lives in `shared.ts` because `DEFAULT_GIT_OPS` does; for CredentialOps both belong in `platform/git-credential.ts` since there is no orchestrator-tier shared file for it yet). |
| `makeMockCredentialOps` test helper | `tests/helpers/credential-mock.ts` | -- | New sibling of `tests/helpers/git-mock.ts`. Test scaffold, never imported by production code. |
| Token in-memory only; no persistence | architecture test (`tests/architecture/no-credential-leak.test.ts`) | -- | Cross-cutting; verified at the architecture layer, not implemented in any single tier. |
| Output discipline (no token via `ctx.ui.notify`) | -- | -- | Out of scope for Phase 31 -- `platform/git-credential.ts` does not import `ctx` (it returns credentials to its caller; the caller decides what to surface). The "no leak" property is structural: the function returns `GitCredentials | null` and accepts no `ctx` parameter. |

## Standard Stack

### Core (all in current `package.json`; no additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:child_process` | built-in (Node >=20.19.0) | Spawn `git credential fill/approve/reject` | Required for stdin support; `pi.exec` ignores stdin (verified at `node_modules/@earendil-works/pi-coding-agent/dist/core/exec.js`). [VERIFIED: source inspection of `exec.js` line 12 `stdio: ["ignore", "pipe", "pipe"]`] |
| `node:test` | built-in (Node >=20.19.0) | Unit + architecture tests | Carries over from V1 testing infrastructure. [VERIFIED: project `package.json` `scripts.test`] |

### Supporting (existing project deps; no additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `isomorphic-git` | `^1.38.1` (currently `1.38.3` after Dependabot bump) | `GitCredentials` type (re-exported from `platform/git.ts`) | Phase 30 already exports `GitCredentials` from `platform/git.ts`; Phase 31's `CredentialOps.fill()` returns this exact shape. [VERIFIED: `platform/git.ts` lines 192-198 after Phase 30] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:child_process.spawn` | `pi.exec` from `@earendil-works/pi-coding-agent` | **REJECTED:** `pi.exec` opens stdin with `"ignore"`; cannot feed `git credential` the wire-format input it requires. The earlier milestone-level research recommended `pi.exec` -- that recommendation is invalidated by inspection of `core/exec.js`. [VERIFIED: source inspection] |
| `node:child_process.spawn` | `node:child_process.execFile` | `execFile` does not return a writable stdin stream in its callback form; switching to the streaming form (`execFile(...).stdin`) is equivalent to `spawn` but slightly less idiomatic. `spawn` is the documented Node API for processes that read stdin. [CITED: nodejs.org/api/child_process.html] |
| Hand-rolled key-value parser | `node:querystring` / `node:url` | The git credential wire format is `key=value\n` per line terminated by a blank line -- not URL-encoded, not query-string. A 5-line `.split("\n").filter(l => l.includes("=")).map(l => l.split("=", 2))` parser is correct and clearer than coercing it into another format's API. [CITED: git-scm.com/docs/git-credential] |
| `git-credential-node` npm package | direct subprocess | **REJECTED:** unmaintained (last published 2022; depends on `execa@0.6.x` which is itself archived; no TypeScript types; CommonJS only). Hand-rolling ~50 LOC eliminates a stale dep tree. [VERIFIED: `npm view git-credential-node` shows v0.1.1 published 2022-09-20] |

**Installation:** None. No new packages.

**Version verification:**
```bash
npm view isomorphic-git version          # confirms platform/git.ts dep is current
node --version                            # confirm >=20.19.0 (NFR-4)
```
Run before plan finalization. [VERIFIED: package.json engines field requires `>=20.19.0`]

## Package Legitimacy Audit

> Phase 31 installs no new packages. The legitimacy gate is trivially satisfied.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | -- | -- | -- | -- | -- | n/a -- no new packages |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

All `node:*` imports are Node built-ins. `isomorphic-git` and `@earendil-works/pi-coding-agent` are existing deps shipped before Phase 31. No new npm registry calls.

## Architecture Patterns

### System Architecture Diagram

```
                  ┌─────────────────────────────────────────┐
                  │  Phase 33+ caller (buildAuthCallbacks)  │
                  │                                          │
                  │  onAuth = url => {                       │
                  │    cred = credOps.fill("github.com")     │
                  │    if (cred) return cred                 │
                  │    cred = await deviceFlow(...)          │
                  │    await credOps.approve(host, cred)     │
                  │    return cred                           │
                  │  }                                       │
                  │                                          │
                  │  onAuthFailure = url => {                │
                  │    await credOps.reject(host, badCred)   │
                  │    if (authAttempted) return {cancel:T}  │
                  │    ...                                   │
                  │  }                                       │
                  └────────────┬────────────────────────────┘
                               │
                               │ CredentialOps interface
                               ▼
                  ┌─────────────────────────────────────────┐
                  │  platform/git-credential.ts             │
                  │  ─────────────────────────────────────  │
                  │  export interface CredentialOps {       │
                  │    fill(host): Promise<Cred | null>     │
                  │    approve(host, cred): Promise<void>   │
                  │    reject(host, cred): Promise<void>    │
                  │  }                                       │
                  │  export const DEFAULT_CREDENTIAL_OPS    │
                  └────┬───────────────────────┬────────────┘
                       │ default impl          │ test injection
                       ▼                       ▼
        ┌──────────────────────────┐  ┌────────────────────────┐
        │  spawn("git", [          │  │  makeMockCredentialOps │
        │   "credential",          │  │  (tests/helpers/       │
        │   "fill|approve|reject"  │  │   credential-mock.ts)  │
        │  ], {                    │  │                        │
        │    env: {                │  │  in-memory keychain    │
        │      ...process.env,     │  │  + call log            │
        │      GIT_TERMINAL_PROMPT │  │  + override hooks      │
        │        = "0"             │  │    (fillThrows, etc.)  │
        │    }                     │  └────────────────────────┘
        │  })                      │
        │   .stdin.write(...)      │
        │   .stdin.end()           │
        └─────────┬────────────────┘
                  │
                  ▼
        ┌──────────────────────────┐
        │  OS credential helper    │
        │   - osxkeychain (macOS)  │
        │   - manager-core (Win)   │
        │   - libsecret (Linux)    │
        └──────────────────────────┘
```

**Data flow (the fill path -- AUTH-08):**

1. Phase 33's `buildAuthCallbacks` invokes `credentialOps.fill("github.com")`.
2. Default impl spawns `git credential fill` with stdin = `protocol=https\nhost=github.com\n\n`.
3. `git` consults its configured credential helper chain.
4. On hit: `git` prints `protocol=https\nhost=github.com\nusername=…\npassword=…\n` to stdout; exits 0.
5. On miss with `GIT_TERMINAL_PROMPT=0`: `git` exits non-zero (typically 128) with no `username=` / `password=` lines.
6. Parser returns `GitCredentials | null`.

**Data flow (the approve path -- AUTH-06):**

1. Phase 32's `initiateDeviceFlow` returns a fresh token; caller calls `credentialOps.approve("github.com", {username, password})`.
2. Default impl spawns `git credential approve` with stdin = `protocol=https\nhost=github.com\nusername=…\npassword=…\n\n`.
3. `git` writes through to the OS keychain via the configured helper.
4. `approve` exits 0; no stdout output expected.

### Recommended File Structure

```
extensions/pi-claude-marketplace/
└── platform/
    ├── git.ts              (existing, modified only to re-export the
    │                        `GitCredentials` type if Phase 31 needs to
    │                        widen visibility; Phase 30 already exports it)
    ├── git-credential.ts   (NEW -- the CredentialOps interface,
    │                        DEFAULT_CREDENTIAL_OPS, and the spawn-based
    │                        impl of fill/approve/reject)
    └── pi-api.ts           (existing, untouched)

tests/
├── architecture/
│   ├── no-shell-out.test.ts            (MODIFIED -- narrow the
│   │                                    FORBIDDEN_PATTERNS to allow
│   │                                    `platform/git-credential.ts` only)
│   └── no-credential-leak.test.ts      (NEW -- AUTH-09 architecture gate;
│                                        grep-asserts no `password` /
│                                        `token` / `access_token` field
│                                        appears in any persistence write
│                                        function or notify call)
├── helpers/
│   ├── git-mock.ts                     (existing -- pattern reference)
│   └── credential-mock.ts              (NEW -- makeMockCredentialOps)
└── platform/
    └── git-credential.test.ts          (NEW -- unit tests against the
                                         mock + a smoke test against the
                                         real subprocess gated by a
                                         CI-only env var)
```

### Pattern 1: Subprocess wire-format -- stdin terminated by blank line AND `.end()`

**What:** `git credential fill/approve/reject` reads key=value lines from stdin until a blank line OR EOF. Sending only the blank line WITHOUT closing stdin causes the subprocess to wait for more attributes; sending `.end()` without the blank line is interpreted (by some helpers) as a truncated input.

**When to use:** Every call to `spawn("git", ["credential", …])`.

**Example:**

```typescript
// Source: git-scm.com/docs/git-credential (wire format) + Node.js child_process docs
// Confidence: HIGH -- verified against git documentation and CP-5 pitfall
import { spawn } from "node:child_process";

function gitCredentialIO(
  subcommand: "fill" | "approve" | "reject",
  input: string,            // e.g. "protocol=https\nhost=github.com\n\n"
  timeoutMs = 5_000,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", ["credential", subcommand], {
      env: {
        ...process.env,
        // Critical: refuse to prompt the developer's TTY for credentials.
        // Without this, a non-existent helper falls back to an interactive
        // username/password prompt that hangs forever in a subprocess.
        GIT_TERMINAL_PROMPT: "0",
      },
      // stdio: pipe so we can write to stdin AND capture stdout/stderr.
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`git credential ${subcommand} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref();  // CP-4: do not keep the process alive past timeout

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);  // ENOENT (git not on PATH) lands here
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code: code ?? -1 });
    });

    // CP-5: write input (already includes trailing blank line) AND close stdin.
    child.stdin.write(input);
    child.stdin.end();
  });
}
```

### Pattern 2: `fill` returns `null` on any non-success signal

**What:** `git credential fill` distinguishes "credential found" from "credential not found" via exit code + presence of `password=` in stdout. A successful hit is exit 0 AND stdout contains `password=…`. Anything else -- non-zero exit, exit 0 with no `password=` line, ENOENT spawn failure -- is "no credential" and must return `null`.

**When to use:** The fill code path. Approve and reject use a simpler "exit 0 = success; anything else = throw" rule (the caller catches and degrades non-fatally).

**Example:**

```typescript
// Source: git-scm.com/docs/git-credential + CP-6 pitfall analysis
// Confidence: HIGH (CP-6 verified) + MEDIUM (exact exit code 128 for the no-helper case)
async function credentialFill(host: string): Promise<GitCredentials | null> {
  const input = `protocol=https\nhost=${host}\n\n`;
  let result;
  try {
    result = await gitCredentialIO("fill", input);
  } catch (err) {
    // ENOENT (git binary missing) or timeout. Degrade gracefully -- the
    // caller will fall through to Device Flow.
    return null;
  }

  // Success requires BOTH exit 0 AND a populated stdout with username+password.
  // CP-6: a non-zero exit with empty stdout is the "no credential" signal.
  // GIT_TERMINAL_PROMPT=0 + no helper produces exit 128.
  if (result.code !== 0) return null;
  const parsed = parseCredentialOutput(result.stdout);
  if (parsed.username === undefined || parsed.password === undefined) {
    return null;
  }
  return { username: parsed.username, password: parsed.password };
}

function parseCredentialOutput(stdout: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq);
    const value = line.slice(eq + 1);
    out[key] = value;
  }
  return out;
}
```

### Pattern 3: `approve`/`reject` swallow subprocess errors

**What:** A failure to persist to the keychain (e.g. user has no helper configured, helper is broken) MUST NOT block the operation that just succeeded auth. Persistence is best-effort -- the in-memory token still works for the current operation.

**When to use:** Both `approve` and `reject`. Note: `reject` failures are particularly benign because the credential probably wasn't there anyway (else how would it have failed?).

**Example:**

```typescript
// Source: SEC-4 + CP-7 + CP-8 pitfall analysis; isomorphic-git auth docs note
//   that approve is fire-and-forget for the underlying git CLI.
// Confidence: HIGH
async function credentialApprove(host: string, cred: GitCredentials): Promise<void> {
  // CP-7: use the SAME attribute set as fill -- protocol + host only,
  // never path. Mismatched attributes store to a different keychain key.
  const input =
    `protocol=https\nhost=${host}\n` +
    `username=${cred.username}\npassword=${cred.password}\n\n`;
  try {
    const r = await gitCredentialIO("approve", input);
    if (r.code !== 0) {
      // Persistent failure -- log via a non-throwing path. We do NOT
      // surface this to ctx.ui.notify (that's the caller's job if it
      // chooses to). Phase 31 has no ctx; the caller will see "next
      // fill returns null" and re-run Device Flow.
      return;
    }
  } catch {
    return;  // ENOENT / timeout / spawn error: best-effort
  }
}
```

### Anti-Patterns to Avoid

- **Embedding the token in the spawn argv** (e.g. `spawn("git", ["credential", "approve", "--password=…"])`):
  argv is visible to any process that can read `/proc/<pid>/cmdline` (Linux), `ps -ef` (macOS pre-monterey), or Process Explorer (Windows). The git credential protocol passes credentials via STDIN exactly so they cannot be observed via process inspection. Always pass credentials over stdin; never on argv.

- **Re-using one long-lived child process for fill+approve+reject**:
  `git credential` is single-shot; each invocation processes one input block and exits. There is no streaming mode. Spawn a fresh child for each call.

- **Calling `child.stdin.end()` BEFORE `.write()` returns**:
  Node's `.write()` returns a boolean (backpressure signal), not a Promise. The data is buffered and flushed asynchronously. Calling `.end()` immediately after `.write()` is correct (`.end()` flushes); calling it before `.write()` would close stdin before the data is queued. Sequence: write → end.

- **Using `child.stdout.toString()` before `close`**:
  Stream data arrives in chunks; concatenate during the `"data"` event and read in the `"close"` event. Reading mid-stream returns a partial buffer.

- **Hand-rolling a Promise wrapper around `child_process.exec` for stdin support**:
  `exec` does not expose `child.stdin` in a documented stable way. Always use `spawn` (or `execFile` in its streaming form) when stdin is required.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS keychain CRUD | A direct `keytar` / `node-keychain` binding | `git credential fill/approve/reject` subprocess | git already abstracts macOS Keychain, Windows Credential Manager, and Linux libsecret via per-OS helpers (osxkeychain, manager-core, libsecret). Pulling in `keytar` would (a) add a native dependency that needs prebuilt binaries per platform, (b) duplicate state with whatever helper the user already configured, and (c) reintroduce the cross-platform branching we deliberately delegate to git. |
| Process spawning with stdin | Wrapping `pi.exec` | `node:child_process.spawn` directly (with narrowed architecture-test exception) | `pi.exec` deliberately ignores stdin (verified in `core/exec.js`); no amount of wrapping changes that. The earlier-milestone-level research recommendation to use `pi.exec` is invalidated and must be corrected in this phase's plan. |
| Detecting "no credential" vs "credential" | A parser-level heuristic | `result.code !== 0 OR stdout lacks "password="` | git's exit codes are stable contract; relying on stdout content alone breaks when `GIT_TERMINAL_PROMPT=0` causes git to exit before printing the requested attributes. |
| Test isolation for keychain ops | A "skip if no keychain available" gate | Injectable `CredentialOps` interface + `makeMockCredentialOps` mock | Same pattern as `GitOps` / `makeMockGitOps`. The existing `tests/helpers/git-mock.ts` is the design template. Tests never see the real OS keychain; the dev's stored credentials remain untouched. |

**Key insight:** subprocess + interface injection is the canonical pattern in this codebase. `platform/git.ts` wraps `isomorphic-git` (one external runtime); `orchestrators/marketplace/shared.ts::GitOps` is the test seam. Phase 31 replicates this verbatim for `git credential` -- the wrapper lives in `platform/git-credential.ts`; the test seam is the `CredentialOps` interface plus `makeMockCredentialOps`. No new architecture is being invented.

## Runtime State Inventory

> Phase 31 is greenfield platform code -- this section is omitted (no rename / refactor / migration).

## Common Pitfalls

### Pitfall 1: `node:child_process` import is blocked by `tests/architecture/no-shell-out.test.ts`

**What goes wrong:** The very first commit that adds `import { spawn } from "node:child_process"` to `extensions/pi-claude-marketplace/platform/git-credential.ts` fails the architecture test, blocking the entire phase. The test exists for a real reason (D-21 supersession of the V1 shell-out failure mode) but its current regex pattern (`/from\s+["']node:child_process["']/`) matches the new file's legitimate use.

**Why it happens:** D-21 retired the V1 `execFile("git", [...])` shell-out in favor of pure-JS isomorphic-git. The no-shell-out test was the structural guard against regression. Phase 31 reintroduces a subprocess -- but a NARROWER one (only `git credential`, not `git clone`/`fetch`/`pull`), serving a DIFFERENT purpose (OS keychain access, not git transport). The two intents conflict at the regex layer.

**How to avoid:** The FIRST task in the plan must amend `tests/architecture/no-shell-out.test.ts` to whitelist exactly one file:

```typescript
// Before
const offenders: string[] = [];
for await (const file of walkTsFiles(EXTENSION_ROOT)) {
  const source = await readFile(file, "utf8");
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(source)) {
      offenders.push(`${path.relative(REPO_ROOT, file)} matches ${String(pat)}`);
    }
  }
}

// After (Phase 31 amendment)
const ALLOWED_CHILD_PROCESS_FILES = new Set<string>([
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
]);

const offenders: string[] = [];
for await (const file of walkTsFiles(EXTENSION_ROOT)) {
  const rel = path.relative(REPO_ROOT, file);
  if (ALLOWED_CHILD_PROCESS_FILES.has(rel)) continue;
  // ... rest unchanged
}
```

The test's header docstring must also be amended to record the AUTH-06/08/09 reason for the narrowing. A NEW assertion should be added that verifies the whitelist is exactly one file (so future drift requires an explicit edit).

**Warning signs:** `npm run check` reports `D-21 violation: child_process import detected in the extension tree:  extensions/pi-claude-marketplace/platform/git-credential.ts matches …` as soon as you try to author the new module. If this fires after Phase 31 lands, someone added a SECOND `child_process` import without amending the whitelist.

### Pitfall 2: `GIT_TERMINAL_PROMPT=0` is required for non-interactive operation

**What goes wrong:** Without `GIT_TERMINAL_PROMPT=0` in the spawn env, `git credential fill` falls back to prompting the user's TTY when no credential helper returns a result. In a subprocess the prompt hangs indefinitely waiting for stdin input that will never arrive. The await never resolves; tests hang; users see frozen commands.

**Why it happens:** git's credential helper chain has a built-in "ask the user" terminal-prompt step at the end. It's invisible in interactive use because the user just answers the prompt. In a non-interactive subprocess, this step is a deadlock.

**How to avoid:** Always pass `env: { ...process.env, GIT_TERMINAL_PROMPT: "0" }` to spawn. The `...process.env` is required so the spawned `git` inherits the helper config (`HOME`, `XDG_CONFIG_HOME`, etc.). Setting only `{ GIT_TERMINAL_PROMPT: "0" }` orphans the subprocess from its config and produces unrelated failures.

**Detection:** A unit test that spawns the REAL `git credential fill` against a host with no stored credential and asserts the promise resolves within 2 seconds. Without `GIT_TERMINAL_PROMPT=0` it hangs.

### Pitfall 3: `child.stdin.end()` must be called explicitly

**What goes wrong:** `git credential fill` reads stdin until it sees a blank line OR EOF. The blank line ALONE is sometimes enough for the helper to start processing, but if the helper itself buffers input, the parent's await hangs because the helper waits for EOF. `child.stdin.end()` sends EOF; without it the pipe stays open and the helper may wait.

**Why it happens:** Two different layers expect different end-of-input signals: the git-credential wire format accepts `\n\n`; the helper subprocess inherits an open stdin from git and may wait for EOF. Belt-and-suspenders: write the blank line AND call `.end()`.

**How to avoid:**
```typescript
child.stdin.write("protocol=https\nhost=github.com\n\n");  // blank line per spec
child.stdin.end();                                          // EOF on the pipe
```

**Warning signs:** Tests pass with a process-spawn mock but hang against the real subprocess. The `.end()` was the missing piece.

### Pitfall 4: `git credential approve` and `reject` must use the SAME attribute set as `fill`

**What goes wrong:** Credentials in the OS keychain are keyed by the exact attribute set (`protocol` + `host` + optional `path`). If `fill` uses `(protocol=https, host=github.com)` but `approve` uses `(protocol=https, host=github.com, path=foo/bar)`, the approve stores under a DIFFERENT key. Subsequent fill calls then miss the approved credential and continue using the (rejected) original.

**Why it happens:** The git credential protocol matches on the exact attribute combination, not a "best match". The temptation to add `path=` per-repo for isolation is wrong for our case -- we want one credential per host (github.com).

**How to avoid:** Use a single helper that builds the attribute block from `host` only. Never add `path`. Never add `username` to the fill query (let the helper figure it out from the keychain).

```typescript
function buildAttributeBlock(host: string, cred?: GitCredentials): string {
  const lines = [`protocol=https`, `host=${host}`];
  if (cred?.username !== undefined) lines.push(`username=${cred.username}`);
  if (cred?.password !== undefined) lines.push(`password=${cred.password}`);
  return lines.join("\n") + "\n\n";  // trailing blank line per spec
}
```

### Pitfall 5: macOS Keychain duplicate entries after repeated `approve`

**What goes wrong:** `git-credential-osxkeychain` (the default macOS helper) appends to the keychain on `approve` rather than replacing in place. Calling `approve` twice for the same host with different passwords creates TWO entries. `reject` removes only the FIRST. Subsequent `fill` returns the SECOND (stale) credential.

**Why it happens:** macOS Keychain's underlying `SecKeychainAddInternetPassword` does not deduplicate by service+account; it requires the caller to delete first if replacing. The osxkeychain helper does not do this. Documented behavior; community-reported, not in official git docs.

**How to avoid:** Always call `reject` BEFORE `approve` when rotating a token. The sequence is:
```typescript
// Before approving a new token, evict any existing entry first.
await credentialOps.reject(host, oldCredentialOrPlaceholder);
await credentialOps.approve(host, newCredential);
```

The Phase 31 implementation of `approve` itself does NOT need this sequencing built in -- it's the caller's choice. But the `approve` docstring should note this pitfall and reference the rotation pattern for the Phase 33 buildAuthCallbacks consumer.

**Confidence:** MEDIUM (community-reported via GitHub Issues and Stack Overflow; not in official git-scm.com docs). Apply defensively.

### Pitfall 6: `pi.exec` does NOT accept stdin

**What goes wrong:** Authoring `credentialFill` to call `pi.exec("git", ["credential", "fill"], { stdin: "protocol=…" })` looks plausible (it matches the `ExecOptions` type's general shape) but `ExecOptions` has NO stdin field, and inspection of the `core/exec.js` implementation shows `stdio: ["ignore", "pipe", "pipe"]` -- stdin is hard-ignored. The spawned `git credential fill` waits on stdin forever; the await hangs.

**Why it happens:** The earlier milestone-level research (`SUMMARY.md` line 31, `ARCHITECTURE.md` line 165) explicitly recommended `pi.exec` without verifying its stdin support. Inheriting that recommendation into the Phase 31 plan is the predictable failure mode.

**How to avoid:** Use `node:child_process.spawn` directly. Document the rejection of `pi.exec` in the new file's header docstring with a one-line reference to `core/exec.js:12` `stdio: ["ignore", …]`.

**Warning signs:** A test that mocks `pi.exec` succeeds; the same test against the real `pi.exec` hangs because stdin never arrives at git. Catch this in the Phase 31 plan by NOT introducing a `pi.exec`-shaped seam in the first place.

### Pitfall 7: ENOENT on the `git` binary needs a non-fatal degrade path

**What goes wrong:** `spawn("git", [...])` throws `ENOENT` synchronously (via the `error` event) when `git` is not on `PATH`. Without an explicit catch, this propagates as an unhandled error from `credentialOps.fill` and the caller in Phase 33 sees an unexpected exception rather than the expected "no credential found, fall through to Device Flow" signal.

**Why it happens:** The D-21 supersession (V1 → isomorphic-git) was specifically motivated by removing the "git not on PATH" failure mode. Phase 31 re-introduces it for credential subprocesses ONLY -- but git absence here is far less serious than git absence in V1 (no clone/fetch impact; only keychain persistence is lost; the operation still works in-memory for the current invocation).

**How to avoid:** Wrap the `spawn` call in `try/catch`; catch `error` events on the child process; in both paths return `null` from `fill` and silently no-op `approve`/`reject`. Document this in the file header as a deliberate degradation, not a bug. The `noEnvFallback` consequence is recorded once at the architectural level; users without git installed cannot benefit from credential reuse and will see Device Flow on every operation.

```typescript
// Caller-facing: ENOENT-tolerant
try {
  const result = await gitCredentialIO("fill", input);
  // ...
} catch (err) {
  // ENOENT, EACCES, timeout -- treat as no credential found.
  // Do not surface to ctx.ui.notify (no ctx in this layer).
  return null;
}
```

### Pitfall 8: Token leakage via `Error.message` interpolation

**What goes wrong:** A naive error wrapper like
```typescript
throw new Error(`git credential approve failed for ${host} with ${JSON.stringify(cred)}`);
```
leaks the password into the error message. The error then bubbles up through Phase 33 → Phase 35 orchestrator → `ctx.ui.notify` cascade, surfacing the token to the user's Pi UI output.

**Why it happens:** Standard "include the parameters in the error" debugging idiom does not pause to ask "is any of these a secret?".

**How to avoid:** AUTH-09 architecture test enforces this. New `tests/architecture/no-credential-leak.test.ts` reads `platform/git-credential.ts` and asserts:
1. No `Error` constructor argument string-interpolates a `password` / `token` / `cred.password` reference.
2. No template literal in the file mentions `password` / `token` / `access_token` as a substitution variable.
3. (Optional, defense in depth) Scan ALL `*.test.ts` files under `tests/platform/` and reject the same patterns -- tests must not stash real-looking tokens in assertion messages either.

Error messages in this file should reference operations + exit codes only:
```typescript
throw new Error(`git credential ${subcommand} failed: exit ${code}`);  // OK
throw new Error(`git credential ${subcommand} failed: ${stderr}`);     // BORDERLINE -- stderr from git is generally safe but spot-check
throw new Error(`git credential ${subcommand} failed with ${input}`);  // FORBIDDEN -- `input` contains password=
```

### Pitfall 9: Test mock does not need a real keychain backend

**What goes wrong:** A test author, seeing the existing `tests/helpers/git-mock.ts` and its `cp(fixtureSourceDir, opts.dir)` for clone, assumes the credential mock similarly needs to simulate a real keychain. This pulls test complexity up and risks shared state across tests.

**Why it happens:** Misreading the pattern. `git-mock.ts` simulates clone by COPYING a fixture because the orchestrator immediately reads files from the clone dir. Credentials are different -- callers receive the GitCredentials object directly and never inspect a filesystem location for it.

**How to avoid:** `makeMockCredentialOps` should be a pure in-memory `Map<host, GitCredentials>` with a call log and override hooks. No filesystem ops. No environment variables. Closure-scoped state for test isolation. Mirror the BARE-MINIMUM shape of `MockGitState` (call logs + throws overrides), not the full fixture-copying logic.

```typescript
// tests/helpers/credential-mock.ts (sketch)
export interface MockCredentialState {
  store: Map<string, GitCredentials>;          // host -> stored credential
  fillCalls: { host: string }[];
  approveCalls: { host: string; cred: GitCredentials }[];
  rejectCalls: { host: string; cred: GitCredentials }[];
  fillThrows?: Error;
  approveThrows?: Error;
  rejectThrows?: Error;
}
export interface MockCredentialOpsHandle {
  readonly credOps: CredentialOps;
  readonly state: MockCredentialState;
}
export function makeMockCredentialOps(
  initial?: Partial<MockCredentialState>,
): MockCredentialOpsHandle { /* ~30 LOC */ }
```

## Code Examples

Verified patterns from official sources:

### Example 1: `CredentialOps` interface (the seam consumed by Phase 33)

```typescript
// extensions/pi-claude-marketplace/platform/git-credential.ts
// Source: GitCredentials type carries from platform/git.ts (Phase 30 export)
// Confidence: HIGH

import type { GitCredentials } from "./git.ts";

/**
 * D-31 (NEW): Credential helper surface. Mirrors the GitOps pattern in
 * orchestrators/marketplace/shared.ts. Three primitives:
 *   - fill: read a stored credential for a host; null on miss
 *   - approve: persist a credential to the OS keychain
 *   - reject: evict a credential from the OS keychain
 *
 * The default implementation spawns `git credential fill/approve/reject`.
 * Tests inject makeMockCredentialOps() from tests/helpers/credential-mock.ts
 * so the developer's OS keychain is never touched by the test suite.
 */
export interface CredentialOps {
  /** AUTH-08: Return the stored credential for the host, or null on miss. */
  fill(host: string): Promise<GitCredentials | null>;
  /** AUTH-06: Persist a credential to the OS keychain via the configured helper. */
  approve(host: string, cred: GitCredentials): Promise<void>;
  /** AUTH-07 (consumed in Phase 33): Evict a credential from the OS keychain. */
  reject(host: string, cred: GitCredentials): Promise<void>;
}

export const DEFAULT_CREDENTIAL_OPS: CredentialOps = {
  fill: credentialFill,
  approve: credentialApprove,
  reject: credentialReject,
};
```

### Example 2: `GitCredentials` import path

```typescript
// Phase 30 already exports GitCredentials from platform/git.ts:
//
//   export interface GitCredentials {
//     username?: string;
//     password?: string;
//     headers?: Record<string, string>;
//     cancel?: boolean;
//   }
//
// Phase 31 re-uses this exact type. The `cancel` field is unused in
// CredentialOps return values (it is an isomorphic-git callback signal,
// not a stored-credential field) but its presence in the type is harmless;
// the fill() implementation returns objects without `cancel`.
//
// IF the planner finds the optional fields awkward, an alternative is to
// define a narrower type alias in git-credential.ts:
//
//   type StoredCredential = Required<Pick<GitCredentials, "username" | "password">>;
//
// and have fill() return StoredCredential | null. This is a code-style
// decision, not a correctness one.
```

### Example 3: Architecture test narrowing (Phase 31 plan task 1)

```typescript
// tests/architecture/no-shell-out.test.ts (after Phase 31 amendment)
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXTENSION_ROOT = path.join(REPO_ROOT, "extensions/pi-claude-marketplace");

/**
 * D-21 supersession defense (W-8) -- Phase 31 narrowing.
 *
 * D-21 retired the V1 execFile("git", [...]) clone/fetch shell-out.
 * Phase 31 (AUTH-06/08/09) reintroduces child_process ONLY for the
 * `git credential` subprocess in platform/git-credential.ts, which
 * is fundamentally different from a clone shell-out:
 *   - it never executes git clone/fetch/pull/etc.
 *   - it accesses the OS keychain via git's helper chain, which has
 *     no pure-JS equivalent (keytar adds native deps; see RESEARCH "Don't Hand-Roll").
 *   - the missing-git-binary failure mode is non-fatal (degrades to
 *     "no credential reuse"; the current operation still works via Device Flow).
 *
 * The whitelist below is the SOLE permitted use of node:child_process
 * in the extension tree. Adding a second file MUST require an explicit
 * edit here and a phase-level justification.
 */
const ALLOWED_CHILD_PROCESS_FILES: ReadonlySet<string> = new Set([
  "extensions/pi-claude-marketplace/platform/git-credential.ts",
]);

const FORBIDDEN_PATTERNS: ReadonlyArray<RegExp> = [
  /from\s+["']node:child_process["']/,
  /from\s+["']child_process["']/,
  /require\(\s*["']child_process["']\s*\)/,
  /require\(\s*["']node:child_process["']\s*\)/,
];

async function* walkTsFiles(dir: string): AsyncGenerator<string> { /* unchanged */ }

test("no child_process imports anywhere in extensions/pi-claude-marketplace/ (D-21 + Phase 31 narrowing)", async () => {
  const offenders: string[] = [];
  for await (const file of walkTsFiles(EXTENSION_ROOT)) {
    const rel = path.relative(REPO_ROOT, file);
    if (ALLOWED_CHILD_PROCESS_FILES.has(rel)) continue;  // Phase 31 whitelist
    const source = await readFile(file, "utf8");
    for (const pat of FORBIDDEN_PATTERNS) {
      if (pat.test(source)) {
        offenders.push(`${rel} matches ${String(pat)}`);
      }
    }
  }
  assert.deepEqual(offenders, [],
    `D-21 violation: child_process import detected outside the Phase 31 whitelist:\n  ${offenders.join("\n  ")}`);
});

// Phase 31 NEW assertion: the whitelist is exactly platform/git-credential.ts
// (i.e. nobody silently widened it). If a future phase needs another file,
// it MUST update this list AND this assertion's expected value.
test("Phase 31 whitelist: exactly one file may import node:child_process", () => {
  assert.deepEqual([...ALLOWED_CHILD_PROCESS_FILES].sort(), [
    "extensions/pi-claude-marketplace/platform/git-credential.ts",
  ]);
});
```

### Example 4: AUTH-09 architecture test (no token leak)

```typescript
// tests/architecture/no-credential-leak.test.ts (NEW, Phase 31)
//
// AUTH-09: the access token never appears in state.json, error messages,
// or any ctx.ui.notify output.
//
// Confidence: HIGH for static-text grep coverage; MEDIUM for the broader
// claim "no leak EVER" (a sufficiently determined call chain through
// JSON.stringify could still surface a credential -- that's a code-review
// responsibility, not statically-detectable). The architecture test
// catches the obvious accidental leak surfaces.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Files that participate in state persistence (writes state.json).
const STATE_WRITE_FILES: ReadonlyArray<string> = [
  "extensions/pi-claude-marketplace/persistence/state-io.ts",
  "extensions/pi-claude-marketplace/persistence/migrate.ts",
  "extensions/pi-claude-marketplace/transaction/with-state-guard.ts",
];

// Forbidden text patterns in state-write files.
const FORBIDDEN_STATE_FIELDS = /\b(password|access_token|githubToken|gitToken)\b/i;

test("AUTH-09: no credential field name appears in any state-write code path", async () => {
  const offenders: string[] = [];
  for (const rel of STATE_WRITE_FILES) {
    const src = await readFile(path.join(REPO_ROOT, rel), "utf8");
    // Strip comments so docstrings can legitimately mention the words.
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (FORBIDDEN_STATE_FIELDS.test(stripped)) {
      offenders.push(`${rel} contains a forbidden credential-field reference`);
    }
  }
  assert.deepEqual(offenders, []);
});

// platform/git-credential.ts is allowed to USE the credential type but
// must never interpolate a password value into an Error constructor.
test("AUTH-09: platform/git-credential.ts never interpolates a password in an Error message", async () => {
  const src = await readFile(
    path.join(REPO_ROOT, "extensions/pi-claude-marketplace/platform/git-credential.ts"),
    "utf8",
  );
  const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // Forbidden: template literal that mentions password or cred.password or cred.token
  // inside an Error(...) call. This is a structural grep; a sufficiently
  // creative pattern could still slip through (cred[someKey], indirection, etc.)
  // -- relying on code review for those.
  const errorWithCred = /new\s+Error\s*\([^)]*\$\{[^}]*(password|access_token|cred\.[a-z]+)/i;
  assert.equal(errorWithCred.test(stripped), false,
    `Error constructor in git-credential.ts interpolates a credential field`);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `child_process.exec` for subprocesses | `child_process.spawn` (or `execFile` streaming) | Node 6+ (spawn-streaming has been stable for years) | `exec` does not expose a clean stdin write path; `spawn` is the documented Node API for subprocesses that need stdin. |
| `git-credential-node` npm wrapper | Hand-rolled ~50 LOC | After 2022 (last `git-credential-node` publish) | The wrapper hasn't been maintained; pulling it in adds a stale dep + transitive CJS-vs-ESM friction without saving meaningful code volume. |
| `keytar` native binding for OS keychain | `git credential` subprocess | When git-credential helpers became uniformly available (~2018+) | Native bindings need prebuilt binaries per platform/arch; `git credential` delegates the cross-platform work to git's already-installed helpers. |

**Deprecated/outdated:**
- `pi.exec` for stdin-bearing subprocesses: incorrectly recommended by the milestone-level research; verified against `core/exec.js` to use `stdio: ["ignore", "pipe", "pipe"]`. Phase 31's plan MUST correct this.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `git credential fill` exits non-zero (typically 128) when `GIT_TERMINAL_PROMPT=0` and no helper returns credentials | Pattern 2 / Pitfall 2 | [VERIFIED via WebSearch + git-lfs issue #209] LOW. If the actual exit code varies by platform, the fill() implementation should fall back to "exit 0 + no password= line = miss" which is the spec-correct check anyway. Defense in depth: code already checks BOTH conditions. |
| A2 | macOS Keychain accumulates duplicates on repeated `approve` (CP-8) | Pitfall 5 | [ASSUMED -- community-reported, not in official docs] MEDIUM. Worst case: a user's keychain accumulates stale entries; subsequent fills can return the wrong token, retriggering Device Flow (the recovery path). The Phase 33 buildAuthCallbacks `reject → approve` sequence mitigates this regardless of whether the duplicate behavior is universal. |
| A3 | The OAuth App `client_id` for GitHub Device Flow is registered by Phase 32 | (out of scope for Phase 31) | LOW for Phase 31 (does not consume the client_id); HIGH for Phase 32. Recorded here so the planner knows Phase 31 has no dependency on it. |
| A4 | The new `tests/architecture/no-credential-leak.test.ts` regex coverage is sufficient | Example 4 | [ASSUMED] MEDIUM. A determined call chain (`JSON.stringify({secret: token})` via a generic object) could leak under the static gate. Mitigation: code review at the Phase 32-35 boundaries; the static gate catches the obvious accidental cases (template literal interpolation, direct field name reference). |
| A5 | `cancel` field on the returned `GitCredentials` type from Phase 30 is acceptable but unused by `CredentialOps.fill()` | Example 2 | LOW. The optional field is part of the type; fill() returns objects without it; isomorphic-git's onAuth callback in Phase 33 sets it on rejection. No conflict. |

## Open Questions (RESOLVED)

1. **Should the `host` parameter to `CredentialOps` be a string or a parsed `URL`?**
   - RESOLVED: `host: string`. The interface matches the git credential wire format. Per Plan 31-02 `CredentialOps` interface definition.
   - What we know: The git credential wire format is `host=<value>`, and `<value>` can include a port (`example.com:8443`). All real callers in this codebase pass `"github.com"` -- the only supported host per SP-3.
   - Recommendation: `host: string`. The interface matches the wire format. The caller's responsibility is to pass a syntactically-valid host. A typo (`"github.con"`) is detected by the resulting miss, not by a type error. Document in the docstring that `host` is the bare hostname (no scheme, optional port).

2. **Should `fill` return `null` or `undefined` on miss?**
   - RESOLVED: `null`. `fill` signature is `fill(host: string): Promise<GitCredentials | null>` per Plan 31-02.
   - What we know: TypeScript distinguishes them; this codebase uses `?? undefined` in many places (e.g. `platform/git.ts::currentBranch`).
   - Recommendation: `null`. The semantic is "we asked, the answer was 'no credential'". `undefined` reads like "not asked yet" or "field was omitted". `null` is the affirmative no-result. Existing code uses `null` in `tests/helpers/git-mock.ts::currentBranchOverride: null` for the same reason (explicit none).

3. **Should the `git-credential.ts` file expose a `lookupHost(url: string): string` helper?**
   - RESOLVED: No -- deferred to Phase 33. Phase 31 ships only the credential primitives per Plan 31-02 scope.
   - What we know: Phase 33 will translate `https://github.com/owner/repo.git` → `"github.com"` for the credentialOps.fill call.
   - Recommendation: Phase 33. Phase 31 ships ONLY the credential primitives. URL parsing is a Phase 33 concern (along with assembling the closures). Keep `git-credential.ts` to the bare CredentialOps surface.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All code | ✓ | >=20.19.0 (engines field) | -- |
| `node:child_process` | platform/git-credential.ts | ✓ (built-in) | bundled with Node | -- |
| `node:test` | Tests | ✓ (built-in) | bundled with Node | -- |
| `git` binary on PATH | Real `CredentialOps` impl at runtime ONLY | ✗ at build time / ✓ at runtime (best-effort) | varies | **Documented degrade:** if git absent, fill returns null + approve/reject no-op. The current operation still succeeds via Device Flow; only keychain reuse is lost. NOT a phase blocker. |

**Missing dependencies with no fallback:** none for Phase 31 (it ships the seam; doesn't itself exercise the keychain).

**Missing dependencies with fallback:** `git` binary at runtime -- degrades to "no credential reuse", which is the worst case the design already handles.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built-in, Node 20+) |
| Config file | none (no jest/vitest/mocha config in repo) |
| Quick run command | `node --test "tests/platform/git-credential.test.ts" -t "<test name pattern>"` |
| Full suite command | `npm test` (matches the same root globs `package.json::scripts.test` uses) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-06 | `approve` writes a credential to the keychain | unit (against mock) | `node --test "tests/platform/git-credential.test.ts" -t "approve"` | ❌ Wave 0 (NEW file) |
| AUTH-06 | `approve` builds the correct stdin attribute block | unit | `node --test "tests/platform/git-credential.test.ts" -t "attribute block"` | ❌ Wave 0 |
| AUTH-08 | `fill` returns stored credential on hit | unit (against mock) | `node --test "tests/platform/git-credential.test.ts" -t "fill hit"` | ❌ Wave 0 |
| AUTH-08 | `fill` returns null on miss (non-zero exit) | unit | `node --test "tests/platform/git-credential.test.ts" -t "fill miss exit"` | ❌ Wave 0 |
| AUTH-08 | `fill` returns null on miss (empty stdout, exit 0) | unit | `node --test "tests/platform/git-credential.test.ts" -t "fill miss empty"` | ❌ Wave 0 |
| AUTH-08 | `fill` returns null on ENOENT (git missing) | unit | `node --test "tests/platform/git-credential.test.ts" -t "fill ENOENT"` | ❌ Wave 0 |
| AUTH-08 | `fill` does not hang on missing stdin EOF | regression (mock-based; the real-subprocess version is gated by `PI_CM_REAL_GIT_CREDENTIAL=1`) | `node --test "tests/platform/git-credential.test.ts" -t "stdin end"` | ❌ Wave 0 |
| AUTH-09 | No credential field in state write files | architecture | `node --test "tests/architecture/no-credential-leak.test.ts"` | ❌ Wave 0 (NEW file) |
| AUTH-09 | No password interpolation in git-credential.ts Error constructors | architecture | `node --test "tests/architecture/no-credential-leak.test.ts" -t "Error"` | ❌ Wave 0 |
| (gate) | `node:child_process` whitelist exact-match | architecture (amended) | `node --test "tests/architecture/no-shell-out.test.ts"` | ✓ (file exists; needs amendment) |
| (gate) | `npm run check` green | full pipeline | `npm run check` | ✓ |

### Sampling Rate

- **Per task commit:** `node --test "tests/platform/git-credential.test.ts" "tests/architecture/no-shell-out.test.ts" "tests/architecture/no-credential-leak.test.ts"` (the three files Phase 31 touches)
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` GREEN before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `extensions/pi-claude-marketplace/platform/git-credential.ts` -- the production module (CredentialOps interface + DEFAULT_CREDENTIAL_OPS + the three subprocess fns)
- [ ] `tests/helpers/credential-mock.ts` -- `makeMockCredentialOps` factory
- [ ] `tests/platform/git-credential.test.ts` -- unit tests against the mock (one ≈ per AUTH-06/AUTH-08 success criterion)
- [ ] `tests/architecture/no-credential-leak.test.ts` -- AUTH-09 architecture gate
- [ ] `tests/architecture/no-shell-out.test.ts` AMENDMENT -- narrow the forbidden-import gate to exempt the new file

*Framework install: none -- `node --test` is built in.*

## Project Constraints (from CLAUDE.md)

- **Output channel (IL-2):** All user-visible messages MUST go through `ctx.ui.notify`. **Applies indirectly to Phase 31:** `git-credential.ts` does NOT have access to `ctx`; it returns credentials to its caller, who decides what (if anything) to surface. Phase 31 itself adds no user-visible output. No new exemption needed in BLOCK A of `eslint.config.js`.
- **Containment (NFR-10):** Refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, or `<scopeRoot>/mcp.json`. **Applies:** the OS keychain is OUTSIDE these paths -- but writes to it are mediated by `git`, not by extension code. The extension's `git-credential.ts` does not write to any filesystem path; the spawned `git` writes via its helper to a system-managed store. NFR-10 is unaffected.
- **Network policy (NFR-5):** Network is required only for github-source marketplace add / update. **Applies indirectly:** `git credential` itself does NOT touch the network (it just reads/writes the OS keychain). Phase 31's surface is network-free. The `add.ts`/`update.ts` orchestrators that DO touch the network are unchanged in Phase 31 (network surface lands in Phases 33-35).
- **Atomic file ops (NFR-1):** all disk mutations atomic. **Applies indirectly:** Phase 31 does not write any extension-managed file; the OS keychain helper's atomicity is the helper's responsibility (osxkeychain et al. handle this transparently).
- **Quality bar (NFR-6):** `npm run check` stays green. **Applies directly:** the success criteria (`npm run check GREEN`) is explicit.
- **No telemetry V1 (IL-4) / English only V1 (IL-1) / Scope model (SC-1):** unaffected by Phase 31.
- **Conventional Commits (CLAUDE.md Git):** commit titles ≤ 72 chars, body ≤ 80. Plan commits will follow this.
- **Pre-commit hooks:** run `pre-commit run --all-files` before `git commit`. Worktree commits prefix with `SKIP=trufflehog`.
- **GSD workflow gate (CLAUDE.md):** all file-changing operations flow through GSD entry points. Phase 31 is a `/gsd-execute-phase` run already; covered.

## Sources

### Primary (HIGH confidence)

- **`platform/git.ts`** (read 2026-06-01) -- confirmed `GitCredentials` type shape after Phase 30, the `cancel?: boolean` addition, and the "No onAuth (public)" V1 boundary comment.
- **`orchestrators/marketplace/shared.ts`** (read 2026-06-01) -- confirmed the `GitOps` interface, `DEFAULT_GIT_OPS` constant pattern, and `refreshGitHubClone` shape that Phase 31's `CredentialOps` will mirror.
- **`tests/helpers/git-mock.ts`** (read 2026-06-01) -- confirmed the `makeMockGitOps` pattern: `MockGitState` shape, call-log fields, throws-overrides, closure-scoped state. The template Phase 31's `makeMockCredentialOps` follows.
- **`tests/architecture/no-shell-out.test.ts`** (read 2026-06-01) -- confirmed the D-21 forbidden-import gate, regex patterns, and the docstring that motivates the rule. This is the gate Phase 31 must narrow.
- **`node_modules/@earendil-works/pi-coding-agent/dist/core/exec.js`** (read 2026-06-01) -- VERIFIED `pi.exec` uses `spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] })`; stdin is hard-ignored. Invalidates the milestone-level research recommendation to use `pi.exec`.
- **`node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`** (read 2026-06-01) -- confirmed `ExtensionAPI.exec(command, args, options?): Promise<ExecResult>`; `ExecOptions` has fields `signal`, `timeout`, `cwd` only -- no stdin field.
- **`node_modules/isomorphic-git/index.d.ts`** (read 2026-06-01) -- confirmed `GitAuth` shape, `AuthCallback` / `AuthFailureCallback` / `AuthSuccessCallback` signatures, and `cancel?: boolean` semantics. The `GitCredentials` type Phase 30 exports matches isomorphic-git's `GitAuth`.
- **`.planning/research/ARCHITECTURE.md`** (read 2026-06-01) -- milestone-level architecture overview; integration points 1-5 confirm `platform/git.ts` and `shared.ts` are the orchestrator-visible surfaces but Phase 31 only ships the credential platform module.
- **`.planning/research/PITFALLS.md`** (read 2026-06-01) -- CP-1..10, TI-1..4, SEC-1..4 are the canonical pitfall list; Phase 31 pitfalls 1-9 in this RESEARCH.md are derived from / refined from this source.
- **`.planning/research/STACK.md`** (read 2026-06-01) -- confirmed no new npm deps; identified the `pi.exec` recommendation that this RESEARCH supersedes.
- **`.planning/research/SUMMARY.md`** (read 2026-06-01) -- milestone-level summary.
- **GitHub Docs -- `git-credential` reference** ([git-scm.com/docs/git-credential](https://git-scm.com/docs/git-credential)) -- wire format (key=value lines, blank-line terminator), `fill`/`approve`/`reject` semantics, exit code conventions.
- **isomorphic-git docs -- `onAuth` / `onAuthFailure`** ([isomorphic-git.org/docs/en/onAuth](https://isomorphic-git.org/docs/en/onAuth), [/onAuthFailure](https://isomorphic-git.org/docs/en/onAuthFailure)) -- callback signatures, infinite-loop semantics, `cancel: true` exit signal.
- **Node.js docs -- `child_process.spawn`** ([nodejs.org/api/child_process.html](https://nodejs.org/api/child_process.html)) -- stdin streaming, EOF via `.end()`, error/close event sequence.

### Secondary (MEDIUM confidence)

- **WebSearch -- "git credential fill exit code GIT_TERMINAL_PROMPT 128"** -- confirmed (via git-lfs issue #209) that `GIT_TERMINAL_PROMPT=0` + no helper produces exit 128. Cross-referenced with the official `git-credential` docs that say "the protocol does not distinguish 'not found' from error via a structured response".
- **WebSearch -- "isomorphic-git onAuth onAuthFailure callback infinite loop"** -- confirmed the keep-retrying-while-credentials-returned semantic. Cross-referenced with the official isomorphic-git docs (HIGH).
- **Community reports -- macOS Keychain duplicate entries on `git credential approve`** (Stack Overflow, GitHub Issues) -- CP-8 / Pitfall 5. Not in official docs; applied defensively.

### Tertiary (LOW confidence)

- None. All Phase 31 load-bearing claims trace to HIGH or MEDIUM sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages; existing built-ins; verified against codebase + Node docs.
- Architecture: HIGH -- pattern is a direct mirror of the existing `GitOps` / `makeMockGitOps` interface in the same codebase.
- Pitfalls: HIGH -- 9 pitfalls all cross-referenced with milestone-level PITFALLS.md and verified via inspection or official docs. Pitfall 5 (macOS keychain duplicates) is MEDIUM (community-reported).
- AUTH-09 architecture test design: MEDIUM -- static grep catches obvious leaks but cannot prove the absence of all possible leaks; code-review backstop is required.

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 -- 30 days for stable git-scm.com + Node.js API surfaces; the milestone-level research (`.planning/research/`) was completed 2026-05-31 and remains current.
