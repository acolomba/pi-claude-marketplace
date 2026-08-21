# Phase 105: No-op parity sweep and contract documentation - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 6 (1 new, 5 modified)
**Analogs found:** 6 / 6

This map answers only what RESEARCH.md did not: which existing file each touch
point should copy its SHAPE from. It deliberately does not restate the research
pass's line numbers, harness signatures, or proven behavior.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `docs/plugin-enablement.md` (NEW) | doc (contract reference) | n/a | `docs/env-vars.md` | exact (whole-doc); `docs/hooks-compatibility.md` for the closer |
| `README.md` + `README.es.md` (wiring) | doc index | n/a | `README.md:28` hooks-compatibility bullet | exact |
| `tests/orchestrators/plugin/update.test.ts` (+1 test) | test | request-response, multi-plugin cascade | `update.test.ts:871` (UGRM-02) | exact |
| `tests/orchestrators/plugin/reinstall.test.ts` (+1 test) | test | request-response, multi-plugin cascade | `reinstall.test.ts:3967` (DFEN-07 / D-103-12 bulk) | exact |
| `tests/orchestrators/reconcile/apply.test.ts` (+1 test, +helper widening) | test + fixture helper | event-driven (load-time reconcile) | `apply.test.ts:2223` (DFEN-05 / D-102-04) + helper `seedDefaultDisabledInstallScope` | role-match |
| `apply.test.ts::seedRealPathMarketplace` (widen) | fixture helper | file-I/O | `update.test.ts:180::seedPathMarketplace` | exact (already-widened sibling) |
| `docs/output-catalog.md` (+1 block, +1 token-row edit) | doc + binding fixture | n/a | `reinstall-degraded-component` block + `catalog-uat.test.ts:1506` fixture | exact |
| `.planning/.../REQUIREMENTS.md` (OUT-02 amend) | spec | n/a | `OUT-05` bullet (same file) | exact |
| `tests/orchestrators/plugin/list.test.ts` (~:2593 deletion) | test | n/a | n/a — deletion only | n/a |

______________________________________________________________________

## 1. `docs/plugin-enablement.md` — whole-document analog

**Recommendation: model the whole document on `docs/env-vars.md`, and take one
element from `docs/hooks-compatibility.md` (the `## Further reading` closer).**

Why env-vars.md over hooks-compatibility.md, despite both documenting a Claude
Code divergence:

| Axis | `env-vars.md` | `hooks-compatibility.md` | Which fits enablement |
|------|---------------|--------------------------|-----------------------|
| Document thesis | "here is the CONTRACT and the mechanisms that implement it" | "here is a feature-by-feature COMPARISON table vs upstream" | env-vars — enablement is a precedence rule, not a feature grid |
| Divergence handling | a dedicated `## Divergences and documented absences` section that is the single citable home; body sections footnote INTO it | divergences inlined per-section (`### Turn-boundary timing shift` under `## Events`) plus a four-arm `## Install-time disposition` | env-vars — CONTEXT.md requires exactly this section verbatim in spirit |
| Absence handling | a separate `## Not delivered (out of scope)` section that records decisions rather than silence | folded into the ✗ legend rows | env-vars — DOC-02's PDEP-01 gap is an absence, not a ✗ row |
| Mechanism explainer | `## Delivery mechanisms` up front, defining S/E/I before the matrix uses them | legend line only | env-vars — the three-input precedence rule needs the same up-front definition |
| Closer | none | `## Further reading` with upstream + Pi-API links | hooks-compat — borrow this |

Neither doc has YAML front matter (only `docs/messaging-style-guide.md` does,
and only because the lint plugin parses it). Do not add front matter.

### Structural skeleton to copy (`docs/env-vars.md:1-17`)

```markdown
# Environment variables

How the Claude plugin environment variables Claude Code exposes are delivered to plugin components once a plugin is installed under Pi. The table register mirrors [`docs/hooks-compatibility.md`](hooks-compatibility.md): a **Claude Code** ground-truth column against Pi's delivery. Claims here are transcribed from the shipped bridge sources, not from upstream docs -- the Claude Code ground truth was verified against the Claude Code v2.1.212 binary and a live session env (DOC-06).

## Delivery mechanisms

Pi delivers these variables through three mechanisms. The overview matrix marks every cell with which one applies.

- **S -- install-time textual substitution.** ...

## Overview matrix

Legend: **S** = ... · **⚠** = partial ... · **--** = not applicable · **✗** = documented absence. ... Footnote markers on a cell point to the matching subsection under "Divergences and documented absences".
```

