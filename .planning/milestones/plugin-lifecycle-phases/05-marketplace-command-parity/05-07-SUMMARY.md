---
phase: 05-marketplace-command-parity
plan: 07
subsystem: marketplace
tags: [marketplace-add, hosted-catalog, fetch, network-seam, cucumber]
status: complete

requires:
  - phase: 05-marketplace-command-parity
    provides: "05-03 the `hosted` ParsedSource kind; 05-05 the hosted stand-in (`serveFile`, the `hosted` publication); 05-06 the D-PL5-17 repair (`repairableSource`, `previous`)"
provides:
  - "platform/hosted-manifest-fetch.ts: fetchHostedManifest(url), the second sanctioned fetch caller"
  - "shared/errors.ts: HostedManifestHttpError (code HttpError, data.statusCode) and HostedManifestFetchError (failure network | unreadable)"
  - "orchestrators/marketplace/hosted-catalog.ts: HostedManifestFetch port, DEFAULT_HOSTED_MANIFEST_FETCH, downloadHostedCatalog, recognizeHostedLeftover, the `.pi-claude-marketplace-hosted.json` marker"
  - "add.ts: hosted admitted by parseAddableSource; addStagedInGuard, the staging tail the git and hosted adds share; the hosted failure classification; hosted repair"
  - "AddMarketplaceOptions.hostedManifestFetch and the addMarketplaceToState arg of the same name"
  - "features/marketplace/hosted-source.feature (9 scenarios, 11 runs)"
affects: [marketplace add, marketplace update (05-09), apply, import, install-time marketplace add]

# commits counts plan_head_before..plan_head_after: this plan's 3 commits
# plus 2 commits of plan 05-08, which ran in parallel in the same tree
# (e84128c2, d25a949c). The SUMMARY commit is not counted.
actuals:
  tokens: 24200
  tasks: 3
  commits: 5
plan_head_before: 1dc7db3b
plan_head_after: cea65417bca0a103eceb858218e14fbb9a346811

tech-stack:
  added: []
  patterns:
    - "A staged marketplace source kind is a pair of steps (`stage`, `recognize`) passed to one shared tail, `addStagedInGuard`, which owns staging, the manifest read, the leftover rule, the rename, the record, and the MA-9 catch"
    - "A network download module in platform/ is reached only through an orchestrator port with a production default, like GitOps; BLOCK F bans the module outside NETWORK_SEAMS"

key-files:
  created:
    - extensions/pi-claude-marketplace/platform/hosted-manifest-fetch.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts
    - test/platform/hosted-manifest-fetch.test.ts
    - test/orchestrators/marketplace/hosted-catalog.test.ts
    - features/marketplace/hosted-source.feature
  modified:
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - rule-packs/architecture.json
    - eslint.config.js
    - test/orchestrators/marketplace/add.test.ts
    - test/shared/errors.test.ts
    - test/architecture/gate-targets.ts
    - test/architecture/no-credential-leak.test.ts

key-decisions:
  - "The shared placement tail is addStagedInGuard(args with steps: { stage(stagingDir), recognize(finalDir, derivedName) }). gitStagingSteps clones and writes the .git marker; hostedStagingSteps downloads and writes the root marker. The clone's own catch merged into the MA-9 catch, which already cleans staging with the same label"
  - "addMarketplaceToState resolves the gitOps and hosted-fetch defaults before the path branch, so a path add covers both defaults offline"
  - "HostedManifestFetchError is the last member of unwrapAddError's typed list, so the Pitfall-7 prototype-read count of the exotic-throw test stays 6"
  - "The host rule refuses more than the research list: 0.0.0.0/8 and IPv6 unique-local fc00::/7 (which holds fd00:ec2::254) are refused on a cross-origin hop too"

requirements-completed: [MKT-02, MKT-01, MKT-07]

duration: ~75min
completed: 2026-10-27
---

# Phase 5 Plan 07: Hosted marketplace add Summary

`marketplace add https://<host>/<path>/marketplace.json` now downloads that one file with one GET and records the marketplace it declares, stored like a clone under `sources/<name>/`. A failed download reads the add's reasons and leaves nothing behind. Install, `marketplace list`, and `pending` read the stored copy and send no catalog request. A re-add repairs a lost download.

## Commits

