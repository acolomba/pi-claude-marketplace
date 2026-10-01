---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
reviewed: 2026-09-27T05:05:39Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/clone-key.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-clone-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/domain/clone-key.test.ts
  - tests/domain/source.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/integration/marketplace-add-seed-mirrors.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/plugin/clone-cache.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
findings:
  critical: 2
  warning: 6
  info: 3
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-27T05:05:39Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

The core split is sound. `networkCloneUrl` reads `source.raw` on the `url` arm (not the
`.git`-stripped `source.url`), `canonicalCloneUrl` is untouched so no warm clone cold-misses, the
`stripUrlDecorations` -> `stripSlashAndFragment` extraction is byte-for-byte behavior-preserving on
the parse path, all nine orchestrator call sites thread `networkCloneUrl(source)` consistently, and
`ensureGitSuffix` keeps a production consumer (`fallow dead-code --fail-on-issues` exits 0). All six
remapped `contracts.json` pins land on the members they name, and the entry count is 108.
`npm run typecheck`, `npm run lint:type-members`, all four `fallow` gates, and the test files I ran
(`clone-key`, `source`, `clone-cache`, `reinstall-clone-probe`, both `add` suites, the seed-mirrors
integration suite: 272 cases) are green.

Two defects remain in the wire-URL derivation itself. MURL-09 promises the sent URL is the typed URL
"modulo trailing-slash and `#<ref>` decoration stripping", but the `url` arm does not strip a
trailing slash that sits *before* the fragment, and the `git-subdir` arm strips nothing at all. Both
cases previously worked, because `ensureGitSuffix` trimmed trailing slashes on its way to appending
`.git`; both now put a malformed URL on the wire. Neither is covered by D-2-02, which is scoped to
the `.git` suffix only.

The larger quality concern is test honesty in the direction the phase's own risk register named. The
suite proves the raw-vs-url rule at the pure-function level only: not one flow-level fixture uses a
non-github source whose `raw` differs from its `url`, and `info.test.ts` — paired with a changed
production file — admits both the verbatim and the suffixed form of every remote while never
asserting a clone URL by value, so the `info --fetch` arm of this change cannot fail either way.

## Narrative Findings (AI reviewer)

### Critical

#### CR-01: the `url` arm leaves a trailing slash on the wire URL when the slash precedes the `#<ref>` fragment

**File:** `extensions/pi-claude-marketplace/domain/source.ts:414-432` (consumed at `extensions/pi-claude-marketplace/domain/clone-key.ts:101`)

**Issue:** `stripSlashAndFragment` runs the trailing-slash loop *before* the fragment split, and
never re-runs it on the remainder. For `https://host/repo/#v1.0` the loop sees a trailing `0`, does
nothing, then the fragment split leaves `base = "https://host/repo/"`. Verified by executing the
real modules:

```
"https://gitlab.example.com/team/mp/#v1.0" => kind: url | wire: "https://gitlab.example.com/team/mp/"
```

isomorphic-git composes the smart-HTTP request as `` `${url}/info/refs?service=${service}` ``
(`node_modules/isomorphic-git/index.cjs:9457`), so the request becomes
`https://gitlab.example.com/team/mp//info/refs?service=git-upload-pack` — a double-slash path whose
acceptance is host-dependent. Before this phase the same input produced
`ensureGitSuffix("https://.../mp/")` = `https://.../mp.git`, which worked. This is a regression that
D-2-02 does not license (D-2-02 covers only the `.git` suffix) and it directly contradicts MURL-09's
"modulo trailing-slash and `#<ref>` decoration stripping".

The test table at `tests/domain/source.test.ts:940-983` covers `#main/` (slash *after* the fragment)
but has no case for `/#main` (slash *before* it), which is why the gap shipped green.

**Fix:** strip trailing slashes again after the fragment is removed, and add the missing data row.

```ts
export function stripSlashAndFragment(input: string): { base: string; ref: string | undefined } {
  let rest = input;
  let ref: string | undefined;

  const hashIdx = rest.indexOf("#");
  if (hashIdx !== -1) {
    const frag = rest.slice(hashIdx + 1).replace(/\/+$/, "");
    rest = rest.slice(0, hashIdx);
    if (frag.length > 0) {
      ref = frag;
    }
  }

  while (rest.endsWith("/")) {
    rest = rest.slice(0, -1);
  }

  return { base: rest, ref };
}
```