Conventions this skeleton encodes, all of which the new doc must honor:

1. **H1, then one dense intro paragraph** — no "Overview" heading, no TOC.
2. **The intro names its provenance** (`transcribed from the shipped bridge
   sources`) and cites its requirement ID inline in parentheses (`(DOC-06)`).
   The enablement doc's equivalent: cite `DFEN-*` / `OUT-*` / `DOC-02`, never
   `D-104-01` (a phase decision ID that archives — CONTEXT.md requires
   re-pointing source comments at the DOC-02 write-up instead).
3. **Define the vocabulary before the table that uses it** — `## Delivery
   mechanisms` precedes `## Overview matrix`. For enablement, the three inputs
   (marketplace entry `defaultEnabled`, plugin.json `defaultEnabled`
   deliberately never read on a read path, user `enabled` in
   `claude-plugins.json`) get their own section before any precedence table.
4. **Legend line is inline prose under the heading**, not a table.
5. **Cross-references to sibling docs are relative and bare-filename**:
   `[`docs/hooks-compatibility.md`](hooks-compatibility.md)` — note the label
   carries the `docs/` prefix but the href does not.
6. **Code references are backticked module-relative paths**, e.g.
   `` `substituteClaudeVars` (`shared/vars.ts`) `` — extension-root-relative,
   never repo-root-relative.

### Divergences section pattern (`docs/env-vars.md:129-133`)

```markdown
## Divergences and documented absences

The behaviors below are deliberate divergences from Claude Code or documented absences. Each is the single citable home for a caveat that the overview matrix and per-surface tables mark with a footnote -- the caveat text is not duplicated elsewhere.

### Inherited `CLAUDE_CODE_*` / `ANTHROPIC_*` vars are not scrubbed

Both hook lanes spread `...process.env` before adding the parity keys. ... The bridge deliberately does **not** scrub them: the stance is non-interference, and no requirement authorized scrubbing. The related threat is dispositioned in the phase security register (code-review finding WR-02; accepted as T-91-01 / AR-91-01) -- an inherited session id is an internal identifier, not a credential.
```

Per-divergence subsection template, drawn from the four instances in that file:
`### <declarative sentence-case title naming the behavior>` → one paragraph that
(a) states upstream's behavior, (b) states Pi's, (c) names the mechanical reason
it cannot match, (d) cites the requirement/decision ID. `### CLAUDE_ENV_FILE is
exposed but not sourced` (`env-vars.md:151`) is the closest single template for
the PDEP-01 divergence — it is the "we implement only half the contract"
shape. `### User-scope ${CLAUDE_PROJECT_DIR} pass-through` (`env-vars.md:167`)
is the closest template for the entry-only read rule — it is the "the value is
unknowable at the moment we would need it, so we decline rather than
approximate" shape, and OUT-05 is verbatim the same argument.

### Absences section pattern (`docs/env-vars.md:171`)

```markdown
## Not delivered (out of scope)

The following Claude Code variables are recognized but not delivered by the extension. They are listed here so a reader finds a recorded decision rather than silence; they are deliberately kept out of the overview matrix, which reflects delivered behavior.

- **`${user_config.*}` / `CLAUDE_PLUGIN_OPTION_*`** -- needs a plugin-options feature Pi does not have.
```

Bullet grammar: `- **<backticked subject>** -- <one clause naming the blocker>.`
Em-dash is the two-hyphen `--` form throughout these docs, never `—`.

### Closer to borrow (`docs/hooks-compatibility.md:253`)

```markdown
## Further reading

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) -- the upstream authoritative field reference, including worked examples, ...
- Pi extension API documentation via the `@mariozechner/pi-coding-agent` package -- the host runtime contract, ...
```

For enablement the equivalent targets are the upstream `/plugin` enablement
docs, `docs/output-catalog.md` (the byte contract for `{installs disabled}`),
and `README.md#configuration-files` (the user-facing `enabled` key).

### Formatting gate

Markdown in this repo is formatted by **mdformat** via pre-commit, NOT prettier
(`npm run format:check` covers only js/json/ts). Running
`prettier --write docs/*.md` is always wrong. Expect mdformat to reflow tables
at commit time; run `pre-commit run --all-files` before committing.

