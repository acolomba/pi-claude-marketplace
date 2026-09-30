---
phase: 01-private-repos-on-any-git-host
plan: 03
subsystem: auth
tags: [git, credential-helper, testing, typescript]

requires:
  - phase: 01-01
    provides: buildAuthForHost returns a GitAuthBundle for every https host, which is the behavior change these 20 assertions contradicted
  - phase: 01-02
    provides: onAuth cancels on a host mismatch, which is why every realigned assertion pins the bound host by value rather than by presence
provides:
  - the plugin surfaces (fetch, install, reinstall, and both clone probes) assert that a source on a host the provider registry does not claim carries a host-keyed bundle
  - the two edge handler suites byte-lock a clone and a fetch that carry a bundle bound to the source's host
  - describeFetch, the update edge suite's reducer from a recorded fetch to its comparable fields
  - SOURCE_HOST, the update edge suite's single binding between its seeded urls and its fetch expectation
affects: [phase 02 .git-suffix url fallback, phase 03 marketplace add leftover-clone adoption]

actuals:
  tokens: 6259
  tasks: 2
  commits: 3
  plan_head_before: 0b4e33e58fcf52156c89f7f51eea0f6bc2978094

tech-stack:
  added: []
  patterns:
    - "A recorded call carrying closures is compared through a reducer that keeps the one field a wrong binding would get wrong, so the whole recorder stays inside one deep-equality expectation."
    - "An expectation and its fixture share one host constant, so the two cannot drift apart."

key-files:
  created: []
  modified:
    - tests/orchestrators/plugin/fetch.test.ts
    - tests/orchestrators/plugin/install-clone-probe.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - tests/edge/handlers/marketplace/add.test.ts
    - tests/edge/handlers/marketplace/update.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
    - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts

key-decisions:
  - "Edge bundle expectation: the REDUCED TOKEN shape, both suites. describeClone and the new describeFetch replace the recorded auth with `{ host }`, and ALPHA_CLONE / fetchOf carry that token, so the host stays inside the byte-locked comparison."
  - "fetch.test.ts::requiredAuth STAYS. It narrows args.auth read off the clone-cache seam, whose parameter type is still `auth?: GitAuthBundle` because plugin/update-preflight.ts::buildBundle returns undefined with no ctx. The narrow is real, not dead."
  - "install.messaging.ts's error-identity sentence was corrected alongside the required constant re-anchor: an empty helper on a no-provider host now yields UserCanceledError, which that docstring attributed only to a failed device flow."

patterns-established:
  - "Reduce-then-compare: a recorded port call whose payload holds closures is reduced to its comparable fields by one named helper, so the suite keeps a single whole-value expectation instead of splitting into per-property probes."

requirements-completed: [GAUTH-03, GAUTH-05]