New row for `tests/domain/source.test.ts`:

```ts
{
  name: "trims a trailing slash that precedes the #<ref> fragment",
  input: "https://gitlab.com/o/r/#main",
  expected: { base: "https://gitlab.com/o/r", ref: "main" },
},
```

#### CR-02: the `git-subdir` arm applies no decoration stripping, so a trailing slash or `#<ref>` reaches the remote verbatim

**File:** `extensions/pi-claude-marketplace/domain/clone-key.ts:102-103`

**Issue:** the arm returns `source.url` unchanged. `gitSubdirObjectSource`
(`extensions/pi-claude-marketplace/domain/source.ts:189-197`) stores the manifest `url` field
verbatim — it is the one git-backed kind that is never parse-canonicalized — so whatever decoration
the manifest carries is what goes on the wire. Verified against the real modules:

```
{"source":"git-subdir","url":"https://gitlab.example.com/team/mono/","path":"plugins/p"}
  => wire: "https://gitlab.example.com/team/mono/"
{"source":"git-subdir","url":"https://gitlab.example.com/team/mono#v1","path":"plugins/p"}
  => wire: "https://gitlab.example.com/team/mono#v1"
```

- The trailing-slash case is a regression: `ensureGitSuffix` used to trim it (that trim's stated
  reason, in the pre-change docstring, was *precisely* that a `git-subdir` source stores its url
  un-canonicalized). It now produces the same double-slash request as CR-01.
- The fragment case is worse but pre-existing: `new URL("https://h/mono#v1/info/refs?service=x")`
  resolves to pathname `/mono` with the entire `/info/refs?service=...` swallowed into the hash, so
  the request is not a smart-HTTP request at all. Under the old code it was equally broken
  (`...#v1.git`), so only the trailing-slash half is new — but MURL-09 now promises fragment
  stripping on the wire, and this arm does not deliver it.

Both violate MURL-09 as written. The `url` arm and the `git-subdir` arm also disagree about the same
decoration, which makes the contract impossible to state in one sentence.

**Fix:** route the arm through the same helper as the `url` arm.

```ts
    case "git-subdir":
      return stripSlashAndFragment(source.url).base;
```

Add a `networkCloneUrl` case per decoration in `tests/domain/clone-key.test.ts` (the existing
git-subdir case at line 263 only covers a bare `.git`):

```ts
  test("drops a trailing slash and a #<ref> fragment from a git-subdir url", () => {
    // arrange
    const source = {
      kind: "git-subdir",
      raw: "https://example.com/mono/",
      url: "https://example.com/mono/",
      path: "plugins/p",
    } as const;

    // act
    const cloneUrl = networkCloneUrl(source);

    // assert
    assert.strictEqual(cloneUrl, "https://example.com/mono");
  });
```

### Warnings

#### WR-01: the `info --fetch` arm of this change is unverifiable — its fixture admits both URL forms and never asserts one

**File:** `tests/orchestrators/plugin/info.test.ts:186-195`, `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1633,1646`

**Issue:** `info.ts` is a changed production file (two new `networkUrl: networkCloneUrl(gitSource)`
threads), but `info.test.ts` was not touched by this phase and its allowlist still admits **both**
forms of every non-github remote:

```ts
const ALLOWED_INFO_REMOTES = [
  "https://example.com/monorepo",
  "https://example.com/monorepo.git",
  "https://example.com/repo",
  "https://example.com/repo.git",
  "https://example.com/warmdecl",
  "https://example.com/warmdecl.git",
  ...
```

`grep -n cloneCalls tests/orchestrators/plugin/info.test.ts` shows the suite only ever asserts
`cloneCalls.length === 0` or `cloneCalls.length >= 1` — never a URL by value. So the fixture passes
identically under the old rule and the new one, and the weak `>= 1` form also fails to assert
MURL-09's exactly-one-attempt property on this path. This is precisely the review scope's
"fixture that cannot fail either way".

**Fix:** narrow `ALLOWED_INFO_REMOTES` to the form `networkCloneUrl` actually produces for each
source (drop the three `.git` duplicates for `example.com`, keep the github one), and tighten at
least the two fetch-hook cases to assert the URL and the count by value:

```ts
    assert.equal(gitState.cloneCalls.length, 1);
    assert.equal(gitState.cloneCalls[0]?.url, "https://example.com/repo");
```

