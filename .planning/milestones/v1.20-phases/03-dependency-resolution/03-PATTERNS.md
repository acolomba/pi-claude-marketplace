# Phase 3: Dependency resolution - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 11 (5 new production, 1 extended platform module, 1 extended orchestrator, 4 new/extended test files + 2 gate/config edits)
**Analogs found:** 11 / 11 (every new module has a same-role, same-data-flow analog already in the tree)

All analog paths below were checked with `git ls-files` and are TRACKED source under
`extensions/pi-claude-marketplace/` and `tests/` — no gitignored mirror paths.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/domain/dependency-closure.ts` (NEW) | domain / pure | transform (graph walk over injected lookup) | `extensions/pi-claude-marketplace/domain/dependencies.ts` | exact (same layer, same purity contract, same phase lineage) |
| `extensions/pi-claude-marketplace/domain/dependency-range.ts` (NEW) | domain / pure | transform (fold N ranges → 1) | `extensions/pi-claude-marketplace/domain/dependencies.ts` + `domain/version.ts` | exact |
| `extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts` (NEW) | orchestrator leaf (non-gated network seam) | request-response (remote ref enumeration) | `extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts` | exact — the research names it as the byte-for-byte model |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts` (NEW) | orchestrator (ledger) | batch / transactional | `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` | exact (second `runPhases` instantiation) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts` (NEW) | messaging / presentation | transform | `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts` | exact |
| `extensions/pi-claude-marketplace/platform/git.ts` (EXTEND — `listRemoteTags`) | platform wrapper | request-response (network) | same file, `resolveRemoteRef` (lines 198–261) | exact (same `listServerRefs` API, one param different) |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` (EXTEND) | orchestrator composition root | request-response | same file, lines 667–735 (existing lock closure) | exact (in-place extension) |
| `extensions/pi-claude-marketplace/shared/notification-types.ts` (EXTEND — `REASONS`) | config / closed vocabulary | n/a | same file, lines 6–59 | exact |
| `tests/domain/dependency-closure.ts|range.test.ts` (NEW) | test | n/a | `tests/domain/dependencies.test.ts` | exact |
| `tests/orchestrators/plugin/install-cascade.test.ts`, `dependency-tag-probe.test.ts` (NEW) | test | n/a | `tests/domain/dependencies.test.ts` (idiom) + existing `tests/orchestrators/plugin/*` | role-match |
| `package.json` / `package-lock.json` (EXTEND — `semver`, `@types/semver`) | config | n/a | existing `dependencies` block | exact |

## Pattern Assignments

### `domain/dependency-closure.ts` and `domain/dependency-range.ts` (domain, pure transform)

**Analog:** `extensions/pi-claude-marketplace/domain/dependencies.ts`

