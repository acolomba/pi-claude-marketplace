---
phase: 01-private-repos-on-any-git-host
reviewed: 2026-09-26T00:00:00Z
depth: deep
diff_base: f4f98c66
diff_head: 3adb12c4
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/install-clone-probe.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/platform/git-auth-callbacks.test.ts
  - tests/platform/git.test.ts
findings:
  critical: 1
  high: 2
  medium: 3
  low: 5
  total: 11
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-26
**Depth:** deep (cross-file: auth-host -> platform/git -> git-auth-callbacks -> git-credential; domain/source parse surface; isomorphic-git transport)
**Files Reviewed:** 22 (10 source, 12 test)
**Status:** issues_found

## Summary

The host compare itself is correct. I traced every route into `buildAuthCallbacks`
(`platform/git.ts::clone` / `fetch` / `resolveRemoteRef`, all three at
`opts.auth !== undefined`) and every producer of `opts.host`
(`hostFromCloneUrl`, the `"github"` literal arm, the `update.ts` / `update-preflight.ts`
local builders). Both sides of the compare read `URL.host`, which I verified empirically
normalizes case, punycode/IDN, userinfo and the default port identically, and
isomorphic-git's `discover` passes the caller's own userinfo-stripped URL
(`node_modules/isomorphic-git/index.cjs:9440-9476`), so I found **no false negative** —
no credential for host A can reach host B. I also found no false positive on any
production route: every site that builds a bundle from one URL and clones another
(`install-clone-probe.ts:56-84`, `update-preflight.ts:202-212`) resolves both through
`canonicalCloneUrl`. AUTH-09 holds: only parsed hosts are interpolated into the new
`hookDebugLog` line, and Node's `Invalid URL` message carries no input.

What the phase did not weigh is the **rest** of the bundle it now attaches to every host.
`buildAuthCallbacks` is a pair, and the second half (`onAuthFailure`) unconditionally
calls `credentialOps.reject(host, cred)`. Attaching a bundle everywhere therefore also
attached a *destructive* keychain eviction everywhere — on hosts where, by construction,
nothing can re-mint the evicted secret. That is CR-01, and I proved it runs. The
docstring at `git-auth-callbacks.ts:100-102` does consider `onAuthFailure`, but only on
disclosure grounds ("a compare there would change nothing about what was disclosed") and
never asks what the eviction now destroys.

Second, the new compare checks `host` and not the scheme, while `credentialFill`
hardcodes `protocol=https`. Object-form sources are not scheme-validated (only the
*string* parser rejects `http://`), so a manifest-declared `http://` source now walks a
stored https credential onto a cleartext wire (WR-01, also proven).

Third, the phase's headline contract ("EVERY host gets a bundle, so the credential helper
is consulted on every host") is not delivered on the cascade update path, which is the
path `marketplace update` uses (WR-02).

The tests are genuinely re-proven, not merely re-aimed: the new `git.test.ts` cases assert
at the transport that `fill` was never called and that no request carried `Authorization`,
and the orchestrator reducers pin `auth.host` **by value** (`"gitlab.example.com"`,
`auth=example.com`) rather than pinning key presence. GAUTH-05 has a real negative test
that constructs a `url`-kind source on `github.com` through the case-sensitive prefix
quirk. Residual test weaknesses are Low (IN-04). No comment-policy violations: I found no
phase/plan/wave/milestone numbers and no bare `Pitfall N`/`Pattern N` refs in any added
line.

## Critical Issues

### CR-01: Attaching a bundle to every host also attached an unrecoverable keychain eviction to every host

**File:** `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts:193-211`,
reached via `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:139-152`

**Issue:** `buildAuthCallbacks` returns a *pair*. Before this phase, `buildAuthForHost`
returned `undefined` for any host the registry did not claim, so `platform/git.ts` built
neither callback and `onAuthFailure` was unreachable on those hosts. It now returns a
bundle for every host, so `onAuthFailure` — which calls
`credentialOps.reject(opts.host, cred)` and thus `git credential reject` ->
`git credential-<helper> erase` — is live on every git host.