| Task | Commit | Title |
| ---- | ------ | ----- |
| 1 | `6a09f1d2` | feat(marketplace): add a marketplace from a hosted catalog URL |
| 2 | `03bde20f` | feat(marketplace): report hosted add failures with the add's reasons |
| 3 | `cea65417` | fix(marketplace): repair a hosted marketplace whose download is gone |

## Accomplishments

- **Fetch seam (D-PL5-07).** `fetchHostedManifest(url)` refuses a URL with userinfo before any request and masks it as `https://***@host/...`. It sends each hop with only `redirect: "manual"` and one `AbortSignal.timeout(10_000)`. It follows at most 5 redirects; a same-origin hop is exempt, and a cross-origin hop must be https and pass Claude Code's host rule, read by hand from `URL.hostname` (metadata names, `localhost` and `*.localhost`, `instance-data.*.compute.internal`, IPv4 0/8, 10/8, 127/8, 169.254/16, 172.16/12, 192.168/16, IPv6 `::`, `::1`, fe80::/10, fc00::/7, and IPv4-mapped forms). A declared or streamed body over 5 MiB is refused and the stream is cancelled. A non-2xx answer throws `HostedManifestHttpError`; a rejected fetch throws `HostedManifestFetchError("network")`, with the timeout message for a `TimeoutError`.
- **Storage (D-PL5-06).** `downloadHostedCatalog` fetches first, then writes `.claude-plugin/marketplace.json` and the marker `{ generatedBy, url }` through `assertPathInside`. `recognizeHostedLeftover` removes a leftover whose marker records the same URL, refuses any other tree as `{stale clone}`, reads an unreadable marker as `permission denied` or `unreadable`, and lets the rename proceed when the destination is gone (IN-06).
- **Add wiring.** `parseAddableSource` admits `hosted`. `addMarketplaceToState` returns `cloneDir` for a hosted source, so install's WR-07 cleanup covers the D-MF-04 add (D-PL5-20). `hostErrorFrame` uses `remoteUrlOf(source)`, which gives the hosted `url`.
- **Failure vocabulary (D-PL5-10).** `HostedManifestFetchError` maps to `network unreachable` or `unreadable`. `HostedManifestHttpError` takes the git host ladder unchanged: 404/410 `source missing`, 401/403 `authentication required`, other statuses `network error` with the `{status} on {url}` frame.
- **Repair and reserved names.** `repairableSource` admits `hosted` (D-PL5-17). A hosted catalog that declares `claude-plugins-official` is refused with the `'anthropics' organization` sentence and leaves nothing (D-PL5-01/02).
- **Gates.** `fetch-chokepoint` admits `platform/hosted-manifest-fetch.ts` and names both callers; `no-network-modules` names it. `NETWORK_SEAMS` gains `orchestrators/marketplace/hosted-catalog.ts` (now 18 files). BLOCK F gains a `platform/hosted-manifest` import ban, and both import-expression selectors match `platform/(?:git|hosted-manifest)`. `CREDENTIAL_LEAK_TARGETS` appends the fetch module last, and a new scan fails on a `headers`, `credentials`, `authorization`, or `cookie` request member.

## Verification

- `node --test` on the six plan test modules (fetch, errors, hosted-catalog, add, no-credential-leak, manifest-read-seam): 478 pass, 0 fail.
- `npm run test:coverage:direct` for `platform/hosted-manifest-fetch.ts`, `shared/errors.ts`, `orchestrators/marketplace/hosted-catalog.ts`, `orchestrators/marketplace/add.ts`: 100%, exit 0.
- `npx cucumber-js features/marketplace/hosted-source.feature features/marketplace/add.feature features/marketplace/url-source.feature features/marketplace/failed-add.feature`: 72 scenarios pass.
- `npm run lint`, `npm run fallow`, `npm run check:features`, `npm run test:unpaired`: exit 0.
- Each commit ran the pre-commit hook (`npm run check:commit`) and passed.
- Credential gate non-vacuity: a scratch `headers: {}` in the fetch init made the new scan fail; reverted, not committed.
- BLOCK F: an `eslint --stdin` run as `orchestrators/marketplace/list.ts` with a static import and an `import()` type of the fetch module reported both errors.
- `npm run test:modules` on the final tree: exit 0. `npx cucumber-js features/marketplace features/plugin/apply.feature features/plugin/git-source.feature`: 471 scenarios pass.
- Acceptance greps: `export class HostedManifestHttpError` 1; `export class HostedManifestFetchError` 1; `DEFAULT_HOSTED_MANIFEST_FETCH` in add.ts 4; `platform/hosted-manifest` in eslint.config.js 5; `platform/hosted-manifest-fetch.ts` in gate-targets.ts 1; `Scenario` in hosted-source.feature 9. Two counts exceed the plan's "returns 1" because the plan's own actions add the extra lines: `platform/hosted-manifest-fetch.ts` in the rule pack is 3 (the exclude plus the two reworded messages step 3 asks for), and `orchestrators/marketplace/hosted-catalog.ts` in eslint.config.js is 2 (the NETWORK_SEAMS entry plus the BLOCK F message that points at the port).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `HostedManifestHttpError.code` reads as an unused class member to fallow**
- **Found during:** Task 1 (`npm run fallow`)
- **Issue:** the git host ladder reads `code` by duck type (`(error as NodeJS.ErrnoException).code`), which fallow cannot trace.
- **Fix:** one `fallow-ignore-next-line unused-class-member` marker with a justification. The repo-wide marker count is now 42.
- **Commit:** `6a09f1d2`

