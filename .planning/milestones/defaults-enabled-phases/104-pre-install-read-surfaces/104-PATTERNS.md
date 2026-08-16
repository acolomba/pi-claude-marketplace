# Phase 104: Pre-install read surfaces - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 9 (2 new-symbol sites, 4 modified source, 3 modified test/doc)
**Analogs found:** 9 / 9

**Scope note:** RESEARCH.md already established WHERE each edit lands and named one
analog (`applyDisabledRowShape`, `info.ts:986`). This document does not restate
that. It answers only the questions research left open: for each new symbol, block
or test, WHICH existing sibling is the closest structural template, and what that
sibling's shape actually is.

## File Classification

| File | Change | Role | Data Flow | Closest Analog | Match Quality |
|------|--------|------|-----------|----------------|---------------|
| `domain/resolver.ts` | new exported predicate | domain / pure predicate | transform | `looksLikeShaVersion` (`domain/version.ts:56-59`) | exact (structure), see note on the doc-comment analog |
| `domain/index.ts` | possible barrel re-export | config / barrel | — | `version.ts` precedent: NOT re-exported | exact (decides: do not add) |
| `shared/notify.ts` | 2 shapes gain optional `reasons` | model / message shape | request-response | `PluginDisabledMessage.reasons?` doc block (`notify.ts:774-807`) | exact |
| `orchestrators/plugin/list.ts` | local conditional field spread | orchestrator / row builder | transform | `notInManifestField` (`list.ts:563-565`) | exact — named by research |
| `orchestrators/plugin/list.messaging.ts` | 2 render arms | messaging / render map | transform | sibling arms in same map | exact — named by research |
| `orchestrators/plugin/info.ts` | new post-hoc row composer | orchestrator / composer | transform | `applyDisabledRowShape` (`info.ts:986`) | exact — named by research |
| `tests/orchestrators/plugin/list.test.ts` | new tests | test | — | 3 distinct analogs, see below | exact |
| `tests/orchestrators/plugin/info.test.ts` | new tests | test | — | 3 distinct analogs, see below | exact |
| `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` | 3 block/fixture pairs | doc + contract test | — | `remote-inventory` pair; `install-disabled` prose | exact |

## Pattern Assignments

### `domain/resolver.ts` — the new exported predicate

**Structural analog: `looksLikeShaVersion` (`extensions/pi-claude-marketplace/domain/version.ts:56-59`).**

This is the house form for a one-line exported boolean predicate in `domain/`:
a single-line `/** ... */` citing the spec IDs, `export function`, explicit
`: boolean` return type (mandatory — `explicit-module-boundary-types` is
`"error"`), no opts bag.

```ts
// Source: extensions/pi-claude-marketplace/domain/version.ts:56-59 (VERBATIM)
/** D-77-01 / PURL-09: true iff `v` is exactly `sha-<12 lowercase hex>`. */
export function looksLikeShaVersion(v: string): boolean {
  return SHA_VERSION_RE.test(v);
}
```

It is the ONLY close analog. The domain tier has just two exported boolean
predicates repo-wide (`looksLikeShaVersion`; `isDispatchableEvent` at
`domain/components/hook-events.ts:135`, which is a type guard and therefore the
wrong shape here — the new helper narrows nothing).

Naming convention: `CONVENTIONS.md` pins predicates to `is*` / `classify*` /
`looksLike*`. CONTEXT's sketch name `entryDeclaresInstallDisabled` is verb-first
but matches none of those three prefixes. The planner should either keep it (it
reads better at the two call sites and the convention list is illustrative, not
gate-enforced) or pick `declaresInstallDisabled` / `entryInstallsDisabled` — but
should say which and why, because a reviewer will ask.

**Doc-comment analog — deliberately NOT `looksLikeShaVersion`.** A one-liner is
too thin for this symbol: the load-bearing fact is the *silence* rule (only a
literal `false` claims). Copy the density and shape of the sibling it sits
against, `resolveDefaultEnabled` (`domain/resolver.ts:625-664`), whose final
paragraph is the exact precedent for documenting the `typeof` / value-test
discipline:

```
 * Both `typeof` narrows are defense-in-depth, not validation: the entry has
 * already passed PLUGIN_ENTRY_VALIDATOR ... A non-boolean smuggled past a
 * validator degrades to the default; there is deliberately no error path here.
```

The new predicate's doc needs the mirror of that sentence: a non-boolean degrades
to SILENT, no error path, and the reason it reads the entry only.

**Export style / placement:** named export, immediately above `resolveDefaultEnabled`
at `:651` (research's placement, confirmed correct — `resolveDefaultEnabled` is
module-private and stays that way; the new symbol becomes the first exported
member of that concern).

**Barrel decision — `domain/index.ts`: do NOT add it.** `domain/index.ts` re-exports
`computeHashVersion` and `HASH_WALK_SKIP` from `version.ts` but deliberately omits
`shaVersion` / `looksLikeShaVersion`, and from `resolver.ts` it exports only the
schemas, the two `resolve*` entry points and the two `require*` narrowers. Both
consumers already import from the module path directly, not the barrel:

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/list.ts:57
import { resolveStrict, type ResolveContext } from "../../domain/resolver.ts";
// extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:49 (multi-line form)
} from "../../domain/resolver.ts";
```

Add the new symbol to those two existing import statements. Touching
`domain/index.ts` would be a boundary change this phase does not need.

**Test file placement:** `tests/domain/` splits resolver tests by concern
(`resolver-strict`, `resolver-loose`, `resolver-comp01`, `resolver.types`), and
pure leaf helpers are tested in their module's own file (`version.test.ts`, 118
lines, covers `looksLikeShaVersion` / `shaVersion` / `SHA_VERSION_RE` alongside
`computeHashVersion`).

Note that `resolveDefaultEnabled` has **no direct unit test today** — it is only
covered behaviorally through `install.test.ts` / `enable-disable.test.ts` and
guarded by `tests/architecture/no-lifecycle-default-enabled-read.test.ts`. So
there is no existing "defaultEnabled predicate test" file to extend. The planner's
options, in preference order:

1. A small new `tests/domain/resolver-default-enabled.test.ts` — matches the
   per-concern split already used four times in that directory. Recommended.
2. Fold three cases (`false` claims / `true` silent / `undefined` silent /
   non-boolean silent) into `tests/domain/resolver-strict.test.ts` (1804 lines) —
   cheaper but buries a pure-function test inside an async-resolver suite.

Test file header convention (`tests/domain/version.test.ts:1-11`): a top-of-file
block comment stating the contract the file freezes and why, before the imports.

### `shared/notify.ts` — `PluginAvailableMessage` / `PluginRemoteMessage` gain `reasons?`

**Analog: `PluginDisabledMessage` (`extensions/pi-claude-marketplace/shared/notify.ts:774-807`) — the most recent shape to gain / re-scope an optional `reasons` field.**

The `reasons?` paragraph in that doc block is the template. It does four things the
two new paragraphs must also do, in this order:

```
 * ENBL-16 / D-100-07: `reasons` is OPTIONAL here, exactly as on
 * `PluginInstalledMessage`, `PluginUpdatedMessage` and
 * `PluginReinstalledMessage`. It admits `not in manifest` and -- since OUT-01 --
 * `installs disabled`, the install surface's author-declared cause marker.
 * The governing rule: render durable facts that constrain
 * what the user can do next; ... Which reasons a surface
 * stamps is an ORCHESTRATOR decision (D-95-01) -- the render path holds no
 * allowlist. Absent `reasons` renders the legacy brace-less row byte-for-byte:
 * `composeReasons` returns `""` for an undefined list and `joinTokens`
 * collapses the empty slot.
