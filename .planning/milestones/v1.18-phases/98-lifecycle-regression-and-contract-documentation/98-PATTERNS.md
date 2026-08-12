# Phase 98: Lifecycle regression and contract documentation - Pattern Map

**Mapped:** 2026-08-09
**Files analyzed:** 16 (1 new, 15 modified)
**Analogs found:** 16 / 16

Every deliverable in this phase extends machinery that already exists in the tree.
There is exactly ONE new file (the COMPAT-01 gate) and it has three strong analogs
already in `tests/architecture/`. Nothing here needs a pattern invented.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `tests/architecture/compat-01-no-expansion.test.ts` **(NEW)** | test (architecture gate) | transform (read constants + source, assert) | `tests/architecture/notify-closed-set-locks.test.ts` + `tests/architecture/no-orchestrator-network.test.ts` | exact |
| `tests/helpers/source-scan.ts` **(NEW, optional — D-98-09 delegation shape 1)** | utility (test helper) | file-I/O | `tests/architecture/no-orchestrator-network.test.ts:7,88-118` (the code being extracted) | exact |
| `extensions/.../orchestrators/plugin/shared.ts` | model (shared type home) | — | `orchestrators/plugin/enable-disable.ts:115-139` (`EnableDegradationSignals`, the interface moving) | exact |
| `extensions/.../orchestrators/plugin/install.ts` | orchestrator | transform (ctx → outcome) | its own sibling `enable-disable.ts:305-316` (fresh-arm signal spread) | exact |
| `extensions/.../orchestrators/reconcile/apply-outcomes.ts` | model (outcome contract) | — | `apply-outcomes.ts:101-109` (`degradedKinds` field, same optional-signal shape) | exact |
| `extensions/.../orchestrators/reconcile/apply.ts` | orchestrator (projection) | transform | `apply.ts:693-698` (enable arm spread) → mirror at `:609-611` | exact |
| `extensions/.../orchestrators/reconcile/notify.ts` | service (row projection) | transform | `notify.ts:532-564` `enabledRowFromOutcome` → mirror into `installedRowFromOutcome:494-505` | exact |
| `extensions/.../orchestrators/plugin/enable-disable.ts` | orchestrator | transform | `install.ts:1743-1750, :1808-1817` (dependencies + `companionSeverity`) | exact |
| `extensions/.../shared/notify.ts` | service (renderer) | transform | `notify.ts:3726-3738` (existing `partialHint` trailer gates) | exact |
| `extensions/.../orchestrators/plugin/update.ts` | orchestrator | transform | `enable-disable.ts:249-259` (record-derived `partial`, D-69-01) | exact |
| `extensions/.../persistence/state-io.ts` | model (typebox schema) | — | `state-io.ts:190-200` (`STATE_SCHEMA`, already exported — mirror for the record schema) | exact |
| `tests/orchestrators/plugin/uninstall.test.ts` | test | file-I/O + CRUD | its own `seedFullPlugin:143-226` + `PU-1:230-264` | exact |
| `tests/orchestrators/plugin/update.test.ts` | test | request-response | its own `PUP-5:425-463` | exact |
| `tests/orchestrators/marketplace/update.test.ts` | test | event-driven (cascade) | its own `MU-6/MU-8:810-855` | exact |
| `tests/orchestrators/reconcile/notify.test.ts` | test | transform | its own enable-arm `{orphan rewake}` case | exact |
| `docs/output-catalog.md` + `docs/prd/pi-claude-marketplace-prd.md` | config (byte contract + spec) | — | `docs/output-catalog.md:40-79` Conventions register + existing `<!-- catalog-state: … -->` fenced blocks | exact |

---

## Pattern Assignments

### `tests/architecture/compat-01-no-expansion.test.ts` (NEW — test, transform)

**Analogs:** `tests/architecture/notify-closed-set-locks.test.ts` (import-and-assert shape),
`tests/architecture/no-orchestrator-network.test.ts` (fs source scanning),
`tests/architecture/catalog-uat.test.ts` (REPO_ROOT resolution).

**Imports pattern — runtime-constant clauses** (`notify-closed-set-locks.test.ts:19-27`):

```ts
import assert from "node:assert/strict";
import test from "node:test";

import {
  MARKETPLACE_STATUSES,
  PLUGIN_STATUSES,
  REASONS,
  STATUS_TOKENS,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";
```

