# Phase 10: Constraint-aware update - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 9 (2 new, 7 modified)
**Analogs found:** 9 / 9

This phase is a citation job, not an invention job — RESEARCH.md already carries
file:line-verified excerpts for every seam. This file re-verifies those excerpts
against the current tree (same-session `Read`) and lays new-file-vs-analog side
by side for the planner.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `orchestrators/plugin/<constraint-gate-leaf>.ts` (NEW) | service (orchestrator leaf) | request-response (probe + decode) | `orchestrators/plugin/install-clone-probe.ts` (composition shape) + `orchestrators/reconcile/dependency-verdict.ts` (inversion/fold logic) + `orchestrators/plugin/install-cascade.ts` (tag-probe decode) | exact (composite of 3 exact sub-patterns) |
| `tests/orchestrators/plugin/<constraint-gate-leaf>.test.ts` (NEW) | test | request-response | `tests/orchestrators/plugin/dependency-tag-probe.test.ts`, `marketplace-tag-probe.test.ts` | exact |
| `orchestrators/plugin/update-preflight.ts` (MOD) | orchestrator | request-response | itself — extend `preparePluginUpdate`, `resolveUpdateCandidate`, `deriveUpdateToVersion` | exact (self-analog; install-side is the shape to import) |
| `shared/notification-types.ts` (MOD) | model (message types) | transform | itself — `PluginDisabledMessage.cause` is the field-shape precedent | exact |
| `shared/notification-grammar.ts` (MOD) | utility (renderer) | transform | itself — `composePluginLinesWith`'s status gate | exact |
| `shared/notify-reasons.ts` (MOD) | config (closed-set header) | transform | itself — header count bump, mechanical | exact |
| `docs/output-catalog.md`, `docs/dependency-resolution.md` | docs | — | existing prose sections cited below | exact |
| `tests/architecture/catalog-uat/fixtures/plugin-update.ts` + contract/parser tests | test (fixture) | transform | existing fixture rows in the same file | exact |

## Pattern Assignments

### `orchestrators/plugin/<constraint-gate-leaf>.ts` (NEW — orchestrator leaf, request-response)

Composite of three exact precedents. Do not invent a fourth shape for any of
these three sub-problems — cite and copy.

**A. Composition shape — copy from `orchestrators/plugin/install-clone-probe.ts:1-40`:**
```typescript
import { canonicalCloneUrl } from "../../domain/clone-key.ts";
import { buildCloneAuth } from "../auth-host.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolveGitPluginRootWithSubdir,
  resolvePluginPin,
} from "./clone-cache.ts";
import type { GitPluginRootResult } from "../../domain/resolver-types.ts";
import type { GitBackedSource } from "../../domain/source.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { AuthAttemptResult, CredentialOps, DeviceFlowHttp } from "../auth-host.ts";

/** Clone-cache operations used to materialize an install source. */
export interface InstallCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

export interface InstallCloneProbeOptions {
  readonly source: GitBackedSource;
  readonly locations: ScopedLocations;
  readonly seam?: InstallCloneCacheSeam;
  readonly auth: {
    readonly ctx: NotificationContext;
    readonly credentialOps: CredentialOps;
    readonly deviceFlowHttp?: DeviceFlowHttp;
    readonly authMemo?: Map<string, AuthAttemptResult>;
  };
}

const REAL_INSTALL_CLONE_CACHE_SEAM: InstallCloneCacheSeam = {
  resolvePluginPin,
  materializePluginClone,
  materializeOrRefreshPluginMirror,
};

export async function probeInstallClone(options: InstallCloneProbeOptions): Promise<{
  readonly result: GitPluginRootResult;
  readonly resolvedSha: string | undefined;
}> {
  const seam = options.seam ?? REAL_INSTALL_CLONE_CACHE_SEAM;
  // ...
}
```
`update-preflight.ts` already has the identical shape wired for its own clone
seam (`UpdateCloneCacheSeam` at line 50, `cloneCacheSeam?:` field at line 64/92,
default-object literal at `preparePluginUpdate` lines 566-570 — see below). The
new leaf's own injected field on `PreparePluginUpdateOptions` should sit right
beside `cloneCacheSeam`, defaulted the same way (`options.<field> ?? default`).

