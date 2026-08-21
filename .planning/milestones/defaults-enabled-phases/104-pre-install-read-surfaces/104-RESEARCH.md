# Phase 104: Pre-install read surfaces - Research

**Researched:** 2026-08-15
**Domain:** In-repo read-surface rendering (`orchestrators/plugin/list.ts`, `orchestrators/plugin/info.ts`, `shared/notify.ts`, `domain/resolver.ts`) — no external technology
**Confidence:** HIGH (every load-bearing claim was executed, not read)

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Value Source and Warm/Cold Symmetry

- **The marketplace entry is the ONLY source** these two surfaces read for the
  claim (`entry.defaultEnabled` from the cached `marketplace.json`). They never
  read `plugin.json`, not even where a warm clone makes it readable fs-only. The
  entry is the one source readable for EVERY plugin regardless of clone state,
  which is what lets an unfetched `(remote)` row carry the claim (criterion 3),
  and it makes the same plugin render identically warm and cold.

- **When the entry is silent, neither surface claims anything**, even if a warm
  clone's `plugin.json` declares `defaultEnabled: false`. Criterion 4 names
  declining the correct answer, not a gap. This is the deliberate divergence
  from `install`, which DOES read `plugin.json` through `resolveDefaultEnabled`
  — Phase 105 records it as a contract divergence (DOC-02).

- **One shared helper answers the question**, exported from `domain/` beside
  `resolveDefaultEnabled` (e.g. `entryDeclaresInstallDisabled(entry)`), consumed
  by both `list` and `info`. This carries forward the Phase 101 anchor that the
  `defaultEnabled` question is answered in exactly one place per read mode, and
  matches the house pattern of a single shared classifier
  (`orchestrators/plugin/plugin-state-classifier.ts`).

- **A non-boolean or malformed `defaultEnabled` on the entry counts as silent.**
  Only a literal `false` claims. This mirrors `resolveDefaultEnabled`'s existing
  `typeof entry.defaultEnabled === "boolean"` guard
  (`domain/resolver.ts:655`), so the read surfaces and the install path agree on
  what counts as a declaration. No separate malformed-manifest reason is
  introduced.

#### Row Arms That Carry the Token

- **`(available)` — YES.** Criterion 1's direct target.
  `PluginAvailableMessage` (`shared/notify.ts:824`) gains an OPTIONAL `reasons`
  field, and the `available` arm in
  `orchestrators/plugin/list.messaging.ts` stops passing a hard-coded
  `undefined` into `composeReasons` and forwards `p.reasons` instead.

- **`(remote)` — YES.** Criterion 3 names the unfetched remote row explicitly,
  and the entry is readable with no clone at all. D-80-03's "bare row — NO
  reasons brace" note NARROWS to "no probe- or soft-dep-derived reasons", not
  "no reasons ever": the remote arm gains a reasons brace fed only by this
  entry-derived token. `PluginRemoteMessage` (`shared/notify.ts:842`) gains the
  same optional `reasons` field.

- **`(partially-available)` — YES.** It is a not-installed row whose install
  would land disabled, so the claim is true there. The arm already forwards
  `p.reasons`, so this costs no plumbing beyond the orchestrator stamping it.

- **`(unavailable)` — NO.** Nothing will install at all, so `{installs
  disabled}` would be a claim about an install that cannot happen; the row's
  brace already carries why it cannot. The arm is left alone.

- **Criterion 5 falls out of the above rather than needing its own guard:** the
  `installed`, `disabled`, `partially-installed`, `partially-installed-upgradable`,
  `upgradable`, `partially-upgradable` and `failed` arms are untouched, so an
  installed plugin's row cannot acquire the token.

#### Token Choice and the info Surface

- **Reuse the EXISTING `installs disabled` member** of `DECLARED_STATE_REASONS`
  (`shared/notify-reasons.ts:157`). No new token is minted, so COMPAT-01's
  locked reason-token tuple (`tests/architecture/compat-01-no-expansion.test.ts`)
  needs no amendment, and the read surface says exactly the words the install
  surface will say when the user runs the install. The rejected alternative was
  a new `will install disabled` token following the `will uninstall`
  deferred-action precedent — it costs a COMPAT-01 amendment, a catalog token
  row and a fixture, to restate a fact the existing token already states.

- **`info` expresses the fact through the SAME `{installs disabled}` reason
  brace on its plugin row**, not through a new body line. `info` already renders
  the subject-first row grammar with a reason brace; a body line would be a
  second grammar for one fact.

- **`info --fetch` changes nothing about the claim's source.** A fetch may flip
  a row from `(remote)` to `(available)`, but the token still comes from the
  entry. The surface does not read the newly materialized `plugin.json`.

- **The `docs/output-catalog.md` blocks land in THIS phase**, not deferred to
  Phase 105's DOC-01 sweep: the catalog carries a byte-equality runner over what
  it documents, so an undocumented row is an unguarded row. New blocks cover the
  `(available)` and `(remote)` list rows and the `info` row.

### Claude's Discretion

- The exact name and signature of the shared `domain/` helper.
- Whether the orchestrator stamps the reason at the row-build site or through a
  small composer, so long as both surfaces reach the same single helper.
- Test file placement and fixture naming, following the existing
  `tests/orchestrators/plugin/` and `tests/architecture/catalog-uat.test.ts`
  conventions.

### Deferred Ideas (OUT OF SCOPE)

- **Reading `plugin.json` on a warm clone** so `list`/`info` match `install`
  exactly. Rejected here for warm/cold symmetry; recorded so a later reader does
  not re-open it as an oversight.

- **A `will install disabled` token** distinct from the install surface's
  `installs disabled`. Rejected for COMPAT-01 cost against no gain in
  information.

- **DFEN-08 parity sweep and the DOC-02 divergence write-up** — Phase 105 owns
  both.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OUT-02 | `plugin list` renders `{installs disabled}` on the row of a not-installed plugin whose resolved `defaultEnabled` is `false`, following the established subject-first row grammar. | Single row-build function `availableRowMessage` (`list.ts:632-780`) holds the entry in scope at all four arms — §Architecture Patterns, Pattern 1. Prototype rendered `○ alpha v1.0.0 (available) {installs disabled}` end-to-end — §Probe Log P3. |
