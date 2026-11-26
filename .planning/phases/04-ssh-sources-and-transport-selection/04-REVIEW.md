---
phase: 04-ssh-sources-and-transport-selection
reviewed: 2026-11-26T00:00:00Z
depth: standard
files_reviewed: 59
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/domain/git-url.ts
  - extensions/pi-claude-marketplace/domain/github-plugin-transport.ts
  - extensions/pi-claude-marketplace/domain/github-transport.ts
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/github-transport.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/marketplaces.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-bindings.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/platform/git-failure-kind.ts
  - extensions/pi-claude-marketplace/platform/git-process.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/github-base-url.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - extensions/pi-claude-marketplace/shared/upstream-flag.ts
findings:
  critical: 4
  warning: 7
  info: 11
  total: 22
status: issues_found
---

# Phase 4: Code Review

Two reviewers split the 59 changed source files (diff base 76b7543). Slice A is the transport and URL core (IDs `*-A-*`). Slice B is the plugin flows and notifications (IDs `*-B-*`). CR-A-01 and CR-B-01 are the same leak; the security audit records it as F-04-1.

## Slice A: transport and URL core

### Slice A report

**Reviewed:** 2026-11-26
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

### Summary

Reviewed the 22 files of slice A in `git diff 76b7543 HEAD`. The slice covers
the D-SG-17 validator port, scp and ssh source parsing, the D-SG-23 identity
fold, the probe and skip checks, the transport plans and their runner, the
D-SG-21 base override pairs, the ssh launches in `git-process.ts`, and the
marketplace add, update, and swap wiring. I also read the paired tests and the
04-CONTEXT and 04-EVIDENCE records.

The argv handling holds up. Probe and `ssh -G` argument lists are fixed
literals. The `-G >&2` tail is a fixed literal that only a network-lane
`ls-remote` accepts. Operands sit behind `--end-of-options`. The validator
refuses `-`-leading hosts and users in the scp and `ssh://` forms. I found no
way for a manifest value to reach ssh as an option. Retry plans are bounded
(at most 2 attempts off Windows, 3 on Windows).

I confirmed both Critical findings by running a script against the real
modules:

1. **CR-A-01, credential leak.** A GitHub url source with userinfo prints its
   token in the new D-SG-22 "Cloning via HTTPS" line. The block name next to
   it is redacted.
2. **CR-A-02, GHB-04 regression.** An invalid `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`
   now breaks the add and the plugin clone of sources that are not GitHub,
   because the plan reads the forced transport before it checks the source
   kind.

The warnings are about the base override (wrong transport label and dropped
auth for SSH-spelled GitHub addresses, and `ssh+git://` going past the
mirror), errors that stop the clone being wrapped as "both failed", and the
refresh path hiding the both-failed error.

The necessity rubric (`necessity-review.md`) was read. Out of scope as
instructed: the D-SG-22 no-note paths in WINDOWS.md and the 5 fd-dependent
scenarios in `features/hook/tool-use.feature`.

### Critical Issues

#### CR-A-01: The D-SG-22 clone note shows URL credentials in clear text

**File:** `extensions/pi-claude-marketplace/domain/github-transport.ts:158-168,185-193`, `extensions/pi-claude-marketplace/domain/github-plugin-transport.ts:284-292`, `extensions/pi-claude-marketplace/orchestrators/github-transport.ts:122-131`

**Issue:** A url source whose authority holds userinfo, such as
`https://x-access-token:ghp_SECRET@github.com/o/r.git`, is not parsed as the
`github` kind. `gitHubUrlPath` compares the whole authority with `github.com`,
so the source stays a `url`. `gitHubAddressOf` reads the WHATWG `hostname`
and still folds it. So `urlSourceNote` (and `asWritten` on the plugin side)
gives the note `via-https`, and `recordNote` stores `url: plan.first.url`,
which is the raw address with the token. The renderer prints it verbatim
(`shared/notification-grammar.ts:1131`, `${CLONE_NOTE_LEADS[clone.note]}: ${clone.url}`),
and so does the JSON wire (`notification-json.ts:484-497`). `resolveRows` redacts
`mp.name` but spreads `clone` through untouched. Retry URLs in
`clone.retries` have the same problem.

