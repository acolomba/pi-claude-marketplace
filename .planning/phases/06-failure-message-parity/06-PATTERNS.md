# Phase 6: Failure-Message Parity - Pattern Map

**Mapped:** 2026-11-28
**Files analyzed:** 24 (new or modified)
**Analogs found:** 23 / 24

All paths below are relative to the repo root. `ext/` is short for `extensions/pi-claude-marketplace/`. Every analog named here is git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `ext/shared/git-failure-remedy.ts` (NEW) | utility (leaf, no imports) | transform (facts -> sentence) | `ext/shared/git-failure-classifiers.ts` `GIT_FAILURE_ANSWERS` (145-192); `gitCommandMessage` in `ext/shared/errors.ts` (1376-1394) | role-match |
| `test/shared/git-failure-remedy.test.ts` (NEW) | test | table-driven | `test/shared/redact-credentials.test.ts` (1-40) | exact |
| `ext/shared/child-output.ts` (NEW) | utility (leaf) | transform | `ext/orchestrators/plugin/package-install.ts` `compactOutput`/`boundedNote`/`NOTE_LIMIT` (140, 247-249, 404-416) | exact (move) |
| `test/shared/child-output.test.ts` (NEW) | test | table-driven | compaction cases in `test/orchestrators/plugin/package-install.test.ts` (move them) | exact |
| `ext/orchestrators/plugin/package-install.ts` | service | child-process | itself (becomes second consumer of `child-output.ts`) | n/a |
| `ext/shared/errors.ts` (`GitCommandError`, `serializeCauseChain`, `StoredCredentialRejectedError`) | model / serializer | transform | itself, 181-194 and 1349-1394, 579-586 | n/a |
| `ext/shared/redact-absolute-paths.ts` (`redactCauseChain`) | utility | transform | its own `ManualRecoveryError` branch (176-202) | exact |
| `ext/shared/redact-credentials.ts` (widen + `redactUrlSpellings`) | utility | transform | itself (34-56) | n/a |
| `test/shared/redact-credentials.test.ts` | test | table-driven | itself | n/a |
| `ext/shared/debug-log.ts` (central redaction) | utility | event (log) | itself (1-26) | n/a |
| `test/shared/debug-log.test.ts` | test | console mock | itself (1-26) | n/a |
| `ext/platform/git-process.ts` (`settleRun`, `GitRequest.remote`, `[git]` failed-run debug line) | platform | child-process | `settleRun` (1039-1064) | n/a |
| `ext/platform/git.ts` (`runRemote` sets remote; `runWithAuthBundle` at 344-365) | platform | request-response | itself | n/a |
| `ext/orchestrators/marketplace/add.ts` (`showsAddCause` 1513-1521) | orchestrator | request-response | itself | n/a |
| `ext/orchestrators/plugin/install.messaging.ts` (`keepsRuntimeCause` 182-188) | messaging | transform | itself | n/a |
| `ext/orchestrators/plugin/update-preflight.ts` (`candidateFailure` 631-650) | orchestrator | transform | itself | n/a |
| `ext/orchestrators/import/execute.ts` (`unexpectedFailureRow` 724-737, `pushUnexpectedFailure` 2313-2334) | orchestrator | batch | itself | n/a |
| `ext/orchestrators/plugin/install-cascade.messaging.ts` (`memberCause` 565-579, `composeCascadeFailureMessage` ~717) | messaging | transform | itself | n/a |
| `ext/orchestrators/plugin/install-outcome.ts` (`recordAsInstallFailure` 607-621) | orchestrator | request-response | itself | n/a |
| `ext/orchestrators/marketplace/update.ts` (`attachStoredCredentialCause` 500-514, delete), `marketplace/shared.ts:299` (`lacksStoredCredential`), `orchestrators/auth-host.ts:91-92` (`NO_STORED_CREDENTIAL_CAUSE`), `plugin/update-flow.ts:318-321` | orchestrator | delete | n/a | n/a |
| `ext/orchestrators/github-transport.ts` (230, 237, 267) and `ext/orchestrators/marketplace/clone-swap.ts` (266, 364, 482, 580, 631) debug lines | orchestrator | event (log) | `hookDebugLog(..., "git")` call shape | n/a |
| `features/lib/ssh-git-host/launch.ts` (new `host-key-changed` arm) | test harness | request-response | the `host-key` arm in the same file (37-38, 209-212, 233, 257, 302) | exact |
| `features/step_definitions/ssh-host.steps.ts` (new Given) | step def | n/a | "the user's ssh does not know the host key for {string}" (43-48) | exact |
| `test/architecture/ssh-git-host.test.ts` (new probe case) | architecture test | table-driven | "SshGitHost answers to Claude Code's probe" cases (444-473) | exact |
| `features/step_definitions/command.steps.ts` (new debug-log assertion Then) | step def | n/a | `printModeOutput` + "pi's print mode exits with code {int} and prints nothing" (227-251) | role-match |