isomorphic-git's discover loop invokes `onAuthFailure` (not `onAuth`) on the **second**
401 of one operation (`node_modules/isomorphic-git/index.cjs:9468-9470`:
`const getAuth = providedAuthBefore ? onAuthFailure : onAuth`). So the sequence is: the
helper returns a stored PAT -> the server still answers 401 -> the PAT is erased from the
user's keychain for the whole host.

On `github.com` / `gitlab.com` that is survivable: CP-9's comment reasons that "the next
operation invokes onAuth which performs the right thing (fill miss -> Device Flow)". On a
host the registry does not claim there **is** no Device Flow — the replacement
`onAuthRequired` (`auth-host.ts:146-151`) resolves `{ ok: false }` and does no I/O. The
eviction is therefore terminal, and the secret is generally unrecoverable (a Gitea /
Bitbucket / GitHub-Enterprise PAT is displayed once at creation).

**Concrete failure scenario:** a user stores a read-scoped Gitea PAT for
`gitea.example.com` and runs
`pi marketplace add https://gitea.example.com/team/private-b`, where the PAT lacks read
access to `private-b`. Gitea answers 401. `onAuth` hits the helper and sends the PAT; the
server answers 401 again; `onAuthFailure` erases the PAT. The user's *working*
`marketplace update` for `team/private-a` on the same host now also fails, and the token
value is gone. Before this phase the same command carried no bundle and touched nothing.

**Proof** (scratch test, run green on this tree, then deleted — the fake's `reject`
really erases, so the follow-up `fill` returns `null`):

```ts
const bundle = buildAuthForHost({ host: "gitea.example.invalid", credentialOps, ctx });
const cbs = buildAuthCallbacks(bundle);
const first = await cbs.onAuth("https://gitea.example.invalid/team/private.git");
// -> { username: "u", password: "irreplaceable-pat" }
await cbs.onAuthFailure("https://gitea.example.invalid/team/private.git", first);
assert.deepStrictEqual(credentials.calls.reject, [
  { host: "gitea.example.invalid", credential: { username: "u", password: "irreplaceable-pat" } },
]);
assert.strictEqual(await credentials.credentialOps.fill("gitea.example.invalid"), null);
```

Note there is no test anywhere in the phase's 12 changed test files that exercises
`onAuthFailure` on a non-registry-host bundle — `tests/platform/git-auth-callbacks.test.ts`
proves `reject` fires (`:340`, `:367`, `:396`) but only for hand-built bundles, never for
one produced by `buildAuthForHost` on an unclaimed host.

**Fix:** make the destructive half conditional on there being a way back. Either gate the
eviction on the bundle knowing a re-mint path, e.g. carry the fact on the bundle instead
of re-deriving it:

```ts
// platform/git-auth-callbacks.ts
export interface BuildAuthCallbacksOpts {
  credentialOps: CredentialOps;
  host: string;
  onAuthRequired: OnAuthRequiredFn;
  /** When false, a rejected credential is NOT evicted: nothing can re-mint it. */
  evictOnFailure: boolean;
}

async function onAuthFailure(_url: string, cred: GitCredentials): Promise<GitCredentials> {
  if (!opts.evictOnFailure) {
    hookDebugLog(`onAuthFailure: keeping the stored credential for ${opts.host}`, "auth");
    return { cancel: true };
  }
  // ... existing reject path
}
```

with `auth-host.ts` setting `evictOnFailure: provider !== undefined`; or, if eviction on a
credential the server has definitively rejected is still wanted, sequence a
`reject -> approve` re-store so the value is not lost, and say so in the docstring.
Either way `git-auth-callbacks.ts:100-102` must stop reasoning about `onAuthFailure`
solely in terms of disclosure.

## Warnings

### WR-01: The new host compare ignores the URL scheme, so an `http://` source offers an https-stored credential in cleartext

**File:** `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts:153-167`
(compare), `extensions/pi-claude-marketplace/platform/git-credential.ts:199`
(`protocol=https` hardcoded), `extensions/pi-claude-marketplace/domain/source.ts:170-186`
and `:198-205` (object forms, unvalidated)

**Severity:** High

**Issue:** `onAuth` compares `new URL(url).host` against `opts.host` and nothing else. The
scheme never participates. Meanwhile `buildAttributeBlock` always emits
`protocol=https`, so the helper lookup claims https regardless of the transport actually
in use. `domain/source.ts` rejects `http://` **only** in the string-form parser
(`parseUrlSourceForm`, `:325-338`); `urlObjectSource` (`:170-186`) and
`gitSubdirObjectSource` (`:198-205`) hand their `url` straight to `parseUrlSource` /
store it verbatim with no scheme check. A marketplace `marketplace.json` is third-party
content.

