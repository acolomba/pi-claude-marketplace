---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
reviewed: 2026-09-27T00:00:00Z
depth: standard
iteration: 2
files_reviewed: 23
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
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-clone-probe.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
findings:
  critical: 2
  warning: 9
  info: 6
  total: 17
status: issues_found
---

# Phase 02: Code Review Report (iteration 2)

**Reviewed:** 2026-09-27
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

Reviewed the current tree at `a361171e` against the diff base `130d68a9`, with the
iteration-1 fix commits `d42f7625..4be1c19a` in scope. Every claim the fixer made about its
own work was re-tested rather than accepted.

**Gates (all green, independently re-run on this tree):** `tsc --noEmit` exit 0 · `eslint`
exit 0 · `npm run fallow` exit 0 (dead-code, circular-deps, re-export-cycles, health, dupes)
· `prettier --check` exit 0 · `npm run lint:type-members` exit 0, `contracts.json` = **108
entries**, all pins resolve to the members they name (the two `add.ts`, one `info.ts` and
three `update-preflight.ts` remaps landed in the phase commits `48493e4e`/`a909adaf`, not in
the fix commits; no further remap is needed).

**Verification of the fixer's claims:**

| Claim | Verdict |
| --- | --- |
| `canonicalCloneUrl` output is byte-identical for all three source kinds | **False end-to-end.** CR-01 changed the parse-time identity for the `<url>/#<ref>` input class. `canonicalCloneUrl` itself is untouched, but its input (`source.url`) moved. |
| WR-02 negative-control verified (revert → assertions fail) | **Confirmed.** Reverting all nine threading sites to `canonicalCloneUrl` fails the new case in install-flow, reinstall-flow, update-flow and reinstall-clone-probe. |
| WR-01 negative-control (info.test.ts) | **Not confirmed.** Both strengthened `info.test.ts` cases stay green under the same revert; see WR-01. |
| WR-04 negative-control (parse path) | **Confirmed** at `tests/domain/source.test.ts:250`. |
| `contracts.json` needed no remap / 108 entries | **Confirmed** (gate passes, 108 entries). |
| WR-04 causes no collateral parse behavior change | **Not confirmed.** It widens an existing unvalidated-scheme hole onto `raw`; see CR-02. |

Two BLOCKERs: an unintended change to the cache-key identity (which D-2-03 explicitly locks),
and an https-only-gate bypass on the object source form that this phase newly routes the wire
URL through. Nine warnings, six info items. The three deferred iteration-1 Info findings all
still stand and are re-reported as IN-01/IN-02/IN-03.

## Narrative Findings (AI reviewer)

All findings below come from direct review of the current source, with the mechanism
reproduced by running the code or the suite. No external reviewer evidence was supplied.

## Critical Issues

### CR-01: the CR-01 fix silently changed the parse-time cache identity, violating D-2-03

**File:** `extensions/pi-claude-marketplace/domain/source.ts:417-439` (and `:446-449`)

**Issue:** Reordering `stripSlashAndFragment` so the `#` split runs first moved the
trailing-slash strip *after* the fragment removal. `stripUrlDecorations` — the **parse-time**
path — now inherits that new order, so `parseUrlSource` / `parseGitHubUrl` produce a different
canonical value for any input of the form `<url>/#<ref>`. `canonicalCloneUrl` is untouched, but
the value it reads (`source.url`) is not, so the end-to-end identity moved. Reproduced by
running the parser at the diff base and at HEAD:

| raw input | base `130d68a9` | HEAD |
| --- | --- | --- |
| `https://gitlab.com/o/r/#main` | `url: https://gitlab.com/o/r/` | `url: https://gitlab.com/o/r` |
| `https://gitlab.com/o/r.git/#main` | `url: https://gitlab.com/o/r.git/` | `url: https://gitlab.com/o/r` |
| `https://github.com/o/r/#main` | `kind: unknown` (rejected) | `kind: github`, `ref: main` |