#### WR-02: no flow-level test discriminates `source.raw` from `source.url`, so the change's central claim is proven only in the pure unit

**File:** `tests/orchestrators/plugin/install-flow.test.ts:5986-5994`, `tests/orchestrators/plugin/reinstall-flow.test.ts:3279-3285`, `tests/orchestrators/plugin/update-flow.test.ts:95-101`, `tests/orchestrators/plugin/reinstall-clone-probe.test.ts:213-221`

**Issue:** every non-github source in the install / reinstall / update / fetch / reinstall-probe
fixtures has `raw === url` (no `.git`, no `#ref`, no trailing slash) — confirmed by grepping those
files for a `.git`-suffixed non-github source string, which returns only `path.join(..., ".git")`
directory writes. The consequence: swapping `networkCloneUrl(source)` back to
`canonicalCloneUrl(source)` at any of the nine threading sites leaves the entire flow suite green.
The `reinstall-clone-probe.test.ts:216` assertion is the sharpest example — `networkUrl: cloneUrl`
is satisfied by both helpers because the fixture source is
`{ kind: "url", raw: cloneUrl, url: cloneUrl }`.

The phase's own recorded risk was that the suite would assert a contract it does not exercise. It
does not assert the *old* rule by name anywhere (I checked every changed title), but the property
that motivated the whole `source.raw` decision is load-bearing at nine call sites and pinned at one.

**Fix:** give one existing fixture per flow a discriminating source — a manifest entry whose url
carries the suffix the user typed — and assert the wire URL by value. For example, in
`tests/orchestrators/plugin/reinstall-clone-probe.test.ts`:

```ts
    const source: GitBackedSource = {
      kind: "url",
      raw: "https://example.com/cold-mirror.git",
      url: "https://example.com/cold-mirror",
    };
    // ... expect networkUrl: "https://example.com/cold-mirror.git" alongside cloneUrl
```

#### WR-03: forbidden GSD phase reference in a production comment, narrating code that does not exist

**File:** `extensions/pi-claude-marketplace/domain/source.ts:453-454`

**Issue:**

```
 * whatever suffix decision the user's own input made (D-2-01); Phase 3's
 * same-origin comparison normalizes both sides of a URL through this helper.
```

`skills/typescript-comments/SKILL.md` forbids `Phase NN` references to GSD planning steps outright —
this is the only such token in any file this phase touched, and the remaining `Phase 3a` hits in
`update-flow.test.ts` are the transaction's own domain phases (allowed, and pre-existing). The
sentence also describes a consumer that is not in the tree yet, which the same policy rules out in
the other direction ("a comment describes the code as it stands").

**Fix:** delete the clause. The preceding sentence already carries the whole rule and its decision
ID.

```
 * `domain/clone-key.ts::networkCloneUrl` calls this only for the `github`
 * arm, appending `.git` where Claude Code appends it -- a `github.com`
 * `owner/repo` path -- and nowhere else. A `url` source's wire form preserves
 * whatever suffix decision the user's own input made (D-2-01).
```

#### WR-04: the `kind: "url"` object arm reads the identity field as `raw`, silently discarding the typed `.git` the phase set out to preserve

**File:** `extensions/pi-claude-marketplace/domain/source.ts:170-187,232-233`

**Issue:** `parseKindObjectSource`'s `"url"` case delegates to `urlObjectSource`, which reads only
`obj.url` and ignores `obj.raw`. Re-parsing a persisted/serialized `UrlSource` therefore rebuilds
`raw` from the already-`.git`-stripped identity field:

```
{"kind":"url","raw":"https://gitlab.example.com/team/mp.git","url":"https://gitlab.example.com/team/mp"}
  => wire: "https://gitlab.example.com/team/mp"
```

So the D-2-01 promise ("the user's `.git` decision is never silently discarded") holds for the
discriminator form `{"source":"url","url":"...git"}` and for plain strings, but not for the
`kind`-tagged shape. Today's only reachable consumer of that reparse is
`clone-cache.ts::deriveMarketplaceUrl`, which calls `canonicalCloneUrl` and does not care — and
marketplace records take the safe path (`state-io.ts::normalizeStoredSource` reparses from
`obj.raw`). This is a live trap rather than a live bug: the first caller that hands a
`kind`-tagged url source to `networkCloneUrl` loses the suffix with no compile error and no test
failure.

