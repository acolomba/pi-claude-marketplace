# Phase 101: Manifest field and precedence resolution - Research

**Researched:** 2026-08-14
**Domain:** In-repo TypeBox schema + domain resolver mechanics (no external dependencies)
**Confidence:** HIGH

> **Provenance convention used in this document.** Every claim carries one of:
>
> - `[VERIFIED: <command>]` — produced by running a tool in this session (`tsc --noEmit`,
>   `node --test`, a TypeBox probe script). Strongest evidence.
> - `[VERIFIED: <path>:<lines>]` — read from the source-of-truth file this session and
>   quoted verbatim beside the claim.
> - `[ASSUMED]` — training knowledge or inference, not confirmed this session.
>
> No external package is added by this phase, so the Package Legitimacy Audit and
> Environment Availability sections are omitted with reasons stated at the end.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Where the resolved value hangs on the resolver output**

- The resolved value lands in `MATERIALIZABLE_FIELDS`
  (`domain/resolver.ts`), so it appears on the `installable` and
  `partially-available` arms by construction and is absent from `unavailable`.
  The `unavailable` arm stays the minimal structural-defect arm per D-64-05: a
  plugin that cannot be installed at all has no meaningful install-time
  enablement answer.
- The field is **always present** and non-optional (`Type.Boolean()`), not
  `Type.Optional`. The "absent at both sites means `true`" default is applied
  once, at resolution. This is precisely what DFEN-03 buys — an optional field
  would push the default back onto every consumer, which is the outcome the
  requirement exists to prevent.
- The field is named `defaultEnabled`, matching the manifest field name, so no
  mental translation is needed between the declaration and the resolved value.
- Both `resolveStrict` and `resolveLoose` resolve it, identically.
  `resolveLoose` already reads `plugin.json` through `preflightStages`, so
  making the value mode-dependent would hand Phase 104 an inconsistency it would
  then have to explain at the read surfaces.

**Precedence semantics**

- The precedence rule lives in **one private helper** in `domain/resolver.ts`,
  called from the shared `PartialResolution` build path that both resolution
  modes already pass through. Not exported from `domain/components/plugin.ts`
  (that module is schema-only), and not inlined at the arm constructors (that
  would be the per-consumer re-derivation DFEN-03 forbids).
- "Not declared" is tested with `=== undefined`, per the explicit instruction in
  the `domain/components/plugin.ts` file header: TypeBox `Type.Optional`
  produces `T | undefined` in `Static<>`, not `T?`, so `=== undefined` is
  correct and `in` is not.
- The entry wins over the manifest **in both directions**, not only the
  false-wins direction. Entry `true` + manifest `false` resolves `true`. This is
  the asymmetry a reader is most likely to guess wrong, so it gets its own
  pinned test rather than riding along on the false-wins case.
- A manifest-only `defaultEnabled`, with the entry silent, is **not** a
  loose-mode declaration conflict. `defaultEnabled` is metadata, in the same
  class as `description` and `version`; the loose-mode conflict rule
  (MM-6/MM-7) applies only to component declarations and `mcpServers`.
  Declaring the field in `plugin.json` alone must never push a plugin to
  `unavailable`.
- A null/unreadable manifest falls back to the entry value, and then to `true` —
  the same path as an absent declaration.

**Validation and the no-op guarantee**

- A non-boolean `defaultEnabled` fails as a plain TypeBox schema violation with
  no bespoke error class and no coercion. In a marketplace entry that is
  `InvalidMarketplaceManifestError` raised at manifest load
  (`domain/manifest.ts`, `MARKETPLACE_VALIDATOR.Check`); in `plugin.json` it is
  the existing `readManifest` validation-failure path, which resolves
  `unavailable` with the existing reason string.
- The blast radius is deliberately unchanged: because `PLUGIN_ENTRY_SCHEMA` is
  validated as part of `MARKETPLACE_SCHEMA`, one malformed `defaultEnabled`
  invalidates the whole `marketplace.json`, exactly as a non-string `version`
  does today. DFEN-01 asks for "the same way any other schema violation does",
  so no per-plugin skip is introduced.
- Criterion 5 (nothing observable changes) is proven **in this phase** by
  characterization tests: a plugin declaring `defaultEnabled: false` still
  resolves `installable` and still installs *enabled* at Phase 101. The full
  six-surface byte-identical sweep remains Phase 105's job (DFEN-08); this is
  the narrow proof that the schema and resolver edits alone changed nothing.
- The D-09 lenient unknown-key tolerance is pinned with a test that a plugin
  declaring an unrelated unknown key still resolves — a cheap regression guard
  on the schema edit.

### Claude's Discretion

- The exact name and signature of the private precedence helper.
- Whether the resolved value threads through `PartialResolution` or is computed
  at `decideResolution` time, provided it is computed once and both modes share
  it.
- Test file placement and naming, following existing `tests/domain/` conventions.

### Deferred Ideas (OUT OF SCOPE)

- Acting on the resolved value at install time — recording the plugin disabled
  and writing `enabled: false` through to `claude-plugins.json` — is Phase 102
  (DFEN-04, DFEN-05).
- Whether `list` and `info` read a warm clone's `plugin.json` for the value, and
  the resulting warm-vs-cold rendering divergence, is Phase 104's design
  question (OUT-05). It is explicitly not settled here.
- The full six-surface byte-identical no-op sweep is Phase 105 (DFEN-08).
- The two milestone-level open questions (install-ledger materialization path
  for a disabled install; orchestrated-mode installs and the pre-existing config
  entry) belong to Phase 102's discuss session and must not be resolved here.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DFEN-01 | `defaultEnabled` is an optional boolean on both the marketplace plugin entry and `plugin.json`, added once to the shared `PLUGIN_METADATA_FIELDS` group so `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA` both carry it. A non-boolean value fails validation the same way any other schema violation does; an unknown-key tolerance (D-09 lenient) is unchanged. | §"The schema edit" — one-line insertion at `plugin.ts:20`, with the resulting accept/reject matrix measured empirically against the compiled validators, including the unchanged unknown-key tolerance and the identical `must be boolean` error shape a non-string `version` produces today. |
| DFEN-02 | When both declaration sites carry `defaultEnabled`, the marketplace entry value wins. Absent at both sites resolves to `true`. | §"The precedence helper" — exact signature, the reachability argument that makes a non-boolean manifest value impossible at that point, and the two-direction test obligation. |
| DFEN-03 | The resolver exposes the resolved value to the install path, so the precedence rule is evaluated in one place rather than re-derived per consumer. | §"Where the value is computed" (two viable wirings with a recommendation) and §"The install-path read" — `InstallCtx.resolved` is already `MaterializablePlugin`, so the field is readable with no orchestrator change at all. |

</phase_requirements>

## Summary

This phase is two source edits and one mechanical fan-out. The schema half is a
single line: `PLUGIN_METADATA_FIELDS` is already spread into both
`PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA`, so adding
`defaultEnabled: Type.Optional(Type.Boolean())` there covers both declaration
sites at once, propagates through `MARKETPLACE_SCHEMA` (which embeds
`PLUGIN_ENTRY_SCHEMA` in its `plugins` array) with no edit to `manifest.ts`, and
changes nothing about the lenient unknown-key posture. I applied that edit
temporarily and confirmed the full `tests/{architecture,domain}` suite stays
green — 719 pass, 0 fail — and that `tsc --noEmit` reports zero new errors from
the schema half alone.

The resolver half is where the work actually is, and it is entirely a
type-system fan-out. Adding a **non-optional** `defaultEnabled: Type.Boolean()`
to `MATERIALIZABLE_FIELDS` makes the field required on both materializable arms
by construction, which is exactly what the locked decision asks for — and which
means every hand-written `ResolvedPluginInstallable` / `ResolvedPlugin` object
literal in the test tree fails to compile until it supplies the field. I applied
that edit temporarily too and captured the complete breakage set from
`tsc --noEmit`: **17 errors, 1 in production and 16 across 9 test files**. That
enumeration is in this document and is empirical, not a grep guess.