**Imports pattern — source-scanning clause** (`no-orchestrator-network.test.ts:1-7`):

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
```

Note the import-order rule: `node:fs/promises` sorts before `node:path` before `node:test`
before `node:url`, all in the builtin group, then a blank line, then the extension imports
alphabetized. Prettier `printWidth: 100`.

**Core pattern — file-header narrates the whole contract** (D-98-09 "one file tells the
whole contract"). Copy the header style from `no-orchestrator-network.test.ts:9-56`: a single
block comment listing each gated clause with its requirement anchor, an explicit
**"Exempt (do NOT add)"** section, and a **rationale** paragraph for every non-obvious
mechanic. That file's `stripComments rationale (mandatory)` paragraph is the model for
documenting why the gate reads with Node `fs` (D-98-10), and is where the RESEARCH finding
"`info.ts` carries no literal NUL byte today; the escape at `info.ts:421-426` resolved it —
the rule stands, the workaround is moot" belongs so nobody re-litigates it.

**Enumeration-equality pattern** (D-98-08 — replaces, does NOT duplicate, the count pins in
`notify-closed-set-locks.test.ts:29-63`):

```ts
test("COMPAT-01: STATUS_TOKENS is exactly the 24 members this milestone inherited", () => {
  assert.deepEqual(
    [...STATUS_TOKENS],
    [
      "installed", "updated", "reinstalled", "uninstalled", "added", "removed",
      "available", "unavailable", "upgradable", "skipped", "failed",
      "rollback failed", "manual recovery", "no marketplaces", "no plugins",
      "will install", "will uninstall", "will enable", "will disable", "disabled",
      "partially-installed", "partially-upgradable", "partially-available", "remote",
    ],
  );
});
```

Verbatim member lists for all four tuples are in RESEARCH §COMPAT-01 clause 1
(`notify.ts:243-288`, `:472-509`, `:524-532`; `REASONS` order lives at `notify.ts:90+`, not
in the `notify-reasons.ts` topic groups — compare **sets** or read the literal order off
`notify.ts`).

**Source-scan pattern — the glyph-count clause** (`no-orchestrator-network.test.ts:88-118`):

```ts
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