```

1. Names the sibling shapes that already carry the field.
2. Enumerates the admitted members explicitly (here: exactly one, `installs disabled`).
3. Cites D-95-01 — "which reasons a surface stamps is an ORCHESTRATOR decision, the
   render path holds no allowlist" — which is the sentence that makes the addition
   legitimate rather than a widening.
4. States the absent-renders-byte-identical guarantee (this is where DFEN-08 gets
   documented in-source rather than only in the plan).

Note the second half of that same block is also the analog for the D-80-03
narrowing DC-2 requires: `PluginDisabledMessage`'s ENBL-15 paragraph shows how the
house records "this field exists but this row's producer never stamps X, and that
is by construction" — which is exactly the one-line comment DC-3 wants on the
central `renderPluginRow` and `fetch.messaging.ts` arms.

**What the sibling change touched (commit `e2c04e88`, the Phase-102 predecessor)** —
the blast radius the planner should expect for a message-shape edit of this class:

```
 shared/notify.ts                                   |  42 +++-
 shared/notify-reasons.ts                           |  36 ++-
 orchestrators/plugin/install.messaging.ts          |  27 ++-
 orchestrators/plugin/install.ts                    | 265 +++++
 edge/handlers/plugin/install.ts                    |   5 +
 tests/architecture/compat-01-no-expansion.test.ts  |   1 +
 tests/architecture/notify-closed-set-locks.test.ts |   6 +-
 tests/orchestrators/plugin/install.test.ts         |  81 +++--
 tests/shared/notify-v2.test.ts                     |  17 +-
```

Two things this tells the planner that research did not:

- The two architecture gates it touched (`compat-01-no-expansion`,
  `notify-closed-set-locks`) were touched because it **added a REASONS member**.
  This phase adds none, so both stay untouched — confirmed independently:
  `notify-stamp-coverage.test.ts` and `notify-producer-wire-coverage.test.ts`
  contain no `available` / `remote` references at all, i.e. no gate enumerates
  which message shapes may carry `reasons`. There is no allowlist to amend.
- `tests/shared/notify-v2.test.ts` IS in the blast radius of a `notify.ts` shape
  change and is not mentioned anywhere in RESEARCH.md. The planner should decide
  explicitly whether the two new optional fields get a renderer-level unit test
  there (a `(available)`/`(remote)` row rendered with and without `reasons`),
  independent of the orchestrator-level tests. Cheap, and it is the layer where
  the DFEN-08 absent-vs-`[]` byte identity actually belongs.

### `tests/orchestrators/plugin/list.test.ts` — three distinct analogs

**(a) Row byte-form assertion — copy `list.test.ts:490-511`** (`RSTA-01 / D-80-03: a
not-installed git source with no clone renders bare '◌ <name> (remote)'`). This is
the single best template in the file: it is the exact row family this phase
changes, it uses full-message `assert.equal` rather than `assert.match`, and its
inline comment names the two things the bytes prove.

```ts
    const { ctx, pi, notifications } = makeCtx();
    await listPlugins({ ctx, pi, cwd, scope: "user" });
    const out = notifications[0]!.message;
    // Byte-equal: the bare `(remote)` row -- no scope bracket (SNM-11), no
    // reason brace (D-80-03).
    assert.equal(out, ["● mp1 [user]", "  ◌ gitplug v1.0.0 (remote)"].join("\n"), out);