The two things a plan might reasonably fear turned out to be non-issues. No
architecture gate pins the resolver arm key sets — the COMPAT-01 enumeration
gate pins the *persisted install record* key set, the notify closed sets, and the
state schema version union, none of which this phase touches. And a new metadata
field structurally cannot reach `resolveLoose`'s `structuralDirty` accumulator:
the three functions that feed it iterate closed tuples
(`SUPPORTED_COMPONENT_PATH_KINDS`, `UNSUPPORTED_COMPONENT_KINDS`) or key on
`mcpServers` by name, so a key outside those sets is invisible to the conflict
machinery — the same reason `description` and `version` have never been conflict
material.

**Primary recommendation:** Make the two edits (`plugin.ts:20`,
`resolver.ts:161`), compute the precedence once in `preflightStages` after
`readManifest` succeeds, thread the result out of `preflightStages` as an
explicit return field so that omitting it is a compile error rather than a silent
`true`, and budget the bulk of the plan for the 16 mechanical test-fixture
updates.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Accepting `defaultEnabled` on a marketplace entry | `domain/components/plugin.ts` (schema) | `domain/manifest.ts` (embeds the entry schema) | Schema-only module; validation is declarative and the entry schema is already a member of `MARKETPLACE_SCHEMA.plugins` `[VERIFIED: extensions/pi-claude-marketplace/domain/manifest.ts:26-35]` |
| Accepting `defaultEnabled` on `plugin.json` | `domain/components/plugin.ts` (schema) | `domain/resolver.ts::readManifest` (runs the validator) | Same shared field group; `readManifest` is the only caller of `PLUGIN_MANIFEST_VALIDATOR` `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:588]` |
| Deciding entry-vs-manifest precedence | `domain/resolver.ts` (private helper) | — | Pure, network-free, disk-free decision over two already-read values; the domain layer is defined as exactly that `[VERIFIED: .planning/codebase/ARCHITECTURE.md, "domain/" layer]` |
| Exposing the resolved value | `domain/resolver.ts` (`MATERIALIZABLE_FIELDS`) | — | Locked decision; the two materializable arms are constructed from one field bag so both carry it by construction |
| Reading the resolved value | `orchestrators/plugin/install.ts` | — | Read-only this phase; acting on it is Phase 102 |

No tier boundary moves. Nothing crosses into `bridges/`, `persistence/`,
`transaction/`, `platform/`, or `edge/`.

## The schema edit

### Current state, verbatim

`[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:18-21]`

```ts
const PLUGIN_METADATA_FIELDS = {
  description: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
};
```

The group is spread into both schemas, one line each:

`[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:62]` —
inside `PLUGIN_ENTRY_SCHEMA`:

```ts
  // optional metadata (MM-2)
  ...PLUGIN_METADATA_FIELDS,
```

`[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:91]` —
inside `PLUGIN_MANIFEST_SCHEMA`:

```ts
  ...PLUGIN_METADATA_FIELDS,
```

The compiled validators are declared at
`[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:81]`
(`export const PLUGIN_ENTRY_VALIDATOR = Compile(PLUGIN_ENTRY_SCHEMA);`) and
`[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:102]`
(`export const PLUGIN_MANIFEST_VALIDATOR = Compile(PLUGIN_MANIFEST_SCHEMA);`).
Both are module-load JIT compilations of the schema objects, so no separate
validator edit is needed — recompiling is automatic.

### The edit

One line, inserted after `version`:

```ts
const PLUGIN_METADATA_FIELDS = {
  description: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
  defaultEnabled: Type.Optional(Type.Boolean()),
};
```

### Knock-on effects — measured, not assumed

`MARKETPLACE_SCHEMA` needs **no edit**. It embeds the entry schema by reference
`[VERIFIED: extensions/pi-claude-marketplace/domain/manifest.ts:26-35]`:

```ts
export const MARKETPLACE_SCHEMA = Type.Object({
  name: Type.String(),
  plugins: Type.Array(PLUGIN_ENTRY_SCHEMA),
  strict: Type.Optional(Type.Boolean()),
  owner: Type.Optional(
    Type.Object({
      name: Type.String(),
    }),
  ),
});
```

I compiled the proposed schema and exercised both the real and the proposed
validators. Results `[VERIFIED: node --experimental-strip-types probe script,
this session]`:

| Input | Validator | Result |
|-------|-----------|--------|
| `{name, source, defaultEnabled: false, wibble: 1}` | `PLUGIN_ENTRY_VALIDATOR` (today, field not yet in schema) | `true` — unknown keys already tolerated |
| `{name: "p", zzz: {}}` | `PLUGIN_MANIFEST_VALIDATOR` (today) | `true` — unknown keys already tolerated |
| `{name, source}` | proposed | `true` — field absent is legal |
| `{name, source, defaultEnabled: false}` | proposed | `true` |
| `{name, source, defaultEnabled: "false"}` | proposed | `false` |
| `{name, source, defaultEnabled: undefined}` | proposed | `true` — explicit `undefined` satisfies `Type.Optional` |
| `{name, source, wibble: 1}` | proposed | `true` — **lenient tolerance unchanged** |

The rejection error object, verbatim from the probe:

```json
{"keyword":"type","schemaPath":"#/properties/defaultEnabled","instancePath":"/defaultEnabled","params":{"type":"boolean"},"message":"must be boolean"}
```

That is structurally identical to the error a non-string `version` produces
today at the marketplace level `[VERIFIED: same probe]`:

```json
{"keyword":"type","schemaPath":"#/properties/plugins/items/properties/version","instancePath":"/plugins/0/version","params":{"type":"string"},"message":"must be string"}
```

So the two failure surfaces the locked decision names are already wired and need
no code:

- **Marketplace entry.** `MARKETPLACE_VALIDATOR.Check` fails, and
  `loadMarketplaceManifestUncached` throws
  `[VERIFIED: extensions/pi-claude-marketplace/domain/manifest.ts:70-76]`:

  ```ts
  if (!MARKETPLACE_VALIDATOR.Check(parsed)) {
    const firstErr = MARKETPLACE_VALIDATOR.Errors(parsed)[0];
    const detail = firstErr
      ? `${firstErr.instancePath || "<root>"}: ${firstErr.message}`
      : "(no detail)";
    throw new InvalidMarketplaceManifestError(`marketplace.json schema invalid: ${detail}`);
  }
  ```

  A `defaultEnabled: "yes"` on the first plugin therefore yields exactly
  `marketplace.json schema invalid: /plugins/0/defaultEnabled: must be boolean`,
  and the whole manifest is rejected — the deliberately-unchanged blast radius
  the locked decision describes.

- **`plugin.json`.** `readManifest` fails the check and returns a reason
  `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:588-594]`:

  ```ts
    if (!PLUGIN_MANIFEST_VALIDATOR.Check(parsed)) {
      const firstErr = PLUGIN_MANIFEST_VALIDATOR.Errors(parsed)[0];
      const detail = firstErr
        ? `${firstErr.instancePath || "(root)"}: ${firstErr.message}`
        : "(no detail)";
      return { ok: false, reason: `malformed plugin.json: ${detail}` };
    }
  ```

  which `preflightStages` turns into `unavailable`
  `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:753-760]`:

  ```ts
    // PR-2 case 4: malformed plugin.json (best-effort -- absence is OK).
    const manifestResult = await readManifest(ctx, pluginRoot);
    if (!manifestResult.ok) {
      return {
        kind: "unavailable",
        result: unavailable(entry.name, [...partial.notes, manifestResult.reason]),
      };
    }
  ```

  The note is `malformed plugin.json: /defaultEnabled: must be boolean`, which
  keeps the existing `malformed plugin.json` prefix that downstream classifiers
  key on — the existing reason string, unchanged.

### Why the lenient posture is safe

