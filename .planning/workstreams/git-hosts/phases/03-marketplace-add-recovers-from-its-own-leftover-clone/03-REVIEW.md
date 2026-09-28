---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
reviewed: 2026-09-28T03:09:46Z
depth: standard
diff_base: 720ff74e
files_reviewed: 3
files_reviewed_list:
  - extensions/pi-claude-marketplace/platform/git.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/platform/git.test.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 3: Code Review Report (gap closure 03-04)

**Reviewed:** 2026-09-28T03:09:46Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

The prior round's report (CR-01, WR-01..WR-10, IN-01..IN-06) is at commit `fcc13483`. This diff
targets CR-01. **CR-01 is resolved.** The same diff also closes the gap that WR-10 described: no
test covered the url-less `origin` shape.

## Summary

Scope: `git diff 720ff74e..HEAD` on the three listed files. That is commits `24f2da2c` (fix) and
`235fdc17` (test). The production change is one guard in `platform/git.ts::listRemotes` plus two doc
paragraphs.

**Fix correctness.** isomorphic-git 1.42.2 `_listRemotes` returns one
`{ remote, url: await config.get("remote.<name>.url") }` for each `[remote "…"]` section header.
`GitConfig.get` returns the last matching value. A matching value always comes from
`extractVariableLine`, which returns a string, so it is always a string. When nothing matches,
`get` returns `undefined`. `url` can therefore only be `string | undefined`, and
`typeof url === "string"` separates the two cases exactly. I ran each shape against the real
wrapper (scratch script, real temp dirs):

| `.git/config` shape | `git.listRemotes` | wrapper result | caller outcome |
|---|---|---|---|
| origin, fetch line, no url | `[{origin, undefined}]` | `no-origin` | stale clone |
| origin, no keys | `[{origin, undefined}]` | `no-origin` | stale clone |
| origin, `pushurl` only | `[{origin, undefined}]` | `no-origin` | stale clone |
| `url =` (empty) | `[{origin, ""}]` | `origin ""` | mismatch -> stale clone |
| bare `url` key | `[{origin, "true"}]` | `origin "true"` | mismatch -> stale clone |
| duplicate `[remote "origin"]`, url in second | two rows, both same url | `origin <url>` | compared |
| `[Remote "origin"]` (upper-case section) | `[]` | `no-origin` | stale clone (git itself would see an origin; this fails safe) |
| empty file | `[]` | `no-origin` | stale clone |
| **two `url` keys** | `[{origin, <last>}]` | `origin <last>` | **see WR-11** |

`git.listRemotes` cannot throw on this path. `discoverGitdir` swallows stat errors. `FileSystem.read`
resolves `null` on any error. `GitConfig`'s constructor does not throw. The only schema coercers are
for `core.*`, and they never run for `remote.origin.url`. No raw-error route into the ATTR-07
boundary remains through `listRemotes`. `recognizeLeftover` is the only consumer, and its `switch`
is still exhaustive.

**Tests exercise the real adapter.** I copied the HEAD tree, restored `git.ts` to its `720ff74e`
version, and ran the new cases against it:

- Both `add.test.ts` cases fail. Standalone throws the `TypeError` from `stripGitSuffix`.
  Orchestrated returns `reason: "unparseable"`.
- The two url-less `git.test.ts` rows fail.
- The empty-url row passes, as intended. This row is also what rejects a truthiness guard
  (`origin?.url ? … : no-origin`).

The two new `add.test.ts` cases put the real `listRemotes` into the fake-clone `GitOps`, so they
reach the real adapter and not the fake's typed canned value. The `git.test.ts` rows also check the
library's own output first. That proves each fixture really produces the shape its title names.

**Toolchain (run by me):** `tsc --noEmit` exit 0. `eslint --max-warnings=0` on the 3 files exit 0.
`prettier --check` clean. `node --test tests/platform/git.test.ts` 39/39.
`node --test tests/orchestrators/marketplace/add.test.ts` 81/81.
`test:coverage:direct -- platform/git.ts`: branches 47/47, functions 11/11, lines 394/394.
`fallow audit --base 720ff74e`: verdict `pass`, nothing introduced.