```

Two house details to carry over: the third `assert.equal` argument is `out` itself
(so a failure prints the actual render), and the expected value is a
`[...].join("\n")` array rather than a template literal. This test is ALSO the one
whose comment ("no reason brace (D-80-03)") the new positive test contradicts —
the planner should have the new test land adjacent to it under a narrowed section
banner (`list.test.ts:458-464`), so the pair reads as one rule rather than two.

**(b) Negative / absence assertion — two forms exist, and they are not
interchangeable:**

- Token-absence within a rendered row: `assert.doesNotMatch(out, /.../, out)` —
  e.g. `list.test.ts:2572`, `assert.doesNotMatch(out, /gplug.*\(unavailable\)/, out)`.
  Use this for "an `(unavailable)` row does not acquire `{installs disabled}`" and
  for the criterion-4 silent-entry case.
- Whole-row absence: `assert.equal(out.includes("○ beta"), false)` (`list.test.ts:452-453`)
  or with a message arg (`list.test.ts:539`). Use this only for filter-bucket
  tests; it is the wrong tool for a reason-token assertion.

Strongest form for the criterion-4 and criterion-5 negatives is actually (a) —
a full `assert.equal` byte comparison proves absence AND that nothing else moved,
which `doesNotMatch` does not.

**(c) Warm-clone fixture — copy `stageWarmMirror` (`list.test.ts:466-488`).** It
already exists in this file, takes `(cwd, canonicalUrl)`, writes a
`.claude-plugin/plugin.json`, and `git.init` + `add` + `commit`s it. For the
criterion-4 case (entry silent, warm `plugin.json` declares `defaultEnabled: false`)
the helper needs its hard-coded `JSON.stringify({ name: "warm-plugin" })` at
`:478` made a parameter. That is a one-argument widening of an existing helper —
prefer it over a second near-identical helper, which `sonarjs/no-identical-functions`
would flag anyway.

Its doc comment records the non-obvious constraint the new test must respect:
*"Uses a canonical url (no `.git`) so the staged mirror key matches the parse-time
canonical url the probe hashes."*

**Fixture-seeding harness:** `seedMarketplace` (`list.test.ts:169-297`) takes an
arbitrary `manifest` object, so a `defaultEnabled: false` entry needs no harness
change (research verified this). The manifest entries in that file are one-line
literals — `{ name: "alpha", source: "./alpha", version: "1.0.0" }` — and
`installablePluginDirs: ["alpha"]` is what makes a path source resolve
`(available)` rather than `(unavailable)`. Omit it to get an `(unavailable)` row;
omit it AND use a `https://` source to get a cold `(remote)` row.

### `tests/orchestrators/plugin/info.test.ts` — three distinct analogs

**(a) Row byte-form assertion — copy `info.test.ts:442-481`** (`INFO-02: single-scope
available (path source) renders '○ ... (available)' with description`). Same
full-message `assert.equal` + `join("\n")` idiom as the list side, plus two extra
assertions this file always makes and the list file often does not:

```ts
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ○ bar v0.5.0 (available)",
        "    Bar plugin; not installed.",
        "    skills: s1",
      ].join("\n"),
    );
```

`assert.equal(notifications[0]!.severity, undefined)` is the load-bearing one for
this phase: it is the in-test proof of research probe P2 (adding this reason does
not move severity). Every new `info` test should carry it.

**(b) Negative / absence assertion — copy `info.test.ts:2582-2585`:**

```ts
    assert.match(msg, /◌ gplug v1\.0\.0 \(remote\)/, msg);
    assert.match(msg, /components: not resolved/, msg);
    assert.doesNotMatch(msg, /\(available\)/, msg);
    assert.doesNotMatch(msg, /\(unavailable\)/, msg);
```

The house shape is a positive `match` for the intended row followed by
`doesNotMatch` for each thing it must NOT be, all with `msg` as the third arg.

**(c) Warm-clone fixture — `seedWarmMirror` (`info.test.ts:274-309`) is strictly
better than the list-side `stageWarmMirror` and needs no widening:** it already
takes `pluginJson: Record<string, unknown>` as a parameter, so the criterion-4
case (`{ name: "...", defaultEnabled: false }`) is expressible today. It also
takes optional `componentDirs` / `componentFiles`, which is what makes a warm
mirror resolve `installable` rather than empty. `seedWarmSubdirMirror`
(`:318`) is its git-subdir variant — not needed here.

Note the asymmetry: `info.test.ts` seeds marketplaces with `seedPathMarketplace`
(`:153`), not `seedMarketplace`. Do not copy list-side seeding calls across.

### `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` — the block/fixture pair

**Cleanest template to clone: the `remote-inventory` pair.** Block at
`docs/output-catalog.md:371-380`, fixture at `catalog-uat.test.ts:736-756`. It is
the closest because it documents one of the two exact rows this phase changes, its
prose sentence is the D-80-03 claim the phase must narrow, and it is minimal (one
marketplace, one plugin row, no components).

Doc block, VERBATIM:

```markdown
### Remote inventory row (RSTA-01 / D-80-03)

<!-- catalog-state: remote-inventory -->

```text
● official [user] <autoupdate>
  ◌ git-plugin v1.2.3 (remote)