`plugin.ts` contains no `additionalProperties` clause anywhere
`[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:1-103,
read in full]`. TypeBox `Type.Object` defaults to `additionalProperties: true` —
a fact the codebase already states for the sibling hooks schema
`[VERIFIED: extensions/pi-claude-marketplace/domain/components/hooks.ts:216,
"`Type.Object` defaults to `additionalProperties: true`."]` — and which I
re-confirmed empirically in the probe table above, both before and after the
edit. Adding a named optional property cannot narrow that.

**Note on the "D-09" label.** CONTEXT.md and REQUIREMENTS.md call this the "D-09
lenient unknown-key tolerance". `D-09` is reused across milestones in this repo;
the *lenient-schema / unknown-forward-compat-key* sense of it is cited in
`persistence/config-write-back.ts` `[VERIFIED: grep, 4 hits at lines 8, 42, 111,
158]`, not in `plugin.ts`. The mechanism enforcing it here is the TypeBox default
above. Cite the requirement ID in test titles; do not claim `plugin.ts` carries a
`D-09` marker it does not have.

## The resolver edit

### Current state of the field bag, verbatim

`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:154-187]`

```ts
// The field set shared by the two materializable arms -- `installable`
// and the partially-available (D-64-06). Both carry `pluginRoot`
// plus the full component payload; only the `state` discriminant differs.
// Extracted into one bag and spread into both schemas so the two arms stay
// token-identical by construction (spreading `state` first keeps the literal
// discriminant on each arm; TypeBox key order does not affect the static type).
const MATERIALIZABLE_FIELDS = {
  name: Type.String(),
  // pluginRoot is present on installable + partially-available only (NFR-7); D-64-06
  // lets a partial install degrade past the unsupported parts, so both arms
  // expose it.
  pluginRoot: Type.String(),
  supported: Type.Array(Type.String()),
  unsupported: Type.Array(Type.String()),
  notes: Type.Array(Type.String()),
  componentPaths: ComponentPathsSchema,
  mcpServers: McpServersFieldSchema,
  ...
  hooksConfigPath: Type.Optional(Type.String()),
  ...
  orphanRewake: Type.Optional(Type.Boolean()),
  ...
  droppedHooks: Type.Optional(Type.Array(DroppedHookSchema)),
} as const;
```

Spread into the two arms `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:189-203]`:

```ts
const ResolvedPluginInstallableSchema = Type.Object({
  state: Type.Literal("installable"),
  ...MATERIALIZABLE_FIELDS,
});
```

```ts
const ResolvedPluginPartiallyAvailableSchema = Type.Object({
  state: Type.Literal("partially-available"),
  ...MATERIALIZABLE_FIELDS,
});
```

The `unavailable` arm carries only three fields and must stay that way
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:211-216]`:

```ts
const ResolvedPluginUnavailableSchema = Type.Object({
  state: Type.Literal("unavailable"),
  name: Type.String(),
  notes: Type.Array(Type.String()), // structural reasons
  // pluginRoot intentionally absent -- NFR-7 enforces non-readability
});
```

### The edit

One line inside `MATERIALIZABLE_FIELDS`, non-optional per the locked decision:

```ts
  defaultEnabled: Type.Boolean(),
```

Adding it there gives it to `installable` and `partially-available` and to
`MaterializablePlugin`
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:238,
"export type MaterializablePlugin = ResolvedPluginInstallable | ResolvedPluginPartiallyAvailable;"]`,
and keeps it off `unavailable`, all by construction.

## Where the value is computed — the trace

The full shared path, with real signatures and line numbers, all
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts, read in full]`:

| Function | Lines | Signature |
|----------|-------|-----------|
| `PartialResolution` (interface) | 378-400 | `{ supported; unsupported; notes; componentPaths; mcpServers; hooksConfigPath?; orphanRewake?; droppedHooks? }` |
| `emptyResolution()` | 402-413 | `(): PartialResolution` |
| `unavailable()` | 418-424 | `(name: string, notes: string[]): ResolvedPluginUnavailable` |
| `materializableFields()` | 431-448 | `(name: string, pluginRoot: string, partial: PartialResolution): Omit<ResolvedPluginInstallable, "state">` |
| `installable()` | 450-456 | `(name: string, pluginRoot: string, partial: PartialResolution): ResolvedPluginInstallable` |
| `partiallyAvailable()` | 460-466 | `(name: string, pluginRoot: string, partial: PartialResolution): ResolvedPluginPartiallyAvailable` |
| `readManifest()` | 575-603 | `(ctx, pluginRoot): Promise<{ ok: true; manifest: Record<string, unknown> \| null } \| { ok: false; reason: string }>` |
| `preflightStages()` | 700-763 | `(entry: PluginEntry, ctx: ResolveContext): Promise<{ kind: "ok"; pluginRoot: string; manifest: Record<string, unknown> \| null; partial: PartialResolution } \| { kind: "unavailable"; result: ResolvedPluginUnavailable }>` |
| `resolveStrict()` | 1343-1397 | `(entry: PluginEntry, ctx: ResolveContext): Promise<ResolvedPlugin>` |
| `decideResolution()` | 1405-1420 | `(name: string, pluginRoot: string, partial: PartialResolution, structuralDirty: boolean): ResolvedPlugin` |
| `resolveLoose()` | 1425-1468 | `(entry: PluginEntry, ctx: ResolveContext): Promise<ResolvedPlugin>` |

**The single shared point is `preflightStages`.** Both modes open with the same
three lines — `resolveStrict`
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1347-1353]` and
`resolveLoose`
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1429-1435]` are
byte-identical here:

```ts
  const pre = await preflightStages(entry, ctx);

  if (pre.kind === "unavailable") {
    return pre.result;
  }

  const { pluginRoot, manifest, partial } = pre;
```

and both close with the same call
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1396 and 1467]`:

```ts
  return decideResolution(entry.name, pluginRoot, partial, dirty);
```

`preflightStages` is the earliest point where both `entry` and the validated
`manifest` are in hand — `readManifest` runs at line 754, and the success return
is at line 762 `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:762]`:

```ts
  return { kind: "ok", pluginRoot, manifest: manifestResult.manifest, partial };
```

`decideResolution` is *not* a viable computation site: it receives
`(name, pluginRoot, partial, structuralDirty)` and has neither `entry` nor
`manifest` in scope.

### Two viable wirings

**Option A (recommended) — explicit return field, compile-enforced.**

`preflightStages` computes the value and returns it as a fifth field of its `ok`
arm; both modes destructure it and pass it down; `decideResolution`,
`installable`, `partiallyAvailable`, and `materializableFields` each take it as
an explicit parameter.

Signature deltas:

```ts
// preflightStages ok arm gains:  defaultEnabled: boolean;
const { pluginRoot, manifest, partial, defaultEnabled } = pre;
...
return decideResolution(entry.name, pluginRoot, partial, dirty, defaultEnabled);

function decideResolution(name, pluginRoot, partial, structuralDirty, defaultEnabled: boolean): ResolvedPlugin
function installable(name, pluginRoot, partial, defaultEnabled: boolean): ResolvedPluginInstallable
function partiallyAvailable(name, pluginRoot, partial, defaultEnabled: boolean): ResolvedPluginPartiallyAvailable
function materializableFields(name, pluginRoot, partial, defaultEnabled: boolean): Omit<ResolvedPluginInstallable, "state">
```

Cost: four internal signature edits, all private to the module, two call sites
each. Benefit: forgetting to wire the value anywhere on the path is a **compile
error**, which is the guarantee DFEN-03 is actually asking for.

**Option B (smaller diff) — thread through `PartialResolution`.**

Add `defaultEnabled: boolean` to the `PartialResolution` interface, seed it in
`emptyResolution()`, overwrite it in `preflightStages` after `readManifest`
succeeds, and read `partial.defaultEnabled` in `materializableFields`. No
signature changes at all.

