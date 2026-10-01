---
phase: 02-endpoints-that-answer-only-at-the-verbatim-url
fixed_at: 2026-09-27T00:00:00Z
review_path: .planning/workstreams/git-hosts/phases/02-endpoints-that-answer-only-at-the-verbatim-url/02-REVIEW.md
iteration: 3
findings_in_scope: 11
fixed: 11
skipped: 0
deferred: 6
status: all_fixed
check_exit: 0
head: 9e08b48a
branch: features/git-hosts
---

# Phase 02: Code Review Fix Report (iteration 3)

**Fixed at:** 2026-09-27
**Source review:** `02-REVIEW.md` (iteration 2, 2 critical / 9 warning / 6 info)
**Iteration:** 3
**Branch:** `features/git-hosts`, base `980e9681`, head `9e08b48a`

**Summary:**

- Findings in scope (`critical_warning`): 11
- Fixed: 11
- Skipped: 0
- Deferred out of scope (Info): 6

## Verification

`npm run check` was run to completion twice from a clean tree. The number below
is from the final run, started after the last commit with `git status
--porcelain` empty at `9e08b48a`:

```
CHECK_EXIT=0
```

Captured into a named variable, not read through a pipe and not inferred from a
glyph. Supporting counts from the same log (`grep -c '✖'` returned `0`):

| Gate | Result |
|---|---|
| `typecheck` / `lint` / `lint:workflows` | pass |
| `fallow` (dead-code, circular-deps, re-export-cycles, health, dupes) | `✓ No issues found` |
| `format:check` | `All matched files use Prettier code style!` |
| `test:coverage:unit` | `tests 7309 · pass 7309 · fail 0`, 100% lines/branches/functions |
| `test:integration` | `tests 36 · pass 36 · fail 0` |
| `lint:type-members` | `passed with 4 recorded exception(s)`, 108 contract entries |

Per-pair direct coverage for the four production modules whose bodies changed:

```
source.ts             branches 182/182  functions 30/30  lines 668/668
clone-key.ts          branches  10/10   functions  4/4   lines 105/105
auth-host.ts          branches  20/20   functions  7/7   lines 255/255
install-clone-probe   branches  12/12   functions  1/1   lines  89/89
```

**Where verification ran:** the main checkout of this worktree,
`/home/acolomba/src/pi-claude-marketplace-pr-153`, which has `node_modules` and
therefore can run the project's gates. No nested git worktree was created, no
branch was created, renamed, or switched, and `git worktree list` shows no
leftover from this run. The numbers above are reproducible from the tree you are
looking at.

## What this pass did differently

The brief asked for one deliberate restructure rather than a ninth atomic patch.
Before editing, the seam was characterised end-to-end by extracting the pre-phase
parser from `130d68a9` and diffing its output against HEAD over a 23-input table
plus the persisted round trip.

That comparison caught something worth stating up front: **the review's own
suggested CR-01 patch does not restore the pre-phase identity.** Its shape

```ts
let rest = input;
while (rest.endsWith("/")) rest = rest.slice(0, -1);
const { base, ref } = stripSlashAndFragment(rest);
```

still routes through `stripSlashAndFragment`, which strips the path's trailing
slashes after the fragment split. Run directly, it yields
`https://gitlab.com/o/r` for `https://gitlab.com/o/r/#main` — the post-regression
value, not the pre-phase `https://gitlab.com/o/r/`. Applying the suggestion
verbatim would have reported CR-01 as fixed while leaving it open. That is the
concrete reason this pass restructured instead of patching.

## Fixed Issues

### CR-01: the parse-time cache identity moved, violating D-2-03

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`,
`tests/domain/source.test.ts`
**Commit:** `6cc37bd1`

**The separation.** Two private primitives, composed in opposite orders by two
functions neither of which calls the other:

```ts
function stripTrailingSlashes(input: string): string
function splitUrlFragment(input: string): { path: string; ref: string | undefined }

// wire form (D-2-01 / D-2-03) -- fragment first, then the path's slashes
export function stripSlashAndFragment(input) {
  const { path, ref } = splitUrlFragment(input);
  return { base: stripTrailingSlashes(path), ref };
}

// parse-time identity (D-76-01) -- slashes first, then the fragment, then .git
function stripUrlDecorations(input) {
  const { path, ref } = splitUrlFragment(stripTrailingSlashes(input));
  return path.endsWith(".git") ? { base: path.slice(0, -4), ref } : { base: path, ref };
}
```

**Why this shape rather than one parameterised function.** The reviewer's
diagnosis was that the regression happened because one function had two callers
that disagreed about its ordering, and a correction for one silently propagated
to the other. A flag parameter preserves exactly that coupling. Here the
disagreement is reduced to a single visible token — whether
`stripTrailingSlashes` sits inside or outside the `splitUrlFragment` call — and
there is no call edge between the two exports, so no future correction to the
wire form can reach the identity. `stripTrailingSlashes` also absorbs three
copies of the same `while` loop.

Which function owns what, stated plainly: **`stripUrlDecorations` owns the
parse-time identity** (it feeds `parseUrlSource` and `parseGitHubUrl`, hence
`source.url`, hence `canonicalCloneUrl`, hence the `plugin-clones/<hash>` key).
**`stripSlashAndFragment` owns the network-side form** (it feeds
`networkCloneUrl`'s `url` and `git-subdir` arms). They share only two
order-independent primitives.

**Invariant check, not taken on trust.** The pre-phase `source.ts` and
`clone-key.ts` were extracted from `130d68a9` and both parsers run side by side
(`source.ts` has no imports, so this is exact). Over 23 inputs — bare url,
trailing slash, `#ref`, `/#ref`, `.git`, `.git/`, `.git#ref`, `.git/#ref`,
`#ref/`, `/#`, `///`, github in all those forms, `/tree/main`, `o/r`, `o/r@v1`,
`o/r.git`, and three git-subdir objects — the first-parse `canonicalCloneUrl` is
now **byte-identical for every input**, including the restored rejection:

| input | pre-phase `130d68a9` | HEAD `9e08b48a` |
|---|---|---|
| `https://gitlab.com/o/r/#main` | `url = .../o/r/` | `url = .../o/r/` ✓ |
| `https://gitlab.com/o/r.git/#main` | `url = .../o/r.git/` | `url = .../o/r.git/` ✓ |
| `https://github.com/o/r/#main` | `kind = unknown` | `kind = unknown` ✓ |

`tests/domain/source.test.ts` carries that table as `URL_IDENTITY_CASES` (8 rows,
whole-value `deepStrictEqual`), with a docstring stating that each expected value
names a `plugin-clones/` directory. The missing test was why the regression
shipped.

**Negative control:** reordering `stripUrlDecorations` back to the pass-2
composition fails 5 of the 8 rows, including both github rejections. Restored and
confirmed byte-identical with `diff`.

### CR-02: object-form `url` sources bypassed the https-only scheme gate

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`,
`tests/domain/source.test.ts`
**Commit:** `6cc37bd1`

`urlObjectSource` now routes through `parseUrlSourceForm`, the same syntactic
gate the string arm uses, and rejects rather than constructs. `parseGitHubUrl`
and `parseUrlSourceForm` return types were narrowed to
`GitHubSource | UnknownSource` and `GitHubSource | UrlSource | UnknownSource |
undefined`, so the three-branch reject is exhaustive with no unreachable arm (a
`kind !== "url" && kind !== "github"` fallback would have been an uncoverable
branch under the 100%-branch gate).

Verified against the real parser — every reproduction in the review is closed:

| object source | before | after |
|---|---|---|
| `raw: "http://evil.example/x"` | `networkCloneUrl → http://evil.example/x` | `unknown`, reason names `http://` |
| `raw: "ssh://git@evil.example/x"` | clonable | `unknown`, reason names `ssh://` |
| `raw: "git@evil.example:o/r.git"` | clonable | `unknown`, reason names the scp form |
| `raw: "./local/path"` | bare `TypeError: Invalid URL` from `new URL(...).host` | `unknown`, reason names the path |
| `url: "o/r"` | bogus `kind: "url"` | `unknown` |
| `raw: ".../o/r/tree/main"` | browser-URL rejection bypassed | `unknown`, browser-URL diagnostic |

Taken as the whole gate, not only the phase's own `raw` extension: the `url`
field was equally unvalidated before this phase, and the review's shape closes
both. `URL_OBJECT_GATE_CASES` pins all six rejects plus one accepting case.

**Negative control:** restoring the old github-funnel-then-fall-through arm fails
all six reject rows. Restored and confirmed byte-identical with `diff`.

### WR-01: the `info --fetch` fixtures could not fail

**Files modified:** `tests/orchestrators/plugin/info.test.ts`
**Commit:** `33ae4a41`

Both strengthened cases had `raw === url`, so the by-value assertion held under
either derivation. Both manifest sources now carry `.git`, so the identity
(`https://example.com/repo`) and the wire url (`https://example.com/repo.git`)
differ; the assertions pin the wire form. The pinned/installed case covers
`materializePluginClone`; the UNPINNED case covers the mirror arm's cold clone.

**Negative control:** with `networkCloneUrl`'s url arm reverted to `return
source.url;`, exactly these two cases fail, both reporting `actual:
'https://example.com/repo'` vs `expected: '.../repo.git'` — i.e. they fail on the
url arm, not via the allowlist as before.

### WR-02: six of nine threading sites were undiscriminated

**Files modified:** `tests/orchestrators/marketplace/add.test.ts`,
`tests/orchestrators/plugin/clone-cache.test.ts`,
`tests/orchestrators/plugin/fetch.test.ts`,
`tests/orchestrators/plugin/update-preflight.test.ts`
**Commit:** `d90400fc`

- **marketplace add** (`add.ts:693`) had no `.git` fixture at all. A new case adds
  `https://gitlab.example.com/team/suffixed-mp.git` and asserts both halves of
  D-2-01: `cloneCalls[0].url` is the suffixed wire url, and the stored source is
  `{kind, raw: ".../suffixed-mp.git", url: ".../suffixed-mp"}` by whole value.
  Only the suffixed remote is allowlisted, so the fake refuses the identity url
  as well.
- **`resolvePluginPin`** (`clone-cache.ts:559`): the url fixture becomes `raw:
  ".../o/r.git"` against `url: ".../o/r"`, so the case's own title is exercised.
- **`fetch.ts:404`**: the cold pinned url case takes a `.git` manifest url.
- **`fetch.ts:392`**: no case reached the url arm's cold mirror clone at all — the
  only cold mirror case was a github source. A new cold UNPINNED url mirror case
  asserts the whole `git.schedule` (clone at the `.git` url, then the refresh
  sequence) and the mirror tree under `pluginMirrorKey(identity)`.
- **`update-preflight.ts:181`**: a new case records the mirror seam's `cloneUrl`
  and `networkUrl` pair by value on `probeUnpinned`.

### WR-03: `install-clone-probe.test.ts` asserted nothing about `networkUrl`

**Files modified:** `tests/orchestrators/plugin/install-clone-probe.test.ts`
**Commit:** `d90400fc`

Two new cases, one per call site (`:63` mirror, `:82` pinned), record the full
seam options with `deepStrictEqual` including `networkUrl`, mirroring the sibling
`reinstall-clone-probe.test.ts:214`.

**Negative control for WR-02 + WR-03 together** — url arm reverted to `return
source.url;`, failures per suite (previously **zero** in six of these seven):

| suite | before this pass | after |
|---|---|---|
| `marketplace/add.test.ts` | 0 | **1** |
| `plugin/info.test.ts` | 2 (via the github allowlist) | **2** (via the url arm) |
| `plugin/fetch.test.ts` | 0 | **2** |
| `plugin/install-clone-probe.test.ts` | 0 | **2** |
| `plugin/update-preflight.test.ts` | 0 | **1** |
| `plugin/clone-cache.test.ts` | 0 | **1** |
| `domain/clone-key.test.ts` | 2 | **2** |

Restored and confirmed byte-identical with `diff`.

### WR-04: the D-2-02 add case took its evidence from the test double

**Files modified:** `tests/orchestrators/marketplace/add.test.ts`
**Commit:** `5caa7a3e`