const src = await readFile(path.join(REPO_ROOT, rel), "utf8");
const stripped = stripComments(src);
```

Applied to the eighth-glyph clause: `(stripped.match(/^export const ICON_[A-Z_]+ = /gm) ?? []).length === 7`.

**Offender-accumulator + single assert pattern** (`no-orchestrator-network.test.ts:95-124`) —
collect into `const offenders: string[] = []`, then one
`assert.deepEqual(offenders, [], "<requirement-anchored explanation>")`. Copy this rather than
asserting inside the loop; the failure message carries the whole diff.

**Delegation pattern (D-98-09):** NEVER `import ... from "./no-orchestrator-network.test.ts"` —
`node:test` re-registers its top-level `test()` calls. Recommended shape: extract `REPO_ROOT`,
`stripComments`, and an `assertNoForbiddenSurface(targets, patterns)` into
`tests/helpers/source-scan.ts` (house precedent: `tests/helpers/credential-mock.ts`,
`git-mock.ts` are non-test modules under `tests/helpers/`) and have both gates import it.

**Test-title pattern:** `test("COMPAT-01: …")` — requirement ID prefix, no `Phase 98`,
no `Wave N` (`.claude/rules/typescript-comments.md`).

---

### `orchestrators/plugin/shared.ts` + `install.ts` + `reconcile/*` (IN-07, D-98-01)

**Analog:** the enable arm, which already does exactly what the install arm must.

**Signal-spread pattern to copy** (`enable-disable.ts:305-316`):

```ts
    const ledgerCtx = result.installCtx;
    const resolved = ledgerCtx.resolved;
    const degradedKinds = Array.from(new Set(ledgerCtx.frontmatterDegradations.map((d) => d.kind)));
    return {
      kind: "fresh",
      version: recordedVersion,
      ...(resolved.state === "partially-available" && { unsupported: [...resolved.unsupported] }),
      ...(resolved.orphanRewake === true && { orphanRewake: true }),
      ...(degradedKinds.length > 0 && { degradedKinds }),
    };
```

The `...(cond && { field })` omit-when-false idiom is the house convention for optional
outcome fields (required by `exactOptionalPropertyTypes`). Apply at `install.ts:1858-1865`.

**Row-projection pattern to mirror** — `enabledRowFromOutcome` (`reconcile/notify.ts:532-564`)
into `installedRowFromOutcome` (`reconcile/notify.ts:494-505`):

```ts
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  const reasons: ContentReason[] = [
    ...(outcome.orphanRewake === true ? (["orphan rewake"] as const) : []),
    ...malformed,
  ];
  const severity = malformed.length > 0 ? "warning" : "info";
```

Emit ORDER is contractual: `orphan rewake` first, then malformed tokens, then dropped kinds —
stated at `enable-disable.ts:985-988` and `reconcile/notify.ts:520-523`, matching
`install.ts:1767-1779`.

**Optional-field doc-comment pattern** (`apply-outcomes.ts:101-109`, the `degradedKinds`
field) — every optional signal on `PluginInstalledOutcome` carries a block comment citing its
requirement ID (`WARN-01 / D-86-03`); the new `orphanRewake` field cites `SURF-05 / D-63-08`.

**Cycle anti-pattern:** `enable-disable.ts:74` imports `runInstallLedger` from `install.ts`.
Do NOT import `EnableDegradationSignals` back. Both files already import `./shared.ts`
(`install.ts:153`, `enable-disable.ts:80`) — that is the cycle-free home for the renamed
`LedgerDegradationSignals`. No lint rule catches this (`import-x/no-cycle` is not configured).

---

### `orchestrators/plugin/enable-disable.ts` (WR-06, D-98-02)

**Analog:** `install.ts:1743-1750` and `:1808-1817` — the same two derivations, already written.

**Dependencies-derivation pattern** (`install.ts:1743-1750`):

```ts
    const dependencies: Dependency[] = [];
    if (installCtx.stagedAgentNames.length > 0) {
      dependencies.push("agents");
    }

    if (installCtx.stagedMcpServerNames.length > 0) {
      dependencies.push("mcp");
    }
```

Note the blank line between the two `if` blocks — `@stylistic/padding-line-between-statements`
requires a blank line after every block-like statement.

**Composed-severity pattern** (`install.ts:1808-1817`):

```ts
    const successSeverity =
      installCtx.frontmatterDegradations.length > 0
        ? "warning"
        : companionSeverity(
            {
              declaresAgents: installCtx.stagedAgentNames.length > 0,
              declaresMcp: installCtx.stagedMcpServerNames.length > 0,
            },
            softDepStatus(pi),
          );
```

This is the exact composition `freshEnableRow` needs and it already gets the WARN-01 raise
right: malformed wins outright, otherwise the companion probe decides. Replacing
`severity = malformed.length > 0 ? "warning" : "info"` (`enable-disable.ts:1009`) with a bare
`companionSeverity(...)` would silently drop the WARN-01 raise.

**Target sites:** `freshEnableRow` (`enable-disable.ts:999-1036`, both arms, and delete the
now-false `SEV-01` comment at `:1014-1016`) and `enabledRowFromOutcome`
(`reconcile/notify.ts:532-564`, both arms, and correct the `WR-06` sentence at `:516-518`).

**Complexity guard:** extract a small `enableRowDependencies(outcome)` helper rather than
inlining — `sonarjs/cognitive-complexity` is an **error** at 15, and
`sonarjs/no-nested-conditional` is also an error. Precedent for the escape hatch when
extraction is not viable: `update.ts:1552` carries an explicit
`// eslint-disable-next-line sonarjs/cognitive-complexity`.

**Catalog obligation:** byte-changing. Add a soft-dep state under `## /claude:plugin enable`
mirroring `soft-dep-on-installed`, its `FIXTURES` entry in `catalog-uat.test.ts`, and row
assertions — same commit.

---

### `shared/notify.ts` + `enable-disable.ts` (WR-02, D-98-03)

**Analog:** the existing trailer gates (`notify.ts:3726-3738`):

```ts
  if ((p.status === "unavailable" || p.status === "partially-available") && p.partialHint === true) {
    lines.push(`    ${PARTIAL_INSTALL_HINT_TRAILER}`);
  }
  if (p.status === "partially-upgradable" && p.partialHint === true) {
    lines.push(`    ${PARTIAL_UPDATE_HINT_TRAILER}`);
  }
```

Widen the second gate's status disjunction to include `"failed"`; reuse the FROZEN
`PARTIAL_UPDATE_HINT_TRAILER` (`notify.ts:2458`) — minting a new literal would add bytes to pin.
Add `partialHint?: boolean` to `PluginFailedMessage` (`notify.ts:918-938`), copying the field's
declaration + doc comment verbatim from one of the three interfaces that already carry it
(`notify.ts:811`, `:837`, `:908`).

**Cause-narrowing pattern to copy** (`update.ts:943-958`, `composeUpdateDeclineRow`) — narrow
`outcome.cause instanceof PluginShapeError && cause.shape.kind === "no-longer-installable" &&
cause.shape.partialable`, then stamp
`reasons: narrowUnsupportedKinds(cause.shape.unsupportedKinds ?? [])` and `partialHint: true`.
Apply in `composeOutcomeRow`'s `"enable-failed"` arm (`enable-disable.ts:1100-1126`).

---

### `orchestrators/plugin/update.ts` (WR-04, D-98-04 — direction 2)

**Analog:** `runEnableBranch`'s record-derived gate (`enable-disable.ts:249-259`), which
already derives `partial` from the persisted record and cites D-69-01 for it. Copy both the
one-line derivation and the citing comment style into `preflightUpdate` — `record` is in scope
at `update.ts:1005`, `resolveUpdateCandidate` is called at `:1083-1087`, and
`isRecordedButDisabled` is already imported at `update.ts:97`:

```ts
partial: args.partial === true || isRecordedButDisabled(record)
```

**Falsified in-tree prose to rewrite** (this is inside the phase's own scope):
`tests/orchestrators/plugin/update.test.ts:2914-2919` asserts the opposite in its suite header.

---

### `tests/orchestrators/plugin/uninstall.test.ts` (LIFE-04, D-98-12)

**Analog:** its own `seedFullPlugin` (`:143-226`) and `PU-1` (`:230-264`).

**Seed-factory pattern** — extend in place (D-98-11), keeping the per-kind comment ladder:

```ts
async function seedFullPlugin(
  locations: ReturnType<typeof locationsFor>,
  marketplace: string,
  plugin: string,
  cwd: string,
): Promise<{ skillDir: string; commandFile: string; agentFile: string; mcpJson: string }> {
  await mkdir(locations.extensionRoot, { recursive: true });

  // skill: <skillsTargetDir>/<name>/SKILL.md
  const skillDir = path.join(locations.skillsTargetDir, "uni-skill");
  await mkdir(skillDir, { recursive: true });
  await writeFile(path.join(skillDir, "SKILL.md"), "---\nname: uni-skill\n---\nbody\n");
  ...
```

**The hooks gap** (RESEARCH §LIFE-04): `seedFullPlugin` seeds four kinds and omits hooks
entirely. Add, in the same comment style, using the path shape from `bridges/hooks/stage.ts:34-36`:

```ts
  // hooks: <hooksDir>/<plugin>/hooks.json
  const hooksFile = path.join(locations.hooksDir, plugin, "hooks.json");
  await mkdir(path.dirname(hooksFile), { recursive: true });
  await writeFile(hooksFile, JSON.stringify({ hooks: {} }));
```

and add `hooks: [plugin]` to the `makePluginRecord({...})` call at `:214-219`. Widen the return
type to include `hooksFile`. `makePluginRecord` already accepts a `hooks` slot
(`uninstall.test.ts:101`).

**Manifest-absent seeding:** `uninstall.ts` reads no manifest at all (`uninstall.ts:44-59`
import list). Point `manifestPath` (`:211`) at a path that does not exist so the absence is
explicit and self-documenting.

**Per-case pattern** (from `PU-1:230-264`): `withHermeticHome(...)` → `mkdtemp` → `locationsFor`
→ seed → `uninstallPlugin({ctx, pi, scope, cwd, marketplace, plugin})` → per-kind
`assert.equal(await pathExists(x), false, "<kind> removed")` → record-removal assertion
`assert.equal("hello" in (after.marketplaces["mp"]?.plugins ?? {}), false)` → `finally { rm }`.
Five isolated cases, one kind asserted each (D-98-12); MCP asserts the server key is gone from
`mcp.json` (see `:185-200`), agents also assert the `agentsIndexPath` row (`:162-183`).

**Hermetic-HOME helper** (`uninstall.test.ts:119-134`) — already present per suite; reuse
in place, do not extract.

---

### `tests/orchestrators/plugin/update.test.ts` (LIFE-05, D-98-13)

**Analog:** `PUP-5` (`:425-463`) — copy verbatim, vary only the `target` argument.

```ts
      const seeded = await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: { hello: { version: "1.0.0", hasSkill: true } },
        installedVersions: { hello: "1.0.0" },
      });

      // Simulate the marketplace dropping the entry after install.
      await rewriteManifest(seeded.manifestPath, "mp", {});
      ...
      assert.equal(
        body,
        "A plugin operation needs attention.\n\n● mp [project]\n  ⊘ hello v1.0.0 (skipped) {not in manifest}",
      );
      assert.equal(notifications[0]?.severity, "warning");
```

Two new cases: `target: { kind: "marketplace", marketplace: "mp" }` and
`target: { kind: "all" }` with `scope: "project"`. Both produce the SAME byte row (the
`[project]` bracket rides the marketplace header; the plugin-row bracket is suppressed by
orphan-fold). Section-divider comment style: `// ─── LIFE-05: … ───`.

---

### `tests/orchestrators/marketplace/update.test.ts` (LIFE-06)

**Analog:** `MU-6 / MU-8` (`:810-855`) — the `autoupdate: true` + injected `pluginUpdate` shape:

```ts
    await seedGithubMarketplace({ cwd, name: "auto-mp", ref: "main", autoupdate: true,
      plugins: { hello: makePluginRecord() } });
    const pluginUpdate: PluginUpdateFn = async (plugin, marketplace) => {
      calls.push({ plugin, marketplace });
      return Promise.resolve({ partition: "updated", name: plugin, ... });
    };
    await updateMarketplace({ ctx, pi, name: "auto-mp", scope: "project", cwd, gitOps, pluginUpdate });
```

Two cases (RESEARCH §LIFE-06): (1) mapper-level, stub `pluginUpdate` returning
`partition: "skipped" … reasons: ["not in manifest"]`, assert the rendered cascade row;
(2) end-to-end with the real `updateSinglePlugin`.

**Fixture hazard:** `updateSinglePlugin` does `const cwd = process.cwd()` (`update.ts:544-550`).
Use `scope: "user"` with the suite's `withHermeticHome` — `locationsFor("user", cwd)` ignores
`cwd` (`locations.ts:144-145`). NEVER `process.chdir` (process-global; unsafe under
`node --test` concurrency).

---

### `docs/output-catalog.md` + `docs/prd/pi-claude-marketplace-prd.md` (DOC-08)

**Analog:** the catalog's own Conventions register (`docs/output-catalog.md:40-79`).

**Prose register pattern** — declarative present tense, byte forms in backticks, every claim
anchored to a requirement/decision ID and often to a source symbol:

```markdown
- `{<reasons>}` -- single brace block, comma-space separated, emitted only on the 6
  reason-bearing variants (`partially-available | unavailable | upgradable | skipped |
  failed | manual recovery`) and only when the composed reasons list is non-empty.
```

Uses `--` (not an em dash), `ALL-CAPS` for emphasis on contractual words (`ONLY`, `NEVER`,
`MUST`), and closes with the enforcing gate's path. Match the surrounding register per the
surgical-changes rule; the newer sections are written in `simple-english`.

**Fenced-block byte contract:** every block preceded by `<!-- catalog-state: STATE -->` inside
a per-command `##` section is parsed by `catalog-uat.test.ts:1-34` and asserted byte-equal
against a `FIXTURES` entry. A stray space fails the suite. Prose OUTSIDE the fences is free.

**Vocabulary guard:** `tests/architecture/partial-vocabulary-guard.test.ts` scans the catalog,
the messaging style guide, and the PRD. A rewrite must not reintroduce `force-installed`,
`force-upgradable`, a bare backticked `unsupported`, or the `(unsupported)` render token
outside the documented allowlist.

**The ten named defects with verified file:line** are tabulated in RESEARCH §DOC-08 — use that
table directly as the task list. D-98-07 requires the PRD §5.3.1 mermaid flowchart
(`prd:348`) to be REDRAWN to `manifest load → lookup → ManifestLookup discriminant → row form`.

**Pre-commit:** `mdformat`, `markdownlint`, `prettier` all run on docs — run
`pre-commit run --files <changed docs>` before committing.

---

## Shared Patterns

### Test-title and comment anchoring
**Source:** `.claude/rules/typescript-comments.md`; `tests/architecture/notify-closed-set-locks.test.ts:29-37`
**Apply to:** every new test and comment in this phase.

```ts
test("OUT-08: REASONS is the closed 38-entry reason set", () => {
  // D-90-05: +1 for the `unsupported component` member -- the truthful marker
  // for a dropped non-carve-out component kind (37 -> 38).
  assert.equal(REASONS.length, 38);
});
```

Requirement/decision ID prefixes the title; the "why this number/behavior" comment cites the
ID that changed it. Forbidden: `Phase 98`, `Wave N`, `Plan NN`, bare `Pitfall N`, `v1.18 milestone`.
Allowed anchors: `LIFE-04`, `COMPAT-01`, `D-98-12`, `WR-06`, `IN-07`, `SEV-01`, `NFR-5`.

### Optional-field spread
**Source:** `orchestrators/plugin/enable-disable.ts:305-316`
**Apply to:** IN-07 (`install.ts`, `reconcile/apply.ts`), WR-02 (`enable-disable.ts` failure arm)

```ts
...(resolved.orphanRewake === true && { orphanRewake: true }),
```

`exactOptionalPropertyTypes` is on — omit-when-false, never `field: undefined`.

### Hermetic HOME test isolation
**Source:** `tests/orchestrators/plugin/uninstall.test.ts:119-134` (identical copy at `update.test.ts:88-103`)
**Apply to:** every new LIFE-04/05/06 case

```ts
async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "uninstall-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn();
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}
```

Deliberately duplicated per suite — do NOT extract into `tests/helpers/` (house convention;
`sonarjs/no-identical-functions` does not fire across files).

### Catalog amendment ships with the behavior change
**Source:** `tests/architecture/catalog-uat.test.ts:1-34`
**Apply to:** WR-06 and WR-02 (both byte-changing), and WR-04 direction 2 if the `(unchanged)`
form is not already a reachable catalog state.

One commit contains: the `<!-- catalog-state: … -->` + fenced block in `docs/output-catalog.md`,
the matching `FIXTURES` entry in `catalog-uat.test.ts`, and the orchestrator-level row assertion.
A wave that lands a carrier without a `docs/output-catalog.md` edit is the warning sign.

### Offender-accumulator assertion
**Source:** `tests/architecture/no-orchestrator-network.test.ts:95-124`
**Apply to:** every multi-target clause of the COMPAT-01 gate

```ts
const offenders: string[] = [];
// ... push `${rel} matches forbidden ${name}: ${String(pattern)}`
assert.deepEqual(offenders, [], `<requirement-anchored explanation>\n  ${offenders.join("\n  ")}`);
```

### Lint shape rules that bite this phase
**Source:** `.planning/codebase/CONVENTIONS.md`; `eslint.config.js`
**Apply to:** all touched TS

- `sonarjs/cognitive-complexity: ["error", 15]` — `freshEnableRow` and `composeOutcomeRow` both
  gain branches; extract helpers.
- `@stylistic/padding-line-between-statements` — blank line after every block-like statement.
- `@typescript-eslint/explicit-module-boundary-types: "error"` — every new exported function
  (including `tests/helpers/source-scan.ts`) declares its return type.
- `import-x/order` — builtin → external → internal → parent → sibling, blank line between
  groups, alphabetized case-insensitively, type-only imports last.
- Test files import production modules with explicit `.ts` extensions.

---

## No Analog Found

None. Every file in this phase has an exact or near-exact in-tree analog.

The single closest thing to a novel construct is `tests/helpers/source-scan.ts` (only if
D-98-09 delegation shape 1 is chosen), and even that is a verbatim extraction of code that
already exists at `tests/architecture/no-orchestrator-network.test.ts:7, :88-92`, landing
beside existing non-test helper modules (`tests/helpers/credential-mock.ts`, `git-mock.ts`).

---

## Metadata

**Analog search scope:** `tests/architecture/`, `tests/orchestrators/plugin/`,
`tests/orchestrators/marketplace/`, `tests/helpers/`,
`extensions/pi-claude-marketplace/orchestrators/{plugin,reconcile,marketplace}/`,
`extensions/pi-claude-marketplace/shared/`, `extensions/pi-claude-marketplace/persistence/`,
`docs/`
**Files read this session:** 10 (targeted, non-overlapping ranges)
**Pattern extraction date:** 2026-08-09