**Fix:** prefer the stored `raw` when present, so the round trip is idempotent.

```ts
function urlObjectSource(obj: Record<string, unknown>): ParsedSource {
  const url = optionalString(obj, "raw") ?? optionalString(obj, "url");
  ...
```

and add a `tests/domain/source.test.ts` case asserting
`parsePluginSource(parsePluginSource("https://h/r.git")).raw === "https://h/r.git"`.

#### WR-05: the D-2-02 add case asserts the test fake's own message as evidence of a product-facing property

**File:** `tests/orchestrators/marketplace/add.test.ts:2970-3002`

**Issue:** the comment promises "the surfaced failure must name the URL that was actually sent so
the remedy is visible without a fallback", and the case then asserts

```ts
          err.message,
          "createGitOpsFake blocked unplanned remote https://gitlab.example.com/team/git-only-mp",
```

That string is produced by `tests/platform/git-ops-fake.ts:141-145`, not by any production error
surface. The URL-was-sent half is already proven one line below by
`state.cloneCalls[0]?.url`; what the comment claims about the *surfaced* failure is not exercised at
all. A test whose stated contract is carried by a fixture literal reads as coverage it does not
provide.

**Fix:** either drop the message assertion and rewrite the comment to claim only the attempt +
URL (what is actually verified), or assert the real user-visible surface — the notification /
thrown error `addMarketplace` produces — and keep the claim.

#### WR-06: the github wire URL is still hand-built in `add.ts`, in parallel with the arm that now owns it

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:777`

**Issue:**

```ts
  const cloneUrl = `https://github.com/${source.owner}/${source.repo}.git`;
```

The clone call two frames down now derives its URL from `networkCloneUrl(source)`, so this literal
is a second, independent construction of the same string, kept only to feed
`hostFromCloneUrl(cloneUrl, "github")`. It is correct today and correctness does not depend on the
suffix (the host is all that is read), but it is the exact drift the phase's single-sourcing was
meant to remove: a future change to the `github` arm will not reach this line, and nothing fails if
the two disagree.

**Fix:** derive it, so there is one builder.

```ts
  const host = hostFromCloneUrl(canonicalCloneUrl(source), "github");
```

(`canonicalCloneUrl` is already the identity form used for host extraction on every other git
path — see `install-clone-probe.ts:56-57`, `fetch.ts:387-388`, `info.ts:1627-1628`.)

### Info

#### IN-01: redundant local alias for a parameter that is already named

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:191-193,277-280`

**Issue:** `const networkUrl = args.networkUrl;` adds an indirection that says nothing the field
name does not. Both sites already carry the D-2-03 comment that justifies the split, so the alias is
pure ceremony.

**Fix:** delete both aliases, keep the comments, and use `args.networkUrl` at the two `gitOps.clone`
calls — or destructure it alongside the other fields.

#### IN-02: tautological purity case in the `networkCloneUrl` suite

**File:** `tests/domain/clone-key.test.ts:280-296`

**Issue:** "returns the identical string for two consecutive calls with the same source" calls a
pure function with no captured state twice and compares the results. No implementation that passes
the other seven cases can fail this one, so it cannot discriminate any behavior —
`skills/typescript-unit-testing/SKILL.md` requires that a wrong implementation makes the assertion
fail.

**Fix:** drop the case. If the intent was MURL-09's no-second-attempt property, that is already
asserted where it can fail: `clone-cache.test.ts` asserts `resolveRemoteRefCalls.length === 1` and
`cloneCalls.length === 1` with the URL by value.

#### IN-03: `CloneOptions.url` docstring overstates "verbatim" for `git-subdir`

**File:** `extensions/pi-claude-marketplace/platform/git.ts:47-51`

**Issue:** "url and git-subdir sources supply the verbatim form the user typed" is inaccurate on
both halves: a `url` source supplies `raw` minus trailing-slash/fragment decorations (not verbatim),
and a `git-subdir` url is a manifest-declared field that no user typed. Once CR-02 lands the
sentence will also be stale.

**Fix:** state the mechanism instead — "github sources are sent suffixed; `url` and `git-subdir`
sources are sent as declared, with trailing slashes and a `#<ref>` fragment stripped. The stored
identity form is `.git`-stripped; the wire form is not."

---

_Reviewed: 2026-09-27T05:05:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