Dropped the `assert.match` on `createGitOpsFake`'s own message; kept `assert.ok(err
instanceof Error)` and the two production-observable assertions. Retitled to
`"MURL-09 / D-2-02: an add against a suffix-only port sends the verbatim URL once
and fails"`, and rewrote the preamble comment so it no longer claims something the
case cannot observe.

### WR-05: `ensureGitSuffix`'s trailing-slash loop was unreachable

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`,
`tests/domain/source.test.ts`
**Commit:** `6cc37bd1`

```ts
export function ensureGitSuffix(url: string): string {
  return url.endsWith(".git") ? url : `${url}.git`;
}
```

The three test rows that kept the loop green with inputs no caller can produce
are gone; the two survivors are values the github arm actually produces. The
`.fallowrc.json` `production.deadCode: true` constraint holds:
`networkCloneUrl`'s github arm is still the live consumer (`grep` confirms one
import and one call), and `fallow dead-code --fail-on-issues` exits 0.

### WR-06: a false claim in the mirror clone-seam comment

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts`
**Commit:** `d90400fc`

`materializeOrRefreshPluginMirror`'s comment now says the wire url is what a COLD
clone sends, and names the consequence: the refresh fetches the `origin` remote
recorded at that first clone, so two sources sharing one identity share the first
writer's wire url on every warm refresh. `materializePluginClone`'s sibling
comment was deliberately left alone — its `checkoutPinWithRefetch` fetch targets
the `origin` that same call just wrote from `networkUrl`, so the claim is true
there.

### WR-07: forbidden narration in the `ensureGitSuffix` docstring

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`
**Commit:** `6cc37bd1`

`"... no longer resolves"` became a present-tense statement of the D-2-02
trade-off. A scan of all 26 files this phase touched for `no longer`, `used to`,
`the former`, `Pre-fix`, `Phase N`, `Plan N`, `Wave N`, `Pitfall N` and
`milestone vX.Y` found no remaining violation: the surviving `no longer` hits are
the domain reason token `"no longer installable"` and present-tense statements
about a manifest's current contents, which the policy preserves as domain
language.

### WR-08: the WR-06 fix computed a value the callee discarded

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`,
`extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts`
**Commit:** `d90400fc`

Made the callee honest rather than keeping the discarded computation: the
`github.com` literal is now the named export `GITHUB_HOST`, `hostFromCloneUrl`'s
github arm returns it, and `add.ts`'s one statically-`github` call site reads it
directly. One literal, one name, two readers — the duplicate-literal concern that
motivated pass 2's change is still addressed, without pretending the host is
derived from a url. The orphaned `canonicalCloneUrl` import was removed (ESLint
and `tsc` both flagged it).

### WR-09: a case title promised a fragment its fixture lacked

**Files modified:** `tests/domain/clone-key.test.ts`
**Commit:** `d90400fc`

The git-subdir fixture becomes `https://example.com/mono/#main` with `ref:
"main"`, so both halves of `"drops a trailing slash and a #<ref> fragment"` can
fail.

### Fallout fixed in the same pass

**`scripts/check-unused-type-members.contracts.json`** — commit `aec01604`. The
WR-08 import change turned one import line into a five-name block, shifting
`addMarketplace`'s overload from line 540 to 545. The pins are `line:col`, so the
gate exited 2 with `names no declaration in this program` and
`tests/architecture/unused-type-member-gate.test.ts` failed on empty stdout from
the real gate — the recorded signature for this class of breakage. All four
references (two `id`s and their two `refines` anchors) were shifted by LINE only;
the columns were verified unchanged. Still 108 entries and the same 4 recorded
exceptions. `prettier --check` on the file passes.

## One residual, stated plainly

The phase's `raw ?? url` preference in `urlObjectSource` (pass 2's WR-04 fix,
which the review's CR-02 shape keeps, and which D-2-03's `url` arm requires)
changes the **reload** identity for exactly one input shape. Commit `9e08b48a`
pins it rather than leaving it unpinned.

| persisted source | pre-phase reload identity | HEAD reload identity |
|---|---|---|
| `{raw: ".../o/r/#main", url: ".../o/r/"}` | `.../o/r` | `.../o/r/` |
| `{raw: ".../o/r.git/#main", url: ".../o/r.git/"}` | `.../o/r` | `.../o/r.git/` |

Three things make this different from CR-01, and worth a human glance rather than
a silent pass:

1. It is confined to a url whose path carries a trailing slash **immediately
   before** a `#<ref>` fragment. Every other input — including every `.git` form,
   every plain `#ref` form, and every github and git-subdir form — reloads to a
   byte-identical identity.