Cost: the default value must be expressed twice (the `emptyResolution` seed and
the helper's fallback) unless both reference one named module constant. More
importantly, **omitting the overwrite is silently wrong** — every plugin would
resolve to the seed value with nothing failing. Given that this phase's entire
purpose is "evaluated in exactly one place", trading a compile error for a silent
default is the wrong trade.

**Recommendation: Option A.** `[ASSUMED]` — this is a judgment call within the
discretion CONTEXT.md grants, not a verified fact.

### The precedence helper

Recommended shape:

```ts
/**
 * DFEN-02: resolve the declared install-time enablement. The marketplace ENTRY
 * value wins over `plugin.json` in BOTH directions; absent at both sites is
 * `true`. Evaluated exactly once here (DFEN-03) so no consumer re-derives it.
 */
function resolveDefaultEnabled(
  entry: PluginEntry,
  manifest: Record<string, unknown> | null,
): boolean {
  if (typeof entry.defaultEnabled === "boolean") {
    return entry.defaultEnabled;
  }

  if (typeof manifest?.defaultEnabled === "boolean") {
    return manifest.defaultEnabled;
  }

  return true;
}
```

Three mechanics worth stating in the plan:

1. **`entry.defaultEnabled` is a typed read.** `PluginEntry` is
   `Type.Static<typeof PLUGIN_ENTRY_SCHEMA>`
   `[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:78]`,
   so after the schema edit the property exists as `boolean | undefined`. No
   `as Record<string, unknown>` cast is needed — unlike the component-path reads
   at `resolver.ts:892` (`(entry as Record<string, unknown>)[kind]`), which need
   the cast only because those fields are `Type.Unknown()`.

2. **`manifest?.defaultEnabled` is `unknown` and needs the `typeof` narrow.**
   `readManifest` returns `manifest: Record<string, unknown> | null`
   `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:578]`, so the
   compiler will not accept a bare `!== undefined` test as a boolean narrowing.
   A `typeof === "boolean"` test is required by the type system and honors the
   `plugin.ts` header instruction, which forbids `in` and prescribes
   `=== undefined`-style value tests rather than key-presence tests
   `[VERIFIED: extensions/pi-claude-marketplace/domain/components/plugin.ts:10-11]`:

   ```ts
   // TypeBox `Type.Optional` produces `T | undefined` in Static<>, not `T?`.
   // Use `=== undefined` checks downstream, not `in`.
   ```

3. **A non-boolean value is unreachable at this point, and the `typeof` is
   defense-in-depth.** `PLUGIN_MANIFEST_VALIDATOR.Check` has already passed on
   the manifest side (`resolver.ts:588`) and `PLUGIN_ENTRY_VALIDATOR` on the
   entry side (asserted by the comment at
   `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:713]`:
   `// Caller bug if name validation throws -- entry came through PLUGIN_ENTRY_VALIDATOR.`),
   so only `boolean | undefined` can arrive. Using `typeof` uniformly on both
   sides matches the codebase's stated re-validate-defensively posture and means
   a test that casts a garbage `LooseEntry` past the validator degrades to the
   default rather than returning a string as a boolean. Say so in a comment; do
   not add an error path for it.

Call site — one line, immediately before the `preflightStages` success return
(`resolver.ts:762`), after `manifestResult.ok` has been confirmed:

```ts
  return {
    kind: "ok",
    pluginRoot,
    manifest: manifestResult.manifest,
    partial,
    defaultEnabled: resolveDefaultEnabled(entry, manifestResult.manifest),
  };
```

A `null` manifest (no `plugin.json` on disk — a normal, non-failing outcome
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:580-582]`) flows
through the optional chain and lands on the entry value, then `true`. That is the
locked "null/unreadable manifest falls back to the entry value, then to `true`"
rule, with no extra branch.

## The install-path read (DFEN-03)

**No orchestrator edit is required for this phase.** The install path already
holds the materializable union, so the field is readable the moment it exists on
the arm.

`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:837]`:

```ts
  const installable: MaterializablePlugin = resolved;
```

and the ledger context carries it forward
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:380]`:

```ts
  readonly resolved: MaterializablePlugin;
```

