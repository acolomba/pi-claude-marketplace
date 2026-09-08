# Phase 114: Degradation and documentation - Pattern Map

**Mapped:** 2026-09-07
**Files analyzed:** 4 new, 18 modified
**Analogs found:** 22 / 22 (every artifact has a named in-tree analog)

RESEARCH.md already measured the per-site line numbers, the eight-site closed-set trail,
the 19 `composeReasons` call sites and the probe code. This document does not repeat that
census. It answers only: **for each file this phase creates or modifies, which existing
file is the shape to copy, and what exactly do I copy from it.**

Every analog path below was checked with `git ls-files` and is tracked source. No
gitignored mirror path appears here.

**One correction to the phase brief:** the brief says `docs/hooks-compatibility.md` has no
"Install-time disposition" section. It does — `docs/hooks-compatibility.md:225-252`, a
four-disposition prose section. It is a direct analog, not a gap. The genuine gap is the
admit-versus-run divergence table; the closest analog for that is the
`### Turn-boundary timing shift` subsection (`:39-43`), which is the hooks doc's one
worked example of "we mark this supported, and here is the irreducible divergence anyway."

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tests/architecture/<new>.test.ts` (marker-coverage gate) | test (architecture) | transform (outcome -> rendered row) | `tests/architecture/notify-stamp-coverage.test.ts` | exact |
| probe-purity clause (same or sibling architecture suite) | test (architecture) | file-I/O (source scan) | `tests/architecture/no-orchestrator-network.test.ts` + `tests/architecture/source-scan.ts` | exact |
| `docs/workflows-compatibility.md` (NEW) | doc | — | `docs/hooks-compatibility.md` | exact |
| byte-equality install pair, in `tests/orchestrators/plugin/install.test.ts` | test (orchestrator) | file-I/O + request-response | `install.test.ts:9609-9649` (`WLIF-01` envelope case) | exact |
| `platform/pi-api.ts` (third probe) | platform | request-response | `hasLoadedPiSubagents` (`pi-api.ts:125-135`, RH-3) | exact |
| `shared/concerns/soft-dep.ts` (third union member + marker) | shared/concern | transform | `SOFT_DEP_MARKER_MCP` arm in the same file | exact |
| `shared/notify.ts` (`REASONS` 45th, `composeReasons` 4th boolean) | shared/renderer | transform | `composeReasons` at `notify.ts:2269-2283` | exact |
| `shared/notify-reasons.ts` (`UnsupportedReason`, `companionSeverity`) | shared | transform | `companionSeverity` at `:87-95` | exact |
| `tests/architecture/notify-closed-set-locks.test.ts` (44 -> 45) | test | — | its own `WLIF-06` bump comment at `:52-54` | exact |
| `tests/architecture/compat-01-no-expansion.test.ts` (enumeration tail) | test | — | its own tail member `"stale workflow command"` | exact |
| `tests/architecture/catalog-uat.test.ts` (2 fixtures, 192 -> 194) | test | file-I/O | `"success-with-orphan-rewake-and-soft-dep"` fixture (`:1156-1178`) | exact |
| `docs/output-catalog.md` (2 states + prose counts) | doc (byte-gated) | — | `### Success with soft-dep markers` (`:509-520`) | exact |
| `tests/platform/pi-api.test.ts` (discriminating case) | test | — | existing `extensionApiWithTools` cases (`:27-29`) | exact |
| `tests/shared/concerns/soft-dep.test.ts` (union pin) | test | — | its own `satisfies Dependency` block (`:9-12`) | exact |
| `README.md` / `README.es.md` | doc | — | the `Agents.` / `MCP servers.` bullets already in both | exact |
| `orchestrators/plugin/shared.ts` (`enableRowDependencies`) | orchestrator | transform | its own two-arm body (`:125-137`) | exact |
| `orchestrators/reconcile/apply-outcomes.ts` (`dependenciesFromInstall`) | orchestrator | transform | its own two-arm body (`:435-450`) | exact |
| the other 5 derivation sites | orchestrator | transform | the two above | exact |
| `orchestrators/types.ts` (`declaresWorkflows` REQUIRED) | model | — | `declaresAgents` / `declaresMcp` at `:71-72, 176-177, 462-463` | exact |
| `docs/messaging-style-guide.md` (prose sweep) | doc | — | its own existing two-probe enumerations | exact |
| `tests/domain/resolver.test.ts` (prose -> citation) | test | — | the paragraph being replaced (`:1804-1808`) | exact |

## Pattern Assignments

### 1. `tests/architecture/<new>.test.ts` — the marker-coverage gate (criterion 3)

**Primary analog:** `tests/architecture/notify-stamp-coverage.test.ts` — the only
architecture suite in the tree that proves a **cross-site coverage claim by driving
production composers**, with no source grep and no private export. It is the shape.

**Header pattern** (`notify-stamp-coverage.test.ts:1-9`) — every architecture suite opens
with a file-path-first docstring that states the invariant AND why this suite owns it
rather than the per-command owners:

```ts
/**
 * tests/architecture/notify-stamp-coverage.test.ts -- GATE-01 / D-05
 * cross-projection backstop for required severity and reload stamps.
 *
 * Command render-map owners prove their row bytes directly. This suite keeps
 * the distinct architectural invariant: reconcile projections that accumulate
 * rows through the broad notification union must still stamp every realized
 * transition and failure.
 */
```

