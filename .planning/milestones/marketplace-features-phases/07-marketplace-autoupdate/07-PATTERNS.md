# Phase 7: Marketplace Autoupdate - Pattern Map

**Mapped:** 2026-10-19
**Files analyzed:** 16
**Analogs found:** 16 / 16 (every file is a modification of an existing file, or has an in-file analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` | orchestrator | request-response + config file-I/O | itself (`loadFlipLayer` :283, `layerAlreadySet` :297, `notifyNamedMiss` :545); scopeless miss in `orchestrators/marketplace/shared.ts:733-735` | exact |
| `tests/orchestrators/marketplace/autoupdate.test.ts` | test (paired unit) | request-response | itself; CFG-03 cases at :1247-1284 (named) and :1456-1491 (nameless) | exact |
| `tests/integration/marketplace-layer-autoupdate.test.ts` | test (integration) | file-I/O | itself :258-281 | exact |
| `tests/architecture/cross-op-convergence.test.ts` | test (architecture) | transform | itself, `OPS_BARE` / `OPS_EXPLICIT_SCOPE` :28-34, :264-282 | exact |
| `tests/architecture/catalog-uat/fixtures/marketplace-autoupdate.ts` | test fixture | transform | itself :90-101 | exact |
| `tests/architecture/catalog-uat/catalog-contract.test.ts` | test (architecture) | transform | itself :22 `EXPECTED_UTF8_BYTES` | exact |
| `docs/output-catalog.md` | docs | - | itself :4467, :4485-4491 (S2) | exact |
| `README.md`, `README.es.md` | docs | - | README.md:182, README.es.md:180 | exact |
| `CHANGELOG.md` | docs | - | `[Unreleased]` bullet at CHANGELOG.md:20-27 (sub-bullet :26) | exact |
| `features/marketplace/autoupdate.feature` | behavioral test | request-response | itself; misses from `features/marketplace/update.feature:232-242`, `info.feature:71-79`; Outline from `add.feature:20-33`; malformed-config expectation from `add.feature:286-297` | exact |
| `features/lib/layer-config.ts` (D-09: add raw-text writer) | lib (step support) | file-I/O | `writeLayerPlugins` in same file :77-88 | exact |
| `features/step_definitions/config.steps.ts` (D-09: second `Given`) | step definition | file-I/O | the `a config in scope {word} and layer {word}, with these plugins:` step :118-131 | exact |
| `.agents/skills/cucumber/rules/steps.md` (D-09 rule amendment) | docs/rule | - | the paragraph at steps.md ~line 56 ("It is the only config step that writes.") | exact |
| fileoverview of `config.steps.ts` (:1-21) and `layer-config.ts` (:1-8) | docs-in-code | - | both currently say "the one setup step that writes" | exact |
| `.planning/phases/07-.../07-NN-RED.json` | evidence | - | `.planning/phases/06-marketplace-update-and-c-10-fix/06-01-RED.json` | exact |

## Gate search for the "only config step that writes" rule (D-09)

Searched `scripts/check-features.mjs`, `eslint.config.js`, `.fallowrc.json`, `tests/architecture/`, `features/support/`. **No automated gate enforces it.** The rule lives only in prose:
- `.agents/skills/cucumber/rules/steps.md` (the "config steps ... never write them, with one exception" bullet).
- `features/step_definitions/config.steps.ts:5-8` fileoverview: "One setup step writes the `plugins` member ... Every other step only reads, so this module writes nothing else".
- `features/lib/layer-config.ts:1-8` fileoverview: "the one setup step that writes a layer config".

Related gates that DO constrain the new code (not this rule):
- `eslint.config.js:267` (step modules: no `defineStep`, no hooks/parameter types, string-literal step text, export nothing).
- `eslint.config.js:348` (`features/lib/**`: may not import `Given`/`When`/`Then`/hooks — library code registers nothing).
- `scripts/check-features.mjs` (`codeRoots` = step_definitions/support/lib; every definition must be used, so the new step must be used by the D-05 scenario in the same commit).
- `tests/architecture/config-state-write-seams.test.ts:149` scans for `atomicWriteJson(...)` on config files — only production; features use plain `writeFile`, unaffected.

So the D-09 "gate update" is: amend steps.md plus the two fileoverviews. Nothing in `scripts/` or `tests/architecture/` needs changing.

## Pattern Assignments

### `features/lib/layer-config.ts` (lib, file-I/O) — add a raw-text writer

**Analog:** `writeLayerPlugins`, same file :77-88. Imports already present (:10-16): `existsSync`, `mkdir, readFile, writeFile` from `node:fs/promises`, `path`.

```ts
export async function writeLayerPlugins(
  filePath: string,
  plugins: readonly LayerPlugin[],
): Promise<void> {
  const config = await readLayerObject(filePath);
  const written = { ...config, plugins: Object.fromEntries(plugins.map(({ key, entry }) => [key, entry])) };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(written, null, 2)}\n`);
}
```

New export (suggested `writeLayerText(filePath: string, text: string): Promise<void>`): `mkdir(dirname, {recursive:true})` then `writeFile(filePath, text)`. Raw text on purpose (models a hand edit that breaks the file), so it must NOT go through `readLayerObject` (which `JSON.parse`s and would throw on an already-broken file). Explicit return type required (`explicit-module-boundary-types`). Update the fileoverview (:1-8) to name both writers.

### `features/step_definitions/config.steps.ts` (step, file-I/O) — second `Given`

**Analog:** :118-131.

```ts
Given(
  "a config in scope {word} and layer {word}, with these plugins:",
  async function (this: ScenarioWorld, scope: string, layer: string, table: DataTable) {
    const file = layerConfigPath(this, scope, layer);
    const plugins = readLayerPlugins(table);
    await writeLayerPlugins(file, plugins);
    const { config, content } = await readConfigObject(file);
    assert.deepStrictEqual(Reflect.get(config, "plugins"), ..., `${file} does not declare the plugins of the table: ${content}`);
  },
);
```

Apply:
- Reuse `layerConfigPath(world, scope, layer)` (:54-61) so the step uses `base`/`local` layer words like its sibling.
- Text via a Gherkin doc string (`{word}` params + trailing `:`, `docString: string` arg) — e.g. `a config in scope {word} and layer {word}, with this text:`. Step text must be a Cucumber expression literal (steps.md, eslint :267).
- Register `Given` before the `Then`s (steps.md "Order Given, then When, then Then"); place right after the plugins writer.
- Setup-asserts-success rule (steps.md): read back with `readFile(file, "utf8")` and `assert.strictEqual(content, text)` — do NOT use `readConfigObject` (it JSON-parses).
- Uses `this`, so `function` expression with typed `this` (prefer-arrow-callback otherwise).
- Update the module fileoverview (:5-8) to say two setup steps write.

### `.agents/skills/cucumber/rules/steps.md` (rule)

Replace the bullet ending "It is the only config step that writes." with one naming both writers: the `plugins`-member writer and the raw-text writer (models a hand edit that breaks the file, D-09), both through `features/lib/layer-config.ts`. Match the existing sentence style (simple-english).

### `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` (orchestrator)

**Fail-closed load pattern to copy** (:274-291):
```ts
function invalidConfigError(basename: string): InvalidMarketplaceManifestError {
  return new InvalidMarketplaceManifestError(`Config file "${basename}" failed schema validation.`);
}
async function loadFlipLayer(filePath: string, local: boolean): Promise<FlipLayer> {
  const cfg = await loadConfig(filePath);
  if (cfg.status === "invalid") {
    throw invalidConfigError(path.basename(filePath));
  }
  return { filePath, local, config: cfg.status === "valid" ? cfg.config : { schemaVersion: 1 } };
}
```

**D-02 change point** (:292-304) — current body; doc comment states the old "always writes" rule and must be rewritten:
```ts
function layerAlreadySet(layer: FlipLayer, name: string, enable: boolean): boolean {
  const own = ownValue(layer.config.marketplaces, name)?.autoupdate;
  if (own === undefined) {
    return !layer.local && !enable;
  }
  return own === enable;
}
```
Use the `InheritedValue` callback / `inheritFrom` / `inheritAfterFlip` shape in 07-RESEARCH.md Pattern 1 (lazy, throws `invalidConfigError` only when a valueless local entry asks). Keep `ownValue` for own-key reads.

**D-08 change point** (:538-568):
```ts
  const missScope = opts.scope ?? "project";
  notify(opts.ctx, opts.run, {
    kind: "marketplace-not-added",
    name,
    scope: missScope,
    ...(await crossScopeFlag({ cwd: opts.cwd, marketplace: name, scope: opts.scope })),
  });
```
Copy the scopeless form from `orchestrators/marketplace/shared.ts:733-735` (`notify(opts.ctx, opts.run, { kind: "marketplace-not-added", name: opts.name })`) with the conditional-spread idiom of `edge/handlers/marketplace/autoupdate.ts:58`: `...(opts.scope !== undefined && { scope: opts.scope })`. Never `scope: undefined` (`exactOptionalPropertyTypes`). Rewrite JSDoc :538-544 ("the bracket names the first one in SC-6 order: project"). Also fix docs at :122-131 and :427-433 (base "never touched" -> "never written").

Constraints: no `platform/git` import (BLOCK F); output only via `notify`; cognitive complexity <= 15 in both ESLint and fallow.

### `tests/orchestrators/marketplace/autoupdate.test.ts` (paired unit)

Analog cases inside the file: CFG-03 named invalid-config bytes :1247-1284 (copy for D-05 named `--local` with `'    cause: Config file "claude-plugins.json" failed schema validation.'`); nameless invalid-config :1456-1491 (`⊘ (unknown) [project] (failed)`, tally `Marketplace autoupdate: 2 failures`). Edits listed in 07-RESEARCH.md "Tests and docs that pin today's rules" (:495, :544, :1050, :1192, :1493, :1569-1620, :1622, :1701). Keep `withHermeticHome`-style isolation already used.

### `tests/integration/marketplace-layer-autoupdate.test.ts`

:258-281: `afterEnable` -> `{ base: true, local: undefined, listed: true }`.

### `tests/architecture/cross-op-convergence.test.ts`, catalog fixture, catalog contract, `docs/output-catalog.md`

Change together (one commit): add `"autoupdate"` to `OPS_BARE` and rewrite the asymmetry comments (:28-34, :264-282); drop `scope: "project"` in `fixtures/marketplace-autoupdate.ts:90-101`; S2 block at output-catalog.md:4489 loses `[project] `; `EXPECTED_UTF8_BYTES` 46_633 -> 46_623 (verify from failure output). Prose model for S2: the remove/info/update "absent from both scopes carries no bracket" wording.

### `features/marketplace/autoupdate.feature`

Analogs and ready-made blocks: 07-RESEARCH.md "Code Examples" (AU-03 Outline from add.feature:20-33, AU-07, AU-08 from update.feature:232-242, D-07 Outline, D-01 layout). Rewrite :82-107 for D-04.

D-05 scenario (new, uses the D-09 step): add `tools` to project base and `--local`, `Given a config in scope project and layer base, with this text:` (doc string of malformed JSON), `When ... noautoupdate tools --scope project --local`, then fields with `reasons | invalid manifest`; failure-row shape from `add.feature:286-297`. "No change to either config": the base can no longer be read by `declares these marketplaces` (it JSON-parses), so assert the local config's declaration table and rely on the absence of a write for the base — or add no base assertion; the planner should decide (a raw-text read-back `Then` would be a third config step and is not authorized by D-09).

Rules (`check:features`): tags only on `Examples:`; tagged blocks need a fitting `source kind` column; no `And`/`But`; all `Given` before first `When`; Outline needs >= 3 variants.

### `CHANGELOG.md`

Amend the branch's existing `[Unreleased]` bullet (:20-27, sub-bullet :26 "Without a name ... set the value in every config that declares each marketplace"), per `.agents/skills/changelog/SKILL.md` (one entry per PR, <= 40 words per bullet, simple-english + humanizer, read `rules/entries.md`). Do not add a new top-level bullet. Note :27 already says a valueless local entry follows the base — the flip now agrees with it.

### RED evidence

Copy the fields of `06-01-RED.json` (`command`, `exitCode`, `output`, `targetTest`, `targetFile`, `expected`, `actual`, `semanticAssessment`, `nodeVersion`, `baseCommit`, `diff`), command shape `npm run --silent test:cucumber -- features/marketplace/autoupdate.feature --parallel 1 --name '^<title>$' --format summary --format junit:<tmp>`.

## Shared Patterns

- **Fail closed on unreadable config:** `loadConfig` trichotomy + `invalidConfigError(path.basename(...))` (autoupdate.ts:274-291). Never use `loadMergedScopeConfig` to decide "already" (treats invalid as empty).
- **Optional field idiom:** conditional spread `...(x !== undefined && { k: x })` (edge/handlers/marketplace/autoupdate.ts:58).
- **Cucumber setup steps assert their own success** (config.steps.ts:124-129).
- **Whole-value assertions** (`deepStrictEqual` / `strictEqual`), no `includes`.

## No Analog Found

None. The raw-text writer has a direct sibling (`writeLayerPlugins`); only its "skip JSON parsing" behavior is new.

## Metadata

**Analog search scope:** `features/`, `extensions/pi-claude-marketplace/orchestrators/marketplace/`, `tests/architecture/`, `scripts/check-features.mjs`, `eslint.config.js`, `.agents/skills/cucumber/rules/steps.md`, `CHANGELOG.md`
**Pattern extraction date:** 2026-10-19