So `installable.defaultEnabled` and `ctx.resolved.defaultEnabled` are both
`boolean` with no narrowing, immediately after the
`requireInstallable` / `requirePartialInstallable` gate at
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:828-832]`.

A plan may prove DFEN-03 with a type-level assertion in
`tests/domain/resolver.types.test.ts` (see §Test conventions) rather than by
touching `install.ts` at all. That keeps criterion 5 (nothing observable changes)
trivially true for the install orchestrator.

**Contrast worth noting.** `resolvedSha` was deliberately routed as a
side-channel because "the resolver's `ResolvedPlugin` schema cannot carry it"
`[VERIFIED: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:582-591]`.
`defaultEnabled` is the opposite case: it is derivable from the entry + manifest
the resolver already reads, so it belongs *on* the schema. Do not copy the
side-channel pattern here.

## Construction sites that break — the complete, measured list

This is the answer to "does a non-optional `Type.Boolean()` break existing
construction sites". I applied the exact edit
(`defaultEnabled: Type.Boolean(),` inside `MATERIALIZABLE_FIELDS`) and ran
`npx tsc --noEmit`. **Exactly 17 errors**, then reverted the file and confirmed
`git status --porcelain` empty. `[VERIFIED: npx tsc --noEmit, this session]`

### Production (1 site)

| # | File | Line | Error | Fix |
|---|------|------|-------|-----|
| 1 | `extensions/pi-claude-marketplace/domain/resolver.ts` | 437 | TS2741 `Property 'defaultEnabled' is missing ... but required in type 'Omit<..., "state">'` | The `materializableFields` return object. Resolved by whichever wiring option the plan picks. |

**No other production file breaks.** Every production consumer of the resolver
takes `MaterializablePlugin` / `ResolvedPlugin` as an *input* type and never
constructs one — confirmed both by the typecheck (zero further production
errors) and by grep across `extensions/`
`[VERIFIED: grep for `state: "installable"` across extensions/, only comment
matches in `domain/components/hooks.ts`]`.

### Tests (16 sites across 9 files)

Every one is an object literal annotated `ResolvedPluginInstallable` or
`ResolvedPlugin`. Each needs one added property. All line numbers are the
literal's opening line, as reported by `tsc`.

| # | File | Line | Context |
|---|------|------|---------|
| 2 | `tests/bridges/agents/stage.test.ts` | 36 | `makeResolved(name, pluginRoot)` helper |
| 3 | `tests/bridges/commands/discover.test.ts` | 19 | `makeResolved(pluginRoot, commandsRel)` helper |
| 4 | `tests/bridges/commands/discover.test.ts` | 214 | inline literal, multi-element `componentPaths.commands` test |
| 5 | `tests/bridges/commands/discover.test.ts` | 250 | inline literal, first-wins collision test |
| 6 | `tests/bridges/commands/stage.test.ts` | 55 | `makeResolved(pluginRoot, commandsRel?)` helper |
| 7 | `tests/bridges/integration-foreign-content.test.ts` | 47 | `makeResolved()` helper |
| 8 | `tests/bridges/integration-materialization-gate.test.ts` | 99 | inline literal, AS-9 test |
| 9 | `tests/bridges/integration.test.ts` | 68 | `makeResolved()` helper |
| 10 | `tests/bridges/skills/discover.test.ts` | 24 | `makeResolved(pluginRoot, skillsDirAbs)` helper |
| 11 | `tests/bridges/skills/discover.test.ts` | 180 | inline literal, multi-element `componentPaths.skills` test |
| 12 | `tests/bridges/skills/discover.test.ts` | 215 | inline literal, first-wins collision test |
| 13 | `tests/bridges/skills/discover.test.ts` | 244 | inline literal |
| 14 | `tests/bridges/skills/discover.test.ts` | 284 | inline literal |
| 15 | `tests/bridges/skills/stage.test.ts` | 34 | `makeResolved(name, pluginRoot, skillsDirAbs)` helper |
| 16 | `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | 45 | `installable(name)` fixture, typed `ResolvedPlugin` |
| 17 | `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | 61 | `unsupportedResolved(name, unsupported)` fixture, typed `ResolvedPlugin` |

Notes for the plan:

- **`unavailableResolved` at `tests/orchestrators/plugin/plugin-state-classifier.test.ts:74`
  does NOT break** and must not be touched
  `[VERIFIED: tsc reported no error there; source line read via sed]`:

  ```ts
  function unavailableResolved(name = "p"): ResolvedPlugin {
    return { state: "unavailable", name, notes: ["source dir does not exist"] };
  }
  ```

  That absence is itself a proof that the field landed on the right arms.

- Six of the sixteen are `makeResolved`-style helpers, so a single added line
  fixes several call sites at once. The other ten are standalone inline literals.

- The correct fixture value in every one of these is `defaultEnabled: true` —
  these are bridge-staging and classifier fixtures whose behavior must not
  change, and `true` is the resolved default. Anything else would smuggle a
  behavior change into an unrelated suite and violate criterion 5.

- `tests/domain/resolver.types.test.ts` does **not** break: it declares its
  values with `declare const` rather than constructing literals
  `[VERIFIED: tests/domain/resolver.types.test.ts:28-32, read in full]`:

  ```ts
  declare const r: ResolvedPlugin;
  declare const inst: ResolvedPluginInstallable;
  declare const unsup: ResolvedPluginPartiallyAvailable;
  declare const unavail: ResolvedPluginUnavailable;
  declare const materializable: MaterializablePlugin;
  ```

  This makes it the natural home for the DFEN-03 type-level assertions (see
  below) — it costs nothing to extend and its `@ts-expect-error` discipline is
  already the load-bearing NFR-7 gate.

## Architecture gates — none of them trip

I ran the full architecture + domain suites with the schema edit applied:
**720 tests, 719 pass, 0 fail, 1 skipped**
`[VERIFIED: node --test "tests/{architecture,domain}/**/*.test.ts", this session]`.

The gate that the phase brief flagged as a risk is
`tests/architecture/compat-01-no-expansion.test.ts`. It does assert key sets by
enumeration equality, but **not for the resolver arms**. Read in full, its
clauses are `[VERIFIED: tests/architecture/compat-01-no-expansion.test.ts:1-448]`:

| Clause | What it pins | Touched by this phase? |
|--------|-------------|------------------------|
| `REASONS holds exactly its inherited members, in order` | the 38-member reason-token tuple in `shared/notify.ts` | **No** — OUT-01 adds `installs disabled` in Phase 102, not here |
| `STATUS_TOKENS ... in order` | the 24-member status tuple | No |
| `PLUGIN_STATUSES ... in order` | the 19-member plugin-status tuple | No |
| `MARKETPLACE_STATUSES ... in order` | the 7-member marketplace-status tuple | No |
| glyph code points + eighth-glyph declaration scan | `ICON_*` exports in `shared/notify.ts` | No |
| `the persisted install record holds exactly its inherited key set` | `Object.keys(PLUGIN_INSTALL_RECORD_SCHEMA.properties)` — `compatibility, enabled, hookEntries, installedAt, resolvedSha, resolvedSource, resources, updatedAt, version` | **No** — this is the `state.json` record, not the resolver arm. No persistence change this phase. |
| `no manifest-snapshot or orphan field reached the install record` | forbids `manifestSnapshot`, `manifest`, `manifestEntry`, `entry`, `orphan`, `orphanRewake`, `orphaned` as install-record keys | No — and note `defaultEnabled` is not on that forbidden list anyway; it is not a persisted field this phase |
| `the state schema version union is unchanged` | `[1, 2]` | No |
| `the default state still declares the current schema version` | `2` | No |
| install-outcome ledger signals (`unsupported`, `orphanRewake`, `degradedKinds`) | `InstallPluginOutcome` `installed` arm | No |
| network clause delegation | `no-orchestrator-network.test.ts` target list | No |

Other gates checked and cleared:

- `tests/architecture/no-hooks-strict-additional-properties.test.ts` scans
  **`domain/components/hooks.ts`** only, for the literal
  `additionalProperties: false`
  `[VERIFIED: tests/architecture/no-hooks-strict-additional-properties.test.ts:27-30
  and 43-56, read in full]`. It does not read `plugin.ts`. Nothing to trip.
- `tests/architecture/hooks-foundation.test.ts` walks
  `STATE_SCHEMA.properties.marketplaces` down to the persisted plugin record's
  `resources`, not the domain plugin entry schema
  `[VERIFIED: tests/architecture/hooks-foundation.test.ts:63-110]`.
- No test anywhere enumerates `PLUGIN_ENTRY_SCHEMA.properties`,
  `PLUGIN_MANIFEST_SCHEMA.properties`, or the resolver arm key sets
  `[VERIFIED: grep for `.properties` and `Object.keys` across tests/ — the only
  schema-property enumerations are `PLUGIN_INSTALL_RECORD_SCHEMA`, `STATE_SCHEMA`,
  and the two completion-cache schemas]`.
- `tests/architecture/partial-vocabulary-guard.test.ts` (D-75-01) forbids certain
  quoted vocabulary under `tests/architecture` — relevant only if the plan adds a
  clause there. It does not need to.

**Conclusion:** no architecture gate needs amending in this phase.
`[VERIFIED: node --test on the full architecture suite with the schema edit
applied — 0 failures]`

## Why a metadata field cannot feed `structuralDirty`

The loose-mode conflict machinery is closed-set by construction. Three functions
feed the `dirty` accumulator in `resolveLoose`
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1445-1456]`:

```ts
  for (const kind of SUPPORTED_COMPONENT_PATH_KINDS) {
    dirty = (await collectLooseComponentKind(entry, manifest, partial, pluginRoot, kind)) || dirty;
    // No implicit-by-convention in loose mode.
  }

  // Step 8 (MM-7 loose mcpServers).
  dirty = (await applyLooseMcp(entry, manifest, partial, pluginRoot, ctx)) || dirty;

  // Step 8b (HOOK-01 / D-57-04): the hooks-config probe is mode-agnostic.
  ...
  dirty = (await applyHooksConfig(ctx, pluginRoot, partial)) || dirty;
```

- `collectLooseComponentKind` is called once per member of
  `SUPPORTED_COMPONENT_PATH_KINDS`, which is
  `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:336]`:

  ```ts
  const SUPPORTED_COMPONENT_PATH_KINDS = ["skills", "commands", "agents"] as const;
  ```

  and it reads only `entry[kind]` / `manifest[kind]` for those three names
  `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1258-1259]`.
  The manifest-declares-but-entry-does-not conflict it raises
  (`component declarations conflict: manifest declares "${kind}" but entry does not`,
  line 1266-1268) is therefore reachable only for those three keys.

- `applyLooseMcp` keys on `mcpServers` by name and nothing else
  `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1292-1296]`.

- `applyHooksConfig` probes `<pluginRoot>/hooks/hooks.json` on disk and never
  reads an entry or manifest field
  `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1147-1191]`.

The fourth entry/manifest reader, `addUnsupportedKindNotes`, iterates the closed
`UNSUPPORTED_COMPONENT_KINDS` tuple — `lspServers, monitors, themes,
outputStyles, channels, userConfig, settings`
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:354-362]` — and
in any case explicitly does **not** feed `dirty`
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:1458-1460]`:

```ts
  // Step 9 (PR-3 / PR-4): unsupported components -- same as strict. D-64-07:
  // side-effect only (does not feed `dirty`); read via `partial.unsupported`.
  await addUnsupportedKindNotes(entry, manifest, pluginRoot, ctx, partial);
```

`defaultEnabled` is in none of those sets, exactly like `description` and
`version`. A manifest-only `defaultEnabled` with a silent entry is invisible to
every one of them and cannot push a plugin to `unavailable`. **This holds
automatically — no code is needed to make it true, only a test to pin it.**

## Test conventions and real helpers

Use these names; do not invent new ones.

### `tests/domain/resolver-strict.test.ts` and `tests/domain/resolver-loose.test.ts`

Both files define the same in-memory context builder
`[VERIFIED: tests/domain/resolver-strict.test.ts:32-61 and
tests/domain/resolver-loose.test.ts:27-56, read via sed — the two are
character-identical]`:

```ts
function mockCtx(
  marketplaceRoot: string,
  files: Record<string, "dir" | "file" | { contents: string }>,
): ResolveContext
```

Both then declare:

```ts
const MP = "/abs/marketplace";
const ROOT = (rel: string): string => path.resolve(MP, rel);
```

`resolver-strict.test.ts` additionally has
`[VERIFIED: tests/domain/resolver-strict.test.ts:66-82]`:

```ts
/** Load a `tests/fixtures/<name>.json` payload as a raw string. */
function fixture(name: string): Promise<string>

type LooseEntry = Record<string, unknown>;

function basicEntry(over: LooseEntry = {}): PluginEntry {
  return { name: "p1", source: "./local", ...over };
}
```

`basicEntry({ defaultEnabled: false })` is the idiomatic way to build the entry
side of a precedence test. The manifest side is a `mockCtx` file entry with
`{ contents: JSON.stringify({ defaultEnabled: true }) }` at
`ROOT("local/.claude-plugin/plugin.json")` — the path `readManifest` builds
`[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:579]`:

```ts
  const manifestPath = path.join(pluginRoot, ".claude-plugin", "plugin.json");
```

Test-title convention in these files: requirement ID first, then behavior — e.g.
`test("PR-2(4) malformed plugin.json -> notInstallable", ...)`
`[VERIFIED: tests/domain/resolver-strict.test.ts:138]`. Use `DFEN-01` / `DFEN-02`
/ `DFEN-03` as the anchors. Per `.claude/rules/typescript-comments.md`, no phase
or plan numbers in titles or comments.

### `tests/domain/manifest.test.ts`

This is where schema accept/reject tests live. The existing metadata test is the
template to extend `[VERIFIED: tests/domain/manifest.test.ts:153-163]`:

```ts
test("MM-2 PLUGIN_ENTRY accepts metadata fields", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({
      name: "p",
      source: "./local",
      description: "desc",
      version: "1.0.0",
    }),
    true,
  );
});
```

and the manifest-side equivalent `[VERIFIED: tests/domain/manifest.test.ts:298-310]`:

```ts
test("PLUGIN_MANIFEST accepts full shape", () => {
  assert.equal(
    PLUGIN_MANIFEST_VALIDATOR.Check({
      name: "p",
      version: "1.0.0",
      description: "x",
      mcpServers: { srv: {} },
      hooks: { a: 1 },
      dependencies: { other: "1.0" },
    }),
    true,
  );
});
```

Rejection tests follow `test("MM-2 PLUGIN_ENTRY rejects name as number", ...)`
`[VERIFIED: tests/domain/manifest.test.ts:286]` with a plain
`assert.equal(VALIDATOR.Check(...), false)`.

The marketplace-level throw is already covered by
`test("D-48-B loadMarketplaceManifest throws InvalidMarketplaceManifestError on schema-invalid marketplace.json", ...)`
`[VERIFIED: tests/domain/manifest.test.ts:94]` — extend or mirror it rather than
inventing a new harness. Note the file's existing precedent for a *contained*
failure at `test("MCPR-03 marketplace with a broken string-ref plugin + valid sibling loads without throwing", ...)`
`[VERIFIED: tests/domain/manifest.test.ts:240]`; DFEN-01 deliberately does the
opposite (whole-manifest rejection), so the plan should pin that contrast
explicitly so a later reader does not "fix" it.

### `tests/domain/resolver.types.test.ts`

The DFEN-03 type-level proof belongs here. Its existing shape is
`declare const` + `@ts-expect-error`, with the runtime test as a smoke check only
`[VERIFIED: tests/domain/resolver.types.test.ts:1-13, 128-134, read in full]`.
Two assertions worth adding:

```ts
function materializableExposesDefaultEnabled(): boolean {
  return materializable.defaultEnabled; // DFEN-03: readable off the union, no narrowing
}

function unavailableHasNoDefaultEnabled(): void {
  // @ts-expect-error -- D-64-05: the unavailable arm carries no enablement answer.
  void unavail.defaultEnabled;
}
```

Both must be added to the `void` reference list at the bottom of the file
(lines 116-126), or `noUnusedLocals` fails the build.

## Common Pitfalls

### Pitfall: putting the field on the `unavailable` arm

**What goes wrong:** `defaultEnabled` gets added to
`ResolvedPluginUnavailableSchema` "for symmetry", and the D-64-05 minimal-arm
invariant erodes.
**Why it happens:** the three arm schemas sit adjacent in the file and look like
they want the same fields.
**How to avoid:** the edit goes in `MATERIALIZABLE_FIELDS` (line 161 after
insertion) and nowhere else. The `unavailable` schema at lines 211-216 is not
touched.
**Warning sign:** `tests/orchestrators/plugin/plugin-state-classifier.test.ts:74`
(`unavailableResolved`) starts failing to compile. It must stay green.

### Pitfall: declaring the field `Type.Optional`

**What goes wrong:** every consumer has to write `?? true`, which is the
per-consumer re-derivation DFEN-03 exists to forbid.
**Why it happens:** the three neighbours in `MATERIALIZABLE_FIELDS`
(`hooksConfigPath`, `orphanRewake`, `droppedHooks`) are all `Type.Optional`, so
optional looks like the house style there.
**How to avoid:** those three are optional because *absence is meaningful* (no
hooks file, no orphan, nothing dropped). `defaultEnabled` always has an answer.
Non-optional `Type.Boolean()`.
**Warning sign:** the typecheck reports fewer than 17 errors — an optional field
breaks nothing, which is precisely the problem.

### Pitfall: using `in` to test declaration

**What goes wrong:** `"defaultEnabled" in entry` returns `true` for an explicit
`{ defaultEnabled: undefined }`, which the validator accepts
`[VERIFIED: probe — explicit `undefined` passes `Check`]`, so the helper returns
`undefined` where it should fall through to the manifest.
**How to avoid:** the file header at `plugin.ts:10-11` forbids exactly this. Use
a value test.

### Pitfall: fixing the 16 test sites with a non-`true` value

**What goes wrong:** a bridge-staging fixture built with
`defaultEnabled: false` changes nothing today (the bridges do not read the field)
but silently seeds a wrong expectation for Phase 102, when the install path
starts acting on it.
**How to avoid:** all 16 get `defaultEnabled: true`.

### Pitfall: reaching for `entry as Record<string, unknown>`

**What goes wrong:** copying the component-path read idiom
(`(entry as Record<string, unknown>)[kind]`, `resolver.ts:892`) throws away the
typing the schema edit just bought and hides a future rename from the compiler.
**How to avoid:** `entry.defaultEnabled` compiles directly, because
`PLUGIN_METADATA_FIELDS` members are typed (`Type.Boolean()`), unlike the
component fields (`Type.Unknown()`).

### Pitfall: assuming `resolveLoose` needs its own precedence code

**What goes wrong:** a second copy of the rule lands in `resolveLoose`,
re-creating exactly the duplication DFEN-03 forbids.
**How to avoid:** both modes call `preflightStages` as their first statement and
`decideResolution` as their last. One computation in `preflightStages` serves
both. Verify by grepping for the helper name — it must appear exactly once as a
call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rejecting a non-boolean `defaultEnabled` | A `DefaultEnabledError` class or a coercion helper | `Type.Optional(Type.Boolean())` in `PLUGIN_METADATA_FIELDS` | The compiled validators already produce `must be boolean` with the right `instancePath`, and both failure surfaces (`InvalidMarketplaceManifestError`, `malformed plugin.json:`) are already wired. Locked decision explicitly forbids a bespoke class. |
| Adding the field to two schemas | Two separate `defaultEnabled:` lines in `PLUGIN_ENTRY_SCHEMA` and `PLUGIN_MANIFEST_SCHEMA` | One line in `PLUGIN_METADATA_FIELDS` | DFEN-01 names the shared group as the insertion point; two declarations can drift. |
| Keeping the two resolver arms in sync | Adding the field to both arm schemas | One line in `MATERIALIZABLE_FIELDS` | The bag exists precisely so the arms stay "token-identical by construction" (`resolver.ts:154-159`). |
| Threading the value to `install.ts` | A side-channel getter, an out-param, or a second return value from the resolve call | `MaterializablePlugin.defaultEnabled` | `InstallCtx.resolved` is already the materializable union; the field arrives for free. The `resolvedSha` side-channel exists only because that value is *not* derivable from the manifest. |
| Proving the arms differ | A runtime key-set assertion in a new architecture test | `@ts-expect-error` in `tests/domain/resolver.types.test.ts` | That file's whole design is compile-time assertions, and `npm run typecheck` is the enforcing gate. A runtime clause would duplicate it. |