**B. Inversion of `buildScopeDeclarationDetail` — copy the fold shape from
`orchestrators/reconcile/dependency-verdict.ts:157-183`** (D-10-04's exact model,
just keyed the opposite direction — by the DECLARED key, collecting DECLARERS,
not by declarer collecting what it declares):
```typescript
/** Every `name@marketplace` key the scope records, with its recorded facts. */
function recordedPlugins(state: ExtensionState): ReadonlyMap<string, RecordedPlugin> {
  const recorded = new Map<string, RecordedPlugin>();
  for (const marketplace of Object.values(state.marketplaces)) {
    for (const [name, record] of Object.entries(marketplace.plugins)) {
      recorded.set(`${name}@${marketplace.name}`, {
        disabled: isDisabledIndependently(record),
        version: record.version,
      });
    }
  }
  return recorded;
}

function constraintsByKey(
  declared: readonly AddressedDependency[],
): ReadonlyMap<string, readonly string[]> {
  const byKey = new Map<string, string[]>();
  for (const dependency of declared) {
    const key = `${dependency.name}@${dependency.marketplace}`;
    const ranges = byKey.get(key) ?? [];
    if (dependency.version !== undefined) {
      ranges.push(dependency.version);
    }
    byKey.set(key, ranges);
  }
  return byKey;
}
```
The leaf calls `buildScopeDeclarationDetail({ state, locations })` (no
`exclude` — see focus item 4 below) exactly the way
`buildScopeSatisfactionVerdict` does at `dependency-verdict.ts:311`, then walks
`declarations` (a `ReadonlyMap<declarerKey, readonly AddressedDependency[]>`)
filtering each declarer's entries down to `${dep.name}@${dep.marketplace} ===`
the TARGET plugin's key, and separately looks up each surviving declarer's
`enabled` bit off `state.marketplaces[mp]?.plugins[name]?.enabled` (no
`enabled` bit rides inside `AddressedDependency` itself) the same way
`recordedPlugins` above builds its own sidecar map alongside the declarations
walk.