______________________________________________________________________

## 2. Is the new doc linked from anywhere? — discovery audit

**Finding: `docs/` has no index. Exactly one doc is reachable from the README,
and it is `hooks-compatibility.md`.** Full audit over `*.md` / `*.ts` / `*.json`
outside `node_modules/` and `.planning/`:

| Doc | Linked from | Discoverable by a user? |
|-----|-------------|-------------------------|
| `docs/hooks-compatibility.md` | `README.md:28`, `README.es.md:28` (Features bullet) | yes |
| `docs/env-vars.md` | nothing outside `.planning/` (it links OUT to hooks-compatibility, never in) | **no — orphan** |
| `docs/output-catalog.md` | nothing outside `.planning/`; bound only by `tests/architecture/catalog-uat.test.ts` | **no — orphan** |
| `docs/messaging-style-guide.md` | nothing outside `.planning/`; bound by `tests/lint-rules/lib/frontmatter.js` | **no — orphan** |
| `docs/open-closed-proof.md`, `docs/adr/*`, `docs/prd/*`, `docs/research/*` | nothing | no |

So the house pattern is genuinely split: contract docs bound by a test are left
unlinked; user-facing compatibility docs get one README bullet. `env-vars.md`
being an orphan looks like an oversight rather than a decision (it is the newest
of the three and its own milestone summary calls it "authoritative").

**Recommendation for the planner:** wire `docs/plugin-enablement.md` into the
README the same way `hooks-compatibility.md` is wired, in BOTH `README.md` and
`README.es.md` so the two stay in sync. The natural host is `## Configuration
files` (`README.md:149`), which already introduces `claude-plugins.json` and the
`enabled` key's file, rather than the `## Features` component list. Copy the
bullet grammar exactly:

```markdown
- Hooks. Partial support. For more information, see [Hook compatibility](docs/hooks-compatibility.md).
```

Spanish sibling, same line number, same grammar (`README.es.md:28`):

```markdown
- Hooks (ganchos). Soporte parcial. Para más información, consulta [Compatibilidad de hooks](docs/hooks-compatibility.md).
```

Whether to also retro-link `env-vars.md` is out of this phase's scope — surface
it, do not do it.

______________________________________________________________________

## 3. The three new parity tests — per-file closest analog

Selection criteria applied: same file, seeds a MULTI-plugin marketplace, asserts
a WHOLE notification body (not `includes` / substring).

### `tests/orchestrators/plugin/update.test.ts`

**Analog: `update.test.ts:871` — `UGRM-02: bulk @mp update with TWO realized
transitions tallies '2 updated' (verb invariant, no plural-s)`.**

This is the only test in the file that is both multi-plugin and whole-body with
every row realized (its sibling at `:812` suppresses one row via UGRM-01, which
would hide the `true`-vs-absent comparison the phase needs). Opening lines:

```typescript
test("UGRM-02: bulk @mp update with TWO realized transitions tallies `2 updated` (verb invariant, no plural-s)", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "update-tally-2updated-"));
    try {
      await seedPathMarketplace({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
        marketplaceName: "mp",
        manifestPlugins: {
          // Both bumped -> two realized `updated` transitions, no obstacles.
          alpha: { version: "1.0.1", hasSkill: true },
          beta: { version: "1.0.1", hasSkill: true },
        },
        installedVersions: { alpha: "1.0.0", beta: "1.0.0" },
      });

      const { ctx, pi, notifications } = makeCtx();
      await updatePlugins({
        ctx,
        pi,
        scope: "project",
        cwd,
        target: { kind: "marketplace", marketplace: "mp" },
      });
```

Whole-body assertion form to copy (string-concatenation with explicit `\n`, one
row per line, blank lines as `"\n"` entries):

```typescript
      const body = notifications[0]?.message ?? "";
      assert.equal(
        body,
        "● mp [project]\n" +
          "  ● alpha v1.0.0 → v1.0.1 (updated)\n" +
          "  ● beta v1.0.0 → v1.0.1 (updated)\n" +
          "\n" +
          "Plugin update: 2 updated\n" +
          "\n" +
          "/reload to pick up changes",
      );
      // Two benign success rows, no failures/warnings -> info (severity unset).
      assert.equal(notifications[0]?.severity, undefined);
```

