# Phase 07: Marketplace-repository tag resolution - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 11 (3 new, 8 modified)
**Analogs found:** 11 / 11 (all tracked-source; RESEARCH.md already carries verified file:line citations, reused here)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/platform/git.ts` (+`listTags`) | utility (git wrapper) | request-response (local fs read) | same file, `listRemoteTags` (lines 331-363) | exact — same file, sibling function |
| NEW `orchestrators/plugin/marketplace-tag-probe.ts` (or equivalent) | service (probe) | CRUD (read-only selection) | `orchestrators/plugin/dependency-tag-probe.ts` (full file) | exact — structural parallel, network→local swap |
| `orchestrators/plugin/install-cascade.ts` (`resolveMemberTagSource`/`probeMemberPin`, `MemberConstraintResolution`) | orchestrator (resolution) | CRUD / event-driven (closure walk) | same file, existing git-backed branch (lines ~210-226, 449-518) | exact — same file, new branch |
| `orchestrators/plugin/clone-cache.ts` (+ materialize-at-tag fn) | service (materialization) | file-I/O | same file, `seedOnePluginMirror` (lines 386-441) + `deriveMarketplaceUrl` (341-373) + `promoteStagingToClone` (82-102) | exact — named in RESEARCH.md as the literal template |
| `orchestrators/plugin/clone-gc.ts` (no new logic, verify `resolvedSha` stamped) | service (GC sweep) | batch | same file, `deriveLiveCloneKeys` (lines 38-54) | exact — existing sweep, no modification needed if contract honored |
| `orchestrators/plugin/install-outcome.ts` (`ResolveContext` construction site) | orchestrator (composition root) | request-response | same file, `resolveGitPluginRoot` wiring (lines 459-475), `deriveInstallVersion` (332-363) | exact — same file, extend existing callback wiring |
| `orchestrators/plugin/install-flow.ts` (pin plumbing) | orchestrator | CRUD | same file, `ledgerOptionsFor` (lines 1443-1458) | exact — zero new code needed per Pattern 4, verify only |
| `domain/plugin-resolver.ts` (`deriveSourcePluginRoot` path branch) | domain (pure resolver) | transform | same file, git-backed branch calling `ctx.resolveGitPluginRoot`; `sourceEscapeReason` (lines 232-247) | role-match — path branch currently uninjectable, git branch is the template |
| `domain/resolver-types.ts` (`ResolveContext`) | model (types) | transform | same file, existing `resolveGitPluginRoot?` field (lines 130-137) | exact — add sibling optional field |
| `orchestrators/plugin/install-cascade.messaging.ts` / `install.messaging.ts` (new row) | service (messaging) | transform | `install.messaging.ts::composePromotedRow` (lines 333-368) | exact — named in RESEARCH.md as the literal shape to mirror |
| `shared/notify-reasons.ts` / `shared/notification-types.ts` (new reason token) | model (closed-set vocabulary) | transform | `shared/notify-reasons.ts`, `"dependency promoted"` entry (lines 296-307) | exact — same closed-set pattern |
| `docs/dependency-resolution.md` (DIVG-01 entry + resolution behavior) | config/docs | — | same file, existing divergence entries (lines 216-230), §"What a version constraint can say" (31-33, 49-64), §path source (92-98) | exact — same file, new paragraph in existing format |

## Pattern Assignments

### `platform/git.ts` (utility, request-response)

**Analog:** same file, `listRemoteTags` (lines 331-363)

**Core pattern** — verified isomorphic-git API [node_modules/isomorphic-git/index.d.ts:2173-2177]:
```typescript
export interface ListTagsOptions {
  dir: string;
}