Copy that framing verbatim in structure: name the requirement IDs (`WDEP-04` / criterion
3), say the per-site suites prove their own rows, and say this suite's distinct claim is
that **every** derivation site renders the marker.

**Import pattern** (`:11-25`) — production imports from `../../extensions/...` with
explicit `.ts`, then a blank line, then `import type` last:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildReconcileAppliedCascade,
  buildReconcilePendingNotification,
} from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts";

import type { PerEntryOutcome } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts";
```

**Case-record pattern.** This codebase does NOT use a `[{name, fn}]` array driven by a
loop anywhere in `tests/architecture/`. What it uses instead is (a) a module-level
`as const satisfies readonly T[]` closed list that the assertions filter against, and (b)
a **single `assert.deepEqual` over a projected array**, so one failure reports every
offending site at once rather than only the first. Both idioms are in
`notify-stamp-coverage.test.ts`:

```ts
const transitionStatusList = [
  "disabled",
  "installed",
  "partially-installed",
  "reinstalled",
  "uninstalled",
  "updated",
] as const satisfies readonly PluginStatus[];

// ... later, ONE assertion over the whole projection:
assert.deepEqual(stamps, [
  { name: "new-plugin", needsReload: true, severity: "info", status: "installed" },
  { name: "gone-plugin", needsReload: true, severity: "info", status: "uninstalled" },
  // ...
]);
```

**Recommended case record for this gate**, matching both idioms and the RESEARCH
recommendation to assert on the RENDERED ROW:

```ts
interface SiteCase {
  /** The derivation site this case covers, named so a failure identifies it. */
  readonly site: string;
  /** Drives a public surface and returns the rendered row (or full block). */
  readonly drive: (engineLoaded: boolean) => Promise<string>;
}
```

Then one `assert.deepEqual` over
`await Promise.all(cases.map(async (c) => ({ site: c.site, marked: (await c.drive(false)).includes("requires pi-dynamic-workflows"), clean: !(await c.drive(true)).includes("requires pi-dynamic-workflows") })))`
against a hand-written expected array of seven `{ site, marked: true, clean: true }`
records. That gives the deletion-of-one-arm negative control **exactly one** red row,
naming the site — which is the property the mandatory negative control is checking for.

**Test-title pattern** (`:146`, `:176`, `:200`): `"<IDs>: <claim in present tense>"`, e.g.
`test("GATE-01/D-05: applied projection stamps every realized-transition row", ...)`.
Use `WDEP-04` / `SNM-06`. Never `Phase 114`.

**Arrange/act/assert comment markers** (`:148, 150, 161`) — literal `// arrange`,
`// act`, `// assert` lines. Present in both `notify-stamp-coverage.test.ts` and the
`install.test.ts` cases. Copy them.

**How the three hard-to-reach (Tier C) sites are already driven — answered.** All three
have an existing end-to-end drive harness in the tree; the gate needs no new machinery:

| Site | Existing driver | Evidence |
|---|---|---|
| `install.ts` | `tests/orchestrators/plugin/install.test.ts` — `installPlugin({ ctx, pi, scope, cwd, marketplace, plugin })` under `withHermeticHome`, with `makeCtx({ toolNames })` supplying the fake probe and `notifications[0].message` carrying the rendered block | `install.test.ts:9630`, `:294-311`, `:318-333` |
| `list.ts` | `tests/orchestrators/plugin/list.test.ts` — imports and calls BOTH `listPlugins` and `loadPluginListPayload` | `list.test.ts:41-42, 334, 375` |
| `import/execute.ts` | `tests/orchestrators/import/execute.test.ts` — calls `importClaudeSettings({...})` | `execute.test.ts:34, 423` |

The gate cannot import those `*.test.ts` files (D-98-09: importing a `node:test` module
re-registers its cases). Copy the *harness shape* — `makeCtx` / `withHermeticHome` /
`seedPathMarketplaceWithPlugin` are private to `install.test.ts` and must be re-created in
the new suite, or the drive helpers lifted into a non-`.test.ts` sibling under
`tests/architecture/` the way `source-scan.ts` is (it "registers no case of its own",
`source-scan.ts:20`).

**Directory constraint:** `tests/architecture/` is exempt from the file-pairing gate
(`scripts/check-corresponding-tests.mjs:10`), so this suite needs no paired production
module. Do not create a new top-level `tests/` directory — that reddens
`tests/architecture/unit-suite-glob-completeness.test.ts`.

---

### 2. The probe-purity clause (criterion 2, layer 2)

**Analog:** `tests/architecture/no-orchestrator-network.test.ts` — the canonical consumer
of `assertNoForbiddenSurface`. A new forbidden-surface clause is three module-level
constants plus one `test(...)`.

**Target-list pattern** (`no-orchestrator-network.test.ts:67-112`) — a
`ReadonlyArray<string>` of repo-relative paths, **each preceded by a comment naming the
requirement ID that makes that file network-free**. Not a bare list:

