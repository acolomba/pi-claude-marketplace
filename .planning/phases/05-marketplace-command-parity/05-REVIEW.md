---
phase: 05-marketplace-command-parity
reviewed: 2026-10-27T00:00:00Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - eslint.config.js
  - rule-packs/architecture.json
  - extensions/pi-claude-marketplace/domain/name.ts
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/domain/unsupported-components.ts
  - extensions/pi-claude-marketplace/domain/version.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - features/lib/https-git-host/server.ts
  - features/lib/published-marketplace.ts
findings:
  critical: 0
  warning: 5
  info: 7
  total: 12
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-10-27
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Reviewed `git diff 3843c0f1..HEAD` for the 26 scoped files, plus the code they call: the git failure classifiers, `install-outcome.ts` (the D-MF-04 add), `update-flow.ts`, `clone-cache.ts`, and the state schema.

These parts are sound:

- **Redirect policy.** At most 5 redirects are followed. A cross-origin hop must stay on https, so there is no downgrade. The single 10 s `AbortSignal.timeout` also covers reading the body. The 5 MiB cap is checked against the declared Content-Length and against the bytes as they stream in, after decompression.
- **Staging and rename.** Staging goes under `sources-staging/`, then a same-filesystem rename moves it into place. The MA-9 cleanup and the WR-07 cleanup both cover the hosted kind.
- **Refresh.** `refreshHostedCatalog` validates the new catalog before it renames it over the stored file.
- **Repair.** The repair keeps the record's `source`, `plugins`, and `addedFromCwd` (the `...previous` spread comes before the fields the new checkout sets).
- **Reserved names.** The check runs before any state mutation, on every add path.
- **Exhaustive fold.** The `satisfies` table in `applyPartialCascadeFold` really is exhaustive.

No finding is a ship-blocker. Five warnings concern robustness or security hardening:

- An invalid hosted URL escapes as a raw exception.
- A stored `url` record whose path ends in `.json` now makes the whole scope's state fail to load.
- The SSRF host check reads the hostname as text only.
- The NFR-5 lint gate does not cover the new hosted port.
- The standalone add hides the reason for a hosted refusal and prints back credentials that the code meant to mask.

## Warnings

### WR-01: An invalid hosted URL escapes `marketplace add` as a raw TypeError

**File:** `extensions/pi-claude-marketplace/domain/source.ts:411-429`, `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts:215-216`, `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:1231-1237`

**Issue:** `parseHostedManifestForm` accepts any string that starts with `https://`, has a `/` after the authority, and has a path ending in `.json`. It never checks that the string is a valid URL. Inputs such as `https://exa mple.com/m.json`, `https://host:99999/m.json`, and `https://a%zz.com/m.json` all classify as `hosted`, and each makes `new URL(url)` throw `TypeError [ERR_INVALID_URL]`. That call sits *outside* the `try` in `fetchHostedManifest`, so `downloadFailure` never wraps the error.

In `add`, `classifyAddError` then runs `fsErrnoReason("ERR_INVALID_URL")`, which returns undefined, and `classifyGitSourceAccessFailure`, which also returns undefined. The reason is undefined, so standalone mode rethrows (`throw err`) and Pi shows a raw exception instead of a `(failed)` row. On `marketplace update`, the same URL read back from a record gives a failed row with no reason.

**Fix:** Refuse an unparseable URL at classification time, so it reads `{unsupported source}` like every other bad source string. Also type the constructor failure in the fetch:

```ts
// domain/source.ts, parseHostedManifestForm
if (!urlPath.endsWith(".json") || !URL.canParse(raw)) {
  return undefined; // falls through to the url arm / unknown
}
```

```ts
// platform/hosted-manifest-fetch.ts
if (!URL.canParse(url)) {
  throw new HostedManifestFetchError("unreadable", `Marketplace URL is not a valid URL: ${url}`);
}
const start = new URL(url);
```

### WR-02: A stored `url` record whose path ends in `.json` now makes state.json fail to load

**File:** `extensions/pi-claude-marketplace/persistence/state-io.ts:347-355,395-396`, `extensions/pi-claude-marketplace/domain/source.ts:509-515`

**Issue:** The hosted arm now runs before the URL arm in the string funnel. Before this phase, any https URL other than github.com, including one whose path ends in `.json`, was a `url` (git) source (MURL-01). `revalidateStoredUrlSource` re-parses a stored `{kind: "url", raw}` record through the *string* funnel with `parsePluginSource(raw)`. Such a raw now parses as `hosted`, which matches neither the `url` arm nor the `github` arm, so the function throws `invalid url source`.

`loadState` fails closed, so every command in that scope fails until the user edits state.json by hand. The object path (`urlObjectSource` with `gatedUrlField`) still reads the same record as `url`, so the two revalidation paths now disagree. A legacy *string* source ending in `.json` silently becomes `hosted`. After that, `marketplace update` downloads the URL instead of running a git fetch.

The trigger is a git repository URL whose last path segment ends in `.json`. That is rare, but the failure mode is total for the scope, and NFR-3 / upgrade safety calls for a migration path.