coverage:
  - id: D1
    description: "Every plugin verb threads a host-keyed bundle for a source on a host the provider registry does not claim, so GAUTH-03 holds on the plugin surface and not only on the marketplace surface"
    requirement: GAUTH-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/fetch.test.ts#materializes a cold pinned URL clone at its recorded SHA"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/fetch.test.ts#refreshes an unpinned warm mirror with its ref and leaves state immutable"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-clone-probe.test.ts#returns a missing-subdir result without exposing the resolved sha"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-clone-probe.test.ts#falls back from an absent unpinned mirror to the recorded sha"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#plugin install authentication: threads a host-keyed bundle for a host the registry does not claim"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-flow.test.ts#plugin reinstall authentication: a host the registry does not claim threads a host-keyed bundle"
        status: pass
    human_judgment: false
  - id: D2
    description: "The edge handler surfaces record the bundle on the clone and fetch calls they byte-lock, so the end-to-end handler path is asserted to carry auth"
    requirement: GAUTH-03
    verification:
      - kind: unit
        ref: "tests/edge/handlers/marketplace/add.test.ts#clones through the injected port into the user scope"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/update.test.ts#updates every recorded marketplace in both scopes when no name is supplied"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/marketplace/update.test.ts#update alpha --scope project runs the real merged-config cascade"
        status: pass
    human_judgment: false
  - id: D3
    description: "A public source on an unregistered host still performs no credential lookup and fires no Device Flow prompt: the bundle is attached but nothing is consulted unless the server challenges (PROV-02's surviving half)"
    requirement: GAUTH-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#plugin install authentication: threads a host-keyed bundle for a host the registry does not claim"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/reinstall-flow.test.ts#plugin reinstall authentication: a host the registry does not claim threads a host-keyed bundle"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/fetch.test.ts#derives partially available and unavailable git rows exactly"
        status: pass
    human_judgment: false
  - id: D4
    description: "github.com and gitlab.com keep their Device Flow path unchanged while the credential-helper path widens to every host (GAUTH-05)"
    requirement: GAUTH-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/fetch.test.ts#materializes a cold unpinned GitHub mirror through Device Flow once per host"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/install-flow.test.ts#plugin install authentication: threads the GitLab provider bundle onto the canonical clone"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "A private marketplace or plugin source on an arbitrary git host is cloneable end to end against a real remote using a credential in the operator's own git credential helper, and the host guard holds against a real caller-side mismatch"
    verification: []
    human_judgment: true
    rationale: "Every case in this phase drives injected fakes and a mocked isomorphic-git transport. No case reaches a real `git credential` subprocess or a real remote, by design (tests run offline with no credentials). This carries forward plan 01's D4 and plan 02's D5 unchanged; it is one human-judgment item, not three."

duration: 41min
completed: 2026-09-26
status: complete
---

# Phase 01 Plan 03: plugin and edge surface realignment — wave 3 Summary

**All 20 deliberately-red cases now assert the positive GAUTH-03 contract — a source on a host the provider registry does not claim carries a bundle bound to that host — and `npm run check` exits 0 at the phase boundary with 7261 tests passing and 100.00 line, branch and function coverage over `extensions/**`.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-09-26T03:58:57Z
- **Completed:** 2026-09-26T04:39:35Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- **All 20 measured failures closed, none weakened.** Every one was an assertion that the extension does NOT reach the credential helper on an unregistered host. Each is now an assertion that it does, pinned to the bound host by value.
- **`npm run check` exits 0.** `CHECK_EXIT=0`, read from its own echoed line. 7261 tests, 7261 pass, 0 fail. `all files | 100.00 | 100.00 | 100.00` with an empty uncovered-lines cell on every row under `extensions/pi-claude-marketplace/` — the only non-empty cell in that column anywhere in the table is the header's own `uncovered lines` label.
- **No presence-only assertion was left behind.** The plugin suites compare `{ credentialOps, host }` against the injected fake and the source's host; the edge suites keep the host inside the byte-locked deep-equality expectation. A bundle bound to the wrong host fails all seven files (T-01-11).
- **PROV-02's surviving half is asserted, not implied.** Both flow cases keep `credentialOps.calls` deep-equal to `{ approve: [], fill: [], reject: [] }`, with a comment saying why that is still true: the git fake never issues a challenge, so attaching a bundle consults nothing.
- **`grep -rn "no auth provider is registered" extensions/ tests/` prints nothing**, and `grep -rn "authless\|threads no auth bundle" tests/orchestrators/plugin/` prints only `clone-cache.test.ts:538`, the one assertion the plan named as legitimately unchanged.

## Task Commits

1. **Task 1: the plugin verbs assert that they carry auth on an unregistered host** — `1c7d6e52` (test)
2. **Deviation (Rule 1): two auth docstrings restated as facts about the current code** — `a5175831` (docs)
3. **Task 2: the handler surfaces record the bundle** — `d5762e0d` (test)

`npm run check` was run once at `d5762e0d`, this plan's final HEAD.

## Files Created/Modified