I reproduced it. A marketplace block whose name renders as
`https://***@github.com/o/r.git` printed
`Cloning via HTTPS: https://x-access-token:ghp_SECRET@github.com/o/r.git`.
In `json`/`rpc` mode the line goes into the session through `pi.appendEntry`,
so the token is saved. This breaks PMOD-04 and T-04-06.

**Fix:** Redact where the note is made, so every renderer and the wire get a
safe value, and keep the resolver as a second layer:
```ts
// orchestrators/github-transport.ts
import { redactCredentials } from "../shared/redact-credentials.ts";

function recordNote(run: GitHubCloneRun<unknown>, retries: readonly string[]): void {
  const { plan } = run;
  if (plan.note !== undefined) {
    run.notes.record(run.subject, {
      note: plan.note,
      url: redactCredentials(plan.first.url),
      ...(retries.length > 0 && { retries: retries.map((url) => redactCredentials(url)) }),
    });
  }
}
```
Also redact `clone.url` and `clone.retries` in `resolveRows` and `resolveRow`
(`shared/notification-resolve.ts:395-398`). Add a unit row and a cucumber
scenario with a userinfo GitHub url source.

#### CR-A-02: An invalid GitHub base override now fails non-GitHub adds and clones (GHB-04 regression)

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:1028-1031`, `extensions/pi-claude-marketplace/orchestrators/github-transport.ts:334-340,427-431`

**Issue:** GHB-04 says a URL outside GitHub never reads or validates
`PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` (`shared/github-base-url.ts:314-315`).
`clone-swap.ts:144` follows that rule with
`source.kind === "github" ? transportForce(process.env) : undefined`, and
`test/orchestrators/marketplace/update.test.ts:1945` pins it for update. Two
new call sites skip the guard:

- `gitStagingSteps.stage` in `add.ts` passes `force: transportForce(process.env)`
  for every git source, a `https://gitlab.example/o/r.git` url source included.
- `pluginCloneTransport(...).plan` reads `context.force` while it builds the
  `planPluginClone` input. That runs the getter (`transportForce(args.env)`)
  before `planPluginClone` checks `source.kind === "url"`.

`transportForce` calls `gitHubOverrideHost()`, which throws
`InvalidGitHubBaseUrlError` for a malformed value. I confirmed this: with the
variable set to `http://bad.example`, planning the clone of a gitlab url
plugin threw `InvalidGitHubBaseUrlError`. Before this phase,
`gitHubInsteadOfPairs` read the variable only for GitHub URLs, so this is a
regression. The orchestrated callers rethrow this error class
(`rethrowInvalidGitHubBaseUrl` in import; the GHB-03 tests in `add.test.ts:6573`),
so one bad variable can abort a whole `apply` or `import` over a non-GitHub
marketplace or plugin.

**Fix:** Read the forced transport only for a source that can be GitHub:
```ts
// add.ts gitStagingSteps.stage
const plan = await planMarketplaceClone({
  source,
  force: source.kind === "github" ? transportForce(process.env) : undefined,
  probe: () => gitHubSsh.probe(),
});

// orchestrators/github-transport.ts pluginCloneTransport
plan: () =>
  planPluginClone({
    source,
    force: needsForce(source) ? context.force : undefined,
    checks: context.checks,
    platform: context.platform,
  }),
// needsForce: source.kind === "github" ||
//   (source.kind === "git-subdir" && isGitSubdirShorthand(source.url))
```
Add GHB-04 rows for a url marketplace add and a url plugin clone with an
invalid base.

### Warnings

#### WR-A-01: Under the base override, an SSH-spelled GitHub address is labelled SSH and loses its auth bundle, but goes to the base over HTTPS

**File:** `extensions/pi-claude-marketplace/domain/github-transport.ts:147-150,185-193`, `extensions/pi-claude-marketplace/domain/github-plugin-transport.ts:284-292`, `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:1044`, `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts:313-319`