export async function listTags(opts: ListTagsOptions): Promise<string[]> {
  return git.listTags({ fs, dir: opts.dir });
}
```
Note: unlike `listRemoteTags`, this returns bare name strings (no oid) — each candidate needs a separate `resolveRef({ ref: \`refs/tags/${name}\` })` call to attach an oid, matching `RemoteTag`'s `{name, oid}` shape before handing off to `selectHighestSatisfyingTag`. No `http`/`auth` params (no network).

---

### NEW local tag probe (service, CRUD) — e.g. `orchestrators/plugin/marketplace-tag-probe.ts`

**Analog:** `orchestrators/plugin/dependency-tag-probe.ts` (full file, esp. lines 158-203)

**Core pattern to reuse verbatim:**
- `{name}--v{version}` prefix match + `semver.valid()` gate (dependency-tag-probe.ts:158-176) — reused unchanged, do not re-derive.
- `selectHighestSatisfyingTag` (dependency-tag-probe.ts:186-203) — reused unchanged once fed a local `RemoteTag[]`-shaped list (eager oid resolution recommended per RESEARCH.md Open Question 2).
- Satisfaction test stays in `domain/dependency-range.ts::recordedVersionSatisfies` — do not build a second comparator.

**Anti-pattern (explicit in RESEARCH.md):** do NOT make `dependency-tag-probe.ts` "dual-mode" with an internal `local: boolean` flag — its module header frames it as the network-only leaf exempted from `NETWORK_FREE_TARGETS`. Write a separate sibling module/function instead, kept out of `NETWORK_FREE_TARGETS` the same way (per `tests/architecture/gate-targets.ts`).

---

### `orchestrators/plugin/install-cascade.ts` (orchestrator, CRUD)

**Analog:** same file's existing git-backed constraint-resolution path

**Core pattern — pin shape to reuse unchanged (D-07-02, zero new code elsewhere):**
```typescript
// Source: install-cascade.ts:215, ResolvedCascadeMember.pin
// oid + version folded into one field "so a producer cannot set one without the other"
pin: { oid: tagOid, version: tagVersion }
```

**New non-failure branch (TAGS-02) — critical anti-pattern to avoid:**
`MemberConstraintResolution` is `{ok: true, members} | {ok: false, failure}` (lines 229-231). For a path-source member with NO satisfying tag, the result must be `{kind: "resolved", member}` (member UNCHANGED, no `pin`) — NOT the existing `{kind: "failed", ...}` shape used at lines 501-506 for git-backed `no-matching-tag`. Reusing the failure shape fails the whole cascade (D-03-07 all-or-nothing), which directly contradicts TAGS-02. Attach the "fell back" fact via a side-channel (new optional field on `ResolvedCascadeMember`, e.g. `fellBackToCurrentCopy?: true`, or a parallel list mirroring `CascadeSkippedMember`'s existing out-of-band-fact pattern) — planner's choice, both precedented in-file.

---

### `orchestrators/plugin/clone-cache.ts` (service, file-I/O)

**Analog:** same file, `seedOnePluginMirror` (lines 386-441) — the literal template named by RESEARCH.md

**Core pattern to mirror (copy-then-checkout, avoids the verified index-corruption defect):**
```typescript
// Source: orchestrators/plugin/clone-cache.ts:386-441 (seedOnePluginMirror)
const key = pluginCloneKey(marketplaceUrl, tagOid); // pattern: line 244-246
const dest = await locations.pluginCloneDir(key);
if (await pathExists(dest)) return; // warm cache, line 249-251

const staging = await locations.sourcesStagingDir(randomUUID());
await mkdir(path.dirname(staging), { recursive: true });
await cp(marketplaceRoot, staging, { recursive: true }); // copies .git too, line 256

await gitOps.checkout({ dir: staging, ref: tagOid }); // COPY's own default gitdir, line 261
// on failure: cleanupStaging(ops, staging, ...) — line 262-266

await mkdir(path.dirname(dest), { recursive: true });
await rename(staging, dest); // atomic promote, line 269-271 (or reuse promoteStagingToClone, 82-102)
```

**Critical difference from the `seedOnePluginMirror` precedent (both must be honored):**
1. This must be a first-class INSTALL step — failure propagates to the install, unlike `seedSameRepoPluginMirrors`'s swallow-and-skip (clone-cache.ts:511-514).
2. Needs subdir handling: reuse `resolveGitPluginRootWithSubdir`'s containment logic (clone-cache.ts:594-609) against the new checked-out copy's root — do not re-derive a second containment check.

**Anti-pattern (verified against installed isomorphic-git source, node_modules/isomorphic-git/index.cjs:1073,7286-7313,7957-7991):** do NOT call `checkout({ dir: newKeyedDir, gitdir: marketplaceClone/.git, ref: tagOid, noUpdateHead: true })`. `noUpdateHead` only gates the HEAD/ref write, not the index read/write at `${gitdir}/index` — pointing `gitdir` at the marketplace clone's real `.git` silently corrupts the marketplace clone's own index. Copy-then-checkout-in-the-copy avoids this entirely.

`deriveMarketplaceUrl` (lines 341-373) is reused unchanged for the key's URL half (handles both github/url marketplaces and path-marketplaces reading their own `.git/config` origin, fs-only).

---

### `orchestrators/plugin/clone-gc.ts` (no new logic — verify only)

**Analog:** same file, `deriveLiveCloneKeys` (lines 38-54)

**Critical pitfall:** `deriveLiveCloneKeys` ONLY protects a `plugin-clones/<key>/` dir when `record.resolvedSha !== undefined` (line 42). The new resolver injection point (below) MUST return `resolvedSha = tagOid` alongside `pluginRoot`, exactly like `resolveGitPluginRootWithSubdir` already does for git-backed sources. Missing this means the new directory is swept on the very next unrelated `uninstall`/`update`/`marketplace remove` in the same scope — a live data-loss bug, not a theoretical one.

---

### `orchestrators/plugin/install-outcome.ts` (orchestrator, composition root)

**Analog:** same file, existing `resolveGitPluginRoot` wiring (lines 459-475)

**Core pattern to extend:**
```typescript
// Source: install-outcome.ts:459-475
const resolved = await resolveStrict(entry, {
  marketplaceRoot: sourceMp.marketplaceRoot,
  resolveGitPluginRoot: async (gitSource) => {
    const clone = await (opts.cloneProbe ?? probeInstallClone)({
      source:
        opts.sourcePinOverride === undefined
          ? gitSource
          : { ...gitSource, sha: opts.sourcePinOverride },
      // ...
```
`opts.sourcePinOverride` and `sourceMp.marketplaceRoot` are ALREADY in scope at this call site — the new path-materialization callback needs zero new plumbing through `InstallLedgerOptions`.

**D-07-02 version recording — already free, verify not duplicate:**
```typescript
// Source: install-outcome.ts:346-363, deriveInstallVersion
if (args.pinVersionOverride !== undefined) {
  return args.pinVersionOverride; // satisfies D-07-02 automatically once pin.version is attached in install-cascade.ts
}
```

---

### `orchestrators/plugin/install-flow.ts` (verify only, no new code expected)

**Analog:** same file, `ledgerOptionsFor` (lines 1443-1458)
```typescript
// Source: install-flow.ts:1443-1458 — already handles ANY member with a `pin`, regardless of source kind
ledgerOptionsFor: (member) => {
  const isRoot = member.key === rootKey;
  const pinVersion = member.pin?.version ?? (isRoot ? opts.pinVersionOverride : undefined);
  return buildInstallLedgerOptions(opts, {
    scope, cwd,
    marketplace: member.marketplace,
    plugin: member.name,
    ...(member.pin !== undefined && { sourcePin: member.pin.oid }),
    ...(pinVersion !== undefined && { pinVersion }),
    provenance: isRoot ? "explicit" : "dependency",
  });
},
```
As long as `install-cascade.ts` attaches `pin: { oid, version }` to a path-source `ResolvedCascadeMember` the same way it does for git-backed ones, this file requires no changes.

---

### `domain/plugin-resolver.ts` (domain, transform)

**Analog:** same file's git-backed branch of `deriveSourcePluginRoot` (calls `ctx.resolveGitPluginRoot`); containment check `sourceEscapeReason` (lines 232-247)

**Current uninjectable state (lines 382-431):**
```typescript
// path branch, line 391 — unconditional today, no injection point
path.resolve(marketplaceRoot, parsedSource.raw)
```

**Two viable shapes (planner's explicit choice per RESEARCH.md, both legitimate):**
1. Widen `resolveGitPluginRoot`'s param to `SupportedParsedSource` (union at plugin-resolver.ts:192, includes `PathSource`) + a new `ResolveContext` signal field for "this install has a pin."
2. New dedicated field: `resolvePathPluginRoot?: (source: PathSource, pin: string) => Promise<GitPluginRootResult>`, called only when both callback and pin are present, falling through to existing `marketplaceRoot + raw` otherwise. RESEARCH.md recommends this option (more type-safe, no widening of an existing contract).

**Security pitfall:** `sourceEscapeReason`'s containment check MUST be re-run against the NEW checked-out root, not the live marketplace root — escape-checking is a property of the (root, relative-path) pair, and the root changes for a pinned install.

---

### `domain/resolver-types.ts` (model, transform)

**Analog:** same file, existing callback field
```typescript
// Source: domain/resolver-types.ts:130-137 — current shape
export interface ResolveContext {
  readonly marketplaceRoot: string;
  readonly readFileText?: (path: string) => Promise<string>;
  readonly statKind?: StatKindReader;
  readonly resolveGitPluginRoot?: (
    source: UrlSource | GitSubdirSource | GitHubSource,
  ) => Promise<GitPluginRootResult>;
}
```
Add the new field as OPTIONAL (per Assumption A3: `list`/`info` callers construct `ResolveContext` without it and must keep compiling unchanged).

---

### Row/messaging (`install.messaging.ts` / `install-cascade.messaging.ts`) (service, transform)

**Analog:** `install.messaging.ts::composePromotedRow` (lines 333-368) — the literal shape to mirror

**Core pattern:**
```typescript
// Source: install.messaging.ts:333-368 (composePromotedRow)
return {
  status: "installed",
  name: args.plugin,
  version: args.version,
  scope: args.scope,
  dependencies: [],
  reasons: [/* the new token */],
  severity: "info",   // literal, NOT derived from skipSeverity (that only classifies skipped rows)
  needsReload: args.needsReload,
};
```

---

### `shared/notify-reasons.ts` / `shared/notification-types.ts` (model, closed-set vocabulary)

**Analog:** `"dependency promoted"` entry (notify-reasons.ts:296-307)
```typescript
// Source: shared/notify-reasons.ts:296-307
  | "dependency disabled"
  // D-04-07: install's marker for a recorded dependency the user then named.
  // ...
  | "dependency promoted"
```
New token (exact wording is Claude's Discretion per D-07-03, e.g. `"dependency current copy"`) joins the same `CommandPrivateReason` union. Must ALSO be added to the closed `REASONS` tuple in `shared/notification-types.ts` and to `docs/output-catalog.md` — both gated by `tests/architecture/notify-closed-set-locks.test.ts` and COMPAT-01's catalog byte-count/no-expansion checks. This is a deliberate, documented amendment, following the pattern the file's own header comments describe for every prior addition — not a silent append.

**Anti-pattern:** do NOT reuse `{no matching version}` (the existing `FailureReason`, notify-reasons.ts:146-180) for TAGS-02's outcome — it is typed/documented as a FAILED-row reason; TAGS-02 is a SUCCESSFUL install with an info note.

---

### `docs/dependency-resolution.md` (docs)

**Analog:** existing divergence entries (lines 216-230) for format; §"What a version constraint can say" (31-33, 49-64) and §path source (92-98) for the resolution-behavior update

Follow the existing divergence-entry format verbatim for DIVG-01 (upstream accepts a `sha` field on a dependency element; this extension refuses it, D-03-36) — no review requested before committing (Claude's Discretion). Update line 96's current text ("A `path` source has no tag list at all... reports `{no matching version}` for every constraint except the wildcard") to describe the new local-tag-resolution + fallback behavior.

## Shared Patterns

### Version/tag selection logic (single evaluator)
**Source:** `domain/dependency-range.ts::recordedVersionSatisfies`, `semver`'s `gt`/`valid`, and `dependency-tag-probe.ts::selectHighestSatisfyingTag` (lines 186-203)
**Apply to:** the new local tag probe — reuse unchanged, do not build a second comparator (explicit project principle, dependency-tag-probe.ts:184-185).

### Copy-then-checkout materialization (never shared-gitdir)
**Source:** `clone-cache.ts::seedOnePluginMirror` (lines 386-441)
**Apply to:** any new same-repository-at-a-different-ref materialization (TAGS-03). Never point `gitdir` at a clone that must stay untouched — verified isomorphic-git defect (index write happens regardless of `noUpdateHead`).

### `resolvedSha` stamping discipline
**Source:** `clone-gc.ts::deriveLiveCloneKeys` (lines 38-54), `clone-cache.ts::resolveGitPluginRootWithSubdir` (lines 594-609)
**Apply to:** every new code path that materializes into `plugin-clones/<key>/` — must set `resolvedSha` on the install record or GC will delete it on the next unrelated install-family command in scope.

### Closed-set reason tokens
**Source:** `shared/notify-reasons.ts` (full file), `shared/notification-types.ts`
**Apply to:** any new row-level fact (TAGS-02's fallback note) — must be added to the `REASONS` tuple, `docs/output-catalog.md`, and pass `tests/architecture/notify-closed-set-locks.test.ts`; never repurpose an existing token whose severity/status class doesn't match.

## No Analog Found

None — RESEARCH.md's own conclusion (confirmed here): every piece this phase needs, except the local `listTags` wrapper itself and the constraint-resolution branching, already has a direct in-codebase analog built for a structurally adjacent problem (SEED-* same-repo mirroring, RESV-03 tag-pin recording).

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{platform,orchestrators/plugin,domain,shared}/`, `docs/`
**Files scanned:** 13 (all verified git-tracked via `git ls-files`)
**Pattern extraction date:** 2026-09-19
**Source note:** Code excerpts and file:line citations are carried forward from RESEARCH.md, which verified them directly this session against the installed `isomorphic-git` package source and the repository's own tracked files; not independently re-read in this pass to avoid duplicate token spend on unchanged content.