- `tests/orchestrators/plugin/fetch.test.ts` — seven schedule expectations move from `auth=-` to `auth=example.com`. The schedule string is built as `auth=${call.auth?.host ?? "-"}`, so this is already a by-value host comparison; the file's own passing GitHub case at line 705 (`auth=github.com`) established the idiom.
- `tests/orchestrators/plugin/install-clone-probe.test.ts` — the `assert.strictEqual(options.auth, undefined)` at 174 becomes one whole-value compare of `{ credentialOps, host }` against the hoisted `pluginAuth` and `"example.com"`.
- `tests/orchestrators/plugin/reinstall-clone-probe.test.ts` — the seam destructures the bundle out of the recorded call and records `{ credentialOps, host }` in its place, so the existing single `deepStrictEqual(calls, [...])` still carries the whole call.
- `tests/orchestrators/plugin/install-flow.test.ts` — case renamed to `plugin install authentication: threads a host-keyed bundle for a host the registry does not claim`; both recorders reduced the same way the file's GitHub case already reduces them.
- `tests/orchestrators/plugin/reinstall-flow.test.ts` — case renamed to `plugin reinstall authentication: a host the registry does not claim threads a host-keyed bundle`; `assert.equal(captured.auth, undefined)` becomes the `{ credentialOps, host }` compare.
- `tests/edge/handlers/marketplace/add.test.ts` — new `DescribedCloneCall` type; `describeClone` reduces `auth` to `{ host }`; `ALPHA_CLONE` carries `auth: { host: "gitlab.example.com" }`. All six cases pass through the one construction point, so six failures closed with one edit.
- `tests/edge/handlers/marketplace/update.test.ts` — new `DescribedFetchCall` type, `describeFetch` reducer, and `SOURCE_HOST`; `fetchOf` carries the host token; the four comparison sites map the recorder through `describeFetch`. The module preamble and the `seedMarketplace` docstring both corrected, and the seeded urls re-expressed through `SOURCE_HOST`.
- `tests/orchestrators/marketplace/add.test.ts` — the GAUTH-02 comment stopped contrasting against "the no-provider authless path", which no longer exists.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` — the D-79-03 docstring re-anchored to `NO_STORED_CREDENTIAL_CAUSE`; the branch-4 inline comment likewise; the error-identity sentence corrected (see deviations).
- `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` — `materializePluginClone`'s docstring said a threaded bundle authenticates "a private source on a registered host"; it now says the bundle's own host.
- `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts` — the two-host-cap rationale restated in the present tense (see deviations).

## Decisions Made

**Edge bundle expectation shape: the reduced token, in both suites.**

The plan offered two shapes and preferred the first. I took it. `describeClone` already existed to substitute a stable token for the UUID staging leaf "so the whole recorder stays comparable"; reducing `auth` to `{ host }` is the same move on the same helper, and it keeps the host where a regression in the binding fails a byte-locked comparison rather than a side assertion. The update suite had no reducer, so `describeFetch` is new and mirrors it exactly.

```ts
type DescribedCloneCall = Omit<GitCloneCall, "auth"> & {
  readonly auth?: { readonly host: string };
};
```

The `auth` key stays optional on the reduced type, because `describeClone` also serves recorders that legitimately have no bundle.

**`fetch.test.ts::requiredAuth` stays.** The plan asked for a decision and a reason. It is narrowing a genuinely optional recorded value, not one the type system now proves defined: the seam it reads from is `typeof materializeOrRefreshPluginMirror`, and `orchestrators/plugin/clone-cache.ts` declares `auth?: GitAuthBundle` on both `materializePluginClone` and `materializeOrRefreshPluginMirror`. That optionality is load-bearing — `plugin/update-preflight.ts::buildBundle` still returns `undefined` when it has no `ctx`, which is the same fact that keeps `clone-cache.test.ts:538` legitimately asserting an absent bundle. Deleting `requiredAuth` would mean six `assert.ok(args.auth !== undefined)` narrows inlined at its six call sites. It is not dead, so it stays untouched.

**`SOURCE_HOST` was introduced rather than repeating the host literal.** `fetchOf` now needs the host that `seedMarketplace` puts in the seeded url. Spelling `"gitlab.example.com"` in both places would let the expectation and the fixture drift apart silently; one constant means a fixture change is a compile-visible change to the expectation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `install.messaging.ts` attributed `UserCanceledError` only to a failed device flow**

- **Found during:** Task 1, while making the constant re-anchor the plan asked for
- **Issue:** The same docstring's first paragraph said "A private clone on a no-provider host (or a still-401 after a fresh credential, D-79-02) throws the isomorphic-git `HttpError` with a 401/403 status; an unsuccessful device flow ... makes ... onAuth return `{ cancel: true }`, which isomorphic-git throws as `UserCanceledError` instead." After plan 01 that pairing is inverted for the case it names first: an empty helper on a host with no provider now resolves `{ ok: false }` from `onAuthRequired`, so `onAuth` cancels and the throw is `UserCanceledError`, not an `HttpError`. This is the exact misreading plan 01's own CONTEXT flagged as the phase's known hazard, left standing in a docstring one function above the classifier that depends on it.
- **Fix:** The sentence now pairs `HttpError` 401/403 with a credential the server rejects, and `UserCanceledError` with "no credential can be produced at all — an empty helper on a host the provider registry does not claim (GAUTH-03), or an unsuccessful device flow".
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`
- **Commit:** `1c7d6e52` (with the Task 1 work, same docstring, same edit session)

