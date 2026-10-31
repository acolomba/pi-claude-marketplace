---
phase: 05-marketplace-command-parity
fixed_at: 2026-10-28T19:05:43Z
review_path: .planning/phases/05-marketplace-command-parity/05-REVIEW.md
iteration: 2
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

## Current iteration: integrated review blockers

**Fixed at:** 2026-10-28T19:05:43Z
**Reviewed baseline:** `59b5058d`
**Iteration:** 2
**Scope:** CR-01 and CR-02 from the integrated Phase 05 review.
Both fixes are committed. A fresh full gate and re-review remain required;
`all_fixed` describes this fix pass and does not declare the phase clean.
REVIEW.md and SECURITY.md were not changed by this pass.

**Where verification ran:** the assigned isolated worktree
`/home/acolomba/src/pi-claude-marketplace-22442f56d78caa3a/pl-reverify-b-258`,
branch `agent-reverify-b`, Node `v26.12.1`. Each fix used the normal commit
hooks, including `npm run check:commit`. No hook was bypassed.

### CR-01: IPv6 embeddings bypass explicit metadata-address refusals

**Commit:** `cd7fdcf5966c412e6dbfb34c9bf8bd5a51daa2ee`
(`fix(marketplace): refuse embedded metadata redirect addresses`)
**Files modified:**
`extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts`,
`test/platform/hosted-manifest-fetch.test.ts`.

**Applied fix:** dotted IPv4 addresses and decoded IPv6 embeddings call the
same complete four-octet predicate. It combines the existing local/private
ranges with the three explicit metadata addresses. Public addresses remain
allowed, including all four supported embedding prefixes. DNS-name handling
and the accepted D-PL5-31 residual are unchanged.

**Red evidence:** the new 15-case matrix ran before the production edit.
All three dotted metadata forms passed their refusal assertions. All twelve
embedded forms failed with `Missing expected rejection`, because the fake
fetch followed the redirect and returned catalog bytes. The matrix covers
`100.100.100.200`, `168.63.129.16`, and `192.0.0.192` under IPv4-compatible,
IPv4-mapped, IPv4-translated, and NAT64 prefixes.

**Green evidence:** `node --test test/platform/hosted-manifest-fetch.test.ts`
passed all 70 tests. `npm run test:coverage:direct --
test/platform/hosted-manifest-fetch.test.ts` exited 0 with 100% direct line,
function, and branch coverage. Fixers, Fallow audit, and normal commit hooks
passed.

**Behavioral-test boundary:** no new metadata-address Cucumber row was added.
The existing redirect fixture writes a real Location header; a red run would
send a request to the real metadata address. The injected-fetch matrix proves
the refusal without violating the suite's hermeticity rule.

**Status:** fixed: requires human verification (address classification logic).

### CR-02: Successful marketplace info exposes credential-bearing names

**Commit:** `3a8c7e1c6b9af4e0f7c1646e67da622829eb525e`
(`fix(notifications): mask successful marketplace info names`)
**Files modified:**
`extensions/pi-claude-marketplace/shared/notification-present.ts`,
`test/shared/notification-present.test.ts`,
`test/shared/notification-json.test.ts`,
`features/marketplace/info.feature`.

**Applied fix:** `redactMarketplaceInfo` masks the stored name on path,
GitHub, and URL messages. It preserves URL masking and all other fields,
including cascade order. The same object is returned only when neither the
name nor URL changes. The plugin-info redactor and its bare/qualified ID
semantics remain intact.

**Red evidence:** seven focused owner cases failed before the production
edit. They cover individual path/GitHub/URL names, unchanged URL identity,
cascade presentation, and real presentation-to-wire conversion. The healthy
marketplace-info scenario also failed, showing the synthetic credential as
the successful result's name. It reuses the stored-name fixture and leaves
the manifest healthy; no new step or fixture support was needed.

**Green evidence:** `node --test test/shared/notification-present.test.ts
test/shared/notification-json.test.ts` passed all 175 tests. Direct coverage
for both pairs exited 0 at 100% line, function, and branch coverage. The
focused Cucumber expression
`^Info hides credentials in a stored marketplace name when its manifest is (healthy|invalid)$`
passed both scenarios and all 15 steps. Fixers, Fallow audit, and normal
commit hooks passed, including typecheck, lint, and `check:features`.