```

A not-installed git-source plugin ... renders `(remote)` instead of the
manifest-only `(available)` over-claim (RSTA-01). ... Bare row: no scope bracket
(SNM-11 carve-out family ...), no reasons brace (the REASONS closed set does not
grow -- parity with `available`, D-80-03). Severity `info`; no reload-hint
(inventory row).
```

Matching fixture, VERBATIM:

```ts
    // RSTA-01 / D-80-03: list-surface inventory row for a not-installed
    // git-source plugin whose clone/mirror is not materialized locally. The
    // `(remote)` closed-set token wears the dedicated `◌` glyph. Bare row --
    // no scope bracket (SNM-11), no reasons brace (D-80-03). Severity `info`;
    // `needsReload: false`.
    "remote-inventory": {
      pi: piWithBothLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            details: { autoupdate: true },
            plugins: [
              {
                status: "remote",
                name: "git-plugin",
                version: "1.2.3",
                severity: "info",
                needsReload: false,
              },
            ],
          },
        ],
      },
    },
```

Four conventions to carry over, none of which research states:

1. The `### ` heading carries its spec IDs in parentheses
   (`### Remote inventory row (RSTA-01 / D-80-03)`); the new headings should read
   `(OUT-02 / DFEN-04)` and `(OUT-03 / DFEN-04)`.
2. The fixture is preceded by a comment block that RESTATES the catalog prose in
   compressed form and ends with the severity + reload-hint pair. The comment is
   duplicated on purpose — it is what makes a fixture diff readable without opening
   the catalog.
3. The prose paragraph ALWAYS ends with the severity and reload-hint sentence
   (`Severity `info`; no reload-hint (inventory row).`). Both new list blocks and
   the info block are info-severity, no reload-hint.
4. The fixture's canonical names are `official` / `git-plugin` / `1.2.3` for list
   and `community-mp` / `chat-helper` / `0.5.0` for info — reuse the section's
   existing names rather than importing the `alpha` / `delta` fixture names from
   the research probe, so a reader diffing two adjacent blocks sees only the
   delta that matters.

**For the info block specifically**, the fixture shape is different — a flat
`kind: "plugin-info"` object, not a `marketplaces[]` tree. Clone
`"available-single-scope"` (`catalog-uat.test.ts:3233-3252`), which carries the
`satisfies NotificationMessage` pin that the list fixtures do not:

```ts
    "available-single-scope": {
      pi: piWithBothLoaded(),
      message: {
        kind: "plugin-info",
        marketplaceName: "community-mp",
        marketplaceScope: "user",
        marketplaceDetails: { autoupdate: false },
        plugin: {
          status: "available",
          name: "chat-helper",
          version: "0.5.0",
          description: "Quick chat helper plugin; experimental.",
          componentsResolved: true,
          components: { commands: ["chat"], skills: ["chat-init"] },
        },
      } satisfies NotificationMessage,
    },
```

**Secondary prose analog — the `install-disabled` block (`docs/output-catalog.md:528-538`).**
This is where the `{installs disabled}` token is already documented, and its
paragraph is the model for *justifying the severity* of a row carrying this token:

> Severity `info` -- the desired state WAS reached, because an install-disabled
> plugin is the author's declared intent, not a shortfall. No reload hint: nothing
> net entered or left Pi's resource view inside the command.

The new blocks need the parallel sentence for a not-installed row: nothing has
happened at all, so info severity holds for a different reason — the row states a
fact about a future action, not a shortfall of a completed one. Writing that
sentence is also the cheapest way to satisfy DC-2's requirement that the token's
charter stop reading as violated. `install-disabled-degraded` (`:540-552`) is the
precedent for documenting a multi-token brace, if the planner decides to add the
fourth (`{lsp, installs disabled}`) block.

## Shared Patterns

### Comment discipline (applies to every source and test file in this phase)

**Source:** `.claude/rules/typescript-comments.md`; enforced by review, and
observable in every excerpt above.