Consequences:

1. `pluginCloneKey` / `pluginMirrorKey` hash `canonicalCloneUrl(source)`, so every existing
   `plugin-clones/<hash>/` directory for such a source cold-misses and is re-cloned; the old
   directory is orphaned on disk. `domain/clone-key.ts:76-79` is explicit that this is the one
   thing the split exists to prevent, and `02-CONTEXT.md` states "the stored/canonical form
   does not [change] (D-76-01 is untouched)".
2. The github parse surface widened: a browser-shaped `.../o/r/#main` that previously produced
   the `must be https://github.com/<owner>/<repo>[.git][#<ref>]` diagnostic is now accepted.
   Nothing asserts either the old or the new behavior — `grep -n '/#' tests/domain/*.test.ts`
   finds exactly one hit, the direct `stripSlashAndFragment` row at
   `tests/domain/source.test.ts:979`, which pins the helper and not the parser.

**Fix:** keep the new order only on the network-side export and restore the old order for the
parse-time path, so the identity is provably unmoved:

```ts
/** Shared canonicalization tail for https sources. */
function stripUrlDecorations(input: string): { base: string; ref: string | undefined } {
  let rest = input;
  while (rest.endsWith("/")) {
    rest = rest.slice(0, -1);
  }

  const { base, ref } = stripSlashAndFragment(rest);
  return base.endsWith(".git") ? { base: base.slice(0, -".git".length), ref } : { base, ref };
}
```

If the new canonical form is wanted instead, it needs its own decision record, a test that
pins `parsePluginSource("https://gitlab.com/o/r/#main").url` and the github acceptance flip,
and a note that warm clones/mirrors for that input class are re-created once.

### CR-02: object-form `url` sources bypass the https-only scheme gate, and this phase routes the wire URL through the attacker-controllable `raw` field

**File:** `extensions/pi-claude-marketplace/domain/source.ts:170-190` (changed line `:174`),
consumed at `extensions/pi-claude-marketplace/domain/clone-key.ts:100-101`

**Issue:** `urlObjectSource` calls the bare `parseUrlSource(...)` constructor, which performs
no scheme validation. D-76-01's `http://` / `ssh://` / `git@host:` rejection lives only in
`parseUrlSourceForm` (`source.ts:328-343`), on the *string* path. WR-04 changed line 174 to
`optionalString(obj, "raw") ?? optionalString(obj, "url")`, making `raw` — the field whose
interface comment reads "verbatim user input" — the authoritative wire-URL source for the
object form. `PLUGIN_ENTRY_SCHEMA` declares `source: Type.Unknown()`
(`domain/components/plugin.ts`), so a **third-party marketplace manifest** fully controls that
object, including a `raw` key. Reproduced by running the real parser:

```
{ source: "url", raw: "http://evil.example/x", url: "https://gitlab.com/o/r" }
  → kind: "url", canonicalCloneUrl: "http://evil.example/x",
    networkCloneUrl: "http://evil.example/x"      // handed straight to gitOps.clone({ url })

{ kind: "url", raw: "./local/path", url: "https://gitlab.com/o/r" }
  → networkCloneUrl: "./local/path"
    and hostFromCloneUrl (auth-host.ts:80-86) does `new URL("./local/path").host`
    → bare `TypeError: Invalid URL` out of addUrlInGuard / buildCloneAuth, with no diagnostic

{ kind: "url", raw: "https://github.com/o/r/tree/main" }
  → the github funnel returns `unknown` (browser URL), then falls through to
    parseUrlSource(raw) → a clonable UrlSource, so the browser-URL rejection is bypassed
```

The missing scheme gate predates this phase (the `url` field was equally unvalidated), but
the phase does not close it and extends it to a second field while making that field the one
that reaches the network. The `url` field silently becomes a decoy that no longer decides
anything.

**Fix:** funnel the object arm through the same syntactic gate the string arm uses, and reject
rather than construct:

```ts
function urlObjectSource(obj: Record<string, unknown>): ParsedSource {
  const url = optionalString(obj, "raw") ?? optionalString(obj, "url");
  if (url === undefined) {
    return unknownObjectSource(obj, "url source is missing url");
  }

  // D-76-01: the object form is subject to the same https-only gate as the string form.
  const parsed = parseUrlSourceForm(url);
  if (parsed === undefined) {
    return unknownObjectSource(obj, nonRelativeReason(url));
  }

  if (parsed.kind === "unknown") {
    return parsed;
  }

  return withOptionalSourceFields(parsed, obj);
}
```

Add cases for `http://`, `ssh://`, `git@host:`, a relative path, and a `/tree/` browser URL in
the object form.

## Warnings

### WR-01: WR-01's info.test.ts fix still cannot fail — the fixture remains non-discriminating

**File:** `tests/orchestrators/plugin/info.test.ts:5645-5649`, `:5711-5715`, `:186-190`

**Issue:** The commit message for `170943f6` claims the fixture "passed unchanged whether the
clone URL came from `source.raw` or `source.url`" and that narrowing the allowlist plus
asserting by value fixes it. It does not: the fixture URL is `https://example.com/repo`, where
`raw === url`, so `assert.equal(gitState.cloneCalls[0]?.url, "https://example.com/repo")`
holds identically under `networkCloneUrl` and `canonicalCloneUrl`. Proven by negative control
— reverting all nine threading sites to `canonicalCloneUrl` and running
`node --test tests/orchestrators/plugin/info.test.ts` yields 2 failures, and **neither is one
of the two cases the fixer strengthened**:

```
✖ FTCH-03: info --fetch on a COLD pinned git plugin materializes the clone ...
✖ D-78-04 / D-81-04: info --fetch on an INSTALLED git plugin with a missing clone ...
```

Both fail because `ALLOWED_INFO_REMOTES` no longer admits the unsuffixed github form — i.e.
the info suite discriminates the **github** arm only. `info.ts`'s two `url`-arm threading
sites (`:1633`, `:1646`) are unverified.

**Fix:** make the fixture discriminating, exactly as WR-02 did for the flow suites:

```ts
const ALLOWED_INFO_REMOTES = [
  // ...
  "https://example.com/repo",
  "https://example.com/repo.git",
  // ...
] as const;
```

and seed the two `--fetch` cases with a manifest url of `https://example.com/repo.git` while
keeping the by-value assertion on `.../repo.git`.

### WR-02: six of the nine `networkUrl` threading sites are undiscriminated on the `url` arm

**Files:** `orchestrators/marketplace/add.ts:693`,
`orchestrators/plugin/info.ts:1633` and `:1646`,
`orchestrators/plugin/install-clone-probe.ts:63`,
`orchestrators/plugin/fetch.ts:392` and `:404`,
`orchestrators/plugin/update-preflight.ts:181`,
`orchestrators/plugin/clone-cache.ts:559`

**Issue:** WR-02 added one discriminating fixture per flow suite, and every one of them is a
**pinned** source, so they exercise `materializePluginClone` and never
`materializeOrRefreshPluginMirror`. Measured by reverting only `networkCloneUrl`'s `url` arm to
`return source.url;` and running the whole unit suite (`npm test`, 7290 cases) plus the
integration suite:

```
relevant failures (7):
  tests/domain/clone-key.test.ts  "preserves a trailing .git the user typed ..."
  tests/domain/clone-key.test.ts  "keeps a trailing .git suffix and drops a #<ref> ..."
  install-flow    PURL-01/02/09 url-source install (pinned)
  reinstall-flow  cold-cache git-source reinstall (pinned)
  update-flow     PURL-06 / D-78-05 pinned sha-change
  reinstall-clone-probe  falls back from an absent unpinned mirror to the recorded sha
no failures in: marketplace/add.test.ts, edge add.test.ts, info.test.ts, fetch.test.ts,
                clone-cache.test.ts, install-clone-probe.test.ts,
                tests/integration/marketplace-add-seed-mirrors.test.ts (6/6 pass)
```