```ts
const FORBIDDEN_TARGETS: ReadonlyArray<string> = [
  // PL-3 + NFR-5: list is read-only against state + manifest; no network.
  "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
  // ENBL-03: the enable/disable orchestrator re-materializes from cache
  // -- NO network.
  "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts",
];
```

For this phase the targets are every `extensions/pi-claude-marketplace/bridges/workflows/*.ts`
file **enumerated explicitly** (WR-06 makes a missing target FAIL, which is the point — a
glob would silently cover nothing) plus
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` for the ledger phase.

**Pattern-list pattern** (`:114-119`) — `{ name, pattern }` records, `\b`-anchored:

```ts
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "import from platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ },
  { name: "DEFAULT_GIT_OPS reference", pattern: /\bDEFAULT_GIT_OPS\b/ },
  { name: "gitOps reference", pattern: /\bgitOps\b/ },
];
```

This phase's set: `/\bsoftDepStatus\b/`, `/\bSoftDepStatus\b/`,
`/\bhasLoadedWorkflowEngine\b/`, `/\bworkflowEngineLoaded\b/`.

**The exact `assertNoForbiddenSurface` call shape** (`:121-131`) — note the in-body
comment explaining why the mechanic is shared and the target/pattern/message stay owned
locally:

```ts
test("NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface", async () => {
  // The read / stripComments / offender-accumulate mechanic lives in
  // tests/architecture/source-scan.ts so this gate and the COMPAT-01 no-expansion
  // gate share one implementation (D-98-09). The target list, the pattern list,
  // and this failure message stay owned here.
  await assertNoForbiddenSurface(
    FORBIDDEN_TARGETS,
    FORBIDDEN_PATTERNS,
    (offenders) =>
      `NFR-5 / PI-2 / PL-3 / PRL-07 violation: gitOps surface detected in network-free module(s):\n  ${offenders.join("\n  ")}\n  (...)`,
  );
});
```

**Signature to code against** (`source-scan.ts:66-71`), including the fourth `opts`
argument the phase should NOT need (nothing here is unwritten at commit time):

```ts
export async function assertNoForbiddenSurface(
  targets: ReadonlyArray<string>,
  patterns: ReadonlyArray<{ readonly name: string; readonly pattern: RegExp }>,
  describeViolation: (offenders: ReadonlyArray<string>) => string,
  opts: { readonly allowMissing?: ReadonlyArray<string> } = {},
): Promise<void>
```

**Mandatory `stripComments` rationale block.** Both existing consumers carry it in the
header (`no-orchestrator-network.test.ts:62-66`) because the guarded file's own docstring
legally names the forbidden symbol. This phase's `bridges/workflows/*` files will very
likely gain a "MUST NOT read the probe (WDEP-03)" header comment — so the rationale is
load-bearing here, not ceremonial. `assertNoForbiddenSurface` strips automatically
(`source-scan.ts:91`); the header comment records why.

---

### 3. `docs/workflows-compatibility.md` (NEW, WDOC-01)

**Analog:** `docs/hooks-compatibility.md` (256 lines). Copy its skeleton exactly.

**Opening pattern** (`hooks-compatibility.md:1-7`) — H1, one-sentence purpose naming
implemented/deferred/unsupportable, legend line, then a provenance paragraph naming BOTH
the upstream source URL and the in-repo source directories the Pi column reflects:

```markdown
# Hook compatibility

Feature-by-feature comparison of Claude Code's hooks system against the Pi-Claude bridge, with the design rationale for which features were implemented, which were deferred, and which the bridge declares unsupportable.

Legend: `✓` supported, `✗` not supported, `⚠` partial (see notes).

The upstream column reflects Claude Code's published hooks reference at [code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks). The Pi column reflects the bridge sources under `extensions/pi-claude-marketplace/bridges/hooks/` and `extensions/pi-claude-marketplace/domain/components/`.
```

The provenance paragraph is where this phase's **evidence-grade labelling** goes: name
`@quintinshaw/pi-dynamic-workflows` 3.10.1, Spike 027, and Claude Code 2.1.251, and say
which claims are runtime-measured and which are source-read.

**Section order in the analog** (use it as the skeleton, substituting workflow concepts):

| # | Hooks doc section | Line | Workflows counterpart |
|---|---|---|---|
| 1 | H1 + purpose + legend + provenance | 1-7 | same |
| 2 | `## Events` (the big feature table) | 9 | `## Manifest and discovery` — the `workflows` field, `string \| array`, the D-07 union-vs-replace divergence, the `.js`-file-target disposition |
| 3 | `### Turn-boundary timing shift` (prose: one irreducible divergence under a `✓` row) | 39-43 | **`### Admit-versus-run divergence`** — the mandatory table. This is the structural slot for it |
| 4 | `### Event status classification` (three-bucket forward path) | 45 | `### Refusal-check classification` — the nine `parseWorkflowScript` checks, the two replicated, determinism-before-parse |
| 5 | `## Matcher syntax` … `## Async and lifecycle` (per-facet `Feature \| Claude Code \| Pi \| Notes` tables) | 74-224 | `## Script semantics` / `## Sandbox` / `## Naming` |
| 6 | `## Install-time disposition` | 225-252 | same heading, verbatim |
| 7 | `## Further reading` | 253-256 | same |

**Table shape** (`:11-12`, `:76`, `:158`, `:205`, `:217`) — four columns, always
`| <Subject> | Claude Code | Pi | Notes |`, mdformat-aligned, `✓` / `✗` / `⚠` glyphs, and
the Notes cell carries the *reason*, lowercase, no trailing period:

```markdown
| Event                | Claude Code | Pi  | Notes                                                              |
| -------------------- | ----------- | --- | ------------------------------------------------------------------ |
| `PreCompact`         | ✓           | ⚠   | match-all matcher only -- Pi compact events carry no `trigger` field |
```

Note the `--` (double hyphen) em-dash substitute — the texthooks pre-commit fixer owns
dashes; do not hand-type a real em dash.

**`## Install-time disposition` pattern** (`:225-252`) — an intro sentence stating how
many dispositions there are, then one **bold-lead paragraph per disposition** followed by
a bulleted applies-to list:

```markdown
## Install-time disposition

The bridge picks one of four responses when a plugin declares a feature outside the supported set:

**Partial-partition drop** -- when a `hooks.json` parses and validates cleanly but declares an unsupportable event, ... Applies to:

- any unsupportable event in `hooks.json` ...
- regex matchers

**Structural unavailable** -- a structurally malformed `hooks.json` ... resolves `(unavailable)` and none of the plugin's hooks install. ...

**Silent fall-open** -- the hook fires on every matcher hit and a `hookDebugLog` warning records the cause. ...

**Silent drop** -- the bridge accepts the field at parse time but never acts on it. ...
```

The CONTEXT says four of the workflows doc's five dispositions are Phase 111-113 behavior
documented nowhere else — so the intro sentence reads "one of five responses" and the
bold leads are the five workflow dispositions. Confirm the `.js`-file-target disposition
by reading `bridges/workflows/discover.ts` at plan time (RESEARCH Open Question 1).

**The admit-versus-run table has no exact analog** and is genuinely new. Closest in kind
is `### Turn-boundary timing shift` (`:39-43`): a prose subsection that admits a
divergence *underneath* a row the doc marks supported, states it is not
consumer-observable (or, here, that it IS observable and bounded), and links to the
research artifact. Its final paragraph is the model for the honesty register:

> Because the shift is not hook-observable, `Stop` and `StopFailure` are marked `✓` (full
> support) rather than `⚠` ... See [`docs/research/...`](...) for the full feasibility and
> design analysis.

For workflows the equivalent sentence must go the other way — the divergence IS
invocation-observable — and cite Spike 027, not a `docs/research/` path.

**`## Further reading` pattern** (`:253-256`) — two bullets: the upstream authoritative
reference URL with a sentence on what it covers, then the host-runtime package with a
sentence on what it contracts.

**Gate constraints on this file:**
- `tests/architecture/no-stale-test-citations.test.ts` policies `docs/**` prose: every
  `tests/...` path named must exist on disk. `docs/adr/`, `docs/research/`, `docs/plans/`
  are excluded; this new file is **not**. Land the doc after the suites it cites.
- mdformat (pre-commit) formats it. Never `prettier --write` it.
- Register: match `hooks-compatibility.md`, which is denser than the `simple-english`
  skill's default.

---

### 4. The byte-equality install pair (criterion 2, layer 1)

**Analog:** `tests/orchestrators/plugin/install.test.ts:9609-9649` (`WLIF-01`) — the case
that already installs a workflow fixture end-to-end and reads the envelope off disk. The
new case is that case, run twice with different `toolNames`, comparing raw bytes.

**Fake `pi` construction** (`:280-311`) — `makeCtx` is the parameterized harness; the
`toolNames` override is exactly the seam this phase needs, and it already exists:

```ts
function toolInfo(name: string): ToolInfo {
  return {
    name,
    description: `test tool ${name}`,
    parameters: Type.Object({}),
    sourceInfo: { origin: "top-level", path: `/test/tools/${name}.ts`, scope: "temporary", source: "test" },
  } satisfies ToolInfo;
}

function makeCtx(piOverrides?: { readonly toolNames?: readonly string[] }): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify(message: string, severity?: string): void {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
    },
  } as ExtensionContext;
  const pi = { getAllTools: () => (piOverrides?.toolNames ?? []).map(toolInfo) } as ExtensionAPI;
  return { ctx, pi, notifications };
}
```

Engine-present run: `makeCtx({ toolNames: ["workflow_control"] })`.
Engine-absent run: `makeCtx()` (or `makeCtx({ toolNames: ["workflow"] })`, which is
strictly better — it also re-proves the WDEP-01 discriminator through the install path).

**Isolation + drive + envelope-read pattern** (`:9609-9649`), the whole case shape to copy:

```ts
test("WLIF-01: an installed workflow lands as an envelope and the record names it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "install-workflows-happy-"));
    try {
      // arrange
      const locations = locationsFor("project", cwd);
      await seedPathMarketplaceWithPlugin({
        cwd, marketplaceName: "mp", marketplaceRoot: path.join(cwd, "mp-src"), pluginName: "hello",
        workflows: [{ sourceName: "greet", body: 'export const meta = { name: "greet", description: "greets" };\n' }],
      });
      const { ctx, pi } = makeCtx();

      // act
      await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: "mp", plugin: "hello" });

      // assert -- the envelope path is composed with `path.join`, NOT with the
      // async artifact-path composer: a forgotten await there yields a leaf
      // named after a promise instead of throwing.
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
        name: "hello:greet", description: "greets", script: '...',
      });
      const state = await loadState(locations.extensionRoot);
      assert.deepStrictEqual(state.marketplaces.mp?.plugins.hello?.resources.workflows, ["hello:greet"]);
    } finally {
      await rm(cwd, { force: true, recursive: true });
    }
  });
});
```

**Where envelopes land:** `<locations.workflowsSavedDir>/<generatedName>.json`, generated
name `"<plugin>:<workflowStem>"`. The existing case composes it with `path.join` and
documents why (the async `workflowArtifactPath` composer,
`persistence/locations.ts:167-179`, would yield a promise-named leaf on a forgotten
`await`). Copy that comment and that choice.

**Byte comparison, not `deepStrictEqual`.** The existing case parses JSON. Criterion 2
wants BYTES, so read with `readFile(envelopePath, "utf8")` and compare the raw strings —
a `JSON.parse` round-trip would green over a key-order or whitespace change.

**Non-vacuity assertions** are mandatory and RESEARCH already wrote them
(`114-RESEARCH.md:844-851`). Two agreeing runs prove nothing without them; add them
verbatim, and drive both `notifications[0].message` reads through the same `makeCtx`
notification recorder the file already uses (`install.test.ts:1235, 1304, 1459` show the
`const note = notifications[0]!;` idiom).

**Fixture helper already present:** `writeWorkflowScripts(pluginRoot, workflows)`
(`:413-433`), reached through `writePluginComponents`'s `workflows` option (`:358, :404`).
Its comment records that a default-export body classifies as SKIPPED and writes zero
envelopes — so a case relying on the default body would pass for the wrong reason. That
hazard applies directly to the new case; keep the named `meta` export.

---

### 5. `extensions/pi-claude-marketplace/platform/pi-api.ts` — the third probe

**Analog:** `hasLoadedPiSubagents` (RH-3), `pi-api.ts:125-135`. Take RH-3, not RH-4 — the
RH-4 `sourceInfo` fallback arm re-opens exactly the false-positive surface WDEP-01 closes.

**Interface** (`:120-123`) — a flat `interface` of required booleans, no optionals:

```ts
export interface SoftDepStatus {
  piSubagentsLoaded: boolean;
  piMcpAdapterLoaded: boolean;
}
```

**Probe** (`:125-135`) — doc comment leads with the requirement ID, states the predicate as
an `iff`, and closes with the literal sentence `Probe failures degrade to unloaded.`:

```ts
/**
 * RH-3: pi-subagents loaded iff `pi.getAllTools()` contains a tool named
 * "subagent". Probe failures degrade to unloaded.
 */