**Issue:** `addressTransport` decides the transport from the address as
written. With the base set to `https://mirror.example`, the url source
`git@github.com:o/r.git` plans `{transport: "ssh"}` with the note `via-ssh`.
But `runRemote` adds `url.https://mirror.example/.insteadOf=git@github.com:`
(I checked this), so git fetches `https://mirror.example/o/r.git` over
HTTPS. The user sees "Cloning via SSH: git@github.com:o/r.git" for an HTTPS
request. Also, every caller passes `auth` only when
`attempt.transport === "https"`. So the bundle that `hostFromCloneUrl` binds
to the override host for exactly this case (`auth-host.ts:118-121`, "binds
the same host, because the base receives it too (D-SG-21)") never reaches
`runWithAuthBundle`. A rejected stored credential or a Device Flow sign-in
against the mirror is not mapped. The same applies to `ssh://`,
`git+ssh://`, and `ssh.github.com` spellings.

**Fix:** Decide the label and the bundle from the wire form. When
`transportForce` is `base-override` and `gitHubAddressOf(url)` folds, use
`transport: "https"` with the `via-https` note (or a base-specific note), so
the auth bundle goes with the attempt:
```ts
function wireTransport(url: string, force: TransportForce | undefined): GitHubTransport {
  return force === "base-override" && gitHubAddressOf(url) !== undefined
    ? "https"
    : addressTransport(url);
}
```

#### WR-A-02: An `ssh+git://` GitHub address bypasses the base override and contacts the real github.com

**File:** `extensions/pi-claude-marketplace/shared/github-base-url.ts:103-112,279-282`, `extensions/pi-claude-marketplace/domain/git-url.ts:38-45`

**Issue:** D-SG-21 says "while `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` is set,
every GitHub address form reaches the base". It also says the probe is
skipped because it "would contact the real github.com". The validator accepts
`ssh+git://git@github.com/o/r.git` (`ACCEPTED_PROTOCOLS`), and git treats it
as ssh. But `FOLDING_PROTOCOLS` leaves out `ssh+git:` (matching upstream
`Ort`), so `gitHubRewritePrefix` returns undefined, no `insteadOf` pair is
added, and the clone goes over SSH to the real github.com while the user
believes everything goes to the mirror. I confirmed that
`gitHubInsteadOfPairs("ssh+git://git@github.com/o/r.git")` returns `[]`. The
test at `test/shared/github-base-url.test.ts:146` pins this as "no GitHub
address", which keeps the D-SG-23 identity fold at parity. But the
base-override rewrite has no upstream analogue to stay at parity with.

**Fix:** Keep `gitHubAddressOf` at upstream parity for identity. Give the
rewrite prefix its own check that also accepts `ssh+git:` (and `git+https:`,
`git+http:`, which already fold) with a github.com or ssh.github.com host:
```ts
const REWRITE_ONLY_PROTOCOLS = new Set(["ssh+git:"]);
function gitHubRewritePrefix(url: string): string | undefined { /* fold, or the ssh+git arm */ }
```
If the gap is intended instead, record it in D-SG-21 and in the NFR-5 text,
which now says the base override skips "every SSH attempt".

#### WR-A-03: A retry that stops the clone (abort, git missing, Device Flow refused) is reported as "failed over both transports", sometimes with the wrong transport label

**File:** `extensions/pi-claude-marketplace/orchestrators/github-transport.ts:192-201`, `extensions/pi-claude-marketplace/domain/github-plugin-transport.ts:391-394`, `extensions/pi-claude-marketplace/shared/errors.ts:1454-1456`

**Issue:** The `domain/github-transport.ts` header says the clone gives no
other attempt after `git-missing`, `aborted`, or `DeviceFlowUnavailableError`,
"so a retry that failed too would hide the refusal's remedy". That holds only
when the first attempt fails. When the second attempt fails with one of these,
`plan.after` returns undefined, and `runAfter` wraps the pair in
`bothFailedError` (`earlier !== undefined`). Results:

- When a marketplace or plugin clone is aborted during its retry, the error
  becomes `GitHubTransportsFailedError` ("failed on both attempts ... SSH
  (...): git clone aborted"). Before, the caller saw the abort itself.
- In print mode, an SSH-first marketplace whose HTTPS retry raises
  `DeviceFlowUnavailableError` buries the MODE-04 remedy as the second part of
  a both-failed message. This is the case the header promises to prevent.
- On Windows, SSH key failure, then HTTPS fails with a stopping error:
  `windowsPlan.after` returns undefined, and the plugin-surface message reads
  `<ssh error>\nThe retry over SSH failed too: <https error>`. The last
  attempt was HTTPS, not SSH, and the remedy text is then wrong.

**Fix:** When the failed retry stops the clone, rethrow it as it is:
```ts
if (next === undefined) {
  if (earlier === undefined || stopsTheClone(failed.error)) {
    throw failed.error;
  }
  ...
}
```
Also, write the plugin message's "retry over SSH" clause only when
`last.transport === "ssh"`, or build it from `TRANSPORT_LABELS[last.transport]`.

#### WR-A-04: A refresh that fails over both transports never shows the both-failed error, and the first attempt's failure is dropped without a log line

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/clone-swap.ts:331-354,449-451`

**Issue:** `listRemoteHead` walks the freshness plan. When every attempt fails,
it returns `{kind: "unreachable", cause: err}` with only the last error, and
the first attempt's error is dropped without a debug line, unlike
`cloneOverGitHubTransports`. `cloneIntoStaging` then re-plans (a second
probe), runs the re-clone over both transports, and on failure throws
`freshness.cause`, not the clone's `GitHubTransportsFailedError`. The
freshness check and the re-clone reach the same remote, so the usual
both-failed case (no SSH key and no HTTPS credential, or the repository is
gone) is almost always unreachable at the freshness check too. So the
marketplace-surface both-failed message (D-SG-22 / OQ-8, upstream `wqo`,
which upstream's `_Fi` refresh throws) almost never reaches
`marketplace update`, autoupdate, or the PUP-2 sync. The user sees one
transport's error, while the block's clone note lists a retry whose failure
the output does not show.

**Fix:** Make `listRemoteHead` keep every attempt's failure and debug-log each
fallback as `runAfter` does. In `cloneIntoStaging`, keep `freshness.cause`
only for the GAUTH-04 case it exists for (a `StoredCredentialRejectedError`),
and otherwise throw the clone's own error, which carries both attempts:
```ts
const failure =
  freshness.kind === "unreachable" && freshness.cause instanceof StoredCredentialRejectedError
    ? freshness.cause
    : err;
```

### Info

#### IN-A-01: The `owner/repo` shorthand is not checked against upstream's repository pattern before the SSH and HTTPS URLs are built

**File:** `extensions/pi-claude-marketplace/domain/github-plugin-transport.ts:309-318`, `extensions/pi-claude-marketplace/domain/github-transport.ts:97-100` (parse in `domain/source.ts:591-603`, not changed in this phase)

**Issue:** Upstream `zHi` refuses any repo that fails
`/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/` ("Invalid GitHub repository format").
Pi's `parseOwnerRepo` accepts any one-slash string, so `evil:x/y` parses as
owner `evil:x` (confirmed), and the new SSH arm builds
`git@github.com:evil:x/y.git`. The host stays github.com and argv is safe, so
this is a parity gap, not an injection.
**Fix:** Check the owner and repo against upstream's pattern in
`gitHubAttempts`/`gitHubSshCloneUrl`, or at parse time with upstream's message.

#### IN-A-02: The transport label calls `http://` "HTTPS" and treats `file:` as HTTPS

**File:** `extensions/pi-claude-marketplace/domain/github-transport.ts:85-86,147-168`
**Issue:** `HTTPS_URL = /^https?:/i` gives an `http://github.com/o/r` url
source the note "Cloning via HTTPS", which is wrong for plain HTTP.
`addressTransport` returns `"https"` for `file:` too, so the add passes the
host auth bundle to a local `file://` clone.
**Fix:** Treat only `https:` as HTTPS. Add an `"other"` transport for `http:`
and `file:` that gets no note and no bundle.

#### IN-A-03: A failed `beforeRetry` replaces the clone failure

**File:** `extensions/pi-claude-marketplace/orchestrators/github-transport.ts:208`
**Issue:** When `run.beforeRetry()` rejects (for example, staging could not be
removed), the rm error goes up and the first attempt's error is lost.
Upstream's plugin path reports `Could not clear <dir> for the SSH retry: ...`,
and on Windows it rethrows the SSH error.
**Fix:** Catch the error and throw the first failure with the rm error as its
cause, or append the leak as `appendLeakToError` does.

#### IN-A-04: On the command line, single-slash scheme forms get a different message from upstream

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:815-829`
**Issue:** `isCommandLineRefusal` matches only `scheme://`. So `file:/x` gets
the validator's "a scheme URL must be spelled scheme://…", and `ssh:/h/x`
gets the shorthand reason. Upstream's `$Ce` returns `null` for both (they
hold `/` and `:`), which gives
`Invalid marketplace source format. Try: owner/repo, https://..., or ./path`.
**Fix:** On the command line, refuse any input that holds `:` and `/` and is
not `http(s)://`, the scp form, or a path, as `$Ce` does.

#### IN-A-05: Skip checks are cached per command, but upstream re-runs them for each member

**File:** `extensions/pi-claude-marketplace/orchestrators/github-transport.ts:433-439`
**Issue:** 04-EVIDENCE Q7 records that upstream caches only the probe
(`n??=Jxn()`) and re-runs `--get-url`, `ssh -G`, and `git config` for each
`github` member. `createPluginTransportContext` caches all of them for the
whole command (`once`, `oncePerUrl`). Users will not see this, because they
are local reads in one command, but no decision ID records it.
**Fix:** Record it as a decided divergence, or cache only the probe.

#### IN-A-06: Duplicated helpers across the transport modules

**File:** `domain/github-transport.ts:93-95,122-124`, `domain/github-plugin-transport.ts:277-279,304-307,465`, `orchestrators/marketplace/clone-swap.ts:152-157`, `orchestrators/github-transport.ts:118`, `shared/errors.ts:1447`
**Issue:** `noRetry` is defined twice and `oneAttemptPlan` repeats it.
`TRANSPORT_LABELS` exists twice. The `owner/repo` split exists twice
(`tagReadUrl` and `shorthandSource`). The `raw.includes("://")` test exists
twice (`isOwnerRepoSpelling` and the inline check in `planPluginClone`). If
these drift, the marketplace and plugin plans start to disagree.
**Fix:** Export one `noRetry`, `isOwnerRepoSpelling`, and `shorthandSource`
from `domain/github-transport.ts`, and one label table from `shared/`.

#### IN-A-07: Impossible-state guard: the `MAX_ATTEMPTS` cap is never reached

**File:** `extensions/pi-claude-marketplace/orchestrators/github-transport.ts:159-161,187-190`
**Category:** necessity
**Issue:** Each `TransportPlan` producer in the tree is already bounded.
`retryWith` (domain/github-transport.ts:140-145) gives its other attempt only
after its first transport. The off-Windows plugin plan gives SSH only after
HTTPS. `windowsPlan` stops after `httpsTried`. `oneAttemptPlan` and `noRetry`
give nothing. So no plan can ask for a fourth attempt, and
`retries.length + 1 < MAX_ATTEMPTS` never changes the result. Calling it
unneeded is a judgment call, because it guards plans that do not exist yet.
**Fix:** Keep it as documented defense, or remove it and state the bound on
`TransportPlan.after`.

---

_Reviewed: 2026-11-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Slice B: plugin flows and notifications

### Slice B report

**Reviewed:** 2026-11-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

### Summary

I reviewed the 37 files in `76b7543..HEAD`: plugin install, update, reinstall, fetch, info, and enable; clone-cache; the tag probes; reconcile apply; and the notification types, grammar, JSON, and wire schema that carry `clone.note`, `clone.url`, and `clone.retries`. I also read the code they call: `orchestrators/github-transport.ts`, `domain/github-plugin-transport.ts`, `shared/notification-resolve.ts`, `shared/notification-present.ts`, and `orchestrators/marketplace/{update,shared}.ts`.

Two findings block shipping:

- **Credentials leak.** A clone note's URL reaches the text and JSON output with no credential redaction. I confirmed this by running `planPluginClone` on a `url` source with a token in its userinfo.
- **Notes land on the wrong row.** Bare `update` and bare `reinstall` share one notes collector across both scopes, keyed by `<plugin>@<marketplace>`. A plugin installed in both scopes can show the other scope's clone note. `apply`, `fetch`, `info`, and `import` avoid this with `withOwnCloneNotes`; update and reinstall do not.

Answers to the three QD items:

1. **Preflight default context.** No production root relies on the `transportContext` default in `update-preflight.ts:1198`. The update, autoupdate, converge, and reinstall roots each create a context, and install and dependency moves pass theirs through. The same is true of the default in `install-clone-probe.ts:70`. These defaults run only for direct test callers (IN-B-02).
2. **`createApplyReconcile`'s `newTransportContext`.** It is harmless dependency injection, and production uses the default. But its sibling `createScopeDependencyInstall` makes a new context on every call, so one `marketplace update` command probes several times (WR-B-01).
3. **`withOwnCloneNotes` keying.** It is correct where it is used: `apply` makes a view per op, `fetch` per target, and `info` per scope. It is missing from update and reinstall (CR-B-02).

### Critical Issues

#### CR-B-01: Clone note URL is rendered with credentials in text and JSON

**File:** `extensions/pi-claude-marketplace/orchestrators/github-transport.ts:122-131` (producer), `extensions/pi-claude-marketplace/shared/notification-grammar.ts:1126-1140`, `extensions/pi-claude-marketplace/shared/notification-json.ts:484-496`, `extensions/pi-claude-marketplace/shared/notification-resolve.ts:389-415` (missing redaction)

**Issue:** `recordNote` copies `plan.first.url` and each retry URL into the note as they are. For a `url` plugin source, `planPluginClone` uses `asWritten(networkCloneUrl(source))`, which is `source.raw` with its userinfo kept. `gitHubAddressOf` still treats the address as GitHub when it has userinfo (`urlPathSpan` slices the host after the last `@`), so the plan gets a `via-https` note. I ran it with this input:

```
parsePluginSource({source:"url", url:"https://oauth2:ghp_abcdefghijklmnopqrstuvwxyz@github.com/acme/private.git"})
-> planPluginClone(...) = {"note":"via-https","url":"https://oauth2:ghp_abcdefghijklmnopqrstuvwxyz@github.com/acme/private.git"}
```

Nothing between there and the output redacts the URL:

- `composeCloneNoteLines` prints `${clone.url}` and each retry URL.
- `wireClone` emits `url` and `retries` as they are.
- `resolveRows` redacts only `mp.name` and the row `name`.
- `redactPluginInfo` redacts only the name and the notes.

So a token in a user's recorded source prints in every successful install, update, reinstall, fetch, enable, and `info --fetch` of that plugin, in both the TUI and the JSON/RPC channel. Every other place that can carry a URL goes through `redactCredentials` (PMOD-04, D-07). The marketplace surface records notes the same way (`clone-swap.ts`, `marketplace/add.ts`), so marketplace blocks are affected too.

**Fix:** Redact once, at the presentation chokepoint, so the text and JSON outputs cannot drift. In `notification-resolve.ts::resolveRows`, and in `notification-present.ts::redactPluginInfo` for `plugin.clone`:

```ts
function redactClone(clone: CloneTransportNote | undefined): CloneTransportNote | undefined {
  return clone === undefined
    ? undefined
    : {
        note: clone.note,
        url: redactCredentials(clone.url),
        ...(clone.retries !== undefined && { retries: clone.retries.map(redactCredentials) }),
      };
}
// resolveRows: { ...mp, name: redactCredentials(mp.name), ...(mp.clone && { clone: redactClone(mp.clone) }), plugins: ... }
// per row:     "clone" in resolved && resolved.clone !== undefined ? { ...redacted, clone: redactClone(resolved.clone) } : redacted
```

Also consider `redactCredentials` in `recordNote` as a second layer. Add a test that pins `https://***@github.com/...` in both the text and the JSON output.

#### CR-B-02: Bare `update` and bare `reinstall` show one scope's clone note on the other scope's row

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:565-579, 475`; `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts:189-194`; `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:577, 594, 603`; `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts:139-143`

**Issue:** `updatePluginsWith` makes one context and hands that same object to every target (`buildDirectThreePhaseArgs` line 475). The rows read `clones.plugins = transportContext.notes` by `<plugin>@<marketplace>` alone. `reinstallPluginsWith` does the same (lines 577, 594, 603). With no `--scope`, both commands list targets in both scopes (`update-flow.ts:1471`, `reinstall-targets.ts:69`).

Each scope has its own `plugin-clones/` mirror. Suppose `tools@acme` is installed in both scopes and only the project mirror is stale. The project refresh re-clones and records the note. The user refresh finds the mirror current, so its clone step never runs and records nothing. `groupCascadeOutcomes` then reads `noteFor("tools@acme")` for both rows, so the user row prints a "Cloning via ..." line for a clone that never ran. When both scopes do clone, the last one overwrites the first, and the project row shows the user clone's retries.

The two scopes can also record a same-name marketplace that points at different repositories. Then the URL on the row belongs to the other repository. Dependency rows (`withCloneNote(row, clones?.plugins, row.name)`, line 194) have the same problem.

This is exactly the case that `withOwnCloneNotes` exists for. Its doc says: "A command that clones one `<plugin>@<marketplace>` in both scopes gives each scope its own view". `apply`, `fetch`, `info`, and `import` all use it.

**Fix:** Give each target its own view, and keep those views for rendering.

```ts
// update-flow.ts, in the target loop
const targetContext = withOwnCloneNotes(transportContext);
outcome = await runPluginUpdate(
  buildDirectThreePhaseArgs({ ...runOpts, transportContext: targetContext }, t, cardinality, bindings, runScoped, report),
);
outcomes.push({ target: t, outcome, notes: targetContext.notes });
// update-cascade.ts: read `notes` from the outcome entry instead of `clones.plugins`
```

Do the same in `reinstallPluginsWith`: one `withOwnCloneNotes(transportContext)` per target, carried on the outcome or in a `Map<outcome, notes>` that `renderReinstallPartitionAndNotify` reads. Add a unit row with the plugin in both scopes, one warm and one cold, and assert that only the cold scope's row has `clone`.

### Warnings

#### WR-B-01: `createScopeDependencyInstall` makes a new transport context on every call, so one command probes several times

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:2591-2613`

**Issue:** `installMissingDependencies` calls `newTransportContext()` each time it runs. Its callers:

- `marketplace update` / autoupdate calls it once per marketplace refreshed (`marketplace/update.ts:957-984`, `installAutoupdateDependencies`).
- The same command already holds a separate context from `beginPluginUpdateRun` (`update-flow.ts:1756-1760`).
- `marketplace add` and `bootstrap` call it beside their own install context.

Each new context resets the `once` memos in `createPluginTransportContext`. So a bulk `marketplace update` over N marketplaces can run the SSH probe (network), `ssh -G`, and the config reads up to N+1 times, and different marketplaces' dependency installs can choose different transports in one command. This breaks D-SG-18's "one transport context per command root, each check answers once per command". `ScopeDependencyInstallFn`'s request type (`orchestrators/types.ts`) has no `transportContext` field, so callers have no way to share one.

**Fix:** Add `readonly transportContext?: PluginTransportContext` to the `ScopeDependencyInstallFn` request and use `request.transportContext ?? newTransportContext()` in `createScopeDependencyInstall`. Have `beginPluginUpdateRun` expose its context, or take one from its caller, so `marketplace update` makes one context per command and hands it to both the plugin updates and every `installMissingDependencies` call. Do the same for `marketplace add` and `bootstrap`.

#### WR-B-02: `resolvePluginPin`'s remote-pin path is unreachable in production, yet this phase grew it by about 60 lines

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:1028, 1045-1108`

**Issue:** The four production callers call `resolvePluginPin` only on the pinned arm, which runs only when `source.sha !== undefined`:

- `install-clone-probe.ts:97/113`
- `update-preflight.ts:452` (`source.sha === undefined ? probeUnpinned : probePinned`)
- `info.ts:2558-2559`
- `fetch.ts:461`

So `source.sha ?? (await resolveRemotePin(...))` always takes the left side. `resolveRemotePin`, `askOverPlan`, `MAX_PIN_ATTEMPTS`, `PinAnswer`, and the ref and HEAD arms of `requireRemotePin` run only in tests. The phase still rewrote them to walk the transport plan (OQ-4), and it made `transport` a required parameter of `resolvePluginPin`, so every caller builds a `CloneTransport` for a call that never plans. This is unreachable code, which counts as code quality, not necessity. It grows what has to be maintained and tested, and it suggests a behavior (the pin's `ls-remote` follows the plan) that production never runs.

**Fix:** Narrow `resolvePluginPin` to the pinned contract: take a `source` whose `sha: string` is required, drop the `transport` and `auth` parameters, and delete `resolveRemotePin`, `askOverPlan`, `MAX_PIN_ATTEMPTS`, and `PinAnswer`. Alternatively, if a remote pin resolution is planned, record it as a frozen export with its future consumer, as `.fallowrc.json` expects.

#### WR-B-03: A failed SSH tag listing is not memoized, so every constrained dependency on the same repository tries SSH again

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts:194-211` (with `listCandidateTags`, lines 128-151)

**Issue:** The memo is written only on success, under the URL that succeeded. For a user with no key, the first constrained dependency on `acme/tools` lists `git@github.com:acme/tools.git`, fails, then lists over HTTPS, and that HTTPS listing is memoized. The next constrained dependency in the same run (D-10-18 shares the memo across a bulk run) misses the memo for the SSH URL, runs the failing SSH `ls-remote` again, and only then hits the HTTPS entry. When port 22 is filtered, each SSH attempt can block for the full git timeout (`CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, 120 s by default). An install or bulk update with several constrained dependencies on one repository then stalls for minutes and does network work the memo exists to prevent ("a repository common to several targets would be listed once per run").

**Fix:** When the HTTPS retry succeeds, memoize its tags under the SSH address too, so the next probe skips the failing transport:

```ts
if (retryAt !== undefined) {
  listing = await listAt(retryAt);
  if (listing.kind === "listed") {
    options.tagMemo?.set(listedAt, listing.tags);
  }
}
```

Alternatively, keep a per-run set of SSH URLs that failed and go straight to `retryAt` for them.

### Info

#### IN-B-01: Doc comments describe a "no context" behavior that no longer exists

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:264-267`; `extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts:94-98`; `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:308-313`

**Issue:** These comments describe the absent-context behavior wrongly:

- `PreparePluginUpdateOptions.transportContext` says: "with none, each runs once on the source's wire URL".
- `materializeLatestVersion` says: "A caller with no context clones each source once on its wire URL".
- `InstallLedgerOptions.transportContext` says: "Omitted (enable), a GitHub clone stays on SSH unless the environment forces HTTPS".

In the code, a missing context makes a default one with the full probe (`update-preflight.ts:1198`, `install-clone-probe.ts:70`), and enable now passes its context (`enable-disable.ts:474, 1062`).

**Fix:** Change the three comments to say that a missing context gets a new default context with the full checks, or remove the optionality (IN-B-02).

#### IN-B-02: Impossible-state guard: leaf-level default transport contexts that no production root reaches

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts:68-73`; `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:1195-1200`
**Category:** necessity

**Issue:** Every production root already supplies a context, so the leaf-level fallback guards a state production never reaches:

- `createInstallPlugin` and `createInstallMissingDependency` wrap through `withTransportContext` (`install-flow.ts:60-66`).
- `updatePluginsWith`, `beginPluginUpdateRun`, and `convergePluginWith` each set one (`update-flow.ts:565, 1759, 1033`).
- Reinstall sets one (`reinstall-flow.ts:297, 577`).
- Enable sets one (`enable-disable.ts:2757`).
- Dependency moves forward the caller's (`dependency-bindings.ts:99, 163`).

This answers QD item 1: no production root relies on the preflight default. The fallback also has a cost: if a future root forgets to pass its context, the code silently makes a second context and runs a second probe, which hides exactly the D-SG-18 bug that WR-B-01 describes.

**Fix:** Make `transportContext` required on `InstallCloneProbeOptions` and `PreparePluginUpdateOptions`, so the compiler enforces the threading. Keep the default only at the command-root factories.

#### IN-B-03: The tag probes read the transport force from `process.env`, not from the command's context

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts:202`; `extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts:131`

**Issue:** `createPluginTransportContext` takes `env`, and its `force` getter reads `transportForce(args.env)`. The two tag probes call `transportForce(process.env)` directly, so a command whose context was built from another environment (tests, or a future caller) lists tags under a different force than its clones use. In production both read `process.env`, so the result matches today, but D-SG-20 and D-SG-24 then have two sources of truth.

**Fix:** Pass the command's `PluginTransportContext` (or just its `force`) into `probeDependencyTags` and `probeMarketplaceTags`, and read `context.force`.

#### IN-B-04: The plugin both-failed message always says the retry was over SSH (Windows chain)

**File:** `extensions/pi-claude-marketplace/shared/errors.ts:1456` (outside the 37 files; it reaches rows through `install.messaging.ts:182-188`, `keepsRuntimeCause`)

**Issue:** `gitHubTransportsMessage("plugin", first, last)` always prints "The retry over SSH failed too". On Windows (`windowsPlan`) the chain is SSH, then HTTPS. If the HTTPS attempt fails with a `stopsTheClone` failure, such as an abort, `after` gives nothing, and `bothFailedError` gets the pair `[SSH, HTTPS]`, so the message names the wrong transport for the retry. Off Windows, the last pair is always HTTPS then SSH, so the text is right there.

**Fix:** Build the line from `last.transport` (`The retry over ${TRANSPORT_LABELS[last.transport]} failed too`). Keep upstream's literal wording for the HTTPS-then-SSH pair if parity requires it.

---

_Reviewed: 2026-11-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