Before this phase, a bundle for such a source existed only on `github.com` / `gitlab.com`
(both of which 301 port 80, so nothing 401s in cleartext). This phase extends it to every
host, including hosts that genuinely serve smart-HTTP over plaintext.

**Concrete failure scenario:** a marketplace manifest declares
`{"source": "url", "url": "http://gitea.internal.example/team/repo"}`. The user has a PAT
for `gitea.internal.example` in their helper. Install -> plaintext GET -> 401 -> host
compare passes (`gitea.internal.example` both sides) -> `fill` returns the https-stored
PAT -> isomorphic-git sends it as an HTTP Basic header over an unencrypted connection. Any
on-path observer captures it. The phase's own security argument (`auth-host.ts:123-131`)
enumerates redirect and helper-keying defenses and never mentions the scheme.

**Proof** (scratch test, run green on this tree, then deleted):

```ts
const source = parsePluginSource({ source: "url", url: "http://gitea.example.invalid/team/repo" });
assert.strictEqual(source.kind, "url");                       // no scheme rejection
assert.strictEqual(canonicalCloneUrl(source), "http://gitea.example.invalid/team/repo");
const bundle = buildCloneAuth(canonicalCloneUrl(source), source.kind, { ctx, credentialOps });
assert.strictEqual(bundle.host, "gitea.example.invalid");
const cred = await buildAuthCallbacks(bundle).onAuth("http://gitea.example.invalid/team/repo.git");
assert.deepStrictEqual(cred, { username: "u", password: "pat" });  // sent over cleartext
assert.deepStrictEqual(credentials.calls.fill, [{ host: "gitea.example.invalid" }]);
```

**Fix:** the compare is the right place, and it should compare what the helper lookup
assumes:

```ts
const requested = new URL(url);
if (requested.protocol !== "https:" || requested.host !== opts.host) {
  hookDebugLog(
    `onAuth: url ${requested.protocol}//${requested.host} does not match the bound https host ${opts.host}`,
    "auth",
  );
  return { cancel: true };
}
```

Secondarily, close the parse hole so a non-https object-form source never becomes a git
source at all: route `urlObjectSource` / `gitSubdirObjectSource` through the same
`unsupportedUrlReason` reject the string form uses (`domain/source.ts:333-335`).

### WR-02: GAUTH-03 is not delivered on the cascade update path — `marketplace update` still cannot reach a stored credential

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:160-163`;
contract asserted at `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:10-11`
and acknowledged at `:190-192`

**Severity:** High

**Issue:** `makeUpdateCloneProbe`'s local `buildBundle` returns `undefined` whenever
`auth.ctx === undefined`:

```ts
const buildBundle = (gitSource: GitBackedSource, cloneUrl: string) => {
  if (auth.ctx === undefined) {
    return undefined;
  }
  return buildAuthForHost({ host: hostFromCloneUrl(cloneUrl, gitSource.kind), ... });
};
```

and `update-swap.ts:179-183` pins `CascadeThreePhaseArgs.ctx?: never`, so the cascade
path — the one `marketplace update` drives for each of a marketplace's plugins — *always*
has no `ctx`. No bundle means `platform/git.ts` builds no callbacks, which means
`credentialOps.fill` is never consulted.