export function hasLoadedPiSubagents(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "subagent");
  } catch {
    return false;
  }
}
```

The bare `catch { return false; }` with no logging is the pattern AND the V7 security
control (RESEARCH §Security Domain): do not log the caught error.

**Composer** (`:158-163`) — one field per probe, no branching:

```ts
export function softDepStatus(pi: ExtensionAPI): SoftDepStatus {
  return {
    piSubagentsLoaded: hasLoadedPiSubagents(pi),
    piMcpAdapterLoaded: hasLoadedPiMcpAdapter(pi),
  };
}
```

RESEARCH's `114-RESEARCH.md:1125-1147` already carries the finished `hasLoadedWorkflowEngine`
against this shape. Use it as written.

---

### 6. `shared/concerns/soft-dep.ts` — third union member, third marker

**Analog:** the file's own `mcp` arm. Three things move together and the file's structure
names all three.

**Union + its doc comment** (`:21-30`) — the comment states the member count and the
no-runtime-tuple rationale. The count sentence ("2 members") must become 3; the rationale
paragraph must survive untouched (the CONTEXT forbids reintroducing `DEPENDENCIES`):

```ts
/**
 * Closed set of dependency probe targets (SNM-06). 2 members, each driving the
 * renderer's per-dependency soft-dep probe path (`requires pi-subagents` /
 * `requires pi-mcp` reason emission).
 *
 * Spelled out as a literal union rather than a runtime `DEPENDENCIES` tuple:
 * nothing iterates the members at runtime, so the union type alone is the
 * sole declaration site.
 */