## Pattern Assignments

### `ext/shared/git-failure-remedy.ts` (NEW leaf, transform)

**Constraint:** imports nothing (Pitfall 1: `errors.ts` imports it, and `github-base-url.ts` / `redact-absolute-paths.ts` import `errors.ts`). No `github.com` literal (`local/no-github-literal`, eslint.config.js:142); GitHub is a boolean fact computed in `platform/git.ts` `runRemote` via `gitHubAddressOf`.

**Closed-kind table analog** (`ext/shared/git-failure-classifiers.ts` 165-192): copy the `as const satisfies Record<...>` idea; since the leaf cannot import `GitFailure`, use a `switch` with a `default` plus a test that enumerates every kind string from `GIT_FAILURE_ANSWERS`.
```typescript
const GIT_FAILURE_ANSWERS = {
  "git-missing": "git missing",
  timeout: "network unreachable",
  ...
  "no-stderr": "unknown rule",
  failed: "unknown rule",
} as const satisfies Record<
  Exclude<GitFailure["kind"], "network" | "repository-not-found">,
  ...
>;
```
**Wording style analog** (`ext/shared/errors.ts` 1381-1385): plain sentence, inline command unquoted.
```typescript
? "git is not installed on this Mac. To install it, run xcode-select --install, then try again."
: "Git is required to install marketplaces.";
```
Keep one small function per class (Pitfall 9: cognitive 15 in both sonarjs and fallow). Use the draft wording table in 06-RESEARCH.md.

**Header comment pattern:** copy the leaf-module JSDoc of `ext/shared/debug-log.ts` lines 1-21 ("Pure leaf module: no imports..."), citing D-SG-31 / D-SG-33 / D-SG-34.

---

### `ext/shared/child-output.ts` (NEW leaf, move)

**Source to move** (`ext/orchestrators/plugin/package-install.ts`):
```typescript
import { stripVTControlCharacters } from "node:util";           // line 53
const NOTE_LIMIT = 500;                                          // line 140

function boundedNote(note: string): string {                     // 247-249
  return note.slice(0, NOTE_LIMIT).replace(/[\uD800-\uDBFF]$/u, "");
}

const NPM_WARN_LINE = /^npm warn\b/i;                            // 401-416
const NPM_ERROR_PREFIX = /^npm (?:ERR!|error) ?/;
function compactOutput(output: string): string {
  const lines = stripVTControlCharacters(output)
    .split(/[\r\n]+/)
    .map((line) => line.replaceAll(/\p{Cc}/gu, " ").trim())
    .filter((line) => line !== "");
  const errors = lines.filter((line) => !NPM_WARN_LINE.test(line));
  return (errors.length > 0 ? errors : lines)
    .map((line) => line.replace(NPM_ERROR_PREFIX, ""))
    .join("; ");
}
```
Change: `boundedNote(note, keep: "head" | "tail")` (git keeps the tail, CONTEXT follow-up; package install keeps the head). For the tail, strip a leading low surrogate `[\uDC00-\uDFFF]` instead of a trailing high one. Export both names; `package-install.ts` imports them (`failureDetail` 418-425 and `failedNote` 393-395 stay, calling the shared functions). Do not leave a copy behind: fallow dupes fails on any clone group. The npm prefix handling can stay in the shared function (harmless on git output) or become a parameter; keep one implementation.

---

### `test/shared/git-failure-remedy.test.ts`, `test/shared/child-output.test.ts` (NEW pairs)

**Analog:** `test/shared/redact-credentials.test.ts` 1-40, table-driven `for (const { name, input, expected } of [...]) test(name, ...)`:
```typescript
import assert from "node:assert/strict";
import { test } from "node:test";

import { redactCredentials } from "../../extensions/pi-claude-marketplace/shared/redact-credentials.ts";

for (const { name, input, expected } of [
  {
    name: "PMOD-04 / D-06 replaces user and password userinfo with ***@",
    input: "clone https://user:tok@host/x failed",
    expected: "clone https://***@host/x failed",
  },
  ...
```
Test titles cite D-SG-31..35 / SG-ERR-01, never phase numbers. 100% direct coverage per pair: cover `1 second` vs `N seconds`, scp host vs `<host>` literal, GitHub vs other host vs "your git host", network sub-check on `remote:`-free text, every non-remedy kind returns `undefined`, head vs tail bound and surrogate trimming.

