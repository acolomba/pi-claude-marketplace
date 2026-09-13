# Phase 7: Gate Integrity - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 22 (9 new, 13 modified)
**Analogs found:** 21 / 22

Scope note: RESEARCH.md §"Architecture Patterns" and §"Code Examples" already own the
three named mechanisms and their runnable snippets. This file does not restate them. It
answers one question per file: **which existing file in this tree is the closest thing to
what you are about to write, what exactly do you copy from it, and what must differ.**

Every analog path below was verified git-tracked (`git ls-files`). No `.gsd/capabilities/`
mirror paths appear here.

## File Classification

### New files

| New file | Role | Data flow | Closest analog | Match |
|----------|------|-----------|----------------|-------|
| `tests/architecture/<registry>.ts` | support module (non-`.test.ts`) | pure data | `tests/architecture/source-scan.ts` | exact (placement/header/no-case-registration) |
| `tests/architecture/<registry>.test.ts` | gate (self-hosting meta-gate) | file-I/O scan | `tests/architecture/partial-vocabulary-guard.test.ts` | exact (directory walk + allowlist-filter + deep-equal) |
| `tests/architecture/temp-root-control.ts` | support module | file-I/O | `tests/architecture/source-scan.ts` (placement) + `scripts/check-corresponding-tests.negative.mjs` (mkdtemp/finally) | role-match |
| `tests/architecture/eslint-effective-config.test.ts` | gate | tool-invocation / request-response | `tests/architecture/import-boundaries.test.ts:316-400` (programmatic `ESLint` construction) | role-match |
| `tests/fixtures/eslint-probe/{blanket-no-console,zone-substitution,rule-off}.config.js` | config fixture | config composition | `eslint.config.js` (spread source); no in-repo fixture-config precedent | **no analog** |
| closed-set enrollment gate (`SCN-F025`) | gate | pure/type | `tests/architecture/notify-closed-set-locks.test.ts` | exact |
| test-only-surface gate (`__`-prefix) | gate | file-I/O scan | `tests/architecture/no-orchestrator-network.test.ts` + `source-scan.ts` | exact |
| unowned-export census gate (`D-07-19` pin) | gate | subprocess + pinned snapshot | `tests/architecture/notify-closed-set-locks.test.ts` (pin shape) + `import-boundaries.test.ts:132-155` (script-string read) | role-match |
| `git init` fixture builder in the negative harness | test harness helper | subprocess | `scripts/check-corresponding-tests.negative.mjs:1-20` (fixture-root prelude) | partial |

### Modified files

| Modified file | Role | Data flow | Change kind | Analog for the change |
|---------------|------|-----------|-------------|-----------------------|
| `tests/architecture/source-scan.ts` | support module | file-I/O | inject `opts.root`, return `ScanReport` | `scripts/test-coverage-direct.mjs:305` (`selectedProjectRoot = projectRoot`) |
| `tests/architecture/no-orchestrator-network.test.ts` | gate | file-I/O scan | +3 targets, +dynamic-import pattern | its own `FORBIDDEN_PATTERNS:137-142` |
| `tests/architecture/import-boundaries.test.ts` | gate | tool + file-I/O | replace `loadZones()`; delete canary; per-name control | `notify-closed-set-locks.test.ts` (pin) |
| `tests/architecture/partial-vocabulary-guard.test.ts` | gate | file-I/O scan | widen `collectGuardedSources()`, per-token allowlists | its own `:250-258` allowlist form |
| `tests/architecture/markers-snapshot.test.ts` | gate | pure snapshot | trim duplicated pins, fix dangling citation | itself (`:72-76` is the keeper shape) |
| `tests/architecture/hooks-dispatch.test.ts` | gate | file-I/O scrape | delete one case (`:41-73`) | — (deletion) |
| `scripts/test-coverage-direct.mjs` | gate script | git subprocess | root param + `selectBase(root)` export | `:305` in the same file |
| `scripts/test-coverage-direct.negative.mjs` | negative harness | subprocess + fs | +git fixture cases | its own `:110-145` spawnSync block |
| `extensions/.../plugin/reinstall-replace.ts` | orchestrator leaf | transform | remove `__operations` | `reinstall-flow.ts:180-200` (`createReinstallPlugin`) |
| `extensions/.../plugin/reinstall-flow.ts` | orchestrator composition root | transform | remove both `__deps` | itself (`:180-200`) |
| `extensions/.../domain/manifest.ts` | domain | pure | unexport `MARKETPLACE_VALIDATOR` | — |
| `extensions/.../reconcile/apply.ts` | orchestrator | pure | unexport `surfacePostCommitWarnings` | — |
| `extensions/.../plugin/fetch.ts` | orchestrator | transform | dynamic `import()` → static | its existing static `domain/` imports |
| `extensions/.../domain/components/hook-events.ts` | domain | pure/type | add reverse `Exclude<>` proof; fix `:58-65` doc | — |