The three-plugin DFEN-08 fixture drops straight into `manifestPlugins` because
this seeder already carries `entryDefaultEnabled?: boolean` per plugin (see §4).

### `tests/orchestrators/plugin/reinstall.test.ts`

**Analog: `reinstall.test.ts:3967` — `DFEN-07 / D-103-12: the bulk cascade
carries the skipped and the reinstalled row together`.** It is the file's only
multi-plugin test that is also enablement-aware. Caveat the planner must fix:
it asserts by `assert.match` on two regexes, not whole-body — for DFEN-08 that
is exactly the wrong shape (a reordering survives it, and the phase's whole
point is byte-identity). Copy its FIXTURE half from `:3967` and its ASSERTION
half from the single-plugin sibling at `:3939`, which is whole-body and whose
comment already states the reason:

```typescript
test("DFEN-07 / D-103-12: the bulk cascade carries the skipped and the reinstalled row together", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "reinstall-disabled-bulk-"));
    try {
      const marketplaceRoot = path.join(cwd, "mp-src");
      await seedMarketplace({
        cwd,
        marketplaceRoot,
        pluginName: "keeper",
        resources: { skill: "keeper skill" },
        install: true,
      });
      await seedDisabledInstall(cwd, { marketplaceRoot, pluginName: "sleeper" });
```

Assertion half to copy instead of the regexes (`reinstall.test.ts:3939`):

```typescript
      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]?.severity, undefined);
      // Subject-first, and asserted whole rather than as independent
      // `includes` checks a reordering could survive. No summary line (an info
      // cascade emits none) and no reload hint (nothing was materialized).
      assert.equal(
        notifications[0]?.message,
        "● mp [project]\n  ⊘ hello (skipped) {already disabled}",
      );
```

Note `seedMarketplace` here takes a SCALAR `pluginName` and is called once per
plugin against a SHARED `marketplaceRoot` — that repeat-call idiom is how this
file builds a multi-plugin marketplace, and `reinstall.test.ts:1053` (PRL-13)
shows it at four plugins. No widening is needed on this file's seeder.

### `tests/orchestrators/reconcile/apply.test.ts`