**Status:** fixed: requires human verification (presentation redaction logic).

### Prior dispositions carried forward

The earlier iteration below is retained as historical evidence. The current
review's dispositions take precedence where later work changed the outcome.

| Finding | Current disposition |
| --- | --- |
| WR-01, IN-01 | Resolved by parser and fetch-boundary validation. |
| WR-02 | Resolved; legacy `.json` git sources retain git semantics. |
| WR-03 | Earlier IPv6 range cases resolved; D-PL5-31 accepts the DNS residual. CR-01 closes the separate literal metadata bypass. |
| WR-04 | Resolved by shared network selectors and import/fetch restrictions. |
| WR-05, IN-04 | Resolved by typed failure causes and credential masking. |
| IN-02 | Accepted by D-PL5-18. |
| IN-03 | Resolved by refusing hosted leftovers that contain `.git`. |
| IN-05 | Accepted by D-PL5-11. |
| IN-06 | Resolved on D-PL5-32 surfaces; explicit exceptions remain accepted. |
| IN-07 | Accepted by D-PL5-17; current autoupdate behavior supersedes the old blanket cascade-skipping description. |
| T-05-17 | Failed marketplace-info masking remains covered by `c99c6832`; CR-02 covers successful marketplace-info output. |

## Prior iteration: historical record

**Fixed at:** 2026-10-27
**Source review:** .planning/phases/05-marketplace-command-parity/05-REVIEW.md
**Iteration:** 1

**Summary:**

- Findings in scope: 12 (5 Warning, 7 Info; fix scope `all`)
- Fixed: 8 (WR-01..05, IN-01, IN-03, IN-04)
- Skipped: 4 (IN-02, IN-05, IN-06, IN-07), each a justified "won't fix" below

**Where verification ran:** in the main checkout of the phase worktree
(`features/plugin-lifecycle-p5`). No isolated review-fix worktree was created:
the dispatch asked for all work in the project root, and the commit hook needs
its `node_modules`. Each commit went through the pre-commit hook
(`npm run check:commit`). The final `npm run check` ran in the same checkout
after the last fix commit and exited 0 (934 cucumber scenarios passed, direct
coverage merged for 293 records).

## Fixed Issues

### WR-01: An invalid hosted URL escapes `marketplace add` as a raw TypeError

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`, `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts`, `features/marketplace/unsupported-source.feature`, `test/domain/source.test.ts`, `test/platform/hosted-manifest-fetch.test.ts`
**Commit:** c5053f51
**Applied fix:** `parseHostedManifestForm` returns an `unknown` source (`<raw> is not a valid https URL`) for a `.json` catalog URL that `URL.canParse` refuses, so the add reads `{unsupported source}`. `fetchHostedManifest` refuses an unparseable URL with a `HostedManifestFetchError("unreadable")` before `new URL`. A new example row (`https://127.0.0.1:99999/acme/tools/marketplace.json`) in `unsupported-source.feature` fails without the fix: it was confirmed failing with the classifier change reverted.

### IN-01: `https:///m.json` classifies as hosted but downloads a different URL

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`, `features/marketplace/unsupported-source.feature`, `test/domain/source.test.ts`
**Commit:** 302f9752
**Applied fix:** A catalog URL with an empty authority (`pathStart === 0`) is unknown, with the same reason as WR-01. Unit case plus an example row `https:///acme/tools/marketplace.json`. Not run against the unfixed code, because there that row would make a real DNS request.

### WR-02: A stored `url` record whose path ends in `.json` now makes state.json fail to load

**Files modified:** `extensions/pi-claude-marketplace/persistence/state-io.ts`, `test/persistence/state-io.test.ts`
**Commit:** 62e7b771
**Applied fix:** `revalidateStoredUrlSource` re-parses through the url object form (`parsePluginSource({ kind: "url", url: raw })`), which only reads URL schemes, so the hosted arm never applies to a stored `url` record. A legacy string source that now parses `hosted` is revalidated as a url source too, because string sources predate the hosted kind (extracted to `revalidateStoredStringSource` to stay under the fallow cognitive ceiling). The two new load cases fail without the fix: confirmed.
**Status:** fixed: requires human verification (record revalidation logic)