**Key insight:** every mechanism this phase needs already exists and is already
gated. The phase is an insertion into two existing extension points plus the
compile-driven fan-out that insertion causes.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in), Node `>=20.19.0`, `.ts` run natively via type stripping |
| Config file | none — suites are selected by glob in `package.json` scripts `[VERIFIED: package.json:82]` |
| Quick run command | `node --test "tests/domain/**/*.test.ts"` |
| Full suite command | `npm run check` (`typecheck && lint && format:check && test && test:integration`) `[VERIFIED: package.json:77]` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DFEN-01 | entry accepts `defaultEnabled: false`; manifest accepts it; non-boolean rejected on both; unknown key still accepted | unit | `node --test "tests/domain/manifest.test.ts"` | ✅ |
| DFEN-01 | a malformed `defaultEnabled` in one entry invalidates the whole `marketplace.json` via `InvalidMarketplaceManifestError` | unit | `node --test "tests/domain/manifest.test.ts"` | ✅ |
| DFEN-01 | a `plugin.json` with a non-boolean `defaultEnabled` resolves `unavailable` with a `malformed plugin.json:` note | unit | `node --test "tests/domain/resolver-strict.test.ts"` | ✅ |
| DFEN-01 | a plugin declaring an unrelated unknown key still resolves (lenient guard) | unit | `node --test "tests/domain/resolver-strict.test.ts"` | ✅ |
| DFEN-02 | entry `false` + manifest `true` → `false` | unit | `node --test "tests/domain/resolver-strict.test.ts"` | ✅ |
| DFEN-02 | entry `true` + manifest `false` → `true` (the direction a reader guesses wrong) | unit | `node --test "tests/domain/resolver-strict.test.ts"` | ✅ |
| DFEN-02 | absent at both sites → `true`; `null` manifest → entry, then `true` | unit | `node --test "tests/domain/resolver-strict.test.ts"` | ✅ |
| DFEN-02 | manifest-only `defaultEnabled` with silent entry does **not** conflict in loose mode — still resolves, not `unavailable` | unit | `node --test "tests/domain/resolver-loose.test.ts"` | ✅ |
| DFEN-02 | `resolveLoose` resolves the same value as `resolveStrict` for the same inputs | unit | `node --test "tests/domain/resolver-loose.test.ts"` | ✅ |
| DFEN-03 | the field is readable off `MaterializablePlugin` with no narrowing, and inaccessible on `unavailable` | type-level | `npm run typecheck` | ✅ (`tests/domain/resolver.types.test.ts`) |
| Criterion 5 | a plugin declaring `defaultEnabled: false` still resolves `installable` and still installs enabled | characterization | `node --test "tests/orchestrators/plugin/install.test.ts"` | ✅ |
| No gate regression | architecture suite unchanged | regression | `node --test "tests/architecture/**/*.test.ts"` | ✅ |

### Sampling Rate

- **Per task commit:** `node --test "tests/domain/**/*.test.ts"` plus
  `npm run typecheck` (the typecheck is load-bearing for the 17-site fan-out —
  a task that edits `MATERIALIZABLE_FIELDS` without it looks green and is not).
- **Per wave merge:** `npm test` (the full unit glob — covers `tests/bridges/**`
  and `tests/orchestrators/**`, where 16 of the 17 breakages live).
- **Phase gate:** `npm run check` green before `/gsd-verify-work`.

### Wave 0 Gaps

None — every target test file already exists and the framework is installed. No
new fixture directory, no `conftest`-equivalent, no framework install.

## Project Constraints (from CLAUDE.md)

Directives this phase must respect, as stated in the worktree `CLAUDE.md` and the
linked convention docs:

- **Never commit to `main`.** Work stays on `features/defaults-enabled` in the
  worktree at `/home/acolomba/pi-claude-marketplace/.worktrees/defaults-enabled`.
- **`pre-commit run --all-files` before `git commit`**, never `--no-verify`. From
  inside this worktree, prefix with `SKIP=trufflehog` **only after** running the
  filesystem-mode trufflehog scan documented in `CLAUDE.md`; do not extend `SKIP=`
  to other hooks. CI runs `--all-files`, so a scoped `--files` run can hide
  pre-existing violations.
- **Conventional Commits**, title 5–72 chars, body lines ≤ 80, **no GSD
  milestone/phase mentions**.
- **`npm run check` must stay green** (NFR-6) — typecheck + ESLint +
  Prettier + tests + integration tests.
- **Comment policy** (`.claude/rules/typescript-comments.md`): cite decision and
  requirement IDs (`DFEN-01`, `D-64-05`, `NFR-7`, `MM-2`) as traceability anchors;
  **never** cite `Phase NN`, `Plan NN`, `Wave N`, `Task N`, `Pitfall N`, or
  `vX.Y milestone`. This applies to test titles as well as comments.
- **Explicit return types on every exported function**
  (`@typescript-eslint/explicit-module-boundary-types: "error"`). The precedence
  helper is private, but annotate it anyway to match the file's style.
- **`curly: ["error", "all"]`** and
  **`@stylistic/padding-line-between-statements`** — braces always, blank line
  after every block-like statement. The helper's early returns must each be
  followed by a blank line, matching `sourceUnsupportedReason` and
  `detectOrphanRewake` in the same file.
- **Import order** enforced by `import-x/order`: builtin → external → internal →
  parent → sibling → index → object → type, blank line between groups,
  alphabetized within a group, type-only imports last. Test files import
  production modules with explicit `.ts` extensions.
- **Prettier**: `printWidth: 100`, `tabWidth: 2`, `trailingComma: "all"`.
- **Domain layer depends on `shared/` only** — the precedence helper must not
  reach into `persistence/`, `orchestrators/`, or `platform/`.
- **GSD workflow enforcement**: file edits go through a GSD command
  (`/gsd-execute-phase` for this work), not ad-hoc.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Boolean `installable: true \| false` on the resolver output (D-05) | Three-way `state: "installable" \| "partially-available" \| "unavailable"` (D-64-01) | shipped pre-v1.18 | The field bag `MATERIALIZABLE_FIELDS` exists *because* of this change — it is what keeps the two payload-bearing arms identical. It is the correct and intended extension point. `[VERIFIED: extensions/pi-claude-marketplace/domain/resolver.ts:15-22]` |
| No resolved metadata at all | `defaultEnabled` becomes the first metadata field with genuine entry-vs-manifest precedence | this phase | `description` and `version` are schema-accepted and read straight off the entry by `info`; there is no existing precedence helper to copy. The component-path union (`entry > manifest order`, `resolver.ts:1359-1364`) is the closest analog but is per-kind and additive, not first-wins scalar. |

**Upstream contract** `[CITED: code.claude.com/docs/en/plugins-reference, verified
2026-08-14 per CONTEXT.md and REQUIREMENTS.md — not re-fetched this session]`:
`defaultEnabled` defaults to `true`; the marketplace entry value takes precedence
over `plugin.json`; Claude Code v2.1.154+ honors it and earlier versions ignore it
and enable on install.

## Security Domain

