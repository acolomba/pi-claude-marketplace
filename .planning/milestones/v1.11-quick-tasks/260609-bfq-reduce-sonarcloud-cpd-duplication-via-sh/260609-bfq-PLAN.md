---
phase: quick-260609-bfq
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - package.json
  - sonar-project.properties
  - package-lock.json
  - CHANGELOG.md
autonomous: true
requirements: [NFR-6]

must_haves:
  truths:
    - "npm run check stays green after every one of the 5 commits"
    - "catalog-uat + notify-v2 byte-form tests pass unchanged (output byte-identical)"
    - "no public API, output, or behavior change — strictly internal helper extraction"
    - "each refactor + the version bump is its own atomic Conventional-Commits commit, in order"
    - "version reads 0.4.3 across package.json, sonar-project.properties, package-lock.json"
  artifacts:
    - path: "extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts"
      provides: "parseMapModelArgs shared arg-parse helper"
      contains: "parseMapModelArgs"
    - path: "extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts"
      provides: "makeSingleNameMarketplaceHandler factory"
      contains: "makeSingleNameMarketplaceHandler"
    - path: "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
      provides: "resolveScopeOrNotifyNotAdded lifted shared helper"
      contains: "resolveScopeOrNotifyNotAdded"
    - path: "extensions/pi-claude-marketplace/shared/notify.ts"
      provides: "pluginRow local helper folding 4 identical switch arms"
      contains: "pluginRow"
    - path: "CHANGELOG.md"
      provides: "0.4.3 changelog entry"
      contains: "0.4.3"
  key_links:
    - from: "edge/handlers/plugin/install.ts"
      to: "parseMapModelArgs"
      via: "import from ./shared.ts"
      pattern: "parseMapModelArgs"
    - from: "orchestrators/marketplace/update.ts"
      to: "resolveScopeOrNotifyNotAdded"
      via: "import from ./shared.ts"
      pattern: "resolveScopeOrNotifyNotAdded"
---

<objective>
Reduce SonarCloud CPD (copy-paste) duplication by extracting four shared helpers
(plugin edge-handler arg-parse boilerplate, single-name marketplace edge
handlers, the marketplace orchestrator `resolveScopeOrNotifyNotAdded` function,
and the notify.ts plugin-row switch arms), then bump the patch version
0.4.2 → 0.4.3.

This is a STRICTLY BYTE-NEUTRAL refactor: no output, behavior, or public-API
change. The existing byte-form regression tests are the gate
(`tests/architecture/catalog-uat.test.ts`, `tests/shared/notify-v2.test.ts`).
`npm run check` (typecheck + ESLint + Prettier + unit + integration) MUST pass
after every commit. Each of the 5 items is its OWN atomic commit using
Conventional Commits, body lines ≤ 80 chars.

Purpose: Lower the CPD percentage SonarCloud reports without touching
`sonar.cpd.exclusions` and without altering any user-visible surface (NFR-6).
Output: Four extracted helpers + thin call-site rewrites, plus a patch version
bump and CHANGELOG entry. Five commits.

OUT OF SCOPE (do NOT touch): refactor #4 (the predicate-divergent block between
`resolveCrossScopePluginTarget` and `resolveInstalledMarketplaceTarget` in
`orchestrators/plugin/shared.ts`). Do NOT modify `sonar.cpd.exclusions`.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md

# Edge handlers (commits 1 + 2)
@extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
@extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
@extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
@extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
@extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts

# Orchestrators (commit 3)
@extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts

# Renderer (commit 5)
@extensions/pi-claude-marketplace/shared/notify.ts

# Byte-form gate tests (read to understand what must stay green; do NOT modify)
@tests/architecture/catalog-uat.test.ts
@tests/shared/notify-v2.test.ts
</context>

<commit_policy>
Per ./CLAUDE.md (follow exactly):
- We are already on branch `features/reduce-cpd-duplication`. NEVER commit to `main`.
- Before EACH `git commit`, run `pre-commit run --files <changed files>` (or
  `pre-commit run --all-files`). Fix failures, restage, re-run until clean. A
  failed hook means the commit did NOT happen — do NOT `--amend` to recover.