---

### `ext/shared/errors.ts`

**`GitCommandError`** (1349-1370) gains readonly facts (`remote?: { url; gitHub }`, kept already-redacted); constructor `details` bag grows (opts-bag convention). `this.stderr = redactCredentials(details.stderr ?? "")` stays; `message` keeps stderr out (D-SG-35).

**`serializeCauseChain`** (181-194), current core:
```typescript
const links = [...causeChain(err)];
return {
  causeChain: links.map((link) => redactCredentials(linkMessage(link))),
  truncated: hasOnwardCause(links.at(-1)),
};
```
Change `map` to `flatMap(linkEntries)` then `map(redactCredentials)` (Research Pattern 2); `truncated` and `CAUSE_CHAIN_MAX_DEPTH` untouched. Update the JSDoc walker contract (165-180) to say a git link yields up to three entries.

**`StoredCredentialRejectedError`** (579-586) becomes `extends GitCommandError`, built from the refused error's facts, no `cause` link. Then the later `StoredCredentialRejectedError` rung in `classifyGitFailure` is dead: delete it (coverage/fallow will flag it).

---

### `ext/shared/redact-absolute-paths.ts` (`redactCauseChain`)

**Analog: its own class-preserving branch** (188-199):
```typescript
for (const link of links) {
  const message = redactAbsolutePaths(linkMessage(link));
  const options = chain === undefined ? undefined : { cause: chain };
  chain =
    link instanceof ManualRecoveryError
      ? new ManualRecoveryError(
          message,
          link.leaks.map((leak) => redactedLeak(leak)),
          options,
        )
      : new Error(message, options);
}
```
Add a `GitCommandError` branch before the fallback (rebuild with same failure/operation/exitCode/remote, `redactAbsolutePaths(link.stderr)`); a subclass (`StoredCredentialRejectedError`) must be rebuilt as itself or as a `GitCommandError` carrying the same kind. Extract a small `rebuiltLink(link, message, options)` helper so the loop stays under cognitive 15. Extend `test/shared/redact-absolute-paths.test.ts`.

---

### `ext/shared/redact-credentials.ts` (widen)

**Current structure to extend** (34-56): named local regexes, chained `.replace`, a predicate helper (`isTokenShaped`) for prose-vs-token.
```typescript
const userinfo = /(?<![a-z0-9+.-])([a-z0-9+.-]+:\/\/)[^\s/?#]+@/gi;
const accessToken = /\b(x-access-token:)[^\s@/]+/gi;
const bearer = /\b(Bearer[ \t]+)([\w.~+/-]*\w=*)/gi;
const githubToken = /gh[pousr]_[A-Za-z0-9]{16,}|github_pat_\w{16,}/g;
return text
  .replace(userinfo, "$1***@")
  ...
  .replace(githubToken, "***");
```
Move the provider rules into a module-level `readonly (readonly [RegExp, string])[]` table (Pitfall 9) using the fixed-prefix sources in 06-RESEARCH.md. Add query-value, `#name=value`-only fragment (Pitfall 5: keep `#stable`), `%40` userinfo, and a separate `Basic` rule. Keep each regex linear (anchored prefix, bounded class); update the module JSDoc bullet list. Add exported `redactUrlSpellings(text, urls)` (upstream `mn`/`i3e`). Extend the test table in the same file style.

---

### `ext/shared/debug-log.ts` (central redaction)

Current (22-26):
```typescript
export function hookDebugLog(detail: string, tag = "hooks"): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    console.error(`[${tag}] ${detail}`);
  }
}
```
Becomes `console.error(\`[${tag}] ${redactAbsolutePaths(redactCredentials(detail))}\`)` and the header line "Pure leaf module: no imports" (19) must be rewritten (two leaf imports, no cycle because `errors.ts` never imports `debug-log.ts`; verify with `fallow trace`). Extend `test/shared/debug-log.test.ts` following its arrange/act/assert shape (lines 6-26: save/restore `PI_CLAUDE_MARKETPLACE_DEBUG` in `t.after`, `t.mock.method(console, "error", ...)`, `deepStrictEqual` on `mock.calls`). Pitfall 8: re-run every test importing `test/platform/debug-log-capture.ts` and update absolute-path assertions.

---

### `ext/platform/git-process.ts` (`settleRun`)

