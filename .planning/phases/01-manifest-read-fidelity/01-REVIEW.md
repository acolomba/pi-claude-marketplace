---
phase: 01-manifest-read-fidelity
reviewed: 2026-09-13T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/bridges/skills/discover.ts
  - extensions/pi-claude-marketplace/domain/dependencies.ts
  - extensions/pi-claude-marketplace/domain/manifest-path.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/declared-component-path-overlap.test.ts
  - tests/architecture/manifest-read-agreement.test.ts
  - tests/bridges/skills/discover.test.ts
  - tests/domain/dependencies.test.ts
  - tests/domain/manifest-path.test.ts
  - tests/domain/resolver.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/shared.test.ts
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-09-13
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Reviewed the manifest-read-fidelity delta: the shared `MANIFEST_CANDIDATES` ordering
and its three readers, the new dependency element parser, the `info` dependency
render path, the resolver's canonical `componentPaths` spelling, and the skills
bridge `seenByDir` collapse.

The injection surface holds up. Every field that reaches the one-line
`dependencies:` row is matched against a positive allowlist that excludes `\n`,
`\r`, `,`, `(`, `)` and every C0/ANSI byte, and JavaScript's `$` (no `m` flag)
does not admit a trailing newline the way Python's does — verified by execution.
A crafted manifest cannot forge a row or a list separator.

Two defects are not cosmetic. Both were reproduced by running the shipped code.

1. The MANF-03 overlap fix landed in the skills bridge only. Reading a plugin's
   bare `plugin.json` newly exposes its declared `commands` paths, and the
   commands bridge double-installs every file reachable through both a declared
   subpath and the conventional parent. This is the exact regression class
   `tests/architecture/declared-component-path-overlap.test.ts` was written to
   prevent, on a kind that gate does not cover.
2. The three manifest readers agree on absence and on `EISDIR`, and disagree on
   every other stat errno. `domain/resolver.ts::readManifest` keeps its stat
   outside the try block, so `ENOTDIR` and `EACCES` throw out of `resolveStrict`
   while the other two readers classify the errno and walk on to the bare
   sibling. The `manifestCandidateExists` doc comment claims a mirror
   relationship that does not exist.

The agreement gate is green because it only varies presence and absence — it
never plants the present-but-unusable condition the readers actually differ on.

## Critical Issues