- NEVER use `--no-verify`.
- Conventional Commits. Title 5–72 chars. Body lines ≤ 80 chars.
- Five separate atomic commits, IN ORDER (refactor 1 → 2 → 3 → 5 → version bump).
  Do not squash; each commit must independently leave `npm run check` green.
- The byte-form gate for every refactor commit is that
  `tests/architecture/catalog-uat.test.ts` and `tests/shared/notify-v2.test.ts`
  pass UNCHANGED (output byte-identical) — not merely that the code compiles.
</commit_policy>

<tasks>

<task type="auto">
  <name>Task 1 — refactor: plugin edge-handler arg-parse boilerplate</name>
  <files>
    extensions/pi-claude-marketplace/edge/handlers/plugin/shared.ts
    extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
    extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts
  </files>
  <action>
install.ts and update.ts share the identical opening sequence: a `try { parsed =
parseArgs(args) } catch (err) { notifyUsageError(ctx, { message:
errorMessage(err), usage: USAGE }); return; }`, then `const flagged =
parsePositionalsWithFlags(parsed.positional, ctx, USAGE)` with an `=== undefined`
return-guard, then `const { nonFlagPositionals, mapModel } = flagged`.

Extract this into a new exported helper in edge/handlers/plugin/shared.ts
(alongside `parsePositionalsWithFlags` / `splitPluginMarketplaceRef`):
`parseMapModelArgs(args: string, ctx: ExtensionCommandContext, usage: string):
{ scope?: Scope; nonFlagPositionals: string[]; mapModel: boolean } | undefined`.
It performs the parseArgs try/catch (notifying via `notifyUsageError` with
`errorMessage(err)` on failure), then the `parsePositionalsWithFlags` call with
its undefined-guard, and returns `undefined` whenever an error has ALREADY been
notified (either parse failure or unknown-flag from parsePositionalsWithFlags).
On success it returns the destructured `{ nonFlagPositionals, mapModel }` plus
`parsed.scope` carried out via `...(parsed.scope !== undefined && { scope:
parsed.scope })` so the optional-property contract matches `parsed.scope`'s
`Scope | undefined` shape under TS strict.

Import the needed symbols into shared.ts: `parseArgs` from `../../args.ts`,
`errorMessage` from `../../../shared/errors.ts` (notifyUsageError is already
imported there). Return type uses the existing `Scope` type import.

Rewrite install.ts: replace its opening parse block with `const flagged =
parseMapModelArgs(args, ctx, USAGE); if (flagged === undefined) return; const {
nonFlagPositionals, mapModel } = flagged;` then KEEP its distinct post-parse
logic verbatim (the `nonFlagPositionals.length !== 1` exactly-one-ref guard, the
`splitPluginMarketplaceRef` ref guard, and the `installPlugin({...})` call). The
install call reads `parsed.scope ?? "user"`; after the refactor it reads
`flagged.scope ?? "user"` — same value, since the helper carries scope through.

