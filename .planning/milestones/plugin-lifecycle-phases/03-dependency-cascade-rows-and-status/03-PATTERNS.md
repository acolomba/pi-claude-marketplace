# Phase 3: Dependency Cascade Rows and Status - Pattern Map

**Mapped:** 2026-10-26
**Files analyzed:** 16 (source, tests, features, docs, catalog fixtures)
**Analogs found:** 15 / 16

All paths are relative to `extensions/pi-claude-marketplace/` unless they start with `test/`, `features/`, `docs/`, or `.planning/`. Every analog below is git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `domain/dependency-range.ts` (new cut helper, D-PL3-09/12/16) | utility | transform | `renderConstraintRange` in the same file (`:285-300`) | exact |
| `test/domain/dependency-range.test.ts` | test | transform | `describe("renderConstraintRange")` same file (`:240-`) | exact |
| `orchestrators/plugin/constraint-fold.ts` (`describeConstraint` version cut) | utility | transform | itself, `:177-190` | exact |
| `orchestrators/plugin/dependency-move.ts` (`refusalCause` cut) | service | transform | itself, `:147-155` | exact |
| `shared/errors.ts` / `install-outcome.ts` (`DirectoryPinUnsatisfiedError` truncation) | model / service | transform | `renderDeclaredRanges` (`dependency-range.ts:299`) | role-match |
| `domain/dependency-closure.ts` (root invalid-id arm, members on failure) | model | transform | `DependencyClosureResult` failure arms `:157-184`; root check `:490-497` | exact |
| invalid-id cause escaping | utility | transform | `shared/notification-mcp.ts::printable` `:65-74` (module-private) | exact (copy, do not import across zones without checking `.fallowrc.json`) |
| `orchestrators/plugin/install-cascade.ts` (member list on failure; `failureDeclarers`) | service | batch | `failedCascade` `:1425-1440`; `requestersOf` `:1719-1732` | exact |
| `orchestrators/plugin/install-cascade.messaging.ts` (+ test) | component (messaging) | transform | `composeCascadeFailureMessage` `:538-573`; `CascadeFailureSubject` `:146-157` | exact |
| `orchestrators/plugin/install-flow.ts` (`unwrapCascade` +1 line) | controller | request-response | itself `:1088-1128` | exact |
| `orchestrators/plugin/dependency-plan.ts` (`unmovable` hint, D-PL3-11) | service | transform | itself `:149-163` | exact |
| `orchestrators/plugin/list-flow.ts` (PL-5 comment citing D-PL3-07) | comment only | - | - | n/a |
| `test/integration/reserved-record-keys.test.ts` | test (integration) | request-response | itself `:389-397` | exact |
| `features/plugin/install-dependencies.feature`, `features/plugin/install.feature` | test (cucumber) | request-response | scenarios at `install-dependencies.feature:72-90`, `:185-200`; `install.feature:59-70` | exact |
| `docs/output-catalog.md` + `test/architecture/catalog-uat/fixtures/plugin-install.ts` + `catalog-contract.test.ts` pins | docs + fixture | - | `dependency-no-matching-version` block (`output-catalog.md:945-957`, fixture `plugin-install.ts:~700-730`) | exact |
| `.planning/PROJECT.md` Key Decisions (D-PL3-06/07) | docs | - | none needed | no analog |

## Pattern Assignments

### `domain/dependency-range.ts` -- new 120/64-unit cut helper

**Analog:** same file, `renderConstraintRange` (`:278-300`). Keep the new helper beside it, exported, explicit return type, doc comment citing the decision ID (D-PL3-09), named constants at module top like `MAX_RENDERED_RANGE_CHARS = 200` (`:50`).

```ts
export function renderConstraintRange(range: string): string {
  if (range.length <= MAX_RENDERED_RANGE_CHARS) {
    return range;
  }

  const dropped = range.length - MAX_RENDERED_RANGE_CHARS;
  return `${range.slice(0, MAX_RENDERED_RANGE_CHARS)}... (+${dropped} chars)`;
}

export function renderDeclaredRanges(ranges: readonly string[]): string {
  return renderConstraintRange(ranges.join(", "));
}
```

New helper differs: cut at `limit` UTF-16 units, drop a trailing lone high surrogate (`0xD800-0xDBFF`), append `…` (U+2026). Do not change `renderConstraintRange` (D-PL3-10 keeps 200 + `... (+N chars)`).

### `test/domain/dependency-range.test.ts`

**Analog:** same file. Imports are one named block from the `.ts` path (`:1-12`, add the helper alphabetically); `describe`/`test` titles lead with a spec ID; arrange/act/assert comments; one `assert.deepStrictEqual` over a composite object:

```ts
describe("renderConstraintRange", () => {
  test("T-03-08 a range at the rendering bound is carried whole", () => {
    // arrange
    const range = ">=1.0.0 ".repeat(25);

    // act
    const rendered = renderConstraintRange(range);

    // assert
    assert.deepStrictEqual({ length: range.length, rendered }, { length: 200, rendered: range });
  });
```