| OUT-03 | `plugin info` reports that the plugin will install disabled, so a user can see it before committing to the install. | `renderPluginInfo` (`notify.ts:3427-3446`) ALREADY forwards `plugin.reasons` through `composeReasons` for every info status, and `PluginInfoRowBase` (`notify.ts:1365-1394`) ALREADY carries an optional `reasons`. Zero renderer/shape change — §Finding F2. One composer at the single not-installed call site (`info.ts:892-903`) covers all eight not-installed return sites — §Architecture Patterns, Pattern 2. |
| OUT-05 | `list` and `info` stay network-free; must not claim on an unreadable `plugin.json` and must not fetch to read it. | The source-grep gate (`tests/architecture/no-orchestrator-network.test.ts`) already names both files; a `domain/resolver.ts` helper adds zero git surface — §Finding F6. The declining case (entry silent + `plugin.json` declares `false`) was probed and correctly declines — §Probe Log P3, plugin `gamma`. The existing behavioral offline guard is defective and must NOT be copied — §Pitfall 4. |

</phase_requirements>

## Summary

This phase is far cheaper than the CONTEXT's integration-point list implies, and
the reason is that half the machinery already exists. `info` needs **no** message-shape
change and **no** renderer change at all: `PluginInfoRowBase` already declares
`reasons?: readonly ContentReason[]`, and `renderPluginInfo` already pipes it
through `composeReasons` for every one of its eight statuses. Only `list` needs
type and renderer edits, and those are two field additions plus two one-line arm
changes.

The plumbing question the priorities asked about resolves cleanly on both
surfaces. On `list`, all four not-installed rows are built inside ONE function,
`availableRowMessage`, whose first parameter IS the marketplace entry — the entry
is in scope at every arm, so nothing needs threading. On `info` the picture looked
worse (eight distinct not-installed return sites across five builders, three of
which do not receive the entry), but all of them funnel through a single
`buildBlock` call site at `info.ts:892-903` where `entry` IS in scope. Applying the
claim there as a post-hoc row shape is the existing house pattern: the sibling
`applyDisabledRowShape(row, installed)` (`info.ts:986`) does exactly this, at the
same function's other arms, for the same kind of reason-brace narrowing.

I built the whole thing as a throwaway prototype and ran it. `npm test` (3517
tests) passed with the prototype in place, and passed again with only the
renderer half applied — which is the DFEN-08 inertness proof the priorities asked
for. `composeReasons` returns `""` identically for `undefined` and for `[]`, so
the byte-identity risk named in priority 6 does not exist. The prototype was then
reverted; `git status` is clean.

**Primary recommendation:** one exported predicate in `domain/resolver.ts`; two
optional `reasons` fields on `PluginAvailableMessage` / `PluginRemoteMessage`; two
one-line render-arm edits in `list.messaging.ts`; one stamp inside
`availableRowMessage`; one `applyInstallDisabledRowShape` composer at
`info.ts:903` modeled byte-for-byte on `applyDisabledRowShape`. `info.ts`'s eight
inner return sites are not touched.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decide whether an entry declares install-disabled | `domain/` | — | Pure, network-free entry inspection; sits beside `resolveDefaultEnabled` so the two readings of the same field are adjacent (Phase 101 anchor, CONTEXT locked decision) |
| Stamp the reason onto a not-installed row | `orchestrators/plugin/` | — | Which reasons a surface stamps is an ORCHESTRATOR decision (D-95-01); the render map holds no allowlist |
| Render the reason brace | `shared/notify.ts` + `*.messaging.ts` | — | `composeReasons` is the single byte-stable brace composer (D-11) |
| Document the new byte forms | `docs/output-catalog.md` | `docs/messaging-style-guide.md` | The catalog carries a byte-equality runner; the style guide carries the field-discipline prose |
| Prove no network | `tests/architecture/no-orchestrator-network.test.ts` (existing) | new behavioral test | Source-grep gate already covers both files; behavioral proof needs a NEW correct guard (§Pitfall 4) |

## Project Constraints (from CLAUDE.md)

| Directive | Bearing on this phase |
|-----------|----------------------|
| All user-visible output through `ctx.ui.notify` via `shared/notify.ts` (IL-2) | Satisfied — everything routes through `notify()` / `notifyWithContext()` already |
| `list` / `info` MUST NOT touch the network (NFR-5) | Central to OUT-05; the entry-only source is what makes this free |
| `npm run check` green (NFR-6) | Verified green under the full prototype: typecheck, eslint, and `npm test` all clean |
| Comments cite durable spec IDs, never `Phase NN` / `Plan NN` / `Wave N` / `Pitfall N` | Use `OUT-02`, `OUT-03`, `OUT-05`, `DFEN-08`, `D-80-03`, `RSTA-01`, `NFR-5`, and the new `D-104-NN` decision IDs |
| Never commit to `main`; work stays on `features/defaults-enabled` in the worktree | Already the case |
| `pre-commit run --all-files` BEFORE `git commit`; `SKIP=trufflehog` from a worktree only after a clean filesystem scan | Applies to every commit in this phase |
| Markdown is formatted by `mdformat`/`markdownlint`, not prettier | This phase edits three `.md` files; do not run `prettier --write` on them |

## Standard Stack

No external packages are added, removed, or upgraded by this phase. Every symbol
it needs already exists in-repo.

### Core (existing, in-repo)

| Symbol | Location | Purpose |
|--------|----------|---------|
| `resolveDefaultEnabled` | `domain/resolver.ts:651-664` | The DFEN-02 precedence function; the new helper sits beside it and mirrors its `typeof === "boolean"` discipline |
| `PLUGIN_METADATA_FIELDS.defaultEnabled` | `domain/components/plugin.ts:25` | `defaultEnabled: Type.Optional(Type.Boolean())` — the schema field on both declaration sites |
| `"installs disabled"` | `shared/notify.ts:183`, grouped at `shared/notify-reasons.ts:157-161` | The reason token, already closed-set-locked |
| `composeReasons` | `shared/notify.ts:2068-2081` | The single brace composer; returns `""` for `undefined` AND for `[]` |
| `applyDisabledRowShape` | `orchestrators/plugin/info.ts:986-1005` | The post-hoc row-shape precedent this phase copies |
| `availableRowMessage` | `orchestrators/plugin/list.ts:632-780` | The single list-side not-installed row builder |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A composer at `info.ts:903` | Threading `installsDisabled: boolean` into all five info builders | Costs five signature edits and eight return-site edits, versus one function. The composer also cannot miss an arm; the threading approach silently misses any arm whose author forgets. Reject. |
| A composer at `info.ts:903` | A composer at `list.ts` too | On `list` the entry is already in scope in the one builder, so a local `declaredField` spread is simpler and matches the sibling `descriptionField` / `notInManifestField` idiom already in that file (`list.ts:563-565`). Use the local spread on `list`, the composer on `info`. |
| An exported `entryDeclaresInstallDisabled(entry)` | Exporting `resolveDefaultEnabled` and calling it with `null` | Exporting the two-source precedence function to be called with a deliberately-null second argument invites a later caller to pass a real manifest and silently reopen the warm/cold asymmetry OUT-05 forbids. A separate one-line predicate cannot be misused that way. |