Current head (1039-1055):
```typescript
function settleRun(run: ProcessRun, request: GitRequest, operation: string): GitResult | GitCommandError {
  const details = { operation, stderr: run.stderr };
  if (request.signal?.aborted === true) {
    return new GitCommandError({ kind: "aborted" }, details, { cause: request.signal.reason });
  }
  ...
  if (run.timedOut) {
    return new GitCommandError({ kind: "timeout", timeoutMs: request.timeoutMs }, details);
  }
```
Change `details` to carry the D-SG-35 display stderr (`redactAbsolutePaths(redactCredentials(redactUrlSpellings(run.stderr, request.remote?.urls ?? [])))`) plus `remote`; classify from raw `run.stderr` as today. Add the `[git]` debug line per failed run (subcommand + exit code) with `hookDebugLog(..., "git")`. `platform/` may import `shared/` (boundary allowed).

### `ext/platform/git.ts` (`runWithAuthBundle`, 344-365)
Current: `throw new StoredCredentialRejectedError(auth.host, { cause: error });` -> construct the subclass from `error`'s facts (no cause). `runRemote` computes `remote: { url: redactCredentials(url), gitHub: gitHubAddressOf(url) !== undefined }` (it already imports the GitHub helpers).

---

### Cause-dropping sites (orchestrators)

Each is a local edit of the function quoted; pattern = "keep the error as the row's cause".

- `ext/orchestrators/marketplace/add.ts` 1513-1521: replace `(unwrapped instanceof GitCommandError && unwrapped.kind === "git-missing")` with `unwrapped instanceof GitCommandError`.
- `ext/orchestrators/plugin/install.messaging.ts` 182-188 `keepsRuntimeCause`: drop the `gitReason !== "authentication required"` gate (always keep for a git failure).
- `ext/orchestrators/plugin/update-preflight.ts` 644-648: delete `keepsCause`; pass `rowCause` always.
  ```typescript
  const keepsCause = reason !== "authentication required" || error instanceof CleanupLeakError;
  const rowCause = frame === undefined ? cause : new Error(frame, { cause });
  return failedCandidate(options, notes, [reason], keepsCause ? rowCause : undefined);
  ```
- `ext/orchestrators/import/execute.ts` 730-731 (IMP-09 bare row) -> unconditional `cause: failureCause(o)`; 2322/2333 `pushUnexpectedFailure` flattens the head (`redactAbsolutePaths(errorMessage(error))` + `redactCauseChain(error.cause)`) -> pass `redactCauseChain(error)` so a `GitCommandError` head expands (Pitfall 3).
- `ext/orchestrators/plugin/install-cascade.messaging.ts` 573-578 `memberCause`: wraps `subject.error.message` in a `DependencyCascadeError` with `redactCauseChain(subject.error.cause)`; when `subject.error` is a `GitCommandError`, use `{ cause: redactCauseChain(subject.error) }` (or give the wrapper a neutral head). Same for `composeCascadeFailureMessage`.
- `ext/orchestrators/plugin/install-outcome.ts` 615-619: `throw new InstallMarketplaceAddError(reason, redactAbsolutePaths(errorMessage(err)))` -> carry `{ cause: redactCauseChain(err) }`; drop the `authentication required` rethrow special case if the bare-row rule goes.
- D-1-02 removal: `attachStoredCredentialCause` (`marketplace/update.ts` 500-514), its PUP-2 twin (`plugin/update-flow.ts` 318-321), `lacksStoredCredential` (`marketplace/shared.ts:299`), `NO_STORED_CREDENTIAL_CAUSE` (`auth-host.ts:91-92`); and `test/architecture/no-credential-leak.test.ts:368-380`. Use `fallow dead-code --trace` before deleting each export.

### Debug lines (`github-transport.ts` 230-240, 267; `clone-swap.ts` 266, 364-367, 482, 580, 631)
Shape kept: `hookDebugLog(\`...${run.subject}: ${debugMessage(failed.error)}\`, "git")`. Wrap `run.subject` / `args.subject ?? plan.first.url` / `args.liveDir` in `redactCredentials(...)` at the site too (D-SG-35), even though the central pass covers them.

---

### `features/lib/ssh-git-host/launch.ts` (new changed-host-key arm)