So the mirror arm everywhere, the marketplace-add seam, `resolvePluginPin`, and both
`fetch.ts` sites rest on the github `.git` append alone. Marketplace add is the most
user-visible path in the phase and no add fixture carries a `.git` url, so D-2-01's
suffix-preservation promise is unproven there.

**Fix:** add (a) one unpinned/mirror case with a `.git`-carrying `url` source so the mirror arm
discriminates, and (b) one `addMarketplace` case with `rawSource:
"https://gitlab.example.com/team/mp.git"` asserting `state.cloneCalls[0].url ===
"https://gitlab.example.com/team/mp.git"`. Change the `resolvePluginPin` url fixture at
`tests/orchestrators/plugin/clone-cache.test.ts:847-851` to `raw: ".../o/r.git", url:
".../o/r"` so the title "sends the url as typed" is actually exercised.

### WR-03: `install-clone-probe.test.ts` asserts nothing about the required `networkUrl` argument

**File:** `tests/orchestrators/plugin/install-clone-probe.test.ts:46-247`

**Issue:** `grep -rn networkUrl tests/` matches only `clone-cache.test.ts`, `fetch.test.ts` and
`reinstall-clone-probe.test.ts`. `install-clone-probe.ts` gained a required `networkUrl`
argument at two seam calls, and its paired test module never mentions it — the seam spy at
`:134` checks `options.cloneUrl` and stops. Every fixture has `raw === url`. Running the suite
with the url arm reverted gives 6/6 pass. The sibling `reinstall-clone-probe.test.ts` does
assert it by value (WR-02 fixed that one), so the asymmetry is unintentional.

**Fix:** mirror `reinstall-clone-probe.test.ts:214` — give the url fixture `raw:
"https://example.com/warm-plugin.git"` and add `networkUrl:
"https://example.com/warm-plugin.git"` to the recorded-call `deepStrictEqual`.

### WR-04: the D-2-02 add case still takes its evidence from the test double's own message

**File:** `tests/orchestrators/marketplace/add.test.ts:2974-2998`

**Issue:** WR-05 replaced an exact-string assertion on `createGitOpsFake blocked unplanned
remote …` with `assert.match(err.message, /https:\/\/gitlab\.example\.com\/team\/git-only-mp/)`.
The string being matched is still produced by the fake, not by any production error surface, so
the case's title — "fails naming the verbatim URL that was sent" — remains unprovable by this
assertion. `skills/typescript-unit-testing/SKILL.md` also directs that errors be asserted by
class and structured fields, not by message text. The `state.cloneCalls[0]?.url` assertion at
`:2997` is the only production-observable evidence and it already carries the case.

**Fix:** drop the `assert.match` (keep `assert.ok(err instanceof Error)` and the `cloneCalls`
assertions), and retitle to what is proven, e.g. `"MURL-09 / D-2-02: an add against a
suffix-only port sends the verbatim URL once and fails"`.

### WR-05: `ensureGitSuffix`'s trailing-slash loop is unreachable from production

**File:** `extensions/pi-claude-marketplace/domain/source.ts:466-474`

**Issue:** After this phase the only caller is `networkCloneUrl`'s github arm
(`clone-key.ts:99`), which passes `canonicalCloneUrl(source)` =
`https://github.com/${owner}/${repo}`. Both halves are validated non-empty and slash-free by
`parseOwnerRepo` (`source.ts:394-406`) and `parseGitHubUrl` (`source.ts:510-517`), so
`rest.endsWith("/")` is never true. The comment that justified the loop — "a `git-subdir`
source stores its manifest `url` verbatim … and is therefore not parse-canonicalized" — was
deleted in this phase, because the git-subdir arm no longer routes through this helper. The
rows at `tests/domain/source.test.ts:943-945` keep coverage green only by calling the export
directly with inputs no caller can produce, which is the "case that cannot fail" pattern the
testing skill rejects.