**Installation:** none — no package changes.

## Package Legitimacy Audit

**Not applicable.** This phase installs no external packages. No dependency is
added, removed, or version-bumped. The `package.json` / `package-lock.json` pair
is untouched.

## Architecture Patterns

### System Architecture Diagram

```text
                       cached marketplace.json  (fs read, NO network)
                                    │
                       loadMarketplaceManifest()
                                    │
                            entry: PluginEntry
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
             list orchestrator                info orchestrator
     orchestrators/plugin/list.ts       orchestrators/plugin/info.ts
                    │                               │
       availableRowMessage(entry, …)          buildBlock(…) arm (d)/(e)
       ┌── remote ──┐                                │
       ├── available│  ← entry in scope       buildNotInstalledRow(…)
       ├── partially-available                       │  (5 builders,
       └── unavailable  (NOT stamped)                │   8 return sites)
                    │                                │
                    │                          row: PluginInfoRow
                    │                                │
                    └──────────┬─────────────────────┘
                               │
              domain/resolver.ts::entryDeclaresInstallDisabled(entry)
                    (pure predicate — entry.defaultEnabled === false)
                               │
                    ┌──────────┴──────────┐
       list: spread `reasons`   info: applyInstallDisabledRowShape(row, entry)
       onto the row message     (status-gated post-hoc shape, sibling of
                    │            applyDisabledRowShape)
                    │                     │
        LIST_RENDER arm forwards      renderPluginInfo forwards
        p.reasons → composeReasons    plugin.reasons → composeReasons
                    │                     │   (ALREADY DOES — no change)
                    └──────────┬──────────┘
                               │
                    "{installs disabled}" brace
                               │
                        ctx.ui.notify(body)
```

### Pattern 1 — `list`: local field spread inside the one builder

`availableRowMessage` (`list.ts:632-780`) receives the marketplace entry as its
first parameter and builds all four not-installed rows from it. It already uses
exactly this idiom for the description:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:637-639 (VERBATIM)
  const descriptionField: { readonly description?: string } =
    manifestEntry.description === undefined ? {} : { description: manifestEntry.description };
```

and the same idiom appears again for the manifest-absence reason:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:563-565 (VERBATIM)
  const notInManifestField: {
    readonly reasons?: NonNullable<PluginInstalledMessage["reasons"]>;
  } = notInManifest ? { reasons: ["not in manifest"] } : {};
```

Add a third such field, spread it into the `remote` and `available` arms, and
append it to the `partially-available` arm's existing `reasons` array. Do NOT
spread it into either `unavailable` arm (the `switch` arm at `list.ts:733` and
the probe-failure `catch` at `list.ts:768`).

**When to use:** the entry is already in scope and the builder is one function.

### Pattern 2 — `info`: post-hoc row shape at the single not-installed call site

`info.ts` has eight not-installed return sites across five builders. Three of the
five (`buildRemoteNotInstalledRow`, `buildWarmGitNonInstallableRow`,
`buildAvailableRow`) do NOT receive `entry`. All eight funnel through one place:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:892-903 (VERBATIM)
  const row = await buildNotInstalledRow({
    pluginName,
    version: manifestVersion,
    description,
    dependencies,
    entry,
    mpRecord,
    parsedSource,
    locations,
    ...(fetchCtx !== undefined && { fetchCtx }),
  });
  return wrapBlock(marketplace, scope, marketplaceDetails, row);
```

`entry` is in scope. Wrap `row` exactly as the two installed arms of the same
function already wrap theirs with `applyDisabledRowShape(row, installed)`
(`info.ts:830`, `info.ts:882`). The shape function that worked in the prototype:

```ts
// Prototype, verified end-to-end; PROBED: probe3.ts under `npm test` green
const INSTALL_DISABLED_ROW_STATUSES: ReadonlySet<PluginInfoRow["status"]> = new Set<
  PluginInfoRow["status"]
>(["available", "remote", "partially-available"]);

function applyInstallDisabledRowShape(
  row: PluginInfoRow,
  entry: MarketplaceManifest["plugins"][number],
): PluginInfoRow {
  if (!entryDeclaresInstallDisabled(entry) || !INSTALL_DISABLED_ROW_STATUSES.has(row.status)) {
    return row;
  }

  return { ...row, reasons: [...(row.reasons ?? []), "installs disabled"] };
}
```

**When to use:** many producers, one consumer, and the deciding datum is in scope
only at the consumer.

**Note on the `Set` and exhaustiveness.** A `ReadonlySet<PluginInfoRow["status"]>`
is NOT an exhaustiveness gate — a ninth info status added later would silently not
carry the token. The house alternative is an `as const satisfies
Record<PluginInfoRow["status"], boolean>` total map, which makes a new status a
compile error at this site. `applyDisabledRowShape`'s sibling
`DISABLED_ROW_REASONS` (`info.ts:1000-1007`) uses a plain `ReadonlySet` for the
same reason (its members are reasons, not statuses, and no total-map idiom
applies). Because THIS set is keyed by a closed status union, the total map is
available and is the stronger choice. Planner should pick one deliberately.

### Pattern 3 — the reason-brace append order

Where a row already has reasons, the declared token appends at the tail. This
matches the existing composition in the same file:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:1863 (VERBATIM)
      reasons: [...resolverReasons, narrowProbeError(err)],
```

Probed output: `⊖ zeta v1.0.0 (partially-available) {lsp, installs disabled}`.
There is no per-row reason sort; `composeReasons` joins in array order
(`notify.ts:2074-2081`). The `REASONS` tuple's order is a catalog-membership lock
(OUT-08), not a render sort.

### Anti-Patterns to Avoid