### CR-01: Reading the bare manifest makes the commands bridge install one file twice

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:630-670` (bare-manifest
read), `extensions/pi-claude-marketplace/bridges/commands/discover.ts:392-407`
(uncollapsed overlap), `tests/architecture/declared-component-path-overlap.test.ts`
(gate covers skills only)

**Issue:** The phase's own overlap rationale — "the manifest-read fix becomes a net
output regression on exactly the plugins it rescues" — applies verbatim to
`commands`, and only `skills` got the D-01-21 collapse. `collectStrictComponentKind`
appends the conventional `commands` directory unconditionally, `walkCommandsDir`
RECURSES, so a declared `commands/<sub>` and the conventional `commands` reach the
same file at two depths and generate two different names. Both install.

Reproduced against the shipped code with a plugin whose only manifest is the bare
`plugin.json` declaring `commands: ["./commands/git"]`, over a tree holding
`commands/git/commit.md` and `commands/top.md`:

```text
# after this phase (bare plugin.json is now read)
componentPaths.commands = [ 'commands/git', 'commands' ]
discovered = [ 'acme:commit', 'acme:git:commit', 'acme:top' ]
warnings   = [ 'command file "commands/git/commit.md" is reached by more than one
               componentPaths.commands entry; installing it as both "acme:commit"
               and "acme:git:commit".' ]

# same tree with no manifest at all -- the pre-change state for this plugin
componentPaths.commands = [ 'commands' ]
discovered = [ 'acme:git:commit', 'acme:top' ]
warnings   = []
```

One source file, two installed commands, plus a warning that did not exist
before. `agents` is safe (its discovery is flat, so nesting cannot re-reach a
file) and `skills` is fixed; `commands` is the live gap.

**Fix:** Give `discoverPluginCommands` the same collapse the skills bridge got. It
already keys `seenByFile` on the absolute source file — turn that from a warn-and-
install-anyway into a skip, matching D-01-21's "one file reached twice is one
command, not a collision":

```ts
const sameFile = seenByFile.get(command.commandFile);
if (sameFile !== undefined) {
  // MANF-03 / D-01-21: already reached through an earlier componentPaths.commands
  // entry at a different depth. Same file = one command, not a duplicate.
  continue;
}
```

Then extend `tests/architecture/declared-component-path-overlap.test.ts` with a
commands case (declared `./commands/<sub>` over a shipped `commands/` parent,
asserting one generated name and no warning), so the gate covers every recursive
component kind rather than one.

### CR-02: The three manifest readers disagree on every stat errno except ENOENT

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:634-640` and
`:310-330` (`defaultStatKind`),
`extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts:900-914`,
`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:510-518`

**Issue:** D-01-07 requires the three readers to agree on which candidate wins.
They do for absence and for a directory sitting at the candidate path (`EISDIR`
was clearly thought about). They do not for anything else, because
`readManifest`'s existence check is `statKindOf(ctx)(manifestPath) !== "file"`
placed OUTSIDE the try block, and `defaultStatKind` rethrows every errno that is
not `ENOENT`:

| condition | `resolver.ts::readManifest` | `shared.ts` tier 1 | `info.ts` dependency read |
|---|---|---|---|
| candidate absent (`ENOENT`) | fall through | fall through | fall through |
| candidate is a directory (`EISDIR`) | fall through | fall through | fall through |
| `.claude-plugin` is a regular FILE (`ENOTDIR`) | **throws** | fall through | fall through |
| stat refused (`EACCES`, `ELOOP`, …) | **throws** | stop walk | stop walk |

Reproduced against the shipped code, plugin tree carrying a bare `plugin.json`
declaring `version: 9.9.9`:

```text
A: .claude-plugin is a FILE, bare plugin.json exists
  resolver: THROW ENOTDIR: not a directory, stat '.../alpha/.claude-plugin/plugin.json'
  version : 9.9.9          <- read the bare sibling

C: .claude-plugin dir chmod 000, bare plugin.json exists
  resolver: THROW EACCES: permission denied, stat '.../alpha/.claude-plugin/plugin.json'
  version : 1.0.0          <- stopped the walk, fell to tier 2
```

Consequences:

- The `manifestCandidateExists` doc comment (`shared.ts:900-906`) states it
  "Mirrors the stat gate in `domain/resolver.ts::readManifest`, which is what lets
  the two readers agree on which file describes a plugin." That claim is false in
  both directions: the resolver throws where this returns `false`, and throws
  where this returns `true`.
- The `D-01-08 / D-01-09` comment at `resolver.ts:655-656` states an unreadable
  file, a parse throw and a schema rejection "are one rule — the manifest is
  present and unusable." A stat-level unreadable is not covered by that rule: it
  escapes as a raw errno instead of the documented
  `{ ok: false, reason: "malformed plugin.json: …" }`.
- On the `info` surface the split is user-visible in one row. In case A,
  `resolveStrict` throws and the row renders `{unreadable}` with
  `componentsResolved: false`, while `readOwnManifestDependencies` walks past the
  same `ENOTDIR` and reads the bare sibling — a row that says the plugin could not
  be read next to content read from it. `info` does not crash (the row builders'
  outer catches absorb it), but the two halves of the row contradict each other.

**Fix:** Give `readManifest` the same errno-classified existence check the other two
readers use, and convert a present-but-unstattable candidate into the documented
failure reason instead of a throw:

```ts
async function manifestCandidatePresence(
  ctx: ResolveContext,
  manifestPath: string,
): Promise<"absent" | "file" | "unusable"> {
  try {
    return (await statKindOf(ctx)(manifestPath)) === "file" ? "file" : "absent";
  } catch (err) {
    // D-01-07 / D-01-11: only "not there" may advance the walk. ENOTDIR means a
    // parent component is a file, which is an absence of this candidate; every
    // other errno means present and unreadable.
    const code = (err as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ENOTDIR" ? "absent" : "unusable";
  }
}
```

then in the loop: `absent` → `continue`; `unusable` → `return { ok: false, reason:
\`malformed plugin.json: ...\` }`; `file` → the existing read. Note this also
requires deciding `ENOTDIR` once, for all three readers — today `shared.ts` and
`info.ts` treat it as absence and `resolver.ts` as fatal. Whichever way it lands,
all three must land the same way, and the decision belongs next to
`MANIFEST_CANDIDATES` in `domain/manifest-path.ts` rather than being re-derived in
each reader. Also correct the `manifestCandidateExists` doc comment.

## Warnings

### WR-01: A dependency the manifest declared can vanish from the line with no signal

**File:** `extensions/pi-claude-marketplace/domain/dependencies.ts:125-141`,
`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:402-419`

**Issue:** `RANGE_MARKER` is the literal `"@^"`, so only the caret range form is
split off a bare string. `VERSION_PATTERN` (line 55) documents `~1.2`,
`>=1.0.0 <2.0.0`, `1.x`, `*` and `||` as "Every semver range form upstream
accepts", but those forms can only ever arrive through the OBJECT shape. A bare
string `"foo@~1.0.0"` parses as `name=foo, marketplace=~1.0.0`, the tilde fails
`TOKEN_PATTERN`, and D-01-05 drops the whole element. `"foo@>=1.0.0"` likewise.

When every element is unusable, `renderDependencyList` returns `undefined` and the
line is omitted entirely — byte-identical to a plugin that declares no
dependencies. On a phase whose stated purpose is to stop discarding declared
constraints, the failure mode is indistinguishable from the absence it is supposed
to be distinguishable from.

**Fix:** Two independent parts.

1. Decide whether the bare-string range marker should be `@` followed by any
   `VERSION_PATTERN`-leading character rather than `@^` alone, and if it stays
   `@^`, say so in the `VERSION_PATTERN` doc comment (which currently implies all
   those forms are reachable) and add a test pinning `"foo@~1.0.0"` to whichever
   behavior is chosen.
2. Distinguish "declared none" from "declared only unusable elements" at the
   render boundary. `parseDeclaredDependencies` already knows both facts; have it
   or `renderDependencyList` surface the drop count so `info` can add a
   closed-set reason rather than rendering a plugin with dependencies as one
   without.

### WR-02: `declaringMarketplace` is the only rendered field on the line with no allowlist

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:339-344`,
`extensions/pi-claude-marketplace/domain/dependencies.ts:22-26`

**Issue:** The `domain/dependencies.ts` header asserts "Every rendered field is
matched against a positive allowlist before it leaves here … All four render
verbatim into a line-oriented notification row, so admitting a newline or an escape
would let manifest text forge a row." `withDeclaringMarketplace` then substitutes
`marketplace` with `getPluginInfo`'s caller-supplied string, which never passes
`TOKEN_PATTERN`. The invariant the module documents is broken by its only consumer.

Exploitability today is low — the name must match a `state.json` marketplace record
whose name was `assertSafeName`-checked at add time — but the defense is stated as
structural and is not.

**Fix:** Validate at the substitution point rather than relying on a distant
upstream check:

```ts
function withDeclaringMarketplace(
  dependency: DeclaredDependency,
  declaringMarketplace: string,
): AddressedDependency | undefined {
  const marketplace = dependency.marketplace ?? declaringMarketplace;
  return isRenderableToken(marketplace) ? { ...dependency, marketplace } : undefined;
}
```

exporting the `TOKEN_PATTERN` test from `domain/dependencies.ts` as
`isRenderableToken` so both sides share one rule.

### WR-03: `VERSION_PATTERN` admits the `sha` sub-token, and no field is length-bounded

**File:** `extensions/pi-claude-marketplace/domain/dependencies.ts:55`,
`extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:372-385`

**Issue:** `VERSION_PATTERN` admits `[A-Za-z]` and the space, so a manifest can
declare `version: "1 sha deadbee"` and the row renders `a@mp (1 sha deadbee)` —
imitating D-01-30's labelled sha sub-token inside the real parenthetical. It cannot
produce the two-constraint form (`,` is excluded) and cannot forge a second list
entry (also `,`), so this is misleading display rather than injection.

Separately, none of `name`, `marketplace`, `version` or `sha` has an upper length
bound, so a multi-kilobyte `version` of `=` characters renders verbatim into a
single notification line.

**Fix:** Bound the version at a sane ceiling and, if the D-01-30 byte form is meant
to be unambiguous, exclude the space from `VERSION_PATTERN` and admit compound
ranges via an explicit alternation instead:

```ts
const VERSION_PATTERN = /^[A-Za-z0-9.\-+*~^<>=| ]{1,64}$/;
```

Add a test asserting a `version` that spells `sha <hex>` does not render as a sha
constraint.

### WR-04: `seenByDir` is a `Map` whose values are never read

**File:** `extensions/pi-claude-marketplace/bridges/skills/discover.ts:114,123,168,174,225`

**Issue:** `seenByDir` is declared `Map<string, DiscoveredSkill>` but only `.has()`
and `.set()` are ever called — no call site reads a value. It retains a
`DiscoveredSkill` per directory for nothing, and the type invites a future reader
to assume the stored skill is the WINNER, which it is not: `collectSkillSubdirs`
(line 174) writes to `seenByDir` BEFORE the `seenByGenerated` collision check, so a
loser is stored under its own directory key.

`path.resolve` is also recomputed at all four sites rather than once per directory.

**Fix:** `const seenByDir = new Set<string>();`, with `.add()` at the two write
sites, and hoist the `path.resolve(...)` result into a local at each call site.
This removes the ambiguity about what the stored value means.

### WR-05: The agreement gate does not exercise the axis the readers actually differ on

**File:** `tests/architecture/manifest-read-agreement.test.ts:77-121`,
`tests/domain/resolver.test.ts` (`D-01-09 an unreadable plugin.json …`)

**Issue:** The gate's own header names the hazard correctly — "a fallback added to
one reader and not to another makes the two disagree" — then plants only three
trees that vary presence and absence (`bare only`, `wrapped + bare`, `neither`).
Every reader agrees on those. D-01-07's present-but-unusable rule, which is where
CR-02 lives, is never planted across readers.

The resolver's own half compounds it: the `D-01-09` case injects a `statKind` map
seam (`{[path]: "file"}`) so the stat CANNOT throw, and only the `readFileText`
failure is exercised. The one code path that breaks agreement is unreachable from
that test by construction.

**Fix:** Add cross-reader cases to `manifest-read-agreement.test.ts` that drive all
three readers against one tree per unusable condition, with no seams injected:

- wrapped candidate is unparseable, bare sibling is valid — assert none of the
  three reads the bare sibling;
- `.claude-plugin` planted as a regular FILE, bare sibling valid — assert all
  three reach the same verdict (this fails today);
- wrapped candidate `chmod 000` (skip on Windows and when running as root), bare
  sibling valid — assert all three reach the same verdict (this fails today).

## Info

### IN-01: The catalog example does not demonstrate the D-01-04 claim it documents

**File:** `docs/output-catalog.md:1768-1782`,
`tests/architecture/catalog-uat.test.ts:3372-3399`

**Issue:** The prose says "The line is ordered by dependency name, not by the
rendered string (D-01-04)", but the fixture uses `both`, `helper`, `pinned` — which
sort identically either way. The example cannot fail if the sort key regresses to
the rendered string.

**Fix:** Pick names where the two orders differ (e.g. `zeta@mp (^1.0.0)` before
`alpha@mp` would be wrong under both, so use a case where the constraint
parenthetical inverts the string order), or drop the claim from the prose and pin
it in `tests/orchestrators/plugin/info.test.ts` alone, where the D-01-04 test
already lives.

### IN-02: `path.isAbsolute(skillsRel)` is now unreachable from the resolver

**File:** `extensions/pi-claude-marketplace/bridges/skills/discover.ts:231-233`

**Issue:** After D-01-14, `validateComponentPath` rejects absolute declarations
outright and returns `path.relative(pluginRoot, candidate)` for everything else, so
`componentPaths.skills` can no longer contain an absolute element. The branch
survives only because `tests/bridges/skills/discover.test.ts` hand-builds
`resolvedPlugin(...)` inputs. Same for the commands bridge's equivalent at
`bridges/commands/discover.ts:372-374`.

**Fix:** Leave it if the hand-built test inputs are intentional, but the module
header comment ("contain one or more relative-or-absolute paths",
`discover.ts:192-193`) now describes a shape the resolver cannot produce — update
it to say the resolver emits contained relative paths and the absolute arm exists
for direct callers only.

### IN-03: `parseObjectElement`'s doc claim is stronger than the code

**File:** `extensions/pi-claude-marketplace/domain/dependencies.ts:143-155`

**Issue:** The comment says "the record is never spread into the result, so no
crafted or inherited key can reach a `DeclaredDependency`." The no-spread half is
true and load-bearing. The "inherited" half is not: `raw.name`, `raw.marketplace`,
`raw.version` and `raw.sha` all traverse the prototype chain. It is harmless for
`JSON.parse` output (`Object.prototype` carries none of those four, and a
`"__proto__"` key becomes an own property rather than polluting), but the parser's
input type is `unknown`, so the guarantee rests on the caller.

**Fix:** Narrow the claim to what the code does — "the record is never spread, so
no key beyond the four named ones reaches the result" — or read the four through
`Object.hasOwn(raw, key) ? raw[key] : undefined` and keep the stronger sentence.

### IN-04: A user-visible behavior change with no CHANGELOG entry

**File:** `extensions/pi-claude-marketplace/domain/manifest-path.ts:25-29`, `CHANGELOG.md`

**Issue:** `manifest-path.ts`'s own stability contract says a change to which
manifest describes a plugin "is a user-visible behavior change and needs a
CHANGELOG entry." This phase makes the bare `plugin.json` readable for the first
time, which changes resolved versions, `defaultEnabled`, and `componentPaths` for
real plugins in the wild. `CHANGELOG.md`, `package.json` and
`sonar-project.properties` are untouched in the diff.

**Fix:** Per `CLAUDE.md`'s versioning rule this is a pre-PR step, so it is not
blocking. Record it before the PR is opened.

---

_Reviewed: 2026-09-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