Rewrite update.ts identically for the opening block, then KEEP its distinct
post-parse logic verbatim (the `nonFlagPositionals.length > 1` too-many guard,
the all / `@<marketplace>` / `<plugin>@<marketplace>` target-form branching, and
the `updatePlugins({...})` call). The update call's `...(parsed.scope !==
undefined && { scope: parsed.scope })` becomes `...(flagged.scope !== undefined
&& { scope: flagged.scope })`.

Both handlers drop their now-unused direct imports of `parseArgs`,
`errorMessage`, and `notifyUsageError` IF those symbols are no longer referenced
in the file after the rewrite (install/update still import
`splitPluginMarketplaceRef`; update still uses it; install still uses
`notifyUsageError` for its post-parse guards, so KEEP notifyUsageError +
splitPluginMarketplaceRef in install; check each import against actual remaining
usage and let ESLint `import-x`/`no-unused-vars` confirm). Behavior, notified
strings, and the install/update USAGE constants stay byte-identical.
  </action>
  <verify>
    <automated>npm run typecheck && npm run lint && npm run format:check && node --test "tests/edge/**/*.test.ts" "tests/architecture/catalog-uat.test.ts"</automated>
  </verify>
  <done>
parseMapModelArgs exists in plugin/shared.ts and is called by both install.ts
and update.ts; the duplicated parse-block is gone from both handlers; their
post-parse logic is unchanged; typecheck/lint/format/edge+catalog-uat tests
green. Then run `pre-commit run --files <changed>`, restage, and commit as
`refactor: extract plugin edge-handler arg-parse boilerplate` (body explains the
parseMapModelArgs extraction, ≤ 80-char lines).
  </done>
</task>

<task type="auto">
  <name>Task 2 — refactor: single-name marketplace edge handlers</name>
  <files>
    extensions/pi-claude-marketplace/edge/handlers/marketplace/shared.ts
    extensions/pi-claude-marketplace/edge/handlers/marketplace/info.ts
    extensions/pi-claude-marketplace/edge/handlers/marketplace/remove.ts
  </files>
  <action>
info.ts and remove.ts are identical except (a) the USAGE string and (b) which
orchestrator they delegate to (`getMarketplaceInfo` vs `removeMarketplace`),
both invoked as `{ ctx, pi, name: parsed.name, cwd: ctx.cwd, ...(parsed.scope
!== undefined && { scope: parsed.scope }) }`. Both perform the same
`parseCommandArgs(args, { positional: [{ name: "name" }] as const, usage:
USAGE }, (message) => notifyUsageError(ctx, { message: message === USAGE ?
"Missing required argument." : message, usage: USAGE }))` parse + the `===
undefined` guard.

Create a NEW file edge/handlers/marketplace/shared.ts exporting a factory
`makeSingleNameMarketplaceHandler(pi, usage, run)` where:
- `pi: ExtensionAPI`,
- `usage: string`,
- `run` is the delegate, typed to structurally accept `{ ctx:
  ExtensionCommandContext; pi: ExtensionAPI; name: string; cwd: string; scope?:
  Scope } => Promise<void>`. Confirm BOTH `GetMarketplaceInfoOptions`
  (orchestrators/marketplace/info.ts) and `RemoveMarketplaceOptions`
  (orchestrators/marketplace/remove.ts) structurally satisfy this param shape —
  GetMarketplaceInfoOptions is `{ ctx, pi, name, scope?, cwd }` (exact match);
  RemoveMarketplaceOptions is the same plus an OPTIONAL `cascade?`, which a
  caller omitting `cascade` satisfies. Type the `run` param so the factory's
  returned handler builds the options object with `{ ctx, pi, name: parsed.name,
  cwd: ctx.cwd, ...(parsed.scope !== undefined && { scope: parsed.scope }) }`.

The factory returns `(args, ctx) => Promise<void>` performing the
parseCommandArgs single-`name`-positional parse + the `message === usage ?
"Missing required argument." : message` error callback + the `=== undefined`
guard + `await run({...})`. Import `notifyUsageError` from
`../../../shared/notify.ts`, `parseCommandArgs` from `../../args-schema.ts`, and
the `ExtensionAPI`, `ExtensionCommandContext`, `Scope` types.

Rewrite makeMarketplaceInfoHandler / makeRemoveHandler as thin wrappers:
`export function makeMarketplaceInfoHandler(pi) { return
makeSingleNameMarketplaceHandler(pi, USAGE, getMarketplaceInfo); }` and
likewise for remove with `removeMarketplace`. Each handler file KEEPS its own
USAGE constant and its existing header-comment rationale verbatim (info's `{not
added}` carve-out note; remove's `rm`-alias note + the `removeMarketplace`
requires-`pi` RH-5 note). info.ts/remove.ts drop their now-unused
`parseCommandArgs` and `notifyUsageError` imports (the factory owns them);
verify via ESLint. Notified strings, USAGE byte values, and delegate behavior
stay byte-identical.
  </action>
  <verify>
    <automated>npm run typecheck && npm run lint && npm run format:check && node --test "tests/edge/**/*.test.ts" "tests/architecture/catalog-uat.test.ts"</automated>
  </verify>
  <done>
edge/handlers/marketplace/shared.ts exists with
`makeSingleNameMarketplaceHandler`; makeMarketplaceInfoHandler and
makeRemoveHandler are thin wrappers over it; each handler's header rationale
comment is preserved; USAGE strings unchanged; typecheck/lint/format/edge+
catalog-uat tests green. Then run `pre-commit run --files <changed>`, restage,
and commit as `refactor: extract single-name marketplace edge handler factory`
(≤ 80-char body lines).
  </done>
</task>

<task type="auto">
  <name>Task 3 — refactor (top priority): lift resolveScopeOrNotifyNotAdded</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
    extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  </files>
  <action>
The ~33-line `resolveScopeOrNotifyNotAdded` function is duplicated near-verbatim
in orchestrators/marketplace/update.ts (lines ~225-259) and remove.ts (lines
~180-212); only the `opts` type and a couple of comments differ. Body: the
bare-form path (`opts.scope === undefined`) calls `resolveScopeFromState`,
catching `MarketplaceNotFoundError` to emit `notify(opts.ctx, opts.pi, { kind:
"marketplace-not-added", name: opts.name })` and return undefined (re-throwing
any other error); the explicit-scope path does a `loadState` pre-guard read and
emits `notify(... { kind: "marketplace-not-added", name: opts.name, scope:
opts.scope })` when the record is absent; otherwise returns `{ scope, locations
}`.

Lift it into orchestrators/marketplace/shared.ts (already the home of
`resolveScopeFromState`) as an exported async function. Change its signature to
take the structural subset instead of the per-caller opts type:
`resolveScopeOrNotifyNotAdded(opts: { ctx: ExtensionContext; pi: ExtensionAPI;
name: string; scope?: Scope }, userLocations: ScopedLocations, projectLocations:
ScopedLocations): Promise<{ scope: Scope; locations: ScopedLocations } |
undefined>`. Verify BOTH `UpdateMarketplaceOptions` and
`RemoveMarketplaceOptions` satisfy that structural subset (both carry `ctx: …
ExtensionContext`, `pi: ExtensionAPI`, `name: string`, `scope?: Scope` — they
do; the extra fields on each are irrelevant to the subset).

shared.ts needs these imports added (check what is already imported there —
`loadState` and `MarketplaceNotFoundError` are already imported;
`resolveScopeFromState` is defined in-file): add `notify` from
`../../shared/notify.ts` and the types `ExtensionContext`, `ExtensionAPI` from
`../../platform/pi-api.ts`. `ScopedLocations` and `Scope` types are already
imported. Consolidate the rationale comment (the ATTR-06 / D-48-C Shape 1 /
NFR-5 / bracket-discipline block) onto the lifted helper — keep the substantive
comment, drop per-file `mirrors remove.ts` / `mirrors update.ts` cross-refs that
no longer apply.

In update.ts: DELETE the local `resolveScopeOrNotifyNotAdded` function and its
doc comment; import the helper from `./shared.ts`; the existing call site in
`updateMarketplace` (`await resolveScopeOrNotifyNotAdded(opts, userLocations,
projectLocations)`) is unchanged because `opts` (UpdateMarketplaceOptions)
structurally satisfies the subset param. Remove now-unused imports from
update.ts: `MarketplaceNotFoundError` is used ONLY by the deleted function (the
`reasonsFromCascadeError` / refresh paths do not reference it — confirm via grep
before removing) and `loadState` is still used elsewhere in update.ts
(updateAllMarketplaces + snapshot pre-guard? confirm) — only remove imports
ESLint flags as unused.

In remove.ts: DELETE the local `resolveScopeOrNotifyNotAdded` and its doc
comment; import the helper from `./shared.ts`; the call site in
`removeMarketplace` is unchanged (RemoveMarketplaceOptions satisfies the subset).
Remove imports that become unused (e.g. `MarketplaceNotFoundError` if only the
deleted function used it; confirm via grep — remove.ts still uses `loadState`?
the deleted function used it for the pre-guard; if no other use remains, drop
it). Let ESLint `no-unused-vars` / `import-x` be the authority; do not guess.

CRITICAL: the lifted helper's behavior — the two notify payloads (bare form WITH
NO scope field; explicit-scope form WITH the scope field), the
MarketplaceNotFoundError catch-and-convert, the re-throw of other errors, and the
loadState pre-guard — must be byte-for-byte preserved. The `{not added}` output
is exercised by catalog-uat; both orchestrators' option types and call sites must
still typecheck.
  </action>
  <verify>
    <automated>npm run typecheck && npm run lint && npm run format:check && node --test "tests/orchestrators/**/*.test.ts" "tests/architecture/catalog-uat.test.ts"</automated>
  </verify>
  <done>
`resolveScopeOrNotifyNotAdded` exists once in orchestrators/marketplace/shared.ts
with the structural-subset signature; both update.ts and remove.ts import and
call it; both local copies are DELETED; both option types satisfy the subset and
both files typecheck; the consolidated rationale comment lives on the shared
helper; orchestrator + catalog-uat tests green (the `{not added}` byte form is
unchanged). Then run `pre-commit run --files <changed>`, restage, and commit as
`refactor: lift marketplace resolveScopeOrNotifyNotAdded to shared` (≤ 80-char
body lines).
  </done>
</task>

<task type="auto">
  <name>Task 5 — refactor: notify.ts plugin-row switch arms</name>
  <files>
    extensions/pi-claude-marketplace/shared/notify.ts
  </files>
  <action>
In `renderPluginRow` (shared/notify.ts, switch on `p.status`), the `upgradable`,
`skipped`, `failed`, and `manual recovery` arms are identical except (a) the icon
(`ICON_INSTALLED` for `upgradable`; `ICON_UNINSTALLABLE` for the other three) and
(b) the parenthesized status label (`"(upgradable)"` / `"(skipped)"` /
`"(failed)"` / `"(manual recovery)"`). Each arm is currently:
`return joinTokens([icon, p.name, renderScopeBracket(p.scope, mpScope),
renderVersion(p.version), "(label)", composeReasons(p.reasons, false, false,
probe)]);`

Add a LOCAL, NON-EXPORTED helper near `renderPluginRow` (file-private, same as
`joinTokens` / `renderVersion`):
`function pluginRow(icon: string, p: { name: string; scope?: Scope; version?:
string; reasons: readonly ContentReason[] }, mpScope: Scope, label: string,
probe: SoftDepStatus): string` returning `joinTokens([icon, p.name,
renderScopeBracket(p.scope, mpScope), renderVersion(p.version), label,
composeReasons(p.reasons, false, false, probe)])`. Type the `p` param as the
structural subset the four arms share (name + optional scope + optional version +
required reasons) so each arm's already-narrowed `p` satisfies it; `reasons`
is `readonly ContentReason[]` per those four variants' interfaces. `label` is the
full parenthesized token (caller passes `"(upgradable)"` etc., INCLUDING the
parens), keeping the `"(manual recovery)"` literal WITH ITS SPACE verbatim.

Rewrite the four arms to call it:
- `case "upgradable": return pluginRow(ICON_INSTALLED, p, mpScope,
  "(upgradable)", probe);`
- `case "skipped": return pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(skipped)",
  probe);`
- `case "failed": return pluginRow(ICON_UNINSTALLABLE, p, mpScope, "(failed)",
  probe);`
- `case "manual recovery": return pluginRow(ICON_UNINSTALLABLE, p, mpScope,
  "(manual recovery)", probe);`

LEAVE the `unavailable` arm UNCHANGED — it uses `renderScopeBracket(undefined,
mpScope)` (the MSG-PL-6 / SNM-11 carve-out: `unavailable` has NO `scope?` field
and must NOT pass `p.scope`), so it is NOT byte-equivalent to the four folded
arms and must not be folded in. Do NOT touch the `installed`/`present`/`updated`/
`reinstalled`/`uninstalled`/`available` arms either (different icons, version
forms, dependencies-driven composeReasons, or undefined-scope carve-out). The
`failed.cause` / `manual recovery.cause` trailers and `failed.rollbackPartial`
child rows are composed OUTSIDE renderPluginRow (by `notify`) and are unaffected.

Output MUST stay byte-identical — `tests/architecture/catalog-uat.test.ts` and
`tests/shared/notify-v2.test.ts` are the gate.
  </action>
  <verify>
    <automated>npm run typecheck && npm run lint && npm run format:check && node --test "tests/shared/notify-v2.test.ts" "tests/architecture/catalog-uat.test.ts"</automated>
  </verify>
  <done>
A file-private `pluginRow` helper exists in shared/notify.ts; the `upgradable`,
`skipped`, `failed`, and `manual recovery` arms call it; the `unavailable` arm
and all other arms are untouched; notify-v2 + catalog-uat byte-form tests pass
UNCHANGED (output byte-identical). Then run `pre-commit run --files <changed>`,
restage, and commit as `refactor: fold notify plugin-row switch arms into helper`
(≤ 80-char body lines).
  </done>
</task>

<task type="auto">
  <name>Task 6 (final) — chore: patch version bump 0.4.2 → 0.4.3</name>
  <files>
    package.json
    sonar-project.properties
    package-lock.json
    CHANGELOG.md
  </files>
  <action>
Bump the patch version 0.4.2 → 0.4.3:
- package.json: update the top-level `"version": "0.4.2"` (line ~87) to
  `"0.4.3"`.
- sonar-project.properties: update `sonar.projectVersion=0.4.2` (line ~7) to
  `0.4.3`.
- package-lock.json: update the root `"version": "0.4.2"` (line ~3) AND the
  matching self-referential package entry `"version": "0.4.2"` at the `""`
  package key (line ~9) to `"0.4.3"`. Prefer regenerating via `npm install
  --package-lock-only` after bumping package.json so the lockfile stays
  internally consistent; if editing by hand, change ONLY the two `0.4.2` →
  `0.4.3` version fields and leave everything else untouched. Verify `git diff
  package-lock.json` shows only version-field changes.
- CHANGELOG.md: add a new `## [0.4.3] - 2026-06-09` section at the top (directly
  under the `# Changelog` heading, above the `## [0.4.2]` section), following the
  existing bullet format. One succinct entry: internal refactor — extracted
  shared helpers to cut SonarCloud CPD duplication across the plugin and
  marketplace edge handlers, the marketplace orchestrators, and the notify
  plugin-row renderer; no behavior or output change.