- **Threading a boolean through `info`'s five builders.** Eight return sites, five
  signatures, and no compile-time guarantee that a future sixth builder inherits
  the rule. The composer at one call site has all three properties the threading
  lacks.
- **Reading `plugin.json` anywhere on these two paths.** Locked out by CONTEXT and
  by OUT-05. The probed `gamma` case (entry silent, `plugin.json` declares `false`)
  correctly renders bare — that is the criterion-4 pass, not a gap.
- **Special-casing the degraded `(remote)` arms.** See §Decision Conflicts, DC-1 —
  this needs a decision, but the answer that keeps the code uniform is to let the
  composer stamp them too.
- **Copying the existing "no plugin-clones dir" offline guard.** It is defective;
  see §Pitfall 4.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rendering the `{…}` brace | A per-arm string concat | `composeReasons(reasons, false, false, probe)` | Sole byte-stable brace composer (D-11); handles the empty case, the separator, and the soft-dep injection contract |
| Suppressing the brace when there is nothing to say | An `if (reasons.length > 0)` guard at the arm | `composeReasons` + `joinTokens` | `composeReasons` returns `""` for `undefined` and `[]` alike; `joinTokens` filters `""` slots (`notify.ts:1922-1924`). PROBED identical bytes. |
| Deciding "is this a declaration" | `entry.defaultEnabled !== true` or `!entry.defaultEnabled` | `entry.defaultEnabled === false` (the new predicate) | `!entry.defaultEnabled` is true for `undefined`, which would claim on every silent entry; `!== true` is true for a smuggled non-boolean, which CONTEXT rules is silent |
| Post-hoc row narrowing on `info` | A new bespoke mechanism | The `applyDisabledRowShape` shape | Same function, same arm family, same problem class; a second idiom for one fact is what D-95's grammar discipline forbids |

**Key insight:** the reason-brace path in this codebase is already total and
allowlist-free. The only reason the token does not appear today is that no producer
stamps it. Every "renderer change" this phase makes is a change to *what the
producer hands over*, not to how it is drawn — with the single exception of the two
list arms that hard-code `undefined`.

## Common Pitfalls

### Pitfall 1: assuming `info` needs a shape or renderer change

**What goes wrong:** the plan budgets an `info`-side message-shape edit mirroring
the `list`-side `PluginAvailableMessage` / `PluginRemoteMessage` work, and a
renderer arm edit.
**Why it happens:** the two surfaces look symmetric, and CONTEXT's Integration
Points list names only the `list` shapes, which reads like an omission.
**Reality:** `PluginInfoRowBase` (`notify.ts:1365-1394`) already declares
`readonly reasons?: readonly ContentReason[]`, and `renderPluginInfo`
(`notify.ts:3427-3446`) already composes it for every info status.
**Warning signs:** any task that edits `PluginInfoRow*` or `renderPluginInfo`.

### Pitfall 2: missing an `info` not-installed arm

**What goes wrong:** the token appears on the plain `(available)` info row and is
silently absent on the cold `(remote)` row, the warm `(partially-available)` row,
and the three degraded arms. Criterion 2 half-passes.
**Why it happens:** `info.ts` has eight not-installed return sites; enumerated:

| # | Site | Status | `entry` in scope? |
|---|------|--------|-------------------|
| 1 | `buildGitNotInstalledRow` probe/fetch-throw arm, `info.ts:1783` | `remote` (+ failure reason) | yes |
| 2 | `buildRemoteNotInstalledRow`, `info.ts:1731` (cold clone) | `remote` | **no** |
| 3 | `buildGitNotInstalledRow` warm-tree-error catch, `info.ts:1826` | `remote` (+ failure reason) | yes |
| 4 | `buildWarmGitNonInstallableRow` success, `info.ts:1852` | `partially-available` / `unavailable` | **no** |
| 5 | `buildWarmGitNonInstallableRow` catch, `info.ts:1861` | `partially-available` / `unavailable` | **no** |
| 6 | `buildNotInstalledRow` resolveStrict-throw catch, `info.ts:1945` | `unavailable` | yes |
| 7 | `buildNotInstalledNonInstallableRow` non-locally-resolvable arm, `info.ts:2012` | `partially-available` / `unavailable` | yes |
| 8 | `buildNotInstalledPathRow` (2 returns), `info.ts:1694` / `1703` | `partially-available` / `unavailable` | yes |
| 9 | `buildAvailableRow` (2 returns), `info.ts:2056` / `2067` | `available` | **no** |

**How to avoid:** stamp once at the shared consumer (`info.ts:903`), never at the
producers. All nine rows above pass through it.
**Warning signs:** an `info.ts` diff that touches more than the import line,
`buildBlock`'s last statement, and the new shape function.

### Pitfall 3: assuming `reasons: []` and absent `reasons` differ

**What goes wrong:** DFEN-08 is presumed at risk, and the plan grows defensive
conditional-spread machinery to keep the field truly absent.
**Reality — PROBED, not reasoned:**

```
--- available (today) ---
"● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available)"
--- available + reasons:[] ---
"● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available)"
--- INFO available no reasons ---
"● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available)\n    skills: s"
--- INFO available reasons:[] ---
"● official [user] <autoupdate>\n  ○ alpha v1.0.0 (available)\n    skills: s"
```

`composeReasons` starts from `reasons === undefined ? [] : [...reasons]` and
returns `""` when the composed array is empty (`notify.ts:2074-2081`); `joinTokens`
then drops the `""` slot. `applyDisabledRowShape` (`info.ts:1003`) already sets
`reasons` unconditionally — possibly to `[]` — and has shipped that way.
**Still worth doing:** the conditional spread on `list` is cheaper and reads
better, but it is a style choice, not a DFEN-08 requirement.

### Pitfall 4: copying the existing NFR-5 behavioral guard

**What goes wrong:** the new offline test looks rigorous and proves nothing.
**The defect:** `tests/orchestrators/plugin/list.test.ts:2593-2601` reads:

```ts
    const clonesDir = path.join(userRoot, "pi-claude-marketplace", "plugin-clones");
    let clonesExisted = true;
    try {
      await readFile(clonesDir);
    } catch {
      clonesExisted = false;
    }

    assert.equal(clonesExisted, false);
```