Cases to cover for 100% direct coverage: at bound, past bound, cut landing after a high surrogate.

### `orchestrators/plugin/constraint-fold.ts` (`describeConstraint`, `:177-190`)

Only the `version ${line.version}` interpolation changes; update the doc comment that says the version is interpolated "with NO transformation".

```ts
  const fetched =
    line.arm === "transport" || line.version === undefined ? "" : `version ${line.version} `;
  return `${fetched}${ARM_CLAUSE[line.arm]} (${detail}) -- required by ${required}`;
```

### `orchestrators/plugin/dependency-move.ts` (`refusalCause`, `:147-155`)

```ts
  if (verdict.partition === "unchanged") {
    return `version ${verdict.toVersion} is the newest version it can move to`;
  }
```
Wrap `verdict.toVersion` (and the ruled-out cause's `toVersion`) with the helper at 64.

### Invalid-id cause escape (D-PL3-14)

**Analog:** `shared/notification-mcp.ts:65-74` (module-private, not exported):

```ts
/**
 * AMIG-03: escapes each control, format, line separator and paragraph
 * separator code point, so a file-derived name cannot move the cursor, end a
 * line, or reorder the text around it in the notice.
 */
function printable(text: string): string {
  return Array.from(text, (char) =>
    ESCAPED_CODE_POINT.test(char) ? codeUnitEscapes(char) : char,
  ).join("");
}
```
`ESCAPED_CODE_POINT` and `codeUnitEscapes` sit just above (`~:40-63`). Options for the planner: export from `shared/` (domain and orchestrators may import shared) or reproduce in the messaging file; a copy will trip `fallow dupes`, so exporting (or moving to a small `shared/` leaf) is preferred.

### `domain/dependency-closure.ts` -- root-specific failure arm

**Analog:** the union `:157-184`; add an arm the same way (readonly fields, `ok: false`, `reason` string literal):

```ts
  | {
      readonly ok: false;
      readonly reason: "unusable-declaration";
      readonly key: string;
      readonly detail: string;
    };
```
Root check today (`:490-497`) runs before lookup; D-PL3-04/14 moves the token check after the marketplace lookup when `installPolicy` is passed:

```ts
  const rootParts = splitKey(options.rootKey);
  if (rootParts === undefined) {
    return { ok: false, reason: "unusable-declaration", key: options.rootKey,
             detail: "root: expected <plugin>@<marketplace>" };
  }
```
Members-discovered-before-failure: `ctx.order` / `ctx.members` (`:499-507`) already hold them; the return at `:513` drops them (`failure ?? {...}`). Attach them to the failure result as an optional field rather than reshaping every arm.

### `orchestrators/plugin/install-cascade.ts`

**Optional-field-on-failure-arm analog:** `member-failed` arm carrying `mcpConfigNotices` (type `:573-607`, built in `failedCascade` `:1425-1440`):

```ts
  return {
    kind: "member-failed",
    key: run.attempting ?? options.rootKey,
    error: result.error ?? new Error("Install cascade failed."),
    rollbackPartials: result.rollbackPartials,
    mcpConfigNotices: run.mcpConfigNotices,
  };
```
Add the unmaterialized member keys here from `run.members` minus `run.materialized`-kept/`moved` keys (D-PL3-15: no second row for a `moved` key). Use conditional spread `...(x !== undefined && { x })` for optionals (`exactOptionalPropertyTypes`).

**Declarers (D-PL3-08/13):** derive from `requestersOf` (`:1719-1732`), restricted to closure members:

```ts
function requestersOf(declared: DeclaredEdges, key: string): GraphRequester[] {
  const requesters: GraphRequester[] = [];
  for (const [declarer, edges] of declared) {
    const toKey = edges.filter((edge) => edge.key === key);
    if (toKey.length > 0) {
      requesters.push({ key: declarer,
        ranges: toKey.flatMap((edge) => (edge.range === undefined ? [] : [edge.range])) });
    }
  }
  return requesters;
}
```

### `orchestrators/plugin/install-cascade.messaging.ts`

**Analog:** `composeCascadeFailureMessage` (`:538-573`). Thread the member list through `args` (new optional `readonly members?: readonly string[]`) and emit one extra row per member using exactly the existing root-row literal, then pass all rows through `sortRows`:

```ts
  const root: PluginFailedMessage = {
    status: "failed",
    name: args.rootName,
    reasons: ["dependency failed"],
    severity: "error",
    needsReload: false,
  };
  return sortRows([failed, root], args.scope);
```
Subject union to extend (closure/constraint/member arms) is at `:146-157`. Keep the `isRoot` early return for the root-is-subject case. Note: closed sets (`Reason`, `StatusToken`) must not grow (D-PL3-02).

### `test/integration/reserved-record-keys.test.ts` (`:389-397`)

Pinned expectation to rewrite to `{invalid manifest}` with the upstream invalid-id cause (D-PL3-04/14):

```ts
    assert.deepStrictEqual(refused, [
      {
        message:
          "A plugin operation has failed.\n\n● hostile [project]\n" +
          "  ⊘ __proto__ (failed) {invalid manifest}\n" +
          '    cause: Plugin "__proto__@hostile" declares an unusable dependency ' +
          "(root: expected <plugin>@<marketplace>).",
        severity: "error",
      },
    ]);
```

### Cucumber scenarios

Steps are lowercase, Given/When/Then only (no `And`), full-row tables.

**Template for CAS-01 member rows / walk-failure** -- `install-dependencies.feature:72-90` (add the `lib@tools` row with `failed | dependency failed`, empty cause columns, matching the `app` row):

```gherkin
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id         | name       | status | reasons           | scope   | cause chain                                                 | cause truncated | leaks | rollback partial |
      | tools            | project           | app@tools  | app        | failed | dependency failed | project |                                                             |                 |       |                  |
      | tools            | project           | base@tools | base@tools | failed | not in manifest   | project | Dependency "base@tools" is not declared by its marketplace. | false           |       |                  |
    Then the project scope has no installed plugins
```

**Template for CAS-06 hint / CAS-07 version cut** -- `install-dependencies.feature:185-200` (installed-unsatisfied row with `version` column; append ` To look for a version in range, run /claude:plugin update lib@tools.` to the cause chain when the root declares `lib` directly).

**Template for CAS-02 `_x@mp` listed by its marketplace** -- `install.feature:59-70` (single-plugin failure, summary `A plugin operation has failed.`):

```gherkin
  Scenario: Installing a plugin the marketplace does not offer fails as not in manifest
    When the user runs "/claude:plugin install missing@fixtures --scope project"
    Then the result has these fields:
      | kind         | cascade                        |
      | severity     | error                          |
      | needs reload | false                          |
      | summary      | A plugin operation has failed. |
    Then the result lists these plugins:
      | marketplace name | marketplace scope | id               | name    | status | reasons         | scope   | cause chain                                           | cause truncated | leaks | rollback partial |
      | fixtures         | project           | missing@fixtures | missing | failed | not in manifest | project | Plugin "missing" not found in marketplace "fixtures". | false           |       |                  |
```
Needs a marketplace offering `_x` (use the `offers these plugins with dependencies:` Given from the dependencies feature).

### `docs/output-catalog.md` <-> catalog-UAT fixture pairing

Each catalog block carries `<!-- catalog-state: <id> -->` and a ```text``` example; `test/architecture/catalog-uat/fixtures/plugin-install.ts` holds a same-keyed entry whose `message` renders to those bytes. Example pair:

`docs/output-catalog.md:947-956`
```text
<!-- catalog-state: dependency-no-matching-version -->
Some plugin operations have failed.

● official [user]
  ⊘ formatter@tools (failed) {no matching version}
    cause: Dependency "formatter@tools" has no release tag satisfying ^2.0.0.
  ⊘ helper (failed) {dependency failed}
```
`fixtures/plugin-install.ts` (~`:705-730`)
```ts
      expectedSeverity: "error",
      message: { marketplaces: [ { name: "official", scope: "user", plugins: [
        { status: "failed", name: "formatter@tools", reasons: ["no matching version"],
          cause: new Error('Dependency "formatter@tools" has no release tag satisfying ^2.0.0.'),
          severity: "error", needsReload: false },
        { status: "failed", name: "helper", reasons: ["dependency failed"],
          severity: "error", needsReload: false },
      ] } ] },
```
Every changed/added block: edit both, then update `EXPECTED_STATE_COUNT` (now 323, +1 per new block) and `EXPECTED_UTF8_BYTES` (now 54_039) in `test/architecture/catalog-uat/catalog-contract.test.ts:21-22`. Prose rule at `output-catalog.md:900` ("Failure attribution") must be amended for member rows.

## Shared Patterns

- **Optional fields:** conditional spread `...(v !== undefined && { key: v })` (see `composeCascadeFailureMessage` `:552-558`); required under `exactOptionalPropertyTypes`.
- **Row literal:** `PluginFailedMessage` with `severity: "error", needsReload: false`; sorted via `sortRows(rows, scope)`.
- **Closed vocabulary:** no new `Reason`/`StatusToken`; locks in `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`.
- **Comments:** cite D-PL3-NN / CAS-NN, never phase/plan numbers.
- **Complexity:** both ESLint sonarjs (15) and fallow health (cognitive 15) gate; extract small functions rather than nesting.

## No Analog Found

| File | Reason |
|---|---|
| `.planning/PROJECT.md` Key Decisions rows | docs record only; follow existing table rows in that file |

## Metadata

**Search scope:** `extensions/pi-claude-marketplace/{domain,orchestrators/plugin,shared}`, `test/domain`, `test/integration`, `test/architecture/catalog-uat`, `features/plugin`, `docs/output-catalog.md`
**Files scanned:** ~14