## Pattern Assignments

### `tests/architecture/<registry>.ts` (support module, pure data)

**Analog:** `tests/architecture/source-scan.ts`

**Copy the placement and the self-declaration.** `source-scan.ts` is the tree's only
non-`.test.ts` module inside `tests/architecture/`, and its header states in one line why
that is safe — the `D-98-09` rule. Repeat that line verbatim in intent:

```ts
// tests/architecture/source-scan.ts:20
 * This file registers no case of its own.
```

**Copy the exported-constant form** (`source-scan.ts:28-32`) — a `const` with an explicit
type annotation, doc-commented, `export`ed:

```ts
/** Repository root, resolved from this module's own URL (`tests/architecture/`). */
export const REPO_ROOT: string = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
```

**What to change:** the registry holds **string literals only**, never `path.join` or a
template. `D-07-05` is defeated the moment one entry is composed. `REPO_ROOT` itself stays
in `source-scan.ts` — moving it would churn `compat-01-no-expansion.test.ts:98` and
`manifest-lookup-drift.test.ts:32` for no gain.

**Naming for grouped exports:** mirror the existing tuple form in
`import-boundaries.test.ts:218-225` — `as const` arrays with a doc block explaining what
membership means:

```ts
// tests/architecture/import-boundaries.test.ts:218-225
const PLUGIN_LEDGERS = [
  "install-flow",
  "update-flow",
  "uninstall",
  "reinstall-flow",
  "enable-disable",
] as const;
const MARKETPLACE_LEDGERS = ["add", "remove", "update", "autoupdate"] as const;
```

Change: those five are **bare names** joined into a path later. The registry's version must
be five full literal repo-relative paths, and the regex-joining site derives the bare names
from them (`path.basename(p, ".ts")`), not the reverse.

---

### `tests/architecture/<registry>.test.ts` (gate, file-I/O scan)

**Analog:** `tests/architecture/partial-vocabulary-guard.test.ts`

This is the closest fit in the tree: it is the only gate that already walks
`tests/architecture/*.ts`, already excludes itself, and already uses the allowlist-filter
form the four `source-scan.test.ts` non-paths need.

**Copy the self-exclusion** (`:53`, `:89-101`) — the meta-gate must exclude *both* itself
and the registry module:

```ts
// tests/architecture/partial-vocabulary-guard.test.ts:53, :95-101
const SELF = path.relative(REPO_ROOT, fileURLToPath(import.meta.url));
...
  const abs = path.join(ARCH_DIR, entry.name);
  if (path.relative(REPO_ROOT, abs) === SELF) {
    continue;
  }
```

**Copy the allowlist form** (`:250-258`) for the four deliberate non-paths in
`source-scan.test.ts` (`renamed-away.ts`, `not-yet-written.ts`, `other-missing.ts`,
`not-this-one.ts`):

```ts
// tests/architecture/partial-vocabulary-guard.test.ts:251-257
  const ALLOW = "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
  const hits = filesContaining("`(unsupported)`", GUARDED_SOURCES).filter((f) => f !== ALLOW);
  assert.equal(
    hits.length,
    0,
    `... must be ABSENT ... found in:\n  ${hits.join("\n  ")}`,
  );
```

**What to change — this is the fallow-complexity trap.** The guard reads with `readFileSync`
inside `collectGuardedSources()` and does parsing + policy in one place. RESEARCH.md §11
ranks the meta-gate medium risk for `maxUnitSize: 60` / `maxCognitive: 15`. Split it:
`namedProductionPaths(source): string[]` (pure extractor, one regex, one loop) and a
separate set-difference assertion. ESLint's cognitive rule is **off** for `tests/**`
(`eslint.config.js:315`); Fallow's is not. Do not use `npm run lint` as evidence here.