Two independent faults. First, `readFile` on an EXISTING directory throws
`EISDIR`, so `clonesExisted` is `false` unconditionally — PROBED:
`caught: EISDIR / readFile-on-existing-dir reports existed = false`. Second, the
block runs BEFORE `listPlugins`, so even a working check would assert about the
pre-state, not about what the render did.
**How to avoid:** use `stat` (or `access`) AFTER the orchestrator call, and assert
the ENOENT branch is the one taken.
**Do not "fix" the existing test in this phase** — it is pre-existing and out of
scope per the surgical-changes rule; note it for a later capture.

### Pitfall 5: leaving the token's charter comment contradicting the code

**What goes wrong:** the source says the token must not appear where the code now
puts it. See §Decision Conflicts, DC-2 — this is a required edit, not optional
tidying.

### Pitfall 6: running prettier over the three edited `.md` files

**What goes wrong:** `npm run format` covers `js/json/ts` only. `prettier --write
docs/*.md` reflows markdown that `mdformat` (via pre-commit) owns, producing a
churny diff and a pre-commit fight.
**How to avoid:** let `pre-commit run --all-files` normalize the markdown.

## Code Examples

### The domain predicate (prototype, typechecked and lint-clean)

```ts
// Source: prototyped in extensions/pi-claude-marketplace/domain/resolver.ts,
// placed immediately above resolveDefaultEnabled (:651)
export function entryDeclaresInstallDisabled(entry: PluginEntry): boolean {
  return entry.defaultEnabled === false;
}
```

`MarketplaceManifest["plugins"][number]` IS `PluginEntry` —
`MARKETPLACE_SCHEMA.plugins` is `Type.Array(PLUGIN_ENTRY_SCHEMA)`
(`domain/manifest.ts:28`) and `PluginEntry = Type.Static<typeof
PLUGIN_ENTRY_SCHEMA>` (`domain/components/plugin.ts:83`). Both call sites can pass
their entry unchanged; no cast, no widening.

### The two list render arms (prototype, before → after)

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:114-123 — BEFORE
  available: (p, probe, mpScope) =>
    joinTokens([
      ICON_AVAILABLE,
      p.name,
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(available)",
      composeReasons(undefined, false, false, probe),
    ]),
```

becomes `composeReasons(p.reasons, false, false, probe)`. And:

```ts
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts:179-186 — BEFORE
  remote: (p, _probe, mpScope) =>
    joinTokens([
      ICON_REMOTE,
      p.name,
      renderScopeBracket(undefined, mpScope),
      renderVersion(p.version),
      "(remote)",
    ]),
```

gains a `composeReasons(p.reasons, false, false, probe)` line and un-underscores
`_probe`. Both soft-dep flags stay hard-coded `false` — the SNM-11 carve-out family
never emits soft-dep markers.

### The two message shapes

```ts
// Source: extensions/pi-claude-marketplace/shared/notify.ts:824-830 and :842-848 — each gains ONE line:
  readonly reasons?: readonly ContentReason[];
```

Verified: `npx tsc --noEmit` clean, `npx eslint` clean, and `npm test` green
(3517 pass / 0 fail) with both fields added AND both arms forwarding — before any
producer stamps anything. That is the DFEN-08 inertness proof.

## Probe Log

Every claim above marked PROBED comes from one of these. All prototype edits were
reverted; `git status --porcelain` shows only the pre-existing untracked
`.verification-ledger.json`.

| # | What was run | Result |
|---|--------------|--------|
| P1 | Direct `notifyWithContext(LIST_CONTEXT, …)` and `notify(plugin-info …)` over `reasons` absent / `[]` / populated | Absent and `[]` byte-identical on both surfaces. Info renders `{installs disabled}` on `available` and `remote` with **zero** production change. |
| P2 | Same, capturing the `ctx.ui.notify` argument count | `argc = 1` (no severity arg) for `available` and for `partially-available` with `{lsp, installs disabled}` — adding this reason does not move severity. |
| P3 | End-to-end: hermetic HOME, seeded `state.json` + `marketplace.json`, real `listPlugins` + `getPluginInfo` over 7 fixtures | See table below. |
| P4 | `readFile` on an existing directory | `EISDIR` → the existing NFR-5 guard's boolean is always `false`. |
| P5 | `npm test` with ONLY the type + render-arm changes | 3518 tests, 3517 pass, 0 fail, 1 skip. |
| P6 | `npm test` with the FULL prototype (helper + list stamp + info composer) | 3518 tests, 3517 pass, 0 fail, 1 skip. |
| P7 | `npx tsc --noEmit`, `npx eslint` over all five touched files | Both clean. `prettier --check` flagged only my hand-wrapped long lines. |

**P3 output with the full prototype (offline; no `plugin-clones/` ever created):**

```text
=== LIST ===
● official [user]
  ○ alpha v1.0.0 (available) {installs disabled}      ← entry declares false      (criterion 1)
  ○ beta v1.0.0 (available)                            ← entry silent              (DFEN-08)
  ◌ delta v1.0.0 (remote) {installs disabled}          ← cold git clone            (criterion 3)
  ◌ epsilon v1.0.0 (remote)                            ← cold git, entry silent    (DFEN-08)
  ⊘ eta v1.0.0 (unavailable) {unsupported source}      ← declares false, NOT stamped
  ○ gamma v1.0.0 (available)                           ← plugin.json says false    (criterion 4)
  ⊖ zeta v1.0.0 (partially-available) {lsp, installs disabled}

=== INFO alpha ===  ○ alpha v1.0.0 (available) {installs disabled}
=== INFO gamma ===  ○ gamma v1.0.0 (available)
=== INFO delta ===  ◌ delta v1.0.0 (remote) {installs disabled}
                        components: not resolved
=== INFO zeta  ===  ⊖ zeta v1.0.0 (partially-available) {lsp, installs disabled}
=== INFO eta   ===  ⊘ eta v1.0.0 (unavailable) {unsupported source}
```

Baseline (same fixtures, no prototype): every row bare, no `{installs disabled}`
anywhere. So the phase's whole observable delta is exactly the four braces above.

## Decision Conflicts

Items the CONTEXT decisions did not anticipate. Each needs an explicit call in the
plan, or a return to discuss.

### DC-1 — the three DEGRADED `(remote)` info rows

`info.ts` returns a `remote` row carrying a FAILURE reason in two places
(`:1783` fetch/probe throw; `:1826` warm-tree read error). Two of the three
`buildWarmGitNonInstallableRow` returns behave similarly for the
`partially-available` arm. A composer at `info.ts:903` stamps these too, producing
byte forms such as:

```text
  ◌ delta v1.0.0 (remote) {network unreachable, installs disabled}