`ctx` exists only to build the Device Flow's `notifyFn` (`auth-host.ts:155`). The
non-registry arm of `buildAuthForHost` (`:146-151`) needs no `ctx` at all — it is a pure
closure. So the `ctx`-gated short-circuit now suppresses an auth path that has no
dependency on `ctx`, and it does so on the surface where it matters most. The module
header states the contract absolutely ("EVERY host gets a bundle, so ... its fill-first
path consults `credentialOps.fill(host)` on every host"), which is false as shipped.

**Concrete failure scenario:** a user has a Gitea PAT in their credential helper and a
private plugin installed from a Gitea marketplace. `pi plugin update <name>` (direct path,
has `ctx`) authenticates and updates. `pi marketplace update` cascading to the same plugin
carries no bundle, so the fetch 401s and the plugin renders
`(failed) {authentication required}` — with no cause line either, since the plugin grammar
has no trailer slot. Same credential, same host, same repo, two different outcomes.

**Fix:** build the bundle unconditionally and let the registry arm degrade instead of the
caller. `buildAuthForHost` needs `ctx` only to reach `makeRawNotifyFn`, so either make the
`ctx` optional there (a no-provider host never touches it) or, minimally:

```ts
const buildBundle = (gitSource: GitBackedSource, cloneUrl: string) => {
  const host = hostFromCloneUrl(cloneUrl, gitSource.kind);
  if (auth.ctx === undefined && hasDeviceFlowProvider(host)) {
    return undefined; // no notification surface for a Device Flow
  }
  return buildAuthForHost({ host, credentialOps: auth.credentialOps, ctx: auth.ctx!, ... });
};
```

and then update `auth-host.ts:190-192`, which currently documents the exception as a
deliberate carve-out.

### WR-03: `NO_STORED_CREDENTIAL_CAUSE` is attached on an outcome classification, so it asserts a fact it has not established

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:404-412`;
cause text at `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:93-94`;
miss paths at `extensions/pi-claude-marketplace/platform/git-credential.ts:251-274`

**Severity:** Medium

**Issue:** the guard fires on
`classifyGitTransportFailure(err) === "authentication required" && !hasDeviceFlowProvider(host)`
and then states as fact "no credential stored for `<host>`". But
`classifyGitTransportFailure` folds every `UserCanceledError` into
`"authentication required"` (`shared/git-failure-classifiers.ts:83-85`), and
`onAuth` returns `{ cancel: true }` — which isomorphic-git throws as `UserCanceledError` —
on several non-"empty helper" conditions. `credentialFill` deliberately collapses all of
these to `null` (`git-credential.ts:239-243`):

1. `git` absent from PATH (spawn ENOENT) -> `null`
2. the 5 s `CREDENTIAL_TIMEOUT_MS` SIGTERM -> `null` (a locked macOS keychain, a slow
   `pass`/`op`/pinentry helper)
3. a helper that exits non-zero for any reason -> `null`
4. exit 0 but the helper emitted no `username=` / `password=` pair -> `null`

and `onAuth` additionally cancels on a host/URL mismatch (`git-auth-callbacks.ts:154-162`)
and on any thrown error (`:179-189`).

Every one of those reaches the user as `no credential stored for <host>; add one with
git credential approve`. A user whose PAT *is* stored, behind a helper that took 5.1 s,
is told the opposite and directed to re-store a credential that is already there. The
audit trail is `hookDebugLog`-only, i.e. invisible without
`PI_CLAUDE_MARKETPLACE_DEBUG=1`.

**Fix:** attach the line on evidence, not on the outcome token. The `onAuthRequired`
closure is the only place that knows the helper genuinely returned a miss; have the
no-provider arm distinguish it, or widen `CredentialOps.fill` to return a
`{ kind: "miss" } | { kind: "unavailable"; detail: string }` discriminant so the cause line
can say `the git credential helper did not answer for <host>` in cases 1-3. At minimum,
soften the assertion to something the code can actually back:

```ts
export const NO_STORED_CREDENTIAL_CAUSE: (host: string) => string = (host) =>
  `no credential was obtained for ${host}; store one with git credential approve`;
```

### WR-04: `git credential fill` now spawns for arbitrary hosts, and the non-interactive guarantee does not cover third-party helpers

**File:** `extensions/pi-claude-marketplace/platform/git-credential.ts:137-144` (env),
`:26-30` (the guarantee), reached for every host via
`extensions/pi-claude-marketplace/orchestrators/auth-host.ts:139`

**Severity:** Medium

**Issue:** the docstring's non-interactive guarantee rests on `GIT_TERMINAL_PROMPT=0` and
`GCM_INTERACTIVE=never`. Those are necessary but not sufficient for the new breadth:

- `GIT_TERMINAL_PROMPT=0` suppresses **git's own** terminal prompt. It does not suppress a
  configured `credential.helper` that prompts on its own — `pass`/gpg-agent pinentry,
  `op`/1Password, `gh auth`, a shell one-liner helper — nor a macOS keychain
  *access-permission* dialog from `git-credential-osxkeychain`, which is a GUI prompt
  `GIT_TERMINAL_PROMPT` never sees. `GIT_ASKPASS` / `SSH_ASKPASS` / `core.askPass` are
  also left intact.
- The 5 s timeout then SIGTERMs mid-prompt, so the user's experience is a dialog that
  flashes and a wrong "no credential stored" line (see WR-03).
- `spawn` passes no `cwd`, so `credential.helper` is resolved from whatever repository the
  Pi process happens to be sitting in. That was already true, but it now runs on every
  host rather than two, making the outcome non-deterministic across invocations far more
  often.

**Concrete failure scenario:** a user with `credential.helper = /usr/bin/pass-git-helper`
runs `pi plugin fetch` across a manifest with six git plugins on five hosts. Each
challenged source spawns one `git credential fill`; pinentry pops per host; each is killed
at 5 s; all five render "no credential stored for …".

**Fix:** either document the residual interactive surface honestly in the
`git-credential.ts` header (naming askpass and GUI-helper prompts as out of scope), or
close it: add `GIT_ASKPASS=""`/`SSH_ASKPASS=""` and `-c core.askPass=` to the spawn, and
consider `-c credential.interactive=false` where the helper honors it. Either way the
"Non-interactive guarantee" heading should not claim more than the two env vars deliver.

### WR-05: Docstrings still describe the retired contract

**Severity:** Medium

**Issue:** the phase rewrote several docstrings but left others asserting the
`undefined`-for-no-provider world, in files it touched:

| File:line | Stale claim |
| --- | --- |
| `orchestrators/auth-host.ts:2-8` | Header still reads "Host-keyed auth bundle factory" that turns "a bare host into a `GitAuthBundle` bound to **that host's registered provider**". The general case now has no provider. |
| `orchestrators/auth-host.ts:190-192` | "`update.ts` is the one git-plugin probe still outside it" — the file is `update-preflight.ts`; `orchestrators/plugin/update.ts` does not exist. |
| `orchestrators/plugin/clone-cache.ts:160-161` | "`auth` is an optional bundle … When omitted the clone is byte-identical to the public-only path (PROV-02)". Every install / reinstall / fetch / `info --fetch` caller now passes it unconditionally; the only remaining omitter is the `ctx`-less cascade path of WR-02, i.e. a bug, not a documented mode. |
| `orchestrators/plugin/install.messaging.ts:201, 207, 304` | Leads with `PROV-04`, the requirement this phase deleted ("no registered provider fails clean"), and attributes `onAuth` to `platform/git.ts` — it has lived in `platform/git-auth-callbacks.ts` for some time. |
| `orchestrators/marketplace/shared.ts:221-224` | "The optional `auth` parameter is forwarded to `gitOps.fetch` so private-repository refreshes can trigger **Device Flow** on a credential miss" — now true only on registry hosts. |
| `platform/git-auth-callbacks.ts:99` | Attributes the new compare to "(PROV-04 / T-79-04)". PROV-04 *was* the refusal this compare replaced; citing it as the compare's own requirement inverts the traceability. GAUTH-06 is already cited at `:75` and `:133` and is the right ID. |
| `platform/git-auth-callbacks.ts:45-48` | "The orchestrator binds `host`, `credentialOps`, and `notifyFn` at the call site" — the new non-registry closure (`auth-host.ts:146-151`) binds only `host`. |

Per the repo's comment policy, requirement and decision IDs are traceability and should be
kept — the defect is that these ones now point at retired semantics, which is worse than
no ID.

**Fix:** re-aim each row at the live contract; replace `PROV-04` with `GAUTH-04`/`GAUTH-06`
where the sentence describes current behavior; fix the two wrong file names
(`update.ts` -> `update-preflight.ts`, `platform/git.ts` -> `platform/git-auth-callbacks.ts`).

## Info

### IN-01: `deviceFlowAttempted` is documented in two places and does not exist

**File:** `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts:66-70`, `:139-146`

**Issue:** both the factory docstring ("The factory owns a closure-scoped
`deviceFlowAttempted` flag (set when `onAuthRequired` returns `{ ok: true }`)") and the
in-body comment describe a variable that is not declared anywhere in the module
(`grep -rn deviceFlowAttempted extensions/ tests/` returns only these two comments). The
claim predates this phase, but the phase rewrote the surrounding docstring block and left
it. **Fix:** delete both references; the CP-9 rationale below them stands on its own.

### IN-02: The cause line's remedy is not executable as written

**File:** `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:93-94`

**Issue:** `add one with git credential approve` names a command that reads the
git-credential wire format from stdin and does nothing useful when run bare. A user
following the line literally sees a hang, then nothing. It also must be fed exactly the
attribute set `buildAttributeBlock` uses — `protocol=https` + `host=` + `username=` +
`password=`, and **no** `path=` line (`git-credential.ts:193-196`) — or `fill` will not
find the entry. **Fix:** name the shape, e.g.
`` `printf 'protocol=https\\nhost=${host}\\nusername=<u>\\npassword=<t>\\n\\n' | git credential approve` ``,
or point at the helper the user already has configured.

### IN-03: `hasDeviceFlowProvider` re-derives a fact the bundle already computed

**File:** `extensions/pi-claude-marketplace/orchestrators/auth-host.ts:103-105`, consumed
at `orchestrators/marketplace/update.ts:410`

**Issue:** `refreshUrlClone` calls `buildAuthForHost(host)` — which runs
`findProviderForHost(host)` at `:142` — and then calls `hasDeviceFlowProvider(host)`,
running the same registry lookup again for the same host, to recover a fact the first call
already knew. The two lookups can never disagree today, but they are two independent
derivations of one predicate, which is the shape that drifts. **Fix:** carry it on the
bundle (`readonly hasDeviceFlow: boolean`) and drop the second lookup; this also gives
CR-01 the flag it needs.

### IN-04: Two test reducers discard the bundle fields they do not compare

**File:** `tests/edge/handlers/marketplace/add.test.ts:95-101, 233-238`;
`tests/edge/handlers/marketplace/update.test.ts:82-89, 170-173`;
`tests/orchestrators/marketplace/update.test.ts:350-357` (and four sibling call sites)

**Issue:** `DescribedCloneCall` / `DescribedFetchCall` reduce the recorded bundle to
`{ host }`, dropping `credentialOps` and `onAuthRequired` entirely, so a bundle bound to
the right host but carrying the wrong `credentialOps` (or a non-callable
`onAuthRequired`) passes. Separately, the `update.test.ts` expectations spell
`onAuthRequired: state.fetchCalls[0]?.auth?.onAuthRequired`, reading the expected value off
the actual — which does still catch an absent key under `deepStrictEqual`, but proves
nothing about the closure. The orchestrator-level suites (`install-clone-probe.test.ts:172-176`,
`reinstall-clone-probe.test.ts:186-192`, `install-flow.test.ts:7179-7200`) *do* pin
`credentialOps` by identity, so the gap is narrow. **Fix:** include `credentialOps` in
the edge reducers (it is a stable injected identity) and add
`authRequiredType: typeof auth?.onAuthRequired` as `install-flow.test.ts` already does.

### IN-05: A host/URL mismatch and an empty helper are indistinguishable to the user

**File:** `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts:154-162`
combined with `orchestrators/marketplace/update.ts:404-412`

**Issue:** the mismatch cancel and the helper-miss cancel both surface as the same
`UserCanceledError`, so both render `no credential stored for <host>`. I could not reach
the mismatch on any production route (every producer pairs its bundle with the URL it then
clones), so this is latent rather than live — but it means the guard that CR-01/GAUTH-06
depends on fires *silently* apart from a `hookDebugLog` line, and a future caller that
introduces a mismatch will be debugged as a credential problem. A subcase worth noting:
`refreshUrlClone` derives the bundle host from `source.url` while `refreshGitHubClone`
fetches by **remote name**, so isomorphic-git supplies the on-disk
`remote.origin.url` — the two agree today only because `add` wrote origin from the same
`source.url`. **Fix:** give the mismatch its own cause line (or a distinct error identity)
rather than letting it borrow the stored-credential one.

---

_Reviewed: 2026-09-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Scope: `git diff f4f98c66..3adb12c4 -- extensions/ tests/` (22 files)_
_No source file was modified. Two scratch test files were created under `tests/orchestrators/`
to prove CR-01 and WR-01, run with `node --test --experimental-strip-types`, and deleted._