**Failure message:** keep the requirement anchor, as every gate here does. Name `D-07-05`
and state the sanctioned alternative ("import it from the registry").

---

### `tests/architecture/temp-root-control.ts` (support module, file-I/O)

**Analog for placement and header:** `tests/architecture/source-scan.ts:1-21`
**Analog for the mkdtemp/finally lifecycle:** `scripts/check-corresponding-tests.negative.mjs:1-8`

```js
// scripts/check-corresponding-tests.negative.mjs:1-8
import { mkdir, mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
...
const fixtureRoot = await mkdtemp(path.join(tmpdir(), "corresponding-tests-gate-"));
```

and the disposal, `scripts/test-coverage-direct.negative.mjs:290-292`:

```js
} finally {
  await rm(fixtureRoot, { force: true, recursive: true });
}
```

**What to change:** those two are `.mjs` harnesses with one module-level fixture root and a
top-level `try/finally`. A `tests/architecture/` support module under `node:test` cannot use
a module-level root — each case owns its own (Phase 4's case-owned-filesystem rule). Export
three separate small functions, per RESEARCH.md §11's shape guidance, rather than one
do-everything helper; the binding ceiling is `maxUnitSize: 60`, not cognitive.

**Do not reach for `strong-mock`.** RESEARCH.md §"Standard Stack" is explicit that
architecture gates read files rather than collaborate with objects.

---

### `tests/architecture/source-scan.ts` — modification (injected root + `ScanReport`)

**Analog for the injected-root shape:** `scripts/test-coverage-direct.mjs:305`

```js
// scripts/test-coverage-direct.mjs:305 — the house precedent for an injectable root
export function assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot = projectRoot) {
```

Note the doc block immediately above it (`:297-303`), which explains that the root governs
**both** halves of the answer and why a root reaching only one half is "a wrong answer
wearing the shape of a pass." Mirror that reasoning in the new `opts.root` doc — the
`ScanReport.visited` paths must be reported relative to the *injected* root, not `REPO_ROOT`,
or the `D-07-03` deep-compare silently passes against the wrong base.

**What to change:** put `root` inside the existing `opts` bag rather than adding a fourth
positional. That keeps all six existing call sites compiling (RESEARCH.md §2) and matches
CONVENTIONS.md §"Function Design" (opts object for optional/named fields). The line to
modify is `:77`:

```ts
// tests/architecture/source-scan.ts:74-89 — the read whose root becomes injectable
  for (const rel of targets) {
    let src: string;
    try {
      src = await readFile(path.join(REPO_ROOT, rel), "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        assert.ok(
          opts.allowMissing?.includes(rel),
          `source-scan: target ${rel} does not exist, ...`,
        );
        continue;
      }
      throw err;
    }
```

Preserve the `ENOENT`-vs-rethrow split exactly. `D-07-03` **adds** the visitation report; it
does not replace `WR-06`. A `continue` on a waived target must record the path in
`ScanReport.waived`, never in `visited` — that distinction is the whole point of the report.

**Extend the header, do not rewrite it.** `:1-21` already records the two `D-98-*` rules that
future readers depend on. Add the root/report rationale as a new paragraph.

---

### `tests/architecture/no-orchestrator-network.test.ts` (gate, file-I/O scan)

**Analog:** itself. The change is additive to two arrays.

**Pattern to copy for the new dynamic-import clause** — `:136-142`:

```ts
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "import from platform/git", pattern: /from\s+["'][^"']*platform\/git[^"']*["']/ },
  { name: "DEFAULT_GIT_OPS reference", pattern: /\bDEFAULT_GIT_OPS\b/ },
  { name: "gitOps reference", pattern: /\bgitOps\b/ },
  { name: "refreshGitHubClone reference", pattern: /\brefreshGitHubClone\b/ },
];
```

Add a fifth entry in the same `{ name, pattern }` shape. RESEARCH.md §9 supplies the measured
regex. **Non-global regexes only** — `import-boundaries.test.ts:227-228` documents why
(`lastIndex` carries across `.test()` and skips every second file).

**Copy the per-target rationale convention.** `FORBIDDEN_TARGETS` (`:67-135`) carries an
inline comment beside each entry, and the header at `:8-13` states that the array is
authoritative precisely so it is not restated. The three new marketplace entries
(`autoupdate.ts`, `list.ts`, `remove.ts`) each need their own rationale comment in that form.

**What to change:** nothing about the call site at `:149` except capturing the new
`ScanReport` return and deep-comparing `report.visited` against the registry's target list.

**Free benign control.** `autoupdate.ts:60-61` and `list.ts:7-9` name `platform/git` and
`DEFAULT_GIT_OPS` in their own headers. Those are the `D-07-04` near-miss control the gate
gets for nothing — the same case proves `stripComments` still runs.

---

### `tests/architecture/import-boundaries.test.ts` (gate, tool + file-I/O)

**Analog for the replacement of `loadZones()`:** the programmatic-`ESLint` block already in
this file, `:316-400`. Copy its **construction and typing discipline**, discard its
`overrideConfig`:

```ts
// tests/architecture/import-boundaries.test.ts:339-352 — the local ESLint typing to reuse
    const { ESLint } = (await import("eslint")) as {
      ESLint: new (opts: { ... }) => { lintFiles: ... };
    };
```

Change the constructor options from `{ ignore: false, overrideConfigFile: true,
overrideConfig: [...] }` to `{ cwd: REPO_ROOT, overrideConfigFile: <fixture path> }`, and
the method from `lintFiles` to `calculateConfigForFile`. Note the whole `:325-338` comment
block explaining *why* the synthetic config existed goes with the deleted case (`D-07-02`
amended) — do not leave the explanation orphaned behind a removed body,
`.claude/rules/typescript-comments.md` forbids narrating code that no longer exists (the
tree already has one such orphan at `orchestrators/plugin/info.ts:2483-2485`).

**Analog for the per-name positive control (`D-07-08`):** the existing loop at `:264-278`,
which already walks `PLUGIN_LEDGERS` and reads each composed path:

```ts
// tests/architecture/import-boundaries.test.ts:265-272
  for (const name of PLUGIN_LEDGERS) {
    const rel = `${ORCHESTRATORS_REL}/plugin/${name}.ts`;
    // A renamed or deleted ledger must fail loudly rather than silently
    // uncovering this direction of the gate.
    const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
```

That loop already proves the target **resolves**. What it does not prove is that the joined
regex still **matches** a violation naming that target. Add the `assert.match` half inside
the same loop shape (RESEARCH.md §"Pattern 3" has the exact assertion). Change `rel` from a
composed template to a registry lookup — this file is `D-07-05`'s largest single consumer
(40 zone strings at `:66-113` plus 9 ledger paths).

**Keep unchanged:** the `D-11` fallow-script gate at `:132-155`. RESEARCH.md §4 measured it
as *not* vulnerable to the first-match weakness — it uses a token allow-list over the script
string, not a raw-config read. It is also the closest analog for the new unowned-export
gate's "read a tool invocation and assert its shape" half.

---

### `tests/architecture/eslint-effective-config.test.ts` (gate, tool-invocation)

**Analog:** `tests/architecture/import-boundaries.test.ts:316-400` for the ESLint plumbing;
`tests/architecture/hooks-dispatch.test.ts:41-73` for the **contract being replaced**.

The three exempt paths are already written down and are the assertion this file inherits:

```ts
// tests/architecture/hooks-dispatch.test.ts:44-48 — the expected set survives; the scrape does not
  const expectedPaths = [
    "extensions/pi-claude-marketplace/persistence/migrate.ts",
    "extensions/pi-claude-marketplace/shared/debug-log.ts",
    "extensions/pi-claude-marketplace/shared/notification-dispatch.ts",
  ];
```

Carry that array over verbatim (into the registry, per `D-07-05`) and keep the
`assert.deepStrictEqual(sorted, expectedPaths)` final shape. **Delete** everything between
`:52` and `:71` — the `matchAll(/files:\s*\[([^\]]+)]/g)` scrape and the 600-character
`objectTail` window are `AHG-014` itself. `D-07-12` is explicit that the superseded gate
comes out rather than sitting beside the strong one.

**Keep the sibling cases in `hooks-dispatch.test.ts` untouched:** `:21-38` (the
`console.error` source sweep) and `:75-95` (the `hookDebugLog` routing check) are unrelated
to `AHG-014`. Only the middle case is deleted.

**Copy the `{ timeout: 60_000 }` option** from `import-boundaries.test.ts:317` — ESLint
construction plus a 229-file sweep measured at ~2.3 s, but the default node:test timeout is
not something to gamble a CI job on.

---

### `tests/fixtures/eslint-probe/*.config.js` — **no analog in this tree**

There is no existing committed ESLint fixture config; `tests/fixtures/` holds only
`bad-imports/` (two `.ts` files) and six hooks JSON fixtures. Use RESEARCH.md §"Code
Examples" §"Resolving effective ESLint severity" verbatim — it is a measured, runnable
three-line file.

Two constraints that come from outside RESEARCH's snippet:

- `eslint.config.js:303` globally ignores `tests/fixtures/bad-imports/**`. Confirm the new
  `tests/fixtures/eslint-probe/**` is **not** swept into a similar ignore, or
  `overrideConfigFile` will resolve a config that cannot see its own file. (It does not need
  to lint itself — but `format:check` and `lint` do run over it.)
- `scripts/check-corresponding-tests.mjs` requires no production pair for these (they are
  not under `tests/<root>/` as `.test.ts`), and
  `tests/architecture/unit-suite-glob-completeness.test.ts` matches `**/*.test.ts` only, so
  neither gate needs an amendment. Verify before adding, not after.

---

### Closed-set enrollment gate for `ClaudeHookEvent` / `Dependency` (`SCN-F025`)

**Analog:** `tests/architecture/notify-closed-set-locks.test.ts` — exact match, copy its
whole shape.

**Copy the header's argument** (`:1-17`), which is the reasoning `SCN-F025` needs restated
for a different closed set:

```ts
 * The compile-time proofs (`notify-reasons.ts::_ReasonsCoverageProof`, the
 * `assertNever` renderer tails) catch a member that is REMOVED or RENAMED, but
 * an ADDITIVE drift -- a new literal appended to a set and given a home
 * everywhere the type system looks -- is silently absorbed.
 *
 * These exact-length assertions are the deliberate-bump tripwire for that case
```

**Copy the per-bump comment convention** (`:30-51`) — every count carries a line naming the
requirement ID that grew it. This is what turns a bare number into an auditable ledger:

```ts
test("OUT-08: REASONS is the closed 44-entry reason set", () => {
  // D-76-08: +1 for the `authentication required` failure-class member (32 -> 33).
  // ...
  assert.equal(REASONS.length, 44);
});
```

**What to change:** `ClaudeHookEvent` is a *type* union with no runtime tuple, so the length
pin lands on `BUCKET_A_EVENTS` (10) in `domain/components/hook-events.ts`, and the reverse
direction needs a compile-time `Exclude<ClaudeHookEvent, BucketAEvent> extends never` proof
in the production module — RESEARCH.md §7 falsified the `satisfies readonly T[]` claim with
`tsc` output, and the `hook-events.ts:58-65` doc comment asserting "or vice versa" must be
corrected in the same change. Cite the decision/requirement ID in that comment, never a
phase number (`.claude/rules/typescript-comments.md`).

---

### Unowned-export census gate (`D-07-19` pinned snapshot)

**Analog for the pin semantics:** `tests/architecture/notify-closed-set-locks.test.ts` (as
above — the "fails in both directions, forgives nothing" property `D-07-19` leans on).
**Analog for the byte-snapshot framing:** `tests/architecture/markers-snapshot.test.ts:23-36`
— a doc block per pinned value explaining *why* the bytes are a contract.
**Analog for reading a tool invocation:** `import-boundaries.test.ts:132-155`.

**What to change from `notify-closed-set-locks`:** that gate imports live tuples and counts
them. This one shells out to `fallow dead-code --production --unused-exports --format json`
and deep-compares the parsed set against a committed list. Prefer `assert.deepEqual(actual,
PINNED)` over a bare length assertion — a length pin absorbs a swap (one export removed, one
added), which is exactly the drift class this milestone keeps hitting. The 91-entry list is
in RESEARCH.md §5, minus the two removed here.

---

### Test-only-surface gate (`__`-prefix + `@internal Test-only`)

**Analog:** `tests/architecture/no-orchestrator-network.test.ts` — same shape (target list +
pattern list + one `assertNoForbiddenSurface` call at `:149`).

**What to change:** the target set is a directory walk over `extensions/**`, not a hand-named
list, so the `WR-06`/`D-07-03` visitation proof has different content — assert the walk
returned a non-empty, plausible file count, in the form
`import-boundaries.test.ts:249` already uses:

```ts
  assert.ok(files.length > 0, `walked ${ORCHESTRATORS_REL}/marketplace and found no .ts files`);
```

**Carve-out required.** `domain/plugin-root.ts:16` is `declare const __absolutePluginRootBrand:
unique symbol` — a nominal-type brand, not a seam. A naive `__` pattern false-positives on it.
Use the allowlist-filter form from `partial-vocabulary-guard.test.ts:251-252` and document the
carve-out beside it.

**Classified-and-kept, not offenders:** the `cloneCacheSeam?` fields at `install-flow.ts:163`,
`fetch.ts:111`, `info.ts:127` are typed optional ports Phase 5 authorized, not `__deps` bags.
The pattern must not match them; record that as a deliberate exclusion.

---

### `extensions/.../orchestrators/plugin/reinstall-replace.ts` — remove `__operations`

**Analog:** `reinstall-flow.ts:180-200`, in the sibling file. This is the production-owned
collaborator pattern the phase is migrating *toward*, and it is already written:

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:180-200
export function createReinstallPlugin(
  transaction: ReinstallTransaction,
  hooksRouting: ReinstallHooksRouting,
  completionCache: CompletionCache,
): ReinstallPluginFn {
  return (options) =>
    reinstallPluginWithTransaction(
      REINSTALL_FLOW_OWNERS, transaction, hooksRouting, completionCache, options,
    );
}

/** Binds one production reinstall to the real transaction and supplied routing owner. */
export function createNodeReinstallPlugin(...): ReinstallPluginFn {
  return createReinstallPlugin(REAL_REINSTALL_TRANSACTION, hooksRouting, completionCache);
}
```

**Copy:** the two-tier `create<X>(collaborators)` / `createNode<X>()` split, the required
(never-defaulted) collaborator parameter, and the `REAL_*` module constant bound only in the
`createNode*` wrapper. `install-flow.ts:192` (`REAL_INSTALL_TRANSACTION`) is the same shape
in the install family.

**Copy the named-owner-record idiom** for the collaborator's type,
`reinstall-flow.ts:164-176`:

```ts
/** Named leaf owners bound by the public reinstall flow composition root. */
interface ReinstallFlowOwners {
  readonly probeReinstallClone: typeof probeReinstallClone;
  ...
}

const REINSTALL_FLOW_OWNERS: ReinstallFlowOwners = { probeReinstallClone, ... };
```

`ReinstallReplaceOperations` (`reinstall-replace.ts:107-132`) is already exactly this shape —
a 22-member `typeof`-keyed record. The only thing missing is enrollment in
`ReinstallTransaction` (`:142-148`) and export of `REAL_REINSTALL_REPLACE_OPERATIONS`
(`:158-182`, currently module-private). RESEARCH.md §6 has the target signature.

**Delete these two lines** (`reinstall-replace.ts:103-104` and `:192`):

```ts
  /** @internal Test-only bridge operations; production callers omit this. */
  readonly __operations?: ReinstallReplaceOperations;
...
  const operations = input.__operations ?? REAL_REINSTALL_REPLACE_OPERATIONS;
```

**Keep** `ReinstallReplacement.operations` (`:88-89`) — RESEARCH.md §6 classifies it as a
legitimate compensation-ledger field. Drop only its `@internal` tag, since it stops being
test-facing.

**No default parameter** on the new required argument: `D-05-01` forbids unused defaults, and
production always supplies it through the transaction.

---

### `extensions/.../orchestrators/plugin/reinstall-flow.ts` — remove both `__deps`

**Analog:** the same `createReinstallPlugin` at `:180-200`, in this very file. The
collaborators `__deps` carries are already reachable through the composition root; the bag is
a second, parallel injection path.

**Nine sites move** (measured): `:119` (the `ReinstallPluginDeps` interface), `:138`, `:151`
(the two optional members), and the six reads `:257`, `:396-397`, `:531`, `:714-715`. The
forwarding site at `:531` is the one to watch — it is inside the bulk cascade's option
spread:

```ts
// extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:531
        ...(opts.__deps !== undefined && { __deps: opts.__deps }),
```

That conditional-spread idiom (`...(x !== undefined && { x })`) is the file's house form for
`exactOptionalPropertyTypes` and stays; only the `__deps` member goes.

**Scope warning:** `D-07-18` names `__operations` only. Removing that alone leaves the new
`__`-prefix gate red on `:138` and `:151`. Both must land before the gate does, or the gate
lands red.

---

### `scripts/test-coverage-direct.mjs` — injectable root + `selectBase(root)`

**Analog:** `scripts/test-coverage-direct.mjs:305` in the same file (quoted above under
`source-scan.ts`). Use the identical `selectedProjectRoot = projectRoot` default-parameter
form for `gitLines` and `changedPaths` — RESEARCH.md §10 route 1 explicitly recommends
matching this file's own precedent over a `spawnSync`-a-copy approach.

**The line the phase exists to change** (`:106-119`):

```js
function gitLines(args) {
  try {
    return execFileSync("git", args, {
      cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).split("\n").map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}
```

`stdio[2] === "ignore"` plus a bare `catch { return [] }` is what collapses exit 128 into a
green run (`D-07-14`). Change: surface the failure rather than swallowing it, and make
`changedPaths` distinguish resolved-empty from failed-empty. RESEARCH.md §"Code Examples"
§"Distinguishing a resolved-empty change set" has the target shape.

**Copy the doc-block convention from `:297-303`** — that block explains a subtle wrong-answer
mode in prose before the code. `selectBase` deserves the same treatment: state that the
printed/returned candidate is the auditable artifact (`D-07-13`), not a debug aid.

---

### `scripts/test-coverage-direct.negative.mjs` — new git-fixture cases

**Analog:** itself, plus `scripts/check-corresponding-tests.negative.mjs` for the fixture
prelude.

**Copy the fixture prelude and disposal** (`:11`, `:290-292`) — the file already owns a
`mkdtemp` root and disposes it in a top-level `finally`.

**Copy the subprocess-refusal form** (`:126-142`) for anything that cannot be reached through
an exported function:

```js
  const outsideProject = spawnSync(process.execPath, [gatePath, "../outside-the-project.ts"], {
    cwd: projectRoot,
    encoding: "utf8",
  });

  assert.notEqual(outsideProject.status, 0);
  assert.match(outsideProject.stderr, /Path is outside the project: \.\.\/outside-the-project\.ts/);
```

**Prefer the direct-call form** for the new cases. Once `selectBase(root)` is exported, the
chosen candidate is a return value to assert on rather than stdout to scrape — RESEARCH.md
§10 calls this out as route 1's main benefit.

**Copy the "passing state first" discipline.** The file states it in a comment at `:157`:
"The passing state comes first and is not decoration: without it the three refusals below
could..." — that is `D-07-04`'s benign control, already house practice here.

**What is genuinely new:** `git init -q -b main` fixture construction. Nothing in either
negative harness builds a git repo. RESEARCH.md §10 supplies the exact command sequence
(measured, offline, <2 s for all three fixtures). This is the one piece with no in-repo
analog.

---

### `tests/architecture/markers-snapshot.test.ts` — trim and repair

**Analog:** itself. `:72-76` is the case that survives the `SHC-F047` audit, because
`tests/shared/markers.test.ts` cannot express it:

```ts
test("D-09 state lock file is the .state-lock sentinel below extensionRoot", () => {
  const locations = locationsFor("project", "/tmp/pi-project");
  assert.equal(locations.stateLockFile, path.join(locations.extensionRoot, ".state-lock"));
});
```

Same for `:34-44` — those pin `bridges/agents/marker.ts`, a different module from the owner
test's subject. **Remove** `:55-70` (the two byte pins duplicated in
`tests/shared/markers.test.ts:9-39`), and **fix the header at `:17-20`**, which cites
`tests/architecture/no-legacy-markers.test.ts` — a file that does not exist. That dangling
citation is a criterion-4 instance inside the gate corpus itself.

---

## Shared Patterns

### Gate failure messages are requirement-anchored

**Source:** `tests/architecture/no-orchestrator-network.test.ts:147-155`
**Apply to:** every new and modified gate

```ts
  await assertNoForbiddenSurface(
    FORBIDDEN_TARGETS,
    FORBIDDEN_PATTERNS,
    (offenders) =>
      `NFR-5 / PI-2 / PL-3 / PRL-07 violation: gitOps surface detected in network-free module(s):\n  ${offenders.join("\n  ")}\n  (every gated target is network-free by contract; ... Every other update and list owner is gated.)`,
  );
```

Two properties: the message names its requirement IDs, and it states the **sanctioned
alternative** so the reader knows what to do instead. `import-boundaries.test.ts:255-259`
does the same ("Import the leaf row composer ... instead").

### One deep-equality assertion against an empty array

**Source:** `tests/architecture/source-scan.ts:99`
**Apply to:** every scanning gate

```ts
  assert.deepEqual(offenders, [], describeViolation(offenders));
```

Never `assert.ok(offenders.length === 0)` — a length check reports one number; a deep-equal
reports every offender at once.

### `stripComments` before every match

**Source:** `tests/architecture/source-scan.ts:34-46`
**Apply to:** every new scanning clause

Ten test files already import it. Mandatory here specifically: the three marketplace files
being added to the network gate name the forbidden symbols in their own headers
(`autoupdate.ts:60-61`, `list.ts:7-9`).

### Non-global regexes in per-file loops

**Source:** `tests/architecture/import-boundaries.test.ts:226-228`

```ts
// Non-global on purpose: a /g regex carries `lastIndex` across `.test()` calls
// and would skip every second file in the walk below.
```

The new dynamic-import pattern and the `__`-prefix pattern are both per-file `.test()` users.

### Self-exclusion for a gate that names what it forbids

**Source:** `tests/architecture/partial-vocabulary-guard.test.ts:53, :95-101`
**Apply to:** the registry meta-gate and the test-only-surface gate — both spell out the
tokens they ban.

### Fallow's complexity ceiling applies to test helpers; ESLint's does not

`eslint.config.js:315` turns `sonarjs/cognitive-complexity` **off** for `tests/**/*.ts`.
`.fallowrc.json` has no test exclusion and zero `thresholdOverrides`, and its health gate
analyses every test unit. A green `npm run lint` is not evidence for the new helpers. The
binding constraint on the temp-root helper is `maxUnitSize: 60`; split into
copy / plant / run functions rather than one composite.

### `duplicates.threshold: 3` forces extraction, not a third copy

The temp-root fixture shape (`mkdtemp` → `mkdir -p` → `copyFile` → read/replace/write → scan
→ assert → `rm -rf` in `finally`) written inline in three gates *is* a finding.
`tests/architecture/source-scan.ts` is the precedent for a shared non-`.test.ts` support
module beside the gates.

## No Analog Found

| File | Role | Data flow | Reason |
|------|------|-----------|--------|
| `tests/fixtures/eslint-probe/*.config.js` | config fixture | config composition | No committed ESLint fixture config exists in this tree. `tests/fixtures/` holds only `bad-imports/*.ts` and hooks JSON. Use RESEARCH.md §"Code Examples" §3 directly. |
| `git init` fixture builder in `scripts/test-coverage-direct.negative.mjs` | harness helper | subprocess | Neither negative harness builds a git repo; both only `mkdtemp` + `writeFile`. RESEARCH.md §10 supplies the measured command sequence. |

## Metadata

**Analog search scope:** `tests/architecture/`, `tests/platform/`, `tests/fixtures/`,
`scripts/`, `extensions/pi-claude-marketplace/orchestrators/plugin/`,
`extensions/pi-claude-marketplace/domain/`, `eslint.config.js`
**Files read in full or by targeted range:** 14
**Tracked-source check:** `git ls-files` confirmed for all 7 primary analogs; no gitignored
mirror paths emitted
**Pattern extraction date:** 2026-09-10