### WR-03: The SSRF redirect check reads the hostname as text, so a DNS name or an IPv6 alias of a local address passes

**Files modified:** `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts`, `test/platform/hosted-manifest-fetch.test.ts`
**Commit:** e0f9d093
**Applied fix:** `isLocalIpv6` expands the address to 32 hex digits and, for the IPv4-compatible (`::/96`, which holds `::` and `::1`), IPv4-mapped (`::ffff:0:0/96`), IPv4-translated (`::ffff:0:0:0/96`), and NAT64 (`64:ff9b::/96`) ranges, classifies the embedded IPv4 address with `isLocalIpv4`. New refused cases: `[::a9fe:a9fe]`, `[::ffff:0:7f00:1]`, `[64:ff9b::a9fe:a9fe]`, uncompressed `[fe80:1:2:3:4:5:6:7]`. New followed cases: `[::5db8:d822]`, `[64:ff9b::5db8:d822]`, `[2001:db8:1:2:3:4:5:6]`. Without the fix, the two refusal cases the review named fail: confirmed.
**Residual (recorded, not fixed):** a DNS name whose record points at a loopback, link-local, or metadata address (for example `169.254.169.254.nip.io`) still passes. Closing that needs `node:dns` or an undici `connect` hook, and the `no-network-modules` rule pack bans both. That is a user decision about a recorded exception. The module header now says this. There is no `docs/` page for hosted marketplaces yet, so no docs edit was made. The README does not document `marketplace add <https .json URL>` at all, which the D-PL5-25 SUMMARY handoff should cover.
**Status:** fixed: requires human verification (address classification logic)

### WR-04: The NFR-5 BLOCK F gate does not cover the hosted-catalog port

**Files modified:** `eslint.config.js`
**Commit:** b15d0fb0
**Applied fix:** A shared `NETWORK_SEAM_NAMES` alternation drives the identifier, string-literal, and template selectors. It adds `hostedManifestFetch`, `HostedManifestFetch`, `DEFAULT_HOSTED_MANIFEST_FETCH`, `downloadHostedCatalog`, `refreshHostedCatalog`, and `fetchHostedManifest` to the git names. Lint over the real tree stays green (`add.ts`, `update.ts`, and `hosted-catalog.ts` are already in `NETWORK_SEAMS`). A planted `refreshHostedCatalog` import in `orchestrators/marketplace/info.ts` gave 3 errors. It was removed and not committed, per the gate-proof convention. `.planning/codebase/ARCHITECTURE.md` still names only the three git identifiers in its Network boundary paragraph, so a later docs pass should update it.

### WR-05: The standalone add hides why a hosted download was refused and prints back the credentials the fetch masks

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`, `test/orchestrators/marketplace/add.test.ts`, `features/marketplace/hosted-source.feature`
**Commit:** a2a22397
**Applied fix:** `failedAddRow` gives a `HostedManifestFetchError` the child-row shape that a reserved name uses, so the download error becomes the cause line. This covers a body over the cap, too many redirects, a refused redirect, a URL with userinfo, and connection failures. The dropped-connection scenario now asserts the child row and its cause chain (`Could not connect to ..., fetch failed, other side closed`), and it fails without the fix (confirmed). The unit table now pins the full rendered row for every hosted failure.
**Credential half:** this part of the finding was already handled. `resolveRows` redacts every block name and plugin row name (`redactCredentials`, PMOD-04 / D-07), and cause chains are redacted, so the text and JSON strategies already masked `user:pass@` in the subject and JSON id. `test/architecture/no-credential-leak.test.ts` covers "the block name of a failed marketplace add". A new unit test pins the masked subject, child row, and cause for a hosted URL with a password. No source change was needed for this half.

### IN-03: The hosted ownership marker can be planted by a git repository

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts`, `test/orchestrators/marketplace/hosted-catalog.test.ts`
**Commit:** 253e6367
**Applied fix:** `recognizeHostedLeftover` also refuses (as `StaleSourceCloneError`, keeping the tree) a leftover that has a `.git` entry. A download never writes one. New case: a clone that ships a marker for the same URL refuses and keeps its files.

### IN-04: A redirect `Location` with userinfo reads as `network unreachable`