Do NOT touch sonar.cpd.exclusions. This is the LAST commit; it carries no source
changes.
  </action>
  <verify>
    <automated>grep -q '"version": "0.4.3"' package.json && grep -q "sonar.projectVersion=0.4.3" sonar-project.properties && grep -q '0.4.3' CHANGELOG.md && head -5 package-lock.json | grep -q '"version": "0.4.3"' && npm run check</automated>
  </verify>
  <done>
`version` reads `0.4.3` in package.json, sonar-project.properties, and the
package-lock.json root (+ self-entry); CHANGELOG.md has a `## [0.4.3] -
2026-06-09` section in the established format; `git diff package-lock.json`
shows only version fields changed; `npm run check` is fully green. Then run
`pre-commit run --files <changed>`, restage, and commit as `chore: bump version
to 0.4.3` (≤ 80-char body lines).
  </done>
</task>

</tasks>

<verification>
After each of the 5 commits, the relevant gate must be green; after the final
commit, the full `npm run check` (typecheck + lint + format:check + test +
test:integration) must pass. The two byte-form regression suites
(`tests/architecture/catalog-uat.test.ts`, `tests/shared/notify-v2.test.ts`)
must pass UNCHANGED throughout — they prove the refactors are byte-neutral. No
edits to `sonar.cpd.exclusions`. No source changes in the version-bump commit.
</verification>

<success_criteria>
- 5 atomic Conventional-Commits commits exist in order: refactor 1, 2, 3, 5,
  then the chore version bump.
- `parseMapModelArgs` (plugin/shared.ts), `makeSingleNameMarketplaceHandler`
  (marketplace edge shared.ts), `resolveScopeOrNotifyNotAdded` (marketplace
  orchestrator shared.ts), and `pluginRow` (notify.ts) exist and are consumed at
  their respective call sites; the duplicated blocks are gone.
- Output is byte-identical pre/post (catalog-uat + notify-v2 green unchanged).
- Version is 0.4.3 across package.json, sonar-project.properties,
  package-lock.json; CHANGELOG has a 0.4.3 entry.
- `npm run check` green after the final commit. refactor #4 and
  sonar.cpd.exclusions untouched.
</success_criteria>

<output>
Create `.planning/quick/260609-bfq-reduce-sonarcloud-cpd-duplication-via-sh/260609-bfq-SUMMARY.md` when done.
</output>