- Cite durable IDs: `OUT-02`, `OUT-03`, `OUT-05`, `DFEN-04`, `DFEN-08`, `D-80-03`,
  `D-95-01`, `RSTA-01`, `SNM-11`, `NFR-5`, plus the new `D-104-NN` IDs.
- Never `Phase NN`, `Plan NN`, `Wave N`, `Task N`, `Pitfall N`, `Pattern N`,
  `milestone vX.Y`. This binds **test titles** too — every test name quoted in this
  document leads with its spec IDs (`"RSTA-01 / D-80-03: ..."`,
  `"INFO-02: ..."`, `"RSTA-01 / NFR-5: ..."`). Copy that form.

### Closed-set and total-map idioms (bears on DC-4)

**Source:** `domain/resolver.ts:335-336`, `orchestrators/plugin/list.messaging.ts` (`LIST_RENDER`).

```ts
// extensions/pi-claude-marketplace/domain/resolver.ts:335-336 (VERBATIM)
export const SUPPORTED_COMPONENT_KINDS = ["skills", "commands", "agents", "hooks"] as const;
export type SupportedKind = (typeof SUPPORTED_COMPONENT_KINDS)[number];
```

The house rule is that a closed set is an `as const` tuple with a
`(typeof X)[number]` union derived from it, and that a map keyed by such a union
is pinned with `as const satisfies` so a missing arm is a compile error
(`LIST_RENDER`). Research's DC-4 asks whether the new `info` composer's status gate
should be a `ReadonlySet` or a total `Record`. The codebase answer is unambiguous
for a gate keyed by a closed union: **total `Record` with `as const satisfies`.**
The `ReadonlySet` in `DISABLED_ROW_REASONS` (`info.ts:1000-1007`) is not a
counter-example — its members are reasons drawn from a 39-entry tuple, where a
total map would be absurd; a 9-member status union is exactly the case the idiom
exists for.

### Test harness (applies to both new test suites)

**Source:** `tests/orchestrators/plugin/list.test.ts:59-104`, mirrored at
`tests/orchestrators/plugin/info.test.ts:72-90`.

`makeCtx()` returns `{ ctx, pi, notifications }` and captures `(message, severity)`
pairs, pushing `{ message }` with NO `severity` key when the arg is absent — which
is why `assert.equal(notifications[0]!.severity, undefined)` is a meaningful
severity assertion rather than a tautology. `withHermeticHome` swaps `HOME`, hands
back `{ home, cwd }`, and tears down with `rm(..., { maxRetries: 5, retryDelay: 100 })`
against the ENOTEMPTY race. Every test in both files is a
`withHermeticHome(async ({ home, cwd }) => { ... })` body; the user scope root is
always derived as `path.join(home, ".pi", "agent")`.

### Reason-brace absence is free (bears on the DFEN-08 framing)

**Source:** `notify.ts:774-787` (`PluginDisabledMessage` doc), verified by research probe P1.

Absent `reasons` and `reasons: []` render byte-identically; the house already
documents this in-source rather than defending against it in code. New code should
cite it the same way rather than adding conditional machinery — and the conditional
spread on the `list` side (`notInManifestField` idiom) is chosen for readability
and consistency with its two siblings in the same function, not for byte safety.

## No Analog Found

None. Every file in this phase modifies an existing file with a close in-file or
in-directory sibling.

Two near-misses worth flagging to the planner:

| Symbol | Gap | Consequence |
|--------|-----|-------------|
| `resolveDefaultEnabled` | has NO direct unit test anywhere in `tests/` | the new predicate's test file has no sibling to extend; it establishes the pattern rather than following one (see the two options above) |
| the two new `reasons?` fields | no architecture gate enumerates which message shapes carry `reasons` | nothing to amend — but also nothing that will catch a shape drifting out of sync, which is why the `PluginDisabledMessage`-style doc paragraph is the only guard and must be written carefully |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{domain,orchestrators/plugin,shared}/`,
`tests/{domain,orchestrators/plugin,architecture}/`, `docs/output-catalog.md`,
plus `git log` over `shared/notify.ts`.
**Files read:** 11 (targeted ranges only; no file re-read).
**Pattern extraction date:** 2026-08-15