**Fix:** drop the loop and let the function be the single-purpose suffix appender its docstring
describes:

```ts
export function ensureGitSuffix(url: string): string {
  return url.endsWith(".git") ? url : `${url}.git`;
}
```

and remove the two trailing-slash rows from the test table. If a future same-origin comparison
needs slash normalization, it should call `stripSlashAndFragment` for that.

### WR-06: the clone-seam comment claims the wire url is "the only thing sent to the remote" — false on the mirror refresh

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:277-280` (and
`:191-193`)

**Issue:** `materializeOrRefreshPluginMirror` uses `args.networkUrl` only on the cold-key
clone at `:290`. It then always calls `refreshGitHubClone(mirrorRoot, …)` at `:308`, which
issues `gitOps.fetch({ dir, remote: "origin", … })` (`orchestrators/marketplace/shared.ts:241-246`)
against the URL isomorphic-git recorded in `<mirrorRoot>/.git/config` at first clone.
Because the mirror dir is keyed on the **identity** url, two sources with the same identity but
different suffix decisions share one mirror, and every warm refresh goes to the first writer's
URL. `02-CONTEXT.md` records the same mechanism ("It does not re-derive a URL, so already-added
sources are unaffected by this change"), so the comment contradicts the design it documents.

**Fix:** scope the claim to what the function guarantees, e.g. `"D-2-03: the mirror key hashes
the identity url; the caller-supplied wire url is what a COLD clone sends. A warm refresh
fetches the origin remote recorded at clone time."`

### WR-07: forbidden comment narration in the `ensureGitSuffix` docstring

**File:** `extensions/pi-claude-marketplace/domain/source.ts:462-464`

**Issue:** "a suffix-less URL against a host that serves ONLY the `.git`-suffixed smart-HTTP
path **no longer** resolves." `skills/typescript-comments/SKILL.md` forbids narration of the
shape the code replaced and names `X no longer ...` as a banned form; a comment states a
present-tense fact about the current code. This is the same docstring WR-03 already corrected
for a GSD phase reference, so the violation survived the fix pass.

**Fix:** `"Accepted trade-off (D-2-02): a suffix-less URL does not resolve against a host that
serves ONLY the `.git`-suffixed smart-HTTP path. Verbatim means verbatim in both directions,
and the failure names the URL that was sent."`

### WR-08: WR-06's fix computes a value the callee discards

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:785`

**Issue:** `const host = hostFromCloneUrl(canonicalCloneUrl(source), "github");` —
`hostFromCloneUrl` (`orchestrators/auth-host.ts:80-86`) returns the literal `"github.com"`
whenever `kind === "github"` and never reads its first argument. So the "second hand-built
literal" WR-06 set out to remove was never load-bearing, the replacement is a discarded
computation, and the surrounding comment now reads as if the host were derived from the URL.
No test can observe the change (`tests/orchestrators/marketplace/add.test.ts` is green either
way), which is why it slipped through.

**Fix:** either state the fact directly — `const host = hostFromCloneUrl("", "github");` is
worse, so prefer making the callee honest — or keep the call and add `/* cloneUrl= */` naming
plus a one-line comment that the github arm ignores it. The cleanest form is to let the github
branch of `hostFromCloneUrl` be reached through a parameterless helper, or to pass
`source.kind` and the source itself rather than a URL the function does not read.

### WR-09: a `networkCloneUrl` case title promises a fragment the fixture does not carry

**File:** `tests/domain/clone-key.test.ts:279-293`

**Issue:** `test("drops a trailing slash and a #<ref> fragment from a git-subdir url", …)` uses
`raw`/`url` = `"https://example.com/mono/"`. There is no `#<ref>` fragment anywhere in the
fixture, so half the promised behavior cannot fail. Per the testing skill, "every case must
discriminate the behavior named in its title".