**Analog: the `host-key` arm.** Union (34-39):
```typescript
export type SshProbeArm =
  | { readonly kind: "authenticated"; readonly user: string }
  | { readonly kind: "no-repository"; readonly user: string }
  | { readonly kind: "denied" }
  | { readonly kind: "host-key" }
  | { readonly kind: "hold" };
```
Answer constant (209-213):
```typescript
// ssh's own refusal of a host whose key it does not know.
const HOST_KEY_ANSWER: SshProbeAnswer = {
  stderr: "Host key verification failed.\n",
  exitCode: 255,
};
```
Add `{ readonly kind: "host-key-changed" }` and a `HOST_KEY_CHANGED_ANSWER` with OpenSSH's `@@@ ... WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! @@@` banner, an `Offending ECDSA key in <path>/known_hosts:N` line (use a path under the stand-in HOME so `{home}` tokens project it), then `Host key verification failed.`, exit 255. Add the case to all three switches: `probeAnswer` (233), `transportRefusal` (257), and `isProbeArm` (301-303, the `return true` group). Update the JSDoc of `probeAnswer`/`transportRefusal`. Note `platform/git-failure-kind.ts` must classify this stderr as `ssh-host-key-changed` before `ssh-host-key-unknown` (the banner holds both texts); check the existing anchor order.

### `features/step_definitions/ssh-host.steps.ts`
Copy lines 43-48:
```typescript
Given(
  "the user's ssh does not know the host key for {string}",
  async function (this: ScenarioWorld, host: string): Promise<void> {
    await this.sshHost.register(host, { probe: { kind: "host-key" } });
  },
);
```
New: `"the user's ssh has a different host key on record for {string}"` -> `{ kind: "host-key-changed" }`. Extend the comment above (32-34) that lists the probe answers.

### `test/architecture/ssh-git-host.test.ts`
Add a row to the `cases` table (450-458) and a `register` call (465):
```typescript
{ host: "host-key.test", exitCode: 255, fragments: ["Host key verification failed."] },
...
await host.register("host-key.test", { probe: { kind: "host-key" } });
```
New row: `{ host: "host-key-changed.test", exitCode: 255, fragments: ["REMOTE HOST IDENTIFICATION HAS CHANGED", "Host key verification failed."] }`. Also check the registration-validation cases near 608 (`name: "host-key.test", probe: { kind: "host-key" }`) and add the new kind there.

### `features/step_definitions/command.steps.ts` (debug-log assertion step)
**Analog** (227-251):
```typescript
function printModeOutput(world: ScenarioWorld): { exitCode: number | null; stdout: string; stderr: string } {
  const run = world.printModeRun;
  if (run === undefined) {
    assert.fail("no command ran in pi's print mode in this scenario");
  }
  return {
    exitCode: run.exitCode,
    stdout: projectTokens("text", run.stdout, world.tokens),
    stderr: projectTokens("text", run.stderr, world.tokens),
  };
}

Then(
  "pi's print mode exits with code {int} and prints nothing",
  function (this: ScenarioWorld, exitCode: number) {
    assert.deepStrictEqual(printModeOutput(this), { exitCode, stdout: "", stderr: "" });
  },
);
```
New step reuses `printModeOutput` (no second reader): e.g. `"pi's print-mode debug log does not contain {string}"` asserting `!stderr.includes(secret)` on the RAW `run.stderr` (a token projection could hide a secret), plus optionally a `[git]`-line presence check for the no-stderr remedy. Behavioral scenario must fail without the change (AGENTS.md). The `cucumber` skill governs wording.

## Shared Patterns

### Redaction order (D-SG-35)
**Source:** `ext/shared/redact-credentials.ts` + `ext/shared/redact-absolute-paths.ts`. **Apply to:** `settleRun` stderr, `hookDebugLog`, `redactCauseChain` git branch. Order: URL spellings -> `redactCredentials` -> `redactAbsolutePaths`. `serializeCauseChain` keeps its second `redactCredentials` pass on every entry. Do NOT add a path pass to every link in `serializeCauseChain` (MA-6 hints need absolute paths).

### Error class convention
**Source:** `ext/shared/errors.ts` (`StoredCredentialRejectedError` 579-586, `GitCommandError` 1349-1370): `extends`, `this.name = "<Class>"`, readonly typed fields, opts bag, JSDoc citing the decision ID. Narrow with `instanceof` only.

### Debug channel
**Source:** `hookDebugLog(detail, "git")`. Only sanctioned output besides `notify()`; never `process.stderr` (rule pack `no-stdio`).

### Test style
`node:test` + `node:assert/strict`, relative `.ts` imports, `// arrange / act / assert`, titles cite durable IDs; env mutations restored in `t.after` (`test/shared/debug-log.test.ts` 6-26).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| (no-stderr cucumber arm, if chosen) | harness | child-process | No silent fake git exists in `features/lib/`; research A5 suggests unit-only coverage in `test/shared/git-failure-remedy.test.ts` and `test/platform/git-process.test.ts` |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{shared,platform,orchestrators}`, `features/lib/ssh-git-host`, `features/step_definitions`, `test/shared`, `test/architecture`
**Files scanned:** ~25
**Pattern extraction date:** 2026-11-28