```

CONTEXT's "row arms that carry the token" list is written per STATUS, and these
rows carry the qualifying statuses, so the composer is consistent with the letter
of the decision. But the combination was not considered.

- **Recommendation: allow it.** The claim is entry-derived and remains true
  regardless of whether the clone could be read; suppressing it would require
  per-arm logic, which is exactly what the composer exists to avoid. The two facts
  are orthogonal — one says the fetch failed, the other says what an install would
  do.
- **If rejected**, the composer must additionally gate on `row.reasons === undefined`,
  which is a weaker rule than it looks (it would also suppress the token on the
  clean `partially-available` row, contradicting CONTEXT's explicit YES for that arm).
- Either way, this byte form is NOT in the criteria and needs no catalog block
  unless the plan chooses to document it.

### DC-2 — the token's own charter comment forbids what this phase does

`shared/notify.ts:175-182`, VERBATIM:

```
  // OUT-01 / DFEN-04: an install that landed DISABLED because the plugin's OWN
  // `defaultEnabled` declaration said so. It names the CAUSE of the disabled
  // state, and only the author-declared cause. Distinct from the `(disabled)`
  // STATUS token, which names the state and says nothing about who chose it,
  // and from `already disabled` (the idempotent no-op a `disable` verb reports
  // over a record that already matched the request). A row whose disabled-ness
  // the USER chose -- a `disable` verb row, a list / info inventory row, a
  // reconcile-driven disable -- MUST NOT carry this token.
```

Two clauses are now false: "an install that landed DISABLED" (the token now also
names a FUTURE install), and the exclusion "a list / info inventory row". The
intended reading of the exclusion is *inventory* row — an installed record's row —
which this phase does not touch, so the substance survives. But as written, the
comment contradicts the code, and a later reader will read it as a violated
invariant.

Same problem, one layer down, at `shared/notify-reasons.ts:149-156`:

```
 * D-102-06: author-declared install-time state -- a fact the plugin's OWN
 * manifest declares about HOW it installs, which is neither an idempotent no-op
 * ... The desired state IS reached on these rows; what they add is the author's
 * declaration as the cause.
```

"The desired state IS reached on these rows" is false on a not-installed candidate
row — nothing has happened yet.

- **Recommendation:** amend both comments in this phase as part of the change that
  falsifies them, distinguishing *installed-record inventory rows* (still excluded)
  from *not-installed candidate rows* (newly admitted), and widening "an install
  that landed disabled" to "an install that landed, or would land, disabled". This
  is not optional tidying — leaving it is how a future phase re-litigates a settled
  decision.
- Also verify `install.messaging.ts:45` and the `PluginDisabledMessage` doc block
  (`notify.ts:~776-790`) for the same staleness.

### DC-3 — `PluginRemoteMessage` gains a field one of its three renderers ignores

`PluginRemoteMessage` is rendered by three arms: the central `renderPluginRow`
(`notify.ts:2344-2352`), `list.messaging.ts:179`, and `fetch.messaging.ts:103`.
Only the `list` arm starts forwarding. `fetch.ts:456` builds remote rows and will
never stamp `reasons`, so nothing changes today — but the field is now silently
droppable on two of three arms.

- **Recommendation:** leave both arms alone (touching `fetch` would violate the
  phase boundary) and add a one-line comment at each noting that the arm's producer
  never stamps `reasons`, so dropping it is correct rather than an oversight.
  `notify.ts:2344`'s existing D-80-03 comment needs the same narrowing as the
  `list` arm's.

### DC-4 — the `info` status set has no compile-time gate on the new composer

See the note under Pattern 2. A `ReadonlySet` of three statuses is a runtime
membership test; a ninth `PluginInfoRowBase` status added later inherits "does not
carry the token" silently. The `as const satisfies Record<PluginInfoRow["status"],
boolean>` form makes it a compile error. The plan should pick, and say why.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `(remote)` is a bare row with no reasons brace ever (D-80-03) | `(remote)` carries entry-derived reasons only; probe/soft-dep-derived reasons still excluded | this phase | Two doc prose edits + three source comments; **no test assertion changes** (see below) |
| `installs disabled` names only a completed install | names a completed OR prospective install | this phase | Two charter comments (DC-2) |

**Cost of narrowing D-80-03 — measured, not estimated.** Every reference:

| Reference | Kind | Needs change? |
|-----------|------|---------------|
| `docs/output-catalog.md:144` (glyph table: "Bare row: … no reasons brace") | prose | YES — narrow |
| `docs/output-catalog.md:380` ("no reasons brace … parity with `available`, D-80-03") | prose | YES — narrow |
| `shared/notify.ts:833-841` (`PluginRemoteMessage` doc: "NO `reasons`") | comment | YES |
| `shared/notify.ts:2345-2351` (central render arm) | comment | YES (DC-3) |
| `orchestrators/plugin/list.messaging.ts:173-178` | comment | YES |
| `orchestrators/plugin/fetch.messaging.ts:65, 103, 107` | comment | Optional (DC-3) |
| `tests/orchestrators/plugin/list.test.ts:490-511` (`assert.equal` on the bare remote row) | **assertion** | **NO** — its fixture entry declares no `defaultEnabled`, so the row stays byte-identical. Confirmed green under the full prototype (P6). |
| `tests/orchestrators/plugin/fetch.test.ts:823` | **assertion** | **NO** — same reason; `fetch` never stamps. |
| `tests/architecture/catalog-uat.test.ts:731-740` + catalog `remote-inventory` block | fixture + block | **NO** — existing state unchanged; the phase ADDS new states beside it. |

Also stale and worth one truthfulness edit: `docs/messaging-style-guide.md:41-42`
lists `PluginAvailableMessage` / `PluginRemoteMessage` field discipline
(`NO reasons` on remote), and `:66` says "Every remaining variant omits the field
entirely". Note the guide already lists a `PluginPresentMessage` that no longer
exists, so it is not test-pinned for the union — only
`tests/architecture/partial-vocabulary-guard.test.ts` reads it, and only for the
retired `--force`/`--unsupported` vocabulary. New prose must avoid those words.

## Catalog Mechanics

Concrete, so the plan can specify rather than hand-wave.

**Parser contract** (`tests/architecture/catalog-uat.test.ts:79-130`): inside a
per-command `## `-heading section, a line matching exactly
`<!-- catalog-state: ([a-z0-9-]+) -->` is paired with the body of the NEXT fenced
block. Section headings this phase needs already exist:

- `## `/claude:plugin list`` — `docs/output-catalog.md:170`
- `## `/claude:plugin info <plugin>@<marketplace>`` — `docs/output-catalog.md:1580`

**A new catalog block is four things:**

1. A `### <Heading>` with prose explaining the trigger and the severity.
2. The `<!-- catalog-state: <kebab-name> -->` marker.
3. A ```` ```text ```` fence holding the EXACT bytes `notify()` emits.
4. A matching entry in `FIXTURES` (`catalog-uat.test.ts:280`), keyed
   `FIXTURES["<section string>"]["<state>"]`, of shape
   `{ pi: piWithBothLoaded(), message: <NotificationMessage> }`. Omit
   `expectedSeverity` — these rows are info severity (PROBED P2: `argc = 1`).

**Both directions are gated.** The forward walk fails on a catalog state with no
fixture; the inverse walk (`catalog-uat.test.ts:4958-4993`) fails on a fixture
with no catalog annotation. Land block and fixture in the same commit.

**Recommended new states** (three, per CONTEXT):

| Section | State | Byte form (from P3) |
|---------|-------|---------------------|
| `/claude:plugin list` | `available-installs-disabled` | `  ○ alpha v1.0.0 (available) {installs disabled}` under a marketplace header |
| `/claude:plugin list` | `remote-installs-disabled` | `  ◌ delta v1.0.0 (remote) {installs disabled}` |
| `/claude:plugin info <plugin>@<marketplace>` | `available-installs-disabled` | `  ○ alpha v1.0.0 (available) {installs disabled}` + component lines |

The `partially-available` combination (`{lsp, installs disabled}`) is a fourth
candidate; CONTEXT names only three, so treat it as the plan's call.

The existing list section also has a `## Status token reference` table
(`docs/output-catalog.md:132-169`) whose `(remote)` row (`:144`) asserts the bare
form. Amend the sentence, not the row's identity.

## Runtime State Inventory

Not applicable — greenfield-within-an-existing-file work. No rename, no refactor,
no migration. No stored data, live service config, OS registration, secret, or
build artifact carries any value this phase changes. Explicitly verified: this
phase writes nothing to disk at runtime (both surfaces are read-only) and adds no
persisted field (REQUIREMENTS.md "Out of Scope": "Any state schema migration").

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all tests + `--experimental-strip-types` runs | ✓ | ran `npm test` (3518 tests) successfully in this worktree | — |
| `node_modules/` in the worktree | `npm test`, `tsc`, `eslint` | ✓ | present | — |
| `npx tsc` / `npx eslint` / `npx prettier` | `npm run check` | ✓ | all three executed clean | — |
| `pre-commit` | commit gate | not probed | — | CLAUDE.md's `SKIP=trufflehog` + filesystem-scan route applies from this worktree |
| Network | nothing in this phase | n/a | — | — |

**No missing dependency blocks execution.** Notably, `npm test` runs to completion
here (44s) — unlike the pi-subagents integration cases recorded in memory, no
global-peer test participates in the unit suite this phase touches.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node built-in) + `node:assert/strict` |
| Config file | none — `package.json:82` `test` script carries the glob |
| Quick run command | `node --test "tests/orchestrators/plugin/{list,info}.test.ts" "tests/architecture/catalog-uat.test.ts"` (~11s measured) |
| Full suite command | `npm test` (~44s measured, 3518 tests) |
| Full gate | `npm run check` = typecheck + lint + format:check + test + test:integration |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OUT-02 | `list` renders `{installs disabled}` on an `(available)` row whose entry declares `false` | unit | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ (add tests) |
| OUT-02 | `list` renders it on a cold `(remote)` row | unit | same | ✅ (add tests) |
| OUT-02 | `list` renders it appended on a `(partially-available)` row | unit | same | ✅ (add tests) |
| OUT-02 | `list` does NOT render it on either `(unavailable)` arm | unit | same | ✅ (add tests) |
| OUT-03 | `info` renders it on `(available)`, cold `(remote)`, and `(partially-available)` | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ (add tests) |
| OUT-02/03 | byte form matches the documented catalog blocks | contract | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (add blocks + fixtures) |
| OUT-05 | no gitOps surface in `list.ts` / `info.ts` / `domain/resolver.ts` | architecture | `node --test tests/architecture/no-orchestrator-network.test.ts` | ✅ (already covers both orchestrators; consider ADDING `domain/resolver.ts` to `FORBIDDEN_TARGETS`) |
| OUT-05 | cold `(remote)` row carries the token with NO clone materialized | unit (behavioral) | `node --test tests/orchestrators/plugin/list.test.ts` | ✅ (add — with a CORRECT guard, §Pitfall 4) |
| OUT-05 crit. 4 | entry silent + warm `plugin.json` declares `false` → row is BARE | unit | both files | ✅ (add — the highest-value test in the phase; it is the only one that fails if someone later "fixes" the divergence) |
| DFEN-08 | `defaultEnabled: true` and absent both render byte-identically to today | regression | `npm test` | ✅ — every existing list/info/catalog assertion IS this test; PROVEN green under the full prototype (P6) |
| crit. 5 | an installed / disabled / partially-installed row never acquires the token | unit | both files | ✅ (add one negative test per surface) |

### Sampling Rate

- **Per task commit:** the quick run command above (~11s).
- **Per wave merge:** `npm test`.
- **Phase gate:** `npm run check` exits 0 before `/gsd-verify-work`.

### Wave 0 Gaps

None. `tests/orchestrators/plugin/list.test.ts` (2641 lines),
`tests/orchestrators/plugin/info.test.ts` (3318 lines) and
`tests/architecture/catalog-uat.test.ts` (5028 lines) all exist with the harnesses
this phase needs:

- `withHermeticHome` + `seedMarketplace` (`list.test.ts:81-262`) — takes an
  arbitrary `manifest` object, so a `defaultEnabled: false` entry needs no helper
  change. VERIFIED by reproducing the harness in probe P3.