**Fix:** Revalidate a stored `url` record through the gate that the object form already uses, so the new hosted arm does not apply to records written before it existed:

```ts
function revalidateStoredUrlSource(mpName: string, raw: string): UrlSource | GitHubSource {
  const parsedSrc = parsePluginSource({ kind: "url", raw, url: raw }); // object arm, gatedUrlField
  ...
}
```

Alternatively, expose a `parseUrlSourceForm`-only entry for this one call. Add a test with a stored `{kind:"url", raw:"https://h/o/catalog.json"}` record.

### WR-03: The SSRF redirect check reads the hostname as text, so a DNS name or an IPv6 alias of a local address passes

**File:** `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts:76-108,146-154`

**Issue:** `isDisallowedHost` classifies the redirect hostname by its text only. The module header says this is because Node's network modules are banned. As a result:

- Any DNS name that resolves to a loopback, link-local, or metadata address passes the check. Examples: a wildcard DNS name such as `169.254.169.254.nip.io`, or an attacker-controlled A record. D-PL5-07 requires refusing these targets, and the check can be defeated by a single DNS record.
- The IPv4-compatible form `[::169.254.169.254]` is serialized by the URL parser as `[::a9fe:a9fe]`. `parseInt("::a9fe:a9fe", 16)` is `NaN`, so the address is allowed.
- NAT64 `[64:ff9b::a9fe:a9fe]` is allowed.

The exploit's impact is limited: it is one GET with no credentials, and the body only reaches the local user. But the check promises a guarantee it does not deliver.

**Fix:** At minimum, reject the IPv6 embeddings: `::/96` (IPv4-compatible) and `64:ff9b::/96`, decoding the low 32 bits through `isLocalIpv4`. Then state the DNS limitation in the module header and in `docs/`. For real enforcement, resolve the name before connecting. That needs `node:dns`, which the `no-network-modules` rule bans, so it is a recorded exception and a decision for the user. Another option is an undici `connect` hook that checks the socket's remote address (`undici` is also banned, so the same decision applies).

### WR-04: The NFR-5 BLOCK F gate does not cover the hosted-catalog port, so a network-free module can download unflagged

**File:** `eslint.config.js:84-111,544-562`

**Issue:** BLOCK F bans importing `platform/hosted-manifest-fetch` and bans the git identifiers `gitOps`, `DEFAULT_GIT_OPS`, and `refreshGitHubClone`. It bans no hosted identifier. `orchestrators/marketplace/hosted-catalog.ts` is in `NETWORK_SEAMS` and exports `DEFAULT_HOSTED_MANIFEST_FETCH`, `downloadHostedCatalog`, and `refreshHostedCatalog`.

Any module that must stay network-free (`list-*`, `info.ts`, `uninstall.ts`, `reconcile/plan.ts`) can import and call `refreshHostedCatalog` or `DEFAULT_HOSTED_MANIFEST_FETCH` from `../marketplace/hosted-catalog.ts`, and lint stays green. Listing the platform module as a seam is therefore not enough. The git seam is protected because its *identifiers* are banned, and the hosted seam has no equivalent.

**Fix:** Add the hosted names to the identifier, literal, and template selectors:

```js
selector:
  ":matches(Identifier, PrivateIdentifier)[name=/^(?:gitOps|DEFAULT_GIT_OPS|refreshGitHubClone|hostedManifestFetch|DEFAULT_HOSTED_MANIFEST_FETCH|refreshHostedCatalog|downloadHostedCatalog)$/]",
```

Alternatively, add a `no-restricted-imports` pattern for `marketplace/hosted-catalog` outside `NETWORK_SEAMS`. Either way, `add.ts`, `update.ts`, and any autoupdate caller that names the port must stay in the seam list.

### WR-05: The standalone add hides why a hosted download was refused and prints back the credentials the fetch masks

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:512-527,1089-1111`, `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts:216-225`

**Issue:** A `HostedManifestFetchError` gets no host frame, is not a `FetchedUrlCause`, and is not a `ReservedMarketplaceNameError`. So `failedAddRow` renders the *bare* header `(failed) {unreadable}` or `(failed) {network unreachable}` with no child row, and the error message is never shown.

The user cannot tell a body over 5 MiB from too many redirects, from a refused cross-origin redirect, or from a URL that contains a user name or password. All four read `{unreadable}`.

Separately, `addSubjectName` falls back to `rawSource` for this error. For `https://user:token@host/m.json`, the row subject, and the JSON `id` in json/rpc mode, which `pi.appendEntry` persists, prints the password in clear text. `fetchHostedManifest` builds a masked URL specifically to avoid exactly that.

**Fix:** Route `HostedManifestFetchError` through the child-row shape that `failedAddRow` already uses for reserved names, so its message becomes the cause line. Redact userinfo from the subject:

```ts
if (hostFrame === undefined && !hasFetchedUrlCause(error)
    && !(unwrapAddError(error) instanceof ReservedMarketplaceNameError)
    && !(unwrapAddError(error) instanceof HostedManifestFetchError)) { ... }
```