2. Pre-phase behaviour for this shape was already self-inconsistent: the **add**
   computed `.../o/r/` from the string while every later **reload** computed
   `.../o/r`, so those two disagreed about which `plugin-clones/` directory to
   use. HEAD makes them agree (on the add's value). The round trip is now a fixed
   point.
3. `raw` must be preferred at reload or the phase's own fix regresses: a source
   the user typed with `.git` would go back out suffix-less after a restart.

Closing this residual instead would need two scheme gates and a conditional
field override in one function — more surface in the seam that has now produced
two consecutive Criticals, and CR-02's lesson is that an ungated field reaching
the wire is the expensive mistake. If the operator would rather have
byte-identity on the reload path too, that is a decision record plus a
`urlObjectSource` that parses `url` for the identity and separately gates `raw`
for the wire.

## Deferred (out of scope — `fix_scope` is `critical_warning`)

All six Info findings are untouched and still stand:

- **IN-01** — redundant `const networkUrl = args.networkUrl;` rebinding at
  `clone-cache.ts:193`/`:280`. Both lines were kept; the D-2-03 comment above
  each one was the thing WR-06 needed changed.
- **IN-02** — tautological purity case at `clone-key.test.ts` ("returns the
  identical string for two consecutive calls").
- **IN-03** — `CloneOptions.url` docstring overstates "verbatim" (`git.ts:45-52`).
- **IN-04** — seven `cloneUrl`/`networkUrl` pairs in `fetch.test.ts` hold the same
  string. Two of the seven now differ as a side effect of the WR-02 fix; the
  other five are unaddressed.
- **IN-05** — `networkCloneUrl` imported from two modules (direct import vs the
  `clone-cache.ts` re-export).
- **IN-06** — the idempotence case at `source.test.ts` asserts only `raw`. The two
  new reload-identity rows next to it do use whole-value comparison, but the
  original case is unchanged.

---

_Fixed: 2026-09-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_

## Operator-requested residual closure: the reload identity

**Requested:** the residual in § "One residual, stated plainly" was put to the
operator as accept / fix / defer, with the note that it sits in the seam that had
already produced two consecutive rounds of Criticals. The operator chose **fix it
now**. This section is that closure, run after iteration 3.

**Commit:** `3546a28c` — `fix(02): derive the reload identity from url and gate raw for the wire`
**Files:** `extensions/pi-claude-marketplace/domain/source.ts`, `tests/domain/source.test.ts`
**Branch:** `features/git-hosts`, base `63951a58`, head `3546a28c`. No branch was
created, renamed, or switched; no git worktree was created (`git worktree list`
shows only the pre-existing sibling worktrees). Both paths were staged
explicitly.

### The separation

`urlObjectSource` read `optionalString(obj, "raw") ?? optionalString(obj, "url")`
and fed the winner to `parseUrlSourceForm`, so a single string decided both the
identity and the wire form. The two are now taken from the field whose consumer
needs them:

```ts
function urlObjectSource(obj: Record<string, unknown>): ParsedSource {
  const url = optionalString(obj, "url");            // identity: canonicalCloneUrl
  if (url === undefined) {
    return unknownObjectSource(obj, "url source is missing url");
  }

  const identity = gatedUrlField(obj, url);
  if (identity.kind === "unknown") {
    return identity;
  }

  const raw = optionalString(obj, "raw");            // wire: networkCloneUrl
  if (identity.kind !== "url" || raw === undefined) {
    return withOptionalSourceFields(identity, obj);
  }

  const gatedRaw = gatedUrlField(obj, raw);
  if (gatedRaw.kind === "unknown") {
    return gatedRaw;
  }

  return withOptionalSourceFields({ ...identity, raw }, obj);
}
```

`gatedUrlField` is the extracted https-only syntactic gate — one function, called
once per manifest-controlled field. `withOptionalSourceFields` was checked first
and does nothing with `raw` (it spreads only `ref` and `sha`), so the verbatim
carry-over is the one-token `{ ...identity, raw }` spread and not a second
mechanism.

Two points the brief asked to be confirmed against the code rather than assumed:

1. `networkCloneUrl`'s `url` arm does read `source.raw` (`clone-key.ts:100-101`),
   so `raw` does not have to be the input to the identity derivation — it only
   has to be present and verbatim on the parsed source. Confirmed.
2. The `github` arm derives its wire url from `owner`/`repo` and never reads
   `raw`, so a manifest `raw` on a github-normalized url object is dropped rather
   than gated-and-kept. That is what keeps the github identity byte-identical to
   pre-phase for a stored `{kind:"url", url:"https://github.com/o/r/", ...}`,
   whose `raw` the strict github arm would otherwise reject. Pinned by a case.

The comment at the old lines 171-173 justified the `raw`-first preference; it is
gone with the preference. The replacement names which field feeds which consumer,
in the present tense, and keeps the D-76-01 / D-76-02 / D-2-01 / D-2-03 anchors.

### Before / after, reload path

Measured by importing the parser extracted from `130d68a9` (`source.ts` has no
imports, `clone-key.ts` at that revision imports only `createHash` and types, so
the side-by-side is exact) alongside the working-tree parser, and reading
`canonicalCloneUrl` on both:

| stored object (`raw` / `url`) | pre-phase `130d68a9` | iteration 3 `63951a58` | now `3546a28c` | wire form now |
|---|---|---|---|---|
| `.../o/r/#main` / `.../o/r/` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r/` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r` |
| `.../o/r.git/#main` / `.../o/r.git/` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r.git/` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r.git` |
| `.../o/r#main` / `.../o/r` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r` |
| `.../o/r/#` / `.../o/r/` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r/` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r` |
| `.../o/r.git` / `.../o/r` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r` | `https://gitlab.com/o/r.git` |

The identity column now matches `130d68a9` on every row, and the `.git` the user
typed still reaches the wire.

### The seven gates

**1. Object-form (reload) identity byte-identical to `130d68a9` — proved.** Both
parsers run side by side over 26 object inputs: persisted `{kind, raw, url}`
records in every slash / `.git` / fragment combination, the same records with a
`ref` and a 40-hex `sha`, the manifest `{source:"url", ...}` discriminator form,
the github and git-subdir kinds, and the five CR-02 attack strings in each of the
two fields. Verdict over the 54 accepted inputs (strings plus objects):

```
ACCEPTED_ROWS=54
ACCEPTED_IDENTITY_MOVES=0
ACCEPTED_NON_RAW_FIELD_MOVES=0
DELIBERATE_CR02_REJECTS=13
```

The second number is the gate: zero accepted inputs whose `canonicalCloneUrl`
moved. The third is stronger than the gate asked for — for every accepted input,
*every* field of the parsed source except `raw` is byte-identical to pre-phase,
so nothing else moved under cover of the fix. The 13 differences that remain are
all inputs the pre-phase parser accepted and CR-02 now rejects (an object-form
`http://`, `ssh://`, `git@host:`, relative path, browser URL or `owner/repo`
shorthand in either field). Each was listed individually and read; none is a
persisted-source shape.

**2. String-form (first-parse) identity byte-identical to `130d68a9` — proved,
unregressed.** The same harness over 28 string inputs: 0 identity moves and 0
parsed-value differences of any kind, including the three github rejections
CR-01 restored. `URL_IDENTITY_CASES` still pins all 8 of its rows.

**3. The wire form keeps the phase's fix — proved.** For each of ten typed
strings the first parse was serialized, re-parsed as an object, and
`networkCloneUrl` read on both. Every `.git` the input carried survives on the
wire at both the first parse and the reload (`.../o/r.git#main` → `.../o/r.git`;
`.../o/r.git/#main` → `.../o/r.git`), trailing slashes and `#<ref>` are stripped
in both orderings, and the wire url is identical first-parse vs reload on all ten
— including the two rows where the identity is not (see the caveat below).

**4. CR-02's scheme gate still rejects, in the object form, through both fields —
proved.** `URL_OBJECT_GATE_CASES` now lists each rejected form twice, once with
the attack in `url` and once with it in `raw` behind a benign `url`: `http://`,
`ssh://`, `git@host:`, a relative path, a `/tree/` github browser URL, and an
`owner/repo` shorthand. Twelve reject rows, whole-value `deepStrictEqual`,
including the exact diagnostic string. This was the brief's specific warning and
it is why `gatedUrlField` is called twice rather than once: with the identity
gate alone, `{source:"url", raw:"http://evil.example/x", url:"https://gitlab.com/o/r"}`
parses clean and `networkCloneUrl` hands `http://evil.example/x` to `gitOps`.
The one field that is not gated is a github object url's `raw`, and it is not
gated because it is discarded — a case pins that
`{source:"url", url:"https://github.com/o/r", raw:"http://evil.example/x"}`
yields `{kind:"github", raw:"https://github.com/o/r", owner:"o", repo:"r"}`, so
the hostile string does not survive onto the source at all.

**5. `canonicalCloneUrl` unchanged for github and git-subdir — proved.** Covered
by the gate-1 harness: `{kind:"github", raw:"o/r"}` with and without a ref,
`{source:"github", repo:"o/r"}`, `{kind:"git-subdir", ...}` and
`{source:"git-subdir", url:".../mono/#main", path:"pkg"}` all return the same
identity as pre-phase, and their whole parsed values are byte-identical.
`clone-key.ts` was not touched by this commit.

**6. The committed invariant test now covers the object/reload path — done.**
`URL_RELOAD_IDENTITY_CASES` sits beside `URL_IDENTITY_CASES` in the same
`parsePluginSource` loop, five rows, each asserting the whole parsed source by
value, with a docstring stating that each expected `url` names a
`plugin-clones/<hash>` directory. The two ad-hoc reload tests added by `9e08b48a`
are replaced by the table (their comment argued for the `raw`-first preference,
so it could not survive the preference).

**Negative control:** restoring `const url = optionalString(obj, "raw") ?? optionalString(obj, "url");`
and changing nothing else fails 5 of 132 cases —
the four discriminating reload rows plus the github-raw-drop row:

```
✖ re-strips a path slash that precedes a #<ref> fragment from a reloaded url identity
✖ re-strips a path slash that precedes an empty #fragment from a reloaded url identity
✖ re-strips a .git suffix behind a path slash from a reloaded url identity
✖ reloads a url source whose identity is already stripped to a fixed point
✖ drops the raw field of a github object url, whose wire form never reads it
ℹ tests 132 · pass 127 · fail 5
```

Restored from a pre-control copy and confirmed byte-identical with `diff`.

**7. `npm run check` — CHECK_EXIT=0.** Run to completion from the committed tree
at `3546a28c` with `git status --porcelain` empty, exit code captured into a
named variable and written into the log, not read through a pipe and not
inferred from a glyph. Two `✗` lines accompany that zero and are not failures:
`✗ 0 above threshold · 15158 analyzed · maintainability 91.8 (good)` from `fallow
health` and `✗ 1,327 lines (1.4%) duplicated across 52 files` from `fallow
dupes`, both of which exit 0 under `--fail-on-issues`.

```
CHECK_EXIT=0
```

| Gate | Result |
|---|---|
| `typecheck` / `lint` / `lint:workflows` (+ negative) | pass |
| `fallow` (dead-code, circular-deps, re-export-cycles, health, dupes) | `✓ No issues found` |
| `format:check` | `All matched files use Prettier code style!` |
| `test:coverage:unit` | `tests 7319 · pass 7319 · fail 0`, 100% lines/branches/functions |
| `test:integration` | `tests 36 · pass 36 · fail 0` |
| `lint:type-members` (+ negative) | `passed with 4 recorded exception(s)`, 108 contract entries |

`scripts/check-unused-type-members.contracts.json` needed no remap: it still
holds 108 entries with the same 4 recorded exceptions, and no pin names
`domain/source.ts` or `tests/domain/source.test.ts` (checked by parsing the file,
then confirmed by the gate). `add.ts` was not touched, so `addMarketplace` stays
at line 545. `npm run format` was run on both changed files before
`lint:type-members`.

Per-pair direct coverage for the one production module whose body changed:

```
source.ts   branches 185/185  functions 31/31  lines 694/694
```

**Where verification ran:** the main checkout of this worktree,
`/home/acolomba/src/pi-claude-marketplace-pr-153`, which has `node_modules` and
can therefore run the project's gates. The numbers above are reproducible from
the tree you are looking at.

### What this closure does not close

Restoring the pre-phase reload identity also restores the pre-phase disagreement
between the two paths, for the same one input shape. Stated plainly, because
iteration 3 listed the opposite property as one of its three reasons for leaving
the residual open:

| typed input | first-parse identity | reload identity |
|---|---|---|
| `https://gitlab.com/o/r/#main` | `https://gitlab.com/o/r/` | `https://gitlab.com/o/r` |
| `https://gitlab.com/o/r.git/#main` | `https://gitlab.com/o/r.git/` | `https://gitlab.com/o/r` |

The add computes one `plugin-clones/<hash>` directory and every later operation
computes another, so a marketplace added at a url whose path carries a trailing
slash immediately before a `#<ref>` fragment clones once under the add's hash and
then cold-misses it forever, orphaning that directory. This is exactly
`130d68a9`'s behaviour, and it is not reachable without that input shape: every
other url — every `.git` form, every plain `#ref` form, every github and
git-subdir form — agrees across the two paths, and the reload is a fixed point
from its first application onward (row 4 of `URL_RELOAD_IDENTITY_CASES` pins
that).

The two properties are mutually exclusive as long as both gates 1 and 2 pin
pre-phase bytes: `130d68a9` itself disagreed with itself on this shape, so
preserving both of its values preserves the disagreement. Making the round trip a
fixed point instead means moving the *first-parse* identity — dropping the path
slash in `stripUrlDecorations`, which is gate 2's byte-identity and
`URL_IDENTITY_CASES`' first three rows — and that needs its own decision record
plus the note that warm clones for that input class are re-created once. It is
not something to fold into a residual closure whose stated acceptance condition
is byte-identity to `130d68a9`. Flagged here as the remaining choice rather than
made silently.

Two smaller behaviour notes, both pre-phase parity rather than new:

- An object-form url source with `raw` but no `url`
  (`{source:"url", raw:"https://gitlab.com/o/r"}`) is rejected as `url source is
  missing url`. `130d68a9` rejected it the same way; iteration 3 accepted it as a
  side effect of the `raw ?? url` fallback. No persisted `UrlSource` and no
  documented manifest form omits `url`.
- A `{kind:"url"}` object whose `url` is a github browser URL
  (`.../o/r/tree/main`) is now rejected where `130d68a9` fell through to a
  clonable `url` source. That is CR-02, counted among the 13 deliberate rejects.

The six deferred Info findings are still untouched, including IN-06 — the
`re-parsing an already-parsed URL source is idempotent on raw` case still asserts
only `raw`. The five new reload rows next to it do compare whole values.

---

_Fixed: 2026-09-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3, residual closure_

## Operator-decided behavior change: the url identity is now a fixed point (D-2-05)

**Requested:** § "What this closure does not close" above named the remaining
choice — byte-identity to `130d68a9` on both paths, or a round trip that is a
fixed point — and stated that the two are mutually exclusive because `130d68a9`
disagreed with itself on one input shape. The operator chose the **fixed point**,
with the reasoning that a trailing slash sitting in front of a `#<ref>` fragment
carries no meaning in a clone URL, so preserving pre-phase bytes there preserves
a bug rather than a contract.

**Commit:** `7c7df1df` — `fix(02): make the url cache identity a fixed point`
**Files:** `extensions/pi-claude-marketplace/domain/source.ts`,
`tests/domain/source.test.ts`, `tests/domain/clone-key.test.ts`
**Branch:** `features/git-hosts`, base `8173d25a`, head `7c7df1df`. No branch was
created, renamed, or switched; no git worktree was created (`git worktree list`
shows the same eight entries as before the run: this checkout plus seven
pre-existing siblings, none of them added by this pass). All
three paths were staged explicitly; the three planning documents below are left
uncommitted for the orchestrator.

### Before / after identity

Measured by importing the parser extracted from `130d68a9` alongside the
working-tree parser and reading `canonicalCloneUrl` on both. `130d68a9`'s
`source.ts` has no imports and its `clone-key.ts` imports only `createHash` and
types, so the side-by-side is exact.

| typed input | pre-phase first parse | pre-phase reload | agreed? | now (both paths) |
|---|---|---|---|---|
| `https://gitlab.com/o/r/#main` | `…/o/r/` | `…/o/r` | **no** | `…/o/r` |
| `https://gitlab.com/o/r.git/#main` | `…/o/r.git/` | `…/o/r` | **no** | `…/o/r` |
| `https://gitlab.com/o/r/#` | `…/o/r/` | `…/o/r` | **no** | `…/o/r` |
| `https://gitlab.com/o/r///#main` | `…/o/r///` | `…/o/r` | **no** | `…/o/r` |
| `https://gitlab.com/o/r#main` | `…/o/r` | `…/o/r` | yes | `…/o/r` |
| `https://gitlab.com/o/r.git#main` | `…/o/r` | `…/o/r` | yes | `…/o/r` |
| `https://gitlab.com/o/r.git` | `…/o/r` | `…/o/r` | yes | `…/o/r` |
| `https://gitlab.com/o/r/` | `…/o/r` | `…/o/r` | yes | `…/o/r` |

`…/o/r.git/#main` keeps the `.git`-stripped identity `…/o/r`, which is what
pre-phase reload computed and what D-76-01 requires: `https://host/repo.git` and
`https://host/repo` are one source. The wire form still sends `…/o/r.git` for
that input (D-2-01).

A persisted record still holding the old `…/o/r/` value converges: its next
reload derives `…/o/r` and stays there. The accepted cost is one re-clone for
that input class on first use after upgrade.

### The structural decision: three compositions, not one

`6cc37bd1` split the identity form apart from the wire form precisely because a
shared helper let a wire-side fix move the cache identity — CR-01. The `url`
identity now wants the wire form's ordering, so collapsing them would be the
obvious move and would restore exactly that coupling. It was not done.

`domain/source.ts` holds two leaf primitives (`stripTrailingSlashes`,
`splitUrlFragment`) plus a new one-line `stripGitSuffix`, and three named
compositions over them, each with one call site:

| composition | order | `.git` | consumer |
|---|---|---|---|
| `stripSlashAndFragment` (exported) | split, then strip path slashes | kept | `networkCloneUrl` — the wire form |
| `stripUrlDecorations` | split, then strip path slashes | stripped | `parseUrlSource` — the `url` identity |
| `stripGitHubUrlDecorations` | strip whole input's slashes, then split | stripped | `parseGitHubUrl` — the github identity |

The first two agree on ordering today and still share no composition. The
negative control below demonstrates the decoupling is real rather than asserted:
reverting the wire ordering alone fails three wire cases and **zero** identity
cases, and reverting the identity ordering alone fails six identity cases and
**zero** wire cases.

The third composition is the one the brief did not anticipate. Giving the github
arm the new ordering would flip `https://github.com/o/r/#main` from the
`must be https://github.com/<owner>/<repo>[.git][#<ref>]` diagnostic to an
accepted github source — CR-01's second consequence, a widening of the accepted
parse surface, and out of scope for a relaxation the operator scoped to the
`url` cache identity (gate 3, gate 4). So `parseGitHubUrl` keeps the pre-existing
ordering under its own name, and both functions' docstrings state which ordering
they compose and why, in the present tense. The old docstring's justification for
the surviving slash is gone with the behavior it justified.

### The eight gates

**1. Fixed point over a table — proved.** A harness parses each typed string,
serializes the result to the persisted `{kind, raw, url[, ref]}` shape, re-parses
it, and compares `canonicalCloneUrl` on both. Over all 16 `url`-kind rows — `.git`
and non-`.git`, with and without a slash before the fragment, with an empty
fragment, with no fragment, multi-slash, sub-group path, and a non-default port:

```
FIXED_POINT_VIOLATIONS=0
WIRE_ROUNDTRIP_VIOLATIONS=0
```

The same harness on the pre-commit tree reported `FIXED_POINT_VIOLATIONS=6`.

**2. First parse and reload agree — proved.** Gate 1 is the general statement of
it. The two shapes the brief named both land on `https://gitlab.com/o/r` on both
paths; see the table above.

**3. Identity unchanged from `130d68a9` for every other input — proved, with the
moves enumerated.** Pre-phase and working-tree parsers run side by side over 31
accepted string inputs (bare urls, trailing-slash-no-fragment, `.git`, plain
`#ref`, slash-before-fragment, deep paths, a port, github urls, github browser
`/tree/` URLs, `owner/repo` shorthands, `owner/repo@ref`, paths, rejected
schemes) and 80 accepted object inputs (persisted `{kind, raw, url}` records in
every slash / `.git` / fragment combination, each also with a `ref` and a 40-hex
`sha`, the `{source:"url"}` manifest form, github and git-subdir kinds, npm,
path, and the CR-02 attack strings in each of the two fields):

```
STRING  ACCEPTED_ROWS=31  ACCEPTED_IDENTITY_MOVES=6  ACCEPTED_NON_RAW_FIELD_MOVES=6  ACCEPT_REJECT_FLIPS=0
OBJECT  ACCEPTED_ROWS=80  ACCEPTED_IDENTITY_MOVES=4  ACCEPTED_NON_RAW_FIELD_MOVES=4  ACCEPT_REJECT_FLIPS=14
```

All ten identity moves were listed individually and read. Every one is the
sanctioned shape — a trailing slash immediately before a `#<ref>` fragment —
and in every one the move is old-value → `…/o/r`:

```
"https://gitlab.com/o/r/#main"            …/o/r/            -> …/o/r
"https://gitlab.com/o/r/#"                …/o/r/            -> …/o/r
"https://gitlab.com/o/r.git/#main"        …/o/r.git/        -> …/o/r
"https://gitlab.com/o/r///#main"          …/o/r///          -> …/o/r
"https://gitlab.com/g/sub/o/r/#main"      …/g/sub/o/r/      -> …/g/sub/o/r
"https://host.example:8443/o/r/#main"     …:8443/o/r/       -> …:8443/o/r
{source:url  url=…/o/r/#main}             …/o/r/            -> …/o/r
{kind:url    url=…/o/r/#main}             …/o/r/            -> …/o/r
{source:url  url=…/o/r.git/#main}         …/o/r.git/        -> …/o/r
{kind:url    url=…/o/r.git/#main}         …/o/r.git/        -> …/o/r
```

`ACCEPTED_NON_RAW_FIELD_MOVES` equals `ACCEPTED_IDENTITY_MOVES` on both halves:
for every accepted input, every field of the parsed source except `raw` is
byte-identical to pre-phase apart from the `url` on those same rows, so nothing
else moved under cover of the change. `ACCEPT_REJECT_FLIPS=0` on the string path
means no input changed between accepted and rejected — in particular the three
github rejections CR-01 restored are still rejections. The 14 object-path flips
are unchanged in count and identity from the pre-commit measurement: they are
CR-02's deliberate rejects (an object-form `http://`, `ssh://`, `git@host:`,
relative path, browser URL or `owner/repo` shorthand in either field, plus a
`{kind:"url"}` whose `url` is a github browser URL).

**4. `canonicalCloneUrl` unchanged for github and git-subdir — proved.** Covered
by the gate-3 harness: `{kind:"github", raw:"o/r"}` bare, with a `ref`, and with
a `sha`; `{source:"github", repo:"o/r"}`; `{source:"github", repo:"https://github.com/o/r/#main"}`;
`{kind:"git-subdir"}` bare, with `…/mono/#main`, and with `…/mono.git/` plus a
ref — all return the pre-phase identity and are byte-identical whole values.
`domain/clone-key.ts` was not touched by this commit.

**5. The wire form keeps every fix this phase landed — proved across the round
trip.** `WIRE_ROUNDTRIP_VIOLATIONS=0` over the same 16 rows: `networkCloneUrl` is
identical at the first parse and at the reload for every one. Every `.git` the
typed input carried survives on the wire on both (`…/o/r.git#main` → `…/o/r.git`;
`…/o/r.git/#main` → `…/o/r.git`), and trailing slashes and `#<ref>` come off in
both orderings. A committed case pins the shape D-2-05 touches:
`tests/domain/clone-key.test.ts`'s `"keeps a trailing .git suffix behind a path
slash that precedes a #<ref> fragment"`, whose fixture is exactly the parsed
source the new first parse produces for `…/mp.git/#v1.0`.

**6. CR-02's scheme gate still rejects through both fields — proved.**
`URL_OBJECT_GATE_CASES` is untouched and green: `http://`, `ssh://`, `git@host:`,
a relative path, a `/tree/` browser URL and an `owner/repo` shorthand, each
listed twice — once with the attack in `url`, once with it in `raw` behind a
benign `url` — plus the github-object row that drops a hostile `raw`. The
gate-3 harness re-derives the same verdict independently: all 14 object-form
accept→reject flips are those rejections, and none of them regressed to accepted.

**7. Test tables updated, with a fixed-point table and a negative control.**
- `URL_IDENTITY_CASES`: the three sanctioned rows move to `https://gitlab.com/o/r`
  and are retitled from "keeps a path slash …" to "strips a path slash …". The
  other five rows, including both github rejections, are unchanged. The table
  docstring now states which arm splits first and why.
- `URL_RELOAD_IDENTITY_CASES`: expected values were already the new ones — the
  reload path has computed `…/o/r` since `3546a28c`. The docstring is corrected to
  say the three slash-carrying rows now reach the value the string table's
  first-parse rows produce, rather than a value only the reload reaches.
- `URL_FIXED_POINT_CASES` (new, 8 rows): each row writes its expected `UrlSource`
  out **once** and asserts it twice — against the parse of the typed string and
  against the re-parse of the persisted record built from that same literal. The
  expected value is a literal, not a production result, and the comparison is
  whole-value `deepStrictEqual`. Rows cover slash-before-fragment, no-slash
  fragment, `.git` behind a slash, `.git` before a fragment, empty fragment,
  `.git` with no fragment, trailing slash with no fragment, and a bare url.

**Negative control, identity ordering.** Reverting `stripUrlDecorations` to
`splitUrlFragment(stripTrailingSlashes(input))` and changing nothing else fails
6 of 160 cases across the two domain test modules — the three identity rows and
three of the eight fixed-point rows (the five that hold under either ordering are
the rows with no slash before a fragment, which is the point):

```
✖ strips a path slash that precedes a #<ref> fragment from the url identity
✖ strips a path slash that precedes an empty #fragment from the url identity
✖ strips a .git suffix behind a path slash that precedes a #<ref> fragment
✖ holds one identity for a path slash before a #<ref> fragment across a reload
✖ holds one identity for a .git suffix behind a path slash across a reload
✖ holds one identity for a path slash before an empty #fragment across a reload
ℹ tests 160 · pass 154 · fail 6
```

Zero wire cases fail under that revert.

**Negative control, wire ordering.** Reverting `stripSlashAndFragment` to the
opposite composition fails 3 of 160 — the new clone-key case, the pre-existing
git-subdir case, and the direct `stripSlashAndFragment` row — and **zero**
identity or fixed-point cases:

```
✖ keeps a trailing .git suffix behind a path slash that precedes a #<ref> fragment
✖ drops a trailing slash and a #<ref> fragment from a git-subdir url
✖ trims a trailing slash that precedes the #<ref> fragment
ℹ tests 160 · pass 157 · fail 3
```

That asymmetry is the evidence that the identity is pinned independently of the
wire form, which is what CR-01 cost the phase once.

Both controls were restored from a pre-control copy and confirmed byte-identical
with `diff` before the commit.

**8. `npm run check` — CHECK_EXIT=0.** Run to completion, exit code captured into
a named shell variable and appended verbatim to the log, not read through a pipe
and not inferred from a glyph. Two `✗` lines accompany that zero and are not
failures: `✗ 0 above threshold · 15162 analyzed · maintainability 91.8 (good)`
from `fallow health` and `✗ 1,327 lines (1.4%) duplicated across 52 files` from
`fallow dupes`, both of which exit 0 under `--fail-on-issues`.

```
CHECK_EXIT=0
```

| Gate | Result |
|---|---|
| `typecheck` / `lint` / `lint:workflows` (+ negative) | pass |
| `fallow` (dead-code, circular-deps, re-export-cycles, health, dupes) | `✓ No issues found` |
| `format:check` | `All matched files use Prettier code style!` |
| `test:corresponding` (+ negative), `test:coverage:direct:negative` | pass |
| `test:coverage:unit` | `tests 7328 · pass 7328 · fail 0`, 100% lines/branches/functions |
| `test:integration` | `tests 36 · pass 36 · fail 0` |
| `lint:type-members` (+ negative) | `passed with 4 recorded exception(s)`, 108 contract entries |

`npm run format` was run on the three changed files before `lint:type-members`.
`scripts/check-unused-type-members.contracts.json` needed no remap: it still
holds 108 entries with the same 4 recorded exceptions, and no pin names
`domain/source.ts`, `domain/clone-key.ts`, or either test module (checked by
parsing the file, then confirmed by the gate). `add.ts` was not touched, so
`addMarketplace` stays at line 545.

Per-pair direct coverage for the two domain modules:

```
source.ts     branches 188/188  functions 33/33  lines 728/728
clone-key.ts  branches  10/10   functions  4/4   lines 105/105
```

**Where verification ran:** the main checkout of this worktree,
`/home/acolomba/src/pi-claude-marketplace-pr-153`, which has `node_modules` and
can therefore run the project's gates. No nested worktree was created — the
brief forbids creating or switching a branch, and a hand-rolled worktree has no
`node_modules` and could not have run gate 8. The numbers above are reproducible
from the tree you are looking at.

### Planning records written (uncommitted, for the orchestrator)

- `02-CONTEXT.md` — new `### The url identity is a fixed point` section holding
  **D-2-05**, alongside the locked D-2-01..D-2-04: the normalization, why
  pre-phase self-contradiction made byte-identity and fixed-point mutually
  exclusive, the accepted one-re-clone cost, the `url`-only scope, and the
  three-composition structure with its reversibility note.
- `02-01-PLAN.md` — the `canonicalCloneUrl` must_have is **amended, not
  deleted**: it still asserts the same-string property and now names the one
  sanctioned exception and cites D-2-05, so a verifier reads an accepted
  amendment rather than a failed must-have.
- `02-REVIEW-FIX.md` — this section, appended.

### What is left open

- **One re-clone for the affected input class.** A marketplace already added at
  a url with a trailing slash immediately before a `#<ref>` fragment cold-misses
  its `plugin-clones/<hash>` directory once on first use after upgrade and
  re-clones under the new hash. The old directory is left on disk; no sweeper
  removes it. This is the accepted cost recorded in D-2-05, and it is bounded —
  the new identity is a fixed point, so it happens at most once.
- **`https://github.com/o/r/#main` stays rejected** while
  `https://gitlab.com/o/r/#main` is now accepted and normalized. The asymmetry
  is deliberate (gate 3 / gate 4 scope the relaxation to the `url` kind) and is
  pre-phase behavior for the github arm, but it is a diagnostic a user could hit
  on github after learning the slash is harmless elsewhere. Reversing it is a
  parse-surface widening and needs its own decision.
- **The six deferred Info findings are still untouched**, including IN-06: the
  `re-parsing an already-parsed URL source is idempotent on raw` case still
  asserts only `raw`. The eight new fixed-point rows beside it do compare whole
  values, so the behavior that case gestures at is now covered by a table that
  discriminates; the case itself is unchanged.

---

_Fixed: 2026-09-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3, operator-decided fixed-point change (D-2-05)_