export type Dependency = "agents" | "mcp";
```

**Marker constants** (`:32-34`) — module-private `const`, typed `Reason` so an out-of-set
literal is a compile error:

```ts
/** Soft-dep marker literals -- both are REASONS members (closed set). */
const SOFT_DEP_MARKER_AGENTS: Reason = "requires pi-subagents";
const SOFT_DEP_MARKER_MCP: Reason = "requires pi-mcp";
```

The `"both are"` phrasing becomes `"all three are"`. The new constant carries the
don't-spell-it-`pi-workflows` rationale in its own doc comment (RESEARCH `:1177-1183`) so
a future rename cannot silently undo WDEP-01.

**`softDepMarkers`** (`:36-60`) — the doc comment enumerates one `Appends X iff Y` bullet
per arm and states the order is byte-critical. Both must grow:

```ts
/**
 * Pure given the probe result. Returns the soft-dep markers to append, in
 * canonical order (agents before mcp -- byte-critical for the `{<r1>, <r2>}`
 * brace join).
 *
 *  - Appends `SOFT_DEP_MARKER_AGENTS` iff `declaresAgents && !probe.piSubagentsLoaded`.
 *  - Appends `SOFT_DEP_MARKER_MCP` iff `declaresMcp && !probe.piMcpAdapterLoaded`.
 */