In `addSubjectName` (or once in `parseAddableSource`), replace `user:pass@` in an https raw source with `***@` before it becomes a row name. Better still, refuse userinfo for the `hosted` kind in `parseHostedManifestForm`, so it reads `{unsupported source}` with a reason and is never echoed.

## Info

### IN-01: `https:///m.json` classifies as hosted but downloads a different URL

**File:** `extensions/pi-claude-marketplace/domain/source.ts:416-428`

**Issue:** For `https:///m.json`, the authority is empty and the "path" `/m.json` ends in `.json`, so the input classifies as hosted. The WHATWG parser reads it as host `m.json` with path `/`, so the GET goes to `https://m.json/`.

**Fix:** Require a non-empty authority (`pathStart > 0`), or use the `URL.canParse` check from WR-01 and then check `new URL(raw).pathname.endsWith(".json")`.

### IN-02: `errorAddReason` maps EIO, EISDIR, or EBADF from a state or config *write* to `unreadable`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:382-395`

**Issue:** The comment says `permission denied` is dropped "so a refused state or config write keeps its own error". But the new `unreadable` mapping applies to every thrown errno, including an EIO from `tx.save()` or from `writeMarketplaceConfigEntry`. Those now render `{unreadable}`, a manifest-read token, instead of propagating.

**Fix:** Confine the D-PL5-18 mapping to the manifest read, the way `ManifestReadDeniedError` confines `permission denied`. One option is a `ManifestReadFailedError` wrapper in `readManifestDocument` and in the `addPathInGuard` stat.

### IN-03: The hosted ownership marker can be planted by a git repository

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts:35,131-160`

**Issue:** The git marker lives in `.git/`, which no repository can ship. The hosted marker lives at the tree root, which any git repository can ship. A leftover git clone under `sources/<name>/` whose repository contains a matching `.pi-claude-marketplace-hosted.json` is then "recognized" and deleted by a hosted add whose catalog declares `<name>`.

The impact is low: only unrecorded trees in the extension's own `sources/` are affected. But recognition is meant to be the only authority for removal (D-3-02).

**Fix:** Also require that `finalDir` has no `.git/` entry and holds nothing beyond the marker and `.claude-plugin/marketplace.json`, or place the marker in a directory name that a clone cannot produce.

### IN-04: A redirect `Location` with userinfo reads as `network unreachable` / "Could not connect"

**File:** `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts:131-133,191-205`

**Issue:** `fetch(target.href)` throws `TypeError: Request cannot be constructed from a URL that includes credentials` when a server redirects to `https://u:p@...`. `downloadFailure` maps every unclassified error to `network` with "Could not connect to <start url>", which is misleading.

**Fix:** In `sendHop`, refuse a `next` URL that has `username` or `password` as a refused redirect (`unreadable`), before calling fetch.

### IN-05: `market<Tab>` no longer completes to `marketplace`

**File:** `extensions/pi-claude-marketplace/edge/completions/provider.ts:158-195`, `extensions/pi-claude-marketplace/edge/router.ts:105`

**Issue:** `market` is now an exact top-level subcommand. `promoteExactSubcommandToken` therefore promotes the typed `market` to a complete head and offers `market add|remove|...`. Before this change, the same keystrokes completed to `marketplace `. Unlike `ls`/`list`, the alias is a prefix of the full spelling.

**Fix:** Decide deliberately. Either skip the promotion when `current` is also a strict prefix of another top-level subcommand, or record the behavior in D-PL5-11.

### IN-06: A hosted catalog entry with source `./` resolves to the stored tree itself

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts:50-65` (with `domain/plugin-resolver.ts`)

**Issue:** D-PL5 says a relative entry needs no special case because "its directory does not exist under `sources/<name>/`". That does not hold for `"./"`, `"."`, or `"./.claude-plugin"`: the root exists and holds the downloaded catalog and the ownership marker. Such an entry probably resolves as installable with no components, whereas Claude Code refuses a relative entry in a URL-hosted marketplace (E-2).

**Fix:** In the resolver, refuse any relative-path plugin entry whose marketplace record is `hosted`, with an `unsupported source` / not-installable reason, to match upstream.

### IN-07: A repair resets the update baseline, so the next `marketplace update` skips its plugin cascade

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:1567-1580`

**Issue:** A D-PL5-17 repair re-materializes the source at its current HEAD or catalog and overwrites `lastSuccessfulManifest` with that content. The plugins it keeps are still at their old versions. The next `marketplace update` compares against the new baseline, sees no change, and does not run the plugin-update cascade. The convergence planner still reports the drift at load and in `pending`, so the plugins do get updated eventually.

**Fix:** On a repair, keep `previous.lastSuccessfulManifest` (spread `lastSuccessfulManifest` only when `previous` is undefined), or document that a repair defers plugin moves to `apply` / `plugin update`.

---

_Reviewed: 2026-10-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