**Fix:** use `url: "https://example.com/mono/#main"` (keeping the expected
`"https://example.com/mono"`), or split the fragment half into its own row.

## Info

### IN-01: redundant local rebinding of `args.networkUrl` (carried from iteration 1, deferred)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:193`, `:280`

**Issue:** `const networkUrl = args.networkUrl;` adds a name with no transformation. Both
functions read every other argument as `args.x` at the point of use.

**Fix:** delete both lines and use `args.networkUrl` at `:208` and `:290`, keeping the D-2-03
comment where it is.

### IN-02: tautological purity case (carried from iteration 1, deferred)

**File:** `tests/domain/clone-key.test.ts:295-311`

**Issue:** "returns the identical string for two consecutive calls with the same source" calls
a pure function twice and compares both results to the same literal. Only a non-deterministic
implementation could fail it, and the title's "identical" is not asserted either (it is
`deepStrictEqual` on an array, not reference identity).

**Fix:** remove the case; the by-value rows above it already pin the output.

### IN-03: `CloneOptions.url` docstring overstates "verbatim" (carried from iteration 1, deferred)

**File:** `extensions/pi-claude-marketplace/platform/git.ts:45-52`

**Issue:** "url and git-subdir sources supply the verbatim form the user typed" — the value is
`stripSlashAndFragment(...).base`, so trailing slashes and a `#<ref>` fragment are removed; and
a git-subdir url comes from a marketplace manifest, not from the user. The next sentence, "The
stored identity form is `.git`-stripped; the wire form is not", is false for a suffix-less
input, where both forms are identical.

**Fix:** "github sources reconstruct `https://github.com/<owner>/<repo>.git`; url and
git-subdir sources supply their input with trailing slashes and a `#<ref>` fragment removed and
any `.git` suffix preserved."

### IN-04: seven `cloneUrl` / `networkUrl` pairs in `fetch.test.ts` now hold the same string

**File:** `tests/orchestrators/plugin/fetch.test.ts:484-485`, `:558-559`, `:1348-1349`,
`:1518-1519`, `:1587-1588`, `:1637-1638`, `:2025-2026`

**Issue:** The two locals existed to name the identity/wire distinction; after the `.git` was
removed from `networkUrl` they are aliases, which reads as if the distinction were gone.

**Fix:** where a case does not care about the distinction, use one local; where it should
(see WR-02), give `networkUrl` a `.git` suffix and add it to `allowedRemoteUrls`.

### IN-05: `networkCloneUrl` is imported from two different modules within one phase

**Files:** `domain/clone-key.ts` direct import in `marketplace/add.ts:53`,
`plugin/install-clone-probe.ts:1`, `plugin/reinstall-clone-probe.ts:1`; the
`plugin/clone-cache.ts:595` re-export in `plugin/fetch.ts:54`, `plugin/info.ts:82`,
`plugin/update-preflight.ts:25`.

**Issue:** The re-export exists to keep pre-existing `canonicalCloneUrl` import sites unbroken;
adding a brand-new symbol to it creates two provenances for the same binding in the same
change.

**Fix:** import `networkCloneUrl` from `domain/clone-key.ts` at all six sites and leave the
re-export carrying only `canonicalCloneUrl`.

### IN-06: the idempotence case asserts one field where the whole value is the promise

**File:** `tests/domain/source.test.ts:655-663`

**Issue:** `assert.strictEqual(reparsedSource.raw, expectedRaw)` pins only `raw`; a regression
that dropped `url` or `ref` on the round trip would pass. The testing skill asks for whole-value
comparison when the value is the contract.

**Fix:**

```ts
const parsedOnce = parsePluginSource("https://example.com/p.git");
assert.deepStrictEqual(parsePluginSource(parsedOnce), parsedOnce);
```

---

_Reviewed: 2026-09-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