export function softDepMarkers(
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): readonly Reason[] {
  const markers: Reason[] = [];

  if (declaresAgents && !probe.piSubagentsLoaded) {
    markers.push(SOFT_DEP_MARKER_AGENTS);
  }

  if (declaresMcp && !probe.piMcpAdapterLoaded) {
    markers.push(SOFT_DEP_MARKER_MCP);
  }

  return markers;
}
```

Note the blank line between each `if` block — `@stylistic/padding-line-between-statements`
requires a blank line after every block-like statement. The third arm appends LAST.

---

### 7. `shared/notify.ts` — `composeReasons` and the 45th `REASONS` member

**`composeReasons` analog:** itself, `notify.ts:2269-2283`. The new `declaresWorkflows`
goes in as a REQUIRED fourth boolean, pushing `probe` to position 5:

```ts
export function composeReasons(
  reasons: readonly Reason[] | undefined,
  declaresAgents: boolean,
  declaresMcp: boolean,
  probe: SoftDepStatus,
): string {
  const composed: Reason[] = reasons === undefined ? [] : [...reasons];
  composed.push(...softDepMarkers(declaresAgents, declaresMcp, probe));

  if (composed.length === 0) {
    return "";
  }

  return `{${composed.join(", ")}}`;
}
```

Positional hazard already measured: `tests/shared/notify.test.ts:4923` does
`Parameters<typeof composeReasons>[3]` and must become `[4]`.

**`REASONS` append pattern:** tail only. The tuple header (`notify.ts:83-84`) states new
tokens append at the tail and existing entries never reorder; the COMPAT-01 gate asserts
enumeration equality *including order*. Brace order comes from `softDepMarkers`'s push
order, which is independent of tuple index — so tail position costs nothing.

---

### 8. `tests/architecture/notify-closed-set-locks.test.ts` — the count bump

**Analog:** the file's own bump-comment ledger (`:29-56`). The pattern is: the count lives
in the **test title AND the assertion**, and every bump appends one comment line naming
its requirement ID and the arithmetic:

```ts
test("OUT-08: REASONS is the closed 44-entry reason set", () => {
  // D-76-08: +1 for the `authentication required` failure-class member (32 -> 33).
  // ...
  // WLIF-06: +1 for the `stale workflow command` member -- the marker a retiring
  // verb stamps when a removed workflow's command stays registered until a
  // reload (43 -> 44).
  assert.equal(REASONS.length, 44);
});
```

This phase appends exactly one line — `// WDEP-04: +1 for the
`requires pi-dynamic-workflows` marker ... (44 -> 45).` — and bumps both the title and
`assert.equal(REASONS.length, 45)`. Do not rewrite the existing ledger lines.

---

### 9. `docs/output-catalog.md` — the two new states

**Analog:** `### Success with soft-dep markers` (`:509-520`) and
`### Success with orphan-rewake AND a soft-dep marker in the same brace` (`:537-550`). The
second is the closer analog for the marker-order state, because it is itself a
brace-composition state.

**The exact additive shape** the region uses — H3 title, blank line, the
`<!-- catalog-state: NAME -->` annotation, blank line, a ` ```text ` fence with the
rendered bytes, blank line, then ONE explanatory paragraph naming the decision IDs:

````markdown
### Success with soft-dep markers

<!-- catalog-state: success-with-soft-dep -->

```text
A plugin operation needs attention.

● official [user]
  ● helper v1.0.0 (installed) {requires pi-subagents, requires pi-mcp}

/reload to pick up changes
```

`helper` declares both `agents` and `mcp` dependencies; the probe reports both companion extensions unloaded so both markers fire inside one brace block (D-16-15). SEV-01: a declared companion that is unloaded silently degrades an otherwise-clean install, so the success row stamps `warning` and the cascade carries the `needs attention` summary line. The per-row bytes are unchanged from the info form -- only the severity (and therefore the summary line) moves.
````

Insert the two new states as **siblings immediately after** this block — append inside the
region, do not restructure; a restructure moves bytes on untouched states.

**Fixture side analog** (`tests/architecture/catalog-uat.test.ts:1156-1178`) — keyed by the
annotation name, `pi` from a probe helper, explicit `expectedSeverity`, and a message
literal whose `dependencies` array is the derivation under test:

```ts
    "success-with-orphan-rewake-and-soft-dep": {
      pi: piWithMcpLoaded(),
      expectedSeverity: "warning",
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                severity: "warning",
                needsReload: true,
                name: "helper",
                version: "1.0.0",
                dependencies: ["agents"],
                reasons: ["orphan rewake"],
              },
            ],
          },
        ],
      },
    },