**C. Three-way tag-probe decode — copy from `install-cascade.ts:611-659`:**
```typescript
type MemberTagSource =
  | { readonly kind: "git"; readonly source: GitBackedSource }
  | { readonly kind: "path"; readonly marketplaceRoot: string }
  | { readonly kind: "absent" };

async function resolveMemberTagSource(
  options: MemberConstraintOptions,
  member: ClosureMember,
): Promise<MemberTagSource> {
  const lookup =
    options.marketplaceRecordFor ??
    ((marketplace: string) => Promise.resolve(options.state.marketplaces[marketplace]));
  const record = await lookup(member.marketplace);
  if (record === undefined) return { kind: "absent" };

  const manifest = await loadMarketplaceManifest(record.manifestPath);
  const declared = lookupDeclaredPlugin(manifest, member.name);
  if (declared.kind === "absent") return { kind: "absent" };

  const parsed = parsePluginSource(declared.entry.source);
  if (parsed.kind === "url" || parsed.kind === "git-subdir" || parsed.kind === "github") {
    return { kind: "git", source: parsed };
  }
  if (parsed.kind === "path") {
    return { kind: "path", marketplaceRoot: record.marketplaceRoot };
  }
  return { kind: "absent" };
}

type MemberConstraintOutcome =
  | { readonly kind: "resolved"; readonly member: ResolvedCascadeMember }
  | { readonly kind: "failed"; readonly failure: CascadeConstraintFailure };

function toMemberConstraintOutcome(
  member: ClosureMember,
  range: string,
  probed:
    | { readonly kind: "pinned"; readonly oid: string; readonly version: string }
    | { readonly kind: "no-matching-tag"; readonly range: string }
    | { readonly kind: "tag-listing-failed"; readonly classification: DependencyTagListingFailureReason },
): MemberConstraintOutcome {
  if (probed.kind === "pinned") {
    return { kind: "resolved", member: { ...member, pin: { oid: probed.oid, version: probed.version } } };
  }
  if (probed.kind === "no-matching-tag") {
    return { kind: "failed", failure: { kind: "no-matching-tag", key: member.key, range: probed.range } };
  }
  return {
    kind: "failed",
    failure: { kind: "tag-listing-failed", key: member.key, range: renderConstraintRange(range), classification: probed.classification },
  };
}
```
Both `dependency-tag-probe.ts::probeDependencyTags` (git) and
`marketplace-tag-probe.ts::probeMarketplaceTags` (path) converge on the same
`SelectedReleaseTag`-shaped result (`domain/release-tag.ts:46-53`,
`pinned | no-matching-tag`, git's probe additionally has `tag-listing-failed`),
so this ONE decode function serves both source kinds — do not write it twice.

**D. Range fold — call, do not reimplement:**
`domain/dependency-range.ts::intersectDependencyRanges` is the one place
"what do N declared ranges come to" is answered; it already caps input size
(4096 chars) and projected conjuncts (1024) before parsing. Calling `semver`
directly from the new leaf loses both caps.

**E. Highest-satisfying-tag selection — call, do not reimplement:**
`domain/release-tag.ts::selectHighestSatisfyingTag(candidates, prefix, range)`
is what both existing probes end in.

---

### `tests/orchestrators/plugin/<constraint-gate-leaf>.test.ts` (NEW — test)

**Analog:** `tests/orchestrators/plugin/dependency-tag-probe.test.ts:1-45`
```typescript
import assert from "node:assert/strict";
import test from "node:test";

import {
  probeDependencyTags,
  type DependencyTagListingSeam,
  type DependencyTagProbeOptions,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts";

import type { GitBackedSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import type { CredentialOps } from "../../../extensions/pi-claude-marketplace/orchestrators/auth-host.ts";
import type { RemoteTag } from "../../../extensions/pi-claude-marketplace/platform/git.ts";
import type { NotificationContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

const PLUGIN_REPO_URL = "https://example.com/formatter.git";

function auth(): DependencyTagProbeOptions["auth"] {
  const ctx: NotificationContext = { ui: { notify: () => undefined } };
  const credentialOps: CredentialOps = {
    approve: () => Promise.resolve(),
    fill: () => Promise.resolve(null),
    reject: () => Promise.resolve(),
  };
  return { ctx, credentialOps };
}

function pluginSource(): GitBackedSource {
  return { kind: "url", raw: "https://example.com/formatter", url: "https://example.com/formatter" };
}
```
Build a `NotificationContext` + `CredentialOps` stub identically; inject a seam
object (git listing / path listing) as a test double the way
`advertising(tags, queried)` builds `DependencyTagListingSeam` further down the
same file. Pair per `scripts/test-coverage-direct.mjs::sourceToTest`'s
`extensions/.../orchestrators/plugin/<X>.ts` <-> `tests/orchestrators/plugin/<X>.test.ts`
convention — 100% direct coverage is enforced with zero exemption budget
(`scripts/test-coverage-direct.pin.json` has an empty `rows: []`).

---

### `orchestrators/plugin/update-preflight.ts` (MOD — orchestrator, request-response)

**Call site (D-10-03: gate after `triageUpdateMembership`, before
`resolveUpdateCandidate`) — current code, `preparePluginUpdate` lines 541-586:**
```typescript
export async function preparePluginUpdate(
  options: PreparePluginUpdateOptions,
): Promise<PreparedPluginUpdate | UpdatePreflightOutcome> {
  const state = await loadState(options.locations.extensionRoot);
  const marketplace = state.marketplaces[options.marketplace];
  if (marketplace === undefined) { /* ... */ }

  const manifest = await loadMarketplaceManifest(marketplace.manifestPath);
  const triaged = triageUpdateMembership(
    options.plugin,
    marketplace.plugins[options.plugin],
    lookupDeclaredPlugin(manifest, options.plugin),
  );
  if ("partition" in triaged) {
    return triaged;
  }

  // <-- NEW constraint-gate call goes HERE (D-10-03), before makeUpdateCloneProbe
  //     / resolveUpdateCandidate. Held verdict returns straight through as a
  //     `skipped` PluginUpdateSkippedOutcome, matching `skippedCandidate`'s shape.

  const clone = makeUpdateCloneProbe(
    options.cloneCacheSeam ?? { resolvePluginPin, materializePluginClone, materializeOrRefreshPluginMirror },
    options.locations,
    { /* ...auth bundle... */ },
  );
  const candidate = await resolveUpdateCandidate(triaged.entry, marketplace.marketplaceRoot, clone.probe, {
    plugin: options.plugin,
    fromVersion: triaged.record.version,
    partial: options.partial === true || widensPartialGate(triaged.record),
  });
  if ("partition" in candidate) { return candidate; }

  const resolvedSha = clone.resolvedSha();
  const toVersion = await deriveUpdateToVersion(triaged.entry, candidate, resolvedSha);
  // ...
}
```
**Keep the new branching entirely inside the leaf, per Pitfall 5** — ESLint's
`sonarjs/cognitive-complexity` cap of 15 is already near-exhausted on
`preparePluginUpdate` (629-line file). Add ONE `await` + one
`if ("held" in verdict)`-shaped branch here; every git-vs-path decode,
stage-one/stage-two split, and cause-line composition stays inside the new
leaf.

**Focus 1 — `deriveUpdateToVersion` is WRONG for a pinned git source today.
Verbatim current code, `update-preflight.ts:229-240`:**
```typescript
async function deriveUpdateToVersion(
  entry: PluginEntry,
  installable: MaterializablePlugin,
  resolvedSha: string | undefined,
): Promise<string> {
  const kind = parsePluginSource(entry.source).kind;
  if ((kind === "url" || kind === "git-subdir" || kind === "github") && resolvedSha !== undefined) {
    return shaVersion(resolvedSha);
  }

  return resolvePluginVersion(entry, installable);
}
```
`shaVersion` (`domain/version.ts:42-44`) is `"sha-" + fullSha.slice(0, 12)`.
This fires for ANY git-backed source with a resolved sha, whether the sha came
from an ordinary unpinned refresh or from the new stage-one tag pin — it has
no way today to tell the two apart.

**Install-side analog that gets this right** — the pin's own `version` string
travels alongside `oid`/`sha` through the resolver's callback closures, never
through a re-derivation from the sha. `install-outcome.ts:463-509` (excerpted
below in Focus 3) shows the `sourcePinOverride` (an oid/tag string) flowing
into `resolveGitPluginRoot`'s closure; the companion fact — the tag's own
semver — is available on the SAME `SelectedReleaseTag`/`toMemberConstraintOutcome`
result the new leaf already decodes (`{ kind: "pinned", oid, version }`,
Pattern C above). `docs/dependency-resolution.md:94` states the install-side
contract in prose: a tag-pinned dependency "records the version the tag
names, for example `1.2.0`. It does not record a git object name." The fix:
`deriveUpdateToVersion`'s caller must carry the pinned tag's `.version` string
alongside its `oid` and prefer it over `shaVersion(resolvedSha)` whenever
stage one produced a pin, for both the git arm (tag `.version`) and the path
arm (a pinned path source's tag `.version`, or fall through to
`resolvePluginVersion` — already correct there because `installable.pluginRoot`
already points at the pinned tag's materialized tree).

**Focus 3 — pin threading is currently ABSENT on the path arm. Current call
site, `resolveUpdateCandidate`, `update-preflight.ts:250-296`:**
```typescript
async function resolveUpdateCandidate(
  entry: PluginEntry,
  marketplaceRoot: string,
  resolveGitPluginRoot: (source: GitBackedSource) => Promise<GitPluginRootResult>,
  options: { readonly plugin: string; readonly fromVersion: string; readonly partial: boolean },
): Promise<MaterializablePlugin | PluginUpdateSkippedOutcome> {
  try {
    const resolved = await resolveStrict(entry, { marketplaceRoot, resolveGitPluginRoot });
    // NOTE: no `pathPluginPin` / `resolvePathPluginRoot` supplied at all.
    if (options.partial) { requirePartialInstallable(resolved, "update"); }
    else { requireInstallable(resolved, "update"); }
    return resolved;
  } catch (error: unknown) { /* ... */ }
}
```
**Install-side analog with BOTH callbacks wired — copy this shape verbatim,
`install-outcome.ts:463-509`:**
```typescript
const resolved = await resolveStrict(entry, {
  marketplaceRoot: sourceMp.marketplaceRoot,
  resolveGitPluginRoot: async (gitSource) => {
    const clone = await (opts.cloneProbe ?? probeInstallClone)({
      // RESV-03: a pinned dependency materializes the exact commit its
      // release tag resolved to. Overriding `sha` is what routes the probe
      // down its already-pinned arm, so no second materialization path
      // exists for a constrained install.
      source: opts.sourcePinOverride === undefined ? gitSource : { ...gitSource, sha: opts.sourcePinOverride },
      locations,
      ...(opts.cloneCacheSeam !== undefined && { seam: opts.cloneCacheSeam }),
      auth: { ctx: opts.ctx, credentialOps: opts.credentialOps ?? DEFAULT_CREDENTIAL_OPS, /* ... */ },
    });
    resolvedSha = clone.resolvedSha;
    return clone.result;
  },
  // D-07-06 / D-07-07: added ONLY when a pin is present, so an unpinned
  // `path` source stays byte-identical to today (neither field is set at all).
  ...(opts.sourcePinOverride !== undefined && {
    pathPluginPin: opts.sourcePinOverride,
    resolvePathPluginRoot: async (pathSource: PathSource, pin: string) => {
      const result = await (opts.pathPinProbe ?? materializeMarketplaceTagClone)({
        locations, marketplaceRoot: sourceMp.marketplaceRoot,
        marketplaceSource: sourceMp.source, marketplaceName: sourceMp.name,
        pathSource, tagOid: pin,
      });
      if (result.kind === "materialized") { resolvedSha = result.resolvedSha; }
      return result;
    },
  }),
});
```
Both the git and path branches receive the SAME pin string. Copy this
`...(pin !== undefined && { pathPluginPin, resolvePathPluginRoot })` spread
shape exactly — it is what keeps an unconstrained update byte-identical
(success criterion 3's regression proof) by adding NOTHING to the call when
no pin exists.

**Existing seam-composition precedent already in this file to mirror for the
new leaf's own field** — `update-preflight.ts:50-54, 566-570`:
```typescript
export interface UpdateCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}
// ...
const clone = makeUpdateCloneProbe(
  options.cloneCacheSeam ?? { resolvePluginPin, materializePluginClone, materializeOrRefreshPluginMirror },
  options.locations,
  { /* auth */ },
);
```
Add the new leaf's own optional field to `PreparePluginUpdateOptions`
(currently declared at line 85) right beside `cloneCacheSeam` (line 92), same
`options.<field> ?? default` pattern.

**`skippedCandidate` — the existing `skipped`-verdict builder, a third caller
for the held row (`update-preflight.ts:319-333`):**
```typescript
function skippedCandidate(
  options: { readonly plugin: string; readonly fromVersion: string },
  notes: readonly string[],
  reasons: readonly ContentReason[],
): PluginUpdateSkippedOutcome {
  return {
    partition: "skipped",
    name: options.plugin,
    fromVersion: options.fromVersion,
    notes: [...notes],
    reasons: [...reasons],
    declaresAgents: false,
    declaresMcp: false,
  };
}
```
The held-row builder returns the same `PluginUpdateSkippedOutcome` shape; if
`cause` is added it goes on this returned object once
`PluginSkippedMessage.cause` exists (see below).

---

### `shared/notification-types.ts` (MOD — model, transform)

**Focus 2 — the `cause` field precedent to copy verbatim onto
`PluginSkippedMessage`. Current `PluginDisabledMessage`, lines 343-362:**
```typescript
/** Disabled plugin row. */
export interface PluginDisabledMessage extends TransitionMessageBase {
  readonly status: "disabled";
  readonly name: string;
  readonly version?: string;
  readonly scope?: Scope;
  readonly description?: string;
  readonly reasons?: readonly ContentReason[];
  readonly enableHint?: boolean;
  /**
   * LOAD-01: the load-time dependency disable's remedy, naming the dependency
   * and the dependent. It is the ONE thing this field carries: the ordinary
   * toggle disable and the install-disabled cascade both omit it, and their
   * rows stay byte-frozen.
   *
   * It rides the cause chain because the sentence interpolates two plugin
   * identifiers, and the cause chain is the only channel in this grammar that
   * legally interpolates one -- every frozen trailer constant interpolates
   * nothing by contract.
   */
  readonly cause?: Error;
}
```
**Current `PluginSkippedMessage` (no `cause`), lines 452-458:**
```typescript
/** Skipped plugin row. */
export interface PluginSkippedMessage extends MessageBase {
  readonly status: "skipped";
  readonly name: string;
  readonly reasons: readonly ContentReason[];
  readonly version?: string;
  readonly scope?: Scope;
}
```
Add `readonly cause?: Error;` to `PluginSkippedMessage` with a JSDoc comment
on the `PluginDisabledMessage.cause` model above, naming the ONE thing this
field carries (D-10-11's constraining-plugin-naming cause line) and stating
every other `skipped` producer omits it and stays byte-frozen. This is
additive/widening — verify no other producer sets `.cause` before relying on
the empty-string short-circuit (Assumption A1 in RESEARCH.md).

**Also (D-10-09): the `REASONS` tuple / `ContentReason` union gains one new
closed-set token.** Locate the tuple's declaration in this file (adjacent to
existing tokens like `"dependency cycle"`, `"dependents unsatisfied"`) and add
the new token there — this is the D-10-09 checklist's first stop.

---

### `shared/notification-grammar.ts` (MOD — utility/renderer, transform)

**The exact edit site — `composePluginLinesWith`'s status gate, lines
1638-1648 (verbatim, current):**
```typescript
  // LOAD-01: the `disabled` status joins the two failure statuses here because
  // the load-time dependency disable is the one realized transition whose row
  // has to name a remedy, and the remedy interpolates two plugin identifiers.
  // ...
  // LOAD-03: `uninstalled` joins them for the same reason on the opposite side
  // of the outcome. ...
  if (
    p.status === "failed" ||
    p.status === "manual recovery" ||
    p.status === "disabled" ||
    p.status === "uninstalled"
  ) {
    const trailer = renderIndentedCauseChain(p.cause, "    ");
    if (trailer !== "") {
      lines.push(trailer);
    }

    for (const leak of manualRecoveryLeaks(p.cause)) {
      lines.push(`    leaked: ${leak}`);
    }
  }
```
Add `|| p.status === "skipped"` to this condition (per Finding 2 / Pitfall 2).
Add an inline comment on this new arm in the `PluginDisabledMessage.cause` /
`PluginUninstalledMessage.cause` comment style directly above, explaining WHY
`skipped` now interpolates (D-10-11's constraining-plugin naming) so a future
reader does not mistake it for a copy-paste leftover. `manualRecoveryLeaks(p.cause)`
runs unconditionally inside the same block for every status in the gate — verify
it is a no-op for an `Error` with no leaked-credential shape before assuming it
is harmless for the new arm (it already is for `disabled`/`uninstalled`, which
carry ordinary `Error` causes too, so this is expected to be free).

---

### `shared/notify-reasons.ts` (MOD — config, transform)

Mechanical: add the new token to whatever header/count structure enumerates
`REASONS` members (grep the file for the existing `"dependency cycle"` /
`"dependents unsatisfied"` entries as the insertion-point model) and, per
Pitfall 3, do **NOT** add the new token to `IDEMPOTENT_REASON_SET` — leaving it
out is what makes `skipSeverity(reasons)` return `"warning"` on both cascades
for free (D-10-12). Add an inline comment at both `cascadeSkipSeverity`
(`orchestrators/plugin/update-cascade.ts:44-57`) and the autoupdate
`"skipped"` case (`orchestrators/marketplace/update.messaging.ts:187-199`)
stating the new token relies on this default and must never move into the
idempotent set.

---

### `docs/dependency-resolution.md` / `docs/output-catalog.md` (MOD — docs)

- `docs/dependency-resolution.md` §126/§128 ("`reinstall` and `update` never
  promote") needs new prose describing the constraint behaviour; §146's
  fail-closed paragraph (the `{unreadable}` + naming cause line for uninstall)
  is the model for D-10-05's held-row cause line on an unreadable declarer.
  §94 (the git-pin version-recording sentence) is the model sentence for
  Focus 1's fix.
- `docs/output-catalog.md`: the new reason token is a catalog state; state and
  byte counts are pinned by `catalog-contract.test.ts` (currently 222
  states / 30,538 UTF-8 bytes per RESEARCH.md — both constants move together
  with the new fixture row) and `catalog-parser.test.ts`.

---

### `tests/architecture/catalog-uat/fixtures/plugin-update.ts` + contract/parser tests (MOD — test fixture)

Add one new fixture row for the held state (both manual and autoupdate
cascade renderings) beside the existing `plugin-update.ts` fixture rows for
other `skipped` reasons — match the file's existing per-reason fixture-row
shape (read a neighbouring `skipped`-reason row in that file as the literal
template before writing the new one; not excerpted here as fixture content is
plan-specific, but the file's existing rows ARE the pattern to copy verbatim
in shape).

## Shared Patterns

### Leaf-seam composition (applies to the new leaf module)
**Source:** `orchestrators/plugin/install-clone-probe.ts:17-39`,
mirrored already in `update-preflight.ts:50-54,64,92,566-570`
**Apply to:** the new leaf's exported options interface and its
`options.seam ?? REAL_DEFAULT` pattern.

### Closed-set reason-token amendment (D-10-09 checklist)
**Sources:** `shared/notification-types.ts` (REASONS/ContentReason tuple),
`shared/notify-reasons.ts` (header count), `docs/output-catalog.md` (state +
byte counts), `tests/architecture/notify-closed-set-locks.test.ts` (locked
set assertion)
**Apply to:** every file in this phase that touches the new token — all four
must move together in the same change or the catalog/lock tests fail.

### Cause-chain trailer (D-10-11's naming mechanism)
**Source:** `shared/notification-types.ts:343-362` (`PluginDisabledMessage.cause`)
+ `shared/notification-grammar.ts:1638-1648` (`composePluginLinesWith`'s gate)
**Apply to:** `PluginSkippedMessage` + the held-row builder in the new leaf /
`update-preflight.ts`.

### Pin-threading through `ResolveContext` callbacks, never a new field (D-10-17)
**Source:** `orchestrators/plugin/install-outcome.ts:463-509`
**Apply to:** `update-preflight.ts::resolveUpdateCandidate`'s new
`pathPluginPin`/`resolvePathPluginRoot` wiring and the git arm's `sha`
override closure — same `...(pin !== undefined && { ... })` spread shape so
an unpinned call stays byte-identical.

### Severity-for-free via `skipSeverity` default (D-10-12 / Pitfall 3)
**Source:** `shared/notify-reasons.ts::skipSeverity` (referenced, not
excerpted — grep the file for `IDEMPOTENT_REASON_SET`)
**Apply to:** leave `orchestrators/plugin/update-cascade.ts::cascadeSkipSeverity`
and `orchestrators/marketplace/update.messaging.ts`'s `"skipped"` case
untouched; only comment them.

## No Analog Found

None — every file this phase touches has an exact or composite-exact analog
already in the tree; RESEARCH.md's own conclusion ("The planner's job is
almost entirely citation, not invention") holds after this session's
re-verification.

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/orchestrators/plugin/`,
`extensions/pi-claude-marketplace/orchestrators/reconcile/`,
`extensions/pi-claude-marketplace/shared/`, `tests/orchestrators/plugin/`
**Files read this session:** `install-clone-probe.ts`, `update-preflight.ts`
(imports + lines 200-333, 540-629), `dependency-verdict.ts` (140-320),
`install-cascade.ts` (560-660), `install-outcome.ts` (440-512),
`notification-types.ts` (340-365, 450-460 + interface index), `notification-grammar.ts`
(1620-1656), `dependency-index.ts` (1-60, 100-320), `dependency-tag-probe.test.ts` (1-45)
**Pattern extraction date:** 2026-09-22