**2. [Rule 1 — Bug] two docstrings outside the plan's file list still described the retired contract**

- **Found during:** Task 1, sweeping `extensions/` against the plan's must-have "no comment or docstring in `extensions/` still describes the retired `undefined`-for-no-provider contract"
- **Issue:**
  - `orchestrators/plugin/clone-cache.ts:160-163` — "when present the provider's credentials thread into the clone so a private source on a **registered host** authenticates". After GAUTH-03 the bundle authenticates on whatever host it is bound to; "registered" is the retired cap.
  - `platform/git-auth-callbacks.ts:98` — "PROV-04 / T-79-04 **previously capped** that surface at the two hosts in the provider registry, and the compare replaces the cap with the check the cap was standing in for". Wave 2 wrote this to satisfy the CONTEXT's request that the replacement rationale be recorded, but `skills/typescript-comments/SKILL.md` forbids narrating code that no longer exists and directs that such rationale be restated as a present-tense fact.
- **Fix:** `clone-cache.ts` now says "the bundle's own host, whichever host that is (PROV-03/D-79-01, GAUTH-03)". `git-auth-callbacks.ts` now says the compare bounds the disclosure surface "because `buildAuthForHost` returns a bundle for every host and the bound host is therefore the only thing that decides which URL a credential may answer (PROV-04 / T-79-04)". Both IDs kept; no behavior touched.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`, `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts`
- **Commit:** `a5175831` (separate from Task 1 — different files, different cause)

**3. [Rule 1 — Bug] the orchestrator add suite's GAUTH-02 comment contrasted against a dead path**

- **Found during:** Task 2, running the plan's `authless` grep across the whole tree rather than only the two directories it names
- **Issue:** `tests/orchestrators/marketplace/add.test.ts:2882-2883` read "gitlab.com is provider-registered — the clone carries the GitLab auth bundle, not the no-provider authless path." There is no authless path any more, and the comment also uses the `not X but Y` framing the comment skill bans.
- **Fix:** "GAUTH-02: the clone carries a bundle bound to gitlab.com, the host the registry claims for the GitLab provider." The assertions below it are unchanged.
- **Files modified:** `tests/orchestrators/marketplace/add.test.ts`
- **Commit:** `d5762e0d` (with Task 2, same grep sweep)

---

**Total deviations:** 3 auto-fixed, all Rule 1, all comment-accuracy. **None blocking.**
**Impact on plan:** No behavior change and no scope creep. Each one closes a residue of the plan's own must-have truth #4 in a file the plan did not list, found by widening the plan's greps from the two named directories to the whole tree.

## Things the plan did not predict

**1. The plan's `contracts.json` acceptance criterion does not hold as literally worded, and never did.** The criterion is

```
git diff --name-only "$(git merge-base HEAD main)"..HEAD -- … scripts/check-unused-type-members.contracts.json
```

and it prints `scripts/check-unused-type-members.contracts.json`. That file was last touched by `85e0d9ce` ("chore: pin the Pi runtime and make the check pass on macOS (#218)") and `a08c93ba` ("chore: merge releases/v0.19.2 into main (#216)") — both main-side commits that are ancestors of HEAD but not of the merge-base, so this branch's merge-base range includes them. The criterion's stated INTENT is met: nothing in this phase touched the file. `git log --oneline 0b4e33e5..HEAD -- scripts/check-unused-type-members.contracts.json` prints nothing, and `npm run lint:type-members` passed inside the green run with its four pre-existing recorded exceptions unchanged. Same shape as plan 02's finding #1 — a diff criterion pinned to a range wider than the work it means to bound. The other four pinned files (`domain/auth-registry.ts`, `tests/domain/auth-registry.test.ts`, `tests/orchestrators/plugin/info.test.ts`, `tests/orchestrators/plugin/clone-cache.test.ts`) print nothing even over the whole branch.

**2. None of the four `fetch.test.ts` titles promised an absent bundle.** The plan asked me to rename "any of the four `fetch.test.ts` titles that promise an absent bundle". They are `materializes a cold pinned URL clone at its recorded SHA`, `refreshes an unpinned warm mirror with its ref and leaves state immutable`, `continues a manifest-ordered sweep after a network failure`, and `derives partially available and unavailable git rows exactly`. None mentions auth at all — those four cases fail on the `auth=` field of a schedule string they compare for other reasons. Only the two flow cases needed renaming, and both got it.

**3. `edge/handlers/plugin/bootstrap.test.ts` was confirmed and left alone.** It passes untouched, and its `authless` comment is accurate for a different reason than the retired contract: the bootstrap handler builds no bundle at all, so `BOOTSTRAP_CLONE` genuinely records a clone with no `auth`. The plan asked for confirmation before touching it; the answer is no touch.

**4. `prettier` reformatted `update.test.ts` after my edit.** `npm run format:check` exited 1 on that one file; `npx prettier --write` on it fixed the wrapping of the four `describeFetch` comparison lines, and the suite was re-run green afterwards. Included in `d5762e0d`, not a separate commit.

**5. `test:coverage:unit` needed no new test.** The plan warned that a coverage row with a non-empty `uncovered lines` cell would mean a new uncovered branch. There is none: this plan added no production branch, and the reducers it added live in test files, which the coverage gate does not measure. Every `extensions/` row is `100.00 | 100.00 | 100.00`.

## Gate results (real exit codes)

Every exit code below was captured into a variable on its own line, never from `$?` after a compound command and never through a pipe.

| Gate | Command | Exit |
|---|---|---|
| Task 1 verify 1 | `node --test …/plugin/{fetch,install-clone-probe,reinstall-clone-probe,info,clone-cache}.test.ts` | 0 (246 pass, 0 fail) |
| Task 1 verify 2 | `node --test …/plugin/{install-flow,reinstall-flow}.test.ts` | 0 (296 pass, 0 fail) |
| Task 2 verify 1 | `node --test …/edge/handlers/marketplace/{add,update}.test.ts …/edge/handlers/plugin/bootstrap.test.ts` | 0 (34 pass, 0 fail) |
| Typecheck | `npx tsc --noEmit` | 0 (run after each task) |
| Lint | `npm run lint` | 0 (run after each task) |
| Format | `npm run format:check` | 0 (1 before the prettier rewrite of `update.test.ts`, 0 after) |
| fallow | `npm run fallow` | **0** — `FALLOW_EXIT=0` on its own line. It prints `✗ 0 above threshold · maintainability 91.8 (good)` and `✗ 1,327 lines (1.4%) duplicated across 52 files`, the same pre-existing report lines waves 1 and 2 recorded. The glyph is not the verdict. |
| **Whole gate** | `npm run check` | **0** — `CHECK_EXIT=0` |

### What `npm run check` actually ran

All fourteen steps, in order, all green: `typecheck`, `lint`, `lint:workflows`, `lint:workflows:negative`, `fallow`, `format:check`, `test:corresponding`, `test:corresponding:negative`, `test:coverage:direct:negative`, `test:coverage:unit`, `test:integration`, `lint:type-members`, `lint:type-members:negative`.

| Measurement | Value |
|---|---|
| `test:coverage:unit` | 7261 tests, 7261 pass, **0 fail** |
| `all files` coverage row | `100.00 \| 100.00 \| 100.00`, uncovered-lines cell empty |
| `orchestrators/auth-host.ts` | `100.00 \| 100.00 \| 100.00`, empty |
| `orchestrators/marketplace/update.ts` | `100.00 \| 100.00 \| 100.00`, empty |
| `orchestrators/marketplace/add.ts` | `100.00 \| 100.00 \| 100.00`, empty |
| `platform/git-auth-callbacks.ts` | `100.00 \| 100.00 \| 100.00`, empty |
| `orchestrators/plugin/install.messaging.ts` | `100.00 \| 100.00 \| 100.00`, empty |
| `orchestrators/plugin/clone-cache.ts` | `100.00 \| 100.00 \| 100.00`, empty |
| `test:integration` | 36 tests, 36 pass, 0 fail |
| `does not meet threshold` lines | none |

No gate was weakened, no coverage pin was added, no `node:coverage ignore` directive was written, and `scripts/check-unused-type-members.contracts.json` was not touched (T-01-12).

## Failing-test count

**0.** Wave 1 measured 20 across seven files, wave 2 confirmed 20 unchanged, and all 20 are now closed.

| File | Waves 1-2 | Now |
|---|---|---|
| `tests/edge/handlers/marketplace/add.test.ts` | 6 | 0 |
| `tests/edge/handlers/marketplace/update.test.ts` | 6 | 0 |
| `tests/orchestrators/plugin/fetch.test.ts` | 4 | 0 |
| `tests/orchestrators/plugin/install-clone-probe.test.ts` | 1 | 0 |
| `tests/orchestrators/plugin/install-flow.test.ts` | 1 | 0 |
| `tests/orchestrators/plugin/reinstall-clone-probe.test.ts` | 1 | 0 |
| `tests/orchestrators/plugin/reinstall-flow.test.ts` | 1 | 0 |

**No failure outside the measured 20 appeared.** The total test count is 7261, identical to wave 2's — this plan added no case and removed none, so no regression could hide behind a shifted tally.

None of the 20 turned out to be asserting something still correct. Every one was pinned to an absent bundle on a host the provider registry does not claim, which is exactly the state plan 01 removed.

## Known Stubs

None. No placeholder value, empty-literal data source, or TODO/FIXME marker was introduced.

## Threat Flags

None. This plan added no production branch, no network endpoint, no auth path and no schema change. The only production edits are comments.

## User Setup Required

None.

## Next Phase Readiness

- **The phase's gate constraint holds at its final HEAD.** `npm run check` exits 0 at `d5762e0d`, so Phase 2 (`.git`-suffix url fallback) starts from a clean gate rather than inheriting a deliberately red tree.
- **Phase 3 still owns the `PROJECT.md` D-79-03 row.** Its OUTCOME stands — only `update` carries a cause line — but its stated RATIONALE ("no `onAuth` callback registered at all for no-provider hosts") is false after plan 01. `PROJECT.md` was NOT touched here. The now-true reason is recorded in `install.messaging.ts`'s docstring: the plugin failure grammar has no cause-chain trailer slot on the subject row.
- **One human-judgment item carries forward, not three.** Plan 01's D4 and plan 02's D5 are the same shape as this plan's D5: proving the feature against the operator's own `git credential` helper and a real private remote on an arbitrary host, and proving the host-mismatch guard leaks nothing on the wire. They need a human with a credential and should be closed as one runtime UAT, not three.

## Self-Check: PASSED

All eleven modified files exist on disk. All three commit hashes (`1c7d6e52`, `a5175831`, `d5762e0d`) resolve in `git log`. `commits: 3` is the measured `git rev-list --count 0b4e33e58fcf52156c89f7f51eea0f6bc2978094..HEAD`, not a narrated count.

---
*Phase: 01-private-repos-on-any-git-host*
*Completed: 2026-09-26*