- `stageWarmMirror` (`list.test.ts:472-487`) — for the warm-clone criterion-4 case.
- `makeCtx()` (`list.test.ts:59-77`) — captures message + severity.
- No new framework, no new fixture file, no `conftest`-equivalent needed.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase adds no auth surface; git credential handling is untouched |
| V3 Session Management | no | No sessions |
| V4 Access Control | no | No new authorization decision |
| V5 Input Validation | yes | `defaultEnabled` is THIRD-PARTY content from a marketplace manifest. It is already validated by `PLUGIN_ENTRY_VALIDATOR` (typebox, `domain/components/plugin.ts:86`) before any read. The new predicate is `=== false`, so a smuggled non-boolean degrades to "silent" rather than to a claim — the CONTEXT rule and the safe default coincide. |
| V6 Cryptography | no | None involved |

### Known Threat Patterns for this change

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A marketplace author uses `defaultEnabled` to make a plugin *look* benign pre-install | Spoofing | Out of this phase's reach and inherently limited: the token only ever ADDS a caveat to a row; it can never remove one. `false` claims, everything else stays silent. |
| Third-party string reaching the rendered row | Tampering / injection | Impossible by construction — the field is a `boolean`, and the rendered bytes are a frozen closed-set literal (`"installs disabled"`), never interpolated content (T-69-01 discipline) |
| A read surface being tricked into a network call by manifest content | Information disclosure | NFR-5 source-grep gate + entry-only sourcing; the entry is already in memory from the cached manifest |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `partially-available` + `installs disabled` combination does not need its own catalog block | Catalog Mechanics | Low — an undocumented row is unguarded, but CONTEXT named exactly three blocks; adding a fourth is cheap if the planner disagrees |
| A2 | Adding `domain/resolver.ts` to `no-orchestrator-network.test.ts`'s `FORBIDDEN_TARGETS` is desirable | Validation Architecture | Low — the file has no git surface today; adding it is defense-in-depth, omitting it changes nothing observable |
| A3 | `pre-commit` is installed and usable in this worktree | Environment Availability | Low — not probed this session; CLAUDE.md documents the worktree workaround, so the failure mode is known and recoverable |
| A4 | The `1 skipped` test in `npm test` is pre-existing and unrelated | Probe Log P5/P6 | Low — the same count appears with and without the prototype |

Everything else in this document was either read from the cited source lines this
session or executed as a probe.

## Open Questions

1. **DC-1: do the degraded `(remote)` info rows carry the token?**
   - What we know: the composer stamps them; the claim stays truthful; the byte
     form is `{network unreachable, installs disabled}`.
   - What's unclear: whether CONTEXT's per-status YES was meant to reach a row that
     is simultaneously reporting a read failure.
   - Recommendation: allow it, and record the reasoning as a new decision ID.

2. **DC-4: `ReadonlySet` or total `Record` for the composer's status gate?**
   - What we know: both work today; only the `Record` form makes a ninth info
     status a compile error.
   - Recommendation: the total map, matching the `LIST_RENDER` /
     `MALFORMED_REASON_BY_KIND` house pattern of "a missing arm is a compile error".

3. **Should the defective NFR-5 guard at `list.test.ts:2593` be repaired here?**
   - What we know: it proves nothing (P4), and this phase writes a correct sibling
     right next to it.
   - Recommendation: do NOT fix it in this phase (surgical-changes rule); file it
     via `/gsd-capture` so it is not lost. Leaving two guards where one is known
     hollow is worse than either fixing or filing — file it.

## Sources

### Primary (HIGH confidence — read this session, at the cited lines)

- `extensions/pi-claude-marketplace/shared/notify.ts` — `:175-184` (REASONS tail +
  charter), `:824-830`, `:842-848`, `:1365-1394`, `:1922-1924`, `:2068-2081`,
  `:2344-2352`, `:3288-3324`, `:3427-3460`
- `extensions/pi-claude-marketplace/shared/notify-reasons.ts` — `:149-162`, `:217-248`
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` — full file
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — `:560-790`
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — `:760-1010`, `:1660-2095`
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `:600-700`
- `extensions/pi-claude-marketplace/domain/components/plugin.ts` — `:1-100`
- `extensions/pi-claude-marketplace/domain/manifest.ts` — `:28-37`
- `tests/architecture/no-orchestrator-network.test.ts`, `no-lifecycle-default-enabled-read.test.ts` — full files
- `tests/architecture/catalog-uat.test.ts` — `:1-300`, `:4958-5028`
- `tests/architecture/compat-01-no-expansion.test.ts`, `notify-closed-set-locks.test.ts`,
  `notify-grammar-invariant.test.ts`, `notify-stamp-coverage.test.ts`,
  `notify-producer-wire-coverage.test.ts`, `partial-vocabulary-guard.test.ts` — headers + assertion inventory
- `tests/orchestrators/plugin/list.test.ts` — `:1-262`, `:459-530`, `:2576-2608`
- `docs/output-catalog.md` — `:132-170`, `:360-400`, `:1580-1760`
- `docs/messaging-style-guide.md` — `:36-66`
- `.planning/workstreams/defaults-enabled/{STATE,REQUIREMENTS}.md`,
  `phases/104-pre-install-read-surfaces/104-CONTEXT.md`
- `CLAUDE.md`, `.claude/rules/typescript-comments.md`, `.planning/config.json`

### Executed evidence (HIGHEST confidence — probes P1-P7, §Probe Log)

All prototype edits reverted; working tree verified clean afterward.

### External

None consulted. This phase is entirely in-repo — no library API, version, or
ecosystem question arose, so the research-plan / provider seam had nothing to
fetch. The `classify-confidence` seam returns `LOW` for a `codebase` provider id
because that id is not in its provider table; direct source reads plus executed
probes are stronger evidence than any tier that table can assign, so claims here
are tagged by what produced them rather than by that verdict.

`gsd-tools query package-legitimacy check` was exercised once to confirm the seam
is reachable from this worktree. It is not otherwise used — this phase adds no
package.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — nothing external; every in-repo symbol read at its
  definition and exercised in a running prototype
- Architecture: HIGH — both integration patterns were built and run end-to-end,
  and the full 3518-test suite passed under them
- Pitfalls: HIGH — Pitfalls 1, 3, 4 were each demonstrated by execution, not
  inferred; 2 comes from an exhaustive enumeration of `info.ts` return sites
- Decision conflicts: HIGH on existence (quoted verbatim from source), the
  recommendations themselves are judgment

**Research date:** 2026-08-15
**Valid until:** 2026-09-14 (30 days — in-repo, no fast-moving external surface;
invalidated early only by another change to `notify.ts`, `list.ts` or `info.ts`)