**Files modified:** `extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts`, `test/platform/hosted-manifest-fetch.test.ts`
**Commit:** 5feee79d
**Applied fix:** `sendHop` refuses any redirect target that has a user name or password, same-origin or cross-origin, as `unreadable`. The message masks the userinfo (`Marketplace catalog redirected to a URL with a user name or password and was refused: https://***@...`). The start-URL refusal and this one share `hasUserinfo` and `maskedHref`.

## Skipped Issues

### IN-02: `errorAddReason` maps EIO, EISDIR, or EBADF from a state or config write to `unreadable`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:382-395`
**Reason:** won't fix. Locked decision D-PL5-18 says that "the add's errno mapping matches `list` and `info`: `EISDIR`, `EIO`, and `EBADF` read `unreadable`". That is one shared mapping for the whole add, not one confined to the manifest read. `test/orchestrators/marketplace/add.test.ts` pins this directly: `notifyAddFailure` renders a raw `EIO`/`EBADF`/`EISDIR` error as `(failed) {unreadable}`. Only `permission denied` is confined to the manifest read (MPA-02). Narrowing the mapping would turn a failed state write back into a raw exception in standalone mode, which reverses D-PL5-18. If the user wants a separate write token, D-PL5-18 must be reopened first.
**Original issue:** an EIO from `tx.save()` or the config write renders `{unreadable}`, a manifest-read token, instead of propagating.

### IN-05: `market<Tab>` no longer completes to `marketplace`

**File:** `extensions/pi-claude-marketplace/edge/completions/provider.ts:158-195`
**Reason:** won't fix. `promoteExactSubcommandToken` promotes any exact top-level token to a complete head, and `market` now behaves exactly as the exact token `marketplace` does: `marketplace<Tab>` also offers `marketplace add|remove|...` at once. D-PL5-11 and E-3 make `market` a full alias of `marketplace` for every position. The alias being a prefix of the full spelling does not change that, and completing it to `marketplace` would treat the alias as a typo.
**Original issue:** before the alias existed, `market<Tab>` completed to `marketplace `.

### IN-06: A hosted catalog entry with source `./` resolves to the stored tree itself

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts:50-65` (with `domain/plugin-resolver.ts`)
**Reason:** deferred, out of this fix pass. `ResolveContext` has no marketplace source kind, so the resolver cannot refuse a relative entry of a hosted marketplace without a new context field. That field would be set at every `resolveStrict` construction site: about 14 sites across `install-outcome`, `fetch`, `git-source-probe`, `list-candidate-version`, `update-preflight`, `reconcile/notify`, `mcp-migration`, and `plugin/info`, most of them files other phases of this milestone own (CONTEXT asks that each touch outside the Files line stay one arm). The impact is narrow: only a catalog that names its own root (`./`, `.`, `./.claude-plugin`) gets a plugin with no components instead of Claude Code's install-time refusal (E-2). Proposed backlog entry: "HOSTED-REL-01: refuse a relative-path plugin entry of a hosted marketplace as `unsupported source`, matching Claude Code's `its marketplace entry path does not stay inside the marketplace directory`".
**Original issue:** `"./"` resolves to `sources/<name>/`, which holds the catalog and the marker.

### IN-07: A repair resets the update baseline, so the next `marketplace update` skips its plugin cascade

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:1567-1580`
**Reason:** won't fix without a user decision. Keeping `previous.lastSuccessfulManifest` on a repair was implemented and then reverted. D-PL5-17 says a repair "refreshes the record's manifest metadata", and the test "D-PL5-17: re-adding a github marketplace whose checkout is gone re-clones it and keeps its plugins" asserts that the repaired baseline equals the newly cloned manifest (it seeds a stale `"{}"` baseline on purpose). So the reset is the locked contract, not an accident. The drift is not lost: the convergence planner still reports the kept plugins' catalog moves at load and in `pending`, and `apply` or `plugin update` converges them. Question for the user: should D-PL5-17 keep the old baseline, so that the next `marketplace update` runs the plugin cascade? If yes, the change is one line (`lastSuccessfulManifest: previous?.lastSuccessfulManifest ?? comparisonJson`) plus updating that test.
**Original issue:** the next `marketplace update` compares against the re-downloaded content, sees no change, and skips the plugin cascade.

---

_Fixed: 2026-10-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