**Analog: `apply.test.ts:2223` — `DFEN-05 / D-102-04: an entry that already says
enabled:true installs the plugin ENABLED and is left exactly as the user wrote
it`.** No test in this file is currently multi-plugin (the seeder is
single-plugin — see §4), so this is a role-match, not an exact one: it is the
nearest in SUBJECT (an enablement-positive case whose expected outcome is "the
pre-milestone behavior, unchanged") and it already uses the two helpers the new
test needs.

Two structural elements to copy from this file rather than invent:

`seedDefaultDisabledInstallScope` (`apply.test.ts:1844`) — the per-file scope
seeder that wraps `seedRealPathMarketplace` and writes base config, local
config, and `state.json`. Its `entryDefaultEnabled: false` line is the exact
knob the new triple fixture generalizes:

```typescript
  const { mpRoot, manifestPath } = await seedRealPathMarketplace({
    parentDir: opts.home,
    marketplaceName: "mp",
    pluginName: "foo",
    version: "1.2.3",
    entryDefaultEnabled: false,
  });
```

`assertInstallDisabledReloadFixedPoint` (`apply.test.ts:2022`) — the reusable
multi-pass assertion helper. Its notify-arity anchor and its row assertion are
the pattern for the reconcile parity assertion:

```typescript
  // The anchor for everything below.
  assert.equal(first.ui.notify.mock.calls.length, 1, "pass 1 must render exactly one cascade");
  const firstArgs = first.ui.notify.mock.calls[0]!.arguments as [string, string?];
  assert.match(
    firstArgs[0],
    /^ {2}◍ foo v1\.2\.3 \(disabled\) \{installs disabled\}$/m,
    `expected the full install-disabled row on pass 1; got:\n${firstArgs[0]}`,
  );
```

Note this file reads notifications off `ctx.ui.notify.mock.calls`, NOT off a
`notifications[]` array — its `makeCtx()` (`apply.test.ts:57`) is a different
harness from the two plugin test files. Do not port the plugin-file idiom here.
Also note the `^...$` + `/m` anchoring: for DFEN-08 the assertion should be a
whole-body `assert.equal` (the `true` row and the silent row asserted equal to
each other and to the literal pre-milestone form), so use the message-string
extraction above with `assert.equal` rather than `assert.match`.

______________________________________________________________________

## 4. `seedRealPathMarketplace` widening — the already-widened sibling

**Yes. Copy the signature shape of `seedPathMarketplace` in
`tests/orchestrators/plugin/update.test.ts:180`.** It is the same fixture
concept already carrying a plugin MAP, already carrying `entryDefaultEnabled`,
and already carrying a per-plugin doc comment explaining why the knob stamps the
ENTRY and not `plugin.json`. Widening `seedRealPathMarketplace` toward anything
else guarantees drift between the two.

Current (single-plugin) shape at `apply.test.ts:1356`:

```typescript
async function seedRealPathMarketplace(opts: {
  parentDir: string;
  marketplaceName: string;
  pluginName: string;
  version: string;
  /**
   * DFEN-04: stamp `defaultEnabled` onto the MARKETPLACE ENTRY when supplied.
   * The entry is the side that WINS the precedence rule over the plugin's own
   * `plugin.json`, so a fixture that declares it here cannot resolve through
   * the fallback and pass for the wrong reason. Absent writes the entry
   * exactly as it was before, leaving every pre-existing caller unaffected.
   */
  entryDefaultEnabled?: boolean;
}): Promise<{ mpRoot: string; manifestPath: string }> {
```

Target shape, from `update.test.ts:180` (keys map 1:1 — `manifestPlugins` is the
widened form of `pluginName`+`version`+`entryDefaultEnabled`):

```typescript
async function seedPathMarketplace(opts: {
  cwd: string;
  marketplaceRoot: string;
  marketplaceName: string;
  /** Map of plugin name -> { version, hasSkill?, hasCommand?, hasAgent?, hasMcp?, hooksJson? } */
  manifestPlugins: Record<
    string,
    {
      version: string;
      ...
      /**
       * DFEN-01: stamp `defaultEnabled` on the MARKETPLACE entry -- the side
       * that WINS the DFEN-02 precedence rule. Stamping the plugin's own
       * `plugin.json` instead would resolve through the fallback, so a fixture
       * aimed at the wrong side can pass for the wrong reason.
       * Absent -> the entry is written exactly as it is without this knob.
       */
      entryDefaultEnabled?: boolean;
      ...
    }
  >;
  /** Map of plugin name -> existing state record version. Absent -> no prior install. */
  installedVersions?: Record<string, string>;
}): Promise<SeededPathMp> {
```

And the body loop shape, so the two seeders iterate identically
(`update.test.ts:222`):

```typescript
  for (const [pluginName, spec] of Object.entries(manifestPlugins)) {
    const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
    await mkdir(pluginRoot, { recursive: true });
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
```

Entry-emission shape stays as `apply.test.ts` already has it — keep the
conditional-spread idiom so an absent knob writes NO key, which is precisely the
"silent" third arm of the DFEN-08 triple:

```typescript
          ...(opts.entryDefaultEnabled !== undefined && {
            defaultEnabled: opts.entryDefaultEnabled,
          }),
```

Backward compatibility: every existing `apply.test.ts` caller passes
`pluginName`/`version` scalars. The lowest-churn widening keeps those keys and
adds an optional `extraPlugins` map — but that is exactly the divergence this
section exists to prevent. Prefer converting all callers to `manifestPlugins`
(there are three: `:1416`, `:1560`, `:1854`) so the two files' seeders read the
same.

______________________________________________________________________

## 5. Catalog block + fixture pair for reinstall `(skipped) {already disabled}`

**Cleanest template: the `reinstall-degraded-component` pair —
`docs/output-catalog.md:763-778` plus its fixture at
`tests/architecture/catalog-uat.test.ts:1506`.**

Why this pair and not `single-mp-mixed-outcomes` (`:780`): the new row is a
single-purpose, single-row, single-reason block that needs its own heading and
its own decision-ID citation. `reinstall-degraded-component` is exactly that
shape and is the most recently added block in the reinstall section, so it
reflects the current house register (including the OUT-03/D-04 tally sentence).
`single-mp-mixed-outcomes` is a composite block and would bury the new row.

Block template (`docs/output-catalog.md:763`):

````markdown
### Reinstall with a degraded component (WARN-01 / D-86-03 / WR-09)

<!-- catalog-state: reinstall-degraded-component -->

```text
A plugin operation needs attention.

● official [user]
  ● alpha v1.0.0 (reinstalled) {malformed skill}

Plugin reinstall: 1 warning

/reload to pick up changes
```

A reinstall drives the same bridges as an install, so a skill or command whose source frontmatter cannot be parsed degrades identically ... OUT-03/D-04: the tally counts by STAMPED severity ...
````

The four invariants that template encodes:

1. `### <Sentence-case description> (<space-separated durable IDs>)` — the
   parenthesized ID list is required, and for the new block the IDs are the
   durable `DFEN-07` / `ENBL-18` family, never `D-103-12` alone if a
   requirement-level anchor exists.
2. `<!-- catalog-state: <kebab-name> -->` on its own line, blank line before the
   fence. The name must be unique across the file and is the key
   `catalog-uat.test.ts` looks up.
3. A ` ```text ` fence holding the EXACT rendered bytes.
4. One explanatory paragraph after the fence, stating severity routing and the
   OUT-03/D-04 tally consequence.

Fixture template (`tests/architecture/catalog-uat.test.ts:1506`) — note the
leading comment citing the requirement, `expectedSeverity` present only when the
renderer stamps one, and `pi:` chosen to control soft-dep markers:

```typescript
    // WARN-01 / WR-09: a component the reinstall's own ledger degraded names
    // its kind on the `(reinstalled)` row and takes the info -> warning raise,
    // matching the install / enable / backfill arms.
    "reinstall-degraded-component": {
      pi: piWithBothLoaded(),
      expectedSeverity: "warning",
      message: {
        label: "Plugin reinstall",
        cardinality: "plural",
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "reinstalled",
                severity: "warning",
                needsReload: true,
                name: "alpha",
                version: "1.0.0",
                dependencies: [],
                reasons: ["malformed skill"],
              },
            ],
          },
        ],
      },
    },