**Module-header pattern** (`domain/dependencies.ts` lines 1–26) — a file-level block comment
that states WHAT the module parses/computes, WHY it lives in `domain/` (purity: "no I/O, no
clock"), what the caller is responsible for, and which decision IDs it implements. Copy this
shape; both new modules need the same "pure, network-free, caller owns the I/O" statement,
and `dependency-closure.ts` additionally needs the "the lookup arrives as a parameter"
sentence that keeps it testable:

```ts
// domain/dependencies.ts
//
// The element parser for a plugin's `dependencies` field (DEPS-01, DEPS-02).
// ...
// D-01-20 puts the parse in `domain/` because it is pure: no I/O, no clock,
// and no knowledge of the marketplace that declared the array. Filling a
// missing marketplace in is the CALLER's concern -- `orchestrators/plugin/
// info.ts` fills in the declaring marketplace for display, and
// dependency-resolution work applies its own semantics to the same parsed
// shape.
```

**Discriminated ok/failure return** (lines 183–207) — the exact result shape both new
modules should return (`intersectRanges` → `{ok:true, range}` | `{ok:false, reason:"invalid"|"too-complex"|"disjoint"}`;
the closure walk → `{ok:true, closure}` | `{ok:false, reason, ...}`). Note the readonly
modifiers and the inline union in the return annotation rather than a named type:

```ts
export function parseDeclaredDependencies(
  raw: unknown,
):
  | { readonly ok: true; readonly dependencies: readonly DeclaredDependency[] }
  | { readonly ok: false; readonly reason: string } {
  if (raw === undefined) {
    return { ok: true, dependencies: [] };
  }
  ...
}
```

**Small-helper extraction to stay under both complexity ceilings** (lines 97–123, 131–147) —
`applyOptionalFields`, `buildDependency`, `parseStringElement`, `parseObjectElement` are
each one guard-clause-shaped function with a doc comment. This is the pattern the research's
Pitfall 5 demands for the intersection algorithm (`checkTotalSize`, `splitIntoOrBranches`,
`crossProduct`, `filterSatisfiable`, `rejoin`):

```ts
/**
 * Copy the optional fields that were declared, and report whether the element
 * survives. Absent means not declared and is simply skipped; present but
 * unrenderable makes the whole element unusable (D-01-33).
 */
function applyOptionalFields(target: MutableDependency, fields: RawFields): boolean {
  for (const [key, pattern] of OPTIONAL_FIELDS) {
    const value = fields[key];
    if (value === undefined) {
      continue;
    }

    if (typeof value !== "string" || !pattern.test(value)) {
      return false;
    }

    target[key] = value;
  }

  return true;
}
```

**Module-scope frozen constant pattern** for the two size guards (`domain/version.ts` lines 25–27):

```ts
/** D-12: walk filter -- entries by name that are skipped at every level. */
const HASH_WALK_SKIP = Object.freeze([".git", "node_modules", ".DS_Store"] as const);

const HASH_TRUNC = 12;
```

Use this for the `4096`-char and `1024`-conjunct caps — named module constants with a doc
comment naming them as **project-owned** caps (Assumption A1 says the 1024 value is not
provably upstream's, so the comment must not claim parity on the number).

**The input shape this phase consumes, verbatim** (`domain/dependencies.ts` lines 35–40):

```ts
export interface DeclaredDependency {
  readonly name: string;
  readonly version?: string;
  readonly marketplace?: string;
  readonly sha?: string;
}
```

---

### `orchestrators/plugin/dependency-tag-probe.ts` (orchestrator leaf, request-response over network)

**Analog:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-clone-probe.ts` (87 lines, whole file read)

This is the NFR-5-legal precedent: the file is absent from `NETWORK_FREE_TARGETS`
(`tests/architecture/gate-targets.ts` lines 41–54) while both its callers are members. Copy
its shape exactly and no `gate-targets.ts` edit is needed.

**Imports pattern** (lines 1–15) — relative `.ts` extensions, value imports first, type-only
imports last, blank line between groups:

```ts
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
```

**Injectable seam + frozen real implementation** (lines 17–41, 54) — the tag probe needs the
same `seam?` + module-scope real default so a test can fault the network without touching
the network:

```ts
/** Clone-cache operations used to materialize an install source. */
export interface InstallCloneCacheSeam {
  readonly resolvePluginPin: typeof resolvePluginPin;
  readonly materializePluginClone: typeof materializePluginClone;
  readonly materializeOrRefreshPluginMirror: typeof materializeOrRefreshPluginMirror;
}

const REAL_INSTALL_CLONE_CACHE_SEAM: InstallCloneCacheSeam = {
  resolvePluginPin,
  materializePluginClone,
  materializeOrRefreshPluginMirror,
};
// ... inside the exported function:
  const seam = options.seam ?? REAL_INSTALL_CLONE_CACHE_SEAM;
```

**Auth bundle option shape** (lines 24–35) — copy this options interface nearly verbatim;
the tag probe needs the same `auth` sub-bundle, and `authMemo` is the direct analogue of
upstream's per-URL tag memo (`Map<string, ...>` threaded in as an option, never module state):

```ts
/** Inputs required to materialize and classify one install clone. */
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
```

**Conditional-spread call idiom** (lines 60–65) — required under `exactOptionalPropertyTypes`:

```ts
    const materialized = await seam.materializeOrRefreshPluginMirror({
      locations,
      cloneUrl,
      ...(source.ref !== undefined && { ref: source.ref }),
      ...(auth !== undefined && { auth }),
    });
```

**Injection point in the caller** (`install-outcome.ts` line 162) — the non-`gitOps` field
name is load-bearing, since the gate matches the bare identifier `gitOps`:

```ts
  readonly cloneProbe?: typeof probeInstallClone;
```

Mirror as `readonly tagProbe?: typeof probeDependencyTags;`.

---

### `platform/git.ts` — `listRemoteTags` (platform wrapper, network request-response)

**Analog:** the same file's `resolveRemoteRef`, lines 198–261.

**Doc-comment pattern** (lines 198–223) — a long block naming the decision/requirement IDs,
the exact `isomorphic-git` option semantics being relied on, ref-selection behavior, the auth
threading, and a `Source:` line citing `node_modules/isomorphic-git/index.d.ts`. Reproduce
this shape for the tag wrapper.

**Core pattern** (lines 224–261) — the new function is this with `prefix: "refs/tags/"` added
and the HEAD branch dropped:

```ts
export async function resolveRemoteRef(opts: ResolveRemoteRefOptions): Promise<string> {
  // Same conditional-spread + AuthFailureCallback cast idiom as clone() at the
  // top of this file: build the callbacks only when opts.auth is defined so the
  // public-only resolution stays byte-identical.
  const authCbs = opts.auth === undefined ? undefined : buildAuthCallbacks(opts.auth);
  const refs = await git.listServerRefs({
    http,
    url: opts.url,
    protocolVersion: 2,
    symrefs: true,
    peelTags: true,
    ...(authCbs !== undefined && {
      onAuth: authCbs.onAuth,
      onAuthFailure: authCbs.onAuthFailure as git.AuthFailureCallback,
    }),
  });
  ...
  // For an annotated tag the `peeled` field carries the commit the tag points
  // at; prefer it so a tag resolves to a commit, not the tag object.
  return match.peeled ?? match.oid;
}
```

**The `AuthFailureCallback` cast rationale** (lines 137–150, on `clone()`) — the canonical
explanation comment; the new function should refer to it the way `resolveRemoteRef` does
("Same conditional-spread + AuthFailureCallback cast idiom as clone()") rather than restating it.

**Options-interface pattern** (lines 120–134) — small, named, one-doc-line-per-optional-field
interfaces declared above the functions.

---

### `orchestrators/plugin/install-cascade.ts` (orchestrator, batch/transactional)

**Analog:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts`

**The `runPhases` instantiation pattern** (`install-outcome.ts` lines 976–999) — including
the literal-array discipline comment. The cascade's array is DERIVED, so its header must
carry the counter-rationale (order is the closure walk's tested post-order, not implicit);
copy the surrounding capture/format shape verbatim:

```ts
  // D-01 literal-array; order is part of the contract -- never refactor
  // to a dynamic builder. D-63-01: hooks slot lands between agents and mcp.
  // The PRD-fixed sequence is
  // [skills, commands, agents, hooks, mcp, state].
  const phases: readonly Phase<InstallLedgerContext>[] = [
    skillsPhase, commandsPhase, agentsPhase, hooksPhase, mcpPhase, statePhase,
  ];

  const result = await transaction.runPhases(phases, ctxLocal);
  if (isFailedRunPhasesResult(result)) {
    const rollback = formatRollbackError(result, result.error);
    if (capture !== undefined) {
      capture.rollbackPartials = rollback.rollbackPartials;
      capture.version = ctxLocal.version;
    }
```

**Injectable transaction seam + frozen default** (lines 176–179, 480–484):

```ts
/** Transaction operation required by the guard-free ledger. */
export interface InstallLedgerTransaction {
  readonly runPhases: typeof runPhases;
}

/**
 * Named at module scope rather than written as an inline parameter default, so
 * every call that omits `transaction` reads this one frozen object instead of
 * allocating a fresh literal per invocation (typescript:S7737).
 */
const DEFAULT_INSTALL_LEDGER_TRANSACTION: InstallLedgerTransaction = Object.freeze({ runPhases });
```

**Locking-contract header** (lines 486–510) — the cascade is also guard-free and MUST carry
the equivalent statement:

```
 * Locking contract: the CALLER owns the per-scope state lock and the
 * load/save lifecycle. This function performs NO `withStateGuard` /
 * `withLockedStateTransaction` / `saveState` of its own -- `proper-lockfile`
 * (`retries: 0`) is NOT re-entrant, so nesting a second guard on the same
 * `stateLockFile` self-deadlocks (ELOCKED -> StateLockHeldError ...).
```

**Public-result projection pattern** (lines 527–561) — the module-private mutable context is
never handed out; a `to*Summary` projection returns a readonly shape. Apply the same to the
cascade's per-member outcome rows:

```ts
export async function runInstallLedger(...): Promise<InstallLedgerResult> {
  const result = await executeInstallLedger(state, locations, options, capture, transaction);
  if (result.kind === "marketplace-absent") {
    return result;
  }

  return { kind: "installed", summary: toInstallLedgerSummary(result.installCtx) };
}
```

**Per-member `undo` primitive** — `orchestrators/marketplace/shared.ts` lines 300–312:

```ts
export async function cascadeUnstagePlugin(
  plugin: string,
  marketplace: string,
  locations: ScopedLocations,
  installedPlugin: ExtensionState["marketplaces"][string]["plugins"][string],
): Promise<UnstageOutcome>
```

Its header also documents the AG-5 strict-throw opt-in; read it before wiring `undo`.

---

### `orchestrators/plugin/install-flow.ts` (EXTEND — drive the cascade inside the existing lock)

**Analog:** the same file, lines 667–735 (the existing `withLockedStateTransaction` closure).

**ONE selection, reused** (lines 667–690) — D-03-06 falls out by reusing this single call;
do not add a per-member call:

```ts
    await transaction.withLockedStateTransaction(locations, async (tx) => {
      // D-103-16: ONE selection, made before anything reads a config path, so
      // the CFG-03 load, the DFEN-05 precedence read and BOTH write arms below
      // address the same physical file. ...
      const selection = await selectDeclaringConfigWriteTarget({
        locations,
        local: opts.local,
        key: `${plugin}@${marketplace}`,
      });
```

**No-save abort discipline** (lines 701–731) — the exact pattern the cascade's failure path
must follow: set a flag, `return` from inside the closure, never `tx.save()`:

```ts
      if (selection.kind === "unreadable") {
        configBasename = path.basename(selection.filePath);
        configInvalid = true;
        return;
      }
      ...
      const result = await runInstallLedger(
        state,
        locations,
        buildInstallLedgerOptions(opts, { scope, cwd, marketplace, plugin }),
        capture,
        transaction,
      );
      if (result.kind === "marketplace-absent") {
        // WR-04: precondition miss -- read-only in effect, NO tx.save().
        marketplaceAbsent = true;
        return;
      }
```

**Lift-out-of-closure pattern** (lines 733–735) — success values are assigned to an outer
`let` so the notification is composed after the lock releases:

```ts
      // Success: lift the install context up so the post-guard path can
      // compose the user-visible notification without re-entering the closure.
      installCtx = result.summary;
```

**Batched config write-back** — swap `writePluginConfigEntry` (`install-flow.ts:12, 867`) for
the batched writer used by `import`. Call-site analog, `orchestrators/import/execute.ts:974`:

```ts
      await writeBatchedConfigEntries(current, targetConfigPath, locations.scopeRoot, batch);
```

Implementation contract, `persistence/config-write-back.ts` lines 170–208 — its header states
the structural single-write guarantee ("this function contains exactly ONE `await saveConfig(...)` call").

---

### `orchestrators/plugin/install-cascade.messaging.ts` (messaging, transform)

**Analog:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`

**Imports pattern** (lines 1–30) — pull `ICON_*` / row builders from
`shared/notification-grammar.ts` and message/reason/status TYPES from
`shared/notification-types.ts`; never duplicate grammar locally.

**Module-header pattern** (lines 32–44):

```ts
/**
 * install.messaging.ts -- the command-local notification vocabulary for
 * `/claude:plugin install` (MOD-01). It co-locates install's private status
 * set, the message shapes those statuses carry, install's command-private
 * reasons, and a render map total over install's OWN statuses (D-10) ...
 *
 * The shared presentation vocabulary (`ICON_*`, `joinTokens`,
 * `renderScopeBracket`, `renderVersion`, `composeReasons`, `pluginRow`) stays
 * central in `shared/notification-grammar.ts` (D-11); this module CALLS it,
 * never duplicates it.
 */
```

**Command-private status union** (lines 46–60) — a local `type XStatus = "a" | "b" | ...`
with a doc comment per member explaining when it fires. The cascade's per-member row statuses
go here, NOT in the shared closed set.

---

### Test files (`tests/domain/dependency-{closure,range}.test.ts`, `tests/orchestrators/plugin/{install-cascade,dependency-tag-probe}.test.ts`)

**Analog:** `tests/domain/dependencies.test.ts`

**Imports + type-assertion idiom** (lines 1–19) — `node:test`, explicit `.ts` extensions into
`extensions/`, and the `void (x satisfies T)` / `@ts-expect-error` compile-time pins:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseDeclaredDependencies,
  type DeclaredDependency,
} from "../../extensions/pi-claude-marketplace/domain/dependencies.ts";

void ({ name: "helper" } satisfies DeclaredDependency);
// @ts-expect-error A declared dependency always carries a name.
void ({ version: "^1.0.0" } satisfies DeclaredDependency);
```

**Table-driven case pattern** (lines 21–40) — a `for (const {label, raw, reason} of [...])`
loop generating one `test()` per row. This is the right shape for the range-intersection
matrix and for the closure walk's cycle/diamond/already-installed/unknown-marketplace cases:

```ts
for (const { label, raw, reason } of [
  { label: "a non-array field", raw: { helper: "^1.0.0" }, reason: "dependencies: expected an array" },
  { label: "a bare tilde range", raw: ["foo@~1.0.0"], reason: "dependencies.0: Invalid input" },
]) {
  test(`rejects the entire declaration containing ${label}`, () => { ... });
}
```

Test titles cite requirement/decision IDs (`RESV-04`, `D-03-11`) and never phase/plan numbers
(`.claude/rules/typescript-comments.md`).

---

## Shared Patterns

### Closed-vocabulary amendment (REASONS)
**Source:** `extensions/pi-claude-marketplace/shared/notification-types.ts` lines 5–20
**Apply to:** any new reason token from D-03-02/D-03-08

```ts
/** Closed notification reason vocabulary in canonical render order. */
export const REASONS = [
  "up-to-date",
  "not found",
  "already installed",
  ...
```

`"marketplace not added"` already exists — check before minting. Any addition also requires
amending `tests/architecture/compat-01-no-expansion.test.ts` (enumeration equality, declared
order) and a `docs/output-catalog.md` entry, with an inline comment recording why the member
exists (the `"data kept"` precedent).

### NFR-5 gate membership
**Source:** `tests/architecture/gate-targets.ts` lines 41–54
**Apply to:** `dependency-tag-probe.ts` (must stay OUT of the list), `install-flow.ts` /
`install-outcome.ts` (must stay IN and carry no field or identifier named `gitOps`)

```ts
export const NETWORK_FREE_TARGETS = [
  // NFR-5 (amended): both install owners carry ZERO git surface of their own. A
  // git-source (url / git-subdir / github) clone is delegated to the
  // install-clone-probe.ts leaf, which reaches the clone-cache.ts sibling seam
  // where the git surface legally lives. ...
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts",
  "extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts",
```

The gate's forbidden surface includes the BARE identifier `/\bgitOps\b/`, so a seam field
named `gitOps` in either owner fails with no import present.

### Error/result discipline
**Source:** `extensions/pi-claude-marketplace/shared/errors.ts` (per CONVENTIONS.md)
**Apply to:** all four new modules — typed error classes `extends Error`, `this.name` set in
the constructor, readonly typed public fields (never structured data encoded only in the
message), `{ cause }` passed through, callers narrow on `instanceof`. Pure domain modules here
prefer the discriminated `{ok:false, reason}` result over throwing (the `dependencies.ts`
precedent); throwing is for the orchestrator tier.

### Comment traceability
**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** every new file — cite `RESV-0N`, `D-03-NN`, `NFR-N`; never `Phase N`, `Plan N`,
`Wave N`, or bare `Pitfall N` / `Pattern N`. Do not narrate removed code.

## No Analog Found

None. Every file this phase creates has a same-role, same-data-flow analog already in the
tree. Two items carry a documented deviation rather than a missing analog:

| File | Deviation | Handling |
|------|-----------|----------|
| `orchestrators/plugin/install-cascade.ts` | `runPhases` is called with a DERIVED array; `transaction/phase-ledger.ts` lines 5–9 state a literal-array discipline | Module-header rationale: the order is the closure walk's tested post-order, which is explicit, not implicit. Also update `ARCHITECTURE.md`'s "exactly ONE production consumer" sentence (docs only — no gate asserts it) |
| `platform/git.ts` `listRemoteTags` | "many tags per plugin, pick one" has no precedent in this codebase's one-entry-one-pinned-ref git-source model | The wrapper itself copies `resolveRemoteRef`; the SELECTION logic (`<name>--v<semver>` prefix parse + range pick) is new and belongs in the probe leaf, not in `platform/` |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,orchestrators/plugin,orchestrators/marketplace,orchestrators/import,platform,persistence,shared,transaction}/`, `tests/domain/`, `tests/architecture/`
**Files scanned:** 12 read (2 in full, 10 targeted ranges)
**Pattern extraction date:** 2026-09-14