This phase adds one optional boolean to two input schemas and one derived boolean
to an internal type. No new I/O, no new network path, no new filesystem write, no
new user-controlled string reaching a path or a command.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | untouched — no credential surface in `domain/` |
| V3 Session Management | no | not applicable to a CLI extension's domain layer |
| V4 Access Control | no | no authorization decision is introduced |
| V5 Input Validation | **yes** | TypeBox `Type.Optional(Type.Boolean())` on both untrusted declaration sites, JIT-compiled per D-07 and enforced before the value is read |
| V6 Cryptography | no | no crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A hostile `marketplace.json` supplies a non-boolean `defaultEnabled` to force a type confusion downstream | Tampering | `MARKETPLACE_VALIDATOR.Check` rejects the whole manifest before any consumer reads it; the resolver's `typeof === "boolean"` narrow is defense-in-depth on top |
| A hostile `plugin.json` supplies a non-boolean value | Tampering | `readManifest` runs `PLUGIN_MANIFEST_VALIDATOR.Check` and resolves `unavailable` — the plugin cannot install at all |
| A plugin ships `defaultEnabled: false` to appear inert while still materializing artifacts | Elevation of Privilege | Out of scope this phase (nothing acts on the value yet). Phase 102 must ensure "installs disabled" genuinely means artifacts are not materialized, per DFEN-04 |

No new secret, no new external input channel, no new trust boundary.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Option A (explicit return field through `preflightStages` → `decideResolution` → constructors) is preferable to Option B (thread through `PartialResolution`) | Where the value is computed | Low. Both satisfy the locked decisions; CONTEXT.md explicitly grants this discretion. Option B is a smaller diff and is a legitimate pick if the planner weighs diff size over compile-enforcement. |
| A2 | `defaultEnabled: true` is the right fixture value for all 16 breaking test sites | Construction sites that break | Low. Any other value would change behavior in suites unrelated to this phase, which criterion 5 forbids. |
| A3 | Uniform `typeof === "boolean"` on both the entry and manifest side honors CONTEXT.md's "`=== undefined`" instruction | The precedence helper | Low. The instruction's stated purpose is to forbid `in` (key-presence) in favor of a value test; `typeof` is a value test. The manifest side additionally *requires* it for type narrowing. If the planner reads the instruction more literally, use `entry.defaultEnabled !== undefined` on the entry side only — behavior is identical for all validator-approved inputs. |
| A4 | The upstream contract (default `true`, entry wins, v2.1.154+) is as recorded in CONTEXT.md/REQUIREMENTS.md | State of the Art | Low. It was verified against the official docs on 2026-08-14 by the discuss session; I did not re-fetch it this session. It only corroborates decisions that are already locked. |
| A5 | `tests/domain/resolver.types.test.ts` is the right home for the DFEN-03 type-level proof | Test conventions | Low. CONTEXT.md grants test-placement discretion; that file's `declare const` design makes it the only zero-cost option. |

## Open Questions (RESOLVED)

Both questions carry an explicit recommendation below, and the plans act on both:
plan 101-01/101-02 add no architecture gate, and plan 101-03 Task 3 adds the
`info` characterization test.

1. **RESOLVED: Should this phase add any assertion to `tests/architecture/`?**
   - What we know: no existing architecture gate trips, and none pins the
     resolver arm key sets.
   - What's unclear: whether the milestone wants a *new* enumeration gate pinning
     the materializable arm key set, the way COMPAT-01 pins the install record's.
   - Recommendation: **no.** `tests/domain/resolver.types.test.ts` already proves
     the arm asymmetry at compile time, and COMPAT-01's own file header forbids
     adding derived or duplicated pins. If the milestone later wants one, it
     belongs with the persistence work, not here.

2. **RESOLVED: Does the `info` surface need to stop rendering something?**
   - What we know: `info` reads `description` straight off the raw parsed entry
     `[VERIFIED: extensions/pi-claude-marketplace/domain/manifest.ts:48-49,
     "`info.ts` reads `parsed.description`"]`, and the loader returns the raw
     `JSON.parse` value so extra fields survive.
   - What's unclear: nothing for this phase — `info` has no generic
     field-enumeration renderer that would suddenly start printing
     `defaultEnabled`.
   - Recommendation: confirm with one characterization test that `info` output is
     unchanged for a `defaultEnabled: false` plugin, then leave it to Phase 104
     (OUT-03/OUT-05).

## Sections omitted, with reasons

- **Package Legitimacy Audit** — omitted. This phase installs no external
  package. `typebox` (`^1.1.38`) and `node:test` are existing pinned
  dependencies; no `npm install` occurs.
- **Environment Availability** — omitted. No external tool, service, runtime, or
  CLI beyond the already-installed toolchain is required. The one command the
  plan needs (`npx tsc --noEmit`) was exercised successfully in this session.
- **Runtime State Inventory** — omitted. This is not a rename, refactor,
  migration, or string-replacement phase. No persisted data, live service config,
  OS registration, secret, or build artifact carries a value this phase changes.
  Explicitly confirmed: `defaultEnabled` appears nowhere in `extensions/`,
  `tests/`, or `docs/` today `[VERIFIED: grep across the worktree — the only hits
  are the four `.planning/workstreams/defaults-enabled/` documents]`.

## Sources

### Primary (HIGH confidence)

- `npx tsc --noEmit` with the exact `MATERIALIZABLE_FIELDS` edit applied, then
  reverted — the 17-site breakage enumeration
- `node --test "tests/{architecture,domain}/**/*.test.ts"` with the
  `PLUGIN_METADATA_FIELDS` edit applied — 720 tests, 719 pass, 0 fail, 1 skipped
- TypeBox probe script against the real `PLUGIN_ENTRY_VALIDATOR`,
  `PLUGIN_MANIFEST_VALIDATOR`, `MARKETPLACE_VALIDATOR` and a compiled copy of the
  proposed schema — the accept/reject matrix and error-object shapes
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` (read in full,
  103 lines)
- `extensions/pi-claude-marketplace/domain/resolver.ts` (read in full, 1535 lines)
- `extensions/pi-claude-marketplace/domain/manifest.ts` (read in full, 100 lines)
- `tests/architecture/compat-01-no-expansion.test.ts` (read in full, 448 lines)
- `tests/domain/resolver.types.test.ts` (read in full, 135 lines)
- `tests/architecture/no-hooks-strict-additional-properties.test.ts` (read in
  full, 123 lines)
- `.planning/workstreams/defaults-enabled/phases/101-.../101-CONTEXT.md` and
  `.planning/workstreams/defaults-enabled/REQUIREMENTS.md` (read in full)

### Secondary (MEDIUM confidence)

- Targeted `sed` / `grep` reads of `tests/domain/resolver-strict.test.ts`,
  `tests/domain/resolver-loose.test.ts`, `tests/domain/manifest.test.ts`,
  `tests/orchestrators/plugin/plugin-state-classifier.test.ts`, the nine breaking
  bridge test files, `orchestrators/plugin/install.ts`, and
  `tests/architecture/hooks-foundation.test.ts` — quoted verbatim where cited
- `.planning/codebase/ARCHITECTURE.md`, `CONVENTIONS.md`, `STACK.md`, worktree
  `CLAUDE.md`, `.claude/rules/typescript-comments.md`, `.planning/config.json`,
  `package.json`

### Tertiary (LOW confidence)

- The upstream `code.claude.com/docs/en/plugins-reference` contract, carried
  forward from the discuss session's 2026-08-14 verification rather than
  re-fetched here (see A4)

## Metadata

**Confidence breakdown:**

- Schema edit and its blast radius: **HIGH** — measured against the compiled
  validators and the full architecture + domain suites
- Resolver edit and the construction-site fan-out: **HIGH** — the 17-site list is
  `tsc` output, not inference
- Architecture gates: **HIGH** — the suspected gate was read in full and the
  whole suite was run with the edit applied
- Loose-mode conflict immunity: **HIGH** — traced through three closed-set
  iterations in source
- Wiring recommendation (Option A vs B): **MEDIUM** — a judgment call inside
  granted discretion, not a measurement

**Research date:** 2026-08-14
**Valid until:** 2026-09-13 (stable in-repo domain; invalidated early only by a
change to `domain/resolver.ts` or `domain/components/plugin.ts` on `main`)

**Worktree state:** all probe edits reverted;
`git status --porcelain` reported zero modified files at the end of this session.