No regressions found. What is left is one removal-authority gap that sits right next to the fix
(WR-11) and two small items.

## Warnings

### WR-11: a multi-valued `remote.origin.url` is read as its LAST value, while git fetches from the FIRST, so a tree git treats as foreign can be recognized and removed

**File:** `extensions/pi-claude-marketplace/platform/git.ts:147-149` (arm doc), `:350-355` (new
paragraph), `:376-379` (guard). Consumed at
`extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:725-729`.

**Issue:** `GitConfig.get` ends with `allValues.pop()`, so isomorphic-git reports the last `url`
under `[remote "origin"]`. Canonical git uses the first one. I checked this with a real repository:

```
[remote "origin"]
	url = https://evil.example/x/y.git
	url = https://github.com/anthropics/claude-plugins-official.git
```

- `git remote get-url origin` returns `https://evil.example/x/y.git`.
- `git remote -v` shows that url as the only fetch url.
- `listRemotes` returns `{ kind: "origin", url: "https://github.com/anthropics/claude-plugins-official.git" }`.
- `recognizeLeftover` then finds that url byte-equal to `canonicalCloneUrl(source)` and removes the
  tree.

Per D-3-02, recognition is the only authority for removal. So removal is authorized for a tree
whose effective origin, in git's view, is a different repository. That tree may even be one the
extension did not write, which is the WR-03 class, now reached through a foreign url. The diff
makes this more visible. It rewrote the `origin` arm doc to say `url` is "the remote's wire-form
value, verbatim", and the new paragraph says the library "resolves each url separately". Neither
statement mentions multiple values. The shape is outside CR-01's crash, but it is the one
isomorphic-git return shape where the wrapper's contract (one verbatim origin url) does not hold,
and the brief asked for every shape.

**Fix:** read every value and refuse when the result is ambiguous. `git.getConfigAll` returns the
values in file order. Its path normalization also lower-cases the section name, so
`[Remote "origin"]` resolves the way git resolves it:

```ts
const urls = await git.getConfigAll({ fs, dir: opts.dir, path: "remote.origin.url" });
// D-3-03 / MA-13: git fetches from the first url; more than one is not a
// tree this extension wrote, so it refuses rather than guessing.
if (urls.length !== 1) {
  return { kind: "no-origin" };
}

const url: unknown = urls[0];
return typeof url === "string" ? { kind: "origin", url } : { kind: "no-origin" };
```

(Returning `urls[0]` would also match git. Refusing is the stricter choice, and it keeps the
recognition claim honest.) Add a `git.test.ts` row for the two-url config next to
`ORIGIN_SECTION_SHAPES`. Update the `origin` arm doc to say "exactly one url". If you keep the
current reader instead, write down the divergence at `:350-355` so it is a recorded decision.

## Info

### IN-07: the new inline comment uses the banned "X, not Y" framing

**File:** `extensions/pi-claude-marketplace/platform/git.ts:376-377`

**Issue:** `` // `unknown`, not the library's declared `string`: see the url-less section paragraph above. ``
`skills/typescript-comments/SKILL.md` (Prose) says: "No `not X but Y` … framing. State Y." The
paragraph it points to already explains why.

**Fix:** state the fact: `` // The library declares `url` a string; it is `undefined` for a url-less section (see above). ``
Or delete the line, because the JSDoc paragraph already covers it.

### IN-08: the orchestrated url-less case does not check that state stays empty, though its standalone sibling does

**File:** `tests/orchestrators/marketplace/add.test.ts:701-728`

**Issue:** The standalone case (`:668-699`) checks `loadState(locations.extensionRoot)` deep-equals
`{ schemaVersion: 2, marketplaces: {} }`. The orchestrated case checks the outcome, the empty
notification list, and the config bytes, but not state. MA-13 refusal records nothing in either
mode. An implementation that committed a record before the orchestrated failure would still pass
this case.

**Fix:** after the config-bytes check, add the same `loadState` whole-value assertion the
standalone case uses.

---

_Reviewed: 2026-09-28T03:09:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