```

For the `(skipped) {already disabled}` row, the plugin-object shape to copy is
the skipped arm already present in `single-mp-mixed-outcomes`
(`catalog-uat.test.ts:1548`) — no `version`, no `dependencies`,
`needsReload: false`, `severity: "info"`, and NO `expectedSeverity` key on the
outer fixture (an info cascade stamps none, which the behavioral test at
`reinstall.test.ts:3939` already proves as `severity === undefined`):

```typescript
              {
                status: "skipped",
                name: "beta",
                reasons: ["up-to-date"],
                severity: "info",
                needsReload: false,
              },
```

There is a completeness gate at `catalog-uat.test.ts:5082` — a fixture entry
with no matching `<!-- catalog-state: -->` annotation fails, and vice versa. The
block and the fixture must land in the same change.

### The IN-01 `(available)` token-table row

The row to amend is `docs/output-catalog.md:142`, and its already-amended
neighbor `(remote)` at `:143` is the model for the added clause:

```markdown
| `(available)`            | ○    | Plugin row -- `marketplace list` / plugin-list surface (no scope bracket per MSG-PL-6 / SNM-11).                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `(remote)`               | ◌    | Plugin row -- list / info / install-completion surfaces for a not-installed git-source plugin whose clone/mirror is not yet materialized locally (RSTA-01 / D-80-03). No scope bracket (SNM-11), and no probe-derived or soft-dependency-derived reason brace -- no materialized tree exists to derive one from. It admits exactly one entry-derived token, the author-declared `{installs disabled}` install-time-state marker, which needs no tree because the marketplace entry is readable from the cached manifest (D-104-06). |
```

Copy the `(remote)` sentence pattern: `It admits ... the author-declared
`{installs disabled}` install-time-state marker, ... (<ID>).` mdformat will
re-pad the table's column widths — do not hand-align.

______________________________________________________________________

## 6. `REQUIREMENTS.md` OUT-02 amendment

**Analog: `OUT-05` in the same file**, which is already written in the
three-input, decline-rather-than-claim register the amended OUT-02 needs:

```markdown
- [x] **OUT-05**: `list` and `info` stay network-free (NFR-5). The marketplace entry is always readable from the cached manifest, but `plugin.json` requires a materialized clone, so an unfetched `(remote)` plugin can only be judged from the entry. When the entry is silent, the surfaces must not claim `{installs disabled}` on a `plugin.json` value they cannot read, and must not fetch in order to read it.
```

Current OUT-02 text (the sentence to replace — its "resolved `defaultEnabled`"
is the phrase its own implementation violates):

```markdown
- [x] **OUT-02**: `plugin list` renders `{installs disabled}` on the row of a not-installed plugin whose resolved `defaultEnabled` is `false`, following the established subject-first row grammar.
```

Bullet grammar to preserve: `- [x] **<ID>**: <sentence>.` The checkbox state and
the `| OUT-02 | Phase 104 | Complete |` traceability row at the file's tail stay
as they are — this is a wording correction, not a re-scoping.

______________________________________________________________________

## Shared Patterns

### Comment ID discipline (applies to every file this phase touches)

**Source:** `.planning/codebase/CONVENTIONS.md`, `.claude/rules/typescript-comments.md`
**Apply to:** all three new tests, the catalog block, the new doc

Cite durable spec IDs (`D-NN`, `NFR-N`, `OUT-NN`, `DFEN-NN`, `DOC-NN`,
`ENBL-NN`) as traceability anchors. NEVER cite GSD process artifacts —
no `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N`, `Pattern N`. CONTEXT.md adds a
phase-specific corollary: source comments currently citing `D-104-01` (a phase
decision ID that archives with its phase) must be re-pointed at the DOC-02
write-up in the new doc.

Test-title form, from all three target files — the durable IDs lead, then a
colon, then a declarative claim in the present tense:

```typescript
test("DFEN-07 / D-103-12: the bulk cascade carries the skipped and the reinstalled row together", async () => {
test("UGRM-02: bulk @mp update with TWO realized transitions tallies `2 updated` (verb invariant, no plural-s)", async () => {
test("DFEN-04 / OUT-01 / OUT-04 / S2: an install-disabled outcome renders its cause, remedy and version, and its post-commit warnings still reach notifyDiagnostic", async () => {
```

### Closed-set discipline

**Source:** `tests/architecture/compat-01-no-expansion.test.ts`,
`extensions/pi-claude-marketplace/shared/grammar/`
**Apply to:** the catalog block only

Closed sets are `as const` tuples with `(typeof X)[number]` unions. Per CONTEXT.md
criterion 4, this phase adds NO closed-set member — the one intended `REASONS`
delta (`installs disabled`, appended at the tail) already landed. The catalog
block for `{already disabled}` reuses an existing member, so no tuple, renderer
arm, or `compat-01` enumeration changes. Do not build a second no-expansion test.

### The grep gate already exists

**Source:** `tests/architecture/no-lifecycle-default-enabled-read.test.ts`
**Apply to:** the update + reinstall parity tests

CONTEXT.md asks the sweep to pair a behavioral test with a source-level grep
gate for `update` and `reinstall`. That gate is already shipped — this file
forbids `defaultEnabled` / `applyDefaultEnabled` in both orchestrators, with a
documented resolver carve-out, both patterns justified as non-redundant, and no
target excused as missing (WR-06). It delegates comment-stripping to
`tests/helpers/source-scan.ts::assertNoForbiddenSurface` (D-98-09 / D-98-10) —
never hand-roll a raw read plus a match. The phase should assert this gate's
continued pass, not add a second one.

### Notification-body assertion form

**Source:** `update.test.ts:900`, `reinstall.test.ts:3957`
**Apply to:** all three parity tests

Whole-body `assert.equal` against a literal, never `includes` / `match`, with an
inline comment naming what a substring check would have survived. Two accepted
literal styles, both in use: `+`-concatenated `"...\n"` strings
(`update.test.ts`) and `[...].join("\n")` (`reinstall.test.ts:3591`). Match the
surrounding file. Always pair with the severity assertion
(`assert.equal(notifications[0]?.severity, undefined)` for an info cascade) and,
where arity matters, `assert.equal(notifications.length, 1)` per IL-2.

## No Analog Found

None. Every touch point in this phase has a same-file or same-genre analog.

## Metadata

**Analog search scope:** `docs/`, `README.md`, `README.es.md`,
`tests/orchestrators/plugin/`, `tests/orchestrators/reconcile/`,
`tests/architecture/`, `.planning/workstreams/defaults-enabled/REQUIREMENTS.md`
**Files scanned:** 14
**Pattern extraction date:** 2026-08-15