**2. [Rule 3 - Blocking] Claude Code's redirect refusal sentence uses an em dash**
- **Issue:** the `fix-unicode-dashes` pre-commit hook rewrites `—` to `--` in source and tests.
- **Fix:** the message reads `... was refused -- a server-chosen cross-origin redirect ...`. The words are Claude Code's; only the dash differs.

**3. [Rule 1 - Bug] The exotic-throw orchestrated test changed its reason**
- **Found during:** Task 2 direct coverage
- **Issue:** with `HostedManifestFetchError` first in `unwrapAddError`'s list, one more prototype read made the Proxy-backed duplicate read as `unreadable`.
- **Fix:** the check is the last member of the list, so a listed error short-circuits before it. The test and its `prototypeReads === 6` pin are unchanged.

---

**Total deviations:** 3 auto-fixed. No scope creep.

## Uncertain Choices

- **Host rule wider than the research list.** `0.0.0.0/8` and IPv6 `fc00::/7` are refused on a cross-origin hop. The first connects to this machine on Linux; the second is the IPv6 private range, which matches the IPv4 private ranges the rule already refuses. A same-origin hop stays exempt.
- **Userinfo message.** Claude Code's text for a URL with credentials was not available; the message is `Marketplace URL must not contain a user name or password: <url with ***@>`.
- **Marker reads on errno.** ENOENT and ENOTDIR on the marker read `{stale clone}` (no marker); EACCES/EPERM read `permission denied`; any other code reads `unreadable`, matching the git leftover rule's split.
- **Staging label.** A failed hosted download that leaks its staging cleanup reports `marketplace clone staging`, the label the git add uses, because the tail is shared and existing tests pin it.

## Files outside the ROADMAP Files line

- `extensions/pi-claude-marketplace/shared/errors.ts`: the two hosted fetch error classes.
- `extensions/pi-claude-marketplace/orchestrators/marketplace/hosted-catalog.ts` (new): the hosted lifecycle helpers and the port.
- `test/architecture/gate-targets.ts`, `test/architecture/no-credential-leak.test.ts`: the credential gate for the fetch module.
- `features/marketplace/hosted-source.feature` (new).

Note for the codebase map: `NETWORK_SEAMS` grows to 18 files, `fetch-chokepoint` admits two files, and the fallow-ignore marker count is 42.

## Known Stubs

None. Hosted refresh, remove, and info are plan 05-09's scope.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-05-10 (redirect host rule, 5 hops), T-05-11 (5 MiB cap with stream cancel, 10 s timeout), T-05-12 (no headers, userinfo refused and masked, credential gate scan), T-05-13 (staging, manifest validation before the rename, `sourceCloneDir`, `{stale clone}`), T-05-14 (TLS verification untouched; the stand-in is trusted through `NODE_EXTRA_CA_CERTS` only), T-05-15 (rule pack plus BLOCK F), and T-05-16 (reserved-name refusal in the shared tail, unit-tested) are mitigated as planned.

## Self-Check: PASSED

Commits 6a09f1d2, 03bde20f, and cea65417 are ancestors of HEAD. Every created file listed above exists.