```

**Probe-helper analog** (`catalog-uat.test.ts:211-225`) — a zero-arg function returning
`MockPi`, with a doc comment stating exactly which markers fire:

```ts
/** Probe reports both pi-subagents and pi-mcp-adapter loaded -- no soft-dep markers fire. */
function piWithBothLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "subagent" }, { name: "mcp" }],
  };
}

/** Probe reports pi-mcp-adapter loaded, pi-subagents NOT loaded -- {requires pi-subagents} fires on dep-bearing rows declaring agents. */
function piWithMcpLoaded(): MockPi {
  return {
    getAllTools: () => [{ name: "mcp" }],
  };
}
```

This is the `piWithBothLoaded` -> `piWithAllLoaded` rename target (D-114-04). Note the helper
exists **independently** at `tests/shared/notify.test.ts:67-71` — two definitions, both
needing the same edit; an editor symbol rename in one file does not reach the other.

**Count-assertion analog** (`:5490-5501`) — the number appears in a comment, the
`assert.equal` argument, AND the message string. All three move 192 -> 194:

```ts
  // Exact count, not a floor: 192 is the number of annotated examples in
  // docs/output-catalog.md, and it is what stops a `loadCatalogExamples`
  // refactor from silently parsing a fraction of the corpus. Update it
  // deliberately when catalog examples are added or removed.
  assert.equal(
    examples.length,
    192,
    `Expected exactly 192 annotated catalog examples; found ${examples.length}. ...`,
  );
```

---

### 10. `README.md` / `README.es.md`

**Analog:** the existing `Agents.` and `MCP servers.` bullets — both lists already carry
the exact "component kind + Requires <companion link>" and "companion + optional-but-
recommended + install command" shapes. The Spanish delta is small: the two lists are
line-for-line parallel (`README.md:21-39` vs `README.es.md:21-39`, identical bullet order,
identical URLs, translated prose only).

`README.md:23-39`:

```markdown
## Features

This extension installs plugins from Claude plugin marketplaces that contain these components:

- Commands.
- Skills.
- Agents. Requires [pi-subagents](https://pi.dev/packages/pi-subagents).
- Hooks. Partial support. For more information, see [Hook compatibility](docs/hooks-compatibility.md).
- MCP servers. Requires [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter).

...

## Prerequisites

- [Pi Coding Agent](https://pi.dev)
- [pi-subagents](https://pi.dev/packages/pi-subagents) (optional but recommended, `pi install npm:pi-subagents`)
- [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter) (optional but recommended, `pi install npm:pi-mcp-adapter`)
```

`README.es.md:23-39` — the parallel to match:

```markdown
- Comandos.
- Habilidades.
- Agentes. Requiere [pi-subagents](https://pi.dev/packages/pi-subagents).
- Hooks (ganchos). Soporte parcial. Para más información, consulta [Compatibilidad de hooks](docs/hooks-compatibility.md).
- Servidores MCP. Requiere [pi-mcp-adapter](https://pi.dev/packages/pi-mcp-adapter).

...

- [pi-subagents](https://pi.dev/packages/pi-subagents) (opcional pero recomendado, `pi install npm:pi-subagents`)
```

The Hooks bullet is the closest analog for the new Workflows bullet, because it is the one
that both flags reduced support AND links its compatibility doc — exactly what workflows
needs. **Spanish delta: 2 bullet lines + 1 prerequisite line.** Register notes: `Requiere`
(not `Requires`), `Para más información, consulta` for the doc link,
`(opcional pero recomendado, ...)` for the prerequisite. The compatibility-doc link target
stays the English filename (`docs/workflows-compatibility.md`) — that is what the Hooks
bullet does.

**Supply-chain constraint (RESEARCH §Security Domain):** every install instruction in both
READMEs and the new doc must name the scoped form `@quintinshaw/pi-dynamic-workflows`.
`pi-workflows` and `pi-dynamic-workflows` are two real, different packages.

---

### 11. The seven `Dependency[]` derivation sites

**Analog for all seven:** `dependenciesFromInstall` (`orchestrators/reconcile/apply-outcomes.ts:435-450`)
— the smallest, clearest instance of the shape. One `const deps: Dependency[] = []`, one
`if` per flag, blank line between, `return deps`:

```ts
/** Derive the closed-set Dependency[] from InstallPluginOutcome flags. */
export function dependenciesFromInstall(outcome: {
  readonly declaresAgents: boolean;
  readonly declaresMcp: boolean;
}): readonly Dependency[] {
  const deps: Dependency[] = [];
  if (outcome.declaresAgents) {
    deps.push("agents");
  }

  if (outcome.declaresMcp) {
    deps.push("mcp");
  }

  return deps;
}
```

**The one site with a structural wrinkle:** `enableRowDependencies`
(`orchestrators/plugin/shared.ts:125-137`) takes a `Pick<...>` plus a `partition?: never`
refusal, and the refusal is load-bearing (WR-01) — it excludes the update/reinstall
outcome shapes that would otherwise structurally match and silently return `[]`. The
`Pick` must widen to include `"stagedWorkflows"`; the `partition?: never` must survive:

```ts
export function enableRowDependencies(
  signals: Pick<LedgerDegradationSignals, "stagedAgents" | "stagedMcpServers"> & {
    readonly partition?: never;
  },
): readonly Dependency[] {
  const dependencies: Dependency[] = [];
  if (signals.stagedAgents === true) {
    dependencies.push("agents");
  }
  // ...
```

Note this site compares `=== true` (the signals are optional booleans) while
`dependenciesFromInstall` tests truthiness (its flags are required). Match the local
idiom per site; do not normalize.

**RESEARCH `:1229-1240`** already carries the finished `install.ts` arm with its WDEP-02 /
WDEP-03 comment. Use it as the comment model for all seven — requirement IDs, present
tense, no phase references.

**A2 risk carried forward:** `sonarjs/no-identical-functions` is unmeasured against seven
three-arm copies. If it fires, extract a named helper; do not reach for a disable
directive.

---

## Shared Patterns

### Comment and test-title anchoring
**Source:** `.claude/rules/typescript-comments.md`; every analog above.
**Apply to:** every file this phase touches.
Requirement/decision IDs lead the comment (`WDEP-01`, `WDOC-02`, `SNM-06`, `RH-3`,
`D-16-15`). `Phase NN` / `Plan NN` / `Wave N` / bare `Pitfall N` are forbidden. Do not
narrate code that no longer exists — in particular, the deleted `DEPENDENCIES` tuple must
not be mentioned in any new comment as "the former tuple"; `soft-dep.ts:26-28` already
states the rationale as a present-tense fact, which is the correct form.

### Closed-set bump ritual
**Source:** `tests/architecture/notify-closed-set-locks.test.ts:29-56`.
**Apply to:** all eight closed-set sites RESEARCH enumerates.
A count that appears in a test title, an assertion, a doc-comment sentence and a failure
message moves in all four places in the same commit, and the bump appends one ledger
comment line naming the ID and the arithmetic.

### Architecture gates verify by planting
**Source:** `.planning/codebase/CONVENTIONS.md`; `tests/architecture/source-scan.ts:48-64`.
**Apply to:** both new gates.
Never assert that a rule's configuration exists. Scan real source for a forbidden token
(layer 2) or drive the real composer and read the real row (criterion 3). The mandatory
negative control — delete one derivation arm, confirm exactly one case reddens, restore,
paste the transcript into the SUMMARY — is the acceptance evidence for criterion 3, not a
nicety.

### No test-only seams
**Source:** `.planning/codebase/CONVENTIONS.md` §Function Design.
**Apply to:** the criterion-3 gate.
Five of the seven derivations are module-private and stay that way. Reach them by driving
the exported outcome-to-row composers or the full orchestrator entry point. If a site
cannot be reached from a public surface, that is a finding about the surface (record it),
not a licence to export.

### Markdown formatting
**Source:** memory note `markdown-formatting-mdformat-not-prettier`; RESEARCH
§Project Constraints.
**Apply to:** `docs/workflows-compatibility.md`, `docs/output-catalog.md`,
`docs/messaging-style-guide.md`, both READMEs.
`mdformat` via pre-commit owns these. `npm run format:check` covers only `js,json,ts`.
`prettier --write docs/*.md` is always wrong. Use `--` for dashes and let the texthooks
fixer normalize.

### Test file structure
**Source:** `notify-stamp-coverage.test.ts`, `install.test.ts`.
**Apply to:** every new or extended suite.
File-path-first header docstring naming the invariant and why this suite owns it;
`node:assert/strict` + `node:test` first import group; production imports with explicit
`.ts`; `import type` last; `// arrange` / `// act` / `// assert` markers inside cases;
one `assert.deepEqual` over a projected array rather than N per-item assertions.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| the admit-versus-run divergence table inside `docs/workflows-compatibility.md` | doc (section) | — | No existing doc carries a table of "shapes we admit that the runtime later refuses." Closest in kind is `docs/hooks-compatibility.md:39-43` (`### Turn-boundary timing shift`), a prose subsection admitting one irreducible divergence under a `✓` row — same honesty register, different structure. Use it for the register and the closing "why we still mark this supported" sentence; invent the table columns (CONTEXT grants this to Claude's discretion). |

Everything else has an exact in-tree analog.

## Metadata

**Analog search scope:** `tests/architecture/`, `tests/orchestrators/plugin/`,
`tests/orchestrators/import/`, `tests/platform/`, `tests/shared/`, `docs/`,
`extensions/pi-claude-marketplace/{platform,shared,shared/concerns,orchestrators,persistence}/`,
repository root READMEs.
**Files read this session:** `tests/architecture/{notify-stamp-coverage,source-scan,no-orchestrator-network,notify-closed-set-locks,catalog-uat}.test.ts`,
`tests/orchestrators/plugin/install.test.ts` (280-440, 9600-9650),
`docs/{hooks-compatibility,output-catalog}.md`, `README.md`, `README.es.md`,
`extensions/pi-claude-marketplace/{platform/pi-api.ts, shared/concerns/soft-dep.ts, shared/notify.ts (2265-2290), persistence/locations.ts (160-182), orchestrators/plugin/shared.ts (118-137), orchestrators/reconcile/apply-outcomes.ts (432-455)}`.
**Tracked-source check:** all 13 named analog paths confirmed via `git ls-files`.
**Pattern extraction date:** 2026-09-07
